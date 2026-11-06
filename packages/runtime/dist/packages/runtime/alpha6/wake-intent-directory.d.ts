import type { ReviewWakeKey } from '../review-wake/index.js';
import type { PersistedReviewWakeIntent, ReviewWakeIntentStore } from './wake-intent.js';
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
    markStopped(key: ReviewWakeKey): Promise<void>;
    clearStopped(key: ReviewWakeKey): Promise<void>;
}
export declare function createFileWakeIntentDirectory(directory: string): WakeIntentDirectory;
//# sourceMappingURL=wake-intent-directory.d.ts.map