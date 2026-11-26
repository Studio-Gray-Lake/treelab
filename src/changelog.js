// TreeLab's feature log: what each release brought, newest first. The
// page shows it when the version beside TreeLab's name is clicked
// (index.html: #log; src/main.js).
//
// One entry a release: { version, date (the day it was released,
// YYYY-MM-DD), name (what it was about, in a few words), post (its news
// post on the studio's website, or null if it has none), changes (short
// lines, one a feature) }.
//
// Only what has been released is here. A release adds its entry at the
// top; tests/changelog.test.js holds the top entry to the version in
// package.json, so a release can't go out without one.

// The studio's news, where TreeLab's posts are.
export const NEWS = 'https://studiograylake.com/news.html';

export const RELEASES = [
  {
    version: '0.4',
    date: '2026-11-26',
    name: 'The English wood',
    post: 'https://studiograylake.com/news/treelab-0-4/',
    changes: [
      'Seven more trees of TreeLab\'s own beside the oak: beech, hawthorn, hazel, holly, ash, silver birch and small-leaved linden',
      'Each kind\'s crown has its own form, such as the beech\'s layered dome, the holly\'s tiers and the linden\'s billows',
      'Seasons, from early spring to mid winter',
      'Rules for where each kind grows, and oaks over an underwood of hazel',
      'The forest\'s mix as a table, a row a kind, by layer and by ground covered',
      'A forest\'s trees are of several ages, and their crowns close in a wood',
      'Select a tree to see its kind, its age and whether it grew in a wood, and centre the view on it',
      'Short share links, and a link always opens as it was made',
      'Fog, mist and haze, each with one meaning',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-11-17',
    name: 'The oak update',
    post: 'https://studiograylake.com/news/treelab-0-3-1/',
    changes: [
      'The oak\'s leaves are always merged masses: the clusters on a limb run together, hollow underneath',
      'Two sliders for them: merging, and leaves reach',
      'A branch starts inside the wood it leaves, and thick wood bends without sharp corners',
      'No branch is too thin for its length',
      'The cluster size slider goes up to 20 m, and its tooltip says what limits a cluster',
      'A link made with 0.3 whose oak had merged masses opens as it was made',
      'The version beside TreeLab\'s name, and this feature log behind it',
      'A link to the studio\'s news',
    ],
  },
  {
    version: '0.3',
    date: '2026-11-11',
    name: 'Light, mist, a walk in the woods, and an oak that ages',
    post: 'https://studiograylake.com/news/treelab-0-3/',
    changes: [
      'The time of day, from 5:00 to 21:00, and a day that can run',
      'Sun shadows, light shafts through the crowns, mist on the ground, sunlight through the leaves, shade under the trees, and an eye that adjusts to the view',
      'Walk, run and jump through the forest, with the keyboard or a game pad',
      'The oak\'s own wood: joints that swell, roots, gnarl, burrs, hollows and dead stubs',
      'A crown outline you can draw, and an age slider from 10 to 800 years',
      'Oaks of several ages in one wood',
      'Three starting views: one oak, a mixed forest, a misty wood',
      'Settings in sections by the part of the tree, and cards that fold away',
      'A welcome card on a first visit',
    ],
  },
  {
    version: '0.2',
    date: '2026-11-10',
    name: 'The English oak, at its real size',
    post: null,
    changes: [
      'An English oak, TreeLab\'s own tree, grown at its real size: about 20 m tall and wider than that',
      'Four shapes to start from: grown in the open, young, grown in a forest, ancient',
      'It sways, turns in autumn, exports and plants in the forest like the other kinds',
      'A 1.85 m figure beside the tree, for scale',
    ],
  },
  {
    version: '0.1',
    date: '2026-11-09',
    name: 'Procedural trees and forests in the browser',
    post: 'https://studiograylake.com/news.html#news-2026-11-09-treelab',
    changes: [
      'The Tree tab: one tree, or a grid of variants, seeds or kinds to compare, with every setting on a slider',
      'The Forest tab: hills, an area and a density, five planting patterns, groves and clearings, and the mix of kinds',
      'Wind and sway, and autumn colours tree by tree',
      'Settings saved and loaded, a link to share, screenshots, and the trees as a .glb model',
    ],
  },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// A release's day as people write it: '2026-11-17' → '17 November 2026'.
export function dayOf(date) {
  const [year, month, day] = String(date).split('-').map(Number);
  return MONTHS[month - 1] && day ? `${day} ${MONTHS[month - 1]} ${year}` : String(date);
}

// A version as numbers, to tell which of two is newer: '0.3.1' → [0, 3, 1].
export const versionParts = (version) => String(version).split('.').map(Number);
export function newer(a, b) {
  const x = versionParts(a), y = versionParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}
