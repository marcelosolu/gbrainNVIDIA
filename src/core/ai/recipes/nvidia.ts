import type { Recipe } from '../types.ts';

/**
 * NVIDIA NIM / API Catalog exposes OpenAI-compatible /v1/chat/completions
 * and /v1/embeddings APIs.
 *
 * Retrieval models use asymmetric encoding. The gateway maps gbrain's
 * document/query distinction to NVIDIA's wire values:
 *   document -> input_type: passage
 *   query    -> input_type: query
 *
 * The model ids below intentionally keep NVIDIA's full catalog ids because
 * the hosted endpoint expects values like `nvidia/nv-embedqa-e5-v5` in the
 * request body. Short aliases are provided for CLI ergonomics.
 */
export const nvidia: Recipe = {
  id: 'nvidia',
  name: 'NVIDIA NIM',
  tier: 'openai-compat',
  implementation: 'openai-compatible',
  base_url_default: 'https://integrate.api.nvidia.com/v1',
  auth_env: {
    required: ['NVIDIA_API_KEY'],
    setup_url: 'https://build.nvidia.com',
  },
  aliases: {
    'nv-embedqa-e5-v5': 'nvidia/nv-embedqa-e5-v5',
    'llama-nemotron-embed-1b-v2': 'nvidia/llama-nemotron-embed-1b-v2',
    'nemotron-3-super': 'nvidia/nemotron-3-super-120b-a12b',
    'nemotron-3-super-120b-a12b': 'nvidia/nemotron-3-super-120b-a12b',
    // Full catalog id usable as a bare suffix: `nvidia:nemotron-3-ultra-550b-a55b`
    // (single prefix) must resolve — TIER_DEFAULTS.deep points at it.
    'nemotron-3-ultra-550b-a55b': 'nvidia/nemotron-3-ultra-550b-a55b',
    'nv-embed-v1': 'nvidia/nv-embed-v1',
    'nv-embedcode-7b-v1': 'nvidia/nv-embedcode-7b-v1',
  },
  // No resolveAuth override: NVIDIA is plain `Authorization: Bearer <key>`,
  // which defaultResolveAuth derives from auth_env.required. IRON RULE
  // (test/ai/recipes-existing-regression.test.ts): only Azure overrides
  // resolveAuth.
  touchpoints: {
    chat: {
      models: [
        'nvidia/nemotron-3-super-120b-a12b',
        // NVIDIA-only fork (2026-09-08): ultra validado em produção
        // (canário A/B 9/9 atoms; contexto 1M; job 22625 completed).
        'nvidia/nemotron-3-ultra-550b-a55b',
      ],
      supports_tools: true,
      supports_subagent_loop: true,
      // Ultra: 1M de contexto (catálogo NVIDIA 2026-09-08).
      max_context_tokens: 1000000,
      price_last_verified: '2026-09-08',
    },
    embedding: {
      models: [
        'nvidia/nv-embedqa-e5-v5',
        'nvidia/llama-nemotron-embed-1b-v2',
        'nvidia/nv-embed-v1',
        'nvidia/nv-embedcode-7b-v1',
      ],
      // Canonical default: nv-embed-v1 is the general-purpose embedding model
      // (the QA/e5 model has a 512-token input cap and code model is niche).
      // init's `--embedding-model nvidia` shorthand resolves here, not to
      // models[0].
      default_model: 'nvidia/nv-embed-v1',
      // Default to the lightest tested hosted model. Larger NVIDIA models are
      // supported via explicit embedding_dimensions (2048 or 4096).
      default_dims: 1024,
      dims_options: [1024, 2048, 4096],
      // #4530: hard per-INPUT token caps (distinct from the batch budget).
      // nv-embedqa-e5-v5 is an e5-family encoder with the original 512-token
      // pre-training context; the hosted endpoint rejects any single input
      // over it with a non-transient 400 ("Input length N exceeds maximum
      // allowed token size 512"). Declaring it here makes the chunker split
      // chunks to fit (resolveMaxChunkTokens). Only confirmed limits are
      // declared — models absent from the map keep the default cap.
      max_input_tokens: {
        'nvidia/nv-embedqa-e5-v5': 512,
      },
      // Conservative split; hosted NVIDIA embedding endpoints require
      // input_type and may reject large payloads before tokenizing.
      max_batch_tokens: 8192,
      chars_per_token: 4,
      safety_factor: 0.75,
      cost_per_1m_tokens_usd: undefined,
      price_last_verified: '2026-05-24',
    },
  },
  setup_hint: 'Get an API key at https://build.nvidia.com, then `export NVIDIA_API_KEY=...`.',
};
