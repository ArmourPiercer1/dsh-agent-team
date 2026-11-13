# PD-42 — the durable execution fact records what RAN, not that the tool answered

**Date:** 2026-11-13 (host clock; owner ruling 2026-11-13)
**Record class:** **DEV-LIVE** — a real `dsh web` Host, a fresh `DSH_HOME` per run,
the pinned host runtime, the shipped governed Member preset, the OS refusing the
out-of-lane write. **Never** CANDIDATE-C2, **no** V@B, `osLevelNetworkIsolationClaimed:false`.
**Product tree measured (after):** branch `fix/pd42-execution-outcome-20261117`,
product commit `b76f2a888c9570610d1310cd38c9294ee4f93400` on top of
`origin/master` `270d8f95f96b5c53cb22203b924e55273d43815e`.
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

### AFTER — fix commit b76f2a888 (`after-run1/` and `after-run2/`, kit verdict PASS)

```text
run1  inside   request=7  decision=8  allow  consumption=9  execution-result=13  outcome=succeeded
run1  outside  request=14 decision=15 allow  consumption=16 execution-result=20  outcome=failed
run2  inside   request=7  decision=8  allow  consumption=9  execution-result=13  outcome=succeeded
run2  outside  request=14 decision=15 allow  consumption=16 execution-result=20  outcome=failed
```

- inside write (inside the ceiling): still **`succeeded`** in both runs;
- outside write (OS-refused): **`failed`** in both runs, `ledgerRefusal=true`,
  `outsideFileExists=false`, `readError=ENOENT`;
- the deny legs were not exercised by this mode, and nothing in this change adds an
  execution result to a denial: a denial is still "never executed" (request/decision, no
  consumption, **zero** execution-result rows).

## Two-run agreement

`pd42-two-run-agreement.json` (comparator output):

```text
= PD-42  PASS / PASS
verdictsAgree=true detailsAgree=true compositionAgree=true
```

Both runs: `DEV-LIVE`, `mode=pd42`, `productSha=b76f2a888…`, same composition
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

1. New `packages/runtime/operation-permission/execution-outcome.ts` — the **ONE**
   classifier, now imported by **both** durable-fact writers:
   - `pre-execute-adapter.ts` terminal observer (the writer the measured row came from);
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
   which carry no exit code, keep the historical reading).
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
  - `unit/pd42-unit-GREEN.log`: restored → **9 passed / 9**.
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
  `node scripts/check-artifacts-committed.mjs` → **`verdict=ok compared=2092`**
  (2088 previous mirror files + the four new `execution-outcome.*` mirror files; the extra
  four are the new module, not an unrelated artifact).
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
after-run1/ after-run2/      the same set, verdict PASS, outside outcome=failed
*.driver.log                 kit driver transcript per run
pd42-two-run-agreement.json  comparator output (PASS/PASS, agree on all three)
unit/                        pd42 unit RED/GREEN, a5p5 outcome RED/GREEN
```
