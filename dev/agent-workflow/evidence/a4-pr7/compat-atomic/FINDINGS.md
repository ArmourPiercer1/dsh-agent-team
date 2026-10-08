# A4-PR7 `compat-atomic` — FINDINGS

**Lane**: P1, `feat-a4-compat-atomic-state` (worktree `.worktrees/a4-compat-atomic-state`),
base `606a0be7` (master, PR #196). Three commits, in order: `20196925`
(characterization, green against the UNFIXED tree), `04f8d776` (the fix, with its
rebuilt `dist`), the evidence commit — `git log --oneline` on this branch is the record, since amending this file moves its own SHA. **State handed back: UNMERGED.** No
push, no merge, and `dev/agent-workflow/SESSION_ROUTER_LOG.md` / `graph.yaml`
deliberately untouched — shared orchestrator files are the parent's to append to
after the merge decision, and a lane editing them is a guaranteed cross-lane
conflict.

---

## 1. Verdict

**One compatibility state transition is now one durable write, and a writer that
loses the race is told so instead of silently destroying the winner's state.**

`compatibility/probe.ts:replaceState()` used to perform one logical state change
as three separate durable operations (`compatibility.delete()` →
`compatibility.put()` → `teamSessions.advanceGeneration()`). It is now
`CompatibilityRepository.replaceIfGeneration(record, expectedGeneration)` — a
single write whose generation comparison runs inside the seam's atomic
read-modify-write slot — plus the generation stamp. No probe deletes any more, so
the compatibility row is never observable as ABSENT on any product path, and a
consultation whose probe loses converges when the row it lost to already carries
the fingerprint it wanted, and still fails closed when it does not.

Three things a reviewer should not have to dig for:

1. **The module doc was part of the defect.** It asserted the transition was
   "serialized on the same team_domain write chain". That was false
   (`putRecord`/`deleteRow` hit `table.put`/`table.delete`; only `updateRaw` is on
   the chain), and it recruited readers: `coordination/index.ts`,
   `activation/provider.ts` and `src/plugin/root.ts` all reasoned *from* it, and
   the boot-time probe in `root.ts` was written as a workaround for the hole it
   concealed. All four sites are corrected in `04f8d776`, in the past tense where
   they describe history.
2. **Two pinned behaviours owned by other lanes were revised, on the project
   owner's ruling on the p6t1-flake escalation** ("a version-checked atomic update
   first; convergence of concurrent probe results afterwards"). They are named in
   §8 and cited in the commit message. Nothing was quietly superseded.
3. **One residual is disclosed, not hidden**: the public seam offers no conditional
   *create*, so the cold (first-ever) transition is not conflict-detectable. Its
   consequence is bounded (§6). Closing it needs a seam change —
   `CORE_SEAM_BLOCKER` territory, out of this lane's budget (CORE PATCH BUDGET
   spent: **0**).

Nothing else about the domain changed: no error code, reprobe reason, status,
verdict shape or law was added, renamed or removed.

---

## 2. The defect, at the line where it lived

`replaceState()` was:

```ts
await repositories.compatibility.delete(rootSessionId)     // durable op 1
await repositories.compatibility.put(record)               // durable op 2
await repositories.teamSessions.advanceGeneration(rootSessionId) // durable op 3
```

`put`/`delete` reach the table directly; only `updateRaw` is submitted on the
per-domain write chain. The claim of chain serialization therefore described a
property of a different method. Three consequences, all measured, none of them
"flaky":

* **A false refusal of legitimate work.** Two consultations of one cold/stale
  generation both deleted, then both put. `putRecord`'s rule is "identical stored
  bytes are a no-op, different bytes are `RECORD_DUPLICATE`", and the record's
  only time-varying field is `computedAt` — so whether the loser's write was
  *visible at all* came down to two probes landing in the same millisecond. The
  loser rejected `RECORD_DUPLICATE` → `reprobe-failed` →
  `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`.
* **A window in which the state does not exist.** Between op 1 and op 2 any reader
  — including the winner's own post-probe re-read — sees `undefined`, which is the
  `no-state-after-reprobe` fail-closed reading. That reading is *correct*
  behaviour being fed a corrupted world.
* **Permanent loss under a crash.** A crash after op 1 and before op 2 leaves the
  row gone for good, taking the human acknowledgement with it. `acknowledge()`
  went through the same replace path.

