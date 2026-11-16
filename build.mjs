// Builds the Plate Notes site into the repository root (GitHub Pages serves main /).
// Run: node build.mjs
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const config = JSON.parse(await readFile("config.json", "utf8"));
const data = JSON.parse(await readFile("data/foods.json", "utf8"));
const photos = JSON.parse(await readFile("data/photos.json", "utf8"));
const SITE = config.siteUrl.replace(/\/$/, "");
const TODAY = config.updated;
const NAME = "Plate Notes";

const GROUPS = {
  grains: { name: "Grains", blurb: "Oats, rice, quinoa and other whole grains, measured dry or cooked." },
  legumes: { name: "Legumes", blurb: "Lentils, beans and peas: protein and fibre in one food." },
  "dairy-eggs": { name: "Eggs & dairy", blurb: "Eggs, milk, yogurt and cheese." },
  vegetables: { name: "Vegetables", blurb: "Leafy greens and roots, low in energy and rich in potassium." },
  fish: { name: "Fish & seafood", blurb: "Oily and lean fish, fresh and canned." },
  "nuts-seeds": { name: "Nuts & seeds", blurb: "Energy-dense foods where most calories come from fat." },
  fruit: { name: "Fruit", blurb: "Everyday fruit, from bananas to avocado." },
};

const LABELS = { kcal: "Energy", protein: "Protein", fat: "Total fat", carbs: "Carbohydrate", fiber: "Fibre", sugars: "Sugars", calcium: "Calcium", iron: "Iron", potassium: "Potassium", sodium: "Sodium" };
const UNITS = { kcal: "kcal", protein: "g", fat: "g", carbs: "g", fiber: "g", sugars: "g", calcium: "mg", iron: "mg", potassium: "mg", sodium: "mg" };

const NOTES = {
  "rolled-oats": "These values are for dry oats. Cooking with water adds weight, so 100 g of cooked porridge holds far less of everything than 100 g of dry oats.",
  "brown-rice": "These values are for cooked rice, which is mostly water by weight. Dry rice is a separate USDA record with much higher numbers per 100 g.",
  lentils: "These values are for lentils boiled without salt. Lentils cook from dry without soaking, which makes them one of the quickest legumes to prepare.",
  chickpeas: "These values are for chickpeas cooked from dry without salt. Canned chickpeas usually contain added salt, so their sodium figure will be higher.",
  eggs: "These values are for raw whole egg without the shell. USDA counts one large egg as about 50 g, so one egg is roughly half of the amounts shown.",
  "greek-yogurt": "These values are for plain, nonfat Greek yogurt. Flavoured versions add sugar, and full-fat versions add fat and energy.",
  spinach: "These values are for raw leaves. Cooked spinach is a separate USDA record, so use the record that matches how you eat it.",
  broccoli: "These values are for raw broccoli. Boiled and frozen broccoli have their own USDA records with slightly different numbers.",
  salmon: "These values are for raw farmed Atlantic salmon. Wild salmon is a separate record and is usually leaner.",
  almonds: "These values are for plain almonds. Most of their energy comes from fat, which is why a small handful (about 28 g) already carries a lot of calories.",
  sardines: "These values are for sardines canned in oil, drained, with the bones. Eating the soft bones is what makes canned sardines a source of calcium.",
  tuna: "These values are for light tuna canned in water and drained. Tuna canned in oil is a separate record with more fat.",
  milk: "These values are for 2% fat milk. 100 g of milk is roughly 97 ml, so the numbers are close to per 100 ml.",
  cheddar: "These values are for cheddar cheese. Cheese is concentrated milk, so it is dense in protein, fat, calcium and sodium.",
  avocado: "These values are for raw avocado flesh. Unlike most fruit, most of its energy comes from fat.",
};

const foods = data.foods.map((f) => ({ ...f, url: `/foods/${f.slug}/` }));
const bySlug = Object.fromEntries(foods.map((f) => [f.slug, f]));
const v = (f, k) => f.n[k].value;
const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });
const fmtN = (k, x) => fmt(x, UNITS[k] === "g" || k === "iron" ? 1 : 0);
const per100kcal = (f) => (v(f, "protein") / v(f, "kcal")) * 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], m = n % 100; return n + (s[(m - 20) % 10] || s[m] || s[0]); };
const rankOf = (f, key, asc = false) => [...foods].sort((a, b) => asc ? v(a, key) - v(b, key) : v(b, key) - v(a, key)).findIndex((x) => x.slug === f.slug) + 1;
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function note(f) {
  if (NOTES[f.slug]) return NOTES[f.slug];
  const d = f.description.toLowerCase();
  const state = d.includes("cooked") || d.includes("boiled") ? "cooked, so they include the water the food absorbs" : d.includes("canned") ? "for the canned product, drained" : d.includes("dried") || d.includes("dry") ? "for the dry food, before any cooking" : "for the raw food";
  return `These values come from the USDA record “${f.description}” and are ${state}. Other forms of ${lower(f.name.split(",")[0])} have their own USDA records with different numbers.`;
}

const BEST = [
  { slug: "high-protein-foods", key: "protein", title: "High-protein foods", h1: "Foods highest in protein per 100 g", why: "Protein helps build and repair tissue. This list ranks every food on the site by grams of protein in 100 g." },
  { slug: "high-fiber-foods", key: "fiber", title: "High-fibre foods", h1: "Foods highest in fibre per 100 g", why: "Fibre is the part of plant foods the body cannot digest. Here every food on the site is ranked by grams of fibre in 100 g." },
  { slug: "iron-rich-foods", key: "iron", title: "Iron-rich foods", h1: "Foods highest in iron per 100 g", why: "Iron is part of haemoglobin, which carries oxygen in the blood. Every food on the site, ranked by milligrams of iron in 100 g." },
  { slug: "calcium-rich-foods", key: "calcium", title: "Calcium-rich foods", h1: "Foods highest in calcium per 100 g", why: "Calcium is the main mineral in bones and teeth. Every food on the site, ranked by milligrams of calcium in 100 g." },
  { slug: "potassium-rich-foods", key: "potassium", title: "Potassium-rich foods", h1: "Foods highest in potassium per 100 g", why: "Potassium helps nerves and muscles work. Every food on the site, ranked by milligrams of potassium in 100 g." },
  { slug: "low-calorie-foods", key: "kcal", asc: true, title: "Low-calorie foods", h1: "Lowest-calorie foods per 100 g", why: "Energy density is how many calories a food packs into its weight. Every food on the site, from lowest to highest kcal per 100 g." },
  { slug: "protein-per-calorie", key: "p100", title: "Protein per calorie", h1: "Most protein per 100 calories", why: "Protein per 100 kcal shows how much protein you get for the energy you eat. It removes the effect of water and fat." },
];
const bestVal = (f, b) => (b.key === "p100" ? per100kcal(f) : v(f, b.key));
const bestFmt = (f, b) => (b.key === "p100" ? fmt(per100kcal(f), 1) : fmtN(b.key, v(f, b.key)));
const bestUnit = (b) => (b.key === "p100" ? "g" : UNITS[b.key]);

const PAIRS = [
  ["eggs", "greek-yogurt"], ["salmon", "tuna"], ["quinoa", "brown-rice"], ["almonds", "walnuts"], ["lentils", "chickpeas"],
  ["rolled-oats", "quinoa"], ["black-beans", "kidney-beans"], ["cheddar", "cottage-cheese"], ["greek-yogurt", "whole-milk-yogurt"],
  ["spinach", "kale"], ["sweet-potato", "carrots"], ["bananas", "apples"], ["blueberries", "oranges"], ["sardines", "mackerel"],
  ["cod", "salmon"], ["flaxseed", "pumpkin-seeds"], ["peanuts", "almonds"], ["edamame", "eggs"], ["split-peas", "lentils"],
  ["bulgur", "quinoa"], ["whole-wheat-pasta", "brown-rice"], ["pearl-barley", "brown-rice"], ["buckwheat", "rolled-oats"], ["avocado", "almonds"],
].filter(([a, b]) => bySlug[a] && bySlug[b]);
const pairUrl = (a, b) => `/compare/${a}-vs-${b}/`;

const RECIPES = [
  { slug: "overnight-oats-greek-yogurt", name: "Overnight oats with Greek yogurt and almonds", group: "grains", serves: 1, prep: 5, cook: 0, rest: "8 hours in the fridge",
    items: [["rolled-oats", 50], ["greek-yogurt", 150], ["almonds", 15]], extra: ["60 ml water or milk (water assumed in the nutrition)", "A pinch of cinnamon (optional)"],
    steps: ["Stir the oats, yogurt and water together in a jar.", "Cover and leave in the fridge for at least 8 hours.", "Chop the almonds and scatter them on top just before eating."],
    desc: "A no-cook breakfast: oats softened overnight in Greek yogurt, finished with chopped almonds." },
  { slug: "lentil-spinach-soup", name: "Lentil and spinach soup", group: "legumes", serves: 4, prep: 10, cook: 15,
    items: [["lentils", 600], ["spinach", 150]], extra: ["800 ml water", "1 tsp ground cumin", "Juice of half a lemon", "Salt to taste"],
    steps: ["Warm the cooked lentils with the water and cumin in a large pan.", "Simmer for 10 minutes, then mash about a third of the lentils to thicken the soup.", "Stir in the spinach until it wilts, about 2 minutes.", "Season with lemon juice and salt."],
    desc: "Cooked lentils simmered with cumin, thickened by mashing, and finished with fresh spinach." },
  { slug: "chickpea-egg-broccoli-bowl", name: "Chickpea, egg and broccoli rice bowl", group: "dairy-eggs", serves: 2, prep: 10, cook: 12,
    items: [["brown-rice", 300], ["chickpeas", 240], ["eggs", 100], ["broccoli", 200]], extra: ["Salt and black pepper", "Lemon wedges to serve"],
    steps: ["Boil the eggs for 9 minutes, cool them in cold water and peel.", "Steam the broccoli for 4 to 5 minutes until just tender.", "Warm the rice and chickpeas.", "Divide between two bowls, top with halved eggs and broccoli, and season."],
    desc: "Brown rice and chickpeas topped with boiled eggs and steamed broccoli." },
  { slug: "salmon-rice-broccoli", name: "Baked salmon with brown rice and broccoli", group: "fish", serves: 2, prep: 5, cook: 15,
    items: [["salmon", 300], ["brown-rice", 300], ["broccoli", 200]], extra: ["Salt and black pepper", "Lemon wedges to serve"],
    steps: ["Heat the oven to 200 °C (400 °F).", "Season the salmon and bake on a lined tray for 12 to 15 minutes, until it flakes easily.", "Steam the broccoli for 4 to 5 minutes and warm the rice.", "Serve the salmon on the rice with the broccoli and lemon."],
    desc: "Oven-baked salmon fillets with brown rice and steamed broccoli, ready in 20 minutes." },
];
for (const r of RECIPES) {
  r.url = `/recipes/${r.slug}/`;
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugars: 0, sodium: 0 };
  for (const [s, g] of r.items) for (const k of Object.keys(t)) t[k] += v(bySlug[s], k) * g / 100;
  for (const k of Object.keys(t)) t[k] /= r.serves;
  r.nut = t;
}

