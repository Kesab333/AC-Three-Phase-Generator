/* ==========================================================================
   physics.js — three-phase generator model (no DOM here, only numbers)

   e(t)  = N·A·B·ω·sin(θ)              EMF of one phase winding
   phase windings are 120° apart  ->  e_U, e_V, e_W
   star connection:  V_line = √3 · V_phase
   lamp: R rises from cold to hot as it heats (first-order thermal model)
   ========================================================================== */
(function () {
  'use strict';

  const DEFAULTS = {
    rpm: 300, B: 0.6, turns: 15,
    coilWidth: 0.18, coilHeight: 0.24,
    R_internal: 1.5, R_cold: 3.0, R_hot: 24.0,
    P_rated: 6.0, thermalTau: 0.15,
    switchOn: true, phaseMode: 3,
    directConnect: false          // true = remove bulbs, show open-circuit EMF
  };

  const runtime = window.ACGeneratorRuntime = {
    DEFAULTS,
    PHYSICS: Object.assign({}, DEFAULTS, { simTime: 0, tempNorm: 0, running: true }),
    state: { E: 0, E0: 0, V: 0, I: 0, P: 0, instE: 0, instI: 0, instV: 0, _msI: 0, _msV: 0, R_live: 0, amp: 0,
             instP: [0, 0, 0], totalInstP: 0 },   // per-phase instantaneous power + sum
    sampleBuffer: [],
    theta: 0                         // integrated rotor angle (rad) – no jumps when RPM changes
  };

  const P = runtime.PHYSICS;
  const S = runtime.state;
  const buffer = runtime.sampleBuffer;

  const omega = () => (P.rpm * 2 * Math.PI) / 60;
  const area = () => P.coilWidth * P.coilHeight;
  const freq = () => P.rpm / 60;
  const peakEMF = () => P.turns * area() * P.B * omega();
  const lampR = () => P.R_cold + (P.R_hot - P.R_cold) * Math.min(1, Math.max(0, P.tempNorm));

  function rms(key, value, dt) {
    const k = '_ms' + key;
    S[k] += (value * value - S[k]) * Math.min(1, dt / 0.25);
    return Math.sqrt(Math.max(0, S[k]));
  }

  /* phase angle offsets of channels 1..3 for the current phase configuration */
  function phaseOffsets(mode) {
    if (mode === 2) return [0, Math.PI / 2, 0];
    if (mode >= 3) return [0, -2 * Math.PI / 3, 2 * Math.PI / 3];
    return [0, 0, 0];
  }

  function step(dt) {
    if (!P.running) return;
    const w = omega();
    const th0 = runtime.theta;
    runtime.theta = th0 + w * dt;
    P.simTime += dt;

    // In directConnect mode, the load is removed (open circuit).
    const effectiveSwitch = P.switchOn && !P.directConnect;

    const E0 = peakEMF();
    const Rf = P.directConnect ? 1e9 : lampR();   // effectively infinite R when no bulb
    const eInst = E0 * Math.sin(runtime.theta);
    let iInst = 0, vInst = eInst;
    if (effectiveSwitch) {
      iInst = eInst / (P.R_internal + Rf);
      vInst = eInst - iInst * P.R_internal;
    }
    S.instE = eInst; S.instI = iInst; S.instV = vInst;
    S.E0 = E0;
    S.E = E0 / Math.SQRT2;
    // Exact RMS values for a sinusoidal source feeding a resistive series circuit.
    S.I = effectiveSwitch ? E0 / (Math.SQRT2 * (P.R_internal + Rf)) : 0;
    S.V = effectiveSwitch ? E0 * Rf / (Math.SQRT2 * (P.R_internal + Rf)) : E0 / Math.SQRT2;
    // Incandescent brightness follows average heating power, not the 2f ripple.
    const target = P.directConnect ? 0 : Math.min(1.15, (S.I * S.I * Rf) / P.P_rated);
    P.tempNorm = Math.max(0, P.tempNorm + (target - P.tempNorm) * Math.min(1, dt / (P.thermalTau * 4)));
    S.R_live = P.directConnect ? Infinity : Rf;
    S.P = S.I * S.I * (P.directConnect ? 0 : Rf);

    // terminal-voltage amplitude seen by the CRO probes
    S.amp = effectiveSwitch ? E0 * Rf / (P.R_internal + Rf) : E0;

    // --- Per-phase instantaneous power (key educational value) ---
    const off = phaseOffsets(P.phaseMode);
    let totalP = 0;
    for (let ph = 0; ph < 3; ph += 1) {
      if (ph >= P.phaseMode) { S.instP[ph] = 0; continue; }
      const ePh = E0 * Math.sin(runtime.theta + off[ph]);
      if (effectiveSwitch) {
        const iPh = ePh / (P.R_internal + Rf);
        const vPh = ePh - iPh * P.R_internal;
        S.instP[ph] = iPh * vPh;   // instantaneous power delivered to this lamp
      } else {
        S.instP[ph] = 0;
      }
      totalP += S.instP[ph];
    }
    S.totalInstP = totalP;

    // sub-sample so the scope trace stays smooth at any time/div
    const td = (window.ACGeneratorRuntime.SCOPE && window.ACGeneratorRuntime.SCOPE.timeDiv) || 0.02;
    const subInterval = Math.max(0.0001, Math.min(0.0005, (td * 10) / 600));
    const n = Math.max(1, Math.min(60, Math.round(dt / subInterval)));
    const h = dt / n;
    const tStart = P.simTime - dt;
    for (let k = 1; k <= n; k += 1) {
      const th = th0 + w * h * k;
      buffer.push({
        t: tStart + h * k,
        ch1: S.amp * Math.sin(th + off[0]),
        ch2: P.phaseMode >= 2 ? S.amp * Math.sin(th + off[1]) : 0,
        ch3: P.phaseMode >= 3 ? S.amp * Math.sin(th + off[2]) : 0
      });
    }
    const cutoff = P.simTime - (td * 10 * 3 + 1.0);
    let drop = 0;
    while (drop < buffer.length && buffer[drop].t < cutoff) drop += 1;
    if (drop) buffer.splice(0, drop);
  }

  function setPhaseMode(mode) {
    P.phaseMode = Math.max(1, Math.min(3, Number(mode) || 1));
    if (window.ACGeneratorCRO) window.ACGeneratorCRO.syncChannelState();
    if (window.ACApparatus) window.ACApparatus.applyPhaseMode(P.phaseMode);
  }

  function setDirectConnect(on) {
    P.directConnect = !!on;
    if (on) { P.tempNorm = 0; }   // lamps go cold immediately
    if (window.ACApparatus) window.ACApparatus.applyDirectConnect(P.directConnect);
  }

  function reset() {
    Object.assign(P, DEFAULTS, { simTime: 0, tempNorm: 0, running: true });
    runtime.theta = 0;
    S._msI = 0; S._msV = 0;
    buffer.length = 0;
    setPhaseMode(P.phaseMode);
    if (window.ACGeneratorCRO) {
      window.ACGeneratorCRO.autoScaleScope();
      window.ACGeneratorCRO.resetAcquisition();
    }
  }

  Object.assign(runtime, { step, reset, setPhaseMode, setDirectConnect, omega, area, freq, peakEMF, lampR, phaseOffsets });
})();