`PR #194` had serialized activation step 6 behind a per-team chain. That fixed
one caller's scheduling; `admission/gate.ts`, `admission/requirement-gate.ts` and
the memoized root authority (`src/plugin/root.ts`) still raced each other, because
the hole was in the seam, not in the caller.

---

## 3. What was measured at base (characterization, `20196925`)

* `p6t1-parallel.test.ts` solo, 20 sequential runs at base:
  **0 failed runs of 20** (`raw/base-p6t1parallel-*.log`, `base-p6t1parallel-transcript.txt`).
  The rate is *not* the finding: the p6t1-flake lane measured 4 reds in 20 runs
  under its own configuration and 12 chainFail in 12 rounds of its deterministic
  reproducer (`evidence/a4-pr7/p6t1-flake/FINDINGS.md` §7), and the wall-clock
  coincidence is exactly what makes a rate an unreliable instrument here.
* The characterization file ran ****12** legs green, 0 failed runs of 20**
  against the unfixed tree (`raw/characterization-base-*.log`,
  `characterization-base-transcript.txt`). Those legs pinned the *old* law: the
  loser refused with `{name: 'TeamDomainError', code: 'RECORD_DUPLICATE',
  problem: 'duplicate-compatibility-state'}`, the crash leg found the row **absent**
  after reopen, and the gap leg produced `no-state-after-reprobe` from the schedule
  `B.step3-read < A.delete < A.put < B.delete < A.re-read < B.put`.
* Instrument baseline at `606a0be7`: **22** red identities (19 failing tests + 3
  collection-failing files) over **505** files / **6288** legs across the nine roots;
  `fail-set diff` against the published baseline
  `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md` =
  **NEW 0** (`census-base-identities.txt`, `scratch/census-base.json.gz`).

---

## 4. The fix

**Storage seam (`packages/storage/repositories/compatibility.ts`).**
`replaceIfGeneration(state, expectedGeneration)`:

* `expectedGeneration: 0` means "the caller read no row" — the cold transition is
  one durable `put`, whose occupied-key rule reports a concurrent creator as
  `RECORD_DUPLICATE` / `duplicate-compatibility-state`.
* otherwise the transition is one `updateRaw`, and the comparison
  `existing.generation !== expectedGeneration` happens **inside** the `fn` that
  the seam runs in its atomic slot. A loser raises `RECORD_DUPLICATE` /
  `stale-generation-compatibility-state` with `expectedGeneration`,
  `observedGeneration`, `expectedFingerprint`, `observedFingerprint` in `details`,
  and **writes nothing**.
* `put`'s documented semantics are untouched — this is a new method beside it, so
  the "identical bytes are a no-op" contract other users rely on still holds.
* a warm transition over a row that is no longer there rejects with the seam's own
  `missing-key`, classified `SEAM_FAILURE` — the identical identity
  `teamSessions.advanceGeneration` rejects with over a missing team row
  (`g8s1-stamp-advance.test.ts`), with nothing added here.

**Prober (`compatibility/probe.ts`).** `replaceState(record, expectedGeneration)`
is the conditioned write plus the stamp, and it is the *only* state writer: both
`probe()` and `acknowledge()` pass through it, so the state's own generation stamp
and the acknowledgement path get the same law. The module block now states the
law, the residual, and the fact that the stamp is a **separate** durable write
(the generation line and the state row are two rows in two stores; the fix does
not pretend otherwise, and a crash between them leaves a fresh state row and an
old stamp, which the freshness check re-derives rather than trusts).

**Authority (`compatibility/authority.ts` step 3) — convergence, with a boundary.**
`isLostStateRace(error)` (exported from `probe.js`) is the typed signal: a
`RECORD_DUPLICATE` on the `compatibility` store. On that signal the consultation
re-reads the row: if it carries the live fingerprint, the establishment it was
waiting for HAS happened, so the consultation is served; if the row is absent or
carries a DIFFERENT fingerprint, it fails closed with the typed cause exactly as
before. `reprobed: true` now means "this consultation established the generation,
by winning **or** by converging"; the two are told apart in the durable record,
because a converged consultation fired no `onProbe` and did not author the row.
That disclosure is in the code, not only here.

