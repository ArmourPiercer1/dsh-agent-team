# a5sf-r4 — BL-12 / R4: approval-bypass + failure-classification diagnostics

> **Dated 2026-11-02 (real UTC).** Alpha.5 Sandbox-First work package **R4 = BL-12**
> (`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md:36`,
> `current-implementation-plan.md:98`, `TRANSITION-PLAN.md` §6 "R4 … A 类原样复用").
> Branch `task/a5sf-r4-diag-20261102`, worktree `.worktrees/a5sf-r4-diag`,
> **rebased onto `origin/master` = `65bcea4ed` (PR #541, R1/BL-09 merged after PR #540 R2/BL-10)**;
> the package was first cut from `180088813` and the findings below were re-measured after the rebase.
> **CORE PATCH BUDGET = 0**: nothing under `tests/deepseek-harness-test-use/` or any upstream
> tree was read or written; no Host boot, no port, no network, no `DSH_HOME`.
>
> **What this package is not.** It is not a new diagnostics system. The failure vocabulary and
> the refusal attribution are PR #394's (`scripts/diag-call-chain.mjs`, merged as `68287d1e4`,
> inherited by R2 — `evidence/a5sf-r2/README.md` §5). This package adds ONE reader that asks two
> questions over run rows and delegates both to that module plus the P1 locator algebra.

## 1. The single sources (imported — no table, no matcher restated)

