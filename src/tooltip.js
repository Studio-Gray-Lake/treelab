// Tooltips for the panel's rows: one floating box, filled by
// textOf(rowElement). It shows when a row is hovered (after a moment, then
// at once while moving between rows), when a control in it gets the
// keyboard's focus, and when a row's name is tapped on a touch screen.

export function attachTooltips(container, textOf) {
  const box = document.createElement('div');
  box.id = 'tip';
  box.setAttribute('role', 'tooltip');
  document.body.append(box);
  let timer = null;
  let current = null;
  let touch = false;

  function show(row) {
    clearTimeout(timer);
    const text = textOf(row);
    if (!text) return hide();
    box.textContent = text;
    box.classList.add('on');
    current = row;
    place(row);
  }

  function hide() {
    clearTimeout(timer);
    box.classList.remove('on');
    current = null;
  }

  // Beside the panel, level with the row; above the row when the panel
  // fills the screen's width (a phone).
  function place(row) {
    const r = row.getBoundingClientRect();
    const panel = container.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const margin = 8;
    let x, y;
    if (panel.left - b.width - margin * 2 > 0) {
      x = panel.left - b.width - margin;
      y = r.top + r.height / 2 - b.height / 2;
    } else {
      x = Math.min(innerWidth - b.width - margin, Math.max(margin, r.left));
      y = r.top - b.height - margin;
      if (y < margin) y = r.bottom + margin;
    }
    box.style.left = `${Math.round(x)}px`;
    box.style.top = `${Math.round(Math.min(innerHeight - b.height - margin, Math.max(margin, y)))}px`;
  }

  container.addEventListener('pointerdown', (e) => (touch = e.pointerType === 'touch'), true);
  container.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const row = e.target.closest('.controller');
    if (!row || row === current) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(row), current ? 0 : 400);
  });
  container.addEventListener('pointerout', (e) => {
    const row = e.target.closest('.controller');
    if (row && !row.contains(e.relatedTarget)) {
      clearTimeout(timer);
      if (!container.contains(e.relatedTarget)) hide();
    }
  });
  container.addEventListener('focusin', (e) => {
    const row = e.target.closest('.controller');
    if (row && !touch && e.target.matches(':focus-visible')) show(row);
  });
  container.addEventListener('focusout', () => {
    if (!touch) hide();
  });
  container.addEventListener('click', (e) => {
    if (!touch) return;
    const name = e.target.closest('.name');
    const row = name?.closest('.controller');
    if (!row) return;
    if (current === row) hide();
    else show(row);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!container.contains(e.target)) hide();
  });
  container.addEventListener('scroll', hide, true);
  addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  return { hide };
}
