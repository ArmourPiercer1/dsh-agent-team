# P7-T1 — Compatibility drift + ACK lifecycle — design note

Task: P7-T1 (H1 first wave). Worktree `.worktrees/P7-T1`, branch `task/P7-T1-compat-drift-ack`, base `6732601` (P7 kickoff on post-G6 master).

## Frozen spec (read verbatim before implementing)

### DevPlan §20.1 (Compatibility drift) — verbatim

```text
重新 probe：

Root cold resume
Member cold resume
new activation
relevant capability generation change
stale compatibility generation before new work

新 warning：

block NEW work

already admitted work：

may settle
```

### Architecture §27 (Compatibility model)

- §27.1 typed requirement domains (closed vocabulary): tools / skills / MCP servers / model/provider routes / persona/runtime-context compatibility / Team structural runtime capabilities. Unknown domain = Blueprint validation error.
- §27.2 results: PASS / WARNING / FATAL. WARNING = ordinary capability mismatch (ack-able via "Continue Anyway" → acknowledged degraded). FATAL = structural Team contract cannot hold (e.g. durable persistence unavailable, Agent lifecycle seam unavailable, Leader/Member surface, persona identity, AgentPreset complete:true conflict). **FATAL 不允许 Continue Anyway.**
- §27.3 acknowledgement: must correspond to a **specific mismatch/environment generation**, bound conceptually to `requirement fingerprint` + `capability/environment fingerprint`; **never a permanent "ignore all warnings" flag**. "如果环境或 selected AgentPreset 变化产生新的 mismatch，旧 acknowledgement 不自动覆盖新问题。"

### Architecture §28 (Admission State) — verbatim core

```text
OPEN
BLOCKED_WARNING
BLOCKED_FATAL
DEGRADED_ACKNOWLEDGED
```
(具体 enum 名可在实现设计中调整，但语义固定。)

- §28.1 Gate 的范围: 当有未处理 warning/fatal 时，阻止新的 Team work admission（Root new prompt / Leader new delegate/create / new Member activation / existing Member new follow-up / SETTLED Member new work / Team-sensitive mutation requiring current compatibility）。
- §28.2 不回滚 in-flight work: 若 work 在 warning 被发现前已经 admitted → `allow it to settle`. **Compatibility drift 不自动取消正在执行的 model/tool operation.**
- §28.3 Last-mile guard: 真正进入下一 Agent step 或关键 Team mutation 前仍应经公开 guard seam 进行最终检查（architecture safety property，不要求修改 AgentLoop）。

### Architecture §36.3 (cold resume re-probe) — verbatim core

Cold resume 不冻结：provider availability / model availability / tool/skill/MCP availability / External Hard Policy。因此 **resume 后必须重新评估 compatibility/effective policy**.

### Architecture §41.7 (Compatibility drift scenario) — verbatim

```text
Team running normally
↓ MCP/model/tool disappears
compatibility generation changes
↓
new Team admission BLOCKED
already admitted work may settle
↓
User repairs config or acknowledges warning if allowed
↓
new admission reopens
```

### Architecture §14.3 E (Compatibility / Acknowledgement record)

必须记录：current compatibility facts/fingerprint / warning acknowledgement / acknowledgement provenance / staleness/generation.

### DevPlan §20.7 Gate G7 items owned by P7-T1

`warning/fatal admission semantics` + `ack fingerprint invalidation` (the rest belong to T3/T4/T5/T6).

## Existing building blocks (read-only, public APIs)

