# DECOMPOSITION-PLAN — the two production composition files

**Snapshot:** commit `4fd8f8e75` (2026-11-22T00:43:14+08:00), clean working tree.
`agent-bindings.mjs` = **5,042 lines** (`sha256 46aa3303…`); `root.ts` = **5,110 lines** (`sha256 77ed8dd0…`).

> **Round 86 measurement (later HEAD):** at `c29da52d3`, `agent-bindings.mjs` is **4,967 lines** and
> `root.ts` is **5,239 lines** (`wc -l`). The snapshot line numbers below are still the ones the anchors
> were derived from; the anchors, not the offsets, are the contract (the plan says so itself).
Line numbers below are from that snapshot. The file was edited by a parallel lane three times while
this plan was written (5,283 → 5,301 → 5,092 → 5,042), so **every row carries a grep anchor** (the
declaration name). Re-derive a range with `grep -n 'function <anchor>' <file>` before cutting.

Each cut below is a **move**, not a rewrite: identical bodies, dependency-injected, no behavior change.
The only step that changes a data shape is S4 (and it is called out as such).

---

## 1. What already delegates — build on it, do not duplicate

| Seam | Site | What it already owns |
| --- | --- | --- |
| `work-turn-reader.mjs` | glue import `agent-bindings.mjs:361` | `readDeliveredWorkTurn` + the 7 `WORK_RESULT_CODE_*` (f90a9af90) |
| `member-execution.mjs` | glue import `:366`, call `:2206` | realm→centre composition: binding, fact ledger, settlement store, crash recovery, native mount + its disposal (4fd8f8e75) |
| `centre-install.mjs` | imported by `member-execution.mjs:26` | `bindingFromCompiledMember` / `installMemberCentre` (admission + facts + settlement) |
| `fact-ledger.mjs`, `settlement-port.mjs`, `admission-port.mjs`, `execution-facts.mjs`, `admission.ts` | reached only through `centre-install` | durable admission record, no-replay, execution facts, settlement transitions |
| `realm-lane.mjs` | imported by `member-execution.mjs:28` | host native module mount + definition-identity proof |
| `a5sf-realm-row.mjs` | glue import `:364`, call `:2185` | realm mount, config normalization, compiled answer, disposer |
| **root.ts** | — | **no vnext-centre import at all.** It consumes the older `../../../admission/index.js` package and the glue through `live.*` (151 refs). That is why the root lane in §6 can run in parallel with the glue lane. |

Consequence: the centre is already out of the glue's body. What remains is **process state**
(live handles, per-session consumption, persona, MCP, delivery) — which is exactly the part the
external review says must not be split mechanically.

---

## 2. `agent-bindings.mjs` — cohesive regions

`S` = closure state read or written (see §4). Line counts are inclusive.

