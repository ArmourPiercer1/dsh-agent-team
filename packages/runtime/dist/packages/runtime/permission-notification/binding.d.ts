/**
 * Alpha.3 PR5 — the DELIVERY BINDING: the receipt-time seam between the
 * awareness layer and the ONE public upstream Agent member that delivers
 * input WITHOUT waking (parent GO ruling; pristine 0.1.7-rc.1 sources):
 *
 * - `Agent.inject(message)` — "Queue model-facing context for the next
 *   pre-step WITHOUT WAKING the driver" (`@deepseek-ai/dsh-agent`
 *   runtime-types.ts:233-241); implementation `send(input, 'next-step',
 *   /* wake: *\/ false)` (`agent-loop` agent.ts:153-171) — the sole wake
 *   call (`if (wakeup) this.wakeDriver(...)`, agent.ts:159) is not
 *   reached, and no wake latches in any phase (agent.ts:213-234).
 * - `steer` / `followup` are FORBIDDEN in this layer: both pass wake=true
 *   and an idle target STARTS A TURN (runtime-types.ts:225-231). A
 *   status pre-check cannot fix that; only the non-waking member can.
 *
 * The receipt gate is a FULLY SYNCHRONOUS function: closing → owned
 * live-handle lookup (exact addressed pair; lookup never creates,
 * materializes, or resumes — those capabilities are not nameable through
 * the injected types) → identity equality → lifecycle fact →
 * `status === 'running'` → ONE `inject(...)`. No await exists anywhere
 * between the final gate and the inject, so no interleaving point exists
 * between check and send. Any failed gate DROPs the notice with a closed
 * reason; durable state and the ack path are untouched by every branch.
 *
 * Host durable-inbox semantics are the upstream's own and are used
 * AS-IS: an inject may miss an already-claimed batch or wait for an
 * unrelated future wake. This layer owns NO queue, NO pending state, and
 * NO second delivery path — drops are terminal for the notice (the
 * durable snapshot store stays the authority; the read projection is the
 * recovery path for a lost notice).
 *
 * The binding is WIRED (final splice): `src/plugin/root.ts` composes this
 * module at the governance-mutation completion point — the production
 * receipt point is the live glue's `permissionNoticeReceipt` (the closing
 * fact + the owned live-handle map read for the EXACT pair, both
 * read-only) and the lifecycle fact is the shared
 * `createMemberLifecycleReader` read — see the module README (WIRED VS
 * PENDING).
 *
 * @module @dsh-agent-team/runtime/permission-notification/binding
 */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PermissionNotificationDeliveryPort } from './types.js';
/**
 * The ONLY agent members this layer can name: the read-only status mirror
 * and the non-waking input member. A structural `Pick` over the PUBLIC
 * upstream `Agent` interface — `steer`, `followup`, `whenIdle`, `cancel`,
 * and `send` are not nameable through this type, so a wake-capable call
 * is a compile error, not a discipline.
 */
export type PermissionInjectableAgent = Pick<Agent, 'status' | 'inject'>;
/**
 * The CURRENT owned live handle for ONE exact (team, member) pair. The
 * production provider is a pure map read of the live glue's own residency
 * — no create, no materialize, no resume, no adopt (none is nameable
 * through these types). Absent means not live: a cold-but-durable Agent is
 * NOT woken for awareness.
 */
export interface PermissionLiveHandle {
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
    readonly agent: PermissionInjectableAgent;
}
/** The addressed pair plus the pre-rendered awareness text. */
export interface PermissionNoticeInput {
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
    readonly text: string;
}
/**
 * The production RECEIPT POINT the live glue exposes: the closing fact +
 * the current owned live-handle read for one exact pair. The host wires
 * the glue's surface here; this layer only ever READS it (the splice in
 * `src/plugin/root.ts` binds these two facts into
 * {@link createPermissionDeliveryBinding}).
 */
