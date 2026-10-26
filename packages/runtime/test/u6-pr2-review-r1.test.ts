/**
 * U6 PR2 — REVIEW ROUND 1 fixes (B1/B2), red-first pinned here.
 *
 * B1 (R-REM-2 / FIX-K K3): the plane mount may NOT synthesize a lifecycle
 * counter. An enforcing read-kernel mount without the REAL dispatcher port
 * is a typed assembly refusal — the governed read mounts nowhere; an agent
 * never stands up with a self-counted "enforcement". Where a real port IS
 * wired (production: the Guard's own pendingCalls ledger), the port is that
 * ledger on every settle path: success, refusal, throw and an aborted
 * in-flight hang — and the KERNEL itself refuses `release()` (`LEASE_OPEN`)
 * while the ledger holds work.
 *
 * B2 (CI-05): a governed Team mount that could NOT place the kernel-governed
 * read (no usable fsInstance) must never let `read` fall through to the
 * native body. The plane value answers for `read` from a REJECTING guard
 * face — name owned, table forever silent — so the dispatch door refuses
 * every read before its Body (zero effect). CI-03 control: WITHOUT a plane
 * (non-Team install) the native read rides on, untouched.
 *
 * Harness: the REAL `createTeamToolPlaneAssembly`, the REAL
 * `installScopedToolGuard` on the pinned scoped-registry double
 * (a5-read-slice-window / plants pairing).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, realpathSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installScopedToolGuard, definitionIdentityOf } from '../tool-dispatch/index.js'
import {
  createGovernedFamilyRegistry,
  createGovernanceKernel,
} from '../governance-center/index.js'
import { scopedRegistryDouble, type ScopedRegistryDouble } from './a5p1r-scoped-registry-double.js'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests', 'homes', `u6pr2-r1-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const REALM = 'u6pr2-r1-realm'

type PlaneBuilt =
  | { ok: true; value: PlaneValue }
  | { ok: false; code: string; message: string }
interface PlaneValue {
  definitions: ReadonlyArray<{ name: string }>
  ownNames: readonly string[]
  placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  centerKernel?: {
    kernel: { state(): string }
    registry: unknown
    scopeKey: string
    // U6 PR3 (ARC-B): ONE kernel registers BOTH governed families; the
    // PR2 single `familyId` surface generalized to the registered list.
    familyIds?: readonly string[]
  }
  kernelGuard?: { owns(name: string): boolean; identityFor(name: string): string | null }
}
type PlaneRow = { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => PlaneBuilt }
type Guard = {
  bindOwnTools(names: readonly string[]): { ok: boolean; error?: { code: string; message: string } }
  publish(): { ok: boolean; error?: { message: string } }
  observations(): readonly Record<string, unknown>[]
  pendingCalls(): readonly unknown[]
}

let row: PlaneRow
beforeAll(async () => {
  mkdirSync(ROOT_DIR, { recursive: true })
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as unknown as PlaneRow
})
afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})
const realRoot = (): string => realpathSync(ROOT_DIR)

function planeInput(over: Record<string, unknown> = {}, plane: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    teamSessionId: 'u6pr2-r1-team-root',
    controlLeg: approvingControlLeg(),
    fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/') },
    permissionPolicy: { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u6pr2-r1-tpl',
    role: 'member',
    instanceId: 'u6pr2-r1-instance',
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'u6pr2-r1-ctl', rootDir: realRoot(), realmId: REALM, kind: 'absolute-path' },
      ...plane,
    },
    ...over,
  }
}

/** Guard pairing over a plane value, exactly as agent-bindings pairs them
 *  (kernelGuard = the plane value's live face; feed = the plane's feed). */
function pairGuard(planeValue: PlaneValue, double: ScopedRegistryDouble, owned: readonly string[]): Guard {
  const outcome = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames: (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)!.map((r) => r.name),
    maskedNames: [],
    assemblyOwnedNames: [...owned],
    realmId: REALM,
    bindingFeed: (name) => planeValue.placementFeed?.(name),
    ...(planeValue.kernelGuard === undefined
      ? {}
      : { kernelGuard: { owns: (n: string) => planeValue.kernelGuard!.owns(n), identityFor: (n: string) => planeValue.kernelGuard!.identityFor(n) } }),
  })
  if (!outcome.ok) throw new Error(`guard install refused: ${outcome.error.code} ${outcome.error.message}`)
  const guard = outcome.value as unknown as Guard
  if (owned.length > 0) {
    const bound = guard.bindOwnTools([...owned])
    if (!bound.ok) throw new Error(`bind refused: ${String(bound.error?.message)}`)
  }
  const pub = guard.publish()
  if (!pub.ok) throw new Error(`publish refused: ${String(pub.error?.message)}`)
  return guard
}

