/**
 * P7-T1 — pure capability-drift classification (the rule that turns two
 * compatibility generations into a drift observation).
 *
 * The classification is exactly the probe-generation contract of
 * Development Plan §20.1: a probe is "a drift" precisely when the
 * environment fingerprint —the hash of the RELEVANT probe facts,
 * availability AND probe generation (P3 engine, `fp-v1`)—changed. An
 * unchanged fingerprint means no drift, whatever else the durable state
 * carries; an absent previous state is the establishment of the
 * generation line (recorded, not a drift).
 *
 * Pure: no I/O, no clock, no repositories —two generations in, one
 * observation out (the P3 engine seam the prober composes).
 * @module @dsh-agent-team/runtime/compatibility/drift
 */
import type { CompatibilityStateRecord } from '../../storage/schema/index.js';
import type { CompatibilityVerdict, DriftObservation } from './types.js';
/**
 * Classify one probe generation against the previous durable state.
 *
 * @param previous - the previous durable compatibility state (`undefined`
 *   when the generation line did not exist yet).
 * @param verdict - the verdict of the probe just established.
 * @returns the drift observation (plain lossless-JSON data).
 */
export declare function classifyDrift(previous: CompatibilityStateRecord | undefined, verdict: CompatibilityVerdict): DriftObservation;
//# sourceMappingURL=drift.d.ts.map