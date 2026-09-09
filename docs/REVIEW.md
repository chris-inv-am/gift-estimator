# Estimator review and data test, 8 September 2026

Reviewed: the v5 build of the gift estimate card generator (the "Drafts (5)" export, byte-identical to the live Netlify site at the time of review). The bundle was decoded into its three parts: the data layer (`zip-data`, 682 lines), the card renderer, and the page script. Libraries: d3 7.9, topojson-client 3.1, html2canvas 1.4.1.

Illustrated version: `docs/review.html`.

## Verdict in one paragraph

The numbers are right. Every one of 40 randomly chosen ZIP codes matches the Census API exactly, and the summed totals for Chicago, Cook County and Illinois land within 0.3% of the Census's own direct estimates. The card's arithmetic is correct, the CDN serves the committed data unchanged, the page throws no errors, the map draws, and the PNG export works. The problems are in the sentence parser. About a third of the phrasings in a 96-query battery produced a card that was silently wrong, either the wrong place, the wrong ages, or the wrong dollar figure, with no warning on the card. Five of those are the kind of thing a chair could plausibly type. They should be fixed before a card reaches a donor's text thread.

## What was tested

| Test | Result |
|---|---|
| The data layer's own 43 built-in tests, against the live CDN | 43 of 43 pass |
| Same tests against the local repo data after today's fix | 43 of 43 pass |
| 96-query battery of common phrasings and edge cases | 27 silent wrong or silently ignored, 20 honest refusals, rest correct |
| 40 random ZCTAs vs Census API, four age brackets and income | 40 of 40 exact |
| Chicago children 0 to 17, sum of assigned ZIPs vs Census direct estimate | 537,496 vs 536,064 (+0.3%) |
| Cook County, same | 1,113,336 vs 1,110,965 (+0.2%) |
| Illinois, same | 2,808,854 vs 2,808,879 (0.0%) |
| jsDelivr CDN: index, manifest, shards vs repo | Byte-identical, CORS open, cached 12 h |
| Live page: console errors, fonts, map, sample badge | None, loaded, drawn, off |
| PNG export via html2canvas at 2x | 2160 x 2154 px, 405 KB, map and logos present |
| Picker flows: Springfield chips, New York state-or-city chips | Rewrite the request correctly |

## Findings, ranked

### A. Wrong number, no warning on the card. Fix first.

**A1. Two ZIP codes joined by "and" count only 17-year-olds.**
"$250 per child in 60637 and 60649" returns ages 17 to 17, 1,335 children, $333,750. The correct answer is 22,408 children. "ZIP codes 60637 and 60649" does the same. "60637-1234" (a ZIP+4) returns ages 12 to 17.
Cause: the age-range pattern `(\d{1,2}) (to|through|-|and) (\d{1,2})` has no word boundaries, so it matches "37 and 60" inside the two ZIP codes, then clamps 37 and 60 to 17.
Fix: strip 5-digit tokens before parsing ages, and put word boundaries on both numbers.

**A2. "for" after the place throws the geography away, or lands in Kentucky.**
"$250 per child in Chicago for kids 3-10" returns no ZIP codes. "$250 per child in Chicago for ages 3 to 10" returns ZIP code 40828, which is Ages, Kentucky, 466 children.
Cause: the geography clause is everything after the last locative preposition, and "for" is in that list. The clause becomes "ages 3 to 10", and "ages" is a real town that opens the clause.
Fix: remove "for" from the preposition list, or try clauses from last to first and keep the first that resolves. Also block town names that collide with grammar words (ages, kids) unless a state follows.

**A3. An unrecognized city falls through to the whole state.**
"$250 per child in Saint Louis, Missouri" returns Missouri, 1,035 ZIP codes, 1,386,612 children. The user asked for a city of 19 ZIPs. Before today's data fix, "Lexington, Kentucky" returned all of Kentucky the same way.
Cause: when the city name is not a key, the state name in the same phrase matches on its own and wins.
Fix: if the clause has leftover words before the state match, refuse and suggest instead of widening. On the data side I have now added everyday names for consolidated cities (see section D), which removes the most common triggers. "Saint" versus "St." is still a parser gap.

**A4. Two places named, only the last one counted.**
"$250 per child in Chicago and Evanston, Illinois" returns Evanston only, 3 ZIPs. "Cook County and Lake County, Illinois" returns Lake County only. "Chicago and Peoria" returns the Peoria picker with Chicago gone.
Cause: the matcher keeps one best place.
Fix: detect "and" or a comma between two resolved places and either union them or refuse with a message.

**A5. Total budgets and "million" read as a per-child gift.**
"$1 million for kids in Chicago" returns $1 per child, $537,496 total. "$250,000 total for kids in 60637" returns $250,000 per child, $3,014,750,000 total.
Fix: parse million and billion; when "total" or "budget" appears, either refuse or divide by the child count and label the card accordingly.

### B. Refuses or quietly ignores when it should work

**B1. A gift that is the prefix of the income cutoff disappears.** "$50 per child in Illinois under $50,000 median family income" returns "Add a gift amount". Same for $45 with $45,000 and $100 with $100,000. Cause: the gift loop skips any amount whose digits appear as a substring of the income clause. Fix: compare match positions, not substrings.

