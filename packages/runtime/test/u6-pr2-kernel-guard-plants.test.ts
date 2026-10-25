/**
 * U6 PR2 — THE PLANTS. sup-a §5 conditions 6 (an identity mismatch NEVER
 * executes) and 8 (a TOCTOU window produces no effect), plus the PR2
 * enforcing delta: a kernel-owned call whose Definition moved between the
 * dispatch door and the settle is a FAIL-CLOSED VETO of the successful
 * result, where the settled edge alone would only have alarmed.
 *
 * Harness: the PINNED scoped registry double (`a5p1r-scoped-registry-double`)
 * — real listener-chain order, `tools/change` emitted synchronously on every
 * re-registration, the Host's own two cancellation shapes. Every plant ships
 * with the leg that BLINDS it: the same world with the kernel-facing wiring
 * changed (spoofed record / no swap / no `kernelGuard`) proving the refusal
 * is caused by the law under test, not by the harness.
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, definitionIdentityOf } from '../tool-dispatch/index.js'
import { scopedRegistryDouble, type ScopedRegistryDouble } from './a5p1r-scoped-registry-double.js'

const REALM = 'u6pr2-plant-realm'

type Guard = Extract<ReturnType<typeof installScopedToolGuard>, { ok: true }>['value']

interface Lane {
  readonly double: ScopedRegistryDouble
  readonly handle: Guard
  readonly tableIdentity: string
}

/**
 * Mount a governed `read` lane whose pb §6 feed and kernel guard BOTH answer
 * from the center approval table (the same pairing `team-tool-plane.mjs`
 * builds): feed = table identity, guard.owns('read') = true,
 * guard.identityFor = the table's answer. `spoof` replaces the table's
 * record with an identity nobody placed — the condition-6 shape.
 */
/** The live Definition OBJECT the SAME public seam (`tools.get(name, agent)`)
 *  resolves for this scope — the very object the Guard fingerprints. */
function liveDefinition(double: ScopedRegistryDouble): object {
  const get = double.ctx.tools.get as unknown as (name: string, scope?: unknown) => unknown
  const found = get('read', { id: 'agent-m1' }) ?? get('read', 'agent-m1') ?? get('read')
  if (found === undefined || found === null) throw new Error('plant: tools.get resolved no read definition')
  return found as object
}

function lane(options: { spoof?: boolean; guard?: boolean; tableNow?: () => string | null } = {}): Lane {
  const double = scopedRegistryDouble({ globalNames: ['grep'] })
  double.registerOwn('read', 'V1.read')
  const liveDef = liveDefinition(double)
  const tableIdentity = options.spoof === true
    ? definitionIdentityOf({ execute: () => 'nobody-placed-this' })!
    : definitionIdentityOf(liveDef)!
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames: (globalSchemas ?? []).map((row) => row.name),
    maskedNames: [],
    assemblyOwnedNames: ['read'],
    realmId: REALM,
    bindingFeed: (name) =>
      name === 'read' ? { definitionIdentity: tableIdentity, realmId: REALM } : undefined,
    ...(options.guard === false
      ? {}
      : {
          kernelGuard: {
            owns: (name: string) => name === 'read',
            identityFor: (name: string) =>
              name === 'read' ? (options.tableNow ? options.tableNow() : tableIdentity) : null,
          },
        }),
  })
  if (!outcome.ok) throw new Error(`plant install refused: ${outcome.error.code} ${outcome.error.message}`)
  return { double, handle: outcome.value, tableIdentity }
}

const bound = (l: Lane): void => {
  const boundOwn = l.handle.bindOwnTools(['read'])
  if (!boundOwn.ok) throw new Error(`plant bind refused: ${boundOwn.error.message}`)
  const published = l.handle.publish()
  if (!published.ok) throw new Error(`plant publish refused: ${published.error.message}`)
}

const events = (l: Lane): readonly string[] => l.handle.observations().map((row) => String(row.event))

