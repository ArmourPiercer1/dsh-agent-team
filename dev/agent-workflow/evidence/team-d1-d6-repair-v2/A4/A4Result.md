# A4 — D2 minimal structured-result insertion seam (characterization, v2)

- task_id: A4
- model_route: qiyuan-self/qwen3.8-27b
- base_sha: 2baad2f (worktree `.worktrees/team-d1-d6-v2-A4`, branch `task/team-d1-d6-v2-A4`)
- scope: read-only seam characterization; no product code modified
- upstream baseline cited: `references/deepseek-harness-test-use` @ `76fda729799fe9b3848dbe2c211d4b231032b81e` (pristine, verified `git log -1` + clean status)

## Model-route verification (ROUTER_RULES §1.4)

- Runtime declaration (persona, resolved at session start): "You are a coding agent powered by the **qwen3.8-27b** model".
- Upstream resolves `{{model}}` from `context.agent?.options.model` (agent-loop `ctx.systemPrompt.variable('model', ...)`, `packages/core/agent-loop/src/index.ts:415` in the running deployment checkout; same registration in test-use), and `{{provider}}` from `options.provider` (line 414).
- Deployment default agent route (`C:\Users\user\.dsh\settings.yaml`, `agent-default-model`): provider `qiyuan-self`, model `qwen3.8-27b`. The subagent spawn inherits this route; no override is present in the session header or preset (`small-ctx-create` sets no model row).
- **Route verified: `qiyuan-self/qwen3.8-27b`** — matches the required route. No mismatch; no stop.

## Context pack consumed

- `docs/local-issues/team-work-result-not-delivered-to-leader.md` (main checkout; gitignored from the worktree) — D2 diagnosis: delivery seam is completion-only, `settled:true` is not business success.
- `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md` — v1 C2: `d2_existing_result_seam: no` (completion seam only), Team-owned contract change required, no remote/storage schema identified.
- `packages/runtime/admission/types.ts`, `packages/runtime/action-router/work-execution.ts`, `packages/runtime/action-router/effects.ts`, `packages/runtime/src/plugin/live/agent-bindings.mjs` (all in this worktree at 2baad2f).
- Upstream public surfaces in `references/deepseek-harness-test-use` (read-only): `packages/core/agent`, `packages/core/agent-loop`, `packages/core/session`, `packages/llm/llm`, `packages/session-query/session-query`, `packages/session/session-persistence`.

---

## Q1 — TRANSCRIPT READ SEAM: **EXISTS (public)**. The succeeded-body half is NOT blocked.

The production glue already holds everything needed inside `workDelivery.deliver()`:
`handle = await ensureLiveAgent(String(args.childSessionId))` (`agent-bindings.mjs:1096`) where the handle comes from the stock `agents` service (`agents.create`/`agents.resume`, `agent-bindings.mjs:909,927,978,985`), and the glue already reads `handle.agent.session` for materialization (`agent-bindings.mjs:1143`).

### Exact exported symbols (test-use @ 76fda729)

