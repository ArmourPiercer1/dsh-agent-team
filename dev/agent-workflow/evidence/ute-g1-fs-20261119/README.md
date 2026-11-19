# ute-g1-fs-20261119 — UTE G1-S1 (FS) prototype evidence

**Dated:** 2026-11-19 (session calendar; real UTC in the captured logs).
**Branch / worktree:** `task/ute-g1-fs-20261119` · `.worktrees/ute-g1-fs-20261119`,
base `origin/master` `00429852cc9c9284fd6817da57503bac9501bc9d`.
**CORE PATCH BUDGET = 0:** neither host tree was patched; only public entries of
the pinned next host are imported.

The design side lives in `docs/plans/memo/ute-g1-fs-20261119/README.md`; the
runbook and the non-coverage list live in `tests/ute-g1-fs/README.md`.

## What was verified (each number is in the file next to it)

| file | content |
|---|---|
| `old-path-capture.txt` | the 10 vectors measured on the legacy governed path (`0.2.0-rc.2 @ 639ed01539` + product route C `mountMemberA5sfRealm`/`attachA5sfNativeToolModules`), the identity line, and `OLD-PATH-GOLDEN compare=identical` against the committed fixture |
| `new-path-run.txt` | the prototype on `0.2.2-rc.5 @ 9c2670d3…`: `PROTOTYPE-HOST …`, one `NEW-PATH-VECTOR … PASS` per vector with its effect cell, `PROTOTYPE-VERDICT GREEN vectors=10 failed=0` |
| `lane-suite.txt` | the lane suite as a collected `*.test.mjs` (3/3: corpus vs golden, semantic-difference shape, negative controls) |
| `ci-lane-step.txt` | the exact CI step argv (`node --test --test-force-exit --test-timeout=1500000 --test-reporter=spec tests/next-host/{boot,native-api,provisioning-controls}.test.mjs tests/ute-g1-fs/lane-suite.test.mjs`): 22/22 pass, real rc.5 boot on 13000 |
| `parity.txt` | `dispatch-tests --parity --old-ref e5bf05670`: `DIFFERS … old_files=25 new_files=69 problems=0` — the union grew (Task B's three rc.5 suites + this one), no argv problem |
| `negative-controls.txt` | NC-1 (deny fact + target absent), NC-2 (one mutated golden sha → RED, fixture unchanged), NC-3 (typed `NextHostMissingError`, names the pin, never the legacy tree), NC-4 (widened lane ⇒ the same call creates the file) |
| `gates.txt` | verbatim `test-catalog`, `test-catalog.test`, `dispatch-tests --check`, `eb3-ci-required`, `docs-sync --check`, `lint-identities --diff`, `git diff --check`, plus `git diff --stat origin/master` |
| `isolation.txt` | the branch touches only `tests/ute-g1-fs/**`; pin block / CI / `packages` / `scripts` untouched; census still **712 files / 12 roots**; legacy FS suite verdicts identical on pristine `origin/master` vs this branch; testkit suite's 13 failures identical on both |
| `next-lane.txt` | full `node --test 'tests/next-host/*.test.mjs'` run — 6/6, boot on port 13000, pinned native assets |
| `host-provisioning.txt` | the `HOST-ASSETS-PROVISIONED …` receipt line for the pinned 0.1.2 tarball |
| `testkit-after.log.txt` | the raw `packages/testkit` vitest output on this branch (13 failed / 499 passed, same set as baseline) |

## Reproduce

```bash
git worktree add .worktrees/ute-g1-fs-20261119 -b task/ute-g1-fs-20261119 origin/master
cd .worktrees/ute-g1-fs-20261119
# legacy host (pinned 0.2.0-rc.2) and next host (0.2.2-rc.5) per docs/TEST_METHODS.md §2/§11
node tests/ute-g1-fs/capture-old-path.mjs
node tests/ute-g1-fs/run-prototype.mjs
node tests/ute-g1-fs/negative-controls.mjs
node tests/ute-g1-fs/lane-suite.test.mjs
```

The lane suite is a collected `tests/ute-g1-fs/lane-suite.test.mjs`, appended to the
`ci-census` "next host lane" step (the job that already materializes rc.5, installs
its pinned assets and boots it). The workflow `run:` line and its mirrored
`dev/ci/eb3-ci-manifest.json` leg carry the same argv, so the catalog classifies it
`DISCOVERED_AND_COLLECTED`; a missing/drifted host makes the step red. It can also
be run on its own with `node tests/ute-g1-fs/lane-suite.test.mjs` (the next-host
tree must be provisioned, exactly as for the rc.5 lane).
