// sim.js — Porto Verde simulation: player, cars, traffic, pedestrians,
// Verde PD wanted system, combat, busted, and the 5-mission chain.
// Pure logic: no DOM, no canvas, no AudioContext. The browser wires input
// and rendering around it; the playtest drives it directly in Node.

import { RNG, clamp, dist2, angleTo } from './random.js';
import { CONFIG, MISSIONS } from './config.js';
import { buildCity, roadCenter, PITCH } from './city.js';

export function wantedStars(heat) {
  if (heat < 20) return 0;
  if (heat < 45) return 1;
  if (heat < 80) return 2;
  if (heat < 130) return 3;
  if (heat < 190) return 4;
  return 5;
}

export function createGame(seed = CONFIG.CITY_SEED) {
  const city = buildCity(seed);
  const rng = new RNG(seed * 101 + 13);

  const state = {
    city,
    time: 0,
    status: 'title', // title | playing | paused | busted | won
    player: {
      x: city.spawn.x,
      y: city.spawn.y,
      angle: -Math.PI / 2,
      hp: CONFIG.PLAYER_HP,
      cash: CONFIG.START_CASH,
      ammo: CONFIG.MAG_SIZE,
      reserve: 48,
      inCar: null,
      jumping: 0,
      punchCooldown: 0,
      reloadTimer: 0,
      speed: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    enemies: [],
    pickups: [],
    heat: 0,
    wanted: 0,
    missionIndex: 0,
    mission: null,
    missionTimer: 0,
    missionFlash: '',
    message: '',
    messageTimer: 0,
    stats: { shots: 0, hits: 0, carsJacked: 0, pedsHit: 0, missionsDone: 0 },
    copSpawnTimer: 0,
    bustedTimer: 0,
  };

  // Traffic cars on the roads.
  for (let i = 0; i < CONFIG.TRAFFIC_CARS; i++) {
    const p = city.randomRoadPoint(rng);
    // Traffic on a vertical road runs north/south; on a horizontal one east/west.
    const onVertical = Math.abs(p.x % PITCH - CONFIG.ROAD_PX / 2) < 4;
    state.cars.push({
      id: 'car-' + i,
      x: p.x,
      y: p.y,
      angle: onVertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(90, 150),
      color: rng.pick(city.carPalette),
      driver: 'traffic',
      parked: rng.chance(0.25),
    });
  }

  // Pedestrians on sidewalks (near road edges).
  for (let i = 0; i < CONFIG.PEDS; i++) {
    const p = city.randomRoadPoint(rng);
    state.peds.push({
      id: 'ped-' + i,
      x: p.x + rng.range(-30, 30),
      y: p.y + rng.range(-30, 30),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(35, 70),
      color: rng.pick(['#d8d8d8', '#e74c3c', '#3498db', '#f1c40f', '#1abc9c']),
      walking: true,
    });
  }

  startMission(state, 0);
  return state;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  state.missionIndex = index;
  state.mission = {
    id: def.id,
    name: def.name,
    brief: def.brief,
    reward: def.reward,
    stage: 0,
    done: false,
  };
  state.missionTimer = 0;
  state.enemies = [];
  state.pickups = [];
  const c = state.city;

  if (def.id === 'the-package') {
    state.pickups.push({ id: 'package', kind: 'package', x: c.packageSpot.x, y: c.packageSpot.y, taken: false });
  }
  if (def.id === 'rooftop-rumble') {
    const r = c.rooftop;
    for (let i = 0; i < 4; i++) {
      state.enemies.push({
        id: 'crew-' + i,
        x: r.x + 40 + (i % 2) * 140,
        y: r.y + 40 + Math.floor(i / 2) * 140,
        angle: 0,
        hp: 60,
        shootTimer: 1 + i * 0.4,
        alive: true,
      });
    }
  }
  flash(state, def.name + ' — ' + def.brief);
}

export function flash(state, text, dur = 4) {
  state.message = text;
  state.messageTimer = dur;
}

export function missionTarget(state) {
  const c = state.city;
  const m = state.mission;
  if (!m) return null;
  switch (m.id) {
    case 'wheels-up':
      return m.stage === 0 ? null : { x: c.deliverySpot.x, y: c.deliverySpot.y, label: 'Drive here' };
    case 'the-package':
      if (m.stage === 0) return { x: c.packageSpot.x, y: c.packageSpot.y, label: 'Pick up the package' };
      return { x: c.deliverySpot.x, y: c.deliverySpot.y, label: 'Deliver it!' };
    case 'heat-check':
      return null;
    case 'rooftop-rumble':
      return { x: c.rooftop.x + c.rooftop.w / 2, y: c.rooftop.y + c.rooftop.h / 2, label: 'Rooftop' };
    case 'marlins-due':
      return { x: c.marina.x + 210, y: c.marina.y + 60, label: 'The Marina' };
    default:
      return null;
  }
}

export function addHeat(state, amount) {
  state.heat = clamp(state.heat + amount, 0, 220);
  state.wanted = wantedStars(state.heat);
}

export function completeMission(state) {
  const m = state.mission;
  if (!m || m.done) return;
  m.done = true;
  state.player.cash += m.reward;
  state.stats.missionsDone++;
  flash(state, m.name + ' complete! +$' + m.reward, 4);
  if (state.missionIndex + 1 >= MISSIONS.length) {
    state.status = 'won';
    return;
  }
  startMission(state, state.missionIndex + 1);
}

export function getBusted(state) {
  const loss = Math.floor(state.player.cash * CONFIG.BUSTED_CASH_LOSS);
  state.player.cash -= loss;
  state.player.hp = CONFIG.PLAYER_HP;
  state.heat = 0;
  state.wanted = 0;
  state.cops = [];
  state.bullets = [];
  const h = state.city.hospital;
  state.player.x = h.x + h.w / 2;
  state.player.y = h.y + h.h + 40;
  state.player.inCar = null;
  state.status = 'busted';
  state.bustedTimer = 3;
  flash(state, 'BUSTED! Verde PD took $' + loss + ' (-10%).', 3);
  return loss;
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function tryEnterCar(state) {
  const p = state.player;
  if (p.inCar) {
    const car = state.cars.find((c) => c.id === p.inCar);
    if (car) {
      p.x = car.x + 30;
      p.y = car.y + 30;
      car.driver = 'none';
    }
    p.inCar = null;
    return 'exit';
  }
  const car = nearestCar(state, p.x, p.y, 56);
  if (!car) return null;
  if (car.driver === 'traffic') {
    addHeat(state, CONFIG.HEAT_PER_CARJACK);
    state.stats.carsJacked++;
    flash(state, 'Car jacked! Verde PD noticed.', 2.5);
  }
  car.driver = 'player';
  p.inCar = car.id;
  return 'enter';
}

export function shoot(state) {
  const p = state.player;
  if (p.reloadTimer > 0 || p.ammo <= 0) return false;
  p.ammo--;
  state.stats.shots++;
  const a = p.angle;
  state.bullets.push({
    x: p.x + Math.cos(a) * 20,
    y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * CONFIG.BULLET_SPEED,
    vy: Math.sin(a) * CONFIG.BULLET_SPEED,
    life: 1.2,
    from: 'player',
  });
  addHeat(state, CONFIG.HEAT_PER_SHOT);
  return true;
}

export function punch(state) {
  const p = state.player;
  if (p.punchCooldown > 0) return false;
  p.punchCooldown = CONFIG.PUNCH_COOLDOWN;
  const reach = CONFIG.PUNCH_RANGE;
  const px = p.x + Math.cos(p.angle) * reach;
  const py = p.y + Math.sin(p.angle) * reach;
  for (const ped of state.peds) {
    if (dist2(px, py, ped.x, ped.y) < 26 * 26) {
      ped.walking = false;
      ped.flee = 2;
      addHeat(state, CONFIG.HEAT_PER_PED_HIT);
      state.stats.pedsHit++;
      flash(state, 'You hit a pedestrian! Verde PD noticed.', 2);
      return true;
    }
  }
  for (const e of state.enemies) {
    if (e.alive && dist2(px, py, e.x, e.y) < 30 * 30) {
      e.hp -= CONFIG.PUNCH_DAMAGE;
      if (e.hp <= 0) e.alive = false;
      return true;
    }
  }
  return false;
}

export function reload(state) {
  const p = state.player;
  if (p.reloadTimer > 0 || p.ammo >= CONFIG.MAG_SIZE || p.reserve <= 0) return false;
  p.reloadTimer = CONFIG.RELOAD_TIME;
  return true;
}

function moveWithCollision(state, ent, dx, dy, radius) {
  const nx = ent.x + dx;
  const ny = ent.y + dy;
  if (!state.city.pointInBuilding(nx, ent.y)) ent.x = nx;
  if (!state.city.pointInBuilding(ent.x, ny)) ent.y = ny;
  const c = state.city.clampToCity(ent.x, ent.y, radius);
  ent.x = c.x;
  ent.y = c.y;
}

export function update(state, input, dt) {
  if (state.status !== 'playing') return;
  dt = Math.min(dt, 0.05);
  state.time += dt;
  const p = state.player;
  const city = state.city;

  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      const need = CONFIG.MAG_SIZE - p.ammo;
      const take = Math.min(need, p.reserve);
      p.ammo += take;
      p.reserve -= take;
    }
  }
  if (p.jumping > 0) p.jumping -= dt;

  // Heat decays when the player keeps a low profile.
  if (state.wanted > 0) {
    state.heat = Math.max(0, state.heat - CONFIG.HEAT_DECAY_PER_SEC * dt);
    state.wanted = wantedStars(state.heat);
  }

  // --- Player movement ---
  const car = p.inCar ? state.cars.find((c) => c.id === p.inCar) : null;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const mag = Math.hypot(mx, my) || 1;
  mx /= mag;
  my /= mag;

  if (car) {
    // Driving: W/S throttle, A/D steer relative to the car's heading.
    const throttle = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const moving = Math.abs(car.speed) > 5;
    if (throttle !== 0) {
      car.speed += throttle * CONFIG.CAR_ACCEL * dt;
      car.speed = clamp(car.speed, -CONFIG.CAR_REVERSE_SPEED, CONFIG.CAR_TOP_SPEED);
    } else {
      car.speed *= Math.pow(0.4, dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    if (moving) car.angle += steer * CONFIG.CAR_TURN * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
    moveWithCollision(state, car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, CONFIG.CAR_RADIUS);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    // Running over pedestrians in a car draws heat.
    for (const ped of state.peds) {
      if (ped.walking && dist2(car.x, car.y, ped.x, ped.y) < 30 * 30 && Math.abs(car.speed) > 80) {
        ped.walking = false;
        ped.flee = 3;
        addHeat(state, CONFIG.HEAT_PER_PED_HIT);
        state.stats.pedsHit++;
      }
    }
  } else {
    const speed = input.run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
    if (mx !== 0 || my !== 0) {
      p.angle = Math.atan2(my, mx);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    moveWithCollision(state, p, mx * speed * dt, my * speed * dt, CONFIG.PLAYER_RADIUS);
    if (input.jump && p.jumping <= 0) p.jumping = CONFIG.JUMP_TIME;
  }

  // --- Traffic ---
  for (const c of state.cars) {
    if (c.driver !== 'traffic' || c.parked) continue;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Turn around at the city edge, stay on roads.
    if (c.x < 30 || c.x > city.size - 30 || c.y < 30 || c.y > city.size - 30) {
      c.angle += Math.PI;
    }
    if (city.pointInBuilding(c.x, c.y)) c.angle += Math.PI / 2;
  }

  // --- Pedestrians ---
  for (const ped of state.peds) {
    if (!ped.walking) {
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = angleTo(p.x, p.y, ped.x, ped.y);
        ped.x += Math.cos(a) * 120 * dt;
        ped.y += Math.sin(a) * 120 * dt;
        if (ped.flee <= 0) ped.walking = true;
      }
      continue;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (city.pointInBuilding(ped.x, ped.y) || ped.x < 20 || ped.y < 20 || ped.x > city.size - 20 || ped.y > city.size - 20) {
      ped.angle += Math.PI / 2 + (Math.random() - 0.5);
    }
  }

  // --- Cops ---
  const wantCops = Math.min(state.wanted, 5);
  state.copSpawnTimer -= dt;
  if (state.cops.length < wantCops && state.copSpawnTimer <= 0) {
    state.copSpawnTimer = CONFIG.COP_SPAWN_INTERVAL / Math.max(1, wantCops);
    const a = Math.random() * Math.PI * 2;
    state.cops.push({
      x: clamp(p.x + Math.cos(a) * 520, 30, city.size - 30),
      y: clamp(p.y + Math.sin(a) * 520, 30, city.size - 30),
      angle: 0,
      speed: CONFIG.COP_SPEED + state.wanted * 12,
    });
  }
  for (const cop of state.cops) {
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    if (dist2(cop.x, cop.y, p.x, p.y) < 30 * 30) {
      getBusted(state);
      return;
    }
  }
  if (state.wanted === 0 && state.cops.length > 0) {
    state.cops = state.cops.filter((c) => dist2(c.x, c.y, p.x, p.y) < 500 * 500);
  }

  // --- Bullets ---
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (city.pointInBuilding(b.x, b.y)) b.life = 0;
    if (b.from === 'player') {
      for (const e of state.enemies) {
        if (e.alive && dist2(b.x, b.y, e.x, e.y) < 22 * 22) {
          e.hp -= CONFIG.BULLET_DAMAGE;
          state.stats.hits++;
          if (e.hp <= 0) e.alive = false;
          b.life = 0;
          break;
        }
      }
      for (const cop of state.cops) {
        if (dist2(b.x, b.y, cop.x, cop.y) < 24 * 24) {
          addHeat(state, 12);
          b.life = 0;
          break;
        }
      }
    } else if (dist2(b.x, b.y, p.x, p.y) < 18 * 18 && p.jumping <= 0) {
      p.hp -= 12;
      b.life = 0;
      if (p.hp <= 0) {
        getBusted(state);
        return;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  // --- Enemies shoot back (rooftop) ---
  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.shootTimer -= dt;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.shootTimer <= 0 && d < 520) {
      e.shootTimer = 1.6;
      const a = angleTo(e.x, e.y, p.x, p.y) + (Math.random() - 0.5) * 0.2;
      state.bullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
        life: 1.4, from: 'enemy',
      });
    }
  }

  // --- Pickups ---
  for (const pk of state.pickups) {
    if (!pk.taken && dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      pk.taken = true;
      if (state.mission && state.mission.id === 'the-package' && state.mission.stage === 0) {
        state.mission.stage = 1;
        state.missionTimer = CONFIG.PACKAGE_TIME_LIMIT;
        flash(state, 'Package secured! Deliver it in 90 seconds!', 3);
      }
    }
  }

  // --- Mission objectives ---
  const m = state.mission;
  if (m) {
    state.missionTimer = m.id === 'the-package' && m.stage === 1 ? state.missionTimer - dt : state.missionTimer;
    if (m.id === 'wheels-up') {
      if (m.stage === 0 && p.inCar) {
        m.stage = 1;
        flash(state, 'Nice wheels. Now drive to the yellow marker.', 3);
      } else if (m.stage === 1) {
        const t = missionTarget(state);
        if (t && dist2(p.x, p.y, t.x, t.y) < 46 * 46) completeMission(state);
      }
    } else if (m.id === 'the-package') {
      if (m.stage === 1) {
        if (state.missionTimer <= 0) {
          flash(state, 'Too slow! The package run reset.', 3);
          startMission(state, state.missionIndex);
        } else {
          const t = missionTarget(state);
          if (t && dist2(p.x, p.y, t.x, t.y) < 46 * 46) completeMission(state);
        }
      }
    } else if (m.id === 'heat-check') {
      if (m.stage === 0 && state.wanted >= 3) {
        m.stage = 1;
        flash(state, '3 stars! Now shake Verde PD — get back to 0.', 3);
      } else if (m.stage === 1 && state.wanted === 0) {
        completeMission(state);
      }
    } else if (m.id === 'rooftop-rumble') {
      if (state.enemies.length > 0 && state.enemies.every((e) => !e.alive)) {
        completeMission(state);
      }
    } else if (m.id === 'marlins-due') {
      const t = missionTarget(state);
      if (t && dist2(p.x, p.y, t.x, t.y) < 50 * 50) completeMission(state);
    }
  }

  // Player death by any other means also means busted.
  if (p.hp <= 0 && state.status === 'playing') {
    getBusted(state);
  }
}

export function saveGame(state, storage) {
  const data = {
    version: 1,
    cash: state.player.cash,
    missionIndex: state.missionIndex,
    hp: state.player.hp,
    ammo: state.player.ammo,
    reserve: state.player.reserve,
    x: state.player.x,
    y: state.player.y,
    stats: state.stats,
  };
  try {
    storage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(state, data) {
  if (!data) return false;
  state.player.cash = data.cash;
  state.player.hp = data.hp;
  state.player.ammo = data.ammo;
  state.player.reserve = data.reserve;
  state.player.x = data.x;
  state.player.y = data.y;
  state.stats = { ...state.stats, ...data.stats };
  startMission(state, Math.min(data.missionIndex, MISSIONS.length - 1));
  return true;
}
