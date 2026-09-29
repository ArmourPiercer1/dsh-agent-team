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
 *   overrides a live verdict (reachable/unreachable).
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
import type { EnvironmentFact, RequirementInput, RequirementType } from '../../domain/compatibility/src/index.js';
import type { CapabilityReadinessProvider, MaterializationSlot, MaterializationStatus, MemberLiveness, ProbeVerdict, SupplyAxis } from '../readiness/index.js';
import type { RuntimeSubstratePlan } from '../agent-setup/preset/index.js';
/**
 * The boundary scope of one fact resolution (guide §2.3).
 *
 * - `team` — the Team-level requirement: supply + fresh readiness;
 * - `template` — the template/instance applicable boundary: supply + fresh
 *   readiness + materialization (the `instanceId` is present for an
 *   instance-addressed boundary; a template-only boundary omits it).
 */
export type RequirementFactScope = {
    readonly kind: 'team';
} | {
    readonly kind: 'template';
    readonly templateId: string;
    readonly instanceId?: string;
};
/**
 * Assert that `value` is a well-formed boundary scope.
 * @param value - the raw scope.
 * @returns the frozen scope.
 * @throws `MALFORMED_DTO` for a malformed scope (fail loud, typed).
 */
export declare function assertRequirementFactScope(value: unknown): RequirementFactScope;
/**
 * One LIVE requirement observation — the 3-state truth of one
 * (requirement, subject) pair, fresh from the live substrate (never a
 * static row fact, never the durable telemetry).
 *
 * This is what the RequirementAuthority's BLOCK/OPEN decision reads:
 *
 * - `supply` (the `mcpServer` domain only) — the row's `configuredMcpServers`
 *   membership: an UNCONFIGURED required MCP is `unreachable` by
 *   configuration (a structural defect — recovery is reconfiguration, not a
 *   wait for the server);
 * - `readiness` — the fresh 3-state probe verdict (plan §C.4): `unknown`
 *   (not observed yet — re-probe, fail-soft, never assume down), `reachable`,
 *   `unreachable` (observed down);
 * - `materialization` (the `mcpServer` domain, the template/instance boundary
 *   only) — the ephemeral mount state (the closed four-state): a COLD member
 *   is `not-applicable` (MUST NOT block), a resident member with a failed
 *   slot is `failed` (blocks that template's normal work — guide §2.5.5).
 */
export interface RequirementObservation {
    /** The requirement this observation is for (identity echo). */
    readonly requirementId: string;
    /** The requirement domain (the closed §27.1 vocabulary). */
    readonly type: RequirementType;
    /** The probed subject (the requirement's named capability). */
    readonly subject: string;
    /** The supply axis (`mcpServer` only: the row configuration membership). */
    readonly supply?: SupplyAxis;
    /** The fresh 3-state readiness verdict (never the static row fact). */
    readonly readiness: ProbeVerdict;
    /** The readiness source (provenance; the probe port's source). */
    readonly readinessSource: string;
    /** The readiness observation time, ISO-8601 (provenance). */
    readonly readinessObservedAt: string;
    /** Optional readiness diagnostic (provenance). */
    readonly readinessReason?: string;
    /** The ephemeral mount state (`mcpServer`, the template/instance boundary only). */
    readonly materialization?: MaterializationStatus;
}
/**
 * The resolution of one `resolveFacts` call — the live observations of every
 * (requirement, subject) pair + the derived 2-state engine feed.
 *
 * **The `environmentFacts` feed contract** (the 3-state → 2-state
 * projection for the compatibility engine's fingerprint/ack machinery):
 *
 * - live `reachable` → `available: true` (the observation's generation, or
 *   the initial live generation when the port reports none);
 * - live `unreachable` → `available: false` (same generation);
 * - live `unknown` + a bootstrap seed fact for the (domain, subject) → the
 *   SEED fact (the `config.environmentFacts` bootstrap — the only source
 *   before the first live observation; its detail names the seed);
 * - live `unknown` + no seed → the fact is OMITTED (the engine's
 *   documented "absence = unprobed" sentinel applies).
 *
 * The gate's BLOCK/OPEN decision reads `observations` (the 3-state truth);
 * the feed never overrides a live verdict (the review fix F1: the static
 * row facts are a bootstrap seed, not the runtime truth).
 */
