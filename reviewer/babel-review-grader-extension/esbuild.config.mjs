import { build } from 'esbuild';
await build({ entryPoints: { content: 'src/content.ts', options: 'src/options.ts' },
  outdir: 'dist', bundle: true, format: 'iife', target: 'chrome114', sourcemap: false, logLevel: 'info' });
