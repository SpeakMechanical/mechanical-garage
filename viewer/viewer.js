// CAD Viewer: opens CAD and mesh files in the browser with three.js. STEP, IGES and BREP are
// triangulated by OpenCascade (occt-import-js) in a worker; DXF is drawn as 2D curves.
// Nothing is uploaded: files are read with the File API and stay on this computer.
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

const ADDONS = "three/addons/loaders/";
const NATIVE = {
  sldprt: "SolidWorks", sldasm: "SolidWorks", slddrw: "SolidWorks", ipt: "Inventor", iam: "Inventor", idw: "Inventor",
  catpart: "CATIA", catproduct: "CATIA", prt: "Creo or NX", asm: "Creo", f3d: "Fusion 360", f3z: "Fusion 360",
  par: "Solid Edge", psm: "Solid Edge", x_t: "Parasolid", x_b: "Parasolid", "3dm": "Rhino", skp: "SketchUp", dwg: "AutoCAD"
};
const EXPORT_HINT = {dwg: "DXF", slddrw: "DXF", idw: "DXF"};
// Formats whose files are normally modelled Y-up, and the unit a unitless file usually means.
const Y_UP = new Set(["obj", "gltf", "glb", "fbx", "dae", "3ds", "wrl", "vtk"]);
const DEFAULT_UNIT = {gltf: 1000, glb: 1000, fbx: 10, dae: 1000};

/* ============================================================ scene */
const stageEl = $("stage");
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
stageEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1e6);
camera.up.set(0, 0, 1);
camera.position.set(200, -200, 160);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a3, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(1, 0.6, 1.5);
camera.add(key);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.screenSpacePanning = true;

let wrapper = null, grid = null, model = null;           // wrapper: units + up axis; model: loaded content
const state = {name: "", ext: "", size: 0, kind: "3d", meshes: [], edges: [], box: null, triangles: 0};
const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
let clipOn = false;

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888"; }
function themeColors() {
  const ink = new THREE.Color(css("--ink")), grid1 = new THREE.Color(css("--rule-strong")), grid2 = new THREE.Color(css("--rule"));
  return {ink, grid1, grid2, accent: new THREE.Color(css("--accent"))};
}
function refreshTheme() {
  const c = themeColors();
  state.edges.forEach(e => e.material.color.copy(state.kind === "2d" ? c.accent : c.ink));
  if (grid) placeGrid();
  markers.forEach(m => m.material.color.copy(c.accent));
  if (mLine) mLine.material.color.copy(c.accent);
}
new MutationObserver(refreshTheme).observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshTheme);

function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stageEl);
resize();

function frame() {
  controls.update();
  renderer.render(scene, camera);
  placeLabel();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ============================================================ status */
function status(msg, err = false) {
  const el = $("status");
  el.hidden = !msg; el.textContent = msg || ""; el.classList.toggle("err", err);
}

/* ============================================================ loading */
$("file").addEventListener("change", e => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ""; });
["open-btn", "open-btn-2"].forEach(id => $(id).onclick = () => $("file").click());
["sample-btn", "sample-btn-2"].forEach(id => $(id).onclick = async () => {
  status("Loading the sample bracket…");
  const blob = await (await fetch("samples/bracket.step")).blob();
  openFile(new File([blob], "bracket.step"));
});
const vstage = $("vstage");
["dragenter", "dragover"].forEach(t => vstage.addEventListener(t, e => { e.preventDefault(); vstage.classList.add("dragging"); }));
["dragleave", "drop"].forEach(t => vstage.addEventListener(t, e => { e.preventDefault(); if (t === "drop" || e.target === vstage) vstage.classList.remove("dragging"); }));
vstage.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) openFile(f); });

