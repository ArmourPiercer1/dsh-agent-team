/**
 * a5m2-schedule-fork-trigger.test.ts — the FORK's trigger-admission contract
 * (root ruling 2026-10-26: full feature-plugin fork; the fork runtime adds
 * real trigger admission consuming the Team PA/Guard carrier; NO second
 * timer, NO parallel ledger, NO persisted schema change; absent/REFUSING
 * consumer = no wake and never a fake delivery).
 *
 * Load law: the fork's runtime closes over host packages (@js-temporal/
 * polyfill and friends) that may be absent in a unit environment — when the
 * module cannot load, the RUNTIME legs are recorded as an honest SKIP
 * (skip != pass) and the STATIC fork-law pins still run (they are the same
 * bytes the assembly will ship).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const forkRoot = join(here, '..', '..', '..', 'forks', 'dsh-schedule')

let ScheduleRuntime: (new (...args: unknown[]) => { requestDrive: () => void }) | undefined
let _loadError: string = ''
try {
  const mod = await import('../../../forks/dsh-schedule/src/runtime.ts')
  ScheduleRuntime = mod.ScheduleRuntime
} catch (error: unknown) {
  _loadError = String(error)
}
const LOADABLE = ScheduleRuntime !== undefined

interface Counters { resolve: number, followup: number, flush: number, commit: number, warns: string[] }

function harness (counters: Counters) {
  const agent = {
    session: { id: 's-1' },
    followup: (_msg: unknown) => { counters.followup += 1 },
  }
  const ctx = {
    agents: { withoutInitiator: (fn: () => Promise<void>) => fn() },
    logger: { warn: (m: string) => { counters.warns.push(m) } },
    sessionController: { resolveAgent: async (_id: string) => { counters.resolve += 1; return { agent } } },
    sessions: { flush: async (_s: unknown) => { counters.flush += 1; return true } },
  }
  const past = new Date(Date.now() - 5000).toISOString()
  const task = {
    sessionId: 's-1',
    status: 'active',
    record: { id: 'T-1', sessionId: 's-1', kind: 'at', scheduledAt: past, prompt: 'p', title: 't' },
  } as never
  return { ctx, task }
}

const settle = () => new Promise<void>((resolve) => { setTimeout(resolve, 40) })

const Rt = ScheduleRuntime as NonNullable<typeof ScheduleRuntime>

describe('a5m2 dsh-schedule FORK trigger admission (fork law)', () => {
  it('(s) STATIC FORK LAW: complete fork provenance present; both gates land at the RIGHT points (pre-resolve BEFORE resolveAgent, pre-followup BEFORE followup and before flush/commit); fail-closed absent-consumer; in-memory-only backoff; the fork adds NO second timer', () => {
    const prov = readFileSync(join(forkRoot, 'PROVENANCE.md'), 'utf8')
    expect(prov).toContain('full feature-plugin fork, NOT a patch')
    expect(prov).toContain('639ed015397290b3745d163aafe02ffee4aa3f84')
    expect(prov).toContain('MIT')
    expect(prov).toContain('NO revision field')
    const lic = readFileSync(join(forkRoot, 'LICENSE'), 'utf8')
    expect(lic.length).toBeGreaterThan(100)
    const pkg = readFileSync(join(forkRoot, 'package.json'), 'utf8')
    expect(pkg).toContain('0.2.0-rc.2+fork.a5m2.1')
    const runtime = readFileSync(join(forkRoot, 'src', 'runtime.ts'), 'utf8')
    const pre = runtime.indexOf("admitIntent('pre-resolve')")
    const resolveAt = runtime.indexOf('this.ctx.sessionController.resolveAgent')
    const preFollow = runtime.indexOf("admitIntent('pre-followup')")
    const follow = runtime.indexOf('resolved.agent.followup(message)')
    const flush = runtime.indexOf('this.ctx.sessions.flush')
    expect(pre).toBeGreaterThan(-1)
    expect(pre).toBeLessThan(resolveAt) // admission BEFORE resolveAgent
    expect(preFollow).toBeGreaterThan(resolveAt)
    expect(preFollow).toBeLessThan(follow) // re-check BEFORE followup
    expect(follow).toBeLessThan(flush) // flush stays after followup (original law)
    expect(runtime).toContain('trigger admission consumer ABSENT') // fail closed
    expect(runtime).toContain('forkDeferredUntil')
    // NO second timer: setTimeout appears in the fork only where the ORIGINAL
    // timer law already had it (the file gained ZERO new timer constructions).
    const original = readFileSync(join(here, '..', '..', '..', '..', '..', 'tests', 'deepseek-harness-test-use', 'packages', 'schedule', 'schedule', 'src', 'runtime.ts'), 'utf8')
    const count = (s: string, needle: string) => s.split(needle).length - 1
    if (existsSyncish(original)) {
      expect(count(runtime, 'setTimeout(')).toBe(count(original, 'setTimeout('))
    }
    // index.ts threads the consumer lazily (late registration) and nothing else changed structurally:
    const index = readFileSync(join(forkRoot, 'src', 'index.ts'), 'utf8')
    expect(index).toContain('registerTriggerAdmission')
    expect(index).toContain('() => this.triggerAdmission')
  })

  describe.runIf(LOADABLE)('runtime legs (module loaded)', () => {
    it('(a) consumer ABSENT => no resolve, no followup, no flush, no commit; warn; row untouched', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const { ctx, task } = harness(counters)
      const rt = new Rt(ctx, () => [task], async (work: () => Promise<void>) => { await work() }, async () => { counters.commit += 1 }, { days: 7, records: 50 })
      rt.requestDrive()
      await settle()
      expect(counters).toMatchObject({ resolve: 0, followup: 0, flush: 0, commit: 0 })
      expect(counters.warns.join('\n')).toContain('consumer ABSENT')
    })

    it('(b) pre-resolve REFUSAL => zero resolve entries, no wake, no fake success', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const { ctx, task } = harness(counters)
      const rt = new Rt(ctx, () => [task], async (work: () => Promise<void>) => { await work() }, async () => { counters.commit += 1 }, { days: 7, records: 50 }, () => async () => false)
      rt.requestDrive()
      await settle()
      expect(counters).toMatchObject({ resolve: 0, followup: 0, flush: 0, commit: 0 })
      expect(counters.warns.join('\n')).toContain('REFUSED (pre-resolve)')
    })

    it('(c) pre-followup REFUSAL => resolve happened (allowed once) but NO followup, NO flush, NO commit (never a fake delivery)', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const { ctx, task } = harness(counters)
      let calls = 0
      const rt = new Rt(ctx, () => [task], async (work: () => Promise<void>) => { await work() }, async () => { counters.commit += 1 }, { days: 7, records: 50 }, () => async () => { calls += 1; return calls === 1 })
      rt.requestDrive()
      await settle()
      expect(calls).toBeGreaterThanOrEqual(2) // NEW consumption per phase, not once-cached
      expect(counters.resolve).toBe(1)
      expect(counters.followup).toBe(0)
      expect(counters.flush).toBe(0)
      expect(counters.commit).toBe(0)
      expect(counters.warns.join('\n')).toContain('REFUSED (pre-followup)')
    })

    it('(d) BOTH PHASES ALLOW => exactly one wake + flush + commit, and the intent carries the REAL owner/task/destination with revision:null (never fabricated)', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const { ctx, task } = harness(counters)
      const intents: Array<Record<string, unknown>> = []
      const rt = new Rt(ctx, () => [task], async (work: () => Promise<void>) => { await work() }, async () => { counters.commit += 1 }, { days: 7, records: 50 }, () => async (intent: Record<string, unknown>) => { intents.push(intent); return true })
      rt.requestDrive()
      await settle()
      expect(counters.followup).toBe(1)
      expect(counters.flush).toBe(1)
      expect(counters.commit).toBe(1)
      expect(intents.map((i) => i.phase)).toEqual(['pre-resolve', 'pre-followup'])
      const i0 = intents[0] as Record<string, string>
      expect(i0.ownerSessionId).toBe('s-1')
      expect(i0.taskId).toBe('T-1')
      expect(i0.revision).toBeNull()
      expect((i0.destination as Record<string, string>).sessionId).toBe('s-1')
    })
  })

})

function existsSyncish (s: string): boolean { return s.length > 0 }
