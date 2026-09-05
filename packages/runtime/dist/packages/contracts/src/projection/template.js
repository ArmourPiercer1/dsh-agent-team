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
import { LABEL_MAX_LENGTH, assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseLabelLikeField, } from '../dto/common.js';
import { parseTemplateId } from '../ids/template-id.js';
import { assertPositiveInteger } from '../ids/common.js';
import { assertNoLegacyFields } from '../legacy-vocabulary.js';
import { deepFreeze } from '../remote-safe.js';
import { parseTemplateKindField, parseContextPolicyField } from './states.js';
/** Max length of a template description. */
export const TEMPLATE_DESCRIPTION_MAX_LENGTH = 512;
/** The exact frozen fields of a TemplateProjectionDto. */
export const TEMPLATE_PROJECTION_FIELDS = [
    'kind',
    'templateId',
    'displayName',
    'description',
    'contextPolicy',
    'instanceQuota',
];
function validateTemplateProjection(record) {
    assertNoLegacyFields(record, 'TemplateProjection');
    assertNoUnknownFields(record, TEMPLATE_PROJECTION_FIELDS, 'TemplateProjection');
    for (const field of TEMPLATE_PROJECTION_FIELDS) {
        if (field !== 'description' && field !== 'instanceQuota') {
            assertFieldPresent(record, field, 'TemplateProjection');
        }
    }
    const base = {
        kind: parseTemplateKindField(record['kind'], 'kind'),
        templateId: parseTemplateId(record['templateId']),
        displayName: parseLabelLikeField(record['displayName'], 'displayName', LABEL_MAX_LENGTH),
        contextPolicy: parseContextPolicyField(record['contextPolicy'], 'contextPolicy'),
    };
    const description = record['description'] === undefined
        ? {}
        : {
            description: parseLabelLikeField(record['description'], 'description', TEMPLATE_DESCRIPTION_MAX_LENGTH),
        };
    const instanceQuota = record['instanceQuota'] === undefined
        ? {}
        : { instanceQuota: assertPositiveInteger(record['instanceQuota'], 'instanceQuota') };
    return deepFreeze({ ...base, ...description, ...instanceQuota });
}
/**
 * Parse and validate a TemplateProjectionDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen template row.
 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_TEMPLATE_ID`, or the field-specific codes.
 */
export function parseTemplateProjection(value) {
    return validateTemplateProjection(assertPlainRecord(value, 'TemplateProjection'));
}
/**
 * Build a fresh TemplateProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys).
 * @param input - the template fields.
 * @returns the frozen template row, validated through the same pipeline as
 *   `parseTemplateProjection`.
 */
export function createTemplateProjection(input) {
    const record = {
        kind: input.kind,
        templateId: input.templateId,
        displayName: input.displayName,
        contextPolicy: input.contextPolicy,
    };
    if (input.description !== undefined)
        record['description'] = input.description;
    if (input.instanceQuota !== undefined)
        record['instanceQuota'] = input.instanceQuota;
    return validateTemplateProjection(record);
}
//# sourceMappingURL=template.js.map