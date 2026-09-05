/**
 * TemplateProjectionDto — the projection row of one LeaderTemplate or
 * MemberTemplate of the bound blueprint snapshot (Architecture §6.1).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - A projection carries the templates of its bound snapshot verbatim by
 *   identity (`kind` + `templateId`); the enclosing projection references
 *   the immutable snapshot (invariant 10), so template content is never
 *   duplicated here — the row is a THIN identity + display record: counts
 *   (0..N instances per template, invariant 17) are derived by the client
 *   from the members array, never stored.
 * - `contextPolicy` is the frozen-at-creation policy of the template
 *   (invariant 29): instances inherit it and may override at creation; the
 *   member projection carries the EFFECTIVE per-instance value.
 * - `instanceQuota` is a template-level cap (>= 1) when the blueprint
 *   defines one; key absent when the template has no cap.
 *
 * The template row is an embedded value: the enclosing versioned record
 * owns the schema version, so the row carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/template
 */
import type { TemplateId } from '../ids/template-id.js';
import type { TemplateKind, ContextPolicy } from './states.js';
/** Max length of a template description. */
export declare const TEMPLATE_DESCRIPTION_MAX_LENGTH = 512;
/** The exact frozen fields of a TemplateProjectionDto. */
export declare const TEMPLATE_PROJECTION_FIELDS: readonly string[];
/**
 * The projection row of one template of the bound blueprint (v1).
 */
export interface TemplateProjectionDto {
    /** The frozen template kind (`leader` | `member`). */
    readonly kind: TemplateKind;
    /** The static template identity (NOT a runtime identity, invariant 19). */
    readonly templateId: TemplateId;
    /** Human-facing display name (<= 128 chars). */
    readonly displayName: string;
    /** Human-facing description (<= 512 chars); key absent when not carried. */
    readonly description?: string;
    /** The template's frozen context policy (invariant 29). */
    readonly contextPolicy: ContextPolicy;
    /** Template-level instance cap (>= 1); key absent when the template has no cap. */
    readonly instanceQuota?: number;
}
/**
 * Producer input for {@link createTemplateProjection}: all identity and
 * content fields, no schemaVersion (the enclosing record stamps it).
 */
export interface TemplateProjectionInput {
    /** The template kind. */
    kind: TemplateKind;
    /** The static template identity. */
    templateId: TemplateId;
    /** Human-facing display name. */
    displayName: string;
    /** Human-facing description (optional). */
    description?: string;
    /** The template's frozen context policy. */
    contextPolicy: ContextPolicy;
    /** Template-level instance cap (optional). */
    instanceQuota?: number;
}
/**
 * Parse and validate a TemplateProjectionDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen template row.
 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_TEMPLATE_ID`, or the field-specific codes.
 */
export declare function parseTemplateProjection(value: unknown): TemplateProjectionDto;
/**
 * Build a fresh TemplateProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys).
 * @param input - the template fields.
 * @returns the frozen template row, validated through the same pipeline as
 *   `parseTemplateProjection`.
 */
export declare function createTemplateProjection(input: TemplateProjectionInput): TemplateProjectionDto;
//# sourceMappingURL=template.d.ts.map