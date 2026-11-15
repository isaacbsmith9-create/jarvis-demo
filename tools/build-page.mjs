// Wraps a Claude page (written without <html>/<head>) into a standalone GitHub Pages document.
// Usage: node tools/build-page.mjs <src.html> <out-dir> <app name> <theme color> <icon.svg>
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const [src, outDir, name, color, icon] = process.argv.slice(2);
if (!src || !outDir || !name || !color || !icon) {
  console.error('Usage: node tools/build-page.mjs <src.html> <out-dir> <app name> <theme color> <icon.svg>');
  process.exit(1);
}
const body = await readFile(src, 'utf8');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${color}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${name}">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon.svg">
<style>
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
`;
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'index.html'), head + body + '\n</body>\n</html>\n');
await copyFile(icon, path.join(outDir, 'icon.svg'));
console.log(`Wrote ${path.join(outDir, 'index.html')}`);
