# SHARED-FILE ASSEMBLY REGION MAP (center coordination, root 18:11)

Purpose: two wire owners will EDIT shared files (agent-bindings.mjs, team-tool-plane.mjs)
in their OWN isolated worktrees; this map is the block/anchor contract so cross-merges
touch disjoint regions. Measured on int tip per git; re-measure anchors before editing.

## packages/runtime/src/plugin/live/agent-bindings.mjs

| Region | Measured anchor (int tip) | Owner today | Rule for the two wire writers |
| --- | --- | --- | --- |
| governed-families imports | :361-364 (todo/write/image/image-attachment) | existing | APPEND import lines BELOW :364 — schedule-wiring import = schedule writer's block; g6-session-query-wiring import = G6 writer's block. Adjacent additions; cherry-pick merges append in pick order. |
| mount-moment registration blocks (registerA5GovernedFamily) | todo :3542, write :3563, image :3594 (pattern: placementFeed -> definitionIdentity string check -> register) | existing | NEW sibling blocks go AFTER the image block (post-:3594 region): SCHEDULE block first, G6 block after it — each a self-contained block, no interleaving with todo/write/image bytes. |
| live ctx.schedule capture (native Agent object, liveScheduleService) | schedule writer's own new seam region — must NOT move existing ctx construction bytes | schedule writer | exclusive: d675792d |
| g6 ceiling/backend injection point | G6 writer's own new region | G6 writer | exclusive: 00270f41 |

## packages/runtime/src/plugin/live/team-tool-plane.mjs

| Region | Measured anchor | Owner today | Rule |
| --- | --- | --- | --- |
| todo arm injection seam | :828-:855 | existing | UNTouched by both writers |
| write arm seam | :876-:901 | existing | UNtouched |
| paAdmitBody funnel (THE production consume funnel; row paths mount pa: paAdmit) | :1015-~:1720 (split-path shapes :1679/:1713/:1714 per G6 lane) | existing | BOTH writers mount their rows onto this funnel via the backends seam; EDIT ONLY their own backends-row region — never the funnel body itself |

## Merge-order law (center-side)

1. Each writer: own branch, own physical worktree, push only own branch.
2. Center integrates ONE branch at a time onto feat/a5-m2-integration by ordered
   cherry-pick -x (schedule first if both ready — earlier anchor wins, second rebases
   its post-:3594 block onto the moved anchor; import region dedups trivially).
3. After EACH landing: combination validation = the landed lane's spec +
   {schedule-adapters 29, g6-session-query-c1 52, g1-query-wiring 18, family-rules,
   p6t4-deny, image-handoff} + tsc, true RCs.
4. Forbidden to both: other family's blocks/ledger bytes, Core, pa-mount-registry.mjs,
   pa-control-bridge.ts, control/types.ts (grammar gate lands ONLY via root-signed
   candidate from a5m2-contract-candidate/), tests/homes, ports/Host.
5. "Wired" wording is reserved for production-reachable
   capture -> real PA open/edge -> unique consume -> native -> dispose
   proved by a production-path spec leg; factory/registry+input.admit{ok:true}
   = factory assembly, NOT wiring (root 18:11).
