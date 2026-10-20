// Builds app-www/ for the Android app (Capacitor). The app's home is its own interface
// (app/shell.html → index.html, with app/app.js and app/app.css) built on the MechMate formulas;
// the viewer, guides and course pages come from the website and get an app bar (app/embed.*).
// Every library and font the website loads from a CDN is copied in, so the app works offline;
// links to folders point at index.html; pages can sit under the status bar (viewport-fit=cover).
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "app-www");
const nm = path.join(root, "node_modules");
const SITE = ["shared", "mechmate", "viewer", "garage", "personal"];
const SKIP = new Set([path.join("mechmate", "mechmate.test.js")]);
const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/";
const OCCT_CDN = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/";
const DXF_CDN = "https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.js";
// three.js add-ons the viewer imports; their own imports are followed automatically.
const THREE_ENTRY = ["controls/OrbitControls.js", ...["STL", "PLY", "VTK", "OBJ", "3MF", "AMF", "TDS", "FBX", "Collada", "VRML", "GLTF"].map(n => `loaders/${n}Loader.js`)];

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(from, to); };

/* ---------- site files ---------- */
function copyTree(rel) {
  const src = path.join(root, rel), st = fs.statSync(src);
  if (st.isDirectory()) { for (const f of fs.readdirSync(src)) copyTree(path.join(rel, f)); return; }
  if (!SKIP.has(rel)) copy(src, path.join(out, rel));
}
SITE.forEach(copyTree);
copy(path.join(root, "app/shell.html"), path.join(out, "index.html"));
for (const f of ["app.css", "app.js", "cars.js", "embed.css", "embed.js"]) copy(path.join(root, "app", f), path.join(out, "app", f));

/* ---------- vendored libraries ---------- */
const vendor = path.join(out, "vendor");
copy(path.join(nm, "three/build/three.module.js"), path.join(vendor, "three/build/three.module.js"));
const jsm = path.join(nm, "three/examples/jsm");
const seen = new Set();
(function follow(list) {
  for (const rel of list) {
    const norm = path.normalize(rel);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const file = path.join(jsm, norm);
    copy(file, path.join(vendor, "three/examples/jsm", norm));
    const src = fs.readFileSync(file, "utf8");
    const deps = [...src.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => path.join(path.dirname(norm), m[1]));
    follow(deps);
  }
})(THREE_ENTRY);
for (const f of ["occt-import-js.js", "occt-import-js.wasm"]) copy(path.join(nm, "occt-import-js/dist", f), path.join(vendor, "occt", f));
copy(path.join(nm, "dxf-parser/dist/dxf-parser.js"), path.join(vendor, "dxf-parser.js"));
// PDF reports in the app: jsPDF, and DejaVu Sans for ₹, ★, Δ, √ and subscripts.
copy(path.join(nm, "jspdf/dist/jspdf.umd.min.js"), path.join(vendor, "jspdf.umd.min.js"));
for (const f of ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"]) copy(path.join(nm, "dejavu-fonts-ttf/ttf", f), path.join(vendor, "fonts", f));

/* ---------- fonts ---------- */
const FONTS = [
  ["IBM Plex Sans", "ibm-plex-sans", [[400, "normal"], [500, "normal"], [600, "normal"]]],
  ["IBM Plex Mono", "ibm-plex-mono", [[400, "normal"], [500, "normal"]]],
  ["Instrument Serif", "instrument-serif", [[400, "normal"], [400, "italic"]]]
];
let css = "/* Local copies of the website's Google Fonts, so the app works offline. */\n";
for (const [family, pkg, faces] of FONTS) for (const [w, s] of faces) {
  const file = `${pkg}-latin-${w}-${s}.woff2`;
  copy(path.join(nm, "@fontsource", pkg, "files", file), path.join(vendor, "fonts", file));
  css += `@font-face{font-family:"${family}";font-style:${s};font-weight:${w};font-display:swap;src:url(${file}) format("woff2")}\n`;
}
fs.writeFileSync(path.join(vendor, "fonts/fonts.css"), css);

/* ---------- rewrite pages for the app ---------- */
function rewriteHtml(file) {
  const rel = path.relative(out, file), up = "../".repeat(rel.split(path.sep).length - 1);
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/<link rel="preconnect"[^>]*>\n?/g, "")
       .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/g, `<link rel="stylesheet" href="${up}vendor/fonts/fonts.css">`)
       .replaceAll(THREE_CDN, `${up}vendor/three/`)
       .replaceAll(DXF_CDN, `${up}vendor/dxf-parser.js`)
       .replace('content="width=device-width, initial-scale=1"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"')
       // The app's file server does not map folders to index.html, so "garage/" becomes "garage/index.html".
       .replace(/href="([^":#]*)(#[^"]*)?"/g, (m, p, h = "") => {
         if (!p.endsWith("/")) return m;
         return `href="${(p + "index.html").replace(/^\.\/index\.html$/, "index.html")}${h}"`;
       });
  // Website pages get the app bar and back-button handling.
  if (up) s = s.replace(`<script src="${up}shared/site.js"></script>`, `<script src="${up}shared/site.js"></script>
<link rel="stylesheet" href="${up}app/embed.css">
<script src="${up}app/embed.js"></script>`);
  // Android's file picker filters by MIME type and does not know .step or .stl; allow any file.
  if (rel === path.join("viewer", "index.html")) s = s.replace(/ accept="[^"]*"/, "");
  fs.writeFileSync(file, s);
}
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (p !== vendor && p !== path.join(out, "app")) walk(p); }
    else if (f.endsWith(".html")) rewriteHtml(p);
  }
})(out);
const worker = path.join(out, "viewer/occt-worker.js");
fs.writeFileSync(worker, fs.readFileSync(worker, "utf8").replace(OCCT_CDN, "../vendor/occt/"));

/* ---------- check nothing still points at a CDN ---------- */
const left = [];
(function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (p !== vendor) scan(p); }
    else if (/\.(html|js|css)$/.test(f) && /https:\/\/(cdn\.jsdelivr\.net|fonts\.g)/.test(fs.readFileSync(p, "utf8"))) left.push(path.relative(out, p));
  }
})(out);
if (left.length) { console.error("Still loading from the internet:", left.join(", ")); process.exit(1); }
const size = (function du(d) { return fs.readdirSync(d).reduce((n, f) => { const p = path.join(d, f), st = fs.statSync(p); return n + (st.isDirectory() ? du(p) : st.size); }, 0); })(out);
console.log(`app-www built: ${seen.size} three.js add-on files, ${(size / 1048576).toFixed(1)} MB`);
