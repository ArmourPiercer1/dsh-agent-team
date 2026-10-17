/**
 * `a5p5-spill` — the SPILL semantics slice (Phase 2, RED-first; written and
 * observed failing before `src/spill.ts` existed).
 *
 * PINNED LAWS (sources: task slice ①; INTERFACES-v1.md C-GW "Lease 生命周期
 * ACTIVE→DRAINING 边界=settled 边" and C-BIND v1.1 verbatim cancellation
 * event names, C-FS typed-error triad; S0 D-4 / plan §8 "Spill 可正确归属且
 * 被读取时复核权限"; S-09: the Adapter self-manages spill, native post-execute
 * identity is NOT relied on):
 *
 *  1. WORLD-BOUND CONTROLLED PATH. The store only ever writes under a root
 *     that is a STRICT descendant of the injected world root; a forged
 *     spillId (`..`, separators, absolutes, NUL) or an out-of-world root is a
 *     TYPED refusal counted ZERO fs calls (deny before touch).
 *  2. LEASE-SHAPED LIFECYCLE. ACTIVE → DRAINING → CLOSED; from DRAINING on
 *     every new write is typed-refused; the settled edge carries a verbatim
 *     PR1r cancellation event name where a cancel is the cause.
 *  3. RESIDUE NEVER VANISHES SILENTLY. After cancel/teardown the residue is
 *     ENUMERABLE from the disk (fresh store handle, attribution intact,
 *     orphans included) and CLEANABLE (explicit, listed removal).
 *  4. READ RE-CHECKS AUTHORIZATION. `readSpill` consults the injected
 *     authorizer BEFORE touching the file; a deny is typed and counts zero
 *     reads (S0 D-4 read-time re-check; the lane itself decides nothing).
 *
 * Worlds: per TEST_METHODS §7 every directory lives under `tests/homes/`,
 * named `a5p5-spill-<UTC-stamp>`, deleted in teardown (nothing retained).
 *
 * @module test/a5p5-spill
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createSpillLease,
  openSpillStore,
  SPILL_LEASE_STATES,
  SETTLEMENT_EVENTS,
  type SpillAttribution,
  type SpillStore,
} from '../src/spill.js'
import { createNodeFsPort, type CountedPort } from './helpers/a5p5-fs-port.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')
const homesRoot = join(repoRoot, 'tests', 'homes')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 20)
const worldRoot = join(homesRoot, `a5p5-spill-${stamp}`)
const spillsRoot = join(worldRoot, 'spills')

const attribution = (callId: string): SpillAttribution => ({ realmId: 'realm-a', tool: 'bash', callId })

let port: CountedPort

beforeAll(() => {
  mkdirSync(spillsRoot, { recursive: true })
  port = createNodeFsPort()
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true }) // §7 teardown, nothing kept as evidence
})

function openedStore(rootDir = spillsRoot): SpillStore {
  const opened = openSpillStore({ worldRoot, rootDir, fs: port.port })
  if (!opened.ok) throw new Error(`store refused: ${opened.refusal.code} ${opened.refusal.detail}`)
  return opened.store
}

describe('a5p5-spill: world-bound controlled root (越界 typed 拒)', () => {
  it('closed sets are closed and verbatim (C-GW states; C-BIND v1.1 event names)', () => {
    expect(SPILL_LEASE_STATES).toEqual(['active', 'draining', 'closed'])
    expect(SETTLEMENT_EVENTS).toEqual([
      'dispatcher-call-cancelled-before-body',
      'dispatcher-call-terminated-after-body-start',
      'dispatcher-call-completed-after-abort',
      'dispatcher-call-outcome-unreadable',
      'dispatcher-call-cancelled-by-others',
      'dispatcher-call-executed-unvalidated',
    ])
  })

  it('a root that is not a strict descendant of the world root is refused at construction', () => {
    // NB: string CONCATENATION, not join(): join() would collapse the `..`
    // before the law sees it — refusal happens BEFORE any collapse.
    for (const rootDir of [worldRoot, `${worldRoot}/../outside`, `${worldRoot}/a5p5-x/../a5p5-y`, 'relative/spills']) {
      const opened = openSpillStore({ worldRoot, rootDir, fs: port.port })
      expect(opened.ok, rootDir).toBe(false)
      if (opened.ok) continue
      expect(opened.refusal.code).toBe('spill-root-outside-world')
      expect(opened.refusal.class).toBe('denied')
    }
  })

  it('a forged spillId is a typed refusal counted ZERO fs calls — nothing is touched, nothing appears', () => {
    const store = openedStore()
    const before = { ...port.calls }
    for (const bad of ['../escape', 'a/b', '/etc/passwd', '..\\evil', 'with space', '', '..', 'a\u0000b', 'a..b/../c', 'x'.repeat(200)]) {
      const opened = store.openSink({ spillId: bad, lease: createSpillLease(), attribution: attribution('forged') })
      expect(opened.ok, JSON.stringify(bad)).toBe(false)
      if (opened.ok) continue
      expect(opened.refusal.code).toBe('spill-id-invalid')
      expect(opened.refusal.class).toBe('denied')
    }
    expect(port.calls).toEqual(before) // deny BEFORE touch
    expect(existsSync(join(worldRoot, 'escape.spill'))).toBe(false)
    expect(existsSync(join(dirname(worldRoot), 'escape.spill'))).toBe(false)
  })
})

describe('a5p5-spill: lease-shaped lifecycle (DRAINING 起拒新写)', () => {
  it('writes append while ACTIVE; DRAINING and CLOSED refuse new writes with the size frozen', () => {
    const store = openedStore()
    const lease = createSpillLease()
    const opened = store.openSink({ spillId: 'bash-life-1', lease, attribution: attribution('life-1') })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(lease.state()).toBe('active')
    expect(opened.sink.write('chunk-1\n').ok).toBe(true)

    const settled = lease.settle({ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' })
    expect(settled.ok).toBe(true)
    expect(lease.state()).toBe('draining')
    const sizeAtDrain = port.port.sizeBytes(join(spillsRoot, 'bash-life-1.spill'))
    const late = opened.sink.write('late-chunk\n')
    expect(late.ok).toBe(false)
    if (late.ok) return
    expect(late.refusal.code).toBe('spill-write-after-drain')
    expect(late.refusal.class).toBe('denied')
    expect(port.port.sizeBytes(join(spillsRoot, 'bash-life-1.spill'))).toBe(sizeAtDrain)

    opened.sink.finalize({ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' })
    expect(lease.close().ok).toBe(true)
    expect(lease.state()).toBe('closed')
    const afterClose = opened.sink.write('after-close\n')
    expect(afterClose.ok).toBe(false)
    if (afterClose.ok) return
    expect(afterClose.refusal.code).toBe('spill-write-after-close')
    expect(port.port.sizeBytes(join(spillsRoot, 'bash-life-1.spill'))).toBe(sizeAtDrain)
  })

  it('the settled edge is single: settling twice is a typed refusal (one settled boundary, C-GW)', () => {
    const lease = createSpillLease()
    expect(lease.settle({ kind: 'completed' }).ok).toBe(true)
    const twice = lease.settle({ kind: 'cancelled', event: 'dispatcher-call-cancelled-by-others' })
    expect(twice.ok).toBe(false)
    if (twice.ok) return
    expect(twice.refusal.code).toBe('spill-settled-twice')
  })

  it('an off-set cancellation event carries its OWN typed code (code matches meaning)', () => {
    const lease = createSpillLease()
    const forged = lease.settle({ kind: 'cancelled', event: 'terminated-after-body-start' as never })
    expect(forged.ok).toBe(false)
    if (forged.ok) return
    // Lane D review 附注 (接线门顺手): the pre-fix run reused `spill-settled-twice`
    // for this leg — a code that does not match its meaning. The closed set now
    // names it: short (pre-勘正) names are OUTSIDE the emission-face set.
    expect(forged.refusal.code).toBe('spill-settlement-event-unknown')
  })

  it('a finalized spillId cannot be re-opened: no append-penetration, no settlement overwrite (Lane D ②)', () => {
    const store = openedStore()
    const lease = createSpillLease()
    const opened = store.openSink({ spillId: 'bash-reopen-1', lease, attribution: attribution('reopen-1') })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    opened.sink.write('original-bytes\n')
    lease.settle({ kind: 'completed' })
    opened.sink.finalize({ kind: 'completed' })

    // The penetration attempt: a FRESH store handle, a live lease, the SAME
    // spillId. Pre-fix, openSink rewrote the meta with settlement:null (a
    // finalized record's terminal fact erased) and the sink appended onto the
    // existing payload. Post-fix: typed refusal before any port call.
    const fresh = openedStore()
    const intruder = createSpillLease()
    const again = fresh.openSink({ spillId: 'bash-reopen-1', lease: intruder, attribution: attribution('reopen-2') })
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.refusal.code).toBe('spill-id-in-use')
    expect(again.refusal.class).toBe('denied')

    // The finalized record is byte-intact: original bytes only, settlement intact.
    const residue = fresh.listResidue().find((entry) => entry.spillId === 'bash-reopen-1')
    expect(residue?.settlement).toEqual({ kind: 'completed' })
    expect(port.port.sizeBytes(join(spillsRoot, 'bash-reopen-1.spill'))).toBe('original-bytes\n'.length)
  })
})

describe('a5p5-spill: residue after cancel is enumerable, then cleanable (不静默消失)', () => {
  it('a cancelled spill stays on disk, is listed by a FRESH store handle, and keeps attribution + settlement', () => {
    const store = openedStore()
    const lease = createSpillLease()
    const opened = store.openSink({ spillId: 'bash-cancel-1', lease, attribution: attribution('cancel-1') })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    opened.sink.write('partial-1\n')
    opened.sink.write('partial-2\n')
    lease.settle({ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' })
    opened.sink.finalize({ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' })
    lease.close()

    // The cancel path must NOT silently drop the bytes: an independent handle
    // over the same world path sees the residue.
    const fresh = openedStore()
    const residue = fresh.listResidue()
    const entry = residue.find((r) => r.spillId === 'bash-cancel-1')
    expect(entry).toBeDefined()
    expect(entry?.bytes).toBe('partial-1\npartial-2\n'.length)
    expect(entry?.attribution).toEqual(attribution('cancel-1'))
    expect(entry?.settlement).toEqual({ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' })
    const read = fresh.readSpill('bash-cancel-1', () => ({ allow: true }))
    expect(read.ok).toBe(true)
    if (read.ok) expect(read.text).toBe('partial-1\npartial-2\n')
  })

  it('an orphan file in the controlled path is STILL enumerated (enumeration reads the disk, not memory)', () => {
    const store = openedStore()
    port.port.writeFile(join(spillsRoot, 'orphan-x.spill'), 'orphan-bytes\n')
    const entry = store.listResidue().find((r) => r.spillId === 'orphan-x')
    expect(entry).toBeDefined()
    expect(entry?.attribution).toBeNull() // unattributed — but enumerated, never silently skipped
    expect(entry?.bytes).toBe('orphan-bytes\n'.length)
  })

  it('cleanup is explicit, listed, and afterwards a read is a typed refusal — never silence', () => {
    const store = openedStore()
    const removed = store.cleanupResidue()
    expect(removed.removed.length).toBeGreaterThan(0)
    expect(store.listResidue()).toEqual([])
    expect(existsSync(join(spillsRoot, 'bash-cancel-1.spill'))).toBe(false)
    const read = store.readSpill('bash-cancel-1', () => ({ allow: true }))
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.refusal.code).toBe('spill-missing')
    expect(read.refusal.class).toBe('undetermined') // honest "gone", not a hidden swallow
  })
})

describe('a5p5-spill: read re-checks authorization at read time (S0 D-4)', () => {
  it('an authorizer deny is typed, and it counts ZERO fs read/exists calls', () => {
    const store = openedStore()
    const lease = createSpillLease()
    const opened = store.openSink({ spillId: 'bash-authz-1', lease, attribution: attribution('authz-1') })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    opened.sink.write('secretish\n')
    const readsBefore = port.calls.readText
    const existsBefore = port.calls.exists
    const denied = store.readSpill('bash-authz-1', () => ({ allow: false, detail: 'effect-policy: read leg spent' }))
    expect(denied.ok).toBe(false)
    if (denied.ok) return
    expect(denied.refusal.code).toBe('spill-read-denied')
    expect(denied.refusal.class).toBe('denied')
    expect(port.calls.readText).toBe(readsBefore)
    expect(port.calls.exists).toBe(existsBefore)

    const allowed = store.readSpill('bash-authz-1', (who) => (who?.callId === 'authz-1' ? { allow: true } : { allow: false, detail: 'no' }))
    expect(allowed.ok).toBe(true)
    if (allowed.ok) expect(allowed.text).toBe('secretish\n')
    store.cleanupResidue()
    expect(store.listResidue()).toEqual([])
  })
})
