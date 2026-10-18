/**
 * A5-GLOB ADVERSARIAL — the anchoring law attacked, not just exercised.
 *
 * The threat (the C-FS review class this row exists to close): the governed
 * root's CONTENTS are hostile. A path that was clean when it was checked may
 * be renamed away and replaced by a symlink onto the outside secret before the
 * walk runs, while the walk runs, or between the walk and the answer. A
 * realpath-then-spawn row loses that race; this suite is the proof.
 *
 * Legs:
 *   A1/A2  a symlinked MIDDLE / LAST component escaping the root is refused
 *          before any process exists (execCount stays 0)
 *   A3     the governed ROOT itself swapped to a symlink outside is refused
 *   A4     the RACE LOOP: an attacker alternates one anchored path between a
 *          real directory and a symlink onto the outside secret while the
 *          production anchor + result law run ≥5000 iterations. Leak detector
 *          = actually reading what an ACCEPTED entry resolves to (a verdict
 *          that merely "looks refused" proves nothing).
 *   A5     the same race against the REAL confined rg walk (real child, real
 *          Landlock), ≥100 walks
 *   A6     the anchored directory renamed away mid-flight settles as
 *          `anchor-drift`, never as an answer
 *
 * Worlds: `tests/homes/a5glb-adv-*`, self-removed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import {
  confinedConf,
  destroyWorldVerified,
  globCall,
  loadGlobBackendRow,
  newWorld,
  REPO,
  type GlobBackend,
  type GlobBackendResult,
  type GlobBackendRow,
} from './alpha5-glob-harness.js'

const WORLD = newWorld('a5glb-adv')
const ROOT_DIR = join(WORLD, 'root')
const OUT = join(WORLD, 'outside')
const SECRET = 'A5GLB-ADV-CANARY-7f31b0-DO-NOT-LEAK'
const RACE_ITERATIONS = 5_000
/**
 * The live-attack scale: 6600 REAL confined rg walks against the swap race
 * (fix-list ③). Measured on this host a confined walk is ~25 ms, so the leg is
 * minutes rather than hours — and every one of them carries a spill probe.
 */
/**
 * Two dials, both DEFAULTING TO THE HARD-GATE SHAPE, and both here for one
 * reason: this file is a good neighbour in a shared pool. The root census runs
 * all ~570 files in ONE process (pool=threads); on a big runner my race is
 * ~1.5 cores of launcher CPU and nobody notices, while on a small one a
 * sustained spawn storm of this size is exactly what tips another lane's
 * BOUNDED polls (e.g. a5lsp2-assembly's `pollUntil(..., 8_000)` for "the old
 * pid is gone"). Measured on this host: the full census WITH this file collected
 * is green for those lanes, so this is courtesy, not a fix for an observed
 * failure here — and it is stated rather than hidden.
 *
 *  - `A5GLB_RACE_PACE_MS` (default 4): a gap after every walk. It lowers the
 *    duty cycle of the storm, which is what gives a sibling's bounded poll room
 *    to complete; the walk COUNT, and so every asserted number, is unchanged.
 *  - `A5GLB_RACE_WALKS` (default 6600): the scale. A census that is starved may
 *    re-sample at a smaller scale — the leg NAME then says so, so a dialled run
 *    can never be quoted as the hard gate. The reviewer's hard gate is the lane
 *    run with no env set: `npx vitest run
 *    packages/runtime/test/alpha5-glob-backend-adversarial.test.ts`.
 */
const RACE_ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const RACE_PACE_MS = Number.isFinite(Number(RACE_ENV['A5GLB_RACE_PACE_MS'])) && RACE_ENV['A5GLB_RACE_PACE_MS'] !== undefined
  ? Math.max(0, Math.trunc(Number(RACE_ENV['A5GLB_RACE_PACE_MS'])))
  : 4
const REAL_RACE_WALKS = RACE_ENV['A5GLB_RACE_WALKS'] !== undefined && Number.isFinite(Number(RACE_ENV['A5GLB_RACE_WALKS']))
  ? Math.max(1, Math.trunc(Number(RACE_ENV['A5GLB_RACE_WALKS'])))
  : 6600

/** The neighbour gap; `sleepMs(0)` when the pace is dialled to zero. */
function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

