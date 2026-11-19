"""Regenerate the 4 deterministic screenshots (seed 7) at 1280x720.
Waits for window.__shotReady (40 settled frames; SwiftShader is slow, so the
timeout is generous). Usage: python3 shots.py
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

SHOTS = [
    ("action", "1-action.jpg"),
    ("drive", "2-drive.jpg"),
    ("mission", "3-mission.jpg"),
    ("chase", "4-chase.jpg"),
]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")


def main():
    errors = []
    wanted = sys.argv[1:] or [s[0] for s in SHOTS]
    shots = [s for s in SHOTS if s[0] in wanted]
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
        )
        for name, fname in shots:
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.on("console", lambda m: errors.append(f"[{name}] console.{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"[{name}] pageerror: {e}"))
            page.goto(f"http://localhost:8080/?shot={name}&seed=7", wait_until="load")
            try:
                page.wait_for_function("() => window.__shotReady === true", timeout=240000)
            except Exception as e:
                print(f"FAIL {name}: shot never became ready ({e})")
                page.close()
                continue
            page.wait_for_timeout(500)
            path = os.path.join(OUT, fname)
            page.screenshot(path=path, type="jpeg", quality=80)
            size = os.path.getsize(path)
            print(f"OK {name} -> {fname} ({size} bytes, {'UNDER' if size < 262144 else 'OVER'} 256 KiB cap)")
            page.close()
        browser.close()
    print("\n--- errors ---")
    for e in errors[:20]:
        print(" ", e)
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
