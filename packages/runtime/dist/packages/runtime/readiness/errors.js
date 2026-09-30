/**
 * pre-alpha3 PR-C — the closed error surface of the capability readiness
 * module (plan §C.4).
 *
 * The readiness module is fail-soft by design: a probe that CANNOT run
 * (no probe port for the capability type, or the probe port rejects) does
 * NOT throw — it resolves to the `unknown` verdict with a structured `reason`
 * (plan §C.10 gate 3: a fresh boot / restart re-probes, it never assumes the
 * capability is down). The only throwing path is STRUCTURAL validation (a
 * malformed observation or event payload), which reuses the frozen
 * `MALFORMED_DTO` contract error (see {@link ./types.js}).
 *
 * This module documents that surface and names the one typed failure the
 * substrate observation can carry — an observation that FAILED to resolve
 * (a typed host/probe failure) is `unresolved` (plan §C.3), NOT an ordinary
 * incompatibility and NOT a probe `unreachable`.
 * @module @dsh-agent-team/runtime/readiness/errors
 */
/**
 * The closed readiness error codes. Validation reuses `MALFORMED_DTO`
 * (the frozen contracts error, thrown by the types module); these codes
 * name the readiness-specific typed conditions.
 */
export const READINESS_ERROR_CODES = {
    /**
     * A capability observation could not be RESOLVED: a typed host/probe
     * failure (the service is absent, the preset is unknown/unreadable, or a
     * conditional disable is not evaluatable by any source). Distinct from a
     * probe `unreachable` (a probe ran and observed the capability down) and
     * from an ordinary incompatibility (plan §C.3). Carried as the
     * `unresolved` persona kind / the observation `reason`.
     */
    UNRESOLVED_OBSERVATION: 'READINESS_UNRESOLVED_OBSERVATION',
    /**
     * No probe port is registered for the requested capability type. NOT an
     * error — the probe resolves to the `unknown` verdict with this reason
     * (the capability has not been observed). Documented here so the reason
     * string is a closed value, not free text.
     */
    NO_PROBE_PORT: 'READINESS_NO_PROBE_PORT',
    /**
     * A registered probe port rejected (the probe itself failed). NOT an
     * error — the probe resolves to the `unknown` verdict carrying the
     * rejection message as the reason (fail-soft, re-probable).
     */
    PROBE_REJECTED: 'READINESS_PROBE_REJECTED',
};
/** The closed reason codes as a value array (for closed-set tests). */
export const READINESS_ERROR_CODE_VALUES = Object.values(READINESS_ERROR_CODES);
//# sourceMappingURL=errors.js.map