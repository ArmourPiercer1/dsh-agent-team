# P8-S1A — Actual Production Topology Audit

- **Task ID:** P8-S1A (P8-S plan §11 — actual production topology audit)
- **Base SHA:** `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86` (verified via `git rev-parse HEAD` in worktree)
- **Worktree:** `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S1A` (detached at base SHA, tree clean before this audit)
- **Method:** Read-only static call-graph tracing at HEAD. For each of the 34 fixed nodes (A01–A34) the audit: (1) located the module and its factory function(s); (2) enumerated every call site repo-wide (source, unit tests, harness Cordis rows, e2e drivers, scripts); (3) applied the **shipped-entrypoint rule** (§11.3): a node is `PRODUCTION` only if it is reachable from a SHIPPED entrypoint — a Cordis plugin row, a package entrypoint a host composition can mount, or a public seam a shipped row uses. Subsystems reachable only via test harnesses, e2e drivers, or manual row payloads are at best `HARNESS_ONLY` or `MODULE_ONLY_NOT_WIRED`.
- **Status vocabulary:** `PRODUCTION | HARNESS_ONLY | MODULE_ONLY_NOT_WIRED | MISSING | UNKNOWN`
- **Decisive structural finding (applies to all nodes):** the repository ships **no Cordis composition file**, **no `dist/` builds** (every `package.json` `exports` points at `./dist/index.js`, which does not exist), and its two Cordis plugin halves — `packages/runtime/src/plugin/host.ts` (`name = 'dsh-agent-team'`) and `packages/client/src/plugin/client.ts` (`name = 'dsh-agent-team-client'`) — are **empty P1-T4 skeletons** (`apply(_ctx)` registers no services, tools, timers, or listeners) that are **not even exported** from their package indexes (`packages/runtime/src/index.ts` and `packages/client/src/index.ts` export only `PACKAGE_ID`). The README confirms the entries "bind no services, tools, timers, or listeners yet". Consequently **no node is reachable from any shipped entrypoint at HEAD**, and `PRODUCTION = 0` is the expected, defensible outcome.
- **What IS live at HEAD (context, not production):** four hand-written harness Cordis rows (`.mjs`) mounted via the `<DSH_HOME>/profiles/web/cordis.patch.yml` profile-patch seam against the **test** DSH instance (port 3180, `references/deepseek-harness-test-use`): `packages/runtime/root-binding/harness/plugin.mjs` (S1/S2/S3/S4), `packages/runtime/member-residency/harness/plugin.mjs` (M1/M2/M3–M5/I1A/I1C), `packages/tools/harness/plugin.mjs` (boots 1+2, scenarios E1–E7), `packages/legacy/session-reader/e2e/plugin.mjs` (L1/L2/L3). This is `HARNESS_ONLY` evidence per §11.3.

---

## A01 — Cordis plugin entrypoint (host half)

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/src/plugin/host.ts` |
| **Factory-function** | `apply(_ctx)` — intentionally empty P1-T4 skeleton ("registers no services, tools, timers, listeners"); `name = 'dsh-agent-team'` |
| **Created by** | Nothing. No composition row references it; it is not exported from `packages/runtime/src/index.ts` (which exports only `PACKAGE_ID`); no `dist/` build exists to mount |
| **Injected dependencies** | None (empty `apply`) |
| **Durable authority** | None |
| **Live-Agent effect** | None |
| **Restart path** | None — no activation path exists at HEAD |
| **Evidence** | `packages/runtime/src/plugin/host.ts` (empty `apply`, P1-T4 note); `packages/runtime/src/index.ts` (exports `PACKAGE_ID` only); no `dist/` directory in any package; `README.md` ("bind no services, tools, timers, or listeners yet"); no `cordis.yml`/composition file anywhere in the repo |

## A02 — TeamDomain open/create (storage repositories)

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/storage/repositories/team-domain.ts` |
| **Factory-function** | `createTeamDomain(seam)` (line 160), `openTeamDomain` (line 196) |
| **Created by** | Harness rows only: `packages/tools/harness/plugin.mjs` lines 391–394 (`createTeamDomain` for fresh boot / `openTeamDomain` for re-boot); no shipped row exists |
| **Injected dependencies** | `StorageDomainSeam` — supplied by the harness via `createRealStorageDomainSeam` (`packages/runtime/root-binding/harness/seam.mjs`) over DSH's **public** `storageDomain` service / `@deepseek-ai/dsh-storage-domain` `defineDomain`; no host-backend import in the module itself |
| **Durable authority** | TeamDomain is the sole durable control-plane authority (8 store repositories); all durable state flows through this seam |
| **Live-Agent effect** | None directly (durability plane) |
| **Restart path** | Cold re-open via `openTeamDomain` (exercised by harness cold-boot scenarios) |
| **Evidence** | `packages/storage/repositories/team-domain.ts:160,196`; `packages/tools/harness/plugin.mjs:391-394`; `packages/runtime/root-binding/harness/seam.mjs` |

