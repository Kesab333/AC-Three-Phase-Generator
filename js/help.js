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
