# 7.8 — the scratch directory is part of the instrument

Stop-ship finding raised against this lane by the parent agent, measured in a *different*
worktree, closed here. Everything below is a captured line, not a reconstruction.

## 1. The finding, and the part of it that was mine

The parent measured, on `6174f1e5` in the **main** working tree with `.swt/` present:

```
$ node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
lint-identities: universe: 2782 file(s) linted, 1673 of them gitignored (…)
baseline dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt: 76 distinct; new 750, resolved 0
error no-undef .swt/dev/agent-workflow/evidence/alpha4/baseline/fail-set-normalize.mjs
```

751 output lines named `.swt/`; that directory is a registered nested clone, porcelain-clean,
checked out at this branch's rebuild commit `2683653a`, 376 MB. Reproduced independently in
this lane — same three numbers, `.tmp-coord/a4-dist-rebase/lint-with-swt.txt`:

```
lint-identities: universe: 2782 file(s) linted, 1673 of them gitignored …
baseline …: 76 distinct; new 750, resolved 0
LINES_NAMING_SWT=751
```

`.swt/` is not this lane's directory and was not created by this lane's instrument. But the
mechanism the parent named — **a gate that changes another gate's measurement is not a gate**
— applies to my instrument directly, because mine writes a checkout into the working tree on
purpose, and my instrument's own header claimed the place it writes to was
"git- and lint-ignored". That claim was half false, and the false half was load-bearing:

| mechanism | what actually ignores it | tracked? | consequence on another clone |
| --- | --- | --- | --- |
| ESLint / `lint-identities` | `'**/.tmp-*/**'` in `eslint.config.mjs` | **yes** | none — the lint genuinely never saw the scratch |
| `git status` | `.tmp-*` in `.git/info/exclude` | **no** | 376 MB of untracked duplicate source, read as uncommitted work by every `git status --porcelain` assertion in this repository — including the one this lane was told to end its report with |

I added the `.git/info/exclude` line myself, in this lane, three rounds ago, and then wrote a
header sentence generalising from "my machine is quiet" to "the tree is ignored". ESLint does
not read `.gitignore`; git does not read the ESLint config; and `.git/info/exclude` is not
versioned. Three mechanisms, three separate immunities, and I had established one and asserted
three.

## 2. The fix, and the acceptance measurement

The scratch moved to `<checkout root>/.scratch/artifact-at-head/<pid>-<stamp>`, the path is
**exported** (`scripts/artifact-check-scratch.mjs`) so the instrument and the guard leg resolve
it through the same function, and both immunities are now in tracked files:

- `eslint.config.mjs`: `'**/.scratch/**'`, `**/`-prefixed so a scratch inside a task worktree is
  covered from whichever root the scan starts at (the root-anchoring trap that let
  `packages/testkit/test/.tmp-fault/` into the universe is documented two lines above it);
- `.gitignore`: `.scratch/`, with the reason written next to it.

Acceptance, run with the scratch **materialised and populated** (`--keep`, then measured):

```
SCRATCH=.worktrees/a4-dist-rebase/.scratch/artifact-at-head/3-1791432029067
populated size: 1.1G, files: 55941, dist files: 1505

$ node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
lint-identities: universe: 1112 file(s) linted, 0 of them gitignored (…)
baseline dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt: 76 distinct; new 0, resolved 0
LINT_EXIT=0
LINES_NAMING_SCRATCH=0

$ node scripts/verify-blueprint-version-clean.mjs           # same tree, same moment
scanned-in-scope: 756 tracked files
RESULT dirty(6 files, 15 sites)   RESULT unknown(0 files, 0 sites)
RESULT advisory(6 files, 8 sites) RESULT refused(52 files, 115 sites)
RESULT prose(5 files, 5 sites)    RESULT adjudicated(16 files, 24 sites)
```

Universe identical to the scratch-free universe measured inside the leg (1112), `new 0 /
resolved 0`, nothing naming `.scratch/` anywhere in the output, and the six fence tuples
byte-for-byte the ones recorded before the move. The fence is immune by construction rather
than by ignore: it enumerates `git ls-files -z` (its own header: "WHY `git ls-files` AND NOT A
FILESYSTEM WALK"), so an untracked tree cannot enter its scope at any path. `p4t6`'s scanner
walks `packages/` under its own checkout, so a root-level directory is outside its scope, and
it counts what it discovers — a scratch inside its scope would surface as a wrong derived
total, not as silence.

## 3. The leg that keeps it fixed

`a4p7-merge-gate.test.ts` → *"the scratch the commit-level instrument builds cannot change
another instrument's measurement"*, 59.1 s (three `lint-identities` scans at ~15 s each, which
is the price of measuring the universe instead of asserting a constant about it):

1. universe with no scratch → baseline `N`;
2. resolve the path **through `resolveScratchPath`**, plant two probes (one unused binding +
   one undefined call each, so a leak yields two identities and cannot hide in a rounding);
3. assert `'.scratch/'` appears nowhere in the scan output and the universe is still `N`;
4. `git check-ignore -v --no-index` must report the match coming from **`.gitignore:`** — not
   from `.git/info/exclude`, which is the exact bug this leg exists to make impossible:
   `.gitignore:103:.scratch/  .scratch/artifact-at-head/…/planted-a.mts`;
5. `git status --porcelain -- .scratch/**` prints nothing (scoped, so a legitimately dirty tree
   cannot redden it);
6. **control**: the same two probes in a non-ignored path must move the universe by exactly 2.

Teeth, captured in `.tmp-coord/a4-dist-rebase/scratch-leg-RED-no-ignore.txt` — delete the
`'**/.scratch/**'` line from the config and the leg fails where it should:

