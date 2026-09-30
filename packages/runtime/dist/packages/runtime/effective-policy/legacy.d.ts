/**
 * The LEGACY-ARGS adaptation (pre-alpha3 PR-B): the pre-PR-B call shape
 * (`external` + the partial `templateValues` static template grants)
 * adapted to a literal {@link PolicyReader} so every input style funnels
 * into the ONE canonical read. The adapter is the pre-PR-B behavior
 * bit-for-bit: the empty blueprint layer, the partial template (absent =
 * empty), the given external facts (absent = the empty no-restriction
 * facts).
 */
import type { ExternalPolicyFacts, TemplatePolicy } from '../../domain/policy/src/index.js';
import type { PolicyReader } from '../mutation/index.js';
/**
 * Build the legacy-args literal reader.
 * @param external - the legacy `external` input (absent = empty facts).
 * @param templateValues - the legacy static template values (absent = empty).
 */
export declare function legacyPolicyReaderOf(external: ExternalPolicyFacts | undefined, templateValues: TemplatePolicy['values'] | undefined): PolicyReader;
//# sourceMappingURL=legacy.d.ts.map