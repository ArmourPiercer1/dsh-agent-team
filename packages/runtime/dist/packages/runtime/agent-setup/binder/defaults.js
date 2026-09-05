/**
 * The T1 identity (no-op) defaults of the binder skeleton (TaskDoc §11.5
 * P5-T1; ruling R28: "T1 只定义槽位契约 + 恒等默认实现，实现由 T2/T3/T4
 * 填入（你可以为它们留接口，不得实现其业务逻辑）").
 *
 * Two defaults ship here:
 *
 * 1. The identity overlay slots — one per slot name, `apply` performs no
 *    public Agent setup effect at all. They exist so the P5-T1 skeleton is
 *    fully orchestratable (the four bind paths run end-to-end) BEFORE the
 *    T2 (persona) / T3 (model) / T4 (capability) slot implementations
 *    land. A slot implementation is injected by replacing the single slot
 *    key in {@link TeamAgentBinderOptions.slots}; the other two keep their
 *    identity defaults until their owning task fills them.
 *
 * 2. The default admission guard — admits with the closed code
 *    `ADMISSION_OPEN`. Rationale: the durable admission state is not yet a
 *    contracts v1 DTO field (it lands with a later task under the
 *    contracts CHANGELOG freeze rule), so the T1 skeleton has no admission
 *    policy to evaluate; T5 supplies the real guard. The FAIL-CLOSED
 *    property of the admission decision point does NOT depend on this
 *    default: a guard that throws is treated as a rejection with
 *    `ADMISSION_GUARD_ERROR` (a guard fault never admits), and every
 *    rejection is surfaced through the result's `admitted: false` +
 *    `admissionCode` channel (see the `AdmissionGuard` docs in ./types.js).
 *
 * No business logic lives in this module: the identity slots do nothing,
 * and the default guard decides nothing from any state.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/binder/defaults
 */
/** The closed admission code for a positive (admitting) decision. */
export const ADMISSION_OPEN_CODE = 'ADMISSION_OPEN';
/** The binder-level closed code for a guard that faulted (fail-closed). */
export const ADMISSION_GUARD_ERROR_CODE = 'ADMISSION_GUARD_ERROR';
/**
 * One identity (no-op) overlay slot (the T1 default implementation).
 * @param name - the slot this default fills (must match its options key).
 */
export function identityOverlaySlot(name) {
    return {
        name,
        apply() {
            // T1 identity default: NO public Agent setup effect. The business
            // logic lands in the owning task (T2 persona / T3 model /
            // T4 capability); this default only keeps the orchestration order
            // and the slot contract exercisable.
        },
    };
}
/**
 * The default slot set: all three slots as identity (no-op) defaults.
 * Used as the base that {@link TeamAgentBinderOptions.slots} overrides
 * per key.
 */
export function defaultOverlaySlots() {
    return {
        persona: identityOverlaySlot('persona'),
        model: identityOverlaySlot('model'),
        capability: identityOverlaySlot('capability'),
    };
}
/**
 * The default admission guard (T1): admits unconditionally with
 * `ADMISSION_OPEN`. See the module docs for the rationale.
 */
export const defaultAdmissionGuard = {
    decide() {
        return { status: 'admitted' };
    },
};
//# sourceMappingURL=defaults.js.map