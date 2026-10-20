/**
 * A5-PR3 (Lane B) — PoC3: REAL-FS negative-control probe set (plan §6 PoC-3,
 * INTERFACES-v1 C-FS). Five legs, each with a NAIVE control (what the raw OS
 * does — this is what gives the probe teeth) and a GUARDED leg (the lane):
 *
 *   A. symlink escape        — alias inside the anchor pointing out
 *   B. directory race        — dir swapped to an outside symlink between
 *                              check and open (+ B2 inode drift in-tree)
 *   C. hidden file read      — hidden-read is never silent (typed deny +
 *                              diagnostic line, even under a valid grant)
 *   D. cross-member invisible— member-b cannot see/list/read member-a's tree
 *   E. fd continued-use      — closed fd refused; a RECYCLED fd number never
 *                              silently serves bytes of the new owner
 *
 * Raw RED/GREEN transcripts land in
 * `dev/agent-workflow/evidence/alpha5/pr3/runs/`. Worlds are real
 * `tests/homes/a5p3-*` directories, destroyed in teardown.
 *
 * @module packages/runtime/controlled-fs/test/poc3-probes
 */
import { execFileSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readlinkSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createPoc3World,
  destroyPoc3World,
  dirRef,
  fileRef,
  makeGrant,
  MEM_A,
  MEM_B,
  readRaw,
  type Poc3World,
} from './poc3-harness.js'
import {
  createControlledFsLane,
  type ControlledFsLane,
  type FsResourceDescriptor,
} from '../src/index.js'

let world: Poc3World

const FULL = { offset: 0, limit: null } as const

function visibility(member: { instanceId: string }, desc: FsResourceDescriptor): 'visible' | 'hidden' {
  if (member.instanceId !== 'member-b') return 'visible'
  return desc.path === 'private' || desc.path.startsWith('private/')
    || desc.path === 'mine' || desc.path.startsWith('mine/') ? 'hidden' : 'visible'
}

function lane(hooks?: Parameters<typeof createControlledFsLane>[0]['hooks']): ControlledFsLane {
  return createControlledFsLane({
    instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' }],
    visibility,
    currentAuthorityGeneration: 1,
    consumed: () => false,
    hooks,
  })
}

const countOpens = (l: ControlledFsLane, locator: string): number =>
  l.ledger.filter((e) => e.locator === locator && (e.stage === 'open-issued' || e.stage === 'open-foreign')).length

function resetStage(w: Poc3World): void {
  rmSync(join(w.ctrl, 'stage'), { recursive: true, force: true })
  rmSync(join(w.ctrl, 'stage.bak'), { recursive: true, force: true })
  mkdirSync(join(w.ctrl, 'stage'), { recursive: true })
  writeFileSync(join(w.ctrl, 'stage', 'in.txt'), 'STAGE-IN\n')
}

beforeAll(() => {
  world = createPoc3World()
})

afterAll(() => {
  if (world) destroyPoc3World(world.world)
})

