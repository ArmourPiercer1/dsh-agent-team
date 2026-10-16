/**
 * a5p1r-shadow-attribution.test.ts — Alpha.5 PR1-residual R-a: a trusted native
 * NAME is not a trusted native DEFINITION.
 *
 * THE SCENARIO (ordinary, non-malicious, and supported by the pinned Host):
 * a third-party row or MCP bridge contributes a per-agent variant under a name
 * the Host also ships natively — the Host's own duplicate-registration error
 * tells it to do exactly that: `"tool "x" is already registered (for a
 * per-agent variant, register through that agent's `agent.ctx` instead)"`. It
 * registers BEFORE the Team assembly runs, so it is on the surface the assembly
 * observes. The merged PR1 asked two questions of such a name: is it on the
 * trusted native list (the GLOBAL `tools.schemas()` view), and is its current
 * definition pinnable (`tools.get(name, scope)`). Both answers are YES, so the
 * name was inherited as `native:<name>` with `verified: true` — and the pinned
 * identity was the SHADOWING body. The PR1 §12 evidence disclosed exactly this
 * ("a native name ALREADY shadowed by a scope-local definition at publish time
 * is pinned from that scope's own resolution and so enters governance as
 * verified").
 *
 * THE RULE THIS ROUND PINS: the assembly compares the SAME public seam read
 * TWICE — the trusted GLOBAL definition identity (`tools.get(name)`, no scope)
 * against the definition THIS Agent actually resolves (`tools.get(name, scope)`)
 * — and only their agreement earns an inherited native Binding. Disagreement is
 * a typed refusal at dispatch, not a debate about intent, and it is never
 * dismissed as "a malicious Host rewriting memory": the scenario here is an
 * ordinary registration. An explicit Team Binding (the assembly's own
 * `bindOwnTools` / `bindMcpTools` entry) still admits the same name, because
 * then a real identity was bound by the trusted assembly on purpose.
 *
 * The double is `a5p1r-scoped-registry-double.ts`, whose layer resolution and
 * stage order are transcribed from the pinned registry (see its header).
 *
 * @module test/a5p1r-shadow-attribution
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, type ScopedGuardHandle } from '../tool-dispatch/index.js'
import { scopedRegistryDouble } from './a5p1r-scoped-registry-double.js'

interface Assembly {
  readonly handle: ScopedGuardHandle
  readonly publish: () => void
}

/** Assemble exactly the way production does: read the GLOBAL view as the
 *  trusted native list, install, publish. */
function assemble(double: ReturnType<typeof scopedRegistryDouble>, ownToolNames: readonly string[] = []): Assembly {
  let nativeNames: string[] = []
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  nativeNames = (globalSchemas ?? []).map((row) => row.name)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctx,
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames,
    maskedNames: [],
  })
  if (!outcome.ok) throw new Error(`install refused: ${outcome.error.code} ${outcome.error.message}`)
  const handle = outcome.value
  if (ownToolNames.length > 0) {
    const bound = handle.bindOwnTools(ownToolNames)
    if (!bound.ok) throw new Error(`bindOwnTools refused: ${bound.error.code} ${bound.error.message}`)
  }
  return {
    handle,
    publish: () => {
      const published = handle.publish()
      if (!published.ok) throw new Error(`publish refused: ${published.error.code} ${published.error.message}`)
    },
  }
}

