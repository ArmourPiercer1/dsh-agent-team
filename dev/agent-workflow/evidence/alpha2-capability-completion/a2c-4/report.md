# A2C-4 — External Hard Last-Mile Recheck — Implementer Report

- **status**: DONE
- **branch**: `task/a2c-4-external-hard-last-mile` (worktree `.worktrees/a2c-4`)
- **base**: `99bc790` (int tip at dispatch; brief BASE_SHA `ac6b662` is an ancestor)
- **date**: 2026-09-12 (environment: Linux x86_64 / node v24.21.0 / pnpm 11.7.0 / git 2.53; no live host — unit-level with injected provider)

## Summary

Every alpha.2 managed operation now passes the LIVE external hard policy's last
check before it enters the tool body — on BOTH the static-allow path and the
ask→allow_once path — with a single shared read-only evaluator
(`ControlService.checkExternalOperation`, one `hardCellAllows` implementation,
never a second hard-policy). A tightened external cell blocks the operation
with **zero effect and zero one-shot-allow consumption**: in the ask path the
recheck sits inside `guardOperation` BEFORE the durable consumption write, so
the surviving one-shot allow can authorize the same operation exactly once
after the host relaxes.

## Commits

| short SHA | one line |
|---|---|
| `A2C-4-src` (see `git log` — filled below) | src: shared read-only `checkExternalOperation` + guardOperation/adapter last-mile recheck (zero consumption) |
| `A2C-4-ev` (see `git log` — filled below) | evidence: RED log, gate logs, zero-core scan results, this report |

(Short SHAs recorded in the final message after commit.)

## new source/test files added = 1

- `packages/runtime/test/a2c4-external-lastmile.test.ts` (NEW, 11 tests: 2 RED probes kept as
  GREEN acceptance + G2–G9 coverage). No new SOURCE files: the implementation
  extends the four existing files listed below.

### Files changed (source)

| file | change |
|---|---|
| `packages/runtime/control/types.ts` | `CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY`; `ControlExternalVerdict` type; `ControlService.checkExternalOperation` (shared read-only, fail-closed, never throws) |
| `packages/runtime/control/service.ts` | `checkExternalOperation` implementation (malformed-domain fail-closed → domain derivation mirroring resolveControl → absent-cell skip → probe in try/catch → `capabilityExists:false` → `hardCellAllows`); `guardOperation` re-probes LIVE external hard AFTER exact-scope match and BEFORE the consumption `putEntry` (block = zero consumption) |
| `packages/runtime/control/index.ts` | export `ControlExternalVerdict`; public-surface doc |
| `packages/runtime/operation-permission/pre-execute-adapter.ts` | static-allow path: live `checkExternalOperation` recheck BEFORE the authorized-execution mark; thrown check → fail-closed deny; denied recheck → deny + `external-recheck-denied` observation. Header flow doc updated. (Ask path needs no adapter hunk — the block arrives through the existing `!verdict.allowed`→deny mapping, see "Design note".) |

### Files changed (tests, beyond the new file)

