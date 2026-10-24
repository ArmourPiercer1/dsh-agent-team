import type { ContextFormed } from '@deepseek-ai/dsh-llm';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'schedule': {
            kind: 'schedule';
        } & ContextFormed;
    }
}
import type { Context } from '@deepseek-ai/cordis';
import type { DeliveryRetentionBounds } from './types.ts';
import type { ScheduleTask } from './storage.ts';
/** Largest delay Node timers represent without clamping. */
export declare const MAX_TIMER_DELAY_MS = 2147483647;
/** Owns at most one timer across recomputations; delivery and management share the serialized operation. */
export interface ScheduleTriggerIntent {
    /** ONE internal flight identity per firing: the consumer keys its PA
     *  token (the SAME plane paTokenLedger) with it across BOTH phases.
     *  Minted HERE (provider-internal): callers/models cannot fake events. */
    readonly firingId: string;
    /** pre-resolve = maintenance admission (may resolve cold context to set
     *  up the PA/binding; delivers nothing); pre-followup = THE FINAL PA
     *  EDGE (the one consume, immediately before the real followup);
     *  aborted = the flight reclaim when the firing ended before the edge. */
    readonly phase: 'pre-resolve' | 'pre-followup' | 'aborted';
    readonly ownerSessionId: string;
    readonly destination: {
        readonly sessionId: string;
    };
    readonly group: {
        readonly size: number;
        /** sha256 over the FULL canonical member records of this due group
         *  (sorted by record id) — the complete governed fingerprint, never a
         *  count substitute. */
        readonly recordsFingerprint: string;
        /** REAL per-member occurrences at the phase's decision instant:
         *  recurring rows through resolveRecurringOccurrence(record, nowFor),
         *  single rows their one target instant. */
        readonly occurrences: readonly {
            readonly taskId: string;
            readonly occurrenceAt: string;
        }[];
    };
}
export type ScheduleTriggerAdmission = (intent: ScheduleTriggerIntent) => boolean | Promise<boolean>;
export declare class ScheduleRuntime {
    private readonly ctx;
    private readonly tasks;
    private readonly transact;
    private readonly commit;
    private readonly retention;
    private readonly admitTrigger;
    private timer;
    private running;
    private stopping;
    private requested;
    /**
     * @param ctx - Host services used to resume and enqueue.
     * @param tasks - Current durable tasks.
     * @param transact - Serialize delivery against management writes.
     * @param commit - Persist task status, target, receipt, and history together after durable inbox delivery.
     */
    constructor(ctx: Context, tasks: () => readonly ScheduleTask[], transact: (work: () => Promise<void>) => Promise<void>, commit: (task: ScheduleTask) => Promise<void>, retention: DeliveryRetentionBounds, admitTrigger?: () => ScheduleTriggerAdmission | undefined);
    private readonly forkDeferredUntil;
    private static readonly FORK_REJECT_BACKOFF_MS;
    /**
     * Recompute the nearest obligation after startup or a durable change.
     * Dispatch failures are logged; refused admission does not retry automatically.
     */
    requestDrive(): void;
    /** Stop the timer and drain an accepted delivery before storage closes. */
    dispose(): Promise<void>;
    private clearTimer;
    private drive;
}
