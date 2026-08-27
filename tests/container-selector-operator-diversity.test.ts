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

// Mirrors a second live e-commerce observation (UGG again, same "attribute
// container" widget): the *tokens* needed ("attribute" and "container") were
// both present in the top-ranked candidates, but the specific *operator*
// variant of each token that scores highest standalone (endsWith for
// "attribute", containsWord for "container" — both rarer alone, globally,
// than their `*=` counterparts) doesn't actually resolve back to this
// ancestor when paired together. Only `[class*="attribute"][class*="container"]`
// (contains, for both) is unique here — but the standalone-best variants
// (`$=`/`~=`) are the only ones a naive "keep the best fragment per token"
// dedup would ever try, so that pair is never attempted.
function mockDocument() {
  globalThis.document = {
    querySelectorAll: (selector: string) => {
      const hasAttribute = selector.includes('"attribute"');
      const hasContainer = selector.includes('"container"');

      if (hasAttribute && hasContainer) {
        const isContainsCombo = selector.includes('[class*="attribute"]') && selector.includes('[class*="container"]');
        return Array.from({ length: isContainsCombo ? 1 : 4 });
      }

      if (hasAttribute) {
        // endsWith scores highest standalone (rarer alone) even though it's
        // not part of the one combination that's actually unique.
        return Array.from({ length: selector.includes('[class$="attribute"]') ? 2 : 25 });
      }

      if (hasContainer) {
        // containsWord scores highest standalone, for the same reason.
        return Array.from({ length: selector.includes('[class~="container"]') ? 2 : 25 });
      }

      return Array.from({ length: 5 });
    }
  } as unknown as Document;
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

test('ContainerSelector combined pass tries every operator variant of a needed token, not just the one that scores highest standalone', () => {
  mockDocument();

  const attributeContainerAncestor: ElementNodeContext = {
    tagname: 'div',
    attributes: [{
      name: 'class',
      category: 'class' as never,
      rawValue: 'attribute-container',
      values: ['attribute-container'],
      tokens: ['attribute', 'container']
    }]
  };

  const context: DOMContext = {
    element: { tagname: 'span', attributes: [] },
    ancestors: [attributeContainerAncestor]
  };

  const selection = makeSelector().select(context, false);

  assert.ok(selection, 'expected a container selection, got null');
  assert.equal(selection!.matchCount, 1);

  const fragmentSelector = selection!.part.fragments?.[0]?.selector ?? '';
  assert.ok(
    fragmentSelector.includes('[class*="attribute"]') && fragmentSelector.includes('[class*="container"]'),
    `expected the contains (*=) variant of both tokens, got ${fragmentSelector}`
  );
});

test.after(() => {
  globalThis.document = originalDocument;
});
