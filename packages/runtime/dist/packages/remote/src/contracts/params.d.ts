/**
 * Per-method closed param schemas of the Remote contract v1.
 *
 * Every catalog method declares a CLOSED set of param fields (design note
 * §3 table, "Input params (closed)"). Parsing one request's `params`
 * object:
 *
 * 1. rejects any unknown field (`malformed-params`, reason
 *    `unknown-field`, the offending field in `details.field`);
 * 2. requires every required field (`missing-required`);
 * 3. validates each value — structural ID fields throw the mirrored frozen
 *    P3 codes from `ids.ts` (e.g. a malformed TeamSessionId surfaces as
 *    `INVALID_ROOT_SESSION_ID`, invariant 9), everything else throws
 *    `malformed-params` with a machine-readable `reason`;
 * 4. returns the typed param object the handler layer consumes.
 *
 * Free-form content fields (the message `body`, the compatibility `note`)
 * are exempt from the no-control-char / no-whitespace ID rule — newlines
 * are legal content — but bound by a length cap (design note §3).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/contracts/params
 */
import { type RemoteSafeRecord } from './remote-safe.js';
/** The closed capability set (`packages/domain/policy` `CAPABILITY_NAMES`). */
export declare const REMOTE_CAPABILITY_VALUES: readonly ["model", "tools", "permissions", "skills", "mcp"];
/** One of the closed capability names. */
export type RemoteCapability = (typeof REMOTE_CAPABILITY_VALUES)[number];
/** The five frozen probe triggers (`packages/runtime/compatibility`). */
export declare const REMOTE_PROBE_TRIGGER_VALUES: readonly ["ROOT_COLD_RESUME", "MEMBER_COLD_RESUME", "NEW_ACTIVATION", "CAPABILITY_GENERATION_CHANGE", "STALE_GENERATION_BEFORE_NEW_WORK"];
/** One of the frozen probe trigger values. */
export type RemoteProbeTrigger = (typeof REMOTE_PROBE_TRIGGER_VALUES)[number];
/** The closed mutation actor kinds (`packages/runtime/mutation`). */
export declare const REMOTE_MUTATION_ACTOR_KINDS: readonly ["human", "leader", "member"];
/** One of the closed mutation actor kinds. */
export type RemoteMutationActorKind = (typeof REMOTE_MUTATION_ACTOR_KINDS)[number];
/** The closed mutation scopes. */
export declare const REMOTE_MUTATION_SCOPES: readonly ["team", "instance"];
/** One of the closed mutation scopes. */
export type RemoteMutationScope = (typeof REMOTE_MUTATION_SCOPES)[number];
/** The closed admission actions the remote surface exposes (P6-T2). */
export declare const REMOTE_ADMISSION_ACTIONS: readonly ["create-member", "send-message", "follow-up"];
/** One of the closed admission actions. */
export type RemoteAdmissionAction = (typeof REMOTE_ADMISSION_ACTIONS)[number];
/** Admission caller (P6-T2 `ActionCaller` mirror). */
export type RemoteCaller = {
    readonly kind: 'human';
    readonly humanId: string;
} | {
    readonly kind: 'instance';
    readonly instanceId: string;
};
/**
 * Mutation actor (`packages/runtime/mutation` `MutationActor` mirror):
 * `member` requires the `member` identity; `human` / `leader` carry no
 * extra fields (closed).
 */
export type RemoteMutationActor = {
    readonly kind: 'human';
} | {
    readonly kind: 'leader';
} | {
    readonly kind: 'member';
    readonly member: {
        readonly rootSessionId: string;
        readonly instanceId: string;
    };
};
/** Policy value (frozen `PolicyEntry` mirror). */
export type RemotePolicyEntry = {
    readonly kind: 'allow';
    readonly items: readonly string[];
} | {
    readonly kind: 'deny';
};
/** One cell of a policy state view (frozen `PolicyStateCellView` mirror). */
export interface RemotePolicyStateCellValue {
    readonly locked?: boolean;
    readonly value?: RemotePolicyEntry;
}
/**
 * Policy state view (frozen `PolicyStateView` mirror): `stateId` + optional
 * `cells` keyed by closed capability name.
 */
