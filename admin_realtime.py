import asyncio
from dotenv import load_dotenv
load_dotenv()
import hashlib
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque
from pathlib import Path as FilePath
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Path, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

CATEGORIES = ["", "Shoes", "Slides", "Shorts", "Pants", "T-shirts", "Long-sleeve", "Hoodies", "Jackets", "Merch", "Accessories"]
BATCHES = ["", "Best Batch", "Budget Batch", "Random Batch"]

MAX_BODY_BYTES = int(os.environ.get("ADMIN_MAX_BODY_BYTES", "262144"))
_GLOBAL_RPM = max(60, int(os.environ.get("ADMIN_GLOBAL_RPM", "400")))
_WS_ACCEPT_PER_MIN = int(os.environ.get("ADMIN_WS_ACCEPT_PER_MIN", "15"))
_WS_MAX_PER_IP = int(os.environ.get("ADMIN_WS_MAX_PER_IP", "6"))

_ws_accept_log: dict[str, deque[float]] = defaultdict(deque)
_ws_active_by_ip: dict[str, int] = defaultdict(int)
_global_burst_log: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit_client_key(request: Request) -> str:
    if os.environ.get("ADMIN_TRUST_X_FORWARDED", "").strip().lower() in ("1", "true", "yes"):
        xff = request.headers.get("x-forwarded-for", "")
        if xff.strip():
            return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_client_key, headers_enabled=True)


