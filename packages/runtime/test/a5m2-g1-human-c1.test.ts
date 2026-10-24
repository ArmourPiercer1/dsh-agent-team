/**
 * a5m2-g1-human-c1.test.ts — B-HUMAN wiring slice spec (author side).
 * REAL-MINT: the ask_user_question native face is the REAL compiled
 * 639ed01539 tool (tests/paths.mjs is the unique pin source); the human
 * channel behind it is a spy — the point is the SHAPE the real body puts
 * on the seam and the closed shapes the gates refuse.
 */
import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTestRepoRoot, TEST_USE_REL } from '../../../tests/paths.mjs'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g1-human-c1: no repo root carrying the test-use tree — failing closed')
const HOST = join(REPO, TEST_USE_REL)

const H = (await import(new URL('../src/plugin/live/governed-families/human.mjs', import.meta.url).href)) as {
  A5_G1_HUMAN_FAMILY: string
  A5_G1_HUMAN_WIRING_REVISION: number
  A5_G1_HUMAN_FAMILY_ENTRY: Record<string, unknown>
  A5_G1_HUMAN_WIRING_CODES: Record<string, string>
  createG1HumanWiring: (input?: Record<string, unknown>) => Record<string, unknown>
}
const ADAPTERS = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as {
  A5_G1_ADAPTER_REVISION: number
}
const C = H.A5_G1_HUMAN_WIRING_CODES

const trusted = () => ({
  memberAgentId: 'agent-h1', sessionHeaderId: 'sess-h1', realmId: 'realm-h', owner: 'owner-1', profileId: 'prof-1',
})

const ASK_LIB = pathToFileURL(join(HOST, 'packages', 'interaction', 'tool-ask-user', 'lib', 'index.js')).href
const askLib = () => import(ASK_LIB) as Promise<{ apply: (ctx: Record<string, unknown>, config?: Record<string, unknown>) => void }>

/** REAL-MINT: register the ask_user_question tool out of the pristine host
 *  lib. The human channel behind it may be a spy (its ANSWERS are the
 *  host's own gate); the DEFINITION face is always the host's, never a
 *  double. */
async function mintAskNative (askSpy?: (req: Record<string, unknown>) => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const lib = await askLib()
  let captured: Record<string, unknown> | undefined
  lib.apply({
    tools: { register: (def: Record<string, unknown>) => { captured = def } },
    ...(askSpy === undefined ? {} : { userQuestions: { ask: askSpy } }),
  }, {})
  if (captured === undefined) throw new Error('REAL-MINT failed: the host tool never registered')
  return captured
}

const paDouble = (opts: { openKind?: string, deny?: Record<string, unknown>, edgeProof?: Record<string, unknown> | null, cancelled?: boolean } = {}) => {
  const calls: string[] = []
  const grant = { grantId: 'grant-1' }
  // the REAL seat shape: a CALLABLE carrying open/edge/closePlan methods
  // (team-tool-plane.mjs paAdmit law) — a bare object does not pose.
  const seat = (async () => { calls.push('call') }) as unknown as Record<string, unknown> & { calls: string[] }
  seat.calls = calls
  seat.open = async () => {
    calls.push('open')
    if (opts.cancelled === true) return { cancelled: true }
    if (opts.openKind === 'deny') return opts.deny ?? { kind: 'deny', code: 'P_PA_DENY_X', detail: 'deny' }
    return { kind: 'approved', grant }
  }
  seat.edge = async () => {
    calls.push('edge')
    return opts.edgeProof === null ? { kind: 'allow' } : { kind: 'allow', consumedProof: opts.edgeProof ?? { grant } }
  }
  seat.closePlan = async () => { calls.push('closePlan') }
  return seat as typeof seat & { open: (w: unknown) => Promise<unknown> }
}