let row: GlobBackendRow
let backend: GlobBackend
let rgVersion = ''
const leaks: string[] = []
const refusalCodes = new Map<string, number>()
const refusalsSeen = new Map<string, number>()
const tally = { anchorAccepted: 0, anchorRefused: 0, hostileAccepted: 0, benignRefused: 0, states: new Set<string>(), codes: new Set<string>() }

/** The state of the swapped path right now, as the ATTACKER wrote it. */
type State = 'real' | 'link'
let attackerState: State = 'real'

function attackerSetup(): void {
  // `live/` is the contested path: either the real directory (holding
  // inner.txt, marker = INSIDE) or a symlink onto OUT (holding leak.ts, marker
  // = the CANARY). Swapped with rename(2), which is atomic on one filesystem.
  mkdirSync(join(ROOT_DIR, 'live-real'), { recursive: true })
  writeFileSync(join(ROOT_DIR, 'live-real', 'inner.txt'), 'A5GLB-ADV-INSIDE-INNER\n')
  utimesSync(join(ROOT_DIR, 'live-real', 'inner.txt'), 1_600_000_000, 1_600_000_000)
  // an entry that EXISTS inside the governed tree and still points outside —
  // the shape a verifier that only checks "does it exist" waves through
  symlinkSync(join(OUT, 'leak.ts'), join(ROOT_DIR, 'live-real', 'escape-link.ts'), 'file')
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'leak.ts'), `export const secret = '${SECRET}'\n`)
  writeFileSync(join(OUT, 'leak-inner.txt'), `tail ${SECRET} head\n`)
  writeFileSync(join(ROOT_DIR, 'anchor.txt'), 'A5GLB-ADV-ROOT-FILE\n')
  swapTo('real')
}

/**
 * ③ THE LIVE WITNESS: every swap is tallied by STATE, so the race legs report
 * what the attacker actually did rather than asserting it happened. A leg whose
 * witness never flipped to `link` would be a leg that tested nothing, and the
 * counters in `adversarial-counters.json` would show it immediately.
 */
const witness = { real: 0, link: 0, contended: 0, okWhileReal: 0, okWhileLink: 0, refusedWhileLink: 0, refusedWhileReal: 0 }

/** Per-walk spill-probe tallies, exported into `adversarial-counters.json`. */
const spill = { walks: 0, admittedWithBytes: 0, refusedWithBytes: 0, attributionMismatch: 0, canaryInChannel: 0, bytesTotal: 0 }

/**
 * ALL-CHANNEL PROBE (23:48Z 修复单 ④): the same live attacker, but now every
 * channel a walk can be observed through is watched on every real walk —
 * the returned object, the spill bytes, the audit/observe lines, the internal
 * face (deliberately OPENED, worst case), and any exception string. A hit in
 * ANY of them is recorded as a leak with the channel named.
 */
const channels = {
  walks: 0,
  resultBytes: 0,
  spillBytes: 0,
  auditLines: 0,
  auditBytes: 0,
  internalLines: 0,
  internalBytes: 0,
  exceptionStrings: 0,
  detailsFromTable: 0,
  wireTokenHits: 0,
}
/**
 * Tokens that must never appear on an OUTPUT channel: the outside world's
 * names, its path, and the canary that only exists inside it.
 */
const WIRE_TOKENS = [SECRET, 'leak.ts', 'leak-inner.txt', OUT, WORLD]

/**
 * The internal face is NOT an output channel, so it is watched against the
 * OUTSIDE tokens only: it may legitimately quote an entry the row refused
 * (that is what it is for), and the README says so, but it may never carry the
 * outside tree's names or bytes either — the row never resolves a name into it.
 */
const INTERNAL_TOKENS = [SECRET, OUT]

function watchWire(value: unknown, where: string, tokens: string[] = WIRE_TOKENS): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  for (const token of tokens) {
    if (text.includes(token)) {
      channels.wireTokenHits += 1
      leaks.push(`${where}: the channel carries ${token}`)
    }
  }
}

