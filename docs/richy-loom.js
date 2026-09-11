/**
 * Ribbon geometry and shaders adapted from Unwoven by Clément Grellier (MIT).
 * https://github.com/clementgrellier/unwoven — full notice in unwoven-LICENSE.txt.
 * A pixel-space WebGL renderer keeps this strip shared by React and the static site,
 * without adding Three.js and GSAP solely for an orthographic image effect.
 */
const vertexSource = `
  precision highp float;
  attribute vec4 aRibbon;
  uniform vec2 uViewport;
  uniform vec2 uCard;
  uniform float uOffset;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying float vRim;
  varying float vTear;
  varying float vRandom;
  float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
  void main() {
    vUv = aRibbon.xy;
    vRim = aRibbon.z;
    vec2 world = (vUv - .5) * uCard + vec2(uOffset, 0.);
    float halfWidth = uViewport.x * .5;
    float zone = min(uViewport.x * .26, 330.);
    float tear = max(1. - smoothstep(-halfWidth, -halfWidth + zone, world.x),
      smoothstep(halfWidth - zone, halfWidth, world.x));
    float randomA = hash(aRibbon.w + uSeed * 57.);
    float randomB = hash(aRibbon.w * 3.7 + uSeed * 91.);
    float t = pow(tear, 1.4);
    float size = uCard.y / 452.;
    float run = t * (60. + randomA * 420.) * size;
    run *= .85 + .15 * sin(uTime * (1. + randomB * 2.) + randomA * 6.2831);
    world.x += (world.x < 0. ? -1. : 1.) * run;
    world.y += (randomA - .5) * 170. * t * t * size;
    world.y += sin(world.x * .02 + uTime * (1.6 + randomA * 2.2) + randomA * 6.2831)
      * (5. + 13. * randomA) * t * size;
    vRandom = randomA;
    vTear = tear;
    gl_Position = vec4(world / (uViewport * .5), 0., 1.);
  }
`;