const extOf = name => { const m = name.toLowerCase().match(/\.([a-z0-9_]+)$/); return m ? m[1] : ""; };
async function openFile(file) {
  const ext = extOf(file.name);
  if (NATIVE[ext]) {
    status(`.${ext} is a native ${NATIVE[ext]} file, which only ${NATIVE[ext]} can read. Export it as ${EXPORT_HINT[ext] || "STEP (or STL)"} and open that.`, true);
    return;
  }
  status(`Reading ${file.name}…`);
  const t0 = performance.now();
  try {
    const obj = await load(file, ext);
    if (!obj) return;
    show(obj, file, ext);
    status(`Opened ${file.name} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    setTimeout(() => status(""), 4000);
  } catch (err) {
    console.error(err);
    status(`Could not open ${file.name}: ${err.message || err}`, true);
  }
}

const standard = () => new THREE.MeshStandardMaterial({color: 0xb9c2cc, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide});
function meshFrom(geometry) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const m = standard();
  if (geometry.attributes.color) m.vertexColors = true;
  return new THREE.Mesh(geometry, m);
}
async function load(file, ext) {
  const buf = () => file.arrayBuffer(), text = () => file.text();
  switch (ext) {
    case "stl": { const {STLLoader} = await import(ADDONS + "STLLoader.js"); return meshFrom(new STLLoader().parse(await buf())); }
    case "ply": { const {PLYLoader} = await import(ADDONS + "PLYLoader.js"); return meshFrom(new PLYLoader().parse(await buf())); }
    case "vtk": case "vtp": { const {VTKLoader} = await import(ADDONS + "VTKLoader.js"); return meshFrom(new VTKLoader().parse(await buf())); }
    case "obj": { const {OBJLoader} = await import(ADDONS + "OBJLoader.js"); return new OBJLoader().parse(await text()); }
    case "3mf": { const {ThreeMFLoader} = await import(ADDONS + "3MFLoader.js"); return new ThreeMFLoader().parse(await buf()); }
    case "amf": { const {AMFLoader} = await import(ADDONS + "AMFLoader.js"); return new AMFLoader().parse(await buf()); }
    case "3ds": { const {TDSLoader} = await import(ADDONS + "TDSLoader.js"); return new TDSLoader().parse(await buf(), ""); }
    case "fbx": { const {FBXLoader} = await import(ADDONS + "FBXLoader.js"); return new FBXLoader().parse(await buf(), ""); }
    case "dae": { const {ColladaLoader} = await import(ADDONS + "ColladaLoader.js"); return new ColladaLoader().parse(await text(), "").scene; }
    case "wrl": { const {VRMLLoader} = await import(ADDONS + "VRMLLoader.js"); return new VRMLLoader().parse(await text(), ""); }
    case "gltf": case "glb": {
      const {GLTFLoader} = await import(ADDONS + "GLTFLoader.js");
      const data = await buf();
      return new Promise((ok, bad) => new GLTFLoader().parse(data, "", g => ok(g.scene), e => bad(new Error(e.message || "glTF error (a .gltf that points at separate .bin or texture files can't be opened alone; use .glb)"))));
    }
    case "step": case "stp": return occt("step", await buf());
    case "iges": case "igs": return occt("iges", await buf());
    case "brep": case "brp": return occt("brep", await buf());
    case "dxf": return dxf(await text());
    default: throw new Error(`.${ext || "?"} files aren't supported. Try STEP, STL, OBJ, 3MF, glTF or DXF.`);
  }
}

/* ---------------- STEP / IGES / BREP through OpenCascade in a worker ---------------- */
let worker = null, jobId = 0;
const jobs = new Map();
function occt(kind, buffer) {
  if (!worker) {
    worker = new Worker("occt-worker.js");
    worker.onmessage = e => { const j = jobs.get(e.data.id); if (j) { jobs.delete(e.data.id); e.data.ok ? j.ok(e.data) : j.bad(new Error(e.data.error || "OpenCascade could not read this file")); } };
    worker.onerror = e => { jobs.forEach(j => j.bad(new Error(e.message || "The CAD kernel failed to load (check your connection)"))); jobs.clear(); worker = null; };
    status("Loading the CAD kernel (about 8 MB, first time only)…");
  }
  const id = ++jobId;
  return new Promise((ok, bad) => {
    jobs.set(id, {ok, bad});
    worker.postMessage({id, kind, buffer}, [buffer]);
  }).then(r => buildOcct(r));
}
function buildOcct(r) {
  const meshes = r.meshes.map(m => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
    if (m.normal) g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
    g.setIndex(new THREE.BufferAttribute(m.index, 1));
    if (!m.normal) g.computeVertexNormals();
    const base = standard();
    if (m.color) base.color.setRGB(m.color[0], m.color[1], m.color[2], THREE.SRGBColorSpace);
    let material = base;
    const faces = (m.faces || []).filter(f => f.color);
    if (faces.length) {                      // per-face colours from the STEP file
      const mats = [base], key = {};
      g.clearGroups();
      let cursor = 0;
      const tris = m.index.length / 3;
      const push = (start, end, mi) => { if (end > start) g.addGroup(start * 3, (end - start) * 3, mi); };
      [...m.faces].sort((a, b) => a.first - b.first).forEach(f => {
        let mi = 0;
        if (f.color) {
          const k = f.color.join();
          if (key[k] === undefined) { const mm = base.clone(); mm.color.setRGB(f.color[0], f.color[1], f.color[2], THREE.SRGBColorSpace); key[k] = mats.push(mm) - 1; }
          mi = key[k];
        }
        push(cursor, f.first, 0); push(f.first, f.last + 1, mi); cursor = f.last + 1;
      });
      push(cursor, tris, 0);
      material = mats;
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.name = m.name || "";
    return mesh;
  });
  const build = node => {
    const grp = new THREE.Group();
    grp.name = node.name || "";
    (node.meshes || []).forEach(i => grp.add(meshes[i]));
    (node.children || []).forEach(c => grp.add(build(c)));
    return grp;
  };
  const root = build(r.root || {meshes: meshes.map((_, i) => i)});
  root.userData.fromOcct = true;
  return root;
}

/* ---------------- DXF as 2D curves ---------------- */
function dxf(text) {
  const Parser = window.DxfParser && (window.DxfParser.default || window.DxfParser);
  if (!Parser) throw new Error("The DXF reader did not load (check your connection)");
  const doc = new Parser().parseSync(text);
  const pts = [], counts = {};
  let length = 0;
  const seg = (a, b, M) => {
    const p = new THREE.Vector3(a.x, a.y, 0).applyMatrix4(M), q = new THREE.Vector3(b.x, b.y, 0).applyMatrix4(M);
    pts.push(p, q); length += p.distanceTo(q);
  };
  const poly = (list, closed, M) => { for (let i = 0; i + 1 < list.length; i++) seg(list[i], list[i + 1], M); if (closed && list.length > 2) seg(list[list.length - 1], list[0], M); };
  const arcPts = (c, r, a0, a1, n) => {
    while (a1 <= a0) a1 += 2 * Math.PI;
    const steps = Math.max(8, Math.ceil(n || (a1 - a0) / (Math.PI / 48)));
    return [...Array(steps + 1)].map((_, k) => { const a = a0 + (a1 - a0) * k / steps; return {x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a)}; });
  };
  const bulged = (v, closed) => {                            // LWPOLYLINE bulges become arcs
    const out = [];
    const n = v.length, last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = v[i], b = v[(i + 1) % n], bulge = a.bulge || 0;
      out.push(a);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (Math.abs(bulge) > 1e-9 && d > 0) {
        // bulge = tan(θ/4); the centre sits h to the left of the chord (right when bulge < 0).
        const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, h = d * (1 - bulge * bulge) / (4 * bulge), r = d * (1 + bulge * bulge) / (4 * Math.abs(bulge));
        const cx = (a.x + b.x) / 2 - uy * h, cy = (a.y + b.y) / 2 + ux * h;
        let a0 = Math.atan2(a.y - cy, a.x - cx), a1 = Math.atan2(b.y - cy, b.x - cx);
        if (bulge > 0) { while (a1 <= a0) a1 += 2 * Math.PI; } else { while (a1 >= a0) a1 -= 2 * Math.PI; }
        const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 48)));
        for (let k = 1; k < steps; k++) { const t = a0 + (a1 - a0) * k / steps; out.push({x: cx + r * Math.cos(t), y: cy + r * Math.sin(t)}); }
      }
    }
    out.push(closed ? v[0] : v[n - 1]);
    return out;
  };
  const walk = (entities, M, depth) => {
    for (const e of entities || []) {
      counts[e.type] = (counts[e.type] || 0) + 1;
      switch (e.type) {
        case "LINE": if (e.vertices && e.vertices.length >= 2) seg(e.vertices[0], e.vertices[1], M); break;
        case "LWPOLYLINE": case "POLYLINE": if (e.vertices && e.vertices.length) poly(bulged(e.vertices, !!e.shape), false, M); break;
        case "CIRCLE": poly(arcPts(e.center, e.radius, 0, 2 * Math.PI, 96), false, M); break;
        case "ARC": poly(arcPts(e.center, e.radius, e.startAngle, e.endAngle), false, M); break;
        case "ELLIPSE": {
          const mx = e.majorAxisEndPoint.x, my = e.majorAxisEndPoint.y, a = Math.hypot(mx, my), b = a * e.axisRatio, rot = Math.atan2(my, mx);
          let t0 = e.startAngle || 0, t1 = e.endAngle === undefined ? 2 * Math.PI : e.endAngle;
          while (t1 <= t0) t1 += 2 * Math.PI;
          const steps = 96, list = [];
          for (let k = 0; k <= steps; k++) { const t = t0 + (t1 - t0) * k / steps, x = a * Math.cos(t), y = b * Math.sin(t);
            list.push({x: e.center.x + x * Math.cos(rot) - y * Math.sin(rot), y: e.center.y + x * Math.sin(rot) + y * Math.cos(rot)}); }
          poly(list, false, M); break;
        }
        case "SPLINE": {
          const src = (e.fitPoints && e.fitPoints.length > 1) ? e.fitPoints : e.controlPoints;
          if (src && src.length > 1) {
            const curve = new THREE.CatmullRomCurve3(src.map(p => new THREE.Vector3(p.x, p.y, 0)), !!e.closed);
            poly(curve.getPoints(Math.max(32, src.length * 8)), false, M);
          }
          break;
        }
        case "INSERT": {
          const blk = doc.blocks && doc.blocks[e.name];
          if (!blk || depth > 8) break;
          const T = new THREE.Matrix4().compose(new THREE.Vector3(e.position.x, e.position.y, 0),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (e.rotation || 0) * Math.PI / 180),
            new THREE.Vector3(e.xScale || 1, e.yScale || 1, 1));
          const B = new THREE.Matrix4().makeTranslation(-(blk.position ? blk.position.x : 0), -(blk.position ? blk.position.y : 0), 0);
          walk(blk.entities, M.clone().multiply(T).multiply(B), depth + 1);
          break;
        }
      }
    }
  };
  walk(doc.entities, new THREE.Matrix4(), 0);
  if (!pts.length) throw new Error("No lines, arcs, circles or polylines found in this DXF");
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: themeColors().accent}));
  const grp = new THREE.Group();
  grp.add(lines);
  grp.userData.dxf = {counts, length, lines};
  return grp;
}

