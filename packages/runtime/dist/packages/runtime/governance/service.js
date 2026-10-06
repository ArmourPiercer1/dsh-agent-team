/**
 * pre-alpha3 PR-A — the production GOVERNANCE MUTATION AUTHORITY (ADR-03):
 * the single production write path for the two durable governance truths
 * of a TeamDomain — the `overrides` store and the PolicyState transitions
 * — with every mutation serialized on the shared per-team operation chain
 * (the P8-S5B coordinator) and committed durably BEFORE the ack.
 *
 * Why this module exists — the PR-A target: before this PR, the
 * production write paths were FORKED:
 *
 * - `override.set` ran a remote-side slot scan + the
 *   `admitGovernanceOverride` glue (no envelope check, no external-hard
 *   check, NOT serialized on the shared chain — a lost-update race on
 *   the same slot);
 * - `override.reset` deleted the durable row directly (a member could
 *   revoke the TEAM-scoped slot — the authority hole), bypassing the
 *   generation guard and the chain;
 * - `policyState.set` ran the pure `MutationService` (synchronous,
 *   process-local store) whose durable write was fire-and-schedule — the
 *   ack could return before the ledger row was durable.
 *
 * This service is the ONE authority all of them converge to:
 *
 * ```
 * remote / tool -> GovernanceMutationService
 *                      -> the shared per-team operation chain
 *                      -> TeamDomain (overrides repository / ledger)
 * ```
 *
 * Semantics (the full rule set lives in the pure slot kernel —
 * {@link module:./slot}): slot closure by authority (leader -> team
 * scope; member -> own instance; operator -> human override), closed
 * cell vocabulary, write-time envelope (agent origins; deny always
 * passes), write-time external hard facts (EVERY origin — the
 * absolute ceiling), the `expectedGeneration` guard, the desired-state
 * no-op, the full-slot re-issue, the reset tombstone, and the
 * commit-before-ack durable write for both the override records and the
 * PolicyState transitions.
 *
 * The old surfaces are demoted, not forked further:
 * `persistGovernanceOverride` (mutation/override-admission) is a narrow
 * persistence primitive the tests exercise directly, and the
 * `MutationService` class stays a pure kernel of the P7-T2 test worlds —
 * NEITHER is a production authority after this PR.
 *
 * Pure with respect to the ports: no node: builtins, no storage import,
 * no DSH imports — the durable homes are injected (see
 * {@link GovernanceMutationServiceDeps}).
 *
 * @module @dsh-agent-team/runtime/governance/service
 */
import { createMemberIdentity, deepFreeze, } from '../../domain/policy/src/index.js';
import { MUTATION_ERROR_CODES, MutationError } from '../mutation/errors.js';
import { normalizeStateView } from '../mutation/service.js';
import { committedPolicyState } from '../effective-policy/index.js';
import { assertCells, buildReissueRecord, buildTombstoneRecord, checkCellsAgainstEnvelope, checkCellsExternalHard, isNoChange, mergedSlotValues, mintRecordId, selectSlotWinner, slotIdentityOf, slotOf, } from './slot.js';
import { PERMISSION_EFFECT_PRECEDENCE, authorizeCeilingBoundedPermissionRise, authorizeLeaderPermissionMutation, classifyPermissionRise, parsePermissionMutation, parsePermissionMutationEnvelope, parsePermissionStaticLayerFacts, planPermissionMutation, PERMISSION_MUTATION_ERROR_CODES, PermissionMutationError, } from './permission-mutation.js';
import { AUTHORITY_CEILING_ERROR_CODES, AuthorityBindingError, expansionCeiling, grantCeiling, } from './authority-ceiling.js';
import { evaluateAuthorityCeiling } from './runtime-authority.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js';
/** The storage duplicate code string (mirrors TEAM_DOMAIN_ERROR_CODES). */
const STORAGE_RECORD_DUPLICATE = 'RECORD_DUPLICATE';
/**
 * The production step pin of the PolicyState transitions (the S5A
 * documented ruling — the production step clock is pinned to 0; the
 * future-boundary fields keep their byte-identical shape. PR-B removes
 * the step fields from the production surface).
 */