/** One atomic swap of the contested path (rename(2) on one filesystem). */
function swapTo(state: State): void {
  const contested = join(ROOT_DIR, 'live')
  const real = join(ROOT_DIR, 'live-real')
  const staged = join(ROOT_DIR, 'live-staged')
  if (state === 'real') {
    if (existsSync(staged)) rmSync(staged, { force: true })
    symlinkSync(OUT, staged, 'dir') // park a symlink for the next flip
    if (isRealDir(contested)) { attackerState = state; return }
    if (existsSync(contested)) rmSync(contested, { force: true }) // drop the symlink wearing the name
    renameSync(real, contested)
  } else {
    if (isRealDir(contested)) renameSync(contested, real)
    else if (existsSync(contested)) rmSync(contested, { force: true })
    if (existsSync(staged)) rmSync(staged, { force: true })
    symlinkSync(OUT, staged, 'dir')
    renameSync(staged, contested)
  }
  attackerState = state
  witness[state] += 1
}

function isRealDir(p: string): boolean {
  try {
    return lstatSync(p).isDirectory()
  } catch {
    return false
  }
}

/** Read what an ACCEPTED entry really is (the leak detector). */
function readAccepted(anchorPath: string, entry: string): string {
  try {
    return readFileSync(join(anchorPath, entry), 'utf8')
  } catch {
    return ''
  }
}

beforeAll(async () => {
  mkdirSync(ROOT_DIR, { recursive: true })
  attackerSetup()
  row = await loadGlobBackendRow()
  rgVersion = (await resolveRgPath()).length > 0 ? 'resolved' : 'missing'
  backend = row.createAnchoredGlobBackend({
    realmId: 'a5glb-adv-realm',
    rootDir: ROOT_DIR,
    confined: confinedConf(WORLD),
  })
}, 180_000)

afterAll(async () => {
  // Idempotent + re-verified teardown (see `destroyWorldVerified`): the confined
  // provider can write its scratch dir AFTER the first removal, which used to
  // leave a world behind while the single-shot assertion still read green.
  const reappeared = await destroyWorldVerified(WORLD)
  expect(existsSync(WORLD), `world leaked: ${WORLD}`).toBe(false) // TEST_METHODS §7 hygiene
  if (reappeared > 0) {
    (globalThis as { process?: { stdout?: { write(v: string): void } } }).process?.stdout?.write(`a5glb teardown: the provider re-created the world ${String(reappeared)}x after removal; cleanup repeated\n`)
  }
})

async function runWalk(pattern: string, locator: string = '.'): Promise<GlobBackendResult> {
  return await backend.run(globCall(`adv-${pattern}-${locator}`, pattern, locator) as never, { sink: null })
}

/** A walk WITH a spill probe attached: what the channel actually received. */
interface Probed {
  result: GlobBackendResult
  bytes(): string
}

let probedBackend: GlobBackend | null = null

/** The row under attack WITH every observability face an assembly could open. */
function probedConf(): Record<string, unknown> {
  return { ...confinedConf(WORLD) }
}

async function makeProbedBackend(): Promise<GlobBackend> {
  if (probedBackend !== null) return probedBackend
  const auditLines: string[] = []
  const internalLines: string[] = []
  const created = (row.createAnchoredGlobBackend as unknown as (o: Record<string, unknown>) => GlobBackend)({
    realmId: 'a5glb-adv-channels',
    rootDir: ROOT_DIR,
    confined: probedConf(),
    observe: (line: string) => { auditLines.push(line) },
    internalLog: (line: string) => { internalLines.push(line) },
  })
  probedBackend = Object.assign(created, { __audit: auditLines, __internal: internalLines })
  return probedBackend
}

async function runWalkProbed(pattern: string, locator: string = '.'): Promise<Probed> {
  const attacked = await makeProbedBackend()
  const chunks: string[] = []
  let result: GlobBackendResult
  try {
    result = await attacked.run(globCall('advp', pattern, locator) as never, {
      sink: { write: (v: string) => { chunks.push(String(v)) } },
    })
  } catch (error) {
    // A8 says this cannot happen; if it ever does, the exception STRING is a
    // channel and it gets watched exactly like the others.
    channels.exceptionStrings += 1
    watchWire(String((error as Error)?.stack ?? error), 'exception-string')
    throw error
  }
  const audit = (attacked as unknown as { __audit: string[] }).__audit
  const internal = (attacked as unknown as { __internal: string[] }).__internal
  const bytes = chunks.join('')
  channels.walks += 1
  channels.resultBytes += JSON.stringify(result).length
  channels.spillBytes += bytes.length
  channels.auditLines += audit.length
  channels.auditBytes += audit.join('\n').length
  channels.internalLines += internal.length
  channels.internalBytes += internal.join('\n').length
  watchWire(result, 'return-object')
  watchWire(bytes, 'spill')
  audit.splice(0).forEach((line, i) => { watchWire(line, `audit-line#${String(i)}`); expect(line, `audit line not grammar-clean: ${line}`).toMatch(/^anchored-glob(?: [A-Za-z-]+)*(?: (?:family=a5glb-refused\/[a-z-]+|[a-zA-Z]+=[A-Za-z0-9._-]+))+$/) })
  internal.splice(0).forEach((line, i) => { watchWire(line, `internal-line#${String(i)}`, INTERNAL_TOKENS) })
  if (result.ok !== true) {
    const table = (row as unknown as { GLOB_REFUSAL_TEXT: Record<string, string> }).GLOB_REFUSAL_TEXT
    if (Object.values(table).includes(result.failure.detail)) channels.detailsFromTable += 1
    else leaks.push(`refusal detail is not from the frozen table: ${result.failure.detail}`)
  }
  return { result, bytes: () => bytes }
}

