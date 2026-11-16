// Builds the Plate Notes site into the repository root (GitHub Pages serves main /).
// Run: node build.mjs
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const config = JSON.parse(await readFile("config.json", "utf8"));
const data = JSON.parse(await readFile("data/foods.json", "utf8"));
const SITE = config.siteUrl.replace(/\/$/, "");
const TODAY = config.updated;
const NAME = "Plate Notes";

const GROUPS = {
  grains: { name: "Grains", blurb: "Oats and rice, the everyday starches." },
  legumes: { name: "Legumes", blurb: "Lentils and chickpeas: protein and fibre together." },
  "dairy-eggs": { name: "Eggs & dairy", blurb: "Eggs and strained yogurt." },
  vegetables: { name: "Vegetables", blurb: "Leafy and green, low in energy." },
  fish: { name: "Fish", blurb: "Oily fish, high in protein and fat." },
  "nuts-seeds": { name: "Nuts & seeds", blurb: "Energy-dense, mostly fat." },
};

const LABELS = {
  kcal: "Energy", protein: "Protein", fat: "Total fat", carbs: "Carbohydrate", fiber: "Fibre",
  sugars: "Sugars", calcium: "Calcium", iron: "Iron", potassium: "Potassium", sodium: "Sodium",
};

const NOTES = {
  "rolled-oats": "These values are for dry oats. Cooking with water adds weight, so 100 g of cooked porridge holds far less of everything than 100 g of dry oats.",
  "brown-rice": "These values are for cooked rice, which is mostly water by weight. Dry rice is a separate USDA record with much higher numbers per 100 g.",
  lentils: "These values are for lentils boiled without salt. Lentils cook from dry without soaking, which makes them one of the quickest legumes to prepare.",
  chickpeas: "These values are for chickpeas cooked from dry without salt. Canned chickpeas usually contain added salt, so their sodium figure will be higher.",
  eggs: "These values are for raw whole egg without the shell. USDA counts one large egg as about 50 g, so one egg is roughly half of the amounts below.",
  "greek-yogurt": "These values are for plain, nonfat Greek yogurt. Flavoured versions add sugar, and full-fat versions add fat and energy.",
  spinach: "These values are for raw leaves. Cooked spinach is a separate USDA record, so use the record that matches how you eat it.",
  broccoli: "These values are for raw broccoli. Boiled and frozen broccoli have their own USDA records with slightly different numbers.",
  salmon: "These values are for raw farmed Atlantic salmon. Wild salmon is a separate record and is usually leaner.",
  almonds: "These values are for plain almonds. Most of their energy comes from fat, which is why a small handful (about 28 g) already carries a lot of calories.",
};

const foods = data.foods.map((f) => ({ ...f, url: `/foods/${f.slug}/` }));
const v = (f, k) => f.n[k].value;
const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });
const per100kcal = (f) => (v(f, "protein") / v(f, "kcal")) * 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rank = (f, key) => [...foods].sort((a, b) => v(b, key) - v(a, key)).findIndex((x) => x.slug === f.slug) + 1;
const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

const NAV = [
  ["/foods/", "Foods"], ["/recipes/", "Recipes"], ["/guides/", "Guides"],
  ["/tools/portion-calculator/", "Portion calculator"], ["/lab/", "SEO lab"], ["/about/", "About"],
];

const pages = []; // { path, html, sitemap: bool }

