/* ==========================================================================
   dashboard.js — first screen: one card per section, each with a LIVE preview
   (spinning generator + scope, formula, table, moving graph, steps, result pills)
   ========================================================================== */
(function () {
  'use strict';
  const runtime = window.ACGeneratorRuntime;
  const P = runtime.PHYSICS;
  const view = document.getElementById('dashboardView');
  const COL = ['#ea580c', '#0284c7', '#9333ea'];
  let tex = (s) => s;

  const previews = {
    diagram: () => '<div class="dash-diagram-bg"><img class="dash-diagram-img" src="images/Star_connection.webp" alt="Star connection diagram" draggable="false"></div>',
    formula: () => '<div class="dash-formula-bg"><div class="dash-formula-primary" id="dashFormulaEq"></div></div>',
    simulation: () => '<div class="dash-sim-bg"><svg id="dashGenerator" class="dash-sim-svg" viewBox="0 65 400 420" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"></svg></div>',
    observation: () => (
      '<div class="dash-obs-bg"><div class="dash-obs-tag"><span class="dash-obs-pulse"></span>Live readings</div>' +
      '<table class="dash-obs-table"><thead><tr><th>RPM</th><th>f (Hz)</th><th>E₀ (V)</th><th>I (mA)</th></tr></thead><tbody id="dashObsBody"></tbody></table></div>'
    ),
    graphs: () => '<div class="dash-graph-bg"><span class="dash-graph-label">Phase voltages</span><canvas class="dash-graph-canvas" id="dashGraph"></canvas></div>',
    calculation: () => '<div class="dash-calc-bg" id="dashCalc"></div>',
    results: () => '<div class="dash-results-bg" id="dashResults"></div>'
  };

  function build(sections, onOpen) {
    tex = (window.ACPanels && window.ACPanels.tex) || tex;
    view.innerHTML = '<div class="dashboard-cards-grid">' + sections.map((s, i) =>
      '<div class="dash-preview-card" style="--i:' + i + '" data-section="' + s.id + '" tabindex="0" role="button" aria-label="Open ' + s.title + '">' +
        '<div class="dash-preview-area"><div class="dash-preview-content">' + previews[s.id]() + '</div>' +
        '<div class="dash-preview-badge" title="' + s.title + '"><img src="' + s.icon + '" alt="" class="dash-icon-img" draggable="false"></div></div>' +
        '<div class="dash-card-label"><span>' + s.title + '</span></div></div>').join('') + '</div>';
    buildGeneratorPreview();
    view.querySelectorAll('.dash-preview-card').forEach((c) => {
      const go = () => onOpen(c.dataset.section);
      c.addEventListener('click', go);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    const eq = document.getElementById('dashFormulaEq');
    if (eq) eq.innerHTML = tex('e(t)=NAB\\omega\\sin\\omega t', false);
    if (window.katex === undefined) window.addEventListener('load', () => { const e2 = document.getElementById('dashFormulaEq'); if (e2 && window.ACPanels) e2.innerHTML = window.ACPanels.tex('e(t)=NAB\\omega\\sin\\omega t'); });
  }

  let previewRotor = null;
  function buildGeneratorPreview() {
    const preview = document.getElementById('dashGenerator');
    const source = document.getElementById('simulation-canvas');
    const motor = source.querySelector('#motor').cloneNode(true);
    const defs = source.querySelector('defs').cloneNode(true);
    // Reuse the simulation geometry, gradients and windings. Give the preview
    // its own IDs so it cannot interfere with wiring anchors or rotor controls.
    motor.removeAttribute('transform');
    motor.classList.remove('apparatus');
    preview.replaceChildren(defs, motor);
    const ids = new Map();
    preview.querySelectorAll('[id]').forEach((node) => {
      const id = node.id;
      ids.set(id, 'dash-' + id);
      node.id = ids.get(id);
    });
    preview.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-')) {
          node.removeAttribute(attr.name);
          return;
        }
        let value = attr.value.replace(/url\(#([^)]+)\)/g, (match, id) => ids.has(id) ? 'url(#' + ids.get(id) + ')' : match);
        if ((attr.localName === 'href') && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
        if (value !== attr.value) node.setAttributeNS(attr.namespaceURI, attr.name, value);
      });
    });
    previewRotor = preview.querySelector('#dash-rotorUse');
  }

  let slow = 0;
  function tick(now) {
    if (!document.body.classList.contains('dashboard-active')) return;
    const th = (runtime.theta * 180) / Math.PI;
    if (previewRotor) previewRotor.setAttribute('transform', 'translate(200 260) rotate(' + (-30 + th).toFixed(2) + ') scale(52)');
    const t = runtime.theta;
    const cv = document.getElementById('dashGraph');
    if (cv) {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (r.width && (cv.width !== Math.round(r.width * dpr))) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, r.width, r.height);
      g.strokeStyle = '#e2e8f0'; g.lineWidth = 1;
      for (let i = 1; i < 4; i += 1) { g.beginPath(); g.moveTo(0, (r.height * i) / 4); g.lineTo(r.width, (r.height * i) / 4); g.stroke(); }
      [0, 1, 2].forEach((k) => {
        g.beginPath(); g.strokeStyle = COL[k]; g.lineWidth = 2.4;
        for (let x = 0; x <= r.width; x += 3) { const y = r.height / 2 - (r.height * 0.3) * Math.sin((x / r.width) * 4 * Math.PI + [0, -2.094, 2.094][k] - t); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      });
    }
    if (now - slow > 300) {
      slow = now;
      const d = runtime.derive ? runtime.derive() : null;
      if (!d) return;
      const ob = document.getElementById('dashObsBody');
      if (ob) ob.innerHTML = [0, 1, 2].map((i) => {
        const rp = Math.max(30, P.rpm + (i - 1) * 60);
        const f = rp / 60, e0 = (P.turns * d.A * P.B * 2 * Math.PI * rp) / 60;
        return '<tr' + (i === 1 ? ' class="active-row"' : '') + '><td>' + rp.toFixed(0) + '</td><td>' + f.toFixed(2) + '</td><td>' + e0.toFixed(2) + '</td><td>' + ((e0 / Math.SQRT2 / d.Rt) * 1000).toFixed(0) + '</td></tr>';
      }).join('');
      const c = document.getElementById('dashCalc');
      if (c) c.innerHTML = [['Angular speed', '\u03C9 = 2\u03C0n / 60', d.w.toFixed(2) + ' rad/s'], ['Peak EMF', 'E\u2080 = N A B \u03C9', d.E0.toFixed(2) + ' V']]
        .map((s) => '<div class="dash-calc-step"><div class="dash-calc-step-title">' + s[0] + '</div><div class="dash-calc-step-formula">' + s[1] + '</div><div class="dash-calc-step-value">= ' + s[2] + '</div></div>').join('');
      const r = document.getElementById('dashResults');
      if (r) r.innerHTML = [['Frequency', d.f.toFixed(1) + ' Hz'], ['Phase voltage', d.Vph.toFixed(2) + ' V'], ['Lamp power', d.Pl.toFixed(2) + ' W'], ['Line voltage', d.Vl.toFixed(2) + ' V']]
        .map((p) => '<div class="dash-result-pill"><span class="dash-result-pill-label">' + p[0] + '</span><span class="dash-result-pill-val">' + p[1] + '</span></div>').join('');
    }
  }

  window.ACDashboard = { build, tick };
})();