| ID | Lines | Anchor (first declaration) | Responsibility | State touched |
| --- | --- | --- | --- | --- |
| A0 | 1–433 | file docblock / `import` block | deps contract doc + imports (local edges 361/364/366/410/415/423) | — |
| A1 | 434–517 | `freshCreateHintAdmits` 466, `resolveSetupAgent` 470, `LEADER_INSTANCE_ID` 483, `TOOL_EXEC_TIMEOUT_MS` 486, `a5PlaneSubtreeContains` 500 | pure module-level helpers | — |
| A2 | 518–590 | `createAgentBindings` 516, `readAuthorityGeneration` 543 | factory entry, deps validation, the ONE generation reader | — |
| A3 | 591–782 | `liveAgents` 594 … `teamSkillCatalog` 779 | **the closure state block** (20 bindings) + `singleFlightTeamActivation` 750 | all |
| A4 | 783–1036 | `childSessionIdFor` 800 | durable session identity, ownership, lifecycle gate, **admission close** | `newWorkClosed` 626, `terminalAtReopen` 655 (own) |
| A5 | 1037–1178 | `teamOwnedSetup` 1068 | ownership-guarded activation wrappers (one create / one resume site) | `activationInFlight` 736, `activationFence` |
| A6 | 1179–1392 | `resolveConsumptionViews` 1229 | re-read durable truth → model/MCP views; boundary record set | `consumptionState` 697, `config`, `domain` |
| A7 | 1393–1834 | `emitMcpCapabilityEvent` 1458, `reconcileMcpSet` 1705 | per-server MCP materialization, retry/backoff, live-loss witness, exhausted-fiber retirement | `consumptionState`, `observations`, `closing` |
| A8 | 1835–2053 | `boundBlueprintByRoot` 1872, `getBoundBlueprint` 1889, `locateTemplate` 1930, `resolveStaticCapabilities` 2001 | bound-blueprint cache + template location + static capability projection | `boundBlueprintByRoot` (own), `config`, `domain` |
| A9 | 2054–2405 | `agentSetup` 2054 | **the member composition point** (352 lines): state build → realm/centre → base tools → team tools → skills → persona → MCP baseline | writes 7 maps |
| A10 | 2406–2800 | `personaSubstrate` 2417 … `installPersonaForSetup` 2718 | persona slot, scoped sections, root/member Team context blocks, production substrate resolver | `personaDisposers` 770, `personaPending` 771, `liveAgentCtxs` 772, `personaSlot` 773, `productionPersonaSlots` 2616 |
| A11 | 2801–3053 | `ensureLiveAgent` 2801, `ensureLiveAgentOnce` 2841 | the ONE live-handle ensure (resume, rollback, recovery, one retry) | `liveAgents`, `closing`, `resumingSessions`, `ensureLiveAgentInFlight` |
| A12 | 3054–3188 | `finalInputVerdictOf` 3054 | requirement-aware FINAL-INPUT verdict over MCP materialization failures | `consumptionState`, `domain` |
| A13 | 3189–3323 | `publishAuthorityGeneration` 3226, `refreshAuthorityGeneration` 3260, `prepareAgentForRequest` 3273 | generation publish + per-request boundary | `consumptionState`, `callCounter` |
| A14 | 3324–3805 | `childFactory` 3326, `sessionDurability` 3388, `boot` 3415, `surface` 3615, `sessionInput` 3641, `workDelivery` 3706 | the activation/provider ports + boot | `liveAgents`, `resumingSessions`, `machineInputs`, `bootPromise` |
| A15 | 3806–4355 | `effectiveRootWorkspace` 3833 … `deliverReviewWake` 4293 | Root-agent ports: create, input, context, work, control/completion notices, review wake | `liveAgents`, `closing`, `observations`, `machineInputs` |
| A16 | 4356–4631 | `interrupt` 4356, `disarmStoppedGoal` 4383, `drainDescendants` 4531, `residency` 4573, `resolveCaller` 4603 | lifecycle effects on live handles + caller identity | `liveAgents`, `observations`, `domain` |
| A17 | 4632–4684 | `governanceAuthority` 4642, `dropResidency` 4660 | as-session governance identity; residency drop | `liveAgents`, `consumptionState` |
| A18 | 4685–4744 | `toolRouteError` 4688, `executeTool` 4702 | the harness tool route (execute on the live agent, late admission check) | `callCounter`, `liveAgents` |
| A19 | 4745–4835 | `close` 4756 | row-stop drain of every owned effect | `toolDisposers`, `a5sfRealmDisposers`, `nativeMountDisposers`, `liveAgents`, `consumptionState` |
| A20 | 4836–5042 | `return {` 4836 | the public `TeamAgentBindings` surface (~60 keys) | — |

---

## 3. `root.ts` — cohesive regions

