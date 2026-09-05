/**
 * Closed wire-error vocabulary of the Remote contract v1 boundary.
 *
 * Two closed code sets travel on the Remote wire (design note, deviation
 * D-3):
 *
 * 1. **Boundary codes** — failure classes the remote layer itself detects
 *    (unsupported contract version, unknown method, malformed request
 *    envelope, malformed method params, and the last-resort internal
 *    failure). Lowercase-kebab vocabulary, owned by this package.
 * 2. **Mirrored frozen P3 codes** — the value-level mirror of the ID
 *    validation codes of contracts v1 (`packages/contracts/src/ids/*`),
 *    thrown by the local ID parsers in `ids.ts`. The wire values are the
 *    EXACT frozen strings (invariant 9: a TeamSessionId violation surfaces
 *    as `INVALID_ROOT_SESSION_ID`, because `parseTeamSessionId` IS
 *    `parseRootSessionId` in the frozen contracts).
 *
 * Backing-service closed codes (P6-T2 admission, P7-T1 compatibility,
 * P7-T2 mutation, P7-T3 lifecycle, P7-T5 handoff, P7-T7 legacy reader) pass
 * through the dispatcher unchanged when they arrive as typed errors (own
 * string `code` on an `Error`) — see `handlers/dispatch.ts`.
 *
 * NO raw exception ever reaches the wire: an error result is always
 * `{ code, message, details }` with lossless-JSON-checked details.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/errors
 */
/**
 * The closed Remote-boundary error codes (contract v1). Adding a code is a
 * remote contract change (a version bump), never a silent edit.
 */
export const REMOTE_CONTRACT_ERROR_CODES = {
    /** The request `version` is not in the supported set. */
    CONTRACT_VERSION_UNSUPPORTED: 'contract-version-unsupported',
    /** The endpoint is not a method of the closed catalog. */
    UNKNOWN_METHOD: 'unknown-method',
    /** The request envelope itself is malformed (or carries unsafe values). */
    MALFORMED_REQUEST: 'malformed-request',
    /** A method's `params` object fails that method's closed schema. */
    MALFORMED_PARAMS: 'malformed-params',
    /** Last-resort dispatcher failure (handler/port threw an untyped error). */
    INTERNAL_ERROR: 'internal-error',
};
/** Every boundary code value, for closed-set membership tests. */
export const REMOTE_CONTRACT_ERROR_CODE_VALUES = Object.freeze(Object.values(REMOTE_CONTRACT_ERROR_CODES));
/**
 * A typed remote-contract error: the error the remote layer itself throws
 * (boundary codes) or its local parsers throw (mirrored frozen P3 codes).
 *
 * `code` is typed `string` on purpose: the closed registries this package
 * emits are {@link REMOTE_CONTRACT_ERROR_CODES} (boundary) and
 * {@link REMOTE_ID_ERROR_CODES} (`ids.ts`, mirrored P3 values). The wire
 * union additionally carries pass-through backing-service codes (D-3) that
 * the dispatcher maps without re-typing.
 */
export class RemoteContractError extends Error {
    /** The closed error code (boundary or mirrored frozen P3 value). */
    code;
    /**
     * Lossless-JSON-safe structured details (absent when the failure carries
     * none). Always plain data — never a live object reference.
     */
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'RemoteContractError';
        this.code = code;
        if (details !== undefined) {
            this.details = { ...details };
        }
    }
}
/**
 * Type guard for {@link RemoteContractError}.
 * @param value - the unknown input.
 */
export function isRemoteContractError(value) {
    return value instanceof RemoteContractError;
}
/**
 * Build a typed remote-contract error.
 * @param code - the closed code (boundary or mirrored frozen P3 value).
 * @param message - the human-readable wire message (no stack, no internals).
 * @param details - optional lossless-JSON-safe structured details.
 */
export function remoteContractError(code, message, details) {
    return new RemoteContractError(code, message, details);
}
//# sourceMappingURL=errors.js.map