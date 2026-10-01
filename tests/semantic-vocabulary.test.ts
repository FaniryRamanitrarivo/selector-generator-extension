import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBestContainedTier,
  getSemanticTier,
  isSignificantToken
} from '../src/content/analyzer/attributes/semantic-vocabulary.ts';

test('getSemanticTier returns the right tier for a word in each bucket', () => {
  assert.equal(getSemanticTier('page'), 1, 'generic/structural word');
  assert.equal(getSemanticTier('content'), 2, 'contextual word');
  assert.equal(getSemanticTier('product'), 3, 'target-oriented word');
});

test('getSemanticTier is case-insensitive and returns undefined for unknown words', () => {
  assert.equal(getSemanticTier('PRODUCT'), 3);
  assert.equal(getSemanticTier('Header'), 1);
  assert.equal(getSemanticTier('zzqqflorb'), undefined);
});

test('isSignificantToken is true only for tier-3 (target-oriented) words', () => {
  assert.equal(isSignificantToken('product'), true);
  assert.equal(isSignificantToken('price'), true);
  assert.equal(isSignificantToken('content'), false, 'tier 2 is contextual, not significant on its own');
  assert.equal(isSignificantToken('header'), false, 'tier 1 is generic/structural');
  assert.equal(isSignificantToken('zzqqflorb'), false);
});

test('getBestContainedTier finds a vocabulary word embedded in a larger string', () => {
  assert.equal(getBestContainedTier('product-id-wrapper'), 3, 'contains "product" (tier 3)');
  assert.equal(getBestContainedTier('page-content-block'), 2, 'contains "content" (tier 2), no tier-3 word present');
  assert.equal(getBestContainedTier('some-random-css-class'), undefined);
});

test('getBestContainedTier prefers a tier-3 match over a tier-2 match in the same string', () => {
  // Contains both "content" (tier 2) and "product" (tier 3) — the more specific,
  // target-oriented word should win regardless of which one appears first.
  assert.equal(getBestContainedTier('product-content-wrapper'), 3);
  assert.equal(getBestContainedTier('content-product-wrapper'), 3);
});
