# Porto Verde

An open-world crime story — an original game made for the **make.fun GTA 6 bounty** (competition `gta6-01`). No Rockstar names, characters, maps or assets: this is a made-up city, a made-up crew, and a made-up debt.

## The story

Porto Verde, 2026. Dante "D" Marlow comes home to find his brother's garage torched and a debt owed to the Marlin Club. One week. Five jobs. No backup. The city is yours to take — on foot or behind the wheel — if the Verde PD doesn't take you first.

## What is in the game

- **A seeded procedural city** (6×6 blocks): beach and sea to the south, Plaza Verde with its fountain, parks, and landmarks — Marlow Garage, the Marlin Club, Verde PD HQ, St. Verde Hospital, and the Torre Verde tower. Lit windows, street lamps, trees, parked cars.
- **On foot and behind the wheel**: run, jump, punch, shoot; arcade car physics with a chase camera; traffic on the road grid; pedestrians who stroll the sidewalks and flee danger.
- **Crime and heat**: carjack any parked car (E) — if a cop sees it, that's a star. Wanted level 0–5: VPD interceptors chase and ram, officers hunt you on foot. Get busted or wasted and you lose 10% of your cash. Lay low and the heat fades.
- **Five story missions, in order**: steal a car for the garage → a 90-second package run to the Marlin Club → lose a 2-star heat → defeat three rivals at the plaza → ram the rival's coupe and report back. Beacon, minimap blip, timer and distance on screen.
- **Combat**: F to punch, click to shoot (hitscan pistol, 12-round mag, R to reload).
- **HUD**: cash, wanted stars, health, ammo, objective with timer/distance, a live 2D minimap, speed, message feed, damage vignette.
- **Title screen** with Start / Continue (localStorage save), pause menu, and fully synthesized WebAudio — engine hum, sirens, gunshots, mission jingle and a slow A-minor bassline. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| Space | Jump |
| E | Enter / exit car (carjack a parked car) |
| F | Punch |
| Click | Shoot |
| R | Reload |
| P | Pause |
| Drag / pointer lock | Orbit camera |

## Run it

```bash
node serve.ts
# open http://localhost:8080
```

No build step, no network, no install. The game runs offline in desktop Chrome from static files. three.js r180 is vendored under `game/vendor/` (MIT license, © three.js authors).

## Screenshots

Deterministic renders (seed 7) — regenerate with the `?shot=` hook:

- `1-action.jpg` — on foot, 3-star wanted, officer closing in
- `2-drive.jpg` — high-speed drive to the garage beacon
- `3-mission.jpg` — timed delivery to the Marlin Club
- `4-chase.jpg` — 4-star chase, three VPD interceptors

## Dossier

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/dossier.json (makefun/dossier/v1) and copies game/ + screenshots/
```

## License

MIT — see `LICENSE`.
