# Least privilege: the four `team_*` names that appeared in `builtinToolDeny`

Round: `task/dsh-020rc2-upgrade-20261003`, base `6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`,
host generation 0.1.7-rc.1 → 0.2.0-rc.2 (`639ed015397290b3745d163aafe02ffee4aa3f84`).

> **Corrections folded in after the independent review of PR #62 (2026-10-03).**
> An earlier revision of this file made three claims that review disproved, and
> they are corrected below rather than quietly rewritten: (1) the kit's leader
> team-tool allow lane is **six** names, not three; (2) "`restrict()` refusing an
> unknown name" is **not** a 0.2.0-rc.2 tightening — the code is byte-identical
> across the two host generations, so this is pre-existing fixture debt; (3) a
> permission **revocation can** expand what a member can do, because the
> governance service evaluates effective rises for every leader mutation.

## What happened (one paragraph)

The rc2 real-host smoke kit derives the saved blueprint's
`capabilities.builtinToolDeny` as "live model-facing surface − managed tools −
safe-unmanaged tools − the plugin's own team tools", so the mask should name only
BUILTIN tools the smoke does not need. The kit's `TEAM_TOOL_CATALOG` constant
listed 11 names; the plugin registers **15** team tools (13 static `name:`
registrations in `packages/tools/src/tools.ts` plus the
`team_grant_permission` / `team_revoke_permission` pair named at `tools.ts:1316`,
which a `name: 'team_*'` grep misses), so four names leaked into
`builtinToolDeny`. `tools.restrict()` validates names against the agent's
restrictable global vocabulary and refuses the whole root (leader) agent start —
`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` /
`tools.restrict() names unknown global tools "team_archive_…` (recorded live in
`diag/auth-probe-2026-10-03T14-37-03.log` and
`diag/auth-probe2-2026-10-03T14-41-16.log`; the evidence dumper truncates the
message after the first name — a complete capture naming all four is still owed,
see "Still owed").

**Attribution: pre-existing fixture debt, not a host tightening.** The `restrict()`
body — including
`const unknown = [...allow ?? [], ...deny ?? []].filter(name => !known.has(name))`
and the message template — is **byte-identical** at `46a7f68b09…` (0.1.7-rc.1,
`core/tools/index.ts:1096+`) and `639ed01539…` (0.2.0-rc.2, `:1097+`); the
whole-file diff between those two revisions contains only unrelated deltas
(`ask.displayReason`, a guard-line shift). The same fixture would have failed on
0.1.7-rc.1. The debt was created by the plugin rounds that ADDED those tools —
`0838739d` (2026-09-18, `team_list_pending_control`), `98b2926c` (2026-09-21,
`team_archive_member`), `940cd841` (2026-10-02, the permission pair) — without
updating the kit's catalog. That is why the last green archived evidence
(2026-09-17) shows `denyList: []`: it predates all four tools. The fix is entirely
on the fixture side: `tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`
(single catalog source + pre-flight) and criterion L0c; **no production
enforcement file changed** —
`git diff 6b2f401b -- packages/tools/src/tools.ts
packages/tools/src/tool-selector.ts packages/tools/src/builtin-deny.ts
packages/runtime/src/plugin/live/agent-bindings.mjs packages/runtime/src/plugin/root.ts`
→ no output.

## Why this is not a privilege widening — the two lanes are disjoint

| lane | entry point | what it can mask | evidence |
| --- | --- | --- | --- |
| Builtin deny | `applyBuiltInToolDeny` → `agentCtx.tools.restrict({ deny })` (`packages/tools/src/builtin-deny.ts:31-60`) | ONLY the tools the agent INHERITS from the preset/global scope | `packages/runtime/src/plugin/live/agent-bindings.mjs:2166-2180`: "tools.restrict() masks the tools the agent INHERITS … the deny is NEVER a team-tool deny (it cannot hide a team tool)" |
| Team tools | `selectTeamTools(catalog, capabilities.teamTools)` (`packages/tools/src/tool-selector.ts:30-52`), then `agentCtx.tools.register(def)` per selection (`agent-bindings.mjs:2203`) | decides which team tools EXIST for that agent (allow lane = name membership, catalog order, dedup; deny = zero; unknown items never materialize) | `agent-bindings.mjs:2198-2203` |

The four names are the plugin's own registrations in the agent's own scope, so
they are not members of the inherited vocabulary `restrict()` can mask:

- before: builtin mask = {4 team names} ∩ inherited = **∅** (and setup refused);
- after: builtin mask = **∅**.

Identical effective builtin surface. Team-tool availability is governed solely by
the blueprint's `teamTools` allow lane, which this round did not change: the kit's
leader lane is the SIX names `team_list_members`, `team_list_templates`,
`team_inspect_config`, `team_create_member`, `team_delegate`, `team_collect`
(`LEADER_TEAM_TOOLS_ALLOW` in `tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs`,
same list in the base fixture). `{4 names} ∩ lane = ∅` before and after.

Pinned by `packages/tools/test/rc2-team-deny-least-privilege.test.ts` (9 tests):
the registered catalog is exactly the 15 names; the allow lane selects exactly the
lane in catalog order (unknown names drop, order/duplicates normalized); each of
the four becomes reachable ONLY when allow-listed; the mask lane forwards its deny
list verbatim, is a no-op when empty, and REFUSES a team name with the host's own
`unknown global tool` error rather than filtering it (fail-closed propagation,
contract 5 of `issue2-builtin-deny-focused.test.ts`).

## Per-name ownership and the real denial layer

| tool | registered by | principal / channel ownership | the layer that actually blocks an unauthorized call |
| --- | --- | --- | --- |
| `team_archive_member` | plugin team-tool catalog (static `name:` in `packages/tools/src/tools.ts`, the 13th tool) | Leader-only; also reachable over the human remote channel (`member.archive`) and the runtime facade (`archive-member`) — each with its own gate | (1) not selected → never registered → not invocable; (2) member caller → `TEAM_TOOL_ARCHIVE_NOT_LEADER`, with the durable member record unmoved (A6/A8; **not** a proof of pending/permission-store stasis — see the correction below the table); (3) guard last-mile: durable leader-approval gate keyed to action `archive-member` + toolName + `requestToken` (pending → blocked, deny → blocked, one-shot allow consumed); (4) lifecycle FSM: **there is no direct `RUNNING → ARCHIVED` edge, but a RUNNING target is not rejected** — production `packages/tools/src/tools.ts:1142` quiesces the member first (close admission → interrupt → drain → quiescence → release residency) and then commits `RUNNING → SETTLE → SETTLED` followed by `SETTLED → ARCHIVE → ARCHIVED` (two durable commits, verified by `archive-member-tool.test.ts` B1; a SETTLED target takes the single ARCHIVE commit); quiesce failure → `LIFECYCLE_LIVE_EFFECT_FAILED` with zero durable commits (B2); ARCHIVED/DISPOSED/CREATED targets → rejected before any live effect |
| `team_list_pending_control` | plugin team-tool catalog | Leader-only (members rejected); read-only (creates no request, grants no authority) | non-selection; leader gate (`TEAM_TOOL_PENDING_LIST_NOT_LEADER`, zero effects) — `c1-list-pending-control.test.ts`, `rc2-team-deny-least-privilege.test.ts` A6 |
| `team_grant_permission` | plugin team-tool catalog (verb-built pair, `tools.ts:1316`) | Leader-only AND the ONE governance mutation authority | (1) non-selection; (2) leader gate; (3) expansion vs tightening classification against the bound blueprint's `permissionMutationEnvelope` carrier — an expansion without whole-matcher carrier coverage refuses typed with ZERO write (all-or-nothing, ladder-strict, ADR §6); (4) server-side canonicalization of file subtrees / exec intents (a client-supplied fingerprint is never the authority); (5) replay = no-op — `packages/tools/src/tools.ts:1316-1340`, `packages/runtime/governance/service.ts:655-678`, `packages/runtime/test/a3p3-permission-mutation-authority.test.ts`, `a3p4-*` |
| `team_revoke_permission` | same pair (`tools.ts:1316`) | Leader-only governance mutation (removes overlay rules) | same layers as grant, INCLUDING the effective-rise check: `packages/runtime/governance/service.ts:655-678` calls `authorizeLeaderPermissionMutation({ latestRules, plannedRules, mutationRules, envelope, staticFacts, subtreeContains })` for **every** leader mutation, comparing effective authority before and after. **Removing a `deny` rule can expose a lower `allow`, so a revocation CAN widen what the member may do** — such a rise needs envelope coverage exactly like a grant, and an unknown lower fact yields `EFFECT_CONTEXT_UNAVAILABLE` rather than a pass. (The earlier sentence in this file — "a revocation cannot expand authority" — was wrong and is retracted.) |

