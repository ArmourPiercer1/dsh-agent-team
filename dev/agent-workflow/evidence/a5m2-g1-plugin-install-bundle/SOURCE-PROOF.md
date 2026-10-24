# install_bundle — REAL public-chain source proof + minimal verification plan
A5M2-G1-WIRE lane · record 52 plugin_manager · B-PLUGIN · prepared for the CENTER consolidated card
(root ruling 2026-10-25: 历史 G1 pure-only FORBIDDEN_ARMS 不代表全工具永久禁止，暂不盲删安全校验；
只治理 Agent 安装行为；不新增约束任意初始化代码；不削 M0 IO/审批。本文 = 源证, 零施工, 零新 mock.)

Baseline facts: host pin `tests/deepseek-harness-test-use @ 639ed015397290b3745d163aafe02ffee4aa3f84`
(0.2.0-rc.2, read-only, porcelain clean at read). Lane tip d0810c0877b157eac65f45bb4e5538fc1474d26e.
No Host, no install, no new dependency this round.

## 1. The REAL public chain (every hop is a public surface — CORE PATCH BUDGET 0 compatible)

1. **Tool face** — `packages/boot/plugin-manager/src/tools.ts:20-41`: register via `ctx.tools.register(defineTool(...))`;
   closed 8-action enum `:41`; the row's install parameters (`target`, `enabled?`, `approvedBuilds?`, `registry?`) `:42-50`.
2. **Host gate FIRST** — `tools.ts:38-44`: `policy = ctx.sandboxPolicy.resolve(exec.agent === undefined ? {} : { session })`
   then `await approveEscalation({requestedMode:'danger-full-access', effectiveMode: policy.mode, subject:'plugin management operation',
   justification: 'plugin_manager <json args>. …'}, { approver: ctx.get('approval'), agent: exec.agent, callId: exec.callId,
   toolName: 'plugin_manager', signal: exec.signal })` then `exec.signal.throwIfAborted()`. Every non-grant throws BEFORE the manager.
3. **The adjudicator is a PUBLIC function export** — `packages/sandbox/sandbox/src/index.ts:15` re-exports
   `approveEscalation` (body `src/escalation.ts:171-206`): same-mode returns without approval (`:173`);
   non-strictly-wider target throws (`:177-179`); missing approver (`:180-182`) / missing agent (`:183-185`) throw;
   `approver.request({agent, toolName, callId, reason, displayReason{en,zh}, signal?})` `:188-199`; outcome law
   `allowed-once → mode`, `rejected/cancelled/unavailable → THROW` `:200-206`. Package name
   `@deepseek-ai/dsh-sandbox` (`packages/sandbox/sandbox/package.json:2`) = same published generation the lane
   already depends on (0.2.0-rc.2 set, `packages/runtime/package.json:19-28`).
4. **The manager is a PUBLIC global-store SERVICE** — token `pluginManager`: interface augmentation
   `packages/boot/plugin-manager/src/index.ts:171` (`pluginManager: PluginManager`), service registration
   `:206` (`super(ctx, 'pluginManager')`); the tool reads `ctx.pluginManager` (`tools.ts:45`); the header
   (`tools.ts:1`) states Web controls use the SAME service — one ledger, one manager.
5. **Install lifecycle contract — all `@Remote`** (same file): `installBundle(spec, options?)` `:461-462` with
   **CALLER-supplied** `options.requestId` (`InstallBundleOptions.requestId`, `types.ts:144`; registration into
   the owner's `installs` map `:463-466`; phase announcements emit `plugin-manager/install-state` `:467-469`
   — settle is OBSERVED BY A LISTENER, never fabricated); invalid spec throws `ManagementFailure('invalid-spec')` `:470`;
   abort discipline `stopped()` `:464/:471`. `waitForInstall(requestId)` `:574-577` — settled installs are deleted,
   "null establishes neither success nor cancellation". `cancelInstall(requestId)` `:584-585` — AWAITED, returns
   `PluginInstallCancellation` = `cancelled | too-late | not-running` (types `:208-210`).
6. **The approver channel is a PUBLIC service** — token `approval`: surface declared by
   `packages/interaction/user-approval/src/index.ts:26` (`approval: ApprovalService`); `request(...)` answers the
   closed `ApprovalOutcome` enum the adjudicator switches over. The governed row NEVER holds the approver itself —
   it rides the same `ctx.get('approval')` the tool face uses.

