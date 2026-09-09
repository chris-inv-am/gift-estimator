# Street-level maps for the card: research and recommendation

9 September 2026. Question from donor feedback: a donor who knows their city wants to see the actual ZIP code boundary on a real map, with streets, parks, water and neighborhood names, the way a ZIP lookup site shows it. What we have today is our own outlines (ZIP, city, county, state) drawn on a blank ground. This memo covers what it would take to put those outlines on a real map, which data sources are honest to use for an image that gets texted to donors and kept, and what I built to test it.

Illustrated version with the proof-of-concept renders: `docs/map-research.html`. Live proof of concept you can open in a browser: `docs/poc/basemap-openfreemap.html`.

## The short answer

Use OpenStreetMap-based vector tiles from OpenFreeMap, rendered in the browser with MapLibre, with our own ZCTA and city polygons drawn on top, and our existing outline-only panel as the automatic fallback. It costs nothing, needs no API key or account, permits commercial use, and the only obligation is an OpenStreetMap credit line on the card. I built it and it produces exactly the picture the donor examples show, including the neighborhood labels (Hyde Park, Woodlawn), parks, the lakefront and the expressways. The two things it does not give us are a service guarantee, since the public server is volunteer-run, and a fully self-contained repo. Both are covered by the fallback and by a documented self-host path.

The paid commercial services are not the safe choice here, for a licensing reason rather than a cost one. A card is an image that is stored, forwarded and printed indefinitely. Mapbox's product terms cap client-side caching of map content at 30 days, and Google's forbid storing static map images at all. Neither fits a PNG in a donor's text thread without a license conversation. OpenStreetMap data, by contrast, is licensed for exactly this: you may distribute an image made from it as long as you credit the contributors.

## What the examples actually contain

The two reference images have four layers: a basemap (streets with names, parks, water, building footprints, neighborhood and place labels), a boundary polygon, a highlight fill, and a label. We already own the boundary and the fill: `geo/zcta/<prefix>.json` has the ZCTA polygon for every ZIP, and the city and county outlines are there too. The only missing layer is the basemap. So the question is narrower than it looks: where does the street-and-label layer come from, and is it licensed for a kept image.

One honesty note carried over from the card footnote. Both example sites draw USPS-style ZIP boundaries. Ours is the Census ZCTA, which is what the child counts describe. The card should keep saying so, and drawing the ZCTA on a real map makes the footnote easier to understand, not harder.

## Options, compared

| | Source of streets and labels | Cost | Key or account | Kept-image licensing | Neighborhood labels | Dependency at render time |
|---|---|---|---|---|---|---|
| **A. OpenFreeMap + MapLibre** | OpenStreetMap, OpenMapTiles schema | Free, no limits stated | None | Fine. ODbL produced work; credit OSM on the card | Yes | Public tile server, volunteer-run, no SLA; self-host possible |
| **B. Protomaps** | OpenStreetMap | Free non-commercial; commercial from about $14/month via GitHub sponsorship | Key | Fine, same as A | Yes | Hosted API, or self-host a PMTiles extract |
| **C. Geoapify Static Maps** | OpenStreetMap | Free 3,000 credits/day; paid above | Key | Fine. Their page explicitly allows caching, storing and redistributing with OSM attribution | Yes | Their API, one image URL per card |
| **D. Mapbox Static Images** | Mapbox (OSM plus proprietary) | 50,000 free/month, then $1 per 1,000 | Token | Problem. Product terms limit caching to 30 days on the requesting device | Yes | Their API |
| **E. Google Maps Static** | Google | $2 per 1,000 after credit | Key | Problem. Terms prohibit storing or caching static map images | Yes | Their API |
| **F. MapTiler, Stadia** | OpenStreetMap | Static maps not on free plans; Stadia from $20/month, free tier non-commercial | Key | Fine with attribution | Yes | Their API |
| **G. Esri static basemap tiles** | Esri | 2M tiles/month free | Key | Requires "Powered by Esri" credit; storage terms not confirmed | Partial | Their API |
| **H. Census TIGER only, self-hosted** | Census roads, water, landmarks | Free, public domain | None | No conditions at all | No, unless we add city data | None; but see size |

