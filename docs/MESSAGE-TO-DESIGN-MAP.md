This is a change request for the gift estimate card generator, the project we have been building here. It replaces the earlier two-panel map row brief: instead of two panels of even weight, the card gets one map, and which map depends on how wide the request is. It comes from donor feedback (people who know their city want to see the actual ZIP boundary on real streets) and from a review with Matt, who chose the look. It also carries two smaller card changes and one new validator. Everything needed is in the repo, including a tested helper function.

Repo: https://github.com/chris-inv-am/gift-estimator
Research and option images: docs/MAP-RESEARCH.md and docs/map-research.html
Chosen look, full size: docs/poc/renders/A-60637-positron-single-zip.png
Helper, tested: docs/poc/detail-map.js (also at https://cdn.jsdelivr.net/gh/chris-inv-am/gift-estimator@main/docs/poc/detail-map.js)
Live demo of the helper: docs/poc/detail-map-test.html

PART 1. ONE MAP, CHOSEN BY THE REACH OF THE REQUEST

The map takes the whole area beside the numbers. Pick the first rule that fits:

a) One ZIP, or several ZIPs close together (same city or general area, frame under 60 km across): the street map. OpenStreetMap "Positron" basemap (light grey) with our ZCTA polygon(s) filled and outlined in brand navy, framed to the selection. No USA map. This is Option A, the one Matt chose. Streets, neighborhood names, parks and water come from the basemap.

b) A whole city or a whole county: the same street map, framed to the city or county outline (drawn as a dashed navy line), with its ZIPs filled. No USA map. The helper's frame option does this. If the outline is missing (the 8 old Connecticut counties, about 25 dissolved cities), frame to the ZIPs instead.

c) A whole state: the state outline panel, as the card draws it today, filling the map area. No USA map.

d) ZIPs or places far apart, in different states or more than 60 km across: the current USA map with each location highlighted. This is the only case where the national map appears.

e) The basemap fails to load, or WebGL is missing: draw the outline-only panel for that geography (ZIP outline, city, county) in the same space, with no OpenStreetMap credit line. The card is never blocked on the basemap.

Caption under the map stays as it is: "60637, within Chicago city limits", or the county or state name when the ZIP has no city.

Footnote: when the basemap is drawn (cases a and b), append exactly "Map data © OpenStreetMap contributors, © OpenMapTiles." Keep the Census sentences, including the ZCTA sentence; it now has a picture to point at.

Why this source: OpenStreetMap through OpenFreeMap is free, needs no key or account, has no usage limits, and permits commercial use. Nothing is pre-rendered or stored; the map is drawn in the browser when the card is made and baked into the PNG like everything else. Mapbox and Google were ruled out on their own terms (a card is stored and forwarded indefinitely; Mapbox caps caching at 30 days, Google forbids storing static map images).

How to build it:

1. Load MapLibre GL (open source, UMD) next to d3 and html2canvas:
     <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
     <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
   and docs/poc/detail-map.js from the repo. It exposes one function, renderDetailMap.

2. For cases a and b:
     const png = await renderDetailMap({ zips: card.zipList, frame: cityOrCountyOutlineOrUndefined, width: W, height: H });
     if (png) { put <img src=png> in the map area; append renderDetailMap.ATTRIBUTION to the footnote; }
     else { draw the outline-only panel (case e); }
   The helper fetches ZCTA polygons from geo/zcta/<prefix>.json (same sharding as data/), frames to the selection or to the frame outline with 12% padding, draws the fill (18% navy) and 3 px navy line, waits for tiles, and returns a PNG data URL at 2x. It returns null for WebGL missing, tiles not arriving within 6 seconds, or a frame wider than 60 km. Null means fall back and do not add the credit line. Width and height are yours; the area beside the numbers is 400 px wide today, and the map should fill whatever that area becomes.

3. Export: the returned PNG is a plain <img>, so html2canvas captures it with no special handling. Do not try to capture the live MapLibre canvas; the helper does the copy and disposes the map.

Tested from the CDN copy of the repo: 60637 alone, three Chicago ZIPs, 90210, and all 57 Chicago ZIPs framed to the city outline each render in about a second; Chicago plus Peoria correctly returns the fallback signal.

PART 2. TWO CARD CHANGES

- Remove the red markers for ZIP codes that have no median family income estimate. Keep the written disclaimer on the card exactly as it is; only the red visual highlighting goes.
- Nothing else about the numbers, parser, exports or the Census footnote sentences changes in this request. The parser fixes remain a separate list.

PART 3. MINIMUM REACH VALIDATOR

Add a rule to the estimator: if the children reached on the card is below 5,000, the card still renders and can be looked at, but

- a note appears on the estimator page (not necessarily on the card): "The minimum gift reach is 5,000 children. Widen the area or the age range to send this card."
- Share, Copy image, Open image, Download PNG and Print are disabled while the count is below 5,000. The link button can stay, since the link is just the request text.
- the readout's Where or Children cell should make the shortfall visible, the same way it flags a missing gift amount today.

The threshold should be one named constant so it can be changed later without a hunt.

WHAT IS NOT CHANGING

The numbers, the parser (separate fix list), the exports' mechanics, and the Census footnote sentences. The data layer already had every polygon the maps need; nothing was added to data/ or geo/ for this.

Anything unclear, ask me before assuming.
