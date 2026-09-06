# C2 — D2 live glue + effect carriers of the frozen WorkDeliveryResult (v2)

- task_id: C2
- attempt: 1
- model_route: qiyuan-self/qwen3.8-27b
- base_sha: `4c0f2864439656e049c7180ac642a22d42539419` (C1 head — the frozen contract commit)
- head_sha: (see commit; branch `task/team-d1-d6-v2-C2`, worktree `.worktrees/team-d1-d6-v2-C2`)
- scope: single implementation writer of Wave C consuming the C1-frozen DTO (no DTO redesign)
- elapsed_minutes: 23

## Model-route verification (ROUTER_RULES §1.4)

- Runtime declaration (session persona, resolved at session start): "You are a coding agent
  powered by the **qwen3.8-27b** model, running on the DeepSeek Harness".
- Deployment default agent route (provider `qiyuan-self`, model `qwen3.8-27b`): subagent spawn
  inherits the main agent's route (ROUTER_RULES §1.3); no override present in the session header
  or preset (same verification path as C1/A4 on this deployment).
- **Route verified: `qiyuan-self/qwen3.8-27b`** — matches the required route. No mismatch; no stop.

## Context pack consumed

- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/C1/C1Result.md` — the FROZEN contract
  (DTO + per-case semantics + replay literal + the PROPAGATE-signal decision + the C2 consumer
  notes). C2 consumes it exactly as frozen.
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/A4/A4Result.md` — the public-seam
  characterization (transcript read = public; per-case semantics Q1–Q4).
- `packages/runtime/admission/types.ts`, `packages/runtime/action-router/work-execution.ts`
  (READ ONLY — frozen by C1), `packages/runtime/test/t12a-live-bridge.mjs` (shared test helper —
  read only; its exports are consumed), `packages/runtime/test/p8s3-work-chain.test.ts` +
  `p6t2-helpers.ts` (house patterns).
- `references/deepseek-harness-test-use` @ `76fda729799fe9b3848dbe2c211d4b231032b81e` (pristine
  upstream; re-verified publicness below; checkout left CLEAN — 0 dirty lines at commit time).

---

## Requirement 1 — the glue: `workDelivery.deliver` returns the frozen result

`packages/runtime/src/plugin/live/agent-bindings.mjs` (C2-owned; plain-JS ESM, untyped):

1. New module-level normalizer `readDeliveredWorkTurn(session, requestToken)` (+ helper
   `workMessageText`): scans `session.ownEvents()` (the PUBLIC upstream seam — see verification
   below), correlates the delivery via the LAST `user/message` whose text starts with the
   deterministic `` `[team-work requestToken=<token>] ` `` prefix the glue itself writes, finds
   that turn's `turn/end`, and maps the reason per the C1-frozen per-case table. Body = the
   turn's last non-empty `assistant/message` text (succeeded only).
2. `deliver` now `return readDeliveredWorkTurn(handle.agent.session, String(args.requestToken))`
   after the existing `ensureMaterialized` call. The signal race, the pre-abort throw, and the
   fail-closed throw contract are UNCHANGED (a delivery/observation fault still rejects before
   any result is formed — pinned by G9).
3. FROZEN per-case mapping (C1 table, implemented verbatim):

| Turn outcome | Status | Code / body |
|---|---|---|
| completed + last non-empty assistant text | `succeeded` | `body` present |
| completed, no non-empty assistant text | `unavailable` | `WORK_NO_ASSISTANT_BODY` |
| error (LlmFailure carried, with code) | `failed` | code = `LlmFailure.code`, message = `LlmFailure.message` |
| error (no code carried) | `failed` | `WORK_TURN_ERROR` + 'the model call failed without a stable code' |
| aborted | `failed` | `WORK_TURN_ABORTED` + 'the member turn was aborted before completion' |
| max-tokens | `failed` | `WORK_TURN_MAX_TOKENS` + 'the member turn hit its output token ceiling' |
| blocked | `failed` | `WORK_TURN_BLOCKED` + 'the member turn was blocked' |
| interrupted (defensive; the live loop never emits it) | `unavailable` | `WORK_TURN_INTERRUPTED` |
| unreadable: no token-prefixed message / no `turn/end` / no seam | `unavailable` | `WORK_TURN_UNREADABLE` (defensive, see risks) |

4. `requestToken` is echoed verbatim in every result (G5/E5).
5. Delivered text is UNCHANGED (the correlation point): `[team-work requestToken=<token>]
   <prompt>` (+ `\n\n[attached-context]\n<ctx>` when attachedContext present) — pinned byte-for-
   byte by G10.

## Requirement 2 — the effects: structured result on the Leader-facing carriers

