/**
 * a5m2-provider-identity-c1.test.ts — the A5M2 PROVIDER-IDENTITY SUPPLY fixed
 * point (FP-A..FP-E of
 * `dev/agent-workflow/evidence/a5m2-contract-candidate/provider-identity-candidate-2026-10-23.md`).
 *
 * THE PROPERTY UNDER TEST is a SUPPLY property, not a comparison property: the
 * three consumption moments that used to carry their own `'a5p5-plane'` constant
 * (the placement-moment arm, the post-publish family registration, the plane's
 * per-call callFacts) must all answer from ONE live binding authority — the
 * Guard's own dispatcher surface, i.e. the SAME getter
 * `pa-mount-registry.readCallAuthorityFacts` composes `facts.binding` from — and
 * every existing comparison must stay byte-unchanged and keep DENYING whenever
 * the identities differ.
 *
 * WHAT IS REAL HERE (nothing below is a hand-spelled provider value):
 *  - the authority is a REAL `installScopedToolGuard` install: `bindOwnTools`
 *    builds the ToolBinding through the production law
 *    (`tool-dispatch/install.ts` :1155, measured on this base: `providerId: origin === 'team-mcp' ? 'mcp'
 *    : 'dsh-agent-team'`) and binds it VERIFIED+ACTIVE on the real dispatcher
 *    surface; this spec never writes a providerId into a binding;
 *  - the reader is the mount assembly's own site-4 law, over that live surface
 *    (verified === true, binding.status === 'ACTIVE', non-empty providerId, else
 *    undefined — the same fail-closed law the todo/write `bindingFacts` readers
 *    use);
 *  - the arm is the production `createGovernedReadImageArm` (reader world), the
 *    plane is the production `createTeamToolPlaneAssembly` with the B-IMAGE lane
 *    (its paAdmit, placement feed, callFacts assembly and mount law are the real
 *    ones), the family table and the call-level facts read are the production
 *    `pa-mount-registry` (`registerA5GovernedFamily`, `publishPaMount`,
 *    `readPaCallFactsForCall`), and the approval lane is the production
 *    admission kernel minting a REAL grant in the all-allow world.
 *
 * DISCLOSED STAND-INS (the identity chain never passes through any of them):
 *  - the FS-PROC read port and the attachment store are the same in-memory
 *    contract doubles the arm-family specs use (`a5m2-readimg-arm-c2c3`), so
 *    this spec creates NO world, writes NO file and runs NO Host — per the root
 *    capacity ruling of 18:51 (no worlds, no Host, nothing deleted);
 *  - the mount record's NON-identity readers (permission-plane tuple, provider
 *    version, overlay snapshot, ceiling pair) stand in exactly as
 *    `a5-m1-pa-mount-registry.test.ts` does; they carry blueprint/ceiling facts,
 *    never a provider identity.
 *  - the plane→arm callFacts are recorded by a test-owned SPY that wraps the
 *    production arm face at the mount boundary and delegates every call to the
 *    real arm untouched (the mount assembly owns that factory, so the spy sits
 *    where the mount itself sits; it decides nothing and mutates nothing).
 *
 * WHAT THIS SPEC CANNOT PROVE (stated plainly, root 19:15): the registration
 * site lives inside `createAgentBindings`, which has never been driven by any
 * in-repo spec because it needs a live Host agent ctx — so FP-B's
 * registration-moment refusal is pinned at source level plus runtime on the
 * SAME reader law, and the behavior of that one line on a real Host mount
 * remains a root-side Host verification point, not a claim of this spec.
 *
 * NOT C2 — no Host, no ports, no tests/homes, no network, no writes.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-provider-identity-c1
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { installScopedToolGuard, definitionIdentityOf, type ScopedGuardAgentCtx } from '../tool-dispatch/index.js'
import {
  createGovernedReadImageArm,
  A5_IMAGE_ADAPTER_REVISION,
  A5_IMAGE_FAMILY_ID,
  A5_IMAGE_TOOL_NAME,
} from '../src/plugin/live/governed-families/image.mjs'
import { createImageAttachmentAdapter } from '../src/plugin/live/governed-families/image-attachment.mjs'
import type { ImageAttachmentStorePort } from '../src/plugin/live/governed-families/image-attachment.d.mts'
import type { GovernedReadImageArmHandle, ImageCallFacts, ImageConsumptionReceipt, ImageReadBoundedPort } from '../src/plugin/live/governed-families/image.d.mts'

/** The REAL modules under test, loaded through the established typed-view
 *  pattern (a5int-r3-mount-integration.test.ts:157): a variable-specifier
 *  dynamic import with a declared local type — the runtime code is the
 *  production `.mjs`, nothing here is stubbed. */
const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => PlaneBuilt
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  publishPaMount: (rootSessionId: string, instanceId: string, mount: Record<string, unknown>) => unknown
  revokePaMount: (rootSessionId: string, instanceId: string, identity: unknown) => boolean
  readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<{ kind: string; facts: Record<string, unknown> } | undefined>
  registerA5GovernedFamily: (key: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string, adapterRevision: number, providerIdentity: string } | undefined
}

