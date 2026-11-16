// Downloads the chosen Wikimedia Commons photos, converts them to WebP with ffmpeg, and records credits.
// Run: node scripts/fetch-photos.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const PHOTOS = {
  hero: "File:Vegetables at vegetable market, Havelock Island, Andamans.jpg",
  grains: "File:Cooked oatmeal in bowl.jpg",
  legumes: "File:Red lentils.JPG",
  "dairy-eggs": "File:Boiled Egg - Crossection.jpg",
  vegetables: "File:Spinach leaves.jpg",
  fish: "File:Raw salmon fillets.jpg",
  "nuts-seeds": "File:Pecans, hazelnuts, walnuts, almonds, Brazil nuts on a table with logs 1.jpg",
  fruit: "File:20241117 Fruit Platter anagoria.jpg",
  "overnight-oats-greek-yogurt": "File:Anabolic Blueberry Oatmeal..JPG",
  "lentil-spinach-soup": "File:Lentil soup with pepper and toast.jpg",
  "chickpea-egg-broccoli-bowl": "File:Plant-fruit-bowl-dish-food-salad-1200225-pxhere.jpg",
  "salmon-rice-broccoli": "File:Grilled plated salmon fillet.jpg",
};
const UA = { "User-Agent": "PlateNotesBuild/1.0 (static site build script)" };
await mkdir("static/img", { recursive: true });
await mkdir(".tmp", { recursive: true });
const credits = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, kind) { for (let i = 0; i < 6; i++) { const r = await fetch(url, { headers: UA }); if (r.ok) { const b = kind === "json" ? await r.json().catch(() => null) : Buffer.from(await r.arrayBuffer()); if (b) { await sleep(3000); return b; } } await sleep(15000 * (i + 1)); } throw new Error("failed " + url); }
for (const [key, title] of Object.entries(PHOTOS)) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const p = Object.values((await get(u, "json")).query.pages)[0];
  const i = p.imageinfo[0], m = i.extmetadata;
  const buf = await get(i.thumburl, "buf");
  const tmp = `.tmp/${key}.jpg`;
  await writeFile(tmp, buf);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", tmp, "-vf", "scale=1400:-2", "-q:v", "78", `static/img/${key}.webp`]);
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", `static/img/${key}.webp`]).toString().trim().split(",");
  credits[key] = {
    file: `/img/${key}.webp`, width: +out[0], height: +out[1], title: title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
    author: (m.Artist?.value || "Unknown").replace(/<[^>]+>/g, "").trim(), license: m.LicenseShortName?.value, licenseUrl: m.LicenseUrl?.value || "",
    source: i.descriptionurl,
  };
  console.log(`ok ${key} ${out.join("x")} ${credits[key].license}`);
}
await writeFile("data/photos.json", JSON.stringify(credits, null, 2));