**Where the fix lives matters.** Because it sits at the seam, every caller
inherits it — activation step 6, the new-work gate, the requirement gate, the
memoized root authority — instead of one caller per hotfix.

---

## 5. Failure modes, and what answers each

| Interleaving / fault | Now |
| --- | --- |
| two consultations race one cold generation | exactly one create lands; the other is reported and converges; both consultations are served |
| two consultations race one stale generation | exactly one conditioned write commits (gen N→N+1); the loser's write is refused and it converges on the winner's row |
| a reader starts after the winner committed but before its stamp | it reads a PRESENT, fresh row and does not probe at all |
| the loser's environment differs from the winner's | the loser's row carries a fingerprint it never asked for → typed fail-closed (convergence has a boundary) |
| crash inside the state write | the previous row survives intact (acknowledgements included); recovery continues the generation line from it instead of restarting it |
| a stale caller conditioned on a generation long past | `RECORD_DUPLICATE` with expected/observed both in `details`, zero durable writes |
| the row is gone (raw repository `delete`) | seam `missing-key` → `SEAM_FAILURE`, nothing written, row still absent |
| process restart | the row survives; the second process sees it as fresh: no re-probe, zero writes |

---

## 6. Disclosed residual, and what was rejected instead

The public seam's `update` rejects a missing key, so there is no conditional
*create*: if two writers both read "no row", both may pass their gate check before
either writes, and the second create's occupied-key check reads the row outside the
write-chain slot. The consequence is bounded and stated in the module doc: two cold
candidates carry the same generation and the same fingerprint (both probed the same
live facts) and differ only in `computedAt`, so the surviving row is always ONE
probe's complete, well-formed record — never absent, never torn, never a state no
probe computed — and every reader, including the loser's own consultation, re-reads
the row.

Rejected, with reasons recorded rather than dropped:

* **`putRaw` + readback** to detect the collision after the fact: cannot detect the
  fully-serialized stale-gate ABA either, costs an extra durable write and emits a
  spurious `domain/changed`.
* **Placeholder rows** (create-then-fill): writes governance-plane placeholders into
  a store whose existence is itself the admission evidence.
* **A new error code, or widening `REPROBE_REASONS` / `COMPATIBILITY_ERROR_CODES`**:
  both are closed v1 vocabularies; `RECORD_DUPLICATE` already means "a different
  record already occupies the key", which is exactly true.
