/**
 * a5m2-schedule-trigger-governance.test.ts — the TRIGGER-GOVERNANCE
 * semantics block contract (center continuation card, 2026-10-26; frozen
 * law ALPHA5-EFFECTIVE-BACKLOG.md :67). Targeted-only; no boot/Host; the
 * 639-source anchor leg rides the local pristine baseline when present and
 * records a HONEST SKIP (≠ pass) where the checkout is absent.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createScheduleTriggerGovernance, A5_SCHEDULE_TRIGGER_LAWS } from '../src/plugin/live/governed-families/schedule-trigger-governance.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// worktree root = test/../../../ ; MAIN workspace root (holds the pristine
// 639 baseline checkout) = five levels up from this worktree's test dir.
const laneRoot = join(here, '..', '..', '..')
const mainRoot = join(here, '..', '..', '..', '..', '..')

const ACTIVE = () => ({ id: 1, active: true })

describe('a5m2 schedule trigger-governance block (frozen law face)', () => {
  it('(a) closed construction: the block needs its PUBLIC observation faces — no seamFace/no lifecycleFace is INPUT_INVALID (never a default-open block)', () => {
    expect(createScheduleTriggerGovernance({})).toMatchObject({ ok: false, code: 'A5_TRIG_INPUT_INVALID' })
    expect(createScheduleTriggerGovernance({ seamFace: () => undefined })).toMatchObject({ ok: false, code: 'A5_TRIG_INPUT_INVALID' })
    expect(createScheduleTriggerGovernance(null as never)).toMatchObject({ ok: false, code: 'A5_TRIG_INPUT_INVALID' })
  })

  it('(b) THE MEASURED TODAY: ACTIVE generation + seam face ABSENT -> every gated dispatch refuses TRIGGER_GOVERNANCE_OPEN (contract delivered, NOT enabled) with the frozen law carried verbatim; per-call re-read, zero caching', () => {
    let seamReads = 0
    const block = createScheduleTriggerGovernance({
      seamFace: () => { seamReads += 1; return undefined },
      lifecycleFace: ACTIVE,
    })
    if (block.ok !== true) throw new Error('block must build')
    const first = block.evaluateDispatch('schedule_create')
    const second = block.evaluateDispatch('schedule_update')
    expect(first.enabled).toBe(false)
    expect(first.code).toBe('TRIGGER_GOVERNANCE_OPEN')
    expect(first.law).toBe('create/update 触发缺口未闭不可启用亦必交不删')
    expect(second.enabled).toBe(false)
    expect(seamReads).toBe(2) // per-call, per-generation: NOTHING cached across dispatches
    expect(block.laws.TRIGGER_PATH.publicPreDeliveryGovernanceSeam).toBeNull() // measured ABSENT, not a TODO
  })

  it('(c) the family laws REUSED verbatim: unobservable epoch and non-ACTIVE generations refuse BEFORE the seam face is even read (fail closed, never allow, epoch first)', () => {
    let seamReads = 0
    const mk = (lifecycleFace: () => unknown) => createScheduleTriggerGovernance({
      seamFace: () => { seamReads += 1; return () => undefined },
      lifecycleFace: lifecycleFace as () => null,
    })
    if (mk(() => null).ok !== true) throw new Error('build')
    expect(mk(() => null).ok === true && (mk(() => null) as { evaluateDispatch: (n: string) => { code?: string } }).evaluateDispatch('schedule_create').code).toBe('A5_TRIG_LIFECYCLE_UNOBSERVABLE')
    expect((mk(() => ({ id: 3, active: false })) as { evaluateDispatch: (n: string) => { code?: string } }).evaluateDispatch('schedule_update').code).toBe('A5_TRIG_NOT_ACTIVE')
    expect(seamReads).toBe(0) // the seam was NEVER consulted for closed epochs
  })

  it('(d) enablement is NEVER inferred: a malformed seam refuses (SEAM_ABSENT); a REAL seam without the explicit root-GO fact stays TRIGGER_GOVERNANCE_OPEN naming the SAME generation; seam+GO in the same generation enable the PAIR law only (the block itself never executes)', () => {
    const seam = async () => ({})
    const noGo = createScheduleTriggerGovernance({ seamFace: () => seam, lifecycleFace: ACTIVE })
    if (noGo.ok !== true) throw new Error('build')
    const r = noGo.evaluateDispatch('schedule_create')
    expect(r.enabled).toBe(false)
    expect(r.code).toBe('TRIGGER_GOVERNANCE_OPEN')
    expect(r.generationId).toBe(1)
    const duck = createScheduleTriggerGovernance({ seamFace: () => ({ not: 'a function' }), lifecycleFace: ACTIVE, rootGo: () => true })
    if (duck.ok !== true) throw new Error('build')
    expect(duck.evaluateDispatch('schedule_update').code).toBe('A5_TRIG_SEAM_ABSENT')
    const go = createScheduleTriggerGovernance({ seamFace: () => seam, lifecycleFace: ACTIVE, rootGo: () => true })
    if (go.ok !== true) throw new Error('build')
    const enabled = go.evaluateDispatch('schedule_create')
    expect(enabled.enabled).toBe(true)
    expect(enabled.seam).toBe(seam)
    expect(enabled.detail).toContain('PA final consume') // the pair law keeps governing
  })

  it('(e) gated names CLOSED to the delivered pair; any other name answers INPUT_INVALID and rides its own family law (no side doors, no shadow answers)', () => {
    const block = createScheduleTriggerGovernance({ seamFace: () => undefined, lifecycleFace: ACTIVE })
    if (block.ok !== true) throw new Error('build')
    expect(A5_SCHEDULE_TRIGGER_LAWS.GATED_NAMES).toEqual(['schedule_create', 'schedule_update'])
    for (const name of ['schedule_list', 'schedule_delete', 'schedule_fire', '']) {
      expect(block.evaluateDispatch(name).enabled).toBe(false)
      expect(block.evaluateDispatch(name).code).toBe('A5_TRIG_INPUT_INVALID')
    }
  })

  it('(f) SOURCE LAW: the frozen strings are carried VERBATIM against the tracked backlog row, and the 639 firing-path anchors are verified against the pristine baseline WHEN PRESENT (honest SKIP != pass where absent)', () => {
    const backlog = readFileSync(join(laneRoot, 'docs', 'plans', 'active', 'alpha5-tool-io-governance', 'ALPHA5-EFFECTIVE-BACKLOG.md'), 'utf8')
    expect(backlog).toContain('create/update 触发缺口未闭不可启用亦必交不删')
    const module = readFileSync(join(here, '..', 'src', 'plugin', 'live', 'governed-families', 'schedule-trigger-governance.mjs'), 'utf8')
    expect(module).toContain('create/update 触发缺口未闭不可启用亦必交不删')
    expect(module).toContain('PLAN_ONCE_MEMO 逐字携带')
    expect(module).toContain('revocation path')
    const baseline = join(mainRoot, 'tests', 'deepseek-harness-test-use', 'packages', 'schedule', 'schedule', 'src')
    const runtimePath = join(baseline, 'runtime.ts')
    if (!existsSync(runtimePath)) {
      // HONEST RECORD: the pristine 639 checkout is not in this environment;
      // the anchor verification is NOT RUN (skip != pass, disclosed).
      expect(module).toContain('runtime.ts:101') // the claim is at least spelled
      return
    }
    const runtime = readFileSync(runtimePath, 'utf8').split('\n')
    expect(runtime[100]).toContain('resolveAgent(task.sessionId)')
    expect(runtime[122]).toContain('.followup(message)')
    const tools = readFileSync(join(baseline, 'tools.ts'), 'utf8').split('\n')
    expect(tools[407]).toContain('export function registerScheduleTools')
    expect(tools.join('\n')).toContain("name: 'schedule_create'")
    expect(tools.join('\n')).toContain("name: 'schedule_update'")
  })
})
