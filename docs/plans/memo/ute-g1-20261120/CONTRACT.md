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

## 3. Settlement: the durable store, the writer adapter, and the S1/S2 split

`[PROPOSED-BY-MEMO]` This section is the interface **and** the persistence boundary
UTE-2 implements. It was revised on 2026-11-20 after the external review of #795
(`docs/reviews/20261120-1700.txt` §3.2) found that the first implementation shipped
a good store but not the frozen interface, and that this file's S1/S2 claim was
logically wrong. Both are corrected here; the correction is part of the contract.

### 3.0 Two objects, and why they are not the same object

| object | what it is | may it change? |
|---|---|---|
| `ExecutionSettlementStore` | the persistence + state machine + recovery: `recordAdmission`, `enterRunning`, `recordStop`, `settle`, `recoverUnsettled`, `read`, `list`. It owns bytes, transitions, conflict detection and the lock. | Yes — its method names are an implementation detail of UTE-2 and may evolve with the state machine |
| `ExecutionSettlementWriter` | the **frozen** interface below: four methods, the only surface other code may depend on. It is a thin adapter over the store: it may map, refuse and project, and it may not decide anything. | No — changing it is a contract change, not a refactor |
| `ControlService` | the sole approval / Grant / Stop authority (D5). The writer references its ControlRequests read-only. | No |

`[PROPOSED-BY-MEMO]` **A PR that ships the store without the adapter has not
implemented §3.** The adapter adds no policy: every refusal it returns is a
refusal the store already made, restated in the frozen vocabulary. The store's
richer surface is allowed to exist; it must not become a second public interface
by accident.

### 3.1 The interface (frozen)

```ts
/** One physical execution attempt = one ExecutionId = at most one terminal fact. */
type DispatchState = 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed'
type BodyOutcome = 'completed' | 'failed' | 'unknown'
type EffectEvidence = 'none-confirmed' | 'possible' | 'observed' | 'unknown'

/** The durable admission: written BEFORE dispatch may proceed. */
interface AdmissionReference {
  readonly executionId: string
  /** sha256 over the canonical admission fields; immutable. */
  readonly digest: string
  readonly decision: 'allow' | 'deny'
}

interface ExecutionFact {
  /** Canonical identity of the physical attempt, minted from trusted
   *  provenance (Team boot / agent instance / host call), never from a
   *  model-supplied id and never from a bare `callId` that can collide
   *  across sessions. */
  executionId: string
  rootSessionId: string
  agentInstanceId: string
  /** The host's call identity, when the host exposes one. */
  hostCallId?: string
  /** PTC / sub-agent lineage. A parent approval never launders child permission. */
  parentExecutionId?: string
  /** Every ControlRequest leg referencing this fact. READ-ONLY reference: the
   *  writer does not consume, mint, merge or revoke approvals. */
  controlRequestIds: readonly string[]
  admission: AdmissionReference
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
   *  The first call writes (or advances) the fact; a second TERMINAL write for
   *  the same ExecutionId is refused (`recorded:false`), never merged and never
   *  overwritten. A non-terminal advance (dispatch/body evidence) is allowed
   *  only along the state machine. */
  record(fact: ExecutionFact): Promise<{ recorded: boolean; reason?: string }>

  /** Durable read, valid after a cold start (S1.5). */
  read(executionId: string): Promise<ExecutionFact | undefined>

  /** S1 completeness surface: executions with a durable admission and no
   *  terminal fact. Non-empty is a gate failure, not a warning. */
  listUnsettled(rootSessionId: string): Promise<readonly string[]>

  /** Read-compatible projection of the measured writer (M5):
   *  `ControlService.recordExecutionResult({rootSessionId, callId, instanceId?, outcome})`.
   *  Returns the same `{recorded, requestId?}` shape so existing readers keep
   *  working. It is a projection, never a second authority: it does not write
   *  a ControlService row, does not consume a Grant and fabricates no
   *  `requestId`. When the inputs cannot be matched to a recorded fact it
   *  returns `recorded:false` with a reason. */
  projectControlResult(args: {
    readonly rootSessionId: string
    readonly callId: string
    readonly instanceId?: string
    readonly outcome: 'succeeded' | 'failed' | 'unknown'
  }): Promise<{ recorded: boolean; requestId?: string; reason?: string }>
}
```

