# Building the real data

One command, run once a year. No database and no standing dev team.

## What you need

1. **Node 18 or newer.** Check with `node --version`.
2. **A free Census API key.** https://api.census.gov/data/key_signup.html — arrives by email in a minute.
3. **Two flat files the API does not serve.**
   - **ZCTA centroids.** `2023_Gaz_zcta_national.zip` from the Census gazetteer page. Unzip and put the `.txt` at `extract/gaz_zcta.txt`. Without it the map cannot plot dots.
   - **ZIP place names.** A CSV at `extract/zip_places.csv` with columns `zip,city,county,state,state_abbr,area`. The ACS record for a ZCTA is named only "ZCTA5 60637" and carries no city, so this file is what makes "Peoria" and "Cook County" resolve. Source it from the HUD USPS ZIP crosswalk or any ZIP-to-place list. `area` is optional and only needed for neighborhood phrases like "south side chicago".

## Run it

```bash
export CENSUS_API_KEY=xxxxxxxx
node --test lib/          # apportionment tests must pass first
node extract/build.mjs    # whole country, about a minute
```

Pilot subset instead:

```bash
node extract/build.mjs --states IL,MD,TX
```

## What it writes

```
data/index.json      place index: city, area, county, state -> ZIP prefixes
data/606.json        row shards, one per 3-digit ZIP prefix
data/manifest.json   vintage, row count, build date, apportionment note
```

Commit `data/` to the repo. It is published federal data, so a public repo is fine.

## Then

Connect the repo to this project and the estimator gets repointed from its sample table to `data/` in one sync. The parser, the math, the card layouts and the exports do not change.

## Before the sample flag comes off

Diff a build against the existing dashboard for a sample of ZIP codes and record the variance. Apportionment is the only modeling assumption on the card, and it is the thing that needs to reconcile.