## A03 — Blueprint catalog

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/domain/blueprint/src/catalog.ts` |
| **Factory-function** | `createBlueprintCatalog` (line 150), `createBlueprintCatalogFromSource` (line 180) |
| **Created by** | `packages/tools/harness/plugin.mjs:402-403` (`parseBlueprint` + `createBlueprintCatalog`) — no other production call site |
| **Injected dependencies** | Blueprint source (harness-embedded blueprint) |
| **Durable authority** | Catalog is in-memory; blueprint content feeds member setup |
| **Live-Agent effect** | None directly |
| **Restart path** | Re-parsed from source on each boot (harness re-derives) |
| **Evidence** | `packages/domain/blueprint/src/catalog.ts:150,180`; `packages/tools/harness/plugin.mjs:402-403` |

## A04 — TeamIntent / intent preflight

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | Intent types and preflight contract: `packages/remote/contracts/catalog.ts` (`intent.probe` among the 9 categories / 23 methods) and `packages/runtime/handoff/types.ts` (`HandoffTeamIntent`, line 219) |
| **Factory-function** | None standalone — intent preflight surfaces only as the `intent.probe` remote contract and as the handoff intent type; the probing logic is A14 |
| **Created by** | Nothing in a shipped or harness topology. The only consumer is the remote `intent.probe` handler, whose registration (A31) has **zero callers** repo-wide |
| **Injected dependencies** | n/a (type/contract surface) |
| **Durable authority** | None |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/remote/contracts/catalog.ts` (23-method catalog incl. `intent.probe`); `packages/runtime/handoff/types.ts:219`; `registerRemoteHandlers` (A31) unreachable from any shipped entrypoint |

## A05 — Fresh root binding

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/root-binding/fresh-root.ts` |
| **Factory-function** | `bindFreshTeamRoot` (line 102) |
| **Created by** | Harness `packages/runtime/root-binding/harness/plugin.mjs` (S1 fresh scenario); no shipped row |
| **Injected dependencies** | Session-kind read; TeamDomain record write (record-BEFORE-binding, crash-safe ordering); team-root binding; `binder.bindFreshRoot` (3 overlay slots); admission guard |
| **Durable authority** | Writes the TeamSession record and team-root binding durably before any live binding |
| **Live-Agent effect** | Root/leader live agent created through DSH public `agents` seam (harness wiring) |
| **Restart path** | A06 cold rehydration |
| **Evidence** | `packages/runtime/root-binding/fresh-root.ts:102`; `packages/runtime/root-binding/harness/plugin.mjs` (S1) |

## A06 — Cold root rehydration

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/root-binding/cold-root.ts` |
| **Factory-function** | `rehydrateColdTeamRoot` (line 65; zero durable writes) |
| **Created by** | Harness `packages/runtime/root-binding/harness/plugin.mjs` (S2 cold boot2 scenario) |
| **Injected dependencies** | Read-only TeamDomain; rebind of the live root agent |
| **Durable authority** | None (zero durable writes by construction) |
| **Live-Agent effect** | Re-binds/resumes the root agent session |
| **Restart path** | This IS the restart path (process restart → cold rehydration) |
| **Evidence** | `packages/runtime/root-binding/cold-root.ts:65`; `packages/runtime/root-binding/harness/plugin.mjs` (S2) |

