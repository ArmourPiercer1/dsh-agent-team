# RC2 real-host smoke kit design (S1–S5) — working notes (main agent)

Status: DESIGN FINALIZED 2026-09-17. Kit to be written AFTER A6+A2 (+A1) are
integrated on `fix/rc2-runtime-compat` (the smoke runs against the FIXED dist).

## Kit location & invocation

- `tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs` (tracked; per the
  "kits 归位 (tracked)" convention — TEST_METHODS §4.1).
- Usage: `node rc2-real-host-smoke.mjs [--worktree <path>] [--host-port <n>] [--keep]`
  - `--worktree`: the tree carrying the plugin dist under test. Default = 4
    levels up from the kit (the main checkout). At smoke time pass
    `.worktrees/rc2-repair` (the fix branch with the rebuilt dist).
  - `--host-port`: 3180..3186 (default: first free; :3080 + :3180-GUI probed
    401 pre/post, zero-touch).
  - `--keep`: retain the DSH_HOME world.
- Evidence: `<worktree>/dev/agent-workflow/evidence/rc2-repair/smoke-<stamp>/`
  (run.log, per-leg JSONs, summary.json, instance logs, :3080/:3180 pre-post).

## Host (user-adjudicated: test-use checkout, NOT npm dist)

- `node <testuse>/apps/cli/lib/bin.js web --port <p> --no-open`
- **cwd = a per-world scratch dir** `<home>/workspace` (NOT the test-use root):
  the created leader's session workspace = host process.cwd (= defaultWorkspace,
  a2x-verified). Probe files (team/test.md, runtime/x) live in the scratch —
  the pristine test-use tree never sees untracked files (porcelain must stay
  empty; TEST_METHODS). Bin path absolute; module resolution follows the
  entrypoint, verified boot shape is cwd-independent (boot smoke ran at the
  checkout root; the npm-dist a2x host ran from its own dir — same mechanism).
- env: `DSH_HOME=<home>`, `DSH_CLIENT_COMMIT_HASH=fb2c4b9e69`,
  `DEEPSEEK_BASE_URL=http://127.0.0.1:3496`, `DEEPSEEK_API_KEY=rc2-smoke-mock-key`.
- test-use must be @ fb2c4b9e + built (it is; re-verify porcelain pre/post).

## World shape (ONE world, sequential legs — S1–S5 share the instance)

- home: `tests/homes/rc2-smoke-<stamp>` (+ `<home>/profiles/web/cordis.patch.yml`
  with the production row + p6t6 row; `<home>/.agent-presets/rc2-smoke/
  agent.cordis.yml`; `<home>/p6t6-directive.json` {boot:1, phase:'create',
  rootSessionId: ROOT}).
- row config (3b4912a contract — verified against host.ts L370): rootSessionId
  ROOT=`session-rc2-smoke-root-<stamp>`, bootPhase 'create',
  blueprintSource = BOOT BLUEPRINT ANCHOR **A** (demo A: leader + member
  template `worker-a` — the ROW ANCHOR for the A2/S4 divergence),
  blueprintDir = `<worktree>/.rc2-smoke-blueprints/` (saved-source catalog:
  A/B/C below), rootPresetId=memberPresetId='rc2-smoke', seedMembers [],
  generation 1, staticModel {provider:'deepseek-official',
  model:'rc2-smoke-model'}, deniedSelection null, mcpServers [], mcpServer
  null, environmentFacts (tool.web / skill.base / persona.standard),
  externalPolicyFacts {hard:{},capabilityExists:{}}, glueUrl, seamUrl.
- **preset `rc2-smoke`** (kit-authored, public user-preset seam): persona +
  `@deepseek-ai/dsh-tool-fs` + the minimal-style PERSISTENT SHELL GROUP
  (cordis:group isolate terminals:true → `@deepseek-ai/dsh-terminal` +
  `@deepseek-ai/dsh-terminal-bash` + `@deepseek-ai/dsh-tool-bash-persistent`,
  ported from the rc.2 shipped `minimal` preset). NO delegation group / no
  `dsh-tool-subagent` row (0.1.5 deferred own-layer subagent is structurally
  un-denyable under the Coverage Gate — followup-backlog item 2 / P1 CASE B;
  the a2x SMOKE SCOPE DECISION stands).
