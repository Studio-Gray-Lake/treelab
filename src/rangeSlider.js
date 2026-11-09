import { Controller } from 'three/addons/libs/lil-gui.module.min.js';

// A [least, most] setting as one row of lil-gui: a track with two handles
// and the stretch between them filled, then the two values. Click the
// values to type them; arrow keys move a focused handle (Shift: ten
// steps); dragging the track moves the nearer handle. The handles never
// cross. It changes the array in place, so whatever else holds it (the
// settings, a tree's shape) sees the change.
//
//   new RangeController(folder, object, property, min, max, step)
//
// onChange and onFinishChange work as on lil-gui's own rows.
export class RangeController extends Controller {
  constructor(parent, object, property, min, max, step) {
    super(parent, object, property, 'range');
    this._min = min;
    this._max = max;
    this._step = step;
    this._decimals = decimals(step);

    this.$track = el('div', 'range-track');
    this.$fill = el('div', 'range-fill');
    this.$thumbs = [0, 1].map((i) => {
      const thumb = el('div', 'range-thumb');
      thumb.tabIndex = 0;
      thumb.setAttribute('role', 'slider');
      thumb.setAttribute('aria-valuemin', String(min));
      thumb.setAttribute('aria-valuemax', String(max));
      thumb.addEventListener('keydown', (e) => this._key(e, i));
      thumb.addEventListener('blur', () => this._callOnFinishChange());
      return thumb;
    });
    this.$track.append(this.$fill, ...this.$thumbs);
    this.$value = el('button', 'range-value');
    this.$value.type = 'button';
    this.$value.addEventListener('click', () => this._edit());
    this.$widget.append(this.$track, this.$value);
    this.$disable = this.$track;

    this.$track.addEventListener('pointerdown', (e) => this._press(e));
    this.updateDisplay();
  }

  // The values as the handles read them (clamped to the track, in step).
  _snap(v) {
    const s = this._step;
    const snapped = Math.round((v - this._min) / s) * s + this._min;
    return Number(Math.min(this._max, Math.max(this._min, snapped)).toFixed(this._decimals + 2));
  }

  // Handle i to v, the other handle pushed along if they'd cross.
  _set(i, v) {
    const pair = this.getValue();
    v = this._snap(v);
    if (pair[i] === v) return;
    pair[i] = v;
    if (pair[0] > pair[1]) pair[1 - i] = v;
    this._callOnChange();
    this.updateDisplay();
  }

  _valueAt(clientX) {
    const box = this.$track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return this._min + f * (this._max - this._min);
  }

  _press(e) {
    if (this._disabled || e.button > 0) return;
    e.preventDefault();
    const v = this._valueAt(e.clientX);
    const [lo, hi] = this.getValue();
    // The nearer handle; on a tie (both at one value), the one on the side pressed.
    let i = Math.abs(v - lo) < Math.abs(v - hi) ? 0 : Math.abs(v - lo) > Math.abs(v - hi) ? 1 : v < lo ? 0 : 1;
    this.$thumbs[i].focus({ preventScroll: true });
    this._set(i, v);
    this.$track.setPointerCapture(e.pointerId);
    this.$track.classList.add('dragging');
    const move = (m) => this._set(i, this._valueAt(m.clientX));
    const up = () => {
      this.$track.removeEventListener('pointermove', move);
      this.$track.removeEventListener('pointerup', up);
      this.$track.removeEventListener('pointercancel', up);
      this.$track.classList.remove('dragging');
      this._callOnFinishChange();
    };
    this.$track.addEventListener('pointermove', move);
    this.$track.addEventListener('pointerup', up);
    this.$track.addEventListener('pointercancel', up);
  }

  _key(e, i) {
    const pair = this.getValue();
    const big = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    if (e.key in moves) this._set(i, pair[i] + moves[e.key] * big * this._step);
    else if (e.key === 'Home') this._set(i, this._min);
    else if (e.key === 'End') this._set(i, this._max);
    else return;
    e.preventDefault();
    // (Let go a moment after the last key, as a drag is let go.)
    clearTimeout(this._keyTimer);
    this._keyTimer = setTimeout(() => this._callOnFinishChange(), 400);
  }

  // The values as two boxes to type in; Enter or leaving them keeps them,
  // Escape puts them back.
  _edit() {
    if (this._disabled || this.$widget.querySelector('.range-edit')) return;
    const pair = this.getValue();
    const before = [...pair];
    const box = el('span', 'range-edit');
    const inputs = [0, 1].map((i) => {
      const input = el('input');
      input.type = 'number';
      input.step = String(this._step);
      input.min = String(this._min);
      input.max = String(this._max);
      input.value = format(pair[i], this._decimals);
      input.setAttribute('aria-label', `${this.$name.textContent}: ${i ? 'most' : 'least'}`);
      return input;
    });
    box.append(inputs[0], el('span', 'range-dash', '–'), inputs[1]);
    this.$value.replaceWith(box);
    inputs[0].focus();
    inputs[0].select();
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      if (keep) {
        const a = Number(inputs[0].value), b = Number(inputs[1].value);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const [lo, hi] = [this._snap(Math.min(a, b)), this._snap(Math.max(a, b))];
          if (lo !== pair[0] || hi !== pair[1]) {
            pair[0] = lo;
            pair[1] = hi;
            this._callOnChange();
          }
        }
      } else {
        pair.splice(0, 2, ...before);
      }
      box.replaceWith(this.$value);
      this.updateDisplay();
      this._callOnFinishChange();
    };
    for (const input of inputs) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', () => setTimeout(() => {
        if (!box.contains(document.activeElement)) finish(true);
      }));
    }
  }

  updateDisplay() {
    const [lo, hi] = this.getValue();
    const at = (v) => `${(100 * (v - this._min)) / (this._max - this._min)}%`;
    this.$thumbs[0].style.left = at(lo);
    this.$thumbs[1].style.left = at(hi);
    this.$fill.style.left = at(lo);
    this.$fill.style.width = `calc(${at(hi)} - ${at(lo)})`;
    this.$value.textContent = lo === hi ? format(lo, this._decimals) : `${format(lo, this._decimals)}–${format(hi, this._decimals)}`;
    const name = this.$name.textContent;
    [lo, hi].forEach((v, i) => {
      this.$thumbs[i].setAttribute('aria-valuenow', String(v));
      this.$thumbs[i].setAttribute('aria-label', `${name}: ${i ? 'most' : 'least'}`);
    });
    return this;
  }
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

const decimals = (step) => (Number.isInteger(step) ? 0 : Math.min(4, String(step).split('.')[1]?.length ?? 2));
const format = (v, d) => String(Number(v.toFixed(d)));