```
AssertionError: the scratch must not even appear as a gitignored-but-linted file: ESLint does
not read `.gitignore`, so appearing here means the flat-config glob is gone: expected
'lint-identities: 160 identity lines, …' not to contain '.scratch/'
Tests  1 failed | 27 skipped (28)
```

Second leg added beside it — *"a crashed run's scratch is swept, and a live one is not"* —
because "what removes the scratch if the process dies" is a rule and not a promise, and a rule
that is only written in a README is a rule that rots. It runs against a fixture root (the
function deletes; it must not be pointed at the real tree) and pins all four cells of the rule,
plus one cell with the shipped default probe so the injectable one is not the only path anyone
exercises.

The leg found something while being written, which is the useful kind of finding. Its first
version built the fixture around `pid 3`, because a real scratch in this tree was named
`3-…`, and asserted that a young entry with a live pid is protected. In the shell that pid was
alive; inside the vitest worker, `process.kill(3, 0)` returned `ESRCH`, and the leg failed by
sweeping the entry it had just declared untouchable:

```
AssertionError: expected [ '3-1', '3-2', '999999-1' ] to deeply equal [ '3-1', '999999-1' ]
```

Liveness is a property of the caller's namespace, not of the entry, so `sweepStaleScratches`
now takes `isLivePid` and the leg supplies it (`process.pid` for the live cases, `4194303` —
above the usual `kernel.pid_max` — for the dead ones). The default remains the OS. A leg that
asked the environment whether a pid was alive would change colour with the runner, which is the
same defect class as a leg that passes only on the machine that wrote it.

## 4. What removes the scratch, and what happens if the process dies

- Normal path: `cleanup()` in the instrument's `finally` — `git worktree remove --force` (takes
  the registration with it), then `rmSync` for the case where the directory exists but was
  never registered, then `git worktree prune`, then two `rmdirSync` calls that remove the now
  empty `.scratch/artifact-at-head` and `.scratch`. `--keep` deliberately skips all of it and
  prints the exact removal command.
- Crash path (SIGKILL is not catchable): the next run sweeps. A prior run's residue is removed
  when **older than 5 minutes** and its pid is gone, or when **older than an hour** regardless
  of pid. The pid is advisory only, measured: these commands run in PID namespaces, a run
  created a scratch as `3-…`, and the *next* run's `isLive(3)` reported it removable because it
  lives in a different namespace where that pid means something else. So age does the real
  work, and the 5-minute floor — 12× the measured 12–25 s materialisation — is what protects a
  concurrent run. Two concurrent runs in one checkout are tolerated, not supported: if one ever
  outlives the floor, another may sweep it, and that is the trade stated rather than hidden.
- Measured sweep (`removed: [ '3-1', '999999-1' ]`, kept `3-2` live-and-young, `424242-1`
  dead-pid-but-inside-the-floor), and asserted by the second leg.

## 5. Two more instruments that lied while this fix was being made

- **A computed `verdict=ok` exited 1.** The first cleanup used `rmSync(parent, { recursive:
  false, force: true })` on a directory, which raises `ERR_FS_EISDIR`, and the throw came from
  the `finally` — after `main()` had returned 0 and after the instrument had printed
  `DSH-ARTIFACT-VERDICT … verdict=ok compared=1508 drift=0`. Exit code: **1**. The grading was
  right and the report was wrong, which is the inverse of the bug this branch exists to kill and
  the same root cause: reading the exit code as the verdict. `rmdirSync` inside a `try` now;
  re-run gives `verdict=ok compared=1508 drift=0`, `EXIT=0`, 12.2 s, nothing left on disk.
- **An aged fixture that cannot age.** The sweep leg first called `utimesSync(dir, ms, ms)` with
  millisecond timestamps; `utimesSync` takes seconds-or-`Date`, so every "aged" entry landed in
  the year ~55,000 and read as infinitely young. The sweep removed nothing, the ages printed as
  `-220682556.9` minutes, and the leg's *intent* would still have looked satisfied by a passing
  assertion written against the wrong expectation. Fixtures are instruments too.
- **My own control probe.** The independence leg planted **one** control file and asserted the
  universe would grow by 2. It grew by 1, and the instrument was right about its own count
  while I was guessing at it — the same error as a hardcoded leg total, one level down. The
  assertion now reads `before.files + controls.length`.

## 6. Recorded against other names, same species

- Parent's `pnpm -r run typecheck --no-bail` produced four `error TS5023: Unknown compiler
  option '--no-bail'` — the flag reached `tsc`, not pnpm. `0 × error TS` was true of the
  repository and false of the command. Correct form, re-run by the parent: **`pnpm --no-bail -r
  run typecheck`**, exit 0, 0 errors. Any lane quoting typecheck output states the invocation,
  because a wrong invocation produces *plausible* `error TS` lines.
- Parent's `p4t6` extractor invented entries, and their nested clone invented 750 lint
  identities: two measurements wrong for mechanical reasons, both caught by instruments rather
  than by reading.
- `feat/a4-76-ceiling-pin`: `a4p1` auto-merged cleanly into a self-contradicting file, and the
  proof that let it retire a pair of legs was a green run over a golden deliberately tampered to
  all-`f` — `evidence/a4-pr7/7-6-ceiling-pin/a4p1-COUNTERFACTUAL-GOLDEN-TAMPERED.log` reads
  `Tests 20 passed (20)`, and the repaired file fails 3. Green over a tampered fixture and
  green over a stale artifact are the same species of lie; the cure is the same too — the
  instrument must state what it compared, and a leg must be shown to go red on a mutant.
