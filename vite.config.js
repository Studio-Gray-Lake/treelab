import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { LIVE_DIR, VENDOR_DIR, workshopDir } from './workshop.config.js';

// The copy on studiograylake.com loads the site's own visit counter
// (/assets/analytics.js: Cloudflare Web Analytics, no cookies). Only a build
// made for the site has it: `npm run build:site`. TreeLab itself, and any
// other build of it, loads nothing from anywhere.
const SITE_ANALYTICS = '/assets/analytics.js';
const siteAnalytics = {
  name: 'treelab-site-analytics',
  transformIndexHtml: () => [{ tag: 'script', attrs: { src: SITE_ANALYTICS, defer: true }, injectTo: 'body' }],
};

// `@workshop/...` is the copies in vendor/workshop/, or with `npm run dev:live`
// (vite's "live" mode) the workshop's own src folder.
export default defineConfig(({ mode }) => {
  const live = mode === 'live';
  const dir = workshopDir(live);
  const source = JSON.parse(readFileSync(path.join(VENDOR_DIR, 'SOURCE.json'), 'utf8'));
  return {
    plugins: mode === 'site' ? [siteAnalytics] : [],
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
