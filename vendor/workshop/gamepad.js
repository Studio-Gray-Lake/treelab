// The pad: a game controller, read through the browser's
// Gamepad API once a frame (poll(), at the top of src/main.js's frame). Only
// the standard layout is used: Xbox and PlayStation pads, and most others in
// Chrome. It's an input layer, as the keys are: the walk reads `axes`
// (src/controller.js, through controller.readAxes), and the page's half is
// the camera, the workshop's buttons and the Gamepad tab.
//
// - A pad shows up only once a button is pressed on it, or a stick pushed
//   past half-way, while the page shows (the browser's rule: Chrome's is
//   exactly that). The first standard pad to do either drives, and others
//   are ignored until it's gone. A waking push of the stick drives at once,
//   so after a page loads (Set out into another world) the stick walks him.
//   A waking press only wakes it: pressed() doesn't report it, since it may
//   be held over from before the page loaded. woke is true for that one
//   poll, so a page that wants the waking A (the welcome plaque,
//   src/support.js) can take woke && held('a').
// - Only the page with focus reads it, as only that page gets the keys
//   (every open workshop page sees the pad). Without focus, with the tab
//   hidden or with no pad, everything reads zero and nothing is pressed.
// - drive: the walk's inputs, { forward, turn, side, run }, each −1 to 1
//   (run 0 to 1), signed as the keys are (turn and side + to the left): the
//   left stick after the dead zone and the curve, the bumpers, and the right
//   trigger. Rounded to 64ths, which binary holds exactly, so a recording
//   can keep exactly what the walk saw.
// - axes: the same as the walk reads them, [forward, turn, side, run] (the
//   controller's AXES), a new array only when they change, and never changed
//   afterwards (the recorder keeps each update's).
// - look: the right stick after the dead zone and the curve (x + right,
//   y + up), for the camera. Not rounded: it never reaches the walk.
// - pressed(name): the button went down since the last poll (once a press).
//   held(name): it's down now. The names are the standard layout's, as on
//   an Xbox pad (BUTTONS).
// - step: { x, y }, each −1, 0 or 1 this poll (x + right, y + up), for
//   stepping through a list (the start pages, src/support.js): the left
//   stick past half-way, along the way it's pushed more, or the D-pad. Once
//   a push, then again while it's held: after 0.4 s, then every 0.12 s. A
//   push already held as the pad wakes or the page comes back doesn't step
//   until it's let go, as a held button isn't pressed.
// - raw: the pad as read this poll (its four axes and its buttons' values),
//   for the Gamepad tab's drawing.
// - rumble(strong, weak, ms): a pulse on its motors, where it has them
//   (listenForFootfalls). family: whose names its buttons go by.
//
// settings (the page's, from the Gamepad tab) are read each poll: deadZone
// and curve. source, active and now are the browser's (navigator.getGamepads,
// the page's focus, its clock in ms); the tests hand in their own.

export const BUTTONS = [
  'a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'menu', 'l3', 'r3', 'up', 'down', 'left', 'right', 'home',
];
const AT = Object.fromEntries(BUTTONS.map((name, i) => [name, i]));

export const DEFAULT_PAD = {
  deadZone: 0.12,     // of the stick's travel: a stick at rest reads 0.02 to 0.1
  curve: 1.6,         // output = input^curve past the dead zone: fine control near the centre
  cameraSpeed: 150,   // °/s the camera turns at full right stick
  invertCamera: false, // right stick up looks down
  rumble: true,       // a pulse at each footfall (listenForFootfalls)
  rumbleStrength: 0.5, // of the motors' full, at a run's landing: light
};

// Below this a trigger reads 0 (a worn one rests a little in).
const TRIGGER_REST = 0.03;

// A stick pushed further than this wakes a pad, as a press does: Chrome
// shows a pad on the same half-way. A stick at rest reads 0.02 to 0.1.
const WAKE_AT = 0.5;

// The stepping stick (step): past half-way it steps, and it's let go back
// under 0.3 (so a stick held near half-way doesn't step over and over). A
// push held steps again after REPEAT_AFTER, then every REPEAT (ms).
const STEP_AT = 0.5;
const STEP_LET_GO = 0.3;
export const REPEAT_AFTER = 400;
export const REPEAT = 120;

