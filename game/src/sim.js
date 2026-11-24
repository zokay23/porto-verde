// Simulation: the whole game state and its rules, no rendering here.
// Player on foot or in a car, traffic, pedestrians, Verde PD, wanted
// level, combat and the five-mission story. Render reads this state.
//
// Round 2 fixes (gameplay only, no visual change):
// - shoot() used to hit a *copy* of each foot officer, so officer damage
//   never stuck and officers could not be shot down. It now targets the
//   live officer objects, like punch() already did.
// - Police spawn ids used sim.time (seconds), so two officers spawned in
//   the same second shared an id. A monotonic counter makes them unique.
// - Mission 5 rams now have a 1s cooldown, so one long scrape cannot
//   count twice in consecutive frames.
import { CONFIG, CAR_DEFS, MISSIONS } from './config.js';
import { hitsCollider, clampToWorld, ROAD_AXES } from './city.js';

export function makeCar(id, def, x, z, angle) {
  return { id, def, x, z, angle, speed: 0, color: def.color, police: !!def.police,
    traffic: false, rival: false, health: 100, flash: 0 };
}

export function createSim(city, rng) {
  const sim = {
    city, rng, time: 0, paused: false, started: false, over: false,
    player: { x: -118, z: -100, y: 0, vy: 0, angle: 0, health: CONFIG.playerHealth,
      ammo: CONFIG.magSize, cash: 40, wanted: 0, inCar: null, busted: 0,
      heatTimer: 0, crimeTimer: 0 },
    cars: [], peds: [], policeFoot: [], rivals: [], rivalCar: null,
    missionIndex: 0, mission: null, missionTimer: 0, missionHits: 0,
    messages: [], effects: [], shotsFired: 0,
    // Round 2: unique police ids + ram cooldown bookkeeping.
    _policeSeq: 0, _ramAt: -99,
  };
  // Parked cars the player can steal, near the garage and the plaza.
  const parked = [
    [0, -112, -104, 0.4], [1, -104, -132, -1.2], [2, -30, 8, 1.57],
    [3, 12, -38, 0], [4, 88, -104, 3.1], [0, 52, 118, -0.8],
  ];
  parked.forEach(([di, x, z, a], i) => sim.cars.push(makeCar(`park${i}`, CAR_DEFS[di], x, z, a)));
  spawnTraffic(sim, 10);
  spawnPeds(sim, 16);
  startMission(sim, 0);
  return sim;
}

export function spawnTraffic(sim, n) {
  for (let i = 0; i < n; i++) {
    const def = sim.rng.pick(CAR_DEFS.slice(0, 5));
    const axis = sim.rng.pick(['x', 'z']);
    const line = sim.rng.pick(ROAD_AXES);
    const along = sim.rng.range(-150, 150);
    const c = makeCar(`traffic${i}`, def, axis === 'x' ? along : line, axis === 'x' ? line : along,
      axis === 'x' ? (sim.rng.chance(0.5) ? 0 : Math.PI) : (sim.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2));
    c.traffic = true; c.axis = axis; c.dir = sim.rng.chance(0.5) ? 1 : -1;
    c.speed = CONFIG.trafficSpeed * sim.rng.range(0.7, 1.1);
    sim.cars.push(c);
  }
}

export function spawnPeds(sim, n) {
  const colors = [0xe8b8a0, 0x8ab8d8, 0xd8d8d8, 0xb8a8e8, 0xe8d88a, 0x7ac8a0];
  for (let i = 0; i < n; i++) {
    sim.peds.push({ id: `ped${i}`, x: sim.rng.range(-150, 150), z: sim.rng.range(-150, 150),
      angle: sim.rng.range(0, Math.PI * 2), speed: sim.rng.range(1.2, 2.4),
      color: sim.rng.pick(colors), tx: 0, tz: 0, pause: 0 });
  }
}

export function say(sim, text) {
  sim.messages.unshift({ text, t: sim.time });
  if (sim.messages.length > 5) sim.messages.pop();
}

export function addWanted(sim, n) {
  const p = sim.player;
  p.wanted = Math.min(CONFIG.maxWanted, p.wanted + n);
  p.crimeTimer = 0;
  if (n > 0) say(sim, `Wanted level ${p.wanted} — Verde PD is on you!`);
}

// Reload the mag. No-op (and silent) when the mag is already full.
export function reload(sim, audio) {
  const p = sim.player;
  if (p.ammo >= CONFIG.magSize) return false;
  p.ammo = CONFIG.magSize;
  if (audio) audio.pickup();
  return true;
}

