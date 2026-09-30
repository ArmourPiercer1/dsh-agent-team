/**
 * pre-alpha3 PR-E / review fix F1 — the runtime requirement-facts
 * vocabulary: the production live-environment source for the
 * RequirementAuthority (the #40 side of the fix — the #42 gate consumes it).
 *
 * The review (guide §2): PR-C built the readiness/materialization substrate
 * (CapabilityReadinessProvider, the observation registry, the MCP
 * materialization state, the capability-runtime telemetry) but the
 * requirement gate still read the STATIC row `environmentFacts` — a real MCP
 * outage updated the substrate while the gate kept seeing `available:true`
 * (a false OPEN of the core ADR: required outage → normal work BLOCK →
 * Recovery).
 *
 * This module is the vocabulary of the `RuntimeRequirementFactsProvider`
 * (the `./provider.js`): the ONE live environment source the
 * RequirementAuthority reads (guide §2.3). Data flow (guide §2.3):
 *
 * ```text
 * Blueprint requirement
 *         ↓
 * Runtime Requirement Fact Resolver (the provider)
 *         ├─ MCP supply: configuredMcpServers
 *         ├─ MCP readiness: CapabilityReadinessProvider (fresh probe)
 *         ├─ MCP materialization: live agent MCP state (template/instance)
 *         ├─ persona: RuntimeSubstrateResolver (the production plan)
 *         ├─ repo/model/...: existing authoritative probes
 *         ↓
 * EnvironmentFact / RequirementObservation
 *         ↓
 * RequirementAuthority
 * ```
 *
 * Scope semantics (guide §2.3):
 *
 * - Team-level requirement: supply + fresh readiness;
 * - Template/instance applicable boundary: supply + fresh readiness +
 *   materialization.
 *
 * Constraints locked here (guide §2.3):
 *
 * - a COLD/inactive member's materialization is `not-applicable` (derived
 *   from liveness — the readiness/status derivation) and MUST NOT block;
 * - after a restart the readiness recovers to `unknown` and re-probes — the
 *   provider NEVER reads the durable `capability-runtime-event` telemetry
 *   back as current readiness (the telemetry is the ledger, the probe is
 *   the truth);
 * - the row `config.environmentFacts` is a BOOTSTRAP/STATIC SEED only
 *   (the `seedFacts` port): it feeds the engine only for subjects whose
 *   live verdict is `unknown` (no live observation yet), and it NEVER
 *   overrides a live verdict (reachable/unreachable);
 * - D-3 narrowing (2026-09-30, parent adjudication — option 1): the
 *   `probeable` structural fact on each observation (the host's
 *   probe-port registry read at observation time via the readiness port's
 *   `hasProbe` query; absent = probeable) scopes the D-3 PENDING
 *   reclassification (see `./pending.js`) to PROBEABLE required types
 *   whose observation has not settled (the transient materialization
 *   window). A required `unknown` of a NON-probeable type — no live probe
 *   port registered (the documented known gap; the current production
 *   host registers only `mcpServer`, so `skill`/`tool`/`modelRoute`/
 *   `teamStructure` — and the substrate-plan-observed `persona` — are
 *   non-probeable) — is structurally unobservable live and keeps the
 *   legacy seed-satisfied 2-state (the pre-W2-A behavior preserved
 *   DELIBERATELY; NOT the W2-A "seed never truth" rule, which applies to
 *   probeable domains where the live verdict settles).
 *
 * The 3-state readiness (`unknown | reachable | unreachable`) is the
 * readiness module's vocabulary (plan §C.4) — `unknown` is a distinct
 * re-probable state, never conflated with `unreachable`. The 2-state
 * compatibility `EnvironmentFact` feed is DERIVED from the live observations
 * (see {@link RequirementFactsResolution.environmentFacts}) for the engine's
 * fingerprint/ack machinery; the BLOCK/OPEN DECISION of the gate reads the
 * 3-state {@link RequirementObservation}s (guide §2.5: static
 * `available:true` + live `unreachable` → required BLOCK / optional
 * DEGRADED).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirement-facts/types
 */
import { deepFreeze, teamContractError } from '../../contracts/src/index.js';
/**
 * Assert that `value` is a well-formed boundary scope.
 * @param value - the raw scope.
 * @returns the frozen scope.
 * @throws `MALFORMED_DTO` for a malformed scope (fail loud, typed).
 */
export function assertRequirementFactScope(value) {
    if (typeof value !== 'object' || value === null) {
        throw teamContractError('MALFORMED_DTO', 'requirement-fact scope must be a record at $', {
            path: '$',
            problem: 'not a record',
        });
    }
    const record = value;
    const kind = record['kind'];
    if (kind === 'team') {
        return deepFreeze({ kind: 'team' });
    }
    if (kind === 'template') {
        const templateId = record['templateId'];
        if (typeof templateId !== 'string' || templateId.length === 0) {
            throw teamContractError('MALFORMED_DTO', 'template scope requires a non-empty templateId at $.templateId', {
                path: '$.templateId',
                problem: 'missing or non-string templateId',
            });
        }
        const instanceId = record['instanceId'];
        if (instanceId !== undefined && (typeof instanceId !== 'string' || instanceId.length === 0)) {
            throw teamContractError('MALFORMED_DTO', 'instanceId must be a non-empty string at $.instanceId', {
                path: '$.instanceId',
                problem: 'non-string instanceId',
            });
        }
        return deepFreeze(instanceId === undefined
            ? { kind: 'template', templateId }
            : { kind: 'template', templateId, instanceId });
    }
    throw teamContractError('MALFORMED_DTO', `unknown requirement-fact scope kind '${String(kind)}' at $.kind`, {
        path: '$.kind',
        problem: 'unknown scope kind',
        value: typeof kind === 'string' ? kind : typeof kind,
    });
}
//# sourceMappingURL=types.js.map