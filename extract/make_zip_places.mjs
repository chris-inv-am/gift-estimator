#!/usr/bin/env node
/* Builds extract/zip_places.csv from Census 2020 relationship files.

   Inputs (extract/raw/, downloaded from www2.census.gov):
     zcta_place.txt   tab20_zcta520_place20_natl.txt   ZCTA <-> incorporated place / CDP
     zcta_county.txt  tab20_zcta520_county20_natl.txt  ZCTA <-> county
     states.txt       national_state2020.txt           state FIPS -> name, abbreviation

   Rule: each ZCTA is assigned the place and the county that hold the largest
   share of its land area. A ZCTA outside any place gets a blank city; county
   and state still resolve. The `area` (neighborhood) column is left blank
   pending the decision on national vs pilot-city coverage.

   Output columns: zip,city,county,state,state_abbr,area
*/
import { readFile, writeFile } from 'node:fs/promises';

// Consolidated city-counties carry a legal name nobody types. Map the Census name
// to the everyday one so "Nashville" resolves and the card reads "Nashville, Tennessee".
// Imported by extract/make_geo.mjs so boundary index keys line up with data keys.
export const EVERYDAY = {
  'Louisville/Jefferson County': 'Louisville', 'Nashville-Davidson': 'Nashville', 'Urban Honolulu': 'Honolulu',
  'Boise City': 'Boise', 'Lexington-Fayette': 'Lexington', 'Augusta-Richmond County': 'Augusta',
  'Athens-Clarke County': 'Athens', 'Macon-Bibb County': 'Macon', 'Columbus Consolidated Government': 'Columbus',
  'Hartsville/Trousdale County': 'Hartsville', 'Cusseta-Chattahoochee County': 'Cusseta',
  'Georgetown-Quitman County': 'Georgetown', 'Butte-Silver Bow': 'Butte', 'Anaconda-Deer Lodge County': 'Anaconda',
  'Islamorada, Village of Islands': 'Islamorada'
};
const everyday = s => EVERYDAY[s] || s;


const here = new URL('./raw/', import.meta.url);

const isMain = process.argv[1] && import.meta.url.endsWith('/' + process.argv[1].split('/').pop());
if (isMain) await main();

async function main() {
async function rows(name) {
  const txt = (await readFile(new URL(name, here), 'utf8')).replace(/^﻿/, '');
  const lines = txt.trim().split('\n');
  const cols = lines[0].trim().split('|');
  return lines.slice(1).map(l => Object.fromEntries(cols.map((c, i) => [c, (l.split('|')[i] || '').trim()])));
}

const states = {};
for (const r of await rows('states.txt')) states[r.STATEFP] = { abbr: r.STATE, name: r.STATE_NAME };

// Legal/statistical area descriptions the Census appends to place names.
const LSAD = /\s+(city|town|village|borough|CDP|municipality|comunidad|zona urbana|urban county|consolidated government|metro government|metropolitan government|unified government|city and borough|town and borough|corporation|plantation|gore|grant|location|purchase|census area|charter township|township)(\s*\(balance\))?$/i;
const stripLsad = s => everyday(s.replace(LSAD, '').trim());

function best(list, keyField, nameField) {
  // For each ZCTA keep the row with the largest land-area overlap.
  const out = {};
  for (const r of list) {
    const zip = r.GEOID_ZCTA5_20;
    if (!zip || !r[keyField]) continue; // rows with a blank ZCTA are place/county area outside any ZCTA
    const part = Number(r.AREALAND_PART) || 0;
    if (!out[zip] || part > out[zip].part) out[zip] = { part, geoid: r[keyField], name: r[nameField] };
  }
  return out;
}

const place = best(await rows('zcta_place.txt'), 'GEOID_PLACE_20', 'NAMELSAD_PLACE_20');
const county = best(await rows('zcta_county.txt'), 'GEOID_COUNTY_20', 'NAMELSAD_COUNTY_20');

const zips = [...new Set([...Object.keys(place), ...Object.keys(county)])].sort();
const lines = ['zip,city,county,state,state_abbr,area'];
let withCity = 0;
for (const zip of zips) {
  const c = county[zip];
  const p = place[zip];
  const fips = (c?.geoid || p?.geoid || '').slice(0, 2);
  const st = states[fips] || { abbr: '', name: '' };
  const city = p ? stripLsad(p.name) : '';
  if (city) withCity++;
  const clean = s => s.replace(/,/g, ' ');
  lines.push([zip, clean(city), clean(c?.name || ''), st.name, st.abbr, ''].join(','));
}
await writeFile(new URL('./zip_places.csv', import.meta.url), lines.join('\n') + '\n');
console.log('zip_places.csv: ' + zips.length + ' ZCTAs, ' + withCity + ' with a city name, ' +
  Object.keys(county).length + ' with a county');
}
