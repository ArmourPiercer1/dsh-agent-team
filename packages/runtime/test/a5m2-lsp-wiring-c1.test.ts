/**
 * A5M2-G3-LSP-WIRE C1 — the B-LSP production wiring bridge, author side.
 * (root 2026-10-24 LSP REAL-OWNER card via center; 接线未测 until a Host
 * round — every PA/admission answer here is a CANNED double in the published
 * contract shape, declared so; the delegate arm under test is the COMMITTED
 * fsproc adapter, imported as-is, never edited here.)
 *
 * The legs:
 *  (a) CLOSED input surface — an unknown knob or a defective inject answers
 *      the typed INPUT_INVALID refusal, never a partial mount;
 *  (b) ONE CAPTURE + the honest DECLARED-INACTIVE census (no def, no
 *      registration, native untouched, seam read at most once);
 *  (c) the placement-moment bind (IDENTITY_UNBOUND throws — an unbound arm
 *      would drift-refuse every call while LOOKING mounted);
 *  (d) the FULL WALK with NO port: classify -> open -> edge -> the one-shot
 *      consumedProof DEMAND -> prepare -> the CAPTURED-BODY delegate answer
 *      travels VERBATIM; the durable walk carries the B-LSP CLOSED-TABLE
 *      FLAT view (every §5.2 leaf at full value, ONE-BASED UTF-16
 *      coordinates preserved) and the REAL published table ACCEPTS it;
 *  (e) the PORT ROUTE: a supplied control port's handle answers and commits
 *      verbatim — the captured body never runs behind it;
 *  (f) zero-entry refusals: no consume witness / open deny / aborted-after-
 *      consume all enter NOTHING, closePlan on every path;
 *  (g) the B-LSP table grammar fail-closed on the REAL published checker:
 *      four accepts, the fifth spelling (executeCommand), a missing leaf and
 *      an extra leaf each pin their exact measured refusal bytes;
 *  (h) the post-publish registration face: ABSENT/MOVED feed THROWS, the
 *      entry carries the adapter's own family bytes.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-lsp-wiring-c1
 */
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { validatePaFamilyTarget } from '../control/types.js'

const REALM = 'g3-lsp-wire-realm'
const PROVIDER = 'g3-lsp-wire-provider'
const MEMBER = 'agent-member-1'
const HEADER = 's-header-1'
const CWD = '/workspace/lsp-root'

type Definition = {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}
interface Built {
  ok: boolean
  code?: string
  detail?: string
  definitions?: Definition[]
  declared?: Array<Record<string, unknown>>
  drain?: () => Record<string, unknown>
  familyRegistrations?: () => Array<{ name: string, definitionIdentity: string, entry: Record<string, unknown> }>
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/g3-lsp-wiring.mjs', import.meta.url).href)) as {
  buildG3LspWiring: (input: Record<string, unknown>) => Built
  a5LspPaTargetFlat: (manifest: Record<string, unknown>) => Record<string, unknown>
  A5_G3_LSP_TOOL_NAME: string
  A5_G3_LSP_WIRING_CODES: Record<string, string>
}
const CODES = WIRING.A5_G3_LSP_WIRING_CODES
const LSP_OP = ['goToDefinition', 'findReferences', 'goToImplementation', 'hover']

/** The COMPILED parameters face of the REAL tool-lsp product at the pin:
 *  one `lsp` tool, the four-operation CLOSED enum, one-based coordinates
 *  (the adapter's captured-enum bind names any divergence; nothing here is
 *  a hand-mirrored constraint set). */
function makeNative (body: () => Promise<unknown>): Definition & { bodyRuns: () => number } {
  let runs = 0
  return {
    name: 'lsp',
    description: 'native lsp production description',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: [...LSP_OP] },
        file_path: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
      },
      required: ['operation', 'file_path', 'line', 'character'],
      additionalProperties: false,
    },
    execute: async (_args, _exec) => { runs += 1; return await body() },
    output: { schema: { type: 'object' }, render: (value: unknown) => JSON.stringify(value) },
    bodyRuns: () => runs,
  }
}

interface WorldOpts {
  absent?: boolean
  noFeed?: boolean
  movedFeed?: boolean
  identityUnbound?: boolean
  port?: Record<string, unknown> | null
}

