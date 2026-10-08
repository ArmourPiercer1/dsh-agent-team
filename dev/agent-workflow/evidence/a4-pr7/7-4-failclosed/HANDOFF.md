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

Path 2 is the one **open sub-question** this handoff passes upward rather than resolving:
after the §7.3 flip a v1/v2 binding is only producible through the `migration-required` path
in `blueprint-authority.ts`, so path 2 is plausibly unreachable in the shipped composition —
but that is a ruling, not a measurement I may take silently. For the price of deciding it:
refusing it too measures **59** new reds instead of 54, and the delta is exactly leg 5 plus
the three load-flake legs (FINDINGS §5 F-4).

### What the deletion lane inherits

* `shipped-newly-refusing = 0` (FINDINGS §2 number (c)). The shipped composition injects the
  port (`host.ts:2703` is the sole producer), so no deployment path changed verdict; what
  changed is that a mis-wired lane can no longer commit, and that a ceiling verdict reaches a
  remote caller as itself instead of as `internal-error`.
* `leaderEnvelopeCoverage` (`permission-mutation.ts:1419`, called at `:1390`) is **untouched**
  by this lane. It becomes executable the moment this merges, and the corpus it will be tested
  against now has no path where a rise is answered by nobody.
* Disclosed cost of the ruling, stated rather than hidden: **54 fixture legs** across five
  files now refuse, and 51 of them refuse on a drive that was *seeding authority through the
  open gate*. Their repair is per-file and mechanical-ish (declare the authority world the leg
  assumed), with three legs needing a judgement; none of them is an assertion rewrite. That
  bill is inventoried leg-by-leg in FINDINGS §3 and is **not** paid in this branch.

### Verifying this handoff in one screen

    git log --oneline -7
    npx vitest run packages/runtime/test/a4p7-ceiling-no-port-refusal.test.ts \
                   packages/runtime/test/a4p7-ceiling-refusal-wire.test.ts \
                   packages/runtime/test/a4p7-ceiling-port-assembly-pin.test.ts \
                   packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts   # 6+5+6+8 = 25 legs
    npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts                    # 29 legs green
