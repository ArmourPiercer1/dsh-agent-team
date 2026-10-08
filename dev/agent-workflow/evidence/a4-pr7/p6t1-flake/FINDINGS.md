# FINDINGS — p6t1-parallel flake (A4-PR7 instrument lane, p6t1-flake)

## 0. VERDICT

**The family was not flaky. The product was racy, and the family had no way to say so.**

`packages/runtime/test/p6t1-parallel.test.ts` solo at rest, `rm -rf packages/testkit/test/.tmp-fault`
before each run, strictly one vitest at a time: **4 failures in 20 runs at `ac54ffb8`**
(`before-transcript.txt`) → **0 in 20 on `de18a7bc`** (`after-final-transcript.txt`), plus 0/20 on the
pre-mutation-table tree (`after-transcript.txt`). Under 32-way CPU load: **4/10 before, 0/10 after**
(`before-load-transcript.txt`, `after-load-transcript.txt`).

It is **not** a sleep, **not** a `Promise.all` arrival order, **not** a durable-state read taken too
early, and **not** a shared fixture. Step 6 of the activation provider consulted the compatibility
authority **outside the provider's per-team chain**, and that consultation is not a read: on a cold
generation it re-probes and **writes**. N parallel activations of one cold team interleaved the
read-modify-write; the loser was refused with `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL` — a refusal
from outside the admission vocabulary, counted by the family as just another number. Whether the
race was visible at all came down to whether two probes' `computedAt` stamps landed in the same
millisecond, because the repository treats byte-identical rows as an idempotent no-op and
byte-different rows as `RECORD_DUPLICATE`. **Green was a clock coincidence, not a property.**

The quota laws are unchanged, verbatim, and the pin still bites (§6).

One exposure is **deliberately not closed here** and is handed back as a question with a
deterministic reproducer (§7).

---

## 1. The measurement (rate, not sample)

Protocol for every row: one `npx vitest run packages/runtime/test/p6t1-parallel.test.ts`, preceded by
`rm -rf packages/testkit/test/.tmp-fault`, strictly sequential (`runloop.sh`, no `&`, no `-P`), per-run
line kept in the transcript, full vitest output per run in `raw/<label>-NN.log`.

| condition | `ac54ffb8` (before) | `de18a7bc` (after) | transcripts |
| --- | --- | --- | --- |
| at rest, solo, N=20 | **4/20** (runs 3, 6, 12, 19) | **0/20** | `before-transcript.txt`, `after-final-transcript.txt` |
| at rest, second block after the fix | — | **0/20** | `after-transcript.txt` |
| under 32 CPU burners, N=10 | **4/10** | **0/10** | `before-load-transcript.txt`, `after-load-transcript.txt` |

Statistics: one-sided Fisher, at rest 4/20 vs 0/20 → p = 0.053; under load 4/10 vs 0/10 → p = 0.043.
Under the base rate p = 0.2, P(0 failures in 20) = 0.0115. The rate numbers are the corroborating
evidence; the load-bearing claim is the **deterministic** pin in §5, which needs no sampling.

**Overlap signature checked, not assumed.** Each run records wall time: at rest 1.04–1.68 s per run
across all 70 runs of the family loop, with no cluster of blow-ups, so no second vitest overlapped
the experiment. The instrument loop was the only vitest running during it; the census and the type
checks were run afterwards, separately.

One product event shows up as up to **five** red legs (base run 3: P1×2 + P3×3). That amplification
is the mechanism by which one ~20 % race was misread as "5 of 9 roots are red, must be the machine".
Base red runs and their legs: run 3 → P1 leg 1-2 + P3 leg 1-3; run 6 → P2 leg 1; run 12 → P1 leg 1-2;
run 19 → P1 leg 1-2. P4 never reddened (see §3).

---

## 2. Captured failure (assertion text and observed values)

`raw/before-03.log`, base run 3 — five legs, five numbers, no cause anywhere in the output:

