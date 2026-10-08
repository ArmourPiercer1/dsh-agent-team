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

**Re-measured at the merged head `bfbd89a5`, review round** (`review-round-f5-narrow-and-root-case.txt`,
case (d)): the same class of specimen — a root `.tmp-resolve-probe.mjs`, this one holding a single
undefined call — moves the run from `160 identity lines, 76 distinct` over
`universe: 1105 file(s) linted, 0 of them gitignored` to `161 / 77 distinct` over
`universe: 1106 …, 1 of them gitignored …: .tmp-resolve-probe.mjs`, `new 1`, the new identity being
`error no-undef .tmp-resolve-probe.mjs`. The line delta is +1 here and was +2 above because this
round's specimen contains one error and the first round's contained two: same mechanism, and the
number that carries the claim is the `new 1` that names the file. The clean-tree universe is `1105`
at the merged head rather than the `1104` quoted below, because this round added a tracked lintable
file (`scripts/lint-identities.d.mts`); §14 carries the merged-head battery.

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

**Fix and its cost, measured before adopting it.** Added `'**/.tmp-fault/**'` to the ignores. It
removes exactly one transient file (`only-with-fixtures-present:
packages/testkit/test/.tmp-fault/probe/z.mjs`) and kills the `readAndVerifyFile` ENOENT class. It is
not a blanket "ignored files are invisible" move: the root-level human scratch specimen stays in
scope on purpose, and the excluded tree is fixture output whose copies of `scripts/**` are
sha256-compared to the originals, which *are* linted.

> **Correction, review round.** The sentence that stood here — "Identity-neutral in a quiet tree:
> **62 identities** with the pattern, without it, and with fixtures present; `absent vs
> ignore-pattern identical: true`" — **does not reproduce**. No run in this repository produces 62
> identities against this baseline (the tree's standing number is 76 distinct, 160 lines), and the
> review caught it as "a stale number in a load-bearing comment", which is exactly right: the
> comment's whole function was to persuade the next reader that deleting the pattern costs nothing,
> so an unreproducible number there was a false claim doing gate work, not a summary. The
> measurement that replaces it is §13: the exclusion is *not* cost-free (deleting it adds five files
> and ten identities from fixture scratch), the generalised class pattern is exactly as neutral as
> the one name (identical 160 / 76 / 1105 / new 0), and the boundary in the other direction is
> measured too. The numbers in `eslint.config.mjs`'s comment are now the four cases of §13, labelled
> with the head they were taken at.

## 7. The disclosure doctrine this round settled

`passed | failed | refused` stays the only vocabulary, and no `.skip`, tolerance branch or
`it.skipIf(noArtifacts)` appears anywhere. What task #2 added is that a leg must **name the tree
it measured**, because the `why:` text of a non-green verdict is the only part anyone reads:

- the composition refusal carries `Tree this leg measured: HEAD <short>, N tracked file(s) changed
  vs HEAD, M untracked entr(ies) …` plus the artifact path, `gitignored and untracked`, the
  install-surface list, the manifest `main` disclosure, the command that would produce it, the
  byte-identical caveat, and — added in the review round — the sentence naming what the verdict was
  drawn from (`this verdict is drawn from packages/client/dist ALONE, nothing outside the declared
  output root is examined`). §12 F2/F3 explain why both halves of that line were rewritten;
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
- measured universe of a clean tree at `37d566c6`: **`1104 file(s) linted, 0 of them
  gitignored`** (`battery.txt` §6) — with no scratch anywhere, the lint universe and the tracked
  set coincide, and the identity diff is the standing `160 identity lines, 76 distinct;
  new 0, resolved 0`. Put the specimen in and the same run prints `1105 …, 1 of them gitignored
  …: .tmp-resolve-probe.mjs` (`tree-D-scratch-residue.txt`).
  **Review-round restatement:** at the merged head with this round's files the clean-tree universe
  is **`1105 file(s) linted, 0 of them gitignored`** and the specimen's universe is `1106` — the
  +1 is `scripts/lint-identities.d.mts`, a new tracked lintable file. The identity diff stays
  `160 / 76 / new 0 / resolved 0`. A universe count is a property of the tree, so it is quoted with
  the head it was measured at, and the lint leg prints it on every run rather than relying on this
  sentence.

| leg | reads | prints about its universe |
| --- | --- | --- |
| fence (`verify-blueprint-version-clean.mjs`) | tracked-only (`git ls-files`, 6 uses, 0 disk reads) | `scanned-in-scope: N tracked files` — see the correction below the table: `748` at the pre-merge bases, **`750`** at my head, identical across two consecutive runs |
| lint (`lint-identities.mjs`) | filesystem as ESLint sees it | **new** `universe: N file(s) linted, M gitignored: …` |
| composition (`composition-smoke.mjs`) | filesystem as-is | per-arm lines; refusal text adds the tree shape |
| artifacts (`check-artifacts-committed.mjs`) | tracked surfaces **and** disk | `OK: N files` |

**Which list moved, and which did not (review round).** The row above said `748 … measured twice`,
and at the time that was true of the tree it was measured in — but it had been copied out of a
transcript taken before this lane added its two `scripts/` files, so the number it carried into
§7 was already stale. Recomputed with the fence's **own exported scope predicate**
(`isScanScopePath`, imported rather than re-implemented, applied to `git ls-tree -r --name-only` per
commit):

| tree | in fence scope |
| --- | --- |
| `69f7fdad` (the base review measured against) | 748 |
| `14ea8717` (`origin/master` at merge time) | 748 |
| `4d331349` (this lane, pre-merge) | **750** |
| `bfbd89a5` (merged head) | **750** |

The two that entered are exactly `scripts/a4-artifact-provenance.mjs` and
`scripts/a4-artifact-provenance.d.mts` — nothing moved on master's side (0 added, 0 removed in
scope), so the fence's `dirty(41 files, 96 sites)` findings are unchanged by this lane and its two
runs are byte-identical (`sha256 83d49163…`, 22 626 bytes each). The number goes to **751** once
this round's `scripts/lint-identities.d.mts` is committed, for the same reason, and that is stated
here rather than discovered by the next reader.

