/* bedeaf: decode the hero name from random hex digits. Static if reduced motion. */
(() => {
  const name = document.querySelector(".bd-name");
  if (!name) return;
  const hero = name.closest(".bd-hero");
  const finish = () => { hero.classList.remove("bd-run"); hero.classList.add("bd-done"); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
  const hex = "0123456789ABCDEF";
  hero.classList.add("bd-run");
  [...name.children].forEach((el, i) => {
    const final = el.textContent;
    let n = 0;
    const tick = () => {
      if (n++ < 7) {
        let d;
        do d = hex[(Math.random() * 16) | 0]; while (d === final);
        el.textContent = d;
        el.classList.add("bd-scr");
        setTimeout(tick, 60);
      } else {
        el.textContent = final;
        el.classList.remove("bd-scr");
        if (i === name.children.length - 1) finish();
      }
    };
    setTimeout(tick, 250 + i * 140);
  });
})();