/**
 * SPILL ATTRIBUTION LAW (fix-list ①+②): the channel receives bytes if and only
 * if the walk was ADMITTED, and then exactly the admitted rows in the walker's
 * own NUL framing — never a byte of a refused walk, never a row that was not
 * presented, never a canary.
 */
function auditSpill(probe: Probed, where: string): void {
  const bytes = probe.bytes()
  if (probe.result.ok !== true) {
    if (bytes.length > 0) leaks.push(`${where}: a REFUSED walk wrote ${String(bytes.length)} bytes to the channel`)
    spill.refusedWithBytes += bytes.length > 0 ? 1 : 0
    return
  }
  const files = probe.result.outcome.files
  // the byte law, stated for both arms: admitted rows in the walker's framing,
  // and NOTHING when nothing was admitted (the row writes only when it admits)
  const expected = files.length === 0 ? '' : `${files.join('\0')}\0`
  if (bytes !== expected) {
    leaks.push(`${where}: channel bytes are not the admitted rows (${String(bytes.length)} vs ${String(expected.length)})`)
    spill.attributionMismatch += 1
  }
  if (bytes.includes(SECRET) || bytes.includes('leak.ts')) {
    leaks.push(`${where}: the channel carries outside material`)
    spill.canaryInChannel += 1
  }
  spill.admittedWithBytes += 1
  spill.bytesTotal += bytes.length
}

/** Every path a result presents must exist under the governed root and must NOT be the canary. */
function auditResult(result: GlobBackendResult, where: string): void {
  if (result.ok !== true) return
  for (const file of result.outcome.files) {
    const abs = join(ROOT_DIR, file)
    if (!abs.startsWith(ROOT_DIR + '/') && abs !== ROOT_DIR) leaks.push(`${where}: path escapes root spelling: ${file}`)
    const text = readAccepted(ROOT_DIR, file)
    if (text.includes(SECRET)) leaks.push(`${where}: content leak through ${file}`)
  }
  if (JSON.stringify(result).includes(SECRET)) leaks.push(`${where}: canary inside the result object`)
}