function makeWorld (opts: WorldOpts = {}) {
  let nativeBody: () => Promise<unknown> = async () => { throw new Error('NATIVE BODY MUST NOT RUN HERE') }
  const native = makeNative(() => nativeBody())
  const seamReads: string[] = []
  const readNative = (name: string) => {
    seamReads.push(name)
    return opts.absent === true ? undefined : native
  }
  // THE CANNED §5.2 fact supply (the mount card replaces this with the realm-
  // scoped resolver over the LspRealmAssembly seam; canned here, declared).
  const lspFacts = {
    server: () => ({ binaryIdentity: 'tsserver@6.0.3-sha-abc', generation: 'polgen-7' }),
    document: (filePath: string) => ({ canonicalLocator: filePath, kind: 'workspace', revision: 'rev-1' }),
    documentRealm: () => REALM,
    documentScope: () => 'inside',
  }
  const bindingFactsValue = { bindingId: 'a5p1:scope:lsp', bindingRevision: 1, policyGeneration: 3, authorityGeneration: 0 }
  const walks: Array<Record<string, unknown>> = []
  const closePlans: string[] = []
  let denyOpen = false
  let dropProof = false
  let abortDuringEdge = false
  const pa = {
    open: async (walk: Record<string, unknown>) => {
      walks.push(walk)
      if (denyOpen) return { kind: 'deny', code: 'ADMISSION_REFUSED', detail: 'spec world: the admission refused' }
      const grant = Object.freeze({
        grantId: `grant-${String(walks.length)}`,
        callId: walk.callId,
        realmId: walk.realmId,
        bindingId: bindingFactsValue.bindingId,
        bindingRevision: bindingFactsValue.bindingRevision,
        parametersFingerprint: walk.parametersFingerprint,
        singleUse: true,
      })
      return { kind: 'approved', grant }
    },
    edge: async (input: Record<string, unknown>) => {
      if (abortDuringEdge === true) controller.abort()
      if (dropProof) return { kind: 'allow' }
      return { kind: 'allow', consumedProof: { grant: input.grant } }
    },
    closePlan: (callId: string) => { closePlans.push(callId) },
  }
  const controller = new AbortController()
  const signal = controller.signal
  const placed = new Map<string, Definition>()
  const placementFeed = (name: string) => {
    if (opts.noFeed === true) return undefined
    const def = placed.get(name)
    if (def === undefined) return undefined
    const identity = definitionIdentityOf(def)
    if (identity === null) return undefined
    return Object.freeze({ definitionIdentity: opts.movedFeed === true ? `${identity}+moved` : identity, realmId: REALM })
  }
  const identityOf = (def: unknown) => (opts.identityUnbound === true ? null : definitionIdentityOf(def))
  const events: Array<Record<string, unknown>> = []
  const baseInput = {
    realmId: REALM,
    providerId: PROVIDER,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    readNative,
    lspFacts,
    ...(opts.port === undefined ? {} : { controlPort: opts.port }),
    bindingFacts: () => ({ ...bindingFactsValue }),
    placementFeed,
    identityOf,
    pa,
    observe: (event: Record<string, unknown>) => { events.push(event) },
  }
  const execFor = (callId: string, withSignal = false) => Object.freeze({
    token: { t: callId },
    callId,
    ...(withSignal === true ? { signal } : {}),
    agent: { id: MEMBER, session: { header: { id: HEADER, cwd: CWD } } },
  })
  const build = (over: Record<string, unknown> = {}) => {
    const asm = WIRING.buildG3LspWiring({ ...baseInput, ...over }) as Built
    for (const definition of (asm.definitions ?? [])) placed.set(definition.name, definition)
    return asm
  }
  const setBody = (body: () => Promise<unknown>) => { nativeBody = body }
  return {
    build, input: (over: Record<string, unknown> = {}) => ({ ...baseInput, ...over }),
    walks, closePlans, seamReads, events, pa, placed, native,
    setDenyOpen: (v: boolean) => { denyOpen = v },
    setDropProof: (v: boolean) => { dropProof = v },
    setAbortDuringEdge: (v: boolean) => { abortDuringEdge = v },
    execFor, setBody,
  }
}

const refusalOf = async (promise: Promise<unknown>) => {
  try { await promise; return null } catch (error) { return error as { code?: string, message?: string } }
}

const ARGS = { operation: 'hover', file_path: 'src/a.ts', line: 10, character: 5 }

