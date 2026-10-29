# Decision — two externally-suggested parallel lanes: DEFER, declared + queued — 2026-10-28

Context: during the G4-R boot-lane freeze an external (offline) review suggested opening two
parallel lanes — (A) R-G4R-3 acceptance-check tightening, (B) G5-L3 census/evidence backfill —
"besides the boot lane, declare and open them with wave-1-style mutually-exclusive file sets."
The user forwarded the suggestion and explicitly delegated the call, noting an offline review can
misread state, then went offline. Decision (main agent): **defer both to their pre-existing gates**;
declare them so the suggestion is not lost, but do not create worktrees or touch `scripts/**` now.

## Lane A — R-G4R-3 (acceptance-check tightening): DEFER to post-freeze (unchanged from tracked plan)

- It edits `scripts/eb3-tool-acceptance.mjs` (a judgement-criterion file). The remediation ledger I
  authored and had **independently reviewed and merged** (#433, row R-G4R-3) already times it
  "G5 前置，单独 PR; `scripts/**` 判据文件 ⇒ 同样排在 phase-3 冻结解除后". Changing a judgement
  criterion mid-freeze disturbs the comparability of the very boot records the freeze protects.
- The external reviewer almost certainly did not see that merged timing decision. The suggestion is
  recorded here as an input to that future lane; **timing is not changed**.
- OPEN PRECONDITION: phase-3 candidate `5d0c8ff58…` boot lane finished and records signed off
  (candidate unfrozen). FILE SET (declared, exclusive): `scripts/eb3-tool-acceptance.mjs` + its
  RED-first test only. No overlap with the boot lane's evidence dirs or the gates rulings.

## Lane B — G5-L3 census/evidence backfill: DEFER (G5 product-gate is a reserved matter)

- This is G5 territory. The user's pre-authorization **explicitly excludes** G5 PRODUCT-GATE release
  verdicts and every plan §4 reserved matter ("入账排队等你回来，不代答"). Backfilling L3 product
  evidence crosses into that reserved lane; it is queued for the user, not answered on their behalf.
- Dependency: L3 census (scan.mjs product/test-contribution coverage + closedness counterexamples)
  takes the **complete G4 candidate-bound evidence set as input**. That set is being produced right
  now by this boot lane and does not yet exist — opening the lane now is working without inputs.
- OPEN PRECONDITION: G4 full-PASS application submitted (which is also the pre-authorization's expiry
  trigger) + user back / explicit go. FILE SET: `tests/world-factory/**` census only; declared
  disjoint from the boot lane (which writes only under `dev/agent-workflow/evidence/u7-g4r3-20261028/`).

## Net effect on the critical path

Neither deferred item is on the G4 critical path; both need G4 evidence that only completes later.
The boot lane (ARC-A/D/Jobs PASS so far; ARC-B + crash-pair remaining; the crash pair is the
most budget-sensitive) keeps a single clean environment — which is the entire point of the freeze.
Nothing is lost: both suggestions are now declared with concrete open preconditions and exclusive
file sets, ready to open the moment their gate clears.
