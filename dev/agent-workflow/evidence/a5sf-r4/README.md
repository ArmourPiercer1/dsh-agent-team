# a5sf-r4 — BL-12 / R4: approval-bypass + failure-classification diagnostics

> **Dated 2026-11-02 (real UTC).** Alpha.5 Sandbox-First work package **R4 = BL-12**
> (`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md:36`,
> `current-implementation-plan.md:98`, `TRANSITION-PLAN.md` §6 "R4 … A 类原样复用").
> Branch `task/a5sf-r4-diag-20261102`, worktree `.worktrees/a5sf-r4-diag`,
> based on `origin/master` = `180088813` (PR #540, R2/BL-10).
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
| `ceiling` | `member`, `tools[] {tool, binding?, read, write, network}` | the compiled per-tool ceiling the lane decided against; `read`/`write` are the P1 `PathRuleSet` shape |
| `call` | `callId`, `member`, `tool`, `axis` (`read`/`write`), `locator`, `lane` (`allow`/`ask`/`deny`), `approvalRequestId?` | one decided call |
| `approval` | `requestId`, `decisionSequence`, `consumedAt`, `scope {rootSessionId,targetInstanceId,toolName,correlation,operationFingerprint?}` | the durable `control-allow-consumed` fact (`ControlConsumptionRecord` shape, `packages/runtime/control/types.ts:1735`); **presence is the consumption — this tool never mints one** |
| `failure` | `callId?`, `text` (a5p5 refusal line / shadow row) | handed to `diagnose()` |
| `compiler-refusal` | `callId?`, `code` | a P1 `member-io-policy` refusal code |

**Question 1 — approval bypass.** For every `call` with `lane=allow`, re-decide the SAME
locator against the ceiling carried by the log:

- disposition `deny` → `ALLOW_OUTSIDE_COMPILED_CEILING`;
- tool absent from `ceiling.tools` → `TOOL_NOT_IN_COMPILED_CEILING`;
- disposition `ask` and no durable approval row → `ALLOW_WITHOUT_DURABLE_APPROVAL`;
- disposition `ask` + a named durable row whose scope names a different member/tool/correlation
  → `APPROVAL_SCOPE_MISMATCH`;
- disposition `ask` + a durable row bound to this member/tool/correlation → `ALLOW_LEGITIMATE
  code=APPROVAL_CONSUMED_NARROWED_ALLOW` (the R1 reference model: compiled `ask` + consumed
  durable row, not widened past the compiled lane);
- disposition `allow` → nothing to report (no approval required).

Each finding carries `file:line` and the `callId` row id; the tool exits 1 if any finding,
disclosed gap or undecidable call exists.

**Question 2 — failure class.** `diagnose(text, {json:true})` is called for `failure` rows and
its `code`/`verdict`/`face` list printed as `FAILURE_CLASS …` — the existing string, unchanged.
Codes the table does not know are **not** added; they print `FAILURE_CLASS_GAP …` and exit 1.

## 3. Fixtures and what the two questions return (real output in `green-tests.log`)

| fixture | rows | report |
|---|---|---|
| `fixtures/clean.jsonl` | plain allow, **legit narrowed allow** (`ask` + `req-clean-1` consumed), deny, one `APPROVAL_DENIED` failure | `findings=0 legitimate_narrowed=1 classified=1`, exit 0, `verdict=NO_BYPASS_FOUND` |
| `fixtures/bypass.jsonl` | allow in the compiled `ask` lane with no row; plus an allow whose durable row names `tool=write` | `APPROVAL_BYPASS …:2 code=ALLOW_WITHOUT_DURABLE_APPROVAL`, `…:3 code=APPROVAL_SCOPE_MISMATCH`, `findings=2`, exit 1 |
| `fixtures/miscope.jsonl` | allow at a locator outside the ceiling; allow of a tool absent from the ceiling | `APPROVAL_BYPASS …:2 code=ALLOW_OUTSIDE_COMPILED_CEILING`, `…:3 code=TOOL_NOT_IN_COMPILED_CEILING`, exit 1 |
| `fixtures/failure.jsonl` | `APPROVAL_DENIED`, `GRANT_STALE` refusal lines | two `FAILURE_CLASS` lines with `attribution=ATTRIBUTED` and the table's class strings, exit 0 |
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
[`red-test.log`](./red-test.log). The fixture-derived expectations were not changed when the
tool landed; one fixture *locator* was corrected during GREEN (the first draft used a path
covered by the ceiling subtree, so `matchLocator` lawfully returned `allow` — the test, not the
tool, was wrong). The RED signature above is the module's absence, which is unchanged by that
edit.

### GREEN

```
node --test tests/a5sf-diag/a5sf-diag.test.mjs      # 8/8 pass, exit 0
node scripts/eb3-ci-required.mjs                    # EB3-CI-REQUIRED pass workflows=9 findings=0
node scripts/eb3-ci-negative-controls.mjs           # 24/24 control(s) behaved as required
node scripts/doc-checks.mjs                          # exit 0, no output (document checks)
node scripts/eb3-evidence-guard.mjs --new-since origin/master   # pass added=0 …
```

plus the five fixture runs (`A5SF-DIAG …` reports with the summaries in §3). The diag suite has
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
   (`rootSessionId` non-empty, `targetInstanceId`, `toolName`, `correlation`) against the call. It
   does not re-run `ControlService.guardOperation`, so a revoked/abandoned request whose consumed
   row still exists is not detected — that question needs the live Control service (P2/R3 chain),
   not a log reader.
4. **`axis=network` is undecidable** (`UNDECIDABLE code=AXIS_UNSUPPORTED`): network is a boolean
   this round and destination granularity is `UNSUPPORTED`; inventing a match would be a false
   ceiling.
5. **It does not prove `body=0`** and does not reconstruct `invocationCorrelation → Binding →
   PA/Control → Provider → settlement`; those links are PR #394's own disclosed limits
   (`scripts/diag-call-chain.mjs:249` `LIMITS`, `docs/DIAGNOSIS-CALL-CHAIN.md`).

## 7. Named gaps (disclosed, not filled)

1. **R1's adapter is not on `origin/master` at `180088813`.** `packages/runtime/member-io-policy/
   src/approval-takeover.ts` exists only on `origin/task/a5sf-r1-approval-20261102` (tip
   `56f5d2b11`), so this branch **cannot import it** without either depending on an unmerged lane
   or copying it (forbidden). The reference model was read from that branch — compiled `ask`,
   scope-bound `ControlOperationScope`, `approvalAuthority(scope)` = the durable
   `control-allow-consumed` row (`approval-takeover.ts:206/~347`) — and encoded as the
   `approvalAuthorizes()` check over the REAL `ControlConsumptionRecord` shape. If R1's final row
   shape differs, only that 8-line predicate needs review; no state is invented and no second
   approval store exists here.
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
evidence chain (BL-11/R3) before the first real run is graded by this tool.

## 8. Files

| path | why |
|---|---|
| `scripts/a5sf-diag.mjs` | NEW: one CLI, imports the PR #394 classifier + P1 `matchLocator`; reports `APPROVAL_BYPASS`/`ALLOW_LEGITIMATE`/`FAILURE_CLASS`/`FAILURE_CLASS_GAP` with `file:line` |
| `tests/a5sf-diag/a5sf-diag.test.mjs` | NEW: 8 node:test legs (clean / synthetic bypass / mis-scoped allow / class pass-through / disclosed gap / single-source / refusal / malformed-row fail-closed) |
| `tests/a5sf-diag/fixtures/*.jsonl` | NEW: five JSONL fixtures (real files, so `file:line` is exercised) |
| `.github/workflows/ci-integration.yml` | ONE host-free `node:test` step |
| `dev/ci/eb3-ci-manifest.json` | ONE `ci-integration` leg with the step's required token |
| `dev/agent-workflow/evidence/a5sf-r4/{README.md,red-test.log,green-tests.log}` | this record + real captures |
