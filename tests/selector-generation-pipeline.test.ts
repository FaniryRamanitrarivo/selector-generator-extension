import test from 'node:test';
import assert from 'node:assert/strict';

import { FragmentScorer } from '../src/content/selector/scoring/fragment-scorer';
import { SelectorScorer } from '../src/content/analyzer/scoring/selector-scorer';
import { generateCSSFragments } from '../src/content/selector/css/css-fragment-generator';
import type { AttributeCandidate } from '../src/content/analyzer/scoring/attribute-candidature';
import type { SelectorFragment } from '../src/content/selector/selector-fragment';
import type { BuildedSelector } from '../src/content/selector/builder/selector-builder';

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
  assert.equal(typeof scored.score, 'number');
  assert.ok(scored.score >= 0);
});

test('generateCSSFragments prioritizes class token matching for readable class selectors', () => {
  const candidate: AttributeCandidate = {
    name: 'class',
    category: 'class' as never,
    value: 'composition',
    tokens: ['composition'],
    score: 10,
    tagName: 'section'
  };

  const fragments = generateCSSFragments(candidate);

  assert.ok(fragments.some(fragment => fragment.selector === '[class~="composition"]'));
  assert.equal(fragments[0]?.selector, '[class~="composition"]');
  assert.ok(fragments.every(fragment => fragment.selector !== '[class="composition"]'));
});

test('SelectorScorer ranks semantic selectors above generic generated ones', () => {
  const scorer = new SelectorScorer([]);

  const semanticSelector: BuildedSelector = {
    selector: 'main[id="product"]',
    score: 0,
    fragmentScores: [10],
    evaluation: {
      targetMatch: true,
      uniquenessScore: 1,
      readabilityScore: 0.95,
      concisionScore: 0.8,
      precisionScore: 0.8,
      lengthScore: 0.8
    }
  };

  const genericSelector: BuildedSelector = {
    selector: 'div[class*="a7df"]',
    score: 0,
    fragmentScores: [5],
    evaluation: {
      targetMatch: true,
      uniquenessScore: 0.9,
      readabilityScore: 0.2,
      concisionScore: 0.85,
      precisionScore: 0.7,
      lengthScore: 0.75
    }
  };

  assert.equal(scorer.compare(semanticSelector, genericSelector), 1);
  assert.equal(scorer.compare(genericSelector, semanticSelector), -1);
});

test('SelectorScorer prefers a more unique selector over a slightly more readable one', () => {
  globalThis.document = {
    querySelectorAll: (selector: string) => {
      if (selector === 'main [id="hero"]') {
        return Array.from({ length: 4 }, () => ({}) as Element);
      }

      if (selector === 'section [class*="generated"]') {
        return Array.from({ length: 32 }, () => ({}) as Element);
      }

      if (selector === 'main') {
        return [{} as Element];
      }

      return [];
    }
  } as unknown as Document;

  const scorer = new SelectorScorer();

  const uniqueSelector: BuildedSelector = {
    selector: 'main [id="hero"]',
    score: 0,
    fragmentScores: [0.8]
  };

  const readableButLessUniqueSelector: BuildedSelector = {
    selector: 'section [class*="generated"]',
    score: 0,
    fragmentScores: [0.7]
  };

  const uniqueResult = scorer.score(uniqueSelector);
  const lessUniqueResult = scorer.score(readableButLessUniqueSelector);

  assert.ok(uniqueResult.score > lessUniqueResult.score);
  assert.ok(uniqueResult.evaluation?.uniquenessScore > lessUniqueResult.evaluation?.uniquenessScore);
});

test('SelectorScorer rewards semantic readability and repetition', () => {
  globalThis.document = {
    querySelectorAll: () => []
  } as unknown as Document;

  const scorer = new SelectorScorer();

  const semanticSelector: BuildedSelector = {
    selector: 'main section product',
    score: 0,
    fragmentScores: [0.8]
  };

  const generatedSelector: BuildedSelector = {
    selector: 'div [class*="a7df"]',
    score: 0,
    fragmentScores: [0.5]
  };

  const semanticResult = scorer.score(semanticSelector);
  const generatedResult = scorer.score(generatedSelector);

  assert.ok(semanticResult.evaluation?.readabilityScore > generatedResult.evaluation?.readabilityScore);
  assert.ok(semanticResult.score > generatedResult.score);
});

test('SelectorScorer gives a small reward for semantic order', () => {
  globalThis.document = {
    querySelectorAll: () => []
  } as unknown as Document;

  const scorer = new SelectorScorer();

  const orderedSelector: BuildedSelector = {
    selector: 'section composition product',
    score: 0,
    fragmentScores: [0.8]
  };

  const reversedSelector: BuildedSelector = {
    selector: 'product composition section',
    score: 0,
    fragmentScores: [0.8]
  };

  const orderedResult = scorer.score(orderedSelector);
  const reversedResult = scorer.score(reversedSelector);

  assert.ok(orderedResult.evaluation?.readabilityScore > reversedResult.evaluation?.readabilityScore);
  assert.ok(orderedResult.score > reversedResult.score);
});

test('SelectorScorer normalizes rule weights so a single high-scoring rule does not dominate', () => {
  const scorer = new SelectorScorer([
    { rule: { apply: () => 0.95 }, weight: 10, name: 'dominant' },
    { rule: { apply: () => 0.6 }, weight: 1, name: 'supporting-a' },
    { rule: { apply: () => 0.6 }, weight: 1, name: 'supporting-b' },
    { rule: { apply: () => 0.6 }, weight: 1, name: 'supporting-c' }
  ]);

  const selector: BuildedSelector = {
    selector: 'main [id="hero"]',
    score: 0,
    fragmentScores: [0.8]
  };

  const result = scorer.score(selector);

  assert.ok(result.evaluation?.ruleScore < 0.9);
  assert.equal(result.debug?.rules?.dominant?.contribution > result.debug?.rules?.['supporting-a']?.contribution, true);
});

test('SelectorScorer exposes detailed score diagnostics', () => {
  globalThis.document = {
    querySelectorAll: () => []
  } as unknown as Document;

  const scorer = new SelectorScorer();
  const selector: BuildedSelector = {
    selector: 'main section product',
    score: 0,
    fragmentScores: [0.8]
  };

  const result = scorer.score(selector);

  assert.ok(result.debug?.contributions);
  assert.ok(result.debug?.rawScores);
  assert.ok(result.debug?.rules);
});

test.after(() => {
  globalThis.document = originalDocument;
});
