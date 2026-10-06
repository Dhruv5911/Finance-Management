#!/usr/bin/env python3
"""
FinAI — Run Script
Starts the FinAI backend server and serves the complete frontend.

Usage:
    python run.py
"""
import os
import sys
import webbrowser
import threading
import time

def open_browser(url: str, delay: float = 1.2):
    """Wait for server to bind, then open the default web browser."""
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception:
        pass

def main():
    print("=" * 65)
    print("   FinAI — Intelligent Personal Finance Assistant & Dashboard")
    print("=" * 65)

    # Change working directory to this script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Import Flask app after setting cwd
    try:
        from app import app
        from config import Config
    except ImportError as e:
        print(f"[FinAI Error] Failed to import app: {e}")
        print("Make sure you are running with your Python environment and dependencies installed:")
        print("    pip install -r requirements.txt")
        sys.exit(1)

    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "127.0.0.1")
    url = f"http://{host}:{port}"

    print(f"[*] Starting FinAI Server on: {url}")
    print(f"[*] Knowledge base path:     {Config.KNOWLEDGE_BASE_PATH}")
    print(f"[*] Sample data loaded:      {Config.SAMPLE_CSV_PATH}")
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key:
        print("[*] Gemini AI status:        Configured (API key found)")
    else:
        print("[!] Gemini AI status:        Fallback mode (GEMINI_API_KEY not found in .env)")
    print("=" * 65)
    print(f"-> Open in browser: {url}")
    print("-> Press Ctrl+C to stop the server.")
    print("=" * 65)

    # Automatically launch browser in background thread
    if os.environ.get("NO_BROWSER", "").lower() not in ("1", "true", "yes"):
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    # Run the Flask app
    app.run(host="0.0.0.0", port=port, debug=False)

if __name__ == "__main__":
    main()
