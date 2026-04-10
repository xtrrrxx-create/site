import asyncio
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, field_validator

DB_PATH = Path(__file__).parent / "products.json"
REPO_ROOT = DB_PATH.parent

# After each save, run git add/commit/push on products.json (set ADMIN_AUTO_GIT_PUSH=0 to disable).
_GIT_PUSH_DEBOUNCE_S = 4.0
_git_push_task: asyncio.Task[None] | None = None
_git_push_lock = asyncio.Lock()

CATEGORIES = ["", "Shoes", "Slides", "Shorts", "Pants", "T-shirts", "Long-sleeve", "Hoodies", "Jackets", "Accessories"]
BATCHES = ["", "Best Batch", "Budget Batch", "Random Batch"]


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
        v = clean_text(str(value or ""))
        if not v:
            raise ValueError("Field is required")
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


class WSManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = WSManager()
db_lock = asyncio.Lock()


@app.get("/", response_class=HTMLResponse)
async def admin_page() -> str:
    return HTML


@app.get("/api/meta")
async def meta() -> dict[str, Any]:
    return {"categories": CATEGORIES, "batches": BATCHES}


@app.get("/api/products")
async def get_products() -> list[dict[str, Any]]:
    async with db_lock:
        return load_products()


@app.post("/api/products")
async def add_product(payload: ProductIn) -> dict[str, Any]:
    async with db_lock:
        products = load_products()
        products.append(payload.model_dump())
        save_products(products)
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    await schedule_git_push()
    return {"ok": True, "count": len(products)}


@app.put("/api/products/{index}")
async def update_product(index: int, payload: ProductIn) -> dict[str, Any]:
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
async def delete_product(index: int) -> dict[str, Any]:
    async with db_lock:
        products = load_products()
        if index < 0 or index >= len(products):
            raise HTTPException(status_code=404, detail="Product index not found")
        products.pop(index)
        save_products(products)
    await manager.broadcast({"type": "products_updated", "count": len(products)})
    await schedule_git_push()
    return {"ok": True, "count": len(products)}


@app.websocket("/ws")
async def websocket_updates(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; client may send pings.
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
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
    const statusEl = document.getElementById("status");

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
      const r = await fetch("/api/meta");
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

    async function loadProducts() {
      const r = await fetch("/api/products");
      products = await r.json();
      render();
      setStatus(`Loaded ${products.length} products`);
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
      const r = await fetch(`/api/products/${i}`, { method: "DELETE" });
      if (!r.ok) return setStatus("Delete failed", false);
      await loadProducts();
      clearForm();
    }

    document.getElementById("addBtn").onclick = async () => {
      const r = await fetch("/api/products", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formPayload())
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return setStatus(`Add failed: ${JSON.stringify(e.detail || e)}`, false);
      }
      await loadProducts();
      clearForm();
    };

    document.getElementById("updateBtn").onclick = async () => {
      if (selectedIndex < 0) return;
      const r = await fetch(`/api/products/${selectedIndex}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formPayload())
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return setStatus(`Update failed: ${JSON.stringify(e.detail || e)}`, false);
      }
      await loadProducts();
      clearForm();
    };

    document.getElementById("cancelBtn").onclick = clearForm;

    document.getElementById("jumpForm").onclick = () => focusEditorBar();

    document.getElementById("tableSearch").addEventListener("input", (e) => {
      tableSearchQuery = e.target.value || "";
      render();
    });

    function connectWs() {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => {
        setStatus("Realtime connected");
        setInterval(() => { try { ws.send("ping"); } catch {} }, 15000);
      };
      ws.onmessage = async () => {
        await loadProducts();
      };
      ws.onclose = () => {
        setStatus("Realtime disconnected, retrying...", false);
        setTimeout(connectWs, 1500);
      };
    }

    (async () => {
      await loadMeta();
      await loadProducts();
      connectWs();
    })();
  </script>
</body>
</html>
"""
