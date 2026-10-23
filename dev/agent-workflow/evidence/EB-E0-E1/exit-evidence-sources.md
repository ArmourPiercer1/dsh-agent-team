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

## 7. The exit test the plan itself names, run once

*"一个新的 Agent 以当前状态入口、相应语义/合同和包说明能正确解释权限相关变更，不需加载海量历史"*
— tested by running exactly that: a fresh agent with no session context, allowed to read ten
entry files and forbidden `git log`, `graph.yaml`, `SESSION_ROUTER_LOG.md` and `docs/plans/**`
(the bulk history the clause says it should not need). It answered six questions with
citations and listed nine gaps. Result: it got the four axes, the writable surface, the
difference between "in branch" / "merged" / "released", and — the one that matters most for a
documentation line — that **an unimplemented proposal must not fail a check**, all from the
entry files alone. Every answer cited a real file; it invented nothing, and said "not
answerable" where the files were silent.

Closed from this line's own files (no other owner's file was touched):

| gap the reader found | where it is now answered |
| --- | --- |
| axis values listed but never defined | `dev/engineering/README.md` → "Status vocabulary": all four enums in full |
| `verified_tier` / `verification_commit` / `merged_commit` undocumented | same section, a field→required-by→refusal table naming each code |
| no tier ↔ `verification_status` mapping | same section: C1/C2/C3 as *where a claim was observed*, and why `verified_local` needs no commit |
| "current-state documents" never enumerated | same section: the exact six files plus three prefixes, and the two exempt prefixes |
| no owner/reading path for permission code | `doc-ownership.yaml`: advisory rules pointing `packages/runtime/**` and `packages/tools/**` at the M0 lifecycle contract, the effective backlog and the tool matrix (all present at this base, so `DOC_OWNER_DOC_MISSING` cannot fire) |
| the field-agreement check's silent semantic ceiling | same section: names only; the rest lives in parse functions and no check here guards it; pairing data stays in the script rather than being duplicated into a document that could drift |

Reported, not fixed, because they are not mine:

1. `docs/contracts/engineering-baseline/ids.yaml` carries `normative_status: proposed-not-ratified`
   for all 19 ids and `owners: [Contract/Security Owner]` — ratification and the role roster
   are Contract Owner acts on a normative file this line cannot write.
2. `packages/*/README.md` exists only for `packages/legacy`; the plan names package
   documentation as an entry surface, so today the owner map can only point product changes at
   `docs/STATUS.md`.
3. `.agents/notes/README.md` cites the mandate as PR #361's `architecture.md` §3.2/D7, which
   is not a file at this base — the mandate is quoted, not verifiable from within this branch.
4. A rule gap found while writing the vocabulary section: `verified_ci` paired with
   `verified_tier: C1` is self-contradictory and is **not** refused, because the tier
   comparison sits in the `verified_host`-only branch. Stated in the README as a known gap;
   tightening an existing rule is a rule change and is root's call, not a convenience.

Controls after these edits: 91/0, RC=0 (`controls-run-17.log`). The readability test is
repeatable in principle but was run once by hand, by me, through one subagent — a single
sample, in my session, is not a repeatability claim.

## 8. Two claims above that were wrong, corrected here rather than edited away

Written 22:2x at the same SHA family; the earlier text is left in place because an evidence
file that silently changes is worth less than one that admits it changed.

1. **§7 item 4 called `verified_ci` + `verified_tier: C1` a rule gap. It is not a gap and it
   was not mine to "tighten".** `verification_status` says which layer is being claimed and
   therefore what corroboration is owed; `verified_tier` says what tier the recorded artifacts
   are. They are orthogonal, so the pairing is a legal record — a CI-layer claim citing
   locally produced logs, bound to a commit. The rules refuse the actual abuses: a
   `verification_commit` that resolves to nothing, a `verified_ci`/`verified_host` claim with
   nothing bound (local passing as CI), and C1 evidence offered for `verified_host` (C1
   passing upward). Refusing the *combination* would have added a law the layering does not
   contain. `dev/engineering/README.md` now states this; no rule was changed, and the wrong
   paragraph is quoted above rather than quietly replaced.
2. **The owner-map rules I added last round were dead on arrival, and root found it, not
   me.** `selectOwningDocs` took `entries.find(...)`, and `packages/**` sits above the
   per-package rules, so `packages/runtime/**` and `packages/tools/**` could never match —
   the M0 reading pointers printed as configured and fired for nothing. Selection is by
   specificity now (fewer wildcards, then longer literal prefix, then declaration order), so
   the answer no longer depends on how the YAML happens to be ordered: a runtime change
   resolves to the M0 lifecycle contract and the effective backlog instead of the STATUS
   snapshot. Pinned by two controls: NEG-77 (specific wins whether declared before or after
   the broad rule) and NEG-78 (`enforce` belongs to the matching rule — a specific advisory
   rule does not inherit a broad self-imposed refusal, and a broad enforced rule still binds
   paths nothing more specific covers).
