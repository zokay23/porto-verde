"""Take Porto Verde's four screenshots with headless Chromium.

Serves game/ on localhost:8080 (the dev server must already be running),
opens each ?shot=<name>&seed=7 scene, waits for the render, and saves a
1280x720 JPEG (quality 80) into screenshots/. Prints size + dimensions
for every file so the gate limits are checked at a glance.

Round 2: waits for the dev server to answer before shooting (instead of
failing on a cold start), and accepts --out-dir so a comparison run can
write to a scratch directory without touching screenshots/.
"""
import argparse
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHOTS = ["action", "drive", "mission", "chase"]
CHROME = Path.home() / ".cache/ms-playwright/chromium-1255/chrome-linux64/chrome"


def wait_for_server(url, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(1)
    print(f"dev server did not answer at {url} within {timeout}s — start it with: node serve.ts")
    return False


def take(name, out_dir):
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
    out = out_dir / f"{['1-action', '2-drive', '3-mission', '4-chase'][SHOTS.index(name)]}.jpg"
    im.save(out, "JPEG", quality=80)
    print(f"{name}: {out.name} {im.size} {out.stat().st_size} bytes")
    return out.stat().st_size <= 262144


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(ROOT / "screenshots"),
                    help="directory for the JPEGs (default: screenshots/)")
    args = ap.parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not wait_for_server("http://localhost:8080/"):
        return 1
    ok = True
    for name in SHOTS:
        ok = take(name, out_dir) and ok
    print("ALL OK" if ok else "SOME SHOTS FAILED / TOO BIG")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
