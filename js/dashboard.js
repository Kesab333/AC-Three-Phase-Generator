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
    diagram: () => '<div class="dash-diagram-bg"><img class="dash-diagram-img" src="images/Star_connection.png" alt="Star connection diagram" draggable="false"></div>',
    formula: () => '<div class="dash-formula-bg"><div class="dash-formula-primary" id="dashFormulaEq"></div></div>',
    simulation: () => (
      '<div class="dash-sim-bg"><svg class="dash-sim-svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<rect width="320" height="180" fill="#f8fafc"/>' +
      '<g transform="translate(18 24)"><circle cx="54" cy="66" r="52" fill="none" stroke="#94a3b8" stroke-width="12"/>' +
      '<g id="dashRotor" transform="translate(54 66)"><circle r="26" fill="#2563eb"/><path d="M-26,0 A26,26 0 0 0 26,0 Z" fill="#dc2626"/><circle r="5" fill="#0f172a"/></g>' +
      '<circle cx="54" cy="14" r="4" fill="#ea580c"/><circle cx="99" cy="92" r="4" fill="#0284c7"/><circle cx="9" cy="92" r="4" fill="#9333ea"/></g>' +
      '<g transform="translate(150 16)"><rect width="156" height="100" rx="8" fill="#e2e8f0" stroke="#94a3b8"/><rect x="8" y="8" width="140" height="84" rx="4" fill="#020617"/>' +
      '<g stroke="#1e293b" stroke-width=".6"><path d="M8 50H148M43 8V92M78 8V92M113 8V92"/></g>' +
      '<path id="dashT0" fill="none" stroke="#ffea00" stroke-width="1.8"/><path id="dashT1" fill="none" stroke="#00f0ff" stroke-width="1.8"/><path id="dashT2" fill="none" stroke="#ff00ea" stroke-width="1.8"/></g>' +
      '<g id="dashLamps"></g></svg></div>'
    ),
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
    view.querySelectorAll('.dash-preview-card').forEach((c) => {
      const go = () => onOpen(c.dataset.section);
      c.addEventListener('click', go);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    const eq = document.getElementById('dashFormulaEq');
    if (eq) eq.innerHTML = tex('e(t)=NAB\\omega\\sin\\omega t', false);
    if (window.katex === undefined) window.addEventListener('load', () => { const e2 = document.getElementById('dashFormulaEq'); if (e2 && window.ACPanels) e2.innerHTML = window.ACPanels.tex('e(t)=NAB\\omega\\sin\\omega t'); });
  }

  const wave = (w, h, ph, amp, cycles, t, x0, y0) => {
    let d = '';
    for (let i = 0; i <= 60; i += 1) {
      const x = x0 + (w * i) / 60, y = y0 + h / 2 - amp * Math.sin((i / 60) * cycles * 2 * Math.PI + ph - t);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  };

  let slow = 0;
  function tick(now) {
    if (!document.body.classList.contains('dashboard-active')) return;
    const th = (runtime.theta * 180) / Math.PI;
    const rot = document.getElementById('dashRotor');
    if (rot) rot.setAttribute('transform', 'translate(54 66) rotate(' + th.toFixed(1) + ')');
    const t = runtime.theta;
    [0, 1, 2].forEach((i) => {
      const p = document.getElementById('dashT' + i);
      if (p) p.setAttribute('d', wave(140, 84, [0, -2.094, 2.094][i], 22, 1.6, t, 8, 8));
    });
    const lamps = document.getElementById('dashLamps');
    if (lamps) {
      if (!lamps.firstChild) lamps.innerHTML = [0, 1, 2].map((i) => '<circle cx="' + (186 + i * 44) + '" cy="150" r="13" fill="#fde68a" stroke="#ca8a04"/>').join('');
      const g = Math.max(0.15, Math.min(1, P.tempNorm));
      Array.from(lamps.children).forEach((c) => c.setAttribute('fill-opacity', (0.25 + g * 0.75).toFixed(2)));
    }
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
