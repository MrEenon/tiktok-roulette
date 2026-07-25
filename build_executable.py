import os
import sys
import subprocess
import shutil

def build_standalone_executable():
    """
    Compiles the Roulette Client application into a standalone executable
    with zero external Python runtime dependencies.
    """
    print("=" * 60)
    print("  TikTok Live Roulette - Standalone Executable Builder  ")
    print("=" * 60)

    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    python_exe = sys.executable

    # 1. Check if PyInstaller is available
    try:
        subprocess.check_call([python_exe, "-m", "PyInstaller", "--version"], stdout=subprocess.DEVNULL)
        print("[OK] PyInstaller is installed and ready.")
    except Exception:
        print("Installing PyInstaller...")
        subprocess.check_call([python_exe, "-m", "pip", "install", "pyinstaller"])

    # 2. Define build parameters
    main_script = os.path.join("roulette_app", "main.py")
    ui_source = os.path.join("roulette_app", "ui")
    admin_ui_source = os.path.join("admin_app", "ui")
    
    # Path separator for PyInstaller --add-data (';' on Windows, ':' on Unix)
    sep = ";" if sys.platform == "win32" else ":"
    add_data_param = f"{ui_source}{sep}roulette_app/ui"
    add_data_admin_param = f"{admin_ui_source}{sep}admin_app/ui"

    executable_name = "TikTok_Roulette_Client"
    dist_dir = os.path.join(project_root, "dist")

    # PyInstaller command flags
    cmd = [
        python_exe, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name", executable_name,
        "--add-data", add_data_param,
        "--add-data", add_data_admin_param,
        "--hidden-import", "backend",
        "--hidden-import", "backend.main",
        "--hidden-import", "backend.database",
        "--hidden-import", "backend.auth",
        "--hidden-import", "backend.limiter",
        "--hidden-import", "roulette_app",
        "--hidden-import", "roulette_app.local_server",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "sqlalchemy.sql.default_comparator",
        "--hidden-import", "sqlite3",
        main_script
    ]

    print(f"\nBuilding standalone executable for target platform: {sys.platform}...")
    print(f"Executing: {' '.join(cmd)}")
    
    res = subprocess.call(cmd)
    if res != 0:
        print("\n[ERROR] Build failed! Check PyInstaller output above.")
        return False

    output_pkg_dir = os.path.join(dist_dir, executable_name)
    print(f"\n[OK] Standalone build completed successfully!")
    print(f"Output directory: {output_pkg_dir}")
    return output_pkg_dir

if __name__ == "__main__":
    build_standalone_executable()
