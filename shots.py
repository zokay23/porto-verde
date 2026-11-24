"""Take Porto Verde's four screenshots with headless Chromium.

Serves game/ on localhost:8080 (the dev server must already be running),
opens each ?shot=<name>&seed=7 scene, waits for the render, and saves a
1280x720 JPEG (quality 80) into screenshots/. Prints size + dimensions
for every file so the gate limits are checked at a glance.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHOTS = ["action", "drive", "mission", "chase"]
CHROME = Path.home() / ".cache/ms-playwright/chromium-1255/chrome-linux64/chrome"


def take(name):
    png = Path(f"/tmp/pv-{name}.png")
    cmd = [
        str(CHROME), "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
        "--enable-unsafe-swiftshader", "--window-size=1280,720",
        f"--screenshot={png}",
        f"http://localhost:8080/?shot={name}&seed=7",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if not png.exists():
        print(f"{name}: CHROME FAILED rc={r.returncode}\n{r.stdout[-500:]}\n{r.stderr[-500:]}")
        return False
    from PIL import Image
    im = Image.open(png).convert("RGB")
    out = ROOT / "screenshots" / f"{['1-action', '2-drive', '3-mission', '4-chase'][SHOTS.index(name)]}.jpg"
    im.save(out, "JPEG", quality=80)
    print(f"{name}: {out.name} {im.size} {out.stat().st_size} bytes")
    return out.stat().st_size <= 262144


def main():
    ok = True
    for name in SHOTS:
        ok = take(name) and ok
    print("ALL OK" if ok else "SOME SHOTS FAILED / TOO BIG")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
