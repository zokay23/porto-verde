// Boot + game loop for Porto Verde.
// Input, title screen, pause, save, and the per-frame wiring between
// the sim, the renderer and the audio synth.
import { makeRng } from './random.js';
import { CONFIG, STORY } from './config.js';
import { createSim, updateSim, missionTarget, enterCar, exitCar, shoot, punch, saveGame, loadSave, startMission } from './sim.js';
import { createRenderer } from './render.js';
import { GameAudio } from './audio.js';
import { shotName, applyShot, seedFromUrl } from './shots.js';

const rng = makeRng(seedFromUrl());
const sim = createSim({ landmarks: { garage: { x: -125, z: -125 }, marlin: { x: 125, z: 125 }, plaza: { x: 0, z: 0 } } }, rng);
// The renderer builds the real city and replaces sim.city with it.
const view = createRenderer(sim, rng);
const audio = new GameAudio();

const input = {
  forward: false, back: false, left: false, right: false, run: false, jump: false,
  camYaw: Math.PI, camPitch: 0,
};
let dragging = false, lastX = 0, lastY = 0;

const titleEl = document.getElementById('title');
const titleText = document.getElementById('title-text');
const startBtn = document.getElementById('start-btn');
const continueBtn = document.getElementById('continue-btn');
const pauseEl = document.getElementById('pause');

function refreshTitle() {
  const save = loadSave();
  titleText.innerHTML = `<b>${STORY.city}</b> — ${STORY.hero}<br>${STORY.intro}<br><br>` +
    `WASD drive / walk &nbsp;•&nbsp; E steal car &nbsp;•&nbsp; Click shoot &nbsp;•&nbsp; F punch &nbsp;•&nbsp; R reload &nbsp;•&nbsp; P pause<br>` +
    (save ? `Save found: mission ${save.missionIndex + 1}, $${save.cash}.` : 'No save yet — a new week starts tonight.');
  continueBtn.style.display = save ? 'inline-block' : 'none';
}

function beginGame(fromSave) {
  audio.ensure();
  if (fromSave) {
    const save = loadSave();
    if (save) {
      sim.player.cash = save.cash;
      startMission(sim, Math.min(save.missionIndex, 4));
    }
  }
  sim.started = true;
  titleEl.style.display = 'none';
  pauseEl.style.display = 'none';
}

startBtn.addEventListener('click', () => beginGame(false));
continueBtn.addEventListener('click', () => beginGame(true));

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') input.forward = true;
  if (k === 's' || e.key === 'ArrowDown') input.back = true;
  if (k === 'a' || e.key === 'ArrowLeft') input.left = true;
  if (k === 'd' || e.key === 'ArrowRight') input.right = true;
  if (k === 'shift') input.run = true;
  if (k === ' ') { input.jump = true; e.preventDefault(); }
  if (k === 'e' && sim.started && !sim.paused) {
    if (sim.player.inCar) exitCar(sim); else enterCar(sim, audio);
  }
  if (k === 'f' && sim.started && !sim.paused && !sim.player.inCar) punch(sim, audio);
  if (k === 'r' && sim.started) {
    sim.player.ammo = CONFIG.magSize;
    audio.pickup();
  }
  if (k === 'p' && sim.started) {
    sim.paused = !sim.paused;
    pauseEl.style.display = sim.paused ? 'block' : 'none';
  }
  if (k === 'm') audio.toggleMute();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') input.forward = false;
  if (k === 's' || e.key === 'ArrowDown') input.back = false;
  if (k === 'a' || e.key === 'ArrowLeft') input.left = false;
  if (k === 'd' || e.key === 'ArrowRight') input.right = false;
  if (k === 'shift') input.run = false;
  if (k === ' ') input.jump = false;
});
window.addEventListener('mousedown', (e) => {
  if (!sim.started || sim.paused) return;
  if (e.target.id === 'hud' || e.target.id === 'game3d') {
    if (e.button === 0 && !sim.player.inCar) shoot(sim, audio);
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  }
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  input.camYaw -= (e.clientX - lastX) * 0.005;
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('resize', () => view.resize());

// Screenshot mode: stage the scene, hide the title, and hold the sim
// still so the render is exactly the staged moment.
const shot = shotName();
if (shot) {
  applyShot(sim, shot);
  // Aim the chase camera across the staged scene, not into a wall.
  input.camYaw = shot === 'action' ? Math.PI + 0.25
    : shot === 'drive' ? Math.PI / 2 + 0.4
    : shot === 'mission' ? Math.PI / 2
    : Math.PI;
  titleEl.style.display = 'none';
  document.body.classList.add('shot');
}

// Expose the live state for play-tests and debugging.
window.__porto = { sim, input, audio, view };

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  sim._target = sim.mission ? missionTarget(sim) : null;
  if (sim.started && !sim.paused && !sim.shotMode) {
    updateSim(sim, input, dt, audio);
    if (Math.floor(sim.time * 2) !== Math.floor((sim.time - dt) * 2)) saveGame(sim);
  }
  view.frame(input, dt);
  requestAnimationFrame(loop);
}

refreshTitle();
requestAnimationFrame(loop);