```
AssertionError: expected 1 to be +0 // Object.is equality   p6t1-parallel.test.ts:167:31   (P1 errors.length)
AssertionError: expected 1 to be 2  // Object.is equality   p6t1-parallel.test.ts:180:30   (P1 committedOps)
AssertionError: expected 1 to be 2  // Object.is equality   p6t1-parallel.test.ts:237:32   (P3 admits)
AssertionError: expected 4 to be 3  // Object.is equality   p6t1-parallel.test.ts:241:31   (P3 refusals)
AssertionError: expected 1 to be 2  // Object.is equality   p6t1-parallel.test.ts:249:29   (P3 durable members)
```

The rejection that produced all five, recovered by instrumenting the provider and re-running until it
spoke (`raw/diag3-*.log`, `raw/diag4-*.log`):

```
ActivationError / ACTIVATION_COMPATIBILITY_BLOCKED_FATAL:
  activation: compatibility could not be established (reprobe-failed) — admission fails closed (invariant 50)
  cause: TeamDomainError / RECORD_DUPLICATE  (a compatibility state for root session 'session-root-p6t1' already exists)
```

Across 110 instrumented runs: **33 chain-failure events, every single one
`reason=reprobe-failed cause=RECORD_DUPLICATE`, zero of any other reason**, and the correlation with
red runs is 1:1 (14 red runs each carried ≥ 1 event; 26 green runs carried none). The quota law was
never the thing failing.

---

## 3. Per-leg diagnosis (what each leg actually waits on)

| leg | what it waits on | mechanism that broke it |
| --- | --- | --- |
| P1 "two activated results…" | `Promise.all` **settle** of 2 activations; then durable reads | wall-clock ordering **inside the product**: the two re-probes' `computedAt` straddled a ms boundary → second `put` → `RECORD_DUPLICATE` → one activation refused itself → `errors.length = 1` |
| P1 "two COMMITTED operations, two members…" | same snapshot, read **after** the settle (not early) | same event, downstream count |
| P2 "five activated results…" | `Promise.all` settle of 5, then durable reads | same race, one of five lost (`expected 2 to be +0` in run 6) |
| P3 "exactly two activations succeed" | `Promise.all` settle of 5 (fixture quotas) | one of the two permitted admissions refused itself → 1 admit |
| P3 "exactly three fail QUOTA_MEMBER_MAX_INSTANCES" | same snapshot | 3 quota refusals **+ 1 compatibility refusal** → `expected 4 to be 3`; the per-error `assertActivationCode` loop would have named the foreign code, but the count assertion fires first and hides it |
| P3 "the three refusals are QUOTA_MEMBER_MAX_INSTANCES identities…" (**new**) | same snapshot | the leg that did not exist: it prints the offending identity immediately |
| P3 "final durable state…" | same snapshot | 1 admitted activation → 1 member, 1 COMMITTED operation |
| P4 "the five P2 instance ids / operation ids / child Sessions are pairwise distinct" | **nothing** — a shared fixture: it re-reads the P2 snapshot | inherited-fault path only. In all four captured base reds P4 stayed GREEN: pairwise distinctness still holds over 4 survivors. P4 is a uniqueness pin, not a count pin — it cannot detect a missing admission, and it inherited P2's fault in run 6 without reddening |

No leg sleeps. No leg polls. No leg reads durable state before the burst has settled. No leg depends
on arrival order — every expectation is a count, a set cardinality or a pairwise-distinctness check,
all order-free. `result.replayed === false` is not an ordering either: five distinct `requestToken`s
are five distinct logical operations, so none may converge an already-durable one.

**No leg asserted an ordering or an in-flight count that the contract never promised, so nothing was
re-derived.** Every base assertion survives verbatim: `expect(` count 24 → 30 and the sorted diff of
`expect(...)` expressions between base and tip contains **only additions** (six), zero deletions.

Contract lines the laws stand on (quoted, not paraphrased):

