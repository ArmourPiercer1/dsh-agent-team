# A2C-1 LIVE PROOF — pwsh parameter permission (plan §5.8 equivalent adaptation)

**Verdict: PASS — 5/5 legs, 42/42 assertions** (run of 2026-09-12 17:35:16→17:35:32 UTC,
nonce `a2c16d30b74f`, runner exit 0, clean process exit).

- L1 static deny: **PASS (6/6)**
- L2 ask→deny: **PASS (7/7)**
- L3 ask→allow_once + re-ask: **PASS (9/9)**
- L4 builtinToolDeny: **PASS (6/6)**
- L5a ask→allow (durable pre-stop): **PASS (4/4)**
- L5b cold resume: **PASS (10/10)**

No assertion was weakened, skipped, or retargeted. No test or source file was modified.
CORE PATCH BUDGET = 0 held: the production row, glue, and observability mount only through
the public profile-patch seam (`$HOME/profiles/web/cordis.patch.yml`).

## 1. World

- **DSH_HOME** (retained as evidence — contains per-boot launch tokens, **never commit**):
  `tests/homes/a2c1-live-20260912T162326Z/` (workspace-internal per TEST_METHODS §7)
  Contents retained: `.agent-presets/a2c1-pwsh/`, `work/{root,child}`, `profiles/web/`
  (cordis.yml + cordis.patch.yml), `sessions/**/session.jsonl.zstd`,
  `storages/team_domain.json` (durable ledger: 5 roots + L5 control rows 2/2/1),
  `p6t6-directive.json`.
