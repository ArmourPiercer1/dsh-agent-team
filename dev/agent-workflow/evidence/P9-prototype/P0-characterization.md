# P9 Prototype — P0 Characterization & Correction State Record

- **Date**: 2026-09-02 (+08:00). Author: main agent (orchestrator).
- **Authority order (current)**: user correction (2026-09-02, received this session) > user launch prompt (2026-09-02 17:39) > `dev/agent-workflow/evidence/P8-S/backend-contract-freeze.md` (sole backend contract authority) > frozen Architecture/UI design docs > source/tests > history. Launch-prompt parts conflicting with the correction are VOID.
- **Program posture**: controlled, time-boxed, disposable prototype. No new plan Markdown, no re-planning; the launch prompt + correction are the plan.

## §0 — Correction-time state record (mandatory)
Recorded at correction intake (~17:58):

| Item | Value |
|---|---|
| Prototype worktree | `.worktrees/P9P`, branch `task/P9-proto-real-backend`, HEAD `7d07330cca7bb3df416e3a82359d4307d9ab4a64`, **clean** (0 dirty) |
| Master | `8000edeabff2495a6a18baf56bb92d3f31dd683d`, **clean** |
| UI worktree (created post-correction) | `.worktrees/P9P-UI`, branch `task/P9-proto-ui`, HEAD `7d07330...`, clean; `pnpm install --ignore-scripts` running (worker A step 0) |
| Changed files | **none** tracked in any worktree (P0 was read-only recon; only untracked artifacts = gitignored: `references/proto-workspace/` marker + `references/.p9proto-baseline-fresh.log`) |
| Current phase | P0 (freeze/characterization) **COMPLETE** → entering corrected P1 (mode plumbing + real bootstrap + real child creation) |
| Completed gates | Baseline fresh chain re-verified at `7d07330`: **2091/2091, rc=0, 58903 ms** (`references/.p9proto-baseline-fresh.log`). F1/F2 **pending**. T+3:00 execution gate **pending**. |
| Checkpoint | not needed (no uncommitted work) |

## Clock (hard, +08:00, no restart per correction)
| Event | Wall time |
|---|---|
| T+0 (launch) | 2026-09-02 17:39:03 |
| **T+3:00 execution gate** (corrected: real Team + honest v2 Leader + 1 ActivationProvider Member + 1 real DSH child Agent + cwd=proto-workspace) | **2026-09-02 20:39:03** |
| PROTO_CORE_FAIL line (if RED past 30-min rescue) | 2026-09-02 21:09:03 |
| **T+10 HARD FREEZE** | **2026-09-03 03:39:03** |

## Corrected PASS-core (authoritative)
Real bootstrap (no fixture seed; `bindFreshTeamRoot` → honest v2 LeaderInstance) + one real member via existing TeamRuntime → ActivationProvider → provisioning coordinator → real child Agent/Session → durability barrier → MemberInstance commit + child cwd = prototype workspace + **persona model-visible** + **one real work/model turn** (canonical task: read workspace-root `package.json`, return name `proto-workspace-marker`; reading repo/DSH_HOME package = E2E FAIL) + Team projection/activity/result observable + **F1 green**. "Projection renders + one Remote command accepted" alone is **NOT** PASS-core.
**PASS-full** = PASS-core + restart/resume + bounded negatives. Restart failure may be recorded as `PASS-core + RESTART_GAP`.
Final output (exactly one): `PASS-full | PASS-core | PROTOTYPE_FUNCTIONAL_BUT_REGRESSION | FAIL-core`.

