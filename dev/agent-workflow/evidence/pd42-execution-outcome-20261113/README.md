# PD-42 — the durable execution fact records what RAN, not that the tool answered

**Date:** 2026-11-13 (host clock; owner ruling 2026-11-13)
**Record class:** **DEV-LIVE** — a real `dsh web` Host, a fresh `DSH_HOME` per run,
the pinned host runtime, the shipped governed Member preset, the OS refusing the
out-of-lane write. **Never** CANDIDATE-C2, **no** V@B, `osLevelNetworkIsolationClaimed:false`.
**Product tree measured (after, authoritative):** branch
`fix/pd42-execution-outcome-20261117`, restructure commit
`da4587c1efede77522821d8486631f3a506ef52d` (`e111582cd` = master merged, plus
the ARC-A restructure) on top of `origin/master`
`270d8f95f96b5c53cb22203b924e55273d43815e`.
The earlier `after-run1/after-run2` pair measured `b76f2a888` (the first cut,
before the restructure) and is retained as history; the authoritative rows
below are `restructured-run1/2`.
**Product tree measured (before):** `origin/master` `270d8f95f96b5c53cb22203b924e55273d43815e`
(a throwaway detached measurement worktree; no writer ever ran there).
**Host pin:** `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`
(`tests/deepseek-harness-test-use`, pristine, porcelain empty).
**Instrument:** `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs
--min-closing=pd42`, comparator `compare-min-closing-runs.mjs`. The instrument is not on
`origin/master`; commit `364308cdb` on this branch carries it verbatim from
`task/v016-min-closing-20261113` (`da26d9970`, test-infrastructure only, no product change),
so every measurement below is reproducible from this branch.

## Verdict

**PD-42 PASS** — previously FAIL, reproduced on the real OS.

Proposition: an **approved** governed `bash` call does not widen the Member filesystem
ceiling; the OS refuses the out-of-lane write (zero bytes, target `ENOENT`, tool text
`Read-only file system` + exit 1), the approval chain completes, and the durable
`control-execution-result` records **`failed`**, not `succeeded`.

```text
before (270d8f95f):  outsideExecOutcome=succeeded  ledgerRefusal=false  verdict FAIL
after  (b76f2a888):  outsideExecOutcome=failed     ledgerRefusal=true   verdict PASS  (x2)
```

## ARC-A restructure (why the code moved)

The first cut added `packages/runtime/operation-permission/execution-outcome.ts`.
PR #751 is blocked by the **ARC-A protected-centre booking law**: a NEW file
under the protected prefix is `ledger-missing`, and **no override silences
`ledger-missing`**; only blobs present at the ledger's `bookedFrom` commit can
be booked. A re-booking of the protected centre (new `bookedFrom` + 33 digests)
would be a governance re-record no PR has performed since the gate's first
booking, and was ruled out for one helper function.

The structural remedy (this commit): **zero files added under the protected
prefix**. The predicate now lives in
`packages/runtime/operation-permission/pre-execute-adapter.ts` — the terminal
observer that already owns the durable write — and `execution-outcome.ts` is
deleted (source and dist mirror). `native-bash-tool.mjs` imports it from the
adapter. No import cycle: the adapter's closure (`operation-permission/**`,
`control/**`) contains no import of `plugin/live/**` or `native-bash-tool`; the
host boots and the two real runs below pass. The a5p5 lane keeps its structured
`exitCode` predicate with a pointer comment: a `packages/tools` -> `packages/
runtime` import would invert the layering (runtime already imports the a5p5
lane), so only the pure predicate is duplicated.

`pre-execute-adapter.ts` still moves, which is `digest-drift`; that is
silenceable by a **named centre-interface override**, J05J06/#733 precedent.
The ledger gains exactly one entry:

```text
path   packages/runtime/operation-permission/pre-execute-adapter.ts
sha256 b811211bf853f6888a2d361e61fdd05a9b0697b8ae45e2aadb0c699b6ff96724
pr     PR #751 (PD42-EXECUTION-OUTCOME) - NAMED center-interface change, J05J06/#733 precedent
```

