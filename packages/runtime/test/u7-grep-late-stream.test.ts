/**
 * u7 grep-drain — the DETERMINISTIC late-stream legs of the PRODUCTION grep row
 * (`packages/tools/search-family/src/search-backend.mjs`,
 * `createAnchoredRgSearchBackend`, mounted by the plane through
 * `search-mechanics.mjs`).
 *
 * THE HOSTED RED: census run 40397268848 (ci-full, capture 1 of 2) failed
 * `alpha5-search-backend.test.ts:517` (P8, invalid regex `(`) with
 * `expected 'walker-error' to be 'walker-invalid-pattern'`. The row read its
 * stderr buffer at `exited` (+ terminate) without waiting for the stream to
 * END; under census load rg's `regex parse error` reached the parent after the
 * death was observed, so the stderr classifier saw an empty string.
 *
 * THE SECURITY QUESTION this file answers: the same race on the COVERAGE law.
 * A walk whose stdout is complete (match records + the `summary` record, so the
 * completion proof passes) but whose stderr carries a relative
 * `Permission denied` line is a walk that SKIPPED a subtree it could not read.
 * `walkerCoverageRefusal(stderrText)` exists to refuse it. If that stderr is
 * late, a row that reads at `exited` ADMITS the partial result as complete.
 *
 * TECHNIQUE (the sibling u7-g6b lane's injected late-stream provider): the
 * provider module the row imports is replaced by a fake whose handle is the
 * real frozen streaming shape with real PassThrough pipes. `exited` resolves
 * on its own schedule; the LATE bytes are written 40 ms after `terminate()` —
 * inside every drain bound. Everything above the handle (capability probe
 * answer aside) is real row code: the real anchor, the real verifiers, the
 * real classifier, the real projection.
 *
 * Worlds: `tests/homes/u7grep-late-*` (TEST_METHODS §7), self-removed.
 */
import { once } from 'node:events'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

interface Script {
  /** written BEFORE `exited` resolves (the on-time bytes) */
  readonly onTimeStdout?: readonly string[]
  readonly onTimeStderr?: readonly string[]
  /** written 40 ms AFTER `terminate()` (the late bytes) */
  readonly lateStdout?: readonly string[]
  readonly lateStderr?: readonly string[]
  /** a stream that never ends (the drain-bound leg) */
  readonly neverEnd?: 'stdout' | 'stderr'
  /** a stream torn down WITHOUT an end (destroyed pipe) */
  readonly destroy?: 'stdout' | 'stderr'
  /** stderr ALREADY terminal before the row receives the handle (review F-1) */
  readonly preTerminalStderr?: 'end' | 'destroy'
}

interface Pipe {
  write(chunk: string): boolean
  end(): void
  destroy(): void
  listenerCount(event: string): number
  readonly readableEnded: boolean
  readonly destroyed: boolean
}

const { planRef, handles } = vi.hoisted(() => ({
  planRef: { current: null as unknown },
  handles: { all: [] as Array<{ stdout: Pipe; stderr: Pipe }> },
}))

