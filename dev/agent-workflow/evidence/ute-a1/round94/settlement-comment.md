**[dated label settlement, 2026-11-24 — R3 ApprovedAskReceipt PoC (`write`) + G11 lane-algebra fix, head `87d62f4a361fa78aa5ec870f90b44c854a5509be`]**

Round 94 on `vnext/a1-cut`, branch head **87d62f4a3**. Sole writer worktree
`.worktrees/vnext-a1-cut`; no other worktree, no history rewrite, no merge, no port-3080 contact,
PR #822 stays **DRAFT and unmerged**.

## Ruling compliance (review 20261124-0151 §2)

- **R2 — REJECTED and NOT built.** No `guarded` coupling, no second approval-consumption path, no
  second authority. The one-shot Grant remains the only consumption.
- **R3 — APPROVED direction, delivered with the required small ADR + executable PoC FIRST.**
- **R4 — still the fail-closed interim for everything outside the PoC scope.** Every `ask` for a
  method/tool other than native `write` still refuses `IO_ASK_REQUIRES_APPROVAL`; the production
  mount passes no Provider authority today, so even `write` asks fail closed in a real turn.

## The ADR

`dev/agent-workflow/evidence/ute-a1/ADR-approved-ask-receipt.md` — one new immutable record, its
binding fields, lifetime, mint/read points, scoping, why the model cannot forge it, why it cannot
leak across Members/calls/async tasks, rejected alternatives (`guarded` coupling, global callId
map, attribution-ALS reuse, fact-read, lane widening), failure modes, and the explicit limits.

## Receipt binding fields

`receiptId`, `executionId` (the settlement `ExecutionId`), `callId`, `member {teamId,
memberInstanceId, templateId, instanceGeneration}`, `toolName`, `toolBindingIdentity` (compiled
ToolDefinition identity), `operation {toolName:'write', locator, canonicalPath, contentSha256,
fingerprint}`, `policyGeneration`, `approval {requestId, decisionId, caseId|null, legOrdinal|null}`,
`grant {consumed:true, memberEpoch, binderEpoch}`, `bounds {read, write}` (frozen lane snapshot).

## Mint / read points

- **Mint** — `packages/runtime/src/plugin/vnext/admission-port.mjs:941`, in `spend()` **after**
  `grants.binder.consume` returned ok; registered against the HOST EXECUTION OBJECT (a
  module-private `WeakMap`), never a `callId` string, at `:964`.
- **Prepare** — the centre canonicalizes the approved effect before the wait
  (`admission-port.mjs:~900`, `prepareApprovedWriteOperation`), so minting stays synchronous with
  consumption.
- **Deliver** — the centre's own `tools/execute` listener takes the receipt by object identity and
  runs the body inside a NEW execution-scoped `AsyncLocalStorage` (`admission-port.mjs:1023`);
  closed in `finally`.
- **Read / verify** — only the confined Provider's ask branch,
  `packages/runtime/team-services/src/fs.ts:232` (`authorizeAskWithReceipt`), for `writeText` with
  content. Typed refusal `IO_ASK_RECEIPT_REFUSED` (`team-services/src/types.ts:61`).
- **Core module** — `packages/runtime/member-io-policy/src/approved-ask-receipt.ts` (mint `:309`,
  register `:377`, verify `:441`).

## PoC — `ADM-154`…`ADM-161`, all PASS