- TaskDoc §11.7 P6-T1 MUST-TEST "same template parallel" / G6 gate preview "same template N
  simultaneous instances" and "quota race does not over-create" — the five/two/three law and the
  no-over-create law, both asserted exactly as before.
- `activation/provider.ts:148-150` — *"All durable writes for one team are serialized behind a
  per-team promise chain so that concurrent activations of the same team see each other's in-flight
  reservations in the quota and instance-id collision checks."* This is the invariant the fix
  restores; step 6 was writing durable state outside it.
- `compatibility/authority.ts:15-17` — *"…NEVER trusted — it is re-probed inline under the frozen
  trigger… a failed re-probe is a chain [failure]"*. This is why the fix is scheduling and not
  semantics: the chain failure is correct **given** the corrupt write; the write was the bug.
- `storage/repositories/base.ts:148-158` — *"identical stored bytes are a no-op; an occupied key
  hands the existing raw to `onConflict`, which MUST throw a typed `TeamDomainError`"*. This is the
  rule that made the race invisible in one millisecond and fatal in the next.

---

## 4. The fix (production, scheduling only)

`packages/runtime/activation/provider.ts`: the step-6 consultation now runs on its own per-team
promise chain (`compatibilityLocks` / `withCompatibilityLock`), because it performs durable writes.
It is a **separate** chain from `teamLocks`: the consultation is awaited strictly *before* the
activation lock is acquired (the pre-reservation abort region is documented as split at that
acquisition), so routing it through `teamLocks` would make every activation queue behind its own
unfinished tail and self-deadlock.

Effect: the first admission of a cold team establishes the generation and every later admission
**observes it fresh** — which is precisely the reading step 3 was written to perform. No status, no
typed code, no verdict, no law changes. A serializing scheduler cannot weaken a quota: it can only
remove an interleaving that was never permitted.

Artifacts: production source changed, so `pnpm run build` + `pnpm run build:composition` ran in the
same commit (three drifted files: `packages/runtime/dist/.../provider.{js,js.map,d.ts.map}`);
`pnpm check:artifacts:head` on `de18a7bc` →
`verdict=ok compared=1508 drift=0`, *"HEAD carries its own build"*.

---

## 5. The deterministic pin (P5) — no sampling involved

P5 fires the **same law** at the **same cold team** through a provider wired with a monotonic `now`
port, so no two re-probes can share a millisecond and the byte-identity rescue is impossible.

- At `ac54ffb8` with the pin present: **red on every run** — `raw/pin-at-base-{1,2,3}.log`, 2 failed
  legs each (run 3 lost 4 legs because the old coin flip also fired), naming
  `ActivationError/ACTIVATION_COMPATIBILITY_BLOCKED_FATAL` in the diff.
- At `de18a7bc`: green in every one of the 40 at-rest, 10 loaded and 3 pin runs above.

Supporting captures (evidence-only runner, `probe/`, outside the nine roots):

- `probe/discriminator.probe.ts` — one **real** production compatibility row, two writers staged
  exactly like `probe.ts:replaceState()` (`delete` then `put`), differing **only** in `computedAt`:
  `DISCRIMINATOR differentBytes(+1ms)=RECORD_DUPLICATE identicalBytes=no-error`.
  Same schedule, same row, same code: a 1 ms stamp difference is the whole discriminator.
- `probe/repro2.probe.ts` — provider seam, 6 batches of 2 parallel activations, distinct stamps:
  base `raw/repro2-at-base.log` = `6/6 throw ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`;
  tip `raw/probes-at-tip.log` = `12/12 ok:activated`.
- `raw/diag4-*.log` — the natural-clock trace: green run has both probes stamped `…349Z`; red run has
  `…370Z` vs `…371Z` and the loser's `AFTER-PUT` line never prints.

Also added, so a future red self-diagnoses: every rejection is recorded as a `name/code` identity and
asserted as one (P1, P2, P3). A foreign fault now names itself on the first sample instead of hiding
inside a count.

