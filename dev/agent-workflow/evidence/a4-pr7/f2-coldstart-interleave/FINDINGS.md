# A4-PR7 review verification — F2 cold-start interleave (branch `fix/a4-f2-coldstart-interleave`)

Lane: reviewer-claim verification of PR #208 (`CompatibilityRepository.replaceIfGeneration`
generation CAS), claim **F2**, which the reviewer marked *unverified by experiment*.
CORE PATCH BUDGET = 0 honoured: no upstream change, no private upstream API, no
`testkit` test-infra change. Host baseline: `0.2.0-rc.2` @
`639ed015397290b3745d163aafe02ffee4aa3f84` (`tests/paths.mjs`).

## Verdicts

| claim | verdict | evidence |
| --- | --- | --- |
| **F2.1** — cold start has no CAS; two first-time creators can both observe an empty key and both write | **CONFIRMED (holds), consequence bounded** | `red-before-fix.log` / `green-after-fix-verbose.log` legs *"the interleave is real…"* + *"the durable truth is still exactly ONE complete record…"*; leg **C4** for the undetectable schedule |
| **F2.2** — after a probe the authority compares `result.status` with `state.status` but never verifies the persisted `state.fingerprint` against the consultation's `liveFingerprint`, so status equality cannot establish fingerprint agreement | **CONFIRMED (holds), and CLOSEABLE without a seam change — fixed here** | RED: `red-before-fix.log` (`THE LAW … (F2.2)`, `… fails closed (state-mismatch)`, both C3 legs). GREEN: `green-after-fix-verbose.log` |
| the comment's assumption that two first creators necessarily share a fingerprint | **FALSE** | each `CompatibilityAuthority` calls its own `environmentFacts()`; leg **C0** pins `fp(FACTS_A) !== fp(FACTS_B)` with both `OPEN` |

## The assumption attacked (and why it is false)

The disclosed residual in `packages/storage/repositories/compatibility.ts` reasons that a
cold double-create is benign because the racing creators are *the same environment*, so
the last write is "the same state". Each `CompatibilityAuthority` instance calls **its
own** `options.environmentFacts()` and computes `liveFingerprint =
computeEnvironmentFingerprint(requirements(), facts)`
(`packages/runtime/compatibility/authority.ts`). Two authorities are two reads of the
environment at two moments; a generation bump between them (a tool/web capability
regeneration) yields **different fingerprints with the same `OPEN` status**. Leg **C0**
establishes exactly that with the shipped fixtures: `makeEnvironmentFacts()` vs
`factsWebGenerationBump()` → `fp-v1:97fc230e9949b8d8` vs `fp-v1:723624ddbcad80ab`, both
`admit`. The assumption does not hold, so the consequence must be measured — which is
what this lane did.

## How the interleave is forced (no simulation of the outcome)

`packages/runtime/test/a4-compat-coldstart-interleave.test.ts` drives the **real** product
path: two independent `createCompatibilityAuthority` instances over one real
`FileStorageSeam` + `openTeamDomain` world (row-17 restart pattern: seed, `close()`,
reopen), each with a different `environmentFacts()` port, one monotonic clock, no sleeps.

* The only wrapper installed is a **commit-deferral** on the storage seam: every write
  becomes `park()` → `real.put/update/delete()` → `note-commit`. That reproduces the
  pinned upstream timing — `KvTableImpl.put` enqueues `putRecord` on the domain write
  chain, so the commit lands **at the write-chain slot, never at call time**
  (`tests/deepseek-harness-test-use` @ `639ed01539`,
  `packages/storage/storage-domain/src/domain.ts`). No product layer is stubbed: the
  authority, prober, repository, `BaseRepository.putRecord` occupancy check and the real
  JSON row bytes all run.
* **The barrier**: phase 1 parks *each* creator's `compatibility` `put` and the test waits
  for `Promise.all([gateA.entered, gateB.entered])`. Both callers are therefore inside
  `putRecord`, past the "key does not exist" read (which saw the key ABSENT), and nothing
  has committed. Only then are the commits released. The leg asserts the observation
  itself (`rowAbsentAtCommit === true` for both) rather than trusting the choreography.