`packages/runtime/action-router/effects.ts` (C2-owned):

1. `runWorkChainOn` (follow-up / delegate-continue path):
   - **signal propagation (the C1 frozen PROPAGATE decision)**: the chain deps now include
     `...(ctx.request.signal !== undefined ? { signal: ctx.request.signal } : {})` — the
     delegate-create path already propagated it; the follow-up path had dropped it (an abort
     mid-follow-up-delivery is now honored). Contract-neutral: the port already accepts
     `signal?`.
   - the `work-admitted` effect now copies the chain result:
     `...(result.memberResult !== undefined ? { memberResult: result.memberResult } : {})`.
2. `runDelegate` activate path (delegate-create): the `member-activated` effect now copies
   `...(work.memberResult !== undefined ? { memberResult: work.memberResult } : {})` alongside
   the existing `workSequence`/`workSettled`.

Both fields are the C1-DECLARED optional `memberResult` on the frozen effect variants — C2 only
POPULATES them. The tool/remote envelopes carry the effect verbatim (C1/A4-verified lossless
pass-through) → the Leader sees `{requestToken, status, body?/error?}` with ZERO changes in
`packages/tools` and `packages/remote` (per the C1 frozen consumer decision; both untouched).
Absent on the P6-T2 evidence path (no chain ran) and on the fail-closed throw (no effect
formed) — both conditions preserved.

## Requirement 3 — TDD pins (new `packages/runtime/test/p8s3b-result-effects.test.ts`, 16 tests)

House pattern kept (top-level await scenarios, synchronous `it` assertions; vitest 4.1.11).
Glue part: REAL glue module via the `t12a-live-bridge` `loadGlueModule()` + `createDomainDouble`
over a scripted upstream `agents`/session double whose `session.ownEvents()` replays
`SessionEvent` envelopes `{type, seq, time, data}` in the exact upstream shape. Effects part:
`createP6T2World` + a fake `WorkDeliveryPort` (armResult) + the real action router, asserting on
the Leader-facing effect carriers.

(a) **E1** delegate success → `member-activated.memberResult` = succeeded + member body; **E2**
follow-up success → `work-admitted.memberResult` = succeeded + body. (Requirement 3a)
(b) **E3** failed → status=failed rides the effect with the stable code, no body. (3b)
(c) **G2/E4** completed-without-body → `unavailable` (`WORK_NO_ASSISTANT_BODY`), NOT succeeded. (3c)
(d) **G5/E5** token echo: `requestToken` verbatim on the result and the effect carrier. (3d)
(e) **E6** replay: already-settled token → the SAME C1-frozen synthesized
   `unavailable`/`WORK_REPLAYED` literal, zero re-delivery (port call count = 1), no double
   delivery. (3e)
(f) **E7** settled separation: `settled: true` alone never produces `succeeded`. (3f)

Glue-level per-case pins: **G1** succeeded+body; **G2** no-body → unavailable; **G3** error →
failed with LlmFailure code (and the `WORK_TURN_ERROR` fallback); **G4/G5/G6** aborted /
max-tokens / blocked → failed with the stable codes; **G7** token-prefix correlation over a
multi-turn log (no leak across deliveries; the LAST prefix match wins — resume re-delivery);
**G8** unreadable log → `unavailable`/`WORK_TURN_UNREADABLE` (never a throw); **G9** the
fail-closed throw contract is unchanged (whenIdle rejection / pre-aborted signal → reject, no
result, cancel issued, materialization NOT claimed); **G10** delivered text byte-for-byte
unchanged; **G11** (added during implementation) a session handle WITHOUT the log-read seam →
explicit `unavailable`/`WORK_TURN_UNREADABLE` (the defensive seam branch: a seam regression
degrades to "the seam cannot determine the outcome", never to a crashed settlement or a
disguised success).

### RED (before implementation) — `red-transcript-1.txt`

Command: `npx vitest run test/p8s3b-result-effects.test.ts` in `packages/runtime` (exit 1):

```
 ❯ test/p8s3b-result-effects.test.ts (15 tests | 12 failed)
      ✓ G9: the fail-closed throw contract is unchanged ...
      ✓ G10: the delivered text is unchanged ...
      × G1..G8, E1..E6 (all result-shaping pins fail: deliver returned void,
        the effect carriers carried no memberResult)
      ✓ E7: settled separation ...
 Test Files  1 failed (1)
      Tests  12 failed | 3 passed (15)
```

(The 3 passing pre-implementation tests are existing-behavior guards: the throw contract, the
delivered text, and the settled-separation invariant — they constrain the implementation to
change ONLY the result shape, not the control plane.)