export function createGamepad({ settings = { ...DEFAULT_PAD }, source = readPads, active = pageActive, now = clock } = {}) {
  let index = null; // the driving pad's place in the browser's list
  let id = null;
  let ignored = null; // a pad without the standard layout: named, not used
  let focused = false;
  let woke = false; // the pad began to drive on this poll
  const down = BUTTONS.map(() => false);
  const went = BUTTONS.map(() => false);
  const drive = { forward: 0, turn: 0, side: 0, run: 0 };
  const look = { x: 0, y: 0 };
  const step = { x: 0, y: 0 };
  const pushed = { x: { way: 0, next: 0 }, y: { way: 0, next: 0 } }; // step's, held
  const raw = { axes: [0, 0, 0, 0], values: BUTTONS.map(() => 0) };
  let axes = Object.freeze([0, 0, 0, 0]);
  let current = null; // the driving pad as last read, for its motors

  function poll() {
    read();
    const { forward, turn, side, run } = drive;
    if (axes[0] !== forward || axes[1] !== turn || axes[2] !== side || axes[3] !== run) {
      axes = Object.freeze([forward, turn, side, run]);
    }
  }

  function read() {
    const pads = source() ?? [];
    let pad = index === null ? null : pads[index];
    if (!pad?.connected || pad.id !== id) pad = null;
    let waking = false;
    if (!pad) {
      index = id = null;
      pad = pads.find((p) => p?.connected && p.mapping === 'standard' && (p.buttons.some((b) => b.pressed) || pastHalfWay(p))) ?? null;
      if (pad) {
        ({ index, id } = pad);
        for (let i = 0; i < BUTTONS.length; i++) down[i] = !!pad.buttons[i]?.pressed; // the waking press isn't one
        waking = true;
      }
    }
    woke = waking;
    ignored = pad ? null : pads.find((p) => p?.connected && p.mapping !== 'standard')?.id ?? null;
    current = pad;
    focused = active();

    if (!pad || !focused) {
      // Nothing reads, but a button held meanwhile isn't reported when it
      // comes back.
      for (let i = 0; i < BUTTONS.length; i++) {
        if (pad) down[i] = !!pad.buttons[i]?.pressed;
        went[i] = false;
        raw.values[i] = 0;
      }
      raw.axes.fill(0);
      drive.forward = drive.turn = drive.side = drive.run = 0;
      look.x = look.y = 0;
      steps(pad, false);
      return;
    }

    for (let i = 0; i < BUTTONS.length; i++) {
      const button = pad.buttons[i];
      const now = !!button?.pressed;
      went[i] = now && !down[i];
      down[i] = now;
      raw.values[i] = button?.value ?? 0;
    }
    for (let i = 0; i < 4; i++) raw.axes[i] = pad.axes[i] ?? 0;

    const { deadZone, curve } = settings;
    const [lx, ly] = stick(raw.axes[0], raw.axes[1], deadZone, curve);
    drive.forward = sixtyFourths(-ly); // (the axes read + down and + right)
    drive.turn = sixtyFourths(-lx);
    drive.side = down[AT.lb] - down[AT.rb];
    drive.run = sixtyFourths(trigger(raw.values[AT.rt]));
    const [rx, ry] = stick(raw.axes[2], raw.axes[3], deadZone, curve);
    look.x = rx;
    look.y = -ry || 0;
    steps(pad, !waking);
  }

  // step, each way (x, y): which way it's pushed, from the D-pad or else the
  // stick, and whether that's a new push or a held one's repeat. live: the
  // poll counts (a pad drives, the page has focus, not the waking press).
  // Otherwise a push is only noted, so it steps once let go and pushed again.
  function steps(pad, live) {
    const t = now();
    const x = pad?.axes[0] ?? 0;
    const y = -(pad?.axes[1] ?? 0) || 0; // (+ down, as read)
    for (const [k, along, across, dpad] of [['x', x, y, down[AT.right] - down[AT.left]], ['y', y, x, down[AT.up] - down[AT.down]]]) {
      const held = pushed[k];
      const reach = held.way && Math.sign(along) === held.way ? STEP_LET_GO : STEP_AT;
      const way = (pad && dpad) || (pad && Math.abs(along) > reach && Math.abs(along) >= Math.abs(across) ? Math.sign(along) : 0);
      step[k] = 0;
      if (!live) {
        held.way = way;
        held.next = Infinity;
      } else if (way !== held.way) {
        held.way = way;
        held.next = t + REPEAT_AFTER;
        step[k] = way;
      } else if (way && t >= held.next) {
        held.next += REPEAT;
        if (held.next <= t) held.next = t + REPEAT; // (after a stall: one step, not a burst)
        step[k] = way;
      }
    }
  }

  return {
    settings, drive, look, step, raw, poll,
    get axes() { return axes; },
    pressed: (name) => went[AT[name]],
    held: (name) => focused && down[AT[name]],
    // A pad drives (whether or not the page has focus).
    get connected() { return index !== null; },
    // It began to drive on this poll: its waking press (not pressed(); held()
    // says which) or push.
    get woke() { return woke; },
    // The page has focus and shows, so a pad would be read.
    get focused() { return focused; },
    get name() { return id === null ? null : padName(id); },
    // A pad seen without the standard layout, while none drives.
    get ignored() { return ignored === null ? null : padName(ignored); },
    // Whose names its buttons go by (BUTTON_NAMES).
    get family() { return id === null ? 'xbox' : padFamily(id); },
    // Its motors, where the browser has them (Chrome and Edge, not Firefox;
    // not every pad).
    get canRumble() { return !!current?.vibrationActuator; },
    // A pulse: the strong (low) and weak (high) motors, 0 to 1, for ms.
    // Only while the page has focus. Returns whether it was asked for.
    rumble(strong, weak, ms) {
      const motors = focused ? current?.vibrationActuator : null;
      if (!motors) return false;
      motors.playEffect?.('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak })
        ?.catch?.(() => {}); // (a pad unplugged meanwhile)
      return true;
    },
  };
}

// Above this time scale the footfalls come too fast to feel, as the
// footsteps' sound goes quiet (src/sound.js).
const FAST = 4;

// Rumble at footfalls: a short pulse as each
// foot lands, harder the faster he goes and after a run's flight. It only
// listens to the walk's landings (onPlant, as the footsteps' sound does),
// and never while paused (a step with . included), replaying or fast
// forward, nor with the switch off.
export function listenForFootfalls(walk, gamepad) {
  walk.onPlant((s, body) => {
    const { settings } = gamepad;
    if (!settings.rumble || walk.replaying || walk.clock.run.paused || walk.settings.timeScale > FAST) return;
    const { strong, weak, ms } = footfall(Math.hypot(body.velocity.x, body.velocity.z), s.flight ?? 0, settings.rumbleStrength);
    gamepad.rumble(strong, weak, ms);
  });
}

// One footfall's pulse: at a walk (1 m/s) about half the strength, at a
// run (2.8 m/s) all of it, and a third more after 80 ms in the air.
export function footfall(speed, flight, strength) {
  const strong = Math.min(1, strength * Math.min(1, 0.3 + 0.25 * speed) * (1 + 4 * flight));
  return { strong, weak: strong / 2, ms: flight > 0.001 ? 70 : 45 };
}

// The names on the pad's buttons, by maker (from the vendor in its id:
// Sony 054c, Nintendo 057e; any other pad goes by Xbox's). Nintendo's face
// buttons are swapped against the standard layout's places: A is right.
export const BUTTON_NAMES = {
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', view: 'View', menu: 'Menu', l3: 'L3', r3: 'R3', home: 'Xbox' },
  playstation: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', view: 'Create', menu: 'Options', l3: 'L3', r3: 'R3', home: 'PS' },
  nintendo: { a: 'B', b: 'A', x: 'Y', y: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR', view: '−', menu: '+', l3: 'L3', r3: 'R3', home: 'Home' },
};

export function padFamily(id) {
  const vendor = id.match(/Vendor: ([0-9a-f]{4})/i)?.[1] ?? id.match(/^([0-9a-f]{1,4})-[0-9a-f]{1,4}-/i)?.[1]?.padStart(4, '0');
  if (vendor?.toLowerCase() === '054c' || /DualSense|DualShock|PlayStation/i.test(id)) return 'playstation';
  if (vendor?.toLowerCase() === '057e' || /Nintendo|Joy-Con|Pro Controller/i.test(id)) return 'nintendo';
  return 'xbox';
}

// A stick's two axes past a round dead zone, rescaled so just past it reads
// near zero (no jump), and held to the circle (a square stick's corners read
// 1.4). Then the curve, on each axis: so a stick pushed straight up, which
// wobbles a few % to the side, doesn't turn him.
export function stick(x, y, deadZone, curve) {
  const length = Math.hypot(x, y);
  if (!(length > deadZone)) return [0, 0];
  const past = Math.min(1, (length - deadZone) / (1 - deadZone));
  const bend = (v) => Math.sign(v) * Math.abs(v) ** curve;
  return [bend((x / length) * past), bend((y / length) * past)];
}

// A trigger, 0 to 1, straight (no curve): half a squeeze asks half the way
// from the walk's speed to the run's.
export function trigger(value) {
  return value > TRIGGER_REST ? Math.min(1, (value - TRIGGER_REST) / (1 - TRIGGER_REST)) : 0;
}

// A stick (the first four axes) pushed past half-way: enough to wake a pad.
function pastHalfWay(pad) {
  for (let i = 0; i < 4; i++) if (Math.abs(pad.axes?.[i] ?? 0) > WAKE_AT) return true;
  return false;
}

// To the nearest 64th, the same either side of zero, and never −0.
export function sixtyFourths(v) {
  return (Math.sign(v) * Math.round(Math.abs(v) * 64)) / 64 || 0;
}

// The pad's name from its id. Chrome: "DualSense Wireless Controller
// (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"; Firefox: "054c-0ce6-
// DualSense Wireless Controller".
export function padName(id) {
  return id.replace(/\s*\([^()]*\)\s*$/, '').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '').trim() || 'a pad';
}

function readPads() {
  try {
    return globalThis.navigator?.getGamepads?.() ?? [];
  } catch {
    return []; // (not allowed here)
  }
}

function pageActive() {
  return typeof document !== 'undefined' && document.hasFocus() && !document.hidden;
}

function clock() {
  return globalThis.performance?.now() ?? Date.now();
}
