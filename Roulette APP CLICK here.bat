@echo off
title TikTok Roulette Wheel Client
echo Starting Roulette Desktop App...
cd /d "%~dp0"
.venv\Scripts\python.exe roulette_app\main.py
