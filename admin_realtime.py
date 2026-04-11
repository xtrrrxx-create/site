import asyncio
import hashlib
import json
import os
import re
import secrets
import subprocess
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Path, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

DB_PATH = Path(__file__).parent / "products.json"
REPO_ROOT = DB_PATH.parent

# After each save, run git add/commit/push on products.json (set ADMIN_AUTO_GIT_PUSH=0 to disable).
_GIT_PUSH_DEBOUNCE_S = 4.0
_git_push_task: asyncio.Task[None] | None = None
_git_push_lock = asyncio.Lock()

CATEGORIES = ["", "Shoes", "Slides", "Shorts", "Pants", "T-shirts", "Long-sleeve", "Hoodies", "Jackets", "Accessories"]
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


def load_products() -> list[dict[str, Any]]:
    if not DB_PATH.exists():
        return []
    with DB_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_products(products: list[dict[str, Any]]) -> None:
    with DB_PATH.open("w", encoding="utf-8") as f:
        json.dump(products, f, indent=4, ensure_ascii=False)


def _git_commit_push_sync() -> None:
    if os.environ.get("ADMIN_AUTO_GIT_PUSH", "1").strip().lower() in ("0", "false", "no", "off"):
        return
    repo = REPO_ROOT
    try:
        subprocess.run(
            ["git", "add", "--", "products.json"],
            cwd=repo,
            capture_output=True,
            timeout=30,
            check=False,
        )
        diff = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=repo,
            timeout=30,
        )
        if diff.returncode == 0:
            return
        commit = subprocess.run(
            [
                "git",
                "commit",
                "-m",
                "catalog: update products.json (admin auto)",
            ],
            cwd=repo,
            capture_output=True,
            timeout=60,
            text=True,
        )
        if commit.returncode != 0:
            return
        br = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=10,
        )
        branch = (br.stdout or "").strip() or "main"
        subprocess.run(
            ["git", "push", "origin", branch],
            cwd=repo,
            capture_output=True,
            timeout=120,
            text=True,
        )
    except (OSError, subprocess.TimeoutExpired):
        pass


async def schedule_git_push() -> None:
    global _git_push_task

    if os.environ.get("ADMIN_AUTO_GIT_PUSH", "1").strip().lower() in ("0", "false", "no", "off"):
        return

    async def _debounced() -> None:
        try:
            await asyncio.sleep(_GIT_PUSH_DEBOUNCE_S)
        except asyncio.CancelledError:
            return
        async with _git_push_lock:
            await asyncio.to_thread(_git_commit_push_sync)

    if _git_push_task is not None and not _git_push_task.done():
        _git_push_task.cancel()
    _git_push_task = asyncio.create_task(_debounced())


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
async def admin_page(request: Request) -> str:
    return HTML


@app.get("/api/meta")
@limiter.limit("120/minute")
async def meta(request: Request, _: None = Depends(require_read_token)) -> dict[str, Any]:
    return {"categories": CATEGORIES, "batches": BATCHES}


@app.get("/api/products")
@limiter.limit("120/minute")
async def get_products(request: Request, _: None = Depends(require_read_token)) -> list[dict[str, Any]]:
    async with db_lock:
        return load_products()


@app.post("/api/admin/authenticate")
@limiter.limit("5/15minutes")
async def admin_authenticate(request: Request, body: AdminPasswordIn) -> dict[str, Any]:
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
    payload: ProductIn,
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    async with db_lock:
        products = load_products()
        products.append(payload.model_dump())
        save_products(products)
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    await schedule_git_push()
    return {"ok": True, "count": len(products)}