/* ==========================================================================
   help.js — "?" guide: topics on the left, step-by-step procedure on the right
   (same layout as the previous lab's Help section)
   ========================================================================== */
(function () {
  'use strict';
  const overlay = document.getElementById('helpOverlay');
  const list = document.getElementById('faqQuestionList');
  const content = document.getElementById('faqProcedureContent');
  if (!overlay || !list || !content) return;

  const TOPICS = {
    generator: {
      menu: 'How the generator works',
      title: 'How the Three-Phase Generator Works',
      subtitle: 'Rotating coils in a magnetic field and the star connection',
      steps: [
        ['Rotating coils', 'The rotor spins at the chosen <strong>speed (RPM)</strong>. Three coils placed <strong>120° apart</strong> cut the magnetic field and each produces a sinusoidal EMF, $e = NAB\\omega\\sin\\omega t$.'],
        ['Star (wye) connection', 'One end of each winding (<strong>U2, V2, W2</strong>) is joined at the <strong>neutral strip</strong>. The other ends (<strong>U1, V1, W1</strong>) feed the three lamps.'],
        ['Line and phase voltage', 'Voltage across one lamp is the <strong>phase voltage</strong>. Between two live wires the <strong>line voltage</strong> is $\\sqrt{3}$ times larger.'],
        ['Heating lamps', 'Each lamp is a resistor whose resistance rises as the filament heats, so current and brightness settle after a moment.']
      ],
      tip: 'Frequency depends only on speed: $f = n/60$. Doubling the speed doubles both frequency and peak EMF.'
    },
    simulation: {
      menu: 'Using the Simulation',
      title: 'How the Simulation Section Works',
      subtitle: 'Controls, moving apparatus and the connecting leads',
      steps: [
        ['Change the generator', 'Use the <strong>sliders or the number boxes</strong> in <em>Generator controls</em> to set speed, flux density, coil turns and lamp resistance. Both always stay in sync.'],
        ['Choose 1, 2 or 3 phases', 'Use the <strong>Phase configuration</strong> buttons to run one, two or three windings; the lamps and scope channels follow.'],
        ['Move the apparatus', '<strong>Drag</strong> the generator, any lamp, the busbar or the oscilloscope body. The leads re-route automatically and stay attached to their terminals. Drag empty space to pan; scroll or pinch to zoom; <strong>Reset layout</strong> restores everything.'],
        ['Pause and reset', '<strong>Pause</strong> freezes the generator and the scope trace. <strong>Reset</strong> restores all default values.']
      ],
      tip: 'Dragging the oscilloscope works only on its grey body — its buttons, knobs and screen keep their normal behaviour.'
    },
    cro: {
      menu: 'Using the oscilloscope (CRO)',
      title: 'How to Use the Oscilloscope',
      subtitle: 'Reading the three phase voltages',
      steps: [
        ['Probe connections', 'CH1, CH2 and CH3 are clipped to the live post of the U, V and W lamps. The <strong>GND</strong> jack is tied to the common neutral/ground bus.'],
        ['Channel buttons', 'Press <strong>CH1 / CH2 / CH3</strong> to select a channel; the vertical knobs act on the selected one. Channels for unused phases are disabled.'],
        ['Scale the trace', '<strong>Vertical scale</strong> sets volts per division, <strong>Horizontal scale</strong> sets time per division. <strong>Auto-scale</strong> picks sensible values for the current speed.'],
        ['Run / Stop and cursors', '<strong>Run/Stop</strong> freezes the display; <strong>Single</strong> captures one trigger. Use the on-screen buttons or the matching CRO controls in the side panel.']
      ],
      tip: 'Adjacent traces are staggered by 120° of rotor angle — one third of a period.'
    },
    observation: {
      menu: 'Taking observations',
      title: 'How to Record Observations',
      subtitle: 'Log readings while varying one quantity at a time',
      steps: [
        ['Set the conditions', 'On the Simulation tab choose speed, B, N and lamp resistance. Let the lamps settle for about a second.'],
        ['Log a reading', 'Open <strong>Observation</strong> and press <strong>Log reading</strong>. A new row records the inputs and the calculated outputs.'],
        ['Vary one factor', 'Change only one control, log again, and compare rows to see its individual effect.']
      ],
      tip: 'Use <strong>Clear table</strong> to start a fresh set of readings.'
    },
    results: {
      menu: 'Graphs, calculation & results',
      title: 'Graphs, Calculation and Results',
      subtitle: 'Understanding the analysis tabs',
      steps: [
        ['Live graph', 'Shows one full revolution of the three phase voltages. Use the same controls shown on the Simulation tab to change the waveform.'],
        ['Calculation', 'Every step is worked out with <strong>your current settings</strong>: area, $\\omega$, $f$, $E_0$, $E_{rms}$, current, voltages and power.'],
        ['Results', 'Summary tiles for frequency, EMF, phase/line voltage, current and power, plus a heating bar for the lamps.']
      ],
      tip: 'RMS value = peak ÷ $\\sqrt{2}$ for a sine wave.'
    }
  };

  function renderMath(el) {
    if (!window.katex) return;
    el.innerHTML = el.innerHTML.replace(/\$([^$]+)\$/g, (m, t) => { try { return window.katex.renderToString(t, { throwOnError: false }); } catch (e) { return m; } });
  }
  function render(key) {
    const d = TOPICS[key];
    if (!d) return;
    list.querySelectorAll('.faq-q-item').forEach((li) => li.classList.toggle('is-active', li.dataset.question === key));
    content.innerHTML =
      '<div class="faq-content-header"><h3>' + d.title + '</h3><p class="faq-content-subtitle">' + d.subtitle + '</p></div>' +
      '<div class="faq-steps-list">' + d.steps.map((s, i) => '<div class="faq-step-card"><div class="step-badge">' + (i + 1) + '</div><div class="step-body"><h4 class="step-title">' + s[0] + '</h4><p class="step-desc">' + s[1] + '</p></div></div>').join('') + '</div>' +
      '<div class="faq-callout-tip"><strong>Pro Tip:</strong> ' + d.tip + '</div>';
    content.querySelectorAll('.step-desc, .faq-callout-tip').forEach(renderMath);
  }

  list.innerHTML = Object.entries(TOPICS).map(([k, t], i) => '<li class="faq-q-item" data-question="' + k + '"><span class="q-number">' + (i + 1) + '</span><span class="q-title">' + t.menu + '</span></li>').join('');
  list.addEventListener('click', (e) => { const li = e.target.closest('.faq-q-item'); if (li) render(li.dataset.question); });

  function open(key) {
    overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false');
    render(key || (list.querySelector('.is-active') || list.firstElementChild).dataset.question);
  }
  function close() { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }

  document.getElementById('helpButton')?.addEventListener('click', () => open());
  document.getElementById('closeHelpButton')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });
  window.ACHelp = { open, close };
})();
