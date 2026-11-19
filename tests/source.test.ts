import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, symlink, readdir, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SourceStore } from '../src/server/store';
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'loomwiki-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, store: new SourceStore(root) };
}
test('preserves Unicode, BOM, CRLF and absent final newline across restart', async t => {
  const { root, store } = await fixture(t);
  const bytes = Buffer.from('\ufeff# Notes\r\nCafé — 日本語');
  const source = await store.import('notes.md', bytes);
  const saved = JSON.parse(await readFile(path.join(root, source.id + '.json'), 'utf8'));
  assert.deepEqual(Buffer.from(saved.base64, 'base64'), bytes);
  assert.equal((await new SourceStore(root).read(source.id)).text, bytes.toString('utf8'));
});
test('identical import is reused; changed content preserves both versions', async t => {
  const { store } = await fixture(t);
  const first = await store.import('policy.md', Buffer.from('30 days'));
  assert.deepEqual(await store.import('policy.md', Buffer.from('30 days')), first);
  const second = await store.import('policy.md', Buffer.from('90 days'));
  assert.notEqual(first.id, second.id);
  assert.equal((await store.read(first.id)).text, '30 days');
  assert.equal((await store.list()).length, 2);
});
test('rejects unsupported, oversized, empty, invalid UTF-8 and path input without artifacts', async t => {
  const { store, root } = await fixture(t);
  for (const [name, bytes] of [['../a.md', Buffer.from('a')], ['a.txt', Buffer.from('a')], ['a.md', Buffer.from([255])], ['a.md', Buffer.alloc(0)], ['a.md', Buffer.alloc(1024 * 1024 + 1)]] as const) await assert.rejects(store.import(name, bytes));
  assert.deepEqual(await readdir(root), []);
  await assert.rejects(store.read('../a'));
});
test('detects source tampering and refuses symlinked artifact reads', async t => {
  const { store, root } = await fixture(t);
  const source = await store.import('a.md', Buffer.from('original'));
  const file = path.join(root, source.id + '.json');
  const record = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...record, base64: Buffer.from('changed!').toString('base64') }));
  await assert.rejects(store.read(source.id), /integrity/);
  await rm(file); await symlink(path.join(root, 'missing'), file);
  await assert.rejects(store.read(source.id));
});
