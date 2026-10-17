/**
 * a5pbr2-binding-feed.test.ts — the pb §6 BINDING FEED (provider side of the
 * per-call comparison), wired formally on `installScopedToolGuard`.
 *
 * THE GAP THIS CLOSES (RED, pinned verbatim before any wiring):
 *   `team tool guard: the Tool Binding for "read" cannot be verified at
 *    dispatch time (no fallback to the native body)`
 * — reproduced byte-identical in the installed-production-entry world
 *   (`evidence/alpha5/install-entry/runs/2026-10-17T17-06-56Z/world-team.json`
 *   `memberReadResult`, branch `feat/alpha5-install-entry-evidence` @
 *   `6a0f8e19`) and in six shapes in `evidence/alpha5/wiring/bind-diag/`.
 * The mechanism: in the web profile the trusted GLOBAL face is empty, so the
 * inherited-native lane has no trusted side to compare with, and a governed
 * Agent's core `read` is bound `unattributed` — refused at every call. The
 * per-call fingerprint compare is already in production
 * (`scoped-dispatcher.ts` `noteCallEdgeDefinition`/`decide`); what was NOT
 * wired was the PROVIDER side: the identity of the Definition the Team
 * assembly PLACED, delivered as the bind-time comparison input. That is the
 * R1 PLACEMENT lane (Q4; glue4-prodentry AMENDMENT), formalized here.
 *
 * THE THREE SEMANTICS this lane owes, each pinned by a leg below:
 *   1. revocation-then-drift ⇒ refusal — and a moved-back identity does NOT
 *      re-admit (only an explicit re-bind does);
 *   2. cross-realm same-name ⇒ refusal (design §2.1 Realm 不可混淆; the
 *      ra-review NC-1 shape), never a cross-boundary compare;
 *   3. feed ABSENT ⇒ today's refusal stands byte-for-byte — zero fallback
 *      to the native body, the feed only ever tightens.
 *
 * The positive shape (F2) is the lane half of the live positive control run
 * by `evidence/alpha5/pb-binding-feed/` (real host, placed read RAN).
 *
 * @module test/a5pbr2-binding-feed
 */
import { describe, expect, it } from 'vitest'
import {
  definitionIdentityOf,
  installScopedToolGuard,
  type BindingFeedEntry,
  type ScopedGuardAgentCtx,
} from '../tool-dispatch/index.js'

/** The refusal text the world already met, byte-for-byte (closed-world-guard.ts:199). */
const VERBATIM_NO_FALLBACK =
  'team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)'

const REALM = 'a5pbr2-realm'

interface FeedWorldOptions {
  readonly surface?: string[]
  /** The trusted GLOBAL face. [] = the measured web-profile shape (bind-diag). */
  readonly globalSurface?: string[]
}

/**
 * A minimal registry double with the two facts the feed path touches: the
 * scoped public read (`tools.get(name, scope)`) answers with the SAME object
 * for repeated reads, and the assembly can PLACE a Definition it holds.
 * The global face defaults to EMPTY — the world the installed entry met.
 */
