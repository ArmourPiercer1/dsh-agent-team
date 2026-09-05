/**
 * TCM-M3 (Team Create Minimal Fix plan §15.7 / §15.8) — the creation-time
 * Root initial-work strategy: the narrow Root-only vertical that admits and
 * delivers the ONE creation-time initial work of one team into the Root
 * (leader) session, without the Member machinery.
 *
 * WHAT THIS MODULE IS:
 *
 * The v2 `team.admitInitialWork` command (and the v1 compatibility path,
 * which G1 re-wires onto the SAME entry point) must not run through
 * `TeamRuntime.performAction(follow-up, target=inst-leader)`: that chain
 * is a Member work unit — it needs a durable Leader member record, a
 * `childSessionId`, the activity interval, and the
 * `member-lifecycle-changed` settlement (plan §2.3 / §15.8: none of those
 * may appear here). This module is the narrow alternative:
 *
 *   withTeamLock (the caller's shared coordination.chains) ->
 *   enforceCompatibilityGate (the existing single compatibility
 *   authority — the gate runs BEFORE any scan decision, exactly like the
 *   router's new-work admission) ->
 *   executeRootInitialWorkLocked (the two-fact scanner + strategy).
 *
 * DURABLE REPRESENTATION (plan §15.7; NO new schema, NO new ledger
 * category — both fact types map to the existing `team` category):
 *
 *   `team-work-admitted` (the EXISTING fact type; the Root entries are
 *     distinguished by the payload):
 *       { targetKind: 'root', rootSessionId, requestToken,
 *         payloadFingerprint, prompt, attachedContext?, caller, at }
 *   `team-root-work-delivered` (the ONE new fact type; the terminal
 *     SUCCESS record — a delivery failure writes nothing):
 *       { targetKind: 'root', rootSessionId, requestToken,
 *         payloadFingerprint, workOutcome: 'delivered', at }
 *
 * NEITHER payload carries a member addressing key (no `instanceId`, no
 * `targetInstanceId`, no `childSessionId`): the projection/disposed-history
 * attribution (the closed addressing-key table in
 * `src/plugin/projection-source.ts`) therefore never attributes a Root
 * fact to a regular member, and the honest Leader (a Leader row that never
 * got a durable member record) is unaffected — this strategy reads and
 * writes NO member record, runs NO lifecycle transition, and opens NO
 * activity interval.
 *
 * SCANNER (plan §15.6 / §2.4) — over the team's ledger facts filtered to
 * `targetKind === 'root'` and the two fact types above:
 *
 *   same token + terminal `team-root-work-delivered` + same
 *   payloadFingerprint -> TERMINAL REPLAY: zero delivery, zero writes
 *   (the call reports `mode: 'replay'`);
 *   same token + different payloadFingerprint (on the admitted AND/OR the
 *   terminal fact) -> ROOT_WORK_PAYLOAD_MISMATCH (typed; zero writes);
 *   ANY other token's root fact (admitted or delivered) ->
 *   INITIAL_WORK_ALREADY_ADMITTED (typed; zero writes): at most ONE
 *   initial-work slot per creation — the slot is occupied by a non-terminal
 *   admitted fact as well, so a user new operation under a fresh token is
 *   never mistaken for a network replay;
 *   same token + admitted (no terminal) + same payloadFingerprint ->
 *   ADMITTED-ONLY RETRY: delivery is attempted again, NO second admission
 *   fact (the crash window between the admission commit and the terminal
 *   commit recovers exactly from the durable admission);
 *   nothing for the token -> FRESH: the admission fact is committed FIRST
 *   (via the shared `commitDurableFact`), then delivery, then the terminal
 *   fact. A delivery fault propagates as WORK_DELIVERY_FAILED with the
 *   admission fact retained and NO terminal fact — the same-token retry
 *   then recovers (plan §15.7: the ambiguous crash window is explicitly
 *   NOT claimed exactly-once; the model-visible text carries the
 *   requestToken so the model can dedupe).
 *
 * The ORDINARY member scanner (`scanWorkUnitFacts` in
 * `work-execution.ts`) skips every `targetKind === 'root'` fact: a root
 * initial-work fact sharing a token with a member work request must never
 * be resumed (or settled) by a member chain (token-collision guard).
 *
 * LOCKING: `executeRootInitialWorkLocked` takes NO lock of its own — the
 * production wiring (the `createAdmitRootInitialWork` closure below) runs
 * it inside the SAME per-team promise chain the router / activity /
 * lifecycle modules share (`coordination.chains`), so the scan->admit->
 * deliver->terminal sequence is serialized per team and cannot interleave
 * with a racing admission (P8-S5B CR-8 shape). The closure also keeps the
 * compatibility gate INSIDE the lock (the gate may re-probe inline — a
 * durable compatibility write — and a racing new-work admission for the
 * same team must not interleave into its read->probe->re-read window).
 *
 * I/O only through the injected TeamDomain repositories (invariant 41)
 * and the injected delivery port; no member lifecycle, no activity, no
 * node: builtins, no upstream imports.
 *
 * @module @dsh-agent-team/runtime/action-router/root-initial-work
 */
