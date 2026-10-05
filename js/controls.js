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
