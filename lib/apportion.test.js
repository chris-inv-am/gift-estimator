import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apportionBracket, apportionAges, sumRange } from './apportion.js';

test('splits evenly', () => {
  assert.deepEqual(apportionBracket(10, 5), [2, 2, 2, 2, 2]);
});

test('remainder goes to the earliest years', () => {
  assert.deepEqual(apportionBracket(12, 5), [3, 3, 2, 2, 2]);
});

test('suppressed stays null, never zero', () => {
  assert.deepEqual(apportionBracket(null, 3), [null, null, null]);
});

test('apportioned years sum back to the published total', () => {
  const brackets = [1980, 1750, 1690, 980];
  const total = brackets.reduce((a, b) => a + b, 0);
  assert.equal(apportionAges(brackets).reduce((a, b) => a + b, 0), total);
});

test('a suppressed bracket reads as a gap, not a zero', () => {
  const ages = apportionAges([1310, null, 1120, 640]);
  const { count, missing } = sumRange(ages, 2, 10);
  assert.deepEqual(missing, [5, 6, 7, 8, 9]);
  assert.ok(count > 0);
});

test('every bracket span is covered once', () => {
  assert.equal(apportionAges([0, 0, 0, 0]).length, 18);
});
