// Builds docs/recovery/index.html (GitHub Pages) from artifact.html.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const body = await readFile(new URL('./artifact.html', import.meta.url), 'utf8');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#3552c9">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ReadyUp">
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
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#3552c9"/><path d="M14 42a18 18 0 0 1 36 0" fill="none" stroke="#dfe6fb" stroke-width="6" stroke-linecap="round"/><path d="M14 42a18 18 0 0 1 28-15" fill="none" stroke="#3fcf8e" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="42" r="4" fill="#fff"/></svg>\n`;
const out = new URL('../docs/recovery/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('index.html', out), head + body + '\n</body>\n</html>\n');
await writeFile(new URL('icon.svg', out), icon);
console.log('Wrote docs/recovery/index.html');