The p4t6 scannable-file ledger total did **not** move (1029), and it is not an oversight: p4t6
counts scannable files inside the nine `packages/**` package trees, and every file this lane added
lives in `scripts/` or `dev/agent-workflow/evidence/` — outside its scope — while both edited spec
files were already counted there. Two scanners, two scopes, two different answers to "did the
number move": the fence reads `scripts/`, p4t6 does not.

## 8. The battery at the head (`37d566c6`, final code)

> **Labelled by base, review round:** every count in this section is the **pre-merge** tree at
> `37d566c6`/`4d331349` — 23 gate legs, universe 1104, tree shape in the old wording. The merged
> tree with the review fixes is §14 (25 gate legs, universe 1105, and the composition leg red in a
> never-built tree). Both are kept: the numbers differ because the tree and the gate changed, and a
> receipt whose base is not named is not a receipt.

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

## 12. The review round: MERGE-with-fixes, and what each finding actually measured

Reviewer's closing line, logged verbatim because it is the finding: **"Category: sound and tested.
Honesty of the green: not yet."** Coordinator's instruction: merge first, re-derive everything on
the merged tree. The merge (`bfbd89a5`) brought `origin/master` `14ea8717` with zero overlap against
these 29 files, so every number below is a merged-tree number and §8 is labelled as pre-merge.

### F1 — the blocker: a leg that asserts an exit code asserts nothing about its arms

**The claim.** Review measured the gate at base `69f7fdad` in a never-built tree as `3 failed |
17 passed (20)` — the era before this file existed — and the same probe at this lane's head, in the
merged tree, as **`23 passed (23)`**: a green machine gate over a gate that never ran its client arm.
My own pre-fix transcript says the same thing two ways: the instrument in that tree exits 1 with one
step `FAIL` and footer `FAIL composition-smoke`, while the gate that reads it prints 23/23. The spec
writes nothing to stdout or stderr anywhere in itself, so nothing in the transcript distinguishes the
green from a run whose arms executed.

