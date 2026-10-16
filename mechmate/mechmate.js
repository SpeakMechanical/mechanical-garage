// MechMate app: navigation, inputs in SI or imperial, shareable links, tool search,
// saved projects and PDF reports. The formulas live in mechmate-tools.js (window.MM).
(function () {
"use strict";
const {TOOLS, CATS, MAT_OPTIONS, toDisp, toSI, unit, formatter} = MM;

/* ============================================================ state */
const load = (k, d) => { try { const s = localStorage.getItem(k); return s === null ? d : JSON.parse(s); } catch (e) { return d; } };
const keep = (k, x) => { try { localStorage.setItem(k, JSON.stringify(x)); } catch (e) {} };
let sys = load("mechmate.units", "si") === "imp" ? "imp" : "si";
let material = load("mechmate.material", "e250");
let store = load("mechmate", null);
if (!store || !Array.isArray(store.list)) store = {current: null, list: []};
const persist = () => keep("mechmate", store);
const curProject = () => store.list.find(p => p.id === store.current);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
// Labels write subscripts as x_sub ("F_M", "R_p0.2"); show them as real subscripts, or drop the mark in plain text.
const sub = s => String(s).replace(/_([A-Za-z0-9.]+)/g, "<sub>$1</sub>");
const plain = s => String(s).replace(/_([A-Za-z0-9.]+)/g, "$1");

// Working values per tool, always SI.
const vals = {};
TOOLS.forEach(t => { vals[t.id] = {}; t.fields.forEach(f => vals[t.id][f.id] = f.value); });
const optionsOf = (f, v) => typeof f.options === "function" ? f.options(v) : f.type === "material" || f.type === "material2" ? MAT_OPTIONS : f.options;
const isSelect = f => f.type === "select" || f.type === "material" || f.type === "material2";
function syncMaterial(v, t) { if (t.fields.some(f => f.type === "material")) v.mat = material; }
function fixSelects(t, v) {
  t.fields.filter(isSelect).forEach(f => {
    const opts = optionsOf(f, v);
    if (!opts.some(o => String(o[0]) === String(v[f.id]))) v[f.id] = opts[0][0];
  });
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
  projects: '<path d="M4 6h6l2 2h8v10H4z"/>',
  plans: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'
};
const svg = k => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ""}</svg>`;

/* ============================================================ sidebar */
function sidebar(active) {
  const link = (id, name, pro) => `<a href="#${id}"${id === active ? ' aria-current="true"' : ""}><span class="l">${svg(id)}${name}</span>${pro ? '<span class="tag pro">Pro</span>' : ""}</a>`;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  $("side").innerHTML =
    `<div><button class="search-btn" type="button" id="open-pal">${svg("search")}Search tools<kbd>${mac ? "⌘" : "Ctrl"} K</kbd></button></div>` +
    CATS.map(([c, name]) => `<div><div class="grp">${name}</div>${TOOLS.filter(t => t.cat === c).map(t => link(t.id, t.name, t.pro)).join("")}</div>`).join("") +
    `<div><div class="grp">Workspace</div>${link("projects", "Saved projects", true)}${link("plans", "Plans", false)}</div>`;
  $("open-pal").onclick = openPalette;
}

/* ============================================================ unit switch */
function setSys(s) {
  sys = s; keep("mechmate.units", s);
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sys === s)));
}
document.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
  setSys(b.dataset.sys);
  history.replaceState(null, "", location.hash.split("?")[0] || "#beam");   // inputs are already held in vals
  route();
});
setSys(sys);

/* ============================================================ tool view */
function dispValue(f, x) {
  if (!f.q || sys === "si") return x;
  return +toDisp(f.q, x, sys).toPrecision(6);
}
function fieldsHtml(t, v) {
  return t.fields.map(f => {
    const hidden = f.show && !f.show(v) ? " hidden" : "";
    const label = sub(f.q ? `${f.label}, ${unit(f.q, sys)}` : f.label);
    if (isSelect(f)) {
      const opts = optionsOf(f, v).map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v[f.id]) ? " selected" : ""}>${esc(plain(l))}</option>`).join("");
      return `<label${hidden}><span>${label}</span><select data-f="${f.id}">${opts}</select></label>`;
    }
    return `<label${hidden}><span>${label}</span><input data-f="${f.id}" type="number" step="any" inputmode="decimal" value="${dispValue(f, v[f.id])}"></label>`;
  }).join("");
}
function linkFor(t, v) {
  const p = new URLSearchParams();
  t.fields.forEach(f => {
    const x = v[f.id];
    if (String(x) !== String(f.value)) p.set(f.id, typeof x === "number" ? String(+x.toPrecision(8)) : x);
  });
  if (sys === "imp") p.set("u", "imp");
  const q = p.toString();
  return `#${t.id}${q ? "?" + q : ""}`;
}
function showTool(t, params) {
  const v = vals[t.id];
  syncMaterial(v, t);
  if (params) {
    t.fields.forEach(f => { if (params.has(f.id)) v[f.id] = isSelect(f) ? params.get(f.id) : parseFloat(params.get(f.id)); });
    if (params.get("u") === "imp" || params.get("u") === "si") setSys(params.get("u"));
    if (params.has("mat")) { material = v.mat; keep("mechmate.material", material); }
  }
  fixSelects(t, v);
  $("view").innerHTML = `
    <div class="tool-head"><div><div class="eyebrow">${MM.CATS.find(c => c[0] === t.cat)[1]}${t.pro ? ' · <span class="tag pro">Pro</span>' : ""}</div><h2>${t.name}</h2></div>
      <div class="save">
        <button class="btn ghost sm" id="copy-btn" type="button">Copy link</button>
        <input id="save-label" type="text" placeholder="Label, e.g. Z axis motor" aria-label="Label for this calculation">
        <button class="btn primary sm" id="save-btn" type="button">Save to project</button>
      </div></div>
    <p class="tool-blurb">${t.blurb}</p>
    <div class="toast" id="toast" role="status"></div>
    <div class="calc"><div class="fields" id="fields">${fieldsHtml(t, v)}</div><div class="out" id="out"></div><div class="msg" id="msg"></div><div id="extra"></div></div>`;
  const fields = $("fields");
  const compute = () => {
    const f = formatter(sys);
    let r = null, rows = [], msg = "", extra = "";
    try {
      r = t.solve(v);
      rows = r ? t.rows(r, v, f) : [];
      msg = (t.msg && t.msg(r)) || (r ? "" : "This combination of inputs is not covered.");
      extra = r && t.extra ? t.extra(r, v, f) : "";
    } catch (e) { msg = "Check the inputs: " + e.message; }
    $("out").innerHTML = rows.map(([k, val, state, s]) => card(sub(k), val, state, s && sub(s))).join("");
    $("msg").textContent = msg;
    $("extra").innerHTML = extra;
    t.last = rows;
    history.replaceState(null, "", linkFor(t, v));
  };
  fields.addEventListener("input", e => {
    const el = e.target, f = t.fields.find(f => f.id === el.dataset.f);
    if (!f || isSelect(f)) return;
    const x = parseFloat(el.value);
    if (!isFinite(x)) return;
    v[f.id] = f.q ? toSI(f.q, x, sys) : x;
    compute();
  });
  fields.addEventListener("change", e => {
    const el = e.target, f = t.fields.find(f => f.id === el.dataset.f);
    if (!f || !isSelect(f)) return;
    v[f.id] = el.value;
    if (f.type === "material") { material = el.value; keep("mechmate.material", material); }
    fixSelects(t, v);
    fields.innerHTML = fieldsHtml(t, v);   // options and visible inputs may depend on this choice
    compute();
  });
  compute();
  $("copy-btn").onclick = async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); $("toast").textContent = "Link copied. Anyone who opens it sees these inputs."; }
    catch (e) { $("toast").textContent = "Copy this link: " + url; }
  };
  $("save-btn").onclick = () => {
    if (!curProject()) newProject("My project");
    const inputs = t.fields.filter(f => !f.show || f.show(v)).map(f => {
      if (isSelect(f)) { const o = optionsOf(f, v).find(o => String(o[0]) === String(v[f.id])); return [plain(f.label), plain(o ? o[1] : v[f.id])]; }
      return [plain(f.q ? `${f.label}, ${unit(f.q, sys)}` : f.label), String(dispValue(f, v[f.id]))];
    });
    curProject().items.push({tool: t.id, title: $("save-label").value.trim() || t.name, at: Date.now(), values: {...v}, inputs,
      rows: (t.last || []).map(x => [plain(x[0]), String(x[1]), plain(x[3] || "")])});
    persist();
    $("toast").textContent = `Saved to “${curProject().name}”.`;
    $("save-label").value = "";
  };
}