const PRODUCTION_REQUESTED_AT_STEP = 0;
const PRODUCTION_EFFECTIVE_FROM_STEP = 1;
function storageErrorCode(error) {
    if (error instanceof Error) {
        const code = error.code;
        if (typeof code === 'string')
            return code;
    }
    return undefined;
}
/**
 * Map the durable store's identity-collision code into the closed
 * mutation surface (the row wiring re-parses through the storage schema;
 * a same-identity different-bytes put is a typed conflict, not a crash).
 */
function mapStoreError(error) {
    if (storageErrorCode(error) === STORAGE_RECORD_DUPLICATE) {
        throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT, 'a governance override already exists at the requested identity (the durable store rejected the put)', { problem: 'duplicate-override' });
    }
    throw error;
}
/**
 * The closed-`policyStates` dep, mapped onto the closed mutation surface
 * (pre-alpha3 W1a, review round 2 — the DOCUMENTED service-level mapping
 * boundary for the bound-Blueprint resolution failures of the
 * three-case production resolver contract, bound-blueprint.ts):
 *
 * - the raw authority `TEAM_BLUEPRINT_SNAPSHOT_MISMATCH` (the bound
 *   snapshot ref's content hash the authority cannot reproduce) → the
 *   closed wire code `POLICY_STATE_SNAPSHOT_MISMATCH` with
 *   `reason: 'snapshot-mismatch'`. The raw code is NOT in the remote's
 *   closed backing-code set, so an unmapped pass-through would degrade
 *   to an untyped `internal-error` on the wire (the M1 gap this closes).
 *   The authority's machine details (blueprintId / revision /
 *   expectedContentHash / foundContentHash) are copied from its `detail`
 *   (TeamPluginError's singular detail key, which the dispatcher's
 *   invariant-4b pass-through does NOT surface) into this error's
 *   `details` — the key the wire folds under `details.cause.details`;
 * - every other error is re-thrown UNCHANGED: the authority's closed
 *   `MALFORMED_DTO` `blueprint-not-found` (an unresolvable ref identity)
 *   is already a closed wire code the dispatcher passes through as-is
 *   (invariant 4b, carrying its own typed details), and any other throw
 *   is a programming error that must stay loud.
 *
 * The mapping runs BEFORE the closed-set check and BEFORE any commit —
 * a bound team whose Blueprint cannot be reproduced fails closed with a
 * ZERO write; the row anchor is never consulted for a bound ref.
 */
function boundClosedStates(deps, rootSessionId) {
    try {
        return deps.policyStates(rootSessionId);
    }
    catch (error) {
        if (error instanceof Error && error.code === 'TEAM_BLUEPRINT_SNAPSHOT_MISMATCH') {
            const detail = error.detail;
            const sourceDetails = {};
            for (const key of ['blueprintId', 'revision', 'expectedContentHash', 'foundContentHash']) {
                if (detail !== undefined && key in detail)
                    sourceDetails[key] = detail[key];
            }
            throw new MutationError(MUTATION_ERROR_CODES.POLICY_STATE_SNAPSHOT_MISMATCH, `policyState set on '${rootSessionId}' failed: the bound Blueprint cannot be reproduced by the Blueprint authority — ${error.message}`, {
                reason: 'snapshot-mismatch',
                rootSessionId,
                ...sourceDetails,
            });
        }
        throw error;
    }
}
/** Whether one stored record sits in the addressed slot. */
function inSlot(record, slot) {
    if (record.kind !== slot.kind || record.scope !== slot.scope || record.rootSessionId !== slot.rootSessionId) {
        return false;
    }
    if (slot.scope === 'instance')
        return record.instanceId === slot.instanceId;
    return record.instanceId === undefined;
}
/** Build the admitted view from one committed record (the backend truth). */
function admittedView(args) {
    return deepFreeze({
        recordId: args.recordId,
        kind: args.kind,
        scope: args.scope,
        rootSessionId: args.rootSessionId,
        ...(args.instanceId !== undefined ? { instanceId: args.instanceId } : {}),
        ...(args.origin !== undefined ? { origin: args.origin } : {}),
        values: args.values,
        generation: args.generation,
        updatedAt: args.updatedAt,
        supersededRecordId: args.supersededRecordId,
    });
}
/**
 * Create the production governance mutation authority for one root.
 *
 * @param deps - the injected durable homes (chain / overrides store /
 *   transition cache + commit / policy facts / member roster / closed
 *   state set / clock).
 * @returns the service surface ({@link GovernanceMutationService}).
 */