interface Definition {
  name: string
  description: string
  parameters: unknown
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
interface PlaneValue {
  definitions: Definition[]
  ownNames: readonly string[]
  realmId: string
  assembly: { policyDocument: () => unknown, denySources: () => unknown }
  livePaPlan: Map<string, unknown>
  authorityGeneration: () => number
  placementFeed: (name: string) => Record<string, unknown> | undefined
  mount: (agentCtx: unknown) => { ok: boolean, code?: string, message?: string, dispose?: () => void }
}
type PlaneBuilt = { ok: true, value: PlaneValue } | { ok: false, code?: string, message?: string }

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src', 'plugin', 'live')
const readSrc = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')

const TEAM = 'a5m2-pid-team'
const INSTANCE = 'a5m2-pid-member'
const TPL = 'a5m2-pid-tpl'
const GOV_ROOT = '/a5m2-pid-governed-root'
const TARGET = join(GOV_ROOT, 'good.png')
/** The value the PRODUCTION install law writes for a team-owned tool
 *  (`install.ts` :1155, measured). It appears here ONLY as the right-hand side of an
 *  assertion against what the REAL guard produced — this spec never feeds a
 *  provider identity into a binding, an arm, a family entry or a receipt. */
const INSTALL_PROVIDER = 'dsh-agent-team'

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const sha = (bytes: Uint8Array): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

// ── the minimal agent ctx the real Guard install needs (a5p1-guard-install's
//    surface, reduced to the four public seams this lane touches) ───────────
function makeCtx(initial: string[] = []) {
  const surface = [...initial]
  const defs = new Map<string, Definition>()
  const registered: string[] = []
  const raw = {
    tools: {
      guard: (_guard: unknown) => () => {},
      schemas: (scope?: unknown) => {
        void scope
        return surface.map((name) => ({ name }))
      },
      get: (name: string) => defs.get(name),
      register: (def: Definition) => {
        registered.push(def.name)
        if (!surface.includes(def.name)) surface.push(def.name)
        defs.set(def.name, def)
        return () => {}
      },
    },
    on: () => () => {},
  }
  return { ctx: raw as unknown as ScopedGuardAgentCtx, raw, surface, registered }
}

/** The mount assembly's SITE-4 law, mirrored verbatim (agent-bindings.mjs: the
 *  ONE reader, over `a5p1Guard.dispatcher.surface.entryOf(name)` — the same
 *  getter `pa-mount-registry` composes `facts.binding` from). It resolves from
 *  the LIVE surface on every read and holds no state. */
function liveProviderReaderFor(guardHandle: () => { dispatcher: { surface: { entryOf: (name: string) => unknown } } } | undefined, name: string) {
  return (): string | undefined => {
    const entry = guardHandle()?.dispatcher?.surface?.entryOf?.(name) as
      | { verified?: boolean, binding?: { status?: string, providerId?: unknown } }
      | undefined
    const binding = entry?.binding
    if (entry?.verified !== true || binding?.status !== 'ACTIVE' || typeof binding?.providerId !== 'string' || binding.providerId.length === 0) {
      return undefined
    }
    return binding.providerId
  }
}

interface WorldOpts {
  /** 'reader' = the production mount shape (site 1 as shipped);
   *  'constant' = the PRE-FIX shape (`providerId: 'a5p5-plane'`), used only to
   *  prove the unchanged comparison still DENIES (the RED control). */
  armSource?: 'reader' | 'constant'
  /** bind === false leaves the name unbound: the live authority answers nothing. */
  bind?: boolean
  /** Wrap the production arm face in the recording spy (default: on). */
  spy?: boolean
}

interface World {
  plane: PlaneValue
  arm: GovernedReadImageArmHandle
  guardLive: () => { dispatcher: { surface: { entryOf: (name: string) => unknown } } } | undefined
  liveProvider: () => string | undefined
  entry: () => { verified?: boolean, revision?: number, binding?: Record<string, unknown> } | undefined
  bindOwn: () => boolean
  publish: () => boolean
  revise: (change: { verified?: boolean }) => boolean
  seenFacts: ImageCallFacts[]
  makeArmWithSource: (source: 'reader' | 'constant') => GovernedReadImageArmHandle
  armRefused: (arm: GovernedReadImageArmHandle, facts: ImageCallFacts) => Promise<{ code: string, text: string }>
  familyKey: string
  portCalls: () => number
  armStats: () => GovernedReadImageArmHandle['stats'] extends () => infer S ? S : never
  execute: (n?: number) => Promise<unknown>
  refusal: (n?: number) => Promise<{ code: string, message: string }>
  factsThroughRegistry: () => Promise<{ kind: string; facts: Record<string, unknown> } | undefined>
  mountIdentity: unknown
  dispose: () => void
}

async function buildWorld(opts: WorldOpts = {}): Promise<World> {
  const { ctx, raw, registered } = makeCtx()
  let guardHandle: World['guardLive'] = () => undefined
  const liveProvider = liveProviderReaderFor(() => guardHandle(), A5_IMAGE_TOOL_NAME)
  let portCalls = 0
  const seenFacts: ImageCallFacts[] = []
  const realmId = `a5m2-pid-${Math.random().toString(36).slice(2, 10)}`

  // the in-memory FS-PROC port double (disclosed; a5m2-readimg-arm-c2c3 shape):
  // the identity chain is over BEFORE any port call, so this stand-in cannot
  // carry a provider identity even in principle.
  const readBounded = (async (grantRef: { canonicalLocator?: string }, caps: { maxBytes: number }) => {
    portCalls += 1
    if (String(grantRef?.canonicalLocator ?? '') !== TARGET) {
      return { ok: false, code: 'outside-governed-root', detail: 'the double serves only the governed target' }
    }
    if (PNG_1X1.byteLength > caps.maxBytes) return { ok: false, code: 'too-large', detail: 'cap exceeded' }
    return { ok: true, value: { bytes: PNG_1X1, observedKind: 'file' as const, byteLength: PNG_1X1.byteLength } }
  }) as unknown as ImageReadBoundedPort

  const saves: Array<{ mediaType: string; name: string; byteLength: number }> = []
  const objects = new Map<string, Uint8Array>()
  const store = {
    imageLimits: Object.freeze({
      mediaTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
      maxImagesPerMessage: 8,
      maxImageBytes: 1 << 20,
      maxMessageImageBytes: 1 << 20,
    }),
    saveImage: async ({ data, mediaType, name }: { data: Uint8Array, mediaType: string, name?: string }) => {
      const id = sha(data)
      saves.push({ mediaType, name: String(name ?? ''), byteLength: data.byteLength })
      objects.set(id, data)
      return { attachmentId: id, mediaType, bytes: data.byteLength, width: 1, height: 1, name }
    },
    readImage: async (ref: { attachmentId?: string }) => ({
      ref,
      data: objects.get(String(ref?.attachmentId ?? '')) ?? new Uint8Array(),
    }),
  } as unknown as ImageAttachmentStorePort
  const adapter = createImageAttachmentAdapter({ store, scope: { realmId, teamSessionId: TEAM, instanceId: INSTANCE } } as never)

  let builtArm: GovernedReadImageArmHandle | undefined
  let placedIdentity = ''
  /** Build another arm through the SAME production factory with a chosen
   *  provider source — used by the RED control (FP-A2) to put the PRE-FIX
   *  constant arm against the callFacts a real call produced. */
  const makeArmWithSource = (source: 'reader' | 'constant'): GovernedReadImageArmHandle => {
    if (placedIdentity.length === 0) throw new Error('no placement identity yet')
    return createGovernedReadImageArm({
      definitionIdentity: placedIdentity,
      ...(source === 'constant' ? { providerId: 'a5p5-plane' } : { provider: liveProvider }),
      realmId,
      namespaceRoot: GOV_ROOT,
      readBounded,
      attachments: adapter,
      imageCapability: async () => ({ ok: true }),
      observe: () => {},
    })
  }
  const nativeDef: Definition = {
    name: A5_IMAGE_TOOL_NAME,
    description: 'TEST native read_image description — the bytes the row must carry.',
    parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] },
    execute: async () => {
      throw new Error('the native body must never run: the governed arm is the only executor')
    },
  }

  // The REAL mount record shape (agent-bindings.mjs :3759-3796): the whole real
  // plane face rides as `plane`, the real guard handle as `guard`; only the
  // non-identity readers stand in (as a5-m1-pa-mount-registry.test.ts does).
  const TUPLE = Object.freeze({ blueprintId: 'bp-pid', revision: '9', contentHash: 'sha256:bp-pid', templateId: TPL, cwd: GOV_ROOT, providerVersion: 'pv-pid' })
  const mountRecord: Record<string, unknown> = {
    instanceId: INSTANCE,
    get guard() {
      return guardHandle()
    },
    plane: undefined as unknown,
    beneficiaryAuthority: 'member',
    readers: {
      permissionPlane: () => ({ currentCallFacts: () => ({ tuple: TUPLE, blueprintId: 'bp-pid', providerVersion: 'pv-pid', healthy: true }) }),
      overlayGeneration: async () => 0,
      authorityGeneration: async () => 0,
      policySnapshot: () => policy,
      overlaySnapshot: async () => ({ metadata: { generation: 0 } }),
      teamHardEnvelope: async () => ({ status: 'absent' }),
      permissionEnvelope: async () => ({ rules: [], scope: 'x' }),
    },
  }

  const policy = Object.freeze({
    default: 'ask',
    allow: Object.freeze([
      Object.freeze({ tool: A5_IMAGE_TOOL_NAME, resource: Object.freeze({ kind: 'any' }) }),
      Object.freeze({ tool: A5_IMAGE_TOOL_NAME, resource: Object.freeze({ kind: 'exact', path: TARGET }) }),
    ]),
    ask: Object.freeze([]),
    deny: Object.freeze([]),
  })

  const built = PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: TEAM,
    permissionPolicy: policy,
    realmId,
    templateId: TPL,
    role: 'member',
    instanceId: INSTANCE,
    plane: { imageEnabled: true },
    backends: {
      image: {
        createArm: (placedDef: unknown) => {
          const identity = definitionIdentityOf(placedDef)
          if (typeof identity !== 'string' || identity.length === 0) {
            throw new TypeError('no arm without the WeakMap placement identity (never a hand-spelled string)')
          }
          placedIdentity = identity
          const arm = createGovernedReadImageArm({
            definitionIdentity: identity,
            ...(opts.armSource === 'constant' ? { providerId: 'a5p5-plane' } : { provider: liveProvider }),
            realmId,
            namespaceRoot: GOV_ROOT,
            readBounded,
            attachments: adapter,
            imageCapability: async () => ({ ok: true }),
            observe: () => {},
          })
          if (opts.spy === false) return arm
          // the mount-boundary recording spy: records the trusted callFacts the
          // PRODUCTION plane assembled, then delegates untouched to the real arm
          // (Object.create keeps the real face, including its live getters).
          const spy = Object.create(arm) as GovernedReadImageArmHandle
          spy.execute = (args: unknown, receipt: ImageConsumptionReceipt | undefined, facts: ImageCallFacts, signal?: AbortSignal) => {
            seenFacts.push(facts)
            return arm.execute(args, receipt, facts, signal)
          }
          builtArm = spy
          return spy
        },
        description: nativeDef.description,
        parameters: nativeDef.parameters,
      },
    },
    authorityFacts: { overlayGeneration: async () => 0, ensureAuthorityCurrent: async () => {} },
    // SITE-4-adjacent: the plane's call facts come through the PRODUCTION
    // registry entry, exactly as agent-bindings wires it
    // (`readCallFacts: readPaCallFactsForCall` with the published mount).
    readCallFacts: async (input: Record<string, unknown>) =>
      await REGISTRY.readPaCallFactsForCall({ ...input, mount: mountRecord }),
    onObserve: () => {},
  })
  if (built.ok !== true) throw new Error(`the plane assembly refused (${String(built.code)}): ${String(built.message)}`)
  const plane = built.value
  ;(mountRecord as { plane: unknown }).plane = plane

  // THE REAL AUTHORITY: the production Guard install over the public seams.
  const installed = installScopedToolGuard({
    agentCtx: ctx,
    runtimeAgent: { id: INSTANCE, session: { header: { id: 'sess-a5m2-pid' } } } as never,
    agentScopeKey: `scope-${realmId}`,
    trustedIdentities: [INSTANCE, 'sess-a5m2-pid'],
    nativeNames: [],
  })
  if (!installed.ok) throw new Error(`the Guard install refused: ${String(installed.error?.message ?? 'unknown')}`)
  const handle = installed.value
  guardHandle = () => handle as never

  const mounted = plane.mount({ tools: { register: (def: Definition) => raw.tools.register(def) } })
  if (mounted.ok !== true) throw new Error(`the plane mount refused (${String(mounted.code)}): ${String(mounted.message)}`)
  expect(registered).toContain(A5_IMAGE_TOOL_NAME)

  const imageDef = plane.definitions.find((d) => d.name === A5_IMAGE_TOOL_NAME) as Definition
  const feed = plane.placementFeed(A5_IMAGE_TOOL_NAME) as { definitionIdentity?: string }
  const familyKey = String(feed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed read_image row answered no placement definition identity')
  if (builtArm === undefined) throw new Error('the placement-moment factory never built the arm')
  const arm = builtArm

  const bindOwn = (): boolean => handle.bindOwnTools([A5_IMAGE_TOOL_NAME]).ok === true
  const publish = (): boolean => handle.publish().ok === true
  const revise = (change: { verified?: boolean }): boolean => handle.dispatcher.revise(A5_IMAGE_TOOL_NAME, change).ok === true
  const entry = () => handle.dispatcher.surface.entryOf(A5_IMAGE_TOOL_NAME) as ReturnType<World['entry']>
  if (opts.bind !== false) {
    if (!bindOwn()) throw new Error('the real Guard refused to bind its own placed read_image row')
    publish()
    // SITE 2 mirrored: the family registers under the LIVE authority read AT
    // THIS MOMENT (post bindOwnTools + publish), never off the arm.
    const providerIdentity = liveProvider()
    if (typeof providerIdentity !== 'string') throw new Error('the live authority answered nothing at the registration moment')
    REGISTRY.registerA5GovernedFamily(familyKey, {
      familyId: arm.familyId,
      adapterRevision: arm.adapterRevision,
      providerIdentity,
    })
  }
  const mountIdentity = REGISTRY.publishPaMount(TEAM, INSTANCE, mountRecord)

  const execFor = (callId: string): Record<string, unknown> => ({
    agent: {
      id: INSTANCE,
      session: { header: { id: 'sess-a5m2-pid' }, append: () => {} },
    },
    token: Symbol(callId),
  })

  return {
    plane,
    arm,
    guardLive: () => guardHandle(),
    liveProvider,
    entry,
    bindOwn,
    publish,
    revise,
    seenFacts,
    makeArmWithSource,
    armRefused: async (armHandle, facts) => {
      const outcome = await armHandle.execute({ file_path: 'good.png' }, undefined, facts) as unknown as Record<string, unknown>
      const text = JSON.stringify(outcome)
      if (outcome.ok === false) return { code: String(outcome.code ?? ''), text }
      throw new Error(`expected a refusal, got: ${text.slice(0, 300)}`)
    },
    familyKey,
    portCalls: () => portCalls,
    armStats: () => arm.stats(),
    execute: (n = 1) => imageDef.execute({ file_path: 'good.png' }, execFor(`a5m2-pid-call-${String(n)}`)),
    refusal: async (n = 1) => {
      try {
        await imageDef.execute({ file_path: 'good.png' }, execFor(`a5m2-pid-refuse-${String(n)}`))
      } catch (error) {
        const e = error as { code?: string, message?: string }
        const message = String(e.message ?? '')
        // the plane's typed refusals ride the thrown MESSAGE (`refused-image
        // <CODE> — …`), the arm's ride `.code`; both are read here.
        const code = String(e.code ?? '') || (message.match(/refused-image ([A-Z_]+)/)?.[1] ?? '')
        return { code, message }
      }
      throw new Error('expected a refusal, got a resolve')
    },
    factsThroughRegistry: () => REGISTRY.readPaCallFactsForCall({
      mount: mountRecord,
      rootSessionId: TEAM,
      instanceId: INSTANCE,
      realmId,
      callId: 'a5m2-pid-registry-call',
      placementName: A5_IMAGE_TOOL_NAME,
      requestedEffects: { effects: [{ kind: 'fs-read', resource: TARGET }], fingerprint: 'sha256:pid-effects' },
    }),
    mountIdentity,
    dispose: () => {
      REGISTRY.revokePaMount(TEAM, INSTANCE, mountIdentity)
      mounted.dispose?.()
    },
  }
}

