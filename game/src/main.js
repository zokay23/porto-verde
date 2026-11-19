// Porto Verde — boot, input, game loop and the ?shot= screenshot hook.
import * as THREE from 'three';
import { createAudio } from './audio.js';
import { createGame } from './sim.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const audio = createAudio();
const game = createGame(audio);
const renderer = createRenderer(game);

window.__game = game;
window.__renderer = renderer;
window.__THREE = THREE;

const input = {
  fwd: false, back: false, left: false, right: false, run: false, jump: false,
  punch: false, reload: false, shoot: false, enter: false,
  camYaw: 0, camPos: null, camDir: null,
};

// Aim from the camera through the centre of the screen.
function readMouse() {
  const v = new THREE.Vector3(0, 0, -1).applyQuaternion(renderer.camera.quaternion);
  const p = renderer.camera.position;
  input.camPos = { x: p.x, y: p.y, z: p.z };
  input.camDir = { x: v.x, y: v.y, z: v.z };
  input.camYaw = renderer.camState.yaw;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.code;
  if (k === 'KeyW' || k === 'ArrowUp') input.fwd = true;
  if (k === 'KeyS' || k === 'ArrowDown') input.back = true;
  if (k === 'KeyA' || k === 'ArrowLeft') input.left = true;
  if (k === 'KeyD' || k === 'ArrowRight') input.right = true;
  if (k === 'ShiftLeft' || k === 'ShiftRight') input.run = true;
  if (k === 'Space') { input.jump = true; e.preventDefault(); }
  if (k === 'KeyE') input.enter = true;
  if (k === 'KeyF') input.punch = true;
  if (k === 'KeyR') input.reload = true;
  if (k === 'KeyP') {
    if (game.state.mode === 'play') pauseGame();
    else if (game.state.mode === 'paused') resumeGame();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.code;
  if (k === 'KeyW' || k === 'ArrowUp') input.fwd = false;
  if (k === 'KeyS' || k === 'ArrowDown') input.back = false;
  if (k === 'KeyA' || k === 'ArrowLeft') input.left = false;
  if (k === 'KeyD' || k === 'ArrowRight') input.right = false;
  if (k === 'ShiftLeft' || k === 'ShiftRight') input.run = false;
  if (k === 'Space') input.jump = false;
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && game.state.mode === 'play') {
    readMouse();
    input.shoot = true;
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.shoot = false;
});

// Right/middle-drag orbits the camera.
let dragging = false;
let lastX = 0;
let lastY = 0;
window.addEventListener('mousedown', (e) => {
  if (e.button === 2 || e.button === 1) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  renderer.camState.yaw -= (e.clientX - lastX) * 0.005;
  renderer.camState.pitch = Math.max(-0.1, Math.min(0.7, renderer.camState.pitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Pointer lock on click for mouse-look (optional; drag also works).
document.getElementById('game').addEventListener('click', () => {
  if (game.state.mode === 'play') {
    document.getElementById('game').requestPointerLock?.();
  }
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) return;
  const onMove = (e) => {
    renderer.camState.yaw -= e.movementX * 0.003;
    renderer.camState.pitch = Math.max(-0.1, Math.min(0.7, renderer.camState.pitch + e.movementY * 0.002));
  };
  document.addEventListener('mousemove', onMove);
  const off = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('pointerlockchange', off);
  };
  document.addEventListener('pointerlockchange', off);
});

function pauseGame() {
  game.state.mode = 'paused';
  audio.setEngine(0, false);
  audio.setSiren(false);
  renderer.showPause();
}
function resumeGame() {
  game.state.mode = 'play';
  renderer.hideScreen();
}
window.__startGame = (fromSave) => {
  audio.unlock();
  audio.startMusic();
  renderer.hideScreen();
  game.startNewGame(fromSave ? game.loadGame() : null);
};
window.__resumeGame = resumeGame;
window.__quitToTitle = () => {
  game.state.mode = 'title';
  game.reset();
  audio.setEngine(0, false);
  audio.setSiren(false);
  renderer.showTitle();
};
window.__respawnAfterEnd = (where) => {
  renderer.hideScreen();
  game.respawn(where);
};

renderer.showTitle();

// --- main loop -------------------------------------------------------------------
let last = performance.now();
let shotReadyFn = null;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  readMouse();
  input.camYaw = renderer.camState.yaw;
  game.step(dt, input);
  // Edge-triggered actions are consumed by the step.
  input.enter = false;
  input.punch = false;
  input.reload = false;
  input.jump = false;
  if (game.state.mode === 'busted' || game.state.mode === 'wasted') {
    const kind = game.state.mode;
    game.state.mode = 'end';
    renderer.showEnd(kind);
    audio.setEngine(0, false);
    audio.setSiren(false);
  }
  renderer.render(dt);
  if (shotReadyFn && shotReadyFn()) {
    window.__shotReady = true;
    shotReadyFn = null;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- ?shot= hook ------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = parseInt(params.get('seed') || '7', 10);
  audio.unlock();
  renderer.hideScreen();
  shotReadyFn = stageShot(game, renderer, shot, seed);
  window.__shotName = shot;
}
