/**
 * A5M2-G6-PA-SUPPLY-C1 (Card B, root 01:1x) — the REAL PA ASSEMBLY / SUPPLY
 * file block for B-SESSION-QUERY (g6-session-query-pa-supply.mjs), plus the
 * REAL-MINT leg proving the assembled supply reaches the adapter's OWN
 * targetManifest (zero hand-written manifests, the e78 mint-leg law).
 *
 * Leg classes:
 *  (1) SUPPLY LAW — closed input keys; the plane-gate field minimums
 *      (team-tool-plane.mjs:1144-1154 mirrored so an assembled supply is an
 *      acceptable supply); the PA-mount precondition read through the ONE
 *      existing public registry query (resolvePaMount — no new getter, no
 *      new ledger); instance-mismatch; lifecycle (publish → assemble;
 *      revoke → refuse); the maxSearchResults presence-omission law on the
 *      SUPPLY side (absent cap = key GONE, never undefined).
 *  (2) REAL MINT — the pinned 639ed01539 built tool plugin is CAPTURED for
 *      real (tests/paths.mjs is the unique pin source), the adapter is
 *      composed EXACTLY as plane+agent-bindings compose it (the assembled
 *      supply spread + the capture-side readNative), and the row's OWN
 *      classify() produces the targetManifest the legs then probe: the
 *      non-search manifest has NO maxSearchResults key at all, and the cap
 *      carried by the assembled supply (7) rides the real search-row mint.
 *
 * Honesty: NO Host boot, NO network, NO :3080/:3180. There is no Host on
 * this path — the assembly dimension is 接线未测, never 已测试; the family
 * stays 未开发（部分实现）; UNWIRED stands (nothing here mounts into a
 * running plane). The registry is touched ONLY through its published
 * functions (publishPaMount / revokePaMount / resolvePaMount).
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { TEST_USE_REL, findTestRepoRoot } from '../../../tests/paths.mjs'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g6-pa-supply-c1: no repo root carrying tests/paths.mjs — failing closed')
const HOST = join(REPO, TEST_USE_REL)

type ToolName = 'session_search' | 'session_event_search' | 'session_trace' | 'session_event_trace' | 'session_event_read'

const SUP = (await import(new URL('../src/plugin/live/governed-families/g6-session-query-pa-supply.mjs', import.meta.url).href)) as {
  A5_G6_PA_SUPPLY_REVISION: number
  A5_G6_PA_SUPPLY_FAMILY: string
  A5_G6_PA_SUPPLY_CODES: { INPUT_INVALID: string, MOUNT_ABSENT: string, MOUNT_IDENTITY_MISMATCH: string }
  assembleG6SessionQuerySupply: (input?: Record<string, unknown>) => Record<string, unknown>
}
const REG = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  publishPaMount: (teamRoot: string, instanceId: string, entry: Record<string, unknown>) => symbol
  revokePaMount: (teamRoot: string, instanceId: string, identity: symbol) => boolean
  resolvePaMount: (teamRoot: string, instanceId: string) => Record<string, unknown> | undefined
}
const S = (await import(new URL('../src/plugin/live/governed-families/g6-session-query.mjs', import.meta.url).href)) as {
  A5_G6_ADAPTER_REVISION: number
  A5_G6_NAMED_BLOCKERS: Record<string, string>
  A5_G6_PORT_FAMILIES: Record<string, { facet: string, methods: readonly string[], arity: number, required: boolean }>
  createG6SessionQueryAdapter: (deps: Record<string, unknown>) => { rows: Record<ToolName, { classify: (args: unknown) => Record<string, unknown> }> }
}

const SC = SUP.A5_G6_PA_SUPPLY_CODES

const CALLER_ID = 'sess-caller-supply-1'
const CWD = '/work/supply-repo'

let rootSeq = 0
const freshRoot = () => `g6-supply-root-${String(++rootSeq)}`

/** Facet stubs DERIVED from the adapter's own port-family table (the mount
 *  hard-visits every declared method with exact arity; classify never calls
 *  them — these exist to present wiring that AGREES with the evidence). */
