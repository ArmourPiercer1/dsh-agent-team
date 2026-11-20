# CONTRACT — definition authority, execution boundary, settlement writer

**Part of:** `docs/plans/memo/ute-g1-20261120/` — the frozen UTE G1 implementation
contract. Read the marker discipline in [`README.md`](./README.md) §0 first.
**Status:** `[PROPOSED-BY-MEMO]` as a frozen interface for UTE-1…UTE-4, built on
the `[MEASURED]` facts marked M1–M5 in the index. Where this file and a measured
fact disagree, the measurement wins and this file is wrong until fixed.

---

## 1. The single tool definition authority

### 1.1 Who owns a tool's name / schema / description today

`[MEASURED]` There are **two** definition channels in this repository, and only
one of them survives UTE-4.

| channel | owner | what it defines | path (re-read it) | fate |
|---|---|---|---|---|
| **Host registry** (the authority) | the pinned DSH host's `ToolsService` | `ToolDefinition` name, parameter schema, description, render/stream/timeout, the scoped toolSet, and the selected `ToolExecutor` | host package `@deepseek-ai/dsh-tools` (not vendored here); the Team side only *verifies* it: `scripts/eb3-tool-acceptance.mjs` header; `docs/plans/memo/ute-prep-20261116/03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md` 裁决 1 | **stays** — it is the definition authority for every family |
| **Legacy governed plane** (the second channel, being retired) | Team `FamilyAssembly` + `a5p5-tools` | its own row `ToolDefinition`s for the same model-visible names (`read`, `write`, `edit`, `read_image`, `grep`, `glob`, `team_bash`, …), registered through the plane's governed seam | `packages/tools/families/manifest.json`; `packages/runtime/src/plugin/live/family-assembly.mjs`; `packages/tools/fs-family/src/read-row.mjs` (`buildReadRowDefinition`), `write-row.mjs:65` (`buildWriteRowDefinition`), `edit-row.mjs`, `image-row.mjs`; `packages/tools/a5p5-tools/src/register.ts:325` (`createGovernedToolDefinitions`) | **retired per family** by UTE-3/UTE-4 under the predicate; not deleted by UTE-0/1/2 |
| **Native attach path** (the new path) | the host, mounted by Team | the **same** upstream `ToolDefinition`s, mounted on an isolated Cordis scope; Team contributes the scoped service (the provider), not the definition | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:846` (`mountMemberA5sfRealm`), `:1516` (`attachA5sfNativeToolModules`); `packages/runtime/team-services/src/mount.ts:814` (`mountA5sfRealm`) | **the consuming path** |

`[MEASURED]` Consequence: today the same model-visible name can be answered by
two different code paths (`family-assembly` row vs native attach), which is why
`PLANE_SUPPORTED_NATIVE_TAKEOVERS` exists in
`packages/runtime/src/plugin/live/team-tool-plane.mjs` and why
`scripts/eb3-tool-acceptance.mjs` reads the claim set statically from the family
manifest. The duplication is the thing UTE removes, per family.

### 1.2 What the new path MUST consume, and MUST NOT redefine

`[PROPOSED-BY-MEMO]` — binding for UTE-1…UTE-4 unless the owner rules otherwise.

1. **MUST** obtain the tool name, parameter schema, description and presentation
   from the pinned host's `ToolDefinition` (by mounting the host's own tool
   module on a scoped context, as `attachA5sfNativeToolModules` already does).
2. **MUST** treat the host's `ToolsService.resolve()` / `ResolvedToolSet` as the
   answer to "which tool is visible here?". A Team-side list of names is
   **verification data** (a claim set, a receipt), never a selectable catalogue.
3. **MUST NOT** register a Team-authored `ToolDefinition` for a native tool name
   on the new path — not as a shadow, not as a fallback, not "temporarily during
   migration". A name answered by a Team definition while the native module is
   also present is exactly the A/B ambiguity UTE-04 accepts only for trusted
   deployment, and only *outside* Team's control.
4. **MUST NOT** build a second `ToolRegistry` / dispatcher / batch scheduler.
   The pipeline is the host's (`ToolExecutionPipeline`); the batch order is the
   host's (`executeToolBatch`), including for PTC nested calls.
5. **MUST** fail closed when the required source cannot be verified (wrong
   digest, wrong package, wrong tree, absent module): a definition whose origin
   cannot be named is not a definition this path may expose.
6. **MAY** record a **binding receipt** (source package + version + digest +
   scope identity + boundary digest) for audit. The receipt is evidence about a
   definition; it is not a definition and it is not a permission.

`[PROPOSED-BY-MEMO]` The measurable falsifier for this section: a run where the
Team side changes a schema/description for a native name without the host module
changing. If that run can be produced, §1.2.3 is violated.

---

## 2. The execution boundary

### 2.1 Where admission ends and execution begins

`[MEASURED]` `installScopedToolGuard` (`packages/runtime/tool-dispatch/install.ts:356`)
arms the Team seams on the host pipeline: `tools.guard` (`:365`),
`tools/pre-execute` (`:791`), `tools/post-execute` (`:812`), `tools/result`
(`:831`), `tools/execute` (`:982`). The permission adapter
(`packages/runtime/operation-permission/pre-execute-adapter.ts`) consumes the
existing ControlService allow and writes one execution fact per consumed allow.

`[PROPOSED-BY-MEMO]` The boundary is therefore **one line**:

```
… tools/pre-execute  (ControlService ask / Grant consumption — ADMISSION)
… tools.guard        (binding / Stop / scope monotonic check — ADMISSION)
    ────────────────  ← admission ends here; nothing below may re-decide it