---

## 6. Mutation table — the pin still bites

Both mutants landed **on top of the fix**, so they redden the fixed baseline.

| mutant | site | red legs | green legs |
| --- | --- | --- | --- |
| **M1** over-admit: step-7 quota gate bypassed (a third member of one template admits) | `activation/provider.ts:1153` (`checkQuota`) | P1 none; P2 none; **P3 all 4**; **P5 both** → 6 red | P1 ×2, P2 ×1, P4 ×3 → 6 green (`raw/mutant-m1.log`) |
| **M2** durable over-create: a second member row written per admission, no operation or child Session behind it | `storage/provisioning/coordinator.ts:534` | P1 ×2, P2 ×1, P3 ×4, P5 ×2 → 9 red | P4 ×3 (`raw/mutant-m2.log`) |

M1 reddens exactly the legs that own the quota law and leaves the uniqueness legs alone; M2 reddens
the durable-state legs as well, because the quota reads the durable view — the durable-state legs are
load-bearing, not decorative.

**Disclosed, because a green mutant table can also mean a dead mutant:** M2 was first placed at
`runtime/root-binding/write-port.ts` and then at `runtime/member-residency/write-port.ts`, and the
family stayed **green both times**. Both are off the activation path (proved by dropping an
unconditional `throw` into each: the family never reached it). The correct site is the provisioning
stage machine. A mutation table must be paired with a reachability probe.

Restores, hash-verified: M1 → `sha256sum -c provider-fixed.sha256` = `OK` (fix file intact);
M2 → `git hash-object packages/storage/provisioning/coordinator.ts` = `d4c6562adcdafd210c5c954e5e9d929bf2b64a77`
= `git rev-parse HEAD:…coordinator.ts` (byte-identical to base).

**Green family run quoted after restoring: `raw/after-final-01.log`** (first run of
`after-final-transcript.txt`, 12 passed / 0 failed, rc = 0, on the committed tree with both mutants
restored), corroborated by the remaining 19 runs of that block and by
`raw/pin-after-fix-{1,2,3}.log`.

---

## 7. ESCALATION — the race is narrower, not closed (handed back as a question)

The fix closes the **activation** path, which is the family's path and the plugin's admission
surface. It does not close the class:

1. Every other consumer of the compatibility authority still races. `probe/repro.probe.ts` at the
   tip, two concurrent `authority.evaluate()` calls over one repositories object with distinct
   stamps: `REPRO inventory=[["chainOk:OPEN",12],["chainFail:reprobe-failed",12]]` — exactly one
   loser per round, 12/12. Production callers besides the provider:
   `runtime/admission/gate.ts:100` (`admit()`), `runtime/admission/requirement-gate.ts:435`
   (`evaluate()`), `runtime/src/plugin/root.ts:1388` (memoized authority behind
   `enforceCompatibilityGate`). No nine-root red is currently attributable to those paths, so this is
   a structural exposure, not an observed failure.
2. `compatibility/probe.ts:replaceState()` is still `delete` then `put` — non-atomic by design
   ("*delete + put: the repository has no upsert; see the module docs for the crash window*"). Its
   doc block claims the replace is *"serialized on the same `team_domain` write chain"*, but
   `putRecord`/`deleteRow` go straight to `table.put`/`table.delete` (`repositories/base.ts:140-170`);
   only `updateRaw` is documented as *"Atomic read-modify-write on the domain's write chain"*. **The
   module believes it is serialized on a path where it is not.** That documentation claim is itself a
   finding.
3. Consequence of (2) that the provider fix does not remove: if a losing writer's `delete` lands
   *after* the winner's `put`, the row can be momentarily absent at the winner's post-probe re-read →
   `no-state-after-reprobe`. Zero such events in 110 instrumented runs, so it is rarer than the
   observed branch, but it is not excluded.

