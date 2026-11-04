import type { ReviewWakeKey } from '../review-wake/index.js';
import type { PersistedReviewWakeIntent, ReviewWakeIntentStore } from './wake-intent.js';
export interface WakeIntentDirectory {
    /** The narrow store bound to ONE latch identity. */
    forKey(key: ReviewWakeKey): ReviewWakeIntentStore;
    /** Every persisted row, in filename order (a deterministic scan). */
    list(): Promise<readonly PersistedReviewWakeIntent[]>;
    /** The file path of one latch's row (diagnostics). */
    pathFor(key: ReviewWakeKey): string;
}
export declare function createFileWakeIntentDirectory(directory: string): WakeIntentDirectory;
//# sourceMappingURL=wake-intent-directory.d.ts.map