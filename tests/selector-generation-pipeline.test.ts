import test from 'node:test';
import assert from 'node:assert/strict';

import { FragmentScorer } from '../src/content/selector/scoring/fragment-scorer';
import type { AttributeCandidate } from '../src/content/analyzer/scoring/attribute-candidature';
import type { SelectorFragment } from '../src/content/selector/selector-fragment';

const originalDocument = globalThis.document;

test('FragmentScorer rewards exact and unique fragments', () => {
  globalThis.document = {
    querySelectorAll: (selector: string) => {
      if (selector === '[id="hero"]') {
        return [{ id: 'hero' }];
      }

      return [];
    }
  } as unknown as Document;

  const scorer = new FragmentScorer();
  const fragment: SelectorFragment = {
    selector: '[id="hero"]',
    score: 10,
    operator: 'exact'
  };

  const candidate: AttributeCandidate = {
    name: 'id',
    category: 'id' as never,
    value: 'hero',
    tokens: ['hero'],
    score: 10,
    tagName: 'div'
  };

  const scored = scorer.score(fragment, candidate, 'div');

  assert.equal(scored.resultCount, 1);
  assert.ok(scored.score > fragment.score);
});

test.after(() => {
  globalThis.document = originalDocument;
});