**The hole, measured before being fixed** (`review-round-merged-head-before-fix.txt` for the
healthy/never-built rows, banked pre-fix on purpose since the claim is about the pre-fix tree; the
two relocation rows are review's probe, reproduced post-fix in `review-round-f1-gate-across-trees.txt`
and §14):

| tree | instrument | pre-fix gate | what the pre-fix gate said |
| --- | --- | --- | --- |
| healthy (client dist 400 files) | exit 0, footer `PASS` | 23/23 | green, and earned |
| never built | exit 1, `10 PASS`, 1 step `FAIL`, footer `FAIL composition-smoke` | **23/23** | **green, not earned** |
| output moved to `packages/client/build` (not gitignored) | same | red — **only** via the lint leg (`new 6`, universe 1305) | the composition leg was green; the red that fired was a lint identity diff, i.e. an accident of the destination not being ignored |
| output moved to `packages/client/out/dist` (gitignored) | same | **23/23** | **green while a complete plugin sat off the declared path**; `check:artifacts` still said `OK: 1508 files`, `new 0, resolved 0` |

**The choice, and why the stronger option.** Two ways to close it: invent a predicate that
recognises "output exists but not where it was declared", or make the leg's belief depend on the
arm having **run**. The first was measured as unavailable: there is no build residue anywhere in
this repository to reason from (no `*.tsbuildinfo` file tracked or untracked, no `incremental` or
`composite` flag in any tsconfig), and the only other asymmetry between a clone and a worktree is
`.git` being a directory versus a file — **a separator that distinguishes the harness, not build
intent, so using it would be belief-manufacture**. So the leg now asserts `owed === 'passed'`, and
the `refused` / `failed` distinction stays where it is earned: the synthetic-provenance leg and the
two mutation legs, which are green precisely because they have never been green over a tree that
entitled them to nothing. This is the same doctrine as `refused` itself: *earned by never being
green*, not inferred from a cleverer guess.

**After the fix** (`review-round-f1-gate-across-trees.txt`, `review-round-battery-at-992b416b.txt`
§§8-10): the never-built tree gives `1 failed | 24 passed (25)`, tree C gives `1 failed | 24 passed
(25)`, the off-path gitignored tree gives `1 failed | 24 passed (25)` — the gate is red in all three,
and the leg that goes red writes its reason to stderr before it does it, so the transcript names the
artifact, the command, and the tree. The off-path tree's other legs stay green exactly as the review
predicted (`check:artifacts` `OK: 1508 files`, `new 0, resolved 0`, universe 1105): **the gate is red
because of F1's structural change and nothing else**, which is the point of taking the stronger
option rather than the one that leans on lint noticing by accident.

**The tree-C asymmetry, restated after F1** (`review-round-verdicts-battery-and-f5-ab.txt` part 1 —
one call to `absentArtifactVerdict`, four trees):

| tree | verdict | what the sentence says |
| --- | --- | --- |
| entry present, 400 files | (out of contract — the caller checks `exists` first) | `absentArtifactVerdict` has no `passed` in its vocabulary, so even called wrongly it cannot manufacture a green |
| A: never built, 0 files in the root | `refused` | no trace of it in `packages/client/dist`; run `pnpm build` |
| C: entry gone, 399 siblings | **`failed`** | missing while the declared root carries 399 other file(s): a build ran and produced the wrong surface |
| E: output moved off-path | `refused` | same sentence as A — which is F2's whole content: from inside the declared root these two are the same tree |

A and C are both red now, and both name themselves; C is a regression and A is a precondition, and
the words differ. E is red too, and is honest about being indistinguishable from A.

### F2 — the refusal said more than it measured

`the tree says this checkout has never produced it rather than that a build went wrong` is **false**
in tree E, and the tree was in the transcript. Now:

> `… is not on disk and there is no trace of it in packages/client/dist — … The limit of that
> sentence, stated rather than left to the reader: this verdict is drawn from packages/client/dist
> ALONE, nothing outside the declared output root is examined, and there is nothing outside it to
> examine — so a build that ran and whose output was then moved elsewhere is indistinguishable,
> here, from a build that never ran, and `pnpm build` would not fix that.`

