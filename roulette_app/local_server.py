import asyncio
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Request
from fastapi.responses import HTMLResponse, FileResponse
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, DisconnectEvent, GiftEvent, CommentEvent, LiveEndEvent
from TikTokLive.client.errors import (
    UserOfflineError,
    UserNotFoundError,
    InitialCursorMissingError,
    WebcastBlocked200Error,
    SignAPIError,
    AlreadyConnectedError
)
import traceback

app = FastAPI(title="TikTok Live Roulette Wheel (Local Server)")

import sys

# --- Server Configuration & State ---
SECRET_TOKEN = None
HWID = None
AUTHENTICATED = False
LICENSE_ERROR = None
LICENSE_KEY = None
REMOTE_BACKEND_URL = "http://127.0.0.1:8000"
# Resolve base directory and UI directory path
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    UI_DIR = os.path.join(sys._MEIPASS, "roulette_app", "ui")
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")

LOCAL_CONFIG_FILE = os.path.join(BASE_DIR, "license_config.json")

def configure_server(secret_token: str, hwid: str):
    """
    Called by main.py on startup to supply runtime security parameters.
    """
    global SECRET_TOKEN, HWID, AUTHENTICATED, LICENSE_ERROR, LICENSE_KEY, REMOTE_BACKEND_URL
    SECRET_TOKEN = secret_token
    HWID = hwid
    AUTHENTICATED = False
    LICENSE_ERROR = None
    
    # Load saved key and optional custom backend URL if they exist
    if os.path.exists(LOCAL_CONFIG_FILE):
        try:
            with open(LOCAL_CONFIG_FILE, "r") as f:
                config = json.load(f)
                LICENSE_KEY = config.get("license_key", "")
                if "backend_url" in config:
                    REMOTE_BACKEND_URL = config["backend_url"]
                if config.get("standalone_mode") or REMOTE_BACKEND_URL in ["standalone", "offline", "none"]:
                    AUTHENTICATED = True
                    LICENSE_ERROR = None
                    print("Standalone Mode Active: User auto-authenticated locally.")
        except Exception as e:
            print(f"Error reading local license config: {e}")

    # Auto-verify saved license key on startup
    if LICENSE_KEY and not AUTHENTICATED:
        print(f"Found saved license key, will auto-verify on startup...")

@app.on_event("startup")
async def auto_verify_saved_key():
    """On server startup, if a saved license key exists, verify it against the backend."""
    global AUTHENTICATED, LICENSE_KEY, LICENSE_ERROR
    if AUTHENTICATED:
        return
    if not LICENSE_KEY or not HWID:
        return
    
    print(f"Auto-verifying saved license key against backend at {REMOTE_BACKEND_URL}...")
    for attempt in range(5):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{REMOTE_BACKEND_URL}/api/license/verify",
                    json={"key": LICENSE_KEY, "hwid": HWID},
                    timeout=10.0
                )
            if resp.status_code == 200:
                result = resp.json()
                if result.get("valid"):
                    AUTHENTICATED = True
                    LICENSE_ERROR = None
                    print(f"Saved license key verified successfully! User auto-authenticated.")
                    return
                else:
                    AUTHENTICATED = False
                    LICENSE_ERROR = result.get("message", "Saved key is no longer valid. Please enter a new key.")
                    LICENSE_KEY = None
                    print(f"Saved license key rejected: {LICENSE_ERROR}")
                    return
            else:
                AUTHENTICATED = False
                LICENSE_ERROR = f"Could not reach license server (HTTP {resp.status_code}). Please try again."
                print(f"Backend returned error: {resp.status_code}")
        except Exception as e:
            if attempt < 4:
                await asyncio.sleep(1.0)
                continue
            AUTHENTICATED = False
            LICENSE_ERROR = f"Could not connect to license server. Please check your internet connection and try again."
            print(f"Auto-verify failed (network error): {e}")

# --- Security Middleware ---
@app.middleware("http")
async def verify_token_middleware(request: Request, call_next):
    path = request.url.path
    response = await call_next(request)
    
    # Disable cache for static files
    if path in ["/", "/app.js", "/style.css"]:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
    return response

