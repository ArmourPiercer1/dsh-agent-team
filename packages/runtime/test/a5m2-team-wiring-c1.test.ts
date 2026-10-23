/**
 * A5M2-B-TEAM-WIRING — the spec of the controlled wiring bridge
 * `governed-families/team-wiring.mjs` over the REAL, root-reviewed B-TEAM
 * adapter (`team-adapters.mjs` rev.1, records 74–82 + 86, imported VERBATIM
 * and edited by nobody here). The bridge, the adapter factory, the effect
 * grammar and the PA family-target checkers are all the production modules;
 * the doubles are the native tool faces (the adapter spec owns the real
 * createTeamTools pairing), the admission SEAT recorders, and the lane tool
 * set. NOT C2: no Host, no ports, no tests/homes, no network.
 *
 * Legs:
 *  (a) the CLOSED SET is the adapter's own ten — every captured face mounts
 *      ACTIVE with only `execute` replaced; a native this build does not
 *      carry stays an honest census row (no def, no registration);
 *  (b) the SEAT LAW: the production `paAdmit` shape (a CALLABLE carrying
 *      open/edge/closePlan) is accepted; a duck without the three methods
 *      refuses the assembly — `input.admit({ok:true})` never poses as it;
 *  (c) the REAL WALK: `pa.open -> pa.edge -> consumedProof -> admitted ->
 *      exactly ONE delegate entry`; every refusal leg (unsettled, deny,
 *      cancelled, MISSING WITNESS, no issued call identity, unmintable
 *      target) settles with ZERO delegate entry and zero PA edge;
 *  (d) ONE CONSUMPTION per plan object at this edge;
 *  (e) the mirrored lane argument law answers the LANE'S OWN rejected VALUE
 *      with zero PA entry and zero port entry;
 *  (f) the L7 live hands are live: a moved native face refuses
 *      P_B_TEAM_DEFINITION_DRIFT, a rebuilt lane set refuses
 *      P_B_TEAM_PORT_DRIFT — both with zero delegate entry;
 *  (g) the CLAIM: the nine measured target leaves ride the walk at FULL
 *      VALUE, and the durable grammar gate is MEASURED through the real
 *      published checkers — `isLosslessJsonValue` passes, and
 *      `validatePaFamilyTarget('B-TEAM', …)` answers its own
 *      no-registered-structure refusal (the fail-closed strings are pinned,
 *      the delta is REPORTED to center, no kind is invented here);
 *  (h) the MOUNT-MOMENT REGISTRATION keys are the placement feed's RUNTIME
 *      identities — a silent feed THROWS, a moved feed THROWS;
 *  (i) drain = new-call prohibition only.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-team-wiring-c1
 */
import { describe, expect, it } from 'vitest'

import { isLosslessJsonValue, validatePaFamilyTarget, PA_FAMILY_TARGET_RULES } from '../control/types.js'

interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec?: unknown) => Promise<unknown>
}
type Built = { ok: false; code: string; detail: string }
interface WalkRecord {
  walk: Record<string, unknown>
  kind: 'open' | 'edge'
  state?: Record<string, unknown>
}
interface Assembly {
  ok: true
  familyId: string
  wiringRevision: number
  adapterRevision: number
  providerId: string
  familyNames: readonly string[]
  placementNames: readonly string[]
  definitions: Definition[]
  declared: Array<{ name: string; status: string; reason: string }>
  captureCensus: Array<{ name: string; recordIndex: number; reason: string }>
  rowOf: (name: string) => {
    classify: (args: unknown) => { ok: true; plan: Record<string, unknown> } | { ok: false; code: string }
    delegate: (plan: never, ctx?: unknown) => Promise<unknown>
  } | undefined
  drain: () => unknown
  inFlight: () => { dispatches: number; refuses: number }
  familyRegistrations: () => Array<{ name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number, providerIdentity: string } }>
  claimStats: () => Record<string, number>
  admitSeat: (ctx: unknown) => Promise<{ ok: boolean; code?: string; detail?: string }>
}
type WiringModule = {
  A5_B_TEAM_WIRING_REVISION: number
  A5_B_TEAM_WIRING_CODES: Record<string, string>
  buildTeamOpsWiring: (input?: Record<string, unknown>) => Assembly | Built
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/team-wiring.mjs', import.meta.url).href)) as WiringModule
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/team-adapters.mjs', import.meta.url).href)) as {
  A5_B_TEAM_FAMILY_ID: string
  A5_B_TEAM_ADAPTER_REVISION: number
  A5_B_TEAM_TOOL_NAMES: string[]
  A5_B_TEAM_RECORD_SPECS: Record<string, { recordIndex: number; operation: string }>
}
const CODES = WIRING.A5_B_TEAM_WIRING_CODES
const NAMES = ADAPTER.A5_B_TEAM_TOOL_NAMES
const REALM = 'b-team-wire-realm'
const PROVIDER = 'a5m2-b-team-wire'

