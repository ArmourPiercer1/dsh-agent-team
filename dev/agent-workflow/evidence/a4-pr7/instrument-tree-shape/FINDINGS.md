# A4-PR7 — what a missing artifact means: the instrument's tree-shape problem (task #2, B1 lane)

Scope: `packages/testkit/test/a4p75-composition-smoke-classification.test.ts` reported a leg
failing in a clean worktree because the closure-gated client leg printed no `PASS`. The
composition is fine; **the artifact was never built**. This round answers, in code, what
distinguishes "this checkout was never built" from "the build regressed and produced nothing",
fixes both affected spec files on one branch, and adds the two things the coordinator's own
checkout exposed: what a gitignored scratch file does to the lint leg, and what eslint's exit 2
actually was.

Head facts: branch `fix/a4-instrument-tree-shape`, base `origin/master` `69f7fdad`. Evidence
files in this directory; transcripts are verbatim, command lines and exit codes included.

---

## 1. The red, before anything was changed

| file | state | result |
| --- | --- | --- |
| `a4p75-composition-smoke-classification.test.ts` | clean worktree, no build output | `1 failed / 52 passed (53)` — `AssertionError: expected [ Array(1) ] to deeply equal []`, message `the closure-gated leg did not print PASS by name (client plugin (packages/client))` (`red-2-classifier-unbuilt-tree.txt`) |
| `a4p7-merge-gate.test.ts` | same tree | `3 failed / 17 passed (20)` (`red-3-gate-unbuilt-tree.txt`) |
| `scripts/composition-smoke.mjs` | same tree | `exit=1`, one `FAIL client plugin (packages/client): built entry is missing — run \`pnpm build\` first (a missing artifact is a failure, never a skip)`, footer `FAIL composition-smoke` (`red-1-instrument.txt`) |

Two of the three gate reds were my own file being wrong in the same tree, which is worth saying
plainly: one leg asserted `refused` where the tree only ever warranted `failed`, and one leg
*required the artifact to exist before it would run at all* — a precondition wearing a test.

**Correction owed from the 7-6 merge round:** `FINDINGS.md` §16 there claims the `check:artifacts`
leg depends on build residue. **Measured false.** In a tree with no build output at all,
`node scripts/check-artifacts-committed.mjs` exits `0` with `OK: 1508 files`
(`red-1-instrument.txt`), because both install surfaces are *committed to git*.

---

## 2. The four candidate predicates, measured

The instrument's own wording is the thing being classified, so every candidate was run against
real trees rather than argued about. `packages/client/dist/packages/client/src/plugin/client.js`
is the artifact; `INSTALL_SURFACES = ['packages/runtime/dist', 'packages/client/composition-shim']`.

**P1 — "does *any* build output exist in the tree?"** Useless, and dangerous.
`packages/runtime/dist` (1505 files) and `packages/client/composition-shim` (3 files) are
**tracked and committed**, so a tree in which nobody has ever run a build answers "yes, plenty".
A predicate on this would have been true in exactly the case it was meant to catch.