vi.mock('../sandbox-provider/index.js', async () => {
  const { PassThrough } = await import('node:stream')
  const PID = 4194299
  // A stderr that is ALREADY terminal when the row gets the handle: a walk whose
  // (empty) diagnostic pipe finished before the row attached anything.
  const preTerminal = async (pipe: InstanceType<typeof PassThrough>, form: 'end' | 'destroy'): Promise<void> => {
    if (form === 'end') {
      const ended = once(pipe, 'end')
      pipe.resume()
      pipe.end()
      await ended
    } else {
      const closed = once(pipe, 'close')
      pipe.destroy()
      await closed
    }
  }
  const makeHandle = async (script: Script): Promise<unknown> => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const stdin = new PassThrough()
    handles.all.push({ stdout, stderr })
    if (script.preTerminalStderr !== undefined) await preTerminal(stderr, script.preTerminalStderr)
    const lease = Object.freeze({
      leaseId: 'lease-grep-late', grantFingerprint: 'sha256:grep-late', realmId: 'a5srgp-realm',
      bindingId: 'b-grep-late', memberScope: 'member/grep-late', executionKind: 'process' as const, status: 'active' as const,
    })
    // On-time bytes: in the pipe before the death is observed.
    for (const c of script.onTimeStdout ?? []) stdout.write(c)
    for (const c of script.onTimeStderr ?? []) stderr.write(c)
    // The death is observed one macrotask later, so every on-time byte has been
    // handed to the row's 'data' listener first.
    const exited = new Promise((resolve) => { setTimeout(() => resolve({ code: 0, signal: '' }), 5) })
    const deliverLate = (): void => {
      setTimeout(() => {
        for (const c of script.lateStdout ?? []) stdout.write(c)
        for (const c of script.lateStderr ?? []) stderr.write(c)
        for (const [name, pipe] of [['stdout', stdout], ['stderr', stderr]] as const) {
          if (name === 'stderr' && script.preTerminalStderr !== undefined) continue
          if (script.destroy === name) pipe.destroy()
          else if (script.neverEnd !== name) pipe.end()
        }
      }, 40)
    }
    let delivered = false
    const terminate = async (): Promise<unknown> => {
      if (!delivered) { delivered = true; deliverLate() }
      return { ok: true, value: Object.freeze({ ...lease, status: 'terminated' as const }) }
    }
    return Object.freeze({
      lease,
      processIdentity: `pid:${String(PID)}:plan-grep-late`,
      pid: PID,
      stdin,
      stdout,
      stderr,
      exited,
      terminate,
      recordCapable: true as const,
      payloadExit: Promise.resolve({ form: 'recorded', rc: 0, pid: PID }),
    })
  }
  return {
    createConfinedProcessProvider: () => ({
      probe: async (): Promise<unknown> => ({ ok: true, value: [{ subject: 'python3', verdict: 'ENFORCE-CONFIRMED' }] }),
      spawnStreaming: async (): Promise<unknown> => ({ ok: true, value: await makeHandle(planRef.current as Script) }),
    }),
  }
})

/** SEC-8 rounds: 20 by default (60 walks); the evidence run sets U7GD_REP_ROUNDS. */
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const REP_ROUNDS = Number(ENV['U7GD_REP_ROUNDS'] ?? '20')

const { confinedConf, countingSink, destroyWorldVerified, loadSearchBackendRow, newWorld, searchCall, SEARCH_TOK } = await import('./alpha5-search-harness.js')

const WORLD = newWorld('u7grep-late')
const ROOT_DIR = `${WORLD}/root`

/** rg `--json` records in the walker's own dialect (what `parseGrepMatches` reads). */
const match = (path: string, line: number): string =>
  `${JSON.stringify({ type: 'match', data: { path: { text: path }, lines: { text: `${SEARCH_TOK} here\n` }, line_number: line, absolute_offset: 0, submatches: [] } })}\n`
const SUMMARY = `${JSON.stringify({ type: 'summary', data: { elapsed_total: { secs: 0, nanos: 1, human: '0s' }, stats: { matches: 2 } } })}\n`
const MATCHES = [match('./a.ts', 1), match('./readable/b.ts', 3)]
/** THE exact coverage refusal `walkerCoverageRefusal` matches: a RELATIVE path. */
const PERMISSION_DENIED = 'rg: ./locked: Permission denied (os error 13)\n'
/** The hosted P8 shape: rg rejects `(` before walking — zero stdout bytes. */
const REGEX_PARSE_ERROR = 'rg: regex parse error:\n    (?:()\n    ^\nerror: unclosed group\n'

type Row = Awaited<ReturnType<typeof loadSearchBackendRow>>
let row: Row

beforeAll(async () => {
  row = await loadSearchBackendRow()
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(`${ROOT_DIR}/readable`, { recursive: true })
  writeFileSync(`${ROOT_DIR}/a.ts`, `${SEARCH_TOK} here\n`)
  writeFileSync(`${ROOT_DIR}/readable/b.ts`, `x\nx\n${SEARCH_TOK} here\n`)
})

