# AC Three-Phase Generator Virtual Lab

An interactive virtual laboratory for studying a three-phase AC generator with star connection and a three-channel oscilloscope.

## Learning objectives

- Relate rotor speed to generated AC frequency.
- Observe phase-separated three-phase waveforms.
- Study star-connected phase and line quantities.
- Explore switching, load, phase, voltage, current, and power relationships.
- Use the oscilloscope to compare simulated generator signals.

## Features

- Interactive generator and three-channel oscilloscope.
- Star-connection wiring and configurable phase relationships.
- Live voltage, current, frequency, and power readouts.
- Guided diagram, formula, calculation, observation, and results sections.
- Responsive interface for desktop, tablet, and mobile screens.
- No build process or application server required.

## Run locally

This is a standalone static website. Serve the folder with any static HTTP server, then open `index.html` in a modern browser.

For example, from this directory:

```text
python -m http.server 8000
```

Open `http://localhost:8000` in the browser. The page loads KaTeX, fonts, and other presentation assets from public CDNs, so an internet connection is required for those external assets.

## Project structure

- `index.html` — application shell and experiment sections.
- `css/` — generator, oscilloscope, layout, navigation, and responsive styles.
- `js/` — generator physics, oscilloscope, wiring, apparatus, navigation, and UI logic.
- `images/` — icons and institutional branding.

## Developer and attribution

- **Developer/maintainer:** SOLVE Virtual Lab team
- **Institution:** National Institute of Technology Karnataka (NITK), Surathkal
- **Project:** SOLVE Virtual Lab
- **Contact:** No individual contact details are defined in this distribution. Please use the official NITK/SOLVE project channel when publishing or adapting this work.

The model is intended for education and demonstration. Simulated values should not be interpreted as measurements from a calibrated generator.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).

