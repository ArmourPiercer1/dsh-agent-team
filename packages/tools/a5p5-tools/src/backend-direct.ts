/**
 * `a5p5-tools` Phase 2 — the DIRECT implementation side of the parity matrix:
 * the lane's own shaping of a scenario into the closed outcome shapes. It
 * speaks NO contract stages (that is the stub's plane; the parity law puts
 * the trace outside the comparable set), performs its pre-execute binding
 * check the same way the contract path refuses at `prepare`, and streams the
 * same fixture chunks into the same sink while "executing".
 *
 * Same fixture table as `backend-stub.ts`, written as a SEPARATE
 * implementation — the parity test is what proves the two agree.
 *
 * Purity: no `node:*`; the only side effect is what the injected sink does.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/backend-direct
 */

import type { BackendCall, BackendResult, BackendRunIo, ScenarioTable, ToolEffectBackend } from './backend-contract.js'
import { UNREADABLE_SETTLEMENT } from './backend-contract.js'

export function createDirectBackend(table: ScenarioTable): ToolEffectBackend {
  let executed = 0
  const backend: ToolEffectBackend = {
    backendId: 'a5p5-direct',
    lastStageTrace: [],
    execCount: () => executed,
    async run(call: BackendCall, io: BackendRunIo): Promise<BackendResult> {
      const fixture = table[call.callId]
      if (fixture === undefined) {
        return { ok: false, failure: { class: 'undetermined', code: 'scenario-missing', detail: `no fixture for call ${call.callId}` } }
      }
      // The pre-execute law leg: an unbound target refuses BEFORE any body —
      // the direct path expresses it with the same normalized failure the
      // contract path reports from `prepare`.
      if (fixture.failAt === 'probe' || fixture.failAt === 'prepare') {
        return { ok: false, failure: fixture.failure ?? { class: 'denied', code: 'fs-prepare-denied', detail: 'binding refused before execute' } }
      }
      executed += 1
      for (const chunk of fixture.chunks ?? []) {
        io.sink?.write(chunk) // ACTIVE-lease streaming; lifecycle law lives in the sink
      }
      if (fixture.outcome === undefined) {
        return { ok: false, failure: { class: 'undetermined', code: 'outcome-missing', detail: 'the scenario produced no outcome' } }
      }
      return { ok: true, outcome: fixture.outcome, settlement: fixture.settlement ?? { kind: 'completed' } }
    },
  }
  return backend
}
