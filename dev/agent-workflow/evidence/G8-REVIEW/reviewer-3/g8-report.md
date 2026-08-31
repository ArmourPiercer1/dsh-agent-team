# G8-REVIEW — Reviewer 3 (N=3) 报告

- **Gate**: G8 (P8-T5 Remote contract independent review)
- **Reviewer**: 3 (qiyuan-self/qwen3.8-27b, leaf subagent, no delegation)
- **Worktree**: `.worktrees/G8-R3` @ detached `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`
- **Diff base (P7 int tip)**: `959e36358ee7244ff8c7e1e0b8396e70dfef4562`
- **P8 chain (12 commits, verified)**: c39cc90 (P8-T1 src) → 48b3334 (P8-T1 evidence) → ba007cf (P8-T2 design note) → ca02ffe (P8-T2 src) → 67c3d4e (P8-T2 evidence) → 3ae9c7e (P8-T3 src) → c957f1a (P8-T3 evidence) → b70ebf7 (P8-T4 push engine) → fe836da (P8-T4 evidence a1) → b93f5c2 (P8-T4 layout pin R57) → 2804d04 (P8-T4 evidence a2 R57) → 93d2a96 (P8-T4 evidence a2 RUN2)
- **Main worktree HEAD**: `c47b1a073b24c601f73f83c9b3dab13882cc25d6` (pristine, statusEmpty, verified before/after)
- **Evidence dir**: `dev/agent-workflow/evidence/G8-REVIEW/reviewer-3/` (in reviewer worktree)
- **E2E port**: 3183 | **DSH_HOME**: `.dsh-test-g8-r3` (fresh per run) | **Stable instance**: :3080 preflight 200 → postflight 200 (untouched)
- **Date/run**: runStamp `g8r3-1788162543615` (run 7, 2026-08-31 07:49:03 local)

## 1. Method (TaskDoc §11.9 六步门法, executed)

1. **Checkout**: dedicated worktree `.worktrees/G8-R3`, detached at gate HEAD 93d2a96; no tracked file modified by this review (all artifacts written into `dev/agent-workflow/` reviewer evidence dir only).
2. **Gate entry**: pins verified by plain file reads (worktree HEAD, main worktree HEAD + status, test-use tree `cd5ef8148158c3a752a658978873241fdf8e2bbc` diffEmpty); lock `G8-R3 <ISO ts>` acquired wx-atomic (attempts=1, marker match on release).
3. **Rerun (positive+negative)**: full chain re-run on gate HEAD + tsc×6 + dependency-scan + e2e (below). No worker self-report was relied on as evidence.
4. **Zero-core / private-import / owned-boundary**: see §6.
5. **Cross-task invariant combination review + mandated e2e**: composed the frozen P8-T1..T4 chain with the REAL P5/P6 TeamDomain + TeamRuntime over the real storageDomain seam, and ran the gate's mandated pristine browser-less remote e2e over real HTTP (§5). This combination review is where Findings F1–F3 surfaced.
6. **Criterion → evidence → PASS/FAIL**: §4.

## 2. Chain rerun & tsc (on gate HEAD 93d2a96)

- `chain-rerun.log`: plain-node vitest-equivalent runner over the full package chain — **1754 passed, 0 failed, 1754 total, 8024 ms; exit 0**.
- `tsc-x6.log`: `tsc -p packages/{contracts,domain,storage,runtime,testkit,remote}/tsconfig.json` — **all six exit 0**.

## 3. Wire protocol & client engine facts verified against source (evidence base)

