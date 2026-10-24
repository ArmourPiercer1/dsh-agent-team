/**
 * A5M2-B-TEAM-PLANE-MOUNT (the house proof shape is
 * a5m2-g6-plane-mount-c1) — the spec of the B-TEAM member-operation blocks
 * THIS lane owns in `team-tool-plane.mjs` (the injection law, the issued call
 * identity, the REAL `paAdmit` seat, the claim face, the teardown drain) and
 * of the mount law the paired agent-bindings blocks enable (claim ->
 * placement -> post-publish registration at the shared fill point). The plane
 * is the REAL `createTeamToolPlaneAssembly`; the seat is the REAL plane-owned
 * `paAdmit` (the callable carrying open/edge/closePlan — never a stand-in);
 * the admission kernel, its Part A, the one-shot `consumeForExecution` edge
 * and the grant identity are REAL; the registry is the PRODUCTION
 * `pa-mount-registry`; the placement identity is the REAL `definitionIdentityOf`
 * mint over the object the registration owner placed.
 *
 * Legs:
 *  (a) ZERO FLIP: no `backends.teamOps` = no wiring face (omitted, not
 *      undefined) and no member-operation placement — the ordinary mount is
 *      byte-identical to the pre-B-TEAM plane;
 *  (b) the injection law: defective owner evidence refuses the MOUNT with
 *      this block's typed code (config is law, not wiring);
 *  (c) REAL claim face + placement + production registry round-trip: the
 *      placed rows are the complete captured faces with ONLY execute replaced;
 *      the family keys are the PLACEMENT identities read through the owner's
 *      lazy feed — NEVER the capture-side mint — and they round-trip
 *      `registerA5GovernedFamily` / `a5GovernedFamilyFor`;
 *  (d) REAL fail-closed walk: with NO control leg the real Part A answers its
 *      OWN `APPROVAL_REQUEST_UNAVAILABLE`, the plane-ISSUED identity
 *      (`team-<instance>-b-team-…`) is visible in the observed line, zero lane
 *      entries, the native body never runs;
 *  (e) REAL admitted consume on the policy-allow lane: the kernel admits, the
 *      REAL `consumeForExecution` edge lands the one-shot proof, the family
 *      block rode the leg at FULL VALUE, the lane is entered EXACTLY ONCE with
 *      the frozen plan snapshot and the execution BY REFERENCE, and a re-used
 *      execution token gets the single-flight refusal with zero extra entries;
 *  (f) teardown: dispose drains the bridge (the adapter's own DRAINING bytes
 *      refuse a new call) and releases the issued-identity ledger;
 *  (g) honest census: a native face this build does not carry keeps its
 *      NATIVE — no definition, no placement, no registration.
 *
 * DISCLOSED STAND-INS: the ten native tool faces are recording doubles (the
 * adapter spec owns the real createTeamTools pairing — its delegate IS this
 * same captured execute, so a lane entry here is exactly one port entry); the
 * durable Control ROW half of the leg is the kernel's OWN
 * `issueApprovedGrant` driven with the kernel's own plan facts, the same
 * disclosed shape the sibling specs use. The PLANE, its `paAdmit`, the
 * admission kernel and consume edge, the placement identity and the registry
 * are the real production code. NOT C2 — no Host, no ports, no tests/homes,
 * no network; the four-tier row for B-TEAM stays 未接线 until a Host-accepted
 * acceptance leg lands, and nothing here claims it.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-team-plane-mount-c1
 */
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'

const REALM = 'b-team-plane-realm'
const PROVIDER = 'b-team-plane-provider'
const LIST_TOOL = 'team_list_members'
const ARCHIVE_TOOL = 'team_archive_member'
/** Calls that pass the LANE'S OWN argument bytes (the adapter's mirrored law). */
const LIST_ARGS: Record<string, unknown> = { rootSessionId: 's-root-plane', requestToken: 'tok-plane-1' }
const ARCHIVE_ARGS: Record<string, unknown> = { rootSessionId: 's-root-plane', requestToken: 'tok-plane-2', targetInstanceId: 'mi-9' }

interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec?: unknown) => Promise<unknown>
}
interface MountResult { ok: boolean; code?: string; message?: string; dispose?: () => void }
interface TeamOpsFace {
  familyId: string
  adapterRevision: number
  providerIdentity: string
  placementNames: string[]
  definitions: Definition[]
  declared: Array<{ name: string; status: string }>
  captureCensus: Array<{ name: string; reason: string }>
  familyRegistrations: () => Array<{ name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }>
}
interface PlaneAssembly {
  mount: (agentCtx: unknown) => MountResult
  teamOps?: TeamOpsFace
}
interface Built {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssembly
}

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: Record<string, unknown>) => void
  a5GovernedFamilyFor: (key: string) => Record<string, unknown> | undefined
  readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<unknown>
}
const createTeamToolPlaneAssembly = PLANE_ROW.createTeamToolPlaneAssembly
const { registerA5GovernedFamily, a5GovernedFamilyFor, readPaCallFactsForCall } = REGISTRY

const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })
const POLICY_ALLOW_ATTEMPT = Object.freeze({
  default: 'ask',
  allow: [
    Object.freeze({ tool: LIST_TOOL, resource: { kind: 'any' } }),
    Object.freeze({ tool: ARCHIVE_TOOL, resource: { kind: 'any' } }),
  ],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane (extra: Record<string, unknown> = {}, sink: string[] = [], policy: Record<string, unknown> = POLICY_ASK): Built {
  return createTeamToolPlaneAssembly({
    teamSessionId: 'b-team-plane-team',
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'b-team-tpl',
    role: 'leader',
    instanceId: 'b-team-instance',
    onObserve: (row: unknown) => sink.push(String(row)),
    ...extra,
  })
}

interface LegPlan { approvalCaseId: string, effectSetFingerprint: string, requiredAuthority?: string, deniedEffects?: unknown }
interface LegAssembly { issueApprovedGrant: (request: unknown, approval: unknown) => Promise<{ ok: boolean, value?: unknown, error?: { message?: string } }> }
/**
 * The control-leg SEAM double: the kernel's OWN landing (`assembly.
 * issueApprovedGrant`, the edge the AUTH bridge uses) driven with an approval
 * composed from the kernel's own plan facts — the durable Control ROW half is
 * what stands in here (the house acceptance kit owns that half against a real
 * Control service; this spec pins the PLANE + kernel half). The plane's Part
 * A, the one-shot `consumeForExecution` edge, the grant identity and the
 * plan-fact lifecycle are all REAL. The `seen` ledger records WHAT FAMILY
 * BLOCK the leg received, so the 载荷法 claim is measured, not asserted.
 */
function mintingControlLeg (seen: Array<Record<string, unknown> | undefined>) {
  return async (input: { request: unknown, family?: Record<string, unknown>, plan: LegPlan, assembly: LegAssembly }): Promise<Record<string, unknown>> => {
    seen.push(input.family)
    const plan = input.plan
    const approval = Object.freeze({
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority: 'human-user',
      beneficiaryAuthority: 'leader',
      requiredAuthorityAtCreation: plan.requiredAuthority ?? 'leader',
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: 0,
      ...(plan.deniedEffects === undefined ? {} : { deniedEffectsAtCreation: plan.deniedEffects }),
    })
    const issued = await input.assembly.issueApprovedGrant(input.request, approval)
    if (issued.ok !== true || issued.value === undefined) {
      return { decision: 'deny', detail: `the kernel refused the mint (${String(issued.error?.message ?? 'unknown')})` }
    }
    return { decision: 'approve', requestId: 'b-team-spec-control-row-1', approval, grant: issued.value, manifest: null }
  }
}

/** The lane doubles: the SAME objects are the capture source, the live read
 *  and the delegate port — exactly the L3 pairing the adapter enforces (the
 *  delegate IS the captured execute), so one entry here is one port entry. */
function makeLane (opts: { withQueryFacts?: boolean, missing?: string[] } = {}) {
  const missing = new Set(opts.missing ?? [])
  const lane: Definition[] = []
  const entries: Array<{ name: string; args: Record<string, unknown>; exec: unknown }> = []
  for (const name of [LIST_TOOL, ARCHIVE_TOOL]) {
    if (missing.has(name)) continue
    lane.push(Object.freeze({
      name,
      description: `lane ${name} description bytes`,
      parameters: Object.freeze({ type: 'object', properties: Object.freeze({ rootSessionId: { type: 'string' } }), required: Object.freeze(['rootSessionId']) }),
      output: Object.freeze({ schema: Object.freeze({ type: 'object' }), render: (value: unknown) => JSON.stringify(value) }),
      async execute (args: Record<string, unknown>, exec?: unknown): Promise<unknown> {
        entries.push({ name, args, exec })
        return Object.freeze({ status: 'executed', name, served: `${name}-bytes` })
      },
    }) as unknown as Definition)
  }
  // The placement owner's record (what agent-bindings' placementFeed reads:
  // the definition the scoped layer answers under this name).
  const placedByName = new Map<string, Definition>()
  const withQueryFacts = opts.withQueryFacts !== false
  const inject = Object.freeze({
    providerId: PROVIDER,
    // The published durable reads the QUERY rows mint their target leaves
    // from (content-bearing rows; the fingerprint is a digest of the id set).
    ...(withQueryFacts === false ? {} : {
      queryFacts: Object.freeze({
        resolve: (name: string) => (name === 'team_list_templates'
          ? { templateIds: ['tpl-worker'] }
          : name === 'team_inspect_config'
            ? { memberTemplateId: 'tpl-worker', memberChildSessionId: 's-child-mi9' }
            : { rosterMemberIds: ['mi-9'], rosterFingerprint: 'sha256:mi-9' }),
      }),
    }),
    readNative: (name: string) => lane.find((def) => def.name === name),
    liveNative: (name: string) => lane.find((def) => def.name === name),
    teamSet: () => lane,
    definitionIdentityOf,
    placementFeed: (name: string) => {
      const placed = placedByName.get(name)
      if (placed === undefined) return undefined
      const identity = definitionIdentityOf(placed)
      return identity === null ? undefined : Object.freeze({ definitionIdentity: identity, realmId: REALM })
    },
  })
  return { lane, entries, inject, placedByName }
}

const fakeAgentCtx = (registered: string[]) => ({
  tools: {
    register: (def: Definition) => {
      registered.push(def.name)
      return () => { /* disposer */ }
    },
  },
})

/** The paired agent-bindings sequence, in the order the real setup runs it:
 *  mount the plane -> place the governed rows -> register the family at the
 *  fill point using the placement feed's runtime identities. */
function placeAndRegister (built: Built, lane: ReturnType<typeof makeLane>, registered: string[]): { keys: string[]; dispose: () => void } {
  const mounted = built.value?.mount(fakeAgentCtx(registered))
  if (mounted === undefined || mounted.ok !== true) throw new Error(`mount refused: ${String(mounted?.code)} ${String(mounted?.message)}`)
  const dispose = mounted.dispose
  if (typeof dispose !== 'function') throw new Error('the mount surfaced no dispose handle')
  const face = built.value?.teamOps
  if (face === undefined) throw new Error('no teamOps face to place')
  const keys: string[] = []
  for (const definition of face.definitions) {
    registered.push(definition.name)
    lane.placedByName.set(definition.name, definition)
  }
  for (const registration of face.familyRegistrations()) {
    registerA5GovernedFamily(registration.definitionIdentity, registration.entry as unknown as Record<string, unknown>)
    keys.push(registration.definitionIdentity)
  }
  return { keys, dispose }
}

const refusalOf = async (promise: Promise<unknown>): Promise<{ code: string; message: string }> => {
  try {
    await promise
    throw new Error('expected a refusal, got a resolve')
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { code: String(e.code ?? ''), message: String(e.message ?? '') }
  }
}
const faceOf = (built: Built): TeamOpsFace => {
  const face = built.value?.teamOps
  if (face === undefined) throw new Error('the plane surfaced no B-TEAM claim face')
  return face
}
const defOf = (face: TeamOpsFace, name: string): Definition => {
  const definition = face.definitions.find((candidate) => candidate.name === name)
  if (definition === undefined) throw new Error(`no placed definition for ${name}`)
  return definition
}

describe('A5M2-B-TEAM-PLANE-MOUNT — the B-TEAM block in the REAL plane: inject, seat, claim, placement, teardown', () => {
  describe('(a) zero flip', () => {
    it('with no backends.teamOps there is no face, no member-operation placement and no refusal', () => {
      const sink: string[] = []
      const built = buildPlane({}, sink)
      expect(built.ok).toBe(true)
      const value = built.value
      if (value === undefined) throw new Error('the assembly surfaced no value')
      expect('teamOps' in value).toBe(false)
      const registered: string[] = []
      const mounted = value.mount(fakeAgentCtx(registered))
      expect(mounted.ok).toBe(true)
      expect(registered).not.toContain(LIST_TOOL)
      expect(registered).not.toContain(ARCHIVE_TOOL)
      mounted.dispose?.()
    })
  })

  describe('(b) the injection law', () => {
    it('defective owner evidence refuses the MOUNT with this block\'s typed code', () => {
      const lane = makeLane()
      for (const [label, patch] of [
        ['no providerId', { providerId: '' }],
        ['no capture seam', { readNative: undefined }],
        ['no live re-read', { liveNative: undefined }],
        ['no lane set', { teamSet: undefined }],
        ['no identity mint', { definitionIdentityOf: undefined }],
        ['no placement feed', { placementFeed: undefined }],
      ] as Array<[string, Record<string, unknown> | undefined]>) {
        const inject = Object.freeze({ ...Object.fromEntries(Object.entries(lane.inject).filter(([key]) => key !== 'providerId')), providerId: PROVIDER, ...patch })
        const built = buildPlane({ backends: { teamOps: inject } })
        expect(built.ok === false ? built.code : 'accepted', label).toBe('TEAM_OPS_ARM_INJECT_INVALID')
      }
    })
  })

  describe('(c) the claim face, the placement and the production registry', () => {
    it('the placed rows are the captured faces with ONLY execute replaced, and the family keys are the PLACEMENT identities', () => {
      const lane = makeLane()
      const sink: string[] = []
      const built = buildPlane({ backends: { teamOps: lane.inject } }, sink)
      expect(built.ok).toBe(true)
      const face = faceOf(built)
      expect(face.familyId).toBe('B-TEAM')
      expect(face.providerIdentity).toBe(PROVIDER)
      expect([...face.placementNames].sort()).toEqual([ARCHIVE_TOOL, LIST_TOOL])
      const registered: string[] = []
      const { keys, dispose } = placeAndRegister(built, lane, registered)
      expect(keys).toHaveLength(2)
      for (const name of [LIST_TOOL, ARCHIVE_TOOL]) {
        const placed = defOf(face, name)
        const native = lane.lane.find((def) => def.name === name)
        expect(native).toBeDefined()
        if (native === undefined) throw new Error(`no lane double for ${name}`)
        expect(placed.description).toBe(native.description)
        expect(placed.output).toBe(native.output)
        expect(placed.execute).not.toBe(native.execute)
        expect(registered).toContain(name)
        // the registration key is the placement identity of the PLACED object
        const placementKey = definitionIdentityOf(placed)
        expect(keys).toContain(placementKey)
        const entry = a5GovernedFamilyFor(String(placementKey))
        expect(entry).toBeDefined()
        expect((entry as { familyId?: string }).familyId).toBe('B-TEAM')
        expect((entry as { providerIdentity?: string }).providerIdentity).toBe(PROVIDER)
      }
      dispose()
    })
  })

  describe('(d) the REAL fail-closed walk (no control leg mounted)', () => {
    it('the plane\'s own Part A refuses with its own bytes; the lane is never entered', async () => {
      const lane = makeLane()
      const sink: string[] = []
      const built = buildPlane({ backends: { teamOps: lane.inject } }, sink)
      const face = faceOf(built)
      const { dispose } = placeAndRegister(built, lane, [])
      const refusal = await refusalOf(defOf(face, LIST_TOOL).execute({ ...LIST_ARGS }, { callId: 'host-call-1', token: { id: 'token-d' }, signal: new AbortController().signal }))
      expect(refusal.code).toBe('APPROVAL_REQUEST_UNAVAILABLE')
      expect(lane.entries).toHaveLength(0)
      // THE ISSUED IDENTITY IS THE PLANE'S (a5p5 mount law), not a guess:
      // the observed PA line carries the per-mount `…-b-team-…` correlation.
      expect(sink.some((row) => row.includes('b-team'))).toBe(true)
      dispose()
    })
  })

  describe('(e) the REAL admitted consume', () => {
    it('the kernel admits, the one-shot edge lands, the family rides at full value, the lane runs exactly once', async () => {
      const lane = makeLane()
      const sink: string[] = []
      const seen: Array<Record<string, unknown> | undefined> = []
      const built = buildPlane({ controlLeg: mintingControlLeg(seen), backends: { teamOps: lane.inject } }, sink, POLICY_ASK)
      expect(built.ok === true ? 'ok' : `${String(built.code)} ${String(built.message)}`).toBe('ok')
      const face = faceOf(built)
      const { dispose } = placeAndRegister(built, lane, [])
      const exec = { callId: 'host-call-2', token: { id: 'token-e' }, signal: new AbortController().signal }
      const value = await defOf(face, LIST_TOOL).execute({ ...LIST_ARGS }, exec)
      expect((value as { served?: string }).served).toBe(`${LIST_TOOL}-bytes`)
      expect(lane.entries).toHaveLength(1)
      expect(lane.entries[0]?.name).toBe(LIST_TOOL)
      expect(lane.entries[0]?.args).toEqual({ ...LIST_ARGS })
      // L4: the live execution rides BY REFERENCE into the delegated chain.
      expect(lane.entries[0]?.exec).toBe(exec)
      // 载荷法: the family block that reached the leg is the adapter's own
      // facts plus the flat measured target projection.
      const family = seen[0] as Record<string, unknown> | undefined
      expect(family).toBeDefined()
      expect((family as { familyId?: string }).familyId).toBe('B-TEAM')
      const manifest = (family as { targetManifest?: Record<string, unknown> }).targetManifest
      expect(manifest?.rootClaim).toBe('s-root-plane')
      expect(manifest?.memberClaim).toBeNull()
      expect(manifest?.memberAdjudication).toBe('no member addressed')
      // the single-flight law (a5p5): the SAME execution token never buys a
      // second governed call.
      const replay = await refusalOf(defOf(face, ARCHIVE_TOOL).execute({ ...ARCHIVE_ARGS }, exec))
      expect(replay.message).not.toBe('')
      expect(lane.entries).toHaveLength(1)
      dispose()
    })
  })

  describe('(e2) the policy-ALLOW lane is MEASURED, not assumed', () => {
    it('a team-tool ALLOW rule projects per the root 22:4x invocation-only law and serves through the kernel — and the admitted token still buys no replay', async () => {
      const lane = makeLane()
      const sink: string[] = []
      const built = buildPlane({ backends: { teamOps: lane.inject } }, sink, POLICY_ALLOW_ATTEMPT)
      // QUALIFIED BY THE CENTER E2 NARROWING (root ruling: narrow per commit,
      // qualify, fix on int). The MOUNT-time TOOL_BINDING_UNVERIFIED this leg
      // once measured was real in its world: team_* names were then absent
      // from PERMISSION_TOOL_NAMES, so deriveTeamPolicyAuthority refused the
      // rule at admission-kernel.ts:822 before any row existed. ROOT'S OWN
      // limited cards superseded that world — 830c80456 (root 20:05, the
      // schedule pair) created the invocation-only class and 2d8e39f7b (root
      // 22:4x) added the B-TEAM ten to the production-confirmed closed sets:
      // `any` is legal in ALL THREE lanes and the rule IS the invocation
      // authority on the `tool-invoke` arm alone (blueprint schema.ts:515,
      // admission-kernel.ts:867). Mount acceptance is therefore CURRENT
      // root law, not a lane relaxation. And the law MEASURED at the
      // execution layer is the other half of the same card: for the
      // invocation-only class the RULE IS the invocation authority — the
      // projected allow arm admits through the kernel itself, so an
      // allow-projected call RUNDS the full governed walk (classify → kernel
      // admit on the projected arm → one-shot edge → row) and serves, while
      // the NO-RULE world stays fail-closed — pinned by (d) one describe
      // above with the plane's own APPROVAL_REQUEST_UNAVAILABLE bytes.
      // MEASURED HERE: the allow authority really lands (served bytes,
      // exactly one lane entry, no control leg anywhere) AND the
      // single-flight law still holds over the admitted execution token —
      // an allow rule is a standing authority, never a replay licence.
      expect(built.ok === true ? 'ok' : `${String(built.code)} ${String(built.message)}`).toBe('ok')
      const face = faceOf(built)
      const { dispose } = placeAndRegister(built, lane, [])
      const exec = { callId: 'host-call-e2', token: { id: 'token-e2' }, signal: new AbortController().signal }
      const value = await defOf(face, LIST_TOOL).execute({ ...LIST_ARGS }, exec)
      expect((value as { served?: string }).served).toBe(`${LIST_TOOL}-bytes`)
      expect(lane.entries).toHaveLength(1)
      const replay = await refusalOf(defOf(face, ARCHIVE_TOOL).execute({ ...ARCHIVE_ARGS }, exec))
      expect(replay.message).not.toBe('')
      expect(lane.entries).toHaveLength(1)
      dispose()
    })
  })

  describe('(e3) the REAL call-facts entry (root 19:53 ①)', () => {
    it('the plane hands the PRODUCTION entry the real placement name, and fail-closes when no carrier is published', async () => {
      const lane = makeLane()
      const sink: string[] = []
      // The PRODUCTION entry (agent-bindings wires exactly this function at
      // :3306), wrapped only to RECORD what the plane actually passed it.
      const seen: Array<Record<string, unknown>> = []
      const readCallFacts = async (input: Record<string, unknown>): Promise<unknown> => {
        seen.push(input)
        return await readPaCallFactsForCall(input)
      }
      const built = buildPlane({ readCallFacts, backends: { teamOps: lane.inject } }, sink, POLICY_ASK)
      expect(built.ok === true ? 'ok' : `${String(built.code)} ${String(built.message)}`).toBe('ok')
      const face = faceOf(built)
      const { dispose } = placeAndRegister(built, lane, [])
      const refusal = await refusalOf(defOf(face, LIST_TOOL).execute({ ...LIST_ARGS }, { callId: 'host-call-facts', token: { id: 'token-facts' }, signal: new AbortController().signal }))
      expect(seen.length, 'the real entry was reached').toBeGreaterThan(0)
      // ROOT 19:53 ①: before this fix the resolver answered NO placement name
      // for a member-operation spelling, so the entry could not resolve the
      // binding family at all. The plane now hands it the mounted spelling.
      expect(seen[0]?.placementName).toBe(LIST_TOOL)
      expect(typeof seen[0]?.callId).toBe('string')
      // Nothing published a mount carrier for this world, so the REAL entry
      // answers with its own refusal path and the edge fails closed on the
      // kernel's identity code — never a `plane-row:` stand-in, zero lane entry.
      expect(refusal.code).toBe('TOOL_BINDING_UNVERIFIED')
      // The refusal text is the kernel's OWN entry path (the call-level facts
      // entry could not answer), and its wording states the rule: no admission
      // is opened on an identity that was never read, never a stand-in row.
      expect(refusal.message).toContain('could not be answered by the call-level facts entry')
      expect(lane.entries).toHaveLength(0)
      dispose()
    })
  })

  describe('(f) teardown', () => {
    it('dispose drains the bridge — the adapter\'s own DRAINING bytes refuse a new call', async () => {
      const lane = makeLane()
      const built = buildPlane({ backends: { teamOps: lane.inject } })
      const face = faceOf(built)
      const { dispose } = placeAndRegister(built, lane, [])
      dispose()
      const refusal = await refusalOf(defOf(face, LIST_TOOL).execute({ ...LIST_ARGS, requestToken: 'tok-after' }, { callId: 'host-call-3', token: { id: 'token-f' }, signal: new AbortController().signal }))
      expect(refusal.code).toBe('P_B_TEAM_DRAINING')
      expect(lane.entries).toHaveLength(0)
    })
  })

  describe('(g) honest census', () => {
    it('a native face this build does not carry keeps its native: no definition, no placement, no registration', () => {
      const lane = makeLane({ missing: [ARCHIVE_TOOL] })
      const sink: string[] = []
      const built = buildPlane({ backends: { teamOps: lane.inject } }, sink)
      expect(built.ok).toBe(true)
      const face = faceOf(built)
      expect(face.placementNames).toEqual([LIST_TOOL])
      expect(face.definitions.map((def) => def.name)).toEqual([LIST_TOOL])
      expect(face.captureCensus.some((row) => row.name === ARCHIVE_TOOL && row.reason === 'capture-absent')).toBe(true)
      const registered: string[] = []
      const { keys, dispose } = placeAndRegister(built, lane, registered)
      expect(keys).toHaveLength(1)
      expect(registered).not.toContain(ARCHIVE_TOOL)
      expect(face.familyRegistrations().map((row) => row.name)).toEqual([LIST_TOOL])
      dispose()
    })
  })
})
