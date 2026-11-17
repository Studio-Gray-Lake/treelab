// Which TreeLab this is, said beside its name: so a picture, a link or a
// fault can be matched to the code that made it.
//
// A build says of itself (vite.config.js): { version (package.json's), date
// (the day it was built), dev (the dev server), hash (the git commit it was
// built from, if it's a checkout), changed (files changed since that
// commit) }. A build made for the website carries no hash: its version and
// its day say which it is.
//
//   0.3.0 · 2026-11-11             the website's
//   0.3.0 · 18d23c1                a build of your own
//   0.3.0 · dev · 18d23c1+        the dev server, with work not yet committed (the +)
export function versionLabel(build) {
  if (!build?.version) return '';
  const parts = [String(build.version)];
  if (build.dev) parts.push('dev');
  if (build.hash) parts.push(build.changed ? `${build.hash}+` : String(build.hash));
  else if (build.date) parts.push(String(build.date));
  return parts.join(' · ');
}

// The same in a sentence, for the label's tooltip.
export function versionSays(build) {
  if (!build?.version) return '';
  const from = build.hash ? `, from commit ${build.hash}${build.changed ? ' with changes not yet committed' : ''}` : '';
  const how = build.dev ? 'the dev server' : `built ${build.date ?? ''}`.trim();
  return `TreeLab ${build.version}: ${how}${from}.`;
}
