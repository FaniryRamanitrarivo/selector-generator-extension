import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  getPageElementCount,
  getTokenOccurrenceCount,
  resetTokenFrequencyCache
} from '../src/content/analyzer/dom/token-frequency.ts';
import { resetDeepQueryCache } from '../src/content/analyzer/dom/deep-query.ts';

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

test('getTokenOccurrenceCount counts how many distinct elements carry a class token', () => {
  withPageDOM(`
    <div class="product-card">
      <span class="product-title">A</span>
    </div>
    <div class="product-card">
      <span class="product-title">B</span>
    </div>
  `, () => {
    assert.equal(getTokenOccurrenceCount('product'), 4, '"product" appears in both "product-card" and "product-title" tokens, across 4 elements total');
    assert.equal(getTokenOccurrenceCount('card'), 2);
    assert.equal(getTokenOccurrenceCount('title'), 2);
  });
});

test('getTokenOccurrenceCount counts a token once per element even if it appears in both class and id', () => {
  withPageDOM(`<div id="product-wrapper" class="product-wrapper">x</div>`, () => {
    assert.equal(getTokenOccurrenceCount('product'), 1);
    assert.equal(getTokenOccurrenceCount('wrapper'), 1);
  });
});

test('getTokenOccurrenceCount returns 0 for a token that never appears on the page', () => {
  withPageDOM(`<div class="product-card">x</div>`, () => {
    assert.equal(getTokenOccurrenceCount('nonexistent'), 0);
  });
});

test('getTokenOccurrenceCount is case-insensitive', () => {
  withPageDOM(`<div class="Product-Card">x</div>`, () => {
    assert.equal(getTokenOccurrenceCount('product'), 1);
    assert.equal(getTokenOccurrenceCount('PRODUCT'), 1);
  });
});

test('getPageElementCount matches the total number of elements found by queryAllDeep', () => {
  withPageDOM(`<div><span></span><a></a></div>`, () => {
    // html, head, body, div, span, a
    assert.equal(getPageElementCount(), document.querySelectorAll('*').length);
  });
});

test('results are cached until resetTokenFrequencyCache is called', () => {
  withPageDOM(`<div class="original">x</div>`, () => {
    assert.equal(getTokenOccurrenceCount('original'), 1);

    const extra = document.createElement('div');
    extra.className = 'original';
    document.body.appendChild(extra);

    // Mutating the DOM without resetting the cache must not change the answer —
    // the cache is only safe to rely on within a single generate() run, which
    // resets it up front (see SelectorGenerationPipeline.generate()).
    assert.equal(getTokenOccurrenceCount('original'), 1, 'stale cache should still report the pre-mutation count');

    resetTokenFrequencyCache();

    assert.equal(getTokenOccurrenceCount('original'), 2, 'count should reflect the mutated DOM after a reset');
  });
});

test('getTokenOccurrenceCount does not throw when document.querySelectorAll("*") returns placeholder/undefined entries', () => {
  // Some existing test suites (see container-selector.test.ts's mockDocument) stub
  // querySelectorAll to return bare placeholder arrays with no real Element objects —
  // buildFrequency must tolerate that the same way deep-query.ts's collectRoots does.
  globalThis.document = {
    querySelectorAll: (selector: string) => (selector === '*' ? Array.from({ length: 3 }) : [])
  } as unknown as Document;
  resetTokenFrequencyCache();

  try {
    assert.doesNotThrow(() => getTokenOccurrenceCount('anything'));
    assert.equal(getTokenOccurrenceCount('anything'), 0);
    assert.equal(getPageElementCount(), 3);
  } finally {
    globalThis.document = originalDocument;
    resetTokenFrequencyCache();
  }
});