- Auth: `GET /?token=<launchToken>` → 302/303 + `Set-Cookie: dsh-auth-<b64url(sha256)>=v1.<sig>.<hmac>` (HttpOnly, SameSite=Strict). Auth middleware runs BEFORE content-type check.
- RPC: `POST /team-remote/<endpoint>` body `{"type":"client-request","rpcId","method","payload"}` → `{"type":"server-response","rpcId","result":{ok:true,value}|{ok:false,error:{code,message,details}}}`. Wire rpcId must be a STRING (zod rejects numbers). Validation errors are IN-BAND (HTTP 200 + `result.error.code='bad-request'`); non-200 only for auth (401) / content-type (415).
- Client engine (`packages/remote/test/p8t4-test-client.ts`): `start()`/`sync()` return `ProjectionSyncAssessment = {status, receivedGeneration, code?}`; status vocabulary `'apply'|'duplicate'|'stale'|'foreign'|'rpc-error'|'transport-loss'|'inconsistent'`. Generation verdict rules (`push/generation.ts:67-79`): first frame→apply; different teamSessionId→foreign; incoming>applied→apply; equal→duplicate; lower→stale. Uncorrelated-response guard (lines 320-331): `response.rpcId !== rpcId` → `{status:'inconsistent'}`. The client holds only last-applied identity + applied frame + stats — no session state mirror.
- Frozen D-5 ledger slicer (`push/ledger-page.ts`): entries with `sequence > afterSequence` sliced to limit; `nextAfterSequence` = last included seq iff more remain; tracker correlation guard `request.afterSequence === anchor`; anchor advances ONLY when a page carries a cursor (terminal page leaves anchor at last applied cursor); total non-decreasing; re-reading an anchor yields the same page.
- Frozen handler shapes: `team.getProjection` (`handlers/team.ts:184-192`, `normalizeProjection` over 9 REMOTE_PROJECTION_FIELDS + safe-int generation ≥1) → `{data:{projection}, projectionGeneration}`; `member.create` (`member.ts:61-79`) → `ports.admission.performAction(request)` → `{data:{outcome}, effectSequence: admissionEffectSequence(outcome)}`; `buildRemoteSuccess` maps undefined→null (`response.ts:155-167`).
- Real runtime create-member contract: requires `delegationTemplateId` + non-empty `payload.label` (else `TEAM_RUNTIME_REQUEST_MALFORMED`); effect `member-activated {instanceId, templateId, childSessionId, operationId, replayed, ledgerSequence?, admissionCode}` (`effects.ts:374-384, 425-433`).
- Error codes verified live: `INVALID_ROOT_SESSION_ID`; quota `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES`; boundary codes `contract-version-unsupported / unknown-method / malformed-request / malformed-params / internal-error`; capabilities closed enum `['model','tools','permissions','skills','mcp']`.

## 4. G8 criteria (DevPlan §21.5) → evidence → verdict

### Criterion 1 — no SessionController Team mirror in the browser — **PASS**
The P8 remote model is pull-based: the frozen client engine (`p8t4-test-client.ts`) holds only last-applied identity (teamSessionId, generation), the applied frame, and stats — it keeps no duplicate of session/team state (source-verified; E1 exercises the full pull shape). The remote package registers host-side RPC handlers on `REMOTE_RPC_CHANNEL` only; no browser-side session controller mirror exists anywhere in the P8 chain. The projection DTO v1 (P8-T1) is the only contract later UI consumes. No mirror found.

### Criterion 2 — projection round-trip after reconnect — **PASS**
Live over real HTTP :3183 (E1, E2):
- E1: fresh client c1 `start()` → `status 'apply'`, gen 1; all 9 REMOTE_PROJECTION_FIELDS present; provenance `{origin:'team-remote', method:'team.getProjection', endpoint:'team.getProjection', contractVersion:1, projectionGeneration:1, effectSequence:null, requestToken:null}`; raw-wire cross-check (independent rpcId `'9001'`, string) byte-identical `data.projection` (`JSON.stringify` comparison).
- E2: fresh client c2 `start()` → `'apply'` gen 1; scripted transport loss on c3 → `'reconnecting'`, transportLosses 1, backoffLog[0] `{attempt:1, capMs:20, delayMs∈[10,20]}`; after clock advance → `'connected'`, framesApplied 1.
Round-trip and reconnect both work on the real transport. (Change-detection caveat under mutation is Finding F3, recorded under criterion 3.)