| ID | Lines | Anchor | Responsibility | State touched |
| --- | --- | --- | --- | --- |
| R0 | 1–989 | docblock, imports, `createEphemeralMutationStore` 407, `capabilityValuesOf` 507, `sameSnapshotRef` 599, `handoffContextText` 617, `staticTemplateOf` 647, `TeamProductionRootParams` 666, `isExecutionAskLane` 954, `settlementCallIdOf` 974 | module-level helpers, params type, two exported pure predicates | none |
| R5 | 990–1259 | `createTeamProductionRoot` 990 (destructure `:991`), `boundBlueprintByRoot` 1169, `boundBlueprintFor` 1170, `requireBoundBlueprintStartable` 1213, `boundSnapshot` 1250, `leaderIdentity` 1258 | domain ports, anchor classification, **bound-blueprint cache**, version gate, leader identity | `boundBlueprintByRoot` (own) |
| R6 | 1260–1466 | `environmentFactsForBlueprint` 1341, `externalPolicyFacts` 1464 | fresh-read fact thunks (environment / policy) | `config`, `domain` |
| R7 | 1467–1501 | `prober` 1476, `authority` 1484, `compatibility` 1492 | compatibility prober/authority/work gate | `proberRef` 1474, `authorityRef` 1475 |
| R8 | 1502–1745 | `settledSubstratePlan` 1542, `presetSeam` 1561, `boundPersonaSources` 1647, `promptInstallations` 1690, persona/model/capability slots 1696–1740 | the three overlay slots + substrate plan | 6 bindings (all own) |
| R9 | 1746–1962 | `binder` 1749, `rootBindingPorts` 1756, `enforceCreationPreflight` 1786, `rootBinding` 1927 | TeamAgentBinder + root binding (fresh/cold) | `blueprintCatalog`, `blueprintAuthority` |
| R10 | 1963–2053 | `memberResidencyPorts` 1964, `policyReader` 1989 | member residency ports + the ONE PolicyReader | `domain`, `blueprint` |
| R11 | 2054–2173 | `provider` 2055, `coordination` 2124, `compatibilityByRoot` 2147 | activation provider (sole creation path), per-team lock coordinator, per-root compatibility | `coordination.chains` |
| R12 | 2174–2297 | `admitRootInitialWork` (TCM §15.8), `lifecycleCommit` 2232, `lifecyclePorts` 2250 (`live.closeAdmission`), `lifecycleService` 2296 | root initial-work closure + lifecycle service | `live.*` |
| R13 | 2298–2385 | `runtime` 2334 (`createTeamRuntime`), `workActivity` 2299 | TeamRuntime facade (work chain) | `coordination` |
| R14 | **2386–3200** | `controlRef` 2414, `alpha6Wiring` 2415, `alpha6WakeCoordinators/BySession/Locks` 2513–2522, `withAlpha6WakeLock` 2534, `alpha6DispatchWake` 2539, turn start/end 2607/2615, userStop/Resume 2725/2754, `alpha6RecoverWakeLatches` 2808, `alpha6Router` 3068, `alpha6ReviewEventSink` 3129, `createControlService` 3149 | **control service + Alpha.6 review routing** (815 lines) | `controlRef`, 3 wake maps, `live.*` |
| R15 | 3203–3218 | `messaging` 3204, `activity` 3212 | messaging coordinator + activity ledger | `live.sessionInput`, `runtime` |
| R16 | 3219–3338 | `forkPort` 3220, `forkDescribe` 3238, `fork` 3341 | fork reconciliation | `repos` only (read-only) |
| R17 | 3339–3671 | `startGovernanceGate` 3422, `createAndStartTeam` 3454, `createHandoffTeam` 3519, `handoff` 3615, `handoffRead` 3652 | the ONE create-and-start primitive + handoff service | `blueprint`, `live`, `workspaceAttach` |
| R18 | 3672–3681 | `legacy` 3678 | legacy read-only inspector | — |
| R19 | 3682–4103 | `durableMutation` 3704, `mutation` 3773, `permissionNoticeSource` 3896, `permissionLaneMutate` 4040, `permissionEffectiveWorkspace` 4064, `seams`… | mutation store + governance override + **permission lane + notice emitter** | `permissionOverlay`, `repos`, `coordination` |
| R20 | 4104–4262 | `seams` 4105, `readPortDeps` 4124, `projection` 4220, `liveOverlay` 4256 | projection service + the four S6 install seams | `repos`, `live`, `config` |
| R21 | 4263–4661 | `remoteSurfaces` 4264 (`createS6RemoteSurfaces`) | S6 remote surfaces (dispatcher/registration/principal/completion) | `live` 21, `control`, `projection` |
| R22 | 4662–4696 | `intent` 4665, `tools` 4668 | method catalog + the 15 `team_*` tools | `runtime`, `control` |
| R23 | 4697–4956 | `seedBootWorld` 4716, `boot` 4802 | fixture seed + create/resume boot | `rootSid`, `config`, `live`, `blueprint` |
| R24 | 4957–5051 | `close` 4957, `requirementAuthority` 4979 | row close + production requirement-fact writers | `live`, `repos` |
| R25 | 5052–5109 | `return {` 5052 | the public `TeamProductionRoot` surface (35 keys) | — |

---

## 4. Shared mutable state — the blockers

`agent-bindings.mjs` closure (A3), 20 bindings; `root.ts` factory, 18 bindings. Counts = identifier
occurrences in the current file. **Nothing may capture these in a module closure except the module
named as owner.**