## P0 findings — remote wire contract (frozen, byte-level verified against freeze doc + source)
- Endpoint: `POST /team-remote/<method>`, `Content-Type: application/json` (415 otherwise; 401 without cookie).
- Request (CLOSED envelope — unknown top-level field → malformed-request): `{type:'client-request', rpcId, method, payload:{version:1, params:{...}}}`.
- Auth cookie `dsh-auth-*` minted by GET launch URL (302/303 Set-Cookie).
- Success: `{ok:true, value:{data, provenance:{origin:'team-remote', method, endpoint, contractVersion, requestToken, projectionGeneration, effectSequence}}}`.
- Failure: `{ok:false, error:{code, message, details:{method, endpoint, contractVersion, requestToken, field?, reason?, cause?}}}`.
- `REMOTE_CONTRACT_VERSION=1`, supported `[1]`.
- **Whitelist (item-by-item verified)**: 10 queries — `catalog.list`, `catalog.get`, `intent.probe`, `team.getProjection`, `team.getLedgerPage`, `override.get`, `policyState.get`, `compatibility.get`, `handoff.prepare`, `legacy.inspect`. 13 commands — `team.create` (+additive optional `initialWork`), `member.create`, `member.send` (**canonical work command**, freeze L85), `member.followup`, `member.archive`, `member.restore`, `member.dispose`, `override.set`, `override.reset`, `policyState.set`, `compatibility.ack`, `compatibility.reprobe`, `handoff.create` (idempotent by `(sourceSessionId, requestToken)`). 11 `TEAM_REMOTE_*` error codes.
- Dispatcher invariants (s6-remote.ts L1605-1648): unknown endpoint before envelope, closed envelope, per-method param schema, typed-error pass-through, untyped throw → internal-error, lossless JSON, promise never rejects.

