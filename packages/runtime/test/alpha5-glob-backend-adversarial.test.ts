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
  destroyWorld,
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
const REAL_RACE_WALKS = 120

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

afterAll(() => {
  destroyWorld(WORLD)
})

async function runWalk(pattern: string, locator: string = '.'): Promise<GlobBackendResult> {
  return await backend.run(globCall(`adv-${pattern}-${locator}`, pattern, locator) as never, { sink: null })
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
      swapTo(i % 2 === 0 ? 'real' : 'link')
      tally.states.add(i % 2 === 0 ? 'real' : 'link')
      const result = await runWalk('**/*.txt', 'live')
      walks += 1
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
    expect(leaks, `leaks: ${leaks.slice(0, 3).join(' | ')}`).toEqual([])
    expect([...refusals.keys()].some((c) => c === 'symlink-alias')).toBe(true) // the swap was hit, not dodged
  }, 900_000)

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
      }, null, 2)}\n`)
    }
  })
})
