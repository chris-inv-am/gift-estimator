#!/usr/bin/env node
/* Builds geo/ boundary files from Census cartographic boundary shapefiles.

   Inputs (extract/raw/geo/, downloaded from www2.census.gov/geo/tiger/GENZ2023/shp and GENZ2020/shp):
     place/cb_2023_us_place_500k.shp       every incorporated place and CDP
     county/cb_2023_us_county_500k.shp     every county
     zcta520/cb_2020_us_zcta520_500k.shp   every ZIP Code Tabulation Area. ZCTA shapes are only
                                           published for the 2020 vintage, which is the ZCTA
                                           definition the 2019-2023 ACS uses, so it matches data/.

   Output (GeoJSON, WGS84 lon/lat, coordinates rounded to 4 decimals, about 11 m):
     geo/places/<ST>/<geoid>.json    one city outline; props geoid, name, state, st
     geo/counties/<ST>/<geoid>.json  one county outline; props geoid, name, state, st
     geo/states/<ST>.json            one state outline (dissolved from counties); props st, name
     geo/us.json                     all states in one small file for the national map panel
     geo/zcta/<prefix>.json          all ZCTA outlines for one 3-digit ZIP prefix; props zip.
                                     Same sharding as data/, so a request for 60637 reads
                                     data/606.json for numbers and geo/zcta/606.json for shapes.
     geo/places/<ST>/index.json      "Chicago, Illinois" -> { geoid, file, bbox } for that state
     geo/counties/<ST>/index.json    "Cook County, Illinois" -> { geoid, file, bbox } for that state
                                     Keys match data/index.json exactly (the state is in the key, so the
                                     generator knows which state index to read). Names that carry a
                                     Census legal suffix are indexed both ways, so "Nashville-Davidson"
                                     and "Nashville-Davidson metropolitan government (balance)" both work.
                                     bbox is [west, south, east, north].
     geo/index.json                  small: source, vintage, sharding notes, feature counts, state list

   Shapes are simplified for thumbnail rendering. Not for legal boundary use.
   Requires network the first time (npx fetches mapshaper).
*/
import { execFileSync } from 'node:child_process';
import { mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { EVERYDAY } from './make_zip_places.mjs';

const root = new URL('../', import.meta.url).pathname;
const raw = root + 'extract/raw/geo/';
const stage = raw + 'stage/';
const out = root + 'geo/';
const SIMPLIFY = '25%';
const PRECISION = '0.0001';

function ms(args) {
  execFileSync('npx', ['--yes', 'mapshaper', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'], cwd: root,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' }
  });
}

function bbox(geom) {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = c => {
    if (typeof c[0] === 'number') { if (c[0] < w) w = c[0]; if (c[0] > e) e = c[0]; if (c[1] < s) s = c[1]; if (c[1] > n) n = c[1]; }
    else c.forEach(walk);
  };
  walk(geom.coordinates);
  return [w, s, e, n];
}

await rm(out, { recursive: true, force: true });
await rm(stage, { recursive: true, force: true });
await mkdir(out + 'zcta', { recursive: true });

// Same suffix list the crosswalk builder strips, so keys line up with data/index.json.
const LSAD = /\s+(city|town|village|borough|CDP|municipality|comunidad|zona urbana|urban county|consolidated government|metro government|metropolitan government|unified government|city and borough|town and borough|corporation|plantation|gore|grant|location|purchase|census area|charter township|township)(\s*\(balance\))?$/i;
const shortName = s => { const t = s.replace(LSAD, '').trim(); return (EVERYDAY[t] || t).replace(/,/g, ' '); };

const index = {
  states: [],
  zcta: { sharding: '3-digit ZIP prefix', file: 'zcta/<prefix>.json' },
  source: 'U.S. Census Bureau cartographic boundary files, 1:500,000. Places and counties 2023, ZCTA 2020.',
  simplified: SIMPLIFY, precision: PRECISION, built: new Date().toISOString(), features: {}
};

/* Places and counties: mapshaper writes one staging file per state, Node splits
   each into one file per feature and fills the index. Where a state has two
   features with the same name (a city and a same-named CDP, say), the index
   keeps the one with more land; both files are still written. */
