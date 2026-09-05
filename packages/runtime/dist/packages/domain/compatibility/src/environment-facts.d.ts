/**
 * Environment facts for the compatibility engine.
 *
 * An environment fact is one probe result about the real substrate: whether
 * a named capability in a probeable domain is currently available, at which
 * environment generation. Facts are *data* about the environment (the shape
 * follows the seam-manifest environment-fact model: one row per probed
 * capability with a verdict); they are produced by probes elsewhere and
 * consumed here —the engine itself never probes and never starts any work.
 *
 * **Relevance**: only facts whose (domain, subject) is named by some
 * requirement are *relevant*; the environment fingerprint is a hash of the
 * relevant probe records only, so irrelevant environment churn cannot
 * invalidate a result (Architecture §27.3 binds the ack to the
 * capability/environment fingerprint of the mismatch).
 *
 * **Generation**: a generation bump (even with unchanged availability)
 * changes the probe record and therefore the fingerprint —re-probe
 * semantics per Development Plan §20.1 ("relevant capability generation
 * change" is a re-probe trigger) and Architecture §14.3 E (staleness/generation).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/environment-facts
 */
import type { Requirement, RequirementType } from './requirement.js';
/** One probe result about a named capability (a "seam row" as environment fact). */
export interface EnvironmentFact {
    /** The probeable domain the fact is about (closed §27.1 vocabulary). */
    readonly domain: RequirementType;
    /** The named subject (tool/skill/MCP server/model-route name, preset id, structural capability name). */
    readonly subject: string;
    /** Probe verdict: is the capability currently available? */
    readonly available: boolean;
    /** Environment generation of the probe (staleness/generation, §14.3 E). */
    readonly generation: number;
    /** Optional probe diagnostic (not part of the fingerprint —diagnostics must not invalidate results). */
    readonly detail?: string;
}
/**
 * Parse and validate one environment fact.
 * @param value - the raw fact.
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen fact.
 * @throws `MALFORMED_DTO` for unknown domains, malformed fields, or unknown
 *   fields (diagnostics carry the offending value).
 */
export declare function parseEnvironmentFact(value: unknown, path?: string): EnvironmentFact;
/**
 * Parse and validate an environment-fact list.
 * @param values - the raw array (an empty list is valid: nothing was probed — *   every required subject is then an absent probe).
 * @returns the frozen list; each (domain, subject) pair appears at most once
 *   (a contradictory double probe is a validation error, not a classification).
 * @throws `MALFORMED_DTO` when not an array, for any malformed fact, or on a
 *   duplicate (domain, subject) pair.
 */
export declare function parseEnvironmentFacts(values: unknown): readonly EnvironmentFact[];
/**
 * The probe state of one (domain, subject) as the engine sees it. Absent
 * facts (never probed) are encoded as `available: false` with
 * {@link NO_PROBE_GENERATION} so absence itself is part of the fingerprint.
 *
 * (type alias rather than interface: the frozen remote-safe record type
 * needs the implicit index signature that interfaces do not have).
 */
export type ProbeRecord = {
    readonly domain: RequirementType;
    readonly subject: string;
    readonly available: boolean;
    readonly generation: number;
};
/**
 * Compute the probe records relevant to `requirements`: exactly the
 * (domain, subject) pairs the requirements name, sorted by (domain, subject).
 * @param requirements - validated requirements.
 * @param facts - validated environment facts.
 * @returns the frozen, deterministically sorted probe records.
 */
export declare function computeProbeRecords(requirements: readonly Requirement[], facts: readonly EnvironmentFact[]): readonly ProbeRecord[];
/**
 * Compute the environment fingerprint bound to the compatibility result:
 * the hash of the *relevant* probe records only (availability + generation
 * for every subject the requirements name). Any drift in a relevant fact — * availability flip, generation bump, new/removed probe —changes the
 * fingerprint and invalidates earlier results/acks; irrelevant environment
 * churn does not.
 * @param requirements - validated requirements.
 * @param facts - validated environment facts.
 * @returns the stable `fp-v1:` fingerprint string.
 */
export declare function computeEnvironmentFingerprint(requirements: readonly Requirement[], facts: readonly EnvironmentFact[]): string;
//# sourceMappingURL=environment-facts.d.ts.map