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

// Mirrors what was actually observed on a live e-commerce page (UGG's product
// page, a Salesforce Commerce Cloud site): a widely-reused class token
// ("container", used site-wide as a generic layout/utility class) needs to be
// combined with a rarer, more specific one ("attribute") to uniquely scope a
// product's size-selector widget. A third, unrelated token ("js", a common
// JS-hook class prefix) happens to be rarer on the page than either "attribute"
// or "container" alone, so every one of its operator variants (~=/*=/^=/$=)
// out-scores them individually — even though no combination involving "js" is
// actually unique.
function mockDocument() {
  globalThis.document = {
    querySelectorAll: (selector: string) => {
      const hasJs = selector.includes('"js"');
      const hasAttribute = selector.includes('"attribute"');
      const hasContainer = selector.includes('"container"');

      if (hasAttribute && hasContainer && !hasJs) {
        return Array.from({ length: 1 });
      }

      if (hasJs) {
        return Array.from({ length: 3 });
      }

      if (hasAttribute) {
        return Array.from({ length: 20 });
      }

      if (hasContainer) {
        return Array.from({ length: 166 });
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

test('ContainerSelector combined pass still finds a needed-but-uncommon token even when a rarer, unrelated token out-scores it on every operator variant', () => {
  mockDocument();

  const attributeContainerAncestor: ElementNodeContext = {
    tagname: 'div',
    attributes: [{
      name: 'class',
      category: 'class' as never,
      rawValue: 'attribute-container js-attribute-container',
      values: ['attribute-container', 'js-attribute-container'],
      tokens: ['attribute', 'container', 'js']
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
    fragmentSelector.includes('"attribute"') && fragmentSelector.includes('"container"'),
    `expected the combined fragment to reference both "attribute" and "container", got ${fragmentSelector}`
  );
  assert.ok(
    !fragmentSelector.includes('"js"'),
    `did not expect the "js" token in the winning fragment, got ${fragmentSelector}`
  );
});

test.after(() => {
  globalThis.document = originalDocument;
});