Negative authority gates recorded as measured (not inferred): a member caller of
any of the four tools gets a typed rejection and the **durable member-instance
record** is identical before/after (`domain.repositories.memberInstances`, A8).
**Correction (2026-10-03, restart round): this paragraph previously claimed the
pending-control list was identical too, and cited A8 for it. That was a hardcoded
inference, not an observation** — the fixture's `readState()` returned the literal
`pending: 0` in both snapshots and never touched the governance pending/permission
store, so the assertion could not fail for any host behaviour. The tautological
assertion is deleted from the suite and this claim is withdrawn: **pending-approval
and permission-overlay stasis across the four refusals is UNPROVEN**, and this suite
is not accepted on that dimension until the durable store those tools write through
is snapshotted before/after (or the fixture's inability to reach it is reported as a
gap). Nothing else in A6/A8 changed; the historical raw logs are untouched.
The leader is not refused by the member gate, and `team_grant_permission` /
`team_revoke_permission` reach the deeper `TEAM_TOOL_PERMISSION_UNWIRED` refusal
below the gate (A7), which is only observable if the gate was passed.

## What the upgrade changed, in security terms

Nothing in the builtin deny lane: `restrict()`'s unknown-name refusal is
pre-existing and identical in `46a7f68b…` and `639ed01539…`. What the upgrade
exposed is that this kit's fixture had been inconsistent with the plugin's own
catalog since 2026-09-18 — invisible while the deny lane was not being
re-validated by a fresh root start. Our contract already required fail-closed
propagation there (`issue2-builtin-deny-focused.test.ts` contract 5: a rejecting
`restrict()` seam must PROPAGATE; "silent continuation" is the forbidden shape),
and the live probe shows the composition honouring it: the typed root-start
failure with **zero** root session created (no `session-…` directory in the world;
an error envelope, so no team, no leader turn, no tool surface).

## Still owed before the full-chain kit run (reviewer gate)

1. ~~Unit-level regressions naming these four tools~~ — **landed**:
   `packages/tools/test/rc2-team-deny-least-privilege.test.ts` (9 tests, vitest +
   `tsc -p packages/tools --noEmit` + eslint clean).
2. ~~A complete (untruncated) capture of the host's unknown-name message naming
   all four tools~~ — **captured** by a bounded single-`team.create` probe over the
   retained stale fixture
   (`diag/deny-name-capture.mjs`, `diag/deny-capture-2026-10-03T15-32-32.log`,
   world retained at `tests/homes/deny-capture-2026-10-03T15-32-32`):

   ```
   TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED
   team.create: starting the root (leader) agent for 'session-auth-probe2-e' failed:
   tools.restrict() names unknown global tools "team_archive_member",
   "team_grant_permission", "team_list_pending_control", "team_revoke_permission";
   known global tools: bash, edit, read, read_image, write
   ```

   The trailing list is the point: the leader agent's ENTIRE restrictable global
   vocabulary on this preset is `bash, edit, read, read_image, write`. None of the
   four team names is in it, which is the empirical counterpart of the structural
   argument above — the mask lane could not have hidden them, and team-tool
   reachability is decided only by the allow lane. The probe issued one create
   attempt, made **zero** model requests (the root agent never started), used
   ports 3495/3498, stopped its own host, and bound nothing on `:3080`.
3. **Still blocked, unchanged**: the single full rc2 real-host smoke run, until
   the security review of the committed evidence passes. Nothing in this round
   has run the full chain.

   > **Historical status — superseded by run5 (later round, 2026-10-03).** The
   > sentence above is left verbatim because it is the record of the round that
   > wrote it; it is no longer the current state. One bounded full-chain run has
   > since been executed (`08-smoke-run5-reader-defects.md`: head `65f07a26`,
   > stamp `2026-10-03T16-28-45`, `VERDICT FAIL 14/19`, exit 2, no budget
   > violation, no watchdog, no compaction abort). So the full chain HAS been run
   > once. What that run does and does not settle is argued in evidence 08 and
   > measured in `rc2-smoke-run5/run5-oracle-digest.json`; in particular the four
   > deny names analysed by this document were not the subject of that run's
   > failures, and nothing here should be read as validated by it.
