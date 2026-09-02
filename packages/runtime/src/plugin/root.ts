/**
 * P8-S5A — the production root assembly (plan §19.1, A01–A29 + the four
 * S6 installation seams A30–A34; plan §19.2: the harness MOUNTS the
 * production plugin and consumes `teamRoot` — it never builds a parallel
 * backend graph).
 *
 * This is the SINGLE assembly point of the shipped production plugin
 * (frozen invariant: "production root = single assembly point, harness =
 * consumer"). Every node of the §19.1 list is constructed here through
 * its canonical factory with the root-owned ports:
 *
 * | plan | node                                    | factory / source                              |
 * | ---- | --------------------------------------- | --------------------------------------------- |
 * | A02  | TeamDomain (open)                       | `createTeamDomain` / `openTeamDomain` (host)  |
 * | A03  | blueprint catalog                       | `createBlueprintCatalog([parseBlueprint(...)])` |
 * | A04  | intent surface                          | `REMOTE_METHOD_CATALOG` (remote contracts)    |
 * | A05  | root binding (fresh)                    | `bindFreshTeamRoot`                           |
 * | A06  | root binding (cold)                     | `rehydrateColdTeamRoot`                       |
 * | A07  | leader identity                         | `leaderMemberIdentityOf` (contracts)          |
 * | A08  | member residency (fresh)                | `createFreshMember`                           |
 * | A09  | member residency (cold)                 | `rehydrateColdMember`                         |
 * | A10  | TeamAgentBinder (3 slots, default guard)| `new TeamAgentBinder`                         |
 * | A11  | persona slot                            | `createPersonaOverlaySlot`                    |
 * | A12  | model slot                              | `TeamModelOverlaySlot` + ratchet source       |
 * | A13  | capability slot                         | `createCapabilityOverlaySlot`                 |
 * | A14  | compatibility prober                    | `createCompatibilityProber`                   |
 * | A15  | compatibility authority + work gate     | `createCompatibilityAuthority` + `enforceCompatibilityGate` |
 * | A16  | activation provider (sole creation)     | `createActivationProvider`                    |
 * | A17  | TeamRuntime facade                      | `createTeamRuntime`                           |
 * | A18  | work delivery                           | `live.workDelivery` (the P8-S3 chain)         |
 * | A19  | work settlement                         | `live.workDelivery` (settleAdmittedWork owner)|
 * | A20  | lifecycle service                       | `createLifecycleService`                      |
 * | A21  | lifecycle commit port                   | `memberInstances.commitTransition`            |
 * | A22  | mutation service                        | `new MutationService`                         |
 * | A23  | governance override admission           | `admitGovernanceOverride` (+ durable resolvers) |
 * | A24  | messaging coordinator                   | `createMessagingCoordinator`                  |
 * | A25  | control service                         | `createControlService`                        |
 * | A26  | activity ledger                         | `createActivityLedger` (+ work-activity writer) |
 * | A27  | fork reconciliation                     | `reconcileForkSidecar` + `createTeamDomainForkPort` |
 * | A28  | handoff service                         | `createHandoffService` (fail-closed ports)    |
 * | A29  | legacy reader                           | `legacyInspect` (frozen reader, entry-loaded) |
 * | A30  | projection + S6 overlay seam            | `createProjectionService` + fail-closed proxy |
 * | A31  | remote handler registration seam        | install seam (S6)                             |
 * | A32  | server principal derivation seam        | install seam (S6)                             |
 * | A34  | remote query/command completion seam    | install seam (S6)                             |
 *
 * Boot-world decisions (documented in the S5A result):
 *
 * - **Boot seeds are deterministic puts performed by the production root**
 *   (create phase), replicating the exact seed rows of the frozen scenario
 *   contract (worker/scout `RUNNING` activityVersion 1; the leader as a
 *   plain v1 member row with childSessionId = the root session). The
 *   production fresh paths (`bindFreshTeamRoot` mints a v2 LeaderInstance;
 *   `createFreshMember` writes `CREATED` activityVersion 1) cannot
 *   reproduce that frozen state — the fresh/cold paths remain fully
 *   assembled and reachable (T1-proven) but are dormant in the boot flow.
 * - **Capability facet seams are honestly empty** in the boot world
 *   (every facet `available: false`; the slot resolves fail-closed and
 *   records the reason — there are no G2-proven facet seams in the static
 *   test world).
 * - **The handoff service ports are fail-closed** (the S5A boot world
 *   exposes no DSH public session read surface, no host summarizer, and
 *   no new-team creation entry; the frozen scenarios never perform a
 *   handoff).
 * - **The A22 mutation service carries an ephemeral store**: the durable
 *   backend for mutation records is not part of the frozen S5A seam set;
 *   the frozen world's mutation consumption flows through
 *   `admitGovernanceOverride` (durable `overrides` repository) and the
 *   durable consumption resolvers.
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected live-agent glue bundle).
 * @module @dsh-agent-team/runtime/plugin/root
 */