**P2 — "does the manifest `main`/`exports` resolve to a path with no file?"**
`packages/client/package.json` declares `main: ./dist/index.js`, `exports.import: ./dist/index.js`,
`files: ["dist"]`. Measured: that path does **not** resolve in the unbuilt tree **and** in the
healthy built tree — because the gate loads
`packages/client/dist/packages/client/src/plugin/client.js`, not `dist/index.js`, and neither
state makes the declared entry point exist as such. Fires in both cases: excellent *disclosure*
(it shows the reader that this package's own declared entry ships nowhere), useless as a decider.
It is in the refusal text as disclosure and is not consulted by the decision.

**P3 — "does the leg's own closure gate already know 'not applicable' vs 'applicable and unmet'?"**
Partly. The gate distinguishes two real states and prints them differently —
`FAIL …: built entry is missing` (artifact absent) vs
`SKIP …: host module closure unavailable — N unresolvable: …` (present, but its import graph
cannot be traversed). What it has **no word for is *why***: the artifact-absent branch says what
is missing and how to build it, never whether a build was ever attempted. So P3 is a good
*source of lines to classify* and a poor classifier. The classification therefore lives outside
the instrument, in `scripts/a4-artifact-provenance.mjs`, reading what the gate declares rather
than re-interpreting its prose.

**P4 — "is a fresh clone of a released tree distinguishable from a fresh worktree of a source
tree?"** **No. This is the load-bearing finding, and it is the reason `refused` had to be
narrowed rather than broadened.** Measured (`p4-clone.txt`): a `git clone --local --no-hardlinks`
of `origin/master` `62488ce5` carries `packages/runtime/dist` = 1505 files and
`packages/client/composition-shim` = 3 files — **identical to the worktree's** — and
`packages/client/dist` absent, exactly as a fresh worktree's does. Root `package.json`
`files` = `[".agents/skills", "cordis.patch.yml", "packages/client/composition-shim",
"packages/runtime/dist", "packages/runtime/root-binding",
"packages/runtime/src/plugin/upstream-resolver.mjs"]`, i.e. `packages/client/dist` ships
**nowhere**, and is gitignored besides (`git check-ignore` = yes, tracked = no). The released
tree and the source worktree are the same tree for this question, and the provenance module
returns the *same* verdict in both: `refused`, `outputRoot packages/client/dist`, `0 files`.

So the released case cannot be kept red by *distinguishing* it — it is not distinguishable. It
stays red because `refused` is red in this phase's vocabulary: every leg asserts
`verdict === 'passed'` (or the tree-derived equivalent), so a refusal blocks the merge exactly
as a failure does. `refused` buys the reader a cause, not the run a green.

## 3. The predicate that survived

The question the code answers is not "was a build intended" but **"is there a build output root
here, and does it contain anything?"** — because a build that ran and emitted the wrong surface
leaves *siblings*, and never-built output does not:

| measured condition | verdict | why |
| --- | --- | --- |
| git would not answer (`check-ignore`/`ls-files` failed) | `failed` | an unanswered question is not a refusal to explain |
| artifact is tracked, or inside an install surface | `failed` | its absence is a defect, not a checkout shape |
| output root exists **and holds files** | `failed` | "a build ran in this tree and produced a surface that does not contain …" |
| no untracked-and-ignored ancestor exists | `failed` | this path is not build output at all, so "run `pnpm build`" would be a lie |
| output root exists (or is absent) with **0 files** | `refused` | names the artifact, the command, the surfaces, the manifest disclosure, and the tree shape |

`refused` text states its own limit in the same sentence a reviewer reads:

> … `packages/client/dist/…client.js` is missing, gitignored and untracked, and the build output
> root `packages/client/dist` carries no files. … **This is byte-identical to a build that ran
> and emitted nothing**: what a never-built checkout and an empty build product share is exactly
> this inventory, so this leg reports the missing artifact rather than guessing which of the two
> it is. Run `pnpm build`. Tree this leg measured: HEAD `69f7fdad`, N tracked file(s) not
> matching HEAD. … refused is not passed — this leg blocks the merge exactly as a failure does.

Mechanism note worth keeping: `outputRootOf` walks to the **outermost** untracked-and-ignored
ancestor, and must probe directories as `` `${rel}/` `` — gitignore's `dist/` is a *directory*
pattern, so testing the bare path does not match it and the walk lands one level too deep
(measured: returned `packages/client/dist/packages` before the fix).

## 4. Proof across three trees (+ the fourth)

`gate-three-trees.txt`, `trees-AC.txt`, `treeA-unbuilt.txt`, `treeD-scratch-residue.txt`.
Each tree moves only gitignored build output, and the specs assert their own restoration.

Which file holds which run, stated plainly: `gate-across-three-trees.txt` and
`treeA-unbuilt.txt` were taken **before** the closure-leg fix, and their tree-B / tree-A reds are
exactly the defect this section describes (a leg hard-coding one word). The final-code numbers
are in `battery.txt` (trees A and B) and `gate-tree-C-final.txt` (tree C);
`closure-leg-across-three-trees.txt` is that leg alone in all three trees after the fix. Nothing
was deleted from the earlier transcripts.

| tree | how made | instrument | 7.6 gate | 7.5 classifier |
| --- | --- | --- | --- | --- |
| A — no build output | `mv packages/client/dist` aside | `exit 1`, one `FAIL` naming the artifact, `check:artifacts` `OK: 1508 files` | **22 passed (22)** — composition leg reads `refused` | **54 passed (54)**, prints `this checkout has no built artifact for …client.js — HEAD 69f7fdad … carries 0 file(s)` |
| B — healthy build | `pnpm --filter @dsh-agent-team/client run build` (exit 0, `git status` unchanged) | all arms PASS | **22 passed (22)** — closure leg reads `refused` via the SKIP route | **54 passed (54)** |
| C — one artifact surgically removed, siblings left | `mv` of the single entry, **399 siblings remain** | one `FAIL`, output root non-empty | **22 passed (22)** — the partial-output leg is green *only because it read `failed`* | **54 passed (54)** |
| D — one gitignored root-level scratch `.mjs` | wrote `.tmp-resolve-probe.mjs` (the coordinator's specimen, by name, `.gitignore:92`) | see §5 | see §5 | — |

Tree C is the one that keeps `refused` honest: measured provenance `failed`,
`outputFileCount 399`, and the leg that asserts "`failed`, and the reason says *a build ran in
this tree*" is green there. The closure leg is shown separately in
`closure-leg-across-three-trees.txt` — it passes in all three trees because the word it expects
is derived (`refused` when the only thing stopping the step is the hidden package, `failed` when
the tree is also holding a half-built surface), while the constant is that it is never `passed`.

The third tree is also proven **without** a built checkout: the 7.5 suite gained a fourth fixture
state `'absent'` (`buildGateRepo` skips writing the entry for the `closureGate` target) so the
behaviour is not something only a hand-mutated tree can demonstrate, and a new leg pins the
instrument's words for it — no `SKIP`, footer `FAIL composition-smoke`, exactly one FAIL step,
naming the artifact and `pnpm build`, and `PASS host plugin (packages/runtime)` still printed
("an unbuilt half of the tree may not turn the rest of the gate quiet").

## 5. The fourth transcript: a checkout carrying gitignored scratch

`.tmp-resolve-probe.mjs` at the root, gitignored at `.gitignore:92`, contents deliberately
containing an undefined global. `git status --porcelain` shows nothing for it.

| leg | what it reads | what it answered | what it should answer |
| --- | --- | --- | --- |
| lint (`lint-identities --diff`) | **the filesystem as ESLint sees it** — ESLint does not read `.gitignore` | red: `162 identity lines, 77 distinct`, `new 1`, the new identity being `error no-undef .tmp-resolve-probe.mjs`, and the new line `universe: 1105 file(s) linted, 1 of them gitignored …: .tmp-resolve-probe.mjs` (`git status --porcelain` shows nothing for it) | still red (a human's scratch file is in their lint view, and hiding it would make `pnpm lint` disagree with the editor), **but now it must say which tree it scanned** — the leg's own failure text quotes the universe, and it refuses a run that reports a verdict without one |
| the gate's lint leg | same | `expected 'failed' to be 'passed'`, reason `new lint identities against the accepted baseline (universe: 1105 file(s) linted, 1 of them gitignored …): NEW IDENTITIES (1): error no-undef .tmp-resolve-probe.mjs` — the reader can now see in one line that the red was measured over a tree carrying scratch, not over the tree under review | — |
| `check:artifacts` | tracked install surfaces vs disk | `exit=0`, unaffected, correct | unchanged |
| fence | `git ls-files` in scope only, zero disk reads | unaffected — correct | unchanged |
| composition | artifact paths on disk | unaffected by a root scratch file | unchanged |

The coordinator's own numbers at the same SHA were `164 lines, 77 distinct, new 1` against
`160 / 76 / new 0` in a clean worktree; here the specimen moved `160 / 76` → `162 / 77` with
`new 1`. Same delta, two different checkouts — which is the point: the *diff* against the named
baseline is what means something, and it is a function of the files ESLint read.

The coordinator relocated rather than deleted the file, and that was the right call: the two
cases differ. A root scratch `.mjs` that sits there for days **is** part of a human's lint view
and must stay visible; `packages/testkit/test/.tmp-fault/` exists only while a test runs and
cannot be part of a baseline. See §6 for where that line is drawn and why it is not "ignored
files are invisible".

## 6. eslint's exit 2: contention was excluded, the universe was not

Reported against the root suite at `73ffd06c`: `a4p7-merge-gate` red with
`lint leg did not close. why: the identity diff produced no "new N, resolved N" verdict (exit 2);
output tail: lint-identities: NOT RUN :: eslint produced no JSON (status 2, signal null, error
none)`, `expected 'refused' to be 'passed'`, and 20/20 green when re-run alone after the scratch
file was relocated. Two hypotheses were on the table. Both were measured in an isolated
worktree at `73ffd06c` (`lint-diagnosis.txt`).

- **H1 contention — excluded.** Four concurrent full-root `eslint .` scans: all exited **1** with
  complete JSON (3 063 500 bytes each). A scan running while `p6t1-parallel.test.ts` hammered the
  box: exit **1**, complete JSON.
  - A third candidate was ruled out from the instrument's own source rather than by experiment:
    the buffer. `captureIdentities` spawns with `maxBuffer: 256 * 1024 * 1024` against a ~3 MB
    payload, and a killed buffer reports `status null` with `error ENOBUFS` — the observed runs
    reported `status 2 … error none`, which is eslint exiting on its own.
- **H2 something flickering in the universe — confirmed, and it is the truthfulness problem.**
  Deleting a directory tree that `eslint .` is mid-way through walking reproduces it **3 of 3
  attempts**, exit 2, zero stdout, verbatim stderr:

  ```
  ESLint: 9.39.5
  Error: ENOENT: no such file or directory, open '…/packages/testkit/test/.tmp-fault/repo/scripts/h1.mjs'
      at readAndVerifyFile (node_modules/.pnpm/eslint@9.39.5/node_modules/eslint/lib/eslint/eslint-helpers.js:1306:16)
  ```

  Creating and deleting *individual files* continuously for the whole scan did **not** do it
  (4 of 4 exit 1): the trigger is a directory vanishing between the walk and the read.
- **End-to-end reproduction of the reported flake:** running the 7.5 suite (which builds and
  `rmSync`s `packages/testkit/test/.tmp-fault/a4p75-gate-verdict`) concurrently with
  `lint-identities --diff` gave `exit 2 / NOT RUN` on attempt 1 and a clean
  `160 identity lines, 76 distinct; new 0, resolved 0` on attempt 2. Load is not the cause; load
  is what makes the window observable. That is why it looked like a 32-core problem.

**Reproduced alone?** Yes — and it is not load-sensitive in the way it appeared. In a quiet tree
the reported gate run is deterministic: the gate passed when run alone here and in the
coordinator's relocated tree; the red needs a `.tmp-fault` tree to be vanishing during a root
scan, which is what a root suite run provides. The three-attempt language applies to the
flicker experiment: 3/3 (E2b) and 4/4 clean for the file-churn variant (E2), 4/4 clean for
contention (E3).

**Why `.tmp-fault` was in scope at all:** `eslint.config.mjs` lists `.tmp-*/**` with a comment
saying the pattern exists so new scratch directories cannot re-break the gate — but flat-config
`ignores` patterns are **root-anchored**, so it never reached
`packages/testkit/test/.tmp-fault/`. Measured in the lab worktree: a file placed there is linted
(`1103` files with it present, `1102` without).

**One honest wrinkle.** A completed 7.5 run leaves `packages/testkit/test/.tmp-fault/` on disk in
this environment (the battery's last line caught exactly that residue), and that directory is the
same class as the crash source. It is gitignored, so nothing else notices. That is a second
reason the exclusion belongs at the eslint layer rather than in a retry: the residue is normal,
the crash is what is not.

**Fix and its cost, measured before adopting it.** Added `'**/.tmp-fault/**'` to the ignores.
Identity-neutral in a quiet tree: **62 identities** with the pattern, without it, and with
fixtures present; `absent vs ignore-pattern identical: true`. It removes exactly one transient
file (`only-with-fixtures-present: packages/testkit/test/.tmp-fault/probe/z.mjs`) and kills the
`readAndVerifyFile` ENOENT class. It is not a blanket "ignored files are invisible" move: the
root-level human scratch specimen stays in scope on purpose, and the excluded tree is fixture
output whose copies of `scripts/**` are sha256-compared to the originals, which *are* linted.

## 7. The disclosure doctrine this round settled

`passed | failed | refused` stays the only vocabulary, and no `.skip`, tolerance branch or
`it.skipIf(noArtifacts)` appears anywhere. What task #2 added is that a leg must **name the tree
it measured**, because the `why:` text of a non-green verdict is the only part anyone reads:

- the composition refusal carries `Tree this leg measured: HEAD <short>, N tracked file(s) not
  matching HEAD` plus the artifact path, `gitignored and untracked`, the install-surface list,
  the manifest `main` disclosure, the command that would produce it, and the byte-identical
  caveat;
- `scripts/lint-identities.mjs` now prints `lint-identities: universe: N file(s) linted, M of
  them gitignored (ESLint does not read .gitignore, so the identity set is a function of these
  files, not of git status): <paths>`, and the lint leg **refuses a run that reports a verdict
  without reporting its universe** — a leg that stops stating its universe must not be believed.
  The count is parsed, not just echoed: `new 0, resolved 0` is also exactly what a scan that read
  **no files at all** reports against any baseline, so a universe of `0 file(s) linted` is a
  refusal too. That classifier now lives at module level with its own captured-output leg
  (`classifies a lint run by its verdict line and its universe line`), because its refusal arms
  are reachable only when the instrument is broken, and the previous round's review found exactly
  that class of code — an arm nobody had ever seen fire;
- the 7.5 suite's live leg writes its tree state to stderr even when it is green-adjacent, so a
  red transcript says which checkout it came from;
- measured universe of a clean tree at this head: **`1104 file(s) linted, 0 of them
  gitignored`** (`battery.txt` §6) — with no scratch anywhere, the lint universe and the tracked
  set coincide, and the identity diff is the standing `160 identity lines, 76 distinct;
  new 0, resolved 0`. Put the specimen in and the same run prints `1105 …, 1 of them gitignored
  …: .tmp-resolve-probe.mjs` (`tree-D-scratch-residue.txt`).

| leg | reads | prints about its universe |
| --- | --- | --- |
| fence (`verify-blueprint-version-clean.mjs`) | tracked-only (`git ls-files`, 6 uses, 0 disk reads) | `scanned-in-scope: 748 tracked files` — the same 748 with and without the scratch specimen, measured twice |
| lint (`lint-identities.mjs`) | filesystem as ESLint sees it | **new** `universe: N file(s) linted, M gitignored: …` |
| composition (`composition-smoke.mjs`) | filesystem as-is | per-arm lines; refusal text adds the tree shape |
| artifacts (`check-artifacts-committed.mjs`) | tracked surfaces **and** disk | `OK: N files` |

## 8. The battery at the head (`37d566c6`, final code)

`battery.txt`, exit codes measured without a pipe throughout:

| item | result |
| --- | --- |
| p4t6 scannable-file ledger | `10 passed (10)` — **no ledger increment**: `scripts/**` and `dev/agent-workflow/evidence/**` are outside the scan, and both edited test files were already counted |
| the 7.6 gate in the checkout a reviewer clones (committed surfaces, no client build) | `23 passed (23)` |
| the 7.5 classifier suite in that tree | `54 passed (54)`, printing its tree state (`HEAD 37d566c6, 0 tracked file(s) not matching HEAD`) |
| `pnpm --filter @dsh-agent-team/client run build` | exit 0 and **`git status` identical afterwards** — the build touches nothing committed |
| the gate + classifier in the healthy tree | `23 passed (23)` / `54 passed (54)` |
| the gate in the one-artifact-removed tree | `23 passed (23)` (`gate-tree-C-at-head.txt`) |
| the same battery a second time on the clean head | `head-verification.txt`: gate `23`, classifier `54`, p4t6 `10`, `new 0, resolved 0` + `universe: 1104 file(s) linted, 0 of them gitignored`, `composition-smoke` exit 0, typecheck exit 0, changed-file eslint exit 0, `git status` empty |
| `pnpm -r run typecheck` | exit 0, 8 `Done`, 0 `error TS` |
| changed-file eslint (all six touched files) | exit 0 |
| `lint-identities --diff …0237d487.txt` | exit 0, `160 identity lines, 76 distinct`, `new 0, resolved 0`, `universe: 1104 file(s) linted, 0 of them gitignored` |
| `composition-smoke` | exit 0, footer `PASS composition-smoke` |
| tree at the end | the six intended changes and nothing else; `packages/testkit/test/.tmp-fault` removed |

Counts moved as expected: the gate spec `20 → 23` legs (the precondition-bearing mutation leg
replaced by two, plus the synthetic-provenance leg, plus the captured-output lint-classifier
leg), the classifier suite `53 → 54` (the `'absent'` fixture leg).

## 9. eslint's stderr, which was the other unconditional fix

`lint-identities.mjs` previously reported `eslint produced no JSON (status 2, signal null, error
none)` — three facts that are not the one fact anyone needed. "No output" and "output not
captured" are different facts, and the reason now distinguishes all three:

- `; eslint stderr: 683 bytes, tail: <last 8 lines>` — what it says in the reproduction above is
  the ENOENT line and its stack frame, which names the vanished path;
- `; eslint stderr: empty (0 bytes)` when stderr was genuinely empty;
- `; eslint stderr: not captured (stdio was not a pipe)` when the spawn gave us nothing to read.

The instrument distinguishes all three, because its `spawnSync` result may legitimately carry no
`stderr` at all. The gate's classifier, whose `runLeg` always pipes, distinguishes the two that
can occur there (`empty (N bytes)` / `N bytes: <tail>`) and says nothing it has not measured.

The gate's lint leg classifies over `stdout + stderr` (the `NOT RUN` line went to stderr, which
the old classifier never looked at) and puts that tail into the refusal reason.

## 10. What this change does not claim

- It does not distinguish "never built" from "built and emitted nothing". It says so, in the
  sentence the reader acts on, and it keeps both red.
- It does not make gitignored files invisible. It makes the scan say how many it read.
- It does not add a retry anywhere. The lint leg fails with the cause instead.
- It does not touch `scripts/composition-smoke*.mjs`, the closure walker, or the instrument's
  strictness: the instrument still calls a missing artifact a failure, never a skip. All the
  interpretation lives in the two specs and one new read-only module.
- `p4t6`: `scripts/**` is outside the scan scope, so **no ledger increment** — the total stays
  1029; the two edited `packages/testkit/test/*.ts` files were already counted there.
- A consistent arm deletion still stays green by design (accepted residual from the 7-6 round);
  this round narrows no arm list and adds no literal arm.

## 11. Files

| file | change |
| --- | --- |
| `scripts/a4-artifact-provenance.mjs` | new, read-only: `artifactProvenance`, `treeShape`, `absentArtifactVerdict`, `classifyAbsentArtifact`; header records the four candidate predicates and their measured verdicts |
| `scripts/a4-artifact-provenance.d.mts` | new, typed sidecar (repo convention: `composition-smoke-targets.d.mts` etc.) |
| `scripts/lint-identities.mjs` | eslint stderr forwarded into the no-JSON reason (three distinct cases); `lintUniverse()` via `git check-ignore --stdin`; prints the `universe:` line |
| `eslint.config.mjs` | `**/.tmp-fault/**` ignored, with the measurements that justify it |
| `packages/testkit/test/a4p7-merge-gate.test.ts` | classifier consults provenance; `expectation(arts)` derived by an independent route; new synthetic-provenance leg; the precondition-bearing mutation leg replaced by two legs (never-built → `refused`, partial output → `failed`); closure leg no longer hard-codes one word; the lint classifier extracted to module level and given a captured-output leg (verdict line, universe line, zero-file universe, stderr disclosure); `compositionTargets()` carries `rel`/`closureGate` |
| `packages/testkit/test/a4p75-composition-smoke-classification.test.ts` | fourth fixture state `'absent'`; new leg pinning the instrument's words for it; live leg gained the third state and prints the measured tree shape; `COMMITTED_ARM` derived |
