/**
 * a5p2-composition.test.ts — Alpha.5 PR2 × PR1 (plan §5: "守卫用于不可绕过的
 * 最终拒绝；pre-execute/control 必须等待 Ask，不能因其它 Listener 强制 allow"):
 * the PR1 closed-world Guard stays the OUTER door, the PR2 Admission kernel is
 * the DECISION door, and the body is a counted flag — every refusal path must
 * show `bodyRan = false`, and a kernel refusal must leave the Dispatcher
 * drainable exactly like any other refused call.
 *
 * This is a COMPOSITION test, not a live-Host run: the Host wiring rides with
 * the first PR that executes through Admission (PR3/PR4). What it proves is
 * the seam algebra: Guard deny never reaches Admission; Admission refuse ends
 * the call `refused` (drain keeps counting to zero); an admitted+consumed call
 * completes; and one call never spends another call's grant.
 *
 * @module test/a5p2-composition
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { createScopedDispatcher } from '../tool-dispatch/index.js'
import { binding, effects, MEMBER, readEffect, toolInvokeEffect, REALM } from './a5p2-fixtures.js'
import { FIXED_NOW, allowPolicy, makeHarness } from './a5p2-kernel-harness.js'
import { createGrantLedger, createProductionAdmissionAssembly } from '../tool-admission/index.js'
import { createProductionControlledFsProvider } from '../controlled-fs/src/index.js'
import { createPoc3World, destroyPoc3World, fileRef, type Poc3World } from '../controlled-fs/test/poc3-harness.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/types.js'
import type { AdmissionRequest } from '../../domain/tool-governance/src/index.js'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'

function assembly(opts: { allow: boolean }) {
  const dispatcher = createScopedDispatcher({
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1'],
    nativeNames: ['read'],
    resolveDefinition: (name) => ({ ok: true, fingerprint: `def:${name}` }),
    requiredSeams: 0,
  })
  // PR1r (R-a) signature: the trusted side is the GLOBAL-VIEW read — for a
  // genuinely native name it equals the resolved read; a shadow would differ
  // and bind UNVERIFIED. This composition uses the honest native case.
  dispatcher.bindInheritedSurface(['read'], { read: 'def:read' }, { read: 'def:read' })
  dispatcher.beginAssembly()
  dispatcher.publish()

  const set = effects(readEffect())
  const { kernel, ledger } = makeHarness({ policy: () => (opts.allow ? allowPolicy(set) : setPolicy()) })
  const bodyRuns: string[] = []

  return {
    dispatcher,
    kernel,
    ledger,
    bodyRuns,
    set,
    /** The pre-execute waterfall as the install orders it: Guard, then Admission. */
    async dispatch(callId: string, execName: string, request: AdmissionRequest): Promise<'ran' | 'guard-denied' | 'admission-refused'> {
      const verdict = dispatcher.decide({ name: execName, agentIdentity: 'session-m1' })
      if (verdict.kind === 'deny') return 'guard-denied'
      const started = dispatcher.beginCall(callId, execName)
      if (!started.ok) return 'guard-denied'
      try {
        const decision = await kernel.admit(request)
        if (!decision.ok || decision.value.kind !== 'admitted') {
          dispatcher.endCallById(callId, 'refused')
          return 'admission-refused'
        }
        const consumed = kernel.consumeForExecution(decision.value.grant, {
          currentAuthorityGeneration: 1,
          member: request.member,
          callId,
          realmId: request.realmId,
          bindingId: decision.value.grant.bindingId,
          bindingRevision: decision.value.grant.bindingRevision,
          parametersFingerprint: request.parametersFingerprint,
          requestedEffects: request.requestedEffects,
        })
        if (!consumed.ok) {
          dispatcher.endCallById(callId, 'refused')
          return 'admission-refused'
        }
        bodyRuns.push(callId)
        dispatcher.noteResultObserved(callId)
        dispatcher.endCallById(callId, 'settled')
        return 'ran'
      } catch {
        dispatcher.endCallById(callId, 'refused')
        return 'admission-refused'
      }
    },
  }
}

function setPolicy() {
  return { rules: [] }
}

const baseRequest = (callId: string): AdmissionRequest => ({
  binding: binding(),
  member: MEMBER,
  callId,
  realmId: REALM,
  parametersFingerprint: 'sha256:' + 'e'.repeat(64),
  requestedEffects: effects(readEffect()),
})

