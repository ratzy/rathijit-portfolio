/* ============================================================
   Rathijit Adhikary — Portfolio interactions
   Three.js hero · GSAP + ScrollTrigger · Lenis smooth scroll
   ============================================================ */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IS_TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  const hasST = typeof window.ScrollTrigger !== "undefined";
  let heroTl = null; // hero intro timeline, played once the loader lifts

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Force the page to open at the hero on every load / reload
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    if (hasGSAP && hasST) gsap.registerPlugin(ScrollTrigger);

    const lenis = initSmoothScroll();
    if (lenis) lenis.scrollTo(0, { immediate: true });
    initCursor();
    initNav();
    initNavSpy();
    initHeroWebGL();
    initHeroIntro();
    initReveals();
    initCounters();
    initTilt();
    initFloaters();
    initMarquee();
    initMagnetic();
    initCarousel();
    initLoader(lenis);

    // Keep ScrollTrigger honest after images/fonts settle
    window.addEventListener("load", () => { if (hasST) ScrollTrigger.refresh(); });
  }

  /* ---------- Smooth scroll (Lenis <-> ScrollTrigger) ---------- */
  function initSmoothScroll() {
    if (REDUCED || typeof window.Lenis === "undefined") return null;
    const lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });

    if (hasGSAP && hasST) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }

    // Anchor links -> smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length < 2) return;
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -10 });
      });
    });
    return lenis;
  }

  /* ---------- Custom cursor + magnetic hover ---------- */
  function initCursor() {
    if (IS_TOUCH) return;
    const cursor = document.querySelector(".cursor");
    if (!cursor) return;
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let cx = x, cy = y;

    window.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });
    window.addEventListener("mousedown", () => cursor.classList.add("is-down"));
    window.addEventListener("mouseup", () => cursor.classList.remove("is-down"));

    const hoverSel = "a, button, [data-magnetic], [data-tilt], .taglist li, .quote";
    document.querySelectorAll(hoverSel).forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
    });

    (function loop() {
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Nav: hide on scroll down, condense ---------- */
  function initNav() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle("is-scrolled", y > 40);
      if (y > last && y > 400) nav.classList.add("is-hidden");
      else nav.classList.remove("is-hidden");
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Nav scroll-spy (active section) ---------- */
  function initNavSpy() {
    const links = Array.from(document.querySelectorAll(".nav__links a"));
    if (!links.length) return;
    const map = links
      .map((a) => ({ a, sec: document.querySelector(a.getAttribute("href")) }))
      .filter((o) => o.sec);
    if (!map.length) return;

    const setActive = (link) => links.forEach((a) => a.classList.toggle("is-active", a === link));

    if (hasST) {
      map.forEach(({ a, sec }) => {
        ScrollTrigger.create({
          trigger: sec, start: "top center", end: "bottom center",
          onToggle: (self) => { if (self.isActive) setActive(a); },
        });
      });
    } else {
      const onScroll = () => {
        const y = window.scrollY + window.innerHeight * 0.5;
        let current = map[0];
        map.forEach((o) => { if (o.sec.offsetTop <= y) current = o; });
        setActive(current.a);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- Hero intro reveal (played by the loader) ---------- */
  function initHeroIntro() {
    if (!hasGSAP || REDUCED) return;
    const words = document.querySelectorAll(".hero__title .word");
    const lines = document.querySelectorAll(".hero .reveal-line span");

    heroTl = gsap.timeline({ paused: true, defaults: { ease: "power4.out" } });
    gsap.set(words, { yPercent: 115 });
    gsap.set(lines, { yPercent: 110, opacity: 0 });

    heroTl.to(words, { yPercent: 0, duration: 1.1, stagger: 0.08 })
      .to(lines, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.12 }, "-=0.8");
  }

  /* ---------- Photo carousel (auto-play, cross-fade) ---------- */
  function initCarousel() {
    document.querySelectorAll("[data-carousel]").forEach((root) => {
      const slides = Array.from(root.querySelectorAll(".carousel__slide"));
      if (slides.length < 2) return;
      const dotsWrap = root.querySelector(".carousel__dots");
      const bar = root.querySelector(".carousel__bar i");
      const INTERVAL = 3800;
      let i = 0, timer = null, paused = false;

      // build dots
      const dots = slides.map((_, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Show photo " + (idx + 1));
        if (idx === 0) b.classList.add("is-active");
        b.addEventListener("click", () => { go(idx); restart(); });
        dotsWrap && dotsWrap.appendChild(b);
        return b;
      });

      function go(n) {
        const prev = i;
        i = (n + slides.length) % slides.length;
        if (i === prev) return;
        slides[prev].classList.remove("is-active");
        slides[prev].classList.add("is-prev");
        slides[i].classList.remove("is-prev");
        slides[i].classList.add("is-active");
        dots[prev] && dots[prev].classList.remove("is-active");
        dots[i] && dots[i].classList.add("is-active");
      }

      function armBar() {
        if (!bar) return;
        bar.classList.remove("run");
        bar.style.setProperty("--dur", INTERVAL + "ms");
        void bar.offsetWidth; // reflow to restart animation
        if (!paused) bar.classList.add("run");
      }
      function tick() { go(i + 1); armBar(); }
      function start() { if (REDUCED) return; stop(); armBar(); timer = setInterval(tick, INTERVAL); }
      function stop() { clearInterval(timer); timer = null; }
      function restart() { start(); }

      root.addEventListener("mouseenter", () => { paused = true; stop(); if (bar) bar.classList.remove("run"); });
      root.addEventListener("mouseleave", () => { paused = false; start(); });
      document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (!paused) start(); });

      start();
    });
  }

  /* ---------- Preloader: count up, then lift to reveal ---------- */
  function initLoader(lenis) {
    const loader = document.getElementById("loader");
    if (!loader) { if (heroTl) heroTl.play(0); return; }
    const fill = document.getElementById("loaderFill");
    const count = document.getElementById("loaderCount");
    const welcomeFill = document.getElementById("welcomeFill");

    document.documentElement.classList.add("is-loading");
    if (lenis) lenis.stop();

    const finish = () => {
      document.documentElement.classList.remove("is-loading");
      loader.style.display = "none";
      if (lenis) lenis.start();
      if (heroTl) heroTl.play(0);
      if (hasST) ScrollTrigger.refresh();
    };

    if (REDUCED || !hasGSAP) {
      if (count) count.textContent = "100";
      if (fill) fill.style.width = "100%";
      if (welcomeFill) welcomeFill.style.width = "100%";
      setTimeout(finish, 500);
      return;
    }

    const state = { p: 0 };
    const tl = gsap.timeline();

    tl.to(state, {
        p: 100, duration: 2, ease: "power2.inOut",
        onUpdate: () => {
          const v = Math.round(state.p);
          if (count) count.textContent = v;
          if (fill) fill.style.width = v + "%";
          if (welcomeFill) welcomeFill.style.width = state.p + "%";
        },
      }, 0.15)
      .to(".loader__center, .loader__top, .loader__bottom", { opacity: 0, y: -24, duration: 0.6, ease: "power2.in" }, "-=0.3")
      .to(loader, { yPercent: -100, duration: 1.05, ease: "power4.inOut", onComplete: finish }, "-=0.1");
  }

  /* ---------- Scroll reveals ---------- */
  function initReveals() {
    if (!hasGSAP || !hasST || REDUCED) return;

    // Split [data-reveal-lines] into masked lines
    document.querySelectorAll("[data-reveal-lines]").forEach((el) => {
      const html = el.innerHTML;
      // wrap in a single animated line (keeps <br>, <em> intact)
      el.innerHTML = `<span class="rl-line"><span class="rl-inner">${html}</span></span>`;
      const inner = el.querySelector(".rl-inner");
      gsap.set(inner, { yPercent: 110 });
      gsap.set(el.querySelector(".rl-line"), { opacity: 1 });
      ScrollTrigger.create({
        trigger: el, start: "top 85%",
        onEnter: () => gsap.to(inner, { yPercent: 0, duration: 1.1, ease: "power4.out" }),
      });
    });

    // Simple fade-up
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      gsap.set(el, { y: 40, opacity: 0 });
      ScrollTrigger.create({
        trigger: el, start: "top 88%",
        onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }),
      });
    });

    // Staggered groups
    document.querySelectorAll("[data-stagger]").forEach((group) => {
      const items = group.children;
      gsap.set(items, { y: 48, opacity: 0 });
      ScrollTrigger.create({
        trigger: group, start: "top 82%",
        onEnter: () => gsap.to(items, { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: "power3.out" }),
      });
    });

    // Opacity-only reveal (keeps CSS transforms like floating intact)
    document.querySelectorAll("[data-fade]").forEach((group) => {
      const items = group.children;
      gsap.set(items, { opacity: 0 });
      ScrollTrigger.create({
        trigger: group, start: "top 82%",
        onEnter: () => gsap.to(items, { opacity: 1, duration: 1, stagger: 0.12, ease: "power2.out" }),
      });
    });

    // Project frames parallax
    document.querySelectorAll(".project__media").forEach((m) => {
      gsap.fromTo(m, { y: 60 }, {
        y: -60, ease: "none",
        scrollTrigger: { trigger: m, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // Animate funnel/bar widths inside mocks on enter
    ScrollTrigger.batch(".mock__funnel span", {
      start: "top 90%",
      onEnter: (els) => gsap.from(els, { scaleX: 0, transformOrigin: "left", duration: 0.9, stagger: 0.08, ease: "power3.out" }),
    });
  }

  /* ---------- Animated counters ---------- */
  function initCounters() {
    const nums = document.querySelectorAll("[data-count]");
    nums.forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const run = () => {
        if (REDUCED || !hasGSAP) { el.textContent = target + suffix; return; }
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.8, ease: "power2.out",
          onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; },
        });
      };
      if (hasST) ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: run });
      else run();
    });
  }

  /* ---------- 3D tilt + spotlight on project frames ---------- */
  function initTilt() {
    if (IS_TOUCH || REDUCED) return;
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      let raf;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", px * 100 + "%");
        el.style.setProperty("--my", py * 100 + "%");
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `rotateY(${(px - 0.5) * 12}deg) rotateX(${(0.5 - py) * 12}deg) translateZ(0)`;
        });
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "rotateY(0) rotateX(0)";
      });
    });
  }

  /* ---------- Mouse-reactive floating hero cards ---------- */
  function initFloaters() {
    if (IS_TOUCH || REDUCED) return;
    const cards = document.querySelectorAll(".floatcard");
    const hero = document.getElementById("hero");
    if (!cards.length || !hero) return;
    let tx = 0, ty = 0, cxv = 0, cyv = 0;

    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    hero.addEventListener("mouseleave", () => { tx = 0; ty = 0; });

    (function loop() {
      cxv += (tx - cxv) * 0.06;
      cyv += (ty - cyv) * 0.06;
      cards.forEach((c) => {
        const d = parseFloat(c.dataset.depth) || 0.08;
        c.style.transform = `translate3d(${-cxv * d * 220}px, ${-cyv * d * 220}px, 0)`;
      });
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Marquee: CSS-driven loop + velocity skew ---------- */
  function initMarquee() {
    // The continuous scroll is handled in CSS (@keyframes marquee-scroll),
    // so it always animates. Here we only add a scroll-velocity skew.
    if (!hasGSAP || !hasST) return;
    const marquee = document.querySelector(".marquee");
    if (!marquee) return;
    let resetTimer;
    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = self.getVelocity();
        const skew = gsap.utils.clamp(-7, 7, v / -280);
        gsap.to(marquee, { skewX: skew, duration: 0.3, overwrite: true });
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => gsap.to(marquee, { skewX: 0, duration: 0.5 }), 120);
      },
    });
  }

  /* ---------- Magnetic elements ---------- */
  function initMagnetic() {
    if (IS_TOUCH || REDUCED || !hasGSAP) return;
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.4;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: mx * strength, y: my * strength, duration: 0.6, ease: "power3.out" });
      });
      el.addEventListener("mouseleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ============================================================
     Hero WebGL — interactive gold particle terrain
     ============================================================ */
  function initHeroWebGL() {
    const canvas = document.getElementById("webgl");
    if (!canvas || typeof window.THREE === "undefined") return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 3.2, 11);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // ---- Particle grid geometry ----
    const COLS = 120, ROWS = 120;
    const WIDTH = 26, DEPTH = 26;
    const count = COLS * ROWS;
    const positions = new Float32Array(count * 3);
    const aRand = new Float32Array(count);
    let i = 0, j = 0;
    for (let z = 0; z < ROWS; z++) {
      for (let x = 0; x < COLS; x++) {
        positions[i++] = (x / (COLS - 1) - 0.5) * WIDTH;
        positions[i++] = 0;
        positions[i++] = (z / (ROWS - 1) - 0.5) * DEPTH;
        aRand[j++] = Math.random();
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uSize: { value: 2.6 * DPR },
      uColorLow: { value: new THREE.Color(0x3a3a40) },
      uColorHigh: { value: new THREE.Color(0xffffff) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform vec2  uMouse;
        uniform float uSize;
        attribute float aRand;
        varying float vElev;
        void main() {
          vec3 p = position;
          float wave = sin(p.x * 0.45 + uTime * 0.9) * 0.5
                     + cos(p.z * 0.55 + uTime * 0.7) * 0.5
                     + sin((p.x + p.z) * 0.3 + uTime) * 0.35;
          // mouse ripple
          vec2 m = uMouse * vec2(${(WIDTH / 2).toFixed(1)}, ${(DEPTH / 2).toFixed(1)});
          float d = distance(p.xz, m);
          float ripple = exp(-d * 0.35) * 1.6;
          float elev = wave + ripple;
          p.y = elev;
          vElev = elev;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (1.0 + aRand * 0.6) * (10.0 / -mv.z);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorLow;
        uniform vec3 uColorHigh;
        varying float vElev;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float dist = length(c);
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist);
          float t = clamp(vElev * 0.35 + 0.5, 0.0, 1.0);
          vec3 col = mix(uColorLow, uColorHigh, t);
          gl_FragColor = vec4(col, alpha * (0.35 + t * 0.65));
        }
      `,
    });

    const points = new THREE.Points(geo, material);
    scene.add(points);

    // ---- Sizing ----
    function resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setPixelRatio(DPR);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- Mouse / camera parallax ----
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    window.addEventListener("mousemove", (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    const clock = new THREE.Clock();
    let running = true;
    document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) clock.start(); });

    canvas.classList.add("is-ready");

    function render() {
      requestAnimationFrame(render);
      if (!running) return;
      const t = clock.getElapsedTime();
      uniforms.uTime.value = REDUCED ? 0 : t;

      eased.x += (target.x - eased.x) * 0.05;
      eased.y += (target.y - eased.y) * 0.05;

      uniforms.uMouse.value.set(eased.x * (WIDTH / 2) * 0.7, -eased.y * (DEPTH / 2) * 0.7);

      // gentle camera sway toward mouse
      camera.position.x = eased.x * 2.2;
      camera.position.y = 3.2 - eased.y * 1.4;
      camera.lookAt(0, 0.3, 0);
      points.rotation.y = REDUCED ? 0 : Math.sin(t * 0.05) * 0.08;

      renderer.render(scene, camera);
    }
    render();
  }
})();
