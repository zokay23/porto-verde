// main.ts — Porto Verde entrypoint: copies game/ and screenshots/ into the
// output directory and writes out/dossier.json with make.fun's buildDossier.
// Node standard library only. Run: MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier, DOSSIER_MAX_BYTES } from './vendor/makefun-game.ts';

const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const repoRoot = resolve(import.meta.dirname);

mkdirSync(outDir, { recursive: true });
for (const dir of ['game', 'screenshots']) {
  const src = join(repoRoot, dir);
  if (!existsSync(src)) throw new Error(`main.ts: missing ${dir}/ in ${repoRoot}`);
  cpSync(src, join(outDir, dir), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

if (dossier.length > DOSSIER_MAX_BYTES) {
  throw new Error(`main.ts: dossier ${dossier.length} bytes exceeds ${DOSSIER_MAX_BYTES}`);
}
if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('main.ts: game/index.html missing');
}

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Porto Verde dossier written: ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
