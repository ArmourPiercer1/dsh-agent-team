/**
 * Alpha.6 PR3′ (Lane 2) — deterministic wake identity.
 *
 * `wakeId` is DERIVED, never random, and that is a functional requirement rather than a style choice:
 * after a crash the scheduler has to recognise its own outstanding ask from the slot checkpoint plus the
 * inbox facts. A random id would make the restart fold unable to tell "that message is mine, still
 * unclaimed, do not send another" from "nothing was ever sent", which is the entire content of A6-SF-08.
 * A random id would also make every test below non-reproducible, because it could only ever assert that
 * *some* id appeared instead of the exact one.
 *
 * Purity law (L-6): `node:crypto` for the digest and the shared canonical-JSON encoder, nothing else. No
 * clock, no counter, no `randomUUID`, no host module. The canonical encoder is the SAME one PR0 digests
 * plans with, so the two lane digests cannot drift in how they order keys — one definition of "the same
 * bytes" across the lane is the point of importing it instead of reinventing it.
 */
import { createHash } from 'node:crypto';
import { canonicalJsonStringify } from '../../contracts/src/index.js';
/**
 * `wake-<sha256(canonical([rootSessionId, reviewerInstanceId, sessionGeneration, wakeSequence]))>`.
 *
 * The tuple is an ARRAY, not an object: canonical JSON sorts object keys, so an object would make the
 * digest insensitive to a field-name typo in a way an array is not. Changing the recipient, the session
 * generation or the sequence changes the id; changing nothing else, it does not, which is what makes
 * re-delivery after a crash re-deliver the *same* wake.
 */
export function deriveWakeId(input) {
    const tuple = [
        input.rootSessionId,
        input.reviewerInstanceId,
        input.sessionGeneration,
        input.wakeSequence,
    ];
    return `wake-${createHash('sha256').update(canonicalJsonStringify(tuple)).digest('hex')}`;
}
/**
 * The line a reviewer would actually be shown. Built here, in one place, so the "a wake carries no
 * approval payload" law has exactly one implementation to inspect.
 *
 * It deliberately contains no case id, no request kind, no decision word and no effect scope: the
 * reviewer re-reads all of that authoritatively inside its own turn. What it may carry is a token it can
 * quote back and an instruction to go look. The notification is allowed to be lost; the Case is not.
 */
export function composeWakeText(wakeId) {
    return `[review-wake ${wakeId}] Pending review work was recorded for you. Query your review assignments and decide them from the authoritative case list. This notice is a scheduling hint: it carries no case, no decision and no authority.`;
}
export function sameWakeTurn(a, b) {
    return a.wakeId === b.wakeId && a.turn === b.turn;
}
/**
 * THE store key for a slot row: one canonical string derived from the triple, exported because the
 * atomicity of "at most one outstanding wake per triple" depends on there being exactly ONE derivation of
 * it. `WakeSlotStore.compareAndSwap` is atomic per key, so if an adapter invented its own key shape — an
 * object with keys in another order, a `${a}:${b}` join, a per-row id with a secondary index — two writers
 * could each create a first slot for one triple without ever contending, and invariant 1 would silently
 * degrade from a CAS to check-then-create. A function nobody can forget to use is worth three lines.
 *
 * Canonical ARRAY encoding of the triple, so field order is data rather than luck and a key can never
 * collide with a wake id (which hashes a 4-tuple including `wakeSequence`).
 */
export function wakeSlotRowKey(key) {
    return canonicalJsonStringify([key.rootSessionId, key.reviewerInstanceId, key.sessionGeneration]);
}
//# sourceMappingURL=identity.js.map