## A07 — Leader actor identity

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/contracts/src/identity.ts` |
| **Factory-function** | `LEADER_INSTANCE_ID: InstanceId = 'inst-leader'` (line 46), `leaderMemberIdentityOf` (line 139), `memberIdentityKey` |
| **Created by** | The leader row is **seeded by the tools harness**: `packages/tools/harness/run.mjs:522` (`seedIds = [LEADER_INSTANCE_ID, SEED_WORKER_ID, SEED_SCOUT_ID]` — "boot1 state: exactly the three seeded members") and `packages/tools/harness/plugin.mjs:445-456` (seeds 3 member rows incl. leader with lifecycle RUNNING). A fresh root does NOT mint the leader row (known defect C2, P8-S §15.2 — cited as context, not a finding of this audit) |
| **Injected dependencies** | None (pure identity derivation) |
| **Durable authority** | Leader is durable only as an ordinary member row with `childSessionId = rootSessionId` (known defect C1, P8-S §15.2) |
| **Live-Agent effect** | Leader live agent exists only in the harness-seeded world |
| **Restart path** | Leader row re-read on cold boot (harness) |
| **Evidence** | `packages/contracts/src/identity.ts:46,139`; `packages/tools/harness/run.mjs:522`; `packages/tools/harness/plugin.mjs:445-456`; P8-S plan §15.2 C1/C2 |

## A08 — Fresh member residency

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/member-residency/fresh-member.ts` |
| **Factory-function** | `createFreshMember` (line 150) |
| **Created by** | Harness `packages/runtime/member-residency/harness/plugin.mjs` (M1 fresh scenario) |
| **Injected dependencies** | `createMemberDomainWritePort` (`member-residency/write-port.ts:38`); TeamDomain; `deriveMemberIdentity` (`member-residency/identity.ts`) |
| **Durable authority** | Member record written durably before the live bind |
| **Live-Agent effect** | Spawns member live agent via DSH public `agents` seam (harness wiring) |
| **Restart path** | A09 cold rehydration |
| **Evidence** | `packages/runtime/member-residency/fresh-member.ts:150`; `packages/runtime/member-residency/harness/plugin.mjs` (M1) |

## A09 — Cold member rehydration

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/member-residency/cold-member.ts` |
| **Factory-function** | `rehydrateColdMember` (line 45) |
| **Created by** | Harness `packages/runtime/member-residency/harness/plugin.mjs` (M2 cold scenario) |
| **Injected dependencies** | Read-only TeamDomain; rebind of the member agent |
| **Durable authority** | None |
| **Live-Agent effect** | Resumes the member agent session |
| **Restart path** | This IS the restart path |
| **Evidence** | `packages/runtime/member-residency/cold-member.ts:45`; `packages/runtime/member-residency/harness/plugin.mjs` (M2) |

## A10 — TeamAgentBinder (persona/model/capability mounting)

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/agent-setup/binder/binder.ts` |
| **Factory-function** | `class TeamAgentBinder` (line 114) |
| **Created by** | Harness rows via root-binding (`bindFreshRoot` mounts the 3 overlay slots) and member-residency (M1); constructed over `createTeamDomainReadHandle` (`binder/read-handle.ts:46`) |
| **Injected dependencies** | Persona overlay slot (A11), model overlay slot (A12), capability overlay slot (A13) |
| **Durable authority** | None directly (mounts presets/selection via DSH public seams whose durability lives in DSH) |
| **Live-Agent effect** | Mounts persona preset (public `agentPresets.mount` seam), model selection, team tools onto the live agent |
| **Restart path** | Re-mounted during cold rehydration (A06/A09) |
| **Evidence** | `packages/runtime/agent-setup/binder/binder.ts:114`; `packages/runtime/agent-setup/binder/read-handle.ts:46`; harness rows S1/M1 |

