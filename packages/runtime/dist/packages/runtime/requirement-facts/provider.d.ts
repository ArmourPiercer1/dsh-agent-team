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
 *                       the production persona observer, plan §C.2); the
 *                       persona KIND convention (the v2 SUBJECT convention,
 *                       plan §E.3): a subject that is a closed required
 *                       persona kind resolves the OBSERVED kind of the role
 *                       the scope addresses (team ⇒ root, template ⇒ member,
 *                       R8); a non-kind subject keeps the frozen v1 preset-id
 *                       path byte-for-byte
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
 * **Probeable scoping (D-3 narrowing, 2026-09-30 — parent adjudication,
 * option 1).** Each observation carries the `probeable` STRUCTURAL fact:
 * whether a live probe port is registered for its capability type (read
 * here from the host's probe-port registry through the readiness port's
 * `hasProbe` query — the single source of truth; a readiness surface
 * without the query is treated as fully probeable). The D-3 PENDING
 * reclassification (see `./pending.js`) applies to REQUIRED subjects of
 * PROBEABLE types whose observation has not settled (the transient
 * materialization window — B5). A required `unknown` of a NON-probeable
 * type (no live probe port — structurally unobservable live; in the
 * current production host: `skill`/`tool`/`modelRoute`/`teamStructure`,
 * which register no probe port, while `mcpServer` does) keeps the legacy
 * seed-satisfied 2-state — the documented known gap (the bootstrap seed
 * is the only source for such types), the pre-W2-A behavior preserved
 * DELIBERATELY; it is NOT the W2-A "seed never truth" rule, which applies
 * to probeable domains where the live verdict settles.
 *
 * **The PF-2 tri-state (2026-09-30 — parent adjudication, option A).** The
 * probe port's observation of an UNSETTLED (`unknown`) probeable subject
 * may carry the `observationState` (see {@link ObservationState}):
 * `in-flight` — a pending materialization slot exists on a live session
 * (the B5 transient window; the D-3 typed PENDING stands) — or
 * `never-observed` — no fiber / pending slot / failed slot on ANY live
 * session (the capability is STRUCTURALLY not-yet-applicable; the
 * canonical v1→v2 first-create shape where a team-scope server
 * materializes only at the leader boundary of an EXISTING team — PENDING
 * there would be a liveness deadlock, because no observation can settle
 * short of the create itself). The provider carries the state onto each
 * observation (only `never-observed` is written; absent = `in-flight`,
 * the conservative default — the exemption is never inferred) and the ONE
 * shared classifier predicate in `./pending.js` applies it: a
 * never-observed required subject keeps the legacy seed-satisfied 2-state
 * (the bootstrap seed is the only pre-observation source — C.2; E.6
 * preflight; the seed's TRUTH decides — available `true` → OPEN/proceed,
 * `false`/absent → FATAL — the exemption is NOT a blanket OPEN), while
 * every other decision consumer (the probe drop-filter, the creation
 * preflight, the gate, the activation step) inherits identical behavior
 * from the same predicate — probe == gate (INV-9.4).
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