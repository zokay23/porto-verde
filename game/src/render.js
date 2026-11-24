// Rendering: three.js chase camera, meshes synced from the sim, and a
// 2D canvas HUD on top (cash, wanted stars, health, mission, speed,
// ammo, message feed and a circular minimap). No DOM text is used for
// the HUD, so it shows up identically in screenshots.
//
// Round 2: meshes removed from the scene (despawned police cars and
// officers) now have their geometries/materials disposed instead of
// leaking GPU memory. Camera, layout, colours and sizes are unchanged.
import * as THREE from 'three';
import { CONFIG, MISSIONS } from './config.js';
import { buildCity } from './city.js';

export function createRenderer(sim, rng) {
  const canvas3d = document.getElementById('game3d');
  const hud = document.getElementById('hud');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  const city = buildCity(THREE, scene, rng);
  sim.city = city;

  const hudCtx = hud.getContext('2d');
  hud.width = window.innerWidth; hud.height = window.innerHeight;

  // Player figure: orange jacket, dark trousers, head.
  const playerGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xe86a3a }));
  body.position.y = 1.0; playerGroup.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8b890 }));
  head.position.y = 1.85; playerGroup.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legs.position.y = 0.45; playerGroup.add(legs);
  scene.add(playerGroup);

  // Beacon: a tall glowing column over the current mission target.
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  scene.add(beacon);
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }));
  beaconRing.rotation.x = Math.PI / 2; scene.add(beaconRing);

  const carMeshes = new Map();
  const pedMeshes = new Map();
  const rivalMeshes = new Map();
  const officerMeshes = new Map();

  // Free GPU resources for a group that leaves the scene.
  function disposeGroup(g) {
    g.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
  }

  function carMesh(car) {
    const g = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4),
      new THREE.MeshLambertMaterial({ color: car.color }));
    bodyM.position.y = 0.65; g.add(bodyM);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    cabin.position.set(0, 1.25, -0.2); g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
    }
    if (car.police) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5),
        new THREE.MeshBasicMaterial({ color: car.flash ? 0xff2222 : 0x2244ff }));
      bar.position.set(0, 1.7, -0.2); bar.name = 'lightbar'; g.add(bar);
    }
    scene.add(g);
    return g;
  }

  function personMesh(color) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4),
      new THREE.MeshLambertMaterial({ color }));
    b.position.y = 0.9; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xd8a880 }));
    h.position.y = 1.65; g.add(h);
    scene.add(g);
    return g;
  }

  function syncMeshes() {
    for (const car of sim.cars) {
      let m = carMeshes.get(car.id);
      if (!m) { m = carMesh(car); carMeshes.set(car.id, m); }
      m.position.set(car.x, 0, car.z);
      m.rotation.y = car.angle;
      const bar = m.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(car.flash ? 0xff2222 : 0x2244ff);
    }
    for (const [id, m] of [...carMeshes]) {
      if (!sim.cars.some(c => c.id === id)) { scene.remove(m); disposeGroup(m); carMeshes.delete(id); }
    }
    for (const ped of sim.peds) {
      let m = pedMeshes.get(ped.id);
      if (!m) { m = personMesh(ped.color); pedMeshes.set(ped.id, m); }
      m.position.set(ped.x, 0, ped.z); m.rotation.y = ped.angle;
    }
    for (const r of sim.rivals) {
      let m = rivalMeshes.get(r.id);
      if (!m) { m = personMesh(0xc23a2e); rivalMeshes.set(r.id, m); }
      m.visible = r.alive;
      m.position.set(r.x, 0, r.z); m.rotation.y = r.angle;
    }
    for (const o of sim.policeFoot) {
      let m = officerMeshes.get(o.id);
      if (!m) { m = personMesh(0x1a2a4a); officerMeshes.set(o.id, m); }
      m.position.set(o.x, 0, o.z); m.rotation.y = o.angle;
    }
    for (const [id, m] of [...officerMeshes]) {
      if (!sim.policeFoot.some(o => o.id === id)) { scene.remove(m); disposeGroup(m); officerMeshes.delete(id); }
    }
  }

  function drawHud(input) {
    const W = hud.width, H = hud.height, g = hudCtx;
    g.clearRect(0, 0, W, H);
    const p = sim.player;
    // Top-left: cash + mission title.
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(16, 14, 330, 74);
    g.fillStyle = '#7ee787'; g.font = 'bold 26px sans-serif'; g.textAlign = 'left';
    g.fillText(`$${p.cash}`, 28, 46);
    g.fillStyle = '#ffffff'; g.font = 'bold 15px sans-serif';
    g.fillText(sim.mission ? sim.mission.title : '', 28, 70);
    g.font = '13px sans-serif'; g.fillStyle = '#ffd23a';
    const target = sim.mission ? missionTargetText(sim) : '';
    g.fillText(target, 28, 84); // objective line, kept short for the HUD
    // Top-centre: objective + live distance, big and readable.
    const t = sim.mission ? currentTarget(sim) : null;
    if (t) {
      const d = Math.round(Math.hypot(p.x - t.x, p.z - t.z));
      const label = `${t.label}  •  ${d}m${sim.missionIndex === 1 ? `  •  ${Math.ceil(sim.missionTimer)}s` : ''}`;
      g.font = 'bold 17px sans-serif';
      const w = g.measureText(label).width;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - w / 2 - 14, 12, w + 28, 34);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(label, W / 2, 36);
      g.textAlign = 'left';
    }
    // Top-right: wanted stars.
    g.font = '30px sans-serif'; g.textAlign = 'right';
    let stars = '';
    for (let i = 0; i < CONFIG.maxWanted; i++) stars += i < p.wanted ? '★' : '☆';
    g.fillStyle = p.wanted > 0 ? '#ff4444' : '#ffffff';
    g.fillText(stars, W - 20, 48);
    g.textAlign = 'left';
    // Bottom-right: speed, car, ammo.
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(W - 230, H - 96, 214, 80);
    const speed = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 3.6) : 0;
    g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif';
    g.fillText(`${speed}`, W - 210, H - 62);
    g.font = '13px sans-serif'; g.fillText('km/h', W - 150, H - 62);
    g.font = 'bold 14px sans-serif';
    g.fillText(p.inCar ? p.inCar.def.name : 'On foot', W - 210, H - 40);
    g.fillStyle = '#ffd23a';
    g.fillText(`AMMO ${p.ammo}/${CONFIG.magSize}  •  R reload`, W - 210, H - 20);
    // Bottom-left: health bar above the minimap (width clamped to the bar).
    const hx = 24, hy = H - 250;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(hx - 8, hy - 8, 204, 30);
    g.fillStyle = '#333'; g.fillRect(hx, hy, 188, 14);
    g.fillStyle = p.health > 40 ? '#4ade80' : '#ff4444';
    g.fillRect(hx, hy, 188 * Math.max(0, Math.min(1, p.health / 100)), 14);
    // Minimap: whole city, circular, bottom-left.
    const cx = 120, cy = H - 120, R = 96;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1a2a1a'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    const scale = (R * 2) / 360;
    const mx = (x) => cx + x * scale, mz = (z) => cy + z * scale;
    g.strokeStyle = '#555'; g.lineWidth = 5;
    for (const a of [-150, -100, -50, 0, 50, 100, 150]) {
      g.beginPath(); g.moveTo(mx(-170), mz(a)); g.lineTo(mx(170), mz(a)); g.stroke();
      g.beginPath(); g.moveTo(mx(a), mz(-170)); g.lineTo(mx(a), mz(170)); g.stroke();
    }
    g.fillStyle = '#2ec8c8'; g.fillRect(mx(112) - 4, mz(112) - 4, 8, 8); // Marlin
    g.fillStyle = '#e86a3a'; g.fillRect(mx(-138) - 4, mz(-138) - 4, 8, 8); // garage
    g.fillStyle = '#3aa8d8'; g.beginPath(); g.arc(mx(0), mz(0), 5, 0, Math.PI * 2); g.fill();
    if (t) { // mission beacon, pulsing yellow
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(mx(t.x), mz(t.z), 7 + 2 * Math.sin(sim.time * 4), 0, Math.PI * 2); g.fill();
    }
    for (const c of sim.cars) if (c.police) { g.fillStyle = '#ff2222'; g.beginPath(); g.arc(mx(c.x), mz(c.z), 4, 0, Math.PI * 2); g.fill(); }
    for (const r of sim.rivals) if (r.alive) { g.fillStyle = '#ff8800'; g.beginPath(); g.arc(mx(r.x), mz(r.z), 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(mx(p.x), mz(p.z), 5, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // Message feed, bottom-centre.
    g.font = '14px sans-serif'; g.textAlign = 'center';
    sim.messages.slice(0, 3).forEach((m, i) => {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      const w = g.measureText(m.text).width;
      g.fillRect(W / 2 - w / 2 - 10, H - 150 - i * 26, w + 20, 22);
      g.fillStyle = '#ffffff'; g.fillText(m.text, W / 2, H - 134 - i * 26);
    });
    g.textAlign = 'left';
    // Vignettes: red when hurt, flashing red/blue when wanted.
    if (p.health < 45) {
      const grad = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      grad.addColorStop(0, 'rgba(255,0,0,0)'); grad.addColorStop(1, 'rgba(255,0,0,0.45)');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    }
    if (p.wanted > 0 && Math.sin(sim.time * 5) > 0) {
      g.fillStyle = 'rgba(255,0,0,0.06)'; g.fillRect(0, 0, W, H);
    }
    if (sim.over) {
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffd23a'; g.font = 'bold 42px sans-serif'; g.textAlign = 'center';
      g.fillText('PORTO VERDE IS YOURS', W / 2, H / 2 - 10);
      g.fillStyle = '#ffffff'; g.font = '18px sans-serif';
      g.fillText('All five jobs done — debt paid.', W / 2, H / 2 + 26);
      g.textAlign = 'left';
    }
  }

  function missionTargetText(sim) {
    return sim.mission ? sim.mission.objective : '';
  }
  function currentTarget(sim) {
    // Re-exported via sim module at runtime: import cycle avoided by
    // reading the target from the sim's own mission state in main.js.
    return sim._target || null;
  }

  return {
    renderer, scene, camera, hud, city,
    resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      hud.width = window.innerWidth; hud.height = window.innerHeight;
    },
    frame(input, dt) {
      syncMeshes();
      const p = sim.player;
      playerGroup.visible = !p.inCar;
      playerGroup.position.set(p.x, p.y, p.z);
      playerGroup.rotation.y = p.angle;
      // Beacon follows the live mission target.
      const t = sim._target;
      if (t) {
        beacon.position.set(t.x, 21, t.z);
        beaconRing.position.set(t.x, 0.4, t.z);
        beacon.visible = beaconRing.visible = true;
      } else { beacon.visible = beaconRing.visible = false; }
      // Chase camera: behind the player/car, orbit yaw from the mouse.
      const yaw = input.camYaw;
      const dist = p.inCar ? 13 : 10;
      const height = p.inCar ? 5.5 : 4.5;
      const cx = p.x - Math.sin(yaw) * dist;
      const cz = p.z - Math.cos(yaw) * dist;
      camera.position.set(cx, p.y + height, cz);
      camera.lookAt(p.x, p.y + 1.6, p.z);
      renderer.render(scene, camera);
      drawHud(input);
    },
  };
}