import {
  createBlueprintCatalog,
  parseBlueprint,
} from '../../../domain/blueprint/src/index.js'
import type { BlueprintTemplate, TeamBlueprint } from '../../../domain/blueprint/src/index.js'
import { DEFAULT_CONTEXT_POLICY, isContextPolicy } from '../../../domain/member/src/index.js'
import type { EnvironmentFact } from '../../../domain/compatibility/src/index.js'
import {
  CAPABILITY_NAME_VALUES,
} from '../../../domain/policy/src/index.js'
import type {
  CapabilityName,
  ExternalPolicyFacts,
  PolicyEntry,
} from '../../../domain/policy/src/index.js'
import {
  createBlueprintSnapshotRef,
  LEADER_INSTANCE_ID,
  leaderMemberIdentityOf,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
} from '../../../contracts/src/index.js'
import type {
  EffectiveConfigDtoV2,
  MemberIdentity,
  MemberModelStateDto,
  TeamSessionId,
} from '../../../contracts/src/index.js'
import type { TeamSessionRecordInput } from '../../../contracts/src/index.js'
import type { MemberInstanceRecordInput } from '../../../contracts/src/index.js'
import {
  REMOTE_METHOD_CATALOG,
} from '../../../remote/src/contracts/catalog.js'
import {
  createTeamDomainWritePort,
  bindFreshTeamRoot,
  rehydrateColdTeamRoot,
} from '../../root-binding/index.js'
import type {
  ColdRootBindingInput,
  FreshRootBindingInput,
  RootBindingResult,
} from '../../root-binding/index.js'
import {
  createFreshMember,
  createMemberDomainWritePort,
  rehydrateColdMember,
} from '../../member-residency/index.js'
import type {
  ColdMemberResult,
  FreshMemberResult,
  MemberCreateSpec,
  MemberIdentityInput,
} from '../../member-residency/index.js'
import {
  TeamAgentBinder,
  createTeamDomainReadHandle,
} from '../../agent-setup/binder/index.js'
import type { OverlaySlot, OverlaySlotName } from '../../agent-setup/binder/index.js'
import { createPersonaOverlaySlot } from '../../agent-setup/persona/index.js'
import type {
  AgentPresetSeam,
  ScopedPersonaIdentity,
  ScopedPersonaPromptSurface,
  TeamBlueprintPersonaSource,
} from '../../agent-setup/persona/index.js'
import {
  TeamModelOverlaySlot,
  TeamModelSelectionAdapter,
  resolveDurableModelSelection,
} from '../../agent-setup/model/index.js'
import type { ModelSelection, ModelSelectionSource } from '../../agent-setup/model/index.js'
import {
  CAPABILITY_FACETS,
  createCapabilityOverlaySlot,
  resolveDurableMcpFacet,
} from '../../agent-setup/capability/index.js'
import type {
  CapabilityFacetConfig,
  CapabilityFacetSeam,
  CapabilityFacetSources,
  CapabilityOverlayConfig,
} from '../../agent-setup/capability/index.js'
import { createActivationProvider } from '../../activation/index.js'
import { enforceCompatibilityGate } from '../../admission/index.js'
import type { LifecycleCommitPort } from '../../admission/index.js'
import { createTeamRuntime } from '../../action-router/index.js'
import { createTeamOperationCoordinator } from '../../coordination/index.js'
import { createLifecycleService } from '../../lifecycle/index.js'
import type { LifecyclePorts } from '../../lifecycle/index.js'
import {
  PROBE_TRIGGERS,
  createCompatibilityAuthority,
  createCompatibilityProber,
} from '../../compatibility/index.js'
import { createControlService } from '../../control/index.js'
import { createMessagingCoordinator } from '../../messaging/index.js'
import {
  createActivityLedger,
  createWorkActivityWriter,
} from '../../activity/index.js'
import {
  createTeamDomainForkPort,
  reconcileForkSidecar,
} from '../../fork-reconciliation/index.js'
import type {
  ForkReconciliationInput,
  ForkReconciliationResult,
} from '../../fork-reconciliation/index.js'
import { createHandoffService } from '../../handoff/index.js'
import type { LegacyHomePort, LegacyInspectFn } from './legacy-surface.js'
import { createProjectionService } from '../../projection/index.js'
import type { ProjectionService } from '../../projection/index.js'
import { createTeamTools } from '../../../tools/src/index.js'
import type { TeamToolSet } from '../../../tools/src/index.js'
import {
  MutationService,
  admitGovernanceOverride,
} from '../../mutation/index.js'
import type {
  AdmittedGovernanceOverride,
  AdmitGovernanceOverrideArgs,
  OverrideRecordView,
  OverrideStorePort,
} from '../../mutation/index.js'
import type {
  CreationFieldRecord,
  MutationLedgerEntry,
  MutationStore,
  PolicyReader,
  PolicyStateTransitionRecord,
  StoredMutationRecord,
  SuppressionRecord,
} from '../../mutation/types.js'
import type { TeamDomain, TeamDomainRepositories } from '../../../storage/repositories/index.js'
import type { StorageDomainSeam } from '../../../storage/schema/index.js'
import {
  createFailClosedOverlayProxy,
  createProjectionLiveOverlaySeam,
  createRemoteHandlerRegistrationSeam,
  createRemoteQueryCommandCompletionSeam,
  createServerPrincipalDerivationSeam,
} from './seams.js'
import { createTeamDomainReadPort } from './projection-source.js'
import { createEffectiveConfigView } from './effective-config-view.js'
import { createModelStateView } from './model-state-view.js'
import type { TeamDomainReadPortDeps } from './projection-source.js'
import { createDurableMutationStore } from './durable-mutation-store.js'
import { activePolicyState } from '../../policy-adapter.js'
import { createLiveResidencyOverlay } from './s6-live-overlay.js'
import { createServerPrincipalDerivation } from './s6-principal.js'
import { createS6RemoteSurfaces } from './s6-remote.js'
import type { DurableTemplateRow } from '../../projection/index.js'
import type { RemoteSafeRecord } from '../../../remote/src/contracts/remote-safe.js'
import type {
  TeamAgentBindings,
  TeamPluginConfig,
  TeamProductionRoot,
} from './types.js'
import { TEAM_PLUGIN_ERROR_CODES, TeamPluginError } from './types.js'

// --- the ephemeral mutation store (documented boot-world wiring) -------------------

/**
 * The ephemeral {@link MutationStore} of the S5A production root.
 *
 * The durable backend for A22 mutation records is not part of the frozen
 * S5A seam set (the vNext storage model carries no mutation-record table;
 * the durable mutation surface of the frozen world is the `overrides`
 * repository through A23 + the TeamSession/MemberInstance records). The
 * service itself is fully assembled and reachable; its store is
 * process-local by documented wiring (the frozen scenarios never perform
 * capability mutations through this service).
 */