## P0 findings — seam facts (recon + targeted reads; all paths verified at `7d07330`)
1. **Live wiring gap (THE gap)**: production `host.ts` never invokes `registration(connection)`. DSH public service `connection` exists (`HostConnectionService`, `super(ctx,'connection')`, `connection.rpc.handle(channel, handler)`; registrations belong to caller fiber) — test-use `packages/client/connection/src/rpc-host.ts:59-85`. Fix = optional `ctx.get('connection')` + fiber effect in OUR `host.ts` (zero semantic change; all p8s6 tests use stub connections → 2091 unaffected). [R-PROTO-1]
2. **Client delivery (runtime, no DSH rebuild)**: client package needs `exports["./client"]` + **NESTED** `"dsh":{"client":{"platform":"web"}}` (flat form silently ignored — L6-4 quirk); registry serves the PRE-BUILT artifact at the exports target (convention `lib/client.js`); boot graph `window.__DSH_BOOT__` re-collected per page render; bundle route `GET /plugins/<entry-id>/client.js` (200+body / 444-unknown→404); activated plugin fibers flush module graph immediately; without dev-web, rebuilt bundle visible on next page refresh. Row mounting = `<DSH_HOME>/profiles/web/cordis.patch.yml` via `mountRows` (client package needs its OWN row — P2-T6 probe pattern). [R-PROTO-2/6]
3. **Module table (factory `require` ids)**: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`. Bundle = CJS-style `window.__ModuleLoader__.load({id, factory:(require)=>{...}})` (proven template: `tests/characterization/probes/remote-client/plugins/p2t6-client-probe/client.js`). [R-PROTO-2]
4. **Slots**: Team tab → `conversation.view` (list/session, under `conversation.session` under `conversation`); other seats `sidebar.footer.action`, `conversation.input.dock`; `ctx.slots.register({name,children?,store?,inject?},Component)`; into another package's declared slot: `ctx.slots.inject(name, () => ctx.slots.register(...))`; SlotCore = `@deepseek-ai/dsh-client-ui-slots`.
5. **Workspace/cwd (R2)**: exactly one knob — `agents.create({sessionId, meta:{cwd:<ABSOLUTE>}, setup})`; session header cwd validated absolute (test-use `packages/core/session/src/index.ts:807-828,112-115,879`); sandbox workspace root = session cwd else config.workspaceRoot ?? process.cwd() (`packages/sandbox/sandbox-policy/src/index.ts:135-141,110`); read-back: `sessionQuery.readSession(sid)` → `header.cwd` OR durable `<DSH_HOME>/sessions/<profile>/<sid>/session.jsonl.zstd` (multi-frame zstd; decompressor pattern run.mjs:1038-1082). **Current glue HARDCODES `meta:{cwd: process.env.DSH_HOME}`** (`agent-bindings.mjs:436-440` child, `:482-487` root) → correction R2 = additive row-config knob, default unchanged.
6. **Pure push/sync engine** (importable, no I/O): `packages/remote/src/push/index.ts` — `decideFrameVerdict` (apply|duplicate|stale|foreign), `isStrictlyNewerGeneration`, `assessProjectionSync`, `extractPushFrame`, `PULL_PROJECTION_ENDPOINT='team.getProjection'`, `createLedgerPageTracker(afterSequence=0)`, `verifyLedgerPageAnchor`, backoff (`pickBackoffDelayMs`, `stateOnConnect/stateOnLoss`, `defaultDelayPicker`).
7. **Browser driving (P6)**: Playwright `^1.49.0` resolvable at test-use `apps/web/node_modules/playwright`; NO ms-playwright browser cache; system Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe` → `chromium.launch({channel:'chrome'})`; DSH e2e idiom = `page.goto(authenticatedUrl)` + locators; harness instances are SPAWNED → seeding/assertion via HTTP (`/__p6t6/*`, `/team-remote`) + DSH_HOME files. HTTP mount proof (no browser): `GET /` contains `__DSH_BOOT__` graph listing our entry id; `GET /plugins/<id>/client.js` 200 + marker. [R-PROTO-3]
8. **Test chain (unchanged)**: `pnpm install --ignore-scripts` → `node scripts/run-tests.mjs [pkg]` (plain-node, native TS type-stripping; vitest shim matchers ONLY `toBe/toEqual/toBeGreaterThan/toThrow`+`.not`; node env, NO jsdom; scans `packages/<pkg>/test/*.test.ts`; exit 0/1/2; full ≈ 59 s) → tsc SEPARATE args (8-set: client, contracts, domain, remote, runtime, storage, testkit, tools; NO `node:` imports in .ts; NodeNext + verbatimModuleSyntax `.js` ext; base ES2022, **no DOM/JSX** → client UI needs a build-face tsconfig addition in our repo). Dist recipe: wipe `packages\runtime\dist` + ensure junction `packages\runtime\node_modules\yaml` → `tsc -p packages/legacy/tsconfig.build.json` → `tsc -p packages/runtime/tsconfig.build.json` → `mklink /J` yaml junction. Live 17: `node packages/tools/harness/run.mjs --scenarios E1..M5 (17) --port 3181 --report-dir <dir> --dsh-home <name> --dsh-home-e <name-e>` (fresh homes under `references/`, ports 3181–3186 + mini-MCP 3491–3495, preflight :3080=200, 104/104 assertions).
9. **Harness row config**: production row L284-318 (`blueprintSource`, static model `p6t6-static/p6t6-model-v1`, `glueUrl→packages/runtime/src/plugin/live/agent-bindings.mjs`, `seamUrl`, mini-MCP ports, `ROOT_SESSION_ID` L301, `DEFAULT_WORKSPACE` L269); `DshInstance` (tests/characterization/lib/instance.mjs L70-77 spawn, L152-157 dump-config, L170-187 `mountRows`); observability row `p6t6-team-tools` (plugin.mjs: `/__p6t6/health` L286, `/__p6t6/tool` L303, `/__p6t6/state` L375, governance L525, residency L627).
10. **Bootstrap map**: `root.ts` — boot create-phase = `seedBootWorld()` L1327+ (seed + live boot; this is the FIXTURE world) vs `bindFreshTeamRoot` (real authority, used by handoff wiring L937-1016, `bindFresh` L1003); A32 principal L1265-1271; projection v2 stamp L1258-1262; remote surfaces L1277-1310; `seams.remoteHandlerRegistration.install` L1312. `host.ts` — name L294, inject L306, `validateTeamPluginConfig` L176, `apply` L320, storage seam L363-373, sessionQuery L464, `teamRoot` facade L486-515, disposer L521-529. `agent-bindings.mjs` — child create L436-440 (R1 childSid derivation just above; R2 hardcoded cwd), resume L429-434, root L482-487, `agentSetup` L328-359 (R4 mcp), 24-key `TeamAgentBindings`.
11. **No existing P9 Team UI**: `packages/client` = empty P1-T4 Cordis client skeleton (empty `apply`, 3 node tests). Legacy fork `references/deepseek-harness/packages/client/ui-team` = evidence only. Launch prompt's "existing P9 Team UI" maps to: skeleton + frozen UI design (Team tab = `conversation.view`; dynamic dsh.client; extension surfaces L48-58/L2302/L2343/L2347 — master-only paths).