export interface PermissionNoticeReceiptSource {
    /** The live glue's closing fact. */
    readonly closing: () => boolean;
    /** The CURRENT owned live handle for the EXACT pair, else undefined. */
    readonly liveHandle: (identity: {
        readonly teamSessionId: string;
        readonly memberInstanceId: string;
    }) => PermissionLiveHandle | undefined;
}
/** The CLOSED drop vocabulary (every drop is terminal for the notice). */
export type PermissionNoticeDrop = 
/** The live glue is closing — the receipt point no longer accepts sends. */
'closing'
/** No CURRENT owned live handle for the exact pair (cold or gone). */
 | 'not-live'
/** The returned handle is not the EXACT addressed pair. */
 | 'identity-mismatch'
/** The member lifecycle fact blocks delivery (archived / disposed / unknown). */
 | 'lifecycle-blocked'
/** The receipt-time status read is not 'running' (idle, or a throwing mirror). */
 | 'not-running'
/** The text was empty, or the single inject call threw. */
 | 'inject-fault';
/** The receipt of one synchronous delivery attempt. */
export type PermissionNoticeReceipt = {
    readonly delivered: true;
} | {
    readonly delivered: false;
    readonly drop: PermissionNoticeDrop;
};
/**
 * The typed rejection the delivery-port adapter throws on a DROP, so the
 * notifier converts it into its typed awareness outcome (a drop is
 * "nothing was delivered", which from the ack's view is identical to a
 * best-effort liveness failure — nothing delivered, nothing woken).
 */
export declare class PermissionNoticeDropped extends Error {
    /** The closed drop reason recorded at the receipt gate. */
    readonly drop: PermissionNoticeDrop;
    constructor(drop: PermissionNoticeDrop);
}
/** Construction inputs of the binding — three SYNCHRONOUS read-only facts. */
export interface CreatePermissionDeliveryBindingDeps {
    /** The live glue's closing fact (entry send gate, glue precedent). */
    readonly closing: () => boolean;
    /**
     * The CURRENT owned live handle for the EXACT addressed pair, or
     * undefined. A throwing lookup is `not-live` (this layer never guesses).
     */
    readonly liveHandle: (identity: {
        readonly teamSessionId: string;
        readonly memberInstanceId: string;
    }) => PermissionLiveHandle | undefined;
    /**
     * The member lifecycle fact: true only while the member is in a
     * delivery-eligible lifecycle state. A throwing fact blocks.
     */
    readonly lifecycleActive: (identity: {
        readonly teamSessionId: string;
        readonly memberInstanceId: string;
    }) => boolean;
}
/** The binding surface: one synchronous, at-most-once delivery attempt. */
export interface PermissionDeliveryBinding {
    deliver(input: PermissionNoticeInput): PermissionNoticeReceipt;
}
/**
 * Build the delivery binding. `deliver(input)` is FULLY SYNCHRONOUS —
 * every gate and the one `inject` complete inside a single tick, so the
 * ruling "no await between the final check and the send" is enforced by
 * the function type itself (a synchronous function has no interleaving
 * point), not by sequencing discipline. Never throws; never touches
 * durable state; at most ONE inject per call; drops are terminal.
 */
export declare function createPermissionDeliveryBinding(deps: CreatePermissionDeliveryBindingDeps): PermissionDeliveryBinding;
/**
 * Adapt the binding into the notifier's delivery port (the shape the
 * post-commit splice wires). The adapter body performs the WHOLE gate +
 * send synchronously (no await inside) and exposes the receipt as the
 * port's resolve/reject: delivered resolves; every drop rejects with the
 * typed {@link PermissionNoticeDropped} carrying the closed reason.
 */
export declare function createPermissionDeliveryAdapter(binding: PermissionDeliveryBinding): PermissionNotificationDeliveryPort;
/**
 * Fire an awareness dispatch OFF the ack path. The mutation entry point
 * calls this and NEVER awaits the result: a slow, faulting, or
 * never-settling notice can therefore not delay, reorder, or alter an
 * already-committed ack. Rejections (synchronous or later) are swallowed
 * here — awareness failures are liveness facts, never mutation failures.
 */
export declare function detachPermissionNotice(notice: () => unknown): void;
//# sourceMappingURL=binding.d.ts.map