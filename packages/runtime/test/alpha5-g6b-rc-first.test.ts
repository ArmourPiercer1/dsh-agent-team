/**
 * #337 STEP B — the ROW-LEVEL rc-first adjudication over injected streaming
 * handles (root order 20:12Z, items ③④⑤⑥).
 *
 * WHY INJECTION AND HOW IT IS HONEST: the forms this order lists (record
 * missing/corrupt, rc=2 with a SILENT stderr, signal death, late speech) are
 * structurally unreachable through a real rg — the launcher writes the record
 * itself, and real speech timing is a race, not a fixture. The row's ONLY
 * process boundary is the provider module (`glob-backend.mjs:177` imports
 * `createConfinedProcessProvider`; `:850` is the single spawn site), so the
 * module is mocked and everything ABOVE the handle — parsing, A4, the cap
 * gate, the frozen code table, the sink law — is real row code.
 *
 * THE FAKE CONFORMS (the #337② lesson, recorded in round-2-rework.md: a fake
 * child that does not match the real spawnStreaming shape is NOT evidence —
 * every such leg silently judged `internal-error` and the file was deleted).
 * The handle here is the real frozen shape (`provider.ts:773-786`):
 * `{ lease, processIdentity, pid, stdin, stdout, stderr, exited, terminate }`
 * — node streams, a ProviderResult from terminate, the ACTIVE-status lease
 * shape — plus the R1 additions (`recordCapable`, `payloadExit`) exactly as
 * the provider will build them. A non-conforming fake fails LOUD in these
 * legs, never silently.
 *
 * Worlds: `tests/homes/a5g6b-rcf-*` (TEST_METHODS §7), self-removed. No push.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { planRef, openStreams } = vi.hoisted(() => ({
  planRef: { current: null as unknown },
  openStreams: { all: [] as Array<{ stdout: { end(): void }; stderr: { end(): void } }> },
}))

vi.mock('../sandbox-provider/index.js', async () => {
  const { PassThrough } = await import('node:stream')
  type ExitInfo = { code: number | null; signal: string | null }
  interface Script {
    readonly stdoutChunks?: string[]
    readonly stderrChunks?: string[]
    readonly endStdout?: 'spawn' | 'terminate' | 'never'
    readonly endStderr?: 'spawn' | 'terminate' | 'never'
    readonly stderrEarlyError?: boolean
    readonly exitInfo?: ExitInfo
    readonly recordCapable?: boolean // false models the LEGITIMATE no-record form
    readonly payloadExit?: unknown
    readonly probeRefused?: boolean
    readonly spawnRefused?: boolean
  }
  const makeHandle = (script: Script): unknown => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const stdin = new PassThrough()
    for (const chunk of script.stdoutChunks ?? []) stdout.write(chunk)
    for (const chunk of script.stderrChunks ?? []) stderr.write(chunk)
    if (script.endStdout === 'spawn') stdout.end()
    if (script.endStderr === 'spawn') stderr.end()
    openStreams.all.push({ stdout, stderr }) // cleanup safety: nothing stays open past the file
    const lease = Object.freeze({
      leaseId: 'lease-injected', grantFingerprint: 'sha256:injected', realmId: 'a5glb-realm',
      bindingId: 'b-inj', memberScope: 'member/inj', executionKind: 'process' as const, status: 'active' as const,
    })
    const terminate = async (): Promise<unknown> => {
      // the wind-down the real transport owes: the supervised death ends the pipes
      if (script.stderrEarlyError === true) stderr.destroy(new Error('injected stream error'))
      else if (script.endStderr === 'terminate') stderr.end()
      if (script.endStdout === 'terminate') stdout.end()
      return { ok: true, value: Object.freeze({ ...lease, status: 'terminated' as const }) }
    }
    const fields: Record<string, unknown> = {
      lease,
      processIdentity: 'pid:4194302:plan-injected',
      pid: 4194302,
      stdin,
      stdout,
      stderr,
      exited: Promise.resolve(script.exitInfo ?? { code: 0, signal: null }),
      terminate,
    }
    if (script.recordCapable !== false) {
      fields.recordCapable = true
      fields.payloadExit = Promise.resolve(script.payloadExit)
    }
    return Object.freeze(fields)
  }
  return {
    createConfinedProcessProvider: () => ({
      probe: async (): Promise<unknown> => (planRef.current as Script)?.probeRefused === true
        ? { ok: false, error: { code: 'SANDBOX_UNAVAILABLE', message: 'injected probe refusal' } }
        : { ok: true, value: [{ subject: 'python3', verdict: 'ENFORCE-CONFIRMED' }] },
      spawnStreaming: async (): Promise<unknown> => {
        const script = planRef.current as Script
        if (script.spawnRefused === true) return { ok: false, error: { code: 'SANDBOX_UNAVAILABLE', message: 'injected spawn refusal' } }
        return { ok: true, value: makeHandle(script) }
      },
    }),
  }
})

const { confinedConf, destroyWorldVerified, globCall, loadGlobBackendRow, newWorld } = await import('./alpha5-glob-harness.js')

const WORLD = newWorld('a5g6b-rcf')
const ROOT_DIR = `${WORLD}/root`
const NOTE = 'rg: locked: Permission denied (os error 13)'
const RECORD_OK = { form: 'recorded', rc: 0, pid: 4194302 }

let row: Awaited<ReturnType<typeof loadGlobBackendRow>>
let observed: string[]
let written: string[]

function makeBackend(): ReturnType<Awaited<ReturnType<typeof loadGlobBackendRow>>['createAnchoredGlobBackend']> {
  observed = []
  written = []
  return row.createAnchoredGlobBackend({
    realmId: 'a5glb-realm',
    rootDir: ROOT_DIR,
    confined: confinedConf(WORLD),
    observe: (line: string) => { observed.push(line) },
  })
}

let callN = 0
async function call(backend: ReturnType<Awaited<ReturnType<typeof loadGlobBackendRow>>['createAnchoredGlobBackend']>, pattern: string = '*.txt'): Promise<Awaited<ReturnType<typeof backend.run>>> {
  callN += 1
  const sink = { write: (s: string) => { written.push(s) } }
  return await backend.run(globCall(`rcf-${String(callN)}`, pattern) as never, { sink })
}

beforeAll(async () => {
  row = await loadGlobBackendRow()
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(ROOT_DIR, { recursive: true })
  writeFileSync(`${ROOT_DIR}/a.txt`, 'A\n')
  writeFileSync(`${ROOT_DIR}/b.txt`, 'B\n')
})

afterAll(() => {
  for (const s of openStreams.all) { try { s.stdout.end(); s.stderr.end() } catch { /* already closed */ } }
  destroyWorldVerified(WORLD)
})

