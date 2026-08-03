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
