import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS } from '../src/kinds.js';
import { LINK_VERSION, fromShortLink, toShortLink, fromOldLink } from '../src/link.js';
import { PRESETS, presetOf, presetShape } from '../src/presets.js';
import { SCENES, sceneOf, sceneSettings } from '../src/scenes.js';
import { CHOICES, defaultSettings, normalize } from '../src/settings.js';

// Share links (src/link.js): short, plain text, and read back as exactly
// the settings they were made from. The older links (#s=…) still open.

// Settings to make links from: the defaults, every starting view, every
// ready-made shape of every kind (on the defaults and on every view), and
// some changed by hand. Whatever kinds, views and shapes TreeLab has.
function everything() {
  const all = [['the defaults', defaultSettings()]];
  const views = Object.keys(SCENES);
  for (const name of views) all.push([name, sceneSettings(name)]);
  for (const kind of KINDS) {
    for (const preset of Object.keys(PRESETS[kind] ?? {})) {
      for (const from of [null, ...views]) {
        const settings = from ? sceneSettings(from) : defaultSettings();
        settings.shapes[kind] = presetShape(kind, preset);
        all.push([`${from ?? 'the defaults'}, ${kind} ${preset}`, settings]);
      }
    }
  }
  // By hand: one of every kind of value, on the defaults and on every view.
  for (const from of [null, ...views]) {
    const s = from ? sceneSettings(from) : defaultSettings();
    s.tab = s.tab === 'tree' ? 'forest' : 'tree';
    s.tree.kind = KINDS.at(-1);
    s.tree.vary = 'kinds by row';
    s.tree.labels = false;
    s.tree.tint = 0.1 + 0.2; // (0.30000000000000004: a number is kept to its last digit)
    s.forest.pattern = 'jittered grid';
    s.forest.size = [0.55, 1.6];
    s.forest.patches = !s.forest.patches;
    for (const kind of KINDS) {
      s.forest.mix[kind].on = !s.forest.mix[kind].on;
      s.forest.mix[kind].share = 1 + KINDS.indexOf(kind);
      if (s.forest.mix[kind].ages) s.forest.mix[kind].ages = [12, 640];
      s.colors[kind].dark = '#0a1b2c';
    }
    s.autumn.palette = CHOICES['autumn.palette'].at(-1);
    s.autumn.amount = 1e-7;
    s.light.hour = 7.5;
    s.light.mist = 0;
    s.view.stand = !s.view.stand;
    s.wind.speed = 9.9;
    // (Each kind's shape: its first number at its slider's least, which may be below nothing, and a range moved.)
    for (const kind of KINDS) {
      const shape = s.shapes[kind];
      const number = Object.keys(shape).find((key) => typeof shape[key] === 'number');
      const range = Object.keys(shape).find((key) => Array.isArray(shape[key]));
      if (number) shape[number] = -1e9;
      if (range) shape[range] = [shape[range][0], shape[range][0]];
    }
    all.push([`${from ?? 'the defaults'}, changed by hand`, s]);
  }
  return all;
}

test('a link reads back as exactly the settings it was made from', () => {
  for (const [name, settings] of everything()) {
    const { settings: back, notes } = fromShortLink(toShortLink(settings));
    assert.deepEqual(back, normalize(settings).settings, name);
    assert.deepEqual(notes, [], name);
  }
});

test('a link holds only letters, digits and - _ . ~, and ends in a letter or a digit', () => {
  for (const [name, settings] of everything()) assert.match(toShortLink(settings), /^[A-Za-z0-9._~-]*[A-Za-z0-9]$/, name);
});

test('a starting view untouched is said by its name: a few dozen characters at most', () => {
  for (const name of Object.keys(SCENES)) {
    const link = toShortLink(sceneSettings(name));
    assert.ok(link.length <= `${LINK_VERSION}-${name}`.length && link.length <= 40, `${name}: ${link.length} characters (${link})`);
    assert.equal(sceneOf(fromShortLink(link).settings), name);
  }
  assert.equal(toShortLink(defaultSettings()), `${LINK_VERSION}`);
});

test('a view changed a little says the view and the changes', () => {
  for (const name of Object.keys(SCENES)) {
    const settings = sceneSettings(name);
    settings.light.mist = 0.33;
    settings.forest.radius = 77;
    const link = toShortLink(settings);
    assert.ok(link.length <= `${LINK_VERSION}-${name}`.length + 40, `${name}: ${link.length} characters (${link})`);
    assert.match(link, /~forest_radius-77~light_mist-\.33$/, name);
  }
});