beforeEach(() => {
  planRef.current = null
})

describe('a5g6b rc-first (row level) — the trusted record rules; SPEECH is a witness', () => {
  it('rc=0 silent admits the list (the control; framing/A4/sink all real)', async () => {
    planRef.current = { stdoutChunks: ['./a.txt\0', './b.txt\0'], endStdout: 'terminate', endStderr: 'terminate', payloadExit: RECORD_OK }
    const r = await call(makeBackend())
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (r.ok !== true) return
    expect(r.outcome.files).toEqual(['a.txt', 'b.txt'])
    expect(written).toEqual(['a.txt\0b.txt\0']) // the one sink write carries exactly the admitted list
  })

  it('rc=0 + stderr speech FLIPS to admitted (the 24/51 misjudgment class; note stays off the wire, observable on the internal face)', async () => {
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], stderrChunks: [NOTE], endStdout: 'terminate', endStderr: 'terminate',
      payloadExit: RECORD_OK,
    }
    const r = await call(makeBackend())
    expect(r.ok, `old-form SPEECH verdict would refuse: ${JSON.stringify(r)}`).toBe(true)
    if (r.ok !== true) return
    expect(r.outcome.files).toEqual(['a.txt'])
    expect(JSON.stringify(r)).not.toContain('Permission denied') // foreign words never ride the ok verdict
    expect(observed.some((l) => l.includes('walker-note'))).toBe(true) // demoted to a witness, still witnessed
    expect(observed.some((l) => l.includes('walker-error'))).toBe(false)
  })

  it('rc=1 is the legitimate EMPTY result (no speech), and rc=1 + note is admitted too', async () => {
    planRef.current = { endStdout: 'terminate', endStderr: 'terminate', payloadExit: { form: 'recorded', rc: 1, pid: 4194302 } }
    const r1 = await call(makeBackend())
    expect(r1.ok).toBe(true)
    if (r1.ok === true) expect(r1.outcome.files).toEqual([])

    planRef.current = {
      stderrChunks: [NOTE], endStdout: 'terminate', endStderr: 'terminate',
      payloadExit: { form: 'recorded', rc: 1, pid: 4194302 },
    }
    const r2 = await call(makeBackend(), 'nomatch-zz*')
    expect(r2.ok, JSON.stringify(r2)).toBe(true)
    if (r2.ok === true) expect(r2.outcome.files).toEqual([])
    expect(written).toEqual([]) // nothing admitted, nothing spilled
  })

  it('rc=2 with a SILENT stderr is walker-error — the form the SPEECH arm was structurally blind to (old form: ok=true + empty list claiming the subtree clean)', async () => {
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], endStdout: 'terminate', endStderr: 'terminate',
      payloadExit: { form: 'recorded', rc: 2, pid: 4194302 },
    }
    const r = await call(makeBackend())
    expect(r.ok).toBe(false)
    if (r.ok !== false) return
    expect(r.failure.code).toBe('walker-error')
    expect('outcome' in r).toBe(false) // NO list exists to flow (⑤ fail-closed)
    expect(written).toEqual([]) // and the sink saw nothing
  })

  it('rc=2 WITH speech and partial records still refuses the WHOLE result (B1 meaning, now carried by rc; sink stays empty)', async () => {
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], stderrChunks: [NOTE], endStdout: 'terminate', endStderr: 'terminate',
      payloadExit: { form: 'recorded', rc: 2, pid: 4194302 },
    }
    const r = await call(makeBackend())
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.failure.code).toBe('walker-error')
    expect(written).toEqual([])
  })

  it('every rc outside {0,1,2} fail-closes to the frozen exit-coded entry: -9 (signal death), 137, 3 — never a stream guess, never success', async () => {
    for (const rc of [-9, -15, 137, 3] as const) {
      planRef.current = {
        stdoutChunks: ['./a.txt\0'], endStdout: 'terminate', endStderr: 'terminate',
        payloadExit: { form: 'recorded', rc, pid: 4194302 },
      }
      const r = await call(makeBackend())
      expect(r.ok, `rc=${String(rc)}`).toBe(false)
      if (r.ok === false) expect(r.failure.code, `rc=${String(rc)}`).toBe('walker-exit')
    }
    expect(written).toEqual([])
  })

  it('a promised record that is missing / malformed / pid-mismatched fails CLOSED to the typed entry — the should-be-present-and-missing form is RED here, never a silent fallback to stream success', async () => {
    for (const bad of [
      { form: 'missing' },
      { form: 'unparsable', reason: 'malformed' },
      { form: 'unparsable', reason: 'oversize' },
      { form: 'pid-mismatch', recordPid: 4_194_295 },
    ] as const) {
      planRef.current = {
        stdoutChunks: ['./a.txt\0'], endStdout: 'terminate', endStderr: 'terminate',
        payloadExit: bad,
      }
      const r = await call(makeBackend())
      expect(r.ok, `form=${bad.form}`).toBe(false)
      if (r.ok === false) {
        expect(r.failure.code, `form=${bad.form}`).toBe('walker-error')
        expect(JSON.stringify(r)).not.toContain('a.txt') // nothing attributed from an unattributable walk
      }
    }
    expect(written).toEqual([])
  })

  it('late speech cannot flip an admitted walk (the capture-1 race class is structurally gone when rc rules)', async () => {
    // chunks were written at spawn, the stream ENDS only at terminate: every stderr
    // data callback lands AFTER `exited` resolved — the exact window that made the
    // old verdict race. Under rc-first the verdict does not consult stderr at all.
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], stderrChunks: [NOTE], endStdout: 'terminate', endStderr: 'terminate',
      payloadExit: RECORD_OK,
    }
    const r = await call(makeBackend())
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(observed.some((l) => l.includes('walker-error'))).toBe(false)
  })

  it('the cap gate runs BEFORE rc and is byte-unchanged: rc=0 with an uncollected stdout still lands walk-too-large', async () => {
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], endStdout: 'never', endStderr: 'terminate',
      payloadExit: RECORD_OK,
    }
    const r = await call(makeBackend())
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.failure.code).toBe('walk-too-large')
  }, 30_000)

  it('a stderr that never closes does not gate the rc verdict (it is no longer the discriminator); rc=2 stays walker-error', async () => {
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], stderrChunks: [NOTE], endStdout: 'terminate', endStderr: 'never',
      payloadExit: { form: 'recorded', rc: 2, pid: 4194302 },
    }
    const r = await call(makeBackend())
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.failure.code).toBe('walker-error')
    expect(observed.some((l) => l.includes('DRAIN-INCOMPLETE'))).toBe(true) // observed honestly, not decided on
  }, 30_000)

  it('early stream ERROR on stderr is terminal for the watch and harmless once rc rules (rc=0 admits)', async () => {
    planRef.current = {
      stdoutChunks: ['./a.txt\0'], endStdout: 'terminate', endStderr: 'never', stderrEarlyError: true,
      payloadExit: RECORD_OK,
    }
    const r = await call(makeBackend())
    expect(r.ok, JSON.stringify(r)).toBe(true)
  }, 30_000)

  it('THE LEGITIMATE NO-RECORD FORM keeps the frozen SPEECH law byte-for-byte (wire-code arm + speech arm exactly as pinned pre-#337)', async () => {
    // speech present -> walker-error (the old arm, unchanged)
    planRef.current = { recordCapable: false, stderrChunks: [NOTE], endStdout: 'terminate', endStderr: 'terminate' }
    const r1 = await call(makeBackend())
    expect(r1.ok).toBe(false)
    if (r1.ok === false) expect(r1.failure.code).toBe('walker-error')

    // silent walk -> admitted (old law: quiet means clean)
    planRef.current = { recordCapable: false, stdoutChunks: ['./a.txt\0'], endStdout: 'terminate', endStderr: 'terminate' }
    const r2 = await call(makeBackend())
    expect(r2.ok, JSON.stringify(r2)).toBe(true)

    // the launcher died abnormally (wire code outside {0,1}) -> the frozen walker-exit arm
    planRef.current = { recordCapable: false, exitInfo: { code: 3, signal: null }, endStdout: 'terminate', endStderr: 'terminate' }
    const r3 = await call(makeBackend())
    expect(r3.ok).toBe(false)
    if (r3.ok === false) expect(r3.failure.code).toBe('walker-exit')
  })

  it('sandbox refusals keep their OWN channel and arms (never stream-judged): probe refusal -> confined-unavailable, spawn refusal -> confined-refused', async () => {
    planRef.current = { probeRefused: true }
    const r1 = await call(makeBackend())
    expect(r1.ok).toBe(false)
    if (r1.ok === false) expect(r1.failure.code).toBe('confined-unavailable')

    planRef.current = { spawnRefused: true }
    const r2 = await call(makeBackend())
    expect(r2.ok).toBe(false)
    if (r2.ok === false) expect(r2.failure.code).toBe('confined-refused')
  })

  it('probe6b-form 500 consecutive: the silent rc=2 partial-results form is refused 500/500 — zero quiet judgements, zero lists, zero spills', async () => {
    const backend = makeBackend()
    let quiet = 0
    let spilled = 0
    for (let i = 0; i < 500; i += 1) {
      planRef.current = {
        stdoutChunks: ['./a.txt\0'], stderrChunks: [], endStdout: 'terminate', endStderr: 'terminate',
        payloadExit: { form: 'recorded', rc: 2, pid: 4194302 },
      }
      const r = await call(backend)
      if (r.ok === true) quiet += 1
      else expect(String(r.failure?.code), `walk ${String(i)}`).toBe('walker-error')
      spilled += written.length
    }
    expect(quiet, `${String(quiet)}/500 silent-rc2 walks were judged quiet`).toBe(0)
    expect(spilled, 'a refused walk leaked into the sink').toBe(0)
  }, 180_000)
})
