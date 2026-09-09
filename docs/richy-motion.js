/** Shared by the React preview and the standalone published page. */
export function mountRichyMotion(hero) {
  const mascot = hero.querySelector(".richy-mascot");
  const toggle = hero.querySelector(".motion-toggle");
  const hint = hero.querySelector(".interaction-hint");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const events = new AbortController();
  const options = { signal: events.signal };
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  let frame = null;
  let previousTime = null;
  let reactionTimer = null;
  let paused = false;
  let visible = true;
  const originalHint = hint.textContent;
  const canMove = () => !paused && !reduced.matches && visible && !document.hidden;

  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    if (reactionTimer !== null) clearTimeout(reactionTimer);
    frame = previousTime = reactionTimer = null;
    target.x = target.y = current.x = current.y = velocity.x = velocity.y = 0;
    mascot.style.transform = "";
    hero.classList.remove("is-richy-reacting");
    hint.textContent = originalHint;
  };

  const syncMotion = () => {
    hero.classList.toggle("is-motion-paused", !canMove());
    if (!canMove() || !finePointer.matches) reset();
  };

  const paint = (time) => {
    if (!canMove()) { reset(); return; }
    // Bound the time step after backgrounding; mass 1, stiffness 100, damping 10.
    const dt = Math.min((time - (previousTime ?? time - 16)) / 1000, 1 / 30);
    previousTime = time;
    for (const axis of ["x", "y"]) {
      velocity[axis] += ((target[axis] - current[axis]) * 100 - velocity[axis] * 10) * dt;
      current[axis] += velocity[axis] * dt;
    }
    mascot.style.transform = `translate3d(${current.x * 12}px, ${current.y * 6}px, 0) rotate(${current.x * 0.8}deg)`;
    if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) + Math.abs(velocity.x) + Math.abs(velocity.y) > 0.002) {
      frame = requestAnimationFrame(paint);
    } else {
      frame = previousTime = null;
    }
  };
  const requestPaint = () => { if (frame === null) frame = requestAnimationFrame(paint); };
  const clamp = (value) => Math.max(-1, Math.min(1, value));

  hero.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !finePointer.matches || !canMove()) return;
    const bounds = hero.getBoundingClientRect();
    target.x = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1);
    target.y = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1);
    requestPaint();
  }, options);
  hero.addEventListener("pointerleave", () => {
    if (!canMove()) return;
    target.x = target.y = 0;
    requestPaint();
  }, options);
  mascot.addEventListener("click", (event) => {
    hint.textContent = "Мур-р-р. Риччи приятно!";
    // Repeated presses extend the reaction instead of restarting a keyframe animation.
    if (canMove() && event.detail !== 0) hero.classList.add("is-richy-reacting");
    if (reactionTimer !== null) clearTimeout(reactionTimer);
    reactionTimer = window.setTimeout(() => {
      hero.classList.remove("is-richy-reacting");
      hint.textContent = originalHint;
      reactionTimer = null;
    }, 1200);
  }, options);
  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    syncMotion();
  }, options);
  reduced.addEventListener("change", syncMotion, options);
  finePointer.addEventListener("change", syncMotion, options);
  document.addEventListener("visibilitychange", syncMotion, options);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncMotion();
  });
  observer.observe(hero);
  syncMotion();
  return () => { events.abort(); observer.disconnect(); reset(); };
}