### Criterion 3 — stale responses ignored — **PASS (caveat F3)**
Frozen client guard verified live (E3, 19 checks):
- Post-mutation re-pull with unchanged wire stamp → `'duplicate'`, frame NOT re-applied (framesDuplicate 1) — documents the frozen equal-stamp verdict (F3: stamp is constant under mutation).
- Task-card-mandated "client stale guard fixture" (TaskDoc P8-T4 card line 1765; transport-injected synthetic frame): gen-2 synthetic → `'apply'` gen 2, framesApplied 2; then replay of the cached real gen-1 frame → **`'stale'`**, state unchanged (framesStale 1, framesApplied still 2).
- Uncorrelated rpcId → `'inconsistent'` (source guard verified; not reachable on honest transport, asserted by code inspection).
Client-side stale/duplicate/foreign guards behave exactly per frozen contract. **Caveat (F3)**: because no product write path advances `team_sessions.generation`, in the composed system the guard can only fire on replay/out-of-order of the same stamp; a same-stamp mutation surfaces as `'duplicate'` and its body is not re-applied — see Findings §7.

### Criterion 4 — ledger pagination stable — **PASS**
Live over the REAL runtime ledger (E4, 35 checks; growth via real `member.create` journal-append facts):
- `fetchPage(0,2)` → seq `[1,2]`, `nextAfterSequence:2`, `total:3`; every entry carries all REMOTE_LEDGER_ENTRY_FIELDS.
- Mid-walk mutation s2 (seq 4). `fetchPage(undefined,2)` (tracker anchor) → `[3,4]`, TERMINAL (`nextAfterSequence:null`), `total:4` (non-decreasing).
- Terminal page carries no cursor → **`c1.pageAnchor() === 2`** (frozen anchor rule in `ledger-page.ts` — verified, and initially mis-expected by the harness; see execution history).
- Stability re-read `fetchPage(2,2)` → same `[3,4]`, `total:4`. Full walk `[1,2,3,4]`; pagesApplied 3, pagesRejected 0 (correlation guard `request.afterSequence === anchor` never tripped on the honest path).
Frozen D-5 slicer + pure anchor rule invariants 1–5 hold.

### Criterion 5 — typed errors + provenance on the wire for every UI-visible action — **PASS (caveat F2)**
Every UI-visible response is in-band typed; HTTP non-200 only for auth/CT (E6: no cookie → 401 `/unauthorized/i`; cookie + text/plain → 415 `/content type must be application\/json/i`; method≠endpoint → 200 `'bad-request'`).
E5 (24 checks): 5a unknown method → `unknown-method` (details.method); 5b contractVersion 99 → `contract-version-unsupported` (details.contractVersion 1); 5c malformed id → `INVALID_ROOT_SESSION_ID` (details.field `teamSessionId`); 5d closed-enum violation (`capability:'quantum'`) → `malformed-params` (details.field + reason); 5e quota rejection from the REAL TeamRuntime (4th worker, member-template quota 3/3) → `ok:false`, code `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES`, details `{reason:'domain-error', cause:{code,message} identity, method:'member.create'}`, contractVersion 1; **invariance after rejection**: projectionGeneration 1, roster 7, ledger total 4 (no durable side effect).
Success provenance on the wire: E1 pull (origin/method/endpoint/contractVersion/projectionGeneration 1, effectSequence null, requestToken null — getProjection params carry no token, shape asserted not echo) and E3/E4 mutations (requestToken echo per token, **effectSequence 1..4** via bridge mapping, projectionGeneration null).
**Caveat (F2)**: the frozen `admissionEffectSequence` (member.ts:39-52) reads `factSequence ?? deliveredSequence`; the real P6-T2 `RuntimeActionEffect` closed union exposes `fact-recorded.sequence / work-admitted.sequence / lifecycle-changed.sequence / member-activated.ledgerSequence`. Direct composition of the frozen handler with the real runtime would therefore yield wire `provenance.effectSequence` **systematically null**; ports.ts:340-347 documents the (stale) vocabulary. The harness bridge maps the vocabulary (verified live: 1..4). Completeness of criterion 5 in the composed system depends on that mapping.

### Criterion 6 — Remote contract versioned + tested — **PASS**
`REMOTE_CONTRACT_VERSION = 1`; version check runs in-band BEFORE handler dispatch (5b proves the negative). Boundary code set closed: `contract-version-unsupported / unknown-method / malformed-request / malformed-params / internal-error`. Contract exercised by the chain suites (p8t1–p8t4, part of 1754) and live by E5/E6 negatives. Versioned and tested.

## 5. Mandated e2e (pristine host, browser-less remote, real HTTP) — **PASS 7/7, 135 checks**

