(() => {
  const hero = document.querySelector(".interactive-richy-hero");
  if (!hero) return;

  const clamp = (value) => Math.max(-1, Math.min(1, value));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let frame = null;
  let reactionTimer = null;
  let paused = false;

  const paint = () => {
    current.x += (target.x - current.x) * 0.14;
    current.y += (target.y - current.y) * 0.14;

    hero.style.setProperty("--richy-x", `${current.x * 14}px`);
    hero.style.setProperty("--richy-y", `${current.y * 7}px`);
    hero.style.setProperty("--richy-rotate", `${current.x * 0.9}deg`);
    hero.style.setProperty("--scene-x", `${current.x * -12}px`);
    hero.style.setProperty("--scene-y", `${current.y * -8}px`);

    if (Math.abs(target.x - current.x) > 0.002 || Math.abs(target.y - current.y) > 0.002) {
      frame = requestAnimationFrame(paint);
    } else {
      frame = null;
    }
  };

  const requestPaint = () => {
    if (frame === null) frame = requestAnimationFrame(paint);
  };

  hero.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || paused || reducedMotion.matches) return;

    const bounds = hero.getBoundingClientRect();
    target.x = clamp((event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2));
    target.y = clamp((event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2));
    requestPaint();
  });

  hero.addEventListener("pointerleave", () => {
    if (paused || reducedMotion.matches) return;
    target.x = 0;
    target.y = 0;
    requestPaint();
  });

  hero.querySelector(".richy-mascot").addEventListener("click", () => {
    if (paused || reducedMotion.matches) return;
    hero.classList.remove("is-richy-reacting");
    void hero.offsetWidth;
    hero.classList.add("is-richy-reacting");

    if (reactionTimer !== null) clearTimeout(reactionTimer);
    reactionTimer = window.setTimeout(() => {
      hero.classList.remove("is-richy-reacting");
    }, 720);
  });

  const toggle = hero.querySelector(".motion-toggle");
  toggle.addEventListener("click", () => {
    paused = !paused;
    hero.classList.toggle("is-motion-paused", paused);
    toggle.setAttribute("aria-pressed", String(paused));
    target.x = current.x = 0;
    target.y = current.y = 0;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  });
})();
