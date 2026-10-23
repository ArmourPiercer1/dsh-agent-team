/**
 * A5-M2 B-SUBAGENT-CONTROL-PLANE-MOUNT (root 21:01 card; the house proof
 * shape is a5m2-team-plane-mount-c1) — the spec of the control-trio blocks
 * THIS lane owns: the plane injection law (config is law, not wiring), the
 * placement of the wiring's definitions into the ONE machinery
 * (allDefs / placedByName / ownNames / placementFeed), the post-publish
 * family round-trip through the PRODUCTION pa-mount-registry, and the
 * teardown drain. The plane is the REAL createTeamToolPlaneAssembly; the
 * wiring is the REAL createBSubagentControlWiring over real-identity native
 * doubles; the placement identity is the REAL definitionIdentityOf mint.
 *
 * Legs:
 *  (a) ZERO FLIP: no backends.subagentControl = no wiring face (OMITTED, not
 *      undefined), no trio names in ownNames, no placement rows;
 *  (b) the injection law: enabled-without-inject, inject-with-gate-off and a
 *      shape-defective inject all refuse the MOUNT with the typed code;
 *  (c) REAL placement + registry round-trip: ownNames carries the trio;
 *      placementFeed answers the PLACED def identities (never the capture
 *      side); familyRegistrations() keys (read lazily through the plane's
 *      own feed) round-trip registerA5GovernedFamily/a5GovernedFamilyFor;
 *  (d) teardown: the plane mount's dispose drives the wiring's dispose —
 *      afterwards a trio call is refused by the DISPOSED/DRAINING law with
 *      zero port entries.
 *
 * NOT C2 — no Host, no ports, no tests/homes, no network. The tier stays
 * 接线未测 at this tip; nothing here claims production wiring.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-subagent-plane-mount
 */
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'

const REALM = 'b-subagent-plane-realm'
const PROVIDER = 'a5p5-plane'
const TRIO = ['interrupt_agent', 'list_agents', 'send_message']

interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec?: unknown) => Promise<unknown>
}
interface Built { ok: boolean; code?: string; message?: string; value?: PlaneValue }
interface PlaneValue {
  ownNames: string[]
  definitions: Definition[]
  placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined
  subagentControl?: { familyId: string, providerId: string, placementNames: string[], familyRegistrations: () => Array<{ name: string, recordIndex: number, definitionIdentity: string, entry: Record<string, unknown> }> }
  mount: (agentCtx: unknown) => { ok: boolean; code?: string; dispose?: () => unknown }
}

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: Record<string, unknown>) => void
  a5GovernedFamilyFor: (key: string) => Record<string, unknown> | undefined
}
const WIRING_ROW = (await import(new URL('../src/plugin/live/governed-families/subagent-wiring.mjs', import.meta.url).href)) as {
  createBSubagentControlWiring: (input: Record<string, unknown>) => Record<string, unknown> & { ok: boolean; code?: string; message?: string }
}
const { registerA5GovernedFamily, a5GovernedFamilyFor } = REGISTRY

const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function buildPlane (extra: Record<string, unknown> = {}, sink: string[] = []): Built {
  return PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: 'b-subagent-plane-team',
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'b-subagent-tpl',
    role: 'leader',
    instanceId: 'b-subagent-instance',
    onObserve: (row: unknown) => sink.push(String(row)),
    ...extra,
  })
}

const MARK = Symbol.for('dsh.subagent.adjacentAgentSendMessageTool')

/** The native doubles: recording faces; send_message carries the host's
 *  standard adjacency mark (the adapter's marker gate refuses otherwise). */
function makeNatives (): { natives: Definition[], calls: string[] } {
  const calls: string[] = []
  const natives = TRIO.map((name) => {
    const def = {
      name,
      description: `native ${name} description bytes`,
      parameters: Object.freeze({ type: 'object', properties: Object.freeze({ agent_id: { type: 'string' } }), required: Object.freeze([]) }),
      output: Object.freeze({ schema: Object.freeze({ type: 'object' }), render: (value: unknown) => JSON.stringify(value) }),
      async execute (args: Record<string, unknown>): Promise<unknown> {
        calls.push(name)
        return Object.freeze({ served: `${name}-bytes`, args })
      },
    }
    // The host marks BEFORE freezing (defineProperty on a frozen face throws;
    // the wiring re-marks its PLACED copy with the same law).
    if (name === 'send_message') Object.defineProperty(def, MARK, { value: true })
    return Object.freeze(def) as unknown as Definition
  })
  return { natives, calls }
}