- **Boot** (six boots, one per leg, all on 127.0.0.1:3183, each fully torn down before the
  next; L5b = fresh process, same home, directive `{boot:2, phase:'resume'}`):
  ```
  cd tests/deepseek-harness-test-use
  DSH_HOME=<home> DSH_CLIENT_COMMIT_HASH=a66e470204 DSH_PERMISSION_MODE=danger-full-access \
    node apps/cli/lib/bin.js web --port 3183 --no-open
  ```
  Success marker per boot: `dsh web: http://127.0.0.1:3183/?token=…`; verified 401 without
  token; 303 + set-cookie auth exchange. Boot log: `live-boot-20260912T162326Z.log`
  (contains BOTH attempts of the final run: attempt #1 17:33:29 nonce `a2c1e8af09ed` died at
  port preflight — see §7 run history — and attempt #2 17:35:16 nonce `a2c16d30b74f`, the
  evidenced run; six `dsh web:` markers, all attempt#1).
- **Host file-policy knob — `DSH_PERMISSION_MODE=danger-full-access` (documented deviation,
  see §6.1).** This host has no bubblewrap and no usable Landlock backend (verified live).
  Under the default `workspace-write` policy the executor refuses before spawn (run #8
  observation, exact text):
  `Error: sandbox mode "workspace-write" is requested but no sandbox backend is usable on
  this host; refusing to run the command unconfined. Install bubblewrap or run a
  Landlock-enforcing kernel (Linux), … otherwise switch the consumer to danger-full-access.`
  `DSH_PERMISSION_MODE` is the documented process fallback
  (`apps/cli/reference/README.md`: "DSH_PERMISSION_MODE changes the process fallback"; the
  harness's own e2e suite uses it exactly this way, e.g. `apps/cli/tests/built-bin.e2e.ts:501`,
  `packages/subagent/subagent-acp/tests/subagent-acp.e2e.ts:38`). It pins the fresh-session
  default permission preset to `danger-full-access` (sandbox mode needing no confinement), so
  an **allowed** body reaches spawn and fails on the missing pwsh binary exactly as the brief
  predicts on Linux. It does not touch the A2C-1 tool-permission layer (evaluated upstream,
  at the tool-call level) and is not asserted on.
- **Mock model** on 127.0.0.1:3497 (in-process, per-leg `decide`); request log per boot in
  `instances/boot<n>/mock-requests.json` (Bearer tokens redacted).
- **Port discipline**: 3183 (web) + 3497 (mock) only. 3181 (live GUI) and 3080 (stable)
  never bound, never touched — 3181 verified still live post-run, 3080 free.

## 2. Out-of-tree production build (parent-ruled "exactly right")

The committed `packages/runtime/dist` at HEAD predates the A2C-1 working-tree source (no
`pwsh` in `PERMISSION_TOOL_NAMES`, no pwsh lane rules, no pwsh handling in the
pre-execute adapter) and cannot even parse a blueprint carrying a pwsh permission rule. The
production row therefore points at an out-of-tree tsc build of the worktree source,
byte-equivalent to the canonical pipeline (`tsc -p packages/runtime/tsconfig.build.json` +
`place-dist-glue.mjs`) with only outDir redirected:

- Build: `dist-a2c1-build/` (this evidence dir) — emits contracts/domain/remote/runtime/
  storage/tools; build log `build.log`.
- Layout artifacts (idempotent `ensureDistLayout()`):
  `src/plugin/upstream-resolver.mjs` (symlink → worktree source; five-up candidate) and the
  frozen legacy reader mirrors (`dist/packages/legacy/` + `dist-a2c1-build/packages/legacy/`
  — byte copies of the committed frozen mirror; A2C-1 does not touch legacy).
- **Not committed** (parent ruling): the dist rebuild reconciles to the install surface at
  the INTEGRATION TIP by the main agent; staleness + the
  `check-artifacts-committed.mjs` / `pnpm build:composition` gate are recorded in the parent
  report as integration-tip procedure.
- Note: the p6t6 plugin's `import('../../runtime/dist/…')` resolves to the STALE canonical
  dist — acceptable (A2C-1 does not touch `mutation/`); the team row itself loads the fresh
  out-of-tree build.

## 3. Patch layer (public seam, the only mount point)

`$HOME/profiles/web/cordis.patch.yml` — three `- insert:` rows (full text in the home):

1. `dsh-agent-team` → `file://…/a2c1/dist-a2c1-build/packages/runtime/src/plugin/host.js`
   with config: `bootPhase: create-or-open`, `rootSessionId` (per leg), `blueprintSource`
   (the per-leg YAML, §4), `seedMembers: []`, `defaultWorkspace: <home>/work/root`,
   `generation: 1`, `staticModel: {provider: deepseek-official, model: a2c1-live-model}`,
   `memberPresetId: a2c1-pwsh`,
   `glueUrl: file://…/dist-a2c1-build/.../live/agent-bindings.mjs`,
   `seamUrl: file://…/.worktrees/a2c-1/packages/runtime/root-binding/harness/seam.mjs`.
2. `dsh-agent-team-client` → `file://…/packages/client/composition-shim/index.js`
3. `p6t6-team-tools` → `file://…/packages/tools/harness/plugin.mjs` (observability:
   `GET /__p6t6/health` (toolCount observed = 11, not pinned), `POST /__p6t6/tool`,
   `GET /__p6t6/state` (mock-captured request/tool tables)).

Directive per boot: `$HOME/p6t6-directive.json` =
`{boot, phase, reportDir, runStamp, rootSessionId, mcpPort: null}`.

## 4. Blueprints (per leg)

Template (emitted by `blueprintDoc`, runner L212): leader template `leader` (persona per
leg) + one member template `worker` (`displayName`/`persona` per leg, `capabilities` per
leg below) + `requirements: [{domain: tool, name: web, optional: true}]` +

```yaml
teamEnvelope:            # LEADER envelope (without it team_create_member fails closed)
  allow: [assign-task, create-member, send-message, report-progress,
          request-control, resolve-control, archive-member, restore-member]
  deny: [delete-team]
memberEnvelopes:         # WORKER envelope MUST carry request-control: the ask path's
  - templateId: worker     # controlService.requestControl is envelope-checked against the
    envelope:              # CALLING member; without it the ask fails closed and NO control
      allow: [request-control]   # row is created (run #5 finding, proven live-negative)
      deny: []
```

Worker `capabilities` per leg (`teamTools`/`skills`/`mcp` = allow-empty in all legs):

| Leg | `permissions` | `builtinToolDeny` |
|-----|---------------|-------------------|
| L1  | `{default: deny, ask: [], deny: [{tool: pwsh, resource: {kind: any}}]}` | `[]` |
| L2  | `{default: deny, ask: [{tool: pwsh, resource: {kind: any}}], deny: []}` | `[]` |
| L3  | same ask policy as L2 | `[]` |
| L4  | *absent* | `["pwsh"]` |
| L5a | same ask policy as L2 | `[]` |
| L5b | same ask policy as L5a (same blueprint id `a2c1-live-l5`) | `[]` |

## 5. Member preset (local, home-only)

`$HOME/.agent-presets/a2c1-pwsh/` — `preset.yml` (`name: A2C1 pwsh live`) +
`agent.cordis.yml` = the shipped `standard` preset
(`packages/preset/agent-presets/presets/standard/agent.cordis.yml`, read-only source) with
exactly one line removed (asserted by the regen script: exactly one gate line):

```diff
- id: tool-pwsh
  name: '@deepseek-ai/dsh-tool-pwsh'
-  disabled: !!js process.platform !== 'win32'
```

(+ a 3-line provenance header). Ungating is the only change so the pwsh tool mounts on this
Linux host; everything else byte-identical to the shipped preset.

## 6. Mock model (`makeDecide`, runner L623)

Per-request `decide` (all user messages joined, because the harness splices AGENTS.md +
runtime-context user messages AFTER the relayed body, and history accumulates markers):

1. any system message contains `Create a concise title` → text `A2C1_TITLE_<leg>`
   (the concurrent session-title call must NOT receive a tool call — run #4 finding).
2. last message role `tool` → text `A2C1_TOOL_RESULT_ACK_<leg>` (ends the turn).
3. user text contains `A2C1_PWSH3_<nonce>` / `A2C1_PWSH2_<nonce>` / `A2C1_PWSH_<nonce>`
   (newest-first precedence) → tool-call `pwsh` with callId
   `a2c1-<leg>-call-{c|b|a}` and args
   `{command: 'Get-ChildItem -Name', description: 'List directory names (A2C-1 live probe)',
   workdir: <home>/work/child}` (`description` required by the tool-pwsh argument schema —
   without it the BODY's argument validation rejects before spawn; run #7 finding).
4. default → text ack.

Leg drive: the root sends the member a body carrying the nonce marker
(`member.send` v1, caller kind `human`); L3 call 2 / L5b re-ask send a body with the
PWSH2/PWSH3 marker (fresh callId).

## 7. Observability design + live findings

- **`member.send` blocks across the suspended turn**: sync work mode `performAction`
  (runtime action-router) awaits the whole member chain (Phase B delivery + Phase C
  settlement persists the turn result) — the remote call does not return while the turn is
  suspended on an approval ask. Ask legs therefore fire the send as a floating promise
  (300 s), observe the ask in the durable ledger, resolve via
  `team.resolveControl` (v4, chain-independent human ingress), then await the send.
- **`/__p6t6/state` is blocked mid-send** (its `recoverPendingDeliveries` serializes behind
  the coordinator chain) — do not poll it while a send is in flight.
- **Durable control ledger** (`$HOME/storages/team_domain.json`, plain JSON, string-encoded
  rows under `tables.ledger.*`) is the observation path: the ControlService takes no team
  lock, so rows are observable mid-suspension. Row shapes:
  `control-request-recorded` payload
  `{actionName: 'parameter-permission', correlation: <callId>, kind: 'leader-approval',
  operationFingerprint: 'sha256:…', requestId: 'ctrl-…',
  requester: {instanceId, kind: 'instance', role: 'member'},
  summary: 'pwsh [cwd=<workdir>] <cmd>', targetInstanceId, toolName: 'pwsh'}`,
  schemaVersion 2; `control-decision-recorded`
  `{requestId, decision, decider, scope: {rootSessionId, targetInstanceId, actionName,
  correlation, toolName, operationFingerprint}, requestSequence}`; `control-allow-consumed`.
- **D6 kill→restart**: end-seed wait → stop → retry boot once on collision
  (`cannot prepare session … while it is live`); DSH SIGTERM shutdown is slow → 60 s
  `waitPortReleased` after every stop; runner has SIGTERM/SIGINT handlers (no orphans).

## 8. Per-leg results (all from run nonce `a2c16d30b74f`; full details in
`live-legs-20260912T162326Z.json`)

### L1 — static deny (boot#1, root a2c1-l1-root) — PASS 6/6
- worker turn completed (turn/end turn 1, reason completed).
- durable model-visible `pwsh` tool/call recorded (callId `a2c1-L1-call-a`, full args incl.
  `workdir`).
- tool result: `Error: permission denied by the static permission policy: the template's
  deny rule 0 denies pwsh on pwsh` — contains **`permission denied by the static permission
  policy`** and **`denies pwsh on`** (exact pinned strings).
- ZERO body executions (no spawn/ENOENT in the result — the body never ran).
- NO permission rows: `{requests: [], decisions: [], consumptions: []}` — a static deny
  never asks.

### L2 — ask→deny (boot#2, root a2c1-l2-root) — PASS 7/7
- durable request row created mid-suspension:
  `{actionName: 'parameter-permission', correlation: 'a2c1-L2-call-a',
  kind: 'leader-approval', operationFingerprint: 'sha256:f9556dc6…',
  requestId: 'ctrl-0nu5xv00dfyfrr0bj3g9i0pi',
  requester: {instanceId: 'inst-1qdzbib1o2e4', kind: 'instance', role: 'member'},
  toolName: 'pwsh', summary: 'pwsh [cwd=…/work/child] Get-ChildItem -Name'}`.
- requester = the suspended worker member instance (the ask originates from the worker
  turn, not the leader).
- resolved via `team.resolveControl` (decision `deny`, `decider: {kind: 'human',
  humanId: 'a2c1-l2-root'}`).
- worker turn completed after the resolution; tool result: `Error: the approval was denied`
  (**exact pinned string**); ZERO body executions (no spawn/ENOENT).
- durable ledger final: exactly 1 request + 1 decision (deny, decider human) + 0 consumptions.

### L3 — ask→allow_once + re-ask (boot#3, root a2c1-l3-root) — PASS 9/9
The permission-vs-body leg. call 1 = allow, call 2 (fresh callId, PWSH2 marker) = re-ask→deny.
- call 1: control request created (leader-approval, pwsh, correlation `a2c1-L3-call-a`).
- call 1: **BODY IS ATTEMPTED — body-level failure, NOT a permission denial**. Exact tool
  result:
  ```
  [stderr]
  bash: line 1: Get-ChildItem: command not found
  [exit code: 127]
  ```
  i.e. the allowed call reached the executor and failed at the binary stage
  (exit 127 = command not found — the brief's expected ENOENT/missing-binary class on
  Linux; body success = 0). `isError: false` on the tool-result wrapper (the executor
  reported a normal process exit of 127) — the failure is unambiguously body-layer.
- call 1: permission allow = 1 (one decision row, allow) and **EXACTLY ONE dispatch
  authorized** (one `control-allow-consumed` row for request 1).
- call 2 (fresh callId `a2c1-L3-call-b`): a NEW control request row is created — live
  re-ask (no static shell allow; the consumed once-allow did not persist as a standing
  permission); resolved deny → result `Error: the approval was denied`; body NOT executed
  (no second ENOENT-class failure).
- final durable state: 2 requests / 2 decisions (allow, deny) / 1 consumption (call 1 only).

**Live-semantics note**: a *fresh* callId re-asks (proven above, unit G4c). The *same*-callId
allow-consumed retry is unit-pinned (G4b: an allow is consumed once per request) but is
unreachable through the live agent loop — each model turn mints a new callId, so the
observable live behavior is always "new call → new ask".

### L4 — builtinToolDeny (boot#4, root a2c1-l4-root) — PASS 6/6
- worker tool table (mock-captured `req.tools` via p6t6): **`pwsh` ABSENT** (26 tools listed,
  no pwsh), while sibling **`bash` present** — the hide is targeted, not blanket.
- the scripted model still TRIED pwsh (tool/call recorded in the durable log) — the hide is
  at the surface, not the model.
- tool result: `Error: unknown tool "pwsh"` — ZERO body executions (executor never reached).
- ZERO permission rows — the tool never reaches the permission layer.

### L5a — ask→allow, durable pre-stop (boot#5, root a2c1-l5-root) — PASS 4/4
- control request created (leader-approval, pwsh, correlation `a2c1-L5a-call-a`),
  resolved allow, worker turn completed.
- body attempted (same `[exit code: 127]` command-not-found signature) — permission verdict
  was allow.
- durable rows present BEFORE the process stop: 1 request / 1 decision allow / 1
  consumption (`ctrl-0cm9mw30tj59rq081ukt91vg`).
- then hard process stop (SIGTERM) — no clean shutdown — to set up the cold resume.

### L5b — COLD RESUME (boot#6, fresh process, same home, directive `{boot: 2, phase: 'resume'}`) — PASS 10/10
- teamSession durable row reopens with the SAME team identity:
  `{rootSessionId: 'a2c1-l5-root', blueprintId: 'a2c1-live-l5', revision: '1',
  contentHash: 'sha256:e0afd298b8…'}` — contentHash UNCHANGED since L5a (the stamped domain
  was adopted, not re-created).
- prior permission rows persist across the process restart (the L5a
  1 request / 1 decision allow / 1 consumption).
- member row persists and is IDENTICAL to L5a (same `instanceId`
  `inst-04fs89a1n9ib` + same `childSessionId` `session-team-child-121ba700…` — no duplicate
  member rows).
- `team.listRoots` sees all five leg roots:
  `["a2c1-l1-root","a2c1-l2-root","a2c1-l3-root","a2c1-l4-root","a2c1-l5-root"]`.
- a fresh pwsh call on the RE-OPENED original worker (PWSH3 marker, callId
  `a2c1-L5b-call-c`) RE-ASKS (policy re-enforced after restart; the L5a allow does not cover
  a new call) → new request row → resolved deny → result `Error: the approval was denied`,
  no body execution.
- final durable state: 2 requests / 2 decisions (allow, deny) / 1 consumption.

## 9. Post-state

- **test-use byte-clean**: `tests/deepseek-harness-test-use` — HEAD
  `a66e4702047846cdaa10c66c9d3df3951f5ea70d` (0.1.2-rc.1 baseline, unchanged),
  `git status --porcelain` = EMPTY (verified 17:36 UTC, post-run). Pre-state recorded in
  `live-testuse-pre-state.txt`.
- **worktree** (`.worktrees/a2c-1`, HEAD `99bc790`): identical to its pre-live-proof state
  — the 9 modified tracked files + `a2c1-pwsh-permission.test.ts` + `a3-permission-resolver
  .test.ts` (A2C-1 feature working tree; the a3 vocabulary pin 6→7 names incl. `pwsh`, mtime
  16:11:36, predates all live-proof runs) + `.tmp-t12a-b2-home/` were present before this
  activity (pre-state: `pre-stash-status.txt`; note the a3 file's mtime postdates that
  snapshot by ~90 s — it is feature work, not live-proof work; live-proof writes were
  confined to this evidence dir, the home, and transient mock state). No git commits made.
- **Teardown verified** (post-run): no runner/instance processes; ports 3183, 3497, 3080
  ECONNREFUSED (free); 3181 (live GUI) still live — never bound by this run.

## 10. Evidence index (this directory)

| File | Content |
|------|---------|
| `live-proof.md` | this document |
| `a2c1-live-runner.mjs` | the reproducible kit (world rebuild + six boots + all assertions; `node a2c1-live-runner.mjs`) |
| `live-boot-20260912T162326Z.log` | both final-run attempts; per-boot markers/tokens (evidence-only) |
| `live-legs-20260912T162326Z.json` | all 42 assertions + per-leg evidence (tool results, rows, tool tables, identities) |
| `live-run-console.log` | runner console for the final run (attempts #1 preflight-dead + #2 full) |
| `live-proof-run-state.json` | full runner state (boots, legs, diagnostics) |
| `instances/boot1..boot6/` | per-boot instance logs, dump-config, mock-requests.json (redacted), state snapshots |
| `dist-a2c1-build/`, `build.log`, `src/plugin/upstream-resolver.mjs` | out-of-tree production build (+ layout artifacts) |
| `green-run.log` | unit coverage basis: 28/28 `packages/runtime/test/a2c1-pwsh-permission.test.ts` |

## 11. Run history (iteration record)

Runs #1–#8 (earlier spans) converged the kit; each fix was a *test-fixture* or
*runner-observation* correction — never an assertion change:

- #4: mock answered the concurrent session-title call with a tool call; marker matched only
  the last user message (the harness splices reminders after the relayed body). Fixed the
  mock's decision precedence.
- #5: turn-end detection read the wrong JSON field (turn number lives in `data.turn`);
  L2's ask never materialized — worker envelope lacked `request-control` (envelope fails
  closed, no row). Fixed runner detection + blueprint `memberEnvelopes`.
- #6: `member.send` hung (it awaits the suspended turn) and `/__p6t6/state` blocked.
  Switched to fire-and-forget send + durable-ledger observation + chain-independent
  `team.resolveControl`.
- #7: tool-pwsh argument schema requires `description` (body-side validation); callId
  mismatch in L5a/L5b (leg-key based ids). Fixed mock args + ids.
- #8: all legs except the L3/L5a body signature — under the default `workspace-write` file
  policy the body failed at the sandbox stage (no bwrap/Landlock on this host), before
  spawn. Resolved for the final run via the documented `DSH_PERMISSION_MODE` knob (§6.1) —
  an environment choice, not an assertion change; the brief's semantic
  ("permission verdict = allow; body success = 0 on Linux") holds in both observations, and
  the final run also produces the brief's predicted binary-missing signature.
- #9 attempt #1 (nonce `a2c1e8af09ed`): preflight FATAL — a run #8 runner ORPHAN (the L5b
  mock server was never closed by teardown, keeping the process alive and holding mock port
  3497) still listened. Killed the orphan (its dsh instances were already stopped);
  runner fixed (teardown closes the last leg's mock + explicit clean exit).
- #9 attempt #2 (nonce `a2c16d30b74f`, 17:35:16→17:35:32): **5/5 PASS, 42/42, exit 0,
  clean exit** — the evidenced run.
