/**
 * a5-cancel (search leg) — the cooperative cancel law of the anchored
 * confined-ripgrep SEARCH row.
 *
 * WHAT THE ROW NOW DOES with the host's cancel channel. `register.ts` forwards
 * `exec?.signal` onto the call, the pipeline carries it untouched, and this row
 * ANSWERS it: a cancelled search is a typed FAILURE of the row's own frozen table
 * (`call-aborted` when the stop is confirmed, `termination-unconfirmed` when it
 * cannot be confirmed), never an `ok: true` empty result — an empty match list is
 * a statement about the tree, and a cancelled walk has made no such statement.
 * The mechanics are shared with the glob row through `cancel-leg.mjs`; the WORDS
 * belong to this row, in this row's table.
 *
 * WHY THE LEGS ARE DETERMINISTIC (no wall-clock bets). Three instruments, and
 * none of them is a timer around a walk:
 *  - THE ROW'S OWN BOUNDARY LINES. For a call that carries a channel the row
 *    books `cancel-leg stage=pre-spawn-check` (it is consulting its channel at the
 *    last step before it would ask for a child — the word names the instruction,
 *    so a refusal there books no claim that a spawn was coming) and
 *    `cancel-leg stage=child-live` (the child exists and this call owns it). A leg
 *    arms its abort the moment the line arrives: synchronously, the abort lands at
 *    that boundary; on a `queueMicrotask`, at the first await after it.
 *  - A CHANNEL THAT FIRES WHEN THE ROW SUBSCRIBES (`signalFiringOnSubscribe`).
 *    `raceConfinedSettle` asks `aborted` and only then attaches; this channel
 *    reports the withdrawal from inside `addEventListener`, which is the exact
 *    instant the row became able to hear one — the child is live (the row booked
 *    `stage=child-live`), and no leg has to guess how long the walk takes. Firing
 *    the listener twice in the same call is the repeat-abort case.
 *  - A CHANNEL THAT COUNTS ASKS (`signalFiringOnAsk`). The row asks once per
 *    boundary, so answering "aborted" from the N-th ask selects a boundary
 *    exactly; the count for a path is MEASURED by running the same call once with
 *    a never-firing counter, which is how C3 walks the boundaries of the path
 *    through to the last one in front of the sink write. Two asks may legitimately
 *    share a stage word — the row asks once to decide which face of its lease arm
 *    to await and once again on the way out of that await — so C3 pins that the
 *    words it books are this row's own list in a NON-REGRESSING order, which is the
 *    claim, rather than a distinctness count nobody promised.
 * The tie law (`exited > timedOut > aborted`) needs a same-tick multi-fact
 * situation production cannot manufacture for itself, so those legs drive the
 * SHIPPED `raceConfinedSettle` through its own injectable `sleep`/`clear` — the
 * seam `raceShellSettle` exposes for the same reason (a5b3 C8/C9). No leg asserts
 * a timing race.
 *
 * THE SPAWN COUNTER IS THE PROVIDER'S OWN FACE, NOT THE ROW'S. A leg claiming
 * "no process was ever asked for" must not read `backend.execCount()` — that is
 * the row's own bookkeeping, i.e. the very thing under test. The provider records
 * every accepted spawn ITSELF: `spawn()`/`spawnStreaming()` route through
 * `prepare()`, whose durable face is exactly one `plans/<planId>.json` plus one
 * `out/<planId>/` under the configured scratchRoot (sandbox-provider/provider.ts
 * :604-610), while the capability probe writes `probe-<stamp>/` directories and
 * NEVER a plan. `execCount()` appears next to such assertions as a cross-check
 * only, and OBS1 calibrates the face against a provider of the test's own before
 * any leg leans on it.
 *
 * HOW THE UNCONFIRMED ARM IS PRODUCED, AND WHAT STAYS DISCLOSED. A real confined
 * child of this row always dies on `terminate()`, so an unconfirmed stop cannot be
 * reached by being patient about a real walk. Group D therefore forges it BELOW
 * the row: the provider module the row imports is replaced, for that group only, by
 * a COPY of the real provider (`Object.freeze` defeats a `Proxy` here: a `get` that
 * returns another value for a frozen property is a TypeError at the trap, and the
 * row would report `spawn-failed` and the leg would measure the trap) whose
 * `spawnStreaming` hands out the REAL child — real plan, real walk — with ONE face
 * changed: a `terminate()` that throws, counted at the arm itself. The four legs are
 * the pairs the findings asked for. The same fault on a call with NO channel keeps
 * the row's pre-existing contract (the rejection reaches `run`'s catch,
 * `internal-error`, nothing published); on a call that withdrew BEFORE the row read
 * its channel it answers `termination-unconfirmed` with zero sink bytes; on a call
 * that withdraws DURING the raw arm (D3 — the counting channel fires on the ask the
 * row's local catch makes after the rejection) it is the cancellation that owns the
 * answer, read off the same settled arm, so the arm is asked exactly once; and a
 * TIMEOUT winner whose arm throws keeps the old fault contract (D4 — the budget's
 * `ok: true` shape is not a place a fault may be set down). Group T drives the same
 * shapes through the shipped helper, group S pins statically that the code hangs off
 * the helper's ONE `stopped` fact, that the RAW face is what a non-timeout
 * un-cancelled path awaits, and that the pipe release has exactly ONE call site —
 * the block's `finally` — so "every exit releases" is a property of the block rather
 * than of the list of arms somebody remembered to write. What is NOT measured
 * anywhere is a real lease whose signal simply never arrives — the provider has no
 * such arm to forge, and no leg here pretends otherwise. Because the forged arm is
 * the one the row awaits, the REAL child is left un-stopped by design, so every leg
 * of that group hands its children back through the real `terminate` captured below
 * the forgery and asserts that face returns `status: 'terminated'`: the suite stops
 * what it started, and removing the world is not process reclamation.
 *
 * Worlds live under `tests/homes/` (TEST_METHODS §5/§7) and self-remove; the
 * launcher and the packaged rg are the real ones.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  statSync,
  readFileSync,
  readlinkSync,
  rmdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, sep } from 'node:path'
import {
  createConfinedProcessProvider,
  type ProviderLease,
  type ProviderResult,
  type SpawnRequest,
  type StreamingOptions,
  type StreamingSpawnHandle,
} from '../sandbox-provider/index.js'
import {
  buildSearchFixture,
  countingSink,
  destroyWorldVerified,
  LAUNCHER,
  LAUNCHER_SHA,
  loadSearchBackendRow,
  newWorld,
  plantBulk,
  REPO,
  searchCall,
  type SearchBackend,
  type SearchBackendResult,
  type SearchBackendRow,
} from './alpha5-search-harness.js'
import { sweepStrayWorlds } from './alpha5-glob-harness.js'

/**
 * THE LANE'S STRUCTURAL VIEW OF THE MONOTONIC CLOCK. The plugin node-min ambient
 * shim types the `process` global as just `cwd`, so a duration read through it is a
 * TS2339 — the same problem `a5b3-cancel-leg` has, solved the same way and for the
 * same reason: read the clock off `globalThis` through a local structural view
 * instead of widening a shim this file does not own. Same clock, same nanoseconds,
 * behaviour unchanged.
 */
const monotonicMs = (): number =>
  Number((globalThis as unknown as { process: { hrtime: { bigint(): bigint } } }).process.hrtime.bigint()) / 1_000_000

/**
 * The provider's compile face as this file needs it: the factory the confined rows
 * call, and the streaming arm's declared result. Both are TAKEN FROM THE PROVIDER
 * (`ReturnType`, `ProviderResult<StreamingSpawnHandle>`) rather than restated here,
 * so a change to the real face is a typecheck error in this file and not a lie.
 */
type ConfinedProvider = ReturnType<typeof createConfinedProcessProvider>
type StreamSettle = ProviderResult<StreamingSpawnHandle>

const WORLD = newWorld('a5cancel-s')
const ROOT_DIR = join(WORLD, 'root')
/** The row's provider scratch, exactly as the harness configures it. */
const SCRATCH = join(WORLD, 'scratch')
/** A tree big enough that a live walk is still walking when a boundary-injected
 *  abort arrives (leg B2). Planted once. */
const BULK_WORLD = newWorld('a5cancel-sbulk')
const BULK_ROOT = join(BULK_WORLD, 'root')
const BULK_SCRATCH = join(BULK_WORLD, 'scratch')
const REALM = 'a5cancel-realm'
const SLOW = 240_000
/** A cancel REASON no face of this row may ever print: the reason is caller-owned
 *  text and this row publishes codes plus arithmetic. */
const REASON_CANARY = 'A5CANCEL-REASON-MUST-NEVER-TRAVEL'

const START_SWEEP = sweepStrayWorlds('a5cancel-s')
void START_SWEEP // the pre-run sweep is reported by the post-run one; a stray here is a red below

let row: SearchBackendRow

// ---------------------------------------------------------------------------
// the faces this suite reads
// ---------------------------------------------------------------------------