**Harness design** (`harness/row.mjs` + `http-transport.mjs` + `e2e.mjs` + `run.mjs`, all in reviewer evidence dir; no tracked file touched):
- (a) REAL `TeamDomain` over the REAL `storageDomain` seam (single domain instance shared by reader AND runtime: `domain.repositories` used by both the read port and `createTeamRuntime`), fresh DSH_HOME per run — durable writes 100% real.
- (b) Deterministic `childSessionFactory` + no-op sessionDurability/surface: G8 scope is the remote seam; member sessions need not be live.
- (c) E3 stale leg = transport-level synthetic frames, exactly the frozen task card's mandated "client stale guard fixture" (TaskDoc line 1765).
- (d) E2 = fresh client over real HTTP + in-process scripted loss/backoff leg (one-shot `RealHttpTransport.Script`); real send path verifies rpcId echo, wire type, and result shape.
- (e) Ledger growth via REAL `TeamRuntime.performAction` member.create (journal append + ledger facts seq 1..4).
- (f) Ledger port filters the global store by teamSessionId + sorts seq asc (real storage has no per-team query).
- (g) Unwired ports = typed-error stubs (`G8R3_PORT_NOT_WIRED`) — typed errors by construction.
- (h) member.create is bridged through an async adapter at the admission port (Finding F1 — frozen dispatcher is synchronous).
- (i) Deterministic clocks injected everywhere (runtime `now` + projection-service `{clock: now}`) — required for byte-identical projection comparison.
- (j) Bridge-side effectSequence vocabulary mapping (Finding F2 adapter).
- (k) E3 two-leg redesign: real mutation → `'duplicate'` (documents F3 product behavior) + mandated fixture → stale-guard proof.

**Seed/state**: TEAM_ID `session-g8r3team01`; blueprint `G8R3-BP` rev "1" (quotas team 12 / member-template 3); seeded leader + worker w0 + scout s0 (3 members, stamp 1); mutations via raw-HTTP `member.create`, caller `{kind:'human', humanId:'g8r3-reviewer'}`, tokens `g8r3-tk-{w1,w2,s1,s2,q}`, each with `delegationTemplateId` + `payload.label 'g8r3 <token>'`; q rejected by quota. Terminal: 7 members (1 leader / 3 worker / 3 scout), ledger seq [1,2,3,4] total 4, stamp 1 (constant — F3).

**Execution history (e2e-run.log, 7 driver sections — all failures traced to harness-side bugs, product code never modified)**:
| # | time | outcome | root cause (harness-side) |
|---|------|---------|---------------------------|
| 1 | 07:20:06 | probe skip (NOT-RUN guard) | port/instance preflight |
| 2 | 07:20:58 | FAIL | initial wiring (boot/transport) |
| 3 | 07:25:00 | FAIL | numeric wire rpcId (zod rejects; must be string) |
| 4 | 07:34:03 | 2/7 | E3/E4 expectations (stamp model, anchor rule) |
| 5 | 07:36:38 | 2/7 | same, partial fix |
| 6 | 07:40:50 | 3/7 | E3/E5/FINAL constant-stamp expectations (F3 discovery) |
| 7 | 07:49:03 | **ALL PASS 7/7, 135 checks** | — |

Check counts (run 7): E1 27 / E2 13 / E3 19 / E4 35 / E5 24 / E6 8 / FINAL 9.
`summary.json` (run 7): `e2e.status="PASS"`, `allPass=true`, 7 scenarios `pass=true`, `failures=[]`, stable3080 200→200, pristine main + test-use trees, lock ok (attempts=1), runStamp g8r3-1788162543615. Teardown: instance stop killed:true portFree:true; :3080 AFTER 200; both trees clean; lock released with marker match.

## 6. Zero-core / private-import / owned-boundary