## Rulings (correction-adjusted; R-PROTO-4 superseded)
- **R-PROTO-1**: `connection` binding effect in `host.ts` (optional `ctx.get('connection')` + fiber effect) — IN SCOPE, zero semantic change.
- **R-PROTO-2**: client delivery = `exports["./client"]` + nested `dsh.client` + pre-built bundle; TS src stays typed reference; build via test-use esbuild binary allowed, hand-written ModuleLoader JS preferred/acceptable.
- **R-PROTO-3**: Playwright + system Chrome (`channel:'chrome'`) drives the P6 page.
- **R-PROTO-4**: SUPERSEDED by correction vertical slice (original UI-first P1 ordering void; UI retained as parallel component).
- **R-PROTO-5**: fixture world = frozen 2091 chain + tsc 8/8 + live 17. Retained. F1/F2 unchanged; real world additive only; never green by editing frozen fixture expectations.
- **R-PROTO-6**: bundle strategy — detail of R-PROTO-2 (superseded-as-separate).
- **R-PROTO-7**: UI mode/team-id via explicit page launch params `?teamMode=real&teamSessionId=<sid>` (documented prototype mechanism; host-bridge binding = P9-production carry-over).
- **R-PROTO-8**: `workspaceCwd` row-config knob NOW MANDATORY (correction R2); default unset = today's behavior (byte-identical fixture path).
- **R-PROTO-9**: SUPERSEDED by R-PROTO-10 (original "deterministic local provider in test DSH_HOME" replaced).
- **R-PROTO-10** (NEW, ruled 2026-09-02 ~18:05): **real model request** for the canonical E2E = real cloud model `qiyuan-self/qwen3.8-27b` (openai-completions, `http://58.57.119.30:52010/v1`), wired into a FRESH test DSH_HOME by mirroring the stable home's provider block + `QIYUAN_SELF_API_KEY` credential ref (read-only copy from `C:\Users\user\.dsh`; stable home/instance NEVER modified). Endpoint verified LIVE this session: `/v1/models` 200 + chat completion 200 ("PONG" from qwen3.6-35b-a3b; qwen3.8-27b = tool-capable, the model serving this session). Scope of the "real" claim: real network model request, real agent loop, real workspace observation; disposable test instance. Zero upstream change.
- **R-PROTO-11** (NEW): remote safety boundary — core command surface for the prototype = minimal frozen subset for real work (team.create, member.create, member.send, team.getProjection, team.getLedgerPage, catalog.*, intent.probe, override/policy/compatibility GETS read-only); dangerous mutations (override/policy/compatibility SETs, lifecycle archive/restore/dispose, handoff.create, fork) NOT exercised in the prototype core path (available on the wire but untested-out-of-scope).