@app.put("/api/products/{index}")
@limiter.limit("60/minute")
async def update_product(
    request: Request,
    index: Annotated[int, Path(ge=0, le=5_000_000)],
    payload: ProductIn,
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    async with db_lock:
        products = load_products()
        if index < 0 or index >= len(products):
            raise HTTPException(status_code=404, detail="Product index not found")
        products[index] = payload.model_dump()
        save_products(products)
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    await schedule_git_push()
    return {"ok": True, "count": len(products)}


@app.delete("/api/products/{index}")
@limiter.limit("60/minute")
async def delete_product(
    request: Request,
    index: Annotated[int, Path(ge=0, le=5_000_000)],
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    async with db_lock:
        products = load_products()
        if index < 0 or index >= len(products):
            raise HTTPException(status_code=404, detail="Product index not found")
        products.pop(index)
        save_products(products)
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    await schedule_git_push()
    return {"ok": True, "count": len(products)}


@app.post("/api/products/reorder")
@limiter.limit("60/minute")
async def reorder_product(
    request: Request,
    payload: ReorderIn,
    _: None = Depends(require_write_token),
) -> dict[str, Any]:
    async with db_lock:
        products = load_products()
        n = len(products)
        if payload.from_index < 0 or payload.from_index >= n:
            raise HTTPException(status_code=404, detail="Source index not found")
        if payload.to_index < 0 or payload.to_index >= n:
            raise HTTPException(status_code=404, detail="Target index not found")
        if payload.from_index == payload.to_index:
            return {"ok": True, "count": n}
        item = products.pop(payload.from_index)
        products.insert(payload.to_index, item)
        save_products(products)
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    await schedule_git_push()
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
  <title>Realtime Admin</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background:#101014; color:#f1f1f1; margin:0; }
    .wrap { max-width:1200px; margin:24px auto; padding:0 16px; padding-bottom:80px; }
    .editor-sticky {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #101014;
      padding: 12px 0 14px;
      margin: 0 -16px;
      padding-left: 16px;
      padding-right: 16px;
      border-bottom: 1px solid #2c2c35;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    }
    .row { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
    input, select { background:#19191f; border:1px solid #333; color:#fff; padding:8px; border-radius:8px; }
    button { background:#2d6cdf; color:#fff; border:none; border-radius:8px; padding:9px 12px; cursor:pointer; }
    button.secondary { background:#444; }
    button.danger { background:#d64747; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th, td { border-bottom:1px solid #2c2c35; padding:8px; text-align:left; }
    tr:hover { background:#171722; }
    .status { margin:0 0 10px; color:#96f7a5; }
    .small { font-size:12px; color:#aaa; margin:0; }
    #jumpForm {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 60;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      font-weight: 600;
    }
    .table-search-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin: 16px 0 10px;
    }
    .table-search-row input[type="search"] {
      flex: 1;
      min-width: 200px;
      padding: 10px 12px;
      font-size: 15px;
    }
    .table-search-row .search-meta {
      font-size: 13px;
      color: #9a9aaa;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>Jarvis Finder Realtime Admin</h2>
    <div class="row" id="authBar" style="align-items:center;margin-bottom:16px;padding:10px 12px;background:#19191f;border-radius:10px;border:1px solid #2c2c35">
      <input type="password" id="adminPassword" placeholder="Admin password" autocomplete="current-password" style="min-width:160px"/>
      <button type="button" id="loginBtn">Sign in</button>
      <input id="adminTokenInput" placeholder="Or paste API token" autocomplete="off" style="min-width:220px;flex:1"/>
      <button type="button" id="saveTokenBtn" class="secondary">Save token</button>
      <button type="button" id="clearTokenBtn" class="secondary">Clear</button>
      <span class="small" id="authHint" style="flex-basis:100%"></span>
    </div>
    <div class="editor-sticky" id="editorBar">
      <div class="status" id="status">Connecting...</div>
      <div class="row">
        <input id="title" placeholder="Title" style="min-width:220px;flex:2"/>
        <input id="price" placeholder="Price (CNY)" style="width:120px"/>
        <input id="img" placeholder="Image URL" style="min-width:220px;flex:2"/>
        <input id="kakobuy" placeholder="Kakobuy URL" style="min-width:220px;flex:2"/>
        <input id="picksly" placeholder="Picksly URL" style="min-width:220px;flex:2"/>
        <select id="category"></select>
        <select id="batch"></select>
        <button id="addBtn">Add</button>
        <button id="updateBtn" class="secondary" disabled>Update selected</button>
        <button id="cancelBtn" class="secondary" disabled>Cancel edit</button>
      </div>
      <p class="small">Tip: form stays at top while you scroll. Saves trigger git commit + push to origin (~4s after your last change) so Vercel can deploy. Set env ADMIN_AUTO_GIT_PUSH=0 to disable.</p>
    </div>
    <div class="table-search-row">
      <input type="search" id="tableSearch" placeholder="Search products (title, category, price…)" autocomplete="off"/>
      <span class="search-meta" id="tableSearchCount"></span>
    </div>
    <table id="tbl">
      <thead><tr><th>#</th><th>Title</th><th>Price</th><th>Category</th><th>Batch</th><th>Actions</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <button type="button" id="jumpForm" class="secondary" title="Jump to form at top">↑ Form</button>
  <script>
    let products = [];
    let selectedIndex = -1;
    let tableSearchQuery = "";
    let loadProductsDebounce = null;
    let wsPingInterval = null;
    let activeWs = null;
    const statusEl = document.getElementById("status");

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

    function setStatus(text, ok=true) {
      statusEl.textContent = text;
      statusEl.style.color = ok ? "#96f7a5" : "#ff7b7b";
    }

    function clearForm() {
      Object.values(fields).forEach(el => el.value = "");
      selectedIndex = -1;
      document.getElementById("updateBtn").disabled = true;
      document.getElementById("cancelBtn").disabled = true;
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
      fields.category.innerHTML = m.categories.map(v => `<option value="${v}">${v || "(empty)"}</option>`).join("");
      fields.batch.innerHTML = m.batches.map(v => `<option value="${v}">${v || "(empty)"}</option>`).join("");
    }

    function getFilteredTableRows() {
      const q = tableSearchQuery.trim().toLowerCase();
      const out = [];
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (!q) {
          out.push({ p, i });
          continue;
        }
        const hay = [
          p.title || "",
          p.category || "",
          p.batch || "",
          String(p.price || ""),
        ].join(" ").toLowerCase();
        if (hay.includes(q)) out.push({ p, i });
      }
      return out;
    }

    function render() {
      const tbody = document.querySelector("#tbl tbody");
      const rows = getFilteredTableRows();
      tbody.innerHTML = rows.map(({ p, i }) => `
        <tr>
          <td>${i}</td>
          <td>${(p.title || "").replace(/</g, "&lt;")}</td>
          <td>${p.price || ""}</td>
          <td>${p.category || ""}</td>
          <td>${p.batch || ""}</td>
          <td>
            <button class="secondary" onclick="moveRow(${i}, -1)">↑</button>
            <button class="secondary" onclick="moveRow(${i}, 1)">↓</button>
            <button class="secondary" onclick="selectRow(${i})">Edit</button>
            <button class="danger" onclick="deleteRow(${i})">Delete</button>
          </td>
        </tr>
      `).join("");
      const cm = document.getElementById("tableSearchCount");
      if (cm) {
        cm.textContent = tableSearchQuery.trim()
          ? `Showing ${rows.length} of ${products.length} (filtered)`
          : `Showing ${products.length} products`;
      }
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
      tableSearchQuery = e.target.value || "";
      render();
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