## A11 — Persona overlay slot

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/agent-setup/persona/adapter.ts` |
| **Factory-function** | `createPersonaOverlaySlot` (line 267), `TeamPersonaPresetAdapter` (line 125) |
| **Created by** | Harness rows via `TeamAgentBinder` (S1/M1) |
| **Injected dependencies** | DSH public `agentPresets` seam |
| **Durable authority** | Persona preset rows (durability in DSH side) |
| **Live-Agent effect** | Persona injected into live agent session |
| **Restart path** | Re-mounted on cold boot |
| **Evidence** | `packages/runtime/agent-setup/persona/adapter.ts:125,267` |

## A12 — Model selection overlay

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/agent-setup/model/overlay.ts` |
| **Factory-function** | `TeamModelSelectionAdapter` (line 90), `TeamModelOverlaySlot` (line 218) |
| **Created by** | Harness rows via `TeamAgentBinder` (S1/M1) |
| **Injected dependencies** | DSH model-selection public seam |
| **Durable authority** | Model selection record (DSH side) |
| **Live-Agent effect** | Routes the member's live agent to the selected model |
| **Restart path** | Re-applied on cold boot |
| **Evidence** | `packages/runtime/agent-setup/model/overlay.ts:90,218` |

## A13 — Capability overlay slot

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/agent-setup/capability/slot.ts` |
| **Factory-function** | `createCapabilityOverlaySlot` (line 85) |
| **Created by** | Harness rows via `TeamAgentBinder` (S1/M1) |
| **Injected dependencies** | DSH tool-registration public seam |
| **Durable authority** | None |
| **Live-Agent effect** | Registers team tools on the live agent |
| **Restart path** | Re-registered on cold boot |
| **Evidence** | `packages/runtime/agent-setup/capability/slot.ts:85` |

## A14 — CompatibilityProber

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/compatibility/probe.ts` |
| **Factory-function** | `createCompatibilityProber` (line 187); `PROBE_TRIGGERS` in `packages/runtime/compatibility/types.ts` (line 44) |
| **Created by** | p7t1 unit tests only. Notably, the wired admission gate (A15) uses the separate P6-T1 bridge `evaluateActivationCompatibility` (inv 50 in `admission/gate.ts`), **not** this prober — so no reachable path uses it |
| **Injected dependencies** | Structural ports (test fakes in unit tests) |
| **Durable authority** | None |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/compatibility/probe.ts:187`; `packages/runtime/compatibility/types.ts:44`; `packages/runtime/action-router/admission/gate.ts` (inv 50 uses P6-T1 bridge); p7t1 tests |

## A15 — New-work admission (admission guard)

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/action-router/admission/gate.ts` (+ `admission/actions.ts`, `admission/resolve.ts`) |
| **Factory-function** | `enforceCompatibilityGate` (inv 50, uses P6-T1 bridge `evaluateActivationCompatibility`); `ACTION_NAMES` (LIST_MEMBERS, LIST_TEMPLATES, INSPECT_CONFIG, FOLLOW_UP, DELEGATE, CREATE_MEMBER, SEND_MESSAGE, REPORT_PROGRESS, REQUEST_CONTROL, RESOLVE_CONTROL, ARCHIVE_MEMBER, RESTORE_MEMBER, DISPOSE_MEMBER); caller-role resolution in `admission/resolve.ts` lines 236/250 (`instanceId === LEADER_INSTANCE_ID ? 'leader' : 'member'`) |
| **Created by** | Wired inside `createTeamRuntime` (A17), which is constructed by `packages/tools/harness/plugin.mjs:543`; admission-closed path exercised by root-binding harness S3 scenario |
| **Injected dependencies** | P6-T1 bridge `evaluateActivationCompatibility`; read handle |
| **Durable authority** | None (stateless gate over the read model) |
| **Live-Agent effect** | Blocks/allows new work on a member's live agent |
| **Restart path** | Stateless — re-evaluated per action |
| **Evidence** | `packages/runtime/action-router/admission/gate.ts`; `packages/runtime/action-router/admission/resolve.ts:236,250`; `packages/runtime/action-router/admission/actions.ts`; `packages/tools/harness/plugin.mjs:543`; root-binding harness (S3) |

