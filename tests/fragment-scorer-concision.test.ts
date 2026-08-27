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

test('FragmentScorer penalizes a css-in-js hash token below a plain, non-generated one', () => {
  globalThis.document = {
    querySelectorAll: () => [{}] // every fragment is equally unique for this comparison
  } as unknown as Document;

  // Typical emotion/MUI output: a stable base class plus a build-generated
  // hash suffix, both tokenized off the same class attribute.
  const candidate: AttributeCandidate = {
    name: 'class',
    category: 'class' as never,
    value: 'css-2433413',
    tokens: ['css', '2433413'],
    score: 0.8,
    tagName: 'div'
  };

  const scorer = new FragmentScorer();
  const scored = generateCSSFragments(candidate).map(fragment => scorer.score(fragment, candidate, 'div'));
  scored.sort((a, b) => b.score - a.score);

  const cssFragment = scored.find(f => f.token === 'css' && f.operator === 'contains')!;
  const hashFragment = scored.find(f => f.token === '2433413' && f.operator === 'contains')!;

  assert.ok(
    cssFragment.score > hashFragment.score,
    `expected the non-generated token to outscore the hash token, got css=${cssFragment.score} hash=${hashFragment.score}`
  );
});

test('FragmentScorer still lets a generated-looking token score positively (usable as a last resort)', () => {
  globalThis.document = {
    querySelectorAll: () => [{}]
  } as unknown as Document;

  const candidate: AttributeCandidate = {
    name: 'class',
    category: 'class' as never,
    value: 'css-2433413',
    tokens: ['css', '2433413'],
    score: 0.2, // low candidate score too, as SemanticAttributeRule would already penalize this value
    tagName: 'div'
  };

  const scorer = new FragmentScorer();
  const hashFragment = scorer.score(
    { selector: '[class*="2433413"]', score: 0.2, operator: 'contains', token: '2433413' },
    candidate,
    'div'
  );

  assert.ok(hashFragment.score > 0, 'expected the hash-based fragment to still score above zero, not be excluded outright');
});

test.after(() => {
  globalThis.document = originalDocument;
});