| Block | Path | Key surface |
| --- | --- | --- |
| compat engine (P3-T5, pure) | `packages/domain/compatibility/src/index.js` | `evaluateCompatibility`, `isCompatibilityResultValidForEnvironment`, `parseRequirements`, `parseEnvironmentFacts`, `computeEnvironmentFingerprint`, `parseWarningAcknowledgement(s)`, `COMPATIBILITY_STATUS`, `ACK_STATUSES`, types `EnvironmentFact{domain,subject,available,generation,detail?}`, `RequirementInput{requirementId,type,subjects,complete?}`, `WarningAcknowledgement{requirementId,mismatchFingerprint,environmentFingerprint,acknowledgedBy,acknowledgedAt,note?}`, `CompatibilityResult{schemaVersion,environmentFingerprint,status,requirements[requirementId,outcome,reasonCode,unavailableSubjects,mismatchFingerprint,acknowledgement{status,acknowledgement}],counts{pass,warning,fatal,unackedWarning,acknowledgedWarning},unappliedAcknowledgements}` |
| engine ack precedence | engine.ts | per WARNING: VALID (both fingerprints match) → STALE (requirement matches, env drifted) → MISSING; FATAL never ack-able; unapplied acks reported |
| P6-T1 bridge | `packages/runtime/activation/checks.ts` | `BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE` {tool,skill,mcp→mcpServer,model→modelRoute,persona,teamStructure}; `toActivationRequirements`: requirementId `req-${domain}-${name}`, subjects `[name]`, `complete: optional !== true`; `evaluateActivationCompatibility(blueprint,facts,acks)` |
| TeamDomain (P4) | `packages/storage/repositories/index.js` | `TeamDomain.repositories.{teamSessions,memberInstances,sessionBindings,overrides,compatibility,operations,ledger}`; `compatibility.put/get/putAll?/delete` (put = put-if-absent: different state at same key → RECORD_DUPLICATE; **no upsert → update = delete+put**); record `CompatibilityStateRecord{schemaVersion:1,rootSessionId,status,fingerprint,generation,outcomes:RemoteSafeRecord,acknowledgements[],computedAt}` |
| blueprint (P3-T2) | `packages/domain/blueprint/src/types.ts` | `TeamBlueprint.requirements: CapabilityRequirement{domain,name,optional}[]` |
| P6-T2 gate (consumer pattern) | `packages/runtime/admission/gate.ts` | `enforceCompatibilityGate`: durable state authoritative (BLOCKED_* → throw COMPATIBILITY_BLOCKED) else live evaluation |

## Design

Owned module: `packages/runtime/compatibility/**` (new). Depends ONLY on: compat engine, TeamDomain (storage), contracts, blueprint types (intra-repo relative imports — the established tree pattern; zero-core C4 INFO, never enters host tree).

Files (6 module + 5 test = 11 new scanner-counted files → p4t6 330 → 341):

1. `types.ts` — closed vocab + frozen types:
   - `PROBE_TRIGGERS` (the exact five DevPlan §20.1 re-probe triggers): `ROOT_COLD_RESUME`, `MEMBER_COLD_RESUME`, `NEW_ACTIVATION`, `CAPABILITY_GENERATION_CHANGE`, `STALE_GENERATION_BEFORE_NEW_WORK`.
   - `ProbeOutcome{trigger, probedAt, generation, environmentFingerprint, status, unackedWarning, fatal, warning, pass}`.
   - `AdmittedWork{workId, workKey, admittedAt, admittedGeneration, admittedStatus}` (in-flight identity).
   - `NewWorkDecision{admitted, workId?, status, fingerprint, generation, blockedBy?: 'warning'|'fatal'}`.
   - `SettleRecord{workId, settledAt, settledAfterGeneration}`.
   - `CompatibilityDriftKind`: `NONE | ENVIRONMENT_DRIFT | STATUS_RECOVERY` (drift classification of one probe vs the previous durable state).
   - `CompatibilityProber` interface (the public port).
2. `errors.ts` — `CompatibilityError` + closed codes:
   `NEW_WORK_BLOCKED` (drift/blocked state rejects new work — the §28.1/§41.7 gate), `FATAL_NOT_ACKNOWLEDGABLE` (§27.2), `ACK_TARGET_NOT_WARNING` (ack on PASS/FATAL requirement), `WORK_UNKNOWN`, `WORK_ALREADY_SETTLED`, `UNBRIDGEABLE_REQUIREMENT` (blueprint domain outside the closed bridge vocabulary).
