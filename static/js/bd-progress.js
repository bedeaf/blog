/* bedeaf: thin reading-progress bar for posts. */
(() => {
  const bar = document.querySelector(".bd-progress");
  const post = document.querySelector(".post-content");
  if (!bar || !post) return;
  let queued = false;
  const update = () => {
    queued = false;
    const r = post.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    bar.style.transform = `scaleX(${p})`;
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
})();
