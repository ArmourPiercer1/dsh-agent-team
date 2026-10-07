# a4-escalate-truth — measured truth of `escalate` at an unresolvable successor rung

**Task lane:** `fix/a4-escalate-receipt-truth` (single-task writer)
**Base:** `origin/master` at first fetch = `4c6aab89263b298a3ce5cf6b7fc217beecceef53` ("4c6aab89 or newer" satisfied; origin/master advanced to `bfdf1141` — two docs-only commits — after branch creation; not rebased, never rebased).
**Deviation noted:** an earlier working master checkout sat at `534d10e8` (pre-#112/#113); `git fetch` was run FIRST per instructions and the branch was cut from the fetched `origin/master` = `4c6aab89`.

## 1. The trace (file:line, every hop, verified against this tree; `control/service.ts` coordinates restated AT THIS LANE'S HEAD — line numbers there moved by the fix itself, so symbols are the anchor)

| # | Hop | Location |
| --- | --- | --- |
| 1 | v8 wire params for `intervention.act` (closed body: `teamSessionId`, `interventionId`, `action`, `note?`) | `packages/remote/src/contracts/params.ts:2493,2568` |
| 2 | s6 wire case dispatch + receipt re-validation against the CLOSED outcome set | `packages/runtime/src/plugin/s6-remote.ts:4448-4481` (validation :4470-4479); generic dispatcher twin `packages/remote/src/handlers/intervention.ts:194-208` (:202 set check) |
| 3 | The act lane's escalate arm: FRESH open-case re-read, CURRENT leg requestId, `await options.interventionEscalate(...)`, return value DISCARDED, `{ outcome: 'escalated' }` returned unconditionally | `packages/runtime/src/plugin/s6-remote.ts:3762-3777` (discard+return :3770-3776) |
| 4 | The escalate port's signature (returns a record — never consulted by the lane) | `packages/runtime/src/plugin/s6-remote.ts:1363` |
| 5 | Production wiring (root): closure calls `control.escalateApprovalLeg` and RETURNS the result | `packages/runtime/src/plugin/root.ts:3661-3669` |
| 6 | The service law: successor from the FROZEN ladder, resolver check, three writes with the terminate branch skipping WRITE 3 | `packages/runtime/control/service.ts:4090` (`escalateApprovalLeg`), :4209-4210 (`controlEscalationSuccessor` / `hasAuthorityResolver`), WRITE 1 :4232-4241, WRITE 2 :4244-4250, terminate branch returning `caseOutcome: AUTHORITY_UNAVAILABLE` :4278-4284, risen return :4324-4329 — all AT HEAD |
| 7 | The frozen tables: `'human-user' → 'human-admin'`, `human-admin → null`; `CONTROL_UNRESOLVABLE_AUTHORITIES = ['human-admin']`; `hasAuthorityResolver` | `packages/runtime/control/types.ts:283-292` (successor table), :341-343, :352-354 |
| 8 | The closed case-outcome vocabulary (`escalated` / `authority-unavailable`) and `ControlEscalationOutcome` (`nextLeg` ABSENT on terminate) | `packages/runtime/control/types.ts:588-596, 613-623` |
| 9 | The closed leg-terminal-reason vocabulary — `RESOLVER_UNAVAILABLE: 'resolver-unavailable'` ("No resolver exists for the authority this case needs (ADR A1-12, spec 11.6)") | `packages/runtime/control/types.ts:368-380` |
| 10 | The A2-8 destination field on the decision record (`terminalReason`; "ABSENT = an ordinary allow/deny") | `packages/runtime/control/types.ts:1151-1163` |
| 11 | The BORN-TERMINAL twin close (A1-12/audit F2) — writes a born-terminal leg + deny **stamped** `terminalReason: 'resolver-unavailable'` | `packages/runtime/control/service.ts` (`requestApprovalLeg`'s born-terminal twin via `closeZeroReviewCaseTransactionally` — SYMBOLIC cite; the call is at :4010 at this head, stamp :4014) |
| 12 | `commitDecision` already carries `terminalReason` additively (payload + record) | `packages/runtime/control/service.ts:1530,1576,1596` (at this head) |
| 13 | Re-read law: open-case fold skips decided cases (`status !== 'open'`, `currentLeg === undefined`) → the panel row vanishes | `packages/runtime/control/service.ts:4389,4397` (at this head); projection `packages/runtime/intervention/projection.ts` `projectInterventions`; s6 get → `INTERVENTION_NOT_FOUND` `packages/runtime/src/plugin/s6-remote.ts:3666-3678` |
| 14 | `projectZeroLegTermination` — **VERIFIED: no production caller** (only the barrel `intervention/index.ts:25,122` and tests `a4p3-intervention-lane-hygiene.test.ts:150`, `a4p3-intervention-projection.test.ts:66,697`). An uncalled projector, exactly as the audit said. Its docstring says it is "the seam PR4/PR5 call when a request terminates synchronously" — the pre-execute adapter does NOT call it (it denies with text, `operation-permission/pre-execute-adapter.ts:1801-1818`). | `packages/runtime/intervention/projection.ts:163` |
| 15 | Ledger durable source: fact types `control-request-recorded` / `control-decision-recorded` / `control-escalation-recorded` — **no fact type names the case termination**; the terminate fact lived nowhere durable pre-fix | `packages/runtime/control/service.ts:288-299` (at this head) |
| 16 | Client: the panel NEVER shows the receipt (only errors), then re-reads ("no optimistic mutation: the projection re-read is the truth") | `packages/client/src/ui/TeamInterventions.tsx:139-156` |
| 17 | Client ledger row: `summary = decision · reason` → renders `deny · escalated`; `terminalReason` is NOT read anywhere in the client read plane (grep: zero hits in `team-ledger-model.ts` / `ledger-adapter.ts` / `projection-source.ts`) — the coordinator's 2026-10-08 ruling files this under the post-Alpha.4 named-message table | `packages/client/src/model/team-ledger-model.ts:356-365` |
| 18 | The OTHER caller of `escalateApprovalLeg` — the Leader tool lane — forwards the FULL outcome including `caseOutcome`: it already tells the truth | `packages/tools/src/tools.ts:1060-1072` (`{ status: 'control-escalated', outcome }`) |
| 19 | The offer law (SETTLED, untouched): escalate is offered per the FROZEN successor table, never off resolver availability | `packages/runtime/intervention/derivation.ts:310-319` |

## 2. What the act MEASURED (raw output; full transcripts in this directory)

Machine-observable reproduction: `packages/runtime/test/a4-escalate-act-truth.test.ts` drives the production entry
(`createS6RemotePorts` + `createS6RemoteDispatcher` + `createServerPrincipalDerivation`, v8 wire envelope) over the REAL
durable `ControlService`, with the escalate closure mirroring `root.ts:3661` verbatim.

- Wire response to `escalate` on a `human-user` leg: `{"ok":true,…,"data":{"outcome":"escalated"}}`
- What the service actually returned (discarded by the lane): `caseOutcome=authority-unavailable nextLeg=ABSENT`
- Durable ledger rows for the case after the act: leg row (ordinal 1) **still present** + `control-decision-recorded
  deny · reason escalated` + `control-escalation-recorded`; **no leg ordinal 2**, nothing pending, zero consumption.
- Re-read: `intervention.list` no longer carries the case; `intervention.get` → `INTERVENTION_NOT_FOUND`.
- Control arm: a `leader` leg escalating to `human-user` (successor HAS a resolver) → `caseOutcome=escalated`,
  leg 2 minted, closing deny carries **no** terminalReason.

### Verdicts against the audit paraphrase ("coding against a paraphrase" check)

- "clicking destroys the case" — **FALSE as stated.** The case is CLOSED the way A1-12 + audit F2 authorise:
  durable leg row retained, terminal deny + escalation fact written, never pending, waiter settles on the deny.
  Nothing is destroyed. It is also NOT a rise: no successor leg exists.
- "the leg row vanishes on re-read" — **true only of the OPEN projection** (panel/list/get), false of the durable
  store; the projection law (open-fold skip, `service.ts:4389,4397` at this head) legitimately hides decided rows.
- "the ledger reads Denied · escalated" — **true** (client summary `deny · escalated`, `team-ledger-model.ts:363`),
  and pre-fix that was ALL the durable record said.

## 3. Decision: (b), fixed in the narrowest honest way — plus one (b)-half BLOCKED on the wire OUTCOME SET (the surfacing half is v8-legal; see below)

**Not (a):** the receipt says the case went up when it was closed at the click, and pre-fix the durable closing deny
omitted the reason field the closed vocabulary has for exactly this close.
**Not (c):** the closure itself is what A1-12 authorises (synchronous `authority-unavailable` close, no fake pending
Admin leg, durable per audit F2). No ADR violation in the behaviour.

**Fixed (durable record, this commit):** `escalateApprovalLeg`'s terminate branch now stamps
`terminalReason: CONTROL_LEG_TERMINAL_REASONS.RESOLVER_UNAVAILABLE` on WRITE 1 (the closing deny) when
`!mintsRisenLeg` — an EXISTING frozen vocabulary value (`types.ts:378-380`), the same stamp the born-terminal twin
already writes (`requestApprovalLeg`'s twin via `closeZeroReviewCaseTransactionally`; :4014 at this head), into an
EXISTING additive field of the decision payload/record (A2-8,
`types.ts:1151-1163`; `commitDecision` already projected it). No new vocabulary value, no wire change, no method
return change (`service.d.ts` is byte-identical after rebuild — the type surface did not move). An ABSENT
terminalReason keeps its A2-8 meaning (reviewer-chosen close / a rise), pinned by the control-arm test.
The ledger's CLIENT rendering still reads `deny · escalated`; wiring `terminalReason` into the named message table
is the coordinator's post-Alpha.4 ruling (2026-10-08 log, item 2, "~6 files") and is NOT touched here.

**What is genuinely NEW in the record (two facts no other file states):** (1) the stamped field now rides
`team.getLedgerPage` payloads to EVERY remote consumer — the ledger wire entry carries the row's `payload`
verbatim (`packages/remote/src/contracts/types.ts:204-213` with `payload` in `REMOTE_LEDGER_ENTRY_FIELDS`
`:388-396`; `ledgerEntryWire` `packages/runtime/src/plugin/s6-remote.ts:1618-1675`), so every reader of the
remote ledger sees `terminalReason` on this close without any further change; (2)
`readApprovalCaseState().state.terminalDecision.terminalReason` is newly POPULATED for the governance plane
(the read builds `terminalDecision` through `toDecisionRecord`, `service.ts:3829` and `:1474-1488`), which is
the typed consumption point for any future authority-side reader. **No RENDERED path reads it yet** — the ledger
label still prints `deny · escalated` — so this commit is honestly scoped **"recorded, not yet told"**: the
durable record and both typed read paths now carry the truth; telling the operator is the surfacing follow-up
below and the post-Alpha.4 message table.

**BLOCKED (the act-outcome half only) — wire-version decision, NOT mine to make:**
the truthful receipt value does not exist in the `intervention.act` **outcome set** on the v8 wire. (It DOES
exist on the v8 wire as the intervention item's `status` — see the surfacing half below; that half is legal
today and is the follow-up, not the blocker.)

- Exact type: `REMOTE_INTERVENTION_ACT_OUTCOMES` — `packages/remote/src/contracts/types.ts:485-490` —
  the CLOSED v8 set `['decided','escalated','acknowledged','already-acknowledged']`.
- Collision rule: `intervention.act`'s response is the outcome and NOTHING ELSE, validated against that closed
  set on BOTH lanes (`packages/remote/src/handlers/intervention.ts:202-206`;
  `packages/runtime/src/plugin/s6-remote.ts:4457-4479`, whose own comment states that forwarding a
  non-vocabulary value would "mint a wire value the contract closed at v8 — the client renderer's domain, not the
  plane's"). Adding e.g. `authority-unavailable` changes what the FROZEN v8 method version may return → contract-
  version decision (coordinator + human), and would redden the closed-set pins
  (`packages/remote/test/a4p6-remote-v8.test.ts:14,241,288`) that stand as the v8 contract record.
- The ruling this answers is the coordinator's correction of PR #110 — `dev/agent-workflow/SESSION_ROUTER_LOG.md`,
  2026-10-08 round 2 (merged as #115): "an UNAVAILABLE escalation must not wear a success receipt … the act
  receipt must keep the termination." That correction is LOG text, not plan text (the plan carries no such
  sentence; its rule is the frozen rung offer set at `alpha4-implementation-plan.md:28`), and by that same log
  entry the hide-the-alternative (not offering escalate at a `human-user` leg) is withdrawn — the offer stands
  (`derivation.ts:310-317`). The ruling has TWO halves; only the first is blocked:
  **(1) ACT-OUTCOME half — the blocker above:** carrying the termination in `intervention.act`'s own outcome
  value collides with the closed v8 set → contract-version decision (coordinator + human). The v8 act-lane
  misreport is pinned AS A TRIPWIRE in `a4-escalate-act-truth.test.ts` ("MEASURED RECEIPT (disclosed
  misrepresentation…)") so landing that decision reddens the pin instead of slipping past it.
  **(2) SURFACING half — v8-legal TODAY: a FOLLOW-UP producer task, not a contract decision and not a
  blocker.** The truthful value already exists end-to-end as the intervention item STATUS
  `'authority-unavailable'`: in the wire item `status` union (`packages/remote/src/contracts/types.ts:438`);
  accepted by the shared validator (`packages/remote/src/handlers/intervention.ts:105`), which the s6 lane
  imports (`src/plugin/s6-remote.ts:128`) and applies to every projected item (`:2226`); documented for
  exactly this close (`packages/runtime/intervention/types.ts:80-90` — spec §11.6's "surface typed
  Admin-required result and InterventionItem", `alpha4-permission-governance-spec.md:527-535`); its projector
  exists (`intervention/derivation.ts:546` `deriveZeroLegAuthorityUnavailableItem`,
  `intervention/projection.ts:163-171` `projectZeroLegTermination` — production-uncalled, hop 14); the
  injection seam is LIVE in production (`src/plugin/s6-remote.ts:2204-2225`, the `projectInterventions`
  adapters array — it already carries the governance-warning adapter); and the client already renders the
  terminal row with no affordance (`packages/client/src/model/team-interventions.ts:69-71`). **Only the
  producer is missing**: wiring one is Alpha.4-eligible with ZERO contract bump, and it discharges the open
  duty the re-read tripwire guards (test:414 now carries the cross-references — spec §11.6 + plan §6.D
  "Once a leg escalates, the old leg is visibly terminal", `alpha4-implementation-plan.md:651`). Left as
  written by the first draft of this README, the surfacing half would have been mis-scheduled behind a human
  contract decision that it does not need.
- NOT DONE (rejected as its own misrepresentation): remapping the terminate receipt to `'decided'` reuses a v8
  value whose contract meaning is the reviewer's own allow/deny act — silent semantic overloading of a closed
  value is the same disease as a silent `escalated`.

## 4. Red / green / mutation proofs (executed)

1. RED before fix: `red-run-before-fix.txt` — `expected undefined to be 'resolver-unavailable'` (fix stashed, run, popped).
2. GREEN after fix: `green-run-postfix.txt` — 7 passed; wire measurement lines printed raw.
3. MUTATION (non-constant-foldable, a live value swap inside a live ternary — esbuild cannot erase it):
   stamp swapped to `CONTROL_LEG_TERMINAL_REASONS.AUTHORITY_DRIFT` → `expected 'authority-drift' to be
   'resolver-unavailable'` (the DURABLE TRUTH pin went red; every other pin stayed green, proving pin isolation);
   reverted; green again. `mutation-red-run.txt`.
4. p4t6 scan pin bites BOTH ways, executed:
   - file present, path NOT declared → `expected 1021 to be 1020` (coverage test red — captured above and in
     the transcript trail of this lane);
   - path declared, file absent → `expected 1020 to be 1021` (`p4t6-red-name-without-file.txt`);
   - declared + present → 10 passed (`p4t6-green-registered.txt`). New list `SCANNED_PATHS_A4ESCALATE` with the
   same tie form (`length === 1021 - 1020`); no other PR's list renumbered; the total is never hand-written.

## 5. Gate transcripts (this directory)

| Gate | Result |
| --- | --- |
| `pnpm -r run typecheck` | 8 × `typecheck: Done`, `grep -c "error TS"` = 0 — `gate-typecheck.txt` |
| `pnpm build` + co-commit dist | control/service.js(+maps) rebuilt and co-committed; `service.d.ts` UNCHANGED (type surface did not move) |
| `pnpm run build:composition` + `pnpm run check:artifacts` | `OK: 1508 files` — `gate-artifacts.txt` |
| new test file | 7 passed — `green-run-postfix.txt` (+ `red-run-before-fix.txt`, `mutation-red-run.txt`) |
| `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | 10 passed, total 1021 (base measured 1020) — `p4t6-green-registered.txt` |
| targeted adjacent suites (8 files, 157 tests) | all green — `targeted-suites.txt` |
| `pnpm --filter @dsh-agent-team/client run test` | exactly the baseline trio: 3 failed / 876 passed (`team-creation-panel` ×2, `team-governance` ×1) — `gate-client-lane.txt` |
| `rm -rf packages/testkit/test/.tmp-fault/ && pnpm test` | 19 failed / 6018 passed; failing identities ONLY baseline: t1-capability-schema ×9, p6t3-mediation ×5, p6t3-restart ×2, t2-blueprint-hash ×1, d3-member-identity-context ×1, p6t6-actions ×1, plus the three zero-test collection files (t12a-glue-handoff-ports, t12a-b2-child-identity, p8s3b-result-effects — collection-time durable-world errors, present at base). **p6t1-parallel: observed flake count 0** (9 tests green) — `gate-full-test-final.txt` (first run: `gate-full-test.txt`) |
| `node scripts/lint-identities.mjs --diff …lint-identities-0237d487.txt` | `new 0, resolved 0` (160 identity lines, 76 distinct) — `gate-lint-identities.txt` |
| eslint on changed files | `a4-escalate-act-truth.test.ts`, `p4t6-session-event-scan.test.ts`: silent. `control/service.ts`: ONE diagnostic, PRE-EXISTING and byte-identical at base (verified by stash-and-run): `174:3 error 'parseTemplateId' is defined but never used @typescript-eslint/no-unused-vars` — recorded baseline identity, not touched (drive-by cleanup would move the identity ledger; out of lane). |
| zero-mutes audit | `eslint-disable` / `@ts-ignore` / `@ts-expect-error`: zero in the diff and in both new/edited test files (grep run; matches elsewhere in the repo are prose/baseline, not mine) |

## 6. Deviations and notes

- First `lint-identities.mjs` attempt exited `NOT RUN :: eslint produced no JSON (status 2, …)` while the full
  suite was running concurrently (resource collision on the shared npm cache); the re-run in isolation produced
  `new 0, resolved 0`. Exact first-run text: `lint-identities: NOT RUN :: eslint produced no JSON (status 2, signal null, error none)`.
- `runtime` ambient types exclude `console.log`; the measurement prints use `console.info` (repo convention).
- origin/master moved (`4c6aab89` → `bfdf1141`, docs-only) after branch creation; branch was NOT rebased (rule)
  and the coordinator merges.
- No host was booted; no port used; all worlds are in-process p6t4 durable worlds; scratch stayed under the repo.
- **Follow-up commit (adversarial-review corrections F1-F6):** text-only in this README + the test titles; the
  one `service.ts` change is the COMMENT at the WRITE-1 call switching `:4013` to a symbolic cite (F3) — no
  code behavior moved — but since comments ship in the install-surface artifact, the dist mirrors for
  `control/service.js` were rebuilt and co-committed and `check:artifacts` re-run (`OK: 1508 files`). The
  reviewer's item-status finding (surfacing half v8-legal) was re-verified here before adoption: every cited
  coordinate checked at head; `projection.ts` fn is `:163-171` (reviewer's `:155-171` includes its docstring).
