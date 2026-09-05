/**
 * Template id contract: the STATIC identity of a LeaderTemplate /
 * MemberTemplate inside a TeamBlueprint.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **`templateId` is the static identity of a MemberTemplate and is NOT a
 *   runtime identity** (invariant 19, Architecture §10.2: "templateId,
 *   label, groupId 均不是运行时 identity"). Two instances of the same
 *   template are distinct members distinguished by `instanceId` (§10.2
 *   example: same templateId `researcher`, same label `Fourier`, but
 *   `inst-A` vs `inst-B` are two persistent MemberInstances).
 * - **One MemberTemplate can produce 0..N MemberInstances** (invariant 17).
 * - Templates are not runtime actors (invariant 16, §6.3).
 *
 * Format: a lowercase slug — first character a-z, then a-z / 0-9 / `-`,
 * 1..64 characters total (`researcher`, `developer`, `reviewer`, matching
 * the architecture's examples).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/template-id
 */
import type { Brand } from './brand.js';
/** The single strict format of a template id (lowercase slug). */
export declare const TEMPLATE_ID_PATTERN: RegExp;
/** Structural max length of a template id. */
export declare const TEMPLATE_ID_MAX_LENGTH = 64;
/**
 * The static identity of a LeaderTemplate or MemberTemplate.
 *
 * Addressing runtime members by `templateId` is the legacy anti-pattern
 * this contract exists to prevent: use `instanceId` (composite
 * `(rootSessionId, instanceId)`) for anything runtime.
 */
export type TemplateId = string & Brand<'TemplateId'>;
/**
 * Parse and validate a template id.
 * @param raw - the unknown input.
 * @returns the branded `TemplateId`.
 * @throws `INVALID_TEMPLATE_ID` when the value is not a lowercase slug.
 */
export declare function parseTemplateId(raw: unknown): TemplateId;
/** Type guard for the template id rule. */
export declare function isTemplateId(raw: unknown): raw is TemplateId;
//# sourceMappingURL=template-id.d.ts.map