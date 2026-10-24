/**
 * A5M2-G1 record-85 CLOSED-KEY HAND-OVER (root 03:05 construction-scope
 * ruling; center ruling: one semantic writer, this lane).
 *
 * WHAT IS PROVEN, at the REAL contract surface (no adapter zero-port residual
 * is ever read as production closure — root's explicit bar):
 *  (1) THE CLAIM LAW — the G1 family's own closed-key mirror of
 *      claimTeamOpsFamily (capture / face / identity census): it claims
 *      EXACTLY the one name when the REAL native def of THAT agent's legal
 *      selection qualifies, and NOTHING where the name is absent, malformed
 *      or unminted — a claim can never expose a name the selection does not
 *      already carry (member worlds keep their byte-for-byte shape).
 *  (2) THE NATIVE CONTRACT rides THROUGH the hand-over UNCHANGED: definitions
 *      are the REAL `createTeamTools` build —
 *        leader caller  -> the real pre-read gate passes, the ledger reads
 *                          run ONCE each, the answer is `pending-control-listed`;
 *        member caller  -> refused TEAM_TOOL_PENDING_LIST_NOT_LEADER BEFORE
 *                          any ledger read (zero ledger calls — the pre-read
 *                          law is measured, not quoted), so the member gains
 *                          ZERO new exposure through the governed placement;
 *        the caller/root binding is the live `resolveCaller` single chain,
 *        `requestToken` stays a REQUIRED validated argument.
 *  (3) THE BLOCK AT SOURCE LEVEL — the claim rides the B-TEAM atomic site as
 *      an ADDITIVE closed-key extension (the ten-key B-TEAM census untouched,
 *      `team_list_pending_control` measured ABSENT from A5_B_TEAM_TOOL_NAMES),
 *      the arm gate opens for record 85 ONLY through the claimed key, and the
 *      native's Leader gate source order (refusal BEFORE listControlState) is
 *      intact.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { createTeamTools } from '../../tools/src/index.js'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g1-control85: no repo root carrying tests/paths.mjs — failing closed')

/** the wiring module's hand-over exports (plain .mjs lane product). */
const WIRE_C85 = (await import(new URL('../src/plugin/live/governed-families/g1-query-wiring.mjs', import.meta.url).href)) as {
  claimG1Control85Handover: (input: { catalog: unknown; allowedNames?: unknown; definitionIdentityOf?: unknown }) => { names: string[]; census: Array<{ name: string; recordIndex: number; reason: string }> }
  A5_G1_CONTROL85_HANDOVER: { name: string; recordIndex: number }
}
const { claimG1Control85Handover, A5_G1_CONTROL85_HANDOVER } = WIRE_C85

/** the B-TEAM census module (read as the CLOSED ten-key set it is). */
const TEAM_ADAPT = (await import(new URL('../src/plugin/live/governed-families/team-adapters.mjs', import.meta.url).href)) as {
  A5_B_TEAM_TOOL_NAMES: readonly string[]
}
const { A5_B_TEAM_TOOL_NAMES } = TEAM_ADAPT

const ROOT = 'sess-a5m2-c85-root'
const face = (over: Record<string, unknown> = {}) => Object.freeze({
  name: 'team_list_pending_control',
  description: 'list pending control requests',
  output: Object.freeze({ schema: Object.freeze({ type: 'object' }), render: () => [] }),
  execute: async () => ({}),
  ...over,
})