// ---------------------------------------------------------------------------
// LEG A — symlink escape
// ---------------------------------------------------------------------------
describe('PoC3-A symlink escape', () => {
  it('NAIVE control: the raw OS follows the alias OUT of the anchor (this is the hole)', () => {
    expect(readFileSync(join(world.ctrl, 'escape', 'alias-out.txt'), 'utf8')).toBe('OUTSIDE-SECRET\n')
  })

  it('GUARDED: alias read is a typed denied BEFORE any open — open-issued(alias)=0, zero disclosure', async () => {
    const l = lane()
    const ref = fileRef(world, 'escape/alias-out.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const res = await l.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('alias read must never succeed')
    expect(res.error.details?.['cfClass']).toBe('denied')
    expect(res.error.details?.['cfReason']).toBe('symlink-alias')
    expect(JSON.stringify(res)).not.toContain('OUTSIDE-SECRET')
    expect(countOpens(l, ref.canonicalLocator)).toBe(0)
    expect(l.ledger.some((e) => e.stage.startsWith('refused:denied:symlink-alias'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// LEG B — directory race (check→open swap), + B2 in-tree inode drift
// ---------------------------------------------------------------------------
describe('PoC3-B directory race', () => {
  const swapStageOut = (w: Poc3World): void => {
    renameSync(join(w.ctrl, 'stage'), join(w.ctrl, 'stage.bak'))
    symlinkSync(join('..', 'outside2'), join(w.ctrl, 'stage'))
  }

  it('NAIVE control: realpath-check-then-open LEAKS when the dir is swapped in between', () => {
    const target = join(world.ctrl, 'stage', 'in.txt')
    const real = readFileSync(target, 'utf8') // pre-check: the naive guard looks clean
    expect(real).toBe('STAGE-IN\n')
    swapStageOut(world)
    try {
      // the naive lane re-opens the SAME path string — the OS now resolves it
      // through the swapped symlink: silent disclosure, no error.
      expect(readFileSync(target, 'utf8')).toBe('OTHER-SECRET\n')
    } finally {
      resetStage(world)
    }
  })

  it('GUARDED: exec-time re-read catches the escape — typed refusal, zero disclosure', async () => {
    let fired = false
    const l = lane({
      onAfterPreCheckBeforeOpen: (info) => {
        if (!fired && info.locator.endsWith('/stage/in.txt')) {
          fired = true
          swapStageOut(world)
        }
      },
    })
    const ref = fileRef(world, 'stage/in.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const res = await l.fs.readText(grant, ref, FULL)
    try {
      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('raced read must never disclose')
      expect(res.error.details?.['cfClass']).toBe('denied')
      expect(res.error.details?.['cfReason']).toBe('exec-time-escape')
      expect(JSON.stringify(res)).not.toContain('OTHER-SECRET')
    } finally {
      resetStage(world)
    }
  })

  it('GUARDED B2: in-tree inode swap after the snapshot ⇒ undetermined (identity drift), zero disclosure', async () => {
    const l = lane({
      onAfterPreCheckBeforeOpen: (info) => {
        if (info.locator.endsWith('/stage/in.txt')) {
          // same path, DIFFERENT (dev,ino): content-replacing rename
          writeFileSync(join(world.ctrl, 'stage', '.tmp'), 'MUTATED\n')
          renameSync(join(world.ctrl, 'stage', '.tmp'), join(world.ctrl, 'stage', 'in.txt'))
        }
      },
    })
    const ref = fileRef(world, 'stage/in.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const res = await l.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('drifted read must never disclose')
    expect(res.error.details?.['cfClass']).toBe('undetermined')
    expect(res.error.details?.['cfReason']).toBe('exec-time-identity-drift')
    expect(res.error.sideEffectUnknown).not.toBe(true) // a read did not effect
    expect(JSON.stringify(res)).not.toContain('MUTATED')
  })
})

// ---------------------------------------------------------------------------
// LEG C — hidden file read (never silent)
// ---------------------------------------------------------------------------
describe('PoC3-C hidden file read', () => {
  it('NAIVE control: the OS hides nothing — hiding is the mediator\'s law, not an fs accident', () => {
    expect(readFileSync(join(world.ctrl, 'mine', '.draft.txt'), 'utf8')).toBe('DRAFT-HIDDEN\n')
  })

  it('GUARDED: even with a VALID grant, a hidden read is typed hidden + diagnostic line; nothing opens', async () => {
    const l = lane()
    const ref = fileRef(world, 'mine/.draft.txt', ['read'])
    const grant = makeGrant({ member: MEM_B, effects: [{ kind: 'read', resource: ref }] })
    const res = await l.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('hidden read must never succeed')
    expect(res.error.details?.['cfClass']).toBe('hidden')
    expect(res.error.details?.['cfReason']).toBe('hidden-read')
    expect((res.error.details?.['cfDiagnostic'] as string).length).toBeGreaterThan(0)
    expect(countOpens(l, ref.canonicalLocator)).toBe(0)
    // never silent: the diagnostic line is ALSO in the ledger
    expect(l.ledger.some((e) => e.locator === ref.canonicalLocator && e.stage.startsWith('refused:hidden:'))).toBe(true)
  })

  it('GUARDED: stat of a hidden file answers withheld:true — never exists:false, never silent absence', async () => {
    const l = lane()
    const ref = fileRef(world, 'mine/.draft.txt', ['meta'])
    const grant = makeGrant({ member: MEM_B, effects: [{ kind: 'meta', resource: ref }] })
    const res = await l.fs.stat(grant, ref)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value).toEqual({ exists: false, kind: 'unknown', withheld: true })
    expect(readRaw(join(world.ctrl, 'mine', '.draft.txt'))).toBe('DRAFT-HIDDEN\n') // untouched
  })

  it('POSITIVE control: the file is fully readable for the member it belongs to', async () => {
    const l = lane()
    const ref = fileRef(world, 'mine/.draft.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const res = await l.fs.readText(grant, ref, FULL)
    expect(res.ok && res.value.text).toBe('DRAFT-HIDDEN\n')
  })
})

// ---------------------------------------------------------------------------
// LEG D — cross-member path invisibility
// ---------------------------------------------------------------------------
describe('PoC3-D cross-member invisibility', () => {
  it('NAIVE control: raw cross-member read succeeds (the hole the lane closes)', () => {
    expect(readFileSync(join(world.ctrl, 'private', 'secret.txt'), 'utf8')).toBe('PRIVATE-SECRET\n')
  })

  it('GUARDED: member-b list omits the private tree; stat=withheld; read=hidden+diagnostic; open=0', async () => {
    const l = lane()
    const root = dirRef(world, '.', ['list'])
    const listGrant = makeGrant({ member: MEM_B, effects: [{ kind: 'list', resource: root }] })
    const listed = await l.fs.list(listGrant, root)
    expect(listed.ok && listed.value.every((r) => !r.canonicalLocator.includes('/private')))
    const secret = fileRef(world, 'private/secret.txt', ['read'])
    const readGrant = makeGrant({ member: MEM_B, effects: [{ kind: 'read', resource: secret }] })
    const res = await l.fs.readText(readGrant, secret, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('cross-member read must never succeed')
    expect(res.error.details?.['cfClass']).toBe('hidden')
    expect(res.error.details?.['cfDiagnostic']).toBeTruthy()
    expect(countOpens(l, secret.canonicalLocator)).toBe(0)
    expect(JSON.stringify(res)).not.toContain('PRIVATE-SECRET')
  })
})

// ---------------------------------------------------------------------------
// LEG E — continued use of a closed fd (and fd-number recycling)
//
// FD NUMBERS ARE PROCESS-GLOBAL STATE. The runner keeps everything in-process
// (`pool: 'threads'`, no child spawn — see the root vitest.config.ts), so a
// sibling test FILE executes in another worker thread of THIS process against
// the SAME fd table, and the kernel answers every open() with the LOWEST free
// number. The lane holds no standing fd across calls, so the number a leg
// captured is back in the allocator's hands while the leg still carries the
// descriptor: a foreign open can claim exactly that number before the lane
// reads `/proc/self/fd/<n>`, and the refusal then truthfully answers
// `fd-recycled` instead of `fd-closed`. Both labels refuse (`denied` /
// TOOL_BINDING_UNVERIFIED, never a byte served) — what drifted was the label,
// and the union-of-captures census grades one leg out of hundreds of openers.
// Measured on this host: 3/96 suite rounds drifted under a same-process open/
// close hammer, 0/96 with the lifecycle rules below; the lane's label was never
// inconsistent with the /proc view it itself observed (0 in 2200 recorded
// replays),
// so the precondition the leg was missing is documented in
// `dev/agent-workflow/evidence/alpha5/wiring/poc3-flake/README.md`.
//
// Neither rule touches the guard, the tolerance list, the baseline or the
// meaning of an assertion; each only stops the leg from ASSUMING a fact about
// the process that the leg does not own.
// ---------------------------------------------------------------------------
describe('PoC3-E fd continued-use after close', () => {
  /** Slots the closed-fd leg reserves below its own number (see rule 1). */
  const FD_RESERVE_SLOTS = 64
  /** Presentations the closed-fd leg will make before it calls the law unseen. */
  const FD_CLOSED_SIGHTINGS = 12
  /** Who owns this fd NUMBER in this process, right now. */
  const fdOwner = (fd: number): string => {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`)
    } catch {
      return 'no such fd'
    }
  }

  it('GUARDED: the lane holds no standing fd — a presented fd of a closed call is refused', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const decoy = join(world.world, 'fd-reserve')
    writeFileSync(decoy, 'FD-RESERVE\n')
    const unseen: string[] = []
    let lastReason = '(no answer)'
    try {
      // RULE 1 — RESERVE, THEN RELEASE: hold FD_RESERVE_SLOTS numbers while the
      // lane opens (so the lane lands ABOVE them), then free them. The freed
      // band sits strictly below the leg's number, and lowest-free-number
      // allocation sends every later foreign opener into the band.
      // RULE 2 — OBSERVE, NEVER ASSUME: the refusal is re-presented until the
      // lane answers `fd-closed` for a number this leg knows it just closed.
      // A drift is not tolerated: the leg stays RED if no presentation sees
      // its own closed number, and the recorded windows say who took it.
      for (let attempt = 0; attempt < FD_CLOSED_SIGHTINGS; attempt += 1) {
        let captured = -1
        const l = lane({
          onFdOpened: (info) => {
            if (info.locator.endsWith('/public/a.txt')) captured = info.fd
          },
        })
        const wall: number[] = []
        try {
          for (let i = 0; i < FD_RESERVE_SLOTS; i++) wall.push(openSync(decoy, 'r'))
          const first = await l.fs.readText(grant, ref, FULL)
          expect(first.ok && first.value.text).toBe('A-CONTENT\n')
          expect(captured).toBeGreaterThanOrEqual(0)
          for (const fd of wall) closeSync(fd)
          wall.length = 0
          const stale: FsResourceDescriptor = { fs: 'ctl', path: 'public/a.txt', fd: captured }
          const res = await l.fs.readDescriptor(grant, stale, FULL)
          expect(res.ok).toBe(false)
          if (res.ok) throw new Error('a closed fd must never serve reads')
          expect(res.error.details?.['cfClass']).toBe('denied')
          lastReason = String(res.error.details?.['cfReason'])
          if (lastReason === 'fd-closed') return // the law, SEEN
          unseen.push(`#${attempt} fd=${captured} answered=${lastReason} owner-after-refusal=${fdOwner(captured)}`)
        } finally {
          for (const fd of wall) closeSync(fd) // only on a path that is already RED
        }
      }
      throw new Error(
        `fd-closed never OBSERVED in ${FD_CLOSED_SIGHTINGS} presentations of a just-closed fd `
        + `(last answer: ${lastReason}); race windows seen:\n${unseen.join('\n')}`,
      )
    } finally {
      rmSync(decoy, { force: true })
    }
  })

  it('GUARDED: fd-number RECYCLING — raw fd trust silently misreads (naive); the lane refuses (guarded)', async () => {
    // #349 ROOT ROUND C: this leg runs its LAW IN A CHILD PROCESS
    // (./poc3-fd-recycling-leg.mjs). WHY: the nine-root census runs every
    // test file as worker_threads of ONE process and the fd table is
    // PROCESS-WIDE, so the old in-process "wait until the OS hands my number
    // back" is starvable BY LAW - one long-lived holder of the captured
    // number makes every held-open attempt land ABOVE it (deterministic
    // repro: dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/
    // fd-recycling/repro-starvation.mjs: STARVED every run, first probes
    // 22,23,24,... while 21 is held; census run 39235428022 is the incident,
    // twin run 39235441274 green = the holder was luck). A fresh child owns
    // a fresh single-threaded fd table whose ONLY opener is the script:
    // after the lane closes its read, POSIX lowest-free gives the SAME
    // number back on the very next open - recycling stays OBSERVED (a miss
    // exits 1 naming the stage), never assumed, and no waiting is involved.
    // The claim is byte-for-byte the original one: naive raw trust of the
    // recycled number silently reads the NEW owner's bytes; the lane refuses
    // the same stale descriptor and the refusal body never leaks them.
    // CENSUS-CONDITION NEGATIVE CONTROL: a long-lived holder is held in
    // THIS process's shared table for the child's whole run - exactly the
    // shape that starved the old leg. The child cannot see it; the leg must
    // stay green regardless, which is precisely what determinism buys.
    const hogPath = join(world.outside, 'hog.txt')
    writeFileSync(hogPath, 'LONG-LIVED HOLDER (census shape)\n')
    const hog = openSync(hogPath, 'r')
    try {
      const legPath = join(dirname(fileURLToPath(import.meta.url)), 'poc3-fd-recycling-leg.mjs')
      const out = execFileSync(
        (globalThis as unknown as { process: { execPath: string } }).process.execPath,
        [legPath, world.world],
        { encoding: 'utf8', timeout: 30000 },
      )
      const result = JSON.parse(out.trim().split('\n').at(-1) as string) as {
        ok: boolean
        stage?: string
        captured: number
        recycled: number
        naiveBytes: string
        guardOk: boolean
        cfClass?: string
        cfReason?: string
        leak: boolean
      }
      expect(result.stage ?? 'none', `leg failed at stage; full result: ${JSON.stringify(result)}`).toBe('none')
      expect(result.ok).toBe(true)
      expect(result.recycled).toBe(result.captured) // recycling OBSERVED in the child's own table
      expect(result.naiveBytes).toBe('RECYCLED-BYTES\n') // the naive hazard misreads - SEEN
      expect(result.guardOk).toBe(false)
      expect(result.cfClass).toBe('denied')
      expect(result.cfReason).toBe('fd-recycled')
      expect(result.leak).toBe(false) // the refusal body never carries the new owner's bytes
    } finally {
      closeSync(hog)
      rmSync(hogPath, { force: true })
    }
  })
})
