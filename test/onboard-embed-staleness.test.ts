/** Regression coverage for the doctor embed-staleness metric.
 *
 * The executor excludes pages marked with frontmatter.embed_skip. The doctor
 * must use the same shared SQL predicate, otherwise accepted non-embeddable
 * pages appear as a permanent warning.
 */
import { describe, expect, test } from 'bun:test';
import type { BrainEngine } from '../src/core/engine.ts';
import { checkEmbedStaleness } from '../src/core/onboard/checks.ts';
import { EMBED_SKIP_FILTER_FRAGMENT } from '../src/core/embed-skip.ts';

describe('checkEmbedStaleness', () => {
  test('uses the shared embed-skip predicate in a brain-wide chunks query', async () => {
    const queries: string[] = [];
    const engine = {
      async executeRaw(sql: string) {
        queries.push(sql);
        return [{ count: 0 }];
      },
    } as unknown as BrainEngine;

    const result = await checkEmbedStaleness(engine);

    expect(result.check).toEqual({
      name: 'embed_staleness',
      status: 'ok',
      message: 'No stale chunks',
    });
    expect(result.remediations).toEqual([]);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('FROM content_chunks cc');
    expect(queries[0]).toContain('JOIN pages p ON p.id = cc.page_id');
    expect(queries[0]).toContain(EMBED_SKIP_FILTER_FRAGMENT);
  });

  test('still reports an actionable warning for eligible stale chunks', async () => {
    const engine = {
      async executeRaw() {
        return [{ count: 1 }];
      },
    } as unknown as BrainEngine;

    const result = await checkEmbedStaleness(engine);

    expect(result.check.status).toBe('warn');
    expect(result.check.message).toBe('1 stale chunks (small backlog)');
    expect(result.remediations).toHaveLength(1);
    expect(result.remediations[0].job).toBe('embed-catch-up');
  });
});
