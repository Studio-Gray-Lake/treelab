// How long TreeLab's start keeps the page busy, with no graphics card.
//
//   npm run check:start
//
// It builds the site as the website serves it (npm run build:site, into
// .scratch/check-start), serves it at /treelab/, opens it in a browser with
// no window forced to draw in software (SwiftShader: as on a machine with no
// graphics card, and on the website's own checks, which run on GitHub's), and
// asks the page a trivial question every quarter of a second. It fails if the
// page takes longer than the budget to answer with TreeLab ready, or stays
// busy, answering nothing, for longer than that at a stretch.
//
// Why: everything the page does in one go keeps it from answering anything
// else, a click as much as a check. On 27 November 2026 the website's check
// could no longer finish TreeLab's page on GitHub's machines (over 75 s): the
// first frame drew the scene five times, waiting for each (src/main.js, the
// eye's first looks). Here that start took 7.5 s; without it, 3.5 s.
//
// The budget is this computer's: START_BUDGET=<seconds> sets another (6 to
// start with: 0.4.2's start, 7.5 s here, fails it). A slower computer may need more; a start that grows past it is
// what this is here to catch. A browser somewhere else: CHROME_PATH=….
import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = Number(process.env.START_BUDGET ?? 6) * 1000;
const out = join(root, '.scratch', 'check-start');
execSync(`npx vite build --mode site --outDir "${out}" --emptyOutDir`, { cwd: root, stdio: 'ignore' });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.startsWith('/treelab/') ? join(out, path.slice('/treelab/'.length) || 'index.html') : '';
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file || !file.startsWith(out) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/treelab/`;

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
// (The browsers looked for, as scripts/check-browser.mjs looks: on Windows, where programs are installed, as the computer says.)
const chrome = [
  process.env.CHROME_PATH,
  ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).flatMap((programs) => [join(programs, 'Google/Chrome/Application/chrome.exe'), join(programs, 'Microsoft/Edge/Application/msedge.exe')]),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean).find(existsSync);
if (!chrome) { console.error('No Chrome or Edge found (CHROME_PATH=…).'); process.exit(2); }
const profile = mkdtempSync(join(tmpdir(), 'treelab-start-'));
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let code = 1;
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 300 && !(existsSync(portFile) && readFileSync(portFile, 'utf8').split('\n').length >= 2); i++) await wait(100);
  const [port, wsPath] = readFileSync(portFile, 'utf8').trim().split('\n');
  const socket = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((done) => socket.addEventListener('open', done));
  let next = 1;
  const waiting = new Map();
  socket.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  });
  const send = (method, params = {}, sessionId) => new Promise((done) => { const id = next++; waiting.set(id, done); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page('Runtime.enable');
  const start = Date.now();
  await page('Page.navigate', { url });
  // (A first visit, as the website's check makes: the welcome card shows; nobody closes it.)
  let ready = null, last = start, longest = 0;
  while (Date.now() - start < Math.max(60000, BUDGET * 4)) {
    const answer = await Promise.race([page('Runtime.evaluate', { expression: 'Boolean(window.treelab && window.treelab.stats)', returnByValue: true }), wait(BUDGET * 4).then(() => null)]);
    const now = Date.now();
    longest = Math.max(longest, now - last);
    last = now;
    if (!answer) break;
    if (answer.result?.result?.value && ready === null) ready = now - start;
    if (ready !== null && now - start > ready + 5000) break; // (and five seconds more, for anything the start leaves for later)
    await wait(250);
  }
  socket.close();
  const s = (ms) => `${(ms / 1000).toFixed(1)} s`;
  const ok = ready !== null && ready <= BUDGET && longest <= BUDGET;
  console.log(`TreeLab, drawn in software: ready after ${ready === null ? 'more than the wait' : s(ready)}, busy at most ${s(longest)} at a stretch (budget ${s(BUDGET)}).`);
  console.log(ok ? 'The start is within its budget.' : 'The start is over its budget: see the eye\'s first looks and anything else the start does in one go (src/main.js).');
  code = ok ? 0 : 1;
} finally {
  browser.kill();
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* (the browser may still hold it) */ }
}
process.exit(code);
