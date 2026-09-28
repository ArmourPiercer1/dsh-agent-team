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
import { deepFreeze, teamContractError } from '../../contracts/src/index.js';
// --- the 3-state probe verdict (plan §C.4) -----------------------------------
/**
 * The closed 3-state readiness verdict. `unknown` is a DISTINCT state —
 * "no probe result yet" — and is never conflated with `unreachable` (a probe
 * observed the capability is down).
 */
export const PROBE_VERDICTS = {
    /** No probe result for this capability yet (fresh boot / restart). */
    unknown: 'unknown',
    /** A probe confirmed the capability is live. */
    reachable: 'reachable',
    /** A probe observed the capability is not live. */
    unreachable: 'unreachable',
};
/** Every verdict value, for closed-set membership tests. */
export const PROBE_VERDICT_VALUES = Object.values(PROBE_VERDICTS);
/**
 * Assert that `value` is a closed 3-state readiness verdict.
 * @param value - the raw verdict.
 * @param path - pointer used in the error details.
 * @returns the typed verdict.
 * @throws `MALFORMED_DTO` for any value outside the 3-state vocabulary.
 */
export function assertProbeVerdict(value, path) {
    if (typeof value !== 'string' || !PROBE_VERDICT_VALUES.includes(value)) {
        throw teamContractError('MALFORMED_DTO', `unknown readiness verdict at ${path}`, { path, problem: 'unknown readiness verdict', value: typeof value === 'string' ? value : typeof value });
    }
    return value;
}
// --- the observation source (provenance, plan §C.4) ---------------------------
/**
 * The known observation *sources* — which seam produced a readiness
 * observation. The field itself is a free-form string (a new seam may add a
 * new source without changing the vocabulary), but these are the closed set
 * the production wiring uses. Provenance only — never a fingerprint input.
 */
export const OBSERVATION_SOURCES = {
    /** The runtime substrate resolver (plan §C.2) observed the real mount. */
    substrateResolver: 'substrate-resolver',
    /** The live mini-MCP fiber state (mounted / activation failure) observed it. */
    mcpFiber: 'mcp-fiber',
    /** The per-member model-state view observed it. */
    modelState: 'model-state',
    /** The existing compatibility probe (boolean fact) was projected to it. */
    compatibilityProbe: 'compatibility-probe',
    /** A manual recheck (plan §C.6 recheck seam) forced a fresh probe. */
    manualRecheck: 'manual-recheck',
};
// --- the observation record ----------------------------------------------------
/** The exact frozen fields of a capability observation. */
const CAPABILITY_OBSERVATION_FIELDS = [
    'capabilityType',
    'capabilityName',
    'verdict',
    'source',
    'observedAt',
    'reason',
    'generation',
];
/** A non-empty string guard (house style). */
function readNonEmptyString(record, field, path) {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0) {
        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string at ${path}`, {
            path,
            field,
            problem: 'missing or non-string field',
        });
    }
    return value;
}
/**
 * Validate and freeze one capability observation.
 * @param value - the raw observation (a plain record with the frozen fields).
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen observation.
 * @throws `MALFORMED_DTO` for unknown fields, an unknown verdict, a non-§27.1
 *   capability type, or a malformed identity/source/observedAt/generation.
 */
export function parseCapabilityObservation(value, path = '$') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw teamContractError('MALFORMED_DTO', `capability observation must be a plain record at ${path}`, {
            path,
            problem: 'not a plain record',
        });
    }
    const record = value;
    for (const key of Object.keys(record)) {
        if (!CAPABILITY_OBSERVATION_FIELDS.includes(key)) {
            throw teamContractError('MALFORMED_DTO', `capability observation has unknown field '${key}' at ${path}`, {
                path,
                field: key,
                problem: 'unknown field',
            });
        }
    }
    const capabilityType = readNonEmptyString(record, 'capabilityType', path);
    const capabilityName = readNonEmptyString(record, 'capabilityName', path);
    const verdict = assertProbeVerdict(record['verdict'], `${path}.verdict`);
    const source = readNonEmptyString(record, 'source', path);
    const observedAt = readNonEmptyString(record, 'observedAt', path);
    const reason = record['reason'];
    if (reason !== undefined && typeof reason !== 'string') {
        throw teamContractError('MALFORMED_DTO', `reason must be a string at ${path}.reason`, {
            path: `${path}.reason`,
            problem: 'reason must be a string',
        });
    }
    const generation = record['generation'];
    if (generation !== undefined && (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 0)) {
        throw teamContractError('MALFORMED_DTO', `generation must be a non-negative integer at ${path}.generation`, {
            path: `${path}.generation`,
            problem: 'generation must be a non-negative integer',
        });
    }
    const observation = {
        capabilityType: capabilityType,
        capabilityName,
        verdict,
        source,
        observedAt,
        ...(reason !== undefined ? { reason } : {}),
        ...(generation !== undefined ? { generation } : {}),
    };
    return deepFreeze(observation);
}
/**
 * Build one capability observation from typed inputs (the production path —
 * the probe ports return these). Validates the identity and freezes.
 * @param args - the typed observation fields.
 * @returns the frozen observation.
 * @throws `MALFORMED_DTO` when the identity is empty or the verdict/source/
 *   observedAt is malformed.
 */
export function createCapabilityObservation(args) {
    if (args.capabilityName.length === 0) {
        throw teamContractError('MALFORMED_DTO', 'capabilityName must be non-empty', {
            field: 'capabilityName',
            problem: 'empty capability name',
        });
    }
    if (args.source.length === 0) {
        throw teamContractError('MALFORMED_DTO', 'source must be non-empty', {
            field: 'source',
            problem: 'empty source',
        });
    }
    if (args.observedAt.length === 0) {
        throw teamContractError('MALFORMED_DTO', 'observedAt must be non-empty', {
            field: 'observedAt',
            problem: 'empty observedAt',
        });
    }
    return parseCapabilityObservation({
        capabilityType: args.capabilityType,
        capabilityName: args.capabilityName,
        verdict: args.verdict,
        source: args.source,
        observedAt: args.observedAt,
        reason: args.reason,
        generation: args.generation,
    });
}
/** The collision-proof (capabilityType, capabilityName) registry key. */
export function capabilityKey(capabilityType, capabilityName) {
    return `${capabilityType}\u0000${capabilityName}`;
}
//# sourceMappingURL=types.js.map