import os
import sys
import threading
import socket
import webbrowser
import uvicorn

# Add parent directory to path so we can import packages
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

if __name__ == "__main__":
    url = "http://127.0.0.1:8000/admin/"
    
    # 1. Check if backend port 8000 is active; start backend if not
    if not is_port_in_use(8000):
        print("Licensing Backend (port 8000) not detected. Launching server...")
        
        # Start browser in a background thread that polls port 8000
        def launch_browser():
            import time
            print("Waiting for licensing server to start...")
            for _ in range(100):  # Wait up to 10 seconds
                if is_port_in_use(8000):
                    print(f"Server is active! Opening Admin Panel in default browser: {url}")
                    webbrowser.open(url)
                    return
                time.sleep(0.1)
            print("Warning: Server startup timed out. Opening browser anyway...")
            webbrowser.open(url)
            
        browser_thread = threading.Thread(target=launch_browser, daemon=True)
        browser_thread.start()
        
        # Run the backend server (blocking)
        run_backend_server()
    else:
        print("Licensing Backend (port 8000) already active.")
        print(f"Opening Admin Panel in default browser: {url}")
        webbrowser.open(url)
        sys.exit(0)