for (const [layer, shp, nameField] of [
  ['places', 'place/cb_2023_us_place_500k.shp', 'NAME'],
  ['counties', 'county/cb_2023_us_county_500k.shp', 'NAMELSAD']
]) {
  console.log('Converting ' + layer + '...');
  await mkdir(stage + layer, { recursive: true });
  ms([raw + shp,
    '-simplify', SIMPLIFY, 'keep-shapes', 'weighted',
    '-each', 'geoid=GEOID, name=' + nameField + ', state=STATE_NAME, st=STUSPS, aland=ALAND',
    '-filter-fields', 'geoid,name,state,st,aland',
    '-split', 'st',
    '-o', stage + layer + '/', 'format=geojson', 'precision=' + PRECISION, 'id-field=geoid']);

  let count = 0, dupes = 0;
  for (const f of await readdir(stage + layer)) {
    const st = f.replace('.json', '');
    if (!index.states.includes(st)) index.states.push(st);
    const idx = {};
    const gj = JSON.parse(await readFile(stage + layer + '/' + f, 'utf8'));
    await mkdir(out + layer + '/' + st, { recursive: true });
    for (const ft of gj.features) {
      const p = ft.properties;
      const aland = p.aland; delete p.aland;
      const file = layer + '/' + st + '/' + p.geoid + '.json';
      await writeFile(out + file, JSON.stringify({ type: 'Feature', id: p.geoid, properties: p, geometry: ft.geometry }));
      count++;
      const entry = { geoid: p.geoid, file, bbox: bbox(ft.geometry).map(v => +v.toFixed(4)), _aland: aland };
      const keys = new Set([p.name.replace(/,/g, ' ') + ', ' + p.state, shortName(p.name) + ', ' + p.state]);
      for (const key of keys) {
        if (idx[key]) { dupes++; if (aland <= idx[key]._aland) continue; }
        idx[key] = entry;
      }
    }
    const clean = Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, { geoid: v.geoid, file: v.file, bbox: v.bbox }]));
    await writeFile(out + layer + '/' + st + '/index.json', JSON.stringify(clean));
  }
  index.features[layer] = count;
  console.log('  ' + layer + ': ' + count + ' files across ' + index.states.length + ' states, ' + dupes + ' same-name collisions resolved by land area');
}

/* States: dissolved from the county layer, so no extra download. Two levels of
   detail: one file per state for the fallback thumbnail, and one national file
   simplified harder for the small US panel. */
console.log('Converting states...');
await mkdir(out + 'states', { recursive: true });
await mkdir(stage + 'states', { recursive: true });
ms([raw + 'county/cb_2023_us_county_500k.shp',
  '-dissolve', 'STUSPS', 'copy-fields=STATE_NAME',
  '-each', 'st=STUSPS, name=STATE_NAME',
  '-filter-fields', 'st,name',
  '-simplify', SIMPLIFY, 'keep-shapes', 'weighted',
  '-split', 'st',
  '-o', stage + 'states/', 'format=geojson', 'precision=' + PRECISION, 'id-field=st']);
for (const f of await readdir(stage + 'states')) {
  const gj = JSON.parse(await readFile(stage + 'states/' + f, 'utf8'));
  const ft = gj.features[0];
  await writeFile(out + 'states/' + f, JSON.stringify({ type: 'Feature', id: ft.properties.st, properties: ft.properties, bbox: bbox(ft.geometry).map(v => +v.toFixed(4)), geometry: ft.geometry }));
}
ms([raw + 'county/cb_2023_us_county_500k.shp',
  '-dissolve', 'STUSPS', 'copy-fields=STATE_NAME',
  '-each', 'st=STUSPS, name=STATE_NAME',
  '-filter-fields', 'st,name',
  '-simplify', '4%', 'keep-shapes', 'weighted',
  '-o', out + 'us.json', 'format=geojson', 'precision=0.001', 'id-field=st']);
index.features.states = (await readdir(out + 'states')).length;
console.log('  states: ' + index.features.states + ' files plus us.json');

/* ZCTAs: one file per 3-digit prefix, matching data/. */
console.log('Converting zcta (largest layer, a minute or two)...');
ms([raw + 'zcta520/cb_2020_us_zcta520_500k.shp',
  '-simplify', SIMPLIFY, 'keep-shapes', 'weighted',
  '-each', 'zip=GEOID20, prefix=GEOID20.slice(0,3)',
  '-filter-fields', 'zip,prefix',
  '-split', 'prefix',
  '-o', out + 'zcta/', 'format=geojson', 'precision=' + PRECISION, 'id-field=zip']);
let zctas = 0;
for (const f of await readdir(out + 'zcta')) {
  const p = out + 'zcta/' + f;
  const gj = JSON.parse(await readFile(p, 'utf8'));
  for (const ft of gj.features) { delete ft.properties.prefix; zctas++; }
  await writeFile(p, JSON.stringify(gj));
}
index.features.zcta = zctas;
console.log('  zcta: ' + zctas + ' shapes in ' + (await readdir(out + 'zcta')).length + ' prefix files');

await writeFile(out + 'index.json', JSON.stringify(index));
await rm(stage, { recursive: true, force: true });
console.log('Wrote geo/index.json');
