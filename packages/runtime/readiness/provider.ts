/**
 * pre-alpha3 PR-C — the CapabilityReadinessProvider (plan §C.4): the SINGLE
 * live-readiness probe surface.
 *
 * The provider answers `probe(capabilityType, name)` with the 3-state
 * verdict (`unknown | reachable | unreachable`) plus the observation
 * provenance (`source`, `observedAt`, `reason`). It is the single place the
 * four historical fact sources (plan §C.1) get unified into one live
 * observation: instead of the UI-asserted preset id, the static row
 * `environmentFacts`, the actual-mount id, and the hardcoded persona
 * substrate each feeding a different consumer, every consumer (preflight,
 * the compatibility engine, the unified runtime status, the UI projection)
 * reads ONE probe result.
 *
 * **Fail-soft contract** (plan §C.10 gate 3): a probe that CANNOT run — no
 * port registered for the capability type, or the port rejects — resolves to
 * `unknown` (the capability has not been observed), never to `unreachable`
 * and never a throw. A fresh boot / restart therefore re-probes instead of
 * assuming the capability is down. A probe that RUNS and observes the
 * capability not-live resolves to `unreachable`.
 *
 * **The observation state of an unsettled verdict** (the PF-2 tri-state,
 * 2026-09-30 — parent adjudication option A): a port MAY return a structured
 * {@link CapabilityProbeOutcome} whose `unknown` carries the
 * `observationState` — `in-flight` (a pending materialization slot exists on
 * a live session — the B5 transient window; the typed PENDING stands) or
 * `never-observed` (no fiber / pending slot / failed slot on ANY live
 * session — the structurally not-yet-applicable first-create bootstrap
 * window where the bootstrap seed's truth decides — C.2/E.6; the exemption
 * is NOT a blanket OPEN). A bare verdict, or an `unknown` without the state,
 * defaults to `in-flight`: the exemption is OBSERVED, never inferred
 * (fail-closed — a malformed structured outcome degrades to the fail-soft
 * `unknown` and can never grant the exemption).
 *
 * The provider is PURE over its injected ports: each capability type is
 * probed by a port the caller registers (the live MCP fiber state, the
 * model-state view, the runtime substrate resolver, ...). No I/O, no clock,
 * no `node:` builtins here — the ports are the I/O boundary.
 * @module @dsh-agent-team/runtime/readiness/provider
 */

import {
  assertObservationState,
  assertProbeVerdict,
  createCapabilityObservation,
  PROBE_VERDICTS,
  type CapabilityObservation,
  type CapabilityType,
  type ObservationState,
  type ProbeVerdict,
} from './types.js'
import { READINESS_ERROR_CODES } from './errors.js'
import { teamContractError } from '../../contracts/src/index.js'

/**
 * The structured result of one probe run: the 3-state verdict plus, for an
 * UNSETTLED (`unknown`) verdict, the observation state (the PF-2 tri-state,
 * 2026-09-30 — parent adjudication option A): `in-flight` (a pending
 * materialization slot exists on a live session — the B5 transient window)
 * vs `never-observed` (no fiber / pending slot / failed slot on ANY live
 * session — structurally not-yet-applicable, e.g. the team-scope server
 * before the first team exists). The state rides on the observation and is
 * consumed by the shared classifier predicate in the requirement-facts
 * layer (the probe, the creation preflight, the gate and the activation
 * step all inherit identical behavior — probe == gate, INV-9.4).
 */
export interface CapabilityProbeOutcome {
  /** The 3-state verdict of the probe run. */
  readonly verdict: ProbeVerdict
  /**
   * The observation state of an UNSETTLED verdict (see
   * {@link CapabilityObservation.observationState}). Present ONLY with
   * `unknown`; ABSENT with `unknown` = `in-flight` (the conservative
   * default — the exemption is never inferred).
   */
  readonly observationState?: ObservationState
  /**
   * An optional plugin-owned diagnostic reason (F15, plan §6: the MCP
   * production probe port carries its plugin-owned evidence codes — e.g.
   * `MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN` — into the observation provenance).
   * The domain stays 3-state: only `verdict` participates in the
   * vocabulary; `reason` is provenance (never a fingerprint input), exactly
   * like the rejection-derived reason.
   */
  readonly reason?: string
}

/**
 * One per-capability-type probe port. The port observes the live substrate
 * for one named capability and returns the 3-state verdict (synchronously or
 * asynchronously), optionally as a structured {@link CapabilityProbeOutcome}
 * carrying the observation state of an unsettled verdict. A port that CANNOT
 * observe (service absent, preset unreadable, conditional disable not
 * evaluatable) SHOULD reject — the provider maps the rejection to `unknown`
 * (fail-soft, re-probable).
 */
/**
 * A probe verdict carrying an optional plugin-owned diagnostic reason
 * (F15, plan §6: the MCP production probe port carries its plugin-owned
 * evidence codes — e.g. `MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN` — into the
 * observation provenance). The domain stays 3-state: only `verdict`
 * participates in the vocabulary; `reason` is provenance (never a
 * fingerprint input), exactly like the rejection-derived reason.
 *
 * FOLDED (2026-09-30): alias of the merged {@link CapabilityProbeOutcome}
 * (the port may also carry the observation state of an unsettled verdict
 * — the PF-2 tri-state); kept under the F15 name for source compatibility
 * with F15-side consumers.
 */
export type ProbeVerdictDetail = CapabilityProbeOutcome

