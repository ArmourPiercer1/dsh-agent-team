# F-10 evidence — contract identity + trace actor binding (2026-11-20)

Branch `task/f10-contract-identity-20261120`, base `origin/master ef7e3af0088bf3af8fc765ce27951f9dbad92892`.
All transcripts are **verbatim**, captured with `> file 2>&1` on the recorded command; no paraphrase.
Paths below are relative to this directory.

## Re-runnable probe

```
node dev/agent-workflow/evidence/f10-contract-identity-20261120/probe-contract-identity.mjs
```

`probe-contract-identity.mjs` synthesises the counterexample (derived child, symbol reflection copy,
post-mint mutation, two-World cross-wire, shared execution id with a foreign actor) and asserts each
named refusal; it exits 0 only on the fixed module. `probe-output.txt` = final-head run (PASS, 7/7).
`mutation-prefix-probe.txt` = the same probe against the pre-fix libs (6 mismatches, `ACCEPTED`).

## Green transcripts (final head unless stated)

| file | command | result |
| --- | --- | --- |
| `f10-suite-green.txt` | `node --test --test-reporter=spec tests/world-factory/f10-contract-identity.test.mjs` | 9/9 pass, exit 0 |
| `existing-tinf-observer-closeout.txt` | `node --test --test-reporter=spec tests/world-factory/tinf-observer-closeout.test.mjs` | 27/27 pass, exit 0 |
| `existing-m7b1-host-absent.txt` | `node --test --test-reporter=spec tests/world-factory/m7b1-observation-window.test.mjs` | 9 pass, 1 declared skip (`HOST_ABSENT`), exit 0 |
| `existing-m7b1-real-host.txt` | `M7B1_HOST_TREE=<pinned tree> M7B1_REQUIRE_PINNED_HOST=1 node --test --test-reporter=spec --test-force-exit --test-timeout=1200000 tests/world-factory/m7b1-observation-window.test.mjs` | 10/10 pass, exit 0 (tree = `.worktrees/tinf-merge-shape/tests/deepseek-harness-test-use`, HEAD `639ed01539…`, porcelain 0, native asset sha `54a9c25c…`) |
| `existing-m7b1-real-host-local-assets-mismatch.txt` | same, with `M7B1_HOST_TREE=<main checkout tree>` | exit 1: `HOST_ASSETS_UNPROVEN` (locally built `75450f92…` ≠ pin `54a9c25c…`) — recorded as an environment refusal, not a code result |
| `existing-m7a-real-slice-unit.txt` | `node --test --test-reporter=spec tests/world-factory/m7a-real-slice-unit.test.mjs` | 16/16 pass, exit 0 |
| `existing-world-factory.txt` | `node --test --test-reporter=spec tests/world-factory/world-factory.test.mjs` | 44/45 pass; the red is the pre-existing RUN-record binding test (see below) |
| `baseline-world-factory-prefix-libs.txt` | same suite with the two lib files reverted to `ef7e3af00` | 44/45 pass; the SAME RUN-record red |
| `test-catalog.txt` | `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | `tests=879` (base 878, +1), `UNCOLLECTED 41`, refused 0, findings 0, exit 0 |
| `dispatch-check.txt` | `node scripts/dispatch-tests.mjs --check` | PASS legs=18 bad=0, exit 0 |
| `eb3-ci-required.txt` | `node scripts/eb3-ci-required.mjs` | pass workflows=10 findings=0, exit 0 |
| `eb3-ci-negative-controls.txt` | `node scripts/eb3-ci-negative-controls.mjs` | 33/33 controls behaved as required, exit 0 |
| `docs-sync-check.txt` | `node scripts/docs-sync.mjs --check` | exit 0 |
| `lint-identities-diff.txt` | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | new 0, resolved 0, exit 0 |
| `tsc-noemit.txt` | per-package `tsc -p packages/<pkg>/tsconfig.json --noEmit` | 6/9 exit 0; `runtime`, `client`, `legacy` exit 2 on missing dev deps of a fresh worktree (no `packages/**` file changed) |
| `git-diff-check.txt` | `git diff --check` | clean, exit 0 |

## Mutation → RED

`mutation-prefix-red.txt`: both lib files reverted to `ef7e3af00`, then
`node --test --test-reporter=spec tests/world-factory/f10-contract-identity.test.mjs`.
Result: `tests 9 / pass 1 / fail 8`, exit 1. The single pass is the POSITIVE control (a real declared
contract is still accepted pre-fix), which is exactly what makes the suite non-vacuous.

Restore: the two post-fix files were saved to `.artifacts/tmp/f10-mutation-saved/` before the
mutation, copied back afterwards, `sha256sum` compared (both match), `git add`ed, and
`f10-suite-green.txt` re-captured (9/9, exit 0).

## Not run here / UNKNOWN

- The main checkout's pinned tree has locally built native assets, so it is refused
  (`HOST_ASSETS_UNPROVEN`); the 10/10 real-host run used an already-provisioned tree in
  `.worktrees/tinf-merge-shape`. This session provisioned nothing.
- `tsc --noEmit` for `runtime`/`client`/`legacy` cannot run in this fresh worktree (missing
  `@types/node` / React / client-store packages). No `packages/**` file is in this diff.
- `lint-identities`/`tsc` were invoked from a worktree without its own `node_modules`; ESLint and
  TypeScript resolve through the repo-root install. Removing a temporary `node_modules` symlink was
  necessary to make ESLint use its working root entry point (the first captured attempt failed with
  `MODULE_NOT_FOUND` and was overwritten by the successful run above).