describe('u6-pr2 plants: identity mismatch never executes; the moved Body never delivers', () => {
  it('P1 (cond 6) a table record that does not match the live Body REFUSES THE BIND; sensitivity: the true record binds and runs', async () => {
    // The plant: the center table carries an identity nobody placed. The
    // pb §6 bind compares it against the live scoped read — mismatch is a
    // refusal, and a refused bind means no call of that name ever passes the
    // door. Nothing executes; nothing is verified.
    const double = scopedRegistryDouble({ globalNames: ['grep'] })
    double.registerOwn('read', 'V1.read')
    const spoofed = definitionIdentityOf({ execute: () => 'nobody-placed-this' })!
    const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
    const outcome = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: (globalSchemas ?? []).map((row) => row.name),
      maskedNames: [],
      assemblyOwnedNames: ['read'],
      realmId: REALM,
      bindingFeed: () => ({ definitionIdentity: spoofed, realmId: REALM }),
      kernelGuard: { owns: () => true, identityFor: () => spoofed },
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const boundOwn = outcome.value.bindOwnTools(['read'])
    expect(boundOwn.ok).toBe(false)
    if (boundOwn.ok) return
    expect(boundOwn.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(boundOwn.error.message).toContain('the provider placed')
    const run = await double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies, 'a refused bind executes NOTHING').toEqual([])
    // Sensitivity: the true record binds, publishes, and the Body runs once.
    const honest = lane()
    bound(honest)
    const honestRun = await honest.double.runCall({ callId: 'c2', name: 'read' })
    expect(honestRun.bodies).toEqual(['V1.read'])
  })

  it('P2 (cond 8) a re-registration inside the last gap aborts BEFORE dispatch: zero bodies; sensitivity: nothing moving runs the Body', async () => {
    const l = lane()
    bound(l)
    const run = await l.double.runCall({
      callId: 'c1',
      name: 'read',
      swap: { stage: 'execute-after-ours', name: 'read', identity: 'V2.read' },
    })
    expect(run.bodies, 'the moved Body never ran').toEqual([])
    expect(run.code).toBe('ABORTED_BEFORE_DISPATCH')
    expect(run.bodyInvoked).toBe(false)
    // The post-success veto never fired — there was no success; the abort is
    // the pre-dispatch law, and the kernel wiring did not weaken it.
    expect(events(l)).not.toContain('kernel-post-success-drift-veto')
    // Sensitivity leg: the identical lane with nothing moving.
    const calm = lane()
    bound(calm)
    const quiet = await calm.double.runCall({ callId: 'c2', name: 'read' })
    expect(quiet.bodies).toEqual(['V1.read'])
    expect(quiet.code).toBeUndefined()
  })

  it('P3 (PR2 delta) a Body that moved AFTER its success is VETOED fail-closed; blinded: without the guard the success ships', async () => {
    const l = lane()
    bound(l)
    // A third-party execute listener mounted AFTER ours (inner): the drift
    // lands AFTER the Body returned and BEFORE our door post-checks — the
    // exact §1.2 post-check window.
    const list = l.double.listeners.get('tools/execute') ?? []
    list.push((async (exec: { callId?: unknown }, next: () => Promise<unknown>) => {
      const result = await next()
      if (exec?.callId === 'c1') l.double.registerOwn('read', 'V2.read')
      return result
    }) as unknown as (...args: never[]) => unknown)
    l.double.listeners.set('tools/execute', list)
    const run = await l.double.runCall({ callId: 'c1', name: 'read' })
    // Honest accounting: the Body DID run (it was the Body the door verified).
    expect(run.bodies).toEqual(['V1.read'])
    expect(run.bodyInvoked).toBe(true)
    // But its SUCCESS does not ship: the door converted the settle into a
    // typed fail-closed refusal naming the drift.
    expect(run.threw, 'the veto throws — the result never delivers').toContain('kernel-owned')
    expect(run.threw).toContain('refused fail-closed')
    expect(events(l)).toContain('kernel-post-success-drift-veto')

    // BLINDED leg: the identical world without the kernel guard — the drift
    // still lands, the settled edge still reacts, but NO veto exists and the
    // settle is not converted into a refusal. (Blinding proves the delta.)
    const blind = lane({ guard: false })
    bound(blind)
    const list2 = blind.double.listeners.get('tools/execute') ?? []
    list2.push((async (exec: { callId?: unknown }, next: () => Promise<unknown>) => {
      const result = await next()
      if (exec?.callId === 'c1') blind.double.registerOwn('read', 'V2.read')
      return result
    }) as unknown as (...args: never[]) => unknown)
    blind.double.listeners.set('tools/execute', list2)
    const run2 = await blind.double.runCall({ callId: 'c1', name: 'read' })
    expect(run2.bodies).toEqual(['V1.read'])
    expect(run2.threw, 'no veto exists without the guard — nothing threw').toBeUndefined()
    expect(run2.text).not.toContain('kernel-owned')
    expect(events(blind)).not.toContain('kernel-post-success-drift-veto')
  })

  it('P4 (FIX-K K1 sibling) a TABLE that goes silent DURING the call vetoes the success too — `table unbound (invalidated mid-call)`', async () => {
    // The revoke twin of P3: the live Definition never moves (the door's own
    // checks all pass, and the new pre-body table gate lets the verified Body
    // through because the table backs it AT THE DOOR), but the approval
    // table is invalidated in the post-check window. A success the center
    // no longer backs must not deliver either — the settle veto reads the
    // table as UNBOUND and converts the settle into the same fail-closed
    // refusal shape, naming the unbound table.
    // ONE lane: its OWN live identity backs the table at the door; the
    // flip simulates the revoke landing in the post-check window.
    const flip = { gone: false }
    const l = lane({ tableNow: () => (flip.gone ? null : l.tableIdentity) })
    bound(l)
    const list = l.double.listeners.get('tools/execute') ?? []
    list.push((async (exec: { callId?: unknown }, next: () => Promise<unknown>) => {
      const result = await next()
      if (exec?.callId === 'c1') flip.gone = true // the revoke lands AFTER the Body, BEFORE the settle check
      return result
    }) as unknown as (...args: never[]) => unknown)
    l.double.listeners.set('tools/execute', list)
    const run = await l.double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies, 'the Body the door verified ran (the door was backed then)').toEqual(['V1.read'])
    expect(run.threw, 'an unbacked success never delivers').toContain('table unbound (invalidated mid-call)')
    expect(events(l)).toContain('kernel-post-success-drift-veto')
  })

  it('P3b a kernel-owned success whose Body did NOT move keeps the native success shape untouched (cond 10)', async () => {
    const l = lane()
    bound(l)
    const run = await l.double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies).toEqual(['V1.read'])
    expect(run.threw).toBeUndefined()
    expect(run.code).toBeUndefined()
    expect(events(l)).not.toContain('kernel-post-success-drift-veto')
  })
})