test('a kind\'s ready-made shape is said by its name, on the defaults and on a view', () => {
  for (const kind of KINDS) {
    for (const preset of Object.keys(PRESETS[kind] ?? {})) {
      const settings = defaultSettings();
      settings.shapes[kind] = presetShape(kind, preset);
      settings.shapes[kind][Object.keys(settings.shapes[kind]).find((key) => typeof settings.shapes[kind][key] === 'number')] += 0.01;
      const link = toShortLink(settings);
      assert.ok(link.length <= 20 + kind.length + preset.length + 30, `${kind} ${preset}: ${link.length} characters (${link})`);
    }
  }
  const wood = sceneSettings('misty wood');
  wood.shapes.oak = presetShape('oak', 'ancient');
  assert.equal(toShortLink(wood), `${LINK_VERSION}-misty.wood~shapes.oak-ancient`);
});

// What a link looks like, held here so the notation can't drift: a link
// made today must open the same for good.
test('the notation, as it is written and as it is read', () => {
  const settings = defaultSettings();
  settings.tab = 'forest';
  settings.tree.vary = 'kinds by row';
  settings.forest.size = [0.9, 1.35];
  settings.forest.mix.fir.on = false;
  settings.colors.fir.dark = '#204020';
  settings.light.mist = 0.5;
  assert.equal(toShortLink(settings), `${LINK_VERSION}_tab-forest~tree_vary-kinds.by.row~forest_size-.9-1.35~forest.mix.fir_on-0~colors.fir_dark-204020~light_mist-.5`);

  const { settings: read, notes } = fromShortLink(`${LINK_VERSION}-misty.wood~light_hour-7.5_mist-.6~shapes.oak-ancient_height-14-18_droop--.25~view_stand-0`);
  assert.deepEqual(notes, []);
  const made = sceneSettings('misty wood');
  made.light.hour = 7.5;
  made.light.mist = 0.6;
  made.shapes.oak = presetShape('oak', 'ancient');
  made.shapes.oak.height = [14, 18];
  made.shapes.oak.droop = -0.25;
  made.view.stand = false;
  assert.deepEqual(read, normalize(made).settings);

  // (A number with or without the 0 before its point; a character by its code: "..0073" is "s", "..0020" a space.)
  assert.equal(fromShortLink('1~light_mist-0.5').settings.light.mist, 0.5);
  assert.equal(fromShortLink('1~light_mi..0073t-.5').settings.light.mist, 0.5);
  assert.equal(sceneOf(fromShortLink(`${LINK_VERSION}-misty..0020wood`).settings), 'misty wood');
});

test('a damaged link gives the defaults and says so, whatever is in it', () => {
  const damaged = ['', 'x', '~', '1~', '1-', '1~~light_mist-.5', '1~light_mist', '1~light_-.5', '1__tab-forest', 'v1', '-1', '1.5', 'not*base64', '1~-ancient', 'eyJ2ZXJzaW9uIjoxfQ'];
  for (const text of damaged) {
    const { settings, notes } = fromShortLink(text);
    assert.deepEqual(settings, defaultSettings(), `"${text}"`);
    assert.equal(notes.length, 1, `"${text}": ${notes.join('; ')}`);
    assert.match(notes[0], /damaged/, `"${text}"`);
  }
  // (Nor anything that isn't text. A whole number is read as a version with nothing changed: today's is the defaults, and 1.5 is no version.)
  for (const junk of [undefined, null, LINK_VERSION, 1.5, {}, []]) assert.deepEqual(fromShortLink(junk).settings, defaultSettings());
});

test('a link can\'t reach past the settings', () => {
  for (const text of ['1~__proto___polluted-1', '1~constructor.prototype_polluted-1', '1_constructor-1', '1~shapes.__proto__-ancient', '1-constructor', '1-toString~light_mist-.5']) {
    assert.doesNotThrow(() => fromShortLink(text), text);
    assert.equal({}.polluted, undefined, text);
  }
});

test('a view or a ready-made shape this TreeLab doesn\'t have is said, not guessed', () => {
  const view = fromShortLink('1-enchanted.wood~light_mist-.5');
  assert.deepEqual(view.settings, defaultSettings());
  assert.ok(view.notes.length === 1 && /view/.test(view.notes[0]), view.notes.join('; '));
  // (An unknown shape: that kind's is left as it was, with what the link says of it; the rest is read.)
  const shape = fromShortLink('1~shapes.oak-enchanted_height-3-4~light_mist-.5');
  assert.deepEqual(shape.settings.shapes.oak, defaultSettings().shapes.oak);
  assert.equal(shape.settings.light.mist, 0.5);
  assert.ok(shape.notes.length === 1 && /ready-made shape/.test(shape.notes[0]), shape.notes.join('; '));
  // (Only a kind's shape starts from a ready-made one.)
  assert.equal(fromShortLink('1~light-ancient_mist-.5').notes.length, 1);
});

