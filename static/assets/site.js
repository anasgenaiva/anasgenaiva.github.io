(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  if (!reduce) root.classList.add("motion");

  const fmt = (x, d) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });
  const ease = (t) => 1 - Math.pow(2, -10 * t);

  function countTo(el, to, d, unit, ms = 700) {
    const from = parseFloat(el.dataset.current || "0");
    el.dataset.current = to;
    if (reduce) { el.textContent = fmt(to, d) + unit; return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(from + (to - from) * ease(t), d) + unit;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Headline: split into words that rise in sequence
  document.querySelectorAll("[data-split]").forEach((h) => {
    if (reduce) return;
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute("aria-label", h.textContent.trim());
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(" ");
  });

  // Reveal on scroll: content is visible by default; motion only adds the entrance
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-count]").forEach((n) => countTo(n, parseFloat(n.dataset.count), +(n.dataset.d || 1), n.dataset.unit || ""));
      io.unobserve(e.target);
    }
  }, { threshold: 0.2 }) : null;
  document.querySelectorAll(".reveal, .bars, .donut, .chart section, .index-grid > a, .lab-list li").forEach((el) => {
    if (io && !reduce) { el.classList.add("pre"); io.observe(el); } else el.classList.add("in");
  });

  // Home: nutrient switcher re-measures every food on the wall chart
  const sw = document.querySelector("[data-switch]");
  if (sw) {
    const rows = [...document.querySelectorAll(".chart li[data-food]")];
    const apply = (key) => {
      const vals = rows.map((r) => parseFloat(r.dataset[key]));
      const max = Math.max(...vals);
      const unit = { protein: " g", fiber: " g", kcal: " kcal", iron: " mg" }[key];
      const d = key === "kcal" ? 0 : 1;
      rows.forEach((r, i) => {
        countTo(r.querySelector(".per"), vals[i], d, unit);
        r.style.setProperty("--w", (vals[i] / max * 100).toFixed(1) + "%");
      });
      sw.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.key === key)));
      const cap = document.querySelector("[data-switch-caption]");
      if (cap) cap.textContent = sw.querySelector(`[data-key="${key}"]`).textContent;
    };
    sw.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) apply(b.dataset.key); });
    apply("protein");
  }

  // Pointer-tracked light on group fields
  if (!reduce && matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".field, .chart section").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        el.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      });
    });
  }

  // Donut segments: hover or focus names the share
  document.querySelectorAll(".donut").forEach((d) => {
    const label = d.querySelector(".donut-label");
    const def = label ? label.innerHTML : "";
    d.querySelectorAll("[data-seg]").forEach((s) => {
      const show = () => { if (label) label.innerHTML = `<b>${s.dataset.pct}%</b>${s.dataset.seg}`; d.dataset.active = s.dataset.key; };
      const hide = () => { if (label) label.innerHTML = def; delete d.dataset.active; };
      s.addEventListener("pointerenter", show); s.addEventListener("pointerleave", hide);
      s.addEventListener("focus", show); s.addEventListener("blur", hide);
    });
  });
})();
