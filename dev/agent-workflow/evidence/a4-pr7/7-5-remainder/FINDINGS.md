# A4-PR7 §7.5 remainder — findings (lane `a4-75-remainder`, base `e80a00da`)

Everything below was produced in this worktree (`.worktrees/a4-75-remainder`, real
`pnpm install --offline --frozen-lockfile` from the workspace store, 3 s). No tracked
file is changed by this lane; the only new files are under this directory.

Transcripts are in `transcripts/`, numbered in the order they were taken. The pristine
copy of the one file I mutated (`packages/runtime/governance/permission-mutation.ts`) is
kept as `transcripts/permission-mutation.pristine.ts` so the restore is checkable by
`diff`, not by my word.

---

## 1. THE MEASUREMENT — the deletion is a retitle for a v3 Team and a widening for a v1/v2 Team

The mutation I ran is the semantic core of the §7.5 deletion: stop injecting the
coverage judge, i.e.

```
- const classification = classifyPermissionRise(input, leaderEnvelopeCoverage(input.envelope, input.subtreeContains))
+ const classification = classifyPermissionRise(input)
```

With no judge, `classifyPermissionRise` leaves `unmet` empty (its own comment at
`permission-mutation.ts:1316-1323` says the mode with no callback "reports the rises
and judges nothing — … why `unmet` stays EMPTY there"), so the
`EXPANSION_OUTSIDE_ENVELOPE` / `'expansion-region-uncovered'` refusal at
`permission-mutation.ts:1400-1408` can never fire. That is what deleting the aggregate
does; deleting the function and the round-5 docstring (`:1411-1418`) is bookkeeping.

The probe (`transcripts/10`, `11`, `12`) drives the **production**
`createAuthorityCeilingReader` at the **real entry** (`mutatePermission`, durable
overlay world) and prints refusal identity + whether a snapshot was written:

| population | at base (`10`, `12`) | with the aggregate deleted (`11`) |
| --- | --- | --- |
| **A. decided v2 Team** (reader answers `undefined`, `permission-plane.ts:972`), Leader rise its carrier does not cover | `refused:true, code:"PERMISSION_ENVELOPE_EXPANSION_DENIED", problem:"expansion-region-uncovered", durable_snapshot_written:false` | `refused:false, code:null, **durable_snapshot_written:true**, rules:["write:exact:file:/srv/a475probe/out.txt:allow"]` |
| **B. v3-wired Team**, documents cover the rising cell but not the claimed width (the shape of the width pin's leg 1) | `refused:true, code:"PERMISSION_ENVELOPE_EXPANSION_DENIED", …, durable_snapshot_written:false` | `refused:true, code:"PERMISSION_AUTHORITY_CEILING_INSUFFICIENT", problem:"authority-ceiling-insufficient", durable_snapshot_written:false` |

Read the two rows together, because they are the whole answer:

* On a **v3 Team** the deletion is exactly what the plan's errata said — *a refusal
  identity, not a hole*. The surviving ceiling law answers the same rise, still with
  zero write. Retitling legs 1/9 of the two A4-PR7 pins is honest.
* On a **decided v1/v2 Team** there is **no surviving law to retitle to**. The ceiling
  reader returns `undefined` for versions 1 and 2 — `permission-plane.ts:969-972`,
  whose own comment says "only those two answers may skip the v3 gate (Alpha.3
  behaviour, byte-identical, **until the cutover retires them**)", and which is pinned
  by `a4p7-ceiling-no-context-refusal.test.ts:317` (leg 5) and by
  `src/plugin/permission-plane.ts:932-954`. The service then skips the gate outright
  (`governance/service.ts:1214` `if (lane.authorityCeiling !== undefined)`,
  `:1220 if (ceilingContext !== undefined)`). Delete the aggregate **today**, before
  the flip, and a Leader of any Team still bound to a v1 or v2 Blueprint commits a
  mutation that is refused right now. That is the precise class the §7.5 conditional
  forbids: *"a deletion that widens an authority limit is not a cleanup"*.

And v1/v2 Teams are not hypothetical at this base: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`
is still `[1, 2, 3]` (`packages/domain/blueprint/src/schema.ts:75`, off-limits to this
lane), and the composition's own boot source `cordis.patch.yml` still declares a v1
blueprint (round 21, "THE FLIP ITSELF STAYS DEFERRED … it strands `cordis.patch.yml:60`
v1 … and `fixtures.ts`"). The width pin's legs 3-5 — the stated reason the deletion is
safe — are all v3-wired, so they cannot see population A.

**Verdict: §7.5's one deletion is gated on §7.3's version flip, not only on its three
prerequisites.** All three prerequisites are merged (SCOPE.md rows 2a/2b/2c); the gate
that is missing is the flip itself, which the coordinator deferred deliberately and
which is off-limits to this lane. Not executed. `BLOCKED`, dependency named:
**§7.3's `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]` + `TeamBlueprint.schemaVersion: 3`
flip (`schema.ts:75`, `types.ts:416`), together with its two stranded carriers
(`cordis.patch.yml`, `packages/domain/blueprint/testdata/fixtures.ts`)**.

### The mutation table (mutation → red, restore → green, in that order)

| step | command | result | transcript |
| --- | --- | --- | --- |
| green baseline before touching anything | 5 suites | **5 files / 96 tests passed** | `01-baseline-five-guard-suites.txt` |
| **mutation applied** | same 5 suites | **4 files failed / 1 passed; 21 failed / 75 passed (96)** | `04`, `05` |
| **mutation applied** | `packages/runtime/test` + `packages/testkit/test` | **15 files failed / 360 passed (375); 49 failed / 4347 tests** | `07` |
| **restore** (verified by grep + `diff` against the pristine copy, not by exit code) | same 5 suites | **5 files / 96 tests passed** | `06` |
| **restore** | `packages/runtime/test` + `packages/testkit/test` | **7 files failed / 368 passed (375); 9 failed / 4338 passed (4347)** — the base set, by identity | `08` |
| probe pair under the two states | one file, three runs | base `refused/wrote:false` → mutant `A: not refused / wrote:true` → restore `refused/wrote:false` | `10`, `11`, `12` |

Failure **identities** were compared, not counts (`07b`, `08b`): **NEW = 40 named tests
in 9 files, RESOLVED = 0**, and every one of the 9 base-red identities is still red
under the mutant (so nothing was traded away either).

## 2. THE POPULATION — what the deletion actually turns off

Measured over `packages/runtime/test` + `packages/testkit/test` (the two packages that
can see this code; that is the scope of the claim, not the whole repo):

| file | NEW reds | what those legs are | classification under the deletion |
| --- | ---: | --- | --- |
| `a3p3-revoke-reveal-semantics.test.ts` | 17 | reveal/ladder/width/all-or-nothing refusals at the Alpha.3 seam; `authorityCeiling` appears **0** times in the file | refusal **removed** (no ceiling law in that world) |
| `a3p3-permission-mutation-authority.test.ts` | 8 | `mutatePermission` Leader refusals; `authorityCeiling` appears **0** times | refusal **removed** |
| `a3p4-pr4-production-entry-regression.test.ts` | 7 | **real host entry**, and its documents are `'schemaVersion: 1'` (4 sites: `:118`, `:491`, `:843`, `:1128`); `authorityCeiling` appears **0** times | refusal **removed** — production-entry widening on v1 documents |
| `a3p4-permission-lifecycle-e2e.test.ts` | 2 | production-entry containment legs; `authorityCeiling` **0** | refusal **removed** |
| `a3p4-pr7-entry-exec-contract-regression.test.ts` | 1 | actor-role matrix through the root-assembled router; `authorityCeiling` **0** | refusal **removed** |
| `a3p4-r4-authority-binding.test.ts` | 2 | B2 (ladder `ask` cap), B5 (deny→allow laundering class) — direct calls of the pure function | refusal **removed at the seam** (nothing else stands there) |
| `a4p7-carrier-width-under-ceiling.test.ts` | 1 | leg 1, the self-declared deletion tripwire | **identity only**: `ENVELOPE_EXPANSION_DENIED` → `AUTHORITY_CEILING_INSUFFICIENT`, zero write kept (probe row B) |
| `a4p7-ceiling-no-context-refusal.test.ts` | 1 | leg 9 (ordering: Alpha.3 answers before the ceiling) | **identity only**: → `EFFECT_CONTEXT_UNAVAILABLE`, zero write kept |
| `a4p7-merge-gate.test.ts` | 1 | the `lint:identities` leg | **my mutant's artifact**, not the deletion's: leaving `leaderEnvelopeCoverage` defined-but-uncalled is a new eslint identity (`1419:10 'leaderEnvelopeCoverage' is defined but never used`, transcript `09`). A real deletion removes the definition too. |

So **37 of the 40 reds are refusals being switched off in a world where the v3 ceiling
gate is not wired at all**, 2 are genuine identity retitles, and 1 is an artifact of the
half-mutation.

Against the plan's line-722 trio (`a3p3-revoke-reveal-semantics`,
`a3p4-r4-authority-binding`, `a4p2-dual-envelope-mutation`):

* the trio accounts for **19 of the 40** reds;
* **`a4p2-dual-envelope-mutation` had ZERO reds** — its only tie to the caller is a
  source-text ordering pin (`:333-340`, `code.indexOf('authorizeLeaderPermissionMutation(')
  < …authorizeCeilingBoundedPermissionRise( … < overlay.append(`), and a real deletion
  keeps that call. It needs **no retitle**. The plan's own lesson ("a reference count
  measures naming, not guarding") applies to its own list;
* the trio **misses 21** reds, including all **10 production-entry** refusals
  (`a3p4-pr4-production-entry-regression` ×7, `a3p4-permission-lifecycle-e2e` ×2,
  `a3p4-pr7-entry-exec-contract-regression` ×1) and the 8 in
  `a3p3-permission-mutation-authority`, and it misses the only two legs where a retitle
  is actually honest (the two A4-PR7 pins).

A lane that "closed §7.5" by retitling the named trio would have landed green while
silently deleting a production-entry authority law for every Team still bound to v1/v2.
That is the same shape as the §7.4 "green-lying" class, arriving from the other side.

## 3. Why the three retitles are not landable early either

Retitling means re-asserting the same rise against **the law that will own it**. On this
tree the surviving law owns population B only; for population A there is no law, so a
"retitled" test would assert *no refusal* — writing the widening into a test name. That
is the trap the plan states for the other half of the phase (`plan:838`): an assertion
written on the wrong side of the flip is green because it asserts a state that does not
exist yet. The honest order is flip → delete → retitle, which is exactly `plan:722`
("inside the 7.3 window").

## 4. What I did NOT do

* **The deletion.** BLOCKED as above. Consequential files untouched:
  `governance/permission-mutation.ts`, `types.ts`, `service.ts`, `index.ts`.
* **The three retitles.** Same gate; §2 gives the next lane the exact 40-name
  population, its classification, and the transcript that produced it.
* **`schema.ts:75`, `types.ts:416`, `cordis.patch.yml`,
  `packages/domain/blueprint/testdata/fixtures.ts`,
  `packages/domain/blueprint/src/schema.ts`/`types.ts` line pins** — off-limits and/or
  the deferred flip.
* **Re-baselining lint** — not needed, `new 0 / resolved 0` (battery).
* **Anything under `docs/**`, `graph.yaml`, `SESSION_ROUTER_LOG.md`** — coordinator-owned.

## 5. Instruments that lied, and how they were caught

1. **`git status` after a mutation is not a restore proof.** My restore script wrote
   the line and exited 0; the check that settled it was
   `diff -q permission-mutation.pristine.ts packages/runtime/governance/permission-mutation.ts`
   → `BYTE-IDENTICAL`, plus `grep -n 'classifyPermissionRise(input'` showing the
   re-attached judge. Last round's lesson (`set -u` abort leaving a mutation applied) is
   the reason I did not trust the exit code, and the pristine copy came from the tree,
   not from my working copy after later edits.
2. **The §7.6 lint leg went red for the wrong reason.** Under the mutant
   `a4p7-merge-gate > the static legs > lint closes as an identity diff` failed, and the
   easy reading is "the merge gate refuses this deletion". It does not: `npx eslint` on
   the mutated file names `1419:10 'leaderEnvelopeCoverage' is defined but never used`
   (`09`), which is an artifact of my half-mutation leaving an orphan. Counting reds
   without reading the identity is what turned a correct instrument into a false alarm.
3. **My first identity diff (`comm`) was a lie of the "filter filtered nothing" kind.**
   I extracted `FAIL` and `❯` lines together, so stack frames entered the comparison:
   it reported base-only "identities" like
   `❯ Object.createRootAgent …/agent-bindings.mjs:3897:15` and 3 collection-error files
   as RESOLVED. Caught by reading the output, then re-derived with a strict parser over
   test titles (`NEW = 40`, `RESOLVED = 0`). The previous round's lesson ("'the filter
   removed nothing' is a broken filter, not a clean set") is the same failure.
4. **`/tmp` is private per bash call, and I hit it in the battery itself.** The first
   fence run wrote `/tmp/a.txt`; the next call's `grep` said *No such file or
   directory* — the near-miss is reading "empty output" as "the fence printed nothing".
   Fixed by keeping artifacts in `.tmp-coord/` and in this directory.
5. **The dispatch's base-debt list is a subset.** In this worktree
   `p6t3-mediation` ×5 and the two `t12a-*` collection errors are red at base too
   (`08b`), as are `t1-capability-schema`/`t2-blueprint-hash` in `packages/domain`. The
   battery number I report is the set I re-derived here, not the list I was handed.
6. **A grep `-c` returning 0 is reported as exit code 1**, which twice looked like a
   failed command (`grep -c authorityCeiling …`, `grep -c FAIL …a4p2…`). Both were real
   zeros. Read the value, then the exit code.
7. **The plan's counts keep being wrong in both directions**, by its own diagnosis: it
   names three guard tests where the measured answer is 40 named tests in 9 files, with
   one named file unaffected. This is the third round the phase has re-learned that a
   count in a document is context, never a work list.