3. `blueprint.ts` — `compatibilityRequirementsOf(blueprint): readonly RequirementInput[]` — mirrors the P6-T1 bridge mapping verbatim (documented reuse, no fork of semantics); unbridgeable domain → `UNBRIDGEABLE_REQUIREMENT`.
4. `probe.ts` — **probe generation**:
   - `createCompatibilityProber({ repositories, rootSessionId, blueprint, environmentFacts: () => Promise<readonly EnvironmentFact[]>, now?: () => string, onProbe? })`.
   - `probe(trigger)`: fresh facts read → engine evaluation (carrying the durable acks) → new `CompatibilityStateRecord` (generation = prev+1 or 1; fingerprint = result.environmentFingerprint; outcomes = lossless-JSON `{counts, requirements:[...]}`; acknowledgements = previous durable acks, re-derived status) → **delete+put** (the repository has no upsert; crash window = state briefly absent → gate falls back to live evaluation, fail-closed) → notify `onProbe`.
   - `current()` — read the durable state.
   - `acknowledge({requirementId, acknowledgedBy, note?})`: re-evaluate fresh; find the current WARNING for that requirementId (else `ACK_TARGET_NOT_WARNING`); FATAL → `FATAL_NOT_ACKNOWLEDGABLE`; build ack bound to the CURRENT mismatchFingerprint + environmentFingerprint (§27.3, per-generation binding, provenance = acknowledgedBy/At); durably replace the state with the ack appended; return the new ProbeOutcome (status re-derived by the engine → DEGRADED_ACKNOWLEDGED when all warnings acked).
5. `drift.ts` — **drift → new work admission impact**:
   - `classifyDrift(previous, probeOutcome)` — NONE / ENVIRONMENT_DRIFT (fingerprint changed) / STATUS_RECOVERY.
   - `admitNewWork(prober, workKey)`: freshness gate — live facts → live fingerprint; durable state absent or fingerprint ≠ live → re-probe with `STALE_GENERATION_BEFORE_NEW_WORK` (covers first evaluation and "relevant capability generation change"); then the §28 gate: BLOCKED_WARNING/BLOCKED_FATAL → throw `CompatibilityError NEW_WORK_BLOCKED` (details: status, fingerprint, generation, blocking requirementIds); OPEN/DEGRADED_ACKNOWLEDGED → register in-flight work (in-memory per prober) and return the decision with a workId.
   - `settleWork(prober, workId)`: **never consults the current compatibility state** (§28.2: drift 不自动取消 in-flight); unknown → `WORK_UNKNOWN`; double settle → `WORK_ALREADY_SETTLED`.
   - `enforceNewWorkAdmission(prober)` — the throwing check-point form for the admission/compatibility gate slot (P6 admission pipeline consumption; P7-T2 owns the handoff).
   - `rootColdResume(prober)` / `memberColdResume(prober)` / `newActivation(prober)` / `capabilityGenerationChange(prober)` — the explicit trigger entry points (each = `probe(trigger)`; cold resume ALWAYS re-probes — §36.3: resume 后必须重新评估).
   - In-flight ledger boundary (documented): in-memory per prober instance (process lifetime); durable crash-window reconciliation of in-flight work is the P4 operations journal's concern — the compatibility module encodes only the §28.2 settle semantics.
6. `index.ts` — public barrel.

### Tests (mandatory list coverage)

| Mandatory item | Suite | Key assertions |
| --- | --- | --- |
| environment fingerprint change | `p7t1-probe-generation.test.ts` | relevant availability flip → fingerprint change + generation bump; irrelevant capability churn → fingerprint unchanged; relevant generation bump (availability constant) → fingerprint change (DevPlan §20.1 trigger 4); each trigger produces a new probe generation; probe provenance recorded (trigger + probedAt + fingerprint) |
| stale ACK | `p7t1-ack-fingerprint.test.ts` | WARNING → ack (bound to current mismatch+env fingerprints) → DEGRADED_ACKNOWLEDGED → new work admitted; environment drift → re-probe → engine classifies ack STALE → BLOCKED_WARNING → new work blocked; ack bound to old env fingerprint never covers new mismatch (§27.3); FATAL not ack-able (negative toThrow); ack on PASS → unapplied; malformed ack fields → MALFORMED_DTO |
| cold resume | `p7t1-cold-resume.test.ts` | restart world (new seam over same scratch dir); ROOT_COLD_RESUME re-probe after environment change during downtime → BLOCKED_WARNING, new work blocked until repair/ack; unchanged environment → OPEN preserved, generation incremented; MEMBER_COLD_RESUME same semantics; stale durable state (fingerprint ≠ live) before new work → forced STALE_GENERATION_BEFORE_NEW_WORK re-probe |
| in-flight drift | `p7t1-inflight-drift.test.ts` | admit at OPEN (gen N) → MCP disappears (§41.7) → re-probe BLOCKED_WARNING → new work toThrow NEW_WORK_BLOCKED → in-flight settleWork SUCCEEDS (no cancellation) → repair facts → re-probe OPEN → new admission reopens; ack path instead of repair → DEGRADED_ACKNOWLEDGED → reopens; in-flight settle never consults compat state (settle after BLOCKED_FATAL too) |