## A16 — ActivationProvider

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/activation/provider.ts` |
| **Factory-function** | `createActivationProvider` (line 129); `createActivationChildAdapter` (`activation/adapter.ts:59`) |
| **Created by** | `packages/tools/harness/plugin.mjs:533` — no other production call site |
| **Injected dependencies** | DSH public `agents` create/resume seam; `sessionDurability` port backed by `sessionPersistence.ensureMaterialized` (harness `plugin.mjs:490-496,612,620`) — the session-durability barrier before live use |
| **Durable authority** | Session materialization barrier (durability gate before a live agent may be used) |
| **Live-Agent effect** | Actually creates/resumes live agents — the primary live-Agent seam in the harness world |
| **Restart path** | Cold resume through the public `agents` seam |
| **Evidence** | `packages/runtime/activation/provider.ts:129`; `packages/runtime/activation/adapter.ts:59`; `packages/tools/harness/plugin.mjs:533,490-496,612,620` |

## A17 — TeamRuntime facade (action router)

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/action-router/router.ts` |
| **Factory-function** | `createTeamRuntime(options)` (line 69) |
| **Created by** | `packages/tools/harness/plugin.mjs:543` — no shipped composition exists to call it |
| **Injected dependencies** | Action router + admission (A15) + read handle + satellite services (control, messaging, activity) |
| **Durable authority** | None directly (delegates to TeamDomain ports) |
| **Live-Agent effect** | Routes admitted actions to live agents |
| **Restart path** | Reconstructed on cold boot (harness) |
| **Evidence** | `packages/runtime/action-router/router.ts:69`; `packages/tools/harness/plugin.mjs:543` |

## A18 — Member work delivery (agent input)

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | Real `SessionInputPort` constructed in `packages/tools/harness/plugin.mjs` (lines 515–529: `agent.followup(createUserMessage(...))` + `whenIdle`) |
| **Factory-function** | Port object built in the harness (no standalone production factory) |
| **Created by** | Tools harness (E1–E7 scenarios) |
| **Injected dependencies** | Live agent handle |
| **Durable authority** | Session persistence via the durability barrier (A16) |
| **Live-Agent effect** | Delivers work into the member's live agent — the primary live-Agent seam demonstrated at HEAD |
| **Restart path** | Re-delivery after cold rebind |
| **Evidence** | `packages/tools/harness/plugin.mjs:515-529` |

## A19 — Settlement (settle operation)

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/lifecycle/archive.ts` (settle-then-archive) |
| **Factory-function** | Settle via `applyLifecycleOperation(member, LIFECYCLE_OPERATIONS.SETTLE)` (line 83) inside the lifecycle service |
| **Created by** | p7t3 unit tests only — they run against testkit `FileStorageSeam` (in-memory world, no DSH process) |
| **Injected dependencies** | Structural write ports (test fakes) |
| **Durable authority** | Lifecycle state recorded in TeamDomain (in tests) |
| **Live-Agent effect** | Settles the member's live agent (test world only) |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/lifecycle/archive.ts:83`; p7t3 helpers using testkit `FileStorageSeam` |