* Phase 2 parks the first `team_sessions` update, which is provably *after* the winner's
  state commit and *before* its post-probe re-read — so the loser's read-back lands on a
  row the winner authored, deterministically.
* **Durable truth is read back through a second repository/domain handle**, and proved
  with `seam.writeLog` / `writeCount` (commit-ordered), never from the callers' words.

### Test-infra fidelity finding (reported, NOT changed)

`packages/testkit/fault-injection/file-seam.mjs:makeTable().put` mutates the in-memory
rows **synchronously inside the call**, so `putRecord`'s occupancy read and its commit are
one uninterruptible block. With the stock fake, a cold double-create is *unobservable* —
which is precisely why PR #208's A1 always sees "the loser was reported". The interleave
is unreachable through the shared fake without breaking that fidelity, so this lane wraps
the seam **inside its own spec** (the product layers stay untouched) instead of editing
shared test infrastructure. Any later lane that wants create-race coverage should expect
the same gap.

## Red first (unfixed tree)

`red-before-fix.log` — `pnpm exec vitest run packages/runtime/test/a4-compat-coldstart-interleave.test.ts`,
exit 1, `Tests 4 failed | 10 passed (14)`:

```text
× THE LAW — a verdict carries the fingerprint of the consultation that reports it, never another environment's (F2.2)
× a consultation whose re-probe left a row of a DIFFERENT environment fails closed (state-mismatch)
× every chainOk evaluation reports ONE fingerprint: its own result's and the row's
× and the chain that cannot honour that fails closed instead of returning a mixed verdict

AssertionError: expected 'fp-v1:723624ddbcad80ab' to be 'fp-v1:97fc230e9949b8d8'
Expected: "fp-v1:97fc230e9949b8d8"   // the fingerprint THIS consultation read
Received: "fp-v1:723624ddbcad80ab"   // the fingerprint of the row the OTHER environment wrote
 ❯ packages/runtime/test/a4-compat-coldstart-interleave.test.ts:837:36
```

That received/expected pair **is** the finding: a caller walked away believing
environment A while the durable row holds environment B, and it was told `admit`.

Already-green witnesses in the same red run (they document F2.1's consequence, not a
regression): both creates committed with both occupancy reads empty; exactly ONE complete
record at generation 1; no absent window; no torn/merged row; `['put','put']` with two
`team_sessions` advances; every verdict reported the row's generation (never a false one);
**C2** the identical-facts control under the identical schedule (both consultations agree,
neither refused — so C1's refusal is caused by the fingerprint difference, not by the
interleave); the refusal is transient; and **C4** the bounded residual.

5 consecutive solo runs of the unfixed tree reproduced the identical failing set
(`raw/red-solo-{1..5}.log`, byte-identical FAIL lists, `4 failed | 10 passed` each).

## The fix (no seam change)

`packages/runtime/compatibility/authority.ts`, in step 3, after the post-probe re-read:

```ts
if (state.fingerprint !== liveFingerprint) {
  return {
    chainOk: false,
    reprobeReason: REPROBE_REASONS.STATE_MISMATCH,
    fingerprint: liveFingerprint,
  }
}
```

This is exactly the reviewer's suggested shape — re-read the persisted row after the write
and compare the **fingerprint**, not just the status, then reject explicitly, like the
existing lost-CAS convergence already does. It sits after the re-probe branch only: the
fresh-row path is gated by `state.fingerprint !== liveFingerprint`, so agreement is already
established there. `evaluate` then keeps its invariant that one object carries one
fingerprint (`fingerprint === result.environmentFingerprint`), and `admit` maps the refusal
to the existing `reprobe` decision — no new vocabulary, no `state-mismatch` semantics
change (the reason already covered "the fresh durable state contradicts this chain"; its
doc comment now records both shapes). Docs updated in the same file: the module chain
description, `createCompatibilityAuthority`'s cross-instance consistency paragraph (now
three mechanisms, naming the cold-create case), and `REPROBE_REASONS.STATE_MISMATCH`.

The A7 convergence expectation of `a4-compat-atomic-state.test.ts` is untouched and still
green: a *lost CAS* whose row already carries the live fingerprint still converges (that
path returns before this gate). The new gate only fires where nothing was lost — a create
whose committed row was overwritten, or a create whose row belongs to another environment.

