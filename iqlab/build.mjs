// Builds Basketball IQ Lab: src/*.js concatenated into one dist/index.html with the artifact skeleton.
// Usage: node iqlab/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
const JS = ['icons.js', 'store.js', 'engine.js', 'render.js', 'scenarios.js', 'grade.js', 'play.js', 'views.js', 'main.js'];

const out = join(here, 'dist');
mkdirSync(out, { recursive: true });
const page = src('index.html').replace('/*CSS*/', () => src('app.css')).replace('/*JS*/', () => JS.map((f) => `// ---- ${f} ----\n${src(f)}`).join('\n'));
writeFileSync(join(out, 'index.html'), SKELETON + page + '\n</body></html>\n');
console.log('built', join(out, 'index.html'));