export function createGovernanceMutationService(deps) {
    /**
     * The write-time checks common to every cell set: the external hard
     * facts (EVERY origin) + the autonomy envelope (agent origins only).
     * Runs inside the chain's critical section (the roster / facts reads
     * are part of the serialized admission).
     */
    const writeTimeChecks = async (rootSessionId, slot, cells) => {
        const external = deps.policy.readExternalFacts(rootSessionId);
        checkCellsExternalHard(cells, rootSessionId, external);
        if (slot.origin !== undefined) {
            const registeredMembers = await deps.registeredMembers(rootSessionId);
            const blueprint = deps.policy.readBlueprintEnvelope(rootSessionId);
            const member = slot.origin === 'member' && slot.instanceId !== undefined
                ? createMemberIdentity(rootSessionId, slot.instanceId)
                : undefined;
            checkCellsAgainstEnvelope(cells, rootSessionId, slot.origin, member, registeredMembers, blueprint, (team, identity) => deps.policy.readTemplatePolicy(team, identity));
        }
    };
    const setOverride = async (args) => {
        // Outside the chain: the authority closure + the cell shapes (pure).
        const slot = slotOf(args.authority, args.scope, args.instanceId);
        const cells = assertCells(args.cells);
        return deps.chain.run(args.rootSessionId, async () => {
            // Load the durable truth (inside the critical section).
            const existing = await deps.overrides.list(args.rootSessionId);
            const slotId = slotIdentityOf(slot, args.rootSessionId);
            const winner = selectSlotWinner(existing, slotId);
            const winnerGeneration = winner === null ? 0 : winner.generation;
            // Optimistic generation guard (stale readers must not clobber).
            if (args.expectedGeneration !== undefined && args.expectedGeneration !== winnerGeneration) {
                throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT, 'the slot winner moved since the caller read it', { expectedGeneration: args.expectedGeneration, actualGeneration: winnerGeneration });
            }
            const recordId = mintRecordId(Object.keys(cells), slot.scope, slot.instanceId, winnerGeneration);
            // Identity conflict (a same-generation replay at a different cell
            // set — the id is bound to slot + cell set + winner generation).
            const conflict = existing.find((record) => inSlot(record, slotId) && record.recordId === recordId);
            if (conflict !== undefined) {
                throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT, `a governance override already exists at recordId ${recordId} (generation ${conflict.generation})`, { recordId, existingGeneration: conflict.generation });
            }
            // Write-time checks (envelope + external hard; every origin).
            await writeTimeChecks(args.rootSessionId, slot, cells);
            // Desired-state no-op (no write, no generation bump).
            if (isNoChange(winner, cells)) {
                return {
                    changed: false,
                    reason: 'no-change',
                    // A no-change set always found a winner (an empty slot can
                    // never be desired-equal to a non-empty cell set), so this is
                    // never undefined in practice — the type keeps it honest.
                    current: winner === null ? undefined : winner,
                };
            }
            // Full-slot re-issue, committed BEFORE the ack.
            const values = mergedSlotValues(winner, cells);
            const updatedAt = deps.now();
            const record = buildReissueRecord({
                slot,
                rootSessionId: args.rootSessionId,
                recordId,
                values,
                winnerGeneration,
                updatedAt,
            });
            try {
                await deps.overrides.put(record);
            }
            catch (error) {
                mapStoreError(error);
            }
            return {
                changed: true,
                record: admittedView({
                    recordId,
                    kind: slot.kind,
                    scope: slot.scope,
                    rootSessionId: args.rootSessionId,
                    ...(slot.instanceId !== undefined ? { instanceId: slot.instanceId } : {}),
                    ...(slot.origin !== undefined ? { origin: slot.origin } : {}),
                    values,
                    generation: winnerGeneration + 1,
                    updatedAt,
                    supersededRecordId: winner === null ? null : winner.recordId,
                }),
            };
        });
    };
    const resetOverride = async (args) => {
        const slot = slotOf(args.authority, args.scope, args.instanceId);
        return deps.chain.run(args.rootSessionId, async () => {
            const existing = await deps.overrides.list(args.rootSessionId);
            const slotId = slotIdentityOf(slot, args.rootSessionId);
            const winner = selectSlotWinner(existing, slotId);
            if (winner === null)
                return { removed: false };
            // The reset's desired state is "no override in force for this
            // slot". When the winner is ALREADY a tombstone (an empty values
            // set) that state holds: a typed no-op — no second tombstone, no
            // generation bump (the idempotent-reset ruling; a retry of the
            // same desired state never writes a new generation).
            if (Object.keys(winner.values).length === 0) {
                return {
                    removed: false,
                    current: admittedView({
                        recordId: winner.recordId,
                        kind: winner.kind,
                        scope: winner.scope,
                        rootSessionId: winner.rootSessionId,
                        ...(winner.instanceId !== undefined ? { instanceId: winner.instanceId } : {}),
                        ...(winner.origin !== undefined ? { origin: winner.origin } : {}),
                        // The stored values were validated on admission; the view
                        // type narrows them back to the closed PolicyEntry shapes.
                        values: winner.values,
                        generation: winner.generation,
                        updatedAt: winner.updatedAt,
                        supersededRecordId: null,
                    }),
                };
            }
            const winnerGeneration = winner.generation;
            if (args.expectedGeneration !== undefined && args.expectedGeneration !== winnerGeneration) {
                throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT, 'the slot winner moved since the caller read it', { expectedGeneration: args.expectedGeneration, actualGeneration: winnerGeneration });
            }
            // The reset tombstone (kind/origin preserved; empty values).
            const recordId = `ovr-reset-${slot.scope === 'instance' ? slot.instanceId : 'team'}-g${winnerGeneration}`;
            const conflict = existing.find((record) => inSlot(record, slotId) && record.recordId === recordId);
            if (conflict !== undefined) {
                throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT, `a governance override already exists at recordId ${recordId} (generation ${conflict.generation})`, { recordId, existingGeneration: conflict.generation });
            }
            const updatedAt = deps.now();
            const tombstone = buildTombstoneRecord({
                slot,
                rootSessionId: args.rootSessionId,
                recordId,
                winnerGeneration,
                updatedAt,
            });
            try {
                await deps.overrides.put(tombstone);
            }
            catch (error) {
                mapStoreError(error);
            }
            return {
                removed: true,
                tombstone: admittedView({
                    recordId,
                    kind: slot.kind,
                    scope: slot.scope,
                    rootSessionId: args.rootSessionId,
                    ...(slot.instanceId !== undefined ? { instanceId: slot.instanceId } : {}),
                    ...(slot.origin !== undefined ? { origin: slot.origin } : {}),
                    values: {},
                    generation: winnerGeneration + 1,
                    updatedAt,
                    supersededRecordId: winner.recordId,
                }),
            };
        });
    };
    const switchPolicyState = async (args) => {
        // Outside the chain: the actor rules + the target shape (pure).
        const actorKind = args.actor.kind;
        if (actorKind === 'member') {
            throw new MutationError(MUTATION_ERROR_CODES.UNAUTHORIZED_TRANSITION, 'a PolicyState transition by an ordinary member is unauthorized (only explicit human / authorized-leader transitions exist, invariant 40)', { allowedActors: ['human', 'leader'] });
        }
        if (args.actor.member !== undefined) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, 'malformed transition request: transition actors are TeamSession-level (no member)', { field: 'actor.member' });
        }
        const target = normalizeStateView(args.target, 'target');
        return deps.chain.run(args.rootSessionId, async () => {
            // The bound Blueprint's closed set — resolved through the
            // production three-case resolver contract (bound-blueprint.ts) and
            // mapped onto the closed mutation surface before the closed-set
            // check and before any commit (see boundClosedStates).
            const closed = boundClosedStates(deps, args.rootSessionId);
            if (!closed.includes(target.stateId)) {
                throw new MutationError(MUTATION_ERROR_CODES.POLICY_STATE_UNKNOWN, `policyState target '${target.stateId}' is outside the bound blueprint's closed set (${closed.join(', ')})`, { reason: 'unknown-state', stateId: target.stateId, closedStates: [...closed] });
            }
            const transitions = deps.transitions.listTransitions(args.rootSessionId);
            // pre-alpha3 PR-B (plan §B.2): the no-change check runs against the
            // COMMITTED state — the last durable transition in commit order
            // (the production step clock is retired as a decision source).
            const committed = committedPolicyState(transitions);
            if (committed.state.stateId === target.stateId) {
                return {
                    changed: false,
                    reason: 'no-change',
                    state: target,
                };
            }
            // Deterministic entry id (state + lane length): a same-request
            // replay after commit is a no-op (the state is already active), so
            // the id can never collide with a different fact.
            const entryId = `ps-${target.stateId}-${transitions.length}`;
            // The transition's origin is the FROZEN team value-origin vocabulary
            // (static/leader/member/human — the durable row is parsed against
            // TEAM_VALUE_ORIGIN_VALUES at boot preload). The mutation-actor
            // vocabulary maps onto it: the human override actor ('operator') is
            // the 'human' value origin; the leader stays 'leader' (members are
            // rejected above — invariant 40).
            const origin = actorKind === 'leader' ? 'leader' : 'human';
            const transition = deepFreeze({
                entryId,
                origin,
                state: target,
                requestedAtStep: PRODUCTION_REQUESTED_AT_STEP,
                effectiveFromStep: PRODUCTION_EFFECTIVE_FROM_STEP,
            });
            // COMMIT-BEFORE-ACK: the durable ledger row is written BEFORE the
            // ack (the R2-1 fire-and-schedule window is closed); only then the
            // in-memory read cache is appended. The row is stamped with the
            // ADDRESSED TeamSession (args.rootSessionId) — the durable read is
            // root-keyed, so stamping anything else would make the committed
            // state invisible to this team and leak it to a foreign root (the
            // overrides lane stamps args.rootSessionId the same way, :266/283).
            await deps.transitionCommit.commit(args.rootSessionId, transition);
            deps.transitions.appendTransition(args.rootSessionId, transition);
            return { changed: true, transition };
        });
    };
    /**
     * Alpha.3 PR3 (additive — the legacy methods above are byte-unchanged):
     * the permission-mutation path of the ONE governance mutation authority
     * (ADR §1: every permission mutation flows through HERE, never around;
     * the PR1 repository port is persistence-only and stays that way — this
     * method validates, the port stores).
     *
     * Pipeline (ADR §1 order, design §2 responsibilities):
     * 1. authenticate authority — the same derived server-side
     *    `MutationAuthority` vocabulary as the legacy methods: leader and
     *    operator act, an ordinary member is unauthorized on this lane;
     * 2. validate the PermissionMutation (grammar, class/matcher pairing,
     *    design §5 exec exactness) and the §6 MutationEnvelope (fail-closed:
     *    no envelope configured = no Leader expansion authority);
     * 3. serialize on the SAME shared per-team chain, read the current
     *    authority snapshot, apply the expectedGeneration CAS;
     * 4. for every Leader EXPANSION (rank UP — ADR §6; ABSENCE counts as
     *    `deny`), require an envelope rule covering matcher + maximum-effect
     *    ceiling; TIGHTENINGS need none (pinned both directions by test);
     *    Human mutations skip the envelope check (ADR §7) and record Human
     *    provenance — which is audit data, never precedence (the port stores
     *    `actor` verbatim; the read side selects authority by GENERATION —
     *    PR2's assembler never interprets `actor`);
     * 5. commit ONE new FULL snapshot through the port (commit-before-ack)
     *    and return the durable row (provenance: actor / mutationId /
     *    timestamp from the injected clock / reason).
     */
    const mutatePermission = async (args) => {
        // 1. Lane configuration (PR3 lands the capability dormant: the
        // production root does not wire the lane, so the refusal is typed).
        const lane = deps.permissionLane;
        if (lane === undefined) {
            throw new PermissionMutationError(PERMISSION_MUTATION_ERROR_CODES.NOT_CONFIGURED, 'the permission-mutation lane is not configured on this governance service (PR3 ships the authority with zero production wiring)', { problem: 'permission-lane-absent' });
        }
        // 2a. Authority closure (pure, outside the chain — same discipline as
        // slotOf above the legacy paths). leader -> expansion-bound actor;
        // operator -> the Human surface (ADR §7); anything else -> refused.
        const actor = (() => {
            switch (args.authority.kind) {
                case 'leader':
                    return 'leader';
                case 'operator':
                    return 'human';
                case 'member':
                default:
                    throw new PermissionMutationError(PERMISSION_MUTATION_ERROR_CODES.UNAUTHORIZED_ACTOR, 'an ordinary member is unauthorized on the permission-mutation lane (the ADR §6 leader / ADR §7 human surfaces only)', { problem: 'actor-outside-closed-set', actorKind: String(args.authority.kind) });
            }
        })();
        // 2b. Structural validation of the mutation (typed refusal, zero write).
        const mutation = parsePermissionMutation({
            kind: args.kind,
            mutationId: args.mutationId,
            teamSessionId: args.teamSessionId,
            memberInstanceId: args.memberInstanceId,
            reason: args.reason,
            rules: args.rules,
            ...(args.expectedGeneration !== undefined ? { expectedGeneration: args.expectedGeneration } : {}),
        });
        // The envelope document is validated the moment it is read (fail-closed:
        // a malformed envelope refuses EVERY Leader expansion attempt, never a
        // silently relaxed one). Human mutations need no envelope (ADR §7) — but
        // the read happens inside the serialized section like every other fact.
        // 3. Serialize on the shared per-team chain (the SAME chain the legacy
        // overrides/policyState lanes use — one chain, one mutation order per
        // team; ADR §1's "bypass mutation serialization" MUST-NOT is honored by
        // construction).
        return deps.chain.run(args.teamSessionId, async () => {
            const overlay = lane.overlay;
            // ROUND 7 (parent BLOCK-1): the TARGET lifecycle assertion INSIDE the
            // serialized section — the post-await revalidation a caller-side
            // pre-check can never be (a dispose racing between the pre-check and
            // this line is caught here, before ANY classification or append). The
            // guard is the SAME shared assertion the mutation lane pre-checks
            // (permission-lifecycle/mutation-lane assertPermissionMutationTarget)
            // — ONE lifecycle law, wired from the same reader, never a second gate.
            if (lane.targetGuard !== undefined) {
                await lane.targetGuard(mutation.teamSessionId, mutation.memberInstanceId);
            }
            const latest = await overlay.latest({
                teamSessionId: mutation.teamSessionId,
                memberInstanceId: mutation.memberInstanceId,
            });
            const currentGeneration = latest === undefined ? 0 : latest.metadata.generation;
            // 3b. The optimistic CAS (the legacy OVERRIDE_GENERATION_CONFLICT
            // discipline transposed to the overlay chain: typed conflict, the
            // durable rows untouched, no partial write possible — the append
            // below is the only write and it is never reached).
            if (mutation.expectedGeneration !== undefined && mutation.expectedGeneration !== currentGeneration) {
                throw new PermissionMutationError(PERMISSION_MUTATION_ERROR_CODES.GENERATION_CONFLICT, 'the permission overlay moved since the caller read it', {
                    problem: 'expected-generation-conflict',
                    expectedGeneration: mutation.expectedGeneration,
                    actualGeneration: currentGeneration,
                });
            }
            // 4. Plan the FULL next snapshot (pure kernel). NO direction lives here:
            // classification compares the COMPLETE latest-vs-planned rule sets by
            // EFFECTIVE effect over the closed region partition (design v2 — the
            // external P1 batch: verb/pair-key direction mislabels both ways).
            const plan = planPermissionMutation(latest, mutation);
            if (!plan.changed) {
                return { changed: false, reason: 'no-change', current: latest };
            }
            if (actor === 'leader') {
                // Authority facts bind ONCE, inside the serialized section (never
                // mid-check): the envelope document + the LOWER-LAYER FACTS.
                // `undefined` (no reader / reader abstains) = UNKNOWN;
                // `{ layers: [] }` = DECLARED-NONE (known deny fallback) — distinct.
                // PR4 round 4 (parent-binding): BOTH readers are addressed by the
                // mutation's own (team, member) — the envelope's file matchers are
                // canonical keys compared against the SAME member's rising cells, so
                // they canonicalize at that member's basis, never a row-wide
                // constant. Provider-backed readers are AWAITED (they re-validate
                // binding/cwd/provider across their own await and abstain on drift);
                // fixed-document sync readers keep working byte-identically (await
                // of a non-promise).
                const envelopeDoc = lane.permissionEnvelope === undefined
                    ? parsePermissionMutationEnvelope({ rules: [] })
                    : parsePermissionMutationEnvelope(await lane.permissionEnvelope(mutation.teamSessionId, mutation.memberInstanceId));
                const factsRaw = await lane.staticLayers?.(mutation.teamSessionId, mutation.memberInstanceId);
                const staticFacts = factsRaw === undefined ? undefined : parsePermissionStaticLayerFacts(factsRaw);
                // ROUND 5 (parent final review): the round-4 leader-facts ceiling
                // fold is REMOVED — it was a second policy gate ADR §6 does not
                // carry. The envelope document + the target's lower-layer facts
                // above are the WHOLE injected context.
                // ONE pure authorization step: effective rises inside the mutation's
                // closed regions need whole-matcher envelope coverage with the risen
                // effect ceiling (all-or-nothing, ladder-strict, ADR §6); a region
                // whose verdict depends on unknown lower facts refuses typed
                // (EFFECT_CONTEXT_UNAVAILABLE) — never a guessed deny.
                authorizeLeaderPermissionMutation({
                    latestRules: latest === undefined ? [] : latest.state.rules,
                    plannedRules: plan.rules,
                    mutationRules: mutation.rules,
                    envelope: envelopeDoc,
                    staticFacts,
                    subtreeContains: lane.subtreeContains,
                });
            }
            // A4-PR2 lane C — THE v3 AUTHORITY-CEILING GATE (spec §7.4). Placed AFTER the
            // Leader authorization above, which carries Alpha.3's context gate and the
            // rise classification: a batch that cannot be EVALUATED must refuse as
            // `EFFECT_CONTEXT_UNAVAILABLE`, and only a batch whose rises are decided may
            // be refused for insufficient authority. Inverting the two re-creates the
            // defect A3-3 closed — an unavailable read wearing an authorization label.
            //
            // The classification is recomputed here (pure, deterministic) rather than
            // threaded out of the Leader step, so the Alpha.3 path stays byte-identical
            // for v1/v2 Teams and the ceiling gate cannot observe a partially-consumed
            // classification.
            const authorityCeilingJudge = createPermissionAuthorityCeilingJudge({
                ...(lane.subtreeContains === undefined ? {} : { subtreeContains: lane.subtreeContains }),
            });
            if (lane.authorityCeiling !== undefined) {
                const ceilingContext = await lane.authorityCeiling(mutation.teamSessionId, mutation.memberInstanceId, actor);
                // `undefined` = no v3 ceiling context for this target (the reader is the
                // only place `schemaVersion === 3` is decided). NOT "the documents are
                // empty": an empty document is a decided zero-authority answer and reaches
                // the gate below as one.
                if (ceilingContext !== undefined) {
                    const ceilingFactsRaw = await lane.staticLayers?.(mutation.teamSessionId, mutation.memberInstanceId);
                    const ceilingFacts = ceilingFactsRaw === undefined ? undefined : parsePermissionStaticLayerFacts(ceilingFactsRaw);
                    const ceilingClassification = classifyPermissionRise({
                        latestRules: latest === undefined ? [] : latest.state.rules,
                        plannedRules: plan.rules,
                        mutationRules: mutation.rules,
                        // The Leader's own envelope is NOT a ceiling: it is the document the
                        // Leader owns, judged above by Alpha.3's coverage law. It is required by
                        // the input type and never read without a coverage judge.
                        envelope: parsePermissionMutationEnvelope({ rules: [] }),
                        staticFacts: ceilingFacts,
                        subtreeContains: lane.subtreeContains,
                    });
                    authorizeCeilingBoundedPermissionRise(ceilingClassification.rising, (region) => authorityCeilingJudge(ceilingContext, region));
                }
            }
            // 5. Commit ONE new FULL snapshot THROUGH the persistence-only port
            // (commit-before-ack; the derived snapshotId / chain terms are the
            // PR1 store's, never caller-supplied). A durable CAS conflict (the
            // cross-process case ADR §1 keeps out of the port) maps to the same
            // typed GENERATION_CONFLICT — the caller never sees a raw store error.
            const nextGeneration = currentGeneration + 1;
            const input = {
                identity: {
                    teamSessionId: mutation.teamSessionId,
                    memberInstanceId: mutation.memberInstanceId,
                },
                state: { rules: plan.rules },
                metadata: {
                    generation: nextGeneration,
                    previousSnapshotId: latest === undefined ? null : latest.snapshotId,
                },
                provenance: {
                    actor,
                    mutationId: mutation.mutationId,
                    timestamp: deps.now(),
                    reason: mutation.reason,
                },
            };
            let snapshot;
            try {
                snapshot = await overlay.append(input);
            }
            catch (error) {
                const code = error instanceof Error ? error.code : undefined;
                if (code === STORAGE_RECORD_DUPLICATE) {
                    throw new PermissionMutationError(PERMISSION_MUTATION_ERROR_CODES.GENERATION_CONFLICT, 'the durable overlay chain rejected the append (a concurrent writer occupied the generation)', { problem: 'durable-append-conflict', generation: nextGeneration });
                }
                throw error;
            }
            return { changed: true, snapshot };
        });
    };
    return {
        setOverride,
        resetOverride,
        switchPolicyState,
        mutatePermission,
    };
}
/**
 * THE DUAL-CEILING JUDGE (A4-PR2 lane C): for one rising region, are BOTH
 * authority ceilings at or above the risen effect? Exported because a ceiling law
 * that is only reachable through `mutatePermission` gets tested against a replica
 * of itself, and a replica passes while the real arithmetic is wrong (measured in
 * this PR's mutation proofs: reading `no-authority` as "unrestricted" in THIS
 * function went unnoticed by the first version of the suite).
 *
 * The two planes are computed SEPARATELY and never fused, never min()'d (ADR
 * X7-R5, A1-4, A3-2): the expansion ceiling answers "may this position COMMIT this
 * effect here", the approval ceiling answers "may it GRANT it", and they have
 * opposite no-match semantics on purpose — so one lookup cannot stand in for the
 * other.
 */
