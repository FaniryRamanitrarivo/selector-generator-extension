import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { FragmentScorer } from '../src/content/selector/scoring/fragment-scorer.ts';
import { resetDeepQueryCache } from '../src/content/analyzer/dom/deep-query.ts';
import { resetTokenFrequencyCache } from '../src/content/analyzer/dom/token-frequency.ts';
import type { AttributeCandidate } from '../src/content/analyzer/scoring/attribute-candidature.ts';

const originalDocument = globalThis.document;
const originalWindow = (globalThis as { window?: unknown }).window;

function withPageDOM(html: string, run: () => void) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;
  resetDeepQueryCache();
  resetTokenFrequencyCache();

  try {
    run();
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
    resetDeepQueryCache();
    resetTokenFrequencyCache();
  }
}

test('FragmentScorer rewards a page-wide rare token over an equally "unique selector" but page-wide common one', () => {
  // Neither "flex" nor "sku-9f3k2" is in the curated semantic vocabulary, so without
  // the rarity signal both fragments would be scored identically on every other term
  // (same operator, same candidate.score, same selector uniqueness count of 1, same
  // concision-ish length). "flex" is a utility class reused across many elements on
  // the page (a common real-world Tailwind pattern); "sku-9f3k2" appears nowhere else.
  const commonClassElements = Array.from({ length: 30 }, (_, i) => `<div class="flex row-${i}"></div>`).join('');

  withPageDOM(`
    <div class="target sku-9f3k2 flex">x</div>
    ${commonClassElements}
  `, () => {
    const candidate: AttributeCandidate = {
      name: 'class',
      category: 'class' as never,
      value: 'target sku-9f3k2 flex',
      tokens: ['target', 'sku-9f3k2', 'flex'],
      score: 0.5,
      tagName: 'div'
    };

    const scorer = new FragmentScorer();

    const rareScore = scorer.score(
      { selector: '[class*="sku-9f3k2"]', score: 0.5, operator: 'contains', token: 'sku-9f3k2' },
      candidate,
      'div'
    ).score;

    const commonScore = scorer.score(
      { selector: '[class*="flex"]', score: 0.5, operator: 'contains', token: 'flex' },
      candidate,
      'div'
    ).score;

    assert.ok(
      rareScore > commonScore,
      `expected the page-wide rare token to outscore the common one, got rare=${rareScore} common=${commonScore}`
    );
  });
});

test('FragmentScorer does not penalize a token the page-wide frequency index does not cover (e.g. a data-testid value)', () => {
  withPageDOM(`<div data-testid="checkout-button">x</div>`, () => {
    const candidate: AttributeCandidate = {
      name: 'data-testid',
      category: 'data' as never,
      value: 'checkout-button',
      tokens: ['checkout', 'button'],
      score: 0.9,
      tagName: 'div'
    };

    const scorer = new FragmentScorer();

    const scored = scorer.score(
      { selector: '[data-testid="checkout-button"]', score: 0.9, operator: 'exact', token: 'checkout-button' },
      candidate,
      'div'
    );

    // token-frequency.ts only indexes class/id, not data-* attributes — a fragment
    // built from one should still score meaningfully, not be dragged down as if its
    // token were page-wide common.
    assert.ok(scored.score > 0.5, `expected a data-testid fragment to still score well, got ${scored.score}`);
  });
});
