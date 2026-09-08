# Gift estimate card: data and boundary handoff

For the Claude Design side of the generator. Everything below is in this repo,
public, built from published federal data, rebuilt with one command per layer.

Repo: https://github.com/chris-inv-am/gift-estimator
Illustrated version with the map-row mockup and fallback tiles rendered from the repo's own geo files: `docs/handoff.html` (open locally) or https://claude.ai/code/artifact/9c4bbb0d-f17c-4c05-a4b9-38e39f4abe3c

## 1. What is in the repo

| Folder | What | Built by |
|---|---|---|
| `data/` | Child counts by single year of age, median family income, ZIP centroid, city/county/state for 33,772 ZCTAs. Sharded by 3-digit ZIP prefix. `manifest.json` has vintage and counts. | `extract/build.mjs` (the kit script) |
| `extract/zip_places.csv` | ZIP to city, county, state crosswalk. Built from the Census 2020 ZCTA relationship files, not the HUD crosswalk. | `extract/make_zip_places.mjs` |
| `geo/` | Boundary outlines as GeoJSON: every city, county and state, every ZCTA, plus a national map file. | `extract/make_geo.mjs` |
| `lib/apportion.js` | The one modeling assumption, unchanged from the kit. Tests pass. | kit |
| `package.json` | Added so Node treats the `.js` files as ES modules. The kit did not run without it. No logic changed. | — |

Reconciliation so far: the v5 card for ZIP 60637, ages 0 to 17 at $250, shows 12,059 children and $3,014,750. Both match the four raw Census brackets exactly (2,942 + 3,645 + 2,972 + 2,500) and the row in `data/606.json`. Median family income on the card matches too.

## 2. The geo layer

All files are GeoJSON, WGS84 longitude/latitude, coordinates rounded to 4 decimals (about 11 m). Shapes are the Census 1:500,000 cartographic boundaries, simplified a further 25% for thumbnail rendering. Not for legal boundary use.

```
geo/us.json                      all states, one small file (~250 KB) for the national panel
geo/states/IL.json               one state outline, with bbox
geo/counties/IL/index.json       "Cook County, Illinois" -> { geoid, file, bbox }
geo/counties/IL/17031.json       one county outline
geo/places/IL/index.json         "Chicago, Illinois" -> { geoid, file, bbox }
geo/places/IL/1714000.json       one city outline (~3 KB)
geo/zcta/606.json                every ZCTA shape with prefix 606, props { zip }
geo/index.json                   source, vintage, feature counts, state list
```

Design rules that matter for integration:

- **Keys match `data/index.json` exactly.** The generator already resolves "Chicago, Illinois" and "Cook County, Illinois" to ZIP prefixes. The same string, looked up in the state's geo index, gives the outline file. No new matching logic. The state is in the key, so you know which state index to read.
- **ZIP shapes shard like the numbers.** A request for 60637 reads `data/606.json` and `geo/zcta/606.json`. One prefix file is 20 to 200 KB.
- **The city outline is context; the crosswalk is the truth.** Which ZIPs count toward "Chicago" is decided by the `city` column in the data rows. Draw the outline on top of the shaded ZIPs. A ZIP assigned to Chicago can poke outside the city line (60707 straddles Elmwood Park). That is expected, and it is honest: the count includes that whole ZIP.
- **ZCTA shapes are the 2020 vintage** because that is the only vintage the Census publishes them for, and it is the ZCTA definition the 2019 to 2023 ACS uses. Shapes and numbers describe the same ZIP.
- **`bbox` is `[west, south, east, north]`** on every index entry and every state file, so you can frame a panel before the shape loads.

Fetch sequence for a card:

1. Parser resolves the request to a set of ZIPs plus the geography named (ZIP, city, county or state).
2. Load `data/<prefix>.json` for each prefix. Compute the numbers. Nothing here changes.
3. Pick the frame (section 4). Load its outline file and `geo/zcta/<prefix>.json` for the selected prefixes.
4. Render. If any geo fetch fails or returns nothing, fall back per section 4. Never render an empty panel.

## 3. Map row proposal: two panels, even weight

Today the card has one large US map with the state highlighted, and a small state thumbnail beneath it. Before real boundaries existed the thumbnail could only repeat what the big map already said, so it earned little space.

With boundaries, the two panels do different jobs:

- **National panel**: orientation. Where in the country. It is also the brand's frame; donors are national.
- **Detail panel**: the claim. Which part of which city the number describes. This is the panel a Chicago donor will actually look at.

Recommendation: give the two panels even visual weight. The arrangement is a design choice and stays open: side by side, stacked national over detail, or a diagonal offset where the detail panel sits down and to the right of the national one, as the current thumbnail does but at equal size. Whichever layout wins, the constraints are the same:

- The detail panel is never smaller than the national panel. When the request is a single city or smaller it may be the larger of the two, up to about 60/40.
- The detail panel gets a one-line caption naming exactly what is drawn ("60637, within Chicago city limits").
- The national panel keeps the state highlight and adds a dot at the selection, so the two panels visibly agree.
- The side-by-side mockup in `docs/handoff.html` illustrates the weighting, not the arrangement.

