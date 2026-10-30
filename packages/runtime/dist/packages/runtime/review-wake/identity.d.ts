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
import type { WakeSlotKey } from './types.js';
/** The tuple a wake identity is a function of. Order is part of the contract. */
export interface WakeIdentityInput extends WakeSlotKey {
    /** Monotone within the slot, starting at 1. Not a timestamp, not a random value. */
    readonly wakeSequence: number;
}
/**
 * `wake-<sha256(canonical([rootSessionId, reviewerInstanceId, sessionGeneration, wakeSequence]))>`.
 *
 * The tuple is an ARRAY, not an object: canonical JSON sorts object keys, so an object would make the
 * digest insensitive to a field-name typo in a way an array is not. Changing the recipient, the session
 * generation or the sequence changes the id; changing nothing else, it does not, which is what makes
 * re-delivery after a crash re-deliver the *same* wake.
 */
export declare function deriveWakeId(input: WakeIdentityInput): string;
/**
 * The line a reviewer would actually be shown. Built here, in one place, so the "a wake carries no
 * approval payload" law has exactly one implementation to inspect.
 *
 * It deliberately contains no case id, no request kind, no decision word and no effect scope: the
 * reviewer re-reads all of that authoritatively inside its own turn. What it may carry is a token it can
 * quote back and an instruction to go look. The notification is allowed to be lost; the Case is not.
 */
export declare function composeWakeText(wakeId: string): string;
/**
 * The correlation record the adapter binds a host turn to. A `turn/end` is only a completion fact for the
 * wake that produced the turn it names (L-4), so the pair — not either half — is what identifies a run.
 */
export interface WakeTurnCorrelation {
    readonly wakeId: string;
    readonly turn: number;
}
export declare function sameWakeTurn(a: WakeTurnCorrelation, b: WakeTurnCorrelation): boolean;
//# sourceMappingURL=identity.d.ts.map