function feedWorld(options: FeedWorldOptions = {}) {
  const surface = [...(options.surface ?? ['read', 'bash'])]
  const globalSurface = [...(options.globalSurface ?? [])]
  const definitions = new Map<string, { name: string; execute: () => unknown }>()
  for (const name of surface) definitions.set(name, { name, execute: () => `inherited:${name}` })
  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()
  let bodyExecs = 0
  const ctx = {
    tools: {
      guard: (guard: (exec: { name: string; agent?: unknown }) => string | undefined) => {
        guards.push(guard)
        return () => {
          const at = guards.indexOf(guard)
          if (at >= 0) guards.splice(at, 1)
        }
      },
      schemas: (scope?: unknown) =>
        (scope === undefined ? globalSurface : surface).map((name) => ({ name })),
      get: (name: string, scope?: unknown) => (scope === undefined ? undefined : definitions.get(name)),
    },
    on: (event: string, listener: (...args: never[]) => unknown) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
  } as unknown as ScopedGuardAgentCtx

  return {
    ctx,
    surface,
    globalSurface,
    guards,
    /** How many times a Body actually ran under this world's guard. */
    bodyExecs: () => bodyExecs,
    /** The assembly PLACES a Definition into this Agent's own layer and
     *  keeps the very object it registered (that is placement attribution). */
    place: (name: string, marker: string) => {
      const def = { name, execute: () => marker }
      definitions.set(name, def)
      if (!surface.includes(name)) surface.push(name)
      return def
    },
    /** Same Scope, same name, a DIFFERENT body (the R2 hazard). */
    swapDefinition: (name: string, marker: string) => {
      definitions.set(name, { name, execute: () => marker })
    },
    /** The moved-back shape: the ORIGINAL object resolves again. */
    restoreDefinition: (name: string, def: { name: string; execute: () => unknown }) => {
      definitions.set(name, def)
    },
    /** Run one dispatchable call the way the registry does: guard stage,
     *  then Body, then the settled edge. Returns the result or throws the
     *  typed refusal. */
    runCall: async (name: string, callId: string) => {
      const exec = { name, callId, agent: { id: 'agent-m1' } }
      const denial = guards.reduce<string | undefined>(
        (acc, guardFn) => (acc !== undefined ? acc : guardFn(exec as { name: string; agent?: unknown })),
        undefined,
      )
      if (denial !== undefined) throw new Error(denial)
      bodyExecs += 1
      const def = definitions.get(name)
      const result = { isError: false, text: String(def?.execute()) }
      for (const listener of listeners.get('tools/result') ?? []) {
        await (listener as unknown as (e: unknown, r: unknown) => unknown)(exec, result)
      }
      return result
    },
  }
}

function install(world: ReturnType<typeof feedWorld>, over: Record<string, unknown> = {}) {
  return installScopedToolGuard({
    agentCtx: world.ctx,
    runtimeAgent: { id: 'agent-m1', session: { header: { id: 'session-m1' } } },
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1', 'agent-m1'],
    // The measured web-profile fact: the trusted GLOBAL view is EMPTY, so the
    // inherited-native lane can verify nothing (bind-diag law).
    nativeNames: world.globalSurface,
    ...over,
  })
}

