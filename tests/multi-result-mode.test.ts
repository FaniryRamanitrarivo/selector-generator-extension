import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildDOMContext } from '../src/content/analyzer/dom-context.ts';
import { SelectorGenerationPipeline } from '../src/content/selector/pipeline/selector-generation-pipeline.ts';

const originalDocument = globalThis.document;
const originalWindow = (globalThis as { window?: unknown }).window;

// A real-world color-swatch variant picker (Shopify-style): 3 color options sharing
// `name="Color"` and `class="variant__input--color-swatch"` on the <input>, and
// `class="variant__button-label color-swatch color-swatch--<slug>"` on each <label>.
// Every element also carries several near-unique attributes (ids/data-* built from a
// long per-product/per-variant template id) that used to win selector-generation by
// virtue of matching exactly 1 element — the wrong outcome when the user wants to
// select every color option at once.
const COLOR_FIELDSET_HTML = `
<fieldset name="Color" class="variant-input-wrap" id="ProductSelect-template--123__main-456-option-0">
  <legend>Color</legend>
  <div class="variant-input">
    <input type="radio" checked value="700 Negro" name="Color" class="variant__input--color-swatch"
      id="ProductSelect-template--123__main-456-option-color-700-Negro">
    <label for="ProductSelect-template--123__main-456-option-color-700-Negro"
      class="variant__button-label color-swatch color-swatch--700-negro">Negro</label>
  </div>
  <div class="variant-input">
    <input type="radio" value="802 Habano" name="Color" class="variant__input--color-swatch"
      id="ProductSelect-template--123__main-456-option-color-802-Habano">
    <label for="ProductSelect-template--123__main-456-option-color-802-Habano"
      class="variant__button-label color-swatch color-swatch--802-habano">Habano</label>
  </div>
  <div class="variant-input">
    <input type="radio" value="000 Blanco" name="Color" class="variant__input--color-swatch"
      id="ProductSelect-template--123__main-456-option-color-000-Blanco">
    <label for="ProductSelect-template--123__main-456-option-color-000-Blanco"
      class="variant__button-label color-swatch color-swatch--000-blanco">Blanco</label>
  </div>
</fieldset>
`;

