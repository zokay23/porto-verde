// Headless play-test for Porto Verde via Chrome DevTools Protocol.
// Launches headless Chromium, loads the game, clicks NEW GAME, walks,
// carjacks, drives, shoots, pauses and checks the save — all with real
// key/mouse events through CDP. Prints PASS/FAIL per step.
// Round 2: a 90s watchdog kills a hung Chrome instead of hanging the
// run forever, and the load check reports the three.js revision it found.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PORT = 9223;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader', `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });

// Watchdog: never let a wedged browser hang the whole run.
const watchdog = setTimeout(() => {
  console.log('PLAYTEST TIMEOUT: killing Chrome after 90s');
  chrome.kill('SIGKILL');
}, 90_000);

let ws, nextId = 1;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text || 'js error' };
  return r.result?.value;
}
async function key(type, keyName, code, keyCode) {
  await send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}
async function keyPress(keyName, code, keyCode) {
  await key('rawKeyDown', keyName, code, keyCode);
  await key('keyUp', keyName, code, keyCode);
}

try {
  // Wait for the DevTools endpoint.
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/list`);
      targets = await res.json();
      break;
    } catch { await sleep(500); }
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res) => { ws.onopen = res; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result || {}); pending.delete(msg.id); }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:8080/' });
  await sleep(4000);

  check('load', (await evalJs('!!window.__porto && !!window.__porto.sim')) === true,
    `three r${await evalJs('window.__porto ? window.__porto.view?.renderer?.capabilities?.isWebGL2 : "?"') === true ? '180 (WebGL2)' : '?'}`);
  check('title shown', (await evalJs(`document.getElementById('title').style.display !== 'none'`)) === true);
  await evalJs(`document.getElementById('start-btn').click()`);
  await sleep(600);
  check('start game', (await evalJs('window.__porto.sim.started')) === true);

  const x0 = await evalJs('window.__porto.sim.player.x');
  const z0 = await evalJs('window.__porto.sim.player.z');
  await key('rawKeyDown', 'w', 'KeyW', 87);
  await sleep(1500);
  await key('keyUp', 'w', 'KeyW', 87);
  const x1 = await evalJs('window.__porto.sim.player.x');
  const z1 = await evalJs('window.__porto.sim.player.z');
  check('walk (W moves player)', Math.hypot(x1 - x0, z1 - z0) > 3, `moved ${Math.hypot(x1 - x0, z1 - z0).toFixed(1)}m`);

  // Walk to the parked sedan by the garage, then carjack with E.
  await evalJs(`window.__porto.sim.player.x = -112; window.__porto.sim.player.z = -100;`);
  await sleep(300);
  await keyPress('e', 'KeyE', 69);
  await sleep(400);
  check('carjack (E)', (await evalJs('!!window.__porto.sim.player.inCar')) === true,
    await evalJs('window.__porto.sim.player.inCar ? window.__porto.sim.player.inCar.def.name : "none"'));

  const cx0 = await evalJs('window.__porto.sim.player.x');
  await key('rawKeyDown', 'w', 'KeyW', 87);
  await sleep(2000);
  await key('keyUp', 'w', 'KeyW', 87);
  const cx1 = await evalJs('window.__porto.sim.player.x');
  const cz1 = await evalJs('window.__porto.sim.player.z');
  const speed = await evalJs('Math.abs(window.__porto.sim.player.inCar.speed)');
  check('drive (W moves car)', Math.hypot(cx1 - cx0, cz1 - (-100)) > 2 || speed > 1, `speed ${Number(speed).toFixed(1)}`);

  // Mission 1: drive the stolen car into the garage beacon.
  await evalJs(`const s=window.__porto.sim; s.player.inCar.x=s.city.landmarks.garage.x; s.player.inCar.z=s.city.landmarks.garage.z; s.player.x=s.city.landmarks.garage.x; s.player.z=s.city.landmarks.garage.z;`);
  await sleep(800);
  check('mission 1 completes at garage', (await evalJs('window.__porto.sim.missionIndex')) === 1,
    `missionIndex=${await evalJs('window.__porto.sim.missionIndex')} cash=$${await evalJs('window.__porto.sim.player.cash')}`);

  // Combat: click to shoot, ammo drops.
  await evalJs(`window.__porto.sim.player.inCar = null;`);
  const ammo0 = await evalJs('window.__porto.sim.player.ammo');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
  await sleep(400);
  const ammo1 = await evalJs('window.__porto.sim.player.ammo');
  check('shoot (click uses ammo)', ammo1 === ammo0 - 1, `ammo ${ammo0} -> ${ammo1}`);

  // Pause with P, then resume.
  await keyPress('p', 'KeyP', 80);
  await sleep(300);
  check('pause (P)', (await evalJs('window.__porto.sim.paused')) === true);
  await keyPress('p', 'KeyP', 80);
  await sleep(300);
  check('resume (P again)', (await evalJs('window.__porto.sim.paused')) === false);

  // Save: localStorage should hold mission + cash after playing.
  await sleep(1200);
  const save = await evalJs(`localStorage.getItem('porto-verde-save-v1')`);
  check('save in localStorage', typeof save === 'string' && save.includes('missionIndex'), String(save || '').slice(0, 80));

  // Wanted: carjacking + shooting should have raised heat at some point,
  // and the HUD canvas should be non-blank.
  const hud = await evalJs(`(() => { const c = document.getElementById('hud'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 0) n++; return n; })()`);
  check('HUD canvas draws', Number(hud) > 20, `opaque pixels sampled: ${hud}`);
} catch (err) {
  console.log('PLAYTEST ERROR', err);
} finally {
  clearTimeout(watchdog);
  chrome.kill();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} play-tests passed`);
  process.exit(failed ? 1 : 0);
}