describe('A5M2 PROVIDER-IDENTITY SUPPLY — one live authority feeds arm / family / callFacts, every comparison still denies (FP-A..FP-E)', () => {
  it('FP-A (positive, real authority): row-side facts read, callFacts, arm answer and the live Binding are ONE byte-equal identity, and the call consumes', async () => {
    const w = await buildWorld()
    try {
      // (1) the REAL install value, read off the REAL surface (never supplied
      //     by this spec): verified + ACTIVE + providerId.
      const live = w.entry()
      expect(live?.verified, 'the placed own tool binds VERIFIED').toBe(true)
      expect(live?.binding?.status).toBe('ACTIVE')
      expect(live?.binding?.providerId).toBe(INSTALL_PROVIDER)
      // (2) the reader resolves exactly the live entry object's value.
      expect(w.liveProvider(), 'the mount reader answers the live Binding').toBe(INSTALL_PROVIDER)
      // (3) the ARM (built before bind, site 1) answers the same live value NOW.
      expect(w.arm.providerId, 'the arm face answers live').toBe(INSTALL_PROVIDER)
      expect(w.arm.resolveProviderId()).toBe(INSTALL_PROVIDER)
      // (4) the FAMILY TABLE entry (site 2 law, read at the registration moment).
      const family = REGISTRY.a5GovernedFamilyFor(w.familyKey)
      expect(family).toEqual({ familyId: A5_IMAGE_FAMILY_ID, adapterRevision: A5_IMAGE_ADAPTER_REVISION, providerIdentity: INSTALL_PROVIDER })
      // (5) the ROW-SIDE authority: the production registry read composes
      //     facts.binding from that same live carrier — this is the value the
      //     durable row carries verbatim (pa-control-bridge :483).
      const read = await w.factsThroughRegistry()
      expect(read, 'the production call-level facts read must answer for the real mount').toBeDefined()
      const rowSide = (read?.facts?.binding as { providerId?: string } | undefined)?.providerId
      expect(rowSide, 'facts.binding.providerId comes from the live carrier').toBe(INSTALL_PROVIDER)
      // (6) the REAL call through the REAL plane: the all-allow lane mints a
      //     real grant, and the arm consumes.
      const value = (await w.execute()) as { image?: { attachmentId?: string } }
      expect(value?.image?.attachmentId, 'the read committed the real bytes').toBe(sha(PNG_1X1))
      expect(w.seenFacts.length, 'the plane assembled exactly one callFacts').toBe(1)
      expect(w.seenFacts[0]?.providerIdentity, 'callFacts.providerIdentity (site 3)').toBe(INSTALL_PROVIDER)
      // (7) THE FOUR-WAY BYTE EQUALITY — the fixed point r18 violated.
      expect(String(w.seenFacts[0]?.providerIdentity)).toBe(String(rowSide))
      expect(String(w.arm.providerId)).toBe(String(w.seenFacts[0]?.providerIdentity))
      expect(String(live?.binding?.providerId)).toBe(String(REGISTRY.a5GovernedFamilyFor(w.familyKey)?.providerIdentity))
      expect(w.armStats()).toMatchObject({ consumed: 1, portCalls: 1, commits: 1, consumptionRefused: 0 })
    } finally {
      w.dispose()
    }
  })

  it('FP-A2 (RED control, the r18 shape): put against the callFacts a REAL call produced, the PRE-FIX constant arm is denied by the UNCHANGED comparison', async () => {
    const w = await buildWorld()
    try {
      // first: the shipped shape consumes on the real authority (so the two
      // arms below differ ONLY in how their provider identity is supplied)...
      const value = (await w.execute()) as { image?: { attachmentId?: string } }
      expect(value.image?.attachmentId).toBe(sha(PNG_1X1))
      const facts = w.seenFacts[0] as ImageCallFacts
      expect(facts.providerIdentity).toBe(INSTALL_PROVIDER)
      // ...then the r18 arm (a provider CONSTANT, exactly what sites 1/3 used
      // to carry) against the SAME trusted call facts: the tie still denies,
      // naming the live value against the constant. No relaxation, no alias.
      const preFixArm = w.makeArmWithSource('constant')
      expect(preFixArm.providerId).toBe('a5p5-plane')
      const refused = await w.armRefused(preFixArm, facts)
      expect(refused.code).toBe('P_IMAGE_CONSUMPTION_BINDING_MISMATCH')
      expect(refused.text).toContain(`provider (call ${INSTALL_PROVIDER} vs arm a5p5-plane)`)
      expect(preFixArm.stats().portCalls, 'the denied identity reached no backend').toBe(0)
      expect(preFixArm.stats().commits).toBe(0)
    } finally {
      w.dispose()
    }
  })

  it('FP-B (absent authority refuses, never falls back): no live Binding = no identity anywhere on the call, and nothing is consumable', async () => {
    const w = await buildWorld({ bind: false })
    try {
      expect(w.liveProvider(), 'an unbound name answers nothing').toBeUndefined()
      expect(w.arm.providerId).toBeUndefined()
      expect(w.arm.resolveProviderId()).toBeUndefined()
      // the row side reads nothing either (the same live carrier is the ONE
      // source): with no verified+ACTIVE carrier the production facts read
      // answers undefined, so no row identity exists to consume or to borrow.
      expect(await w.factsThroughRegistry(), 'no carrier, no call facts').toBeUndefined()
      // nothing registered under a guessed identity (the mount law registers
      // NOTHING without an authority — site 2).
      expect(REGISTRY.a5GovernedFamilyFor(w.familyKey)).toBeUndefined()
      // and the call dies fail-closed with zero backend effect. In an unbound
      // world the plane's own PA leg answers FIRST (it cannot resolve its call
      // facts either); the arm-side guard is FP-C's leg. Either way: no read,
      // no write, no consumption.
      const refusal = await w.refusal()
      expect(refusal.code, 'the plane\'s own PA entry answers first, typed').toBe('TOOL_BINDING_UNVERIFIED')
      expect(refusal.message, 'and it names the identity gap, not a provider value').toContain('identity-gap=no-answer-object')
      expect(w.portCalls(), 'zero port reads').toBe(0)
      expect(w.armStats()).toMatchObject({ consumed: 0, commits: 0, portCalls: 0 })
    } finally {
      w.dispose()
    }
  })

  it('FP-C (arm-before-bind timing): the same arm instance stores nothing — it answers after bind, goes silent when the authority withdraws, answers again when it returns', async () => {
    const w = await buildWorld({ bind: false })
    try {
      // the arm was constructed at the PLACEMENT moment, before any bind: there
      // is no construction-time value it could be stale with.
      expect(w.arm.providerId, 'nothing existed at construction').toBeUndefined()
      expect(w.portCalls()).toBe(0)
      // the authority appears (the real bindOwnTools law) → the SAME instance
      // answers the live value and a real call consumes through it.
      expect(w.bindOwn()).toBe(true)
      w.publish()
      expect(w.arm.providerId, 'the same instance answers live').toBe(INSTALL_PROVIDER)
      REGISTRY.registerA5GovernedFamily(w.familyKey, {
        familyId: w.arm.familyId,
        adapterRevision: w.arm.adapterRevision,
        providerIdentity: w.liveProvider() as string,
      })
      const first = (await w.execute()) as { image?: { attachmentId?: string } }
      expect(first.image?.attachmentId).toBe(sha(PNG_1X1))
      expect(w.seenFacts[0]?.providerIdentity).toBe(INSTALL_PROVIDER)
      // the authority WITHDRAWS (the real dispatcher `revise` law, verified
      // =false): the SAME instance answers nothing — the identity it already
      // served is not kept, and an authority-less consumption on production
      // call facts dies on the arm's own guard, with the claim SCOPED to this
      // arm (zero port reads / zero attachment writes; the PA edge upstream is
      // not claimed untouched — root narrow review on bd48).
      expect(w.revise({ verified: false })).toBe(true)
      expect(w.arm.providerId, 'a withdrawn authority is no authority').toBeUndefined()
      const refused = await w.armRefused(w.arm, w.seenFacts[0] as ImageCallFacts)
      expect(refused.code).toBe('P_IMAGE_CONSUMPTION_BINDING_MISMATCH')
      expect(refused.text).toContain('resolves no providerId from the live binding authority')
      expect(refused.text).toContain('zero port reads and writes zero attachments')
      expect(refused.text).toContain('not undone here')
      expect(w.portCalls(), 'the withdrawn consumption performed no second read').toBe(1)
      // and back: a re-validated authority answers through the SAME instance.
      expect(w.revise({ verified: true })).toBe(true)
      expect(w.arm.providerId).toBe(INSTALL_PROVIDER)
    } finally {
      w.dispose()
    }
  })

  it('FP-D (a row is never a supply): the live carrier moves, the arm follows the LIVE value, and the stale identity is denied — structurally no row channel exists in the reader', async () => {
    const w = await buildWorld()
    try {
      // a real call first: its production call facts recorded the live identity.
      const value = (await w.execute()) as { image?: { attachmentId?: string } }
      expect(value.image?.attachmentId).toBe(sha(PNG_1X1))
      const servedFacts = w.seenFacts[0] as ImageCallFacts
      expect(servedFacts.providerIdentity).toBe(INSTALL_PROVIDER)
      const rowSide = (await w.factsThroughRegistry())?.facts?.binding as { providerId?: string } | undefined
      expect(rowSide?.providerId).toBe(INSTALL_PROVIDER)
      // the LIVE carrier drifts to another provider identity (a real binding
      // change on the real surface — the only way row-side and live can diverge).
      const handle = w.guardLive() as unknown as {
        dispatcher: { bind: (input: unknown) => { ok: boolean } }
      }
      const entry = w.entry() as { binding: Record<string, unknown> }
      const drifted = { ...entry.binding, providerId: 'a5m2-pid-drifted-provider', revision: Number(entry.binding.revision ?? 1) + 1 }
      expect(handle.dispatcher.bind({ name: A5_IMAGE_TOOL_NAME, origin: 'team-own', binding: drifted, verified: true }).ok).toBe(true)
      // the arm follows the LIVE authority, never the identity it served before
      // and never the row's recorded one:
      expect(w.arm.providerId).toBe('a5m2-pid-drifted-provider')
      // and the call that still carries the row-side identity is DENIED by the
      // unchanged comparison: a row value authorizes nothing, in either
      // direction (the arm does not adopt it, the row does not vouch for it).
      const staleRowFacts = { ...servedFacts, providerIdentity: String(rowSide?.providerId) } as ImageCallFacts
      const refused = await w.armRefused(w.arm, staleRowFacts)
      expect(refused.code).toBe('P_IMAGE_CONSUMPTION_BINDING_MISMATCH')
      expect(refused.text).toContain('provider')
      expect(refused.text).toContain(INSTALL_PROVIDER)
      expect(refused.text).toContain('a5m2-pid-drifted-provider')
      expect(w.armStats(), 'the stale identity consumed nothing more').toMatchObject({ consumed: 1, portCalls: 1, commits: 1 })
      // STRUCTURAL half: the site-4 reader has NO durable-row / receipt / plane
      // channel — its only input is the dispatcher surface.
      const mount = readSrc('agent-bindings.mjs')
      const readerBlock = mount.slice(mount.indexOf('const a5LiveBindingProviderId'), mount.indexOf('a5ImageProviderIdentity = () =>'))
      expect(readerBlock.length, 'the site-4 reader block was found').toBeGreaterThan(0)
      expect(readerBlock).toContain('dispatcher?.surface?.entryOf')
      for (const forbidden of ['row', 'manifest', 'receipt', 'plane', 'control', 'paMount', 'placementFeed']) {
        expect(readerBlock, `the reader must not read '${forbidden}'`).not.toContain(forbidden)
      }
    } finally {
      w.dispose()
    }
  })

  it('FP-E (the pinned bytes): the two comparisons are byte-unchanged, no site keeps a provider constant, and the feed carries no provider field', () => {
    const image = readSrc('governed-families/image.mjs')
    // the three-way provider tie (candidate: image.mjs :359-360) — byte-exact.
    expect(image).toContain('    if (manifest?.binding?.providerId !== callFacts?.providerIdentity || callFacts?.providerIdentity !== providerId) {')
    expect(image).toContain('      return `provider (row ${String(manifest?.binding?.providerId)} vs call ${String(callFacts?.providerIdentity)} vs arm ${providerId})`')
    // the family-carrier check (candidate: image.mjs :507) — byte-exact.
    expect(image).toContain('    if (manifest.providerIdentity !== providerId) return refuseExecution(CODES.FAMILY_FACTS_MISMATCH, `the row carries providerIdentity ${JSON.stringify(manifest.providerIdentity ?? null)}; this mount is ${JSON.stringify(providerId)}`)')

    const mount = readSrc('agent-bindings.mjs')
    const planeSrc = readSrc('team-tool-plane.mjs')
    // SITE 1 + SITE 3 carry NO provider constant any more...
    expect(mount).toContain('provider: a5ImageProviderIdentity,')
    expect(planeSrc).toContain('providerIdentity: typeof arm.resolveProviderId === \'function\' ? arm.resolveProviderId() : arm.providerId,')
    expect(planeSrc).not.toContain('providerIdentity: \'a5p5-plane\'')
    // ...and the fix did NOT copy the write pattern: the placement constants
    // are still there, byte-unchanged, because they carry no provider
    // comparison (root: do not copy the write pattern). CENTER LANDING
    // RE-ANCHOR (int 596825662 + b156a9edb): the lane base (1f0bc21f4) held
    // exactly 2 (todo :2755 + write :2850); the B-SCHEDULE production block
    // that landed on int BEFORE this chain legitimately adds THREE more of
    // its OWN family placement constants (scheduleProductionPort :3105,
    // schedule assembly built :3144/:3167) — measured on the merged source,
    // all five belong to todo/write/schedule placements. RE-ANCHOR 2
    // (B-SUBAGENT joint batch, int merge cc6a0f643d1b0b4cae4ef4604c2c8fde1bb66b0f):
    // the joint adds EXACTLY TWO more legitimate family-mount constants, both
    // in agent-bindings.mjs and enumerated HERE so the pin records WHICH sites
    // and WHY — (1) the B-SUBAGENT SPAWN wiring/registration constant passed to
    // createSubagentSpawnWiring (the spawn-family one-bound container, :3254)
    // and (2) the B-SUBAGENT CONTROLS wiring/registration constant passed to
    // createBSubagentControlWiring (the controls-family wiring, :3783).
    // Measured then, all seven belonged to todo/write/schedule/subagent-spawn/
    // subagent-controls placements. RE-ANCHOR 3 (A5M2 census run 40063499790
    // head 447e14ac2, re-measured by the CENTER integrator on the MERGED tree
    // after the d675 bind-after-def lane f24ff4d60): TWO additions and ONE
    // retirement move this pin, net 7 + 2 - 3 = SIX. ADDITIONS: (1) the
    // providerId passed to createG2TeamMount on the G2 team mount
    // (agent-bindings.mjs:3689, the e78 G2 line) and (2) a5G5GoalInject.
    // providerId, the identity the B-GOALS durable family registration carries
    // on that route (agent-bindings.mjs:4078; its own comment: 'the same bytes
    // every sibling arm registers with'). RETIREMENT: the d675 lane removed the
    // OLD B-SCHEDULE early-capture block - all THREE of the constants RE-ANCHOR
    // 1 counted there are GONE (retired-symbol grep=0 on the merged tree); the
    // bind-after-def successor wires the family WITHOUT a literal provider
    // constant at the mount face. The SIX surviving literals on the merged
    // source are exactly: todo arm :3048, write arm :3143, subagent-spawn
    // wiring :3443, G2 team mount :3689, G5 goal inject :4078, subagent-
    // controls wiring :4333 - all family registration/wiring constants.
    // No IMAGE arm/registration/callFacts site carries a constant: the FP-A2/
    // FP-D legs above prove the live supply and the unchanged comparisons on
    // the real objects, and the plane pin below stays.
    expect(
      matchAll(mount, /providerId: 'a5p5-plane',/g),
      "todo + write + subagent-spawn wiring + subagent-controls + the G2 team mount + the G5 goal inject family constants, measured SIX on the merged tree after the bind-after-def retirement of the three old B-SCHEDULE literals (RE-ANCHOR 3 above; every site enumerated with its line)",
    ).toHaveLength(6)
    expect(planeSrc).toContain('providerId: \'a5p5-plane\'') // the rev.0 row-lane tuple, untouched
    // The plane never reads the provider off a MANIFEST or RECEIPT for supply
    // purposes, and the FP-A/FP-D legs above byte-pin every COMPARISON site to
    // the live supply. RE-ANCHOR (census 40063499790 attribution, CENTER-
    // booked): the blanket row/ ban predates the G2 family wiring (bc6cf5ed6,
    // merged long before this census; surfaced here only because the FP-E
    // COUNT leg stopped the test short of this line). G2 legitimately reads
    // the row's OWN providerId ONCE, at the paAdmit.open walk family block
    // (team-tool-plane.mjs:5021-5030 family: Object.freeze({ familyId:
    // row.familyId, adapterRevision: row.adapterRevision, providerIdentity:
    // row.providerId, ... })) - the mount's own durable registration read back
    // through the placement identity, the SAME-SOURCE supply FP-D endorses,
    // never a comparison and never a second approval (the row payload rides
    // INTO the PA walk; the bridge composes the durable manifest from it and
    // answers the claim against the registration - the block comment is
    // explicit). The teeth stay sharp: manifest/receipt reads remain banned
    // outright, and the row read is pinned to EXACTLY this one byte-verified
    // site - a second row-sourced providerIdentity anywhere is RED.
    expect(planeSrc).not.toMatch(/providerIdentity:\s*(manifest|receipt)/)
    expect(planeSrc).toContain('providerIdentity: row.providerId,\n          targetManifest: classified.targetManifest,')
    expect(matchAll(planeSrc, /providerIdentity:\s*row\./g)).toHaveLength(1)
  })

  it('FP-E2 (the feed stays a feed): placement placementFeed still answers definitionIdentity + realmId and nothing else', async () => {
    const w = await buildWorld()
    try {
      const feed = w.plane.placementFeed(A5_IMAGE_TOOL_NAME) as Record<string, unknown>
      expect(Object.keys(feed).sort(), 'no invented provider field on the feed').toEqual(['definitionIdentity', 'realmId'])
      expect(feed.definitionIdentity, 'the feed carries the placement identity').toBe(w.familyKey)
    } finally {
      w.dispose()
    }
  })
})

function matchAll(text: string, re: RegExp): string[] {
  return [...text.matchAll(re)].map((m) => String(m[0]))
}