export function startMission(sim, idx) {
  sim.missionIndex = idx;
  const m = MISSIONS[idx];
  sim.mission = m;
  sim.missionTimer = idx === 1 ? CONFIG.mission2Seconds : 0;
  sim.missionHits = 0;
  sim.rivals = [];
  if (sim.rivalCar) { sim.rivalCar.rival = false; sim.rivalCar = null; }
  if (idx === 2) { sim.player.wanted = 2; say(sim, 'Heat Check: you are at 2 stars. Lose them!'); }
  if (idx === 3) {
    for (let i = 0; i < 3; i++) {
      sim.rivals.push({ id: `rival${i}`, x: -8 + i * 8, z: -6 + (i % 2) * 12,
        angle: 0, health: CONFIG.rivalHealth, alive: true });
    }
    say(sim, 'Rooftop Rumble: 3 rivals at Verde Plaza!');
  }
  if (idx === 4) {
    const c = makeCar('rivalcoupe', CAR_DEFS[1], 60, 60, 0.8);
    c.rival = true; c.traffic = true; c.axis = 'x'; c.dir = 1; c.speed = 16;
    sim.cars.push(c); sim.rivalCar = c;
    say(sim, 'The Marlin\'s Due: ram the blue coupe 3 times!');
  }
  say(sim, `${m.title} — ${m.brief}`);
}

export function completeMission(sim) {
  const m = sim.mission;
  sim.player.cash += m.reward;
  say(sim, `Mission complete: ${m.title}  +$${m.reward}`);
  if (sim.missionIndex + 1 < MISSIONS.length) {
    startMission(sim, sim.missionIndex + 1);
  } else {
    sim.over = true;
    say(sim, 'All five jobs done. Porto Verde is yours, Dante.');
  }
}

export function missionTarget(sim) {
  const g = sim.city.landmarks.garage, m = sim.city.landmarks.marlin, p = sim.city.landmarks.plaza;
  switch (sim.missionIndex) {
    case 0: return sim.player.inCar ? { x: g.x, z: g.z, label: 'Garage' } : { x: -112, z: -104, label: 'Steal a car' };
    case 1: return { x: m.x, z: m.z, label: 'Marlin Club' };
    case 2: return { x: p.x, z: p.z, label: 'Lay low' };
    case 3: return { x: p.x, z: p.z, label: 'Plaza rivals' };
    case 4: return sim.missionHits >= 3 ? { x: g.x, z: g.z, label: 'Garage' }
      : (sim.rivalCar ? { x: sim.rivalCar.x, z: sim.rivalCar.z, label: 'Rival coupe' } : { x: p.x, z: p.z, label: 'Rival coupe' });
    default: return { x: g.x, z: g.z, label: 'Garage' };
  }
}

function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