- **LEG 0 (discovery)**: boot team = blueprint A (leader WITHOUT capabilities →
  legacy path, gate absent — the production boot shape). Drive one leader turn
  (MK_DISC) → capture the model-facing surface → `builtinToolDeny` = surface −
  MANAGED_TOOL_NAMES − SAFE_UNMANAGED (todo_write) − TEAM_TOOL_CATALOG
  (the 11 team tools) → write saved blueprints B/C with that deny list. (a2x
  D1–D3 leg, unchanged.)
- Saved blueprints (catalog files):
  - **A** `rc2-smoke-a.yaml` (the row anchor / boot team): leader (persona
    A-LEADER, NO capabilities), member template `worker-a` (persona A-W).
  - **B** `rc2-smoke-b.yaml` (S4 bound snapshot): leader (persona
    B-LEADER, capabilities.permissions: `allow: read subtree team`,
    `deny: read subtree runtime`, `ask: bash any` (or whole-bash ask lane —
    verify the closed resource kinds; the plan §10 minimal shape uses
    `tool: bash resource: any → ask` via the default-ask + explicit deny/allow
    lanes; exact YAML from plan §10), default: ask; teamTools allow:
    team_list_members, team_list_templates, team_inspect_config,
    team_create_member, team_delegate, team_send_message; builtinToolDeny =
    discovery deny list; skills/mcp allow []), member template
    `worker-b` (persona B-W).
  - **C** `rc2-smoke-c.yaml` (S5 bound snapshot): SAME templateId `worker-b`
    with persona C-W (different text); leader persona C-LEADER; otherwise as B
    (permissions lanes can be empty/ask — S5 only proves persona scoping).
- remote calls (a2x shape): POST /team-remote/<method>, client-request
  envelope {version:1, params}.

## Legs

- **S1 — leader static allow subtree** (A1 allow path): on the B-created team
  root (CREATE_ROOT_B): scripted turn (MK_S1) → mock issues `read`
  {file_path: 'team/test.md'} (file pre-written in `<home>/workspace/team/`).
  Expected: the read EXECUTES (tool result fed back; turn completes), NO
  control request lands, p6t6 observations carry the `alpha2-perm` decision
  row with `decision:"allow"` for tool read (subtree hit — NOT a
  canonicalization-failure row).
- **S2 — leader static deny subtree** (A1 deny path): turn (MK_S2) → `read`
  {file_path: 'runtime/x'}. Expected: STATIC DENY (observation row
  `decision:"deny"` with the subtree context; the tool result is a denial),
  explicitly NOT `root-not-canonicalizable` / `containment-undeterminable`
  (the pre-fix symptom).
- **S3 — leader ask→approve bash** (A6 proof): turn (MK_S3) → `bash`
  {command: 'echo rc2-smoke'} (tool name/args = the persistent bash's
  contract — verify param names from the rc.2 dsh-tool-bash-persistent tool
  schema in the test-use checkout). Expected: a control REQUEST lands in
  p6t6 state `control.requests` (the bash ask); the scripted APPROVAL =
  `POST /__p6t6/tool` {name:'team_resolve_control', args:{requestId, decision
  'allow'...}, as: <principal>} — PRINCIPAL TRIAL ORDER: as=ROOT (the boot
  root = host-known operator / human override per the p6t6 harness comment)
  first, then as=CREATE_ROOT_B (the leader) if 403 — the harness answers
  403 'no authorized team principal' with a clear message; RECORD which
  principal resolved it (documented deviation: plan S3 says "GUI approve";
  the scripted approval goes through the public team_resolve_control tool
  executed by the p6t6 harness seam — same durable path the GUI drives).
  After the decision: p6t6 `control.decisions` carries allow; the bash
  EXECUTES (the leader turn completes with the echo output in the tool
  result; mock final text MK_S3_DONE). Pre-fix (A6) this fails: post-allow
  guard → target-stale → the bash never runs. (A6 is fixed by the time this
  runs; the leg is the real-host proof.)
