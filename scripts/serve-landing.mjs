/**
 * Static file server for the marketing landing page (Phase 4).
 *
 * Zero dependencies so the page can be previewed without installing anything:
 *   npm run serve:landing   → http://localhost:3001
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../landing/', import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = join(ROOT, normalize(relative).replace(/^(\.\.[/\\])+/, ''));

  try {
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader(
      'Content-Type',
      CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream'
    );
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<h1>404 — page introuvable</h1>');
  }
});

server.listen(PORT, () => {
  console.log(`Landing page: http://localhost:${PORT}`);
});
