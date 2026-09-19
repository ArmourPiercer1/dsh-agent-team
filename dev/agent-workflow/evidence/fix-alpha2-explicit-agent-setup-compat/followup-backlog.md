# Follow-up backlog — fix/alpha2-explicit-agent-setup-compat (2026-09-14)

Recorded per plan §13 (unrelated findings: record, do not fix in this task).

## 1. Upstream: `dsh-client-connection` drops `webServer` from its inject (0.1.5+)

- **Finding.** Upstream commit `2ef85b1e17` (shipped in every published 0.1.5
  build: alpha.1 / alpha.2 / rc.1 / rc.2 — verified against npm dists) removed
  `webServer` from the `dsh-client-connection` row's inject array
  (`["webServer", "credentials"]` → `["credentials"]`) and moved the `/api`
  mount into a child fiber. The service's `rpc.handle(channel, handler)`
  still registers its route with `owner.webServer.register(route)`, and the
  Cordis property walk for `owner.webServer` starts at the CONNECTION row's
  own fiber (the traceable shadow), so from 0.1.5 on, NO external plugin row
  that calls `connection.rpc.handle(...)` without injecting `webServer`
  itself can mount a remote channel: it fails with
  `cannot get property "webServer" without inject`.
- **Evidence.** Probe runs `probe-20260914T072324Z` (root cause: 0.1.5
  `rpcHandle` FAIL / 0.1.2 OK; connection-row inject is the only topology
  difference) and `probe-20260914T072905Z` (shim verification); full npm
  version matrix in `teardown-probe-scratch.log`.
- **This task's bounded response.** Plugin-side compatibility seam in
  `packages/runtime/src/plugin/host.ts` (an `internal/get` waterfall listener
  that resolves the `webServer` property read through the strict service
  read; behavior-preserving on 0.1.2-era and headless hosts — verified on
  both hosts). Not an upstream patch (CORE PATCH BUDGET stays 0).
- **Suggested upstream follow-up (NOT done here).** Either re-inject
  `webServer` on the connection row (restores 0.1.2 behavior for external
  rows), or expose a first-class `connection.rpc.register(channel, handler)`
  API that owns its own webServer dependency, so external rows never need to
  see the host's web server at all.

## 2. Upstream 0.1.5: spawn `subagent` tool is structurally un-denyable — standard-preset strict agents cannot pass the Coverage Gate

- **Finding.** On 0.1.5 (verified in the npm 0.1.5-rc.2 dists), the
  standard preset mounts the spawn `subagent` tool with
  `modelSelectionSettings: true`, which makes `dsh-tool-subagent` install
  it via a DEFERRED PER-AGENT path (`agent/created` →
  `agent.ctx.inject(['tools','subagents','systemPrompt'])` → register):
  the tool lands in the agent's OWN tool layer. The host's
  `tools.restrict()` (the ONLY removal mechanism `builtinToolDeny` uses)
  computes `restrictableNames` from the global + inherited layers and
  EXCLUDES the agent's own layer — so `restrict({deny: ['subagent']})`
  throws `tools.restrict() names unknown global tool "subagent"` (verified
  live in the smoke run `a2x-smoke-20260914T07-34-10Z`: both RED and GREEN
  legs died at this error during setup). The sibling `subagent_fork`
  (no `modelSelectionSettings`) installs immediately from the preset row
  context into the global layer and IS restrictable — the two
  near-identical tools land in different layers.
- **Consequence.** The plugin's Coverage Gate classifies `subagent` as
  KNOWN_SENSITIVE (fatal, by design — source-reviewed alpha.2 registry),
  and nothing on a standard-preset agent can remove it from the surface:
  `builtinToolDeny` cannot name it (restrict fails either before it
  registers — "unknown global tool" — or after — own-layer names are not
  restrictable). Therefore on 0.1.5-rc.2, EVERY strict
  (`capabilities.permissions`) team agent on the standard preset fails
  setup — either at restrict (if the deny list names it) or at the gate
  (`alpha2-permission-coverage-unmanaged-tools`, if not). This is a
  host-contract × plugin-design collision, unrelated to the AgentSetup
  identity defect fixed by this task.
