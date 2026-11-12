/**
 * Orçamento da entrada inicial: tudo o que o index.html pede antes de qualquer
 * rota (script da entrada, modulepreload e CSS) tem que caber em 250 KB gzip.
 * Detalhe por módulo: bundle-stats.html, escrito pelo visualizer no build.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const BUDGET = 250 * 1024;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
const entries = [...new Set(assets)].filter((file) => {
  try {
    return statSync(join(dist, file)).isFile();
  } catch {
    return false;
  }
});

if (entries.length === 0) {
  console.error('check-bundle-size: nenhum asset da entrada encontrado no dist/index.html.');
  process.exit(1);
}

let total = 0;
const rows = entries
  .map((file) => {
    const gzip = gzipSync(readFileSync(join(dist, file)), { level: 9 }).length;

    total += gzip;

    return { file, gzip };
  })
  .sort((a, b) => b.gzip - a.gzip);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

if (total > BUDGET) {
  for (const row of rows) {
    console.error(`  ${kb(row.gzip)}  ${row.file}`);
  }

  console.error(`entrada inicial em ${kb(total)} gzip — teto de ${kb(BUDGET)}.`);
  process.exit(1);
}

console.log(
  `entrada inicial: ${kb(total)} gzip em ${String(entries.length)} arquivos (teto ${kb(BUDGET)}).`,
);
