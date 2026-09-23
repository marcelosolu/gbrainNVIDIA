# nvidia — the `nvidia` recipe (NVIDIA NIM, this fork's default)

This page documents the `nvidia` recipe as it ships. The implementation
lives at `src/core/ai/recipes/nvidia.ts`. It is the **new-install default**
for embeddings in this fork — `gbrain init` picks `nvidia:nv-embed-v1` when
`NVIDIA_API_KEY` is present.

NVIDIA NIM exposes OpenAI-compatible `/v1/chat/completions` and
`/v1/embeddings` endpoints at `https://integrate.api.nvidia.com/v1`.
Retrieval models use asymmetric encoding; the gateway maps gbrain's
document/query distinction to NVIDIA's wire values (`input_type: passage`
for documents, `input_type: query` for queries).

## Setup

Get a free API key at https://build.nvidia.com, then:

```bash
export NVIDIA_API_KEY=nvapi-…
```

Then re-run `gbrain init --pglite` (or pass `--embedding-model nvidia:nv-embed-v1`
explicitly). The canonical model id keeps NVIDIA's full catalog form
(`nvidia/nv-embed-v1`); short aliases (`nv-embed-v1`, `nemotron-3-super`, …)
resolve the same way.

## Models

| Touchpoint | Models |
|---|---|
| Chat | `nvidia/nemotron-3-super-120b-a12b` |
| Embedding | `nvidia/nv-embed-v1` (**default**), `nvidia/nv-embedqa-e5-v5`, `nvidia/llama-nemotron-embed-1b-v2`, `nvidia/nv-embedcode-7b-v1` |

`nv-embed-v1` @ 1024d is the new-install default. `nv-embedqa-e5-v5` has a
hard 512-token per-input cap (e5 family) — the chunker splits chunks to fit
it automatically, but prefer `nv-embed-v1` for general brains.

## Constraints

- **No rerank API.** NVIDIA NIM exposes no rerank endpoint, so the reranker
  default is Voyage `rerank-2.5` (needs `VOYAGE_API_KEY`); without it, keyless
  brains fail open per search (`RerankError('no_key')`) and simply run without
  reranking.
- **Chat models: no tool calling.** The Nemotron chat touchpoint declares
  `supports_tools: false` / `supports_subagent_loop: false` — do not use
  NVIDIA chat models as minion/subagent drivers until tool-calling stability
  is proven through a separate adapter test. Use them for chat/expansion;
  keep embedding on `nv-embed-v1`.
- **Auth is plain Bearer.** `NVIDIA_API_KEY` is sent as
  `Authorization: Bearer <key>`; no custom auth override.