| State | Decl. | Occurrences | Readers (regions) | Owner after cut | Blocks |
| --- | --- | --- | --- | --- | --- |
| `observations` (array) | 684 | 39 (34 `push` sites, 1473–4769) | A7,A9,A10,A11,A14,A15,A16,A19 | **stays in the factory**; extracted modules receive `observe(message)` | everything, if passed by closure |
| `liveAgents` (Map) | 594 | 47 | A11,A14,A15,A16,A17,A18,A19 | M6 `live-residency` | A11/A14/A15/A16/A18 |
| `consumptionState` (Map→object, 13 fields) | 697 | 11 | A6,A7,A9,A11,A12,A13,A17,A19 + public `getConsumptionState`/`recheckMcpServers`/`observeMcpOperationalWitness` | **split**: `consumption` half → A6; `mcp` half → M3 | A6,A7,A12,A13 |
| `closing` (bool) | 668 | 22 | A7,A11,A15,A19 | M6 | A11,A15 |
| `newWorkClosed`, `terminalAtReopen` (2 Maps) | 626/655 | 5/5 | A4 (write), A11, A14 (boot 3599/3603), A18 | M1 `session-identity` | A11,A14,A18 |
| `toolDisposers` (array) | 680 | 10 | write A9, drain A19 | M6 (drain) + `agentSetup` (push) | A9,A19 |
| `a5sfRealmDisposers`, `nativeMountDisposers` | 671/679 | — | write A9/A13, drain A19 | same | A9,A19 |
| `resumingSessions` (Set) | 714 | 10 | A11,A14, public `isResuming` | M6 | A11,A14 |
| `machineInputs` (ledger) | 607 | 5 | A14 work delivery, A15, public `isTeamMachineInput` | M7 `delivery-ports` | A14,A15 |
| `personaDisposers`/`personaPending`/`liveAgentCtxs`/`personaSlot` | 770–773 | 8/…/5 | A9 (write `liveAgentCtxs`), A10, A19 | M5 `persona-surface` | A9,A10 |
| `productionPersonaSlots`/`Inflight` | 2616/2617 | — | A10 | M5 | A10 |
| `boundBlueprintByRoot` | 1872 **and root.ts 1169** | 3 / 4 | A8 / R5 | M4 `template-binding` (one cache, two consumers) | A8 + R5 |
| `activationInFlight`, `ensureLiveAgentInFlight` | 736/738 | 3/3 | A5, A11 | M2 / M6 | A5,A11 |
| `callCounter`, `bootPromise` | 682/702 | 3/2 | A13/A18, A14 | factory (scalar, harmless) | — |
| `config` / `domain` / `agents` | deps | 64/54/20 | everywhere | **injected parameters, never captured** | — |
| root.ts `controlRef` (late-bound) | 2414 | 13 | R14,R21,R22 | T7 `control-plane` (returns the service; factory fills `controlServiceRef`) | R14 |
| root.ts `coordination.chains` | R11 2124 | 14 | R11,R12,R15,R19 | stays in factory (shared per-team lock) | R12,R15,R19 |
| root.ts `alpha6WakeCoordinators/BySession/Locks` | 2513–2522 | — | R14 | T7 | R14 |
| root.ts `boundPersonaSources`/`promptInstallations`/`currentModel`/`facetConfig` | 1647/1690/1701/1739 | — | R8,R9,R20 | T8 (later) | R8 |

**Two blockers make a mechanical 5×1,000-line split worse than the status quo:**

1. **`observations`** is written by 34 sites spread over every region *and* is a **public surface**
   (`packages/tools/harness/plugin.mjs:636` spreads `teamRoot.live.observations`;
   `packages/runtime/test/rc2a1-fs-containment.test.ts:322` reads it). A module that captures the
   array cannot be tested alone; one that receives it can. `member-execution.mjs` already establishes
   the pattern (`input.observe`). Apply it to every remaining module.
2. **`consumptionState`** is one object with three unrelated halves (durable consumption views, MCP
   runtime, mount scope). Until it is split, A6/A7/A12/A13 cannot separate: each needs a different
   subset and each would keep a reference to the whole.

**Extra duplication worth deleting, not moving:** `freshCreateHintAdmits` exists twice
(`agent-bindings.mjs:466` and `live/a5sf-realm-row.mjs:124`); `boundBlueprintByRoot` exists twice
(above); `a5PlaneSubtreeContains` (500) has **no in-file consumer** — only two C1 suites
(`a5w-bindseam-subtree-seam-c1`, `a5w-vseam-pa-verifier-seam-c1`) import it, so it belongs in the
test face, not the production glue.

---

## 5. Proposed modules

