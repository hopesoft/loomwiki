import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Evidence } from '../src/web/Evidence';

test('Inspect original opens beside the citation, shows progress, restores focus, and retries errors', async () => {
  const dom = new JSDOM('<div id="test-root"></div>', { url: 'http://127.0.0.1:4310' });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const container = dom.window.document.getElementById('test-root')!;
  const root = createRoot(container);
  let finish!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); };
  const citation = { sourceId: 'a'.repeat(64), quote: '30 days' };
  const source = { id: citation.sourceId, filename: 'policy.md', text: '# Policy\n30 days\n<script>unsafe</script>', sha256: 'b'.repeat(64), byteLength: 30, importedAt: '2026-11-20' };
  try {
    await act(async () => root.render(createElement(Evidence, { citations: [citation] })));
    const trigger = container.querySelector('button')!;
    await act(async () => { (container.querySelector('details') as HTMLDetailsElement).open = true; trigger.click(); });
    assert.match(container.querySelector('[role="status"]')!.textContent!, /Loading/);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(dom.window.document.activeElement, container.querySelector('[aria-label="Original source"]'));
    await act(async () => finish(new Response(JSON.stringify(source))));
    const panel = container.querySelector('[aria-label="Original source"]')!;
    assert.equal(panel.parentElement?.tagName, 'BLOCKQUOTE');
    assert.equal(panel.querySelector('pre')!.textContent, source.text);
    assert.equal(panel.querySelector('script'), null);
    assert.equal(container.querySelector('[role="status"]'), null);
    await act(async () => trigger.click());
    assert.equal(container.querySelector('[aria-label="Original source"]'), null);
    assert.equal(dom.window.document.activeElement, trigger);
    await act(async () => trigger.click());
    await act(async () => finish(new Response(JSON.stringify({ error: 'Source not found.' }), { status: 404 })));
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /Source not found/);
    const retry = container.querySelector('[role="alert"] button') as HTMLButtonElement;
    await act(async () => retry.click());
    await act(async () => finish(new Response(JSON.stringify(source))));
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.equal(calls, 3);
    assert.equal(container.querySelector('pre')!.textContent, source.text);
    await act(async () => root.render(createElement(Evidence, { citations: [{ ...citation, sourceId: 'c'.repeat(64) }] })));
    assert.equal(container.querySelector('pre'), null, 'A different citation must not display the previous source.');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    for (const [name, descriptor] of [['window', originalWindow], ['document', originalDocument], ['IS_REACT_ACT_ENVIRONMENT', originalAct]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    dom.window.close();
  }
});