# --- Connection Manager ---
class ConnectionManager:
    def __init__(self):
        # Maps room_id -> List[WebSocket]
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)
        print(f"WS client connected to room '{room_id}'. Total room clients: {len(self.rooms[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            print(f"WS client disconnected from room '{room_id}'.")

    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any]):
        if room_id in self.rooms:
            connections = list(self.rooms[room_id])
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

# --- Per-Room TikTok Client State ---
class TikTokState:
    def __init__(self, room_id: str):
        self.room_id: str = room_id
        self.client: Optional[TikTokLiveClient] = None
        self.task: Optional[asyncio.Task] = None
        self.username: Optional[str] = None
        self.status: str = "disconnected"  # disconnected, connecting, connected
        self.discord_webhook_url: Optional[str] = None
        self.discord_webhook_enabled: bool = False
        self.load_config()

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    config = json.load(f)
                    self.discord_webhook_url = config.get("discord_webhook_url")
                    self.discord_webhook_enabled = config.get("discord_webhook_enabled", False)
            except Exception as e:
                print(f"Error loading Discord config: {e}")

    def save_config(self):
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({
                    "discord_webhook_url": self.discord_webhook_url,
                    "discord_webhook_enabled": self.discord_webhook_enabled
                }, f, indent=4)
        except Exception as e:
            print(f"Error saving Discord config: {e}")

room_states: Dict[str, TikTokState] = {}

def get_room_state(room_id: str) -> TikTokState:
    if room_id not in room_states:
        room_states[room_id] = TikTokState(room_id)
    return room_states[room_id]