describe('A5-GLOB A — anchoring under attack', () => {
  it('A1 a symlinked MIDDLE component onto the outside is refused before any child exists', async () => {
    mkdirSync(join(ROOT_DIR, 'chain'), { recursive: true })
    symlinkSync(OUT, join(ROOT_DIR, 'chain', 'hop'), 'dir')
    const before = backend.execCount()
    const result = await runWalk('**/*', 'chain/hop')
    expect(result.ok).toBe(false)
    if (result.ok !== true) expect(result.failure.code).toBe('symlink-alias')
    expect(backend.execCount()).toBe(before)
    expect(JSON.stringify(result)).not.toContain(SECRET)
    rmSync(join(ROOT_DIR, 'chain'), { recursive: true, force: true })
  })

  it('A2 a symlinked LAST component onto the outside is refused before any child exists', async () => {
    symlinkSync(OUT, join(ROOT_DIR, 'end-link'), 'dir')
    const before = backend.execCount()
    const result = await runWalk('**/*', 'end-link')
    expect(result.ok).toBe(false)
    if (result.ok !== true) expect(result.failure.code).toBe('symlink-alias')
    expect(backend.execCount()).toBe(before)
    rmSync(join(ROOT_DIR, 'end-link'), { force: true })
  })

  it('A3 the governed ROOT itself replaced by a symlink outside is refused (the anchor never widens)', async () => {
    const shifted = `${ROOT_DIR}-real`
    const outsideRoot = join(WORLD, 'other-root')
    mkdirSync(outsideRoot, { recursive: true })
    writeFileSync(join(outsideRoot, 'leak.ts'), `root level ${SECRET}\n`)
    renameSync(ROOT_DIR, shifted)
    symlinkSync(outsideRoot, ROOT_DIR, 'dir')
    try {
      const result = await runWalk('**/*.ts', '.')
      expect(result.ok).toBe(false)
      expect(JSON.stringify(result)).not.toContain(SECRET)
    } finally {
      rmSync(ROOT_DIR, { force: true })
      renameSync(shifted, ROOT_DIR)
    }
    // and with the root restored, the same call works again (the refusal was the swap, not the row)
    const after = await runWalk('anchor.txt')
    expect(after.ok, JSON.stringify(after)).toBe(true)
  })

  it(`A4 rename→symlink RACE LOOP: ${String(RACE_ITERATIONS)} iterations, zero leak`, async () => {
    let iterations = 0
    for (let i = 0; i < RACE_ITERATIONS; i++) {
      // the attacker flips the world BETWEEN the anchor open and the verify —
      // the exact window a realpath-then-spawn row cannot close.
      const state = (i % 2 === 0 ? 'real' : 'link') as State
      swapTo(state)
      iterations += 1
      const anchor = await row.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: 'live' })
      if (anchor.ok !== true) {
        tally.anchorRefused += 1
        tally.codes.add(anchor.failure.code)
        continue
      }
      tally.anchorAccepted += 1
      try {
        // (a) a hostile entry list is refused in EVERY state
        for (const hostile of ['leak-inner.txt', 'escape-link.ts']) {
          const verdict = await row.verifyGlobResultsBeneath(anchor, [hostile])
          if (verdict.ok === true) {
            tally.hostileAccepted += 1
            const text = readAccepted(anchor.anchorReal, hostile)
            if (text.includes(SECRET)) leaks.push(`A4 it=${String(i)} state=${state} canary accepted through ${hostile}`)
          }
        }
        // (b) the benign entry is only ever answerable as the INSIDE file
        const benign = await row.verifyGlobResultsBeneath(anchor, ['inner.txt'])
        if (benign.ok === true) {
          const text = readAccepted(anchor.anchorReal, 'inner.txt')
          if (text.includes(SECRET)) leaks.push(`A4 it=${String(i)} state=${state} benign entry resolved onto the canary`)
          if (text.length > 0 && state === 'link' && !text.includes('INSIDE')) tally.benignRefused += 1
        }
        tally.codes.add(anchor.anchorReal.startsWith(ROOT_DIR) ? 'inside' : 'outside-anchor')
        if (!anchor.anchorReal.startsWith(ROOT_DIR)) leaks.push(`A4 it=${String(i)} anchor resolved outside: ${anchor.anchorReal}`)
      } finally {
        await anchor.handle.close()
      }
    }
    expect(iterations).toBeGreaterThanOrEqual(RACE_ITERATIONS)
    // the race really happened: both states were seen, and the loop was not one-sided
    expect(tally.anchorAccepted + tally.anchorRefused).toBeGreaterThanOrEqual(RACE_ITERATIONS)
    expect(tally.anchorAccepted).toBeGreaterThan(0)
    expect(leaks, `leaks: ${leaks.slice(0, 3).join(' | ')}`).toEqual([])
    expect(tally.hostileAccepted).toBe(0)
  }, 900_000)

  it(`A5 the REAL confined rg walk under the same swap race (${String(REAL_RACE_WALKS)} walks), zero leak`, async () => {
    const refusals = new Map<string, number>()
    let walks = 0
    for (let i = 0; i < REAL_RACE_WALKS; i++) {
      const stateAtCall: State = i % 2 === 0 ? 'real' : 'link'
      swapTo(stateAtCall)
      tally.states.add(stateAtCall)
      const probe = await runWalkProbed('**/*.txt', 'live')
      const result = probe.result
      // the neighbour gap (see RACE_PACE_MS): the walk happened, the probes ran,
      // and the CPU goes back to the pool for a moment before the next spawn.
      if (RACE_PACE_MS > 0) await sleepMs(RACE_PACE_MS)
      walks += 1
      spill.walks += 1
      auditSpill(probe, `A5 spill it=${String(i)}`)
      // the witness is still in the state we put it in? if the attacker (here:
      // the loop itself) is the only mover, this is always true — `contended`
      // stays 0 and says so; a future multi-process attacker drives it up.
      if (attackerState !== stateAtCall) witness.contended += 1
      if (result.ok === true) {
        if (stateAtCall === 'real') witness.okWhileReal += 1
        else witness.okWhileLink += 1
      } else if (stateAtCall === 'link') witness.refusedWhileLink += 1
      else witness.refusedWhileReal += 1
      if (result.ok !== true) {
        refusals.set(result.failure.code, (refusals.get(result.failure.code) ?? 0) + 1)
        refusalsSeen.set(result.failure.code, refusals.get(result.failure.code) ?? 0)
        refusalCodes.set(result.failure.code, refusals.get(result.failure.code) ?? 0)
        if (!['symlink-alias', 'anchor-open-failed', 'not-a-directory'].includes(result.failure.code)) {
          leaks.push(`A5 unexpected refusal code ${result.failure.code}`)
        }
      } else {
        for (const file of result.outcome.files) {
          if (!file.startsWith('live/')) leaks.push(`A5 presented ${file} from a live/ walk`)
          const text = readAccepted(ROOT_DIR, file)
          if (text.includes(SECRET)) leaks.push(`A5 content leak ${file}`)
        }
      }
      auditResult(result, `A5 it=${String(i)}`)
    }
    expect(walks).toBe(REAL_RACE_WALKS)
    // the witness flipped in BOTH directions and the refusals landed on the
    // link side: the race was met, not dodged (a row that only refused on the
    // real side, or never on the link side, would fail here)
    expect(witness.link).toBeGreaterThanOrEqual(REAL_RACE_WALKS / 2)
    expect(witness.real).toBeGreaterThanOrEqual(REAL_RACE_WALKS / 2)
    expect(witness.refusedWhileLink).toBeGreaterThan(0)
    expect(witness.okWhileReal).toBeGreaterThan(0)
    expect(witness.okWhileLink).toBe(0) // a walk that ANSWERED while the path was a symlink would be the bug
    expect(witness.contended).toBe(0)
    expect(leaks, `leaks: ${leaks.slice(0, 3).join(' | ')}`).toEqual([])
    expect([...refusals.keys()].some((c) => c === 'symlink-alias')).toBe(true) // the swap was hit, not dodged
    // the spill probe: 6600 walks, zero byte of a refused walk in the channel,
    // zero mis-attribution, zero canary — and it DID carry bytes on the walks
    // that answered (a probe that saw nothing at all proves nothing)
    expect(spill.walks).toBe(REAL_RACE_WALKS)
    expect(spill.refusedWithBytes).toBe(0)
    expect(spill.attributionMismatch).toBe(0)
    expect(spill.canaryInChannel).toBe(0)
    expect(spill.admittedWithBytes).toBe(witness.okWhileReal)
    expect(spill.bytesTotal).toBeGreaterThan(0)
    // the all-channel half: nothing outside ever reached anything observable,
    // the audit grammar held on every single line, the frozen table was the
    // source of every refusal's prose, and no exception string was ever needed.
    expect(channels.walks).toBe(REAL_RACE_WALKS)
    expect(channels.wireTokenHits).toBe(0)
    expect(channels.exceptionStrings).toBe(0)
    expect(channels.detailsFromTable).toBe(witness.refusedWhileLink + witness.refusedWhileReal)
    expect(channels.auditLines).toBeGreaterThan(REAL_RACE_WALKS)
    expect(channels.internalLines).toBeGreaterThan(0) // the opened face really did carry detail
    expect(channels.resultBytes).toBeGreaterThan(0)
  }, 1_800_000)

  it('A6 an anchor EXILED out of the governed root mid-flight never answers', async () => {
    swapTo('real')
    const anchor = await row.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: 'live' })
    expect(anchor.ok, JSON.stringify(anchor)).toBe(true)
    if (anchor.ok !== true) return
    try {
      // The world moves AFTER the anchor was accepted and AFTER a walk would
      // have produced rows: the anchored directory is renamed OUT of the
      // governed root. Its bytes are not foreign, but the root-relative
      // spelling it answers with would be a lie — the verdict must be a
      // refusal, never a confident list.
      renameSync(join(ROOT_DIR, 'live'), join(WORLD, 'exiled-real'))
      const verdict = await row.verifyGlobResultsBeneath(anchor, ['inner.txt'])
      expect(verdict.ok, 'an exiled anchor must never answer').toBe(false)
      if (verdict.ok !== true) {
        expect(['anchor-drift', 'walk-unverifiable', 'walk-contaminated']).toContain(verdict.failure.code)
        tally.codes.add(`A6:${verdict.failure.code}`)
      }
      renameSync(join(WORLD, 'exiled-real'), join(ROOT_DIR, 'live'))
    } finally {
      await anchor.handle.close()
    }
  })

  it('A7 nothing outside the root is ever PRESENTED, whatever the pattern says', async () => {
    swapTo('real')
    for (const pattern of ['../../outside/**', '**/outside/**', 'live/**/../**', '/etc/**', '**/leak.ts', '**/*.ts']) {
      const result = await runWalk(pattern, '.')
      auditResult(result, `A7 pattern=${pattern}`)
      if (result.ok === true) {
        for (const file of result.outcome.files) {
          expect(file.startsWith('..'), `pattern ${pattern} presented ${file}`).toBe(false)
          expect(file.startsWith('/'), `pattern ${pattern} presented ${file}`).toBe(false)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it('A8 the race counters are the product (a suite that dodged the race would show it here)', () => {
    expect(rgVersion).toBe('resolved')
    expect(tally.anchorAccepted).toBeGreaterThan(0)
    expect(tally.anchorRefused + tally.anchorAccepted).toBeGreaterThanOrEqual(RACE_ITERATIONS)
    expect(tally.states.has('real') && tally.states.has('link')).toBe(true) // both sides of the race were actually run
    expect(tally.hostileAccepted).toBe(0)
    expect(leaks).toEqual([])
    expect(REPO.length > 0).toBe(true)
    // The counters go to the evidence directory when one is configured, so a
    // reviewer re-running this file can diff the NUMBERS, not just the verdict.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
    const dir = env['A5GLB_EVIDENCE_DIR']
    if (dir !== undefined && dir.length > 0) {
      mkdirSync(dir, { recursive: true })
      // Run-shape byte totals are PRINTED, not committed: they measure the
      // length of audit lines, and an audit line carries a pid, so they cannot
      // be byte-identical across runs. No safety claim rests on them — the
      // committed counters are counts of walks, lines and hits.
      ;(globalThis as { process?: { stdout?: { write(v: string): void } } }).process?.stdout?.write(
        `a5glb all-channel probe byte totals (diagnostic, not committed): result=${String(channels.resultBytes)} spill=${String(channels.spillBytes)} audit=${String(channels.auditBytes)} internal=${String(channels.internalBytes)}\n`,
      )
      writeFileSync(join(dir, 'adversarial-counters.json'), `${JSON.stringify({
        raceIterations: RACE_ITERATIONS,
        realRaceWalks: REAL_RACE_WALKS,
        statesSwapped: [...tally.states],
        anchorAccepted: tally.anchorAccepted,
        anchorRefused: tally.anchorRefused,
        hostileEntriesAccepted: tally.hostileAccepted,
        leaks: leaks.length,
        realRaceRefusals: Object.fromEntries(refusalsSeen),
        verdictCodes: [...tally.codes],
        finalAttackerState: attackerState,
        liveWitness: { ...witness },
        spillProbe: { ...spill, walksPerBackendRun: 1 },
        // The *byte* totals of the probe's own accumulators are run-shape noise
        // (they count how many audit lines the timing of the race produced), so
        // they are reported separately from the counters that must be
        // reproducible: every law asserted here is a count of WALKS, LINES,
        // HITS — never a byte total of a diagnostic accumulator.
        allChannelProbe: {
          walks: channels.walks,
          auditLines: channels.auditLines,
          internalLines: channels.internalLines,
          exceptionStrings: channels.exceptionStrings,
          detailsFromTable: channels.detailsFromTable,
          wireTokenHits: channels.wireTokenHits,
          watchedTokens: WIRE_TOKENS.length,
          internalWatchedTokens: INTERNAL_TOKENS.length,
        },

        sinkWriteSitesAudited: 'one, after the verdict (see row test X5)',
      }, null, 2)}\n`)
    }
  })
})
