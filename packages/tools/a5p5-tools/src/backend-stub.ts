/**
 * `a5p5-tools` Phase 2 — the CONTRACT-STUB side of the parity matrix: a
 * fixture backend that speaks the C-PROC closed stage walk
 * probe → prepare → execute → terminate (INTERFACES-v1.md), reports pre-
 * execute refusals as typed C-FS failures (denied/hidden/undetermined —
 * hidden legs stay typed, never silent), and settles runs with the lease-
 * plane settlement facts. `terminate ≠ cancel`: the stage walk always ends
 * at `terminate`; the WHY of an end lives in the settlement.
 *
 * This is the shape PR3/PR4 will speak. Parity with the direct implementation
 * is claimed ONLY over the shared fixture table (`test/a5p5-parity.test.ts`).
 *
 * Purity: no `node:*`; the only side effect is what the injected sink does.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/backend-stub
 */

import type { BackendCall, BackendResult, BackendRunIo, BackendStage, ScenarioTable, ToolEffectBackend } from './backend-contract.js'

export function createContractStubBackend(table: ScenarioTable): ToolEffectBackend {
  let executed = 0
  let trace: readonly BackendStage[] = []
  const backend: ToolEffectBackend = {
    backendId: 'a5p5-contract-stub',
    get lastStageTrace() {
      return trace
    },
    execCount: () => executed,
    async run(call: BackendCall, io: BackendRunIo): Promise<BackendResult> {
      const walk: BackendStage[] = ['probe']
      const fixture = table[call.callId]
      if (fixture === undefined) {
        walk.push('terminate')
        trace = walk
        return { ok: false, failure: { class: 'undetermined', code: 'scenario-missing', detail: `no fixture for call ${call.callId}` } }
      }
      walk.push('prepare')
      if (fixture.failAt === 'probe' || fixture.failAt === 'prepare') {
        walk.push('terminate') // terminate ≠ cancel: the walk closes; the failure is the typed fact
        trace = walk
        return { ok: false, failure: fixture.failure ?? { class: 'denied', code: 'fs-prepare-denied', detail: 'binding refused before execute' } }
      }
      walk.push('execute')
      executed += 1
      for (const chunk of fixture.chunks ?? []) {
        io.sink?.write(chunk)
      }
      walk.push('terminate')
      trace = walk
      if (fixture.outcome === undefined) {
        return { ok: false, failure: { class: 'undetermined', code: 'outcome-missing', detail: 'the scenario produced no outcome' } }
      }
      return { ok: true, outcome: fixture.outcome, settlement: fixture.settlement ?? { kind: 'completed' } }
    },
  }
  return backend
}
