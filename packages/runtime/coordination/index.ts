/**
 * P8-S5B — the TeamOperationCoordinator: the SINGLE shared per-team
 * operation-chain seam (plan §19 Goal 3; CR-8 closure).
 *
 * Why this module exists — CR-8 found FOUR independent per-team
 * promise-chain lock maps (the action-router facade, the ActivationProvider,
 * the activity ledger's guarded commit, the P7-T3 lifecycle service) plus
 * the prober's own serialization. Each map is sound WITHIN its module, but
 * team-mutating operations that cross module boundaries can still interleave
 * (the R5 race window: two concurrent new-work consultations each re-probe
 * inline, and one consultation's post-probe re-read can land inside the
 * other probe's non-atomic replaceState delete→put gap, producing a
 * spurious NO_STATE_AFTER_REPROBE fail-closed). The fix is ONE shared
 * chain per team: every team-MUTATING operation the production root wires
 * serializes through this single map, so cross-module interleavings within
 * one team are impossible by construction.
 *
 * Shape — the P6-T1 promise-chain pattern (reused, not re-invented):
 * one promise chain per root session id; `run` appends `work` behind the
 * current tail and stores the new tail. Chains are NEVER re-entrant:
 * a second `run` for the same team from INSIDE a held critical section
 * queues behind the caller's own pending tail and deadlocks. The
 * production wiring therefore only uses strictly SEQUENTIAL acquisitions
 * (release, then re-acquire — e.g. the activity ledger's facade audit fact
 * releases the chain before its guarded commit re-acquires it) and never a
 * nested one. The ActivationProvider deliberately keeps its PRIVATE map
 * (see the production root wiring comment): sharing this chain would make
 * the router-mediated flow deadlock, which is itself the proof that every
 * production provider write already sits inside this chain's critical
 * section (provably subsumed).
 *
 * Reversibility / invariants: this module owns NO state beyond the map and
 * holds no references to Host objects; it is constructed once per
 * production root (or per test world) and torn down with its owner. No new
 * public seam: the map type is the same plain
 * `Map<string, Promise<unknown>>` the P6-T1 lock pattern already uses;
 * `run` is the coordinator's own call surface.
 *
 * @module @dsh-agent-team/runtime/coordination
 */

/**
 * The per-team promise-chain map: root session id → the chain's current
 * tail (the last scheduled work, settled to a void success so a failing
 * unit of work never poisons the chain for later work).
 */
export type TeamOperationChainMap = Map<string, Promise<unknown>>

/**
 * One team operation coordinator — the single shared per-team
 * serialization seam. Constructed once per production root (the row
 * passes {@link TeamOperationCoordinator.chains} to the action-router
 * facade, the activity ledger's guarded commit, and the lifecycle
 * service); race tests may construct one directly.
 */
export interface TeamOperationCoordinator {
  /** The shared per-team chain map (the P6-T1 lock pattern, reused). */
  readonly chains: TeamOperationChainMap
  /**
   * Run one unit of work serialized per root session id. The work runs
   * after every earlier `run` for the same team has settled (success OR
   * failure — a failing unit never poisons the chain); a concurrent `run`
   * for the SAME team from inside `work` would deadlock (chains are not
   * re-entrant) and must not be done.
   *
   * @param rootSessionId - the team (root) session id.
   * @param work - the serialized unit of work.
   * @returns the work's result (or rejection — the chain itself always
   *   continues).
   */
  run<T>(rootSessionId: string, work: () => Promise<T>): Promise<T>
}

/**
 * Create one team operation coordinator (one shared per-team chain map).
 *
 * @returns the coordinator (the map plus its `run` surface).
 */
export function createTeamOperationCoordinator(): TeamOperationCoordinator {
  const chains: TeamOperationChainMap = new Map()
  function run<T>(rootSessionId: string, work: () => Promise<T>): Promise<T> {
    const previous = chains.get(rootSessionId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(() => work())
    chains.set(rootSessionId, next.catch(() => undefined))
    return next
  }
  return { chains, run }
}