| Module | From | Lines out / in | One-sentence responsibility | INPUTS (explicit) | OUTPUTS | OWNS |
| --- | --- | --- | --- | --- | --- | --- |
| `session-identity.mjs` | A4 + state 626/655 | −300 / +230 | Answer "which durable session is this, which team root owns it, and may new work start on it". | `{ domain, bootRootSessionId, sessionPersistence }` | `childSessionIdFor, durableSessionExists, instanceIdForSession, teamRootOfSession, listMemberRows, memberResumeRefusal, admissionCloseRefusal, closeAdmission, reopenAdmission, terminalMarkerOf, clearTerminalMarker` | `newWorkClosed`, `terminalAtReopen` |
| `activation-gate.mjs` | A5 + `singleFlightTeamActivation` | −142 / +120 | The only two `agents.create`/`agents.resume` call sites, single-flighted and fenced. | `{ agents, activationFence, teamOwnedSetup }` | `runOwnedActivation, resumeTeamAgent, createTeamAgent, isSessionWriterHeld` | `activationInFlight` |
| `template-binding.mjs` | A8 | −219 / +160 | Resolve the bound blueprint of a root and the template of a session, fail-closed. | `{ resolveBoundBlueprint, blueprintSource, domain, bootRootSessionId }` | `getBoundBlueprint, boundBlueprintFor, locateTemplate, resolveStaticCapabilities` | `boundBlueprintByRoot` (the **only** one) |
| `mcp-reconciler.mjs` | A7 + mcp half of 697 | −442 / +390 | Materialize/reconcile one session's MCP servers and classify live loss without confusing it with policy. | `{ consumption, mcpClient, observe, now, isClosing }` | `reconcile, observeWitness, recheck, disposeSession, mcpStateOf` | the per-session **MCP** state object (fibers, views, materialization, witness, intentional-removal) |
| `persona-surface.mjs` | A10 | −395 / +330 | Compose the scoped persona section and the machine-readable Team context block for a root/member. | `{ agentPresets, resolvePersonaSubstrate, domain, config, observe }` | `buildPersonaSlot, getPersonaSlot, getProductionPersonaSlot, registerPersonaSection, installPersonaForSetup, personaSurface, rootTeamContextBlock, memberTeamContextBlock` | `personaDisposers`, `personaPending`, `liveAgentCtxs`, `personaSlot`, `productionPersonaSlots`, `productionPersonaInflight` |
| `live-residency.mjs` | A11, A16, A17, A19 drain | −560 / +480 | Own the live AgentHandle map: ensure, drain, interrupt, drop, and dispose everything exactly once. | `{ agents, agentPresets, config, domain, observe, prepare, admission, identity }` | `ensureLiveAgent, prepareAgentForRequest, interrupt, drainDescendants, residency, dropResidency, hasLive, listLive, isResuming, disposeAll` | `liveAgents`, `resumingSessions`, `closing`, `ensureLiveAgentInFlight`, `toolDisposers`/realm/native drains |
| `delivery-ports.mjs` | A14 `sessionInput`/`workDelivery` + A15 | −715 / +620 | Deliver work, context and notices into a target session and read the delivered turn back. | `{ live: residency, machineInputs, domain, observe }` | `sessionInput, workDelivery, createRootAgent, deliverRoot{Input,Context,Work,ControlNotification,WorkCompletionNotification}, deliverReviewWake, reviewWakeInbox` | `machineInputs` |
| `boot.mjs` | A14 `childFactory`/`sessionDurability`/`boot` | −390 / +350 | Create or resume the boot root, then every member, once. | `{ config, domain, sessionPersistence, activation, residency, identity, setup }` | `childFactory, sessionDurability, boot` | `bootPromise` (only) |
| `root-static.ts` | R0 helpers (394–663), R5 pure parts | −270 / +250 | Pure conversion helpers with no root state. | values only | `createEphemeralMutationStore, capabilityValuesOf, staticTemplateOf, sameSnapshotRef, handoffContextText` | none |
| `fork-describe.ts` | R16 | −120 / +100 | Read-only fork reconciliation state from the domain repositories. | `{ repos }` | `forkDescribe` (+ its types) | none |
| `projection-wiring.ts` | R20 | −159 / +140 | Projection service + the four S6 seams, installed once. | `{ repos, live, config, now, blueprint }` | `projection, seams, liveOverlay` | `seams` (install-once) |
| `permission-lane.ts` | R19 | −422 / +380 | One governance mutation authority + the permission lane + the post-commit notice emitter. | `{ domain, repos, control, live, permissionOverlay, coordination, now }` | `mutation, permissionPlane, permissionNoticeEmitter` | the durable-mutation cache |
| `remote-surfaces.ts` | R21 | −399 / +340 | Build and install the S6 remote surfaces once. | `{ runtime, domain, live, control, projection, config, seams, now }` | `remoteSurfaces` | none |
| `handoff-wiring.ts` | R17 | −333 / +290 | The ONE create-and-start primitive, governance start gate and handoff service. | `{ blueprint, live, workspaceAttach, getSessionQuery, blueprintAuthority, now }` | `createAndStartTeam, createHandoffTeam, handoff, handoffRead, startGovernanceGate` | none |
| `control-plane.ts` | R14 | −815 / +720 | Construct the control service, and in Alpha.6 mode its review-routing ports and wake latches. | `{ domain, catalog, externalPolicyFacts, live, config, now, coordination }` | `control`, `alpha6: { turnStart, turnEnd, recoverLatches, userStop, userResume }` | `controlRef`, 3 wake maps |

---

## 6. Migration sequence

Order rule: **leaves first, then one-map owners, then the registry, then the orchestrators.** A step
may start only when the state it consumes is already owned by a module or injected as a parameter.

### Lane A — `agent-bindings.mjs` (plain JS: no tsc, highest risk per line)