const NAV = [["/foods/", "Foods"], ["/best/", "Top lists"], ["/compare/", "Compare"], ["/recipes/", "Recipes"], ["/guides/", "Guides"], ["/lab/", "SEO lab"]];
const ICON = {
  search: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  menu: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  arrow: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#1f6f43"/><rect x="7" y="9" width="4" height="14" rx="2" fill="#e8f36a"/><rect x="14" y="13" width="4" height="10" rx="2" fill="#fff"/><rect x="21" y="6" width="4" height="17" rx="2" fill="#fff" opacity=".7"/></svg>`;

const pages = []; // { path, html, sitemap: "pages"|"foods"|"lab"|false, images: [] }
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

function crumbs(trail) {
  const items = [["/", "Home"], ...trail];
  return {
    html: `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([h, l], i) => i === items.length - 1 ? `<li><span aria-current="page">${esc(l)}</span></li>` : `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ol></nav>`,
    schema: { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([h, l], i) => ({ "@type": "ListItem", position: i + 1, name: l, item: SITE + h })) },
  };
}

function img(key, alt, { cls = "", eager = false, sizes = "(max-width: 860px) 100vw, 50vw" } = {}) {
  const p = photos[key];
  return `<img src="${p.file}" width="${p.width}" height="${p.height}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'} sizes="${sizes}"${cls ? ` class="${cls}"` : ""}>`;
}
const credit = (key) => { const p = photos[key]; return `Photo: <a href="${p.source}">${esc(p.author)}</a>, ${esc(p.license)}, via Wikimedia Commons`; };

function layout({ path, title, description, body, group = "", schemas = [], robots, canonical, headExtra = "", noTitle = false, noDescription = false, nav, ogImage = "hero", prev, next }) {
  const canon = canonical === null ? "" : `<link rel="canonical" href="${SITE}${canonical || path}">`;
  const verify = config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : "";
  const ga = config.ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(config.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${esc(config.ga4Id)}");</script>` : "";
  const og = photos[ogImage] || photos.hero;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noTitle ? "" : `<title>${esc(title)}</title>`}
${noDescription ? "" : `<meta name="description" content="${esc(description)}">`}
${robots ? `<meta name="robots" content="${robots}">` : ""}
${canon}
${prev ? `<link rel="prev" href="${SITE}${prev}">` : ""}${next ? `<link rel="next" href="${SITE}${next}">` : ""}
${verify}
<meta property="og:site_name" content="${NAME}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title || NAME)}">
${noDescription ? "" : `<meta property="og:description" content="${esc(description)}">`}
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}${og.file}">
<meta property="og:image:width" content="${og.width}"><meta property="og:image:height" content="${og.height}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1f6f43">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/logo.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/hanken.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
${headExtra}
${ga}
${schemas.map(ld).join("\n")}
</head>
<body${group ? ` class="g-${group}"` : ""}>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<a class="brand" href="/">${LOGO}${NAME}</a>
<nav id="nav" aria-label="Main"><ul>${NAV.map(([h, l]) => `<li><a href="${h}"${nav === h ? ' aria-current="page"' : ""}>${l}</a></li>`).join("")}</ul></nav>
<button class="search-btn" type="button" data-open-search aria-label="Search foods">${ICON.search}<span>Search foods</span><kbd>Ctrl K</kbd></button>
<button class="menu-btn" type="button" aria-controls="nav" aria-expanded="false" aria-label="Menu">${ICON.menu}</button>
</div></header>
<dialog class="search-dialog" aria-label="Search">
<div class="search-box">${ICON.search}<input type="search" placeholder="Search 40 foods, lists, comparisons, recipes" aria-label="Search" autocomplete="off"></div>
<ul class="search-results" role="listbox"></ul>
</dialog>
${body}
<footer><div class="wrap">
<div class="cols">
<div><a class="brand" href="/">${LOGO}${NAME}</a><p class="muted small">Per-100 g nutrition for ${foods.length} everyday foods, straight from USDA FoodData Central. General information, not medical advice.</p></div>
<div><h3>Explore</h3><ul><li><a href="/foods/">All foods</a></li><li><a href="/best/">Top lists</a></li><li><a href="/compare/">Compare foods</a></li><li><a href="/recipes/">Recipes</a></li></ul></div>
<div><h3>Learn</h3><ul><li><a href="/guides/">Guides</a></li><li><a href="/tools/portion-calculator/">Portion calculator</a></li><li><a href="/lab/">SEO lab</a></li></ul></div>
<div><h3>Site</h3><ul><li><a href="/about/">About</a></li><li><a href="/credits/">Photo credits</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/sitemap/">Sitemap</a></li></ul></div>
</div>
<p class="legal">Nutrient data: USDA FoodData Central, SR Legacy (public domain). Photos: Wikimedia Commons, licences on the <a href="/credits/">credits page</a>.</p>
</div></footer>
</body>
</html>
`;
}
const add = (path, html, sitemap = "pages", images = []) => pages.push({ path, html, sitemap, images });

const miniBars = (f) => {
  const rows = [["protein", "Protein", 31], ["fiber", "Fibre", 28], ["fat", "Fat", 66]];
  return `<div class="mini-bars">${rows.map(([k, l, max], i) => `<div style="--n:${i}"><span>${l}</span><span class="track"><span class="fill" style="--w:${Math.min(100, v(f, k) / max * 100).toFixed(1)}%"></span></span><em>${fmt(v(f, k))} g</em></div>`).join("")}</div>`;
};
const foodCard = (f, i = 0) => `<a class="card food-card g-${f.group}" href="${f.url}" style="--d:${i % 8}"><div class="body"><div class="top-line"><span class="badge">${GROUPS[f.group].name}</span><span class="kcal">${fmt(v(f, "kcal"), 0)} kcal</span></div><h3>${esc(f.name)}</h3>${miniBars(f)}</div></a>`;

// ---------- Home ----------
{
  const topProtein = [...foods].sort((a, b) => v(b, "protein") - v(a, "protein")).slice(0, 8);
  const feature = bySlug.lentils;
  const groupCards = Object.entries(GROUPS).map(([g, m], i) => {
    const n = foods.filter((f) => f.group === g).length;
    return `<a class="card g-${g}" href="/groups/${g}/" style="--d:${i}">${img(g, `${m.name}`, { sizes: "(max-width: 600px) 100vw, 25vw" })}<div class="body"><span class="badge">${n} foods</span><h3>${m.name}</h3><p>${m.blurb}</p></div></a>`;
  }).join("");
  const body = `<main id="main">
<section class="hero"><div class="wrap">
<div>
<h1 data-split>Know what is on your plate</h1>
<p class="lede">Protein, fibre, calories and minerals for ${foods.length} everyday foods, per 100 grams, straight from USDA data.</p>
<div class="hero-search" data-hero-search>${ICON.search}<input type="search" placeholder="Try “lentils”, “high protein” or “salmon vs tuna”" aria-label="Search foods" autocomplete="off"><ul class="search-results" role="listbox"></ul></div>
<a class="btn" href="/foods/">Browse all foods ${ICON.arrow}</a> <a class="btn ghost" href="/compare/">Compare two foods</a>
<div class="stats"><div><b data-count="${foods.length}" data-d="0">${foods.length}</b>foods</div><div><b data-count="${BEST.length}" data-d="0">${BEST.length}</b>ranked lists</div><div><b data-count="${PAIRS.length}" data-d="0">${PAIRS.length}</b>comparisons</div><div><b>USDA</b>sourced</div></div>
</div>
<div class="hero-visual">${img("hero", "Fresh vegetables piled on a market stall", { eager: true })}
<div class="float-card"><h3>${esc(feature.name)} · per 100 g</h3><div class="row"><span>Energy</span><b>${fmt(v(feature, "kcal"), 0)} kcal</b></div><div class="row"><span>Protein</span><b>${fmt(v(feature, "protein"))} g</b></div><div class="row"><span>Fibre</span><b>${fmt(v(feature, "fiber"))} g</b></div><div class="row"><span>Iron</span><b>${fmt(v(feature, "iron"))} mg</b></div></div>
<p class="photo-credit">${credit("hero")}</p></div>
</div></section>
<section class="section"><div class="wrap">
<div class="section-head"><div><h2>Browse by food group</h2><p>Seven groups, each with its own top foods and comparisons.</p></div><a href="/foods/">All ${foods.length} foods →</a></div>
<div class="grid">${groupCards}</div>
</div></section>
<section class="section alt"><div class="wrap">
<div class="section-head"><div><h2>Highest in protein</h2><p>Grams of protein per 100 g. Bars show protein, fibre and fat.</p></div><a href="/best/high-protein-foods/">Full ranking →</a></div>
<div class="grid">${topProtein.map(foodCard).join("")}</div>
</div></section>
<section class="section"><div class="wrap">
<div class="section-head"><div><h2>Compare any two foods</h2><p>Pick two foods and see every nutrient side by side.</p></div><a href="/compare/">${PAIRS.length} ready-made comparisons →</a></div>
${compareTool("eggs", "greek-yogurt")}
</div></section>
<section class="section alt"><div class="wrap">
<div class="section-head"><div><h2>Recipes with real numbers</h2><p>Built only from foods on this site, with nutrition per serving.</p></div><a href="/recipes/">All recipes →</a></div>
<div class="grid wide">${RECIPES.map((r, i) => `<a class="card g-${r.group}" href="${r.url}" style="--d:${i}">${img(r.slug, r.name, { sizes: "(max-width: 600px) 100vw, 33vw" })}<div class="body"><h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p><div class="meta"><span><b>${fmt(r.nut.kcal, 0)}</b> kcal</span><span><b>${fmt(r.nut.protein)} g</b> protein</span><span>Serves ${r.serves}</span></div></div></a>`).join("")}</div>
</div></section>
<section class="section"><div class="wrap"><div class="lab-band">
<div><h2>Learning Google Search Console?</h2><p>The SEO lab holds pages broken on purpose. Each one shows a different Search Console status, with notes on what to look for and how to fix it.</p><a class="btn" href="/lab/">Open the SEO lab ${ICON.arrow}</a></div>
<ul><li><code>noindex</code> Excluded by noindex tag</li><li><code>404</code> Not found</li><li><code>canonical</code> Alternate page with proper canonical</li><li><code>robots.txt</code> Blocked by robots.txt</li></ul>
</div></div></section>
</main>`;
  add("/", layout({
    path: "/", title: `${NAME}: nutrition per 100 g for ${foods.length} everyday foods`,
    description: `Protein, fibre, calories, iron, calcium and potassium per 100 g for ${foods.length} everyday foods from USDA FoodData Central, with ranked lists, comparisons and recipes.`,
    body, schemas: [
      { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: SITE + "/", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE}/search/?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
      { "@context": "https://schema.org", "@type": "Organization", name: NAME, url: SITE + "/", logo: SITE + "/assets/logo.png" },
    ],
  }), "pages", ["hero"]);
}

function compareTool(a, b) {
  const data = foods.map((f) => ({ s: f.slug, n: f.name, u: f.url, v: Object.fromEntries(Object.keys(LABELS).map((k) => [k, v(f, k)])) }));
  const opts = (sel) => foods.map((f) => `<option value="${f.slug}"${f.slug === sel ? " selected" : ""}>${esc(f.name)}</option>`).join("");
  return `<div class="compare" data-compare><div class="compare-pick"><label>First food<select data-a>${opts(a)}</select></label><span class="vs">vs</span><label>Second food<select data-b>${opts(b)}</select></label></div><div data-rows></div><p class="small muted" data-link></p><script type="application/json" data-foods>${JSON.stringify(data)}</script><script type="application/json" data-pairs>${JSON.stringify(PAIRS.map(([x, y]) => [x, y, pairUrl(x, y)]))}</script></div>`;
}

// ---------- Food pages ----------
function donut(f) {
  const parts = [["Protein", v(f, "protein") * 4, "var(--g)"], ["Fat", v(f, "fat") * 9, "#0f1a14"], ["Carbohydrate", v(f, "carbs") * 4, "#cdd5cf"]];
  const sum = parts.reduce((a, p) => a + p[1], 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let off = 0;
  const circles = parts.map(([label, kc, color]) => {
    const len = (kc / sum) * C, pct = Math.round((kc / sum) * 100);
    const c = `<circle data-seg="${label}" data-pct="${pct}" tabindex="0" cx="90" cy="90" r="${R}" stroke="${color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" style="--len:${(C - off).toFixed(2)}"><title>${label}: ${pct}% of energy</title></circle>`;
    off += len; return c;
  }).join("");
  return `<div class="donut"><div class="donut-fig"><svg viewBox="0 0 180 180" role="img" aria-label="Share of energy from protein, fat and carbohydrate">${circles}</svg><div class="donut-label"><b>${fmt(v(f, "kcal"), 0)}</b>kcal / 100 g</div></div><ul class="donut-key">${parts.map(([l, kc, c]) => `<li><i style="background:${c}"></i>${l}<span style="margin-left:auto;font-weight:700">${Math.round((kc / sum) * 100)}%</span></li>`).join("")}</ul></div>`;
}

function label(f) {
  const row = (k, cls = "") => `<div class="row ${cls}"><span>${LABELS[k]}</span><b data-k="${k}" data-v="${v(f, k)}" data-u="${UNITS[k]}">${fmtN(k, v(f, k))} ${UNITS[k]}</b></div>`;
  return `<div class="label" data-label><h2>Nutrition facts</h2><div class="serving"><span>Amount</span><span class="grams" data-grams>100 g</span></div><label class="small muted" for="g-${f.slug}">Drag to change the portion</label><input id="g-${f.slug}" type="range" min="10" max="300" step="5" value="100" data-range>
${row("kcal", "big")}${row("fat")}${row("carbs")}${row("fiber", "sub")}${row("sugars", "sub")}${row("protein")}${row("sodium")}${row("calcium")}${row("iron")}${row("potassium")}
<p class="src">USDA FoodData Central record <a href="https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients">${f.fdcId}</a>, SR Legacy. Values scale linearly from 100 g.</p></div>`;
}

for (const f of foods) {
  const g = GROUPS[f.group];
  const c = crumbs([["/foods/", "Foods"], [`/groups/${f.group}/`, g.name], [f.url, f.name]]);
  const pr = rankOf(f, "protein"), fr = rankOf(f, "fiber");
  const share = (x) => Math.round((x / v(f, "kcal")) * 100);
  const pairs = PAIRS.filter(([a, b]) => a === f.slug || b === f.slug);
  const lists = BEST.map((b) => ({ b, r: [...foods].sort((x, y) => b.asc ? bestVal(x, b) - bestVal(y, b) : bestVal(y, b) - bestVal(x, b)).findIndex((x) => x.slug === f.slug) + 1 })).filter((x) => x.r <= 10);
  const related = foods.filter((x) => x.group === f.group && x.slug !== f.slug);
  const body = `<main id="main">
<div class="page-head"><div class="wrap">${c.html}
<a class="badge" href="/groups/${f.group}/" style="margin-top:18px">${g.name}</a>
<h1 data-split>${esc(f.name)} nutrition per 100 g</h1>
<p class="lede">${fmt(v(f, "kcal"), 0)} kcal, ${fmt(v(f, "protein"))} g protein and ${fmt(v(f, "fiber"))} g fibre in every 100 grams.</p>
<div class="kpis"><div class="kpi"><span>Energy</span><b data-count="${v(f, "kcal")}" data-d="0">${fmt(v(f, "kcal"), 0)}</b><span>kcal</span></div><div class="kpi"><span>Protein</span><b data-count="${v(f, "protein")}" data-unit=" g">${fmt(v(f, "protein"))} g</b><span>${ordinal(pr)} of ${foods.length}</span></div><div class="kpi"><span>Fibre</span><b data-count="${v(f, "fiber")}" data-unit=" g">${fmt(v(f, "fiber"))} g</b><span>${ordinal(fr)} of ${foods.length}</span></div><div class="kpi"><span>Fat</span><b data-count="${v(f, "fat")}" data-unit=" g">${fmt(v(f, "fat"))} g</b><span>per 100 g</span></div></div>
</div></div>
<div class="wrap layout"><article class="prose">
<figure class="figure">${img(f.group, `${g.name}: ${lower(g.blurb)}`, { sizes: "(max-width: 960px) 100vw, 720px" })}<figcaption>Representative photo for ${g.name.toLowerCase()}. ${credit(f.group)}</figcaption></figure>
<p>${esc(note(f))}</p>
<h2>Where the energy comes from</h2>
${donut(f)}
<p class="small muted">Shares use 4 kcal per gram for protein and carbohydrate and 9 for fat, so they are estimates; fibre sits inside carbohydrate.</p>
<h2>How ${esc(lower(f.name.split(",")[0]))} compares</h2>
<ul>
<li>Protein: <b>${fmt(v(f, "protein"))} g</b> per 100 g, ${ordinal(pr)} of the ${foods.length} foods on this site.</li>
<li>Fibre: <b>${fmt(v(f, "fiber"))} g</b>, ${ordinal(fr)} of ${foods.length}.</li>
<li>Protein per 100 kcal: <b>${fmt(per100kcal(f))} g</b>.</li>
<li>About <b>${share(v(f, "fat") * 9)}%</b> of its energy comes from fat and <b>${share(v(f, "protein") * 4)}%</b> from protein.</li>
</ul>
${lists.length ? `<h3>Appears in these top-10 lists</h3><ul>${lists.map(({ b, r }) => `<li><a href="/best/${b.slug}/">${b.title}</a>: ${ordinal(r)}</li>`).join("")}</ul>` : ""}
${pairs.length ? `<h3>Side-by-side comparisons</h3><ul>${pairs.map(([a, b]) => `<li><a href="${pairUrl(a, b)}">${esc(bySlug[a].name)} vs ${esc(bySlug[b].name)}</a></li>`).join("")}</ul>` : ""}
<p>Work out a real portion with the <a href="/tools/portion-calculator/?food=${f.slug}">portion calculator</a>, or drag the slider on the nutrition label.</p>
<div class="source-box"><b>Source</b><dl><dt>Database</dt><dd>USDA FoodData Central, SR Legacy</dd><dt>Record</dt><dd><a href="https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients">FDC ${f.fdcId}</a> (NDB ${f.ndb})</dd><dt>USDA name</dt><dd>${esc(f.description)}</dd><dt>Category</dt><dd>${esc(f.category || "")}</dd><dt>Basis</dt><dd>Per 100 g edible portion</dd></dl></div>
<p class="small muted" style="margin-top:18px">Values are averages for this record; brands and preparation vary. General information, not medical or dietary advice.</p>
</article>
<aside><div class="sticky">${label(f)}</div></aside>
</div>
${related.length ? `<section class="section alt"><div class="wrap"><div class="section-head"><h2>More ${esc(g.name.toLowerCase())}</h2><a href="/groups/${f.group}/">All ${esc(g.name.toLowerCase())} →</a></div><div class="grid">${related.slice(0, 4).map(foodCard).join("")}</div></div></section>` : ""}
</main>`;
  add(f.url, layout({
    path: f.url, group: f.group, nav: "/foods/", ogImage: f.group,
    title: `${f.name} nutrition per 100 g: ${fmt(v(f, "protein"))} g protein, ${fmt(v(f, "kcal"), 0)} kcal | ${NAME}`,
    description: `${f.name} per 100 g: ${fmt(v(f, "kcal"), 0)} kcal, ${fmt(v(f, "protein"))} g protein, ${fmt(v(f, "fiber"))} g fibre, ${fmt(v(f, "iron"))} mg iron and ${fmtN("calcium", v(f, "calcium"))} mg calcium. USDA FDC ${f.fdcId}.`,
    body, schemas: [c.schema, {
      "@context": "https://schema.org", "@type": "Article", headline: `${f.name} nutrition per 100 g`, image: [SITE + photos[f.group].file], datePublished: TODAY, dateModified: TODAY,
      author: { "@type": "Organization", name: NAME, url: SITE + "/about/" }, publisher: { "@type": "Organization", name: NAME, logo: { "@type": "ImageObject", url: SITE + "/assets/logo.png" } },
      isBasedOn: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`, mainEntityOfPage: SITE + f.url,
    }],
  }), "foods", [f.group]);
}

