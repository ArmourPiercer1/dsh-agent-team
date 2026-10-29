# u7r3-c1-sa — C1 arm: subagent amplification refusal GRADED (offline) [+ list_agents arms]

Lane: U7-R3-C1-SUBAGENT (27b seat). Harness-only C1; zero product changes on the
merged head (mutations below were throwaway runs, reverted; `git status` src-clean
before every commit — see the `SRC_CLEAN` receipts in the lane session).

## What the live cell proves and why it cannot grade L3

`ac:spawn-failclosed` (live C2 suite `tests/world-factory/suites/080-u7-agent-control.mjs`,
judge in `tests/world-factory/lib/u7fa-assembly.mjs`): the verdict law for that case
has **no PASS branch** — the DESIGNED answer IS a typed refusal, and the file's own
verdict law records refusal-that-is-the-answer **VERBATIM as REFUSED, "never promoted
to PASS"**. Witnesses: head `refused-agent-control agent-control-amplification-refused
— … the mount carries no caller-authority snapshot … (fail closed)`,
`controlRowsForSubagent === 0`, zero spawn. Hence the ledger subagent L3 note (PR
#464/#456 precedent semantics): the record grades the case REFUSED, not PASS → cannot
back a PROVEN level. The same live suite shows the OTHER shape: `ac:interrupt-foreign-zero`
grades a refusal PASS by its witness set (typed head + zero Control rows + zero RAN).

## The C1 arms (this lane)

`packages/runtime/test/u7-f-agent-control-c1.test.ts`, new group "u7-f C1 L3-grade arms"
(+6 arms, AC-60…AC-65): the QUADRUPLE — (1) typed head, (2) ZERO port calls, (3) ZERO
Control rows (empty Control-leg audit: fence BEFORE the PA edge), (4) ZERO `RAN`
observe witnesses — as REAL assertions, each refusal paired with a FLIP (same world
where the shape allows, else the pair world differing only in the refused arm) proving
the zero is a refusal, not a dead mount (admitted call RANS: port 1, audit 1, RAN 1).

- AC-60: fail-closed spawn (live `ac:spawn-failclosed` mirror; current-product surviving
  form = present-but-unbounded snapshot — retarget disclosed in the group header, the
  live record bound pre-Tier-A teamSha ab8a5f236), pair-world bounded flip.
- AC-61: provider-outside-caller over a bounded record, SAME-world within-authority flip.
- AC-62: Tier A ceiling route arms {provider, model, effort, background} all refused,
  SAME-world route-free flip RANS.
- AC-63: continuable amplification, SAME-world one-shot flip.
- AC-64: list_agents ask lane with NO Control leg → typed `APPROVAL_REQUEST_UNAVAILABLE`,
  catalog NEVER read (honest zero), zero RAN, no roster bytes echoed; pair flip RANS
  (offline `ac:enumerate-governed` shape). Answers the ledger note "no list_agents
  refusal case in the #406 C2 suite" at C1.
- AC-65: list_agents DENY leg (offline mirror of the live `u74a:list-deny-leg-honest-zero`
  shape): ask OPENED and settled DENY, body never ran, honest zero, no echo; flip RANS.

## TDD receipts (all on this head)

- RED statement: on base, the amplification/refusal witnesses had NO PASS-grade arm in
  the C1 suite (the ledger note IS the red statement — PR #456 precedent); baseline
  suite 41/41 green before the change; `AC-60…AC-65` absent.
- Mutation sensitivity (throwaway, reverted, `SRC_CLEAN` after each):
  - `M1-fence-disabled.txt`: subagent amplification fence disarmed (`if (false)`) →
    **AC-60/61/62/63 RED** (plus same-fence AC-24/25/26b/26c) — 8 failed / 39 passed.
  - `M2-deny-bypassed.txt`: PA deny lane bypassed → **AC-64/AC-65 RED** (plus same-lane
    AC-31/34/44) — 5 failed / 42 passed.
  - 2/2 mutants killed by the new arms; src verified clean after revert.
- GREEN: `u7-f-agent-control-c1.test.ts` **47/47 ×3**; `u7-ac1-subagents-port-c1` 22/22;
  `a5p7-lane-hygiene` 5/5; `tsc -p packages/runtime` exit 0; `eslint` clean.

## Honesty (exactly, no softer)

C1 = offline/mocked grading of the refusal LOGIC and zero-effect accounting
(USER-RULING-20261029B §2). These arms PASS-grade the witnesses offline; they are NOT
the L3 grade. subagent L3 and list_agents L3 stay **NOT_VERIFIED**: PROVEN needs a LIVE
C2 PASS-grade record; no live boot was run or claimed here. The C1 stand-in control
legs mint no durable Control row (a5-m1-control-legs header) — "zero Control rows"
grades offline as "the PA edge was never reached"; durable-row accounting is C2's.
