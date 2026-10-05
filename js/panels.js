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
    const Vl = Math.sqrt(3) * Vph;
    const Pl = openCircuit ? 0 : I * I * Rb;
    return { A, w, f, E0, Erms, Rb, Rt, I, Vph, Vl, Pl, Ptot: Pl * Math.max(1, P.phaseMode), openCircuit };
  }
  runtime.derive = derive;

  /* ======================= DIAGRAM ======================= */
  $('panel-diagram').innerHTML =
    '<figure class="diagram-stage"><img src="images/Star_connection.png" alt="Star connection of a three-phase generator" />' +
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
      ['Line voltage (star)', 'V_L = \\sqrt{3}\\,V_{ph} = 1.732 \\times ' + d.Vph.toFixed(2), fx(d.Vl, 2) + ' V'],
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
                      mode === 2 ? 'Total power has reduced ripple' :
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
      ['Voltage terms', '<ul><li><strong>Phase voltage</strong> — across one winding (live to neutral).</li><li><strong>Line voltage</strong> — between two live conductors, √3 × phase voltage.</li></ul>']
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
      ['Reading the numbers', '<div>RMS values equal peak ÷ √2. Line voltage is √3 × phase voltage in a star connection.</div>'],
      ['Why current is not proportional to speed', '<div>The lamp resistance rises as it heats, so doubling the speed raises current by less than double.</div>']
    ]
  };
  function renderSideInfo(name) {
    const list = INFO[name] || [];
    $('sideInfo').innerHTML = list.map((c) => '<section class="info-card"><h4>' + c[0] + '</h4>' + c[1] + '</section>').join('');
    const eq = $('sideEqStar'); if (eq) eq.innerHTML = tex('V_L=\\sqrt{3}\\,V_{ph}');
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
