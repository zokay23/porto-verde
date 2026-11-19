// Porto Verde itself: a seeded procedural city — roads, blocks, buildings, beach,
// parks, lamps and trees — plus the collision boxes and the road network traffic uses.
import * as THREE from 'three';
import { BLOCK, CITY_HALF, CITY_SEED, COLORS, GRID, PITCH, PLACES, STREET } from './config.js';
import { createRandom } from './random.js';

const ROAD_LINES = [];
for (let k = 0; k <= GRID; k += 1) ROAD_LINES.push(-CITY_HALF + k * PITCH);

export function blockCenter(i, j) {
  return { x: -CITY_HALF + STREET + PITCH * i + BLOCK / 2, z: -CITY_HALF + STREET + PITCH * j + BLOCK / 2 };
}

function facadeTexture(color, width, height) {
  // Windows stay ~3.5 m wide whatever the building: the canvas grows with the face.
  const cols = Math.max(2, Math.round(width / 3.5));
  const rows = Math.max(2, Math.round(height / 3.2));
  const cw = Math.min(512, cols * 28);
  const ch = Math.min(512, rows * 28);
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, cw, ch);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, cw, 8);
  const lit = ['#ffd98a', '#bcd6ff', '#ffe9b0', '#9fb6c9'];
  const cellW = cw / cols;
  const cellH = ch / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * cellW + 5;
      const y = r * cellH + 6;
      const w = cellW - 10;
      const h = cellH - 11;
      g.fillStyle = '#20242c';
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = lit[(r * 7 + c * 3) % lit.length];
      g.globalAlpha = 0.85;
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(THREE) {
  const rng = createRandom(CITY_SEED);
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = [];
  const carSpawns = [];
  const pedSpawns = [];

  const matRoad = new THREE.MeshLambertMaterial({ color: COLORS.road });
  const matSidewalk = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const matLine = new THREE.MeshLambertMaterial({ color: COLORS.roadLine });
  const matSand = new THREE.MeshLambertMaterial({ color: COLORS.sand });
  const matSea = new THREE.MeshLambertMaterial({ color: COLORS.sea });
  const matGrass = new THREE.MeshLambertMaterial({ color: COLORS.grass });
  const matTrunk = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const matLeaf = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  const matLamp = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const matLampHead = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.9 });

  // Ground: one asphalt sheet for the whole city footprint.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, CITY_HALF * 2 + 90), matRoad);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 25);
  group.add(ground);

  // Beach (south) and sea.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, 42), matSand);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, CITY_HALF + 21);
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 260), matSea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY_HALF + 42 + 130);
  group.add(sea);

  // Lane dashes along every road.
  const dashGeo = new THREE.PlaneGeometry(0.35, 6);
  for (const line of ROAD_LINES) {
    for (let d = -CITY_HALF + 10; d < CITY_HALF - 10; d += 18) {
      const a = new THREE.Mesh(dashGeo, matLine);
      a.rotation.x = -Math.PI / 2; a.position.set(line, 0.03, d);
      group.add(a);
      const b = new THREE.Mesh(dashGeo, matLine);
      b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2; b.position.set(d, 0.03, line);
      group.add(b);
    }
  }

  // Special blocks: plaza, parks, garage, club, police HQ, hospital, tower.
  const special = {
    '3,3': 'plaza',
    '0,2': 'park', '5,3': 'park',
    '1,4': 'garage', '4,1': 'club', '1,1': 'police', '4,4': 'hospital',
    '2,0': 'tower',
  };

  const lampPositions = [];
  const treePositions = [];

  function addBuilding(cx, cz, w, d, h, color, label) {
    const tex = facadeTexture(color, w, h);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2 + 0.15, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    if (label) {
      const sign = makeSign(THREE, label);
      sign.position.set(cx, h + 1.2, cz + d / 2 + 0.4);
      group.add(sign);
    }
    return mesh;
  }

  function makeSign(THREE_, text) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#101418'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#ffd34d';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 34);
    const tex = new THREE_.CanvasTexture(cv);
    tex.colorSpace = THREE_.SRGBColorSpace;
    const mesh = new THREE_.Mesh(
      new THREE_.PlaneGeometry(14, 1.75),
      new THREE_.MeshBasicMaterial({ map: tex }),
    );
    return mesh;
  }

  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const c = blockCenter(i, j);
      const key = `${i},${j}`;
      const kind = special[key];
      // Sidewalk slab for every block.
      const slabMat = kind === 'plaza' || kind === 'park' ? matGrass : matSidewalk;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.3, BLOCK), slabMat);
      slab.position.set(c.x, 0.15, c.z);
      slab.receiveShadow = true;
      group.add(slab);

      if (kind === 'plaza') {
        // Open plaza: fountain + trees, no buildings.
        const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0x9fb6c9 }));
        fountain.position.set(c.x, 0.9, c.z);
        group.add(fountain);
        colliders.push({ minX: c.x - 7, maxX: c.x + 7, minZ: c.z - 7, maxZ: c.z + 7 });
        for (let t = 0; t < 8; t += 1) treePositions.push({ x: c.x + (rng.next() - 0.5) * 48, z: c.z + (rng.next() - 0.5) * 48 });
        continue;
      }
      if (kind === 'park') {
        for (let t = 0; t < 10; t += 1) treePositions.push({ x: c.x + (rng.next() - 0.5) * 50, z: c.z + (rng.next() - 0.5) * 50 });
        continue;
      }
      if (kind === 'garage') {
        addBuilding(c.x, c.z, 40, 26, 7, '#b8643c', 'MARLOW GARAGE');
        carSpawns.push({ x: c.x - 24, z: c.z + 2, angle: Math.PI / 2 });
        carSpawns.push({ x: c.x - 24, z: c.z + 10, angle: Math.PI / 2 });
        continue;
      }
      if (kind === 'club') {
        addBuilding(c.x, c.z, 34, 30, 12, '#5a2f7a', 'MARLIN CLUB');
        continue;
      }
      if (kind === 'police') {
        addBuilding(c.x, c.z, 36, 28, 10, '#1c2f57', 'VERDE PD HQ');
        continue;
      }
      if (kind === 'hospital') {
        addBuilding(c.x, c.z, 38, 30, 14, '#e8e8e8', 'ST. VERDE HOSPITAL');
        continue;
      }
      if (kind === 'tower') {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(7, 10, 64, 10),
          new THREE.MeshLambertMaterial({ color: 0x7e8b99 }),
        );
        tower.position.set(c.x, 32, c.z);
        tower.castShadow = true;
        group.add(tower);
        colliders.push({ minX: c.x - 10, maxX: c.x + 10, minZ: c.z - 10, maxZ: c.z + 10 });
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(1.4, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xff4040 }),
        );
        beacon.position.set(c.x, 65.5, c.z);
        group.add(beacon);
        continue;
      }
      // Ordinary block: 1-3 buildings.
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(16, 26);
        const d = rng.range(16, 26);
        const h = rng.range(6, 30);
        const ox = (rng.next() - 0.5) * (BLOCK - w - 4);
        const oz = (rng.next() - 0.5) * (BLOCK - d - 4);
        addBuilding(c.x + ox, c.z + oz, w, d, h, rng.pick(COLORS.building));
      }
    }
  }

  // Lamps along the roads.
  for (const line of ROAD_LINES) {
    for (let d = -CITY_HALF + 20; d < CITY_HALF - 10; d += 46) {
      lampPositions.push({ x: line + STREET / 2 - 0.8, z: d });
      lampPositions.push({ x: d, z: line + STREET / 2 - 0.8 });
    }
  }
  const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6);
  const lampPole = new THREE.InstancedMesh(lampPoleGeo, matLamp, lampPositions.length);
  const lampHeadGeo = new THREE.BoxGeometry(1.1, 0.25, 0.4);
  const lampHead = new THREE.InstancedMesh(lampHeadGeo, matLampHead, lampPositions.length);
  const m4 = new THREE.Matrix4();
  lampPositions.forEach((p, idx) => {
    m4.makeTranslation(p.x, 2.7, p.z);
    lampPole.setMatrixAt(idx, m4);
    m4.makeTranslation(p.x, 5.4, p.z);
    lampHead.setMatrixAt(idx, m4);
  });
  group.add(lampPole); group.add(lampHead);

  // Trees (trunks + canopies as two instanced meshes).
  for (let t = 0; t < 40; t += 1) {
    treePositions.push({ x: (rng.next() - 0.5) * (CITY_HALF * 2 - 20), z: CITY_HALF + rng.range(4, 36) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, matTrunk, treePositions.length);
  const canopyGeo = new THREE.SphereGeometry(1.9, 8, 6);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, matLeaf, treePositions.length);
  treePositions.forEach((p, idx) => {
    m4.makeTranslation(p.x, 1.2, p.z);
    trunkMesh.setMatrixAt(idx, m4);
    m4.makeTranslation(p.x, 3.4, p.z);
    canopyMesh.setMatrixAt(idx, m4);
  });
  group.add(trunkMesh); group.add(canopyMesh);

  // Parked cars along the streets + ped spawn points on sidewalks.
  for (const line of ROAD_LINES) {
    for (let d = -CITY_HALF + 24; d < CITY_HALF - 20; d += 74) {
      if (rng.chance(0.55)) carSpawns.push({ x: line + 4.6, z: d + rng.range(-8, 8), angle: 0 });
      if (rng.chance(0.4)) carSpawns.push({ x: d + rng.range(-8, 8), z: line + 4.6, angle: Math.PI / 2 });
      pedSpawns.push({ x: line + STREET / 2 + 1.2, z: d });
      pedSpawns.push({ x: d, z: line + STREET / 2 + 1.2 });
    }
  }

  return { group, colliders, carSpawns, pedSpawns, roadLines: ROAD_LINES };
}

// Circle (x,z,r) vs building AABBs: push the circle out. Returns corrected {x,z}.
export function collideCircle(colliders, x, z, r) {
  let nx = x;
  let nz = z;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(nx, b.maxX));
    const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = nx - b.minX; const pr = b.maxX - nx;
        const pt = nz - b.minZ; const pb = b.maxZ - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = b.minX - r;
        else if (m === pr) nx = b.maxX + r;
        else if (m === pt) nz = b.minZ - r;
        else nz = b.maxZ + r;
      }
    }
  }
  return { x: nx, z: nz };
}

export function clampToWorld(x, z) {
  const lim = CITY_HALF + 38;
  return {
    x: Math.max(-CITY_HALF - 8, Math.min(CITY_HALF + 8, x)),
    z: Math.max(-CITY_HALF - 8, Math.min(lim, z)),
  };
}

export { PLACES };