## A20 — Lifecycle service

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/lifecycle/index.ts` |
| **Factory-function** | `createLifecycleService` (line 82); 5-step quiesce procedure in `lifecycle/quiesce.ts` |
| **Created by** | p7t3 tests only (FileStorageSeam world) |
| **Injected dependencies** | Structural write ports (test fakes) |
| **Durable authority** | Lifecycle operations → TeamDomain records (in tests) |
| **Live-Agent effect** | Quiesce procedure exercised only in tests |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/lifecycle/index.ts:82`; `packages/runtime/lifecycle/quiesce.ts`; p7t3 tests |

## A21 — Lifecycle durable commit

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/lifecycle/resolve.ts` |
| **Factory-function** | The single durable commit path for lifecycle transitions (exported from `lifecycle/resolve.ts`) |
| **Created by** | p7t3 tests only (FileStorageSeam world) |
| **Injected dependencies** | TeamDomain write port (structural) |
| **Durable authority** | The single commit point for lifecycle transitions (in tests) |
| **Live-Agent effect** | None directly |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/lifecycle/resolve.ts`; p7t3 tests |

## A22 — MutationService

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/mutation/service.ts` |
| **Factory-function** | `class MutationService` (lines 101/117) |
| **Created by** | Exactly one call site repo-wide: `new MutationService` in `packages/runtime/mutation/p7t2-helpers.ts:287` (test helper) |
| **Injected dependencies** | Policy adapter (A23); structural write ports |
| **Durable authority** | Mutation queue in TeamDomain (in tests) |
| **Live-Agent effect** | None (no live application at HEAD) |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/mutation/service.ts:101,117`; `packages/runtime/mutation/p7t2-helpers.ts:287` |

## A23 — Mutation → live Agent boundary

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/mutation/service.ts` (future-boundary semantics) + `packages/runtime/policy-adapter.ts` (P7-T2 adapter to the frozen P3-T4 resolver) |
| **Factory-function** | Future-boundary semantics (`effectiveFromStep = requestedAtStep + 1`, in-flight capture set) + policy adapter |
| **Created by** | p7t2 tests only |
| **Injected dependencies** | P3-T4 resolver (frozen contract) |
| **Durable authority** | Boundary step recorded durably (in tests) |
| **Live-Agent effect** | None at HEAD — mutations are never applied to a live agent by any reachable path |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/mutation/service.ts` (future-boundary section); `packages/runtime/policy-adapter.ts`; p7t2 tests |

## A24 — Messaging coordinator

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/messaging/coordinator.ts` |
| **Factory-function** | `createMessagingCoordinator` (line 292) |
| **Created by** | `packages/tools/harness/plugin.mjs:557` |
| **Injected dependencies** | Member read model; activity ledger (A26) |
| **Durable authority** | Message records in TeamDomain |
| **Live-Agent effect** | Delivers messages into member live agents (via the harness `SessionInputPort`) |
| **Restart path** | Reconstructed on cold boot (harness) |
| **Evidence** | `packages/runtime/messaging/coordinator.ts:292`; `packages/tools/harness/plugin.mjs:557` |

## A25 — Control service (approval / request-control)

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/control/service.ts` |
| **Factory-function** | `createControlService` (line 456) |
| **Created by** | `packages/tools/harness/plugin.mjs:551` |
| **Injected dependencies** | Control-request records; REQUEST_CONTROL / RESOLVE_CONTROL actions |
| **Durable authority** | Control-request records in TeamDomain |
| **Live-Agent effect** | Pause/resume semantics over member live agents |
| **Restart path** | Re-read on cold boot (harness) |
| **Evidence** | `packages/runtime/control/service.ts:456`; `packages/tools/harness/plugin.mjs:551` |

