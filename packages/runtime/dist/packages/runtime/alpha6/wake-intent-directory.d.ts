import type { ReviewWakeKey } from '../review-wake/index.js';
import type { PersistedReviewWakeIntent, ReviewWakeIntentStore } from './wake-intent.js';
/** One durable Sticky Stop marker. It carries no decision/authority, only the
 * latch identity and the reviewer Session it stopped. */
export interface StoppedWakeMarker {
    readonly key: ReviewWakeKey;
    readonly targetSessionId?: string;
    /** The mount root that wrote the marker (owner guard for boot recovery). */
    readonly ownerRootSessionId?: string;
}
export interface WakeIntentDirectory {
    /** The narrow store bound to ONE latch identity. */
    forKey(key: ReviewWakeKey): ReviewWakeIntentStore;
    /** Every persisted row, in filename order (a deterministic scan). */
    list(): Promise<readonly PersistedReviewWakeIntent[]>;
    /** The file path of one latch's row (diagnostics). */
    pathFor(key: ReviewWakeKey): string;
    /**
     * The durable Sticky Stop marker for one latch. It is a small presence
     * file BESIDE the intent row (not a second approval ledger): `true` means a
     * trusted user Stop outranks any persisted wake, and only an explicit
     * resume interaction clears it. A missing marker is `false`.
     */
    /** The marker path (diagnostics / tests). */
    stoppedPathFor(key: ReviewWakeKey): string;
    isStopped(key: ReviewWakeKey): Promise<boolean>;
    readStopped(key: ReviewWakeKey): Promise<StoppedWakeMarker | null>;
    listStopped(): Promise<readonly StoppedWakeMarker[]>;
    markStopped(key: ReviewWakeKey, targetSessionId?: string, ownerRootSessionId?: string): Promise<void>;
    clearStopped(key: ReviewWakeKey): Promise<void>;
}
export declare function createFileWakeIntentDirectory(directory: string): WakeIntentDirectory;
//# sourceMappingURL=wake-intent-directory.d.ts.map