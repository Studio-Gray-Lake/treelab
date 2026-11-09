import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// A copied file's hash, its line endings taken as LF: git may turn them into
// CRLF on a Windows checkout, and that's not an edit.
export function fileHash(file) {
  return createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
}

// The imports in a file's source that are neither three.js nor one of the
// other copied workshop files (`./name.js`).
export function foreignImports(source, names) {
  const specifiers = [...source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/gm), ...source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm), ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map((m) => m[1]);
  return specifiers.filter((s) => !(s === 'three' || s.startsWith('three/') || names.some((name) => s === `./${name}`)));
}
