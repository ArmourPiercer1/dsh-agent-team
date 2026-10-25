# FIX-K — U6 kernel safety remediation (external audit) — evidence

Work package: **FIX-K** (single writer, branch `task/u6-fixk-kernel-safety-20261026`,
worktree `.worktrees/u6-fixk`). Base master `2db321f631cc061685c2d5c6a46e054c95b9a321`;
PR head `c2ff22dcd0742b90fbcdd004de081ed360baa5dc`. Scope: the five audit findings
K1–K5 on the U6 PR1 governance kernel + shadow row. Lane stays INERT; enforcement
OFF everywhere (`centerAssembly` default `'off'`, kernel factory default
`mode: 'shadow'`). See `PR-BODY.md` (this directory) for the PR text and
`packages/runtime/governance-center/README.md` (contract section) in the branch.

## Method

Each finding: **RED-first negative test on unmodified master → fix → GREEN**, with
the failing output captured below. New suites
(`packages/runtime/test/u6-fixk-kernel-safety.test.ts`, 17 legs;
`u6-fixk-shadow-ledger.test.ts`, 4 legs) are additive; the PR1 kernel suite was
retargeted to the moved contract (disclosed in the PR body — the "FAILED port
consume does not burn the id" leg was inverted by design under K2's fail-closed
burn semantics).

## Per-finding RED → GREEN

| finding | RED (master `2db321f63`) | fix | GREEN |
| --- | --- | --- | --- |
| K1 revoke/resurrect | `logs/RED-kernel-safety.log` legs 1–3 (`CANDIDATE_REVOKED`/`STALE_GENERATION` absent — stale entry still allowed) | entries bound to owning candidate (familyId+generation+source digest), re-validated every decide, `dropApprovalsForFamily` owner act | `logs/GREEN-kernel-safety.log` 17/17 |
| K2 consume race | same log legs 4–6 (two concurrent consumes both reach port; failed consume re-armable) | synchronous in-flight reservation (`GRANT_IN_FLIGHT`), outcome-independent burn | same GREEN log |
| K3 uncounted release | same log legs 7–8 (no-port release said clean zero; enforcing constructible without port) | `LIFECYCLE_PORT_MISSING` + `UNCOUNTED` on release; enforcing factory throws; `mode` option | same GREEN log |
| K4 name-only keying | same log legs 9–12 (scope-A approval reaches scope-B; scopeless call rides; re-claim inherits; entry without candidate accepted) | key `(scopeKey, nativeName)`, `CallFacts.scopeKey` mandatory (`SCOPE_UNVERIFIED`), `NO_CANDIDATE` write refusal | same GREEN log |
| K5 ledger growth | `logs/RED-shadow-ledger.log` (4 legs: unbounded rows/bytes, no dispose release) | bounded writer + single `shadow-ledger-capped` terminal marker + writer CLOSED on dispose | `logs/GREEN-shadow-ledger.log` 4/4 |

Regression controls kept GREEN throughout: PR1 suites 40/40 after the fix
(`logs/GREEN-u6-pr1-suites-postfix.log`), plus positive-control legs inside both
FIX-K suites (live candidate still allows; counted zero still releases; sequential
replay law; default ledger budget writes everything).

## Receipts (all under `logs/` + `c2/`)

- root vitest: 610 files, 7806 pass / 12 fail; the 12 match the tolerated
  identities in `../u1-closure-20261025/u1b/reds.json`. The one transient extra
  (`a4p7` static `check:artifacts` leg) was the run catching my own dist
  rebuild PRE-commit; post-commit it is GREEN (`logs/a4p7-static-legs-postcommit.log`,
  10/10) and `check:artifacts` verdict `ok drift=0`.
- `pnpm -r typecheck` clean; lint identities `new 0, resolved 0`
  (`logs/lint-identities.log`); `audit-a5-tool-governance-imports.mjs` OK, zero
  new lane edges; `docs:sync --check` blocking=0; `docs-probe --base origin/master`
  blocking=0; `ci-pr-gate` pass=7 fail=0 skip=1(named census) refused=0
  (`logs/ci-pr-gate.log`).
- p4t6 scan ledger: measured RED `expected 1240 to be 1238`
  (`logs/p4t6-RED-unbooked.log`) → own `SCANNED_PATHS_FIXK` booking → 10/10 GREEN.
- **C2** (`c2/`): `--suite u6-shadow` ONE run PASS 16/16; canary ledger sha
  identical off/shadow (`a3a450597c…`); 3 shadow verdict rows all
  `defer NO_APPROVAL_ENTRY`, `anyAllow=false`, `shadowErrorRows=0`; 2 Host
  starts (budget 2) on leased port 3180; `tests/homes/` emptied after teardown;
  `:3080` untouched (probe identical before/after). teamSha = PR head; Host
  `639ed01539` porcelain empty.

## Environment notes (disclosed)

- Offline pnpm: private hardlink store mirror at
  `.worktrees/u6-fixk/.artifacts/tmp/fixk-store/v11` (created for this task,
  deleted after PR creation; the shared root store was never written — its
  `index.db` was copied privately).
- C2 host runtime: per-worktree pristine clone
  (`git clone --local --no-hardlinks` from the repo-local test-use tree,
  detached @ `639ed01539`, porcelain empty, built with
  `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1` per TEST_METHODS
  §1/§2) — provisioning/build logs `logs/hosttree-*.log`.

`manifest.json` lists sha256 of every file here (regenerate after any addition).

## PR

**PR #371** — https://github.com/ArmourPiercer1/dsh-agent-team/pull/371
(head `c2ff22dcd`, base master `2db321f63`). CI checks all PASS on first
cycle (no fix rounds): `pr-gate` pass (1m58s), `candidate-protection` pass
(13s), `census-runtime` pass (17m39s). **NOT merged** (awaiting the scheduled
review composition per workflow instruction). Private store mirror deleted
after the run; C2 host runtime clone remains in the worktree (gitignored) for
review-fix readiness.