test('settings a link has that TreeLab doesn\'t are left out; values are checked as a file\'s are', () => {
  const unknown = fromShortLink('1~light_mist-.5_sparkle-3~telemetry_on-1~shapes.palm_height-3-4');
  assert.equal(unknown.settings.light.mist, 0.5);
  assert.deepEqual(unknown.notes, []);
  const wrong = fromShortLink('1-misty.wood~light_mist-7_hour-noon~forest_size-big_patches-yes~tree_kind-palm_seed-1-2');
  assert.equal(wrong.settings.light.mist, 1, 'brought into its slider');
  assert.equal(wrong.settings.light.hour, defaultSettings().light.hour);
  assert.deepEqual(wrong.settings.forest.size, defaultSettings().forest.size);
  assert.equal(wrong.settings.forest.radius, sceneSettings('misty wood').forest.radius, 'the rest of the view is kept');
  for (const path of ['light.hour', 'forest.size', 'forest.patches', 'tree.kind', 'tree.seed']) {
    assert.ok(wrong.notes.some((note) => note.startsWith(path)), `nothing said about ${path}`);
  }
});

test('a link from a newer TreeLab is read as far as it can be, with a note', () => {
  const { settings, notes } = fromShortLink(`${LINK_VERSION + 1}~light_mist-.5`);
  assert.equal(settings.light.mist, 0.5);
  assert.ok(notes.some((note) => note.includes('newer')));
});

// Links as TreeLab made them up to 0.3.1 (#s=…): each of these was made by
// that TreeLab, and must open for good. What they spell out is held here,
// not the whole of the settings: what they left unsaid was a default.
const OLD = {
  changed: 'eyJ2ZXJzaW9uIjoxLCJ0cmVlIjp7ImtpbmQiOiJwaW5lIn0sImZvcmVzdCI6eyJwYXR0ZXJuIjoiaml0dGVyZWQgZ3JpZCIsInNpemUiOlswLjksMS4zNV19LCJjb2xvcnMiOnsiZmlyIjp7ImRhcmsiOiIjMjA0MDIwIn19LCJ3aW5kIjp7InNwZWVkIjo1fX0',
  spruce: 'eyJ2ZXJzaW9uIjoxLCJ0cmVlIjp7ImtpbmQiOiJmaXIifSwic2hhcGVzIjp7ImZpciI6eyJoZWlnaHQiOlsxOCwyMl0sImJhcmUiOlsyLDRdLCJnaXJ0aCI6MC41LCJ0aWVycyI6WzE0LDE4XSwicmFkaXVzIjpbMi42LDMuMl0sInBvaW50cyI6OSwiZHJvb3AiOjEsImphZyI6MC4zNX19fQ',
  // (From 0.3, when the oak's leaves could be separate balls: its "masses".)
  masses: 'eyJ2ZXJzaW9uIjoxLCJ0YWIiOiJmb3Jlc3QiLCJzaGFwZXMiOnsib2FrIjp7Im1hc3NlcyI6MSwibm9pc2UiOjExNH19fQ',
  // (The misty wood, untouched.)
  misty: [
    'eyJ2ZXJzaW9uIjoxLCJ0YWIiOiJmb3Jlc3QiLCJzaGFwZXMiOnsib2FrIjp7ImhlaWdodCI6WzI2LDMxXSwic3ByZWFkIjpbMC40LDAuNTVdLCJ0cnVuayI6WzgsMTFdLCJnaXJ0aCI6WzAuNDUsMC42XSwibGlt',
    'YnMiOlszLDRdLCJjcm9va2VkIjowLjI1LCJkcm9vcCI6MC4xLCJjcm93ZGVkIjoxLCJyZWFjaExvdyI6MC4zLCJyZWFjaE1pZCI6MC42LCJyZWFjaEhpZ2giOjEsInJlYWNoVG9wIjowLjMsImNsdW1wU2l6ZSI6',
    'WzEuNiwyLjRdLCJnbmFybCI6MC4wOCwiYnVycnMiOjAuMSwic3R1YnMiOjAuNSwiZmxhcmUiOjAuMywicm9vdHMiOjAuMn19LCJmb3Jlc3QiOnsicmFkaXVzIjo2MCwiZGVuc2l0eSI6ODAsIm1peCI6eyJvYWsi',
    'Onsib24iOnRydWV9LCJicm9hZGxlYWYiOnsib24iOmZhbHNlfSwiZmlyIjp7Im9uIjpmYWxzZX0sInBpbmUiOnsib24iOmZhbHNlfX19LCJ0ZXJyYWluIjp7ImhlaWdodCI6Mn0sImxpZ2h0Ijp7ImhvdXIiOjYu',
    'NzUsIm1pc3QiOjAuODV9LCJ2aWV3Ijp7InN0YW5kIjp0cnVlLCJleWVzIjp0cnVlfX0',
  ].join(''),
};

