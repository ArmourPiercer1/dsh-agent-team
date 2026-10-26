/**
 * u7-g6b census-load flake — the DETERMINISTIC reproducer of the two hosted
 * reds (run 40386960117 `:301 files.length 0 != 100`; run 40386788330
 * `:304 bad.ok true != false`).
 *
 * THE TIMING: the provider's `exited` is the launcher's 'exit' event, and
 * Node may fire 'exit' BEFORE the child's stdio 'data' callbacks have been
 * delivered (child_process docs: "stdio streams might still be open"). Under
 * census load that window is real. A row that reads its buffers at `exited`
 * (+ terminate) without waiting for the streams to END judges a walk it has
 * not heard yet: a 105-file walk lands as `ok:true files=[]`, and an invalid
 * glob whose rg speech is still in flight (the streaming arm reads rc 2 back
 * as 0 on this host) lands as an empty SUCCESS.
 *
 * The injected handle is the real frozen streaming shape (the same fake the
 * rc-first suite uses, `alpha5-g6b-rc-first.test.ts`): `exited` resolves at
 * once and the payload's bytes arrive LATE — after terminate settles, inside
 * the row's own drain bound. Everything above the handle is real row code.
 *
 * The PRODUCTION row (`glob-backend.mjs`: stdout end-collection + rc-first)
 * answers both forms correctly; that is this file's permanent regression
 * guard. MEASURED RED before the fix (evidence
 * `dev/agent-workflow/evidence/u7-g6b-census-flake-20261026/`): the same two legs run
 * against the ARCHIVED CANDIDATE-A factory (`search-mechanics.mjs`) failed
 * with exactly the hosted shapes — `expected +0 to be 100` and an
 * `ok:true files=[]` answer to `[unclosed`. That factory is RETIRED in the
 * same change (one glob row, one walker law), so it is not a row here.
 * Worlds: `tests/homes/a5g6b-late-*` (TEST_METHODS §7), self-removed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { planRef, openStreams } = vi.hoisted(() => ({
  planRef: { current: null as unknown },
  openStreams: { all: [] as Array<{ stdout: { end(): void }; stderr: { end(): void } }> },
}))

vi.mock('../sandbox-provider/index.js', async () => {
  const { PassThrough } = await import('node:stream')
  interface Script {
    readonly lateStdout?: string[]
    readonly lateStderr?: string[]
    readonly exitCode: number
    readonly rc: number
  }
  const PID = 4194301
  const makeHandle = (script: Script): unknown => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const stdin = new PassThrough()
    openStreams.all.push({ stdout, stderr })
    const lease = Object.freeze({
      leaseId: 'lease-late', grantFingerprint: 'sha256:late', realmId: 'a5glb-realm',
      bindingId: 'b-late', memberScope: 'member/late', executionKind: 'process' as const, status: 'active' as const,
    })
    // The late delivery: the bytes the payload wrote BEFORE it died reach the
    // parent only after the death was observed — a short, bounded lag well
    // inside every row's drain budget.
    const deliverLate = (): void => {
      setTimeout(() => {
        for (const c of script.lateStdout ?? []) stdout.write(c)
        for (const c of script.lateStderr ?? []) stderr.write(c)
        stdout.end()
        stderr.end()
      }, 40)
    }
    let delivered = false
    const terminate = async (): Promise<unknown> => {
      if (!delivered) { delivered = true; deliverLate() }
      return { ok: true, value: Object.freeze({ ...lease, status: 'terminated' as const }) }
    }
    return Object.freeze({
      lease,
      processIdentity: `pid:${String(PID)}:plan-late`,
      pid: PID,
      stdin,
      stdout,
      stderr,
      exited: Promise.resolve({ code: script.exitCode, signal: null }),
      terminate,
      recordCapable: true as const,
      payloadExit: Promise.resolve({ form: 'recorded', rc: script.rc, pid: PID }),
    })
  }
  return {
    createConfinedProcessProvider: () => ({
      probe: async (): Promise<unknown> => ({ ok: true, value: [{ subject: 'python3', verdict: 'ENFORCE-CONFIRMED' }] }),
      spawnStreaming: async (): Promise<unknown> => ({ ok: true, value: makeHandle(planRef.current as Script) }),
    }),
  }
})

const { confinedConf, destroyWorldVerified, globCall, loadGlobBackendRow, newWorld } = await import('./alpha5-glob-harness.js')

const WORLD = newWorld('a5g6b-late')
const ROOT_DIR = `${WORLD}/root`
// 105 walk records in the row's own dialect (the production row's argv
// carries `--null`: NUL-terminated records)
const many = (sep: string): string[] => Array.from({ length: 105 }, (_, i) => `./many/f${String(i)}.gen${sep}`)
const RG_SPEECH = 'rg: error parsing glob \'[unclosed\': unclosed character class; missing \']\'\n'

type Row = { run: (call: never, io: unknown) => Promise<{ ok: boolean; failure?: { code?: string }; outcome?: { files?: string[]; truncated?: boolean } }> }
let production: Awaited<ReturnType<typeof loadGlobBackendRow>>

beforeAll(async () => {
  production = await loadGlobBackendRow()
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(`${ROOT_DIR}/many`, { recursive: true })
  // the production row verifies every reported entry on disk (walk attribution)
  for (let i = 0; i < 105; i++) writeFileSync(`${ROOT_DIR}/many/f${String(i)}.gen`, 'x\n')
})

afterAll(() => {
  for (const s of openStreams.all) { try { s.stdout.end(); s.stderr.end() } catch { /* already closed */ } }
  destroyWorldVerified(WORLD)
})

beforeEach(() => { planRef.current = null })

const rows: ReadonlyArray<readonly [string, string, () => Promise<Row>]> = [
  ['PRODUCTION glob-backend.mjs', '\0', async () => production.createAnchoredGlobBackend({ realmId: 'a5glb-realm', rootDir: ROOT_DIR, confined: confinedConf(WORLD) }) as unknown as Row],
]

describe('u7-g6b: a walk whose bytes arrive AFTER `exited` is judged on the whole walk', () => {
  for (const [name, sep, make] of rows) {
    it(`${name}: 105 late stdout records (rc=0) answer the honest cap — never ok:true files=[] (hosted :301)`, async () => {
      planRef.current = { lateStdout: many(sep), exitCode: 0, rc: 0 }
      const r = await (await make()).run(globCall('late-1', 'many/*.gen') as never, { sink: { write: () => {} } })
      expect(r.ok, JSON.stringify(r)).toBe(true)
      expect((r.outcome?.files ?? []).length).toBe(100)
      expect(r.outcome?.truncated).toBe(true)
    })

    it(`${name}: an invalid glob whose speech arrives late (exit read back as 0, payload rc=2) is a typed walker error — never an empty success (hosted :304)`, async () => {
      planRef.current = { lateStderr: [RG_SPEECH], exitCode: 0, rc: 2 }
      const r = await (await make()).run(globCall('late-2', '[unclosed') as never, { sink: { write: () => {} } })
      expect(r.ok, JSON.stringify(r)).toBe(false)
      expect(String(r.failure?.code)).toMatch(/walker-error|rg-walker-error|rg-exit-\d/)
    })
  }
})