import { canonicalJsonStringify } from '../../contracts/src/index.js';
import { sha256Hex } from '../../domain/blueprint/src/index.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js';
import { enforceCompatibilityGate } from '../admission/gate.js';
import { commitDurableFact, withTeamLock } from './effects.js';
/** The payload discriminator of a Root initial-work fact (the scanner's filter). */
export const ROOT_TARGET_KIND = 'root';
/** The EXISTING admission fact type (the Root entries carry `targetKind: 'root'`). */
export const FACT_WORK_ADMITTED = 'team-work-admitted';
/** The ONE new fact type: the terminal SUCCESS record of one Root initial work. */
export const FACT_ROOT_WORK_DELIVERED = 'team-root-work-delivered';
/** The one-line caller ref (the evidence shape of the work chain; the
 *  key is OMITTED for the honest Leader — no member row — because the
 *  ledger entries are validated as lossless JSON, where `undefined`
 *  leaves are not remote-safe). */
function callerRef(caller) {
    if (caller.role === 'human') {
        return { kind: 'human', humanId: caller.humanId };
    }
    const instanceId = caller.callerMember?.instanceId;
    return {
        kind: 'instance',
        ...(instanceId !== undefined ? { instanceId } : {}),
        role: caller.role,
    };
}
/** A fault description for `details.cause` (no invented structure). */
function describeFailure(failure) {
    if (failure instanceof Error)
        return failure.message;
    return typeof failure === 'string' && failure.length > 0 ? failure : 'unknown failure';
}
/**
 * The durable payload fingerprint of one Root initial work: the SHA-256 of
 * the canonical JSON of the model-visible content (`prompt` plus the
 * `attachedContext` when present and non-empty — the exact content the
 * delivery port turns into text). An empty `attachedContext` is equivalent
 * to an absent one (the delivery port applies the same rule).
 */
export function computeRootWorkPayloadFingerprint(prompt, attachedContext) {
    const record = { prompt };
    if (attachedContext !== undefined && attachedContext !== '') {
        record['attachedContext'] = attachedContext;
    }
    return `sha256:${sha256Hex(canonicalJsonStringify(record))}`;
}
/** True for one Root initial-work fact (the two fact types + the discriminator). */
function isRootWorkFact(entry) {
    if (entry.factType !== FACT_WORK_ADMITTED && entry.factType !== FACT_ROOT_WORK_DELIVERED) {
        return false;
    }
    return entry.payload['targetKind'] === ROOT_TARGET_KIND;
}
/** The payload's `requestToken` as a string (undefined when malformed). */
function factToken(payload) {
    const value = payload['requestToken'];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
/**
 * Scan the team's durable ledger for the Root initial-work state of one
 * requested token (plan §15.6 decision table). Reads ONLY
 * `targetKind === 'root'` facts of the two Root fact types for this team —
 * member work facts (no `targetKind`) and other teams' facts are ignored,
 * and the ordinary member scanner (`scanWorkUnitFacts`) mirrors this
 * filter by skipping every `targetKind === 'root'` fact (no token
 * collision between the two worlds).
 */
export function scanRootInitialWorkFacts(repositories, rootSessionId, requestToken) {
    let admitted;
    let terminal;
    const foreign = [];
    for (const entry of repositories.ledger.list()) {
        if (entry.rootSessionId !== rootSessionId)
            continue;
        if (!isRootWorkFact(entry))
            continue;
        const token = factToken(entry.payload);
        if (token === undefined)
            continue; // a malformed root fact: never a decision input
        if (token !== requestToken) {
            foreign.push({ sequence: entry.sequence, payload: entry.payload });
            continue;
        }
        const ref = { sequence: entry.sequence, payload: entry.payload };
        if (entry.factType === FACT_ROOT_WORK_DELIVERED) {
            if (terminal === undefined || entry.sequence < terminal.sequence)
                terminal = ref;
        }
        else {
            if (admitted === undefined || entry.sequence < admitted.sequence)
                admitted = ref;
        }
    }
    return {
        ...(admitted !== undefined ? { admitted } : {}),
        ...(terminal !== undefined ? { terminal } : {}),
        foreign,
    };
}
/** Validate the request shape (closed codes; zero writes). */
function validateDeps(deps) {
    if (typeof deps.requestToken !== 'string' || deps.requestToken.length === 0) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED, 'TeamRuntime: root initial work requires a non-empty requestToken', { rootSessionId: deps.rootSessionId });
    }
    if (typeof deps.prompt !== 'string' || deps.prompt.length === 0) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED, 'TeamRuntime: root initial work requires a non-empty prompt', { rootSessionId: deps.rootSessionId, requestToken: deps.requestToken });
    }
}
/**
 * The same-token/different-payload rejection (plan §15.6: "same token +
 * different payload → typed mismatch"). Zero durable writes.
 */
