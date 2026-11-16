// Renders app/icons/icon.svg to the PNG sizes iOS and Android need (uses the preinstalled Playwright Chromium).
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const dir = new URL('../app/icons/', import.meta.url).pathname;
const svg = await readFile(dir + 'icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['apple-touch-icon.png', 180, 0], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.1]]) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable: keep the mark inside the 80% safe zone by shrinking it over a full-bleed background.
  const inner = pad ? `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#16a06e,#075a3d)"></div><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="position:absolute;left:${size * pad}px;top:${size * pad}px;width:${size * (1 - 2 * pad)}px;height:${size * (1 - 2 * pad)}px">`
    : `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${size}px;height:${size}px;display:block">`;
  await page.setContent(`<html><body style="margin:0;position:relative;width:${size}px;height:${size}px">${inner}</body></html>`);
  await page.screenshot({ path: dir + name, omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