| # | Module | Source | Diff (est.) | Interface introduced | Must stay green | Risk | Reversal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **S1** | `session-identity.mjs` | A4 + state 626/655 | +230 new, −300 glue, +6 placement, +230 dist | `createSessionIdentity({domain, bootRootSessionId, sessionPersistence})` | `a5sf-pd20-admission-close.test.ts`, `t12a-b2-child-identity.test.ts`, `bp1-dual-team-gate.test.ts`, `d3-member-identity-context.test.ts`, evidence suite `a5sf-boot-seam/boot-seam-arms.test.mjs` | boot reads the terminal marker directly (`3599/3603`); must become `terminalMarkerOf`/`clearTerminalMarker` or the marker leaks | one commit; the returned surface keeps the same 9 names/arities → `git revert` is behavior-identical |
| **S2** | `activation-gate.mjs` | A5 + 750 | +120, −142 | `createActivationGate({agents, activationFence, teamOwnedSetup})` | `d2-s6-ensure-root-live.test.ts`, `a4p7-v3-cutover-acceptance.test.ts`, `t12a-live-bridge.mjs` consumers | `teamOwnedSetup` takes the exact-generation claim; a stale closure claim is a silent security regression | pure move; revert |
| **S3** | `template-binding.mjs` | A8 | +160, −219 | `createTemplateBinding(...)` → 4 fns | `bound-blueprint-persona-root.test.ts`, `a4p6-start-gate-entrances.test.ts`, `issue2-real-preset-restriction.test.ts` | the hint gate (`bindPath === 'fresh-member'`) must move verbatim; a loosened gate admits a cold session's template | pure move; revert |
| **S3b** | (root.ts) consume it | R5 1169–1223 | −12 root | add `boundBlueprintFor` to `TeamAgentBindings` (`plugin/types.ts:1249`) | `a4f1-row-version-not-document-version.test.ts` | two caches drift unless root *deletes* its Map in the same commit | revert restores both caches |
| **S4** | `mcp-reconciler.mjs` | A7 + `state.mcp` | +390, −442 | `createMcpReconciler({consumption, observe, isClosing})` | `multi-mcp-wiring.test.ts`, `mcp-live-readiness-to-requirement-fact.test.ts`, `mcp-blueprint-initial-grant.test.ts`, evidence `fix-mcp-target-materialization` | **the only data-shape change**: `consumptionState` entry becomes `{ consumption, mcp }`; a missed reader silently sees `undefined` | keep `getConsumptionState` returning the flattened view until S5; then revert in one step |
| **S5** | `persona-surface.mjs` | A10 | +330, −395 | `createPersonaSurface({agentPresets, resolvePersonaSubstrate, domain, observe})` | `bound-blueprint-persona-root.test.ts`, `persona-kind-provider-preflight.test.ts` | A9 writes `liveAgentCtxs` during capture — must go through `persona.captureCtx()` | pure move; revert |
| **S6** | `live-residency.mjs` | A11+A16+A17+drain | +480, −560 | `createLiveResidency({agents, admission, template, persona, observe})` | `d2-s6-ensure-root-live`, `p7t1-cold-resume`, `a5sf-pd20-admission-close`, `boot-seam-arms` | the `closing` asymmetry (comment 668: only ensureLiveAgent + completion delivery are gated) must be preserved, not "fixed" | pure move; revert |
| **S7** | `delivery-ports.mjs` | A14 ports + A15 | +620, −715 | `createDeliveryPorts({residency, machineInputs, domain, observe})` | `p8s3b-result-effects`, `a4p7-live-descendant-authority`, review-wake + work-completion suites | `workDelivery` awaits `whenIdle` while `sessionInput` must NOT — a merged await hangs the Leader | pure move; revert |
| **S8** | `boot.mjs` | A14 create/resume | +350, −390 | `createBoot({identity, activation, residency, workspace, setup})` | `p8s5a-production-assembly`, `d2-s6-ensure-root-live`, `boot-seam-arms` | boot is the only writer that also must NOT be; ordering vs `resumingSessions` is observable | pure move; revert |

After S1–S8 the glue retains: A0–A3 (deps + state), A6 consumption reads (until S4 intro), A9
`agentSetup`, A12, A13, A18, A19, A20 → **≈1,450 lines**.

### Lane B — `root.ts` (TypeScript; tsc emits, so **no dist-placement entry needed**)