describe('pb §6 binding feed — 3. no feed ⇒ today\'s refusal stands (zero fallback)', () => {
  it('R1 RED pin: an un-fed inherited read is refused VERBATIM, body never runs', async () => {
    const world = feedWorld()
    const outcome = install(world)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const published = outcome.value.publish()
    if (!published.ok) throw new Error(published.error.message)
    // The exact fact the installed production entry met (6a0f8e19, memberReadResult).
    expect(world.guards[0]!({ name: 'read', agent: { id: 'agent-m1' } })).toBe(VERBATIM_NO_FALLBACK)
    await expect(world.runCall('read', 'c-red')).rejects.toThrow(VERBATIM_NO_FALLBACK)
    expect(world.bodyExecs()).toBe(0) // "no fallback to the native body" is a fact, not a slogan
    const entry = outcome.value.dispatcher.surface.entryOf('read')
    expect(entry?.verified).toBe(false)
    expect(entry?.unverifiedReason).toBe('unattributed')
  })

  it('R2 the feed alone is not an allow: fed + placed but NEVER bound still refuses VERBATIM', async () => {
    const world = feedWorld()
    world.place('read', 'placed')
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: ['read'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'read' ? { definitionIdentity: 'def:whatever', realmId: REALM } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    // bindOwnTools(['read']) deliberately NOT called: binding is the act, the feed only informs it.
    const published = outcome.value.publish()
    if (!published.ok) throw new Error(published.error.message)
    await expect(world.runCall('read', 'c-nofeedbind')).rejects.toThrow(VERBATIM_NO_FALLBACK)
    expect(world.bodyExecs()).toBe(0)
  })
})

describe('pb §6 binding feed — positive shape: placement record ⇒ verified ⇒ the Body runs', () => {
  it('F1 bindOwnTools with a feed entry pins the PROVIDER record, the call abstains, the result returns', async () => {
    const world = feedWorld()
    const placed = world.place('read', 'placed-read-body')
    const identity = definitionIdentityOf(placed)
    expect(typeof identity).toBe('string')
    const observations: Record<string, unknown>[] = []
    const outcome = install(world, {
      maskedNames: ['read'], // the takeover fact: the inherited name was masked for this own-layer Body
      realmId: REALM,
      assemblyOwnedNames: ['read'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'read' ? { definitionIdentity: identity!, realmId: REALM } : undefined,
      onObserve: (row: Record<string, unknown>) => observations.push(row),
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    const bound = handle.bindOwnTools(['read'])
    expect(bound.ok).toBe(true)
    expect(observations.some((o) => o.event === 'binding-feed-verified' && o.tool === 'read')).toBe(true)
    const entry = handle.dispatcher.surface.entryOf('read')
    expect(entry?.verified).toBe(true)
    expect(entry?.binding.definitionIdentity).toBe(identity)
    expect(entry?.binding.implementationOrigin).toBe('team-trusted-extension') // audit honesty (RA ②-5): never a fake dsh-native
    const published = handle.publish()
    if (!published.ok) throw new Error(published.error.message)
    // read no longer rides the inherited lane: the owned-name filter excluded it.
    expect(observations.some((o) => o.event === 'published-surface-unverified' && (o.names as string[]).includes('read'))).toBe(false)
    const result = await world.runCall('read', 'c-fed')
    expect(result).toEqual({ isError: false, text: 'placed-read-body' }) // the Body the provider placed answered, and the result returned
    expect(world.bodyExecs()).toBe(1)
  })

  it('F2 byte-identity of the no-feed bind path (the seam only ever tightens)', () => {
    const world = feedWorld()
    const placed = world.place('team_grep', 'placed-grep')
    const outcome = install(world, { assemblyOwnedNames: ['team_grep'] }) // no realmId, no bindingFeed
    if (!outcome.ok) throw new Error(outcome.error.message)
    expect(outcome.value.bindOwnTools(['team_grep']).ok).toBe(true)
    const entry = outcome.value.dispatcher.surface.entryOf('team_grep')
    expect(entry?.binding.bindingId).toBe(`team-own:session-m1:team_grep`)
    expect(entry?.binding.definitionIdentity).toBe(definitionIdentityOf(placed))
    expect(entry?.verified).toBe(true)
  })
})

describe('pb §6 binding feed — 1. revocation-then-drift ⇒ refusal (never a self-return)', () => {
  it('D1 drift revokes the verification; a moved-BACK body does NOT re-admit; only an explicit re-bind does', async () => {
    const world = feedWorld()
    const placed = world.place('read', 'placed-read-body')
    const identity = definitionIdentityOf(placed)!
    const feed: BindingFeedEntry | undefined = { definitionIdentity: identity, realmId: REALM }
    const observations: Record<string, unknown>[] = []
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: ['read'],
      bindingFeed: (name: string) => (name === 'read' ? feed : undefined),
      onObserve: (row: Record<string, unknown>) => observations.push(row),
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.bindOwnTools(['read']).ok).toBe(true)
    const published = handle.publish()
    if (!published.ok) throw new Error(published.error.message)
    expect((await world.runCall('read', 'd-ok')).text).toBe('placed-read-body')
    const revisionBefore = handle.dispatcher.surface.entryOf('read')!.revision

    // Drift: same Scope, same name, a DIFFERENT Body answers the public seam.
    world.swapDefinition('read', 'someone-elses-body')
    await expect(world.runCall('read', 'd-drift')).rejects.toThrow(
      'resolves to a different ToolDefinition than the one its Binding pinned',
    )
    expect(world.bodyExecs()).toBe(1) // the drifted body never ran
    let entry = handle.dispatcher.surface.entryOf('read')!
    expect(entry.verified).toBe(false) // the verification is WITHDRAWN at this call
    expect(entry.unverifiedReason).toBe('definition-drift')
    expect(entry.revision).toBe(revisionBefore + 1) // withdrawal = a new immutable revision, never an edit

    // The moved-BACK shape: the ORIGINAL object resolves again. Identity
    // agreement must NOT resurrect the withdrawn verification — the old
    // verification is burned (PR1 Gate R2), or withdrawal would be cosmetic.
    // The guard keeps naming the precise fact it recorded (the drift), never
    // silently softening back into "unverified" or, worse, an abstain.
    world.restoreDefinition('read', placed)
    await expect(world.runCall('read', 'd-back')).rejects.toThrow(
      'team tool guard: "read" now resolves to a different ToolDefinition than the one its Binding pinned',
    )
    expect(world.bodyExecs()).toBe(1)
    entry = handle.dispatcher.surface.entryOf('read')!
    expect(entry.verified).toBe(false)

    // The documented way back: an explicit re-bind by the trusted assembly.
    expect(handle.bindOwnTools(['read']).ok).toBe(true)
    expect(handle.dispatcher.surface.entryOf('read')!.verified).toBe(true)
    expect(handle.dispatcher.surface.entryOf('read')!.revision).toBeGreaterThanOrEqual(entry.revision + 1)
    expect((await world.runCall('read', 'd-rebound')).text).toBe('placed-read-body')
  })

  it('D2 bind-time placement integrity: what moved between PLACEMENT and BIND is refused, never pinned', () => {
    const world = feedWorld()
    const placed = world.place('read', 'placed-read-body')
    const placedIdentity = definitionIdentityOf(placed)!
    // The provider records its placement; between then and bind, a shadow lands.
    world.swapDefinition('read', 'shadow-body')
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: ['read'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'read' ? { definitionIdentity: placedIdentity, realmId: REALM } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['read'])
    expect(bound.ok).toBe(false)
    if (bound.ok) return
    expect(bound.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(bound.error.message).toContain('the Body moved between placement and bind')
    expect(outcome.value.dispatcher.surface.entryOf('read')?.verified).not.toBe(true)
  })
})

describe('pb §6 binding feed — 2. cross-realm same-name ⇒ refusal', () => {
  it('X1 a feed entry from ANOTHER realm is refused, never compared across the boundary', async () => {
    const world = feedWorld()
    const placed = world.place('read', 'placed-read-body')
    const identity = definitionIdentityOf(placed)!
    const observations: Record<string, unknown>[] = []
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: ['read'],
      // Same name, same identity string, but the entry claims another realm —
      // the NC-1 shape: a verification made in world A never verifies world B.
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'read' ? { definitionIdentity: identity, realmId: 'other-realm' } : undefined,
      onObserve: (row: Record<string, unknown>) => observations.push(row),
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['read'])
    expect(bound.ok).toBe(false)
    if (bound.ok) return
    expect(bound.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(bound.error.message).toContain('Realm 不可混淆')
    expect(observations.some((o) => o.event === 'bind-refused-feed-realm-mismatch')).toBe(true)
    const published = outcome.value.publish()
    if (!published.ok) throw new Error(published.error.message)
    // Zero fallback stands: the call meets the verbatim refusal and no Body runs.
    await expect(world.runCall('read', 'x1')).rejects.toThrow(VERBATIM_NO_FALLBACK)
    expect(world.bodyExecs()).toBe(0)
  })

  it('X2 a realm-less assembly cannot consume a realm-carrying feed (pairing is total)', () => {
    const world = feedWorld()
    const placed = world.place('read', 'placed-read-body')
    const identity = definitionIdentityOf(placed)!
    const outcome = install(world, {
      // NO realmId on the assembly, yet a feed entry carries one.
      assemblyOwnedNames: ['read'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'read' ? { definitionIdentity: identity, realmId: REALM } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['read'])
    expect(bound.ok).toBe(false)
    if (bound.ok) return
    expect(bound.error.message).toContain('realm')
  })

  it('X3 R5 gate: a feed entry for a name the assembly never placed is a refusal, not a binding', () => {
    const world = feedWorld()
    // 'bash' is inherited-only: this assembly placed nothing for it.
    const foreign = world.place('bash', 'foreign-body')
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: [], // nothing placed
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'bash' ? { definitionIdentity: definitionIdentityOf(foreign)!, realmId: REALM } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['bash'])
    expect(bound.ok).toBe(false)
    if (bound.ok) return
    expect(bound.error.message).toContain('never placed')
    expect(outcome.value.dispatcher.surface.entryOf('bash')?.verified).not.toBe(true)
  })
})

describe('the identity law the feed records with', () => {
  it('ID1 definitionIdentityOf is stable per object, distinct per Body, null for non-objects', () => {
    const def = { name: 'x', execute: () => 1 }
    expect(definitionIdentityOf(def)).toBe(definitionIdentityOf(def))
    expect(definitionIdentityOf({ name: 'x', execute: def.execute })).toBe(definitionIdentityOf(def)) // same Body function ⇒ same identity
    expect(definitionIdentityOf({ name: 'x', execute: () => 1 })).not.toBe(definitionIdentityOf(def)) // a re-registration is a new Body
    expect(definitionIdentityOf(null)).toBe(null)
    expect(definitionIdentityOf('def#1')).toBe(null)
  })
})
