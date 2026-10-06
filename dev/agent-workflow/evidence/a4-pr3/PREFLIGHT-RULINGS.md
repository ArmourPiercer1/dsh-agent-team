# A4-PR3 pre-flight rulings + mandatory doc-repair set

Audit: `bf733ecd`, read-only, base `7f44548a`. **Verdict: Task 3 is NOT executable as written.** Eight blocking items, all X11-class (duty recorded, absent from operative text). **This file is the dispatch instruction for a docs repair PR; PR3 must not be dispatched to a code writer until every item below is folded into plan Task 3.** Repairs are *in place* (Global Precedence rule 3), never as appendices.

## Blocking

- **B1 `terminalReason` is dutyless.** Mandated at `plan:878` / ADR A2-8 (`:828`) / spec §25.5 (`spec:1075`) and with **zero occurrences in `packages/**`** and no `Files:` line or checkbox. Add a `Files:` line and a checkbox naming the leg field and that drift reasons move to it rather than becoming a new stale `status` value.
- **B2 `plan:800` contradicts `plan:297-298`.** Its "single-owner PR4 … PR5 must not edit them" reads as a blanket ban while Task 3 mandates editing `projection-source.ts` and `ledger-adapter.ts`. Intent (graph `:815`) is the **PR4∥PR5 window only**. **Fix = scope the sentence, not overrule it.**
- **B3 `a3p3-governance-lane-hygiene.test.ts` is not in Task 3's `Files:`** and PR3 will likely redden it: the guard walks every non-test `.ts` under runtime with a `\bNAME\b` regex, and `AuthorityCeilingScope`/`grantCeiling` are allowed only in `CEILING_LANE` (`:588`, `:595`, `:601`); COMPLETENESS (`:662-668`) forces new exports of `authority-ceiling.ts` into SURFACE. Task 4 carries this as a *Conditional* line (`:373`); Task 3 has nothing. **Add the same Conditional line.**
- **B4 unnamed files.** The lane-B module (`plan:301`) and the A1-17 edge-pin test (`plan:302`) have `Files:` rows with **no path** — under 1-task-1-writer a writer cannot create a file it cannot name. Name both.
- **B5 the interface freeze has no producing step.** `plan:707` promises it, PR4/PR5 dispatch keys on it, and the only "coordinator interface-freeze commit" in the plan belongs to Task 6 (`plan:539`). Task 3's gate ends at "Full gate; open A4-PR3" (`:356`). **Add a checkbox: record the frozen surface at `dev/agent-workflow/evidence/a4-pr3/interface-freeze.md`** (directory does not exist yet).
- **B6 §11.1 case identity is outside the freeze surface.** `ApprovalCaseIdentity{approvalCaseId, subject, beneficiaryAuthority, requestedEffect, operationFingerprint?, mutationProposalFingerprint?, correlation}` (`spec:459-467`, exactly-one-fingerprint `:470`) appears nowhere in Task 3; grep of `plan:276-356` for `requestedEffect`/`mutationProposalFingerprint`/`terminalReason` → 0 hits. PR5's fingerprint inputs (`plan:457`) and PR4's cross-case pending list (`plan:368`) have nothing frozen to import.
- **B7 no export site is frozen for anything.** `plan:305-320` lists operations as prose with no module, type, or export name; the terminal vocabulary at `plan:338-340` is prose with no home module.
- **B8 client edits with no client-lane step.** Task 3 mandates `client/src/model/ledger-adapter.ts:89` (`:298`) but the X12 client-lane step (`plan:270`) binds only Tasks 4–7, and `packages/client/test/ledger-adapter.test.ts` is not in `Files:`. Add the step (retitle it to bind Tasks 3–7) and the test file.

## The no-red findings PR3 must be told about

1. **Category *value* drift is invisible.** `a4pr0a` compares **key sets only** (`parseClientMap :355-362`, C3 `:481`); C4 validates **host** values only. So a row filed under `policy` when it should be `control` renders in the wrong Events category with **nothing red** — the exact A5-6/X8-R3 hazard, and B8 is what makes it unwritable.
2. **`escalated` must be added to `CONTROL_DECISION_REASONS`** (`control/types.ts:195-200` today holds only `external-policy`). `service.ts:727-730` silently **drops any row whose reason is outside the closed vocabulary**, so a terminal `deny` with an unpinned reason vanishes at read time and the inline waiter **hangs** — with no existing test enumerating reasons. Highest-value RED PR3 owes.
3. **`pendingControlCount` abandon-blindness:** host fold is abandon-aware (`control/service.ts:1094-1106`, abandon beats decision) but the client mirror never consults the abandon fact (`projection-source.ts:222`, decided set `:814-823`, loop `:824-833`); no test asserts the *count* under abandonment.
4. **Second decision row on one `requestId`:** host is first-wins (`:2225`), client is last-wins (`ledger-adapter.ts:553`) — a PR3-new-write-path hazard (retracted as a present defect: `resolveControl` refuses re-resolution, pinned).
5. **Escalation recorded as a decision *value*** → `parseDecisionPayload` drops the row (`:719`), leg stays pending, waiter hangs. This is the hang A5-5 exists to prevent.
6. New terminal-outcome constants, and any new fact type lacking a renderer case, are **unpinned** (no closed-set test over the outcome vocabulary; renderer pairing defaults to rows-only, `ledger-adapter.ts:787-788`).
7. A new **request kind** is caught by **typecheck**, not a test (`CONTROL_RESOLVER_ROLES: Record<ControlRequestKind, …>`, `types.ts:153`); the client mirror pin would not fire.

## Lane B design ruling

State explicitly that lane B **receives a required-authority reader callback** rather than importing `grantCeiling` — the ban on those names outside `CEILING_LANE` is what makes B3 block, and one sentence decides it.

## Citation repairs (in place)

`plan:299` "pin 983 at `:1783-1764`" → **`:1782-1783`** (the `it()` title's "978 files scanned" at `:52` is stale prose, not a second pin); `plan:341`/graph `:815` "`projection-source.ts:824-838`" → **`:814-833`**; `plan:378` "`:2304-325`" → **`:2306-2326`** (consumption write `:2327` is exact); `plan:371` router `:615-624` → the branch is `:619`; `plan:298` "`ledger-adapter.ts:89-129`" (Tasks 4/5) → real extent **`:89-142`**.

## Accepted retractions from the audit

`mayReview`, `authorityRank`, `runtime-authority.ts` **do not exist at `7f44548a`** — B3's trigger is a prediction about PR2's output, to be re-checked at PR3's real base. Nothing was executed: all red/no-red verdicts are static readings. `tsconfig.build.json` includes `control` but neither `governance` nor `intervention`, so Task 3's dist co-commit extent is unverified. And one duty with no owner anywhere: **no plan step re-records the lint baseline if PR2 lands lint-unclean files** — assign it to the coordinator (me) at PR3 base.