## A26 — Activity ledger / progress

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/runtime/activity/ledger.ts` |
| **Factory-function** | `createActivityLedger` (line 244); `buildActivityEntry` (`activity/facts.ts:168`) |
| **Created by** | `packages/tools/harness/plugin.mjs:563` |
| **Injected dependencies** | Activity records (TeamDomain) |
| **Durable authority** | Ledger entries in TeamDomain |
| **Live-Agent effect** | None directly (observes REPORT_PROGRESS) |
| **Restart path** | Re-read on cold boot (harness) |
| **Evidence** | `packages/runtime/activity/ledger.ts:244`; `packages/runtime/activity/facts.ts:168`; `packages/tools/harness/plugin.mjs:563` |

## A27 — Fork reconciliation

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/fork-reconciliation/reconciler.ts` |
| **Factory-function** | `reconcileForkSidecar` (reconciler.ts); `createTeamDomainForkPort` (`adapter.ts:36`) |
| **Created by** | p7t4 tests only |
| **Injected dependencies** | Structural ports (test fakes) |
| **Durable authority** | Reconciliation result into TeamDomain (in tests) |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/fork-reconciliation/reconciler.ts`; `packages/runtime/fork-reconciliation/adapter.ts:36`; p7t4 tests |

## A28 — Handoff service

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/handoff/service.ts` |
| **Factory-function** | `createHandoffService` (line 175); `HandoffTeamIntent` (`handoff/types.ts:219`) |
| **Created by** | p7t5 tests only |
| **Injected dependencies** | Structural ports (test fakes) |
| **Durable authority** | Handoff-intent records (in tests) |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/handoff/service.ts:175`; `packages/runtime/handoff/types.ts:219`; p7t5 tests |

## A29 — Legacy session reader

| Field | Value |
| --- | --- |
| **Status** | `HARNESS_ONLY` |
| **Production file** | `packages/legacy/session-reader/index.ts` |
| **Factory-function** | `inspectLegacyTeam`; `dispatchReaderAction` (line 42) |
| **Created by** | Harness `packages/legacy/session-reader/e2e/plugin.mjs` (L1/L2/L3 scenarios; mini-MCP tool `p7t7_legacy_read`; `inject = ['webServer']`) |
| **Injected dependencies** | `webServer` service (test DSH instance) |
| **Durable authority** | None — READ-ONLY by construction |
| **Live-Agent effect** | None (read-only) |
| **Restart path** | Stateless |
| **Evidence** | `packages/legacy/session-reader/index.ts:42`; `packages/legacy/session-reader/e2e/plugin.mjs` |

## A30 — TeamProjection service

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/runtime/projection/service.ts` |
| **Factory-function** | `createProjectionService` (line 78) |
| **Created by** | g8s1 / p8t2 tests only |
| **Injected dependencies** | TeamDomain read handle |
| **Durable authority** | None (derived view) |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/runtime/projection/service.ts:78`; g8s1/p8t2 tests |

## A31 — Remote handler registration

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/remote/src/handlers/register.ts` |
| **Factory-function** | `registerRemoteHandlers` (line 72); `REMOTE_RPC_CHANNEL = '/team-remote'` |
| **Created by** | **Zero callers repo-wide.** The module's own doc comment says "host wiring (a later P8 harness task) installs it" — that wiring does not exist at HEAD, in any harness row or shipped surface |
| **Injected dependencies** | 12 structural ports (`packages/remote/src/handlers/ports.ts`) |
| **Durable authority** | None directly |
| **Live-Agent effect** | None at HEAD |
| **Restart path** | n/a |
| **Evidence** | `packages/remote/src/handlers/register.ts:72`; `packages/remote/src/handlers/ports.ts`; repo-wide grep for `registerRemoteHandlers` call sites = 0 |

## A32 — Push / generation / reconnect

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/remote/src/push/` (`reconnect.ts`, `generation.ts`, `pull.ts`) |
| **Factory-function** | Pure push/generation/reconnect helpers |
| **Created by** | p8t4 tests only |
| **Injected dependencies** | None — documented as pure: "a real deployment supplies the transport and clock" |
| **Durable authority** | None |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/remote/src/push/*`; p8t4 tests |

## A33 — Ledger pagination

