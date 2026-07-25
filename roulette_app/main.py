import os
import sys
import secrets
import threading
import subprocess
import hashlib
import uuid
import socket
import webview
import uvicorn

# Add parent directory to path so PyInstaller and python runtime find packages
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import backend.main
import roulette_app.local_server

def is_port_in_use(port: int) -> bool:
    """
    Checks if a local port is already open and in use.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def run_backend_server(host: str = "127.0.0.1", port: int = 8000):
    """
    Runs the secure licensing backend server.
    """
    from backend.main import app as backend_app
    uvicorn.run(backend_app, host=host, port=port, log_level="warning")

def run_local_server(secret_token: str, hwid: str, host: str = "0.0.0.0", port: int = 8001):
    """
    Initializes and runs the local client FastAPI server with configuration.
    """
    from roulette_app.local_server import app, configure_server
    
    # Pass configuration parameters to the server state
    configure_server(secret_token, hwid)
    
    # Run the server
    uvicorn.run(app, host=host, port=port, log_level="warning")

def get_hwid() -> str:
    """
    Generates a secure, unique hardware identifier for the user's machine.
    """
    hwid_str = ""
    if sys.platform == "win32":
        try:
            # Try to get motherboard UUID
            out = subprocess.check_output("wmic csproduct get uuid", shell=True, stderr=subprocess.DEVNULL)
            uuid_val = out.decode().split("\n")[1].strip()
            if uuid_val and len(uuid_val) > 5 and "FFFF" not in uuid_val:
                hwid_str += uuid_val
        except Exception:
            pass
            
        try:
            # Try to get CPU Processor ID
            out = subprocess.check_output("wmic cpu get processorid", shell=True, stderr=subprocess.DEVNULL)
            cpu_val = out.decode().split("\n")[1].strip()
            if cpu_val and len(cpu_val) > 5:
                hwid_str += cpu_val
        except Exception:
            pass
            
    if not hwid_str:
        # Fallback to MAC-based identifier if WMI query fails or non-Windows
        mac = uuid.getnode()
        hwid_str = f"MAC-{mac}"
        
    return hashlib.sha256(hwid_str.encode()).hexdigest()

if __name__ == "__main__":
    import time
    import webbrowser

    # 1. Start licensing backend server (port 8000) if not active
    if not is_port_in_use(8000):
        print("Licensing Backend (port 8000) not detected. Launching backend server thread...")
        backend_thread = threading.Thread(
            target=run_backend_server,
            args=("127.0.0.1", 8000),
            daemon=True
        )
        backend_thread.start()
        
        # Wait up to 5 seconds for backend to start
        for _ in range(50):
            if is_port_in_use(8000):
                print("Licensing Backend active on port 8000.")
                break
            time.sleep(0.1)

    # 2. Generate secure, single-session token
    SECRET_TOKEN = secrets.token_hex(16)
    
    # 3. Get hardware ID
    HWID = get_hwid()
    print(f"Generated HWID: {HWID}")
    
    # 4. Start local client server in background thread
    server_thread = threading.Thread(
        target=run_local_server,
        args=(SECRET_TOKEN, HWID),
        daemon=True
    )
    server_thread.start()
    
    # 5. Wait for the local server to start listening
    print("Waiting for local roulette server to initialize...")
    for _ in range(100):  # Wait up to 10 seconds
        if is_port_in_use(8001):
            print("Local Roulette Server active on port 8001.")
            break
        time.sleep(0.1)

    url = f"http://127.0.0.1:8001/?token={SECRET_TOKEN}"
    print(f"Launching Roulette desktop app URL: {url}")

    # 6. Open in Google Chrome browser
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if os.path.exists(chrome_path):
        try:
            webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(chrome_path))
            webbrowser.get('chrome').open(url)
            print("Opened Roulette App in Google Chrome.")
        except Exception:
            webbrowser.open(url)
    else:
        webbrowser.open(url)

    # 7. Start pywebview Window if available
    try:
        window = webview.create_window(
            title="TikTok Live Roulette Wheel (Licensed)",
            url=url,
            width=1280,
            height=800,
            min_size=(1024, 768),
            background_color="#121212"
        )
        webview.start()
    except Exception as e:
        print(f"pywebview closed or unavailable: {e}")
        
    print("Application closed.")
