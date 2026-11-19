import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/web/main.tsx'], bundle: true, outdir: 'dist', entryNames: 'app', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
await writeFile('dist/index.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LoomWiki — Sources</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js" defer></script></body></html>');
