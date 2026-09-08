Hey. The data build is done, plus one addition you did not ask for but will want. Everything is in the repo, public, built from published federal data.

Repo: https://github.com/chris-inv-am/gift-estimator
Handoff with mockups: https://claude.ai/code/artifact/9c4bbb0d-f17c-4c05-a4b9-38e39f4abe3c
Same content as plain text in the repo: docs/HANDOFF.md

What is there

1. data/ as specified. 33,772 ZCTAs, 894 shards by 3-digit prefix, manifest.json has the counts. Your lib/apportion.js is unchanged and its six tests pass. One fix: the kit had no package.json, so Node would not load the modules. I added one. No logic changed.

2. The ZIP crosswalk (extract/zip_places.csv) is built from the Census 2020 ZCTA relationship files, not HUD. Each ZIP takes the city and county holding the largest share of its land. 90210 comes out as Los Angeles rather than Beverly Hills; that is the known trade-off. The area column is blank pending the neighborhood decision.

3. New: geo/. Boundary outlines as GeoJSON for every city, county and state, every ZCTA, and a national map file. Keys match data/index.json exactly, so "Chicago, Illinois" resolves to an outline with no new matching logic. ZIP shapes shard by 3-digit prefix like the numbers. Details and the fetch sequence are in the handoff.

Reconciliation so far: the v5 card for 60637 shows 12,059 children and $3,014,750. Both match the raw Census brackets exactly. Median family income matches the row.

The design ask

With real boundaries, the small state thumbnail can become a real detail panel: city outline, the city's ZIPs tinted, the selected ZIPs filled. The handoff proposes giving the national map and the detail panel even visual weight. The arrangement is your call: side by side, stacked, or a diagonal offset. The mockup shows side by side only to illustrate the weighting. The detail panel should never be the smaller of the two.

It also gives a ten-rule fallback ladder for when the detail view is not honest (two-state selections, whole states, rural ZIPs with no city, missing outlines, selections too small to see). First matching rule wins. Every fallback changes the caption, and the map shades only what is counted, so suppressed ZIPs are outlined, never filled.

Still open, not mine to guess: the footnote validation sentence, and whether the area column is national or pilot cities only. The sample flag stays on until the dashboard reconciliation is recorded.

Anything unclear, ask me before assuming.
