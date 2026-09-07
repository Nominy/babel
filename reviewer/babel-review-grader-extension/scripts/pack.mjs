import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFiles, packExtension } from '@nominy/babel-extension-build';
const root = resolve(import.meta.dirname, '..');
await packExtension({ rootDir: root, skipBuild: true,
  collectPackResult() {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    const entries = ['manifest.json', 'options.html'].map(rel => ({ rel, full: resolve(root, rel) }))
      .concat(collectFiles(resolve(root, 'dist'), 'dist'), collectFiles(resolve(root, 'icons'), 'icons'));
    const required = [manifest.options_page, 'dist/options.js',
      ...manifest.content_scripts.flatMap(script => script.js), ...Object.values(manifest.icons ?? {})];
    const paths = new Set(entries.map(file => file.rel.replaceAll('\\', '/')));
    for (const file of required) if (!paths.has(file)) throw new Error(`Missing packaged asset: ${file}`);
    return { entries, zipName: `babel-review-grader-${manifest.version}.zip`, zipOutputDir: '.artifacts' };
  }
});
