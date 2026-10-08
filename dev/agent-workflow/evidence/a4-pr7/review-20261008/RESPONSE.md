# External review of Alpha.4 (2026-10-08) — coordinator response ledger

**Review object:** `ArmourPiercer1/dsh-agent-team` @ `606a0be7` (through PR #196).
**Review verdict:** *core implementation conditionally passed; Alpha.4 stage closure not passed.*
**Coordinator disposition:** **accepted as the most useful independent review this project has received**, with four factual corrections applied below and one correction to my own records. Nothing in the review's overall judgment is contested.

**Method I applied to it**, because an unverified indictment is as dangerous as an ignored one (this project has already had one external finding that turned out to be stale): every code-path claim was re-derived against the tree by me before any lane was dispatched, with `file:line` recorded. Where the review was imprecise, the imprecision is corrected here rather than silently inherited by the fix.

| ID | Review claim | Verdict | Discharged by | State |
| --- | --- | --- | --- | --- |
| R-1 | A corrupt approval record (`authorityScope` present but invalid) can vanish from the tool guard's view ⇒ `NO_REQUEST` ⇒ `proceed: true` | **ACCEPTED, with 3 corrections — and the measured consequence was worse than the review stated: a durable recorded DENY was proceeded** | PR #202 (`service.ts` blob `a50c81e1`, verified by me at base and tip) | **closed** |
| R-2 | PR #194 fixed the activation race but compatibility state is still not atomic; prefer version-checked atomic update, then convergence | **ACCEPTED** — and it independently endorsed my backlog item 12, which supplies the ruling authorizing the P7-T1 pin revision | lane `feat-a4-compat-atomic-state` | in flight |
| R-3 | No PR/push CI (`characterization.yml`, `workflow_dispatch` only); the `pre-commit` guard is a local copy, so nothing is server-enforced | **ACCEPTED** — with my own two incidents as the evidence | lane `ci-a4-pr-gate` + backlog item 13 | in flight |
| R-4 | `graph.yaml` `current_phase` still describes PR-#65-era state while the tree is at #196 | **ACCEPTED** — mine to fix, fixed in #197 | `graph.yaml` `current_phase`, new `state_convergence` key | **closed** |
| R-5 | Baseline-exempted failures should be split into stage-relevant vs historical debt, or "zero new failures" becomes a proxy for reliability | **ACCEPTED — and the answer was sharper than the ask: `unrelated-historical` = 0, i.e. every exemption sits on a plane this stage works on** | PR #200 (classification) + PR #201 (map errata) + 2 repair lanes | **closed for the audit; repairs in flight** |
| R-6 | ADR and Spec are already `Accepted`; no acceptance ceremony remains | **ACCEPTED — correction to my records** | verified; my outstanding-items list no longer carries it | **closed** |
| R-7 | §7.7 nine-step human acceptance is NOT_RUN, therefore the stage is not closed | **AGREED, no action available to me** — owner = project owner | receipt `dev/agent-workflow/evidence/alpha4-final/ALPHA3-HUMAN-ACCEPTANCE.md` | blocked-on-human |
| R-8 | "Internal dev / controlled-test baseline: yes. Strict-unattended-security stable release: no. Substitute for a physical safety interlock: no." | **AGREED** — this is already repo doctrine (`master` = alpha line, `stable` = adjudicated RC only) | none needed | **closed** |
| R-9 | Root `pnpm test` does not cover `*.client.spec.*`; client tests run separately (55 files / 880 legs / 3 reds) | **ALREADY KNOWN AND PUBLISHED** | `ROOT-CENSUS` in the nine-root baseline | **closed** |
| R-10 | Reviewer did not re-run the suite locally; separated code-path facts from inferred risk from unproven impact | **NOTED as a review limitation, and mirrored**: I verified in code, did not re-run their reasoning, and no lane may book an inference as a measurement | process | **closed** |

---

## R-1 in detail — the guard finding, as it will actually be fixed

**Confirmed structurally by me, before dispatching anything:**

- `packages/runtime/control/service.ts:663-664` and `:824-825` — when `value['authorityScope'] !== undefined && parseAuthorityScopeField(…) === undefined`, the **whole record** fails to parse.
- `:1331-1345` — such a row carrying a valid `approvalCaseId` is parked in `ControlState.corruptLegs`.
- `guardOperation` reads **only** `state.requests`, `state.decisions`, `state.consumptions`, `state.abandonments` — I enumerated the field accesses; `corruptLegs` is not among them.
- `packages/tools/src/guard.ts:80-82` — `NO_REQUEST` → `{ proceed: true }`.
- The existing `a4p7-a1-14-consumption-revalidation.test.ts` A4 leg covers `authorityScope` **absent** (parses fine, refuses correctly with `AUTHORITY_SCOPE_UNBOUND`); **present-but-invalid was never covered**, which is exactly the review's point and the reason the gap survived a suite that looks thorough.

**Correction 1 — `corruptLegs` is not dead code.** `service.ts` reads it in at least two other routes, including one its own comment calls "the only frozen route from a …". The fix must not break them; the review's framing ("the record is dropped") was right about the guard and wrong about the state.

**Correction 2 — no privilege-escalation claim, from me either.** What the code yields is that **a stored approval constraint can silently vanish from the guard's view**. Whether an unauthorized operation then completes is answered by a test through the **real `consultGuard()`**, not by prose. The lane's first deliverable is that transcript, and **a refuted indictment is a valuable hand-back.**

**Correction 3 (mine, found after the review) — the exposure is conditional on storage already being damaged.** The request boundary validates before persistence: `service.ts:~1798-1806` throws `malformed('request','authorityScope', …)` with the comment *"a row the strict reader would later refuse is a row that must never reach the ledger"*, and `grep` over `packages/**` (excluding dist/tests) shows **exactly one producer** of `control-request-recorded` (`service.ts:288`); `projection-source.ts:214` and `packages/client/src/model/ledger-adapter.ts:100,421,777` are readers. So today this is a **fail-closed-on-damaged-state** defect — reachable via storage damage, hand-edited/migrated/imported ledgers, or future schema drift — **not** an agent-exploitable smuggling hole. The lane is nonetheless ordered to hunt for any other append route (migration/import/restart helpers, fault-injection writers) and to upgrade the severity in its own report if one turns out to be production-reachable.

That correction **strengthens** the argument rather than weakening it: *a guard whose view of the constraints shrinks when the storage degrades is a guard whose guarantees are conditional on the storage being well-formed* — which is precisely the property a hard-governance stage is supposed to remove.

**Surface the review did not reach, added to the lane:** the client parses the same ledger (`ledger-adapter.ts:777`, `:421` "skipped only when…"). If the UI also silently drops the row, then **the operator sees no approval while the guard also sees no approval** — a compound failure. It must be answered with a leg or a documented paragraph, and reported as its own finding if it is one.

**Completion criterion for R-1** (the review's own, sharpened): a present-but-invalid `authorityScope` **never yields `proceed`**, **and** a genuinely request-free call behaves **exactly** as before. Both directions are measured — a fix that refuses everything is as useless as one that refuses nothing.

## R-2 in detail — what the review unlocked

The review reached my backlog item 12 independently and endorsed its direction: **a version-checked atomic update first, convergence of concurrent probe results afterwards.** Because P7-T1 currently pins the crash window as established behaviour, that endorsement is what authorizes revising the pin; the lane must **name the pin and cite the ruling in its commit** rather than quietly superseding it. Kept out of its hands by design: `putRecord`'s "identical bytes no-op / different bytes `RECORD_DUPLICATE`" semantics is a storage contract, so changing it is handed back to me, not decided inside the lane. Also mandatory there: **fix the module comment that claims `replaceState()` is serialized on the `team_domain` write chain when `putRecord`/`deleteRow` go straight to `table.put`/`table.delete`** — *a comment asserting a property the code lacks is a defect that recruits the next reader.*

## R-3 in detail — the gate that only exists if I remember it

The review is right and the evidence is mine: **27 TypeScript errors nearly merged** because build+vitest do not typecheck, and **an unparsable `graph.yaml` reached `master` twice**, the second time through a merged PR (#195) because the verifying script's parse assertion sat in a different shell statement from the commit. The new `pre-commit` guard checks the index — and I proved it bites (`HOOK_EXIT=1` on genuinely unparsable bytes) — but it is installed by copy, so it enforces nothing on the server. Hence the lane weights the **local equivalent entry point with a machine-readable verdict token** as heavily as the workflow, and must produce **three deliberate RED controls**: a gate never observed refusing anything is an untested gate. Branch protection may be outside an agent's authority, so the lane reports the exact setting the owner must flip and is forbidden from describing `workflow_dispatch`-only CI as merge-blocking.

## What the review praised, recorded so it survives

Three implementations it verified in production code rather than in ADR prose, and which this ledger treats as *externally validated*: `expansionCeiling()` treats a missing grant as **no expansion** while `grantCeiling()` uses a different default so an empty restriction file cannot deadlock ordinary approvals; `runtime-authority.ts` escalates on beneficiary/initiator/intended-effect/approver-ceiling rather than treating the Leader as an omnipotent approver; and `control/service.ts` re-checks current authority **at the consumption point of a one-time grant** before writing `control-allow-consumed`, which closes the check-time-vs-use-time drift that A1-14 named. Recording what an independent reader confirmed is as important as recording what it found: both are the boundary of what is actually known.


---

## Outcomes appended as the work landed (round 41)

- **R-1 closed by PR #202.** The measured base behaviour was stronger than "a constraint vanishes": a durable recorded **DENY** was returned as `{ proceed: true }` with zero consumption, and the runtime plane had *already refused* (`allowed:false, reason:'no-request'`) before the tool plane mapped that refusal into a green light — **one token, opposite polarity across a seam; neither side locally wrong, which is why it survived**. The law is now pinned on `NO_REQUEST` itself. Two items spun out of it as their own backlog entries: **14** the client inverse compound (the operator sees a decidable approval while enforcement drops it, and cannot see which case they are deciding), and **15** case-less corrupt rows, deliberately **not** widened here because the risk direction flips to over-refusal and `approvalCaseId` is optional at the write boundary.
- **R-5 closed by PRs #200/#201.** `MUST-NOT-STAY-EXEMPT 13 · REGISTERED-DEBT 9 · unrelated-historical 0`, plus the two findings an identity diff cannot express (**93 of 129 assertions in exempted legs never execute**; five green negative legs passing on their own fixture's YAML syntax error, which I reproduced with the repository parser). Two test-only repair lanes are running on it.
- **What this review changed in my method, recorded where I will meet it again:** I audited my own §7.6 map and found I had verified that cited legs *existed* and were green-or-disclosed, and had never verified that their assertions *ran* — so the map now carries dated errata and the rule **"where coverage is the claim, measure execution, not registration."**


## Outcomes appended as the work landed (round 43)

- **R-2 closed by PR #208, on the escalating lane's own instrument.** The p6t1 reproducer that measured
  `chainOk:OPEN 12 / chainFail:reprobe-failed 12` at base now measures `chainOk:OPEN 24` and nothing else.
  The mechanism was one state change performed as three durable writes under a module comment claiming
  serialization it did not have; the repair is a generation-checked atomic write **at the seam**
  (`replaceIfGeneration`), so activation, both admission gates and the memoized root authority inherit it
  rather than each carrying a hotfix. Two pinned behaviours were revised **on the owner's ruling and named
  in the commit**, not quietly superseded, and the one unavoidable test-identity transition was carried with
  its reason. **Disclosed residual:** no conditional CREATE exists at the seam, so a cold create can still
  race unobservably — bounded in the PR, and `CORE_SEAM_BLOCKER` rather than a todo.
- **R-3 partially closed, and I am writing the word partially deliberately.** The local entry point is now
  proven in my own hands: `DSH-CI-VERDICT pass pass=7 fail=0 legs=7` on a merge of the branch into master,
  two red controls I ran myself (a planted red inside an already-red file, named under `NEW RED(S)`; the
  exact `graph.yaml` bytes PR #195 merged, refused in 0.2 s), and a refusal of **my own** tree because I had
  skipped `pnpm build:composition` — the strongest thing I can report about an instrument is that it
  rejected its author. **But the hosted half was worse than unverified: it had never executed a job.** Four
  runs, all red, zero jobs, no logs — two of them on `master` — because `runner.temp` was used in
  `jobs.<id>.env`, an illegal context, and GitHub refuses the whole file for that. Fixed on PR #210
  (`actionlint` names the line in a second; the API tells you nothing), which also builds before grading so
  a runner cannot repeat the composition-build miss that cost me 224 s. Branch protection is still not
  enabled, and the order is unchanged: **one run that reports, then decide.**
- **R-5's lanes are merged and the reference now matches the ledger.** Exemptions went 22 → 10 in the
  classification, and PR #209 moves the gate's tolerated set to the same **10** — two different instruments,
  finally agreeing because one was moved to the other, not because both were edited until they looked alike.
  Control D proves the move bought enforcement: a retired identity resurrected at its exact path and full
  name is now `NEW RED(S) 1`, where for a whole stage it would have been tolerated.
- **Two self-corrections worth the ink, because both are the kind nobody catches by reading the diff.** I
  retargeted a *grammar fixture's* expected totals to the live corpus after a leg printed newer numbers —
  that is deleting a test, not updating a pin. And I glued a second condition into the same `ok(...)` call
  so it silently became the assertion's *message*, producing `SELFTEST FAIL: false`: a harness that prints a
  value instead of naming an assertion is itself the weak instrument. Both were caught because the
  self-test runs in seconds and I read its output instead of wanting it to be green.