// ---------- Food index (paginated) and groups ----------
{
  const PER = 16;
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name));
  const total = Math.ceil(sorted.length / PER);
  for (let p = 1; p <= total; p++) {
    const path = p === 1 ? "/foods/" : `/foods/page/${p}/`;
    const c = crumbs(p === 1 ? [["/foods/", "Foods"]] : [["/foods/", "Foods"], [path, `Page ${p}`]]);
    const pager = `<nav class="pager" aria-label="Pages">${Array.from({ length: total }, (_, i) => i + 1).map((n) => n === p ? `<span aria-current="page">${n}</span>` : `<a href="${n === 1 ? "/foods/" : `/foods/page/${n}/`}">${n}</a>`).join("")}</nav>`;
    const body = `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>All foods${p > 1 ? `, page ${p}` : ""}</h1><p class="lede">${foods.length} foods A to Z, each with per-100 g values from USDA FoodData Central.</p></div></div>
<div class="wrap section"><div class="pills">${Object.entries(GROUPS).map(([g, m]) => `<a class="pill" href="/groups/${g}/">${m.name}</a>`).join("")}</div>
<div class="grid">${sorted.slice((p - 1) * PER, p * PER).map(foodCard).join("")}</div>${pager}</div></main>`;
    add(path, layout({ path, nav: "/foods/", title: `All foods${p > 1 ? ` (page ${p})` : ""}: nutrition per 100 g | ${NAME}`, description: `Browse ${foods.length} everyday foods A to Z${p > 1 ? `, page ${p} of ${total}` : ""}, with protein, fibre, fat and calories per 100 g from USDA data.`, body, schemas: [c.schema], prev: p > 1 ? (p === 2 ? "/foods/" : `/foods/page/${p - 1}/`) : null, next: p < total ? `/foods/page/${p + 1}/` : null }));
  }
  for (const [g, m] of Object.entries(GROUPS)) {
    const list = foods.filter((f) => f.group === g);
    const path = `/groups/${g}/`;
    const c = crumbs([["/foods/", "Foods"], [path, m.name]]);
    const rows = [...list].sort((a, b) => v(b, "protein") - v(a, "protein"));
    const body = `<main id="main"><div class="page-head"><div class="wrap">${c.html}<span class="badge" style="margin-top:18px">${list.length} foods</span><h1 data-split>${m.name}: nutrition per 100 g</h1><p class="lede">${m.blurb}</p></div></div>
<div class="wrap section"><figure class="figure">${img(g, m.name, { sizes: "100vw" })}<figcaption>${credit(g)}</figcaption></figure>
<div class="grid">${list.map(foodCard).join("")}</div>
<h2>${m.name} side by side</h2><div class="table-wrap"><table><thead><tr><th scope="col">Food</th><th scope="col" class="num">kcal</th><th scope="col" class="num">Protein g</th><th scope="col" class="num">Fibre g</th><th scope="col" class="num">Fat g</th><th scope="col" class="num">Iron mg</th></tr></thead><tbody>${rows.map((f) => `<tr><th scope="row"><a href="${f.url}">${esc(f.name)}</a></th><td class="num">${fmt(v(f, "kcal"), 0)}</td><td class="num">${fmt(v(f, "protein"))}</td><td class="num">${fmt(v(f, "fiber"))}</td><td class="num">${fmt(v(f, "fat"))}</td><td class="num">${fmt(v(f, "iron"))}</td></tr>`).join("")}</tbody></table></div></div></main>`;
    add(path, layout({ path, group: g, nav: "/foods/", ogImage: g, title: `${m.name}: nutrition per 100 g for ${list.length} foods | ${NAME}`, description: `${m.name} compared per 100 g: ${list.map((f) => f.name.split(",")[0]).join(", ")}. Protein, fibre, fat, iron and calories from USDA data.`, body, schemas: [c.schema, { "@context": "https://schema.org", "@type": "CollectionPage", name: m.name, url: SITE + path }] }), "pages", [g]);
  }
}

