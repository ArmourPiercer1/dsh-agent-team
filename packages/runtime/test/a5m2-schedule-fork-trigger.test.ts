/**
 * a5m2-schedule-fork-trigger.test.ts — the FORK's trigger-admission contract
 * (root ruling 2026-10-26; c925 CI correction: the spec imports the fork's
 * REAL BUILT SURFACE (forks/dsh-schedule/lib, emitted by the fork's own
 * package tsconfig) with its real d.ts types — no .ts-extension imports, no
 * dynamic string hiding, no fabricated constructor shape, no lazy casts.
 * The fork's package deps are declared in its package.json and supplied
 * from the existing pnpm store (scripts/provision-store-deps.mjs), so the
 * RUNTIME legs run for real here; only the static-source pins need no
 * provisioning at all.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ScheduleRuntime } from '../../../forks/dsh-schedule/lib/runtime.js'
import type { ScheduleTriggerIntent } from '../../../forks/dsh-schedule/lib/runtime.js'

const here = dirname(fileURLToPath(import.meta.url))
const forkRoot = join(here, '..', '..', '..', 'forks', 'dsh-schedule')

type Ctor = ConstructorParameters<typeof ScheduleRuntime>

interface Counters { resolve: number, followup: number, flush: number, commit: number, warns: string[] }

function harness (counters: Counters, admission?: (intent: ScheduleTriggerIntent) => boolean | Promise<boolean>) {
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
  }
  const transact = async (work: () => Promise<void>) => { await work() }
  // THE COMMIT STUB MUTATES LIKE THE REAL ONE: a one-shot delivery commits
  // status inactive, and the due filter then excludes the row (an inert
  // commit stub would re-drive the still-active row — a harness lie).
  const commit = async (committed: unknown) => { counters.commit += 1; const status = (committed as { status?: string }).status; if (typeof status === 'string') { (task as { status: string }).status = status } }
  const retention = { days: 7, records: 50 }
  return {
    // The stubs answer the PUBLIC constructor face structurally; the cast
    // only silences the parts of the Host Context type the runtime never
    // touches (agents/logger/sessionController/sessions ARE its real use).
    // ONE honest tuple for the PUBLIC constructor face (5 or 6 params —
    // the optional admission consumer joins INSIDE the tuple, never as an
    // extra spread argument).
    args: (admission === undefined
      ? [ctx, () => [task], transact, commit, retention]
      : [ctx, () => [task], transact, commit, retention, () => admission]) as unknown as Ctor,
  }
}

const settle = () => new Promise<void>((resolve) => { setTimeout(resolve, 40) })

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
    // the package boundary: tsconfig (upstream-639 conventions, scoped) +
    // store provisioning + declared deps (zero installs)
    const tsconfig = readFileSync(join(forkRoot, 'tsconfig.json'), 'utf8')
    expect(tsconfig).toContain('"allowImportingTsExtensions": true')
    expect(tsconfig).toContain('"rewriteRelativeImportExtensions": true')
    expect(tsconfig).toContain('"noEmit": true')
    const buildConfig = readFileSync(join(forkRoot, 'tsconfig.build.json'), 'utf8')
    expect(buildConfig).toContain('"outDir": "lib"')
    const runtime = readFileSync(join(forkRoot, 'src', 'runtime.ts'), 'utf8')
    const pre = runtime.indexOf("admit(admitIntent('pre-resolve'")
    const resolveAt = runtime.indexOf('this.ctx.sessionController.resolveAgent')
    const preFollow = runtime.indexOf("admit(admitIntent('pre-followup'")
    const follow = runtime.indexOf('resolved.agent.followup(message)')
    const flushAt = runtime.indexOf('this.ctx.sessions.flush')
    expect(pre).toBeGreaterThan(-1)
    expect(pre).toBeLessThan(resolveAt) // admission BEFORE resolveAgent
    expect(preFollow).toBeGreaterThan(resolveAt)
    expect(preFollow).toBeLessThan(follow) // re-check BEFORE followup
    expect(follow).toBeLessThan(flushAt) // flush stays after followup (original law)
    expect(runtime).toContain('trigger admission consumer ABSENT') // fail closed
    expect(runtime).toContain('forkDeferredUntil')
    // NO second timer: setTimeout appears in the fork only where the ORIGINAL
    // timer law already had it (the file gained ZERO new timer constructions).
    const original = readFileSync(join(here, '..', '..', '..', '..', '..', 'tests', 'deepseek-harness-test-use', 'packages', 'schedule', 'schedule', 'src', 'runtime.ts'), 'utf8')
    const count = (s: string, needle: string) => s.split(needle).length - 1
    expect(count(runtime, 'setTimeout(')).toBe(count(original, 'setTimeout('))
    const index = readFileSync(join(forkRoot, 'src', 'index.ts'), 'utf8')
    expect(index).toContain('registerTriggerAdmission')
    expect(index).toContain('() => this.triggerAdmission')
  })

  describe('runtime legs (real built surface, real store supply)', () => {
    it('(a) consumer ABSENT => no resolve, no followup, no flush, no commit; warn; row untouched', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const { args } = harness(counters)
      const rt = new ScheduleRuntime(...args)
      rt.requestDrive()
      await settle()
      expect(counters).toMatchObject({ resolve: 0, followup: 0, flush: 0, commit: 0 })
      expect(counters.warns.join('\n')).toContain('consumer ABSENT')
    })

    it('(b) pre-resolve REFUSAL => zero resolve entries, no wake, no fake success', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const { args } = harness(counters, () => false)
      const rt = new ScheduleRuntime(...args)
      rt.requestDrive()
      await settle()
      expect(counters).toMatchObject({ resolve: 0, followup: 0, flush: 0, commit: 0 })
      expect(counters.warns.join('\n')).toContain('REFUSED (pre-resolve)')
    })

    it('(c) pre-followup REFUSAL => resolve happened (allowed once) but NO followup, NO flush, NO commit (never a fake delivery); NEW consumption per phase, not once-cached', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      let calls = 0
      const { args } = harness(counters, () => { calls += 1; return calls === 1 })
      const rt = new ScheduleRuntime(...args)
      rt.requestDrive()
      await settle()
      expect(calls).toBeGreaterThanOrEqual(2)
      expect(counters.resolve).toBe(1)
      expect(counters.followup).toBe(0)
      expect(counters.flush).toBe(0)
      expect(counters.commit).toBe(0)
      expect(counters.warns.join('\n')).toContain('REFUSED (pre-followup)')
    })

    it('(d) BOTH PHASES ALLOW => exactly one wake + flush + commit, and the intent carries the REAL owner/task/destination with revision:null (never fabricated)', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const intents: ScheduleTriggerIntent[] = []
      const { args } = harness(counters, (intent: ScheduleTriggerIntent) => { intents.push(intent); return true })
      const rt = new ScheduleRuntime(...args)
      rt.requestDrive()
      await settle()
      expect(counters.followup).toBe(1)
      expect(counters.flush).toBe(1)
      expect(counters.commit).toBe(1)
      // REAL INPUTS (root consolidated card): same firingId across BOTH
      // phases; full group-record fingerprint; real per-member occurrence;
      // NO revision/taskId/groupSize/scheduledAt stand-ins.
      expect(intents.map((i) => i.phase)).toEqual(['pre-resolve', 'pre-followup'])
      const i0 = intents[0]
      const i1 = intents[1]
      expect(i0).toBeDefined()
      expect(i1).toBeDefined()
      expect(typeof i0?.firingId).toBe('string')
      expect(i0?.firingId.length).toBeGreaterThan(10)
      expect(i1?.firingId).toBe(i0?.firingId)
      expect(i0?.ownerSessionId).toBe('s-1')
      expect(i0?.destination.sessionId).toBe('s-1')
      expect(i0?.group.size).toBe(1)
      expect(i0?.group.recordsFingerprint).toMatch(/^[0-9a-f]{64}$/)
      expect(i1?.group.recordsFingerprint).toBe(i0?.group.recordsFingerprint)
      expect(i0?.group.occurrences.map((o) => o.taskId)).toEqual(['T-1'])
      expect(Date.parse(String(i0?.group.occurrences[0]?.occurrenceAt))).toBeLessThan(Date.now())
      expect('revision' in (i0 ?? {})).toBe(false)
      expect('taskId' in (i0 ?? {})).toBe(false)
      expect('groupSize' in (i0 ?? {})).toBe(false)
    })

    it('(e) FLIGHT RECLAIM: a firing that dies AFTER pre-resolve (resolve faults) tells the consumer phase:"aborted" with the SAME firingId — the taken flight is never left armed; nothing delivered', async () => {
      const counters: Counters = { resolve: 0, followup: 0, flush: 0, commit: 0, warns: [] }
      const phases: Array<{ phase: string, firingId: string }> = []
      const { args } = harness(counters, (intent: ScheduleTriggerIntent) => { phases.push({ phase: intent.phase, firingId: intent.firingId }); return intent.phase !== 'aborted' })
      // FAULT AFTER PHASE 1: resolveAgent explodes (cold-restoration fault).
      const ctx = args[0] as unknown as { sessionController: { resolveAgent: (id: string) => Promise<unknown> } }
      ctx.sessionController.resolveAgent = async (_id: string) => { throw new Error('restoration exploded') }
      const rt = new ScheduleRuntime(...args)
      rt.requestDrive()
      await settle()
      expect(phases.map((x) => x.phase)).toEqual(['pre-resolve', 'aborted'])
      expect(phases[1]?.firingId).toBe(phases[0]?.firingId)
      expect(counters).toMatchObject({ resolve: 0, followup: 0, flush: 0, commit: 0 })
    })
  })
})
