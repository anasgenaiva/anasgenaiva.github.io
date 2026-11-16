# Plate Notes: Search Console practice, setup guide

Website: **https://anasgenaiva.github.io/**
Sitemap: **https://anasgenaiva.github.io/sitemap.xml**
Practice lab (broken on purpose): **https://anasgenaiva.github.io/lab/**

The website is finished and live. It is free (GitHub Pages), needs no domain purchase, and is already built for SEO
practice:

- 40 food pages, 7 food-group pages, 7 ranked lists, 24 food-vs-food comparisons, 4 recipes, 2 guides, a portion
  calculator, a compare tool, site search (Ctrl K), About, Photo credits, Privacy and an HTML sitemap: 119 pages.
- Real photos with alt text, sizes and WebP, listed in image sitemaps.
- Structured data: Recipe, Article, BreadcrumbList, ItemList, CollectionPage, WebSite with SearchAction, Organization.
- A **sitemap index** (`sitemap.xml`) pointing to three sitemaps: `sitemaps/pages.xml`, `sitemaps/foods.xml`,
  `sitemaps/lab.xml`. Plus `robots.txt`, a real 404 page, canonical tags, paginated lists, a noindex search page.
- An **SEO lab** of 17 pages broken on purpose. Each one should show up in a different Search Console report
  (noindex, blocked by robots.txt, 404, redirect, redirect chain, duplicate, canonical, soft 404, thin page, orphan
  page, page missing from the sitemap, broken Recipe markup, JavaScript content, missing title, sitemap with errors).

The only thing left is to connect **your friend's Google account** to the site. Google must see proof that the account
is allowed to manage this site. That proof is a small code that we put on the website.

---

## Part 1: What the owner (you) does

You only need to pass messages back and forth. Claude (or anyone with access to the GitHub repository
`anasgenaiva/anasgenaiva.github.io`) puts the code on the website.

1. Send your friend this guide (or just Part 2 below).
2. When your friend sends you a code that looks like this:
   `<meta name="google-site-verification" content="AbC123xyz..." />`
   paste it to Claude and say "add this Search Console verification code and push".
   (Technically: the `content` value goes into `config.json` as `googleSiteVerification`, then `node build.mjs`,
   commit and push. The site updates in about one minute.)
3. Tell your friend "done, click Verify".
4. Optional, later: when your friend sends a Google Analytics ID that looks like `G-XXXXXXXXXX`, paste it to Claude and
   say "add this GA4 ID and push" (it goes into `config.json` as `ga4Id`).

That is all. You do not need a Google Search Console account yourself.

---

## Part 2: What your friend does

### Step 1. Add the website to Search Console (5 minutes)

1. Go to **https://search.google.com/search-console** and sign in with a Google account.
2. Click the property menu at the top left, then **Add property**.
3. Choose the right-hand box, **URL prefix** (not "Domain": Domain needs DNS access, which a free github.io site does
   not have).
4. Type exactly: `https://anasgenaiva.github.io/` and click **Continue**.
5. Under "Other verification methods", open **HTML tag**. Copy the whole tag
   (`<meta name="google-site-verification" content="..." />`).
6. Send that tag to the site owner. **Do not close the page.** Wait for "done".
7. When the owner says done, click **Verify**. You should see "Ownership verified".

Do not remove the tag later. If it disappears, Search Console loses access.

### Step 2. Submit the sitemap (1 minute)

1. In Search Console, left menu: **Indexing, Sitemaps**.
2. In "Add a new sitemap", type `sitemap.xml` and click **Submit**.
3. Status should say **Success**. Because it is a sitemap index, Search Console then lists the three child sitemaps
   (pages, foods, lab) with about 116 pages between them. Click each one to see its own status.
4. For practice, also submit `lab/sitemap-with-errors.xml`. It is broken on purpose and should show **Has errors**.

### Step 3. Ask Google to look at the main pages (5 minutes)

1. Paste `https://anasgenaiva.github.io/` into the search bar at the top of Search Console (this is **URL Inspection**).
2. Click **Request indexing**. Do this for the home page and a few important pages, for example
   `https://anasgenaiva.github.io/foods/lentils/` and `https://anasgenaiva.github.io/recipes/lentil-spinach-soup/`.
   Google allows only a small number of these per day, so do not spam it.
3. Click **Test live URL**, then **View tested page**, to see the HTML Google sees and a screenshot.

### Step 4. Connect Google Analytics 4 (optional, 10 minutes)