describe('a5p1r R-a — a native NAME earns nothing without the trusted native DEFINITION behind it', () => {
  it('RED (the residual finding): a per-agent same-name variant registered BEFORE assembly used to enter governance as a verified native', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read'] })
    // The ordinary third-party shape: a per-agent variant, same name, own layer,
    // mounted before the Team assembly exists.
    double.registerOwn('read', 'THIRD_PARTY.read')
    expect(double.agentResolution('read')).toBe('THIRD_PARTY.read')
    expect(double.globalResolution('read')).toBe('NATIVE.read')

    const { handle, publish } = assemble(double)
    publish()
    const entry = handle.dispatcher.surface.entryOf('read')
    expect(entry).toBeDefined()
    // THE FINDING: name-only attribution pinned the shadowing body as native.
    // This is the assertion the merged lane fails, and what this round closes.
    expect(entry?.verified).toBe(false)
    expect(entry?.binding.bindingId).not.toBe('native:read')
    expect(entry?.binding.implementationOrigin).not.toBe('dsh-native')
    expect(entry?.unverifiedReason).toBe('native-shadowed')
  })

  it('refuses the shadowed name at dispatch: neither the shadowing body nor the native one runs', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read'] })
    double.registerOwn('read', 'THIRD_PARTY.read')
    const { handle, publish } = assemble(double)
    publish()
    const run = await double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies).toEqual([])
    expect(run.threw ?? run.text).toContain('team tool guard: "read"')
    // The typed fact, not a generic "unverified".
    expect(run.threw ?? run.text).toContain('shadows')
    expect(handle.dispatcher.surface.entryOf('read')?.verified).toBe(false)
  })

  it('still inherits a name the two public reads AGREE on (the refusal is about the disagreement, not about being inherited)', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read', 'write'] })
    const { handle, publish } = assemble(double)
    publish()
    const read = handle.dispatcher.surface.entryOf('read')
    expect(read?.verified).toBe(true)
    expect(read?.binding.bindingId).toBe('native:read')
    // The pinned identity is an opaque content-free id this process minted for
    // the Body the two reads agreed on — never a name-shaped guess.
    expect(read?.binding.definitionIdentity).toMatch(/^def#\d+$/)
    const run = await double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies).toEqual(['NATIVE.read'])
  })

  it('a shadow on ONE name never touches the others on the same surface', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read', 'write'] })
    double.registerOwn('read', 'THIRD_PARTY.read')
    const { handle, publish } = assemble(double)
    publish()
    expect(handle.dispatcher.surface.entryOf('read')?.verified).toBe(false)
    expect(handle.dispatcher.surface.entryOf('write')?.verified).toBe(true)
    const run = await double.runCall({ callId: 'c1', name: 'write' })
    expect(run.bodies).toEqual(['NATIVE.write'])
    const shadowed = await double.runCall({ callId: 'c2', name: 'read' })
    expect(shadowed.bodies).toEqual([])
  })

  it('AN EXPLICIT Team Binding admits the same same-name body (the second pin: bind = allow)', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read'] })
    double.registerOwn('read', 'TEAM.read')
    // The trusted assembly knows this body: it registered it and bound it by
    // identity through the documented entry, before publishing.
    const { handle, publish } = assemble(double, ['read'])
    publish()
    const entry = handle.dispatcher.surface.entryOf('read')
    expect(entry?.verified).toBe(true)
    expect(entry?.binding.bindingId).toBe('team-own:s-m1:read')
    // The identity is the opaque `def#<n>` fingerprint install computes from the
    // Body it read, so the assertion is a SHAPE plus the proof that matters:
    // the Body this Binding pins is the one the call runs (below).
    expect(entry?.binding.definitionIdentity).toMatch(/^def#\d+$/)
    const run = await double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies).toEqual(['TEAM.read'])
  })

  it('a native name whose TRUSTED read is unreadable is never inherited as verified (fail closed, no shrug)', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read'], globalGetThrows: true })
    const { handle, publish } = assemble(double)
    publish()
    const entry = handle.dispatcher.surface.entryOf('read')
    expect(entry?.verified).toBe(false)
    expect(entry?.binding.bindingId).not.toBe('native:read')
    expect(entry?.unverifiedReason).toBe('native-unreadable')
    const run = await double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies).toEqual([])
  })

  it('publish records the shadow loudly, with the two identities it compared', () => {
    const double = scopedRegistryDouble({ globalNames: ['read'] })
    double.registerOwn('read', 'THIRD_PARTY.read')
    const { handle, publish } = assemble(double)
    publish()
    const rows = handle.observations().filter((o) => String(o.event) === 'published-surface-shadowed')
    expect(rows.length).toBe(1)
    const row = rows[0] as unknown as { names: readonly string[]; detail: string }
    expect(row.names).toContain('read')
    // The record carries the two IDENTITIES it compared (fingerprints, not
    // labels): a reviewer must be able to tell "the trusted view said A and this
    // scope said B" apart from a bare "not verified".
    expect(row.detail).toMatch(/trusted global definition is def#\d+ but this Agent resolves def#\d+/)
    const entry = handle.dispatcher.surface.entryOf('read')
    expect(row.detail).toContain(String(entry?.binding.definitionIdentity))
  })

  it('a shadow that appears AFTER publish is still caught by the per-call read (the existing law keeps its teeth)', async () => {
    const double = scopedRegistryDouble({ globalNames: ['read'] })
    const { handle, publish } = assemble(double)
    publish()
    expect(handle.dispatcher.surface.entryOf('read')?.verified).toBe(true)
    double.registerOwn('read', 'LATE.read')
    const run = await double.runCall({ callId: 'c1', name: 'read' })
    expect(run.bodies).toEqual([])
    expect(run.threw ?? run.text).toContain('different ToolDefinition')
    expect(handle.dispatcher.surface.entryOf('read')?.verified).toBe(false)
  })
})
