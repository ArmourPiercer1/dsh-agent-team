# 7.8 — instruments that lied, hazards caught, and what this lane got wrong

Every entry was caught by a measurement, not by reading a claim. Ordered by how much damage
each could do while looking healthy.

## A. Instruments that said something healthy over an unhealthy tree

1. **`check:artifacts`: `OK: 1508 files; committed install-surface artifacts match the fresh
   build`, exit 0 — over a surface no build had produced since 2026-10-01.** The wording is
   the second lie: nothing had freshly built; the sentence means "the working tree equals the
   index", which is true of any tree nobody has built in. If this instrument is kept, the
   sentence should eventually say what it compares (`index == worktree`), because "matches the
   fresh build" is a claim about a build it did not run. This lane did not change it: the
   message is also the string the merge gate greps, and changing two artifacts' contracts
   under a running review is not this lane's call.
2. **`a4p7-merge-gate.test.ts`: 26/26 green on that same tree**, its install-surface leg
   reporting `passed / why: OK: 1508 files`. The gate is not broken — it delegates the
   question and the delegate answers a narrower one. Fixed for the commit-level question by
   the 27th leg (`MECHANISM.md`).
3. **The v3 fence cannot see the shipped surface at all, and its `dirty(6 files, 15 sites)`
   made this lane expect movement that could never happen.** I expected the rebuild might move
   the classes because the stale sites *are* version sites; measured: 0 occurrences of
   `packages/runtime/dist` anywhere in fence output, before or after — `dist/` is excluded by
   scope. The classes being unmoved is therefore evidence about the fence's scope, not about
   the rebuild's harmlessness.