function withColorFieldsetDOM(run: () => void) {
  const dom = new JSDOM(`<!doctype html><html><body>${COLOR_FIELDSET_HTML}</body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;

  try {
    run();
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

test('multiResultMode: clicking one color swatch generates a selector matching every color option', () => {
  withColorFieldsetDOM(() => {
    const target = document.querySelector(
      'label[for="ProductSelect-template--123__main-456-option-color-700-Negro"]'
    ) as HTMLElement;

    const context = buildDOMContext(target);
    const pipeline = new SelectorGenerationPipeline();

    const [best] = pipeline.generate(context, target, { multiResultMode: true });

    assert.ok(best, 'expected at least one generated selector');
    assert.ok(
      best!.count > 1,
      `expected the top multi-result selector to match more than one element, got count=${best!.count} (${best!.selector})`
    );
    assert.equal(
      document.querySelectorAll(best!.selector).length,
      3,
      `expected "${best!.selector}" to match all 3 color options`
    );
    assert.ok(best!.matchesTarget, 'expected the clicked swatch to be among the matched elements');
  });
});

// Two separate product cards, each with its own repeated ".size-option" buttons.
// Only the id on each card is unique on the page — the shared "product-info"
// class is not. A target-only selector like ".size-option" would match all 4
// buttons across both cards; the correct multi-result behavior is to still pick
// a container (the clicked button's own card) so the selector only sweeps the
// options belonging to that one product.
const SIZE_CARDS_HTML = `
<div id="card-adidas" class="product-card">
  <div class="product-info">
    <button class="size-option size-m">M</button>
    <button class="size-option size-l">L</button>
  </div>
</div>
<div id="card-nike" class="product-card">
  <div class="product-info">
    <button class="size-option size-m">M</button>
    <button class="size-option size-l">L</button>
  </div>
</div>
`;

function withSizeCardsDOM(run: () => void) {
  const dom = new JSDOM(`<!doctype html><html><body>${SIZE_CARDS_HTML}</body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;

  try {
    run();
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

test('multiResultMode: the generated selector is scoped to a container, not every matching element on the page', () => {
  withSizeCardsDOM(() => {
    const target = document.querySelector('#card-adidas .size-m') as HTMLElement;

    const context = buildDOMContext(target);
    const pipeline = new SelectorGenerationPipeline();

    const [best] = pipeline.generate(context, target, { multiResultMode: true });

    assert.ok(best, 'expected at least one generated selector');
    assert.ok(best!.matchesTarget, 'expected the clicked button to be among the matched elements');
    assert.equal(
      best!.count,
      2,
      `expected the selector to match only the 2 size options in the clicked card, got count=${best!.count} (${best!.selector})`
    );
    const matches = Array.from(document.querySelectorAll(best!.selector));
    assert.ok(
      matches.every(element => element.closest('#card-adidas')),
      `expected every match to be scoped inside the clicked card, got "${best!.selector}" matching ${matches.map(e => e.outerHTML).join(', ')}`
    );
  });
});

// Same idea as SIZE_CARDS_HTML, but this time the two cards are wrapped in a
// shared <section> that itself clears CONTAINER_SEMANTIC_THRESHOLD easily
// (id/class "product-list" — a strong semantic word, on a semantic tag). Each
// card's own id ("card-a"/"card-b") is unique but semantically weak (no
// recognized word), so it alone would never have cleared the threshold. In
// multi-result mode this must not cause the walk to keep going past the
// nearer, tighter card container in search of a "more semantic" one further
// out — that farther section wraps *both* cards, so scoping there instead of
// the clicked card doubles the match count.
const NESTED_SIZE_CARDS_HTML = `
<section id="product-list" class="product-list">
  <div id="card-a">
    <button class="size-option size-m">M</button>
    <button class="size-option size-l">L</button>
    <button class="size-option size-s">S</button>
  </div>
  <div id="card-b">
    <button class="size-option size-m">M</button>
    <button class="size-option size-l">L</button>
    <button class="size-option size-s">S</button>
  </div>
</section>
`;

function withNestedSizeCardsDOM(run: () => void) {
  const dom = new JSDOM(`<!doctype html><html><body>${NESTED_SIZE_CARDS_HTML}</body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;

  try {
    run();
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

test('multiResultMode: prefers the nearer, tighter container over a farther, more "semantic" one', () => {
  withNestedSizeCardsDOM(() => {
    const target = document.querySelector('#card-a .size-m') as HTMLElement;

    const context = buildDOMContext(target);
    const pipeline = new SelectorGenerationPipeline();

    const [best] = pipeline.generate(context, target, { multiResultMode: true });

    assert.ok(best, 'expected at least one generated selector');
    assert.ok(best!.matchesTarget, 'expected the clicked button to be among the matched elements');
    assert.equal(
      best!.count,
      3,
      `expected the selector to match only the 3 size options in card-a, got count=${best!.count} (${best!.selector})`
    );

    const matches = Array.from(document.querySelectorAll(best!.selector));
    assert.ok(
      matches.every(element => element.closest('#card-a')),
      `expected every match to stay inside card-a, got "${best!.selector}" matching ${matches.map(e => e.outerHTML).join(', ')}`
    );
  });
});

test('single-result mode (default): the same click still yields a selector unique to that one swatch', () => {
  withColorFieldsetDOM(() => {
    const target = document.querySelector(
      'label[for="ProductSelect-template--123__main-456-option-color-700-Negro"]'
    ) as HTMLElement;

    const context = buildDOMContext(target);
    const pipeline = new SelectorGenerationPipeline();

    const [best] = pipeline.generate(context, target);

    assert.ok(best);
    assert.equal(best!.count, 1, `expected a unique match in default mode, got count=${best!.count} (${best!.selector})`);
  });
});