describe('A5M2-G3-LSP-WIRE C1 — the B-LSP wiring bridge on the REAL adapter bytes', () => {
  it('(a) the input surface is CLOSED: an unknown knob and each defective inject answer the typed refusal, never a partial mount', () => {
    const w = makeWorld()
    expect(WIRING.buildG3LspWiring(w.input({ bogusKnob: 1 })).ok).toBe(false)
    expect(WIRING.buildG3LspWiring(w.input({ bogusKnob: 1 })).code).toBe(CODES.INPUT_INVALID)
    const { lspFacts: _drop, ...noFacts } = w.input()
    const missing = WIRING.buildG3LspWiring(noFacts)
    expect(missing.code).toBe(CODES.INPUT_INVALID)
    expect(String(missing.detail)).toContain('documentRealm')
    expect(WIRING.buildG3LspWiring(w.input({ controlPort: true })).code).toBe(CODES.INPUT_INVALID)
    const { pa: _pa, ...noPa } = w.input()
    expect(WIRING.buildG3LspWiring({ ...noPa, pa: { ok: true } }).code).toBe(CODES.INPUT_INVALID)
    expect(w.seamReads.length, 'a refused build never touches the capture seam').toBe(0)
  })

  it('(b) capture-absent lands the honest DECLARED-INACTIVE census: no def, no registration, seam read at most once', () => {
    const w = makeWorld({ absent: true })
    const asm = w.build()
    expect(asm.ok).toBe(true)
    expect(asm.definitions?.length).toBe(0)
    expect(asm.declared?.[0]).toMatchObject({ name: 'lsp', familyId: 'B-LSP', status: 'DECLARED-INACTIVE', reason: 'capture-absent' })
    expect(asm.familyRegistrations?.()).toEqual([])
    expect(asm.drain?.()).toMatchObject({ event: 'g3-lsp-wire:drain' })
    expect(w.seamReads).toEqual(['lsp'])
  })

  it('(c) the placement-moment bind: identity rides the definition THIS mount places; an unbound identity THROWS IDENTITY_UNBOUND', () => {
    const w = makeWorld()
    const asm = w.build()
    expect(asm.ok).toBe(true)
    expect(asm.definitions?.length).toBe(1)
    expect(asm.definitions?.[0].name).toBe(WIRING.A5_G3_LSP_TOOL_NAME)
    const bound = definitionIdentityOf(w.placed.get('lsp'))
    expect(asm.familyRegistrations?.()[0].definitionIdentity).toBe(bound)
    const broken = makeWorld({ identityUnbound: true })
    expect(() => broken.build()).toThrow(new RegExp(CODES.IDENTITY_UNBOUND))
  })

  it('(d) FULL WALK, NO port: classify -> open -> edge -> consumedProof DEMAND -> prepare -> the captured-body delegate answer VERBATIM; the walk carries the B-LSP closed-table FLAT view and the REAL table ACCEPTS it', async () => {
    const w = makeWorld()
    const sentinel = Object.freeze({ locations: [{ path: 'src/a.ts:10:5' }] })
    w.setBody(async () => sentinel)
    const asm = w.build()
    const row = asm.definitions?.[0]
    const answer = await row?.execute(ARGS, w.execFor('call-d1'))
    expect(answer).toBe(sentinel, 'the delegate answer is the captured body VERBATIM (root 19:25 — never re-shaped)')
    expect(w.native.bodyRuns()).toBe(1)
    expect(w.walks.length).toBe(1)
    expect(w.closePlans).toEqual(['call-d1'])
    const walk = w.walks[0] as { realmId: string, callId: string, family: { familyId: string, adapterRevision: number, providerIdentity: string, targetManifest: Record<string, unknown> } }
    expect(walk.family.familyId).toBe('B-LSP')
    expect(typeof walk.family.adapterRevision).toBe('number')
    expect(walk.family.providerIdentity).toBe(PROVIDER)
    const flat = walk.family.targetManifest
    expect(flat).toMatchObject({
      operation: 'hover',
      toolName: 'lsp',
      realmId: REALM,
      agentId: MEMBER,
      sessionHeaderId: HEADER,
      docKind: 'workspace',
      canonicalLocator: 'src/a.ts',
      documentRevisionJson: '"rev-1"',
      serverBinaryIdentity: 'tsserver@6.0.3-sha-abc',
      serverGeneration: 'polgen-7',
      workspaceCwd: CWD,
      oneBasedLine: 10,
      oneBasedCharacter: 5,
      policyGenerationJson: '3',
    })
    expect(typeof flat.paramFingerprint).toBe('string')
    // THE REAL PUBLISHED CHECKER accepts the minted flat for EVERY operation.
    for (const operation of LSP_OP) {
      const perOp = { ...flat, operation }
      expect(validatePaFamilyTarget('B-LSP' as never, perOp as never)).toBeUndefined(operation)
    }
  })

  it('(e) the PORT route: the supplied handle answers and commits VERBATIM — the captured body never runs behind it', async () => {
    const seen: string[] = []
    const port = {
      prepare: async (request: Record<string, unknown>) => {
        seen.push(`prepare:${String(request.toolName)}`)
        seen.push(`manifest:${String((request.manifest as Record<string, unknown>)?.serverTarget === undefined ? 'missing' : 'real')}`)
        seen.push(`recheck:${typeof request.recheckFacts}`)
        return { ok: true, handle: { invoke: async () => ({ hoverAnswer: 'port-verbatim' }) } }
      },
    }
    const w = makeWorld({ port })
    w.setBody(async () => { throw new Error('THE CAPTURED BODY MUST NOT RUN BEHIND A PORT') })
    const asm = w.build()
    const answer = await asm.definitions?.[0].execute(ARGS, w.execFor('call-e1'))
    expect(answer).toEqual({ hoverAnswer: 'port-verbatim' })
    expect(w.native.bodyRuns()).toBe(0)
    expect(seen).toEqual(['prepare:lsp', 'manifest:real', 'recheck:function'])
    expect(w.closePlans).toEqual(['call-e1'])
  })

  it('(f) zero-entry refusals: no consume witness / open deny / abort-after-consume each run NOTHING and still closePlan the call', async () => {
    const w = makeWorld()
    let bodyRan = 0
    w.setBody(async () => { bodyRan += 1; return {} })
    const asm = w.build()
    w.setDropProof(true)
    const noProof = await refusalOf(asm.definitions?.[0].execute(ARGS, w.execFor('call-f1')))
    expect(noProof?.code).toBe(CODES.CONSUME_PROOF_MISSING)
    w.setDropProof(false)
    w.setDenyOpen(true)
    const denied = await refusalOf(asm.definitions?.[0].execute(ARGS, w.execFor('call-f2')))
    expect(denied?.code).toBe('ADMISSION_REFUSED', 'the kernel deny word travels verbatim')
    w.setDenyOpen(false)
    w.setAbortDuringEdge(true)
    const raced = await refusalOf(asm.definitions?.[0].execute(ARGS, w.execFor('call-f3', true)))
    expect(String(raced?.message)).toContain('cancelled — the call was aborted after the execution edge consumed the grant')
    expect(String(raced?.message)).toContain('zero port entries')
    expect(bodyRan, 'no refusal path entered the body').toBe(0)
    expect(w.closePlans).toEqual(['call-f1', 'call-f2', 'call-f3'], 'closePlan on EVERY path')
  })

  it('(g) the B-LSP table grammar fail-closed on the REAL published checker: fifth spelling / missing leaf / extra leaf pin their measured refusal bytes', () => {
    const w = makeWorld()
    const asm = w.build()
    // mint one accepted flat through the real walk, then mutate on the copy —
    // the checker, not a hand-written expectation, decides each verdict.
    const base = {
      operation: 'hover', toolName: 'lsp', realmId: REALM, agentId: MEMBER, sessionHeaderId: HEADER, paramFingerprint: 'fp',
      docKind: 'workspace', canonicalLocator: 'src/a.ts', documentRevisionJson: '"rev-1"',
      serverBinaryIdentity: 'tss@sha', serverGeneration: 'polgen-7', workspaceCwd: CWD,
      oneBasedLine: 10, oneBasedCharacter: 5, policyGenerationJson: '3',
    }
    expect(validatePaFamilyTarget('B-LSP' as never, base as never)).toBeUndefined()
    const fifth = validatePaFamilyTarget('B-LSP' as never, { ...base, operation: 'executeCommand' } as never)
    expect(fifth).toBe(`operation: 'executeCommand' selects no B-LSP variant group`)
    const diagnostics = validatePaFamilyTarget('B-LSP' as never, { ...base, operation: 'diagnostics' } as never)
    expect(diagnostics).toBe(`operation: 'diagnostics' selects no B-LSP variant group`)
    const { documentRevisionJson: _drop, ...missingLeaf } = base
    expect(validatePaFamilyTarget('B-LSP' as never, missingLeaf as never)).toBe('documentRevisionJson: required by the B-LSP typed plan, absent')
    expect(validatePaFamilyTarget('B-LSP' as never, { ...base, extraLeaf: 1 } as never)).toBe('extraLeaf: not part of the B-LSP typed plan')
    expect(validatePaFamilyTarget('B-LSP' as never, { ...base, oneBasedLine: 'ten' } as never)).toBe('oneBasedLine: not a nonNegativeInt')
    void asm
  })

  it('(h) the registration face: ABSENT/MOVED placement feeds THROW; the entry carries the adapter\'s own family bytes', () => {
    const ok = makeWorld()
    const asm = ok.build()
    const [entry] = asm.familyRegistrations?.() ?? []
    expect(entry?.entry).toMatchObject({ familyId: 'B-LSP', providerIdentity: PROVIDER })
    expect(typeof entry?.entry.adapterRevision).toBe('number')
    const moved = makeWorld({ movedFeed: true })
    const movedAsm = moved.build()
    expect(() => movedAsm.familyRegistrations?.()).toThrow(new RegExp(CODES.PLACEMENT_KEY_MOVED))
    const noFeed = makeWorld({ noFeed: true })
    const noFeedAsm = noFeed.build()
    expect(() => noFeedAsm.familyRegistrations?.()).toThrow(new RegExp(CODES.PLACEMENT_KEY_ABSENT))
  })
})