### 3.2 The order that makes S1 true: durable intent **before** dispatch

`[PROPOSED-BY-MEMO]` The earlier text of this file claimed that S2 (durable
before the model sees the result) implies S1 (every dispatch has a fact). It does
not. Reproduced from the review, this interleaving violates S1 while satisfying
S2's "persist before returning":

```
tool enters execution → effect produced → host SIGKILL → model never gets a result
→ no ExecutionId anywhere → S2's "before return" was never exercised, S1 failed
```

The fix is an ordering rule, not a stronger return path:

```
1  admission decided            ControlService ask / Grant consumption + guard  (ADMISSION)
2  store.recordAdmission(...)   DURABLE: record file fsynced AND parent dir fsynced,
                                only then does it return
3  host dispatch entered        EXECUTION_DISPATCH_ENTERED (observed, not decided)
4  terminal fact / explicit unknown
```

`[PROPOSED-BY-MEMO]` **Step 2 gates step 3.** Team code must not allow the host
dispatch to begin until `recordAdmission` has returned successfully; a store that
cannot make the admission durable must refuse the call (fail closed), not proceed
unwritten. The admission is written by the trusted adapter from the ControlRequest
and guard decision — never from a model-supplied id.

| crash window | durable state | recovery answer | what must never happen |
|---|---|---|---|
| before 2 returns | nothing | no dispatch happened (3 was gated on 2) | a dispatch that starts without a durable intent |
| between 2 and 3 | admission only | `UNKNOWN` (`EXECUTION_UNCONFIRMED`), `listUnsettled` non-empty | "absent from the journal"; a fabricated `COMPLETED`; an automatic replay |
| between 3 and 4 | admission + maybe RUNNING | `UNKNOWN` (`PROCESS_TERMINATED_WITHOUT_OUTCOME`) | `succeeded` from `isError:false`; "never executed" |
| after 4 | terminal | the settled fact | a second terminal fact for the same id |

`[PROPOSED-BY-MEMO]` Therefore:

- **S1** = *any execution that may produce a side effect has a durable, recoverable
  intent written before it starts; after recovery every such execution is either
  settled or explicitly `unknown`.* An unconfirmed execution is **not** evidence
  that nothing happened, and is never replayed automatically.
- **S2** = *S1 ∧ commit-before-model-visible-result* (the durable commit is
  complete before `tool/result` is presented). By construction S2 ⇒ S1; S1 does
  **not** imply S2. S2 remains *not* a G1 precondition and is not claimed.

`[UNKNOWN]` Whether rc.5 exposes a public awaitable point for S2's commit. The
measured call sites are fire-and-forget (`void service.recordExecutionResult(...)`,
`packages/runtime/src/plugin/live/agent-bindings.mjs:3259`) and a guarded write in
the permission adapter; both are S1-shaped, neither is S2. If no public point
exists, the correct output is `CORE_SEAM_BLOCKER`, not a fork and not a
`tools/result` listener.

### 3.3 Deployment premise this contract depends on: ONE writer per settlement root

`[PROPOSED-BY-MEMO]` The store is a single-writer durable log, not a distributed
one. That premise is part of the contract and is **enforced**, not assumed:

- one settlement root directory has **one live writer process**. Opening the store
  takes an exclusive lock (lock file + pid/boot identity). A second live writer is
  refused with `SETTLEMENT_WRITER_CONFLICT`; a lock whose owner is provably dead is
  reclaimed with a recorded reason. Two processes must never interleave transitions
  for one `ExecutionId`.
