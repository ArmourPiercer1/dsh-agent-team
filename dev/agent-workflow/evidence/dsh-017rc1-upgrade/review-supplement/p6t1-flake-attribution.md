# p6t1-parallel flake attribution (review-supplement round)

**Class: E — pre-existing latent concurrency race in the plugin's own
compatibility admission chain, newly EXPOSED (not introduced) by this
round's +14 tests under the shared in-process vitest pool.**
Not a regression of any behavior this round changed; the failing code
path (`packages/runtime/compatibility/*`, `activation/provider.ts`) is
byte-identical to the pre-supplement state.

## Observed error (captured in-process, tagged probe, then reverted)

```
ActivationError: activation: compatibility could not be established (reprobe-failed) — admission fails closed (invariant 50)
```

Thrown from `packages/runtime/activation/provider.ts:654` (step 6, the
new-work admission gate) when `createCompatibilityAuthority().admit()`
returns `decision: 'reprobe'` with `reprobeReason: 'reprobe-failed'`
(`packages/runtime/compatibility/authority.ts:259-270`): the inline
re-probe (`prober.probe(STALE_GENERATION_BEFORE_NEW_WORK)`) THREW
instead of producing a verdict.

## Race mechanism (source level)

- Each activation request builds its OWN authority instance
  (`provider.ts:629` → `createCompatibilityAuthority(...)` per request),
  and each authority builds its OWN prober (`authority.ts:235`).
- The prober's serialization lock is a promise chain PER PROBER INSTANCE
  (`probe.ts` `withLock`, "one durable writer per prober (the P6-T1
  provider pattern)") — it does NOT serialize across authority
  instances for the SAME rootSessionId.
- Two parallel same-root activations therefore run two unsynchronized
  probes. The probe's durable write is `replaceState` =
  `compatibility.delete(root)` → `compatibility.put(record)` →
  `teamSessions.advanceGeneration(root)` — three separate awaits
  (`probe.ts:256-260`). Interleaved, the second probe's `get` can land
  in the first probe's delete→put gap (state anomaly / generation
  conflict) and the probe rejects → `REPROBE_FAILED` → fail-closed
  (invariant 50) → one of the two activations errors → the P1
  assertions (`errors.length === 0`, `results.length === 2`) fail.
- The `withLock` chain + the P3 design (intentional quota overrun) show
  the per-root write serialization was intended PER PROBER; the
  per-request authority lifetime breaks that assumption under
  same-root parallelism. Narrow window — hence 0/6 at baseline load.

## A/B matrix (this session; machine 32 cores, ~1.5 idle load; vitest `pool: 'threads'` = ALL test files share ONE process/event loop)

| # | sources | node_modules (lockfile) | extra load | p6t1-parallel | full-suite failure set |
| --- | --- | --- | --- | --- | --- |
| 1 | baseline (pre-supplement) | baseline | none, parallel ×2 | PASS ×2 (9 tests, ~5ms) | 10F\|20F (baseline 3842) |
| 2 | baseline | baseline | +16 `yes` workers (half the cores), parallel ×2 | PASS ×2 (9 tests, ~5ms) | 10F\|20F |
| 3 | baseline | **NEW (F1 re-resolution)** | none, parallel ×2 | PASS ×2 (9 tests, 7-9ms) | 10F\|20F |
| 4 | **supplement** | NEW | none, serial (`--no-file-parallelism`) ×1 | PASS | 10F\|20F\|3836P(3856) |
| 5 | supplement | NEW | none, parallel ×12 (this round's runs) | **FAIL ~40%** (2-3 of the 12; REPROBE_FAILED in P1, captured) | clean runs: 10F\|20F\|3836P(3856); flake runs: 11F\|21-23F |
| 6 | supplement, p6t1 cluster standalone (5 p6t1 files) | NEW | none, ×2 | PASS ×2 | — |
| 7 | baseline, p6t1 standalone | baseline | none, ×3 | PASS ×3 | — |

Module-instance split check (new lockfile): `require.resolve` of
`@deepseek-ai/dsh-llm` / `@deepseek-ai/dsh-scope` / `@deepseek-ai/cordis`
from the re-instantiated `dsh-agent-preset-registry` context vs the
runtime package context → **SAME** (no dual instances; the instantiation
change is not a module-identity split).

## Attribution conclusion

1. The NEW lockfile/node_modules is NOT the trigger: rows 1-3 (baseline
   sources, incl. new node_modules) are 6/6 clean; the only runtime
   deltas of the re-resolution (dsh-mcp-client / dsh-agent-preset-registry
   peer-variant churn) produce no instance split and no behavioral
   delta.
2. OS-level CPU load is NOT the trigger: row 2 survives +16 busy cores.
3. The trigger is IN-PROCESS contention: vitest `pool: 'threads'` runs
   every test file as a worker THREAD in the same process (shared event
   loop, by design — see vitest.config.ts header: worker_threads, no
   fork). This round's +14 tests (7 compat + 7 client F2/F3) widen the
   scheduling window in which the P1 two-parallel-activations race the
   compatibility probe's delete→put→advanceGeneration gap. Baseline
   suite load = 0/6 hits; supplement suite load = ~40% hits; p6t1
   standalone = 0/5 (no competing threads) in BOTH source states.
4. Therefore: PRE-EXISTING race (the code shipped since P6 is
   untouched by this diff), LOAD-SENSITIVE exposure (this round's added
   tests), classified as class E (newly exposed pre-existing
   instability) — see the updated failure-classification.md.

## Gate position ("zero new failures")

- The deterministic floor is clean and repeatable: serial full suite
  (row 4) = 10F|20F|3836P(3856) with the failure set BYTE-IDENTICAL to
  the baseline classification (10 files / 20 tests, same names — see
  failure-classification.md supplement delta).
- Standalone and per-package runs are clean (rows 4, 6).
- The parallel full-suite flake is a property of ONE pre-existing test
  file (p6t1-parallel) whose race window this round's extra load widens;
  it is documented here with the full matrix and the source-level
  mechanism, and filed as a follow-up (post-upgrade-followups.md)
  because the FIX (per-root probe serialization shared across authority
  instances, or repository-level serialization of the compatibility
  replaceState + advanceGeneration) lives in the runtime compatibility
  chain — outside this round's file scope (guide scope discipline:
  record, don't fix).

## Suggested fix (for the follow-up, NOT applied this round)

Serialize the compatibility re-probe per ROOT SESSION, not per prober
instance: e.g. a module-level/root-keyed promise chain around
`prober.probe` (+ the replaceState triple) shared across all authority
instances for the same rootSessionId — the P6-T1 "one durable writer"
intent restored at the root scope. Then the P1 interleaving becomes
deterministic (second probe observes the first's durable state,
fingerprint matches, no re-probe).