3. The durable authorization gap named in §7 item 3 now has a carrier:
   `dev/engineering/work-package-authorization.md` records the mandate verbatim, pins PR #361
   at `b97ffdafdceeb73d58a06fe5fb6563820d063d28`, lists the narrow grants in order, and states
   per id what its `normative_status` does and does not mean. It creates no obligation and
   ratifies nothing.

Controls after this round: **93/0, RC=0** (`controls-run-18.log`; run-1..17 untouched).
`docs:sync --check` RC=0 with the two new/edited current-state documents in scope.

## 9. The acceptance levels, read from their source, and the segments I had wrong

Section 7 item 4 and section 8 both kept a wrong model of C1/C2/C3 while correcting something
else: they treated the levels as **places** ("where a claim was observed"). They are not
places. Read from the established definition -- PR #355
`8f84a7845944964ef17e167aebfde8e2d9617570`,
`docs/plans/active/alpha5-convergence/PLAN-B-20261022.md` lines 157–159 -- C1/C2/C3 name
**verification responsibility and coverage**:

| level | what it verifies |
| --- | --- |
| **C1** | Adapter-local: one surface's interface, arguments, effects, native parity and its exact security negatives. A CI run may execute C1. |
| **C2** | Real-Host integration: the surface wired into the running assembly, permission positives/negatives and lifecycle legs, at a fixed SHA. **A branch-local real-Host run is C2** -- it proves integration, not the candidate. |
| **C3** | Final verification of a fixed candidate: one pinned HEAD, the full tool matrix, cross-tool interaction, replayable C1/C2, independent review. |

The decisive tell that my gloss was wrong: a Host run appears under **both** C2 and C3, so
"Host" cannot be what C3 means; and CI can sit at C1, so "second environment" cannot be what
C2 means.

Consequence for the pairing this file argued about in §8: `verified_ci` + `verified_tier: C1`
is legal -- CI executed an Adapter-level check -- **provided real CI actually executed that
C1 evidence**. Binding a locally produced log to a commit does not substitute. The tools
verify that an artifact exists and that the commit resolves; they cannot verify who executed
it. That is a stated limit of the check and the part a reviewer reads, not a licence, and it
gets no new gate: inventing one was the error §8 already retracted.

Exact segments corrected in this pass, quoted so the change is checkable rather than
described:

- `dev/engineering/README.md` — "C1 = this machine, static analysis or local controls; C2 = a
  hosted or second-environment run; C3 = a real-environment (Host) run." → replaced by the
  responsibility/coverage definitions above with the citation. Same file, the `verified_host`
  row read "when C1 is offered for real-environment behaviour" → now "when Adapter-local (C1)
  evidence is offered for an integration claim", and the bullet "C1 masquerading upward …
  `verified_host` asserted from C1 evidence" → "an integration or candidate claim argued from
  Adapter-local evidence".
- `dev/engineering/registry.yaml` — three comments, e.g. "C1 = this machine, controls only: no
  hosted CI run and no real-environment run is claimed or implied" → "C1 here is the
  Adapter-local level (PLAN-B 157-159): static/contract-level checks on this surface. No C2
  real-Host integration verification and no C3 candidate verification is claimed or implied."
  Status values, tiers, commits and artifacts are untouched: this is wording only.
- `dev/engineering/doc-ownership.yaml` — header said "a changed source path is matched by the
  FIRST glob that matches, in order", which described the defect §8 item 2 retracted in the
  code. It now states the implemented rule: fewest actual `*`, then longest static prefix, ties
  keep declaration order.
- `dev/engineering/work-package-authorization.md` — "Its 19 entries stay
  `proposed-not-ratified`" → **18 REQ/INV/AC** ids at `proposed-not-ratified` (10 invariant, 4
  requirement, 4 acceptance) **plus 1 Idea** at `idea-no-execution-authority`, counted in the
  file. No batch ratification.

Two segments that differ from what I had asserted, reported rather than smoothed over:

1. There is **no line 278 in any file this line owns** (`dev/engineering/README.md` is 159
   lines, `registry.yaml` 151, `work-package-authorization.md` 56,
   `tests/doc-consistency/README.md` 137). The branch-local-real-Host-is-C2 correction was
   applied at the segments listed above, found by grepping every `C3`/`real-environment`
   claim rather than by a line number.
2. `docs/contracts/engineering-baseline/ids.yaml` line 3 says "every entry below is
   `proposed-not-ratified`", which is not true of `IDEA-EB-0001` at line 143
   (`idea-no-execution-authority`). That file is normative and outside this line's write
   grant, so the discrepancy is recorded here for its owner; nothing was edited.
