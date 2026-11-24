// main.js — Porto Verde bootstrap: input, game loop, menus, save/continue,
// and the ?shot= hook the screenshot tool uses.

import { CONFIG } from './config.js';
import { createGame, update, shoot, punch, reload, tryEnterCar, saveGame, loadSave, applySave, getBusted } from './sim.js';
import { drawScreen } from './render.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = createAudio();

const state = createGame(CONFIG.CITY_SEED);
const input = { up: false, down: false, left: false, right: false, run: false, jump: false };

const VW = 1280;
const VH = 720;
canvas.width = VW;
canvas.height = VH;

function resize() {
  const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  canvas.style.width = VW * scale + 'px';
  canvas.style.height = VH * scale + 'px';
}
window.addEventListener('resize', resize);
resize();

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');

function showOverlay(title, text, buttons) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove('hidden');
  btnNew.classList.toggle('hidden', !buttons.includes('new'));
  btnContinue.classList.toggle('hidden', !buttons.includes('continue'));
  btnResume.classList.toggle('hidden', !buttons.includes('resume'));
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function showTitle() {
  state.status = 'title';
  const save = loadSave(window.localStorage);
  const sub = save
    ? 'Cash $' + save.cash + ' · Mission ' + (save.missionIndex + 1) + '/5 · Dante "D" Marlow is back on the streets of Porto Verde.'
    : 'Dante "D" Marlow is back on the streets of Porto Verde. Five jobs. One city. No brakes.';
  showOverlay('PORTO VERDE', sub, save ? ['new', 'continue'] : ['new']);
}

btnNew.addEventListener('click', () => {
  audio.unlock();
  const fresh = createGame(CONFIG.CITY_SEED);
  Object.assign(state, fresh);
  state.status = 'playing';
  hideOverlay();
});

btnContinue.addEventListener('click', () => {
  audio.unlock();
  const save = loadSave(window.localStorage);
  if (save) applySave(state, save);
  state.status = 'playing';
  hideOverlay();
});

btnResume.addEventListener('click', () => {
  state.status = 'playing';
  hideOverlay();
});

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') {
    if (state.status === 'playing') {
      state.status = 'paused';
      showOverlay('PAUSED', 'Take a breath, D. The city waits.', ['resume']);
    } else if (state.status === 'paused') {
      state.status = 'playing';
      hideOverlay();
    }
    return;
  }
  if (e.code === 'KeyM') {
    audio.toggleMute();
    return;
  }
  if (state.status !== 'playing') return;
  const k = KEYMAP[e.code];
  if (k) {
    input[k] = true;
    e.preventDefault();
  }
  if (e.code === 'KeyE') {
    const r = tryEnterCar(state);
    if (r === 'enter') audio.engine();
  }
  if (e.code === 'KeyF') {
    if (punch(state)) audio.punch();
  }
  if (e.code === 'KeyR') {
    if (reload(state)) audio.reload();
  }
});

window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});

canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (state.status !== 'playing' || state.player.inCar) return;
  aimAt(e);
  if (shoot(state)) audio.shot();
});
canvas.addEventListener('mousemove', (e) => {
  if (state.status === 'playing' && !state.player.inCar) aimAt(e);
});

function aimAt(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (VW / rect.width);
  const sy = (e.clientY - rect.top) * (VH / rect.height);
  const p = state.player;
  // Aim from the centre of the screen toward the cursor.
  p.angle = Math.atan2(sy - VH / 2, sx - VW / 2);
}

let last = performance.now();
let saveTimer = 0;
let sirenOn = false;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state.status === 'playing') {
    update(state, input, dt);
    // Siren while wanted.
    if (state.wanted > 0 && !sirenOn) {
      audio.startSiren();
      sirenOn = true;
    } else if (state.wanted === 0 && sirenOn) {
      audio.stopSiren();
      sirenOn = false;
    }
    // Autosave every 10 seconds of play.
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      saveGame(state, window.localStorage);
    }
    if (state.status === 'busted') {
      audio.stopSiren();
      sirenOn = false;
      audio.busted();
      showOverlay('BUSTED!', 'Verde PD took 10% of your cash. You wake up at Verde General.', ['resume']);
    } else if (state.status === 'won') {
      audio.win();
      saveGame(state, window.localStorage);
      showOverlay('PORTO VERDE IS YOURS', 'All five jobs done. The Marlin is paid. Dante owns the night.', ['new']);
    }
  } else if (state.status === 'busted' && state.bustedTimer > 0) {
    state.bustedTimer -= dt;
    if (state.bustedTimer <= 0) {
      state.status = 'playing';
      hideOverlay();
    }
  }

  ctx.clearRect(0, 0, VW, VH);
  if (state.status === 'title') {
    drawScreen(ctx, state, VW, VH);
  } else {
    drawScreen(ctx, state, VW, VH);
  }
  requestAnimationFrame(loop);
}

// Screenshot mode: ?shot=action|drive|mission|chase stages a scene and
// signals readiness for the screenshot tool.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(state, shot);
  state.status = 'playing';
  hideOverlay();
  window.__shotReady = true;
} else {
  showTitle();
}

window.__portoVerde = { state, audio, saveGame, getBusted };
requestAnimationFrame(loop);
