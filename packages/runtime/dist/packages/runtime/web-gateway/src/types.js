/**
 * The closed-key enable switch (jobs `jobsEnabled` precedent shape):
 * ABSENT ⇒ disabled (default-off), BOOLEAN ⇒ as-is, ANYTHING ELSE ⇒ typed
 * refusal — a truthy string never arms the row.
 */
export function parseWebEnabledRaw(raw) {
    if (raw === undefined)
        return { ok: true, enabled: false, readAs: 'absent-default-off' };
    if (typeof raw === 'boolean')
        return { ok: true, enabled: raw, readAs: `boolean:${String(raw)}` };
    return {
        ok: false,
        refusal: {
            code: 'web-config-not-boolean',
            detail: `webEnabledRaw must be absent (default off) or a boolean; received ${raw === null ? 'null' : typeof raw}`,
        },
    };
}
/** A frozen {@link GovernanceError} with optional details (never thrown —
 *  the closed Result shape, `errors.ts:53`). `sideEffectUnknown` is the
 *  honest top-level field (`errors.ts:48`): set TRUE only when bytes may
 *  have left the lane; refusals that provably precede transport say false. */
export function webGatewayRefusal(code, message, options) {
    const error = { code, message };
    if (options?.sideEffectUnknown !== undefined)
        error['sideEffectUnknown'] = options.sideEffectUnknown;
    if (options?.details !== undefined)
        error['details'] = options.details;
    return { ok: false, error: Object.freeze(error) };
}
//# sourceMappingURL=types.js.map