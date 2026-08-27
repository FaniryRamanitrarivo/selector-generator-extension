import test from 'node:test';
import assert from 'node:assert/strict';

import { extractAttributeCandidates } from '../src/content/analyzer/candidates/attribute-candidate-extractor.ts';
import type { DOMAttribute } from '../src/content/analyzer/attributes/attribute.ts';

test('extractAttributeCandidates keeps tokens that are only capitalized in the original value (PascalCase/camelCase classes)', () => {
  // tokenizeAttribute lowercases everything it produces, but a class value
  // keeps its original casing (e.g. a MUI/Ant-Design-style "MuiFormGroup-root")
  // — matching tokens back to the value they came from must not be
  // case-sensitive, or every capitalized word gets silently dropped from its
  // own candidate and only the lowercase leftovers (here: "root") remain.
  const attribute: DOMAttribute = {
    name: 'class',
    category: 'class' as never,
    rawValue: 'MuiFormGroup-root css-2433413',
    values: ['MuiFormGroup-root', 'css-2433413'],
    tokens: ['mui', 'form', 'group', 'root', 'css', '2433413']
  };

  const candidates = extractAttributeCandidates([attribute], 'div');
  const muiCandidate = candidates.find(c => c.value === 'MuiFormGroup-root');

  assert.ok(muiCandidate, 'expected a candidate for the "MuiFormGroup-root" class value');
  assert.deepEqual(
    [...muiCandidate!.tokens].sort(),
    ['form', 'group', 'mui', 'root'],
    `expected all four words tokenized from "MuiFormGroup-root" to survive, got ${JSON.stringify(muiCandidate!.tokens)}`
  );
});
