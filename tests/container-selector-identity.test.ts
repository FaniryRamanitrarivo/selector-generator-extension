import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildDOMContext } from '../src/content/analyzer/dom-context.ts';
import { SelectorGenerationPipeline } from '../src/content/selector/pipeline/selector-generation-pipeline.ts';

const originalDocument = globalThis.document;
const originalWindow = (globalThis as { window?: unknown }).window;

// Reproduces a real bug report: Shopify (and many CMS themes) wrap *every* themed
// section — header, footer, product sections, etc. — in an identical
// `<div class="shopify-section section" id="shopify-section-<unique>">` wrapper. The
// generic "section" class token is shared by every one of those wrappers, so
// `div[class~="section"]` can be globally unique (count === 1) on a page that happens
// to have only 2 such wrappers total, while the *single match* it resolves to is a
// completely unrelated one (here, the footer) — not the actual ancestor of the
// clicked target at all.
const PAGE_HTML = `
<div id="shopify-section-footer" class="shopify-section section">
  <div class="footer-links">Links</div>
</div>
<div id="shopify-section-offer-card-9f3k2" class="shopify-section section">
  <div class="offer-card">
    <div class="offer-card__brand brand">Nike</div>
  </div>
</div>
`;

function withPageDOM(run: () => void) {
  const dom = new JSDOM(`<!doctype html><html><body>${PAGE_HTML}</body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;

  try {
    run();
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

test('container selection rejects a fragment that is unique but resolves to the wrong ancestor', () => {
  withPageDOM(() => {
    // Sanity-check the fixture actually reproduces the ambiguous-but-unique setup:
    // exactly 2 matches globally, and the first one found is the *footer*, not the
    // real ancestor of the target.
    const sectionMatches = document.querySelectorAll('div[class~="section"]');
    assert.equal(sectionMatches.length, 2);
    assert.notEqual(
      document.querySelector('div[class~="section"]'),
      document.querySelector('#shopify-section-offer-card-9f3k2'),
      'expected the fixture\'s first "section" match to be the footer, not the offer-card wrapper'
    );

    const target = document.querySelector('.offer-card__brand') as HTMLElement;
    const context = buildDOMContext(target);
    const pipeline = new SelectorGenerationPipeline();

    const [best] = pipeline.generate(context, target);

    assert.ok(best, 'expected at least one generated selector');
    assert.ok(
      !best!.selector.includes('[class~="section"]') && !best!.selector.includes('[class*="section"]'),
      `expected the ambiguous "section" fragment to be rejected as a container, got "${best!.selector}"`
    );
    assert.equal(best!.count, 1);
    assert.ok(best!.matchesTarget);
    assert.equal(
      document.querySelectorAll(best!.selector).length,
      1,
      `expected "${best!.selector}" to uniquely match the target`
    );
  });
});