function createEphemeralMutationStore(): MutationStore {
  const transitionsByTeam = new Map<string, PolicyStateTransitionRecord[]>()
  const recordsByTeam = new Map<string, StoredMutationRecord[]>()
  const creationFieldsByTeam = new Map<string, Map<string, CreationFieldRecord>>()
  const workspacesByTeam = new Map<string, Map<string, string>>()
  const runningKeys = new Set<string>()
  const ledgerByTeam = new Map<string, MutationLedgerEntry[]>()
  const suppressionsByTeam = new Map<string, SuppressionRecord[]>()
  const teamKey = (teamSessionId: string): string => teamSessionId
  const memberKey = (teamSessionId: string, instanceId: string): string =>
    `${teamSessionId}::${instanceId}`

  return {
    listTransitions(teamSessionId) {
      return transitionsByTeam.get(teamKey(String(teamSessionId))) ?? []
    },
    appendTransition(teamSessionId, transition) {
      const team = teamKey(String(teamSessionId))
      const list = transitionsByTeam.get(team) ?? []
      list.push(transition)
      transitionsByTeam.set(team, list)
    },
    listRecords(teamSessionId) {
      return recordsByTeam.get(teamKey(String(teamSessionId))) ?? []
    },
    appendRecord(teamSessionId, record) {
      const team = teamKey(String(teamSessionId))
      const list = recordsByTeam.get(team) ?? []
      list.push(record)
      recordsByTeam.set(team, list)
    },
    getCreationFields(teamSessionId, instanceId) {
      return creationFieldsByTeam
        .get(teamKey(String(teamSessionId)))
        ?.get(String(instanceId))
    },
    registerCreationFields(teamSessionId, member, fields) {
      const team = teamKey(String(teamSessionId))
      const byInstance = creationFieldsByTeam.get(team) ?? new Map<string, CreationFieldRecord>()
      byInstance.set(String(member.instanceId), {
        instanceId: String(member.instanceId),
        workspace: fields.workspace,
        contextPolicy: fields.contextPolicy,
        running: false,
      })
      creationFieldsByTeam.set(team, byInstance)
    },
    setWorkspace(teamSessionId, instanceId, workspace) {
      const team = teamKey(String(teamSessionId))
      const byInstance = workspacesByTeam.get(team) ?? new Map<string, string>()
      byInstance.set(String(instanceId), workspace)
      workspacesByTeam.set(team, byInstance)
    },
    isRunning(teamSessionId, instanceId) {
      return runningKeys.has(memberKey(String(teamSessionId), String(instanceId)))
    },
    markRunning(teamSessionId, instanceId) {
      runningKeys.add(memberKey(String(teamSessionId), String(instanceId)))
    },
    listInstances(teamSessionId) {
      const byInstance = creationFieldsByTeam.get(teamKey(String(teamSessionId)))
      return byInstance === undefined ? [] : [...byInstance.keys()]
    },
    listLedger(teamSessionId) {
      return ledgerByTeam.get(teamKey(String(teamSessionId))) ?? []
    },
    appendLedger(teamSessionId, entry) {
      const team = teamKey(String(teamSessionId))
      const list = ledgerByTeam.get(team) ?? []
      list.push(entry)
      ledgerByTeam.set(team, list)
    },
    listSuppressions(teamSessionId) {
      return suppressionsByTeam.get(teamKey(String(teamSessionId))) ?? []
    },
    appendSuppression(teamSessionId, record) {
      const team = teamKey(String(teamSessionId))
      const list = suppressionsByTeam.get(team) ?? []
      list.push(record)
      suppressionsByTeam.set(team, list)
    },
  }
}

// --- the blueprint capability-policy mapping ----------------------------------------

/**
 * Map the bound blueprint's closed capability policy (domain →
 * allow/deny decision) into the frozen policy-reader's per-capability
 * value map. Only an explicit `deny` decision is expressible losslessly:
 * the frozen resolver input VALIDATION rejects an itemless `allow`
 * ("'allow' items must be a non-empty array") and a blueprint `allow`
 * decision carries no item list to fill it with, so `allow` decisions are
 * dropped as unspecified. The drop is observationally identical at every
 * consumer: the envelope computation maps absent / empty-allow / deny all
 * to the empty item set, stage 2 fails an unspecified item capability
 * closed, and the model consumer keeps the baseline for an unspecified
 * model cell. Keys that are not closed capability names are skipped (the
 * decision map is closed by contract).
 */
function capabilityValuesOf(
  policy: Readonly<Record<string, 'allow' | 'deny'>> | undefined,
): Partial<Record<CapabilityName, PolicyEntry>> | undefined {
  if (policy === undefined) return undefined
  const values: Partial<Record<CapabilityName, PolicyEntry>> = {}
  for (const capabilityName of CAPABILITY_NAME_VALUES) {
    if (policy[capabilityName] === 'deny') {
      values[capabilityName] = { kind: 'deny' }
    }
  }
  return values
}

// --- the root factory ----------------------------------------------------------------

/** The construction inputs of the production root (all injected). */
export interface TeamProductionRootParams {
  /** The validated row config (the root's input channel). */
  readonly config: TeamPluginConfig
  /** The open TeamDomain (A02; the host entry created it). */
  readonly domain: TeamDomain
  /** The storage seam the domain was opened through (diagnostics). */
  readonly storageSeam: StorageDomainSeam
  /** The live-agent glue bundle (the DSH-facing side of the root). */
  readonly live: TeamAgentBindings
  /** The deterministic clock (ISO-8601). */
  readonly now: () => string
  /**
   * The shared tool-stack reference (the glue's setup callback reads
   * `teamToolsRef.current` at agent create/resume time; the root fills it
   * during construction, the entry calls `boot()` only after).
   */
  readonly teamToolsRef: { current: TeamToolSet | undefined }
  /**
   * The frozen legacy reader's operational entry (A29) — the production
   * entry loads `inspectLegacyTeam` from the separately compiled legacy
   * dist and passes it here (the root never imports the legacy sources;
   * see ./legacy-surface.js for the type contract).
   */
  readonly legacyInspect: LegacyInspectFn
  /**
   * The read-only legacy-home port for the A31 `legacy.inspect` remote
   * method — ABSENT in the S5A boot world (the method then fails closed
   * with `TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE`); the host entry injects it
   * when a legacy DSH home is bound (see ./legacy-surface.js).
   */
  readonly legacyHome?: LegacyHomePort
}

