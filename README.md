# Plate Notes

Live at https://anasgenaiva.github.io/

A small nutrition reference (per-100 g values for ten foods from USDA FoodData Central, four recipes, a portion
calculator) plus an **SEO lab**: pages broken on purpose so every Google Search Console report has something to show.

## Edit and rebuild

Source lives in `build.mjs` (pages and content), `static/` (CSS, fonts, favicon, logo) and `data/foods.json` (USDA
values). The build writes the site into the repository root, which GitHub Pages serves.

```bash
node build.mjs
git add -A && git commit -m "Update site" && git push
```

Rebuild the food data from USDA's public SR Legacy CSV (no API key):

```bash
node scripts/from-csv.mjs <unzipped FoodData_Central_sr_legacy_food_csv_2018-04 folder>
```

## Search Console and GA4

Put the values in `config.json`, then rebuild and push:

- `googleSiteVerification`: the `content` value of the HTML-tag method in Search Console.
- `ga4Id`: the GA4 measurement ID (`G-XXXXXXX`).

## The SEO lab

`/lab/` lists every test page and the Search Console status it should produce: noindex, blocked by robots.txt, 404,
meta-refresh redirect and redirect chain, duplicate without canonical, alternate with canonical, canonical mismatch,
soft 404, thin page, orphan, page missing from the sitemap, invalid Recipe markup, JavaScript-rendered content, missing
title, and a sitemap with errors (`/lab/sitemap-with-errors.xml`, submit it by hand).

GitHub Pages cannot send server redirects or custom headers, so redirects use an instant meta refresh.
