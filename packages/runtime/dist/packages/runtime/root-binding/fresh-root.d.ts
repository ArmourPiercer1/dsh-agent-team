/**
 * The fresh-root binding path (P5-T5; DevPlan §18.1 "bind fresh Root",
 * productized from the P2-T2 ROOT_COLD_BINDING characterization).
 *
 * {@link bindFreshTeamRoot} makes one root DSH session the root of a
 * Team. The orchestration (every step fail-closed; the binder is never
 * run unless the durable state is consistent):
 *
 * 1. Input validation — `generation` defaults to 1 and must be a
 *    positive integer (`ROOT_BINDING_INVALID_INPUT`, no effect).
 * 2. Session-kind resolution (READ ONLY, before any effect) — the
 *    session must carry no binding (first create) or a `team-root`
 *    binding (idempotent re-run); any other kind is
 *    `ROOT_BINDING_SESSION_KIND_CONFLICT` (invariants 8/23/24).
 * 3. TeamSession record — absent: durably put the generation-1 record
 *    (crash-safe ORDERING: the record is committed BEFORE the binding,
 *    so a crash between the two writes leaves a binding-less record that
 *    a re-run completes; a binding WITHOUT a record is an integrity
 *    violation, `ROOT_BINDING_TEAM_SESSION_CONFLICT`). Present: it must
 *    match the request's immutable identity (blueprint, invariant 10)
 *    and generation exactly — otherwise `ROOT_BINDING_TEAM_SESSION_CONFLICT`
 *    (the fresh create is a generation-1 path, never an update).
 * 4. `team-root` session binding — durably put when absent (step 2
 *    guarantees kind consistency; the repository re-validates the DTO
 *    and enforces key uniqueness).
 * 5. LeaderInstance mint (P8-S2, Architecture §9.2 / invariants 14/15) —
 *    the durable leader row (the honest v2 shape: no childSessionId, no
 *    lifecycle keys) is put only when absent (an idempotent re-run
 *    never writes); it requires the injected blueprint catalog — an
 *    absent catalog or an unresolvable bound blueprint is
 *    `ROOT_BINDING_LEADER_MINT_FAILED` (the mint is never defaulted).
 * 6. The binder's fresh-root path (P5-T1) — all three overlay slots
 *    installed in `OVERLAY_SLOT_ORDER` + the admission decision, on the
 *    injected `TeamAgentSetupSurface`. Any binder failure (missing
 *    record, overlay fault, …) propagates: the durable state of steps
 *    3–5 is kept BY DESIGN (DevPlan §18.5: durable commit + lost
 *    ephemeral residency is exactly the state the COLD path recovers).
 *
 * Idempotency: a re-run on a world where the session is already bound
 * (records consistent, residency live) performs ZERO durable writes and
 * returns the binder's `already-bound` no-op; a re-run after the
 * ephemeral residency was lost (process restart) re-runs the fresh
 * install on the SAME durable records (`wrote: false`) — the cold path
 * (`./cold-root.js`) is the restart-oriented alternative that restores
 * without fresh-time side effects.
 *
 * @module @dsh-agent-team/runtime/root-binding/fresh-root
 */
import type { FreshRootBindingInput, RootBindingPorts, RootBindingResult } from './types.js';
/**
 * Bind a FRESH Team root: make `input.rootSessionId` the root of a Team
 * (see the module docs for the full orchestration).
 *
 * @param ports - the injected handles (read handle, write port, surface,
 *   optional slot/guard/clock overrides).
 * @param input - the fresh-create request (branded root session id,
 *   immutable blueprint snapshot ref, optional workspace/generation).
 * @returns the result: the durable state (written or pre-existing) plus
 *   the binder's fresh-root bind result (admission decision included).
 * @throws {@link RootBindingError} (`ROOT_BINDING_INVALID_INPUT`,
 *   `ROOT_BINDING_SESSION_KIND_CONFLICT`, `ROOT_BINDING_TEAM_SESSION_CONFLICT`)
 *   before any effect; `ROOT_BINDING_LEADER_MINT_FAILED` after the
 *   record + binding commits (the mint is never defaulted); a
 *   repository/seam write error or a binder error
 *   after the durable commit (fail-closed; see module docs).
 */
export declare function bindFreshTeamRoot(ports: RootBindingPorts, input: FreshRootBindingInput): Promise<RootBindingResult>;
//# sourceMappingURL=fresh-root.d.ts.map