**B2. State abbreviations are not understood.** "Peoria, IL", "Springfield, IL" and "Cook County, IL" all produce pickers. "Washington, DC" offers Washington, Pennsylvania. "NYC" and "LA" return nothing. The handoff promised "Peoria, IL". The code comment says abbreviations are "derived on first use", but nothing derives them. Fix: build the abbreviation map from the state list at load time; add DC, NYC, LA as aliases.

**B3. Seventeen bare state names produce a state-or-city picker** because a small town shares the name: Indiana, California, Florida, Ohio, Washington, Kansas, Nevada, Oregon, Wyoming, Delaware, Virginia, Iowa, Louisiana, Tennessee, Vermont, Maine, New Hampshire. Honest, but heavy. Suggest: the state wins when the same-named city is small (say under 10 ZIPs); keep the picker for New York and Washington, where the city is large.

**B4. The "PG County" alias is dead.** The alias targets "Prince Georges County, Maryland" but the index key keeps the apostrophe. Fix the alias or normalize both.

**B5. Age words that silently default to 0 to 17:** "5 and up", "5+", "newborns", "teens", "3 thru 10". The card does show "0 to 17", so it is visible, but nothing says the phrase was not understood. Suggest: recognize "and up", "+", "thru"; flag other age words.

**B6. Income words that are silently ignored:** "below $45,000 MFI" and "low income ZIP codes in Chicago" both return the whole city. Suggest: accept MFI; refuse "low income" with a hint to name a figure.

**B7. Neighborhood plus city name reaches the wrong state.** "Hyde Park Chicago" offers Hyde Park, Pennsylvania and Utah. "Lincoln Park, Chicago" offers New Jersey and Michigan. The neighborhood guard only knows compass words and downtown. Suggest: when a resolved city also appears in the clause next to another matched place, treat it as a neighborhood and refuse the way "south side" is refused.

**B8. New York boroughs.** "Brooklyn" offers Brooklyn, Ohio and Indiana; "Manhattan" offers Kansas; "the Bronx" returns nothing. All New York City ZIPs carry the city name "New York". Data-side option below.

### C. Code review, not reproduced but real

**C1. A failed shard fetch is swallowed.** `loadShards` catches any fetch error and returns an empty list, so a statewide request that loses one of its 60 shard fetches produces a smaller number with no note. This is the one code path that can print a wrong figure with nothing visible. Surface the failure on the card or fail the request.

**C2. The sample flag is already off.** `sample: false` is hard-coded, so the "Sample data" badge never renders. The handoff said it stays on until reconciliation is recorded. This document is that record, so leaving it off is now defensible, but make it a deliberate decision rather than a default.

**C3. "Median family income" on multi-ZIP cards is the median of ZIP medians,** unweighted. Not wrong, but the footnote should say "median across the ZIP codes shown" so it is not read as the area's household median.

**C4. The income filter silently drops ZIPs with no income estimate.** 3,689 ZCTAs nationally have none. Add a note, as the age-gap note already does.

**C5. Age clamping is silent.** "ages 12 to 25" becomes "12 to 17" on the card with no note.

**C6. CDN caching.** The data is read from jsDelivr at `@main`, cached for 12 hours. After any data push, cards can read stale data for up to 12 hours unless the cache is purged (I purged today's files). Recommend pinning to a commit or release tag and bumping on purpose. That also makes any printed card reproducible.

**C7. Map basemap** comes from us-atlas on jsDelivr at render time and degrades to "Map unavailable" if it fails. Fine. The repo's own `geo/` layer can replace it when the two-panel map lands.

**C8. Export** uses html2canvas at 2x with embedded fonts and data-URI logos. Verified working. Actual file save and clipboard depend on the viewer's browser and the page's toasts already explain the fallbacks.

### D. Data layer results and today's fix

- 40 random ZCTAs: single-year ages sum back to the published brackets exactly, incomes match.
- No ZCTA has a suppressed age bracket in this vintage. 3,689 have no income estimate.
- Every row has a state; 28,791 of 33,772 have a city.
- **Fixed today:** consolidated city-counties carried Census legal names nobody types. Nashville-Davidson, Louisville/Jefferson County (also split across two names), Urban Honolulu, Boise City, Lexington-Fayette, Augusta-Richmond County, Athens-Clarke County, Macon-Bibb County and a few smaller ones are now indexed under their everyday names in both `data/` and `geo/`. The alias table is in `extract/make_zip_places.mjs`. Rebuilt, pushed, CDN purged. Nashville, Tennessee now resolves to 28 ZIPs and Louisville, Kentucky to 35.

**Data-side options still open**
- New York City boroughs could go into the `area` column from the county field (Kings is Brooklyn, New York County is Manhattan, and so on). That would make "Brooklyn" resolve through the existing area index with no parser change. It is a decision because `area` was reserved for the neighborhood question.
- Chicago community areas, same column, if pilot cities are chosen.

## Reproducing

The battery and the reconciliation are two scripts. Both run in Node against the decoded data layer, one against the live CDN and one against local `data/`. Ask and I will add them to the repo under `test/`.
