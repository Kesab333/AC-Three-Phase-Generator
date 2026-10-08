/* ==========================================================================
   panels.js — Diagram, Formula, Calculation, Live graph, Observation, Results
   (all content is built here so each section is laid out the same way)
   ========================================================================== */
(function () {
  'use strict';
  const runtime = window.ACGeneratorRuntime;
  const P = runtime.PHYSICS;
  const S = runtime.state;
  const $ = (id) => document.getElementById(id);

  const tex = (src, display) => {
    if (window.katex) { try { return window.katex.renderToString(src, { throwOnError: false, displayMode: !!display }); } catch (e) { /* fall through */ } }
    return '<code>' + src + '</code>';
  };
  const fx = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const card = (title, body, cls) => '<section class="ref-card ' + (cls || '') + '"><div class="ref-title">' + title + '</div><div class="ref-body">' + body + '</div></section>';

  /* ---------- derived values (one place, used by Calculation / Results / Observation) ---------- */
  function derive() {
    const A = P.coilWidth * P.coilHeight;
    const w = (2 * Math.PI * P.rpm) / 60;
    const f = P.rpm / 60;
    const E0 = P.turns * A * P.B * w;
    const Erms = E0 / Math.SQRT2;
    const openCircuit = P.directConnect || !P.switchOn;
    const Rb = runtime.lampR();
    const Rt = openCircuit ? Infinity : P.R_internal + Rb;
    const I = openCircuit ? 0 : Erms / Rt;
    const Vph = openCircuit ? Erms : Erms - I * P.R_internal;
    const Vl = (P.phaseMode === 1 ? 1 : P.phaseMode === 2 ? Math.SQRT2 : Math.sqrt(3)) * Vph;
    const Pl = openCircuit ? 0 : I * I * Rb;
    return { A, w, f, E0, Erms, Rb, Rt, I, Vph, Vl, Pl, Ptot: Pl * Math.max(1, P.phaseMode), openCircuit };
  }
  runtime.derive = derive;

  /* ======================= DIAGRAM ======================= */
  $('panel-diagram').innerHTML =
    '<figure class="diagram-stage"><img src="images/Star_connection.webp" alt="Star connection of a three-phase generator" />' +
    '<figcaption>Star (wye) connection: the three windings U, V and W share a common neutral point; each phase feeds its own lamp and returns through the common neutral.</figcaption></figure>';

  /* ======================= FORMULA ======================= */
  const FORMULAS = [
    {
      name: "Faraday's law (EMF of one coil)", eq: 'e = -N\\,\\dfrac{d\\Phi}{dt}',
      use: 'The EMF induced in a coil of N turns equals the rate of change of flux linkage. It is the starting point for every other formula on this page.',
      vars: [['e', 'Induced EMF (V)'], ['N', 'Number of turns'], ['\\Phi', 'Magnetic flux through one turn (Wb)']]
    },
    {
      name: 'Instantaneous phase EMF', eq: 'e(t) = N A B \\omega \\sin(\\omega t)',
      use: 'A coil of area A rotating at angular speed \\u03C9 in a uniform field B produces a sinusoidal EMF. Phases V and W lag U by 120° and 240°.',
      vars: [['A', 'Coil area = width × height (m²)'], ['B', 'Flux density (T)'], ['\\omega', 'Angular speed = 2\\pi n/60 (rad/s)']]
    },
    {
      name: 'Peak and RMS EMF', eq: 'E_0 = N A B \\omega, \\qquad E_{rms} = \\dfrac{E_0}{\\sqrt{2}}',
      use: 'The peak EMF scales with speed, flux density and number of turns. RMS is what a multimeter reads.',
      vars: [['E_0', 'Peak EMF per phase (V)'], ['E_{rms}', 'RMS EMF per phase (V)']]
    },
    {
      name: 'Frequency', eq: 'f = \\dfrac{n}{60}',
      use: 'One rotor revolution produces one electrical cycle in a two-pole machine, so frequency depends only on speed.',
      vars: [['f', 'Frequency (Hz)'], ['n', 'Rotor speed (RPM)']]
    },
    {
      name: 'Star connection', eq: 'V_L = \\sqrt{3}\\,V_{ph}, \\qquad I_L = I_{ph}',
      use: 'In a star connection the line voltage between any two phases is √3 times the phase voltage; the line current equals the phase current.',
      vars: [['V_L', 'Line voltage (V)'], ['V_{ph}', 'Phase voltage (V)'], ['I_L,\\ I_{ph}', 'Line and phase current (A)']]
    },
    {
      name: 'Load current and power', eq: 'I = \\dfrac{E_{rms}}{R_i + R_{bulb}}, \\qquad P = I^{2} R_{bulb}',
      use: 'Each lamp is a resistive load in series with the winding resistance. The lamp resistance rises as the filament heats up.',
      vars: [['R_i', 'Winding (internal) resistance (Ω)'], ['R_{bulb}', 'Lamp resistance, cold → hot (Ω)'], ['P', 'Power delivered to one lamp (W)']]
    }
  ];
  $('panel-formula').innerHTML =
    '<div class="ref-panel">' +
    '<section class="ref-card"><div class="formula-pick"><label for="formulaSelect">Select formula</label><select id="formulaSelect">' +
    FORMULAS.map((f, i) => '<option value="' + i + '">' + f.name + '</option>').join('') + '</select></div></section>' +
    '<div class="formula-grid"><section class="ref-card"><div class="ref-title">Formula</div><div class="ref-body formula-big" id="formulaEq"></div></section>' +
    '<section class="ref-card"><div class="ref-title">Variables &amp; constants</div><div class="ref-body"><ul class="var-list" id="formulaVars"></ul></div></section></div>' +
    '<section class="ref-card"><div class="ref-title">Usage &amp; application</div><div class="ref-body" id="formulaUse"></div></section></div>';
  function showFormula(i) {
    const f = FORMULAS[i];
    $('formulaEq').innerHTML = tex(f.eq, true);
    $('formulaUse').textContent = f.use.replace(/\\u03C9/g, 'ω');
    $('formulaVars').innerHTML = f.vars.map((v) => '<li><b>' + tex(v[0]) + '</b><span>' + v[1] + '</span></li>').join('');
  }
  $('formulaSelect').addEventListener('change', (e) => showFormula(Number(e.target.value)));

  /* ======================= CALCULATION ======================= */
  $('panel-calculation').innerHTML =
    '<div class="ref-panel">' +
    '<section class="ref-card"><div class="ref-title">Live from the Generator controls</div><div class="ref-body">Every step below is recomputed from the values currently set on the Simulation tab. Lamp resistance is the live hot/cold value.</div></section>' +
    '<section class="ref-card" id="calcSteps"></section></div>';
  function renderCalc() {
    const d = derive();
    let steps = [
      ['Coil area', 'A = w \\times h = ' + P.coilWidth.toFixed(2) + ' \\times ' + P.coilHeight.toFixed(2), fx(d.A, 4) + ' m²'],
      ['Angular speed', '\\omega = \\dfrac{2\\pi n}{60} = \\dfrac{2\\pi \\times ' + P.rpm.toFixed(0) + '}{60}', fx(d.w, 2) + ' rad/s'],
      ['Frequency', 'f = \\dfrac{n}{60} = \\dfrac{' + P.rpm.toFixed(0) + '}{60}', fx(d.f, 2) + ' Hz'],
      ['Peak EMF per phase', 'E_0 = NAB\\omega = ' + P.turns + ' \\times ' + d.A.toFixed(4) + ' \\times ' + P.B.toFixed(2) + ' \\times ' + d.w.toFixed(2), fx(d.E0, 2) + ' V'],
      ['RMS EMF per phase', 'E_{rms} = \\dfrac{E_0}{\\sqrt{2}} = \\dfrac{' + d.E0.toFixed(2) + '}{\\sqrt{2}}', fx(d.Erms, 2) + ' V'],
      ['Lamp resistance (live)', 'R_{bulb}\\ (\\text{cold } ' + P.R_cold.toFixed(1) + '\\ \\Omega \\to \\text{hot } ' + P.R_hot.toFixed(1) + '\\ \\Omega)', fx(d.Rb, 2) + ' Ω'],
      ['Total resistance', 'R_T = R_i + R_{bulb} = ' + P.R_internal.toFixed(2) + ' + ' + d.Rb.toFixed(2), fx(d.Rt, 2) + ' Ω'],
      ['Phase (lamp) current', 'I = \\dfrac{E_{rms}}{R_T} = \\dfrac{' + d.Erms.toFixed(2) + '}{' + d.Rt.toFixed(2) + '}', P.switchOn ? fx(d.I * 1000, 1) + ' mA' : '0 mA (load off)'],
      ['Phase voltage at lamp', 'V_{ph} = E_{rms} - I R_i = ' + d.Erms.toFixed(2) + ' - ' + d.I.toFixed(3) + ' \\times ' + P.R_internal.toFixed(2), fx(d.Vph, 2) + ' V'],
      ['Line voltage', 'V_L = ' + (P.phaseMode === 1 ? '1' : P.phaseMode === 2 ? '\\sqrt{2}' : '\\sqrt{3}') + '\\,V_{ph}', fx(d.Vl, 2) + ' V'],
      ['Power per lamp', 'P = I^{2} R_{bulb} = ' + d.I.toFixed(3) + '^{2} \\times ' + d.Rb.toFixed(2), fx(d.Pl, 3) + ' W'],
      ['Total power (' + Math.max(1, P.phaseMode) + ' lamp' + (P.phaseMode > 1 ? 's' : '') + ')', 'P_{tot} = ' + Math.max(1, P.phaseMode) + ' \\times ' + d.Pl.toFixed(3), fx(d.Ptot, 3) + ' W']
    ];
    if (d.openCircuit) {
      steps[5] = ['Lamp resistance', 'R_{bulb} = \\infty\\quad(\\text{bulbs removed})', 'Open circuit'];
      steps[6] = ['Total resistance', 'R_T = \\infty\\quad(\\text{open circuit})', '∞ Ω'];
      steps[7] = ['Phase current', 'I = 0\\quad(\\text{open circuit})', '0 mA'];
      steps[8] = ['Phase terminal voltage', 'V_{ph} = E_{rms}\\quad(\\text{no internal voltage drop})', fx(d.Vph, 2) + ' V'];
      steps[10] = ['Power per lamp', 'P = 0\\quad(\\text{no lamp load})', '0 W'];
      steps[11] = ['Total power', 'P_{tot} = 0\\quad(\\text{open circuit})', '0 W'];
    }
    $('calcSteps').innerHTML = '<div class="calc-summary"><div><span>Configuration</span><b>' + P.phaseMode + '-phase, ' + P.rpm.toFixed(0) + ' RPM</b></div><div><span>Frequency</span><b>' + fx(d.f, 2) + ' Hz</b></div><div><span>Phase RMS</span><b>' + fx(d.Vph, 2) + ' V</b></div><div><span>Lamp current</span><b>' + fx(d.I * 1000, 1) + ' mA</b></div><div><span>Total output</span><b>' + fx(d.Ptot, 3) + ' W</b></div></div>' + steps.map((s, i) =>
      '<div class="calc-step-card"><span class="num">' + (i + 1) + '</span><div><div class="name">' + s[0] + '</div><div class="math">' + tex(s[1]) + '</div></div><div class="ans">' + s[2] + '</div></div>').join('');
  }

  /* ======================= OBSERVATION ======================= */
  const rows = [];
  $('panel-observation').innerHTML =
    '<div class="ref-panel"><section class="ref-card"><div class="obs-bar"><p><b>Procedure:</b> set the rotor speed, flux density, turns and lamp resistance on the Simulation tab, let the lamps settle for a second, then press <b>Log reading</b>. Change one variable at a time.</p>' +
    '<button type="button" class="control-button primary" id="logBtn">Log reading</button><button type="button" class="control-button" id="clearBtn">Clear table</button></div>' +
    '<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Trial</th><th>Speed (RPM)</th><th>B (T)</th><th>N</th><th>R<sub>bulb</sub> (Ω)</th><th>f (Hz)</th><th>E<sub>0</sub> (V)</th><th>V<sub>ph</sub> (V)</th><th>V<sub>L</sub> (V)</th><th>I (mA)</th><th>P<sub>lamp</sub> (W)</th></tr></thead><tbody id="obsBody"></tbody></table></div></section></div>';
  function renderObs() {
    $('obsBody').innerHTML = rows.length
      ? rows.map((r, i) => '<tr><td>' + (i + 1) + '</td>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('')
      : '<tr><td class="empty" colspan="11">No readings logged yet — press “Log reading”.</td></tr>';
  }
  $('logBtn').addEventListener('click', () => {
    const d = derive();
    rows.push([P.rpm.toFixed(0), P.B.toFixed(2), P.turns, d.Rb.toFixed(2), d.f.toFixed(2), d.E0.toFixed(2), d.Vph.toFixed(2), d.Vl.toFixed(2), (d.I * 1000).toFixed(1), d.Pl.toFixed(3)]);
    renderObs();
  });
  $('clearBtn').addEventListener('click', () => { rows.length = 0; renderObs(); });

  /* ======================= RESULTS ======================= */
  $('panel-results').innerHTML =
    '<div class="ref-panel"><div class="res-banner" id="resBanner"></div><div class="res-grid" id="resGrid"></div>' +
    '<section class="ref-card heat-card"><header><span>Lamp heating (relative to rated power)</span><b id="heatPct">0 %</b></header><div class="heat-track"><b id="heatFill"></b></div></section></div>';
  function renderResults() {
    const d = derive();
    const tiles = [
      ['Frequency', fx(d.f, 2), 'Hz', '#089b93'], ['Angular speed', fx(d.w, 2), 'rad/s', '#089b93'],
      ['Peak EMF E₀', fx(d.E0, 2), 'V per phase', '#ea580c'], ['RMS EMF', fx(d.Erms, 2), 'V per phase', '#ea580c'],
      ['Phase voltage', fx(d.Vph, 2), 'V (RMS) at lamp', '#0284c7'], ['Line voltage', fx(d.Vl, 2), 'V (RMS) = √3 · Vph', '#0284c7'],
      ['Lamp current', fx(d.I * 1000, 1), 'mA (RMS)', '#9333ea'], ['Lamp resistance', fx(d.Rb, 2), 'Ω (live)', '#9333ea'],
      ['Power per lamp', fx(d.Pl, 3), 'W', '#16a34a'], ['Total power', fx(d.Ptot, 3), 'W', '#16a34a']
    ];
    $('resGrid').innerHTML = tiles.map((t) => '<div class="res-tile" style="--tile:' + t[3] + '"><span>' + t[0] + '</span><strong>' + t[1] + '</strong><em>' + t[2] + '</em></div>').join('');
    $('resBanner').textContent = P.switchOn
      ? 'Circuit closed — delivering ' + fx(d.Ptot, 2) + ' W to ' + Math.max(1, P.phaseMode) + ' lamp(s) at ' + fx(d.f, 1) + ' Hz.'
      : 'Load switched off — the generator is running open-circuit.';
    const pct = Math.round(Math.max(0, Math.min(1, P.tempNorm)) * 100);
    $('heatPct').textContent = pct + ' %';
    $('heatFill').style.width = pct + '%';
  }

  /* ======================= LIVE CRO GRAPH ======================= */
  $('panel-graphs').innerHTML =
    '<div class="graphs-wrap"><figure class="graph-box"><header><span>Live CRO acquisition</span><span id="graphScopeState"></span><span class="legend"><span><i style="background:#ea580c"></i>CH1</span><span id="lgV"><i style="background:#0284c7"></i>CH2</span><span id="lgW"><i style="background:#9333ea"></i>CH3</span></span></header><div class="graph-canvas-wrap"><canvas id="graphVolt"></canvas><output id="graphTooltip" class="graph-tooltip" hidden></output></div></figure>' +
    '<figure class="graph-box graph-box--power"><header><span>Instantaneous Power</span><span id="graphPowerInfo"></span><span class="legend"><span><i style="background:#ea580c"></i>P₁</span><span id="lgPV"><i style="background:#0284c7"></i>P₂</span><span id="lgPW"><i style="background:#9333ea"></i>P₃</span><span><i style="background:#16a34a;width:12px;height:3px;border-radius:1px"></i>Total</span></span></header><div class="graph-canvas-wrap"><canvas id="graphPower"></canvas></div></figure></div>';
  let graphPointer = null;
  $('graphVolt').addEventListener('pointermove', (e) => { const r = e.currentTarget.getBoundingClientRect(); graphPointer = { x: e.clientX - r.left, y: e.clientY - r.top }; e.currentTarget.style.cursor = 'crosshair'; });
  $('graphVolt').addEventListener('pointerleave', () => { graphPointer = null; $('graphTooltip').hidden = true; });
  function setupCanvas(c) {
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width || !r.height) return null;
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w: r.width, h: r.height };
  }
  function drawGraphs() {
    const a = setupCanvas($('graphVolt')), C = window.ACGeneratorCRO;
    if (!a || !C) return;
    const { g, w, h } = a, L = 48, R = 14, T = 16, B = 30, SCOPE = C.SCOPE;
    const iw = w - L - R, ih = h - T - B, display = C.getDisplayWindow();
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.font = '11px Nunito, Arial'; g.lineWidth = 1; g.strokeStyle = '#e2e8f0'; g.fillStyle = '#64748b';
    for (let i = 0; i <= 8; i += 1) { const y = T + ih * i / 8; g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke(); if (i % 2 === 0) g.fillText((4 - i) + ' div', 5, y + 4); }
    for (let i = 0; i <= 10; i += 1) { const x = L + iw * i / 10; g.beginPath(); g.moveTo(x, T); g.lineTo(x, h - B); g.stroke(); g.fillText((display.duration * i / 10 * 1000).toFixed(0) + ' ms', x - 12, h - 9); }
    const colours = ['#ea580c', '#0284c7', '#9333ea'];
    [1, 2, 3].forEach((ch) => {
      const c = SCOPE.channels[ch]; if (!c.on) return;
      g.beginPath(); g.strokeStyle = colours[ch - 1]; g.lineWidth = 2.2;
      for (let i = 0; i <= 600; i += 1) { const t = display.start + display.duration * i / 600, v = C.valueAt('ch' + ch, t); const x = L + iw * i / 600, y = T + ih * (0.5 - (v + c.position) / c.voltsDiv / 8); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    });
    $('lgV').style.display = SCOPE.channels[2].on ? '' : 'none'; $('lgW').style.display = SCOPE.channels[3].on ? '' : 'none';
    $('graphScopeState').textContent = (SCOPE.running ? 'RUN' : 'STOP') + ' · ' + (SCOPE.timeDiv * 1000).toFixed(1) + ' ms/div';
    const tip = $('graphTooltip');
    if (graphPointer && graphPointer.x >= L && graphPointer.x <= L + iw && graphPointer.y >= T && graphPointer.y <= T + ih) {
      const ratio = (graphPointer.x - L) / iw, t = display.start + display.duration * ratio, values = [1, 2, 3].filter((ch) => SCOPE.channels[ch].on).map((ch) => 'CH' + ch + ': ' + C.valueAt('ch' + ch, t).toFixed(2) + ' V').join('  ');
      g.strokeStyle = '#334155'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(graphPointer.x, T); g.lineTo(graphPointer.x, h - B); g.stroke(); g.setLineDash([]);
      tip.hidden = false; tip.textContent = 't ' + (t * 1000).toFixed(2) + ' ms · ' + values; tip.style.left = Math.min(w - 230, graphPointer.x + 10) + 'px'; tip.style.top = Math.max(2, graphPointer.y - 28) + 'px';
    } else tip.hidden = true;

    /* ---------- POWER GRAPH: shows WHY multi-phase matters ---------- */
    const pb = setupCanvas($('graphPower'));
    if (pb) {
      const pg = pb.g, pw = pb.w, ph = pb.h;
      const PL = L, PR = R, PT = T, PB = B;
      const piw = pw - PL - PR, pih = ph - PT - PB;
      pg.fillStyle = '#fafbfc'; pg.fillRect(0, 0, pw, ph);

      // Compute power data for the visible time window
      const mode = runtime.PHYSICS.phaseMode;
      const off = runtime.phaseOffsets(mode);
      const E0 = S.E0 || 0;
      const effectiveSwitch = runtime.PHYSICS.switchOn && !runtime.PHYSICS.directConnect;
      const Rf = runtime.PHYSICS.directConnect ? 1e9 : runtime.lampR();
      const Rt = runtime.PHYSICS.R_internal + Rf;
      // peak power per phase: (E0²·Rf) / Rt²
      const peakPperPhase = effectiveSwitch ? (E0 * E0 * Rf) / (Rt * Rt) : 0;
      // total average power for scaling
      const avgPtotal = peakPperPhase * mode * 0.5;
      // Scale: show up to 2× average total power, minimum 0.01W
      const pMax = Math.max(0.01, peakPperPhase * 1.2);

      // Grid
      pg.font = '11px Nunito, Arial'; pg.lineWidth = 1; pg.strokeStyle = '#e2e8f0'; pg.fillStyle = '#64748b';
      for (let i = 0; i <= 6; i += 1) {
        const y = PT + pih * i / 6;
        pg.beginPath(); pg.moveTo(PL, y); pg.lineTo(pw - PR, y); pg.stroke();
        if (i % 2 === 0) pg.fillText((pMax * (1 - i / 6)).toFixed(2) + ' W', 2, y + 4);
      }
      for (let i = 0; i <= 10; i += 1) {
        const x = PL + piw * i / 10;
        pg.beginPath(); pg.moveTo(x, PT); pg.lineTo(x, ph - PB); pg.stroke();
        pg.fillText((display.duration * i / 10 * 1000).toFixed(0) + ' ms', x - 12, ph - 9);
      }

      // Draw per-phase power and total power
      const phaseData = [[], [], []];
      const totalData = [];
      for (let i = 0; i <= 600; i += 1) {
        const t = display.start + display.duration * i / 600;
        // Compute instantaneous voltage at time t for each phase
        const theta = runtime.theta - (runtime.PHYSICS.simTime - t) * runtime.omega();
        let totalP = 0;
        for (let k = 0; k < 3; k += 1) {
          if (k >= mode) { phaseData[k].push(0); continue; }
          const e = E0 * Math.sin(theta + off[k]);
          let p = 0;
          if (effectiveSwitch) {
            const current = e / Rt;
            p = current * current * Rf;   // always positive (I²R)
          }
          phaseData[k].push(p);
          totalP += p;
        }
        totalData.push(totalP);
      }

      // Draw each phase power
      const phColours = ['#ea580c', '#0284c7', '#9333ea'];
      for (let k = 0; k < mode; k += 1) {
        pg.beginPath(); pg.strokeStyle = phColours[k]; pg.lineWidth = 1.6; pg.globalAlpha = 0.5;
        for (let i = 0; i <= 600; i += 1) {
          const x = PL + piw * i / 600;
          const y = PT + pih * (1 - phaseData[k][i] / pMax);
          if (i) pg.lineTo(x, y); else pg.moveTo(x, y);
        }
        pg.stroke();
      }
      pg.globalAlpha = 1;

      // Draw total power (the KEY line — flat for 3-phase, pulsating for 1-phase)
      pg.beginPath(); pg.strokeStyle = '#16a34a'; pg.lineWidth = 3;
      for (let i = 0; i <= 600; i += 1) {
        const x = PL + piw * i / 600;
        const y = PT + pih * (1 - totalData[i] / pMax);
        if (i) pg.lineTo(x, y); else pg.moveTo(x, y);
      }
      pg.stroke();

      // Legend info
      const lgPV = $('lgPV'), lgPW = $('lgPW');
      if (lgPV) lgPV.style.display = mode >= 2 ? '' : 'none';
      if (lgPW) lgPW.style.display = mode >= 3 ? '' : 'none';
      const infoEl = $('graphPowerInfo');
      if (infoEl) {
        const label = mode === 3 ? 'Total power ≈ CONSTANT (smooth delivery!)' :
                      mode === 2 ? 'Total power is CONSTANT for balanced quadrature phases' :
                                   'Total power pulsates 0 → peak → 0 (flickering!)';
        infoEl.textContent = label;
        infoEl.style.color = mode === 3 ? '#16a34a' : mode === 2 ? '#0284c7' : '#ea580c';
        infoEl.style.fontWeight = '700';
      }
    }
  }
  /* ======================= SIDE INFO (non-interactive sections) ======================= */
  const INFO = {
    diagram: [
      ['Core system identification', '<div>A three-phase star-connected generator: three windings (U, V, W) 120° apart, a common neutral, and one lamp per phase.</div>'],
      ['Phases &amp; wires', '<ul><li><strong>U, V, W</strong> — live ends of the three windings (orange, blue, purple).</li><li><strong>N</strong> — neutral point where U2, V2, W2 meet; the common return.</li></ul>'],
      ['Voltage terms', '<ul><li><strong>Phase voltage</strong> — across one winding (live to neutral).</li><li><strong>Line voltage</strong> — between two live conductors: √3 × phase voltage for three phases, √2 for two quadrature phases.</li></ul>']
    ],
    formula: [
      ['Where these are used', '<div>Faraday’s law gives the EMF of one coil. Rotating the coil gives a sine wave; three coils 120° apart give a three-phase set.</div>'],
      ['Tip', '<div>Use the drop-down to switch between formulas. The <strong>Calculation</strong> tab applies them with your live settings.</div>']
    ],
    calculation: [
      ['How to read this', '<div>Each card shows the formula with numbers substituted, then the result. Change any control on the Simulation tab and return to see the update.</div>'],
      ['Star connection', '<div class="eq" id="sideEqStar"></div><div>Line voltage is √3 times the phase voltage.</div>']
    ],
    graphs: [
      ['What the graph shows', '<div>This graph shows one full revolution of the three phase voltages. Change the simulation controls to see how speed, flux density and coil turns affect the waveforms.</div>']
    ],
    observation: [
      ['Suggested procedure', '<ul><li>Set speed, B, N and lamp resistance.</li><li>Wait a second for the lamps to settle, then log a reading.</li><li>Change one variable at a time.</li></ul>'],
      ['What to look for', '<div>Frequency depends on speed only. Peak EMF scales with speed, B and turns together. Current also depends on the heating lamp resistance.</div>']
    ],
    results: [
      ['Reading the numbers', '<div>RMS values equal peak ÷ √2. Line voltage is √3 × phase voltage for three balanced phases, √2 for two quadrature phases, and the phase voltage for one phase.</div>'],
      ['Why current is not proportional to speed', '<div>The lamp resistance rises as it heats, so doubling the speed raises current by less than double.</div>']
    ]
  };
  function renderSideInfo(name) {
    const list = INFO[name] || [];
    $('sideInfo').innerHTML = list.map((c) => '<section class="info-card"><h4>' + c[0] + '</h4>' + c[1] + '</section>').join('');
    const eq = $('sideEqStar'); if (eq) eq.innerHTML = tex('V_L=' + (P.phaseMode === 1 ? '1' : P.phaseMode === 2 ? '\\sqrt{2}' : '\\sqrt{3}') + '\\,V_{ph}');
  }

  /* ======================= public API ======================= */
  let current = 'simulation', lastSlow = 0;
  function onShow(name) {
    current = name;
    renderSideInfo(name);
    if (name === 'formula') showFormula(Number($('formulaSelect').value || 0));
    if (name === 'calculation') renderCalc();
    if (name === 'observation') renderObs();
    if (name === 'results') renderResults();
  }
  function tick(now) {
    if (current === 'graphs') drawGraphs();
    if (now - lastSlow > 250) {
      lastSlow = now;
      if (current === 'calculation') renderCalc();
      if (current === 'results') renderResults();
    }
  }
  window.ACPanels = { onShow, tick, derive, tex, drawGraphs };
  showFormula(0);
  if (window.katex === undefined) window.addEventListener('load', () => { showFormula(Number($('formulaSelect').value || 0)); renderSideInfo(current); });
})();

