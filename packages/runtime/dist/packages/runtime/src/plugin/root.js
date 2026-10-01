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
 * | A22  | mutation plane (read cache)               | durable-backed transition store               |
 * | A23  | governance mutation authority (PR-A)      | `createGovernanceMutationService`             |
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
 * - **The A22/A23 mutation plane (pre-alpha3 PR-A, ADR-03)**: the
 *   SINGLE production write authority is the governance mutation
 *   service (`createGovernanceMutationService`) — the durable
 *   `overrides` repository + the PolicyState transition ledger rows,
 *   serialized on the shared per-team chain, committed BEFORE the ack.
 *   The transition read cache is durable-backed (boot preload); the
 *   old production `MutationService` instance + the remote-side
 *   `admitGovernanceOverride` glue are demoted (the persistence
 *   primitive + the pure P7-T2 kernel — neither is a production
 *   authority).
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected live-agent glue bundle).
 * @module @dsh-agent-team/runtime/plugin/root
 */
import { createBlueprintCatalog, parseBlueprint, sha256Hex, } from '../../../domain/blueprint/src/index.js';
import { DEFAULT_CONTEXT_POLICY, isContextPolicy } from '../../../domain/member/src/index.js';
import { CAPABILITY_NAME_VALUES, DEFAULT_POLICY_STATE_ID, selectiveToTemplatePolicyValues, staticCapabilitiesOf, } from '../../../domain/policy/src/index.js';
import { canonicalJsonStringify, createBlueprintSnapshotRef, createMemberIdentity, LEADER_INSTANCE_ID, leaderMemberIdentityOf, parseBlueprintContentHash, parseBlueprintId, parseBlueprintRevision, parseRootSessionId, parseSessionId, } from '../../../contracts/src/index.js';
import { REMOTE_METHOD_CATALOG, } from '../../../remote/src/contracts/catalog.js';
import { createTeamDomainWritePort, bindFreshTeamRoot, rehydrateColdTeamRoot, } from '../../root-binding/index.js';
import { createFreshMember, createMemberDomainWritePort, rehydrateColdMember, } from '../../member-residency/index.js';
import { TeamAgentBinder, createTeamDomainReadHandle, } from '../../agent-setup/binder/index.js';
import { createPersonaOverlaySlot } from '../../agent-setup/persona/index.js';
import { blockedScopeKeysOf, grantDegradationConsent, PENDING_BLOCK, PREFLIGHT_OUTCOMES, runCreationPreflight, setTemplateAvailabilityFact, SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID, scopeRequirementInputsOf, shippedStatePersonaObserver, } from '../../requirements/index.js';
import { requirementFactScopeRoleOf } from '../../requirement-facts/index.js';
import { TeamModelOverlaySlot, TeamModelSelectionAdapter, resolveDurableModelSelection, initialTemplateModelGrantOf, } from '../../agent-setup/model/index.js';
import { CAPABILITY_FACETS, createCapabilityOverlaySlot, resolveDurableMcpFacet, } from '../../agent-setup/capability/index.js';
import { createActivationProvider } from '../../activation/index.js';
import { ACTION_NAMES, enforceCompatibilityGate, readRequirementFacts, TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError, } from '../../admission/index.js';
import { commitDurableFact, createAdmitRootInitialWork, createTeamRuntime, withTeamLock, } from '../../action-router/index.js';
import { createTeamOperationCoordinator } from '../../coordination/index.js';
import { createLifecycleService } from '../../lifecycle/index.js';
import { PROBE_TRIGGERS, createCompatibilityAuthority, createCompatibilityProber, } from '../../compatibility/index.js';
import { createControlService, createLeaderControlNotifier } from '../../control/index.js';
import { createWorkCompletionNotifier } from '../../work-completion-notification/index.js';
import { createMessagingCoordinator } from '../../messaging/index.js';
import { createActivityLedger, createWorkActivityWriter, } from '../../activity/index.js';
import { createTeamDomainForkPort, reconcileForkSidecar, } from '../../fork-reconciliation/index.js';
import { createHandoffService } from '../../handoff/index.js';
import { readCanonicalSourceSurface, summarizeSourceSurface, } from './handoff-surface.js';
import { createProjectionService } from '../../projection/index.js';
import { createTeamTools } from '../../../tools/src/index.js';
import { createGovernanceMutationService } from '../../governance/index.js';
import { createFailClosedOverlayProxy, createProjectionLiveOverlaySeam, createRemoteHandlerRegistrationSeam, createRemoteQueryCommandCompletionSeam, createServerPrincipalDerivationSeam, } from './seams.js';
import { createTeamDomainReadPort } from './projection-source.js';
import { createEffectiveConfigView } from './effective-config-view.js';
import { createModelStateView } from './model-state-view.js';
import { createDurableMutationStore, listDurablePolicyStateTransitions, writePolicyStateTransitionRow, } from './durable-mutation-store.js';
import { committedPolicyState } from '../../effective-policy/index.js';
import { createLiveResidencyOverlay } from './s6-live-overlay.js';
import { computeTeamLiveToken } from './live-token.js';
import { resolveSessionReadState } from './team-read-state.js';
import { createServerPrincipalDerivation } from './s6-principal.js';
import { createS6RemoteSurfaces } from './s6-remote.js';
import { buildTeamRootOwnershipIndex, toTeamRootWireRow } from '../team-ownership-index.js';
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
 * alpha.1 (plan §10.3) — resolve the bound-blueprint template of one
 * member identity for the static template policy read:
 *
 * - the LEADER resolves by position (Architecture §5.3/§6.1: the
 *   LeaderTemplate IS the leader's template — the durable v2 leader row
 *   carries the same templateId, the position is the authority);
 * - a MEMBER resolves through its DURABLE MemberInstance row's
 *   `templateId` (the row is the backend truth — never a caller claim;
 *   the row is re-read on every call, so a cold resume re-derives the
 *   same template from the durable identity, plan §10.9).
 *
 * An absent row (an identity the domain has no record for) or a row
 * whose templateId names no template of the bound blueprint resolves to
 * `undefined` — the caller then reads the honest empty template policy
 * (no template authority for that identity).
 *
 * @param blueprint - the bound Blueprint snapshot (the row's one
 *   blueprint document).
 * @param teamSessionId - the TeamSession the member belongs to (a branded
 *   id upstream; this helper takes `string` — the repository `get` is
 *   string-typed and the comparison is by exact value).
 * @param instanceId - the member's stable instance id.
 * @param memberInstances - the durable member-instance repository.
 * @returns the template, or `undefined` (no template authority).
 */
