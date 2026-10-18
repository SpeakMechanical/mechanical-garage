// MechMate calculation library: unit system, materials, and every tool's inputs and formulas.
// No DOM access, so the same file runs in the browser (window.MM) and in the Node tests (require).
// All values inside solve() are SI-style working units: mm, N, N·m, MPa, kW, kg, rpm, °C.
(function (root) {
"use strict";

/* ============================================================ units */
// Each quantity: [unit label, factor] where working value = displayed value × factor.
const QTY = {
  len:      {si: ["mm", 1],        imp: ["in", 25.4]},
  small:    {si: ["µm", 1],        imp: ["thou", 25.4]},
  force:    {si: ["N", 1],         imp: ["lbf", 4.4482216152605]},
  torque:   {si: ["N·m", 1],       imp: ["lbf·ft", 1.3558179483314]},
  torqueS:  {si: ["N·m", 1],       imp: ["lbf·in", 0.1129848290276]},
  stress:   {si: ["MPa", 1],       imp: ["psi", 0.00689475729317]},
  pressure: {si: ["bar", 1],       imp: ["psi", 0.0689475729317]},
  power:    {si: ["kW", 1],        imp: ["hp", 0.745699871582]},
  mass:     {si: ["kg", 1],        imp: ["lb", 0.45359237]},
  density:  {si: ["kg/m³", 1],     imp: ["lb/in³", 27679.9047102]},
  massLen:  {si: ["kg/m", 1],      imp: ["lb/ft", 1.48816394357]},
  linSpeed: {si: ["mm/s", 1],      imp: ["in/s", 25.4]},
  beltSpeed:{si: ["m/s", 1],       imp: ["ft/min", 0.00508]},
  cutSpeed: {si: ["m/min", 1],     imp: ["sfm", 0.3048]},
  feedRate: {si: ["mm/min", 1],    imp: ["in/min", 25.4]},
  mrr:      {si: ["cm³/min", 1],   imp: ["in³/min", 16.387064]},
  area:     {si: ["mm²", 1],       imp: ["in²", 645.16]},
  secMod:   {si: ["mm³", 1],       imp: ["in³", 16387.064]},
  secMom:   {si: ["mm⁴", 1],       imp: ["in⁴", 416231.4256]},
  inertia:  {si: ["kg·cm²", 1],    imp: ["lb·in²", 2.92639653]},
  lineLoad: {si: ["N/mm", 1],      imp: ["lbf/in", 0.175126835]},
  temp:     {si: ["°C"],           imp: ["°F"]},
  dTemp:    {si: ["°C", 1],        imp: ["°F", 5 / 9]},
  alpha:    {si: ["µm/m·°C", 1],   imp: ["µin/in·°F", 1.8]},
  flow:     {si: ["L/min", 1],     imp: ["gal/min", 3.785411784]},
  airFlow:  {si: ["L/min free air", 1], imp: ["cfm free air", 28.316846592]},
  volume:   {si: ["L", 1],         imp: ["in³", 0.016387064]},
  modulus:  {si: ["GPa", 1],       imp: ["Mpsi", 6.89475729317]},
  lenM:     {si: ["m", 1],         imp: ["ft", 0.3048]},
  areaM:    {si: ["m²", 1],        imp: ["ft²", 0.09290304]},
  volM:     {si: ["m³", 1],        imp: ["ft³", 0.028316846592]},
  heat:     {si: ["W", 1],         imp: ["BTU/h", 0.29307107]}
};
function unit(q, sys) { return q && QTY[q] ? QTY[q][sys][0] : ""; }
function toDisp(q, x, sys) {
  if (!q || sys === "si" || x === null || x === undefined) return x;
  if (q === "temp") return x * 9 / 5 + 32;
  return x / QTY[q].imp[1];
}
function toSI(q, x, sys) {
  if (!q || sys === "si") return x;
  if (q === "temp") return (x - 32) * 5 / 9;
  return x * QTY[q].imp[1];
}
function fmtNum(x, sig = 4) {
  if (x === null || x === undefined || typeof x !== "number" || !isFinite(x)) return "—";
  if (x === 0) return "0";
  const mag = Math.floor(Math.log10(Math.abs(x)));
  if (mag >= 9 || mag < -4) return x.toExponential(sig - 1);
  const dec = Math.max(0, sig - 1 - mag);
  return x.toLocaleString("en-US", {minimumFractionDigits: dec, maximumFractionDigits: dec});
}
// f(x, q, sig) → "value unit" in the chosen system. f.n(x, sig) → plain number.
function formatter(sys) {
  const f = (x, q, sig) => { const s = fmtNum(toDisp(q, x, sys), sig); return q && s !== "—" ? `${s} ${unit(q, sys)}` : s; };
  f.n = (x, sig) => fmtNum(x, sig);
  f.sys = sys;
  return f;
}

/* ============================================================ materials */
// Typical room-temperature values. E in MPa, rho kg/m³, Sy/Sut MPa, alpha 1/°C.
const MATERIALS = [
  {id: "e250",   name: "Mild steel (IS 2062 E250 / S235)",      E: 205000, nu: 0.30, rho: 7850, Sy: 250, Sut: 410, alpha: 12.0e-6},
  {id: "c45",    name: "Medium carbon steel (C45 / EN8 / 1045)", E: 205000, nu: 0.29, rho: 7850, Sy: 380, Sut: 600, alpha: 11.7e-6},
  {id: "4140",   name: "Alloy steel Q&T (42CrMo4 / EN19 / 4140)", E: 205000, nu: 0.29, rho: 7850, Sy: 750, Sut: 1000, alpha: 12.3e-6},
  {id: "ss304",  name: "Stainless steel 304",                   E: 193000, nu: 0.29, rho: 8000, Sy: 205, Sut: 515, alpha: 17.3e-6},
  {id: "ss316",  name: "Stainless steel 316",                   E: 193000, nu: 0.29, rho: 8000, Sy: 205, Sut: 515, alpha: 16.0e-6},
  {id: "gci",    name: "Grey cast iron (FG 260 / GG25)",         E: 110000, nu: 0.26, rho: 7200, Sy: 0,   Sut: 260, alpha: 10.5e-6},
  {id: "al6061", name: "Aluminium 6061-T6",                     E: 68900,  nu: 0.33, rho: 2700, Sy: 276, Sut: 310, alpha: 23.6e-6},
  {id: "al6082", name: "Aluminium 6082-T6",                     E: 70000,  nu: 0.33, rho: 2700, Sy: 260, Sut: 310, alpha: 23.4e-6},
  {id: "al7075", name: "Aluminium 7075-T6",                     E: 71700,  nu: 0.33, rho: 2810, Sy: 503, Sut: 572, alpha: 23.4e-6},
  {id: "brass",  name: "Free-machining brass (C360 half hard)",  E: 97000,  nu: 0.31, rho: 8500, Sy: 310, Sut: 385, alpha: 20.5e-6},
  {id: "copper", name: "Copper C110 (annealed)",                 E: 117000, nu: 0.33, rho: 8940, Sy: 69,  Sut: 220, alpha: 17.0e-6},
  {id: "ti64",   name: "Titanium Ti-6Al-4V",                     E: 113800, nu: 0.34, rho: 4430, Sy: 880, Sut: 950, alpha: 8.6e-6},
  {id: "pom",    name: "Acetal (POM)",                           E: 2800,   nu: 0.35, rho: 1410, Sy: 65,  Sut: 67,  alpha: 110e-6},
  {id: "pa6",    name: "Nylon PA6 (dry)",                        E: 2700,   nu: 0.39, rho: 1140, Sy: 70,  Sut: 80,  alpha: 80e-6}
];
const mat = id => MATERIALS.find(m => m.id === id) || MATERIALS[0];
const MAT_OPTIONS = MATERIALS.map(m => [m.id, m.name]);

// Machining groups (Sandvik-style specific cutting force kc1 at hm = 1 mm, exponent mc,
// and starting cutting speeds in m/min for HSS and coated carbide).
const MACHINING = [
  {id: "lcs",   name: "Low carbon steel (C15, S235)",        kc1: 1500, mc: 0.25, hss: 30,  carbide: 220},
  {id: "mcs",   name: "Medium carbon steel (C45 / EN8)",     kc1: 1600, mc: 0.25, hss: 25,  carbide: 180},
  {id: "alloy", name: "Alloy steel, annealed (42CrMo4)",     kc1: 1700, mc: 0.25, hss: 20,  carbide: 150},
  {id: "ss",    name: "Austenitic stainless (304, 316)",     kc1: 2000, mc: 0.21, hss: 15,  carbide: 160},
  {id: "ci",    name: "Grey cast iron",                      kc1: 1100, mc: 0.28, hss: 25,  carbide: 200},
  {id: "al",    name: "Aluminium alloys (wrought)",          kc1: 700,  mc: 0.25, hss: 150, carbide: 500},
  {id: "brass", name: "Brass",                               kc1: 700,  mc: 0.25, hss: 90,  carbide: 300},
  {id: "ti",    name: "Titanium Ti-6Al-4V",                  kc1: 1400, mc: 0.23, hss: 10,  carbide: 50}
];
const mmat = id => MACHINING.find(m => m.id === id) || MACHINING[0];

/* ============================================================ shared data */
// Metric coarse bolts: d, pitch P, hex head bearing diameter dw (ISO 4017 min), medium clearance hole dh (ISO 273).
const BOLTS = {M3: [3, 0.5, 4.57, 3.4], M4: [4, 0.7, 5.88, 4.5], M5: [5, 0.8, 6.88, 5.5], M6: [6, 1.0, 8.88, 6.6],
  M8: [8, 1.25, 11.63, 9], M10: [10, 1.5, 14.63, 11], M12: [12, 1.75, 16.63, 13.5], M16: [16, 2.0, 22.49, 17.5],
  M20: [20, 2.5, 28.19, 22], M24: [24, 3.0, 33.61, 26]};
// Yield strength Rp0.2 by property class (ISO 898-1); 8.8 rises above M16.
const boltRp = (cls, d) => cls === "8.8" ? (d <= 16 ? 640 : 660) : {"4.6": 240, "10.9": 940, "12.9": 1100}[cls];

// ISO 286 deviations in µm, [upper, lower], for sizes above lo up to hi.
const FIT_RANGES = [[3, 6], [6, 10], [10, 18], [18, 30], [30, 50], [50, 65], [65, 80]];
const DEV = {
  H7: [[12, 0], [15, 0], [18, 0], [21, 0], [25, 0], [30, 0], [30, 0]],
  f7: [[-10, -22], [-13, -28], [-16, -34], [-20, -41], [-25, -50], [-30, -60], [-30, -60]],
  g6: [[-4, -12], [-5, -14], [-6, -17], [-7, -20], [-9, -25], [-10, -29], [-10, -29]],
  h6: [[0, -8], [0, -9], [0, -11], [0, -13], [0, -16], [0, -19], [0, -19]],
  k6: [[9, 1], [10, 1], [12, 1], [15, 2], [18, 2], [21, 2], [21, 2]],
  n6: [[16, 8], [19, 10], [23, 12], [28, 15], [33, 17], [39, 20], [39, 20]],
  p6: [[20, 12], [24, 15], [29, 18], [35, 22], [42, 26], [51, 32], [51, 32]],
  s6: [[27, 19], [32, 23], [39, 28], [48, 35], [59, 43], [72, 53], [78, 59]]
};
// Hole H7 with the given shaft at nominal size D: limits and clearance (+) / interference (−) in µm.
function isoFit(D, shaft) {
  const i = FIT_RANGES.findIndex(([lo, hi]) => D > lo && D <= hi);
  if (i < 0) return null;
  const [hu, hl] = DEV.H7[i], [su, sl] = DEV[shaft][i];
  return {hu, hl, su, sl, cMax: hu - sl, cMin: hl - su};
}

const UNITS = {
  length: {name: "Length", u: [["mm", "mm", 1e-3], ["cm", "cm", 1e-2], ["m", "m", 1], ["km", "km", 1e3], ["um", "µm", 1e-6], ["in", "in", 0.0254], ["ft", "ft", 0.3048], ["yd", "yd", 0.9144], ["mi", "mile", 1609.344]]},
  force: {name: "Force", u: [["N", "N", 1], ["kN", "kN", 1e3], ["lbf", "lbf", 4.4482216152605], ["kgf", "kgf", 9.80665]]},
  torque: {name: "Torque", u: [["Nm", "N·m", 1], ["Nmm", "N·mm", 1e-3], ["kNm", "kN·m", 1e3], ["lbfft", "lbf·ft", 1.3558179483314], ["lbfin", "lbf·in", 0.1129848290276], ["ozfin", "ozf·in", 0.0070615518], ["kgfm", "kgf·m", 9.80665]]},
  pressure: {name: "Pressure / stress", u: [["Pa", "Pa", 1], ["kPa", "kPa", 1e3], ["MPa", "MPa (N/mm²)", 1e6], ["GPa", "GPa", 1e9], ["bar", "bar", 1e5], ["psi", "psi", 6894.75729317], ["ksi", "ksi", 6894757.29317], ["atm", "atm", 101325], ["kgfcm2", "kgf/cm²", 98066.5]]},
  power: {name: "Power", u: [["W", "W", 1], ["kW", "kW", 1e3], ["hp", "hp (mechanical)", 745.699871582], ["PS", "PS (metric hp)", 735.49875], ["btuh", "BTU/h", 0.29307107]]},
  mass: {name: "Mass", u: [["g", "g", 1e-3], ["kg", "kg", 1], ["t", "tonne", 1e3], ["lb", "lb", 0.45359237], ["oz", "oz", 0.028349523125]]},
  speed: {name: "Linear speed", u: [["ms", "m/s", 1], ["mms", "mm/s", 1e-3], ["mmin", "m/min", 1 / 60], ["kmh", "km/h", 1 / 3.6], ["ftmin", "ft/min", 0.00508], ["ins", "in/s", 0.0254], ["mph", "mph", 0.44704]]},
  angular: {name: "Rotational speed", u: [["rpm", "rpm", 2 * Math.PI / 60], ["rads", "rad/s", 1], ["degs", "deg/s", Math.PI / 180], ["hz", "rev/s (Hz)", 2 * Math.PI]]},
  energy: {name: "Energy", u: [["J", "J", 1], ["kJ", "kJ", 1e3], ["Wh", "Wh", 3600], ["kWh", "kWh", 3.6e6], ["cal", "cal", 4.184], ["btu", "BTU", 1055.05585], ["ftlbf", "ft·lbf", 1.3558179483314]]},
  inertia: {name: "Moment of inertia (mass)", u: [["kgm2", "kg·m²", 1], ["kgcm2", "kg·cm²", 1e-4], ["gcm2", "g·cm²", 1e-7], ["lbin2", "lb·in²", 2.92639653e-4], ["lbft2", "lb·ft²", 0.0421401101]]},
  flow: {name: "Volume flow", u: [["Lmin", "L/min", 1 / 60000], ["m3h", "m³/h", 1 / 3600], ["m3s", "m³/s", 1], ["gpm", "US gal/min", 6.30901964e-5], ["cfm", "ft³/min", 4.71947443e-4]]},
  temp: {name: "Temperature", u: [["C", "°C"], ["F", "°F"], ["K", "K"]]}
};

/* ============================================================ helpers */
const PI = Math.PI, G = 9.80665, rad = d => d * PI / 180, deg = r => r * 180 / PI;
const sel = pairs => pairs.map(p => Array.isArray(p) ? p : [p, p]);
const st = (x, ok, warn) => x >= ok ? "ok" : x >= warn ? "warn" : "bad";

/* ============================================================ tools */
const TOOLS = [];
const tool = t => TOOLS.push(t);

/* ---------------- Power and motion ---------------- */
tool({id: "power", name: "Torque · Power · Speed", cat: "motion", pro: false,
  blurb: "Enter any two and solve for the third. P = T·ω, so P (kW) = T (N·m) × n (rpm) / 9549.3.",
  fields: [
    {id: "solve", label: "Solve for", type: "select", options: sel([["torque", "Torque"], ["power", "Power"], ["speed", "Speed"]]), value: "torque"},
    {id: "P", label: "Power", q: "power", value: 7.5, show: v => v.solve !== "power"},
    {id: "T", label: "Torque", q: "torque", value: 50, show: v => v.solve !== "torque"},
    {id: "n", label: "Speed, rpm", value: 1440, show: v => v.solve !== "speed"}],
  solve(v) {
    const K = 60000 / (2 * PI);
    let {P, T, n} = v;
    if (v.solve === "power") P = T * n / K; else if (v.solve === "torque") T = K * P / n; else n = K * P / T;
    return {P, T, n, w: n * 2 * PI / 60};
  },
  rows: (r, v, f) => [
    ["Power", f(r.P, "power"), v.solve === "power" ? "ok" : "", f.sys === "si" ? `${f.n(r.P / 0.745699871582)} hp` : `${f.n(r.P)} kW`],
    ["Torque", f(r.T, "torque"), v.solve === "torque" ? "ok" : "", f.sys === "si" ? `${f.n(r.T / 1.3558179483314)} lbf·ft · ${f.n(r.T / 9.80665)} kgf·m` : `${f.n(r.T)} N·m`],
    ["Speed", `${f.n(r.n)} rpm`, v.solve === "speed" ? "ok" : "", `${f.n(r.w)} rad/s`]]});

tool({id: "gear", name: "Gear ratios", cat: "motion", pro: false,
  blurb: "A gear train of up to three stages. Ratio = driven teeth / driver teeth per stage; leave a stage at 0 to skip it.",
  fields: [
    {id: "nin", label: "Input speed, rpm", value: 1440}, {id: "tin", label: "Input torque", q: "torque", value: 50},
    {id: "m", label: "Module (for centre distance), mm", value: 2}, {id: "eff", label: "Efficiency per stage, %", value: 98},
    {id: "a1", label: "Stage 1 driver teeth", value: 20}, {id: "b1", label: "Stage 1 driven teeth", value: 60},
    {id: "a2", label: "Stage 2 driver teeth", value: 18}, {id: "b2", label: "Stage 2 driven teeth", value: 54},
    {id: "a3", label: "Stage 3 driver teeth", value: 0}, {id: "b3", label: "Stage 3 driven teeth", value: 0}],
  solve(v) {
    const stages = [];
    let i = 1;
    for (const s of [1, 2, 3]) {
      const a = Math.round(v["a" + s]), b = Math.round(v["b" + s]);
      if (!(a > 0 && b > 0)) continue;
      i *= b / a;
      stages.push({s, a, b, ratio: b / a, centre: v.m * (a + b) / 2});
    }
    const eta = (v.eff / 100) ** stages.length;
    const Pin = v.tin * v.nin * 2 * PI / 60000;
    return {stages, i, eta, nout: v.nin / i, tout: v.tin * i * eta, Pin, Pout: Pin * eta};
  },
  rows: (r, v, f) => [
    ...r.stages.map(g => [`Stage ${g.s}: ${g.a} → ${g.b}`, `i = ${f.n(g.ratio)}`, Math.min(g.a, g.b) < 17 ? "warn" : "", Math.min(g.a, g.b) < 17 ? "Under 17 teeth: undercut at 20°" : `Centre distance ${f.n(g.centre)} mm`]),
    ["Total ratio", `${f.n(r.i, 5)} : 1`, "ok", r.i >= 1 ? "Reduction" : "Overdrive"],
    ["Output speed", `${f.n(r.nout)} rpm`],
    ["Output torque", f(r.tout, "torque"), "", `Overall efficiency ${f.n(r.eta * 100)}%`],
    ["Power", f(r.Pin, "power"), "", `${f(r.Pout, "power")} out`]]});

tool({id: "belt", name: "Belt drives", cat: "motion", pro: true,
  blurb: "Open belt drive: length or centre distance, speeds, wrap angle and belt tensions (Euler–Eytelwein with centrifugal tension).",
  fields: [
    {id: "type", label: "Belt", type: "select", options: sel([["v", "V-belt (40° groove)"], ["flat", "Flat belt"], ["timing", "Timing belt (synchronous)"]]), value: "v"},
    {id: "given", label: "Given", type: "select", options: sel([["C", "Centre distance"], ["L", "Belt length"]]), value: "C"},
    {id: "D1", label: "Driver pitch diameter", q: "len", value: 100}, {id: "D2", label: "Driven pitch diameter", q: "len", value: 250},
    {id: "C", label: "Centre distance", q: "len", value: 500, show: v => v.given === "C"},
    {id: "L", label: "Belt pitch length", q: "len", value: 1600, show: v => v.given === "L"},
    {id: "n1", label: "Driver speed, rpm", value: 1440}, {id: "P", label: "Power", q: "power", value: 5},
    {id: "Ks", label: "Service factor", value: 1.2},
    {id: "mu", label: "Belt friction μ", value: 0.25, show: v => v.type !== "timing"},
    {id: "mb", label: "Belt mass per length", q: "massLen", value: 0.1, show: v => v.type !== "timing"}],
  solve(v) {
    const {D1, D2} = v, dD = D2 - D1;
    let C = v.C, L;
    if (v.given === "L") { L = v.L; const B = 4 * L - 2 * PI * (D1 + D2); C = (B + Math.sqrt(B * B - 32 * dD * dD)) / 16; }
    else L = 2 * C + PI * (D1 + D2) / 2 + dD * dD / (4 * C);
    const phi = Math.asin(Math.abs(dD) / (2 * C));
    const wrap = PI - 2 * phi;                          // on the smaller pulley
    const vel = PI * D1 * v.n1 / 60000;                 // m/s
    const Fe = v.P * 1000 * v.Ks / vel;                 // effective (design) tension, N
    const r = {C, L, wrap, ratio: D2 / D1, n2: v.n1 * D1 / D2, vel, Fe};
    if (v.type !== "timing") {
      const mu = v.type === "v" ? v.mu / Math.sin(rad(20)) : v.mu;
      const Tc = v.mb * vel * vel, e = Math.exp(mu * wrap);
      const T1 = Tc + Fe * e / (e - 1), T2 = T1 - Fe;
      const t1 = T1 - Tc, t2 = T2 - Tc;
      Object.assign(r, {mu, Tc, T1, T2, T0: (T1 + T2) / 2, shaft: Math.sqrt(t1 * t1 + t2 * t2 - 2 * t1 * t2 * Math.cos(wrap))});
    }
    return r;
  },
  rows: (r, v, f) => [
    [v.given === "L" ? "Centre distance" : "Belt pitch length", v.given === "L" ? f(r.C, "len") : f(r.L, "len"), "ok", v.type === "timing" ? "Round to a whole number of belt teeth" : "Pick the nearest standard length, then use Given: belt length"],
    ["Speed ratio", `${f.n(r.ratio)} : 1`, "", `Driven speed ${f.n(r.n2)} rpm`],
    ["Belt speed", f(r.vel, "beltSpeed"), r.vel <= 30 ? "" : "warn", r.vel <= 30 ? "" : "Above 30 m/s: check the belt's limit"],
    ["Wrap on small pulley", `${f.n(deg(r.wrap))}°`, deg(r.wrap) >= 120 ? "ok" : "warn", deg(r.wrap) >= 120 ? "" : "Under 120°: low grip, use an idler"],
    ["Effective tension F_e", f(r.Fe, "force"), "", "Design power / belt speed"],
    ...(v.type === "timing" ? [] : [
      ["Tight / slack side", `${f(r.T1, "force")} / ${f(r.T2, "force")}`, "", `Centrifugal tension ${f(r.Tc, "force")}`],
      ["Static (installed) tension", f(r.T0, "force"), "", "Per belt strand, (T₁ + T₂)/2"],
      ["Shaft load", f(r.shaft, "force"), "", "Resultant on each shaft"]])]});

tool({id: "chain", name: "Chain drives", cat: "motion", pro: true,
  blurb: "Roller chain drive: chain length in pitches, exact centre distance, chain pull and static safety against the breaking load.",
  fields: [
    {id: "p", label: "Chain pitch", type: "select", options: sel([["6.35", "6.35 mm (¼ in) · 04B / ANSI 25"], ["8", "8 mm · 05B"], ["9.525", "9.525 mm (⅜ in) · 06B / ANSI 35"], ["12.7", "12.7 mm (½ in) · 08B / ANSI 40"], ["15.875", "15.875 mm (⅝ in) · 10B / ANSI 50"], ["19.05", "19.05 mm (¾ in) · 12B / ANSI 60"], ["25.4", "25.4 mm (1 in) · 16B / ANSI 80"], ["31.75", "31.75 mm (1¼ in) · 20B / ANSI 100"], ["38.1", "38.1 mm (1½ in) · 24B / ANSI 120"]]), value: "12.7"},
    {id: "Fb", label: "Chain breaking load (catalogue)", q: "force", value: 17800},
    {id: "z1", label: "Driver sprocket teeth", value: 17}, {id: "z2", label: "Driven sprocket teeth", value: 51},
    {id: "C", label: "Approximate centre distance", q: "len", value: 500},
    {id: "n1", label: "Driver speed, rpm", value: 200}, {id: "P", label: "Power", q: "power", value: 1.5},
    {id: "Ks", label: "Service factor", value: 1.3}],
  solve(v) {
    const p = +v.p, z1 = Math.round(v.z1), z2 = Math.round(v.z2), S = (z1 + z2) / 2, K = ((z2 - z1) / (2 * PI)) ** 2;
    const LpExact = 2 * v.C / p + S + K * p / v.C;
    let Lp = Math.ceil(LpExact); if (Lp % 2) Lp++;
    const x = Lp - S, C = p / 4 * (x + Math.sqrt(x * x - 8 * K));
    const d1 = p / Math.sin(PI / z1), d2 = p / Math.sin(PI / z2);
    const vel = z1 * p * v.n1 / 60000, F = v.P * 1000 * v.Ks / vel;
    return {p, z1, z2, LpExact, Lp, C, d1, d2, vel, F, sf: v.Fb / F, ratio: z2 / z1, n2: v.n1 * z1 / z2,
      wrap: PI - 2 * Math.asin(Math.abs(d2 - d1) / (2 * C)), poly: (1 - Math.cos(PI / z1)) * 100, length: Lp * p};
  },
  rows: (r, v, f) => [
    ["Chain length", `${r.Lp} pitches`, "ok", `${f(r.length, "len")}; even number so no offset link is needed`],
    ["Exact centre distance", f(r.C, "len"), r.C / r.p >= 30 && r.C / r.p <= 50 ? "" : "warn", r.C / r.p >= 30 && r.C / r.p <= 50 ? `${f.n(r.C / r.p, 3)} pitches` : `${f.n(r.C / r.p, 3)} pitches: 30–50 is best`],
    ["Speed ratio", `${f.n(r.ratio)} : 1`, "", `Driven speed ${f.n(r.n2)} rpm`],
    ["Pitch diameters", `${f(r.d1, "len")} / ${f(r.d2, "len")}`],
    ["Chain speed", f(r.vel, "beltSpeed")],
    ["Chain pull", f(r.F, "force"), "", "Design power / chain speed"],
    ["Static safety factor", f.n(r.sf, 3), st(r.sf, 8, 5), "Breaking load / chain pull; aim for 8 or more and check the maker's power rating"],
    ["Smallest sprocket", `${r.z1} teeth`, r.z1 >= 17 ? "ok" : "warn", `Speed variation ${f.n(r.poly, 2)}% (polygon effect)${r.z1 >= 17 ? "" : "; use 17+ teeth"}`],
    ["Wrap on small sprocket", `${f.n(deg(r.wrap))}°`, deg(r.wrap) >= 120 ? "" : "warn"]]});

tool({id: "screw", name: "Lead screws", cat: "motion", pro: true,
  blurb: "Drive torque, efficiency and self-locking for trapezoidal, square and ball screws.",
  fields: [
    {id: "type", label: "Screw type", type: "select", options: sel([["trap", "Trapezoidal / ACME (30°)"], ["sq", "Square thread"], ["ball", "Ball screw"]]), value: "trap"},
    {id: "d", label: "Nominal diameter", q: "len", value: 16}, {id: "p", label: "Pitch", q: "len", value: 4}, {id: "z", label: "Starts", value: 1},
    {id: "F", label: "Axial load", q: "force", value: 2000},
    {id: "mu", label: "Thread friction μ", value: 0.15, show: v => v.type !== "ball"},
    {id: "eta", label: "Ball screw efficiency", value: 0.9, show: v => v.type === "ball"},
    {id: "v", label: "Linear speed", q: "linSpeed", value: 20}],
  solve(v) {
    const l = v.p * Math.max(1, Math.round(v.z)), dm = v.d - v.p / 2, rpm = v.v * 60 / l;
    let Tr, Tl, eff, lock;
    if (v.type === "ball") {
      Tr = v.F * l / (2 * PI * v.eta); Tl = -v.F * l * v.eta / (2 * PI); eff = v.eta; lock = false;
    } else {
      const sec = v.type === "trap" ? 1 / Math.cos(rad(15)) : 1, pd = PI * dm;
      Tr = v.F * dm / 2 * (l + pd * v.mu * sec) / (pd - v.mu * l * sec);
      Tl = v.F * dm / 2 * (pd * v.mu * sec - l) / (pd + v.mu * l * sec);
      eff = v.F * l / (2 * PI * Tr); lock = Tl > 0;
    }
    return {l, dm, helix: deg(Math.atan(l / (PI * dm))), Traise: Tr / 1000, Tlower: Tl / 1000, eff, lock, rpm, W: Tr / 1000 * rpm * 2 * PI / 60};
  },
  rows: (r, v, f) => [
    ["Lead", f(r.l, "len"), "", `Mean diameter ${f(r.dm, "len")}, helix ${f.n(r.helix, 3)}°`],
    ["Torque to raise / drive", f(r.Traise, "torqueS"), "ok"],
    [r.lock ? "Torque to lower" : "Back-drive torque (to hold)", f(Math.abs(r.Tlower), "torqueS"), "", r.lock ? "Positive: the load will not run down" : "The load drives the screw: hold it"],
    ["Efficiency", `${f.n(r.eff * 100, 3)}%`],
    ["Self-locking", r.lock ? "Yes" : "No", r.lock ? "ok" : "warn", r.lock ? "Holds without a brake (not under vibration)" : "Needs a brake on vertical axes"],
    ["Screw speed", `${f.n(r.rpm)} rpm`, "", `${f.n(r.W)} W at the screw`]]});

tool({id: "motor", name: "Motor sizing", cat: "motion", pro: true,
  blurb: "Reflected inertia, acceleration torque, peak and RMS torque for a trapezoidal move: accelerate, run, decelerate, dwell.",
  fields: [
    {id: "drive", label: "Mechanism", type: "select", options: sel([["screw", "Lead / ball screw"], ["belt", "Belt, pulley or rack"], ["rotary", "Direct rotary load"]]), value: "screw"},
    {id: "m", label: "Moving mass", q: "mass", value: 30, show: v => v.drive !== "rotary"},
    {id: "orient", label: "Axis", type: "select", options: sel([["h", "Horizontal"], ["v", "Vertical (lifting)"]]), value: "h", show: v => v.drive !== "rotary"},
    {id: "mu", label: "Guide friction μ", value: 0.01, show: v => v.drive !== "rotary"},
    {id: "Fext", label: "External force", q: "force", value: 0, show: v => v.drive !== "rotary"},
    {id: "lead", label: "Screw lead", q: "len", value: 10, show: v => v.drive === "screw"},
    {id: "sd", label: "Screw diameter", q: "len", value: 16, show: v => v.drive === "screw"},
    {id: "sl", label: "Screw length", q: "len", value: 800, show: v => v.drive === "screw"},
    {id: "r", label: "Pulley / pinion pitch radius", q: "len", value: 20, show: v => v.drive === "belt"},
    {id: "Jp", label: "Pulley inertia (all pulleys)", q: "inertia", value: 0.5, show: v => v.drive === "belt"},
    {id: "JL", label: "Load inertia", q: "inertia", value: 50, show: v => v.drive === "rotary"},
    {id: "TL", label: "Load torque", q: "torqueS", value: 1, show: v => v.drive === "rotary"},
    {id: "eta", label: "Mechanism efficiency", value: 0.9},
    {id: "i", label: "Gearbox ratio (motor turns per output turn)", value: 1}, {id: "etag", label: "Gearbox efficiency", value: 1},
    {id: "Jm", label: "Motor rotor inertia", q: "inertia", value: 0.22}, {id: "Jc", label: "Coupling inertia", q: "inertia", value: 0.01},
    {id: "vmax", label: "Max speed", q: "linSpeed", value: 500, show: v => v.drive !== "rotary"},
    {id: "nL", label: "Max load speed, rpm", value: 300, show: v => v.drive === "rotary"},
    {id: "ta", label: "Accel / decel time, s", value: 0.1}, {id: "tc", label: "Constant speed time, s", value: 1.0}, {id: "tdw", label: "Dwell time, s", value: 0.5}],
  solve(v) {
    let Tst, Jtr = 0, Jrot, wL, travel = null;
    if (v.drive === "rotary") {
      Tst = v.TL / v.eta; Jrot = v.JL * 1e-4; wL = v.nL * 2 * PI / 60;
    } else {
      const F = (v.orient === "v" ? v.m * G : v.mu * v.m * G) + v.Fext, vel = v.vmax / 1000;
      if (v.drive === "screw") {
        const l = v.lead / 1000;
        Tst = F * l / (2 * PI * v.eta); Jtr = v.m * (l / (2 * PI)) ** 2;
        Jrot = PI * 7850 * (v.sl / 1000) * (v.sd / 1000) ** 4 / 32; wL = 2 * PI * vel / l;
      } else {
        const r = v.r / 1000;
        Tst = F * r / v.eta; Jtr = v.m * r * r; Jrot = v.Jp * 1e-4; wL = vel / r;
      }
      travel = v.vmax * (v.ta + v.tc);
    }
    const i = v.i, eg = v.etag, Jm = v.Jm * 1e-4, Jc = v.Jc * 1e-4;
    const wM = wL * i, aL = wL / v.ta, aM = wM / v.ta;
    const Tstat = Tst / (i * eg);
    const Tin = (Jtr / v.eta + Jrot) * aL / (i * eg) + (Jm + Jc) * aM;
    const Ta = Tstat + Tin, Tc = Tstat, Td = Tstat - Tin;
    const Th = v.drive !== "rotary" && v.orient === "v" ? Tstat : 0;
    const Jref = (Jtr + Jrot) / (i * i) + Jc;
    const cycle = 2 * v.ta + v.tc + v.tdw;
    const rms = Math.sqrt((Ta * Ta * v.ta + Tc * Tc * v.tc + Td * Td * v.ta + Th * Th * v.tdw) / cycle);
    const peak = Math.max(Math.abs(Ta), Math.abs(Tc), Math.abs(Td), Th);
    return {nM: wM * 60 / (2 * PI), Jref: Jref * 1e4, ratio: Jref / Jm, Ta, Tc, Td, Th, peak, rms, Ppeak: Ta * wM / 1000, travel, cycle};
  },
  rows: (r, v, f) => [
    ["Motor speed", `${f.n(r.nM)} rpm`, r.nM <= 3000 ? "" : "warn", r.nM <= 3000 ? "" : "Above 3000 rpm: add a reduction or a longer lead"],
    ["Load inertia at the motor", f(r.Jref, "inertia"), "", "Including the coupling"],
    ["Inertia ratio (load / rotor)", `${f.n(r.ratio, 3)} : 1`, r.ratio <= 5 ? "ok" : r.ratio <= 10 ? "warn" : "bad", r.ratio <= 5 ? "Good for responsive servo tuning" : r.ratio <= 10 ? "Workable; tuning gets harder" : "Too high: add a gearbox or a bigger rotor"],
    ["Torque while accelerating", f(r.Ta, "torqueS"), "", `Constant speed ${f(r.Tc, "torqueS")}, decelerating ${f(r.Td, "torqueS")}`],
    ["Peak torque", f(r.peak, "torqueS"), "ok", `Servo: peak rating ≥ ${f(r.peak * 1.2, "torqueS")} (20% margin)`],
    ["RMS torque", f(r.rms, "torqueS"), "ok", `Servo: rated torque ≥ ${f(r.rms * 1.2, "torqueS")}`],
    ["Stepper requirement", f(r.peak * 2, "torqueS"), "", `Pull-out torque at ${f.n(r.nM)} rpm, 2× peak; steppers suit < ~1000 rpm`],
    ["Peak power", f(r.Ppeak, "power"), "", r.travel !== null ? `Move length ${f(r.travel, "len")}, cycle ${f.n(r.cycle, 3)} s` : `Cycle ${f.n(r.cycle, 3)} s`]]});

/* ---------------- Strength ---------------- */
const BEAM_LOADS = {
  cant: [["end", "Point load at free end"], ["pointA", "Point load at distance a from the wall"], ["udl", "Uniform load over the span"], ["moment", "Moment at free end"]],
  ss:   [["centre", "Point load at mid-span"], ["pointA", "Point load at distance a from the left support"], ["udl", "Uniform load over the span"], ["moment", "Moment at one end"]],
  ff:   [["centre", "Point load at mid-span"], ["udl", "Uniform load over the span"]]
};
function section(v) {
  switch (v.sec) {
    case "rect":  return {I: v.b * v.h ** 3 / 12, c: v.h / 2, A: v.b * v.h, tau: V => 1.5 * V / (v.b * v.h)};
    case "round": return {I: PI * v.d ** 4 / 64, c: v.d / 2, A: PI * v.d ** 2 / 4, tau: V => 4 * V / (3 * PI * v.d ** 2 / 4)};
    case "tube": { const di = v.D - 2 * v.t, A = PI * (v.D ** 2 - di ** 2) / 4;
      return {I: PI * (v.D ** 4 - di ** 4) / 64, c: v.D / 2, A, tau: V => 2 * V / A}; }
    case "rhs": { const bi = v.B - 2 * v.t, hi = v.H - 2 * v.t;
      return {I: (v.B * v.H ** 3 - bi * hi ** 3) / 12, c: v.H / 2, A: v.B * v.H - bi * hi, tau: V => V / (2 * v.t * hi)}; }
    default: return {I: v.I, c: v.c, A: NaN, tau: () => NaN};
  }
}
tool({id: "beam", name: "Beam deflection", cat: "strength", pro: false,
  blurb: "Maximum deflection, slope, bending moment and stress for standard beam cases (linear elastic, small deflection, self-weight not included).",
  fields: [
    {id: "support", label: "Supports", type: "select", options: sel([["cant", "Cantilever (fixed – free)"], ["ss", "Simply supported"], ["ff", "Fixed – fixed"]]), value: "cant"},
    {id: "load", label: "Load", type: "select", options: v => BEAM_LOADS[v.support], value: "end"},
    {id: "L", label: "Span L", q: "len", value: 500},
    {id: "P", label: "Point load P", q: "force", value: 1000, show: v => ["end", "pointA", "centre"].includes(v.load)},
    {id: "a", label: "Load position a", q: "len", value: 250, show: v => v.load === "pointA"},
    {id: "w", label: "Uniform load w", q: "lineLoad", value: 2, show: v => v.load === "udl"},
    {id: "M0", label: "Applied moment", q: "torque", value: 100, show: v => v.load === "moment"},
    {id: "sec", label: "Cross-section", type: "select", options: sel([["rect", "Solid rectangle"], ["round", "Solid round"], ["tube", "Round tube"], ["rhs", "Rectangular tube"], ["custom", "Other (enter I and c)"]]), value: "rect"},
    {id: "b", label: "Width b", q: "len", value: 20, show: v => v.sec === "rect"},
    {id: "h", label: "Height h (load direction)", q: "len", value: 40, show: v => v.sec === "rect"},
    {id: "d", label: "Diameter d", q: "len", value: 30, show: v => v.sec === "round"},
    {id: "D", label: "Outside diameter", q: "len", value: 40, show: v => v.sec === "tube"},
    {id: "B", label: "Outside width B", q: "len", value: 40, show: v => v.sec === "rhs"},
    {id: "H", label: "Outside height H (load direction)", q: "len", value: 60, show: v => v.sec === "rhs"},
    {id: "t", label: "Wall thickness t", q: "len", value: 3, show: v => v.sec === "tube" || v.sec === "rhs"},
    {id: "I", label: "Second moment of area I", q: "secMom", value: 100000, show: v => v.sec === "custom"},
    {id: "c", label: "Distance to extreme fibre c", q: "len", value: 25, show: v => v.sec === "custom"},
    {id: "mat", label: "Material", type: "material", value: "e250"}],
  solve(v) {
    const m = mat(v.mat), s = section(v), E = m.E, EI = E * s.I, L = v.L, P = v.P, w = v.w, M0 = v.M0 * 1000;
    let M, V, dmax, slope = null, where;
    const k = v.support + ":" + v.load;
    switch (k) {
      case "cant:end":    M = P * L; V = P; dmax = P * L ** 3 / (3 * EI); slope = P * L * L / (2 * EI); where = "at the free end"; break;
      case "cant:pointA": { const a = Math.min(v.a, L); M = P * a; V = P; dmax = P * a * a * (3 * L - a) / (6 * EI); slope = P * a * a / (2 * EI); where = "at the free end"; break; }
      case "cant:udl":    M = w * L * L / 2; V = w * L; dmax = w * L ** 4 / (8 * EI); slope = w * L ** 3 / (6 * EI); where = "at the free end"; break;
      case "cant:moment": M = M0; V = 0; dmax = M0 * L * L / (2 * EI); slope = M0 * L / EI; where = "at the free end"; break;
      case "ss:centre":   M = P * L / 4; V = P / 2; dmax = P * L ** 3 / (48 * EI); slope = P * L * L / (16 * EI); where = "at mid-span"; break;
      case "ss:pointA": { const a = Math.min(Math.max(v.a, 0), L), b = L - a, sh = Math.min(a, b);
        M = P * a * b / L; V = P * Math.max(a, b) / L;
        dmax = P * sh * (L * L - sh * sh) ** 1.5 / (9 * Math.sqrt(3) * L * EI);
        where = `${(Math.sqrt((L * L - sh * sh) / 3)).toFixed(1)} mm from the ${a >= b ? "left" : "right"} support`; break; }
      case "ss:udl":      M = w * L * L / 8; V = w * L / 2; dmax = 5 * w * L ** 4 / (384 * EI); slope = w * L ** 3 / (24 * EI); where = "at mid-span"; break;
      case "ss:moment":   M = M0; V = M0 / L; dmax = M0 * L * L / (9 * Math.sqrt(3) * EI); slope = M0 * L / (3 * EI); where = `${(L * (1 - 1 / Math.sqrt(3))).toFixed(1)} mm from the loaded end`; break;
      case "ff:centre":   M = P * L / 8; V = P / 2; dmax = P * L ** 3 / (192 * EI); where = "at mid-span; peak moment at the walls and centre"; break;
      case "ff:udl":      M = w * L * L / 12; V = w * L / 2; dmax = w * L ** 4 / (384 * EI); where = "at mid-span; peak moment at the walls"; break;
      default: return null;
    }
    const sigma = M * s.c / s.I, tau = s.tau(V);
    return {I: s.I, Z: s.I / s.c, A: s.A, M: M / 1000, V, dmax, slope: slope === null ? null : deg(slope), where, sigma, tau, n: m.Sy > 0 ? m.Sy / sigma : null, ratio: L / dmax, Sy: m.Sy};
  },
  rows: (r, v, f) => !r ? [] : [
    ["Max deflection", f(r.dmax, "len"), "ok", r.where],
    ["Span / deflection", `L / ${f.n(r.ratio, 3)}`, "", "Machine frames often L/1000–L/5000; floors L/360"],
    ...(r.slope !== null ? [["Max slope", `${f.n(r.slope, 3)}°`]] : []),
    ["Max bending moment", f(r.M, "torque")],
    ["Max shear force", f(r.V, "force")],
    ["Bending stress", f(r.sigma, "stress"), r.n === null ? "" : st(r.n, 2, 1), r.n === null ? "Brittle material: compare with S_ut" : `Factor of safety ${f.n(r.n, 3)} on yield`],
    ["Shear stress", isFinite(r.tau) ? f(r.tau, "stress") : "—", "", v.sec === "rhs" ? "Average over both webs" : v.sec === "tube" ? "Thin-wall peak" : "Peak, at the neutral axis"],
    ["Section I, Z", `${f(r.I, "secMom")} · ${f(r.Z, "secMod")}`]]});

tool({id: "bolt", name: "Bolt preload and torque", cat: "strength", pro: true,
  blurb: "VDI 2230 assembly preload and tightening torque for metric coarse hex-head bolts, then joint checks at the lowest preload the tightening method guarantees.",
  fields: [
    {id: "size", label: "Size", type: "select", options: sel(Object.keys(BOLTS)), value: "M8"},
    {id: "cls", label: "Property class", type: "select", options: sel(["4.6", "8.8", "10.9", "12.9"]), value: "8.8"},
    {id: "muth", label: "Thread friction μ_G", value: 0.12}, {id: "mub", label: "Head friction μ_K", value: 0.12},
    {id: "nu", label: "Yield utilisation during tightening, %", value: 90},
    {id: "aA", label: "Tightening method", type: "select", options: sel([["1.4", "Precision torque tool (α_A 1.4)"], ["1.6", "Torque wrench (α_A 1.6)"], ["2.5", "Impact wrench (α_A 2.5)"]]), value: "1.6"},
    {id: "nb", label: "Number of bolts", value: 4}, {id: "P", label: "Total tension load", q: "force", value: 8000},
    {id: "V", label: "Total shear load", q: "force", value: 3000}, {id: "phi", label: "Load factor Φ (joint constant)", value: 0.25},
    {id: "mus", label: "Slip friction between plates μ_T", value: 0.15}],
  solve(v) {
    const [d, p, dw, dh] = BOLTS[v.size], Rp = boltRp(v.cls, d);
    const d2 = d - 0.64952 * p, d3 = d - 1.22687 * p, ds = (d2 + d3) / 2, As = PI / 4 * ds * ds;
    const k = 1.5 * (d2 / ds) * (p / (PI * d2) + 1.155 * v.muth);
    const FM = As * (v.nu / 100) * Rp / Math.sqrt(1 + 3 * k * k);
    const Dkm = (dw + dh) / 2;
    const MA = FM * (0.16 * p + 0.58 * d2 * v.muth + Dkm / 2 * v.mub) / 1000;
    const FMmin = FM / +v.aA, nb = Math.max(1, Math.round(v.nb)), P = v.P / nb, V = v.V / nb;
    const Fmax = FM + v.phi * P, Fy = As * Rp, clamp = FMmin - (1 - v.phi) * P;
    return {As, Rp, FM, MA, FMmin, Fmax, Fy, clamp, sep: FMmin / ((1 - v.phi) * P), slip: v.mus * clamp / V, P, V};
  },
  rows: (r, v, f) => [
    ["Stress area A_s", f(r.As, "area"), "", `Yield R_p0.2 ${f(r.Rp, "stress")}`],
    ["Assembly preload F_M", f(r.FM, "force"), "", `${f.n(v.nu)}% of yield, combined with thread torsion`],
    ["Tightening torque M_A", f(r.MA, "torque"), "ok", "Set the wrench to this value"],
    ["Minimum preload F_M / α_A", f(r.FMmin, "force"), "", "What the tightening method guarantees"],
    ["Max bolt load in service", f(r.Fmax, "force"), r.Fmax <= r.Fy ? "ok" : "bad", r.Fmax <= r.Fy ? `${f.n(r.Fmax / r.Fy * 100, 3)}% of yield load` : "Above yield load"],
    ["Residual clamp per bolt", f(r.clamp, "force"), r.clamp > 0 ? "ok" : "bad", r.clamp > 0 ? `Separation margin ${f.n(r.sep, 3)}×` : "Joint opens: more or bigger bolts"],
    ["Slip margin (shear by friction)", r.V > 0 ? `${f.n(r.slip, 3)}×` : "No shear", r.V > 0 ? st(r.slip, 1.25, 1) : "", r.V > 0 ? `Shear per bolt ${f(r.V, "force")}` : ""]]});

tool({id: "pressfit", name: "Press and shrink fits", cat: "strength", pro: true,
  blurb: "Lamé thick-cylinder theory: interface pressure, hub and shaft stresses, torque and axial force capacity, and the heating needed to shrink-fit.",
  fields: [
    {id: "D", label: "Interface diameter", q: "len", value: 50}, {id: "Do", label: "Hub outside diameter", q: "len", value: 100},
    {id: "di", label: "Shaft bore (0 = solid)", q: "len", value: 0}, {id: "Lf", label: "Fit length", q: "len", value: 40},
    {id: "imode", label: "Interference", type: "select", options: sel([["custom", "Enter value"], ["n6", "H7/n6"], ["p6", "H7/p6"], ["s6", "H7/s6"]]), value: "custom"},
    {id: "delta", label: "Diametral interference", q: "small", value: 50, show: v => v.imode === "custom"},
    {id: "mat", label: "Shaft material", type: "material", value: "c45"},
    {id: "mat2", label: "Hub material", type: "material2", value: "c45"},
    {id: "mu", label: "Friction coefficient μ", value: 0.12}],
  solve(v) {
    const ms = mat(v.mat), mh = mat(v.mat2), D = v.D, Do = v.Do, di = v.di;
    let dMin, dMax, fit = null;
    if (v.imode === "custom") dMin = dMax = v.delta;
    else { fit = isoFit(D, v.imode); if (!fit) return {err: "ISO fits here cover sizes over 3 mm up to 80 mm."}; dMin = -fit.cMax; dMax = -fit.cMin; }
    const kh = (Do * Do + D * D) / (Do * Do - D * D), ks = di > 0 ? (D * D + di * di) / (D * D - di * di) : 1;
    const comp = D * ((kh + mh.nu) / mh.E + (ks - ms.nu) / ms.E);
    const p = dl => Math.max(0, dl / 1000) / comp;
    const pMin = p(dMin), pMax = p(dMax);
    const hubT = pMax * kh, shaftT = -pMax * ks;
    const vmHub = Math.sqrt(hubT * hubT + hubT * pMax + pMax * pMax);
    const vmShaft = Math.sqrt(shaftT * shaftT + shaftT * pMax + pMax * pMax);
    const torque = v.mu * pMin * PI * D * v.Lf * D / 2 / 1000, axial = v.mu * pMin * PI * D * v.Lf, press = v.mu * pMax * PI * D * v.Lf;
    const heat = (dMax / 1000 + 0.001 * D) / (mh.alpha * D);
    return {dMin, dMax, pMin, pMax, hubT, shaftT, vmHub, vmShaft, nHub: mh.Sy > 0 ? mh.Sy / vmHub : null, nShaft: ms.Sy > 0 ? ms.Sy / vmShaft : null, torque, axial, press, heat, fit};
  },
  rows: (r, v, f) => r.err ? [] : [
    ["Interference", r.dMin === r.dMax ? f(r.dMax, "small") : `${f(r.dMin, "small")} – ${f(r.dMax, "small")}`, r.dMin > 0 ? "" : "bad", r.dMin > 0 ? (r.fit ? "Smallest – largest from the ISO limits" : "") : "No guaranteed interference at the loosest limit"],
    ["Contact pressure", r.pMin === r.pMax ? f(r.pMax, "stress") : `${f(r.pMin, "stress")} – ${f(r.pMax, "stress")}`],
    ["Hub hoop stress at bore", f(r.hubT, "stress"), r.nHub === null ? "" : st(r.nHub, 1.5, 1), r.nHub === null ? "Brittle hub: compare with S_ut" : `von Mises ${f(r.vmHub, "stress")}, safety ${f.n(r.nHub, 3)} on yield`],
    ["Shaft hoop stress", f(r.shaftT, "stress"), r.nShaft === null ? "" : st(r.nShaft, 1.5, 1), r.nShaft === null ? "" : `von Mises ${f(r.vmShaft, "stress")}, safety ${f.n(r.nShaft, 3)}`],
    ["Torque capacity", f(r.torque, "torque"), "ok", "At the smallest interference"],
    ["Axial holding force", f(r.axial, "force"), "", "At the smallest interference"],
    ["Press-in force (max)", f(r.press, "force"), "", "At the largest interference"],
    ["Shrink fit: heat the hub by", f(r.heat, "dTemp"), "", "Above the shaft temperature, with 0.001·D assembly clearance"]],
  msg: r => r && r.err});

tool({id: "bearing", name: "Bearing life", cat: "strength", pro: true,
  blurb: "ISO 281 basic rating life for deep groove ball bearings (X, Y from f₀·F_a/C₀), or any bearing with P entered.",
  fields: [
    {id: "type", label: "Load model", type: "select", options: sel([["dg", "Deep groove ball"], ["ball", "Ball, P entered"], ["roller", "Roller, P entered"]]), value: "dg"},
    {id: "Fr", label: "Radial load F_r", q: "force", value: 1500}, {id: "Fa", label: "Axial load F_a", q: "force", value: 500},
    {id: "P", label: "Equivalent load P", q: "force", value: 1650, show: v => v.type !== "dg"},
    {id: "n", label: "Speed, rpm", value: 1500}, {id: "C", label: "Dynamic rating C", q: "force", value: 14800},
    {id: "C0", label: "Static rating C₀", q: "force", value: 7800}, {id: "f0", label: "Factor f₀", value: 14, show: v => v.type === "dg"},
    {id: "a1", label: "Reliability", type: "select", options: sel([["1", "90%"], ["0.64", "95%"], ["0.55", "96%"], ["0.47", "97%"], ["0.37", "98%"], ["0.25", "99%"]]), value: "1"},
    {id: "Lt", label: "Target life, hours", value: 20000}],
  solve(v) {
    const T = [[0.172, 0.19, 2.30], [0.345, 0.22, 1.99], [0.689, 0.26, 1.71], [1.03, 0.28, 1.55], [1.38, 0.30, 1.45], [2.07, 0.34, 1.31], [3.45, 0.38, 1.15], [5.17, 0.42, 1.04], [6.89, 0.44, 1.00]];
    let P = v.P, e = null, Y = null;
    if (v.type === "dg") {
      const x = v.f0 * v.Fa / v.C0;
      e = T[0][1]; Y = T[0][2];
      for (let k = 1; k < T.length; k++) if (x > T[k - 1][0]) {
        const t = Math.min(1, (x - T[k - 1][0]) / (T[k][0] - T[k - 1][0]));
        e = T[k - 1][1] + t * (T[k][1] - T[k - 1][1]); Y = T[k - 1][2] + t * (T[k][2] - T[k - 1][2]);
      }
      P = v.Fa / v.Fr <= e ? v.Fr : 0.56 * v.Fr + Y * v.Fa;
    }
    const p = v.type === "roller" ? 10 / 3 : 3, L10 = (v.C / P) ** p, L10h = L10 * 1e6 / (60 * v.n), Lh = L10h * +v.a1;
    const s0 = v.C0 / Math.max(v.Fr, 0.6 * v.Fr + 0.5 * v.Fa);
    return {P, e, Y, L10, L10h, Lh, s0};
  },
  rows: (r, v, f) => [
    ["Equivalent load P", f(r.P, "force"), "", r.e === null ? "" : `e = ${f.n(r.e, 3)}${v.Fa / v.Fr <= r.e ? ", so P = F_r" : `, Y = ${f.n(r.Y, 3)}`}`],
    ["L₁₀", `${f.n(r.L10)} million rev`, "", `${f.n(r.L10h)} h at 90% reliability`],
    ["Life at chosen reliability", `${f.n(r.Lh)} h`, r.Lh >= v.Lt ? "ok" : "bad", r.Lh >= v.Lt ? "Meets the target" : "Below the target: choose a bigger bearing"],
    ["Static safety s₀", f.n(r.s0, 3), r.s0 >= 2 ? "ok" : r.s0 >= 1 ? "warn" : "bad", r.s0 >= 2 ? "OK with shock" : r.s0 >= 1 ? "OK for smooth running" : "Too low"]]});

tool({id: "cylinder", name: "Cylinder force", cat: "strength", pro: false,
  blurb: "Pneumatic and hydraulic cylinders: push and pull force, air or oil demand, and Euler buckling of the piston rod.",
  fields: [
    {id: "type", label: "Cylinder", type: "select", options: sel([["pneu", "Pneumatic"], ["hyd", "Hydraulic"]]), value: "pneu"},
    {id: "D", label: "Bore", q: "len", value: 50}, {id: "d", label: "Rod diameter", q: "len", value: 20},
    {id: "p", label: "Supply pressure (gauge)", q: "pressure", value: 6},
    {id: "eta", label: "Efficiency (friction losses)", value: 0.9},
    {id: "stroke", label: "Stroke", q: "len", value: 200},
    {id: "cpm", label: "Cycles per minute", value: 10, show: v => v.type === "pneu"},
    {id: "vel", label: "Extend speed", q: "linSpeed", value: 50, show: v => v.type === "hyd"},
    {id: "Lr", label: "Unsupported rod length (fully extended)", q: "len", value: 300},
    {id: "mount", label: "Mounting (Euler case)", type: "select", options: sel([["2", "Fixed – free (case 1)"], ["1", "Pinned – pinned (case 2)"], ["0.7", "Fixed – pinned (case 3)"], ["0.5", "Fixed – fixed (case 4)"]]), value: "1"}],
  solve(v) {
    const A1 = PI * v.D * v.D / 4, A2 = PI * (v.D * v.D - v.d * v.d) / 4, pMPa = v.p / 10;
    const Fext = pMPa * A1 * v.eta, Fret = pMPa * A2 * v.eta;
    const I = PI * v.d ** 4 / 64, Le = +v.mount * v.Lr, Fcr = PI * PI * 210000 * I / (Le * Le);
    const r = {A1, A2, Fext, Fret, Fcr, sf: Fcr / Fext};
    if (v.type === "pneu") {
      r.perCycle = (A1 + A2) * v.stroke * 1e-6 * (v.p + 1.01325) / 1.01325;   // litres of free air
      r.air = r.perCycle * v.cpm;
    } else {
      r.flow = A1 * v.vel * 60e-6;                                         // L/min
      r.vRet = v.vel * A1 / A2;
    }
    return r;
  },
  rows: (r, v, f) => [
    ["Push force (extend)", f(r.Fext, "force"), "ok", `Piston area ${f(r.A1, "area")}`],
    ["Pull force (retract)", f(r.Fret, "force"), "", `Annulus area ${f(r.A2, "area")}`],
    ...(v.type === "pneu"
      ? [["Air per cycle", f(r.perCycle, "volume"), "", "Free air, both strokes"], ["Air consumption", f(r.air, "airFlow"), "", "Size the compressor and valve for this plus losses"]]
      : [["Pump flow to extend", f(r.flow, "flow")], ["Retract speed at the same flow", f(r.vRet, "linSpeed")]]),
    ["Rod buckling load", f(r.Fcr, "force"), "", "Euler, steel rod E = 210 GPa"],
    ["Buckling safety", `${f.n(r.sf, 3)}×`, st(r.sf, 3.5, 2), r.sf >= 3.5 ? "OK (3.5 or more is usual)" : "Low: bigger rod, shorter stroke or better mounting"]]});

/* ---------------- Machining and fabrication ---------------- */
tool({id: "feeds", name: "Speeds and feeds", cat: "make", pro: false,
  blurb: "Spindle speed, feed rate, metal removal rate, cutting force and power for turning, milling and drilling, with k<sub>c</sub> = k<sub>c1</sub>·h<sub>m</sub><sup>−mc</sup>·(1 − γ₀/100).",
  fields: [
    {id: "op", label: "Operation", type: "select", options: sel([["turn", "Turning"], ["mill", "Milling"], ["drill", "Drilling"]]), value: "turn"},
    {id: "wm", label: "Workpiece material", type: "select", options: MACHINING.map(m => [m.id, m.name]), value: "mcs"},
    {id: "tool", label: "Tool", type: "select", options: sel([["carbide", "Coated carbide"], ["hss", "HSS"]]), value: "carbide"},
    {id: "vmode", label: "Cutting speed", type: "select", options: sel([["rec", "Use the starting value for this material"], ["custom", "Enter my own"]]), value: "rec"},
    {id: "vc", label: "Cutting speed v_c", q: "cutSpeed", value: 180, show: v => v.vmode === "custom"},
    {id: "D", label: "Diameter (workpiece for turning, tool otherwise)", q: "len", value: 50},
    {id: "fn", label: "Feed per revolution f_n", q: "len", value: 0.2, show: v => v.op !== "mill"},
    {id: "fz", label: "Feed per tooth f_z", q: "len", value: 0.1, show: v => v.op === "mill"},
    {id: "z", label: "Number of teeth", value: 4, show: v => v.op === "mill"},
    {id: "ap", label: "Depth of cut a_p", q: "len", value: 2, show: v => v.op !== "drill"},
    {id: "ae", label: "Width of cut a_e", q: "len", value: 25, show: v => v.op === "mill"},
    {id: "kr", label: "Entering angle κ_r, °", value: 90, show: v => v.op !== "drill"},
    {id: "pa", label: "Drill point angle, °", value: 140, show: v => v.op === "drill"},
    {id: "rake", label: "Effective rake angle γ₀, °", value: 6},
    {id: "re", label: "Nose radius r_ε", q: "len", value: 0.8, show: v => v.op === "turn"},
    {id: "Lc", label: "Length of cut", q: "len", value: 100},
    {id: "eta", label: "Machine efficiency", value: 0.8}],
  solve(v) {
    const m = mmat(v.wm), vc = v.vmode === "custom" ? v.vc : m[v.tool], D = v.D;
    const n = 1000 * vc / (PI * D);
    let vf, hm, Q, Pc, extra = {};
    if (v.op === "turn") {
      vf = v.fn * n; hm = v.fn * Math.sin(rad(v.kr));
      Q = vc * v.ap * v.fn;
      extra.Rmax = 125 * v.fn * v.fn / v.re; extra.Ra = extra.Rmax / 4;
    } else if (v.op === "mill") {
      const ae = Math.min(v.ae, D);
      vf = v.fz * v.z * n;
      hm = Math.sin(rad(v.kr)) * ae * v.fz / (D * Math.asin(ae / D));
      Q = v.ap * ae * vf / 1000;
    } else {
      vf = v.fn * n; hm = v.fn / 2 * Math.sin(rad(v.pa / 2));
      Q = D * v.fn * vc / 4;
    }
    const kc = m.kc1 * hm ** -m.mc * (1 - v.rake / 100);
    if (v.op === "turn") { Pc = vc * v.ap * v.fn * kc / 60000; extra.Fc = kc * v.ap * v.fn; }
    else if (v.op === "mill") Pc = v.ap * Math.min(v.ae, D) * vf * kc / 60e6;
    else { Pc = v.fn * vc * D * kc / 240e3; extra.Ff = 0.5 * kc * (D / 2) * v.fn * Math.sin(rad(v.pa / 2)); }
    const Mc = Pc * 30e3 / (PI * n);
    return {vc, n, vf, hm, kc, Q, Pc, Pm: Pc / v.eta, Mc, time: v.Lc / vf, ...extra};
  },
  rows: (r, v, f) => [
    ["Spindle speed", `${f.n(r.n)} rpm`, "ok", `At v_c = ${f(r.vc, "cutSpeed")}${v.vmode === "rec" ? " (starting value; tune from the tool maker's data)" : ""}`],
    ["Feed rate", f(r.vf, "feedRate"), "ok"],
    ["Metal removal rate", f(r.Q, "mrr")],
    ["Chip thickness h_m", f(r.hm, "len"), "", `Specific cutting force k_c ${f(r.kc, "stress")}`],
    ...(v.op === "turn" ? [["Cutting force F_c", f(r.Fc, "force")]] : []),
    ...(v.op === "drill" ? [["Feed (thrust) force", f(r.Ff, "force"), "", "Approximate"]] : []),
    ["Power at the spindle", f(r.Pc, "power"), "", `Motor power needed ${f(r.Pm, "power")}`],
    ["Spindle torque", f(r.Mc, "torque")],
    ...(v.op === "turn" ? [["Theoretical roughness", `Ra ${f.n(r.Ra, 3)} µm`, "", `R_max ${f.n(r.Rmax, 3)} µm from feed and nose radius; real finish is rougher`]] : []),
    ["Time for the cut", `${f.n(r.time * 60, 3)} s`, "", `${f(v.Lc, "len")} at ${f(r.vf, "feedRate")}`]]});

tool({id: "bend", name: "Sheet metal bending", cat: "make", pro: true,
  blurb: "Bend allowance, bend deduction and flat length. Flange lengths are outside dimensions to the virtual sharp.",
  fields: [
    {id: "T", label: "Thickness T", q: "len", value: 2}, {id: "R", label: "Inside bend radius R", q: "len", value: 2},
    {id: "ang", label: "Bend angle (90 for an L), °", value: 90},
    {id: "kmode", label: "K-factor", type: "select", options: sel([["din", "From DIN 6935 (R/T)"], ["manual", "Enter my own"]]), value: "din"},
    {id: "K", label: "K-factor", value: 0.44, show: v => v.kmode === "manual"},
    {id: "A", label: "Flange A (outside)", q: "len", value: 50}, {id: "B", label: "Flange B (outside)", q: "len", value: 50}],
  solve(v) {
    const RT = v.R / v.T;
    const K = v.kmode === "manual" ? v.K : RT >= 5 ? 0.5 : Math.min(0.5, Math.max(0, (0.65 + 0.5 * Math.log10(RT)) / 2));
    const th = rad(v.ang), BA = th * (v.R + K * v.T), OSSB = Math.tan(th / 2) * (v.R + v.T), BD = 2 * OSSB - BA;
    return {RT, K, BA, OSSB, BD, flat: v.A + v.B - BD, neutral: v.R + K * v.T};
  },
  rows: (r, v, f) => [
    ["K-factor", f.n(r.K, 3), "", `R/T = ${f.n(r.RT, 3)}${v.kmode === "din" ? (r.RT < 0.65 ? "; DIN 6935 is meant for R/T ≥ 0.65" : "; DIN 6935") : ""}`],
    ["Bend allowance", f(r.BA, "len"), "", `Neutral axis radius ${f(r.neutral, "len")}`],
    ["Outside setback", f(r.OSSB, "len")],
    ["Bend deduction", f(r.BD, "len")],
    ["Flat length", f(r.flat, "len"), "ok", "A + B − bend deduction"],
    ["Minimum bend radius", r.RT >= 1 ? "R ≥ T: fine for most materials" : "Tight radius", r.RT >= 1 ? "ok" : "warn", "Typical minimum for 90°: mild steel 0.5–1 T, 304 stainless 0.5–1 T, 5052-H32 1 T, 6061-T6 2–3 T (bend across the grain)"]]});

const STOCK = {
  round: v => PI * v.d * v.d / 4,
  hex: v => Math.sqrt(3) / 2 * v.s * v.s,
  rect: v => v.b * v.h,
  tube: v => PI * (v.D * v.D - (v.D - 2 * v.t) ** 2) / 4,
  rhs: v => v.B * v.H - (v.B - 2 * v.t) * (v.H - 2 * v.t),
  angle: v => v.t * (2 * v.a - v.t)
};
tool({id: "weight", name: "Stock weight", cat: "make", pro: false,
  blurb: "Weight of bar, tube, plate and angle from nominal dimensions (corner radii of tubes and angles are ignored, so real sections are slightly lighter).",
  fields: [
    {id: "shape", label: "Shape", type: "select", options: sel([["round", "Round bar"], ["hex", "Hex bar"], ["rect", "Flat bar, square bar or plate"], ["tube", "Round tube or pipe"], ["rhs", "Rectangular or square tube"], ["angle", "Equal angle"]]), value: "round"},
    {id: "d", label: "Diameter", q: "len", value: 50, show: v => v.shape === "round"},
    {id: "s", label: "Across flats", q: "len", value: 30, show: v => v.shape === "hex"},
    {id: "b", label: "Width", q: "len", value: 100, show: v => v.shape === "rect"},
    {id: "h", label: "Thickness", q: "len", value: 10, show: v => v.shape === "rect"},
    {id: "D", label: "Outside diameter", q: "len", value: 48.3, show: v => v.shape === "tube"},
    {id: "B", label: "Outside width", q: "len", value: 50, show: v => v.shape === "rhs"},
    {id: "H", label: "Outside height", q: "len", value: 50, show: v => v.shape === "rhs"},
    {id: "a", label: "Leg length", q: "len", value: 50, show: v => v.shape === "angle"},
    {id: "t", label: "Wall / leg thickness", q: "len", value: 3, show: v => ["tube", "rhs", "angle"].includes(v.shape)},
    {id: "L", label: "Length", q: "len", value: 1000}, {id: "qty", label: "Quantity", value: 1},
    {id: "mat", label: "Material", type: "material", value: "e250"}],
  solve(v) {
    const A = STOCK[v.shape](v), rho = mat(v.mat).rho, perM = A * 1e-6 * rho, each = perM * v.L / 1000;
    return {A, perM, each, total: each * v.qty, rho};
  },
  rows: (r, v, f) => [
    ["Weight each", f(r.each, "mass"), "ok"], ["Total", f(r.total, "mass"), "", `${Math.round(v.qty)} piece${Math.round(v.qty) === 1 ? "" : "s"}`],
    ["Weight per length", f(r.perM, "massLen")], ["Cross-section area", f(r.A, "area"), "", `Density ${f(r.rho, "density")}`]]});

tool({id: "fits", name: "Fits and tolerances", cat: "make", pro: false,
  blurb: "ISO 286 hole-basis fits, H7 hole with the shaft you choose, for sizes over 3 mm up to 80 mm. ISO fits are metric, so this tool always works in mm and µm.",
  fields: [
    {id: "D", label: "Nominal size, mm", value: 25},
    {id: "s", label: "Shaft", type: "select", options: sel([["f7", "f7 running"], ["g6", "g6 sliding"], ["h6", "h6 locating"], ["k6", "k6 transition"], ["n6", "n6 transition"], ["p6", "p6 light press"], ["s6", "s6 medium drive"]]), value: "k6"}],
  solve(v) { const r = isoFit(v.D, v.s); return r || {err: "Sizes over 3 mm up to 80 mm are covered. Use ISO 286-2 for others."}; },
  rows: (r, v, f) => {
    if (r.err) return [];
    const use = {f7: "Running clearance: shafts in plain bushes", g6: "Close sliding: guide pins, sliding gears", h6: "Locating clearance: spigots, hand assembly", k6: "Transition: bearing inner rings, keyed hubs", n6: "Transition: firm location, mallet or press", p6: "Light press: bushes, dowels", s6: "Medium drive: permanent, torque without keys"};
    const mm = x => (v.D + x / 1000).toFixed(3), sg = x => (x > 0 ? "+" : "") + x;
    const word = x => x >= 0 ? `${x} µm clearance` : `${-x} µm interference`;
    return [[`Hole Ø${v.D} H7`, `${mm(r.hl)} – ${mm(r.hu)}`, "", `${sg(r.hu)} / ${sg(r.hl)} µm`],
      [`Shaft Ø${v.D} ${v.s}`, `${mm(r.sl)} – ${mm(r.su)}`, "", `${sg(r.su)} / ${sg(r.sl)} µm`],
      ["Loosest", word(r.cMax)], ["Tightest", word(r.cMin)],
      ["Fit type", r.cMin >= 0 ? "Clearance" : r.cMax <= 0 ? "Interference" : "Transition", "ok", use[v.s]]];
  },
  msg: r => r && r.err});

tool({id: "pattern", name: "Bolt patterns", cat: "make", pro: false,
  blurb: "Hole coordinates on a bolt circle (PCD). Angles are measured counter-clockwise from +X.",
  fields: [
    {id: "N", label: "Number of holes", value: 6}, {id: "pcd", label: "Pitch circle diameter", q: "len", value: 100},
    {id: "a0", label: "Start angle, °", value: 0}, {id: "cx", label: "Centre X", q: "len", value: 0}, {id: "cy", label: "Centre Y", q: "len", value: 0},
    {id: "d", label: "Hole diameter", q: "len", value: 9}],
  solve(v) {
    const N = Math.max(2, Math.round(v.N)), R = v.pcd / 2, step = 360 / N;
    const pts = [...Array(N)].map((_, k) => { const a = rad(v.a0 + k * step); return {x: v.cx + R * Math.cos(a), y: v.cy + R * Math.sin(a), ang: v.a0 + k * step}; });
    const chord = v.pcd * Math.sin(PI / N);
    return {N, R, step, chord, lig: chord - v.d, pts};
  },
  rows: (r, v, f) => [
    ["Angle between holes", `${f.n(r.step, 5)}°`], ["Chord spacing", f(r.chord, "len", 5)],
    ["Ligament between holes", f(r.lig, "len"), r.lig >= v.d ? "ok" : r.lig > 0 ? "warn" : "bad", r.lig >= v.d ? "OK" : r.lig > 0 ? "Less than one hole diameter" : "Holes overlap"]],
  extra(r, v, f) {
    const s = 100 / (r.R + v.d), ext = 115;
    const svg = `<svg viewBox="${-ext} ${-ext} ${2 * ext} ${2 * ext}" role="img" aria-label="Bolt pattern preview">
      <line x1="${-ext}" x2="${ext}" y1="0" y2="0" class="cl"/><line y1="${-ext}" y2="${ext}" x1="0" x2="0" class="cl"/>
      <circle r="${r.R * s}" class="pcd"/>
      ${r.pts.map((p, k) => { const x = (p.x - v.cx) * s, y = -(p.y - v.cy) * s; return `<circle cx="${x}" cy="${y}" r="${Math.max(v.d / 2 * s, 2)}" class="hole"/><text x="${x * 1.2}" y="${y * 1.2 + 3}" text-anchor="middle">${k + 1}</text>`; }).join("")}</svg>`;
    const rows = r.pts.map((p, k) => `<tr><td>${k + 1}</td><td class="n">${f.n(p.ang, 5)}°</td><td class="n">${f(p.x, "len", 5)}</td><td class="n">${f(p.y, "len", 5)}</td></tr>`).join("");
    return `<div class="pattern">${svg}</div><div class="tw coords"><table><tr><th>Hole</th><th class="n">Angle</th><th class="n">X</th><th class="n">Y</th></tr>${rows}</table></div>`;
  }});

/* ---------------- Home and HVAC ---------------- */
// Summer design conditions (outdoor dry bulb °C, relative humidity %) for Indian climate types.
const AC_CLIMATES = {
  dry:   {name: "Very hot and dry (Delhi, Jaipur, Nagpur, Ahmedabad)", To: 43, RH: 20},
  humid: {name: "Hot and humid (Mumbai, Chennai, Kolkata, Kochi)", To: 35, RH: 60},
  warm:  {name: "Warm (Bengaluru, Pune, Hyderabad)", To: 35, RH: 35},
  custom: {name: "Enter my own"}
};
// Peak solar heat through clear single glass, W/m², for Indian latitudes in May–June.
const AC_SUN = {west: 500, east: 450, south: 200, north: 100, shaded: 80};
const AC_SIZES = [0.75, 1, 1.5, 2, 2.5, 3];
const satP = T => 0.61094 * Math.exp(17.625 * T / (T + 243.04));            // kPa, Magnus formula
const humRatio = (T, RH) => { const pv = satP(T) * RH / 100; return 622 * pv / (101.325 - pv); };   // g/kg dry air
tool({id: "ac", name: "AC size and star rating", cat: "home", pro: false,
  blurb: "Works out the room's peak summer heat load piece by piece, picks the AC size, and compares running costs of a 3-star and a 5-star unit. Every number in the breakdown can be checked by hand.",
  fields: [
    {id: "L", label: "Room length", q: "lenM", value: 4}, {id: "W", label: "Room width", q: "lenM", value: 3.5},
    {id: "H", label: "Ceiling height", q: "lenM", value: 3},
    {id: "climate", label: "Climate", type: "select", options: Object.entries(AC_CLIMATES).map(([k, c]) => [k, c.name]), value: "dry"},
    {id: "To", label: "Outdoor temperature", q: "temp", value: 40, show: v => v.climate === "custom"},
    {id: "RH", label: "Outdoor humidity, %", value: 40, show: v => v.climate === "custom"},
    {id: "Ti", label: "AC set temperature", q: "temp", value: 24},
    {id: "walls", label: "Walls facing outside (0–4)", value: 2},
    {id: "wall", label: "Wall construction", type: "select", options: sel([["2.1", "Brick, 9 in (230 mm), plastered"], ["3.0", "Brick, 4.5 in (115 mm), plastered"], ["0.9", "AAC block, 200 mm"], ["0.5", "Insulated wall"]]), value: "2.1"},
    {id: "sunwall", label: "Sun on those walls", type: "select", options: sel([["0", "Shaded most of the day"], ["5", "Some sun"], ["12", "Strong afternoon sun"]]), value: "5"},
    {id: "top", label: "Roof above the room", type: "select", options: sel([["no", "Another floor (no roof)"], ["3.1", "Top floor, bare RCC roof"], ["1.2", "Top floor, insulated or shaded roof"]]), value: "no"},
    {id: "nwin", label: "Number of windows", value: 1},
    {id: "ww", label: "Window width", q: "lenM", value: 1.2, show: v => v.nwin > 0},
    {id: "wh", label: "Window height", q: "lenM", value: 1.2, show: v => v.nwin > 0},
    {id: "face", label: "Windows face", type: "select", options: sel([["west", "West (afternoon sun)"], ["east", "East (morning sun)"], ["south", "South"], ["north", "North"], ["shaded", "Shaded by buildings or trees"]]), value: "west", show: v => v.nwin > 0},
    {id: "shade", label: "Window covering", type: "select", options: sel([["1", "None (clear glass)"], ["0.65", "Curtains or blinds"], ["0.5", "Sun-control film or tinted glass"], ["0.4", "Outside sunshade (chajja) or awning"]]), value: "0.65", show: v => v.nwin > 0},
    {id: "people", label: "People usually in the room", value: 2},
    {id: "lights", label: "Lights", q: "heat", value: 40},
    {id: "appl", label: "Appliances running (TV, PC…)", q: "heat", value: 150},
    {id: "ach", label: "Air leakage", type: "select", options: sel([["0.5", "Well sealed"], ["1", "Normal"], ["2", "Leaky, or door opened often"]]), value: "1"},
    {id: "hours", label: "AC use, hours per day", value: 8},
    {id: "days", label: "Days per year (8 months ≈ 240)", value: 240},
    {id: "tariff", label: "Electricity rate, ₹ per kWh", value: 8},
    {id: "s3", label: "3-star ISEER (from the BEE label)", value: 4.2},
    {id: "s5", label: "5-star ISEER (from the BEE label)", value: 5.2},
    {id: "dp", label: "Extra price of the 5-star, ₹", value: 6000},
    {id: "life", label: "Years you'll keep the AC", value: 10}],
  solve(v) {
    const c = AC_CLIMATES[v.climate] || AC_CLIMATES.dry;
    const To = v.climate === "custom" ? v.To : c.To, RH = v.climate === "custom" ? v.RH : c.RH;
    const dT = To - v.Ti, floor = v.L * v.W, vol = floor * v.H;
    const nwin = Math.max(0, Math.round(v.nwin)), Awin = nwin * v.ww * v.wh;
    const walls = Math.min(4, Math.max(0, v.walls));
    const Awall = Math.max(0, walls / 4 * 2 * (v.L + v.W) * v.H - Awin);    // average of long and short walls
    const Uw = +v.wall, dTw = dT + +v.sunwall, roofU = v.top === "no" ? 0 : +v.top, dTr = dT + 20;
    const sun = AC_SUN[v.face] || 0, sc = +v.shade, ach = +v.ach;
    const dw = Math.max(0, humRatio(To, RH) - humRatio(v.Ti, 50));
    const n = Math.max(0, Math.round(v.people));
    const lines = [
      ["Walls", "U × area × (ΔT + sun)", `${Uw} × ${Awall.toFixed(2)} m² × ${dTw.toFixed(1)} K`, Uw * Awall * dTw, "s"],
      ["Roof", roofU ? "U × area × (ΔT + 20 K sun on roof)" : "Floor above is lived in", roofU ? `${roofU} × ${floor.toFixed(2)} m² × ${dTr.toFixed(1)} K` : "—", roofU * floor * dTr, "s"],
      ["Window glass (heat)", "5.8 W/m²K × glass area × ΔT", `5.8 × ${Awin.toFixed(2)} m² × ${dT.toFixed(1)} K`, 5.8 * Awin * dT, "s"],
      ["Window glass (sun)", "solar gain × covering factor × area", `${sun} W/m² × ${sc} × ${Awin.toFixed(2)} m²`, sun * sc * Awin, "s"],
      ["People (heat)", "75 W each", `75 × ${n}`, 75 * n, "s"],
      ["People (moisture)", "55 W each", `55 × ${n}`, 55 * n, "l"],
      ["Lights", "as entered", `${v.lights.toFixed(0)} W`, v.lights, "s"],
      ["Appliances", "as entered", `${v.appl.toFixed(0)} W`, v.appl, "s"],
      ["Outside air (heat)", "0.335 × air changes/h × volume × ΔT", `0.335 × ${ach} × ${vol.toFixed(1)} m³ × ${dT.toFixed(1)} K`, 0.335 * ach * vol * dT, "s"],
      ["Outside air (moisture)", "0.834 × air changes/h × volume × Δw", `0.834 × ${ach} × ${vol.toFixed(1)} m³ × ${dw.toFixed(1)} g/kg`, 0.834 * ach * vol * dw, "l"]
    ];
    const sens = lines.filter(l => l[4] === "s").reduce((s, l) => s + l[3], 0), lat = lines.filter(l => l[4] === "l").reduce((s, l) => s + l[3], 0);
    const total = (sens + lat) * 1.1;                                       // 10% margin
    const tr = total / 3517;
    // AC capacity is rated at 35 °C outdoors (ISO 5151 T1) and falls about 1% per °C hotter.
    const derate = To > 35 ? 1 - 0.01 * (To - 35) : 1, rated = tr / derate;
    const size = AC_SIZES.find(s => s >= rated) || null;
    const capKW = (size || rated) * 3.517, hrs = v.hours * v.days;
    const e3 = capKW * hrs / v.s3, e5 = capKW * hrs / v.s5;
    const save = (e3 - e5) * v.tariff, payback = save > 0 ? v.dp / save : Infinity;
    return {To, RH, dT, floor, vol, Awin, Awall, dw, lines, sens, lat, total, tr, derate, rated, size, hrs, e3, e5, save, payback,
      net: save * v.life - v.dp, thumb: floor / 0.09290304 / 120, shr: sens / (sens + lat)};
  },
  rows: (r, v, f) => {
    const g = (x, d = 0) => x.toLocaleString("en-US", {maximumFractionDigits: d});
    const temp = x => `${g(toDisp("temp", x, f.sys), 1)} ${unit("temp", f.sys)}`;
    const good = r.payback <= Math.min(4, v.life / 2), ok = r.payback <= v.life;
    return [
      ["Recommended AC", r.size ? `${r.size} ton` : "Over 3 tons", "ok", r.size ? `Needs ${g(r.rated, 2)} TR of rated capacity` : "Use two units or a ducted system"],
      ["Peak heat load", f(r.total, "heat"), "", `${g(r.total / 1000, 2)} kW = ${g(r.tr, 2)} TR with a 10% margin (1 TR = 3,517 W)`],
      ["Hot-weather capacity loss", r.derate < 1 ? `${g((1 - r.derate) * 100)}%` : "None", "", r.derate < 1 ? `ACs are rated at 35 °C outside; at ${temp(r.To)} they give about ${g(r.derate * 100)}%. Inverter models rated for 52 °C hold up better` : "Outdoor design is 35 °C or cooler"],
      ["Heat / moisture split", `${g(r.shr * 100)}% / ${g((1 - r.shr) * 100)}%`, "", r.shr < 0.75 ? "Humid load: an AC with a dry mode helps" : "Mostly heat"],
      ["Room", `${f(r.floor, "areaM")} · ${f(r.vol, "volM")}`, "", `Shop rule of thumb (120 ft² per ton) says ${g(r.thumb, 2)} TR`],
      ["Design conditions", `${temp(r.To)} outside, ${g(r.RH)}% RH`, "", `Inside ${temp(v.Ti)} at 50% RH, ΔT = ${g(toDisp("dTemp", r.dT, f.sys), 1)} ${unit("dTemp", f.sys)}`],
      ["Power used per year", `3★ ${g(r.e3)} kWh · 5★ ${g(r.e5)} kWh`, "", `${g(r.hrs)} hours a year × capacity ÷ ISEER`],
      ["5-star saves per year", `₹${g(r.save)}`, "", `${g(r.e3 - r.e5)} kWh × ₹${g(v.tariff, 2)} per kWh`],
      ["Payback of the 5-star", isFinite(r.payback) ? `${g(r.payback, 1)} years` : "Never", good ? "ok" : ok ? "warn" : "bad",
        good ? `Buy the 5-star: it comes out ₹${g(Math.max(0, r.net))} ahead over ${g(v.life)} years`
          : ok ? `Close call: the 5-star gains only ₹${g(Math.max(0, r.net))} over ${g(v.life)} years, so a 3-star is enough`
          : `A 3-star is enough at ${g(v.hours, 1)} hours a day`]];
  },
  extra(r, v, f) {
    const row = l => `<tr><td>${l[0]}</td><td>${l[1]}</td><td class="n">${l[2]}</td><td class="n">${f(l[3], "heat")}</td></tr>`;
    return `<h3 style="margin:22px 0 8px">The calculation</h3>
      <div class="tw"><table><tr><th>Heat source</th><th>Formula</th><th class="n">Numbers</th><th class="n">Heat</th></tr>
      ${r.lines.map(row).join("")}
      <tr><th colspan="3">Sum (heat ${f(r.sens, "heat")} + moisture ${f(r.lat, "heat")})</th><th class="n">${f(r.sens + r.lat, "heat")}</th></tr>
      <tr><td colspan="3">With 10% margin, ÷ 3,517 W per ton</td><td class="n">${f(r.total, "heat")} = ${f.n(r.tr, 3)} TR</td></tr>
      <tr><td colspan="3">÷ hot-weather factor ${f.n(r.derate, 3)} = rated capacity needed</td><td class="n">${f.n(r.rated, 3)} TR → ${r.size ? r.size + " ton" : "over 3 tons"}</td></tr></table></div>
      <p class="note">ΔT = outdoor − indoor temperature. U values are in W/m²·K for typical Indian construction. Window sun gains are peak values for clear glass in May–June; the covering factor reduces them. Moisture uses outdoor humidity ${f.n(humRatio(r.To, r.RH), 3)} g/kg against ${f.n(humRatio(v.Ti, 50), 3)} g/kg indoors (Δw = ${f.n(r.dw, 3)}). Running cost: energy = capacity × hours ÷ ISEER, the same basis as the BEE label (which quotes 1,600 hours a year). Check the ISEER printed on the two models you are comparing.</p>`;
  }});

/* ---------------- Reference ---------------- */
tool({id: "thermal", name: "Thermal expansion", cat: "ref", pro: false,
  blurb: "Free growth of a part, the stress if it is held rigidly, and how a fit between two materials changes with temperature.",
  fields: [
    {id: "mat", label: "Part (shaft) material", type: "material", value: "e250"},
    {id: "L", label: "Length", q: "len", value: 1000},
    {id: "T1", label: "From temperature", q: "temp", value: 20}, {id: "T2", label: "To temperature", q: "temp", value: 70},
    {id: "A", label: "Cross-section area (for force if restrained)", q: "area", value: 100},
    {id: "mat2", label: "Mating part (hub) material", type: "material2", value: "al6061"},
    {id: "D", label: "Fit diameter", q: "len", value: 50}],
  solve(v) {
    const m = mat(v.mat), h = mat(v.mat2), dT = v.T2 - v.T1;
    const dL = m.alpha * v.L * dT, sigma = -m.E * m.alpha * dT;
    return {dT, dL, strain: m.alpha * dT, dD: m.alpha * v.D * dT, sigma, F: Math.abs(sigma) * v.A, n: m.Sy > 0 ? m.Sy / Math.abs(sigma) : null,
      clr: (h.alpha - m.alpha) * v.D * dT * 1000, alpha: m.alpha * 1e6, alpha2: h.alpha * 1e6};
  },
  rows: (r, v, f) => [
    ["Change in length", f(r.dL, "len"), "ok", `α = ${f(r.alpha, "alpha")}, ΔT = ${f(r.dT, "dTemp")}`],
    ["Change in diameter", f(r.dD, "len")],
    ["Stress if fully restrained", f(r.sigma, "stress"), r.n === null ? "" : st(r.n, 1.5, 1), `${r.sigma < 0 ? "Compressive" : "Tensile"}; force ${f(r.F, "force")}`],
    ["Change in fit clearance", f(r.clr, "small"), "", r.clr >= 0 ? `Fit loosens (hub α = ${f(r.alpha2, "alpha")})` : `Fit tightens (hub α = ${f(r.alpha2, "alpha")})`]]});

tool({id: "units", name: "Unit conversion", cat: "ref", pro: false,
  blurb: "Convert a value into every unit of its kind.",
  fields: [
    {id: "cat", label: "Quantity", type: "select", options: Object.entries(UNITS).map(([k, c]) => [k, c.name]), value: "torque"},
    {id: "x", label: "Value", value: 25},
    {id: "from", label: "From", type: "select", options: v => UNITS[v.cat].u.map(u => [u[0], u[1]]), value: "Nm"}],
  solve(v) {
    if (v.cat === "temp") {
      const K = v.from === "C" ? v.x + 273.15 : v.from === "F" ? (v.x - 32) * 5 / 9 + 273.15 : v.x;
      return {list: [["°C", K - 273.15], ["°F", (K - 273.15) * 9 / 5 + 32], ["K", K]]};
    }
    const c = UNITS[v.cat], u = c.u.find(u => u[0] === v.from) || c.u[0], base = v.x * u[2];
    return {list: c.u.map(w => [w[1], base / w[2], w[0] === u[0]])};
  },
  rows: (r, v, f) => r.list.map(([k, x, me]) => [k, Math.abs(x) >= 1e9 || (x !== 0 && Math.abs(x) < 1e-4) ? x.toExponential(5) : x.toLocaleString("en-US", {maximumSignificantDigits: 6}), me ? "ok" : ""])});

const CATS = [["motion", "Power and motion"], ["strength", "Strength"], ["make", "Machining and fabrication"], ["home", "Home and HVAC"], ["ref", "Reference"]];

const MM = {QTY, unit, toDisp, toSI, fmtNum, formatter, MATERIALS, MAT_OPTIONS, MACHINING, BOLTS, DEV, FIT_RANGES, isoFit, UNITS, TOOLS, CATS, mat};
if (typeof module === "object" && module.exports) module.exports = MM; else root.MM = MM;
})(typeof window !== "undefined" ? window : globalThis);
