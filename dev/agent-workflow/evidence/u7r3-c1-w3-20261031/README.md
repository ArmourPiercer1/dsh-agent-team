# u7r3-c1-w3 — C1 wave 3: the four ungoverned-refusal-grading rows GRADED offline

Lane: U7-R3-C1-W3 (27b seat). Harness-only C1: **zero product changes on the head** —
the five disarms in `mutants.txt` were throwaway runs, each reverted with `git checkout --`,
and both full-suite runs were executed on the reverted tree (`green-runs.txt`, §"Tree state").
Base: `origin/master` @ `9f0c7b6146984f89c49b27d2b5d7ef6562cbd8b2`.

## Files here

| file | what it is |
| --- | --- |
| `red-gap-base.txt` | RED: the 16 new case ids counted on the BASE BLOB — 0 occurrences, last id on base is AC-65. |
| `measured-refusal-shapes.txt` | every asserted string read off the product through a scratch probe (deleted before commit), incl. the port-leg / audit-length / RAN census per call. |
| `mutants.txt` | five targeted disarms, their measured red sets, and the revert proof. |
| `ledger-note-sync.txt` | Task B: the five `OPEN` -> `MERGED @<sha>` note strings, with a parsed-JSON leaf walk proving nothing else moved. |
| `green-runs.txt` | the two identical full-suite runs, the per-gate legs, and the environment preconditions this worktree needed. |

## What was missing (the gap statement)

Four ledger rows — `subagent_fork`, `send_message`, `list_subagent_models`, `workflow` —
carry `L3-refusal NOT_VERIFIED` with the note "no live <row> case in the #406 C2 suite",
and unlike `subagent`/`list_agents` they had **no offline grading arm either**. The
existing AC-20..AC-29 group touches three of these rows but only proves the zero FACT
(typed code + zero port calls): it never witnesses the refusal HEAD, never counts Control
rows, never counts `RAN` observe lines, and never flips — so a disarmed fence would have
left that group green (mutants M3/M5 show exactly that: the pre-existing arms catch M3,
and only the new arms catch AC-70/AC-71/AC-80 in their graded form).

## The arms (this lane) — AC-66 … AC-81, 16 arms, same file, same QUADRUPLE discipline

Quadruple = typed `refused-agent-control <code>` head + ZERO port calls + ZERO Control rows
(empty control-leg audit = the fence sits BEFORE the PA edge) + ZERO `RAN` witnesses; every
refusal paired with a flip (same world where the shape allows, else a pair world differing
only in the refused arm) so the zero is a refusal and not a dead mount.

- `subagent_fork` — AC-66 fail-closed fork (present-but-unbounded snapshot, the AC-60
  head-on fork wording) + pair-world bounded flip; AC-67 amplifying continuable fork under
  BOTH the Tier A ceiling seat and a bounded non-continuable caller, SAME-world one-shot
  flip; AC-68 the fork cannot even EXPRESS a route (`provider`/`model`/`reasoning_effort`/
  `scopeKey`/`tools` refused whole at the closed grammar) + SAME-world arm-free flip;
  AC-69 context is DATA (authority-shaped context AND a faulted context source) + pair-world
  pure-data flip asserting what actually crossed to the child (`context` data only, `spec`
  without an authority arm).
- `send_message` — AC-70 five out-of-scope target shapes (structural foreign scope,
  byte-inexact own-scope case variant, off-roster bare id, sibling member's child shape,
  whitespace near-miss) each refused with the quadruple and ZERO delivery + SAME-world
  in-roster delivery flip (steer 1, ask 1, RAN 1) and no payload bytes echoed; AC-71 the
  UNATTRIBUTED mount (no durable roster) fails closed BEFORE the PA edge + pair-world roster
  flip; AC-72 the DENY leg: the ask OPENS and settles DENY, ZERO delivery, ZERO RAN + flip.
- `list_subagent_models` — AC-73 ask lane with NO Control leg: `APPROVAL_REQUEST_UNAVAILABLE`
  with the route catalog NEVER enumerated (honest zero, no route bytes) + pair-world mounted
  flip; AC-74 DENY leg, same honest zero + flip; AC-75 the default-DENY template lane before
  the PA edge + flip, and the MEASURED disclosure that a rule-shaped deny over the
  model-routes view is unprojectable (the mount itself refuses), so no arm pretends a lane
  the product rejects.
- `workflow` — AC-76 closed grammar refuses an authority/route-restating ROW arm whole with
  zero Control rows, zero `runWorkflow`, zero `spawnChild`, zero RAN + SAME-world in-grammar
  flip that spawns exactly one child; AC-77 ask lane with NO Control leg — a workflow that
  cannot ask creates NO agent-controlled child — + pair-world flip; AC-78 DENY leg (ask
  opened, settled deny, driver never runs) + flip; AC-79 SPAWN-AMPLIFICATION at the
  caller-bound delegate over five widening lanes (provider/model/tools outside the caller,
  a step restating `authority`, a step restating `caller`): typed step refusal, ZERO child
  reach, ZERO child RAN, ZERO Control ask beyond the row's own + SAME-world in-authority
  spawn flip carrying `spec.viaWorkflow`; AC-80 the STEER leg (foreign scope, off-roster id,
  child shape) with ZERO delivery + SAME-world in-roster delivery flip; AC-81 the
  PRODUCTION posture with no injected port at all: `agent-runtime-leg-unwired`, zero reach,
  zero children — the disclosure that the live driver leg is not this pin's claim.

## Honesty (exactly, no softer)

C1 = offline/mocked grading of refusal LOGIC and zero-effect accounting
(USER-RULING-20261029B §2). These arms PASS-grade the witnesses offline; they are NOT the
L3 grade. All four rows keep **L3-refusal NOT_VERIFIED**: PROVEN needs a LIVE C2 PASS-grade
record, and this lane ran **zero boots** (the boot pool was never entered). The C1 stand-in
control legs (`a5-m1-control-legs.mjs`) mint no durable Control row, so "ZERO Control rows"
grades offline as "the PA edge was never reached" — durable-row accounting stays C2's.
Two witnesses were deliberately NOT claimed: `audit == 0` for the workflow
spawn-amplification arm (the row's own PA admission legitimately lands first — see
`measured-refusal-shapes.txt` finding 2), and any deny-LANE decision for
`list_subagent_models` (the projection refuses the mount for such a rule — finding 1).

Ledger: five notes' `(PR #46N, OPEN)` tokens became `MERGED @<9-sha>` (#464 `458d7ac87`,
#467 `0be20e0f5`, #468 `1227cbfa6`); no acceptance state moved, no other field moved
(`ledger-note-sync.txt`).

