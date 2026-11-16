// Builds data/foods.json from the USDA FoodData Central SR Legacy bulk CSV (public domain).
// Download: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
// Run: node scripts/from-csv.mjs <unzipped folder>
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/from-csv.mjs <unzipped SR Legacy CSV folder>");

const FOODS = [
  { slug: "rolled-oats", name: "Rolled oats", group: "grains", fdc: "Cereals, oats, regular and quick, not fortified, dry" },
  { slug: "brown-rice", name: "Brown rice, cooked", group: "grains", fdc: "Rice, brown, long-grain, cooked" },
  { slug: "lentils", name: "Lentils, cooked", group: "legumes", fdc: "Lentils, mature seeds, cooked, boiled, without salt" },
  { slug: "chickpeas", name: "Chickpeas, cooked", group: "legumes", fdc: "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt" },
  { slug: "eggs", name: "Whole eggs", group: "dairy-eggs", fdc: "Egg, whole, raw, fresh" },
  { slug: "greek-yogurt", name: "Greek yogurt, plain nonfat", group: "dairy-eggs", fdc: "Yogurt, Greek, plain, nonfat" },
  { slug: "spinach", name: "Spinach, raw", group: "vegetables", fdc: "Spinach, raw" },
  { slug: "broccoli", name: "Broccoli, raw", group: "vegetables", fdc: "Broccoli, raw" },
  { slug: "salmon", name: "Atlantic salmon, farmed", group: "fish", fdc: "Fish, salmon, Atlantic, farmed, raw" },
  { slug: "almonds", name: "Almonds", group: "nuts-seeds", fdc: "Nuts, almonds" },
];
const NUTRIENTS = { "208": "kcal", "203": "protein", "204": "fat", "205": "carbs", "291": "fiber", "269": "sugars", "301": "calcium", "303": "iron", "306": "potassium", "307": "sodium" };

function parse(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const load = async (f) => parse(await readFile(join(dir, f), "utf8"));

const [food, sr, nutrient, category, fn] = await Promise.all(["food.csv", "sr_legacy_food.csv", "nutrient.csv", "food_category.csv", "food_nutrient.csv"].map(load));
const nutById = new Map(nutrient.map((n) => [n.id, n]));
const ndbByFdc = new Map(sr.map((s) => [s.fdc_id, s.NDB_number]));
const catById = new Map(category.map((c) => [c.id, c.description]));

const out = [];
for (const f of FOODS) {
  const want = f.fdc.toLowerCase();
  const hit = food.find((x) => x.description.toLowerCase() === want) || food.find((x) => x.description.toLowerCase().startsWith(want + " ("));
  if (!hit) throw new Error(`${f.slug}: not found`);
  const n = {};
  for (const row of fn) {
    if (row.fdc_id !== hit.fdc_id) continue;
    const meta = nutById.get(row.nutrient_id);
    const key = meta && NUTRIENTS[String(Number(meta.nutrient_nbr))];
    if (key && n[key] === undefined) n[key] = { value: Number(row.amount), unit: meta.unit_name.toLowerCase() };
  }
  const missing = Object.values(NUTRIENTS).filter((k) => !n[k]);
  if (missing.length) throw new Error(`${f.slug}: missing ${missing.join(", ")}`);
  out.push({ ...f, fdcId: Number(hit.fdc_id), ndb: Number(ndbByFdc.get(hit.fdc_id)), description: hit.description, category: catById.get(hit.food_category_id), published: hit.publication_date, n });
  console.log(`ok ${f.slug} fdc ${hit.fdc_id} kcal ${n.kcal.value} protein ${n.protein.value}`);
}
await mkdir("data", { recursive: true });
await writeFile("data/foods.json", JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: "USDA FoodData Central, SR Legacy (April 2018 release)", foods: out }, null, 2));