/* ============================================================ projects */
function newProject(name) {
  const p = {id: "p" + Date.now().toString(36), name, created: Date.now(), items: []};
  store.list.push(p); store.current = p.id; persist(); return p;
}
function showProjects() {
  const p = curProject();
  const opts = store.list.map(q => `<option value="${q.id}"${q.id === store.current ? " selected" : ""}>${esc(q.name)}</option>`).join("");
  const toolName = id => (TOOLS.find(t => t.id === id) || {name: id}).name;
  $("view").innerHTML = `
    <div class="tool-head"><div><div class="eyebrow">Workspace · <span class="tag pro">Pro</span></div><h2>Saved projects</h2></div>
      <div class="save">${store.list.length ? `<select id="pj-sel" aria-label="Project">${opts}</select>` : ""}<button class="btn ghost sm" id="pj-new" type="button">New project</button>
      ${p ? `<button class="btn ghost sm" id="pj-ren" type="button">Rename</button><button class="btn primary sm" id="pj-pdf" type="button">PDF report</button>` : ""}</div></div>
    <p class="tool-blurb">Save calculations from any tool into a project, reopen them later, and print the project as a PDF report. Projects are kept in this browser only.</p>
    <div id="pj-form"></div>
    <div class="proj-list">${p && p.items.length ? p.items.map((it, k) => `
      <div class="item"><div><div class="t">${esc(it.title)}</div><div class="d">${esc(toolName(it.tool))} · ${new Date(it.at).toLocaleString()} · ${esc(it.rows.slice(0, 2).map(r => r[0] + " " + r[1]).join(" · "))}</div></div>
      <div class="actions"><button class="btn ghost sm" data-open="${k}" type="button">Open</button><button class="btn ghost sm" data-del="${k}" type="button">Remove</button></div></div>`).join("")
      : `<div class="empty">${p ? "No calculations saved in this project yet. Open a tool and press <b>Save to project</b>." : "No projects yet. Save a calculation from any tool, or create a project."}</div>`}</div>`;
  const ask = (label, value, done) => {
    $("pj-form").innerHTML = `<form class="save" style="margin:0 0 14px"><input id="pj-name" type="text" value="${esc(value)}" aria-label="${label}" required><button class="btn primary sm">${label}</button></form>`;
    $("pj-form").querySelector("form").addEventListener("submit", e => { e.preventDefault(); const n = $("pj-name").value.trim(); if (n) { done(n); persist(); showProjects(); } });
    $("pj-name").focus(); $("pj-name").select();
  };
  $("pj-new").onclick = () => ask("Create", "New project", n => newProject(n));
  if (!p) return;
  $("pj-ren").onclick = () => ask("Rename", p.name, n => p.name = n);
  $("pj-sel").onchange = e => { store.current = e.target.value; persist(); showProjects(); };
  $("pj-pdf").onclick = () => report(p);
  $("view").querySelectorAll("[data-del]").forEach(b => b.onclick = () => { p.items.splice(+b.dataset.del, 1); persist(); showProjects(); });
  $("view").querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
    const it = p.items[+b.dataset.open];
    if (!vals[it.tool]) return;
    Object.assign(vals[it.tool], it.values);
    if (it.values.mat) { material = it.values.mat; keep("mechmate.material", material); }
    location.hash = it.tool;
  });
}
function report(p) {
  const toolName = id => (TOOLS.find(t => t.id === id) || {name: id}).name;
  const table = rows => `<table>${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td>${r.length > 2 ? `<td>${esc(r[2])}</td>` : ""}</tr>`).join("")}</table>`;
  $("report").innerHTML = `<h1>${esc(p.name)}</h1><div class="meta">MechMate report · ${new Date().toLocaleDateString()} · ${p.items.length} calculation${p.items.length === 1 ? "" : "s"}</div>` +
    p.items.map(it => `<section><h2>${esc(it.title)}</h2><div class="meta">${esc(toolName(it.tool))} · ${new Date(it.at).toLocaleString()}</div>
      <p><b>Inputs</b></p>${table(it.inputs)}<p><b>Results</b></p>${table(it.rows)}</section>`).join("") +
    `<p class="meta">Calculated with MechMate for first sizing. Check final designs against the relevant codes and supplier data.</p>`;
  window.print();
}

/* ============================================================ plans */
function showPlans() {
  const list = pro => TOOLS.filter(t => t.pro === pro).map(t => `<li>${t.name}</li>`).join("");
  $("view").innerHTML = `
    <div class="eyebrow">Plans</div><h2>Free to start. Pro when you need it.</h2>
    <p class="tool-blurb">Every tool is free while MechMate is in preview.</p>
    <div class="plans">
      <div class="plan"><span class="tag">Free</span><h3>Basic</h3><p class="note">For students, machinists and quick checks.</p><ul>${list(false)}</ul></div>
      <div class="plan" style="border-color:var(--accent)"><span class="tag pro">Pro</span><h3>Pro</h3><p class="note">For design engineers. Everything in Basic, plus:</p><ul>${list(true)}<li>Saved projects</li><li>PDF reports</li></ul></div>
    </div>`;
}

/* ============================================================ command palette */
let palItems = [], palSel = 0;
function openPalette() {
  $("pal").hidden = false; $("pal-q").value = ""; renderPalette(); $("pal-q").focus();
}
function closePalette() { $("pal").hidden = true; }
function renderPalette() {
  const q = $("pal-q").value.trim().toLowerCase();
  const all = [...TOOLS.map(t => ({id: t.id, name: t.name, cat: MM.CATS.find(c => c[0] === t.cat)[1], text: (t.name + " " + t.blurb).toLowerCase()})),
    {id: "projects", name: "Saved projects", cat: "Workspace", text: "saved projects pdf report"}, {id: "plans", name: "Plans", cat: "Workspace", text: "plans pro free pricing"}];
  palItems = q ? all.filter(i => q.split(/\s+/).every(w => i.text.includes(w))) : all;
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  $("pal-list").innerHTML = palItems.length ? palItems.map((i, k) => `<li role="option" data-k="${k}" aria-selected="${k === palSel}">${i.name}<small>${i.cat}</small></li>`).join("") : `<li>No tool matches “${esc(q)}”</li>`;
}
$("pal-q").addEventListener("input", () => { palSel = 0; renderPalette(); });
$("pal-q").addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { palSel = Math.min(palSel + 1, palItems.length - 1); renderPalette(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { palSel = Math.max(palSel - 1, 0); renderPalette(); e.preventDefault(); }
  else if (e.key === "Enter" && palItems[palSel]) { location.hash = palItems[palSel].id; closePalette(); }
  else if (e.key === "Escape") closePalette();
});
$("pal-list").addEventListener("click", e => { const li = e.target.closest("li[data-k]"); if (li) { location.hash = palItems[+li.dataset.k].id; closePalette(); } });
$("pal").addEventListener("click", e => { if (e.target === $("pal")) closePalette(); });
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("pal").hidden ? openPalette() : closePalette(); }
  else if (e.key === "/" && $("pal").hidden && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
});

/* ============================================================ router */
function route() {
  const [id, query] = (location.hash.slice(1) || "beam").split("?");
  sidebar(id);
  const t = TOOLS.find(t => t.id === id);
  if (t) showTool(t, query ? new URLSearchParams(query) : null);
  else if (id === "projects") showProjects();
  else if (id === "plans") showPlans();
  else { location.hash = "beam"; return; }
  document.title = t ? `${t.name} · MechMate` : "MechMate";
}
addEventListener("hashchange", route);
route();

/* ============================================================ offline */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
})();
