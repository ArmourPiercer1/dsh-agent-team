/**
 * The fresh-root binding path (P5-T5; DevPlan §18.1 "bind fresh Root",
 * productized from the P2-T2 ROOT_COLD_BINDING characterization).
 *
 * {@link bindFreshTeamRoot} makes one root DSH session the root of a
 * Team. The orchestration (every step fail-closed; the binder is never
 * run unless the durable state is consistent):
 *
 * 1. Input validation — `generation` defaults to 1 and must be a
 *    positive integer (`ROOT_BINDING_INVALID_INPUT`, no effect).
 * 2. Session-kind resolution (READ ONLY, before any effect) — the
 *    session must carry no binding (first create) or a `team-root`
 *    binding (idempotent re-run); any other kind is
 *    `ROOT_BINDING_SESSION_KIND_CONFLICT` (invariants 8/23/24).
 * 3. TeamSession record — absent: durably put the generation-1 record
 *    (crash-safe ORDERING: the record is committed BEFORE the binding,
 *    so a crash between the two writes leaves a binding-less record that
 *    a re-run completes; a binding WITHOUT a record is an integrity
 *    violation, `ROOT_BINDING_TEAM_SESSION_CONFLICT`). Present: it must
 *    match the request's immutable identity (blueprint, invariant 10)
 *    and generation exactly — otherwise `ROOT_BINDING_TEAM_SESSION_CONFLICT`
 *    (the fresh create is a generation-1 path, never an update).
 * 4. `team-root` session binding — durably put when absent (step 2
 *    guarantees kind consistency; the repository re-validates the DTO
 *    and enforces key uniqueness).
 * 5. LeaderInstance mint (P8-S2, Architecture §9.2 / invariants 14/15) —
 *    the durable leader row (the honest v2 shape: no childSessionId, no
 *    lifecycle keys) is put only when absent (an idempotent re-run
 *    never writes); it requires the injected blueprint catalog — an
 *    absent catalog or an unresolvable bound blueprint is
 *    `ROOT_BINDING_LEADER_MINT_FAILED` (the mint is never defaulted).
 * 6. The binder's fresh-root path (P5-T1) — all three overlay slots
 *    installed in `OVERLAY_SLOT_ORDER` + the admission decision, on the
 *    injected `TeamAgentSetupSurface`. Any binder failure (missing
 *    record, overlay fault, …) propagates: the durable state of steps
 *    3–5 is kept BY DESIGN (DevPlan §18.5: durable commit + lost
 *    ephemeral residency is exactly the state the COLD path recovers).
 *
 * Idempotency: a re-run on a world where the session is already bound
 * (records consistent, residency live) performs ZERO durable writes and
 * returns the binder's `already-bound` no-op; a re-run after the
 * ephemeral residency was lost (process restart) re-runs the fresh
 * install on the SAME durable records (`wrote: false`) — the cold path
 * (`./cold-root.js`) is the restart-oriented alternative that restores
 * without fresh-time side effects.
 *
 * @module @dsh-agent-team/runtime/root-binding/fresh-root
 */
import { TeamAgentBinder } from '../agent-setup/binder/index.js';
import { LEADER_INSTANCE_ID, } from '../../contracts/src/index.js';
import { ACTIVATION_ERROR_CODES, isActivationError, resolveBoundBlueprint, } from '../activation/index.js';
import { ROOT_BINDING_ERROR_CODES, RootBindingError, } from './errors.js';
/** The default `createdAt` clock (system UTC ISO-8601). */
function defaultNow() {
    return new Date().toISOString();
}
/**
 * Immutable-identity equality of two Blueprint snapshot refs
 * (invariant 10: blueprintId + revision + contentHash pin the snapshot).
 * @param a - the first ref.
 * @param b - the second ref.
 * @returns `true` iff both refs pin the identical snapshot.
 */
function sameBlueprintRef(a, b) {
    return (String(a.blueprintId) === String(b.blueprintId) &&
        String(a.revision) === String(b.revision) &&
        String(a.contentHash) === String(b.contentHash));
}
/**
 * Bind a FRESH Team root: make `input.rootSessionId` the root of a Team
 * (see the module docs for the full orchestration).
 *
 * @param ports - the injected handles (read handle, write port, surface,
 *   optional slot/guard/clock overrides).
 * @param input - the fresh-create request (branded root session id,
 *   immutable blueprint snapshot ref, optional workspace/generation).
 * @returns the result: the durable state (written or pre-existing) plus
 *   the binder's fresh-root bind result (admission decision included).
 * @throws {@link RootBindingError} (`ROOT_BINDING_INVALID_INPUT`,
 *   `ROOT_BINDING_SESSION_KIND_CONFLICT`, `ROOT_BINDING_TEAM_SESSION_CONFLICT`)
 *   before any effect; `ROOT_BINDING_LEADER_MINT_FAILED` after the
 *   record + binding commits (the mint is never defaulted); a
 *   repository/seam write error or a binder error
 *   after the durable commit (fail-closed; see module docs).
 */