- **zero-core: PASS**. `dependency-scan.log`: 0 real `node:` import violations in `packages/**/*.ts`. The single scan HIT is the p7t5 **positive-control string literal** (committed sample for the detector, classified `string-literal-sample`, not an import). A2 (.mjs/.cjs record-only: harness files, not part of the package chain), C (patch/postinstall: none), D (lockfile `git diff --quiet` vs 959e36358: **same**), E (untracked non-evidence: none).
- **private-import: PASS**. Committed `extractSpecifiers` scan: hits are doc comments and denylist tokens only; no upstream private/internal imports anywhere in the chain.
- **owned-boundary: LITERAL FAIL (11 files) + interpretive PASS-note — presented dually.**
  - Literal script output: `owned-boundary result: FAIL` with exactly 11 VIOLATION lines:
    `packages/contracts/test/p8t1-projection-{fixtures,generation,negative,overlay,serialization}.ts` (5) + `packages/runtime/test/p8t2-{cold,fifty,helpers,negative,overlay,terminal}.ts` (6).
  - Interpretive: `git log --follow` confirms all 11 were added by the gate chain's own owning commits — `c39cc90` (P8-T1: projection DTO v1) and `ca02ffe` (P8-T2: projection service + 5 mandated test suites). The brief's literal owned-glob patterns cover the T1/T2 **src** paths (`packages/contracts/src/projection/**`, `packages/runtime/projection/**`) but not their `test/` directories; no non-P8 writer touched them. Interpretation: PASS-with-note (introduced by the P8 chain itself); the literal mismatch is recorded as concern (a).

## 7. Findings (cross-task combination review)

### F1 — frozen synchronous dispatcher vs asynchronous real runtime (cross-task, P8-T4 × P5/P6)
The frozen P8-T4 Remote dispatcher (`packages/remote/src/.../dispatch.ts`) is fully synchronous — it contains **no `await`** — and `ports.ts` D-2 states port methods are synchronous (the seam itself is promise-based). The real `TeamRuntime.performAction` (`packages/runtime/action-router/router.ts:73`) is genuinely async. Consequence: the frozen dispatcher **cannot be composed directly** with the real runtime at the admission port; the P8-T4 unit tests necessarily use a synchronous fake port. Harness bridge: `bridgeMemberCreate` runs the frozen request construction verbatim, then `await runtime.performAction(...)`, then `buildRemoteSuccess` (documented async adapter in `harness/row.mjs`). Severity: composability gap, no wire-correctness impact (the adapter preserves the frozen response shape).

### F2 — effectSequence vocabulary mismatch (cross-task, P8-T4 × P6-T2)
Frozen `admissionEffectSequence` (`member.ts:39-52`) reads `effect.factSequence ?? effect.deliveredSequence`. The real P6-T2 `RuntimeActionEffect` closed union carries `fact-recorded.sequence` / `work-admitted.sequence` / `lifecycle-changed.sequence` / `member-activated.ledgerSequence?` (+ optional `admissionCode`) — neither `factSequence` nor `deliveredSequence` exists. Consequence: in direct composition, wire `provenance.effectSequence` would be **systematically null** for every mutation (verified by source; the harness maps the vocabulary — live run 7 shows effectSequence 1..4). `ports.ts:340-347` documents the stale factSequence/deliveredSequence vocabulary, so the drift is between P6-T2 and the P8-T4 fakes/docs. Severity: provenance-field completeness in the composed system (feeds criterion 5); needs a one-time vocabulary alignment or a documented bridge obligation.