The sentence the reader acts on now carries its own bound. A leg cannot claim more than its
instrument read, and if the bound makes the red look weaker, that is the bound being true.

### F3 — a reason string that lied about what it counted

`treeShape` counted `git status --porcelain` **lines**, untracked included, untracked directories
collapsed, and printed `1 tracked file(s) not matching HEAD` for three files inside one new
directory. Fixed by naming each population as what it is:

`HEAD bfbd89a5, 4 tracked file(s) changed vs HEAD, 1 untracked entr(ies) [counted from git-status
entries: an untracked directory counts as one]`

and `working-tree state UNREADABLE (git status did not answer)` when git is silent, instead of the
silence reading as clean. Visible in the tree transcripts: tree A/E say `1 untracked entr(ies)`
(this round's sidecar), tree F says `2` (the sidecar plus the moved output) — the count is doing
arithmetic a reader can check, not decoration.

### F4 — a green may only come from stdout; a red may come from either

The head classified over `stdout + stderr`, so a crashed run that printed its trio on stderr read
`passed`. Split now, and pinned by three assertions: healthy stdout + healthy stderr ⇒ `passed`;
**empty stdout + the whole healthy trio on stderr ⇒ `refused`**, with `ON STDOUT` and the identity
count in the reason; red ⇒ stderr quoted into `why`. The stderr tail still reaches the reader —
that was the eslint exit-2 fix, and the widening was needed for the *reason*, never for the verdict.

### F5 — a stale number in a load-bearing comment, and a class the narrow name was hiding

See §13 for the measurement. The comment's `62 identities` reproduced nowhere (§6 carries the
correction), the pattern is generalised to `'**/.tmp-*/**'`, and the generalisation is measured free
rather than asserted.

### F6 — nothing anywhere asserted that tracked files are lint-visible

`eslint .tmp-fault/probe/hides.mjs` exits **0** while printing `File ignored because of a matching
ignore pattern…`, and the shipped config's `**/dist/**` plus `**/composition-shim/**` plus
`dev/**`, `docs/**`, `tests/**` already hide **1313 tracked lintable files** — 54 % of the tracked
lintable set — from every rule in the repository. All of it is ratified (`packages/runtime/dist` and
`packages/client/composition-shim` are the two committed install surfaces; the other three are the
documentation/evidence trees), and none of it was asserted. The new leg runs the census, ratifies by
**prefix derived from `INSTALL_SURFACES`** rather than a hard-coded word, and prints its denominator:

`lint-visibility: eslint read 1104 of 2417 tracked lintable file(s); 1313 are hidden by an ignore
pattern (dev/ 442, packages/client/composition-shim/ 2, packages/runtime/dist/ 753, tests/ 116) — 1
tracked lintable path(s) are not a file on disk and were skipped: dev/…/upstream-resolver.mjs`

After this round's sidecar is committed the same line reads `1105 of 2418`; the arithmetic holds in
both trees (`hidden + read = candidates`). The leg also refuses rather than passing when the report
count does not match its own candidate list, and its detector is pinned against the captured message
object — see §15 for why that pin was the second-most-valuable line in this round.

### The two nits, both taken

- **`not captured (stdio was not a pipe)` was unreachable through `runLeg`, which always pipes.**
  Rather than label it, `describeStderr` is exported and a leg calls it with all three inputs, so
  the arm is executed; it stays honest for the callers that really can produce `undefined`
  (stdio inherited), and the instrument's comment says which.
- **`artifactProvenance` now refuses to answer from a subdirectory.** Called with `repoRoot` pointed
  at `packages/client` it answered `outputRoot "packages"`, `manifestEntry.package
  "../../../package.json"` and still `refused` — a confident verdict about a tree it was not standing
  in. It throws instead (realpath-compared, so a symlinked toplevel still counts).

## 13. The eslint exclusion, measured four ways (F5) and the visibility census (F6)