export interface RemotePolicyStateViewValue {
    readonly stateId: string;
    readonly cells?: Readonly<Record<RemoteCapability, RemotePolicyStateCellValue>>;
}
/**
 * A lossless-JSON-safe free-form record (method `payload` / handoff
 * `staged` objects). The envelope already guarantees lossless safety;
 * parsers keep the shape plain-record.
 */
export type RemoteLosslessRecord = RemoteSafeRecord;
/** `catalog.list` — no fields. */
export type RemoteCatalogListParams = object;
/** `catalog.get`. */
export interface RemoteCatalogGetParams {
    readonly blueprintId: string;
    readonly blueprintRevision?: number;
}
/** `intent.probe` — `environmentFacts` is required (may be empty). */
export interface RemoteIntentProbeParams {
    readonly blueprintId: string;
    readonly blueprintRevision?: number;
    readonly environmentFacts: readonly RemoteSafeRecord[];
}
/**
 * `team.create`. `initialWork` is optional: when present, the materialized
 * team admits it through the existing work-admission path (a `follow-up`
 * action targeting the leader instance) as part of the creation.
 */
export interface RemoteTeamCreateParams {
    readonly rootSessionId: string;
    readonly blueprintId: string;
    readonly blueprintRevision?: number;
    readonly initialWork?: RemoteLosslessRecord;
}
/** `team.getProjection`. */
export interface RemoteTeamGetProjectionParams {
    readonly teamSessionId: string;
}
/** `team.getLedgerPage` — defaults: `afterSequence` 0, `limit` 50. */
export interface RemoteTeamGetLedgerPageParams {
    readonly teamSessionId: string;
    readonly afterSequence: number;
    readonly limit: number;
}
/** `member.create` — at most one of the two delegation fields (D-7/§3). */
export interface RemoteMemberCreateParams {
    readonly teamSessionId: string;
    readonly caller: RemoteCaller;
    readonly requestToken: string;
    readonly delegationTemplateId?: string;
    readonly delegationInstanceId?: string;
    readonly payload?: RemoteLosslessRecord;
}
/** `member.send` — `body` is free-form (1..200000 chars). */
export interface RemoteMemberSendParams {
    readonly teamSessionId: string;
    readonly caller: RemoteCaller;
    readonly recipientInstanceId: string;
    readonly body: string;
    readonly subject?: string;
    readonly requestToken: string;
    readonly payload?: RemoteLosslessRecord;
}
/** `member.followup`. */
export interface RemoteMemberFollowupParams {
    readonly teamSessionId: string;
    readonly caller: RemoteCaller;
    readonly targetInstanceId: string;
    readonly requestToken: string;
    readonly payload?: RemoteLosslessRecord;
}
/** `member.archive` / `member.restore` / `member.dispose`. */
export interface RemoteMemberLifecycleParams {
    readonly teamSessionId: string;
    readonly instanceId: string;
}
/** `override.get` — a read: no actor. */
export interface RemoteOverrideGetParams {
    readonly teamSessionId: string;
    readonly capability: RemoteCapability;
    readonly scope?: RemoteMutationScope;
    readonly targetInstanceId?: string;
}
/** `override.set` — target present iff `scope === 'instance'`. */
export interface RemoteOverrideSetParams {
    readonly teamSessionId: string;
    readonly capability: RemoteCapability;
    readonly value: RemotePolicyEntry;
    readonly actor: RemoteMutationActor;
    readonly scope?: RemoteMutationScope;
    readonly targetInstanceId?: string;
}
/** `override.reset` — target present iff `scope === 'instance'`. */
export interface RemoteOverrideResetParams {
    readonly teamSessionId: string;
    readonly capability: RemoteCapability;
    readonly actor: RemoteMutationActor;
    readonly scope?: RemoteMutationScope;
    readonly targetInstanceId?: string;
}
/** `policyState.get`. */
export interface RemotePolicyStateGetParams {
    readonly teamSessionId: string;
}
/** `policyState.set`. */
export interface RemotePolicyStateSetParams {
    readonly teamSessionId: string;
    readonly target: RemotePolicyStateViewValue;
    readonly actor: RemoteMutationActor;
}
/** `compatibility.get`. */
export interface RemoteCompatibilityGetParams {
    readonly teamSessionId: string;
}
/** `compatibility.ack`. */
export interface RemoteCompatibilityAckParams {
    readonly teamSessionId: string;
    readonly requirementId: string;
    readonly acknowledgedBy: string;
    readonly note?: string;
}
/** `compatibility.reprobe`. */
export interface RemoteCompatibilityReprobeParams {
    readonly teamSessionId: string;
    readonly trigger: RemoteProbeTrigger;
}
/** `handoff.prepare`. */
export interface RemoteHandoffPrepareParams {
    readonly sourceSessionId: string;
}
/** `handoff.create`. */
export interface RemoteHandoffCreateParams {
    readonly sourceSessionId: string;
    readonly requestToken: string;
    readonly staged?: RemoteLosslessRecord;
}
/** `legacy.inspect` — path fields allow whitespace, forbid control chars. */
export interface RemoteLegacyInspectParams {
    readonly dshHome: string;
    readonly workspaceCwd?: string;
    readonly projectDir?: string;
}
/** The union of every method's parsed param object. */
export type RemoteMethodParams = RemoteCatalogListParams | RemoteCatalogGetParams | RemoteIntentProbeParams | RemoteTeamCreateParams | RemoteTeamGetProjectionParams | RemoteTeamGetLedgerPageParams | RemoteMemberCreateParams | RemoteMemberSendParams | RemoteMemberFollowupParams | RemoteMemberLifecycleParams | RemoteOverrideGetParams | RemoteOverrideSetParams | RemoteOverrideResetParams | RemotePolicyStateGetParams | RemotePolicyStateSetParams | RemoteCompatibilityGetParams | RemoteCompatibilityAckParams | RemoteCompatibilityReprobeParams | RemoteHandoffPrepareParams | RemoteHandoffCreateParams | RemoteLegacyInspectParams;
/** The parse result of one request's `params` (typed + token echo). */
export interface RemoteParsedParams {
    /** The catalog method the params were parsed for. */
    readonly method: string;
    /** The typed, closed param object. */
    readonly params: RemoteMethodParams;
    /** The request token echo (token-carrying methods) or `null`. */
    readonly requestToken: string | null;
}
export declare const REMOTE_CATALOG_LIST_FIELDS: readonly string[];
export declare const REMOTE_CATALOG_GET_FIELDS: readonly string[];
export declare const REMOTE_INTENT_PROBE_FIELDS: readonly string[];
export declare const REMOTE_TEAM_CREATE_FIELDS: readonly string[];
export declare const REMOTE_TEAM_GET_PROJECTION_FIELDS: readonly string[];
export declare const REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS: readonly string[];
export declare const REMOTE_MEMBER_CREATE_FIELDS: readonly string[];
export declare const REMOTE_MEMBER_SEND_FIELDS: readonly string[];
export declare const REMOTE_MEMBER_FOLLOWUP_FIELDS: readonly string[];
export declare const REMOTE_MEMBER_LIFECYCLE_FIELDS: readonly string[];
export declare const REMOTE_OVERRIDE_GET_FIELDS: readonly string[];
export declare const REMOTE_OVERRIDE_SET_FIELDS: readonly string[];
export declare const REMOTE_OVERRIDE_RESET_FIELDS: readonly string[];
export declare const REMOTE_POLICY_STATE_GET_FIELDS: readonly string[];
export declare const REMOTE_POLICY_STATE_SET_FIELDS: readonly string[];
export declare const REMOTE_COMPATIBILITY_GET_FIELDS: readonly string[];
export declare const REMOTE_COMPATIBILITY_ACK_FIELDS: readonly string[];
export declare const REMOTE_COMPATIBILITY_REPROBE_FIELDS: readonly string[];
export declare const REMOTE_HANDOFF_PREPARE_FIELDS: readonly string[];
export declare const REMOTE_HANDOFF_CREATE_FIELDS: readonly string[];
export declare const REMOTE_LEGACY_INSPECT_FIELDS: readonly string[];
/** Parse `catalog.list` params (no fields). */
export declare function parseRemoteCatalogListParams(method: string, params: RemoteSafeRecord): RemoteCatalogListParams;
/** Parse `catalog.get` params. */
export declare function parseRemoteCatalogGetParams(method: string, params: RemoteSafeRecord): RemoteCatalogGetParams;
/** Parse `intent.probe` params (`environmentFacts` required, may be empty). */
export declare function parseRemoteIntentProbeParams(method: string, params: RemoteSafeRecord): RemoteIntentProbeParams;
/** Parse `team.create` params. */
export declare function parseRemoteTeamCreateParams(method: string, params: RemoteSafeRecord): RemoteTeamCreateParams;
/** Parse `team.getProjection` params. */
export declare function parseRemoteTeamGetProjectionParams(method: string, params: RemoteSafeRecord): RemoteTeamGetProjectionParams;
/** Parse `team.getLedgerPage` params (defaults: afterSequence 0, limit 50). */
export declare function parseRemoteTeamGetLedgerPageParams(method: string, params: RemoteSafeRecord): RemoteTeamGetLedgerPageParams;
/** Parse `member.create` params (at most one delegation field). */
export declare function parseRemoteMemberCreateParams(method: string, params: RemoteSafeRecord): RemoteMemberCreateParams;
/** Parse `member.send` params. */
export declare function parseRemoteMemberSendParams(method: string, params: RemoteSafeRecord): RemoteMemberSendParams;
/** Parse `member.followup` params. */
export declare function parseRemoteMemberFollowupParams(method: string, params: RemoteSafeRecord): RemoteMemberFollowupParams;
/** Parse `member.archive` params. */
export declare function parseRemoteMemberArchiveParams(method: string, params: RemoteSafeRecord): RemoteMemberLifecycleParams;
/** Parse `member.restore` params. */
export declare function parseRemoteMemberRestoreParams(method: string, params: RemoteSafeRecord): RemoteMemberLifecycleParams;
/** Parse `member.dispose` params. */
export declare function parseRemoteMemberDisposeParams(method: string, params: RemoteSafeRecord): RemoteMemberLifecycleParams;
/** Parse `override.get` params. */
export declare function parseRemoteOverrideGetParams(method: string, params: RemoteSafeRecord): RemoteOverrideGetParams;
/** Parse `override.set` params. */
export declare function parseRemoteOverrideSetParams(method: string, params: RemoteSafeRecord): RemoteOverrideSetParams;
/** Parse `override.reset` params. */
export declare function parseRemoteOverrideResetParams(method: string, params: RemoteSafeRecord): RemoteOverrideResetParams;
/** Parse `policyState.get` params. */
export declare function parseRemotePolicyStateGetParams(method: string, params: RemoteSafeRecord): RemotePolicyStateGetParams;
/** Parse `policyState.set` params. */
export declare function parseRemotePolicyStateSetParams(method: string, params: RemoteSafeRecord): RemotePolicyStateSetParams;
/** Parse `compatibility.get` params. */
export declare function parseRemoteCompatibilityGetParams(method: string, params: RemoteSafeRecord): RemoteCompatibilityGetParams;
/** Parse `compatibility.ack` params. */
export declare function parseRemoteCompatibilityAckParams(method: string, params: RemoteSafeRecord): RemoteCompatibilityAckParams;
/** Parse `compatibility.reprobe` params. */
export declare function parseRemoteCompatibilityReprobeParams(method: string, params: RemoteSafeRecord): RemoteCompatibilityReprobeParams;
/** Parse `handoff.prepare` params. */
export declare function parseRemoteHandoffPrepareParams(method: string, params: RemoteSafeRecord): RemoteHandoffPrepareParams;
/** Parse `handoff.create` params. */
export declare function parseRemoteHandoffCreateParams(method: string, params: RemoteSafeRecord): RemoteHandoffCreateParams;
/** Parse `legacy.inspect` params. */
export declare function parseRemoteLegacyInspectParams(method: string, params: RemoteSafeRecord): RemoteLegacyInspectParams;
/**
 * Parse `params` for the given catalog method.
 * @param method - a catalog method name (dotted `<category>.<action>`).
 * @param params - the request envelope's `params` object.
 * @returns the typed param object plus the request token echo.
 * @throws {RemoteContractError} `unknown-method` (defensive — the dispatcher
 *   checks membership first), `malformed-params`, or the mirrored frozen P3
 *   ID codes on structural ID violations.
 */
export declare function parseRemoteMethodParams(method: string, params: RemoteSafeRecord): RemoteParsedParams;
//# sourceMappingURL=params.d.ts.map