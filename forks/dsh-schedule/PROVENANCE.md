# FORK: @deepseek-ai/dsh-schedule (full feature-plugin fork, NOT a patch)

## Root ruling (2026-10-26)
Upstream source/Core is never modified (CORE PATCH BUDGET = 0 stands). The
trigger-governance gap (measured: runtime.ts:51 withoutInitiator → :101
resolveAgent → :123 agent.followup with no public pre-delivery seam; the
API admission at session-controller commands.ts:338-365 is RPC-only and
non-permission) closes via ROUTE (1): fork the WHOLE feature plugin and
maintain it ourselves. This directory is that complete fork — not a
scattered patch set.

## Provenance / license / version locator
- Source: `deepseek-ai/deepseek-harness` monorepo, package
  `@deepseek-ai/dsh-schedule`, directory `packages/schedule/schedule`.
- Pinned baseline: **0.2.0-rc.2 @ commit 639ed015397290b3745d163aafe02ffee4aa3f84**
  (the pristine test-use checkout `tests/deepseek-harness-test-use`,
  detached at the official release point; paths.mjs is the pin authority).
- License: MIT (upstream package.json `license` + repo LICENSE copied here
  verbatim; upstream copyright unchanged).
- Copied file set (byte-for-byte at import time): src/{client,
  delivery-history,domain,index,invariant,runtime,storage,tools,types,
  update}.ts + package.json + LICENSE.

## Fork deltas (every deviation is marked `// FORK(` in code)
1. `src/runtime.ts`: an OPTIONAL trigger-admission consumer is consulted
   (a) BEFORE `resolveAgent` for each due group and (b) once more
   immediately BEFORE `agent.followup` (per-trigger NEW consumption).
   Consumer absent or refusing => NO resolve, NO wake, NO flush, NO
   commit — the row stays `active` (never a fake delivery success); an
   in-memory backoff prevents a reject-spin hot loop with ZERO persisted
   state change (no schema extension).
2. `src/index.ts`: the consumer is threaded from the service construction
   options (assembly seam). The Team plane's existing PA/Guard audit is
   the audit carrier (the consumer IS the governed admission); this fork
   mints NO parallel ledger and NO new persisted schema.
3. package.json version gains the fork suffix `+fork.a5m2.1` (version
   locator; everything else verbatim).

## Assembly replacement law
The fork REPLACES the original plugin in the running assembly; the
original provider and this fork MUST NEVER arm two timers at once (one
durable obligation owner). Replacement is an ASSEMBLY decision recorded
by the mount card; nothing here self-registers.

## Preserved laws (verbatim, unchanged)
Service/tools/domain/storage/clock; recurring batch framing and
occurrence math; the exactly-one-selector create validation; update
ownership pre-read; commit-after-flush; shutdown drain (stopping gate);
archive admission (session-activity middleware + stopSessionTasks);
one-shot commit semantics (status inactive + appendDelivery); the
consumedPlans plan-object memo (PLAN_ONCE internal memo semantics — NOT a
one-shot ledger).

## Named non-inventions
- `revision`: the durable row schema (storage.ts scheduleTaskSchema) has
  NO revision field anywhere in the plugin — the admission intent carries
  `revision: null` plus the record's durable identity fields; fabricating
  a revision counter is refused (would be a schema extension requiring a
  root ruling).