Five planted `.mjs` files under `packages/testkit/test/.tmp-fault/repo/scripts/`, each holding one
unused binding and one undefined call; the whole-repo identity diff run once per config; source tree
otherwise clean; measured at `bfbd89a5` with this round's `scripts/lint-identities.d.mts` on disk
(`review-round-verdicts-battery-and-f5-ab.txt` part 3 for (a)/(b), `review-round-f5-narrow-and-root-case.txt`
for (c)/(d)):

| config | identity lines | distinct | `universe:` | gitignored in universe | `new` |
| --- | --- | --- | --- | --- | --- |
| (a) `'**/.tmp-*/**'` — as shipped | 160 | 76 | 1105 | 0 | **0** |
| (b) the line deleted | 170 | 86 | **1110** | 5, the planted files named | **10** |
| (c) `'**/.tmp-fault/**'` — the one name it replaces | 160 | 76 | 1105 | **0** | **0** |
| (d) (a) + one root scratch FILE `.tmp-resolve-probe.mjs` | 161 | 77 | **1106** | 1, named | **1** |

Four things follow, and each is a different claim than the one the old comment made:

- **The exclusion is load-bearing.** (b) is not "62 identities either way": five files that exist
  only while a suite runs entered the lint universe and produced ten identities against a baseline
  nobody edited. Against the 7.5 suite's own fixture trees review measured the same mechanism at a
  phantom `new 60`. The ratio is the point — the phantom scales with the fixture tree, so it is
  unbounded.
- **Generalising from the one name to the class costs nothing.** (a) and (c) are the same four
  numbers. The narrow name was not protecting anything; it was naming the suite that happened to
  get bitten first. `git ls-files | grep -cE '(^|/)\.tmp-'` is **0**, so no tracked path can be
  swallowed by the wider pattern, and F6 now asserts that property in code rather than in a grep
  someone has to remember.
- **The boundary still runs the other way.** (d) keeps a scratch FILE at the repository root visible
  and red — both patterns match directories, so the human-scale case (§5) is untouched. What is
  removed is a tree that exists only during a test run, whose `scripts/**` copies are digest-compared
  against the originals that *are* linted.
- **The `universe:` line is what made any of this measurable.** Without the count of files actually
  read, (b) is indistinguishable from a real regression by anyone who is not standing in the tree.

The first round's comment claimed "identity-NEUTRAL … measured 62 identities". It was not neutral
(load-bearing, by ten identities) and 62 was not a measurement anyone can reproduce. Both halves of
that sentence were doing work — they were the reason the pattern should survive the next
refactor — and a comment that persuades with a number nobody took is worse than no comment, because
it stops the next reader from taking one.

**F6, the census in the same tree.** 2418 tracked lintable paths (`git ls-files`, the eight
extensions the flat config declares rules for), 2417 of them a file on disk, 1313 answered by
eslint as ignored, 0 of those under an unratified prefix:

| prefix | hidden tracked lintable files | ratified because |
| --- | --- | --- |
| `packages/runtime/dist/` | 753 | `INSTALL_SURFACES[0]` — committed, ships on install |
| `dev/` | 442 | the config's own `dev/**` (evidence and orchestration) |
| `tests/` | 116 | the config's own `tests/**` (pristine upstream runtime) |
| `packages/client/composition-shim/` | 2 | `INSTALL_SURFACES[1]` — committed, ships on install |

Read: 1104 (2417 − 1313), which is the same population as the lint leg's `universe: 1105` plus the
one file that was not tracked at the time of that particular census. The leg prints both halves and
the skipped path, and refuses when they stop adding up.

Two facts the census produced that belong to other lanes, not fixed here:

- **A tracked symlink in merged evidence is dangling in this checkout.**
  `dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/src/plugin/upstream-resolver.mjs`
  is mode `120000` whose absolute target lives under the gitignored sibling worktree
  `.worktrees/a2c-1/…`. `git status` is clean, `git ls-files` lists it, and it is **not** a file:
  eslint refuses an argv containing it (`exit 2`, `No files matching the pattern "…upstream-resolver.mjs"
  were found`). Nothing in this lane deletes another lane's evidence, so the census filters to
  existing paths and says so on its own output line. Whoever owns `alpha2-capability-completion`
  should decide whether that symlink belongs in a tree other worktrees will check out.
