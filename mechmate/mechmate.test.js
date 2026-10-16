// Accuracy tests for the MechMate formulas: node --test mechmate.test.js
// Expected values are hand calculations, published table values, or cross-checks between
// two independent formulas that must agree.
const test = require("node:test");
const assert = require("node:assert");
const MM = require("./mechmate-tools.js");

const tool = id => MM.TOOLS.find(t => t.id === id);
function run(id, over = {}) {
  const t = tool(id), v = {};
  t.fields.forEach(f => v[f.id] = f.value);
  Object.assign(v, over);
  return t.solve(v);
}
function near(actual, expected, rel = 1e-4, msg = "") {
  const tol = Math.abs(expected) * rel + 1e-12;
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} expected ${expected}, got ${actual}`);
}

test("every tool solves its defaults and builds rows in both unit systems", () => {
  for (const t of MM.TOOLS) {
    const v = {}; t.fields.forEach(f => v[f.id] = f.value);
    const r = t.solve(v);
    assert.ok(r, t.id);
    for (const sys of ["si", "imp"]) {
      const rows = t.rows(r, v, MM.formatter(sys));
      assert.ok(Array.isArray(rows) && rows.length > 0, t.id);
      rows.forEach(row => assert.ok(!String(row[1]).includes("NaN") && !String(row[1]).includes("undefined"), `${t.id} ${sys}: ${row}`));
    }
  }
});

test("unit conversions round-trip and match definitions", () => {
  near(MM.toSI("len", 1, "imp"), 25.4);
  near(MM.toDisp("temp", 100, "imp"), 212);
  near(MM.toSI("temp", 32, "imp"), 0);
  near(MM.toSI("torque", 1, "imp"), 1.3558179483314);
  near(MM.toSI("stress", 1000, "imp"), 6.89475729317);
  near(MM.toSI("power", 1, "imp"), 0.745699871582);
  for (const q of Object.keys(MM.QTY)) near(MM.toSI(q, MM.toDisp(q, 123.456, "imp"), "imp"), 123.456, 1e-12, q);
  const u = run("units", {cat: "length", x: 1, from: "in"}).list.find(r => r[0] === "mm");
  near(u[1], 25.4);
  near(run("units", {cat: "temp", x: 100, from: "C"}).list[1][1], 212);
});

test("torque, power and speed", () => {
  near(run("power", {solve: "torque", P: 7.5, n: 1440}).T, 49.73592);
  near(run("power", {solve: "power", T: 100, n: 1000}).P, 10.47198);
});

test("gear train", () => {
  const r = run("gear");
  near(r.i, 9); near(r.nout, 160); near(r.tout, 50 * 9 * 0.98 ** 2);
});

test("beam: textbook cases", () => {
  // Cantilever, end load: δ = PL³/3EI, σ = PLc/I. E = 205 GPa, 20 × 40 rectangle.
  const I = 20 * 40 ** 3 / 12, EI = 205000 * I;
  let r = run("beam", {support: "cant", load: "end"});
  near(r.dmax, 1000 * 500 ** 3 / (3 * EI)); near(r.dmax, 1.905488, 1e-5);
  near(r.sigma, 93.75); near(r.slope, 0.327533, 1e-4);
  // Point at distance a = L reproduces the end-load case.
  near(run("beam", {support: "cant", load: "pointA", a: 500}).dmax, r.dmax);
  // Simply supported: off-centre formula at a = L/2 equals the centre formula PL³/48EI.
  const c = run("beam", {support: "ss", load: "centre", L: 1000});
  near(c.dmax, 1000 * 1e9 / (48 * EI));
  near(run("beam", {support: "ss", load: "pointA", L: 1000, a: 500}).dmax, c.dmax, 1e-9);
  // Off-centre load is symmetric: a and L − a give the same deflection.
  near(run("beam", {support: "ss", load: "pointA", L: 1000, a: 300}).dmax, run("beam", {support: "ss", load: "pointA", L: 1000, a: 700}).dmax, 1e-9);
  // UDL: 5wL⁴/384EI simply supported, wL⁴/384EI fixed-fixed; M = wL²/8.
  r = run("beam", {support: "ss", load: "udl", L: 1000, w: 2});
  near(r.dmax, 1.190930, 1e-5); near(r.M, 250);
  near(run("beam", {support: "ff", load: "udl", L: 1000, w: 2}).dmax, r.dmax / 5);
  // Fixed-fixed centre load is 1/4 of simply supported.
  near(run("beam", {support: "ff", load: "centre", L: 1000}).dmax, c.dmax / 4);
  // Section properties.
  near(run("beam", {sec: "round", d: 30}).I, Math.PI * 30 ** 4 / 64);
  near(run("beam", {sec: "tube", D: 40, t: 3}).I, Math.PI * (40 ** 4 - 34 ** 4) / 64);
  near(run("beam", {sec: "rhs", B: 40, H: 60, t: 3}).I, (40 * 60 ** 3 - 34 * 54 ** 3) / 12);
});

test("bolts: VDI 2230 table values (μ = 0.12, 90% utilisation, 8.8)", () => {
  const m10 = run("bolt", {size: "M10", cls: "8.8"});
  near(m10.As, 57.99, 2e-3);
  near(m10.FM, 29600, 0.01, "M10 F_M");
  near(m10.MA, 48, 0.02, "M10 M_A");
  const m8 = run("bolt", {size: "M8", cls: "8.8"});
  near(m8.As, 36.6, 2e-3);
  near(m8.FM, 18600, 0.01, "M8 F_M");
  near(m8.MA, 24.6, 0.02, "M8 M_A");
  const m12 = run("bolt", {size: "M12", cls: "10.9"});
  near(m12.As, 84.3, 2e-3);
});

test("press fit: same-material closed form p = Eδ/2D · (1 − D²/Do²)", () => {
  const r = run("pressfit", {imode: "custom", delta: 50, D: 50, Do: 100, di: 0, mat: "c45", mat2: "c45"});
  near(r.pMax, 205000 * 0.05 / 100 * 0.75);
  near(r.hubT, r.pMax * (100 ** 2 + 50 ** 2) / (100 ** 2 - 50 ** 2));
  near(r.torque, 0.12 * r.pMax * Math.PI * 50 * 40 * 25 / 1000);
  const fit = run("pressfit", {imode: "p6", D: 25, Do: 50});
  assert.strictEqual(fit.dMin, 1); assert.strictEqual(fit.dMax, 35);
});

test("sheet metal bending", () => {
  const r = run("bend", {T: 2, R: 2, ang: 90, kmode: "manual", K: 0.4, A: 50, B: 50});
  near(r.BA, Math.PI / 2 * 2.8); near(r.OSSB, 4); near(r.flat, 100 - (8 - Math.PI / 2 * 2.8));
  near(run("bend", {T: 2, R: 2, kmode: "din"}).K, 0.325);
  near(run("bend", {T: 2, R: 12, kmode: "din"}).K, 0.5);
});

test("stock weight", () => {
  near(run("weight", {shape: "round", d: 50, L: 1000, mat: "e250"}).each, 15.4134, 1e-4);
  near(run("weight", {shape: "hex", s: 30}).A, Math.sqrt(3) / 2 * 900);
  near(run("weight", {shape: "tube", D: 48.3, t: 3}).A, Math.PI * (48.3 ** 2 - 42.3 ** 2) / 4);
});

test("cylinder force, air and buckling", () => {
  const r = run("cylinder");
  near(r.Fext, 0.6 * Math.PI * 625 * 0.9);
  near(r.Fret, 0.6 * Math.PI * (2500 - 400) / 4 * 0.9);
  near(r.perCycle, (Math.PI * 625 + Math.PI * 525) * 200e-6 * 7.01325 / 1.01325);
  near(r.Fcr, Math.PI ** 2 * 210000 * (Math.PI * 20 ** 4 / 64) / 300 ** 2);
  const h = run("cylinder", {type: "hyd", vel: 50});
  near(h.flow, Math.PI * 625 * 50 * 60e-6);
});

test("speeds and feeds", () => {
  const t = run("feeds", {op: "turn", wm: "mcs", tool: "carbide", vmode: "rec", D: 50, fn: 0.2, ap: 2, kr: 90, rake: 6, re: 0.8});
  near(t.n, 180000 / (Math.PI * 50));
  near(t.Q, 72);
  near(t.kc, 1600 * 0.2 ** -0.25 * 0.94);
  near(t.Pc, 72 * t.kc / 60000);
  near(t.Ra, 1.5625);
  // Full-slot milling: average chip thickness = 2/π × f_z.
  const m = run("feeds", {op: "mill", D: 25, ae: 25, fz: 0.1, kr: 90});
  near(m.hm, 0.2 / Math.PI);
  near(run("feeds", {op: "drill", vmode: "custom", vc: 100, D: 10, fn: 0.2}).Q, 50);
});

test("belt drive geometry and tensions", () => {
  const r = run("belt", {D1: 100, D2: 100, given: "C", C: 500});
  near(r.L, 1000 + Math.PI * 100); near(r.wrap, Math.PI);
  near(run("belt", {D1: 100, D2: 250, given: "L", L: run("belt").L}).C, 500, 1e-9);
  const b = run("belt");
  near(b.L, 1000 + Math.PI * 175 + 150 ** 2 / 2000);
  near(b.T1 - b.T2, b.Fe, 1e-9);
  near((b.T1 - b.Tc) / (b.T2 - b.Tc), Math.exp(b.mu * b.wrap), 1e-9);
  near(b.Fe, 5000 * 1.2 / (Math.PI * 0.1 * 1440 / 60));
});

test("chain drive", () => {
  const r = run("chain", {z1: 20, z2: 20, C: 40 * 12.7});
  assert.strictEqual(r.Lp, 100); near(r.C, 40 * 12.7);
  const d = run("chain");
  near(d.vel, 17 * 12.7 * 200 / 60000); near(d.F, 1500 * 1.3 / d.vel);
  near(d.d1, 12.7 / Math.sin(Math.PI / 17));
  assert.strictEqual(d.Lp % 2, 0);
});

test("lead screw torque", () => {
  near(run("screw").Traise, 3.4967, 1e-4);
  near(run("screw", {type: "ball", eta: 0.9}).Traise, 2000 * 4 / (2 * Math.PI * 0.9) / 1000);
  assert.strictEqual(run("screw").lock, true);
});

test("motor sizing", () => {
  // Pure rotor inertia: T = J·α.
  near(run("motor", {drive: "rotary", JL: 0, TL: 0, Jm: 1, Jc: 0, eta: 1, nL: 3000, ta: 0.1}).Ta, 1e-4 * 2 * Math.PI * 50 / 0.1);
  // Moving mass through a screw: inertia method equals F = m·a pushed through the screw.
  const r = run("motor", {drive: "screw", m: 30, mu: 0, Fext: 0, orient: "h", lead: 10, sd: 1e-3, Jm: 0, Jc: 0, eta: 0.9, vmax: 500, ta: 0.1});
  near(r.Ta, 30 * 5 * 0.01 / (2 * Math.PI * 0.9), 1e-6);
  // Vertical axis holds against gravity: m·g·l / (2π η).
  near(run("motor", {orient: "v", Fext: 0}).Tc, 30 * 9.80665 * 0.01 / (2 * Math.PI * 0.9));
});

test("thermal expansion", () => {
  const r = run("thermal");
  near(r.dL, 0.6); near(r.sigma, -123); near(r.clr, 29);
});

test("bearing life", () => {
  const r = run("bearing");
  near(r.P, 1646.10, 1e-4); near(r.L10h, 8075.7, 1e-4);
});

test("fits and bolt patterns", () => {
  const f = run("fits", {D: 25, s: "k6"});
  assert.deepStrictEqual([f.hu, f.hl, f.su, f.sl, f.cMax, f.cMin], [21, 0, 15, 2, 19, -15]);
  const p = run("pattern");
  near(p.chord, 50); near(p.pts[0].x, 50); near(p.pts[3].x, -50);
});
