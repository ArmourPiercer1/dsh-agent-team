# A4-PR7 Task 7.6 — the code merge gate, as a spec the suite runs

Lane: `test/a4-pr7-76-gate` (single-task writer). Base: `79aeddb2` (master, after PR #131), **rebased twice**: onto `ff9218a3` for
delivery, then onto `fe7e40f4` for the review fixes (§15). — 24 commits landed underneath this lane while it
was written, two of which changed instruments this gate reads (§14 records what moved and
what was re-measured; `79aeddb2`-era captures are kept, not rewritten).
Authority: `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md`
§7.6 (lines 853–866) plus amendment 7 (line 988); `dev/agent-workflow/graph.yaml` for scope.
Coordinator's ruling for this round (2026-10-08) fixes the three shapes §4 below.

## 1. What landed

| path | what |
| --- | --- |
| `packages/testkit/test/a4p7-merge-gate.test.ts` | the gate: 20 tests that drive the real commands. New. |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | the scannable-file ledger increment: one new lane list + its own tie (§9). |
| `dev/agent-workflow/evidence/a4-pr7/7-6-merge-gate/` | this file and the captures it cites. |

No script was added. Plan §7.6's legs are driven from a `packages/testkit/test/` spec, so
`pnpm test` runs the merge gate; the plan's §7.5 lesson — ADR A5-9's precedent
`verify-zero-core.mjs`, "a script no test calls is not a gate" — is why the form matters
more than the content. A test in this file (`the gate is wired, not remembered`) now
machine-checks that lesson for the four instruments §7.6 names, so the same rot cannot
re-open silently.

Cost added to the suite: **30.6s** (pre-rebase `spec-two-runs.txt`: `17 passed` / `30.50s`,
then `17 passed` / `30.53s`; at `ff9218a3` `18 passed` / `30.60s`; at `fe7e40f4` with the
review fixes `20 passed` / see `post-fix-verification-fe7e40f4.txt` V1–V2). Typecheck 9.4s, lint identity 9.6s, client lane 7.5s, the rest
under 2s. The three mutations the gate performs on the tree (hide the built client entry;
hide one hoisted package; scratch dir for the non-repo leg) are restored in `finally`
and asserted restored — `check:artifacts` and `smoke:composition` both green afterwards
(`base-control-and-outer-legs.txt` O2–O5).

## 2. Three outcomes, because a subprocess has three answers

`runLeg()` returns `passed` | `failed` | `refused`, and `refused` always carries the
sentence that explains it. The runner refuses three things by itself: the command is not
there (`ENOENT` — literally the `verify-zero-core` shape), the child was killed by a
signal, the child hit its own timeout. Everything else goes to the instrument-specific
classifier, whose contract is that "nothing I can read" is `refused`, never `passed`.

Two measured incidents, one in each direction, are the reason this is a type and not a
comment:

- **a SKIP that exited 0.** `pnpm smoke:composition` on the base of this lane printed
  `SKIP client plugin (packages/client): host module closure unavailable — 17
  unresolvable: …` and exited **0**. `classifyCompositionSmoke` therefore treats a SKIP
  as `refused` and quotes the line plus the exit code it came with, and one test pins
  exactly that shape without touching the tree (`treats a step that did not run as a
  failure that says why, even at exit 0`).
- **a clean that saw nothing.** See §5.

The mirror case is pinned too: a *missing* built artifact is a **failure**, never a skip
(`FAIL client plugin (packages/client): built entry is missing — run 'pnpm build' first
(a missing artifact is a failure, never a skip)`), measured by hiding
`packages/client/dist` in this worktree and re-running the gate.

Both real mutations are exercised, not described:

| mutation | gate's answer | read as |
| --- | --- | --- |
| `packages/client/dist` hidden | `FAIL client plugin (packages/client): built entry is missing …` | failed |
| `node_modules/.pnpm/node_modules/clsx` hidden | `SKIP client plugin (packages/client): host module closure unavailable — 1 unresolvable: clsx` | refused |
| both restored | `PASS composition-smoke`, 11 step lines, none skipped | passed |

## 3. Green is asserted as: every arm by name, no skip, unqualified footer

`PASS composition-smoke` must be the *unqualified* footer (the historical one carried
` — 1 step NOT RUN and NOT passed: …`), no line may match `^SKIP `, no `NOT RUN` may
appear anywhere, and every expected arm must have its own `PASS` line. The step-line count
is additionally checked against `PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length`, the
relation the gate's own header documents — derived, never a literal 11.

`12a76047` (landed during this lane's work, the split-out half of amendment 7) made a SKIP
cost the *run*: a skipped client step now prints `FAIL composition-smoke — 1 step NOT RUN
and NOT passed: …` and exits 1. That is why the classifier separates the footer from the
steps: the footer is a line *about* the run, and reading it as an ordinary `FAIL` step line
would report "a step failed" where the truth is "a step never ran". The distinction is
asserted by name in `refuses the leg, by name, when the host module closure cannot be
traversed`, whose failure text quotes both the SKIP arm and the footer and reads neither as
a verdict.

## 4. The three shapes this gate may never assert, and what replaced each

| forbidden | why (measured) | what the spec does instead |
| --- | --- | --- |
| an exit code alone | it was `0` while the client leg skipped | exit codes go into failure text only; no assertion keys on one. `smoke:composition`'s own exit code is captured in `base-control-and-outer-legs.txt` O5 explicitly marked "never the basis of a claim" |
| a literal arm count | 11 arms today (2 plugin legs + 9 bundle arms), derived from the two lists the gate runs on | plugin legs come from `import { PLUGIN_TARGETS } from 'scripts/composition-smoke-targets.mjs'` and bundle arms from `REQUIRED_CHECK_IDS` — the same two frozen lists `composition-smoke.mjs` iterates and prints from. A dropped arm fails by name; an added arm is required automatically; renaming an id fails on both sides. A `const targets = [` **source parse** stood here first and `12a76047` moved the table out of that file, which is how an empty derivation would have quietly emptied the loop consuming it; the helper now throws on a zero-length derivation instead (§7) |
| "the root suite covers the client lane" | root `vitest.config.ts` includes `packages/*/test/**/*.test.ts`; the 29 tracked `*.client.spec.ts(x)` files at this commit (24 `.tsx` + 5 `.ts`; `a4-client-baseline/README.md` recorded 27 at its own commit) cannot match it | one test derives that invisibility from the config text and the directory listing; the lane is then run for real (`pnpm --filter ./packages/client run test`) |

Client closure is asserted as a **name set**, per plan wording: every reported failure
must be one of the three disclosed tests in
`dev/agent-workflow/evidence/a4-client-baseline/README.md` (or the disclosed,
location-dependent `s3-client-generation-spike.test.ts`, which collects in a worktree and
fails in the main checkout — the same README records that). The guard is
two-directional: failures outside the set fail the gate, and failures *reported while
none of the disclosed names matched* also fail it, which is what stops the name set from
silently becoming vacuous after a rename. Current measurement:
`Test Files 2 failed | 53 passed (55)`, `Tests 3 failed | 877 passed (880)`, trio matched
3/3.

## 5. Measured defect, filed — and since fixed upstream: the fence reported `clean` from a subdirectory

**Status at delivery: CLOSED.** Filed here against `79aeddb2` (text below, unedited, because
it is the measurement that produced the fix); the fence lane landed the fix in the 24
commits this lane rebased over, and `ff9218a3` measures as follows:

```
$ cd <repo>/packages/testkit && node ../../scripts/verify-blueprint-version-clean.mjs
RESULT not-run :: cwd <repo>/packages/testkit is not the repository toplevel (<repo>);
                 the fence gates on the WHOLE tree — run it from the toplevel   (exit 2)
```

— i.e. the shape suggested below (`not-run` naming the cwd and the toplevel) is what
shipped, and the suggestion's `--allow-subtree` escape hatch was not needed. Two promises
are now asserted separately by the same test: the instrument refuses (`RESULT not-run`, and
no `verdict: clean` line), **and** this gate would refuse even if the instrument stopped to
(`classifyFenceRun` still refuses any run whose cwd is below the toplevel, before reading a
verdict). Defence in depth is the point of keeping the second half after the first landed.

The toplevel output also moved to a new contract, which this leg now reads: scope is a
directory whitelist (`tests/kits/`, `scripts/`, `packages/**/harness/`, `packages/*/test/`,
…), the universe is printed (`scanned-in-scope: 747 tracked files` — asserted non-zero
here), unknowns are adjudicated through a committed ledger
(`…/a4-pr7/scan-scope/unknown-adjudications.json`, 24 entries) instead of a deferral list in
the wrapper, so the classes are `dirty(120 files, 259 sites)`, `unknown(0)`,
`advisory(12)`, `refused(52)`, `prose(5)`, `adjudicated(16 files, 24 sites)` and the verdict
stays `dirty-or-unknown` at exit 1 by design until the adjudication ledger drains.

**The third instance of the same class is still open and is mine to file:**
`scripts/check-artifacts-committed.mjs` has `const ROOT = process.cwd()`, so from
`packages/testkit` it prints
`ERROR: packages/runtime/dist missing — run \`pnpm build && pnpm build:composition\` first.`
and exits 1. It refuses — nothing is compared, and this gate reads `refused`, never `passed`
— but it **misdiagnoses**: the surface is built, the cwd is wrong. Its own new `NOT-RUN:`
branch (from `0a4f5029`, which closed the empty-produced-set hole with exit 2) names
"the cwd is not the repo top-level" as cause (1), so the owning lane already knows the
class; what is missing is that the earlier `missing` branch cannot see it. Suggested shape:
compare `process.cwd()` with `git rev-parse --show-toplevel` at startup and prefer a
`NOT-RUN :: cwd … is not the toplevel …` message over the build hint. The leg
`a check:artifacts run from a subdirectory is refused, never an OK over nothing` pins today's
refusal so a fix cannot regress into a silent pass, whatever message it adopts.

Everything below is the original measurement, kept as filed.

`scripts/verify-blueprint-version-clean.mjs` and its wrapper
`packages/testkit/test/a4p7-blueprint-version-clean.test.ts` are **off-limits** to this
lane (under review), so this is a report, not a change. Measured at `79aeddb2`:

```
$ cd <repo> && node scripts/verify-blueprint-version-clean.mjs | grep ^RESULT
RESULT dirty(120 files, 259 sites)
RESULT unknown(16 files, 24 sites)
…
RESULT verdict: dirty-or-unknown …            (exit 1)

$ cd <repo>/packages/testkit && node ../../scripts/verify-blueprint-version-clean.mjs | grep ^RESULT
RESULT dirty(0 files, 0 sites)
RESULT unknown(0 files, 0 sites)
…
RESULT verdict: clean (dirty 0, unknown 0)    (exit 0)

$ cd <non-repo> && node <repo>/scripts/verify-blueprint-version-clean.mjs | grep ^RESULT
RESULT not-run :: git ls-files failed (status 128): fatal: not a git repository …
```

`git ls-files` enumerates the current directory and below: **52** tracked files from
`packages/testkit`, **15 870** at the toplevel. So the scan sees 0.3 % of the tree and
returns the verdict for a clean repository, with exit 0. The non-repo case is already
handled correctly (`RESULT not-run`, exit 2 — that discipline is what this spec's fence
leg copies). The subdirectory case is the second mistake of this phase measured once
each: *"cwd is not a repository"* was already caught; *"cwd is a subdirectory"* is not.

This matters beyond the fence because the fence is the instrument §7.6 closes on: any
lane that runs it from where it happens to be standing gets a green it did not earn. It
is also exactly the class the coordinator stated as doctrine — *an instrument that cannot
see the tree must refuse rather than report clean*.

Suggested shape for the owning lane at the time (not applied here; the shipped fix is
slightly stronger — it compares the cwd to the toplevel rather than only refusing a
strictly-below cwd, and does not need the escape hatch): resolve
`git rev-parse --show-toplevel` and refuse with `RESULT not-run :: cwd <x> is below the
toplevel <y>` unless `cwd === toplevel`; a `--allow-subtree <path>` escape hatch can stay
explicit if some caller genuinely wants a subtree scan.

What **this** gate owes, and does: `classifyFenceRun` refuses any fence run whose cwd is
below the toplevel, before it will read a verdict line, and the test
`will not accept a run from below the toplevel as a whole-tree clean` asserts that against
the real command — it fails if the fence is ever believed in that position, and it will
still pass after the owning lane fixes the script (the assertion is about what this gate
accepts, not about what the fence prints). The dependency is marked in §10.

## 6. Suite-health finding: `p6t1-parallel` has three load-sensitive identities

`pnpm test` at head produced **25** identities; the same command, same tree, minutes
later produced **22**, and the base control (this lane's two writes removed) produced
exactly the same 22:

| capture | identities | failing tests | collection files | vs base |
| --- | --- | --- | --- | --- |
| base (lane's writes removed) | 22 | 19 | 3 | — |
| head, run 1 | 25 | 22 | 3 | **+3** |
| head, run 2 | 22 | 19 | 3 | **0** |

The three are all in `packages/runtime/test/p6t1-parallel.test.ts`
(`P1: N=2 same-template parallel activations both succeed …` ×2 and
`P3: the quota race — five parallel, two may admit (no over-create) …`), which passes
9/9 when run alone (`p6t1-parallel-load-flake.txt`). So this lane adds **zero** new
failing identities — proven twice: head-run-2 vs base is byte-equal, and head-run-1's
extra three did not survive a re-run of the identical tree.

After the rebase the same experiment was run again, on the new base, and it says something
stronger: `ff9218a3` without this lane's two writes produced **26** identities, and the same
tree with them produced **23** — `new 0`, with three identities present at base and absent at
head (`root-identities-76base-ff9218a3.txt` vs `root-identities-76head-ff9218a3.txt`, diff in
`outer-legs-and-base-control-rebased-ff9218a3.txt` R3). The removed three were one
`p6t1-parallel` identity (the same flake group, this time *disappearing* rather than
appearing) plus `a4p7-blueprint-version-clean.test.ts` and `rc2-kit-preset-seam.test.ts`
legs that did not reproduce — so the flake group moves in both directions and none of the
movement belongs to this lane. **The claim this lane makes is exactly one: zero new failing
identities.** It makes no claim to have fixed anything, and the three that vanished are not
receipts for anything.

Worth saying plainly rather than burying: this gate spawns children (tsc across 8
packages, eslint over the repo, a nested vitest), and the three flaky identities are
quota/concurrency assertions in the runtime suite. This lane did not cause them at the
identity level, but a heavy in-suite leg is exactly the CPU pressure this class of test
is sensitive to, and four lanes share this machine. If the reviewer wants the pressure
off the runtime suite, the shape is a `fileParallelism` group or moving the three heavy
legs behind an explicit gate run — a decision for the coordinator, recorded here rather
than taken silently. Also worth a look by whoever owns `p6t1-parallel`: a test that
passes alone and fails under load is a scheduling hazard for every lane, not just this
one.

## 7. What the gate caught while it was being written (all real, all mine)

1. **A new lint identity.** The first version tripped `no-regex-spaces` in my own
   `compositionTargets()` parser. `lint-identities --diff` reported `161 identity lines,
   77 distinct … new 1` — the leg was right, the file was wrong. Fixed (`/\n {2}\{\n/`);
   back to `160 identity lines, 76 distinct … new 0, resolved 0`.
2. **Two TypeScript errors** in my own classifier signatures, caught by the spec's own
   typecheck leg (`pnpm -r run typecheck` reporting the testkit package as `Failed`)
   before I had written a receipt for it.
3. **A vacuous client comparison.** The first client leg read only `stdout`; vitest
   writes its report to `stderr` and pnpm prefixes it, so the lane looked green on an
   empty failure set. The rewrite reads both streams and refuses when neither carries a
   summary line, and the drift guard in §4 is there specifically so this failure mode
   cannot come back as a pass.
4. **A `spawnSync` runner that could not tell slow from wrong.** Because it blocked the
   worker thread, the 5 000 ms vitest timeout could only fire *after* the child exited,
   so a leg that had just gone green was reported as `Test timed out in 5000ms` — the
   same inability to distinguish "did not finish" from "failed" that §7.6 exists to
   remove. The runner is async now (`runLeg`'s comment records the measurement).
5. **An arm list that quietly became empty — in my own gate.** The arm derivation first
   parsed `const targets = [` out of `composition-smoke.mjs`. `12a76047` moved that table
   to `composition-smoke-targets.mjs`, the slice matched nothing, and on the first version
   of the helper the consumer loop would simply have iterated over nothing: a green
   composition leg with **zero** plugin arms required. That is the same shape as the fence
   reporting `clean` on 0.3 % of the tree, produced here by my own instrument rather than
   somebody else's. A non-emptiness guard went in before the rebase (it is what turned the
   drift into a loud failure instead of a silent pass); the fix after the rebase was to stop
   parsing and import the frozen `PLUGIN_TARGETS` the gate itself iterates.
6. **A fence leg written against a script that had moved on.** My toplevel leg enumerated
   the RESULT classes as they printed at `79aeddb2`, and my subtree leg asserted
   `/RESULT (dirty|verdict)/` — reasonable when the script returned a verdict from a
   subdirectory, wrong once it returns `not-run`. Both were staleness in my file, not in
   the fence; both now assert the shipped contract, including `adjudicated` and a non-zero
   `scanned-in-scope` (§5).

## 8. Derivations, so "never a hand-written number" is checkable

| quantity | derived from |
| --- | --- |
| expected plugin legs + expected plugin names | `import { PLUGIN_TARGETS } from '../../../scripts/composition-smoke-targets.mjs'` — the frozen table the gate itself iterates; a zero-length derivation throws rather than emptying the consumer loop |
| expected step-line count | `PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length`, the relation `composition-smoke.mjs`'s own header documents |
| expected bundle arms | `import { REQUIRED_CHECK_IDS } from '../../../scripts/composition-smoke-bundle.mjs'` — the same list `renderSurfaceStepLines` prints from |
| expected typecheck packages | `packages/*/package.json` manifests that declare a `typecheck` script (8 today); each must report `typecheck: Done`, and a declared package that never reported is `refused`, not absent |
| artifact count | the `OK: <n> files` line of the run; `n > 0` is asserted, the value is never written here |
| client-lane invisibility | `vitest.config.ts` include pattern + the `packages/client/test` directory listing |
| fence universe | `git ls-files` counts at the cwd and at the toplevel (with `maxBuffer` explicit — the 1 MB default truncates this repository's list, which is itself a small-universe trap) |
| p4t6 total | the scanner's own count, plus the named per-lane lists (§9) |

## 9. The `p4t6` increment

Adding one scannable file under `packages/**` moved the derived total; the RED capture is
kept, not hidden: `p4t6-PRE-EXTEND-RED.txt` carries **both** captures — the one taken on this
lane's original base (`AssertionError: expected 1025 to be 1024`, after the file existed and
before any list named it) and the one taken after the rebase
(`AssertionError: expected 1025 to be 1026`, with the tie already written and the spec file
absent from disk; each endpoint a measurement, not an inference).

The increment follows the form the file already uses for a lane that is not a numbered
PR (`SCANNED_PATHS_A4F1`, `SCANNED_PATHS_A4SURFACE`): a **new lane list**
`SCANNED_PATHS_A4P76GATE` naming the one path, added to both derived sums and to the
by-path presence loop, plus **its own tie**, which after the rebase reads
`expect(SCANNED_PATHS_A4P76GATE.length).toBe(1026 - 1025)`: master measured 1025 with the
`SCANNED_PATHS_A4ARTIFACTS` list that merged underneath this lane, and 1026 with this lane's
gate spec added. `SCANNED_PATHS_A4PR7` and its `1021 - 1016` tie were deliberately **not**
touched, and neither was the merged `A4ARTIFACTS` `1025 - 1024` tie: each tie's endpoints are
that lane's own advancing total on the branch where it landed, and renumbering a tie to make
two ladders look sequential is the one edit the file's comments forbid. The rebase conflict
was exactly this file (both lanes inserted a list at the same place): resolved by keeping
**both** lists in both sums and both presence loops, so the merged total is derived from the
union and each lane keeps its own tie. No total is written by hand anywhere, and no number
appears in prose. `p4t6` after the increment: `10 passed (10)`.

A second test in this file asserts that this spec is still named in that list, so a
rebase that silently drops the lane entry reddens the gate instead of quietly lowering
the scanner's total for the next reader.

## 10. Cross-lane dependencies, marked rather than reached into

| dependency | who owns it | how this gate handles it |
| --- | --- | --- |
| fence closure condition ("no unadjudicated `dirty`, no unadjudicated `unknown`") — today `dirty(120)/unknown(16)` are adjudicated by the deferral list inside `a4p7-blueprint-version-clean.test.ts` | the fence-wrapper lane (in review) | this leg asserts the RESULT **shape** only: every class reported, the offending set enumerated by path, `not-run` never clean, a `clean` verdict contradicted by its own counts is a failure. The adjudication judgement is left with its owner; if the wrapper's contract changes, only that dependency moves |
| subdirectory refusal (§5) | the fence lane | **LANDED** (`ff9218a3`): the fence now prints `RESULT not-run :: cwd … is not the repository toplevel …` and exits 2. Both this gate's refusal and the instrument's are asserted (§5) |
| `smoke:composition` exiting non-zero on a skip (split out of amendment 7) | the composition-smoke lane | **LANDED** as `12a76047` while this lane was in flight, and it moved two things under me: the footer now says `FAIL …` on a skip (so the classifier separates footer from step lines, §3), and the plugin table moved to `composition-smoke-targets.mjs` (so the arm derivation became an import, §7 item 5). Re-verified green on `ff9218a3`; still not one assertion on an exit code |
| `hoistPattern: ['*']` in `pnpm-workspace.yaml` + the 17 client `devDependencies` (PR #131) | merged | the closure-break lever hides one hoisted copy and asserts the SKIP names `clsx`; if the hoist declaration is ever removed, that leg fails with its own message rather than silently skipping |
| `scripts/composition-smoke*.mjs`, `scripts/check-artifacts-committed.mjs`, `pnpm-lock.yaml`, `packages/client/package.json` | other lanes / merged | read and imported, never written |

## 11. §7.6 leg by leg

| leg (plan wording) | where it runs | result |
| --- | --- | --- |
| `pnpm typecheck` | **embedded** (derived package set) | 8 packages `Done`, 0 `error TS` |
| changed-file ESLint | outer (`npx eslint <my 2 files>`) | clean; the whole-repo leg below subsumes it |
| full `pnpm lint` as identity diff vs `lint-identities-0237d487.txt` | **embedded** | `160 identity lines, 76 distinct`, `new 0, resolved 0` — on both bases, i.e. the 24 upstream commits did not move the baseline either |
| full `pnpm test` with the baseline-diff gate | **outer** (§12 reason) | run twice, on both bases: `79aeddb2` 22 → 25 → 22, `ff9218a3` 26 (base) → 23 (head). **0 added** by this lane in either; the swing is the `p6t1-parallel` load group (§6) |
| client lane `pnpm --filter @dsh-agent-team/client run test`, closing on the named trio | **embedded** | `3 failed, 877 passed (880)` on every base tried, trio 3/3 by name, nothing outside the disclosed set, and the trio's 2 spec files asserted present (§15 F5 — a green trio is allowed, a vanished one is not) |
| `pnpm build`, `pnpm build:composition` | **outer** (§12 reason) | both `Done`; `git status` afterwards carries only this lane's 3 paths, i.e. the committed surface was already current |
| `pnpm check:artifacts` | **embedded** | `OK: 1508 files … (incl. 1 glue placement(s))`; `OK: 0 files`, the `NOT-RUN:` empty-produced-set line and the `missing` line are all classified `refused` — the first two pinned against the strings the script prints, the third also run for real from `packages/testkit` (§5) |
| `pnpm smoke:composition` (red blocks merge) | **embedded** | 11 arms PASS by name (2 plugin + 9 bundle, both counts imported), zero SKIP, unqualified footer, step-line count checked against the two lists; the three-way mutation matrix of §2 proves the leg can go red |
| `p4t6` recomputation | ledger + **embedded** registration check | §9; `10 passed (10)` on the merged ladder (this lane's list + the merged `A4ARTIFACTS` list) |
| blueprint-version-clean wrapper green | **outer** (their file) + **embedded** fence leg | not among the 23 failing identities at head, i.e. green in the root run; the embedded fence leg covers the cwd doctrine, the `adjudicated` class and a non-zero `scanned-in-scope` |
| targeted acceptance suite `a4p7-v3-cutover-acceptance.test.ts` | **outer** (§12 reason) | `70 passed (70)` |
| ADR + spec `Draft → Accepted` after review | not this lane | docs are coordinator-owned; §12 |
| open A4-PR7 | not this lane | `graph.yaml` is coordinator-owned; §12 |

Per plan line 875: **this gate passing is not Alpha.4 stage closure.** The Alpha.3
nine-step human pass stays `NOT_RUN`, and the acceptance-world evidence
(`dev/agent-workflow/evidence/a4-pr76-acceptance-world/`, another lane's) is untouched by
this lane.

## 12. What this lane could not satisfy, in words

- **The full root `pnpm test` cannot be a leg of itself.** It is the run this spec
  executes inside; spawning it from a test nests another whole suite per level, and
  `scripts/fail-set.mjs` needs a JSON report that only the enclosing run can produce. It
  was therefore run as an outer leg with the base control of §6, and the plan's
  baseline-diff discipline is satisfied there, not in-suite.
- **`pnpm build` and `pnpm build:composition` stay outer.** They write into the working
  tree, including the *committed* install surface `packages/client/composition-shim`. A
  test that rewrites committed files while three other lanes are running their suites in
  their own worktrees is a race this phase has already been bitten by once (the S5a
  pre-placement-glue FATAL is the same file family). What *is* embedded is the check they
  exist to satisfy — `check:artifacts` — plus the assertion that a not-built surface
  reads as `refused`.
- **The targeted acceptance suite and the fence's own wrapper test** are root-suite
  content: they run with `pnpm test`, so embedding them again is duplication, and
  reaching into `a4p7-blueprint-version-clean.test.ts` to assert its deferral list would
  be reading another lane's in-flight contract. Both are reported from the outer run
  instead (`70 passed`; wrapper absent from the failing-identity set).
- **No booted-host leg was executed.** Nothing in §7.6's list requires one; the booting
  legs belong to §7.4 and the acceptance world, and the coordinator's standing
  instruction for this lane was "boot nothing, ports 31xx stay clear". For completeness:
  this machine also lacks `tests/deepseek-harness-test-use/packages/cli/dist`, the
  Playwright browser cache is empty and there is no `chrome` binary, so those legs would
  be `NOT_RUN` here regardless — the same disclosure the kit lanes file.
- **The ADR/spec status flip and the `graph.yaml` A4-PR7 entry** are not this lane's to
  write: `docs/**` and `SESSION_ROUTER_LOG.md`/`graph.yaml` are coordinator-owned.
- **The fence's subdirectory defect (§5) was filed, not fixed** — the file belongs to
  another lane — and was **fixed by that lane** during this work, which this lane then
  verified rather than claimed. What remains open in §5 is the sibling misdiagnosis in
  `check:artifacts` (a wrong cwd reported as "run `pnpm build` first"), also another
  lane's file, also filed with a suggested shape.

## 13. Reproduction

```bash
# the gate itself (two consecutive runs are in spec-two-runs.txt)
npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts

# outer legs + the base control that attributes the baseline diff
bash reproduce-outer-legs.sh                # O1..O13, B1..B4 in base-control-and-outer-legs.txt

# the load flake
npx vitest run packages/runtime/test/p6t1-parallel.test.ts          # 9 passed alone

# the same verification re-run on the rebased tree (R1 base capture, R2 head capture,
# R3 attributable diff, then O1..O13). This is the literal driver as executed, absolute
# scratch paths included — it moves a file and swaps one file against `origin/master`'s
# copy, so read it before running it.
bash reproduce-rebased-verification.sh      # -> outer-legs-and-base-control-rebased-ff9218a3.txt
```

## 14. Rebase log: what moved underneath, what was re-measured

24 commits landed between this lane's base (`79aeddb2`, PR #131) and its delivery base
(`ff9218a3`, PR #139). Two of them changed instruments this gate reads, one changed the
contested ledger file, and one closed this lane's filed finding:

| upstream commit | what it did | effect on this lane |
| --- | --- | --- |
| `12a76047` | a SKIP now fails `smoke:composition` (exit 1, footer `FAIL …  NOT RUN …`); plugin table split into `composition-smoke-targets.mjs` | classifier separates footer from step lines (§3); arm derivation became an import and its empty-derivation guard fired (§7.5); arm/step assertions unchanged in kind |
| `0a4f5029` | `check:artifacts` refuses an empty produced set with `NOT-RUN:` at exit 2; `p4t6` +1 via `SCANNED_PATHS_A4ARTIFACTS` | new `refused` branch pinned against the shipped string; **the only merge conflict** this lane hit, resolved by keeping both lane lists (§9) |
| the fence-lane revision inside the same range | subtree runs refuse with `RESULT not-run :: cwd … is not the repository toplevel`; scope whitelist, `scanned-in-scope`, `adjudicated` class, committed adjudication ledger | §5's finding closed; fence leg updated to the new contract (§7.6) |

Re-measured on the rebased tree, all in
`outer-legs-and-base-control-rebased-ff9218a3.txt`: gate `18 passed (18)` / `30.60s` (O8);
`p4t6 10 passed (10)` (O9); 7.5 classification suite `53 passed` (O10, was 46 at the old
base — the fence/split lane grew it); acceptance `70 passed (70)` (O7); `build` +
`build:composition` `Done` with `git status` afterwards carrying only this lane's paths
(O1–O3); `check:artifacts OK: 1508 files` (O4); fence toplevel exit 1 by design with every
class printed (O6); lint `new 0, resolved 0` (O11); typecheck 8 `Done` / 0 `error TS`
(O12); client lane `3 failed | 877 passed (880)` (O13); base/head identity diff `new 0`
(R1–R3). Nothing was carried over from the pre-rebase receipts without being re-run.

## 15. Review round 1: four tolerance branches that passed on nothing, and one residual accepted on purpose

The verdict was MERGE-with-fixes, and every fix was the same defect wearing four hats: a
branch written to tolerate a legitimate state that also tolerates the *absence* of the thing
being checked. §5 and §7.5 of this file are the same disease in other people's instruments;
being told I had shipped it myself in the client leg is the correct review.

| id | the tolerance | what it silently accepted | the fix | proof it bites |
| --- | --- | --- | --- | --- |
| **F5** | `0 failures and 0 name matches ⇒ passed` | **deleting the trio's two spec files turned the leg green.** §7.6 closes *on* three named failures, so the cheapest way to satisfy the leg was to erase what it inspects | the two files the trio lives in (derived from `CLIENT_BASELINE_FAILURES`, not a second hand-written list) must be in `packages/client/test`, read **before** the lane runs; a missing file is a `failed` that names it and says what to update. Green with the files present is still tolerated — the trio may be fixed, and a gate that requires failure would block the fix | `review-fixes-F1-F5-bite.txt` §1: with `team-creation-panel.client.spec.tsx` moved out of the tree the live leg printed `Tests 1 failed, 860 passed (861)` (the summary line, with the separator spelled out because a literal pipe would break this table) — the surviving trio file still matched 1 of 3, so the old branch would have called that **passed**; the leg reds with the absence message. Restored, `git status` back to its single modified path, leg green again. Committed teeth: `tolerates a green trio and refuses a vanished one`, 7 report-text cases including green+absent and red+present |
| **F2** | the runner refused only *its own* timeout, while its comment claimed it refused signals | an externally killed child (OOM killer, stray `pkill`, teardown mid-run) that had already flushed a complete report reached the classifier and read **`passed`** | `signal !== null ⇒ refused` before `classify` is ever called, naming the signal and the code | committed leg `a child killed by a signal is refused even when it printed a complete report`: `sh -c 'printf "PASS synthetic-instrument: every arm reported, nothing to see"; kill -KILL $$'` — well-formed flushed output, `SIGKILL`, verdict `refused`, and the `classify` it would have reached returns `passed` by construction to prove the layering |
| **F3** | the plugin half had a non-emptiness tripwire; the bundle half did not | `REQUIRED_CHECK_IDS` resolving to `[]` — 9 of the 11 arms simply stop being required, and every consumer is a `for` loop that stops iterating | `bundleArms()` with the symmetric guard, plus a malformed-entry guard, used at both call sites | `review-fixes-F1-F5-bite.txt` §2: with the import shadowed by an empty list the green leg fails with `bundleArms() derived zero ids from REQUIRED_CHECK_IDS — the bundle half … would stop being required at all`, then the probe is reverted byte-identically |
| **F1** | two registration checks matched raw file text | a **comment** naming the path kept the p4t6 registration green after the array entry — the only part the scanner counts — was deleted; and a comment naming a script kept the "invoked from a test" wiring claim green with nothing invoking it | the p4t6 check now matches inside the `const SCANNED_PATHS_A4P76GATE = […]` literal, as a quoted entry; the wiring check matches only inside the head of a `runLeg(` call, where the argv actually lives | `review-fixes-F1-F5-bite.txt` §3 runs both matchers over three texts each. The honest part: the new wiring matcher **went red on my own file**, because the fence legs passed `[FENCE]` through a constant. The check was right and the indirection was the thing to remove — the three call sites now spell the path, instead of the check being loosened until it stopped meaning anything |

The reviewer's M6b case belongs in this file's terms, not only in the review. Hiding an
arm's `PASS` line *below* a guard that never prints makes the instrument report
green-minus-one at exit 0: the instrument is the thing that cannot see its own absence, and
this spec is the layer that compares its report against what it knows should be there. That
is the whole argument for a second layer, and also the boundary of what the second layer can
do — which is the next section.

### Accepted residual, stated rather than hidden: a consistent arm deletion stays green

If an arm is removed **completely** — the id out of `REQUIRED_CHECK_IDS` (or the target out
of `PLUGIN_TARGETS`), its `record()` call, and its print site — this gate goes green. It
cannot do otherwise: the ruling forbids asserting a literal arm count, and the arm set is
derived from those two lists precisely so that a legitimate arm added by another lane does
not require an edit here. Derivation and a count are the same knob turned in opposite
directions; a gate that requires N arms would also fail every honest change to N. The
F3/plugin tripwires cover the *whole half disappearing* (an empty derivation), not one entry
leaving cleanly, and a clean departure from a list is indistinguishable from an edit that
list's owner is entitled to make.

So the residual is: **this gate cannot see an arm that was never intended to run.** Its
actual protections against that are procedural — `graph.yaml` and plan §7.6 are the record of
what must be gated, the diff of `composition-smoke-targets.mjs` / `composition-smoke-bundle.mjs`
is where such a deletion is visible, and the wiring test (§1) at least guarantees the four
named instruments are still spawned by *something*. If a mechanical tripwire is ever wanted
without a literal count, the shape is a per-arm **identity** pin (the two lists asserted
against named ids recorded in the plan, a set assertion that grows when a lane adds an arm
but fails when one vanishes) — a real option, not taken here because the ruling's letter and
its reason both point the other way, and because inventing it unilaterally would be exactly
the silent re-tightening this phase keeps finding. **Do not summarise this as a strength.**
An instrument that names its blind spot can be reasoned about; one that hides it is how we
kept arriving at greens nobody earned.

### Re-verification at `fe7e40f4`

`post-fix-verification-fe7e40f4.txt`, driver `reproduce-post-fix-verification.sh`: gate
`20 passed (20)` twice (`28.84s` / `28.89s`); `p4t6 10` (no new scannable file, so the total
stays exactly where §9 put it); the 7.5 classifier suite `53`; `pnpm -r run typecheck` exit 0
with 8 `Done` and 0 `error TS`; changed-file eslint exit 0; `lint-identities --diff` `new 0,
resolved 0` — V6's `pnpm run lint` exits 1 on the standing 160-problem repo debt, which is the
number §7.6 measures as an identity diff, not a regression introduced here. The fence run
prints `scanned-in-scope: 745`, every class, verdict `dirty-or-unknown` at exit 1 by design,
with dirty down to `110 files, 213 sites` because the 7.4 C-domain migrations landed while
this lane was in review; my leg asserts the classes and a non-empty universe, not those
counts, so it read the change without an edit. `composition-smoke` measured **without a pipe**:
`exit_code_no_pipe=0`, 12 lines matching the step pattern (11 arms + the footer), `SKIP lines:
0`, `FAIL lines: 0`, footer `PASS composition-smoke`. The acceptance suite now lives at
`packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts` — the 7.4 range moved it out of
`packages/testkit/test`, which is why V9 carries a correction line — and is still
`70 passed (70)`.

The cost decision stands: the ~30 s stays embedded. If load relief is ever wanted the lever is
a dedicated vitest pool for `p6t1-parallel` (§6), not a mutation leg moved back out to a
remembered command line — the mutation legs are this file's evidence that its classifiers are
exercised against a live tree rather than against strings it wrote for itself.

## 16. Merge round: PR #146 would not auto-merge, so the collision was settled here

The reviewed head `013e0800` could not be merged by the coordinator (`the merge commit
cannot be cleanly created`), and the instruction was to **merge** rather than rebase so that
head stays addressable. Master had moved to `e52c0c7a` (#143 7.4 C-domain, #144 7.3
prerequisites, #145 7.4 C-testkit). Merge commit `f7528618`.

One file conflicted: `packages/testkit/test/p4t6-session-event-scan.test.ts`, exactly where
this lane's own §10 predicted it would — both sides appended a lane list after
`SCANNED_PATHS_A4ARTIFACTS`, into both derived sums and the by-path presence loop. Resolution
is keep-both-lists: `SCANNED_PATHS_A4P7PRE` (3 files) and `SCANNED_PATHS_A4P76GATE` (1 file)
both stay, same relative order in both sums and the loop, every lane keeping its own tie;
`A4P7PRE`'s `1028 - 1025` untouched; total still `983 + Σ lengths`, never a written number;
no reflow of anything that did not need to move. The wrapper's `DEFERRALS` block did not
conflict — this lane never edited that file, so no ratchet arbitration was needed.

**The tie arithmetic was re-derived, not copied.** Both endpoints measured
(`p4t6-PRE-EXTEND-RED.txt`): `origin/master` without this lane derives **1028**, this merged
tree derives **1029**, so the tie reads `1029 - 1028`; the ordinary RED with the entry in the
list and the spec file off disk says `expected 1028 to be 1029`. The totals were read off a
deliberate `+1` on the derived sum, because the scanner does not print its count on success.
The comma-operator trap was checked structurally, not by eye: in both sums every term before
the last ends in `+` and only the final term ends in `,`. Repairing my own earlier resolution
turned up the same family in whitespace form — a list entry sharing a line with the closing
bracket — also fixed here, which is worth recording because it lint-passed and typechecked
for two rounds before anyone looked at it.

### The merged tree's numbers, as the candidate's contract

From `merged-head-verification-e52c0c7a.txt` at `f7528618` (driver
`reproduce-merged-head-verification.sh`):

| instrument | what the merged tree prints |
| --- | --- |
| gate spec, twice | `20 passed (20)` / `30.04s`, `20 passed (20)` / `30.27s` |
| `p4t6` | `10 passed (10)`, derived total **1029** |
| 7.5 classifier suite | `53 passed (53)` — in a tree carrying build output; see the caveat below |
| `pnpm -r run typecheck` | exit 0, 8 `Done`, 0 `error TS`, 0 `Failed` |
| changed-file eslint | exit 0 |
| `pnpm run lint` | exit 1 on the standing 160-problem debt — measured by §7.6 as the identity diff below, not as an exit code |
| `lint-identities --diff …0237d487.txt` | `160 identity lines, 76 distinct`, `new 0, resolved 0` |
| `composition-smoke` (exit measured **without a pipe**) | exit **0**, 12 step-pattern lines (11 arms + footer), `SKIP 0`, `FAIL 0`, footer `PASS composition-smoke` |
| acceptance `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts` | `70 passed (70)` |
| fence at the toplevel | exit 1 by design; `scanned-in-scope: 748 tracked files`; `dirty(93 files, 169 sites)`, `unknown(0)`, `advisory(8 files, 12 sites)`, `refused(52)`, `prose(5)`, `adjudicated(16 files, 24 sites)`, verdict `dirty-or-unknown` |

**No count in this lane was edited to get any of that.** The fence leg asserts the *classes*
and a non-empty scanned universe, so the C-domain and C-testkit migrations moved `dirty` from
`120/259` → `110/213` → `93/169` and `advisory` from `12/18` → `8/12` across three rounds and
the leg never changed. Had it pinned a number, this merge would have produced the edit the
design exists to prevent.

**Caveat this lane owns and does not paper over:** the gate spec and the 7.5 classifier suite
were green here because *this worktree carries build residue* (`packages/client/dist` is
gitignored output built in an earlier round; only `packages/runtime/dist` and
`packages/client/composition-shim` are committed). A clean worktree with no build output is a
different question — it is the subject of the task queued behind this merge, and the honest
statement now is that at least two legs of this file (`check:artifacts`, and the composition
arm that reads the built client entry) depend on that residue, so "green" above is green in a
built tree and must not be quoted as green in a clean one.
