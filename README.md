[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/zokay23/porto-verde/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/zokay23/porto-verde/reward.svg)](https://make.fun/c/gta6-01)

# Porto Verde — Make GTA 6

An original open-world crime game built for the [Make GTA 6 bounty on make.fun](https://make.fun/c/gta6-01). Dante "D" Marlow is back on the streets of Porto Verde: a procedural 6×6-block city (seed 7) with traffic, pedestrians, Verde PD, five story missions, and a wanted system that remembers what you did.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No install, no network, no build step — static files only. Your save lives in the browser's localStorage; CONTINUE picks up where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| Space | Jump |
| E | Jack / exit a car |
| F | Punch |
| Mouse click | Shoot |
| R | Reload (12-round mag) |
| P | Pause |
| M | Mute |

## The city

- **6×6 blocks, seed 7** — roads, buildings, parks, the marina, Verde General hospital and the Verde PD precinct, all generated deterministically.
- **Traffic & pedestrians** — cars cruise the avenues, peds walk the sidewalks (and flee when you hit them).
- **Wanted 0–5 stars** — shootings, carjackings and hit pedestrians raise your heat; cops spawn and chase. Get busted and Verde PD takes 10% of your cash.
- **Five missions, in order** — Wheels Up, The Package (90 seconds), Heat Check, Rooftop Rumble, The Marlin's Due. Finish all five and Porto Verde is yours.
- **HUD + round minimap** — cash, stars, health, ammo, mission banner and timer.
- **Synth sound** — gunshots, sirens, engine and mission jingles, all synthesized with WebAudio.

## Layout

- `game/` — the playable game (`index.html`, `src/*.js`)
- `screenshots/` — 4 renders of the game itself (action, driving, mission, chase)
- `shots.json` — what each screenshot shows
- `serve.ts` — local static server (`node serve.ts`, then http://localhost:8080)
- `main.ts` — builds `out/dossier.json` with `vendor/makefun-game.ts`
- `playtest.mjs` — 12 automated checks (`node playtest.mjs`)
- `shots.py` — captures the 4 screenshots with headless Chromium (`python3 shots.py`)

## License

MIT — see [LICENSE](LICENSE).