ARC-A scan on the restructured tree: **33 tracked protected files, 0 violations,
0 added, 1 deleted** (`u6-arc-a-fitness.test.ts` 12/12). This is an interface
change at the existing seam that settles the execution fact, reviewed as such —
not a family addition. Consumption, replay, exactly-once and the approval
ceiling are untouched.

## The exact ledger rows

`mc-pd42-ledger.json` (per run), request → decision → consumption → execution-result.

### BEFORE — `origin/master` 270d8f95f (`before-run1/`, kit verdict FAIL)

```text
inside   request=7  decision=8  allow  consumption=9  execution-result=14  outcome=succeeded
outside  request=15 decision=16 allow  consumption=17 execution-result=22  outcome=succeeded   <-- THE LIE
```

The outside command was `bash: …/mc-pd42-outside-<stamp>.txt: Read-only file system` with
`[Command finished with exit code 1]`; the file did not exist afterwards (`readError=ENOENT`,
`outsideFileExists=false`). The approval did **not** widen the ceiling (correct); the ledger
then claimed the refused execution succeeded.

### AFTER — restructure commit da4587c1e (`restructured-run1/` and `restructured-run2/`, kit verdict PASS)

```text
run1  inside   request=7  decision=8  allow  consumption=9  execution-result=13  outcome=succeeded
run1  outside  request=14 decision=15 allow  consumption=16 execution-result=20  outcome=failed
run2  inside   request=7  decision=8  allow  consumption=9  execution-result=13  outcome=succeeded
run2  outside  request=14 decision=15 allow  consumption=16 execution-result=20  outcome=failed
```

- inside write (inside the ceiling): still **`succeeded`** in both runs;
- outside write (OS-refused): **`failed`** in both runs, `ledgerRefusal=true`,
  `outsideFileExists=false`, `readError=ENOENT`, `osRefusal=true`;
- the deny legs were not exercised by this mode, and nothing in this change adds
  an execution result to a denial: a denial is still "never executed"
  (request/decision, no consumption, **zero** execution-result rows).

The pre-restructure pair (`after-run1/2`, product commit `b76f2a888`) produced
the same `succeeded`/`failed` rows, so the restructure is outcome-identical.

## Two-run agreement

`pd42-two-run-agreement.json` (comparator output over `restructured-run1/2`):

```text
= PD-42  PASS / PASS
verdictsAgree=true detailsAgree=true compositionAgree=true
```

Both runs: `DEV-LIVE`, `mode=pd42`, `productSha=da4587c1e…`, same composition
(host default `danger-full-access`, `a5sf-governed-member`, plane takeover, v5 Team document
with `memberIoCeilings` + `reviewRouting`), same normalized detail
(`insideApprovedExecuted=true outsideApproved=true outsideConsumed=true
outsideExecOutcome=failed ledgerRefusal=true outsideFileExists=false readError=ENOENT
osRefusal=true`).

## The fix (diff summary)

Old decision (`packages/runtime/operation-permission/pre-execute-adapter.ts`, the
classifier at what the closing evidence called line 868):

```ts
if (record.isError === false) return 'succeeded'   // a refused shell exit is still "succeeded"
```

**Closed vocabulary: `succeeded | failed | unknown`** — exactly what
`ControlExecutionResultRecord.outcome` already allowed (`packages/runtime/control/types.ts:2270`).
**No new state was invented.**

1. `packages/runtime/operation-permission/pre-execute-adapter.ts` — the **ONE**
   classifier now lives in this existing protected-centre file (see the ARC-A
   restructure above; the first cut had it in a new `execution-outcome.ts`, which
   the booking law forbids). It is imported by **both** durable-fact writers:
   - the adapter's own terminal observer (the writer the measured row came from);
   - `packages/runtime/src/plugin/live/native-bash-tool.mjs` admission edge (it used to
     settle `'succeeded'` unconditionally on a resolved `execute()`, whatever the command
     did).
   It reads the pinned persistent-shell status trailer **anchored to the last line** of the
   model-facing text:
   - `[Command finished with exit code N]` → `N === 0 ? succeeded : failed`;
   - `[Command timed out or OOM]` → `unknown` (the command end was never observed, PD-41);
   - `[shell exited: code N]` / `[shell exited]` → `unknown` (the command was not observed
     to finish);
   - `[shell killed by signal: X]` → `failed`;
   - no trailer → the historical `isError` reading (`isError:false` → `succeeded`);
   - `isError:true` → `failed` (abort-class codes stay `unknown`).
   Last-line anchoring is deliberate: the pinned tool appends its marker **after** the
   command output (even when truncated), so a look-alike marker printed by the command
   cannot decide the fact.
