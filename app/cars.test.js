// Checks the Car Cost sums: node --test app/cars.test.js
const test = require("node:test");
const assert = require("node:assert");
const CC = require("./cars.js");

const common = {years: 5, kmYear: 12000, petrol: 105, diesel: 92};
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `expected ${b}, got ${a}`);

test("cost of ownership adds up", () => {
  const car = {price: 1000000, resalePct: 50, fuel: "petrol", kmpl: 15, insurance: 30000, service: 10000, repairs: 5000, oneTime: 20000, swaps: []};
  const r = CC.tco(car, common);
  near(r.parts.depreciation, 500000);
  near(r.parts.fuel, 60000 / 15 * 105);
  near(r.parts.insurance, 150000); near(r.parts.service, 50000); near(r.parts.repairs, 25000);
  near(r.before, 500000 + 420000 + 150000 + 50000 + 25000 + 20000);
  near(r.perKm, r.total / 60000, 1e-9);
});

test("smart swaps save money, scaled to use, and never more than the service and repair budget", () => {
  const a6 = CC.CARS.a6, none = CC.tco(a6, common), all = CC.tco(a6, common, a6.swaps);
  assert.strictEqual(none.saving, 0);
  assert.ok(all.saving > 0 && all.saving <= a6.service * 5 + a6.repairs * 5);
  near(all.total, all.before - all.saving);
  const strut = CC.tco(a6, common, ["airStrut"]);
  near(strut.saving, CC.SWAPS.airStrut.oem - CC.SWAPS.airStrut.alt);
  const twice = CC.tco(a6, {...common, kmYear: 24000}, ["airStrut"]);
  near(twice.saving, 2 * strut.saving);
});

test("every preset and swap is well formed", () => {
  for (const [k, c] of Object.entries(CC.CARS)) {
    for (const f of ["price", "resalePct", "kmpl", "insurance", "service", "repairs", "oneTime"]) assert.ok(Number.isFinite(c[f]), `${k}.${f}`);
    c.swaps.forEach(id => assert.ok(CC.SWAPS[id], `${k} swap ${id}`));
  }
  for (const s of Object.values(CC.SWAPS)) assert.ok(s.oem > s.alt);
});
