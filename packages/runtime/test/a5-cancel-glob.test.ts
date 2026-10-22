/**
 * a5-cancel (glob leg) — the same cancel law, told in the GLOB row's words.
 *
 * The mechanics are shared with the search row through `cancel-leg.mjs`; the
 * WORDS and the shapes belong to this row: a cancelled glob is a typed FAILURE
 * built by `GLOB_REFUSAL_TEXT` / `GLOB_REFUSAL_FAMILIES` through this row's own
 * `failure()` face, its audit line is grammar-clean like every line this row
 * books, and its ONE publication site (`io.sink.write`, the N3/X5 law: one
 * write, after the verdict) is never reached on a cancel path. An empty file
 * list is a statement about the tree; a cancelled walk has made no statement.
 *
 * DETERMINISM: identical to the search suite. The row books
 * `cancel-leg stage=pre-spawn-check` (it is consulting its channel at the last step
 * before it would ask for a child — the word names the instruction, so a refusal
 * there books no claim that a spawn was coming) and `stage=child-live` (the child
 * exists and this call owns it), and a leg that wants a boundary arms its abort on
 * those lines: synchronously = at the boundary, on a `queueMicrotask` = the first
 * await after it. "The cancel landed while the payload was live" is NOT a
 * `setTimeout(…, 1)` bet: `signalFiringOnSubscribe` reports the withdrawal from
 * inside the race's own `addEventListener`, which is the instant the row became
 * able to hear one with the child already adopted, and `signalFiringOnAsk` counts
 * the row's asks — one per boundary — so C4 walks this row's boundaries
 * (entry, after the rg-path lookup, capability, anchor, pre-spawn, after-spawn, the
 * settle face, both drain awaits, the shared verify, the commit) with the count for
 * the path MEASURED rather than assumed. The tie law and the stop classification are
 * driven through the shipped seams over the SAME helper this row calls, in group T
 * of the search suite; this file pins what is GLOB-specific: the words, the audit
 * grammar, the publication site, and this row's behaviour at each boundary.
 *
 * GROUP D FORGES AN ARM THAT FAILS, BELOW THIS ROW. The provider module the row
 * imports is replaced, for that group only, by a COPY of the real provider whose
 * `spawnStreaming` hands out the REAL child (real plan, real walk) with one face
 * changed: a `terminate()` that throws, counted at the arm itself. A `Proxy` cannot
 * do this — the provider's own object is `Object.freeze`d, and a `get` returning
 * another value for a frozen property is a TypeError at the trap, which the row
 * would report as `spawn-failed`. The four legs are the pair the findings asked for
 * plus the two interleavings: no channel keeps the pre-existing `internal-error`
 * contract, a withdrawn call answers `termination-unconfirmed` with zero sink, a
 * withdrawal that lands DURING the raw arm is still owned by the cancellation
 * (asked once, no second terminate), and a timeout winner whose arm throws keeps
 * the old fault contract instead of minting its `ok: true` empty list. The forged arm
 * is what the row awaits, so the real child is deliberately left un-stopped: each leg
 * hands its children back through the real `terminate` captured under the forgery and
 * requires that face to answer `status: 'terminated'`, because deleting a world is not
 * how a process is reaped.
 *
 * THE SUITE WAS SEEN RED BEFORE IT WAS SEEN GREEN: run against the row as it stood
 * at the branch point (no cancel leg), 21 of its 23 legs fail — A1 with
 * `ok: true`, the empty list the law forbids — and the two that pass are exactly the
 * two that pin behaviour the leg must not change (OBS1's provider-face calibration
 * and D1's pre-existing fault contract). Evidence:
 * `evidence/alpha5/cancel-leg/f3-glob-RED-baseline.log` (rc=1) against
 * `f3-glob-cancel-2.log` (rc=0, 23/23).
 *
 * THE SPAWN COUNTER IS THE PROVIDER'S OWN FACE (`plans/<planId>.json` +
 * `out/<planId>/` per accepted spawn, written by the provider; a capability
 * probe writes neither). OBS1 re-calibrates it here so this file stands on its
 * own; `execCount()` is a cross-check, never the evidence.
 *
 * THE SPAWN COUNTER IS THE PROVIDER'S OWN FACE (`plans/<planId>.json` +
 * `out/<planId>/` per accepted spawn, written by the provider; a capability
 * probe writes neither). OBS1 re-calibrates it here so this file stands on its
 * own; `execCount()` is a cross-check, never the evidence.
 *
 * Worlds live under `tests/homes/` and self-remove. Real launcher, real rg.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import {
  LAUNCHER,
  LAUNCHER_SHA,
  REPO,
  buildCapFixture,
  buildGlobFixture,
  destroyWorldVerified,
  globCall,
  loadGlobBackendRow,
  newWorld,
  sweepStrayWorlds,
  type GlobBackend,
  type GlobBackendResult,
  type GlobBackendRow,
} from './alpha5-glob-harness.js'

const WORLD = newWorld('a5cancel-g')
const ROOT_DIR = join(WORLD, 'root')
const SCRATCH = join(WORLD, 'scratch')
const CAP_WORLD = newWorld('a5cancel-gcap')
const CAP_ROOT = join(CAP_WORLD, 'root')
const CAP_SCRATCH = join(CAP_WORLD, 'scratch')
const REALM = 'a5cancel-realm'
const SLOW = 240_000
const REASON_CANARY = 'A5CANCEL-REASON-MUST-NEVER-TRAVEL'
/** The audit grammar this row's own adversarial suite pins (X8): verb words, then
 *  `key=token` pairs, with the family word in its closed shape. A cancel line is
 *  a line like any other, so it has to pass the same gate. */
const AUDIT_GRAMMAR = /^anchored-glob(?: [A-Za-z-]+)*(?: (?:family=a5glb-refused\/[a-z-]+|[a-zA-Z]+=[A-Za-z0-9._-]+))+$/

let row: GlobBackendRow

interface OwnedStop { stopped: boolean; confirmedBy: string | null; form: string }
interface CancelLegRow {
  CANCEL_CODE_ABORTED: string
  CANCEL_CODE_UNCONFIRMED: string
  callAborted(signal: unknown): boolean
  createOwnedStop(): { adopt(child: unknown): void; child(): unknown; stop(): Promise<OwnedStop> }
}
const cancelLeg = (await import(new URL('../src/plugin/live/cancel-leg.mjs', import.meta.url).href)) as CancelLegRow

