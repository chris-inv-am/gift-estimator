#!/usr/bin/env node
/* One-time build: Census API -> data/ shards the card generator reads.

   Usage:
     export CENSUS_API_KEY=your_key        # free: api.census.gov/data/key_signup.html
     node extract/build.mjs                # whole country
     node extract/build.mjs --states IL,MD # pilot subset

   Writes:
     data/index.json        place index (city, area, county, state -> ZIP prefixes)
     data/<prefix>.json     row shards, one file per 3-digit ZIP prefix
     data/manifest.json     vintage, row count, build date, variable list

   Everything written is public federal data. No secrets in the output.
*/
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { apportionAges } from '../lib/apportion.js';

const VINTAGE_YEAR = 2023;
const VINTAGE_LABEL = '2019 to 2023 ACS 5-year';
const KEY = process.env.CENSUS_API_KEY;
if (!KEY) {
  console.error('Set CENSUS_API_KEY first. Free key: https://api.census.gov/data/key_signup.html');
  process.exit(1);
}

// B01001 sex by age. Children are four brackets per sex; male + female are added.
const AGE_VARS = {
  under5: ['B01001_003E', 'B01001_027E'],
  a5to9: ['B01001_004E', 'B01001_028E'],
  a10to14: ['B01001_005E', 'B01001_029E'],
  a15to17: ['B01001_006E', 'B01001_030E']
};
const INCOME_VAR = 'B19113_001E'; // median family income
const flatVars = [...Object.values(AGE_VARS).flat(), INCOME_VAR];

function num(v) {
  // Census sends null, '', or large negative annotation codes for suppressed.
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= -666666666) return null;
  return n;
}

function addPair(a, b) {
  const x = num(a), y = num(b);
  if (x === null || y === null) return null; // a suppressed half suppresses the whole
  return x + y;
}

async function api(qs) {
  const url = 'https://api.census.gov/data/' + VINTAGE_YEAR + '/acs/acs5?' + qs + '&key=' + KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Census API ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

/* 1. ACS pull, all ZCTAs in one call */
console.log('Pulling ACS ' + VINTAGE_YEAR + ' for all ZCTAs...');
const raw = await api('get=NAME,' + flatVars.join(',') + '&for=zip%20code%20tabulation%20area:*');
const idx = Object.fromEntries(raw[0].map((h, i) => [h, i]));
console.log('  ' + (raw.length - 1) + ' ZCTAs');

/* 2. Gazetteer join for centroids */
const GAZ = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/' + VINTAGE_YEAR +
  '_Gazetteer/' + VINTAGE_YEAR + '_Gaz_zcta_national.zip';
let centroids = {};
try {
  const txt = await readFile(new URL('./gaz_zcta.txt', import.meta.url), 'utf8');
  for (const line of txt.split('\n').slice(1)) {
    const p = line.trim().split('\t');
    if (p.length < 6) continue;
    centroids[p[0].trim()] = { lat: +p[p.length - 2], lon: +p[p.length - 1] };
  }
  console.log('  ' + Object.keys(centroids).length + ' centroids joined');
} catch {
  console.warn('  extract/gaz_zcta.txt missing. Download ' + GAZ + ', unzip, and place the .txt there.');
  console.warn('  Rows will have null lat/lon and the map will not plot.');
}

/* 3. ZIP to city, county, state crosswalk.
   The ACS NAME for a ZCTA is just "ZCTA5 60637" and carries no place name, so
   city and county come from a crosswalk CSV. This is what makes "Peoria" and
   "Cook County" resolve in the estimator. */
let places = {};
try {
  const csv = await readFile(new URL('./zip_places.csv', import.meta.url), 'utf8');
  const lines = csv.trim().split('\n');
  const cols = lines[0].split(',').map(s => s.trim());
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map(s => s.trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] || '']));
    if (row.zip) places[row.zip.padStart(5, '0')] = row;
  }
  console.log('  ' + Object.keys(places).length + ' ZIP place names joined');
} catch {
  console.warn('  extract/zip_places.csv missing. Only ZIP and state lookups will work.');
}

/* 4. Assemble rows */
const only = (() => {
  const i = process.argv.indexOf('--states');
  return i === -1 ? null : new Set(process.argv[i + 1].split(',').map(s => s.trim().toUpperCase()));
})();

const rows = [];
for (const r of raw.slice(1)) {
  const zip = r[idx['zip code tabulation area']];
  const place = places[zip] || {};
  if (only && !only.has((place.state_abbr || '').toUpperCase())) continue;
  const brackets = [
    addPair(r[idx[AGE_VARS.under5[0]]], r[idx[AGE_VARS.under5[1]]]),
    addPair(r[idx[AGE_VARS.a5to9[0]]], r[idx[AGE_VARS.a5to9[1]]]),
    addPair(r[idx[AGE_VARS.a10to14[0]]], r[idx[AGE_VARS.a10to14[1]]]),
    addPair(r[idx[AGE_VARS.a15to17[0]]], r[idx[AGE_VARS.a15to17[1]]])
  ];
  const c = centroids[zip] || {};
  const row = {
    zip,
    city: place.city || '',
    area: place.area || '',
    county: place.county || '',
    state: place.state || '',
    state_abbr: place.state_abbr || '',
    lat: c.lat ?? null,
    lon: c.lon ?? null,
    median_family_income: num(r[idx[INCOME_VAR]]),
    acs_vintage: VINTAGE_LABEL
  };
  apportionAges(brackets).forEach((v, i) => { row['age_' + i] = v; });
  rows.push(row);
}
console.log('Assembled ' + rows.length + ' rows');

/* 5. Shard by 3-digit prefix and build the place index */
const shards = {};
const index = { cities: {}, areas: {}, counties: {}, states: {} };
function note(bucket, key, prefix) {
  if (!key) return;
  const b = index[bucket];
  b[key] = b[key] || [];
  if (!b[key].includes(prefix)) b[key].push(prefix);
}
for (const row of rows) {
  const prefix = row.zip.slice(0, 3);
  (shards[prefix] = shards[prefix] || []).push(row);
  if (row.city && row.state) note('cities', row.city + ', ' + row.state, prefix);
  if (row.area && row.city) note('areas', row.area + ', ' + row.city, prefix);
  if (row.county && row.state) note('counties', row.county + ', ' + row.state, prefix);
  if (row.state) note('states', row.state, prefix);
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
for (const [prefix, list] of Object.entries(shards)) {
  await writeFile(new URL('../data/' + prefix + '.json', import.meta.url), JSON.stringify(list));
}
await writeFile(new URL('../data/index.json', import.meta.url), JSON.stringify(index));
await writeFile(new URL('../data/manifest.json', import.meta.url), JSON.stringify({
  acs_vintage: VINTAGE_LABEL,
  vintage_year: VINTAGE_YEAR,
  built: new Date().toISOString(),
  rows: rows.length,
  shards: Object.keys(shards).length,
  variables: flatVars,
  apportionment: 'uniform within published bracket, remainder to earliest years',
  sample: false
}, null, 2));

console.log('Wrote data/: ' + Object.keys(shards).length + ' shards, ' + rows.length + ' rows');
console.log('Reconcile against the dashboard before the sample flag comes off.');
