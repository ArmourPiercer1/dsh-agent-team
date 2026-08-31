# P8-T4 design note — versioned invalidation + pull / whole projection generation

- Task card (TaskDoc §11.9): implement versioned invalidation+pull **or** whole projection generation; client stale guard fixture; ledger paging.
- Branch `task/P8-T4-remote-push`, worktree `.worktrees/P8-T4`, base `c957f1ae18495d2f29948ca19532890cb5724754` (int/P8-remote-projection tip, post P8-T3).
- Verdict: **DONE** (attempt 2, R57 main-agent adjudication applied) — attempt 1 reported
  BLOCKER:SPEC (the non-owned P8-T3 layout pin, §BLOCKER); the main agent granted
  resolution option 1 as a standing exception (§Attempt 2); full chain green 1754/1754.

## D-1 — Invalidation model: whole-projection pull (the task card's option B)

Each sync round trip is a pull of the **complete** team projection over the frozen P8-T3
endpoint `team.getProjection`. Every projection carries a monotonically increasing
`projectionGeneration` (positive integer), and the client's frozen P8-T1 stale guard is
reused via `decideFrameVerdict` (engine `packages/remote/src/push/generation.ts`):

| incoming frame (same teamSessionId) | verdict |
| --- | --- |
| `incoming.generation > current.generation` | apply |
| `incoming.generation == current.generation` | duplicate (rejected, state untouched) |
| `incoming.generation < current.generation` | stale (rejected, state untouched) |
| different teamSessionId | foreign (rejected) |

This directly satisfies the acceptance criterion "new state must not be overwritten by an
old response": a delayed out-of-order response (e.g. N+1 arriving after N+2) is classified
`stale` and redelivery of the same generation is classified `duplicate`; neither mutates
applied state. No per-field invalidation payloads are needed — the whole-projection
generation comparison subsumes them. Provenance cross-check
(`provenance.generation === projection.generation`) rejects inconsistent frames as
`inconsistent` before the guard runs.

## D-2 — No new catalog methods

The push engine and the test client consume **only** frozen P8-T3 endpoints:
`team.getProjection` (pull) and `team.getLedgerPage` (paging). The frozen surface is
byte-identical — proof: `git diff c957f1ae18495d2f29948ca19532890cb5724754 --
packages/remote/src/contracts/ packages/remote/src/handlers/` is **empty** (see
attempt1-post.log). Only additive change in frozen-adjacent source: `packages/remote/src/index.ts`
re-exports the new `./push/` module.

## D-3 — Port-based fake server over the REAL dispatcher

`p8t4-server.ts` implements the `RemotePushTransport` seam on top of the real frozen
`createRemoteDispatcher(makeFakePorts({...}))` (P8-T3 helper): every frame the client
applies has traversed the real contract validation, dispatcher, and error mapping — no
mocked responses outside the seam. Deterministic controls:

- `lose()` / `restore()` — `send` throws `PushTransportLossError` while down;
- `setGeneration(n)` — advances the mutable projection port;
- `scriptNext(method, response)` — queues exactly one scripted override response
  (late/out-of-order delivery), popped before dispatch.

The negative test additionally pins the handler dependency surface to exactly the 12 frozen
ports via `makeFakePorts` (sorted key list).

## D-4 — Determinism and P2-T6 alignment

All timing is injected: the client clock (`clockMs`) advances only via `advance(ms)`;
backoff follows the frozen P2-T6 formula `cap = min(maxMs, baseMs · factor^(attempt−1))`
with `delay ∈ [cap/2, cap]` through an injectable picker (default deterministic
`max(1, floor(cap/2))`); the picker throws the typed `PushBackoffRangeError` on
out-of-range values.

`onConnected` semantics are aligned with the P2-T6 seam report R1 (authoritative):
`onConnected` is a **connection-establishment** event — initial start, post-loss
reconnect, post-stop restart — **not** a per-round-trip ack while the connection stays
open. Implementation: an internal `connectionOpen` flag; `markConnected()` fires
`onConnected` and increments `connectedCount` only on the closed→open transition;
`markLoss()` and `stop()` close the flag. State sinks stay deduped: `lastState` persists
across stop/start, so a restart after stop emits **zero** state events (exactly R1:
`onConnected` count 2 with unchanged state sequence). S2 (reconnect) and S6 (stop/restart)
assert `connectedCount === 2` with a late in-connection sync that must not re-fire.

## D-5 — Ledger paging + tracker correlation guard

`createLedgerPageTracker(afterSequence=0)` advances a strictly monotonic anchor;
`verifyLedgerPageAnchor` (ordered checks) rejects: entries not strictly after the anchor,
page over limit, cursor mismatch (`nextAfterSequence` inconsistent with the last entry),
non-terminal short page, and negative or decreasing `total`. The tracker is also a
**correlation guard**: a page fetched against an older anchor (a stale response after the
anchor advanced) is rejected as `anchor-mismatch`, so a stale page can never re-apply
already-counted entries. Acceptance "stable pagination" is covered twice: the engine test
"ledger growth under stable anchor" (pages keep a stable, strictly advancing walk while
the ledger grows) and scenario S4 (3-page walk over a growing ledger + stale-anchor
rejection).