const rowSource = (): string => readFileSync(join(REPO, 'packages/runtime/src/plugin/live/glob-backend.mjs'), 'utf8')
  .split('\n')
  .map((line) => (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*') ? '' : line.split('//')[0] ?? ''))
  .join('\n')

function makeBackend(rootDir: string, scratchRoot: string, onLine?: (line: string) => void, options: Record<string, unknown> = {}): { backend: GlobBackend; audit: string[] } {
  const audit: string[] = []
  const backend = row.createAnchoredGlobBackend({
    realmId: REALM,
    rootDir,
    confined: {
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    },
    observe: (line: string) => {
      audit.push(line)
      if (onLine !== undefined) onLine(line)
    },
    ...options,
  })
  return { backend, audit }
}

function armAt(needle: string, fire: () => void): ((line: string) => void) & { fired(): boolean } {
  let seen = false
  const observer = (line: string): void => {
    if (seen || !line.includes(needle)) return
    seen = true
    fire()
  }
  return Object.assign(observer, { fired: () => seen })
}

function countingSink(): { sink: { write(s: string): void }; writes(): number; bytes(): number; text(): string } {
  const parts: string[] = []
  return {
    sink: { write: (s: string) => { parts.push(s) } },
    writes: () => parts.length,
    bytes: () => parts.reduce((n, s) => n + s.length, 0),
    text: () => parts.join(''),
  }
}

const cancelReason = (): Error => new Error(REASON_CANARY)

async function runGlob(
  backend: GlobBackend,
  callId: string,
  pattern: string,
  signal: unknown,
): Promise<{ result: GlobBackendResult; sink: ReturnType<typeof countingSink> }> {
  const sink = countingSink()
  const base = globCall(callId, pattern) as Record<string, unknown>
  const call = signal === undefined ? base : { ...base, signal }
  const result = (await backend.run(call as never, sink)) as GlobBackendResult
  return { result, sink }
}

function providerSpawnMarks(scratchRoot: string): { plans: number; outs: number } {
  const plansDir = join(scratchRoot, 'plans')
  const outsDir = join(scratchRoot, 'out')
  return {
    plans: existsSync(plansDir) ? readdirSync(plansDir).filter((f) => f.endsWith('.json')).length : 0,
    outs: existsSync(outsDir) ? readdirSync(outsDir).length : 0,
  }
}

const openFds = (): number => readdirSync('/proc/self/fd').length

const cancelLines = (audit: readonly string[]): string[] => audit.filter((l) => l.includes('refused code=call-aborted') || l.includes('refused code=termination-unconfirmed'))

/** The channel face this row may touch, flipping the instant the row stops
 *  listening — i.e. after the settle race named its winner. `reason` absent. */
/**
 * A channel that fires AT THE INSTANT the row starts listening to it — the
 * deterministic form of "the cancel arrived while the payload was live". The race
 * asks `aborted` and only then attaches; this channel reports the withdrawal from
 * inside `addEventListener`, which is the moment the row became able to hear it,
 * with the child already adopted (the row's own `stage=child-live` line is read
 * back by the leg). `fires` repeats the notification: one caller, two aborts, one
 * attached listener.
 */
function signalFiringOnSubscribe(fires = 1): { signal: unknown; subscribed(): boolean; attaches(): number; detaches(): number } {
  let flag = false
  let adds = 0
  let removes = 0
  let left = fires
  const signal = {
    get aborted(): boolean { return flag },
    get reason(): unknown { return cancelReason() },
    addEventListener: (_type: string, listener: () => void): void => {
      adds += 1
      flag = true
      for (let i = 0; i < left; i += 1) listener()
      left = 0
    },
    removeEventListener: (_type: string, _listener: () => void): void => { removes += 1 },
  }
  return { signal, subscribed: () => adds > 0, attaches: () => adds, detaches: () => removes }
}

/**
 * A channel that counts asks and answers "aborted" from the N-th on. The row asks
 * once per boundary, so N selects a boundary exactly; the total for a path is
 * MEASURED (not guessed) by running the same call with a never-firing counter.
 */
function signalFiringOnAsk(target: number): { signal: unknown; asks(): number } {
  let asks = 0
  const signal = {
    get aborted(): boolean {
      asks += 1
      return target > 0 && asks >= target
    },
    get reason(): unknown { return cancelReason() },
    addEventListener: (_type: string, _listener: () => void): void => { /* never subscribed */ },
    removeEventListener: (_type: string, _listener: () => void): void => { /* nothing to give back */ },
  }
  return { signal, asks: () => asks }
}

async function measureChannelAsks(backend: GlobBackend, callId: string, pattern: string): Promise<number> {
  const counter = signalFiringOnAsk(0)
  const { result } = await runGlob(backend, callId, pattern, counter.signal)
  expect(result.ok, 'a channel that is asked and never fires must not change the answer').toBe(true)
  return counter.asks()
}

function signalFlippingOnRelease(): { signal: unknown; fired: () => boolean } {
  let aborted = false
  const state = {
    get aborted() { return aborted },
    addEventListener: (_kind: string, _listener: unknown) => {},
    removeEventListener: () => { aborted = true },
  }
  return { signal: state, fired: () => aborted }
}

beforeAll(async () => {
  row = await loadGlobBackendRow()
  // The harness builders write INTO a root they do not create (the existing
  // suites create theirs through `newWorld`'s parent), so the roots come first.
  mkdirSync(ROOT_DIR, { recursive: true })
  buildGlobFixture(ROOT_DIR)
  buildCapFixture(CAP_ROOT, 6_000)
}, SLOW)

afterAll(async () => {
  const reappeared = await destroyWorldVerified(WORLD) + await destroyWorldVerified(CAP_WORLD)
  expect(reappeared).toBe(0)
  expect(sweepStrayWorlds('a5cancel-g')).toEqual([])
})

describe('a5-cancel/glob OBS: the faces are calibrated before use', () => {
  it('OBS1 one accepted confined spawn = one provider plan + one out dir; a probe is neither', async () => {
    const calib = join(WORLD, 'calib')
    const provider = createConfinedProcessProvider({
      realmId: REALM,
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: calib,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect(providerSpawnMarks(calib)).toEqual({ plans: 0, outs: 0 })
    const probed = await provider.probe()
    expect(probed.ok, JSON.stringify(probed)).toBe(true)
    expect(providerSpawnMarks(calib), 'a capability probe is not a spawn').toEqual({ plans: 0, outs: 0 })
    if (probed.ok !== true) return
    const spawned = await provider.spawnStreaming({
      grantFingerprint: `a5cancel-gcalib:${Date.now().toString(36)}`,
      realmId: REALM,
      bindingId: 'a5cancel-gcalib',
      memberScope: 'member',
      argv: ['/bin/true'],
      cwd: ROOT_DIR,
      env: [['PATH', '/usr/bin:/bin']],
      allowPaths: [
        { path: '/bin', accessBits: { execute: true, readFile: true, readDir: true } },
        { path: '/usr', accessBits: { execute: true, readFile: true, readDir: true } },
        { path: '/lib', accessBits: { execute: true, readFile: true, readDir: true } },
        { path: ROOT_DIR, accessBits: { readFile: true, readDir: true } },
      ],
    })
    expect(spawned.ok, JSON.stringify(spawned)).toBe(true)
    if (spawned.ok !== true) return
    expect(providerSpawnMarks(calib)).toEqual({ plans: 1, outs: 1 })
    const stop = await spawned.value.terminate()
    expect(stop.ok).toBe(true)
    if (stop.ok === true) expect(stop.value.status).toBe('terminated')
  }, SLOW)

  it('OBS2 the two cancel codes are rows of THIS row\'s table with the cancel family word', () => {
    expect(row.GLOB_REFUSAL_TEXT[cancelLeg.CANCEL_CODE_ABORTED]).toBeTruthy()
    expect(row.GLOB_REFUSAL_TEXT[cancelLeg.CANCEL_CODE_UNCONFIRMED]).toBeTruthy()
    expect(row.GLOB_REFUSAL_FAMILIES[cancelLeg.CANCEL_CODE_ABORTED]).toBe('a5glb-refused/cancel')
    expect(row.GLOB_REFUSAL_FAMILIES[cancelLeg.CANCEL_CODE_UNCONFIRMED]).toBe('a5glb-refused/cancel')
    expect(row.GLOB_REFUSAL_TEXT[cancelLeg.CANCEL_CODE_ABORTED]).not.toBe(row.GLOB_REFUSAL_TEXT[cancelLeg.CANCEL_CODE_UNCONFIRMED])
  })
})

describe('a5-cancel/glob A: a cancel before the spawn costs zero provider work', () => {
  it('A1 pre-abort: EXACTLY code call-aborted, zero provider spawn, zero sink, no descriptor held, no reason echoed', async () => {
    const { backend } = makeBackend(ROOT_DIR, SCRATCH)
    const ac = new AbortController()
    ac.abort(cancelReason())
    const marks = providerSpawnMarks(SCRATCH)
    const fds = openFds()
    const { result, sink } = await runGlob(backend, 'ga-pre', '*.ts', ac.signal)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.class).toBe('undetermined')
    expect(result.failure.family).toBe('a5glb-refused/cancel')
    expect(result.failure.detail).toBe(row.GLOB_REFUSAL_TEXT['call-aborted'])
    expect(result.failure.counts).toEqual({ children: 0 })
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(backend.execCount()).toBe(0) // cross-check only — see the header
    expect(sink.writes()).toBe(0)
    expect(openFds()).toBeLessThanOrEqual(fds)
    expect(JSON.stringify(result)).not.toContain(REASON_CANARY)
    expect(backend.lastStageTrace).toEqual(['probe', 'cancel'])
  }, SLOW)

  it('A2 abort during the capability probe: the probe is not a spawn', async () => {
    const ac = new AbortController()
    const armed = armAt('capability OK', () => ac.abort(cancelReason()))
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-cap', '*.ts', ac.signal)
    expect(armed.fired(), 'the capability boundary was never reached').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(cancelLines(audit).some((l) => l.includes('stage=after-capability') && l.includes('children=0'))).toBe(true)
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    expect(backend.execCount()).toBe(0)
  }, SLOW)

  it('A3 abort during the anchor open: no spawn, and the pinned descriptor is back before the terminal', async () => {
    const ac = new AbortController()
    const armed = armAt('capability OK', () => { queueMicrotask(() => ac.abort(cancelReason())) })
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const fds = openFds()
    const { result, sink } = await runGlob(backend, 'ga-anchor', '*.ts', ac.signal)
    expect(armed.fired(), 'the capability boundary was never reached').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(cancelLines(audit).some((l) => l.includes('stage=after-anchor') && l.includes('children=0'))).toBe(true)
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    expect(openFds()).toBeLessThanOrEqual(fds)
  }, SLOW)

  it('A4 the last boundary before the provider is asked: a cancel there writes no plan at all', async () => {
    const ac = new AbortController()
    const armed = armAt('cancel-leg stage=pre-spawn-check', () => ac.abort(cancelReason()))
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-pre-spawn', '*.ts', ac.signal)
    expect(armed.fired(), 'the pre-spawn boundary was never booked').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(cancelLines(audit).some((l) => l.includes('stage=pre-spawn') && l.includes('children=0'))).toBe(true)
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    expect(backend.execCount()).toBe(0)
  }, SLOW)
})

describe('a5-cancel/glob B: once a child exists, the row owns its stop', () => {
  it('B1 a handle that arrives AFTER the caller gave up is adopted and stopped, not raced away', async () => {
    const ac = new AbortController()
    const armed = armAt('cancel-leg stage=pre-spawn-check', () => { queueMicrotask(() => ac.abort(cancelReason())) })
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-late', '*.ts', ac.signal)
    expect(armed.fired(), 'the pre-spawn boundary was never booked').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(backend.execCount()).toBe(1) // cross-check only
    expect(cancelLines(audit).some((l) => l.includes('stage=after-spawn') && l.includes('children=1') && l.includes('stop=terminated'))).toBe(true)
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-glob ran'))).toBe(false)
  }, SLOW)

  it('B2 an abort while the payload is live stops it and refuses — never an empty list, never a published one', async () => {
    // THE DETERMINISTIC BARRIER (review finding F5): the withdrawal is reported
    // from inside the race's own `addEventListener`, so it lands at the instant the
    // row becomes able to hear it with the child already adopted. No `setTimeout`,
    // no assumption about how long a 6000-file walk takes; `stage=child-live` in
    // the audit is the evidence the payload was live, and the tie law (a finished
    // walk outranks a cancel) is what fixes the stage word.
    const live = signalFiringOnSubscribe()
    const { backend, audit } = makeBackend(CAP_ROOT, CAP_SCRATCH)
    const marks = providerSpawnMarks(CAP_SCRATCH)
    const started = Number(process.hrtime.bigint())
    const { result, sink } = await runGlob(backend, 'ga-live', '**/*.ts', live.signal)
    const elapsedMs = (Number(process.hrtime.bigint()) - started) / 1_000_000
    expect(live.subscribed(), 'the settle race never armed itself on the channel — the leg would prove nothing').toBe(true)
    expect(audit.some((l) => l.includes('cancel-leg stage=child-live'))).toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.family).toBe('a5glb-refused/cancel')
    expect(result.failure.detail).toBe(row.GLOB_REFUSAL_TEXT['call-aborted'])
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(cancelLines(audit).some((l) => l.includes('stage=walk-aborted') && l.includes('stop=terminated'))).toBe(true)
    expect(providerSpawnMarks(CAP_SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-glob ran'))).toBe(false)
    expect(live.detaches()).toBe(live.attaches())
    expect(elapsedMs).toBeLessThan(10_000)
  }, SLOW)

  it('B3 a channel that fires twice while the payload is live yields ONE terminal and ONE stop', async () => {
    // Both notifications land inside the same `addEventListener` call — what a
    // caller who aborts twice in one tick does to an attached listener.
    const live = signalFiringOnSubscribe(2)
    const { backend, audit } = makeBackend(CAP_ROOT, CAP_SCRATCH)
    const marks = providerSpawnMarks(CAP_SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-twice', '**/*.ts', live.signal)
    expect(live.attaches(), 'the row attached more than one listener to one channel').toBe(1)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(cancelLines(audit)).toHaveLength(1)
    expect(providerSpawnMarks(CAP_SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(sink.writes()).toBe(0)
    expect(live.detaches()).toBe(live.attaches())
  }, SLOW)
})

describe('a5-cancel/glob C: the winner stands, the publication does not', () => {
  it('C1 the exit won, THEN the cancel arrived: the refusal lands at the boundary after the stop', async () => {
    const flip = signalFlippingOnRelease()
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-commit', '*.ts', flip.signal)
    expect(flip.fired(), 'the settle race never registered/removed a listener — the leg would prove nothing').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(cancelLines(audit).some((l) => l.includes('stage=after-settle'))).toBe(true)
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-glob ran'))).toBe(false)
    // The tree really did have an answer to withhold.
    const control = await runGlob(backend, 'ga-commit-control', '*.ts', undefined)
    expect(control.result.ok).toBe(true)
    if (control.result.ok !== true) return
    expect(control.result.outcome.files.length).toBeGreaterThan(0)
    expect(control.sink.writes()).toBe(1)
  }, SLOW)

  it('C2 a no-channel call and a never-fired channel are the same answer', async () => {
    // Match ORDER is normalized: rg walks in parallel and may report the same
    // tree in a different order across processes — a fact about rg that this
    // lane's own suite normalizes the same way, never a promise this row makes.
    const noChannel = makeBackend(ROOT_DIR, SCRATCH)
    const live = new AbortController()
    const withChannel = makeBackend(ROOT_DIR, SCRATCH)
    const a = await runGlob(noChannel.backend, 'ga-none', '*.ts', undefined)
    const b = await runGlob(withChannel.backend, 'ga-live-none', '*.ts', live.signal)
    expect(a.result.ok).toBe(true)
    expect(b.result.ok).toBe(true)
    if (a.result.ok !== true || b.result.ok !== true) return
    expect([...b.result.outcome.files].sort()).toEqual([...a.result.outcome.files].sort())
    expect(b.result.outcome.totalMatches).toBe(a.result.outcome.totalMatches)
    expect(b.result.outcome.truncated).toBe(a.result.outcome.truncated)
    expect(JSON.stringify(b.result.settlement)).toBe(JSON.stringify(a.result.settlement))
    expect(withChannel.backend.lastStageTrace).toEqual(noChannel.backend.lastStageTrace)
    expect(withChannel.backend.execCount()).toBe(noChannel.backend.execCount())
    expect(b.sink.bytes()).toBe(a.sink.bytes())
    expect([...b.sink.text().split('\0')].sort()).toEqual([...a.sink.text().split('\0')].sort())
    // Normalization is the instrument's job and only the instrument's: the two
    // call ids and the payload's pid (a fact of the process table, never a fact
    // about the answer) are masked; nothing else may differ.
    const strip = (lines: string[]): string[] => lines.filter((l) => !l.includes('cancel-leg stage='))
    const norm = (l: string): string => l.replace(/pid=\d+/g, 'pid=X')
    expect(strip(withChannel.audit).map((l) => norm(l.replace(/ga-live-none/g, 'X')))).toEqual(strip(noChannel.audit).map((l) => norm(l.replace(/ga-none/g, 'X'))))
    expect(noChannel.audit.some((l) => l.includes('cancel-leg stage='))).toBe(false)
  }, SLOW)

  it('C3 every line a cancelled call books obeys this row\'s audit grammar (a cancel line is a line like any other)', async () => {
    const live = signalFiringOnSubscribe()
    const { backend, audit } = makeBackend(CAP_ROOT, CAP_SCRATCH)
    const { result } = await runGlob(backend, 'ga-grammar', '**/*.ts', live.signal)
    expect(live.subscribed(), 'the row never armed itself on the channel').toBe(true)
    expect(result.ok).toBe(false)
    expect(audit.length).toBeGreaterThan(0)
    for (const line of audit) expect(line).toMatch(AUDIT_GRAMMAR)
    expect(cancelLines(audit).length).toBe(1)
  }, SLOW)


  it('C4 EVERY boundary this row asks answers with the typed refusal, and the last one stands before the single write', async () => {
    // Same instrument as the search row: the asks are counted, N selects the
    // boundary, and the count for the path is measured rather than assumed. The
    // glob row has its own list of boundaries — no rg-path ask, one more verify
    // step of its own — so this is not a copy of the other leg's numbers.
    const probe = makeBackend(ROOT_DIR, SCRATCH)
    const asks = await measureChannelAsks(probe.backend, 'ga-sweep-probe', '*.ts')
    expect(asks, 'the row asked its channel fewer times than the leg can distinguish').toBeGreaterThanOrEqual(5)
    const order = ['entry', 'after-rg-path', 'after-capability', 'after-anchor', 'pre-spawn', 'after-spawn', 'walk-aborted', 'after-settle', 'after-stdout-drain', 'after-streams-drain', 'after-payload-record', 'after-verify', 'before-commit']
    const seen: string[] = []
    for (let n = 1; n <= asks; n += 1) {
      const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
      const marks = providerSpawnMarks(SCRATCH)
      const fired = signalFiringOnAsk(n)
      const { result, sink } = await runGlob(backend, `ga-sweep-${String(n)}`, '*.ts', fired.signal)
      expect(result.ok, `ask #${String(n)} published an answer to a withdrawn call`).toBe(false)
      if (result.ok !== false) return
      expect(result.failure.code, `ask #${String(n)} answered with the wrong code`).toBe('call-aborted')
      expect(result.failure.family).toBe('a5glb-refused/cancel')
      expect(sink.writes(), `ask #${String(n)} wrote to the caller's channel`).toBe(0)
      const lines = cancelLines(audit)
      expect(lines, `ask #${String(n)} booked no cancel terminal`).toHaveLength(1)
      const stage = /stage=([a-z-]+)/.exec(lines[0] ?? '')?.[1] ?? ''
      const at = order.indexOf(stage)
      expect(at, `ask #${String(n)} answered an unknown stage ${JSON.stringify(stage)}`).toBeGreaterThan(-1)
      seen.push(stage)
      if (lines[0]?.includes('children=0') === true) {
        expect(providerSpawnMarks(SCRATCH), `ask #${String(n)} cost provider work`).toEqual(marks)
      }
    }
    expect(seen[asks - 1]).toBe('before-commit')
    // The measured shape of THIS row's path, printed as evidence: the ask count and
    // the boundary words the row answered the sweep with.
    console.info(`[a5-cancel/glob C4] measured asks=${String(asks)} stages=${seen.join(' > ')}`)
    // THE MAP, pinned position by position instead of merely ordered. Order alone
    // cannot see a missing checkpoint: a row that lost one answers one boundary
    // later and every weaker claim still holds, which is exactly how a boundary can
    // rot out of a row. So ask n must be answered at the n-th boundary of THIS row's
    // list. The repeated `after-settle` is the row's own two asks around the lease-arm
    // await (which face to await, and the way out of it); both answer that word, and
    // the pin says so out loud rather than hiding it in a distinctness count.
    const map = ['entry', 'after-rg-path', 'after-capability', 'after-anchor', 'pre-spawn', 'after-spawn', 'walk-aborted', 'after-settle', 'after-settle', 'after-stdout-drain', 'after-streams-drain', 'after-payload-record', 'after-verify', 'before-commit']
    expect(asks, `the row asks its channel ${String(asks)} times; this map pins ${String(map.length)}`).toBe(map.length)
    expect(seen).toEqual(map)
  }, SLOW)
})

describe('a5-cancel/glob S: source laws of the cancel leg in this row', () => {
  it('S1 the codes are borrowed spellings, the table stays owned here', () => {
    const src = rowSource()
    expect(src).toMatch(/import \{[^}]*CANCEL_CODE_ABORTED[^}]*CANCEL_CODE_UNCONFIRMED[^}]*\} from '\.\/cancel-leg\.mjs'/)
    expect(src).toMatch(/failure\('undetermined', CANCEL_CODE_ABORTED/)
    expect(src).toMatch(/failure\('undetermined', CANCEL_CODE_UNCONFIRMED/)
    expect(src).not.toMatch(/failure\([^\n)]*'call-aborted'/)
    expect(src).not.toMatch(/failure\([^\n)]*'termination-unconfirmed'/)
  })

  it('S2 the two arms hang off the ONE stopped fact, and never mint an answer', () => {
    const src = rowSource()
    const at = src.indexOf('const cancelRefusal')
    expect(at, 'the row has no cancel terminal').toBeGreaterThan(-1)
    const body = src.slice(at, src.indexOf('if (callAborted(cancelSignal)) return await cancelRefusal', at))
    expect(body).toMatch(/stop\.stopped === true/)
    expect(body).toContain("failure('undetermined'")
    expect(body).not.toContain('ok: true')
    expect(body).not.toContain('settlement')
    expect(body).not.toMatch(/\bsink\b/)
  })

  it('S3 the row touches the channel through the predicate and the race, and never reads its reason', () => {
    const src = rowSource()
    expect(src).not.toMatch(/\.reason\b/)
    expect(src).not.toMatch(/addEventListener/)
    expect(src.match(/callAborted\(cancelSignal\)/g)?.length).toBeGreaterThanOrEqual(5)
    expect(src).toContain('raceConfinedSettle({')
  })

  it('S4 the ONE publication site stays one, and sits after every cancel arm', () => {
    const src = rowSource()
    expect(src.match(/io\.sink\.write\(/g)).toHaveLength(1)
    const write = src.indexOf('io.sink.write(')
    const stages = ['entry', 'after-rg-path', 'after-capability', 'after-anchor', 'pre-spawn', 'after-spawn', 'walk-aborted', 'after-settle', 'after-stdout-drain', 'after-streams-drain', 'after-payload-record', 'after-verify', 'before-commit']
    let previous = -1
    for (const stage of stages) {
      const at = src.indexOf(`'${stage}'`)
      expect(at, `the cancel arm for ${stage} is gone from the row`).toBeGreaterThan(-1)
      expect(at, `the cancel arm for ${stage} moved ahead of the one before it`).toBeGreaterThan(previous)
      previous = at
    }
    expect(src.indexOf("cancelRefusal('before-commit'")).toBeLessThan(write)
    expect(src.lastIndexOf("'walk-aborted'")).toBeLessThan(write)
  })

  it('S5 the cancel leg never reaches the walker-result vocabulary on a cancel path (behavioural)', async () => {
    // The rows share more than the mechanics: a cancelled glob must not book any
    // of the walker's own verdict lines either — `ran`, `TIMEOUT`, `ERROR`,
    // `walker-error`, `RECORD-UNTRUSTED`. Only the cancel line may appear.
    const ac = new AbortController()
    ac.abort(cancelReason())
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
    const { result } = await runGlob(backend, 'ga-quiet', '*.ts', ac.signal)
    expect(result.ok).toBe(false)
    expect(audit.filter((l) => /anchored-glob (ran|TIMEOUT|ERROR|walker-error|RECORD-UNTRUSTED|WALK-INCOMPLETE|DRAIN-INCOMPLETE|PROTOCOL-BREAK|RESULT-REFUSED)\b/.test(l))).toEqual([])
    expect(cancelLines(audit)).toHaveLength(1)
  }, SLOW)
})

  it('S6 the pipe release is ONE finally, and the drain boundaries are checkpoints of their own', () => {
    const src = rowSource()
    // The release is a slot installed when the pipes are attached and called from
    // the block's single `finally`: one call site, in the finally, before the
    // descriptor goes back. Scattered per-arm releases are how an exit nobody
    // thought of ends up holding a caller's stream.
    expect(src).toMatch(/let releaseAllWatchers = \(\) => \{\}/)
    expect(src.match(/releaseAllWatchers\(\)/g)).toHaveLength(1)
    expect(src).toMatch(/finally \{[\s\S]{0,400}?releaseAllWatchers\(\)[\s\S]{0,200}?anchor\.handle\.close\(\)/)
    // The boundaries the review named on THIS row: after the rg-path lookup, and
    // after each of the two post-settle drain awaits.
    for (const stage of ["'after-rg-path'", "'after-stdout-drain'", "'after-streams-drain'", "'after-payload-record'"]) {
      expect(src, `the boundary ${stage} is gone from the row`).toContain(stage)
    }
    // Each drain checkpoint sits BEFORE the row's own incomplete-drain verdicts:
    // a withdrawal is answered as a withdrawal, not behind a walk verdict — while
    // the completeness standard itself (the verdicts, untouched) still rules any
    // call nobody withdrew from.
    expect(src.indexOf("'after-stdout-drain'")).toBeLessThan(src.indexOf('WALK-INCOMPLETE'))
    expect(src.indexOf("'after-streams-drain'")).toBeLessThan(src.indexOf('DRAIN-INCOMPLETE'))
    // And the record checkpoint sits before the row's OWN record verdict, which is
    // the whole point of it: a withdrawal during the record await is answered as a
    // withdrawal, not after the record is judged untrustworthy.
    expect(src.indexOf("'after-payload-record'")).toBeLessThan(src.indexOf('const untrusted = rec0 === null'))
  })

describe('a5-cancel/glob D: a throwing terminate keeps the contract of the path that asked (F3, and the raw-arm interleaving)', () => {
  const THROW_CANARY = 'A5CANCEL-GLOB-TERMINATE-FAULT-MUST-NOT-TRAVEL'
  let forgedRow: GlobBackendRow
  // Counted at the arm itself, so "the row never asks the lease arm twice for one
  // call" is a measurement and not a reading of the source.
  let terminateCalls = 0
  // THE FORGED ARM NEVER REACHES THE PROVIDER, so the REAL child of a D-group call
  // is still walking when the leg is over: nothing in this file may pretend that
  // tearing the world down is process reclamation. Every handle the forge hands out
  // is recorded WITH the real `terminate` it replaced, and each leg hands its
  // children back through that face in its own `finally`-equivalent below, asserting
  // the provider's own confirmation (`status === 'terminated'`) — the same fact the
  // row's stop law is built on. The legs' measured answers are untouched.
  const forgedChildren: Array<{ value: Record<string, unknown>; realTerminate: (() => Promise<unknown>) | null }> = []
  const stopRealChildren = async (): Promise<void> => {
    const owed = forgedChildren.splice(0, forgedChildren.length)
    const seen: string[] = []
    for (const child of owed) {
      if (child.realTerminate === null) { seen.push('no-real-arm'); continue }
      let status = 'never-asked'
      for (let attempt = 0; attempt < 40 && status !== 'terminated'; attempt += 1) {
        const settled = await child.realTerminate
          .call(child.value)
          .catch(() => ({ ok: false, value: { status: 'terminate-threw' } })) as { ok?: boolean; value?: { status?: string } }
        status = settled?.ok === true ? String(settled.value?.status ?? 'no-status') : 'refused'
        if (status !== 'terminated') await new Promise((resolve) => { setTimeout(resolve, 25) })
      }
      seen.push(status)
      expect(status, 'a D-group leg left a real confined child running').toBe('terminated')
      // BOUNDED TEARDOWN GRACE, not a synchronisation contract: the provider's own
      // reaping of a child it has just confirmed terminated writes into this
      // world's scratch, and the file-level teardown removes the world a moment
      // later. Waiting a beat with the world still present is what keeps the
      // stray-world sweep a fact about the suite rather than a race with the reap.
      await new Promise((resolve) => { setTimeout(resolve, 120) })
    }
    if (owed.length > 0) console.info(`[a5-cancel/glob D] real teardown confirmed: glob D -> ${seen.join(', ')}`)
  }

  beforeAll(async () => {
    // The same forge as the search row's group D, on THIS row: the provider module
    // is replaced below the row for this group only, and ONE face of the handle it
    // returns throws. The provider object is `Object.freeze`d, so the forge is a
    // COPY with that face replaced — a `Proxy` whose `get` returns another value for
    // a frozen property is a TypeError at the trap, and the leg would then measure
    // the trap instead of the row.
    vi.resetModules()
    await import('../sandbox-provider/index.js') // resolve the specifier in this registry once, or the mock below never runs
    vi.doMock('../sandbox-provider/index.js', async (importOriginal) => {
      const actual = (await importOriginal()) as Record<string, unknown>
      const realCreate = actual.createConfinedProcessProvider as (cfg: unknown) => Record<string, unknown>
      const wrapChild = (settled: unknown): unknown => {
        const handle = settled as { ok?: boolean; value?: Record<string, unknown> }
        if (handle?.ok !== true || typeof handle.value !== 'object' || handle.value === null) return settled
        // Record the real handle and the real arm BEFORE replacing the face, so the
        // cleanup below can stop what this forgery made un-stoppable.
        const real = handle.value
        forgedChildren.push({
          value: real,
          realTerminate: typeof real.terminate === 'function' ? real.terminate as () => Promise<unknown> : null,
        })
        return {
          ...handle,
          value: {
            ...handle.value,
            terminate: async (): Promise<never> => {
              terminateCalls += 1
              throw new Error(THROW_CANARY)
            },
          },
        }
      }
      const forge = (cfg: unknown): Record<string, unknown> => {
        const real = realCreate(cfg)
        return {
          ...real,
          spawn: async (request: unknown): Promise<unknown> => wrapChild(await real.spawn(request as never)),
          spawnStreaming: async (request: unknown): Promise<unknown> => wrapChild(await real.spawnStreaming(request as never)),
        }
      }
      return { ...actual, createConfinedProcessProvider: forge }
    })
    forgedRow = (await import('../src/plugin/live/glob-backend.mjs')) as unknown as GlobBackendRow
  })

  afterAll(async () => {
    // A leg that failed before its own cleanup must not leave a child behind; this
    // sweep is the net, and it reports what it had to stop.
    await stopRealChildren()
    vi.doUnmock('../sandbox-provider/index.js')
    vi.resetModules()
  })

  const makeForged = (
    options: Record<string, unknown> = {},
    roots: { rootDir: string; scratchRoot: string } = { rootDir: ROOT_DIR, scratchRoot: SCRATCH },
  ): { backend: GlobBackend; audit: string[] } => {
    const audit: string[] = []
    const backend = forgedRow.createAnchoredGlobBackend({
      realmId: `${REALM}-forged`,
      rootDir: roots.rootDir,
      confined: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        scratchRoot: roots.scratchRoot,
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
      observe: (line: string) => { audit.push(line) },
      ...options,
    })
    return { backend, audit }
  }

  it('D1 with NO channel, the row keeps its pre-existing throwing-arm contract: a typed refusal, not a published list', async () => {
    terminateCalls = 0
    const { backend, audit } = makeForged()
    const marks = providerSpawnMarks(SCRATCH)
    const before = openFds()
    const { result, sink } = await runGlob(backend, 'ga-forged-plain', '*.ts', undefined)
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)
    expect(result.ok, 'a throwing lease arm turned into a successful walk').toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('internal-error')
    expect(result.failure.class).toBe('undetermined')
    expect(audit.some((l) => l.includes('anchored-glob INTERNAL-FAULT'))).toBe(true)
    expect(audit.some((l) => l.includes('anchored-glob ran'))).toBe(false)
    expect(sink.writes()).toBe(0)
    expect(openFds()).toBeLessThanOrEqual(before)
    expect(JSON.stringify(result.failure)).not.toContain(THROW_CANARY)
    expect(audit.join('\n')).not.toContain(THROW_CANARY)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D1
  }, SLOW)

  it('D2 on a CANCELLED call, the same throwing arm answers termination-unconfirmed with zero sink', async () => {
    terminateCalls = 0
    const live = signalFiringOnSubscribe()
    const { backend, audit } = makeForged()
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-forged-cancel', '*.ts', live.signal)
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('termination-unconfirmed')
    expect(result.failure.class).toBe('undetermined')
    expect(result.failure.detail).toBe(row.GLOB_REFUSAL_TEXT['termination-unconfirmed'])
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(cancelLines(audit).some((l) => l.includes('code=termination-unconfirmed') && l.includes('stop=terminate-threw'))).toBe(true)
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-glob ran'))).toBe(false)
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)
    expect(JSON.stringify(result)).not.toContain(THROW_CANARY)
    expect(audit.join('\n')).not.toContain(THROW_CANARY)
    // Grammar still holds on this path: a cancel line is a line like any other.
    for (const line of audit) expect(line).toMatch(AUDIT_GRAMMAR)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D2
  }, SLOW)

  it('D3 the fault that arrives WHILE the caller withdraws, mid raw arm, is answered as the cancellation it is', async () => {
    // THE INTERLEAVING the review names, on this row: the row asked its channel at
    // the settle boundary, was told "no withdrawal", and took the RAW arm; only then
    // did the caller give up and the arm throw. The row's LOCAL catch asks the
    // channel once more — one ask per boundary, so the counting channel selects that
    // ask exactly — finds the withdrawal, and answers with the cancellation terminal
    // built from the SAME settled arm. The calibration run (same forged backend, a
    // channel that answers "no" to every ask) establishes which ask that is: it ends
    // in D1's internal fault, and this leg fires on that LAST ask.
    const calibration = makeForged()
    const never = signalFiringOnAsk(0)
    const { result: plain } = await runGlob(calibration.backend, 'ga-forged-calib', '*.ts', never.signal)
    expect(plain.ok).toBe(false)
    // THE CALIBRATION IS ASSERTED AND IT RUNS: a code check written INSIDE
    // `if (plain.ok !== false)` can never execute for a call that failed, so it
    // would pass whether or not the row kept its contract. Fail loudly first, then
    // read the code off the narrowed value, and print it so the log shows the
    // assertion was reached.
    if (plain.ok !== false) throw new Error('D3: the calibration call did not fail at all')
    console.info(`[a5-cancel/glob D3] calibration branch executed: code=${String(plain.failure.code)}`)
    expect(plain.failure.code, 'the calibration run is not the un-cancelled fault').toBe('internal-error')
    const asks = never.asks()
    expect(asks, 'the row asked its channel too few times for the boundary to be selectable').toBeGreaterThanOrEqual(5)

    terminateCalls = 0
    const { backend, audit } = makeForged()
    const fired = signalFiringOnAsk(asks)
    const { result, sink } = await runGlob(backend, 'ga-forged-midarm', '*.ts', fired.signal)
    expect(result.ok, 'a withdrawn call with an unconfirmed stop published a list').toBe(false)
    if (result.ok !== false) return
    // The CODE follows the confirmed fact, and the only fact the arm gave is that it
    // threw: nothing was confirmed, so this is 'termination-unconfirmed' — never the
    // confirmed-stop code, and never `ok: true`.
    expect(result.failure.code).toBe('termination-unconfirmed')
    expect(result.failure.detail).toBe(row.GLOB_REFUSAL_TEXT['termination-unconfirmed'])
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(sink.writes()).toBe(0)
    expect(cancelLines(audit)).toHaveLength(1)
    // ONE terminate for one call: the classified face is a READING of the promise
    // that already rejected, not a second request to the lease.
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)
    expect(audit.some((l) => l.includes('anchored-glob INTERNAL-FAULT'))).toBe(false)
    expect(JSON.stringify(result)).not.toContain(THROW_CANARY)
    expect(audit.join('\n')).not.toContain(THROW_CANARY)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D3
  }, SLOW)

  it('D4 a TIMEOUT winner keeps its own contract: with the arm throwing, no timeout shape is minted', async () => {
    // THE HARD CONSTRAINT on the other side of that same catch. `timeoutMs: 1` over
    // the 6000-file tree makes the budget the winner of the settle race, and the
    // CONTROL run on the unforged row shows what that winner looks like when the arm
    // answers. The caller withdraws at the ask right after the race. Even so the row
    // must take the RAW arm: swallowing a fault there would hand back the timeout
    // arm's `ok: true` empty file list — "the subtree holds nothing" — for a walk
    // nobody finished reading. So the fault travels, and the row answers its own
    // pre-existing internal fault.
    const real = makeBackend(CAP_ROOT, CAP_SCRATCH, undefined, { timeoutMs: 1 })
    const control = await runGlob(real.backend, 'ga-timeout-control', '**/*.ts', undefined)
    expect(control.result.ok, 'the budget winner lost its own pre-existing shape').toBe(true)
    expect(control.result.settlement).toEqual({ kind: 'cancelled', event: 'glob-walk-terminated-after-timeout' })

    const calibration = makeForged({ timeoutMs: 1 }, { rootDir: CAP_ROOT, scratchRoot: CAP_SCRATCH })
    const never = signalFiringOnAsk(0)
    const { result: plain } = await runGlob(calibration.backend, 'ga-timeout-calib', '**/*.ts', never.signal)
    expect(plain.ok).toBe(false)
    // THE CALIBRATION IS ASSERTED AND IT RUNS: a code check written INSIDE
    // `if (plain.ok !== false)` can never execute for a call that failed, so it
    // would pass whether or not the row kept its contract. Fail loudly first, then
    // read the code off the narrowed value, and print it so the log shows the
    // assertion was reached.
    if (plain.ok !== false) throw new Error('D4: the calibration call did not fail at all')
    console.info(`[a5-cancel/glob D4] calibration branch executed: code=${String(plain.failure.code)}`)
    expect(plain.failure.code, 'the timeout path did not keep the old fault contract').toBe('internal-error')
    const asks = never.asks()
    expect(asks, 'the timeout path never reached the boundary this leg selects').toBeGreaterThanOrEqual(5)

    terminateCalls = 0
    const { backend, audit } = makeForged({ timeoutMs: 1 }, { rootDir: CAP_ROOT, scratchRoot: CAP_SCRATCH })
    const fired = signalFiringOnAsk(asks)
    const { result, sink } = await runGlob(backend, 'ga-timeout-fault', '**/*.ts', fired.signal)
    expect(result.ok, 'a throwing lease arm was swallowed into the timeout success shape').toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('internal-error')
    expect(result.failure.class).toBe('undetermined')
    expect(audit.some((l) => l.includes('anchored-glob INTERNAL-FAULT'))).toBe(true)
    // The timeout arm's own line is NOT booked: the row never got there.
    expect(audit.some((l) => l.includes('anchored-glob TIMEOUT'))).toBe(false)
    expect(sink.writes()).toBe(0)
    expect(cancelLines(audit)).toHaveLength(0)
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D4
  }, SLOW)
})
describe('a5-cancel/glob T: the winner the race chose stands to the end of the row (real row, not the helper)', () => {
  // The helper group T (in the search suite) drives the tie law INSIDE
  // `raceConfinedSettle`. That is not the finding here: the winner the race hands
  // back has to STAND through everything the row does after the await. These two
  // legs are the pair — same channel instrument, same ask selected, only the winner
  // differs — and they run the real row against a real confined rg.
  //
  // The ask is not guessed. `timeoutMs: 1` over the 6000-file tree makes the budget
  // the winner, and on that path the row's LAST ask is the one it makes on its way
  // out of the race (the timeout arm returns right after it), so a calibration run
  // with a never-firing counter says exactly which ask the post-race read is. The
  // same index is then the settle-boundary read on any other path of this row,
  // because every ask before it is the same boundary in the same order.

  it('T1 a settled TIMEOUT is not rejudged by a withdrawal that lands after the race', async () => {
    const calibration = makeBackend(CAP_ROOT, CAP_SCRATCH, undefined, { timeoutMs: 1 })
    const never = signalFiringOnAsk(0)
    const control = await runGlob(calibration.backend, 'ga-tie-calib', '**/*.ts', never.signal)
    expect(control.result.ok, 'the budget winner lost its own pre-existing shape').toBe(true)
    expect(control.result.settlement).toEqual({ kind: 'cancelled', event: 'glob-walk-terminated-after-timeout' })
    const asks = never.asks()
    expect(asks, 'the timeout path made too few asks for its post-race read to be selectable').toBeGreaterThanOrEqual(7)

    const { backend, audit } = makeBackend(CAP_ROOT, CAP_SCRATCH, undefined, { timeoutMs: 1 })
    const fired = signalFiringOnAsk(asks)
    const marks = providerSpawnMarks(CAP_SCRATCH)
    const before = openFds()
    const { result, sink } = await runGlob(backend, 'ga-tie-timeout-then-abort', '**/*.ts', fired.signal)
    expect(providerSpawnMarks(CAP_SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    // THE ANSWER IS THE TIMEOUT ARM'S OWN, not a cancel refusal: the winner was
    // decided while the walk was running out its budget, and a withdrawal that
    // arrives afterwards may not rejudge what it did not race.
    expect(result.ok, 'a settled timeout was rewritten into a cancel refusal').toBe(true)
    if (result.ok !== true) return
    expect(result.settlement).toEqual({ kind: 'cancelled', event: 'glob-walk-terminated-after-timeout' })
    expect(result.outcome.files).toEqual([])
    expect(audit.some((l) => l.includes('anchored-glob TIMEOUT'))).toBe(true)
    // No cancel terminal at all on this path — not even a `stage=after-streams-drain`
    // one: the drain checkpoints are for a walk whose own verdict is still owed.
    expect(cancelLines(audit)).toEqual([])
    expect(sink.writes()).toBe(0)
    expect(fired.asks(), 'the row stopped consulting its channel early').toBeGreaterThanOrEqual(asks)
    expect(openFds()).toBeLessThanOrEqual(before)
  }, SLOW)

  it('T2 the direction: the SAME withdrawal at the SAME ask, on a walk that did NOT run out its budget, is a call-aborted refusal', async () => {
    // Calibrated on the budget path for the ask index, then run with this row's
    // ordinary walk budget so the EXIT is the winner. Everything else — the channel,
    // the ask it fires on — is identical, which is what makes this the pair to T1
    // rather than a second copy of it.
    const calibration = makeBackend(CAP_ROOT, CAP_SCRATCH, undefined, { timeoutMs: 1 })
    const never = signalFiringOnAsk(0)
    await runGlob(calibration.backend, 'ga-dir-calib', '**/*.ts', never.signal)
    const asks = never.asks()
    expect(asks, 'the timeout path made too few asks for its post-race read to be selectable').toBeGreaterThanOrEqual(7)

    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
    const fired = signalFiringOnAsk(asks)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runGlob(backend, 'ga-dir-exit-then-abort', '*.ts', fired.signal)
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(result.ok, 'a withdrawn call published a file list').toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.family).toBe('a5glb-refused/cancel')
    expect(result.failure.counts).toEqual({ children: 1 })
    const lines = cancelLines(audit)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('stage=after-settle')
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-glob ran'))).toBe(false)
  }, SLOW)
})