| # | Module | Source | Diff (est.) | Interface | Must stay green | Risk | Reversal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **T1** | `root-static.ts` | helpers 394–663 | +250, −270 | named exports, values only | `p8s5a-production-assembly.test.ts` | `createEphemeralMutationStore` is a *documented boot-world* store; moving it must not change its closed lane set | pure move |
| **T2** | `fork-describe.ts` | R16 | +100, −120 | `describeFork(repos)` | `a4p7-v8-catalog-migration-state.test.ts` (describe states) | read-only; lowest risk in the file | pure move |
| **T3** | `projection-wiring.ts` | R20 | +140, −159 | `{projection, seams, liveOverlay}` | `a3p5-permission-read-wiring.test.ts` | the four seams are install-once; a second install must throw | pure move |
| **T4** | `permission-lane.ts` | R19 | +380, −422 | `{mutation, permissionPlane, noticeEmitter}` | `a3p4-production-permission-plane.test.ts`, `a3p5-permission-splice.test.ts`, `a4f1-*` | the `lateBoundPermissionMutationApprovalPort` must stay late-bound | pure move |
| **T5** | `remote-surfaces.ts` | R21 | +340, −399 | `createRemoteSurfaces(...)` | `a3p4-pr4-production-entry-regression.test.ts`, `a3p4-pr4-decision-routing-regression.test.ts`, `d2-s6-ensure-root-live` | the dispatcher is also returned on the root surface (`remoteDispatcher`) — keep identity, not a copy | pure move |
| **T6** | `handoff-wiring.ts` | R17 | +290, −333 | `{createAndStartTeam, createHandoffTeam, handoff, handoffRead}` | handoff + `a4p6-start-gate-entrances` | the freeze-before-put order (BP6) is the law; do not reorder | pure move |
| **T7** | `control-plane.ts` | R14 | +720, −815 | `{control, alpha6:{...}}` | `a6-root-wiring.test.ts`, `a3p5-glue-permission-receipt.test.ts`, `a4p7-ceiling-port-assembly-pin` | 6 of the 35 returned keys come from here (`alpha6TurnLatchStart/End`, `recoverWakeLatches`, `userStop`, `userResume`) + `controlServiceRef` fill | pure move; the object shape stays |
| **T8** | `boot.ts` | R23 | +230, −259 | `boot({...})` | `p8s5a-production-assembly`, boot-world kits | fixture seed vs real create are two paths in one function | pure move |

After T1–T8 the root factory retains ≈1,500 lines of assembly (R5–R13, R15, R18, R22, R24, R25).

**Parallelism:** Lane A touches `agent-bindings.mjs`, `scripts/dist-placements/240-ute-vnext-centre.json`,
`packages/runtime/src/plugin/types.ts` (S3b only) and the dist mirror. Lane B touches `root.ts` + new
`.ts` files. Only `types.ts` is shared — S3b owns it, and Lane B must not edit it in the same window.
One writer per file, one worktree, as the execution protocol requires.

---

## 7. Risk list specific to the first three steps

| Step | Concrete failure mode | Mitigation |
| --- | --- | --- |
| S1 | The boot publish seam (`boot` 3599–3603) reads `terminalAtReopen.has(child)` then decides whether to do one durable read. If it is rewritten as "always read", the boot budget law (one member-set enumeration + at most one sweep) silently doubles I/O. | Expose `terminalMarkerOf(child)` (sync, `undefined` when absent) and keep the call site shape identical; the evidence suite `boot-seam-arms.test.mjs` counts reads. |
| S1 | `reopenAdmission` currently returns `newWorkClosed.delete(child)` (boolean) and is used as a lifecycle-port result. | Keep the return value in the module's signature; `root.ts:2252/2255` calls `live.closeAdmission/reopenAdmission` unchanged. |
| S2 | `teamOwnedSetup` closes over the *generation claim* for one activation. If the module is constructed once per row and the claim is captured at construction, every activation after the first is refused (or worse, admitted on a stale generation). | Construct per call: `createActivationGate(deps)` returns functions that take `(setup)` per activation — never cache the claim. |
| S3 | `locateTemplate`'s `templateIdHint` is gated on `freshCreateHintAdmits(bindPath)`; the duplicate definition in `a5sf-realm-row.mjs:124` may already differ. | Diff the two bodies before the move; S3 must import the glue's copy and a follow-up deletes the realm-row one. |

**Reversibility rule for every step:** the module is introduced *and* the call sites are rewired in
one commit, and the returned public surface keeps the same names/arities. No step may be split into
"add module" + "use module" commits — a half-landed extraction leaves two authorities.

---

## 8. What must NOT be extracted yet

| Thing | Why | Do instead |
| --- | --- | --- |
| `agentSetup` (A9, 2054–2405, 352 lines) | It is the only writer of 7 state maps and the only reader of `controlServiceRef`/`teamToolsRef`; moving it moves the whole composition, not one responsibility. | **Decompose in place** into 4 named inner functions (state build 2054–2153 · realm/centre call 2178–2225 · tools/skills 2226–2357 · persona+MCP baseline 2358–2405), each with an explicit argument list; move them out only after S1/S3/S4/S5 have owners. |
| `consumptionState` (A3/A6) | 13 fields, three unrelated halves, 11 access sites + 3 public accessors. | S4 splits the MCP half out; only then can the consumption half move. |
| `boot()` (3415) and `close()` (4756) | They orchestrate every other region; extracting them first re-creates the shared-state problem one level up. | Last (S8 / after S6). |
| `finalInputVerdictOf` (A12) + `prepareAgentForRequest` (A13) | Both read the MCP materialization map *and* the bound blueprint; they need S3 + S4 done. | Keep until S4 lands. |
| `enforceCreationPreflight` (root 1786–1925) + `rootBinding` (1927) | Ties blueprint freeze, provider, and environment facts together; a wrong cut here is a start-path security gate. | After T1/T2, with the blueprint cache already single-owned. |
| Alpha.6 inside R14 | It owns 6 of the root's 35 returned keys and its own durable decision store; splitting it in the same step as the control service doubles the interface churn. | T7 returns `alpha6: {...}` as a sub-object; a later step lifts it whole. |
| `a5sf-realm-row.mjs` as a unit | See §9. | Split by consumer face, delete nothing in this round. |
| Any new `.test.mjs` suite | An uncollected suite is refused by `scripts/test-catalog.mjs` (`UNCOLLECTED_NEW`, ratchet = 41) and requires a leg + workflow edit. | Prove each pure move with the **existing** suites; add a suite only where an interface is genuinely new (currently: none). |