describe('A5M2-G1 record-85 closed-key hand-over', () => {
  it('THE CLOSED KEY is exactly one: the hand-over names only record 85 and is NOT a widening of the B-TEAM ten-key census', () => {
    expect(A5_G1_CONTROL85_HANDOVER).toEqual({ name: 'team_list_pending_control', recordIndex: 85 })
    expect(A5_B_TEAM_TOOL_NAMES).not.toContain('team_list_pending_control')
    expect(A5_B_TEAM_TOOL_NAMES).toHaveLength(10)
  })

  it('the claim law mirrors the B-TEAM qualification census — capture / face / identity, one name, never more', () => {
    const minted = () => 'defid-c85'
    expect(claimG1Control85Handover({ catalog: [], allowedNames: null, definitionIdentityOf: minted })).toEqual({
      names: [],
      census: [{ name: 'team_list_pending_control', recordIndex: 85, reason: 'capture-absent' }],
    })
    expect(claimG1Control85Handover({ catalog: [face()], allowedNames: null, definitionIdentityOf: minted })).toEqual({
      names: ['team_list_pending_control'],
      census: [],
    })
    expect(claimG1Control85Handover({ catalog: [face({ execute: undefined })], allowedNames: null, definitionIdentityOf: minted }).census[0]?.reason).toBe('registration-face-incomplete')
    expect(claimG1Control85Handover({ catalog: [face()], allowedNames: null, definitionIdentityOf: () => null }).census[0]?.reason).toBe('capture-identity-unminted')
    expect(claimG1Control85Handover({ catalog: [face()], allowedNames: ['some-other-name'], definitionIdentityOf: minted }).census[0]?.reason).toBe('not-allowed-for-this-member')
    const answered = claimG1Control85Handover({ catalog: [face()], allowedNames: null, definitionIdentityOf: minted })
    expect(Object.isFrozen(answered) && Object.isFrozen(answered.names)).toBe(true)
  })

  it('THE NATIVE CONTRACT rides through: leader sees the real listed answer; a member is refused BEFORE any ledger read; requestToken stays required', async () => {
    const ledgerCalls: string[] = []
    const control = {
      async listControlState(rootSessionId: string) {
        ledgerCalls.push(`state:${rootSessionId}`)
        return { requests: [{ requestId: 'req-1', status: 'pending', requestSequence: 1, approvalCaseId: 'case-1' }] }
      },
      async listOpenApprovalCases() {
        ledgerCalls.push('cases')
        return [{ state: { currentLeg: { requestId: 'req-1', requestSequence: 1 } } }]
      },
    }
    const callerBySession = new Map<string, { kind: string; instanceId: string }>([
      ['sess-leader', { kind: 'instance', instanceId: 'inst-leader' }],
      ['sess-member', { kind: 'instance', instanceId: 'inst-a1' }],
    ])
    const { tools } = createTeamTools({
      teamRuntime: {} as never,
      controlService: control as never,
      messaging: {} as never,
      activity: {} as never,
      resolveCaller: async (sessionId: string) => {
        const caller = callerBySession.get(sessionId)
        if (caller === undefined) throw new Error(`c85: no caller for '${sessionId}'`)
        return { caller: caller as never, rootSessionId: ROOT }
      },
    } as never)
    const def = tools.find((tool) => tool.name === 'team_list_pending_control')
    expect(def).toBeDefined()
    // the hand-over face law qualifies the REAL native def (the governed def
    // spreads THIS verbatim): the G1 claim accepts the real build.
    expect(claimG1Control85Handover({ catalog: [...tools], allowedNames: null, definitionIdentityOf: () => 'defid-real' }).names).toEqual(['team_list_pending_control'])
    // leader POSITIVE: the real gate passes, the two ledger reads ride, the
    // answer is the contract shape.
    const listed = await def!.execute({ rootSessionId: ROOT, requestToken: 'tok-c85-1' }, { agent: { id: 'sess-leader' } })
    expect((listed as { status: string }).status).toBe('pending-control-listed')
    expect((listed as { count: number }).count).toBe(1)
    expect(ledgerCalls).toEqual(['state:' + ROOT, 'cases'])
    // member NEGATIVE: refused by the native's OWN pre-read gate — measured by
    // the ledger staying UNTOUCHED after the call (zero new calls). ledgerCalls
    // below must equal the leader's two reads, nothing more.
    const refused = await def!.execute({ rootSessionId: ROOT, requestToken: 'tok-c85-2' }, { agent: { id: 'sess-member' } })
    expect((refused as { status: string; code: string }).status).toBe('rejected')
    expect((refused as { code: string }).code).toBe('TEAM_TOOL_PENDING_LIST_NOT_LEADER')
    expect(ledgerCalls).toEqual(['state:' + ROOT, 'cases'])
    // requestToken discipline: the REQUIRED argument fails closed before any
    // caller resolution (still zero ledger reads).
    const noToken = await def!.execute({ rootSessionId: ROOT }, { agent: { id: 'sess-leader' } }).then(
      (value: unknown) => value,
      (error: unknown) => error,
    )
    expect(String((noToken as Error)?.message ?? JSON.stringify(noToken))).toContain('requestToken')
    expect(ledgerCalls).toEqual(['state:' + ROOT, 'cases'])
  })

  it('the block at source level: additive closed-key claim at the B-TEAM atomic site, closed-key arm gate, the B-TEAM census and the native Leader gate untouched', () => {
    const src = readFileSync(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
    // ① the site: the B-TEAM claim call is byte-unchanged; the G1 claim rides
    //    the same atomic law, gated by the EXACT g1-mount eligibility.
    expect(src).toContain('a5TeamOpsClaim = claimTeamOpsFamily({')
    expect(src).toContain('claimG1Control85Handover({')
    expect(src).toContain("const a5G1PlaneCfgHere = config?.teamToolPlane?.g1PureQuery")
    expect(src).toContain("&& a5G1PlaneCfgHere !== undefined && a5G1PlaneCfgHere !== null) {")
    //    one placement law: the raw filter lets BOTH claims' names, and the
    //    claim defaults to the EMPTY set OUTSIDE the eligibility (a claim
    //    without an arm can never silence a name).
    expect(src).toContain('!a5TeamOpsClaimedNames.has(def.name) && !a5G1Control85Names.has(def.name)')
    expect(src).toContain('let a5G1Control85Names = new Set()')
    // ② the arm gate: record 85 arms ONLY through family + recordIndex + the
    //    claimed key; every other non-B-INSPECT row keeps the root 17:55 skip
    //    and its SUPPLY-GATED observation.
    expect(src).toContain("const a5G1Control85Armed = entry.recordIndex === 85\n              && entry.familyId === 'B-CONTROL'\n              && a5G1Control85Names.has(entry.name)\n              && a5G1Control85Native !== undefined")
    // ROOT P1 exact capture: the assembly reads the CLAIMED selection instance
    // for record 85 — never a scoped re-read (the raw name was let), never a
    // parent-layer same-named definition.
    expect(src).toContain('entry.recordIndex === 85 ? a5G1Control85Native')
    expect(src).toContain(': agentCtx.tools.get(name, agent))')
    expect(src).toContain('a5G1Control85Native = a5G1Claim85.names.length === 0 ? undefined')
    expect(src).toContain("if (entry.familyId !== 'B-INSPECT' && !a5G1Control85Armed)")
    expect(src).toContain('SUPPLY-GATED')
    // ③ native permissions: the tools package is NOT in this change's path —
    //    the Leader gate stays BEFORE any ledger read inside the spec body.
    const toolsSrc = readFileSync(join(REPO, 'packages', 'tools', 'src', 'tools.ts'), 'utf8')
    // the ORDER law is asserted INSIDE the spec body (the names also appear
    // at module scope — a global indexOf would order the declarations, not
    // the run): inside listPendingControlSpec, the Leader-gate refusal sits
    // strictly before the FIRST ledger read.
    const specStart = toolsSrc.indexOf('function listPendingControlSpec')
    const specBody = toolsSrc.slice(specStart, toolsSrc.indexOf('\nfunction ', specStart + 1))
    expect(specStart).toBeGreaterThan(-1)
    const notLeader = specBody.indexOf('TEAM_TOOL_PENDING_LIST_NOT_LEADER')
    const firstRead = specBody.indexOf('listControlState')
    expect(notLeader).toBeGreaterThan(-1)
    expect(firstRead).toBeGreaterThan(notLeader)
    expect(toolsSrc).toContain("caller.instanceId !== LEADER_INSTANCE_ID")
  })
})
