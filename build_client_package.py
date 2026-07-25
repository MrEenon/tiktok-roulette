import os
import json
import zipfile
import sys
import shutil
from build_executable import build_standalone_executable

def build_client_package(render_url):
    # Clean render url
    render_url = render_url.strip().rstrip("/")
    if not render_url.startswith("http"):
        render_url = "https://" + render_url

    print("=" * 60)
    print("  TikTok Live Roulette - Client Release Packaging Tool  ")
    print(f"  Target Backend URL: {render_url}")
    print("=" * 60)

    # 1. Build or locate PyInstaller standalone executable folder
    project_root = os.path.dirname(os.path.abspath(__file__))
    dist_executable_dir = os.path.join(project_root, "dist", "TikTok_Roulette_Client")

    if not os.path.exists(dist_executable_dir):
        print("\nStandalone executable directory not found. Invoking build_executable.py...")
        dist_executable_dir = build_standalone_executable()
        if not dist_executable_dir or not os.path.exists(dist_executable_dir):
            print("\n[ERROR] Failed to compile standalone executable.")
            return False

    # 2. Inject/Update license_config.json inside client directory
    config_file = os.path.join(dist_executable_dir, "license_config.json")
    config_data = {}
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                config_data = json.load(f)
        except Exception:
            pass

    config_data["backend_url"] = render_url

    try:
        with open(config_file, "w") as f:
            json.dump(config_data, f, indent=4)
        print(f"\n[OK] Updated license_config.json with backend URL: {render_url}")
    except Exception as e:
        print(f"\n[ERROR] Error writing config file: {e}")
        return False

    # 3. Also update root license_config.json for convenience
    root_config = os.path.join(project_root, "license_config.json")
    try:
        with open(root_config, "w") as f:
            json.dump(config_data, f, indent=4)
    except Exception:
        pass

    # 4. Create ZIP distribution archive
    zip_path = os.path.join(project_root, "TikTok_Roulette_Client_Live.zip")
    print(f"\nPackaging client into zip archive: {zip_path}...")
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(dist_executable_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, dist_executable_dir)
                    zipf.write(file_path, arcname)
        print(f"\nSUCCESS! Created production release package:")
        print(f"[PACKAGED] Archive: {zip_path}")
        print(f"[INFO] Share this ZIP file with your streamers/users!")
        return True
    except Exception as e:
        print(f"\n[ERROR] Error creating zip archive: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = input("Enter your live Render / Cloud Backend URL (e.g. https://roulette-backend.onrender.com): ")
    build_client_package(url)