### A. OpenFreeMap with MapLibre, the recommendation

OpenFreeMap serves OpenStreetMap vector tiles in the OpenMapTiles schema from a public server with no registration, no key, no usage limits, and commercial use permitted. Required credit: "© OpenMapTiles © OpenStreetMap contributors". It ships five styles; Positron is a light grey base that sits well under the brand navy, and it is what the proof of concept uses. Liberty is a more colorful alternative.

Rendering happens in the browser with MapLibre GL, an open-source library. The card already runs d3 and html2canvas in the browser, so this is one more script. The map draws into a canvas; before export, that canvas is copied into an image so html2canvas captures it. The proof of concept does this and the export works.

Risks and how they are covered:

- No SLA. The operator is one person running dedicated servers funded by sponsorship. If tiles fail to load, the card must not show a blank panel. The existing fallback ladder already says what to do: draw the outline-only detail panel from our own geo files, which needs no network beyond the repo. The generator should wait for the map's idle event with a timeout of a few seconds and fall back on timeout.
- Self-hosting. OpenFreeMap publishes weekly full-planet images and the server setup is open source. A more practical middle step is Protomaps (option B): cut a US-only PMTiles extract, host the single file on any static host or CDN, and point MapLibre at it. That removes the volunteer dependency for a few dollars a month. Either can be done later without changing the card.
- WebGL. MapLibre needs WebGL, which every current phone and desktop browser has. If it is absent, fall back the same way.

### B. Protomaps

Same data and rendering model as A, run by a small company with a hosted API and a self-host escape hatch. The hosted API needs a key and is free for non-commercial use only; commercial use is through GitHub sponsorship starting around $14 a month. Its real value to us is the self-host path: one PMTiles file per region, served as a static file. Good second step if A's public server ever becomes a concern.

### C. Geoapify Static Maps

The simplest possible integration: one URL returns a finished PNG with our polygon drawn on it, up to 4,096 pixels, with a GeoJSON overlay parameter. Their published terms explicitly allow caching, storing and redistributing the images with OpenStreetMap attribution, which is the right posture for a kept card. Free tier is 3,000 credits a day, which is far more cards than we will make. Costs: a key exposed in the client (restrictable by domain), and a dependency on a small vendor for every card. A reasonable choice if the design side would rather not run MapLibre. I did not build this one because it needs an account.

### D and E. Mapbox and Google

Both produce beautiful maps and both are the wrong fit for this artifact. Mapbox's product terms allow map content to be cached on the requesting device for at most 30 days and require the cache to be populated by that device's own API requests. A PNG card forwarded by text to a donor is neither. Google's terms prohibit storing or caching static map images outside narrow exceptions. Either could be licensed for print or offline use through their sales teams, but that is a contract, not a checkbox.

### F and G. MapTiler, Stadia, Esri

MapTiler does not offer static maps on its free plan. Stadia's free tier is non-commercial and static maps start at $20 a month. Esri's ArcGIS Location Platform gives 2 million basemap tiles a month free with a "Powered by Esri" credit, but I did not confirm its terms on stored images. All three are viable paid alternatives to A if a contract is preferred over a volunteer service; none is better than A for our need.

### H. Census TIGER only, fully self-hosted

I built this too, because it is the only option with zero outside dependency and zero licensing conditions. TIGER/Line publishes every road (with names and classes), every water body, and area and point landmarks (parks, campuses, cemeteries, hospitals, stations, museums). Clipped to the 60637 area and drawn by the same SVG pipeline that draws the card today, it gives a recognizable map: Washington Park, the University of Chicago, the Midway Plaisance, Jackson Park, the Museum of Science and Industry, the Dan Ryan and the Skyway, the lakefront.