| Field | Value |
| --- | --- |
| **Status** | `MODULE_ONLY_NOT_WIRED` |
| **Production file** | `packages/remote/src/push/ledger-page.ts` |
| **Factory-function** | `createLedgerPageTracker` (line 118) |
| **Created by** | p8t4 tests only |
| **Injected dependencies** | None (pure) |
| **Durable authority** | None |
| **Live-Agent effect** | None |
| **Restart path** | n/a |
| **Evidence** | `packages/remote/src/push/ledger-page.ts:118`; p8t4 tests |

## A34 — External principal derivation (server-side)

| Field | Value |
| --- | --- |
| **Status** | `MISSING` |
| **Production file** | None exists |
| **Factory-function** | None exists |
| **Created by** | n/a |
| **Injected dependencies** | n/a |
| **Durable authority** | n/a |
| **Live-Agent effect** | n/a |
| **Restart path** | n/a |
| **Evidence** | No server-side principal derivation exists at HEAD. The remote caller is **client-provided**: `parseRemoteCaller` (`packages/remote/src/contracts/params.ts:673`, called at lines 1120/1151/1183) shape-validates only the client-supplied `caller` parameter in the request envelope. P8-S plan §20.3 requires "Host 必须 server-side derive principal" (the host MUST server-side derive the principal) — this is the remote-principal-boundary gap. Cited as a spec gap (context), not an implementation finding of this audit. |

---

## Summary

### Counts per status (34/34 nodes classified)

| Status | Count | Nodes |
| --- | --- | --- |
| `PRODUCTION` | **0** | — |
| `HARNESS_ONLY` | **19** | A02, A03, A05, A06, A07, A08, A09, A10, A11, A12, A13, A15, A16, A17, A18, A24, A25, A26, A29 |
| `MODULE_ONLY_NOT_WIRED` | **14** | A01, A04, A14, A19, A20, A21, A22, A23, A27, A28, A30, A31, A32, A33 |
| `MISSING` | **1** | A34 |
| `UNKNOWN` | **0** | — |

### Non-PRODUCTION nodes

**All 34 nodes are non-PRODUCTION.** `HARNESS_ONLY` (19): A02, A03, A05–A13, A15–A18, A24, A25, A26, A29. `MODULE_ONLY_NOT_WIRED` (14): A01, A04, A14, A19–A23, A27, A28, A30, A31, A32, A33. `MISSING` (1): A34.

### Production-path narrative (A01 → A30/A31)

There is no production path at HEAD. The only shipped-entrypoint candidate — the host Cordis plugin half A01 (`packages/runtime/src/plugin/host.ts`) — is an empty P1-T4 skeleton whose `apply` registers nothing, which the package index does not export, which has no `dist/` build, and which no Cordis composition file in the repository references; the client half A01-C is the same. Because every shipped-entrypoint check fails at the very first hop (A01), nothing downstream is reachable from a shipped surface: the durable authority A02 (TeamDomain), the fresh/cold root and member paths A05–A09, the leader identity A07 (which is in fact harness-seeded at `run.mjs:522` rather than minted by a fresh root — known defect C2), the binder and its three overlays A10–A13, admission A15, activation A16, the runtime facade A17 and work delivery A18, and the satellites A24–A26 are all demonstrable only through the four harness Cordis rows mounted via `cordis.patch.yml` on the port-3180 test instance. The projection A30 and the entire remote plane A31/A32/A33 (including `registerRemoteHandlers`, which has zero callers repo-wide) and the mutation plane A22/A23 exist purely as tested modules, and the server-side external principal derivation A34 that P8-S §20.3 requires does not exist at all — the remote caller today is a client-provided, shape-validated parameter. A real host would need a composition row over a built plugin entry that opens TeamDomain through the public `storageDomain` seam, registers the `/team-remote` handlers, and wires the TeamRuntime facade plus its satellites: none of that exists at HEAD, which is exactly why 0/34 is `PRODUCTION`.
