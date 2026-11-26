// Records what this TreeLab's links start from (src/link.js: liveBases),
// under the links' version, in src/frozen/v<version>.js, and lists every
// record in src/frozen/index.js:
//
//   npm run freeze
//
// A link says only what differs from its start: the defaults, a starting
// view, a ready-made shape. So what those were when the link was made is
// kept, for ever, and a link of that version is read against it: it opens
// as it was made, whatever has been retuned since.
//
// A version's record is written once. If what links start from has changed
// since, this refuses: raise LINK_VERSION in src/link.js first, then run it
// again.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { LINK_VERSION, liveBases } from '../src/link.js';

const folder = new URL('../src/frozen/', import.meta.url);
const file = new URL(`v${LINK_VERSION}.js`, folder);
const text = `// What TreeLab's links of version ${LINK_VERSION} start from (scripts/freeze.mjs wrote this; it is never edited).\nexport default ${JSON.stringify(liveBases())};\n`;
mkdirSync(folder, { recursive: true });
if (existsSync(file)) {
  if (readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== text) {
    console.error(`What links start from has changed since version ${LINK_VERSION} was recorded. Links already made must keep their meaning:\nraise LINK_VERSION in src/link.js, and run this again.`);
    process.exit(1);
  }
  console.log(`src/frozen/v${LINK_VERSION}.js is as it should be.`);
} else {
  writeFileSync(file, text);
  console.log(`Recorded src/frozen/v${LINK_VERSION}.js (${(text.length / 1024).toFixed(1)} KB).`);
}

// The list of them: every record there is, by its version.
const versions = readdirSync(folder).map((name) => name.match(/^v(\d+)\.js$/)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
const index = [
  "// What TreeLab's links have started from, by their version (src/link.js). Each record is written once",
  '// (scripts/freeze.mjs, which also writes this list) and never edited: links already made are read against it.',
  ...versions.map((v) => `import v${v} from './v${v}.js';`),
  '',
  `export const FROZEN = { ${versions.map((v) => `${v}: v${v}`).join(', ')} };`,
  '',
].join('\n');
const indexFile = new URL('index.js', folder);
if (!existsSync(indexFile) || readFileSync(indexFile, 'utf8').replace(/\r\n/g, '\n') !== index) {
  writeFileSync(indexFile, index);
  console.log(`src/frozen/index.js lists versions ${versions.join(', ')}.`);
}