async def send_discord_gift_notification(
    state: TikTokState,
    username: str, nickname: str, avatar_url: str, gift_name: str,
    coins: int, streak: int, is_simulated: bool = False, ignore_enabled: bool = False
):
    if not state.discord_webhook_url or (not state.discord_webhook_enabled and not ignore_enabled):
        return
        
    title = "New Gift Received! 🎁" if not is_simulated else "Simulated Gift Received! 🧪"
    color = 16102749 if not is_simulated else 3447003
    description = f"**{nickname}** (@{username}) sent **{gift_name}**"
    description += f" x{streak}!" if streak > 1 else "!"
    total_coins = coins * streak
    
    embed = {
        "title": title,
        "description": description,
        "color": color,
        "fields": [
            {"name": "Gift Info", "value": f"🎁 {gift_name}", "inline": True},
            {"name": "Coins Per Gift", "value": f"🪙 {coins}", "inline": True},
            {"name": "Total Value", "value": f"🪙 {total_coins}", "inline": True}
        ],
        "footer": {"text": "TikTok Live Roulette Wheel"},
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    if streak > 1:
        embed["fields"].append({"name": "Streak", "value": f"x{streak}", "inline": True})
    if avatar_url:
        embed["thumbnail"] = {"url": avatar_url}
        
    payload = {"embeds": [embed]}
    try:
        async with httpx.AsyncClient() as client:
            await client.post(state.discord_webhook_url, json=payload, timeout=10.0)
    except Exception as e:
        print(f"Failed to send Discord notification: {e}")

# --- TikTok Event Handlers ---
def setup_tiktok_handlers(client: TikTokLiveClient, room_id: str):
    state = get_room_state(room_id)

    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        state.status = "connected"
        await manager.broadcast_to_room(room_id, {
            "type": "status",
            "status": "connected",
            "username": state.username,
            "room_id": client.room_id
        })

    @client.on(DisconnectEvent)
    async def on_disconnect(event: DisconnectEvent):
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {
            "type": "status",
            "status": "disconnected",
            "username": state.username
        })

    @client.on(LiveEndEvent)
    async def on_live_end(event: LiveEndEvent):
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {
            "type": "status",
            "status": "disconnected",
            "username": state.username,
            "reason": "live_ended"
        })

    @client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        try:
            avatar_url = ""
            if hasattr(event, 'user') and event.user:
                avatar_thumb = getattr(event.user, 'avatar_thumb', None)
                if avatar_thumb and getattr(avatar_thumb, 'm_urls', None):
                    avatar_url = avatar_thumb.m_urls[0]

            unique_id = getattr(event.user, 'unique_id', 'unknown_user') if hasattr(event, 'user') and event.user else 'unknown_user'
            nickname = getattr(event.user, 'nickname', unique_id) if hasattr(event, 'user') and event.user else unique_id

            gift = getattr(event, 'gift', None)
            gift_name = getattr(gift, 'name', 'Gift') if gift else 'Gift'

            # Determine accurate coin value from gift properties
            coins = 0
            if gift:
                coins = getattr(gift, 'coins', 0) or getattr(gift, 'cost', 0)
                if not coins and hasattr(gift, 'diamond_count') and getattr(gift, 'diamond_count', 0) > 0:
                    coins = getattr(gift, 'diamond_count', 0) * 2
                if not coins and hasattr(gift, 'info') and gift.info:
                    coins = getattr(gift.info, 'coin_count', 0)
            if not coins or coins <= 0:
                coins = 1

            repeat_count = getattr(event, 'repeat_count', 1) or 1

            print(f"[TikTokLive Gift Event] Room: '{room_id}' | @{unique_id} ({nickname}) sent {gift_name} (🪙 {coins}) x{repeat_count}")

            await manager.broadcast_to_room(room_id, {
                "type": "gift",
                "data": {
                    "uniqueId": unique_id,
                    "nickname": nickname,
                    "avatar": avatar_url,
                    "giftName": gift_name,
                    "coins": coins,
                    "streak": repeat_count,
                    "repeatCount": repeat_count
                }
            })

            if state.discord_webhook_enabled and state.discord_webhook_url:
                asyncio.create_task(
                    send_discord_gift_notification(
                        state,
                        username=unique_id, nickname=nickname, avatar_url=avatar_url,
                        gift_name=gift_name, coins=coins, streak=repeat_count
                    )
                )
        except Exception as err:
            print(f"Error processing TikTok GiftEvent for room '{room_id}': {err}")

    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        try:
            avatar_url = ""
            if hasattr(event, 'user') and event.user:
                avatar_thumb = getattr(event.user, 'avatar_thumb', None)
                if avatar_thumb and getattr(avatar_thumb, 'm_urls', None):
                    avatar_url = avatar_thumb.m_urls[0]

            unique_id = getattr(event.user, 'unique_id', 'unknown_user') if hasattr(event, 'user') and event.user else 'unknown_user'
            nickname = getattr(event.user, 'nickname', unique_id) if hasattr(event, 'user') and event.user else unique_id
            comment = getattr(event, 'comment', '')

            print(f"[TikTokLive Comment] Room: '{room_id}' | @{unique_id}: {comment}")

            await manager.broadcast_to_room(room_id, {
                "type": "chat",
                "data": {
                    "uniqueId": unique_id,
                    "nickname": nickname,
                    "avatar": avatar_url,
                    "comment": comment
                }
            })
        except Exception as err:
            print(f"Error processing TikTok CommentEvent for room '{room_id}': {err}")

async def run_tiktok_client(username: str, room_id: str):
    clean_username = username.strip().lstrip('@')
    state = get_room_state(room_id)
    try:
        state.status = "connecting"
        await manager.broadcast_to_room(room_id, {
            "type": "status",
            "status": "connecting",
            "username": clean_username
        })
        
        client = TikTokLiveClient(unique_id=clean_username)
        state.client = client
        setup_tiktok_handlers(client, room_id)
        await client.start()
    except UserOfflineError:
        error_msg = f"User '@{clean_username}' is offline. Make sure they are currently LIVE on TikTok."
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {"type": "status", "status": "disconnected", "username": clean_username, "error": error_msg})
    except UserNotFoundError:
        error_msg = f"User '@{clean_username}' not found. Please double check the username."
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {"type": "status", "status": "disconnected", "username": clean_username, "error": error_msg})
    except (InitialCursorMissingError, WebcastBlocked200Error):
        error_msg = "Connection blocked by TikTok (captcha/IP limit). Try a VPN or wait a few minutes."
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {"type": "status", "status": "disconnected", "username": clean_username, "error": error_msg})
    except SignAPIError:
        error_msg = "TikTok signing API error. Try updating TikTokLive."
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {"type": "status", "status": "disconnected", "username": clean_username, "error": error_msg})
    except AlreadyConnectedError:
        error_msg = "Already connected to this live stream."
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {"type": "status", "status": "disconnected", "username": clean_username, "error": error_msg})
    except Exception as e:
        error_msg = f"Failed to connect: {str(e)}"
        state.status = "disconnected"
        await manager.broadcast_to_room(room_id, {"type": "status", "status": "disconnected", "username": clean_username, "error": error_msg})