* **Doing it in the callers** (extend PR #194's chain to the other three call sites):
  re-creates the four-locks problem `coordination/index.ts` was created to close, and
  leaves the next caller unprotected.

---

## 7. Tests: 19 legs, determinism as the acceptance bar

`packages/runtime/test/a4-compat-atomic-state.test.ts`. No sleeps, no re-run-until
green: a **monotonic clock** removes the same-millisecond byte-identity
coincidence (so every round of a race is the interesting one), and interleavings
are **driven** by per-method `Gate`s installed through a `Proxy` over the
repositories. Gates park NAMED **asynchronous** seam calls only:
`compatibility.get` is synchronous by contract (callers do not await it), so
parking it hands a promise to code under test and corrupts the shape — that
mistake was made and un-made here, and is why the post-write hold is taken on the
generation-stamp advance, the last await before the post-probe re-read. Each gate
exposes `entered`, which resolves only when a call has actually parked.

* **A1/A2** cold and warm writer-vs-writer races, 8 rounds each: the outcome
  inventory is *identical* across rounds; exactly one state write + one stamp
  advance per round; neither consultation is refused; exactly one of the two fired
  an `onProbe` (so convergence is visible in the durable record, not only in a
  boolean).
* **A3** the hole cannot be entered: a consultation started while the winner is
  committed-but-unstamped sees a present row, probes and writes nothing — and the
  durable compatibility op log for the whole run is `['put','update']`: **no
  delete on any product path**.
* **A4** the version conflict, by name: identity
  `{TeamDomainError, RECORD_DUPLICATE, stale-generation-compatibility-state}`,
  `expected/observed` generations, **zero durable writes**, winner's row untouched;
  plus the cold shape (`duplicate-compatibility-state`).
* **A5** crash inside the transition (seam `armCrashAfterWrites` at the transition
  itself): the caller sees the flattened `SEAM_FAILURE` /
  `unclassified-seam-error` identity, and after a **real reopen** the row equals
  what it was — generation, status, and the human acknowledgement — with recovery
  advancing from the surviving row (gen 3, acks still 1) rather than restarting the
  line.
* **A6** restart reconstruction: `domain.close()`, a new `FileStorageSeam` and
  `TeamDomain` handle over the same directory, and a **fresh module evaluation**
  (`vi.resetModules()` + dynamic import, asserted to be a different function
  identity); the second process admits with `reprobed: false` and **zero** writes;
  the same consultation over a fresh EMPTY store is a different shape, so the leg
  is not vacuous.
* **A7** the convergence **boundary**, driven gate-by-gate: park the loser after it
  read its generation, let a winner with a *different* environment commit behind its
  back, release → typed fail-closed with the stale-generation cause. Same schedule
  as A1/A2, different facts — that pair is what makes it a boundary and not a
  coincidence.
* **A8** the counterfactual, kept on purpose: the raw `delete`→`put` sequence called
  directly at the repository still shows the row reading as ABSENT in between, still
  costs a durable `delete`, and a conditioned write inside that window refuses with
  the seam's `missing-key` writing nothing. The window is a property of the
  *sequence*, which is why the fix removed the sequence instead of scheduling it
  better.

Scenario failures are captured at module load and re-raised **inside the leg**
(`captureRun` / `must`, unwrapped in the `it` body, never in a `describe` body):
a broken schedule fails its own leg and never collapses the file into a collection
error, which would hide the other eighteen. A mutation harness confirmed the
difference empirically — the first version of the harness turned one mutation into
`Tests no tests`; after the fix the same mutation produced 17 individual red legs.

**Mutation table** (`raw/mutation-table.md`, logs `raw/mutation-*.log`) — each
mutation is a single production line, reverted immediately after its run, and the
red legs are the reachability proof:

| Mutation | Red legs |
| --- | --- |
| M1 `replaceIfGeneration` performs the old `delete`→`put` behind the new name | 5 (incl. "no delete on the compatibility store", the conflict-by-name pair, the warm race) |
| M2 drop the generation comparison | 4 (conflict not raised; loser not protected; boundary leg) |
| M3 remove convergence (always fail closed) | 2 (the loser-refused legs in the cold and warm races) |
| M4 converge without checking the fingerprint | 1 (exactly the boundary leg) |
| M5 cold create loses its branch | 17 (the file's whole cold path collapses — and every leg reports itself, not a collection error) |
| M6 drop the stamp advance | the schedule cannot even be produced: the leg's park point **is** the mutated line |

---

## 8. Pinned behaviour this lane revised (and on whose authority)

Owner ruling on the p6t1-flake escalation, quoted in the commit: *"a version-checked
atomic update first; convergence of concurrent probe results afterwards"*.

1. **`packages/runtime/test/p6t2-actions.test.ts`**, D3 "the stale synthetic
   `BLOCKED_FATAL` row is replaced by an inline re-probe under the current (OPEN)
   facts": `followUp.firstTables` was pinned as
   `['compatibility','compatibility','team_sessions']` — i.e. it pinned
   delete+put+advance. It is now `['compatibility','team_sessions','ledger']`: one
   state write, the generation stamp, then the admission's own work fact. Title
   unchanged, so the test identity is unchanged.
2. **`packages/runtime/test/p8s5b-operation-fencing.test.ts`**, R5a leg "at least one
   `NO_STATE_AFTER_REPROBE` fail-closed across the (stagger, facts-delay) grid"
   (`expect(hits).toBeGreaterThan(0)`): that leg pinned the **injury** as a proof of
   the window. The window is closed at the seam, so the leg now pins `hits === 0`
   and that every grid cell yields the honest `block` (measured: after the fix the
   whole half-A grid produces `block` and nothing else — zero fail-closed re-probes
   of work that had nothing wrong with it). **Its title changed with its body, so
   this lane carries exactly one test-identity transition**, recorded here and in
   FINAL-BATTERY: the old identity is gone because the property it asserted is gone,
   and keeping the words while inverting the body would repeat the exact sin this
   lane closes (a comment asserting a property the code does not have). The
   `describe` title was deliberately left byte-identical so the other three R5a
   identities do not move.
   Not revised, and verified unaffected: the sibling R5a interleave leg (still
   meaningful — some cells legitimately serialize into two probes), all R5b legs,
   the `g8s1-generation-stamp` legs, and the frozen
   `packages/testkit/test/a4p7-merge-gate.test.ts` (untouched, 29/29 green).

---

## 9. Instrument results at tip

All numbers below are copied from `raw/battery.log` / `raw/*.log`; the machine-
readable version of this section is `FINAL-BATTERY.txt`.

| Instrument | Verdict at tip `04f8d776` |
| --- | --- |
| nine-root identity census | `506 files / 6307 legs` (+1 file = this lane's spec, +19 legs = its legs); **22 red identities**, `fail-set diff` base→tip = **NEW 0 FIXED 0** |
| disclosed identity transition | the census cannot see a renamed *green* leg: the R5a leg in §8.2 changed title (1 identity), body revised |
| determinism | `p6t1-parallel` **0 failed runs of 20**; this spec **0 failed runs of 20** (sequential solo runs, `final-*-transcript.txt`) |
| frozen merge gate | `a4p7-merge-gate.test.ts` **29/29** (untouched) |
| scan-count leg | `p4t6-session-event-scan.test.ts` **10/10**; its total is derived in the leg as `983 + Σ named lists` (this lane names exactly one path) |
| typecheck | `pnpm --no-bail -r run typecheck` rc=0, **0 `error TS`** |
| lint | **160 problems (128 errors, 32 warnings)** = the standing number |
| lint identities | `--diff` vs `a4-lint-baseline/lint-identities-0237d487.txt`: 76 distinct, **new 0, resolved 0** |
| committed build | `DSH-ARTIFACT-VERDICT … verdict=ok compared=1508 **drift=0**` (a first attempt printed `drift=3` — a `dist` built while a mutation was on disk — and was rebuilt and amended; the failing run is kept at `raw/check-artifacts-head-commit2.log`) |
| blueprint-version cleanliness | `verdict: dirty-or-unknown`; OFFENDING = the **same 6 pre-existing files** as at base, `unknown(0 files, 0 sites)`; exit 1 is the script's own rule (`gating > 0 ? 1 : 0`) over those 6. This lane's spec contains no blueprint-version literal (`documentVersion` count 0), so it cannot move the verdict |
| assertion discipline | `expect(` over `packages` + `tests`: **23052 → 23106 (+54)**, 518 → 519 files; per-file walk shows exactly **two** changed files, both increases (`+53` the new spec, `+1` p8s5b), **none** decreased |
| CORE PATCH BUDGET | **0** spent — no upstream source touched |

Two honesty notes about instruments, because both were nearly misread here:

* the **first** mutation-harness run produced a *collection error* for one mutation
  instead of leg failures, and the second harness run was killed mid-mutation and
  left a mutant `probe.ts` on disk (which then looked like a spec hang). Both are
  recorded in `scratch/mutate.py` (per-run scratch cleanup, bounded timeouts) and in
  the table's M5/M6 rows. A gate that changes another gate's measurement is not a
  gate, and the same is true of a harness.
* the artifact check at the *first* attempt of this commit said `drift=3`, because
  the build had run concurrently with the mutation harness. Reported as it happened,
  not smoothed over.

---

## 10. Reproduce

```bash
export CI=true XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
cd .worktrees/a4-compat-atomic-state
rm -rf packages/testkit/test/.tmp-fault
npx vitest run packages/runtime/test/a4-compat-atomic-state.test.ts   # 19 legs
bash dev/agent-workflow/evidence/a4-pr7/compat-atomic/runloop.sh 20 \
  loop packages/runtime/test/p6t1-parallel.test.ts /tmp/t.txt         # rate
bash dev/agent-workflow/evidence/a4-pr7/compat-atomic/scratch/battery.sh  # everything
bash dev/agent-workflow/evidence/a4-pr7/compat-atomic/scratch/mutate.py   # mutation table
```

## 11. Out of scope for this lane

* A conditional create in the storage seam (§6) — upstream surface, not this budget.
* The generation stamp and the state row are still two durable writes; making them
  one requires a cross-store transaction the seam does not offer.
* Removing `coordination/index.ts`'s chain now that the seam is safe: wrong direction
  (a compare-and-set makes interleavings detectable and convergible, it does not
  remove them), and its own module doc says so now.
* Merging. This branch is handed back UNMERGED for the PR-level review loop.
