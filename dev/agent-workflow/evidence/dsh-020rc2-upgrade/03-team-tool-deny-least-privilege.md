# Least privilege: the four `team_*` names that appeared in `builtinToolDeny`

Round: `task/dsh-020rc2-upgrade-20261003`, base `6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`,
host generation 0.1.7-rc.1 → 0.2.0-rc.2 (`639ed015397290b3745d163aafe02ffee4aa3f84`).

## What happened (one paragraph)

The rc2 real-host smoke kit derives the saved blueprint's
`capabilities.builtinToolDeny` as "live model-facing surface − managed tools −
safe-unmanaged tools − the plugin's own team tools", so the mask ends up naming
only BUILTIN tools that the smoke does not need. The kit's
`TEAM_TOOL_CATALOG` constant listed 11 names; the installed surface carries 15
team tools (13 static registrations in `packages/tools/src/tools.ts` plus the
`team_grant_permission` / `team_revoke_permission` pair named at
`tools.ts:1316`), so four names leaked into `builtinToolDeny`. On
0.2.0-rc.2 the host validates `tools.restrict()` names against the global tool
registry and refuses the whole root (leader) agent start with
`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` /
`tools.restrict() names unknown global tools "team_archive_…"` — recorded live
in `diag/auth-probe-2026-10-03T14-37-03.log` and
`diag/auth-probe2-2026-10-03T14-41-16.log`. The fix corrects the kit's fixture
derivation (`TEAM_TOOL_CATALOG` → the 15 live names, plus criterion L0c which
fails the run if any `team_*` name would land in `builtinToolDeny`).

## Why this is not a privilege widening — the two lanes are disjoint

| lane | entry point | what it can mask | evidence |
| --- | --- | --- | --- |
| Builtin deny | `applyBuiltInToolDeny` → `agentCtx.tools.restrict({ deny })` (`packages/tools/src/builtin-deny.ts:31-60`) | ONLY the tools the agent INHERITS from the preset/global scope | `packages/runtime/src/plugin/live/agent-bindings.mjs:2166-2180`: "tools.restrict() masks the tools the agent INHERITS … the deny is NEVER a team-tool deny (it cannot hide a team tool)" |
| Team tools | `selectTeamTools(catalog, capabilities.teamTools)` (`packages/tools/src/tool-selector.ts`), then `agentCtx.tools.register(def)` per selection | decides which team tools EXIST for that agent (allow / deny = zero / unknown items never materialize) | `agent-bindings.mjs:2198-2203` |

The four names are team-tool catalog entries, registered in the agent's own
scope. They are therefore not members of the inherited/global vocabulary that
`restrict()` masks, so:

- before: builtin mask = {4 team names} ∩ inherited = **∅**;
- after: builtin mask = **∅**.

Identical effective builtin surface. Team-tool availability is governed solely
by the blueprint's `teamTools` allow lane, which this round did not change
(kit blueprint leader allow lane = `team_list_members`, `team_create_member`,
`team_delegate` in both the base fixture and the current one). No capability
that was previously blocked becomes reachable; the change removes four
no-op-then-fatal entries from a *test fixture*, not a restriction from a
production lane. Base-vs-current diff of the enforcement code is empty:
`git diff 6b2f401b -- packages/tools/src/tools.ts
packages/runtime/src/plugin/live/agent-bindings.mjs packages/runtime/src/plugin/root.ts`
→ no output.

## Per-name ownership and the real denial layer

| tool | registered by | principal / channel ownership | the layer that actually blocks an unauthorized call |
| --- | --- | --- | --- |
| `team_archive_member` | plugin team-tool catalog (static `name:` in `packages/tools/src/tools.ts`, the 13th tool) | Leader-only; also reachable over the human remote channel (`member.archive`) and the runtime facade (`archive-member`) — each with its own gate | (1) not selected → never registered → not invocable; (2) member caller → `TEAM_TOOL_ARCHIVE_NOT_LEADER`, zero side effects; (3) guard last-mile: a durable leader-approval gate keyed to action `archive-member` + toolName + `requestToken` (pending → blocked, deny → blocked, one-shot allow consumed); (4) lifecycle FSM (RUNNING → ARCHIVED rejected) and target liveness (ARCHIVED/DISPOSED → `target-stale`) — `packages/tools/test/archive-member-tool.test.ts` A2–A8 |
| `team_list_pending_control` | plugin team-tool catalog | Leader-only (members rejected); read-only (creates no request, grants no authority) | non-selection; leader gate (typed rejection) — `packages/tools/test/c1-list-pending-control.test.ts` |
| `team_grant_permission` | plugin team-tool catalog (verb-built pair, `tools.ts:1316`) | Leader-only AND the ONE governance mutation authority | (1) non-selection; (2) leader gate; (3) expansion vs tightening classification against the bound blueprint's `permissionMutationEnvelope` carrier — an expansion without carrier coverage refuses typed with ZERO write; (4) server-side canonicalization of file subtrees / exec intents (a client-supplied fingerprint is never the authority); (5) replay = no-op — `packages/tools/src/tools.ts:1316-1340`, `packages/runtime/test/a3p3-permission-mutation-authority.test.ts`, `a3p4-*` |
| `team_revoke_permission` | same pair (`tools.ts:1316`) | Leader-only governance mutation (removes overlay rules → strictly relaxing for the member, tightening for the plane) | same layers as grant, minus the expansion envelope question (a revocation cannot expand authority) |

## What the upgrade changed, in security terms

0.2.0-rc.2 made the builtin lane **stricter**: a deny name the global registry
does not know is a hard refusal of agent setup, not a silent no-op. Our own
contract already required fail-closed propagation there
(`packages/tools/test/issue2-builtin-deny-focused.test.ts` contract 5: a
rejecting `restrict()` seam must PROPAGATE, "silent continuation" is the
forbidden shape), and the live probe shows the composition honouring it: the
typed root-start failure with **zero** root session created (no
`session-…` directory in the world; the response is an error envelope, so no
team, no leader turn, no tool surface).

## Still owed before the full-chain kit run (reviewer gate)

1. Unit-level regressions naming these four tools (positive: the selected team
   chain works with `builtinToolDeny: []`; negative: the unselected ones never
   materialize, a member caller is still refused, and our lane forwards deny
   names verbatim so a bad name fails closed rather than being filtered):
   `packages/tools/test/rc2-team-deny-least-privilege.test.ts` (in progress).
2. A complete (untruncated) capture of the host's unknown-name message naming
   all four tools — the message itself is the empirical proof that none of the
   four is in the global registry.
3. Only then the single full rc2 real-host smoke run.
