/* ==========================================================================
   app.js — navigation between sections + the main animation loop
   ========================================================================== */
(function () {
  'use strict';
  const runtime = window.ACGeneratorRuntime;
  const $ = (id) => document.getElementById(id);

  const SECTIONS = [
    { id: 'diagram', title: 'Diagram', icon: 'images/diagram.svg' },
    { id: 'formula', title: 'Formula', icon: 'images/formula.svg' },
    { id: 'simulation', title: 'Simulation', icon: 'images/simulation.svg' },
    { id: 'observation', title: 'Observation', icon: 'images/observation.svg' },
    { id: 'graphs', title: 'Live Graph', icon: 'images/graphbutton.svg' },
    { id: 'calculation', title: 'Calculation', icon: 'images/calculation.svg' },
    { id: 'results', title: 'Results', icon: 'images/results.svg' }
  ];
  const card = $('workspaceCard');
  let current = 'simulation';

  /* side navigation */
  $('navMenu').innerHTML = SECTIONS.map((s) =>
    '<li class="tool-list"><button type="button" class="nav-btn" data-section="' + s.id + '" aria-label="' + s.title + '" style="--icon:url(' + new URL(s.icon, document.baseURI).href + ')"></button><span>' + s.title + '</span></li>').join('');
  $('navMenu').addEventListener('click', (e) => { const li = e.target.closest('.tool-list'); if (li) open(li.querySelector('.nav-btn').dataset.section); });

  function open(id) {
    if (!SECTIONS.some(section => section.id === id)) return;
    if (current === 'simulation' && id !== current) window.ACApparatus.resetLayout();
    current = id;
    document.body.classList.remove('dashboard-active');
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.panel !== id; });
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.section === id));
    const sec = SECTIONS.find((s) => s.id === id);
    $('workspaceTitle').textContent = sec.title;
    card.dataset.section = id;
    const interactive = id === 'simulation' || id === 'graphs';
    card.dataset.interactive = String(interactive);
    card.dataset.side = 'on';
    document.getElementById('workspaceViewport').classList.toggle('diagram-viewport', id === 'diagram');
    document.documentElement.classList.toggle('diagram-open', false);
    window.ACPanels.onShow(id);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.ACWiring && window.ACWiring.update());
  }
  function toDashboard() {
    if (current === 'simulation') window.ACApparatus.resetLayout();
    document.body.classList.add('dashboard-active');
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('is-active'));
  }
  $('dashboardCloseBtn').addEventListener('click', toDashboard);
  $('fullscreenButton').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
  });
  $('viewportFullscreenButton').addEventListener('click', () => {
    const w = $('simulationWindow');
    if (!document.fullscreenElement) w.requestFullscreen?.(); else document.exitFullscreen?.();
  });
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(() => window.ACWiring.update()));

  window.ACDashboard.build(SECTIONS, open);

  /* initial state */
  runtime.setPhaseMode(runtime.PHYSICS.phaseMode);
  window.ACGeneratorCRO.autoScaleScope();
  window.ACPanels.onShow('simulation');
  function afterReset() { window.ACControls.refreshAll(); window.ACControls.setStatus(); window.ACApparatus.resetLayout(); }
  window.ACApp = { open, afterReset, get current() { return current; } };
  const params = new URLSearchParams(location.search);
  if (params.get('section')) open(params.get('section'));

  /* main loop */
  let last = performance.now(), cro = 0, wiring = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    runtime.step(dt);
    if (!document.hidden && current === 'simulation' && !document.body.classList.contains('dashboard-active')) window.ACApparatus.paint();
    const C = window.ACGeneratorCRO;
    if (current === 'simulation' && !document.body.classList.contains('dashboard-active')) {
      if (!C.SCOPE.running) { /* frozen display */ } else { C.updateSweepAnchor(); C.checkSingleShotStop(); }
      C.redrawTraces();
      if (now - cro > 120) { cro = now; C.updateTextReadouts(); }
      if (now - wiring >= 33) { wiring = now; window.ACWiring.update(); }
    }
    window.ACPanels.tick(now);
    window.ACDashboard.tick(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