4. **ESLint ignores 753 tracked `dist` files** (the gate's own census line), so the lint
   identity diff would not have noticed the drift either. Three instruments, three structural
   reasons, none of them a bug in the instrument.
5. **The refusal's truncation is a count that is not the count.** In the drifted-unstaged
   state the install-surface leg's message named **12 of the 20** drifted paths, because
   `tail(out)` keeps the last 8 lines. Reading "12" as the drift size would have understated
   the finding by 8. The number of drifts must come from `check-artifacts-committed.mjs`
   itself (21 stderr lines, 20 `C content-drift`), not from the leg's message.

## B. Things that looked like a defect in this lane's own work and were not

6. **`Cannot find package 'yaml'`** at the worktree root *and* from `packages/testkit`. The
   known install-rot symptom fired on a healthy tree: only `packages/domain` and
   `packages/runtime` declare `yaml`, and no `testkit` test imports it. Verified before
   concluding, so no dependency was added — the brief's prohibition on curing a phantom with a
   `package.json` edit is the right one.
7. **`pnpm smoke:composition` prints a stack trace and still passes.** Its run shows
   `bootstrap FAILED: TeamPluginError: dsh-agent-team row config: must be a plain object`
   from `dist/.../host.js:197`, followed by
   `PASS host plugin (packages/runtime): … apply fails loud on degenerate context (ready
   code=TEAM_PLUGIN_CONFIG_INVALID)`. The loud failure is the probe. Exit 0 with 11 `PASS`
   lines and zero `SKIP` lines: the A1.2.7 `clsx` / `@deepseek-ai/dsh-client-ui-primitives`
   cause did **not** reappear, and nothing was added to make it not reappear.
8. **`grep -c` exits 1 on a true zero** — used in the attribution step to prove "0 dist files
   in each commit". Under `&&` that reads as a failed command; the finding *is* the zero.

## C. This lane's own errors, caught before they reached a claim

9. **A `process.exit()` inside a `try`, which skipped its `finally`.** My first draft of
   `check-artifacts-at-head.mjs` exited early on install/build failure, and Node does not run
   `finally` after `process.exit()`. The symptom was not wrong output — it was one **leaked
   `git worktree` registration per failed run**, found by asking the filesystem whether the
   scratch was gone (`ls -d .tmp-artifact-at-head-*` → 1) rather than trusting the clean
   `NOT-RUN` line the script had printed. Rewritten to return codes and unwind through
   `finally`, plus a start-of-run sweep for scratch a `SIGKILL` could not clean up. Re-measured
   after: 0 leftover directories, 0 registrations. A tool that adds a worktree registration to
   a shared repo on every failure would have poisoned other lanes' `git worktree list`.
10. **`git worktree add --detach $S HEAD` with `git -C <main checkout>`: `HEAD` is the main
    worktree's HEAD, not this lane's.** My "price it at HEAD" run silently priced `f0485b15`
    instead — and reported 20 drifts, which is exactly the base case. The accident produced a
    useful artifact, but the run was mislabelled until I checked which SHA had been checked
    out. Every subsequent run pins an explicit SHA, and `MECHANISM.md` quotes the labels only
    after that check.
11. **I quoted an unmeasured number in a commit message** ("the gate … went from 70s to
    ~85s"). Whole-gate wall time on this box is load-sensitive (41.6 s, 70.0 s, 62.2 s for
    three comparable runs with two other agents sharing the machine); the only defensible
    figure was the leg's own 12.1–12.3 s. Amended to `e75e1821` with the measured numbers and
    the load disclosure; tree verified byte-identical to the amended commit
    (`81d32effc89cc3ccd25c53c80614a123729b0527`), so the final battery still applies to it.
    Nothing else in this report was amended after being written, because the check happened
    while writing, not after.
12. **Two exit codes read through a pipe.** `node scripts/check-artifacts-at-head.mjs 2>&1 |
    tail -14; echo "EXIT=$?"` reported `tail`'s 0 for a script that had exited 3 — the exact
    trap this brief warns about, and I walked into it in a convenience invocation. Re-run
    un-piped, exit 3 confirmed.
13. **`/tmp` is private per bash call.** A follow-up `grep /tmp/verbatim.log` in a new call
    found nothing, so the store-path check had to be re-measured inside one call. Had the
    first call's `EXIT_VERBATIM=0` been quoted alongside a "no nested `v11/v11`" claim read
    from the next call's missing file, the claim would have been fabricated; the script's
    comment now states only what was actually observed on pnpm 11.7.0 (both store-path forms
    install cleanly).

## D. The one that would have produced a false alarm about the rebuild

14. **`p6t1-parallel` went from 0 to 2 to 5 red across two post-rebuild population runs.**
    Reported as a red *count* this is "the rebuild broke 5 tests". Reported as identities plus
    registered legs it is nothing of the kind: identical 5043 legs, identical 18 titled base
    failures, `RESOLVED 0`, and all movement inside one disclosed load-sensitive file. Three
    discriminators, in increasing strength: the flaking identities are the ones
    `7-6-merge-gate/FINDINGS.md` §6 already names; the file's solo results on the same tree
    were `9/9`, `9/9`, `2 failed | 7 passed` (so it flakes with the machine to itself, and
    "green when run alone" was never a sound discriminator); and `grep` shows the file has no
    `dist`, no `composition-shim` and no spawn at all — a rebuilt artifact cannot reach it
    structurally. On the final committed tree it was back to 0 red without intervention.
    The final capture's `NEW 0 / RESOLVED 0` is the claim; the 2-and-5 runs are in
    `BATTERY.md` so the claim is not presented as effortless. And the last re-run on the
    committed evidence tree added **one more identity that the disclosed set does not
    contain** — a `P2: N=5 … (raised quotas)` leg — which is why `BATTERY.md` §1 now says
    `p6t1-parallel` has *at least four* load-sensitive identities and cites §6's "three" as
    an undercount. Had I matched deltas against the disclosed list instead of against the
    base identities, that fourth flake would have been read as a new regression.
15. **`d3-member-identity-context > D3-4` was watched for a disappearance, not just for a
    red.** It is red at base, and the instruction to ask whether it *died* rather than passed
    is the right one: a leg that stops registering is invisible to a diff that only lists new
    failures. It is present as exactly 1 red in all four captures, and the registered-leg
    total (5043 in every capture) is what makes "nothing died" checkable at all.
