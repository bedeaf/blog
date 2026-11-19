/* bedeaf: count this read once per day (server dedupes) and show the total. */
(() => {
  const meta = document.querySelector(".post-single .post-meta");
  if (!meta) return;
  const slug = location.pathname;
  fetch("/api/views", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }), keepalive: true
  }).then(r => r.ok ? r.json() : null).then(d => {
    const n = d && Number(d.views);
    if (!Number.isFinite(n) || n < 1) return;
    const span = document.createElement("span");
    span.className = "post-views";
    span.textContent = n.toLocaleString("tr-TR") + " okunma";
    meta.append(document.createTextNode("\u00a0·\u00a0"), span);
  }).catch(() => {});
})();
