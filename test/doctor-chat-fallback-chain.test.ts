import { describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrainEngine } from '../src/core/engine.ts';
import { checkChatFallbackChain } from '../src/commands/doctor.ts';
import { emptyHome, withEnv } from './helpers/with-env.ts';

function engineWithDbValue(value: string | null): BrainEngine {
  return {
    getConfig: async (key: string) => key === 'chat_fallback_chain' ? value : null,
  } as unknown as BrainEngine;
}

describe('chat_fallback_chain validation', () => {
  test('loads the effective env config in the production one-argument call shape', async () => {
    const engine = engineWithDbValue(null);
    const configHome = emptyHome();
    mkdirSync(join(configHome, '.gbrain'));
    writeFileSync(join(configHome, '.gbrain', 'config.json'), '{"engine":"pglite"}');

    await withEnv(
      { GBRAIN_HOME: configHome, GBRAIN_CHAT_FALLBACK_CHAIN: 'openai:gpt-5.6-luna' },
      async () => {
        expect(await checkChatFallbackChain(engine)).toBeNull();
      },
    );
    await withEnv(
      { GBRAIN_HOME: configHome, GBRAIN_CHAT_FALLBACK_CHAIN: undefined },
      async () => {
        expect(await checkChatFallbackChain(engine)).toBeNull();
      },
    );
  });

  test('warns with the full remediation message when both planes hold a value', async () => {
    const check = await checkChatFallbackChain(
      engineWithDbValue('["openai:gpt-5.2"]'),
      { chat_fallback_chain: ['anthropic:claude-sonnet-4-6'] },
    );

    expect(check).toBeNull();
  });

  test('does not warn when only the DB-plane value is configured', async () => {
    const check = await checkChatFallbackChain(
      engineWithDbValue('["openai:gpt-5.2"]'),
      { chat_fallback_chain: [] },
    );

    expect(check).toBeNull();
  });

  test('warns for malformed or unsupported routes without exposing the route value', async () => {
    const malformed = await checkChatFallbackChain(
      engineWithDbValue(null),
      { chat_fallback_chain: ['not-a-provider-model'] },
    );
    expect(malformed?.status).toBe('warn');
    expect(malformed?.message).not.toContain('not-a-provider-model');

    for (const route of [
      'openrouter:/x:free',
      'openrouter:x/:free',
      'openrouter:x:y:free',
      'openrouter: x/y:free',
      ' openrouter:nvidia/nemotron-3-ultra-550b-a55b:free ',
    ]) {
      const malformed = await checkChatFallbackChain(
        engineWithDbValue(null),
        { chat_fallback_chain: [route] },
      );
      expect(malformed?.status).toBe('warn');
    }
  });

  test('warns when the configured chain exceeds the safe limit', async () => {
    const check = await checkChatFallbackChain(
      engineWithDbValue(null),
      { chat_fallback_chain: [
        'openrouter:a/model-1:free',
        'openrouter:a/model-2:free',
        'openrouter:a/model-3:free',
        'openrouter:a/model-4:free',
      ] },
    );
    expect(check?.status).toBe('warn');
    expect(check?.message).toContain('limite seguro');
  });
  test('stays silent when the key is unset or explicitly empty', async () => {
    expect(await checkChatFallbackChain(engineWithDbValue(null), null)).toBeNull();
    expect(
      await checkChatFallbackChain(engineWithDbValue('[]'), { chat_fallback_chain: [] }),
    ).toBeNull();
  });
});
