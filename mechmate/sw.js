// Service worker for MechMate offline use. Network first, so online visitors always get the
// latest files; the cached copy is used only when the network fails. Other requests pass through.
const CACHE = "mechmate-v3";
const FILES = ["./", "index.html", "mechmate.js", "mechmate-tools.js", "mechmate.webmanifest",
  "mechmate-192.png", "mechmate-512.png", "../shared/site.css", "../shared/site.js"];
const URLS = FILES.map(f => new URL(f, self.location).href);
const key = url => url.endsWith("/") ? url + "index.html" : url;   // "/mechmate/" and "/mechmate/index.html" share one entry

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(URLS.map(u => fetch(u, {cache: "no-cache"}).then(res => res.ok && c.put(key(u), res)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const href = url.origin + url.pathname;
  if (!URLS.includes(href)) return;
  e.respondWith(fetch(e.request, {cache: "no-cache"}).then(res => {   // revalidate, never a stale HTTP-cache copy
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key(href), copy)); }
    return res;
  }).catch(() => caches.match(key(href))));
});
