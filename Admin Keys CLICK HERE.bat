@echo off
title Admin Key Manager
echo Starting Admin Dashboard Desktop App...
cd /d "%~dp0"
.venv\Scripts\python.exe admin_app\main.py
