// shots.js — deterministic screenshot scenes for Porto Verde.
// main.js calls applyShot(state, kind) when the page loads with ?shot=<kind>.
// Each scene stages the game in the middle of a readable moment so the
// four screenshots show action, driving, a mission and a police chase.

import { CONFIG } from './config.js';
import { startMission, addHeat } from './sim.js';

export const SHOT_SCENES = {
  action: {
    file: '1-action.jpg',
    title: 'Shootout on Verde Avenue',
    desc: 'Dante trades shots with Marlin’s crew on a rooftop.',
  },
  drive: {
    file: '2-drive.jpg',
    title: 'Driving through Porto Verde',
    desc: 'Dante cruises the 6x6 grid in a jacked sedan.',
  },
  mission: {
    file: '3-mission.jpg',
    title: 'The Package run',
    desc: 'Ninety seconds on the clock — deliver the package.',
  },
  chase: {
    file: '4-chase.jpg',
    title: 'Verde PD on his tail',
    desc: 'Three stars and two cruisers closing in.',
  },
};

export function applyShot(state, kind) {
  const city = state.city;
  const p = state.player;
  state.status = 'playing';
  // Let the world settle a couple of ticks so traffic spreads out.
  if (kind === 'action') {
    startMission(state, 3); // Rooftop Rumble: 4 enemies on the rooftop.
    const r = city.rooftop;
    p.x = r.x + r.w / 2;
    p.y = r.y + r.h + 60;
    p.angle = -Math.PI / 2;
    p.ammo = 9;
    // One crew member already down, one mid-fire, for a live firefight.
    const alive = state.enemies.filter((e) => e.alive);
    if (alive[0]) alive[0].hp = 10;
    state.bullets.push({
      x: p.x, y: p.y - 30,
      vx: 0, vy: -CONFIG.BULLET_SPEED,
      life: 0.5, from: 'player',
    });
  } else if (kind === 'drive') {
    const car = state.cars.find((c) => c.driver === 'traffic' && !c.parked) || state.cars[0];
    car.driver = 'player';
    car.speed = 330;
    car.angle = 0;
    p.inCar = car.id;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // A few cars ahead on the same avenue, actually driving.
    state.cars.slice(0, 3).forEach((c, i) => {
      if (c.id !== car.id) {
        c.parked = false;
        c.driver = 'traffic';
        c.x = car.x + 160 + i * 120;
        c.y = car.y + (i % 2 === 0 ? -14 : 14);
        c.angle = 0;
        c.speed = 200;
      }
    });
  } else if (kind === 'mission') {
    startMission(state, 1); // The Package.
    state.mission.stage = 1;
    state.missionTimer = 74;
    p.x = city.packageSpot.x + 260;
    p.y = city.packageSpot.y + 40;
    p.angle = 0;
    const car = state.cars.find((c) => c.driver === 'traffic' && !c.parked) || state.cars[0];
    car.driver = 'player';
    car.speed = 260;
    car.angle = 0;
    p.inCar = car.id;
    p.x = car.x;
    p.y = car.y;
  } else if (kind === 'chase') {
    startMission(state, 4); // The Marlin's Due: a getaway with the money.
    addHeat(state, 100); // Exactly 3 stars (bands: 80–130).
    const car = state.cars.find((c) => c.driver === 'traffic' && !c.parked) || state.cars[0];
    car.driver = 'player';
    car.speed = 380;
    car.angle = 0;
    // Stage the chase mid-city on avenue 3, driving east, cruisers in frame.
    car.x = 1032;
    car.y = 1032;
    p.inCar = car.id;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    state.cops = [
      { x: car.x - 220, y: car.y - 34, angle: 0, speed: 300 },
      { x: car.x - 330, y: car.y + 38, angle: 0, speed: 300 },
    ];
    state.copSpawnTimer = 999;
  }
  return SHOT_SCENES[kind] || null;
}
