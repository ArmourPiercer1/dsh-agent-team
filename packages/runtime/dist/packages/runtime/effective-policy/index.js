/**
 * The canonical EffectivePolicy read plane (pre-alpha3 PR-B, plan §B):
 * the module public surface.
 *
 * - {@link readEffectivePolicy} — the SINGLE canonical read (durable
 *   facts in, the frozen EffectivePolicy + provenance out);
 * - {@link resolveActivationPolicy} — the canonical step-8 / inspect
 *   resolver (the frozen name; delegates to the canonical read);
 * - {@link deriveModelSelection} / {@link deriveMcpFacet} — the
 *   per-capability derivations (consumer = derive(canonical));
 * - {@link committedPolicyState} / {@link memberOverrideRefs} — the
 *   committed-state and provenance helpers.
 */
export { readEffectivePolicy, } from './reader.js';
export { resolveActivationPolicy, } from './activation-policy.js';
export { legacyPolicyReaderOf, } from './legacy.js';
export { committedPolicyState, memberOverrideRefs, } from './types.js';
export { selectPolicyOverrides } from './select.js';
//# sourceMappingURL=index.js.map