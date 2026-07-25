import asyncio
import os
import httpx
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.responses import HTMLResponse, FileResponse
import uvicorn
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

app = FastAPI(title="TikTok Live Roulette Wheel")

# Track active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WS client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WS client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                # Connection might be dead, it will be handled by WebSocketDisconnect
                pass

manager = ConnectionManager()

CONFIG_FILE = "config.json"

# Global state for TikTok client
class TikTokState:
    def __init__(self):
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
                    print(f"Loaded Discord config: Enabled={self.discord_webhook_enabled}, URL={self.discord_webhook_url}")
            except Exception as e:
                print(f"Error loading config: {e}")

    def save_config(self):
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({
                    "discord_webhook_url": self.discord_webhook_url,
                    "discord_webhook_enabled": self.discord_webhook_enabled
                }, f, indent=4)
        except Exception as e:
            print(f"Error saving config: {e}")

state = TikTokState()

async def send_discord_gift_notification(
    username: str,
    nickname: str,
    avatar_url: str,
    gift_name: str,
    coins: int,
    streak: int,
    is_simulated: bool = False,
    ignore_enabled: bool = False
):
    if not state.discord_webhook_url or (not state.discord_webhook_enabled and not ignore_enabled):
        return
        
    title = "New Gift Received! 🎁"
    if is_simulated:
        title = "Simulated Gift Received! 🧪"
        
    # Golden color matching roulette theme
    color = 16102749  # Hex: #f5c75d -> Dec: 16102749
    if is_simulated:
        color = 3447003  # Hex: #3498db -> Dec: 3447003
        
    description = f"**{nickname}** (@{username}) sent **{gift_name}**"
    if streak > 1:
        description += f" x{streak}!"
    else:
        description += "!"
        
    total_coins = coins * streak
    
    embed = {
        "title": title,
        "description": description,
        "color": color,
        "fields": [
            {
                "name": "Gift Info",
                "value": f"🎁 {gift_name}",
                "inline": True
            },
            {
                "name": "Coins Per Gift",
                "value": f"🪙 {coins}",
                "inline": True
            },
            {
                "name": "Total Value",
                "value": f"🪙 {total_coins}",
                "inline": True
            }
        ],
        "footer": {
            "text": "TikTok Live Roulette Wheel"
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    if streak > 1:
        embed["fields"].append({
            "name": "Streak",
            "value": f"x{streak}",
            "inline": True
        })
        
    if avatar_url:
        embed["thumbnail"] = {
            "url": avatar_url
        }
        
    payload = {
        "embeds": [embed]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(state.discord_webhook_url, json=payload, timeout=10.0)
            if resp.status_code not in (200, 204):
                print(f"Discord Webhook returned status code {resp.status_code}: {resp.text}")
            else:
                print(f"Successfully sent Discord Webhook notification for gift {gift_name}")
    except Exception as e:
        print(f"Failed to send Discord notification: {e}")

# Forward static files explicitly
@app.get("/")
async def get_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return HTMLResponse("<h3>index.html not found</h3>")

@app.get("/style.css")
async def get_style():
    if os.path.exists("style.css"):
        return FileResponse("style.css", media_type="text/css")
    return Response(status_code=404)

@app.get("/app.js")
async def get_app():
    if os.path.exists("app.js"):
        return FileResponse("app.js", media_type="application/javascript")
    return Response(status_code=404)

@app.get("/avatar")
async def proxy_avatar(url: str):
    """
    Proxies avatar image requests to bypass Canvas CORS issues in the browser.
    """
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
    except Exception as e:
        print(f"Error proxying avatar URL '{url}': {e}")
    
    return Response(status_code=404)

# TikTok Event Handlers
def setup_tiktok_handlers(client: TikTokLiveClient):
    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        state.status = "connected"
        print(f"Connected to TikTok stream: @{state.username}")
        await manager.broadcast({
            "type": "status",
            "status": "connected",
            "username": state.username,
            "room_id": client.room_id
        })

    @client.on(DisconnectEvent)
    async def on_disconnect(event: DisconnectEvent):
        state.status = "disconnected"
        print(f"Disconnected from TikTok stream: @{state.username}")
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": state.username
        })

    @client.on(LiveEndEvent)
    async def on_live_end(event: LiveEndEvent):
        state.status = "disconnected"
        print(f"Live ended for stream: @{state.username}")
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": state.username,
            "reason": "live_ended"
        })

    @client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        # A gift can be a single gift or part of a streak
        # For streaking gifts, TikTokLive sends multiple events.
        # We broadcast the sender, the gift cost (coins), gift details and avatar.
        
        avatar_url = ""
        if event.user.avatar_thumb and event.user.avatar_thumb.m_urls:
            avatar_url = event.user.avatar_thumb.m_urls[0]
            
        gift_name = getattr(event.gift, 'name', 'Gift')
        coins = getattr(event.gift, 'diamond_count', 0)
        if not coins and getattr(event.gift, 'info', None):
            coins = getattr(event.gift.info, 'coin_count', 0)
        if not coins:
            coins = 1
            
        print(f"Gift received: {event.user.unique_id} sent {gift_name} ({coins} coins) x{event.repeat_count}")
        
        await manager.broadcast({
            "type": "gift",
            "data": {
                "uniqueId": event.user.unique_id,
                "nickname": event.user.nickname,
                "avatar": avatar_url,
                "giftName": gift_name,
                "coins": coins,
                "streak": event.repeat_count,
                "repeatCount": event.repeat_count
            }
        })

        if state.discord_webhook_enabled and state.discord_webhook_url:
            asyncio.create_task(
                send_discord_gift_notification(
                    username=event.user.unique_id,
                    nickname=event.user.nickname,
                    avatar_url=avatar_url,
                    gift_name=gift_name,
                    coins=coins,
                    streak=event.repeat_count,
                    is_simulated=False
                )
            )

    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        # Broadcast chats so streamer can see them in panel, or trigger events (e.g. commands)
        avatar_url = ""
        if event.user.avatar_thumb and event.user.avatar_thumb.m_urls:
            avatar_url = event.user.avatar_thumb.m_urls[0]

        await manager.broadcast({
            "type": "chat",
            "data": {
                "uniqueId": event.user.unique_id,
                "nickname": event.user.nickname,
                "avatar": avatar_url,
                "comment": event.comment
            }
        })

