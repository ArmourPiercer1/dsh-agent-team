/**
 * The v4 authoring grammar — DORMANT fourth parser (VNEXT-SCHEMA-ADR M-1
 * reversible half).
 *
 * WHY THIS FILE IS NOT WIRED: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` stays
 * `[3]` this round — the production entry refuses `schemaVersion: 4` with
 * `SCHEMA_VERSION_MISMATCH` exactly as before (pinned by a5sr2), so NOTHING
 * shipped reaches the functions below. The flip (adding 4 to SUPPORTED) is
 * the IRREVERSIBLE last step (翻档); it awaits the A-4 window ruling and is
 * prepared by `scripts/prepare-blueprint-v4-flip.mjs` as a dry-run only.
 *
 * STRUCTURE = zero drift by construction:
 *  - the v4 document face is the v3 face PLUS the optional top-level
 *    `toolBindings` field family; the CORE is parsed by the FROZEN v3
 *    validator itself (strip `toolBindings`, restamp version 3, delegate),
 *    so the frozen v3 branch cannot fork and cannot soften;
 *  - the `toolBindings` grammar is validated here against CLOSED local
 *    tables. This layer must not import the tool-governance lane (the A5
 *    layer audit pins the consumer allow-list); the IDENTITY between the v4
 *    vocabularies and the frozen tool-governance sets is pinned by the test
 *    suite (a5sr3), which IS allowed to read both lanes.
 *
 * Grammar law (ADR §1 B1–B6, D-02/D-03/D-05/D-08/D-09):
 *  - optional field family: absence = NO governance declared, never an
 *    expansion (the reversible A-1 interim stance);
 *  - every value in a declared entry is explicitly written — omissions are
 *    `ambiguous-omission` refusals, not defaults; a key belonging to the
 *    other mode variant is a contradiction, not a silent pick;
 *  - unknown keys are `unknown-field` refusals at their FULL path; v2-
 *    proposal fields (`kind`/`adapterId`/`runnerId`/`shadowExecute`) are
 *    `removed-field` refusals BY NAME;
 *  - closed enums refuse `unknown-enum` with the legal set in the detail —
 *    never a case fold, never an alias;
 *  - `..` is refused in any path segment (`path-unresolvable`) even when
 *    folding keeps it inside; legal whitespace inside a locator survives
 *    VERBATIM (zero normalization — the NRM-1 lesson);
 *  - problems are COLLECTED (one throw carries every defect at its path),
 *    mirroring the tool-governance parse law.
 *
 * Purity: no `node:*`, no I/O, no clock (the whole domain law).
 *
 * @module @dsh-agent-team/domain/blueprint-v4
 */
