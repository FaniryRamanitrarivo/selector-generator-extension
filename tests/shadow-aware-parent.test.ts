import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { getParentAcrossShadow } from '../src/content/analyzer/dom/shadow-aware-parent.ts';

const originalDocument = globalThis.document;
const originalWindow = (globalThis as { window?: unknown }).window;
const originalShadowRoot = (globalThis as { ShadowRoot?: unknown }).ShadowRoot;

function withPageDOM(run: (dom: JSDOM) => void) {
  const dom = new JSDOM('<!doctype html><html><body><div id="light-wrapper"><div id="host"></div></div></body></html>');

  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;
  (globalThis as { ShadowRoot?: unknown }).ShadowRoot = dom.window.ShadowRoot;

  try {
    run(dom);
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { ShadowRoot?: unknown }).ShadowRoot = originalShadowRoot;
  }
}

test('getParentAcrossShadow behaves like .parentElement outside any shadow root', () => {
  withPageDOM(() => {
    const host = document.getElementById('host')!;
    const wrapper = document.getElementById('light-wrapper')!;

    assert.equal(getParentAcrossShadow(host), wrapper);
    assert.equal(getParentAcrossShadow(wrapper), document.body);
    assert.equal(getParentAcrossShadow(document.body), document.documentElement);
  });
});

test('getParentAcrossShadow crosses nested shadow-root boundaries via the host, then continues into the light DOM', () => {
  withPageDOM(() => {
    const host = document.getElementById('host')!;
    const wrapper = document.getElementById('light-wrapper')!;

    const outerShadow = host.attachShadow({ mode: 'open' });
    outerShadow.innerHTML = '<div id="mid-host"></div>';
    const midHost = outerShadow.getElementById('mid-host')!;

    const innerShadow = midHost.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = '<span id="leaf">Target</span>';
    const leaf = innerShadow.getElementById('leaf')!;

    // Sanity check: plain .parentElement dead-ends at each shadow boundary.
    assert.equal(leaf.parentElement, null);
    assert.equal(midHost.parentElement, null);

    const path: Element[] = [leaf];
    let current: Element | null = leaf;

    while (current && current !== document.body) {
      current = getParentAcrossShadow(current);
      if (current) path.push(current);
    }

    assert.deepEqual(path, [leaf, midHost, host, wrapper, document.body]);
  });
});
