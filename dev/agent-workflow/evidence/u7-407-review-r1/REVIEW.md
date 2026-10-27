# PR #407 Security Review R1

Verdict: **PASS-WITH-FINDINGS**

Review head: `39bf81d950e05ef87b054a0af498bd80d070fcf9` (`task/u7-f-agentcontrol-b-20261026`). Host-tools pin hash: `35e2a63c5feed18d47e4e03665785efa911616a9ff450c3a040f88520eca4f86`.

## Checks

| Check | Result | Command / verbatim tail |
|---|---|---|
| Zero plane / protected center | VERIFIED | `git diff origin/master...HEAD -- packages/runtime/src/plugin/live/{team-tool-plane,family-assembly,approval-entry-binder}.mjs dev/agent-workflow/ledgers/arc-a-protected-center.json` → no output. |
| Read/mutation split and C1 | VERIFIED | `pnpm exec vitest run packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts --reporter=dot` → `Test Files 1 passed (1)`, `Tests 45 passed (45)`. `get_goal` requests meta only; mutators request tool-invoke + meta. |
| Mutation-kind declared union exactness | FALSE / finding | `contribution.mjs:107-110` declares `kinds: ['tool-invoke','meta']`, while per-row requests include `tool-invoke` and `meta`; however the contribution declaration is only a family-wide union and there is no executed per-row declared-vs-requested mutation control. The PR's E1 compares abstract arm tokens, not contribution `effects.kinds` to each row's requested set. |
| Scope law | VERIFIED with gap | C1 S1a/S1b/S1c pass and mutation-control plants args-derived scope RED. Additional scratch control for whitespace identity failed: implementation trims `exec.agent.id` at `executors.mjs:105-108`, so `alice`, ` alice `, and `alice ` alias to the same state scope. Host agent IDs are opaque branded SessionIds; no normalization law is cited. |
| Transition law | VERIFIED | C1 T1 (24 legs) passes. Host source confirms resume excludes completed and block accepts active only (`goal/src/index.ts:368-414`). |
| Replay idempotence | VERIFIED with gap | C1 R1a/R1b/R1c/R1d pass. Recording store logs a write before replay/stale checks, so refused replay is not zero-write in the store observation. Reproduction: `state-store.mjs:107-110` and `133-136` push `log.writes` before checking `applied`; output shows two writes for same applyId while second is refused. |
| Durable facts | VERIFIED with gap | Positive C1 read-back passes; refused row-level operations show no writes. But direct store refusals record a `writes` entry before refusal (`state-store.mjs:107-124`, `133-140`, `146-155`), weakening the claimed “refused one leaves NONE / no write” invariant if the log is the durable-store audit. |
| Authority handle reachability | VERIFIED | New lane only receives `decide`, `pa`, and validated injected store; no kernel/registry/approval/grant handle in capability or family source. |
| Out-of-lane bookings | VERIFIED | Manifest/index, census, p4t6, dist placement and family count changes are present; no protected center edits. `gen-family-index --check` is recorded green in PR evidence. |
| C2 honesty / EB3 run shape | VERIFIED / COULD NOT FULLY VERIFY | PR body and evidence plainly disclose production store seam absent and classify positive C2 legs DISCLOSED-NO-SEAM. Recorded evidence contains `overall` only in adjacent stdout, but the committed `*.u7fagentb-evidence.json` lacks required top-level `overall`, `finishedAt`, and `bindings.authority` fields. Thus EB3 RUN manifest compliance is unproven for this family record. The recorded run is run 5 and witness is captured in `bootB.refusalHits` (`team-create-body: PLANE_AGENT_STATE_STORE_MISSING`). |
| C3 3d execute digest | VERIFIED | Evidence records original names-only control failing to detect body swap, then corrected contribution binds `execute?.toString?.()` at `contribution.mjs:50-61`; source visibly includes execute transport. |
| Hosted checks | COULD NOT VERIFY | `gh pr view 407 --json headRefOid,statusCheckRollup` returned head OID but `statusCheckRollup: []` in this environment; no hosted SUCCESS list available. |
| Evidence guard | VERIFIED | Copied `scripts/eb3-evidence-guard.mjs` from `origin/master` into scratch, ran `node scripts/eb3-evidence-guard.mjs --new-since origin/master`: `EB3-EVIDENCE-GUARD pass added=31 bound=1048576 exempted=0 findings=0`. Temporary copy removed. |

## Findings

### [Medium] Scope identity is normalized without a host-backed law

File: `packages/tools/agent-state-family/src/executors.mjs:105-108`.

`scopeOf` calls `.trim()` on the calling agent ID. The requested scope law is exact calling-agent ownership. The host uses opaque branded `SessionId` identities and does not establish whitespace/case canonicalization. Consequently IDs differing only by whitespace alias the same durable scope; the required whitespace/case negative control is absent. Preserve the exact dispatch identity (or cite and test a host canonicalization rule) and add controls for whitespace and case.

### [Medium] Recording store claims zero writes but logs refused writes

File: `packages/tools/agent-state-family/src/state-store.mjs:107-124,133-140,146-155`.

`applyGoal`, `applyTodos`, and `applyPlanModeExit` append to `log.writes` before replay, CAS, or inactive-plan checks. A repeated grant, stale revision, or inactive plan therefore produces a write-log entry despite no state mutation. This contradicts the PR’s durable-fact requirement that refused operations leave no write observed and makes the store witness unsuitable as a no-write audit. Move logging after successful mutation (or distinguish attempted calls from durable writes and assert the latter).

### [Low] Contribution effect declaration is not pinned per row

File: `packages/tools/agent-state-family/src/contribution.mjs:107-110`; test `packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts:253-283`.

The family declares only the union `['tool-invoke','meta']`; E1 checks requested abstract arms, not exact per-row declared effects against each row. The #404 declared-vs-requested failure class therefore remains possible at row granularity. Add a mutation control that changes one row’s declared effect mapping and turns red.

### [Low] Committed C2 evidence omits EB3 RUN-required fields

Files: `dev/agent-workflow/evidence/u7-f-agentB-20261026/c2/u5-u7-fagentb-x-2026-10-27T00-41-36-828Z.u7fagentb-evidence.json` and `tests/world-factory/suites/070-u7-fagentb.mjs:252-259`.

The run JSON records boots, cases, leaks, disclosure and law, but not top-level `overall`, `finishedAt`, or `bindings.authority`. The adjacent stdout has `overall=PASS`, but that is not the committed run record. This prevents independently validating EB3 RUN binding and completion facts.

## COULD-NOT-VERIFY

- GitHub hosted status checks: `gh pr view` returned an empty `statusCheckRollup`; no SUCCESS statuses could be independently observed.
- Live positive read/write C2 legs are correctly disclosed as unavailable because production store wiring is absent; no positive delivery claim was made.
- The requested scratch digest-swap execution was not rerun independently; the committed evidence and source inspection show the corrected `execute?.toString?.()` binding and the historical RED control.
