/**
 * P8-S6 A31 + A33 + A34 — the production remote-handler registration, the
 * ledger-page pagination completion, and the production dispatcher of the
 * Remote contract v1 (plan §20; closes CR-12 together with A30/A32).
 *
 * The frozen `packages/remote` library ships a SYNCHRONOUS dispatcher and
 * twelve synchronous ports (its design note §6: the ports are pure reads
 * over injected tables). The vNext production facades are ASYNC (durable
 * repository writes, the action router's team lock, the lifecycle chains,
 * the compatibility prober). This module is the PRODUCTION async mirror:
 *
 * - the dispatcher mirrors the frozen seven invariants byte-for-byte
 *   (unknown endpoint BEFORE the envelope; the closed envelope; the
 *   per-method closed param schema; the typed-error pass-through with the
 *   source identity under `details.cause`; the untyped-throw →
 *   `internal-error` with no leak; the lossless-JSON check before the
 *   success reply; the promise that never rejects) — the ONLY divergence
 *   is the `await` of the category handler (invariant 4), forced by the
 *   async facades;
 * - the twelve ports are host adapters over the runtime authorities ONLY
 *   (plan §20.4: a remote handler must call Runtime/Team service
 *   authority — never a direct repository mutation, never a direct
 *   Agent.followup, never a local compatibility recompute);
 * - every client-claimed principal (`caller` / `actor` / `acknowledgedBy`)
 *   is derived SERVER-SIDE through the installed `serverPrincipalDerivation`
 *   seam (A32; closes CR-4) — the claim is input to the derivation, never
 *   authority;
 * - `team.getLedgerPage` additionally flows through the pagination
 *   completion (A34): the frozen `createLedgerPageTracker` (the A33
 *   wiring) gates every served page (plan §20.5/§20.6: the stable cursor,
 *   the load-earlier session, the growth-safe historical window).
 *
 * The wire contract is UNCHANGED: every `outcome.data` shape mirrors the
 * frozen category handlers (one dotted endpoint per method, the same
 * value shapes, the same provenance cells), so a frozen-contract client
 * cannot tell the mirror apart from the frozen dispatcher.
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected ports).
 * @module @dsh-agent-team/runtime/plugin/s6-remote
 */
import { REMOTE_CATEGORIES, isRemoteMethod, remoteCategoryOf, } from '../../../remote/src/contracts/catalog.js';
import { REMOTE_CONTRACT_ERROR_CODES, isRemoteContractError, remoteContractError, } from '../../../remote/src/contracts/errors.js';
import { parseRemoteMethodParams, parseRemoteTeamGetLedgerPageParams, } from '../../../remote/src/contracts/params.js';
import { parseRemoteRequest } from '../../../remote/src/contracts/request.js';
import { buildRemoteError, buildRemoteSuccess, } from '../../../remote/src/contracts/response.js';
import { REMOTE_PROJECTION_FIELDS, } from '../../../remote/src/contracts/types.js';
import { REMOTE_CONTRACT_VERSION } from '../../../remote/src/contracts/version.js';
import { REMOTE_BACKING_ERROR_CODE_SET } from '../../../remote/src/handlers/dispatch.js';
import { REMOTE_RPC_CHANNEL } from '../../../remote/src/handlers/register.js';
import { createLedgerPageTracker } from '../../../remote/src/push/ledger-page.js';
import { TeamPluginError } from './types.js';
import { S6_PRINCIPAL_ERROR_CODES, SERVER_PRINCIPAL_TRANSPORTS, createServerPrincipalContext, isServerPrincipalContext, } from './s6-principal.js';
import { validateActionRequest } from '../../admission/index.js';
import { canonicalJsonStringify } from '../../../contracts/src/index.js';
import { activePolicyState } from '../../mutation/index.js';
import { PROBE_TRIGGER_VALUES, compatibilityRequirementsOf, } from '../../compatibility/index.js';
import { evaluateCompatibility } from '../../../domain/compatibility/src/index.js';
import { sha256Hex } from '../../../domain/blueprint/src/index.js';
import { DEFAULT_POLICY_STATE_ID } from '../../../domain/policy/src/index.js';
// --- the stable S6 remote error codes (the typed domain errors) ----------------------
/** The stable error codes the S6 remote surfaces throw (CR-4/CR-12 boundary). */
export const S6_REMOTE_ERROR_CODES = {
    /** A34 — the ledger-page tracker rejected the page (the 20.5/20.6 boundary). */
    LEDGER_PAGE_REJECTED: 'TEAM_REMOTE_LEDGER_PAGE_REJECTED',
    /** A31 — no durable compatibility state to read (fail-closed). */
    COMPATIBILITY_STATE_ABSENT: 'TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT',
    /** A31 — the durable compatibility state is structurally malformed. */
    COMPATIBILITY_STATE_MALFORMED: 'TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED',
    /** A31 — the requested PolicyState is outside the bound blueprint's closed set. */
    POLICY_STATE_UNKNOWN: 'TEAM_REMOTE_POLICY_STATE_UNKNOWN',
    /** A31 — a catalog revision is not a safe integer (host bug, fail-closed). */
    CATALOG_REVISION_MALFORMED: 'TEAM_REMOTE_CATALOG_REVISION_MALFORMED',
    /** A31 — a durable ledger entry is structurally malformed (fail-closed). */
    LEDGER_ENTRY_MALFORMED: 'TEAM_REMOTE_LEDGER_ENTRY_MALFORMED',
    /** A31 — handoff.prepare: the production root exposes no source-session read surface. */
    HANDOFF_PREPARE_UNAVAILABLE: 'TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
    /** A31 — legacy.inspect: no legacy home port is bound to this root. */
    LEGACY_HOME_UNAVAILABLE: 'TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE',
    /** A31 — an instance-scoped override request carries no target instance. */
    OVERRIDE_TARGET_REQUIRED: 'TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED',
    /** A31 — team.create names a blueprint snapshot the bound TeamSession does not carry. */
    TEAM_CREATE_BLUEPRINT_MISMATCH: 'TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH',
    /** D-3 — team.create: the live glue exposes no root-agent start port (a
     *  created team must own a live leader; failing closed). */
    TEAM_CREATE_ROOT_START_UNAVAILABLE: 'TEAM_REMOTE_TEAM_CREATE_ROOT_START_UNAVAILABLE',
    /** D-3 — team.create: starting the root (leader) agent of the created or
     *  retained root failed (the durable bind is preserved; the retry
     *  re-drives the start on the cold path). */
    TEAM_CREATE_ROOT_START_FAILED: 'TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED',
};
// --- small local helpers ------------------------------------------------------------------
/** True for a plain (non-array, non-null) object. */
function isPlainRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** A safe non-negative integer. */
function isSafeInt(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
/**
 * BC-03 / R1-A — the stable logical-operation token of one creation-time
 * work admission: the content hash of the initial work's canonical JSON.
 * The work chain's token protocol (closure plan §CR2) then makes a retried
 * `team.create` carrying the SAME initial work a replay/resume (zero
 * duplicate `team-work-admitted` facts), while a different payload is a
 * distinct logical operation (a fresh admission through the same gates).
 * The token scan is root-scoped, so identical payloads on different teams
 * never collide.
 */
function initialWorkRequestToken(initialWork) {
    return `team-create:initial-work:sha256:${sha256Hex(canonicalJsonStringify(initialWork))}`;
}
/** Map the derived caller to the mutation authority (server-side). */
function authorityOf(caller, leaderInstanceId) {
    if (caller.kind === 'human')
        return { kind: 'operator' };
    if (caller.instanceId === leaderInstanceId)
        return { kind: 'leader' };
    return { kind: 'member', instanceId: caller.instanceId };
}
/** Map the derived caller to the mutation actor (server-side). */
function actorOf(caller, rootSessionId, leaderInstanceId) {
    if (caller.kind === 'human')
        return { kind: 'human' };
    if (caller.instanceId === leaderInstanceId)
        return { kind: 'leader' };
    return {
        kind: 'member',
        member: { rootSessionId: rootSessionId, instanceId: caller.instanceId },
    };
}
/** Map a blueprint template to its wire discovery record. */
function templateToRecord(template) {
    const record = { templateId: template.templateId, persona: template.persona };
    if (template.displayName !== undefined)
        record['displayName'] = template.displayName;
    if (template.description !== undefined)
        record['description'] = template.description;
    if (template.modelPreference !== undefined)
        record['modelPreference'] = template.modelPreference;
    if (template.contextPolicy !== undefined)
        record['contextPolicy'] = template.contextPolicy;
    return record;
}
/** Map a resolved blueprint to its wire discovery record. */
function blueprintToRecord(blueprint) {
    const record = {
        schemaVersion: blueprint.schemaVersion,
        blueprintId: blueprint.blueprintId,
        revision: blueprint.revision,
        contentHash: blueprint.contentHash,
        leader: templateToRecord(blueprint.leader),
        members: [...blueprint.members.map((template) => templateToRecord(template))],
        requirements: [
            ...blueprint.requirements.map((requirement) => ({
                domain: requirement.domain,
                name: requirement.name,
                optional: requirement.optional,
            })),
        ],
        policyStates: [
            ...blueprint.policyStates.map((state) => {
                const stateRecord = { id: state.id, fields: [...state.fields] };
                if (state.description !== undefined)
                    stateRecord['description'] = state.description;
                return stateRecord;
            }),
        ],
    };
    if (blueprint.displayName !== undefined)
        record['displayName'] = blueprint.displayName;
    if (blueprint.description !== undefined)
        record['description'] = blueprint.description;
    if (blueprint.quotas !== undefined) {
        const quotaOf = (quota) => quota === undefined
            ? null
            : {
                maxInstances: quota.maxInstances ?? null,
                maxConcurrent: quota.maxConcurrent ?? null,
            };
        record['quotas'] = {
            team: quotaOf(blueprint.quotas.team),
            members: quotaOf(blueprint.quotas.members),
        };
    }
    return record;
}
/** The durable effect sequence of an admission outcome (the frozen rule, verbatim). */
function admissionEffectSequence(outcome) {
    const effect = outcome['effect'];
    if (effect === null || typeof effect !== 'object' || Array.isArray(effect))
        return undefined;
    const effectRecord = effect;
    let candidate;
    switch (typeof effectRecord['kind'] === 'string' ? effectRecord['kind'] : '') {
        case 'fact-recorded':
        case 'work-admitted':
        case 'lifecycle-changed':
            candidate = effectRecord['sequence'];
            break;
        case 'member-activated':
            candidate = effectRecord['ledgerSequence'];
            break;
        default:
            return undefined;
    }
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate)) {
        return candidate;
    }
    return undefined;
}
/** One ledger entry from a durable row (the frozen wire shape, field-by-field). */
function ledgerEntryWire(record) {
    const schemaVersion = record['schemaVersion'];
    const sequence = record['sequence'];
    const rootSessionId = record['rootSessionId'];
    const factType = record['factType'];
    const payload = record['payload'];
    const createdAt = record['createdAt'];
    if (!isSafeInt(schemaVersion)) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED, `durable ledger entry carries a malformed schemaVersion (${String(schemaVersion)})`, { reason: 'malformed-schema-version' });
    }
    if (!isSafeInt(sequence) || sequence < 1) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED, `durable ledger entry carries a malformed sequence (${String(sequence)})`, { reason: 'malformed-sequence' });
    }
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED, 'durable ledger entry carries a malformed rootSessionId', { reason: 'malformed-root-session-id' });
    }
    if (typeof factType !== 'string' || factType.length === 0) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED, 'durable ledger entry carries a malformed factType', { reason: 'malformed-fact-type' });
    }
    if (!isPlainRecord(payload)) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED, 'durable ledger entry carries a malformed payload', { reason: 'malformed-payload' });
    }
    if (typeof createdAt !== 'string' || createdAt.length === 0) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED, 'durable ledger entry carries a malformed createdAt', { reason: 'malformed-created-at' });
    }
    const operationId = record['operationId'];
    return {
        schemaVersion,
        sequence,
        rootSessionId,
        factType,
        payload: payload,
        operationId: operationId === undefined ? null : operationId,
        createdAt,
    };
}
/**
 * The durable PolicyState read (the mutation store's transition rows).
 *
 * The remote read evaluates at the far-future step: it reports the state of
 * the LATEST durable transition (or the default state when the store is
 * empty). The production step clock is pinned to 0 (the step model advances
 * with the work chain, not with explicit transitions), so evaluating at
 * step 0 would hide every explicit transition from the remote read
 * permanently — the client must read back the state it set.
 */
