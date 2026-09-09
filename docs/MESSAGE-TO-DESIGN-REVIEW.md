This is a change request for the gift estimate card generator. It comes out of a full code review and data test of the v5 build (the current live Netlify version). The card layout, exports and map are not the subject here. The data is confirmed correct: 40 random ZIP codes match the Census API exactly, and Chicago, Cook County and Illinois totals land within 0.3% of the Census's own estimates. All 43 of your built-in tests pass. What needs to change is the sentence parser in the data layer (zip-data.js). A 96-phrase battery found five plausible phrasings that produce a finished-looking card with the wrong place, ages or dollars and no warning on it. Those are the ones a donor could act on, so they come first. Full write-up with every case reproduced:

Review page: https://claude.ai/code/artifact/693b45ad-9c9d-48e1-a40d-a5a266486592
Same as text in the repo: docs/REVIEW.md
Test scripts: test/battery.js (runs your runTests plus the 96 phrasings against the live CDN), test/reconcile.mjs (Census API check)

FIX FIRST: wrong number, no warning

1. Two ZIP codes joined by "and" count only 17-year-olds.
   "$250 per child in 60637 and 60649" -> ages 17 to 17, 1,335 children. Should be 0 to 17, 22,408.
   "$250 per child in 60637-1234" (a ZIP+4) -> ages 12 to 17.
   Cause: the age-range regex (\d{1,2})\s*(to|through|-|and)\s*(\d{1,2}) has no word boundaries and matches "37 and 60" inside the ZIPs, then clamps to 17.
   Fix: remove 5-digit tokens (and ZIP+4 suffixes) from the text before parsing ages, and add \b on both numbers.

2. "for" after the place drops the geography or lands in Kentucky.
   "$250 per child in Chicago for ages 3 to 10" -> ZIP code 40828, Ages, Kentucky.
   "$250 per child in Chicago for kids 3-10" -> No ZIP codes.
   Cause: geoClause() takes everything after the LAST locative preposition and "for" is in that list, so the clause becomes "ages 3 to 10", and Ages is a real town that opens the clause.
   Fix: drop "for" from the preposition list, or walk clauses from last to first and keep the first one that resolves. Also refuse single-word town names that collide with grammar words (ages, kids, normal, hope) unless a state follows.

3. An unrecognized city falls through to the whole state.
   "$250 per child in Saint Louis, Missouri" -> Missouri, 1,035 ZIPs, 1,386,612 children. The city is 19 ZIPs.
   Cause: when the city is not an index key, the state name in the same phrase matches on its own and wins.
   Fix: if the clause contains leftover words before the matched state, refuse and offer suggestions instead of widening. Also alias "Saint" to "St." in norm().
   Data side is already fixed for the worst triggers: Nashville, Louisville, Honolulu, Boise, Lexington, Augusta, Athens and Macon now carry their everyday names in data/index.json and the geo index, so "Lexington, Kentucky" no longer returns all of Kentucky.

4. Two places named, only the last one counted.
   "$250 per child in Chicago and Evanston, Illinois" -> Evanston only.
   "$250 per child in Cook County and Lake County, Illinois" -> Lake County only.
   Fix: when the clause holds two resolvable places separated by "and" or a comma, union their rows, or refuse with a message. Never drop one silently.

5. Total budgets and "million" read as a per-child gift.
   "$1 million for kids in Chicago" -> $1 per child, $537,496 total.
   "$250,000 total for kids in 60637" -> $250,000 per child, $3,014,750,000 total.
   Fix: parse "million" and "billion" in the gift regex. If "total", "budget" or "to give" precedes the amount without "per child" or "each", either refuse with a hint or divide by the child count and label the card as a per-child figure derived from a budget.

SECOND: refuses or quietly ignores when it should work

6. A gift equal to the income cutoff's prefix disappears. "$50 per child in Illinois under $50,000 median family income" -> "Add a gift amount". Same for $45/$45,000 and $100/$100,000. Cause: the gift loop skips any amount whose digits are a substring of the income clause. Compare match positions instead.

