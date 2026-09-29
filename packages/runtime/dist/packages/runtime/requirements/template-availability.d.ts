/**
 * pre-alpha3 PR-E (plan §E.6/§E.11) — the TemplateAvailability model.
 *
 * A {@link TemplateAvailability} is the DURABLE disable/enable state of one
 * template (the §E.6 "required template missing → fix + recheck OR disable
 * template" resolution). It:
 *
 * - is DURABLE (survives restart — authority negative #10);
 * - is NOT a policy denial (authority negative #9: **template disable ≠
 *   policy deny** — disabling a template excludes it from WORK START, but
 *   the template's effective policy is UNCHANGED; a disabled template's
 *   operations still resolve to their original policy, they simply are not
 *   started as new work);
 * - defaults to `available: true` for a template with no entry (absence =
 *   enabled — the safe, permissive default for a template that was never
 *   disabled).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/template-availability
 */
import type { TemplateAvailability } from './types.js';
/** Whether a template is available (no entry = available). */
export declare function isTemplateAvailable(availability: readonly TemplateAvailability[], templateId: string): boolean;
/**
 * Set one template's availability, returning the NEW list (deduped by
 * templateId, insertion order preserved). Does not mutate the input.
 */
export declare function setTemplateAvailability(availability: readonly TemplateAvailability[], templateId: string, available: boolean): TemplateAvailability[];
/**
 * Validate that every availability entry names a KNOWN template.
 * @throws {@link RequirementError} `UNKNOWN_TEMPLATE` when an entry names a
 *   template that is not in the bound blueprint's template set.
 */
export declare function validateTemplateAvailability(availability: readonly TemplateAvailability[], knownTemplateIds: readonly string[]): void;
//# sourceMappingURL=template-availability.d.ts.map