/**
 * pre-alpha3 PR-C — the capability readiness vocabulary (plan §C.4): the
 * 3-state capability probe and its observation record.
 *
 * This module introduces the LIVE readiness observation that the existing
 * compatibility probe stack deliberately does not carry:
 *
 * - the compatibility engine's `EnvironmentFact` is a BOOLEAN `available`
 *   verdict, and an unprobed subject is collapsed to
 *   `available:false` + `NO_PROBE_GENERATION` (the domain's documented
 *   "absence = unreachable with a sentinel generation"). "Unknown" (no probe
 *   yet) is not representable in that feed.
 * - the §C.4 probe keeps the three-way distinction explicit:
 *   `unknown` (no probe result yet — the capability has not been observed),
 *   `reachable` (a probe confirmed the capability is live), `unreachable`
 *   (a probe observed the capability is not live). `unknown` is NOT
 *   `unreachable`: a fresh boot / restart must re-probe, not assume the
 *   capability is down (plan §C.10 gate 3).
 *
 * The capability *type* axis reuses the frozen domain vocabulary
 * (`REQUIREMENT_TYPES`, Architecture §27.1): `tool | skill | mcpServer |
 * modelRoute | persona | teamStructure`. The readiness module does NOT
 * invent a new capability-type set (a new kind is a domain-vocabulary change,
 * not a readiness-local invention).
 *
 * A {@link CapabilityObservation} is the one probed fact about one named
 * capability: its identity, the 3-state verdict, and the provenance
 * (`source` — which seam produced it; `observedAt` — ISO-8601; `reason` —
 * optional structured diagnostic). The `reason`/`observedAt`/`source` are
 * provenance only — they NEVER enter any fingerprint input (the same
 * discipline the domain applies to `EnvironmentFact.detail`).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtins. Probes run
 * through the injected ports of {@link ./provider.js}; the observation is
 * frozen data.
 * @module @dsh-agent-team/runtime/readiness/types
 */
import type { RequirementType } from '../../domain/compatibility/src/index.js';
/**
 * The capability kind axis of a readiness probe. Alias of the frozen domain
 * requirement-type vocabulary (Architecture §27.1) — the readiness module
 * probes exactly the capability kinds the compatibility engine can require.
 */
export type CapabilityType = RequirementType;
/**
 * The closed 3-state readiness verdict. `unknown` is a DISTINCT state —
 * "no probe result yet" — and is never conflated with `unreachable` (a probe
 * observed the capability is down).
 */
export declare const PROBE_VERDICTS: {
    /** No probe result for this capability yet (fresh boot / restart). */
    readonly unknown: "unknown";
    /** A probe confirmed the capability is live. */
    readonly reachable: "reachable";
    /** A probe observed the capability is not live. */
    readonly unreachable: "unreachable";
};
/** One of the closed 3-state readiness verdicts. */
export type ProbeVerdict = (typeof PROBE_VERDICTS)[keyof typeof PROBE_VERDICTS];
/** Every verdict value, for closed-set membership tests. */
export declare const PROBE_VERDICT_VALUES: readonly string[];
/**
 * Assert that `value` is a closed 3-state readiness verdict.
 * @param value - the raw verdict.
 * @param path - pointer used in the error details.
 * @returns the typed verdict.
 * @throws `MALFORMED_DTO` for any value outside the 3-state vocabulary.
 */
export declare function assertProbeVerdict(value: unknown, path: string): ProbeVerdict;
/**
 * The known observation *sources* — which seam produced a readiness
 * observation. The field itself is a free-form string (a new seam may add a
 * new source without changing the vocabulary), but these are the closed set
 * the production wiring uses. Provenance only — never a fingerprint input.
 */
export declare const OBSERVATION_SOURCES: {
    /** The runtime substrate resolver (plan §C.2) observed the real mount. */
    readonly substrateResolver: "substrate-resolver";
    /** The live mini-MCP fiber state (mounted / activation failure) observed it. */
    readonly mcpFiber: "mcp-fiber";
    /** The per-member model-state view observed it. */
    readonly modelState: "model-state";
    /** The existing compatibility probe (boolean fact) was projected to it. */
    readonly compatibilityProbe: "compatibility-probe";
    /** A manual recheck (plan §C.6 recheck seam) forced a fresh probe. */
    readonly manualRecheck: "manual-recheck";
};
/** One of the known observation sources. */
export type ObservationSource = (typeof OBSERVATION_SOURCES)[keyof typeof OBSERVATION_SOURCES];
/**
 * One probed fact about one named capability (the §C.4 observation). Frozen,
 * plain lossless-JSON data.
 */
export interface CapabilityObservation {
    /** The capability kind (the closed §27.1 vocabulary). */
    readonly capabilityType: CapabilityType;
    /** The named capability (tool/skill/MCP server/model-route/preset id). */
    readonly capabilityName: string;
    /** The 3-state verdict of the probe. */
    readonly verdict: ProbeVerdict;
    /** The seam that produced this observation (provenance). */
    readonly source: string;
    /** The observation time, ISO-8601 (provenance; never a fingerprint input). */
    readonly observedAt: string;
    /** Optional structured diagnostic (provenance; never a fingerprint input). */
    readonly reason?: string;
    /** Optional probe generation (staleness/generation, §14.3 E). */
    readonly generation?: number;
}
/**
 * The (capabilityType, capabilityName) identity of one probed capability —
 * the registry key and the telemetry event identity.
 */
export interface CapabilityIdentity {
    readonly capabilityType: CapabilityType;
    readonly capabilityName: string;
}
/**
 * Validate and freeze one capability observation.
 * @param value - the raw observation (a plain record with the frozen fields).
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen observation.
 * @throws `MALFORMED_DTO` for unknown fields, an unknown verdict, a non-§27.1
 *   capability type, or a malformed identity/source/observedAt/generation.
 */
export declare function parseCapabilityObservation(value: unknown, path?: string): CapabilityObservation;
/**
 * Build one capability observation from typed inputs (the production path —
 * the probe ports return these). Validates the identity and freezes.
 * @param args - the typed observation fields.
 * @returns the frozen observation.
 * @throws `MALFORMED_DTO` when the identity is empty or the verdict/source/
 *   observedAt is malformed.
 */
export declare function createCapabilityObservation(args: {
    readonly capabilityType: CapabilityType;
    readonly capabilityName: string;
    readonly verdict: ProbeVerdict;
    readonly source: string;
    readonly observedAt: string;
    readonly reason?: string;
    readonly generation?: number;
}): CapabilityObservation;
/** The collision-proof (capabilityType, capabilityName) registry key. */
export declare function capabilityKey(capabilityType: CapabilityType, capabilityName: string): string;
//# sourceMappingURL=types.d.ts.map