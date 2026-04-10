import init, { Ruler } from './pkg/ruler.js';

const THICKNESS = 80;

async function main() {
  await init();

  const hCanvas = document.getElementById('h-canvas');
  const vCanvas = document.getElementById('v-canvas');
  const mainArea = document.getElementById('main-area');

  // Create rulers
  const hRuler = new Ruler('h-canvas');
  hRuler.set_horizontal();

  const vRuler = new Ruler('v-canvas');
  vRuler.set_vertical();

  // ── Sizing ──────────────────────────────────────────────────────────────
  function resize() {
    const toolbarH = document.getElementById('toolbar').offsetHeight;
    const statusH  = document.getElementById('status-bar').offsetHeight;
    const totalH   = window.innerHeight - toolbarH - statusH;
    const totalW   = window.innerWidth;

    const rulerW = totalW - THICKNESS;
    const rulerH = totalH - THICKNESS;

    hCanvas.width  = rulerW;
    hCanvas.height = THICKNESS;
    hRuler.resize(rulerW, THICKNESS);

    vCanvas.width  = THICKNESS;
    vCanvas.height = rulerH;
    vRuler.resize(THICKNESS, rulerH);
  }

  resize();
  window.addEventListener('resize', resize);

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

  // ── Marker placement (click on ruler) ───────────────────────────────────
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

  // ── Scrolling / panning ──────────────────────────────────────────────────
  function handleWheel(e, ruler, axis) {
    e.preventDefault();
    const delta = axis === 'x' ? (e.deltaX || e.deltaY) : e.deltaY;
    ruler.scroll(delta);
  }

  hCanvas.addEventListener('wheel',   (e) => handleWheel(e, hRuler, 'x'), { passive: false });
  vCanvas.addEventListener('wheel',   (e) => handleWheel(e, vRuler, 'y'), { passive: false });
  mainArea.addEventListener('wheel',  (e) => {
    e.preventDefault();
    hRuler.scroll(e.deltaX || (e.shiftKey ? e.deltaY : 0));
    vRuler.scroll(e.shiftKey ? 0 : e.deltaY);
  }, { passive: false });

  // Drag-to-pan on rulers
  let drag = null;

  function startDrag(e, ruler, axis) {
    drag = { ruler, axis, startPx: axis === 'x' ? e.clientX : e.clientY, startOffset: ruler.get_offset() };
    e.preventDefault();
  }

  hCanvas.addEventListener('mousedown', (e) => { if (e.button === 0) startDrag(e, hRuler, 'x'); });
  vCanvas.addEventListener('mousedown', (e) => { if (e.button === 0) startDrag(e, vRuler, 'y'); });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const cur = drag.axis === 'x' ? e.clientX : e.clientY;
    drag.ruler.set_offset(drag.startOffset + (cur - drag.startPx));
  });

  window.addEventListener('mouseup', () => { drag = null; });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key.toLowerCase()) {
      case 'p': setUnit('px'); break;
      case 'c': setUnit('cm'); break;
      case 'i': setUnit('in'); break;
      case 'delete':
      case 'backspace':
        hRuler.clear_markers();
        vRuler.clear_markers();
        refreshMarkers();
        break;
    }
  });

  // ── Toolbar wiring ────────────────────────────────────────────────────────
  document.getElementById('btn-unit-px').addEventListener('click', () => setUnit('px'));
  document.getElementById('btn-unit-cm').addEventListener('click', () => setUnit('cm'));
  document.getElementById('btn-unit-in').addEventListener('click', () => setUnit('in'));

  document.getElementById('btn-frac-8').addEventListener('click',  () => setFraction(8));
  document.getElementById('btn-frac-16').addEventListener('click', () => setFraction(16));
  document.getElementById('btn-frac-32').addEventListener('click', () => setFraction(32));

  document.getElementById('btn-clear-markers').addEventListener('click', () => {
    hRuler.clear_markers();
    vRuler.clear_markers();
    refreshMarkers();
  });

  document.getElementById('ppi-input').addEventListener('change', (e) => {
    const ppi = parseFloat(e.target.value) || 96;
    hRuler.set_ppi(ppi);
    vRuler.set_ppi(ppi);
  });

  // ── Command input ─────────────────────────────────────────────────────────
  const cmdInput  = document.getElementById('cmd-input');
  const cmdResult = document.getElementById('cmd-result');

  function runCommand() {
    const result = hRuler.parse_command(cmdInput.value.trim());
    cmdResult.textContent = result;
  }

  document.getElementById('cmd-run').addEventListener('click', runCommand);
  cmdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCommand(); });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setUnit(unit) {
    hRuler.set_unit(unit);
    vRuler.set_unit(unit);

    document.querySelectorAll('[id^="btn-unit-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-unit-${unit}`).classList.add('active');

    const fracGroup = document.getElementById('frac-group');
    fracGroup.classList.toggle('visible', unit === 'in');

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
    if (unit === 'px')  return Math.round(v).toString();
    if (unit === 'cm')  return v.toFixed(2);
    if (unit === 'in')  return v.toFixed(3);
    return v.toFixed(2);
  }

  function updateReadout(x, y) {
    const unit = hRuler.get_unit();
    document.getElementById('readout-x').textContent = fmt(hRuler.get_value_at(x), unit);
    document.getElementById('readout-y').textContent = fmt(vRuler.get_value_at(y), unit);
  }

  function refreshMarkers() {
    const unit   = hRuler.get_unit();
    const hVals  = Array.from(hRuler.get_marker_values()).map(v => fmt(v, unit) + unit);
    const vVals  = Array.from(vRuler.get_marker_values()).map(v => fmt(v, unit) + unit);

    let info = '';
    if (hVals.length) info += 'H markers: ' + hVals.join(', ');
    if (vVals.length) { if (info) info += '  |  '; info += 'V markers: ' + vVals.join(', '); }
    if (!info) info = 'Click on either ruler to place markers';

    document.getElementById('markers-info').textContent = info;
  }

  // Initialise with cm
  setUnit('cm');
}

main().catch(err => {
  document.body.innerHTML = `<pre style="color:#B5860D;padding:2em">Failed to load WASM module.\n\n${err}\n\nRun: wasm-pack build --target web --out-dir www/pkg</pre>`;
});
