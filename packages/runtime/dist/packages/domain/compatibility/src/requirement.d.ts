/**
 * Typed requirement vocabulary for the compatibility engine.
 *
 * **Requirement != Policy** (Architecture §19.1): a requirement states that
 * the Blueprint *expects a capability to exist*; it is not a policy decision
 * (it does not say a role may use the capability), and it never means "ask
 * the Team plugin to auto-install the capability". Requirements are only
 * validated and checked against environment facts —they produce no policy.
 *
 * **Closed domain vocabulary** (Architecture §27.1): a requirement may only
 * declare a genuinely probeable domain:
 *
 * ```text
 * tools            -> 'tool'
 * skills           -> 'skill'
 * MCP servers      -> 'mcpServer'
 * model/provider routes -> 'modelRoute'
 * persona/runtime-context compatibility -> 'persona'
 * Team structural runtime capabilities  -> 'teamStructure'
 * ```
 *
 * Unknown requirement type = validation error —fail loud, typed
 * (`MALFORMED_DTO` with the offending value in `details`), per
 * Architecture §27.1 and TaskDoc §11.4 P3-T5.
 *
 * `complete:true` (Architecture §13.5 generalised by the T5 ruling): the
 * requirement is *structural* —if unmet, the outcome is a mandatory FATAL
 * that cannot be downgraded to WARNING and cannot be acknowledged away
 * (FATAL 不允许Continue Anyway, §27.2).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/requirement
 */
/** The closed requirement-type vocabulary (Architecture §27.1). */
export declare const REQUIREMENT_TYPES: {
    readonly tool: "tool";
    readonly skill: "skill";
    readonly mcpServer: "mcpServer";
    readonly modelRoute: "modelRoute";
    readonly persona: "persona";
    readonly teamStructure: "teamStructure";
};
/** A requirement type from the closed §27.1 vocabulary. */
export type RequirementType = (typeof REQUIREMENT_TYPES)[keyof typeof REQUIREMENT_TYPES];
/** Every requirement-type value, for membership checks and closed-set tests. */
export declare const REQUIREMENT_TYPE_VALUES: readonly string[];
/** Raw (unvalidated) requirement input. `complete` defaults to `false`. */
export interface RequirementInput {
    readonly requirementId: string;
    readonly type: RequirementType;
    /** Named subjects the requirement probes (tool/skill/MCP/route names, preset id, structural capability names). */
    readonly subjects: readonly string[];
    /** Structural requirement: unmet => mandatory FATAL, no downgrade (§13.5, T5 ruling). */
    readonly complete?: boolean;
}
/** A validated, frozen requirement. */
export interface Requirement extends RequirementInput {
    /** Always present after validation (defaults to `false`). */
    readonly complete: boolean;
}
/**
 * Assert that `value` is a closed-vocabulary requirement type.
 * @param value - the raw type value.
 * @param path - pointer used in the error details.
 * @returns the typed requirement type.
 * @throws `MALFORMED_DTO` with `problem: 'unknown requirement type'` for any
 *   value outside the §27.1 vocabulary (fail loud, typed).
 */
export declare function assertRequirementType(value: unknown, path: string): RequirementType;
/**
 * The closed set of persona kinds a Team requirement may REQUIRE (plan
 * §E.3). This increment: exactly `standard` (a composable persona).
 * `absent` / `complete` as REQUIRED kinds are outside the closed set until an
 * ADR gives them product semantics (they remain valid OBSERVED kinds — the
 * runtime `ObservedPersonaKind` vocabulary).
 *
 * This is the SINGLE source of truth for the required-persona-kind
 * vocabulary, placed in the domain layer so BOTH the blueprint v2 validator
 * (which restricts persona-type requirement subjects to this set — the
 * additive v2 rule) and the runtime requirement module (which names the
 * required kind as the persona requirement's subject) consume the same
 * frozen set. The SUBJECT convention for persona requirements is the persona
 * KIND (not the preset id): the requirement's subjects name the required
 * kind(s); the world facts report the observed kind.
 */
export declare const REQUIRED_PERSONA_KINDS: {
    readonly standard: "standard";
};
/** A closed persona kind a Team requirement may demand (this increment: `standard`). */
export type RequiredPersonaKind = (typeof REQUIRED_PERSONA_KINDS)[keyof typeof REQUIRED_PERSONA_KINDS];
/** Every `RequiredPersonaKind` value, for closed-set membership tests. */
export declare const REQUIRED_PERSONA_KIND_VALUES: readonly string[];
/** Guard: is `value` a closed required persona kind? */
export declare function isRequiredPersonaKind(value: unknown): value is RequiredPersonaKind;
/**
 * Parse and validate one requirement from an untrusted value.
 * @param value - the raw requirement.
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen, validated requirement.
 * @throws `MALFORMED_DTO` for any structural violation, including an unknown
 *   requirement type.
 */
export declare function parseRequirement(value: unknown, path?: string): Requirement;
/**
 * Parse and validate a requirement list.
 * @param values - the raw array (an empty list is valid: a blueprint without
 *   requirements is trivially compatible).
 * @returns the frozen list; `requirementId`s are unique within the list.
 * @throws `MALFORMED_DTO` when not an array, for any malformed member, or on
 *   duplicate `requirementId`s.
 */
export declare function parseRequirements(values: unknown): readonly Requirement[];
//# sourceMappingURL=requirement.d.ts.map