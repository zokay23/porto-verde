# Porto Verde — An Open-World Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zokay23/porto-verde/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zokay23/porto-verde/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
make.fun **gta6-01** bounty ("Make GTA 6", $1,666, top 100 paid). It runs
offline in a desktop browser from static files — no network, no build step.

Dante "D" Marlow comes home to Porto Verde to find his brother's garage
torched and a debt owed to the Marlin Club. One week. Five jobs. No backup.

## Play

```sh
node serve.ts        # open http://localhost:8080
```

No build step: `game/index.html` loads vendored three.js r180 from
`game/vendor/` and the game modules from `game/src/`.

## What's in the city

- **A procedural 6x6-block city** (seeded, seed 7, so every load builds
  the same Porto Verde): streets, buildings with lit windows, a plaza
  with a fountain, a park, the beach and the sea, the Verde Tower,
  street lamps and trees. Warm late-afternoon sun.
- **On foot and by car** — arcade driving, carjacking with `E`, traffic
  cars that follow the road network and pedestrians strolling the
  sidewalks (and scattering from a speeding car).
- **Wanted system 0-5 stars** — Verde PD interceptors chase you by car
  and officers chase you on foot; get busted and you lose 10% of cash.
- **Five story missions, in order**: Wheels Up (steal a car, bring it to
  the garage) → The Package (90-second delivery to the Marlin Club) →
  Heat Check (lose a 2-star wanted level) → Rooftop Rumble (defeat 3
  rivals at the plaza) → The Marlin's Due (ram the rival's coupe 3
  times, then return to the garage).
- **Combat** — `F` to punch, click to shoot, `R` to reload (12-round mag).
- **HUD + minimap** — cash, wanted stars, health bar, mission objective
  with live distance and timer, speedometer, ammo, car name, message
  feed, damage and wanted vignettes, and a circular minimap with the
  mission beacon, police and rival blips.
- **Save / continue** — mission progress and cash persist in
  localStorage; the title screen offers CONTINUE when a save exists.
  `P` pauses (the game also auto-pauses when the tab is hidden),
  `M` mutes.
- **Sound** — everything is synthesized with WebAudio: engine hum,
  police siren, gunshots, crashes, a bassline while you play. No audio
  files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| Space | Jump |
| E | Enter / exit car (carjack) |
| F | Punch |
| Click | Shoot |
| R | Reload |
| P | Pause |
| Drag / mouse-look | Orbit camera |

## Files

- `game/` — the playable game (static files): `index.html`,
  `src/{random,config,city,sim,render,audio,shots,main}.js`,
  `vendor/three.module.min.js` (three.js r180, vendored).
- `screenshots/` — 4 real renders, 1280x720 JPEG, taken with
  `python3 shots.py` (headless Chromium, `?shot=<name>&seed=7`).
- `shots.json` — the 4 staged screenshot scenes.
- `serve.ts` — static dev server (`node serve.ts`, port 8080).
- `main.ts` — dossier builder using `vendor/makefun-game.ts`:
  `MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/dossier.json`.
- `playtest.mjs` — 12 headless-Chromium play-tests via CDP
  (load, start, walk, carjack, drive + mission 1, combat, pause, save,
  HUD). Result at last run: **12/12 passed**.

## Screenshots

The four shots (`?shot=<name>&seed=7`): on-foot action at 3 stars,
a high-speed drive past the garage beacon, the timed Marlin Club
delivery, and a 4-star police chase on the main road.

## Round 2 polish

Rebuilt from scratch for round 2. Same city, seed, camera and HUD, so
the screenshots above stay accurate. What changed under the hood:

- **Combat fix** — shooting a foot officer now damages the real officer
  (round 1 hit a copy, so officers could never be shot down).
- **Police ids** — spawned officers/cars get ids from a counter instead
  of the wall clock, so two spawns in one second can no longer collide.
- **Mission 5 rams** — a 1-second cooldown stops one long scrape from
  counting twice.
- **Reload** — `R` is a no-op (and silent) when the mag is already full.
- **Auto-pause** — hiding the tab pauses the game instead of leaving
  Dante busted while away.
- **Audio** — muting ramps smoothly instead of cutting, plus a menu click.
- **Rendering** — despawned police meshes are disposed instead of leaking.
- **Tooling** — playtest has a 90s watchdog, `shots.py` waits for the
  server and takes `--out-dir`, `serve.ts` answers HEAD with no-store
  headers, and `main.ts` verifies the game copy before building.

## License

MIT — see `LICENSE`. All city, characters, vehicles, names, story, art,
sound and music are original. No Rockstar Games name, logo, character,
map or asset is used.
