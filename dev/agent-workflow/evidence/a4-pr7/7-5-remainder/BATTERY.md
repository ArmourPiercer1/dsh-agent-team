
---

## 6. THE BATTERY, on this lane's committed tree

Branch `feat/a4-75-remainder` was created from `origin/master = e80a00da` (verified by
`git rev-parse origin/master` after `git fetch`). Master then **moved mid-session** to
`340e30e3` (PR #162, round-22 records — coordinator-owned docs only), and this branch
was rebased onto it, so everything in this section was re-taken on the rebased tree.

Zero tracked files of the repository are modified by this lane; "the merged tree" is
`origin/master` plus added evidence files, which is what every number below was taken on.

### 6.1 `node scripts/verify-blueprint-version-clean.mjs`, twice, byte-identical, **after `git add`**

Every pair was taken **after `git add`**, and the pair is repeated on the rebased
tree (`27`), where it is still byte-identical to all of them — post-`git add` (`13`,`14`), post-commit
(`17`,`18`), post-final-stage (`23`,`24`, and a last pair `25`,`26` after the transcripts
themselves were staged). All of them are byte-identical to one another (`cmp` in each
transcript's name-pair), exit **1**:

```
scanned-in-scope: 753 tracked files
RESULT dirty(7 files, 51 sites)
RESULT unknown(0 files, 0 sites)
RESULT advisory(8 files, 10 sites)
RESULT refused(52 files, 115 sites)
RESULT prose(5 files, 5 sites)
RESULT adjudicated(16 files, 24 sites)
RESULT verdict: dirty-or-unknown (see the OFFENDING/UNKNOWN lines)
```

`cmp` of the pair: byte-identical; also byte-identical to the run taken before the
evidence files were committed. **All four gated numbers are unmoved**: `refused(52
files, 115 sites)`, `adjudicated(16 files, 24 sites)`, `unknown(0 files, 0 sites)`,
`dirty(7 files, 51 sites)`; `advisory(8, 10)` and `prose(5, 5)` likewise.
`scanned-in-scope` is **753, delta 0**: the in-scope set is `isScanScopePath` over
`git ls-files` (test/kit files, `scripts/**`, `packages/**/harness/**`), and this lane
added only `.md`/`.txt` under `dev/agent-workflow/evidence/…`, so no file entered or
left the set. `exit 1` is the tree's base state, not a regression: `verdict:
dirty-or-unknown` is §7.4's declined-and-deferred 7 remaining files.

### 6.2 The named suites

| file | expected | measured | transcript |
| --- | ---: | ---: | --- |
| `packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | 60 | **60 passed** | `22` |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 10 | **10 passed** (derived total `983 + Σ SCANNED_PATHS_*` unedited — this lane added no scanned file) | `22` |
| `packages/testkit/test/a4p7-merge-gate.test.ts` | 26 | **25 passed / 1 refused** — the refusal is base-equal, see `BASE-EQUALITY-merge-gate.md` | `15`, `16`, `22` |
| `packages/testkit/test/a4p75-composition-smoke-classification.test.ts` | 54 | **54 passed** | `22` |
| `packages/domain/test/a4p7-v3-identity-binds-grammar.test.ts` | 13 | **13 passed** | `22` |
| `packages/runtime/test/a4p7-v3-grammar-enforced.test.ts` | 8 | **8 passed** | `22` |
| the five ceiling/guard suites (`a4p2` 26, `a3p3-revoke` 33, `a3p4-r4` 17, `a4p7-carrier-width` 8, `a4p7-no-context` 12) | — | **96 passed** | `01`, `06`, `22` |

Run `29` repeats the whole table on the **rebased** tree (onto the moved
`origin/master 340e30e3`): `Test Files 1 failed | 10 passed (11)`,
`Tests 1 failed | 266 passed (267)`, every per-file count unchanged.

Aggregate of run `22`: `Test Files 1 failed | 10 passed (11)`,
`Tests 1 failed | 266 passed (267)`.

The merge-gate leg was **not** built away: at `HEAD e80a00da` with **0 tracked files
changed** the leg prints the same 604-byte diagnostic it prints in this lane
(`byte-identical: True, length base=604 lane=604`), and the diagnostic names
`packages/client/dist` as nonexistent, gitignored, and in no install surface.

### 6.3 Typecheck, both invocations, reported separately

```
pnpm -r run typecheck              -> exit 0, 0 × error TS        (transcript 19)
pnpm -r --no-bail run typecheck    -> exit 0, 0 × error TS        (transcript 20)
```

The bailing invocation is green here, but green from an incomplete sweep is what the
last round's 31-error surface looked like, so the no-bail run is counted independently:
**8 packages declare a `typecheck` script and 8 printed `typecheck: Done`** under
`--no-bail`, i.e. nothing was skipped by ordering. (No version flip was attempted, so
no `TS2367`/`TS2322` surface was expected or produced.)

### 6.4 Identity lint

```
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
lint-identities: 160 identity lines, 76 distinct (target .)
lint-identities: universe: 1107 file(s) linted, 0 of them gitignored (…)
baseline …: 76 distinct; new 0, resolved 0
```

exit **0**. `new 0 / resolved 0` — nothing to re-baseline, so the coordinator's
decision was not needed (transcript `21`).

### 6.5 Tree state

```
git status --porcelain | wc -l  -> 0
```

Files this branch changes: **33 added, 0 modified, 0 deleted, all under
`dev/agent-workflow/evidence/a4-pr7/7-5-remainder/`** — measured with the three-dot diff
(`git diff --name-status origin/master...HEAD`, merge-base) rather than two-dot, which
after the mid-session move reported that this lane had deleted 13 lines of
`SESSION_ROUTER_LOG.md` and one of `graph.yaml`. See FINDINGS §5 item 12. Not pushed. `pnpm install` was a real offline install from
`/home/user/dsh-plugins/dsh-agent-team/.pnpm-store`; no `cp -al node_modules` anywhere.
Before every vitest invocation in this lane ran
`rm -rf packages/testkit/test/.tmp-fault`.
