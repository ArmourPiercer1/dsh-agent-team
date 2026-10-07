# Does deleting `leaderEnvelopeCoverage` loosen the limit? — measured, not read

Worktree `.worktrees/rr-ceil`, branch `probe/a4-ceiling-coverage` @ `991348e0` (== origin/master).
Mutant kept in `probe-mutant.patch`; failing-identity sets in `*.ids.txt`; the new pin test is
`packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts`. Nothing pushed; port 3080, `stable`
and every other worktree untouched.

## 1. What the ceiling path actually decides

`createPermissionAuthorityCeilingJudge` (`packages/runtime/governance/service.ts:1288-1369`) answers one
question per **rising cell**: *is the meet of the binding documents' ceiling AT THIS CELL ≥ the risen
effect?* The scope it asks about is fixed at `service.ts:1294`:

```ts
const scope = { operationClass: region.operationClass, matcher: region.region }   // :1294
```

`region.region` is the **rising cell**, never `region.mutationMatcher` (the whole mutation matcher the
Leader wrote). `mutationMatcher` is recorded at `permission-mutation.ts:1267-1277` and read by exactly
one consumer: `leaderEnvelopeCoverage` at `:1378`. On the ceiling path it is dead data.

Documents bound for a Leader: `BOUND_AUTHORITY_DOCUMENTS.leader = ['teamHardEnvelope',
'permissionMutationEnvelope']` (`governance/authority-ceiling.ts:302`), met per cell
(`expansionCeiling` `:395-425` + `meetAuthorityCeilings` `authority-envelope.ts:313-330`). Absent hard
document ⇒ `no-authority` (`authority-ceiling.ts:416`); `evaluateAuthorityCeiling` at `service.ts:1326`
is a refusal **detail** only — its verdict is never consulted.

| Condition (from the JSDoc at `permission-mutation.ts:1360-1367`) | Leader-envelope path today | Ceiling path (`evaluateAuthorityCeiling` lane) |
| --- | --- | --- |
| **operationClass agreement** | enforced: `if (rule.operationClass !== region.operationClass) continue` (`:1376`) | **enforced, different form**: same-class filter `authority-envelope.ts:383`; zero same-class covering rule ⇒ `no-match` (`:398`) ⇒ `CEILING_NO_AUTHORITY` (`:419`) ⇒ `insufficient` (`service.ts:1355-1365`) ⇒ `AUTHORITY_CEILING_INSUFFICIENT` (`permission-mutation.ts:1567`) |
| **effect reach (ladder-strict)** | enforced, **existential**: any one covering rule whose `maximumEffect` reaches (`:1377`) | **enforced, and stricter**: the meet takes the **LOWEST** `maximumEffect` of ALL covering rules (`authority-envelope.ts:392-394`) and meets hard ∧ carrier; one low rule caps the cell |
| **whole-matcher width coverage** | enforced: `matcherCovers(rule.matcher, region.mutationMatcher, …)` (`:1378`) | **NOT ENFORCED** — lookup is at `region.region` (`service.ts:1294`); a rule that covers the rising cell satisfies the gate no matter how much wider the mutation matcher is |
| **`coverage-unknown` ⇒ CONTEXT** | enforced: undeterminable verdict ⇒ `coverage-unknown` (`:1379-1381`, `:1389`) ⇒ `EFFECT_CONTEXT_UNAVAILABLE` (`:1284-1294`, `:1341-1348`) | enforced **only when a v3 context exists**: `undetermined` ⇒ `EFFECT_CONTEXT_UNAVAILABLE` (`permission-mutation.ts:1550-1564`). The whole gate is skipped when `lane.authorityCeiling` is undefined, when the reader returns `undefined` (`service.ts:1150`, `:1160`; `permission-plane.ts:890` `if (schemaVersion !== 3) return undefined`, `:903` unresolvable content hash), or for the `human` actor whose lane has no `permissionEnvelope` at all |

## 2. Mutations refused today that a deletion would let through (measured)

Probe harness printed the outcome of the same mutation three ways — no ceiling reader (v1/v2, = what
survives 7.3), with a v3 ceiling context, and ceiling-gate-only. OFF = today, ON = coverage judge
neutered:

| Case | OFF (today) | ON (deletion) | Verdict |
| --- | --- | --- | --- |
| (a) class mismatch: carrier `write`, mutation `bash`, ladder-strict rise | refused both wirings | **COMMITTED** unwired; still `CEILING_INSUFFICIENT` wired | not a gap on v3; **gap** in the branch 7.3 leaves behind |
| (b) effect shortfall: `maximumEffect: ask` vs risen `allow` | refused both wirings | **COMMITTED** unwired; `CEILING_INSUFFICIENT` wired | same |
| (c) **width**: carrier `exact FILE`, mutation `subtree SUB`, only FILE rises | refused **in both wirings** (`expansion-region-uncovered`); ceiling alone is **silent** | **COMMITTED in both wirings** | **THE gap** — a v3 Team with hard ∧ carrier fully wired |
| (c3) same, whole subtree rises | refused | ceiling catches it (`no-authority`) | width survives only incidentally, when other rising cells fall outside the narrow rule |
| (d) `coverage-unknown` (no `subtreeContains`) | `effect-context-unavailable` | **COMMITTED** unwired; `authority-ceiling-undetermined` wired | gap only in the unwired branch |
| (f)/(h) zero-authority carrier; v3 lane whose ceiling reader abstains (unresolved binding / unresolvable hash — `permission-plane.ts:890,903`) | refused | **COMMITTED** | fail-open inside production wiring, not just fixtures |
| (e) control (exact carrier, exact mutation) | commits | commits | unchanged |