Over the REAL confined `fs` Provider (`createMemberFsGuard` + `createConfinedFileSystemClass` over
the host's own `LocalFileSystem`), the REAL invocation binder, the REAL durable `ControlService`,
the REAL admission port and the REAL settlement store. Only the host loop is a double supplying the
pinned `pre-execute → guard → execute → result` order (same precedent as ADM-19/20; disclosed).

| arm | result |
| --- | --- |
| ADM-154 positive: `ask` → inline allow → grant consumed → receipt → REAL file written; scope is the body's own; settlement `COMPLETED` | **PASS** |
| ADM-155 cross-call/reuse: second effect in the same body `RECEIPT_REUSED`; replayed callId `ADMISSION_REPLAY` before the body | **PASS** |
| ADM-156 cross-path: receipt for A cannot authorize in-lane path B (`RECEIPT_OPERATION_MISMATCH`) | **PASS** |
| ADM-157 revoked after grant spend, before Provider call (`RECEIPT_REVOKED`, zero bytes) | **PASS** |
| ADM-158 replay of a completed execution: scope gone; captured receipt cannot reopen (`RECEIPT_CLOSED`) | **PASS** |
| ADM-159 `deny` wins over a live unused receipt (refused before any receipt consult) | **PASS** |
| ADM-160 phase honesty: post-body Provider refusal settles `FAILED` / `quiesced` / `failed`, never `REFUSED` / `not-started` | **PASS** |
| ADM-161 cross-Member: another Member's Provider in the same async body cannot read A's receipt | **PASS** |

`ute-vnext-a1`: **tests 228 / pass 225 / fail 0 / skipped 3** (was 220/217/3; no new skip).

## G11 verdict — DEFECT, fixed

`intersectPathRuleSets` required ask coverage by the **intersection of the allow sets**, collapsing
a legal pure-ask lane (`{allow:[], ask:[p]}`, permitted by `validateLane`) against any tool
restriction. The correct law is: an `ask` survives iff neither side answers `deny` for that locator,
and it stays `ask` — never promoted to `allow`. `approvedOnce:false` was a misattribution (the
compiler never reads it). Fix in `member-io-policy/src/path-rules.ts`, pinned by two new arms in
`a5sf-member-policy.test.ts` (19/19). No lane widened; deny still wins. **The live boot was NOT
re-run**, so `d4:routed-wake` remains REFUTED and C-alpha6 remains MECHANISM.

## Gates at `87d62f4a3`

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  tests 228 / pass 225 / fail 0 / skipped 3
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (collected 733 / excluded 14 / uncollected 38; bounds --max-uncollected 41 --max-excluded 7)
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (35 placement(s))   — every line byte-identical
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=61 passed=218 failed=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
node --test (UTE G1 nine-file argv): tests 89 / pass 89 / fail 0 / skipped 0, exit 0
ci-pr-gate --full --census-captures 2:
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=272.7
  census: captured 599f/7418l twice, identical identity sets; identity set IDENTICAL to the published baseline
  artifacts-at-head: HEAD carries its own build, 1950 files, drift 0
```

Logs: `dev/agent-workflow/evidence/ute-a1/round94/` (`final-gates.log`,
`bound-vitest-ci-security.log`, `bound-vitest-ci-integration.log`, `ute-g1-argv.log`,
`ci-pr-gate.log`). p4t6 booking: `round94approvedaskreceipt.json`, **1319 → 1320** (one new
scannable production module, measured by the scanner).

## What this does NOT prove

1. **No live boot.** `d4:routed-wake` stays REFUTED; C-alpha6 stays MECHANISM. G11 is fixed, the
   boot is not re-run.
2. **No production wiring.** The real mount still calls `createMemberFsGuard(policy)` with no
   authority argument, so in a product turn every `ask` still fails closed at
   `IO_ASK_REQUIRES_APPROVAL`.
3. **Only `write`/`writeText`.** `editText`/`patchText`/`deleteFile`/`moveFile`, subprocess,
   terminals, search and every other tool remain R4.
4. **`caseId:null`.** The receipt binds the durable inline request/decision identity it actually
   has; an inline admission request is not an Alpha.6 case.
5. **Host loop is a double** in the PoC (pinned dispatch order), not the booted agent loop.

BL-30/G2 is therefore **narrowed, not closed**: proven for one operation at mechanism level, with
production wiring and live evidence still outstanding.
