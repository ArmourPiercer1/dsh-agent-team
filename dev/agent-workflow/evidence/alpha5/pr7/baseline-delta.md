# PR7 (Lane F) baseline delta — same worktree, same node_modules, base vs with-lane

Base = `db5cb5f7` with the lane files moved out (`.lane-holdout/`);
With-lane = the lane committed set in place. Command (both runs):
`npx vitest run packages/domain packages/runtime [packages/testkit/test/p4t6-session-event-scan.test.ts]`

| Run | Files | Tests failed/passed | p4t6 scan count |
| --- | --- | --- | --- |
| base control | 394 (incl. p4t6) | **19** / 4848 | pin 1073 = actual 1073 (GREEN) |
| with lane | 398 (5 lane spec files added) | **19** / 4870 (+32 new green tests) | pin 1073 ≠ actual **1087** (+14) |

**only_in_after = 0** for the domain+runtime packages. The 19 pre-existing
base reds (identical set both runs — COORDINATION records the blueprint-v3
drift family as base-same-fail):
`t2-blueprint-hash` (1), `a4p7-shipped-composition-blueprint` (3),
`p6t3-mediation` (5), `p6t3-restart` (2), `rc2-persona-probe` (3),
`team-skills` (2), `team-spill-local-composition` (3).

**The single new red is the shared p4t6 scanner's exact-count pin**
(`expected 1087 to be 1073`): this lane adds exactly the 14 scannable files
recorded in `a5p7-lane-hygiene.test.ts` and its README, and per
INTERFACES-v1 the scanner is integration-owner-only, so the lane does NOT
bump the pin. All 14 lane files pass the denylist matcher with zero hits
(p4t6's other 9 legs stay green; only the count leg moves).

Evidence logs kept locally in the lane worktree:
`.base-control-run.log`, `.with-lane-run.log`, `.p4t6-with.log`.