export async function bindFreshTeamRoot(ports, input) {
    const sessionId = String(input.rootSessionId);
    const generation = input.generation ?? 1;
    // Step 1 — input validation (fail-closed, no effect).
    if (!Number.isInteger(generation) || generation < 1) {
        throw new RootBindingError(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_INVALID_INPUT, `fresh root binding of session '${sessionId}' requires a positive integer generation (got ${String(generation)})`, { sessionId, generation });
    }
    // Step 2 — session-kind resolution (read-only, before any effect).
    const binding = ports.teamDomain.getSessionBinding(sessionId);
    if (binding !== undefined && binding.kind !== 'team-root') {
        throw new RootBindingError(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_SESSION_KIND_CONFLICT, `session '${sessionId}' is bound as '${binding.kind}'; a fresh team-root binding requires no binding or a 'team-root' binding`, { sessionId, foundKind: binding.kind });
    }
    // Step 3 — the TeamSession record: write it or verify the existing one.
    const existing = ports.teamDomain.getTeamSession(sessionId);
    let teamSession;
    let wrote = false;
    if (existing === undefined) {
        if (binding !== undefined) {
            // A 'team-root' binding without its record: the write ordering of
            // this module (record BEFORE binding) makes this state impossible
            // from a crash — it is an integrity violation (invariant 41).
            throw new RootBindingError(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_TEAM_SESSION_CONFLICT, `session '${sessionId}' carries a 'team-root' binding but its TeamSession record is absent (TeamDomain integrity violation)`, { sessionId });
        }
        const recordInput = {
            rootSessionId: input.rootSessionId,
            blueprint: input.blueprint,
            createdAt: (ports.now ?? defaultNow)(),
            generation,
        };
        if (input.defaultWorkspace !== undefined) {
            recordInput.defaultWorkspace = input.defaultWorkspace;
        }
        teamSession = await ports.writes.putTeamSession(recordInput);
        wrote = true;
    }
    else {
        // Idempotent re-run: the existing record must match the request's
        // immutable identity (invariant 10) and generation exactly.
        if (!sameBlueprintRef(existing.blueprint, input.blueprint) || existing.generation !== generation) {
            throw new RootBindingError(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_TEAM_SESSION_CONFLICT, `session '${sessionId}' already carries a TeamSession record (blueprint '${String(existing.blueprint.blueprintId)}' revision '${String(existing.blueprint.revision)}', generation ${existing.generation}); the fresh-create path cannot re-bind it with a different immutable identity or generation`, {
                sessionId,
                existingBlueprintId: String(existing.blueprint.blueprintId),
                existingGeneration: existing.generation,
                requestedGeneration: generation,
            });
        }
        teamSession = existing;
    }
    // Step 4 — the 'team-root' session binding row (record committed first).
    let bindingRow;
    if (binding === undefined) {
        bindingRow = await ports.writes.putSessionBinding({
            kind: 'team-root',
            schemaVersion: 1,
            sessionId: input.rootSessionId,
        });
        wrote = true;
    }
    else {
        bindingRow = binding;
    }
    // Step 5 — the durable LeaderInstance mint (P8-S2, Architecture §9.2,
    // invariants 14/15): a fresh root yields the Leader's honest v2 record
    // (no childSessionId, no lifecycle keys — the Leader IS the Root Agent
    // + the Root Session). Idempotent: the mint runs only when the row is
    // absent, so an idempotent re-run performs ZERO durable writes.
    // Crash-safe ordering: after the record + binding, so a crash before
    // the mint leaves a root a re-run completes; the C3 caller resolution
    // needs no row at all (the durable Root/Team identity is authoritative).
    const existingLeaderRow = ports.teamDomain.getMemberInstance(sessionId, LEADER_INSTANCE_ID);
    let leaderRow;
    if (existingLeaderRow !== undefined) {
        leaderRow = existingLeaderRow;
    }
    else {
        const catalog = ports.blueprintCatalog;
        if (catalog === undefined) {
            throw new RootBindingError(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_LEADER_MINT_FAILED, `fresh root binding of session '${sessionId}' cannot mint the LeaderInstance record: the blueprint catalog is absent (the mint is never defaulted)`, { sessionId, instanceId: LEADER_INSTANCE_ID, cause: 'catalog-absent' });
        }
        let blueprint;
        try {
            blueprint = resolveBoundBlueprint(catalog, teamSession).blueprint;
        }
        catch (error) {
            if (isActivationError(error) &&
                (error.code === ACTIVATION_ERROR_CODES.BLUEPRINT_UNRESOLVED ||
                    error.code === ACTIVATION_ERROR_CODES.BLUEPRINT_HASH_MISMATCH)) {
                throw new RootBindingError(ROOT_BINDING_ERROR_CODES.ROOT_BINDING_LEADER_MINT_FAILED, `fresh root binding of session '${sessionId}' cannot mint the LeaderInstance record: the bound blueprint is unusable (${error.code})`, { sessionId, instanceId: LEADER_INSTANCE_ID, cause: error.code });
            }
            throw error;
        }
        const leaderInput = {
            rootSessionId: input.rootSessionId,
            instanceId: LEADER_INSTANCE_ID,
            templateId: blueprint.leader.templateId,
            label: blueprint.leader.displayName ?? String(blueprint.leader.templateId),
            createdAt: (ports.now ?? defaultNow)(),
            activityVersion: 1,
        };
        leaderRow = await ports.writes.putMemberInstance(leaderInput);
        wrote = true;
    }
    // Step 6 — the binder's fresh-root path (the agent-setup step): the
    // durable state above is now authoritative (invariant 41); any binder
    // failure propagates fail-closed and the durable commit stands
    // (DevPlan §18.5: the cold path is the recovery for that crash window).
    const binder = new TeamAgentBinder({
        surface: ports.surface,
        teamDomain: ports.teamDomain,
        ...(ports.slots !== undefined ? { slots: ports.slots } : {}),
        ...(ports.admissionGuard !== undefined ? { admissionGuard: ports.admissionGuard } : {}),
    });
    const bind = binder.bindFreshRoot(sessionId);
    const durable = {
        teamSession,
        binding: bindingRow,
        wrote,
        ...(leaderRow !== undefined ? { leaderRow } : {}),
    };
    return { path: 'fresh-root', durable, bind };
}
//# sourceMappingURL=fresh-root.js.map