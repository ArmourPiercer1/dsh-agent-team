# P8-S6 Result — Projection + Remote + Principal Boundary Completion (plan §20)

Branch `task/P8-S6-projection-remote` @ base `7bf7b09`. Single assembly point: `createTeamProductionRoot` (`packages/runtime/src/plugin/root.ts`). C1–C9 all green.

## Surfaces (A30–A34)
- **A30 projectionLiveOverlay** (root.ts :819): `plugin/s6-live-overlay.ts` `createLiveResidencyOverlay` — read-only residency diagnostic over durable member rows (DISPOSED excluded; leader child = `childSessionId ?? rootSessionId`; resident iff bound child live in `TeamAgentBindings`, else cold).
- **A31 remoteHandlerRegistration** (:851): `plugin/s6-remote.ts` — all 12 ports of frozen `remote/src/handlers/ports.ts` against runtime authorities only (no direct repo mutation / `Agent.followup` / local compat recompute); async dispatcher mirrors frozen `dispatch.ts` 7 invariants (divergence: AWAIT at invariant 4); channel `/team-remote`; dispose once.
- **A32 serverPrincipalDerivation** (:812, closes CR-4): `plugin/s6-principal.ts` — caller derived server-side; external caller cannot self-claim kind/role (human = bound rootSessionId; leader/member require durable instance + root/leader match; ack requires `acknowledgedBy` = rootSid); codes `TEAM_REMOTE_FOREIGN_TEAM` / `TEAM_REMOTE_PRINCIPAL_INVALID`.
- **A33 (no seam)**: `createLedgerPageTracker` wired into the completion surface via bounded (16) anchor-keyed cache; reuse iff anchor matches else fresh; oldest evicted.
- **A34 remoteQueryCommandCompletion** (:850): `plugin/s6-remote.ts` — `getLedgerPage` → root guard → param parse → same slicer → tracker gate → reject BEFORE dispatch (`TEAM_REMOTE_LEDGER_PAGE_REJECTED` + reason) or success (projectionGeneration/effectSequence null); other methods pass through to the dispatcher.

Boot probe (wiring decision (x)): if no durable compatibility state exists, boot runs `STALE_GENERATION_BEFORE_NEW_WORK` (+1 row generation at boot; tests assert verbatim equality with the durable row).

## Acceptance C1–C9
- **C1** four seams install-once at construction; production flow never hits a not-installed code; second install → `TEAM_PLUGIN_SEAM_ALREADY_INSTALLED`; fail-closed pre-install state still testable (S5A T1.2 reworked).
- **C2** 14 tests: closed field sets == frozen DTOs; generation verbatim from durable row; per-project fresh overlay; negatives: read-port access exactly `['teamSessions.get','compatibility.get','memberInstances.list','ledger.list']` (no session-log scan / SessionController mirror / event merge).
- **C3** 11 tests: spoofed instance / human / ghost-member / wrong-root / leader-as-member / spoofed-ack all rejected end-to-end; valid human mutation durable.
- **C4** 7 tests: override / policyState / member.* through runtime facades only; pure-store paths zero writes; typed facade errors pass through unmutated; followup admission-routed.
- **C5** 5 tests: reprobe = exactly +1 generation; frozen frame verdicts (apply/duplicate/stale/foreign); reconnect pull = apply against durable authority.
- **C6** 9 tests: stable cursor chain, stable re-read, load-earlier, growth 7→9 does not invalidate window; foreign + malformed rejected; unit-level tracker rejections (7 kinds).
- **C7** table below.
- **C8** fresh chain 1985/1985 (1939 + 46 new); dist chain 1985/1985 (sanctioned emit + yaml junction); tsc 8-set clean; frozen-region diff vs base EMPTY; scan pin 517→525 (owned testkit file, +8 new files).
- **C9** live 17/17 on port 3181 (109 assertions, 0 failures); postflight: test-use pristine @ `cd5ef81`, :3080 200/200, ports released, lock released. Report `packages/tools/harness/reports/p8s6-20260902-072921/`.

## §21 mapping (C7)
| BQ | S6 disposition |
|----|----------------|
| 01 | team-side branch via A32 + foreign guard; ordinary/legacy-readonly = native (host registry + P7-T7 reader) |
| 02 | per-team via projection (catalog.resolve, displayName/quota fallbacks); full listing = native host catalog |
| 03 | classified: S5A assembly preflight; compatibility result + ack via BQ-05 |
| 04 | S6 — A30 + `team.getProjection` (frozen contract; provenance carries generation) |
| 05 | S6 — `compatibility.current` / `ack` / `reprobe` (status/generation/fingerprint/counts incl. unackedWarning) |
| 06 | S6 — projection template rows (identity, displayName, description, contextPolicy, instanceQuota) |
| 07 | S6 — projection member rows + `liveActivity` residency diagnostic; model summary = native |
| 08 | S6 exposes authorities (override record, defaults); per-field composition = client-local |
| 09 | S6 — per-template contextPolicy on template rows |
| 10 | S6 — `policyState.get` (far-future-step eval) + `set`; closed transition set else `TEAM_REMOTE_POLICY_STATE_UNKNOWN`; ephemeral store (no durable repo) |
| 11 | S6 — override authority (team/instance scope, generation-stamped); availability/next-boundary = native |
| 12 | S6 — activityVersion + ledger authority; interval composition = client-local |
| 13 | S6 — progress-category ledger pages + projection summary |
| 14 | S6 — pendingControlCount + control-category pages |
| 15 | S6 — control-category page entries (frozen P6-T5 shapes) |
| 16 | S6 — A34 wire entries + nextAfterSequence + total + tracker gate |
| 17 | S6 — root fact handoffSourceSessionId; handoff.prepare honestly HANDOFF_PREPARE_UNAVAILABLE |
| 18 | native — runtime fork-reconciliation authority (pre-S6) |
| 19 | native — frozen P7-T7 session reader |
| 20 | S6 — closed stable code set (11 TEAM_REMOTE_*/TEAM_CREATE_* codes) + fail-closed seam codes + LEDGER_CATEGORY_UNKNOWN |
| 21 | S6 — full provenance block (origin/method/endpoint/contractVersion/requestToken/projectionGeneration/effectSequence) + verbatim durable generation |
| 22 | S6 — projection ledger summary {latestSequence, totalEntries, byCategory×8, pendingControlCount} |

## CR closure
- **CR-4** closed: A32 installed; C3 pins spoof rejection over the frozen contract.
- **CR-12** closed: read port (`createTeamDomainReadPort`) + host wiring (projection service + `team.getProjection`); TeamDomain-only authority negatively pinned (C2).

## Open items
1. Projection `root.policyState` reports `'default'` (no durable policyState repository; ephemeral store invisible to the read port).
2. 'resuming' residency not derivable by the overlay — only `resident`/`cold`.
3. Stub-world admission actions cannot complete (stub glue throws by design); C4 = typed facade errors + pure-store paths.
4. Boot probe advances generation once (wiring decision (x)).

## Evidence (this directory)
`tc-s6-chain-fresh.log` (1985/1985), `tc-s6-chain-dist.log` (1985/1985), `tc-s6-live-17-scenarios.log` + `tc-s6-live-summary.json` (17/17, pristine, ports released).