import type { BlueprintContentHash, RemoteSafeRecord } from '../../../contracts/src/index.js';
import type { TeamBlueprintCore } from './types.js';
/** The v4 document version this dormant grammar owns. */
export declare const BLUEPRINT_V4_SCHEMA_VERSION = 4;
/** v4 top-level face = the frozen v3 face plus the optional field family. */
export declare const BLUEPRINT_V4_TOOL_BINDING_FAMILY: "toolBindings";
/** The closed v4 top-level key set: the frozen v3 table plus the ONE family. */
export declare const BLUEPRINT_V4_TOP_LEVEL_FIELDS: readonly string[];
/** The closed entry shape of one `toolBindings` item. */
export declare const BLUEPRINT_V4_TOOL_BINDING_FIELDS: readonly ["owner", "name", "authorization", "io", "execution"];
export declare const BLUEPRINT_V4_AUTHORIZATIONS: readonly ["allow", "ask", "deny"];
export declare const BLUEPRINT_V4_IO_FIELDS: readonly ["read", "write", "network"];
/** rw-lane modes and their REQUIRED-and-ALLOWED key sets (D-03, no defaults). */
export declare const BLUEPRINT_V4_IO_RW_MODES: readonly ["all", "restricted"];
export declare const BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE: Readonly<Record<'all' | 'restricted', readonly string[]>>;
export declare const BLUEPRINT_V4_NETWORK_MODES: readonly ["allow", "restricted", "deny"];
export declare const BLUEPRINT_V4_NETWORK_DEFAULTS: readonly ["ask", "deny"];
export declare const BLUEPRINT_V4_NETWORK_FIELDS_BY_MODE: Readonly<Record<'allow' | 'restricted' | 'deny', readonly string[]>>;
/** The authoring execution block = the three frozen axes (kind/adapterId/runnerId REMOVED). */
export declare const BLUEPRINT_V4_EXECUTION_FIELDS: readonly ["implementationOrigin", "executionBoundary"];
export declare const BLUEPRINT_V4_IMPLEMENTATION_ORIGINS: readonly ["dsh-native", "team-trusted-extension", "standalone-runner", "remote-provider"];
export declare const BLUEPRINT_V4_EXECUTION_BOUNDARIES: readonly ["trusted-host", "confined-subprocess", "delegated-remote"];
/** v2-proposal fields refused BY NAME (D-05; the refusal names the removal). */
export declare const BLUEPRINT_V4_REMOVED_FIELDS: Readonly<Record<'entry' | 'execution', readonly string[]>>;
export declare const V4_PROBLEM_CODES: readonly ["not-a-record", "field-type", "unknown-field", "removed-field", "ambiguous-omission", "unknown-enum", "path-unresolvable"];
export type V4ProblemCode = (typeof V4_PROBLEM_CODES)[number];
export interface V4ContractProblem {
    readonly code: V4ProblemCode;
    readonly path: string;
    readonly detail: string;
    /** For `unknown-enum`: the closed legal set, so the refusal teaches. */
    readonly legalValues?: readonly string[];
}
export type V4Authorization = (typeof BLUEPRINT_V4_AUTHORIZATIONS)[number];
export type V4ImplementationOrigin = (typeof BLUEPRINT_V4_IMPLEMENTATION_ORIGINS)[number];
export type V4ExecutionBoundary = (typeof BLUEPRINT_V4_EXECUTION_BOUNDARIES)[number];
export type V4RwLane = {
    readonly mode: 'all';
    readonly deny: readonly string[];
} | {
    readonly mode: 'restricted';
    readonly allow: readonly string[];
    readonly ask: readonly string[];
    readonly deny: readonly string[];
};
export type V4NetworkLane = {
    readonly mode: 'allow';
} | {
    readonly mode: 'restricted';
    readonly allow: readonly string[];
    readonly ask: readonly string[];
    readonly deny: readonly string[];
    readonly default: 'ask' | 'deny';
} | {
    readonly mode: 'deny';
    readonly default: 'ask' | 'deny';
};
export interface V4ToolBindingAuthoring {
    readonly owner: string;
    readonly name: string;
    readonly authorization: V4Authorization;
    readonly io: {
        readonly read: V4RwLane;
        readonly write: V4RwLane;
        readonly network: V4NetworkLane;
    };
    readonly execution: {
        readonly implementationOrigin: V4ImplementationOrigin;
        readonly executionBoundary: V4ExecutionBoundary;
    };
}
/** v4 core = the frozen v3 core, version-restamped, plus the OPTIONAL family. */
export type TeamBlueprintV4Core = Omit<TeamBlueprintCore, 'schemaVersion'> & {
    readonly schemaVersion: 4;
    readonly toolBindings?: readonly V4ToolBindingAuthoring[];
};
export type TeamBlueprintV4 = TeamBlueprintV4Core & {
    readonly contentHash: BlueprintContentHash;
};
/**
 * Validate a v4 authoring document. The v3 core face is delegated to the
 * FROZEN v3 validator (restamped); `toolBindings` is parsed here. All
 * grammar problems are COLLECTED into one `MALFORMED_DTO` throw whose
 * `details.problems` name every defect at its full path.
 */
export declare function validateBlueprintV4Document(raw: unknown): TeamBlueprintV4Core;
/** The hashable projection: the frozen v3 projection (restamped) plus the declared family. */
export declare function toHashableBlueprintV4(core: TeamBlueprintV4Core): RemoteSafeRecord;
/** Source pipeline mirror of `parseBlueprint` for the v4 grammar (dormant). */
export declare function parseBlueprintV4(source: string): TeamBlueprintV4;
//# sourceMappingURL=blueprint-v4.d.ts.map