function ld(obj) { return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`; }

function breadcrumbs(trail) {
  const items = [["/", "Home"], ...trail];
  return {
    html: `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([href, label], i) =>
      i === items.length - 1 ? `<li><span aria-current="page">${esc(label)}</span></li>` : `<li><a href="${href}">${esc(label)}</a></li>`).join("")}</ol></nav>`,
    schema: { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([href, label], i) => ({ "@type": "ListItem", position: i + 1, name: label, item: SITE + href })) },
  };
}

function layout({ path, title, description, body, group = "neutral", schemas = [], robots, canonical, headExtra = "", noTitle = false, noDescription = false, navCurrent }) {
  const canon = canonical === null ? "" : `<link rel="canonical" href="${SITE}${canonical || path}">`;
  const verify = config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : "";
  const ga = config.ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(config.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${esc(config.ga4Id)}");</script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noTitle ? "" : `<title>${esc(title)}</title>`}
${noDescription ? "" : `<meta name="description" content="${esc(description)}">`}
${robots ? `<meta name="robots" content="${robots}">` : ""}
${canon}
${verify}
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(title || NAME)}">
${noDescription ? "" : `<meta property="og:description" content="${esc(description)}">`}
<meta property="og:url" content="${SITE}${path}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#16140f">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
${headExtra}
${ga}
${schemas.map(ld).join("\n")}
</head>
<body class="g-${group}">
<a class="skip" href="#main">Skip to content</a>
<div class="stripe" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
<header class="top">
<a class="brand" href="/">${NAME}</a>
<nav aria-label="Main"><ul>${NAV.map(([href, label]) => `<li><a href="${href}"${navCurrent === href ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul></nav>
</header>
${body.replace(/(<div class="field[^>]*>(?:<p class="group">[^<]*<\/p>)?)<h1>/, "$1<h1 data-split>")}
<footer>
<p>${NAME}: per-100 g food facts from USDA FoodData Central, and a lab for learning Google Search Console. General information, not medical advice.</p>
<ul><li><a href="/about/">About</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/lab/">SEO lab</a></li><li><a href="/sitemap.xml">Sitemap</a></li></ul>
</footer>
</body>
</html>
`;
}

function add(path, html, sitemap = true) { pages.push({ path, html, sitemap }); }

// ---------- Home ----------
{
  const chart = Object.entries(GROUPS).map(([g, meta]) => {
    const list = foods.filter((f) => f.group === g);
    return `<section class="g-${g}" aria-labelledby="h-${g}"><h2 id="h-${g}">${meta.name}</h2><ul>${list.map((f) =>
      `<li data-food="${f.slug}" data-protein="${v(f, "protein")}" data-fiber="${v(f, "fiber")}" data-kcal="${v(f, "kcal")}" data-iron="${v(f, "iron")}"><a href="${f.url}">${esc(f.name)}</a><span class="per">${fmt(v(f, "protein"))} g</span></li>`).join("")}</ul><p class="more">${meta.blurb}</p></section>`;
  }).join("") + `<section class="g-lab" aria-labelledby="h-lab"><h2 id="h-lab">SEO lab</h2><ul><li><a href="/lab/">Pages broken on purpose</a><span class="per">16</span></li><li><a href="/lab/#how">How to practise</a><span class="per">guide</span></li></ul><p class="more">Each lab page shows a different Search Console status.</p></section>`;
  const body = `<main id="main">
<div class="chart-head"><h1 data-split>${NAME}</h1><p>What 100 grams of ten everyday foods holds, straight from USDA FoodData Central, with simple recipes built from them.</p></div>
<div class="ticker" aria-hidden="true"><div class="ticker-track">${[0, 1].map(() => foods.map((f) => `<span><b>${esc(f.name)}</b> ${fmt(v(f, "kcal"), 0)} kcal · ${fmt(v(f, "protein"))} g protein · ${fmt(v(f, "fiber"))} g fibre</span>`).join("")).join("")}</div></div>
<div class="switch" role="group" aria-label="Measure every food by" data-switch><span>Per 100 g, measure by</span><button type="button" data-key="protein" aria-pressed="true">Protein</button><button type="button" data-key="fiber" aria-pressed="false">Fibre</button><button type="button" data-key="kcal" aria-pressed="false">Energy</button><button type="button" data-key="iron" aria-pressed="false">Iron</button></div>
<div class="chart">${chart}</div>
<div class="wide">
<h2>Start here</h2>
<div class="index-grid">
<a href="/guides/protein-per-100-kcal/" class="g-legumes"><h3><span class="chip"></span>Protein per 100 calories</h3><p>All ten foods ranked by how much protein each 100 kcal brings.</p></a>
<a href="/guides/per-100g-values/" class="g-grains"><h3><span class="chip"></span>How to read per-100 g values</h3><p>Dry versus cooked, raw versus boiled, and why the record matters.</p></a>
<a href="/tools/portion-calculator/" class="g-dairy-eggs"><h3><span class="chip"></span>Portion calculator</h3><p>Pick a food and a weight; get its nutrients for that portion.</p></a>
<a href="/recipes/" class="g-vegetables"><h3><span class="chip"></span>Four recipes</h3><p>Built only from the foods on this site, with nutrition worked out per serving.</p></a>
</div>
</div>
</main>`;
  add("/", layout({
    path: "/", title: `${NAME}: what 100 g of everyday foods holds`, description: "Per-100 g protein, fibre, energy and minerals for ten everyday foods from USDA FoodData Central, plus simple recipes and a portion calculator.", body,
    schemas: [
      { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: SITE + "/" },
      { "@context": "https://schema.org", "@type": "Organization", name: NAME, url: SITE + "/", logo: SITE + "/assets/logo.png" },
    ],
  }));
}

// ---------- Foods ----------
function nutrientTable(f, grams = 100) {
  const rows = Object.keys(LABELS).map((k) => {
    const unit = k === "kcal" ? "kcal" : f.n[k].unit;
    return `<tr><th scope="row">${LABELS[k]}</th><td class="num">${fmt(v(f, k) * grams / 100, unit === "g" ? 1 : 0)} ${unit}</td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table><caption>Per ${grams} g, USDA FDC ${f.fdcId}</caption><thead><tr><th scope="col">Nutrient</th><th scope="col" class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function donut(f) {
  const hexes = { grains: "#f0b323", legumes: "#e0602a", "dairy-eggs": "#74bde9", vegetables: "#3f9e52", fish: "#1d5aa6", "nuts-seeds": "#b03a6c" };
  const parts = [["protein", "Protein", v(f, "protein") * 4, hexes[f.group]], ["fat", "Fat", v(f, "fat") * 9, "#16140f"], ["carbs", "Carbohydrate", v(f, "carbs") * 4, "#cfcabd"]];
  const sum = parts.reduce((a, p) => a + p[2], 0);
  const R = 70, C = 2 * Math.PI * R;
  let off = 0;
  const circles = parts.map(([key, label, kc, color]) => {
    const len = (kc / sum) * C, pct = Math.round((kc / sum) * 100);
    const c = `<circle data-seg="${label}" data-key="${key}" data-pct="${pct}" tabindex="0" cx="90" cy="90" r="${R}" stroke="${color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" style="--len:${(C - off).toFixed(2)}"><title>${label}: ${pct}% of energy</title></circle>`;
    off += len; return c;
  }).join("");
  return `<div class="donut"><div class="donut-fig"><svg viewBox="0 0 180 180" role="img" aria-label="Share of energy from protein, fat and carbohydrate">${circles}</svg><div class="donut-label"><b>${fmt(v(f, "kcal"), 0)}</b>kcal per 100 g</div></div><ul class="donut-key">${parts.map(([, label, kc, color]) => `<li><i style="background:${color}"></i>${label}<span style="margin-left:auto">${Math.round((kc / sum) * 100)}%</span></li>`).join("")}</ul></div><p class="note">Shares use 4 kcal per gram for protein and carbohydrate and 9 for fat, so they are estimates; fibre is counted inside carbohydrate.</p>`;
}

for (const f of foods) {
  const g = GROUPS[f.group];
  const crumbs = breadcrumbs([["/foods/", "Foods"], [f.url, f.name]]);
  const pr = rank(f, "protein"), fr = rank(f, "fiber");
  const kcalShare = (x) => Math.round((x / v(f, "kcal")) * 100);
  const facts = `<ul>
<li>Protein: <b>${fmt(v(f, "protein"))} g</b> per 100 g, ${ordinal(pr)} of the ten foods on this site.</li>
<li>Fibre: <b>${fmt(v(f, "fiber"))} g</b> per 100 g, ${ordinal(fr)} of ten.</li>
<li>Protein per 100 kcal: <b>${fmt(per100kcal(f))} g</b>.</li>
<li>Share of energy from fat: about <b>${kcalShare(v(f, "fat") * 9)}%</b>; from protein about <b>${kcalShare(v(f, "protein") * 4)}%</b> (using 9 and 4 kcal per gram).</li>
</ul>`;
  const others = foods.filter((x) => x.group === f.group && x.slug !== f.slug);
  const body = `<main id="main">
${crumbs.html}
<div class="field g-${f.group}"><p class="group">${g.name}</p><h1>${esc(f.name)}: nutrition per 100 g</h1><p class="lede">${fmt(v(f, "kcal"), 0)} kcal, ${fmt(v(f, "protein"))} g protein and ${fmt(v(f, "fiber"))} g fibre in every 100 grams.</p></div>
<div class="source"><span><b>Source</b> USDA FoodData Central</span><span><b>Record</b> <a href="https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients">FDC ${f.fdcId}</a></span><span><b>NDB</b> ${f.ndb}</span><span><b>Dataset</b> SR Legacy</span><span><b>Published</b> ${f.published}</span><span><b>Basis</b> per 100 g edible portion</span><span><b>Retrieved</b> ${data.fetched}</span></div>
<div class="column">
<p>${NOTES[f.slug]}</p>
<h2>Nutrients in 100 g</h2>
${nutrientTable(f)}
<h2>Where the energy comes from</h2>
${donut(f)}
<h2>How it compares</h2>
${facts}
<p>See every food side by side in <a href="/guides/protein-per-100-kcal/">protein per 100 calories</a>, or work out a real portion with the <a href="/tools/portion-calculator/?food=${f.slug}">portion calculator</a>.</p>
${others.length ? `<h2>Also in ${g.name.toLowerCase()}</h2><ul>${others.map((o) => `<li><a href="${o.url}">${esc(o.name)}</a></li>`).join("")}</ul>` : ""}
<p class="disclaimer">USDA description: “${esc(f.description)}”. Values are averages for this record; brands and preparation vary. General information, not medical or dietary advice.</p>
</div>
</main>`;
  add(f.url, layout({
    path: f.url, group: f.group, navCurrent: "/foods/",
    title: `${f.name} nutrition per 100 g: protein, fibre, calories | ${NAME}`,
    description: `${f.name} per 100 g: ${fmt(v(f, "kcal"), 0)} kcal, ${fmt(v(f, "protein"))} g protein, ${fmt(v(f, "fiber"))} g fibre, ${fmt(v(f, "iron"))} mg iron. USDA FDC ${f.fdcId}.`,
    body,
    schemas: [crumbs.schema, {
      "@context": "https://schema.org", "@type": "Article", headline: `${f.name}: nutrition per 100 g`, datePublished: TODAY, dateModified: TODAY,
      author: { "@type": "Organization", name: NAME, url: SITE + "/" }, publisher: { "@type": "Organization", name: NAME, logo: { "@type": "ImageObject", url: SITE + "/assets/logo.png" } },
      isBasedOn: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`, mainEntityOfPage: SITE + f.url,
    }],
  }));
}

{
  const crumbs = breadcrumbs([["/foods/", "Foods"]]);
  const groups = Object.entries(GROUPS).map(([g, meta]) => `<h2>${meta.name}</h2><div class="table-wrap"><table><thead><tr><th scope="col">Food</th><th scope="col" class="num">kcal</th><th scope="col" class="num">Protein g</th><th scope="col" class="num">Fibre g</th><th scope="col" class="num">Fat g</th></tr></thead><tbody>${foods.filter((f) => f.group === g).map((f) => `<tr><th scope="row"><a href="${f.url}">${esc(f.name)}</a></th><td class="num">${fmt(v(f, "kcal"), 0)}</td><td class="num">${fmt(v(f, "protein"))}</td><td class="num">${fmt(v(f, "fiber"))}</td><td class="num">${fmt(v(f, "fat"))}</td></tr>`).join("")}</tbody></table></div>`).join("");
  add("/foods/", layout({
    path: "/foods/", navCurrent: "/foods/", title: `All foods: nutrition per 100 g | ${NAME}`, description: "Ten everyday foods with per-100 g energy, protein, fibre and fat from USDA FoodData Central, grouped by food group.",
    body: `<main id="main">${crumbs.html}<div class="field g-neutral"><h1>All foods, per 100 g</h1><p class="lede">Ten foods in six groups. Every number links back to its USDA record.</p></div><div class="column">${groups}</div></main>`,
    schemas: [crumbs.schema],
  }));
}

// ---------- Guides ----------
{
  const crumbs = breadcrumbs([["/guides/", "Guides"], ["/guides/protein-per-100-kcal/", "Protein per 100 calories"]]);
  const sorted = [...foods].sort((a, b) => per100kcal(b) - per100kcal(a));
  const max = per100kcal(sorted[0]);
  const bars = `<ul class="bars" aria-label="Protein per 100 kcal, highest first">${sorted.map((f, i) => `<li class="g-${f.group}" style="--n:${i}"><a href="${f.url}">${esc(f.name)}</a><span class="bar" style="width:${(per100kcal(f) / max * 100).toFixed(1)}%"></span><span class="val">${fmt(per100kcal(f))} g</span></li>`).join("")}</ul>`;
  const top = sorted[0], low = sorted[sorted.length - 1];
  const body = `<main id="main">${crumbs.html}
<div class="field g-legumes"><p class="group">Guide</p><h1>Protein per 100 calories, ten foods ranked</h1><p class="lede">Grams per 100 g tell you how dense a food is. Grams per 100 kcal tell you how much protein you get for the energy you eat.</p></div>
<div class="source"><span><b>Source</b> USDA FoodData Central, SR Legacy</span><span><b>Records</b> ${foods.length}</span><span><b>Formula</b> protein g ÷ kcal × 100</span><span><b>Retrieved</b> ${data.fetched}</span></div>
<div class="column">
<h2>The ranking</h2>
${bars}
<p>${esc(top.name)} leads with ${fmt(per100kcal(top))} g of protein per 100 kcal. ${esc(low.name)} sits last at ${fmt(per100kcal(low))} g, even though ${low.slug === "almonds" ? "almonds hold more protein per 100 g than several foods above them" : "it is still a useful food"}: their energy comes mostly from fat.</p>
<h2>Why both numbers matter</h2>
<p>Per 100 g suits comparing foods you eat by weight. Per 100 kcal suits comparing foods when you care about energy, because it removes the effect of water and fat. Spinach is a good example: it has little protein per 100 g, but because it has so few calories, its protein per 100 kcal is high.</p>
<h2>Check a portion</h2>
<p>Nobody eats exactly 100 g. Use the <a href="/tools/portion-calculator/">portion calculator</a> to scale any food to the weight on your plate, and read <a href="/guides/per-100g-values/">how to read per-100 g values</a> before comparing cooked and dry foods.</p>
<p class="disclaimer">General information, not medical or dietary advice.</p>
</div></main>`;
  add("/guides/protein-per-100-kcal/", layout({
    path: "/guides/protein-per-100-kcal/", group: "legumes", navCurrent: "/guides/",
    title: `Protein per 100 calories: ten everyday foods ranked | ${NAME}`,
    description: `Ten foods ranked by grams of protein per 100 kcal using USDA data. ${top.name} leads with ${fmt(per100kcal(top))} g; ${low.name} is last.`,
    body, schemas: [crumbs.schema, { "@context": "https://schema.org", "@type": "Article", headline: "Protein per 100 calories, ten foods ranked", datePublished: TODAY, dateModified: TODAY, author: { "@type": "Organization", name: NAME, url: SITE + "/" }, mainEntityOfPage: SITE + "/guides/protein-per-100-kcal/" }],
  }));
}
{
  const crumbs = breadcrumbs([["/guides/", "Guides"], ["/guides/per-100g-values/", "Reading per-100 g values"]]);
  const oats = foods.find((f) => f.slug === "rolled-oats"), rice = foods.find((f) => f.slug === "brown-rice");
  const body = `<main id="main">${crumbs.html}
<div class="field g-grains"><p class="group">Guide</p><h1>How to read per-100 g nutrition values</h1><p class="lede">A per-100 g number is only as useful as the record it comes from. Dry or cooked, raw or boiled: the state of the food changes everything.</p></div>
<div class="column">
<h2>One food, several records</h2>
<p>USDA FoodData Central keeps separate records for the same food in different states. Rolled oats on this site are measured dry: ${fmt(v(oats, "kcal"), 0)} kcal per 100 g. Brown rice is measured cooked: ${fmt(v(rice, "kcal"), 0)} kcal per 100 g. The gap is mostly water, not a difference in the grains.</p>
<h2>Three checks before comparing</h2>
<ol>
<li><b>State.</b> Is the record dry, raw, cooked, boiled or drained? Compare like with like.</li>
<li><b>Salt.</b> Cooked legume records here are “without salt”. Canned or salted versions carry more sodium.</li>
<li><b>Edible portion.</b> Values cover the part you eat: egg without shell, fish without bones.</li>
</ol>
<h2>From 100 g to your plate</h2>
<p>Multiply each value by your portion weight and divide by 100. A 40 g serving of dry oats holds 40 ÷ 100 = 0.4 times the amounts listed. The <a href="/tools/portion-calculator/">portion calculator</a> does this for you.</p>
<h2>Where the numbers come from</h2>
<p>Every food page shows its FoodData Central record number in the dark source strip under the title. Follow it to see the full USDA record, including nutrients not listed here.</p>
<p class="disclaimer">General information, not medical or dietary advice.</p>
</div></main>`;
  add("/guides/per-100g-values/", layout({
    path: "/guides/per-100g-values/", group: "grains", navCurrent: "/guides/",
    title: `How to read per-100 g nutrition values (dry vs cooked) | ${NAME}`,
    description: "Why dry and cooked foods have very different per-100 g values, three checks before comparing foods, and how to scale values to your portion.",
    body, schemas: [crumbs.schema, { "@context": "https://schema.org", "@type": "Article", headline: "How to read per-100 g nutrition values", datePublished: TODAY, dateModified: TODAY, author: { "@type": "Organization", name: NAME, url: SITE + "/" }, mainEntityOfPage: SITE + "/guides/per-100g-values/" }],
  }));
}
{
  const crumbs = breadcrumbs([["/guides/", "Guides"]]);
  add("/guides/", layout({
    path: "/guides/", navCurrent: "/guides/", title: `Guides | ${NAME}`, description: "Short guides on reading nutrition values and comparing foods fairly, using USDA FoodData Central data.",
    body: `<main id="main">${crumbs.html}<div class="field g-neutral"><h1>Guides</h1></div><div class="wide"><div class="index-grid">
<a href="/guides/protein-per-100-kcal/" class="g-legumes"><h3><span class="chip"></span>Protein per 100 calories</h3><p>Ten foods ranked by protein for the energy.</p></a>
<a href="/guides/per-100g-values/" class="g-grains"><h3><span class="chip"></span>How to read per-100 g values</h3><p>Dry, cooked, raw, boiled: compare like with like.</p></a>
</div></div></main>`, schemas: [crumbs.schema],
  }));
}

// ---------- Recipes ----------
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

function recipeNutrition(r) {
  const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugars: 0, sodium: 0 };
  for (const [slug, grams] of r.items) {
    const f = foods.find((x) => x.slug === slug);
    for (const k of Object.keys(totals)) totals[k] += v(f, k) * grams / 100;
  }
  for (const k of Object.keys(totals)) totals[k] /= r.serves;
  return totals;
}

function plateSvg(r) {
  const colors = r.items.map(([slug]) => `var(--${foods.find((f) => f.slug === slug).group})`);
  const hex = { grains: "#f0b323", legumes: "#e0602a", "dairy-eggs": "#74bde9", vegetables: "#3f9e52", fish: "#1d5aa6", "nuts-seeds": "#b03a6c" };
  const fills = r.items.map(([slug]) => hex[foods.find((f) => f.slug === slug).group]);
  const n = fills.length;
  const arcs = fills.map((c, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const r1 = 300, cx = 600, cy = 450;
    const p = (a) => `${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}`;
    return `<path d="M${cx} ${cy} L${p(a0)} A${r1} ${r1} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z" fill="${c}"/>`;
  }).join("");
  void colors;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-labelledby="t"><title id="t">${esc(r.name)}: plate chart of its ingredients by food group</title><rect width="1200" height="900" fill="#ffffff"/><circle cx="600" cy="450" r="380" fill="#16140f"/><circle cx="600" cy="450" r="350" fill="#ffffff"/>${arcs}<circle cx="600" cy="450" r="120" fill="#ffffff"/><text x="600" y="470" text-anchor="middle" font-family="Arial Narrow, sans-serif" font-weight="800" font-size="56" fill="#16140f">${r.serves} ${r.serves === 1 ? "serving" : "servings"}</text></svg>`;
}

for (const r of RECIPES) {
  const url = `/recipes/${r.slug}/`;
  const crumbs = breadcrumbs([["/recipes/", "Recipes"], [url, r.name]]);
  const nut = recipeNutrition(r);
  const total = r.prep + r.cook;
  const ingredients = [...r.items.map(([slug, grams]) => { const f = foods.find((x) => x.slug === slug); return { text: `${grams} g ${f.name.toLowerCase()}`, html: `${grams} g <a href="${f.url}">${esc(f.name.toLowerCase())}</a>` }; }),
    ...r.extra.map((t) => ({ text: t, html: esc(t) }))];
  const img = `/assets/recipes/${r.slug}.svg`;
  const body = `<main id="main">${crumbs.html}
<div class="field g-${r.group}"><p class="group">Recipe · serves ${r.serves}</p><h1>${esc(r.name)}</h1><p class="lede">${esc(r.desc)}</p></div>
<div class="source"><span><b>Prep</b> ${r.prep} min</span><span><b>Cook</b> ${r.cook} min</span>${r.rest ? `<span><b>Rest</b> ${r.rest}</span>` : ""}<span><b>Per serving</b> ${fmt(nut.kcal, 0)} kcal · ${fmt(nut.protein)} g protein · ${fmt(nut.fiber)} g fibre</span><span><b>Data</b> USDA FDC, tracked ingredients only</span></div>
<div class="column">
<figure class="plate"><img src="${img}" width="1200" height="900" alt="Plate chart of ${esc(r.name.toLowerCase())}, coloured by the food groups of its ingredients"></figure>
<h2>Ingredients</h2><ul>${ingredients.map((i) => `<li>${i.html}</li>`).join("")}</ul>
<h2>Method</h2><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
<h2>Nutrition per serving</h2>
<div class="table-wrap"><table><thead><tr><th scope="col">Nutrient</th><th scope="col" class="num">Amount</th></tr></thead><tbody>
<tr><th scope="row">Energy</th><td class="num">${fmt(nut.kcal, 0)} kcal</td></tr><tr><th scope="row">Protein</th><td class="num">${fmt(nut.protein)} g</td></tr><tr><th scope="row">Total fat</th><td class="num">${fmt(nut.fat)} g</td></tr><tr><th scope="row">Carbohydrate</th><td class="num">${fmt(nut.carbs)} g</td></tr><tr><th scope="row">Fibre</th><td class="num">${fmt(nut.fiber)} g</td></tr><tr><th scope="row">Sugars</th><td class="num">${fmt(nut.sugars)} g</td></tr><tr><th scope="row">Sodium</th><td class="num">${fmt(nut.sodium, 0)} mg</td></tr>
</tbody></table></div>
<p class="note">Worked out from the USDA records of the linked ingredients at the weights listed. Water, spices, lemon and added salt are not counted; added salt raises sodium.</p>
<p class="disclaimer">General information, not medical or dietary advice.</p>
</div></main>`;
  add(url, layout({
    path: url, group: r.group, navCurrent: "/recipes/",
    title: `${r.name} (${fmt(nut.protein, 0)} g protein per serving) | ${NAME}`,
    description: `${r.desc} ${fmt(nut.kcal, 0)} kcal and ${fmt(nut.protein)} g protein per serving, from USDA data.`,
    body,
    schemas: [crumbs.schema, {
      "@context": "https://schema.org", "@type": "Recipe", name: r.name, description: r.desc, image: [SITE + img],
      author: { "@type": "Organization", name: NAME, url: SITE + "/" }, datePublished: TODAY,
      prepTime: `PT${r.prep}M`, cookTime: `PT${r.cook}M`, totalTime: `PT${total}M`, recipeYield: `${r.serves} ${r.serves === 1 ? "serving" : "servings"}`,
      recipeCategory: r.slug.includes("oats") ? "Breakfast" : "Main course",
      keywords: r.items.map(([s]) => foods.find((f) => f.slug === s).name).join(", "),
      recipeIngredient: ingredients.map((i) => i.text),
      recipeInstructions: r.steps.map((s) => ({ "@type": "HowToStep", text: s })),
      nutrition: { "@type": "NutritionInformation", calories: `${fmt(nut.kcal, 0)} calories`, proteinContent: `${fmt(nut.protein)} g`, fatContent: `${fmt(nut.fat)} g`, carbohydrateContent: `${fmt(nut.carbs)} g`, fiberContent: `${fmt(nut.fiber)} g`, sugarContent: `${fmt(nut.sugars)} g`, sodiumContent: `${fmt(nut.sodium, 0)} mg`, servingSize: "1 serving" },
    }],
  }));
  r.svg = plateSvg(r);
  r.url = url; r.nut = nut;
}
{
  const crumbs = breadcrumbs([["/recipes/", "Recipes"]]);
  add("/recipes/", layout({
    path: "/recipes/", navCurrent: "/recipes/", title: `Recipes with nutrition per serving | ${NAME}`, description: "Four simple recipes built only from foods on Plate Notes, each with protein, fibre and energy per serving from USDA data.",
    body: `<main id="main">${crumbs.html}<div class="field g-neutral"><h1>Recipes</h1><p class="lede">Every ingredient that carries nutrition links to its USDA-sourced food page.</p></div><div class="wide"><div class="index-grid">${RECIPES.map((r) => `<a href="${r.url}" class="g-${r.group}"><h3><span class="chip"></span>${esc(r.name)}</h3><p>Serves ${r.serves} · ${fmt(r.nut.kcal, 0)} kcal · ${fmt(r.nut.protein)} g protein per serving</p></a>`).join("")}</div></div></main>`,
    schemas: [crumbs.schema],
  }));
}

// ---------- Tool ----------
{
  const crumbs = breadcrumbs([["/tools/portion-calculator/", "Portion calculator"]]);
  const toolData = foods.map((f) => ({ slug: f.slug, name: f.name, url: f.url, fdc: f.fdcId, n: Object.fromEntries(Object.entries(f.n).map(([k, x]) => [k, [x.value, k === "kcal" ? "kcal" : x.unit]])) }));
  const body = `<main id="main">${crumbs.html}
<div class="field g-dairy-eggs"><p class="group">Tool</p><h1>Portion calculator</h1><p class="lede">Pick a food, type the weight on your plate, and see what that portion holds.</p></div>
<div class="column">
<form class="tool" id="calc" novalidate>
<div class="row">
<label>Food<select id="food">${foods.map((f) => `<option value="${f.slug}">${esc(f.name)}</option>`).join("")}</select></label>
<label>Weight in grams<input id="grams" type="number" inputmode="decimal" min="1" max="2000" step="1" value="100" required></label>
</div>
<p class="err" id="err" role="alert"></p>
<output id="out" for="food grams" aria-live="polite"></output>
</form>
<noscript><p>The calculator needs JavaScript. Every food page lists its per-100 g values; multiply by your weight and divide by 100.</p></noscript>
<p class="note">Values scale linearly from the USDA per-100 g record shown under the result.</p>
<p class="disclaimer">General information, not medical or dietary advice.</p>
</div></main>
<script>
const FOODS=${JSON.stringify(toolData)};
const L=${JSON.stringify(LABELS)};
const sel=document.getElementById("food"),g=document.getElementById("grams"),out=document.getElementById("out"),err=document.getElementById("err");
const q=new URLSearchParams(location.search).get("food");if(q&&FOODS.some(f=>f.slug===q))sel.value=q;
function fmt(x,d){return (Math.round(x*10**d)/10**d).toLocaleString("en-US",{maximumFractionDigits:d})}
function render(){const w=Number(g.value);const f=FOODS.find(x=>x.slug===sel.value);
if(!g.value||!isFinite(w)||w<=0||w>2000){err.textContent="Enter a weight between 1 and 2000 grams.";out.innerHTML="";return}
err.textContent="";
out.innerHTML='<div class="table-wrap"><table><caption>'+fmt(w,0)+' g of '+f.name.toLowerCase()+'</caption><thead><tr><th scope="col">Nutrient</th><th scope="col" class="num">Amount</th></tr></thead><tbody>'+Object.keys(L).map(k=>{const[val,u]=f.n[k];return '<tr><th scope="row">'+L[k]+'</th><td class="num">'+fmt(val*w/100,u==="g"?1:0)+' '+u+'</td></tr>'}).join("")+'</tbody></table></div><p class="note">From <a href="'+f.url+'">'+f.name+'</a>, USDA FDC '+f.fdc+'.</p>'}
sel.addEventListener("change",render);g.addEventListener("input",render);document.getElementById("calc").addEventListener("submit",e=>{e.preventDefault();render()});render();
</script>`;
  add("/tools/portion-calculator/", layout({
    path: "/tools/portion-calculator/", group: "dairy-eggs", navCurrent: "/tools/portion-calculator/",
    title: `Portion nutrition calculator: protein and calories by weight | ${NAME}`,
    description: "Scale USDA per-100 g values to any portion: pick one of ten foods, enter grams, and see energy, protein, fibre, fat and minerals.",
    body, schemas: [crumbs.schema, { "@context": "https://schema.org", "@type": "WebApplication", name: "Portion calculator", applicationCategory: "HealthApplication", operatingSystem: "Any", url: SITE + "/tools/portion-calculator/", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }],
  }));
}

// ---------- About, privacy ----------
{
  const crumbs = breadcrumbs([["/about/", "About"]]);
  add("/about/", layout({
    path: "/about/", navCurrent: "/about/", title: `About ${NAME}`, description: "What Plate Notes is, where its numbers come from, and why it has a section of pages broken on purpose.",
    body: `<main id="main">${crumbs.html}<div class="field g-neutral"><h1>About ${NAME}</h1></div><div class="column">
<p>${NAME} is a small, non-commercial reference. It shows what 100 grams of ten everyday foods holds and builds a few simple recipes from them.</p>
<h2>Where the numbers come from</h2>
<p>All nutrient values come from <a href="https://fdc.nal.usda.gov/">USDA FoodData Central</a>, SR Legacy dataset, which is in the public domain. Each food page shows its record number and the date the data was retrieved (${data.fetched}). Nothing is estimated except the per-serving recipe totals and the protein-per-100 kcal figures, which are calculated from those records.</p>
<h2>The SEO lab</h2>
<p>The site also works as a practice ground for Google Search Console. The <a href="/lab/">SEO lab</a> holds pages that are broken on purpose. Each says so at the top and explains which Search Console status it should produce.</p>
<h2>What this site is not</h2>
<p>It is not a clinic, a dietitian or a business, and it gives no medical or dietary advice. It has no ads, no affiliate links and no reviews.</p>
</div></main>`, schemas: [crumbs.schema],
  }));
}
{
  const crumbs = breadcrumbs([["/privacy/", "Privacy"]]);
  add("/privacy/", layout({
    path: "/privacy/", title: `Privacy | ${NAME}`, description: "What Plate Notes collects: nothing beyond standard hosting logs, plus Google Analytics if it is switched on.",
    body: `<main id="main">${crumbs.html}<div class="field g-neutral"><h1>Privacy</h1></div><div class="column">
<p>${NAME} has no accounts, forms that send data, or cookies of its own. The site is hosted on GitHub Pages, which keeps standard server logs.</p>
<p>${config.ga4Id ? "This site uses Google Analytics 4 to count visits. Google Analytics sets cookies and processes usage data as described in Google's privacy policy." : "Analytics is not switched on. If Google Analytics 4 is added later, this page will say so."}</p>
<p>The portion calculator runs entirely in your browser; nothing you type is sent anywhere.</p>
</div></main>`, schemas: [crumbs.schema],
  }));
}

// ---------- SEO lab ----------
const banner = (what) => `<div class="lab-banner">This page is broken on purpose for Search Console practice: ${what} <a href="/lab/">Back to the lab</a>.</div>`;
const labPage = (path, title, what, body, opts = {}) => add(path, layout({
  path, group: "lab", navCurrent: "/lab/", title, description: opts.description ?? `SEO lab test page: ${what}`,
  body: `<main id="main">${banner(what)}<div class="field g-lab"><p class="group">SEO lab</p><h1>${esc(opts.h1 || title)}</h1></div><div class="column">${body}</div></main>`, ...opts,
}), opts.sitemap ?? true);

const LAB = [
  { path: "/lab/noindex/", title: "Lab: page with a noindex tag", fault: "excluded", expect: "Page indexing: Excluded by ‘noindex’ tag", why: "Has <code>&lt;meta name=\"robots\" content=\"noindex\"&gt;</code> and is listed in the sitemap, so Google sees a submitted page it may not index." },
  { path: "/lab/blocked-by-robots/", title: "Lab: page blocked by robots.txt", fault: "error", expect: "Page indexing: Blocked by robots.txt (or Indexed, though blocked by robots.txt)", why: "robots.txt disallows this path while the sitemap submits it." },
  { path: "/lab/broken-link/", title: "Lab: page with a broken internal link", fault: "error", expect: "Page indexing: Not found (404) for /lab/this-page-does-not-exist/", why: "Links to a URL with no file. GitHub Pages answers with the custom 404 page and a real 404 status." },
  { path: "/lab/old-address/", title: "Lab: redirected page", fault: "excluded", expect: "Page indexing: Page with redirect", why: "An instant meta refresh sends visitors to /lab/new-address/. GitHub Pages cannot send a server 301, and Google treats an instant meta refresh as a permanent redirect." },
  { path: "/lab/chain-start/", title: "Lab: redirect chain", fault: "excluded", expect: "Page indexing: Page with redirect (two hops: chain-start, chain-middle, new-address)", why: "Two meta-refresh hops in a row. Crawlers like Screaming Frog flag this as a redirect chain." },
  { path: "/lab/duplicate-a/", title: "Lab: duplicate page A", fault: "excluded", expect: "Page indexing: Duplicate without user-selected canonical (on A or B)", why: "Same text as /lab/duplicate-b/ and neither page declares a canonical." },
  { path: "/lab/alternate/", title: "Lab: alternate with canonical", fault: "excluded", expect: "Page indexing: Alternate page with proper canonical tag", why: "Its canonical tag points to /lab/canonical-target/, which holds the same text." },
  { path: "/lab/canonical-mismatch/", title: "Lab: canonical pointing to an unrelated page", fault: "excluded", expect: "URL Inspection: user-declared canonical differs from Google-selected canonical (often)", why: "Declares the home page as canonical though its content is unrelated, so Google may ignore the hint." },
  { path: "/lab/soft-404/", title: "Lab: soft 404", fault: "error", expect: "Page indexing: Soft 404", why: "Says the item was not found but returns status 200 with almost no content." },
  { path: "/lab/thin-content/", title: "Lab: thin page", fault: "excluded", expect: "Page indexing: Crawled, currently not indexed (likely)", why: "A real but nearly empty page. Google often crawls such pages and declines to index them." },
  { path: "/lab/orphan/", title: "Lab: orphan page", fault: "excluded", expect: "Page indexing: Discovered, currently not indexed (likely), found only through the sitemap", why: "No page links here; only the sitemap lists it. Screaming Frog finds it only in sitemap crawl mode." },
  { path: "/lab/not-in-sitemap/", title: "Lab: page missing from the sitemap", fault: "excluded", expect: "URL Inspection: discovered via links, “Sitemaps: N/A”", why: "Linked from the lab but deliberately left out of sitemap.xml." },
  { path: "/lab/broken-recipe-schema/", title: "Lab: recipe with invalid structured data", fault: "error", expect: "Enhancements, Recipes: invalid item (missing field “image”); Rich Results Test errors", why: "Its Recipe JSON-LD leaves out the required image property." },
  { path: "/lab/javascript-content/", title: "Lab: content added by JavaScript", fault: "ok", expect: "URL Inspection, View crawled page: the text appears only in the rendered HTML", why: "The main paragraph is written into the page by a script, so the raw HTML and the rendered HTML differ." },
  { path: "/lab/missing-title/", title: "", fault: "error", expect: "Crawlers flag a missing title and description; Google writes its own title link", why: "Has no <code>&lt;title&gt;</code> and no meta description." },
  { path: "/lab/sitemap-with-errors.xml", title: "Lab: sitemap with errors", fault: "error", expect: "Sitemaps: Has errors (submit it by hand)", why: "A second sitemap with a bad date and a URL on another host. Submit it in Search Console to see the errors." },
];

const faultSvg = (kind) => {
  const pattern = kind === "ok" ? "" : kind === "excluded" ? `stroke-dasharray="8 6"` : `stroke-dasharray="2 5"`;
  const label = kind === "ok" ? "Valid, worth inspecting" : kind === "excluded" ? "Excluded" : "Error";
  return `<span class="fault"><svg viewBox="0 0 44 10" aria-hidden="true"><line x1="0" y1="5" x2="44" y2="5" stroke="currentColor" stroke-width="4" ${pattern}/></svg>${label}</span>`;
};

{
  const crumbs = breadcrumbs([["/lab/", "SEO lab"]]);
  const body = `<main id="main">${crumbs.html}
<div class="field g-lab"><p class="group">SEO lab</p><h1>Pages broken on purpose</h1><p class="lede">Each page below triggers a different Search Console status. Verify the site, submit the sitemap, wait, then find each one in the reports.</p></div>
<div class="column">
<h2 id="how">How to practise</h2>
<ol>
<li>Add <code>${SITE}/</code> as a URL-prefix property in Google Search Console and verify it.</li>
<li>Submit <code>${SITE}/sitemap.xml</code> under Sitemaps.</li>
<li>Run URL Inspection on a few lab URLs. Use “Test live URL”, then “View tested page” to compare raw and rendered HTML.</li>
<li>Wait one to four weeks. Open Indexing, Pages and match each reason to the list below.</li>
<li>Fix one fault (for example, remove the noindex tag), push the change, and click “Validate fix”.</li>
</ol>
<p class="note">Lines show the expected result: solid is valid, dashed is excluded, dotted is an error. Google decides the final status, and timing varies.</p>
<h2>The test pages</h2>
<ul class="lab-list">${LAB.map((l) => `<li><h3><a href="${l.path}">${l.title || "Lab: page without a title"}</a></h3>${faultSvg(l.fault)}<p class="expect">Expect: ${l.expect}</p><p>${l.why}</p></li>`).join("")}</ul>
<h2>Also try</h2>
<ul>
<li>Request a <a href="/lab/this-page-does-not-exist/">missing URL</a> and confirm the 404 status in your browser's network panel.</li>
<li>Run the <a href="https://search.google.com/test/rich-results">Rich Results Test</a> on a recipe page, then on the broken recipe page.</li>
<li>Crawl the whole site with Screaming Frog (free up to 500 URLs) and compare its findings with this list.</li>
<li>When you are done practising, remove the lab pages or add noindex to them, then let Google recrawl.</li>
</ul>
</div></main>`;
  add("/lab/", layout({ path: "/lab/", group: "lab", navCurrent: "/lab/", title: `SEO lab: pages broken on purpose for Search Console practice | ${NAME}`, description: "Sixteen deliberately broken test pages, each with the Google Search Console status it should produce: noindex, robots.txt, 404, redirects, canonicals, soft 404 and more.", body, schemas: [crumbs.schema] }));
}

labPage("/lab/noindex/", "Lab: page with a noindex tag", "it carries a noindex robots meta tag.", `<p>This page tells search engines not to index it. Because the sitemap still lists it, Search Console reports it as excluded by the noindex tag.</p><p>To practise a fix, remove the tag, push the change and use “Validate fix”.</p>`, { robots: "noindex" });
labPage("/lab/blocked-by-robots/", "Lab: page blocked by robots.txt", "robots.txt disallows this path.", `<p>Googlebot is told not to crawl this URL, so it cannot read anything here, including any noindex tag. Open <a href="/robots.txt">robots.txt</a> to see the rule.</p>`);
labPage("/lab/broken-link/", "Lab: page with a broken internal link", "it links to a page that does not exist.", `<p>This <a href="/lab/this-page-does-not-exist/">link goes nowhere</a>. Google follows it, gets a 404, and reports the missing URL.</p>`);
labPage("/lab/old-address/", "Lab: redirected page", "it redirects instantly with a meta refresh.", `<p>If you can read this, your browser did not follow the redirect. Go to the <a href="/lab/new-address/">new address</a>.</p>`, { headExtra: `<meta http-equiv="refresh" content="0; url=/lab/new-address/">`, canonical: "/lab/new-address/" });
labPage("/lab/chain-start/", "Lab: redirect chain", "it starts a two-hop redirect chain.", `<p>Go to the <a href="/lab/chain-middle/">next hop</a>.</p>`, { headExtra: `<meta http-equiv="refresh" content="0; url=/lab/chain-middle/">` });
labPage("/lab/chain-middle/", "Lab: redirect chain, middle hop", "it is the middle hop of a redirect chain.", `<p>Go to the <a href="/lab/new-address/">final address</a>.</p>`, { headExtra: `<meta http-equiv="refresh" content="0; url=/lab/new-address/">`, sitemap: false });
labPage("/lab/new-address/", "Lab: redirect target", "nothing; this is the healthy target of the redirects.", `<p>This is where /lab/old-address/ and the redirect chain end. It should be indexed normally.</p>`);
const dupText = `<p>Lentils cook from dry in about twenty minutes without soaking. Red lentils break down into a soft purée; green and brown lentils keep their shape and suit salads.</p><p>This paragraph appears on two lab pages on purpose, so that Google has to choose one of them as canonical.</p>`;
labPage("/lab/duplicate-a/", "Lab: duplicate page", "its content is identical to another page and it declares no canonical.", dupText, { canonical: null, description: "Lentils cook from dry in about twenty minutes without soaking." });
labPage("/lab/duplicate-b/", "Lab: duplicate page", "its content is identical to another page and it declares no canonical.", dupText, { canonical: null, description: "Lentils cook from dry in about twenty minutes without soaking." });
const canonText = `<p>Rolled oats are measured dry in USDA data. A 40 g serving of dry oats is a common breakfast portion.</p>`;
labPage("/lab/alternate/", "Lab: oats serving note", "its canonical tag points to another page with the same text.", canonText, { canonical: "/lab/canonical-target/" });
labPage("/lab/canonical-target/", "Lab: oats serving note", "nothing; this page is the declared canonical.", canonText);
labPage("/lab/canonical-mismatch/", "Lab: canonical pointing to an unrelated page", "its canonical points to the home page, which has different content.", `<p>Salmon bakes at 200 °C in about 12 to 15 minutes. This text has nothing to do with the home page, yet this page names the home page as its canonical.</p>`, { canonical: "/" });
labPage("/lab/soft-404/", "Item not found", "it says “not found” but returns status 200.", `<p>Sorry, that item could not be found.</p>`, { h1: "Item not found" });
labPage("/lab/thin-content/", "Lab: thin page", "it has almost no content.", `<p>Oats.</p>`);
labPage("/lab/orphan/", "Lab: orphan page", "no page links here; only the sitemap lists it.", `<p>You found the orphan. In a crawler, this page appears only when you also crawl the sitemap.</p>`);
labPage("/lab/not-in-sitemap/", "Lab: page missing from the sitemap", "it is linked but left out of sitemap.xml.", `<p>Google can still find this page through the link on the lab index. URL Inspection will show no sitemap for it.</p>`, { sitemap: false });
labPage("/lab/broken-recipe-schema/", "Lab: recipe with invalid structured data", "its Recipe structured data is missing the required image.", `<p>Test this URL in the Rich Results Test to see the error, then compare it with a <a href="/recipes/lentil-spinach-soup/">valid recipe page</a>.</p><h2>Lentils on toast</h2><ol><li>Warm 150 g cooked lentils with a pinch of cumin.</li><li>Spoon onto toasted bread.</li></ol>`, {
  schemas: [{ "@context": "https://schema.org", "@type": "Recipe", name: "Lentils on toast", recipeIngredient: ["150 g cooked lentils", "1 slice bread", "Pinch of cumin"], recipeInstructions: [{ "@type": "HowToStep", text: "Warm the lentils with cumin." }, { "@type": "HowToStep", text: "Spoon onto toasted bread." }] }],
});
labPage("/lab/javascript-content/", "Lab: content added by JavaScript", "its main text is written by JavaScript after the page loads.", `<p id="js-target">If you see only this sentence, JavaScript did not run.</p><script>document.getElementById("js-target").textContent="This sentence was written by JavaScript. In URL Inspection, compare the crawled HTML with the rendered HTML to see the difference.";</script>`);
labPage("/lab/missing-title/", "", "it has no title tag and no meta description.", `<p>Look at the browser tab: there is no title. Crawlers report both missing elements.</p>`, { noTitle: true, noDescription: true, h1: "Lab: page without a title" });

// ---------- 404 ----------
const notFound = layout({
  path: "/404.html", title: `Page not found | ${NAME}`, description: "This page does not exist.", canonical: null, robots: "noindex",
  body: `<main id="main"><div class="field g-neutral"><h1>Page not found</h1><p class="lede">There is nothing at this address. It returns a real 404 status, which is what Google should see for a missing page.</p></div><div class="column"><p>Try <a href="/foods/">all foods</a>, the <a href="/recipes/">recipes</a> or the <a href="/">home page</a>.</p></div></main>`,
});

// ---------- Write ----------
const KEEP = new Set(["index.html", "foods", "recipes", "guides", "tools", "lab", "about", "privacy", "assets", "fonts", "404.html", "robots.txt", "sitemap.xml", "favicon.svg", ".nojekyll"]);
for (const k of KEEP) await rm(k, { recursive: true, force: true });
await cp("static", ".", { recursive: true });
for (const p of pages) {
  const file = p.path.endsWith("/") ? join("." + p.path, "index.html") : "." + p.path;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, p.html);
}
await mkdir("assets/recipes", { recursive: true });
for (const r of RECIPES) await writeFile(`assets/recipes/${r.slug}.svg`, r.svg);
await writeFile("404.html", notFound);
await writeFile(".nojekyll", "");
await writeFile("robots.txt", `User-agent: *\nDisallow: /lab/blocked-by-robots/\n\nSitemap: ${SITE}/sitemap.xml\n`);
const smUrls = pages.filter((p) => p.sitemap).map((p) => p.path);
await writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smUrls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await writeFile("lab/sitemap-with-errors.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/lab/noindex/</loc><lastmod>last tuesday</lastmod></url>\n  <url><loc>https://example.com/not-this-site/</loc></url>\n  <url><loc>${SITE}/lab/this-page-does-not-exist/</loc></url>\n</urlset>\n`);
console.log(`built ${pages.length} pages, ${smUrls.length} in sitemap`);
