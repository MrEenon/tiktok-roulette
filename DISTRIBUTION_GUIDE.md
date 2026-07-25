# TikTok Live Roulette - Production Deployment & Distribution Guide

This guide provides step-by-step instructions for deploying your cloud licensing server, generating standalone executable builds for end-users (streamers), and setting up streaming overlays across Windows, macOS, Android, and iOS devices.

---

## 🏗️ Architecture Overview

The system consists of two decoupled components:

1. **Cloud Licensing Backend (`backend/`)**:
   - Runs in the cloud (Render, Railway, Fly.io, or Docker).
   - Manages license key creation, hardware ID (HWID) locking, duration limits (lifetime, monthly, weekly), key pauses/deletions, and admin audit logging.
   - Provides a web-based Admin Dashboard at `/admin/`.

2. **Standalone Client Application (`roulette_app/`)**:
   - Runs locally on the streamer's computer (Windows / macOS) or web browser.
   - Zero Python Installation Required for end-users when compiled into a standalone executable.
   - Connects to TikTok Live, handles gift triggers, and hosts local transparent overlays for OBS Studio, TikTok LIVE Studio, Streamlabs, or Mobile/Tablet browsers (`http://<LAN-IP>:8001/?overlay=true`).

---

## ☁️ Step 1: Deploying the Cloud Licensing Backend

You can deploy the backend to **Render**, **Railway**, or any **Docker** host.

### Option A: Deploy on Render (Recommended)
1. Push this repository to GitHub or GitLab.
2. Sign in to [Render](https://render.com) and click **New > Blueprint**.
3. Connect your repository. Render will automatically detect [render.yaml](file:///c:/Users/Abner1/Desktop/Updated%20Roulette%20%282%29/Updated%20Roulette/render.yaml).
4. Click **Apply**. Render will build and deploy your licensing server.
5. Your live backend URL will look like: `https://roulette-backend.onrender.com`.

### Option B: Deploy with Docker
Run the included [Dockerfile](file:///c:/Users/Abner1/Desktop/Updated%20Roulette%20%282%29/Updated%20Roulette/Dockerfile) on any cloud provider:
```bash
docker build -t roulette-backend .
docker run -d -p 8000:8000 -e PORT=8000 roulette-backend
```

### Accessing the Admin Key Manager
1. Open `https://<YOUR-BACKEND-URL>/admin/` in any browser.
2. Log in with the default administrator credentials:
   - **Username**: `admin`
   - **Password**: `Abner@1218`
3. From the dashboard you can:
   - Generate lifetime, monthly, weekly, or custom keys.
   - Reset HWID locks if a user upgrades their computer.
   - Pause or revoke keys instantly.

---

## 📦 Step 2: Building Standalone Client Packages for Streamers

To create an installable package for end-users:

1. Open a terminal in the project directory.
2. Run `build_client_package.py` passing your live backend URL:

```bash
python build_client_package.py https://roulette-backend.onrender.com
```

3. The script automatically:
   - Compiles the Python runtime, dependencies, and UI assets into a standalone binary (`dist/TikTok_Roulette_Client`).
   - Pre-configures `license_config.json` with your live cloud backend URL.
   - Archives everything into a ready-to-share ZIP file: **`TikTok_Roulette_Client_Live.zip`**.

---

## 🎮 Step 3: End-User (Streamer) Setup Guide

Share `TikTok_Roulette_Client_Live.zip` with your streamers/users.

### For Windows & macOS Users:
1. Download and extract **`TikTok_Roulette_Client_Live.zip`**.
2. Double-click **`TikTok_Roulette_Client.exe`** (Windows) or executable binary (macOS).
3. **No Python or development tools are needed.**
4. On first launch, the app prompts for a valid license key (or auto-authenticates if a key is saved).
5. The application automatically opens in **Google Chrome** or default web browser.

---

## 📺 Step 4: Stream Overlay Setup (OBS / TikTok LIVE Studio / Mobile)

### A. OBS Studio / TikTok LIVE Studio (Same Computer)
1. In OBS / TikTok LIVE Studio, click **Add Source > Browser**.
2. Set the URL to:
   ```
   http://127.0.0.1:8001/?overlay=true
   ```
3. Set dimensions (e.g. `1280` x `800` or `1920` x `1080`).
4. Enable transparent background.

### B. Mobile / Tablet / Secondary Streaming PC (LAN Overlay)
Because the local client server binds to `0.0.0.0`, any device on the same Wi-Fi / Local Area Network can view the live overlay.
1. Find the host computer's local IP address (e.g. `192.168.1.50`).
2. Open the following URL on iPhone, Android, iPad, or secondary PC browser:
   ```
   http://<HOST-IP>:8001/?overlay=true
   ```

---

## 🔒 Security & Persistence Checklist

- **License Key Persistence**: Saved locally in `license_config.json` so users do not need to re-type keys on restart.
- **Hardware ID (HWID) Locking**: Prevents key sharing across different computers.
- **Session Tokens**: Protected endpoints against unauthorized external requests.
- **Cache-Control**: Static UI files are served with `no-store, no-cache` headers to guarantee live updates without stale browser caching.

---

## 🎯 Verification Summary

| Feature | Windows | macOS | Android | iPhone / iPad |
| :--- | :---: | :---: | :---: | :---: |
| **Standalone Executable** | ✅ Standalone `.exe` | ✅ Binary Bundle | N/A (Client Host) | N/A (Client Host) |
| **Live Stream Overlay** | ✅ OBS / Studio | ✅ OBS / Studio | ✅ Chrome / Safari | ✅ Chrome / Safari |
| **Cloud Key Auth** | ✅ Enabled | ✅ Enabled | ✅ Cloud Admin | ✅ Cloud Admin |
| **Zero Python Requirement** | ✅ Included | ✅ Included | N/A | N/A |
