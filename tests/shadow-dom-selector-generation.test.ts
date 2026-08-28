import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildDOMContext } from '../src/content/analyzer/dom-context.ts';
import { SelectorGenerationPipeline } from '../src/content/selector/pipeline/selector-generation-pipeline.ts';

const originalDocument = globalThis.document;
const originalWindow = (globalThis as { window?: unknown }).window;
const originalShadowRoot = (globalThis as { ShadowRoot?: unknown }).ShadowRoot;

// Light DOM deliberately reuses a generic "section" class also present inside the
// shadow tree (mirrors container-selector-identity.test.ts's Shopify scenario) so a
// container-eligibility bug that let the ancestor walk leak out of the shadow
// boundary would have something plausible-but-wrong to latch onto.
function withShadowPageDOM(run: (host: Element) => void) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="light-wrapper" class="section">
      <div id="host"></div>
    </div>
  </body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;
  (globalThis as { ShadowRoot?: unknown }).ShadowRoot = dom.window.ShadowRoot;

  const host = dom.window.document.getElementById('host')!;
  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = `
    <div id="widget-info">
      <span id="leaf" class="offer-card__brand brand">Nike</span>
    </div>
  `;

  try {
    run(host);
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { ShadowRoot?: unknown }).ShadowRoot = originalShadowRoot;
  }
}

test('pipeline generates a working selector for a target inside an open shadow root, flagged as such', () => {
  withShadowPageDOM(host => {
    const shadowRoot = host.shadowRoot!;
    const target = shadowRoot.getElementById('leaf') as unknown as HTMLElement;

    const context = buildDOMContext(target);
    const pipeline = new SelectorGenerationPipeline();
    const [best] = pipeline.generate(context, target);

    assert.ok(best, 'expected at least one generated selector');
    assert.equal(best!.matchesTarget, true);
    assert.equal(best!.insideShadowRoot, true);

    // The selector is only valid queried against the shadow root's own local scope...
    assert.equal(shadowRoot.querySelectorAll(best!.selector).length, 1);
    assert.equal(shadowRoot.querySelector(best!.selector), target);

    // ...never via the naive document.querySelector the tool would otherwise seem to
    // promise — this is exactly why the UI needs the insideShadowRoot warning.
    assert.equal(document.querySelectorAll(best!.selector).length, 0);
  });
});

test('buildDOMContext confines container-eligible ancestors to the target\'s own shadow tree', () => {
  withShadowPageDOM(host => {
    const shadowRoot = host.shadowRoot!;
    const target = shadowRoot.getElementById('leaf') as unknown as HTMLElement;
    const lightWrapper = document.getElementById('light-wrapper');

    const context = buildDOMContext(target);

    assert.ok(context.ancestors.length > 0, 'expected at least the in-shadow wrapper as an ancestor');
    assert.ok(
      context.ancestors.every(ancestor => ancestor.element?.getRootNode() === shadowRoot),
      'expected every ancestor candidate to belong to the target\'s own shadow tree'
    );
    assert.ok(
      !context.ancestors.some(ancestor => ancestor.element === lightWrapper),
      'the light-DOM wrapper outside the shadow root must never be considered a container candidate'
    );
  });
});