function policyStateReadOf(transitions, atStep) {
    return activePolicyState(transitions, atStep);
}
/** The compatibility verdict of one durable state record (defensive read). */
function compatibilityCurrentOf(state) {
    const status = state['status'];
    const fingerprint = state['fingerprint'];
    const generation = state['generation'];
    const computedAt = state['computedAt'];
    const outcomes = state['outcomes'];
    if (typeof status !== 'string' ||
        typeof fingerprint !== 'string' ||
        !isSafeInt(generation) ||
        typeof computedAt !== 'string' ||
        !isPlainRecord(outcomes)) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, 'the durable compatibility state is structurally malformed', { reason: 'malformed-state' });
    }
    const counts = outcomes['counts'];
    if (!isPlainRecord(counts) ||
        !isSafeInt(counts['pass']) ||
        !isSafeInt(counts['warning']) ||
        !isSafeInt(counts['fatal']) ||
        !isSafeInt(counts['unackedWarning']) ||
        !isSafeInt(counts['staleAcknowledgement'])) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, 'the durable compatibility state carries a malformed counts block', { reason: 'malformed-counts' });
    }
    return {
        status,
        environmentFingerprint: fingerprint,
        generation,
        recordedAt: computedAt,
        counts: {
            pass: counts['pass'],
            warning: counts['warning'],
            fatal: counts['fatal'],
            unackedWarning: counts['unackedWarning'],
            staleAcknowledgement: counts['staleAcknowledgement'],
        },
    };
}
// --- the port builders ---------------------------------------------------------------------
/**
 * Build the thirteen production remote ports over the host's owned roots
 * (the bound root + any TeamSession root the host durably owns — P9-S8:
 * teams created after boot through `team.create` / `handoff.create` are
 * servable by this same remote; the frozen twelve + the T12-V16 messaging
 * coordinator port).
 *
 * Every port asserts the bound-root guard first (the foreign-team guard —
 * the A32 seam re-asserts it for the claim-carrying methods; the other
 * methods assert it here, so NO team-scoped remote method can address a
 * TeamSession this host does not own). Every authority call goes to the runtime facade; the
 * ports themselves perform no repository writes except the single
 * `override.reset` deletion of the ADDRESS-RESOLVED record (the reset
 * authority: the admission's identity resolution + the durable delete —
 * the mutation admission is the set authority, the delete is the
 * audit-preserving revoke the frozen contract names).
 * @param options - the root-bound inputs.
 * @returns the thirteen ports.
 */