### F3 — no production write path advances `team_sessions.generation` (cross-task, P8 × P5/P6/P7 write side)
Exhaustive source check: the production `teamSessions` writers are creation paths only — `root-binding/write-port.ts:36` (`putTeamSession`) and `fork-reconciliation/adapter.ts:50` (`put`). The action-router effects (`effects.ts`) write only `memberInstances` + the ledger (`commitFact` → `repositories.ledger.put`/`allocateSequence`); `ActivationProvider` only READS teamSessions (`provider.ts:418`, `checks.ts:132`). Contracts pass `input.generation` verbatim (`createTeamSessionRecord`, `team-session-record.ts:147`). (The storage journal CAS `expectedGeneration` in `operations/journal.ts` is the separate operations-table mechanism, not the team-session stamp.) Consequences, all reproduced live:
1. Wire `projectionGeneration` is **constant at the seed value (1)** under any number of mutations (E3 leg i, E5 invariance, FINAL all assert stamp 1).
2. A reconnected client that missed a mutation re-pulls → equal stamp → `'duplicate'` → body **not** re-applied (frozen client keeps its stale frame indefinitely).
3. The stale guard can only fire on replay/out-of-order of the same stamp; DevPlan §21.4's "reject stale generation overwrites newer state" is vacuously satisfied vs real mutations because they produce no new stamp.
P8-T2's read port carries `source.generation` verbatim from the durable TeamDomain (`fold.ts:88`; `types.ts:75`), and P8-T1 stamps start at 1 (DevPlan §21.4) — the write side that should advance the stamp is simply not written. **No P8 task owns it** (verified against the frozen TaskDoc P8-T1..P8-T5 cards: T1 DTO, T2 read projection, T3 contract, T4 push/generation CLIENT, T5 this gate). Severity: functional in the composed system — mutation-driven change detection is absent; v1 either needs a generation-advance write path (new task) or an explicit architecture decision (e.g. client re-applies `'duplicate'` bodies / explicit invalidation+pull triggers), recorded against the frozen docs. Criterion 3 was therefore verified via the P8-T4 card's own mandated "client stale guard fixture" (transport-injected synthetic frames, TaskDoc line 1765) — exactly what E3's fixture leg executes.

## 8. Concerns