async def run_tiktok_client(username: str):
    # Clean the username by stripping any leading '@'
    clean_username = username.strip().lstrip('@')
    try:
        state.status = "connecting"
        await manager.broadcast({
            "type": "status",
            "status": "connecting",
            "username": clean_username
        })
        
        # Instantiate client
        client = TikTokLiveClient(unique_id=clean_username)
        state.client = client
        setup_tiktok_handlers(client)
        
        # Connect to stream (this is non-blocking when run in task, but blocks this specific coroutine)
        await client.start()
    except UserOfflineError:
        error_msg = f"User '@{clean_username}' is offline. Make sure they are currently LIVE on TikTok."
        print(f"Connection error: {error_msg}")
        state.status = "disconnected"
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": clean_username,
            "error": error_msg
        })
    except UserNotFoundError:
        error_msg = f"User '@{clean_username}' not found. Please double check the username."
        print(f"Connection error: {error_msg}")
        state.status = "disconnected"
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": clean_username,
            "error": error_msg
        })
    except (InitialCursorMissingError, WebcastBlocked200Error):
        error_msg = "Connection blocked by TikTok (possibly captcha/IP rate-limit). Try using a VPN or wait a few minutes."
        print(f"Connection error: {error_msg}")
        traceback.print_exc()
        state.status = "disconnected"
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": clean_username,
            "error": error_msg
        })
    except SignAPIError:
        error_msg = "TikTok signing API error. TikTok's security protocols may have changed. Try updating TikTokLive."
        print(f"Connection error: {error_msg}")
        traceback.print_exc()
        state.status = "disconnected"
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": clean_username,
            "error": error_msg
        })
    except AlreadyConnectedError:
        error_msg = "Already connected to this live stream."
        print(f"Connection error: {error_msg}")
        state.status = "disconnected"
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": clean_username,
            "error": error_msg
        })
    except Exception as e:
        error_msg = f"Failed to connect: {str(e)}"
        print(f"Error in TikTok client: {e}")
        traceback.print_exc()
        state.status = "disconnected"
        await manager.broadcast({
            "type": "status",
            "status": "disconnected",
            "username": clean_username,
            "error": error_msg
        })

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Send current status immediately on connection
    await websocket.send_json({
        "type": "status",
        "status": state.status,
        "username": state.username,
        "discord_webhook_url": state.discord_webhook_url,
        "discord_webhook_enabled": state.discord_webhook_enabled
    })
    
    try:
        while True:
            # Wait for client commands
            data = await websocket.receive_json()
            cmd_type = data.get("type")
            
            if cmd_type == "connect":
                username = data.get("username", "").strip().lstrip('@')
                if username:
                    # Clean up existing connection first
                    if state.client and state.client.connected:
                        await state.client.disconnect()
                    if state.task and not state.task.done():
                        state.task.cancel()
                    
                    state.username = username
                    # Create background task in FastAPI event loop
                    state.task = asyncio.create_task(run_tiktok_client(username))
                    print(f"Initiated TikTok Live connection to @{username}")
                    
            elif cmd_type == "disconnect":
                print(f"Disconnecting from TikTok Live...")
                if state.client:
                    # Async disconnect
                    asyncio.create_task(state.client.disconnect())
                if state.task and not state.task.done():
                    state.task.cancel()
                state.status = "disconnected"
                await manager.broadcast({
                    "type": "status",
                    "status": "disconnected",
                    "username": state.username
                })
                
            elif cmd_type == "simulate_gift":
                # Broadcast simulation gift data to all clients
                sim_data = data.get("data", {})
                print(f"Simulating gift: {sim_data.get('uniqueId')} sent {sim_data.get('giftName')} ({sim_data.get('coins')} coins)")
                await manager.broadcast({
                    "type": "gift",
                    "data": sim_data
                })
                
                # Send Discord Webhook notification for simulated gift
                if state.discord_webhook_enabled and state.discord_webhook_url:
                    asyncio.create_task(
                        send_discord_gift_notification(
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
                print(f"Discord Webhook config updated: URL={state.discord_webhook_url}, Enabled={state.discord_webhook_enabled}")
                # Broadcast config update to sync multiple windows
                await manager.broadcast({
                    "type": "discord_config_update",
                    "data": {
                        "url": state.discord_webhook_url,
                        "enabled": state.discord_webhook_enabled
                    }
                })

            elif cmd_type == "discord_test":
                print("Sending test Discord Webhook notification...")
                if state.discord_webhook_url:
                    asyncio.create_task(
                        send_discord_gift_notification(
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
                # Broadcast simulation chat data to all clients
                sim_data = data.get("data", {})
                print(f"Simulating chat: {sim_data.get('uniqueId')}: {sim_data.get('comment')}")
                await manager.broadcast({
                    "type": "chat",
                    "data": sim_data
                })
                
            elif cmd_type in ["settings_update", "reset_game", "toggle_pause", "trigger_spin", "dismiss_announcement"]:
                # Broadcast synchronization events to all clients
                print(f"Syncing command to clients: {cmd_type}")
                await manager.broadcast(data)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    # Start FastAPI server on port 8001
    uvicorn.run("server:app", host="127.0.0.1", port=8001, reload=True)