| Concern | Single source at this base | What `scripts/a5sf-diag.mjs` imports |
|---|---|---|
| Failure class / face attribution | `scripts/diag-call-chain.mjs:227` `FACE_TABLE`, `:269` `attribute()`, `:389` `diagnose()` (PR #394, EB4-B) | `attribute` and `diagnose`; every `FAILURE_CLASS` line is that module's JSON report, its class string printed verbatim |
| Locator allow/ask/deny algebra | `packages/runtime/member-io-policy/src/path-rules.ts:115` `matchLocator()` (P1-02/P1-03) | `matchLocator` — the same subtree-aware precedence the compiler/lane uses (`deny` > `ask` > `allow`) |
| **Approval-row shape (the legitimate-allow model)** | `packages/runtime/member-io-policy/src/approval-takeover.ts:206` `resolveAskClassCall()` (R1/BL-09, merged in PR #541: `:287` requires a stable `scope.correlation`, `:290` an `actionName`), and its real-world binding `packages/runtime/test/a5sf-approval-takeover.test.ts:822/847` (**`correlation: 'corr-a5sf-r1-oneshot'` vs `callId: 'call-r1-real-oneshot'`**) | **not imported** (the tool reads data rows, it does not execute the lane); `bindApproval()` encodes exactly that law — see §2 |
| Redaction of printed free text | `scripts/redaction-patterns.mjs:43` `redactAll()` (shared with sanitize-evidence) | `redactAll` for callId/tool/locator/why/reason fields |
| TS-under-plain-node loading | `scripts/run-tests-hooks.mjs` (the hook `tests/world-factory/lib/a5sf-harness.mjs` also uses) | `register()` then a deep import of `path-rules.ts`; **no new loader, no TS change** |

The tool's own source contains **no classification row and no path-matching rule**; the test
proves it (`S1`: imports present, `APPROVAL_DENIED: [`-shaped row absent). The report prefixes
every run with `SOURCE classification=… locators=…` so a copied answer cannot be quoted as this
tool's judgement.

**Seam note (disclosed, not patched).** `matchLocator` is not re-exported by the
`member-io-policy` barrel at this tree, so the script deep-imports `path-rules.ts` — the same
surface inconsistency R2 disclosed for `installToolBindingRealm`
(`evidence/a5sf-r2/README.md` §4). Under the one-writer rule the barrel is not edited from this
lane.

## 2. What the tool answers, and on what input

`node scripts/a5sf-diag.mjs <evidence-dir-or-jsonl> [--json]`

**Input contract (declared — see the gap in §5).** A flat directory of `*.jsonl` files (or one
file), rows:

| row | fields | meaning |
|---|---|---|
| `ceiling` | `member`, `tools[] {tool, binding?, read, write, network}` | the compiled per-tool ceiling the lane decided against; `read`/`write` are the P1 `PathRuleSet` shape. **A second `ceiling` row for the same member is `ROW_INVALID code=DUPLICATE_CEILING_MEMBER` and makes that member's allow calls `UNDECIDABLE AMBIGUOUS_CEILING`** (a looser duplicate must not mask a bypass) |
| `call` | `callId`, `member`, `tool`, `axis` (`read`/`write`), `locator`, `lane` (`allow`/`ask`/`deny`), `approvalRequestId?`, `logicalOperationId?`, `operationFingerprint?`, `actionName?`, `capabilityDomain?` | one decided call; `callId` is the INVOCATION id, `logicalOperationId` the logical-operation id R1's scope uses |
| `approval` | `requestId`, `decisionSequence` (integer), `consumedAt`, `scope {rootSessionId,targetInstanceId,actionName?,toolName,capabilityDomain?,correlation,operationFingerprint?}` | the durable `control-allow-consumed` fact (`ControlConsumptionRecord` shape, `packages/runtime/control/types.ts:1735`); **presence is the consumption — this tool never mints one**; a malformed row is `ROW_INVALID code=APPROVAL_ROW_INVALID`, not a consumption |
| `failure` | `callId?`, `text` (a5p5 refusal line / shadow row) | handed to `diagnose()` |
| `compiler-refusal` | `callId?`, `code` | a P1 `member-io-policy` refusal code |

**Question 1 — approval bypass.** For every `call` with `lane=allow`, re-decide the SAME
locator against the ceiling carried by the log:

- disposition `deny` → `ALLOW_OUTSIDE_COMPILED_CEILING`;
- tool absent from `ceiling.tools` → `TOOL_NOT_IN_COMPILED_CEILING`;
- disposition `ask` and no durable approval row binds the call → `ALLOW_WITHOUT_DURABLE_APPROVAL`;
- disposition `ask` + a named durable row whose `targetInstanceId`/`toolName` (or an
  `actionName`/`capabilityDomain` that BOTH sides carry) disagrees → `APPROVAL_SCOPE_MISMATCH`;
- disposition `ask` + a durable row where member/tool agree and ONE identity of operation holds —
  `scope.correlation === call.callId`, OR `call.logicalOperationId === scope.correlation`, OR both
  carry an equal `operationFingerprint` → `ALLOW_LEGITIMATE
  code=APPROVAL_CONSUMED_NARROWED_ALLOW` (the R1 model: compiled `ask` + consumed durable row,
  not widened past the compiled lane; the report names the `boundBy=` route);
- disposition `ask` + a NAMED row that agrees on member/tool but cannot be bound because the call
  carries no logical-operation id and `correlation ≠ callId` → **`UNDECIDABLE
  code=APPROVAL_SCOPE_UNBINDABLE`** (never a silent bypass, never clean);
- disposition `allow` → nothing to report (no approval required).

Each finding carries `file:line` and the `callId` row id; the tool exits 1 if any finding,
disclosed gap or undecidable call exists.

**Question 2 — failure class.** `diagnose(text, {json:true})` is called for `failure` rows and
its `code`/`verdict`/`face` list printed as `FAILURE_CLASS …` — the existing string, unchanged.
Codes the table does not know are **not** added; they print `FAILURE_CLASS_GAP …` and exit 1.

## 3. Fixtures and what the two questions return (real output in `green-tests.log`)

| fixture | rows | report |
|---|---|---|
| `fixtures/clean.jsonl` | plain allow; **two R1-shaped legit narrowed allows** (`req-clean-1` bound by `operationFingerprint` with `callId=call-r1-real-oneshot` vs `correlation=corr-a5sf-r1-oneshot`; `req-clean-2` bound by `logicalOperationId`); deny; one `APPROVAL_DENIED` failure | `findings=0 legitimate_narrowed=2 classified=1`, exit 0, `verdict=NO_BYPASS_FOUND` |
| `fixtures/bypass.jsonl` | allow in the compiled `ask` lane with no row; an allow whose durable row names `tool=write`; an allow whose row carries a different `actionName` | 3 × `APPROVAL_BYPASS` (`…:2 code=ALLOW_WITHOUT_DURABLE_APPROVAL`, `…:3 code=APPROVAL_SCOPE_MISMATCH why=scope.toolName`, `…:5 code=APPROVAL_SCOPE_MISMATCH why=scope.actionName`), `findings=3`, exit 1 |
| `fixtures/replay.jsonl` | ONE durable row (`req-once`, R1-shaped) bound to two allows: `call-r1-real-oneshot` and `call-r1-replay` (both `logicalOperationId=corr-a5sf-r1-oneshot`) | first `ALLOW_LEGITIMATE`, second `UNDECIDABLE code=DUPLICATE_CONSUMPTION`, `findings=0 undecidable=1`, exit 1 — the N1 fix |
| `fixtures/unbindable.jsonl` | a NAMED durable row (`correlation=corr-a5sf-r1-unbound`) for a call with `callId=call-r1-unbound` and no logical id/fingerprint | `UNDECIDABLE code=APPROVAL_SCOPE_UNBINDABLE`, `findings=0 undecidable=1`, exit 1 — the C1 fix |
| `fixtures/miscope.jsonl` | allow at a locator outside the ceiling; allow of a tool absent from the ceiling | `APPROVAL_BYPASS …:2 code=ALLOW_OUTSIDE_COMPILED_CEILING`, `…:3 code=TOOL_NOT_IN_COMPILED_CEILING`, exit 1 |
| `fixtures/duplicate-ceiling.jsonl` | a strict ceiling then a LOOSER duplicate for the same member, and an allow that the strict one would call a bypass | `ROW_INVALID …:3 code=DUPLICATE_CEILING_MEMBER` + `UNDECIDABLE code=AMBIGUOUS_CEILING`, `findings=0 undecidable=2`, exit 1 — the C4 fix |
| `fixtures/failure.jsonl` | `APPROVAL_DENIED`, `GRANT_STALE`, and AMBIGUOUS `TOOL_BINDING_UNVERIFIED` refusal lines | 3 × `FAILURE_CLASS` with the table's class strings; the third has `attribution=AMBIGUOUS` and the exact face list, exit 0 |
| `fixtures/gap.jsonl` | two `compiler-refusal` codes + one known failure | two `FAILURE_CLASS_GAP` (`MEMBER_GENERATION_STALE`; `IO_POLICY_UNSUPPORTED` with `overlappingAlpha5String=true`) + one pass-through class, `gaps=2`, exit 1 |

The `APPROVAL_DENIED`/`GRANT_STALE` strings are compared IN THE TEST against
`attribute('refused-admission', …)` imported from `scripts/diag-call-chain.mjs` (leg L4), so a
future table change reds this suite instead of silently drifting a copy.

## 4. RED → GREEN (real command output)

### RED (captured before `scripts/a5sf-diag.mjs` existed)

```
node --test tests/a5sf-diag/a5sf-diag.test.mjs
```

Result: **7 tests, 7 fail, 0 pass**; every arm reports
`Error: Cannot find module '…/scripts/a5sf-diag.mjs'` (`MODULE_NOT_FOUND`). Full output:
[`red-test.log`](./red-test.log). **That capture predates the S3 leg and the review-response
legs** (L1b, C4, L1c) — it is the original 7-leg file; the suite is 11 legs after the second
review round (§9/§10), and the log was deliberately not rewritten (an append-only RED record). The fixture-derived
expectations were not changed when the tool landed; one fixture *locator* was corrected during
GREEN (the first draft used a path covered by the ceiling subtree, so `matchLocator` lawfully
returned `allow` — the test, not the tool, was wrong). The RED signature above is the module's
absence, which is unchanged by those edits.

### GREEN

```
node --test tests/a5sf-diag/a5sf-diag.test.mjs      # 11/11 pass, exit 0 (after the second review round, §9/§10)
node scripts/eb3-ci-required.mjs                    # EB3-CI-REQUIRED pass workflows=9 findings=0
node scripts/eb3-ci-negative-controls.mjs           # 24/24 control(s) behaved as required
node scripts/doc-checks.mjs                          # exit 0, no output (document checks)
node scripts/eb3-evidence-guard.mjs --new-since origin/master   # pass added=4 (measured AFTER the final commit: README + red log + green log + mutation log; pre-commit it reads added=0 by design because the guard grades ADDED=committed files)
```

plus the eight fixture runs (`A5SF-DIAG …` reports with the summaries in §3). The diag suite has
**no workspace install dependency** (`path-rules.ts` imports only repo-local type modules), unlike
the R2 harness C1 suite in a fresh worktree; this is why it runs in a bare checkout. Full transcript:
[`green-tests.log`](./green-tests.log).

## 5. CI enrolment (no new workflow)

`ci-integration` lists its `node:test` files explicitly, so the suite would otherwise run in no
layer (the #394/#529 incidents). Added, exactly like the R2 harness worked after PR #540:

- `.github/workflows/ci-integration.yml:200` — ONE step `a5sf diag R4 (BL-12 …)` running
  `node --test tests/a5sf-diag/a5sf-diag.test.mjs`, after the `a5sf harness C1` step;
- `dev/ci/eb3-ci-manifest.json:203` — ONE `ci-integration` leg `a5sf diag R4` whose `check[]`
  holds that same path, so dropping the file is `CI_LAYER_LEG_WEAKENED`.

No file under `packages/**` was added, so `packages/testkit/test/p4t6-bookings/a5sf.json` was
not touched (the measured-tie duty does not apply).

## 6. Honest limits — what this tool CANNOT decide

1. **It does not observe a run; it reads rows.** No a5sf execution lane emits `ceiling`/`call`/
   `approval` rows at this base (P1 is provable but inert; the P2 suites own the real calls).
   The schema in §2 is therefore a *declared* contract, and the tool refuses (exit 2) an input
   with no answerable rows rather than printing a clean report. It cannot be pointed at a real
   a5sf run today — that wiring is P2.
2. **It trusts the log's own ceiling.** A forged `ceiling` row that omits an `ask` locator would
   make a bypass look clean. The tool detects inconsistency between the *decided lane*, the
   *compiled ceiling* and the *durable row*; it is not an independent ceiling compiler and does
   not recompile the blueprint (doing so would be a second policy computation — forbidden).
3. **Approval presence ≠ authorization.** It checks the durable row's own scope fields
   (`rootSessionId` non-empty, `targetInstanceId`, `toolName`, optional `actionName`/
   `capabilityDomain`) and one identity of operation (`correlation = callId`,
   `logicalOperationId = correlation`, or equal `operationFingerprint`) against the call. It
   does not re-run `ControlService.guardOperation`, so a revoked/abandoned request whose consumed
   row still exists is not detected — that question needs the live Control service (P2/R3 chain),
   not a log reader.
4. **A duplicate ceiling is undecidable, not resolved.** Two `ceiling` rows for one member make
   every allow call of that member `UNDECIDABLE AMBIGUOUS_CEILING` (plus `ROW_INVALID` for the
   duplicate); the tool never picks a winner, because either choice could hide a bypass. The
   producer must emit one ceiling row per member (P2).
5. **`axis=network` is undecidable** (`UNDECIDABLE code=AXIS_UNSUPPORTED`): network is a boolean
   this round and destination granularity is `UNSUPPORTED`; inventing a match would be a false
   ceiling.
6. **It does not prove `body=0`** and does not reconstruct `invocationCorrelation → Binding →
   PA/Control → Provider → settlement`; those links are PR #394's own disclosed limits
   (`scripts/diag-call-chain.mjs:249` `LIMITS`, `docs/DIAGNOSIS-CALL-CHAIN.md`).

## 7. Named gaps (disclosed, not filled)

1. **R1 is merged (resolved in the review round).** PR #541 landed
   `packages/runtime/member-io-policy/src/approval-takeover.ts` on `origin/master` at `65bcea4ed`;
   the row-shape gap this section originally recorded is closed. What remains: the tool still does
   not **import** the adapter (it reads data rows and must not execute the lane), so
   `bindApproval()` is a deliberate re-statement of R1's binding LAW — member + tool (+ optional
   actionName/capabilityDomain) plus one identity of operation, with `correlation ≠ callId` being
   NORMAL (R1's own test binds `callId: 'call-r1-real-oneshot'` to
   `correlation: 'corr-a5sf-r1-oneshot'`). The §9 C1 fixture is the real R1 shape and must stay
   `ALLOW_LEGITIMATE`; an un-bindable row is `UNDECIDABLE`, not bypass. No state is invented and
   no second approval store exists here.
2. **The PR #394 table cannot express a Sandbox-First compiler refusal.** `member-io-policy` codes
   (`MEMBER_GENERATION_STALE`, `IO_POLICY_UNSUPPORTED`, …) have no `FACE_TABLE` row, and the table's
   existing `IO_POLICY_UNSUPPORTED` row names Alpha.5 admission faces — quoting it for a compiler
   refusal would be a cross-vocabulary misattribution (R2 reached the same conclusion,
   `evidence/a5sf-r2/README.md` §5). The tool prints `FAILURE_CLASS_GAP … source=a5sf-compiler
   overlappingAlpha5String=<bool>` and exits 1. **No row was added to the PR #394 table**
   (a second vocabulary is exactly what `ASSET-RECLAMATION-REGISTRY.md` §0 rule 2 forbids).
3. **No producer, no CI fixture of a real run.** The suite drives synthetic JSONL; it proves the
   reader's laws, not that a real a5sf log will carry these rows.

**One risk for the reviewer:** the declared input row schema is the interface P2 must adopt. If
P2 emits a different shape (e.g. the ledger fact is nested under `payload` as
`ControlService` writes it), the tool will honestly report `NO_COMPILED_CEILING`/
`NO_CALL_ROWS` rather than a false clean — but the schema should be reconciled with the P2
evidence chain (BL-11/R3) before the first real run is graded by this tool. The row contract now
separates the INVOCATION id (`callId`) from the LOGICAL-OPERATION id (`logicalOperationId` /
`operationFingerprint`); P2 must emit at least one of the latter two for any narrowed allow, or
the diagnostic will (correctly) refuse to call it legitimate.

## 8. Files

| path | why |
|---|---|
| `scripts/a5sf-diag.mjs` | NEW: one CLI, imports the PR #394 classifier + P1 `matchLocator`; reports `APPROVAL_BYPASS`/`ALLOW_LEGITIMATE`/`FAILURE_CLASS`/`FAILURE_CLASS_GAP` with `file:line` |
| `tests/a5sf-diag/a5sf-diag.test.mjs` | NEW: 11 node:test legs (clean/R1-shape / unbindable / synthetic bypass / mis-scoped allow / class pass-through with pinned AMBIGUOUS faces / duplicate ceiling / duplicate consumption / disclosed gap / single-source / refusal / malformed-row fail-closed) |
| `tests/a5sf-diag/fixtures/*.jsonl` | NEW: eight JSONL fixtures (real files, so `file:line` is exercised) |
| `.github/workflows/ci-integration.yml` | ONE host-free `node:test` step |
| `dev/ci/eb3-ci-manifest.json` | ONE `ci-integration` leg with the step's required token |
| `dev/agent-workflow/evidence/a5sf-r4/{README.md,red-test.log,green-tests.log}` | this record + real captures |

## 9. Review response (dated 2026-11-02, real UTC) — APPROVE-WITH-CONDITIONS

Independent review returned APPROVE-WITH-CONDITIONS (no blocking defect; required mutations RED;
single sources confirmed; CI wiring real). This round rebased onto `origin/master` `65bcea4ed`
(PR #541 = R1/BL-09 merged) and closed C1–C4. Head before this section: see the branch tip.

### C1 — approval-row matcher reconciled with the merged R1 shape (the important one)

The pre-review matcher required `scope.correlation === call.callId`. R1's real durable scope uses a
**logical-operation** correlation: `packages/runtime/test/a5sf-approval-takeover.test.ts:822` has
`correlation: 'corr-a5sf-r1-oneshot'` while `:847` passes `callId: 'call-r1-real-oneshot'`. The old
matcher therefore flagged every real R1 narrowed allow as `APPROVAL_SCOPE_MISMATCH` — systematic
over-reporting on the first real run.

Fix (`scripts/a5sf-diag.mjs` `bindApproval()`), matching R1's law rather than weakening it:

| check | rule |
|---|---|
| member | `scope.targetInstanceId === call.member` (else `APPROVAL_SCOPE_MISMATCH`) |
| tool | `scope.toolName === call.tool` (else `APPROVAL_SCOPE_MISMATCH`) |
| actionName / capabilityDomain | validated when BOTH sides carry them (else `APPROVAL_SCOPE_MISMATCH`) |
| identity of operation | ANY of `scope.correlation === call.callId`, `call.logicalOperationId === scope.correlation`, both carry an equal `operationFingerprint` |
| cannot establish identity | a NAMED row exists, the call carries no logical id, and `correlation ≠ callId` ⇒ `UNDECIDABLE code=APPROVAL_SCOPE_UNBINDABLE` (exit 1) — never bypass, never clean |

New/updated fixtures: `clean.jsonl` now carries TWO real R1-shaped legit rows (one bound by
`operationFingerprint`, one by `logicalOperationId`) and both stay `ALLOW_LEGITIMATE` with
`boundBy=…`; `unbindable.jsonl` is the UNDECIDABLE arm; `bypass.jsonl` keeps a genuine
`toolName` mismatch AND adds an `actionName` mismatch (both stay `APPROVAL_BYPASS`).

### C2 — the two mutation survivors are dead

`failure.jsonl` now includes the AMBIGUOUS code `TOOL_BINDING_UNVERIFIED`; leg L4 pins its
`attribution` and its **exact face list**, compared against the imported
`attribute('refused-admission', 'TOOL_BINDING_UNVERIFIED')` (never a literal in the test that could
drift with the table). Slice-1 legitimate rows now also assert `boundBy=` so the binding route is
pinned.

### C3 — evidence honesty

- `README` §4 GREEN now reports the measured `eb3-evidence-guard … pass added=4` and states WHY the
  pre-commit run reads `added=0` (the guard grades committed additions).
- §4 RED states explicitly that the 7-test capture predates the S3 leg (7 vs 10 tests in that round; 11 after §10) and was
  not rewritten.

### C4 — duplicate ceiling rows fail closed

A second `ceiling` row for the same member is `ROW_INVALID code=DUPLICATE_CEILING_MEMBER`; that
member's allow calls become `UNDECIDABLE code=AMBIGUOUS_CEILING`. No last-wins, no first-wins —
either could hide a bypass. `duplicate-ceiling.jsonl` is the fixture (a LOOSER duplicate must not
turn the strict-ceiling bypass into a clean report).

### Mutation table (real runs — [`mutation-controls.log`](./mutation-controls.log))

Each mutation was applied to `scripts/a5sf-diag.mjs`, the suite was run, and the file was restored
(sha256 verified identical).

| # | mutation | expected | measured |
|---|---|---|---|
| M1 | hardcode `attribution=ATTRIBUTED` in the rendered `FAILURE_CLASS` line | L4 RED | **L4 RED**, `pass 9 fail 1`, exit 1 |
| M2 | hardcode `faces=pa-control-edge` | L4 RED | **L4 RED**, `pass 9 fail 1`, exit 1 |
| M3 | duplicate ceiling last-wins (`if (false && ceilings.has(...))`) | C4 RED | **C4 RED**, `pass 9 fail 1`, exit 1 |

### Re-run after C1–C4 (real, [`green-tests.log`](./green-tests.log))

```
$ node --test tests/a5sf-diag/a5sf-diag.test.mjs
✔ L1 clean run …                          ✔ L1b NAMED row unbindable ⇒ UNDECIDABLE
✔ L2 synthetic bypass …                   ✔ L3 mis-scoped allow …
✔ L4 classification pass-through …        ✔ C4 duplicate ceiling fail-closed
✔ L4b disclosed gap …                     ✔ S1 single source …
✔ S2 no-call-rows refusal                 ✔ S3 malformed row fail-closed
ℹ tests 10  ℹ pass 10  ℹ fail 0   exit=0
```

plus the eight fixture runs (summaries in §3), `eb3-ci-required` (`pass workflows=9 findings=0`),
`eb3-ci-negative-controls` (24/24), `doc-checks` (exit 0). No Host boot, no port, no real-effect
verification was performed; no PR was opened.

## 10. Review response 2 (dated 2026-11-02, real UTC) — N1 + N2

Second independent pass on `4f1492ac8` (PR #542): APPROVE-WITH-CONDITIONS, C1–C4 confirmed
fixed and all required mutations + both former survivors RED. Two new conditions, both closed
here.

### N1 — consumption is one-to-one (the last false-clean)

`scripts/a5sf-diag.mjs` bound every allow independently, so ONE durable row could authorize N
allows and the report said `NO_BYPASS_FOUND`. R1's shipped law is exactly-once: the durable
`control-allow-consumed` row is consumed once and a replay reaches the existing guard and is
refused.

Fix: a `consumedRequests` map local to one `analyzeRows()` invocation (no global state, one
invocation = one report). On the second allow bound to an already-used `requestId` the report
prints `UNDECIDABLE code=DUPLICATE_CONSUMPTION requestId=… why=…` (naming the call that used it
first) and exits 1; the first allow stays `ALLOW_LEGITIMATE`. Two DISTINCT rows still both pass —
`fixtures/clean.jsonl` has `req-clean-1` + `req-clean-2` and leg L1 asserts
`legitimate_narrowed=2`.

New fixture `fixtures/replay.jsonl` (the reviewer's repro): `req-once` + two calls
(`call-r1-real-oneshot`, `call-r1-replay`) with the same `logicalOperationId`. New leg L1c:
one `ALLOW_LEGITIMATE`, one `DUPLICATE_CONSUMPTION`, `findings=0 undecidable=1`, exit 1.

### N2 — stale evidence number

§9 C3 said `pass added=3`; the live guard and §4 say `added=4` (README, red log, green log,
mutation log are the four added evidence files). Corrected to `added=4`; this section adds no
new evidence file (mutation M4 appends to the existing `mutation-controls.log`).

### Mutation table — full (real runs, [`mutation-controls.log`](./mutation-controls.log))

Every mutation was applied to `scripts/a5sf-diag.mjs`, the suite run, and the file restored
(sha256 verified).

| # | mutation | expected | measured |
|---|---|---|---|
| M1 | hardcode `attribution=ATTRIBUTED` | L4 RED | **L4 RED** `pass 9 fail 1` exit 1 |
| M2 | hardcode `faces=pa-control-edge` | L4 RED | **L4 RED** `pass 9 fail 1` exit 1 |
| M3 | duplicate ceiling last-wins | C4 RED | **C4 RED** `pass 9 fail 1` exit 1 |
| M4 | N1 duplicate-consumption check disabled (`if (false && consumedRequests.has(…))`) | L1c RED | **L1c RED** `pass 10 fail 1` exit 1 |

### Re-run after N1/N2 (real, [`green-tests.log`](./green-tests.log))

```
$ node --test tests/a5sf-diag/a5sf-diag.test.mjs
✔ L1 clean …  ✔ L1b unbindable …  ✔ L1c one-row-one-allow (N1)
✔ L2 bypass … ✔ L3 miscope …      ✔ L4 class pass-through …
✔ C4 duplicate ceiling …          ✔ L4b gap …  ✔ S1  ✔ S2  ✔ S3
ℹ tests 11  ℹ pass 11  ℹ fail 0    exit=0
```

Eight fixture runs: clean `calls=4 allow=3 findings=0 legitimate_narrowed=2 classified=1 exit 0`;
unbindable `undecidable=1 exit 1`; replay `findings=0 legitimate_narrowed=1 undecidable=1
exit 1`; bypass `findings=3 exit 1`; miscope `findings=2 exit 1`; duplicate-ceiling
`undecidable=2 exit 1`; failure `classified=3 gaps=0 exit 0`; gap `gaps=2 exit 1`. Then
`eb3-ci-required` (`pass workflows=9 findings=0`), `eb3-ci-negative-controls` (24/24),
`doc-checks` exit 0, evidence guard `pass added=4`.

Honest limits are unchanged (§6); N1 adds one: a durable row authorizes at most one allow **per
report**, so a log that spans multiple independent runs with reused requestIds would be reported
UNDECIDABLE rather than clean (stateless per invocation is deliberate). No Host boot, no port, no
real-effect verification was performed; no PR action.
