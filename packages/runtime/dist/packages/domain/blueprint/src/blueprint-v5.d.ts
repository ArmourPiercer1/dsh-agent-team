/**
 * The v5 authoring grammar — DORMANT fifth parser for Alpha.6 review routing.
 *
 * WHY DORMANT: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` remains `[3, 4]` in
 * PR1. The production entry therefore still refuses `schemaVersion: 5` with
 * `SCHEMA_VERSION_MISMATCH`; the flip is a later, explicit step (PR6), so this
 * PR cannot change existing Alpha.5 blueprint behaviour. Direct callers can
 * exercise the grammar through `parseBlueprintV5` / `validateBlueprintV5Document`.
 *
 * STRUCTURE = zero drift by construction:
 *  - the v5 core face is the v4 face plus exactly one optional top-level
 *    `reviewRouting` family; the core is parsed by the frozen v4 bridge with
 *    `reviewRouting` stripped and the version restamped to 4, so the frozen
 *    v3/v4 branches cannot fork;
 *  - only the review-routing family is validated here, against CLOSED local
 *    tables. This module imports no runtime, no ControlService and no PA;
 *    the policy object is a pure authoring fact that a runtime router may
 *    consume later.
 *
 * Grammar law:
 *  - an absent `reviewRouting` = Alpha.6 routing off (no implicit default);
 *  - a present family is explicitly enabled and must carry every field;
 *  - unknown keys, wrong types, duplicate leader exceptions, an Officer that
 *    is not a MemberTemplate, and a non-`officer` default are refusals at
 *    their full path;
 *  - all problems are collected into one `MALFORMED_DTO` throw.
 *
 * @module @dsh-agent-team/domain/blueprint-v5
 */
import type { BlueprintContentHash, RemoteSafeRecord } from '../../../contracts/src/index.js';
import type { TeamBlueprintV4Core } from './blueprint-v4.js';
/** The v5 document version this dormant grammar owns. */
export declare const BLUEPRINT_V5_SCHEMA_VERSION = 5;
/** The one additive v5 top-level family. */
export declare const BLUEPRINT_V5_REVIEW_ROUTING_FAMILY: "reviewRouting";
/** The closed v5 top-level key set: the v4 face plus the ONE family. */
export declare const BLUEPRINT_V5_TOP_LEVEL_FIELDS: readonly string[];
/** The closed fields of the reviewRouting block. */
export declare const BLUEPRINT_V5_REVIEW_ROUTING_FIELDS: readonly ["enabled", "officerTemplateId", "ordinaryToolApprovals", "whenOfficerUnavailable"];
/** The closed fields of ordinaryToolApprovals. */
export declare const BLUEPRINT_V5_ORDINARY_TOOL_APPROVAL_FIELDS: readonly ["default", "leaderExceptions"];
/** The closed fields of one leader exception. */
export declare const BLUEPRINT_V5_LEADER_EXCEPTION_FIELDS: readonly ["memberTemplateId", "tool"];
/** The closed fields of a trusted tool coordinate. */
export declare const BLUEPRINT_V5_TOOL_COORDINATE_FIELDS: readonly ["owner", "name"];
/** The only legal ordinary default: the dedicated Officer. */
export declare const BLUEPRINT_V5_ORDINARY_DEFAULTS: readonly ["officer"];
/** The only legal unavailable policies. */
export declare const BLUEPRINT_V5_WHEN_OFFICER_UNAVAILABLE: readonly ["hold", "leader"];
/** One trusted tool coordinate in the authoring document. */
export interface ReviewToolCoordinate {
    readonly owner: string;
    readonly name: string;
}
/** One explicit Leader exception, keyed by the actual OperationOwner template. */
export interface ReviewLeaderException {
    readonly memberTemplateId: string;
    readonly tool: ReviewToolCoordinate;
}
/** The authored review-routing block. */
export interface ReviewRouting {
    /** Present only as `true`; absence of the whole block is the off switch. */
    readonly enabled: true;
    /** The one dedicated Officer template; must name a MemberTemplate. */
    readonly officerTemplateId: string;
    readonly ordinaryToolApprovals: {
        readonly default: 'officer';
        readonly leaderExceptions: readonly ReviewLeaderException[];
    };
    readonly whenOfficerUnavailable: 'hold' | 'leader';
}
/** A validated v5 core. */
export interface TeamBlueprintV5Core extends Omit<TeamBlueprintV4Core, 'schemaVersion'> {
    readonly schemaVersion: 5;
    readonly reviewRouting?: ReviewRouting;
}
/** A fully parsed, hashed and frozen v5 blueprint. */
export type TeamBlueprintV5 = TeamBlueprintV5Core & {
    readonly contentHash: BlueprintContentHash;
};
/**
 * Validate a v5 authoring document. The v4 core face is delegated to the
 * FROZEN v4 parser (restamped), and only `reviewRouting` is parsed here.
 */
export declare function validateBlueprintV5Document(raw: unknown): TeamBlueprintV5Core;
/** The hashable projection: the frozen v4 projection (restamped) plus the declared family. */
export declare function toHashableBlueprintV5(core: TeamBlueprintV5Core): RemoteSafeRecord;
/** Source pipeline mirror of `parseBlueprint` for the v5 grammar (dormant). */
export declare function parseBlueprintV5(source: string): TeamBlueprintV5;
//# sourceMappingURL=blueprint-v5.d.ts.map