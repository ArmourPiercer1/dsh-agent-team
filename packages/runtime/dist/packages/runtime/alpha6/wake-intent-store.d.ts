import type { ReviewWakeIntentStore } from './wake-intent.js';
export interface FileWakeIntentStoreOptions {
    /** Absolute path of the single JSON row. */
    readonly filePath: string;
}
export declare function createFileWakeIntentStore(options: FileWakeIntentStoreOptions): ReviewWakeIntentStore;
//# sourceMappingURL=wake-intent-store.d.ts.map