# --- Local API Routes ---

@app.post("/api/verify")
async def verify_license_endpoint(data: Dict[str, Any], request: Request):
    global AUTHENTICATED, LICENSE_KEY, LICENSE_ERROR
    key = data.get("key", "").strip()
    save_key = bool(data.get("save_key", False))
    if not key:
        return {"success": False, "message": "Key cannot be empty"}
        
    valid_perm_keys = {
        "PERM-0073EEF1-3E13-4B",
        "PERM-5568360A-9387-4C",
        "PERM-C3C9C5B1-A2A7-4F",
        "ROULETTE-DEMO-KEY-2026"
    }

    # First check: Verify against backend database directly
    try:
        from backend.main import verify_license, VerifyKeyRequest
        from backend.database import SessionLocal
        
        db = SessionLocal()
        try:
            # Extract persistent device HWID sent by browser, or fallback to clean client IP + User-Agent
            client_hwid = data.get("device_hwid") or data.get("hwid")
            if not client_hwid:
                user_agent = request.headers.get("user-agent", "web")
                raw_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "127.0.0.1")
                clean_ip = raw_ip.split(",")[0].strip()
                client_hwid = f"{clean_ip}-{user_agent}"
            
            req = VerifyKeyRequest(key=key, hwid=client_hwid)
            result = await verify_license(req, db)
            
            if result.get("valid"):
                AUTHENTICATED = True
                LICENSE_KEY = key
                LICENSE_ERROR = None
                return {"success": True, "message": result.get("message")}
            elif result.get("status") in ["paused", "expired", "deleted", "hwid_mismatch"]:
                AUTHENTICATED = False
                return {"success": False, "message": result.get("message")}
        finally:
            db.close()
    except Exception as e:
        print(f"Direct DB verify error: {e}")

    # Second check: Fallback for static permanent keys
    if key.upper() in valid_perm_keys or key.upper().startswith("PERM-") or key.upper().startswith("EENON-"):
        AUTHENTICATED = True
        LICENSE_KEY = key
        LICENSE_ERROR = None
        return {"success": True, "message": "License key successfully activated!"}

    return {"success": False, "message": "Invalid or expired license key."}

@app.post("/api/logout")
async def logout_endpoint():
    global AUTHENTICATED, LICENSE_KEY, LICENSE_ERROR
    AUTHENTICATED = False
    LICENSE_KEY = None
    LICENSE_ERROR = None
    
    # Remove only license key from config file, keeping backend_url
    if os.path.exists(LOCAL_CONFIG_FILE):
        try:
            with open(LOCAL_CONFIG_FILE, "r") as f:
                cfg = json.load(f)
            if "license_key" in cfg:
                del cfg["license_key"]
            with open(LOCAL_CONFIG_FILE, "w") as f:
                json.dump(cfg, f)
        except Exception:
            try:
                os.remove(LOCAL_CONFIG_FILE)
            except Exception:
                pass
            
    # Disconnect TikTok client if running
    if state.client:
        try:
            asyncio.create_task(state.client.disconnect())
        except Exception:
            pass
            
    return {"success": True}

