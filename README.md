# Porto Verde — An Open-World Crime Story

An original open-world crime game in the spirit of GTA 6, built for the
make.fun **gta6-01** bounty ("Make GTA 6", $1,666, top 100 paid). It runs
offline in a desktop browser from static files — no network, no build step.

Dante "D" Marlow comes home to Porto Verde to find his brother's garage
torched and a debt owed to the Marlin Club. One week. Five jobs. No backup.

## Play

```sh
node serve.ts        # or: npx serve game
# open http://localhost:8080
```

No build step: `game/index.html` loads vendored three.js r180 from
`game/vendor/` and the game modules from `game/src/`.

## What's in the city

- **A procedural 6×6-block city** (seeded, so every load builds the same
  Porto Verde): streets, buildings with lit windows, a plaza with a
  fountain, parks, the beach and the sea, a tower, street lamps and trees.
- **On foot and by car** — arcade driving, carjacking with `E`, traffic
  cars that follow the road network and pedestrians strolling the sidewalks.
- **Wanted system 0–5 stars** — Verde PD interceptors chase you by car and
  officers chase you on foot; get busted and you lose 10% of your cash.
- **Five story missions, in order**: Wheels Up (steal a car, bring it to
  the garage) → The Package (90-second delivery to the Marlin Club) →
  Heat Check (lose a 2-star wanted level) → Rooftop Rumble (defeat 3
  rivals at the plaza) → The Marlin's Due (ram the rival's coupe, return
  to the garage).
- **Combat** — `F` to punch, click to shoot, `R` to reload (12-round mag).
- **HUD + minimap** — cash, wanted stars, health bar, mission objective
  with live distance, speedometer, ammo, car name, message feed, damage
  and wanted vignettes, and a circular minimap with beacon, police and
  rival blips.
- **Save / continue** — mission progress and cash persist in localStorage;
  the title screen offers CONTINUE when a save exists. `P` pauses.
- **Sound** — everything is synthesized with WebAudio: engine hum, police
  siren, gunshots, crashes, a bassline while you play. No audio files.

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
- `screenshots/` — 4 deterministic screenshots (seed 7), regenerated with
  `python3 shots.py` (needs Playwright + headless Chromium).
- `shots.json` — the 4 staged screenshot scenes.
- `serve.ts` — static dev server (`node serve.ts`, port 8080).
- `main.ts` — dossier builder: `MAKEFUN_OUTPUT_DIR=out node main.ts`
  validates the game and screenshots and writes `out/dossier.json`
  (`makefun/dossier/v1`).
- `playtest.py` — 8 headless-Chromium play-tests (load, start, walk,
  carjack, drive + mission 1, combat, pause, save).

## Screenshots

The four shots (`?shot=<name>&seed=7`): on-foot action at 3 stars, a
high-speed drive past the garage beacon, the timed Marlin Club delivery,
and a 4-star police chase.

## License

MIT — see `LICENSE`. All city, characters, vehicles, names, story, art,
sound and music are original. No Rockstar Games name, logo, character,
map or asset is used.