### GREEN (after implementation) — `green-transcript-1.txt`

Command: same (exit 0):

```
 ✓ test/p8s3b-result-effects.test.ts (16 tests) 931ms
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

## Requirement 4 — GREEN gates

### Full runtime suite — `full-suite-transcript.txt`

Command: `npx vitest run` in `packages/runtime` (exit 0, run of record @ 02:40:10):

```
 Test Files  130 passed (130)
      Tests  1203 passed (1203)
```

(C1 baseline: 129 files / 1187 tests; this run = baseline + this file's 16 tests.) The
interleaved `stderr | ... "bootstrap FAILED: ..."` lines are EXPECTED negative-path log output of
the fail-closed tests; every suite line is `✓`.

**Test-infra flake note (pre-existing, not a code regression)**: during this task, 5 of 9
full-suite runs hit the KNOWN Windows `rmSync` ENOTEMPTY teardown race (C1's own evidence,
"Infrastructure note" + risk #6, documents the identical signature from C1's first GREEN attempt):
`destroyDir` fails while a just-written scratch world is still held by the FS, the crashed file
leaves its `.tmp-fault` residue, and the residue poisons the immediate re-run
(`team_domain already exists`). Affected files rotated across runs (`p6t1-parallel`,
`p5t1-double-bind`, `p6t3-restart`, `tcm-m3-root-initial-work`, `tcm-d4-root-context`, and once
this task's own file at its E1-world teardown) — **none of the non-C2 affected files import any
C2-changed module** (verified import closure for `p6t1-parallel`: only `activation/index`,
`agent-setup/binder` types, storage, domain, p5t1/p5t6 fakes). A stashed-base control run was
green (`129/129 files, 1187/1187 tests`, exit 0), and after clearing `.tmp-fault` residue the
canonical run is green as recorded above. Residue cleanup is a manual `rm -rf` of
`packages/testkit/test/.tmp-fault` (gitignored).

### Typecheck

- `pnpm run typecheck` (`tsc -p tsconfig.json`) in `packages/runtime`: **exit 0** (after two
  mechanical type fixes inside THIS task's own test file: a `ConcatArray` literal widening in the
  ctx double's `assemble()`, and `assistantMessageData`'s `text: string | null` signature for the
  empty-body scripting).

### Dist glue placement — byte-identical

Command: `node scripts/place-dist-glue.mjs` from the worktree root (exit 0):

```
place-dist-glue: packages/runtime/src/plugin/live/agent-bindings.mjs -> packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs (byte-identical)
place-dist-glue: done (1 placement(s))
```

## Requirement 5 — seam verification (publicness, exact symbols @ test-use `76fda729`)

All reads added by C2 use PUBLIC exported surfaces of the upstream packages the glue already
imports (verified in `references/deepseek-harness-test-use` @ `76fda729799fe9b3848dbe2c211d4b231032b81e`;
checkout re-verified CLEAN at commit time — 0 dirty lines). No private/internal API, no patch.

| Symbol consumed by C2 | Upstream location (test-use) | Publicness proof |
|---|---|---|
| `handle.agent.session` (the live Session object) | `packages/core/agent-loop/src/agent.ts:92` (`ReactLoopAgent.session`); `AgentHandle` `packages/core/agent/src/index.ts:165` | already consumed by the existing glue (`ensureMaterialized(handle.agent.session)`); the handle/session face is what the glue drives (followup/whenIdle/cancel) |
| `Session.ownEvents()` (the transcript read) | `packages/core/session/src/index.ts:615` | public method of the `Session` class; `Session` is exported (`index.ts:425`) and `types.ts` re-exported via `export * from './types.ts'` (`index.ts:23`) |
| `SessionEvent` envelope `{type, seq, time, data}` (payload in `data`) | `packages/core/session/src/types.ts:436` | exported from the session package public index |
| `TurnEndReasonMap` (completed/aborted/blocked/error{error:LlmFailure}/'max-tokens'/interrupted) | `packages/core/session/src/types.ts:193-214` | same public export |
| `'turn/end'` `{turn, reason}`, `'user/message'` (UserMessage), `'assistant/message'` `{turn, step, message}` | `packages/core/session/src/types.ts:277`, `:289`, `:302` | same public export |
| `LlmFailure` `{message, code, status?, ...}` | `packages/core/llm/src/types.ts:40` | public llm type (code/message fields) |

A4's Q1 characterization (transcript read seam = public: YES) holds at the C1 base; re-verified
against the exact file:line anchors above. **No `CORE_SEAM_BLOCKER`.**

---

## Changed files

Owned (task card):
- `packages/runtime/src/plugin/live/agent-bindings.mjs` — module-level
  `workMessageText` + `readDeliveredWorkTurn` (+ the 7 stable code constants); `deliver` returns
  the frozen `WorkDeliveryResult` after materialization; port + header docs updated.
- `packages/runtime/action-router/effects.ts` — `runWorkChainOn`: signal propagation into the
  chain deps (C1 frozen decision) + `memberResult` on the `work-admitted` effect; `runDelegate`
  activate path: `memberResult` on the `member-activated` effect.
- `packages/runtime/test/p8s3b-result-effects.test.ts` — NEW: 16 TDD pins (G1–G11 glue-level,
  E1–E7 effect-level) as described above.
- `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` — dist mirror
  (byte-identical placement, tracked in the repo).
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/C2/` — this evidence dir.

