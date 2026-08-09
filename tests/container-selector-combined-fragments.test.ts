import test from 'node:test';
import assert from 'node:assert/strict';

import { ContainerSelector } from '../src/content/selector/container/container-selector.ts';
import { AttributeScorer } from '../src/content/analyzer/scoring/attribute-scorer.ts';
import { CategoryRule } from '../src/content/analyzer/scoring/rules/category-rule.ts';
import { SemanticAttributeRule } from '../src/content/analyzer/scoring/rules/semantic-attribute-rule.ts';
import { TagNameRule } from '../src/content/analyzer/scoring/rules/tagname-rule.ts';
import { FragmentScorer } from '../src/content/selector/scoring/fragment-scorer.ts';
import type { DOMContext, ElementNodeContext } from '../src/content/analyzer/dom-context.ts';

const originalDocument = globalThis.document;

function mockDocument(matchCount: (selector: string) => number) {
  globalThis.document = {
    querySelectorAll: (selector: string) =>
      Array.from({ length: matchCount(selector) })
  } as unknown as Document;
}

function classAncestor(tagname: string, className: string, tokens: string[]): ElementNodeContext {
  return {
    tagname,
    attributes: [{
      name: 'class',
      category: 'class' as never,
      rawValue: className,
      values: [className],
      tokens
    }]
  };
}

function makeSelector() {
  const attributeScorer = new AttributeScorer([
    { rule: new CategoryRule(), weight: 50 },
    { rule: new SemanticAttributeRule(), weight: 40 },
    { rule: new TagNameRule(), weight: 20 }
  ]);
  const fragmentScorer = new FragmentScorer();
  return new ContainerSelector(attributeScorer, fragmentScorer);
}

test('ContainerSelector falls back to a 2-attribute combination when no single attribute is unique', () => {
  // Neither "details" nor "title" alone is unique (3 elements share each class
  // individually), but together they narrow down to the one target ancestor —
  // mirrors div[class*="details"][class*="title"] disambiguating a product's
  // details/title block from unrelated "details" sections elsewhere on the page.
  mockDocument(selector => {
    const hasDetails = selector.includes('details');
    const hasTitle = selector.includes('title');
    return hasDetails && hasTitle ? 1 : 3;
  });

  const context: DOMContext = {
    element: { tagname: 'span', attributes: [] },
    ancestors: [
      classAncestor('div', 'details title', ['details', 'title'])
    ]
  };

  const selection = makeSelector().select(context);

  assert.ok(selection, 'expected a container selection, got null');
  assert.equal(selection!.isSemanticMatch, true);
  assert.equal(selection!.matchCount, 1);

  const fragmentSelector = selection!.part.fragments?.[0]?.selector ?? '';
  assert.ok(
    fragmentSelector.includes('details') && fragmentSelector.includes('title'),
    `expected a combined fragment referencing both tokens, got ${fragmentSelector}`
  );
});

test('ContainerSelector prefers a farther single-attribute ancestor over a closer combined one', () => {
  // section[id*="details"] (farther, mono, unique) should win over
  // div[class*="section"][class*="main"] (closer, only unique when combined) —
  // pass 1 (mono, all ancestors) must run to completion before pass 2
  // (combined) is ever attempted, regardless of proximity.
  mockDocument(selector => {
    if (selector.includes('id*="details"')) {
      return 1;
    }
    const hasSection = selector.includes('class*="section"');
    const hasMain = selector.includes('class*="main"');
    if (hasSection && hasMain) {
      return 1;
    }
    return 3;
  });

  const context: DOMContext = {
    element: { tagname: 'span', attributes: [] },
    ancestors: [
      classAncestor('div', 'section main', ['section', 'main']), // nearest, needs combination
      {
        tagname: 'section',
        attributes: [{
          name: 'id',
          category: 'id' as never,
          rawValue: 'details',
          values: ['details'],
          tokens: ['details']
        }]
      } // farther, unique on its own
    ]
  };

  const selection = makeSelector().select(context);

  assert.ok(selection, 'expected a container selection, got null');
  assert.equal(selection!.part.tagName, 'section');
  const fragmentSelector = selection!.part.fragments?.[0]?.selector ?? '';
  assert.ok(
    fragmentSelector.includes('details'),
    `expected the farther, mono-unique ancestor's fragment, got ${fragmentSelector}`
  );
});

test.after(() => {
  globalThis.document = originalDocument;
});
