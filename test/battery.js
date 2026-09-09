const fs = require('fs');
global.window = {};
// Usage: node test/battery.js path/to/zip-data.js   (the estimator's data layer, decoded from the Claude Design bundle)
// Runs the layer's own runTests() plus a battery of phrasings against the live CDN and prints what each resolves to.
eval(fs.readFileSync(process.argv[2], 'utf8'));
const Z = window.ZipData;
const Q = [
 // basics
 '$250 per child in 60637',
 '$250 per child in 60637 and 60649',
 '$250 per child in 60637, 60649',
 '$250 per child in 60637 60649 60653',
 '$250 per child in ZIP codes 60637 and 60649',
 // geoClause / word order
 '$250 per child in Chicago for kids 3-10',
 '$250 per child in Chicago for ages 3 to 10',
 '$250 per child ages 3 to 10 in Chicago',
 '$250 per child in Chicago, ages 3-10',
 'give $250 to every child in Chicago between 3 and 10',
 // gift vs income digits
 '$50 per child in Illinois under $50,000 median family income',
 '$45 per child in Chicago under $45,000 median family income',
 '$100 per child in Chicago under $100,000 median family income',
 '$1 million for kids in Chicago',
 '$250,000 total for kids in 60637',
 '1000 dollars per child in 60637',
 '250 per child in 60637',
 '$1k per child in 60637',
 '$1,000 per child in 60637',
 '$250/child 60637',
 '$250 each for kids in 60637',
 // abbreviations & punctuation
 '$250 per child in Chicago, IL',
 '$250 per child in Peoria, IL',
 '$250 per child in Springfield, IL',
 '$250 per child in Springfield, Illinois',
 '$250 per child in Springfield',
 '$250 per child in St. Louis, Missouri',
 '$250 per child in Saint Louis, Missouri',
 '$250 per child in St Louis',
 "$250 per child in Prince George's County, Maryland",
 '$250 per child in PG County',
 '$250 per child in Cook County',
 '$250 per child in Cook County, IL',
 '$250 per child in Kansas City',
 '$250 per child in Washington',
 '$250 per child in Washington, DC',
 '$250 per child in District of Columbia',
 '$250 per child in NYC',
 '$250 per child in New York City',
 '$250 per child in Manhattan',
 '$250 per child in Brooklyn',
 '$250 per child in Los Angeles',
 '$250 per child in LA',
 // consolidated / odd Census names
 '$250 per child in Honolulu',
 '$250 per child in Louisville',
 '$250 per child in Louisville, Kentucky',
 '$250 per child in Nashville',
 '$250 per child in Indianapolis',
 '$250 per child in Boise',
 '$250 per child in Lexington, Kentucky',
 '$250 per child in Miami',
 '$250 per child in Miami, Florida',
 // bare state names
 '$250 per child in Illinois',
 '$250 per child in Indiana',
 '$250 per child in California',
 '$250 per child in Florida',
 '$250 per child in Texas',
 '$250 per child in Ohio',
 '$250 per child across Illinois',
 '$250 per child in the state of Illinois',
 '$250 per child statewide in Illinois',
 '$250 per child in Puerto Rico',
 // ages
 '$250 per child under 5 in 60637',
 '$250 per child 5 and up in 60637',
 '$250 per child ages 5+ in 60637',
 '$250 per child for newborns in 60637',
 '$250 per child for teens in 60637',
 '$250 per child ages 10 to 3 in 60637',
 '$250 per child ages 12 to 25 in 60637',
 '$250 per child ages 0-17 in 60637',
 '$250 per child 3 thru 10 in 60637',
 // neighborhoods & sub-city names
 '$250 per child in Hyde Park Chicago',
 '$250 per child in Lincoln Park, Chicago',
 '$250 per child in South Side Chicago',
 "$250 per child on Chicago's south side",
 '$250 per child in the Bronx',
 // multi-place
 '$250 per child in Chicago and Peoria',
 '$250 per child in Cook County and Lake County, Illinois',
 '$250 per child in Chicago and Evanston, Illinois',
 // income variants
 '$250 per child in Chicago ZIP codes under $45,000 median family income',
 '$250 per child in Chicago over $100,000 income',
 '$250 per child in Chicago under 45k income',
 '$250 per child in Chicago below $45,000 MFI',
 '$250 per child in low income ZIP codes in Chicago',
 '$250 per child in Chicago under 45000',
 // misc
 '$250 per child in 00000',
 '$250 per child in 60637-1234',
 '$250 per child in 606',
 '$250 per child',
 '',
 '$250 per child in 60637 Chicago',
 '$1,000,000 per child statewide in California',
];
(async () => {
  const t0 = Date.now();
  const info = await Z.ready; console.log('ready:', info.places, 'place keys; manifest rows', Z.manifest() && Z.manifest().rows, 'in', Date.now()-t0, 'ms');
  console.log('\n=== built-in runTests()');
  const tests = await Z.runTests();
  tests.forEach(t => { if (!t.pass) console.log('FAIL', t.name, 'got', t.got, 'want', t.want); });
  console.log(tests.filter(t=>t.pass).length + '/' + tests.length + ' pass');
  console.log('\n=== battery');
  for (const q of Q) {
    try {
      const c = await Z.buildCard(q);
      const out = { title: c.title, where: c.whereTitle, zips: c.zipCount, ages: c.ages, gift: c.gift, children: c.childrenRaw, total: c.total };
      if (c.filter) out.filter = c.filter;
      if (c.notes && c.notes.length) out.notes = c.notes;
      if (c.choices && c.choices.length) out.choices = c.choices.map(x => x.label);
      if (c.gapNote) out.gap = c.gapNote;
      console.log(JSON.stringify(q) + '\n   ' + JSON.stringify(out));
    } catch (e) { console.log(JSON.stringify(q) + '\n   ERROR ' + e.message); }
  }
})();
