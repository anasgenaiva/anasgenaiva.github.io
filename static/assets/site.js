(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) document.documentElement.classList.add("motion");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (x, d) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });
  const ease = (t) => 1 - Math.pow(2, -10 * t);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function countTo(el, to, d, unit, ms = 900) {
    if (reduce) { el.textContent = fmt(to, d) + unit; return; }
    const t0 = performance.now();
    const final = fmt(to, d) + unit;
    const step = (now) => { const t = Math.min(1, (now - t0) / ms); el.textContent = t < 1 ? fmt(to * ease(t), d) + unit : final; if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = final; }, ms + 150);
  }

  // Mobile menu
  const menu = $(".menu-btn"), nav = $("#nav");
  if (menu && nav) menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", String(open)); });

  // Headline word reveal
  if (!reduce) $$("[data-split]").forEach((h) => {
    const text = h.textContent.trim();
    h.setAttribute("aria-label", text);
    h.innerHTML = text.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${esc(w)}</span></span>`).join(" ");
    setTimeout(() => $$(".w > span", h).forEach((s) => s.getAnimations().forEach((a) => a.finish())), 2000);
  });

  // Scroll reveals and count-ups (content visible by default)
  const io = "IntersectionObserver" in window && !reduce ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    io.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }) : null;
  $$(".card, .bars, .mini-bars, .donut, .lab-list li, .kpi").forEach((el) => { if (io) { el.classList.add("pre"); io.observe(el); } });
  $$("[data-count]").forEach((el) => {
    const go = () => countTo(el, parseFloat(el.dataset.count), +(el.dataset.d ?? 1), el.dataset.unit || "");
    if (!io) return;
    const o = new IntersectionObserver((es) => { if (es[0].isIntersecting) { go(); o.disconnect(); } });
    o.observe(el);
  });

  // Search (dialog + inline boxes)
  let index = null;
  const loadIndex = async () => index || (index = await fetch("/assets/search.json").then((r) => r.json()).catch(() => []));
  const score = (item, q) => {
    const t = item.t.toLowerCase(), x = (item.x || "").toLowerCase();
    let s = 0;
    for (const w of q.split(/\s+/).filter(Boolean)) {
      if (t.startsWith(w)) s += 6; else if (t.includes(w)) s += 4; else if (x.includes(w)) s += 1; else return 0;
    }
    return s;
  };
  function wire(input, list, onPick) {
    let sel = -1;
    const render = async () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { list.innerHTML = ""; return; }
      const idx = await loadIndex();
      const hits = idx.map((i) => [score(i, q), i]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 8);
      sel = -1;
      list.innerHTML = hits.length ? hits.map(([, i], n) => `<li><a href="${i.u}" id="r${n}">${esc(i.t)}<span class="type">${i.k}</span></a></li>`).join("") : `<li><p class="search-empty">No results for “${esc(input.value)}”.</p></li>`;
    };
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      const links = $$("a", list);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => a.setAttribute("aria-selected", String(i === sel)));
        links[sel]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        const a = links[sel] || links[0];
        if (a) { e.preventDefault(); onPick ? onPick(a) : (location.href = a.href); }
      }
    });
    return render;
  }
  const dlg = $(".search-dialog");
  if (dlg) {
    const input = $("input", dlg), list = $(".search-results", dlg);
    wire(input, list);
    const open = () => { dlg.showModal(); input.focus(); loadIndex(); };
    $$("[data-open-search]").forEach((b) => b.addEventListener("click", open));
    addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); } if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); } });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }
  $$("[data-hero-search]").forEach((box) => {
    const input = $("input", box), render = wire(input, $(".search-results", box));
    if (box.hasAttribute("data-page-search")) { const q = new URLSearchParams(location.search).get("q"); if (q) { input.value = q; render(); } input.focus(); }
    document.addEventListener("click", (e) => { if (!box.contains(e.target)) $(".search-results", box).innerHTML = ""; });
  });

  // Nutrition label portion slider
  $$("[data-label]").forEach((lab) => {
    const range = $("[data-range]", lab), g = $("[data-grams]", lab);
    if (!range) return;
    const upd = () => {
      const w = +range.value;
      g.textContent = w + " g";
      $$("[data-k]", lab).forEach((b) => { const u = b.dataset.u; b.textContent = fmt(+b.dataset.v * w / 100, u === "g" || b.dataset.k === "iron" ? 1 : 0) + " " + u; });
    };
    range.addEventListener("input", upd);
  });

  // Donut hover
  $$(".donut").forEach((d) => {
    const label = $(".donut-label", d), def = label.innerHTML;
    $$("[data-seg]", d).forEach((s) => {
      const show = () => { label.innerHTML = `<b>${s.dataset.pct}%</b>${s.dataset.seg}`; d.dataset.active = "1"; };
      const hide = () => { label.innerHTML = def; delete d.dataset.active; };
      ["pointerenter", "focus"].forEach((ev) => s.addEventListener(ev, show));
      ["pointerleave", "blur"].forEach((ev) => s.addEventListener(ev, hide));
    });
  });

  // Compare tool
  const LBL = { kcal: ["Energy", "kcal", 0], protein: ["Protein", "g", 1], fat: ["Total fat", "g", 1], carbs: ["Carbohydrate", "g", 1], fiber: ["Fibre", "g", 1], sugars: ["Sugars", "g", 1], calcium: ["Calcium", "mg", 0], iron: ["Iron", "mg", 1], potassium: ["Potassium", "mg", 0], sodium: ["Sodium", "mg", 0] };
  $$("[data-compare]").forEach((box) => {
    const foods = JSON.parse($("[data-foods]", box).textContent), pairs = JSON.parse($("[data-pairs]", box).textContent);
    const a = $("[data-a]", box), b = $("[data-b]", box), rows = $("[data-rows]", box), link = $("[data-link]", box);
    const render = () => {
      const A = foods.find((f) => f.s === a.value), B = foods.find((f) => f.s === b.value);
      rows.innerHTML = Object.entries(LBL).map(([k, [name, u, d]]) => {
        const x = A.v[k], y = B.v[k], m = Math.max(x, y) || 1;
        return `<div class="vsrow"><div class="side left"><span class="b" style="--w:${(x / m * 100).toFixed(1)}%"></span><em>${fmt(x, d)} ${u}</em></div><div class="name">${name}</div><div class="side right"><span class="b" style="--w:${(y / m * 100).toFixed(1)}%"></span><em>${fmt(y, d)} ${u}</em></div></div>`;
      }).join("");
      const p = pairs.find(([x, y]) => (x === A.s && y === B.s) || (x === B.s && y === A.s));
      link.innerHTML = p ? `Read the full comparison: <a href="${p[2]}">${esc(A.n)} vs ${esc(B.n)}</a>` : `Open <a href="${A.u}">${esc(A.n)}</a> or <a href="${B.u}">${esc(B.n)}</a> for full details.`;
    };
    a.addEventListener("change", render); b.addEventListener("change", render); render();
  });

  // Portion calculator
  const calcData = $("#calc-data");
  if (calcData) {
    const { foods, labels, units } = JSON.parse(calcData.textContent);
    const sel = $("#food"), g = $("#grams"), out = $("#out"), err = $("#err");
    const q = new URLSearchParams(location.search).get("food"); if (q && foods.some((f) => f.s === q)) sel.value = q;
    const render = () => {
      const w = Number(g.value), f = foods.find((x) => x.s === sel.value);
      if (!g.value || !isFinite(w) || w <= 0 || w > 2000) { err.textContent = "Enter a weight between 1 and 2000 grams."; out.innerHTML = ""; return; }
      err.textContent = "";
      out.innerHTML = `<div class="table-wrap"><table><caption>${fmt(w, 0)} g of ${esc(f.n.toLowerCase())}</caption><thead><tr><th scope="col">Nutrient</th><th scope="col" class="num">Amount</th></tr></thead><tbody>${Object.keys(labels).map((k) => `<tr><th scope="row">${labels[k]}</th><td class="num">${fmt(f.v[k] * w / 100, units[k] === "g" || k === "iron" ? 1 : 0)} ${units[k]}</td></tr>`).join("")}</tbody></table></div><p class="small muted">From <a href="${f.u}">${esc(f.n)}</a>, USDA FDC ${f.fdc}.</p>`;
    };
    sel.addEventListener("change", render); g.addEventListener("input", render);
    $("#calc").addEventListener("submit", (e) => { e.preventDefault(); render(); });
    render();
  }
})();
