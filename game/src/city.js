// Porto Verde itself: a seeded 6x6-block procedural city.
// Roads on a 50m pitch, blocks between them, a plaza in the middle,
// a beach and sea to the south, and the garage / Marlin Club at opposite
// corners. buildCity adds the meshes to the scene and returns the data
// the simulation needs: colliders, road axes and landmark positions.
import { CONFIG, PALETTE } from './config.js';

export const ROAD_AXES = [-150, -100, -50, 0, 50, 100, 150];
export const BLOCK_CENTERS = [-125, -75, -25, 25, 75, 125];

export function roadAxisNear(v) {
  let best = ROAD_AXES[0];
  for (const a of ROAD_AXES) if (Math.abs(a - v) < Math.abs(best - v)) best = a;
  return best;
}

function windowTexture(THREE, rng, baseColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 240; y += 28) {
    for (let x = 10; x < 118; x += 24) {
      const lit = rng.chance(0.45);
      g.fillStyle = lit ? '#ffe9a8' : '#2a3442';
      g.fillRect(x, y, 14, 18);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(THREE, scene, rng) {
  const colliders = [];
  const landmarks = {
    garage: { x: -125, z: -125, name: 'Marlow Garage' },
    marlin: { x: 125, z: 125, name: 'Marlin Club' },
    plaza: { x: 0, z: 0, name: 'Verde Plaza' },
    beach: { x: 0, z: 158, name: 'Porto Beach' },
    tower: { x: 75, z: -75, name: 'Verde Tower' },
  };

  // Sun, sky light and fog: a warm late-afternoon coast city.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.1));
  scene.fog = new THREE.Fog(0xffb36b, 260, 520);
  scene.background = new THREE.Color(PALETTE.sky);

  // Ground: grass base, then road strips, sidewalks and the plaza slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const a of ROAD_AXES) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(340, CONFIG.road), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(0, 0, a); scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.road, 340), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(a, 0, 0); scene.add(ew);
    // Dashed centre lines, thin pale strips along each road.
    for (let d = -160; d < 170; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.7),
        new THREE.MeshBasicMaterial({ color: PALETTE.roadLine }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.02, a);
      scene.add(dash);
      const dash2 = dash.clone(); dash2.rotation.z = Math.PI / 2; dash2.position.set(a, 0.02, d);
      scene.add(dash2);
    }
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(340, 3), walkMat);
    sw1.rotation.x = -Math.PI / 2; sw1.position.set(0, 0.01, a + 9); scene.add(sw1);
    const sw2 = sw1.clone(); sw2.position.z = a - 9; scene.add(sw2);
  }

  // Plaza slab + fountain in the very centre block.
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(38, 38),
    new THREE.MeshLambertMaterial({ color: PALETTE.plaza }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.03, 0); scene.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9ab8c8 }));
  fountain.position.set(0, 0.6, 0); scene.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x3aa8d8 }));
  water.position.set(0, 1.1, 0); scene.add(water);

  // Beach + sea to the south (positive z).
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(360, 34),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 168); scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 160),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, 265); scene.add(sea);

  // Buildings: four per block, except the plaza, the park and the landmarks.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const isSpecial = (bx, bz) =>
    (bx === 0 && bz === 0) || // plaza
    (bx === -125 && bz === -125) || // garage block
    (bx === 125 && bz === 125) || // Marlin block
    (bx === -25 && bz === 75); // park
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (isSpecial(bx, bz)) continue;
      for (const [ox, oz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
        const h = rng.range(9, 30);
        const color = rng.pick(PALETTE.building);
        const mat = new THREE.MeshLambertMaterial({ map: windowTexture(THREE, rng, color) });
        const b = new THREE.Mesh(boxGeo, mat);
        const w = rng.range(13, 18), d = rng.range(13, 18);
        b.scale.set(w, h, d);
        b.position.set(bx + ox, h / 2, bz + oz);
        scene.add(b);
        colliders.push({ minX: bx + ox - w / 2, maxX: bx + ox + w / 2, minZ: bz + oz - d / 2, maxZ: bz + oz + d / 2 });
      }
    }
  }

  // Verde Tower: the tall landmark on its own block.
  const towerMat = new THREE.MeshLambertMaterial({ map: windowTexture(THREE, rng, PALETTE.tower) });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(20, 64, 20); tower.position.set(75, 32, -75); scene.add(tower);
  colliders.push({ minX: 65, maxX: 85, minZ: -85, maxZ: -65 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  beacon.position.set(75, 66, -75); scene.add(beacon);

  // Garage (orange, open front) and Marlin Club (teal, neon sign block).
  function landmarkBlock(x, z, color, w, h, d, label) {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color }));
    m.scale.set(w, h, d); m.position.set(x, h / 2, z); scene.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.6, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sign.position.set(x, h + 1, z + d / 2 + 0.3); scene.add(sign);
    return { x, z, name: label };
  }
  landmarkBlock(-125, -125, PALETTE.garage, 26, 9, 18, 'Marlow Garage');
  landmarkBlock(125, 125, PALETTE.marlin, 26, 12, 18, 'Marlin Club');

  // Park: grass block with trees and benches (no buildings).
  const park = new THREE.Mesh(new THREE.PlaneGeometry(38, 38),
    new THREE.MeshLambertMaterial({ color: 0x4a8a3a }));
  park.rotation.x = -Math.PI / 2; park.position.set(-25, 0.04, 75); scene.add(park);

  // Trees and street lamps, scattered along roads and in the park.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7a2a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-160, 160), z = rng.range(-160, 160);
    if (Math.abs(roadAxisNear(x) - x) < 8 && Math.abs(roadAxisNear(z) - z) < 8) continue;
    if (Math.hypot(x, z) < 32) continue; // keep the plaza open for the camera
    if (Math.hypot(x + 125, z + 125) < 24 || Math.hypot(x - 125, z - 125) < 24) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6), trunkMat);
    trunk.position.set(x, 1.2, z); scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), leafMat);
    leaves.position.set(x, 4.4, z); scene.add(leaves);
  }
  for (const a of ROAD_AXES) {
    for (let d = -140; d <= 140; d += 40) {
      for (const [lx, lz] of [[a + 9, d], [d, a + 9]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), lampMat);
        pole.position.set(lx, 3, lz); scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), glowMat);
        lamp.position.set(lx, 6.2, lz); scene.add(lamp);
      }
    }
  }

  return { colliders, landmarks, roadAxes: ROAD_AXES, blockCenters: BLOCK_CENTERS };
}

// Point-in-collider test, used by walking, driving and AI alike.
export function hitsCollider(colliders, x, z, radius) {
  for (const c of colliders) {
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return c;
  }
  return null;
}

export function clampToWorld(x, z) {
  const m = CONFIG.worldHalf;
  return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m, z)) };
}