/* ============================================================ show */
function disposeModel() {
  if (!wrapper) return;
  wrapper.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => x.dispose()); });
  scene.remove(wrapper);
  wrapper = model = null;
}
function show(obj, file, ext) {
  disposeModel();
  clearMeasure();
  Object.assign(state, {name: file.name, ext, size: file.size, kind: obj.userData.dxf ? "2d" : "3d", meshes: [], edges: []});
  model = obj;
  wrapper = new THREE.Group();
  wrapper.add(model);
  scene.add(wrapper);
  model.traverse(o => {
    if (o.isMesh) {
      state.meshes.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { m.side = THREE.DoubleSide; });
    }
  });
  if (state.kind === "2d") state.edges.push(obj.userData.dxf.lines);
  state.triangles = state.meshes.reduce((n, m) => n + triCount(m.geometry), 0);
  if (state.kind === "3d" && state.triangles <= 1500000) {
    const ink = themeColors().ink;
    state.meshes.forEach(m => {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), new THREE.LineBasicMaterial({color: ink, transparent: true, opacity: 0.55}));
      e.userData.isEdge = true;
      m.add(e);
      state.edges.push(e);
    });
  }
  $("file-units").value = String(DEFAULT_UNIT[ext] || 1);
  $("up-axis").value = state.kind === "2d" ? "z" : Y_UP.has(ext) ? "y" : "z";
  const unitless = !["step", "stp", "iges", "igs", "brep", "brp"].includes(ext);
  $("file-units").disabled = !unitless;
  $("units-hint").textContent = unitless ? "This format has no units; pick what the file was drawn in." : "STEP and IGES carry their own units; shown here in mm.";
  ["info-box", "measure-box", "display-box", "section-box", "tree-box"].forEach(id => $(id).hidden = false);
  $("section-box").hidden = state.kind === "2d";
  $("empty").hidden = true;
  document.querySelectorAll(".vtools .tb").forEach(b => b.disabled = false);
  $("opt-edges").checked = state.edges.length > 0;
  $("opt-edges").disabled = state.kind === "2d" || !state.edges.length;
  $("opt-wire").checked = false;
  $("sec-axis").value = ""; setSection();
  applyTransform();
  buildTree();
  view(state.kind === "2d" ? "top" : "iso");
}
const triCount = g => g.index ? g.index.count / 3 : g.attributes.position ? g.attributes.position.count / 3 : 0;

