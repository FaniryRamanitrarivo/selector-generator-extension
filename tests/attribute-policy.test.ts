import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldIgnoreAttribute } from '../src/content/analyzer/attributes/attribute-policy.ts';
import { extractAttributeCandidates } from '../src/content/analyzer/candidates/attribute-candidate-extractor.ts';
import type { DOMAttribute } from '../src/content/analyzer/attributes/attribute.ts';

test('shouldIgnoreAttribute excludes legacy presentational attributes', () => {
  for (const name of ['style', 'width', 'height', 'border', 'align', 'valign', 'bgcolor', 'color', 'cellpadding', 'cellspacing', 'hspace', 'vspace']) {
    assert.equal(shouldIgnoreAttribute(name), true, `expected "${name}" to be ignored`);
  }
});

test('shouldIgnoreAttribute excludes alt text (content-specific, not reusable across pages)', () => {
  assert.equal(shouldIgnoreAttribute('alt'), true);
});

test('shouldIgnoreAttribute excludes live-toggled state attributes', () => {
  for (const name of [
    'open',
    'aria-expanded',
    'aria-selected',
    'aria-checked',
    'aria-pressed',
    'aria-current',
    'aria-hidden',
    'aria-busy',
    'aria-invalid',
    'aria-activedescendant',
    'aria-valuenow',
    'aria-valuetext',
    'aria-grabbed'
  ]) {
    assert.equal(shouldIgnoreAttribute(name), true, `expected "${name}" to be ignored as volatile state`);
  }
});

test('shouldIgnoreAttribute still allows stable, descriptive attributes through', () => {
  for (const name of ['id', 'class', 'name', 'role', 'data-testid', 'aria-label', 'aria-labelledby', 'aria-describedby', 'title']) {
    assert.equal(shouldIgnoreAttribute(name), false, `expected "${name}" to remain usable`);
  }
});

test('extractAttributeCandidates produces no candidate at all for a volatile aria-expanded attribute', () => {
  const attribute: DOMAttribute = {
    name: 'aria-expanded',
    category: 'aria' as never,
    rawValue: 'false',
    values: ['false'],
    tokens: ['false']
  };

  assert.deepEqual(extractAttributeCandidates([attribute], 'button'), []);
});

test('extractAttributeCandidates still produces a candidate for the stable aria-label attribute', () => {
  const attribute: DOMAttribute = {
    name: 'aria-label',
    category: 'aria' as never,
    rawValue: 'Fermer',
    values: ['Fermer'],
    tokens: ['fermer']
  };

  const candidates = extractAttributeCandidates([attribute], 'button');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.value, 'Fermer');
});

test('extractAttributeCandidates drops width/height/alt noise on an image-like element', () => {
  const attributes: DOMAttribute[] = [
    { name: 'width', category: 'other' as never, rawValue: '300', values: ['300'], tokens: [] },
    { name: 'height', category: 'other' as never, rawValue: '200', values: ['200'], tokens: [] },
    { name: 'alt', category: 'alt' as never, rawValue: 'Red sneaker, side view', values: ['Red sneaker, side view'], tokens: [] }
  ];

  assert.deepEqual(extractAttributeCandidates(attributes, 'img'), []);
});