export function createPermissionAuthorityCeilingJudge(deps) {
    const subtreeContains = deps.subtreeContains;
    return (context, region) => {
        const scope = { operationClass: region.operationClass, matcher: region.region };
        // BOTH planes, computed SEPARATELY and never fused, never min()'d
        // (ADR X7-R5, A1-4, A3-2): the expansion ceiling answers "may this
        // position COMMIT this effect here", the approval ceiling answers "may
        // it GRANT it". They have opposite no-match semantics on purpose, so one
        // lookup cannot stand in for the other.
        let approval;
        let expansion;
        try {
            approval = grantCeiling(context.initiatorAuthority, context.documents, scope, subtreeContains);
            expansion = expansionCeiling(context.initiatorAuthority, context.documents, scope, subtreeContains);
        }
        catch (error) {
            // An unreadable ceiling document is the ONE error this gate maps: it
            // refuses as CONTEXT and carries the inner code, because treating a
            // faulted read as "no ceiling" would WIDEN authority on a storage
            // fault. Anything else is a defect and propagates untouched.
            if (error instanceof AuthorityBindingError &&
                error.code === AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE) {
                return { status: 'unavailable', code: error.code };
            }
            throw error;
        }
        // WHICH RUNG COULD APPROVE THIS RISE — lane A's evaluator, used here as a
        // REFUSAL DETAIL ONLY. It is computed after the ceilings decided, and its
        // own refusal is caught on purpose: the evaluator answers the APPROVAL
        // question, and an unanswerable one (a `human-admin` beneficiary has no
        // rung above it, so no reviewer position exists) must never change a
        // ceiling decision nor turn a typed refusal into a crash.
        const requiredAuthorityDetail = () => {
            try {
                const evaluation = evaluateAuthorityCeiling({
                    beneficiaryAuthority: context.beneficiaryAuthority,
                    initiatorAuthority: context.initiatorAuthority,
                    operationClass: region.operationClass,
                    matcher: region.region,
                    desiredEffect: region.risenEffect,
                    documents: context.documents,
                    ...(subtreeContains === undefined ? {} : { subtreeContains: subtreeContains }),
                });
                return { requiredAuthority: evaluation.requiredAuthority ?? null };
            }
            catch {
                return { requiredAuthority: null };
            }
        };
        for (const [plane, ceiling] of [
            ['expansion', expansion],
            ['approval', approval],
        ]) {
            if (ceiling.status === 'undetermined') {
                return { status: 'undetermined', plane, detail: { risenEffect: region.risenEffect } };
            }
            if (ceiling.status === 'no-authority') {
                return {
                    status: 'insufficient',
                    plane,
                    ceiling: 'no-authority',
                    detail: requiredAuthorityDetail(),
                };
            }
            if (PERMISSION_EFFECT_PRECEDENCE[ceiling.effect] <
                PERMISSION_EFFECT_PRECEDENCE[region.risenEffect]) {
                return {
                    status: 'insufficient',
                    plane,
                    ceiling: ceiling.effect,
                    detail: requiredAuthorityDetail(),
                };
            }
        }
        return { status: 'sufficient' };
    };
}
//# sourceMappingURL=service.js.map