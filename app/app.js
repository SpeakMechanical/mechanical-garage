// Mechanical Garage Android app. Uses the tested MechMate formulas (window.MM from mechmate-tools.js)
// and saveFile / isApp from shared/site.js. Everything personal is kept on the phone in localStorage.
(function () {
"use strict";
const {TOOLS, CATS, MAT_OPTIONS, toDisp, toSI, unit, formatter} = MM;
const tool = id => TOOLS.find(t => t.id === id);
const catName = c => (CATS.find(x => x[0] === c) || [c, c])[1];
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const sub = s => esc(s).replace(/_([A-Za-z0-9.]+)/g, "<sub>$1</sub>");
const plain = s => String(s).replace(/<[^>]+>/g, "").replace(/_([A-Za-z0-9.]+)/g, "$1");

/* ============================================================ storage */
const store = {
  get(k, d) { try { const s = localStorage.getItem("mg." + k); return s === null ? d : JSON.parse(s); } catch (e) { return d; } },
  set(k, x) { try { localStorage.setItem("mg." + k, JSON.stringify(x)); } catch (e) {} }
};
let sys = store.get("units", "si"), haptics = store.get("haptics", true), material = store.get("material", "e250");
let favs = store.get("favs", ["ac", "beam", "feeds", "power"]).filter(tool);
let hist = store.get("history", []).filter(h => tool(h.tool));
let saved = store.get("saved", []).filter(h => tool(h.tool));
const vals = {}, keptVals = store.get("vals", {});
TOOLS.forEach(t => { vals[t.id] = {}; t.fields.forEach(f => vals[t.id][f.id] = f.value); Object.assign(vals[t.id], keptVals[t.id] || {}); });

/* ============================================================ native touches */
const plugin = n => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n];
function buzz(kind = "light") {
  if (!haptics) return;
  const H = isApp() && plugin("Haptics");
  try {
    if (H) kind === "success" ? H.notification({type: "SUCCESS"}) : H.impact({style: kind === "medium" ? "MEDIUM" : "LIGHT"});
    else if (navigator.vibrate) navigator.vibrate(kind === "success" ? [12, 40, 12] : 8);
  } catch (e) {}
}
function applyTheme() {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const SB = isApp() && plugin("StatusBar");
  if (SB) { try { SB.setStyle({style: dark ? "DARK" : "LIGHT"}); } catch (e) {} }
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

let toastTimer;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================ icons */
const ICON = {
  power: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  belt: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="4"/><path d="M6 9l12-1M6 15l12 1"/>',
  chain: '<rect x="3" y="9" width="8" height="6" rx="3"/><rect x="13" y="9" width="8" height="6" rx="3"/><path d="M9 12h6"/>',
  screw: '<path d="M4 12h16M6 8l2 8M10 8l2 8M14 8l2 8"/>',
  motor: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 12h6M7 7V5h4v2"/>',
  beam: '<path d="M3 8h18M3 8v8M21 8l-2 3"/><path d="M8 4v4M8 4l-1.5 1.5M8 4l1.5 1.5"/>',
  bolt: '<path d="M8 3h8v4H8zM10 7v14h4V7M10 11h4M10 15h4"/>',
  pressfit: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 7v10"/>',
  bearing: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="5.5" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/><circle cx="5.5" cy="12" r="1.3"/>',
  cylinder: '<rect x="3" y="8" width="11" height="8" rx="1"/><path d="M14 12h7M8 8v8"/>',
  feeds: '<path d="M4 20l7-7M11 13l6-9 3 3-9 6z"/>',
  bend: '<path d="M4 20V10a6 6 0 0 1 6-6h10"/>',
  weight: '<path d="M6 8h12l2 12H4z"/><circle cx="12" cy="5" r="2"/>',
  fits: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 12h8"/>',
  pattern: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="1.6"/><circle cx="19" cy="16" r="1.6"/><circle cx="5" cy="16" r="1.6"/>',
  thermal: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  units: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  ac: '<rect x="3" y="5" width="18" height="8" rx="2"/><path d="M7 10h10M8 16l-1 3M12 16v3M16 16l1 3"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  car: '<path d="M3 16v-3l2-1 3-4h8l4 4 2 1v3"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'
};
const icon = k => `<svg viewBox="0 0 24 24">${ICON[k] || ICON.gear}</svg>`;

/* ============================================================ results */
function compute(t, v) {
  const f = formatter(sys);
  try {
    const r = t.solve(v);
    if (!r) return {rows: [], msg: "This combination of inputs is not covered."};
    return {r, f, rows: t.rows(r, v, f), msg: (t.msg && t.msg(r)) || "", extra: t.extra ? t.extra(r, v, f) : ""};
  } catch (e) { return {rows: [], msg: "Check the inputs: " + e.message}; }
}
// The headline result for each tool: a preferred row, else the first marked OK, else the first.
const HERO = {motor: /^Peak torque/, bolt: /^Tightening torque/, pressfit: /^Torque capacity/, bearing: /^Life at/, cylinder: /^Push force/,
  weight: /^Weight each/, bend: /^Flat length/, fits: /^Fit type/, thermal: /^Change in length/, pattern: /^Chord/, belt: /^Belt pitch length|^Centre distance/};
function heroIndex(t, rows) {
  const re = HERO[t.id];
  let i = re ? rows.findIndex(r => re.test(plain(r[0]))) : -1;
  if (i < 0) i = rows.findIndex(r => r[2] === "ok");
  return Math.max(0, i);
}
const heroOf = (t, v) => { const c = compute(t, v), r = c.rows[heroIndex(t, c.rows)]; return r ? [plain(r[0]), plain(r[1])] : ["", ""]; };

/* ============================================================ navigation */
let tab = "home", openId = null, homeDrawn = false;
function route() {
  const h = location.hash.slice(1) || "home";
  if (h.startsWith("tool/")) {
    const id = h.slice(5);
    if (tool(id)) { if (!homeDrawn) { renderHome(); homeDrawn = true; } openTool(id); return; }   // fill the screen behind the tool
  }
  closeTool(true);
  tab = ["home", "tools", "learn", "workshop", "cars"].includes(h) ? h : "home";
  document.querySelectorAll(".screen").forEach(s => s.hidden = s.dataset.tab !== tab);
  document.querySelectorAll(".tabbar a").forEach(a => { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  ({home: renderHome, tools: renderTools, learn: renderLearn, workshop: renderWorkshop, cars: renderCars})[tab]();
  if (tab === "home") homeDrawn = true;
}
addEventListener("hashchange", route);
document.querySelectorAll(".tabbar a").forEach(a => a.addEventListener("click", () => buzz()));
const App = plugin("App");
if (isApp() && App) App.addListener("backButton", () => {
  if ($("sheet").classList.contains("open")) return closeSheet();
  if (openId) return window.history.length > 1 ? window.history.back() : (location.hash = "#tools");
  if (tab !== "home") return (location.hash = "#home");
  App.exitApp();
});

/* ============================================================ tiles */
function tileHtml(t, opts = {}) {
  const fav = favs.includes(t.id);
  const short = t.blurb.split(/(?<=\.)\s/)[0].replace(/<[^>]+>/g, "");
  return `<a class="tile press cat-${t.cat}" href="#tool/${t.id}" data-tool="${t.id}">
    ${fav && !opts.noStar ? `<svg class="star" viewBox="0 0 24 24">${ICON.star}</svg>` : ""}
    <span class="ic">${icon(t.id)}</span><b>${esc(t.name)}</b>${opts.value ? `<span class="val">${esc(opts.value)}</span>` : `<small>${esc(short)}</small>`}</a>`;
}
function rowHtml(item, k, kind) {
  const t = tool(item.tool), when = ago(item.at);
  return `<li class="row press" data-k="${k}" data-kind="${kind}"><span class="ic cat-${t.cat}" style="--c:var(--c-${t.cat})">${icon(t.id)}</span>
    <span class="tx"><b>${esc(item.name || t.name)}</b><span>${esc(item.hero[0])}: ${esc(item.hero[1])}</span></span>
    <span class="end">${when}</span>${kind === "saved" ? `<button class="del" data-del="${k}" aria-label="Delete">${icon("trash")}</button>` : ""}</li>`;
}
function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "now"; if (s < 3600) return `${Math.floor(s / 60)} min`; if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`; return new Date(ts).toLocaleDateString(undefined, {day: "numeric", month: "short"});
}
function openItem(item) { Object.assign(vals[item.tool], item.values); if (item.values.mat) material = item.values.mat; location.hash = "#tool/" + item.tool; }

/* ============================================================ home */
function renderHome() {
  const h = new Date().getHours();
  $("hello").textContent = h < 5 ? "Working late?" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const last = hist[0];
  if (last) {
    const t = tool(last.tool);
    $("continue").innerHTML = `<a class="continue cat-${t.cat}" href="#tool/${t.id}" id="cont"><small>Continue · ${ago(last.at)} ago</small><b>${esc(t.name)}</b>
      <div class="big">${esc(last.hero[1])}</div><div class="sub">${esc(last.hero[0])}</div></a>`;
    $("cont").onclick = e => { e.preventDefault(); buzz(); openItem(last); };
  } else {
    $("continue").innerHTML = `<a class="continue cat-home" href="#tool/ac"><small>Start here</small><b>How big an AC do you need?</b>
      <div class="big">Size it right</div><div class="sub">Room, windows and sun in, tonnage and star rating out</div></a>`;
  }
  $("home-favs").innerHTML = favs.slice(0, 6).map(id => tileHtml(tool(id), {noStar: true, value: heroOf(tool(id), vals[id])[1]})).join("") ||
    `<div class="empty" style="grid-column:1/-1">Tap the star on any tool to pin it here.</div>`;
  const rec = hist.slice(1, 5);
  $("home-recent").innerHTML = rec.length ? `<h2 class="sec">Recent</h2><ul class="list">${rec.map((x, k) => rowHtml(x, k + 1, "history")).join("")}</ul>` : "";
  $("home-recent").querySelectorAll(".row").forEach(r => r.onclick = () => { buzz(); openItem(hist[+r.dataset.k]); });
  const g = LEARN.flatMap(s => s.items), pick = g[Math.floor(Date.now() / 864e5) % g.length];
  $("home-learn").innerHTML = `<h2 class="sec">Today's read</h2><a class="row press" href="${pick.href}"><span class="ic">${icon("book")}</span><span class="tx"><b>${esc(pick.t)}</b><span>${esc(pick.d)}</span></span><span class="end">›</span></a>`;
}

/* ============================================================ tools */
let catFilter = "all";
function renderTools() {
  $("cats").innerHTML = [["all", "All"], ...CATS].map(([c, n]) => `<button class="chip" data-c="${c}" aria-pressed="${c === catFilter}">${n}</button>`).join("");
  $("cats").querySelectorAll(".chip").forEach(b => b.onclick = () => { buzz(); catFilter = b.dataset.c; renderTools(); });
  const q = $("q").value.trim().toLowerCase();
  const list = TOOLS.filter(t => (catFilter === "all" || t.cat === catFilter) && (!q || q.split(/\s+/).every(w => (t.name + " " + t.blurb + " " + catName(t.cat)).toLowerCase().includes(w))));
  const carTile = (catFilter === "all" && (!q || "car cost compare cars ownership service parts swap".includes(q))) ?
    `<a class="tile press cat-strength" href="#cars"><span class="ic">${icon("car")}</span><b>Car cost</b><small>Compare two cars over the years you keep them, and find smart swaps.</small></a>` : "";
  $("tool-grid").innerHTML = (carTile + list.map(t => tileHtml(t)).join("")) || `<div class="empty" style="grid-column:1/-1">No tool matches “${esc(q)}”.</div>`;
}
$("q").addEventListener("input", renderTools);

/* ============================================================ learn */
const LEARN = [
  {s: "Selection guides", items: [
    {t: "How to select a ball screw", d: "Lead, life, critical speed, buckling, motor torque", href: "garage/index.html#ballscrew"},
    {t: "Bolts and nuts", d: "Property classes, preload, torque, joint design", href: "garage/index.html#bolts"},
    {t: "Bearing selection", d: "Types, equivalent load, L10 life, fits", href: "garage/index.html#bearings"},
    {t: "Tolerances and GD&T", d: "ISO fits, datums, position, stack-ups", href: "garage/index.html#gdt"}]},
  {s: "Machine Design", items: [
    {t: "1 · Static and dynamic loading", d: "Stresses, safety factors, impact, failure theories", href: "garage/machine-design.html#loading"},
    {t: "2 · Fatigue and fluctuating loads", d: "S-N diagram, Marin factors, Goodman", href: "garage/machine-design.html#fatigue"},
    {t: "3 · Design of joints", d: "Bolted, riveted and welded joints", href: "garage/machine-design.html#joints"},
    {t: "4 · Shafts and keys", d: "ASME code, DE-Goodman, keys", href: "garage/machine-design.html#shafts"},
    {t: "5 · Springs", d: "Helical, leaf and torsion springs", href: "garage/machine-design.html#springs"},
    {t: "6 · Gears", d: "Lewis bending, Buckingham wear", href: "garage/machine-design.html#gears"},
    {t: "7 · Rolling and sliding bearings", d: "Life, Petroff, Sommerfeld, pV", href: "garage/machine-design.html#bearings"},
    {t: "8 · Brakes and clutches", d: "Plate, cone, band and block", href: "garage/machine-design.html#brakes"}]},
  {s: "From the garage", items: [
    {t: "Personal projects", d: "Vending machines, WAAM printer, The Third Arm…", href: "personal/index.html"}]}
];
function renderLearn() {
  $("learn-list").innerHTML = LEARN.map(s => `<h2 class="sec">${s.s}</h2><ul class="list">${s.items.map(i =>
    `<li><a class="row press" href="${i.href}"><span class="ic">${icon("book")}</span><span class="tx"><b>${esc(i.t)}</b><span>${esc(i.d)}</span></span><span class="end">›</span></a></li>`).join("")}</ul>`).join("");
}

/* ============================================================ workshop */
let wsTab = "favs";
$("ws-seg").querySelectorAll("button").forEach(b => b.onclick = () => { buzz(); wsTab = b.dataset.ws; renderWorkshop(); });
function renderWorkshop() {
  $("ws-seg").querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.ws === wsTab)));
  const body = $("ws-body");
  if (wsTab === "favs") {
    body.innerHTML = favs.length ? `<div class="tiles">${favs.map(id => tileHtml(tool(id), {value: heroOf(tool(id), vals[id])[1]})).join("")}</div>`
      : `<div class="empty">No favourites yet. Open a tool and tap the star.</div>`;
  } else if (wsTab === "history") {
    body.innerHTML = hist.length ? `<ul class="list">${hist.map((x, k) => rowHtml(x, k, "history")).join("")}</ul>
      <p class="blurb">The last ${hist.length} calculations are kept on this phone.</p>` : `<div class="empty">Calculations you make appear here automatically.</div>`;
  } else {
    body.innerHTML = saved.length ? `<ul class="list">${saved.map((x, k) => rowHtml(x, k, "saved")).join("")}</ul>
      <button class="btn ghost wide" id="ws-report" style="margin-top:14px">Share a PDF report of everything saved</button>`
      : `<div class="empty">Press <b>Save to workshop</b> in any tool to keep a named calculation.</div>`;
    if (saved.length) $("ws-report").onclick = shareReport;
  }
  body.querySelectorAll(".row").forEach(r => r.onclick = e => {
    if (e.target.closest(".del")) { buzz("medium"); saved.splice(+e.target.closest(".del").dataset.del, 1); store.set("saved", saved); renderWorkshop(); toast("Deleted"); return; }
    buzz(); openItem((r.dataset.kind === "saved" ? saved : hist)[+r.dataset.k]);
  });
}
async function shareReport() {
  toast("Making the PDF…");
  try {
    const pdf = await makePdf("Mechanical Garage report", saved.map(x => ({name: x.name, tool: x.tool, at: x.at, rows: x.rows, note: x.note, photos: x.photos})));
    await saveFile("Mechanical Garage report.pdf", "application/pdf", pdf);
    buzz("success");
  } catch (e) { toast("Could not make the PDF: " + (e.message || e)); }
}

