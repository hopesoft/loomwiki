import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredMaintainer } from '../src/server/provider';
import type { SourceDetail } from '../src/shared/source';

const source: SourceDetail = { id: 'fixture', filename: 'fixture.md', text: 'Synthetic evidence.', sha256: 'fixture', importedAt: '2026-11-20', byteLength: 19 };
const draft = { title: 'Synthetic proposal' };
function capture() {
  const calls: { url: string; options: RequestInit; body: Record<string, any> }[] = [];
  const request: typeof fetch = async (input, options = {}) => {
    calls.push({ url: String(input), options, body: JSON.parse(String(options.body)) });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(draft) } }] });
  };
  return { calls, request };
}
test('OpenAI uses its endpoint and completion budget without DeepSeek parameters', async () => {
  const { calls, request } = capture();
  const provider = configuredMaintainer({ LOOMWIKI_PROVIDER: 'openai', LOOMWIKI_API_KEY: 'synthetic' }, request)!;
  const signal = AbortSignal.timeout(1000);
  assert.deepEqual(await provider.suggest(source, [], signal), draft);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(calls[0].body.model, 'gpt-4.1');
  assert.equal(calls[0].body.max_completion_tokens, 6000);
  assert.ok(!('thinking' in calls[0].body));
  assert.ok(!('max_tokens' in calls[0].body));
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.signal, signal);
  assert.deepEqual(JSON.parse(calls[0].body.messages[1].content), { source: { id: source.id, filename: source.filename, text: source.text }, existingPages: [] });
});
test('legacy DeepSeek configurations and explicit selection retain request parameters', async () => {
  for (const config of [{}, { LOOMWIKI_MODEL_URL: 'https://api.deepseek.com/chat/completions', LOOMWIKI_MODEL: 'deepseek-flash' }, { LOOMWIKI_PROVIDER: 'deepseek' }]) {
    const { calls, request } = capture();
    await configuredMaintainer({ LOOMWIKI_API_KEY: 'synthetic', ...config }, request)!.suggest(source, [], AbortSignal.timeout(1000));
    assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
    assert.equal(calls[0].body.max_tokens, 6000);
    assert.deepEqual(calls[0].body.thinking, { type: 'disabled' });
    assert.ok(!('max_completion_tokens' in calls[0].body));
  }
});
test('explicit OpenAI endpoint is inferred and custom endpoints preserve model overrides', async () => {
  for (const config of [{ LOOMWIKI_MODEL_URL: 'https://api.openai.com/v1/chat/completions' }, { LOOMWIKI_PROVIDER: 'openai', LOOMWIKI_MODEL_URL: 'http://127.0.0.1:9999/chat/completions' }]) {
    const { calls, request } = capture();
    await configuredMaintainer({ LOOMWIKI_API_KEY: 'synthetic', LOOMWIKI_MODEL: 'custom-model', ...config }, request)!.suggest(source, [], AbortSignal.timeout(1000));
    assert.equal(calls[0].url, config.LOOMWIKI_MODEL_URL);
    assert.equal(calls[0].body.model, 'custom-model');
    assert.ok(!('thinking' in calls[0].body));
  }
  assert.equal(configuredMaintainer({}), null);
  assert.throws(() => configuredMaintainer({ LOOMWIKI_API_KEY: 'synthetic', LOOMWIKI_PROVIDER: 'typo' }), /LOOMWIKI_PROVIDER/);
});
test('provider failures and incomplete responses fail without exposing response bodies', async () => {
  for (const response of [new Response('private-provider-error', { status: 401 }), Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'invalid JSON' } }] })]) {
    const provider = configuredMaintainer({ LOOMWIKI_PROVIDER: 'openai', LOOMWIKI_API_KEY: 'synthetic' }, async () => response)!;
    await assert.rejects(provider.suggest(source, [], AbortSignal.timeout(1000)), error => error instanceof Error && !error.message.includes('private-provider-error') && /Model request failed|complete JSON suggestion/.test(error.message));
  }
});
