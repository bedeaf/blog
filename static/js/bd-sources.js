/* bedeaf: client-side filter for the sources page (category, level, text). State lives in the URL hash. */
(() => {
  const root = document.getElementById("bd-src");
  if (!root) return;
  const q = document.getElementById("bd-src-q"), count = document.getElementById("bd-src-count"), empty = document.getElementById("bd-src-empty");
  const items = [...root.querySelectorAll(".bd-src-item")], groups = [...root.querySelectorAll(".bd-src-group")];
  const state = { cat: "", level: "", text: "" };
  const norm = (s) => s.toLocaleLowerCase("tr-TR").trim();
  const apply = () => {
    let shown = 0;
    for (const li of items) {
      const ok = (!state.cat || li.dataset.cat === state.cat) && (!state.level || li.dataset.level === state.level)
        && (!state.text || state.text.split(/\s+/).every(w => li.dataset.text.includes(w)));
      li.hidden = !ok; if (ok) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector(".bd-src-item:not([hidden])");
    count.textContent = shown + " / " + items.length + " kaynak";
    empty.hidden = shown > 0;
    for (const b of root.querySelectorAll("[data-cat]")) if (b.tagName === "BUTTON") b.classList.toggle("is-on", b.dataset.cat === state.cat);
    for (const b of root.querySelectorAll("button[data-level]")) b.classList.toggle("is-on", b.dataset.level === state.level);
    const h = new URLSearchParams(); if (state.cat) h.set("k", state.cat); if (state.level) h.set("s", state.level); if (state.text) h.set("q", state.text);
    history.replaceState(null, "", h.toString() ? "#" + h : location.pathname);
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button.bd-chip"); if (!b) return;
    if ("cat" in b.dataset) state.cat = b.dataset.cat; else state.level = b.dataset.level;
    apply();
  });
  q.addEventListener("input", () => { state.text = norm(q.value); apply(); });
  const h = new URLSearchParams(location.hash.slice(1));
  state.cat = h.get("k") || ""; state.level = h.get("s") || ""; state.text = norm(h.get("q") || ""); q.value = h.get("q") || "";
  apply();
})();