afterAll(() => {
  for (const h of handles.all) { try { h.stdout.end(); h.stderr.end() } catch { /* already torn down */ } }
  destroyWorldVerified(WORLD)
})

beforeEach(() => { planRef.current = null })

async function runScript(script: Script, callId: string, overrides: Record<string, unknown> = {}) {
  planRef.current = script
  const audit: string[] = []
  const backend = row.createAnchoredRgSearchBackend({
    realmId: 'a5srgp-realm',
    rootDir: ROOT_DIR,
    confined: confinedConf(WORLD),
    observe: (line: string) => { audit.push(line) },
  })
  const { sink, writes, text } = countingSink()
  const before = handles.all.length
  const t0 = Date.now()
  const result = await backend.run(searchCall(callId, overrides) as never, { sink })
  const elapsed = Date.now() - t0
  const handle = handles.all[before]
  return { result, writes, text, audit, elapsed, handle }
}

/** Every pipe listener the row attached is given back, on every path. */
function expectNoRowListeners(handle: { stdout: Pipe; stderr: Pipe } | undefined): void {
  expect(handle, 'the leg never reached the spawn').toBeDefined()
  for (const pipe of [handle!.stdout, handle!.stderr]) {
    for (const event of ['data', 'end', 'close', 'error']) {
      expect(pipe.listenerCount(event), `a row listener on '${event}' outlived the call`).toBe(0)
    }
  }
}

