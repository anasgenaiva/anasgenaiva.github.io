// Lists free-licensed photos from Wikimedia Commons for a query: node scripts/commons-search.mjs "lentils"
const q = process.argv[2];
const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400`;
const r = await (await fetch(u, { headers: { "User-Agent": "PlateNotesBuild/1.0 (static site build script)" } })).json();
for (const p of Object.values(r.query?.pages || {})) {
  const i = p.imageinfo[0], m = i.extmetadata;
  if (i.width < 1200) continue;
  console.log([p.title, `${i.width}x${i.height}`, m.LicenseShortName?.value, (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 40), i.thumburl].join(" | "));
}
