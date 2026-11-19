# Porto Verde

An original open-world crime game for the make.fun **gta6-01** bounty — a complete
rendition of the genre, built from scratch in a week: a drivable city, traffic and
pedestrians, carjacking, a wanted system with police chases, five story missions,
combat, a HUD with a live minimap, a save, and synthesized sound. It runs offline in
a desktop browser from static files, with keyboard and mouse and no network requests.

**Everything in it is original**: the city (Porto Verde), the characters (Dante "D"
Marlow, the Marlin Club, the Verde PD), the vehicles, the story, the art and the sound.
Not affiliated with Rockstar Games; no GTA names, logos, characters or maps are used.
three.js (MIT) is vendored under `game/vendor/`.

## Play

Serve the game locally, then open http://localhost:8080:

```bash
node serve.ts
```

Or open `game/index.html` through any static file server. Click **START NEW GAME**
(or **CONTINUE** if a save exists in the browser).

| Key | Action |
| --- | --- |
| WASD | Move on foot / drive |
| Mouse | Left-click shoot · right-drag orbits the camera · wheel zooms |
| E | Take / leave a car |
| F | Punch |
| R | Reload |
| Space | Jump on foot / brake in a car |
| Shift | Run |
| P | Pause · M mute |

## The city

Porto Verde is a seeded procedural city: six-by-six blocks of buildings with lit
windows, a beach and sea to the south, parks, a plaza with a fountain, and landmarks
— Marlow Garage, the Marlin Club, Verde PD HQ, St. Verde Hospital and the Torre Verde.
Traffic follows the road grid, pedestrians stroll the sidewalks and flee from trouble.

## Wanted & police

Stealing a car, hitting a pedestrian, shooting or ramming a police car raises your
wanted level (1–5 stars). Police cars and officers chase you; get caught standing
still near them and you're **BUSTED**, lose a fight and you're **WASTED**. Lay low and
the heat fades, star by star.

## Missions (in order)

1. **Wheels Up** — steal any car and bring it to the garage.
2. **The Package** — drive the package to the Marlin Club in 90 seconds.
3. **Heat Check** — lose a 2-star wanted level.
4. **Rooftop Rumble** — reach the plaza and defeat the 3 rivals.
5. **The Marlin's Due** — ram the rival's Verde Coupe until it stops, then return
   to the garage.

Finishing a mission pays cash and saves your progress in the browser
(`localStorage`); the story ends when the fifth job is done, and free roam continues.

## Sound

All sound is synthesized with WebAudio — engine hum, sirens, gunshots, impacts,
mission jingles and a bassline that plays over the streets. Nothing is downloaded.

## Files

- `game/index.html` — the game page (HUD is a DOM overlay + 2D minimap canvas)
- `game/src/` — the game itself: `config.js` (city, story, missions), `random.js`,
  `audio.js`, `city.js` (procedural city), `sim.js` (player, cars, traffic, peds,
  police, wanted, missions, combat), `render.js` (three.js scene, camera, HUD),
  `shots.js` (deterministic screenshot scenes), `main.js` (boot + loop + screens)
- `game/vendor/three.module.min.js` — three.js r180 (MIT), vendored
- `screenshots/` — four renders of the real game: action (cover), driving, a mission,
  a police chase. Each is staged by `?shot=` + a fixed seed, so the same seed always
  gives the same frame.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json` with the vendored make.fun library.

## Screenshots

The shots are deterministic: `?shot=action|drive|mission|chase&seed=7` stages the
scene by playing the real rules forward from a fresh world, then paints it and sets
`window.__shotReady`. Reproduce one with a headless browser pointed at the local
server, e.g. `http://localhost:8080/?shot=drive&seed=7`.

## License

MIT — see `LICENSE`.
