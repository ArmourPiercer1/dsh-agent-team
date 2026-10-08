# A4-PR7 §7.6 — the PR / push merge gate: FINDINGS

**Verdict, before anything else.** After this lane: **nothing about a merge on this repository is
server-enforced, and that is stated rather than decorated over.** `gh api
repos/ArmourPiercer1/dsh-agent-team/branches/master/protection` answers `404 Branch not protected`,
there are `0` self-hosted runners, and `pr-gate.yml` exists only on the unmerged branch
`ci-a4-pr-gate` — GitHub has never parsed it. What changed is that the merge gate now **exists as one
command with a machine-readable verdict** — `node scripts/ci-pr-gate.mjs --full` — that seven checks
run in one place in cheap-first order, that has been **watched refusing real defects** (including two
defects of its own author's), and that `.github/workflows/pr-gate.yml` asks GitHub to run verbatim on
`pull_request` and `push` to `master`. **Today the merge gate is coordinator-enforced: it bites
because whoever merges runs it. Server-enforcement is one owner action away and that action is a
judgement call about runners, not about this code (§6).** An honest "not enforced" beats a decorative
lock, so this lane did not set one.

---

## 1. What the lane added

| Path | What it is |
| --- | --- |
| `scripts/ci-pr-gate.mjs` (1209 lines) | The gate. One entry point for CI and for a reviewer, so "what CI runs" and "what the coordinator runs before merging" are not two lists that can drift. |
| `.github/workflows/pr-gate.yml` (164 lines) | `pull_request` + `push` on `master`, job name `pr-gate` (that string *is* the required-check context), `permissions: contents: read`, `cancel-in-progress: false`, one gate command + one transcript re-grade + artifact upload. |
| `dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt` | The fence leg's baseline: the standing `dirty(6 files, 15 sites)` debt, recorded verbatim at `master@606a0be7` with provenance, so the leg is an identity diff and not an exit code. |
| `…/ci-gate/transcripts/`, `transcripts-red-F-…/`, `transcripts-green-run1-found-F1/` | Every run this lane made: 1 green, 4 red full runs, 5 RED-control transcripts, 2 server-reality captures, 1 diagnostic. |
| `…/ci-gate/scratch/` | `red-control.sh` (the five controls, plant → run → revert), `diagnostic-G.sh`, `reproduce-tokenless-crash.mjs`. |

Seven legs, cheap first, measured on the published green run (`transcripts/GREEN-full-run.txt`,
load 8–9 and a warm store — treat these as the fast end; the same census took 274.1 s at load ~11):

```
graph-parse        0.2 s   dev/agent-workflow/graph.yaml parses — same parser as the pre-commit hook
install            0.4 s   pnpm install --frozen-lockfile (+ --store-dir workaround in force here)
blueprint-fence    0.2 s   identity diff vs the committed fence baseline
typecheck         10.2 s   pnpm -r typecheck — the only leg that sees a bad *.test.ts
lint-identities   10.7 s   identity diff vs lint-identities-0237d487.txt (76 distinct, 1119 files)
artifacts-at-head  8.7 s   DSH-ARTIFACT-VERDICT … compared=1508 drift=0
census           192.1 s   nine roots, 2 captures, identity-set diff vs nine-root-2162f6a7.md
──
DSH-CI-VERDICT pass pass=7 fail=0 skip=0 skipped=none legs=7 seconds=222.4
```

## 2. The gap had a commit and a date

The brief's premise ("no automatic CI on PRs") is true at `master` today and understated: this repo
**ran** automatic PR CI on GitHub-hosted runners **32 times**, then switched it off.

- `77b19655` (2026-08-30) added `characterization.yml` with `on: pull_request + workflow_dispatch`.
- 32 `pull_request` runs, `2026-09-11T14:40:20Z` → `2026-09-17T15:25:28Z`, on runner
  `GitHub Actions 1000000264`, labels `["ubuntu-latest"]`. In every one of them `Set up job`,
  `Checkout`, `Setup Node`, `Setup pnpm`, install and build **succeeded**; the payload step failed.
- `61990035` (2026-09-17, user-directed) removed the `pull_request` trigger. Its in-file rationale
  ends: *"Until then this job is archival/manual: run it on demand for infrastructure validation; it
  is **NOT a merge gate**. The repo's active gates remain the workspace test suite + the real-host
  smoke kit."*

**`pr-gate.yml` is that named active gate, not an override of the ruling.** It runs the workspace
test suite's root census (plus typecheck/lint/fence/graph/artifacts) and deliberately does *not* run
the P2 characterization probes, which are what made the old `pull_request` job red on the newer pin.
`characterization.yml` is untouched in this branch and keeps its `workflow_dispatch`-only trigger.
Full capture: `transcripts/SERVER-when-pr-ci-stopped.txt`.

That history is also why the runner precondition for required status checks is *satisfiable here*
rather than assumed — hosted runners demonstrably check this repo out and run pnpm in it.

## 3. What the gate may never measure

Written into the script header, because a gate silently degrading into a counter is how this repo got
a 27-TS-errors-merge-ready branch and two unparsable `graph.yaml` commits:

1. **Identity diff, never exit code** for `lint` and the fence. `pnpm run lint` is red at base by
   standing debt; `exit 1` is noise. The leg passes iff the *set* of identities equals the baseline.
2. **Identity set, never counts** for the census. `505f/6288l` against a baseline document that
   declares `505 / 6285` is `COUNTS MOVED, SET DID NOT` — context, not a verdict.
3. **An escalation is a failure even though the red count went down.** A baseline titled red that
   vanishes while its file turns into a collection error is `ESCALATION`, not a decrease.
4. **A missing `DSH-CI-VERDICT` token means `fail`, never `not-run`.** The leg loop is inside
   `try { … } finally { printToken(…) }` so even a harness throw emits `harness=aborted` — the
   instrument will not go quiet on you.
5. **A skip is named or it is a failure.** The census is optional by default and prints
   `verdict=skip … skipped=census`; under `--full` (what CI runs) any skip is a `fail`.
6. **Tolerance authority is the baseline document, never this script.** The load-family exemption is
   read out of the baseline's prose by `parseLoadFamilies()`; there is no family name hardcoded in
   the gate (F6 below is the draft that did exactly that, and a real refusal caught it).
7. **The clock is part of the claim.** The census leg line prints `clock: …` so a pass says which
   `testTimeout` it passed under (§5, F8).

## 4. Proof it bites both ways

| Case | What was planted | Gate's answer |
| --- | --- | --- |
| **green** | nothing (`master@606a0be7` tip) | `pass pass=7 fail=0 skip=0 skipped=none legs=7 seconds=222.4` |
| **A** | `packages/testkit/test/ci-gate-red-control-a.test.ts` with `const wrongType: number = '…'` | `typecheck verdict=fail`, detail carries `test/ci-gate-red-control-a.test.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.` — the class of the 27-errors incident, in 3.1 s (8.1 s on a cold build cache) |
| **B** | `git show 34ef63ed:dev/agent-workflow/graph.yaml` (the bytes PR #195 merged) | `graph-parse verdict=fail … PARSE-ERROR … line 877, column 5: expected <block end>, but found '<block sequence start>'`; with those bytes *staged*, `dev/agent-workflow/hooks/pre-commit` also exits non-zero, so local guard and gate agree; revert → pass |
| **C** | one failing `it()` appended to `packages/domain/test/t2-blueprint-hash.test.ts` — a file the baseline **already lists as red** | `NEW RED(S) 1: TEST …t2-blueprint-hash.test.ts::CI-GATE RED CONTROL C a new red identity inside an already-red file`, `resolved 0`, `escalations 0` (sidecar `census-comparison-20261008T133117Z-6893.json`). A per-file gate would have called this unchanged — the file was already red — and so would a per-count gate over red *files*: 505 before, 505 after; only the leg total moved, 6288 → 6289. An earlier run of the same control, at load ~19, reported **three** new reds: the planted one plus the two F8 legs crossing the default clock. C runs at the suite's own clock on purpose, and load reds are named, never tuned away |
| **D1** | a real stored nine-root report (`502f/6277l`) vs the baseline document's `505 / 6285` | `pass` + `COUNTS MOVED, SET DID NOT` |
| **D2** | that report doctored so one titled red disappears **and** its file becomes a collection error | `fail` + `ESCALATION (a lower red count is NOT a fix here): packages/domain/test/t2-blueprint-hash.test.ts: 1 titled red(s) vanished and the file now reports a collection error` |
| **E1/E2/E3/E4** | a real transcript with its verdict line deleted / complete / truncated after leg 2 / a faithful red run | `class=missing-token` (exit 1), `class=ok` (exit 0), `class=truncated` (exit 1), `class=red-run` (exit 1 — the gate refusing a tree is a *different sentence* from the instrument being broken) |
| **F1 (unplanned)** | nothing — this lane's own bug | the artifacts leg refused its own author's `--store-dir=PATH` argv (§5) |
| **F8 (unplanned)** | nothing — unmodified tip, default clock | the census refused the tip twice on one walk leg that crossed vitest's 5000 ms default (§5) |

Every RED control plants, runs, and reverts in one script and each transcript ends with the `git
status --porcelain` count returning to this lane's own 3 untracked paths. **A gate that has never been
observed refusing anything is an untested gate**; the four red *full* runs in `transcripts/` are as
much the deliverable as the green one.

## 5. Findings — including the ones about this lane's own code

- **F1 — the artifacts leg asked for its store the wrong way, and the gate caught it on run 1.** The
  leg passed `--store-dir=<path>`; `scripts/check-artifacts-at-head.mjs` parses `--store-dir <path>`
  (two argv entries) and threw `Error: unknown argument:` *before emitting any verdict token*. The
  leg's rule — no `DSH-ARTIFACT-VERDICT` line ⇒ fail — turned my bug into a red instead of a green.
  Preserved: `transcripts/RUN-1-first-full-run-found-F1.txt` (`pass=6 fail=1 … seconds=221.4`).
  Note the asymmetry so nobody "fixes" the wrong one: `pnpm` genuinely takes the `=` form (the install
  leg's display shows it), the repo's own script does not.
- **F2 — the workflow would have reported a red gate as green.** Actions runs a `run:` block under
  `bash -e`, and in `node … | tee file` the pipeline's status is **tee's**. The gate's own exit code
  was swallowed by the step added to make its output readable. Fixed with `shell: bash` +
  `set -o pipefail`, comment in place.
- **F3 — importing `scripts/ci-pr-gate.mjs` ran a seven-leg gate.** The file ended in a bare
  `process.exit(main(…))`; an evidence script that imported it for one pure function executed the
  whole thing, raced the run already in flight, and overwrote its per-leg captures. Fixed with an
  entry guard (`invokedDirectly`). The contaminated run is kept as
  `transcripts/GREEN-full-run-1-self-interference.txt` with its header explaining what is and is not
  trustworthy about it, and superseded by `GREEN-full-run.txt`.
- **F4 — the verdict builder could throw, producing exactly the tokenless output the gate defines as
  failure.** Draft kept skip *names* in a sibling array while `finalToken` read `counts.skipped` ⇒
  `TypeError: Cannot read properties of undefined (reading 'length')` between the last leg line and
  the token, exit 1, no token. Fixed (one object owns every number the token states; the token is
  printed from a `finally`). The crash is reproduced on demand —
  `transcripts/RED-CONTROL-E-tokenless-run.txt` + `scratch/reproduce-tokenless-crash.mjs` — and the
  draft's original transcript is *labelled as reconstruction*, not passed off as a capture.
- **F5 — a classifier that got the right answer for the wrong reason.** `classifyFenceReport`'s
  contradiction regex lacked the `m` flag, so `dirty(N files…)` never parsed and the branch fired on
  its own `-1` defaults. The self-test caught it (`contradicting.dirty?.files === 3`), the counts are
  now parsed up front and spread into every return path.
- **F6 — the draft hardcoded the load-family exemption.** It nominated `p6t1-parallel.test.ts` in
  script as "the" flaky family, i.e. this lane had written an unnamed, unattributable exemption into
  the instrument. Replaced by `parseLoadFamilies()`, which reads families only from the baseline
  document's prose *outside* its identity sections, and prints `NO TOLERANCE FOR THE OTHERS` / `NO
  DISCLOSED FAMILY` when a red is not covered. Five pins, including "the real committed baseline still
  yields `p6t1-parallel`".
- **F7 — RED control D caught my gate contradicting itself.** On the escalation case it printed
  `COUNTS MOVED, SET DID NOT` and `ESCALATION` in the same line. Now `countsSentence(totals,
  setIdentical)` chooses, with a pin that the phrase must not appear when the set moved.
- **F8 — the gate refused the unmodified tip, and was right to, and the remedy is not the gate's.**
  `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts::…ONE audited consumer set per name`
  and nothing in this repository sets `testTimeout`, so vitest's **5000 ms** default applies. Ten
  timings of that one leg are in the commit (`transcripts-red-F-undisclosed-timing-red/FINDING-F.txt`,
  every row traceable to a stored capture or a kept reporter line): **it is bimodal** — passes cluster
  at **4094 / 4424 / 4444 / 4589 / 4905 ms**, failures at **6627 / 6939 / 6962 ms**, nothing in
  between, and 3 of 7 default-clock observations failed. The budget does not sit above the leg's cost,
  it sits **inside the gap between its two modes**, which is a different and worse fault than "it is
  load-sensitive": any value in the 4.9–6.6 s range would be a coin flip wearing a confident number.
  With `--testTimeout=20000` the *same tree* yields **exactly the published 22 identities**
  (`transcripts/DIAGNOSTIC-G-timeout-not-assertion.txt`: leg `passed` at **5270 ms**, grade `pass`,
  `identity set IDENTICAL to the published baseline`), and under that clock the leg also passed at
  **6775 ms** — the upper mode is normal, not pathological. Two consequences:
  1. CI passes `--census-test-timeout 20000`, **disclosed on the leg line**, with the measurement
     quoted in the workflow comment. It is an operator knob that moves the clock, not a tolerance: it
     cannot excuse a red identity, and a pass has to state the clock it passed under. A hosted runner
     has 2 cores, so the coin flip is worse there — and a merge gate that is red at random is worse
     than no merge gate, because it trains everyone to re-run until green.
  2. **Owner action for the runtime lane:** give that walk leg a budget that clears its upper mode
     (~7 s, so 10 s or more — not 6), or make the walk cheaper, then take the flag off. Until then the
     default-clock census is a race, and
     `transcripts-red-F-undisclosed-timing-red/FINDING-F.txt` records the refusal rather than excusing
     it — **the file was deliberately not added to the baseline's disclosed families.**
  3. A second leg is queued behind the same cliff: `rc2-sanitize-evidence.test.ts::…S13 file
     aliases…` has eight retained timings, all passing, max **4451 ms** against the same 5000 ms
     budget — inside 12%. It went red once during this lane's runs (an earlier RED control C capture
     at load ~19, where the reporter had printed `✓ …S13… 4379ms` for the same leg the JSON recorded
     `failed` at `6280 ms`). That capture *and that run's transcript* no longer exist — the battery was
     re-run so every committed transcript comes from the delivered build, and the replacement arrived
     clean — so FINDING-F carries it as an observation made and lost, and the reporter-vs-JSON
     divergence should be read as unconfirmed here. What is confirmed on committed bytes: this gate,
     `scripts/fail-set.mjs` and the closure lane all grade the JSON, so the repo's instruments agree
     with one another even where a console might not.

**Cost correction to the brief.** The nine-root census is **~90–150 s per capture** on this box
(32 cores: 96 s/capture at load 8–9, 137 s at load ~11, ~150 s at load ~19), not ~9 min. The five full
`--full --census-captures 2` runs measured: **221.4 s** (refused — F1), **276.2 s** (refused — F8),
**222.4 s** (the published green run), **312.8 s** and **360.4 s** (earlier green runs, both kept and
named). Reproducing the published baselines takes under four minutes on a quiet box, which is the
difference between this gate being run before a merge and not being run.

- **F9 — the gate used to name its own evidence after `process.pid`, which is not unique here.**
  Each tool call in this execution environment gets a fresh PID namespace, so pids repeat across runs;
  two comparison sidecars this lane wrote collided, and a later run overwrote an earlier run's
  `census-comparison-<pid>.json`. The instrument could destroy the evidence for a claim it had already
  published, quietly. Fixed: every artifact is now stamped (`census-<stamp>-<pid>-<n>.json`,
  `census-comparison-<stamp>-<pid>.json`), the census leg prints the sidecar's path so a transcript
  cites a name instead of pointing at a directory, and `evidenceStamp()` is pinned (including "two
  runs one second apart get different names"). The fix caught its own bug on the first try: the first
  version referenced the name before declaring it, the leg threw in the temporal dead zone — and the
  `finally` guard from F4 still emitted `DSH-CI-VERDICT fail`, which is precisely the point of it.

## 6. Enforcement: what is and is not real, and why nothing was changed server-side

Captured 2026-10-08T12:35Z (`transcripts/SERVER-enforcement-reality.txt`), token `ArmourPiercer1`,
scopes `gist, read:org, repo, workflow`:

```
permissions        {"admin":true,"maintain":true,"pull":true,"push":true,"triage":true}
private            false        default_branch  master
branches/master/protection     → 404 Branch not protected
branches/master/protection/access-restrictions → 404 Branch not protected
actions/permissions            → {"enabled":true,"allowed_actions":"all","sha_pinning_required":false}
actions/runners (self-hosted)  → {"runners":0}
registered workflows           → "characterization" (active), Copilot PR reviewer (dynamic)
```

So: **enforcement today = 0 bytes of server state.** The coordinator runs the gate; nothing else does.

The lane could have set protection — `permissions.admin: true` means `PUT …/branches/master/protection`
would succeed — and deliberately did not. Reasoning, in the order that matters:

1. **A required status check that never reports locks every non-admin merge.** Required checks wait
   for a check *run*. If `pr-gate` never appears — workflow not triggered, YAML fault, runner absent,
   or the head-vs-base resolution question below answering the wrong way — merges become impossible
   and the only exit is `--admin` bypassing. Habitual admin bypassing is **strictly worse than no
   protection**, because the protection still reads as "we have a gate" in every audit while the
   actual path around it is one flag.
2. **Whether the `pr-gate` check reports is unverified from here.** The file has never been pushed
   (no push authority in this lane), so GitHub has never parsed it; and whether a `pull_request` event
   resolves a workflow file from the PR head or from the default branch could not be checked —
   `web_search` has no API key in this environment and every `docs.github.com` fetch returned 404 or a
   navigation stub. That question is left **explicitly unverified** rather than asserted either way.
3. **Every actor on this repo holds `admin`.** With `enforce_admins: false` — the only setting
   compatible with the documented flow where the main agent pushes `master` at gates — any lock is
   bypassable by exactly the actor it would bind. With `enforce_admins: true` the documented
   push-at-gate flow breaks. There is no setting here that is both binding and compatible with how
   this repo is operated; the gate has to be social plus visible, or it has to be honest about being
   neither.

**What the owner does, one line** (after watching one `pr-gate` run appear and go green on a PR):

```
gh api -X PUT repos/ArmourPiercer1/dsh-agent-team/branches/master/protection \
  -f required_status_checks[strict]=true -f required_status_checks[contexts][]=pr-gate \
  -f enforce_admins=false -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f restrictions=null
```

Read back with `gh api repos/ArmourPiercer1/dsh-agent-team/branches/master/protection`; the required
context string must match the job `name:` exactly, which is `pr-gate` (the file says so at the top —
that string is an interface, not a caption). Prerequisite, one sentence: the repo needs a runner that
will execute the job — hosted runners demonstrably do work here (§2), so the practical precondition
is watching one run, not registering anything.

## 7. What cannot be verified from here

- Whether `pull_request` uses `pr-gate.yml` from the PR head or from `master` (see §6.2). Cheap to
  settle once anyone can push: open a PR from this branch and look at the Checks tab.
- Wall-clock on `ubuntu-latest`. The 2-core runner has never run these legs; `timeout-minutes: 45` is
  a reasoned guess from 312.8 s on 32 cores plus a fresh install into an empty store. If the census
  blows the budget there, the honest fix is `--census-captures 1` on the runner with the local entry
  point keeping 2 — and saying so in the file, not silently.
- Whether F8's two boundary legs cross the budget on a 2-core runner even at 20 s. Probably not; not
  measured.
- Nothing in §4 was inferred: every line in that table is quoted from a transcript in this directory.

## 8. Reproduce it

```bash
git fetch && git checkout ci-a4-pr-gate         # or: git worktree add … ci-a4-pr-gate
pnpm install --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store && pnpm setup
node scripts/ci-pr-gate.mjs --self-test         # 35 assertions on the verdict algebra
node scripts/ci-pr-gate.mjs --full --census-captures 2 --census-test-timeout 20000 \
  --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store
# any of the refusals, each self-reverting:
bash dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/red-control.sh A   # … B C D E
```

`FINAL-BATTERY.txt` in this directory is the index of what was run, in what order, with the verdict
line each produced.
