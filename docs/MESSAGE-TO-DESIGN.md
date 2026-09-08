This is a change request for the gift estimate card generator, the project we have been building here for a while. Nothing about the card's purpose changes: a prospect texts a plain-English question, the generator works out how many children and how much money, and produces a branded card. What changes is the map on the card, and the reason it can change is that the one-time Census data build you specified is now done and sitting in a repo, together with a second dataset you did not ask for: real city, county and ZIP boundaries.

Until now the card's map could only say "somewhere in Illinois," because the data had ZIP centroids and nothing else. Now it can show the outline of Chicago with the selected ZIP codes shaded inside it. That turns the small state thumbnail from decoration into the part of the card a Chicago donor actually looks at. So the ask is to redesign the map row around that, and this message gives you everything needed to do it: the data, the file layout, a mockup rendered from the real files, and the rules for when the detailed view should not be shown.

Repo: https://github.com/chris-inv-am/gift-estimator
Handoff with mockups: https://claude.ai/code/artifact/9c4bbb0d-f17c-4c05-a4b9-38e39f4abe3c
Same content as plain text in the repo: docs/HANDOFF.md

The design ask

Give the national map and the new detail panel even visual weight. The arrangement is your call: side by side, stacked national over detail, or a diagonal offset where the detail panel sits down and to the right of the national one, the way the current thumbnail sits but at equal size. The mockup shows side by side only to illustrate the weighting. Two constraints hold in any arrangement: the detail panel is never the smaller of the two, and it always carries a one-line caption naming exactly what is drawn.

The detail panel draws the smallest geography that contains the selected ZIPs (city, then county, then state), tints all of that geography's ZIPs, fills the selected ones in brand navy, and draws the outline on top.

The handoff includes a ten-rule fallback ladder for when that view is not honest: selections spanning two states, whole-state requests, rural ZIPs with no city, missing outlines, selections too small to see. First matching rule wins. Every fallback changes the caption, and the map shades only what is counted, so a ZIP with a suppressed count is outlined, never filled, and agrees with the footnote.

What is in the repo

1. data/ exactly as you specified. 33,772 ZCTAs, 894 shards by 3-digit prefix, manifest.json has the counts. Your lib/apportion.js is unchanged and its six tests pass. One fix: the kit had no package.json, so Node would not load the modules. I added one. No logic changed.

2. The ZIP crosswalk (extract/zip_places.csv) is built from the Census 2020 ZCTA relationship files, not HUD. Each ZIP takes the city and county holding the largest share of its land. 90210 comes out as Los Angeles rather than Beverly Hills; that is the known trade-off. The area column is blank pending the neighborhood decision.

3. geo/, the new part. Boundary outlines as GeoJSON for every city, county and state, every ZCTA, and a national map file. Keys match data/index.json exactly, so "Chicago, Illinois" resolves to an outline with no new matching logic. ZIP shapes shard by 3-digit prefix like the numbers, so a request for 60637 reads data/606.json and geo/zcta/606.json. The fetch sequence and draw order are in the handoff.

Reconciliation so far: the v5 card for 60637 shows 12,059 children and $3,014,750. Both match the raw Census brackets exactly. Median family income matches the row.

Still open, not mine to guess: the footnote validation sentence, and whether the area column is national or pilot cities only. The sample flag stays on until the dashboard reconciliation is recorded.

Anything unclear, ask me before assuming.