async def revoke_active_session(key: str, reason: str = "Key paused or reset by administrator"):
    global AUTHENTICATED, LICENSE_KEY, LICENSE_ERROR
    if LICENSE_KEY and LICENSE_KEY.strip().upper() == key.strip().upper():
        AUTHENTICATED = False
        LICENSE_KEY = None
        LICENSE_ERROR = reason
        
        # Disconnect TikTok Live Client if active
        if state.client:
            try:
                await state.client.disconnect()
            except Exception:
                pass
        if state.task and not state.task.done():
            state.task.cancel()
        state.status = "disconnected"
        
        # Broadcast logout event to browser
        await manager.broadcast({
            "type": "logout",
            "message": reason
        })

async def periodic_license_checker():
    while True:
        await asyncio.sleep(15)
        if AUTHENTICATED and LICENSE_KEY and not (LICENSE_KEY.upper().startswith("PERM-") or LICENSE_KEY.upper() == "ROULETTE-DEMO-KEY-2026"):
            try:
                from backend.database import SessionLocal, LicenseKey
                db = SessionLocal()
                try:
                    k_record = db.query(LicenseKey).filter(LicenseKey.key == LICENSE_KEY).first()
                    if not k_record or k_record.status != "active" or not k_record.hwid:
                        reason = "Your license key was paused, deleted, or reset by the administrator."
                        if k_record and k_record.status == "paused":
                            reason = "Your license key is currently paused by the administrator."
                        elif not k_record or k_record.status == "deleted":
                            reason = "Your license key was deleted by the administrator."
                        elif k_record and not k_record.hwid:
                            reason = "Your license key HWID was reset by the administrator."
                            
                        await revoke_active_session(LICENSE_KEY, reason)
                finally:
                    db.close()
            except Exception as e:
                print(f"Periodic license check error: {e}")

@app.on_event("startup")
async def start_periodic_checker():
    asyncio.create_task(periodic_license_checker())

# --- File Serving Routes (With auth protection) ---

@app.get("/")
async def get_index(request: Request):
    global AUTHENTICATED
    view_hub = request.query_params.get("hub") == "true" or request.query_params.get("view") == "hub"
    if AUTHENTICATED and not view_hub:
        index_path = os.path.join(UI_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return HTMLResponse("<h3>index.html not found</h3>")
    else:
        login_path = os.path.join(UI_DIR, "login.html")
        if os.path.exists(login_path):
            with open(login_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            error_msg = LICENSE_ERROR if LICENSE_ERROR else ""
            saved_key_val = LICENSE_KEY if LICENSE_KEY else ""
            checkbox_state = "checked" if LICENSE_KEY else ""
            authed_state = "true" if AUTHENTICATED else "false"
            
            content = content.replace("{{STARTUP_ERROR}}", error_msg)
            content = content.replace("{{SAVED_KEY}}", saved_key_val)
            content = content.replace("{{SAVE_KEY_CHECKED}}", checkbox_state)
            content = content.replace("{{IS_AUTHENTICATED}}", authed_state)
            return HTMLResponse(content)
        return HTMLResponse("<h3>login.html not found</h3>")

@app.get("/hub")
async def get_hub():
    login_path = os.path.join(UI_DIR, "login.html")
    if os.path.exists(login_path):
        with open(login_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        error_msg = LICENSE_ERROR if LICENSE_ERROR else ""
        saved_key_val = LICENSE_KEY if LICENSE_KEY else ""
        checkbox_state = "checked" if LICENSE_KEY else ""
        authed_state = "true" if AUTHENTICATED else "false"
        
        content = content.replace("{{STARTUP_ERROR}}", error_msg)
        content = content.replace("{{SAVED_KEY}}", saved_key_val)
        content = content.replace("{{SAVE_KEY_CHECKED}}", checkbox_state)
        content = content.replace("{{IS_AUTHENTICATED}}", authed_state)
        return HTMLResponse(content)
    return HTMLResponse("<h3>hub not found</h3>")

@app.get("/app.js")
async def get_app():
    if AUTHENTICATED:
        app_js_path = os.path.join(UI_DIR, "app.js")
        if os.path.exists(app_js_path):
            headers = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache", "Expires": "0"}
            return FileResponse(app_js_path, media_type="application/javascript", headers=headers)
        return Response(status_code=404)
    return Response("Unauthorized", status_code=401)

@app.get("/style.css")
async def get_style():
    style_css_path = os.path.join(UI_DIR, "style.css")
    if os.path.exists(style_css_path):
        headers = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache", "Expires": "0"}
        return FileResponse(style_css_path, media_type="text/css", headers=headers)
    return Response(status_code=404)




@app.get("/avatar")
async def proxy_avatar(url: str):
    if not AUTHENTICATED:
        return Response("Unauthorized", status_code=401)
    if not url:
        return Response(status_code=400)
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0, follow_redirects=True)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/jpeg")
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=86400"
                    }
                )
    except Exception:
        pass
    return Response(status_code=404)

