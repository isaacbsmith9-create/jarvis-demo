// MacroLens server: serves the app and a small JSON API.
//   GET  /api/status                 -> { ai: bool }
//   GET  /api/foods/search?q=...     -> built-in + Open Food Facts results
//   GET  /api/barcode/:code          -> one product or 404
//   POST /api/analyze  {imageBase64?, mediaType?, text?} -> AI meal estimate
// The diary itself lives in the browser (localStorage), so the server is stateless.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { searchLocal } from './lib/foods.js';
import { lookupBarcode, searchProducts } from './lib/openfoodfacts.js';
import { analyzeMeal, hasCredentials, MODEL } from './lib/ai.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 8 * 1024 * 1024;

const STATIC = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['public/styles.css', 'text/css; charset=utf-8'],
  '/manifest.webmanifest': ['public/manifest.webmanifest', 'application/manifest+json'],
  '/icon.svg': ['public/icon.svg', 'image/svg+xml'],
  '/lib/nutrition.js': ['lib/nutrition.js', 'text/javascript; charset=utf-8'],
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && STATIC[url.pathname]) {
        const [file, type] = STATIC[url.pathname];
        return send(res, 200, await readFile(path.join(here, file)), type);
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        return json(res, 200, { ai: hasCredentials(), model: MODEL });
      }
      if (req.method === 'GET' && url.pathname === '/api/foods/search') {
        return json(res, 200, await search(url.searchParams.get('q') ?? ''));
      }
      const bc = url.pathname.match(/^\/api\/barcode\/(\d{6,14})$/);
      if (req.method === 'GET' && bc) {
        const food = await lookupBarcode(bc[1]);
        return food ? json(res, 200, food) : json(res, 404, { error: 'Product not found' });
      }
      if (req.method === 'POST' && url.pathname === '/api/analyze') {
        if (!hasCredentials()) {
          return json(res, 503, { error: 'AI scanning is off: start the server with ANTHROPIC_API_KEY set.' });
        }
        const body = await readJson(req);
        return json(res, 200, await analyzeMeal(body));
      }
      json(res, 404, { error: 'Not found' });
    } catch (err) {
      if (err.status === 400) return json(res, 400, { error: err.message });
      if (err instanceof Anthropic.RateLimitError) return json(res, 429, { error: 'AI is busy, try again in a moment.' });
      if (err instanceof Anthropic.AuthenticationError) return json(res, 503, { error: 'AI key was rejected. Check ANTHROPIC_API_KEY.' });
      if (err instanceof Anthropic.APIError) return json(res, 502, { error: `AI error: ${err.message}` });
      console.error(err);
      json(res, 500, { error: err.message || 'Server error' });
    }
  });
}

async function search(q) {
  q = q.trim().slice(0, 100);
  if (!q) return { results: [], online: true };
  const local = searchLocal(q);
  try {
    const remote = await searchProducts(q);
    return { results: [...local, ...remote], online: true };
  } catch {
    return { results: local, online: false };
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Upload too large'), { status: 400 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, HOST, () => {
    console.log(`MacroLens running at http://${HOST}:${PORT}`);
    console.log(hasCredentials() ? `AI photo scanning: ON (${MODEL})` : 'AI photo scanning: OFF (set ANTHROPIC_API_KEY to enable)');
  });
}
