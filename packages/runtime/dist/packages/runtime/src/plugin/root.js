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
 * | A28  | handoff service                         | `createHandoffService` (production wiring, P8-S7-R4) |
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
 * - **The handoff service ports are production-wired** (P8-S7-R4):
 *   `sourceSurface` reads the source through the DSH public
 *   `sessionQuery` service (lazy resolution at use time — ABSENT there
 *   still fails closed with `TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE`,
 *   which is the S5A boot world and every test world without the
 *   service), `summarizer` is the deterministic NON-MODEL digest of
 *   ./handoff-surface.js, and `teamCreation` reuses the existing
 *   fresh-root binding path (the same binding the `team.create` entry
 *   uses) with the handoff attached as the new team's source provenance
 *   (the `handoffSourceSessionId` TeamSession record field, BQ-16).
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
import { createBlueprintCatalog, parseBlueprint, sha256Hex, } from '../../../domain/blueprint/src/index.js';
import { DEFAULT_CONTEXT_POLICY, isContextPolicy } from '../../../domain/member/src/index.js';
import { CAPABILITY_NAME_VALUES, } from '../../../domain/policy/src/index.js';
import { canonicalJsonStringify, createBlueprintSnapshotRef, LEADER_INSTANCE_ID, leaderMemberIdentityOf, parseBlueprintContentHash, parseBlueprintId, parseBlueprintRevision, parseRootSessionId, parseSessionId, } from '../../../contracts/src/index.js';
import { REMOTE_METHOD_CATALOG, } from '../../../remote/src/contracts/catalog.js';
import { createTeamDomainWritePort, bindFreshTeamRoot, rehydrateColdTeamRoot, } from '../../root-binding/index.js';
import { createFreshMember, createMemberDomainWritePort, rehydrateColdMember, } from '../../member-residency/index.js';
import { TeamAgentBinder, createTeamDomainReadHandle, } from '../../agent-setup/binder/index.js';
import { createPersonaOverlaySlot } from '../../agent-setup/persona/index.js';
import { TeamModelOverlaySlot, TeamModelSelectionAdapter, resolveDurableModelSelection, } from '../../agent-setup/model/index.js';
import { CAPABILITY_FACETS, createCapabilityOverlaySlot, resolveDurableMcpFacet, } from '../../agent-setup/capability/index.js';
import { createActivationProvider } from '../../activation/index.js';
import { ACTION_NAMES, enforceCompatibilityGate } from '../../admission/index.js';
import { commitDurableFact, createTeamRuntime } from '../../action-router/index.js';
import { createTeamOperationCoordinator } from '../../coordination/index.js';
import { createLifecycleService } from '../../lifecycle/index.js';
import { PROBE_TRIGGERS, createCompatibilityAuthority, createCompatibilityProber, } from '../../compatibility/index.js';
import { createControlService } from '../../control/index.js';
import { createMessagingCoordinator } from '../../messaging/index.js';
import { createActivityLedger, createWorkActivityWriter, } from '../../activity/index.js';
import { createTeamDomainForkPort, reconcileForkSidecar, } from '../../fork-reconciliation/index.js';
import { createHandoffService } from '../../handoff/index.js';
import { readCanonicalSourceSurface, summarizeSourceSurface, } from './handoff-surface.js';
import { createProjectionService } from '../../projection/index.js';
import { createTeamTools } from '../../../tools/src/index.js';
import { MutationService, admitGovernanceOverride, } from '../../mutation/index.js';
import { createFailClosedOverlayProxy, createProjectionLiveOverlaySeam, createRemoteHandlerRegistrationSeam, createRemoteQueryCommandCompletionSeam, createServerPrincipalDerivationSeam, } from './seams.js';
import { createTeamDomainReadPort } from './projection-source.js';
import { createEffectiveConfigView } from './effective-config-view.js';
import { createModelStateView } from './model-state-view.js';
import { createDurableMutationStore } from './durable-mutation-store.js';
import { activePolicyState } from '../../policy-adapter.js';
import { createLiveResidencyOverlay } from './s6-live-overlay.js';
import { createServerPrincipalDerivation } from './s6-principal.js';
import { createS6RemoteSurfaces } from './s6-remote.js';
import { TEAM_PLUGIN_ERROR_CODES, TeamPluginError } from './types.js';
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
function createEphemeralMutationStore() {
    const transitionsByTeam = new Map();
    const recordsByTeam = new Map();
    const creationFieldsByTeam = new Map();
    const workspacesByTeam = new Map();
    const runningKeys = new Set();
    const ledgerByTeam = new Map();
    const suppressionsByTeam = new Map();
    const teamKey = (teamSessionId) => teamSessionId;
    const memberKey = (teamSessionId, instanceId) => `${teamSessionId}::${instanceId}`;
    return {
        listTransitions(teamSessionId) {
            return transitionsByTeam.get(teamKey(String(teamSessionId))) ?? [];
        },
        appendTransition(teamSessionId, transition) {
            const team = teamKey(String(teamSessionId));
            const list = transitionsByTeam.get(team) ?? [];
            list.push(transition);
            transitionsByTeam.set(team, list);
        },
        listRecords(teamSessionId) {
            return recordsByTeam.get(teamKey(String(teamSessionId))) ?? [];
        },
        appendRecord(teamSessionId, record) {
            const team = teamKey(String(teamSessionId));
            const list = recordsByTeam.get(team) ?? [];
            list.push(record);
            recordsByTeam.set(team, list);
        },
        getCreationFields(teamSessionId, instanceId) {
            return creationFieldsByTeam
                .get(teamKey(String(teamSessionId)))
                ?.get(String(instanceId));
        },
        registerCreationFields(teamSessionId, member, fields) {
            const team = teamKey(String(teamSessionId));
            const byInstance = creationFieldsByTeam.get(team) ?? new Map();
            byInstance.set(String(member.instanceId), {
                instanceId: String(member.instanceId),
                workspace: fields.workspace,
                contextPolicy: fields.contextPolicy,
                running: false,
            });
            creationFieldsByTeam.set(team, byInstance);
        },
        setWorkspace(teamSessionId, instanceId, workspace) {
            const team = teamKey(String(teamSessionId));
            const byInstance = workspacesByTeam.get(team) ?? new Map();
            byInstance.set(String(instanceId), workspace);
            workspacesByTeam.set(team, byInstance);
        },
        isRunning(teamSessionId, instanceId) {
            return runningKeys.has(memberKey(String(teamSessionId), String(instanceId)));
        },
        markRunning(teamSessionId, instanceId) {
            runningKeys.add(memberKey(String(teamSessionId), String(instanceId)));
        },
        listInstances(teamSessionId) {
            const byInstance = creationFieldsByTeam.get(teamKey(String(teamSessionId)));
            return byInstance === undefined ? [] : [...byInstance.keys()];
        },
        listLedger(teamSessionId) {
            return ledgerByTeam.get(teamKey(String(teamSessionId))) ?? [];
        },
        appendLedger(teamSessionId, entry) {
            const team = teamKey(String(teamSessionId));
            const list = ledgerByTeam.get(team) ?? [];
            list.push(entry);
            ledgerByTeam.set(team, list);
        },
        listSuppressions(teamSessionId) {
            return suppressionsByTeam.get(teamKey(String(teamSessionId))) ?? [];
        },
        appendSuppression(teamSessionId, record) {
            const team = teamKey(String(teamSessionId));
            const list = suppressionsByTeam.get(team) ?? [];
            list.push(record);
            suppressionsByTeam.set(team, list);
        },
    };
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
function capabilityValuesOf(policy) {
    if (policy === undefined)
        return undefined;
    const values = {};
    for (const capabilityName of CAPABILITY_NAME_VALUES) {
        if (policy[capabilityName] === 'deny') {
            values[capabilityName] = { kind: 'deny' };
        }
    }
    return values;
}
/**
 * Snapshot-ref equality (the same comparison the fresh-root binding uses
 * privately in `bindFreshTeamRoot` — blueprintId + revision +
 * contentHash, String-compared; root-binding is OUT OF SCOPE for this
 * task, so a local mirror instead of a shared export).
 */
function sameSnapshotRef(a, b) {
    return (String(a.blueprintId) === String(b.blueprintId) &&
        String(a.revision) === String(b.revision) &&
        String(a.contentHash) === String(b.contentHash));
}
/**
 * T12-B6 (plan §7-B4) — the deterministic delivery payload of one
 * frozen handoff context: the contextToken LEADS (the explicit request
 * identity of the at-least-once delivery — the target dedupes on it),
 * followed by the canonical lossless-JSON body (key-sorted, byte-stable:
 * a re-drive delivers identical bytes).
 */
function handoffContextText(context) {
    return `handoff-context ${context.contextToken}\n${canonicalJsonStringify(context)}`;
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
export function createTeamProductionRoot(params) {
    const { config, domain, storageSeam, live, now, teamToolsRef, legacyInspect, getSessionQuery } = params;
    const repos = domain.repositories;
    const rootSid = config.rootSessionId;
    // --- A02 handle / write ports ------------------------------------------------------
    const readHandle = createTeamDomainReadHandle(repos);
    const rootWritePort = createTeamDomainWritePort(repos);
    const memberWritePort = createMemberDomainWritePort(repos);
    // --- A03 blueprint + catalog ---------------------------------------------------------
    const blueprint = parseBlueprint(config.blueprintSource);
    const catalog = createBlueprintCatalog([blueprint]);
    // --- A03b the bound blueprint snapshot ref (T12-B1/B6) --------------------------------
    // Every fresh-root binding of THIS row binds the same immutable identity:
    // the real create boot (T12-B1) and the handoff target creation (T12-B6)
    // both go through this single ref — no per-path re-derivation.
    const boundSnapshot = createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId(String(blueprint.blueprintId)),
        revision: parseBlueprintRevision(String(blueprint.revision)),
        contentHash: parseBlueprintContentHash(String(blueprint.contentHash)),
    });
    // --- A07 leader identity -------------------------------------------------------------
    const leaderIdentity = leaderMemberIdentityOf(rootSid);
    // --- the fresh-read fact thunks (the config carries the boot-world facts) -----------
    const environmentFacts = async () => config.environmentFacts.map((fact) => ({
        domain: fact.domain,
        subject: fact.subject,
        available: fact.available,
        generation: fact.generation,
    }));
    const externalPolicyFacts = async () => config.externalPolicyFacts;
    // --- A14 + A15 compatibility prober / authority / work gate --------------------------
    const prober = createCompatibilityProber({
        repositories: repos,
        rootSessionId: rootSid,
        blueprint,
        environmentFacts,
        now,
    });
    const authority = createCompatibilityAuthority({
        repositories: repos,
        rootSessionId: rootSid,
        blueprint,
        environmentFacts,
        now,
    });
    const compatibility = {
        prober,
        authority,
        enforceGate: enforceCompatibilityGate,
    };
    // --- A11 + A12 + A13 the three overlay slots ------------------------------------------
    // The preset seam reports the production plugin's own substrate facts
    // (the S5A boot world has no standing DSH preset persona; 'standard' is
    // the composable non-complete case the persona engine composes with).
    const presetSeam = {
        getSubstrate: () => ({ presetId: 'dsh-agent-team', personaKind: 'standard' }),
    };
    const personaSource = {
        getLeaderPersona: () => blueprint.leader.persona,
        getMemberPersona: (_rootSessionId, templateId) => {
            const template = blueprint.members.find((member) => String(member.templateId) === String(templateId));
            if (template === undefined) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `no blueprint member template with templateId "${String(templateId)}"`);
            }
            return template.persona;
        },
    };
    // The scoped-prompt installation surface: the S5A boot world has no DSH
    // public prompt binding (the real one lands with the T5/T6 public seam);
    // installations are recorded (observable, write-free) — never silently
    // dropped.
    const promptInstallations = new Map();
    const promptSurface = {
        installScopedPersona: (sessionId, identity) => {
            promptInstallations.set(sessionId, identity);
        },
    };
    const persona = createPersonaOverlaySlot({ presetSeam, personaSource, promptSurface });
    // The model selection ratchet seeded from the row's static model (the
    // harness-injected static model; ephemeral-safe: the ratchet state
    // survives for the process, restarts re-seed from the row config).
    let currentModel = {
        provider: config.staticModel.provider,
        model: config.staticModel.model,
    };
    const modelSource = {
        current: () => currentModel,
        select: (next) => {
            currentModel = next;
        },
    };
    const model = new TeamModelOverlaySlot(new TeamModelSelectionAdapter(modelSource));
    // The capability facets: the boot world carries no G2-proven facet
    // seams — every facet is honestly unavailable (the slot resolves
    // fail-closed and records the reason); the source sets come from the
    // row config (absent = empty).
    const unavailableFacetSeam = {
        available: false,
        install: () => {
            // No G2 facet seam in the boot world (honest fail-closed).
        },
    };
    const emptyFacetSources = {
        available: [],
        teamResolved: [],
        externalHard: [],
    };
    const facetConfig = {};
    for (const facet of CAPABILITY_FACETS) {
        const sources = config.capabilityFacets?.[facet] ?? emptyFacetSources;
        facetConfig[facet] = {
            seam: unavailableFacetSeam,
            sources: {
                available: sources.available,
                teamResolved: sources.teamResolved,
                externalHard: sources.externalHard,
            },
        };
    }
    const capability = createCapabilityOverlaySlot({
        config: { facets: facetConfig },
    });
    const slots = { persona, model, capability };
    // --- A10 the binder (real slots, default admitting guard) -----------------------------
    // The compatibility authority is the work gate (P8-S4A single authority);
    // the binder's admission guard stays the default admitting guard.
    const binder = new TeamAgentBinder({
        surface: live.surface,
        teamDomain: readHandle,
        slots,
    });
    // --- A05 + A06 root binding (fresh + cold) ---------------------------------------------
    const rootBindingPorts = {
        teamDomain: readHandle,
        writes: rootWritePort,
        blueprintCatalog: catalog,
        surface: live.surface,
        slots,
        now,
    };
    const rootBinding = {
        bindFresh: (input) => bindFreshTeamRoot(rootBindingPorts, input),
        rehydrateCold: (input) => rehydrateColdTeamRoot(rootBindingPorts, input),
    };
    // --- A08 + A09 member residency (fresh + cold) ------------------------------------------
    const memberResidencyPorts = {
        teamDomain: readHandle,
        writes: memberWritePort,
        sessionDurability: live.sessionDurability,
        surface: live.surface,
        residency: live.residency,
        slots,
        now,
    };
    const memberResidency = {
        createFresh: (spec) => createFreshMember(memberResidencyPorts, spec),
        rehydrateCold: (input) => rehydrateColdMember(memberResidencyPorts, input),
    };
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
    });
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
    const coordination = createTeamOperationCoordinator();
    // --- A20 + A21 the lifecycle service + commit port ---------------------------------------
    const lifecycleCommit = {
        // The repository put returns the committed record; the commit port's
        // contract is void (the caller re-reads the row for the new state).
        commitTransition: async (args) => {
            await repos.memberInstances.commitTransition(args);
        },
    };
    const lifecyclePorts = {
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
        // The durable evidence port (the UI-direct lifecycle surface): the
        // s6-remote archive/restore/dispose commands commit through this
        // locked service — WITHOUT the `member-lifecycle-changed` fact the
        // member-row transition would never advance the team generation
        // (the generation advances only on a ledger-fact append or the
        // compatibility state replace), and the post-op projection pull
        // would return the pre-op generation: the client's frozen pull
        // verdict would classify the fresh data as a `duplicate` and drop
        // the updated frame (the S7 die of the attempt-31 vertical, bug #9).
        // The router effect and the work-chain settlement commit their own
        // facts through the UNLOCKED cores — no double append on either
        // surface.
        evidence: {
            commitLifecycleChanged: async (args) => {
                return commitDurableFact(repos, args.rootSessionId, now, 'member-lifecycle-changed', {
                    action: args.operation === 'archive'
                        ? ACTION_NAMES.ARCHIVE_MEMBER
                        : args.operation === 'restore'
                            ? ACTION_NAMES.RESTORE_MEMBER
                            : ACTION_NAMES.DISPOSE_MEMBER,
                    caller: { kind: 'human', humanId: args.rootSessionId },
                    instanceId: args.instanceId,
                    from: args.from,
                    to: args.to,
                    steps: [...args.steps],
                    at: now(),
                });
            },
        },
    };
    const lifecycleService = createLifecycleService(lifecyclePorts, coordination.chains);
    // --- A17 + A18 + A19 the TeamRuntime facade (the P8-S3 work chain) -----------------------
    const workActivity = createWorkActivityWriter({ teamDomain: domain, now });
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
    });
    // --- A25 the control service --------------------------------------------------------------
    const control = createControlService({
        teamDomain: domain,
        blueprintCatalog: catalog,
        externalPolicyFacts,
        now,
    });
    // --- A24 the messaging coordinator ----------------------------------------------------------
    const messaging = createMessagingCoordinator({
        teamRuntime: runtime,
        teamDomain: domain,
        sessionInput: live.sessionInput,
        now,
    });
    // --- A26 the activity ledger ------------------------------------------------------------------
    const activity = createActivityLedger({
        teamDomain: domain,
        runtime,
        now,
        teamLocks: coordination.chains,
    });
    // --- A27 the fork reconciliation ----------------------------------------------------------------
    const forkPort = createTeamDomainForkPort(repos);
    // BQ-18 (P8-S7-R4 W3): the read-only fork reconciliation state. Every
    // read goes through the TeamDomain SYNC repository getters (zero
    // writes; the write path stays the unchanged `reconcile` above). The
    // exact state vocabulary (plan BQ-18): ordinary / root-fork-reconciled /
    // root-fork-recovering / member-fork-ordinary / integrity-conflict.
    const forkDescribe = (parentSessionId, childSessionId) => {
        const childBinding = repos.sessionBindings.get(childSessionId);
        const childRecord = repos.teamSessions.get(childSessionId);
        const parentBinding = repos.sessionBindings.get(parentSessionId);
        // Integrity conflicts FIRST — a corrupted durable state must never be
        // reported as an ordinary state:
        if (childBinding !== undefined && childBinding.kind === 'team-root' && childRecord === undefined) {
            return {
                parentSessionId,
                childSessionId,
                state: 'integrity-conflict',
                details: { conflict: 'binding-without-record' },
            };
        }
        if (childRecord !== undefined) {
            if (parentBinding !== undefined && parentBinding.kind === 'team-root') {
                const parentRecord = repos.teamSessions.get(parentSessionId);
                if (parentRecord === undefined) {
                    return {
                        parentSessionId,
                        childSessionId,
                        state: 'integrity-conflict',
                        details: { conflict: 'parent-binding-without-record' },
                    };
                }
                // BQ-04/Q02: a root fork must pin the SAME immutable Blueprint
                // snapshot as the parent (invariant 10).
                if (!sameSnapshotRef(childRecord.blueprint, parentRecord.blueprint)) {
                    return {
                        parentSessionId,
                        childSessionId,
                        state: 'integrity-conflict',
                        details: {
                            conflict: 'blueprint-mismatch',
                            parent: {
                                blueprintId: parentRecord.blueprint.blueprintId,
                                revision: parentRecord.blueprint.revision,
                                contentHash: parentRecord.blueprint.contentHash,
                            },
                            child: {
                                blueprintId: childRecord.blueprint.blueprintId,
                                revision: childRecord.blueprint.revision,
                                contentHash: childRecord.blueprint.contentHash,
                            },
                        },
                    };
                }
            }
            if (childBinding !== undefined && childBinding.kind === 'team-root') {
                const memberCount = repos.memberInstances.list(childSessionId).length;
                if (memberCount > 0) {
                    return {
                        parentSessionId,
                        childSessionId,
                        state: 'integrity-conflict',
                        details: { conflict: 'reconciled-child-carries-members', memberCount },
                    };
                }
                // Fully settled: the record AND the binding exist, memberless
                // (durableWrites 2/2 of the reconciler).
                return {
                    parentSessionId,
                    childSessionId,
                    state: 'root-fork-reconciled',
                    details: { memberCount: 0, durableWrites: 2 },
                };
            }
            // Record present WITHOUT the binding: the reconciler's crash window
            // (durableWrites 1/2 — record written, binding still pending).
            return {
                parentSessionId,
                childSessionId,
                state: 'root-fork-recovering',
                details: { phase: 'record-only', durableWrites: 1 },
            };
        }
        if (parentBinding !== undefined && parentBinding.kind === 'team-root') {
            // The parent is a team root and the child carries nothing yet: the
            // fork sidecar has not been reconciled (the lazy pending operation).
            return {
                parentSessionId,
                childSessionId,
                state: 'root-fork-recovering',
                details: { phase: 'not-reconciled' },
            };
        }
        if (childBinding !== undefined && childBinding.kind === 'team-member') {
            // A forked member child stays an unbound ordinary session (BQ-01:
            // zero Team-state writes) — the binding row records where it came
            // from, nothing more.
            return {
                parentSessionId,
                childSessionId,
                state: 'member-fork-ordinary',
                details: {
                    rootSessionId: childBinding.rootSessionId,
                    instanceId: childBinding.instanceId,
                },
            };
        }
        return { parentSessionId, childSessionId, state: 'ordinary', details: {} };
    };
    const fork = {
        reconcile: (input) => reconcileForkSidecar(input, { teamDomain: forkPort, now }),
        /** BQ-18 — the read-only fork reconciliation state (P8-S7-R4 W3). */
        describe: (input) => forkDescribe(input.parentSessionId, input.childSessionId),
    };
    // --- A28 the handoff service (production wiring — P8-S7-R4) ---------------------------------------
    // The DSH public `sessionQuery` service is resolved LAZILY (at handoff
    // use time, never at construction time): the registration order at root
    // construction is never assumed, and a handoff is user-triggered — by
    // the time one runs, the service is registered. Absence at use time
    // fails closed (the S5A boot world and every test world without the
    // service keep the documented fail-closed behavior).
    const resolveSessionQuery = () => {
        const accessor = getSessionQuery;
        if (accessor === undefined)
            return undefined;
        const candidate = accessor();
        if (typeof candidate !== 'object' || candidate === null)
            return undefined;
        const maybe = candidate;
        if (typeof maybe.readSurface !== 'function')
            return undefined;
        return candidate;
    };
    const requireSessionQuery = () => {
        const query = resolveSessionQuery();
        if (query === undefined) {
            throw new TeamPluginError('TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE', 'the DSH public "sessionQuery" service is not registered in this process (the boot/test world does not perform handoffs)');
        }
        return query;
    };
    // --- T12-B6 — the ONE formal create-and-start primitive (plan §7-B4) ----
    // BOTH the production `create` boot phase and the handoff target
    // creation run through this single primitive: the canonical fresh-root
    // binding (durable TeamSession + team-root binding + honest-v2 Leader
    // mint) and, ONLY for a with-context handoff, the target Root Agent
    // start plus the frozen-context acceptance through the real Agent
    // input/context seam. The boot create passes no initialContext (the
    // live layer's one-shot `boot()` owns the boot-time root agent); the
    // handoff passes the frozen HandoffContext (at-least-once delivery,
    // deduped by contextToken in the target). There is NO second Team
    // runtime for the handoff: the target is a plain fresh-bound team
    // root of THIS row's domain.
    /**
     * T12-B6 — the with-context fail-closed preflight: a handoff carrying
     * a frozen context requires the live glue to provide BOTH the target
     * Root Agent creation and the context delivery seam. Runs BEFORE any
     * durable mutation (a failed preflight leaves no partial team).
     */
    const requireHandoffAgentPorts = () => {
        const start = live.createRootAgent;
        const deliver = live.deliverRootContext;
        if (start === undefined || deliver === undefined) {
            throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE, 'a handoff with a frozen context requires the live glue to create the target Root Agent and accept the context through the real Agent input/context seam (the createRootAgent / deliverRootContext ports); this glue does not provide them — failing closed before any durable effect');
        }
        return { start, deliver };
    };
    /**
     * T12-B6 (plan §7-B4) — the ONE formal team-create-and-start entry:
     * the canonical fresh-root binding, then — only when `initialContext`
     * is present — the target Root Agent start (create-or-ensure,
     * idempotent per rootSessionId) and the frozen-context acceptance
     * through the real Agent input/context seam (at-least-once, the
     * contextToken is the explicit request identity the target dedupes
     * on). A with-context handoff is COMPLETE only after both succeeded.
     */
    const createAndStartTeam = async (input) => {
        const context = input.initialContext;
        const ports = context !== undefined ? requireHandoffAgentPorts() : undefined;
        const result = await rootBinding.bindFresh({
            rootSessionId: input.rootSessionId,
            blueprint: input.blueprint,
            generation: input.generation,
            ...(input.defaultWorkspace !== undefined
                ? { defaultWorkspace: input.defaultWorkspace }
                : {}),
        });
        const rootSessionId = result.durable?.teamSession.rootSessionId;
        if (rootSessionId === undefined) {
            throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CREATE_FAILED, `the fresh binding of root "${String(input.rootSessionId)}" reported no durable state`);
        }
        if (context !== undefined && ports !== undefined) {
            await ports.start(rootSessionId);
            await ports.deliver({
                rootSessionId,
                contextToken: context.contextToken,
                text: handoffContextText(context),
            });
        }
        return { teamSessionId: rootSessionId, rootSessionId };
    };
    // The handoff team creation (W1/BQ-16; T12-B6 re-routed through the
    // shared create-and-start primitive above): it reuses the SAME
    // fresh-root binding path the `team.create` entry drives — mint the
    // new root B DETERMINISTICALLY from the stable intentToken, pre-put
    // the TeamSession record with the handoff source provenance attached
    // (with-handoff only), then run the standard fresh binding (record
    // match-check, binding row, leader mint). The idempotency contract
    // (re-drive with the same intentToken) lands on `bindFreshTeamRoot`'s
    // existing-record branch — no re-put, no duplicate.
    const createHandoffTeam = async (intent) => {
        // The v1 CLOSED remote params carry no blueprint field on
        // handoff.create: the new team pins THIS row's bound blueprint
        // (single-blueprint row; the `staged` record stays opaque here).
        const snapshot = boundSnapshot;
        const minted = parseRootSessionId(`session-handoff-${sha256Hex(canonicalJsonStringify({ intentToken: intent.intentToken })).slice(0, 40)}`);
        const context = intent.context;
        // T12-B6 — the with-context fail-closed preflight BEFORE the
        // pre-put (no partial durable record when the glue cannot start the
        // target agent); the shared primitive re-checks after the pre-put.
        if (context !== undefined) {
            requireHandoffAgentPorts();
        }
        const existing = repos.teamSessions.get(minted);
        if (existing === undefined) {
            await repos.teamSessions.put({
                rootSessionId: minted,
                blueprint: snapshot,
                // With-handoff: the stable per-operation capture stamp keeps a
                // re-drive put identical-bytes (the idempotency contract);
                // without-handoff uses the root clock (a re-drive then hits the
                // existing-record branch and never re-puts).
                createdAt: intent.handoff !== undefined ? intent.handoff.capturedAt : now(),
                generation: 1,
                // P9-S8 (F1-lite v2) — this pre-put IS the durable record identity:
                // `bindFreshTeamRoot`'s existing-record branch matches blueprint +
                // generation only and keeps the row as-is, so the workspace
                // inheritance the create-and-start primitive forwards to the binding
                // lands on THIS row. Without it the created team's projection fold
                // cannot resolve the leader's effective workspace (member row carries
                // no workspace AND the team carries no defaultWorkspace) and fails
                // closed (service-level ProjectionError → remote untyped-error).
                ...(config.defaultWorkspace !== undefined
                    ? { defaultWorkspace: config.defaultWorkspace }
                    : {}),
                ...(intent.handoff !== undefined
                    ? { handoffSourceSessionId: parseSessionId(intent.handoff.sourceSessionId) }
                    : {}),
            });
        }
        else if (!sameSnapshotRef(existing.blueprint, snapshot) ||
            existing.generation !== 1) {
            // A pre-existing record that is not THIS creation's record: a stable
            // identity collision, not a re-drive.
            throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE, `handoff intent "${intent.intentToken}" mints root "${String(minted)}", which already carries an incompatible TeamSession record (stable identity collision — not a re-drive)`);
        }
        // T12-B6 — the shared formal primitive: the standard fresh binding,
        // then (with-context only) the target Root Agent start + the
        // frozen-context acceptance through the real Agent input/context
        // seam (at-least-once, deduped by contextToken in the target).
        return createAndStartTeam({
            rootSessionId: minted,
            blueprint: snapshot,
            generation: 1,
            // P9-S8 — the created team inherits the host default workspace (the
            // boot create passes it too; without it the created team's projection
            // fold cannot resolve the leader's effective workspace and fails
            // closed).
            ...(config.defaultWorkspace !== undefined
                ? { defaultWorkspace: config.defaultWorkspace }
                : {}),
            initialContext: context,
        });
    };
    const handoff = createHandoffService({
        sourceSurface: {
            // Stage 1: the EXACTLY-ONE canonical surface freeze through the DSH
            // public session-read authority (./handoff-surface.js).
            readCanonicalSurface: (sourceSessionId) => readCanonicalSourceSurface(requireSessionQuery(), sourceSessionId),
        },
        summarizer: {
            // Stage 2: the one-shot NON-MODEL deterministic digest (pure — the
            // same frozen surface always yields the same summary).
            summarize: (surface) => Promise.resolve(summarizeSourceSurface(surface)),
        },
        teamCreation: {
            // Stage 4: the new Root B through the existing fresh-root binding
            // (the team.create creation entry's binding) with the handoff as the
            // new team's source provenance.
            createTeam: (intent) => createHandoffTeam(intent),
        },
        clock: now,
    });
    // BQ-17 (P8-S7-R4 W2): the handoff state/provenance read surface — the
    // service's in-memory operation view (source Session provenance,
    // snapshot/summary status, failure choices/state, created Team identity)
    // joined with the durable provenance of the created team (the
    // `handoffSourceSessionId` record field — TeamDomain is the sole durable
    // authority, invariant 41).
    const handoffRead = {
        describe(input) {
            const view = handoff.describeOperation(input.sourceSessionId, input.requestToken);
            const createdTeamId = view.team === null ? undefined : view.team.rootSessionId;
            const record = createdTeamId === undefined ? undefined : repos.teamSessions.get(createdTeamId);
            const createdTeam = view.team === null || record === undefined
                ? undefined
                : {
                    teamSessionId: view.team.teamSessionId,
                    rootSessionId: view.team.rootSessionId,
                    ...(record.handoffSourceSessionId !== undefined
                        ? { handoffSourceSessionId: record.handoffSourceSessionId }
                        : {}),
                };
            return {
                sourceSessionId: view.sourceSessionId,
                requestToken: view.requestToken,
                known: view.known,
                snapshotStatus: view.snapshotStatus,
                state: view.state,
                ...(createdTeam !== undefined ? { createdTeam } : {}),
            };
        },
    };
    // --- A29 the legacy read-only session reader -----------------------------------------------------
    // The production ENTRY loads the frozen reader's emitted JS by computed
    // URL (packages/legacy is compiled separately — noCheck — because its
    // pre-existing type errors must never surface in this program); the root
    // consumes that function through this injected port typed by the frozen
    // surface snapshot (./legacy-surface.js).
    const legacy = {
        inspect: legacyInspect,
    };
    // --- A22 + A23 the mutation service + the governance override admission -------------------------
    const policyReader = {
        readBlueprintEnvelope: () => {
            const values = capabilityValuesOf(blueprint.capabilityPolicy);
            return values === undefined ? {} : { values };
        },
        // The bound blueprint snapshot carries no per-template capability
        // policy values (the vNext blueprint template is persona +
        // model/context policy tokens) — the honest empty template policy.
        readTemplatePolicy: () => ({}),
        readExternalFacts: () => config.externalPolicyFacts,
    };
    const defaultOverrideStore = {
        list: (rootSessionId) => Promise.resolve(repos.overrides.list(rootSessionId)),
        put: (record) => repos.overrides.put(record),
    };
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
    const durableMutation = createDurableMutationStore(createEphemeralMutationStore(), repos, rootSid, now);
    const mutationStore = durableMutation.store;
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
        admitGovernanceOverride: (args, store) => admitGovernanceOverride(args, store ?? defaultOverrideStore),
        resolveDurableModelSelection,
        resolveDurableMcpFacet,
    };
    // --- A30 the projection service (durable source + the S6 overlay seam) ---------------------------
    const seams = {
        projectionLiveOverlay: createProjectionLiveOverlaySeam(),
        remoteHandlerRegistration: createRemoteHandlerRegistrationSeam(),
        serverPrincipalDerivation: createServerPrincipalDerivationSeam(),
        remoteQueryCommandCompletion: createRemoteQueryCommandCompletionSeam(),
    };
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
    const readPortDeps = {
        templates: (row) => {
            const resolved = catalog.resolve(row.blueprint.blueprintId, row.blueprint.revision);
            const templateOf = (kind, template, instanceQuota) => ({
                kind,
                templateId: template.templateId,
                displayName: template.displayName ?? template.templateId,
                ...(template.description !== undefined ? { description: template.description } : {}),
                contextPolicy: template.contextPolicy !== undefined && isContextPolicy(template.contextPolicy)
                    ? template.contextPolicy
                    : DEFAULT_CONTEXT_POLICY,
                ...(instanceQuota !== undefined ? { instanceQuota } : {}),
            });
            return [
                templateOf('leader', resolved.leader, undefined),
                ...resolved.members.map((member) => templateOf('member', member, resolved.quotas?.members?.maxInstances)),
            ];
        },
        policyState: (rootSessionId) => activePolicyState(mutationStore.listTransitions(rootSessionId), Number.MAX_SAFE_INTEGER).stateId,
        // R2-2 (P8-S7-R2): the BQ-08 resolved effective-config view (F01-F08,
        // G01, G02, G05, G06, G09, H04, H12, L11). The resolver runs the
        // two-stage policy resolution over the SAME durable transition rows the
        // mutation service writes (the R2-1 cache), the merged mutation-store +
        // governance-override records, and the bound policy reader, at the
        // maximum step horizon: the process-local applied-record state is not
        // durable, so boundary-pending changes are reported conservatively as
        // pending (appliedRecordIds empty). A resolver failure degrades the
        // lane to the closed default, never the row (fail closed).
        effectiveConfig: (rootSessionId, member) => {
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
                    transitions: mutationStore.listTransitions(rootSessionId),
                    records: mutationStore.listRecords(rootSessionId),
                    overrides: repos.overrides.list(rootSessionId),
                    policyReader,
                });
            }
            catch {
                return null;
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
        modelState: (rootSessionId, instanceId) => {
            try {
                return createModelStateView({
                    teamSessionId: rootSessionId,
                    instanceId,
                    currentStep: 0,
                    staticModel: {
                        provider: config.staticModel.provider,
                        model: config.staticModel.model,
                    },
                    transitions: mutationStore.listTransitions(rootSessionId),
                    records: mutationStore.listRecords(rootSessionId),
                    overrides: repos.overrides.list(rootSessionId),
                    policyReader,
                });
            }
            catch {
                return undefined;
            }
        },
    };
    // R2-2 (P8-S7-R2): the production projection is stamped v2 — the
    // effective-config lane of the v2 member row is a closed field set of the
    // v1 row (the v2 entry is a structural superset of the v1 entry,
    // validated per schema version by the pipeline).
    const projection = createProjectionService(createTeamDomainReadPort(domain, readPortDeps), createFailClosedOverlayProxy(seams.projectionLiveOverlay), { clock: now, schemaVersion: 2 });
    /** P9-S8 — durable ownership of a TeamSession root: the host owns the
     *  root when a TeamSession record exists for it (the boot root gets its
     *  record at boot; teams created after boot through the public remote
     *  creation faces — `team.create` / `handoff.create` — get theirs in the
     *  binding). The remote bound-root guard and the principal claim checks
     *  accept the bound root AND any owned root; a malformed id is NOT owned
     *  (fail-closed). */
    function ownsTeamSessionRoot(teamSessionId) {
        try {
            return repos.teamSessions.get(teamSessionId) !== undefined;
        }
        catch {
            return false;
        }
    }
    // --- A32 + A30 the principal derivation + the live overlay (installed once) ----------------------
    seams.serverPrincipalDerivation.install(createServerPrincipalDerivation({
        rootSessionId: rootSid,
        repositories: repos,
        isOwnedRoot: ownsTeamSessionRoot,
        leaderInstanceId: LEADER_INSTANCE_ID,
    }));
    seams.projectionLiveOverlay.install(createLiveResidencyOverlay({ repositories: repos, live, rootSessionId: rootSid, now }));
    // --- A31 + A33 + A34 the remote surfaces (built once, installed once) -----------------------------
    const remoteSurfaces = createS6RemoteSurfaces({
        rootSessionId: rootSid,
        isOwnedRoot: ownsTeamSessionRoot,
        ...(config.defaultWorkspace !== undefined
            ? { defaultWorkspace: config.defaultWorkspace }
            : {}),
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
        mutationTransitions: (teamSessionId) => mutationStore.listTransitions(teamSessionId),
        admitGovernanceOverride: (args, store) => mutation.admitGovernanceOverride(args, store),
        overrideStore: defaultOverrideStore,
        overrideRecords: (teamSessionId) => repos.overrides.list(teamSessionId),
        rootBinding,
        compatibility: prober,
        handoff,
        // A28 (P8-S7-R4): the handoff prepare producer — the EXACTLY-ONE
        // canonical surface freeze through the DSH public sessionQuery
        // service + the one-shot NON-MODEL deterministic digest (remote-safe
        // `summary` payload for `handoff.prepare`).
        handoffPrepare: (sourceSessionId) => readCanonicalSourceSurface(requireSessionQuery(), sourceSessionId).then((surface) => summarizeSourceSurface(surface)),
        legacyInspect,
        legacyHome: params.legacyHome,
        principal: seams.serverPrincipalDerivation.current(),
        // T12-V16: remote member.send routes through the P6-T3 messaging
        // coordinator (facade admission + live delivery + confirmation),
        // closing the admission-only silence window pinned by run #13.
        messaging,
        now,
    });
    seams.remoteQueryCommandCompletion.install(remoteSurfaces.completion);
    seams.remoteHandlerRegistration.install(remoteSurfaces.registration);
    // --- A04 the intent surface (the remote method catalog) --------------------------------------------
    const intent = { catalog: REMOTE_METHOD_CATALOG };
    // --- the ten Team tools (the glue registers them on the agent setup) ------------------------------
    const tools = createTeamTools({
        teamRuntime: runtime,
        controlService: control,
        messaging,
        activity,
        resolveCaller: live.resolveCaller,
    });
    teamToolsRef.current = tools;
    // --- boot (create phase: fixture seed OR real fresh-root create + live
    // --- boot; resume phase: durable-identity load (T12-B2) + live boot) ---------------
    /**
     * The frozen deterministic SEED world (T12-B1: fixture-mode ONLY).
     *
     * Reachable only through the explicit `fixtureWorld` opt-in or the
     * documented legacy-compatibility trigger (non-empty `seedMembers` —
     * the old dev harness / legacy tests, plan §7-B1 "保留 helper 供旧
     * test/harness 使用"). The normal shipped create NEVER calls this.
     *
     * The deterministic seed puts of the frozen scenario contract (the
     * exact rows the previous harness seeded, moved INTO the production
     * root so the harness stays a pure consumer): the team root row, the
     * team-root binding, the leader member row (inst-leader — seeded
     * structurally from the frozen constants; its child session IS the
     * root session, matching the P6-T6-era seed the frozen W1 state
     * check asserts), and the row-config seed member pairs. Each put is
     * idempotent (skipped when the row already exists).
     */
    async function seedBootWorld() {
        const teamSessions = repos.teamSessions;
        const sessionBindings = repos.sessionBindings;
        const memberInstances = repos.memberInstances;
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
            };
            await teamSessions.put(input);
        }
        if (sessionBindings.get(rootSid) === undefined) {
            await sessionBindings.put({
                kind: 'team-root',
                schemaVersion: 1,
                sessionId: rootSid,
            });
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
            };
            await memberInstances.put(leaderInput);
        }
        for (const seed of config.seedMembers) {
            if (memberInstances.get(rootSid, seed.instanceId) !== undefined)
                continue;
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
            };
            await memberInstances.put(input);
        }
    }
    // --- T12-B1 — the fixture-world trigger (plan §7-B1) -------------------------------
    // The frozen deterministic seed world is reachable ONLY through:
    //   1. explicit opt-in — `fixtureWorld: true` (the plan's "test fixture
    //      mode": the preferred, explicit separation), or
    //   2. the documented legacy-compatibility trigger — a NON-EMPTY
    //      `seedMembers` (plan §7-B1 "保留 helper 供旧 test/harness 使用":
    //      the old dev harness and the legacy test worlds keep their
    //      seeded scenario rows).
    // The normal SHIPPED create sets neither (no flag, empty seedMembers)
    // and therefore NEVER reaches seedBootWorld: it runs the real
    // production create below.
    const fixtureWorld = config.fixtureWorld === true || config.seedMembers.length > 0;
    let bootStarted = false;
    const boot = async () => {
        if (bootStarted)
            return;
        bootStarted = true;
        if (config.bootPhase === 'create') {
            if (fixtureWorld) {
                // The legacy/test fixture world (unchanged frozen contract).
                await seedBootWorld();
            }
            else {
                // T12-B1 — the REAL production create (plan §7-B1 target flow):
                // the shared create-and-start primitive (T12-B6) mints the
                // durable Team identity — TeamSession record + team-root binding
                // + Leader instance (honest v2 shape) — from the row's bound
                // blueprint and generation, with the row clock as createdAt.
                // Idempotent on re-run (existing-record verification branch):
                // re-booting a create over an already-created root re-verifies,
                // it never re-mints. ZERO fabricated members: nothing beyond the
                // canonical leader is seeded. No initialContext here: the real
                // Root Agent is created by live.boot() below (the live layer's
                // one-shot create phase creates the root agent for rootSid; an
                // empty seedMembers creates no member children) — the
                // target-agent ports stay untouched by the boot create.
                await createAndStartTeam({
                    rootSessionId: parseRootSessionId(rootSid),
                    blueprint: boundSnapshot,
                    generation: config.generation,
                    ...(config.defaultWorkspace !== undefined
                        ? { defaultWorkspace: config.defaultWorkspace }
                        : {}),
                });
            }
        }
        else {
            // T12-B2 — the REAL production resume (plan §7-B2 target flow):
            // LOAD the existing durable Team identity — the TeamSession
            // record, the team-root binding, the member residency (the Leader
            // row at minimum) — and fail closed when any of it is missing.
            // A resume NEVER re-mints: by construction this branch writes
            // nothing (the mint paths are the create branches only), and the
            // acceptance after create -> restart -> resume is the same
            // RootSessionId, the same MemberInstance, the same deterministic
            // child SessionIds, and no duplicate Team/member rows. The live
            // layer then reconciles the real Agents below (root resume + the
            // bound children, through the agents service only).
            if (repos.teamSessions.get(rootSid) === undefined) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_RESUME_STATE_MISSING, `the resume of root "${rootSid}" found no durable TeamSession record — a resume loads the existing Team identity, it never mints one (the create boots it)`);
            }
            const binding = repos.sessionBindings.get(rootSid);
            if (binding === undefined || binding.kind !== 'team-root') {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_RESUME_STATE_MISSING, `the resume of root "${rootSid}" found no durable team-root binding — a resume loads the existing Team identity, it never mints one`);
            }
            if (repos.memberInstances.get(rootSid, LEADER_INSTANCE_ID) === undefined) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_RESUME_STATE_MISSING, `the resume of root "${rootSid}" found no durable Leader member row — a resume loads the existing member residency, it never mints one`);
            }
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
            await prober.probe(PROBE_TRIGGERS.STALE_GENERATION_BEFORE_NEW_WORK);
        }
        // Boot-phase durable content (T12-B1 / T12-B2): the FIXTURE create
        // seeds the frozen scenario rows (teamSessions row + team-root
        // binding + leader + seed member rows, no child `team-member`
        // bindings); the REAL create runs the canonical fresh-root binding
        // (TeamSession + team-root binding + Leader mint — no fabricated
        // members); the RESUME phase writes nothing new — it LOADS the
        // existing durable Team identity (TeamSession + team-root binding +
        // Leader member row, fail-closed when any is missing — T12-B2: a
        // resume never re-mints) and then re-establishes the live residency
        // through the agents service only (resume of the root + the bound
        // children; create of the root happens in the create phase only).
        // The cold rehydration nodes (A06 / A09) remain assembled and
        // reachable on the root surface (T1-proven against a consistent
        // fresh world) but are DORMANT in the boot flow: driving them at
        // resume would require durable state the boot flow does not own.
        // R2-1: restore the durable PolicyState transitions of this root
        // (admitted by a previous process) into the in-memory mutation cache
        // BEFORE the live flow — the projection and the remote surface must
        // already report the durable state on the first read of a resumed
        // root (the durable ledger is the source of truth; module docs:
        // ./durable-mutation-store.js). No-op on a fresh world (empty
        // ledger lane).
        await durableMutation.preload();
        await live.boot();
    };
    // --- close ------------------------------------------------------------------------------------------
    let closeStarted = false;
    const close = async () => {
        if (closeStarted)
            return;
        closeStarted = true;
        // R2-1: flush the scheduled durable PolicyState writes BEFORE the
        // live / domain close (a write to an already-closed domain would
        // fail; the flush surfaces any recorded failure to the caller).
        await durableMutation.flush();
        await live.close();
        await domain.close();
    };
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
        handoffRead,
        legacy,
        projection,
        seams,
        live,
        tools,
        boot,
        close,
    };
}
//# sourceMappingURL=root.js.map