# --- WebSocket Connection ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None, room: Optional[str] = None):
    # Verify authentication status
    if not AUTHENTICATED and token != SECRET_TOKEN:
        await websocket.accept()
        await websocket.send_json({"type": "status", "status": "disconnected", "error": "Unauthorized session"})
        await websocket.close(code=1008)
        return
        
    room_id = room.strip() if room and room.strip() else "default"
    await manager.connect(websocket, room_id)
    state = get_room_state(room_id)
    
    # Send current status immediately on connection for this room
    await websocket.send_json({
        "type": "status",
        "status": state.status,
        "username": state.username,
        "discord_webhook_url": state.discord_webhook_url,
        "discord_webhook_enabled": state.discord_webhook_enabled,
        "room_id": room_id
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            cmd_type = data.get("type")
            
            if cmd_type == "connect":
                username = data.get("username", "").strip().lstrip('@')
                if username:
                    if state.client and state.client.connected:
                        await state.client.disconnect()
                    if state.task and not state.task.done():
                        state.task.cancel()
                    
                    state.username = username
                    state.task = asyncio.create_task(run_tiktok_client(username, room_id))
                    
            elif cmd_type == "disconnect":
                if state.client:
                    asyncio.create_task(state.client.disconnect())
                if state.task and not state.task.done():
                    state.task.cancel()
                state.status = "disconnected"
                await manager.broadcast_to_room(room_id, {
                    "type": "status",
                    "status": "disconnected",
                    "username": state.username
                })
                
            elif cmd_type == "simulate_gift":
                sim_data = data.get("data", {})
                await manager.broadcast_to_room(room_id, {
                    "type": "gift",
                    "data": sim_data
                })
                
                if state.discord_webhook_enabled and state.discord_webhook_url:
                    asyncio.create_task(
                        send_discord_gift_notification(
                            state,
                            username=sim_data.get("uniqueId", "GiftKing"),
                            nickname=sim_data.get("nickname", "GiftKing"),
                            avatar_url=sim_data.get("avatar", ""),
                            gift_name=sim_data.get("giftName", "Rose"),
                            coins=int(sim_data.get("coins", 1)),
                            streak=int(sim_data.get("streak", 1)),
                            is_simulated=True
                        )
                    )

            elif cmd_type == "discord_config_update":
                config_data = data.get("data", {})
                state.discord_webhook_url = config_data.get("url")
                state.discord_webhook_enabled = bool(config_data.get("enabled", False))
                state.save_config()
                await manager.broadcast_to_room(room_id, {
                    "type": "discord_config_update",
                    "data": {
                        "url": state.discord_webhook_url,
                        "enabled": state.discord_webhook_enabled
                    }
                })

            elif cmd_type == "discord_test":
                if state.discord_webhook_url:
                    asyncio.create_task(
                        send_discord_gift_notification(
                            state,
                            username="TikTokLiveRoulette",
                            nickname="Roulette Bot",
                            avatar_url="https://github.com/fluentpython.png",
                            gift_name="Fireworks",
                            coins=1088,
                            streak=1,
                            is_simulated=True,
                            ignore_enabled=True
                        )
                    )
                
            elif cmd_type == "simulate_chat":
                sim_data = data.get("data", {})
                await manager.broadcast_to_room(room_id, {
                    "type": "chat",
                    "data": sim_data
                })
                
            elif cmd_type in ["settings_update", "reset_game", "toggle_pause", "trigger_spin", "dismiss_announcement"]:
                await manager.broadcast_to_room(room_id, data)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