describe('review-r1 B1 — no lifecycle port, no enforcing mount', () => {
  it('R1: an fsInstance mount WITHOUT dispatcherLifecycle is refused typed (never a self-count)', async () => {
    const built = row.createTeamToolPlaneAssembly(planeInput() as never)
    expect(built.ok, 'expected a typed refusal; a mounted kernel here is the B1 hole').toBe(false)
    if (built.ok === true) return
    // U6 PR3 (ARC-B): the kernel became a MOUNT-WIDE requirement (the
    // shell row always mounts kernel-owned), so the typed refusal moved
    // from PLANE_READ_KERNEL_UNAVAILABLE to PLANE_KERNEL_UNAVAILABLE —
    // STRICTER than B1: no lifecycle port now refuses EVERY governed
    // mount, not just the read-row one.
    expect(built.code).toBe('PLANE_KERNEL_UNAVAILABLE')
    expect(built.message).toContain('lifecycle port')
  })

  it('R1b: with the real port the mount succeeds and the kernel is ACTIVE', async () => {
    const built = row.createTeamToolPlaneAssembly(planeInput({ dispatcherLifecycle: { inflight: () => 0 } }) as never)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.value.centerKernel?.kernel.state()).toBe('ACTIVE')
  })

  it('R1c: the port IS the dispatcher ledger on every settle path; the kernel refuses release on live work', async () => {
    // Plants-shape lane, but the kernel's lifecycle port is the GUARD'S OWN
    // pendingCalls ledger (the production wiring), and the four settle paths
    // run through the real door.
    const double = scopedRegistryDouble({ globalNames: ['grep'] })
    double.registerOwn('read', 'V1.read')
    const get = double.ctx.tools.get as unknown as (name: string, scope?: unknown) => unknown
    const liveDef = (get('read', { id: 'agent-m1' }) ?? get('read', 'agent-m1') ?? get('read')) as object
    const tableIdentity = definitionIdentityOf(liveDef)!
    let tableLive = true
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const guardRef: { current?: Guard } = {}
    const kernel = createGovernanceKernel({
      registry,
      mode: 'enforcing',
      // PRODUCTION SHAPE: the port IS the dispatcher ledger, not a copy.
      ports: { lifecycle: { inflight: () => guardRef.current?.pendingCalls().length ?? 0 } },
    })
    expect(kernel.publish().ok).toBe(true)
    const outcome = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)!.map((r) => r.name),
      maskedNames: [],
      assemblyOwnedNames: ['read'],
      realmId: REALM,
      bindingFeed: () => ({ definitionIdentity: tableIdentity, realmId: REALM }),
      kernelGuard: {
        owns: (name: string) => name === 'read',
        identityFor: (name: string) => (name === 'read' && tableLive ? tableIdentity : null),
      },
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    guardRef.current = outcome.value as unknown as Guard
    expect(guardRef.current.bindOwnTools(['read']).ok).toBe(true)
    expect(guardRef.current.publish().ok).toBe(true)
    const samples: Array<{ path: string; mid: number; port: number }> = []
    let hold: (() => void) | undefined
    const list = double.listeners.get('tools/execute') ?? []
    list.push((async (exec: { callId?: unknown }, next: () => Promise<unknown>) => {
      const mid = guardRef.current!.pendingCalls().length
      samples.push({ path: String(exec?.callId), mid, port: guardRef.current!.pendingCalls().length })
      if (String(exec?.callId) === 'throw') throw new Error('planted execute-throw')
      if (String(exec?.callId) === 'hang') {
        await new Promise<void>((resolve) => {
          hold = resolve
        })
      }
      return next()
    }) as unknown as (...args: never[]) => unknown)
    double.listeners.set('tools/execute', list)

    // path: success — the ledger holds the call mid-Body, drains after.
    const okRun = await double.runCall({ callId: 'success', name: 'read' })
    expect(okRun.bodies).toEqual(['V1.read'])
    expect(guardRef.current!.pendingCalls()).toHaveLength(0)
    // path: throw — the entry drains on the throwing settle too.
    await double.runCall({ callId: 'throw', name: 'read' })
    expect(guardRef.current!.pendingCalls()).toHaveLength(0)
    // path: refusal — the table goes silent; the door refuses BEFORE the
    // Body; the ledger never holds it (zero, and the port says zero).
    tableLive = false
    expect(guardRef.current!.pendingCalls()).toHaveLength(0)
    const refused = await double.runCall({ callId: 'refused', name: 'read' })
    expect(refused.bodies).toEqual([])
    expect(String(refused.threw)).toContain('center approval table no longer backs')
    expect(guardRef.current!.pendingCalls(), 'the refused call never entered the ledger').toHaveLength(0)
    tableLive = true
    // path: abort — hang mid-Body, prove the KERNEL sees the live count,
    // cancel from the caller, the entry drains.
    // Abort shape: the caller signal is raised WHILE the body hangs; the
    // innermost dispatch fuse settles the call ABORTED and the entry drains.
    const controller = new AbortController()
    const hanging = double.runCall({
      callId: 'hang',
      name: 'read',
      callerSignal: controller.signal,
      cancelCallerAt: 'inside-body',
      raiseCaller: () => controller.abort(),
    })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(guardRef.current!.pendingCalls().length, `the ledger holds the hung call (samples=${JSON.stringify(samples)})`).toBeGreaterThanOrEqual(1)
    kernel.beginDrain()
    kernel.tombstone()
    const blocked = kernel.release()
    expect(blocked.ok, 'release while the dispatcher ledger holds work').toBe(false)
    if (blocked.ok === false) expect(blocked.code).toBe('LEASE_OPEN')
    hold!()
    // the hung body completes; the raised caller signal settles the call
    await hanging.catch(() => undefined)
    expect(guardRef.current!.pendingCalls(), 'every path drains the ledger').toHaveLength(0)
    expect(kernel.release().ok).toBe(true)
    // the port WAS the ledger at every mid-Body sample:
    const mid = samples.filter((s) => s.path !== 'refused')
    expect(mid.map((s) => s.path).sort()).toEqual(['hang', 'success', 'throw'])
    for (const s of mid) {
      expect(s.port).toBe(s.mid)
      expect(s.mid, `armed at the execute edge (${s.path})`).toBeGreaterThanOrEqual(1)
    }
  }, 20000)
})