## 3. Proof by mutation (not reading)

Mutant: `probeNeuterLeaderCoverage()` (`probe-mutant.patch`) reads an env flag through a `globalThis`
cast — non-constant-foldable — and swaps the judge for `() => 'covered'` at `permission-mutation.ts:1339`.
Flag off ⇒ byte-identical baseline behaviour (confirmed by an identical identity set).

* `pnpm -r run typecheck` with the mutant in place: **exit 0** — the deletion is type-clean.
* Whole repo, `rm -rf packages/testkit/test/.tmp-fault/` first, `pnpm test`:
  baseline **25 identities** (22 TEST + 3 FILE) → mutant **61 identities**;
  `scripts/fail-set.mjs diff` → **NEW=38, FIXED=2**.
  The check is **not** unguarded — 37 named tests go red:
  `a3p3-revoke-reveal-semantics` ×17, `a3p3-permission-mutation-authority` ×8,
  `a3p4-pr4-production-entry-regression` ×7, `a3p4-r4-authority-binding` ×2,
  `a3p4-permission-lifecycle-e2e` ×2, `a3p4-pr7-entry-exec-contract-regression` ×1,
  **+1** = the new pin test (red by design). `FIXED=2` and the `p6t1-parallel` churn are the documented
  ±1–3 flake (that file + `p6t1-helpers.ts` have zero hits for `mutatePermission|permissionLane|governance`;
  4 solo runs: 3 green, 1 with 2 failures). `p4t6-session-event-scan` fails in **both** runs
  (`expected 1022 to be 1020`): it pins the scanned-file **count**, so *adding* the pin test needs its
  per-PR `SCANNED_PATHS_A4PRn` list extended (plan line 271 says exactly this — extend the list, don't
  restate the number).
* Zero `a4p2-*`, `a4p5-*`, `a4p7-*` failures — the v3-wired lanes (26 + 33 + 6 + 70 tests) are
  **completely insensitive** to deleting the judge.

## 4. What must be true before 7.3 deletes it

Conditions 1, 2 and 4 are redundant on the ceiling path *for a wired v3 Team*: 1 and 2 because the
per-cell meet over hard ∧ carrier cannot be satisfied by a mismatched class or a short ladder
(`authority-envelope.ts:383,392-394,419`), 4 because an undeterminable subtree relation absorbs into
`undetermined` (`:386-388`) and maps to CONTEXT (`permission-mutation.ts:1550-1564`). Redundant **with
tests**: `a3p3-permission-mutation-authority.test.ts:387` (effect ladder), `:732` (exec class/fingerprint
exactness, including the `pwsh` sibling-class leg at `:750-759`), `a3p4-r4-authority-binding.test.ts:504`
(carrier `maximumEffect` is the cap), `a3p4-pr4-production-entry-regression.test.ts:1274` (ASK carrier
refuses ALLOW at host apply), `a3p4-permission-lifecycle-e2e.test.ts:510,568` (unknown/faulting
containment is CONTEXT, zero write), plus `a4p1-authority-envelope` / `a4p2-authority-ceiling` /
`a4p2-ceiling-reachability` for the domain algebra.

**Condition 3 is NOT redundant.** Nothing pins it against the ceiling path today:
`a4p2-dual-envelope-mutation.test.ts:86` builds every rise region with `mutationMatcher: region`, so
width is identical *by construction* in all v3-wired fixtures, and `a4p5-self-mutation.test.ts:96` uses
the same matcher for carrier and hard ceiling. The three guard tests the plan names (plan `:722`,
`:825`) all run **unwired** — delete the judge without a replacement and they go green in exactly the
shape that is loose.

Before the deletion, 7.3 must do one of:
1. evaluate the ceiling at `region.mutationMatcher` (the honest reading of "covers the WHOLE mutation
   matcher") — the minimal change is `service.ts:1294` (and `:1330` for the detail), or
2. add an explicit whole-matcher width clause to the ceiling law and a test for it.

Either way, plus: decide the branch where the gate does not run at all — the `undefined` ceiling context
(`service.ts:1150,1160`, `permission-plane.ts:890,903`). If 7.3's cutover makes a v1/v2 Team unstartable
and a v3 binding always resolvable, that branch dies with the cutover and must be pinned as dead (a
refusal, not a silent commit); if any path can still yield `undefined`, deleting the judge makes it
**unbounded**.

The pin test for the gap is delivered: `packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts`
— leg 1 red under the mutant / green today (refusal + zero write), leg 2 proves the refusal is width and
not a bad fixture (subtree-wide carrier commits), leg 3 is the gap written as an assertion (narrow carrier
covers the cell ⇒ `judge()` says `sufficient` and the ceiling gate is silent). Landing it also needs the
`p4t6` scanned-path list extended by one entry.

## 5. Plain answer

**Removal loosens the limit — in one shape unconditionally, and in the rest it is
stricter-but-differently-shaped.** Class agreement and ladder reach are picked up by the ceiling meet,
in a stricter form (lowest `maximumEffect` of every covering rule, met across hard ∧ carrier, absent
document = zero authority) — deleting them there is a genuine redundancy with tests behind it, except
that the redundancy only exists **when a ceiling context is actually wired**. Whole-matcher width is not
picked up at all: the ceiling is asked about the rising cell (`service.ts:1294`), so today's "a narrow
envelope rule cannot authorize a broader mutation" becomes a commit, and that holds even for a fully
wired v3 Team. Direction after 7.3 as currently written: **looser** for width everywhere, and looser
without bound in every branch where the ceiling reader abstains.
