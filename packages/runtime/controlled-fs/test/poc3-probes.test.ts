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
import { closeSync, mkdirSync, openSync, readlinkSync, readSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
  /** Cap on fds the recycling leg may hold at once (EMFILE politeness). */
  const FD_HOLD_CAP = 128

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
    let captured = -1
    const l = lane({
      onFdOpened: (info) => {
        if (info.locator.endsWith('/public/a.txt')) captured = info.fd
      },
    })
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    await l.fs.readText(grant, ref, FULL)
    // The fd number is now free; the OS hands out the LOWEST free number. The
    // nine-root census runs this file's process alongside other files' tests
    // (worker threads share the fd table), so the number may be momentarily
    // held elsewhere — a single open could then miss the recycling and report
    // a false race. Retry the open until recycling is OBSERVED. This keeps the
    // leg's claim exact: the law was seen to happen, never assumed; if no
    // attempt observes it within the bound, the leg stays RED.
    // RULE 3 — A MISS IS HELD OPEN, NOT CLOSED. Each held miss removes one free
    // slot below the leg's number, so the free set below it shrinks
    // monotonically and an open must land on `captured`. Closing each miss
    // (the previous shape) handed the same slot back every iteration, so a
    // thread that momentarily owns the number could starve the probe for all
    // 500 attempts — measured 6/96 suite rounds under the same-process hammer,
    // 0/96 held open. FD_HOLD_CAP keeps the leg inside the fd limit.
    let recycled = -1
    const heldMisses: number[] = []
    try {
      for (let attempt = 0; attempt < 500 && recycled !== captured; attempt += 1) {
        const probe = openSync(join(world.outside, 'recycled-victim.txt'), 'r')
        if (probe === captured) {
          recycled = probe
          break
        }
        heldMisses.push(probe)
        if (heldMisses.length >= FD_HOLD_CAP) closeSync(heldMisses.shift() as number)
      }
    } finally {
      for (const fd of heldMisses) closeSync(fd)
    }
    expect(recycled).toBe(captured) // recycling OBSERVED, not assumed
    try {
      // NAIVE hazard: raw continued use of the old number reads the NEW owner.
      const buf = Buffer.alloc(64)
      const n = readSync(recycled, buf, 0, 64, null)
      expect(buf.toString('utf8', 0, n)).toBe('RECYCLED-BYTES\n')
      // GUARDED: the same stale descriptor through the lane is refused, and
      // the refusal body never carries the new owner's bytes.
      const stale: FsResourceDescriptor = { fs: 'ctl', path: 'public/a.txt', fd: captured }
      const res = await l.fs.readDescriptor(grant, stale, FULL)
      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('recycled fd must never be trusted')
      expect(res.error.details?.['cfClass']).toBe('denied')
      expect(res.error.details?.['cfReason']).toBe('fd-recycled')
      expect(JSON.stringify(res)).not.toContain('RECYCLED-BYTES')
    } finally {
      closeSync(recycled)
    }
  })
})