Rendering the detail panel:

- Frame = the smallest geography that contains every selected ZIP (section 4). Fit its bbox into the panel with 6 to 8% padding, centered. Use a plain equirectangular projection with the x axis scaled by cos(center latitude); at city scale it is indistinguishable from anything fancier.
- Draw order: frame fill (faint), all ZIPs belonging to the frame (light tint, hairline white borders), selected ZIPs (brand navy), frame outline on top (navy, 1.5 to 2 px).
- Selected ZIPs with a suppressed count (any null age in the selected range) are drawn outline-only or hatched, never filled. What is shaded must be what is counted. The footnote already says those children are not counted; the map should agree.

## 4. Fallback ladder

Work down this list and take the first rule that applies. "Frame" is the outline drawn behind the ZIPs.

1. **Selection spans more than one state**, or ZIPs are not near each other (bbox of the selection wider than about 3 degrees). Drop the detail panel. The national panel carries all the dots and takes the full row. This is the current single-map layout, so it is already built.
2. **Whole-state request.** Frame = state outline, no ZIP shading (1,400 shaded ZIPs is just a filled state). Detail panel shows the state alone, national panel highlights it. Same as today's state thumbnail, at the new size.
3. **Whole-county request.** Frame = county outline, the county's ZIPs tinted, the county's cities' outlines optional as hairlines.
4. **Whole-city request.** Frame = city outline, all of the city's ZIPs tinted (the 57 Chicago ZIPs, say). No single ZIP is emphasized.
5. **One or more ZIPs, all assigned to the same city.** Frame = city outline, those ZIPs filled navy, the rest of the city's ZIPs tinted. This is the 60637 case.
6. **ZIPs with no city, or assigned to different cities in one county.** Frame = county outline. Rural ZIPs have a blank `city` and this is where they land.
7. **ZIPs in different counties, one state.** Frame = state outline, selected ZIPs filled. If the selection is too small to see against a state (rule 9), draw a ring marker at each ZIP centroid instead of the shape.
8. **Frame outline missing.** Happens for the 8 old Connecticut counties (the state moved to planning regions in 2022, so the 2023 boundary file has no county polygons) and about 25 cities that dissolved or merged between 2020 and 2023 (Cahokia and Centreville, Illinois, are now Cahokia Heights). Step up one level: city to county, county to state. If the state file is missing too, drop the detail panel (rule 1).
9. **Selection too small to see.** Compute selected bbox area over frame bbox area. Above 0.5%, shapes read fine. Between 0.05% and 0.5%, fill the shape and add a ring marker at its centroid so the eye finds it. Below 0.05%, the shape is a speck: zoom the frame to the selection's bbox padded 4x, draw the frame outline clipped, and caption it "60637, near the center of Los Angeles" so the reader knows the frame is partial. For reference, 60637 is about 0.9% of Chicago's bbox (reads fine), 0.3% of Cook County's (ring marker), and 0.007% of Illinois's (zoom or marker).
10. **Anything the rules above do not settle.** State thumbnail, exactly as the card renders today. Say so in the caption ("shown at state level"). A vague map is better than a wrong one, and a wrong one is worse than none.

Two principles behind the ladder:

- **Never render an empty or partial panel silently.** Every fallback changes the caption.
- **The map must not claim more than the number does.** Shade only what is counted. Tint, do not fill, the ZIPs that give context.

## 5. Known gaps, all documented in the build scripts

- City and county for each ZIP come from the Census relationship files: each ZIP takes the place holding the largest share of its land area. Right for nearly all urban ZIPs. A ZIP whose postal name is a small city inside a larger one can flip; 90210 resolves to Los Angeles, not Beverly Hills.
- The `area` (neighborhood) column is blank nationwide, pending the decision below. Cities, counties and states resolve without it. Chicago publishes its 77 community areas on the city data portal; that is the source if "south side" becomes a drawn region as well as a count.
- Connecticut counties and the ~25 dissolved cities above have numbers but no outline.
- The national panel needs Alaska and Hawaii insets (and Puerto Rico if you show it). `geo/us.json` has every state and territory as its own feature; the inset placement is a rendering choice.

## 6. Still open, not ours to guess

- The footnote validation sentence. Currently "Validate before formal decisions." Legal or comms decide.
- Whether `area` is populated nationally or in pilot cities only.
- The "sample data" flag stays on the cards until the dashboard reconciliation is recorded. `manifest.json` says `sample: false` because the data is real; the card flag is a separate switch on the generator side.

## 7. Rebuild

```bash
export CENSUS_API_KEY=...        # free, api.census.gov/data/key_signup.html
npm test                         # apportionment tests
node extract/make_zip_places.mjs # needs the three relationship files in extract/raw/ (URLs in the script header)
node extract/build.mjs           # about 4 seconds, all ZCTAs
node extract/make_geo.mjs        # needs the three shapefiles in extract/raw/geo/ (URLs in the script header), about 20 seconds
```