function mismatchError(deps, storedFingerprint, requestedFingerprint, storedSequence) {
    return new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.ROOT_WORK_PAYLOAD_MISMATCH, `TeamRuntime: requestToken '${deps.requestToken}' already carries a Root initial work with a different payload fingerprint (stored sequence ${storedSequence}) — the same token must mean the same work; refusing to change the admitted work`, {
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        storedFingerprint: typeof storedFingerprint === 'string' ? storedFingerprint : undefined,
        requestedFingerprint,
        storedSequence,
    });
}
/**
 * The at-most-one-slot rejection (plan §15.6: "another token's initial
 * work exists → typed INITIAL_WORK_ALREADY_ADMITTED"). Zero durable
 * writes.
 */
function alreadyAdmittedError(deps, occupant) {
    const occupantToken = factToken(occupant.payload) ?? '(malformed)';
    return new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.INITIAL_WORK_ALREADY_ADMITTED, `TeamRuntime: team '${deps.rootSessionId}' already carries a creation-time Root initial work under a different requestToken ('${occupantToken}', durable sequence ${occupant.sequence}) — at most one initial work per creation; a fresh operation must use its own token only before any admission, a retry must reuse the admitted token`, {
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        existingToken: occupantToken,
        existingSequence: occupant.sequence,
    });
}
/**
 * Deliver the Root initial work (the at-least-once model-visible submit).
 * A fault propagates as WORK_DELIVERY_FAILED (the closed delivery code,
 * reused from the member work chain): the durable admission stays, NO
 * terminal fact is written, and the same-token retry recovers from the
 * admission fact (plan §15.7).
 */
async function deliverLocked(deps) {
    try {
        await deps.deliverRootWork.deliverRootWork({
            rootSessionId: deps.rootSessionId,
            requestToken: deps.requestToken,
            prompt: deps.prompt,
            ...(deps.attachedContext !== undefined ? { attachedContext: deps.attachedContext } : {}),
        });
    }
    catch (error) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED, `TeamRuntime: Root initial work delivery to team '${deps.rootSessionId}' failed: ${describeFailure(error)} (the durable admission is retained; retry with the SAME requestToken)`, {
            rootSessionId: deps.rootSessionId,
            requestToken: deps.requestToken,
            cause: describeFailure(error),
        });
    }
}
/** The admission fact payload (plan §15.7; lossless JSON, no undefined leaves). */
function admissionFactPayload(deps, fingerprint) {
    return {
        targetKind: ROOT_TARGET_KIND,
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        payloadFingerprint: fingerprint,
        prompt: deps.prompt,
        ...(deps.attachedContext !== undefined && deps.attachedContext !== ''
            ? { attachedContext: deps.attachedContext }
            : {}),
        caller: callerRef(deps.caller),
        at: deps.now(),
    };
}
/** The terminal fact payload (plan §15.7; the terminal SUCCESS record). */
function terminalFactPayload(deps, fingerprint) {
    return {
        targetKind: ROOT_TARGET_KIND,
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        payloadFingerprint: fingerprint,
        workOutcome: 'delivered',
        at: deps.now(),
    };
}
/**
 * Execute the Root initial-work strategy for one team (the plan §15.8
 * "locked executor"). The caller MUST already hold the team's
 * coordination chain AND have enforced the compatibility gate (the
 * `createAdmitRootInitialWork` closure does both) — this function takes
 * no lock of its own (chains are not re-entrant).
 *
 * Durable order (STATE/EVIDENCE — plan §15.7): the admission fact FIRST
 * (the operation identity + intent), then the model-visible delivery,
 * then the terminal fact. A delivery fault leaves the admission durable
 * and the terminal absent (the same-token retry recovers); a terminal
 * fault leaves an admitted-but-undelivered unit the same retry recovers.
 *
 * @throws {@link TeamRuntimeError} REQUEST_MALFORMED (input shape),
 *   ROOT_WORK_PAYLOAD_MISMATCH (same token, different payload),
 *   INITIAL_WORK_ALREADY_ADMITTED (another token's slot),
 *   WORK_DELIVERY_FAILED (the delivery fault, admission retained).
 */