const serviceDouble = Object.freeze({
  async sendMessage (): Promise<string> { return 'msg-x' },
  interrupt (): void { /* recording double */ },
  async listChildren (): Promise<unknown[]> { return [] },
  async listDescendants (): Promise<unknown[]> { return [] },
})
const registryDouble = Object.freeze({ get: (_id: unknown): unknown => undefined })

/** The REAL wiring over the doubles; its placement feed reads LAZILY through
 *  the live plane value exactly like the glue section (so the family keys can
 *  only ever be the PLANE's placement identities). */
function makeWiring (planeRef: { current: PlaneValue | null }): { natives: Definition[], calls: string[], wiring: Record<string, unknown> & { ok: boolean } } {
  const { natives, calls } = makeNatives()
  const wiring = WIRING_ROW.createBSubagentControlWiring({
    providerId: PROVIDER,
    captured: Object.freeze(Object.fromEntries(natives.map((def) => [def.name, Object.freeze({ native: def, definitionIdentity: `capture-side:${def.name}` })]))),
    liveNative: (name: string) => natives.find((def) => def.name === name),
    subagentService: serviceDouble,
    liveSubagentService: () => serviceDouble,
    agentsRegistry: registryDouble,
    liveAgentsRegistry: () => registryDouble,
    isAdjacentAgentSendMessageTool: (definition: unknown) => typeof definition === 'object' && definition !== null && (definition as Record<symbol, unknown>)[MARK] === true,
    markAdjacentAgentSendMessageTool: (definition: object) => {
      Object.defineProperty(definition, MARK, { value: true })
      return definition
    },
    placementFeed: (name: string) => planeRef.current?.placementFeed(name),
    pa: Object.freeze(Object.assign(
      async () => ({ kind: 'allow', consumedProof: { token: 'spec-proof' } }),
      { closePlan: (_callId: string) => { /* spec plane */ } },
    )),
  })
  return { natives, calls, wiring }
}

const injectOf = (wiring: Record<string, unknown>): Record<string, unknown> => Object.freeze({
  definitions: wiring.definitions,
  familyId: wiring.familyId,
  providerId: wiring.providerId,
  placementNames: wiring.placementNames,
  familyRegistrations: wiring.familyRegistrations,
  dispose: wiring.dispose,
})

describe('a5m2-subagent-plane-mount (a) zero flip', () => {
  it('no inject = the ordinary mount byte-for-byte: no face (omitted, not undefined), no trio ownNames, no placement rows', () => {
    const built = buildPlane()
    expect(built.ok, built.message).toBe(true)
    const value = built.value
    if (value === undefined) throw new Error('no plane value')
    expect('subagentControl' in value, 'presence law: OMITTED when not deployed').toBe(false)
    expect(value.ownNames.filter((n) => TRIO.includes(n))).toEqual([])
    expect(value.placementFeed('send_message')).toBeUndefined()
  })
})