- **S4 — bound blueprint member create** (A2 proof): remote
  `team.create` {rootSessionId: CREATE_ROOT_B, blueprintId: B, initialWork
  {prompt: MK_B_WORK}}. Expected: ok, path 'fresh-root' (or the contract's
  success shape); the B leader's initial-work model request lands (mock) with
  persona B-LEADER in its system prompt (persona-source = bound B, not row
  anchor A — assert the text). Then scripted B-leader turn (MK_B_WORK /
  follow-up): `team_create_member` {templateId: 'worker-b', ...} → durable
  create success AND API success (pre-fix: durable success + FALSE rejected —
  the binder's persona lookup hit row anchor A which lacks worker-b) AND the
  binder installed persona B-W: prove via a scripted `team_delegate`
  {instanceId: <worker-b member>, prompt: MK_B_MEMBER} → the member's model
  request system prompt carries B-W (not A-W, not absent).
- **S5 — second team / different snapshot** (root-scoping, not row-global):
  same world, remote `team.create` {rootSessionId: CREATE_ROOT_C,
  blueprintId: C, initialWork {prompt: MK_C_WORK}} → C leader (persona
  C-LEADER in its model request). Scripted C-leader turn:
  `team_create_member` {templateId: 'worker-b'} (same templateId as B!) →
  success + the delegated C member's model request system prompt carries C-W
  (different from B-W) while the B member still carries B-W (re-delegate or
  re-assert from the captured B request).

## Observability & evidence

- p6t6 row (`packages/tools/harness/plugin.mjs`): /__p6t6/health (setupError
  latch — fail fast on row setup failure), /__p6t6/state (members, teamSession
  {blueprintId, revision, contentHash}, control {requests/decisions/
  consumptions}, observations), /__p6t6/tool (scripted team-tool execution as
  a principal). The directive root = ROOT (the boot root); the CREATED teams'
  control/persona evidence comes from (a) mock-captured model requests
  (system prompts = persona text) and (b) p6t6 observations (the alpha2-perm
  rows are root-scoped — verify whether observations for created roots appear
  in the boot-root state; if not, persona = mock system prompt is the
  authority and control evidence for S3 = the created root's own control
  state... p6t6 state is per-directive-root: S3's control request belongs to
  CREATE_ROOT_B — CHECK state shape at implementation; fallback: the
  observation feed or a second p6t6 directive for the created root —
  DECIDE AT IMPLEMENTATION, record the choice in summary.json).
- mock model: `packages/tools/harness/mock-deepseek.mjs` on 3496 (shared;
  decide policy per marker, a2x makeDecide shape; match markers against ANY
  user message — the host appends runtime-context user messages).
- stable instances: :3080 + :3180 GET pre/post (expect 401/401 — both are
  live DSH instances in this environment; read-only).
- teardown: stop host, close mock, remove scratch (team/, runtime/, probe
  files) — they live in `<home>/workspace` and vanish with the home unless
  --keep; remove the blueprint scratch dir; re-verify test-use porcelain
  empty + HEAD fb2c4b9e; re-verify references/ untouched.

## Open items to settle AT IMPLEMENTATION (record in summary.json)

1. `bash` persistent tool parameter contract (command? args? name?) — read
   the rc.2 dsh-tool-bash-persistent tool schema in the test-use checkout.
2. Whether p6t6 state surfaces the CREATED roots' control state (directive is
   boot-root-keyed) — if not, script S3's request/decision reads via the
   observation feed or a second directive; do NOT widen the harness in this
   round (if a harness change is needed, it is a separate commit on the fix
   branch with its own tests — decide then).
3. Which principal (human/root vs leader) the bash-ask resolution requires —
   trial order above; record the winner.
4. The exact closed resource-kind YAML for `bash any → ask` (plan §10 shape).
5. `team.create` success-shape field names at 3b4912a (a2x: result.value.data
   .path === 'fresh-root').
6. Persona assertion: exact system-prompt location of the persona prefix in
   the captured request (assert substring of the unique persona text —
   simplest, robust to assembly).

## Exit codes (a2x convention)

0 = all S1–S5 green; 2 = legs ran, expectation failed; 1 = kit-level FATAL.