- **(a)** Owned-boundary literal glob misses the P8-T1/T2 test dirs (11 files, all owned by c39cc90/ca02ffe inside this gate's chain). Brief glob should be extended or the script's PASS criterion adjusted; both the literal FAIL and the ownership evidence are recorded here and in `boundary-checks.log`.
- **(b)** E2E required 7 driver runs / 6 harness-side bug-fix iterations (rpcId wire typing, terminal-page anchor rule, constant-stamp model). All failures were harness-side; product code was never modified by this review. Full history in `e2e-run.log`; this does not itself fail any criterion.
- **(c) Finding 1**: frozen sync dispatcher cannot compose directly with the async real runtime at the admission port (documented async adapter used in harness).
- **(d) Finding 2**: effectSequence vocabulary mismatch ⇒ wire `provenance.effectSequence` systematically null against the real runtime without the bridge-side mapping (criterion-5 completeness).
- **(e) Finding 3**: constant whole-projection stamp under mutation — composed-system change detection degraded; criterion 3 verified via the mandated fixture; unowned across the P8 chain (needs a follow-up task or explicit decision).
- **(f)** Cookie reuse across clients is normal HTTP behavior; auth middleware is global (the harness health route also requires the cookie).

## 9. Verdict

**补充内容 (supplementary content required).**

Rationale: all six G8 criteria PASS with direct live evidence on the gate's own P8 surface — the frozen P8-T1..T4 code is internally consistent, fully versioned, typed, and its own chain tests pass (1754/1754, tsc×6=0), and the mandated pristine remote e2e is green (7/7, 135 checks) on real HTTP + real TeamRuntime + real storage seam. However, the gate's mandated cross-task combination review surfaced three composability gaps (F1 sync/async seam, F2 effectSequence vocabulary, F3 missing generation-advance write path) that are real for the composed system — F3 in particular degrades mutation change-detection for reconnected clients and is unowned by any P8 task. None of the three is a P8-internal defect and none breaks frozen-contract behavior at the seam, so the gate is not 阻塞; the gaps require supplementary follow-up (a scheduled task or an explicit decision recorded against the frozen docs) before a clean 通过.

---

```
G8R3_VERDICT
verdict: 补充内容
reviewer: 3
head: 93d2a96e3ded6a92820f78ee9de94eac9ea6fffb
chain: 1754/1754 (failures 0) | tsc: contracts=0 domain=0 storage=0 runtime=0 testkit=0 remote=0
criterion-1 no-mirror: PASS — pull-based remote model; frozen client engine holds only last-applied identity + frame + stats (no SessionController Team mirror); remote package registers host-side RPC handlers only; E1 verifies full pull shape.
criterion-2 projection-roundtrip: PASS — E1 fresh client apply gen1 (9 REMOTE_PROJECTION_FIELDS, full provenance, raw-wire byte-identical); E2 fresh client apply gen1 over real HTTP + scripted loss → reconnecting → capped backoff {attempt:1,capMs:20} → connected (framesApplied 1).
criterion-3 stale-ignored: PASS (caveat F3) — frozen client guard verified live in E3: equal-stamp re-pull → duplicate (not re-applied); task-card-mandated fixture: synthetic gen-2 → apply, replayed gen-1 → stale with state unchanged; uncorrelated rpcId → inconsistent. Caveat: wire stamp is constant under mutation (F3), so the guard fires only on replay/reorder; same-stamp mutation bodies are not re-applied.
criterion-4 ledger-pagination: PASS — E4 over real runtime ledger: page1 [1,2] cursor 2 total 3 (all REMOTE_LEDGER_ENTRY_FIELDS); mid-walk mutation; page2 [3,4] terminal (nextAfterSequence null) total 4 non-decreasing; anchor stays 2 (frozen rule: terminal page carries no cursor); re-read anchor 2 → same [3,4]; invariants 1-5 hold (pagesRejected 0).
criterion-5 typed-error-provenance: PASS (caveat F2) — in-band typed errors for every negative (unknown-method / contract-version-unsupported / INVALID_ROOT_SESSION_ID field teamSessionId / malformed-params closed-enum / real-runtime quota TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES with domain-error cause identity + invariance); provenance on all success (origin/method/endpoint/contractVersion, requestToken echo on mutations, effectSequence 1..4 via bridge mapping, projectionGeneration pull-only). Caveat: frozen admissionEffectSequence vocabulary never matches real RuntimeActionEffect ⇒ direct composition yields effectSequence systematically null without the bridge mapping.
criterion-6 remote-contract-versioned: PASS — REMOTE_CONTRACT_VERSION=1 enforced in-band before dispatch (version 99 → contract-version-unsupported, details.contractVersion 1); closed boundary code set (contract-version-unsupported/unknown-method/malformed-request/malformed-params/internal-error); tested by chain suites (p8t1-p8t4 in 1754) + live E5/E6 negatives (401 auth / 415 CT / bad-request method-mismatch).
e2e: PASS — 7/7 scenarios, 135 checks (E1 27 / E2 13 / E3 19 / E4 35 / E5 24 / E6 8 / FINAL 9), real HTTP :3183, real TeamRuntime + real TeamDomain over real storageDomain seam, fresh DSH_HOME; 7 driver runs (6 harness-side bug-fix iterations, product untouched, history in e2e-run.log); summary.json allPass=true failures=[]; :3080 pre/post 200→200; both trees pristine; lock acquired+released marker-match.
e2e-port: 3183
zero-core: PASS — 0 real node: import violations in packages/**/*.ts; sole HIT is p7t5 positive-control string literal (classified sample); lockfile unchanged vs P7 tip 959e36358; no patch/postinstall.
private-import: PASS — hits are doc comments / denylist tokens only; no upstream private or internal imports in the chain.
owned-boundary: LITERAL FAIL + interpretive PASS-note — literal script FAIL with exactly 11 files (5 × packages/contracts/test/p8t1-projection-*.ts, 6 × packages/runtime/test/p8t2-*.ts); git log --follow: all added by gate-chain owning commits c39cc90 (P8-T1) and ca02ffe (P8-T2); brief's literal owned globs cover T1/T2 src paths but not their test/ dirs; no non-P8 writer; recorded as concern (a).
concerns: (a) owned-boundary glob misses P8-T1/T2 test dirs (11 files, P8-owned); (b) 7 e2e driver runs / 6 harness-side fixes (rpcId wire typing, terminal-page anchor rule, constant-stamp model) — harness-side only; (c) F1 frozen sync dispatcher cannot compose directly with async real TeamRuntime at admission port (harness async adapter); (d) F2 effectSequence vocabulary mismatch ⇒ provenance.effectSequence systematically null in direct composition (criterion-5 completeness); (e) F3 no product write path advances team_sessions.generation ⇒ constant wire stamp under mutation, reconnected clients keep stale frames on same-stamp re-pull, stale guard vacuous vs real mutations, unowned by any P8 task (needs follow-up task or explicit decision); (f) cookie reuse across clients normal; auth middleware global.
blocker: none — no P8-internal defect; F1/F2/F3 are cross-task composition gaps to be scheduled by the router (new task or explicit decision recorded against frozen docs), none breaks frozen-contract behavior at the seam.
```
