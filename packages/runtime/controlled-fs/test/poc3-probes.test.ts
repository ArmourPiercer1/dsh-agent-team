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
import { closeSync, mkdirSync, openSync, readSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
// ---------------------------------------------------------------------------
describe('PoC3-E fd continued-use after close', () => {
  it('GUARDED: the lane holds no standing fd — a presented fd of a closed call is refused', async () => {
    let captured = -1
    const l = lane({
      onFdOpened: (info) => {
        if (info.locator.endsWith('/public/a.txt')) captured = info.fd
      },
    })
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const first = await l.fs.readText(grant, ref, FULL)
    expect(first.ok && first.value.text).toBe('A-CONTENT\n')
    expect(captured).toBeGreaterThanOrEqual(0)
    const stale: FsResourceDescriptor = { fs: 'ctl', path: 'public/a.txt', fd: captured }
    const res = await l.fs.readDescriptor(grant, stale, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('a closed fd must never serve reads')
    expect(res.error.details?.['cfClass']).toBe('denied')
    expect(res.error.details?.['cfReason']).toBe('fd-closed')
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
    // The fd number is now free; the OS deterministically reuses the lowest.
    const recycled = openSync(join(world.outside, 'recycled-victim.txt'), 'r')
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
