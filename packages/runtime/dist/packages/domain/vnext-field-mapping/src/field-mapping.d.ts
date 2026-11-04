/**
 * field-mapping.ts — the Domain field-mapping CONSUMPTION SURFACE for
 * vNext (INTERFACES-v1 §C-VNEXT: 默认拒绝, 无隐式默认; the v3 production
 * document is not modified by this lane).
 *
 * THE LAW: this is a consumer, not a producer. It projects an incoming
 * document onto a DECLARED field map, and every field the map does not
 * cover is a typed REJECTION, not a silent drop:
 *
 *  - DEFAULT DENY. A source leaf path not named by the map ⇒
 *    `unmapped-source-field`, listing every offender. Silently dropping a
 *    field would let a producer smuggle a new field through a version bump.
 *  - NO IMPLICIT DEFAULTS. A map entry whose source path is absent from the
 *    document ⇒ `missing-source-field`. Nothing is filled in with `undefined`,
 *    `null`, `''`, or a zero — an absent fact stays absent, and absence is loud.
 *  - NO TARGET COLLISIONS. Two source paths writing one target ⇒ declared
 *    invalid at map-declaration time, not at projection time.
 *  - PURE + FROZEN. No I/O, no clock, no schema-version sniffing; the output
 *    is deep-frozen so a later consumer cannot launder a rejected field back in.
 *
 * Leaf-only flattening: arrays are leaves (element mapping is a separate
 * contract; treating an array as a leaf means the WHOLE array is one mapped
 * field, never silently per-element).
 *
 * @module @dsh-agent-team/domain/vnext-field-mapping/field-mapping
 */
export type FieldMap = ReadonlyMap<string, string>;
export interface MappingRejection {
    readonly ok: false;
    readonly code: 'unmapped-source-field' | 'missing-source-field' | 'duplicate-target' | 'empty-map' | 'invalid-path';
    readonly detail: string;
    readonly fields: readonly string[];
}
export type MappingResult = {
    readonly ok: true;
    readonly value: Readonly<Record<string, unknown>>;
} | MappingRejection;
/**
 * Declare a field map (source dotted path → target key). The map is closed
 * at declaration: duplicate targets, empty maps, and malformed paths are
 * refusals HERE, so a projection never has to guess what a broken map meant.
 */
export declare function declareFieldMapping(entries: ReadonlyArray<{
    readonly sourcePath: string;
    readonly targetKey: string;
}>): {
    readonly ok: true;
    readonly map: FieldMap;
} | MappingRejection;
/**
 * Project one incoming document through a declared map, DEFAULT-DENY.
 * Exact cover is required both ways: every source leaf is mapped, and every
 * map source is present. Anything else is a typed refusal naming fields.
 */
export declare function projectThroughMap(map: FieldMap, document: unknown): MappingResult;
//# sourceMappingURL=field-mapping.d.ts.map