test('the links made up to 0.3.1 (#s=) still open as they were made', () => {
  const changed = fromOldLink(OLD.changed);
  assert.deepEqual(changed.notes, []);
  assert.equal(changed.settings.tree.kind, 'pine');
  assert.equal(changed.settings.forest.pattern, 'jittered grid');
  assert.deepEqual(changed.settings.forest.size, [0.9, 1.35]);
  assert.equal(changed.settings.colors.fir.dark, '#204020');
  assert.equal(changed.settings.wind.speed, 5);

  const spruce = fromOldLink(OLD.spruce);
  assert.deepEqual(spruce.notes, []);
  assert.equal(spruce.settings.tree.kind, 'fir');
  assert.deepEqual([spruce.settings.shapes.fir.height, spruce.settings.shapes.fir.tiers, spruce.settings.shapes.fir.points, spruce.settings.shapes.fir.jag], [[18, 22], [14, 18], 9, 0.35]);

  const masses = fromOldLink(OLD.masses);
  assert.equal(masses.settings.tab, 'forest');
  assert.deepEqual([masses.settings.shapes.oak.merge, masses.settings.shapes.oak.noise], [100, 114]);

  const misty = fromOldLink(OLD.misty);
  assert.deepEqual(misty.notes, []);
  const { tab, forest, shapes, terrain, light, view } = misty.settings;
  assert.deepEqual([tab, forest.radius, forest.density, terrain.height, light.hour, light.mist, view.stand, view.eyes], ['forest', 60, 80, 2, 6.75, 0.85, true, true]);
  assert.deepEqual([forest.mix.oak.on, forest.mix.broadleaf.on, forest.mix.fir.on, forest.mix.pine.on], [true, false, false, false]);
  assert.deepEqual([shapes.oak.height, shapes.oak.trunk, shapes.oak.crowded, shapes.oak.reachHigh, shapes.oak.gnarl], [[26, 31], [8, 11], 1, 1, 0.08]);
  assert.equal(presetOf('oak', shapes.oak), 'forest-grown');
});

test('an old link, opened and shared again, becomes a short one for the same settings', () => {
  for (const [name, old] of Object.entries(OLD)) {
    const { settings } = fromOldLink(old);
    const link = toShortLink(settings);
    // (Not much longer, though it has to say what an old link didn't, each default that came after it: the forest's rules
    // off, each kind's trees of one age, crowns that don't close in a wood. Each adds a few characters; a link that grew by
    // half was a fault.)
    assert.ok(link.length < old.length * 1.5, `${name}: ${link.length} characters against ${old.length}`);
    assert.deepEqual(fromShortLink(link).settings, settings, name);
  }
});

test('an old link (#s=) can\'t reach past the settings either', () => {
  const old = (payload) => Buffer.from(payload).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const texts = [
    '{"version":1,"__proto__":{"polluted":"yes"},"tree":{"__proto__":{"polluted":"yes"}}}',
    '{"version":1,"constructor":{"prototype":{"polluted":"yes"}}}',
    '{"version":1,"shapes":{"__proto__":{"polluted":"yes"},"oak":{"constructor":{"prototype":{"polluted":"yes"}}}}}',
  ];
  for (const text of texts) {
    const { settings } = fromOldLink(old(text));
    assert.equal({}.polluted, undefined, text);
    assert.equal(Object.prototype.polluted, undefined, text);
    assert.equal(settings.polluted, undefined);
    assert.equal(settings.tree.kind, defaultSettings().tree.kind);
  }
});

test('the page writes the short link and reads both', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(page, /hash\.startsWith\('v='\)\) return \{ \.\.\.fromShortLink\(hash\.slice\(2\)\)/);
  assert.match(page, /hash\.startsWith\('s='\)\) return \{ \.\.\.fromOldLink\(hash\.slice\(2\)\)/);
  assert.match(page, /#v=\$\{toShortLink\(settings\)\}/);
  assert.doesNotMatch(page, /`#s=/);
});