… tools/execute      (host dispatch → ToolDefinition.execute → provider/OS — EXECUTION)
… body observation  (provider / OS receipts — OBSERVATION)
… tools/post-execute / complete / tools/result (host result path — PRESENTATION)
```

"Execution begins" = the host has entered dispatch for this call. Team code on
the execution side may observe that moment (`EXECUTION_DISPATCH_ENTERED`) but may
not move it: a fact recorded before dispatch is a claim, and an admission that
"counts as" execution is how a rejected call gets a success story.

### 2.2 What the new binding may decide

| may | why |
|---|---|
| select and verify the **source** of the tool module (package/version/digest/tree) | UTE-01/02; the receipt is evidence |
| install the scoped provider/service and refuse to mount when a **required** face is missing | UTE-07 (`ENFORCEMENT_UNAVAILABLE` / `*_UNCONFINED_REALM`, e.g. `A5SF_NETWORK_UNCONFINED_REALM`) |
| enforce `EffectiveIo ⊆ AgentCeiling ∩ ToolRestriction` inside the provider/OS layer | UTE-06; the hard ceiling is the provider's job, not the model's |
| return a typed denial from the provider, and record a **deny** fact | a refusal is an observation, not an approval |
| report `dispatch` / `bodyOutcome` / `effectEvidence` / backend receipt to the settlement writer | UTE-15/16 |

### 2.3 What the new binding may not decide

| may not | violated invariant |
|---|---|
| mint, consume, extend, or revoke an approval / Grant / Stop | UTE-13 (D5) |
| decide that an approved call is therefore allowed at the I/O layer (approval does not widen the ceiling) | UTE-06 |
| invent or rewrite a tool name/schema/description | UTE-01/02 |
| reorder batch results, rewrite PTC nested ordering, or write its own Session tool events | UTE-01/02, `executeToolBatch` |
| turn "the body returned" into `succeeded` without an observation, or "no effect proof" into `none-confirmed` | UTE-16 |
| treat `isError:false` as "no side effect" | UTE-16/S1 falsifier |
| keep its own in-memory execution ledger as the authority (a `WeakMap` is a cache; the durable fact is the fact) | UTE-17, S1.5 |
| silently fall back to a wider provider when a face/ABI is unavailable | UTE-09 |

---

## 3. The settlement writer contract (the interface UTE-2 implements)

`[PROPOSED-BY-MEMO]` This is the interface, not prose. It is grounded in the
`[MEASURED]` writer (M5) and deliberately does **not** replace `ControlService`:
the writer is a fact sink under ControlService's authority, not an approval
engine and not a second Grant ledger.

```ts
/** One physical execution attempt = one ExecutionId = at most one terminal fact. */
type DispatchState = 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed'
type BodyOutcome = 'completed' | 'failed' | 'unknown'
type EffectEvidence = 'none-confirmed' | 'possible' | 'observed' | 'unknown'

interface ExecutionFact {
  /** The canonical identity of the physical attempt. Generated by trusted
   *  provenance (team/boot/agent/host call), never from a model-supplied id or
   *  a bare `callId` that could collide across sessions. */
  executionId: string
  rootSessionId: string
  agentInstanceId: string
  /** The host's call identity, when the host exposes one. */
  hostCallId?: string
  /** PTC / sub-agent lineage. Parent approval never launders child permission. */
  parentExecutionId?: string
  /** Every ControlRequest leg that references this fact. Read-only reference:
   *  the writer does not consume, mint or merge approvals. */
  controlRequestIds: readonly string[]
  dispatch: DispatchState
  bodyOutcome: BodyOutcome
  effectEvidence: EffectEvidence
  hostResult?: { readonly isError: boolean; readonly errorCode?: string }
  /** ISO-8601 UTC. */
  recordedAt: string
  /** Recovery appends; it never rewrites the fact it reconciles. */
  recovery?: { readonly reconciledFrom: string; readonly at: string; readonly detail: string }
}

interface ExecutionSettlementWriter {
  /** Exactly-once *fact ownership* by ExecutionId — NOT exactly-once OS effect.
   *  A second terminal write for the same ExecutionId is refused
   *  (`recorded:false`), never merged and never overwritten. */
  record(fact: ExecutionFact): Promise<{ recorded: boolean; reason?: string }>

  /** Durable read, valid after a cold start (S1.5). */
  read(executionId: string): Promise<ExecutionFact | undefined>

