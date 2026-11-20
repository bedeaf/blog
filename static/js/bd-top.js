/* bedeaf: "most read" list on the home page, from the private view counter. */
(() => {
  const box = document.querySelector(".bd-top");
  if (!box) return;
  const titleFor = (slug) => {
    const a = document.querySelector('.post-entry a.entry-link[href$="' + CSS.escape(slug) + '"], .post-entry a.entry-link[href="' + slug + '"]');
    const h = a && a.closest(".post-entry").querySelector("h2");
    if (h) return h.firstChild ? h.firstChild.textContent.trim() : h.textContent.trim();
    const s = slug.replace(/^\/posts\/|\/$/g, "").replace(/-/g, " ");
    return s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
  };
  fetch("/api/views/top").then(r => r.ok ? r.json() : null).then(d => {
    const top = d && Array.isArray(d.top) ? d.top : [];
    if (top.length < 2) return;
    const ol = box.querySelector("ol");
    for (const { slug, count } of top) {
      const li = document.createElement("li"), a = document.createElement("a"), n = document.createElement("span");
      a.href = slug; a.textContent = titleFor(slug);
      n.className = "bd-top-n"; n.textContent = Number(count).toLocaleString("tr-TR");
      li.append(a, n); ol.append(li);
    }
    box.hidden = false;
  }).catch(() => {});
})();
