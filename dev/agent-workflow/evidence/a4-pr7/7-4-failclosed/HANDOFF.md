# A4-PR7 §7.5 — prerequisite-by-prerequisite handoff (7-4 fail-closed lane)

Lane: `feat/a4-74-failclosed` (worktree `.worktrees/a4-74-failclosed`), base
`6174f1e5`, merged `258d2b48` (PR #179) and `2162f6a7` (PR #180) — merges, never a rebase.
Every artifact of this lane is inside this directory; nothing was written into any other tree.

The question this handoff answers is the one §7.5 asks before its deletion step: **is the
corpus now one where a rise is always answered by an authority law, so that deleting
`leaderEnvelopeCoverage` tests a deletion rather than an accident?**

---

## Prerequisite 1 — the ceiling is asked at the width the mutation claims

**SATISFIED. Landed before this lane existed; this lane did not re-implement or re-derive it.**

* Commits `20230014` ("the ceiling is asked at the width the mutation claims; the width pin
  lands") and `d6352de2` ("own the ceiling at the commit boundary and at the point set") are
  both ancestors of this branch's `HEAD` (verified with `git merge-base --is-ancestor`).
* The ask site in the current tree: `packages/runtime/governance/service.ts:1501` (the
  point-set statement: cell first, then the claimed width `region.mutationMatcher`, first
  refusal wins, deduped) and `:1534` (the dedupe where `mutationMatcher` equals `region` in
  the common case).
* This lane's change cannot weaken it: the new refusal fires **only** when the lane wired no
  reader at all, i.e. on a path where no width was ever asked. When a port exists, control
  reaches the pre-existing ask unchanged — pinned by leg N6 (a wired lane with the same rise
  commits) and by PIN-1/PIN-2 staying green.
* **No insufficiency found**, so nothing is escalated against it. What I looked at, to be
  concrete: whether a rise could reach the append without any width being asked — before this
  commit it could, but by the *port-absent* route (prerequisite 3), not by a width-evaluation
  route. Those are different defects and only one of them was mine.

## Prerequisite 2 — the width pin exists and is registered

**SATISFIED. Landed and registered; the earlier "3-leg inert copy" reading was wrong.**

* `packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts` is a tracked file at
  **26 867 bytes** (`git cat-file -s HEAD:…`).
* Re-run on this tip: **`8 passed (8)`** — `width-pin-rerun.log`.
* Its legs sit inside the population census (6273 registered legs on the merged base), so it
  is executed by the whole-suite runs, not merely present.
* The record correction, written down because it cost rounds: the misleading artifact was a
  parked `…test.ts.inert` copy inside `dev/agent-workflow/evidence/a4-ceiling-coverage/`. A
  parked copy in an evidence directory is **not** a statement about the tree. It is listed in
  FINDINGS §6 as an instrument that lied.

## Prerequisite 3 — the no-context / no-port branch is a refusal, not a silent commit

**SATISFIED BY THIS LANE** (commits `70266cc7` + `95182ee5` + the artifact/test-pay commits).

Every path by which the ceiling gate can end up with no ceiling context, enumerated by me,
with its status:

| # | path | status on this branch | instrument |
| --- | --- | --- | --- |
| 1 | the lane wired **no** `authorityCeiling` port (the conditional spread at `root.ts:2899` answered "no port") | **REFUSES**: `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` + `problem: authority-ceiling-port-absent`, zero write; rise-scoped; leader and human alike; the classification's own refusal propagates as itself | `a4p7-ceiling-no-port-refusal` N1–N4, N6; PIN-3 (inverted); PIN-5 (strengthened); `a4p7-ceiling-refusal-wire` W2/W3 for the transport |
| 2 | the reader answers `undefined` for a **DECIDED pre-v3 (v1/v2)** binding | **STILL COMMITS**, untouched — A5-12's existential is the only answer allowed to skip, and this lane deliberately did not widen it into path 1 | N5 pins it standing; the pre-existing `a4p7-ceiling-no-context-refusal` leg 5 still owns it |
| 3 | the reader answers a context whose document slot is `unavailable` (unreadable v3 / unresolvable hash) | **already refused** by the pre-A4-PR7 law, code `EFFECT_CONTEXT_UNAVAILABLE`; this lane changed neither the code nor the ordering | unchanged legs of `a4p7-ceiling-no-context-refusal`; W2 asserts the two context faults stay told apart on the wire |

Path 2 was the one open sub-question; **it is now measured, and the answer is no**.
`facts.blueprintSchemaVersion` can only ever answer `3` or nothing, because its sole
producer is the strong parse and `validateBlueprintDocument` throws `SCHEMA_VERSION_MISMATCH`
for every version outside `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`. A pre-v3 document is
therefore not a fact the shipped composition can observe about a bound Team, only a fact it
refuses, and an unresolvable binding already lands on the refusal. Pinned by legs **R1-R4**
of `a4p7-ceiling-no-port-refusal.test.ts` (suite now 10 legs), which drive the real
`createAuthorityCeilingReader` over the real facts at six reachable bindings and count
**0** `undefined` answers; R4 holds the door open by hand so that re-opening the bridge
reddens R2 rather than passing silently. The committing branch is untouched and the 59-red
price is not owed. Measurement and table: `REPAIRS.md` §5.

### What the deletion lane inherits

* `shipped-newly-refusing = 0` (FINDINGS §2 number (c)). The shipped composition injects the
  port (`host.ts:2703` is the sole producer), so no deployment path changed verdict; what
  changed is that a mis-wired lane can no longer commit, and that a ceiling verdict reaches a
  remote caller as itself instead of as `internal-error`.
* `leaderEnvelopeCoverage` (`permission-mutation.ts:1419`, called at `:1390`) is **untouched**
  by this lane. It becomes executable the moment this merges, and the corpus it will be tested
  against now has no path where a rise is answered by nobody.
* Disclosed cost of the ruling: **54 fixture legs** across five files, 51 of them refusing on
  a drive that was *seeding authority through the open gate*. **Paid in `7f382ac7`**, at the
  seam: five worlds each got one injection that declares the authority world the fixtures
  assumed (three of the shapes are literally the production line `host.ts:2703`), and three
  legs needed the recorded judgement because their state stopped being constructible. No
  assertion was edited to match new output; the 54 identities, the three re-scopes with old
  and new titles, the seven bite classes, and the final identity diff are in
  **`REPAIRS.md`** / **`bite/README.md`** / **`bill-check.txt`**.
* **Two corpus defects this lane surfaced and closed, because the deletion lane would otherwise
  inherit them blind:** the §7.6 gate's `<output>.held-by-7-6-gate` hold-aside directory races any
  source walker that skips only the literal name `dist` (FINDINGS F-11; plant-and-reproduce in
  `bite/` class G), and an `Error: STACK_TRACE_ERROR` red in a full run is a 5000 ms timeout with
  its message stripped (FINDINGS F-12 — read `assertionResults[].duration` before believing
  anything else).
* **What that gives the deletion lane, concretely:** a corpus where a rise cannot be answered
  by nobody is now also a corpus that *passes*, so `leaderEnvelopeCoverage`'s deletion can be
  tested without first re-authorising 54 fixtures. Two of its traps are pre-documented here:
  a declared ceiling is a **cell set**, never `any` (FINDINGS F-8), and an approval-wired
  fixture answers refusals through the durable **ask** path, which needs the team-root binding
  row (FINDINGS F-10).

### Verifying this handoff in one screen

    git log --oneline -7
    npx vitest run packages/runtime/test/a4p7-ceiling-no-port-refusal.test.ts \
                   packages/runtime/test/a4p7-ceiling-refusal-wire.test.ts \
                   packages/runtime/test/a4p7-ceiling-port-assembly-pin.test.ts \
                   packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts   # 10+5+6+8 = 29 legs
    npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts                    # 29 legs green
    # the five repaired worlds, with this lane's instruments and the scan referee:
    npx vitest run packages/runtime/test/a3p3-permission-mutation-authority.test.ts \
                   packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts \
                   packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts \
                   packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts \
                   packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts \
                   packages/runtime/test/a4p7-ceiling-no-context-refusal.test.ts \
                   packages/testkit/test/p4t6-session-event-scan.test.ts            # 10 files, 162 legs
    node -e "import('./packages/testkit/fault-injection/session-event-scan.mjs') \
      .then(m => console.log('referee =', m.scanSessionEventVocabulary({}).filesScanned))"   # 1036
    # the spendable bill, if you want it from a run rather than from me:
    npx vitest run --reporter=json --outputFile=/tmp/tip.pop.json   # 502 files / 6277 legs /
                                                                    # 19 titled reds = baseline,
                                                                    # NEW 0 against the base side