World: reuse `p6t1-helpers.ts` (`createP6T1World`, `restartP6T1World`, `makeEnvironmentFacts`, `P6T1_FIXTURE`, `P6T1_BLUEPRINT_SOURCE`) — real TeamDomain over scratch dir + real blueprint parse.

### Owned-boundary note

No file outside `packages/runtime/compatibility/**` is touched except the DEC-1 count maintenance in `packages/testkit/test/p4t6-session-event-scan.test.ts` (330 → 341, it-title, enumeration comment; scanner `.mjs` byte-identical).

### Zero-core surface (new imports)

`../../domain/compatibility/src/index.js`, `../../storage/repositories/index.js`, `../../storage/schema/index.js` (type-only for record types where possible), `../../contracts/src/index.js`, `../../domain/blueprint/src/index.js` (type-only). All intra-repo; no upstream imports; no node: builtins in .ts.

### Semantic notes (fixed during attempt-2 debugging)

- S5's malformed ack is rejected by the ENGINE's ack DTO contract (the domain
  `parseWarningAcknowledgement` path — `TeamContractError` / `MALFORMED_DTO`)
  during the ack-bound re-evaluation, BEFORE the durable layer ever sees the
  record; the prober never re-wraps it. The storage-level `RECORD_INVALID`
  remains the second line of defense for stored records (covered by the P4
  storage suites).
- S2 asserts the restart boundary BEFORE the restarted prober issues its own
  `work-1`: the in-memory in-flight ledger and the work-id counter are
  per-process (durable cross-process continuity is the P4 journal boundary),
  so a fresh prober re-issues the id `work-1` for a DIFFERENT work.

### Attempt-3 test hygiene (top-level `expect` records)

- The plain-node shim counts EVERY `expect(...).matcher()` call made outside an
  `it` body (top-level scenario code) as a permanent `<assertion>` test record
  for that file. The attempt-2 rerun total (1281) therefore contained 6 such
  records — 1 in cold-resume (S2), 1 in probe-generation (S6 fixture-anchor
  check), 3 in ack-fingerprint (S2/S4/S5 precondition checks), 1 in
  inflight-drift (S1) — inflating each file's runner count above its actual
  `it` count and complicating per-file failure attribution (the same masking
  class that hid the attempt-2 cold-resume import error).
- All 6 were converted to plain `if (...) throw new Error(...)` guards
  (the files' existing precondition style). Runner count now equals the
  grep-able `it(` count in every file: 19 + 16 + 14 + 12 = 61 new tests;
  final chain total 1214 (baseline) + 61 = **1275**.

### Zero-core verification (evidence: zero-core-verification.log)

- `verify-zero-core.mjs` over all 9 packages exits 1 with 442 findings, but
  **every** finding has code `private-relative-escape`: a relative import that
  crosses the package root of the importing package (e.g.
  `packages/runtime/test/*` importing `../../contracts/src/index.js`). These
  resolve inside the vNext 9-package repo — the established cross-package
  test-import pattern already used by all prior tasks (p5t1-helpers, t5-*,
  t6-9-*, root-binding, …). 5 of the 442 findings are in the new p7t1 test
  files (same pattern); 0 findings resolve into the host tree
  (`references/deepseek-harness-test-use`); 0 findings of any other code
  (no core import, no patch/lifecycle/patchedDependencies finding).
- The script exits 1 on the pre-task tree as well (437 pre-existing
  findings), so the exit code is not a regression of this task. Red lines
  (CORE PATCH BUDGET 0, no upstream source/private API) are unaffected:
  zero new imports of upstream core, zero private-API usage.
