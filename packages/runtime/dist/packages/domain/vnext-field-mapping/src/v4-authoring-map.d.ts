/**
 * The SHIPPING v4 authoring→internal mapping tables (VNEXT-SCHEMA-ADR §1 B3
 * mapping laws, M-2 "mapping tables"). Pure data + pure composition over the
 * frozen DEFAULT-DENY engine (`field-mapping.ts`) — no I/O, no clock.
 *
 * Shape of the composition: the ENGINE owns each closed lane record (exact
 * cover both ways: every source leaf mapped, every map source present); a
 * thin WRAPPER owns the closed GROUPING (entry → core + three lanes +
 * execution), and it refuses with the SAME closed code vocabulary. A key the
 * tables do not name is therefore refused at every level — there is no
 * branch of this file that drops an unmapped field.
 *
 * Resource declarations: RESTRICTED lanes list concrete locators, so each
 * list item becomes one resource DECLARATION candidate
 * `{lane, disposition, locator, inferredKind, rights}` (the schema phase
 * stays ZERO-NORMALIZATION — B5/NRM-1: canonicalization to a canonical
 * ResourceRef is the trusted provider's step, and `parseResourceRef` stays
 * the single parser that turns one into a `ResourceRef`; test a5sr3 pins
 * every filesystem candidate through it). A mode-`all` lane declares NO
 * locator on purpose: emitting a synthesized realm-root locator would be a
 * migration INVENTING a resource; the mode flag alone carries the
 * declaration and the trusted assembly instantiates the realm.
 *
 * @module @dsh-agent-team/domain/vnext-field-mapping/v4-authoring-map
 */
import { type FieldMap, type MappingRejection, type MappingResult } from './field-mapping.js';
export interface V4AuthoringMaps {
    readonly core: FieldMap;
    readonly execution: FieldMap;
    readonly rwByMode: Readonly<Record<'all' | 'restricted', FieldMap>>;
    readonly networkByMode: Readonly<Record<'allow' | 'restricted' | 'deny', FieldMap>>;
}
/**
 * Declare every v4 authoring map. Declaration-time law: a collision or a
 * malformed path here is a refusal of the WHOLE table set (partial tables
 * must never exist).
 */
export declare function declareV4AuthoringMaps(): {
    readonly ok: true;
    readonly maps: V4AuthoringMaps;
} | MappingRejection;
export interface V4ResourceDeclaration {
    readonly lane: 'read' | 'write' | 'network';
    readonly disposition: 'allow' | 'ask' | 'deny';
    readonly locator: string;
    readonly inferredKind: 'workspace' | 'realm-home' | 'absolute-path' | 'network-destination';
    readonly rights: readonly string[];
    /** Schema phase emits DECLARATIONS; a canonical ResourceRef needs the trusted provider (zero-normalization law). */
    readonly canonical: false;
}
/**
 * Project one authoring `toolBindings` entry through the shipped v4 tables.
 * Default-deny at BOTH levels: the wrapper refuses keys outside the closed
 * grouping, the engine refuses keys outside each lane map, and every mapped
 * source must be PRESENT (no implicit defaults).
 */
export declare function projectV4ToolBindingAuthoring(maps: V4AuthoringMaps, entry: unknown): MappingResult;
/**
 * The network axis this round actually commits: a BOOLEAN.  A v4
 * `restricted` lane keeps parsing (the vocabulary is untouched) but projects
 * as a TYPED unsupported fact — it is never coerced into `allow` or `deny`,
 * because silently dropping destination constraints would widen authority.
 */
export type MemberNetworkCeiling = {
    readonly kind: 'boolean';
    readonly access: 'allow' | 'deny';
    readonly declaredMode: 'allow' | 'deny';
} | {
    readonly kind: 'unsupported';
    readonly declaredMode: 'restricted';
    readonly reason: 'network-destination-restricted-not-enforced';
};
/** The projected form of one `memberIoCeilings` entry. */
export interface MemberCeilingProjection {
    readonly templateId: string;
    readonly io: {
        readonly read: Readonly<Record<string, unknown>>;
        readonly write: Readonly<Record<string, unknown>>;
        readonly network: Readonly<Record<string, unknown>>;
    };
    readonly networkCeiling: MemberNetworkCeiling;
    readonly resourceDeclarations: readonly V4ResourceDeclaration[];
}
export type MemberCeilingResult = {
    readonly ok: true;
    readonly value: MemberCeilingProjection;
} | MappingRejection;
/**
 * Project one `memberIoCeilings` entry through the SAME shipped v4 tables.
 * Default-deny at every level: keys outside the closed grouping or lane maps
 * are refused, and every mapped source must be PRESENT.  The returned value
 * is deeply frozen so a consumer cannot mutate a ceiling into a wider one.
 */
export declare function projectV4MemberIoCeiling(maps: V4AuthoringMaps, entry: unknown): MemberCeilingResult;
//# sourceMappingURL=v4-authoring-map.d.ts.map