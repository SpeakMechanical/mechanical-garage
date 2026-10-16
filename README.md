# Mechanical Garage

The Mechanical Garage website: MechMate engineering calculators, machine element selection
guides, machine design course notes, and personal projects. Plain HTML, CSS and JavaScript
with no build step; everything runs in the browser.

The CAD and simulation software (Planform 2D, Planform 3D and the solver) lives in its own
project, `Planform CAD`.

## Layout

| Folder | What it is |
|---|---|
| `index.html` | Home page |
| `mechmate/` | MechMate calculator app. `mechmate-tools.js` holds every formula (no DOM, so Node can test it), `mechmate.js` is the app, `sw.js` makes it work offline, and the manifest and icons make it installable. |
| `garage/` | Selection guides (`index.html`: ball screws, bolts, bearings, fits and GD&T) and the Machine Design course (`machine-design.html`) |
| `personal/` | Personal projects |
| `shared/` | `site.css` (design and light/dark theme) and `site.js` (theme toggle and calculator helpers) used by every page |

## Run it locally

Any static file server works. From this folder:

```
python -m http.server 8080
```

Then open http://localhost:8080/. Opening the files directly also works, except for MechMate's
offline mode, which needs a server.

## Tests

The MechMate formulas are checked against hand calculations, published table values
(VDI 2230 bolt tables) and cross-checks between formulas. Needs Node.js 20+:

```
npm test
```

## Publishing

Every push to `main` runs `.github/workflows/site.yml`: it runs the MechMate tests, then
publishes the site folders to GitHub Pages. The test file and this README are not published.