class LimitUploadSizeMiddleware:
    """Cap request bodies using Content-Length or buffering + replay (chunked / missing CL)."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        method = scope.get("method", "GET").upper()
        if method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        cl = headers.get("content-length")
        if cl is not None:
            try:
                n = int(cl)
                if n > self.max_bytes:
                    await self._send_json(send, 413, {"detail": "Payload too large"})
                    return
                if n < 0:
                    await self._send_json(send, 400, {"detail": "Invalid Content-Length"})
                    return
            except ValueError:
                await self._send_json(send, 400, {"detail": "Invalid Content-Length"})
                return
            await self.app(scope, receive, send)
            return

        parts: list[bytes] = []
        while True:
            message = await receive()
            if message["type"] != "http.request":
                backlog: list[dict[str, Any]] = [message]

                async def replay_then_stream() -> dict[str, Any]:
                    if backlog:
                        return backlog.pop(0)
                    return await receive()

                await self.app(scope, replay_then_stream, send)
                return
            chunk = message.get("body", b"")
            if sum(map(len, parts)) + len(chunk) > self.max_bytes:
                await self._send_json(send, 413, {"detail": "Payload too large"})
                return
            parts.append(chunk)
            if not message.get("more_body", False):
                break

        full = b"".join(parts)
        sent = False

        async def replay_receive() -> dict[str, Any]:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": full, "more_body": False}
            return {"type": "http.disconnect"}

        await self.app(scope, replay_receive, send)

    @staticmethod
    async def _send_json(send: Send, status: int, payload: dict[str, str]) -> None:
        raw = json.dumps(payload).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json; charset=utf-8"),
                    (b"content-length", str(len(raw)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": raw, "more_body": False})


class GlobalBurstMiddleware(BaseHTTPMiddleware):
    """Per-IP ceiling on all HTTP requests (abuse / cheap DoS on the admin process)."""

    async def dispatch(self, request: Request, call_next):
        ip = _rate_limit_client_key(request)
        now = time.monotonic()
        q = _global_burst_log[ip]
        while q and now - q[0] > 60.0:
            q.popleft()
        if len(q) >= _GLOBAL_RPM:
            return JSONResponse({"detail": "Too many requests"}, status_code=429)
        q.append(now)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        h = response.headers
        h["X-Content-Type-Options"] = "nosniff"
        h["X-Frame-Options"] = "DENY"
        h["Referrer-Policy"] = "strict-origin-when-cross-origin"
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        h["Cross-Origin-Opener-Policy"] = "same-origin"
        h["Cache-Control"] = "no-store"
        return response


def _strip_htmlish(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s, flags=re.IGNORECASE)


def _constant_time_token_match(got: str, expected: str) -> bool:
    return secrets.compare_digest(
        hashlib.sha256(got.encode("utf-8")).digest(),
        hashlib.sha256(expected.encode("utf-8")).digest(),
    )


async def require_read_token(request: Request) -> None:
    if os.environ.get("ADMIN_REQUIRE_TOKEN_FOR_READ", "").strip().lower() not in ("1", "true", "yes"):
        return
    token = os.environ.get("ADMIN_API_TOKEN", "").strip()
    if not token:
        return
    got = request.headers.get("x-admin-token") or ""
    if not _constant_time_token_match(got, token):
        raise HTTPException(status_code=403, detail="Invalid or missing admin token")


async def require_write_token(request: Request) -> None:
    token = os.environ.get("ADMIN_API_TOKEN", "").strip()
    if not token:
        return
    got = request.headers.get("x-admin-token") or ""
    if not _constant_time_token_match(got, token):
        raise HTTPException(status_code=403, detail="Invalid or missing admin token")


def _ws_client_ip(ws: WebSocket) -> str:
    if os.environ.get("ADMIN_TRUST_X_FORWARDED", "").strip().lower() in ("1", "true", "yes"):
        xff = ws.headers.get("x-forwarded-for", "")
        if xff.strip():
            return xff.split(",")[0].strip()
    host = ws.client.host if ws.client else ""
    return host or "unknown"


def _ws_allow_new_connection(ip: str) -> bool:
    now = time.monotonic()
    q = _ws_accept_log[ip]
    while q and now - q[0] > 60.0:
        q.popleft()
    if len(q) >= _WS_ACCEPT_PER_MIN:
        return False
    if _ws_active_by_ip[ip] >= _WS_MAX_PER_IP:
        return False
    q.append(now)
    return True


def _sb_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def sb_get_all() -> list[dict[str, Any]]:
    # Supabase caps at 1000 rows per request — paginate with offset.
    out: list[dict[str, Any]] = []
    page = 1000
    async with httpx.AsyncClient() as client:
        off = 0
        while True:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/products",
                params={"select": "*", "order": "id.asc", "limit": str(page), "offset": str(off)},
                headers=_sb_headers(),
                timeout=30,
            )
            r.raise_for_status()
            batch = r.json()
            if not batch:
                break
            out.extend(batch)
            if len(batch) < page:
                break
            off += page
    return out


async def sb_insert(product: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/products",
            json=product,
            headers=_sb_headers(),
            timeout=15,
        )
        r.raise_for_status()
        return r.json()[0]


async def sb_update(row_id: int, product: dict[str, Any]) -> None:
    async with httpx.AsyncClient() as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/products",
            params={"id": f"eq.{row_id}"},
            json=product,
            headers=_sb_headers(),
            timeout=15,
        )
        r.raise_for_status()


async def sb_delete(row_id: int) -> None:
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{SUPABASE_URL}/rest/v1/products",
            params={"id": f"eq.{row_id}"},
            headers=_sb_headers(),
            timeout=15,
        )
        r.raise_for_status()


def clean_text(value: str) -> str:
    # Keep text clean and predictable for the JSON DB.
    return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", value or "").strip()


def validate_url(value: str) -> str:
    v = clean_text(value)
    if not v:
        return ""
    if not re.match(r"^https?://", v, re.IGNORECASE):
        raise ValueError("URL must start with http:// or https://")
    p = urlparse(v)
    if p.username is not None or p.password is not None:
        raise ValueError("URL must not contain embedded credentials")
    return v


class ProductIn(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    price: str = Field(min_length=1, max_length=40)
    img: str = Field(default="", max_length=900)
    kakobuy: str = Field(default="", max_length=900)
    picksly: str = Field(default="", max_length=900)
    category: str = Field(default="", max_length=40)
    batch: str = Field(default="", max_length=40)

    @field_validator("title", "price", mode="before")
    @classmethod
    def _clean_required(cls, value: Any) -> str:
        v = _strip_htmlish(clean_text(str(value or "")))
        if not v:
            raise ValueError("Field is required")
        if len(v) > 180:
            raise ValueError("Title too long")
        return v

    @field_validator("img", "kakobuy", "picksly", mode="before")
    @classmethod
    def _validate_urls(cls, value: Any) -> str:
        return validate_url(str(value or ""))

    @field_validator("category", mode="before")
    @classmethod
    def _validate_category(cls, value: Any) -> str:
        v = clean_text(str(value or ""))
        if v not in CATEGORIES:
            raise ValueError("Invalid category")
        return v

    @field_validator("batch", mode="before")
    @classmethod
    def _validate_batch(cls, value: Any) -> str:
        v = clean_text(str(value or ""))
        if v not in BATCHES:
            raise ValueError("Invalid batch")
        return v


class ReorderIn(BaseModel):
    from_index: int = Field(ge=0, le=1_000_000)
    to_index: int = Field(ge=0, le=1_000_000)


class AdminPasswordIn(BaseModel):
    password: str = Field(default="", max_length=256)

    @field_validator("password", mode="before")
    @classmethod
    def _pw(cls, value: Any) -> str:
        return clean_text(str(value or ""))[:256]


class WSManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def register(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)
        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception:
                await self.disconnect(ws)


app = FastAPI(title="Jarvis Finder Realtime Admin")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_raw = os.environ.get("ADMIN_CORS_ORIGINS", "").strip()
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()] if _cors_raw else ["*"]

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GlobalBurstMiddleware)
app.add_middleware(LimitUploadSizeMiddleware, max_bytes=MAX_BODY_BYTES)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = WSManager()
db_lock = asyncio.Lock()


@app.get("/", response_class=HTMLResponse)
@limiter.limit("60/minute")
async def admin_page(request: Request, response: Response) -> str:
    return HTML


@app.get("/api/meta")
@limiter.limit("120/minute")
async def meta(request: Request, response: Response, _: None = Depends(require_read_token)) -> dict[str, Any]:
    return {"categories": CATEGORIES, "batches": BATCHES}


@app.get("/api/products")
@limiter.limit("120/minute")
async def get_products(request: Request, response: Response, _: None = Depends(require_read_token)) -> list[dict[str, Any]]:
    return await sb_get_all()


@app.post("/api/admin/authenticate")
@limiter.limit("5/15minutes")
async def admin_authenticate(request: Request, response: Response, body: AdminPasswordIn) -> dict[str, Any]:
    expected = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not expected:
        raise HTTPException(status_code=400, detail="Password authentication not configured")
    token = os.environ.get("ADMIN_API_TOKEN", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Server missing ADMIN_API_TOKEN")
    got = body.password.encode("utf-8")
    exp = expected.encode("utf-8")
    if len(got) > 512:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    gh = hashlib.sha256(got).digest()
    eh = hashlib.sha256(exp).digest()
    if not secrets.compare_digest(gh, eh):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"ok": True, "token": token}


@app.post("/api/products")
@limiter.limit("60/minute")
async def add_product(
    request: Request,
    response: Response,
    payload: ProductIn,
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    await sb_insert(payload.model_dump())
    products = await sb_get_all()
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    return {"ok": True, "count": len(products)}


@app.put("/api/products/{index}")
@limiter.limit("60/minute")
async def update_product(
    request: Request,
    response: Response,
    index: Annotated[int, Path(ge=0, le=5_000_000)],
    payload: ProductIn,
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    products = await sb_get_all()
    if index < 0 or index >= len(products):
        raise HTTPException(status_code=404, detail="Product index not found")
    row_id = products[index]["id"]
    await sb_update(row_id, payload.model_dump())
    products = await sb_get_all()
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    return {"ok": True, "count": len(products)}


@app.delete("/api/products/{index}")
@limiter.limit("60/minute")
async def delete_product(
    request: Request,
    response: Response,
    index: Annotated[int, Path(ge=0, le=5_000_000)],
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    products = await sb_get_all()
    if index < 0 or index >= len(products):
        raise HTTPException(status_code=404, detail="Product index not found")
    row_id = products[index]["id"]
    await sb_delete(row_id)
    products = await sb_get_all()
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    return {"ok": True, "count": len(products)}


@app.post("/api/products/reorder")
@limiter.limit("60/minute")
async def reorder_product(
    request: Request,
    response: Response,
    payload: ReorderIn,
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    # Reorder not supported with Supabase id-based ordering
    products = await sb_get_all()
    return {"ok": True, "count": len(products)}


@app.websocket("/ws")
async def websocket_updates(ws: WebSocket) -> None:
    ip = _ws_client_ip(ws)
    if not _ws_allow_new_connection(ip):
        await ws.close(code=1008)
        return
    if os.environ.get("ADMIN_REQUIRE_TOKEN_FOR_READ", "").strip().lower() in ("1", "true", "yes"):
        tok = os.environ.get("ADMIN_API_TOKEN", "").strip()
        if tok:
            q = ws.query_params.get("token") or ""
            if not _constant_time_token_match(q, tok):
                await ws.close(code=4401)
                return
    await ws.accept()
    _ws_active_by_ip[ip] += 1
    await manager.register(ws)
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.receive":
                t = msg.get("text")
                b = msg.get("bytes")
                if t is not None and len(t) > 4096:
                    break
                if b is not None and len(b) > 4096:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _ws_active_by_ip[ip] = max(0, _ws_active_by_ip[ip] - 1)
        await manager.disconnect(ws)


HTML = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Jarvis Admin</title>
  <style>
    :root {
      --bg:#0b0b10; --panel:#14141b; --panel2:#1a1a24; --border:#2a2a38;
      --text:#eceef3; --muted:#8b8ba0; --accent:#4f8cff; --accent2:#6a9bff;
      --green:#3ecf8e; --red:#ef5350; --yellow:#ffb74d;
    }
    * { box-sizing:border-box; }
    html, body { height:100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      background: radial-gradient(1200px 600px at 0% 0%, #16162080, #0b0b10 60%), var(--bg);
      color: var(--text); margin:0; font-size:14px;
    }
    .wrap { max-width:1400px; margin:0 auto; padding:20px 24px 140px; }
    h1 { font-size:22px; margin:0 0 16px; font-weight:700; letter-spacing:-0.02em; }
    .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; background:var(--panel2); color:var(--muted); border:1px solid var(--border); }
    .pill.ok { color:var(--green); border-color:#2d6b4d; }
    .pill.warn { color:var(--yellow); border-color:#7a5a1f; }
    .pill.err { color:var(--red); border-color:#7a3030; }

    /* AUTH BAR */
    .auth {
      display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      padding:10px 14px; background:var(--panel); border:1px solid var(--border);
      border-radius:12px; margin-bottom:16px;
    }
    .auth .hint { flex-basis:100%; font-size:12px; color:var(--muted); margin-top:2px; }

    /* EDITOR CARD */
    .editor {
      position: sticky; top: 12px; z-index: 50;
      background: var(--panel); border:1px solid var(--border); border-radius:14px;
      padding:14px 16px; margin-bottom:16px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.45);
    }
    .editor-head {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      margin-bottom:10px;
    }
    .editor-title { font-weight:600; font-size:15px; }
    .status { font-size:13px; color:var(--green); }
    .status.err { color:var(--red); }

    .grid {
      display:grid;
      grid-template-columns: 120px 1fr 1fr;
      gap:10px;
    }
    @media (max-width:900px) { .grid { grid-template-columns: 1fr; } }

    .preview {
      width:120px; height:120px; border-radius:10px; border:1px dashed var(--border);
      display:flex; align-items:center; justify-content:center; overflow:hidden;
      background: #0f0f16; font-size:11px; color:var(--muted); text-align:center;
      grid-row: span 2;
    }
    .preview img { width:100%; height:100%; object-fit:cover; }

    .fields {
      display:grid; gap:8px;
      grid-template-columns: 1fr 120px;
    }
    .fields.full { grid-column: span 2; grid-template-columns: 1fr 1fr 1fr 150px 150px; }
    @media (max-width:900px) { .fields, .fields.full { grid-template-columns: 1fr; } }

    label { display:block; font-size:11px; color:var(--muted); margin-bottom:3px; letter-spacing:.04em; text-transform:uppercase; }
    input, select {
      width:100%; background:#0f0f16; border:1px solid var(--border); color:var(--text);
      padding:9px 11px; border-radius:8px; font-size:13px; font-family:inherit;
    }
    input:focus, select:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(79,140,255,0.15); }

    .actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
    button {
      background: var(--accent); color:#fff; border:none; border-radius:8px;
      padding:9px 14px; cursor:pointer; font-size:13px; font-weight:600;
      transition: background 0.15s, transform 0.05s;
    }
    button:hover { background: var(--accent2); }
    button:active { transform: translateY(1px); }
    button:disabled { opacity:0.45; cursor:not-allowed; }
    button.secondary { background:#2a2a38; }
    button.secondary:hover { background:#363648; }
    button.danger { background:#b53a3a; }
    button.danger:hover { background:#cf4545; }
    button.ghost { background:transparent; border:1px solid var(--border); color:var(--muted); }
    button.ghost:hover { color:var(--text); border-color:var(--accent); }
    button.tiny { padding:5px 9px; font-size:11px; }

    /* FILTER BAR */
    .filterbar {
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      margin:18px 0 12px;
    }
    .filterbar input[type=search] { flex:1; min-width:220px; }
    .filterbar select { width:auto; min-width:140px; }
    .meta { font-size:12px; color:var(--muted); white-space:nowrap; margin-left:auto; }

    /* TABLE */
    .tablewrap { background:var(--panel); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600;
         text-align:left; padding:10px 12px; background:#0f0f16; border-bottom:1px solid var(--border); }
    td { padding:8px 12px; border-bottom:1px solid #1e1e28; vertical-align:middle; }
    tr:last-child td { border-bottom:none; }
    tr:hover { background:#181824; }
    tr.selected { background:#1a2540; }
    .thumb { width:48px; height:48px; border-radius:6px; background:#0f0f16; object-fit:cover; display:block; }
    .thumb.empty { display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:10px; }
    .title-cell { max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .price { font-weight:600; color:var(--yellow); }
    .id-cell { color:var(--muted); font-size:12px; font-family: ui-monospace, monospace; }
    .row-actions { display:flex; gap:4px; }
    .link-chips { display:flex; gap:4px; }
    .chip {
      display:inline-flex; align-items:center; justify-content:center;
      width:22px; height:22px; border-radius:5px; background:#0f0f16;
      color:var(--muted); font-size:10px; font-weight:700; text-decoration:none;
      border:1px solid var(--border);
    }
    .chip:hover { color:var(--accent); border-color:var(--accent); }
    .chip.dim { opacity:0.25; }

    /* FAB */
    #jumpForm {
      position: fixed; right:20px; bottom:20px; z-index:60;
      box-shadow:0 8px 24px rgba(0,0,0,0.5); border-radius:999px; padding:12px 18px;
      font-weight:600;
    }
    .empty-state { padding:40px; text-align:center; color:var(--muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>🛠 Jarvis Admin <span id="totalBadge" class="pill">0 products</span></h1>

    <div class="auth" id="authBar">
      <input type="password" id="adminPassword" placeholder="Admin password" autocomplete="current-password" style="min-width:170px;flex:1"/>
      <button type="button" id="loginBtn">Sign in</button>
      <input id="adminTokenInput" placeholder="Or paste API token" autocomplete="off" style="min-width:220px;flex:2"/>
      <button type="button" id="saveTokenBtn" class="secondary">Save token</button>
      <button type="button" id="clearTokenBtn" class="ghost">Clear</button>
      <span class="hint" id="authHint"></span>
    </div>

    <div class="editor" id="editorBar">
      <div class="editor-head">
        <div class="editor-title" id="editorTitle">Add new product</div>
        <div class="status" id="status">Connecting...</div>
      </div>
      <div class="grid">
        <div class="preview" id="preview"><span>No image</span></div>

        <div>
          <label>Title</label>
          <input id="title" placeholder="e.g. Balenciaga Track"/>
        </div>
        <div>
          <label>Price (CNY)</label>
          <input id="price" placeholder="350"/>
        </div>

        <div style="grid-column: 2 / span 2">
          <label>Image URL</label>
          <input id="img" placeholder="https://..."/>
        </div>

        <div class="fields full" style="grid-column: 1 / span 3">
          <div><label>Kakobuy</label><input id="kakobuy" placeholder="https://kakobuy.com/..."/></div>
          <div><label>Picksly</label><input id="picksly" placeholder="https://picks.ly/item/..."/></div>
          <div style="display:flex;align-items:end;gap:6px">
            <button type="button" class="secondary tiny" id="openPicksly" title="Open picks.ly link">↗ Picksly</button>
            <button type="button" class="secondary tiny" id="openKakobuy" title="Open kakobuy link">↗ Kako</button>
          </div>
          <div><label>Category</label><select id="category"></select></div>
          <div><label>Batch</label><select id="batch"></select></div>
        </div>
      </div>

      <div class="actions">
        <button id="addBtn">＋ Add product</button>
        <button id="updateBtn" class="secondary" disabled>💾 Update</button>
        <button id="cancelBtn" class="ghost" disabled>Cancel</button>
        <span style="flex:1"></span>
        <span class="pill" id="editIdPill" style="display:none"></span>
      </div>
    </div>

    <div class="filterbar">
      <input type="search" id="tableSearch" placeholder="🔍 Search title, price, category..." autocomplete="off"/>
      <select id="catFilter"><option value="">All categories</option></select>
      <select id="imgFilter">
        <option value="">All products</option>
        <option value="no">No image only</option>
        <option value="yes">With image only</option>
      </select>
      <span class="meta" id="tableSearchCount"></span>
    </div>

    <div class="tablewrap">
      <table id="tbl">
        <thead>
          <tr>
            <th style="width:60px">ID</th>
            <th style="width:64px">Img</th>
            <th>Title</th>
            <th style="width:80px">Price</th>
            <th style="width:110px">Category</th>
            <th style="width:110px">Batch</th>
            <th style="width:80px">Links</th>
            <th style="width:160px">Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="emptyMsg" class="empty-state" style="display:none">No products match your filters.</div>
    </div>
  </div>
  <button type="button" id="jumpForm" class="secondary" title="Back to editor">↑ Editor</button>
  <script>
    let products = [];
    let selectedIndex = -1;
    let tableSearchQuery = "";
    let catFilterValue = "";
    let imgFilterValue = "";
    let loadProductsDebounce = null;
    let wsPingInterval = null;
    let activeWs = null;
    const statusEl = document.getElementById("status");

    function escHtml(s) {
      return String(s || "").replace(/[&<>"']/g, c =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function escAttr(s) { return escHtml(s); }

    function getStoredToken() {
      try { return localStorage.getItem("adminApiToken") || ""; } catch (_) { return ""; }
    }
    function setStoredToken(t) {
      try { localStorage.setItem("adminApiToken", (t || "").trim()); } catch (_) {}
    }
    function authHeaders(extra) {
      const h = Object.assign({}, extra || {});
      const t = getStoredToken();
      if (t) h["X-Admin-Token"] = t;
      return h;
    }

    const fields = {
      title: document.getElementById("title"),
      price: document.getElementById("price"),
      img: document.getElementById("img"),
      kakobuy: document.getElementById("kakobuy"),
      picksly: document.getElementById("picksly"),
      category: document.getElementById("category"),
      batch: document.getElementById("batch"),
    };
    const previewEl = document.getElementById("preview");

    function updatePreview() {
      const u = (fields.img.value || "").trim();
      if (!u) { previewEl.innerHTML = '<span>No image</span>'; return; }
      previewEl.innerHTML = `<img src="${escAttr(u)}" onerror="this.parentElement.innerHTML='<span>Invalid<br>image</span>'"/>`;
    }
    fields.img.addEventListener("input", updatePreview);

    function setStatus(text, ok=true) {
      statusEl.textContent = text;
      statusEl.className = "status" + (ok ? "" : " err");
    }

    function clearForm() {
      Object.values(fields).forEach(el => el.value = "");
      selectedIndex = -1;
      document.getElementById("updateBtn").disabled = true;
      document.getElementById("cancelBtn").disabled = true;
      document.getElementById("editorTitle").textContent = "Add new product";
      document.getElementById("editIdPill").style.display = "none";
      updatePreview();
      const sel = document.querySelector("#tbl tbody tr.selected");
      if (sel) sel.classList.remove("selected");
    }

    function formPayload() {
      return {
        title: fields.title.value,
        price: fields.price.value,
        img: fields.img.value,
        kakobuy: fields.kakobuy.value,
        picksly: fields.picksly.value,
        category: fields.category.value,
        batch: fields.batch.value
      };
    }

    async function loadMeta() {
      const r = await fetch("/api/meta", { headers: authHeaders() });
      if (r.status === 403) {
        setStatus("API refused: set token or sign in (see bar above)", false);
        throw new Error("auth");
      }
      if (!r.ok) throw new Error("meta");
      const m = await r.json();
      fields.category.innerHTML = m.categories.map(v => `<option value="${escAttr(v)}">${escHtml(v || "(empty)")}</option>`).join("");
      fields.batch.innerHTML = m.batches.map(v => `<option value="${escAttr(v)}">${escHtml(v || "(empty)")}</option>`).join("");
      const cf = document.getElementById("catFilter");
      cf.innerHTML = '<option value="">All categories</option>' +
        m.categories.filter(v => v).map(v => `<option value="${escAttr(v)}">${escHtml(v)}</option>`).join("");
    }

    function getFilteredTableRows() {
      const q = tableSearchQuery.trim().toLowerCase();
      const out = [];
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (catFilterValue && (p.category || "") !== catFilterValue) continue;
        if (imgFilterValue === "no" && (p.img || "").trim()) continue;
        if (imgFilterValue === "yes" && !(p.img || "").trim()) continue;
        if (q) {
          const hay = [p.title || "", p.category || "", p.batch || "", String(p.price || "")]
            .join(" ").toLowerCase();
          if (!hay.includes(q)) continue;
        }
        out.push({ p, i });
      }
      return out;
    }

    function render() {
      const tbody = document.querySelector("#tbl tbody");
      const rows = getFilteredTableRows();
      const emptyMsg = document.getElementById("emptyMsg");

      if (rows.length === 0) {
        tbody.innerHTML = "";
        emptyMsg.style.display = "block";
      } else {
        emptyMsg.style.display = "none";
        tbody.innerHTML = rows.map(({ p, i }) => {
          const img = (p.img || "").trim();
          const thumb = img
            ? `<img class="thumb" src="${escAttr(img)}" loading="lazy" onerror="this.className='thumb empty';this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb empty',textContent:'✗'}))"/>`
            : `<div class="thumb empty">—</div>`;
          const pk = p.picksly ? `<a class="chip" href="${escAttr(p.picksly)}" target="_blank" rel="noopener" title="Picksly">P</a>` : `<span class="chip dim">P</span>`;
          const kb = p.kakobuy ? `<a class="chip" href="${escAttr(p.kakobuy)}" target="_blank" rel="noopener" title="Kakobuy">K</a>` : `<span class="chip dim">K</span>`;
          const batchCls = p.batch === "Best Batch" ? "ok" : (p.batch === "Budget Batch" ? "warn" : "");
          return `
            <tr data-index="${i}" ${i===selectedIndex?'class="selected"':''}>
              <td class="id-cell">#${p.id ?? i}</td>
              <td>${thumb}</td>
              <td class="title-cell" title="${escAttr(p.title || "")}">${escHtml(p.title || "")}</td>
              <td class="price">${escHtml(p.price || "")}</td>
              <td>${p.category ? `<span class="pill">${escHtml(p.category)}</span>` : ''}</td>
              <td>${p.batch ? `<span class="pill ${batchCls}">${escHtml(p.batch)}</span>` : ''}</td>
              <td><div class="link-chips">${pk}${kb}</div></td>
              <td><div class="row-actions">
                <button class="secondary tiny" onclick="selectRow(${i})">Edit</button>
                <button class="danger tiny" onclick="deleteRow(${i})">Del</button>
              </div></td>
            </tr>
          `;
        }).join("");
      }
      const cm = document.getElementById("tableSearchCount");
      if (cm) {
        cm.textContent = (q => {
          const hasFilter = tableSearchQuery.trim() || catFilterValue || imgFilterValue;
          return hasFilter
            ? `${rows.length} of ${products.length}`
            : `${products.length} products`;
        })();
      }
      document.getElementById("totalBadge").textContent = `${products.length} products`;
    }

    async function loadProducts(silent) {
      const r = await fetch("/api/products", { headers: authHeaders() });
      if (r.status === 403) {
        if (!silent) setStatus("API refused: set token or sign in", false);
        throw new Error("auth");
      }
      products = await r.json();
      render();
      if (!silent) setStatus(`Loaded ${products.length} products`);
    }

    /** Merges burst events (HTTP + WebSocket) into one fetch. */
    function scheduleLoadProducts(silent) {
      clearTimeout(loadProductsDebounce);
      loadProductsDebounce = setTimeout(() => {
        loadProductsDebounce = null;
        loadProducts(silent);
      }, 250);
    }

    function focusEditorBar() {
      const bar = document.getElementById("editorBar");
      bar.scrollIntoView({ behavior: "smooth", block: "start" });
      try { fields.title.focus({ preventScroll: true }); } catch (_) { fields.title.focus(); }
    }

    window.selectRow = function (i) {
      selectedIndex = i;
      const p = products[i];
      Object.keys(fields).forEach(k => fields[k].value = p[k] || "");
      document.getElementById("updateBtn").disabled = false;
      document.getElementById("cancelBtn").disabled = false;
      document.getElementById("editorTitle").textContent = "Edit product";
      const pill = document.getElementById("editIdPill");
      pill.textContent = `editing #${p.id ?? i}`;
      pill.style.display = "inline-block";
      updatePreview();
      render();
      focusEditorBar();
    }

    window.deleteRow = async function (i) {
      if (!confirm("Delete selected product?")) return;
      const r = await fetch(`/api/products/${i}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) return setStatus("Delete failed", false);
      scheduleLoadProducts(false);
      clearForm();
    }

    window.moveRow = async function (i, delta) {
      const toIndex = i + delta;
      if (toIndex < 0 || toIndex >= products.length) return;
      const r = await fetch("/api/products/reorder", {
        method: "POST",
        headers: authHeaders({"Content-Type": "application/json"}),
        body: JSON.stringify({ from_index: i, to_index: toIndex })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return setStatus(`Reorder failed: ${JSON.stringify(e.detail || e)}`, false);
      }
      selectedIndex = -1;
      document.getElementById("updateBtn").disabled = true;
      document.getElementById("cancelBtn").disabled = true;
      scheduleLoadProducts(false);
    }

    document.getElementById("addBtn").onclick = async () => {
      const r = await fetch("/api/products", {
        method: "POST",
        headers: authHeaders({"Content-Type": "application/json"}),
        body: JSON.stringify(formPayload())
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return setStatus(`Add failed: ${JSON.stringify(e.detail || e)}`, false);
      }
      scheduleLoadProducts(false);
      clearForm();
    };

    document.getElementById("updateBtn").onclick = async () => {
      if (selectedIndex < 0) return;
      const r = await fetch(`/api/products/${selectedIndex}`, {
        method: "PUT",
        headers: authHeaders({"Content-Type": "application/json"}),
        body: JSON.stringify(formPayload())
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return setStatus(`Update failed: ${JSON.stringify(e.detail || e)}`, false);
      }
      scheduleLoadProducts(false);
      clearForm();
    };

    document.getElementById("cancelBtn").onclick = clearForm;

    document.getElementById("jumpForm").onclick = () => focusEditorBar();

    document.getElementById("tableSearch").addEventListener("input", (e) => {
      tableSearchQuery = e.target.value || ""; render();
    });
    document.getElementById("catFilter").addEventListener("change", (e) => {
      catFilterValue = e.target.value || ""; render();
    });
    document.getElementById("imgFilter").addEventListener("change", (e) => {
      imgFilterValue = e.target.value || ""; render();
    });
    document.getElementById("openPicksly").addEventListener("click", () => {
      const u = (fields.picksly.value || "").trim(); if (u) window.open(u, "_blank");
    });
    document.getElementById("openKakobuy").addEventListener("click", () => {
      const u = (fields.kakobuy.value || "").trim(); if (u) window.open(u, "_blank");
    });

    function connectWs() {
      if (activeWs) {
        activeWs.onclose = null;
        try { activeWs.close(); } catch (_) {}
        activeWs = null;
      }
      if (wsPingInterval) {
        clearInterval(wsPingInterval);
        wsPingInterval = null;
      }
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const t = getStoredToken();
      const qs = t ? ("?token=" + encodeURIComponent(t)) : "";
      const ws = new WebSocket(`${proto}://${location.host}/ws${qs}`);
      activeWs = ws;
      ws.onopen = () => {
        setStatus("Realtime connected");
        wsPingInterval = setInterval(() => {
          try { ws.send("ping"); } catch (_) {}
        }, 60000);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type !== "products_updated") return;
        } catch (_) {
          return;
        }
        scheduleLoadProducts(true);
      };
      ws.onclose = () => {
        activeWs = null;
        if (wsPingInterval) {
          clearInterval(wsPingInterval);
          wsPingInterval = null;
        }
        setStatus("Realtime disconnected, retrying...", false);
        setTimeout(connectWs, 1500);
      };
    }

    document.getElementById("saveTokenBtn").onclick = () => {
      setStoredToken(document.getElementById("adminTokenInput").value || "");
      document.getElementById("authHint").textContent = "Token saved in this browser.";
      connectWs();
      loadMeta().then(() => loadProducts(false)).catch(() => {});
    };
    document.getElementById("clearTokenBtn").onclick = () => {
      setStoredToken("");
      document.getElementById("adminTokenInput").value = "";
      document.getElementById("authHint").textContent = "Token cleared.";
      connectWs();
    };
    document.getElementById("loginBtn").onclick = async () => {
      const pw = document.getElementById("adminPassword").value || "";
      const r = await fetch("/api/admin/authenticate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ password: pw })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        document.getElementById("authHint").textContent = data.detail || "Sign in failed";
        return setStatus("Sign in failed", false);
      }
      if (data.token) setStoredToken(data.token);
      document.getElementById("adminPassword").value = "";
      document.getElementById("adminTokenInput").value = getStoredToken();
      document.getElementById("authHint").textContent = "Signed in; token stored locally.";
      connectWs();
      try {
        await loadMeta();
        await loadProducts(false);
        setStatus("Signed in");
      } catch (_) {}
    };

    (async () => {
      document.getElementById("adminTokenInput").value = getStoredToken();
      try {
        await loadMeta();
        await loadProducts(false);
      } catch (_) {}
      connectWs();
    })();
  </script>
</body>
</html>
"""
