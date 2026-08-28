import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { queryAllDeep } from '../src/content/analyzer/dom/deep-query.ts';

const originalDocument = globalThis.document;
const originalWindow = (globalThis as { window?: unknown }).window;

function withPageDOM(html: string, run: () => void) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;

  try {
    run();
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

test('queryAllDeep matches plain querySelectorAll when there is no shadow root', () => {
  withPageDOM('<div class="target">a</div><div class="target">b</div>', () => {
    const result = queryAllDeep('.target');
    assert.equal(result.length, 2);
    assert.deepEqual(result, Array.from(document.querySelectorAll('.target')));
  });
});

test('queryAllDeep finds matches inside a single open shadow root, invisible to plain querySelectorAll', () => {
  withPageDOM('<div id="host"></div>', () => {
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span class="target">inside shadow</span>';

    assert.equal(document.querySelectorAll('.target').length, 0);

    const result = queryAllDeep('.target');
    assert.equal(result.length, 1);
    assert.equal(result[0], shadow.querySelector('.target'));
  });
});

test('queryAllDeep recurses into nested shadow roots', () => {
  withPageDOM('<div id="host"></div>', () => {
    const host = document.getElementById('host')!;
    const outerShadow = host.attachShadow({ mode: 'open' });
    outerShadow.innerHTML = '<div id="mid-host"></div>';
    const midHost = outerShadow.getElementById('mid-host')!;
    const innerShadow = midHost.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = '<span class="target">deeply nested</span>';

    const result = queryAllDeep('.target');
    assert.equal(result.length, 1);
    assert.equal(result[0], innerShadow.querySelector('.target'));
  });
});

test('queryAllDeep cannot see inside a closed shadow root (accepted limitation)', () => {
  withPageDOM('<div id="host"></div>', () => {
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = '<span class="target">hidden</span>';

    assert.equal(host.shadowRoot, null);
    assert.deepEqual(queryAllDeep('.target'), []);
  });
});

test('queryAllDeep returns an empty array for an invalid selector instead of throwing', () => {
  withPageDOM('<div class="target">a</div>', () => {
    assert.deepEqual(queryAllDeep('[[[invalid'), []);
  });
});
