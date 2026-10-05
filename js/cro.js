(function () {
  'use strict';

  const runtime = window.ACGeneratorRuntime || (window.ACGeneratorRuntime = {
    view: { x: 0, y: 0, scale: 1 },
    PHYSICS: {
      rpm: 300,
      B: 0.6,
      turns: 15,
      coilWidth: 0.18,
      coilHeight: 0.24,
      R_internal: 1.5,
      R_cold: 3.0,
      R_hot: 24.0,
      P_rated: 6.0,
      thermalTau: 0.15,
      simTime: 0,
      tempNorm: 0,
      switchOn: true,
      phaseMode: 1,
    },
    state: {
      E: 0,
      I: 0,
      V: 0,
      P: 0,
      instE: 0,
      instI: 0,
      instV: 0,
      _msI: 0,
      _msV: 0,
    },
    sampleBuffer: [],
  });

  const PHYSICS = runtime.PHYSICS;
  const state = runtime.state;
  const sampleBuffer = runtime.sampleBuffer;

  runtime.SCOPE = runtime.SCOPE || {
    power: true,
    running: true,
    timeDiv: 0.02,
    horizOffset: 0,
    triggerLevel: 0,
    triggerSource: 1,
    selected: 1,
    intensity: 1.0,
    math: false,
    ref: false,
    refPath: '',
    cursors: false,
    cursorX1: 320,
    cursorX2: 480,
    displayMode: 'vector', // 'vector' or 'dots'
    channels: {
      1: { on: true, voltsDiv: 5, position: 0 },
      2: { on: true, voltsDiv: 5, position: 0 },
      3: { on: false, voltsDiv: 5, position: 0 },
    },
  };

  const SCOPE = runtime.SCOPE;
  const W = 800;
  const H = 480;

  const VOLTS_TABLE = [0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0];
  const TIME_TABLE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];

  let sweepAnchor = 0;
  let singleArmed = false;
  let singleAnchorSeen = null;
  let frozenSamples = null;
  let activeMenuItem = 'Period';

  function nearestIndex(table, val) {
    let bestIdx = 0;
    let bestDist = Infinity;
    const v = Math.max(1e-6, Math.abs(val));
    for (let i = 0; i < table.length; i++) {
      const dist = Math.abs(Math.log(table[i]) - Math.log(v));
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function formatSeconds(value) {
    if (value >= 1) return value.toFixed(2) + 's';
    if (value >= 0.001) return (value * 1000).toFixed(1) + 'ms';
    return (value * 1e6).toFixed(0) + 'μs';
  }

  function omega() {
    return PHYSICS.rpm * 2 * Math.PI / 60;
  }

  function coilArea() {
    return PHYSICS.coilWidth * PHYSICS.coilHeight;
  }

  function freqHz() {
    return Math.max(0.01, PHYSICS.rpm / 60);
  }

  function periodSec() {
    return 1 / freqHz();
  }

  // ---------------------------------------------------------------------
  // Trigger & Sweep logic
  // ---------------------------------------------------------------------
  function findTriggerTime(beforeT, notBeforeT) {
    const key = 'ch' + SCOPE.triggerSource;
    for (let i = sampleBuffer.length - 1; i > 0; i--) {
      const cur = sampleBuffer[i];
      const prev = sampleBuffer[i - 1];
      if (cur.t > beforeT) continue;
      if (cur.t < notBeforeT) break;
      const a = prev[key];
      const b = cur[key];
      if (a < SCOPE.triggerLevel && b >= SCOPE.triggerLevel) {
        const denom = (b - a) || 1e-9;
        const frac = (SCOPE.triggerLevel - a) / denom;
        return prev.t + (cur.t - prev.t) * frac;
      }
    }
    return null;
  }

  function updateSweepAnchor() {
    const windowT = SCOPE.timeDiv * 10;
    if (PHYSICS.simTime - sweepAnchor >= windowT) {
      const searchBefore = PHYSICS.simTime - windowT;
      const found = findTriggerTime(searchBefore, searchBefore - windowT * 2.5);
      if (found !== null) {
        sweepAnchor = found;
        if (singleArmed && singleAnchorSeen === null) singleAnchorSeen = found;
      } else {
        sweepAnchor = Math.max(0, searchBefore);
      }
    }
  }

  function checkSingleShotStop() {
    if (!singleArmed || singleAnchorSeen === null) return;
    const windowT = SCOPE.timeDiv * 10;
    if (PHYSICS.simTime >= singleAnchorSeen + windowT) {
      SCOPE.running = false;
      singleArmed = false;
      updateRunStopUI();
      redrawTraces();
    }
  }

  // ---------------------------------------------------------------------
  // Trace rendering (viewBox = 0 0 800 480)
  // ---------------------------------------------------------------------
  function modelSample(key, t) {
    const offsets = runtime.phaseOffsets ? runtime.phaseOffsets(PHYSICS.phaseMode) : [0, 0, 0];
    const ch = Number(String(key).replace('ch', '')) || 1;
    const E0 = PHYSICS.turns * coilArea() * PHYSICS.B * omega();
    const Rbulb = runtime.lampR ? runtime.lampR() : PHYSICS.R_cold;
    const amp = PHYSICS.switchOn ? E0 * Rbulb / (PHYSICS.R_internal + Rbulb) : E0;
    const theta = runtime.theta + omega() * (t - PHYSICS.simTime);
    return amp * Math.sin(theta + (offsets[ch - 1] || 0));
  }

  function valueAt(key, t) {
    const source = !SCOPE.running && frozenSamples ? frozenSamples : sampleBuffer;
    if (key !== 'math' && source.length > 1 && t >= source[0].t && t <= source[source.length - 1].t) {
      for (let i = source.length - 1; i > 0; i -= 1) {
        if (source[i - 1].t <= t) {
          const a = source[i - 1], b = source[i];
          const q = (t - a.t) / Math.max(1e-9, b.t - a.t);
          return a[key] + (b[key] - a[key]) * Math.max(0, Math.min(1, q));
        }
      }
    }
    if (key === 'math') return modelSample('ch1', t) - modelSample('ch2', t);
    return modelSample(key, t);
  }

  function buildTracePath(key, voltsDiv, position) {
    const windowT = SCOPE.timeDiv * 10;
    const t0 = sweepAnchor + SCOPE.horizOffset;
    const yCenter = H / 2, yDiv = H / 8;
    let d = '';
    for (let i = 0; i <= 600; i += 1) {
      const x = (i / 600) * W;
      const val = valueAt(key, t0 + (i / 600) * windowT);
      const y = Math.max(-100, Math.min(H + 100, yCenter - ((val + position) / voltsDiv) * yDiv));
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    return d;
  }

  function resetAcquisition() { sweepAnchor = Math.max(0, PHYSICS.simTime - SCOPE.timeDiv * 10); frozenSamples = null; singleArmed = false; redrawTraces(); }
  function freezeAcquisition() { frozenSamples = sampleBuffer.map((sample) => Object.assign({}, sample)); }

  function redrawTraces() {
    const scopeScreenSvg = document.getElementById('scopeScreenSvg');
    if (!scopeScreenSvg) return;

    if (!SCOPE.power) {
      [1, 2, 3].forEach((ch) => {
        const p = document.getElementById('traceCh' + ch);
        const f = document.getElementById('flagCh' + ch);
        if (p) p.style.display = 'none';
        if (f) f.style.display = 'none';
      });
      const trig = document.getElementById('triggerMarker');
      if (trig) trig.style.display = 'none';
      const mTrace = document.getElementById('traceMath');
      const mFlag = document.getElementById('flagMath');
      if (mTrace) mTrace.style.display = 'none';
      if (mFlag) mFlag.style.display = 'none';
      const rTrace = document.getElementById('traceRef');
      if (rTrace) rTrace.style.display = 'none';
      return;
    }

    // Render channels 1, 2, 3
    [1, 2, 3].forEach((ch) => {
      const c = SCOPE.channels[ch];
      const path = document.getElementById('traceCh' + ch);
      const flag = document.getElementById('flagCh' + ch);

      if (!c.on) {
        if (path) path.style.display = 'none';
        if (flag) flag.style.display = 'none';
        return;
      }

      if (path) {
        path.style.display = '';
        path.setAttribute('d', buildTracePath('ch' + ch, c.voltsDiv, c.position));
        path.setAttribute('stroke-dasharray', SCOPE.displayMode === 'dots' ? '2,4' : 'none');
        path.setAttribute('opacity', String(SCOPE.intensity));
      }
      if (flag) {
        flag.style.display = '';
        const flagY = (H / 2) - (c.position / c.voltsDiv) * (H / 8);
        const clampedFlagY = Math.max(12, Math.min(H - 12, flagY));
        flag.setAttribute('transform', 'translate(0,' + clampedFlagY.toFixed(1) + ')');
      }
    });

    // Render Math trace
    const traceMath = document.getElementById('traceMath');
    const flagMath = document.getElementById('flagMath');
    if (SCOPE.math && SCOPE.channels[1].on && SCOPE.channels[2].on) {
      if (traceMath) {
        traceMath.style.display = '';
        const mVoltsDiv = SCOPE.channels[SCOPE.selected]?.voltsDiv || 5;
        traceMath.setAttribute('d', buildTracePath('math', mVoltsDiv, 0));
        traceMath.setAttribute('opacity', String(SCOPE.intensity));
      }
      if (flagMath) {
        flagMath.style.display = '';
        flagMath.setAttribute('transform', 'translate(0, 240)');
      }
    } else {
      if (traceMath) traceMath.style.display = 'none';
      if (flagMath) flagMath.style.display = 'none';
    }

    // Render Ref trace
    const traceRef = document.getElementById('traceRef');
    if (traceRef) {
      if (SCOPE.ref && SCOPE.refPath) {
        traceRef.style.display = '';
        traceRef.setAttribute('d', SCOPE.refPath);
      } else {
        traceRef.style.display = 'none';
      }
    }

    // Render Trigger marker
    const trig = document.getElementById('triggerMarker');
    const triggerChannel = SCOPE.channels[SCOPE.triggerSource];
    if (trig && triggerChannel && triggerChannel.on) {
      trig.style.display = '';
      const ty = (H / 2) - ((SCOPE.triggerLevel + triggerChannel.position) / triggerChannel.voltsDiv) * (H / 8);
      const clampedTy = Math.max(12, Math.min(H - 12, ty));
      trig.setAttribute('transform', 'translate(0,' + clampedTy.toFixed(1) + ')');
    } else if (trig) {
      trig.style.display = 'none';
    }

    // Render Measurement Cursors
    const scopeCursors = document.getElementById('scopeCursors');
    if (scopeCursors) {
      if (SCOPE.cursors) {
        scopeCursors.style.display = '';
        const curA = document.getElementById('cursorA');
        const curB = document.getElementById('cursorB');
        const curTxt = document.getElementById('cursorDeltaText');
        const x1 = SCOPE.cursorX1 || 320;
        const x2 = SCOPE.cursorX2 || 480;
        if (curA) { curA.setAttribute('x1', x1); curA.setAttribute('x2', x1); }
        if (curB) { curB.setAttribute('x1', x2); curB.setAttribute('x2', x2); }
        if (curTxt) {
          const dtVal = Math.abs(x2 - x1) / W * (SCOPE.timeDiv * 10);
          const fEquiv = dtVal > 1e-5 ? (1 / dtVal).toFixed(1) + 'Hz' : '--';
          curTxt.textContent = 'ΔX: ' + formatSeconds(dtVal) + ' (' + fEquiv + ')';
        }
      } else {
        scopeCursors.style.display = 'none';
      }
    }
  }

  // ---------------------------------------------------------------------
  // Knob control handler with drag, wheel, click, and 3D visual rotation
  // ---------------------------------------------------------------------
  function attachKnob(el, opts) {
    if (!el) return { refresh: () => {} };

    let dragging = null;

    function refreshRotation() {
      let t = 0;
      if (opts.mode === 'detent') {
        const idx = opts.getIndex();
        t = idx / (opts.table.length - 1);
      } else {
        const val = opts.get();
        t = (val - opts.min) / (opts.max - opts.min);
      }
      t = Math.max(0, Math.min(1, t));
      const deg = -135 + t * 270;
      el.style.transform = 'rotate(' + deg.toFixed(1) + 'deg)';
    }

    // Dragging
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragging = { x: e.clientX, y: e.clientY };
      el.classList.remove('smooth-turn');
      try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (_) {}
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      e.stopPropagation();
      e.preventDefault();
      const dx = e.clientX - dragging.x;
      const dy = dragging.y - e.clientY; // upward is positive
      const delta = dy + dx;
      if (Math.abs(delta) < 2) return;
      dragging = { x: e.clientX, y: e.clientY };

      if (opts.mode === 'detent') {
        const curIdx = opts.getIndex();
        const step = delta > 0 ? 1 : -1;
        const newIdx = Math.max(0, Math.min(opts.table.length - 1, curIdx + step));
        if (newIdx !== curIdx) {
          opts.setIndex(newIdx);
          refreshRotation();
          opts.onChange && opts.onChange();
        }
      } else {
        const span = opts.max - opts.min;
        const change = (delta / 140) * span;
        let newV = opts.get() + change;
        newV = Math.max(opts.min, Math.min(opts.max, newV));
        opts.set(newV);
        refreshRotation();
        opts.onChange && opts.onChange();
      }
    });

    const endDrag = (e) => {
      if (dragging) {
        dragging = null;
        try { el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    // Mouse wheel support
    el.addEventListener('wheel', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      if (opts.mode === 'detent') {
        const curIdx = opts.getIndex();
        const newIdx = Math.max(0, Math.min(opts.table.length - 1, curIdx + dir));
        if (newIdx !== curIdx) {
          opts.setIndex(newIdx);
          refreshRotation();
          opts.onChange && opts.onChange();
        }
      } else {
        const span = opts.max - opts.min;
        const step = (span / 40) * dir;
        let newV = Math.max(opts.min, Math.min(opts.max, opts.get() + step));
        opts.set(newV);
        refreshRotation();
        opts.onChange && opts.onChange();
      }
    }, { passive: false });

    // Click to step
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opts.mode === 'detent') {
        const curIdx = opts.getIndex();
        const newIdx = (curIdx + 1) % opts.table.length;
        opts.setIndex(newIdx);
        refreshRotation();
        opts.onChange && opts.onChange();
      }
    });

    refreshRotation();
    return { refresh: refreshRotation };
  }

  // ---------------------------------------------------------------------
  // Instantiate all knobs
  // ---------------------------------------------------------------------
  let vertScaleKnob, vertPositionKnob, horizScaleKnob, horizPositionKnob, triggerLevelKnob, intensityKnob;

  function refreshAllKnobs() {
    vertScaleKnob?.refresh();
    vertPositionKnob?.refresh();
    horizScaleKnob?.refresh();
    horizPositionKnob?.refresh();
    triggerLevelKnob?.refresh();
    intensityKnob?.refresh();
  }

  function initKnobs() {
    // 1. Vertical Scale (Volts/Div of selected channel)
    vertScaleKnob = attachKnob(document.getElementById('knobVertScale'), {
      mode: 'detent',
      table: VOLTS_TABLE,
      getIndex: () => nearestIndex(VOLTS_TABLE, SCOPE.channels[SCOPE.selected]?.voltsDiv || 5),
      setIndex: (i) => {
        if (SCOPE.channels[SCOPE.selected]) {
          SCOPE.channels[SCOPE.selected].voltsDiv = VOLTS_TABLE[i];
        }
      },
      onChange: () => {
        updateTextReadouts();
        redrawTraces();
        syncSidePanel();
      },
    });

    // 2. Vertical Position (Position offset of selected channel)
    vertPositionKnob = attachKnob(document.getElementById('knobVertPosition'), {
      mode: 'continuous',
      min: -25,
      max: 25,
      get: () => SCOPE.channels[SCOPE.selected]?.position || 0,
      set: (v) => {
        if (SCOPE.channels[SCOPE.selected]) {
          SCOPE.channels[SCOPE.selected].position = v;
        }
      },
      onChange: () => {
        redrawTraces();
        syncSidePanel();
      },
    });

    // 3. Horizontal Scale (Time/Div)
    horizScaleKnob = attachKnob(document.getElementById('knobHorizScale'), {
      mode: 'detent',
      table: TIME_TABLE,
      getIndex: () => nearestIndex(TIME_TABLE, SCOPE.timeDiv),
      setIndex: (i) => {
        SCOPE.timeDiv = TIME_TABLE[i];
      },
      onChange: () => {
        updateTextReadouts();
        redrawTraces();
        syncSidePanel();
      },
    });

    // 4. Horizontal Position (horizOffset)
    horizPositionKnob = attachKnob(document.getElementById('knobHorizPosition'), {
      mode: 'continuous',
      min: -0.2,
      max: 0.2,
      get: () => SCOPE.horizOffset,
      set: (v) => {
        SCOPE.horizOffset = v;
      },
      onChange: () => {
        redrawTraces();
        syncSidePanel();
      },
    });

    // 5. Trigger Level
    triggerLevelKnob = attachKnob(document.getElementById('knobTriggerLevel'), {
      mode: 'continuous',
      min: -40,
      max: 40,
      get: () => SCOPE.triggerLevel,
      set: (v) => {
        SCOPE.triggerLevel = v;
      },
      onChange: () => {
        updateTextReadouts();
        redrawTraces();
        syncSidePanel();
      },
    });

    // 6. Intensity Knob
    intensityKnob = attachKnob(document.getElementById('knobIntensity'), {
      mode: 'continuous',
      min: 0.3,
      max: 1.0,
      get: () => SCOPE.intensity,
      set: (v) => {
        SCOPE.intensity = v;
      },
      onChange: () => {
        redrawTraces();
      },
    });
  }

  // ---------------------------------------------------------------------
  // Channel Selection and Buttons UI
  // ---------------------------------------------------------------------
  function updateChannelButtonStates() {
    [1, 2, 3].forEach((ch) => {
      const btn = document.getElementById('btnCh' + ch);
      const c = SCOPE.channels[ch];
      if (!btn) return;
      btn.classList.toggle('channel-off', !c.on);
      btn.classList.toggle('channel-selected', SCOPE.selected === ch);
    });

    const mBtn = document.getElementById('btnMath');
    if (mBtn) mBtn.classList.toggle('channel-selected', !!SCOPE.math);

    const rBtn = document.getElementById('btnRef');
    if (rBtn) rBtn.classList.toggle('channel-selected', !!SCOPE.ref);

    const curBtn = document.getElementById('btnCursor');
    if (curBtn) curBtn.classList.toggle('pressed', !!SCOPE.cursors);
  }

  function onChBtnClick(ch) {
    const c = SCOPE.channels[ch];
    if (!c.on) {
      c.on = true;
      SCOPE.selected = ch;
    } else if (SCOPE.selected === ch) {
      const otherOn = [1, 2, 3].some((k) => k !== ch && SCOPE.channels[k].on);
      if (otherOn) {
        c.on = false;
        SCOPE.selected = [1, 2, 3].find((k) => SCOPE.channels[k].on) || 1;
      }
    } else {
      SCOPE.selected = ch;
    }
    updateChannelButtonStates();
    refreshAllKnobs();
    updateTextReadouts();
    redrawTraces();
    syncSidePanel();
  }

  function updateRunStopUI() {
    const el = document.getElementById('runStatusText');
    if (el) {
      el.textContent = SCOPE.running ? 'RUN' : 'STOP';
      el.style.color = SCOPE.running ? '#4ade80' : '#f87171';
    }
    const runButton = document.getElementById('btnRunStop');
    if (runButton) runButton.classList.toggle('pressed', !SCOPE.running);
  }

  function syncChannelState() {
    const phaseMode = PHYSICS.phaseMode || 1;
    SCOPE.channels[1].on = true;
    SCOPE.channels[2].on = phaseMode >= 2;
    SCOPE.channels[3].on = phaseMode >= 3;
    if (!SCOPE.channels[SCOPE.selected]?.on) {
      SCOPE.selected = 1;
    }
    updateChannelButtonStates();
    refreshAllKnobs();
    updateTextReadouts();
    redrawTraces();
  }

  function autoScaleScope() {
    const A = coilArea();
    const w = omega();
    const E0 = PHYSICS.turns * A * PHYSICS.B * w;
    const peakV = Math.max(0.2, E0 * 1.3);

    // Pick voltsDiv such that peak spans ~2-3 vertical divisions (of 4)
    let bestVd = 5;
    for (let i = 0; i < VOLTS_TABLE.length; i++) {
      if (VOLTS_TABLE[i] * 3 >= peakV) {
        bestVd = VOLTS_TABLE[i];
        break;
      }
    }

    [1, 2, 3].forEach((ch) => {
      SCOPE.channels[ch].voltsDiv = bestVd;
      SCOPE.channels[ch].position = 0;
    });

    const phaseMode = PHYSICS.phaseMode || 1;
    SCOPE.channels[1].on = true;
    SCOPE.channels[2].on = phaseMode >= 2;
    SCOPE.channels[3].on = phaseMode >= 3;
    SCOPE.selected = 1;

    // Pick timeDiv such that ~2 cycles span the 10 divisions
    const f = freqHz();
    const T = 1 / f;
    const targetTd = (T * 2) / 10;
    let bestTd = 0.02;
    for (let i = 0; i < TIME_TABLE.length; i++) {
      if (TIME_TABLE[i] >= targetTd) {
        bestTd = TIME_TABLE[i];
        break;
      }
    }
    SCOPE.timeDiv = bestTd;
    SCOPE.horizOffset = 0;
    SCOPE.triggerLevel = 0;
    SCOPE.triggerSource = 1;
    SCOPE.running = true;
    frozenSamples = null;
    singleArmed = false;

    updateChannelButtonStates();
    updateRunStopUI();
    refreshAllKnobs();
    updateTextReadouts();
    redrawTraces();
    syncSidePanel();
  }

  // ---------------------------------------------------------------------
  // Wire all buttons on oscilloscope face
  // ---------------------------------------------------------------------
  function initButtons() {
    [1, 2, 3].forEach((ch) => {
      const btn = document.getElementById('btnCh' + ch);
      if (btn) btn.addEventListener('click', () => onChBtnClick(ch));
    });

    document.getElementById('btnRunStop')?.addEventListener('click', () => {
      SCOPE.running = !SCOPE.running;
      if (SCOPE.running) frozenSamples = null; else freezeAcquisition();
      singleArmed = false;
      updateRunStopUI();
      if (!SCOPE.running) redrawTraces();
      syncSidePanel();
    });

    document.getElementById('btnSingle')?.addEventListener('click', () => {
      SCOPE.running = true;
      frozenSamples = null;
      singleArmed = true;
      singleAnchorSeen = null;
      sweepAnchor = PHYSICS.simTime;
      updateRunStopUI();
      redrawTraces();
      syncSidePanel();
    });

    document.getElementById('btnClear')?.addEventListener('click', () => {
      sampleBuffer.length = 0;
      sweepAnchor = PHYSICS.simTime;
      SCOPE.refPath = '';
      redrawTraces();
    });

    document.getElementById('btnForce')?.addEventListener('click', () => {
      sweepAnchor = Math.max(0, PHYSICS.simTime - SCOPE.timeDiv * 10);
      SCOPE.running = true;
      updateRunStopUI();
      redrawTraces();
    });

    document.getElementById('btnAuto')?.addEventListener('click', autoScaleScope);

    // Math & Ref
    document.getElementById('btnMath')?.addEventListener('click', () => {
      SCOPE.math = !SCOPE.math;
      updateChannelButtonStates();
      redrawTraces();
    });

    document.getElementById('btnRef')?.addEventListener('click', () => {
      SCOPE.ref = !SCOPE.ref;
      if (SCOPE.ref) {
        const ch1 = SCOPE.channels[1];
        SCOPE.refPath = buildTracePath('ch1', ch1.voltsDiv, ch1.position);
      }
      updateChannelButtonStates();
      redrawTraces();
    });

    // Function buttons
    document.getElementById('btnCursor')?.addEventListener('click', () => {
      SCOPE.cursors = !SCOPE.cursors;
      updateChannelButtonStates();
      redrawTraces();
    });

    document.getElementById('btnAcquire')?.addEventListener('click', () => {
      SCOPE.displayMode = SCOPE.displayMode === 'vector' ? 'dots' : 'vector';
      const el = document.querySelector('.screen-side-nav.right .menu-item-val');
      if (el) el.textContent = SCOPE.displayMode === 'vector' ? 'Vector' : 'Dots';
      redrawTraces();
    });

    document.getElementById('btnDisplay')?.addEventListener('click', () => {
      SCOPE.intensity = SCOPE.intensity < 0.8 ? 1.0 : 0.6;
      intensityKnob?.refresh();
      redrawTraces();
    });

    document.getElementById('btnStorage')?.addEventListener('click', () => {
      const csv = ['t(s),ch1(V),ch2(V),ch3(V)'].concat(
        sampleBuffer.map((s) => s.t.toFixed(4) + ',' + s.ch1.toFixed(2) + ',' + s.ch2.toFixed(2) + ',' + s.ch3.toFixed(2))
      ).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'oscilloscope_data.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnMeasure')?.addEventListener('click', () => {
      const p = document.getElementById('menuItemPeriod');
      if (p) p.click();
    });

    document.getElementById('btnHelp')?.addEventListener('click', () => { if (window.ACHelp) window.ACHelp.open('cro'); });

    // Power switch
    const powerSwitch = document.getElementById('powerSwitch');
    const scopeScreenFrame = document.getElementById('scopeScreenFrame');
    if (powerSwitch) {
      powerSwitch.addEventListener('click', () => {
        SCOPE.power = !SCOPE.power;
        powerSwitch.classList.toggle('is-off', !SCOPE.power);
        if (scopeScreenFrame) scopeScreenFrame.classList.toggle('scope-off', !SCOPE.power);
        redrawTraces();
        syncSidePanel();
      });
    }

    // Direct clicks on screen readouts
    document.getElementById('timeDivReadout')?.addEventListener('click', () => {
      const idx = nearestIndex(TIME_TABLE, SCOPE.timeDiv);
      SCOPE.timeDiv = TIME_TABLE[(idx + 1) % TIME_TABLE.length];
      horizScaleKnob?.refresh();
      updateTextReadouts();
      redrawTraces();
      syncSidePanel();
    });

    document.getElementById('triggerLevelReadout')?.addEventListener('click', () => {
      SCOPE.triggerLevel = 0;
      triggerLevelKnob?.refresh();
      updateTextReadouts();
      redrawTraces();
      syncSidePanel();
    });

    document.getElementById('runStatusText')?.addEventListener('click', () => {
      document.getElementById('btnRunStop')?.click();
    });

    [1, 2, 3].forEach((ch) => {
      const handleVoltsDivClick = () => {
        SCOPE.selected = ch;
        const curIdx = nearestIndex(VOLTS_TABLE, SCOPE.channels[ch].voltsDiv);
        SCOPE.channels[ch].voltsDiv = VOLTS_TABLE[(curIdx + 1) % VOLTS_TABLE.length];
        vertScaleKnob?.refresh();
        updateChannelButtonStates();
        updateTextReadouts();
        redrawTraces();
        syncSidePanel();
      };
      const ro = document.getElementById('ch' + ch + 'VoltsDivReadout');
      ro?.addEventListener('click', handleVoltsDivClick);
      ro?.parentElement?.addEventListener('click', handleVoltsDivClick);
    });

    // Left Menu measurement selection
    const menuItems = [
      { id: 'menuItemPeriod', label: 'Period' },
      { id: 'menuItemFreq', label: 'Freq' },
      { id: 'menuItemRise', label: 'Rise' },
      { id: 'menuItemFall', label: 'Fall' },
      { id: 'menuItemWidthP', label: '+Width' },
      { id: 'menuItemWidthN', label: '-Width' },
    ];
    menuItems.forEach((m) => {
      const el = document.getElementById(m.id);
      if (el) {
        el.addEventListener('click', () => {
          activeMenuItem = m.label;
          menuItems.forEach((it) => document.getElementById(it.id)?.classList.remove('active'));
          el.classList.add('active');
        });
      }
    });

    // Softkey rows (left & right)
    const leftSoftkeys = document.querySelectorAll('.workspace-grid > .softkey-column:first-child .btn-softkey');
    leftSoftkeys.forEach((sk, idx) => {
      if (menuItems[idx]) {
        sk.addEventListener('click', () => {
          document.getElementById(menuItems[idx].id)?.click();
        });
      }
    });

    // Interactive Flag & Trigger dragging on SVG screen
    const setupSvgMarkerDrag = (elementId, onDrag) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      let isDragging = false;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isDragging = true;
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        e.preventDefault();
        const svg = document.getElementById('scopeScreenSvg');
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const svgY = relY * H;
        onDrag(svgY);
      });
      const endMarkerDrag = (e) => {
        if (isDragging) {
          isDragging = false;
          try { el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      window.addEventListener('pointerup', endMarkerDrag);
      window.addEventListener('pointercancel', endMarkerDrag);
    };

    [1, 2, 3].forEach((ch) => {
      setupSvgMarkerDrag('flagCh1', (y) => {
        const c = SCOPE.channels[1];
        c.position = ((H / 2 - y) / (H / 8)) * c.voltsDiv;
        vertPositionKnob?.refresh();
        redrawTraces();
        syncSidePanel();
      });
      setupSvgMarkerDrag('flagCh2', (y) => {
        const c = SCOPE.channels[2];
        c.position = ((H / 2 - y) / (H / 8)) * c.voltsDiv;
        vertPositionKnob?.refresh();
        redrawTraces();
        syncSidePanel();
      });
      setupSvgMarkerDrag('flagCh3', (y) => {
        const c = SCOPE.channels[3];
        c.position = ((H / 2 - y) / (H / 8)) * c.voltsDiv;
        vertPositionKnob?.refresh();
        redrawTraces();
        syncSidePanel();
      });
    });

    setupSvgMarkerDrag('triggerMarker', (y) => {
      const tc = SCOPE.channels[SCOPE.triggerSource];
      if (tc) {
        SCOPE.triggerLevel = ((H / 2 - y) / (H / 8)) * tc.voltsDiv - tc.position;
        triggerLevelKnob?.refresh();
        updateTextReadouts();
        redrawTraces();
        syncSidePanel();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Readout updates
  // ---------------------------------------------------------------------
  function updateTextReadouts() {
    const f = freqHz();
    const T = periodSec();

    const freqReadout = document.getElementById('freqReadout');
    const triggerLevelReadout = document.getElementById('triggerLevelReadout');
    const timeDivReadout = document.getElementById('timeDivReadout');
    const ch1VoltsDivReadout = document.getElementById('ch1VoltsDivReadout');
    const ch2VoltsDivReadout = document.getElementById('ch2VoltsDivReadout');
    const ch3VoltsDivReadout = document.getElementById('ch3VoltsDivReadout');
    const vrmsReadout = document.getElementById('vrmsReadout');
    const ppFormula = document.getElementById('pp-formula');
    const ppReadout = document.getElementById('pp-readout');

    if (freqReadout) freqReadout.textContent = 'f ' + f.toFixed(1) + 'Hz';
    if (triggerLevelReadout) triggerLevelReadout.textContent = SCOPE.triggerLevel.toFixed(2) + 'V';
    if (timeDivReadout) timeDivReadout.textContent = formatSeconds(SCOPE.timeDiv);
    if (ch1VoltsDivReadout) ch1VoltsDivReadout.textContent = SCOPE.channels[1].voltsDiv.toFixed(2) + 'V';
    if (ch2VoltsDivReadout) ch2VoltsDivReadout.textContent = SCOPE.channels[2].voltsDiv.toFixed(2) + 'V';
    if (ch3VoltsDivReadout) ch3VoltsDivReadout.textContent = SCOPE.channels[3].voltsDiv.toFixed(2) + 'V';
    if (vrmsReadout) vrmsReadout.textContent = 'Vrms ' + state.V.toFixed(2) + 'V  I ' + (state.I * 1000).toFixed(0) + 'mA';

    // On-screen measurement menu values
    const mP = document.getElementById('measPeriodVal');
    const mF = document.getElementById('measFreqVal');
    const mR = document.getElementById('measRiseVal');
    const mFall = document.getElementById('measFallVal');
    const mPW = document.getElementById('measPosWidthVal');
    const mNW = document.getElementById('measNegWidthVal');

    if (mP) mP.textContent = formatSeconds(T);
    if (mF) mF.textContent = f.toFixed(2) + 'Hz';
    if (mR) mR.textContent = formatSeconds(T / 4);
    if (mFall) mFall.textContent = formatSeconds(T / 4);
    if (mPW) mPW.textContent = formatSeconds(T / 2);
    if (mNW) mNW.textContent = formatSeconds(T / 2);

    if (ppFormula) {
      const A = coilArea();
      ppFormula.textContent = 'e(t) = ' + PHYSICS.turns + ' × ' + A.toFixed(4) + 'm² × ' + PHYSICS.B.toFixed(2) + 'T × ' + omega().toFixed(1) + 'rad/s × sin(θ)';
    }
    if (ppReadout) {
      const E0 = PHYSICS.turns * coilArea() * PHYSICS.B * omega();
      ppReadout.textContent = 'f = ' + f.toFixed(2) + ' Hz | E₀ = ' + E0.toFixed(1) + ' V | I = ' + (state.I * 1000).toFixed(0) + ' mA';
    }
  }

  // ---------------------------------------------------------------------
  // Side-panel hook: controls.js registers a callback so the sliders/inputs in
  // the side panel mirror every change made on the oscilloscope front panel.
  // ---------------------------------------------------------------------
  let syncSidePanel = () => { if (window.ACGeneratorCRO && typeof window.ACGeneratorCRO.onChange === 'function') window.ACGeneratorCRO.onChange(); };

  // ---------------------------------------------------------------------
  // Initialize Module
  // ---------------------------------------------------------------------
  initKnobs();
  initButtons();
  updateChannelButtonStates();
  updateRunStopUI();
  updateTextReadouts();

  window.ACGeneratorCRO = {
    SCOPE,
    redrawTraces,
    updateRunStopUI,
    updateTextReadouts,
    updateSweepAnchor,
    checkSingleShotStop,
    syncChannelState,
    autoScaleScope,
    refreshAllKnobs,
    onChange: null,
    updateChannelButtonStates,
    syncSidePanel: () => syncSidePanel(),
    buildTracePath,
    valueAt,
    getDisplayWindow: () => ({ start: sweepAnchor + SCOPE.horizOffset, duration: SCOPE.timeDiv * 10 }),
    resetAcquisition,
  };
})();
