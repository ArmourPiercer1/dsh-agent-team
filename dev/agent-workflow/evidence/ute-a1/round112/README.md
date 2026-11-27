# Round 112 — the B ladder closes on rc.5 (host-selectable, not host-doubled)

Scope: `.worktrees/vnext-a1-cut` only; branch `vnext/a1-cut`; PR #822 stays DRAFT. No product file changed;
no `mode` shim, no widened timeout, no retry, no skipped arm, no weakened assertion; both host pins
porcelain-empty.

## The change

`packages/runtime/test/vnext-b-probe-ladder.test.mjs` — the WORLD is rewritten to resolve the host shape
through the existing selector (`tests/next-host/host-select.mjs`) instead of hard-coding rc.2's
`ToolRuntime { mode }`. The 18 arm bodies are byte-identical in what they assert; all diff hunks are inside
`buildLadderWorld` + imports + the host-presence gate.

- rc.2: `root.plugin(ToolRuntime, {mode:'both', ptc:{}})` / `{mode:'native'}`; repo-install resolution;
  single-call `executeToolDispatch`; `run_code` from the registry transport.
- rc.5: `root.plugin(ToolRuntime)` with NO config; the exported executor PLUGIN
  (`{name, inject, apply}`) at the deployment scope (PTC presenting) + a nested member-scope
  `NativeToolExecutor`; `resolveSelectedHostModule` for every entry; batch `executeToolDispatch`;
  `run_code` via `PtcExecutor.requirePtcTransport()`; rc.5's `workingDirectory` inject supplied.
- Why a nested scope is not a shim: rc.5 allows exactly ONE executor per scope (`tools.setExecutor`,
  `packages/core/tools/lib/index.js:577-620`); guards and `tools/pre-execute` dispatch over the scope
  chain, so the member keeps the ONE centre as its decision point.

## Measurements

| run | result |
| --- | --- |
| `A5SF_REQUIRE_PINNED_HOST=1 node --test … vnext-b-probe-ladder.test.mjs` (rc.2) | **18 tests / 16 pass / 0 fail / 2 skip** (~7.0 s) |
| `TEAM_TEST_HOST=next …` same file (rc.5) | **18 tests / 16 pass / 0 fail / 2 skip** (~7.6 s) |
| `dispatch-tests --run --leg ute-vnext-a1` (rc.2) | **251 / 248 pass / 0 fail / 3 skip**, set `sha256:edd4f1c4…` |
| `dispatch-tests --run --leg ute-vnext-a1` (rc.5) | **251 / 248 pass / 0 fail / 3 skip**, same set digest |

The 2 skips are the arms' own declared non-runs on BOTH hosts: `ADM-68` (bash positive — the compiled
answer declares no execution authorization in this world) and `ADM-69` (PTC positive — NOT APPLICABLE,
product ruling; the refusal is what `ADM-76`/`ADM-79` prove).

## Gate logs in this directory

| file | gate |
| --- | --- |
| `ladder-rc2.log`, `ladder-rc5.log` | the 18 arms, one run per host |
| `dispatch-ute-vnext-a1-rc2.log`, `dispatch-ute-vnext-a1-rc5.log` | the bound leg on both hosts |
| `gate-test-catalog.log` | `test-catalog --max-uncollected 41 --max-excluded 7` |
| `gate-ute-cut-closure.log` | `ute-cut-closure --check` |
| `gate-ute-p0-assets.log` | `ute-p0-assets --check` |
| `gate-docs-sync.log` | `docs-sync --check` |
| `gate-place-dist-glue.log` | `place-dist-glue` |
| `gate-eb3-ci-required.log` | `eb3-ci-required` |
| `gate-bound-vitest.log` | `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` |
| `gate-ute-g1-argv.log` | UTE G1 nine-file argv (exact CI argv) |
| `gate-eb3-run-manifest.log` | `eb3-run-manifest` |
| `gate-ci-pr-gate*.log` | `ci-pr-gate --full --census-captures 2` (precommit + postcommit) |
| `*-postcommit.log` | every gate re-run after the round-112 commit |
| `pr-settlement-gate.log` | `pr-settlement-gate --pr 822` (left untracked: a new commit would retire the settled head it names) |
| (posted to the PR) | the dated settlement comment; its text is kept at `.artifacts/r112/settlement-comment.md` and `.artifacts/r112/pr-body-current.md` is the posted PR body (both gitignored: a comment naming the final head cannot itself be committed without moving that head) |

Docs updated in the same commit: `RC5-TEST-MATRIX.md` (§3 rows + §4.2 closed + **§9** the replacement-API
reading and the 18-row table), `CAPABILITY-MATRIX-C.md` (round-112 section; no level moves),
`MIGRATED-SUITE-STATUS.md` (round-112 section; the 15-suite layer stays 238/238), `D-ACCEPTANCE-REPORT.md`
(round-112 section; the single status table does not move), `PR-BODY-draft.md` (+ the posted body), and
this directory.
