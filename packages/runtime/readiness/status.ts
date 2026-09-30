/**
 * pre-alpha3 PR-C — the unified runtime capability status (plan §C.5): the
 * EPHEMERAL 4-axis view of one capability (policy / supply / readiness /
 * materialization) + the closed materialization vocabulary.
 *
 * The four axes:
 *
 * - `policy` — the durable decision for the capability cell (allowed /
 *   denied / the lane is unavailable — the effective-policy read plane);
 * - `supply` — whether the capability is configured / available to mount;
 * - `readiness` — the 3-state live probe verdict (the {@link ./types.js}
 *   `unknown | reachable | unreachable`);
 * - `materialization` — the EPHEMERAL mount state (the closed four-state
 *   below).
 *
 * The whole view is EPHEMERAL (plan §C.5): it is the current in-memory
 * state of one live team, rebuilt from liveness + the first post-restart
 * reconcile/probe. A capability with no live observation (a cold member) is
 * `not-applicable` — DERIVED FROM LIVENESS, never a persisted fabricated
 * failure. The DURABLE record of a capability transition is the separate
 * `capability-runtime-event` telemetry (the {@link ./telemetry.js} writer);
 * the status is the live view, not the ledger.
 *
 * The materialization vocabulary (`not-applicable | pending | mounted |
 * failed`) is introduced here — it exists nowhere else in the codebase.
 * Derivation (plan §C.5/§C.6):
 *
 * - `not-applicable` — the member is COLD (no live agent handle): there is
 *   nothing mounted and nothing to observe (a cold member's capabilities are
 *   not-applicable, never `failed`);
 * - `pending` — the member is resuming, or resident but the reconcile has
 *   not yet mounted the capability (it will be probed at the next boundary);
 * - `mounted` — a live fiber is mounted (resident + mounted slot);
 * - `failed` — the mount failed (an isolated per-server failure slot,
 *   retried after the cooldown).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/readiness/status
 */

/**
 * The closed materialization vocabulary (plan §C.5). The EPHEMERAL mount
 * state of one capability — distinct from the 3-state probe verdict (the
 * reachability) and from a persisted failure.
 */
export const MATERIALIZATION_STATES = {
  /** The member is cold (no live agent): nothing mounted, nothing to observe. */
  notApplicable: 'not-applicable',
  /** Resuming, or resident-but-not-yet-mounted: it will be probed at the next boundary. */
  pending: 'pending',
  /** A live fiber is mounted (resident + mounted). */
  mounted: 'mounted',
  /** The mount failed (an isolated per-server failure slot, retried after the cooldown). */
  failed: 'failed',
} as const

/** One of the closed materialization states. */
export type MaterializationStatus = (typeof MATERIALIZATION_STATES)[keyof typeof MATERIALIZATION_STATES]

/** Every materialization value, for closed-set membership tests. */
export const MATERIALIZATION_STATE_VALUES: readonly string[] = Object.values(MATERIALIZATION_STATES)

/**
 * The liveness of the member the capability is observed for (the input to
 * the materialization derivation). A cold member (no live agent) is
 * `not-applicable`; a resuming member is `pending`; a resident member is
 * `mounted`/`failed` per the reconcile slot.
 */
export const MEMBER_LIVENESS = {
  /** No live agent handle (the member is not running). */
  cold: 'cold',
  /** The agent is being resumed (no fiber yet — it will be mounted). */
  resuming: 'resuming',
  /** The agent is live (resident). */
  resident: 'resident',
} as const

/** One of the closed member-liveness states. */
export type MemberLiveness = (typeof MEMBER_LIVENESS)[keyof typeof MEMBER_LIVENESS]

/** The durable decision axis (the effective-policy read-plane outcome). */
export const POLICY_AXIS = {
  /** The capability cell is allowed by the durable policy. */
  allowed: 'allowed',
  /** The capability cell is denied by the durable policy. */
  denied: 'denied',
  /** The policy lane is unavailable (the read plane could not resolve it). */
  unavailable: 'unavailable',
} as const

/** One of the closed policy-axis states. */
export type PolicyAxis = (typeof POLICY_AXIS)[keyof typeof POLICY_AXIS]

/** The supply axis (whether the capability is configured / available). */
export const SUPPLY_AXIS = {
  /** The capability is configured (available to mount). */
  configured: 'configured',
  /** The capability is not configured (nothing to mount). */
  unconfigured: 'unconfigured',
} as const

/** One of the closed supply-axis states. */
export type SupplyAxis = (typeof SUPPLY_AXIS)[keyof typeof SUPPLY_AXIS]

/**
 * The unified runtime capability status (plan §C.5): the ephemeral 4-axis
 * view of one capability.
 */
export interface RuntimeCapabilityStatus {
  /** The capability kind (the closed §27.1 vocabulary). */
  readonly capabilityType: string
  /** The named capability. */
  readonly capabilityName: string
  /** The durable decision axis. */
  readonly policy: PolicyAxis
  /** The supply axis. */
  readonly supply: SupplyAxis
  /** The 3-state live probe verdict. */
  readonly readiness: 'unknown' | 'reachable' | 'unreachable'
  /** The ephemeral mount state (the closed four-state). */
  readonly materialization: MaterializationStatus
}

/** The materialization slot the reconcile maintains (a `mounted`/`failed` entry). */
export interface MaterializationSlot {
  readonly status: 'mounted' | 'failed'
  readonly attempts?: number
  readonly lastAttemptAt?: number
  readonly reason?: string
}

/**
 * Derive the materialization state from the member's liveness + the
 * per-capability reconcile slot (plan §C.5/§C.6).
 *
 * - cold → `not-applicable` (derived from liveness, never a fabricated
 *   failure);
 * - resuming → `pending` (it will be mounted);
 * - resident → `mounted` (a live fiber) / `failed` (an isolated failure
 *   slot) / `pending` (the reconcile has not yet run for this capability).
 * @param args - the member liveness + the reconcile slot (if any).
 * @returns the closed materialization state.
 */
export function deriveMaterializationStatus(args: {
  readonly liveness: MemberLiveness
  readonly slot?: MaterializationSlot
}): MaterializationStatus {
  if (args.liveness === MEMBER_LIVENESS.cold) return MATERIALIZATION_STATES.notApplicable
  if (args.liveness === MEMBER_LIVENESS.resuming) return MATERIALIZATION_STATES.pending
  // resident: the reconcile slot decides.
  if (args.slot !== undefined && args.slot.status === 'mounted') return MATERIALIZATION_STATES.mounted
  if (args.slot !== undefined && args.slot.status === 'failed') return MATERIALIZATION_STATES.failed
  return MATERIALIZATION_STATES.pending
}
