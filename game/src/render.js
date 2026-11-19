// Renderer: the three.js scene, the chase cameras, the HUD, the live minimap
// and the title / pause / busted / wasted screens. The simulation owns the world.
import * as THREE from 'three';
import { BLOCK, CITY_HALF, COLORS, GAME_SUBTITLE, GAME_TITLE, MISSIONS, PLAYER, STORY } from './config.js';

const TAU = Math.PI * 2;

export function createRenderer(game) {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 120, 420);
  scene.add(game.worldGroup);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 6, 14);

  const sun = new THREE.DirectionalLight(COLORS.sun, 2.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9e8, 0x5a5a48, 1.1));

  // --- camera rig -------------------------------------------------------------------
  const camState = { yaw: 0, pitch: 0.22, dist: 11, height: 4.5, shake: 0 };
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  function updateCamera(dt) {
    const p = game.player;
    const focus = p.inCar || null;
    const fx = focus ? focus.x : p.x;
    const fz = focus ? focus.z : p.z;
    const fy = focus ? 1.2 : p.y + 1.6;
    camTarget.set(fx, fy, fz);
    const d = camState.dist + (focus ? 3 : 0);
    const h = camState.height + (focus ? 1.5 : 0);
    camPos.set(
      fx + Math.sin(camState.yaw) * Math.cos(camState.pitch) * d,
      fy + h + Math.sin(camState.pitch) * d * 0.6,
      fz + Math.cos(camState.yaw) * Math.cos(camState.pitch) * d,
    );
    if (camState.shake > 0) {
      camState.shake = Math.max(0, camState.shake - dt * 2);
      camPos.x += (Math.random() - 0.5) * camState.shake;
      camPos.y += (Math.random() - 0.5) * camState.shake;
      camPos.z += (Math.random() - 0.5) * camState.shake;
    }
    camera.position.lerp(camPos, 1 - Math.pow(0.0001, dt));
    camera.lookAt(camTarget);
  }

  // --- HUD ----------------------------------------------------------------------------
  const hud = document.getElementById('hud');
  const hudHTML = `
    <div id="hud-top-left">
      <div id="hud-cash">$0</div>
      <div id="hud-stars"></div>
      <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-text">100</span></div>
    </div>
    <div id="hud-objective"></div>
    <div id="hud-minimap"><canvas id="minimap" width="180" height="180"></canvas></div>
    <div id="hud-bottom-right">
      <div id="hud-speed"></div>
      <div id="hud-ammo"></div>
      <div id="hud-car"></div>
    </div>
    <div id="hud-messages"></div>
    <div id="hud-crosshair">+</div>
    <div id="hud-vignette"></div>
    <div id="hud-damage"></div>
    <div id="hud-controls">WASD move &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; Space jump &nbsp;·&nbsp; E enter/exit car &nbsp;·&nbsp; F punch &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; R reload &nbsp;·&nbsp; P pause</div>
  `;
  hud.innerHTML = hudHTML;
  const el = {
    cash: document.getElementById('hud-cash'),
    stars: document.getElementById('hud-stars'),
    healthFill: document.getElementById('hud-health-fill'),
    healthText: document.getElementById('hud-health-text'),
    objective: document.getElementById('hud-objective'),
    minimap: document.getElementById('minimap'),
    speed: document.getElementById('hud-speed'),
    ammo: document.getElementById('hud-ammo'),
    car: document.getElementById('hud-car'),
    messages: document.getElementById('hud-messages'),
    crosshair: document.getElementById('hud-crosshair'),
    vignette: document.getElementById('hud-vignette'),
    damage: document.getElementById('hud-damage'),
  };
  const mm = el.minimap.getContext('2d');

  function drawMinimap() {
    const s = game.state;
    const w = 180; const half = CITY_HALF;
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
    mm.clearRect(0, 0, w, w);
    mm.fillStyle = 'rgba(12,16,22,0.78)';
    mm.beginPath(); mm.arc(w / 2, w / 2, w / 2, 0, TAU); mm.fill();
    mm.save();
    mm.beginPath(); mm.arc(w / 2, w / 2, w / 2 - 2, 0, TAU); mm.clip();
    const toMap = (x, z) => [w / 2 + (x / half) * (w / 2 - 4), w / 2 + (z / half) * (w / 2 - 4)];
    // Sea + beach.
    mm.fillStyle = '#2e6f8e';
    mm.fillRect(0, w / 2 + (CITY_HALF / half) * (w / 2 - 4), w, w);
    mm.fillStyle = '#d9c28a';
    mm.fillRect(0, w / 2 + ((CITY_HALF - 2) / half) * (w / 2 - 4), w, 6);
    // City ground.
    mm.fillStyle = '#3a3f47';
    const [gx, gy] = toMap(-half, -half);
    mm.fillRect(gx, gy, (2 * half / half) * (w / 2 - 4), (2 * half / half) * (w / 2 - 4));
    // Roads.
    mm.strokeStyle = '#565d68'; mm.lineWidth = 3;
    for (const line of game.city.roadLines) {
      const [ax, ay] = toMap(line, -half); const [bx, by] = toMap(line, half);
      mm.beginPath(); mm.moveTo(ax, ay); mm.lineTo(bx, by); mm.stroke();
      const [cx, cy] = toMap(-half, line); const [dx, dy] = toMap(half, line);
      mm.beginPath(); mm.moveTo(cx, cy); mm.lineTo(dx, dy); mm.stroke();
    }
    // Plaza.
    mm.fillStyle = '#4a7a4a';
    const [plx, ply] = toMap(37 - 30, 37 - 30);
    mm.fillRect(plx, ply, 60 / half * (w / 2 - 4), 60 / half * (w / 2 - 4));
    // Beacon blip.
    if (game.beaconPos.active) {
      const [bx2, by2] = toMap(game.beaconPos.x, game.beaconPos.z);
      const pulse = 6 + Math.sin(s.time * 5) * 2;
      mm.fillStyle = '#ffd34d';
      mm.beginPath(); mm.arc(bx2, by2, pulse, 0, TAU); mm.fill();
      mm.strokeStyle = '#fff'; mm.lineWidth = 1.5;
      mm.beginPath(); mm.arc(bx2, by2, pulse + 3, 0, TAU); mm.stroke();
    }
    // Police blips.
    mm.fillStyle = '#5a8cff';
    for (const c of game.policeCars) {
      const [cx2, cy2] = toMap(c.x, c.z);
      mm.beginPath(); mm.arc(cx2, cy2, 3, 0, TAU); mm.fill();
    }
    // Rival blips.
    mm.fillStyle = '#ff5a5a';
    for (const r of game.rivals) {
      if (r.down > 0) continue;
      const [rx, ry] = toMap(r.x, r.z);
      mm.beginPath(); mm.arc(rx, ry, 3, 0, TAU); mm.fill();
    }
    // Player arrow (points along the camera yaw, so "up" on the map is "forward").
    const [ux, uy] = toMap(px, pz);
    const ang = -camState.yaw + Math.PI;
    mm.save();
    mm.translate(ux, uy); mm.rotate(ang);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(0, 3); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.restore();
    mm.restore();
    // Rim.
    mm.strokeStyle = 'rgba(255,255,255,0.35)'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(w / 2, w / 2, w / 2 - 1, 0, TAU); mm.stroke();
    // North marker.
    mm.fillStyle = '#ffffff'; mm.font = 'bold 11px sans-serif'; mm.textAlign = 'center';
    mm.fillText('N', w / 2, 12);
  }

  function updateHUD() {
    const s = game.state;
    const p = game.player;
    el.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += `<span class="star ${i < s.wanted ? 'on' : 'off'}">★</span>`;
    el.stars.innerHTML = stars;
    el.healthFill.style.width = `${Math.max(0, Math.min(100, p.health))}%`;
    el.healthFill.style.background = p.health > 50 ? '#37d67a' : p.health > 25 ? '#e8b400' : '#e84040';
    el.healthText.textContent = Math.max(0, Math.round(p.health));
    el.objective.textContent = game.objectiveText();
    const car = p.inCar;
    if (car) {
      el.speed.textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`;
      el.car.textContent = car.name;
      el.ammo.textContent = '';
    } else {
      el.speed.textContent = '';
      el.car.textContent = '';
      el.ammo.textContent = s.reloading > 0 ? 'RELOADING…' : `AMMO ${s.ammo} / ${PLAYER.magSize}`;
    }
    const msgs = s.messages.slice(-4).map((m) => `<div class="msg">${m.text}</div>`).join('');
    if (el.messages.innerHTML !== msgs) el.messages.innerHTML = msgs;
    el.crosshair.style.display = (!car && s.mode === 'play') ? 'block' : 'none';
    el.vignette.style.opacity = s.wanted > 0 ? String(0.12 + s.wanted * 0.05) : '0';
    el.damage.style.opacity = p.health < 100 ? String(Math.min(0.7, (100 - p.health) / 100 * 0.9)) : '0';
    drawMinimap();
  }

  // --- screens ------------------------------------------------------------------------
  const screen = document.getElementById('screen');
  function showScreen(html) { screen.innerHTML = html; screen.style.display = 'flex'; }
  function hideScreen() { screen.style.display = 'none'; screen.innerHTML = ''; }

  function showTitle() {
    const save = game.loadGame();
    const savedLine = save && (save.cash > 0 || save.missionIndex > 0)
      ? `<p class="save-line">Save found — $${(save.cash || 0).toLocaleString('en-US')} · Mission ${Math.min((save.missionIndex || 0) + 1, MISSIONS.length)} of ${MISSIONS.length}</p>`
      : '';
    const continueBtn = save && (save.cash > 0 || save.missionIndex > 0)
      ? '<button id="btn-continue" class="menu-btn">CONTINUE</button>' : '';
    showScreen(`
      <div class="panel">
        <h1>${GAME_TITLE}</h1>
        <p class="tagline">${GAME_SUBTITLE}</p>
        <p class="story">${STORY.join('<br>')}</p>
        ${savedLine}
        <div class="menu-row">
          <button id="btn-start" class="menu-btn primary">START</button>
          ${continueBtn}
        </div>
        <p class="hint">WASD move · Shift run · Space jump · E enter/exit car · F punch · Click shoot · R reload · P pause</p>
        <p class="hint small">Original game made for the make.fun GTA 6 bounty. No Rockstar assets, names or maps.</p>
      </div>
    `);
    document.getElementById('btn-start').addEventListener('click', () => window.__startGame(false));
    const cont = document.getElementById('btn-continue');
    if (cont) cont.addEventListener('click', () => window.__startGame(true));
  }

  function showPause() {
    showScreen(`
      <div class="panel">
        <h1>PAUSED</h1>
        <p class="story">Porto Verde waits for no one — except right now.</p>
        <div class="menu-row">
          <button id="btn-resume" class="menu-btn primary">RESUME</button>
          <button id="btn-quit" class="menu-btn">QUIT TO TITLE</button>
        </div>
      </div>
    `);
    document.getElementById('btn-resume').addEventListener('click', () => window.__resumeGame());
    document.getElementById('btn-quit').addEventListener('click', () => window.__quitToTitle());
  }

  function showEnd(kind) {
    const s = game.state;
    const isBusted = kind === 'busted';
    const lost = Math.floor(s.cash * 0.1);
    showScreen(`
      <div class="panel">
        <h1 class="${isBusted ? 'busted' : 'wasted'}">${isBusted ? 'BUSTED' : 'WASTED'}</h1>
        <p class="story">${isBusted ? 'The Verde PD took you in.' : 'Porto Verde chewed you up.'}</p>
        <p class="story">You lost $${lost.toLocaleString('en-US')} (10% of your cash).</p>
        <div class="menu-row">
          <button id="btn-again" class="menu-btn primary">TRY AGAIN</button>
          <button id="btn-quit2" class="menu-btn">QUIT TO TITLE</button>
        </div>
      </div>
    `);
    document.getElementById('btn-again').addEventListener('click', () => window.__respawnAfterEnd(isBusted ? 'garage' : 'hospital'));
    document.getElementById('btn-quit2').addEventListener('click', () => window.__quitToTitle());
  }

  function render(dt) {
    updateCamera(dt);
    if (game.state.mode === 'play' || game.state.mode === 'paused') updateHUD();
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, camState, render, showTitle, showPause, showEnd, hideScreen, updateHUD };
}
