/* ==========================================================================
   wiring.js — leads between real terminals
   Schematic layout:
   - Motor (stator) terminals: Top 1, UR 2, LR 3 (Live) & Bot 1, LL 2, UL 3 (Neutral)
   - 3 Lamps staggered diagonally between motor and CRO
   - CRO terminals: 1, 2, 3, G along bottom of oscilloscope
   - Common Ground box at bottom right: 1, 2, 3 on left, G on right
   - Left bypass route for Motor 3 Neutral
   - Vertical ground drop from CRO G to Common Ground G
   ========================================================================== */
(function () {
  'use strict';

  const svg = document.getElementById('simulation-canvas');
  const layer = document.getElementById('wires');
  const plugLayer = document.getElementById('wire-plugs');
  if (!svg || !layer || !plugLayer) return;
  const NS = 'http://www.w3.org/2000/svg';

  const PHASE = { 1: '#ea580c', 2: '#0284c7', 3: '#9333ea' };
  const EARTH = '#16a34a';
  const RADIUS = 9;

  /* ---- routes: (a = start terminal, b = end terminal) -> list of corner points ---- */
  const routes = {
    // Motor Top 1 -> Lamp 1 Left: goes up out of terminal 1, turns right, drops to lamp level
    motorToLamp1: (a, b) => {
      const topY = a.y - 30;
      const midX = b.x - 42;
      return [
        a,
        { x: a.x, y: topY },
        { x: midX, y: topY },
        { x: midX, y: b.y },
        b
      ];
    },

    // Motor Upper-Right 2 -> Lamp 2 Left: goes right, drops to lamp 2 level, enters left
    motorToLamp2: (a, b) => {
      const midX = b.x - 42;
      return [
        a,
        { x: midX, y: a.y },
        { x: midX, y: b.y },
        b
      ];
    },

    // Motor Lower-Right 3 -> Lamp 3 Left: goes right, steps to lamp 3 level, enters left
    motorToLamp3: (a, b) => {
      const midX = b.x - 42;
      return [
        a,
        { x: midX, y: a.y },
        { x: midX, y: b.y },
        b
      ];
    },

    // Lamp Right contact -> CRO CH pin: runs right horizontally past bulb, turns 90° UP into CRO jack!
    lampToCro: (a, b) => {
      const laneX = Math.max(a.x + 38, b.x - 18);
      return [
        a,
        { x: laneX, y: a.y },
        { x: laneX, y: b.y },
        b
      ];
    },

    // Direct connect mode: Motor live stud directly to CRO jack
    motorToCroDirect: (a, b) => {
      const midY = (a.y + b.y) / 2;
      return [
        a,
        { x: a.x + 35, y: a.y },
        { x: a.x + 35, y: midY },
        { x: b.x, y: midY },
        b
      ];
    },

    // Motor Bottom 1 -> Common Ground 1: down slightly, turns right into terminal 1
    motorToCommonGround1: (a, b) => {
      return [
        a,
        { x: a.x, y: b.y - 34 },
        { x: b.x - 30, y: b.y - 34 },
        { x: b.x - 30, y: b.y },
        b
      ];
    },

    // Motor Lower-Left 2 -> Common Ground 2: down-left clear of stator, down to level, right into terminal 2
    motorToCommonGround2: (a, b) => {
      const laneX = 68;
      return [
        a,
        { x: laneX, y: a.y + 16 },
        { x: laneX, y: b.y - 20 },
        { x: b.x - 30, y: b.y - 20 },
        { x: b.x - 30, y: b.y },
        b
      ];
    },

    // Motor Upper-Left 3 -> Common Ground 3 (Left Bypass Route):
    // left to junction dot at x=18, straight down left edge to x=18, y=b.y, right into terminal 3
    motorToCommonGround3: (a, b) => {
      const dotX = 8;
      // also synchronize the visual junction dots
      const dTop = document.getElementById('bypass-dot-top');
      const dBot = document.getElementById('bypass-dot-bot');
      if (dTop) { dTop.setAttribute('cx', dotX); dTop.setAttribute('cy', a.y.toFixed(1)); }
      if (dBot) { dBot.setAttribute('cx', dotX); dBot.setAttribute('cy', b.y.toFixed(1)); }
      return [
        a,
        { x: dotX, y: a.y },
        { x: dotX, y: b.y + 20 },
        { x: b.x - 30, y: b.y + 20 },
        { x: b.x - 30, y: b.y },
        b
      ];
    },

    // CRO GND -> Common Ground G: straight vertical wire dropping down
    verticalDrop: (a, b) => {
      return [
        a,
        { x: b.x, y: a.y },
        b
      ];
    }
  };

  const WIRES = [
    // Phase 1: Motor Top 1 -> Lamp 1 Left -> Lamp 1 Right -> CRO CH1
    { id: 'live1a', from: 'stud-p1-live', to: 'lamp1-L', color: PHASE[1], width: 4.2, phase: 1, route: routes.motorToLamp1, plug: 'banana', hideInDirect: true },
    { id: 'live1b', from: 'lamp1-R', to: 'anchor-ch1', color: PHASE[1], width: 4.2, phase: 1, route: routes.lampToCro, plug: 'banana', hideInDirect: true },

    // Phase 2: Motor Upper-Right 2 -> Lamp 2 Left -> Lamp 2 Right -> CRO CH2
    { id: 'live2a', from: 'stud-p2-live', to: 'lamp2-L', color: PHASE[2], width: 4.2, phase: 2, route: routes.motorToLamp2, plug: 'banana', hideInDirect: true },
    { id: 'live2b', from: 'lamp2-R', to: 'anchor-ch2', color: PHASE[2], width: 4.2, phase: 2, route: routes.lampToCro, plug: 'banana', hideInDirect: true },

    // Phase 3: Motor Lower-Right 3 -> Lamp 3 Left -> Lamp 3 Right -> CRO CH3
    { id: 'live3a', from: 'stud-p3-live', to: 'lamp3-L', color: PHASE[3], width: 4.2, phase: 3, route: routes.motorToLamp3, plug: 'banana', hideInDirect: true },
    { id: 'live3b', from: 'lamp3-R', to: 'anchor-ch3', color: PHASE[3], width: 4.2, phase: 3, route: routes.lampToCro, plug: 'banana', hideInDirect: true },

    // Neutral 1: Motor Bottom 1 -> Common Ground 1
    { id: 'neu1', from: 'stud-p1-neu', to: 'bus-1', color: PHASE[1], width: 3.6, phase: 1, route: routes.motorToCommonGround1, plug: 'banana' },

    // Neutral 2: Motor Lower-Left 2 -> Common Ground 2
    { id: 'neu2', from: 'stud-p2-neu', to: 'bus-2', color: PHASE[2], width: 3.6, phase: 2, route: routes.motorToCommonGround2, plug: 'banana' },

    // Neutral 3: Motor Upper-Left 3 -> Common Ground 3 (via left bypass)
    { id: 'neu3', from: 'stud-p3-neu', to: 'bus-3', color: PHASE[3], width: 3.6, phase: 3, route: routes.motorToCommonGround3, plug: 'banana' },

    // Ground: CRO GND -> Common Ground G (vertical drop)
    { id: 'ground', from: 'anchor-gnd', to: 'bus-g', color: EARTH, width: 3.4, phase: 1, route: routes.verticalDrop, plug: 'bnc' },

    // Direct mode retains each load's cable route as one uninterrupted conductor.
    { id: 'direct1', from: 'stud-p1-live', to: 'anchor-ch1', color: PHASE[1], width: 4.2, phase: 1, plug: 'banana', directOnly: true, directRoute: 1 },
    { id: 'direct2', from: 'stud-p2-live', to: 'anchor-ch2', color: PHASE[2], width: 4.2, phase: 2, plug: 'banana', directOnly: true, directRoute: 2 },
    { id: 'direct3', from: 'stud-p3-live', to: 'anchor-ch3', color: PHASE[3], width: 4.2, phase: 3, plug: 'banana', directOnly: true, directRoute: 3 }
  ];

  /* ---- build DOM once ---- */
  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (parent) parent.appendChild(node);
    return node;
  }
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
    return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function buildPlug(parent, kind, color) {
    const g = el('g', { class: 'wire-plug' }, parent);
    if (kind === 'bnc') {
      el('rect', { x: 0, y: -7, width: 22, height: 14, rx: 3, fill: '#1f2937', stroke: '#0b1220', 'stroke-width': 1 }, g);
      el('rect', { x: 0, y: -7, width: 5, height: 14, rx: 2, fill: color, stroke: '#0b1220', 'stroke-width': 0.8 }, g);
      el('path', { d: 'M9,-7 V7 M13,-7 V7 M17,-7 V7', stroke: '#475569', 'stroke-width': 1 }, g);
    } else {
      el('rect', { x: 0, y: -4.5, width: 15, height: 9, rx: 2.4, fill: shade(color, -0.35), stroke: '#0b1220', 'stroke-width': 1 }, g);
      el('rect', { x: 0, y: -4.5, width: 4, height: 9, rx: 1.5, fill: '#cbd5e1', stroke: '#0b1220', 'stroke-width': 0.8 }, g);
    }
    return g;
  }
  WIRES.forEach((w) => {
    w.g = el('g', { 'data-wire': w.id }, layer);
    w.halo = el('path', { class: 'wire-halo', 'stroke-width': w.width + 3.2 }, w.g);
    w.body = el('path', { class: 'wire-body', stroke: w.color, 'stroke-width': w.width }, w.g);
    w.sheen = el('path', { class: 'wire-sheen', 'stroke-width': Math.max(1, w.width * 0.28) }, w.g);
    w.plugA = buildPlug(plugLayer, w.plug, w.color);
    w.plugB = buildPlug(plugLayer, w.id === 'ground' ? 'banana' : 'banana', w.color);
  });

  /* ---- geometry helpers ---- */
  function clean(pts) {
    const out = [];
    pts.forEach((p) => {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) return;
      out.push(p);
    });
    for (let i = out.length - 2; i > 0; i -= 1) { // drop collinear middle points
      const a = out[i - 1], b = out[i], c = out[i + 1];
      if ((Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01)) out.splice(i, 1);
    }
    return out;
  }
  function rounded(pts, r) {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y), l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const a = { x: p1.x - ((p1.x - p0.x) / l1) * rr, y: p1.y - ((p1.y - p0.y) / l1) * rr };
      const b = { x: p1.x + ((p2.x - p1.x) / l2) * rr, y: p1.y + ((p2.y - p1.y) / l2) * rr };
      d += ' L' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }
    const e = pts[pts.length - 1];
    return d + ' L' + e.x.toFixed(1) + ' ' + e.y.toFixed(1);
  }
  function place(plug, p, toward) {
    const ang = (Math.atan2(toward.y - p.y, toward.x - p.x) * 180) / Math.PI;
    plug.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
  }

  /* ---- terminal lookup (in coordinate system of #wires layer) ---- */
  const anchorCache = {};
  function terminal(id, inv) {
    const node = anchorCache[id] || (anchorCache[id] = document.getElementById(id));
    if (!node) return null;
    const r = node.getBoundingClientRect();
    if (!r.width && !r.height) return null; // hidden (display:none) terminal
    const pt = svg.createSVGPoint();
    pt.x = r.left + r.width / 2;
    pt.y = r.top + r.height / 2;
    const q = pt.matrixTransform(inv);
    return { x: q.x, y: q.y };
  }

  function update() {
    const ctm = layer.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const mode = (window.ACGeneratorRuntime && window.ACGeneratorRuntime.PHYSICS.phaseMode) || 3;
    const dc = !!(window.ACGeneratorRuntime && window.ACGeneratorRuntime.PHYSICS.directConnect);

    WIRES.forEach((w) => {
      let fromId = w.from, toId = w.to;
      let routeFn = w.route;

      if ((w.directOnly && !dc) || (w.hideInDirect && dc)) {
        w.g.style.display = 'none';
        w.plugA.style.display = 'none';
        w.plugB.style.display = 'none';
        return;
      }

      const a = w.phase <= mode ? terminal(fromId, inv) : null;
      const b = w.phase <= mode ? terminal(toId, inv) : null;
      if (!a || !b) {
        w.g.style.display = 'none';
        w.plugA.style.display = 'none';
        w.plugB.style.display = 'none';
        return;
      }
      w.g.style.display = '';
      w.plugA.style.display = (w.hidePlugA || (dc && w.hidePlugAInDirect)) ? 'none' : '';
      w.plugB.style.display = (w.hidePlugB || (dc && w.hidePlugBInDirect)) ? 'none' : '';
      let pts;
      if (w.directRoute) {
        const lampLeft = terminal('lamp' + w.directRoute + '-L', inv);
        const lampRight = terminal('lamp' + w.directRoute + '-R', inv);
        if (!lampLeft || !lampRight) {
          w.g.style.display = 'none';
          w.plugA.style.display = 'none';
          w.plugB.style.display = 'none';
          return;
        }
        const intoLoad = routes['motorToLamp' + w.directRoute](a, lampLeft);
        const outOfLoad = routes.lampToCro(lampRight, b);
        pts = clean(intoLoad.slice(0, -1).concat([lampLeft, lampRight], outOfLoad.slice(1)));
      } else {
        pts = clean(routeFn(a, b));
      }
      const d = rounded(pts, RADIUS);
      w.halo.setAttribute('d', d);
      w.body.setAttribute('d', d);
      w.sheen.setAttribute('d', d);
      place(w.plugA, pts[0], pts[1]);
      place(w.plugB, pts[pts.length - 1], pts[pts.length - 2]);
    });
  }

  window.ACWiring = { update, WIRES };
})();