function staticTemplateOf(blueprint, teamSessionId, instanceId, memberInstances) {
    if (instanceId === LEADER_INSTANCE_ID)
        return blueprint.leader;
    const row = memberInstances.get(teamSessionId, instanceId);
    if (row === undefined || row === null)
        return undefined;
    const templateId = String(row.templateId ?? '');
    if (templateId === '')
        return undefined;
    return blueprint.members.find((entry) => String(entry.templateId) === templateId);
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
    const { config, domain, storageSeam, live, now, teamToolsRef, controlServiceRef, legacyInspect, getSessionQuery, workspaceAttach, blueprintCatalog, blueprintAuthority, resolveBoundBlueprint, requirementFacts, } = params;
    const repos = domain.repositories;
    const rootSid = config.rootSessionId;
    // --- A02 handle / write ports ------------------------------------------------------
    const readHandle = createTeamDomainReadHandle(repos);
    const rootWritePort = createTeamDomainWritePort(repos);
    const memberWritePort = createMemberDomainWritePort(repos);
    // --- A03 blueprint + catalog ---------------------------------------------------------
    // BP5 (issue #2 blueprint-loading, plan §9): the bootstrap anchor stays
    // the strong-parsed row source (the host/compatibility wiring keeps
    // using it); the CATALOG is the injected live one when provided, else
    // the legacy static single-blueprint catalog (the factory-world
    // fallback — every consumer below derives from this single variable).
    const blueprint = parseBlueprint(config.blueprintSource);
    const catalog = blueprintCatalog ?? createBlueprintCatalog([blueprint]);
    // The GENERIC per-root bound Blueprint resolver (model-preference routing
    // fix, guide §4.7.1): ONE per-root cache shared by EVERY consumer that
    // needs the owning root's bound snapshot (the persona source, the
    // policyReader's blueprint envelope, the policyReader's template policy
    // — and the live glue's own resolver). Production path (a resolver is
    // injected): the resolver is the authority under the exact three-case
    // contract of bound-blueprint.ts — a row WITH a bound ref NEVER
    // consults the row anchor (it fails closed typed on an unavailable /
    // inconsistent snapshot, and the binder wraps that as
    // BINDER_OVERLAY_FAILED); a no-ref pre-repair legacy row resolves to
    // the row anchor BY DEFINITION (the documented legacy binding — legacy
    // rows predate per-team binding, so the anchor IS their bound
    // blueprint; that is not a fallback to a different blueprint).
    // Factory/test world (no resolver): the bootstrap `blueprint` stands in
    // for every root (the single-blueprint factory contract).
    const boundBlueprintByRoot = new Map();
    const boundBlueprintFor = (teamSessionId) => {
        if (resolveBoundBlueprint === undefined) {
            return blueprint; // factory-world fallback only
        }
        const key = String(teamSessionId);
        const cached = boundBlueprintByRoot.get(key);
        if (cached !== undefined)
            return cached;
        const resolved = resolveBoundBlueprint(key);
        boundBlueprintByRoot.set(key, resolved);
        return resolved;
    };
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
    // pre-alpha3 W3-A (review fix F1, guide §2.3) — the LIVE environment feed
    // switch (the #42 consumer switch of B's W2-A provider): with the
    // requirement-facts authority present (the production host entry world)
    // the Team scope's facts resolve FRESH from the live provider on every
    // read (the provider's 3-state → 2-state projection IS the engine feed:
    // reachable→true, unreachable→false, unknown+seed→the bootstrap seed,
    // unknown+no-seed→omitted — the engine's documented "absence = unprobed"
    // fail-closed sentinel). The row `config.environmentFacts` stays the
    // BOOTSTRAP SEED (the host wired it to the provider's `seedFacts` port) —
    // NEVER the runtime truth (guide §2.5: static available:true + live
    // unreachable → the required BLOCK). Without the authority (factory
    // worlds) the legacy static row feed stands, byte-for-byte.
    const environmentFacts = requirementFacts === undefined
        ? async () => config.environmentFacts.map((fact) => ({
            domain: fact.domain,
            subject: fact.subject,
            available: fact.available,
            generation: fact.generation,
        }))
        : async () => (await requirementFacts.provider.resolveFacts({
            requirements: scopeRequirementInputsOf(blueprint).team,
            scope: { kind: 'team' },
        })).environmentFacts;
    // pre-alpha3 W3-A (review fix F1, guide §2.3) — the per-TEMPLATE scope
    // facts feed (the template boundary: supply + fresh readiness +
    // materialization — a COLD member is `not-applicable`, never a blocker; a
    // resident member's failed MCP mount blocks that template's work).
    // Per-scope feeds only: the team scope's and a template scope's
    // (domain, subject) pairs may collide, and the engine keys its probes by
    // (domain, subject) — unioning the feeds would conflate the scopes.
    // Absent without the authority (factory worlds): the gate evaluates every
    // scope against the single team-scope array (the legacy behavior).
    const templateEnvironmentFacts = requirementFacts === undefined
        ? undefined
        : (templateId) => {
            const templateInputs = scopeRequirementInputsOf(blueprint).templates;
            const requirements = templateInputs[templateId] ?? [];
            return requirementFacts.provider
                .resolveFacts({
                requirements,
                // Blocker-1: the template scope carries its role identity
                // (the bound blueprint knows its leader template id — the
                // leader IS the root: the root mounts config.rootPresetId).
                scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(blueprint.leader.templateId, templateId) },
            })
                .then((resolution) => resolution.environmentFacts);
        };
    // pre-alpha3 W3-A (review fix F1, guide §2.3) + PF-1 fix (2026-09-30,
    // adjudicated product defect) — the SINGLE dynamic per-blueprint live
    // facts source. The W3-A thunks above resolve the live provider against
    // the BOOT blueprint's requirements — correct for the boot root's OWN
    // consumption (the prober / authority / activation below), but the same
    // boot-scoped feed was ALSO shared with every consumer that evaluates an
    // ARBITRARY blueprint's requirements: the remote surface's `intent.probe`
    // (the requested blueprint), the per-root compatibility prober (each
    // created root's bound blueprint), and the new-work / initial-work
    // admission gates (each request's bound blueprint). On a multi-blueprint
    // host (boot blueprint ≠ the probed/bound blueprint) the feed was
    // mis-scoped — the engine's "missing = unprobed" fail-closed then turned
    // a CONFIGURED + HEALTHY live server into a spurious FATAL, breaking the
    // frozen INV-9.4 two-worlds identity (s6-remote.ts: the probe is a
    // FAITHFUL PREDICTOR of the post-creation admission gate — the SAME
    // world). These sources resolve the provider against the passed
    // blueprint's own scope, so every such consumer evaluates its blueprint
    // against its own feed (one seam — no per-consumer patches).
    //
    // Factory worlds (no authority): the legacy static row feed stands
    // byte-identically (the static facts are not blueprint-scoped — the
    // blueprint argument is ignored, exactly as pre-W2-A); the per-template
    // feed is ABSENT (the legacy single-array gate), matching the thunks
    // above.
    const environmentFactsForBlueprint = (target) => requirementFacts === undefined
        ? Promise.resolve(config.environmentFacts.map((fact) => ({
            domain: fact.domain,
            subject: fact.subject,
            available: fact.available,
            generation: fact.generation,
        })))
        : requirementFacts.provider
            .resolveFacts({
            requirements: scopeRequirementInputsOf(target).team,
            scope: { kind: 'team' },
        })
            .then((resolution) => resolution.environmentFacts);
    const templateEnvironmentFactsForBlueprint = requirementFacts === undefined
        ? undefined
        : (target, templateId) => {
            const requirements = scopeRequirementInputsOf(target).templates[templateId] ?? [];
            return requirementFacts.provider
                .resolveFacts({
                requirements,
                // Blocker-1: the template scope carries its role identity
                // (the bound blueprint knows its leader template id — the
                // leader IS the root: the root mounts config.rootPresetId).
                scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(target.leader.templateId, templateId) },
            })
                .then((resolution) => resolution.environmentFacts);
        };
    // D-3 (2026-09-30, adjudicated product semantics — fail-closed PENDING)
    // — the FULL-resolution per-blueprint seams (the atomic facts + 3-state
    // observations pair of ONE `resolveFacts` call). The D-1 facts seams
    // above drop the observations; the DECISION consumers (the router /
    // admit requirement gates, the activation provider's step 6, the
    // creation preflight, the remote probe) need the 3-state truth of the
    // SAME call whose facts the verdict reads, to apply the PENDING rule
    // (a REQUIRED requirement whose live observation is `unknown` blocks
    // with the typed PENDING outcome — never a seed-filled PASS; plan §C.3
    // 禁止 false OPEN + E.3 + E.11 negative #10). Factory worlds: the
    // static row feed with EMPTY observations — no live probe ⇒ no pending
    // materialization ⇒ the PENDING rule stays off (byte-identical).
    const environmentFactsReadForBlueprint = (target) => requirementFacts === undefined
        ? Promise.resolve({
            observations: [],
            environmentFacts: config.environmentFacts.map((fact) => ({
                domain: fact.domain,
                subject: fact.subject,
                available: fact.available,
                generation: fact.generation,
            })),
            resolvedAt: now(),
        })
        : requirementFacts.provider.resolveFacts({
            requirements: scopeRequirementInputsOf(target).team,
            scope: { kind: 'team' },
        });
    const templateEnvironmentFactsReadForBlueprint = requirementFacts === undefined
        ? undefined
        : (target, templateId) => {
            const requirements = scopeRequirementInputsOf(target).templates[templateId] ?? [];
            return requirementFacts.provider.resolveFacts({
                requirements,
                // Blocker-1: the template scope carries its role identity
                // (the bound blueprint knows its leader template id — the
                // leader IS the root: the root mounts config.rootPresetId).
                scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(target.leader.templateId, templateId) },
            });
        };
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
    // pre-alpha3 W3-A (review fix F1, guide §2.3): the preset seam is the
    // TYPED substrate authority — NEVER a silent hardcode. Three sources, in
    // order:
    //
    //   1. `config.presetSubstrate` — the SCRIPTED test-world port (the T12-M2
    //      worlds script the observed persona three-state; byte-for-byte the
    //      legacy behavior).
    //   2. the production host's LIVE substrate plan (pre-alpha3 W2-A,
    //      review fix F14: `requirementFacts.resolveSubstratePlan` — the row
    //      preset ids + the production persona observer over the DSH public
    //      `agentPresets` seam; a settled plan is memoized by the host, an
    //      unresolved one re-probes — the shipped-state GUESS is gone from
    //      the production path: the production observer observes, and a
    //      failure stays `unresolved`, never a kind). The sync seam cannot
    //      express a PENDING observation, so the production bind settles the
    //      plan in the rootBinding `bindFresh` wrapper (below) BEFORE any
    //      overlay slot applies — `getSubstrate` then reads the settled
    //      entry. A plan FAILURE or a settled `unresolved` root observation
    //      still fails closed (typed throw — the bind never starts work on a
    //      guessed persona).
    //   3. the FACTORY world (no host authority, no scripted port): the
    //      legacy shipped-state observation (the deployment default's
    //      composable persona — the TYPED, NAMED `shippedStatePersonaObserver`,
    //      computed synchronously — the shipped-state adapter is a pure
    //      deployment-knowledge observation with no probe to await; byte-for-
    //      byte the pre-W3-A factory behavior). NOT the production path: the
    //      production host entry ALWAYS passes the `requirementFacts`
    //      authority (source 2).
    // ONE plan promise for this root (captured at construction): the
    // production host memoizes it once settled, and the rootBinding
    // `bindFresh` wrapper (below) awaits the SAME promise before the bind —
    // one observer round-trip per boot, shared with the glue's production
    // persona slot. Absent for factory worlds (the legacy shipped-state
    // observation needs no probe) and scripted test worlds (the port is the
    // authority there).
    const productionSubstratePlan = config.presetSubstrate === undefined && requirementFacts !== undefined
        ? requirementFacts.resolveSubstratePlan()
        : undefined;
    let settledSubstratePlan;
    let substratePlanFailure;
    let substratePlanFailed = false;
    if (productionSubstratePlan !== undefined) {
        // Both settle handlers are attached here so a rejection is handled
        // exactly once (no unhandled rejection); the bindFresh wrapper's await
        // handles the same rejection on its own chain.
        void productionSubstratePlan.then((plan) => {
            settledSubstratePlan = plan;
        }, (error) => {
            substratePlanFailure = error;
            substratePlanFailed = true;
        });
    }
    const factorySubstratePresetId = config.rootPresetId ?? SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID;
    const presetSeam = {
        getSubstrate: () => {
            if (config.presetSubstrate !== undefined) {
                return {
                    presetId: config.presetSubstrate.presetId,
                    personaKind: config.presetSubstrate.personaKind,
                };
            }
            if (requirementFacts !== undefined) {
                if (substratePlanFailed) {
                    // The resolver's typed failure (e.g. MALFORMED_DTO — no root
                    // preset authority) propagates verbatim: fail closed, never a
                    // guessed persona (guide §2.3).
                    throw substratePlanFailure;
                }
                if (settledSubstratePlan === undefined) {
                    throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `the runtime substrate plan has not settled — the sync preset seam cannot express a pending observation (fail closed; the production bind settles the plan in the bindFresh wrapper before any overlay slot applies)`);
                }
                // The bind-time persona slot reads the ROOT entry (Architecture
                // §13.1: members inherit the root's bind substrate — the resolver
                // doc; the MEMBER observation serves the requirement authority).
                const rootEntry = settledSubstratePlan.root;
                if (rootEntry.persona.kind === 'unresolved') {
                    throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `the mounted root preset '${rootEntry.presetId}' has an UNRESOLVED persona observation (source: ${rootEntry.persona.source}) — the preset seam cannot express the failure (fail closed); ${rootEntry.persona.reason ?? 'no observation reason recorded'}`);
                }
                return { presetId: rootEntry.presetId, personaKind: rootEntry.persona.kind };
            }
            // Source 3 — the factory-world legacy shipped-state observation
            // (synchronous; byte-for-byte the pre-W3-A factory behavior: the
            // old sync resolver produced the same preset id + observed kind for
            // every world without the host authority). The shipped-state adapter
            // never produces `unresolved` (its kind is the deployment-knowledge
            // `standard`); the guard below keeps the sync seam's closed
            // `PresetPersonaKind` surface honest (typed fail-closed, never a
            // guess) in case a future adapter change ever does.
            const shippedKind = shippedStatePersonaObserver(factorySubstratePresetId).kind;
            if (shippedKind === 'unresolved') {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `the factory-world shipped-state observation is UNRESOLVED — the preset seam cannot express the failure (fail closed)`);
            }
            return {
                presetId: factorySubstratePresetId,
                personaKind: shippedKind,
            };
        },
    };
    // A2 (RC2 repair, plan §5.2): the persona source — the BOUND blueprint
    // snapshot is the persona authority for every bound Team. With the
    // injected resolver (the production host ALWAYS passes its existing
    // glue resolver) the persona resolves PER OWNING TEAM ROOT through the
    // live authority — the bound snapshot is resolved ONCE per root and
    // cached (immutable for the root's lifetime, invariant 10; parsing is
    // pure). A resolver failure PROPAGATES out of the slot's apply (the
    // binder wraps it as BINDER_OVERLAY_FAILED): fail closed, NEVER a
    // silent row-anchor fallback (plan §5.3 — "bound snapshot unavailable /
    // inconsistent" is a different failure than "templateId missing").
    // Without a resolver (factory worlds) the LEGACY row-anchor closure is
    // the explicit factory fixture authority — the pre-repair behavior,
    // unchanged.
    const anchorPersonaSource = {
        getLeaderPersona: () => blueprint.leader.persona,
        getMemberPersona: (_rootSessionId, templateId) => {
            const template = blueprint.members.find((member) => String(member.templateId) === String(templateId));
            if (template === undefined) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `no blueprint member template with templateId "${String(templateId)}"`);
            }
            return template.persona;
        },
    };
    // The resolver-backed per-root cache (A2): one resolved bound snapshot
    // per owning root (the bound snapshot is immutable for the root's
    // lifetime — invariant 10 — so the cached source stays authoritative
    // for the process; one binding per boot).
    const boundPersonaSources = new Map();
    const boundPersonaSourceFor = (rootSessionId) => {
        const key = String(rootSessionId);
        const cached = boundPersonaSources.get(key);
        if (cached !== undefined)
            return cached;
        // The shared per-root bound resolver (guide §4.7.1): the resolver-backed
        // source is selected ONLY when a resolver is injected, so
        // `boundBlueprintFor` here always resolves through the injected
        // authority (never the row-anchor fallback) — the fail-closed ruling is
        // unchanged (a resolver fault propagates; it is wrapped as
        // BINDER_OVERLAY_FAILED at the binder boundary).
        const bound = boundBlueprintFor(key);
        const source = {
            getLeaderPersona: () => bound.leader.persona,
            getMemberPersona: (_owner, templateId) => {
                const template = bound.members.find((member) => String(member.templateId) === String(templateId));
                if (template === undefined) {
                    throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `no blueprint member template with templateId "${String(templateId)}"`);
                }
                return template.persona;
            },
        };
        boundPersonaSources.set(key, source);
        return source;
    };
    const personaSource = resolveBoundBlueprint === undefined
        ? anchorPersonaSource
        : {
            getLeaderPersona: (rootSessionId) => boundPersonaSourceFor(rootSessionId).getLeaderPersona(rootSessionId),
            getMemberPersona: (rootSessionId, templateId) => boundPersonaSourceFor(rootSessionId).getMemberPersona(rootSessionId, templateId),
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
    // pre-alpha3 W3-B (review fix F6, guide §6) — the CREATION preflight
    // authority: the server-side enforcement of "Team + Leader + ALL
    // MemberTemplate requirements" BEFORE the durable Team bind. It runs on
    // the production path ONLY (the `requirementFacts` authority present;
    // factory worlds keep the legacy no-preflight behavior, byte-for-byte).
    //
    // The evaluation is the CREATION-TIME form (guide §6.2): the bound
    // snapshot ref is resolved to the full blueprint from the catalog, EVERY
    // declared scope (the Team scope + every v2 template scope — Leader
    // included; NO instance of the template is needed) is evaluated on a
    // FRESH live-facts read (the W3-A provider, per-scope feeds — the team
    // scope's and a template scope's (domain, subject) pairs may collide),
    // the durable consents + template availability are read under the
    // (pre-bind, client-minted) rootSessionId (the read is legal without a
    // TeamSession row), and the PR-E `startupPreflight` classifies.
    //
    // A non-`proceed` outcome throws the TYPED COMPATIBILITY_BLOCKED BEFORE
    // the registry freeze and before any durable write: zero durable effect
    // (no TeamSession record, no binding row, no leader mint, no fact row).
    // The human resolves through the F7 writers (the root-level
    // `requirementAuthority` services) and re-drives the creation — the
    // idempotent re-drive re-runs this preflight on fresh facts.
    const enforceCreationPreflight = (input) => {
        if (requirementFacts === undefined)
            return Promise.resolve();
        const authority = requirementFacts;
        return (async () => {
            // 1. Resolve the bound snapshot to the full blueprint (a create may
            //    name a DIFFERENT saved-source blueprint than the row's bound
            //    one — the preflight evaluates the snapshot the CREATE binds).
            let bound;
            try {
                bound = catalog.resolve(input.blueprint.blueprintId, input.blueprint.revision);
            }
            catch (error) {
                throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: the creation preflight cannot resolve the bound blueprint '${input.blueprint.blueprintId}' revision '${input.blueprint.revision}' from the catalog — the creation fails closed (zero durable effect)`, {
                    source: 'creation-preflight',
                    reason: 'blueprint-unresolvable',
                    blueprintId: input.blueprint.blueprintId,
                    revision: input.blueprint.revision,
                    cause: error instanceof Error ? error.message : String(error),
                });
            }
            if (bound.contentHash !== input.blueprint.contentHash) {
                throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: the creation preflight found a content-hash mismatch for blueprint '${input.blueprint.blueprintId}' revision '${input.blueprint.revision}' (the bound snapshot is immutable, invariant 10) — the creation fails closed (zero durable effect)`, {
                    source: 'creation-preflight',
                    reason: 'blueprint-hash-mismatch',
                    boundContentHash: input.blueprint.contentHash,
                    resolvedContentHash: bound.contentHash,
                });
            }
            // 2. FRESH per-scope feeds for THIS blueprint (the row-scoped feeds
            //    are keyed on the row's bound blueprint — they cannot serve a
            //    create naming a different one).
            const preflightTeamFacts = () => authority.provider
                .resolveFacts({ requirements: scopeRequirementInputsOf(bound).team, scope: { kind: 'team' } })
                .then((resolution) => resolution.environmentFacts);
            const preflightTemplateFacts = (templateId) => {
                const templateInputs = scopeRequirementInputsOf(bound).templates;
                return authority.provider
                    .resolveFacts({
                    requirements: templateInputs[templateId] ?? [],
                    // Blocker-1: the template scope carries its role identity
                    // (the bound blueprint knows its leader template id — the
                    // leader IS the root: the root mounts config.rootPresetId).
                    scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(bound.leader.templateId, templateId) },
                })
                    .then((resolution) => resolution.environmentFacts);
            };
            // 3. The durable consents + availability under the (future) root
            //    session id (a pre-bind read is legal — no TeamSession row is
            //    required; the pre-bind defaults are: no consents, all available).
            const durable = readRequirementFacts(repos, input.rootSessionId);
            // 4. Classify (the PR-E pure classifier, unchanged) + the D-3
            //    (2026-09-30) PENDING overlay — the full-resolution read ports
            //    (the atomic observations + feed pair; the SAME per-create
            //    blueprint scoping as the facts thunks above): a REQUIRED
            //    capability whose live observation is UNKNOWN is the typed
            //    `pending` outcome — never a seed-filled PASS (plan §C.3 禁止
            //    false OPEN + E.3).
            const result = await runCreationPreflight({
                blueprint: bound,
                environmentFacts: preflightTeamFacts,
                templateEnvironmentFacts: preflightTemplateFacts,
                environmentFactsRead: () => environmentFactsReadForBlueprint(bound),
                ...(templateEnvironmentFactsReadForBlueprint !== undefined
                    ? {
                        templateEnvironmentFactsRead: (templateId) => templateEnvironmentFactsReadForBlueprint(bound, templateId),
                    }
                    : {}),
                consents: durable.consents,
                availability: durable.availability,
            });
            if (result.outcome === PREFLIGHT_OUTCOMES.proceed)
                return;
            // 5. The TYPED block (zero durable effect; the details carry the
            //    human's resolution path — the F7 writers' inputs).
            const resolutionHint = result.outcome === PREFLIGHT_OUTCOMES.fatal
                ? 'a Team-level required requirement is down — it cannot be bypassed by disabling a template; repair the environment and re-drive the creation'
                : result.outcome === PREFLIGHT_OUTCOMES.fixOrDisable
                    ? 'a required template requirement is down — repair + recheck, or disable the template (requirementAuthority.setTemplateAvailability with available: false), then re-drive the creation'
                    : result.outcome === PREFLIGHT_OUTCOMES.pending
                        ? 'a required capability is not yet observed (materialization pending) — re-drive the creation at the next boundary (or run the compatibility reprobe); the block is recheckable, not a deadlock'
                        : 'an optional requirement is down and not consented — grant the consent (requirementAuthority.grantDegradationConsent), then re-drive the creation';
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: the creation preflight of "${input.rootSessionId}" is '${result.outcome}' — the durable Team bind is refused (zero durable effect; ${resolutionHint})`, {
                rootSessionId: input.rootSessionId,
                source: 'creation-preflight',
                outcome: result.outcome,
                blockedScopes: blockedScopeKeysOf(result),
                consentRequiredRequirementIds: [...result.consentRequiredRequirementIds],
                fixOrDisableRequirementIds: [...result.fixOrDisableRequirementIds],
                fatalRequirementIds: [...result.fatalRequirementIds],
                // D-3 (2026-09-30) — the typed PENDING details (the closed
                // typed-code family: the wire code stays COMPATIBILITY_BLOCKED;
                // the category rides the details — see PENDING_BLOCK).
                ...(result.outcome === PREFLIGHT_OUTCOMES.pending
                    ? {
                        status: PENDING_BLOCK.status,
                        gateReason: PENDING_BLOCK.gateReason,
                        recheck: PENDING_BLOCK.recheck,
                        pendingRequirementIds: [...(result.pendingRequirementIds ?? [])],
                    }
                    : {}),
            });
        })();
    };
    const rootBinding = {
        bindFresh: (input) => {
            // pre-alpha3 W3-A (review fix F1, guide §2.3): settle the production
            // LIVE substrate plan BEFORE the bind — the sync preset seam reads
            // the settled entry when the binder applies the overlay slots (it
            // cannot express a pending observation). The plan promise is the
            // SAME one the seam captured at construction (one observer
            // round-trip, host-memoized once settled); a plan FAILURE propagates
            // BEFORE the registry freeze and before any durable write (zero
            // durable effect, fail closed — no bind on a guessed persona).
            // Factory worlds (no authority) have no plan to settle.
            const settleSubstratePlan = productionSubstratePlan === undefined ? Promise.resolve() : productionSubstratePlan;
            // BP6 (issue #2 blueprint-loading, plan §10): the freeze barrier at
            // the SINGLE choke point every fresh TeamSession mint of this root
            // shares (the real create boot, team.create v1/v2, the shared
            // create-and-start primitive). The registry freeze runs BEFORE the
            // durable write (the plan's write order); the barrier is idempotent
            // (a same-hash re-freeze is a no-op). Factory worlds without an
            // injected authority keep the legacy no-freeze behavior.
            // pre-alpha3 W3-B (review fix F6, guide §6): the creation preflight
            // runs AFTER the plan settle and BEFORE the freeze — a non-proceed
            // outcome refuses the bind with ZERO durable effect (the freeze and
            // the bind writes never run); the factory branch has no preflight.
            if (blueprintAuthority === undefined) {
                return settleSubstratePlan.then(() => bindFreshTeamRoot(rootBindingPorts, input));
            }
            return settleSubstratePlan
                .then(() => enforceCreationPreflight(input))
                .then(() => blueprintAuthority.freezeSnapshot(input.blueprint))
                .then(() => bindFreshTeamRoot(rootBindingPorts, input));
        },
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
    // pre-alpha3 PR-B (plan §B.2): the production PolicyReader — the bound-
    // snapshot static authority (the bound blueprint's envelope / the
    // durable member template policy / the external hard facts). Constructed
    // HERE (before the activation provider, the router, the projection read
    // ports and the remote surface) so EVERY canonical-read consumer — the
    // activation step 8, the router's inspect-config, the R2-2/R2-3
    // projection views, the governance write-time checks, and the live
    // request boundary (through the glue) — consumes the SAME reader
    // instance (one static layer, one source).
    const policyReader = {
        // model-preference routing fix (guide §4.7.2): the blueprint envelope
        // reads the OWNING root's bound snapshot through the shared per-root
        // resolver (the pre-fix closure read the bootstrap row anchor for
        // every root — a dynamic Team root's own envelope was never read).
        readBlueprintEnvelope: (teamSessionId) => {
            const bound = boundBlueprintFor(teamSessionId);
            const values = capabilityValuesOf(bound.capabilityPolicy);
            return values === undefined ? {} : { values };
        },
        // alpha.1 (plan §10.3): the bound blueprint snapshot + the DURABLE
        // member-instance templateId -> the template's static TemplatePolicy
        // (the production `readTemplatePolicy` is no longer the unconditional
        // empty placeholder — DoD #3). A LEGACY template (no `capabilities`
        // field) keeps the original honest-empty reader for the CAPABILITY
        // cells (never a synthesized empty TemplatePolicy — the resolver's
        // fail-closed must stay untouched, plan §10.3), and an identity the
        // domain cannot resolve to a row also reads empty (honest: no template
        // authority there).
        // model-preference routing fix (guide §4.7.3): capabilities absence
        // != template policy completely absent — a legacy template (no
        // `capabilities`) that declares `modelPreference` still carries a
        // legal static template MODEL (the shared
        // `initialTemplateModelGrantOf` derivation, the SAME one the live
        // consumption / step-8 / inspect-config use). The per-root bound
        // snapshot is read through `boundBlueprintFor` (no bootstrap-anchor
        // closure).
        readTemplatePolicy: (teamSessionId, member) => {
            const bound = boundBlueprintFor(teamSessionId);
            const template = staticTemplateOf(bound, teamSessionId, member.instanceId, repos.memberInstances);
            if (template === undefined)
                return {};
            const capValues = selectiveToTemplatePolicyValues(staticCapabilitiesOf(bound, template));
            const modelValue = initialTemplateModelGrantOf(template, {
                provider: config.staticModel.provider,
                model: config.staticModel.model,
            });
            // pre-alpha3 PR-B (the canonical read plane became the PRODUCTION
            // static layer): the domain mapper emits an explicit empty allow
            // (`allow(items: [])` — the documented "deny everything" value,
            // P1 hardening §6) verbatim, but the frozen P3-T4 resolver rejects
            // an empty-allow entry as malformed ("use kind:'deny' for no
            // items"). The production reader normalizes the empty-allow cells
            // to `deny` so the SAME deny-everything semantic reaches the
            // resolver in its closed vocabulary (the mapper's contract and the
            // t1-capability-schema E1-E3 assertions are untouched).
            const normalizedValues = capValues === undefined
                ? undefined
                : Object.fromEntries(Object.entries(capValues).map(([name, entry]) => [
                    name,
                    entry !== undefined && entry.kind === 'allow' && entry.items.length === 0
                        ? { kind: 'deny' }
                        : entry,
                ]));
            const values = {
                ...(normalizedValues ?? {}),
                ...(modelValue !== undefined ? { model: modelValue } : {}),
            };
            return Object.keys(values).length === 0 ? {} : { values };
        },
        readExternalFacts: () => config.externalPolicyFacts,
    };
    // --- A16 the activation provider (the ONLY creation path) --------------------------------
    const provider = createActivationProvider({
        teamDomain: domain,
        blueprintCatalog: catalog,
        environmentFacts,
        // D-1 (2026-09-30, adjudicated product defect — the PF-1 family
        // extended to the activation provider): step 6's team / target-template
        // scopes evaluate the TARGET root's bound blueprint against the
        // TARGET-scoped live feeds (the SAME per-blueprint seam the router
        // gate / admit gate / remote probe / per-root prober consume). Pre-fix
        // the boot-scoped thunk above was handed to the provider, so a
        // multi-blueprint host evaluated the target's requirements against a
        // feed scoped to the BOOT blueprint (empty for a zero-requirement
        // boot anchor → every required requirement unobserved → spurious
        // FATAL + corrupted durable aggregates). D-3 (2026-09-30): the
        // full-resolution (facts + observations) variants carry the 3-state
        // truth for the fail-closed PENDING rule. Backward-compatible option
        // (deviations (b)/(c)): absent in factory worlds → the legacy
        // no-argument thunk stands byte-identically.
        ...(requirementFacts !== undefined
            ? {
                environmentFactsForBlueprint,
                ...(templateEnvironmentFactsForBlueprint !== undefined
                    ? { templateEnvironmentFactsForBlueprint }
                    : {}),
                environmentFactsReadForBlueprint,
                ...(templateEnvironmentFactsReadForBlueprint !== undefined
                    ? { templateEnvironmentFactsReadForBlueprint }
                    : {}),
            }
            : {}),
        externalPolicyFacts,
        staticModel: {
            provider: config.staticModel.provider,
            model: config.staticModel.model,
        },
        // pre-alpha3 PR-B (plan §B.2): the canonical step-8 input — the
        // production PolicyReader + the durable PolicyState transitions
        // (the committed state participates in the creation-frozen policy).
        policy: policyReader,
        policyStateTransitions: (rootSessionId) => listDurablePolicyStateTransitions(repos, rootSessionId),
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
    // --- S1-H2 (repair 20260927) — the per-root compatibility prober factory -------------------
    // The remote compatibility.* methods must address the TeamSession they
    // were sent to, NOT silently serve the BOOT root's prober (the
    // cross-team state leak: team B's compatibility.get returned team A's
    // durable state). Each host-owned root gets a lazily-created prober
    // bound to ITS OWN durable generation line and ITS OWN bound blueprint
    // snapshot (boundBlueprintFor — never the boot row's static blueprint
    // when a per-root resolver is installed). The factory is consumed ONLY
    // by the remote surface (s6-remote): the boot `prober` above keeps its
    // original host-internal uses (the admission gate, the activation
    // boot-time state, the initial-work gate) UNCHANGED.
    //
    // Concurrency: the factory's current/probe/acknowledge are serialized
    // on the addressed root's SHARED coordination chain (withTeamLock) —
    // the same chain every other team-mutating remote path holds. The
    // remote compatibility.* handlers call the factory AFTER their
    // assertBoundRoot and WITHOUT already holding that chain, so no
    // re-entrant acquisition occurs (the chain is non-reentrant: a second
    // acquisition from inside a held section deadlocks — the admission
    // call chain that already holds the team lock therefore keeps the RAW
    // boot prober / raw prober methods, never this wrapper).
    const compatibilityByRoot = new Map();
    const compatibilityFor = (teamSessionId) => {
        const key = String(teamSessionId);
        const cached = compatibilityByRoot.get(key);
        if (cached !== undefined)
            return cached;
        const raw = createCompatibilityProber({
            repositories: repos,
            rootSessionId: key,
            blueprint: boundBlueprintFor(key),
            // PF-1 fix (2026-09-30) — per-root BLUEPRINT-scoped live feed (item 2
            // of the adjudicated design): this prober addresses the addressed
            // root's OWN bound blueprint, so its fresh-facts read must resolve
            // against THAT blueprint's team scope — never the boot-scoped thunk
            // (which on a multi-blueprint host evaluates this root's requirements
            // against the boot blueprint's feed → spurious FATAL).
            environmentFacts: () => environmentFactsForBlueprint(boundBlueprintFor(key)),
            now,
        });
        const scoped = {
            current: () => withTeamLock(coordination.chains, key, () => raw.current()),
            probe: (trigger) => withTeamLock(coordination.chains, key, () => raw.probe(trigger)),
            acknowledge: (input) => withTeamLock(coordination.chains, key, () => raw.acknowledge(input)),
        };
        compatibilityByRoot.set(key, scoped);
        return scoped;
    };
    // --- TCM vNext §15.8 (G1) — the Root initial-work closure ----------------------------------
    // The ONE Root initial-work authority for this production root: the plan
    // §15.8 closure — `withTeamLock` on the root's SHARED coordination
    // chains (the same chain the router mediates; no second lock), then the
    // existing single compatibility gate INSIDE the lock, then the two-fact
    // scanner + the live Root input seam. Both Root initial-work paths run
    // through it: the v1 `team.create`'s `initialWork` (TCM vNext §15.4:
    // the v1 create's initial work re-routes through the SAME strategy —
    // never the generic Member follow-up) and the v2-only
    // `team.admitInitialWork` command (§15.6). Absent when the live glue
    // carries no `deliverRootWork` port (factory worlds without the input
    // seam): the remote surfaces then fail both paths closed with the
    // typed TEAM_CREATE_ROOT_WORK_UNAVAILABLE.
    const glueDeliverRootWork = live.deliverRootWork;
    const rootWorkDelivery = glueDeliverRootWork === undefined
        ? undefined
        : {
            deliverRootWork: (input) => glueDeliverRootWork(input),
        };
    const admitRootInitialWork = rootWorkDelivery === undefined
        ? undefined
        : createAdmitRootInitialWork({
            teamLocks: coordination.chains,
            repositories: repos,
            environmentFacts,
            // pre-alpha3 W3-A (review fix F1, guide §2.3): the per-template
            // scope feed (absent in factory worlds — the legacy single-array
            // gate).
            ...(templateEnvironmentFacts !== undefined ? { templateEnvironmentFacts } : {}),
            // PF-1 fix (2026-09-30) — per-target BLUEPRINT scoping (the same
            // seam as the router gate / remote probe / per-root prober): the
            // Phase A gate resolves the live feed against the TARGET root's
            // bound blueprint (INV-9.4 two-worlds identity).
            ...(requirementFacts !== undefined ? { environmentFactsForBlueprint } : {}),
            ...(templateEnvironmentFactsForBlueprint !== undefined
                ? { templateEnvironmentFactsForBlueprint }
                : {}),
            // D-3 (2026-09-30) — the full-resolution read ports (the
            // atomic observations + feed pair): the Phase A gate consumes
            // them (the PENDING rule is live); factory worlds (no
            // requirementFacts) keep the legacy facts-only ports,
            // byte-identical.
            ...(requirementFacts !== undefined ? { environmentFactsReadForBlueprint } : {}),
            ...(templateEnvironmentFactsReadForBlueprint !== undefined
                ? { templateEnvironmentFactsReadForBlueprint }
                : {}),
            now,
            deliverRootWork: rootWorkDelivery,
        });
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
    // Work-completion wake-up (plan §18): the async work-completion
    // notification port — a DETACHED (`execution: 'async'`) work unit that
    // reaches its durable terminal settlement wakes the Leader through the
    // glue's SEPARATE wake-up primitive (`deliverRootWorkCompletionNotification` —
    // idle → followup / running → steer; acceptance boundary only), NOT
    // through the C1/root-input path (which awaits the turn). At-most-once
    // best-effort wake attempt (no redelivery): the durable settlement fact
    // + `team_collect` stay the authority and the recovery path; a delivery
    // failure (including the live bindings' close having started) is a
    // liveness failure only (the router's completion observer swallows it).
    // Wake provenance = the `[team-work-settled requestToken=...]` leading
    // envelope (a later Team runtime event may activate the Leader after a
    // user Stop — the envelope identifies the activation source). A glue
    // bundle without the port simply does not wake (factory/unit worlds —
    // same contract as the C1 `deliverRootControlNotification` wiring
    // below).
    const workCompletionNotifier = live.deliverRootWorkCompletionNotification !== undefined
        ? createWorkCompletionNotifier({
            deliver: {
                deliver: async (args) => {
                    // Current production: the target set is exactly
                    // `[{ kind: 'leader' }]` and the delivery port's `target`
                    // field is the leader — the glue takes the root session id
                    // + the pre-rendered text (the token-leading text carries
                    // the work-unit identity).
                    await live.deliverRootWorkCompletionNotification({
                        rootSessionId: args.rootSessionId,
                        text: args.text,
                    });
                },
            },
        })
        : undefined;
    const runtime = createTeamRuntime({
        teamDomain: domain,
        activationProvider: provider,
        blueprintCatalog: catalog,
        environmentFacts,
        // pre-alpha3 W3-A (review fix F1, guide §2.3): the per-template scope
        // feed (absent in factory worlds — the legacy single-array gate).
        ...(templateEnvironmentFacts !== undefined ? { templateEnvironmentFacts } : {}),
        // PF-1 fix (2026-09-30) — per-request BLUEPRINT scoping (the same seam
        // as the router gate / remote probe / per-root prober): the new-work
        // admission gate resolves the live feed against the REQUEST's bound
        // blueprint's team requirements (the frozen INV-9.4 two-worlds
        // identity — probe == gate == the same world).
        ...(requirementFacts !== undefined ? { environmentFactsForBlueprint } : {}),
        ...(templateEnvironmentFactsForBlueprint !== undefined
            ? { templateEnvironmentFactsForBlueprint }
            : {}),
        // D-3 (2026-09-30) — the full-resolution read ports (the atomic
        // observations + feed pair): the router gate consumes them (the
        // PENDING rule is live); factory worlds (no requirementFacts) keep
        // the legacy facts-only ports, byte-identical.
        ...(requirementFacts !== undefined ? { environmentFactsReadForBlueprint } : {}),
        ...(templateEnvironmentFactsReadForBlueprint !== undefined
            ? { templateEnvironmentFactsReadForBlueprint }
            : {}),
        externalPolicyFacts,
        staticModel: {
            provider: config.staticModel.provider,
            model: config.staticModel.model,
        },
        // pre-alpha3 PR-B (plan §B.2): the canonical inspect-config input —
        // the SAME production PolicyReader + the durable PolicyState
        // transitions (the committed state participates — the inspection
        // reports what the next request will actually run).
        policy: policyReader,
        policyStateTransitions: (rootSessionId) => listDurablePolicyStateTransitions(repos, rootSessionId),
        now,
        lifecycleCommit,
        lifecyclePorts,
        teamLocks: coordination.chains,
        workDelivery: live.workDelivery,
        workActivity,
        ...(workCompletionNotifier !== undefined ? { workCompletionNotification: workCompletionNotifier } : {}),
        // pre-alpha3 PR-E (plan §E.9): the Control service LAZY REF (the SAME
        // ref object the glue's setup callback reads — the service is created
        // below and its `current` is filled then; the router's recovery
        // dispatch reads `current` at dispatch time: ABSENT = no recovery
        // coupling, the typed block stands).
        controlServiceRef,
    });
    // --- A25 the control service --------------------------------------------------------------
    // C1 (leader-approval reachability): the optional Leader liveness
    // notification port — a newly-created durable `leader-approval` request
    // becomes a model-visible input turn on the Leader root through the
    // SHARED root-input seam (`live.deliverRootControlNotification`, the
    // same path the delegate work uses — NO MessagingCoordinator, no new
    // durable channel). Non-authority: the durable row +
    // `team_resolve_control` stay the authority; the service fires the
    // notifier fire-and-forget AFTER the per-team lock is released, so a
    // delivery failure is a liveness failure only (it never blocks the
    // request path and never changes the outcome — the pending-list tool +
    // the GUI remain the recovery paths). A glue bundle without the port
    // simply does not notify (factory/unit worlds; discovery stays
    // functional through `team_list_pending_control`).
    const control = createControlService({
        teamDomain: domain,
        blueprintCatalog: catalog,
        externalPolicyFacts,
        now,
        ...(live.deliverRootControlNotification !== undefined
            ? {
                requestNotification: createLeaderControlNotifier({
                    deliver: live.deliverRootControlNotification,
                }),
            }
            : {}),
    });
    // A6 (alpha.2 plan §11): publish the fully-constructed control service to
    // the shared ref the glue's setup callback reads LAZILY (the teamToolsRef
    // pattern — filled during construction, the entry calls boot() only after,
    // so every agentSetup sees a constructed service; a permissions template
    // with an unfilled ref fails closed at setup time).
    controlServiceRef.current = control;
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
        // pre-alpha3 W3-B (review fix F6, guide §6): the creation preflight
        // BEFORE the pre-freeze — the handoff mints its TeamSession record
        // DIRECTLY (the pre-put below), so a non-proceed outcome must refuse
        // BEFORE that durable row exists (zero durable effect: no record, no
        // binding, no leader, no fact). The bound blueprint is THIS row's
        // (single-blueprint row — `snapshot` above). Production path only
        // (the helper is a no-op without the requirement-facts authority).
        await enforceCreationPreflight({
            rootSessionId: minted,
            blueprint: snapshot,
            generation: 1,
        });
        // BP6 (issue #2 blueprint-loading, plan §10): the pre-freeze BEFORE
        // the pre-put — the handoff mints its TeamSession record DIRECTLY
        // (the pre-put below), so the barrier lands here, not only in the
        // bindFresh wrapper the shared primitive reuses (which re-runs the
        // freeze idempotently — same hash, no second row).
        if (blueprintAuthority !== undefined) {
            await blueprintAuthority.freezeSnapshot(snapshot);
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
    // The production PolicyReader (the bound-snapshot static authority) is
    // constructed ABOVE the activation provider (the A16 section) so the
    // provider / router / projection / glue all consume the SAME reader
    // instance (pre-alpha3 PR-B: the canonical read plane's static layer).
    const defaultOverrideStore = {
        list: (rootSessionId) => Promise.resolve(repos.overrides.list(rootSessionId)),
        put: (record) => repos.overrides.put(record),
    };
    // Named so the A31 remote PolicyState port can read the durable
    // transition rows (policyState.get) from the same store the authority
    // writes (policyState.set flows through the governance authority only).
    // R2-1 + pre-alpha3 PR-A: the transitions lane of that store is
    // DURABLE — the `ledger` fact rows of the OPENED TeamDomain (the
    // existing storage authority the mutation plane already uses for its
    // durable homes); every other lane keeps the S5A documented ephemeral
    // wiring. The COMMIT is owned by the governance mutation authority
    // (commit-before-ack — it writes the durable row before the ack and
    // only then appends to this cache); the production `boot()` preloads
    // the durable rows into the cache before the live flow (module:
    // ./durable-mutation-store.js).
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
        // pre-alpha3 PR-A (ADR-03): the SINGLE production governance mutation
        // authority — the one write path for the durable `overrides` + the
        // PolicyState transitions, serialized on the shared per-team chain,
        // committed durably BEFORE the ack. The old forked surfaces (the
        // remote-side admission glue + direct reset delete + the production
        // MutationService instance) are demoted: `persistGovernanceOverride`
        // is a persistence primitive, `MutationService` stays a pure kernel
        // of the P7-T2 test worlds — neither is a production authority.
        governance: createGovernanceMutationService({
            // The shared per-team operation chain (P8-S5B coordinator — the
            // ONE per-team serialization seam the production root already uses
            // for every team-mutating operation).
            chain: coordination,
            // The durable `overrides` repository (the team_domain store).
            overrides: defaultOverrideStore,
            // pre-alpha3 PR-B (plan §B.2): the transition read seam — the READ
            // is the durable ledger rows in commit order (the production
            // decision read no longer consumes the process-local cache); the
            // APPEND mirrors into the durable-mutation-store's process-local
            // lane (commit-before-ack is unchanged: the durable row is written
            // first, the mirror second).
            transitions: {
                listTransitions: (rootSessionId) => listDurablePolicyStateTransitions(repos, rootSessionId),
                appendTransition: (rootSessionId, transition) => mutationStore.appendTransition(rootSessionId, transition),
            },
            // The durable transition commit (commit-before-ack). The row is
            // stamped with the ADDRESSED root the governance service targets
            // (the port threads it through) — NOT this production root's own
            // `rootSid`: the durable read (listDurablePolicyStateTransitions) is
            // root-keyed to the addressed TeamSession, so stamping the row root
            // would make the committed state invisible to the addressed team and
            // leak it to this root (the C3 host-smoke finding — the override
            // lane already stamps its addressed root, service.ts:266/283).
            transitionCommit: {
                commit: (rootSessionId, transition) => writePolicyStateTransitionRow(repos.ledger, rootSessionId, transition, now),
            },
            // The static policy facts (the bound blueprint envelope / template
            // policy / the external hard facts — the same reader the resolution
            // side reads).
            policy: policyReader,
            // The registered member roster (the leader envelope intersection
            // reads the durable member-instances rows). The LEADER row is
            // excluded: the frozen P7-T2 envelope semantics intersect over the
            // registered MEMBERS ("no member registered -> skip"), and the
            // leader is a distinct instance, never a member (excluding it keeps
            // a leader-only team on the documented skip path).
            registeredMembers: (root) => Promise.resolve(repos.memberInstances
                .list(root)
                .filter((row) => row.instanceId !== LEADER_INSTANCE_ID)
                .map((row) => createMemberIdentity(row.rootSessionId, row.instanceId))),
            // The bound blueprint's closed PolicyState set (default + the
            // declared states, declaration order) — read per addressed root
            // through the per-root bound-snapshot resolver (the production
            // three-case contract of bound-blueprint.ts: a row WITH a bound
            // ref NEVER consults the row anchor — an unresolvable / hash-
            // inconsistent ref fails typed inside this dep; a no-ref
            // pre-repair legacy row IS the row anchor by definition — the
            // documented legacy binding, not a fallback to a different
            // blueprint).
            policyStates: (root) => [
                DEFAULT_POLICY_STATE_ID,
                ...boundBlueprintFor(root).policyStates.map((state) => state.id),
            ],
            now,
        }),
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
        // pre-alpha3 PR-B (plan §B.2): the committed PolicyState of the root —
        // the LAST durable transition in commit order (the production step
        // clock is retired as a decision source; the legacy step fields keep
        // parse/display only).
        policyState: (rootSessionId) => committedPolicyState(listDurablePolicyStateTransitions(repos, rootSessionId)).state.stateId,
        // R2-2 (P8-S7-R2): the BQ-08 resolved effective-config view (F01-F08,
        // G01, G02, G05, G06, G09, H04, H12, L11). pre-alpha3 PR-B: the ONE
        // canonical read (`readEffectivePolicy` inside the view) over the
        // durable PolicyState transition rows (the ledger — the same rows the
        // governance authority commits), the durable governance `overrides`,
        // and the bound policy reader: the committed state + the slot winners
        // + the static layers — the SAME read the live request boundary runs.
        // The process-local applied-record state is not durable, so
        // record-backed winning values are reported conservatively as pending
        // (appliedRecordIds empty). A resolver failure degrades the lane to
        // the closed default, never the row (fail closed).
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
                    transitions: listDurablePolicyStateTransitions(repos, rootSessionId),
                    overrides: repos.overrides.list(rootSessionId),
                    policyReader,
                });
            }
            catch {
                return null;
            }
        },
        // R2-3 (P8-S7-R2): the BQ-11 per-member model state view (D09/H06/H09/
        // H10/H12). pre-alpha3 PR-B: the committed/applied horizon (the
        // production step clock is retired as a decision source): the SAME
        // canonical read as the live request boundary — `current` is the
        // COMMITTED model (the durable last transition in commit order + the
        // governance slot winners + the static layers), and
        // `pendingNextBoundary` is present when a durable fact may not yet be
        // applied by this process (a committed transition or a record-backed
        // winner). A resolver failure drops the `modelState` key
        // (DURATIONAL-optional — absent, never undefined), never the row.
        modelState: (rootSessionId, instanceId) => {
            try {
                return createModelStateView({
                    teamSessionId: rootSessionId,
                    instanceId,
                    staticModel: {
                        provider: config.staticModel.provider,
                        model: config.staticModel.model,
                    },
                    transitions: listDurablePolicyStateTransitions(repos, rootSessionId),
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
    // The live-residency overlay is captured (the v6 live-token closure —
    // team-view-sync-complete — reads the SAME installed instance: the
    // residency facts and the token's pair source must be one object).
    // Team-scoped (PR #35 second follow-up P0-1): `snapshot(teamSessionId)`
    // reads exactly one team's durable member rows + live children — no
    // host-wide merge (instance ids are within-team identities).
    const liveOverlay = createLiveResidencyOverlay({
        repositories: repos,
        live,
        now,
    });
    seams.projectionLiveOverlay.install(liveOverlay);
    // --- A31 + A33 + A34 the remote surfaces (built once, installed once) -----------------------------
    const remoteSurfaces = createS6RemoteSurfaces({
        rootSessionId: rootSid,
        isOwnedRoot: ownsTeamSessionRoot,
        ...(config.defaultWorkspace !== undefined
            ? { defaultWorkspace: config.defaultWorkspace }
            : {}),
        // T1.4-B — the row-config environment facts: the SAME injected source
        // the post-creation admission gate consumes (the prober / authority /
        // activation / runtime wiring above all read over `config.environmentFacts`
        // through the live provider). The intent.probe port merges it with the
        // caller's persona fact, so the pre-creation probe and the gate
        // evaluate the same world (INV-9.4 — the T1.4 two-worlds mismatch
        // closed: the UI probe no longer sees client persona facts only, and
        // a required MCP present in the row facts now passes the pre-create
        // probe exactly as it passes the gate).
        // PF-1 fix (2026-09-30) — the surface consumes the PER-BLUEPRINT live
        // facts source (item 1 of the adjudicated design): `intent.probe`
        // resolves the feed against the REQUESTED blueprint's team
        // requirements, so on a multi-blueprint host the probe evaluates the
        // SAME world the post-creation admission gate consumes (pre-fix this
        // was the boot-scoped thunk — a zero-requirement boot anchor left the
        // feed empty and a configured + healthy live server probed as a
        // spurious FATAL).
        ...(requirementFacts !== undefined
            ? { environmentFacts: environmentFactsForBlueprint }
            : { environmentFacts }),
        // D-3 (2026-09-30) — the PER-BLUEPRINT FULL-RESOLUTION read port:
        // `intent.probe` drops the SEED-FILLED facts of every REQUIRED
        // requirement whose live observation is still `unknown` — the probe's
        // BLOCKED_FATAL then faithfully (STRICTER) predicts the post-creation
        // gate's typed PENDING block (INV-9.4: complete the observation, not
        // weaken the verdict; plan §C.3 禁止 false OPEN). Factory worlds: no
        // port — the PENDING rule stays off (byte-identical).
        ...(requirementFacts !== undefined
            ? { environmentFactsRead: environmentFactsReadForBlueprint }
            : {}),
        repositories: repos,
        catalog,
        blueprint,
        leaderInstanceId: LEADER_INSTANCE_ID,
        projection,
        runtime,
        lifecycle: lifecycleService,
        // pre-alpha3 PR-A (ADR-03): the SINGLE governance mutation authority
        // (durable overrides + PolicyState transitions) — the remote surface
        // routes override.set / override.reset / policyState.set through it
        // (serialized on the shared chain, committed before the ack).
        governance: mutation.governance,
        // pre-alpha3 PR-B (plan §B.2): the remote PolicyState read surface
        // reads the DURABLE transition rows (the ledger) directly — the
        // commit-order read the committed-state derivation consumes (the
        // process-local cache is no longer the read source of any production
        // decision).
        mutationTransitions: (teamSessionId) => listDurablePolicyStateTransitions(repos, teamSessionId),
        overrideRecords: (teamSessionId) => repos.overrides.list(teamSessionId),
        rootBinding,
        // S1-H2 (repair 20260927): the remote compatibility.* methods are
        // addressed per root — the factory returns (lazily, once per root)
        // the prober owning that root's generation line + blueprint, locked
        // on that root's shared coordination chain. The BOOT prober (the
        // `prober` const above) keeps its host-internal uses only.
        compatibilityFor,
        handoff,
        // A28 (P8-S7-R4): the handoff prepare producer — the EXACTLY-ONE
        // canonical surface freeze through the DSH public sessionQuery
        // service + the one-shot NON-MODEL deterministic digest (remote-safe
        // `summary` payload for `handoff.prepare`).
        handoffPrepare: (sourceSessionId) => readCanonicalSourceSurface(requireSessionQuery(), sourceSessionId).then((surface) => summarizeSourceSurface(surface)),
        legacyInspect,
        legacyHome: params.legacyHome,
        principal: seams.serverPrincipalDerivation.current(),
        // BP-G (issue #2 blueprint-loading, plan §12.2): the host's in-process
        // boot readiness — the mounted dispatcher gates the non-catalog
        // methods on it (the mount happens BEFORE the live boot is awaited).
        ...(params.remoteReadiness !== undefined
            ? { readiness: params.remoteReadiness }
            : {}),
        // T12-V16: remote member.send routes through the P6-T3 messaging
        // coordinator (facade admission + live delivery + confirmation),
        // closing the admission-only silence window pinned by run #13.
        messaging,
        // D-3: the root (leader) agent start behind team.create — the SAME
        // glue port the with-context handoff uses (create-or-ensure; a fresh
        // root is created by the host, NO native root). Absent (a glue-less
        // world) → team.create fails closed with a typed error.
        startRootAgent: live.createRootAgent,
        // D2 (Team D1-D6 repair v2, remote contract v3) — the Team-mode live
        // ensure behind the v3-only team.ensureRootLive: the live glue's
        // ensureLiveAgent (A3 Q2 — live-first: the upstream agent registry
        // resolves a live agent and reuses it, so a second agent under one
        // root is structurally impossible; a root without a durable session
        // artifact fails closed typed). The glue's typed surface is ALREADY
        // exported (TeamAgentBindings.ensureLiveAgent) — NO glue change. The
        // await wrapper adapts the glue's `Promise<unknown>` result surface to
        // the port's `Promise<void>` contract: the S6 handler never consumes the
        // return value — it only needs the success/failure distinction (the
        // success envelope is built by the handler itself).
        ensureRootLive: async (rootSessionId) => {
            await live.ensureLiveAgent(rootSessionId);
        },
        // C1 (restart-recovery, guide §10.2) + supplement round §2.4 — the
        // D3 ordinary-mode one-shot activation permit behind the host-side
        // team.prepareOrdinaryOpen: the live glue's allowOrdinaryActivationOnce
        // (the fence's permitOrdinaryOnce passthrough — the ONE process-local
        // permit fact: no Team ensure, no TeamDomain mutation, no governance,
        // no tools, no persistence). CONDITIONAL EXPOSURE (supplement P1-6
        // contract fix — the pre-round literal `live.
        // allowOrdinaryActivationOnce?.(sid)` was a FAKE SUCCESS: the port
        // existed, the wire call returned `permitted: true`, and a world
        // without the armer armed nothing yet reported success). The port is
        // exposed ONLY when the armer is genuinely present; a world without
        // the fence omits the port, and the S6 preflight
        // (requirePrepareOrdinaryOpenPort) then fails closed with the typed
        // TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE. In the production
        // host the fence ALWAYS exists (host.ts registers it at the top of
        // apply()), so the port is always present there.
        ...(typeof live.allowOrdinaryActivationOnce === 'function'
            ? {
                prepareOrdinaryOpen: (rootSessionId) => {
                    live.allowOrdinaryActivationOnce(rootSessionId);
                },
            }
            : {}),
        // F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the
        // durable control-service closure behind the v4-only
        // team.resolveControl: the EXISTING A25 control service (built
        // above — always present in production; NO new service, NO
        // authority change: CONTROL_RESOLVER_ROLES + the durable
        // exactly-once decision semantics stay the only resolver
        // authority). The `caller` argument is HOST-DERIVED (the T12-B4
        // trusted principal seam stamps the human operator of the
        // addressed root — the v4 wire carries no caller/role fields,
        // adjudication U3). The service's closed CONTROL_* rejections
        // pass through the dispatcher unchanged (invariant 4b).
        resolveControl: async ({ rootSessionId, caller, requestId, decision, note }) => {
            const record = await control.resolveControl({
                rootSessionId,
                caller,
                requestId,
                decision,
                ...(note !== undefined ? { note } : {}),
            });
            return record;
        },
        // D1 (Team D1-D6 repair v2, remote contract v3) — the read-only
        // durable root ownership list behind the v3-only team.listRoots: the
        // D1 pure ownership-index module over the ALREADY-INJECTED
        // repositories (NO repository writes, NO agent effects). A corrupt or
        // inconsistent row fails closed typed (the index's
        // TEAM_OWNERSHIP_INDEX_* codes + the storage layer's typed row
        // errors — closed backing vocabulary, invariant 4b).
        listRoots: () => Promise.resolve(buildTeamRootOwnershipIndex(repos).map((row) => toTeamRootWireRow(row))),
        // team-view-sync-complete (remote contract v6) — the durable
        // session-affiliation resolver behind the v6-only team.getReadState:
        // the pure team-read-state module over the ALREADY-INJECTED
        // repositories (NO repository writes, NO agent effects). The
        // durable TeamDomain rows are the SOLE authority: a `none` answer
        // rests only on a positively confirmed no-affiliation, and every
        // storage/integrity failure fails closed typed (the resolver's
        // TEAM_READ_STATE_* codes + the storage layer's typed row errors —
        // closed backing codes, invariant 4b) — NEVER a silent `none`.
        readState: (sessionId) => resolveSessionReadState({ repositories: repos }, rootSid, sessionId),
        // team-view-sync-complete (remote contract v6) — the semantic-live-
        // state token closure behind the v6 projection's liveToken cell:
        // the pure live-token module over the team's durable member rows +
        // the installed live-residency overlay (the deterministic opaque
        // string over the sorted {instanceId, residency} pairs — NO clock
        // facts enter the token, frozen decisions 3 + 7). A storage failure
        // in the member row list propagates typed (invariant 4b): a v6 frame
        // without its token cell is impossible.
        liveToken: (teamSessionId) => computeTeamLiveToken(repos.memberInstances.list(teamSessionId), liveOverlay.snapshot(teamSessionId)),
        // TCM vNext §15.5 (M2) — the narrow workspace attach port (the host
        // entry's closure over the hard-injected public workspaceRegistry):
        // the v2 team.create resolves the requested workspace through it
        // before any durable effect and attaches the materialized root
        // session after the bind + start (plan §2.2 order). Absent (a
        // world without the host entry) → a v2 create carrying `workspace`
        // fails closed with the typed TEAM_CREATE_WORKSPACE_NOT_FOUND.
        ...(workspaceAttach !== undefined ? { workspaceAttach } : {}),
        // TCM vNext §15.8 (G1) — the Root initial-work closure (shared
        // coordination chains + the single compatibility gate + the two-fact
        // scanner): the ONE authority both Root initial-work paths call (the
        // v1 create's initialWork + the v2 team.admitInitialWork). Absent
        // (a glue without the deliverRootWork port) → both paths fail closed
        // with the typed TEAM_CREATE_ROOT_WORK_UNAVAILABLE.
        ...(admitRootInitialWork !== undefined ? { admitRootInitialWork } : {}),
        now,
    });
    seams.remoteQueryCommandCompletion.install(remoteSurfaces.completion);
    seams.remoteHandlerRegistration.install(remoteSurfaces.registration);
    // --- A04 the intent surface (the remote method catalog) --------------------------------------------
    const intent = { catalog: REMOTE_METHOD_CATALOG };
    // --- the thirteen Team tools (the glue registers them on the agent setup; C1 adds the pending-list tool; the archive-member round adds team_archive_member) -------------------------------------
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
            // BP6 writer audit (issue #2 blueprint-loading, plan §10,
            // category 3): the fixture boot seed explicitly seeds the registry
            // for the row anchor BEFORE its durable TeamSession put, so a
            // fixture world with an injected authority keeps the fresh-
            // TeamSession invariant (a fork child of a boot-world parent then
            // inherits an already-frozen snapshot). Factory worlds without an
            // authority skip the seeding (the legacy behavior).
            if (blueprintAuthority !== undefined) {
                await blueprintAuthority.freezeSnapshot(boundSnapshot);
            }
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
        if (productionSubstratePlan !== undefined) {
            // pre-alpha3 W3-A (F1): the sync preset seam (`getSubstrate`) cannot
            // express a PENDING observation — it answers from the settled plan, or
            // fails closed. The plan is therefore settled BEFORE any boot effect,
            // so the root is only "ready" (the host awaits `boot()` before
            // resolving `teamRoot.ready`) once `getSubstrate` can answer. This is
            // what the post-commit member binds (`bindFreshMember`, which do NOT
            // go through the `bindFresh` wrapper's settle) rely on: a RESUME boot
            // re-binds members after ready, and the plan must already be settled.
            // A typed plan failure (e.g. the resolver's MALFORMED_DTO — no root
            // preset authority) rejects the boot: fail closed, never a guessed
            // persona. The `bindFresh` wrapper's settle of the SAME promise is
            // then a no-op (idempotent).
            await productionSubstratePlan;
        }
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
        // pre-alpha3 PR-A: there are no scheduled durable writes to flush —
        // the governance mutation authority commits every durable fact row
        // BEFORE its ack (commit-before-ack), so nothing is pending here.
        await live.close();
        await domain.close();
    };
    // --- pre-alpha3 W3-B (review fix F7, guide §6) — the production requirement-fact writers ----------
    // The durable human decisions of the creation preflight as ROOT-LEVEL
    // services (the frozen remote contract v1–v6 gains NO method — the UI
    // flow consumes the typed preflight result and re-drives the creation).
    // Both writers resolve the NAMED bound snapshot from the catalog (an
    // explicit revision — no "latest"), validate fail-closed against the
    // bound blueprint (a typed refusal leaves ZERO writes), and write ONE
    // fact row commit-before-ack over the frozen `compatibility` category
    // (a write failure propagates; the ack never precedes the durable
    // write). Production path only (the `requirementFacts` authority
    // present — the writers evaluate on the LIVE feeds; factory worlds have
    // no live source, so the surface stays absent).
    let requirementAuthority;
    if (requirementFacts !== undefined) {
        const authority = requirementFacts;
        const resolveNamedSnapshot = (blueprintId, revision) => catalog.resolve(blueprintId, revision);
        const freshTeamFacts = (bound) => () => authority.provider
            .resolveFacts({ requirements: scopeRequirementInputsOf(bound).team, scope: { kind: 'team' } })
            .then((resolution) => resolution.environmentFacts);
        const freshTemplateFacts = (bound) => (templateId) => {
            const templateInputs = scopeRequirementInputsOf(bound).templates;
            return authority.provider
                .resolveFacts({
                requirements: templateInputs[templateId] ?? [],
                // Blocker-1: the template scope carries its role identity
                // (the bound blueprint knows its leader template id — the
                // leader IS the root: the root mounts config.rootPresetId).
                scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(bound.leader.templateId, templateId) },
            })
                .then((resolution) => resolution.environmentFacts);
        };
        // pre-alpha3 W3-B (review fix F7, guide §6): the requirement-fact
        // write port with the PRE-TEAM variant selected per input — the
        // refuse→consent→re-drive workflow writes the durable fact BEFORE
        // the TeamSession record is minted (no stamp to advance: the
        // record lands with the fresh generation and the next post-bind
        // fact catches the stamp up, the documented v1 lag model); once the
        // record EXISTS the stamped `put` applies (the S1-A push stamp).
        const factLedgerFor = (rootSessionId) => ({
            allocateSequence: () => repos.ledger.allocateSequence(),
            put: (entry) => repos.teamSessions.get(rootSessionId) === undefined
                ? repos.ledger.putPreTeam(entry)
                : repos.ledger.put(entry),
        });
        requirementAuthority = {
            grantDegradationConsent: (input) => (async () => {
                const bound = resolveNamedSnapshot(input.blueprintId, input.revision);
                return grantDegradationConsent({
                    ledger: factLedgerFor(input.rootSessionId),
                    blueprint: bound,
                    rootSessionId: input.rootSessionId,
                    requirementId: input.requirementId,
                    generation: input.generation,
                    consentedBy: input.consentedBy,
                    environmentFacts: freshTeamFacts(bound),
                    templateEnvironmentFacts: freshTemplateFacts(bound),
                    now,
                });
            })(),
            setTemplateAvailability: (input) => (async () => {
                const bound = resolveNamedSnapshot(input.blueprintId, input.revision);
                return setTemplateAvailabilityFact({
                    ledger: factLedgerFor(input.rootSessionId),
                    blueprint: bound,
                    rootSessionId: input.rootSessionId,
                    templateId: input.templateId,
                    available: input.available,
                    now,
                });
            })(),
        };
    }
    return {
        config,
        domain,
        storageSeam,
        catalog,
        blueprint,
        policyReader,
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
        workspaceAttach,
        projection,
        seams,
        live,
        tools,
        boot,
        close,
        // pre-alpha3 W2-A (review fix F1, guide §2.3): the runtime
        // requirement-facts authority (the #40 live environment source) —
        // present only in the production host entry world (the additive-
        // optional param; factory worlds carry none, the surface stays absent).
        requirementFacts,
        // pre-alpha3 W3-B (review fix F7, guide §6): the production
        // requirement-fact writers (the durable consent grant + the template
        // disable/enable) — present only in the production host entry world.
        ...(requirementAuthority !== undefined ? { requirementAuthority } : {}),
    };
}
//# sourceMappingURL=root.js.map