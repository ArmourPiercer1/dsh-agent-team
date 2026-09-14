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
