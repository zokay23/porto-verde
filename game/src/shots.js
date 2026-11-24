// Deterministic screenshot staging: ?shot=<name>&seed=7
// Auto-starts the game, places the player / police / rivals and sets the
// mission state for each of the four named scenes, so a headless browser
// can take a real render with no input at all.
//
// Round 2: unknown shot names now warn and return null instead of
// staging a half-initialised scene, and staged players are explicitly
// grounded (y/vy = 0). All four staged scenes are byte-for-byte the
// round-1 values, so the existing screenshots stay accurate.
import { CONFIG } from './config.js';

export function shotName() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot') || null;
}

export function applyShot(sim, name) {
  const known = ['action', 'drive', 'mission', 'chase'];
  if (!known.includes(name)) {
    console.warn(`Porto Verde: unknown shot "${name}", expected one of ${known.join(', ')}`);
    return null;
  }
  const p = sim.player;
  const garage = sim.city.landmarks.garage;
  const marlin = sim.city.landmarks.marlin;
  const plaza = sim.city.landmarks.plaza;
  // Every shot starts the game (no title screen) and clears the feed,
  // then stages its own scene.
  sim.started = true;
  sim.messages = [];
  p.y = 0; p.vy = 0; // staged players stand on the ground, never mid-jump
  if (name === 'action') {
    // On foot at the plaza, 3 stars, officers closing in, mission 4.
    p.x = 0; p.z = 12; p.angle = 0.6; p.health = 72; p.cash = 640; p.ammo = 9;
    sim.missionIndex = 3;
    // Rebuild mission 3 state by hand: rivals at the plaza.
    sim.rivals = [
      { id: 'rival0', x: -6, z: -4, angle: 2.5, health: 100, alive: true },
      { id: 'rival1', x: 4, z: -8, angle: 2.8, health: 60, alive: true },
      { id: 'rival2', x: 8, z: 4, angle: -2.2, health: 100, alive: true },
    ];
    sim.mission = { id: 'rooftop-rumble', title: '4 — Rooftop Rumble', brief: '', objective: 'Defeat all 3 rivals at the plaza', reward: 450 };
    p.wanted = 3;
    sim.policeFoot = [
      { id: 'officerA', x: -12, z: 18, angle: 0, health: 60 },
      { id: 'officerB', x: 12, z: 20, angle: 0, health: 60 },
    ];
    sim.messages.unshift({ text: 'Rooftop Rumble: 3 rivals at Verde Plaza!', t: 0 });
    sim.messages.unshift({ text: 'Wanted level 3 — Verde PD is on you!', t: 0 });
  } else if (name === 'drive') {
    // Driving fast east past the garage beacon, mission 1.
    const car = sim.cars.find(c => c.id === 'park0') || sim.cars[0];
    car.traffic = false; car.x = -96; car.z = -104; car.angle = Math.PI / 2; car.speed = 26;
    p.inCar = car; p.x = car.x; p.z = car.z; p.angle = car.angle;
    p.cash = 190; p.wanted = 0; p.ammo = 12;
    sim.missionIndex = 0;
    sim.mission = { id: 'wheels-up', title: '1 — Wheels Up', brief: '', objective: 'Steal a car, then drive to the garage beacon', reward: 150 };
    sim.messages.unshift({ text: 'In the Verde Sedan. Drive!', t: 0 });
  } else if (name === 'mission') {
    // Timed delivery to the Marlin Club, 84 seconds left, mission 2.
    const car = sim.cars.find(c => c.id === 'park3') || sim.cars[0];
    car.traffic = false; car.x = 50; car.z = 100; car.angle = Math.PI / 2; car.speed = 22;
    p.inCar = car; p.x = car.x; p.z = car.z; p.angle = car.angle;
    p.cash = 490; p.wanted = 1; p.ammo = 12;
    sim.missionIndex = 1;
    sim.missionTimer = 84;
    sim.mission = { id: 'the-package', title: '2 — The Package', brief: '', objective: 'Deliver the package to the Marlin Club before the timer ends', reward: 300 };
    sim.messages.unshift({ text: 'The Package: 90 seconds to the Marlin Club!', t: 0 });
  } else if (name === 'chase') {
    // 4-star police chase on the main north road: interceptors on the
    // road ahead and behind, the player on foot between them.
    p.x = 0; p.z = -50; p.angle = -0.5; p.health = 58; p.cash = 1120; p.ammo = 5;
    sim.missionIndex = 2;
    sim.mission = { id: 'heat-check', title: '3 — Heat Check', brief: '', objective: 'Lose your 2-star wanted level', reward: 250 };
    p.wanted = 4;
    const pd1 = { id: 'pdA', def: { name: 'Verde PD Interceptor', color: 0x1a2a4a, speed: 1.2 }, x: 0, z: -72, angle: 0, speed: 24, color: 0x1a2a4a, police: true, traffic: false, rival: false, health: 100, flash: 1 };
    const pd2 = { id: 'pdB', def: { name: 'Verde PD Interceptor', color: 0x1a2a4a, speed: 1.2 }, x: -3, z: -28, angle: Math.PI, speed: 24, color: 0x1a2a4a, police: true, traffic: false, rival: false, health: 100, flash: 0 };
    sim.cars.push(pd1, pd2);
    sim.policeFoot = [{ id: 'officerC', x: 5, z: -44, angle: 0, health: 60 }];
    sim.messages.unshift({ text: 'Wanted level 4 — Verde PD is on you!', t: 0 });
    sim.messages.unshift({ text: 'Heat Check: lose the heat!', t: 0 });
  }
  // Keep the sim deterministic in shot mode: police will not respawn
  // extra cars while the screenshot is being taken.
  sim.shotMode = true;
  return name;
}

export function seedFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const s = Number(q.get('seed'));
  return Number.isFinite(s) ? s : CONFIG.seed;
}
