/**
 * Identity parsing at the Remote contract v1 boundary.
 *
 * Value-level mirror of the P3 ID rules in `packages/contracts/src/ids/*`
 * (frozen contracts v1 — the authority): every DSH session id is an opaque
 * branded string; the vNext boundary rules reject structurally unusable
 * values without inventing an upstream format:
 *
 * - non-empty string;
 * - at most 255 characters;
 * - no ASCII control characters (0x00–0x1F, 0x7F);
 * - no whitespace characters.
 *
 * The WIRE CODES are the exact frozen P3 values (design note, deviation
 * D-1): a TeamSessionId violation surfaces as `INVALID_ROOT_SESSION_ID`
 * (invariant 9: `TeamSessionId = RootSessionId`, and the frozen
 * `parseTeamSessionId` delegates to `parseRootSessionId`), an InstanceId
 * violation as `INVALID_INSTANCE_ID`, and so on — so a client matching the
 * P3 contract vocabulary sees the frozen codes on the Remote wire.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/ids
 */
/** Maximum structural length of any id parsed at the remote boundary. */
export declare const REMOTE_ID_MAX_LENGTH = 255;
/**
 * The mirrored frozen P3 ID error codes (exact values of
 * `packages/contracts/src/ids/*` — `TeamContractErrorCode` subset).
 */
export declare const REMOTE_ID_ERROR_CODES: {
    /** A generic DSH session id violates the rule. */
    readonly INVALID_SESSION_ID: "INVALID_SESSION_ID";
    /** A root / team session id violates the rule (invariant 9: same value). */
    readonly INVALID_ROOT_SESSION_ID: "INVALID_ROOT_SESSION_ID";
    /** A member child session id violates the rule. */
    readonly INVALID_CHILD_SESSION_ID: "INVALID_CHILD_SESSION_ID";
    /** A member instance id violates the rule. */
    readonly INVALID_INSTANCE_ID: "INVALID_INSTANCE_ID";
    /** A member template id violates the rule. */
    readonly INVALID_TEMPLATE_ID: "INVALID_TEMPLATE_ID";
    /** A blueprint id violates the rule. */
    readonly INVALID_BLUEPRINT_ID: "INVALID_BLUEPRINT_ID";
};
/**
 * Parse and validate a TeamSession id (== the root session id, invariant 9).
 * @throws `INVALID_ROOT_SESSION_ID` on any rule violation (frozen P3 value).
 */
export declare function parseRemoteTeamSessionId(raw: unknown, field?: string): string;
/**
 * Parse and validate a root session id (team.create input).
 * @throws `INVALID_ROOT_SESSION_ID` on any rule violation (frozen P3 value).
 */
export declare function parseRemoteRootSessionId(raw: unknown, field?: string): string;
/**
 * Parse and validate a generic DSH session id (e.g. a handoff source).
 * @throws `INVALID_SESSION_ID` on any rule violation (frozen P3 value).
 */
export declare function parseRemoteSessionId(raw: unknown, field?: string): string;
/**
 * Parse and validate a member instance id (instance-first addressing).
 * @throws `INVALID_INSTANCE_ID` on any rule violation (frozen P3 value).
 */
export declare function parseRemoteInstanceId(raw: unknown, field?: string): string;
/**
 * Parse and validate a member template id.
 * @throws `INVALID_TEMPLATE_ID` on any rule violation (frozen P3 value).
 */
export declare function parseRemoteTemplateId(raw: unknown, field?: string): string;
/**
 * Parse and validate a blueprint id.
 * @throws `INVALID_BLUEPRINT_ID` on any rule violation (frozen P3 value).
 */
export declare function parseRemoteBlueprintId(raw: unknown, field?: string): string;
/**
 * Parse and validate a blueprint revision (positive safe integer).
 * @throws `INVALID_BLUEPRINT_REVISION` on any violation (frozen P3 value).
 */
export declare function parseRemoteBlueprintRevision(raw: unknown, field?: string): number;
//# sourceMappingURL=ids.d.ts.map