| Symbol | Module (file:line) | Signature |
|---|---|---|
| `AgentHandle` | `packages/core/agent/src/index.ts:165` | `interface AgentHandle { agent: Agent; dispose(): Promise<void> }` — returned by `AgentRegistry.create`/`resume` (`:400`, `:419`) |
| `ReactLoopAgent.session` | `packages/core/agent-loop/src/agent.ts:92` | `public readonly session: Session` (constructor field; the agent is built at `agent-loop/src/index.ts:645` and published as the handle's `agent`) |
| `Session.snapshotEvents` | `packages/core/session/src/index.ts:600` | `snapshotEvents(fromSeq?: SessionLogOffset, toSeqExclusive?: SessionLogOffset): readonly SessionEvent[]` — immutable frozen snapshot of a half-open log range |
| `Session.ownEvents` | `packages/core/session/src/index.ts:615` | `ownEvents(): readonly SessionEvent[]` — events after the fork-inherited prefix |
| `Session.deriveMessages` | `packages/core/session/src/index.ts:790` | `deriveMessages(): Message[]` — the derived LLM history (frozen shared `Message` objects; empty-content assistant messages derive to null and are excluded, `:804-807`) |
| `SessionStore.get` / `SessionStore.flush` | `packages/core/session/src/index.ts:1120` / `:1087` | service name `'sessions'` (`:862`); `get(id): Session | undefined`; `flush(session): Promise<boolean>` — the stock `sessions` service is a HARD inject of the Team host row already (`packages/runtime/src/plugin/host.ts:464`) |
| `'turn/end'` event | `packages/core/session/src/types.ts:277` | `'turn/end': { turn: number; reason: TurnEndReason }`; `TurnEndReasonMap` at `:193-214` with kinds `completed | aborted(reason: TurnEndCancelCause) | blocked | error(error: LlmFailure) | max-tokens | interrupted` |
| `'user/message'` / `'assistant/message'` events | `packages/core/session/src/types.ts:289` / `:302` | `user/message: UserMessage`; `assistant/message: { turn, step, message: AssistantMessage, usage?, interrupted? }` |
| `AssistantMessage` / `TextBlock` | `packages/llm/llm/src/message.ts:148` / `packages/llm/llm/src/types.ts:54` | `{ id, role: 'assistant', content: ContentBlock[], source }`; text blocks `{ type: 'text', text }` — text extraction = join the `type === 'text'` blocks |
| `LlmFailure` | `packages/llm/llm/src/types.ts:40` | structured failure carried by `turn/end` `error` reason |

**Service-level alternative (documented public):** `SessionQueryEngine.readSurface` — `packages/session-query/session-query/src/index.ts:308`, `readSurface(sessionId: SessionId): Promise<SessionSurfaceSnapshot>` (record at `types.ts:37-46`: `events: SurfaceEvent[]` "in model-history order"), plus `readSession(sessionId): Promise<SessionLogSnapshot>` (`:183`, full raw log incl. `turn/end`). Service name `'sessionQuery'` (`:105`); README: "Use `ctx.sessionQuery` from application code when you need to read or search session history … when you need programmatic access to what the model saw". Reads are live-preferred (a live member session never touches persistence).

**`sessionPersistence` is NOT a read seam:** `SessionPersistence` (`packages/session/session-persistence/src/index.ts:134-198`) exposes only `create` / `open` / `flush` / `stat` / `list` (write-ownership + durability surface; `stat` is a change-token snapshot without event bodies). Note also rc.1 removed `sessionPersistence.ensureMaterialized` — the Team host row shims the frozen glue's `sessionPersistence.ensureMaterialized(session)` deps key onto the stock `sessions.flush(session)` (`packages/runtime/src/plugin/host.ts:479-501`).

### Recommended minimal read (glue-side, zero new service dependencies)

Inside `deliver()`, after `whenIdle()` and the existing materialization (so the turn is closed AND durable):

1. `const events = handle.agent.session.ownEvents()` (or `snapshotEvents(lastDeliveredSeqHint)`).
2. Locate the delivered user message: the glue itself builds it with the deterministic prefix `` `[team-work requestToken=${args.requestToken}]` `` (`agent-bindings.mjs:1106`) — correlation is exact, no fuzzy match.
3. Read that turn's `'turn/end'` event → `reason.kind` (the authoritative turn outcome).
4. Collect the turn's `'assistant/message'` events (same `turn` number, between `turn/start` and `turn/end`); the last one with non-empty text content is the body.

Why `snapshotEvents`/`ownEvents` over `deriveMessages()`: `deriveMessages()` returns only message history (no `turn/end`), so it cannot by itself distinguish "completed" from "error/aborted/max-tokens". `ownEvents()` gives both in one public call on the very `Session` object the glue already owns.

Public-API redline check: the static `AgentHandle.agent` type is the minimal `Agent` interface (`core/agent/src/types.ts:12-15`, `id` only) — the live face (`followup` `agent.ts:131`, `cancel` `:143`, `whenIdle` `:204`, `session` `:92`) belongs to the exported `ReactLoopAgent`. The glue is plain untyped ESM and **already** relies on this same live face for `followup`/`whenIdle`/`cancel`/`session` — reading `session.ownEvents()` is the same seam class, not a new private dependency, and no upstream typing is required. Typed alternative without any live-face reliance: `sessions.get(childSessionId)` via the `sessions` service the host row already hard-injects (`host.ts:464`) — a one-line additive glue deps pass if C2 prefers.

**Verdict on Q1: public transcript read seam = YES** (handle-based `Session` read, with `ctx.sessionQuery.readSurface`/`readSession` as the documented service-level alternative). Neither the succeeded-body half nor the status half is blocked on upstream.

---

## Q2 — CONTRACT DELTA (minimal, Team-owned only)

New shared DTO (one definition, C1-owned, in `packages/runtime/admission/types.ts` next to `WorkDeliveryPort`):

```ts
/** The minimal Leader-facing member work result (v2 D2 decision; no transcript). */
export interface WorkDeliveryResult {
  /** The requestToken the result correlates to, verbatim. */
  readonly requestToken: string
  /** 'succeeded' only when the member turn genuinely completed with an available body. */
  readonly status: 'succeeded' | 'failed' | 'unavailable'
  /** The member's last non-empty assistant text of the delivered turn (succeeded only). */
  readonly body?: string
  /** Explicit failure/unavailability facts (failed/unavailable). */
  readonly error?: { readonly code: string; readonly message: string }
}
```

Attachment points, exact files:

| File (Team-owned) | Change |
|---|---|
| `packages/runtime/admission/types.ts` | (1) `WorkDeliveryPort.deliver(...)` return type: `Promise<void>` → `Promise<WorkDeliveryResult>` (`:280-299`; the port doc comment "observed successful completion" becomes "observed turn completion AND extracted/normalized the minimal member result"). (2) `WorkChainResult` (`:118-141`): add `readonly memberResult?: WorkDeliveryResult` (present for full/resume modes; for replay mode C1 synthesizes an explicit unavailable — see Q3). (3) `RuntimeActionEffect` (`:122-210`): add `readonly memberResult?: WorkDeliveryResult` to the `work-admitted` variant (`:139-158`) AND the `member-activated` variant (`:160-186`) — delegate-create runs the same chain and must surface the same result (`effects.ts:622-637`). |
| `packages/runtime/action-router/work-execution.ts` | `executeWorkChain` (`:294`): capture `const delivered = await deps.workDelivery.deliver({...})` (today the return is discarded, `:421-429`) and include `memberResult: delivered` in the full (`:449-458`) and resume results; the replay branch (`:315-337`) synthesizes `memberResult = { requestToken: deps.requestToken, status: 'unavailable', error: { code: 'WORK_REPLAYED', message } }` (no re-delivery, no business re-report — plan §1.3). |
| `packages/runtime/action-router/effects.ts` (C2) | `runWorkChainOn` (`:424-459`): copy `chain.memberResult` into the `work-admitted` effect; `runDelegate` activate path (`:622-637`): copy it into the `member-activated` effect alongside the existing `workSequence`/`workSettled`. |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` (C2) | `workDelivery.deliver` (`:1094-1145`): after `whenIdle()` + materialization, perform the Q1 read (token-prefixed user message → `turn/end` reason → last non-empty `assistant/message`) and return the normalized `WorkDeliveryResult`; the signal race (`:1110-1136`) and the fail-closed throw contract are unchanged. |

### Confirmed NOT needed

- **Storage schema: none.** No new durable table/record. The settlement fact payload (`settleFactPayload`, `work-execution.ts:594-611`) keeps its closed shape (`workOutcome: 'settled' | 'delivery-failed'` + `failure?`); the structured result is a transient action-outcome value, not durable state.
- **Ledger category: none.** No new fact family; the existing `member-lifecycle-changed` settlement fact remains the control-plane truth (`FACT_LIFECYCLE_CHANGED`, `work-execution.ts:583-589`).
- **Remote wire: none.** The Leader tool projection is lossless — `toExecutedResult` copies `effect: outcome.effect` verbatim (`packages/tools/src/tools.ts:295-307`) — and the remote handler returns `{ data: { outcome } }` with no field allowlist (`packages/remote/src/handlers/member.ts:97-135`; `admissionEffectSequence` only reads `effect.sequence`, `:50`). An additive `memberResult` field rides both envelopes unchanged.
- **Upstream patch / private API: none.** All reads use public exported surfaces (Q1).

**Verdict on Q2: the minimal structured result requires ONLY Team-owned contract/effect changes (2 type files + 2 consumer files + tests). No storage schema, no ledger category, no remote wire change, no upstream change.** This satisfies G1's routing condition "C1/C2 D2 → A4 contract 仅 Team-owned" (v2 plan §7).

---

## Q3 — REPLAY / FAILURE SEMANTICS (per case)

Leader-facing = what the Leader model's tool call returns (`TeamToolsResult`), and the control-plane truth that must stay consistent.

| Case | Leader-facing result (required) | Where distinguishable in the chain today (code point) |
|---|---|---|
| **Fresh success** (turn completed, body present) | `executed` effect with `settled: true` AND `memberResult: { requestToken, status: 'succeeded', body }`. `settled` stays control-plane only. | Today **indistinguishable from a contained turn failure**: `deliver()` is `Promise<void>` (`types.ts:298`), return discarded (`work-execution.ts:421-429`), contained LLM errors do not reject `whenIdle` (`agent-bindings.mjs:1137-1142`). Post-delta distinguishable by `turn/end` `reason.kind === 'completed'` + a non-empty `assistant/message` in the turn (`session/src/types.ts:277,302`). |
| **Fresh delivery failure** (deliver() rejects: child agent cannot boot, `prepareAgentForRequest` fault, `whenIdle` rejection, abort, materialization fault) | Rejected tool result `{ status: 'rejected', code: 'WORK_DELIVERY_FAILED', message, details: { instanceId, childSessionId, requestToken, cause } }` (`tools.ts:139-147`); NO effect, NO `memberResult` (the chain throws before the effect is formed); durable settlement fact `workOutcome: 'delivery-failed'`. | `work-execution.ts:430-444` (catch → `closeIntervalTolerated` → `failClosedSettle` `:519-515`/`:519-538` → throw `WORK_DELIVERY_FAILED`); settle fact `:594-611`. Already fail-closed today; the delta must NOT attach a `memberResult` on this path (a throw is the signal — no body was observed). |
| **Abort / timeout signal** | Explicit failure/unavailable, never success. (a) Abort while waiting on the per-team lock: `executeEffect` rejects with the signal reason → rejected tool result (`effects.ts:124-130`). (b) Abort during delivery: the glue calls `handle.agent.cancel({ kind: 'user' })` and rejects the wait (`agent-bindings.mjs:1117-1119, 1122-1130`) → delivery-failed settlement + `WORK_DELIVERY_FAILED` rejected result. **Timeout: no timeout exists anywhere in the chain today** (`whenIdle` is awaited with no deadline); the only timeout mechanism available without new schema is caller-side abort through the existing `request.signal`. | (a) `effects.ts:124-130`. (b) **delegate-create only today**: `runDelegate` passes `ctx.request.signal` into the chain (`effects.ts:620` → `work-execution.ts:428` → glue race `agent-bindings.mjs:1110-1136`). **ASMETRY:** the follow-up path drops the signal — `runWorkChainOn` builds chain deps WITHOUT `signal` (`effects.ts:434-448`), so an abort mid-follow-up-delivery is not honored until the next boundary. The port already accepts `signal?` (`types.ts:297`), so propagating it in `runWorkChainOn` is a contract-neutral one-liner — flagged as a C2-owned decision (effects.ts is C2's file; `WorkDeliveryPort` shape is C1's frozen DTO and already covers it). |
| **Replay of an already-settled token** | NO re-delivery, NO business re-report. `executed` effect with `settled: true`, `replayed: true` (set by `runWorkChainOn`, `effects.ts:452`), and `memberResult: { requestToken, status: 'unavailable', error: { code: 'WORK_REPLAYED', message: 'work unit already settled (settlement fact present); original result not re-reported' } }`. The original body is deliberately not re-served (plan §1.3 "replay 不重复 delivery、不重复业务报告"; G3 "settled 与业务 status 分离"). | `work-execution.ts:315-337` — the replay branch (settlement fact scan finds `to: 'SETTLED'` for the token): zero writes, zero delivery, returns `mode: 'replay', settled: true`. Distinguishable today by `chain.mode`; the delta only adds the synthesized unavailable result. |
| **Body unreadable** (turn over, no usable assistant text: contained error turn, `max-tokens` with no assistant message, tool-only turn, empty-content assistant) | `executed` effect with `settled: true` (control plane closed) but `memberResult.status` NEVER `'succeeded'`: — `turn/end` reason `error` → `failed`, `error.code` from `LlmFailure` (or `WORK_TURN_ERROR`), message from the failure (`types.ts:204`); — reason `aborted` → `failed`, code `WORK_TURN_ABORTED` (cancel is explicit failure per plan §1.3); — reason `max-tokens` → `failed`, code `WORK_TURN_MAX_TOKENS` (truncated output must not masquerade as success); — reason `blocked` → `failed`, code `WORK_TURN_BLOCKED`; — reason `completed` but no non-empty assistant text → `unavailable`, code `WORK_NO_ASSISTANT_BODY`; — reason `interrupted` (cold-read synthesizer only, never live — `types.ts:208-213`) → `unavailable`, code `WORK_TURN_INTERRUPTED` (defensive; cannot arise from a fresh `whenIdle`-closed turn). `body` is carried on `succeeded` only. | Today: **not distinguishable at all** — `deliver()` returns void and the settlement fact is `'settled'` (`work-execution.ts:448,554,597`); the `turn/end` reason exists in the child log (`types.ts:277`) but no Team code reads it. Post-delta the glue's turn-read (Q1 step 3) is the single distinguisher; the classification table above is the C1-owned mapping. |

Additional chain facts pinned for C1/C2:

- Production delegate (both create and continued) and follow-up ALL run `executeWorkChain` when the three chain ports are installed (`effects.ts:365-373` `admitWorkOn` → `runWorkChainOn`); the admit-only fallback (`effects.ts:374-399`, `settled` absent) runs only on the partial-install evidence path. So `memberResult` needs exactly two effect carriers: `work-admitted` (follow-up + delegate-continued) and `member-activated` (delegate-create).
- Settlement convergence: `settleAdmittedWork` (`work-execution.ts:541-591`) settles RUNNING→SETTLED, repairs the crash-window missing fact for SETTLED, and no-ops for terminal states; a settlement fault propagates (no fake success). The structured result does not change any of this.
- Existing tests to extend: `packages/runtime/test/p8s3-work-chain.test.ts` — W4 failed delivery fail-closed (`:744`), W9 same-token replay (`:781`), resume redelivery (`:800`), R1 delegate-create vertical (`:813`), R2 prompt (`:829`).

---

## Q4 — SINGLE-WRITER PLAN (DAG constraint v2 §4: "D2 shared result contract 必须由单一 contract owner 修改"; C2 card §10: "C1 contract owner 负责 shared DTO；C2 只能消费冻结后的接口")

**C1 — shared DTO owner (runs first, serial; freezes the DTO):**

Owned files (C1 alone writes these):
- `packages/runtime/admission/types.ts` — `WorkDeliveryResult` definition; `WorkDeliveryPort.deliver` return type; `WorkChainResult.memberResult`; `memberResult` fields on `work-admitted` + `member-activated` effect variants.
- `packages/runtime/action-router/work-execution.ts` — chain-side propagation (full/resume carry the port's result; replay synthesizes the explicit unavailable).
- C1 focused tests: extension of `packages/runtime/test/p8s3-work-chain.test.ts` (or a new `packages/runtime/test/p8s3a-result-contract.test.ts`) — chain tests with a stub delivery port covering full/resume/replay/failed-delivery and the mapping-table invariants.

**C2 — consumer (runs after C1 freeze; may NOT redefine the DTO):**

Owned files (C2 alone writes these):
- `packages/runtime/src/plugin/live/agent-bindings.mjs` — the real read seam in `workDelivery.deliver` (Q1 recipe) + normalization to the frozen `WorkDeliveryResult`; doc-header deps note updated only if the `sessions` service route is chosen.
- `packages/runtime/action-router/effects.ts` — copy `chain.memberResult` into the two effect carriers (`runWorkChainOn`, `runDelegate` activate path); optional signal propagation in `runWorkChainOn` (Q3 asymmetry).
- C2 focused tests: new file (e.g. `packages/runtime/test/p8s3b-result-effects.test.ts`) — effect-mapping tests with a stubbed chain result; glue read/normalization tests (turn classification, token correlation, no-body cases).

**Boundary rule:** the DTO type and its closed status/error-code vocabulary are C1's; C2 constructs DTO values and consumes them. `packages/tools/src/tools.ts` and `packages/remote/` need **zero** changes (lossless pass-through verified, Q2). No other task touches these four files in Wave C; Wave B's B1/B2 may touch `agent-bindings.mjs` in different functions (plan §4 assigns mechanical cherry-pick resolution to the main Agent) — the v2 schedule already serializes C1→C2 (§13 table "C1–C2 D2 … contract 串行"), so no concurrent writer on the result path.

---

## Verdict

- **A4 verdict: GO for C1/C2 — the D2 minimal structured result is achievable with Team-owned contract/effect changes only.**
  - Public transcript read seam: **yes** (primary: `handle.agent.session.ownEvents()` / `snapshotEvents()` + `turn/end` reason; alternative: `ctx.sessionQuery.readSurface` / `readSession`; `sessionPersistence` is not a read seam).
  - Contract delta: Team-owned only — `admission/types.ts` (DTO + port/effect shapes), `work-execution.ts` (chain propagation + replay synthesis), `effects.ts` (effect carriers), `agent-bindings.mjs` (glue read/normalize). No storage schema, no new ledger category, no remote wire change, no upstream patch, no private API.
  - G1 routing condition "A4 contract 仅 Team-owned" is satisfied → C1/C2 may enter Wave C (no `CONTRACT_CHANGE_REQUEST` required for the contract itself).
- **Not blocked.** Both halves (status-only AND succeeded-body) are implementable within the frozen budget.

## Blocker section

None. (Transcript read seam present — no `CORE_SEAM_BLOCKER`; no frozen-contract conflict — no `SPEC_CONFLICT`; no test-infra dependency for this characterization.)

## Remaining risks / open decisions for C1/C2

1. **Follow-up signal asymmetry** (effects.ts:434-448 vs :620): abort/timeout during a follow-up delivery is not honored today. Propagation is a one-line contract-neutral fix inside C2's file; C1 should record the decision (propagate vs document-limit) in the frozen contract notes.
2. **Timeout has no mechanism today** — only caller-side abort via `request.signal` is available without new infrastructure; a real deadline would be scope creep beyond the minimal result (plan §1.3 forbids "取消/超时高级协议").
3. **Body size**: the minimal shape has no cap on `body` (one member message, not a full transcript — compliant). If C1 adds a cap, upstream convention requires it as a validated config field, not a hardcoded tunable; recommend: no cap in v2, document.
4. **Replay non-re-reporting is lossy by design**: if the Leader's original observation of the result was lost (e.g., Leader context compaction), the body cannot be recovered via replay — accepted limitation of the minimal contract (full transcript explicitly out of scope, plan §1.3).
5. **Live-face typing**: `AgentHandle.agent` is statically the minimal `Agent`; the glue is untyped ESM so runtime is fine, but if C2 later types the glue it must either keep the mjs boundary or switch to the `sessions.get(id)` service route (host row already injects `sessions`, host.ts:464).

## TaskResult

- task_id: A4
- model_route: qiyuan-self/qwen3.8-27b
- elapsed_minutes: 30
- base_sha: 2baad2f
- changed_files: `dev/agent-workflow/evidence/team-d1-d6-repair-v2/A4/A4Result.md` only
- tests_run: none (read-only characterization; no runtime needed — consistent with A4 read-only scope)
- evidence_paths: `dev/agent-workflow/evidence/team-d1-d6-repair-v2/A4/A4Result.md`
- self_verdict: GO (A4 contract Team-owned only → C1/C2 may enter Wave C)
- blocker_type: none
- remaining_risks: see "Remaining risks" (follow-up signal asymmetry; no timeout mechanism; body cap; replay non-re-report lossiness; live-face typing)
- commit_sha: (written by the committing step)