## Green after the fix

`green-after-fix-verbose.log` — `Tests 14 passed (14)`, all four formerly-red legs now
green, every pre-existing witness still green. Determinism: **5/5** solo green runs
(`raw/green-solo-{1..5}.log`, `14 passed (14)` each), and 5/5 with the identical failing
set before the fix — **10/10 samples behaved as intended, no flake, nothing re-run until
green**.

## Files changed

* `packages/runtime/compatibility/authority.ts` — the fingerprint-agreement gate + docs.
* `packages/runtime/test/a4-compat-coldstart-interleave.test.ts` — **new** spec (C0–C4).
* `packages/testkit/test/p4t6-session-event-scan.test.ts` — registered the new spec in the
  append-only scanned-path ledger, as that spec's own protocol demands (a landed file
  without its name turns the coverage leg RED: `p4t6-inventory-with-new-file.log`
  `expected 1042 to be 1041`; green after registration:
  `p4t6-inventory-registered-green.log`). No expectation weakened; the movement is tied to
  the named path by `expect(SCANNED_PATHS_A4F2COLDSTART.length).toBe(1042 - 1041)`.
* `packages/runtime/dist/**` — rebuilt committed artifacts (`build-after-fix.log`,
  `build-composition-after-fix.log`: `DSH-ARTIFACT-VERDICT … verdict=ok compared=1508`).
* `dev/agent-workflow/evidence/a4-pr7/f2-coldstart-interleave/**` — this record + transcripts.

## Gates run

