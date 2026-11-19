// Porto Verde simulation: the player, cars, traffic, pedestrians, police,
// the wanted level, the five missions and combat. The renderer only draws
// what this module owns — all rules live here.
import * as THREE from 'three';
import { BLOCK, CAR, CAR_NAMES, CITY_HALF, COLORS, MISSIONS, PITCH, PLACES, PLAYER, SAVE_KEY, STREET, WANTED } from './config.js';
import { createRandom } from './random.js';
import { clampToWorld, collideCircle, createCity } from './city.js';

const TAU = Math.PI * 2;

function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function makeBox(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function createGame(audio) {
  const rng = createRandom(1337);
  const city = createCity(THREE);
  const worldGroup = new THREE.Group();
  worldGroup.add(city.group);

  // --- shared state -------------------------------------------------------------
  const state = {
    mode: 'title', // title | play | paused | busted | wasted | end
    time: 0,
    cash: 0,
    wanted: 0,
    wantedTimer: 0,
    health: PLAYER.health,
    ammo: PLAYER.magSize,
    reloading: 0,
    missionIndex: 0,
    missionPhase: 'idle',
    missionTimer: 0,
    missionKills: 0,
    messages: [],
    bustedReason: '',
    stats: { carsStolen: 0, shots: 0, hits: 0 },
  };

  const player = {
    x: PLACES.garage.x - 4, z: PLACES.garage.z + 6, y: 0,
    vx: 0, vz: 0, angle: Math.PI, vy: 0, grounded: true,
    health: PLAYER.health, inCar: null, punchCd: 0, shootCd: 0,
    walkPhase: 0, moving: false,
  };

  // --- mission beacon: light column + ground ring ---------------------------------
  const beacon = new THREE.Group();
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beaconCyl = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true), beaconMat);
  beaconCyl.position.y = 20;
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = 0.4;
  beacon.add(beaconCyl);
  beacon.add(beaconRing);
  beacon.visible = false;
  worldGroup.add(beacon);
  const beaconPos = { x: 0, z: 0, active: false };

  function setBeacon(x, z, active) {
    beaconPos.x = x;
    beaconPos.z = z;
    beaconPos.active = active;
    beacon.position.set(x, 0, z);
    beacon.visible = active;
  }

  function message(text) {
    state.messages.push({ text, t: state.time });
    if (state.messages.length > 5) state.messages.shift();
  }

  function addWanted(n, why) {
    const before = state.wanted;
    state.wanted = Math.max(0, Math.min(WANTED.max, state.wanted + n));
    state.wantedTimer = 0;
    if (state.wanted > before) {
      message(`WANTED +${state.wanted - before} — ${why}`);
      audio.wantedUp();
    }
  }

  // --- cars -----------------------------------------------------------------------
  const cars = [];
  const carBodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.2);
  const carCabinGeo = new THREE.BoxGeometry(1.6, 0.55, 2.1);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);

  function buildCarMesh(color, isPolice) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(carBodyGeo, new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(carCabinGeo, new THREE.MeshLambertMaterial({ color: 0x1a2028 }));
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    g.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const wheels = [];
    for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      g.add(w);
      wheels.push(w);
    }
    const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.6 });
    const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x661111, emissiveIntensity: 0.5 });
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
      h.position.set(s * 0.6, 0.6, 2.12);
      g.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
      t.position.set(s * 0.6, 0.6, -2.12);
      g.add(t);
    }
    if (isPolice) {
      const bar = new THREE.Group();
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      red.position.x = -0.35;
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
      blue.position.x = 0.35;
      bar.add(red);
      bar.add(blue);
      bar.position.y = 1.5;
      g.add(bar);
      g.userData.lightBar = { red, blue };
    }
    return { group: g, wheels };
  }

  function addCar(x, z, angle, opts = {}) {
    const picked = opts.name ? [opts.name, opts.color] : CAR_NAMES[Math.floor(rng.next() * CAR_NAMES.length)];
    const built = buildCarMesh(picked[1], !!opts.police);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = angle;
    worldGroup.add(built.group);
    const car = {
      x, z, angle, speed: 0, health: 100,
      name: picked[0], color: picked[1], mesh: built.group, wheels: built.wheels,
      parked: !!opts.parked, police: !!opts.police, target: !!opts.target,
      traffic: opts.traffic || null, disabled: false, smoke: 0,
    };
    cars.push(car);
    return car;
  }

  // Parked cars to steal, from the city's spawn points.
  const parkedCars = [];
  for (const s of city.carSpawns) parkedCars.push(addCar(s.x, s.z, s.angle, { parked: true }));

  // Traffic cars on the road network.
  const trafficCars = [];
  function spawnTraffic() {
    const line = city.roadLines[Math.floor(rng.next() * city.roadLines.length)];
    const axis = rng.next() < 0.5 ? 'x' : 'z';
    const dir = rng.next() < 0.5 ? 1 : -1;
    const pos = (rng.next() * 2 - 1) * (CITY_HALF - 20);
    const car = addCar(0, 0, 0, {});
    car.traffic = { axis, line, dir, pos, speed: CAR.trafficSpeed * rng.range(0.8, 1.15) };
    car.parked = false;
    trafficCars.push(car);
    return car;
  }
  for (let i = 0; i < 12; i += 1) spawnTraffic();

  // --- pedestrians ------------------------------------------------------------------
  const peds = [];
  const pedShirts = [0xc25a4a, 0x4a7ac2, 0x5aa04a, 0xc2a24a, 0x8a5ac2, 0x4ac2b8, 0xd0d0d0];

  function buildPersonMesh(shirt, pants, skin) {
    const g = new THREE.Group();
    const torso = makeBox(0.62, 0.7, 0.34, shirt, 0, 1.05, 0);
    const head = makeBox(0.36, 0.36, 0.36, skin, 0, 1.6, 0);
    const legL = makeBox(0.24, 0.7, 0.26, pants, -0.16, 0.35, 0);
    const legR = makeBox(0.24, 0.7, 0.26, pants, 0.16, 0.35, 0);
    const armL = makeBox(0.18, 0.62, 0.2, shirt, -0.42, 1.05, 0);
    const armR = makeBox(0.18, 0.62, 0.2, shirt, 0.42, 1.05, 0);
    g.add(torso, head, legL, legR, armL, armR);
    g.userData = { legL, legR, armL, armR, head };
    return g;
  }

  function addPed(x, z, opts = {}) {
    const mesh = buildPersonMesh(
      opts.shirt ?? pedShirts[Math.floor(rng.next() * pedShirts.length)],
      opts.pants ?? 0x2a2f3a,
      opts.skin ?? 0xc89878,
    );
    mesh.position.set(x, 0, z);
    worldGroup.add(mesh);
    const ped = {
      x, z, angle: rng.next() * TAU, speed: rng.range(1.2, 2.0),
      state: opts.state || 'walk', health: opts.health || 100,
      mesh, down: 0, fleeX: 0, fleeZ: 0, hitCd: 0,
      rival: !!opts.rival, police: !!opts.police,
      walkPhase: rng.next() * TAU, road: null,
    };
    peds.push(ped);
    return ped;
  }

  // Give a strolling ped a sidewalk to follow: the nearest road line, one side.
  function assignRoad(ped) {
    const lines = city.roadLines;
    const lx = lines.reduce((b, l) => (Math.abs(ped.x - l) < Math.abs(ped.x - b) ? l : b), lines[0]);
    const lz = lines.reduce((b, l) => (Math.abs(ped.z - l) < Math.abs(ped.z - b) ? l : b), lines[0]);
    if (Math.abs(ped.x - lx) < Math.abs(ped.z - lz)) {
      ped.road = { axis: 'z', line: lx, dir: rng.next() < 0.5 ? 1 : -1, pos: ped.z, side: ped.x > lx ? 1 : -1, blendT: 1, blendFrom: ped.x };
    } else {
      ped.road = { axis: 'x', line: lz, dir: rng.next() < 0.5 ? 1 : -1, pos: ped.x, side: ped.z > lz ? 1 : -1, blendT: 1, blendFrom: ped.z };
    }
  }

  for (const s of city.pedSpawns.slice(0, 26)) {
    const ped = addPed(s.x + (rng.next() - 0.5) * 4, s.z + (rng.next() - 0.5) * 4);
    assignRoad(ped);
  }

  // --- player mesh --------------------------------------------------------------------
  const playerMesh = buildPersonMesh(0x2f8a7a, 0x2a2f3a, 0xc89878);
  worldGroup.add(playerMesh);

  // --- health pickups -------------------------------------------------------------------
  const pickups = [];
  const pickupSpots = [
    { x: PLACES.hospital.x, z: PLACES.hospital.z - 12 },
    { x: PLACES.plaza.x + 14, z: PLACES.plaza.z },
    { x: -PITCH * 2, z: 0 },
    { x: PITCH * 2, z: PITCH },
  ];
  for (const s of pickupSpots) {
    const g = new THREE.Group();
    const box = makeBox(0.9, 0.9, 0.9, 0xffffff, 0, 0.6, 0);
    const crossH = makeBox(0.6, 0.2, 0.05, 0x2fae4e, 0, 0.6, 0.48);
    const crossV = makeBox(0.2, 0.6, 0.05, 0x2fae4e, 0, 0.6, 0.48);
    g.add(box, crossH, crossV);
    g.position.set(s.x, 0, s.z);
    worldGroup.add(g);
    pickups.push({ x: s.x, z: s.z, mesh: g, respawn: 0 });
  }

  // --- bullet tracers ---------------------------------------------------------------------
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  function spawnTracer(from, to) {
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (len < 0.1) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), tracerMat);
    m.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    m.lookAt(to.x, to.y, to.z);
    worldGroup.add(m);
    tracers.push({ mesh: m, life: 0.09 });
  }

  // --- police --------------------------------------------------------------------------------
  const policeCars = [];
  const policePeds = [];
  let policeSpawnTimer = 0;

  function spawnPoliceCar() {
    const car = addCar(PLACES.policeStation.x + 8, PLACES.policeStation.z + 8, 0, { name: 'VPD Interceptor', color: COLORS.police, police: true });
    car.parked = false;
    policeCars.push(car);
    return car;
  }
  function spawnPolicePed() {
    const a = rng.next() * TAU;
    const ped = addPed(player.x + Math.cos(a) * 14, player.z + Math.sin(a) * 14, { shirt: 0x1c2f57, pants: 0x14181f, state: 'chase', health: 100, police: true });
    policePeds.push(ped);
    return ped;
  }

  // --- rivals (mission 4) -----------------------------------------------------------------------
  const rivals = [];
  function spawnRivals() {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * TAU;
      const ped = addPed(PLACES.plaza.x + Math.cos(a) * 8, PLACES.plaza.z + Math.sin(a) * 8, {
        shirt: 0x8a1f1f, pants: 0x1a1a1a, state: 'rival', health: 60, rival: true,
      });
      // Health bar above the head: dark back, green front that shrinks.
      const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x331111, depthTest: false }));
      back.scale.set(1.6, 0.18, 1);
      back.position.y = 2.1;
      const front = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x37d67a, depthTest: false }));
      front.scale.set(1.6, 0.18, 1);
      front.position.y = 2.1;
      ped.mesh.add(back);
      ped.mesh.add(front);
      ped.healthBar = front;
      rivals.push(ped);
    }
  }

  // --- target car (mission 5) ----------------------------------------------------------------------
  let targetCar = null;
  function spawnTargetCar() {
    targetCar = addCar(PITCH * 2 + 20, -PITCH, Math.PI / 2, { name: 'Verde Coupe', color: 0x2f8a2f, target: true });
    targetCar.parked = false;
    targetCar.traffic = { axis: 'x', line: -PITCH, dir: 1, pos: PITCH * 2 + 20, speed: 20 };
    targetCar.health = 100;
  }

  // --- missions ---------------------------------------------------------------------------------------
  function currentMission() { return MISSIONS[state.missionIndex] || null; }

  function startMission(index) {
    const m = MISSIONS[index];
    if (!m) {
      state.missionPhase = 'done';
      setBeacon(0, 0, false);
      return;
    }
    state.missionIndex = index;
    state.missionTimer = m.timeLimit || 0;
    state.missionKills = 0;
    if (m.kind === 'steal-deliver') {
      state.missionPhase = 'steal';
      setBeacon(0, 0, false);
      message(`${m.name}: ${m.text}`);
    } else if (m.kind === 'timed-deliver') {
      state.missionPhase = player.inCar ? 'deliver' : 'getcar';
      setBeacon(PLACES.marlinClub.x, PLACES.marlinClub.z, true);
      message(`${m.name}: ${m.text}`);
    } else if (m.kind === 'lose-wanted') {
      state.missionPhase = 'evade';
      state.wanted = 2;
      state.wantedTimer = 0;
      spawnPoliceCar();
      spawnPoliceCar();
      setBeacon(0, 0, false);
      message(`${m.name}: ${m.text}`);
    } else if (m.kind === 'defeat') {
      state.missionPhase = 'goto';
      spawnRivals();
      setBeacon(PLACES.plaza.x, PLACES.plaza.z, true);
      message(`${m.name}: ${m.text}`);
    } else if (m.kind === 'ram-target') {
      state.missionPhase = 'hunt';
      spawnTargetCar();
      setBeacon(0, 0, false);
      message(`${m.name}: ${m.text}`);
    }
  }

  function completeMission() {
    const m = currentMission();
    if (!m) return;
    state.cash += m.reward;
    audio.missionDone();
    message(`MISSION COMPLETE — ${m.name}  +$${m.reward}`);
    state.missionIndex += 1;
    saveGame(); // save AFTER the index moves, so Continue resumes the next job
    if (state.missionIndex >= MISSIONS.length) {
      state.missionPhase = 'done';
      setBeacon(0, 0, false);
      message('STORY COMPLETE — Porto Verde is yours, Dante. Thanks for playing.');
    } else {
      startMission(state.missionIndex);
    }
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, missionIndex: state.missionIndex }));
    } catch { /* storage can be off */ }
  }
  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  // --- combat ----------------------------------------------------------------------------------
  // Ray vs people (sphere at chest height), cars (sphere at centre) and
  // buildings (AABB slab test). Returns the nearest hit, or null.
  function rayHit(origin, dir, maxDist) {
    let best = null;
    function consider(dist, kind, obj, point) {
      if (dist < 0 || dist > maxDist) return;
      if (!best || dist < best.dist) best = { dist, kind, obj, point };
    }
    for (const ped of peds) {
      if (ped.down > 0) continue;
      const cx = ped.x - origin.x; const cy = 1.2 - origin.y; const cz = ped.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0) continue;
      const px = origin.x + dir.x * t; const py = origin.y + dir.y * t; const pz = origin.z + dir.z * t;
      const d2 = (px - ped.x) ** 2 + (py - 1.2) ** 2 + (pz - ped.z) ** 2;
      if (d2 < 0.81) consider(t, 'ped', ped, { x: px, y: py, z: pz });
    }
    for (const car of cars) {
      if (car === player.inCar) continue;
      const cx = car.x - origin.x; const cy = 0.8 - origin.y; const cz = car.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0) continue;
      const px = origin.x + dir.x * t; const py = origin.y + dir.y * t; const pz = origin.z + dir.z * t;
      const d2 = (px - car.x) ** 2 + (py - 0.8) ** 2 + (pz - car.z) ** 2;
      if (d2 < 4.84) consider(t, 'car', car, { x: px, y: py, z: pz });
    }
    for (const b of city.colliders) {
      if (origin.x > b.minX && origin.x < b.maxX && origin.z > b.minZ && origin.z < b.maxZ) continue;
      let tmin = 0;
      let tmax = maxDist;
      const o = [origin.x, origin.z];
      const d = [dir.x, dir.z];
      const mn = [b.minX, b.minZ];
      const mx = [b.maxX, b.maxZ];
      let ok = true;
      for (let a = 0; a < 2; a += 1) {
        if (Math.abs(d[a]) < 1e-6) {
          if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; }
          continue;
        }
        let t1 = (mn[a] - o[a]) / d[a];
        let t2 = (mx[a] - o[a]) / d[a];
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin < maxDist && origin.y + dir.y * tmin < 30) {
        consider(tmin, 'wall', null, { x: origin.x + dir.x * tmin, y: origin.y + dir.y * tmin, z: origin.z + dir.z * tmin });
      }
    }
    return best;
  }

  function shoot(camPos, camDir) {
    if (state.reloading > 0 || player.shootCd > 0 || player.inCar) return;
    if (state.ammo <= 0) {
      state.reloading = PLAYER.reloadTime;
      message('Reloading…');
      return;
    }
    player.shootCd = PLAYER.pistolCooldown;
    state.ammo -= 1;
    state.stats.shots += 1;
    audio.gunshot();
    // Gunfire draws the law, but one burst is one alarm — not a star per bullet.
    if (state.time - (state.lastShotAlarm || -99) > 10) {
      state.lastShotAlarm = state.time;
      addWanted(1, 'shots fired');
    }
    const origin = { x: camPos.x, y: camPos.y, z: camPos.z };
    const hit = rayHit(origin, camDir, PLAYER.pistolRange);
    const end = hit
      ? hit.point
      : { x: origin.x + camDir.x * PLAYER.pistolRange, y: origin.y + camDir.y * PLAYER.pistolRange, z: origin.z + camDir.z * PLAYER.pistolRange };
    spawnTracer({ x: player.x, y: 1.4, z: player.z }, end);
    if (!hit) return;
    state.stats.hits += 1;
    if (hit.kind === 'ped') {
      const ped = hit.obj;
      ped.health -= PLAYER.pistolDamage;
      if (ped.health <= 0) {
        ped.down = 12;
        ped.state = 'down';
        if (ped.rival) {
          state.missionKills += 1;
          message(`Rival down (${state.missionKills}/3)`);
        } else {
          addWanted(1, 'pedestrian down');
        }
      } else if (!ped.police) {
        ped.state = 'flee';
        ped.fleeX = player.x;
        ped.fleeZ = player.z;
      }
    } else if (hit.kind === 'car') {
      const car = hit.obj;
      car.health -= PLAYER.pistolDamage;
      if (car.health <= 0 && !car.disabled) {
        car.disabled = true;
        car.speed = 0;
        message(`${car.name} disabled`);
      }
    }
  }

  function punch() {
    if (player.punchCd > 0 || player.inCar) return;
    player.punchCd = PLAYER.punchCooldown;
    audio.punch();
    const fx = Math.sin(player.angle);
    const fz = Math.cos(player.angle);
    for (const ped of peds) {
      if (ped.down > 0) continue;
      const dx = ped.x - player.x;
      const dz = ped.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < PLAYER.punchRange && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
        ped.health -= PLAYER.punchDamage;
        if (ped.health <= 0) {
          ped.down = 12;
          ped.state = 'down';
          if (ped.rival) {
            state.missionKills += 1;
            message(`Rival down (${state.missionKills}/3)`);
          }
        } else if (ped.police) {
          addWanted(1, 'assaulted an officer');
        } else {
          ped.state = 'flee';
          ped.fleeX = player.x;
          ped.fleeZ = player.z;
        }
      }
    }
  }

  // --- car entry / exit ------------------------------------------------------------------------
  function nearestParkedCar(maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of parkedCars) {
      if (car.disabled) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    player.inCar = car;
    car.parked = false;
    state.stats.carsStolen += 1;
    audio.pickup();
    message(`You took the ${car.name}`);
    const nearCop = policeCars.some((c) => dist2(c.x, c.z, player.x, player.z) < 900)
      || policePeds.some((p) => dist2(p.x, p.z, player.x, player.z) < 900);
    if (nearCop) addWanted(1, 'carjacking witnessed');
    if (currentMission() && currentMission().kind === 'steal-deliver' && state.missionPhase === 'steal') {
      state.missionPhase = 'deliver';
      setBeacon(PLACES.garage.x, PLACES.garage.z, true);
      message('Now bring it to the garage');
    } else if (currentMission() && currentMission().kind === 'timed-deliver' && state.missionPhase === 'getcar') {
      state.missionPhase = 'deliver';
      state.missionTimer = currentMission().timeLimit;
    }
    playerMesh.visible = false;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    player.inCar = null;
    const bx = Math.sin(car.angle);
    const bz = Math.cos(car.angle);
    player.x = car.x - bx * 2.2;
    player.z = car.z - bz * 2.2;
    player.y = 0;
    player.vy = 0;
    const c = collideCircle(city.colliders, player.x, player.z, PLAYER.radius);
    player.x = c.x;
    player.z = c.z;
    playerMesh.visible = true;
  }

  // --- respawn after busted / wasted -------------------------------------------------------------
  function respawn(where) {
    state.wanted = 0;
    state.wantedTimer = 0;
    state.health = PLAYER.health;
    player.health = PLAYER.health;
    state.ammo = PLAYER.magSize;
    state.cash = Math.floor(state.cash * 0.9);
    for (const c of policeCars) c.mesh.visible = false;
    policeCars.length = 0;
    for (const p of policePeds) {
      p.mesh.visible = false;
      peds.splice(peds.indexOf(p), 1);
    }
    policePeds.length = 0;
    if (player.inCar) {
      player.inCar = null;
      playerMesh.visible = true;
    }
    const spot = where === 'hospital' ? PLACES.hospital : PLACES.garage;
    player.x = spot.x;
    player.z = spot.z + 8;
    player.y = 0;
    playerMesh.position.set(player.x, 0, player.z);
    state.mode = 'play';
    message(where === 'hospital' ? 'You woke up at St. Verde. The bill stings.' : 'Verde PD let you go. This time.');
    saveGame();
  }

  // --- per-frame steps -----------------------------------------------------------------------------
  function stepPlayer(dt, input) {
    if (player.inCar) return;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0;
    let mz = 0;
    const sy = Math.sin(input.camYaw);
    const cy = Math.cos(input.camYaw);
    if (input.fwd) { mx += -sy; mz += -cy; }
    if (input.back) { mx += sy; mz += cy; }
    if (input.left) { mx += -cy; mz += sy; }
    if (input.right) { mx += cy; mz += -sy; }
    const len = Math.hypot(mx, mz);
    player.moving = len > 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      player.angle = angleLerp(player.angle, Math.atan2(mx, mz), Math.min(1, dt * 12));
      player.vx = mx * speed;
      player.vz = mz * speed;
      player.walkPhase += dt * speed * 1.6;
    } else {
      player.vx *= Math.max(0, 1 - dt * 10);
      player.vz *= Math.max(0, 1 - dt * 10);
    }
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    if (input.jump && player.grounded) {
      player.vy = PLAYER.jumpSpeed;
      player.grounded = false;
    }
    player.vy -= PLAYER.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
    const c = collideCircle(city.colliders, player.x, player.z, PLAYER.radius);
    player.x = c.x;
    player.z = c.z;
    const cl = clampToWorld(player.x, player.z);
    player.x = cl.x;
    player.z = cl.z;
    player.punchCd = Math.max(0, player.punchCd - dt);
    player.shootCd = Math.max(0, player.shootCd - dt);
    if (state.reloading > 0) {
      state.reloading -= dt;
      if (state.reloading <= 0) {
        state.ammo = PLAYER.magSize;
        message('Reloaded');
      }
    }
    // Health comes back slowly when nobody is after you.
    if (state.wanted === 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 4 * dt);
    }
    state.health = player.health;
    // First-aid pickups.
    for (const p of pickups) {
      if (p.respawn > 0) {
        p.respawn -= dt;
        p.mesh.visible = p.respawn <= 0;
        continue;
      }
      if (dist2(player.x, player.z, p.x, p.z) < 2.25 && player.health < PLAYER.health) {
        player.health = Math.min(PLAYER.health, player.health + 40);
        p.respawn = 30;
        p.mesh.visible = false;
        audio.pickup();
        message('First aid +40');
      }
    }
  }

  function stepCar(car, dt, input) {
    const isPlayer = car === player.inCar;
    if (car.disabled) {
      car.speed *= Math.max(0, 1 - dt * 2);
    } else if (isPlayer) {
      const accelIn = input.fwd ? 1 : input.back ? -1 : 0;
      if (accelIn > 0) car.speed += CAR.accel * dt;
      else if (accelIn < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
      else car.speed *= Math.max(0, 1 - dt * 0.6);
      car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
      const steerIn = input.left ? 1 : input.right ? -1 : 0;
      const authority = Math.min(1, Math.abs(car.speed) / 8);
      car.angle += steerIn * CAR.steer * authority * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
    } else if (car.traffic) {
      const t = car.traffic;
      // Slow for the car ahead on the same lane.
      for (const other of cars) {
        if (other === car || !other.traffic) continue;
        if (other.traffic.axis !== t.axis || other.traffic.line !== t.line || other.traffic.dir !== t.dir) continue;
        const gap = (other.traffic.pos - t.pos) * t.dir;
        if (gap > 0 && gap < 10) t.speed = Math.max(0, t.speed - 20 * dt);
      }
      t.pos += t.dir * t.speed * dt;
      // At an intersection, sometimes turn onto a crossing road.
      const lines = city.roadLines;
      const nearest = lines.reduce((best, l) => (Math.abs(t.pos - l) < Math.abs(t.pos - best) ? l : best), lines[0]);
      if (Math.abs(t.pos - nearest) < 0.6 && rng.chance(0.3)) {
        const newLine = lines[Math.floor(rng.next() * lines.length)];
        if (rng.next() < 0.5) {
          t.axis = t.axis === 'x' ? 'z' : 'x';
          t.line = nearest;
          t.pos = newLine;
          t.dir = rng.next() < 0.5 ? 1 : -1;
        }
      }
      if (t.pos > CITY_HALF - 6) t.dir = -1;
      if (t.pos < -CITY_HALF + 6) t.dir = 1;
      car.speed = t.speed * t.dir;
      car.angle = t.axis === 'x' ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
    } else if (car.police) {
      // Police pursuit: steer straight at the player, faster with more stars.
      const tx = player.inCar ? player.inCar.x : player.x;
      const tz = player.inCar ? player.inCar.z : player.z;
      const dx = tx - car.x;
      const dz = tz - car.z;
      car.angle = angleLerp(car.angle, Math.atan2(dx, dz), Math.min(1, dt * 2.2));
      const dist = Math.hypot(dx, dz);
      const targetSpeed = dist > 6 ? Math.min(38, 18 + state.wanted * 3) : 0;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    } else if (car.target) {
      // Mission 5 target: flee along the roads, away from the player.
      const t = car.traffic;
      t.speed = 24;
      t.pos += t.dir * t.speed * dt;
      const lines = city.roadLines;
      const nearest = lines.reduce((best, l) => (Math.abs(t.pos - l) < Math.abs(t.pos - best) ? l : best), lines[0]);
      if (Math.abs(t.pos - nearest) < 0.6 && rng.chance(0.5)) {
        t.axis = Math.abs(player.x) > Math.abs(player.z) ? 'z' : 'x';
        t.line = nearest;
        t.pos = (rng.next() * 2 - 1) * (CITY_HALF - 40);
        t.dir = rng.next() < 0.5 ? 1 : -1;
      }
      if (t.pos > CITY_HALF - 6) t.dir = -1;
      if (t.pos < -CITY_HALF + 6) t.dir = 1;
      car.speed = t.speed * t.dir;
      car.angle = t.axis === 'x' ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
    }
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    car.x += fx * car.speed * dt;
    car.z += fz * car.speed * dt;
    const c = collideCircle(city.colliders, car.x, car.z, 1.7);
    if ((c.x !== car.x || c.z !== car.z) && Math.abs(car.speed) > 6) {
      if (isPlayer) audio.crash();
      car.speed *= isPlayer ? 0.4 : 0.5;
    }
    car.x = c.x;
    car.z = c.z;
    const cl = clampToWorld(car.x, car.z);
    if (cl.x !== car.x || cl.z !== car.z) car.speed *= 0.5;
    car.x = cl.x;
    car.z = cl.z;
    // Car-car bumps.
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 12.25 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (3.5 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.x -= nx * push;
        car.z -= nz * push;
        other.x += nx * push;
        other.z += nz * push;
        const rel = Math.abs(car.speed - other.speed);
        if (rel > 8) {
          if (isPlayer || other === player.inCar) audio.crash();
          if (other.target && isPlayer) {
            other.health -= 25;
            message(`Hit the Verde Coupe (${Math.max(0, other.health)} HP left)`);
            if (other.health <= 0 && !other.disabled) {
              other.disabled = true;
              other.speed = 0;
              state.missionPhase = 'return';
              setBeacon(PLACES.garage.x, PLACES.garage.z, true);
              message('Coupe stopped. Bring the news to the garage.');
            }
          }
          if (other.police && isPlayer) addWanted(1, 'rammed a police car');
          car.speed *= 0.6;
          other.speed *= 0.6;
        }
      }
    }
    // Running over pedestrians.
    if (Math.abs(car.speed) > 4) {
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (dist2(car.x, car.z, ped.x, ped.z) < 3.2) {
          ped.health = 0;
          ped.down = 12;
          ped.state = 'down';
          if (isPlayer) {
            addWanted(1, 'pedestrian hit');
            if (ped.rival) state.missionKills += 1;
          }
        }
      }
    }
    // Sync the mesh, spin the wheels, flash the light bar.
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    const spin = car.speed * dt * 2.4;
    for (const w of car.wheels) w.rotation.x += spin;
    if (car.police && car.mesh.userData.lightBar) {
      const phase = Math.floor(state.time * 6) % 2 === 0;
      car.mesh.userData.lightBar.red.material.color.setHex(phase ? 0xff2020 : 0x551010);
      car.mesh.userData.lightBar.blue.material.color.setHex(phase ? 0x101050 : 0x2040ff);
    }
    if (car.health < 45 && !car.disabled) car.smoke = Math.min(1, car.smoke + dt);
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        ped.mesh.rotation.x = ped.down > 0 ? -Math.PI / 2 : 0;
        if (ped.down <= 0) {
          ped.state = ped.rival || ped.police ? ped.state : 'walk';
          ped.mesh.rotation.x = 0;
          if (ped.state === 'walk') assignRoad(ped);
        }
        continue;
      }
      ped.hitCd = Math.max(0, ped.hitCd - dt);
      let speed = ped.speed;
      let tx = 0;
      let tz = 0;
      if (ped.state === 'flee') {
        const dx = ped.x - ped.fleeX;
        const dz = ped.z - ped.fleeZ;
        const d = Math.hypot(dx, dz) || 1;
        tx = dx / d;
        tz = dz / d;
        speed = 5.5;
        if (d > 60) {
          ped.state = 'walk';
          assignRoad(ped);
        }
      } else if (ped.state === 'chase' || ped.state === 'rival') {
        // Police and rivals run at the player and hit up close.
        const dx = player.x - ped.x;
        const dz = player.z - ped.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = dx / d;
        tz = dz / d;
        speed = ped.police ? 6.5 : 4.2;
        if (d < 1.6 && ped.hitCd <= 0) {
          ped.hitCd = 1.0;
          player.health -= ped.police ? 6 : 9;
          audio.hurt();
          message(ped.police ? 'An officer is beating you down!' : 'Rival hit you!');
          if (player.health <= 0) {
            state.mode = 'wasted';
            audio.busted();
          }
        }
      } else if (ped.road) {
        // Stroll the sidewalk: along a road line, on one side; turn at
        // intersections with a smooth blend onto the crossing sidewalk.
        const r = ped.road;
        const off = STREET / 2 + 1.2;
        const target = r.line + r.side * off;
        r.blendT = Math.min(1, (r.blendT ?? 1) + dt / 0.8);
        const perp = r.blendFrom + (target - r.blendFrom) * r.blendT;
        r.pos += r.dir * speed * dt;
        if (r.axis === 'x') { ped.x = r.pos; ped.z = perp; tx = r.dir; tz = 0; }
        else { ped.x = perp; ped.z = r.pos; tx = 0; tz = r.dir; }
        const lines = city.roadLines;
        const nearest = lines.reduce((b, l) => (Math.abs(r.pos - l) < Math.abs(r.pos - b) ? l : b), lines[0]);
        if (Math.abs(r.pos - nearest) < 0.8 && rng.chance(dt * 0.5)) {
          const cross = r.axis === 'x' ? 'z' : 'x';
          ped.road = { axis: cross, line: nearest, dir: rng.next() < 0.5 ? 1 : -1, pos: perp, side: rng.next() < 0.5 ? 1 : -1, blendFrom: perp, blendT: 0 };
        }
        if (r.pos > CITY_HALF - 6) r.dir = -1;
        if (r.pos < -CITY_HALF + 6) r.dir = 1;
        ped.angle = Math.atan2(tx, tz);
        ped.walkPhase += dt * speed * 2.2;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.angle;
        const swing = Math.sin(ped.walkPhase) * 0.5;
        const u = ped.mesh.userData;
        u.legL.rotation.x = swing;
        u.legR.rotation.x = -swing;
        u.armL.rotation.x = -swing * 0.7;
        u.armR.rotation.x = swing * 0.7;
        continue;
      } else {
        // Fallback: keep the current heading, turn sometimes.
        tx = Math.sin(ped.angle);
        tz = Math.cos(ped.angle);
        if (rng.chance(dt * 0.06)) ped.angle += (rng.next() < 0.5 ? 1 : -1) * Math.PI / 2;
        if (Math.abs(ped.x) > CITY_HALF - 4 || Math.abs(ped.z) > CITY_HALF - 4) ped.angle += Math.PI;
      }
      ped.x += tx * speed * dt;
      ped.z += tz * speed * dt;
      ped.angle = Math.atan2(tx, tz);
      const c = collideCircle(city.colliders, ped.x, ped.z, 0.5);
      ped.x = c.x;
      ped.z = c.z;
      const cl = clampToWorld(ped.x, ped.z);
      ped.x = cl.x;
      ped.z = cl.z;
      ped.walkPhase += dt * speed * 2.2;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.angle;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      const u = ped.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
      if (ped.healthBar) {
        ped.healthBar.material.color.setHex(ped.health > 30 ? 0x37d67a : 0xe8b400);
        ped.healthBar.scale.x = 1.6 * Math.max(0, ped.health / 60);
      }
    }
  }

  function stepWanted(dt) {
    // Spawn the cops the stars call for.
    const wantCars = Math.min(state.wanted, 4);
    policeSpawnTimer -= dt;
    if (state.wanted > 0 && policeCars.length < wantCars && policeSpawnTimer <= 0) {
      spawnPoliceCar();
      policeSpawnTimer = 6;
    }
    if (state.wanted > 0 && player.inCar === null && policePeds.length < Math.min(state.wanted, 3) && policeSpawnTimer <= 0) {
      spawnPolicePed();
      policeSpawnTimer = 6;
    }
    // Decay when quiet and unseen.
    let nearestCop = 1e9;
    for (const c of policeCars) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
    for (const p of policePeds) nearestCop = Math.min(nearestCop, Math.hypot(p.x - player.x, p.z - player.z));
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      if (state.wantedTimer > WANTED.decaySeconds && nearestCop > 45) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        message(`Heat fading — ${state.wanted} star${state.wanted === 1 ? '' : 's'} left`);
      }
    }
    audio.setSiren(state.wanted > 0);
    // Bust checks: a cop holding close long enough takes you in.
    if (state.wanted > 0) {
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      const speed = player.inCar ? Math.abs(player.inCar.speed) : Math.hypot(player.vx, player.vz);
      let hold = 0;
      for (const c of policeCars) if (Math.hypot(c.x - px, c.z - pz) < (player.inCar ? 4.5 : 6)) hold += dt;
      for (const p of policePeds) if (Math.hypot(p.x - px, p.z - pz) < 2.4 && speed < 4) hold += dt;
      if (hold > 0) {
        state.bustHold = (state.bustHold || 0) + hold;
        const need = player.inCar ? WANTED.bustCarHoldSeconds : WANTED.bustHoldSeconds;
        if (state.bustHold > need) {
          state.mode = 'busted';
          state.bustedReason = 'The Verde PD took you in.';
          audio.busted();
        }
      } else {
        state.bustHold = 0;
      }
    }
  }

  function stepMissions(dt) {
    const m = currentMission();
    if (!m || state.missionPhase === 'done') return;
    if (m.kind === 'steal-deliver') {
      if (state.missionPhase === 'deliver' && player.inCar) {
        if (dist2(player.inCar.x, player.inCar.z, PLACES.garage.x, PLACES.garage.z) < 100) completeMission();
      }
    } else if (m.kind === 'timed-deliver') {
      if (state.missionPhase === 'deliver') {
        state.missionTimer -= dt;
        if (state.missionTimer <= 0) {
          state.missionPhase = 'getcar';
          state.missionTimer = 0;
          setBeacon(PLACES.marlinClub.x, PLACES.marlinClub.z, true);
          message('Too slow — the package run restarts. Get a car.');
        } else if (player.inCar && dist2(player.inCar.x, player.inCar.z, PLACES.marlinClub.x, PLACES.marlinClub.z) < 100) {
          completeMission();
        }
      }
    } else if (m.kind === 'lose-wanted') {
      if (state.missionPhase === 'evade' && state.wanted === 0) completeMission();
    } else if (m.kind === 'defeat') {
      if (state.missionPhase === 'goto' && dist2(player.x, player.z, PLACES.plaza.x, PLACES.plaza.z) < 144) {
        state.missionPhase = 'fight';
        message('The rivals are here. Take them down!');
      } else if (state.missionPhase === 'fight' && state.missionKills >= 3) {
        setBeacon(0, 0, false);
        completeMission();
      }
    } else if (m.kind === 'ram-target') {
      if (state.missionPhase === 'return') {
        const dx = player.inCar ? player.inCar.x : player.x;
        const dz = player.inCar ? player.inCar.z : player.z;
        if (dist2(dx, dz, PLACES.garage.x, PLACES.garage.z) < 100) completeMission();
      }
    }
  }

  function stepTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        worldGroup.remove(tracers[i].mesh);
        tracers.splice(i, 1);
      }
    }
  }

  // --- public API ----------------------------------------------------------------------
  function reset(seed = 1337) {
    // A fresh world: used by the title screen and by ?shot= staging.
    for (const car of [...policeCars]) {
      worldGroup.remove(car.mesh);
      cars.splice(cars.indexOf(car), 1);
    }
    policeCars.length = 0;
    for (const p of [...policePeds]) {
      worldGroup.remove(p.mesh);
      peds.splice(peds.indexOf(p), 1);
    }
    policePeds.length = 0;
    for (const r of [...rivals]) {
      worldGroup.remove(r.mesh);
      peds.splice(peds.indexOf(r), 1);
    }
    rivals.length = 0;
    if (targetCar) {
      worldGroup.remove(targetCar.mesh);
      cars.splice(cars.indexOf(targetCar), 1);
      targetCar = null;
    }
    state.time = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.health = PLAYER.health;
    player.health = PLAYER.health;
    state.ammo = PLAYER.magSize;
    state.reloading = 0;
    state.messages = [];
    state.missionIndex = 0;
    state.missionPhase = 'idle';
    state.missionTimer = 0;
    state.missionKills = 0;
    player.x = PLACES.garage.x - 4;
    player.z = PLACES.garage.z + 6;
    player.y = 0;
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    player.angle = Math.PI;
    player.inCar = null;
    playerMesh.visible = true;
    for (const car of cars) {
      car.speed = 0;
      car.health = 100;
      car.disabled = false;
      if (car.traffic) car.traffic.speed = CAR.trafficSpeed;
    }
    for (const ped of peds) {
      ped.health = 100;
      ped.down = 0;
      ped.state = ped.police ? 'chase' : 'walk';
      ped.mesh.rotation.x = 0;
    }
    setBeacon(0, 0, false);
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.angle;
  }

  function startNewGame(fromSave) {
    reset();
    if (fromSave) {
      state.cash = fromSave.cash || 0;
      state.missionIndex = Math.min(fromSave.missionIndex || 0, MISSIONS.length - 1);
    } else {
      state.cash = 0;
      state.missionIndex = 0;
    }
    state.mode = 'play';
    startMission(state.missionIndex);
    message('Porto Verde. Make it count, Dante.');
  }

  function step(dt, input) {
    if (state.mode !== 'play') return;
    state.time += dt;
    // Edge-triggered actions, consumed here by the caller resetting them.
    if (input.enter) {
      if (player.inCar) exitCar();
      else {
        const car = nearestParkedCar(4);
        if (car) enterCar(car);
      }
    }
    if (input.punch) punch();
    if (input.reload && state.reloading <= 0 && state.ammo < PLAYER.magSize) state.reloading = PLAYER.reloadTime;
    if (input.shoot && input.camPos && input.camDir) shoot(input.camPos, input.camDir);

    stepPlayer(dt, input);
    for (const car of cars) stepCar(car, dt, input);
    stepPeds(dt);
    stepWanted(dt);
    stepMissions(dt);
    stepTracers(dt);
    // Engine hum follows the player's car.
    audio.setEngine(player.inCar ? Math.abs(player.inCar.speed) / CAR.maxSpeed : 0, !!player.inCar);
    // Beacon pulse.
    if (beacon.visible) {
      const s = 1 + Math.sin(state.time * 4) * 0.08;
      beaconCyl.scale.set(s, 1, s);
      beaconMat.opacity = 0.28 + Math.sin(state.time * 4) * 0.1;
    }
    // Player mesh sync.
    playerMesh.position.set(player.x, player.y, player.z);
    playerMesh.rotation.y = player.angle;
    const swing = Math.sin(player.walkPhase) * (player.moving ? 0.55 : 0);
    const u = playerMesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    if (state.health <= 0 && state.mode === 'play') {
      state.mode = 'wasted';
      audio.busted();
    }
    state.health = player.health;
  }

  function objectiveText() {
    const m = currentMission();
    if (!m) return 'Story complete — free roam. Porto Verde is yours.';
    let extra = '';
    if (m.kind === 'timed-deliver' && state.missionPhase === 'deliver') {
      extra = ` — ${Math.max(0, Math.ceil(state.missionTimer))}s left`;
    }
    if (m.kind === 'defeat' && state.missionPhase === 'fight') extra = ` — ${state.missionKills}/3 down`;
    if (beaconPos.active) {
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      const d = Math.round(Math.hypot(beaconPos.x - px, beaconPos.z - pz));
      extra += ` — ${d}m`;
    }
    return `${m.name}: ${m.text}${extra}`;
  }

  return {
    state, player, cars, peds, policeCars, policePeds, rivals,
    worldGroup, city, beaconPos,
    get targetCar() { return targetCar; },
    step, reset, startNewGame, respawn, saveGame, loadGame,
    currentMission, startMission, objectiveText, message,
    addWanted, enterCar, exitCar, nearestParkedCar,
    spawnPoliceCar, spawnPolicePed, spawnTargetCar, spawnRivals,
    setBeacon,
  };
}