- The census must spawn `node node_modules/eslint/bin/eslint.js`, not `npx eslint …`: at this argv
  size npm exits **249** in ~0.24 s without starting eslint at all (§15).

## 14. The battery at the post-fix head (`992b416b`, merged tree, this round's code)

`review-round-battery-at-992b416b.txt`, every exit code measured without a pipe:

| item | result |
| --- | --- |
| fence ×2 | exit 1 / 1 (standing `verdict: dirty-or-unknown`), **byte-identical**, 22 626 bytes, `sha256 0eb00e1a…`; `scanned-in-scope: **751** tracked files`; `dirty(41 files, 96 sites)`, `unknown(0, 0)`, `adjudicated(16, 24)` — identical to the pre-merge findings, so this lane reddens nothing |
| `lint-identities --diff …0237d487.txt` | exit 0, `160 identity lines, 76 distinct`, `new 0, resolved 0`, `universe: 1105 file(s) linted, 0 of them gitignored` |
| `p4t6` + the fence/verify-zero-core wrapper | **`68 passed (68)`** (58 wrapper legs + 10 p4t6 legs), no ledger increment |
| `pnpm -r run typecheck` | exit 0, 8 `Done`, **0 `error TS`** |
| `node --check` × 3 (`a4-artifact-provenance.mjs`, `lint-identities.mjs`, `eslint.config.mjs`) | exit 0 each |
| changed-file eslint (7 touched files) | exit 0 |
| `check:artifacts` | exit 0, `OK: 1508 files` |
| instrument, healthy tree | exit 0, footer `PASS composition-smoke`, 11 step lines all `PASS`, 0 `SKIP` |
| **instrument, never-built tree** | **exit 1**, `10 PASS` + `1 FAIL` step + footer `FAIL composition-smoke`, 0 `SKIP`; the FAIL line is `client plugin (packages/client): built entry is missing — run \`pnpm build\` first (a missing artifact is a failure, never a skip)` |
| classifier suite, never-built tree | `54 passed (54)`, live leg printing its tree state |
| **gate suite, never-built tree** | **`1 failed \| 24 passed (25)`** — the composition leg, red by design, with the disclosure on stderr |
| gate + classifier, tree C (entry removed) | `1 failed \| 24 passed (25)` / leg red; verdict `failed` over 399 siblings |
| gate, tree E (output moved off-path, gitignored) | `1 failed \| 24 passed (25)`; `check:artifacts` still `OK: 1508 files` |
| gate + classifier + instrument, healthy tree | `25 passed (25)` / `54 passed (54)` / exit 0 |

**Two reconciliations, because two of these numbers moved or disagreed with the bar it was quoted
against.**

- **Fence: 750 → 751, and 748 → 751 overall.** The review's number (750) was right for the tree it
  was taken in; this round added `scripts/lint-identities.d.mts`, which the fence's own
  `isScanScopePath` accepts (`scripts/`, code extension), so the count moved again by exactly one.
  §7 names all three files and shows the per-head counts; the p4t6 total stays **1029** in the same
  breath because its scope is the nine `packages/**` trees and this lane added no test file.
  The lint universe moved the same way for the same reason (`1104 → 1105`), and the F6 census now
  reads `1105 of 2418` where §12 quotes `1104 of 2417` — one file, this round's sidecar, both
  numbers true of the moment each was printed.
- **"11 PASS + exactly 1 FAIL" vs the measured `10 PASS + 1 FAIL step + footer FAIL`.** There are
  **11 steps** in a healthy tree (2 plugin-target arms + 9 `check:artifacts`-id composition steps),
  and the footer is a twelfth `PASS`/`FAIL` line, not a step. A healthy tree therefore prints 12
  `PASS` lines (11 steps + footer) and a never-built tree prints 10 `PASS` plus a step `FAIL` plus
  the `FAIL` footer: reading the bar as "11 PASS plus a failure" counts the footer twice. What
  matters — and what the bar was really reaching for — holds exactly: **exactly one
  step fails, the footer is `FAIL composition-smoke`, nothing is skipped, and the gate leg is red in
  the same tree.** Recorded here rather than smoothed over, because the count is the thing a reader
  checks, and `grep -c '^PASS'` on a never-built run answers 10 whether or not anyone expects it.
  For the same reason: `tail -1` of a `2>&1` capture of that run is `Node.js v24.21.0`, the throw
  banner from `scripts/composition-smoke.mjs`, which is why nothing in this lane decides anything
  from the last line of a transcript.