## Settled at implementation (2026-09-17 — kit written: tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs)

Open items 1–6 resolutions (evidence: the kit itself + source citations):

1. **bash param** = `command: string` (shipped minimal preset
   `packages/preset/agent-presets/presets/minimal/agent.cordis.yml` —
   dsh-tool-bash-persistent description: "the contents of the `command`
   parameter…").
2. **p6t6 state is boot-root-keyed** (`directive.rootSessionId` read once at
   boot — plugin.mjs L115/L256/L323): the created teams' control state is
   NOT in `/__p6t6/state.control`. S3 discovers the pending requestId from
   the **observation feed instead** — the permission listener emits
   `alpha2-perm: {"stage":"request-created","callId":…,"requestId":…,"kind":…}`
   (pre-execute-adapter.ts L1157 observe → onObserve → the same feed a2x
   R2/G7 used, global across roots). Fallback: read-only DSH_HOME JSON
   storage scan. Harness NOT widened (per the ruling).
3. **Approval principal = the boot root (human).** The leader's own ask is
   kind USER_APPROVAL (`isLeader ? USER_APPROVAL : LEADER_APPROVAL`,
   pre-execute-adapter.ts L650-652) whose resolvers are **human only**
   (team_resolve_control contract, packages/tools/src/tools.ts
   resolveControlSpec); the leader principal would be rejected. No trial
   needed — the kind is determined, so `as` = boot root directly. The
   service-level `resolveControl` maps the tool's `requestToken` to the
   request (`requestToken: args.requestId`) — the kit passes
   requestToken = requestId.
4. **resource-kind YAML**: `bash any → ask` = `{tool: bash, resource:
   {kind: any}}`; the subtree lanes use `{kind: subtree, path: <workspace
   path>}` (domain/blueprint types.ts L68-69 — `subtree` matches the path
   itself + every canonical descendant). `team` / `runtime` are
   workspace-relative (host cwd = session workspace = the scratch dir).
5. **team.create success shape**: `result.ok === true &&
   result.value.data.path === 'fresh-root'` (a2x G2 contract, unchanged at
   3b4912a — remote handler verified during kit writing).
6. **Persona assertion**: substring of the unique persona token in the
   captured request's SYSTEM message(s) (concatenated) — robust to
   assembly. Tokens are stamp-unique (RC2SMK_B_LEADER_<stamp> etc.) so no
   cross-run false positives.

### Design refinements (recorded in the kit header too)

- **R1 — S1–S4 run as ONE continuous B-Leader turn.** The team.create's
  initialWork (marker MK_B) drives a scripted mock chain keyed on the
  tool-message count: read team → read runtime → bash (pauses at the
  durable control wait; the kit approves from outside; the turn resumes)
  → team_create_member(worker-b) → team_delegate → final text. The C team
  (S5) runs its own 3-step chain (create → delegate → final). Driving all
  permission legs from one turn maximizes the causal chain and removes any
  dependence on session/prompt to a created team root.
- **R2** — see item 3 (approval principal is determined, not trialled).
- **R3** — see item 2 (requestId discovery: observation feed primary,
  home-storage scan fallback, full diagnostic dump + leg failure if
  neither yields it — an infrastructure gap to report, never a silent
  pass).
- **R4 — the kit doubles as the A1 live-repro harness (plan §10):** run it
  against the INSTRUMENTED dist (the §9 probe commit) to capture
  canonicalization/contains observations + the S1/S2 verdicts; the A1
  branch decision (A/B/C) comes from those. Re-run post-fix for the
  RED→GREEN arc. Expected on the CURRENT tree (A6 in, A2/A1 pending):
  S3 green (A6), S1/S2 branch-dependent, S4/S5 RED (A2 pending).
- **S3c added:** the `guard-verdict` observation row
  (`{"stage":"guard-verdict","allowed":true,…}`) is asserted as the
  guard-level A6 proof alongside the tool-result evidence (S3b).
- **S1b/S2a tightened** to the actual observation-row JSON fields
  (`"stage":"decision","decision":"allow"|"deny"` + absence of
  `canonicalization-failed` / `containment-undeterminable` rows).