describe('review-r1 B2 — a governed mount without read governance refuses read before the Body', () => {
  it('R2b: governed, no fsInstance ⇒ assembly stands, read is NOT owned, guard face refuses read', async () => {
    const built = row.createTeamToolPlaneAssembly(planeInput({ dispatcherLifecycle: { inflight: () => 0 } }, { fsInstance: null }) as never)
    expect(built.ok, `no-fsInstance mount must stand (other rows may mount): ${JSON.stringify(built.ok)}`).toBe(true)
    if (!built.ok) return
    const value = built.value
    expect(value.ownNames).not.toContain('read')
    // U6 PR3 (ARC-B): the kernel rides EVERY governed mount now (the shell
    // row is always kernel-owned). The B2 law STANDS in its generalized
    // form: the read family did NOT register on this mount, so the table
    // answers NULL for `read` forever and the door refuses every read.
    expect(value.centerKernel, 'the mount-wide kernel is present (shell family)').toBeDefined()
    expect(value.centerKernel!.familyIds).toEqual(['dsh.process-family'])
    expect(value.kernelGuard, 'the rejecting face exists for the governed name (B2)').toBeDefined()
    expect(value.kernelGuard!.owns('read')).toBe(true)
    expect(value.kernelGuard!.owns('grep')).toBe(false)
    expect(value.kernelGuard!.identityFor('read')).toBeNull()
  })

  it('R2c: the read call is refused BEFORE its Body — zero native body, typed refusal (CI-05 closed)', async () => {
    const built = row.createTeamToolPlaneAssembly(planeInput({ dispatcherLifecycle: { inflight: () => 0 } }, { fsInstance: null }) as never)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const double = scopedRegistryDouble({ globalNames: ['read', 'grep'] })
    // NO own rows bound: the double carries none of the plane's takeover
    // rows (that is the point — read resolves to the GLOBAL native def and
    // must still be refused at the door by the plane's rejecting face).
    const guard = pairGuard(built.value, double, [])
    const run = await double.runCall({ callId: 'b2-1', name: 'read' })
    expect(run.bodies, 'the native read body must NOT execute for a governed agent').toEqual([])
    expect(String(run.threw)).toContain('center approval table no longer backs')
    expect(guard.observations().map((r) => String(r.event))).toContain('kernel-pre-body-table-refusal')
  })

  it('R2d: CI-03 control — WITHOUT a plane the native read is untouched', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read', 'grep'] })
    const outcome = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)!.map((r) => r.name),
      maskedNames: [],
      assemblyOwnedNames: [],
      realmId: REALM,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.value.publish().ok).toBe(true)
    const run = await double.runCall({ callId: 'ci03', name: 'read' })
    expect(run.bodies.length, 'non-Team native read rides on, unchanged').toBe(1)
    expect(run.threw).toBeUndefined()
  })
})
