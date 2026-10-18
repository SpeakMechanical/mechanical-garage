// Shared script for the Mechanical Garage pages: theme toggle, calculator helpers, and saving files.
// Load in <head> so the saved theme applies before the page paints.

(function () {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.querySelector(".theme-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  });
})();

const $ = id => document.getElementById(id);
const num = id => parseFloat($(id).value);
const fmt = (x, d = 0) => !isFinite(x) ? "—" : x.toLocaleString("en-US", {maximumFractionDigits: d, minimumFractionDigits: d});
function card(k, v, state, s) {
  return `<div class="r${state ? " " + state : ""}"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
}
const safety = (n, lo = 1.5) => n >= lo ? "ok" : n >= 1 ? "warn" : "bad";
function bind(ids, fn) { ids.forEach(id => $(id).addEventListener("input", fn)); fn(); }

// True inside the Android app (Capacitor), false on the website.
const isApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
// Save a file. A browser downloads it; the Android app writes it to its cache and opens the share
// sheet (Files, Drive, email…), because app web views cannot download. data is text or a data: URL.
async function saveFile(name, mime, data) {
  const isDataUrl = typeof data === "string" && data.startsWith("data:");
  if (isApp()) {
    const {Filesystem, Share} = window.Capacitor.Plugins;
    const res = await Filesystem.writeFile(isDataUrl
      ? {path: name, data: data.slice(data.indexOf(",") + 1), directory: "CACHE"}
      : {path: name, data, directory: "CACHE", encoding: "utf8"});
    await Share.share({title: name, url: res.uri, dialogTitle: `Save or share ${name}`});
    return;
  }
  const a = document.createElement("a");
  a.href = isDataUrl ? data : URL.createObjectURL(new Blob([data], {type: mime}));
  a.download = name;
  a.click();
}
