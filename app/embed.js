// Inside the Android app, give website pages (viewer, guides, course, projects) an app bar with a
// back button, handle Android's back key, and add a light vibration to taps.
(function () {
  document.documentElement.classList.add("embedded");
  const P = window.Capacitor && window.Capacitor.Plugins;
  const home = "../index.html";
  const back = () => { if (history.length > 1 && document.referrer) history.back(); else location.href = home + "#home"; };
  const buzz = () => {
    let on = true;
    try { on = JSON.parse(localStorage.getItem("mg.haptics") ?? "true"); } catch (e) {}
    if (!on) return;
    try { if (P && P.Haptics) P.Haptics.impact({style: "LIGHT"}); else if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  };
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.className = "appbar";
    const title = (document.title || "").replace(/ · .*$/, "");
    bar.innerHTML = `<button type="button" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><b></b>`;
    bar.querySelector("b").textContent = title;
    bar.querySelector("button").onclick = () => { buzz(); back(); };
    document.body.prepend(bar);
    document.addEventListener("click", e => { if (e.target.closest("button,a,.tb,select")) buzz(); });
  });
  if (P && P.App) P.App.addListener("backButton", back);
})();
