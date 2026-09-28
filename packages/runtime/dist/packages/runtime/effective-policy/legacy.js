/**
 * The LEGACY-ARGS adaptation (pre-alpha3 PR-B): the pre-PR-B call shape
 * (`external` + the partial `templateValues` static template grants)
 * adapted to a literal {@link PolicyReader} so every input style funnels
 * into the ONE canonical read. The adapter is the pre-PR-B behavior
 * bit-for-bit: the empty blueprint layer, the partial template (absent =
 * empty), the given external facts (absent = the empty no-restriction
 * facts).
 */
/**
 * Build the legacy-args literal reader.
 * @param external - the legacy `external` input (absent = empty facts).
 * @param templateValues - the legacy static template values (absent = empty).
 */
export function legacyPolicyReaderOf(external, templateValues) {
    return {
        readBlueprintEnvelope: () => ({}),
        readTemplatePolicy: () => (templateValues === undefined ? {} : { values: templateValues }),
        readExternalFacts: () => external ?? { hard: {}, capabilityExists: {} },
    };
}
//# sourceMappingURL=legacy.js.map