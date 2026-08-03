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

test('ContainerSelector stops at the nearest ancestor that is unique and clears the semantic threshold', () => {
  mockDocument(() => 1);

  const context: DOMContext = {
    element: { tagname: 'span', attributes: [] },
    ancestors: [
      classAncestor('div', 'product-info', ['product', 'info']), // nearest, strongly semantic
      classAncestor('div', 'details', ['details']) // farther, also strongly semantic — must not be reached
    ]
  };

  const selection = makeSelector().select(context);

  assert.ok(selection);
  assert.equal(selection!.isSemanticMatch, true);
  assert.equal(selection!.part.tagName, 'div');
  const fragmentSelector = selection!.part.fragments?.[0]?.selector ?? '';
  assert.ok(
    fragmentSelector.includes('product') || fragmentSelector.includes('info'),
    `expected the nearest ancestor's fragment, got ${fragmentSelector}`
  );
});

test('ContainerSelector falls back to the best-scoring unique ancestor when none clears the threshold', () => {
  mockDocument(() => 1);

  const context: DOMContext = {
    element: { tagname: 'span', attributes: [] },
    ancestors: [
      classAncestor('div', 'wrapper', ['wrapper']), // nearest, non-semantic
      classAncestor('div', 'info', ['info']) // farther, weakly semantic but stronger than "wrapper"
    ]
  };

  const selection = makeSelector().select(context);

  assert.ok(selection);
  assert.equal(selection!.isSemanticMatch, false);
  const fragmentSelector = selection!.part.fragments?.[0]?.selector ?? '';
  assert.ok(
    fragmentSelector.includes('info'),
    `expected the more semantic (farther) ancestor's fragment, got ${fragmentSelector}`
  );
});

test('ContainerSelector returns null when no ancestor uniquely matches', () => {
  mockDocument(() => 3);

  const context: DOMContext = {
    element: { tagname: 'span', attributes: [] },
    ancestors: [
      classAncestor('div', 'product-info', ['product', 'info'])
    ]
  };

  const selection = makeSelector().select(context);

  assert.equal(selection, null);
});

test.after(() => {
  globalThis.document = originalDocument;
});