describe('u7 grep-drain: the production grep row judges the WHOLE walk, not the part heard by `exited`', () => {
  it('SEC-1 stdout complete on time (matches + summary), coverage refusal on stderr 40 ms late — REFUSED walker-permission-refused, never admitted', async () => {
    const { result, writes, text, handle } = await runScript({ onTimeStdout: [...MATCHES, SUMMARY], lateStderr: [PERMISSION_DENIED] }, 'sec-1')
    // A false admit would be ok:true with the two readable matches: a partial
    // walk (the locked subtree silently skipped) presented as complete.
    expect(result.ok, `FALSE ADMIT: ${JSON.stringify(result)}`).toBe(false)
    if (result.ok === false) {
      expect(result.failure.code).toBe('walker-permission-refused')
      expect(JSON.stringify(result)).not.toContain('Permission denied')
      expect(JSON.stringify(result)).not.toContain('locked')
    }
    expect(writes()).toBe(0)
    expect(text()).toBe('')
    expectNoRowListeners(handle)
  })

  it('SEC-2 the hosted P8 shape: `regex parse error` 40 ms late, zero stdout — walker-invalid-pattern, never the generic walker-error', async () => {
    const { result, writes, handle } = await runScript({ lateStderr: [REGEX_PARSE_ERROR] }, 'sec-2', { pattern: '(' })
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.failure.code).toBe('walker-invalid-pattern')
      expect(JSON.stringify(result)).not.toContain('regex parse error')
      expect(JSON.stringify(result)).not.toContain('unclosed group')
    }
    expect(writes()).toBe(0)
    expectNoRowListeners(handle)
  })

  it('SEC-3 the whole stdout (matches + summary) 40 ms late — the completed walk is answered in full; never an empty admit', async () => {
    const { result, writes, handle } = await runScript({ lateStdout: [...MATCHES, SUMMARY] }, 'sec-3')
    // The invariant: no ok:true that claims the tree holds nothing.
    if (result.ok === true) expect(result.outcome.matches.length, 'EMPTY ADMIT of a walk that matched').toBeGreaterThan(0)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok === true) {
      expect(result.outcome.matches.map((m) => m.line)).toEqual([1, 3])
      expect(result.outcome.totalMatches).toBe(2)
    }
    expect(writes()).toBe(1)
    expectNoRowListeners(handle)
  })

  it('SEC-4 a late summary WITH a late coverage refusal — refused, the late records never reach the sink', async () => {
    const { result, writes, handle } = await runScript({ lateStdout: [...MATCHES, SUMMARY], lateStderr: [PERMISSION_DENIED] }, 'sec-4')
    expect(result.ok, `FALSE ADMIT: ${JSON.stringify(result)}`).toBe(false)
    if (result.ok === false) expect(result.failure.code).toBe('walker-permission-refused')
    expect(writes()).toBe(0)
    expectNoRowListeners(handle)
  })

  it('SEC-5 stderr that never ends: the drain is BOUNDED and its expiry is a typed refusal, never a success', async () => {
    const { result, writes, audit, elapsed, handle } = await runScript({ onTimeStdout: [...MATCHES, SUMMARY], neverEnd: 'stderr' }, 'sec-5')
    expect(result.ok, `an undrained walk was admitted: ${JSON.stringify(result)}`).toBe(false)
    if (result.ok === false) {
      expect(result.failure.code).toBe('walker-error')
      expect(result.failure.counts['drainIncomplete']).toBe(1)
    }
    expect(audit.some((l) => l.startsWith('anchored-search DRAIN-INCOMPLETE '))).toBe(true)
    expect(writes()).toBe(0)
    // one bounded drain (the cap-family 250 ms), not the walk's 60 s budget
    expect(elapsed).toBeLessThan(2_000)
    expectNoRowListeners(handle)
  })

  it('SEC-6 a stdout torn down WITHOUT an end (destroyed pipe after a summary) — refused, never admitted as complete', async () => {
    const { result, writes, handle } = await runScript({ onTimeStdout: [...MATCHES, SUMMARY], destroy: 'stdout' }, 'sec-6')
    expect(result.ok, JSON.stringify(result)).toBe(false)
    if (result.ok === false) expect(result.failure.code).toBe('walker-error')
    expect(writes()).toBe(0)
    expectNoRowListeners(handle)
  })

  it('SEC-7 control: everything on time, clean stderr — admitted exactly as before (the drain costs a clean walk nothing)', async () => {
    const { result, writes, audit, handle } = await runScript({ onTimeStdout: [...MATCHES, SUMMARY] }, 'sec-7')
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok === true) expect(result.outcome.totalMatches).toBe(2)
    expect(writes()).toBe(1)
    expect(audit.some((l) => l.includes('DRAIN-INCOMPLETE'))).toBe(false)
    expectNoRowListeners(handle)
  })

  it('F1-a stderr ALREADY ended before the row installs its watch (clean walk) — admitted; the drain bound is not paid', async () => {
    const { result, writes, audit, handle } = await runScript({ onTimeStdout: [...MATCHES, SUMMARY], preTerminalStderr: 'end' }, 'f1-a')
    expect(handle?.stderr.readableEnded, 'the leg did not pre-end stderr').toBe(true)
    // Before the F-1 fix the watch waited for an 'end' that had already fired: the
    // bound expired, and this clean walk was refused as walker-error (stderr=pending).
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok === true) expect(result.outcome.totalMatches).toBe(2)
    expect(audit.some((l) => l.includes('DRAIN-INCOMPLETE'))).toBe(false)
    expect(writes()).toBe(1)
    expectNoRowListeners(handle)
  })

  it('F1-b stderr ALREADY destroyed (no end) before the watch — typed refusal naming stderr=close, never a timeout', async () => {
    const { result, writes, audit, handle } = await runScript({ onTimeStdout: [...MATCHES, SUMMARY], preTerminalStderr: 'destroy' }, 'f1-b')
    expect(handle?.stderr.destroyed, 'the leg did not pre-destroy stderr').toBe(true)
    expect(result.ok, JSON.stringify(result)).toBe(false)
    if (result.ok === false) {
      expect(result.failure.code).toBe('walker-error')
      expect(result.failure.counts['drainIncomplete']).toBe(1)
    }
    const line = audit.find((l) => l.startsWith('anchored-search DRAIN-INCOMPLETE ')) ?? ''
    expect(line, 'the refusal must name the observed form, not a bound expiry').toContain('stdout=end stderr=close ')
    expect(writes()).toBe(0)
    expectNoRowListeners(handle)
  })

  it(`SEC-8 under repetition: ${String(REP_ROUNDS * 3)} interleaved late-coverage / late-P8 / late-summary walks, zero misjudged`, async () => {
    const wrong: string[] = []
    for (let i = 0; i < REP_ROUNDS; i += 1) {
      const a = await runScript({ onTimeStdout: [...MATCHES, SUMMARY], lateStderr: [PERMISSION_DENIED] }, `rep-a-${String(i)}`)
      if (a.result.ok !== false || a.result.failure.code !== 'walker-permission-refused') wrong.push(`a${String(i)}:${JSON.stringify(a.result)}`)
      const b = await runScript({ lateStderr: [REGEX_PARSE_ERROR] }, `rep-b-${String(i)}`, { pattern: '(' })
      if (b.result.ok !== false || b.result.failure.code !== 'walker-invalid-pattern') wrong.push(`b${String(i)}:${JSON.stringify(b.result)}`)
      const c = await runScript({ lateStdout: [...MATCHES, SUMMARY] }, `rep-c-${String(i)}`)
      if (c.result.ok !== true || c.result.outcome.totalMatches !== 2) wrong.push(`c${String(i)}:${JSON.stringify(c.result)}`)
    }
    console.info(`[u7-grep-late SEC-8] rounds=${String(REP_ROUNDS)} walks=${String(REP_ROUNDS * 3)} misjudged=${String(wrong.length)}`)
    expect(wrong).toEqual([])
  }, 600_000)
})

