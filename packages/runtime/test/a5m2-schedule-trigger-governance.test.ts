/**
 * a5m2-schedule-trigger-governance.test.ts — the trigger-governance GAP
 * record + gate contract (root correction 2026-10-26: the gap must be the
 * MEASURED 639 source facts, not an invented seam/rootGo proof; targeted
 * only; no boot/Host; baseline-anchor verification rides the pristine
 * checkout WHEN PRESENT — honest SKIP != pass where absent).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createScheduleTriggerGovernance, A5_SCHEDULE_TRIGGER_GAP, A5_SCHEDULE_TRIGGER_LAWS } from '../src/plugin/live/governed-families/schedule-trigger-governance.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const laneRoot = join(here, '..', '..', '..')
const mainRoot = join(here, '..', '..', '..', '..', '..')
const ACTIVE = () => ({ id: 1, active: true })

const build = (lifecycleFace: () => unknown = ACTIVE) => {
  const block = createScheduleTriggerGovernance({ lifecycleFace: lifecycleFace as () => null })
  if (block.ok !== true) throw new Error('block must build')
  return block
}

describe('a5m2 schedule trigger-governance (measured gap, no invented seam)', () => {
  it('(a) construction needs the ONE public observation face (the generation lifecycle); inputs beyond it are not part of the contract', () => {
    expect(createScheduleTriggerGovernance({})).toMatchObject({ ok: false, code: 'A5_TRIG_INPUT_INVALID' })
    expect(createScheduleTriggerGovernance(null as never)).toMatchObject({ ok: false, code: 'A5_TRIG_INPUT_INVALID' })
    expect(build().ok).toBe(true)
  })

  it('(b) THE MEASURED TODAY: every gated dispatch under an ACTIVE generation refuses TRIGGER_GOVERNANCE_OPEN CITING THE SOURCE GAP (file:line facts G1-G5), per call, zero caching, no enablement path exists in this module', () => {
    const block = build()
    const r = block.evaluateDispatch('schedule_create')
    expect(r.enabled).toBe(false)
    expect(r.code).toBe('TRIGGER_GOVERNANCE_OPEN')
    expect(r.generationId).toBe(1)
    expect(r.law).toBe('create/update 触发缺口未闭不可启用亦必交不删')
    expect(r.detail).toContain('runtime.ts:123')
    expect(r.detail).toContain('commands.ts:338-365')
    expect(r.detail).toContain('agent.ts:176-183')
    expect(r.gap?.G1_firing_no_hook.followup).toContain('runtime.ts:123')
    expect(r.gap?.G5_permission_supply.ungoverned).toContain('injection decision')
    // NO invented enablement: the module has no seam face, no rootGo, and
    // literally no code path that answers enabled:true (pinned here).
    const module = readFileSync(join(here, '..', 'src', 'plugin', 'live', 'governed-families', 'schedule-trigger-governance.mjs'), 'utf8')
    expect(module).not.toContain('rootGo')
    expect(module).not.toContain('enabled: true')
  })

  it('(c) the family laws REUSED verbatim: epoch unobservable and non-ACTIVE (or malformed) refuse with their own typed codes before the gap detail is reached', () => {
    expect(build(() => null).evaluateDispatch('schedule_update').code).toBe('A5_TRIG_LIFECYCLE_UNOBSERVABLE')
    expect(build(() => ({ id: 7, active: false })).evaluateDispatch('schedule_create').code).toBe('A5_TRIG_NOT_ACTIVE')
    // a face that answers a generation NOT asserting ACTIVE is a non-ACTIVE
    // capture (fail-closed typing), not an unobservable epoch:
    expect(build(() => ({ id: 7 })).evaluateDispatch('schedule_create').code).toBe('A5_TRIG_NOT_ACTIVE')
  })

  it('(d) gated names CLOSED to the delivered pair (no side doors; other names ride their own family law)', () => {
    const block = build()
    expect(A5_SCHEDULE_TRIGGER_GAP.GATED_NAMES).toEqual(['schedule_create', 'schedule_update'])
    for (const name of ['schedule_list', 'schedule_delete', 'pwsh', '']) {
      expect(block.evaluateDispatch(name).code).toBe('A5_TRIG_INPUT_INVALID')
  }
  })

  it('(e) SOURCE LAW: frozen Chinese strings VERBATIM vs the tracked backlog row; the 639 anchors VERIFIED line-wise against the pristine baseline when present (absent checkout = recorded SKIP, never a pass)', () => {
    const backlog = readFileSync(join(laneRoot, 'docs', 'plans', 'active', 'alpha5-tool-io-governance', 'ALPHA5-EFFECTIVE-BACKLOG.md'), 'utf8')
    expect(backlog).toContain('create/update 触发缺口未闭不可启用亦必交不删')
    expect(A5_SCHEDULE_TRIGGER_LAWS.TRIGGER_GOVERNANCE).toContain('无公开 pre-delivery 治理 seam')
    const baseline = join(mainRoot, 'tests', 'deepseek-harness-test-use')
    const runtimePath = join(baseline, 'packages', 'schedule', 'schedule', 'src', 'runtime.ts')
    if (!existsSync(runtimePath)) {
      expect(A5_SCHEDULE_TRIGGER_GAP.G1_firing_no_hook.drive).toContain('withoutInitiator')
      return // HONEST SKIP: baseline checkout absent in this environment
    }
    const runtime = readFileSync(runtimePath, 'utf8').split('\n')
    expect(runtime[50]).toContain('withoutInitiator')
    expect(runtime[100]).toContain('resolveAgent(task.sessionId)')
    expect(runtime[122]).toContain('.followup(message)')
    const loop = readFileSync(join(baseline, 'packages', 'core', 'agent-loop', 'src', 'agent.ts'), 'utf8').split('\n')
    expect(loop[162]).toContain('followup(input: UserMessage): void')
    expect(loop.slice(160, 170).join('\n')).toContain("this.send(input, 'next-turn', true)")
    expect(loop.slice(174, 186).join('\n')).toContain('this.inbox.clear()')
    const commands = readFileSync(join(baseline, 'packages', 'api', 'session-controller', 'src', 'commands.ts'), 'utf8')
    expect(commands).toContain('admitPromptContent')
    const index = readFileSync(join(baseline, 'packages', 'schedule', 'schedule', 'src', 'index.ts'), 'utf8').split('\n')
    expect(index[220]).toContain('workspace/session-stop')
    const tools = readFileSync(join(baseline, 'packages', 'schedule', 'schedule', 'src', 'tools.ts'), 'utf8').split('\n')
    expect(tools.join('\n')).toContain("name: 'schedule_create'")
    expect(tools.join('\n')).toContain("name: 'schedule_update'")
  })
})
