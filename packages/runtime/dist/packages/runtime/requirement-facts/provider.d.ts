/**
 * pre-alpha3 PR-E / review fix F1 — the `RuntimeRequirementFactsProvider`:
 * the production live-environment source for the RequirementAuthority
 * (guide §2.3 — "#40 建立 live fact provider 的底层 seam, #42 切换 consumer").
 *
 * The provider resolves the LIVE facts of the bound Blueprint's requirements
 * at one boundary scope:
 *
 * ```text
 * MCP supply         -> ports.configuredMcpServers
 * MCP readiness      -> ports.readiness (the #40 CapabilityReadinessProvider —
 *                       a FRESH probe per call; the durable telemetry is
 *                       NEVER read back as readiness)
 * MCP materialization-> ports.memberMaterialization (the glue's ephemeral
 *                       live MCP state — template/instance boundary only;
 *                       a cold member is `not-applicable`, never `failed`)
 * persona            -> ports.substratePlan (the RuntimeSubstrateResolver +
 *                       the production persona observer, plan §C.2)
 * other domains      -> ports.readiness (the existing authoritative probe
 *                       ports; a missing port is `unknown`, fail-soft)
 * ```
 *
 * Every resolution is FRESH (no caching across calls): after a restart the
 * readiness recovers to `unknown` and the next probe re-establishes the
 * verdict (guide §2.3: "restart 后 readiness 应恢复为 unknown,再 probe").
 * The row `config.environmentFacts` enters only as the bootstrap seed
 * (guide §2.3): it feeds the engine for subjects whose live verdict is
 * `unknown` — never for a subject with a live verdict.
 *
 * Pure module over injected ports: no I/O, no live Agent, no `node:`
 * builtins. The ports are the I/O boundary (the production host binds them
 * to the glue's live state + the DSH public seams).
 * @module @dsh-agent-team/runtime/requirement-facts/provider
 */
import { type RequirementFactsPorts, type RuntimeRequirementFactsProvider } from './types.js';
/**
 * Create the runtime requirement-facts provider over the injected ports
 * (the review fix F1 — the RequirementAuthority's only live environment
 * source).
 * @param ports - the supply list, the readiness probe, the substrate plan,
 *   the optional seed + materialization view + the clock.
 * @returns the provider surface.
 */
export declare function createRuntimeRequirementFactsProvider(ports: RequirementFactsPorts): RuntimeRequirementFactsProvider;
//# sourceMappingURL=provider.d.ts.map