## D-6 — Self-scanning negative scanner (documented scope extension)

`p8t4-negative-scan.mjs` + `p8t4-negative-scan.d.mts` + `p8t4-negative.test.ts` mirror the
P8-T3 negative-scan pattern, with a documented scope extension versus P8-T3's src-only
scan: the P8-T4 scanner scans exactly **13 files** — the 6 engine modules under
`packages/remote/src/push/` **and** its own test-surface files (including the scanner
`.mjs` itself). Two documented rule exemptions are required for the scanner to be
self-clean:

- R1 (no `node:` imports) and R6 (no non-relative imports) exempt `node:` builtins
  inside the scanner's `.mjs` — it is a plain-Node module, not package source;
- R6 additionally exempts the `vitest` specifier (test-runner import, house style).

Token-free self-scan technique (verified by probe: 13 files, 0 violations):

1. doc comments avoid the literal tokens (word-boundary lookarounds pass through
   backticks/parens, so prose uses the spaced form, e.g. "session log artifact");
2. the R3/R4 camel and hyphen patterns are built at runtime from fragments
   (`boundedPatternFromFragments(['Session','Controller'])` etc.);
3. control texts are assembled at runtime from `String.fromCharCode(39)` quotes +
   fragments + imported frozen constants — no `from '...'` specifier is extractable from
   the scanner's own source;
4. violation-detail strings avoid the `import ('…')` dynamic-import shape that R2's
   extraction pattern matches.

Positive controls (all asserted): specifier control → 5 violations (R1×1, R2×1, R6×3);
mirror/log control → 5 violations (R3×1, R4×4); vocabulary control → 2 R5 violations
matching exactly the 2 testkit denylist hits (legacy event string + SessionEventMap
declaration-merge).

## D-7 — Test-shim compliance

- no `toBeNull` / `.not.toBeNull` (the shim lacks them) — `=== null` / `!== null` +
  `toBe(true)` used instead;
- async scenarios live in a module-level top-level-await IIFE (shim `it()` is synchronous);
- erasable TS only; NodeNext + verbatimModuleSyntax with `.js` extensions on relative
  imports; no `node:` builtins in any `.ts`.

## Acceptance mapping (required tests)

| required | covered by |
| --- | --- |
| out-of-order frames | engine (older-after-newer, same-gen duplicate, foreign, provenance disagreement, non-positive generation) + S1 (gen-5→7→late-6; 8→late-7) |
| reconnect | engine (capped exponential cap R2 formula, delay ∈ [cap/2,cap], typed picker error, deterministic lower-bound picker, loss/connect transitions with state dedup R1/R3) + S2 (loss → capped backoff → restore → converge) |
| duplicate invalidation | engine (same-gen duplicate) + S3 (redelivered frame = duplicate, state untouched) |
| page anchor | engine (valid full+terminal page, ordered/limit/cursor/terminal/total rejections, tracker stale-page guard, stable-anchor growth) + S4 (walk + stale-anchor rejection) |
| stale guard (P8-T1 frozen) | engine (stale verdict) + S1 (late older response rejected, `staleGeneration` stays 7) |

New tests: **41** (engine 23, sync 11, negative 7).

## Verification summary

- Full chain (base + all changes, run **pre-commit** — re-verified against committed HEAD
  as the final step): **1753 passed / 1 failed / 1754 total** (baseline 1713 + 41 new);
  tsc ×6 (contracts, domain, storage, runtime, testkit, remote) all exit 0. Log:
  `attempt1-post.log` (final state); `attempt1-post-prefixes.log` preserves the earlier
  pre-fix state (1742/2/1744, tsc-remote exit 2); `attempt1-baseline.log` = 1713/1713 +
  tsc ×6 exit 0.
- p4t6 session-event scan: 469 → **482** files (13 new; DEC-1 count/title/enumeration
  update only, zero denylist hits).
- Frozen surface byte-identical (empty diff, §D-2).

## BLOCKER — `p8t3-negative.test.ts` 22-file pin (SPEC conflict)

- The **non-owned** test `packages/remote/test/p8t3-negative.test.ts` pins the owned
  file count: `scanP8T3OwnedFiles()` collects **all** `.ts` under `packages/remote/src`
  and asserts `toBe(22)` (p8t3-negative.test.ts:80).
- This task's owned path (`packages/remote/src/push*`, per the task card) adds 6 new
  `src/push/*.ts` modules → 28 → that test fails with
  `expectation failed: actual toBe 22 — actual: 28`.
- Evidence: `attempt1-probe-p8t3-pin.log` (isolated probe of the pin) and
  `attempt1-post.log` (full chain: the **only** failure of 1754).
- It cannot be fixed here: `p8t3-negative.test.ts` is not in P8-T4's owned paths
  (brief §4) and is a P8-T3 artifact; editing it in this branch would be an owned-path
  violation (BLOCKER:OWNED_PATH). The P8-T4 code itself is complete and green (remote
  pre-check: 86 passed / 1 failed, the failure being exactly this pin; tsc-remote exit 0).

