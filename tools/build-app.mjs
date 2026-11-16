// Builds Baseline (app/) into a static folder for GitHub Pages and stamps the service worker
// with a content hash and the full file list, so every deploy refreshes the offline cache.
// Usage: node tools/build-app.mjs [out-dir]   (default: docs/app)
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const src = new URL('../app/', import.meta.url).pathname;
const out = path.resolve(process.argv[2] || new URL('../docs/app/', import.meta.url).pathname);

async function walk(dir, base = '') {
  const list = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = path.posix.join(base, e.name);
    if (e.isDirectory()) list.push(...(await walk(path.join(dir, e.name), rel)));
    else list.push(rel);
  }
  return list;
}
const files = (await walk(src)).sort();
const hash = createHash('sha256');
for (const f of files) if (f !== 'sw.js') hash.update(f).update(await readFile(path.join(src, f)));
const version = hash.digest('hex').slice(0, 10);

for (const f of files) {
  await mkdir(path.dirname(path.join(out, f)), { recursive: true });
  if (f === 'sw.js') {
    const precache = ['./', ...files.filter((x) => x !== 'sw.js' && !x.endsWith('.webmanifest')).map((x) => './' + x)];
    const sw = (await readFile(path.join(src, f), 'utf8'))
      .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
      .replace("const FILES = ['./', './index.html'];", `const FILES = ${JSON.stringify(precache)};`);
    await writeFile(path.join(out, f), sw);
  } else await copyFile(path.join(src, f), path.join(out, f));
}
console.log(`Built Baseline ${version}: ${files.length} files -> ${out}`);
