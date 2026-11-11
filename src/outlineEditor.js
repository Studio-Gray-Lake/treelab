import { Controller } from 'three/addons/libs/lil-gui.module.min.js';

// A crown's outline as one row of lil-gui: a drawing of the crown from the
// side, with a dot at each height its reach is set at. Drag a dot in or
// out; the arrow keys move a focused dot (Shift: ten steps); pressing
// anywhere in the drawing moves the dot at the nearest height.
//
// The drawing is the real outline: `outlineOf(object)` gives the reach at
// every height (0 the crown's bottom, 1 its top), as the generator uses it,
// so the curve between the dots is the one the tree grows into.
//
//   new OutlineController(folder, object, keys, outlineOf, [least, most, step])
//
// keys: the settings, from the crown's bottom to its top, evenly spaced up
// it. onChange and onFinishChange work as on lil-gui's own rows.

const WIDE = 200, TALL = 132;   // the drawing's own measures
const TOP = 12, BOTTOM = 104;   // where the crown's top and bottom are in it
const MIDDLE = WIDE / 2;
const SVG = 'http://www.w3.org/2000/svg';

// The outline as the drawing's path: up one side and down the other.
export function outlinePath(outline, scale, steps = 48) {
  const side = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    side.push([outline(t) * scale, BOTTOM - t * (BOTTOM - TOP)]);
  }
  const right = side.map(([r, y]) => `${(MIDDLE + r).toFixed(1)},${y.toFixed(1)}`);
  const left = side.reverse().map(([r, y]) => `${(MIDDLE - r).toFixed(1)},${y.toFixed(1)}`);
  return `M${right.join('L')}L${left.join('L')}Z`;
}

export class OutlineController extends Controller {
  constructor(parent, object, keys, outlineOf, [min, max, step]) {
    super(parent, object, keys[Math.floor(keys.length / 2)], 'outline');
    this._keys = keys;
    this._outlineOf = outlineOf;
    this._min = min;
    this._max = max;
    this._step = step;
    this._scale = (MIDDLE - 9) / max; // the drawing's width for the furthest reach

    const make = (tag, attributes = {}) => {
      const e = document.createElementNS(SVG, tag);
      for (const [name, value] of Object.entries(attributes)) e.setAttribute(name, value);
      return e;
    };
    this.$svg = make('svg', { viewBox: `0 0 ${WIDE} ${TALL}`, class: 'outline-drawing', role: 'group', 'aria-label': 'The crown\'s outline, seen from the side' });
    // (The heights the dots are at, the trunk, the crown, the dots.)
    for (let i = 0; i < keys.length; i++) this.$svg.append(make('line', { class: 'outline-level', x1: 6, x2: WIDE - 6, y1: this._yOf(i), y2: this._yOf(i) }));
    this.$svg.append(make('line', { class: 'outline-trunk', x1: MIDDLE, x2: MIDDLE, y1: TOP + 10, y2: TALL - 4 }));
    this.$crown = make('path', { class: 'outline-crown' });
    this.$svg.append(this.$crown);
    this.$dots = keys.map((key, i) => {
      const dot = make('circle', { class: 'outline-dot', r: 5, cy: this._yOf(i), tabindex: 0, role: 'slider', 'aria-valuemin': min, 'aria-valuemax': max, 'aria-orientation': 'horizontal' });
      dot.addEventListener('keydown', (e) => this._key(e, i));
      dot.addEventListener('blur', () => this._callOnFinishChange());
      return dot;
    });
    this.$svg.append(...this.$dots);
    this.$widget.append(this.$svg);
    this.$disable = this.$svg;
    this.$svg.addEventListener('pointerdown', (e) => this._press(e));
    this.updateDisplay();
  }

  // What each dot is called aloud: the rows' own names, from the bottom up.
  labels(names) {
    this._labels = names;
    return this.updateDisplay();
  }

  _yOf(i) {
    return BOTTOM - (i / (this._keys.length - 1)) * (BOTTOM - TOP);
  }

  _snap(v) {
    const snapped = Math.round((v - this._min) / this._step) * this._step + this._min;
    return Number(Math.min(this._max, Math.max(this._min, snapped)).toFixed(4));
  }

  _set(i, v) {
    v = this._snap(v);
    if (this.object[this._keys[i]] === v) return;
    this.object[this._keys[i]] = v;
    this._callOnChange();
    this.updateDisplay();
  }

  // Where a press is, in the drawing's own measures.
  _at(e) {
    const box = this.$svg.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * WIDE, y: ((e.clientY - box.top) / box.height) * TALL };
  }

  _press(e) {
    if (this._disabled || e.button > 0) return;
    e.preventDefault();
    const { y } = this._at(e);
    // The dot at the nearest height; its reach is how far from the trunk the press is, either side.
    let i = 0;
    for (let k = 1; k < this._keys.length; k++) if (Math.abs(this._yOf(k) - y) < Math.abs(this._yOf(i) - y)) i = k;
    const reach = (m) => Math.abs(this._at(m).x - MIDDLE) / this._scale;
    this.$dots[i].focus({ preventScroll: true });
    this._set(i, reach(e));
    this.$svg.setPointerCapture(e.pointerId);
    this.$svg.classList.add('dragging');
    const move = (m) => this._set(i, reach(m));
    const up = () => {
      this.$svg.removeEventListener('pointermove', move);
      this.$svg.removeEventListener('pointerup', up);
      this.$svg.removeEventListener('pointercancel', up);
      this.$svg.classList.remove('dragging');
      this._callOnFinishChange();
    };
    this.$svg.addEventListener('pointermove', move);
    this.$svg.addEventListener('pointerup', up);
    this.$svg.addEventListener('pointercancel', up);
  }

  _key(e, i) {
    const big = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    const now = this.object[this._keys[i]];
    if (e.key in moves) this._set(i, now + moves[e.key] * big * this._step);
    else if (e.key === 'Home') this._set(i, this._min);
    else if (e.key === 'End') this._set(i, this._max);
    else return;
    e.preventDefault();
    // (Let go a moment after the last key, as a drag is let go.)
    clearTimeout(this._keyTimer);
    this._keyTimer = setTimeout(() => this._callOnFinishChange(), 400);
  }

  updateDisplay() {
    if (!this.$crown) return this;
    this.$crown.setAttribute('d', outlinePath(this._outlineOf(this.object), this._scale));
    this._keys.forEach((key, i) => {
      const v = this.object[key];
      this.$dots[i].setAttribute('cx', (MIDDLE + v * this._scale).toFixed(1));
      this.$dots[i].setAttribute('aria-valuenow', String(v));
      this.$dots[i].setAttribute('aria-label', `The crown's reach: ${this._labels?.[i] ?? key}`);
    });
    return this;
  }
}