const wiring = (native: Record<string, unknown>, pa: Record<string, unknown>): { ok: unknown, code?: string, execute: (a: Record<string, unknown>, o: { callId: string }) => Promise<Record<string, unknown>>, recordIndex?: number, row?: Record<string, unknown> } =>
  H.createG1HumanWiring({
    realmId: 'realm-h', providerId: 'plugin-h', name: 'ask_user_question',
    native, definitionIdentity: 'plugin-h@639ed01#ask#h1',
    trusted: trusted(), bindingFacts: () => ({ bindingId: 'b1', bindingRevision: 1 }), pa,
  }) as never

describe('a5m2-g1-human-c1 — B-HUMAN wiring (one-name-one-mount, PA before the kept human gate)', () => {
  it('byte law: the export face is the closed family wiring vocabulary', () => {
    expect(Object.keys(H).sort()).toStrictEqual([
      'A5_G1_HUMAN_FAMILY',
      'A5_G1_HUMAN_FAMILY_ENTRY',
      'A5_G1_HUMAN_WIRING_CODES',
      'A5_G1_HUMAN_WIRING_REVISION',
      'createG1HumanWiring',
    ])
    expect(H.A5_G1_HUMAN_FAMILY).toBe('B-HUMAN')
  })

  it('family table entry: M0-B records 49/50 and the CONSUMED adapter revision (single source)', () => {
    const entry = H.A5_G1_HUMAN_FAMILY_ENTRY
    expect(entry['familyId']).toBe('B-HUMAN')
    expect(entry['records']).toStrictEqual({ ask_user_question: 49, exit_plan_mode: 50 })
    expect(entry['contractRef']).toBe('M0-B-FAMILY-TARGET-CONTRACTS.md#B-HUMAN')
    expect((entry['consumedAdapter'] as Record<string, unknown>)['revision']).toBe(ADAPTERS.A5_G1_ADAPTER_REVISION)
  })

  it('input gates: unknown keys, cross-family fan-out, and a missing admission seat all refuse typed', () => {
    const base = { realmId: 'realm-h', providerId: 'plugin-h', name: 'ask_user_question', pa: paDouble() }
    let out = H.createG1HumanWiring({ ...base, bogus: 1 })
    expect(out['code']).toBe(C.INPUT_INVALID)
    out = H.createG1HumanWiring({ ...base, name: 'skill' })
    expect(out['code']).toBe(C.INPUT_INVALID)
    expect(String(out['detail'])).toContain('one-name-one-mount')
    out = H.createG1HumanWiring({ ...base, pa: {} })
    expect(out['code']).toBe(C.INPUT_INVALID)
    out = H.createG1HumanWiring({ providerId: 'plugin-h', name: 'ask_user_question', pa: paDouble() })
    expect(out['code']).toBe(C.INPUT_INVALID)
  })

  it('the consumed mount law guards the capture: a renamed/reconstructed face refuses the whole wiring', () => {
    const out = H.createG1HumanWiring({
      realmId: 'realm-h', providerId: 'plugin-h', name: 'ask_user_question',
      native: { name: 'not_ask', description: 'reconstructed', execute: () => [] },
      definitionIdentity: 'p@1#ask', trusted: trusted(), bindingFacts: () => ({}), pa: paDouble(),
    })
    expect(out['ok']).toBe(false)
    expect(out['code']).toBe(C.MOUNT_REFUSED)
  })

  it('REAL-MINT @639ed01539: the host tool face carries the pinned shape and arms the wiring; record 50 arms on the same law', async () => {
    const native = await mintAskNative()
    expect(native['name']).toBe('ask_user_question')
    expect(typeof native['description']).toBe('string')
    const params = native['parameters'] as Record<string, unknown>
    // the COMPILED host face carries the JSON-schema shape (src uses the
    // defineTool shorthand; lib/index.js is what a mount would capture)
    expect(params['type']).toBe('object')
    const qSchema = (params['properties'] as Record<string, Record<string, unknown> | undefined>)['questions']
    expect(qSchema?.['type']).toBe('array')
    expect(params['required']).toStrictEqual(['questions'])
    const built = wiring(native, paDouble())
    expect(built.ok).toBe(true)
    expect(built.recordIndex).toBe(49)
    expect(built.row?.['familyId']).toBe('B-HUMAN')
    // record 50 arms on the same mount law with its face (capability pin;
    // exit_plan_mode's OWN C1 acceptance stays queued — this slice is
    // one-name-one-mount and its REAL-MINT leg is ask_user_question)
    const exitBuilt = H.createG1HumanWiring({
      realmId: 'realm-h', providerId: 'plugin-h', name: 'exit_plan_mode',
      native: { name: 'exit_plan_mode', description: 'Present your plan for review.', parameters: { plan: { type: 'string', required: true } }, execute: async () => ({ approved: true }) },
      definitionIdentity: 'plugin-h@639ed01#exit_plan_mode#h1',
      trusted: trusted(), bindingFacts: () => ({}), pa: paDouble(),
    })
    expect(exitBuilt['ok']).toBe(true)
    expect(exitBuilt['recordIndex']).toBe(50)
  })

  it('happy path: PA landed with a consume witness, the REAL host body delivers the question over userQuestions.ask with the real mapping', async () => {
    const askCalls: Array<Record<string, unknown>> = []
    const native = await mintAskNative(async (req) => { askCalls.push(req); return { answers: [{ id: 'q1', selected: ['yes'] }] } })
    const seat = paDouble()
    const built = wiring(native, seat)
    expect(built.ok, `wiring refused: ${String(built.code)} ${String((built as Record<string, unknown>)['detail'] ?? '')}`).toBe(true)
    const out = await built.execute(
      { questions: [{ id: 'q1', question: 'Proceed?', options: [{ label: 'yes' }], multi_select: true }] },
      { callId: 'call-1' },
    )
    expect(out['ok']).toBe(true)
    expect(askCalls.length).toBe(1)
    const askReq = askCalls[0]
    if (askReq === undefined) throw new Error('ask spy never recorded the request')
    const q0 = (askReq['questions'] as Array<Record<string, unknown> | undefined>)[0]
    expect(q0?.['id']).toBe('q1')
    expect(q0?.['multiSelect']).toBe(true) // the host body's OWN multi_select→multiSelect mapping ran
    expect(askReq['signal']).toBeUndefined()
    // the real body's OWN answer mapping rides back through the row
    expect((out['value'] as { answers: Array<Record<string, unknown>> }).answers[0]).toStrictEqual({ id: 'q1', selected: ['yes'] })
    expect(seat.calls).toStrictEqual(['open', 'edge', 'closePlan'])
  })

  it('deny at the open edge: the refusal rides through typed and ZERO question is delivered (C2 拒绝不发问)', async () => {
    const native = await mintAskNative()
    const built = wiring(native, paDouble({ openKind: 'deny', deny: { kind: 'deny', code: 'P_PA_DENY_X', detail: 'team deny' } }))
    const out = await built.execute({ questions: [{ id: 'q1', question: 'x' }] }, { callId: 'call-d' })
    expect(out['code']).toBe('P_PA_DENY_X')
  })

  it('approval not landed / consume witness missing / pre-cancelled: every unsettled answer refuses with zero human-channel entry', async () => {
    const native = await mintAskNative()
    const args = { questions: [{ id: 'q1', question: 'x' }] }
    const notLanded = paDouble()
    notLanded.open = async () => ({ kind: 'pending' })
    let out = await wiring(native, notLanded).execute(args, { callId: 'c1' })
    expect(out['code']).toBe(C.APPROVAL_NOT_LANDED)
    out = await wiring(native, paDouble({ edgeProof: null })).execute(args, { callId: 'c2' })
    expect(out['code']).toBe(C.CONSUME_PROOF_MISSING)
    out = await wiring(native, paDouble({ cancelled: true })).execute(args, { callId: 'c3' })
    expect(out['code']).toBe(C.ADMISSION_CANCELLED)
  })

  it('classify refuses BEFORE the PA seat: a shape violation never opens an admission', async () => {
    const native = await mintAskNative()
    const seat = paDouble()
    const built = wiring(native, seat)
    const out = await built.execute({ nope: 1 }, { callId: 'c9' })
    expect(out['ok']).toBe(false)
    expect(seat.calls).toStrictEqual([])
  })
})
