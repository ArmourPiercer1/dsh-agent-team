/**
 * VNext blueprint object model (types only — no runtime code).
 *
 * Mirrors the frozen Architecture object model:
 *
 * - §5.2 identity: `blueprintId` + `revision` + `contentHash`;
 * - §5.3 a valid blueprint carries exactly one complete LeaderTemplate;
 * - §5.4 the Blueprint-owned semantic categories;
 * - §5.6 the immutable snapshot freezes Blueprint-owned semantics.
 *
 * `TeamBlueprint` is the validated, normalized, deeply-frozen object the
 * domain produces from a blueprint source document. `TeamBlueprintCore` is
 * the same object without the derived `contentHash` (the hash is derived
 * from the core's hashable projection, so the content identity never
 * depends on itself).
 *
 * @module @dsh-agent-team/domain/blueprint/types
 */
export {};
//# sourceMappingURL=types.js.map