async function stub2 (_a: unknown, _b: unknown): Promise<unknown[]> { return [] }
const mkFacets = (): Record<string, Record<string, unknown>> => {
  const facets: Record<string, Record<string, unknown>> = {}
  for (const family of Object.values(S.A5_G6_PORT_FAMILIES)) {
    expect(family.arity, family.facet).toBe(2)
    const facet = (facets[family.facet] ??= {})
    for (const method of family.methods) facet[method] = stub2
  }
  return facets
}

/** The presented deployment facts every leg starts from (fake ports — the
 *  block never calls them; only their SHAPES are gated). */
const presented = (root: string, instanceId: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  teamRoot: root,
  instanceId,
  providerId: 'plugin-team-g6',
  queryPorts: mkFacets(),
  readCaller: () => ({ id: CALLER_ID, cwd: CWD, boundary: { lastStepStartSeq: 50 } }),
  teamCeiling: () => true,
  declaredMount: { searchBackend: { present: true } },
  ...extra,
})

const publish = (root: string, instanceId: string, entryExtra: Record<string, unknown> = {}): symbol =>
  REG.publishPaMount(root, instanceId, { instanceId, ...entryExtra })

describe('a5m2-g6 pa-supply — the assembly block (Card B): supply law over the ONE public registry query', () => {
  it('the block\'s identity bytes are pinned (revision, family, closed codes)', () => {
    expect(SUP.A5_G6_PA_SUPPLY_REVISION).toBe(1)
    expect(SUP.A5_G6_PA_SUPPLY_FAMILY).toBe('B-SESSION-QUERY')
    expect(Object.values(SC).sort()).toEqual([
      'P_G6_SUPPLY_INPUT_INVALID',
      'P_G6_SUPPLY_MOUNT_ABSENT',
      'P_G6_SUPPLY_MOUNT_IDENTITY_MISMATCH',
    ])
  })

  it('closed input keys: an unknown key is refused naming the exact face (the wiring bridge\'s known-input law, mirrored at the SUPPLY side)', () => {
    const out = SUP.assembleG6SessionQuerySupply(presented(freshRoot(), 'i-1', { readNative: () => undefined }))
    expect(out['ok']).toBe(false)
    expect(out['code']).toBe(SC.INPUT_INVALID)
    expect(String(out['detail'])).toContain("unknown supply input 'readNative'")
    // readNative in particular belongs to the CAPTURE side (agent-bindings
    // member-scoped seam) — the supply block must never pretend to own it.
  })

  it('PA-MOUNT ABSENT refuses the whole assembly: deployment evidence never exists for a mount the PA verifier cannot resolve', () => {
    const root = freshRoot()
    expect(REG.resolvePaMount(root, 'i-1')).toBeUndefined()
    const out = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1'))
    expect(out['ok']).toBe(false)
    expect(out['code']).toBe(SC.MOUNT_ABSENT)
    expect(String(out['detail'])).toContain(root)
    expect(String(out['detail'])).toContain('i-1')
  })

  it('published mount → assembled supply: frozen envelope + frozen supply; the presented ports/functions ride BY REFERENCE, unfrozen (this block never freezes the owner\'s objects)', () => {
    const root = freshRoot()
    publish(root, 'i-1')
    const input = presented(root, 'i-1')
    const out = SUP.assembleG6SessionQuerySupply(input)
    expect(out['ok']).toBe(true)
    const value = out['value'] as Record<string, unknown>
    expect(Object.isFrozen(out)).toBe(true)
    expect(Object.isFrozen(value)).toBe(true)
    expect(value['queryPorts']).toBe(input['queryPorts']) // same object, by reference
    expect(Object.isFrozen(value['queryPorts'])).toBe(false)
    expect(value['readCaller']).toBe(input['readCaller'])
    expect(value['teamCeiling']).toBe(input['teamCeiling'])
    expect(value['declaredMount']).toBe(input['declaredMount'])
    expect(value['providerId']).toBe('plugin-team-g6')
    // the supply NEVER carries readNative (capture-side law):
    expect('readNative' in value).toBe(false)
  })

  it('maxSearchResults presence-omission on the SUPPLY side: absent cap = key GONE (hasOwnProperty false, in-probe false); present cap travels its value', () => {
    const root = freshRoot()
    publish(root, 'i-1')
    const bare = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1'))['value'] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(bare, 'maxSearchResults')).toBe(false)
    expect('maxSearchResults' in bare).toBe(false)
    const capped = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1', { maxSearchResults: 7 }))['value'] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(capped, 'maxSearchResults')).toBe(true)
    expect(capped['maxSearchResults']).toBe(7)
    // a present-but-bogus cap is refused, never silently dropped:
    for (const bad of [0, -3, 1.5, '7']) {
      const out = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1', { maxSearchResults: bad }))
      expect(out['code'], String(bad)).toBe(SC.INPUT_INVALID)
    }
  })

  it('the PLANE-GATE minimums are mirrored exactly: blank providerId, non-record ports, non-callable caller/ceiling, searchBackend-less declaredMount each refuse with INPUT_INVALID', () => {
    const root = freshRoot()
    publish(root, 'i-1')
    const broken: Array<Record<string, unknown>> = [
      { providerId: '' },
      { queryPorts: null },
      { readCaller: 'nope' },
      { teamCeiling: null },
      { declaredMount: {} },
      { declaredMount: { searchBackend: 'evidence-string' } },
    ]
    for (const patch of broken) {
      const input = presented(root, 'i-1')
      for (const [key, value] of Object.entries(patch)) input[key] = value
      const out = SUP.assembleG6SessionQuerySupply(input)
      expect(out['ok'], Object.keys(patch).join(',')).toBe(false)
      expect(out['code'], Object.keys(patch).join(',')).toBe(SC.INPUT_INVALID)
    }
  })

  it('mount-identity mismatch (defense in depth, the readPaCallFactsForCall law): the resolved mount answering a DIFFERENT instanceId refuses the assembly', () => {
    const root = freshRoot()
    publish(root, 'i-1', { instanceId: 'i-other' })
    const out = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1'))
    expect(out['ok']).toBe(false)
    expect(out['code']).toBe(SC.MOUNT_IDENTITY_MISMATCH)
    expect(String(out['detail'])).toContain('i-other')
  })

  it('lifecycle: revoke by identity returns the world to mount-absent — re-assembly then refuses (public queries are the ONE truth, no cache in this block)', () => {
    const root = freshRoot()
    const identity = publish(root, 'i-1')
    expect(SUP.assembleG6SessionQuerySupply(presented(root, 'i-1'))['ok']).toBe(true)
    expect(REG.revokePaMount(root, 'i-1', identity)).toBe(true)
    const out = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1'))
    expect(out['code']).toBe(SC.MOUNT_ABSENT)
  })
})

