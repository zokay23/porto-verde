// Rendering: the three.js scene, the chase/orbit camera, lighting, sky and the HUD
// (DOM overlay + 2D minimap). The simulation owns the world; this module draws it.
import * as THREE from 'three';
import { CITY_HALF, COLORS, PITCH } from './config.js';

const TAU = Math.PI * 2;

function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function createRenderer(canvas, game) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 120, 420);
  scene.add(game.worldGroup);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  // Drifting clouds: flat white blobs, cheap and pretty.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i += 1) {
    const g = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 6, 8, 6), cloudMat);
      s.scale.y = 0.35;
      s.position.set(j * 8 - 8, 0, (Math.random() - 0.5) * 6);
      g.add(s);
    }
    g.position.set((Math.random() - 0.5) * 500, 70 + Math.random() * 30, (Math.random() - 0.5) * 500);
    scene.add(g);
    clouds.push(g);
  }

  // --- camera state -------------------------------------------------------------
  const cam = {
    yaw: Math.PI, pitch: 0.32, dist: 8,
    manualUntil: 0, shot: null,
  };

  function applyDrag(dx, dy) {
    cam.yaw -= dx * 0.005;
    cam.pitch = Math.max(0.06, Math.min(1.15, cam.pitch + dy * 0.004));
    cam.manualUntil = performance.now() / 1000 + 2.5;
  }

  function setShotCamera(yaw, pitch, dist, target) {
    cam.shot = { yaw, pitch, dist, target };
  }
  function clearShotCamera() { cam.shot = null; }

  function updateCamera(dt, time) {
    const p = game.player;
    const inCar = p.inCar;
    let target = { x: p.x, y: p.y + 1.6, z: p.z };
    if (cam.shot) {
      const s = cam.shot;
      const cx = s.target.x + Math.sin(s.yaw) * Math.cos(s.pitch) * s.dist;
      const cy = s.target.y + Math.sin(s.pitch) * s.dist;
      const cz = s.target.z + Math.cos(s.yaw) * Math.cos(s.pitch) * s.dist;
      camera.position.set(cx, cy, cz);
      camera.lookAt(s.target.x, s.target.y, s.target.z);
      return;
    }
    if (inCar) {
      target = { x: inCar.x, y: 1.8, z: inCar.z };
      const wantDist = 11;
      const wantPitch = 0.24;
      if (time > cam.manualUntil) {
        cam.yaw = angleLerp(cam.yaw, inCar.angle + Math.PI, Math.min(1, dt * 1.8));
        cam.pitch += (wantPitch - cam.pitch) * Math.min(1, dt * 2);
      }
      cam.dist += (wantDist - cam.dist) * Math.min(1, dt * 3);
    } else {
      const wantDist = 7.5;
      cam.dist += (wantDist - cam.dist) * Math.min(1, dt * 3);
    }
    const cx = target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    const cy = target.y + Math.sin(cam.pitch) * cam.dist;
    const cz = target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    // Keep the camera out of buildings: lift it when the line is blocked is overkill;
    // a simple floor keeps it above the street.
    camera.position.set(cx, Math.max(cy, 1.2), cz);
    camera.lookAt(target.x, target.y, target.z);
    // Sun follows the player so shadows stay crisp nearby.
    sun.position.set(target.x + 70, 110, target.z + 45);
    sun.target.position.set(target.x, 0, target.z);
  }

  function cameraAim() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return { pos: camera.position, dir };
  }

  // --- HUD -----------------------------------------------------------------------
  const el = (id) => document.getElementById(id);
  const hud = {
    cash: el('cash'), stars: el('stars'), healthFill: el('health-fill'),
    healthNum: el('health-num'), ammo: el('ammo'), objective: el('objective'),
    speed: el('speed'), speedLabel: el('speed-label'), messages: el('messages'),
    vignette: el('vignette'), toast: el('toast'), minimap: el('minimap'),
  };
  const mapCtx = hud.minimap ? hud.minimap.getContext('2d') : null;

  function updateHUD() {
    const s = game.state;
    if (hud.cash) hud.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
    if (hud.stars) {
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < s.wanted ? '★' : '☆';
      hud.stars.textContent = stars;
      hud.stars.classList.toggle('hot', s.wanted > 0);
    }
    if (hud.healthFill) hud.healthFill.style.width = `${Math.max(0, s.health)}%`;
    if (hud.healthNum) hud.healthNum.textContent = `${Math.max(0, Math.ceil(s.health))}`;
    if (hud.ammo) hud.ammo.textContent = s.reloading > 0 ? 'RELOADING' : `AMMO ${s.ammo} / 12`;
    if (hud.objective) hud.objective.textContent = game.objectiveText();
    const car = game.player.inCar;
    if (hud.speed) hud.speed.textContent = car ? `${Math.round(Math.abs(car.speed) * 3.6)}` : '';
    if (hud.speedLabel) hud.speedLabel.textContent = car ? 'km/h' : '';
    if (hud.messages) {
      const recent = s.messages.slice(-3);
      hud.messages.innerHTML = recent.map((m) => `<div>${m.text}</div>`).join('');
    }
    if (hud.vignette) {
      const hurt = s.health < 35 ? 0.45 : s.wanted > 0 ? 0.18 : 0;
      hud.vignette.style.opacity = String(hurt);
    }
    drawMinimap();
  }

  function drawMinimap() {
    if (!mapCtx) return;
    const W = 190; const H = 190;
    const span = CITY_HALF * 2 + 60;
    const toX = (x) => ((x + CITY_HALF + 10) / span) * W;
    const toY = (z) => ((z + CITY_HALF + 10) / span) * H;
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = '#10151d';
    mapCtx.fillRect(0, 0, W, H);
    // Sea + beach (south edge).
    mapCtx.fillStyle = '#2e6f8e';
    mapCtx.fillRect(0, toY(CITY_HALF), W, H - toY(CITY_HALF));
    mapCtx.fillStyle = '#d9c28a';
    mapCtx.fillRect(0, toY(CITY_HALF) - 3, W, 3);
    // Roads.
    mapCtx.strokeStyle = '#3a3f47';
    mapCtx.lineWidth = 4;
    for (const line of game.city.roadLines) {
      mapCtx.beginPath(); mapCtx.moveTo(toX(line), 0); mapCtx.lineTo(toX(line), H); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, toY(line)); mapCtx.lineTo(W, toY(line)); mapCtx.stroke();
    }
    // Beacon / mission marker.
    if (game.beaconPos.active) {
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      mapCtx.fillStyle = '#ffd34d';
      mapCtx.beginPath(); mapCtx.arc(toX(game.beaconPos.x), toY(game.beaconPos.z), pulse, 0, TAU); mapCtx.fill();
      mapCtx.fillStyle = '#10151d';
      mapCtx.font = 'bold 10px sans-serif'; mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle';
      mapCtx.fillText('!', toX(game.beaconPos.x), toY(game.beaconPos.z));
    }
    // Traffic (white), police (red), target car (green).
    for (const car of game.cars) {
      if (car === game.player.inCar) continue;
      if (car.police) mapCtx.fillStyle = '#ff4040';
      else if (car.target) mapCtx.fillStyle = '#37d67a';
      else if (car.traffic) mapCtx.fillStyle = '#c8ccd4';
      else continue;
      mapCtx.beginPath(); mapCtx.arc(toX(car.x), toY(car.z), car.police ? 3.5 : 2.5, 0, TAU); mapCtx.fill();
    }
    // Player arrow.
    const p = game.player;
    const px = toX(p.x); const py = toY(p.z);
    const ang = p.inCar ? p.inCar.angle : p.angle;
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.atan2(Math.sin(ang), -Math.cos(ang)) + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 5); mapCtx.lineTo(-5, 5); mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function draw(dt, time) {
    for (const c of clouds) {
      c.position.x += dt * 1.2;
      if (c.position.x > 320) c.position.x = -320;
    }
    updateCamera(dt, time);
    updateHUD();
    renderer.render(scene, camera);
  }

  function showScreen(name) {
    for (const id of ['screen-title', 'screen-pause', 'screen-end']) {
      const n = el(id);
      if (n) n.classList.toggle('hidden', id !== name);
    }
  }

  function showToast(text, ms = 2600) {
    if (!hud.toast) return;
    hud.toast.textContent = text;
    hud.toast.classList.remove('hidden');
    setTimeout(() => hud.toast.classList.add('hidden'), ms);
  }

  return {
    renderer, scene, camera, cam,
    draw, resize, applyDrag, setShotCamera, clearShotCamera,
    cameraAim, updateHUD, showScreen, showToast,
  };
}