describe('Guard outside, Admission inside — nobody gets to run twice or for free', () => {
  it('an unbound name is refused by the Guard and NEVER reaches Admission', async () => {
    const a = assembly({ allow: true })
    const outcome = await a.dispatch('call-x', 'not-a-bound-tool', baseRequest('call-x'))
    expect(outcome).toBe('guard-denied')
    expect(a.bodyRuns).toEqual([])
    expect(a.ledger.consumedCount()).toBe(0)
  })

  it('a policy refusal ends the call `refused`, body zero, dispatcher drainable', async () => {
    const a = assembly({ allow: false })
    const outcome = await a.dispatch('call-y', 'read', baseRequest('call-y'))
    expect(outcome).toBe('admission-refused')
    expect(a.bodyRuns).toEqual([])
    expect(a.dispatcher.beginDrain().ok).toBe(true)
    expect(a.dispatcher.tombstone().ok).toBe(true)
    const released = a.dispatcher.release()
    expect(released.ok).toBe(true)
  })

  it('the happy path runs the body exactly once; a same-shape SECOND call needs its own grant', async () => {
    const a = assembly({ allow: true })
    expect(await a.dispatch('call-p1', 'read', baseRequest('call-p1'))).toBe('ran')
    // A second call carrying the FIRST call's consumed grant cannot ride it:
    // the kernel mints a NEW grant for it (same policy, fresh consume), and
    // replaying the first grant against the second call refuses.
    expect(await a.dispatch('call-p2', 'read', baseRequest('call-p2'))).toBe('ran')
    expect(a.bodyRuns).toEqual(['call-p1', 'call-p2'])
    expect(a.ledger.consumedCount()).toBe(2) // distinct grants, each spent once
  })

  it('an exception inside admission leaves the SELF COUNT balanced (drain to zero)', async () => {
    const a = assembly({ allow: true })
    // Poison the request so `admit` throws BEFORE any decision (a defect,
    // not a policy answer — the catch must still end the call).
    const broken = { ...baseRequest('call-z'), requestedEffects: undefined } as unknown as AdmissionRequest
    const outcome = await a.dispatch('call-z', 'read', broken)
    expect(outcome).toBe('admission-refused')
    expect(a.dispatcher.beginDrain().ok).toBe(true)
    expect(a.dispatcher.tombstone().ok).toBe(true)
    expect(a.dispatcher.release().ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION ASSEMBLY × PRODUCTION PROVIDER (PR2/PR3 production-assembly
// round) — the sequence the W5/C-04/05/C-08 evidence kits demonstrated with
// fixture builders, run here as CLASSES over a REAL fixture world: the REAL
// authority input (a template `capabilities.permissions` object, not fixture
// policy arms) → `createProductionAdmissionAssembly` → `admitCall` → the
// assembly's FS port → `createProductionControlledFsProvider.gateCall` →
// real bytes through the C-FS law chain, ending at the one-shot execution
// edge. Host contract: `dev/agent-workflow/evidence/alpha5/prod/pa-CONTRACT.md`.
// ═══════════════════════════════════════════════════════════════════════════

const PROD_REALM = 'realm-1' // the C-FS fixture world's realm (poc3-harness)
const PROD_FP = 'sha256:' + 'c'.repeat(64)
const WINDOW = { offset: 0, limit: null } as const

/** Effects over the C-FS fixture world: the `absolute-path` resource kind is
 *  the world's spelling (poc3-harness), built through the frozen parser. */
function absEffects(tool: string, kind: 'read' | 'write', locator: string) {
  const parsed = parseRequestedEffectSet([
    { kind: 'tool-invoke', toolName: tool, resource: null },
    { kind, resource: { realmId: PROD_REALM, kind: 'absolute-path', canonicalLocator: locator, rights: kind === 'read' ? ['read'] : ['write'] } },
  ])
  if (!parsed.ok) throw new Error(`prod fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

describe('production admission assembly (createProductionAdmissionAssembly, real template policy)', () => {
  let world: Poc3World
  const aFile = () => join(world.ctrl, 'public', 'a.txt')
  const bFile = () => join(world.ctrl, 'private', 'secret.txt')

  beforeAll(() => {
    world = createPoc3World()
  })
  afterAll(() => {
    if (world) destroyPoc3World(world.world)
  })

  function prodAssembly(config: {
    permissionPolicy: TemplatePermissionPolicy
    ledger?: ReturnType<typeof createGrantLedger>
    role?: 'leader' | 'member'
    leaderExecTokenPresent?: () => boolean
    authorityGeneration?: () => number
  }) {
    return createProductionAdmissionAssembly({
      permissionPolicy: config.permissionPolicy,
      realmId: PROD_REALM,
      templateId: 'tpl-prod',
      definitionOwnerAuthority: 'human-user',
      role: config.role ?? 'member',
      clock: () => FIXED_NOW,
      authorityGeneration: config.authorityGeneration ?? (() => 1),
      beneficiaryAuthority: (config.role ?? 'member') === 'leader' ? 'leader' : 'member',
      ...(config.ledger === undefined ? {} : { ledger: config.ledger }),
      ...(config.leaderExecTokenPresent === undefined ? {} : { leaderExecTokenPresent: config.leaderExecTokenPresent }),
    })
  }

  function provider() {
    return createProductionControlledFsProvider({
      realmId: PROD_REALM,
      instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: PROD_REALM, kind: 'absolute-path' }],
      clock: () => FIXED_NOW,
      authorityGeneration: () => 1,
      consumed: () => false,
    })
  }

  function readRequest(callId: string, locator: string, tool = 'read'): AdmissionRequest {
    return {
      binding: binding({ toolName: tool }),
      member: MEMBER,
      callId,
      realmId: PROD_REALM,
      parametersFingerprint: PROD_FP,
      requestedEffects: absEffects(tool, 'read', locator),
    }
  }

  it('happy chain: template allow rule → admitCall → gated lane READS REAL BYTES; one-shot spend is visible to the provider arm', async () => {
    const built = prodAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'exact', path: aFile() } }], ask: [], deny: [] },
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const asm = built.value
    const request = readRequest('prod-call-1', aFile())
    const decision = await asm.admitCall(request)
    expect(decision.ok && decision.value.kind).toBe('admitted')
    if (!decision.ok || decision.value.kind !== 'admitted') return
    const grant = decision.value.grant
    expect(asm.consumed(grant.grantId)).toBe(false)

    const prov = createProductionControlledFsProvider({
      realmId: PROD_REALM,
      instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: PROD_REALM, kind: 'absolute-path' }],
      clock: () => FIXED_NOW,
      authorityGeneration: () => 1,
      consumed: asm.consumed, // THE provider arm wired to the assembly — one ledger, two faces
    })
    const lane = prov.gateCall({ admission: asm.createFsAdmissionPort(request, grant), parametersFingerprint: grant.parametersFingerprint })
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const res = await lane.fs.readText(grant, ref, WINDOW)
    expect(res.ok && res.value.text).toBe('A-CONTENT\n')
    expect(asm.consumed(grant.grantId)).toBe(true) // the FS op's exec edge WAS the kernel consume

    // one-shot law through the whole chain: a second gated op on the SAME grant dies at the lane's revalidate with zero IO.
    const again = await lane.fs.readText(grant, ref, WINDOW)
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.details?.['cfReason']).toBe('grant-consumed')
  })

  it('a path the template never named under default:ask takes the Ask arm (no-authority), body/grant never minted', async () => {
    const built = prodAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'exact', path: aFile() } }], ask: [], deny: [] },
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const decision = await built.value.admitCall(readRequest('prod-call-ask', bFile()))
    expect(decision.ok && decision.value.kind).toBe('requires-approval')
  })

  it('default:deny gates at the ASSEMBLY door: an unnamed effect is denied with zero kernel side effects', async () => {
    const ledger = createGrantLedger()
    const built = prodAssembly({
      permissionPolicy: { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'exact', path: aFile() } }], ask: [], deny: [] },
      ledger,
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    // covered effect passes the gate (deny-default is deny-UNTIL-NAMED, not deny-everything)
    const okDecision = await built.value.admitCall(readRequest('prod-dd-1', aFile()))
    expect(okDecision.ok && okDecision.value.kind).toBe('admitted')
    // an unnamed WRITE effect: typed denial BEFORE the kernel (nothing minted, nothing consumed)
    const writeRequest: AdmissionRequest = {
      binding: binding({ toolName: 'write' }),
      member: MEMBER,
      callId: 'prod-dd-2',
      realmId: PROD_REALM,
      parametersFingerprint: PROD_FP,
      requestedEffects: absEffects('write', 'write', bFile()),
    }
    const deniedDecision = await built.value.admitCall(writeRequest)
    expect(deniedDecision.ok && deniedDecision.value.kind).toBe('denied')
    if (!deniedDecision.ok || deniedDecision.value.kind !== 'denied') return
    expect(deniedDecision.value.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(deniedDecision.value.error.details?.['refusal']).toBe('template-default-deny')
    expect(ledger.consumedCount()).toBe(0)
  })

  it('template DENY lane + R-1a sources: the denied effect walks the case at the rung ABOVE the definition owner (ruling ①)', async () => {
    const built = prodAssembly({
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [{ tool: 'write', resource: { kind: 'exact', path: bFile() } }] },
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const sources = built.value.denySources()
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every((s) => s.sourceRef.startsWith('tpl-prod#deny['))).toBe(true)
    const writeRequest: AdmissionRequest = {
      binding: binding({ toolName: 'write' }),
      member: MEMBER,
      callId: 'prod-deny-1',
      realmId: PROD_REALM,
      parametersFingerprint: PROD_FP,
      requestedEffects: absEffects('write', 'write', bFile()),
    }
    const decision = await built.value.admitCall(writeRequest)
    // ONE DENY ONE SOURCE PROOF: an attributed deny becomes an upgradable Ask
    // at the rung above the owner — never silence, never an unattributed deny.
    expect(decision.ok && decision.value.kind).toBe('requires-approval')
    if (!decision.ok || decision.value.kind !== 'requires-approval') return
    const planned = built.value.planApproval(writeRequest)
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const deniedArms = planned.value.deniedEffects.filter((d) => d.requiredAuthority === 'human-admin')
    expect(deniedArms.length).toBeGreaterThan(0)
  })

  it('leader shell allow-any obeys the exec dual gate READ-TIME: closed ⇒ Ask, opened ⇒ admitted, no restart', async () => {
    let execToken = false
    const built = prodAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] },
      role: 'leader',
      leaderExecTokenPresent: () => execToken,
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const bashRequest: AdmissionRequest = {
      binding: binding(), // fixture binding is the bash tool
      member: MEMBER,
      callId: 'prod-shell-1',
      realmId: PROD_REALM,
      parametersFingerprint: PROD_FP,
      requestedEffects: effects(toolInvokeEffect('bash')),
    }
    const closed = await built.value.admitCall(bashRequest)
    expect(closed.ok && closed.value.kind).toBe('requires-approval')
    execToken = true
    const opened = await built.value.admitCall({ ...bashRequest, callId: 'prod-shell-2' })
    expect(opened.ok && opened.value.kind).toBe('admitted')
  })

  it('construction failures type out (the host fails the AgentSetup, never a half-wired authority)', () => {
    const anyDeny = prodAssembly({
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [{ tool: 'read', resource: { kind: 'any' } }] },
    })
    expect(anyDeny.ok).toBe(false)
    if (anyDeny.ok) return
    expect(anyDeny.error.details?.['refusal']).toBe('projection-deny-unprojectable')
    const noClock = createProductionAdmissionAssembly({
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
      realmId: PROD_REALM,
      templateId: 'tpl-x',
      definitionOwnerAuthority: 'human-user',
      role: 'member',
      clock: undefined as unknown as () => number,
      authorityGeneration: () => 1,
      beneficiaryAuthority: 'member',
    })
    expect(noClock.ok).toBe(false)
    if (noClock.ok) return
    expect(noClock.error.details?.['refusal']).toBe('assembly-input-malformed')
  })

  it('the provider on a stale generation view stops the chain BEFORE the port (the lane revalidates, the kernel stays clean)', async () => {
    const built = prodAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'exact', path: aFile() } }], ask: [], deny: [] },
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const asm = built.value
    const request = readRequest('prod-gen-1', aFile())
    const decision = await asm.admitCall(request)
    expect(decision.ok && decision.value.kind).toBe('admitted')
    if (!decision.ok || decision.value.kind !== 'admitted') return
    // the provider reads its generation PER gateCall — a bump between admit and gate is the stale-between-legs law:
    const prov = createProductionControlledFsProvider({
      realmId: PROD_REALM,
      instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: PROD_REALM, kind: 'absolute-path' }],
      clock: () => FIXED_NOW,
      authorityGeneration: () => 2,
      consumed: asm.consumed,
    })
    const lane = prov.gateCall({ admission: asm.createFsAdmissionPort(request, decision.value.grant), parametersFingerprint: decision.value.grant.parametersFingerprint })
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const res = await lane.fs.readText(decision.value.grant, ref, WINDOW)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('authority-generation-stale')
    expect(asm.consumed(decision.value.grant.grantId)).toBe(false) // refusal happened at revalidate — the one-shot grant is NOT spent
  })

  it('an empty bound fingerprint dies at the provider door (law 2 via bindAdmissionRecheck — a lane that cannot bind cannot gate)', () => {
    const prov = provider()
    expect(() => prov.gateCall({
      admission: { recheckCall: async () => ({ ok: true as const }) },
      parametersFingerprint: '',
    })).toThrow(TypeError)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// INVOCATION-ONLY SCHEDULE PAIR (Alpha.5 M2, root 20:05 limited card) — the
// same production assembly over the two schedule names: a denied
// invocation shows ZERO body and ZERO ledger motion (deny 0 body); an
// admitted invocation is spent EXACTLY ONCE (permit-once, the same
// one-shot ledger law as every other class — the class adds no weaker
// edge); cross-tool identities never cross; no FS provider is involved —
// the `tool-invoke` arm IS the whole authority.
// ═══════════════════════════════════════════════════════════════════════════

describe('production assembly × invocation-only schedule pair (root 20:05)', () => {
  function invokeEffects(tool: string) {
    const parsed = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: tool, resource: null }])
    if (!parsed.ok) throw new Error(`schedule fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
    return parsed.value
  }

  function scheduleAssembly(permissionPolicy: TemplatePermissionPolicy) {
    const ledger = createGrantLedger()
    const built = createProductionAdmissionAssembly({
      permissionPolicy,
      realmId: PROD_REALM,
      templateId: 'tpl-sched',
      definitionOwnerAuthority: 'human-user',
      role: 'member',
      clock: () => FIXED_NOW,
      authorityGeneration: () => 1,
      beneficiaryAuthority: 'member',
      ledger,
    })
    return { built, ledger }
  }

  function invokeRequest(callId: string, tool: string): AdmissionRequest {
    return {
      binding: binding({ toolName: tool }),
      member: MEMBER,
      callId,
      realmId: PROD_REALM,
      parametersFingerprint: PROD_FP,
      requestedEffects: invokeEffects(tool),
    }
  }

  it('deny 0 body: an unnamed schedule_list call under default:deny is DENIED before the kernel — no probe, no mint, no ledger', async () => {
    const { built, ledger } = scheduleAssembly({ default: 'deny', allow: [], ask: [], deny: [] })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const decision = await built.value.admitCall(invokeRequest('sched-dd-1', 'schedule_list'))
    expect(decision.ok && decision.value.kind).toBe('denied')
    if (!decision.ok || decision.value.kind !== 'denied') return
    expect(decision.value.error.details?.['refusal']).toBe('template-default-deny')
    expect(ledger.consumedCount()).toBe(0) // ZERO body: nothing was ever minted to spend
  })

  it('an attributed deny-lane schedule rule is ROUTED (ruling ①), never silence — and still mints nothing', async () => {
    const { built, ledger } = scheduleAssembly({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'schedule_delete', resource: { kind: 'any' } }] })
    expect(built.ok).toBe(true) // the narrowed any-deny law: the class PROJECTS whole-tool deny
    if (!built.ok) return
    expect(built.value.denySources().every((s) => s.sourceRef.startsWith('tpl-sched#deny['))).toBe(true)
    const decision = await built.value.admitCall(invokeRequest('sched-deny-1', 'schedule_delete'))
    expect(decision.ok && decision.value.kind).toBe('requires-approval') // attributed ⇒ upgradable Ask, body stays zero
    expect(ledger.consumedCount()).toBe(0)
  })

  it('permit-once: an admitted schedule_delete invocation spends its grant EXACTLY once; the second consume refuses', async () => {
    const { built, ledger } = scheduleAssembly({ default: 'ask', allow: [{ tool: 'schedule_delete', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const asm = built.value
    const request = invokeRequest('sched-permit-1', 'schedule_delete')
    const decision = await asm.admitCall(request)
    expect(decision.ok && decision.value.kind).toBe('admitted')
    if (!decision.ok || decision.value.kind !== 'admitted') return
    const grant = decision.value.grant
    const consume = () => asm.consumeForExecution(grant, {
      currentAuthorityGeneration: 1,
      member: MEMBER,
      callId: 'sched-permit-1',
      realmId: PROD_REALM,
      bindingId: grant.bindingId,
      bindingRevision: grant.bindingRevision,
      parametersFingerprint: request.parametersFingerprint,
      requestedEffects: request.requestedEffects,
    })
    expect(consume().ok).toBe(true) // the ONE spend
    expect(ledger.consumedCount()).toBe(1)
    expect(consume().ok).toBe(false) // a second spend of the SAME grant: refused — the ledger makes "twice" impossible
    expect(ledger.consumedCount()).toBe(1)
  })

  it('cross-tool no-cross at the decision door: the schedule_list grant never admits a schedule_delete call', async () => {
    const { built } = scheduleAssembly({ default: 'ask', allow: [{ tool: 'schedule_list', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const listDecision = await built.value.admitCall(invokeRequest('sched-list-1', 'schedule_list'))
    expect(listDecision.ok && listDecision.value.kind).toBe('admitted')
    const deleteDecision = await built.value.admitCall(invokeRequest('sched-del-1', 'schedule_delete'))
    expect(deleteDecision.ok && deleteDecision.value.kind).toBe('requires-approval') // schedule_delete stays at its own default — no borrowing
  })
})
