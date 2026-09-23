# `extract_atoms`: NVIDIA route and output-format fix

Status: applied in the NVIDIA fork

## Scope

This runbook records the production incident and the fork change that fixed the
NVIDIA `extract_atoms` path. It does not change provider, credential, embedding,
or gateway policy by itself.

## Symptoms

The `extract_atoms` phase stopped making durable progress. Two independent failure
modes were identified:

1. The configured NVIDIA Ultra function returned HTTP 404 (`Function id ... is
   not found`).
2. On the Super route, a reasoning response could consume the output budget before
   emitting the required JSON array. The provider returned HTTP 200 with
   `finishReason=length`, but the parser received malformed/truncated model output.

The watcher also retained an old `provider_failure_streak` after a later round had
made progress, which could produce a stale alert.

## Root causes

### Invalid route

Both extraction model slots pointed at the unavailable route:

- `models.dream.extract_atoms`
- `facts.extraction_model`

The verified production route is:

```text
nvidia:nvidia/nemotron-3-super-120b-a12b
```

The `-a12b` suffix is part of the model identifier and must not be removed.

### Dropped reasoning option

The NVIDIA recipe uses the OpenAI-compatible AI SDK adapter. Therefore the
per-call provider option must be keyed under `openai`, not under the recipe id
`nvidia`:

```ts
{ openai: { reasoningEffort: 'none' } }
```

Using `{ nvidia: { reasoningEffort: 'none' } }` is silently ignored by the
adapter. The reasoning then consumes the output budget and can truncate the JSON
array.

### Stale watcher state

When progress or a new backlog entry is observed after a provider failure, the
watcher must clear `provider_failure_streak` and the previous error state. This is
state hygiene, not a provider recovery mechanism: real 5xx, timeout, or malformed
responses must still remain visible as failures.

## Fork implementation

The route/adapter correction is preserved in commit `d1311f5c6`:

```text
fix: route NVIDIA extraction reasoning options
```

The current implementation is in
`src/core/cycle/extract-atoms.ts`. It applies `reasoningEffort: 'none'` only
when the resolved extraction model starts with `nvidia:` and leaves other model
routes unchanged. The regression test is
`test/cycle/extract-atoms-config-caps.test.ts`.

The watcher state correction is in
`/root/.hermes/profiles/hermcto/scripts/watch-gbrain-atoms-job.py`, which is
operational profile code rather than a GBrain repository file.

## Verification

The original fix was validated with:

- NVIDIA Super canary: HTTP 200 and a valid JSON array with required fields.
- Official drain: backlog reduced from `106` to `60`, then to `26`.
- Watcher: exit code 0, silent output, `provider_failure_streak=0`, empty
  `last_error`.
- Focused extraction configuration tests: 5/5.
- Watcher tests: 40/40.
- Earlier malformed-output fix: 71 focused tests passed and typecheck passed.

A zero backlog proves that no pages are currently awaiting atom extraction; it
does not prove that every future provider round will succeed. Continue to inspect
`extract_health`, current failures, and the next bounded round.

## Current operational checks

Use the canonical runtime environment and avoid creating a second worker:

```bash
gbrain doctor --json
gbrain dream --source default --phase extract_atoms --drain --window 1 --dry-run --json
```

Close an incident only when the current snapshot shows all of the following:

- `extract_atoms_backlog` is zero;
- queue and worker health are normal;
- no active provider or parser error remains; and
- a later bounded round does not reopen the failure.

## Rollback

- Code: `git revert d1311f5c6`.
- Runtime configuration rollback: `/var/lib/gbrain/rollback-extract-atoms-route-20260916.txt`.
- Do not remove credentials or modify embedding configuration as part of this
  rollback.

## Related operational record

The evidence and incident timeline are also recorded in the GBrain page
`ops/gbrain-extract-atoms-route-fix-20260916`.
