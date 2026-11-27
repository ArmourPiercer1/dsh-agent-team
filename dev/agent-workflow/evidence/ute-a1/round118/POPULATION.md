# Round 118 — host-importing vitest population (measured, 44 files)

Rule: collected `vitest` catalog entries carrying a **value** import of a bare `@deepseek-ai/*` specifier
(type-only imports and type-only named specifiers excluded). The round-110 "40 (26+14)" classification count
is superseded by this rule; the measured population is **44**. All 44 were run on BOTH hosts.

Legend: PASS = file green; FAIL = file red; the test counts are rc.5.

| # | file | rc.2 | rc.5 |
|---:|---|---|---|
| 1 | `packages/client/test/a4p6-interventions.client.spec.tsx` | PASS | PASS |
| 2 | `packages/client/test/a4p6-permission-administration.client.spec.tsx` | PASS | PASS |
| 3 | `packages/client/test/a4w4-corrupt-warning-ui.client.spec.tsx` | PASS | PASS |
| 4 | `packages/client/test/a4w6-corrupt-entry.client.spec.tsx` | PASS | PASS |
| 5 | `packages/client/test/d2-team-mode-entry.client.spec.tsx` | PASS | PASS |
| 6 | `packages/client/test/d3-ordinary-mode-entry.client.spec.tsx` | PASS | PASS |
| 7 | `packages/client/test/f9-resolve-control-ui.client.spec.tsx` | PASS | PASS |
| 8 | `packages/client/test/f9u-control-panel.client.spec.tsx` | PASS | PASS |
| 9 | `packages/client/test/f9u-control-surface-probe.client.spec.tsx` | PASS | PASS |
| 10 | `packages/client/test/new-team-entry.client.spec.tsx` | PASS | PASS |
| 11 | `packages/client/test/pr56-control-panel-payload.client.spec.tsx` | PASS | PASS |
| 12 | `packages/client/test/team-activity.client.spec.tsx` | PASS | PASS |
| 13 | `packages/client/test/team-creation-handoff.client.spec.tsx` | PASS | PASS |
| 14 | `packages/client/test/team-creation-panel-refresh.client.spec.tsx` | PASS | PASS |
| 15 | `packages/client/test/team-creation-panel.client.spec.tsx` | FAIL (2) | FAIL (2) — pre-existing, host-independent |
| 16 | `packages/client/test/team-d4-a1-ui-pull.client.spec.tsx` | PASS | PASS |
| 17 | `packages/client/test/team-dock.client.spec.tsx` | PASS | PASS |
| 18 | `packages/client/test/team-governance.client.spec.tsx` | FAIL (1) | FAIL (1) — pre-existing, host-independent |
| 19 | `packages/client/test/team-ledger.client.spec.tsx` | PASS | PASS |
| 20 | `packages/client/test/team-legacy.client.spec.tsx` | PASS | PASS |
| 21 | `packages/client/test/team-member-stop.client.spec.tsx` | PASS | PASS |
| 22 | `packages/client/test/team-members-actions.client.spec.tsx` | PASS | PASS |
| 23 | `packages/client/test/team-members.client.spec.tsx` | PASS | PASS |
| 24 | `packages/client/test/team-roots-zero-state.client.spec.tsx` | PASS | PASS |
| 25 | `packages/client/test/team-timeline.client.spec.tsx` | PASS | PASS (after rc.2-shaped observation fix) |
| 26 | `packages/client/test/team-view.client.spec.tsx` | PASS | PASS |
| 27 | `packages/runtime/test/a3p5-permission-delivery-binding.test.ts` | PASS | PASS |
| 28 | `packages/runtime/test/a3p5-permission-notification-lane-hygiene.test.ts` | PASS | PASS |
| 29 | `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | PASS | **FAIL (9)** — product gap (executor/shadowing) |
| 30 | `packages/runtime/test/a5sf-pd17-fs-policy.test.ts` | PASS | PASS |
| 31 | `packages/runtime/test/a5sf-provider-composition.test.ts` | PASS | PASS |
| 32 | `packages/runtime/test/a5sf-service-install.test.ts` | PASS | PASS |
| 33 | `packages/runtime/test/a5sf-subprocess-unconfined-realm.test.ts` | PASS | **FAIL (2)** — product gap (executor/owner precedence) |
| 34 | `packages/runtime/test/f1-webserver-shim-isolation.test.ts` | PASS | PASS |
| 35 | `packages/runtime/test/f15-mcp-live-loss-characterization.test.ts` | PASS | PASS |
| 36 | `packages/runtime/test/f15-mcp-live-loss.test.ts` | PASS | PASS |
| 37 | `packages/runtime/test/issue2-real-preset-restriction.test.ts` | PASS | **FAIL (suite-level)** — product gap (executor) |
| 38 | `packages/runtime/test/mcp-blueprint-initial-grant.test.ts` | PASS | PASS |
| 39 | `packages/runtime/test/rc2-persona-probe.test.ts` | PASS | PASS |
| 40 | `packages/runtime/test/team-skills.test.ts` | PASS | PASS |
| 41 | `packages/runtime/test/team-spill-local-composition.test.ts` | PASS | PASS |
| 42 | `packages/runtime/test/team-spill-local.test.ts` | PASS | PASS |
| 43 | `packages/runtime/test/u6-mcp-017-regression.test.ts` | PASS | PASS |
| 44 | `packages/testkit/test/m2-scripted-model.test.ts` | PASS | PASS |

Totals: rc.2 **42/44 files, 529/532 tests**; rc.5 **39/44 files, 505/519 tests**.
Every worker in every run printed `HOST-VERSION-GUARD ok host=… resolved=… pin=…` (26 lines per client run,
18 per runtime run), so no run can be green from the other generation's modules.
