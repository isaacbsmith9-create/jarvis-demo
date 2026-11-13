// Builds docs/index.html (GitHub Pages) from artifact.html, the single-page version.
// Outside Claude the page has no AI or sync, so it falls back to search, quick add and browser storage.
import { readFile, writeFile, copyFile } from 'node:fs/promises';

const body = await readFile(new URL('./artifact.html', import.meta.url), 'utf8');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f8a5f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="MacroLens">
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
await writeFile(new URL('../docs/index.html', import.meta.url), head + body + '\n</body>\n</html>\n');
await copyFile(new URL('./public/icon.svg', import.meta.url), new URL('../docs/icon.svg', import.meta.url));
await writeFile(new URL('../docs/.nojekyll', import.meta.url), '');
console.log('Wrote docs/index.html');
