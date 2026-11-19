// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between four
// screens: title, play, paused and busted/wasted.
//
// ?seed=N fixes the city. ?shot=action|drive|mission|chase (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { createAudio } from './audio.js';
import { createGame } from './sim.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { GAME_TITLE, SAVE_KEY } from './config.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const game = createGame(audio);
const renderer = createRenderer(canvas, game);

// Inspection handle (the starter pattern: window.__shotReady for shots). Lets an
// automated test drive the real game and lets a player inspect state; it changes nothing.
window.__game = game;
window.__renderer = renderer;

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

function announce(message) {
  if (status) status.textContent = message;
}

// --- input -----------------------------------------------------------------------
const keys = new Set();
let mouseDown = false;
let mouseDownPos = null;
let mouseDownTime = 0;
let shooting = false;
let shootPulse = false;
const pressed = new Set();

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const action = KEYMAP[e.code];
  if (action) { keys.add(action); e.preventDefault(); }
  if (e.code === 'KeyE') pressed.add('enter');
  if (e.code === 'KeyF') pressed.add('punch');
  if (e.code === 'KeyR') pressed.add('reload');
  if (e.code === 'KeyM') audio.setMuted(!audio.isMuted());
  if (e.code === 'KeyP' || e.code === 'Escape') pressed.add('pause');
  if (e.code === 'Enter') pressed.add('confirm');
});
window.addEventListener('keyup', (e) => {
  const action = KEYMAP[e.code];
  if (action) keys.delete(action);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    mouseDown = true; shooting = true;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    mouseDownTime = performance.now();
  } else if (e.button === 2) {
    mouseDownPos = { x: e.clientX, y: e.clientY };
    mouseDownTime = performance.now();
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) { mouseDown = false; shooting = false; }
  mouseDownPos = null;
});
window.addEventListener('mousemove', (e) => {
  if (!mouseDownPos) return;
  const dx = e.clientX - mouseDownPos.x;
  const dy = e.clientY - mouseDownPos.y;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  // Right-drag (or a long left-drag) orbits the camera; a quick left click shoots.
  if (e.buttons & 2 || (e.buttons & 1 && Math.abs(dx) + Math.abs(dy) > 2)) {
    renderer.applyDrag(dx, dy);
  }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  renderer.cam.dist = Math.max(4, Math.min(18, renderer.cam.dist + Math.sign(e.deltaY) * 1.5));
}, { passive: false });

// --- screens ----------------------------------------------------------------------
const titleEl = document.getElementById('screen-title');
const pauseEl = document.getElementById('screen-pause');
const endEl = document.getElementById('screen-end');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');
const continueBtn = document.getElementById('btn-continue');
const startBtn = document.getElementById('btn-start');
const resumeBtn = document.getElementById('btn-resume');
const quitBtn = document.getElementById('btn-quit');
const respawnBtn = document.getElementById('btn-respawn');

function showOnly(el) {
  for (const n of [titleEl, pauseEl, endEl]) if (n) n.classList.toggle('hidden', n !== el);
  renderer.showScreen(el ? el.id : '');
}

function refreshTitle() {
  const save = game.loadGame();
  if (continueBtn) {
    continueBtn.classList.toggle('hidden', !save);
    if (save) continueBtn.textContent = `Continue — Mission ${Math.min(save.missionIndex + 1, 5)} · $${save.cash}`;
  }
  document.title = GAME_TITLE;
}

function startPlaying(fromSave) {
  audio.unlock();
  game.startNewGame(fromSave ? game.loadGame() : null);
  showOnly(null);
  announce('Playing. WASD to move, E to take a car, F to punch, click to shoot.');
}

if (startBtn) startBtn.addEventListener('click', () => startPlaying(false));
if (continueBtn) continueBtn.addEventListener('click', () => startPlaying(true));
if (resumeBtn) resumeBtn.addEventListener('click', () => { game.state.mode = 'play'; showOnly(null); });
if (quitBtn) quitBtn.addEventListener('click', () => { game.state.mode = 'title'; game.saveGame(); refreshTitle(); showOnly(titleEl); });
if (respawnBtn) respawnBtn.addEventListener('click', () => {
  game.respawn(game.state.mode === 'wasted' ? 'hospital' : 'garage');
  showOnly(null);
});

// --- shot mode ----------------------------------------------------------------------
function runShot(name) {
  showOnly(null); // no title/pause/end overlay over the shot
  const pose = stageShot(name, game, renderer);
  renderer.setShotCamera(pose.yaw, pose.pitch, pose.dist, pose.target);
  renderer.cam.yaw = pose.yaw;
  let painted = 0;
  function paint() {
    renderer.draw(STEP, game.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- live game ------------------------------------------------------------------------
function runGame() {
  refreshTitle();
  showOnly(titleEl);
  announce(`${GAME_TITLE}. Press Enter or click Start.`);
  let last = performance.now();
  let accumulator = 0;
  let lastMode = game.state.mode;
  let lastMission = game.state.missionIndex;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Screen transitions.
    if (pressed.has('confirm') && game.state.mode === 'title') startPlaying(false);
    if (pressed.has('pause')) {
      if (game.state.mode === 'play') { game.state.mode = 'paused'; showOnly(pauseEl); }
      else if (game.state.mode === 'paused') { game.state.mode = 'play'; showOnly(null); }
    }
    if (game.state.mode !== lastMode) {
      if (game.state.mode === 'busted' || game.state.mode === 'wasted') {
        if (endTitle) endTitle.textContent = game.state.mode === 'busted' ? 'BUSTED' : 'WASTED';
        if (endText) endText.textContent = game.state.mode === 'busted'
          ? 'The Verde PD took you in. You lose 10% of your cash.'
          : 'You got wasted. St. Verde patched you up — for 10% of your cash.';
        showOnly(endEl);
      }
      lastMode = game.state.mode;
    }
    if (game.state.missionIndex !== lastMission) {
      lastMission = game.state.missionIndex;
      if (game.state.missionIndex < 5) renderer.showToast('MISSION COMPLETE');
    }

    if (game.state.mode === 'play') {
      accumulator += dt;
      while (accumulator >= STEP) {
        const inCar = !!game.player.inCar;
        const input = {
          fwd: keys.has('fwd'), back: keys.has('back') || (inCar && keys.has('jump')),
          left: keys.has('left'), right: keys.has('right'),
          run: keys.has('run'), jump: !inCar && keys.has('jump'),
          enter: pressed.has('enter'), punch: pressed.has('punch'), reload: pressed.has('reload'),
          shoot: shooting || shootPulse,
          camYaw: renderer.cam.yaw, camPos: null, camDir: null,
        };
        if (input.shoot) {
          const aim = renderer.cameraAim();
          input.camPos = { x: aim.pos.x, y: aim.pos.y, z: aim.pos.z };
          input.camDir = { x: aim.dir.x, y: aim.dir.y, z: aim.dir.z };
        }
        game.step(STEP, input);
        accumulator -= STEP;
        pressed.clear();
        shootPulse = false;
      }
    } else {
      accumulator = 0;
      pressed.clear();
    }
    renderer.draw(dt, game.state.time);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state.mode === 'play') {
      game.state.mode = 'paused';
      showOnly(pauseEl);
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
