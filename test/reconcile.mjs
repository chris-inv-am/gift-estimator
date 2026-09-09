import { readFileSync, readdirSync } from 'node:fs';
// Usage: CENSUS_API_KEY=... node test/reconcile.mjs   (run from the repo root)
// Checks 40 random ZCTAs and the Chicago, Cook County and Illinois totals against the Census API.
const KEY = process.env.CENSUS_API_KEY;
const V = ['B01001_003E','B01001_027E','B01001_004E','B01001_028E','B01001_005E','B01001_029E','B01001_006E','B01001_030E','B19113_001E'];
const api = async (geo) => { const r = await fetch(`https://api.census.gov/data/2023/acs/acs5?get=${V.join(',')}&for=${geo}&key=${KEY}`); if(!r.ok) throw new Error(geo+' '+r.status); return r.json(); };
const num = v => (v===null||v===''||Number(v)<=-666666666) ? null : Number(v);
const kids = row => { const n=row.map(num); const pair=(a,b)=> (n[a]===null||n[b]===null)?null:n[a]+n[b]; return { brackets:[pair(0,1),pair(2,3),pair(4,5),pair(6,7)], income:n[8] }; };
const rows = {}; for (const f of readdirSync('data')) if (/^\d{3}\.json$/.test(f)) for (const r of JSON.parse(readFileSync('data/'+f))) rows[r.zip]=r;
const all = Object.keys(rows);
// 1. random ZCTAs: brackets must equal sums of apportioned single years; income must match
let seed = 42; const rnd = () => (seed = (seed*1103515245+12345) % 2147483648) / 2147483648;
const sample = Array.from({length: 40}, () => all[Math.floor(rnd()*all.length)]);
const res = await api('zip%20code%20tabulation%20area:' + sample.join(','));
const idx = Object.fromEntries(res[0].map((h,i)=>[h,i]));
let ok=0, bad=[];
for (const r of res.slice(1)) {
  const z = r[idx['zip code tabulation area']]; const d = rows[z]; const k = kids(r);
  const sums = [[0,4],[5,9],[10,14],[15,17]].map(([a,b])=>{ let s=0; for(let i=a;i<=b;i++){ if(d['age_'+i]===null) return null; s+=d['age_'+i]; } return s; });
  const same = JSON.stringify(sums)===JSON.stringify(k.brackets) && d.median_family_income===k.income;
  if (same) ok++; else bad.push({z, data:sums, census:k.brackets, inc:[d.median_family_income,k.income]});
}
console.log(`ZCTA spot check: ${ok}/${res.length-1} match Census exactly`); if (bad.length) console.log(bad);
// 2. suppressed / null handling in data
let nullAges=0, nullInc=0; for (const z of all) { if ([...Array(18).keys()].some(i=>rows[z]['age_'+i]===null)) nullAges++; if (rows[z].median_family_income===null) nullInc++; }
console.log(`rows with any null age: ${nullAges}; rows with null income: ${nullInc}; total rows ${all.length}`);
// 3. county and state totals vs ACS published totals (ZCTAs cross lines, so expect small variance)
const sumKids = pred => { let s=0; for (const z of all) if (pred(rows[z])) for (let i=0;i<=17;i++) s += rows[z]['age_'+i]||0; return s; };
const cook = kids((await api('county:031&in=state:17'))[1]).brackets.reduce((a,b)=>a+b,0);
const il = kids((await api('state:17'))[1]).brackets.reduce((a,b)=>a+b,0);
const chi = kids((await api('place:14000&in=state:17'))[1]).brackets.reduce((a,b)=>a+b,0);
const dCook = sumKids(r=>r.county==='Cook County'&&r.state==='Illinois'), dIL = sumKids(r=>r.state==='Illinois'), dChi = sumKids(r=>r.city==='Chicago'&&r.state==='Illinois');
const pct = (a,b)=>((a-b)/b*100).toFixed(1)+'%';
console.log(`Children 0-17 | data (sum of assigned ZCTAs) vs Census direct estimate`);
console.log(`  Chicago city : ${dChi.toLocaleString()} vs ${chi.toLocaleString()}  (${pct(dChi,chi)})`);
console.log(`  Cook County  : ${dCook.toLocaleString()} vs ${cook.toLocaleString()}  (${pct(dCook,cook)})`);
console.log(`  Illinois     : ${dIL.toLocaleString()} vs ${il.toLocaleString()}  (${pct(dIL,il)})`);
// 4. ZCTAs with no state (fell outside the crosswalk)
console.log('rows with blank state:', all.filter(z=>!rows[z].state).length, all.filter(z=>!rows[z].state).slice(0,10));