describe('a5m2-subagent-plane-mount (b) the injection law', () => {
  it('enabled without inject, inject with the gate off, and a shape-defective inject all refuse the MOUNT with the typed code', () => {
    const planeRef: { current: PlaneValue | null } = { current: null }
    const { wiring } = makeWiring(planeRef)
    expect(wiring.ok).toBe(true)
    const enabledNoInject = buildPlane({ plane: { subagentControlEnabled: true } })
    expect(enabledNoInject.ok).toBe(false)
    expect(enabledNoInject.code).toBe('SUBAGENT_CONTROL_INJECT_INVALID')
    const gateOffInject = buildPlane({ plane: {}, backends: { subagentControl: injectOf(wiring) } })
    expect(gateOffInject.ok).toBe(false)
    expect(gateOffInject.code).toBe('SUBAGENT_CONTROL_INJECT_INVALID')
    const badFamily = buildPlane({
      plane: { subagentControlEnabled: true },
      backends: { subagentControl: Object.freeze({ ...injectOf(wiring), familyId: 'B-WRONG' }) },
    })
    expect(badFamily.ok).toBe(false)
    expect(badFamily.code).toBe('SUBAGENT_CONTROL_INJECT_INVALID')
    const extraKey = buildPlane({
      plane: { subagentControlEnabled: true },
      backends: { subagentControl: Object.freeze({ ...injectOf(wiring), extra: 1 }) },
    })
    expect(extraKey.ok).toBe(false)
    expect(extraKey.message).toContain('NOTHING else')
  })
})

describe('a5m2-subagent-plane-mount (c/d) placement, registry round-trip, teardown', () => {
  it('the trio ride the ONE placement: ownNames + placementFeed identities + family registrations round-trip; the mount dispose drains the wiring', async () => {
    const planeRef: { current: PlaneValue | null } = { current: null }
    const { calls, wiring } = makeWiring(planeRef)
    expect(wiring.ok).toBe(true)
    const built = buildPlane({ plane: { subagentControlEnabled: true }, backends: { subagentControl: injectOf(wiring) } })
    expect(built.ok, built.message).toBe(true)
    const value = built.value
    if (value === undefined) throw new Error('no plane value')
    planeRef.current = value
    // (c1) the trio are THIS plane's own names, through the existing list.
    for (const name of TRIO) expect(value.ownNames, `ownNames carries ${name}`).toContain(name)
    // (c2) placementFeed answers the PLACED def identity (the seam the Guard
    // bindingFeed and the family keys both read).
    const face = value.subagentControl
    if (face === undefined) throw new Error('no subagentControl face')
    expect(face.familyId).toBe('B-SUBAGENT')
    expect(face.providerId).toBe(PROVIDER)
    const placedByName = new Map(value.definitions.map((d) => [d.name, d]))
    for (const name of TRIO) {
      const fed = value.placementFeed(name)
      const placed = placedByName.get(name)
      if (placed === undefined) throw new Error(`no placed def for ${name}`)
      expect(fed?.definitionIdentity, `${name} feed identity`).toBe(definitionIdentityOf(placed))
      expect(fed?.realmId).toBe(REALM)
    }
    // (c3) the family keys are the PLACEMENT identities (never the capture
    // side) and round-trip the PRODUCTION registry.
    const registrations = face.familyRegistrations()
    expect(registrations.map((r) => r.recordIndex).sort()).toEqual([44, 45, 46])
    for (const registration of registrations) {
      expect(registration.definitionIdentity.startsWith('capture-side:'), 'keys are placement, not capture-side').toBe(false)
      registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
      expect(a5GovernedFamilyFor(registration.definitionIdentity)?.familyId).toBe('B-SUBAGENT')
    }
    // (d) the mount's dispose drives the wiring's dispose: afterwards a trio
    // call is refused by the DISPOSED/DRAINING law with ZERO port entries.
    const disposers: Array<() => unknown> = []
    const mounted = value.mount({ tools: { register: (def: Definition) => { disposers.push(() => { void def; return undefined }) } } })
    expect(mounted.ok).toBe(true)
    const send = placedByName.get('send_message')
    if (send === undefined) throw new Error('no send def')
    mounted.dispose?.()
    const error = await send.execute({ agent_id: 'agent-child-1', message: 'after dispose' }, { agent: { id: 'agent-m', session: { header: { id: 's-m' } } } }).then(() => null, (e: unknown) => e as Error)
    expect(error, 'post-dispose calls refuse').toBeInstanceOf(Error)
    expect(String(error?.message) + String((error as Error & { subagentRefusal?: { code?: string } }).subagentRefusal?.code ?? ''), 'the refusal names the teardown law').toMatch(/DISPOSED|DRAINING/)
    expect(calls, 'the native bodies never ran').toEqual([])
  })
})
