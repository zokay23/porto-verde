#!/usr/bin/env python3
"""shots.py — capture Porto Verde's 4 screenshots with headless Chromium.

Serves game/ on a local port, loads index.html?shot=<kind> for each scene,
waits for the game to settle, screenshots 1280x720, and converts to JPEG
at <= 256 KiB each via PIL. No network beyond localhost.
"""
import http.server
import functools
import io
import os
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME_DIR = ROOT / "game"
SHOTS_DIR = ROOT / "screenshots"
PORT = 8123
WIDTH, HEIGHT = 1280, 720
MAX_BYTES = 256 * 1024

CHROME = (
    Path.home()
    / ".cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
)

SCENES = [
    ("action", "1-action.jpg"),
    ("drive", "2-drive.jpg"),
    ("mission", "3-mission.jpg"),
    ("chase", "4-chase.jpg"),
]


def serve():
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(GAME_DIR)
    )
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def shoot(kind, out_png):
    url = f"http://127.0.0.1:{PORT}/index.html?shot={kind}"
    cmd = [
        str(CHROME),
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={WIDTH},{HEIGHT}",
        "--virtual-time-budget=6000",
        f"--screenshot={out_png}",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"[{kind}] chromium failed: {result.stderr[-500:]}", file=sys.stderr)
        raise SystemExit(1)


def to_jpeg(png_path, jpg_path):
    from PIL import Image

    img = Image.open(png_path).convert("RGB")
    if img.size != (WIDTH, HEIGHT):
        img = img.resize((WIDTH, HEIGHT))
    quality = 88
    while quality >= 40:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        if len(buf.getvalue()) <= MAX_BYTES:
            jpg_path.write_bytes(buf.getvalue())
            return len(buf.getvalue()), quality
        quality -= 8
    # Last resort: shrink dimensions.
    small = img.resize((960, 540))
    buf = io.BytesIO()
    small.save(buf, format="JPEG", quality=75, optimize=True)
    jpg_path.write_bytes(buf.getvalue())
    return len(buf.getvalue()), 75


def main():
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    if not CHROME.exists():
        print(f"chrome-headless-shell not found at {CHROME}", file=sys.stderr)
        raise SystemExit(1)
    httpd = serve()
    try:
        time.sleep(0.5)
        for kind, name in SCENES:
            png = SHOTS_DIR / (name.replace(".jpg", ".png"))
            jpg = SHOTS_DIR / name
            print(f"[{kind}] capturing -> {name} ...")
            shoot(kind, str(png))
            size, q = to_jpeg(png, jpg)
            png.unlink(missing_ok=True)
            print(f"[{kind}] {name}: {size} bytes (quality {q})")
            if size > MAX_BYTES:
                print(f"[{kind}] ERROR: over 256 KiB", file=sys.stderr)
                raise SystemExit(1)
        print("All 4 screenshots done.")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
