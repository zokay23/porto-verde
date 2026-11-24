// playtest.mjs — 12 automated checks for Porto Verde.
// Runs in Node, no browser needed: drives the pure sim/city modules.
// Usage: node playtest.mjs   (exit 0 only when 12/12 pass)

import { readFileSync, existsSync } from 'node:fs';
import { RNG } from './game/src/random.js';
import { CONFIG, MISSIONS } from './game/src/config.js';
import { buildCity, CITY_SIZE, isOnRoad } from './game/src/city.js';
import {
  createGame, update, shoot, punch, reload, tryEnterCar,
  startMission, completeMission, getBusted, wantedStars,
  saveGame, loadSave, applySave,
} from './game/src/sim.js';
import { SHOT_SCENES, applyShot } from './game/src/shots.js';

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`PASS ${name}`);
  } catch (e) {
    failed++;
    results.push(`FAIL ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: ${a} !== ${b}`);
}

const idle = { up: false, down: false, left: false, right: false, run: false, jump: false };

// update() clamps dt to 0.05s, so advance time in 50ms steps.
function tick(g, input, seconds) {
  const steps = Math.round(seconds / 0.05);
  for (let i = 0; i < steps; i++) update(g, input, 0.05);
}

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test('1. seeded RNG is deterministic', () => {
  const a = new RNG(7);
  const b = new RNG(7);
  for (let i = 0; i < 50; i++) assertEq(a.float(), b.float(), 'rng stream diverged');
  assert(new RNG(8).float() !== new RNG(7).float(), 'different seeds should differ');
});

test('2. city is 6x6 blocks, seed 7, roads exist', () => {
  const city = buildCity(7);
  assertEq(city.blocks.length, 36, 'blocks');
  assert(city.buildings.length > 40, 'too few buildings: ' + city.buildings.length);
  assert(city.size === CITY_SIZE && CITY_SIZE === 6 * 260 + 7 * 72, 'city size');
  assert(isOnRoad(36, 500), 'road band should be road');
  assert(!isOnRoad(200, 200), 'block interior should not be road');
});

test('3. city generation is deterministic', () => {
  const a = buildCity(7);
  const b = buildCity(7);
  assertEq(JSON.stringify(a.buildings), JSON.stringify(b.buildings), 'buildings differ');
  assertEq(JSON.stringify(a.parks), JSON.stringify(b.parks), 'parks differ');
});

test('4. game boots with traffic, peds and mission 1', () => {
  const g = createGame(7);
  assertEq(g.cars.length, CONFIG.TRAFFIC_CARS, 'traffic cars');
  assertEq(g.peds.length, CONFIG.PEDS, 'peds');
  assertEq(g.mission.id, 'wheels-up', 'first mission');
  assertEq(g.player.hp, 100, 'player hp');
  assertEq(g.player.ammo, CONFIG.MAG_SIZE, 'mag size 12');
});

test('5. player walks and runs', () => {
  const g = createGame(7);
  g.status = 'playing';
  const x0 = g.player.x;
  tick(g, { ...idle, right: true }, 1);
  assert(g.player.x > x0 + 100, 'walk should move +x');
  const x1 = g.player.x;
  tick(g, { ...idle, right: true, run: true }, 1);
  assert(g.player.x - x1 > (x1 - x0) * 1.3, 'run should be faster than walk');
});

test('6. carjacking works and raises wanted', () => {
  const g = createGame(7);
  g.status = 'playing';
  const car = g.cars.find((c) => c.driver === 'traffic');
  g.player.x = car.x;
  g.player.y = car.y;
  assertEq(tryEnterCar(g), 'enter', 'enter car');
  assert(g.player.inCar === car.id, 'player in car');
  assert(g.wanted >= 1, 'carjack should raise wanted');
  assertEq(tryEnterCar(g), 'exit', 'exit car');
  assert(g.player.inCar === null, 'player out of car');
});

