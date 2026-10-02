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
import { createUserMessage } from '@deepseek-ai/dsh-llm';
/**
 * The typed rejection the delivery-port adapter throws on a DROP, so the
 * notifier converts it into its typed awareness outcome (a drop is
 * "nothing was delivered", which from the ack's view is identical to a
 * best-effort liveness failure — nothing delivered, nothing woken).
 */
export class PermissionNoticeDropped extends Error {
    /** The closed drop reason recorded at the receipt gate. */
    drop;
    constructor(drop) {
        super(`permission notice dropped at the receipt gate: ${drop}`);
        this.name = 'PermissionNoticeDropped';
        this.drop = drop;
    }
}
/** Run one synchronous boolean fact; a throwing fact reads as unreadable. */
function readFact(fact) {
    try {
        return { ok: true, value: fact() === true };
    }
    catch {
        return { ok: false };
    }
}
/**
 * Build the delivery binding. `deliver(input)` is FULLY SYNCHRONOUS —
 * every gate and the one `inject` complete inside a single tick, so the
 * ruling "no await between the final check and the send" is enforced by
 * the function type itself (a synchronous function has no interleaving
 * point), not by sequencing discipline. Never throws; never touches
 * durable state; at most ONE inject per call; drops are terminal.
 */
export function createPermissionDeliveryBinding(deps) {
    return {
        deliver(input) {
            // Gate 1: closing glue (an UNREADABLE closing fact drops too —
            // conservative). No handle is even looked up when closing.
            const closing = readFact(deps.closing);
            if (!closing.ok || closing.value)
                return { delivered: false, drop: 'closing' };
            const identity = { teamSessionId: input.teamSessionId, memberInstanceId: input.memberInstanceId };
            // Gate 2: the CURRENT owned live handle for the exact pair. A cold
            // Agent stays cold — nothing here can materialize or resume it.
            let handle;
            try {
                handle = deps.liveHandle(identity);
            }
            catch {
                return { delivered: false, drop: 'not-live' };
            }
            if (handle === undefined)
                return { delivered: false, drop: 'not-live' };
            // Gate 3: identity equality with the EXACT addressed pair.
            if (handle.teamSessionId !== identity.teamSessionId ||
                handle.memberInstanceId !== identity.memberInstanceId) {
                return { delivered: false, drop: 'identity-mismatch' };
            }
            // Gate 4: the member lifecycle fact (archived/disposed never
            // receive; an UNREADABLE fact blocks — this layer never guesses).
            const lifecycle = readFact(() => deps.lifecycleActive(identity));
            if (!lifecycle.ok || !lifecycle.value) {
                return { delivered: false, drop: 'lifecycle-blocked' };
            }
            // Gate 5: the RECEIPT-TIME status read (advisory upstream mirrors do
            // not gate this; this synchronous read at the send tick is the gate).
            let status;
            try {
                status = handle.agent.status;
            }
            catch {
                return { delivered: false, drop: 'not-running' };
            }
            if (status !== 'running')
                return { delivered: false, drop: 'not-running' };
            // The one send. A fresh message per attempt (fresh id) so a parked
            // notice can never collide with a still-pending earlier one. The
            // message CARRIER is `createUserMessage` (role 'user' — the host's
            // only model-visible input carrier), but the SOURCE is the plugin's
            // OWN producer kind `plugin:dsh-agent-team` — the pinned Team v4
            // producer attribution the live glue uses too
            // (agent-bindings.mjs:4078-4081) and what the official v3→v4
            // migration maps legacy wrapper rows to. Human `kind: 'user'`
            // attribution is FORBIDDEN here: the upstream consecutive-wake
            // budget refills EXACTLY on USER-sourced claims (pristine
            // 46a7f68b09 packages/jobs/tool-jobs/src/index.ts:211-215 —
            // `if (message.source.kind === 'user') spentWakes.delete(agent)`;
            // spent at :295-305) — a plugin notice wearing human attribution
            // would trigger that Human pathway. v4 admission accepts any
            // producer-owned kind (only the retired shared `kind: 'plugin'`
            // wrapper is rejected — session-format-v3-to-v4 src/message-sources
            // .ts:8-11), MessageSourceMap is merge-extensible by design
            // (dsh-llm message.d.ts:95-107: "no shared catch-all plugin kind"),
            // and this plugin registers its kind for typed consumers via the
            // declaration merging in src/plugin/live/message-sources.d.ts.
            if (input.text.length === 0)
                return { delivered: false, drop: 'inject-fault' };
            try {
                handle.agent.inject(createUserMessage({
                    content: [{ type: 'text', text: input.text }],
                    source: { kind: 'plugin:dsh-agent-team' },
                }));
            }
            catch {
                return { delivered: false, drop: 'inject-fault' };
            }
            return { delivered: true };
        },
    };
}
/**
 * Adapt the binding into the notifier's delivery port (the shape the
 * post-commit splice wires). The adapter body performs the WHOLE gate +
 * send synchronously (no await inside) and exposes the receipt as the
 * port's resolve/reject: delivered resolves; every drop rejects with the
 * typed {@link PermissionNoticeDropped} carrying the closed reason.
 */
export function createPermissionDeliveryAdapter(binding) {
    return {
        async deliver(input) {
            const receipt = binding.deliver(input);
            if (receipt.delivered)
                return;
            throw new PermissionNoticeDropped(receipt.drop);
        },
    };
}
/**
 * Fire an awareness dispatch OFF the ack path. The mutation entry point
 * calls this and NEVER awaits the result: a slow, faulting, or
 * never-settling notice can therefore not delay, reorder, or alter an
 * already-committed ack. Rejections (synchronous or later) are swallowed
 * here — awareness failures are liveness facts, never mutation failures.
 */
export function detachPermissionNotice(notice) {
    try {
        void Promise.resolve(notice()).catch(() => undefined);
    }
    catch {
        // A synchronous throw is also an awareness-only failure: swallowed.
    }
}
//# sourceMappingURL=binding.js.map