describe('u7 grep-drain: the shared helper reads a stream\'s OWN terminal state first (review F-1)', () => {
  const drain = async (): Promise<{ watchStreamEnd: (s: unknown) => { ended: Promise<string>, release: () => void }, awaitBounded: (p: Promise<unknown>, ms?: number) => Promise<unknown> }> =>
    (await import(new URL('../../tools/search-family/src/stream-drain.mjs', import.meta.url).href)) as never
  const fresh = async (): Promise<import('node:stream').PassThrough> => new (await import('node:stream')).PassThrough()
  const events = ['end', 'close', 'error'] as const
  const noListeners = (pipe: { listenerCount(e: string): number }): void => {
    for (const e of events) expect(pipe.listenerCount(e), `a helper listener on '${e}' survived`).toBe(0)
  }

  it('H1 already ended -> end, at once (no bound), nothing attached', async () => {
    const { watchStreamEnd, awaitBounded } = await drain()
    const pipe = await fresh()
    const ended = once(pipe, 'end'); pipe.resume(); pipe.end(); await ended
    const w = watchStreamEnd(pipe)
    noListeners(pipe)
    expect(await awaitBounded(w.ended, 1)).toBe('end')
    w.release(); w.release()
  })

  it('H2 already destroyed without an end -> close, at once', async () => {
    const { watchStreamEnd, awaitBounded } = await drain()
    const pipe = await fresh()
    const closed = once(pipe, 'close'); pipe.destroy(); await closed
    const w = watchStreamEnd(pipe)
    expect(await awaitBounded(w.ended, 1)).toBe('close')
    noListeners(pipe)
  })

  it('H3 already errored -> error, at once', async () => {
    const { watchStreamEnd, awaitBounded } = await drain()
    const pipe = await fresh()
    const swallow = (): void => {}
    pipe.on('error', swallow)
    // (`events.once` would reject on the 'error' this leg causes on purpose)
    const closed = new Promise((resolve) => { pipe.once('close', resolve) }); pipe.destroy(new Error('u7gd-F1')); await closed
    pipe.off('error', swallow)
    const w = watchStreamEnd(pipe)
    expect(await awaitBounded(w.ended, 1)).toBe('error')
    noListeners(pipe)
  })

  it('H4 a live stream still waits for its event, and release() gives every listener back (idempotent)', async () => {
    const { watchStreamEnd, awaitBounded } = await drain()
    const live = await fresh()
    const w = watchStreamEnd(live)
    expect(await awaitBounded(w.ended, 20)).toBe(null)
    for (const e of events) expect(live.listenerCount(e)).toBe(1)
    w.release(); w.release()
    noListeners(live)
    const second = await fresh()
    const w2 = watchStreamEnd(second)
    second.resume(); second.end()
    expect(await awaitBounded(w2.ended, 1_000)).toBe('end')
    w2.release()
  })
})
