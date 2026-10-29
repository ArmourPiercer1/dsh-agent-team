# CENTER-MAP — U6 preparation: the center assembly today, section by section

Read-only preparation for work package **U6 (center assembly rewrite)**, per
`docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md` §2-U6 and the target
architecture `origin/task/alpha5-reset-architecture-five-stage-20261025:docs/plans/memo/alpha5-reset-20261025/center-assembly-architecture.md`
(§3 components, §4 contribution boundaries, §5 state machine, §7 migration, §8 ARC-A..D, §10 fitness).
Repo root = `origin/master @ f7fbc0f67`. Prepared 2026-10-25. No product file was touched.

**Category key** (target components §3):
- **ADAPTER** = HostSurfaceAdapter-candidate (wraps DSH public seams only: `ctx.tools.register/get/schemas/guard`,
  `tools/execute|pre-execute|result` listeners, `tools/change`, `approval/request`, dispose handles, service accessors)
- **REGISTRY** = GovernedFamilyRegistry-candidate (mount/binding/approval tables, collision + generation checks, read-only, non-authorizing)
- **KERNEL** = GovernanceKernel-candidate (PA admit, Control ask, fresh recheck, Grant mint/consume, generation/epoch,
  publish→active→drain→dispose law, pre-body refusal, execution capability)
- **FAMILY** = family-specific logic that must move OUT of center (branches/tables keyed on concrete tool names; each site listed file:line in §8)
- **BRIDGE** = PTC / LSP / Jobs / MCP specific mechanism (stays in a named bridge per CA-03)
- **LIFECYCLE** = generic init/mount/teardown/dispose wiring
- **UNRELATED** = team domain, UI/read-state, messaging, storage, blueprint — leave alone

**Method note.** All six headline center files plus the tool-dispatch / operation-permission / tool-admission /
control / a5p5 lanes were mapped via complete declaration extraction + targeted reads of every governance region
(the live .mjs files were read through at their decision hot spots; host.ts/root.ts were mapped at declaration +
banner granularity and name-scanned exhaustively). Line ranges are anchor-derived and accurate to the function.

---

## 1. `packages/runtime/src/plugin/host.ts` — 3304 LOC — the plugin row / outermost HostSurfaceAdapter

Tool-name-specific branches: **0** (verified exhaustively by name scan).