/* ---------- PDF reports (jsPDF with DejaVu Sans, which has ₹ ★ Δ √ ≥ and subscripts) ---------- */
let pdfLib = null;
function pdfReady() {
  if (!pdfLib) pdfLib = (async () => {
    await new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = "vendor/jspdf.umd.min.js"; sc.onload = ok; sc.onerror = () => bad(new Error("PDF library missing")); document.head.appendChild(sc); });
    const b64 = async u => { const a = new Uint8Array(await (await fetch(u)).arrayBuffer()); let str = ""; for (let i = 0; i < a.length; i += 32768) str += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(str); };
    return {jsPDF: window.jspdf.jsPDF, regular: await b64("vendor/fonts/DejaVuSans.ttf"), bold: await b64("vendor/fonts/DejaVuSans-Bold.ttf")};
  })().catch(e => { pdfLib = null; throw e; });
  return pdfLib;
}
// items: [{name, tool, at, rows: [[label, value, note]], note?, photos?: [dataUrl], drawing?: dataUrl}]
async function makePdf(title, items) {
  const {jsPDF, regular, bold} = await pdfReady();
  const doc = new jsPDF({unit: "mm", format: "a4", compress: true});
  doc.addFileToVFS("DejaVuSans.ttf", regular); doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold); doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  const W = 210, H = 297, M = 16, inner = W - 2 * M;
  let y = 0;
  const header = () => {
    doc.setFillColor(201, 72, 26); doc.rect(0, 0, W, 30, "F");
    doc.setTextColor(255); doc.setFont("DejaVu", "bold"); doc.setFontSize(9); doc.text("MECHANICAL GARAGE", M, 11);
    doc.setFontSize(17); doc.text(title, M, 22);
    doc.setFont("DejaVu", "normal"); doc.setFontSize(9); doc.text(new Date().toLocaleString(), W - M, 22, {align: "right"});
    y = 42; doc.setTextColor(27, 30, 34);
  };
  const need = h => { if (y + h > H - 18) { doc.addPage(); header(); } };
  header();
  for (const it of items) {
    const t = tool(it.tool);
    need(24);
    doc.setFont("DejaVu", "bold"); doc.setFontSize(14); doc.text(doc.splitTextToSize(it.name, inner)[0], M, y); y += 6;
    doc.setFont("DejaVu", "normal"); doc.setFontSize(9); doc.setTextColor(99, 106, 114);
    doc.text(`${t ? t.name : it.tool} · ${catName(t ? t.cat : "")} · ${new Date(it.at).toLocaleString()}`, M, y); y += 6;
    doc.setTextColor(27, 30, 34);
    if (it.drawing) { const h = Math.min(70, inner * it.drawing.h / it.drawing.w); need(h + 4); doc.addImage(it.drawing.src, "PNG", M + (inner - h * it.drawing.w / it.drawing.h) / 2, y, h * it.drawing.w / it.drawing.h, h); y += h + 4; }
    for (const [k, v, note] of it.rows) {
      const vLines = doc.splitTextToSize(String(v), inner - 72), nLines = note ? doc.splitTextToSize(String(note), inner - 72) : [];
      const h = 5.2 * vLines.length + 4.2 * nLines.length + 3;
      need(h);
      doc.setDrawColor(221, 215, 202); doc.line(M, y - 3.6, W - M, y - 3.6);
      doc.setFontSize(9.5); doc.setTextColor(99, 106, 114); doc.text(doc.splitTextToSize(String(k), 68), M, y);
      doc.setFont("DejaVu", "bold"); doc.setFontSize(10.5); doc.setTextColor(27, 30, 34); doc.text(vLines, M + 72, y);
      doc.setFont("DejaVu", "normal");
      if (nLines.length) { doc.setFontSize(8.5); doc.setTextColor(99, 106, 114); doc.text(nLines, M + 72, y + 5.2 * vLines.length); doc.setTextColor(27, 30, 34); }
      y += h;
    }
    if (it.note) { const lines = doc.splitTextToSize("Note: " + it.note, inner); need(lines.length * 4.6 + 4); doc.setFontSize(9.5); doc.text(lines, M, y + 1); y += lines.length * 4.6 + 4; }
    for (const ph of it.photos || []) {
      const img = await loadImg(ph), h = Math.min(80, inner * img.height / img.width), w = h * img.width / img.height;
      need(h + 4); doc.addImage(ph, "JPEG", M, y, w, h); y += h + 4;
    }
    y += 8;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140);
    doc.text("First-sizing calculations from Mechanical Garage. Check final designs against codes and supplier data.", M, H - 9);
    doc.text(`${i} / ${pages}`, W - M, H - 9, {align: "right"});
  }
  return doc.output("datauristring");
}
// Rasterise the open tool's drawing for a PDF.
async function drawingPng() {
  const svg = $("visual").querySelector("svg");
  if (!svg) return null;
  const {src, w, h} = inlineSvg(svg), img = await loadImg(src);
  const cv = document.createElement("canvas"); cv.width = w * 3; cv.height = h * 3;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return {src: cv.toDataURL("image/png"), w, h};
}