export async function executeRootInitialWorkLocked(deps) {
    validateDeps(deps);
    const fingerprint = computeRootWorkPayloadFingerprint(deps.prompt, deps.attachedContext);
    const scan = scanRootInitialWorkFacts(deps.repositories, deps.rootSessionId, deps.requestToken);
    // 1. TERMINAL SUCCESS for the same token (plan §15.6): replay — zero
    //    delivery, zero writes. A different fingerprint is the typed
    //    mismatch (the same token must mean the same work).
    if (scan.terminal !== undefined) {
        if (scan.terminal.payload['payloadFingerprint'] !== fingerprint) {
            throw mismatchError(deps, scan.terminal.payload['payloadFingerprint'], fingerprint, scan.terminal.sequence);
        }
        return {
            mode: 'replay',
            rootSessionId: deps.rootSessionId,
            requestToken: deps.requestToken,
            payloadFingerprint: fingerprint,
            // The original admission sequence (absent is structurally
            // unreachable — the terminal is only ever committed after the
            // admission; the terminal sequence stands in as the honest
            // fallback rather than a fabricated number).
            sequence: scan.admitted?.sequence ?? scan.terminal.sequence,
            terminalSequence: scan.terminal.sequence,
            delivered: false,
        };
    }
    // 2. The team's ONE initial-work slot is occupied by ANOTHER token
    //    (an admitted or a durably delivered root fact): typed rejection,
    //    zero writes. A fresh token is a new operation, never a replay.
    if (scan.foreign.length > 0) {
        // The earliest occupant (durable order: the first fact that took the slot).
        let occupant = scan.foreign[0];
        for (const fact of scan.foreign) {
            if (fact.sequence < occupant.sequence)
                occupant = fact;
        }
        throw alreadyAdmittedError(deps, occupant);
    }
    // 3. ADMITTED (same token, no terminal): the crash window between the
    //    admission commit and the terminal commit — ADMITTED-ONLY RETRY:
    //    delivery is re-driven, NO second admission fact.
    if (scan.admitted !== undefined) {
        if (scan.admitted.payload['payloadFingerprint'] !== fingerprint) {
            throw mismatchError(deps, scan.admitted.payload['payloadFingerprint'], fingerprint, scan.admitted.sequence);
        }
        const sequence = scan.admitted.sequence;
        await deliverLocked(deps);
        const terminalSequence = await commitDurableFact(deps.repositories, deps.rootSessionId, deps.now, FACT_ROOT_WORK_DELIVERED, terminalFactPayload(deps, fingerprint));
        return {
            mode: 'retry',
            rootSessionId: deps.rootSessionId,
            requestToken: deps.requestToken,
            payloadFingerprint: fingerprint,
            sequence,
            terminalSequence,
            delivered: true,
        };
    }
    // 4. FRESH: no root facts for the token — the full chain: the
    //    admission fact FIRST, then delivery, then the terminal fact.
    const sequence = await commitDurableFact(deps.repositories, deps.rootSessionId, deps.now, FACT_WORK_ADMITTED, admissionFactPayload(deps, fingerprint));
    await deliverLocked(deps);
    const terminalSequence = await commitDurableFact(deps.repositories, deps.rootSessionId, deps.now, FACT_ROOT_WORK_DELIVERED, terminalFactPayload(deps, fingerprint));
    return {
        mode: 'fresh',
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        payloadFingerprint: fingerprint,
        sequence,
        terminalSequence,
        delivered: true,
    };
}
/**
 * Build the production `admitRootInitialWork` closure (plan §15.8):
 *
 *   withTeamLock (the shared coordination.chains) ->
 *   enforceCompatibilityGate (the existing single compatibility
 *   authority, INSIDE the lock: the gate may re-probe inline and a
 *   racing new-work admission for the same team must not interleave) ->
 *   executeRootInitialWorkLocked.
 *
 * This is NOT a second TeamRuntime facade: the S6 remote handler calls
 * this closure directly (no `performAction`, no Member lifecycle /
 * activity, no second public entry point).
 */
export function createAdmitRootInitialWork(input) {
    return (args) => withTeamLock(input.teamLocks, args.rootSessionId, async () => {
        const environmentFacts = await input.environmentFacts();
        await enforceCompatibilityGate(input.repositories, args.blueprint, args.rootSessionId, environmentFacts, input.now);
        return executeRootInitialWorkLocked({
            repositories: input.repositories,
            now: input.now,
            rootSessionId: args.rootSessionId,
            caller: args.caller,
            requestToken: args.requestToken,
            prompt: args.prompt,
            ...(args.attachedContext !== undefined ? { attachedContext: args.attachedContext } : {}),
            deliverRootWork: input.deliverRootWork,
        });
    });
}
//# sourceMappingURL=root-initial-work.js.map