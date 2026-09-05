/**
 * GovernanceOverrideRecord — the `overrides` store record
 * (Architecture §14.3 category D, storage-level v1).
 *
 * The store distinguishes the four kinds of governance state the
 * architecture forbids to conflate:
 *
 * - **autonomy-overlay × team scope** — a template-level autonomy overlay
 *   (`kind: 'autonomy-overlay'`, `scope: 'team'`), owned by the agent
 *   authority (`origin: 'leader' | 'member'`);
 * - **autonomy-overlay × instance scope** — a member-level autonomy
 *   overlay (`kind: 'autonomy-overlay'`, `scope: 'instance'`,
 *   `instanceId` present), owned by the agent authority;
 * - **human-override × team scope** — a human override of the TeamSession
 *   (`kind: 'human-override'`, `scope: 'team'`), no agent origin;
 * - **human-override × instance scope** — a human override of one
 *   MemberInstance (`kind: 'human-override'`, `scope: 'instance'`),
 *   no agent origin.
 *
 * Cross-field rules make the distinction untraceable-proof:
 * `origin` is REQUIRED exactly for `autonomy-overlay` (agent autonomy
 * mutations are attributable to the agent authority) and FORBIDDEN for
 * `human-override` (human overrides are not agent acts); `instanceId` is
 * required exactly for `scope: 'instance'`. An agent autonomy mutation
 * therefore can never masquerade as a human override and there is no
 * untraceable patch (Architecture §14.3 D).
 *
 * `values` is the lossless-JSON payload (per-cell policy values); its
 * semantic validation belongs to the P3 policy domain, not to storage.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/override
 */
import type { InstanceId, RootSessionId, RemoteSafeRecord } from '../../contracts/src/index.js';
/** The two frozen governance override kinds (autonomy vs human). */
export declare const GOVERNANCE_OVERRIDE_KINDS: {
    /** An agent autonomy mutation (overlay), attributable to the agent authority. */
    readonly AUTONOMY_OVERLAY: "autonomy-overlay";
    /** A human override, never attributable to an agent. */
    readonly HUMAN_OVERRIDE: "human-override";
};
/** One of the two frozen governance override kinds. */
export type GovernanceOverrideKind = (typeof GOVERNANCE_OVERRIDE_KINDS)[keyof typeof GOVERNANCE_OVERRIDE_KINDS];
/** The two frozen governance scopes (team session vs member instance). */
export declare const GOVERNANCE_OVERRIDE_SCOPES: {
    /** Scoped to the TeamSession (template-level state). */
    readonly TEAM: "team";
    /** Scoped to one MemberInstance. */
    readonly INSTANCE: "instance";
};
/** One of the two frozen governance scopes. */
export type GovernanceOverrideScope = (typeof GOVERNANCE_OVERRIDE_SCOPES)[keyof typeof GOVERNANCE_OVERRIDE_SCOPES];
/** The two frozen agent-authority origins for autonomy overlays. */
export declare const GOVERNANCE_OVERRIDE_ORIGINS: {
    /** The mutation originated from the LeaderInstance authority. */
    readonly LEADER: "leader";
    /** The mutation originated from a member authority. */
    readonly MEMBER: "member";
};
/** One of the two frozen agent-authority origins. */
export type GovernanceOverrideOrigin = (typeof GOVERNANCE_OVERRIDE_ORIGINS)[keyof typeof GOVERNANCE_OVERRIDE_ORIGINS];
/** The exact frozen fields of a GovernanceOverrideRecord (v1). */
export declare const GOVERNANCE_OVERRIDE_FIELDS: readonly string[];
/**
 * The `overrides` store record: one durable governance override.
 */
export interface GovernanceOverrideRecord {
    /** Record shape version; v1 records carry `1`. */
    readonly schemaVersion: number;
    /** Autonomy overlay (agent) vs human override. */
    readonly kind: GovernanceOverrideKind;
    /** The override's own identity (overlayId/overrideId of the policy layer). */
    readonly recordId: string;
    /** TeamSession scope vs MemberInstance scope. */
    readonly scope: GovernanceOverrideScope;
    /** The TeamSession (root session id) the override belongs to. */
    readonly rootSessionId: RootSessionId;
    /** The targeted MemberInstance id; present exactly when scope is `instance`. */
    readonly instanceId?: InstanceId;
    /** The agent authority the mutation is attributable to; present exactly when kind is `autonomy-overlay`. */
    readonly origin?: GovernanceOverrideOrigin;
    /** The lossless-JSON payload (per-cell policy values). */
    readonly values: RemoteSafeRecord;
    /** Record version/generation counter (starts at 1). */
    readonly generation: number;
    /** Last modification time, ISO-8601. */
    readonly updatedAt: string;
}
/**
 * The identity components of an override row (the store key inputs).
 */
export interface GovernanceOverrideIdentity {
    readonly kind: GovernanceOverrideKind;
    readonly recordId: string;
    readonly scope: GovernanceOverrideScope;
    readonly rootSessionId: string;
    readonly instanceId?: string;
}
/**
 * The stable store key of an override row: the canonical JSON of the
 * identity components (sorted keys; `instanceId` omitted when absent).
 * @param identity - the identity components.
 * @returns the canonical JSON key string.
 */
export declare function governanceOverrideKey(identity: GovernanceOverrideIdentity): string;
/**
 * Parse and validate a governance override record from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level, with field/problem details) for
 *   any rule violation, plus contracts codes (preserved via
 *   `normalizeValidationError`) for malformed session/instance ids.
 */
export declare function parseGovernanceOverride(value: unknown): GovernanceOverrideRecord;
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export declare function serializeGovernanceOverride(record: GovernanceOverrideRecord): string;
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export declare function deserializeGovernanceOverride(json: string): GovernanceOverrideRecord;
//# sourceMappingURL=override.d.ts.map