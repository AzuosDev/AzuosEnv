/**
 * Gera os PNG do ícone do PWA a partir de public/icons/icon.svg usando o
 * Chromium do Playwright (já instalado para o e2e). Rode só quando o SVG mudar:
 *   node scripts/make-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const icons = resolve(here, '../public/icons');

/** size: lado do PNG; pad: margem (fração) para o ícone maskable. */
const TARGETS = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.08 },
];

const svg = await readFile(resolve(icons, 'icon.svg'), 'utf8');
const browser = await chromium.launch();

try {
  for (const { file, size, pad } of TARGETS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inset = Math.round(size * pad);

    await page.setContent(
      `<!doctype html><html><head><style>
        html,body{margin:0;background:#160A2E}
        svg{width:100%;height:100%;display:block}
      </style></head><body>
        <div style="width:${size}px;height:${size}px;display:grid;place-items:center">
          <div style="width:${size - inset * 2}px;height:${size - inset * 2}px">${svg}</div>
        </div>
      </body></html>`,
    );

    const png = await page.screenshot({ omitBackground: false });

    await writeFile(resolve(icons, file), png);
    await page.close();
    console.log(`${file} (${size}px)`);
  }
} finally {
  await browser.close();
}
