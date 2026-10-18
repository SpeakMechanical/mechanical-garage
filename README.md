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
| `viewer/` | CAD Viewer. `viewer.js` opens mesh formats with three.js loaders and draws DXF; `occt-worker.js` reads STEP, IGES and BREP with OpenCascade (occt-import-js) in a Web Worker. `samples/bracket.step` is the "Try a sample" file. Libraries load from the jsDelivr CDN. |
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

## Android app

An Android app built with [Capacitor](https://capacitorjs.com). App id
`com.speakmechanical.mechanicalgarage`, name "Mechanical Garage".

The app has its own phone interface in `app/` rather than the website's pages: a bottom tab bar
(Home, Tools, Viewer, Learn, Workshop); full-screen tool pages with a large animated result,
tap-and-hold steppers, swipe between tools of a category, and live visuals (a beam that bends,
gears and pulleys spinning at their speed ratio, an AC tonnage gauge with running-cost bars, a bolt
load bar); favourites, automatic history, named saves and a shareable report, all kept on the phone;
vibration feedback, the Android back key and status-bar colours through Capacitor plugins. The
formulas are the same tested `mechmate/mechmate-tools.js`. The CAD Viewer, guides and Machine Design
pages are the website's, shown with an app bar (`app/embed.css`, `app/embed.js`).

| Piece | What it does |
|---|---|
| `app/` | The app interface: `shell.html` (becomes `index.html`), `app.js`, `app.css`, and `embed.*` for website pages shown inside the app. |
| `scripts/build-app.mjs` | Builds `app-www/`: the app interface plus the site's pages, with every CDN library (three.js, OpenCascade, the DXF reader) and font copied in from `node_modules`, so the app works with no internet. Folder links become `…/index.html`, and the CAD Viewer's file picker accepts any file (Android can't filter by `.step`). |
| `capacitor.config.json` | Points Capacitor at `app-www/`. |
| `android/` | The Android Studio project. Icons and splash screens come from `scripts/android_icons.py`. |
| `.github/workflows/android.yml` | Builds the app on GitHub, so no Android Studio is needed here. |

Inside the app, saving a CAD Viewer screenshot or a MechMate report opens the Android share sheet
(`saveFile` in `shared/site.js`), because app web views can't download or print. The report is
shared as a page you can print to PDF from Chrome.

### Getting the app

Every push to `main` builds a debug APK. Open the **android** run under the repo's Actions tab,
download **mechanical-garage-android**, unzip it, and install the `.apk` on a phone (allow
"Install unknown apps" for your browser or Files app when asked). Tagging a version
(`git tag v1.0.0 && git push origin v1.0.0`) also attaches the files to a GitHub release.

### Publishing on Google Play

1. Make an upload key once, and keep the file and passwords safe: Google Play needs the same key
   for every update. With a JDK installed:
   ```
   keytool -genkeypair -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Add these repository secrets (Settings > Secrets and variables > Actions):
   `ANDROID_KEYSTORE_BASE64` (the file, base64-encoded), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`upload`) and `ANDROID_KEY_PASSWORD`.
3. The next build also produces a signed `.aab`. Upload it in the Google Play Console. Each build
   uses the workflow run number as its version code, so every upload is higher than the last.

### Building on your own computer

Needs Node.js 22+, JDK 21 and Android Studio (Android SDK 36):
```
npm ci
npm run sync:android
npx cap open android
```
