// Dossier builder for Porto Verde (make.fun gta6-01).
// Runs with plain Node 22: `MAKEFUN_OUTPUT_DIR=out node main.ts`
// Validates game/, screenshots/ and writes out/dossier.json (makefun/dossier/v1).
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ? path.resolve(process.env.MAKEFUN_OUTPUT_DIR) : path.join(root, 'out');
const gameDir = path.join(root, 'game');
const shotDir = path.join(root, 'screenshots');

const GAME_MAX_BYTES = 48 * 1024 * 1024;
const GAME_MAX_FILES = 993;
const TEXT_MAX_BYTES = 163840;
const SHOT_MAX_BYTES = 262144;
const SHOT_MAX_COUNT = 4;

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

async function walk(dir, base) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) out.push(...await walk(full, base));
    else out.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
  }
  return out;
}

async function main() {
  const errors = [];
  const gameFiles = await walk(gameDir, root);
  gameFiles.sort((a, b) => a.rel.localeCompare(b.rel));
  if (gameFiles.length > GAME_MAX_FILES) errors.push(`too many game files: ${gameFiles.length} > ${GAME_MAX_FILES}`);
  let totalBytes = 0;
  const files = [];
  for (const f of gameFiles) {
    const buf = await readFile(f.full);
    totalBytes += buf.length;
    files.push({ path: f.rel, bytes: buf.length, sha256: sha256(buf) });
  }
  if (totalBytes > GAME_MAX_BYTES) errors.push(`game too big: ${totalBytes} > ${GAME_MAX_BYTES}`);

  // Source text cap counts the code WE wrote, not the vendored third-party
  // library: game/vendor/three.*.js is the three.js distribution, excluded.
  let textBytes = 0;
  for (const f of files) {
    if (f.path.startsWith('game/vendor/')) continue;
    if (/\.(js|ts|html|json|css)$/.test(f.path)) textBytes += f.bytes;
  }
  if (textBytes > TEXT_MAX_BYTES) errors.push(`source text too big: ${textBytes} > ${TEXT_MAX_BYTES}`);

  // Entry point + import map sanity.
  const indexHtml = await readFile(path.join(gameDir, 'index.html'), 'utf8');
  if (!indexHtml.includes('src/main.js')) errors.push('game/index.html does not load src/main.js');
  if (!indexHtml.includes('three.module.min.js')) errors.push('game/index.html does not reference vendored three.js');

  // Screenshots: 3-4 real renders, each under the cap.
  const shotNames = (await readdir(shotDir)).filter((n) => /\.(jpg|jpeg|png)$/i.test(n)).sort();
  if (shotNames.length < 3 || shotNames.length > SHOT_MAX_COUNT) errors.push(`screenshots: need 3-4, found ${shotNames.length}`);
  const screenshots = [];
  for (const name of shotNames) {
    const buf = await readFile(path.join(shotDir, name));
    if (buf.length > SHOT_MAX_BYTES) errors.push(`screenshot ${name} too big: ${buf.length} > ${SHOT_MAX_BYTES}`);
    screenshots.push({ path: `screenshots/${name}`, bytes: buf.length, sha256: sha256(buf) });
  }

  // Copy game/ + screenshots/ into out/ for the harness.
  await mkdir(path.join(outDir, 'game'), { recursive: true });
  await mkdir(path.join(outDir, 'screenshots'), { recursive: true });
  for (const f of gameFiles) {
    const dest = path.join(outDir, f.rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(f.full, dest);
  }
  for (const name of shotNames) {
    await copyFile(path.join(shotDir, name), path.join(outDir, 'screenshots', name));
  }

  const dossier = {
    schema: 'makefun/dossier/v1',
    game: 'porto-verde',
    files,
    game_total_bytes: totalBytes,
    text_total_bytes: textBytes,
    screenshots,
    errors,
  };
  await writeFile(path.join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
  console.log(JSON.stringify({ files: files.length, game_total_bytes: totalBytes, text_total_bytes: textBytes, screenshots: screenshots.length, errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
