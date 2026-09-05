/**
 * Fingerprint computation for the compatibility engine.
 *
 * The environment fingerprint is a stable identity for the *relevant*
 * environment facts (Architecture §14.3 E: "current compatibility
 * facts/fingerprint —staleness/generation"; §27.3: an acknowledgement binds
 * to a "requirement fingerprint" + "capability/environment fingerprint").
 * Two evaluations whose fingerprints differ observe a different environment
 * generation, so the earlier result —and every acknowledgement bound to it — * is stale and must not be trusted (drift invalidation).
 *
 * The algorithm is pure, deterministic, and dependency-free: two independent
 * FNV-1a-style 32-bit passes (different bases) over the canonical JSON of the
 * probe records. Canonical JSON (contracts `canonicalJsonStringify`) sorts
 * keys, so the fingerprint is independent of property-insertion order; the
 * probe records are sorted by (domain, subject), so it is also independent of
 * input array order. No hashing builtin (node:crypto) is used —the domain
 * package must stay pure ES2022.
 *
 * Authority: Architecture §14.3 E, §27.3, §28; Development Plan §16.2
 * Compatibility ("ack fingerprint"); TaskDoc §11.4 P3-T5 ("environment
 * fingerprint bound to the result; any drift invalidates the previous
 * result").
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/fingerprint
 */
import type { RemoteSafeJsonValue } from '../../../contracts/src/index.js';
/** Version tag embedded in every emitted fingerprint (`fp-v1:<32 hex>`). */
export declare const FINGERPRINT_ALGORITHM_VERSION = "v1";
/**
 * Probe-absence sentinel generation. A required (domain, subject) with no
 * environment fact at all is a probe that never ran; encoding it as
 * generation -1 keeps "never probed" distinguishable from "probed at
 * generation 0" in the fingerprint.
 */
export declare const NO_PROBE_GENERATION = -1;
/**
 * Compute a stable fingerprint of a lossless-JSON value.
 *
 * @param value - the value to fingerprint (typically the probe-record set).
 * @returns `fp-v1:<8 hex><8 hex>` —deterministic for a given value.
 */
export declare function computeFingerprint(value: RemoteSafeJsonValue): string;
//# sourceMappingURL=fingerprint.d.ts.map