  /** S1 completeness surface: executions whose dispatch entered but which have
   *  no terminal fact yet. Non-empty is a gate failure, not a warning. */
  listUnsettled(rootSessionId: string): Promise<readonly string[]>

  /** Read-compatible projection of the measured writer:
   *  `ControlService.recordExecutionResult({rootSessionId, callId, instanceId?, outcome})`.
   *  Provided so existing readers keep working; it is a projection, never a
   *  second authority. */
  projectControlResult(args: {
    readonly rootSessionId: string
    readonly callId: string
    readonly instanceId?: string
    readonly outcome: 'succeeded' | 'failed' | 'unknown'
  }): Promise<{ recorded: boolean; requestId?: string }>
}
```

### 3.1 Invariants the writer MUST hold (each is a falsifier)

| id | invariant | falsifier |
|---|---|---|
| W1 | **One canonical fact per physical execution.** `executionId` is the key; a duplicate terminal write is refused. | two contradictory terminal facts for one execution; a second `record()` overwrites the first |
| W2 | **`UNKNOWN` is a first-class terminal state.** Crash / `SIGKILL` / unconfirmed termination / insufficient evidence → `bodyOutcome:'unknown'` (and `dispatch` reflecting what is actually known). Never `succeeded`; never "never executed". | a `kill -9` after dispatch produces no fact, or a `succeeded` fact |
| W3 | **No second Grant authority.** The writer exposes no `approve` / `grant` / `consume` / `revoke`; `controlRequestIds` is a reference list. | any code path that lets the writer's return value authorise a retry or a new execution |
| W4 | **S1 hard guarantee (G1 acceptance):** every call that entered dispatch eventually has a queryable fact — `settled` or explicit `unknown`. `listUnsettled()` non-empty is a failure. | a dispatched call that is absent from the journal after recovery |
| W5 | **Fact writing is not triggered by "the model turn ended normally".** rc.5's refusal path yields usage and then throws `CONTENT_REFUSED`; a turn-finalizer flush loses exactly those facts. | a fact that exists only when the turn completed |
| W6 | **S2 is separate and is NOT claimed here.** Commit-before-return (durable before the model sees `tool/result`) is a stronger gate; `tools/result` is an emit and its async listeners are not a durable commit. If no public awaitable point exists, the correct output is `CORE_SEAM_BLOCKER`, not a fork and not a `tools/result` listener. | evidence citing a `tools/result` handler as proof of ordering |
| W7 | **The three axes stay separate.** Host `isError`, backend exit/signal, and physical effect are recorded on separate fields. | `exit 1` + a written file recorded as "no effect"; a blocked post-execute recorded as "body never ran" |
| W8 | **Recovery appends.** Reconciliating a fact adds `recovery`; it never mutates the old values and never replays a consumed operation. | a rewritten `bodyOutcome`, or an automatic re-dispatch under the same `executionId` |

`[MEASURED]` Compatibility floor: the existing durable fact
`ControlService.recordExecutionResult(...)` (`packages/runtime/control/service.ts:3572`,
typed at `packages/runtime/control/types.ts:2427`) writes one
`control-execution-result` row per matched ControlRequest, is idempotent per
request, and is documented as *lifecycle observation, never an approval, a
consumption, or a replay authorization*. UTE-2 must keep that projection
readable (W-compat) while adding the keying and completeness above.

`[UNKNOWN]` Whether the host exposes an awaitable point for W6. This memo does
not claim it does. The measured call sites today are fire-and-forget
(`void service.recordExecutionResult(...)` at
`packages/runtime/src/plugin/live/agent-bindings.mjs:3259`) and a guarded write
in the permission adapter (`pre-execute-adapter.ts` `writeExecutionFact`); both
are S1-shaped, neither is S2.

---

## 4. Non-goals of this contract

- It does not move the host pin, the Authority pointer, or the release state.
- It does not delete, weaken or "temporarily bypass" the legacy plane. The
  legacy plane is retired **per family** by UTE-4 under
  [`RETIREMENT.md`](./RETIREMENT.md).
- It does not rewrite `ControlService`; it adds a fact sink and a projection.
- It does not authorise a fork. See [`README.md`](./README.md) §5 and the
  governance proposal below.

## 5. Governance change this contract would need (recorded, not applied)

`[PROPOSED-BY-MEMO]` No UTE-0…UTE-4 work package may edit `AGENTS.md`,
`docs/ROUTER_RULES.md` or any governance document. If a later work package
proves a public-API gap that can only be closed by a Team-local infrastructure
fork, the sequence is fixed by the owner's rulings: **first** a
`CORE_SEAM_BLOCKER` (minimal reproduction on the pinned tag+commit, public seam
exclusion table), **then** a named, per-instance owner approval, **then** a
governance ruling writing the exception into `AGENTS.md`. The draft exception
text exists in #765 (`docs/plans/memo/ute-prep-20261116/06-PROPOSED-ACTIVE-PLAN-PATCH.md`
patch B) and is deliberately **not applied** by this PR. Until that ruling, the
prohibition stands and the gap is a blocker, not a TODO.
