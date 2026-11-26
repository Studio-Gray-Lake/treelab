import { Controller } from 'three/addons/libs/lil-gui.module.min.js';

// The forest's mix as a table: one row a kind. A row is one row of lil-gui:
//
//   [tick] name | a bar for its share | the share as a number | how many stand
//
// The tick is whether the kind grows in the forest; the bar and the number
// are its share against the other kinds; the last number is how many of
// it stand in the forest as planted (the page fills it in: stands()). A
// click on the name asks the page to show that kind's own settings
// (onName), and the row of the kind being shown is marked (shown()).
//
//   new MixController(folder, mix, name, [min, max, step], { onName })
//
// mix: the kind's settings in the mix, { on, share }. onChange and
// onFinishChange work as on lil-gui's own rows, for the tick as for the
// share. Arrow keys move a focused bar (Shift: ten steps).
//
// With the mix set by cover (src/cover.js) the same rows stand under their
// layer's own row, which is one of these without a tick and with no name
// to click: { property: 'canopy', layer: true } on the forest's layers.
// Its bar is the layer's cover, and its last cell what stands of it
// (says()).
export class MixController extends Controller {
  constructor(parent, mix, name, [min, max, step], { onName, property = 'share', layer = false } = {}) {
    super(parent, mix, property, 'mix');
    this._min = min;
    this._max = max;
    this._step = step;
    this._kind = name;
    this._layer = layer;
    if (layer) this.domElement.classList.add('layer');

    this.$tick = el('input', 'mix-tick');
    this.$tick.type = 'checkbox';
    this.$tick.setAttribute('aria-label', `${name}: grows in the forest`);
    this.$tick.addEventListener('change', () => {
      mix.on = this.$tick.checked;
      this._callOnChange();
      this.updateDisplay();
      this._callOnFinishChange();
    });
    this.$kind = el('button', 'mix-name', name);
    this.$kind.type = 'button';
    this.$kind.addEventListener('click', () => onName?.());
    if (layer) this.$name.replaceChildren(el('span', 'mix-layer', name));
    else this.$name.replaceChildren(this.$tick, this.$kind);

    this.$bar = el('div', 'mix-bar');
    this.$bar.tabIndex = 0;
    this.$bar.setAttribute('role', 'slider');
    this.$bar.setAttribute('aria-label', layer ? name : `${name}: share`);
    this.$bar.setAttribute('aria-valuemin', String(min));
    this.$bar.setAttribute('aria-valuemax', String(max));
    this.$fill = el('div', 'mix-fill');
    this.$bar.append(this.$fill);
    this.$bar.addEventListener('pointerdown', (e) => this._press(e));
    this.$bar.addEventListener('keydown', (e) => this._key(e));
    this.$bar.addEventListener('blur', () => this._callOnFinishChange());

    this.$number = el('input', 'mix-number');
    this.$number.type = 'number';
    this.$number.min = String(min);
    this.$number.max = String(max);
    this.$number.step = String(step);
    this.$number.setAttribute('aria-label', layer ? name : `${name}: share`);
    this.$number.addEventListener('change', () => {
      const v = Number(this.$number.value);
      if (Number.isFinite(v)) this.setValue(this._snap(v));
      this.updateDisplay();
      this._callOnFinishChange();
    });

    this.$stands = el('span', 'mix-stands');
    this.$widget.append(this.$bar, this.$number, this.$stands);
    this.$disable = this.$bar;
    this.updateDisplay();
  }

  _snap(v) {
    const snapped = Math.round((v - this._min) / this._step) * this._step + this._min;
    return Number(Math.min(this._max, Math.max(this._min, snapped)).toFixed(4));
  }

  _press(e) {
    if (this._disabled || e.button > 0) return;
    e.preventDefault();
    this.$bar.focus({ preventScroll: true });
    const at = (clientX) => {
      const box = this.$bar.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      this.setValue(this._snap(this._min + f * (this._max - this._min)));
    };
    at(e.clientX);
    this.$bar.setPointerCapture(e.pointerId);
    const move = (m) => at(m.clientX);
    const up = () => {
      this.$bar.removeEventListener('pointermove', move);
      this.$bar.removeEventListener('pointerup', up);
      this.$bar.removeEventListener('pointercancel', up);
      this._callOnFinishChange();
    };
    this.$bar.addEventListener('pointermove', move);
    this.$bar.addEventListener('pointerup', up);
    this.$bar.addEventListener('pointercancel', up);
  }

  _key(e) {
    const big = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    if (e.key in moves) this.setValue(this._snap(this.getValue() + moves[e.key] * big * this._step));
    else if (e.key === 'Home') this.setValue(this._min);
    else if (e.key === 'End') this.setValue(this._max);
    else return;
    e.preventDefault();
    // (Let go a moment after the last key, as a drag is let go.)
    clearTimeout(this._keyTimer);
    this._keyTimer = setTimeout(() => this._callOnFinishChange(), 400);
  }

  // How many of the kind stand in the forest as planted (null: not known yet).
  stands(count) {
    this.$stands.textContent = count === null || count === undefined ? '' : String(count);
    this.$stands.title = count === null || count === undefined ? '' : `${count} ${this._kind} ${count === 1 ? 'tree stands' : 'trees stand'} in the forest`;
    return this;
  }

  // The last cell in words of the page's own (the mix by cover: what stands of a share), with what a pointer over it is told.
  says(text, title = '') {
    this.$stands.textContent = text;
    this.$stands.title = title;
    return this;
  }

  // Whether this is the kind whose own settings are being shown.
  shown(on) {
    this.domElement.classList.toggle('shown', Boolean(on));
    this.$kind.setAttribute('aria-pressed', String(Boolean(on)));
    return this;
  }

  updateDisplay() {
    const mix = this.object;
    const share = this.getValue();
    this.$tick.checked = Boolean(mix.on);
    this.domElement.classList.toggle('off', !this._layer && !mix.on);
    this.$fill.style.width = `${(100 * (share - this._min)) / (this._max - this._min)}%`;
    if (document.activeElement !== this.$number) this.$number.value = String(share);
    this.$bar.setAttribute('aria-valuenow', String(share));
    return this;
  }
}

// The table's top row, naming its columns (says: the middle one's name, which changes with how the mix is set).
export function mixHead() {
  const head = el('div', 'mix-head');
  head.append(el('span', '', 'kind'), el('span', '', 'share (%)'), el('span', '', 'stands'));
  head.says = (middle) => { head.children[1].textContent = middle; };
  return head;
}

// A heading over the kinds that grow together.
export const mixGroup = (title) => el('div', 'mix-group', title);

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}