Resolution options for the main agent / next attempt:

1. **DEC-1-style exception**: extend the P8-T3 expected-file list from 22 → 28
   (additive, same style as this task's p4t6 DEC-1 count update) — i.e. authorize P8-T4
   (or a follow-up task) to bump that pin.
2. **Placement change**: if the intent is that P8-T4 ships zero new
   `packages/remote/src` files, the push engine would belong under the test surface
   (e.g. `packages/remote/test/push/`); the task card's "Owned: `packages/remote/src/push*`"
   says otherwise, so this option needs an explicit brief amendment.

Reported question: *may I extend `p8t3-negative.test.ts`'s expected-file list as a
DEC-1-style exception, or is another placement intended?*

## Attempt 2 (R57 adjudication applied)

**Adjudication (R57, main agent, attempt 2/3):** the BLOCKER:SPEC question above is
**ADJUDICATED — resolution option 1 is GRANTED**; option 2 (placement change) is
**REJECTED** (the task card owns `packages/remote/push*`; the `src/` placement is
correct). The grant is ratified as a **STANDING exception**: every later P8 task that
adds files under `packages/remote/src` maintains the `p8t3-negative.test.ts` layout pin
in the same DEC-1 style as the p4t6 count maintenance (count + enumeration only).

**Scope of the edit (strict, per adjudication):** only
`packages/remote/test/p8t3-negative.test.ts` — expected-file list 22 → 28 (add the six
new `packages/remote/src/push/*.ts` files in the scanner's sorted order, verified by a
live probe of `scanP8T3OwnedFiles()`: 28 files, 0 R1–R6 violations — no denylist hit in
any push file), `toBe(22)` → `toBe(28)`, and the three "22" references in the file
header / list comment / test title → 28. Scanner logic, denylist vocabulary, and all
other assertions are untouched; no other file changed. Exact diff (working tree vs
d7aaff3):

```diff
diff --git a/packages/remote/test/p8t3-negative.test.ts b/packages/remote/test/p8t3-negative.test.ts
index 8c06fbd..46c14d4 100644
--- a/packages/remote/test/p8t3-negative.test.ts
+++ b/packages/remote/test/p8t3-negative.test.ts
@@ -4,7 +4,7 @@
  * upstream / session-log source at all.
  *
  * Three proofs:
- *   1. The owned-file scan: exactly the 22 `packages/remote/src` files are
+ *   1. The owned-file scan: exactly the 28 `packages/remote/src` files are
  *      scanned, every import specifier is relative, and rules R1–R6 report
  *      zero violations.
  *   2. Positive controls: synthetic texts (built by the scanner, never
@@ -32,7 +32,7 @@ import {
 } from './p8t3-negative-scan.mjs'
 import { makeFakePorts } from './p8t3-helpers.js'
 
-/** The exact 22 P8-T3-owned source files, in the scanner's sorted order. */
+/** The exact 28 P8-T3-owned source files, in the scanner's sorted order. */
 const P8T3_EXPECTED_FILES = [
   'packages/remote/src/contracts/catalog.ts',
   'packages/remote/src/contracts/errors.ts',
@@ -56,6 +56,12 @@ const P8T3_EXPECTED_FILES = [
   'packages/remote/src/handlers/register.ts',
   'packages/remote/src/handlers/team.ts',
   'packages/remote/src/index.ts',
+  'packages/remote/src/push/generation.ts',
+  'packages/remote/src/push/index.ts',
+  'packages/remote/src/push/ledger-page.ts',
+  'packages/remote/src/push/pull.ts',
+  'packages/remote/src/push/reconnect.ts',
+  'packages/remote/src/push/types.ts',
 ]
 
 /** The exact 12 `RemoteHandlerDeps` port keys, sorted. */
 const P8T3_EXPECTED_PORT_KEYS = [
   'admission',
   'catalog',
@@ -75,9 +81,9 @@ const P8T3_EXPECTED_PORT_KEYS = [
 ]
 
 describe('P8-T3 negative scan (Brief §87–96)', () => {
-  it('scans exactly the 22 owned packages/remote/src files', () => {
+  it('scans exactly the 28 owned packages/remote/src files', () => {
     const scan = scanP8T3OwnedFiles()
-    expect(scan.files.length).toBe(22)
+    expect(scan.files.length).toBe(28)
     expect(scan.files).toEqual(P8T3_EXPECTED_FILES)
   })
```

**Measured chain (sanctioned, no args / separate invocations):**
- RUN 1 (pre-commit, working tree = d7aaff3 + the edit above):
  `node scripts/run-tests.mjs` → **1754 passed / 0 failed / 1754 total** (exit 0; the
  sole attempt-1 failure `p8t3-negative.test.ts` now passes); tsc ×6 (contracts,
  domain, storage, runtime, testkit, remote) → all exit 0. Log: `attempt2-post.log`
  (RUN 1).
- RUN 2 (post-commit, committed clean tree at the new head): full chain re-run,
  appended to `attempt2-post.log` (RUN 2, proof header shows the final HEAD).
