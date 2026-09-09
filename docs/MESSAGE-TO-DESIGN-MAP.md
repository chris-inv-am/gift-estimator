This is a change request for the gift estimate card generator, the project we have been building here. It follows the two-panel map row brief and the parser fix list, and it comes from donor feedback: people who know their city want to see the actual ZIP code boundary on a real street map, with neighborhood names, parks and water, the way a ZIP lookup site shows it. Matt has reviewed the options and chosen one. This message gives you the decision, the data, a tested reference implementation, and the rules.

Decision: Option A. The detail panel shows the selected ZIP alone on the OpenStreetMap "Positron" basemap (light grey), with our ZCTA polygon filled and outlined in brand navy. No color style, no city-context view.

Repo: https://github.com/chris-inv-am/gift-estimator
Research and the option images: docs/MAP-RESEARCH.md and docs/map-research.html
Reference implementation, tested: docs/poc/detail-map.js (also served at https://cdn.jsdelivr.net/gh/chris-inv-am/gift-estimator@main/docs/poc/detail-map.js)
Live demo page: docs/poc/detail-map-test.html
Chosen look, full size: docs/poc/renders/A-60637-positron-single-zip.png

WHY THIS SOURCE

Streets and labels come from OpenStreetMap through OpenFreeMap: free, no API key, no account, no usage limits, commercial use permitted. Nothing is pre-rendered or stored; the map is drawn in the browser when the card is made and baked into the PNG like everything else. The only obligation is a credit line on the card. Mapbox and Google were ruled out on their own terms: a card is stored and forwarded indefinitely, Mapbox caps caching of map content at 30 days, Google forbids storing static map images. OpenStreetMap data is licensed for exactly this use.

WHAT TO BUILD

1. Load MapLibre GL (open source, UMD) next to d3 and html2canvas:
     <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
     <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
   and docs/poc/detail-map.js from the repo. It exposes one function.

2. In the detail panel, for ZIP requests, call:
     const png = await renderDetailMap({ zips: card.zipList, width: 400, height: 400 });
     if (png) { insert <img src=png> into the panel; add renderDetailMap.ATTRIBUTION to the footnote; }
     else { draw the outline-only panel exactly as today; }
   The function fetches the ZCTA polygons from geo/zcta/<prefix>.json (same sharding as data/), fits the map to the selection with 12% padding, draws the polygon (fill 18% navy, 3 px navy line), waits for tiles, and returns a PNG data URL rendered at 2x. It returns null when WebGL is missing, tiles do not arrive within 6 seconds, or the selection is wider than 25 km. Null means: fall back, and do not add the credit line. The card is never blocked on the basemap.

3. Footnote. When the basemap is drawn, append exactly: "Map data © OpenStreetMap contributors, © OpenMapTiles." Keep the ZCTA sentence; it now has a picture to point at.

4. Export. The returned PNG is a plain <img>, so html2canvas captures it with no special handling. Do not try to capture the live MapLibre canvas; the helper already does the copy and disposes the map.

RULES, SLOTTED INTO THE EXISTING FALLBACK LADDER

- One ZIP: basemap, framed to the ZIP. This is Option A.
- Several ZIPs close together: same basemap, framed to the selection, while the selection is under 25 km across. The helper enforces the threshold. Beyond it, or in different counties or states, the existing outline rules apply.
- City, county, state requests: keep the outline-only panel. A basemap under a whole city is noise at card size.
- Basemap unavailable for any reason: outline-only panel, no credit line, caption unchanged.
- Caption stays "60637, within Chicago city limits" (or the county or state name when the ZIP has no city).
- Panel weight: the even-weight recommendation stands and gets stronger. A real map needs the room. Side by side, stacked or diagonal remains your call.

ONE OPTIONAL REFINEMENT

renderDetailMap accepts a neighbors list and tints those ZIPs faintly for context. Matt did not choose the city-context view, so leave neighbors empty for now. It is there if the design wants a hint of the surrounding ZIP grid later.

WHAT IS NOT CHANGING

The numbers, the parser, the national panel, the exports and the footnote's Census sentences. The data layer already has every polygon the map needs; nothing was added to data/ or geo/ for this.

Anything unclear, ask me before assuming.