export function nearestCar(sim, maxD) {
  let best = null, bd = maxD;
  for (const c of sim.cars) {
    if (c.police) continue;
    const d = dist2(sim.player.x, sim.player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(sim, audio) {
  const c = nearestCar(sim, 4.5);
  if (!c) { say(sim, 'No car close enough — walk to a parked car.'); return false; }
  sim.player.inCar = c; c.speed = 0;
  if (c.traffic) { c.traffic = false; addWanted(sim, 1); say(sim, `Carjacked a ${c.def.name}!`); }
  else say(sim, `In the ${c.def.name}. Drive!`);
  if (audio) audio.pickup();
  return true;
}

export function exitCar(sim) {
  const c = sim.player.inCar;
  if (!c) return;
  sim.player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 2.5;
  sim.player.z = c.z + Math.sin(c.angle + Math.PI / 2) * 2.5;
  sim.player.angle = c.angle;
  sim.player.inCar = null;
}

export function shoot(sim, audio) {
  const p = sim.player;
  if (p.ammo <= 0) { say(sim, 'Mag empty — press R to reload.'); return; }
  p.ammo--; sim.shotsFired++;
  if (audio) audio.shoot();
  // Targets are the LIVE rival / officer objects: damage must stick.
  // (Round 1 spread-copied officers here, so their health never dropped.)
  const targets = [...sim.rivals.filter(r => r.alive),
    ...sim.policeFoot.map(o => { o.police = true; return o; })];
  let best = null, bd = CONFIG.shootRange;
  for (const t of targets) {
    const d = dist2(p.x, p.z, t.x, t.z);
    if (d < bd) { bd = d; best = t; }
  }
  sim.effects.push({ kind: 'shot', x: p.x, z: p.z, angle: p.angle, t: sim.time });
  if (best) {
    best.health -= CONFIG.shootDamage;
    addWanted(sim, best.police ? 1 : 0);
    if (best.health <= 0) {
      if (best.id && best.id.startsWith('rival')) { best.alive = false; say(sim, 'Rival down!'); }
      else { sim.policeFoot = sim.policeFoot.filter(o => o.id !== best.id); say(sim, 'Officer down!'); }
    }
  }
}

export function punch(sim, audio) {
  const p = sim.player;
  if (audio) audio.punch();
  const targets = [...sim.rivals.filter(r => r.alive), ...sim.policeFoot];
  let best = null, bd = CONFIG.punchRange;
  for (const t of targets) {
    const d = dist2(p.x, p.z, t.x, t.z);
    if (d < bd) { bd = d; best = t; }
  }
  if (best) {
    best.health -= CONFIG.punchDamage;
    if (best.health <= 0 && best.id && best.id.startsWith('rival')) { best.alive = false; say(sim, 'Rival down!'); }
    if (best.health <= 0 && !best.id?.startsWith('rival')) {
      sim.policeFoot = sim.policeFoot.filter(o => o.id !== best.id);
      addWanted(sim, 1);
    }
  }
}

function moveWithCollisions(sim, obj, dx, dz, radius) {
  const nx = obj.x + dx, nz = obj.z + dz;
  if (!hitsCollider(sim.city.colliders, nx, obj.z, radius)) obj.x = nx;
  if (!hitsCollider(sim.city.colliders, obj.x, nz, radius)) obj.z = nz;
  const c = clampToWorld(obj.x, obj.z); obj.x = c.x; obj.z = c.z;
}

function updateFoot(sim, input, dt) {
  const p = sim.player;
  const run = input.run ? CONFIG.runSpeed : CONFIG.walkSpeed;
  const fx = Math.sin(input.camYaw), fz = Math.cos(input.camYaw);
  const rx = Math.cos(input.camYaw), rz = -Math.sin(input.camYaw);
  let mx = 0, mz = 0;
  if (input.forward) { mx += fx; mz += fz; }
  if (input.back) { mx -= fx; mz -= fz; }
  if (input.right) { mx += rx; mz += rz; }
  if (input.left) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    moveWithCollisions(sim, p, mx * run * dt, mz * run * dt, 0.7);
    p.angle = Math.atan2(mx, mz);
  }
  if (input.jump && p.y <= 0.01) p.vy = CONFIG.jumpSpeed;
  p.vy -= CONFIG.gravity * dt; p.y += p.vy * dt;
  if (p.y < 0) { p.y = 0; p.vy = 0; }
}

function updateDrive(sim, input, dt, audio) {
  const p = sim.player, c = p.inCar;
  if (!c) return;
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (input.forward) c.speed += CONFIG.carAccel * dt;
  if (input.back) c.speed -= (c.speed > 0.5 ? CONFIG.carBrake : CONFIG.carAccel * 0.6) * dt;
  c.speed -= c.speed * CONFIG.carDrag * dt;
  c.speed = Math.max(-CONFIG.carMaxReverse, Math.min(CONFIG.carMaxSpeed * c.def.speed, c.speed));
  c.angle += steer * CONFIG.carTurn * dt * (c.speed / 12) * (c.speed >= 0 ? 1 : -1);
  const nx = c.x + Math.sin(c.angle) * c.speed * dt;
  const nz = c.z + Math.cos(c.angle) * c.speed * dt;
  const hit = hitsCollider(sim.city.colliders, nx, nz, 1.6);
  if (hit) {
    if (Math.abs(c.speed) > 9 && audio) audio.crash();
    c.speed *= -0.25;
  } else { c.x = nx; c.z = nz; }
  const cc = clampToWorld(c.x, c.z); c.x = cc.x; c.z = cc.z;
  p.x = c.x; p.z = c.z; p.angle = c.angle;
  // Ram the rival coupe in mission 5 — one counted hit per cooldown.
  if (sim.missionIndex === 4 && sim.rivalCar && sim.missionHits < 3) {
    if (dist2(c.x, c.z, sim.rivalCar.x, sim.rivalCar.z) < 4.5 && Math.abs(c.speed) > 7
      && sim.time - sim._ramAt >= CONFIG.ramCooldownSeconds) {
      sim._ramAt = sim.time;
      sim.missionHits++;
      sim.rivalCar.health -= 40;
      say(sim, `Ram ${sim.missionHits}/3 — the coupe is hurting!`);
      if (audio) audio.crash();
      c.speed *= 0.4;
    }
  }
  if (audio) audio.setEngine(Math.abs(c.speed) / CONFIG.carMaxSpeed, true);
}

function updateTraffic(sim, dt) {
  for (const c of sim.cars) {
    if (!c.traffic) continue;
    const speed = c.rival ? 16 : c.speed;
    c.x += Math.sin(c.angle) * speed * dt;
    c.z += Math.cos(c.angle) * speed * dt;
    // At an intersection, sometimes turn onto the cross street.
    const nearX = ROAD_AXES.some(a => Math.abs(c.x - a) < 1.2);
    const nearZ = ROAD_AXES.some(a => Math.abs(c.z - a) < 1.2);
    if ((nearX || nearZ) && sim.rng.chance(0.004)) {
      c.angle += sim.rng.pick([-Math.PI / 2, Math.PI / 2]);
      c.axis = c.axis === 'x' ? 'z' : 'x';
    }
    if (Math.abs(c.x) > 165 || Math.abs(c.z) > 165) {
      c.x = sim.rng.range(-140, 140); c.z = sim.rng.pick(ROAD_AXES);
      c.angle = sim.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    }
    if (hitsCollider(sim.city.colliders, c.x, c.z, 1.4)) { c.angle += Math.PI / 2; }
  }
}

function updatePeds(sim, dt) {
  for (const ped of sim.peds) {
    if (ped.pause > 0) { ped.pause -= dt; continue; }
    const d = dist2(ped.x, ped.z, ped.tx, ped.tz);
    if (d < 2 || (ped.tx === 0 && ped.tz === 0)) {
      ped.tx = sim.rng.range(-150, 150); ped.tz = sim.rng.range(-150, 150);
      if (sim.rng.chance(0.2)) ped.pause = sim.rng.range(1, 4);
    }
    const a = Math.atan2(ped.tx - ped.x, ped.tz - ped.z);
    ped.angle = a;
    ped.x += Math.sin(a) * ped.speed * dt;
    ped.z += Math.cos(a) * ped.speed * dt;
    // Peds scatter from a speeding player car.
    const p = sim.player;
    if (p.inCar && dist2(ped.x, ped.z, p.x, p.z) < 6) {
      ped.x += (ped.x - p.x) * dt * 2; ped.z += (ped.z - p.z) * dt * 2;
    }
  }
}

function updatePolice(sim, dt, audio) {
  const p = sim.player;
  const wantCars = p.wanted >= 2 ? Math.min(3, p.wanted - 1) : 0;
  const wantFoot = p.wanted >= 1 ? Math.min(3, p.wanted) : 0;
  // Spawn police cars (ids from a counter, never from the clock).
  const cars = sim.cars.filter(c => c.police);
  while (cars.length < wantCars) {
    const c = makeCar(`pd${sim._policeSeq++}`, CAR_DEFS[5],
      p.x + sim.rng.range(35, 55) * (sim.rng.chance(0.5) ? 1 : -1),
      p.z + sim.rng.range(35, 55) * (sim.rng.chance(0.5) ? 1 : -1), 0);
    c.police = true; sim.cars.push(c); cars.push(c);
  }
  while (sim.policeFoot.length < wantFoot) {
    sim.policeFoot.push({ id: `officer${sim._policeSeq++}`,
      x: p.x + sim.rng.range(18, 28) * (sim.rng.chance(0.5) ? 1 : -1),
      z: p.z + sim.rng.range(18, 28) * (sim.rng.chance(0.5) ? 1 : -1),
      angle: 0, health: 60 });
  }
  // Police cars chase and ram; foot officers run at the player.
  for (const c of cars) {
    const a = Math.atan2(p.x - c.x, p.z - c.z);
    let da = a - c.angle;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    c.speed = CONFIG.policeCarSpeed;
    c.x += Math.sin(c.angle) * c.speed * dt;
    c.z += Math.cos(c.angle) * c.speed * dt;
    c.flash = (sim.time * 4) % 1 < 0.5 ? 1 : 0;
    if (dist2(c.x, c.z, p.x, p.z) < 3.5 && p.inCar) {
      p.inCar.speed *= 0.7;
      if (audio) audio.crash();
    }
  }
  for (const o of sim.policeFoot) {
    const d = dist2(o.x, o.z, p.x, p.z);
    const a = Math.atan2(p.x - o.x, p.z - o.z);
    o.angle = a;
    o.x += Math.sin(a) * CONFIG.policeFootSpeed * dt;
    o.z += Math.cos(a) * CONFIG.policeFootSpeed * dt;
    if (d < 2.2 && !p.inCar) {
      p.busted += dt;
      if (p.busted > 1.1) {
        const lost = Math.floor(p.cash * CONFIG.bustedCashLoss);
        p.cash -= lost; p.wanted = 0; p.busted = 0; p.health = CONFIG.playerHealth;
        p.x = sim.city.landmarks.garage.x; p.z = sim.city.landmarks.garage.z + 12;
        if (p.inCar) p.inCar = null;
        say(sim, `BUSTED! Verde PD took $${lost}. Back at the garage.`);
        if (audio) audio.busted();
      }
    } else p.busted = Math.max(0, p.busted - dt);
  }
  // Wanted decays when the player stays out of trouble and out of sight.
  p.crimeTimer += dt;
  if (p.wanted > 0 && p.crimeTimer > 14) {
    p.heatTimer += dt;
    if (p.heatTimer > 9) {
      p.wanted--; p.heatTimer = 0; p.crimeTimer = 0;
      say(sim, `Wanted down to ${p.wanted} star${p.wanted === 1 ? '' : 's'}.`);
    }
  }
  // Remove police when wanted is gone.
  if (p.wanted === 0) {
    sim.cars = sim.cars.filter(c => !c.police);
    sim.policeFoot = [];
  }
}

function updateRivals(sim, dt) {
  const p = sim.player;
  for (const r of sim.rivals) {
    if (!r.alive) continue;
    const d = dist2(r.x, r.z, p.x, p.z);
    if (d < 18) {
      const a = Math.atan2(p.x - r.x, p.z - r.z);
      r.angle = a;
      r.x += Math.sin(a) * 5.5 * dt; r.z += Math.cos(a) * 5.5 * dt;
      if (d < 2) { p.health -= 12 * dt; }
    }
  }
  if (sim.missionIndex === 3 && sim.rivals.length && sim.rivals.every(r => !r.alive)) {
    completeMission(sim);
  }
  if (p.health <= 0) {
    p.health = CONFIG.playerHealth; p.wanted = 0;
    p.x = sim.city.landmarks.garage.x; p.z = sim.city.landmarks.garage.z + 12;
    if (p.inCar) p.inCar = null;
    say(sim, 'You got knocked out — woke up at the garage.');
  }
}

function updateMissions(sim, dt) {
  const p = sim.player;
  const t = missionTarget(sim);
  const d = dist2(p.x, p.z, t.x, t.z);
  if (sim.missionIndex === 1) {
    sim.missionTimer -= dt;
    if (sim.missionTimer <= 0) {
      sim.missionTimer = CONFIG.mission2Seconds;
      say(sim, 'Too slow! The Package run restarts — 90 seconds again.');
    }
  }
  if (sim.missionIndex === 0 && p.inCar && d < 7) { completeMission(sim); return; }
  if (sim.missionIndex === 1 && d < 7) { completeMission(sim); return; }
  if (sim.missionIndex === 2 && p.wanted === 0) { completeMission(sim); return; }
  if (sim.missionIndex === 4 && sim.missionHits >= 3 && d < 7) { completeMission(sim); return; }
}

export function updateSim(sim, input, dt, audio) {
  if (sim.paused || !sim.started) return;
  sim.time += dt;
  const p = sim.player;
  if (p.inCar) updateDrive(sim, input, dt, audio);
  else updateFoot(sim, input, dt);
  updateTraffic(sim, dt);
  updatePeds(sim, dt);
  updatePolice(sim, dt, audio);
  updateRivals(sim, dt);
  updateMissions(sim, dt);
  if (audio) audio.setSiren(p.wanted > 0, p.wanted);
  sim.effects = sim.effects.filter(e => sim.time - e.t < 0.4);
}

export function saveGame(sim) {
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify({
      missionIndex: sim.missionIndex, cash: sim.player.cash,
    }));
  } catch { /* storage unavailable in some sandboxes */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