export interface CapabilityProbePort {
  /** The observation source this port produces (provenance). */
  readonly source: string
  /**
   * Observe one named capability. Resolves to `reachable` (live) or
   * `unreachable` (observed down) — either as a bare verdict or as a
   * structured {@link CapabilityProbeOutcome} (alias {@link
   * ProbeVerdictDetail}) carrying the plugin-owned reason and/or the
   * observation state of an `unknown`. MAY reject (a typed probe failure —
   * the provider resolves the rejection to `unknown` with the message as
   * reason).
   */
  probe(name: string): ProbeVerdict | CapabilityProbeOutcome | Promise<ProbeVerdict | CapabilityProbeOutcome>
}

/** The injected ports of the readiness provider. */
export interface ReadinessProviderPorts {
  /** The per-capability-type probe ports (a type with no port → `unknown`). */
  readonly probes: Partial<Record<CapabilityType, CapabilityProbePort>>
  /** The ISO-8601 clock for the observation `observedAt` (never a token input). */
  readonly now: () => string
}

/** The public capability readiness probe surface (plan §C.4). */
export interface CapabilityReadinessProvider {
  /**
   * Observe one named capability. Fail-soft: a missing port or a port
   * rejection resolves to `unknown` (with the reason), never a throw.
   */
  probe(capabilityType: CapabilityType, name: string): Promise<CapabilityObservation>
  /**
   * D-3 narrowing (2026-09-30, parent adjudication — option 1): whether a
   * live probe port is REGISTERED for the given capability type — the
   * deterministic STRUCTURAL fact (a registry read; never timing- or
   * observation-count-based) that distinguishes the two `unknown` flavors
   * the fail-soft contract produces:
   *
   * - `true` — a probe exists for the type; a live `unknown` is the
   *   TRANSIENT materialization window (not observed yet — re-probe at the
   *   next boundary) and the adjudicated D-3 typed PENDING applies to its
   *   REQUIRED subjects;
   * - `false` — no probe port is registered; the type is STRUCTURALLY
   *   UNOBSERVABLE live (the documented known gap — the requirement-facts
   *   `pending` module states the scoping): a required `unknown` of such a
   *   type keeps the legacy seed-satisfied 2-state and is NEVER PENDING-
   *   blocked.
   *
   * OPTIONAL for backward compatibility: a readiness surface that does not
   * expose the query (test doubles predating it) is treated by consumers as
   * fully probeable — the conservative default that preserves the D-3
   * PENDING semantics wherever the structural fact is unavailable.
   */
  hasProbe?(capabilityType: CapabilityType): boolean
}

/**
 * Create one capability readiness provider over the injected ports.
 * @param ports - the per-type probe ports + the clock.
 * @returns the provider surface.
 */
export function createCapabilityReadinessProvider(ports: ReadinessProviderPorts): CapabilityReadinessProvider {
  return {
    async probe(capabilityType, name): Promise<CapabilityObservation> {
      const port = ports.probes[capabilityType]
      let verdict: ProbeVerdict
      let reason: string | undefined
      // The observation state of an unsettled verdict (the PF-2 tri-state —
      // the port's structured outcome; a bare verdict leaves it absent =
      // in-flight, the conservative default).
      let observationState: ObservationState | undefined
      if (port === undefined) {
        // No probe registered for this capability type: the capability has
        // NOT been observed → unknown (fail-soft, re-probable). Never
        // unreachable (that means "a probe observed it down").
        verdict = PROBE_VERDICTS.unknown
        reason = `${READINESS_ERROR_CODES.NO_PROBE_PORT}: no probe port for capability type '${capabilityType}'`
      } else {
        try {
          const result = await port.probe(name)
          if (typeof result === 'string') {
            verdict = assertProbeVerdict(result, 'probe result')
          } else {
            // FOLDED (2026-09-30): the port carried a structured outcome —
            // the plugin-owned reason (F15, plan §6: provenance, never a
            // fingerprint input; the domain stays 3-state) and/or the
            // observation state of an unsettled verdict (PF-2 tri-state).
            verdict = assertProbeVerdict(result.verdict, 'probe result.verdict')
            if (result.reason !== undefined) reason = result.reason
            if (result.observationState !== undefined) {
              if (verdict !== PROBE_VERDICTS.unknown) {
                throw teamContractError(
                  'MALFORMED_DTO',
                  'observationState is only defined for the unknown verdict at probe result.observationState',
                  { path: 'probe result.observationState', problem: 'observationState with a settled verdict' },
                )
              }
              observationState = assertObservationState(result.observationState, 'probe result.observationState')
            }
          }
        } catch (error) {
          // The probe ran but rejected: a typed probe failure → unknown
          // (fail-soft, re-probable) carrying the message as the reason.
          verdict = PROBE_VERDICTS.unknown
          observationState = undefined
          reason = `${READINESS_ERROR_CODES.PROBE_REJECTED}: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      return createCapabilityObservation({
        capabilityType,
        capabilityName: name,
        verdict,
        source: port?.source ?? 'readiness',
        observedAt: ports.now(),
        reason,
        observationState,
      })
    },
    hasProbe(capabilityType): boolean {
      // The single source of truth for probeability: the probe-port
      // registry itself (the D-3 narrowing, 2026-09-30 — parent
      // adjudication option 1). Consumers (the requirement-facts
      // classifier and the s6 probe drop-filter) both read this structural
      // fact through the observations the requirement-facts provider
      // produces — no duplicated type lists anywhere downstream.
      return ports.probes[capabilityType] !== undefined
    },
  }
}
