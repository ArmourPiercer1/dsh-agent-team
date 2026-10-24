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
    readonly ownerSessionId: string;
    readonly taskId: string;
    readonly revision: null;
    readonly occurrence: {
        readonly scheduledAt: string;
        readonly occurrenceAt: string;
    };
    readonly destination: {
        readonly sessionId: string;
    };
    readonly groupSize: number;
    readonly phase: 'pre-resolve' | 'pre-followup';
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