- **This task's bounded response.** The real-host smoke's worlds mount a
  KIT-AUTHORED USER preset `a2x-a5` (persona + `dsh-tool-fs` only — read /
  read_image / write / edit, NO delegation group) through the public
  0.1.5 user-preset seam (`$DSH_HOME/.agent-presets/`, `USER_PRESET_DIR` in
  the npm 0.1.5-rc.2 `dsh-agent-presets` dist). That is the only
  deterministic way to satisfy plan §9 end-to-end on 0.1.5-rc.2: (i) every
  shipped non-minimal preset (standard/cordis/ptc) mounts the spawn
  `subagent` and is therefore gate-blocked for strict agents (verified
  live: `runs/a2x-smoke-20260914T07-34-10Z`, restrict threw
  `unknown global tool "subagent"`); (ii) the shipped `minimal` preset
  avoids the collision but its only managed tool is `bash`, and the
  alpha.2 policy (A2C-1, `packages/domain/blueprint/src/validate.ts`)
  rejects a whole-tool ALLOW for the shell class (`bash`/`pwsh`) — so the
  plan §9 "one ALLOWED managed tool enters the permission pipeline"
  proof is impossible on `minimal` (verified live:
  `runs/a2x-smoke-20260914T07-46-35Z`, MALFORMED_DTO "the allow lane must
  not carry a bash rule"). `a2x-a5` puts `read` (allow-lane-legal) on the
  created surface with no subagent anywhere. The AgentSetup identity /
  permission pipeline under test is preset-agnostic; the standard-preset
  collision is documented here instead of being re-designed in this fast
  fix (plan §5: no re-design; §13: unrelated → record).
- **Suggested follow-ups (NOT done here).** (a) Upstream: make the
  `modelSelectionSettings` install land in a restrictable layer, or
  extend `tools.restrict()` with a scope-local deny; (b) plugin/alpha.2:
  an operation adapter (authority owner) for the delegation class, or a
  reviewed SAFE classification for `subagent` if the threat model allows
  it; (c) presets: stop mounting the spawn subagent in the default team
  preset until (a)/(b) land.

## 3. Known flaky test: `p6t1-parallel` under full-suite load

- **Finding.** One sporadic full-suite failure of
  `test/p6t1-parallel.test.ts` observed on 2026-09-14 (passed in the baseline
  log, the previous agent's after-log, 2 of my 3 full runs, and 5/5 isolated
  runs). Precedent in SESSION_ROUTER_LOG (alpha.2 hardening closure):
  "p6t1-parallel flake 3 tests → isolation 9/9 裁决".
- **Suggested follow-up (NOT done here — pre-existing, unrelated).**
  Timing/load investigation of the parallel-membership messaging test.

## 4. Pre-existing full-suite failures (baseline @ df9230d, unchanged)

`d3-member-identity-context` (D3-4), `p6t3-mediation` (×5), `p6t3-restart`
(×2), load-failures `p8s3b-result-effects` / `t12a-b2-child-identity` /
`t12a-glue-handoff-ports`. Identical before and after this fix (see
`baseline-worktree-fullsuite.log` / post-fix reruns). Tracked by their
originating tasks; out of scope per plan §5.

## 5. P1 (CASE B): standard-preset `subagent` lands POST-gate — the gate-verified surface is not the model-facing surface (2026-09-14 evening, live-verified on 0.1.5-rc.2)

- **Finding.** On DSH 0.1.5-rc.2, standard root preset + leader
  `capabilities.permissions` (20-name deny list covering every standard DISC
  tool except the five gate-managed fs tools and `todo_write`; `subagent_fork`
  denied, `subagent` deliberately not denied):
  - **A** (the Coverage Gate's `tools.schemas(agent)` read during
    composition): gate PASSED → subagent ∉ A (subagent is classified
    KNOWN_SENSITIVE, so a pass implies it was absent there).
  - **B** (post `agents.create()` publication, probe timeline of the created
    leader): the `created-sync` snapshot taken INSIDE the `agent/created`
    dispatch = 8 tools WITHOUT subagent; 2 ms later the deferred own-layer
    install lands (`tools/change-42` = 9 tools WITH subagent); every later
    snapshot keeps it.
  - **C** (the model's first request body, mock-captured): 9 tools
    INCLUDING subagent (`bash, edit, read, read_image, subagent,
    team_list_members, team_send_message, todo_write, write`).
  - subagent A/B/C = **false/true/true** (first appearance: `tools/change-42`);
    subagent_fork A/B/C = false/false/false (denied at composition, as
    designed).
  The standard preset defers its own `subagent` layer to the `agent/created`
  event that dsh-agent-loop's `publish` dispatches at publication
  (enter → announce → session-start) — structurally after the gate. The
  permission Coverage Gate therefore verifies a surface that is NOT the
  surface the model actually receives for any standard-preset team agent.
  This refines/empirically closes item 2 (the 07-34-10Z run proved the
  install is own-layer and un-restrictable; this run pins the TIMING to
  post-gate with an A/B/C timeline on a real host).
- **Evidence.** `probe/runs/f2-standard-probe-20260914T11-42-48Z/`
  (summary.json — gateOutcome / aSurface / bSurface entries / cSurface /
  subagent{a,b,c,firstAppearanceLabel} / subagentFork; probe-timeline.jsonl;
  team-create.json; c-surface.json; disc-surface.json). Debug history:
  `f2-standard-probe-20260914T11-21-00Z` (eager service capture),
  `-11-25-43Z` (prompt-vs-publish startup race → spurious
  session/not-found), `-11-39-52Z` (missing DEEPSEEK_API_KEY in the fresh
  probe home → accepted turn never reached the model endpoint).
- **Status per review instruction F2.** Marked **P1 POST-GATE SURFACE
  EXPANSION**; NO fix in this round (probe-only mandate).
- **Candidate options (NOT implemented — recorded for adjudication only).**
  1. **Upstream (dsh-agent / dsh-agent-loop / dsh-tool-subagent)**: perform
     the deferred `modelSelectionSettings` install BEFORE the publish/announce
     (i.e. during setup, after the setup Agent exists — the install needs the
     Agent; the loop could run it in setup once the Agent is bound) so the
     gate sees the final surface; or make `tools.schemas(agent)` reflect the
     pending own-layer install (surface prediction at setup time).
  2. **Plugin/alpha.2 (Team runtime)**: re-read the surface at publication
     (a post-announce verification pass) and fail closed / roll back if the
     published surface gained unmanaged KNOWN_SENSITIVE tools since the gate
     (turns post-gate expansion into a detected, typed failure instead of a
     silent model-visible gap).
  3. **Plugin (preset wiring)**: for strict (capabilities.permissions)
     agents, mount the subagent capability explicitly through the
     restrictable layer (or an operation adapter for the delegation class)
     instead of relying on the preset's deferred own-layer row — i.e. the
     team owns the surface end to end (overlaps item 2(b)).
  4. **Policy/classification**: if the threat model accepts subagent as
     SAFE under an explicit strict grant, classify it accordingly — NOT
     recommended without a reviewed threat-model change (subagent spawns
     full agents).

## 6. C2 — subagent descendant governance: in-process descendants escape the Team member's agent-local permission/deny governance (2026-09-18, recorded by the C1 leader-approval reachability repair — BACKLOG ONLY, no code in that round)

- **Finding.** DSH subagent descendants (spawned in-process by the
  `subagent` tool) do not inherit the Team member's agent-local
  parameter-permission policy or `builtinToolDeny` governance: a Team
  member can delegate to a descendant that carries the parent PRESET's
  standing composition but NOT the member's agent-local permission
  listener/guard. No hard plugin-level deny exists in this release
  (CORE PATCH BUDGET = 0 forbids the upstream fix), and
  `builtinToolDeny: [subagent]` is NOT a reliable mitigation — items 2
  and 5 above prove the spawn `subagent` is own-layer and un-restrictable
  on the non-minimal presets (`standard`, `cordis`, `ptc`): listing it
  in `builtinToolDeny` fails setup with `unknown global tool
  "subagent"`, and the gate-verified surface is not the model-facing
  surface (the deferred install lands post-gate).
- **Consequence for team authors (temporary guidance, shipped in the
  C1 skill update).** While C2 remains open: (a) prefer a preset that
  does not mount the spawn `subagent` tool (the shipped `minimal`
  preset is the known example) or a custom preset/composition without it;
  (b) if a standard/cordis/ptc preset is intentionally kept with
  `subagent` visible to the model, record C2 as an ACCEPTED TEMPORARY
  RISK in the team's design notes.
- **Re-open criterion.** If a future rc.2-compatible plugin change makes
  `subagent` genuinely restrictable (or descendants inherit the
  member's agent-local governance), update the skill guidance ONLY
  after a post-publication model-surface test proves the tool is
  actually removed from the model-facing surface (or that descendants
  are governed) — the gate read alone is not evidence (item 5).
- **Status.** BACKLOG ONLY — no plugin or upstream code in the C1
  round; the C1 skill update (`team-blueprint-authoring` §5.2)
  corrects any earlier implication that `builtinToolDeny: [subagent]`
  is an effective mitigation.
