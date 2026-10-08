/* ==========================================================================
   apparatus.js — everything you can see and touch in the simulation scene

   • drag any apparatus (generator, lamps, busbar, oscilloscope) — wires follow
   • the oscilloscope can only be dragged by its body: its buttons, knobs,
     screen and jacks keep working normally
   • pan (drag empty space) and zoom (wheel / pinch) the whole scene
   • rotor spin, lamp filament / glass / halo brightness, phase-mode layout
   ========================================================================== */
(function () {
  'use strict';

  const svg = document.getElementById('simulation-canvas');
  const viewport = document.getElementById('viewport');
  if (!svg || !viewport) return;
  const runtime = window.ACGeneratorRuntime;
  const P = runtime.PHYSICS;

  const view = { x: 0, y: 0, k: 1 };
  const offsets = {};                       // id -> {dx, dy}
  const items = Array.from(svg.querySelectorAll('.apparatus')).map((node) => {
    const [bx, by] = (node.getAttribute('data-base') || '0,0').split(',').map(Number);
    offsets[node.id] = { dx: 0, dy: 0 };
    return { id: node.id, node, bx, by };
  });

  function applyItem(it) {
    const o = offsets[it.id];
    it.node.setAttribute('transform', 'translate(' + (it.bx + o.dx).toFixed(1) + ' ' + (it.by + o.dy).toFixed(1) + ')');
  }
  function applyView() {
    viewport.setAttribute('transform', 'translate(' + view.x.toFixed(1) + ' ' + view.y.toFixed(1) + ') scale(' + view.k.toFixed(4) + ')');
  }

  /* ---------- coordinate helpers ---------- */
  function toScene(clientX, clientY) {         // client px -> un-transformed svg user units
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  /* ---------- pointer handling ---------- */
  const NO_DRAG_ON_CRO = '.btn-hw, button, .knob-3d, .power-switch, .screen-frame, .bnc-jack-3d, input, select, textarea, a, [data-cro], .marker, #flagCh1, #flagCh2, #flagCh3';
  let drag = null;         // {mode:'item'|'pan', ...}
  const pointers = new Map();
  let pinch = null;

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button > 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Background clicks remain inert; two-finger pinch is an intentional zoom.
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
      drag = null;
      return;
    }
    if (pointers.size > 2) return;
    const hit = e.target.closest ? e.target.closest('.apparatus') : null;
    if (hit) {
      if (hit.id === 'cro-group' && e.target.closest(NO_DRAG_ON_CRO)) return;   // let the scope's own controls handle it
      const it = items.find((x) => x.node === hit);
      const p = toScene(e.clientX, e.clientY);
      drag = { mode: 'item', it, sx: p.x, sy: p.y, ox: offsets[it.id].dx, oy: offsets[it.id].dy, id: e.pointerId, moved: false };
      hit.classList.add('is-dragging');
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.mode === 'item') {
      const p = toScene(e.clientX, e.clientY);
      const kk = view.k;
      const o = offsets[drag.it.id];
      o.dx = drag.ox + (p.x - drag.sx) / kk;
      o.dy = drag.oy + (p.y - drag.sy) / kk;
      drag.moved = true;
      applyItem(drag.it);
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) {
      if (drag.mode === 'item') drag.it.node.classList.remove('is-dragging');
      viewport.classList.remove('is-panning');
      drag = null;
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  function zoomAt(cx, cy, k) {
    k = Math.max(0.5, Math.min(2.6, k));
    const p = toScene(cx, cy);
    const wx = (p.x - view.x) / view.k, wy = (p.y - view.y) / view.k;
    view.k = k;
    view.x = p.x - wx * k;
    view.y = p.y - wy * k;
    applyView();
  }
  // Wheel/trackpad scrolling over the scene zooms at the pointer position.
  // A normal click does not invoke this handler.
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });

  function resetLayout() {
    drag = null; pinch = null; pointers.clear();
    items.forEach(it => it.node.classList.remove('is-dragging'));
    items.forEach((it) => { offsets[it.id] = { dx: 0, dy: 0 }; applyItem(it); });
    view.x = 0; view.y = 0; view.k = 1; applyView();
  }

  /* ---------- phase configuration (1, 2 or 3 phase) ---------- */
  const R0 = { x: 200, y: 260, r: 172 };
  const rotOf = { 1: 0, 2: 120, 3: 240 };
  function applyPhaseMode(mode) {
    const rot2 = mode === 2 ? 90 : 120;
    rotOf[2] = rot2;
    svg.querySelectorAll('[data-phase]').forEach((n) => {
      const ph = Number(n.getAttribute('data-phase'));
      if (ph) n.style.display = ph > mode ? 'none' : '';
    });
    svg.querySelectorAll('#motor [data-rot]').forEach((n) => {
      const ph = Number(n.getAttribute('data-rot'));
      if (ph === 2) n.setAttribute('transform', 'rotate(' + rot2 + ' 200 260)');
    });
    // A phase is a pair of opposing stator poles. Keep only active pairs visible
    // and align their physical axes with their electrical phase separation.
    svg.querySelectorAll('#motor [data-stator-phase]').forEach((n) => {
      const ph = Number(n.getAttribute('data-stator-phase'));
      const side = Number(n.getAttribute('data-stator-side'));
      const axis = ph === 2 ? rot2 : rotOf[ph];
      n.setAttribute('transform', 'rotate(' + (axis + side) + ' 300 260)');
    });
    // The phase-2 terminal pair is part of the winding assembly.  Rotate it
    // to the true 90-degree axis in two-phase mode so wire anchors follow it.
    const phase2Terminals = svg.querySelector('#motor .ph-terminals[data-phase="2"]');
    if (phase2Terminals) phase2Terminals.setAttribute('transform', mode === 2 ? 'rotate(30 200 260)' : '');
    [2, 3].forEach((i) => { const l = document.getElementById('lamp' + i); if (l) l.style.display = i > mode ? 'none' : ''; });
    ['bus-2', 'bus-3'].forEach((id, k) => { const b = document.getElementById(id); if (b) b.style.display = (k + 2) > mode ? 'none' : ''; });
    const bypass = document.getElementById('left-bypass-route');
    if (bypass) bypass.style.display = mode < 3 ? 'none' : '';
  }

  function placeStudLabels() {
    // Labels are now integrated directly inside the circular terminal badges
  }

  /* ---------- per-frame visuals ---------- */
  const rotorUse = document.getElementById('rotorUse');
  const lamps = [1, 2, 3].map((i) => {
    const g = document.getElementById('lamp' + i);
    return g && {
      g,
      halo: g.querySelector('.lamp-halo'), glow: g.querySelector('.lamp-glow'),
      fil: g.querySelector('.lamp-fil'), filGlow: g.querySelector('.lamp-fil-glow')
    };
  }).filter(Boolean);

  const mix = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')';
  };

  function paint() {
    const th = (runtime.theta * 180) / Math.PI;
    if (rotorUse) rotorUse.setAttribute('transform', 'translate(200 260) rotate(' + (-30 + th).toFixed(2) + ') scale(52)');
    const meanHeat = P.switchOn ? Math.max(0, Math.min(1, P.tempNorm)) : 0;
    const electricalHz = P.rpm / 60;
    const thermalGain = 1 / Math.sqrt(1 + Math.pow(4 * Math.PI * electricalHz * P.thermalTau, 2));
    const offsets = runtime.phaseOffsets ? runtime.phaseOffsets(P.phaseMode) : [0, 0, 0];
    lamps.forEach((l, index) => {
      // Lamp power is sin²(theta). A filament thermally filters that 2f ripple:
      // obvious at slow RPM, almost steady at normal operating speed.
      const ripple = 1 - 0.72 * thermalGain * Math.cos(2 * (runtime.theta + (offsets[index] || 0)));
      const t = Math.max(0, Math.min(1, meanHeat * ripple));
      const tt = Math.pow(t, 0.8);
      l.halo.setAttribute('opacity', (tt * 0.95).toFixed(3));
      l.glow.setAttribute('opacity', Math.min(1, tt * 1.15).toFixed(3));
      l.fil.setAttribute('stroke', tt < 0.5 ? mix('#4a2a1a', '#f59e0b', tt * 2) : mix('#f59e0b', '#ffffff', (tt - 0.5) * 2));
      l.fil.setAttribute('stroke-width', (1.8 + tt * 1.4).toFixed(2));
      l.filGlow.setAttribute('opacity', (tt * 0.9).toFixed(3));
    });
  }

  /* ---------- direct-connect mode: hide lamps, wire straight through ---------- */
  function applyDirectConnect(on) {
    [1, 2, 3].forEach((i) => {
      const l = document.getElementById('lamp' + i);
      // Retain each lamp's terminal geometry so the direct link follows the
      // same physical route, while hiding only the visual lamp assembly.
      if (l) l.style.visibility = on ? 'hidden' : '';
    });
    svg.dataset.directConnect = on ? '1' : '';
  }

  window.ACApparatus = { applyPhaseMode, applyDirectConnect, paint, resetLayout, placeStudLabels };
})();
