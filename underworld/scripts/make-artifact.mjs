// Inlines the ARTIFACT=1 build into one HTML page for publishing as a
// claude.ai artifact (the viewer only loads scripts from a CDN allowlist,
// so the game's own JS and CSS must ship inside the page).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.join(', ')}`);
const code = readFileSync(join(dir, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = css.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const out = process.argv[2] ?? 'dist-artifact/underworld.html';

writeFileSync(out, `<title>UNDERWORLD</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0b0b12">
<style>
${style}
</style>
<div id="root"></div>
<script type="module">
${code}
</script>
`);
console.log(`wrote ${out} (${(Buffer.byteLength(readFileSync(out)) / 1024).toFixed(0)} KB)`);