- Residue at handover: `packages/testkit/test/.tmp-fault/` was left by a completed 7.5 run (normal,
  gitignored, and the exact tree §13 excludes from lint); everything else is the evidence set below.

## 15. Three instrument-shape discoveries, none of which the review asked for

All three are recorded because they are the class of bug this lane exists to catch; in the first the
victim was this round's own new code, and in the third it was this round's own verification commands.
Transcripts: `review-round-eslint-instrument-shape.txt`, `review-round-eslint-argv-invocation.txt`,
`review-round-confirmation-at-67689c7c.txt`.

1. **A detector test that invents its instrument's shape is worse than no test.** The F6 leg
   counts files eslint reports as ignored. Written against a message object recalled from memory —
   `ruleId` absent — it matched **nothing**: the real entry is `ruleId: null, fatal: false,
   severity: 1, nodeType: null` with a message far longer than the folklore version, and
   `entry.ignored` is `undefined` on these entries, so the text is the only marker. The first live
   census therefore printed `1313 are hidden`… no: it printed **`0 are hidden`** over 2417 tracked
   lintable files while 1313 were unread, and the leg went **green**, because an empty `unexpected`
   list over an empty `hidden` list is a passing assertion. The synthetic pin did not catch it,
   because the pin shared the fiction. Both halves now carry the captured object, and the pin's
   comment says which transcript it was copied from. A green whose detector is blind is the exact
   failure mode §7 was written to prevent, re-manufactured inside the fix for it.
2. **A CLI that runs on import is not a library.** Reaching the unexecuted `describeStderr` arm
   meant importing `scripts/lint-identities.mjs` — whose entire CLI body sat at module scope. An
   import would have launched a repository-wide ESLint scan inside the vitest worker and inherited
   `process.exit(2)`. The body is now `runCli()`, called behind `invokedDirectly` (`resolve(argv[1])
   === fileURLToPath(import.meta.url)`), measured inert: importing takes 1 ms, exports four names,
   prints nothing; `node scripts/lint-identities.mjs --diff …` still answers `new 0, resolved 0`.
   Adjacent, and part of the same lesson: `npx eslint <2418 paths>` exits **249 in 240 ms having
   written nothing** (npm never starts eslint at that argv size; the same list through the bin is
   exit 1 in 9.3 s with 3 754 774 bytes of JSON), and eslint **de-duplicates** repeated paths, so a
   report can legitimately be shorter than its argv — which is why the census refuses on a count
   mismatch against its own candidate list rather than trusting any count it did not construct.
3. **The same bug, committed twice by me, while writing this report.** The first confirmation run at
   the receipts head invoked `scripts/a4-evidence-provenance.mjs`, which is not what this repository
   calls the fence (`scripts/verify-blueprint-version-clean.mjs` is). Node answered
   `MODULE_NOT_FOUND`, exit **1**; `cmp` of the two runs said **byte-identical**; and exit 1 plus
   byte-identity is precisely what the fence's standing `dirty-or-unknown` red looks like. Both files
   were 18-line stack traces. Second misfire: the wrapper path typed as `…-clean.test.mjs` instead of
   `…-clean.test.ts`, and **vitest ran the single file that existed and reported `Test Files 1 passed
   (1)` / `Tests 10 passed (10)`** — a green over half of the 68-leg pair, no error, no warning. The
   corrected run is `2 passed (2)` / `68 passed (68)`; `review-round-confirmation-at-67689c7c.txt`
   carries both misfires in its own header rather than only the corrected numbers. Neither would have
   been possible inside the gate: a leg parses a report and refuses on a missing one. But a battery is
   a pile of ad-hoc commands, and an ad-hoc command has no contract to violate — so the defense has
   to be the habit of printing the instrument's **identity** and its own denominator on every line
   (`scanned-in-scope:`, `universe:`, `N of M`, per-arm `PASS` lines) and quoting §14's numbers with
   the command that produced them. A number with no command next to it is where this round started.

