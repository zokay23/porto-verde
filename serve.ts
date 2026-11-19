// Dev server for Porto Verde: serves game/ statically on http://localhost:8080
// (or $PORT). No build step — the game runs straight from the files.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(root, 'game');
const port = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const full = path.join(gameDir, rel);
    if (!full.startsWith(gameDir)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const st = await stat(full);
    if (!st.isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
    createReadStream(full).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Porto Verde at http://localhost:${port}`);
});
