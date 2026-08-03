import test from 'node:test';
import assert from 'node:assert/strict';

import { FragmentScorer } from '../src/content/selector/scoring/fragment-scorer.ts';
import { generateCSSFragments } from '../src/content/selector/css/css-fragment-generator.ts';
import type { AttributeCandidate } from '../src/content/analyzer/scoring/attribute-candidature.ts';

const originalDocument = globalThis.document;

test('FragmentScorer prefers a shorter token-contains fragment over a long exact-value fragment', () => {
  globalThis.document = {
    querySelectorAll: () => [{}] // every fragment is equally unique for this comparison
  } as unknown as Document;

  const candidate: AttributeCandidate = {
    name: 'id',
    category: 'id' as never,
    value: 'product_page_informations',
    tokens: ['product', 'page', 'informations'],
    score: 0.8,
    tagName: 'div'
  };

  const scorer = new FragmentScorer();
  const scored = generateCSSFragments(candidate).map(fragment => scorer.score(fragment, candidate, 'div'));
  scored.sort((a, b) => b.score - a.score);

  assert.equal(scored[0]?.selector, '[id*="product"]');
  assert.ok(
    scored[0]!.score > scored.find(f => f.selector === '[id="product_page_informations"]')!.score,
    'expected the shorter contains-token fragment to outscore the long exact-value fragment'
  );
});

test('FragmentScorer does not favor a generic structural token over a descriptive one purely for brevity', () => {
  globalThis.document = {
    querySelectorAll: () => [{}]
  } as unknown as Document;

  const candidate: AttributeCandidate = {
    name: 'id',
    category: 'id' as never,
    value: 'product_page_informations',
    tokens: ['product', 'page', 'informations'],
    score: 0.8,
    tagName: 'div'
  };

  const scorer = new FragmentScorer();
  const productScore = scorer.score(
    { selector: '[id*="product"]', score: 0.8, operator: 'contains', token: 'product' },
    candidate,
    'div'
  ).score;
  const pageScore = scorer.score(
    { selector: '[id*="page"]', score: 0.8, operator: 'contains', token: 'page' },
    candidate,
    'div'
  ).score;

  assert.ok(productScore > pageScore, '"product" (descriptive) should outrank "page" (generic) despite being longer');
});

test.after(() => {
  globalThis.document = originalDocument;
});