1. Go to **https://analytics.google.com**, click **Admin**, then **Create, Property**. Name it "Plate Notes".
2. Add a **Web** data stream with the URL `https://anasgenaiva.github.io`.
3. Copy the **Measurement ID** (`G-XXXXXXXXXX`) and send it to the site owner. Wait for "done".
4. In GA4: **Admin, Product links, Search Console links, Link**, then choose the Search Console property from Step 1.
   (You must be the verified owner in Search Console and an Editor in GA4.)

### Step 5. Add Bing too (optional, 3 minutes)

1. Go to **https://www.bing.com/webmasters** and sign in.
2. Choose **Import from Google Search Console**. It copies the site and the sitemap automatically.

### Step 6. Wait, then practise

Google needs time. Typical timings:

| When | What appears |
|---|---|
| Right away | URL Inspection live tests, Sitemaps status, Rich Results Test |
| 2 to 7 days | First data in Performance, first pages in Page indexing |
| 1 to 4 weeks | Most lab pages show their expected reasons |
| Maybe never | Core Web Vitals field data (needs real Chrome traffic), many external links |

Some pages may never be indexed. On a small, new site on a free address, that is normal and is part of the practice.

---

## Part 3: What to practise, report by report

Open **https://anasgenaiva.github.io/lab/** for the full list. Each lab page says at the top that it is broken on
purpose and what it should show.

| Search Console report | What to find | Lab page |
|---|---|---|
| Indexing, Pages | Excluded by ‘noindex’ tag | /lab/noindex/ |
| Indexing, Pages | Blocked by robots.txt | /lab/blocked-by-robots/ |
| Indexing, Pages | Not found (404) | /lab/this-page-does-not-exist/ (linked from /lab/broken-link/) |
| Indexing, Pages | Page with redirect | /lab/old-address/ and /lab/chain-start/ |
| Indexing, Pages | Duplicate without user-selected canonical | /lab/duplicate-a/ and /lab/duplicate-b/ |
| Indexing, Pages | Alternate page with proper canonical tag | /lab/alternate/ |
| Indexing, Pages | Soft 404 | /lab/soft-404/ |
| Indexing, Pages | Crawled or Discovered, currently not indexed | /lab/thin-content/, /lab/orphan/ |
| Indexing, Pages | Excluded by noindex (internal search) | /search/ |
| PageSpeed Insights | Poor LCP and layout shift | /lab/slow-page/ |
| Enhancements, Breadcrumbs and Recipes | Valid items across many pages | foods, lists, recipes |
| Indexing, Videos / Images | Image sitemap entries | sitemaps/*.xml |
| URL Inspection | Google-selected vs user-declared canonical | /lab/canonical-mismatch/ |
| URL Inspection | Page found by links but not in a sitemap | /lab/not-in-sitemap/ |
| URL Inspection, View tested page | Text that only exists after JavaScript runs | /lab/javascript-content/ |
| Enhancements, Recipes | Valid recipes vs one invalid item (missing image) | /recipes/… and /lab/broken-recipe-schema/ |
| Enhancements, Breadcrumbs | Valid breadcrumbs on every normal page | any food page |
| Sitemaps | Success vs Has errors | sitemap.xml and lab/sitemap-with-errors.xml |
| Performance | Queries, clicks, impressions, CTR, position | whole site, once data arrives |
| Settings, Crawl stats | How often Googlebot visits | whole site (works because this is a root address) |
| Removals | Temporarily hide a URL for about 6 months | try it on /lab/thin-content/ |

**Practise a fix:** pick a fault (for example the noindex page), ask the owner to remove the problem, then in Search
Console open that reason and click **Validate fix**. Validation takes up to about two weeks.

Also useful, outside Search Console:

- Rich Results Test: https://search.google.com/test/rich-results (try a recipe page, then the broken recipe page).
- PageSpeed Insights: https://pagespeed.web.dev (lab speed scores for any page).
- Screaming Frog SEO Spider, free up to 500 URLs: crawl the site and compare with the lab list.

---

## Part 4: Sharing access with more people

The verified owner can add others without any new code:
Search Console, **Settings, Users and permissions, Add user**, enter their Google email, then choose:

- **Owner**: can do everything, including sitemaps, removals and linking GA4. Best for a learner who needs everything.
- **Full**: sees all data and can request indexing.
- **Restricted**: mostly view only.

---

## Good to know

- It is a free `github.io` address. Google has said free subdomains make it harder to rank. That is fine here: the
  goal is to learn how Search Console works, not to win traffic.
- FAQ rich results no longer exist in Google (removed in 2026), so the site does not use them.
- Never buy fake traffic or links for the site. It breaks Google's rules and teaches nothing real.
- When practice is over, ask the owner to delete the lab pages or the whole repository.