export interface RequirementFactsResolution {
    /** The live 3-state observation of every (requirement, subject) pair. */
    readonly observations: readonly RequirementObservation[];
    /** The derived 2-state compatibility engine feed (the contract above). */
    readonly environmentFacts: readonly EnvironmentFact[];
    /** The resolution time, ISO-8601 (provenance). */
    readonly resolvedAt: string;
}
/**
 * One bootstrap seed fact in its JSON-safe row-config form (the
 * `TeamPluginEnvironmentFact` shape). The `domain` is a plain `string` at
 * the port boundary — the provider's `parseEnvironmentFacts` validates it
 * against the closed requirement-domain vocabulary (an unknown domain is a
 * typed `MALFORMED_DTO`), so the host can pass the row-config facts without
 * a cast (the row config is not typed at the domain-vocabulary boundary).
 */
export interface SeedEnvironmentFact {
    /** The requirement domain (validated against the closed vocabulary). */
    readonly domain: string;
    /** The requirement subject. */
    readonly subject: string;
    /** Whether the capability is available. */
    readonly available: boolean;
    /** The probe generation. */
    readonly generation: number;
    /** Optional diagnostic detail. */
    readonly detail?: string;
}
/**
 * The member materialization view of one template/instance boundary — the
 * EPHEMERAL live state the materialization axis derives from (plan §C.5):
 * the member's liveness + the per-server MCP materialization slots (the
 * glue's ephemeral `mcpMaterialization` state). NEVER the durable telemetry.
 */
export interface MemberMaterializationView {
    /** The member's liveness (cold / resuming / resident). */
    readonly liveness: MemberLiveness;
    /** The per-server MCP materialization slots (serverName → slot). */
    readonly mcpSlots: ReadonlyMap<string, MaterializationSlot>;
}
/** The injected ports of the runtime requirement-facts provider. */
export interface RequirementFactsPorts {
    /** The row's configured MCP servers (the MCP supply axis, guide §2.3). */
    readonly configuredMcpServers: readonly string[];
    /**
     * The 3-state live readiness probe (the #40 CapabilityReadinessProvider) —
     * called FRESH per resolution (never cached across calls; the restart
     * `unknown` recovery is the port's contract, plan §C.10 gate 3).
     */
    readonly readiness: CapabilityReadinessProvider;
    /**
     * The bootstrap/static seed (the row `config.environmentFacts`) — the ONLY
     * seed role: it feeds the engine for subjects whose live verdict is
     * `unknown` and never overrides a live verdict (guide §2.3). Structural
     * `SeedEnvironmentFact[]` at the port boundary (the row-config shape —
     * the provider validates the domain against the closed vocabulary).
     */
    readonly seedFacts?: readonly SeedEnvironmentFact[];
    /**
     * The live runtime substrate plan (the persona domain — the
     * RuntimeSubstrateResolver + the production persona observer, plan §C.2).
     * Resolved fresh per call.
     */
    readonly substratePlan: () => Promise<RuntimeSubstratePlan>;
    /**
     * The member materialization view of one template/instance boundary (the
     * glue's ephemeral live MCP state). `undefined` = the boundary has no live
     * member state (a cold member → `not-applicable`, which MUST NOT block).
     * Team scopes never call it.
     */
    readonly memberMaterialization?: (scope: RequirementFactScope) => Promise<MemberMaterializationView | undefined>;
    /** The ISO-8601 clock (provenance only). */
    readonly now: () => string;
}
/** The public runtime requirement-facts provider (the #40 live source). */
export interface RuntimeRequirementFactsProvider {
    /**
     * Resolve the LIVE requirement facts of the given requirements at the
     * given boundary scope (guide §2.3). Every probe runs fresh at call time
     * (the restart recovery is `unknown` → re-probe; the durable telemetry is
     * never read back as readiness).
     * @param args - the requirements (re-validated) + the boundary scope.
     * @returns the frozen resolution (3-state observations + the engine feed).
     * @throws `MALFORMED_DTO` for a malformed requirement/scope/seed input.
     */
    resolveFacts(args: {
        readonly requirements: readonly RequirementInput[];
        readonly scope: RequirementFactScope;
    }): Promise<RequirementFactsResolution>;
}
//# sourceMappingURL=types.d.ts.map