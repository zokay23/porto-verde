"""Play-test Porto Verde in headless Chromium (SwiftShader WebGL).
8 checks: load, start, walk, carjack, drive+mission1, combat, pause, exit/save.
SwiftShader renders ~2 FPS at 720p, so all waits are driven by GAME time,
not wall-clock time. Usage: python3 playtest.py
"""
import json
import math
import sys
import time

from playwright.sync_api import sync_playwright

URL = "http://localhost:8080/"
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def game_time(page):
    return page.evaluate("() => window.__game.state.time")


def wait_game_time(page, seconds, cap_real=90):
    """Wait until `seconds` of game time pass (or cap_real wall seconds)."""
    t0 = game_time(page)
    start = time.time()
    while game_time(page) - t0 < seconds:
        if time.time() - start > cap_real:
            return False
        page.wait_for_timeout(200)
    return True


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 960, "height": 540})
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.goto(URL, wait_until="load")
        page.wait_for_timeout(2000)

        # 1. Load: title screen visible, game object exposed, WebGL alive.
        title_ok = page.evaluate("() => !!document.getElementById('btn-start') && !!window.__game && !!window.__renderer")
        webgl_ok = page.evaluate("() => !!document.createElement('canvas').getContext('webgl2')")
        check("1-load", title_ok and webgl_ok, f"title btn + __game present, webgl2={webgl_ok}")

        # 2. Start the game.
        page.click("#btn-start")
        wait_game_time(page, 0.3)
        mode = page.evaluate("() => window.__game.state.mode")
        mission = page.evaluate("() => window.__game.currentMission() && window.__game.currentMission().id")
        check("2-start", mode == "play" and mission == "wheels-up", f"mode={mode} mission={mission}")

        # 3. Walk: hold W (+Shift) toward the nearest parked car, verify movement.
        before = page.evaluate("() => ({x: window.__game.player.x, z: window.__game.player.z})")
        for _ in range(40):
            pos = page.evaluate("""() => {
                const g = window.__game; const p = g.player;
                let best = null, bd = 1e9;
                for (const c of g.cars) { if (c.parked) { const d = Math.hypot(c.x-p.x, c.z-p.z); if (d < bd) { bd = d; best = c; } } }
                return { d: bd, x: best.x, z: best.z, px: p.x, pz: p.z };
            }""")
            if pos["d"] < 3.0:
                break
            yaw = math.atan2(-(pos["x"] - pos["px"]), -(pos["z"] - pos["pz"]))
            page.evaluate(f"() => {{ window.__renderer.camState.yaw = {yaw}; }}")
            page.keyboard.down("Shift")
            page.keyboard.down("w")
            wait_game_time(page, 0.4)
            page.keyboard.up("w")
            page.keyboard.up("Shift")
        after = page.evaluate("() => ({x: window.__game.player.x, z: window.__game.player.z})")
        moved = math.hypot(after["x"] - before["x"], after["z"] - before["z"])
        near = page.evaluate("""() => {
            const g = window.__game; const p = g.player;
            let bd = 1e9;
            for (const c of g.cars) { if (c.parked) bd = Math.min(bd, Math.hypot(c.x-p.x, c.z-p.z)); }
            return bd;
        }""")
        check("3-walk", moved > 5 and near < 4, f"moved {moved:.1f}m, nearest parked car {near:.1f}m")

        # 4. Carjack: press E.
        page.keyboard.press("e")
        wait_game_time(page, 0.3)
        in_car = page.evaluate("() => !!window.__game.player.inCar")
        phase = page.evaluate("() => window.__game.state.missionPhase")
        check("4-carjack", in_car and phase == "deliver", f"inCar={in_car} phase={phase}")

        # 5. Drive mission 1: stage the car 30m west of the garage facing east, hold W.
        mission_done = False
        cash = 0
        saved = None
        if in_car:
            page.evaluate("""() => {
                const g = window.__game; const car = g.player.inCar;
                car.x = -185; car.z = 155; car.angle = Math.PI / 2; car.speed = 0;
                window.__renderer.camState.yaw = -Math.PI / 2;
            }""")
            page.keyboard.down("w")
            t0 = game_time(page)
            while game_time(page) - t0 < 6:
                if page.evaluate("() => window.__game.state.missionIndex") >= 1:
                    mission_done = True
                    break
                page.wait_for_timeout(200)
            page.keyboard.up("w")
            cash = page.evaluate("() => window.__game.state.cash")
            saved = page.evaluate("() => window.localStorage.getItem('portoverde.save.v1')")
        check("5-drive-mission1", mission_done and cash == 300, f"missionIndex advanced={mission_done} cash=${cash} save={saved}")

        # 6. Combat: exit car, shoot (click centre), punch.
        page.keyboard.press("e")
        wait_game_time(page, 0.3)
        out_car = page.evaluate("() => !window.__game.player.inCar")
        ammo_before = page.evaluate("() => window.__game.state.ammo")
        # Hold the mouse down across at least one frame: at ~2 FPS a quick
        # click can land entirely between two frames and never reach step().
        page.mouse.move(480, 270)
        page.mouse.down()
        wait_game_time(page, 0.5)
        page.mouse.up()
        wait_game_time(page, 0.3)
        ammo_after = page.evaluate("() => window.__game.state.ammo")
        page.keyboard.press("f")
        wait_game_time(page, 0.3)
        check("6-combat", out_car and ammo_after < ammo_before, f"exited={out_car} ammo {ammo_before}->{ammo_after} (F punch no error)")

        # 7. Pause / resume.
        page.keyboard.press("p")
        wait_game_time(page, 0.2)
        paused = page.evaluate("() => window.__game.state.mode")
        page.keyboard.press("p")
        wait_game_time(page, 0.2)
        resumed = page.evaluate("() => window.__game.state.mode")
        check("7-pause", paused == "paused" and resumed == "play", f"paused={paused} resumed={resumed}")

        # 8. Save file contents.
        try:
            sv = json.loads(saved) if saved else {}
            save_ok = sv.get("missionIndex") == 1 and sv.get("cash") == 300
        except Exception:
            save_ok = False
        check("8-save", save_ok, f"save={saved}")

        browser.close()

    console_errors = [e for e in errors if "error" in e.lower()]
    check("0-no-console-errors", len(console_errors) == 0, f"{len(console_errors)} errors; first: {console_errors[:2]}")
    print("\n--- console/page messages ---")
    for e in errors[:20]:
        print(" ", e)
    failed = [r for r in RESULTS if not r["ok"]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
