import os
import sys

# Ensure root directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from roulette_app.local_server import app, configure_server
from backend.main import app as backend_app
from fastapi.staticfiles import StaticFiles

# Initialize server state for production web hosting
configure_server("web-session-token", "web-server-hwid")

# Merge backend admin & licensing routes into main app
app.include_router(backend_app.router)

# Custom static files class with no-cache headers for Admin UI
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

# Mount Admin UI at /admin
admin_ui_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "admin_app", "ui"))
if os.path.exists(admin_ui_dir):
    app.mount("/admin", NoCacheStaticFiles(directory=admin_ui_dir, html=True), name="admin")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting TikTok Live Roulette Web Server on port {port}...")
    uvicorn.run("app:app", host="0.0.0.0", port=port)