7. State abbreviations are not understood. "Peoria, IL", "Springfield, IL", "Cook County, IL" all return pickers. "Washington, DC" offers Washington, Pennsylvania. "NYC" and "LA" return nothing. The code comment says abbreviations are derived on first use but nothing does it. Build the abbreviation map from INDEX.states at load (the two-letter codes are in the crosswalk's state_abbr column, or hard-code the 52), add DC, NYC, LA as aliases, and when "City, XX" is present use XX to pick among same-named cities before showing a picker.

8. Seventeen bare state names produce a state-or-city picker because a small town shares the name: Indiana, California, Florida, Ohio, Washington, Kansas, Nevada, Oregon, Wyoming, Delaware, Virginia, Iowa, Louisiana, Tennessee, Vermont, Maine, New Hampshire. Suggest: the state wins when the same-named city has fewer than 10 ZIPs; keep the picker for New York and Washington.

9. The "PG County" alias is dead: it targets "Prince Georges County, Maryland" but the index key is "Prince George's County, Maryland". Normalize the alias target through norm() before lookup.

10. Age words that silently default to 0 to 17: "5 and up", "5+", "newborns", "teens", "3 thru 10". Recognize "and up", "and older", "+", "thru"; add a note when an age-like word is present but no range was parsed. Also add a note when a range is clamped ("ages 12 to 25" silently becomes 12 to 17).

11. Income words that are silently ignored: "below $45,000 MFI" and "low income ZIP codes in Chicago" both return the whole city. Accept MFI; refuse "low income" with a hint to name a figure.

12. Neighborhood plus city reaches the wrong state. "Hyde Park Chicago" offers Hyde Park, Pennsylvania and Utah; "Lincoln Park, Chicago" offers New Jersey and Michigan. When a resolved city name also appears in the clause next to another matched place, treat the other place as a neighborhood and refuse the way "south side" is refused.

13. New York boroughs: "Brooklyn" offers Ohio and Indiana, "Manhattan" offers Kansas, "the Bronx" returns nothing. Every NYC ZIP carries the city "New York". Cheapest fix is on the data side (boroughs into the area column from the county field); say if you want that.

CODE PATHS TO HARDEN

14. loadShards() catches a failed shard fetch and returns []. A statewide request that loses one of its sixty fetches prints a smaller number with no note. Surface it on the card or fail the request. This is the one place a wrong number can appear with nothing visible.

15. sample: false is hard-coded in buildCard, so the Sample data badge never renders. The reconciliation is now recorded in docs/REVIEW.md, so turning it off is defensible, but make it a deliberate switch.

16. "Median family income" on multi-ZIP cards is the unweighted median of ZIP medians. Add "median across the ZIP codes shown" to the footnote.

17. The income filter silently drops ZIPs with no income estimate (3,689 nationally). Add a note like the age-gap note.

18. Data is read from jsDelivr at @main, cached 12 hours. After any data push the app can read stale numbers until the cache is purged. Pin BASE to a commit or release tag and bump deliberately; that also makes a printed card reproducible.

REGRESSION CASES TO ADD TO runTests()

  '$250 per child in 60637 and 60649'                       -> ages '0 to 17', zipCount 2, childrenRaw 22408
  '$250 per child in 60637-1234'                            -> ages '0 to 17', zipCount 1
  '$250 per child in Chicago for ages 3 to 10'              -> title 'Chicago, Illinois', ages '3 to 10'
  '$250 per child in Chicago for kids 3-10'                 -> title 'Chicago, Illinois'
  '$250 per child in Saint Louis, Missouri'                 -> title 'St. Louis, Missouri' (not 'Missouri')
  '$250 per child in Chicago and Evanston, Illinois'        -> zipCount 60, or empty with a note; never Evanston alone
  '$1 million for kids in Chicago'                          -> not gift 1; refuse or derived per-child
  '$250,000 total for kids in 60637'                        -> not gift 250000
  '$50 per child in Illinois under $50,000 median family income' -> gift '$50'
  '$250 per child in Peoria, IL'                            -> title 'Peoria, Illinois'
  '$250 per child in Washington, DC'                        -> title 'Washington, District of Columbia'
  '$250 per child in California'                            -> title 'California' (state)
  '$250 per child 5 and up in 60637'                        -> ages '5 to 17'
  '$250 per child in Hyde Park Chicago'                     -> zipCount 0 with the neighborhood note
  '$250 per child in Nashville, Tennessee'                  -> zipCount 28 (data fix, already live)

Everything above was reproduced against the live CDN data with test/battery.js. Anything unclear, ask me before assuming.