/* ============================================================ car cost */
const CC = window.CarCost;
let carState = Object.assign({a: "a6", b: "city", ea: {}, eb: {}, pa: [], pb: [], common: {years: 5, kmYear: 12000, petrol: CC.FUEL.petrol, diesel: CC.FUEL.diesel}}, store.get("cars", {}));
const carOf = side => ({...CC.CARS[carState[side]], ...carState["e" + side]});
const inr = x => "₹" + Math.round(x).toLocaleString("en-IN");
const lakh = x => Math.abs(x) >= 1e5 ? `₹${(x / 1e5).toLocaleString("en-IN", {maximumFractionDigits: 2})} lakh` : inr(x);
const CAR_PARTS = [["depreciation", "Value lost", "#1c7ed6"], ["fuel", "Fuel", "#e8590c"], ["insurance", "Insurance", "#ae3ec9"], ["service", "Service", "#2f9e44"], ["repairs", "Repairs", "#d6336c"], ["oneTime", "Transfer, tax, fixes", "#868e96"]];
const CAR_FIELDS = [["price", "Price, ₹"], ["resalePct", "Resale after 5 yrs, % of price"], ["kmpl", "Mileage, km per litre"], ["insurance", "Insurance, ₹/yr"], ["service", "Service, ₹/yr"], ["repairs", "Repairs, ₹/yr"], ["oneTime", "Transfer, tax, first fixes, ₹"]];
function renderCars() {
  const c = carState.common, A = carOf("a"), B = carOf("b");
  const ra = CC.tco(A, c, carState.pa), rb = CC.tco(B, c, carState.pb), diff = ra.total - rb.total;
  const max = Math.max(ra.before, rb.before, 1);
  const bar = r => `<div class="stack">${CAR_PARTS.map(([k, , col]) => `<i style="width:${(r.parts[k] / max * 100).toFixed(2)}%;background:${col}"></i>`).join("")}</div>`;
  const box = (side, car, r) => `<div class="carbox ${side}">
    <div class="tag2">CAR ${side.toUpperCase()}</div>
    <select data-car="${side}">${Object.entries(CC.CARS).map(([k, x]) => `<option value="${k}"${k === carState[side] ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
    <div class="big">${lakh(r.total)}</div><div class="sm">over ${c.years} years${r.saving ? ` · swaps save ${lakh(r.saving)}` : ""}</div>
    <div class="sm">${inr(r.perMonth)} a month · ${inr(r.perKm)} per km</div>
    <details><summary>Edit numbers</summary>
      <label>Fuel<select data-cf="${side}:fuel"><option value="petrol"${car.fuel === "petrol" ? " selected" : ""}>Petrol</option><option value="diesel"${car.fuel === "diesel" ? " selected" : ""}>Diesel</option></select></label>
      ${CAR_FIELDS.map(([k, l]) => `<label>${l}<input data-cf="${side}:${k}" inputmode="decimal" value="${car[k]}"></label>`).join("")}
      <button class="btn ghost sm" data-reset="${side}" style="margin-top:8px">Reset to example</button>
    </details></div>`;
  const swaps = (side, car, r) => r.swapRows.length ? `<h2 class="sec">Smart swaps · ${esc(car.name)}</h2>${r.swapRows.map(sw => `
    <label class="swap"><input type="checkbox" data-swap="${side}:${sw.id}"${sw.on ? " checked" : ""}><span><b>${esc(sw.name)}</b>
      <span class="save">Saves about ${lakh(sw.saving)} over ${c.years} years (${inr(sw.oem)} → ${inr(sw.alt)}, about ${sw.n.toLocaleString("en-IN", {maximumFractionDigits: 1})} times)</span>
      <span class="pc">✓ ${esc(sw.pros)}</span><span class="pc">✕ ${esc(sw.cons)}</span></span></label>`).join("")}` : "";
  const cheaper = diff > 0 ? B : A, same = Math.abs(diff) < 1000;
  $("cars-body").innerHTML = `
    <div class="verdict"><div class="hs">Over ${c.years} years at ${c.kmYear.toLocaleString("en-IN")} km a year</div>
      <div class="hv">${same ? "They cost about the same" : `${esc(cheaper.name.replace(/ \(.*$/, ""))} costs ${lakh(Math.abs(diff))} less`}</div>
      <div class="hs">${same ? "" : `That is ${inr(Math.abs(diff) / (c.years * 12))} a month`}</div></div>
    <div class="cars-pair">${box("a", A, ra)}${box("b", B, rb)}</div>
    <h2 class="sec">Where the money goes</h2>
    <div class="sm">Car A</div>${bar(ra)}<div class="sm" style="margin-top:8px">Car B</div>${bar(rb)}
    <div class="legend">${CAR_PARTS.map(([, l, col]) => `<span><b style="background:${col}"></b>${l}</span>`).join("")}</div>
    <h2 class="sec">Your use</h2>
    <div class="common">
      <label>Years you will keep it<input data-cc="years" inputmode="numeric" value="${c.years}"></label>
      <label>Km per year<input data-cc="kmYear" inputmode="numeric" value="${c.kmYear}"></label>
      <label>Petrol, ₹ per litre<input data-cc="petrol" inputmode="decimal" value="${c.petrol}"></label>
      <label>Diesel, ₹ per litre<input data-cc="diesel" inputmode="decimal" value="${c.diesel}"></label></div>
    ${swaps("a", A, ra)}${swaps("b", B, rb)}
    <button class="btn ghost wide" id="car-share" style="margin-top:14px">Share this comparison</button>
    <p class="warnbox"><b>These are example figures</b> to show how the sums work, not quotes. Replace them with prices from your dealer, garage and insurer (tap <i>Edit numbers</i>). Swap savings come out of the service and repair budget. Suspension and lighting changes must stay road-legal; tell your insurer about modifications.</p>`;
}
function saveCars() { store.set("cars", carState); renderCars(); }
$("cars-body").addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.car) { const sd = el.dataset.car; carState[sd] = el.value; carState["e" + sd] = {}; carState["p" + sd] = []; buzz(); return saveCars(); }
  if (el.dataset.cf) { const [sd, k] = el.dataset.cf.split(":"), x = k === "fuel" ? el.value : parseFloat(el.value); if (k === "fuel" || isFinite(x)) { carState["e" + sd][k] = x; buzz(); saveCars(); } return; }
  if (el.dataset.cc) { const x = parseFloat(el.value); if (isFinite(x) && x > 0) { carState.common[el.dataset.cc] = el.dataset.cc === "years" ? Math.min(10, Math.max(1, Math.round(x))) : x; buzz(); saveCars(); } return; }
  if (el.dataset.swap) { const [sd, id] = el.dataset.swap.split(":"), list = carState["p" + sd]; carState["p" + sd] = el.checked ? [...list, id] : list.filter(x => x !== id); buzz(el.checked ? "success" : "light"); saveCars(); }
});
$("cars-body").addEventListener("click", async e => {
  const r = e.target.closest("[data-reset]");
  if (r) { carState["e" + r.dataset.reset] = {}; buzz(); saveCars(); return; }
  if (e.target.id !== "car-share") return;
  buzz();
  const c = carState.common, A = carOf("a"), B = carOf("b"), ra = CC.tco(A, c, carState.pa), rb = CC.tco(B, c, carState.pb);
  const text = `Car cost over ${c.years} years (${c.kmYear.toLocaleString("en-IN")} km/yr)\n• ${A.name}: ${lakh(ra.total)} (${inr(ra.perKm)}/km)\n• ${B.name}: ${lakh(rb.total)} (${inr(rb.perKm)}/km)\n\nWorked out with Mechanical Garage`;
  const S = isApp() && plugin("Share");
  try { if (S) await S.share({title: "Car cost", text}); else if (navigator.share) await navigator.share({title: "Car cost", text}); else { await navigator.clipboard.writeText(text); toast("Copied"); } } catch (err) {}
});

/* ============================================================ bottom sheet */
function openSheet(html) {
  $("sheet").innerHTML = `<div class="grab"></div>${html}`;
  $("scrim").hidden = false;
  requestAnimationFrame(() => $("sheet").classList.add("open"));
  $("sheet").setAttribute("aria-hidden", "false");
}
function closeSheet() { $("sheet").classList.remove("open"); $("sheet").setAttribute("aria-hidden", "true"); $("scrim").hidden = true; }
$("scrim").onclick = closeSheet;
document.addEventListener("click", e => { const b = e.target.closest("[data-open=settings]"); if (b) { buzz(); settings(); } });
function settings() {
  const theme = document.documentElement.dataset.theme || "system";
  const pill = (name, val, cur, label) => `<button data-${name}="${val}" aria-pressed="${val === cur}">${label}</button>`;
  openSheet(`<h3>Settings</h3>
    <div class="opt"><span>Units</span><div class="pills">${pill("u", "si", sys, "SI")}${pill("u", "imp", sys, "Imperial")}</div></div>
    <div class="opt"><span>Theme</span><div class="pills">${pill("th", "system", theme, "Auto")}${pill("th", "light", theme, "Light")}${pill("th", "dark", theme, "Dark")}</div></div>
    <div class="opt"><span>Vibration</span><button class="switch" id="s-hap" role="switch" aria-checked="${haptics}" aria-label="Vibration"></button></div>
    <div class="opt"><span>History</span><button class="btn ghost sm" id="s-clear">Clear ${hist.length}</button></div>
    <p class="about">Mechanical Garage · the calculations are MechMate's, checked against hand calculations, published tables and standards. Results are for first sizing; check final designs against codes and supplier data. Everything you save stays on this phone.</p>`);
  const s = $("sheet");
  s.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { buzz(); sys = b.dataset.u; store.set("units", sys); settings(); route(); });
  s.querySelectorAll("[data-th]").forEach(b => b.onclick = () => {
    buzz(); const v = b.dataset.th;
    if (v === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    try { v === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", v); } catch (e) {}
    applyTheme(); settings();
  });
  $("s-hap").onclick = () => { haptics = !haptics; store.set("haptics", haptics); buzz(); settings(); };
  $("s-clear").onclick = () => { buzz("medium"); hist = []; store.set("history", hist); settings(); route(); toast("History cleared"); };
}

/* ============================================================ tool screen */
const isSelect = f => f.type === "select" || f.type === "material" || f.type === "material2";
const optionsOf = (f, v) => typeof f.options === "function" ? f.options(v) : f.type === "material" || f.type === "material2" ? MAT_OPTIONS : f.options;
const INT_LABEL = /teeth|number|holes|people|windows|starts|walls|bolts|quantity|days|hours|cycles|surfaces|years|coils|rivets|welds/i;
function fixSelects(t, v) {
  if (t.fields.some(f => f.type === "material")) v.mat = material;
  t.fields.filter(isSelect).forEach(f => { const o = optionsOf(f, v); if (!o.some(x => String(x[0]) === String(v[f.id]))) v[f.id] = o[0][0]; });
}
const disp = (f, x) => f.q ? +toDisp(f.q, x, sys).toPrecision(6) : x;
function stepOf(f, x) {
  if (Number.isInteger(f.value) && INT_LABEL.test(f.label)) return 1;
  const a = Math.abs(x);
  return a === 0 ? 1 : 10 ** (Math.floor(Math.log10(a)) - 1);
}
function inputsHtml(t, v) {
  return t.fields.map(f => {
    const hidden = f.show && !f.show(v) ? " hidden" : "";
    const u = f.q ? unit(f.q, sys) : "";
    const label = `<div class="l"><span>${sub(f.label)}</span>${u ? `<span class="u">${u}</span>` : ""}</div>`;
    if (isSelect(f)) {
      const opts = optionsOf(f, v);
      if (opts.length <= 3 && opts.every(o => plain(o[1]).length <= 24))
        return `<div class="inp"${hidden}>${label}<div class="pills" data-f="${f.id}">${opts.map(([k, l]) => `<button type="button" data-v="${esc(k)}" aria-pressed="${String(k) === String(v[f.id])}">${esc(plain(l))}</button>`).join("")}</div></div>`;
      return `<div class="inp"${hidden}>${label}<select data-f="${f.id}">${opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v[f.id]) ? " selected" : ""}>${esc(plain(l))}</option>`).join("")}</select></div>`;
    }
    return `<div class="inp"${hidden}>${label}<div class="stepper"><button type="button" data-step="-1" data-f="${f.id}" aria-label="Less">−</button>
      <input data-f="${f.id}" inputmode="decimal" value="${disp(f, v[f.id])}"><button type="button" data-step="1" data-f="${f.id}" aria-label="More">+</button></div></div>`;
  }).join("");
}
let lastHero = null, keepTimer, histTimer;
function openTool(id) {
  const t = tool(id), v = vals[id], el = $("tool");
  const prev = openId;
  openId = id;
  fixSelects(t, v);
  el.className = `tool cat-${t.cat}` + (el.classList.contains("open") ? " open" : "");
  el.style.setProperty("--c", `var(--c-${t.cat})`);
  $("t-cat").textContent = catName(t.cat);
  $("t-name").textContent = t.name;
  $("t-fav").classList.toggle("on", favs.includes(id));
  $("blurb").innerHTML = t.blurb;
  const same = TOOLS.filter(x => x.cat === t.cat);
  $("t-dots").innerHTML = same.length > 1 ? same.map(x => `<i class="${x.id === id ? "on" : ""}"></i>`).join("") : "";
  $("inputs").innerHTML = inputsHtml(t, v);
  lastHero = null;
  $("tscroll").scrollTop = 0;
  update(true);
  el.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => el.classList.add("open"));
  if (prev && prev !== id) { const i = same.findIndex(x => x.id === id), j = same.findIndex(x => x.id === prev); el.classList.add(i > j ? "swipe-l" : "swipe-r"); }
}
function closeTool(silent) {
  if (!openId) return;
  flushHistory();
  $("tool").classList.remove("open"); $("tool").setAttribute("aria-hidden", "true");
  openId = null;
  if (!silent) route();
}
function update(first) {
  const t = tool(openId), v = vals[openId], c = compute(t, v);
  const rows = c.rows || [];
  const hi = heroIndex(t, rows), hero = rows[hi] || ["", "—", "", ""];
  const states = rows.map(x => x[2]);
  const bad = states.filter(s => s === "bad").length, warn = states.filter(s => s === "warn").length, ok = states.filter(s => s === "ok").length;
  const hstate = hero[2] === "bad" || bad ? "bad" : hero[2] === "warn" ? "warn" : "";
  const checks = bad ? `✕ ${bad} problem${bad > 1 ? "s" : ""}` : warn ? `! ${warn} to check` : ok > 1 ? "✓ All checks OK" : "";
  $("hero").className = "hero" + (hstate ? " state-" + hstate : "");
  $("hero").innerHTML = `<div class="hk">${sub(hero[0])}</div><div class="hv" id="hv"></div><div class="hs">${hero[3] ? sub(hero[3]) : ""}</div>${checks ? `<div class="checks">${checks}</div>` : ""}`;
  countUp($("hv"), plain(hero[1]), first);
  $("results").innerHTML = rows.filter((_, i) => i !== hi).map(([k, val, st, s]) => `<li><span class="dot ${st || ""}"></span><div><div class="k">${sub(k)}</div><div class="v">${val}</div>${s ? `<div class="s">${sub(s)}</div>` : ""}</div></li>`).join("");
  $("msg").textContent = c.msg || "";
  const vis = VISUALS[openId];
  $("visual").innerHTML = vis && c.r ? `<div class="vcard">${vis(c.r, v, c.f)}</div>` : (openId === "pattern" && c.extra ? `<div class="vcard">${c.extra}</div>` : "");
  const extra = openId === "pattern" ? "" : c.extra;
  $("calc").hidden = !extra;
  $("extra").innerHTML = extra || "";
  if (!first) {
    clearTimeout(keepTimer); keepTimer = setTimeout(() => { const k = store.get("vals", {}); k[openId] = v; store.set("vals", k); }, 500);
    clearTimeout(histTimer); histTimer = setTimeout(flushHistory, 2500);
    pendingHist = {tool: openId, values: {...v}, hero: [plain(hero[0]), plain(hero[1])], rows: rows.map(x => [plain(x[0]), plain(x[1]), plain(x[3] || "")]), at: Date.now()};
  }
}
let pendingHist = null;
function flushHistory() {
  clearTimeout(histTimer);
  if (!pendingHist) return;
  const h = pendingHist; pendingHist = null;
  if (hist[0] && hist[0].tool === h.tool && h.at - hist[0].at < 120000) hist[0] = h; else hist.unshift(h);
  hist = hist.slice(0, 40);
  store.set("history", hist);
}
// Animate the main number from its previous value to the new one.
function countUp(el, text, first) {
  const m = text.match(/^(.*?)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m || first || lastHero === null || !isFinite(lastHero)) { el.textContent = text; lastHero = m ? parseFloat(m[2].replace(/,/g, "")) : null; return; }
  const to = parseFloat(m[2].replace(/,/g, "")), from = lastHero, dec = (m[2].split(".")[1] || "").length, grp = m[2].includes(",");
  lastHero = to;
  if (from === to) { el.textContent = text; return; }
  $("hero").classList.remove("bump"); void $("hero").offsetWidth; $("hero").classList.add("bump");
  const t0 = performance.now(), dur = 380;
  el.textContent = m[1] + from.toLocaleString("en-US", {minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grp}) + m[3];
  setTimeout(() => { if (el.isConnected && lastHero === to) el.textContent = text; }, dur + 60);   // in case frames are paused
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3, x = from + (to - from) * e;
    el.textContent = m[1] + (k < 1 ? x.toLocaleString("en-US", {minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grp}) : m[2]) + m[3];
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- input events ---------- */
const inputs = $("inputs");
function setNum(fid, displayVal) {
  const t = tool(openId), f = t.fields.find(x => x.id === fid);
  if (!isFinite(displayVal)) return;
  vals[openId][fid] = f.q ? toSI(f.q, displayVal, sys) : displayVal;
  update();
}
inputs.addEventListener("input", e => { const el = e.target; if (el.tagName === "INPUT") setNum(el.dataset.f, parseFloat(el.value)); });
inputs.addEventListener("change", e => {
  const el = e.target; if (el.tagName !== "SELECT") return;
  selectChanged(el.dataset.f, el.value);
});
function selectChanged(fid, value) {
  const t = tool(openId), v = vals[openId], f = t.fields.find(x => x.id === fid);
  v[fid] = value;
  if (f.type === "material") { material = value; store.set("material", material); }
  fixSelects(t, v);
  inputs.innerHTML = inputsHtml(t, v);
  buzz();
  update();
}
let repeat = null;
function stepOnce(btn) {
  const fid = btn.dataset.f, t = tool(openId), f = t.fields.find(x => x.id === fid), el = inputs.querySelector(`input[data-f="${fid}"]`);
  const cur = parseFloat(el.value) || 0, st = stepOf(f, cur) * +btn.dataset.step;
  let next = +(Math.round((cur + st) / Math.abs(st)) * Math.abs(st)).toPrecision(10);
  if (next < 0 && f.value >= 0 && !/angle|temperature|centre|start/i.test(f.label)) next = 0;
  el.value = next;
  buzz();
  setNum(fid, next);
}
inputs.addEventListener("pointerdown", e => {
  const b = e.target.closest("[data-step]");
  if (!b) return;
  e.preventDefault();
  stepOnce(b);
  let delay = 380;
  const go = () => { stepOnce(b); delay = Math.max(60, delay * 0.8); repeat = setTimeout(go, delay); };
  repeat = setTimeout(go, delay);
});
["pointerup", "pointercancel", "pointerleave"].forEach(ev => inputs.addEventListener(ev, () => { clearTimeout(repeat); repeat = null; }));
inputs.addEventListener("click", e => { const b = e.target.closest(".pills button"); if (b) selectChanged(b.parentElement.dataset.f, b.dataset.v); });

/* ---------- header actions and swipe ---------- */
$("t-back").onclick = () => { buzz(); window.history.length > 1 ? window.history.back() : (location.hash = "#tools"); };
$("t-fav").onclick = () => {
  const id = openId, on = !favs.includes(id);
  favs = on ? [id, ...favs] : favs.filter(x => x !== id);
  store.set("favs", favs);
  $("t-fav").classList.toggle("on", on); $("t-fav").classList.remove("pop"); void $("t-fav").offsetWidth; $("t-fav").classList.add("pop");
  buzz(on ? "success" : "light"); toast(on ? "Pinned to your tools" : "Removed from favourites");
};
$("t-share").onclick = () => {
  buzz();
  openSheet(`<h3>Share result</h3>
    <button class="btn primary wide" id="sh-img">Share as image</button>
    <button class="btn ghost wide" id="sh-pdf" style="margin-top:10px">Share as PDF</button>
    <button class="btn ghost wide" id="sh-txt" style="margin-top:10px">Share as text</button>`);
  $("sh-pdf").onclick = async () => {
    closeSheet(); toast("Making the PDF…");
    try {
      const t = tool(openId), c = compute(t, vals[openId]);
      const pdf = await makePdf(t.name, [{name: t.name, tool: t.id, at: Date.now(), drawing: await drawingPng(), rows: c.rows.map(x => [plain(x[0]), plain(x[1]), plain(x[3] || "")])}]);
      await saveFile(`${t.name.replace(/[^\w ]+/g, "").trim()}.pdf`, "application/pdf", pdf);
      buzz("success");
    } catch (e) { toast("Could not make the PDF: " + (e.message || e)); }
  };
  $("sh-img").onclick = async () => {
    closeSheet(); toast("Making the image…");
    try {
      const t = tool(openId), png = await resultCard(t, compute(t, vals[openId]));
      await saveFile(`${t.name.replace(/[^\w ]+/g, "").trim()}.png`, "image/png", png);
      buzz("success");
    } catch (e) { toast("Could not make the image: " + (e.message || e)); }
  };
  $("sh-txt").onclick = async () => {
    closeSheet();
    const t = tool(openId), c = compute(t, vals[openId]);
    const text = `${t.name}\n` + c.rows.map(r => `• ${plain(r[0])}: ${plain(r[1])}`).join("\n") + `\n\nWorked out with Mechanical Garage`;
    const S = isApp() && plugin("Share");
    try {
      if (S) await S.share({title: t.name, text, dialogTitle: "Share result"});
      else if (navigator.share) await navigator.share({title: t.name, text});
      else { await navigator.clipboard.writeText(text); toast("Result copied"); }
    } catch (e) {}
  };
};

/* ---------- result image card ---------- */
// Copy each drawn SVG element's computed colours, sizes and current spin into inline styles,
// so the drawing still looks right when rasterised outside the page.
function inlineSvg(svg) {
  const clone = svg.cloneNode(true), live = [svg, ...svg.querySelectorAll("*")], copy = [clone, ...clone.querySelectorAll("*")];
  live.forEach((el, i) => {
    const cs = getComputedStyle(el), s = copy[i].style;
    for (const p of ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-family", "font-size", "font-weight", "transform", "transform-origin", "transform-box"]) s.setProperty(p, cs.getPropertyValue(p));
    s.setProperty("animation", "none"); s.setProperty("transition", "none");
  });
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", vb.width * 3); clone.setAttribute("height", vb.height * 3);
  return {src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone)), w: vb.width, h: vb.height};
}
const loadImg = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("drawing")); i.src = src; });
function wrap(ctx, text, x, y, maxW, lh, maxLines = 3) {
  const words = String(text).split(/\s+/); let line = "", n = 0;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) break; }
    else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
async function resultCard(t, c) {
  await document.fonts.ready;
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const accent = getComputedStyle($("hero")).backgroundImage.match(/rgba?\([^)]+\)/)?.[0] || "#c9481a";
  const rows = c.rows || [], hi = heroIndex(t, rows), hero = rows[hi] || ["", "—"];
  // background
  ctx.fillStyle = "#f4f1ea"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 560); g.addColorStop(0, accent); g.addColorStop(1, "#1b1e22");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(40, 40, W - 80, 560, 48); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.beginPath(); ctx.arc(W - 120, 520, 260, 0, Math.PI * 2); ctx.fill();
  // brand
  ctx.fillStyle = "#fff"; ctx.font = '600 30px "IBM Plex Sans", sans-serif'; ctx.fillText("⚙  MECHANICAL GARAGE", 90, 120);
  ctx.globalAlpha = .8; ctx.font = '500 28px "IBM Plex Mono", monospace'; ctx.fillText(catName(t.cat).toUpperCase(), 90, 185); ctx.globalAlpha = 1;
  ctx.font = '400 64px "Instrument Serif", serif'; wrap(ctx, t.name, 90, 255, W - 180, 70, 2);
  ctx.globalAlpha = .9; ctx.font = '500 32px "IBM Plex Sans", sans-serif'; ctx.fillText(plain(hero[0]), 90, 380); ctx.globalAlpha = 1;
  let size = 150; ctx.font = `400 ${size}px "Instrument Serif", serif`;
  while (ctx.measureText(plain(hero[1])).width > W - 180 && size > 60) { size -= 8; ctx.font = `400 ${size}px "Instrument Serif", serif`; }
  ctx.fillText(plain(hero[1]), 86, 380 + size * 0.95);
  if (hero[3]) { ctx.globalAlpha = .85; ctx.font = '400 28px "IBM Plex Sans", sans-serif'; wrap(ctx, plain(hero[3]), 90, 560, W - 180, 36, 1); ctx.globalAlpha = 1; }
  // drawing
  let y = 650;
  const svg = $("visual").querySelector("svg");
  if (svg) {
    const {src, w, h} = inlineSvg(svg), img = await loadImg(src);
    const dw = W - 160, dh = Math.min(380, dw * h / w);
    ctx.fillStyle = "#fffdf8"; ctx.beginPath(); ctx.roundRect(40, y - 10, W - 80, dh + 40, 36); ctx.fill();
    const scale = Math.min(dw / w, 380 / h);
    ctx.drawImage(img, (W - w * scale) / 2, y + 10, w * scale, h * scale);
    y += dh + 70;
  }
  // key numbers
  ctx.fillStyle = "#1b1e22";
  const others = rows.filter((_, i) => i !== hi).slice(0, svg ? 3 : 6);
  for (const [k, v] of others) {
    if (y > H - 170) break;
    ctx.font = '400 28px "IBM Plex Sans", sans-serif'; ctx.fillStyle = "#636a72"; ctx.fillText(plain(k), 90, y);
    ctx.font = '500 38px "IBM Plex Mono", monospace'; ctx.fillStyle = "#1b1e22"; wrap(ctx, plain(v), 90, y + 48, W - 180, 44, 1);
    y += 112;
  }
  // footer
  ctx.fillStyle = "#636a72"; ctx.font = '400 26px "IBM Plex Sans", sans-serif';
  ctx.fillText("Worked out with the Mechanical Garage app", 90, H - 70);
  ctx.textAlign = "right"; ctx.fillText(new Date().toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"}), W - 90, H - 70);
  return cv.toDataURL("image/png");
}
$("t-save").onclick = () => {
  buzz();
  openSheet(`<h3>Save to workshop</h3><label>Name<input id="sv-name" type="text" value="${esc(tool(openId).name)}" maxlength="60"></label><button class="btn primary wide" id="sv-ok">Save</button>`);
  setTimeout(() => { $("sv-name").focus(); $("sv-name").select(); }, 250);
  $("sv-ok").onclick = () => {
    const t = tool(openId), v = vals[openId], c = compute(t, v), hero = c.rows[heroIndex(t, c.rows)] || ["", ""];
    saved.unshift({name: $("sv-name").value.trim() || t.name, tool: openId, values: {...v}, hero: [plain(hero[0]), plain(hero[1])], rows: c.rows.map(x => [plain(x[0]), plain(x[1]), plain(x[3] || "")]), at: Date.now()});
    store.set("saved", saved);
    closeSheet(); buzz("success"); toast("Saved to your workshop");
  };
};
let sx = null, sy = 0;
$("tool").addEventListener("touchstart", e => { if (e.target.closest("input,select,.stepper,.pills,.calc")) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive: true});
$("tool").addEventListener("touchend", e => {
  if (sx === null || !openId) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  sx = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
  const t = tool(openId), same = TOOLS.filter(x => x.cat === t.cat), i = same.findIndex(x => x.id === openId);
  const next = same[(i + (dx < 0 ? 1 : -1) + same.length) % same.length];
  if (next.id === openId) return;
  buzz();
  flushHistory();
  window.history.replaceState(null, "", "#tool/" + next.id);
  $("tool").classList.remove("swipe-l", "swipe-r"); void $("tool").offsetWidth;
  openTool(next.id);
});
document.addEventListener("click", e => { const a = e.target.closest("a.tile"); if (a) buzz(); });

/* ============================================================ live visuals */
const VISUALS = {
  beam(r, v, f) {
    const W = 320, H = 150, x0 = 34, x1 = 286, y0 = 62, span = x1 - x0;
    const amp = Math.min(46, Math.max(3, 6000 / Math.max(r.ratio, 1)));
    const shape = {
      "cant:end": x => x * x * (3 - x) / 2, "cant:pointA": x => x * x * (3 - x) / 2, "cant:udl": x => (x ** 4 - 4 * x ** 3 + 6 * x * x) / 3, "cant:moment": x => x * x,
      "ss:centre": x => Math.sin(Math.PI * x), "ss:pointA": x => Math.sin(Math.PI * x), "ss:udl": x => Math.sin(Math.PI * x), "ss:moment": x => Math.sin(Math.PI * x),
      "ff:centre": x => Math.sin(Math.PI * x) ** 2, "ff:udl": x => Math.sin(Math.PI * x) ** 2
    }[v.support + ":" + v.load] || (x => Math.sin(Math.PI * x));
    const pts = [...Array(41)].map((_, i) => { const x = i / 40; return `${(x0 + span * x).toFixed(1)},${(y0 + amp * shape(x)).toFixed(1)}`; });
    const col = r.n === null ? "var(--c)" : r.n >= 2 ? "var(--ok)" : r.n >= 1 ? "var(--warn)" : "var(--bad)";
    const wall = x => `<path d="M${x} ${y0 - 26}v52" stroke="var(--ink)" stroke-width="3"/>${[...Array(6)].map((_, i) => `<path d="M${x} ${y0 - 22 + i * 9}l${x < W / 2 ? -9 : 9} 7" stroke="var(--muted)"/>`).join("")}`;
    const pin = x => `<path d="M${x} ${y0 + 2}l-9 15h18z" fill="var(--surface-2)" stroke="var(--ink)"/>`;
    const sup = v.support === "cant" ? wall(x0) : v.support === "ff" ? wall(x0) + wall(x1) : pin(x0) + pin(x1);
    const at = v.load === "end" ? 1 : v.load === "centre" ? 0.5 : v.load === "pointA" ? Math.min(1, v.a / v.L) : null;
    let load = "";
    if (at !== null) { const x = x0 + span * at, y = y0 + amp * shape(at); load = `<path d="M${x} ${y - 46}v38" stroke="var(--c)" stroke-width="2.4"/><path d="M${x - 6} ${y - 15}l6 9 6-9" stroke="var(--c)" stroke-width="2.4"/><text x="${x}" y="${y - 50}" text-anchor="middle" class="lbl">${f(v.P, "force", 3)}</text>`; }
    else if (v.load === "udl") load = [...Array(9)].map((_, i) => { const x = x0 + span * i / 8, y = y0 + amp * shape(i / 8); return `<path d="M${x} ${y - 28}v20M${x - 4} ${y - 13}l4 6 4-6" stroke="var(--c)" stroke-width="1.8"/>`; }).join("") + `<path d="M${x0} ${y0 - 28 + amp * shape(0)}H${x1}" stroke="var(--c)" stroke-width="1.8"/><text x="${W / 2}" y="${y0 - 34}" text-anchor="middle" class="lbl">${f(v.w, "lineLoad", 3)}</text>`;
    else load = `<path d="M${v.support === "cant" ? x1 - 14 : x0 + 2} ${y0 - 22}a16 16 0 1 1 22 0" stroke="var(--c)" stroke-width="2.2"/><text x="${v.support === "cant" ? x1 : x0 + 14}" y="${y0 - 38}" text-anchor="middle" class="lbl">${f(v.M0, "torque", 3)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deflected beam">
      <path d="M${x0} ${y0}H${x1}" stroke="var(--rule-strong)" stroke-dasharray="4 4"/>
      <polyline class="beam-curve" points="${pts.join(" ")}" stroke="${col}" stroke-width="9" stroke-linecap="round"/>
      ${sup}${load}
      <text x="${W / 2}" y="${H - 8}" text-anchor="middle">deflection drawn ×${f.n(amp / Math.max(r.dmax, 1e-9) * (v.L / span), 2)} · L/${f.n(r.ratio, 3)}</text></svg>`;
  },
  gear(r, v, f) {
    const g = r.stages[0];
    if (!g) return "";
    const R1 = 26 + 50 * g.a / (g.a + g.b), R2 = 26 + 50 * g.b / (g.a + g.b), cx1 = 30 + R1, cx2 = cx1 + R1 + R2 - 4, cy = 74;
    const t1 = 2.4, t2 = t1 * g.ratio;
    const gearPath = (cx, R, z) => { const n = Math.min(z, 48), pts = []; for (let k = 0; k < n * 4; k++) { const a = 2 * Math.PI * k / (n * 4), rr = k % 4 < 2 ? R : R - 6; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); } return pts.join(" "); };
    const one = (cx, R, z, t, rev, col) => `<g class="spin${rev ? " rev" : ""}" style="--t:${Math.min(t, 40).toFixed(2)}s"><polygon points="${gearPath(cx, R, z)}" fill="color-mix(in srgb,${col} 22%,var(--surface))" stroke="${col}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="${R * 0.25}" fill="var(--surface)" stroke="${col}"/><path d="M${cx} ${cy - R * 0.25}V${cy - R + 8}" stroke="${col}" stroke-width="2.4"/></g>`;
    return `<svg viewBox="0 0 320 160" role="img" aria-label="Gears turning at their speed ratio">
      ${one(cx1, R1, g.a, t1, false, "var(--c)")}${one(Math.min(cx2, 300 - R2), R2, g.b, t2, true, "var(--muted)")}
      <text x="${cx1}" y="${cy + R1 + 16}" text-anchor="middle" class="lbl">${g.a}T · ${f.n(v.nin)} rpm</text>
      <text x="${Math.min(cx2, 300 - R2)}" y="${Math.min(cy + R2 + 16, 156)}" text-anchor="middle" class="lbl">${g.b}T · ${f.n(v.nin / g.ratio)} rpm</text></svg>`;
  },
  belt(r, v, f) {
    const k = 110 / Math.max(v.D1, v.D2), R1 = Math.max(10, v.D1 / 2 * k), R2 = Math.max(10, v.D2 / 2 * k), cx1 = 24 + R1, cx2 = 296 - R2, cy = 72;
    const one = (cx, R, t, col) => `<g class="spin" style="--t:${Math.min(t, 40).toFixed(2)}s"><circle cx="${cx}" cy="${cy}" r="${R}" fill="color-mix(in srgb,${col} 18%,var(--surface))" stroke="${col}" stroke-width="2"/>${[0, 60, 120].map(a => `<path d="M${cx + R * 0.85 * Math.cos(a * Math.PI / 180)} ${cy + R * 0.85 * Math.sin(a * Math.PI / 180)}L${cx - R * 0.85 * Math.cos(a * Math.PI / 180)} ${cy - R * 0.85 * Math.sin(a * Math.PI / 180)}" stroke="${col}"/>`).join("")}</g>`;
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Belt drive">
      <path d="M${cx1} ${cy - R1 - 3}L${cx2} ${cy - R2 - 3}M${cx1} ${cy + R1 + 3}L${cx2} ${cy + R2 + 3}" stroke="var(--ink)" stroke-width="4"/>
      ${one(cx1, R1, 2, "var(--c)")}${one(cx2, R2, 2 * r.ratio, "var(--muted)")}
      <text x="160" y="144" text-anchor="middle" class="lbl">${f.n(v.n1)} → ${f.n(r.n2)} rpm · wrap ${f.n(r.wrap * 180 / Math.PI, 3)}°</text></svg>`;
  },
  ac(r, v, f) {
    const max = 3.5, ang = Math.min(r.rated / max, 1) * 180, cx = 160, cy = 112, R = 86;
    const arc = (a0, a1, col, w) => { const p = a => [cx - R * Math.cos(a * Math.PI / 180), cy - R * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `<path d="M${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}" stroke="${col}" stroke-width="${w}"/>`; };
    const ticks = [0.75, 1, 1.5, 2, 2.5, 3].map(s => { const a = s / max * 180, c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
      return `<path d="M${cx - (R - 14) * c} ${cy - (R - 14) * sn}L${cx - (R + 4) * c} ${cy - (R + 4) * sn}" stroke="${s === r.size ? "var(--c)" : "var(--rule-strong)"}" stroke-width="${s === r.size ? 3 : 1.5}"/><text x="${cx - (R + 16) * c}" y="${cy - (R + 16) * sn + 3}" text-anchor="middle" class="lbl">${s}</text>`; }).join("");
    const e3 = r.e3, e5 = r.e5, w3 = 200, w5 = 200 * e5 / e3;
    return `<svg viewBox="0 0 320 210" role="img" aria-label="AC size gauge and running cost">
      ${arc(0, 180, "var(--surface-2)", 14)}${arc(0, Math.max(ang, 1), "var(--c)", 14)}${ticks}
      <g class="needle" style="transform:rotate(${ang}deg);transform-origin:${cx}px ${cy}px"><path d="M${cx} ${cy}L${cx - R + 22} ${cy}" stroke="var(--ink)" stroke-width="3"/></g>
      <circle cx="${cx}" cy="${cy}" r="6" fill="var(--ink)"/>
      <text x="${cx}" y="${cy + 22}" text-anchor="middle" class="lbl">${f.n(r.rated, 3)} TR needed (ton)</text>
      <text x="20" y="160" class="lbl">3★</text><rect class="bar" x="44" y="150" height="13" rx="6" width="${w3}" fill="var(--warn)"/><text x="${50 + w3}" y="160" class="lbl">₹${Math.round(e3 * v.tariff).toLocaleString("en-US")}/yr</text>
      <text x="20" y="186" class="lbl">5★</text><rect class="bar" x="44" y="176" height="13" rx="6" width="${w5}" fill="var(--ok)"/><text x="${50 + w5}" y="186" class="lbl">₹${Math.round(e5 * v.tariff).toLocaleString("en-US")}/yr</text></svg>`;
  },
  bolt(r, v, f) {
    const X = v => 20 + 280 * Math.min(v / r.Fy, 1.05);
    const mark = (val, lbl, y, col) => `<path d="M${X(val)} 40V${y}" stroke="${col}" stroke-width="2"/><text x="${X(val)}" y="${y + 12}" text-anchor="middle" class="lbl">${lbl}</text>`;
    return `<svg viewBox="0 0 320 110" role="img" aria-label="Bolt load against yield">
      <rect x="20" y="24" width="280" height="16" rx="8" fill="var(--surface-2)"/>
      <rect class="bar" x="20" y="24" height="16" rx="8" width="${Math.max(0, X(r.FMmin) - 20)}" fill="color-mix(in srgb,var(--c) 45%,transparent)"/>
      <rect class="bar" x="20" y="24" height="16" rx="8" width="${Math.max(0, X(r.Fmax) - 20)}" fill="none" stroke="var(--c)" stroke-width="2"/>
      <text x="20" y="16" class="lbl">0</text><text x="300" y="16" text-anchor="end" class="lbl">yield ${f(r.Fy, "force", 3)}</text>
      ${mark(r.FMmin, "min preload", 62, "var(--muted)")}${mark(r.FM, "preload", 82, "var(--c)")}${mark(r.Fmax, "max in service", 102, r.Fmax <= r.Fy ? "var(--ok)" : "var(--bad)")}</svg>`;
  },
  power(r, v, f) {
    const t = Math.min(40, Math.max(0.25, 1440 / Math.max(r.n, 1) * 1.2));
    return `<svg viewBox="0 0 320 130" role="img" aria-label="Spinning shaft">
      <g class="spin" style="--t:${t.toFixed(2)}s"><circle cx="70" cy="64" r="44" fill="color-mix(in srgb,var(--c) 15%,var(--surface))" stroke="var(--c)" stroke-width="2"/>
      ${[0, 90, 180, 270].map(a => `<circle cx="${70 + 30 * Math.cos(a * Math.PI / 180)}" cy="${64 + 30 * Math.sin(a * Math.PI / 180)}" r="5" fill="var(--c)"/>`).join("")}<circle cx="70" cy="64" r="8" fill="var(--ink)"/></g>
      <text x="140" y="44" class="lbl" style="font-size:13px">${f(r.P, "power", 3)}</text>
      <text x="140" y="68" class="lbl" style="font-size:13px">${f(r.T, "torque", 3)}</text>
      <text x="140" y="92" class="lbl" style="font-size:13px">${f.n(r.n)} rpm</text></svg>`;
  },
  chain(r, v, f) {
    const k = 120 / Math.max(r.d1, r.d2), R1 = Math.max(14, r.d1 / 2 * k), R2 = Math.max(14, r.d2 / 2 * k), cx1 = 26 + R1, cx2 = 294 - R2, cy = 74;
    const sprocket = (cx, R, z) => { const n = Math.min(z, 48), pts = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n, rr = i % 2 ? R - 5 : R + 2; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); } return pts.join(" "); };
    const one = (cx, R, z, t, col) => `<g class="spin" style="--t:${Math.min(t, 40).toFixed(2)}s"><polygon points="${sprocket(cx, R, z)}" fill="color-mix(in srgb,${col} 18%,var(--surface))" stroke="${col}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${R * 0.3}" fill="var(--surface)" stroke="${col}"/></g>`;
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Chain drive">
      <path class="flow" d="M${cx1} ${cy - R1 - 2}L${cx2} ${cy - R2 - 2}" stroke="var(--ink)" stroke-width="5" style="--t:.6s"/>
      <path class="flow" d="M${cx2} ${cy + R2 + 2}L${cx1} ${cy + R1 + 2}" stroke="var(--ink)" stroke-width="5" style="--t:.6s"/>
      ${one(cx1, R1, r.z1, 2, "var(--c)")}${one(cx2, R2, r.z2, 2 * r.ratio, "var(--muted)")}
      <text x="160" y="146" text-anchor="middle" class="lbl">${r.z1}T → ${r.z2}T · ${r.Lp} pitches · pull ${f(r.F, "force", 3)}</text></svg>`;
  },
  screw(r, v, f) {
    const threads = [...Array(26)].map((_, i) => `<path d="M${30 + i * 10} 52l6 26" stroke="var(--muted)" stroke-width="1.4"/>`).join("");
    const t = Math.min(8, Math.max(1.2, 60 / Math.max(r.rpm, 1) * 4));
    return `<svg viewBox="0 0 320 140" role="img" aria-label="Lead screw and nut">
      <rect x="24" y="52" width="272" height="26" rx="5" fill="var(--surface-2)" stroke="var(--rule-strong)"/>${threads}
      <g class="slide" style="--t:${t.toFixed(2)}s;--dx:150px"><rect x="54" y="40" width="64" height="50" rx="9" fill="color-mix(in srgb,var(--c) 30%,var(--surface))" stroke="var(--c)" stroke-width="2"/>
      <path d="M86 18v18M80 30l6 8 6-8" stroke="var(--c)" stroke-width="2.2"/><text x="86" y="14" text-anchor="middle" class="lbl">${f(v.F, "force", 3)}</text></g>
      <text x="160" y="112" text-anchor="middle" class="lbl">${f(r.Traise, "torqueS", 3)} to drive · ${f.n(r.eff * 100, 3)}% efficient</text>
      <text x="160" y="130" text-anchor="middle" class="lbl" style="fill:${r.lock ? "var(--ok)" : "var(--warn)"}">${r.lock ? "Self-locking: holds the load" : "Not self-locking: needs a brake"}</text></svg>`;
  },
  motor(r, v, f) {
    const W = 320, H = 176, x0 = 44, x1 = 306, T = [r.Ta, r.Tc, r.Td, r.Th];
    const hi = Math.max(...T, r.rms) * 1.12 || 1, lo = Math.min(0, ...T) * 1.12, ys = q => 16 + (hi - q) / (hi - lo) * 96, yZ = ys(0);
    const cyc = 2 * v.ta + v.tc + v.tdw, sx = t => x0 + (x1 - x0) * t / cyc;
    const seg = [[0, v.ta, r.Ta], [v.ta, v.ta + v.tc, r.Tc], [v.ta + v.tc, 2 * v.ta + v.tc, r.Td], [2 * v.ta + v.tc, cyc, r.Th]];
    let d = `M${sx(0)} ${yZ}`; seg.forEach(([a, b, q]) => { d += `L${sx(a)} ${ys(q)}L${sx(b)} ${ys(q)}`; }); d += `L${sx(cyc)} ${yZ}`;
    const sb = 150, st = 128, speed = `M${sx(0)} ${sb}L${sx(v.ta)} ${st}L${sx(v.ta + v.tc)} ${st}L${sx(2 * v.ta + v.tc)} ${sb}L${sx(cyc)} ${sb}`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Motor torque over one move">
      <path d="M${x0} 14V114M${x0} ${yZ}H${x1}" stroke="var(--rule-strong)"/>
      <path d="${d}" fill="color-mix(in srgb,var(--c) 18%,transparent)" stroke="var(--c)" stroke-width="2.2"/>
      <path d="M${x0} ${ys(r.rms)}H${x1}" stroke="var(--ink)" stroke-dasharray="5 4"/><text x="${x1}" y="${ys(r.rms) - 4}" text-anchor="end" class="lbl">RMS ${f(r.rms, "torqueS", 3)}</text>
      <text x="${sx(v.ta) + 4}" y="${ys(r.Ta) + 10}" class="lbl">peak ${f(r.peak, "torqueS", 3)}</text>
      <text x="${x0 - 4}" y="22" text-anchor="end">torque</text><text x="${x0 - 4}" y="${yZ + 3}" text-anchor="end">0</text>
      <path d="${speed}" stroke="var(--muted)" stroke-width="1.6"/><text x="${x0 - 4}" y="${st + 8}" text-anchor="end">speed</text>
      <text x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">accelerate · run · brake · dwell (${f.n(cyc, 2)} s cycle)</text></svg>`;
  },
  pressfit(r, v, f) {
    if (r.err) return "";
    const cx = 160, cy = 78, Ro = 64, Ri = Ro * v.D / v.Do, Rb = v.di > 0 ? Ri * v.di / v.D : 0;
    const util = r.nHub ? 1 / r.nHub : 0, col = util < 0.67 ? "var(--ok)" : util < 1 ? "var(--warn)" : "var(--bad)";
    const arrows = [...Array(8)].map((_, i) => { const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      return `<path d="M${cx + (Ri + 12) * c} ${cy + (Ri + 12) * s}L${cx + (Ri + 3) * c} ${cy + (Ri + 3) * s}" stroke="var(--ink)" stroke-width="1.8"/>`; }).join("");
    return `<svg viewBox="0 0 320 170" role="img" aria-label="Hub on shaft with contact pressure">
      <circle cx="${cx}" cy="${cy}" r="${(Ro + Ri) / 2}" fill="none" stroke="color-mix(in srgb,${col} 55%,var(--surface))" stroke-width="${Ro - Ri}"/>
      <circle cx="${cx}" cy="${cy}" r="${Ri}" fill="color-mix(in srgb,var(--muted) 25%,var(--surface))" stroke="var(--muted)"/>
      ${Rb ? `<circle cx="${cx}" cy="${cy}" r="${Rb}" fill="var(--bg)" stroke="var(--muted)"/>` : ""}${arrows}
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="lbl">${f(r.pMax, "stress", 3)}</text>
      <text x="160" y="160" text-anchor="middle" class="lbl">Hub stress ${f(r.vmHub, "stress", 3)} · ${r.nHub ? f.n(util * 100, 2) + "% of yield" : "brittle hub"} · holds ${f(r.torque, "torque", 3)}</text></svg>`;
  },
  bearing(r, v, f) {
    const cx = 70, cy = 70, ratio = Math.min(r.Lh / v.Lt, 2), col = ratio >= 1 ? "var(--ok)" : "var(--bad)";
    const balls = [...Array(9)].map((_, i) => { const a = i * 2 * Math.PI / 9; return `<circle cx="${cx + 38 * Math.cos(a)}" cy="${cy + 38 * Math.sin(a)}" r="8.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>`; }).join("");
    const t = Math.min(20, Math.max(0.6, 1500 / Math.max(v.n, 1) * 1.6));
    return `<svg viewBox="0 0 320 140" role="img" aria-label="Bearing and its life against the target">
      <circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="var(--c)" stroke-width="8"/><g class="spin" style="--t:${(t * 2.4).toFixed(2)}s">${balls}</g>
      <g class="spin" style="--t:${t.toFixed(2)}s"><circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="var(--c)" stroke-width="6"/><path d="M${cx} ${cy - 24}v6" stroke="var(--ink)" stroke-width="2"/></g>
      <text x="150" y="40" class="lbl">Life ${f.n(r.Lh)} h</text>
      <rect x="150" y="50" width="150" height="14" rx="7" fill="var(--surface-2)"/><rect class="bar" x="150" y="50" height="14" rx="7" width="${75 * ratio}" fill="${col}"/>
      <path d="M225 44v26" stroke="var(--ink)" stroke-width="2"/><text x="225" y="84" text-anchor="middle">target ${f.n(v.Lt)} h</text>
      <text x="150" y="112" class="lbl">P = ${f(r.P, "force", 3)} · s₀ = ${f.n(r.s0, 3)}</text></svg>`;
  },
  cylinder(r, v, f) {
    const L = 170, strokePx = Math.min(110, 60 + v.stroke / 10), bore = 20 + Math.min(40, v.D / 3), rod = Math.max(5, bore * v.d / v.D), cy = 66;
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Cylinder extending and retracting">
      <rect x="20" y="${cy - bore / 2}" width="${L}" height="${bore}" rx="6" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.6"/>
      <g class="slide" style="--t:1.6s;--dx:${(strokePx * 0.75).toFixed(0)}px">
        <rect x="${40}" y="${cy - bore / 2 + 3}" width="16" height="${bore - 6}" rx="3" fill="var(--c)"/>
        <rect x="56" y="${cy - rod / 2}" width="${L + 20}" height="${rod}" rx="${rod / 2}" fill="color-mix(in srgb,var(--c) 30%,var(--surface))" stroke="var(--c)" stroke-width="1.4"/>
        <circle cx="${56 + L + 20}" cy="${cy}" r="${rod * 0.8}" fill="var(--surface)" stroke="var(--c)" stroke-width="2"/></g>
      <text x="20" y="${cy + bore / 2 + 22}" class="lbl">Push ${f(r.Fext, "force", 3)} · pull ${f(r.Fret, "force", 3)}</text>
      <text x="20" y="${cy + bore / 2 + 40}" class="lbl" style="fill:${r.sf >= 3.5 ? "var(--ok)" : "var(--bad)"}">Rod buckling safety ${f.n(r.sf, 3)}×</text></svg>`;
  },
  feeds(r, v, f) {
    const cx = 80, cy = 72, t = Math.min(10, Math.max(0.15, 600 / Math.max(r.n, 1)));
    const body = v.op === "turn"
      ? `<g class="spin" style="--t:${t.toFixed(2)}s"><circle cx="${cx}" cy="${cy}" r="46" fill="color-mix(in srgb,var(--muted) 25%,var(--surface))" stroke="var(--ink)" stroke-width="1.6"/>${[0, 120, 240].map(a => `<rect x="${cx - 7}" y="${cy - 54}" width="14" height="20" rx="3" fill="var(--ink)" transform="rotate(${a} ${cx} ${cy})"/>`).join("")}<circle cx="${cx}" cy="${cy}" r="18" fill="var(--c)"/></g>
         <path d="M${cx + 20} ${cy + 30}l46 -8 v22z" fill="var(--c)" stroke="var(--ink)"/>`
      : `<g class="spin" style="--t:${t.toFixed(2)}s">${[...Array(v.op === "mill" ? Math.min(8, Math.round(v.z) || 4) : 2)].map((_, i, a) => `<path d="M${cx} ${cy}L${cx + 44 * Math.cos(i * 2 * Math.PI / a.length)} ${cy + 44 * Math.sin(i * 2 * Math.PI / a.length)}" stroke="var(--c)" stroke-width="9" stroke-linecap="round"/>`).join("")}<circle cx="${cx}" cy="${cy}" r="14" fill="var(--ink)"/></g>`;
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Spindle turning">
      ${body}
      <text x="170" y="40" class="lbl" style="font-size:13px">${f.n(r.n)} rpm</text>
      <text x="170" y="62" class="lbl">feed ${f(r.vf, "feedRate", 3)}</text>
      <text x="170" y="82" class="lbl">${f(r.Pc, "power", 3)} at the spindle</text>
      <text x="170" y="102" class="lbl">${f(r.Q, "mrr", 3)} removed</text></svg>`;
  },
  bend(r, v, f) {
    const s = 120 / Math.max(v.A, v.B, 1), a = Math.PI - v.ang * Math.PI / 180, R = Math.max(3, v.R * s), T = Math.max(3, v.T * s);
    const ox = 60, oy = 100, A = Math.max(10, v.A * s - R - T), B = Math.max(10, v.B * s - R - T);
    // flange A along +x from the bend; flange B turned by the bend angle
    const bx = ox + A, by = oy, cxr = bx, cyr = by - R - T / 2;
    const dir = [Math.cos(-Math.PI / 2 + (Math.PI - a)), Math.sin(-Math.PI / 2 + (Math.PI - a))];
    const ang0 = Math.PI / 2, ang1 = Math.PI / 2 - (Math.PI - a), rm = R + T / 2;
    const ex = cxr + rm * Math.cos(ang1), ey = cyr + rm * Math.sin(ang1);
    const path = `M${ox} ${oy - T / 2}L${bx} ${by - T / 2}A${rm} ${rm} 0 0 0 ${ex} ${ey}L${ex + B * Math.cos(ang1 - Math.PI / 2)} ${ey + B * Math.sin(ang1 - Math.PI / 2)}`;
    const flat = 280 * Math.min(1, r.flat / (v.A + v.B));
    return `<svg viewBox="0 0 320 170" role="img" aria-label="Bent sheet and its flat length">
      <path d="${path}" stroke="var(--c)" stroke-width="${T}" stroke-linecap="butt"/>
      <text x="${ox}" y="${oy + 20}" class="lbl">A ${f(v.A, "len", 3)}</text>
      <rect x="20" y="138" width="${flat}" height="10" rx="2" fill="color-mix(in srgb,var(--c) 35%,var(--surface))" stroke="var(--c)"/>
      <path d="M${20 + flat * v.A / (v.A + v.B) - r.BA * flat / r.flat / 2} 134v18M${20 + flat * v.A / (v.A + v.B) + r.BA * flat / r.flat / 2} 134v18" stroke="var(--ink)" stroke-dasharray="2 2"/>
      <text x="20" y="166" class="lbl">Flat length ${f(r.flat, "len", 4)} · K ${f.n(r.K, 3)}</text></svg>`;
  },
  weight(r, v, f) {
    const cx = 80, cy = 74, big = {round: v.d, hex: v.s * 1.155, rect: Math.max(v.b, v.h), tube: v.D, rhs: Math.max(v.B, v.H), angle: v.a}[v.shape] || 1, k = 100 / big;
    const col = "color-mix(in srgb,var(--c) 35%,var(--surface))";
    let shape = "";
    if (v.shape === "round") shape = `<circle cx="${cx}" cy="${cy}" r="${v.d * k / 2}" fill="${col}" stroke="var(--c)" stroke-width="2"/>`;
    else if (v.shape === "hex") { const R = v.s * 1.155 * k / 2; shape = `<polygon points="${[...Array(6)].map((_, i) => `${cx + R * Math.cos(i * Math.PI / 3)},${cy + R * Math.sin(i * Math.PI / 3)}`).join(" ")}" fill="${col}" stroke="var(--c)" stroke-width="2"/>`; }
    else if (v.shape === "rect") shape = `<rect x="${cx - v.b * k / 2}" y="${cy - v.h * k / 2}" width="${v.b * k}" height="${Math.max(2, v.h * k)}" fill="${col}" stroke="var(--c)" stroke-width="2"/>`;
    else if (v.shape === "tube") shape = `<circle cx="${cx}" cy="${cy}" r="${(v.D - v.t) * k / 2}" fill="none" stroke="var(--c)" stroke-width="${Math.max(2, v.t * k)}"/>`;
    else if (v.shape === "rhs") shape = `<rect x="${cx - (v.B - v.t) * k / 2}" y="${cy - (v.H - v.t) * k / 2}" width="${(v.B - v.t) * k}" height="${(v.H - v.t) * k}" fill="none" stroke="var(--c)" stroke-width="${Math.max(2, v.t * k)}"/>`;
    else shape = `<path d="M${cx - 50} ${cy - 50}V${cy + 50}H${cx + 50}" fill="none" stroke="var(--c)" stroke-width="${Math.max(2, v.t * k)}" stroke-linejoin="miter"/>`;
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Cross-section to scale">
      ${shape}
      <text x="170" y="52" class="lbl" style="font-size:16px">${f(r.each, "mass", 4)}</text>
      <text x="170" y="74" class="lbl">${f(r.perM, "massLen", 3)}</text>
      <text x="170" y="94" class="lbl">section ${f(r.A, "area", 3)}</text></svg>`;
  },
  fits(r, v, f) {
    if (r.err) return "";
    const vals = [r.hu, r.hl, r.su, r.sl, 0], top = Math.max(...vals), bot = Math.min(...vals), span = Math.max(top - bot, 1);
    const y = um => 20 + (top - um) / span * 100, z = y(0);
    const box = (x, hi, lo, col, lbl) => `<rect x="${x}" y="${y(hi)}" width="70" height="${Math.max(2, y(lo) - y(hi))}" rx="4" fill="color-mix(in srgb,${col} 30%,var(--surface))" stroke="${col}" stroke-width="1.8"/><text x="${x + 35}" y="${y(hi) - 4}" text-anchor="middle" class="lbl">${lbl}</text>`;
    const kind = r.cMin >= 0 ? "Clearance" : r.cMax <= 0 ? "Interference" : "Transition";
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Tolerance zones of hole and shaft">
      <path d="M20 ${z}H300" stroke="var(--ink)" stroke-width="1.6"/><text x="300" y="${z - 4}" text-anchor="end">Ø${v.D} (0 µm)</text>
      ${box(70, r.hu, r.hl, "var(--c)", `H7 ${r.hl}…+${r.hu}`)}${box(170, r.su, r.sl, "var(--muted)", `${v.s} ${r.sl > 0 ? "+" : ""}${r.sl}…${r.su > 0 ? "+" : ""}${r.su}`)}
      <text x="160" y="144" text-anchor="middle" class="lbl">${kind} fit: from ${r.cMin >= 0 ? r.cMin + " µm clearance" : -r.cMin + " µm interference"} to ${r.cMax >= 0 ? r.cMax + " µm clearance" : -r.cMax + " µm interference"}</text></svg>`;
  },
  thermal(r, v, f) {
    const L0 = 220, grow = Math.max(-60, Math.min(60, r.dL / v.L * 1000 * 60)), hot = r.dT > 0;
    return `<svg viewBox="0 0 320 120" role="img" aria-label="Bar growing with temperature">
      <rect x="30" y="30" width="${L0}" height="18" rx="4" fill="var(--surface-2)" stroke="var(--rule-strong)"/><text x="30" y="24">at ${f(v.T1, "temp", 3)}</text>
      <rect class="bar" x="30" y="62" width="${L0 + grow}" height="18" rx="4" fill="color-mix(in srgb,${hot ? "var(--bad)" : "var(--c-strength)"} 35%,var(--surface))" stroke="${hot ? "var(--bad)" : "var(--c-strength)"}"/>
      <text x="30" y="96">at ${f(v.T2, "temp", 3)} (growth exaggerated)</text>
      <text x="${30 + L0 + grow}" y="58" text-anchor="end" class="lbl">${r.dL >= 0 ? "+" : ""}${f(r.dL, "len", 3)}</text></svg>`;
  }
};

/* ============================================================ start */
// Pages opened from the app (viewer, guides) come back with #home etc.; a first launch lands on Home.
route();
})();