const fragmentSource = `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uCard;
  uniform float uAspect;
  uniform vec3 uPaper;
  varying vec2 vUv;
  varying float vRim;
  varying float vTear;
  varying float vRandom;
  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
  }
  void main() {
    float tear = vTear;
    float rim = abs(vRim);
    float core = mix(.8, .16 + vRandom * .12, smoothstep(0., .85, tear));
    float threadAlpha = 1. - smoothstep(core - .10, core + .06, rim);
    threadAlpha = mix(1., threadAlpha, smoothstep(.03, .30, tear));
    float cardAlpha = 1. - smoothstep(-1.5, .5, roundBox((vUv - .5) * uCard, uCard * .5, 12.));
    float alpha = cardAlpha * threadAlpha * (1. - smoothstep(.75, 1., tear) * .65);
    if (alpha < .003) discard;
    float cardAspect = uCard.x / uCard.y;
    vec2 fit = cardAspect > uAspect ? vec2(1., uAspect / cardAspect) : vec2(cardAspect / uAspect, 1.);
    vec3 color = texture2D(uMap, (vUv - .5) * fit + .5).rgb;
    color *= 1. - tear * .4 * rim * rim;
    color += tear * .18 * (1. - smoothstep(0., .45, rim));
    color = mix(color, uPaper, smoothstep(.55, 1., tear) * .8);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createLoomRenderer(canvas, images, paper) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: false, stencil: false });
  if (!gl) return null;
  const shaders = [];
  const textures = [];
  const buffers = [];
  const program = gl.createProgram();
  const dispose = () => {
    textures.forEach(texture => gl.deleteTexture(texture));
    buffers.forEach(buffer => gl.deleteBuffer(buffer));
    shaders.forEach(shader => gl.deleteShader(shader));
    gl.deleteProgram(program);
  };
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Loom shader unavailable");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Loom program unavailable");
    gl.useProgram(program);

    // Each band owns both rows of vertices: adjacent ribbons must separate freely.
    const vertices = [], indices = [];
    const threads = 26, segments = 20, columns = segments + 1;
    for (let band = 0; band < threads; band++) {
      for (let row = 0; row < 2; row++) {
        for (let x = 0; x <= segments; x++) vertices.push(x / segments, (band + row) / threads, row ? 1 : -1, band);
      }
      const base = band * columns * 2;
      for (let x = 0; x < segments; x++) {
        const b = base + x, t = b + columns;
        indices.push(b, b + 1, t, b + 1, t + 1, t);
      }
    }
    const attributeBuffer = gl.createBuffer();
    buffers.push(attributeBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const ribbon = gl.getAttribLocation(program, "aRibbon");
    gl.enableVertexAttribArray(ribbon);
    gl.vertexAttribPointer(ribbon, 4, gl.FLOAT, false, 0, 0);
    const indexBuffer = gl.createBuffer();
    buffers.push(indexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    const uniform = Object.fromEntries(["Viewport", "Card", "Offset", "Time", "Seed", "Map", "Aspect", "Paper"]
      .map(name => [name, gl.getUniformLocation(program, `u${name}`)]));
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(uniform.Map, 0);
    gl.uniform3fv(uniform.Paper, paper);
    images.forEach(image => {
      const texture = gl.createTexture();
      textures.push(texture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    });

    return {
      dispose,
      draw(width, height, offset, time) {
        const density = Math.min(window.devicePixelRatio || 1, 1.5);
        const pixelWidth = Math.round(width * density), pixelHeight = Math.round(height * density);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          gl.viewport(0, 0, pixelWidth, pixelHeight);
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
        const cardHeight = height * .84, cardWidth = cardHeight * .75, pitch = cardWidth + 24;
        // Repeat full sets; recycling must not change a visible card's photograph.
        const count = Math.ceil((width / pitch + 4) / images.length) * images.length;
        const span = count * pitch;
        gl.uniform2f(uniform.Viewport, width, height);
        gl.uniform2f(uniform.Card, cardWidth, cardHeight);
        gl.uniform1f(uniform.Time, time);
        for (let i = 0; i < count; i++) {
          const x = ((i * pitch - offset + span / 2) % span + span) % span - span / 2;
          if (Math.abs(x) > width / 2 + cardWidth) continue;
          const slot = i % images.length;
          gl.bindTexture(gl.TEXTURE_2D, textures[slot]);
          gl.uniform1f(uniform.Offset, x);
          gl.uniform1f(uniform.Seed, (slot + 1) * .731);
          gl.uniform1f(uniform.Aspect, images[slot].naturalWidth / images[slot].naturalHeight);
          gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }
      },
    };
  } catch {
    dispose();
    return null;
  }
}

export function mountRichyLoom(root) {
  const stage = root.querySelector(".loom-viewport");
  const fallback = root.querySelector(".loom-fallback");
  const canvas = root.querySelector("canvas");
  const controls = root.querySelector(".loom-controls");
  const pause = root.querySelector(".loom-pause");
  if (!stage || !fallback || !canvas || !controls || !pause) return () => {};

  const events = new AbortController();
  const options = { signal: events.signal };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let renderer = null, images = [], disposed = false, failed = false;
  let frame = 0, lastTime = 0, time = 0, offset = 0;
  let visible = false, paused = false, hovering = false, dragging = null;
  let width = stage.clientWidth, height = stage.clientHeight;
  controls.hidden = false;
  pause.hidden = true;

  const enhanced = () => renderer && !reduce.matches && !failed;
  const running = () => enhanced() && visible && !document.hidden && !paused && !hovering && !dragging;
  const draw = () => {
    if (enhanced() && visible && !document.hidden && width && height) renderer.draw(width, height, offset, time);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };
  function tick(now) {
    frame = 0;
    if (!running()) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
    lastTime = now;
    offset += dt * 28;
    time += dt;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    stop();
    root.classList.toggle("loom-ready", Boolean(enhanced()));
    fallback.tabIndex = enhanced() ? -1 : 0;
    pause.hidden = !enhanced();
    pause.setAttribute("aria-pressed", String(paused));
    pause.setAttribute("aria-label", paused ? "Продолжить фотоленту" : "Пауза фотоленты");
    draw();
    if (running()) frame = requestAnimationFrame(tick);
  }
  function initialize() {
    if (!renderer && !failed && !reduce.matches && images.length > 1 && !disposed) {
      const paper = getComputedStyle(root).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(n => Number(n) / 255) || [1, 1, 1];
      try { renderer = createLoomRenderer(canvas, images, paper); } catch { renderer = null; }
      failed = !renderer;
    }
    sync();
  }
  const photos = [...fallback.querySelectorAll("img")];
  Promise.all(photos.map(async image => {
    try { await image.decode(); } catch { /* Keep the photo's alt text in the native fallback. */ }
    return image;
  })).then(loaded => {
    if (disposed) return;
    images = loaded.filter(image => image.naturalWidth > 0);
    initialize();
  });

  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) endDrag();
    sync();
  });
  observer.observe(root);
  const resize = new ResizeObserver(() => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    draw();
  });
  resize.observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) endDrag();
    sync();
  }, options);
  reduce.addEventListener("change", () => { endDrag(); initialize(); }, options);
  pause.addEventListener("click", () => { paused = !paused; sync(); }, options);

  root.querySelectorAll("[data-loom-step]").forEach(button => {
    button.addEventListener("click", () => {
      const direction = Number(button.dataset.loomStep);
      if (enhanced()) {
        paused = true;
        offset += direction * (height * .84 * .75 + 24);
        sync();
      } else {
        const distance = fallback.querySelector("img")?.clientWidth || 160;
        fallback.scrollBy({ left: direction * (distance + 24), behavior: "instant" });
      }
    }, options);
  });

  stage.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") { hovering = true; sync(); }
  }, options);
  stage.addEventListener("pointerleave", () => {
    hovering = false;
    if (dragging && !dragging.active) endDrag();
    else sync();
  }, options);
  stage.addEventListener("pointerdown", event => {
    if (!enhanced() || event.button !== 0 || !event.isPrimary) return;
    dragging = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, active: false };
    stop();
  }, options);
  stage.addEventListener("pointermove", event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const dx = event.clientX - dragging.startX, dy = event.clientY - dragging.startY;
    if (!dragging.active) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { endDrag(); return; }
      if (Math.abs(dx) < 6) return;
      dragging.active = true;
      stage.setPointerCapture(event.pointerId);
      root.classList.add("loom-dragging");
    }
    offset -= event.clientX - dragging.lastX;
    dragging.lastX = event.clientX;
    draw();
  }, options);
  function endDrag() {
    const previous = dragging;
    dragging = null;
    root.classList.remove("loom-dragging");
    if (previous && stage.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
    sync();
  }
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    stage.addEventListener(event, endDrag, options);
  }
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    failed = true;
    endDrag();
  }, options);
  canvas.addEventListener("webglcontextrestored", () => {
    renderer?.dispose();
    renderer = null;
    failed = false;
    initialize();
  }, options);

  return () => {
    disposed = true;
    events.abort();
    observer.disconnect();
    resize.disconnect();
    stop();
    renderer?.dispose();
    root.classList.remove("loom-ready", "loom-dragging");
    fallback.tabIndex = 0;
    controls.hidden = true;
  };
}