// ---------- Best lists ----------
for (const b of BEST) {
  const path = `/best/${b.slug}/`;
  const c = crumbs([["/best/", "Top lists"], [path, b.title]]);
  const sorted = [...foods].sort((x, y) => b.asc ? bestVal(x, b) - bestVal(y, b) : bestVal(y, b) - bestVal(x, b));
  const max = Math.max(...sorted.map((f) => bestVal(f, b)));
  const u = bestUnit(b);
  const top = sorted[0];
  const body = `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>${b.h1}</h1><p class="lede">${b.why}</p></div></div>
<div class="wrap section"><div class="callout"><strong>Top of the list:</strong> <a href="${top.url}">${esc(top.name)}</a> with ${bestFmt(top, b)} ${u}${b.key === "p100" ? " protein per 100 kcal" : " per 100 g"}.</div>
<div class="table-wrap"><table><caption>All ${foods.length} foods, ${b.asc ? "lowest" : "highest"} first</caption><thead><tr><th scope="col" class="rank">#</th><th scope="col">Food</th><th scope="col" class="hide-sm">Group</th><th scope="col" class="num">${b.key === "p100" ? "Protein per 100 kcal" : `${LABELS[b.key]} per 100 g`}</th><th scope="col" class="bar-cell hide-sm"><span class="sr" style="position:absolute;left:-9999px">Bar</span></th></tr></thead><tbody>
${sorted.map((f, i) => `<tr class="g-${f.group}"><td class="rank">${i + 1}</td><th scope="row"><a href="${f.url}">${esc(f.name)}</a></th><td class="hide-sm"><span class="badge">${GROUPS[f.group].name}</span></td><td class="num"><b>${bestFmt(f, b)} ${u}</b></td><td class="bar-cell hide-sm"><span style="--w:${(bestVal(f, b) / max * 100).toFixed(1)}%"></span></td></tr>`).join("")}
</tbody></table></div>
<p class="small muted">Values per 100 g from USDA FoodData Central, SR Legacy. Cooked and raw foods are listed as USDA measured them; see <a href="/guides/per-100g-values/">how to read per-100 g values</a>.</p>
<h2>Other lists</h2><div class="pills">${BEST.filter((x) => x !== b).map((x) => `<a class="pill" href="/best/${x.slug}/">${x.title}</a>`).join("")}</div></div></main>`;
  add(path, layout({
    path, nav: "/best/", title: `${b.h1} (${foods.length} foods ranked) | ${NAME}`,
    description: `${b.h1}: ${sorted.slice(0, 3).map((f) => `${f.name.split(",")[0]} ${bestFmt(f, b)} ${u}`).join(", ")} and ${foods.length - 3} more, from USDA data.`,
    body, schemas: [c.schema, { "@context": "https://schema.org", "@type": "ItemList", name: b.h1, itemListOrder: b.asc ? "https://schema.org/ItemListOrderAscending" : "https://schema.org/ItemListOrderDescending", numberOfItems: sorted.length, itemListElement: sorted.map((f, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + f.url, name: f.name })) }],
  }));
}
{
  const c = crumbs([["/best/", "Top lists"]]);
  add("/best/", layout({ path: "/best/", nav: "/best/", title: `Top food lists: ranked by nutrient | ${NAME}`, description: "Every food on Plate Notes ranked by protein, fibre, iron, calcium, potassium, calories and protein per calorie.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>Top lists</h1><p class="lede">All ${foods.length} foods ranked by one nutrient at a time.</p></div></div><div class="wrap section"><div class="grid wide">${BEST.map((b, i) => { const s = [...foods].sort((x, y) => b.asc ? bestVal(x, b) - bestVal(y, b) : bestVal(y, b) - bestVal(x, b)).slice(0, 3); return `<a class="card" href="/best/${b.slug}/" style="--d:${i}"><div class="body"><h3>${b.h1}</h3><p>${b.why}</p><div class="meta">Top 3: ${s.map((f) => esc(f.name.split(",")[0])).join(", ")}</div></div></a>`; }).join("")}</div></div></main>`, schemas: [c.schema] }));
}

// ---------- Comparisons ----------
for (const [a, b] of PAIRS) {
  const A = bySlug[a], B = bySlug[b];
  const path = pairUrl(a, b);
  const c = crumbs([["/compare/", "Compare"], [path, `${A.name} vs ${B.name}`]]);
  const keys = Object.keys(LABELS);
  const rows = keys.map((k) => { const x = v(A, k), y = v(B, k); const better = k === "kcal" || k === "sodium" || k === "sugars" ? null : x > y ? "a" : y > x ? "b" : null; return `<tr><th scope="row">${LABELS[k]}</th><td class="num${better === "a" ? " win" : ""}">${fmtN(k, x)} ${UNITS[k]}</td><td class="num${better === "b" ? " win" : ""}">${fmtN(k, y)} ${UNITS[k]}</td><td class="num">${x === 0 && y === 0 ? "same" : y === 0 ? "—" : `${fmt(x / y, 1)}×`}</td></tr>`; }).join("");
  const more = (k) => v(A, k) > v(B, k) ? A : v(B, k) > v(A, k) ? B : null;
  const moreTxt = (k, what) => { const m = more(k); return m ? `${esc(m.name)} has more ${what}` : `both have the same ${what}`; };
  const ratio = (k) => { const hi = Math.max(v(A, k), v(B, k)), lo = Math.min(v(A, k), v(B, k)); return lo ? fmt(hi / lo, 1) : "far"; };
  const body = `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>${esc(A.name)} vs ${esc(B.name)}: nutrition per 100 g</h1><p class="lede">${moreTxt("protein", "protein")}; ${moreTxt("fiber", "fibre")}; ${moreTxt("kcal", "calories")}.</p></div></div>
<div class="wrap layout"><article class="prose">
<h2>The short answer</h2>
<ul><li><b>Protein:</b> ${more("protein") ? `${esc(more("protein").name)}, ${ratio("protein")}× as much` : "the same"} (${fmt(v(A, "protein"))} g vs ${fmt(v(B, "protein"))} g).</li>
<li><b>Fibre:</b> ${more("fiber") ? esc(more("fiber").name) : "the same"} (${fmt(v(A, "fiber"))} g vs ${fmt(v(B, "fiber"))} g).</li>
<li><b>Energy:</b> ${fmt(v(A, "kcal"), 0)} kcal vs ${fmt(v(B, "kcal"), 0)} kcal per 100 g.</li>
<li><b>Iron:</b> ${more("iron") ? esc(more("iron").name) : "the same"} (${fmt(v(A, "iron"))} mg vs ${fmt(v(B, "iron"))} mg).</li></ul>
<h2>Every nutrient, per 100 g</h2>
<div class="table-wrap"><table><thead><tr><th scope="col">Nutrient</th><th scope="col" class="num"><a href="${A.url}">${esc(A.name)}</a></th><th scope="col" class="num"><a href="${B.url}">${esc(B.name)}</a></th><th scope="col" class="num">Ratio</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="small muted">Green marks the higher value for nutrients where more is usually the point; energy, sugars and sodium are not marked. Data: USDA FDC ${A.fdcId} and ${B.fdcId}. Per 100 g is not per serving: see <a href="/guides/per-100g-values/">how to read per-100 g values</a>.</p>
<h2>Try another pair</h2>${compareTool(a, b)}
</article><aside><div class="sticky"><div class="grid" style="grid-template-columns:1fr">${foodCard(A)}${foodCard(B)}</div></div></aside></div></main>`;
  add(path, layout({
    path, nav: "/compare/", title: `${A.name} vs ${B.name}: protein, fibre and calories compared | ${NAME}`,
    description: `${A.name} vs ${B.name} per 100 g: ${fmt(v(A, "protein"))} g vs ${fmt(v(B, "protein"))} g protein, ${fmt(v(A, "fiber"))} g vs ${fmt(v(B, "fiber"))} g fibre, ${fmt(v(A, "kcal"), 0)} vs ${fmt(v(B, "kcal"), 0)} kcal.`,
    body, schemas: [c.schema, { "@context": "https://schema.org", "@type": "Article", headline: `${A.name} vs ${B.name}: nutrition per 100 g`, datePublished: TODAY, dateModified: TODAY, author: { "@type": "Organization", name: NAME, url: SITE + "/about/" }, mainEntityOfPage: SITE + path }],
  }));
}
{
  const c = crumbs([["/compare/", "Compare"]]);
  add("/compare/", layout({ path: "/compare/", nav: "/compare/", title: `Compare foods side by side: nutrition per 100 g | ${NAME}`, description: `Compare any two of ${foods.length} foods nutrient by nutrient, or open one of ${PAIRS.length} ready-made comparisons like eggs vs Greek yogurt and salmon vs tuna.`,
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>Compare two foods</h1><p class="lede">Pick any two foods to see every nutrient side by side.</p></div></div><div class="wrap section">${compareTool("salmon", "tuna")}<h2>Popular comparisons</h2><div class="grid wide">${PAIRS.map(([a, b], i) => `<a class="card" href="${pairUrl(a, b)}" style="--d:${i % 8}"><div class="body"><h3>${esc(bySlug[a].name)} vs ${esc(bySlug[b].name)}</h3><div class="meta"><span>Protein <b>${fmt(v(bySlug[a], "protein"))}</b> vs <b>${fmt(v(bySlug[b], "protein"))} g</b></span></div></div></a>`).join("")}</div></div></main>`, schemas: [c.schema] }));
}

// ---------- Recipes ----------
for (const r of RECIPES) {
  const c = crumbs([["/recipes/", "Recipes"], [r.url, r.name]]);
  const total = r.prep + r.cook;
  const ingr = [...r.items.map(([s, gr]) => ({ text: `${gr} g ${lower(bySlug[s].name)}`, html: `${gr} g <a href="${bySlug[s].url}">${esc(lower(bySlug[s].name))}</a>` })), ...r.extra.map((t) => ({ text: t, html: esc(t) }))];
  const n = r.nut;
  const body = `<main id="main"><div class="page-head"><div class="wrap">${c.html}<span class="badge" style="margin-top:18px">Serves ${r.serves}</span><h1 data-split>${esc(r.name)}</h1><p class="lede">${esc(r.desc)}</p>
<div class="kpis"><div class="kpi"><span>Energy</span><b>${fmt(n.kcal, 0)}</b><span>kcal per serving</span></div><div class="kpi"><span>Protein</span><b>${fmt(n.protein)} g</b><span>per serving</span></div><div class="kpi"><span>Prep</span><b>${r.prep} min</b><span>${r.rest ? esc(r.rest) : `cook ${r.cook} min`}</span></div><div class="kpi"><span>Fibre</span><b>${fmt(n.fiber)} g</b><span>per serving</span></div></div></div></div>
<div class="wrap layout"><article class="prose">
<figure class="figure">${img(r.slug, `${r.name}, served`, { sizes: "(max-width: 960px) 100vw, 720px" })}<figcaption>Illustrative photo, not this exact recipe. ${credit(r.slug)}</figcaption></figure>
<h2>Ingredients</h2><ul>${ingr.map((i) => `<li>${i.html}</li>`).join("")}</ul>
<h2>Method</h2><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
<div class="callout">Nutrition counts the linked ingredients at the weights listed, from their USDA records. Water, spices, lemon and added salt are not counted; added salt raises sodium.</div>
</article><aside><div class="sticky"><div class="label"><h2>Per serving</h2><div class="serving"><span>1 of ${r.serves}</span><span class="grams">${r.serves === 1 ? "whole recipe" : "portion"}</span></div>
<div class="row big"><span>Energy</span><b>${fmt(n.kcal, 0)} kcal</b></div><div class="row"><span>Total fat</span><b>${fmt(n.fat)} g</b></div><div class="row"><span>Carbohydrate</span><b>${fmt(n.carbs)} g</b></div><div class="row sub"><span>Fibre</span><b>${fmt(n.fiber)} g</b></div><div class="row sub"><span>Sugars</span><b>${fmt(n.sugars)} g</b></div><div class="row"><span>Protein</span><b>${fmt(n.protein)} g</b></div><div class="row"><span>Sodium</span><b>${fmt(n.sodium, 0)} mg</b></div><p class="src">Calculated from USDA FoodData Central records.</p></div></div></aside></div></main>`;
  add(r.url, layout({
    path: r.url, group: r.group, nav: "/recipes/", ogImage: r.slug,
    title: `${r.name} (${fmt(n.protein, 0)} g protein per serving) | ${NAME}`,
    description: `${r.desc} ${fmt(n.kcal, 0)} kcal and ${fmt(n.protein)} g protein per serving, from USDA data. Ready in ${total} minutes.`,
    body, schemas: [c.schema, {
      "@context": "https://schema.org", "@type": "Recipe", name: r.name, description: r.desc, image: [SITE + photos[r.slug].file],
      author: { "@type": "Organization", name: NAME, url: SITE + "/about/" }, datePublished: TODAY,
      prepTime: `PT${r.prep}M`, cookTime: `PT${r.cook}M`, totalTime: `PT${total}M`, recipeYield: `${r.serves}`,
      recipeCategory: r.slug.includes("oats") ? "Breakfast" : "Main course", recipeCuisine: "Home cooking",
      keywords: r.items.map(([s]) => bySlug[s].name).join(", "),
      recipeIngredient: ingr.map((i) => i.text), recipeInstructions: r.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
      nutrition: { "@type": "NutritionInformation", servingSize: "1 serving", calories: `${fmt(n.kcal, 0)} calories`, proteinContent: `${fmt(n.protein)} g`, fatContent: `${fmt(n.fat)} g`, carbohydrateContent: `${fmt(n.carbs)} g`, fiberContent: `${fmt(n.fiber)} g`, sugarContent: `${fmt(n.sugars)} g`, sodiumContent: `${fmt(n.sodium, 0)} mg` },
    }],
  }), "pages", [r.slug]);
}
{
  const c = crumbs([["/recipes/", "Recipes"]]);
  add("/recipes/", layout({ path: "/recipes/", nav: "/recipes/", title: `Recipes with nutrition per serving | ${NAME}`, description: "Simple recipes built only from foods on Plate Notes, each with calories, protein and fibre per serving from USDA data.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>Recipes</h1><p class="lede">Every ingredient that carries nutrition links to its USDA-sourced food page.</p></div></div><div class="wrap section"><div class="grid wide">${RECIPES.map((r, i) => `<a class="card g-${r.group}" href="${r.url}" style="--d:${i}">${img(r.slug, r.name, { sizes: "(max-width: 600px) 100vw, 33vw" })}<div class="body"><h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p><div class="meta"><span><b>${fmt(r.nut.kcal, 0)}</b> kcal</span><span><b>${fmt(r.nut.protein)} g</b> protein</span><span>Serves ${r.serves}</span></div></div></a>`).join("")}</div></div></main>`, schemas: [c.schema] }), "pages", RECIPES.map((r) => r.slug));
}

// ---------- Guides ----------
const guideList = [];
{
  const path = "/guides/per-100g-values/";
  const c = crumbs([["/guides/", "Guides"], [path, "Reading per-100 g values"]]);
  const oats = bySlug["rolled-oats"], rice = bySlug["brown-rice"];
  guideList.push({ path, title: "How to read per-100 g nutrition values", desc: "Dry versus cooked, raw versus boiled, and how to scale to your portion." });
  add(path, layout({ path, nav: "/guides/", title: `How to read per-100 g nutrition values (dry vs cooked) | ${NAME}`, description: "Why dry and cooked foods have very different per-100 g values, three checks before comparing foods, and how to scale values to your portion.",
    body: `<main id="main"><div class="page-head g-grains"><div class="wrap">${c.html}<h1 data-split>How to read per-100 g nutrition values</h1><p class="lede">A per-100 g number is only as useful as the record behind it. Dry or cooked, raw or boiled: the state of the food changes everything.</p></div></div>
<div class="wrap layout"><article class="prose">
<h2>One food, several records</h2><p>USDA FoodData Central keeps separate records for the same food in different states. Rolled oats on this site are measured dry: ${fmt(v(oats, "kcal"), 0)} kcal per 100 g. Brown rice is measured cooked: ${fmt(v(rice, "kcal"), 0)} kcal per 100 g. The gap is mostly water, not a difference between the grains.</p>
<h2>Three checks before comparing</h2><ol><li><b>State.</b> Is the record dry, raw, cooked, boiled or drained? Compare like with like.</li><li><b>Salt.</b> Cooked legume records here are “without salt”. Canned or salted versions carry more sodium.</li><li><b>Edible portion.</b> Values cover the part you eat: egg without shell, fish without bones (canned sardines are the exception: they include the soft bones).</li></ol>
<h2>From 100 g to your plate</h2><p>Multiply each value by your portion weight and divide by 100. A 40 g serving of dry oats holds 40 ÷ 100 = 0.4 times the amounts listed. The <a href="/tools/portion-calculator/">portion calculator</a> does this for you, and every food page has a slider on its nutrition label.</p>
<h2>Where the numbers come from</h2><p>Every food page shows its FoodData Central record number in the source box. Follow it to see the full USDA record, including nutrients not listed here.</p>
<p class="small muted">General information, not medical or dietary advice.</p></article><aside><div class="sticky">${foodCard(oats)}</div></aside></div></main>`,
    schemas: [c.schema, { "@context": "https://schema.org", "@type": "Article", headline: "How to read per-100 g nutrition values", datePublished: TODAY, dateModified: TODAY, author: { "@type": "Organization", name: NAME, url: SITE + "/about/" }, mainEntityOfPage: SITE + path }] }));
}
{
  const path = "/guides/plant-protein/";
  const c = crumbs([["/guides/", "Guides"], [path, "Plant protein"]]);
  const plants = foods.filter((f) => ["legumes", "nuts-seeds", "grains"].includes(f.group)).sort((a, b) => v(b, "protein") - v(a, "protein"));
  const max = v(plants[0], "protein");
  guideList.push({ path, title: "Plant protein: legumes, nuts, seeds and grains compared", desc: `${plants.length} plant foods ranked by protein, with the catch for each group.` });
  add(path, layout({ path, nav: "/guides/", title: `Plant protein sources compared per 100 g | ${NAME}`, description: `${plants.length} plant foods ranked by protein per 100 g: ${plants.slice(0, 3).map((f) => f.name.split(",")[0]).join(", ")} lead. Why per-100 g and per-calorie views disagree.`,
    body: `<main id="main"><div class="page-head g-legumes"><div class="wrap">${c.html}<h1 data-split>Plant protein: what 100 g really gives you</h1><p class="lede">Seeds and nuts top the per-100 g table, but most of their energy is fat. Cooked legumes give less protein per 100 g but far more per calorie.</p></div></div>
<div class="wrap layout"><article class="prose">
<h2>Protein per 100 g</h2><ul class="bars">${plants.map((f, i) => `<li class="g-${f.group}" style="--n:${i}"><a href="${f.url}">${esc(f.name)}</a><span class="track"><span class="bar" style="width:${(v(f, "protein") / max * 100).toFixed(1)}%"></span></span><span class="val">${fmt(v(f, "protein"))} g</span></li>`).join("")}</ul>
<h2>The catch for each group</h2><ul><li><b>Nuts and seeds</b> are dry and fatty, so they lead per 100 g but lag per calorie. See <a href="/best/protein-per-calorie/">protein per calorie</a>.</li><li><b>Legumes</b> are measured cooked here, so water lowers their per-100 g figure. Per calorie they beat every grain.</li><li><b>Grains</b> are mostly starch. Oats are measured dry, which is why they look stronger than cooked grains.</li></ul>
<p>Compare two directly: <a href="${pairUrl("lentils", "chickpeas")}">lentils vs chickpeas</a>, <a href="${pairUrl("peanuts", "almonds")}">peanuts vs almonds</a>, <a href="${pairUrl("quinoa", "brown-rice")}">quinoa vs brown rice</a>.</p>
<p class="small muted">General information, not medical or dietary advice.</p></article><aside><div class="sticky">${foodCard(plants[0])}</div></aside></div></main>`,
    schemas: [c.schema, { "@context": "https://schema.org", "@type": "Article", headline: "Plant protein: what 100 g really gives you", datePublished: TODAY, dateModified: TODAY, author: { "@type": "Organization", name: NAME, url: SITE + "/about/" }, mainEntityOfPage: SITE + path }] }));
}
{
  const c = crumbs([["/guides/", "Guides"]]);
  add("/guides/", layout({ path: "/guides/", nav: "/guides/", title: `Nutrition guides | ${NAME}`, description: "Short guides on reading nutrition values and comparing foods fairly, using USDA FoodData Central data.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>Guides</h1><p class="lede">Short, sourced explainers.</p></div></div><div class="wrap section"><div class="grid wide">${guideList.map((g, i) => `<a class="card" href="${g.path}" style="--d:${i}"><div class="body"><h3>${esc(g.title)}</h3><p>${esc(g.desc)}</p></div></a>`).join("")}<a class="card" href="/best/protein-per-calorie/"><div class="body"><h3>Protein per calorie, ranked</h3><p>Every food by grams of protein per 100 kcal.</p></div></a></div></div></main>`, schemas: [c.schema] }));
}

// ---------- Tools, search, about, credits, privacy, HTML sitemap ----------
{
  const path = "/tools/portion-calculator/";
  const c = crumbs([[path, "Portion calculator"]]);
  const td = foods.map((f) => ({ s: f.slug, n: f.name, u: f.url, fdc: f.fdcId, v: Object.fromEntries(Object.keys(LABELS).map((k) => [k, v(f, k)])) }));
  add(path, layout({ path, title: `Portion nutrition calculator: protein and calories by weight | ${NAME}`, description: `Scale USDA per-100 g values to any portion: pick one of ${foods.length} foods, enter grams, and see energy, protein, fibre, fat and minerals.`,
    body: `<main id="main"><div class="page-head g-dairy-eggs"><div class="wrap">${c.html}<h1 data-split>Portion calculator</h1><p class="lede">Pick a food, type the weight on your plate, and see what that portion holds.</p></div></div>
<div class="wrap section" style="max-width:820px"><form class="tool" id="calc" novalidate><div class="row"><label>Food<select id="food">${foods.map((f) => `<option value="${f.slug}">${esc(f.name)}</option>`).join("")}</select></label><label>Weight in grams<input id="grams" type="number" inputmode="decimal" min="1" max="2000" step="1" value="100" required></label></div><p class="err" id="err" role="alert"></p><output id="out" for="food grams" aria-live="polite"></output></form>
<noscript><p>The calculator needs JavaScript. Every food page lists per-100 g values; multiply by your weight and divide by 100.</p></noscript></div></main>
<script type="application/json" id="calc-data">${JSON.stringify({ foods: td, labels: LABELS, units: UNITS })}</script>`,
    schemas: [c.schema, { "@context": "https://schema.org", "@type": "WebApplication", name: "Portion calculator", applicationCategory: "HealthApplication", operatingSystem: "Any", url: SITE + path, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }] }));
}
add("/search/", layout({ path: "/search/", robots: "noindex, follow", title: `Search | ${NAME}`, description: "Search Plate Notes.",
  body: `<main id="main"><div class="page-head"><div class="wrap"><h1>Search</h1><p class="lede">Internal search results pages are kept out of Google with noindex, a standard SEO practice.</p></div></div><div class="wrap section" style="max-width:760px"><div class="hero-search" data-hero-search data-page-search>${ICON.search}<input type="search" placeholder="Search foods, lists, comparisons" aria-label="Search" autocomplete="off"><ul class="search-results" role="listbox"></ul></div></div></main>` }), false);
{
  const c = crumbs([["/about/", "About"]]);
  add("/about/", layout({ path: "/about/", title: `About ${NAME}`, description: "What Plate Notes is, where its numbers come from, and why it has a section of pages broken on purpose.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>About ${NAME}</h1></div></div><div class="wrap layout"><article class="prose">
<p>${NAME} is a small, non-commercial nutrition reference. It shows what 100 grams of ${foods.length} everyday foods holds, ranks them nutrient by nutrient, compares them in pairs, and builds a few simple recipes from them.</p>
<h2>Where the numbers come from</h2><p>All nutrient values come from <a href="https://fdc.nal.usda.gov/">USDA FoodData Central</a>, SR Legacy dataset, which is in the public domain. Each food page names its record number. Nothing is estimated except recipe totals, energy shares and protein per 100 kcal, which are calculated from those records.</p>
<h2>The SEO lab</h2><p>The site doubles as a practice ground for Google Search Console. The <a href="/lab/">SEO lab</a> holds pages that are broken on purpose; each says so at the top and explains which Search Console status it should produce.</p>
<h2>What this site is not</h2><p>It is not a clinic, a dietitian or a business, and it gives no medical or dietary advice. It has no ads, no affiliate links and no reviews.</p></article><aside></aside></div></main>`,
    schemas: [c.schema, { "@context": "https://schema.org", "@type": "AboutPage", name: `About ${NAME}`, url: SITE + "/about/" }] }));
}
{
  const c = crumbs([["/credits/", "Photo credits"]]);
  add("/credits/", layout({ path: "/credits/", title: `Photo credits | ${NAME}`, description: "Sources and licences for every photo on Plate Notes, all from Wikimedia Commons.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>Photo credits</h1><p class="lede">Every photo comes from Wikimedia Commons under the licence shown. Photos were resized and converted to WebP.</p></div></div><div class="wrap section"><div class="table-wrap"><table><thead><tr><th scope="col">Photo</th><th scope="col">Used for</th><th scope="col">Author</th><th scope="col">Licence</th></tr></thead><tbody>${Object.entries(photos).map(([k, p]) => `<tr><th scope="row"><a href="${p.source}">${esc(p.title)}</a></th><td>${esc(GROUPS[k]?.name || RECIPES.find((r) => r.slug === k)?.name || "Home page")}</td><td>${esc(p.author)}</td><td>${p.licenseUrl ? `<a href="${p.licenseUrl}">${esc(p.license)}</a>` : esc(p.license)}</td></tr>`).join("")}</tbody></table></div></div></main>`, schemas: [c.schema] }));
}
{
  const c = crumbs([["/privacy/", "Privacy"]]);
  add("/privacy/", layout({ path: "/privacy/", title: `Privacy | ${NAME}`, description: "What Plate Notes collects: nothing beyond standard hosting logs, plus Google Analytics if it is switched on.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1>Privacy</h1></div></div><div class="wrap layout"><article class="prose"><p>${NAME} has no accounts, no forms that send data, and no cookies of its own. The site is hosted on GitHub Pages, which keeps standard server logs.</p><p>${config.ga4Id ? "This site uses Google Analytics 4 to count visits. Google Analytics sets cookies and processes usage data as described in Google's privacy policy." : "Analytics is not switched on. If Google Analytics 4 is added later, this page will say so."}</p><p>Search and the calculators run entirely in your browser; nothing you type is sent anywhere.</p></article><aside></aside></div></main>`, schemas: [c.schema] }));
}

// ---------- SEO lab ----------
const LAB = [
  { path: "/lab/noindex/", title: "Page with a noindex tag", fault: "excluded", expect: "Page indexing: Excluded by ‘noindex’ tag", why: "Has a robots meta noindex tag but is listed in the sitemap, so Google sees a submitted page it may not index." },
  { path: "/lab/blocked-by-robots/", title: "Page blocked by robots.txt", fault: "error", expect: "Page indexing: Blocked by robots.txt (or Indexed, though blocked by robots.txt)", why: "robots.txt disallows this path while the sitemap submits it." },
  { path: "/lab/broken-link/", title: "Page with a broken internal link", fault: "error", expect: "Page indexing: Not found (404) for /lab/this-page-does-not-exist/", why: "Links to a URL with no file. GitHub Pages answers with the custom 404 page and a real 404 status." },
  { path: "/lab/old-address/", title: "Redirected page", fault: "excluded", expect: "Page indexing: Page with redirect", why: "An instant meta refresh sends visitors to /lab/new-address/. GitHub Pages cannot send a server 301; Google treats an instant meta refresh as a permanent redirect." },
  { path: "/lab/chain-start/", title: "Redirect chain", fault: "excluded", expect: "Page indexing: Page with redirect (two hops)", why: "Two meta-refresh hops in a row. Crawlers like Screaming Frog flag this as a redirect chain." },
  { path: "/lab/duplicate-a/", title: "Duplicate page A", fault: "excluded", expect: "Page indexing: Duplicate without user-selected canonical (on A or B)", why: "Same text as /lab/duplicate-b/, and neither page declares a canonical." },
  { path: "/lab/alternate/", title: "Alternate with canonical", fault: "excluded", expect: "Page indexing: Alternate page with proper canonical tag", why: "Its canonical tag points to /lab/canonical-target/, which holds the same text." },
  { path: "/lab/canonical-mismatch/", title: "Canonical pointing to an unrelated page", fault: "excluded", expect: "URL Inspection: user-declared canonical differs from Google-selected canonical", why: "Declares the home page as canonical though its content is unrelated, so Google may ignore the hint." },
  { path: "/lab/soft-404/", title: "Soft 404", fault: "error", expect: "Page indexing: Soft 404", why: "Says the item was not found but returns status 200 with almost no content." },
  { path: "/lab/thin-content/", title: "Thin page", fault: "excluded", expect: "Page indexing: Crawled, currently not indexed (likely)", why: "A real but nearly empty page. Google often crawls such pages and declines to index them." },
  { path: "/lab/orphan/", title: "Orphan page", fault: "excluded", expect: "Page indexing: Discovered, currently not indexed (likely)", why: "No page links here; only the sitemap lists it. Screaming Frog finds it only in sitemap crawl mode." },
  { path: "/lab/not-in-sitemap/", title: "Page missing from the sitemap", fault: "excluded", expect: "URL Inspection: discovered via links, no referring sitemap", why: "Linked from the lab but deliberately left out of the sitemaps." },
  { path: "/lab/broken-recipe-schema/", title: "Recipe with invalid structured data", fault: "error", expect: "Enhancements, Recipes: invalid item (missing image)", why: "Its Recipe JSON-LD leaves out the required image property." },
  { path: "/lab/javascript-content/", title: "Content added by JavaScript", fault: "ok", expect: "URL Inspection: the text appears only in the rendered HTML", why: "The main paragraph is written by a script, so raw and rendered HTML differ." },
  { path: "/lab/missing-title/", title: "Page without a title", fault: "error", expect: "Crawlers flag a missing title and description; Google writes its own title link", why: "Has no title element and no meta description." },
  { path: "/lab/slow-page/", title: "Slow, heavy page", fault: "excluded", expect: "PageSpeed Insights: poor LCP and CLS in the lab test", why: "Loads an oversized image without dimensions and shifts the layout after load." },
  { path: "/lab/sitemap-with-errors.xml", title: "Sitemap with errors", fault: "error", expect: "Sitemaps: Has errors (submit it by hand)", why: "A sitemap with a bad date and a URL on another host." },
];
const FAULT = { ok: "Valid, worth inspecting", excluded: "Excluded", error: "Error" };
{
  const c = crumbs([["/lab/", "SEO lab"]]);
  add("/lab/", layout({ path: "/lab/", nav: "/lab/", title: `SEO lab: pages broken on purpose for Search Console practice | ${NAME}`, description: `${LAB.length} deliberately broken test pages, each with the Google Search Console status it should produce: noindex, robots.txt, 404, redirects, canonicals, soft 404 and more.`,
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1 data-split>SEO lab: pages broken on purpose</h1><p class="lede">Each page below triggers a different Search Console status. Verify the site, submit the sitemap, wait, then find each one in the reports.</p></div></div>
<div class="wrap layout"><article class="prose">
<h2 id="how">How to practise</h2><ol><li>Add <code>${SITE}/</code> as a URL-prefix property in Google Search Console and verify it.</li><li>Submit <code>sitemap.xml</code> under Sitemaps. It is a sitemap index that points to three child sitemaps.</li><li>Run URL Inspection on a few lab URLs: “Test live URL”, then “View tested page”.</li><li>Wait one to four weeks. Open Indexing, Pages and match each reason to the list below.</li><li>Fix one fault, push the change, and click “Validate fix”.</li></ol>
<h2>The test pages</h2><ul class="lab-list">${LAB.map((l, i) => `<li style="--d:${i % 8}"><h3><a href="${l.path}">${esc(l.title)}</a><span class="fault ${l.fault}">${FAULT[l.fault]}</span></h3><p class="expect">Expect: ${esc(l.expect)}</p><p>${esc(l.why)}</p></li>`).join("")}</ul>
<h2>Also on this site to practise with</h2><ul><li>A <b>sitemap index</b> with child sitemaps and image entries: <a href="/sitemap.xml">sitemap.xml</a>.</li><li><b>Paginated</b> lists with rel prev/next: <a href="/foods/page/2/">/foods/page/2/</a>.</li><li>A <b>noindex internal search</b> page: <a href="/search/">/search/</a>.</li><li><b>Structured data</b>: Recipe, Article, BreadcrumbList, ItemList, CollectionPage, WebSite with SearchAction, Organization.</li><li>A real <b>404</b>: <a href="/lab/this-page-does-not-exist/">missing URL</a>.</li></ul>
</article><aside><div class="sticky"><div class="label"><h2>Lab at a glance</h2><div class="serving"><span>Test pages</span><span class="grams">${LAB.length}</span></div>${Object.entries(FAULT).map(([k, l]) => `<div class="row"><span>${l}</span><b>${LAB.filter((x) => x.fault === k).length}</b></div>`).join("")}<p class="src">Google decides the final status, and timing varies.</p></div></div></aside></div></main>`, schemas: [c.schema] }), "lab");
}
const labPage = (path, title, what, body, opts = {}) => add(path, layout({
  path, nav: "/lab/", title: title ? `Lab: ${title}` : "", description: opts.description ?? `SEO lab test page: ${what}`,
  body: `<main id="main"><div class="lab-banner"><div class="wrap">Broken on purpose for Search Console practice: ${what} <a href="/lab/">Back to the lab</a>.</div></div><div class="page-head"><div class="wrap"><h1>${esc(opts.h1 || `Lab: ${title}`)}</h1></div></div><div class="wrap layout"><article class="prose">${body}</article><aside></aside></div></main>`, ...opts,
}), opts.sitemap === false ? false : "lab");

labPage("/lab/noindex/", "page with a noindex tag", "it carries a noindex robots meta tag.", `<p>This page tells search engines not to index it. Because the sitemap still lists it, Search Console reports it as excluded by the noindex tag.</p><p>To practise a fix, remove the tag, push the change and use “Validate fix”.</p>`, { robots: "noindex" });
labPage("/lab/blocked-by-robots/", "page blocked by robots.txt", "robots.txt disallows this path.", `<p>Googlebot is told not to crawl this URL, so it cannot read anything here, including any noindex tag. Open <a href="/robots.txt">robots.txt</a> to see the rule.</p>`);
labPage("/lab/broken-link/", "page with a broken internal link", "it links to a page that does not exist.", `<p>This <a href="/lab/this-page-does-not-exist/">link goes nowhere</a>. Google follows it, gets a 404, and reports the missing URL.</p>`);
labPage("/lab/old-address/", "redirected page", "it redirects instantly with a meta refresh.", `<p>If you can read this, your browser did not follow the redirect. Go to the <a href="/lab/new-address/">new address</a>.</p>`, { headExtra: `<meta http-equiv="refresh" content="0; url=/lab/new-address/">`, canonical: "/lab/new-address/" });
labPage("/lab/chain-start/", "redirect chain", "it starts a two-hop redirect chain.", `<p>Go to the <a href="/lab/chain-middle/">next hop</a>.</p>`, { headExtra: `<meta http-equiv="refresh" content="0; url=/lab/chain-middle/">` });
labPage("/lab/chain-middle/", "redirect chain, middle hop", "it is the middle hop of a redirect chain.", `<p>Go to the <a href="/lab/new-address/">final address</a>.</p>`, { headExtra: `<meta http-equiv="refresh" content="0; url=/lab/new-address/">`, sitemap: false });
labPage("/lab/new-address/", "redirect target", "nothing; this is the healthy target of the redirects.", `<p>This is where /lab/old-address/ and the redirect chain end. It should be indexed normally.</p>`);
const dupText = `<p>Lentils cook from dry in about twenty minutes without soaking. Red lentils break down into a soft purée; green and brown lentils keep their shape and suit salads.</p><p>This paragraph appears on two lab pages on purpose, so that Google has to choose one of them as canonical.</p>`;
labPage("/lab/duplicate-a/", "duplicate page", "its content is identical to another page and it declares no canonical.", dupText, { canonical: null, description: "Lentils cook from dry in about twenty minutes without soaking.", h1: "Lab: duplicate page" });
labPage("/lab/duplicate-b/", "duplicate page", "its content is identical to another page and it declares no canonical.", dupText, { canonical: null, description: "Lentils cook from dry in about twenty minutes without soaking.", h1: "Lab: duplicate page" });
const canonText = `<p>Rolled oats are measured dry in USDA data. A 40 g serving of dry oats is a common breakfast portion.</p>`;
labPage("/lab/alternate/", "oats serving note", "its canonical tag points to another page with the same text.", canonText, { canonical: "/lab/canonical-target/" });
labPage("/lab/canonical-target/", "oats serving note", "nothing; this page is the declared canonical.", canonText);
labPage("/lab/canonical-mismatch/", "canonical pointing to an unrelated page", "its canonical points to the home page, which has different content.", `<p>Salmon bakes at 200 °C in about 12 to 15 minutes. This text has nothing to do with the home page, yet this page names the home page as its canonical.</p>`, { canonical: "/" });
labPage("/lab/soft-404/", "Item not found", "it says “not found” but returns status 200.", `<p>Sorry, that item could not be found.</p>`, { h1: "Item not found", title: "Item not found" });
labPage("/lab/thin-content/", "thin page", "it has almost no content.", `<p>Oats.</p>`);
labPage("/lab/orphan/", "orphan page", "no page links here; only the sitemap lists it.", `<p>You found the orphan. In a crawler, this page appears only when you also crawl the sitemap.</p>`);
labPage("/lab/not-in-sitemap/", "page missing from the sitemap", "it is linked but left out of the sitemaps.", `<p>Google can still find this page through the link on the lab index. URL Inspection will show no referring sitemap for it.</p>`, { sitemap: false });
labPage("/lab/broken-recipe-schema/", "recipe with invalid structured data", "its Recipe structured data is missing the required image.", `<p>Test this URL in the <a href="https://search.google.com/test/rich-results">Rich Results Test</a> to see the error, then compare it with a <a href="/recipes/lentil-spinach-soup/">valid recipe page</a>.</p><h2>Lentils on toast</h2><ol><li>Warm 150 g cooked lentils with a pinch of cumin.</li><li>Spoon onto toasted bread.</li></ol>`, {
  schemas: [{ "@context": "https://schema.org", "@type": "Recipe", name: "Lentils on toast", recipeIngredient: ["150 g cooked lentils", "1 slice bread", "Pinch of cumin"], recipeInstructions: [{ "@type": "HowToStep", text: "Warm the lentils with cumin." }, { "@type": "HowToStep", text: "Spoon onto toasted bread." }] }] });
labPage("/lab/javascript-content/", "content added by JavaScript", "its main text is written by JavaScript after the page loads.", `<p id="js-target">If you see only this sentence, JavaScript did not run.</p><script>document.getElementById("js-target").textContent="This sentence was written by JavaScript. In URL Inspection, compare the crawled HTML with the rendered HTML to see the difference.";</script>`);
labPage("/lab/missing-title/", "", "it has no title tag and no meta description.", `<p>Look at the browser tab: there is no title. Crawlers report both missing elements.</p>`, { noTitle: true, noDescription: true, h1: "Lab: page without a title" });
labPage("/lab/slow-page/", "slow, heavy page", "it loads an oversized image without dimensions and shifts the layout.", `<p>Run this URL through <a href="https://pagespeed.web.dev/">PageSpeed Insights</a> and compare it with any food page.</p><div id="shift"></div><img src="/img/fruit.webp" alt="Fruit platter loaded at full size without width and height" style="width:100%"><p>The block above this image is injected after one second, pushing content down: a cumulative layout shift.</p><script>setTimeout(function(){var d=document.getElementById("shift");d.style.height="220px";d.style.background="#e8f36a";d.textContent="Late banner that moves the page";},1000);</script>`);

// ---------- HTML sitemap ----------
{
  const c = crumbs([["/sitemap/", "Sitemap"]]);
  const sec = (title, list) => `<h2>${title}</h2><ul>${list.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ul>`;
  add("/sitemap/", layout({ path: "/sitemap/", title: `Sitemap | ${NAME}`, description: "Every page on Plate Notes in one list: foods, groups, lists, comparisons, recipes, guides and the SEO lab.",
    body: `<main id="main"><div class="page-head"><div class="wrap">${c.html}<h1>Sitemap</h1><p class="lede">An HTML sitemap for people. Search engines use <a href="/sitemap.xml">sitemap.xml</a>.</p></div></div><div class="wrap layout"><article class="prose">
${sec("Food groups", Object.entries(GROUPS).map(([g, m]) => [`/groups/${g}/`, m.name]))}${sec("Foods", [...foods].sort((a, b) => a.name.localeCompare(b.name)).map((f) => [f.url, f.name]))}${sec("Top lists", BEST.map((b) => [`/best/${b.slug}/`, b.h1]))}${sec("Comparisons", PAIRS.map(([a, b]) => [pairUrl(a, b), `${bySlug[a].name} vs ${bySlug[b].name}`]))}${sec("Recipes", RECIPES.map((r) => [r.url, r.name]))}${sec("Guides and tools", [...guideList.map((g) => [g.path, g.title]), ["/tools/portion-calculator/", "Portion calculator"]])}${sec("Site", [["/about/", "About"], ["/credits/", "Photo credits"], ["/privacy/", "Privacy"], ["/lab/", "SEO lab"]])}
</article><aside></aside></div></main>`, schemas: [c.schema] }));
}

// ---------- 404 ----------
const notFound = layout({ path: "/404.html", title: `Page not found | ${NAME}`, description: "This page does not exist.", canonical: null, robots: "noindex",
  body: `<main id="main"><div class="page-head"><div class="wrap"><h1>Page not found</h1><p class="lede">There is nothing at this address. It returns a real 404 status, which is what Google should see for a missing page.</p></div></div><div class="wrap section"><p><a class="btn" href="/">Go to the home page</a> <a class="btn ghost" href="/foods/">Browse all foods</a></p></div></main>` });

// ---------- Search index ----------
const searchIndex = [
  ...foods.map((f) => ({ t: f.name, u: f.url, k: "Food", x: `${GROUPS[f.group].name} ${f.description}` })),
  ...Object.entries(GROUPS).map(([g, m]) => ({ t: m.name, u: `/groups/${g}/`, k: "Group", x: m.blurb })),
  ...BEST.map((b) => ({ t: b.h1, u: `/best/${b.slug}/`, k: "List", x: b.title })),
  ...PAIRS.map(([a, b]) => ({ t: `${bySlug[a].name} vs ${bySlug[b].name}`, u: pairUrl(a, b), k: "Compare", x: "versus comparison" })),
  ...RECIPES.map((r) => ({ t: r.name, u: r.url, k: "Recipe", x: r.desc })),
  ...guideList.map((g) => ({ t: g.title, u: g.path, k: "Guide", x: g.desc })),
  { t: "Portion calculator", u: "/tools/portion-calculator/", k: "Tool", x: "grams serving calculator" },
  { t: "SEO lab", u: "/lab/", k: "Lab", x: "search console noindex canonical 404" },
];

// ---------- Write ----------
const OUT = ["index.html", "foods", "groups", "best", "compare", "recipes", "guides", "tools", "search", "lab", "about", "credits", "privacy", "sitemap", "assets", "fonts", "img", "404.html", "robots.txt", "sitemap.xml", "sitemaps", "favicon.svg", "site.webmanifest", ".nojekyll"];
for (const k of OUT) await rm(k, { recursive: true, force: true });
await cp("static", ".", { recursive: true });
for (const p of pages) {
  const file = p.path.endsWith("/") ? join("." + p.path, "index.html") : "." + p.path;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, p.html);
}
await writeFile("assets/search.json", JSON.stringify(searchIndex));
await writeFile("404.html", notFound);
await writeFile(".nojekyll", "");
await writeFile("site.webmanifest", JSON.stringify({ name: NAME, short_name: NAME, start_url: "/", display: "standalone", background_color: "#ffffff", theme_color: "#1f6f43", icons: [{ src: "/assets/logo.png", sizes: "512x512", type: "image/png" }] }, null, 2));
await writeFile("robots.txt", `User-agent: *\nDisallow: /lab/blocked-by-robots/\n\nSitemap: ${SITE}/sitemap.xml\n`);
const urlset = (list) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${list.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${TODAY}</lastmod>${p.images.map((k) => `<image:image><image:loc>${SITE}${photos[k].file}</image:loc></image:image>`).join("")}</url>`).join("\n")}\n</urlset>\n`;
await mkdir("sitemaps", { recursive: true });
const groupsOut = { pages: pages.filter((p) => p.sitemap === "pages"), foods: pages.filter((p) => p.sitemap === "foods"), lab: pages.filter((p) => p.sitemap === "lab") };
for (const [name, list] of Object.entries(groupsOut)) await writeFile(`sitemaps/${name}.xml`, urlset(list));
await writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(groupsOut).map((n) => `  <sitemap><loc>${SITE}/sitemaps/${n}.xml</loc><lastmod>${TODAY}</lastmod></sitemap>`).join("\n")}\n</sitemapindex>\n`);
await writeFile("lab/sitemap-with-errors.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/lab/noindex/</loc><lastmod>last tuesday</lastmod></url>\n  <url><loc>https://example.com/not-this-site/</loc></url>\n  <url><loc>${SITE}/lab/this-page-does-not-exist/</loc></url>\n</urlset>\n`);
console.log(`built ${pages.length} pages; sitemaps: ${Object.entries(groupsOut).map(([n, l]) => `${n} ${l.length}`).join(", ")}`);