function applyTransform() {
  if (!wrapper) return;
  wrapper.scale.setScalar(parseFloat($("file-units").value));
  wrapper.rotation.set($("up-axis").value === "y" ? Math.PI / 2 : 0, 0, 0);
  wrapper.updateMatrixWorld(true);
  state.box = new THREE.Box3().setFromObject(wrapper);
  placeGrid();
  updateInfo();
  setSection();
}
$("file-units").onchange = () => { applyTransform(); clearMeasure(); view("fit"); };
$("up-axis").onchange = () => { applyTransform(); clearMeasure(); view("iso"); };

function placeGrid() {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
  if (!state.box || !$("opt-grid").checked) return;
  const size = state.box.getSize(new THREE.Vector3()), span = Math.max(size.x, size.y, 1) * 1.6;
  const step = 10 ** Math.floor(Math.log10(span / 10)), cells = Math.ceil(span / step / 2) * 2;
  const c = themeColors();
  grid = new THREE.GridHelper(cells * step, cells, c.grid1, c.grid2);
  grid.rotation.x = Math.PI / 2;
  const ctr = state.box.getCenter(new THREE.Vector3());
  grid.position.set(Math.round(ctr.x / step) * step, Math.round(ctr.y / step) * step, state.kind === "2d" ? state.box.min.z - 1e-3 * span : state.box.min.z);
  grid.material.transparent = true; grid.material.opacity = 0.7;
  scene.add(grid);
}
$("opt-grid").onchange = placeGrid;
$("opt-edges").onchange = e => state.edges.forEach(x => { if (x.userData.isEdge) x.visible = e.target.checked; });
$("opt-wire").onchange = e => state.meshes.forEach(m => (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.wireframe = e.target.checked));