2. `packages/tools/a5p5-tools/src/pipeline.ts` — the governed-a5p5 lane had the same lie with
   **structured** data: `executionOutcomeOfAnsweredCall` returned `succeeded` for a completed
   shell body with any `exitCode`. It now returns `failed` for a non-zero exit (search rows,
   which carry no exit code, keep the historical reading). It keeps the **pure** predicate
   local (a `tools -> runtime` import would invert the layering); a pointer comment names
   the adapter as the runtime twin.
3. PD-41's clause *"a non-zero exit is still a completion and stays `succeeded`"* is
   superseded for the durable fact. The PD-41 abort class (`cancelled`/`timedOut` →
   `unknown`) is untouched. The two a5p5 tests that pinned the superseded clause were
   rewritten; no other PD-41 assertion changed.

**Schema disclosure (not silently decided):** `ControlExecutionResultRecord` has **no field
for an exit code or refusal text** — only `requestId`, `callId`, `outcome`, `recordedAt`,
`sequence` (`packages/runtime/control/types.ts:2267-2273`); the pinned native bash
`ToolResult` has no structured exit-code field either (only `content`/`isError`/optional
`meta`, and that tool declares no `meta` projector). The fix therefore reads the tool's
pinned text trailer and leaves the durable schema unchanged. Adding an exit-code field is a
compatibility question, disclosed here, **not taken**.

## Regression tests

- `packages/runtime/test/pd42-execution-outcome.test.ts` — host-free unit over the real
  `ToolResult` shapes: exit 0 → `succeeded`, the measured `Read-only file system` + exit 1
  → `failed`, look-alike marker anchoring, tool error, timeout, killed/session-exit, the
  PD-41 abort class, and unreadable shapes.
  - `unit/pd42-unit-RED-control.log`: with the classifier's shell-status read temporarily
    disabled (the pre-fix behaviour) → **4 failed / 9**;
  - `unit/pd42-unit-GREEN.log`: restored → **9 passed / 9**;
  - `unit/pd42-unit-RED-control-restructured.log` / `pd42-unit-GREEN-restructured.log`:
    the same RED/GREEN control re-run against the restructured adapter
    (**4 failed / 9** → **9 passed / 9**).
- `packages/tools/a5p5-tools/test/a5p5-execution-outcome.test.ts` — non-zero exit now
  `failed`, exit 0 still `succeeded`, search row unaffected.
  - `unit/a5p5-outcome-RED-control.log`: pre-fix reading simulated → **3 failed / 106**;
  - `unit/a5p5-outcome-GREEN.log`: **106 passed / 106**.
- Census: `packages/testkit/test/p4t6-bookings/pd42outcome.json` books the two new
  scannable files (measured `scanner counts 1512, ledger derives 983 + 527 = 1510`;
  booking 1510 → 1512; `p4t6-session-event-scan` passes).

## Sweep — every writer/deriver of `control-execution-result` outcome