What it lacks: neighborhood names (TIGER has none; Chicago's 77 community areas would have to come from the city data portal, and other cities vary), building footprints, and the visual polish of a designed basemap. What it costs in data: local roads are about 14 MB zipped for Cook County alone and several gigabytes nationally, too much to commit. It would work as pre-clipped bundles for pilot cities, or with primary and secondary roads only nationally (about 150 MB), which loses the neighborhood streets that make the map recognizable. The Census also runs a live query service (TIGERweb) that could fetch roads for a bounding box on demand with no key; my test queries returned errors, so I would not build on it without more investigation.

Verdict: keep H as the fallback aesthetic and as an enrichment source (parks and landmarks labels are good even on top of A), not as the primary.

## What the proof of concept shows

Three renders of ZIP 60637 on OpenFreeMap (two Positron, one Liberty) and one TIGER-only schematic, all with our ZCTA polygon drawn in brand navy. The Positron single-ZIP view matches the donor examples: the boundary, the neighborhood names inside it, the parks, the lake, the expressways. The Chicago-context view tints all 57 Chicago ZIPs, fills 60637, and draws the city line dashed, zoomed to the south lakefront. Files: `docs/poc/basemap-openfreemap.html` (open it in any browser; it loads tiles live) and `docs/poc/schematic-tiger-60637.svg`.

## What this means for the design brief

- **Single ZIP cards.** The detail panel becomes a real map: basemap, neighbor ZIPs tinted, the ZIP filled and outlined, framed to the ZIP with about 15% padding. Caption unchanged: "60637, within Chicago city limits".
- **Several ZIPs in one area.** Same treatment, framed to the selection's bounding box, as long as the selection is under roughly 25 km across. Beyond that the basemap stops adding information and the existing outline-only panel (city or county frame) is the better picture. That threshold slots into the fallback ladder as a new rule between the city-frame and county-frame rules.
- **City, county and state requests.** Keep the outline-only panel we have. A basemap under a whole city or state is visual noise at card size.
- **Footnote.** When a basemap is drawn, append "Map data © OpenStreetMap contributors, © OpenMapTiles." Keep the ZCTA sentence.
- **Failure.** If tiles do not load within a few seconds, or WebGL is missing, render the outline-only panel and drop the OSM credit. The card is never blocked on the basemap.
- **Panel size.** The even-weight recommendation stands and gets stronger: a real map needs the room. Side by side, stacked or diagonal remains the designer's call.

## What I can do on the data side now

- Nothing is required for option A beyond what is already in `geo/`. The proof of concept reads the repo's own polygons.
- Optional enrichment: TIGER area and point landmarks sharded by ZIP prefix (parks, campuses, hospitals, stations, about 100 MB nationally as GeoJSON) so the card can label landmarks in its own type even when the basemap is unavailable.
- Optional, pilot cities only: neighborhood polygons and names (Chicago community areas from the city data portal) into the `area` column and a `geo/areas/` folder. This is the same open decision as before, now with a concrete use.

## Sources

- OpenFreeMap: https://openfreemap.org (no key, no limits, commercial use permitted, required attribution, styles, self-hosting)
- Protomaps hosted API: https://protomaps.com/api and https://protomaps.com/blog/free-tier-maps/
- Geoapify Static Maps: https://www.geoapify.com/static-maps-api/
- Mapbox Static Images API: https://docs.mapbox.com/api/maps/static-images/ ; pricing https://www.mapbox.com/pricing ; Product Terms (30-day cache limit) https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf
- Google Maps Platform service terms on caching and storing: https://cloud.google.com/maps-platform/terms/maps-service-terms
- MapTiler Static Maps: https://docs.maptiler.com/cloud/api/static-maps/
- Stadia Maps pricing: https://stadiamaps.com/pricing/
- ArcGIS Location Platform pricing and static basemap tiles: https://location.arcgis.com/pricing/ and https://developers.arcgis.com/rest/static-basemap-tiles/
- Census TIGER/Line 2023 (roads, area water, landmarks): https://www2.census.gov/geo/tiger/TIGER2023/
- OpenStreetMap licence and attribution: https://www.openstreetmap.org/copyright