test('7. shooting spends ammo, reload refills the mag', () => {
  const g = createGame(7);
  g.status = 'playing';
  assert(shoot(g), 'first shot');
  assertEq(g.player.ammo, CONFIG.MAG_SIZE - 1, 'ammo spent');
  for (let i = 0; i < 11; i++) shoot(g);
  assertEq(g.player.ammo, 0, 'mag empty');
  assert(!shoot(g), 'no shot with empty mag');
  assert(reload(g), 'reload starts');
  tick(g, idle, 1.5);
  assertEq(g.player.ammo, CONFIG.MAG_SIZE, 'mag refilled after reload');
});

test('8. wanted stars scale with heat and decay', () => {
  assertEq(wantedStars(0), 0, 'heat 0');
  assertEq(wantedStars(30), 1, 'heat 30');
  assertEq(wantedStars(100), 3, 'heat 100');
  assertEq(wantedStars(220), 5, 'heat 220');
  const g = createGame(7);
  g.status = 'playing';
  g.heat = 100;
  g.wanted = 3;
  tick(g, idle, 60);
  assert(g.wanted === 0, 'heat should decay to 0 stars after a minute idle');
});

test('9. busted costs 10% cash and resets wanted', () => {
  const g = createGame(7);
  g.status = 'playing';
  g.player.cash = 1000;
  g.heat = 150;
  g.wanted = 4;
  const loss = getBusted(g);
  assertEq(loss, 100, 'busted loss');
  assertEq(g.player.cash, 900, 'cash after busted');
  assertEq(g.wanted, 0, 'wanted reset');
  assertEq(g.status, 'busted', 'status busted');
});

test('10. missions chain in order and the last one wins', () => {
  const g = createGame(7);
  g.status = 'playing';
  const seen = [];
  for (let i = 0; i < MISSIONS.length; i++) {
    seen.push(g.mission.id);
    // Force-complete each mission through the real completion path.
    completeMission(g);
    if (i < MISSIONS.length - 1) assertEq(g.missionIndex, i + 1, 'advance to mission ' + (i + 2));
  }
  assertEq(seen.join(','), MISSIONS.map((m) => m.id).join(','), 'mission order');
  assertEq(g.status, 'won', 'finishing mission 5 wins');
  assert(g.player.cash > CONFIG.START_CASH, 'rewards paid');
});

test('11. save and continue round-trips', () => {
  const g = createGame(7);
  g.status = 'playing';
  g.player.cash = 1234;
  g.missionIndex = 2;
  const store = memStorage();
  assert(saveGame(g, store), 'save ok');
  assert(loadSave(store) !== null, 'load finds save');
  const g2 = createGame(7);
  assert(applySave(g2, loadSave(store)), 'apply save');
  assertEq(g2.player.cash, 1234, 'cash restored');
  assertEq(g2.missionIndex, 2, 'mission restored');
});

test('12. all four screenshot scenes stage without errors', () => {
  for (const kind of Object.keys(SHOT_SCENES)) {
    const g = createGame(7);
    const scene = applyShot(g, kind);
    assert(scene && scene.file, 'scene ' + kind);
    assertEq(g.status, 'playing', 'scene playing: ' + kind);
    update(g, idle, 0.5);
    assert(g.player, 'player exists after update: ' + kind);
  }
  // Required files exist on disk.
  for (const f of ['game/index.html', 'game/src/main.js', 'game/src/sim.js', 'game/src/render.js', 'game/src/city.js', 'game/src/audio.js', 'game/src/shots.js', 'game/src/random.js', 'game/src/config.js', 'serve.ts', 'main.ts', 'shots.json', 'README.md', 'LICENSE']) {
    assert(existsSync(new URL('./' + f, import.meta.url)), 'missing file: ' + f);
  }
  const html = readFileSync(new URL('./game/index.html', import.meta.url), 'utf8');
  assert(html.includes('./src/main.js'), 'index loads main.js');
});

console.log(results.join('\n'));
console.log(`\nplaytest: ${passed}/12 passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
