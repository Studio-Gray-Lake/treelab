// TreeLab's starting views, each drawn in a real browser and checked.
//
//   npm run check:browser
//
// The tests (npm test) grow trees and read the shaders as text; none of them
// draws a picture. This does: it serves TreeLab as `npm run dev` does, opens
// it in a browser with no window (Chrome or Edge, whichever this computer
// has), shows each starting point (src/scenes.js) in turn and checks that
//
//   - nothing went wrong on the way: no error, no shader that won't compile,
//     no complaint from the graphics card;
//   - there is a picture: neither one flat colour, nor black, nor burnt white;
//   - the trees are there.
//
// Before the views, the welcome card (src/welcome.js): the browser has kept
// nothing, so it must be open, with the focus on OK, and OK must close it.
//
// A picture of each is left in .scratch/browser-check/ to look at. Whether
// it looks right is still for eyes: this only catches a view that broke.
//
// It needs nothing installed beyond TreeLab's own packages: it talks to the
// browser over its debugging port (a WebSocket, which Node has). A browser
// somewhere else: CHROME_PATH=/path/to/chrome npm run check:browser.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.scratch', 'browser-check');
const SIZE = [1280, 800];
const SETTLE = 2500;     // ms: after a view is shown and its trees are there, before it's judged
const PATIENCE = 60000;  // ms: at most this long for the page, and for each view's trees

const BROWSERS = [
  process.env.CHROME_PATH,
  // (Windows: where programs are installed, as the computer says.)
  ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).flatMap((programs) => [join(programs, 'Google/Chrome/Application/chrome.exe'), join(programs, 'Microsoft/Edge/Application/msedge.exe')]),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(what, test, patience = PATIENCE) {
  for (const start = Date.now(); Date.now() - start < patience; await wait(150)) {
    const found = await test();
    if (found) return found;
  }
  throw new Error(`gave up waiting for ${what}`);
}

// The browser's debugging port, as a way to send it commands and hear from it.
function talkTo(address) {
  const socket = new WebSocket(address);
  const waiting = new Map(), listeners = [];
  let next = 1;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && waiting.has(message.id)) {
      const { done, fail } = waiting.get(message.id);
      waiting.delete(message.id);
      message.error ? fail(new Error(message.error.message)) : done(message.result);
    } else if (message.method) for (const hear of listeners) hear(message);
  });
  const ready = new Promise((done, fail) => {
    socket.addEventListener('open', done);
    socket.addEventListener('error', () => fail(new Error('the browser would not be talked to')));
  });
  const send = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const id = next++;
    waiting.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return { ready, send, hear: (fn) => listeners.push(fn), close: () => socket.close() };
}

const browserPath = BROWSERS.find((path) => existsSync(path));
if (!browserPath) {
  console.error('No Chrome or Edge found. Say where one is: CHROME_PATH=/path/to/chrome npm run check:browser');
  process.exit(2);
}

mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'treelab-check-'));
const server = await createServer({ root, logLevel: 'error', server: { port: 5187, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = spawn(browserPath, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
  `--window-size=${SIZE.join(',')}`, 'about:blank',
], { stdio: 'ignore' });

const failures = [];
let talk = null;
try {
  // (The browser writes its port, and the way in, to a file in its profile.)
  const portFile = join(profile, 'DevToolsActivePort');
  await until('the browser to start', () => existsSync(portFile) && readFileSync(portFile, 'utf8').split('\n').length >= 2);
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
  talk = talkTo(`ws://127.0.0.1:${port}${path}`);
  await talk.ready;
  const { targetId } = await talk.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await talk.send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => talk.send(method, params, sessionId);

  // Everything that goes wrong in the page, as it happens.
  let wrong = [];
  talk.hear(({ method, params }) => {
    if (method === 'Runtime.exceptionThrown') wrong.push(`error: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') wrong.push(`error: ${params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (method === 'Log.entryAdded' && (params.entry.level === 'error' || /WebGL|GL_|shader/i.test(params.entry.text))) wrong.push(`${params.entry.source}: ${params.entry.text}`);
  });
  await page('Runtime.enable');
  await page('Log.enable');
  await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  const run = async (expression) => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };

  await page('Page.navigate', { url });
  await until('TreeLab to open', () => run('Boolean(window.treelab && window.treelab.stats)').catch(() => false));
  const names = await run(`import('/src/scenes.js').then((m) => Object.keys(m.SCENES))`);
  console.log(`TreeLab at ${url}, in ${browserPath.split(/[\\/]/).pop()}: ${names.length} starting views\n`);

  // This browser has kept nothing, so it's a first visit: the welcome card
  // is open over the page, "OK" has the focus, and OK closes it (which also
  // takes it out of the pictures below).
  {
    const card = await run(`(() => {
      const card = document.getElementById('welcome');
      const seen = { open: card.open, focus: document.activeElement?.id, link: document.getElementById('welcome-about').href };
      document.getElementById('welcome-ok').click();
      return { ...seen, closed: !card.open };
    })()`);
    const problems = [];
    if (!card.open) problems.push('it did not open on a first visit');
    if (card.focus !== 'welcome-ok') problems.push(`the focus is on "${card.focus ?? 'nothing'}", not on OK`);
    if (!/^https:\/\//.test(card.link)) problems.push('"What is TreeLab?" goes nowhere');
    if (!card.closed) problems.push('OK did not close it');
    console.log(`${problems.length ? 'FAILED' : 'ok    '}  the welcome card`);
    for (const problem of problems) console.log(`          ${problem}`);
    if (problems.length) failures.push('the welcome card');
  }

  for (const name of names) {
    wrong = [];
    const problems = [];
    const started = Date.now();
    try {
      await run(`import('/src/scenes.js').then((m) => { window.treelab.applySettings(m.sceneSettings(${JSON.stringify(name)})); })`);
      // Its trees: the Tree tab's, or the forest's, once they're planted.
      const trees = () => run(`(() => { const t = window.treelab; return (t.settings.tab === 'forest' ? t.woods : t.garden).userData.count || 0; })()`);
      await until(`the trees of "${name}"`, trees);
      await wait(SETTLE);
      // What the canvas shows, small: how bright it is on average, how
      // much that varies, and how much of it is burnt out or black.
      const seen = await run(`(() => {
        const t = window.treelab;
        t.render();
        const small = document.createElement('canvas');
        small.width = 96; small.height = 60;
        const g = small.getContext('2d');
        g.drawImage(t.renderer.domElement, 0, 0, small.width, small.height);
        const { data } = g.getImageData(0, 0, small.width, small.height);
        let sum = 0, squares = 0, white = 0, black = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const v = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          sum += v; squares += v * v;
          if (v > 0.985) white++;
          if (v < 0.01) black++;
        }
        const mean = sum / n;
        return {
          mean, spread: Math.sqrt(Math.max(0, squares / n - mean * mean)), white: white / n, black: black / n,
          tab: t.settings.tab, trees: (t.settings.tab === 'forest' ? t.woods : t.garden).userData.count,
          programs: t.renderer.info.programs.length, triangles: t.renderer.info.render.triangles,
        };
      })()`);
      if (!(seen.trees > 0)) problems.push('no trees');
      if (!(seen.programs > 0)) problems.push('no shader was compiled');
      if (!(seen.spread > 0.03)) problems.push(`the picture is one flat colour (brightness ${seen.mean.toFixed(2)}, varying by ${seen.spread.toFixed(3)})`);
      if (seen.mean < 0.04) problems.push(`the picture is black (brightness ${seen.mean.toFixed(3)})`);
      if (seen.white > 0.6) problems.push(`the picture is burnt out (${Math.round(seen.white * 100)}% white)`);
      const { data } = await page('Page.captureScreenshot', { format: 'png' });
      const file = join(out, `${name.replace(/[^a-z0-9]+/gi, '-')}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      problems.push(...new Set(wrong));
      console.log(`${problems.length ? 'FAILED' : 'ok    '}  ${name.padEnd(14)} ${String(seen.trees).padStart(4)} trees, ${seen.programs} shaders, brightness ${seen.mean.toFixed(2)} (varying by ${seen.spread.toFixed(2)}), ${((Date.now() - started) / 1000).toFixed(1)} s`);
    } catch (error) {
      problems.push(error.message, ...new Set(wrong));
      console.log(`FAILED  ${name}`);
    }
    for (const problem of problems) console.log(`          ${String(problem).split('\n')[0].slice(0, 300)}`);
    if (problems.length) failures.push(name);
  }
  console.log(`\nPictures: ${out}`);
} catch (error) {
  console.error(`The check itself failed: ${error.message}`);
  failures.push('the check');
} finally {
  try { await talk?.send('Browser.close'); } catch { /* (already gone) */ }
  talk?.close();
  browser.kill();
  await server.close();
  await wait(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* (the browser still holds it: the system clears its temporary folder) */ }
}
console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : '\nEvery starting view draws.');
process.exit(failures.length ? 1 : 0);
