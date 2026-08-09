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

function idAncestor(tagname: string, id: string): ElementNodeContext {
  return {
    tagname,
    attributes: [{
      name: 'id',
      category: 'id' as never,
      rawValue: id,
      values: [id],
      tokens: [id]
    }]
  };
}

function classTarget(tagname: string, className: string, tokens: string[]): ElementNodeContext {
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

test('ContainerSelector rejects a container that is unique alone but not unique combined with the target', () => {
  // "cards-list" matches exactly one element on the page (a valid container
  // by the old, container-only check), but it wraps two ".size-m" elements
  // (one per product card) — so "div[id="cards-list"] .size-m" still matches
  // 2 elements. A container that can't actually disambiguate the target must
  // be rejected, not accepted just because it happens to be unique alone.
  mockDocument(selector => {
    if (selector === 'div[id="cards-list"]') return 1;
    if (selector.startsWith('div[id="cards-list"] ')) return 2;
    return 3;
  });

  const context: DOMContext = {
    element: classTarget('button', 'size-option size-m', ['size-option', 'size-m']),
    ancestors: [
      idAncestor('div', 'cards-list')
    ]
  };

  const selection = makeSelector().select(context);

  assert.equal(selection, null, 'expected no container: the only candidate cannot uniquely scope the target');
});

test('ContainerSelector falls through to another ancestor that can actually disambiguate the target', () => {
  // Same setup, but this time a second ancestor ("card-adidas") is also
  // unique alone *and* actually narrows the page down to the one matching
  // ".size-m" — that's the one that should be picked, not "cards-list".
  mockDocument(selector => {
    if (selector === 'div[id="cards-list"]') return 1;
    if (selector.startsWith('div[id="cards-list"] ')) return 2;
    if (selector === 'div[id="card-adidas"]') return 1;
    if (selector.startsWith('div[id="card-adidas"] ')) return 1;
    return 3;
  });

  const context: DOMContext = {
    element: classTarget('button', 'size-option size-m', ['size-option', 'size-m']),
    ancestors: [
      idAncestor('div', 'cards-list'),
      idAncestor('div', 'card-adidas')
    ]
  };

  const selection = makeSelector().select(context);

  assert.ok(selection, 'expected a container selection, got null');
  const fragmentSelector = selection!.part.fragments?.[0]?.selector ?? '';
  assert.ok(
    fragmentSelector.includes('card-adidas'),
    `expected the ancestor that can disambiguate the target, got ${fragmentSelector}`
  );
});

test.after(() => {
  globalThis.document = originalDocument;
});