- every durable write is `write temp → fsync file → rename → fsync parent
  directory`. The parent-directory fsync is required: without it a rename can be
  lost by a crash even though the file content was synced.
- the store never relies on in-memory state for a durable answer: after a cold
  start the only source is the files.

`[UNKNOWN]` Multi-host / multi-process settlement is out of scope for G1; if a
later deployment needs it, that is a new decision (and a different store), not an
extension of this premise.

### 3.4 Invariants the writer MUST hold (each is a falsifier)

| id | invariant | falsifier |
|---|---|---|
| W1 | **One canonical fact per physical execution.** `executionId` is the key; a duplicate terminal write is refused. | two contradictory terminal facts for one execution; a second `record()` overwrites the first |
| W2 | **`UNKNOWN` is a first-class terminal state.** Crash / `SIGKILL` / unconfirmed termination / insufficient evidence → `bodyOutcome:'unknown'` (and `dispatch` reflecting what is actually known). Never `succeeded`; never "never executed". | a `kill -9` after dispatch produces no fact, or a `succeeded` fact |
| W3 | **No second Grant authority.** The writer exposes no `approve` / `grant` / `consume` / `revoke`; `controlRequestIds` and `admission` are references. | any code path that lets the writer's return value authorise a retry or a new execution |
| W4 | **S1 (durable intent):** an admission is durable before dispatch may proceed; every admitted execution is settled or explicitly `unknown` after recovery; `listUnsettled()` non-empty is a failure. **S2 is not this row** (see W6). | a dispatched call absent from the journal after recovery; a dispatch that proceeds after a failed admission write |
| W5 | **Fact writing is not triggered by "the model turn ended normally".** rc.5's refusal path yields usage and then throws `CONTENT_REFUSED`; a turn-finalizer flush loses exactly those facts. | a fact that exists only when the turn completed |
| W6 | **S2 is separate and is NOT claimed here.** Commit-before-return is stronger than S1 and is a different gate; `tools/result` is an emit and its async listeners are not a durable commit. | evidence citing a `tools/result` handler as proof of ordering |
| W7 | **The three axes stay separate.** Host `isError`, backend exit/signal, and physical effect are recorded on separate fields. | `exit 1` + a written file recorded as "no effect"; a blocked post-execute recorded as "body never ran" |
| W8 | **Recovery appends.** Reconciling a fact adds `recovery`; it never mutates the old values and never replays a consumed operation. | a rewritten `bodyOutcome`, or an automatic re-dispatch under the same `executionId` |
| W9 | **Admission is durable before dispatch** (the ordering rule of §3.2): the write is fsynced, including the parent directory, before it returns. | a crash test where the process dies after the admission "succeeded" and the record is missing |
| W10 | **One live writer per root.** A second live writer is refused; a dead owner's lock is reclaimed with a recorded reason. | two processes writing transitions for one `ExecutionId`; a lock that is silently stolen while its owner lives |
| W11 | **The adapter is the frozen surface.** All four methods exist, `listUnsettled` is complete, and `projectControlResult` never fabricates a `requestId`. | a caller reaching past the adapter into store internals; an empty `listUnsettled` while an admitted execution has no terminal fact |
| W12 | **No fabricated provenance.** `executionId`/`agentInstanceId` come from trusted Team/host provenance; `controlRequestIds` come from the ControlService record, not from the fact author. | a fact whose admission digest was computed by the same code that supplies the id, with no cross-check against the stored admission |

`[MEASURED]` Compatibility floor: the existing durable fact
`ControlService.recordExecutionResult(...)` (`packages/runtime/control/service.ts:3572`,
typed at `packages/runtime/control/types.ts:2427`) writes one
`control-execution-result` row per matched ControlRequest, is idempotent per
request, and is documented as *lifecycle observation, never an approval, a
consumption, or a replay authorization*. UTE-2 must keep that projection
readable (W11) while adding the keying and completeness above.

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