| site | what it does | disposition |
|---|---|---|
| `packages/runtime/operation-permission/pre-execute-adapter.ts:2615` (terminal observer; classifier formerly `:865`, the closing evidence cited `:868`) | derives outcome from the terminal `ToolResult` | **FIXED** — imports the shared classifier |
| `packages/runtime/operation-permission/pre-execute-adapter.ts:2517,2527` | dispatch threw / dispatch refused after the allow was consumed | **already correct** — `failed`, never `succeeded` (execution did not run) |
| `packages/runtime/src/plugin/live/native-bash-tool.mjs:121` | settled `'succeeded'` on every resolved native `execute()` | **FIXED** — helper outcome; aborted stays `'cancelled'` (PD-41) |
| `packages/runtime/src/plugin/live/team-tool-plane.mjs:2110` (`settleNative`) | forwards the caller's outcome to `recordExecutionResult`; accepts only `succeeded`/`failed` | **no derivation of its own**; now receives a truthful outcome. Residual gap (not a success lie): `unknown`/`cancelled` is silently not written, so a timeout/cancel relies on cold-boot settlement (`root.ts`) — listed, not changed here |
| `packages/tools/a5p5-tools/src/pipeline.ts:145-168` | answered-call derivation from structured `exitCode`/settlement | **FIXED** — non-zero exit → `failed` |
| `packages/runtime/src/plugin/root.ts:2949-2965` | cold-boot settlement of a consumed allow with no result | **already correct** — writes `unknown`, never `succeeded` |
| `packages/runtime/src/plugin/live/agent-bindings.mjs:3257` | forwards `{callId, outcome}` to the control service | **no derivation** — transport only |
| `packages/runtime/control/service.ts:3572` (`recordExecutionResult`) | validates/normalizes and stores the fact | **no derivation** — the schema gate |
| `packages/runtime/tool-dispatch/install.ts:725` | dispatch-cancellation classifier (`completed`/`cancelled-before-body`/`terminated-after-body-start`/`outcome-unreadable`) | **not the same defect** — it answers "did the body start", not "did the execution succeed", and writes no execution result; left untouched |

No other production site writes or derives a `control-execution-result` outcome.

## Gates run on this branch

- `pnpm -r run build` → exit 0; `node scripts/place-dist-glue.mjs` → 113 placements;
  `node scripts/check-artifacts-committed.mjs` → **`verdict=ok compared=2088`**
  (the four `execution-outcome.*` mirror files are gone with the helper, so the
  mirror is back to the 2088-file surface).
- ARC-A L1 scan → **33 tracked protected files, 0 violations** (0 added, 1
  deleted); `u6-arc-a-fitness.test.ts` → 12/12; the one named override is
  recorded above.
- `node scripts/ci-pr-gate.mjs --only blueprint-fence,lint-identities` → both **pass**
  (fence: no new offending path, 16 known identities/44 sites, universe 1215; identities:
  76 distinct, new 0 / resolved 0). No `v4`/`v5` literal moved, so the fence was **not**
  re-recorded.
- `p4t6-session-event-scan` → 20/20; `git diff --check` → clean.
- `a5sf-debt-register` was **not touched**.
- `artifacts-at-head` could not run in this environment: it spawns `pnpm install` in a
  temporary checkout and the sandboxed pnpm store answers
  `ERR_SQLITE_ERROR unable to open database file`. This is an environment limitation, not
  product drift; the index-vs-tree artifact check above is green (2092 files).

## Deliberately NOT changed

- **The durable schema.** No `exitCode`/`refusal` field was added (compatibility question,
  disclosed above).
- **The approval / ceiling path.** Nothing in `packages/runtime/governance/**`,
  `member-io-policy/**` or the sandbox launcher changed; the approval still does not widen
  the ceiling.
- **Deny semantics.** A denial still writes request + decision, **no** consumption and
  **no** execution result.
- **PD-41's abort class.** `TOOL_ABORTED(–BEFORE_DISPATCH)`/`AbortError` → `unknown`
  remains.
- **`settleNative`'s dropped `unknown`.** A timeout/cancel still does not write a durable
  row at the native admission edge (cold-boot settlement covers the consumed-allow case).
  Same family of "the ledger says nothing", not "the ledger says succeeded"; listed in the
  sweep rather than fixed in this change.
- **Unrelated outcome vocabularies** (`memberResult.status`, work-execution delivery
  status, intervention derivation): different facts, not `control-execution-result`.

## File map

```text
before-run1/                 min-closing-verdicts.json (FAIL), min-closing-arms.md,
                             mc-pd42-{blueprint,create,delegate,ledger,sandbox-profile}.json
after-run1/ after-run2/      the pre-restructure PASS pair (product b76f2a888)
restructured-run1/ run2/     the authoritative PASS pair (product da4587c1e)
*.driver.log                 kit driver transcript per run
pd42-two-run-agreement.json  comparator output (PASS/PASS, agree on all three)
unit/                        pd42 unit RED/GREEN, a5p5 outcome RED/GREEN
```