/* ══ REAL MINT: assembled supply → adapter composition → row.classify() mints ══ */
describe('a5m2-g6 pa-supply — REAL mint legs: the assembled supply rides the adapter\'s own targetManifest (zero hand-written manifests)', () => {
  interface NativeFace { name: string }
  let facesPromise: Promise<Record<ToolName, NativeFace>> | null = null
  function loadRealFaces (): Promise<Record<ToolName, NativeFace>> {
    if (facesPromise === null) {
      facesPromise = (async () => {
        const libPath = join(HOST, 'packages', 'session-query', 'tool-session-query', 'lib', 'index.js')
        if (!existsSync(libPath)) throw new Error(`pristine host tool lib absent (${libPath}); failing closed`)
        const mod = (await import(pathToFileURL(libPath).href)) as unknown as {
          name: string
          inject: string[]
          DEFAULT_MAX_SEARCH_RESULTS: number
          apply: (ctx: unknown, config: Record<string, unknown>) => void
        }
        expect(mod.name).toBe('tool-session-query')
        expect(mod.DEFAULT_MAX_SEARCH_RESULTS).toBe(100)
        const captured = {} as Record<ToolName, NativeFace>
        mod.apply({
          tools: { register: (tool: NativeFace) => { (captured as Record<string, NativeFace>)[tool.name] = tool; return () => {} } },
          systemPrompt: { section: () => {}, getSectionOrder: () => 0 },
        }, {})
        expect(Object.keys(captured).length).toBe(5)
        return captured
      })()
    }
    return facesPromise
  }

  /** Composes the adapter EXACTLY as plane + agent-bindings compose it: the
   *  ASSEMBLED supply block spread, plus the capture-side readNative seam. */
  async function compose (extra: Record<string, unknown> = {}): Promise<Record<ToolName, { classify: (args: unknown) => Record<string, unknown> }>> {
    const captured = await loadRealFaces()
    const root = freshRoot()
    publish(root, 'i-1')
    const assembled = SUP.assembleG6SessionQuerySupply(presented(root, 'i-1', extra))
    expect(assembled['ok']).toBe(true)
    const value = assembled['value'] as Record<string, unknown>
    return S.createG6SessionQueryAdapter({
      realmId: 'realm-g6-supply',
      ...value,
      readNative: (name: string) => captured[name as ToolName],
      // RE-ANCHOR (center PA-SUPPLY card, int tip 24ae09279): the adapter's
      // constructor has required the PUBLIC Provider lifecycle since root
      // ruling 3 (g6-session-query.mjs:1161 'lifecycle { currentGeneration()
      // ... } is required', landed at int via 3a0662bad). Production carries
      // it in the plane inject (team-tool-plane G6 block) fed by the host
      // ctx.inject(['sessionQuery']) fiber - NOT through the presented-
      // facts assembly: a lifecycle observer is the assembly's RUNTIME face,
      // never a presented deployment fact, so the block's closed
      // KNOWN_INPUT_KEYS law stays frozen and this leg feeds the double the
      // plane would receive: ONE stable ACTIVE generation-1 observer over
      // the same port object the facets were built from. classify-only legs
      // never dispatch, so no generation check past the shape gate is ever
      // exercised here.
      lifecycle: { currentGeneration: () => ({ id: 1, service: (value as Record<string, unknown>)['queryPorts'] }) },
      generation: 1,
    }).rows
  }

  it('NON-SEARCH real mint (session_event_read): the adapter\'s own classify() carries NO maxSearchResults key — hasOwnProperty false, ownKeys exclude it, in-probe false (the PA validator\'s actual probe) — while the supply-assembled caller/target facts ride the manifest', async () => {
    const rows = await compose()
    const plan = rows['session_event_read'].classify({ session_id: 's-a', seq: 5 })
    expect(plan['ok'], JSON.stringify(plan)).toBe(true)
    const manifest = plan['targetManifest'] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(manifest, 'maxSearchResults')).toBe(false)
    expect(Object.keys(manifest)).not.toContain('maxSearchResults')
    expect('maxSearchResults' in manifest).toBe(false)
    // the supply's caller law reaches the mint through the adapter (facts,
    // not restatements: these bytes come out of row.classify itself):
    expect(manifest['effectiveTargetSessionId']).toBe('s-a')
    expect(manifest['callerWorkspaceCwd']).toBe(CWD)
    expect(manifest['toolName']).toBe('session_event_read')
    expect(manifest['disclosures']).toEqual([S.A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND])
  })

  it('SEARCH real mint (session_search): the cap carried by the ASSEMBLED supply (7) rides the REAL mint with the key PRESENT — supply-side omission law and mint-side omission law close the same circle', async () => {
    const rows = await compose({ maxSearchResults: 7 })
    const plan = rows['session_search'].classify({ query: 'needle' })
    expect(plan['ok'], JSON.stringify(plan)).toBe(true)
    const manifest = plan['targetManifest'] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(manifest, 'maxSearchResults')).toBe(true)
    expect(manifest['maxSearchResults']).toBe(7)
    // the REAL source law (g6-session-query.mjs:1331, args.session_id ?? caller):
    // a session_search carries the CALLER as its effective target — the
    // supply-assembled caller identity rides the real mint verbatim.
    expect(manifest['effectiveTargetSessionId']).toBe(CALLER_ID)
  })
})
