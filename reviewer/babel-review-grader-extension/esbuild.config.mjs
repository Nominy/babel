import { rm } from 'node:fs/promises';
import { build } from 'esbuild';
await rm(new URL('./dist/background.js', import.meta.url), { force: true });
await build({ entryPoints: { content: 'src/content.ts', options: 'src/options.ts' },
  outdir: 'dist', bundle: true, format: 'iife', target: 'chrome114', sourcemap: false, logLevel: 'info' });