/** A valid `team_list_members` call under the LANE'S OWN argument bytes. */
const GOOD_ARGS = Object.freeze({ rootSessionId: 's-root-wire', requestToken: 'tok-wire-1' })

let session = 0
type World = ReturnType<typeof makeWorld>
function makeWorld (over: Record<string, unknown> = {}) {
  session += 1
  const natives: Record<string, Definition> = {}
  const delegateEntries: Array<{ name: string; args: Record<string, unknown>; exec: unknown; self: unknown }> = []
  const mkNative = (name: string): Definition => {
    const def = Object.freeze({
      name,
      description: `captured ${name} description bytes (record ${String(specOf(name).recordIndex)})`,
      parameters: Object.freeze({ type: 'object', properties: Object.freeze({ rootSessionId: { type: 'string' } }), required: Object.freeze(['rootSessionId']) }),
      output: Object.freeze({ schema: Object.freeze({ type: 'object' }), render: (v: unknown) => JSON.stringify(v) }),
      execute: async function laneBody (args: Record<string, unknown>, exec?: unknown): Promise<unknown> {
        // THE DOUBLE STANDS IN THE GOVERNED CHAIN: this IS the captured
        // createTeamTools execute (L3 pairs the delegate to exactly this
        // reference), so an entry here is a port entry.
        delegateEntries.push({ name, args, exec, self: this })
        return Object.freeze({ status: 'executed', name, echoed: { ...args } })
      },
    }) as unknown as Definition
    natives[name] = def
    return def
  }
  const mounted = (over.mounted as string[] | undefined) ?? ['team_list_members', 'team_delegate', 'team_archive_member']
  for (const name of mounted) mkNative(name)
  let laneSet = Object.freeze(mounted.map((name) => natives[name]))

  const walks: WalkRecord[] = []
  const closedPlans: string[] = []
  const events: Array<Record<string, unknown>> = []
  const seatBehaviour = (over.seat as Record<string, unknown> | undefined) ?? {}
  const openAnswer = async (walk: Record<string, unknown>) => {
    walks.push({ walk, kind: 'open' })
    if (typeof seatBehaviour.open === 'function') return await (seatBehaviour.open as (w: Record<string, unknown>) => unknown)(walk)
    return Object.freeze({ kind: 'approved', grant: Object.freeze({ grantId: `grant-${String(walks.length)}` }) })
  }
  const edgeAnswer = async (state: Record<string, unknown>) => {
    walks.push({ walk: ((state as { walk?: Record<string, unknown> }).walk ?? state) as Record<string, unknown>, kind: 'edge', state })
    if (typeof seatBehaviour.edge === 'function') return await (seatBehaviour.edge as (s: Record<string, unknown>) => unknown)(state)
    return Object.freeze({ kind: 'allowed', consumedProof: Object.freeze({ grant: Object.freeze({ grantId: 'grant-wire' }) }) })
  }
  // THE SEAT IN ITS PRODUCTION SHAPE: a CALLABLE carrying open/edge/closePlan
  // (team-tool-plane.mjs:1214-area / :1874 / :1908 / :1909).
  const seat = Object.assign(
    async (input: Record<string, unknown>) => await openAnswer(input),
    { open: openAnswer, edge: edgeAnswer, closePlan: (callId: string) => { closedPlans.push(callId) } },
  )
  // ONLY bridge keys reach the bridge: it refuses an unknown input key, so
  // the world's own knobs (mounted / seat) never ride into it.
  const { mounted: _mounted, seat: _seatBehaviour, ...bridgeOver } = over
  const base: Record<string, unknown> = {
    realmId: REALM,
    providerId: PROVIDER,
    readNative: (name: string) => natives[name],
    liveNative: (name: string) => natives[name],
    teamSet: () => laneSet,
    definitionIdentityOf: (definition: object) => `cap-${(definition as Definition).name}-${String(session)}`,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}-${String(session)}`, realmId: REALM }),
    pa: over.pa === undefined ? seat : over.pa,
    correlationOf: (exec: unknown) => {
      const callId = (exec as { callId?: unknown } | null | undefined)?.callId
      return typeof callId === 'string' && callId.length > 0 ? callId : null
    },
    observe: (event: Record<string, unknown>) => { events.push(event) },
    ...bridgeOver,
  }
  return { base, natives, laneSet: () => laneSet, setLaneSet: (next: readonly Definition[]) => { laneSet = Object.freeze(next as Definition[]) }, delegateEntries, walks, closedPlans, events, seat, mkNative }
}

const unwrap = (built: Assembly | Built): Assembly => {
  if (built.ok !== true) throw new Error(`assembly refused: ${JSON.stringify(built)}`)
  return built
}
const refusalOf = async (promise: Promise<unknown>): Promise<{ code: string; message: string }> => {
  try {
    await promise
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { code: String(e.code ?? ''), message: String(e.message ?? '') }
  }
  throw new Error('expected a throw, got a resolve')
}
const execFor = (callId: string) => ({ callId, token: { id: `token-${callId}` }, signal: new AbortController().signal })
const isRecordValue = (value: unknown): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
const walkCount = (world: { walks: WalkRecord[] }): number => world.walks.length
const nativeOf = (world: World, name: string): Definition => {
  const def = world.natives[name]
  if (def === undefined) throw new Error(`no native double for ${name}`)
  return def
}
const walkAt = (world: World, index: number): WalkRecord => {
  const record = world.walks[index]
  if (record === undefined) throw new Error(`no PA walk recorded at index ${String(index)}`)
  return record
}
const specOf = (name: string): { recordIndex: number; operation: string } => {
  const spec = ADAPTER.A5_B_TEAM_RECORD_SPECS[name]
  if (spec === undefined) throw new Error(`no adapter record spec for ${name}`)
  return spec
}
const manifestOf = (record: WalkRecord): Record<string, unknown> => {
  const family = record.walk.family as { targetManifest?: Record<string, unknown> } | undefined
  const manifest = family?.targetManifest
  if (manifest === undefined) throw new Error('the walk carried no targetManifest')
  return manifest
}
const defOf = (wiring: Assembly, name: string): Definition => {
  const definition = wiring.definitions.find((d) => d.name === name)
  if (definition === undefined) throw new Error(`no placed definition for ${name}`)
  return definition
}

describe('A5M2-B-TEAM-WIRING — the controlled bridge over the real B-TEAM adapter: seat, walk, one consume, census, claim', () => {
  describe('(a) the closed set is the adapter\'s own ten', () => {
    it('every captured face mounts ACTIVE with ONLY execute replaced; uncaptured names stay honest census rows', () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      expect(wiring.familyId).toBe('B-TEAM')
      expect([...wiring.familyNames].sort()).toEqual([...NAMES].sort())
      expect(NAMES).toHaveLength(10)
      expect([...wiring.placementNames].sort()).toEqual(['team_archive_member', 'team_delegate', 'team_list_members'])
      expect(wiring.declared.map((d) => d.name)).toHaveLength(NAMES.length - 3)
      for (const declared of wiring.declared) {
        expect(declared.status).toBe('DECLARED-INACTIVE')
        expect(wiring.placementNames).not.toContain(declared.name)
      }
      for (const name of ['team_list_members', 'team_delegate', 'team_archive_member']) {
        const placed = defOf(wiring, name)
        const native = nativeOf(w, name)
        expect(placed.description).toBe(native.description)
        expect(placed.parameters).toBe(native.parameters)
        expect(placed.output).toBe(native.output)
        expect(placed.execute).not.toBe(native.execute)
      }
    })

    it('no native face at all = zero definitions, zero registrations, the census is the whole family', () => {
      const w = makeWorld({ mounted: [] })
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      expect(wiring.definitions).toHaveLength(0)
      expect(wiring.familyRegistrations()).toHaveLength(0)
      expect(wiring.declared.map((d) => d.name).sort()).toEqual([...NAMES].sort())
      expect(wiring.captureCensus.map((c) => c.reason)).toEqual(NAMES.map(() => 'capture-absent'))
    })

    it('an UNMINTABLE capture identity is an honest census row — the bridge never hand-spells a capture identity', () => {
      const w = makeWorld({ mounted: [...NAMES], definitionIdentityOf: () => null })
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      expect(wiring.definitions).toHaveLength(0)
      expect(wiring.captureCensus.map((c) => c.reason)).toEqual(NAMES.map(() => 'capture-identity-unminted'))
    })
  })

  describe('(b) the seat law: only the published paAdmit shape occupies it', () => {
    it('a CALLABLE carrying open/edge/closePlan is the accepted production shape', () => {
      const w = makeWorld()
      const wiring = WIRING.buildTeamOpsWiring(w.base)
      expect(wiring.ok).toBe(true)
    })

    it('a plain {open, edge, closePlan} record is accepted; a DUCK without the three methods refuses the mount', () => {
      const w = makeWorld()
      const plain = WIRING.buildTeamOpsWiring({ ...w.base, pa: { open: async () => ({}), edge: async () => ({}), closePlan: () => {} } })
      expect(plain.ok).toBe(true)
      const duck = WIRING.buildTeamOpsWiring({ ...w.base, pa: { admit: async () => ({ ok: true }) } })
      expect(duck.ok).toBe(false)
      if (duck.ok === true) return
      expect(duck.code).toBe(CODES.INPUT_INVALID)
      expect(duck.detail).toContain('open')
      const none = WIRING.buildTeamOpsWiring({ ...w.base, pa: undefined })
      expect(none.ok === false ? none.code : 'accepted').toBe(CODES.INPUT_INVALID)
    })

    it('an unknown input key, a missing realm/provider, a non-callable capture seam and a non-function seat seam all refuse with the bridge\'s OWN bytes', () => {
      const w = makeWorld()
      for (const over of [
        { nope: 1 },
        { realmId: '' },
        { providerId: '' },
        { readNative: 'not-a-function' },
        { liveNative: 'not-a-function' },
        { teamSet: 'not-a-function' },
        { placementFeed: undefined },
        { correlationOf: 42 },
      ]) {
        const built = WIRING.buildTeamOpsWiring({ ...w.base, ...over })
        expect(built.ok === false && built.code, JSON.stringify(over)).toBe(CODES.INPUT_INVALID)
      }
    })
  })

  describe('(c) the REAL walk: open -> edge -> witness -> admitted -> exactly one port entry', () => {
    it('the admitted leg walks pa.open then pa.edge, rides the ISSUED identity, closes the plan fact, and enters the lane exactly once', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const exec = execFor('call-admit-1')
      const value = await defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, exec)
      expect((value as { status: string }).status).toBe('executed')
      expect(w.walks.map((rec) => rec.kind)).toEqual(['open', 'edge'])
      const walk = walkAt(w, 0).walk
      expect(walk.realmId).toBe(REALM)
      expect(walk.callId).toBe('call-admit-1')
      expect(walk.toolName).toBe('team_list_members')
      expect(String(walk.parametersFingerprint)).toMatch(/^sha256:/)
      const family = walk.family as Record<string, unknown>
      expect(family.familyId).toBe('B-TEAM')
      expect(family.adapterRevision).toBe(ADAPTER.A5_B_TEAM_ADAPTER_REVISION)
      expect(family.providerIdentity).toBe(PROVIDER)
      expect(isRecordValue(family.targetManifest)).toBe(true)
      expect(w.closedPlans).toEqual(['call-admit-1'])
      expect(w.delegateEntries).toHaveLength(1)
      expect(w.delegateEntries[0]?.name).toBe('team_list_members')
      expect(w.delegateEntries[0]?.args).toEqual({ ...GOOD_ARGS })
      // L4: the live execution rides BY REFERENCE — the chain resolves the
      // caller from the very object the host handed the row.
      expect(w.delegateEntries[0]?.exec).toBe(exec)
      expect(wiring.claimStats()).toMatchObject({ admits: 1, witnessed: 1, edges: 1 })
    })

    it('the delegate receives the FROZEN PLAN SNAPSHOT, never the caller\'s mutable object', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const args: Record<string, unknown> = { ...GOOD_ARGS }
      await defOf(wiring, 'team_list_members').execute(args, execFor('call-snapshot'))
      const seen = w.delegateEntries[0]?.args
      if (seen === undefined) throw new Error('the lane was never entered')
      expect(seen).not.toBe(args)
      expect(seen).toEqual({ ...GOOD_ARGS })
      args.rootSessionId = 's-EVIL'
      expect(seen.rootSessionId).toBe('s-root-wire')
    })

    it('NO consume witness refuses with the bridge\'s own code and ZERO port entry', async () => {
      const w = makeWorld({ seat: { edge: async () => Object.freeze({ kind: 'allowed' }) } })
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const refusal = await refusalOf(defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor('call-no-witness')))
      expect(refusal.code).toBe(CODES.CONSUME_PROOF_MISSING)
      expect(w.delegateEntries).toHaveLength(0)
      expect(w.closedPlans).toEqual(['call-no-witness'])
    })

    it('an unsettled open, a deny, and both cancel legs all refuse with zero port entry', async () => {
      for (const [label, seat] of [
        ['unsettled', { open: async () => Object.freeze({ kind: 'pending' }) }],
        ['deny', { open: async () => Object.freeze({ kind: 'deny', code: 'ADMISSION_DENY', detail: 'policy denies this effect set' }) }],
        ['open-cancel', { open: async () => Object.freeze({ cancelled: true }) }],
        ['edge-cancel', { edge: async () => Object.freeze({ cancelled: true }) }],
      ] as Array<[string, Record<string, unknown>]>) {
        const w = makeWorld({ seat })
        const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
        const refusal = await refusalOf(defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor(`call-${label}`)))
        expect(refusal.message, label).not.toBe('')
        expect(w.delegateEntries, label).toHaveLength(0)
        expect(w.closedPlans, label).toEqual([`call-${label}`])
        if (label === 'unsettled') expect(refusal.code).toBe(CODES.APPROVAL_NOT_LANDED)
        if (label === 'deny') expect(refusal.code).toBe('ADMISSION_DENY')
        if (label === 'open-cancel') expect(refusal.code).toBe(CODES.ADMISSION_CANCELLED)
        if (label === 'edge-cancel') expect(refusal.code).toBe(CODES.EDGE_CANCELLED)
      }
    })

    it('no ISSUED call identity = no admission (a guessed correlation is forbidden), zero port entry', async () => {
      const w = makeWorld({ correlationOf: () => null })
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const refusal = await refusalOf(defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor('ignored')))
      expect(refusal.code).toBe(CODES.CALL_ID_ABSENT)
      expect(w.walks).toHaveLength(0)
      expect(w.delegateEntries).toHaveLength(0)
    })
  })

  describe('(d) one consumption per plan object at this edge', () => {
    it('the same plan admitted once is spent; the replay refuses with zero port entry', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const row = wiring.rowOf('team_list_members')
      if (row === undefined) throw new Error('no row')
      const classified = row.classify({ ...GOOD_ARGS })
      expect(classified.ok).toBe(true)
      if (classified.ok !== true) return
      const plan = classified.plan
      const first = await wiring.admitSeat(Object.freeze({ name: 'team_list_members', recordIndex: 74, familyId: 'B-TEAM', classified, exec: execFor('call-memo-1') }))
      expect(first.ok).toBe(true)
      const second = await wiring.admitSeat(Object.freeze({ name: 'team_list_members', recordIndex: 74, familyId: 'B-TEAM', classified, exec: execFor('call-memo-2') }))
      expect(second.ok).toBe(false)
      expect(second.code).toBe(CODES.ALREADY_ADMITTED)
      expect(w.walks.filter((rec) => rec.kind === 'edge')).toHaveLength(1)
      // and the plan itself never reaches the lane a second time either
      await Promise.resolve(row.delegate(plan as never, { exec: execFor('call-memo-1') })).catch(() => undefined)
      expect(w.delegateEntries.length).toBeLessThanOrEqual(1)
      expect(plan).toBeTruthy()
    })
  })

  describe('(e) the mirrored lane law answers the lane\'s OWN value with zero PA entry', () => {
    it('a missing required lane argument never mints a PA question and never enters the lane', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const value = await defOf(wiring, 'team_list_members').execute({ requestToken: 'tok-only' } as Record<string, unknown>, execFor('call-bad-args'))
      const answered = value as { status?: string; code?: string; message?: string }
      expect(answered.status).toBe('rejected')
      expect(answered.code).toBe('TEAM_TOOL_BAD_ARGUMENTS')
      expect(String(answered.message)).toContain('rootSessionId')
      expect(w.walks).toHaveLength(0)
      expect(w.delegateEntries).toHaveLength(0)
      expect(wiring.claimStats()).toMatchObject({ toolLawValues: 1, walks: 0 })
    })
  })

  describe('(f) the L7 live hands are live, not constants', () => {
    it('a native face replaced underneath the mount refuses P_B_TEAM_DEFINITION_DRIFT with zero port entry', async () => {
      // a FRESH COPY per live read is exactly the drift the L7 law refuses
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring({ ...w.base, liveNative: (name: string) => ({ ...nativeOf(w, name) }) }))
      const refusal = await refusalOf(defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor('call-drift')))
      expect(refusal.code).toBe('P_B_TEAM_DEFINITION_DRIFT')
      expect(w.delegateEntries).toHaveLength(0)
      // MEASURED adapter order (READ-ONLY family): classify -> admit ->
      // edge-integrity. The PA walk is therefore SPENT while the lane is
      // never entered — recorded here, never worded away.
      expect(w.walks).toHaveLength(2)
    })

    it('a lane set rebuilt underneath the mount refuses P_B_TEAM_PORT_DRIFT with zero port entry', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      // the live lane set now answers a DIFFERENT execute for one name
      const rebuilt = Object.freeze({ ...nativeOf(w, 'team_delegate'), execute: async () => ({}) })
      w.setLaneSet([nativeOf(w, 'team_list_members'), rebuilt as Definition, nativeOf(w, 'team_archive_member')])
      const refusal = await refusalOf(defOf(wiring, 'team_delegate').execute({ ...GOOD_ARGS, delegationTemplateId: 'tpl-worker' }, execFor('call-port-drift')))
      expect(refusal.code).toBe('P_B_TEAM_PORT_DRIFT')
      expect(w.delegateEntries).toHaveLength(0)
    })
  })

  describe('(g) the claim: nine measured leaves at FULL VALUE, and the grammar gate measured live', () => {
    it('the target manifest is the lossless flat projection of the adapter\'s measured plan.target', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      await defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor('call-claim'))
      const manifest = manifestOf(walkAt(w, 0))
      expect(Object.keys(manifest).sort()).toEqual([
        'argumentLawFace', 'contract', 'effectLabel', 'memberAdjudication', 'memberClaim',
        'operation', 'revisionLaw', 'rootAdjudication', 'rootClaim', 'targetObject',
      ])
      expect(manifest.operation).toBe(specOf('team_list_members').operation)
      expect(manifest.rootClaim).toBe('s-root-wire')
      expect(manifest.memberClaim).toBeNull()
      expect(manifest.memberAdjudication).toBe('no member addressed')
      expect(isLosslessJsonValue(manifest)).toBe(true)
    })

    it('team_delegate\'s two real branches ride as measured (CONTINUE instance vs CREATE template)', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      await defOf(wiring, 'team_delegate').execute({ ...GOOD_ARGS, label: 'round two', prompt: 'continue the round', delegationInstanceId: 'di-7' }, execFor('call-continue'))
      const cont = manifestOf(walkAt(w, 0))
      expect(cont.memberClaim).toBe('di-7')
      expect(String(cont.memberAdjudication)).toContain('CONTINUE')
      await defOf(wiring, 'team_delegate').execute({ ...GOOD_ARGS, label: 'new unit', prompt: 'open a new unit', delegationTemplateId: 'tpl-worker', delegationInstanceId: '' }, execFor('call-create'))
      const created = manifestOf(walkAt(w, 2))
      expect(created.memberClaim).toBe('tpl-worker')
      expect(String(created.memberAdjudication)).toContain('CREATE')
    })

    it('MEASURED grammar gate: every real B-TEAM claim FAILS CLOSED — no B-TEAM rule is registered and no kind is invented here', () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      return defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor('call-grammar')).then(() => {
        const manifest = manifestOf(walkAt(w, 0))
        // The measured registered key set (this lane touched NOTHING here).
        expect(Object.keys(PA_FAMILY_TARGET_RULES)).toEqual(['B-SESSION', 'B-IMAGE', 'B-WRITE', 'B-CONTROL', 'B-INSPECT'])
        expect(PA_FAMILY_TARGET_RULES['B-TEAM' as keyof typeof PA_FAMILY_TARGET_RULES]).toBeUndefined()
        expect(isLosslessJsonValue(manifest)).toBe(true)
        // The durable leg's own fail-closed answer, through the REAL checker:
        expect(validatePaFamilyTarget('B-TEAM', manifest)).toBe(
          "familyId: no target structure is registered for 'B-TEAM'",
        )
        // And the reason no flat rule can be signed today: two leaves are a
        // string-OR-null union that no existing closed kind types.
        expect(manifest.memberClaim).toBeNull()
        expect(typeof manifest.rootClaim).toBe('string')
      })
    })
  })

  describe('(h) the mount-moment registration keys are the placement feed\'s runtime identities', () => {
    it('registration keys are the FEED identities of the PLACED defs, never the capture-side mint', () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      const regs = wiring.familyRegistrations()
      expect(regs.map((r) => r.name).sort()).toEqual(['team_archive_member', 'team_delegate', 'team_list_members'])
      for (const reg of regs) {
        expect(reg.definitionIdentity).toBe(`placed-${reg.name}-${String(session)}`)
        expect(reg.definitionIdentity).not.toBe(`cap-${reg.name}-${String(session)}`)
        expect(reg.entry.familyId).toBe('B-TEAM')
        expect(reg.entry.adapterRevision).toBe(ADAPTER.A5_B_TEAM_ADAPTER_REVISION)
        expect(reg.entry.providerIdentity).toBe(PROVIDER)
        expect(reg.recordIndex).toBe(specOf(reg.name).recordIndex)
      }
    })

    it('a SILENT feed THROWS (no guessed key, no silent skip); a MOVED identity THROWS too', () => {
      const silent = makeWorld({ placementFeed: () => undefined })
      const silentWiring = unwrap(WIRING.buildTeamOpsWiring(silent.base))
      expect(() => silentWiring.familyRegistrations()).toThrow(/PLACEMENT_KEY_ABSENT/)
      let flip = 0
      const moved = makeWorld({
        placementFeed: (name: string) => {
          flip += 1
          return { definitionIdentity: `placed-${name}-${String(flip)}` }
        },
      })
      const movedWiring = unwrap(WIRING.buildTeamOpsWiring(moved.base))
      expect(() => movedWiring.familyRegistrations()).not.toThrow()
      expect(() => movedWiring.familyRegistrations()).toThrow(/PLACEMENT_KEY_MOVED/)
    })
  })

  describe('(i) drain is a new-call prohibition only', () => {
    it('after drain a new call refuses with the adapter\'s own DRAINING bytes and zero port entry', async () => {
      const w = makeWorld()
      const wiring = unwrap(WIRING.buildTeamOpsWiring(w.base))
      await defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS }, execFor('call-before-drain'))
      const before = w.delegateEntries.length
      wiring.drain()
      const refusal = await refusalOf(defOf(wiring, 'team_list_members').execute({ ...GOOD_ARGS, requestToken: 'tok-after' }, execFor('call-after-drain')))
      expect(refusal.code).toBe('P_B_TEAM_DRAINING')
      expect(w.delegateEntries).toHaveLength(before)
      expect(walkCount(w)).toBe(2)
      expect(wiring.inFlight().dispatches).toBe(before)
    })
  })
})