/* ============================================================ views */
function view(name) {
  if (!state.box) return;
  const ctr = state.box.getCenter(new THREE.Vector3());
  const radius = Math.max(state.box.getBoundingSphere(new THREE.Sphere()).radius, 1e-6);
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1;
  const dirs = {iso: [1, -1, 0.8], front: [0, -1, 0], top: [0, -1e-4, 1], right: [1, 0, 0]};
  const d = name === "fit" ? camera.position.clone().sub(controls.target).normalize() : new THREE.Vector3(...dirs[name]).normalize();
  camera.near = dist / 1000; camera.far = dist * 100; camera.updateProjectionMatrix();
  camera.position.copy(ctr).addScaledVector(d, dist);
  controls.target.copy(ctr);
  controls.update();
}
document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => view(b.dataset.view));

/* ============================================================ info and measurements */
const fmtLen = mm => {
  const inch = $("disp-units").value === "in", raw = inch ? mm / 25.4 : mm;
  const v = Math.abs(raw) < 5e-5 ? 0 : raw;                 // hide floating-point noise
  return `${v.toLocaleString("en-US", {maximumSignificantDigits: 5})} ${inch ? "in" : "mm"}`;
};
function updateInfo() {
  const kb = state.size / 1024;
  const info = [["Name", state.name], ["Format", state.ext.toUpperCase()], ["Size", kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} kB`]];
  if (state.kind === "3d") info.push(["Parts", String(state.meshes.length)], ["Triangles", state.triangles.toLocaleString("en-US")]);
  else Object.entries(model.userData.dxf.counts).forEach(([k, n]) => info.push([k.charAt(0) + k.slice(1).toLowerCase(), String(n)]));
  $("info").innerHTML = info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  const s = state.box.getSize(new THREE.Vector3());
  const rows = state.kind === "2d"
    ? [["Width (X)", fmtLen(s.x)], ["Height (Y)", fmtLen(s.y)], ["Total curve length", fmtLen(model.userData.dxf.length * parseFloat($("file-units").value))]]
    : [["X", fmtLen(s.x)], ["Y", fmtLen(s.y)], ["Z", fmtLen(s.z)]];
  if (state.kind === "3d") {
    const {volume, area} = volumeArea();
    const inch = $("disp-units").value === "in";
    const vol = inch ? volume / 16387.064 : volume / 1000, ar = inch ? area / 645.16 : area / 100;
    const mass = volume * 1e-9 * parseFloat($("density").value);
    rows.push(["Volume", `${vol.toLocaleString("en-US", {maximumSignificantDigits: 5})} ${inch ? "in³" : "cm³"}`],
      ["Surface area", `${ar.toLocaleString("en-US", {maximumSignificantDigits: 5})} ${inch ? "in²" : "cm²"}`],
      ["Mass", inch ? `${(mass / 0.45359237).toLocaleString("en-US", {maximumSignificantDigits: 4})} lb` : mass >= 1 ? `${mass.toLocaleString("en-US", {maximumSignificantDigits: 4})} kg` : `${(mass * 1000).toLocaleString("en-US", {maximumSignificantDigits: 4})} g`]);
  }
  $("sizes").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  $("mass-hint").hidden = state.kind === "2d";
  $("density").parentElement.hidden = state.kind === "2d";
}
$("disp-units").onchange = () => { updateInfo(); if (mB) showMeasure(); };
$("density").onchange = updateInfo;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);

// Volume by the divergence theorem (sum of signed tetrahedra) and area, in world mm, visible parts only.
function volumeArea() {
  let volume = 0, area = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (const m of state.meshes) {
    if (!isShown(m)) continue;
    m.updateMatrixWorld(true);
    const pos = m.geometry.attributes.position, idx = m.geometry.index, M = m.matrixWorld;
    const n = idx ? idx.count : pos.count;
    let v = 0;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(M); b.fromBufferAttribute(pos, i1).applyMatrix4(M); c.fromBufferAttribute(pos, i2).applyMatrix4(M);
      v += a.dot(ab.crossVectors(b, c)) / 6;
      area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    }
    volume += Math.abs(v);
  }
  return {volume, area};
}
const isShown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

/* ============================================================ parts tree */
function buildTree() {
  const nodes = [];
  let count = 0;
  const name = o => o.name || (o.isMesh ? `Part ${count}` : `Group ${count}`);
  const li = (o, depth) => {
    if (count > 400 || o.userData.isEdge) return "";
    const kids = o.children.filter(c => !c.userData.isEdge && (c.isMesh || c.children.length));
    if (!o.isMesh && kids.length === 1 && !o.name) return li(kids[0], depth);      // skip anonymous wrappers
    const i = nodes.push(o) - 1; count++;
    const label = name(o);
    const sub = kids.map(k => li(k, depth + 1)).join("");
    return `<li><label><input type="checkbox" data-n="${i}" checked> ${esc(label)}</label>${sub ? `<ul>${sub}</ul>` : ""}</li>`;
  };
  const html = li(model, 0);
  $("tree").innerHTML = html;
  $("tree-box").hidden = state.kind === "2d" || state.meshes.length < 2;
  $("tree").onchange = e => { const o = nodes[+e.target.dataset.n]; if (o) { o.visible = e.target.checked; updateInfo(); } };
}

/* ============================================================ section */
function setSection() {
  const axis = $("sec-axis").value;
  clipOn = !!axis && !!state.box;
  $("sec-pos").disabled = !clipOn;
  if (clipOn) {
    const i = {x: 0, y: 1, z: 2}[axis], lo = state.box.min.getComponent(i), hi = state.box.max.getComponent(i);
    const pos = lo + (hi - lo) * $("sec-pos").value / 1000, flip = $("sec-flip").checked;
    const n = new THREE.Vector3(); n.setComponent(i, flip ? 1 : -1);
    clipPlane.set(n, flip ? -pos : pos);
  }
  const planes = clipOn ? [clipPlane] : [];
  if (wrapper) wrapper.traverse(o => { const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.clippingPlanes = planes; x.needsUpdate = true; }); });
}
["sec-axis", "sec-flip"].forEach(id => $(id).onchange = setSection);
$("sec-pos").oninput = setSection;

/* ============================================================ measure */
let measuring = false, mA = null, mB = null, mLine = null, labelEl = null;
const markers = [];
const raycaster = new THREE.Raycaster();
$("measure-btn").onclick = () => {
  measuring = !measuring;
  $("measure-btn").setAttribute("aria-pressed", String(measuring));
  renderer.domElement.style.cursor = measuring ? "crosshair" : "";
  if (measuring) status("Measure: click two points on the model. Esc clears.");
  else { clearMeasure(); status(""); }
};
let down = null;
renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!measuring || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const r = renderer.domElement.getBoundingClientRect();
  camera.updateMatrixWorld();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  raycaster.params.Line.threshold = state.box ? state.box.getSize(new THREE.Vector3()).length() / 300 : 1;
  const targets = state.kind === "2d" ? state.edges : state.meshes.filter(isShown);
  const hit = raycaster.intersectObjects(targets, false).find(h => !clipOn || clipPlane.distanceToPoint(h.point) >= 0);
  if (!hit) return;
  if (!mA || mB) { clearMeasure(); mA = hit.point.clone(); addMarker(mA); }
  else { mB = hit.point.clone(); addMarker(mB); showMeasure(); }
});
addEventListener("keydown", e => { if (e.key === "Escape") clearMeasure(); });
function addMarker(p) {
  const r = state.box.getSize(new THREE.Vector3()).length() / 250;
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({color: themeColors().accent, depthTest: false}));
  m.renderOrder = 10; m.position.copy(p); scene.add(m); markers.push(m);
}
function showMeasure() {
  if (mLine) { scene.remove(mLine); mLine.geometry.dispose(); }
  mLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([mA, mB]), new THREE.LineBasicMaterial({color: themeColors().accent, depthTest: false}));
  mLine.renderOrder = 10; scene.add(mLine);
  if (!labelEl) { labelEl = document.createElement("div"); labelEl.className = "mlabel"; vstage.appendChild(labelEl); }
  const d = mB.clone().sub(mA);
  labelEl.textContent = `${fmtLen(d.length())}  (Δx ${fmtLen(Math.abs(d.x))}, Δy ${fmtLen(Math.abs(d.y))}, Δz ${fmtLen(Math.abs(d.z))})`;
}
function placeLabel() {
  if (!labelEl || !mA || !mB) return;
  const p = mA.clone().add(mB).multiplyScalar(0.5).project(camera);
  labelEl.style.left = `${(p.x + 1) / 2 * stageEl.clientWidth}px`;
  labelEl.style.top = `${(1 - p.y) / 2 * stageEl.clientHeight}px`;
}
function clearMeasure() {
  markers.splice(0).forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  if (mLine) { scene.remove(mLine); mLine.geometry.dispose(); mLine.material.dispose(); mLine = null; }
  if (labelEl) { labelEl.remove(); labelEl = null; }
  mA = mB = null;
}

/* ============================================================ screenshot */
$("shot-btn").onclick = () => {
  renderer.render(scene, camera);
  saveFile((state.name.replace(/\.[^.]+$/, "") || "model") + ".png", "image/png", renderer.domElement.toDataURL("image/png"))
    .catch(err => status(`Could not save the screenshot: ${err.message || err}`, true));
};

// For automated checks: window.cadViewer.open(file) and .stats().
window.cadViewer = {open: openFile, stats: () => state.box && {box: state.box.getSize(new THREE.Vector3()).toArray(), ...volumeArea(), triangles: state.triangles, parts: state.meshes.length, kind: state.kind, dxf: model && model.userData.dxf ? {counts: model.userData.dxf.counts, length: model.userData.dxf.length} : null}};
