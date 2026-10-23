# EB-E0/E1 — where the exit evidence comes from

Not a verdict. This records which source each exit-claim is read from, so a reader can
re-obtain it without trusting this file. Recorded at `897d5d858dddc811e064adc6d77e930ccea7771a`
(`refs/heads/task/eb-e0-e1-doc-baseline-20261029`, `ls-remote` byte-identical).

## 1. Git as a source

| fact | how it is obtained | measured here |
| --- | --- | --- |
| branch head | `git rev-parse HEAD` vs `git ls-remote origin refs/heads/<branch>` | both `897d5d858dddc811e064adc6d77e930ccea7771a` |
| not merged | `git merge-base --is-ancestor HEAD origin/master` | **exit 1** — the exit *is* the answer; exit 0 here would mean this line had been merged, which it has not |
| a bound `verification_commit` is real, and contains the log it cites | `git cat-file -e <sha>:<artifact path>` | exit 0 for `f44e0c3eaabd4ef83facaa9acfbf3a28d35e59b4:…/controls-run-12.log` |
| nothing from this line exists on master | `git cat-file -e origin/master:dev/engineering/current-state.json` | **exit 128** — `exists on disk, but not in 'origin/master'`; the whole surface is branch-only |
| base of the line | `git log --oneline 929fc4af..HEAD` | 20 commits, all on this branch |

Two of these "failures" are correct outcomes. A drill that only ever shows exit 0 is not
checking anything, so they are listed rather than tidied away.

## 2. CI as a source

Read through the API, never inferred from a local run, and never granted by me:

- `ff1f58ecd59d431c74244250afd725a2ea60c73d`: `pr-gate` **completed failure**,
  `candidate-protection` success, `census-runtime` in progress at time of reading.
  First cause, from the job log (`ci-prgate-f44e-to-ff1f58.log`, job 120674825845):
  `lint-identities verdict=fail — 4 NEW lint identities vs
  dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`, all four in
  scripts I wrote. Baseline contains no `scripts/` entries, so none was sanctioned.
- The same job reports `census` as `refused`: the pristine test host
  (`tests/deepseek-harness-test-use`) is gitignored and absent from a CI checkout, and the
  leg says so rather than grading a population it cannot see. That refusal predates this
  line and is not mine to clear.
- Lesson recorded where it can bite: every commit message on this line reported
  `node --check` on the scripts, which is a parse check. It was never a lint check, and the
  hosted gate stayed red while those lines read as clean. Reporting a command's exit is only
  honest together with what that command measures.
- `897d5d858dddc811e064adc6d77e930ccea7771a` carries the fix (dead helper, dead import,
  `{2}` in a regex, five unused fixture args, and a `--strict` flag that was parsed, passed
  and never read — see NEG-76). Its CI result is read back after the run, not asserted here.

## 3. Approval as a source

Every write on this line traces to a dated root instruction; nothing was inferred from
"the plan implies it".

| ruling | what it authorized | what it explicitly did not |
| --- | --- | --- |
| 2026-10-23 20:57 | narrow write to `dev/engineering/current-state.json`; rename of the stale code name to `DOC_OWNER_UPDATE_MISSING`; owner-doc semantics = at least one declared owner doc changed | semantic equivalence; all docs; any other path |
| 21:13 | narrow write to `docs/contracts/engineering-baseline/INDEX.md`, through the same boundary helper, with pre/post checks | the rest of that directory; areas as authority; E1 completion |
| 21:38 | registry sub-items with a real SHA and log → `implemented_in_branch` / `verified_local` / `C1`; four new features may say review-pending | whole-card E/F/E1 promotion; `merged`/`released`/C2; Alpha.5 authority entries |
| 21:42 | one bounded contracts fix (unreachable `m[4]`, depth-ignoring close, `fieldsV1` dedupe, `refs.minItems: 0`), then wire the registered field check into probe/sync | new AST, whole-repo coverage, E3, touching Alpha.5 graph or product directives |
| 21:57 | command discipline: one real command per call, redirect only, exit preserved; no reconstructing an RC from a trimmed log | — |

Two writes were performed against those permissions and each left a diff and a
read-back (`authorized-write.txt`, `catalog-write.txt`, `drill-7-sync-write.log` — the last
being a no-op that changed zero bytes, proven by an empty `git status --porcelain`).

## 4. Entry-point drill

One command per call, output redirected to a log, nothing appended, so the recorded exit is
the tool's own. At `897d5d85…` / earlier at `ff1f58ec…` as marked.

| command | exit | what that exit means |
| --- | --- | --- |
| `docs:sync --check` | 0 | 49 docs, 0 findings, 0 blocking, `contracts=20 pairs compared` |
| `docs:sync --write` | 0 | both derivatives no-op; `normative files untouched`; tree unchanged afterwards |
| `gen-current-state --check` | 0 | view fresh, `entries=12 findings=0 blocking=0` |
| `docs:probe --base origin/master` | 0 | `blocking=0 non_blocking=0 advisories=3 contracts=20 pairs compared` |
| `verify-agent-notes` | 0 | 3 notes, 0 findings |
| `contracts-field-agreement` | 0 | 20 equality pairs + 2 v1 subset checks, 1 `NOT_CHECKED`, 13 interfaces / 1 array unpaired |
| `doc-consistency-controls` | 0 | 91 controls, 0 failures (author run) |
| `docs:probe --worktree-only --strict` | 2 | `REFUSED UNKNOWN_FLAG` — intended; the flag used to be silently ignored |
| `git merge-base --is-ancestor HEAD origin/master` | 1 | not merged |
| `git cat-file -e origin/master:…current-state.json` | 128 | path not on master |

## 5. What stays unproven here

- Controls counts (`91/0`) are author runs. No re-run by root is implied.
- No C2/C3 environment was involved; nothing on this line is verified in CI or a real host.
- `unpaired interfaces=13` and `NOT_CHECKED=1` are coverage gaps, not passes; the type,
  `minItems`-of-fields, length, uniqueness and cross-field rules live in parse functions and
  cannot be derived from a declaration at all.
- No id was ratified, no CI wiring was added, no `docs/contracts/**` normative file was
  touched, and E1 remains open.

## 6. Measured against the plan's own numbers

`docs/plans/memo/engineering-baseline/execution-plan.md` (PR #361, read-only here: fetched
with `git fetch origin refs/pull/361/head`, no ref created) sets EB1-E's probe target as
"10–30 s, complex ~60 s, **to be set after measuring**". Measured at this head:

```
$ time node scripts/docs-probe.mjs --base origin/master
real  0m0.526s      (51 changed files, rules=agent-notes…contracts-shape)
```

Two thirds of a second, of which most is `git` subprocess startup. The target is therefore
not the binding constraint here, and no optimisation is being claimed: the number is
recorded because the plan asks for a measurement rather than an assertion.

The same plan's E1 exit sentence names three reading surfaces — the current-state entry, the
semantics/contracts, and the **package documentation**. The first two exist on this branch.
The third does not: `ls packages/*/README.md` returns only `packages/legacy/README.md`, so
for `packages/contracts/**` the ownership map can only point at `docs/STATUS.md`, a living
snapshot that is not authoritative and is not mine to edit. That gap is named in the report
rather than filled by writing into the product tree.