| check | result | log |
| --- | --- | --- |
| new spec, unfixed tree, 5× solo | 5/5 identical RED (4 intended F2.2 witnesses) | `red-before-fix.log`, `raw/red-solo-*.log` |
| new spec, fixed tree, 5× solo | **5/5 green (14/14)** | `raw/green-solo-*.log`, `green-after-fix-verbose.log` |
| `a4-compat-atomic-state.test.ts` (PR #208 witnesses) on the untouched tree | 19/19 green before any change | `baseline-atomic-state.log` |
| atomic-state + new spec after the fix | 33/33 green | `green-after-fix-both-specs.log` |
| compatibility family + `packages/storage` (37 files: `p7t1-*`, `p8s4a-*`, `team-compatibility-scope`, `g8s1-generation-stamp`, `p8s5b-operation-fencing`, `requirement-*`, `t14h-probe-merge`, storage) | 37/37 files green | `compat-family-final-green.log`, `compat-consumer-suite-after-fix.log` (225 tests) |
| `pnpm typecheck` (all packages) | exit 0 | `typecheck-after-fix.log` |
| `pnpm run build` + `build:composition` (artifact check) | exit 0, `compared=1508` | `build-after-fix.log`, `build-composition-after-fix.log` |
| full root suite (`vitest run`) | 501 files passed, **7 failed**; 5 of those fail **identically on the base without this lane's changes** (`base-comparison-unrelated-failures.log`: `t2-blueprint-hash`, `d3-member-identity-context`, `p6t3-mediation`, `p6t3-restart`, `p6t6-actions`); the other 2 were this lane's and are fixed (typecheck error → fixed; `p4t6` ledger → registered) | `full-root-suite-after-fix.log` |

## `CORE_SEAM_BLOCKER` — the part that is NOT closeable without a seam change

Closeable and closed here: **reporting a fingerprint/status the consultation did not read**
(F2.2). Not closeable at the Team layer: **detecting a lost COLD create at all**. The seam
offers `update` (atomic write-chain RMW that rejects an absent key with `missing-key`) and
unconditional `put`; there is **no conditional CREATE**, so nothing in Team code can make a
first write conditional, and no re-read can restore detection once the winner's commit has
been overtaken. Per ROUTER_RULES §5 / DevPlan §32, fixed format:

```text
blocker type:            CORE_SEAM_BLOCKER
seam name:               StorageKvTable (public storage-domain Kv table seam) —
                         `put` (unconditional create) vs `update` (atomic write-chain
                         read-modify-write, rejects an absent key with `missing-key`)
Host SHA:                639ed015397290b3745d163aafe02ffee4aa3f84 (0.2.0-rc.2)
Required behavior:       a create that is conditioned on "this key does not exist", whose
                         comparison runs inside the domain write chain and reports a named
                         conflict when the key was created by someone else in the meantime
                         (i.e. conditional create / putIfAbsent / create-if-not-exists CAS,
                         the create-side counterpart of the existing `update` RMW)
Observed public behavior: `put` unconditionally overwrites; `update` fails with
                         `missing-key` when the key is absent. No public method expresses
                         "write only if absent". `BaseRepository.putRecord`'s occupancy
                         check is a plain read taken BEFORE the write is enqueued, so its
                         comparison runs outside the write chain and two creators that both
                         read an empty key both commit, neither reported.
Minimal reproduction:    packages/runtime/test/a4-compat-coldstart-interleave.test.ts,
                         leg C4 ("the bounded residual — a create overwritten AFTER the
                         loser re-read"): the loser's create commits on top of the winner's
                         committed row after the winner already re-read it; the test asserts
                         both creates committed unreported and the finished caller's
                         fingerprint differing from the row's. Deterministic 5/5.
Affected invariant:      "a consultation that returns a verdict returns the durable state
                         its own environment produced" — the durability half (ONE complete
                         row, no absent window, no tear, no false generation) holds and is
                         pinned; the DETECTABILITY half cannot hold for a lost cold create.
Upstream generic seam proposal: add a create-if-absent transition to the public Kv table
                         surface — e.g. `putIfAbsent(key, value): {applied: true} |
                         {applied: false, current}` or an `update` that accepts
                         `expectAbsent: true` — resolved inside the same write chain that
                         already serialises `update`, with a named conflict result. Generic
                         (no Team semantics), composes with the existing RMW, and would let
                         `CompatibilityRepository.replaceIfGeneration(record, 0)` report the
                         loser exactly as it already reports a lost generation CAS.
Status:                  the residual is DISCLOSED in
                         `packages/storage/repositories/compatibility.ts`
                         (`CORE_SEAM_BLOCKER` notes) and now PINNED as a leg, so it cannot
                         silently grow. No upstream patch applied, none proposed to the
                         Team tree.
```

### Bounded consequence of the residual (who can believe what, for how long, what fixes it)

* **Who:** one consultation of one root session — the *first* creator in a cold race whose
  own create was later overwritten by a second first-time creator **after** it had already
  re-read its row (leg C4). Requires two authorities whose environment reads straddle a
  capability-generation bump, both hitting an empty `compatibility` key.
* **What it may believe:** `admit`/`OPEN` at the correct (durable) **generation**, with a
  **fingerprint its own environment did actually read** — but which no longer identifies
  the row it read, because the row now carries the other environment's fingerprint. It
  never learns that a different environment's facts are the durable ones. Every
  *durable* property stays correct: exactly one complete record, generation 1, no absent
  window, no torn/merged row, no false generation, and one surplus `team_sessions`
  stamp-lag advance (a counter, not a state).
* **For how long:** until that environment's next consultation. The next
  `admit`/`evaluate` computes the same live fingerprint, finds the row carries a different
  one, re-probes and advances the generation. Pinned green by
  *"the refusal is transient: the next consultation of the same environment establishes its
  own generation"* and by leg C4's own read-back.
* **What re-reads fix:** a re-read fixes *everything except* the ordering. With the fix in
  this branch, a consultation whose re-read lands **after** the overwrite fails closed
  (`state-mismatch`) and converges on the next round; the fingerprint chimera at both
  entry points (`admit` and the raw `evaluate`) is gone. Only the case where the loser's
  re-read lands **before** the winner's commit stays undetectable at the Team layer, and
  that one needs the conditional CREATE above. The post-write re-verify alternative
  (re-read inside `replaceIfGeneration`'s cold path) was considered and rejected: it adds a
  read per create and a false-positive mode, rewrites that module's LAW docs, and buys no
  detection the authority gate does not already provide for the ordering it can observe.

## Not touched

`master`, other worktrees, `:3080` and every DSH_HOME world, `testkit` shared fakes, the
`packages/runtime/compatibility/index.ts` public surface (the new spec imports
`CompatibilityEvaluation` from the module that owns it rather than widening the barrel),
and every pre-existing witness.