---

## 9. `a5sf-realm-row.mjs` (1,847 lines) — verdict

**It is a retained Provider/Realm service, but only half of it is production.** The production face is
the four exports the glue imports (`agent-bindings.mjs:364`): `a5sfRealmConfigOf` (397–807, config
normalization), `mountMemberA5sfRealm` (859–1196), `compiledAnswerOfRealm` (393),
`createA5sfRealmRowDisposer` (1817–1847).

The rest has **no production consumer**: `attachA5sfNativeToolModules` (1197–1388) — superseded by
`realm-lane.mjs`'s `mountHostModules` (the glue now reaches it through `member-execution.mjs:28`);
`a5sfBindableRealmNames` (1439–1816), `a5sfAttachedToolNames` (1389–1438), `a5sfAgentToolSurface`
(808–858), `a5sfToolPlaneOf` (315–392) — imported only by `tests/world-factory/*` and one CI leg.
`team-services/src/mount.ts:1258` mentions `attachA5sfNativeToolModules` in a comment only.

Action (S9 — lane A, after S3):
1. Move the production four into `realm-service.mjs` (≈840 lines) and repoint the glue import.
2. Move the route-C/test face into `route-c/realm-route-c.mjs` (or `packages/testkit`) behind a banner
   that says "no production consumer; the production native mount is `realm-lane.mjs`", and update the
   world-factory import paths in the same commit.
3. Do **not** add the moved test face to `scripts/dist-placements/240-*.json` — it must not ship.

---

## 10. Mechanical gates every step must pass

| Gate | Command | Catches |
| --- | --- | --- |
| dist placement | `node scripts/ute-cut-closure.mjs --check` | `UTE_CLOSURE_DIST_PLACEMENT_MISSING`, `UTE_CLOSURE_GLUE_PATH` (a new `.mjs` with no placement makes the **built product** unloadable while every source test stays green) |
| mirror drift | `node scripts/check-artifacts-committed.mjs` | gate D: src vs dist byte-identity for every placement |
| build | `pnpm --filter @dsh-agent-team/runtime build` then `node scripts/place-dist-glue.mjs` | tsc emit + glue copy |
| root suites | `pnpm vitest run packages/runtime/test/<name>.test.ts` | the collected population (`packages/*/test/**/*.test.ts`) |
| pinned-host suites | `A5SF_REQUIRE_PINNED_HOST=1 node --test packages/runtime/test/vnext-{admission,fs-slice,realm-lane,os-probe}.test.mjs` | the centre's own arms (CI leg `ute-vnext-a1`) |
| evidence suite | `pnpm vitest -c dev/agent-workflow/evidence/a5sf-boot-seam/boot-seam-vitest.config.mjs` | boot-race properties **not in the root population** |
| catalog | `node scripts/test-catalog.mjs` | `UNCOLLECTED_NEW` (ratchet 41) |

A step is done only when the gate set above is green, `git diff --stat` shows one new file + one
editing file (+ generated mirror), and no call site was left with a stale comment naming the old
location (the `a5PlaneSubtreeContains` block at 488–515 is a live example of that debt).

---

## Progress against this plan (append-only)

| Step | Commit | What | Glue lines | Evidence |
| --- | --- | --- | --- | --- |
| pre-S1 | `f90a9af90` | `work-turn-reader.mjs` extracted | 5,301 → 5,102 | `vnext-work-turn-reader.test.mjs` (7 arms) |
| pre-S1 | `4fd8f8e75` | `member-execution.mjs` extracted | 5,102 → 5,042 | ADM-35 |
| **S1** | `9ff09a771` | **`session-identity.mjs`**: A4's nine functions + the two maps they answer from (`newWorkClosed`, `terminalAtReopen`), boot marker via `terminalMarkerOf`/`clearTerminalMarker` | 5,042 → **4,767** | ADM-36 (component-level) |
| dup | `740dc7cba` | `freshCreateHintAdmits` de-duplicated (glue's copy claimed it had moved; it had not) | 4,767 → 4,769 | leg green |
| S1 acceptance | unrun | the plan's four pinned vitest suites (`a5sf-pd20-admission-close`, `t12a-b2-child-identity`, `bp1-dual-team-gate`, `d3-member-identity-context`) cannot run in this worktree (no vitest) | — | **not verified** |
