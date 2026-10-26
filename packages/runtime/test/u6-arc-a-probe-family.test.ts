/**
 * U6 ARC-A scope A — the PROBE family's C1 walk (slice plan: "mounts,
 * declares, plans, refuses, executes a marker write, settles — with ZERO
 * product center file diff"), plus the lane-boundary law the claim needs.
 *
 * THE ORACLE IS THE FILESYSTEM, never this module's return value: every
 * leg reads the marker DIRECTORY after the walk (refusals must leave it
 * byte-untouched; the positive leg must find the nonce inside the file).
 * A transcript of walk() results is not evidence — the family body is the
 * only writer, and the directory is what the body writes.
 *
 * Legs:
 *  W1 the positive walk: bind → plan(ALLOW) → one-shot consume → marker
 *     write → settle; the marker lands with the nonce inside;
 *  W2 no approval entry → plan DEFERs, the door refuses, zero effect;
 *  W3 a forged definition identity → IDENTITY_MISMATCH refusal, zero effect;
 *  W4 a foreign scopeKey → SCOPE-keyed table answers nothing → refusal,
 *     zero effect (the K4 cross-scope law on the family side);
 *  W5 the one-shot law: a replayed grantId refuses GRANT_REPLAY and the
 *     marker count stands at one;
 *  W6 teardown settles the kernel and invalidates everything: walk after
 *     teardown refuses BEFORE the body, the teardown is idempotent, and a
 *     later re-registration never resurrects the approval (FIX-K K1);
 *  W7 bind-ONCE on the family side: the second bind of the same
 *     (scope, name) is refused by the kernel itself;
 *  W8 the closedness law at the registry: the SAME contribution re-
 *     registered from a 'dynamic-source' origin lands not_verified, and
 *     the kernel refuses its calls with NOT_VERIFIED_SOURCE — zero effect;
 *  W9 the lane-boundary law: the probe lane's imports reach ONLY the PR1
 *     public seams (governance-center, contracts) — never the plane, the
 *     center internals, or any product file. This is the import-graph half
 *     of "the family mounted WITHOUT touching the center".
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createU6ProbeAssembly, PROBE_FAMILY_ID } from '../../../tests/u6-arc-a-probe-family/src/probe-assembly.mjs'

const SCOPE = 'u6arca-team:u6arca-inst'

const markers = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('-marker.txt')).sort()

describe('u6-arc-a probe family: the C1 walk on a zero-center-diff mount', () => {
  const worlds: string[] = []
  let seq = 0
  const world = () => {
    seq += 1
    const dir = scratchDir(`u6arca-probe-${String(seq)}`)
    mkdirSync(dir, { recursive: true })
    worlds.push(dir)
    return dir
  }

  const cleanup = () => {
    for (const d of worlds.splice(0)) destroyDir(d)
  }

  it('W1 positive walk: plan → one-shot consume → marker write → settle (oracle: the filesystem)', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    expect(fam.faces().state).toBe('ACTIVE')
    const bound = fam.bindApproval()
    expect(bound.ok).toBe(true)
    const res = await fam.walk({ callId: 'call-1', nonce: 'nonce-1' })
    expect(res.ok, JSON.stringify(res)).toBe(true)
    // ORACLE: the directory, read independently of the walk's return.
    expect(markers(dir)).toEqual(['call-1-marker.txt'])
    expect(readFileSync(join(dir, 'call-1-marker.txt'), 'utf8')).toBe('nonce-1\n')
    // Settle: a drained kernel releases honestly (K3 counted release).
    const settled = fam.teardown()
    expect(settled.ok, JSON.stringify(settled)).toBe(true)
    expect(fam.faces().state).toBe('RELEASED')
    cleanup()
  })

  it('W2 no approval entry: the plan refuses and the marker dir stays EMPTY', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    const res = await fam.walk({ callId: 'call-nobind', nonce: 'n' })
    expect(res.ok).toBe(false)
    expect(res.stage).toBe('plan')
    expect(res.code).toBe('NO_APPROVAL_ENTRY')
    expect(markers(dir), 'zero effect').toEqual([])
    fam.teardown()
    cleanup()
  })

  it('W3 forged identity: IDENTITY_MISMATCH before the body, zero effect', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    fam.bindApproval()
    const res = await fam.walk({ callId: 'call-forged', nonce: 'n', identity: 'def#evil' })
    expect(res.ok).toBe(false)
    expect(res.code).toBe('IDENTITY_MISMATCH')
    expect(markers(dir), 'zero effect').toEqual([])
    fam.teardown()
    cleanup()
  })

  it('W4 foreign scope: the (scope, name) table answers nothing, zero effect', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    fam.bindApproval()
    const res = await fam.walk({ callId: 'call-scope', nonce: 'n', scopeKey: 'other-team:other-inst' })
    expect(res.ok).toBe(false)
    expect(res.code).toBe('NO_APPROVAL_ENTRY')
    expect(markers(dir), 'zero effect').toEqual([])
    fam.teardown()
    cleanup()
  })

  it('W5 one-shot consume: the replayed grant refuses and NO second marker exists', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    fam.bindApproval()
    const first = await fam.walk({ callId: 'call-a', nonce: 'n1', grantId: 'grant-shared' })
    expect(first.ok).toBe(true)
    const replay = await fam.walk({ callId: 'call-b', nonce: 'n2', grantId: 'grant-shared' })
    expect(replay.ok).toBe(false)
    expect(replay.stage).toBe('consume')
    expect(replay.code).toBe('GRANT_REPLAY')
    // ORACLE: call-b's marker was never written; call-a's stands alone.
    expect(markers(dir)).toEqual(['call-a-marker.txt'])
    fam.teardown()
    cleanup()
  })

  it('W6 teardown settles everything: later walks refuse, teardown idempotent, no resurrection', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    fam.bindApproval()
    const ok = await fam.walk({ callId: 'call-live', nonce: 'n', grantId: 'g-live' })
    expect(ok.ok).toBe(true)
    expect(fam.teardown().ok).toBe(true)
    const after = await fam.walk({ callId: 'call-after', nonce: 'n', grantId: 'g-after' })
    expect(after.ok).toBe(false)
    expect(after.code).toBe('KERNEL_NOT_ACTIVE')
    expect(fam.teardown().ok, 'idempotent settle').toBe(true)
    expect(markers(dir), 'zero effect after settle').toEqual(['call-live-marker.txt'])
    cleanup()
  })

  it('W7 bind-ONCE, family side: the kernel itself refuses the second bind', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    expect(fam.bindApproval().ok).toBe(true)
    const forged = fam.kernel.addApprovalEntry({
      scopeKey: SCOPE, nativeName: 'u6arc_probe', definitionIdentity: 'def#second-thought', familyId: PROBE_FAMILY_ID,
    })
    expect(forged.ok).toBe(false)
    expect(fam.faces().approval?.definitionIdentity).toBe('def#probe-1')
    fam.teardown()
    cleanup()
  })

  it('W8 closedness at the registry: a dynamic-source re-registration is not_verified and executes NOTHING', async () => {
    const dir = world()
    const fam = createU6ProbeAssembly({ markerDir: dir, scopeKey: SCOPE })
    fam.bindApproval()
    // The same family re-registered from an UNREVIEWED origin (the closed
    // registry's other door) flips its candidate to not_verified.
    fam.registry.revoke(PROBE_FAMILY_ID, 'test leg: re-entry through the dynamic door')
    const dyn = fam.registry.register(fam.contribution, { origin: 'dynamic-source' })
    expect(dyn.ok, JSON.stringify(dyn)).toBe(true)
    const res = await fam.walk({ callId: 'call-dyn', nonce: 'n', grantId: 'g-dyn' })
    expect(res.ok).toBe(false)
    expect(res.stage).toBe('plan')
    expect(res.code).toBe('NOT_VERIFIED_SOURCE')
    expect(markers(dir), 'zero effect').toEqual([])
    fam.teardown()
    cleanup()
  })

  it('W9 lane-boundary law: the probe lane imports ONLY the PR1 public seams', async () => {
    const laneDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'u6-arc-a-probe-family', 'src')
    const offenders: string[] = []
    for (const file of ['probe-contribution.mjs', 'probe-assembly.mjs']) {
      const src = readFileSync(join(laneDir, file), 'utf8')
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]!
        const viaPublicSeam = spec.startsWith('node:') || spec.includes('/governance-center/') || spec.includes('/contracts/') || spec.startsWith('./')
        if (!viaPublicSeam) offenders.push(`${file} → ${spec}`)
      }
    }
    expect(offenders, 'the family reaches the center only through PR1 public seams').toEqual([])
    // And the marker oracle never saw a write during a pure source scan.
    expect(existsSync('u6arc-a-should-never-exist'), 'no stray writes in the repo root').toBe(false)
  })
})