interface OwnedStop { stopped: boolean; confirmedBy: string | null; form: string }
interface CancelLegRow {
  CANCEL_CODE_ABORTED: string
  CANCEL_CODE_UNCONFIRMED: string
  callAborted(signal: unknown): boolean
  createOwnedStop(): { adopt(child: unknown): void; child(): unknown; rawStop(): Promise<unknown>; stop(): Promise<OwnedStop> }
  raceConfinedSettle(input: {
    exited: Promise<unknown>
    timeoutMs: number
    signal?: unknown
    sleep?: (cb: () => void, ms: number) => unknown
    clear?: (handle: unknown) => void
  }): Promise<Record<string, unknown>>
}
const cancelLeg = (await import(new URL('../src/plugin/live/cancel-leg.mjs', import.meta.url).href)) as CancelLegRow

/** The row's source, comment-stripped: the static legs are about CODE paths. */
const rowSource = (): string => readFileSync(join(REPO, 'packages/runtime/src/plugin/live/search-backend.mjs'), 'utf8')
  .split('\n')
  .map((line) => (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*') ? '' : line.split('//')[0] ?? ''))
  .join('\n')

/**
 * A backend with its audit face captured AND watched. `onLine` is called
 * synchronously by the row's own `observe`, which is what makes a
 * boundary-injected abort deterministic.
 */
function makeBackend(rootDir: string, scratchRoot: string, onLine?: (line: string) => void, options: Record<string, unknown> = {}): { backend: SearchBackend; audit: string[] } {
  const audit: string[] = []
  const backend = row.createAnchoredRgSearchBackend({
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

/**
 * Fire `fire` the FIRST time an audit line containing `needle` is booked, and
 * report whether it ever fired — a leg must never pass silently because its
 * boundary was not reached.
 */
function armAt(needle: string, fire: () => void): ((line: string) => void) & { fired(): boolean } {
  let seen = false
  const observer = (line: string): void => {
    if (seen || !line.includes(needle)) return
    seen = true
    fire()
  }
  return Object.assign(observer, { fired: () => seen })
}

/** One call exactly as the lane hands it over, plus the cancel channel. */
function cancelCall(callId: string, signal: AbortSignal | undefined, overrides: Record<string, unknown> = {}): unknown {
  const base = searchCall(callId, overrides) as Record<string, unknown>
  return signal === undefined ? base : { ...base, signal }
}

async function runCancelled(
  backend: SearchBackend,
  callId: string,
  signal: AbortSignal | undefined,
  overrides: Record<string, unknown> = {},
): Promise<{ result: SearchBackendResult; sink: ReturnType<typeof countingSink> }> {
  const sink = countingSink()
  const result = (await backend.run(cancelCall(callId, signal, overrides), sink)) as SearchBackendResult
  return { result, sink }
}

/** The caller's abort cause: shaped like the host's, impossible to ignore, and
 *  text this row must never print. */
const cancelReason = (): Error => new Error(REASON_CANARY)

/**
 * THE PROVIDER-LAYER SPAWN COUNT. One `plans/<planId>.json` + one `out/<planId>/`
 * per accepted spawn, written by the provider itself; a capability probe writes
 * neither. `execCount()` is NOT evidence anywhere in this file — see the header.
 */
function providerSpawnMarks(scratchRoot: string): { plans: number; outs: number } {
  const plansDir = join(scratchRoot, 'plans')
  const outsDir = join(scratchRoot, 'out')
  return {
    plans: existsSync(plansDir) ? readdirSync(plansDir).filter((f) => f.endsWith('.json')).length : 0,
    outs: existsSync(outsDir) ? readdirSync(outsDir).length : 0,
  }
}

/** This process's open descriptors — the "no descriptor left pinned" face. */
/**
 * THE FD METER IS SCOPED TO ONE TEST ROOT, AND IT NAMES WHAT IT SEES.
 *
 * WHY NOT A PROCESS-WIDE COUNT: `readdirSync('/proc/self/fd').length` is a number
 * about the whole process, and the root vitest config runs test files in a `threads`
 * pool with several files sharing one process — other files' legs, their children and
 * their provider scratch all move that number. A delta of it therefore attributes
 * NOTHING to this row. That is also the honest statement about the `+9` the census
 * observed on this lane: under a shared-process pool it is unattributable, and this
 * file does NOT claim to know which worker or which suite it belonged to.
 *
 * WHAT THIS METER DOES AND DOES NOT SEE. It reads `/proc/self/fd`, which is the fd
 * table of THIS process — the runner — and nothing else: the descriptors of the
 * confined `rg` child are in that child's own table and are not visible here, so no
 * assertion in this file may, and none does, claim to have checked a child's
 * resources. What it does see: any descriptor of this process pointing INTO one
 * specific test root — including the root DIRECTORY itself, which is what the pinned
 * anchor actually is, and a file unlinked underneath an open fd, which still resolves
 * to its root path and counts as the leak it is. Every root here is made by `newWorld`
 * for THIS file and no other file touches it, so a non-empty answer is "this row came
 * back still holding the governed root" and an empty answer is the pinned descriptor
 * given back. `OBS` carries the controls that pin the meter in both directions —
 * holders it must name (root directory, file inside) and holders it must not fold in
 * (same-spelled sibling, an outside descriptor open at that very moment), with every
 * holder given back in a `finally`. A meter that always answered empty would otherwise
 * pass every release assertion in this file.
 */
/** What `/proc/self/fd` appends when the file an fd points at is gone. */
const DELETED_SUFFIX = ' (deleted)'

const heldFdsUnder = (root: string): string[] => {
  const canonical = realpathSync(root)
  const prefix = canonical + sep
  // The lane's ambient shim types `statSync` structurally (just `isDirectory`), so
  // the identity pair is read through a local structural view — the same discipline
  // as `a5b3-cancel-leg`'s clock and mtime reads, touching no shared shim.
  const own = statSync(root) as unknown as { dev: number; ino: number }
  const seen: string[] = []
  for (const name of readdirSync('/proc/self/fd')) {
    let target: string
    try {
      target = readlinkSync(join('/proc/self/fd', name))
    } catch (fault) {
      // An fd closed between the readdir and this readlink is neither a leak nor a
      // fault to hide. Anything else — EACCES, EIO, a missing /proc — travels.
      if ((fault as { code?: string }).code === 'ENOENT') continue
      throw fault
    }
    const unlinked = target.endsWith(DELETED_SUFFIX)
    const path = unlinked ? target.slice(0, target.length - DELETED_SUFFIX.length) : target
    // BELOW the root, or THE root itself — a directory descriptor is written without a
    // trailing separator, and the production anchor IS a directory descriptor, so the
    // spelling has to end in a separator OR stop exactly here. `startsWith(canonical)`
    // alone would let the sibling `<root>-sib` in, which is why the OBS control pins
    // both directions.
    const inside = path === canonical || path.startsWith(prefix)
    let sameIdentity = false
    if (!inside) {
      // A descriptor whose spelling is not under the root can still BE the root: a
      // bind or another mount alias. Identity decides that — and it has to be the
      // identity of THE OPEN FD, so the stat goes to the `/proc` entry itself, which
      // the kernel resolves to what the fd actually refers to, including a target that
      // has been renamed or unlinked since. Stating the link's TEXT would answer a
      // question about the namespace right now instead of a question about this fd,
      // and the deleted case above would be judged by a different file's inode.
      // (A pipe, socket or anon-inode answers with its own identity, never the root's.)
      try {
        const st = statSync(join('/proc/self/fd', name)) as unknown as { dev: number; ino: number }
        sameIdentity = st.dev === own.dev && st.ino === own.ino
      } catch (fault) {
        // Only an fd that closed between the readdir and this stat is skipped; every
        // other errno travels.
        if ((fault as { code?: string }).code !== 'ENOENT') throw fault
      }
    }
    if (inside || sameIdentity) {
      const rest = path === canonical ? '.' : path.slice(prefix.length)
      seen.push(`${name}:${rest}${unlinked ? DELETED_SUFFIX : ''}`)
    }
  }
  return seen
}

/** The cancel lines among the audit lines a call booked. */
const cancelLines = (audit: readonly string[]): string[] => audit.filter((l) => l.includes(' cancel code='))

/**
 * A channel that fires AT THE INSTANT the row starts listening to it.
 *
 * `raceConfinedSettle` asks `aborted` first and only subscribes when the answer is
 * "no"; this channel honours that order and then reports the withdrawal from inside
 * `addEventListener`, which is the moment the row made itself able to hear one. It
 * is the deterministic version of "the cancel arrived while the payload was live":
 * no timer is involved, no walk length is assumed, and the child the row adopted
 * seconds earlier is genuinely alive because the row's own `stage=child-live` line
 * is what the leg reads back. `fires` repeats the notification, which is what a
 * caller who aborts twice in one tick does to a listener that is already attached.
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
 * A channel that counts how often the row ASKS it, and starts answering "aborted"
 * from the N-th ask on. The row asks once per boundary, so N selects a boundary
 * exactly — no timing, no fixture size, no luck. `measureChannelAsks` runs the same
 * call once with a channel that never fires to learn how many asks that path makes,
 * so a leg can aim at the LAST boundary without hard-coding a count that the row is
 * free to change.
 */
function signalFiringOnAsk(target: number): { signal: unknown; asks(): number } {
  let asks = 0
  const signal = {
    get aborted(): boolean {
      asks += 1
      return target > 0 && asks >= target
    },
    get reason(): unknown { return cancelReason() },
    addEventListener: (_type: string, _listener: () => void): void => { /* the ask never got here */ },
    removeEventListener: (_type: string, _listener: () => void): void => { /* nothing to give back */ },
  }
  return { signal, asks: () => asks }
}

async function measureChannelAsks(backend: SearchBackend, callId: string): Promise<number> {
  const counter = signalFiringOnAsk(0) // answers "no" every time, and counts
  const result = (await backend.run(cancelCall(callId, counter.signal as never), countingSink())) as SearchBackendResult
  expect(result.ok, 'a channel that is asked and never fires must not change the answer').toBe(true)
  return counter.asks()
}

/**
 * A stand-in satisfying ONLY the channel face this row may touch: `aborted`,
 * `addEventListener`, `removeEventListener`. It exists to make the one boundary
 * no production seam announces — "the cancel arrived after the settle race chose
 * its winner and before the row committed an answer" — deterministic: it flips
 * the instant the row stops listening, which is exactly when the race settled.
 * `reason` is deliberately ABSENT: a row that ever reads it fails loudly here.
 */
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
  row = await loadSearchBackendRow()
  buildSearchFixture(ROOT_DIR)
  mkdirSync(BULK_SCRATCH, { recursive: true })
  plantBulk(BULK_ROOT, 4_000) // group B needs a walk long enough to still be running
}, SLOW)

afterAll(async () => {
  // A world is scratch, never state: the teardown is VERIFIED, and a world that
  // reappears is a red here rather than a mess left for the next run.
  const reappeared = await destroyWorldVerified(WORLD) + await destroyWorldVerified(BULK_WORLD)
  expect(reappeared).toBe(0)
  expect(sweepStrayWorlds('a5cancel-s')).toEqual([])
})

// ---------------------------------------------------------------------------
// OBS — the faces these legs lean on, calibrated before use
// ---------------------------------------------------------------------------

describe('a5-cancel/search OBS: the observation faces are calibrated before any leg leans on them', () => {
  it('OBS1 one accepted confined spawn is exactly one provider plan + one out dir; a capability probe is neither', async () => {
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
      grantFingerprint: `a5cancel-calib:${Date.now().toString(36)}`,
      realmId: REALM,
      bindingId: 'a5cancel-calib',
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

  it('OBS2 both cancel codes are rows of THIS row\'s frozen table, with prose that tells them apart', () => {
    const aborted = cancelLeg.CANCEL_CODE_ABORTED
    const unconfirmed = cancelLeg.CANCEL_CODE_UNCONFIRMED
    expect(row.SEARCH_REFUSAL_TEXT[aborted], 'no frozen prose for the confirmed stop').toBeTruthy()
    expect(row.SEARCH_REFUSAL_TEXT[unconfirmed], 'no frozen prose for the unconfirmed stop').toBeTruthy()
    expect(row.SEARCH_REFUSAL_FAMILIES[aborted]).toMatch(/^a5srgp-refused\/[a-z-]+$/)
    expect(row.SEARCH_REFUSAL_FAMILIES[unconfirmed]).toMatch(/^a5srgp-refused\/[a-z-]+$/)
    expect(row.SEARCH_REFUSAL_TEXT[aborted]).not.toBe(row.SEARCH_REFUSAL_TEXT[unconfirmed])
    // The sentences describe the CALL and its STOP — never a caller motive, and
    // never a fact about the payload.
    for (const text of [row.SEARCH_REFUSAL_TEXT[aborted] ?? '', row.SEARCH_REFUSAL_TEXT[unconfirmed] ?? '']) {
      expect(text).not.toMatch(/\buser\b|\bintent\b|asked/i)
      expect(text.includes(WORLD)).toBe(false)
    }
  })

  it('OBS3 the channel predicate is additive: an absent channel is not an abort', () => {
    expect(cancelLeg.callAborted(undefined)).toBe(false)
    expect(cancelLeg.callAborted(null)).toBe(false)
    const live = new AbortController()
    expect(cancelLeg.callAborted(live.signal)).toBe(false)
    live.abort(cancelReason())
    expect(cancelLeg.callAborted(live.signal)).toBe(true)
  })
  it('OBS4 the FD meter is scoped to this root, and a holder it cannot see is not a clean bill of health', async () => {
    // The release assertions in this file are only worth what the meter is worth, so
    // the meter gets the controls rather than the benefit of the doubt. FOUR holders
    // are open at the same instant and the answer has to separate them exactly:
    //   ROOT_DIR itself  — THE PRODUCTION CASE: the pinned anchor is a DIRECTORY
    //                      descriptor, so this is the one a `root + sep` prefix test
    //                      would silently miss;
    //   a file inside    — must be named by its own fd number and its own path;
    //   `<root>-sib`     — a sibling spelled like the root, which a loose `startsWith`
    //                      would fold in, so it must stay OUT;
    //   a file outside   — same world, not the root: present in the raw listing at
    //                      that very moment, invisible to this meter (which is why a
    //                      whole-process count is not used here).
    // Everything opened or written here is given back afterwards whatever the
    // assertions did — and the giving-back never DISPLACES a failure: the body's own
    // error is what fails the leg, and a release that left something behind is
    // reported too, either on its own or in the message of the combined one.
    const holder = join(ROOT_DIR, 'fd-meter-holder')
    const outside = join(WORLD, 'fd-meter-outside')
    const sibling = `${ROOT_DIR}-sib`
    let dirFd = -1
    let insideFd = -1
    let foreignFd = -1
    let siblingFd = -1
    let primary: unknown
    let failed = false
    try {
      writeFileSync(holder, 'held\n')
      writeFileSync(outside, 'held\n')
      mkdirSync(sibling)
      expect(heldFdsUnder(ROOT_DIR), 'a holder existed before the control opened one').toEqual([])
      dirFd = openSync(ROOT_DIR, 'r')
      insideFd = openSync(holder, 'r')
      foreignFd = openSync(outside, 'r')
      siblingFd = openSync(sibling, 'r')
      const seen = heldFdsUnder(ROOT_DIR)
      expect(seen, 'the meter did not name the root DIRECTORY descriptor').toContain(`${String(dirFd)}:.`)
      expect(seen, 'the meter did not name the descriptor inside the root').toContain(`${String(insideFd)}:fd-meter-holder`)
      expect(seen.some((l) => l.startsWith(`${String(siblingFd)}:`)), 'the meter folded in a sibling of the root').toBe(false)
      expect(seen.some((l) => l.startsWith(`${String(foreignFd)}:`)), 'the meter counted a descriptor outside its root').toBe(false)
      closeSync(dirFd)
      dirFd = -1
      closeSync(insideFd)
      insideFd = -1
      expect(heldFdsUnder(ROOT_DIR), 'a closed descriptor is still counted').toEqual([])
      // THE SIBLING AND THE OUTSIDE DESCRIPTOR ARE STILL OPEN at this point: the empty
      // answer above is a statement about this root, not about whether the process
      // holds anything at all.
    } catch (fault) {
      primary = fault
      failed = true
    }
    const leftovers: string[] = []
    for (const fd of [dirFd, insideFd, foreignFd, siblingFd]) {
      if (fd === -1) continue
      try {
        closeSync(fd)
      } catch (fault) {
        leftovers.push(`fd ${String(fd)}: ${String((fault as Error).message)}`)
      }
    }
    for (const path of [holder, outside]) {
      try {
        unlinkSync(path)
      } catch (fault) {
        if ((fault as { code?: string }).code !== 'ENOENT') leftovers.push(`${path}: ${String((fault as Error).message)}`)
      }
    }
    try {
      rmdirSync(sibling)
    } catch (fault) {
      if ((fault as { code?: string }).code !== 'ENOENT') leftovers.push(`${sibling}: ${String((fault as Error).message)}`)
    }
    if (failed) {
      if (leftovers.length > 0) throw new Error(`the control failed AND its release left: ${leftovers.join('; ')}; original: ${String((primary as Error).message)}`)
      throw primary
    }
    expect(leftovers, 'the control could not give everything back').toEqual([])
    expect(heldFdsUnder(ROOT_DIR), 'the control left a holder on the root').toEqual([])
  }, SLOW)

})

// ---------------------------------------------------------------------------
// A — the boundaries before the child: a cancel that costs nothing
// ---------------------------------------------------------------------------

describe('a5-cancel/search A: a cancel before the spawn costs zero provider work', () => {
  it('A1 pre-abort: EXACTLY code call-aborted, zero provider spawn, zero sink, no descriptor held, no reason echoed', async () => {
    const { backend } = makeBackend(ROOT_DIR, SCRATCH)
    const ac = new AbortController()
    ac.abort(cancelReason())
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-pre', ac.signal)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    // EXACTLY this code, not "one of the cancel codes": at zero spawn there is
    // nothing that could still be running, so `termination-unconfirmed` would be
    // the wrong claim about a call that never started anything.
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.class).toBe('undetermined')
    expect(result.failure.family).toBe(row.SEARCH_REFUSAL_FAMILIES['call-aborted'])
    expect(result.failure.detail).toBe(row.SEARCH_REFUSAL_TEXT['call-aborted'])
    expect(result.failure.counts).toEqual({ children: 0 })
    // THE PROVIDER LAYER, not the row's own counter: no plan, no out dir.
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(backend.execCount()).toBe(0) // cross-check only — see the header
    expect(sink.writes()).toBe(0)
    expect(heldFdsUnder(ROOT_DIR), 'the call came back holding the governed root').toEqual([])
    expect(JSON.stringify(result)).not.toContain(REASON_CANARY)
    expect(backend.lastStageTrace).toEqual(['probe', 'cancel'])
  }, SLOW)

  it('A2 an abort landing at the first await boundary still costs zero provider work', async () => {
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
    const ac = new AbortController()
    queueMicrotask(() => ac.abort(cancelReason()))
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-early', ac.signal)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 0 })
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    // Nothing that looks like a walk, a spawn or a timeout was ever booked.
    expect(audit.filter((l) => l.includes('OK ') || l.includes('spawn') || l.includes('TIMEOUT'))).toEqual([])
  }, SLOW)

  it('A3 abort during the capability probe: the probe is not a spawn, and the refusal names its boundary', async () => {
    // The probe is per-backend, so a FRESH backend books `capability OK` for
    // THIS call; the abort fires on that line and the next boundary refuses.
    const ac = new AbortController()
    const armed = armAt('capability OK', () => ac.abort(cancelReason()))
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-cap', ac.signal)
    expect(armed.fired(), 'the capability boundary was never reached').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(cancelLines(audit).some((l) => l.includes('stage=after-capability') && l.includes('stop=no-child'))).toBe(true)
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    expect(backend.execCount()).toBe(0)
  }, SLOW)

  it('A4 abort during the anchor open: no spawn, and the pinned descriptor is back before the terminal', async () => {
    // Armed at the capability line, landing on a microtask: that is inside the
    // anchor open's awaits — after the probe boundary (already answered) and
    // before the pre-spawn one.
    const ac = new AbortController()
    const armed = armAt('capability OK', () => { queueMicrotask(() => ac.abort(cancelReason())) })
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-anchor', ac.signal)
    expect(armed.fired(), 'the capability boundary was never reached').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 0 })
    expect(cancelLines(audit).some((l) => l.includes('stage=after-anchor') && l.includes('children=0'))).toBe(true)
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    expect(heldFdsUnder(ROOT_DIR), 'the call came back holding the governed root').toEqual([])
  }, SLOW)

  it('A5 the last boundary before the provider is asked: a cancel there writes no plan at all', async () => {
    const ac = new AbortController()
    const armed = armAt('cancel-leg stage=pre-spawn-check', () => ac.abort(cancelReason()))
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-prespawn', ac.signal)
    expect(armed.fired(), 'the pre-spawn boundary was never booked').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(cancelLines(audit).some((l) => l.includes('stage=pre-spawn') && l.includes('children=0'))).toBe(true)
    // The provider was never reached: the plan it writes per accepted spawn is
    // still absent (the counter OBS1 calibrated).
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
    expect(backend.execCount()).toBe(0)
  }, SLOW)
})

// ---------------------------------------------------------------------------
// B — a child exists: the owned stop, and the handle that arrives too late
// ---------------------------------------------------------------------------

describe('a5-cancel/search B: once a child exists, the row owns its stop', () => {
  it('B1 a handle that arrives AFTER the caller gave up is adopted and stopped, not raced away', async () => {
    // The abort lands while `spawnStreaming` is still awaiting — the case a
    // `Promise.race` over the spawn promise loses, because the payload exists a
    // moment later and nobody holds it. The row awaits the promise to its end,
    // ADOPTS what came back, and stops it through the one owned terminate.
    const ac = new AbortController()
    const armed = armAt('cancel-leg stage=pre-spawn-check', () => { queueMicrotask(() => ac.abort(cancelReason())) })
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH, armed)
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-late', ac.signal)
    expect(armed.fired(), 'the pre-spawn boundary was never booked').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 1 })
    // PROVIDER FACT: the ask did reach the provider (the row never cancels a
    // spawn it already requested) — one plan, one out dir.
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(backend.execCount()).toBe(1) // cross-check only
    // And the row READ the stop: the audit line carries the provider's own word.
    expect(cancelLines(audit).some((l) => l.includes('stage=after-spawn') && l.includes('children=1') && l.includes('stop=terminated'))).toBe(true)
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-search OK'))).toBe(false)
  }, SLOW)

  it('B2 an abort while the payload is live stops it and refuses — never an empty answer, never a published one', async () => {
    // THE DETERMINISTIC BARRIER: the channel reports the withdrawal from inside
    // `addEventListener`, i.e. at the exact instant the row finishes arming itself
    // to hear it, with the child already adopted. No timer, no assumption about
    // how long a walk of this tree takes — the row's own `stage=child-live` line
    // proves the payload was live, and the tie law (a finished walk outranks a
    // cancel) says which stage word the answer must carry.
    const live = signalFiringOnSubscribe()
    const { backend, audit } = makeBackend(BULK_ROOT, BULK_SCRATCH)
    const marks = providerSpawnMarks(BULK_SCRATCH)
    const started = monotonicMs()
    const { result, sink } = await runCancelled(backend, 'ca-live', live.signal as never, { maxResults: 500 })
    const elapsedMs = monotonicMs() - started
    expect(live.subscribed(), 'the settle race never armed itself on the channel — the leg would prove nothing').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.class).toBe('undetermined')
    expect(result.failure.detail).toBe(row.SEARCH_REFUSAL_TEXT['call-aborted'])
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(audit.some((l) => l.includes('cancel-leg stage=child-live'))).toBe(true)
    expect(cancelLines(audit).some((l) => l.includes('stage=walk-aborted') && l.includes('stop=terminated'))).toBe(true)
    expect(providerSpawnMarks(BULK_SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-search OK'))).toBe(false)
    // The listener the race borrowed is back, whatever the winner was.
    expect(live.detaches()).toBe(live.attaches())
    // A cancel STOPS the payload: the row's own budget is 60 s, and this call
    // must not sit out. The bound is two orders of magnitude away from the
    // budget, so it is a fact about stopping, not a timing bet.
    expect(elapsedMs).toBeLessThan(10_000)
  }, SLOW)

  it('B3 a channel that fires twice while the payload is live yields ONE terminal and ONE stop', async () => {
    // Both notifications land inside the same `addEventListener` call — what a
    // caller who aborts twice in one tick does to an attached listener — and the
    // row answers once, stops once, publishes nothing.
    const live = signalFiringOnSubscribe(2)
    const { backend, audit } = makeBackend(BULK_ROOT, BULK_SCRATCH)
    const marks = providerSpawnMarks(BULK_SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-twice', live.signal as never, { maxResults: 500 })
    expect(live.attaches(), 'the row attached more than one listener to one channel').toBe(1)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    // ONE cancel terminal, ONE provider spawn, ONE child, zero published bytes.
    expect(cancelLines(audit)).toHaveLength(1)
    expect(providerSpawnMarks(BULK_SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(sink.writes()).toBe(0)
    expect(live.detaches()).toBe(live.attaches())
  }, SLOW)

  it('B4 a pre-aborted channel fired twice before the call is still one refusal with nothing to stop', async () => {
    const ac = new AbortController()
    ac.abort(cancelReason())
    ac.abort(new Error(`${REASON_CANARY}-second`)) // repeat: aborting an aborted signal
    const marks = providerSpawnMarks(SCRATCH)
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-double-pre', ac.signal)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 0 })
    expect(cancelLines(audit)).toHaveLength(1)
    expect(providerSpawnMarks(SCRATCH)).toEqual(marks)
    expect(sink.writes()).toBe(0)
  }, SLOW)
})

// ---------------------------------------------------------------------------
// C — the winner stands, the publication does not
// ---------------------------------------------------------------------------

describe('a5-cancel/search C: a cancel after the winner refuses the publication', () => {
  it('C1 the exit won, THEN the cancel arrived: the refusal lands at the boundary after the stop', async () => {
    // The channel flips the moment the row stops listening to it — i.e. after the
    // settle race named its winner (the walk finished) and before any answer is
    // committed. That is the only boundary production cannot announce, so it is
    // made deterministic at the channel face (see the helper). The row's answer
    // comes at the boundary IMMEDIATELY after its own stop await: the stop is an
    // await like any other, and a withdrawal that landed beside it is not allowed
    // to travel on into the verdict.
    const flip = signalFlippingOnRelease()
    const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
    const marks = providerSpawnMarks(SCRATCH)
    const sink = countingSink()
    const result = (await backend.run(cancelCall('ca-commit', flip.signal as never), sink)) as SearchBackendResult
    expect(flip.fired(), 'the settle race never registered/removed a listener — the leg would prove nothing').toBe(true)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('call-aborted')
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(cancelLines(audit).some((l) => l.includes('stage=after-settle'))).toBe(true)
    // The winner stands: the provider saw exactly one spawn and the stop is the
    // one the row took when the walk settled. NOTHING was published.
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-search OK'))).toBe(false)
    // And the tree really did have an answer to withhold: the same backend,
    // same call, no channel, publishes it.
    const control = countingSink()
    const plain = (await backend.run(cancelCall('ca-commit-control', undefined), control)) as SearchBackendResult
    expect(plain.ok).toBe(true)
    if (plain.ok !== true) return
    expect(plain.outcome.totalMatches).toBeGreaterThan(0)
    expect(control.writes()).toBe(1)
  }, SLOW)

  it('C2 a no-channel call and a never-fired channel are the same answer', async () => {
    // THE ADDITIVE LAW, pinned at the answer face: a channel that never fires
    // changes NOTHING a caller can see. (Match ORDER is normalized first: rg
    // walks in parallel and the same tree can be reported in a different order
    // across processes — a fact about rg that `alpha5-search-backend.test.ts`
    // normalizes the same way, never a promise this row makes.)
    const key = (m: { path: string; line?: number; text: string }): string => `${m.path}:${String(m.line)}:${m.text}`
    const noChannel = makeBackend(ROOT_DIR, SCRATCH)
    const live = new AbortController()
    const withChannel = makeBackend(ROOT_DIR, SCRATCH)
    const a = await runCancelled(noChannel.backend, 'ca-none', undefined)
    const b = await runCancelled(withChannel.backend, 'ca-live-none', live.signal)
    expect(a.result.ok).toBe(true)
    expect(b.result.ok).toBe(true)
    if (a.result.ok !== true || b.result.ok !== true) return
    expect([...b.result.outcome.matches].map(key).sort()).toEqual([...a.result.outcome.matches].map(key).sort())
    expect(b.result.outcome.totalMatches).toBe(a.result.outcome.totalMatches)
    expect(b.result.outcome.truncated).toBe(a.result.outcome.truncated)
    expect(JSON.stringify(b.result.settlement)).toBe(JSON.stringify(a.result.settlement))
    expect(withChannel.backend.lastStageTrace).toEqual(noChannel.backend.lastStageTrace)
    expect(withChannel.backend.execCount()).toBe(noChannel.backend.execCount())
    expect(b.sink.bytes()).toBe(a.sink.bytes())
    expect([...b.sink.text().split('\n')].sort()).toEqual([...a.sink.text().split('\n')].sort())
    // The disclosed difference is the cancel leg's own bookkeeping: a channel
    // call books its two boundary lines, a call without one books neither. Every
    // OTHER line the two calls produce is the same sequence.
    const strip = (lines: string[]): string[] => lines.filter((l) => !l.includes('cancel-leg stage='))
    expect(strip(withChannel.audit).map((l) => l.replace(/ca-live-none/g, 'X'))).toEqual(strip(noChannel.audit).map((l) => l.replace(/ca-none/g, 'X')))
    expect(withChannel.audit.some((l) => l.includes('cancel-leg stage=pre-spawn-check'))).toBe(true)
    expect(noChannel.audit.some((l) => l.includes('cancel-leg stage='))).toBe(false)
  }, SLOW)
  it('C3 EVERY boundary the row asks its channel answers with the refusal, and the last one is the commit', async () => {
    // The sweep, not the sample: a channel that counts asks answers "aborted"
    // from the N-th ask onward, so N picks a boundary exactly. For every N the
    // call must end in THIS row's typed refusal with zero published bytes; the
    // first boundary must still cost no provider work; the LAST boundary of the
    // path must be the one that stands directly in front of the publication.
    const probe = makeBackend(ROOT_DIR, SCRATCH)
    const asks = await measureChannelAsks(probe.backend, 'ca-sweep-probe')
    expect(asks, 'the row asked its channel fewer times than the leg can distinguish').toBeGreaterThanOrEqual(6)
    const seenStages: string[] = []
    for (let n = 1; n <= asks; n += 1) {
      const { backend, audit } = makeBackend(ROOT_DIR, SCRATCH)
      const marks = providerSpawnMarks(SCRATCH)
      const fired = signalFiringOnAsk(n)
      const { result, sink } = await runCancelled(backend, `ca-sweep-${String(n)}`, fired.signal as never)
      expect(result.ok, `ask #${String(n)} published an answer to a withdrawn call`).toBe(false)
      if (result.ok !== false) return
      expect(result.failure.code, `ask #${String(n)} answered with the wrong code`).toBe('call-aborted')
      expect(sink.writes(), `ask #${String(n)} wrote to the caller's channel`).toBe(0)
      const lines = cancelLines(audit)
      expect(lines, `ask #${String(n)} booked no cancel terminal`).toHaveLength(1)
      const stage = /stage=([a-z-]+)/.exec(lines[0] ?? '')?.[1] ?? ''
      expect(stage, `ask #${String(n)} named no boundary`).not.toBe('')
      seenStages.push(stage)
      // Before a child exists the withdrawal has to be free at the provider too.
      if (lines[0]?.includes('children=0') === true) {
        expect(providerSpawnMarks(SCRATCH), `ask #${String(n)} cost provider work`).toEqual(marks)
      }
    }
    // The last ask of the path is the boundary in front of the sink write, and the
    // sweep walked the boundary list in order — the row cannot answer a late ask at
    // an early stage.
    expect(seenStages[asks - 1]).toBe('before-commit')
    // The measured shape of the path, printed as evidence rather than as a number
    // this file asserts and nobody can see: how many asks a successful search makes,
    // and the boundary words the row answered the sweep with.
    console.info(`[a5-cancel/search C3] measured asks=${String(asks)} stages=${seenStages.join(' > ')}`)
    // THE MAP, pinned position by position rather than merely ordered: order alone
    // cannot see a checkpoint that vanished, because the refusal just lands one
    // boundary later and every weaker claim still holds. Ask n must be answered at
    // the n-th boundary of THIS row's list. The repeated `after-settle` is the row's
    // two asks around the lease-arm await — which face to await, and the way out of
    // it — and the pin names that instead of demanding distinct words nobody promised.
    // THIS MAP IS THE DIRECTORY-TARGET PATH — what `searchCall` names by default and
    // what every leg here calls. The file-target path of the same row carries ONE
    // more boundary (`after-target-verify`, after the per-file verification await);
    // no leg in this file walks the file-target path with a channel, so that word is
    // pinned statically in S4 and not pretended to be swept here.
    const map = ['entry', 'after-rg-path', 'after-capability', 'after-anchor', 'pre-spawn', 'after-spawn', 'walk-aborted', 'after-settle', 'after-settle', 'after-governed-recheck', 'after-shared-law', 'after-verify', 'before-commit']
    expect(asks, `the row asks its channel ${String(asks)} times; this map pins ${String(map.length)}`).toBe(map.length)
    expect(seenStages).toEqual(map)
    // The sweep never answers a LATER ask at an EARLIER boundary. (Two asks can
    // legitimately share a word: the row asks once to decide which face of its
    // lease arm to await and once again right after that await, and both answer
    // `after-settle` — so this checks monotonicity, not distinctness.)
    const order = ['entry', 'after-rg-path', 'after-capability', 'after-anchor', 'after-target-verify', 'pre-spawn', 'after-spawn', 'walk-aborted', 'after-settle', 'after-governed-recheck', 'after-shared-law', 'after-verify', 'before-commit']
    const rank = seenStages.map((stage) => {
      const at = order.indexOf(stage)
      expect(at, `the row answered an unknown cancel stage ${stage}`).toBeGreaterThan(-1)
      return at
    })
    for (let i = 1; i < rank.length; i += 1) {
      expect(rank[i], `ask #${String(i + 1)} answered BEFORE ask #${String(i)}`).toBeGreaterThanOrEqual(rank[i - 1] ?? 0)
    }
  }, SLOW)

})

// ---------------------------------------------------------------------------
// T — the shipped mechanics, driven through their own injectable seams
// ---------------------------------------------------------------------------

describe('a5-cancel/search T: the tie law and the stop classification, no timing luck', () => {
  const syncSleep = (cb: () => void): undefined => { cb(); return undefined }
  const deafSleep = (): undefined => undefined
  const settledExit = { code: 0, signal: '' }
  const neverSettles = (): Promise<never> => new Promise<never>(() => {})

  it('T1 the tie law exited > timedOut > aborted, three permutations in one tick', async () => {
    const preAborted = new AbortController()
    preAborted.abort(cancelReason())
    // All three facts present at once: the payload finished, so the finished
    // payload answers, and the cancel does not rewrite it.
    expect(await cancelLeg.raceConfinedSettle({ exited: Promise.resolve(settledExit), timeoutMs: 0, signal: preAborted.signal, sleep: syncSleep }))
      .toEqual(settledExit)
    // Timeout and cancel at once, no exit: the budget outranks the channel.
    expect(await cancelLeg.raceConfinedSettle({ exited: neverSettles(), timeoutMs: 0, signal: preAborted.signal, sleep: syncSleep }))
      .toEqual({ timedOut: true })
    // Cancel alone: the channel answers.
    expect(await cancelLeg.raceConfinedSettle({ exited: neverSettles(), timeoutMs: 60_000, signal: preAborted.signal, sleep: deafSleep }))
      .toEqual({ aborted: true })
    // And with NO channel the leg list is the historical pair: the timeout still
    // answers an unfinished walk exactly as it did before this leg existed.
    expect(await cancelLeg.raceConfinedSettle({ exited: neverSettles(), timeoutMs: 0, sleep: syncSleep }))
      .toEqual({ timedOut: true })
  })

  it('T2 the race gives back BOTH resources it borrows — the listener and the budget timer — on every path', async () => {
    const calls: string[] = []
    const channel = {
      aborted: false,
      addEventListener: () => { calls.push('add') },
      removeEventListener: () => { calls.push('remove') },
    }
    const winner = await cancelLeg.raceConfinedSettle({ exited: Promise.resolve(settledExit), timeoutMs: 60_000, signal: channel, sleep: deafSleep })
    expect(winner).toEqual(settledExit)
    expect(calls).toEqual(['add', 'remove'])
    // An already-fired channel needs no listener at all, and still leaves none.
    const preAborted = new AbortController()
    preAborted.abort(cancelReason())
    expect(await cancelLeg.raceConfinedSettle({ exited: neverSettles(), timeoutMs: 60_000, signal: preAborted.signal, sleep: deafSleep }))
      .toEqual({ aborted: true })

    // THE TIMER. `unref()` only says a live timer must not hold the process open;
    // the release is a `clearTimeout`, and this watches the clear face directly:
    // one handle armed per race, exactly one clear per settle, whatever won.
    const armed: Array<{ ms: number; cleared: boolean }> = []
    // The spy schedules for real (5 ms) so the timeout leg still wins when
    // nothing else settles — the leg is about the CLEAR, and a sleep seam that
    // never fires would make the race itself hang.
    const spySleep = (cb: () => void, ms: number): unknown => {
      const handle = { ms, cleared: false }
      armed.push(handle)
      setTimeout(cb, Math.min(ms, 5))
      return handle
    }
    const spyClear = (handle: unknown): void => {
      const h = handle as { cleared: boolean }
      expect(h.cleared, 'the race cleared the same handle twice').toBe(false)
      h.cleared = true
    }
    const channelOf = (): { aborted: boolean; addEventListener(t: string, cb: () => void): void; removeEventListener(): void } => ({
      aborted: false,
      addEventListener: (_t: string, cb: () => void): void => { cb() }, // fires at subscribe
      removeEventListener: (): void => { /* the race gives it back */ },
    })
    const a = channelOf()
    expect(await cancelLeg.raceConfinedSettle({ exited: neverSettles(), timeoutMs: 5_000, signal: a, sleep: spySleep, clear: spyClear })).toEqual({ aborted: true })
    expect(await cancelLeg.raceConfinedSettle({ exited: Promise.resolve(settledExit), timeoutMs: 5_000, sleep: spySleep, clear: spyClear })).toEqual(settledExit)
    expect(await cancelLeg.raceConfinedSettle({ exited: neverSettles(), timeoutMs: 5_000, sleep: spySleep, clear: spyClear })).toEqual({ timedOut: true })
    // THE ORDER of the clear is part of the law: the race clears BEFORE it hands
    // the winner up, so no await in the row can run with a timer still armed.
    expect(armed.every((h) => h.cleared), 'a settle race handed its winner up before clearing').toBe(true)
    // THE EXCEPTION PATH: a rejected `exited` is the provider's own fault and the
    // race hands it up untouched — and it still clears its timer on the way out.
    await expect(cancelLeg.raceConfinedSettle({
      exited: Promise.reject(new Error('the provider face failed')),
      timeoutMs: 5_000,
      signal: channelOf(),
      sleep: spySleep,
      clear: spyClear,
    })).rejects.toThrow('the provider face failed')
    expect(armed).toHaveLength(4)
    expect(armed.every((h) => h.cleared), 'a settle race left its budget timer armed').toBe(true)
  })

  it('T5 a settled race really is not holding a timer (default seams, real clearTimeout)', async () => {
    // Same claim at the seam the rows actually use: the helper's own default
    // `sleep`/`clear` pair. The budget is 60 s and the race settles immediately on
    // the exit; if the settle only UNREFED the handle, this timer would still be
    // armed 60 s later, so waiting past the (much shorter) probe below and finding
    // it unfired measures the release itself.
    const seen: Array<{ fired: boolean }> = []
    const recording = (cb: () => void, ms: number): unknown => {
      const slot = { fired: false }
      seen.push(slot)
      return setTimeout(() => { slot.fired = true; cb() }, ms)
    }
    const winner = await cancelLeg.raceConfinedSettle({ exited: Promise.resolve(settledExit), timeoutMs: 1, sleep: recording })
    expect(winner).toEqual(settledExit)
    await new Promise((r) => { setTimeout(r, 50) })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.fired, 'the settled race left its 1 ms budget timer to fire — it was never cleared').toBe(false)
  })

  it('T3 the stop is only REPORTED stopped when the arm PROVED it — every other shape is UNCONFIRMED', async () => {
    const arm = (result?: () => unknown, throws = false) => ({
      terminate: async () => {
        if (throws) throw new Error('the arm itself failed')
        return result === undefined ? { ok: true, value: { status: 'terminated' } } : result()
      },
    })
    const stopOf = async (child: unknown): Promise<OwnedStop> => {
      const owned = cancelLeg.createOwnedStop()
      owned.adopt(child)
      return await owned.stop()
    }
    // The provider's word, read.
    expect(await stopOf(arm())).toEqual({ stopped: true, confirmedBy: 'provider', form: 'terminated' })
    // A refused terminate, a throwing arm, a lease that is not dead, a lease with
    // no shape at all: each is UNCONFIRMED, in its own words.
    expect(await stopOf(arm(() => ({ ok: false, error: { code: 'x' } })))).toEqual({ stopped: false, confirmedBy: null, form: 'terminate-refused' })
    expect((await stopOf(arm(undefined, true))).form).toBe('terminate-threw')
    expect(await stopOf(arm(() => ({ ok: true, value: { status: 'cancelling' } })))).toEqual({ stopped: false, confirmedBy: null, form: 'status-cancelling' })
    // THE STRICT LITERAL (review finding F1): confirmed means that exact word and
    // nothing that merely means it. A normaliser that folds case or trims
    // punctuation BEFORE the comparison would hand a caller `call-aborted` — "the
    // payload is provably stopped" — on a lease the provider never confirmed. Every
    // near-miss below is UNCONFIRMED, and the fold survives only in the audit word.
    for (const near of ['TERMINATED', ' terminated! ', 'Terminated', 'terminated\n', 'terminated ', 'terminated-ish']) {
      const stop = await stopOf(arm(() => ({ ok: true, value: { status: near } })))
      expect(stop.stopped, `status ${JSON.stringify(near)} was accepted as a confirmed stop`).toBe(false)
      expect(stop.confirmedBy).toBe(null)
      expect(stop.form.startsWith('status-'), `status ${JSON.stringify(near)} lost its audit word`).toBe(true)
    }
    // A non-string status is not a word to fold either.
    expect((await stopOf(arm(() => ({ ok: true, value: { status: 1 } })))).stopped).toBe(false)
    expect((await stopOf(arm(() => ({ ok: true, value: {} })))).form).toBe('status-missing')
    expect((await stopOf(arm(() => undefined))).form).toBe('terminate-unshaped')
    expect((await stopOf({})).form).toBe('no-terminate-arm')
    // The absence of a child is the ONE honest "stopped" that needs no arm.
    const nothing = cancelLeg.createOwnedStop()
    expect(await nothing.stop()).toEqual({ stopped: true, confirmedBy: 'never-spawned', form: 'no-child' })
    expect(nothing.child()).toBe(null)
  })

  it('T4 ONE terminate per call however many boundaries ask, and a handle that arrives late is still stopped', async () => {
    let kills = 0
    const owned = cancelLeg.createOwnedStop()
    owned.adopt({ terminate: async () => { kills += 1; return { ok: true, value: { status: 'terminated' } } } })
    // THE SAME PROMISE, and the identity is taken BEFORE anything is awaited:
    // comparing three awaited values would only show three equal snapshots, which
    // three separate terminates would also produce. Same object, same arm.
    const p1 = owned.stop()
    const p2 = owned.stop()
    const p3 = owned.stop()
    expect(p2).toBe(p1)
    expect(p3).toBe(p1)
    await Promise.all([p1, p2, p3])
    expect(kills).toBe(1)
    // THE RAW FACE is the same single arm too — one terminate for the whole call
    // whichever face the boundary asks with.
    expect(owned.rawStop()).toBe(owned.rawStop())
    // The late handle: the caller gave up while the spawn was still awaiting, so
    // the stop settled on empty ownership — and the handle that showed up after
    // is ADOPTED into the stop path rather than dropped with the payload live.
    const late = cancelLeg.createOwnedStop()
    const first = await late.stop()
    expect(first).toEqual({ stopped: true, confirmedBy: 'never-spawned', form: 'no-child' })
    let killed = 0
    late.adopt({ terminate: async () => { killed += 1; return { ok: true, value: { status: 'terminated' } } } })
    expect(await late.stop()).toEqual({ stopped: true, confirmedBy: 'provider', form: 'terminated' })
    expect(killed).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// S — the laws that live in the row's shape, not in one call
// ---------------------------------------------------------------------------

describe('a5-cancel/search S: source laws of the cancel leg in this row', () => {
  it('S1 the codes are borrowed spellings, the table stays owned here', () => {
    const src = rowSource()
    expect(src).toMatch(/import \{[^}]*CANCEL_CODE_ABORTED[^}]*CANCEL_CODE_UNCONFIRMED[^}]*\} from '\.\/cancel-leg\.mjs'/)
    // The row does not mint the words inline at a refusal site; it names them.
    expect(src).toMatch(/failure\('undetermined', code/)
    expect(src).not.toMatch(/failure\([^\n)]*'call-aborted'/)
    expect(src).not.toMatch(/failure\([^\n)]*'termination-unconfirmed'/)
  })

  it('S2 the cancel terminal is a refusal built by failure(), never a result', () => {
    const src = rowSource()
    const at = src.indexOf('const cancelRefusal')
    expect(at, 'the row has no cancel terminal').toBeGreaterThan(-1)
    const body = src.slice(at, src.indexOf('if (callAborted(cancelSignal)) return await cancelRefusal', at))
    expect(body).toContain("failure('undetermined'")
    expect(body).toContain('CANCEL_CODE_ABORTED')
    expect(body).toContain('CANCEL_CODE_UNCONFIRMED')
    // The two arms hang off the ONE `stopped` fact the helper read, and nothing
    // else: no second source of truth about whether the payload is alive.
    expect(body).toMatch(/stop\.stopped === true \? CANCEL_CODE_ABORTED : CANCEL_CODE_UNCONFIRMED/)
    // A cancel never mints an answer, and never reuses the walk's own shapes.
    expect(body).not.toContain('ok: true')
    expect(body).not.toContain('settlement')
    expect(body).not.toMatch(/\bsink\b/)
  })

  it('S3 the row touches the channel through the predicate and the race, and never reads its reason', () => {
    const src = rowSource()
    expect(src).not.toMatch(/\bsignal\.reason\b|cancelSignal\.reason|\.reason\b/)
    // No listener of the row's own outlives the race: the only channel face the
    // row names is the one handed to the shared race.
    expect(src).not.toMatch(/addEventListener/)
    expect(src.match(/callAborted\(cancelSignal\)/g)?.length).toBeGreaterThanOrEqual(6)
    expect(src).toContain('raceConfinedSettle({')
  })

  it('S4 one publication site, and it sits after every cancel arm that could refuse the call', () => {
    const src = rowSource()
    expect(src.match(/sink\?\.write\(/g)).toHaveLength(1)
    const write = src.indexOf('sink?.write(')
    expect(write).toBeGreaterThan(-1)
    const stages = ['entry', 'after-rg-path', 'after-capability', 'after-anchor', 'after-target-verify', 'pre-spawn', 'after-spawn', 'walk-aborted', 'after-settle', 'after-governed-recheck', 'after-shared-law', 'after-verify', 'before-commit']
    let previous = -1
    for (const stage of stages) {
      const at = src.indexOf(`'${stage}'`)
      expect(at, `the cancel arm for ${stage} is gone from the row`).toBeGreaterThan(-1)
      expect(at, `the cancel arm for ${stage} moved ahead of the one before it`).toBeGreaterThan(previous)
      previous = at
    }
    // The arms that must NOT be able to publish sit before the publication; the
    // one that exists precisely to stop it sits immediately before.
    expect(src.indexOf("cancelRefusal('before-commit'")).toBeLessThan(write)
    expect(src.lastIndexOf("cancelRefusal('walk-aborted'")).toBeLessThan(write)
  })

  it('S5 the row reads its own lease arm RAW when nobody cancelled, classified only when someone did', () => {
    // THE OLD CONTRACT IS STILL THERE (review finding F3). On a path no caller
    // withdrew from, the row awaits THE provider arm and lets its rejection reach
    // `run`'s catch; only the cancel branches read the classified stop, whose two
    // answers are "confirmed" and "not confirmed" and which cannot throw. Static,
    // because the fault itself is what group D forges.
    const src = rowSource()
    expect(src.match(/await owned\.rawStop\(\)/g)).toHaveLength(1)
    // The raw await is wrapped in a LOCAL catch, and that catch is allowed to
    // convert the fault into a cancel answer ONLY on a path that is neither the
    // timeout winner nor a call nobody withdrew from: everything else rethrows.
    expect(src).toMatch(/if \(cancelled && !timedOut\) await owned\.stop\(\)/)
    expect(src).toMatch(/if \(timedOut \|\| !callAborted\(cancelSignal\)\) throw fault/)
    // The classified face is asked from the cancel terminal, the cancelled branch,
    // and the fault path that has just established the caller withdrew — three, no
    // more, and never to decide anything but the code word.
    expect(src.match(/await owned\.stop\(\)/g)).toHaveLength(3)
    // One reading of the stop's `stopped` fact, in the terminal.
    expect(src.match(/stop\.stopped/g)).toHaveLength(1)
    // The pipe release is not scattered over the arms any more: it is installed as
    // a slot and called from the block's ONE finally, so no exit can miss it.
    // Exactly ONE call site for it, and it is the `finally` — the arms no longer
    // release by hand, which is what makes "every exit" a property of the block
    // rather than of the list of arms somebody remembered to write.
    expect(src.match(/releaseStreamListeners\(\)/g)).toHaveLength(1)
    expect(src).toMatch(/finally \{[\s\S]{0,400}?releaseStreamListeners\(\)[\s\S]{0,200}?anchor\.handle\.close\(\)/)
  })
})

// ---------------------------------------------------------------------------
// D — a lease arm that throws, forged into the REAL provider behind the row
// ---------------------------------------------------------------------------

describe('a5-cancel/search D: a throwing terminate keeps the contract of the path that asked (F3, and the raw-arm interleaving)', () => {
  const THROW_CANARY = 'A5CANCEL-TERMINATE-FAULT-MUST-NOT-TRAVEL'
  let forgedRow: SearchBackendRow
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
  // The handles are recorded AS THE PROVIDER'S OWN FACE (`StreamingSpawnHandle`), so
  // the cleanup calls the arm the provider declares and reads the lease status the
  // provider publishes (`ProviderLease['status']`, whose closed set includes
  // 'terminated') — nothing invented, nothing cast to a look-alike shape.
  const forgedChildren: StreamingSpawnHandle[] = []
  const stopRealChildren = async (): Promise<void> => {
    const owed = forgedChildren.splice(0, forgedChildren.length)
    const seen: string[] = []
    for (const child of owed) {
      let status = 'never-asked'
      for (let attempt = 0; attempt < 40 && status !== 'terminated'; attempt += 1) {
        // A throwing arm is its own outcome ('threw'); a refused one is 'refused';
        // anything else is the lease's real status, read through the arm's type.
        const settled: ProviderResult<ProviderLease> | null = await child.terminate().catch(() => null)
        status = settled === null ? 'threw' : settled.ok === true ? settled.value.status : 'refused'
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
    if (owed.length > 0) console.info(`[a5-cancel/search D] real teardown confirmed: search D -> ${seen.join(', ')}`)
  }

  beforeAll(async () => {
    // The forge sits BELOW the row, at the provider module the row imports, and
    // replaces ONE face of the handle it hands back: `terminate()`. Everything
    // else — the real plan, the real child, the real walk, the real capability
    // probe — is the real thing, so what these two legs measure is the row's own
    // handling of an arm that fails, on the path each of them belongs to.
    vi.resetModules()
    // The specifier has to be resolved in this module registry once before the
    // row's own import of it picks the mock up; without this priming import the
    // factory never runs and the legs would silently test the real provider.
    await import('../sandbox-provider/index.js')
    vi.doMock('../sandbox-provider/index.js', async (importOriginal) => {
      const actual = (await importOriginal()) as Record<string, unknown>
      const realCreate = actual.createConfinedProcessProvider as (cfg: unknown) => ConfinedProvider
      // A COPY with one face replaced, not a `Proxy`: the provider's own object is
      // `Object.freeze`d, and a proxy whose `get` returns something other than a
      // frozen target's value is a TypeError at the trap — which the row would
      // report as `spawn-failed` and the leg would measure the wrong thing.
      // A refusal carries no handle to stop, so it travels untouched; a granted one
      // is recorded and returned with ONLY its `terminate` face replaced.
      const wrapChild = (settled: StreamSettle): StreamSettle => {
        if (settled.ok !== true) return settled
        // Record the real handle BEFORE replacing the face, so the cleanup below can
        // stop what this forgery made un-stoppable.
        forgedChildren.push(settled.value)
        return {
          ...settled,
          value: {
            ...settled.value,
            terminate: async (): Promise<never> => {
              terminateCalls += 1
              throw new Error(THROW_CANARY)
            },
          },
        }
      }
      // The confined rows take `spawnStreaming` and nothing else (one call site each,
      // `provider.spawnStreaming(request)`), so that is the only face rewrapped: the
      // copy's other members — `spawn` included — are the real ones the spread carried.
      const forge = (cfg: unknown): ConfinedProvider => {
        const real = realCreate(cfg)
        return {
          ...real,
          spawnStreaming: async (request: SpawnRequest, streaming?: StreamingOptions): Promise<StreamSettle> =>
            wrapChild(await real.spawnStreaming(request, streaming)),
        }
      }
      return { ...actual, createConfinedProcessProvider: forge }
    })
    // The row's declared face comes from the lane harness (`loadGlobBackendRow`/
    // `loadSearchBackendRow`): the row is plain .mjs with no declaration file of its
    // own, by design, and the harness is where its compile face is written down.
    // After `resetModules` this is a fresh import, so it is the FORGED module.
    forgedRow = await loadSearchBackendRow()
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
  ): { backend: SearchBackend; audit: string[] } => {
    const audit: string[] = []
    const backend = forgedRow.createAnchoredRgSearchBackend({
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

  it('D1 with NO channel, the row keeps its pre-existing throwing-arm contract: a typed refusal, not a published walk', async () => {
    terminateCalls = 0
    const { backend, audit } = makeForged()
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-forged-plain', undefined)
    // The walk really ran: the provider was asked for the child, and the fault is
    // reached at the row's OWN await of the arm, on a path nobody cancelled.
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(result.ok, 'a throwing lease arm turned into a successful walk').toBe(false)
    if (result.ok !== false) return
    // THE contract `await child.terminate()` had here before this leg existed: the
    // rejection reaches `run`'s catch, which answers the row's own internal fault.
    expect(result.failure.code).toBe('internal-error')
    expect(result.failure.class).toBe('undetermined')
    expect(audit.some((l) => l.includes('anchored-search INTERNAL-FAULT'))).toBe(true)
    expect(audit.some((l) => l.includes('anchored-search OK'))).toBe(false)
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)
    expect(sink.writes()).toBe(0)
    // The fault text stays off the answer: the frozen table speaks, the thrower
    // does not (its words belong to the internal face, which is off by default).
    expect(JSON.stringify(result.failure)).not.toContain(THROW_CANARY)
    expect(audit.join('\n')).not.toContain(THROW_CANARY)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D1
    // THE RELEASE LAW, MEASURED WHERE IT IS MEASURABLE: what is asserted here is that
    // THIS process holds no descriptor on the governed root, after the child this
    // forgery left behind was stopped for real and confirmed through the provider's
    // own face. The ordering is a fact about the leg — an un-stopped child keeps the
    // row's own wait and pipes busy — and the claim stays inside what `/proc/self/fd`
    // can show: the runner's table. The child's own descriptors are not observable
    // from here and are not claimed to be.
    expect(heldFdsUnder(ROOT_DIR), 'the governed root is still held after the call and the confirmed stop').toEqual([])
  }, SLOW)

  it('D2 on a CANCELLED call, the same throwing arm answers termination-unconfirmed with zero sink', async () => {
    terminateCalls = 0
    const live = signalFiringOnSubscribe()
    const { backend, audit } = makeForged()
    const marks = providerSpawnMarks(SCRATCH)
    const { result, sink } = await runCancelled(backend, 'ca-forged-cancel', live.signal as never)
    expect(providerSpawnMarks(SCRATCH)).toEqual({ plans: marks.plans + 1, outs: marks.outs + 1 })
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('termination-unconfirmed')
    expect(result.failure.class).toBe('undetermined')
    expect(result.failure.detail).toBe(row.SEARCH_REFUSAL_TEXT['termination-unconfirmed'])
    expect(result.failure.counts).toEqual({ children: 1 })
    // The row says, in its own audit word, that the stop could not be confirmed —
    // and it does not say WHICH thing about the arm went wrong beyond the shape.
    expect(cancelLines(audit).some((l) => l.includes('code=termination-unconfirmed') && l.includes('stop=terminate-threw'))).toBe(true)
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)
    expect(sink.writes()).toBe(0)
    expect(audit.some((l) => l.includes('anchored-search OK'))).toBe(false)
    // No echo: the thrower's sentence reaches neither the answer nor the audit.
    expect(JSON.stringify(result)).not.toContain(THROW_CANARY)
    expect(audit.join('\n')).not.toContain(THROW_CANARY)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D2
  }, SLOW)

  it('D3 the fault that arrives WHILE the caller withdraws, mid raw arm, is answered as the cancellation it is', async () => {
    // THE INTERLEAVING the review names, and it is the one a `try` around the whole
    // arm would have hidden: the row asked its channel at the settle boundary, was
    // told "no withdrawal", and took the RAW arm; only then did the caller give up
    // and the arm throw. The row's LOCAL catch asks the channel once more — one ask
    // per boundary, so the counting channel selects that ask exactly — finds the
    // withdrawal, and answers with the cancellation terminal built from the SAME
    // settled arm. The calibration run (same forged backend, a channel that answers
    // "no" to every ask) is what establishes which ask that is: it ends in D1's
    // internal fault, and this leg fires on that LAST ask.
    const calibration = makeForged()
    const never = signalFiringOnAsk(0)
    const { result: plain } = await runCancelled(calibration.backend, 'ca-forged-calib', never.signal as never)
    expect(plain.ok).toBe(false)
    // THE CALIBRATION IS ASSERTED AND IT RUNS: a code check written INSIDE
    // `if (plain.ok !== false)` can never execute for a call that failed, so it
    // would pass whether or not the row kept its contract. Fail loudly first, then
    // read the code off the narrowed value, and print it so the log shows the
    // assertion was reached.
    if (plain.ok !== false) throw new Error('D3: the calibration call did not fail at all')
    console.info(`[a5-cancel/search D3] calibration branch executed: code=${String(plain.failure.code)}`)
    expect(plain.failure.code, 'the calibration run is not the un-cancelled fault').toBe('internal-error')
    const asks = never.asks()
    expect(asks, 'the row asked its channel too few times for the boundary to be selectable').toBeGreaterThanOrEqual(5)

    terminateCalls = 0
    const { backend, audit } = makeForged()
    const fired = signalFiringOnAsk(asks)
    const { result, sink } = await runCancelled(backend, 'ca-forged-midarm', fired.signal as never)
    expect(result.ok, 'a withdrawn call with an unconfirmed stop published an answer').toBe(false)
    if (result.ok !== false) return
    // The CODE follows the confirmed fact, and the only fact the arm gave is that it
    // threw: nothing was confirmed, so this is 'termination-unconfirmed' — never the
    // confirmed-stop code, and never `ok: true`.
    expect(result.failure.code).toBe('termination-unconfirmed')
    expect(result.failure.detail).toBe(row.SEARCH_REFUSAL_TEXT['termination-unconfirmed'])
    expect(result.failure.counts).toEqual({ children: 1 })
    expect(sink.writes()).toBe(0)
    expect(cancelLines(audit)).toHaveLength(1)
    // ONE terminate for one call: the classified face is a READING of the promise
    // that already rejected, not a second request to the lease.
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)
    // The fault did not become an internal fault either: the caller withdrew, so the
    // cancellation owns the answer.
    expect(audit.some((l) => l.includes('anchored-search INTERNAL-FAULT'))).toBe(false)
    expect(JSON.stringify(result)).not.toContain(THROW_CANARY)
    expect(audit.join('\n')).not.toContain(THROW_CANARY)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D3
  }, SLOW)

  it('D4 a TIMEOUT winner keeps its own contract: with the arm throwing, no timeout shape is minted', async () => {
    // THE HARD CONSTRAINT on the other side of that same catch. `timeoutMs: 1` makes
    // the budget the winner of the settle race (a real rg walk of this fixture takes
    // far longer than a millisecond, and the CONTROL run on the unforged row shows
    // what that winner looks like when the arm answers). The caller withdraws at the
    // ask right after the race. Even so the row must take the RAW arm: swallowing a
    // fault there would hand back the timeout arm's `ok: true` empty outcome — "the
    // tree holds nothing" — for a walk nobody finished reading. So the fault
    // travels, and the row answers its own pre-existing internal fault.
    const real = makeBackend(BULK_ROOT, BULK_SCRATCH, undefined, { timeoutMs: 1 })
    const control = await runCancelled(real.backend, 'ca-timeout-control', undefined)
    expect(control.result.ok, 'the budget winner lost its own pre-existing shape').toBe(true)
    // Narrow on `ok` before reading the success-only face: `settlement` lives on the
    // admitted arm of the result union, and the typechecker is right that an
    // un-narrowed read could be a read of a refusal. Failing loudly here also keeps
    // the assertion below live instead of unreachable.
    if (control.result.ok !== true) throw new Error('the budget winner did not answer with its own shape')
    expect(control.result.settlement).toEqual({ kind: 'cancelled', event: 'search-walk-terminated-after-timeout' })

    const calibration = makeForged({ timeoutMs: 1 }, { rootDir: BULK_ROOT, scratchRoot: BULK_SCRATCH })
    const never = signalFiringOnAsk(0)
    const { result: plain } = await runCancelled(calibration.backend, 'ca-timeout-calib', never.signal as never)
    expect(plain.ok).toBe(false)
    // THE CALIBRATION IS ASSERTED AND IT RUNS: a code check written INSIDE
    // `if (plain.ok !== false)` can never execute for a call that failed, so it
    // would pass whether or not the row kept its contract. Fail loudly first, then
    // read the code off the narrowed value, and print it so the log shows the
    // assertion was reached.
    if (plain.ok !== false) throw new Error('D4: the calibration call did not fail at all')
    console.info(`[a5-cancel/search D4] calibration branch executed: code=${String(plain.failure.code)}`)
    expect(plain.failure.code, 'the timeout path did not keep the old fault contract').toBe('internal-error')
    const asks = never.asks()
    expect(asks, 'the timeout path never reached the boundary this leg selects').toBeGreaterThanOrEqual(5)

    terminateCalls = 0
    const { backend, audit } = makeForged({ timeoutMs: 1 }, { rootDir: BULK_ROOT, scratchRoot: BULK_SCRATCH })
    const fired = signalFiringOnAsk(asks)
    const { result, sink } = await runCancelled(backend, 'ca-timeout-fault', fired.signal as never)
    expect(result.ok, 'a throwing lease arm was swallowed into the timeout success shape').toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('internal-error')
    expect(result.failure.class).toBe('undetermined')
    expect(audit.some((l) => l.includes('anchored-search INTERNAL-FAULT'))).toBe(true)
    // The timeout arm's own line is NOT booked: the row never got there.
    expect(audit.some((l) => l.includes('anchored-search TIMEOUT'))).toBe(false)
    expect(sink.writes()).toBe(0)
    expect(cancelLines(audit)).toHaveLength(0)
    expect(terminateCalls, 'the row asked the lease arm twice for one call').toBe(1)

    // This leg's child outlived the forged arm: stop it for real and let the
    // provider's own face confirm it, before anything else in the file moves.
    await stopRealChildren() // D4
  }, SLOW)
})