## 16. What this round does not claim, and the files it touched

Not claimed, still, after F1–F6:

- An output built and then **moved outside its declared root** is still undetectable from inside
  that root. Tree E is now red because the arm had to run, not because anything recognised the
  move; the refusal says so in the sentence the reader acts on. If a future tree needs to detect
  the move itself, it needs a build-residue signal this repository does not have (§12 F1), and
  inventing one would be manufacturing belief.
- A **consistent arm deletion** still stays green by design (the 7-6 accepted residual). Nothing
  here reads `REQUIRED_CHECK_IDS` against a second source; the gate asserts that every arm the
  instrument reports is understood, and that the closure-gated arm ran.
- `check:artifacts` (`OK: 1508 files`) compares the two committed install surfaces and **cannot see
  `packages/client/dist` at all** — tree E prints its green `OK` over a tree whose entire client
  build has been relocated. That blindness is upstream of this change and unchanged by it; F1 had
  to land in the gate for exactly that reason.
- `pnpm run lint` is still exit 1 with `160 problems (128 errors, 32 warnings)` as a standing
  repository condition. §7.6's measure is the identity **diff** against the named baseline
  (`new 0, resolved 0`), which is what makes a tree-wide warning backlog compatible with a leg that
  can actually go red.
- No retry was added anywhere, in this round or the last one. The lint leg fails with a cause.

| file | this round's change |
| --- | --- |
| `packages/testkit/test/a4p7-merge-gate.test.ts` | composition leg asserts `owed === 'passed'` (F1) and writes its reason to stderr; `expectation()` deleted; closure leg asserts `not.toBe('passed')`; classifier reads verdict + machine lines from **stdout only**, stderr into `why` (F4); `unexplained` lead-in and mixed-tree assertion follow F2's wording; new F6 census leg + `lintVisibilityCandidates()`/`classifyLintVisibility()` with a captured-object pin; `describeStderr` leg; `RATIFIED_INVISIBLE_PREFIXES` derived from `INSTALL_SURFACES`; the doc-comment-closes-itself trap recorded at `RATIFIED_INVISIBLE_PREFIXES` |
| `scripts/a4-artifact-provenance.mjs` | refusal text bounded (F2); `treeShape` counts and names its populations, `UNREADABLE` when git is silent (F3); `assertRepoRootIsToplevel` guard (nit); header records the fifth case and why the clone/worktree asymmetry was rejected |
| `scripts/a4-artifact-provenance.d.mts` | `@throws` on `artifactProvenance`; `treeShape` doc naming what it counts |
| `scripts/lint-identities.mjs` | `describeStderr` extracted and exported; CLI body wrapped in `runCli()` behind an `invokedDirectly` guard |
| `scripts/lint-identities.d.mts` | **new** typed sidecar so §7.6 can import the instrument instead of re-implementing its notion of an identity |
| `eslint.config.mjs` | `'**/.tmp-fault/**'` → `'**/.tmp-*/**'`; the unreproducible `62 identities` paragraph replaced by the four measured cases and the correction that they supersede it |
| `dev/agent-workflow/evidence/a4-pr7/instrument-tree-shape/` | §§5–8 corrected and labelled by base; §§12–16 added; transcripts `review-round-merged-head-before-fix`, `review-round-confirmation-at-67689c7c`, `review-round-f1-gate-across-trees`, `review-round-verdicts-battery-and-f5-ab`, `review-round-f5-narrow-and-root-case`, `review-round-f5-f6-first-measurements`, `review-round-eslint-instrument-shape`, `review-round-eslint-argv-invocation`, `review-round-battery-at-992b416b`, `reproduce-off-path-output.sh` |
