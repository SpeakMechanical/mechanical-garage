// Car Cost: total cost of owning a car over a few years, and "smart swaps" that cut running costs.
// Every preset figure is an EXAMPLE for illustration (rough Indian prices, 2026) — the app says so
// and every number can be edited. No DOM here, so the sums can be tested in Node.
(function (root) {
"use strict";

// Smart swaps: a cheaper or more durable replacement for a costly original part.
// times = how often it is typically needed in 5 years of 12,000 km/year use (scaled to the user's km and years).
const SWAPS = {
  airStrut: {name: "Air suspension struts → conventional coil-spring and damper conversion", oem: 300000, alt: 90000, times: 1,
    pros: "Much cheaper and very durable; no compressor, valves or leaks to fix", cons: "Firmer ride, no adjustable height; may need a module recode to clear warning lights; tell your insurer"},
  brakes: {name: "OEM brake pads and discs → quality OES brand (Bosch, ATE, TRW, Brembo)", oem: 90000, alt: 45000, times: 2,
    pros: "Same or similar parts the carmaker buys from, about half the price", cons: "Buy from a trusted seller; avoid unbranded copies"},
  runflat: {name: "Run-flat tyres → normal tyres plus a space-saver spare", oem: 140000, alt: 70000, times: 1,
    pros: "Cheaper, quieter and more comfortable; easy to repair", cons: "Carry the spare and jack; check boot space"},
  battery: {name: "OEM AGM battery → branded AGM of the same rating", oem: 30000, alt: 16000, times: 1,
    pros: "Same technology and capacity", cons: "Many luxury cars need the new battery registered with a scan tool"},
  service: {name: "Dealer service → specialist independent garage with genuine or OES parts", oem: 60000, alt: 30000, times: 5,
    pros: "Often half the labour rate, same parts", cons: "Pick a garage that knows the brand and has the diagnostic tool; keep service records"},
  lights: {name: "Dealer xenon or LED unit repair → refurbished or aftermarket-certified unit", oem: 120000, alt: 45000, times: 0.5,
    pros: "Large saving on a costly part", cons: "Must be road-legal and correctly aimed"},
  wipers: {name: "Small parts (filters, wipers, bulbs) from the dealer → OES online", oem: 20000, alt: 9000, times: 5,
    pros: "Same parts, lower price", cons: "Check part numbers carefully"}
};

// EXAMPLE presets. Money in ₹; insurance, service and repairs are per year at 12,000 km/year.
const CARS = {
  a6:     {name: "Audi A6 (used, 2015–17, diesel)", price: 1200000, resalePct: 45, fuel: "diesel", kmpl: 13, insurance: 45000, service: 60000, repairs: 80000, oneTime: 40000,
           swaps: ["airStrut", "brakes", "battery", "service", "lights", "wipers"]},
  eclass: {name: "Mercedes E-Class (used, 2014–16, diesel)", price: 1400000, resalePct: 45, fuel: "diesel", kmpl: 13, insurance: 50000, service: 65000, repairs: 85000, oneTime: 45000,
           swaps: ["airStrut", "brakes", "battery", "service", "lights", "wipers"]},
  bmw5:   {name: "BMW 5 Series (used, 2014–16, diesel)", price: 1300000, resalePct: 45, fuel: "diesel", kmpl: 14, insurance: 48000, service: 60000, repairs: 80000, oneTime: 42000,
           swaps: ["runflat", "brakes", "battery", "service", "wipers"]},
  city:   {name: "Honda City (new, petrol)", price: 1300000, resalePct: 55, fuel: "petrol", kmpl: 17, insurance: 35000, service: 8000, repairs: 5000, oneTime: 0, swaps: []},
  creta:  {name: "Hyundai Creta (new, petrol)", price: 1400000, resalePct: 55, fuel: "petrol", kmpl: 16, insurance: 40000, service: 9000, repairs: 6000, oneTime: 0, swaps: []},
  camry:  {name: "Toyota Camry Hybrid (used, 2020–22)", price: 2600000, resalePct: 60, fuel: "petrol", kmpl: 19, insurance: 55000, service: 15000, repairs: 10000, oneTime: 60000, swaps: ["brakes", "service"]}
};
const FUEL = {petrol: 105, diesel: 92};

// Total cost of ownership. common = {years, kmYear, petrol, diesel}; picked = swap ids to apply.
function tco(car, common, picked = []) {
  const yrs = common.years, scale = common.kmYear / 12000 * yrs / 5;
  const resale = car.price * car.resalePct / 100 * Math.pow(0.92, Math.max(0, yrs - 5));   // a little lower if kept longer
  const depreciation = car.price - resale;
  const fuel = common.kmYear * yrs / car.kmpl * (car.fuel === "diesel" ? common.diesel : common.petrol);
  const insurance = car.insurance * yrs, service = car.service * yrs, repairs = car.repairs * yrs;
  const parts = {depreciation, fuel, insurance, service, repairs, oneTime: car.oneTime};
  const before = Object.values(parts).reduce((a, b) => a + b, 0);
  const swapRows = (car.swaps || []).map(id => {
    const s = SWAPS[id], n = s.times * scale;
    return {id, ...s, n, saving: (s.oem - s.alt) * n, on: picked.includes(id)};
  });
  // Swaps replace spending that sits inside the service and repair budgets, so they can't save more than those.
  const saving = Math.min(service + repairs, swapRows.filter(s => s.on).reduce((a, s) => a + s.saving, 0));
  const total = before - saving;
  return {parts, before, saving, total, perMonth: total / (yrs * 12), perKm: total / (common.kmYear * yrs), swapRows, resale};
}

const CC = {SWAPS, CARS, FUEL, tco};
if (typeof module === "object" && module.exports) module.exports = CC; else root.CarCost = CC;
})(typeof window !== "undefined" ? window : globalThis);