## 2. Consumer chain (who already touches this service — the row must not fork it)
- The agent tool (tools.ts, this lane's record 52 native) and the Web controls share ONE PluginManager instance
  (`tools.ts:1` header + one service registration `index.ts:206`). There is no second install entry to police:
  governing the AGENT install path (tool row) leaves Web controls on their own existing approval UI untouched —
  exactly the user ruling "只治理 Agent 安装行为".

## 3. Seam list (what the future card needs; every item public, none built here)
| seam | public source | lane precedent (our tree) |
| --- | --- | --- |
| `deps.pluginManager = () => ctx.get('pluginManager')` | global-store token, `index.ts:171/:206` | `host.ts:3048-3052` (`terminals`/`subprocess` lazy call-time reads, honest-absence try/catch) |
| `deps.pluginApproval = () => ctx.get('approval')` | `user-approval/src/index.ts:26` | same lazy pattern (`:3048`) |
| `deps.sandboxPolicy` | already injected | `host.ts:3055` (`ctx.sandboxPolicy` property) |
| `approveEscalation` import | `@deepseek-ai/dsh-sandbox` public export (`src/index.ts:15`) | dependency-addition = pnpm-lock touch → CARD DECISION (this round: not done) |
| installFace bag `{ installBundle, waitForInstall, cancelInstall }` | the LIVE manager methods above (all `@Remote`) | adapter already re-verifies identity drift: `g1-surface-adapters.mjs:1070-1073` (installFace moved → DEFINITION_DRIFT, zero re-run) and `:1074-1077` (adjudicator moved → DEFINITION_DRIFT) |
| wiring arm acceptance | `g1-query-wiring.mjs:122/:247` `FORBIDDEN_ARMS` | root: 不盲删 — pure-query world keeps the refusal byte-intact; card decides the exact armed-B-PLUGIN-subset acceptance shape |

## 4. Governance boundary (user ruling, verbatim semantics)
- **只治理 Agent 安装行为**: the governed entry is the agent tool row; the native's own gate chain (tools.ts:38-44)
  stays FIRST inside the captured native for the tool path; the adapter L5 direct-manager path re-runs the SAME
  exported adjudicator with the SAME ingredients before touching the manager — Team PA adds an approval FLOOR,
  never replaces it (already law: adapter L5 edge head `:1059` onward, obligation `host-approval-escalation-channel` (classify-side `:553`)).
- **不新增约束任意初始化代码**: nothing here gates plugin STARTUP/activation code — the row governs the
  `plugin_manager` TOOL's install action only; M0 IO/approval surfaces untouched (no read/list lane is narrowed;
  exemptions lane stays a separate action+target).

## 5. Minimal verification plan (for the consolidated card — the SMALLEST real set, no mock repetition)
1. **Dark world** (no seams): armed=false → zero placement (already source-pinned; do NOT re-mock).
2. **Armed live Host** (tests/deepseek-harness-test-use runtime, DSH_HOME in-workspace, 3180 family):
   ONE `install_bundle` call of a LOCAL-PATH bundle (relative spec — no registry egress needed): user approves via
   the REAL approval channel once → row mints its OWN `g1-install-<uuid>` requestId (adapter `:1122`), enters
   `installBundle(spec, { requestId })`, settle observed by listener, activation honest.
3. **Denial leg**: reject the escalation → the adjudicator's throw passes through verbatim; assert manager
   `installBundle` call count 0 (a real install spy via the profile package.json NOT changing is the end witness).
4. **Cancel leg**: `cancelInstall(requestId)` awaited → `not-running`/`too-late` shape (never a fabricated receipt).
5. **Non-install actions unaffected**: one list_plugins + one set_plugin round-trip on the same armed plane.
Every assertion = raw RC + log path; tier stays 接线未测 until this plan has actually run on Host.

## 6. Status accuracy (准确未测)
- 7 actions (3×list, set_plugin, set_bundle, remove_bundle, set_version_exemption): 接线未测 — wired through the
  closed table/registration path, zero live-Host evidence. NEVER call this 已测试.
- install_bundle: TARGET pairing complete; ENTRY mount NOT supplied (L5 refuses fail-closed, zero manager entry).
  The only new knowledge this round is the public-chain proof above; NO behavior change.
