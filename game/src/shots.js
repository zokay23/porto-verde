// Screenshot scenes behind ?shot=action|drive|mission|chase. Each one plays the real
// rules forward from a fresh world for a fixed number of steps with scripted inputs,
// so the frame is what a short game really looks like and the same seed always gives
// the same frame. The HUD (stars, minimap, objective) is drawn by the renderer too.
import { CAR_NAMES, CITY_HALF, PITCH, PLACES } from './config.js';

const STEP = 1 / 60;

function simulate(game, seconds, inputFn) {
  const input = { fwd: false, back: false, left: false, right: false, run: false, jump: false, enter: false, punch: false, reload: false, shoot: false, camYaw: Math.PI, camPos: null, camDir: null };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    inputFn(input, i * STEP);
    input.enter = false; input.punch = false; input.reload = false;
    game.step(STEP, input);
  }
}

function putPlayerInCar(game, which = 0) {
  const car = game.cars.find((c) => c.parked && !c.disabled);
  const pick = game.cars.filter((c) => c.parked && !c.disabled)[which] || car;
  game.player.x = pick.x - 2.5;
  game.player.z = pick.z;
  game.player.angle = pick.angle;
  game.enterCar(pick);
  return pick;
}

function driveForward(game, renderer, seconds, steer = 0) {
  simulate(game, seconds, (input) => {
    const car = game.player.inCar;
    if (!car) return;
    input.fwd = true;
    input.camYaw = car.angle + Math.PI;
    if (steer !== 0) { input.left = steer > 0; input.right = steer < 0; }
  });
}

/**
 * Stage the named scene and return the camera pose the renderer should use.
 * The caller paints twice and sets window.__shotReady.
 */
export function stageShot(name, game, renderer) {
  game.reset();
  game.state.mode = 'play';
  game.state.cash = 2450;
  const p = game.player;

  if (name === 'drive') {
    game.startMission(0); // Wheels Up: the beacon + distance show in the HUD.
    const car = putPlayerInCar(game, 0);
    // Aim down the long avenue for a clean driving shot.
    car.x = -PITCH * 2 - 4.6; car.z = -40; car.angle = 0;
    car.mesh.position.set(car.x, 0, car.z);
    p.x = car.x; p.z = car.z;
    game.state.cash = 1250;
    driveForward(game, renderer, 5);
    const c = game.player.inCar;
    return { yaw: c.angle + Math.PI - 0.18, pitch: 0.26, dist: 10.5, target: { x: c.x, y: 1.8, z: c.z } };
  }

  if (name === 'mission') {
    game.startMission(1); // The Package: deliver to the Marlin Club, beacon on.
    const car = putPlayerInCar(game, 1);
    car.x = 70.5; car.z = PITCH * 2 + 30; car.angle = Math.PI;
    car.mesh.position.set(car.x, 0, car.z);
    p.x = car.x; p.z = car.z;
    driveForward(game, renderer, 7, 0);
    const c = game.player.inCar;
    return { yaw: c.angle + Math.PI - 0.2, pitch: 0.26, dist: 11, target: { x: c.x, y: 2.2, z: c.z } };
  }

  if (name === 'chase') {
    game.startMission(0);
    const car = putPlayerInCar(game, 2);
    car.x = -10.5; car.z = -PITCH * 2; car.angle = 0;
    car.mesh.position.set(car.x, 0, car.z);
    p.x = car.x; p.z = car.z;
    game.state.wanted = 4;
    game.state.wantedTimer = 0;
    const c1 = game.spawnPoliceCar(); c1.x = car.x - 3; c1.z = car.z - 10;
    const c2 = game.spawnPoliceCar(); c2.x = car.x + 4; c2.z = car.z - 14;
    const c3 = game.spawnPoliceCar(); c3.x = car.x - 2; c3.z = car.z - 20;
    driveForward(game, renderer, 4.5);
    const c = game.player.inCar;
    return { yaw: c.angle + Math.PI + 0.45, pitch: 0.18, dist: 11, target: { x: c.x, y: 2.0, z: c.z } };
  }

  // Default: 'action' — the cover. On foot on the road south of the plaza, 3 stars,
  // cops flanking on the road, the plaza and the city ahead.
  p.x = PLACES.plaza.x; p.z = 74; p.angle = Math.PI;
  game.startMission(0);
  game.state.wanted = 3;
  game.state.wantedTimer = 0;
  game.state.cash = 2450;
  const pc1 = game.spawnPoliceCar(); pc1.x = p.x + 26; pc1.z = 67;
  const pc2 = game.spawnPoliceCar(); pc2.x = p.x - 26; pc2.z = 67;
  game.spawnPolicePed();
  game.spawnPolicePed();
  game.setBeacon(PLACES.garage.x, PLACES.garage.z, true);
  simulate(game, 1.2, (input) => {
    input.fwd = true; input.run = true;
    input.camYaw = 0; // facing north, toward the plaza
  });
  return { yaw: -0.5, pitch: 0.24, dist: 10, target: { x: p.x, y: 1.6, z: p.z } };
}

export const SHOT_NAMES = ['action', 'drive', 'mission', 'chase'];
