/**
 * A5M2 B-ORCHESTRATION execution-arm closure pins (records 47/48): the
 * DECLARED_INACTIVE completion is TYPED, CLOSED, and FLIP-FREE — the
 * refusal is the governance until the supply gate's PUBLIC facts land.
 * Author-side only: no boot, no Host, no engine, no delegate. This spec
 * proves the block ships NO door: every surface is frozen data or a
 * typed refusal, for family names AND strangers.
 */
import { describe, it, expect } from 'vitest'
import {
  A5_B_ORCH_EXEC_RECORDS,
  A5_B_ORCH_EXEC_STATES,
  A5_B_ORCH_EXEC_SUPPLY_GATE,
  refuseBOrchExecution,
} from '../src/plugin/live/governed-families/workflow-execution-consumer.mjs'

describe('A5M2 B-ORCH execution arms: typed DECLARED_INACTIVE (47/48)', () => {
  it('both records exist, each DECLARED_INACTIVE with the fresh-cited engine face', () => {
    expect(A5_B_ORCH_EXEC_RECORDS).toEqual(['workflow', 'ralph'])
    for (const name of A5_B_ORCH_EXEC_RECORDS) {
      const st = A5_B_ORCH_EXEC_STATES[name]
      expect(st.state).toBe('DECLARED_INACTIVE')
      expect(st.reasonCode).toBe('P_B_ORCH_EXEC_UNLANDABLE_RUN_CONTROL')
      // the citations are the RECHECK facts (abstract start() face @639ed01539)
      expect(st.citations.join('\n')).toContain('abstract start(request: WorkflowStartRequest): WorkflowRun')
      expect(st.citations.join('\n')).toContain('ctx.workflowEngine.start')
    }
    expect(A5_B_ORCH_EXEC_STATES.workflow.record).toBe(47)
    expect(A5_B_ORCH_EXEC_STATES.ralph.record).toBe(48)
  })
  it('ralph ZERO-FLIP restated as fact only: declared_mount + host-preset-off, and NO flip surface exists anywhere on the module', () => {
    expect(A5_B_ORCH_EXEC_STATES.ralph.mountCondition).toContain('declared_mount')
    expect(A5_B_ORCH_EXEC_STATES.ralph.mountCondition).toContain('host-preset-off')
    // flip-free by SHAPE: the module exports exactly the closed records,
    // the states, the gate and the refusal — no enable/flip/mount/execute.
    const exported = Object.keys({
      A5_B_ORCH_EXEC_RECORDS, A5_B_ORCH_EXEC_STATES, A5_B_ORCH_EXEC_SUPPLY_GATE, refuseBOrchExecution,
    })
    expect(exported).toEqual(['A5_B_ORCH_EXEC_RECORDS', 'A5_B_ORCH_EXEC_STATES', 'A5_B_ORCH_EXEC_SUPPLY_GATE', 'refuseBOrchExecution'])
    for (const v of [A5_B_ORCH_EXEC_STATES, A5_B_ORCH_EXEC_SUPPLY_GATE]) expect(Object.isFrozen(v)).toBe(true)
  })
  it('the refusal is the ONLY execution surface: typed NO for family names AND strangers, detail carries the gate law', () => {
    for (const name of ['workflow', 'ralph']) {
      const r = refuseBOrchExecution(name)
      expect(r.ok).toBe(false)
      expect(r.code).toBe('P_B_ORCH_EXEC_UNLANDABLE_RUN_CONTROL')
      expect(r.detail).toContain('DECLARED_INACTIVE')
      expect(r.detail).toContain('this refusal IS the governance')
    }
    for (const stranger of ['web_fetch', 'team_bash', '', null, 7]) {
      const r = refuseBOrchExecution(stranger)
      expect(r.ok).toBe(false)
      expect(r.code).toBe('P_B_ORCH_EXEC_UNKNOWN_RECORD')
      expect(r.detail).toContain('no path, no guess')
    }
  })
  it('the supply gate is CLOSED frozen data naming the PUBLIC facts a paired card needs (no self-opening)', () => {
    expect(A5_B_ORCH_EXEC_SUPPLY_GATE.closed).toBe(true)
    expect(A5_B_ORCH_EXEC_SUPPLY_GATE.items.join('\n')).toContain('PUBLIC run-control interface')
    expect(A5_B_ORCH_EXEC_SUPPLY_GATE.items.join('\n')).toContain('B-ORCHESTRATION family rule')
    expect(A5_B_ORCH_EXEC_SUPPLY_GATE.items.join('\n')).toContain('a749cd4cb') // frozen adapters stay untouched beneath any future flip
    expect(Object.isFrozen(A5_B_ORCH_EXEC_SUPPLY_GATE.items)).toBe(true)
  })
})
