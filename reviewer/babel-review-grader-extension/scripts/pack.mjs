import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFiles, packExtension } from '@nominy/babel-extension-build';
const root = resolve(import.meta.dirname, '..');
const tempManifestPath = resolve(root, '.tmp.store.manifest.json');
try {
  await packExtension({ rootDir: root, skipBuild: true,
    collectPackResult() {
      const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
      // Keep the unpacked test identity out of the existing Chrome Web Store item.
      const storeManifest = { ...manifest };
      delete storeManifest.key;
      writeFileSync(tempManifestPath, `${JSON.stringify(storeManifest, null, 2)}\n`);
      const entries = [
        { rel: 'manifest.json', full: tempManifestPath },
        { rel: 'options.html', full: resolve(root, 'options.html') }
      ].concat(collectFiles(resolve(root, 'dist'), 'dist'), collectFiles(resolve(root, 'icons'), 'icons'));
      const required = [manifest.options_page, 'dist/options.js',
        ...manifest.content_scripts.flatMap(script => script.js), ...Object.values(manifest.icons ?? {})];
      const paths = new Set(entries.map(file => file.rel.replaceAll('\\', '/')));
      for (const file of required) if (!paths.has(file)) throw new Error(`Missing packaged asset: ${file}`);
      return { entries, zipName: `babel-review-grader-${manifest.version}.zip`, zipOutputDir: '.artifacts' };
    }
  });
} finally {
  rmSync(tempManifestPath, { force: true });
}