| file | change |
|---|---|
| `packages/runtime/test/a6a-production-wiring.test.ts` | **forced test-double completion** (deviation D-1 below): the `SpyControlService` double now implements the extended `ControlService` surface (`checkExternalOperation` + `checks[]` recorder + `nextCheck` knob, default `{allowed:true}` = the live-bridge host's absent-cell "no host restriction" facts). No assertion was weakened; all 52 a6a tests pass unchanged. |

## expected scanner delta = 1

`packages/testkit/test/p4t6-session-event-scan.test.ts` (unmodified): pin **690** → actual **691**
(`AssertionError: expected 691 to be 690`). The +1 is exactly the new scannable
`.test.ts` file. This is the documented expected behavior (plan §2.3; baseline.md
p4t6 note): the subagent reports the delta and does NOT touch the pin; the main
Agent updates the pin at the integration tip per DEC-1 union.
Evidence: `p4t6-scan.log`.

## Gate results

| gate | command | result | evidence |
|---|---|---|---|
| RED probes (pre-fix) | `npx vitest run packages/runtime/test/a2c4-external-lastmile.test.ts` on the RED-only file | **2/2 probes FAILED** (R1 static allow executed after hard-deny; R2 tightened allow executed + consumed) — RED as required | `red-run.log` |
| GREEN (new file, vitest) | `npx vitest run packages/runtime/test/a2c4-external-lastmile.test.ts` | **11/11 pass** | `green-vitest.log` |
| node plain chain (runtime) | `node scripts/run-tests.mjs runtime` | new file **11/11 PASS**; FAIL set **byte-identical to base 99bc790** (10 pre-existing files: a6a/bp1×3/d1×3/d2/d3 module-load + d1-s6/d1-ownership/d2/d5 shim-matcher failures, ending in the pre-existing `d5-instance-contract` module-level `toHaveLength` shim crash). Baseline run captured in a temp worktree at 99bc790, diffed clean, then removed | `green-node-runner.log`, `node-runner-baseline-at-99bc790.log` |
| focused a6a (vitest) | `npx vitest run packages/runtime/test/a6a-production-wiring.test.ts` | **52/52 pass** (after test-double completion D-1) | `full-vitest.log` |
| full root suite (vitest) | `pnpm test` | **21 failed tests / 3320 passed (3341)** = baseline 20 (t1-capability-schema ×9, t2-blueprint-hash ×1, p7t6-teammates-adapter ×1, d3-member-identity-context ×1, p6t3-mediation ×5, p6t3-restart ×2, p8s3b/t12a-b2/t12a-glue file-level ×3, p6t6-actions ×1) **+ 1 expected p4t6 delta**. **Zero new deterministic failures** | `full-vitest.log` |
| typecheck (runtime) | `pnpm --filter @dsh-agent-team/runtime run typecheck` | **exit 0** (tsc covers `src` + `test` + `vitest.config.ts`) | `typecheck.log` |
| build | `pnpm build` | **exit 0** (dist local-verification only; reverted before commit — 16 `packages/runtime/dist/**` files `git checkout --`'d) | `build.log` |
| verify-zero-core (host C1–C3 + C5) | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use --plugin <dirs> --status-* --diff-*` | host tree (pristine upstream @ `a66e470204`) **byte-clean** (both snapshots 0 lines); only INFO-level third-party `node-pty` patch (upstream's own) | `zero-core-host-status.txt`, `zero-core-host-diff.txt` |
| verify-zero-core (C4, repo root) | same scanner, `--plugin .` | 49 findings, **ALL in pre-existing non-shipped artifacts** (47 `dev/agent-workflow/evidence/**` archived evidence incl. P9 legacy snapshots, 2 `tests/characterization/**` deliberate negative fixtures). **0 findings in `packages/**` source; 0 findings in any file this task changed** (verified per-file intersection) | `verify-zero-core-result.json`, `verify-zero-core-stderr.log` |
| private-import zero-hit | `git diff 99bc790 -- packages/ \| grep ^+ \| grep -E "import\|@deepseek-ai"` + new-file import scan | **NONE**: the diff adds zero import lines; the new test file imports only vNext siblings (`../../domain/…`, `../control`, `../operation-permission`, test helpers) + `vitest`; zero `@deepseek-ai/*` references anywhere in the delta | (command output recorded in final message) |
| scanner pin | see "expected scanner delta" | delta = 1, as documented | `p4t6-scan.log` |

## RED evidence pointers

- `red-run.log` — the RED run on the pre-fix source: R1 "a static allow still
  EXECUTES after the live external provider hard-denies the tools cell" and R2
  "a durable allow whose external cell tightened before the guard still
  EXECUTES and CONSUMES the one-shot" both FAILED with the expected
  `expected 'deny' to be 'allow'` / `expected false to be true` shape (2/2 red).
- The two RED probes were kept in the final test file (as `R1`/`R2` it-blocks +
  the `G1 (=R1)` acceptance alias) — they pass unchanged after the fix, which
  is the RED→GREEN proof in one file.

## Zero-consumption semantics evidence

"Prefer zero allow consumption" (plan §6.5) — a last-mile external block must
NOT burn the one-shot allow:

1. **Placement** (structural proof): in `guardOperation` (service.ts) the
   recheck runs AFTER exact-scope match and BEFORE the consumption `putEntry`;
   a block returns `{allowed:false, reason: 'external-policy', requestId,
   decisionSequence}` without any write. In the static-allow adapter path the
   recheck runs BEFORE `authorizedExecutions.add(exec)` — and that path has no
   consumption at all (zero control rows, asserted in G1/G2).
2. **Behavioral proof** (G5/G6, adapter level, real service, real durable
   ledger): ask → durable leader allow (decision-time probe passes) → host
   tightens → guard blocks: `requests=1, decisions=1, consumptions=0`,
   `decision.decision === 'allow'` (no new deny row minted — the recheck is
   read-only; the block is a verdict, not a mutation). Re-presentation under
   the tightened policy blocks AGAIN, still `consumptions=0`. Host relaxes →
   the SAME correlation reuses the SAME request → the surviving one-shot
   executes **exactly once** (`consumptions=1` appears exactly then). Third
   re-presentation → `allow-consumed` (scope/fingerprint identity + exactly-once
   preserved end to end).
3. **G7 (invariant 34, human included)**: a HUMAN allow at decision time,
   tightened afterwards → guard verdict `external-policy`, `consumptions=0`,
   durable decision stays a plain `allow` with `reason: undefined` (no Team
   decision, human included, bypasses the external hard; no new governance
   hierarchy introduced — only the external ceiling, plan §6.2 respected).
4. **G3**: a THROWING facts probe fails closed on the static path (deny, zero
   execution, zero control rows) — the check never lets a probe fault escape as
   an allow, and never throws out of `checkExternalOperation` itself (G8(h)).
5. **G8**: the shared check is strictly read-only (rows before == rows after the
   full battery), never throws (thrown probe → deny verdict), fail-closed on
   malformed domains, probes the live port on every domain-carrying call, and
   NEVER consults the port for a no-domain operation (probe delta 0).

## Deviations

- **D-1 — a6a test-double completion (forced)**: extending the public
  `ControlService` interface with the new `checkExternalOperation` method made
  the pre-existing `SpyControlService` double in
  `packages/runtime/test/a6a-production-wiring.test.ts` runtime-incomplete —
  the production adapter's static-allow recheck called the missing method and
  (correctly, fail-closed) denied two static-allow scenarios that passed at
  baseline. The minimal fix completes the double with the new method (default
  `{allowed:true}` mirroring the live-bridge host's absent-cell external facts,
  plus a `checks[]` recorder for observability). No assertion was weakened; all
  52 a6a tests pass. Alternative considered and rejected: making the method
  optional / adapter-side capability probing would open a fail-OPEN hole
  (a control service without the check would silently skip the external
  ceiling), violating the frozen goal "must pass the last check before the
  tool body".
- **D-2 — ask-path recheck location (documented at dispatch, re-stated)**: the
  parent's guidance implied a second ADAPTER hunk for the ask path; the
  implementation puts the recheck INSIDE `guardOperation` before the
  consumption write instead — the only placement that achieves "block with zero
  effect and do NOT consume the one-shot allow" (an adapter-side recheck after
  `guardOperation` returns would run too late: the allow is already consumed
  inside the guard). `service.ts` is a recommended file, so the file bounds hold;
  the adapter's ask path needs no change (its existing `!verdict.allowed`→deny
  mapping carries the `external-policy` block).
- **D-3 — verify-zero-core invocation**: the brief's argumentless
  `node scripts/verify-zero-core.mjs` form is not supported by the script
  (`--host` required). Ran the full C1–C5 form against the pristine host tree
  (`tests/deepseek-harness-test-use`, main checkout — read-only scan; the
  worktree has no gitignored upstream checkout) with host git snapshots
  captured (both 0 lines) and plugin scope = the changed source dirs + the
  whole repo. Result: 0 findings attributable to this change (see gate table).
  Note: scanning any single `packages/<x>` dir as "the plugin" flags the
  repo-internal vNext sibling-package import convention (the same
  false-positive class recorded in the G6-REVIEW evidence); the meaningful
  scope is the repo root, where all 49 findings are pre-existing
  evidence-archive / negative-fixture files.

## Open risks

1. **p4t6 pin stays red on this branch by design** (delta = 1). The main Agent
   must bump 690→691 at the integration tip (DEC-1 union) — until then the
   aggregate gate is red on `task/a2c-4-…`, which is the documented expected
   state, not a regression.
2. **Node plain-chain pre-existing crash**: `node scripts/run-tests.mjs runtime`
   aborts at `d5-instance-contract.test.ts:109` (module-level `toHaveLength`
   not in the shim) — pre-existing at 99bc790 (verified byte-identical
   baseline run), files after `d5` alphabetically never execute on that chain
   on any commit of this repo. Recorded, not fixed (outside task scope).
3. **Second `guardOperation` caller** (`packages/tools/src/guard.ts`
   `consultGuard`, P6-T6 team-tool layer) inherits the recheck automatically
   because it lives in the shared guard; `consultGuard` already fails closed on
   any non-no-request reason, so no tools/ change was needed and `tools/src`
   was deliberately left untouched (outside the file boundary). If a future
   task loosens that mapping, the external ceiling there must be re-verified.
4. **A2C-1 parallel boundary**: A2C-1 (same wave) touches the adapter's
   supported-tool classification / shell vocabulary. My adapter hunks are
   limited to the static-allow insertion point + header doc; no reordering of
   other regions. Merge-order risk: the hunks are disjoint, but the
   integration should re-run `a5a` + `a2c4` + `a6a` together after both land.

## H1/H4/H5 non-regression

- **H1 end-cap monotonicity** (G9): an externally-denied exec is NEVER marked
  (end-cap still denies it with `END_CAP_DENIAL_REASON`); an externally-allowed
  exec is marked (end-cap abstains). Hostile-prepend non-regression holds: the
  external ceiling denies before any mark, exactly like the hostile waterfall
  case.
- **H4 fresh canonicalize / H5 effect fingerprint / capability-level priority**:
  untouched code paths; G6 proves scope/fingerprint identity survives the
  tighten→relax→re-present cycle (same correlation → same request → same
  consumption); a5a (50 tests) + a4a (28 tests) + a6a (52 tests) all green.

## Evidence index (this directory)

| file | content |
|---|---|
| `red-run.log` | RED: 2/2 probes failing pre-fix |
| `green-vitest.log` | GREEN: 11/11 pass (vitest) |
| `green-node-runner.log` | node plain chain: new file 11/11 PASS; FAIL set = baseline |
| `node-runner-baseline-at-99bc790.log` | same node chain at base (temp worktree, removed after) |
| `full-vitest.log` | root suite: baseline 20 + expected p4t6 delta, zero new |
| `p4t6-scan.log` | scanner delta 690→691 |
| `typecheck.log` | tsc exit 0 |
| `build.log` | pnpm build exit 0 |
| `zero-core-host-status.txt` / `zero-core-host-diff.txt` | host tree byte-clean snapshots (0 lines each) |
| `verify-zero-core-result.json` / `verify-zero-core-stderr.log` | repo-root C1–C5 scan (49 pre-existing evidence/fixture findings, 0 in packages/**) |
| `verify-zero-core-scoped-result.json` / `verify-zero-core-scoped-stderr.log` | scoped scan on changed source dirs (23 pre-existing sibling-import convention findings, 0 from added lines) |
| `report.md` | this report |
