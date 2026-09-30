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
 * discipline the domain applies to `EnvironmentFact.detail`). An unsettled
 * (`unknown`) verdict may carry the optional `observationState` (the PF-2
 * tri-state — in-flight vs never-observed; see {@link OBSERVATION_STATES}).
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
 * The closed 2-state OBSERVATION STATE of an unsettled (`unknown`) readiness
 * verdict — the PF-2 tri-state split (2026-09-30, parent adjudication,
 * option A — the first-create bootstrap exemption). `unknown` alone cannot
 * distinguish the two structurally different pre-observation worlds:
 *
 * - `in-flight` — a PENDING materialization slot EXISTS on a live session
 *   (a raw materialization slot without a settled fiber, or unapplied
 *   durable records / a template grant that drive a mount at the next
 *   boundary — the B5 transient window). The observation is IN PROGRESS:
 *   the typed PENDING block stands (genuinely recheckable — plan §C.3
 *   fail-closed scope, C.5 "pending is a real materialization state");
 * - `never-observed` — NO fiber / NO pending slot / NO failed slot on ANY
 *   live session (the capability is STRUCTURALLY not-yet-applicable — the
 *   canonical v1→v2 first-create shape: a team-scope server that only
 *   materializes at the leader boundary of an EXISTING team). No observation
 *   can settle it short of the create itself (a liveness deadlock if
 *   PENDING); the bootstrap seed is the only pre-observation source (C.2 —
 *   the seed as static bootstrap source) and its truth decides: the
 *   legacy seed-satisfied 2-state stands for this state ONLY (E.6
 *   preflight; the exemption is the seed's, never a blanket OPEN).
 *
 * The state rides on the observation (provenance of the unsettled verdict —
 * like `reason`/`observedAt`, never a fingerprint input) and is consumed by
 * the ONE shared classifier predicate in the requirement-facts layer
 * (`classifyScopeReadiness` / `dropSeedFilledPendingFacts`), so every
 * decision consumer (the probe, the creation preflight, the gate, the
 * activation step) inherits identical behavior: probe == gate (INV-9.4).
 *
 * A SETTLED verdict (`reachable`/`unreachable`) carries NO observation
 * state (malformed if present); an `unknown` WITHOUT the field defaults to
 * IN-FLIGHT (the conservative D-3 default — the exemption is never
 * inferred, only observed).
 */
export declare const OBSERVATION_STATES: {
    /** A pending materialization slot exists on a live session (in progress). */
    readonly inFlight: "in-flight";
    /** No fiber / pending slot / failed slot on any live session (not yet applicable). */
    readonly neverObserved: "never-observed";
};
/** One of the closed observation states of an unsettled verdict. */
export type ObservationState = (typeof OBSERVATION_STATES)[keyof typeof OBSERVATION_STATES];
/** Every observation-state value, for closed-set membership tests. */
export declare const OBSERVATION_STATE_VALUES: readonly string[];
/**
 * Assert that `value` is a closed observation state.
 * @param value - the raw state.
 * @param path - pointer used in the error details.
 * @returns the typed state.
 * @throws `MALFORMED_DTO` for any value outside the 2-state vocabulary.
 */
export declare function assertObservationState(value: unknown, path: string): ObservationState;
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
    /**
     * The observation state of an UNSETTLED verdict (the PF-2 tri-state,
     * 2026-09-30 — parent adjudication option A; see {@link OBSERVATION_STATES}).
     * Present ONLY with the `unknown` verdict (malformed otherwise); ABSENT
     * with `unknown` = `in-flight` (the conservative D-3 default — the
     * first-create bootstrap exemption is never inferred, only observed).
     */
    readonly observationState?: ObservationState;
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
 *   capability type, or a malformed identity/source/observedAt/generation,
 *   or an `observationState` outside the closed 2-state set (or with a
 *   settled verdict).
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
    /** The observation state of an unsettled verdict (see {@link OBSERVATION_STATES}). */
    readonly observationState?: ObservationState;
}): CapabilityObservation;
/** The collision-proof (capabilityType, capabilityName) registry key. */
export declare function capabilityKey(capabilityType: CapabilityType, capabilityName: string): string;
//# sourceMappingURL=types.d.ts.map