/**
 * Assemble the complete production root (A01–A29 + the four S6 seams).
 *
 * Construction is side-effect free beyond the factory wiring (no agents,
 * no durable writes): the boot phase effects run in {@link
 * TeamProductionRoot.boot} and the close in {@link
 * TeamProductionRoot.close}.
 *
 * @param params - the injected root inputs.
 * @returns the complete {@link TeamProductionRoot} surface.
 */
export function createTeamProductionRoot(params: TeamProductionRootParams): TeamProductionRoot {
  const { config, domain, storageSeam, live, now, teamToolsRef, legacyInspect } = params
  const repos: TeamDomainRepositories = domain.repositories
  const rootSid: string = config.rootSessionId

  // --- A02 handle / write ports ------------------------------------------------------
  const readHandle = createTeamDomainReadHandle(repos)
  const rootWritePort = createTeamDomainWritePort(repos)
  const memberWritePort = createMemberDomainWritePort(repos)

  // --- A03 blueprint + catalog ---------------------------------------------------------
  const blueprint: TeamBlueprint = parseBlueprint(config.blueprintSource)
  const catalog = createBlueprintCatalog([blueprint])

  // --- A07 leader identity -------------------------------------------------------------
  const leaderIdentity: MemberIdentity = leaderMemberIdentityOf(rootSid as TeamSessionId)

  // --- the fresh-read fact thunks (the config carries the boot-world facts) -----------
  const environmentFacts = async (): Promise<readonly EnvironmentFact[]> =>
    config.environmentFacts.map((fact) => ({
      domain: fact.domain as EnvironmentFact['domain'],
      subject: fact.subject,
      available: fact.available,
      generation: fact.generation,
    }))
  const externalPolicyFacts = async (): Promise<ExternalPolicyFacts> =>
    config.externalPolicyFacts as unknown as ExternalPolicyFacts

  // --- A14 + A15 compatibility prober / authority / work gate --------------------------
  const prober = createCompatibilityProber({
    repositories: repos,
    rootSessionId: rootSid,
    blueprint,
    environmentFacts,
    now,
  })
  const authority = createCompatibilityAuthority({
    repositories: repos,
    rootSessionId: rootSid,
    blueprint,
    environmentFacts,
    now,
  })
  const compatibility = {
    prober,
    authority,
    enforceGate: enforceCompatibilityGate,
  }

  // --- A11 + A12 + A13 the three overlay slots ------------------------------------------
  // The preset seam reports the production plugin's own substrate facts
  // (the S5A boot world has no standing DSH preset persona; 'standard' is
  // the composable non-complete case the persona engine composes with).
  const presetSeam: AgentPresetSeam = {
    getSubstrate: () => ({ presetId: 'dsh-agent-team', personaKind: 'standard' }),
  }
  const personaSource: TeamBlueprintPersonaSource = {
    getLeaderPersona: () => blueprint.leader.persona,
    getMemberPersona: (_rootSessionId, templateId) => {
      const template = blueprint.members.find(
        (member) => String(member.templateId) === String(templateId),
      )
      if (template === undefined) {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID,
          `no blueprint member template with templateId "${String(templateId)}"`,
        )
      }
      return template.persona
    },
  }
  // The scoped-prompt installation surface: the S5A boot world has no DSH
  // public prompt binding (the real one lands with the T5/T6 public seam);
  // installations are recorded (observable, write-free) — never silently
  // dropped.
  const promptInstallations = new Map<string, ScopedPersonaIdentity>()
  const promptSurface: ScopedPersonaPromptSurface = {
    installScopedPersona: (sessionId, identity) => {
      promptInstallations.set(sessionId, identity)
    },
  }
  const persona = createPersonaOverlaySlot({ presetSeam, personaSource, promptSurface })

  // The model selection ratchet seeded from the row's static model (the
  // harness-injected static model; ephemeral-safe: the ratchet state
  // survives for the process, restarts re-seed from the row config).
  let currentModel: ModelSelection | undefined = {
    provider: config.staticModel.provider,
    model: config.staticModel.model,
  }
  const modelSource: ModelSelectionSource = {
    current: () => currentModel,
    select: (next: ModelSelection) => {
      currentModel = next
    },
  }
  const model = new TeamModelOverlaySlot(new TeamModelSelectionAdapter(modelSource))

  // The capability facets: the boot world carries no G2-proven facet
  // seams — every facet is honestly unavailable (the slot resolves
  // fail-closed and records the reason); the source sets come from the
  // row config (absent = empty).
  const unavailableFacetSeam: CapabilityFacetSeam = {
    available: false,
    install: () => {
      // No G2 facet seam in the boot world (honest fail-closed).
    },
  }
  const emptyFacetSources: CapabilityFacetSources = {
    available: [],
    teamResolved: [],
    externalHard: [],
  }
  const facetConfig = {} as Record<string, CapabilityFacetConfig>
  for (const facet of CAPABILITY_FACETS) {
    const sources = config.capabilityFacets?.[facet] ?? emptyFacetSources
    facetConfig[facet] = {
      seam: unavailableFacetSeam,
      sources: {
        available: sources.available,
        teamResolved: sources.teamResolved,
        externalHard: sources.externalHard,
      },
    }
  }
  const capability = createCapabilityOverlaySlot({
    config: { facets: facetConfig } as CapabilityOverlayConfig,
  })

  const slots: Record<OverlaySlotName, OverlaySlot> = { persona, model, capability }

  // --- A10 the binder (real slots, default admitting guard) -----------------------------
  // The compatibility authority is the work gate (P8-S4A single authority);
  // the binder's admission guard stays the default admitting guard.
  const binder = new TeamAgentBinder({
    surface: live.surface,
    teamDomain: readHandle,
    slots,
  })

  // --- A05 + A06 root binding (fresh + cold) ---------------------------------------------
  const rootBindingPorts = {
    teamDomain: readHandle,
    writes: rootWritePort,
    blueprintCatalog: catalog,
    surface: live.surface,
    slots,
    now,
  }
  const rootBinding = {
    bindFresh: (input: FreshRootBindingInput): Promise<RootBindingResult> =>
      bindFreshTeamRoot(rootBindingPorts, input),
    rehydrateCold: (input: ColdRootBindingInput): Promise<RootBindingResult> =>
      rehydrateColdTeamRoot(rootBindingPorts, input),
  }

  // --- A08 + A09 member residency (fresh + cold) ------------------------------------------
  const memberResidencyPorts = {
    teamDomain: readHandle,
    writes: memberWritePort,
    sessionDurability: live.sessionDurability,
    surface: live.surface,
    residency: live.residency,
    slots,
    now,
  }
  const memberResidency = {
    createFresh: (spec: MemberCreateSpec): Promise<FreshMemberResult> =>
      createFreshMember(memberResidencyPorts, spec),
    rehydrateCold: (input: MemberIdentityInput): Promise<ColdMemberResult> =>
      rehydrateColdMember(memberResidencyPorts, input),
  }

  // --- A16 the activation provider (the ONLY creation path) --------------------------------
  const provider = createActivationProvider({
    teamDomain: domain,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    childSessionFactory: live.childFactory,
    sessionDurability: live.sessionDurability,
    surface: live.surface,
    slots,
    now,
  })

  // --- P8-S5B the shared team operation coordinator (CR-8: ONE seam) -------
  // Every team-MUTATING operation the production row runs serializes on this
  // one per-team chain:
  //   - the router facade's critical section (new-work admissions hold the
  //     chain across the compatibility gate AND the effect — closes the R5
  //     window: two concurrent consultations can never interleave their
  //     inline re-probes);
  //   - the activity ledger's guarded commit (strictly sequential with the
  //     facade critical section — release, then re-acquire, never nested);
  //   - the lifecycle service's locked surface (standalone-use fence; the
  //     production row itself runs the UNLOCKED cores under the router's
  //     chain — the service's lock is deliberately not a second seam).
  // The activation provider deliberately keeps its PRIVATE map: sharing
  // this chain would DEADLOCK the router-mediated flow (the router effect
  // holds the chain across callProvider; the provider's steps 7–15 would
  // queue behind the router's own pending tail). That deadlock is itself
  // the proof every production provider write already sits inside this
  // chain's critical section — provably subsumed (no production caller
  // reaches the provider directly: the facade is the sole creation path,
  // invariant 26). The provider's private map remains for direct-
  // construction test worlds (e.g. the frozen p6t1 parallel suite).
  const coordination = createTeamOperationCoordinator()

  // --- A20 + A21 the lifecycle service + commit port ---------------------------------------
  const lifecycleCommit: LifecycleCommitPort = {
    // The repository put returns the committed record; the commit port's
    // contract is void (the caller re-reads the row for the new state).
    commitTransition: async (args) => {
      await repos.memberInstances.commitTransition(args)
    },
  }
  const lifecyclePorts: LifecyclePorts = {
    teamDomain: domain,
    commit: lifecycleCommit,
    // The frozen boot world never disposes a team; the old harness wiring
    // closed new work admission as a no-op (no in-process admission state
    // exists in the S5A world — the compatibility authority is the gate).
    admission: {
      closeNewWork: async (_target) => {
        // no-op (boot world: no live admission state to close)
      },
    },
    activity: {
      interrupt: (target) => live.interrupt(target),
    },
    descendants: {
      drainDescendants: (childSessionId) => live.drainDescendants(childSessionId),
    },
    residency: live.residency,
  }
  const lifecycleService = createLifecycleService(lifecyclePorts, coordination.chains)

  // --- A17 + A18 + A19 the TeamRuntime facade (the P8-S3 work chain) -----------------------
  const workActivity = createWorkActivityWriter({ teamDomain: domain, now })
  const runtime = createTeamRuntime({
    teamDomain: domain,
    activationProvider: provider,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    now,
    lifecycleCommit,
    lifecyclePorts,
    teamLocks: coordination.chains,
    workDelivery: live.workDelivery,
    workActivity,
  })

  // --- A25 the control service --------------------------------------------------------------
  const control = createControlService({
    teamDomain: domain,
    blueprintCatalog: catalog,
    externalPolicyFacts,
    now,
  })

  // --- A24 the messaging coordinator ----------------------------------------------------------
  const messaging = createMessagingCoordinator({
    teamRuntime: runtime,
    teamDomain: domain,
    sessionInput: live.sessionInput,
    now,
  })

  // --- A26 the activity ledger ------------------------------------------------------------------
  const activity = createActivityLedger({
    teamDomain: domain,
    runtime,
    now,
    teamLocks: coordination.chains,
  })

  // --- A27 the fork reconciliation ----------------------------------------------------------------
  const forkPort = createTeamDomainForkPort(repos)
  const fork = {
    reconcile: (input: ForkReconciliationInput): Promise<ForkReconciliationResult> =>
      reconcileForkSidecar(input, { teamDomain: forkPort, now }),
  }

  // --- A28 the handoff service (fail-closed ports — documented boot-world wiring) ---------------
  const handoff = createHandoffService({
    sourceSurface: {
      readCanonicalSurface: async (sourceSessionId) => {
        throw new TeamPluginError(
          'TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
          `the production root exposes no DSH public session read surface for handoff (source session "${sourceSessionId}"); the S5A boot world does not perform handoffs`,
        )
      },
    },
    summarizer: {
      summarize: async () => {
        throw new TeamPluginError(
          'TEAM_HANDOFF_SUMMARIZER_UNAVAILABLE',
          'the production root exposes no host summarizer capability for handoff; the S5A boot world does not perform handoffs',
        )
      },
    },
    teamCreation: {
      createTeam: async () => {
        throw new TeamPluginError(
          'TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE',
          'new-team creation from handoff is not exposed by the S5A production root (the fresh-root binding + the activation provider remain the creation entries)',
        )
      },
    },
    clock: now,
  })

  // --- A29 the legacy read-only session reader -----------------------------------------------------
  // The production ENTRY loads the frozen reader's emitted JS by computed
  // URL (packages/legacy is compiled separately — noCheck — because its
  // pre-existing type errors must never surface in this program); the root
  // consumes that function through this injected port typed by the frozen
  // surface snapshot (./legacy-surface.js).
  const legacy = {
    inspect: legacyInspect,
  }

  // --- A22 + A23 the mutation service + the governance override admission -------------------------
  const policyReader: PolicyReader = {
    readBlueprintEnvelope: () => {
      const values = capabilityValuesOf(blueprint.capabilityPolicy)
      return values === undefined ? {} : { values }
    },
    // The bound blueprint snapshot carries no per-template capability
    // policy values (the vNext blueprint template is persona +
    // model/context policy tokens) — the honest empty template policy.
    readTemplatePolicy: () => ({}),
    readExternalFacts: () => config.externalPolicyFacts as unknown as ExternalPolicyFacts,
  }
  const defaultOverrideStore: OverrideStorePort = {
    list: (rootSessionId) =>
      Promise.resolve(repos.overrides.list(rootSessionId) as readonly OverrideRecordView[]),
    put: (record) => repos.overrides.put(record),
  }
  // Named so the A31 remote PolicyState port can read the durable
  // transition rows (policyState.get) from the same store the service
  // writes (policyState.set flows through the service only).
  // R2-1 (P8-S7-R2): the transitions lane of that store is DURABLE — the
  // `ledger` fact rows of the OPENED TeamDomain (the existing storage
  // authority the mutation plane already uses for its durable homes);
  // every other lane keeps the S5A documented ephemeral wiring. The
  // production `boot()` preloads the durable rows into the in-memory
  // cache before the live flow; the production `close()` flushes the
  // scheduled durable writes (module: ./durable-mutation-store.js).
  const durableMutation = createDurableMutationStore(
    createEphemeralMutationStore(),
    repos,
    rootSid,
    now,
  )
  const mutationStore = durableMutation.store
  const mutation = {
    // R2-1: the durable-backed store is exposed on the root surface (an
    // additive read-side seam): the remote policyState surface, the
    // projection read-port dep, and the C1 three-way-agreement verification
    // all read the transitions lane through this single authoritative
    // cache (the process-local lanes keep their documented ephemeral
    // semantics — see ./durable-mutation-store.js).
    store: mutationStore,
    service: new MutationService({
      // The S5A boot world has no step-driven mutation pipeline; the
      // StepClock reports the fixed step 0 (documented in S5A-result.md).
      clock: { currentStep: () => 0 },
      store: mutationStore,
      policy: policyReader,
    }),
    admitGovernanceOverride: (
      args: AdmitGovernanceOverrideArgs,
      store?: OverrideStorePort,
    ): Promise<AdmittedGovernanceOverride> => admitGovernanceOverride(args, store ?? defaultOverrideStore),
    resolveDurableModelSelection,
    resolveDurableMcpFacet,
  }

  // --- A30 the projection service (durable source + the S6 overlay seam) ---------------------------
  const seams = {
    projectionLiveOverlay: createProjectionLiveOverlaySeam(),
    remoteHandlerRegistration: createRemoteHandlerRegistrationSeam(),
    serverPrincipalDerivation: createServerPrincipalDerivationSeam(),
    remoteQueryCommandCompletion: createRemoteQueryCommandCompletionSeam(),
  }

  // A31 read-port resolvers (the v1 source-gap closure, plan §20.1): the
  // template rows resolve from the bound blueprint CATALOG (the TeamDomain
  // has no template table — the immutable snapshot IS the template truth;
  // displayName falls back to the template id, contextPolicy falls back to
  // the domain default when the snapshot token is absent or malformed).
  // R2-1: the PolicyState id no longer returns the constant default — the
  // projection reads the DURABLE transition rows of the same store the
  // mutation service writes (preloaded into the in-memory cache at boot),
  // evaluated at the maximum step horizon: the production step clock is
  // pinned to 0 (documented in S5A), and the remote policyState.read
  // surface uses the same horizon, so projection and remote agree that
  // an explicitly admitted transition is the active state.
  const readPortDeps: TeamDomainReadPortDeps = {
    templates: (row) => {
      const resolved = catalog.resolve(row.blueprint.blueprintId, row.blueprint.revision)
      const templateOf = (
        kind: 'leader' | 'member',
        template: BlueprintTemplate,
        instanceQuota: number | undefined,
      ): DurableTemplateRow => ({
        kind,
        templateId: template.templateId,
        displayName: template.displayName ?? template.templateId,
        ...(template.description !== undefined ? { description: template.description } : {}),
        contextPolicy:
          template.contextPolicy !== undefined && isContextPolicy(template.contextPolicy)
            ? template.contextPolicy
            : DEFAULT_CONTEXT_POLICY,
        ...(instanceQuota !== undefined ? { instanceQuota } : {}),
      })
      return [
        templateOf('leader', resolved.leader, undefined),
        ...resolved.members.map((member) =>
          templateOf('member', member, resolved.quotas?.members?.maxInstances),
        ),
      ]
    },
    policyState: (rootSessionId) =>
      activePolicyState(
        mutationStore.listTransitions(rootSessionId as TeamSessionId),
        Number.MAX_SAFE_INTEGER,
      ).stateId,
    // R2-2 (P8-S7-R2): the BQ-08 resolved effective-config view (F01-F08,
    // G01, G02, G05, G06, G09, H04, H12, L11). The resolver runs the
    // two-stage policy resolution over the SAME durable transition rows the
    // mutation service writes (the R2-1 cache), the merged mutation-store +
    // governance-override records, and the bound policy reader, at the
    // maximum step horizon: the process-local applied-record state is not
    // durable, so boundary-pending changes are reported conservatively as
    // pending (appliedRecordIds empty). A resolver failure degrades the
    // lane to the closed default, never the row (fail closed).
    effectiveConfig: (rootSessionId, member): EffectiveConfigDtoV2 | null => {
      try {
        return createEffectiveConfigView({
          teamSessionId: rootSessionId,
          instanceId: member.instanceId,
          lifecycle: member.lifecycle,
          memberWorkspace: member.workspace,
          teamDefaultWorkspace: repos.teamSessions.get(rootSessionId)?.defaultWorkspace,
          staticModel: {
            provider: config.staticModel.provider,
            model: config.staticModel.model,
          },
          transitions: mutationStore.listTransitions(rootSessionId as TeamSessionId),
          records: mutationStore.listRecords(rootSessionId as TeamSessionId),
          overrides: repos.overrides.list(rootSessionId),
          policyReader,
        })
      } catch {
        return null
      }
    },
    // R2-3 (P8-S7-R2): the BQ-11 per-member model state view (D09/H06/H09/
    // H10/H12). Dual-horizon resolution over the SAME durable transition
    // rows, the merged mutation-store + governance-override records, and
    // the bound policy reader: the NOW horizon (the production step clock
    // is pinned to 0 — a transition requested at step 0 takes effect from
    // step 1, so at the current step the admitted team model is always the
    // pre-transition state) resolves `current` + `provenance` +
    // `availability`; the MAX horizon resolves the next-boundary winner,
    // and a pending transition (or a winner backed by an admitted-but-
    // unapplied record) fills `pendingNextBoundary`. A resolver failure
    // drops the `modelState` key (DURATIONAL-optional — absent, never
    // undefined), never the row.
    modelState: (rootSessionId, instanceId): MemberModelStateDto | undefined => {
      try {
        return createModelStateView({
          teamSessionId: rootSessionId,
          instanceId,
          currentStep: 0,
          staticModel: {
            provider: config.staticModel.provider,
            model: config.staticModel.model,
          },
          transitions: mutationStore.listTransitions(rootSessionId as TeamSessionId),
          records: mutationStore.listRecords(rootSessionId as TeamSessionId),
          overrides: repos.overrides.list(rootSessionId),
          policyReader,
        })
      } catch {
        return undefined
      }
    },
  }
  // R2-2 (P8-S7-R2): the production projection is stamped v2 — the
  // effective-config lane of the v2 member row is a closed field set of the
  // v1 row (the v2 entry is a structural superset of the v1 entry,
  // validated per schema version by the pipeline).
  const projection: ProjectionService = createProjectionService(
    createTeamDomainReadPort(domain, readPortDeps),
    createFailClosedOverlayProxy(seams.projectionLiveOverlay),
    { clock: now, schemaVersion: 2 },
  )

  // --- A32 + A30 the principal derivation + the live overlay (installed once) ----------------------
  seams.serverPrincipalDerivation.install(
    createServerPrincipalDerivation({
      rootSessionId: rootSid,
      repositories: repos,
      leaderInstanceId: LEADER_INSTANCE_ID,
    }),
  )
  seams.projectionLiveOverlay.install(
    createLiveResidencyOverlay({ repositories: repos, live, rootSessionId: rootSid, now }),
  )

  // --- A31 + A33 + A34 the remote surfaces (built once, installed once) -----------------------------
  const remoteSurfaces = createS6RemoteSurfaces({
    rootSessionId: rootSid,
    repositories: repos,
    catalog,
    blueprint,
    leaderInstanceId: LEADER_INSTANCE_ID,
    projection,
    runtime,
    lifecycle: lifecycleService,
    mutationService: {
      switchPolicyState: (request) => mutation.service.switchPolicyState(request),
    },
    mutationTransitions: (teamSessionId) =>
      mutationStore.listTransitions(teamSessionId as TeamSessionId),
    admitGovernanceOverride: (args, store) => mutation.admitGovernanceOverride(args, store),
    overrideStore: defaultOverrideStore,
    overrideRecords: (teamSessionId) =>
      repos.overrides.list(teamSessionId) as unknown as readonly RemoteSafeRecord[],
    rootBinding,
    compatibility: prober,
    handoff,
    legacyInspect,
    legacyHome: params.legacyHome,
    principal: seams.serverPrincipalDerivation.current(),
    now,
  })
  seams.remoteQueryCommandCompletion.install(remoteSurfaces.completion)
  seams.remoteHandlerRegistration.install(remoteSurfaces.registration)

  // --- A04 the intent surface (the remote method catalog) --------------------------------------------
  const intent = { catalog: REMOTE_METHOD_CATALOG }

  // --- the ten Team tools (the glue registers them on the agent setup) ------------------------------
  const tools = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    resolveCaller: live.resolveCaller,
  })
  teamToolsRef.current = tools

  // --- boot (create phase: seed + live boot; resume phase: live boot + cold rehydration) ------------
  async function seedBootWorld(): Promise<void> {
    // The deterministic seed puts of the frozen scenario contract (the
    // exact rows the previous harness seeded, moved INTO the production
    // root so the harness stays a pure consumer): the team root row, the
    // team-root binding, the leader member row (inst-leader — seeded
    // structurally from the frozen constants; its child session IS the
    // root session, matching the P6-T6-era seed the frozen W1 state
    // check asserts), and the row-config seed member pairs. Each put is
    // idempotent (skipped when the row already exists).
    const teamSessions = repos.teamSessions
    const sessionBindings = repos.sessionBindings
    const memberInstances = repos.memberInstances
    if (teamSessions.get(rootSid) === undefined) {
      const input = {
        rootSessionId: rootSid,
        blueprint: createBlueprintSnapshotRef({
          blueprintId: parseBlueprintId(String(blueprint.blueprintId)),
          revision: parseBlueprintRevision(String(blueprint.revision)),
          contentHash: parseBlueprintContentHash(String(blueprint.contentHash)),
        }),
        createdAt: new Date(0).toISOString(),
        generation: config.generation,
        ...(config.defaultWorkspace !== undefined
          ? { defaultWorkspace: config.defaultWorkspace }
          : {}),
      } as TeamSessionRecordInput
      await teamSessions.put(input)
    }
    if (sessionBindings.get(rootSid) === undefined) {
      await sessionBindings.put({
        kind: 'team-root',
        schemaVersion: 1,
        sessionId: rootSid,
      })
    }
    if (memberInstances.get(rootSid, LEADER_INSTANCE_ID) === undefined) {
      const leaderInput = {
        rootSessionId: rootSid,
        instanceId: LEADER_INSTANCE_ID,
        templateId: 'leader',
        label: 'leader',
        childSessionId: rootSid,
        ...(config.defaultWorkspace !== undefined
          ? { workspace: config.defaultWorkspace }
          : {}),
        lifecycle: 'RUNNING',
        createdAt: new Date(0).toISOString(),
        activityVersion: 1,
      } as MemberInstanceRecordInput
      await memberInstances.put(leaderInput)
    }
    for (const seed of config.seedMembers) {
      if (memberInstances.get(rootSid, seed.instanceId) !== undefined) continue
      const input = {
        rootSessionId: rootSid,
        instanceId: seed.instanceId,
        templateId: seed.templateId,
        label: seed.label,
        childSessionId: seed.childSessionId,
        ...(config.defaultWorkspace !== undefined
          ? { workspace: config.defaultWorkspace }
          : {}),
        lifecycle: 'RUNNING',
        createdAt: new Date(0).toISOString(),
        activityVersion: 1,
      } as MemberInstanceRecordInput
      await memberInstances.put(input)
    }
  }

  let bootStarted = false
  const boot = async (): Promise<void> => {
    if (bootStarted) return
    bootStarted = true
    if (config.bootPhase === 'create') {
      await seedBootWorld()
    }
    // Boot-time initial compatibility state (wiring decision (x)): the
    // frozen runtime's new-work gate (admission/gate.ts) and activation
    // step 6 (activation/provider.ts) each create their OWN compatibility
    // authority per consultation; each authority owns its prober, and each
    // prober owns its promise-chain lock (compatibility/probe.ts — the
    // "one durable writer per prober" pattern). Concurrent first-work
    // consultations (E1) therefore run concurrent inline re-probes whose
    // non-atomic delete + put state replacements interleave, and a
    // post-probe re-read can land in another probe's delete -> put gap
    // and observe no state, failing closed with no-state-after-reprobe
    // (invariant 50). Establishing the initial state here, with the
    // trigger whose frozen contract covers the first-ever evaluation
    // (STALE_GENERATION_BEFORE_NEW_WORK, compatibility/types.ts), makes
    // the first-work consultations find a fresh durable state and skip
    // the inline re-probe entirely. Idempotent: an existing state row
    // (the resume boots, same home) is left untouched.
    if ((await repos.compatibility.get(rootSid)) === undefined) {
      await prober.probe(PROBE_TRIGGERS.STALE_GENERATION_BEFORE_NEW_WORK)
    }
    // The boot flow is LIVE-ONLY in both phases. The frozen scenario
    // contract defines the seeded world as exactly the teamSessions row +
    // the team-root binding + the seeded member rows (no child
    // `team-member` bindings), and the previous harness's resume boot
    // re-established the live residency through the agents service only
    // (create / resume of the root + the bound children). The cold
    // rehydration nodes (A06 / A09) remain assembled and reachable on the
    // root surface (T1-proven against a consistent fresh world) but are
    // DORMANT in the boot flow: driving them at resume would require
    // durable state the frozen contract does not seed.
    // R2-1: restore the durable PolicyState transitions of this root
    // (admitted by a previous process) into the in-memory mutation cache
    // BEFORE the live flow — the projection and the remote surface must
    // already report the durable state on the first read of a resumed
    // root (the durable ledger is the source of truth; module docs:
    // ./durable-mutation-store.js). No-op on a fresh world (empty
    // ledger lane).
    await durableMutation.preload()
    await live.boot()
  }

  // --- close ------------------------------------------------------------------------------------------
  let closeStarted = false
  const close = async (): Promise<void> => {
    if (closeStarted) return
    closeStarted = true
    // R2-1: flush the scheduled durable PolicyState writes BEFORE the
    // live / domain close (a write to an already-closed domain would
    // fail; the flush surfaces any recorded failure to the caller).
    await durableMutation.flush()
    await live.close()
    await domain.close()
  }

  return {
    config,
    domain,
    storageSeam,
    catalog,
    blueprint,
    leaderIdentity,
    intent,
    compatibility,
    rootBinding,
    memberResidency,
    binder,
    slots: { persona, model, capability },
    provider,
    runtime,
    lifecycle: { service: lifecycleService, commit: lifecycleCommit },
    mutation,
    messaging,
    control,
    activity,
    fork,
    handoff,
    legacy,
    projection,
    seams,
    live,
    tools,
    boot,
    close,
  }
}