export function createS6RemotePorts(options) {
    const { rootSessionId, repositories, catalog, blueprint, leaderInstanceId, now, isOwnedRoot } = options;
    /** The bound-root guard's acceptance: the bound root OR a durably owned
     *  root (P9-S8 — a team created after boot by this host). Without the
     *  predicate (single-root fixtures) this is the T12 bound-root-only
     *  check. */
    function ownsRoot(teamSessionId) {
        return teamSessionId === rootSessionId || (isOwnedRoot?.(teamSessionId) ?? false);
    }
    function assertBoundRoot(method, teamSessionId) {
        if (typeof teamSessionId !== 'string' || !ownsRoot(teamSessionId)) {
            throw new TeamPluginError(S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM, `remote method '${method}' addresses TeamSession '${String(teamSessionId)}' which this host does not own (bound root '${rootSessionId}')`, { reason: 'foreign-team', requested: String(teamSessionId), bound: rootSessionId });
        }
        return teamSessionId;
    }
    function resolveBlueprint(blueprintId, revision) {
        if (revision === undefined)
            return catalog.resolveLatest(blueprintId);
        if (!Number.isSafeInteger(revision)) {
            throw new TeamPluginError(S6_REMOTE_ERROR_CODES.CATALOG_REVISION_MALFORMED, `blueprint revision '${String(revision)}' is not a safe integer`, { reason: 'malformed-revision', blueprintId });
        }
        return catalog.resolve(blueprintId, String(revision));
    }
    // P9-S8 (F1-lite v3): filter by the ASSERTED addressed root — the bound
    // root alone would serve the boot team's ledger to every host-owned team.
    function rootLedgerEntries(addressedRoot) {
        return repositories.ledger
            .list()
            .filter((entry) => entry.rootSessionId === addressedRoot);
    }
    /**
     * D-3 — the fail-closed `team.create` preflight: the created or
     * retained root must own a LIVE leader agent (the team tools, the
     * leader persona, the leader model), started through the SAME glue
     * port the with-context handoff uses (`createRootAgent`). Runs BEFORE
     * any durable effect (the handoff preflight discipline: a failed
     * preflight leaves no partial team).
     */
    function requireStartRootAgentPort() {
        const port = options.startRootAgent;
        if (port === undefined) {
            throw new TeamPluginError(S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_START_UNAVAILABLE, 'team.create cannot start the root (leader) agent: the live glue does not provide the createRootAgent port; a created team must own a live leader — failing closed before any durable effect', { reason: 'root-start-unavailable' });
        }
        return port;
    }
    /**
     * D-3 — the root (leader) agent start behind `team.create` (the
     * create-or-ensure, idempotent per rootSessionId). A port rejection is
     * typed: the durable bind already landed, the team row stays durable,
     * and the retry (cold path) re-drives the start.
     */
    async function startRootAgent(rootSessionId) {
        try {
            await requireStartRootAgentPort()(rootSessionId);
        }
        catch (error) {
            if (error instanceof TeamPluginError)
                throw error;
            throw new TeamPluginError(S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_START_FAILED, `team.create: starting the root (leader) agent for '${rootSessionId}' failed: ${error instanceof Error ? error.message : String(error)}`, { reason: 'root-start-failed' });
        }
    }
    return {
        // --- 1/12 catalog: host catalog discovery (read-only) ---------------------------
        catalog: {
            async list() {
                const rows = [];
                for (const blueprintId of catalog.blueprintIds) {
                    const revisions = catalog.listRevisions(blueprintId).map((revision) => {
                        const value = Number(revision);
                        if (!Number.isSafeInteger(value)) {
                            throw new TeamPluginError(S6_REMOTE_ERROR_CODES.CATALOG_REVISION_MALFORMED, `blueprint '${blueprintId}' carries a malformed revision '${revision}'`, { reason: 'malformed-revision', blueprintId, revision });
                        }
                        return value;
                    });
                    rows.push({ blueprintId, revisions });
                }
                return rows;
            },
            async get(blueprintId, blueprintRevision) {
                return blueprintToRecord(resolveBlueprint(blueprintId, blueprintRevision));
            },
        },
        // --- 2/12 intent: the pure domain probe (no local recompute of durable state) ---
        intent: {
            async probe(blueprintId, blueprintRevision, environmentFacts) {
                const resolved = resolveBlueprint(blueprintId, blueprintRevision);
                const result = evaluateCompatibility({
                    requirements: compatibilityRequirementsOf(resolved),
                    environmentFacts: environmentFacts,
                });
                return result;
            },
        },
        // --- 3/12 teamCreate: the root binding (fresh or cold) ---------------------------
        teamCreate: {
            async create(requestedRootSessionId, blueprintId, blueprintRevision, initialWork) {
                // P9-S8 — team.create is the CREATION method: the bound-root guard
                // does not apply to it. The requested root is either NEW (the
                // client's minted id — the standard UI flow, UI §4.3: fresh bind,
                // the host creates and then OWNS the team) or already host-OWNED
                // (the cold rehydrate path — the durable row's bound snapshot must
                // match, enforced below). The frozen request parser already
                // validated the id shape. CR-4 is preserved: creation is a
                // host-authority operation (blueprint snapshot, uniqueness,
                // admission all host-validated) and grants NO authority over
                // existing teams — every other team-scoped method still asserts
                // ownership.
                // D-3 — the fail-closed preflight: the created or retained root must
                // own a LIVE leader agent (the team tools, the leader persona, the
                // leader model) started through the glue's createRootAgent port.
                // Absent port → typed UNAVAILABLE BEFORE any durable effect (no
                // partial team; the handoff preflight discipline).
                requireStartRootAgentPort();
                const resolved = resolveBlueprint(blueprintId, blueprintRevision);
                // BC-03 / R1-A: optional initial work admitted through the EXISTING
                // work-admission path (facade follow-up on the leader instance).
                // Pure step 0 BEFORE any durable bind (malformed work fails without
                // partial creation); the full chain AFTER the bind, under facade
                // authority (gates + work-chain token replay/resume included).
                let initialWorkRequest;
                if (initialWork !== undefined) {
                    // P9-S8 — the initial work targets the REQUESTED root (the team
                    // being created), not the bound root: the leader instance id is
                    // the fixed leader identity (per-team rows, one id), so only the
                    // root scoping follows the request.
                    initialWorkRequest = {
                        rootSessionId: requestedRootSessionId,
                        action: 'follow-up',
                        caller: await options.principal({
                            method: 'team.create',
                            request: {
                                version: REMOTE_CONTRACT_VERSION,
                                params: {
                                    rootSessionId: requestedRootSessionId,
                                    blueprintId,
                                    ...(blueprintRevision !== undefined ? { blueprintRevision } : {}),
                                    initialWork,
                                },
                            },
                        }),
                        targetInstanceId: leaderInstanceId,
                        requestToken: initialWorkRequestToken(initialWork),
                        payload: { ...initialWork },
                    };
                    validateActionRequest(initialWorkRequest);
                }
                // P9-S8 — the durable-row check addresses the REQUESTED root (a
                // NEW root has no row → the fresh path; an already-owned root →
                // the cold path with the snapshot match above).
                const durableRow = repositories.teamSessions.get(requestedRootSessionId);
                let result;
                if (durableRow !== undefined) {
                    // The cold path: the durable row's bound snapshot is the truth;
                    // a request naming a different snapshot is a foreign intent.
                    if (durableRow.blueprint.blueprintId !== resolved.blueprintId ||
                        (blueprintRevision !== undefined &&
                            Number(durableRow.blueprint.revision) !== blueprintRevision)) {
                        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.TEAM_CREATE_BLUEPRINT_MISMATCH, `team.create names blueprint '${resolved.blueprintId}' (revision ${String(blueprintRevision ?? 'latest')}) but the bound TeamSession carries '${durableRow.blueprint.blueprintId}' (revision '${durableRow.blueprint.revision}')`, { reason: 'blueprint-mismatch' });
                    }
                    result = await options.rootBinding.rehydrateCold({ rootSessionId: requestedRootSessionId });
                }
                else {
                    result = await options.rootBinding.bindFresh({
                        rootSessionId: requestedRootSessionId,
                        blueprint: {
                            blueprintId: resolved.blueprintId,
                            revision: resolved.revision,
                            contentHash: resolved.contentHash,
                        },
                        // P9-S8 — inherit the host default workspace (the projection
                        // fold resolves the created team's effective workspace against
                        // it; the team is host-scoped, so the host default IS the
                        // team default).
                        ...(options.defaultWorkspace !== undefined
                            ? { defaultWorkspace: options.defaultWorkspace }
                            : {}),
                    });
                }
                // D-3 — the created/retained root must own a LIVE leader agent:
                // start it (create-or-ensure) BEFORE any initial work delivery —
                // the delivery admits work to the live leader, and a fresh root
                // has no session artifact yet (the port takes the `agents.create`
                // path, the validated handoff shape: the host owns the session,
                // NO native root). The durable bind already landed: a start
                // failure is typed, the team row stays durable, and the retry
                // (cold path) re-drives the start.
                await startRootAgent(requestedRootSessionId);
                if (initialWorkRequest !== undefined) {
                    await options.runtime.performAction(initialWorkRequest);
                }
                return {
                    path: result.path,
                    durable: result.durable ?? null,
                    bind: result.bind,
                };
            },
        },
        // --- 4/12 projection: the projection service (durable source + overlay) ---------
        projection: {
            async project(teamSessionId) {
                assertBoundRoot('team.getProjection', teamSessionId);
                const projection = options.projection.project(teamSessionId);
                return projection;
            },
        },
        // --- 5/12 ledger: the durable rows behind the D-5 slicer (root-filtered) --------
        ledger: {
            async listEntries(teamSessionId) {
                const root = assertBoundRoot('team.getLedgerPage', teamSessionId);
                return rootLedgerEntries(root).map((record) => ledgerEntryWire(record));
            },
            async countEntries(teamSessionId) {
                const root = assertBoundRoot('team.getLedgerPage', teamSessionId);
                return rootLedgerEntries(root).length;
            },
        },
        // --- 6/12 admission: the TeamRuntime facade (NEVER the claimed caller) ----------
        admission: {
            async performAction(request, caller) {
                // P9-S8 (F1-lite v3): admit on the ADDRESSED root (guard-asserted),
                // never the closure bound root — F1-lite v1 fixed team.create but
                // left this port on the bound root, so every host-owned team's
                // member action executed on the boot team (attempt-25 S5: the
                // worker instance + ledger landed on the bound root while the UI
                // projected the handoff root, whose static generation then made the
                // post-create pull a G2 duplicate).
                const addressedRoot = assertBoundRoot(request.action === 'create-member'
                    ? 'member.create'
                    : request.action === 'send-message'
                        ? 'member.send'
                        : 'member.followup', request.rootSessionId);
                const base = {
                    rootSessionId: addressedRoot,
                    caller,
                    requestToken: request.requestToken,
                };
                let facadeRequest;
                if (request.action === 'create-member') {
                    facadeRequest = {
                        ...base,
                        action: 'create-member',
                        ...(request.delegationTemplateId !== undefined
                            ? { delegationTemplateId: request.delegationTemplateId }
                            : {}),
                        ...(request.delegationInstanceId !== undefined
                            ? { delegationInstanceId: request.delegationInstanceId }
                            : {}),
                        ...(request.payload !== undefined ? { payload: { ...request.payload } } : {}),
                    };
                }
                else if (request.action === 'send-message') {
                    // The authoritative recipient/body come from the parsed params;
                    // the client's extra payload fields merge UNDER them (no
                    // override of the authority fields).
                    const payload = { ...(request.payload ?? {}) };
                    payload['recipientInstanceId'] = request.targetInstanceId;
                    payload['body'] = request.body;
                    if (request.subject !== undefined)
                        payload['subject'] = request.subject;
                    facadeRequest = {
                        ...base,
                        action: 'send-message',
                        targetInstanceId: request.targetInstanceId,
                        payload,
                    };
                }
                else {
                    facadeRequest = {
                        ...base,
                        action: 'follow-up',
                        targetInstanceId: request.targetInstanceId,
                        ...(request.payload !== undefined ? { payload: { ...request.payload } } : {}),
                    };
                }
                return options.runtime.performAction(facadeRequest);
            },
        },
        // --- 7/12 lifecycle: the LifecycleService (the only lifecycle authority) --------
        lifecycle: {
            async archive(teamSessionId, instanceId) {
                // F1-lite v3: the asserted addressed root (host-owned teams).
                const root = assertBoundRoot('member.archive', teamSessionId);
                const result = await options.lifecycle.archiveMember({
                    rootSessionId: root,
                    instanceId: instanceId,
                });
                return result;
            },
            async restore(teamSessionId, instanceId) {
                // F1-lite v3: the asserted addressed root (host-owned teams).
                const root = assertBoundRoot('member.restore', teamSessionId);
                const result = await options.lifecycle.restoreMember({
                    rootSessionId: root,
                    instanceId: instanceId,
                });
                return result;
            },
            async dispose(teamSessionId, instanceId) {
                // F1-lite v3: the asserted addressed root (host-owned teams).
                const root = assertBoundRoot('member.dispose', teamSessionId);
                const result = await options.lifecycle.disposeMember({
                    rootSessionId: root,
                    instanceId: instanceId,
                });
                return result;
            },
        },
        // --- 8/12 override: the governance-override admission ----------------------------
        override: {
            async get(teamSessionId, capability, scope, targetInstanceId) {
                const root = assertBoundRoot('override.get', teamSessionId);
                const records = options.overrideRecords(root);
                const effectiveScope = scope ?? 'team';
                const matches = records.filter((record) => {
                    if (record['scope'] !== effectiveScope)
                        return false;
                    if (effectiveScope === 'instance' && record['instanceId'] !== targetInstanceId)
                        return false;
                    if (effectiveScope === 'team' && record['instanceId'] !== undefined)
                        return false;
                    const values = record['values'];
                    return isPlainRecord(values) && capability in values;
                });
                // The most-recently-written record wins (the slot winner by generation).
                let winner = null;
                for (const record of matches) {
                    const generation = record['generation'];
                    if (!isSafeInt(generation))
                        continue;
                    if (winner === null || generation > winner['generation'])
                        winner = record;
                }
                return winner;
            },
            async set(request, caller) {
                const root = assertBoundRoot('override.set', request.teamSessionId);
                const authority = authorityOf(caller, leaderInstanceId);
                const scope = request.scope ?? 'team';
                const instanceId = scope === 'instance' ? request.targetInstanceId : undefined;
                if (scope === 'instance' && (instanceId === undefined || instanceId.length === 0)) {
                    throw new TeamPluginError(S6_REMOTE_ERROR_CODES.OVERRIDE_TARGET_REQUIRED, 'override.set with instance scope requires a targetInstanceId', { reason: 'missing-target' });
                }
                const kind = authority.kind === 'operator' ? 'human-override' : 'autonomy-overlay';
                const records = options.overrideRecords(root);
                const slotMatches = records.filter((record) => record['kind'] === kind &&
                    record['scope'] === scope &&
                    (scope === 'instance' ? record['instanceId'] === instanceId : record['instanceId'] === undefined));
                let winnerGeneration = 0;
                for (const record of slotMatches) {
                    const generation = record['generation'];
                    if (isSafeInt(generation) && generation > winnerGeneration)
                        winnerGeneration = generation;
                }
                // The server-side deterministic clean record id (the remote
                // contract carries NO client-supplied record id; the id is bound
                // to the addressed slot + the current slot generation, so a
                // concurrent same-slot set collides instead of clobbering).
                const recordId = `ovr-${request.capability}-${scope === 'instance' ? instanceId : 'team'}-g${winnerGeneration}`;
                const admitted = await options.admitGovernanceOverride({
                    authority,
                    rootSessionId: root,
                    recordId,
                    scope,
                    ...(instanceId !== undefined ? { instanceId } : {}),
                    cells: { [request.capability]: request.value },
                    now,
                }, options.overrideStore);
                const record = {
                    recordId: admitted.recordId,
                    kind: admitted.kind,
                    scope: admitted.scope,
                    rootSessionId: admitted.rootSessionId,
                    values: admitted.values,
                    generation: admitted.generation,
                    updatedAt: admitted.updatedAt,
                };
                if (admitted.instanceId !== undefined)
                    record['instanceId'] = admitted.instanceId;
                if (admitted.origin !== undefined)
                    record['origin'] = admitted.origin;
                return record;
            },
            async reset(request, caller) {
                const root = assertBoundRoot('override.reset', request.teamSessionId);
                const authority = authorityOf(caller, leaderInstanceId);
                const scope = request.scope ?? 'team';
                const instanceId = scope === 'instance' ? request.targetInstanceId : undefined;
                const kind = authority.kind === 'operator' ? 'human-override' : 'autonomy-overlay';
                const records = options.overrideRecords(root);
                const slotMatches = records.filter((record) => record['kind'] === kind &&
                    record['scope'] === scope &&
                    (scope === 'instance' ? record['instanceId'] === instanceId : record['instanceId'] === undefined));
                let winner = null;
                for (const record of slotMatches) {
                    const generation = record['generation'];
                    if (!isSafeInt(generation))
                        continue;
                    if (winner === null || generation > winner['generation'])
                        winner = record;
                }
                if (winner === null)
                    return { removed: false };
                const removed = await repositories.overrides.delete({
                    kind: winner['kind'],
                    recordId: winner['recordId'],
                    scope: winner['scope'],
                    rootSessionId: root,
                    ...(scope === 'instance' ? { instanceId } : {}),
                });
                return { removed };
            },
        },
        // --- 9/12 policyState: the mutation service (invariant 40: explicit only) -------
        policyState: {
            async read(teamSessionId) {
                const root = assertBoundRoot('policyState.get', teamSessionId);
                const view = policyStateReadOf(options.mutationTransitions(root), Number.MAX_SAFE_INTEGER);
                // R2-1 (BQ-10): the surface reports the CURRENT state plus the
                // AVAILABLE AUTHORIZED TRANSITIONS — the bound blueprint's closed
                // state set (default + the declared states, declaration order)
                // minus the state already active (a self-transition is a no-op
                // the surface does not advertise). The frozen
                // RemotePolicyStateGetValue.state is an open RemoteSafeRecord, so
                // the additive key passes the remote plane unchanged. No impact
                // PREVIEW is invented: the backend provides no preview surface
                // for a not-yet-admitted transition (adjudication, documented in
                // S7R2-result.md). The A31 rejection semantics are untouched: an
                // out-of-closed-set target still fails POLICY_STATE_UNKNOWN and a
                // member actor still fails UNAUTHORIZED_TRANSITION (switchState).
                const closedStates = new Set([
                    DEFAULT_POLICY_STATE_ID,
                    ...blueprint.policyStates.map((state) => state.id),
                ]);
                const availableTransitions = [...closedStates].filter((stateId) => stateId !== view.stateId);
                return {
                    ...view,
                    availableTransitions,
                };
            },
            async switchState(request, caller) {
                const root = assertBoundRoot('policyState.set', request.teamSessionId);
                const target = request.target;
                const stateId = target['stateId'];
                const closed = new Set([DEFAULT_POLICY_STATE_ID, ...blueprint.policyStates.map((state) => state.id)]);
                if (typeof stateId !== 'string' || !closed.has(stateId)) {
                    throw new TeamPluginError(S6_REMOTE_ERROR_CODES.POLICY_STATE_UNKNOWN, `policyState.set names state '${String(stateId)}' which is outside the bound blueprint's closed set (${[...closed].join(', ')})`, { reason: 'unknown-state', stateId: String(stateId) });
                }
                const transition = options.mutationService.switchPolicyState({
                    teamSessionId: root,
                    target: target,
                    actor: actorOf(caller, root, leaderInstanceId),
                });
                return {
                    entryId: transition.entryId,
                    origin: transition.origin,
                    state: transition.state,
                    requestedAtStep: transition.requestedAtStep,
                    effectiveFromStep: transition.effectiveFromStep,
                };
            },
        },
        // --- 10/12 compatibility: the prober (durable state; no local recompute) --------
        compatibility: {
            async current(teamSessionId) {
                assertBoundRoot('compatibility.get', teamSessionId);
                const state = await options.compatibility.current();
                if (state === undefined) {
                    throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_ABSENT, `no durable compatibility state exists for TeamSession '${rootSessionId}'`, { reason: 'state-absent' });
                }
                return compatibilityCurrentOf(state);
            },
            async acknowledge(teamSessionId, requirementId, caller, note) {
                assertBoundRoot('compatibility.ack', teamSessionId);
                const verdict = await options.compatibility.acknowledge({
                    requirementId,
                    acknowledgedBy: caller.kind === 'human' ? caller.humanId : caller.instanceId,
                    ...(note !== undefined ? { note } : {}),
                });
                return verdict;
            },
            async probe(teamSessionId, trigger) {
                assertBoundRoot('compatibility.reprobe', teamSessionId);
                if (!PROBE_TRIGGER_VALUES.includes(trigger)) {
                    throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, `compatibility.reprobe names trigger '${trigger}' outside the closed vocabulary`, { reason: 'unknown-trigger', trigger });
                }
                const outcome = await options.compatibility.probe(trigger);
                return outcome;
            },
        },
        // --- 11/12 handoff: the handoff service (§34.4 fail-closed triad) ---------------
        handoff: {
            async prepareSource(sourceSessionId) {
                // P8-S7-R4 A28: the producer is injected by the production root
                // (the DSH public sessionQuery authority + the deterministic
                // digest). ABSENT (the S5A boot world / test worlds without the
                // session read service) → fail closed exactly as before.
                const producer = options.handoffPrepare;
                if (producer === undefined) {
                    throw new TeamPluginError(S6_REMOTE_ERROR_CODES.HANDOFF_PREPARE_UNAVAILABLE, `the production root exposes no DSH public session read surface for handoff prepare (source session '${sourceSessionId}')`, { reason: 'source-surface-unavailable' });
                }
                return producer(sourceSessionId);
            },
            async start(sourceSessionId, requestToken, staged) {
                const state = await options.handoff.startTeamFromHere({
                    requestToken,
                    sourceSessionId,
                    ...(staged !== undefined ? { staged } : {}),
                });
                return state;
            },
        },
        // --- 12/12 legacy: the frozen read-only reader (fail-closed without a home) -----
        legacy: {
            async inspect(dshHome, workspaceCwd, projectDir) {
                if (options.legacyHome === undefined) {
                    throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEGACY_HOME_UNAVAILABLE, "this production root carries no legacy home port (the boot world does not bind one); legacy.inspect is fail-closed", { reason: 'legacy-home-unavailable' });
                }
                const inspection = options.legacyInspect(options.legacyHome, {
                    dshHome,
                    ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
                    ...(projectDir !== undefined ? { projectDir } : {}),
                });
                return inspection;
            },
        },
        // --- 13/13 messaging: the P6-T3 coordinator (T12-V16) ------------------------
        // `member.send` is the ONLY team-scoped remote method that needs live
        // delivery at admission time: the pre-fix facade-only path left every
        // relay intent undelivered until a `recoverPendingDeliveries` scan
        // happened to run (the T12 window latch, runs #5-#13). The port asserts
        // the bound root (fail-closed) and hands the FULL request — caller
        // included — to the injected coordinator, whose self-send policy,
        // direct/mediated plan, and at-least-once contract match the team tool
        // path exactly.
        messaging: {
            sendTeamMessage(request) {
                return options.messaging.sendTeamMessage({
                    ...request,
                    rootSessionId: assertBoundRoot('member.send', request.rootSessionId),
                });
            },
        },
    };
}
/**
 * Wire the thirteen ports into the nine category handlers.
 *
 * Every value shape mirrors the frozen handler byte-for-byte (the wire
 * contract). The claim-carrying methods derive the principal through the
 * A32 seam BEFORE the port call (the port acts on the derived caller).
 */
