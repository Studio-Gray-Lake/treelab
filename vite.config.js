import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { LIVE_DIR, VENDOR_DIR, workshopDir } from './workshop.config.js';

// `@workshop/...` is the copies in vendor/workshop/, or with `npm run dev:live`
// (vite's "live" mode) the workshop's own src folder.
export default defineConfig(({ mode }) => {
  const live = mode === 'live';
  const dir = workshopDir(live);
  const source = JSON.parse(readFileSync(path.join(VENDOR_DIR, 'SOURCE.json'), 'utf8'));
  return {
    // Served from a sub-folder of a website (say /treelab/): set TREELAB_BASE.
    base: process.env.TREELAB_BASE || './',
    resolve: { alias: { '@workshop': dir }, dedupe: ['three'] },
    define: {
      __WORKSHOP__: JSON.stringify(live ? { live: true, dir: LIVE_DIR } : { live: false, synced: source.synced }),
    },
    build: { chunkSizeWarningLimit: 900 },
    server: { port: 5180, fs: { allow: ['.', dir] } },
  };
});
