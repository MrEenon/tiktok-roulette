import os
import sys

# Ensure root directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from roulette_app.local_server import app, configure_server, TikTokState

# Initialize server state for production web hosting
configure_server("web-session-token", "web-server-hwid")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting TikTok Live Roulette Web Server on port {port}...")
    uvicorn.run("app:app", host="0.0.0.0", port=port)