function buildS6CategoryHandlers(ports, principal) {
    return {
        [REMOTE_CATEGORIES.CATALOG]: ((method, params) => {
            switch (method) {
                case 'catalog.list': {
                    return ports.catalog.list().then((blueprints) => ({ data: { blueprints } }));
                }
                case 'catalog.get': {
                    const getParams = params;
                    return ports
                        .catalog.get(getParams.blueprintId, getParams.blueprintRevision)
                        .then((blueprint) => ({ data: { blueprint } }));
                }
                default:
                    return Promise.reject(new Error(`catalog handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.INTENT]: ((method, params) => {
            switch (method) {
                case 'intent.probe': {
                    const probeParams = params;
                    return ports
                        .intent.probe(probeParams.blueprintId, probeParams.blueprintRevision, probeParams.environmentFacts)
                        .then((compatibility) => ({ data: { compatibility } }));
                }
                default:
                    return Promise.reject(new Error(`intent handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.TEAM]: ((method, params) => {
            switch (method) {
                case 'team.create': {
                    const createParams = params;
                    return ports
                        .teamCreate.create(createParams.rootSessionId, createParams.blueprintId, createParams.blueprintRevision, createParams.initialWork)
                        .then((created) => ({ data: { path: created['path'], durable: created['durable'], bind: created['bind'] } }));
                }
                case 'team.getProjection': {
                    const projectionParams = params;
                    return ports.projection.project(projectionParams.teamSessionId).then((raw) => {
                        const projection = normalizeS6Projection(raw);
                        return {
                            data: { projection },
                            projectionGeneration: projection['generation'],
                        };
                    });
                }
                case 'team.getLedgerPage': {
                    const pageParams = params;
                    return Promise.all([
                        ports.ledger.listEntries(pageParams.teamSessionId),
                        ports.ledger.countEntries(pageParams.teamSessionId),
                    ]).then(([allEntries, total]) => {
                        const entriesAfter = [];
                        for (const entry of allEntries) {
                            if (entry.sequence > pageParams.afterSequence)
                                entriesAfter.push(entry);
                        }
                        const page = entriesAfter.slice(0, pageParams.limit);
                        let nextAfterSequence = null;
                        if (entriesAfter.length > pageParams.limit) {
                            const last = page[page.length - 1];
                            if (last === undefined) {
                                throw new TeamPluginError(S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED, 'internal ledger slicing error', { reason: 'internal-slicing-error' });
                            }
                            nextAfterSequence = last.sequence;
                        }
                        return { data: { entries: page, nextAfterSequence, total } };
                    });
                }
                default:
                    return Promise.reject(new Error(`team handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.MEMBER]: ((method, params, envelope) => {
            switch (method) {
                case 'member.create': {
                    const createParams = params;
                    const request = {
                        rootSessionId: createParams.teamSessionId,
                        action: 'create-member',
                        callerClaim: createParams.caller,
                        requestToken: createParams.requestToken,
                        ...(createParams.delegationTemplateId !== undefined
                            ? { delegationTemplateId: createParams.delegationTemplateId }
                            : {}),
                        ...(createParams.delegationInstanceId !== undefined
                            ? { delegationInstanceId: createParams.delegationInstanceId }
                            : {}),
                        ...(createParams.payload !== undefined ? { payload: createParams.payload } : {}),
                    };
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
                        data: { outcome: outcome },
                        effectSequence: admissionEffectSequence(outcome),
                    }));
                }
                case 'member.send': {
                    const sendParams = params;
                    // T12-V16: the FULL coordinator path — facade admission (the
                    // durable `team-coordination-recorded` intent fact) + LIVE
                    // delivery of the attributed input to the bound child session
                    // + the `team-message-delivered` confirmation fact. The
                    // pre-fix admission-only facade call left every relay intent
                    // undelivered until a `recoverPendingDeliveries` scan happened
                    // to run (the T12 window latch: runs #5-#13,
                    // t12v-finding-360s-first-turn.md). Self-send policy, the
                    // direct/mediated plan, and the at-least-once contract all
                    // come from the coordinator, exactly as for the team tool
                    // path. The bound-root guard lives in the messaging port.
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.messaging.sendTeamMessage({
                        rootSessionId: sendParams.teamSessionId,
                        caller,
                        recipientInstanceId: sendParams.recipientInstanceId,
                        body: sendParams.body,
                        ...(sendParams.subject !== undefined ? { subject: sendParams.subject } : {}),
                        requestToken: sendParams.requestToken,
                    })).then((outcome) => ({
                        data: { outcome: outcome },
                        effectSequence: outcome.factSequence,
                    }));
                }
                case 'member.followup': {
                    const followupParams = params;
                    const request = {
                        rootSessionId: followupParams.teamSessionId,
                        action: 'follow-up',
                        callerClaim: followupParams.caller,
                        requestToken: followupParams.requestToken,
                        targetInstanceId: followupParams.targetInstanceId,
                        ...(followupParams.payload !== undefined ? { payload: followupParams.payload } : {}),
                    };
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
                        data: { outcome: outcome },
                        effectSequence: admissionEffectSequence(outcome),
                    }));
                }
                case 'member.archive': {
                    const lifecycleParams = params;
                    return ports.lifecycle.archive(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }));
                }
                case 'member.restore': {
                    const lifecycleParams = params;
                    return ports.lifecycle.restore(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }));
                }
                case 'member.dispose': {
                    const lifecycleParams = params;
                    return ports.lifecycle.dispose(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }));
                }
                default:
                    return Promise.reject(new Error(`member handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.OVERRIDE]: ((method, params, envelope) => {
            switch (method) {
                case 'override.get': {
                    const getParams = params;
                    return ports
                        .override.get(getParams.teamSessionId, getParams.capability, getParams.scope, getParams.targetInstanceId)
                        .then((override) => ({ data: { override } }));
                }
                case 'override.set': {
                    const setParams = params;
                    const request = {
                        teamSessionId: setParams.teamSessionId,
                        capability: setParams.capability,
                        value: setParams.value,
                        actorClaim: setParams.actor,
                        ...(setParams.scope !== undefined ? { scope: setParams.scope } : {}),
                        ...(setParams.targetInstanceId !== undefined
                            ? { targetInstanceId: setParams.targetInstanceId }
                            : {}),
                    };
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.override.set(request, caller)).then((result) => ({ data: result }));
                }
                case 'override.reset': {
                    const resetParams = params;
                    const request = {
                        teamSessionId: resetParams.teamSessionId,
                        capability: resetParams.capability,
                        actorClaim: resetParams.actor,
                        ...(resetParams.scope !== undefined ? { scope: resetParams.scope } : {}),
                        ...(resetParams.targetInstanceId !== undefined
                            ? { targetInstanceId: resetParams.targetInstanceId }
                            : {}),
                    };
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.override.reset(request, caller)).then((result) => ({ data: { removed: result.removed } }));
                }
                default:
                    return Promise.reject(new Error(`override handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.POLICY_STATE]: ((method, params, envelope) => {
            switch (method) {
                case 'policyState.get': {
                    const getParams = params;
                    return ports.policyState.read(getParams.teamSessionId).then((state) => ({ data: { state } }));
                }
                case 'policyState.set': {
                    const setParams = params;
                    const request = {
                        teamSessionId: setParams.teamSessionId,
                        target: setParams.target,
                        actorClaim: setParams.actor,
                    };
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.policyState.switchState(request, caller)).then((transition) => ({ data: { transition } }));
                }
                default:
                    return Promise.reject(new Error(`policyState handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.COMPATIBILITY]: ((method, params, envelope) => {
            switch (method) {
                case 'compatibility.get': {
                    const getParams = params;
                    return ports.compatibility.current(getParams.teamSessionId).then((verdict) => ({ data: { verdict } }));
                }
                case 'compatibility.ack': {
                    const ackParams = params;
                    return Promise.resolve(principal({ method, request: envelope })).then((caller) => ports.compatibility.acknowledge(ackParams.teamSessionId, ackParams.requirementId, caller, ackParams.note)).then((verdict) => ({ data: { verdict } }));
                }
                case 'compatibility.reprobe': {
                    const reprobeParams = params;
                    return ports
                        .compatibility.probe(reprobeParams.teamSessionId, reprobeParams.trigger)
                        .then((probe) => ({ data: { probe } }));
                }
                default:
                    return Promise.reject(new Error(`compatibility handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.HANDOFF]: ((method, params) => {
            switch (method) {
                case 'handoff.prepare': {
                    const prepareParams = params;
                    return ports.handoff.prepareSource(prepareParams.sourceSessionId).then((summary) => ({
                        data: { summary, sourceSessionId: prepareParams.sourceSessionId },
                    }));
                }
                case 'handoff.create': {
                    const createParams = params;
                    return ports
                        .handoff.start(createParams.sourceSessionId, createParams.requestToken, createParams.staged)
                        .then((state) => ({ data: { state } }));
                }
                default:
                    return Promise.reject(new Error(`handoff handler routed an unknown method: ${method}`));
            }
        }),
        [REMOTE_CATEGORIES.LEGACY]: ((method, params) => {
            switch (method) {
                case 'legacy.inspect': {
                    const inspectParams = params;
                    return ports
                        .legacy.inspect(inspectParams.dshHome, inspectParams.workspaceCwd, inspectParams.projectDir)
                        .then((inspection) => ({ data: { inspection } }));
                }
                default:
                    return Promise.reject(new Error(`legacy handler routed an unknown method: ${method}`));
            }
        }),
    };
}
/**
 * Validate the projection at the TOP LEVEL only (the frozen D-4 rule,
 * mirrored): the nine closed `TeamProjectionDto` fields must be present
 * with the right structural kinds; the nested values pass through.
 */
function normalizeS6Projection(raw) {
    if (!isPlainRecord(raw)) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, `the projection port returned a malformed value (expected an object, got ${String(raw)})`, { reason: 'port-contract', field: 'projection' });
    }
    for (const field of REMOTE_PROJECTION_FIELDS) {
        if (!(field in raw)) {
            throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, `the projection port returned a malformed value (missing field '${field}')`, { reason: 'port-contract', field: `projection.${field}` });
        }
    }
    const schemaVersion = raw['schemaVersion'];
    const generation = raw['generation'];
    if (!isSafeInt(schemaVersion)) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, "the projection port returned a malformed 'schemaVersion'", { reason: 'port-contract', field: 'projection.schemaVersion' });
    }
    if (!isSafeInt(generation) || generation < 1) {
        throw new TeamPluginError(S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED, "the projection port returned a malformed 'generation'", { reason: 'port-contract', field: 'projection.generation' });
    }
    return raw;
}
// --- the production dispatcher (the frozen seven invariants, async) ---------------------
/**
 * Map any failure value to a typed error result (the frozen invariants
 * 4a/4b/5, mirrored verbatim).
 */
function toS6RemoteErrorResult(error, ctx) {
    // Invariant 4a: the remote layer's own typed errors keep their code.
    if (isRemoteContractError(error)) {
        const details = error.details;
        const field = details !== undefined && typeof details['field'] === 'string' ? details['field'] : undefined;
        const reason = details !== undefined && typeof details['reason'] === 'string'
            ? details['reason']
            : undefined;
        return buildRemoteError(error.code, error.message, ctx, { field, reason });
    }
    // Invariant 4b (T12-H4): ONLY an error whose string `code` is a member of
    // the closed backing vocabulary (REMOTE_BACKING_ERROR_CODE_SET, the single
    // definition shared with the pure remote dispatcher) passes through with
    // code + message; the source identity rides under details.cause (never its
    // stack, never a live object — lossless-checked under cause.details). An
    // `Error` with an out-of-vocabulary `code` (a Node ENOENT with a path in
    // the message, a synthetic code, …) degrades to invariant 5.
    if (error instanceof Error) {
        const typed = error;
        if (typeof typed.code === 'string' && REMOTE_BACKING_ERROR_CODE_SET.has(typed.code)) {
            return buildRemoteError(typed.code, typed.message, ctx, {
                reason: 'domain-error',
                cause: { code: typed.code, message: typed.message },
                sourceDetails: typed.details,
            });
        }
    }
    // Invariant 5: an untyped throw — generic message, no leak.
    return buildRemoteError(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR, 'internal error in remote handler', ctx, { reason: 'untyped-error' });
}
/**
 * Create the production throw-proof dispatcher (the frozen seven
 * invariants; the async mirror).
 *
 * T12-B4 — the mounted entry owns the transport's trusted
 * {@link ServerPrincipalContext}: the default is the connection-gate basis
 * (the DSH web seam's gate enforced 401/403 upstream of dispatch, so every
 * request reaching this dispatcher already passed it). A caller may pass an
 * explicit context (the production surfaces do); one that fails the
 * structural guard typed-rejects EVERY request under the existing
 * `TEAM_REMOTE_PRINCIPAL_INVALID` code — before any claim is read, with no
 * new wire code. See the `ServerPrincipalContext` authority model in
 * s6-principal for the full seam contract.
 *
 * @param ports - the thirteen production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (defaults to the connection-gate basis).
 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
 */
export function createS6RemoteDispatcher(ports, principal, principalContext) {
    const handlers = buildS6CategoryHandlers(ports, principal);
    const context = principalContext ??
        createServerPrincipalContext({ transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE });
    const contextValid = isServerPrincipalContext(context);
    return async (endpoint, payload) => {
        let ctx = {
            method: endpoint,
            endpoint,
            contractVersion: REMOTE_CONTRACT_VERSION,
            requestToken: null,
        };
        let response;
        try {
            // T12-B4: the trusted PrincipalContext is consulted at the mounted
            // entry, BEFORE invariant 1 — fail-closed. No derivation, no claim
            // read, no new wire code.
            if (!contextValid) {
                throw new TeamPluginError(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID, 'the remote mount does not carry the connection-gate authority basis', { reason: 'principal-context-broken' });
            }
            // Invariant 1: unknown endpoint (checked before the envelope).
            if (!isRemoteMethod(endpoint)) {
                throw remoteContractError(REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD, `endpoint '${endpoint}' is not a method of the closed Remote contract v1 catalog`, { reason: 'unknown-endpoint' });
            }
            // Invariant 2: the request envelope (closed: version + params).
            const request = parseRemoteRequest(payload);
            ctx = { ...ctx, contractVersion: request.version };
            // Invariant 3: the method's closed param schema.
            const parsed = parseRemoteMethodParams(endpoint, request.params);
            ctx = { ...ctx, requestToken: parsed.requestToken };
            // Invariant 4: the category handler (the backing port call) — the
            // async mirror awaits (the frozen dispatcher calls synchronously).
            const outcome = await handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params, request);
            // Invariant 6: lossless check + provenance on the success value.
            response = buildRemoteSuccess(outcome.data, {
                ...ctx,
                projectionGeneration: outcome.projectionGeneration ?? null,
                effectSequence: outcome.effectSequence ?? null,
            });
        }
        catch (error) {
            response = toS6RemoteErrorResult(error, ctx);
        }
        // Invariant 7: the promise never rejects.
        return Promise.resolve(response);
    };
}
/**
 * Register the production dispatcher on the public seam (the frozen
 * register semantics, mirrored: one channel, the idempotent disposer).
 * @param ports - the thirteen production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (T12-B4; defaults to the connection-gate basis).
 * @returns the `RemoteHandlerRegistration` the A31 seam installs.
 */
export function createS6RemoteRegistration(ports, principal, principalContext) {
    const dispatcher = createS6RemoteDispatcher(ports, principal, principalContext);
    return (connection) => {
        const channel = REMOTE_RPC_CHANNEL;
        const handleResult = connection.rpc.handle(channel, dispatcher);
        if (typeof handleResult === 'function') {
            const disposeRegistration = handleResult;
            let disposed = false;
            return {
                channel,
                dispose: () => {
                    if (disposed)
                        return;
                    disposed = true;
                    disposeRegistration();
                },
            };
        }
        return { channel, dispose: () => { } };
    };
}
// --- A33 + A34 the pagination completion (the tracker gate) ------------------------------
/** The tracker cache bound (single-root host; one session per start anchor). */
const S6_TRACKER_CACHE_MAX = 16;
function createS6TrackerCache() {
    const sessions = new Map();
    return {
        trackerForAnchor(afterSequence) {
            const existing = sessions.get(afterSequence);
            if (existing !== undefined && existing.tracker.state().anchor === afterSequence)
                return existing;
            const tracker = createLedgerPageTracker(afterSequence);
            sessions.set(afterSequence, { tracker });
            while (sessions.size > S6_TRACKER_CACHE_MAX) {
                const oldest = sessions.keys().next().value;
                if (oldest === undefined)
                    break;
                sessions.delete(oldest);
            }
            return sessions.get(afterSequence);
        },
    };
}
/**
 * The A34 remote query/command completion (the plan §20.5/§20.6 gate).
 *
 * `team.getLedgerPage` is gated BEFORE dispatch: the expected page is
 * computed from the durable ledger (the same slicer the dispatcher path
 * serves — dispatch is synchronous w.r.t. the durable rows, so the
 * pre-computed page IS the served page), then the tracker session for the
 * request's start anchor validates it (the 20.5/20.6 invariants: the
 * stable cursor, the load-earlier session, the growth-safe window, the
 * monotonic total). A rejected page is a typed error response BEFORE any
 * dispatch (fail-closed). Every other method passes through to the
 * dispatcher unchanged.
 *
 * The returned value is the lossless-JSON `RemoteResponse` (the seam
 * contract).
 */
export function createS6RemoteQueryCommandCompletion(ports, options, dispatcher) {
    const { rootSessionId, isOwnedRoot } = options;
    const trackers = createS6TrackerCache();
    /** The bound-root guard's acceptance (same semantics as the port guard). */
    function ownsRoot(teamSessionId) {
        return teamSessionId === rootSessionId || (isOwnedRoot?.(teamSessionId) ?? false);
    }
    return (input) => {
        const { method, request } = input;
        if (method !== 'team.getLedgerPage') {
            // The non-paging query/command methods: the dispatcher is the
            // completion (the same seven invariants).
            return dispatcher(method, request);
        }
        const ctx = {
            method,
            endpoint: method,
            contractVersion: request.version,
            requestToken: null,
        };
        // 1. The bound-root guard (before anything else — a foreign TeamSession
        //    never reaches the ledger).
        const rawTeamSessionId = request.params['teamSessionId'];
        if (typeof rawTeamSessionId !== 'string' || !ownsRoot(rawTeamSessionId)) {
            return Promise.resolve(buildRemoteError(S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM, `remote method '${method}' addresses TeamSession '${String(rawTeamSessionId)}' which this host does not own (bound root '${rootSessionId}')`, ctx, { reason: 'foreign-team' }));
        }
        // 2. The closed param schema (malformed → the dispatcher reports it
        //    with the frozen codes; the pre-gate never invents a third code).
        let pageParams;
        try {
            pageParams = parseRemoteTeamGetLedgerPageParams(method, request.params);
        }
        catch {
            return dispatcher(method, request);
        }
        // 3. The expected page (the D-5 slicer over the durable rows).
        return Promise.all([
            ports.ledger.listEntries(pageParams.teamSessionId),
            ports.ledger.countEntries(pageParams.teamSessionId),
        ]).then(([allEntries, total]) => {
            const entriesAfter = [];
            for (const entry of allEntries) {
                if (entry.sequence > pageParams.afterSequence)
                    entriesAfter.push(entry);
            }
            const page = entriesAfter.slice(0, pageParams.limit);
            let nextAfterSequence = null;
            if (entriesAfter.length > pageParams.limit) {
                const last = page[page.length - 1];
                if (last === undefined) {
                    return buildRemoteError(S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED, 'internal ledger slicing error', ctx, { reason: 'internal-slicing-error' });
                }
                nextAfterSequence = last.sequence;
            }
            const pageValue = { entries: page, nextAfterSequence, total };
            // 4. The tracker gate (the A33 session for this start anchor).
            const session = trackers.trackerForAnchor(pageParams.afterSequence);
            const check = session.tracker.applyPage({ afterSequence: pageParams.afterSequence, limit: pageParams.limit }, pageValue);
            if (!check.ok) {
                return buildRemoteError(S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED, `the ledger page was rejected by the pagination tracker: ${check.reason}`, ctx, { reason: check.reason });
            }
            // 5. The lossless-JSON success reply (the served page).
            return buildRemoteSuccess(pageValue, {
                ...ctx,
                projectionGeneration: null,
                effectSequence: null,
            });
        });
    };
}
/**
 * Build the complete S6 remote surface set (A31 + A33 + A34) over the
 * host's owned roots — the bound root + any TeamSession root the host
 * durably owns (P9-S8; the single entry point the production root calls).
 *
 * T12-B4: the production surface owns the transport's trusted
 * PrincipalContext EXPLICITLY — the DSH web seam's connection gate is the
 * authority basis of every call reaching the mounted dispatcher (and the
 * completion surface), recorded here at construction, never taken from a
 * payload claim.
 *
 * @param options - the root-bound inputs.
 * @returns the registration (A31) + the completion (A34, A33-gated).
 */
export function createS6RemoteSurfaces(options) {
    const ports = createS6RemotePorts(options);
    const principalContext = createServerPrincipalContext({
        transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE,
    });
    const dispatcher = createS6RemoteDispatcher(ports, options.principal, principalContext);
    const completion = createS6RemoteQueryCommandCompletion(ports, options, dispatcher);
    return {
        registration: createS6RemoteRegistration(ports, options.principal, principalContext),
        completion,
    };
}
//# sourceMappingURL=s6-remote.js.map