NOT touched (frozen by C1 / forbidden): `packages/runtime/admission/types.ts`,
`packages/runtime/action-router/work-execution.ts`, `packages/runtime/test/t12a-live-bridge.mjs`
(shared helper — read only; the defensive seam branch in the glue made its minimal session
double compatible WITHOUT touching it), `packages/tools/`, `packages/remote/`,
`references/deepseek-harness*` (pristine; verified clean).

## Blocker section

None. No upstream change / private API (seam verified public → no `CORE_SEAM_BLOCKER`); the
frozen DTO was consumed exactly as C1 froze it (no conflict → no `SPEC_CONFLICT`); no
storage/remote/schema change; no contract change (→ no `CONTRACT_CHANGE_REQUEST`); no
dependency missing (C1 is the base); no test-infra blocker (the ENOTEMPTY flake is pre-existing
per C1's own evidence and was cleaned within the task; the suite-of-record is green).
No timebox breach: completed at ~23 min of the 60-min budget.

## Remaining risks / open items for G3

1. **`WORK_TURN_UNREADABLE` is a NEW stable defensive code** (not named in the C1 per-case
   table): it covers "the seam cannot determine the outcome" — a case the frozen vocabulary
   already reserves for `unavailable` — so the STATUS mapping stays frozen and the DTO shape is
   unchanged (`error.code` is a string by contract). G3 may want to ratify/renumber the code.
2. **Defensive seam guard in the glue**: `readDeliveredWorkTurn` maps a session object WITHOUT
   `ownEvents` to explicit `unavailable` instead of throwing (pinned by G11). The production
   `Session` always exposes the method; the branch exists so a future upstream seam regression
   degrades to an explicit "indeterminate" result rather than a crashed settlement or a
   disguised success. Note it also is what keeps the shared `t12a-live-bridge` minimal session
   double compatible without a shared-helper edit.
3. **Follow-up signal asymmetry FIXED** (C1 frozen PROPAGATE decision implemented): an abort
   mid-follow-up-delivery is now honored exactly as on the delegate-create path.
4. **Body size: no cap in v2** (carried from C1 risk #4): one member message, not a transcript.
5. **Replay non-re-reporting is lossy by design** (carried from C1 risk #3): the original body
   is not re-served on replay (`WORK_REPLAYED` unavailable, the C1 frozen literal).
6. **Untyped glue boundary**: `agent-bindings.mjs` is plain-JS ESM (no typecheck); the DTO is
   consumed by duck-typed shape pinned by the G1–G11 literal assertions. A future TS port of the
   glue should type the return against the frozen `WorkDeliveryResult`.
7. **Windows test-infra flake (pre-existing, C1 risk #6)**: the `rmSync` ENOTEMPTY teardown race
   can leave `.tmp-fault` residue that poisons the next run; cleanup = delete
   `packages/testkit/test/.tmp-fault` (gitignored). Considered for the repo's test infra
   (retry-on-ENOTEMPTY in `destroyDir` or top-of-file self-heal in the high-churn files).
8. **Correlation is by LAST token-prefix match** (A4): correct under at-least-once resume
   re-delivery (the fresh delivery is read); a future scheme delivering the same token with
   different prompt text into the same session would need stronger correlation (out of scope).

## TaskResult

- task: C2
- attempt: 1
- elapsed_minutes: 23
- base_sha: `4c0f2864439656e049c7180ac642a22d42539419`
- head_sha: (this commit)
- changed_files: 2 owned source + 1 new test (16 tests) + 1 dist mirror + this evidence dir
- tests: red `12 failed | 3 passed (15)` → green `16 passed (16)`; full runtime suite
  `130 files / 1203 tests passed (exit 0)`; `pnpm run typecheck` `exit 0`; dist glue
  byte-identical (script line captured); base control run `129/129 files, 1187/1187 tests (exit 0)`
- verdict: PASS
- blocker: none
- remaining_risks: see "Remaining risks / open items for G3"