## Corrected P1 = dispatch plan
| Worker | Scope (owned files) | Worktree | Dispatched |
|---|---|---|---|
| **X** (critical path, T+3:00 gate) | `executionWorld` mode plumbing (row config → validate → root bootstrap → glue); real create via `bindFreshTeamRoot` (no seed fakes); real member via existing activation chain; R1 pair-safe child identity (real mode; fixture byte-identical); R2 `workspaceCwd` → `meta.cwd`; R3 configured external hard-policy facts; R4 `mcpServer===null` guard; `connection` registration fiber effect (R-PROTO-1); node unit tests; real-slice live driver (`packages/tools/harness/proto-real-slice.mjs`) proving the gate | `.worktrees/P9P` | subagent `7375bcbf-4baa-405f-8a0f-8e7331b4f39f` (~18:10) |
| **A** (UI half, retained per §8) | `packages/client/**` only: `TeamDataProvider` seam + fixture adapter (frozen byte-stable DTOs) + real remote adapter (frozen wire contract + generation-invalidation pull via pure sync engine) + Team-tab UI (React, conversation.view slot) + Cordis client plugin (non-empty apply, `?teamMode=real&teamSessionId=` launch params, R-PROTO-7) + bundle deliverable (exports["./client"] + nested dsh.client + ModuleLoader JS) + package.json/tsconfig plumbing | `.worktrees/P9P-UI` | subagent `18c8638d-cf74-4857-9cf4-3990ae4c3b73` (~18:10) |
| **Y** (R5 persona, 45-min hard cap) | READ-ONLY research of DSH public AgentSetup/scoped-prompt seam (test-use) + work-chain prompt boundary (P9P); verdict SEAM_FOUND (wiring spec + diff proposal) or FALLBACK_REQUIRED (`PROTOTYPE_PERSONA_FALLBACK` format at Team-owned model-visible work-delivery boundary, explicitly marked); report → `evidence/P9-prototype/persona-research.md`; NO code writes | none (read-only) | subagent `f1a9e650-41b1-4dd4-931e-d9e1a973e5e5` (~18:10) |
| **D** (E2E, later) | canonical real E2E (workspace-marker task, one real model turn, persona assertion, projection/activity/result observability, UI mount proof via Playwright per R-PROTO-3), F2 freeze gate, restart/resume (PASS-full), bounded negatives | P9P after X | not yet dispatched |

## Gates & sequence (corrected)
1. **T+3:00 execution gate** (20:39:03) — worker X driver: real Team + honest v2 Leader + 1 ActivationProvider Member + 1 real child Agent + cwd=proto-workspace. RED → ≤30 min narrow rescue → PROTO_CORE_FAIL at 21:09 (then only reproducer/execution graph/root cause/result until freeze).
2. **F1** (after real-execution P1 = X + A merged, Y persona integrated): fresh chain (2091+additive, 0 fail) + dist chain + tsc 8/8 + live 17/17 (fixture world byte-identical proof) + zero-core + pin check.
3. **Canonical E2E** (worker D): real Agent executes "read workspace-root package.json, return name"; must observe `proto-workspace-marker`; repo/DSH_HOME package read = E2E FAIL. + persona model-visible assertion (durable session log) + projection/activity/result observable (+ UI live render per R-PROTO-3).
4. **PASS-full attempt**: restart/resume + bounded negatives (failure may be recorded `PASS-core + RESTART_GAP`).
5. **F2** (pre-freeze): same as F1 on the final tree.
6. **T+10 hard stop** 03:39 — final output exactly one of `PASS-full | PASS-core | PROTOTYPE_FUNCTIONAL_BUT_REGRESSION | FAIL-core`.

## Constraints carried (active redlines)
Zero upstream edits / no patch-package / no Team SessionEvent authority / no UI→TeamDomain|TeamRuntime direct access / no client-side policy|compat|lifecycle recomputation / no new backend semantics for UI gaps (record `UI_BACKEND_GAP`, continue) / upstream blocker = `CORE_SEAM_BLOCKER` (stop, never patch) / no new member-creation authority / no seed fakes in real mode / fixture world byte-identical / real world additive only / no push / ports 3181-3186 + 3491-3495 (serialize per worktree) / :3080 + `D:\deepseek-harness\` sacrosanct / test-use READ-ONLY.

## Attempt ledger (prototype)
- P0 recon: 1/3 (main agent direct + 1 recon subagent, both delivered; recon subagent stopped after delivery).
- P1-X / P1-A / P1-Y: dispatched ~18:10, in flight.
