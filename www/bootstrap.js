import init, { Ruler } from './pkg/ruler.js';

// ── PPI calculation ─────────────────────────────────────────────────────────
// CSS pixel PPI = √(cssW² + cssH²) / diagonalInches
// This is correct across devicePixelRatio because canvas & CSS work in logical px.
function calcPPI(diagonalInches) {
  const w = window.screen.width;
  const h = window.screen.height;
  return Math.sqrt(w * w + h * h) / diagonalInches;
}

function getThickness() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--thickness')) || 80;
}

async function main() {
  await init();

  const hCanvas = document.getElementById('h-canvas');
  const vCanvas = document.getElementById('v-canvas');
  const mainArea = document.getElementById('main-area');

  const hRuler = new Ruler('h-canvas');
  hRuler.set_horizontal();

  const vRuler = new Ruler('v-canvas');
  vRuler.set_vertical();

  // ── Sizing ──────────────────────────────────────────────────────────────
  function resize() {
    const t        = getThickness();
    const toolbarH = document.getElementById('toolbar').offsetHeight;
    const statusH  = document.getElementById('status-bar').offsetHeight;
    const totalH   = window.innerHeight - toolbarH - statusH;
    const totalW   = window.innerWidth;

    document.getElementById('app').style.gridTemplateColumns = `${t}px 1fr`;
    document.getElementById('app').style.gridTemplateRows    = `${t}px 1fr auto auto`;

    const rulerW = Math.max(1, totalW - t);
    const rulerH = Math.max(1, totalH - t);

    hCanvas.width  = rulerW;  hCanvas.height = t;
    hRuler.resize(rulerW, t);

    vCanvas.width  = t;  vCanvas.height = rulerH;
    vRuler.resize(t, rulerH);
  }

  resize();
  window.addEventListener('resize', resize);

  // ── PPI / calibration ────────────────────────────────────────────────────
  function applyPPI(ppi, label) {
    hRuler.set_ppi(ppi);
    vRuler.set_ppi(ppi);
    localStorage.setItem('ruler-ppi', String(ppi));
    if (label) localStorage.setItem('ruler-ppi-label', label);
    document.getElementById('ppi-badge').textContent =
      Math.round(ppi) + ' DPI' + (label ? ` (${label})` : '');
    document.getElementById('cal-computed').textContent =
      `→ ${Math.round(ppi)} DPI · 1 cm ≈ ${(ppi / 2.54).toFixed(1)} px · 1 in ≈ ${ppi.toFixed(1)} px`;
    document.getElementById('cal-computed').classList.remove('hidden');
  }

  function hideCalibration() {
    document.getElementById('cal-overlay').classList.add('hidden');
  }

  function showCalibration() {
    document.getElementById('cal-overlay').classList.remove('hidden');
    document.getElementById('cal-computed').classList.add('hidden');
    // Reset credit card bar to default width (85.6mm at 96dpi ≈ 323px)
    const initial = Math.min(323, window.innerWidth * 0.55);
    document.getElementById('cal-card-bar').style.width = initial + 'px';
  }

  // Load stored PPI or show calibration on first visit
  const storedPPI   = localStorage.getItem('ruler-ppi');
  const storedLabel = localStorage.getItem('ruler-ppi-label');
  if (storedPPI) {
    applyPPI(parseFloat(storedPPI), storedLabel || '');
  } else {
    showCalibration();
  }

  // ── Calibration: tabs ────────────────────────────────────────────────────
  document.querySelectorAll('.cal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.cal-panel').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    });
  });

  // ── Calibration: screen size presets ────────────────────────────────────
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const inches = parseFloat(btn.dataset.inches);
      applyPPI(calcPPI(inches), btn.dataset.inches + '"');
      setTimeout(hideCalibration, 600);
    });
  });

  // ── Calibration: custom inches ───────────────────────────────────────────
  function applyCustomInches() {
    const val = parseFloat(document.getElementById('cal-custom-in').value);
    if (!val || val < 3 || val > 120) {
      document.getElementById('cal-custom-in').focus();
      return;
    }
    applyPPI(calcPPI(val), val + '"');
    setTimeout(hideCalibration, 600);
  }
  document.getElementById('btn-cal-custom').addEventListener('click', applyCustomInches);
  document.getElementById('cal-custom-in').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyCustomInches();
  });

  // ── Calibration: credit card drag ───────────────────────────────────────
  // Credit card ISO standard: 85.6 mm wide
  const CARD_MM = 85.6;
  const cardBar = document.getElementById('cal-card-bar');

  let cardDrag = null;

  function startCardDrag(clientX) {
    cardDrag = { startX: clientX, startW: cardBar.offsetWidth };
  }
  function moveCardDrag(clientX) {
    if (!cardDrag) return;
    const newW = Math.max(60, cardDrag.startW + (clientX - cardDrag.startX));
    cardBar.style.width = newW + 'px';
  }
  function endCardDrag() { cardDrag = null; }

  cardBar.addEventListener('mousedown',  e => { e.preventDefault(); startCardDrag(e.clientX); });
  window.addEventListener('mousemove',   e => moveCardDrag(e.clientX));
  window.addEventListener('mouseup',     endCardDrag);

  cardBar.addEventListener('touchstart', e => { e.preventDefault(); startCardDrag(e.touches[0].clientX); }, { passive: false });
  window.addEventListener('touchmove',   e => { if (cardDrag) { e.preventDefault(); moveCardDrag(e.touches[0].clientX); } }, { passive: false });
  window.addEventListener('touchend',    endCardDrag);

  document.getElementById('btn-cal-card').addEventListener('click', () => {
    const widthPx = cardBar.offsetWidth;
    // ppi = (widthPx / CARD_MM) * 25.4  (convert mm → inches)
    const ppi = (widthPx / CARD_MM) * 25.4;
    applyPPI(ppi, 'card');
    setTimeout(hideCalibration, 600);
  });

  // ── Calibration: skip / recalibrate ─────────────────────────────────────
  document.getElementById('btn-cal-skip').addEventListener('click', () => {
    applyPPI(96, 'default');
    hideCalibration();
  });
  document.getElementById('btn-recalibrate').addEventListener('click', showCalibration);

  // ── Render loop ──────────────────────────────────────────────────────────
  function render() {
    hRuler.draw();
    vRuler.draw();
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ── Cursor tracking ──────────────────────────────────────────────────────
  const crossH = document.getElementById('crosshair-h');
  const crossV = document.getElementById('crosshair-v');

  mainArea.addEventListener('mousemove', (e) => {
    const rect = mainArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hRuler.set_cursor(x);
    vRuler.set_cursor(y);
    crossH.style.top  = y + 'px';
    crossV.style.left = x + 'px';
    updateReadout(x, y);
  });

  mainArea.addEventListener('mouseleave', () => {
    hRuler.hide_cursor();
    vRuler.hide_cursor();
  });

  // ── Marker placement ─────────────────────────────────────────────────────
  hCanvas.addEventListener('click', (e) => {
    const rect = hCanvas.getBoundingClientRect();
    hRuler.toggle_marker(e.clientX - rect.left);
    refreshMarkers();
  });

  vCanvas.addEventListener('click', (e) => {
    const rect = vCanvas.getBoundingClientRect();
    vRuler.toggle_marker(e.clientY - rect.top);
    refreshMarkers();
  });

  // ── Scroll / pan ─────────────────────────────────────────────────────────
  hCanvas.addEventListener('wheel',  (e) => { e.preventDefault(); hRuler.scroll(e.deltaX || e.deltaY); }, { passive: false });
  vCanvas.addEventListener('wheel',  (e) => { e.preventDefault(); vRuler.scroll(e.deltaY); }, { passive: false });
  mainArea.addEventListener('wheel', (e) => {
    e.preventDefault();
    hRuler.scroll(e.deltaX || (e.shiftKey ? e.deltaY : 0));
    vRuler.scroll(e.shiftKey ? 0 : e.deltaY);
  }, { passive: false });

  // Mouse drag-to-pan on rulers
  let drag = null;

  hCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) drag = { ruler: hRuler, axis: 'x', startPx: e.clientX, startOffset: hRuler.get_offset() };
    e.preventDefault();
  });
  vCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) drag = { ruler: vRuler, axis: 'y', startPx: e.clientY, startOffset: vRuler.get_offset() };
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const cur = drag.axis === 'x' ? e.clientX : e.clientY;
    drag.ruler.set_offset(drag.startOffset + (cur - drag.startPx));
  });
  window.addEventListener('mouseup', () => { drag = null; });

  // ── Touch events ─────────────────────────────────────────────────────────
  let touch = null;

  function rulerTouchStart(e, ruler, axis) {
    e.preventDefault();
    const t = e.touches[0];
    touch = { ruler, axis, elem: e.currentTarget,
      startPx: axis === 'x' ? t.clientX : t.clientY,
      startOffset: ruler.get_offset(), moved: false };
  }
  function rulerTouchMove(e) {
    e.preventDefault();
    if (!touch) return;
    const t   = e.touches[0];
    const cur = touch.axis === 'x' ? t.clientX : t.clientY;
    const d   = cur - touch.startPx;
    if (Math.abs(d) > 4) touch.moved = true;
    touch.ruler.set_offset(touch.startOffset + d);
  }
  function rulerTouchEnd(e) {
    if (!touch) return;
    if (!touch.moved) {
      const ct  = e.changedTouches[0];
      const rect = touch.elem.getBoundingClientRect();
      const pos  = touch.axis === 'x' ? ct.clientX - rect.left : ct.clientY - rect.top;
      touch.ruler.toggle_marker(pos);
      refreshMarkers();
    }
    touch = null;
  }

  hCanvas.addEventListener('touchstart', (e) => rulerTouchStart(e, hRuler, 'x'), { passive: false });
  vCanvas.addEventListener('touchstart', (e) => rulerTouchStart(e, vRuler, 'y'), { passive: false });
  hCanvas.addEventListener('touchmove',  rulerTouchMove, { passive: false });
  vCanvas.addEventListener('touchmove',  rulerTouchMove, { passive: false });
  hCanvas.addEventListener('touchend',   rulerTouchEnd);
  vCanvas.addEventListener('touchend',   rulerTouchEnd);

  mainArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t    = e.touches[0];
    const rect = mainArea.getBoundingClientRect();
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    hRuler.set_cursor(x);
    vRuler.set_cursor(y);
    crossH.style.top  = y + 'px';
    crossV.style.left = x + 'px';
    updateReadout(x, y);
  }, { passive: false });
  mainArea.addEventListener('touchend', () => { hRuler.hide_cursor(); vRuler.hide_cursor(); });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key.toLowerCase()) {
      case 'p': setUnit('px'); break;
      case 'c': setUnit('cm'); break;
      case 'i': setUnit('in'); break;
      case 'delete':
      case 'backspace':
        hRuler.clear_markers(); vRuler.clear_markers(); refreshMarkers(); break;
    }
  });

  // ── Toolbar ───────────────────────────────────────────────────────────────
  document.getElementById('btn-unit-px').addEventListener('click', () => setUnit('px'));
  document.getElementById('btn-unit-cm').addEventListener('click', () => setUnit('cm'));
  document.getElementById('btn-unit-in').addEventListener('click', () => setUnit('in'));

  document.getElementById('btn-frac-8').addEventListener('click',  () => setFraction(8));
  document.getElementById('btn-frac-16').addEventListener('click', () => setFraction(16));
  document.getElementById('btn-frac-32').addEventListener('click', () => setFraction(32));

  document.getElementById('btn-clear-markers').addEventListener('click', () => {
    hRuler.clear_markers(); vRuler.clear_markers(); refreshMarkers();
  });

  // ── Command input ─────────────────────────────────────────────────────────
  const cmdInput  = document.getElementById('cmd-input');
  const cmdResult = document.getElementById('cmd-result');

  function runCommand() {
    cmdResult.textContent = hRuler.parse_command(cmdInput.value.trim());
  }
  document.getElementById('cmd-run').addEventListener('click', runCommand);
  cmdInput.addEventListener('keydown', e => { if (e.key === 'Enter') runCommand(); });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setUnit(unit) {
    hRuler.set_unit(unit);
    vRuler.set_unit(unit);
    document.querySelectorAll('[id^="btn-unit-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-unit-${unit}`).classList.add('active');
    document.getElementById('frac-group').classList.toggle('visible', unit === 'in');
    document.getElementById('readout-unit').textContent = unit;
    refreshMarkers();
  }

  function setFraction(denom) {
    hRuler.set_fraction_denom(denom);
    vRuler.set_fraction_denom(denom);
    document.querySelectorAll('[id^="btn-frac-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-frac-${denom}`).classList.add('active');
  }

  function fmt(v, unit) {
    if (unit === 'px') return Math.round(v).toString();
    if (unit === 'cm') return v.toFixed(2);
    if (unit === 'in') return v.toFixed(3);
    return v.toFixed(2);
  }

  function updateReadout(x, y) {
    const unit = hRuler.get_unit();
    document.getElementById('readout-x').textContent = fmt(hRuler.get_value_at(x), unit);
    document.getElementById('readout-y').textContent = fmt(vRuler.get_value_at(y), unit);
  }

  function refreshMarkers() {
    const unit  = hRuler.get_unit();
    const hVals = Array.from(hRuler.get_marker_values()).map(v => fmt(v, unit) + unit);
    const vVals = Array.from(vRuler.get_marker_values()).map(v => fmt(v, unit) + unit);
    let info = '';
    if (hVals.length) info += 'H: ' + hVals.join(', ');
    if (vVals.length) { if (info) info += '  |  '; info += 'V: ' + vVals.join(', '); }
    document.getElementById('markers-info').textContent = info || 'Tap or click a ruler to place markers';
  }

  setUnit('cm');
}

main().catch(err => {
  document.body.innerHTML = `<pre style="color:#B5860D;padding:2em">Failed to load WASM.\n\n${err}\n\nRun: wasm-pack build --target web --out-dir www/pkg</pre>`;
});