/* ==========================================================================
   controls.js — the right-hand "Controls" column

   Every adjustable quantity has BOTH a slider and a number box (with ▲▼
   steppers). The two stay in sync, and the oscilloscope-related controls also
   follow changes made with the knobs / buttons on the scope itself.
   ========================================================================== */
(function () {
  'use strict';
  const runtime = window.ACGeneratorRuntime;
  const P = runtime.PHYSICS;
  const SCOPE = runtime.SCOPE;
  const host = document.getElementById('sideControls');
  if (!host) return;

  const VOLTS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  const TIMES = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
  const nearest = (table, v) => table.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(table[b] - v) ? i : b), 0);
  const fmt = (v, d) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));

  const syncers = [];                      // functions that re-read the model into the widgets
  const refreshAll = () => syncers.forEach((f) => f());

  /* ---------- generic builders ---------- */
  function section(title, open) {
    const d = document.createElement('details');
    d.className = 'side-details';
    d.open = open !== false;
    d.innerHTML = '<summary>' + title + '</summary><div class="card-body"></div>';
    host.appendChild(d);
    return d.querySelector('.card-body');
  }
  function group(parent, text) {
    const h = document.createElement('div');
    h.className = 'var-group-title';
    h.textContent = text;
    parent.appendChild(h);
  }

  /* spec: {label, unit, min, max, step, dec, get(), set(v), toSlider?(v), fromSlider?(s), sMin?, sMax?, sStep?} */
  function slider(parent, spec) {
    const dec = spec.dec != null ? spec.dec : 0;
    const row = document.createElement('div');
    row.className = 'var-div';
    row.innerHTML =
      '<div class="var-value-row"><label class="var-label">' + spec.label + '</label>' +
        '<div class="input-unit-wrap"><div class="custom-stepper">' +
          '<input class="var-number-input" type="number" aria-label="' + spec.label + ' value">' +
          '<div class="stepper-arrow-box"><button type="button" class="step-btn step-up" tabindex="-1" aria-label="Increase">&#9650;</button><button type="button" class="step-btn" tabindex="-1" aria-label="Decrease">&#9660;</button></div>' +
        '</div><span class="var-unit">' + (spec.unit || '') + '</span></div></div>' +
      '<input class="var-range" type="range" aria-label="' + spec.label + ' slider">';
    parent.appendChild(row);
    const range = row.querySelector('input[type=range]');
    const num = row.querySelector('.var-number-input');
    const toS = spec.toSlider || ((v) => v), fromS = spec.fromSlider || ((s) => s);
    range.min = spec.sMin != null ? spec.sMin : spec.min; range.max = spec.sMax != null ? spec.sMax : spec.max; range.step = spec.sStep != null ? spec.sStep : spec.step;
    num.step = spec.step;

    const clamp = (v) => Math.min(spec.max(), Math.max(spec.min, v));
    const apply = (v) => { spec.set(v); refreshAll(); if (spec.after) spec.after(); };
    const sync = () => {
      const v = spec.get();
      if (spec.liveRange) { const r = spec.liveRange(); range.min = r[0]; range.max = r[1]; num.min = r[0]; num.max = r[1]; }
      range.value = toS(v);
      if (document.activeElement !== num) num.value = Number(v).toFixed(dec);
    };
    spec.min = typeof spec.min === 'function' ? spec.min : ((m) => () => m)(spec.min);
    const maxVal = spec.max; spec.max = typeof maxVal === 'function' ? maxVal : () => maxVal;
    const minFn = spec.min; spec.min = typeof minFn === 'function' ? minFn : () => minFn;
    const lo = () => (typeof spec.min === 'function' ? spec.min() : spec.min);
    const clamp2 = (v) => Math.min(spec.max(), Math.max(lo(), v));
    num.min = String(lo());
    num.max = String(spec.max());
    num.step = String(spec.step);
    void clamp;

    range.addEventListener('input', () => apply(clamp2(Number(fromS(Number(range.value))))));
    num.addEventListener('input', () => { const v = parseFloat(num.value); if (Number.isFinite(v)) { const next = clamp2(v); spec.set(next); range.value = toS(next); if (spec.after) spec.after(); refreshAll(); } });
    num.addEventListener('change', () => { const v = parseFloat(num.value); apply(clamp2(Number.isFinite(v) ? v : spec.get())); });
    num.addEventListener('keydown', (e) => { if (e.key === 'Enter') num.blur(); });
    row.querySelectorAll('.step-btn').forEach((b, i) => b.addEventListener('click', () => {
      const dir = i === 0 ? 1 : -1;
      const st = spec.stepBy ? spec.stepBy(dir) : spec.step * dir;
      apply(clamp2(Number((spec.get() + st).toFixed(6))));
    }));
    syncers.push(sync);
    sync();
    return { row, sync };
  }

  function checkbox(parent, label, get, set) {
    const l = document.createElement('label');
    l.className = 'switch-line';
    l.innerHTML = '<span>' + label + '</span><input type="checkbox">';
    const i = l.querySelector('input');
    i.addEventListener('change', () => { set(i.checked); refreshAll(); });
    parent.appendChild(l);
    syncers.push(() => { i.checked = !!get(); });
    i.checked = !!get();
    return l;
  }

  function actions(parent, defs) {
    const g = document.createElement('div');
    g.className = 'control-actions-grid';
    defs.forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'control-button' + (d.primary ? ' primary' : ''); b.textContent = d.text;
      b.addEventListener('click', () => { d.run(b); refreshAll(); });
      g.appendChild(b);
      if (d.sync) syncers.push(() => d.sync(b));
    });
    parent.appendChild(g);
  }

  const CRO = () => window.ACGeneratorCRO;

  /* ===================== 1. Simulation ===================== */
  const toolbar = document.querySelector('.simulation-toolbar');
  if (toolbar && !document.getElementById('toolbarPause')) {
    const controls = document.createElement('div');
    controls.className = 'simulation-toolbar-controls';
    controls.innerHTML =
      '<div class="simulation-toolbar-actions">' +
        '<button type="button" class="control-button primary" id="toolbarPause">Pause</button>' +
        '<button type="button" class="control-button" id="toolbarReset">Reset</button>' +
        '<button type="button" class="control-button" id="toolbarAutoscale">Auto-scale CRO</button>' +
      '</div>';
    toolbar.appendChild(controls);
    const pause = controls.querySelector('#toolbarPause');
    pause.addEventListener('click', () => { P.running = !P.running; setStatus(); refreshAll(); });
    controls.querySelector('#toolbarReset').addEventListener('click', () => { runtime.reset(); window.ACApp && window.ACApp.afterReset(); refreshAll(); });
    controls.querySelector('#toolbarAutoscale').addEventListener('click', () => { CRO().autoScaleScope(); refreshAll(); });
    syncers.push(() => { pause.textContent = P.running ? 'Pause' : 'Resume'; });
    const phaseWrap = document.createElement('div');
    phaseWrap.className = 'toolbar-phase-config';
    phaseWrap.innerHTML = '<label class="group-label" for="toolbarPhaseMode">Phase configuration</label><select id="toolbarPhaseMode" class="toolbar-select"><option value="1">1-Phase</option><option value="2">2-Phase</option><option value="3">3-Phase</option></select>';
    const phaseSelect = phaseWrap.querySelector('select');
    phaseSelect.addEventListener('change', () => { runtime.setPhaseMode(Number(phaseSelect.value)); CRO().autoScaleScope(); refreshAll(); });
    controls.appendChild(phaseWrap);
    syncers.push(() => { phaseSelect.value = String(P.phaseMode); });

    // Direct-connect toggle: removes bulbs while retaining the circuit path.
    const direct = document.createElement('label');
    direct.className = 'toolbar-direct-connect';
    direct.innerHTML = '<span>Direct connect <small>(remove bulbs)</small></span><input type="checkbox" aria-label="Direct connect (remove bulbs)">';
    const directInput = direct.querySelector('input');
    directInput.addEventListener('change', () => { runtime.setDirectConnect(directInput.checked); CRO().autoScaleScope(); refreshAll(); });
    controls.appendChild(direct);
    syncers.push(() => { directInput.checked = !!P.directConnect; });
    directInput.checked = !!P.directConnect;
  }

  // The visibly wired lamps are the fixed resistive load; brightness is RMS heating.
  P.switchOn = true;

  function setStatus() {
    const dot = document.getElementById('statusDot'), txt = document.getElementById('experimentStatus');
    if (dot) dot.className = 'status-dot ' + (P.running ? 'running' : 'paused');
    if (txt) txt.textContent = P.running ? 'Generator running' : 'Paused';
  }

  /* ===================== 2. Generator physics ===================== */
  const gen = section('Generator controls');
  slider(gen, { label: 'Rotor speed', unit: 'RPM', min: 30, max: 1500, step: 10, dec: 0, get: () => P.rpm, set: (v) => { P.rpm = v; }, after: () => CRO().autoScaleScope() });
  slider(gen, { label: 'Flux density B', unit: 'T', min: 0.1, max: 1.5, step: 0.05, dec: 2, get: () => P.B, set: (v) => { P.B = v; } });
  slider(gen, { label: 'Coil turns N', unit: 'turns', min: 1, max: 100, step: 1, dec: 0, get: () => P.turns, set: (v) => { P.turns = Math.round(v); } });
  slider(gen, { label: 'Bulb resistance (hot)', unit: '\u03A9', min: 6, max: 60, step: 1, dec: 0, get: () => P.R_hot, set: (v) => { P.R_hot = v; } });

  /* ===================== 3. CRO controls ===================== */
  const cro = section('CRO controls');
  group(cro, 'Horizontal');
  slider(cro, {
    label: 'Time / div', unit: 'ms', min: 0, max: TIMES.length - 1, step: 1, dec: 0, sStep: 1,
    get: () => nearest(TIMES, SCOPE.timeDiv), set: (i) => { SCOPE.timeDiv = TIMES[Math.round(i)]; },
    after: () => CRO().refreshAllKnobs(), fmtOverride: true
  });
  // time/div is shown in ms: wrap the index slider with a ms number box
  (function retrofitTime() {
    const row = cro.lastElementChild;
    const num = row.querySelector('.var-number-input');
    const range = row.querySelector('input[type=range]');
    num.step = 1; num.removeAttribute('min'); num.removeAttribute('max');
    const show = () => { if (document.activeElement !== num) num.value = (SCOPE.timeDiv * 1000).toString(); };
    const commit = () => { const ms = parseFloat(num.value); if (Number.isFinite(ms)) { SCOPE.timeDiv = TIMES[nearest(TIMES, ms / 1000)]; CRO().refreshAllKnobs(); refreshAll(); } };
    const fresh = num.cloneNode(true); num.replaceWith(fresh);
    fresh.addEventListener('change', commit);
    fresh.addEventListener('keydown', (e) => { if (e.key === 'Enter') fresh.blur(); });
    row.querySelectorAll('.step-btn').forEach((b, i) => { const nb = b.cloneNode(true); b.replaceWith(nb); nb.addEventListener('click', () => { SCOPE.timeDiv = TIMES[Math.max(0, Math.min(TIMES.length - 1, nearest(TIMES, SCOPE.timeDiv) + (i === 0 ? 1 : -1)))]; CRO().refreshAllKnobs(); refreshAll(); }); });
    range.addEventListener('input', () => { fresh.value = (SCOPE.timeDiv * 1000).toString(); });
    syncers.push(() => { if (document.activeElement !== fresh) fresh.value = (SCOPE.timeDiv * 1000).toString(); range.value = nearest(TIMES, SCOPE.timeDiv); });
    void show;
  })();
  slider(cro, {
    label: 'Horizontal position', unit: 's', min: -0.5, max: 0.5, step: 0.001, dec: 3,
    get: () => SCOPE.horizOffset, set: (v) => { SCOPE.horizOffset = v; }, after: () => CRO().refreshAllKnobs()
  });

  const channelPicker = document.createElement('div');
  channelPicker.className = 'control-group channel-picker';
  channelPicker.innerHTML = '<span class="group-label">Phase channel</span><select class="mini-select"><option value="1">Phase U — CH1</option><option value="2">Phase V — CH2</option><option value="3">Phase W — CH3</option></select>';
  cro.appendChild(channelPicker);
  const channelSelect = channelPicker.querySelector('select');
  const channelPanels = [];

  [1, 2, 3].forEach((ch) => {
    const names = ['', 'CH1 \u2014 Phase U', 'CH2 \u2014 Phase V', 'CH3 \u2014 Phase W'];
    const colour = ['', '#d4a800', '#0aa5bd', '#c026d3'][ch];
    const channel = document.createElement('div');
    channel.className = 'channel-details'; channel.hidden = ch !== 1;
    channel.innerHTML = '<div class="channel-panel-title"><i class="ch-dot" style="background:' + colour + '"></i>' + names[ch] + '</div><div class="channel-details-body"></div>';
    const wrapper = channel.querySelector('.channel-details-body');
    wrapper.dataset.ch = ch;
    cro.appendChild(channel);
    channelPanels.push(channel);
    checkbox(wrapper, '<i class="ch-dot" style="background:' + colour + '"></i>Channel on', () => SCOPE.channels[ch].on, (v) => { SCOPE.channels[ch].on = v; CRO().updateChannelButtonStates(); CRO().refreshAllKnobs(); });
    slider(wrapper, {
      label: 'Volts / div', unit: 'V', min: 0, max: VOLTS.length - 1, step: 1, dec: 2,
      get: () => nearest(VOLTS, SCOPE.channels[ch].voltsDiv), set: (i) => { SCOPE.channels[ch].voltsDiv = VOLTS[Math.round(i)]; }, after: () => CRO().refreshAllKnobs()
    });
    const vrow = wrapper.lastElementChild;
    (function retrofitVolts() {
      const num = vrow.querySelector('.var-number-input'), range = vrow.querySelector('input[type=range]');
      const fresh = num.cloneNode(true); num.replaceWith(fresh);
      const commit = () => { const v = parseFloat(fresh.value); if (Number.isFinite(v)) { SCOPE.channels[ch].voltsDiv = VOLTS[nearest(VOLTS, v)]; CRO().refreshAllKnobs(); refreshAll(); } };
      fresh.step = 'any';
      fresh.addEventListener('change', commit);
      fresh.addEventListener('keydown', (e) => { if (e.key === 'Enter') fresh.blur(); });
      vrow.querySelectorAll('.step-btn').forEach((b, i) => { const nb = b.cloneNode(true); b.replaceWith(nb); nb.addEventListener('click', () => { SCOPE.channels[ch].voltsDiv = VOLTS[Math.max(0, Math.min(VOLTS.length - 1, nearest(VOLTS, SCOPE.channels[ch].voltsDiv) + (i === 0 ? 1 : -1)))]; CRO().refreshAllKnobs(); refreshAll(); }); });
      range.addEventListener('input', () => { fresh.value = String(VOLTS[Math.round(Number(range.value))]); });
      syncers.push(() => { if (document.activeElement !== fresh) fresh.value = String(SCOPE.channels[ch].voltsDiv); range.value = nearest(VOLTS, SCOPE.channels[ch].voltsDiv); });
    })();
    slider(wrapper, {
      label: 'Vertical position', unit: 'V', min: () => -4 * SCOPE.channels[ch].voltsDiv, max: () => 4 * SCOPE.channels[ch].voltsDiv, step: 0.1, dec: 2,
      sMin: -50, sMax: 50, sStep: 0.1,
      liveRange: () => [-4 * SCOPE.channels[ch].voltsDiv, 4 * SCOPE.channels[ch].voltsDiv],
      get: () => SCOPE.channels[ch].position, set: (v) => { SCOPE.channels[ch].position = v; }, after: () => CRO().refreshAllKnobs()
    });
  });
  channelSelect.addEventListener('change', () => {
    const active = Number(channelSelect.value);
    channelPanels.forEach((panel, index) => { panel.hidden = index + 1 !== active; });
  });

  group(cro, 'Trigger & acquisition');
  const trigSel = document.createElement('div');
  trigSel.className = 'control-group';
  trigSel.innerHTML = '<span class="group-label">Trigger source</span><select class="mini-select"><option value="1">CH1</option><option value="2">CH2</option><option value="3">CH3</option></select>';
  cro.appendChild(trigSel);
  const ts = trigSel.querySelector('select');
  ts.addEventListener('change', () => { SCOPE.triggerSource = Number(ts.value); CRO().refreshAllKnobs(); });
  syncers.push(() => { ts.value = String(SCOPE.triggerSource); });
  slider(cro, {
    label: 'Trigger level', unit: 'V', min: -40, max: 40, step: 0.1, dec: 2, get: () => SCOPE.triggerLevel, set: (v) => { SCOPE.triggerLevel = v; }, after: () => CRO().refreshAllKnobs()
  });
  slider(cro, {
    label: 'Waveform intensity', unit: '%', min: 10, max: 100, step: 5, dec: 0, get: () => SCOPE.intensity * 100, set: (v) => { SCOPE.intensity = v / 100; }, after: () => CRO().refreshAllKnobs()
  });
  checkbox(cro, 'Scope power', () => SCOPE.power, (v) => { if (SCOPE.power !== v) document.getElementById('powerSwitch')?.click(); });
  actions(cro, [
    { text: 'Run / Stop', primary: true, run: () => { SCOPE.running = !SCOPE.running; CRO().updateRunStopUI(); } },
    { text: 'Auto-scale', run: () => CRO().autoScaleScope() }
  ]);

  /* ---------- keep widgets in sync with the on-scope knobs and buttons ---------- */
  CRO().onChange = refreshAll;
  document.getElementById('cro-group')?.addEventListener('pointerup', () => setTimeout(refreshAll, 0));
  document.getElementById('cro-group')?.addEventListener('click', () => setTimeout(refreshAll, 0));
  document.getElementById('cro-group')?.addEventListener('wheel', () => setTimeout(refreshAll, 0), { passive: true });

  window.ACControls = { refreshAll, setStatus };
  refreshAll();
})();