**The question, for the compatibility lane (P7-T1 / P8-S4A owners), not for an instrument lane to
decide:** when an inline re-probe loses the write race, is the correct disposition
(a) **convergence** — continue when the durable row now carries the live fingerprint, since
freshness is exactly what step 3 exists to establish and the row is then verifiable, or
(b) **atomicity** — give the compatibility state a real atomic replace (a storage primitive, since
`put` rejects an occupied key by contract), so no loser exists to disposition?
(a) is a semantic decision on a governance plane; (b) changes a documented crash window that
P7-T1 pins. Either closes items 1-3 for all callers. Both are bigger than this lane, and neither is
needed to make the p6t1 family honest — but leaving them unwritten would let the next lane call this
class closed.

---

## 8. Residue

- **Zero failures remain** on the fixed tree: 40 solo runs at rest (two independent 20-run blocks),
  10 under 32-way load, plus 3 pin confirmation runs. No residue to characterise in this family.
- The 19 titled reds and 3 collection-error files of the baseline are untouched (§9), including the
  pre-existing `p6t1` neighbours in `p6t3-mediation` / `p6t3-restart`; none of them is this race
  (they are identity-set-identical to the baseline, `NEW 0 FIXED 0`).
- The fix makes the cold-team burst **sequential** in step 6. Serial cost is one extra
  consultation per queued activation; measured total runtime of the family is unchanged
  (vitest total 765–892 ms after vs 674–761 ms before, same 1.15–1.68 s wall band). If a future
  profile shows step 6 on a hot path, the atomicity option (b) is the one that scales.
- Scratch probes (`probe/*.probe.ts`, `scratch/`) are evidence-only, run through their own vitest
  config, and are **not** collected by the nine roots (`packages/*/test/**`): the census file count
  is unchanged by them (§9).

---

## 9. Battery (all nine roots named; commands and outputs in `FINAL-BATTERY.txt`)

- **Nine-root census** (`packages/{contracts,domain,legacy,remote,runtime,storage,testkit,tools,client}/test`,
  full `vitest run --reporter=json`): measured **505 files / 6288 registered legs**
  (per-root files: runtime 353, testkit 29, client 27, domain 26, storage 23, remote 15, contracts 13,
  tools 12, legacy 7). Baseline `population-baseline/nine-root-2162f6a7.md` re-confirmed at
  502 files / 6277 legs. Totals move with the corpus, so the comparison is by identity:
  `node scripts/fail-set.mjs diff` → **baseline = 22, current = 22, NEW 0, FIXED 0**
  (`census-baseline-identities.txt` vs `census-tip-identities.txt`). The three collection-error files
  are the same three; no red resolved into a collection error.
  The +3 files / +11 legs are PR #191's three scenario-gap specs (+8 legs) and this lane's three new
  legs (`p6t1-parallel.test.ts`): `the three refusals are QUOTA_MEMBER_MAX_INSTANCES identities and
  nothing else`, and P5's `every burst admits EXACTLY two of five…` / `every burst ends with exactly
  two members…`. Named here rather than left as a count delta.
- `a4p7-merge-gate.test.ts` **29/29**, untouched by this lane (`git status` shows no write to it).
- p4t6 derived total: `filesScanned = 1039` — unchanged, measured on a clean tree (no new file was
  added under `packages/**`).
- `pnpm --no-bail -r run typecheck`: rc 0, zero `error TS`.
- `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`:
  **new 0, resolved 0** (76 distinct identities, 1118 files linted).
- `pnpm run lint`: **160 problems (128 errors, 32 warnings)** — the recorded base state, unchanged;
  neither touched file appears in the output.
- `node scripts/verify-blueprint-version-clean.mjs` (run **after** `git add`): output byte-identical
  base → tip (`blueprint-clean-diff.txt` empty; `verdict: dirty-or-unknown`, rc 1 on both sides, the
  same 6 offending files, none of them mine).
- `pnpm check:artifacts:head` on `de18a7bc`: `verdict=ok compared=1508 drift=0`.
