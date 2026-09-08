/* Age apportionment, shared by the card generator and the dashboard.

   ACS never publishes single years of age. B01001 gives children as
   under 5, 5 to 9, 10 to 14, 15 to 17. Single-year counts come from
   splitting those brackets uniformly and giving the integer remainder
   to the earliest years, so apportioned years sum back to the
   published bracket total exactly.

   This is the only modeling assumption on the card. Do not change it
   without re-running reconcile against the dashboard.
*/

export const BRACKETS = [
  { lo: 0, hi: 4 },
  { lo: 5, hi: 9 },
  { lo: 10, hi: 14 },
  { lo: 15, hi: 17 }
];

/** Split one bracket total across span single years. null stays null. */
export function apportionBracket(total, span) {
  if (total === null || total === undefined) return Array(span).fill(null);
  const base = Math.floor(total / span);
  const rem = total - base * span;
  return Array.from({ length: span }, (_, i) => base + (i < rem ? 1 : 0));
}

/** [under5, 5to9, 10to14, 15to17] -> [age_0 .. age_17] */
export function apportionAges(brackets) {
  return BRACKETS.flatMap((b, i) => apportionBracket(brackets[i], b.hi - b.lo + 1));
}

/** Sum ages lo..hi. Returns the count and the years that were unavailable. */
export function sumRange(ages, lo, hi) {
  let count = 0;
  const missing = [];
  for (let a = lo; a <= hi; a++) {
    const v = ages[a];
    if (v === null || v === undefined) missing.push(a);
    else count += v;
  }
  return { count, missing };
}