| lines | section | category |
|---|---|---|
| 1–587 | module doc; structural seam types (`TeamPluginHostContext` view, glue surface types, `get/provide/effect` ctx shape :219–221, approval vocabulary :290–293, glue export surface :309) | ADAPTER (seam shapes) |
| 587–1084 | config & bootstrap helpers: `validateTeamPluginConfig` :656–806 (closed config keys incl. the `teamToolPlane` block: jobsEnabled/globEnabled/confinedProvider/names), `defaultGlueUrl` :806, `withDefaultWorkspace` :825, seam-URL candidates :850–886, `loadLegacyInspect` :888–944, governance-warning docs :946–1082 | ADAPTER (config surface) + UNRELATED (warning docs) |
| 1084–1118 | plugin identity: `name='dsh-agent-team'` :1084, `inject=[...]` :1104 | ADAPTER |
| 1118–1190 | `apply()` open; Team activation fence :1138; `agent/created` AWAITED veto :1172 + `agent/disposed` rollback barrier :1183 | ADAPTER (host event seam) + KERNEL (fence is a lifecycle gate) |
| 1192–1242 | `internal/get` webServer-compat waterfall :1236 | ADAPTER |
| 1244–1281 | bundled team skills registration | UNRELATED (team skills) |
| 1283–1456 | service accessor wrappers: `sessionPersistence` :1283, `agentPresets` :1333, persona seam mirror :1371–1456 | ADAPTER |
| 1459–1550 | `fsBackend()` accessor :1459 (the containment seam), artifact-grant authority refs :1536–1551 | ADAPTER (fs seam) + KERNEL (artifact authority carrier) |
| 1551–1719 | remote channel mount + bounded connection wait :1654–1719 | UNRELATED (remote DTO) |
| 1721–1930 | `bootstrap()` :1721 — config validate, agents service, workspace attach, seam url, storageDomain seam, `createOrOpenTeamDomainDetailed` :1815 | LIFECYCLE + ADAPTER |
| 1931–2225 | blueprint live authority (saved-source index, live catalog, per-root resolver BP-F) | UNRELATED (blueprint domain) |
| 2226–2382 | host-level `approval/request` waterfall install :2251 (PTC escalation router delegation) + `agent/disposed` mirror :2256 | **BRIDGE (PTC)** + ADAPTER |
| 2384–2792 | requirement-facts authority; glue import via `glueUrl` (the dist-mirrored `agent-bindings.mjs`) :1904–1930; root construction; lazy-ref fills (`teamToolsRef`, `controlServiceRef`, `permissionPlaneRef`, `artifactAuthorityRef`, `ptcEscalationRef`) | LIFECYCLE + ADAPTER (this is where U6's new center row would be loaded) |
| 2793–3304 | legacy reader candidate load :2793–2807, BP-G, remote mount await, boot completion, error paths | LIFECYCLE / UNRELATED |

Verdict: host.ts is already ~pure Adapter+Lifecycle; U6 touches it only for (a) the new center-row load point,
(b) moving the `teamToolPlane` config block into closed-world contribution admission, (c) keeping the PTC row
install as named bridge wiring.

## 2. `packages/runtime/src/plugin/root.ts` — 4356 LOC — Team production root (mostly NOT center)

Tool-name-specific branches: **0** (verified; `'bash'/'pwsh'` exec tokens live in `domain/blueprint` schema —
frozen permission vocabulary, CI-02, not a center branch).

| lines | section | category |
|---|---|---|
| 1–908 | module doc + imports + `TeamProductionRootParams` (:656–906 documents the lazy-ref pattern: `teamToolsRef` :665, `controlServiceRef` :677, `permissionPlaneRef` :829) | UNRELATED (contract surface) |
| 390–908 | helpers: ephemeral mutation store :390, capability values :490, snapshot refs :582, handoff text :600, static template :630 | UNRELATED |
| 959–1704 | blueprint anchor/bound-snapshot machinery, environment facts, compatibility prober/authority :1394–1402, persona source :1566 | UNRELATED |
| 1704–2636 | creation preflight, compatibility ops :2066, fork describe :2441, session query ports :2560–2635, initial-work + completion-notification glue ports :2101–2322 | UNRELATED (team coordination) |
| **2373–2440** | **`createControlService` :2378** + `createLeaderControlNotifier` + `controlServiceRef` publication :2411 — the durable Control authority instantiation | **KERNEL — KEEP (CI-02)** |
| 2636–3282 | `startGovernanceGate` :2636, `createAndStartTeam` :2668, `createHandoffTeam` :2733 | UNRELATED |
| 3283–4054 | permission-entry wiring guards + `permissionLaneMutate` :3293 / `permissionEffectiveWorkspace` :3317 / `permissionExecCanonicalize` :3334 — the admin lane behind the team_* grant/revoke permission tools | KERNEL-adjacent (policy administration; name-agnostic) |
| 4055–4356 | `boot()` :4055 / `close()` :4210 | LIFECYCLE |

Verdict: root.ts is team domain; U6 should not rewrite it. The only center-relevant fact: **it owns ControlService
construction**, which the new Kernel must consume (not replace) per §4 "PA/Control/Grant/Scope/Lease 是中心权限状态".

## 3. `packages/runtime/src/plugin/live/agent-bindings.mjs` — 5887 LOC — the live glue (per-agent assembly funnel)

Tool-name-specific branches: **2 sites** (the `mcp__` prefix law) + it *hosts* the assembly that mounts every
family. The huge middle: `createAgentBindings(deps)` :770–5887, whose `agentSetup` closure :2101–3531 **is the
today's "center assembly"** U6 replaces.

| lines | section | category |
|---|---|---|
| 1–491 | deps contract doc (agents, sessionPersistence, domain, config, refs) + imports: `installScopedToolGuard` :435, `installParameterPermissionListener` :397, plane/bridge/registry imports | ADAPTER wiring |
| 492–541 | `resolveSetupAgent` :492, `LEADER_INSTANCE_ID` :505, work-result codes :508–541 | UNRELATED (session domain) |
| 543–721 | `workMessageText`/`readDeliveredWorkTurn` :543–721 | UNRELATED |
| 723–745 | `GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX='mcp__'` :723 + `guardNativeTrustExcludedMcpName` :724 | **FAMILY (name-prefix law, site A1/A2 — see §8)** |
| 746–769 | guard observation face | KERNEL (audit face) |
| 797–1275 | authority-generation reader :797, activation single-flight :945, session↔root mapping :995–1170, resume/create team agent :1173–1209 | KERNEL (generation reader) + UNRELATED (session domain) |
| 1276–1935 | consumption views :1276, boundary records :1430, MCP fiber witness/reconcile/retire :1505–1935 | **BRIDGE (MCP)** + UNRELATED |
| 1936–2100 | bound blueprint, locateTemplate, resolveStaticCapabilities | UNRELATED |
| **2101–3531** | **`agentSetup()` — the per-agent center assembly** (subsections below) | mixed — the U6 target |
| 2101–2354 | setup preamble: capability/policy resolution, plane realm ids, legacy-face disclosures | LIFECYCLE |
| 2355–2514 | A5-PR1 Guard assembly: trusted-native harvest from `tools.schemas()` no-scope :2416–2428 (mcp__ exclusion :2422), authority-generation prefetch, `installScopedToolGuard` :2449–2496, fail-closed assembly throws | KERNEL + ADAPTER |
| 2515–2555 | builtinToolDeny mask + team tools registration loop (`agentCtx.tools.register(def)` :2553, disposers :2554–2560) | REGISTRY + ADAPTER |
| 2556–2597 | GLUE-5 plane mount block: `createGovernedJobsBridge` :2583–2597 | **BRIDGE (Jobs)** + KERNEL (plane admission wiring) |
| 2606–2622 | `a5PaControlLeg` — the PA→Control durable leg closure over `controlServiceRef` | **KERNEL** (Control ask entry) |
| 2623–2723 | `createTeamToolPlaneAssembly(...)` with `authorityFacts` readers (`overlayGeneration` :2644, `ensureAuthorityCurrent` :2658) + `currentFacts` | REGISTRY + KERNEL |
| 2728–2754 | jobs gateway assembly (fixed trio comment :2728; `createJobsGatewayRow`) | **BRIDGE (Jobs)** |
| 2755–2875 | PTC escalation member register :2854–2871 (`ptcRouter.registerAgent`) | **BRIDGE (PTC)** |
| 2876–2942 | team skills :2881–2888, persona install :2899–2906, MCP reconcile :2907+ | UNRELATED / BRIDGE (MCP) |
| 2943–2990 | A2C-2 Coverage Gate (`permissionCoverageSurfaceUnavailable` path) | KERNEL (closed-world admission of unmanaged names) |
| 2991–3077 | `bindOwnTools`/`bindMcpTools`/`publish()`/`publishPaMount` — PREPARING→ACTIVE transition + PA mount-index publish | KERNEL (state machine) + REGISTRY |
| 3078–3531 | A5 pre-execute adapter install block: control-service gate :3098–3108, fs-seam shape gate :3110–3159, leader exec envelope :3160–3183, `resolveTarget`/`containsTargets` :3199–3240, artifact authority + `authorizeArtifactRead` port :3241–3325, `installParameterPermissionListener` :3326, shell-spill observer :3490–3515 | KERNEL + ADAPTER |
| 3532–3910 | persona sections/slots | UNRELATED |
| 3910–4483 | `ensureLiveAgent` :3910, final input verdict :4123, `publishAuthorityGeneration` :4295 / `refreshAuthorityGeneration` :4329, `prepareAgentForRequest` :4342 | KERNEL (generation republish) + UNRELATED |
| 4484–4770 | `boot()` | LIFECYCLE |
| 4771–5565 | root agent/deliverers/interrupt/drain/residency/unavailable faces (:4799–5565), `coverageSurfaceNames` :5334 | UNRELATED (team delivery) + KERNEL (coverage helper) |
| 5568–5611 | `executeTool` :5568 → `handle.agent.ctx.tools.execute` :5589 | ADAPTER |
| 5612–5887 | `close()` :5612 + returned bundle surface | LIFECYCLE |

## 4. `packages/runtime/src/plugin/live/team-tool-plane.mjs` — 1916 LOC — the governed plane assembly

**The densest concentration of FAMILY logic in center** — 14 sites (see §8 list B1–B14).

| lines | section | category |
|---|---|---|
| 1–83 | header law (RA-REVIEW ② placement attribution / per-scope judgement / fail-closed / same-name divergence / audit honesty; import law: dist mirror) | REGISTRY law |
| 84 | `DEFAULT_PLANE_NAMES {grep→team_grep, glob→team_glob, bash→team_bash}` | **FAMILY (B1)** |
| 85–143 | host output-schema/render contract (`PLANE_PRESENTATION_FACE` :117) | ADAPTER (host render contract) |
| 144–283 | read-row block: envelope regex :144, `readRowEffectiveLimit` :169, `readRowMetaFromMeta` :178, `READ_ROW_PRESENTATION_FACE` :196 (`card:'read'` :269), `readRowPresentResult` :255 | **FAMILY (B2)** |
| 284–345 | `verifyConfinedProviderPairing` (trustRoot hash pairing) | BRIDGE (confined provider) / KERNEL law |
| 346–502 | name law: `PLANE_NAME_SHAPE` :346, `PLANE_RESERVED_NATIVE_HOST_PIN` :402, `PLANE_RESERVED_NATIVE` ~60-name ledger :403–462, `PLANE_RESERVED_NATIVE_PREFIXES ['mcp__']` :464, `PLANE_SUPPORTED_NATIVE_TAKEOVERS` :465–479, `verifyPlaneNames` :480–501 | **FAMILY closed tables (B4–B8)** — §9.2/§10.5 target: "禁止手工维护的中心工具名单" |
| 503–616 | `createLaneDecide` — static-policy lane re-check with permission-class tables | KERNEL (algebra) + **FAMILY name tables (B10–B13)** |
| 617–725 | `createShutBackend` :617, `paIdentityFace` :641, `paBindingIdentityGap` :663 | KERNEL (identity-gap classification) |
| 726–1010 | `createTeamToolPlaneAssembly` config gates, admission-assembly construction, `paRev0RowBindingFor` :917–938, `paPlacementNameOf` :966–974 | REGISTRY + **FAMILY (B14)** |
| 1011–1220 | `paAdmit` Part A — call-level facts read, generation drift, `assembly.admitCall` :1158, Control ask lane via `controlLeg` :1193–1216 | **KERNEL (PA admit + Control ask)** |
| 1221–1500 | `paAdmitEdge` :1221 — fresh clock/generation recheck, `assembly.consumeForExecution` :1406, lease | **KERNEL (one-shot consume)** |
| 1500–1683 | effect backend assembly (`hostedSearch`/`hostedGlob`/`hostedShell`/readExecutor :1653–1682, backends map :1865) | FAMILY backends + KERNEL wiring |
| 1684–1722 | `jobsDefs` — fixed `job_output`/`job_list`/`job_kill` definitions calling the bridge | **FAMILY rows (B15)** — target: Jobs bridge contribution |
| 1723–1783 | read-row definition (`name: readName` :1726, `presentResult: readRowPresentResult` :1777, pre-execute hook `exec.name !== readName` :1829, `paReadHandoff` :1870–1884) | **FAMILY row (B16)** |
| 1784–1916 | `mount()` — placement into own layer (`PLANE_PLACEMENT_CONFLICT` :1891), binding feed, disposer (drain → revoke → tombstone) | REGISTRY + KERNEL lifecycle |

## 5. `packages/runtime/src/plugin/live/pa-mount-registry.mjs` — 477 LOC — the mount-identity law (KEEP)

Tool-name branches: **0**. Name-agnostic throughout; the U4 PoC reused it unmodified as the CI-08 law.

| lines | section | category |
|---|---|---|
| 1–28 | module law doc | REGISTRY law |
| 29–72 | `mounts` map :29, `publishPaMount` :36 / `revokePaMount` :48 (mount-identity token required) / `resolvePaMount` :57 | **KERNEL/REGISTRY — KEEP UNMODIFIED** (generation-scoped publish, identity-scoped revoke, old-disposer staleness) |
| 74–101 | `readCeiling` (external hard ceiling reader) | KERNEL |
| 103–172 | `matchUniqueBindingEntry` :103, `bindingFamilyOf` :145 — binding-family resolution by placement identity, never name lookup | REGISTRY |
| 173–361 | `readCallAuthorityFacts` — the ONE call-level authority-facts builder (policy projection, deny sources, ceiling, binding entry, durable overlay + generation) | **KERNEL — the H0-relevant live read** |
| 362–477 | `readPaCallFactsForCall` :362 / `readPaCallFacts` :444 — public entries keyed by CALL identity | KERNEL |

## 6. `packages/runtime/src/plugin/live/plane-effect-backends.mjs` — 1850 LOC — effect bodies + the Jobs bridge

| lines | section | category |
|---|---|---|
| 1–95 | read-row deployment constants (MAX_READ_BYTES, READ_ROW_*) | **FAMILY (read)** |
| 96–179 | governed read window parse/build :96/:131 | FAMILY (read) |
| 180–324 | `resolveAnchored`/`lexicalAnchor`/`resolveAnchoredPath`/`grepArgv`/`remapFdViewLines` | FAMILY (FS mechanics shared by search/glob rows) |
| 325–475 | `createAnchoredSearchBackend` (grep body; `parsed.tool !== 'grep'` guard :349) | **FAMILY (grep) — move to FS/search Family** |
| 476–677 | `createAnchoredGlobBackend` (glob body; `!== 'glob'` :501) | **FAMILY (glob)** |
| 678–869 | shell mechanics (SYSTEM_RX :678, `raceShellSettle` :733, `shellCancelled` :771, `drainShellStdio` :827) | FAMILY (shell) |
| 870–1073 | `createConfinedShellBackend` (bash body; `!== 'bash'` :899) | **FAMILY (bash/process)** |
| 1074–1578 | `createGovernedReadExecutor` (`rule?.tool !== 'read'` :1078; effect decl `toolName:'read'` :1235) | **FAMILY (read)** |
| 1579–1850 | `createGovernedJobsBridge` over the host JobRegistry public face; name list `['bash','job_output','job_list','job_kill']` :1623; owner fence | **BRIDGE (Jobs)** — sup-b PoC-3 rode this byte-identical (READY-PUBLIC) |

## 7. The lanes the center uses

| file | LOC | role in the target architecture |
|---|---|---|
| `tool-dispatch/closed-world-guard.ts` | 618 | **KERNEL asset — reuse.** `guardDecision` name-agnostic closed-world verdict (state-first :~285, identity :~291, unverified-refuse). 0 tool names. |
| `tool-dispatch/scoped-dispatcher.ts` | 668 | **KERNEL asset — reuse.** Binding feed, generation/epoch, drain/tombstone/release. 0 tool names. |
| `tool-dispatch/install.ts` | 1319 | **KERNEL + ADAPTER seam order (the model for U6's seam order).** PREPARING order :1-50; `definitionIdentityOf` WeakMap id :104–127; `tools.get` required seam :350–383; `readDefinition` scoped :396–410; pre-execute door :758; result/settled edge :788–837; execute gate (guard re-ask + signal fuse + `await next()` :1005) :840–1012; `tools/change` load-bearing watcher :1030–1054. 0 tool names. |
| `tool-dispatch/pending-calls.ts` | 179 | KERNEL (armed/settled ledger, one-shot arming). |
| `operation-permission/pre-execute-adapter.ts` | 2327 | **KERNEL (frozen static pipeline)** + 1 FAMILY site (`name === 'read'` artifact-grant lane :1636) + name-shaped behavior entirely via `classifyPermissionTool`. End-cap monotonic guard on `tools.guard` (H1-P0). |
| `operation-permission/canonical-operation.ts` | 821 | **FAMILY canonicalization inside center — the largest move-out.** `classifyPermissionTool` :260–267; per-tool switch `read/read_image/write/edit/lsp` :668–709; shell canonicalizer (bash/pwsh) :746+; LSP op enum :196–204; SHELL_TOOL_RESOURCE_KEYS :217. |
| `operation-permission/types.ts` | 210 | closed permission vocabulary tables :56–93 (7 tools). |
| `operation-permission/permission-coverage.ts` | 450 | KERNEL algebra + **two closed name tables** (`SAFE_UNMANAGED_TOOL_NAMES` :128; `KNOWN_SENSITIVE_TOOL_NAMES` :150–170). |
| `operation-permission/permission-resolver.ts` | 339 | KERNEL — pure static allow/ask/deny algebra, name-agnostic. KEEP. |
| `operation-permission/pa-control-bridge.ts` | 1049 | KERNEL — the frozen PA→Control leg (requestControl → awaitControlDecision → issueApprovedGrant :40 → guardOperation :42). KEEP. |
| `operation-permission/approval-routing.ts` | 850 | KERNEL-adjacent (ask routing leader/member/human). KEEP. |
| `tool-admission/admission-kernel.ts` | 1132 | **KERNEL core.** `grantIdForCall` :198, admit state machine; effect-kind→rights tables keyed on tool-class at :691–694 (FAMILY vocabulary inside kernel); `createProductionAdmissionAssembly` :1034. |
| `tool-admission/approval-case.ts` | 517 | KERNEL (approval-case identity + effect-set expansion verification). |
| `tool-admission/grant-mint.ts` | 161 | KERNEL (mintOperationGrant :74 + createGrantLedger :111). |
| `control/service.ts` + `types.ts` | 5602+2621 | **KERNEL authority — KEEP UNMODIFIED (CI-02).** requestControl :2141, awaitControlDecision :3759, guardOperation :3240 (consume-exactly-once, ALLOW_CONSUMED :3505, consumedAt write :3639). 0 tool names. |
| `controlled-fs/` | (FS lane) | KERNEL-constrained FS provider (post-consume closures are the family-side execution capability). |
| `packages/tools/a5p5-tools/` | src ~1.5k | **FAMILY-owned lane (the good shape).** `A5P5_TOOL_NAMES=['grep','glob','bash']` (types.ts:44), `createGovernedToolDefinitions` over ONE pipeline (register.ts:151; name table :275–290), per-tool effect derivation (effects-schema.ts:78/:88), pipeline per-tool branches :133–137. Dormant barrel: nothing registers itself; mounting is the assembler's job. |
| dist mirror (`scripts/place-dist-glue.mjs`) | — | 12 PLACEMENTS (:48–:151): agent-bindings, team-tool-plane, jobs-gateway-assembly, ptc-escalation-row, glob-backend, search-backend, plane-effect-backends, cancel-leg, pa-mount-registry, upstream-resolver, root-binding seam.mjs, landlock-prelauncher.py. **Co-commit rule: any change to a mirrored src file must be committed with its byte-identical dist copy; `check-artifacts-committed.mjs` (check D, imports PLACEMENTS) + `check-artifacts-at-head.mjs` (ci-pr-gate :1375–1388) enforce parity; a NEW center .mjs row must be ADDED to PLACEMENTS in the same PR.** |

---

## 8. Tool-name-specific branches in the center — exhaustive enumeration

Counting rule: one site = one conditional, switch case, hard-coded name table/list, or row block keyed by a
concrete tool name (or tool-name prefix family). Tables counted once (entries noted); the three jobs defs counted
as 3 rows inside one block.

### agent-bindings.mjs (2)
- **A1** agent-bindings.mjs:723 — `'mcp__'` prefix constant + `guardNativeTrustExcludedMcpName` :724 — native-trust exclusion family
- **A2** agent-bindings.mjs:2422 — native harvest filters `mcp__`-prefixed names — same law, call site

### team-tool-plane.mjs (14)
- **B1** team-tool-plane.mjs:84 — `{grep:'team_grep', glob:'team_glob', bash:'team_bash'}` default names
- **B2** team-tool-plane.mjs:144–283 — the read-row presentation/envelope block (5 functions, `card:'read'` :269)
- **B3** team-tool-plane.mjs:403–462 — `PLANE_RESERVED_NATIVE` — ~**60 hard-coded native names** (read, read_image, write, edit, glob, grep, bash, pwsh, str_replace_editor, lsp, present, skill, load_workspace_dependencies, todo_write, ask_user_question, web_search, web_fetch, create_goal, get_goal, update_goal, job_kill, job_list, job_output, exit_plan_mode, subagent, subagent_fork, subagent_codex, subagent_claude_code, list_subagent_models, list_agents, send_message, interrupt_agent, terminal_*×6, session_*×5, list_mcp_resources, list_mcp_resource_templates, read_mcp_resource, ralph, spawn_teammate, wait_agent, team_task_*×4, cordis_inspect_*×2, run_code, plugin_manager, schedule_*×4, workflow, stagehand_*×6) + `PLANE_RESERVED_NATIVE_PREFIXES ['mcp__']` :464
- **B4** team-tool-plane.mjs:465–479 — `PLANE_SUPPORTED_NATIVE_TAKEOVERS` {bash:['bash'], read:['read'], grep:[], glob:[], jobs:['job_output','job_list','job_kill']}
- **B5** team-tool-plane.mjs:482 — `verifyPlaneNames`: `key !== 'grep' && 'glob' && 'bash'`
- **B6** team-tool-plane.mjs:486 — rows table `['grep','glob','bash','read']` (takeover validation)
- **B7** team-tool-plane.mjs:582 — `toolClass = bashNames.has(name) ? 'bash' : null` (lane decide)
- **B8** team-tool-plane.mjs:587 — effect-class → permission-class-name mapping `['write','edit'] / ['read','read_image']`
- **B9** team-tool-plane.mjs:598 — `bashNames.has(name) && !covered('allow','bash') && !covered('ask','bash')`
- **B10** team-tool-plane.mjs:601 — `fileNames.has(name) && !['read','read_image','write','edit'].some(...)`
- **B11** team-tool-plane.mjs:966–974 — `paPlacementNameOf` backend-spelling↔mounted-name row map (`spelling === readName` :969)
- **B12** team-tool-plane.mjs:1684–1722 — `jobsDefs`: `name:'job_output'` :1686, `name:'job_list'` :1701, `name:'job_kill'` :1708 (3 rows)
- **B13** team-tool-plane.mjs:1723–1783 — read-row definition block (`name: readName` :1726, read presenters)
- **B14** team-tool-plane.mjs:1829 — read-row pre-execute hook `exec.name !== readName → no-match`

### plane-effect-backends.mjs + search/glob rows (6)
- **C1** plane-effect-backends.mjs:349 — `parsed.tool !== 'grep'`
- **C2** plane-effect-backends.mjs:501 — `parsed.tool !== 'glob'`
- **C3** plane-effect-backends.mjs:899 — `parsed.tool !== 'bash'`
- **C4** plane-effect-backends.mjs:1078 — `rule?.tool !== 'read'`
- **C5** plane-effect-backends.mjs:1235 — effect decl `{kind:'tool-invoke', toolName:'read'}`
- **C6** plane-effect-backends.mjs:1623 — jobs bridge name list `['bash','job_output','job_list','job_kill']`
  (+ search-backend.mjs:656 `!== 'grep'`, glob-backend.mjs:833 `!== 'glob'` — same-law guards in the two row files: +2)

### operation-permission (10) — static governance INSIDE center
- **D1** operation-permission/types.ts:59–65 — `FILE_PERMISSION_TOOL_VALUES ['read','read_image','write','edit','lsp']` (+ :90–93 `SHELL_PERMISSION_TOOL_VALUES ['bash','pwsh']`)
- **D2** operation-permission/canonical-operation.ts:217–220 — `SHELL_TOOL_RESOURCE_KEYS {bash,pwsh}`
- **D3** canonical-operation.ts:196–204 — `LSP_OPERATION_VALUES` (per-tool arg enum)
- **D4** canonical-operation.ts:261 — `FILE_PERMISSION_TOOL_VALUES.includes(name)` (classification site 1)
- **D5** canonical-operation.ts:264 — `SHELL_PERMISSION_TOOL_VALUES.includes(name)` (classification site 2)
- **D6** canonical-operation.ts:669 — `case 'read'` (projection)
- **D7** canonical-operation.ts:679 — `case 'read_image'`
- **D8** canonical-operation.ts:683 — `case 'write'` (contentHash projection)
- **D9** canonical-operation.ts:688 — `case 'edit'` (old/new/replaceAll projection)
- **D10** canonical-operation.ts:699 — `case 'lsp'` (operation/line/character projection)

### permission-coverage (2 tables)
- **E1** permission-coverage.ts:128 — `SAFE_UNMANAGED_TOOL_NAMES ['todo_write']`
- **E2** permission-coverage.ts:150–170 — `KNOWN_SENSITIVE_TOOL_NAMES` (14 names: grep, glob, subagent, subagent_fork, ralph, workflow, web_fetch, web_search, job_list, job_output, job_kill, send_message, interrupt_agent, list_agents)

### pre-execute-adapter (1)
- **F1** pre-execute-adapter.ts:1636 — `name === 'read' && authorizeArtifactRead !== undefined` (artifact-grant floor)

### tool-admission (1)
- **G1** tool-admission/admission-kernel.ts:691–694 — tool-class-keyed effect-kind tables `read/read_image/write/edit` (FAMILY vocabulary inside the kernel); lsp special-casing note :885

### host.ts / root.ts / pa-mount-registry.mjs / tool-dispatch/* / control/service.ts / ptc-escalation-row.mjs / jobs-gateway-assembly.mjs / cancel-leg.mjs
**0 tool-name branches** (exhaustively scanned). These are the clean parts of the center.

### Totals
- **Enumeration sites in center product files: 38** (A:2, B:14, C:8 incl. the two row-file guards, D:10, E:2, F:1, G:1).
- **Distinct tool names referenced by those sites: ~80** (the `PLANE_RESERVED_NATIVE` ledger alone carries ~60).
- **Inside the family-owned lane a5p5-tools (where they belong): a further ~15** name branches (register.ts:185/275–290, effects-schema.ts:78/88, pipeline.ts:133/137, args/types tables).
- Highest-density files: team-tool-plane.mjs (14), canonical-operation.ts (10), plane-effect-backends.mjs (6).
- The `bash`-name branches also carry the **exec-autonomy dual gate tokens** ('bash'/'pwsh' mutation-envelope ops) — those tokens are defined in `packages/domain/blueprint` (schema.ts:504, types.ts:263–277): frozen permission vocabulary, NOT counted here (CI-02).

### What this means for U6 (per architecture §4/§9.2)
1. **Keep, don't rewrite:** tool-dispatch (guard+dispatcher+install seam order), pa-mount-registry law,
   admission-kernel + grant-mint + approval-case, ControlService, pa-control-bridge, permission-resolver,
   end-cap-guarded adapter skeleton. These are name-agnostic and already carry conditions 1–10 machinery.
2. **Move OUT to Family Contributions:** B1–B6/B11–B14 (plane name ledgers + read/jobs rows), C1–C6 (+search/glob
   row files), D1–D10 (canonicalization per-tool projections → Family "pure parse/normalize + Effects"), E1–E2
   (closed name tables → contribution visibility + obligations census), G1 (tool-class tables → contribution
   effects declaration), F1 (read-specific artifact floor → FS Family + Bridge interplay via the named seam).
3. **Bridge homes:** Jobs trio + jobs bridge (C6), PTC escalation row + approval/request install, MCP reconcile,
   LSP (today: canonical 'lsp' case only; real LSP assets live in PR #360).
4. **PLANE_RESERVED_NATIVE / SAFE_UNMANAGED / KNOWN_SENSITIVE tables must become derived data** (source &
   visibility boundary + the dynamic-sources obligations set, §10.5-4 "禁止手工维护的中心工具名单作为运行授权来源")
   — not deleted blindly: they encode the C-16 pin census (team-tool-plane.mjs:403–462 comments cite the pin evidence).
