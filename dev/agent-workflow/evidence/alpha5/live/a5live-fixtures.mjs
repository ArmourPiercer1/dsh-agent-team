/**
 * a5live-fixtures.mjs — PR3 LIVE-assembly fixture builders (Scope-4 live round).
 *
 * A plain-ESM port of the three lane test harnesses
 * (`packages/runtime/test/a5p2-kernel-harness.ts`, `a5p2-fixtures.ts`,
 * `packages/runtime/controlled-fs/test/poc3-harness.ts`) so the SAME builders
 * that the fixture-level suites use can run INSIDE the live Host process.
 * Nothing here re-implements a law: every grant, ref, effect set and binding
 * is built through the frozen PR0 parsers imported from the worktree's BUILT
 * dist (the same artifact the production row mounts). The kernel is built with
 * the same harness shape as `a5p2-kernel-harness.makeHarness`.
 *
 * DISCLOSED SCOPE (honesty per the task's level rules): the kernel's trusted
 * inputs here (clock, generations, documents, policy, ledger) are
 * FIXTURE-GRADE — exactly what the lane suites feed it. This module is the
 * live-assembly slice, not a production-envelope integration; nothing claims
 * more than "the gated face, the PR2 kernel, and the PR1 install run in a
 * real Host process against a real session Agent".
 *
 * @module dev/agent-workflow/evidence/alpha5/live/a5live-fixtures
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Load the built lane artifacts from the worktree dist (absolute file URLs). */
export async function loadA5LiveLanes(distPackages) {
  const url = (p) => new URL(`file://${distPackages}/${p}`).href
  const [tg, ta, cf, td] = await Promise.all([
    import(url('domain/tool-governance/src/index.js')),
    import(url('runtime/tool-admission/index.js')),
    import(url('runtime/controlled-fs/src/index.js')),
    import(url('runtime/tool-dispatch/install.js')),
  ])
  return { tg, ta, cf, td }
}

export const REALM = 'realm-1'
export const MEM_A = Object.freeze({ teamSessionId: 'a5live-ts', instanceId: 'live-member-a' })
export const FIXED_NOW = 1_737_000_000_000

export function sha256(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

/** Canonical-ish parameters fingerprint for the fixture call.
 *  Fixture-grade by disclosure: the PR1 Guard's own canonical fingerprint is
 *  produced by the Guard pre-call; here the assembly states the call's
 *  canonical parameters digest and binds THAT value (law 2 binds what the
 *  assembly declares for this call). */
export function canonicalParamsFingerprint(params) {
  const keys = Object.keys(params).sort()
  const canon = `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`).join(',')}}`
  return sha256(canon)
}

// ── world (TEST_METHODS §7 naming is the RUNNER's job; this builds inside it) ──

/** Build the controlled instance root + one readable file inside a world dir. */
export function buildLiveFsWorld(worldDir) {
  const ctrl = join(worldDir, 'controlled')
  mkdirSync(join(ctrl, 'public'), { recursive: true })
  mkdirSync(join(worldDir, 'outside'), { recursive: true })
  const content = `A5LIVE-CONTENT-${sha256(String(Math.random())).slice(7, 15)}\n`
  writeFileSync(join(ctrl, 'public', 'a.txt'), content)
  writeFileSync(join(worldDir, 'outside', 'secret.txt'), 'A5LIVE-OUTSIDE\n')
  return { ctrl, outside: join(worldDir, 'outside'), content }
}

// ── parsers / builders (ports of poc3-harness + a5p2-fixtures) ───────────────

export function fileRef(tg, ctrl, rel, rights) {
  const parsed = tg.parseResourceRef({
    realmId: REALM,
    kind: 'absolute-path',
    canonicalLocator: join(ctrl, rel),
    rights,
  })
  if (!parsed.ok) throw new Error(`live fixture ref rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function effects(tg, raw) {
  const parsed = tg.parseRequestedEffectSet(raw)
  if (!parsed.ok) throw new Error(`live fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function scopeResource(effect) {
  return `${effect.resource.realmId}|${effect.resource.canonicalLocator}`
}

export function allowPolicy(tg, set) {
  const parsed = tg.parseToolPolicyDocument({
    rules: set.effects.map((effect) => ({
      realmId: effect.resource === null ? REALM : effect.resource.realmId,
      effectKind: effect.kind,
      matcher: { kind: 'exact', resource: scopeResource(effect) },
      maximumEffect: 'allow',
    })),
  })
  if (!parsed.ok) throw new Error(`live fixture policy rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function emptyHardDocs() {
  return { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } }
}

export function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'node-lane-fallback' : null, realmId: REALM, trustRoot: real ? 'fixture:a5live' : null, evidence: real ? 'dev/agent-workflow/evidence/alpha5/live' : null }
}

export function assuranceContract(tg, levels = {}) {
  const dims = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel']
  const assurance = {}
  for (const d of dims) assurance[d] = dimensionRecord(levels[d] ?? 'untested')
  return { implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', assurance }
}

let seq = 0

export function binding(tg, over = {}) {
  const assurance = assuranceContract(tg)
  const parsed = tg.parseToolBinding({
    bindingId: 'bind-a5live-1',
    agentScopeKey: 'a5live-session',
    toolName: 'a5live_fs_read',
    definitionIdentity: 'def:a5live-fs-read',
    providerId: 'team-own',
    implementationOrigin: assurance.implementationOrigin,
    executionBoundary: assurance.executionBoundary,
    assurance,
    policyGeneration: 1,
    authorityGeneration: 1,
    revision: 1,
    status: 'ACTIVE',
    ...over,
  })
  if (!parsed.ok) throw new Error(`live fixture binding rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Fixture grant builder (for the UNBOUND refusal leg, which never reaches a
 *  kernel mint — the refusal must be the LANE's, before any admission fact). */
export function makeGrant(tg, fx) {
  const effectsParsed = effects(tg, fx.effects.map((e) => ({ kind: e.kind, resource: e.resource })))
  const n = ++seq
  const parsed = tg.parseOperationGrant({
    grantId: fx.grantId ?? `a5live-grant-${n}`,
    member: fx.member,
    callId: fx.callId ?? `a5live-call-${n}`,
    realmId: REALM,
    bindingId: 'binding-1',
    bindingRevision: 1,
    authorityGeneration: fx.authorityGeneration ?? 1,
    parametersFingerprint: sha256(`a5live-params-${n}`),
    effects: effectsParsed,
    singleUse: true,
    issuedAt: 0,
    expiresAt: fx.expiresAt ?? null,
  })
  if (!parsed.ok) throw new Error(`live fixture grant rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

// ── kernel harness (port of a5p2-kernel-harness.makeHarness) ─────────────────

export function makeLiveHarness(ta, { policy, onObserve } = {}) {
  const ledger = ta.createGrantLedger()
  const innerProbe = ta.createStubAssuranceProbe({})
  const kernel = ta.createAdmissionKernel({
    clock: () => FIXED_NOW,
    authorityGeneration: () => 1,
    documents: emptyHardDocs,
    policyDocument: policy ?? (() => ({ rules: [] })),
    beneficiaryAuthority: 'member',
    assuranceProbe: innerProbe,
    requiredAssurance: () => ({}),
    ledger,
    ...(onObserve === undefined ? {} : { onObserve }),
  })
  return { kernel, ledger }
}

// ── the two live sequences ───────────────────────────────────────────────────

const FULL = { offset: 0, limit: null }

/**
 * UNBOUND leg: the gated face WITHOUT an admission binding must answer with a
 * typed C-FS refusal (`admission-unbound`) and read zero bytes.
 */
export async function runUnboundRead({ cf, tg }, world) {
  const ref = fileRef(tg, world.ctrl, 'public/a.txt', ['read'])
  const grant = makeGrant(tg, { member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
  const lane = cf.createAdmissionGatedControlledFs({
    instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: REALM, kind: 'absolute-path' }],
  })
  const res = await lane.fs.readText(grant, ref, FULL)
  const last = lane.ledger[lane.ledger.length - 1]
  return {
    ok: res.ok,
    refusal: res.ok ? null : {
      code: res.error.code,
      cfClass: res.error.details?.['cfClass'] ?? null,
      cfReason: res.error.details?.['cfReason'] ?? null,
      message: String(res.error.message).slice(0, 300),
    },
    laneLedgerStage: last?.stage ?? null,
    readRawWouldSucceed: safeRead(join(world.ctrl, 'public', 'a.txt')) !== null,
  }
}

function safeRead(p) {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

/**
 * FULL PR2 FLOW: bind → grant → one controlled read.
 *  - `bind`: an FsAdmissionPort adapter maps the lane's exec-time recheck onto
 *    the PR2 kernel's execution edge (`consumeForExecution`).
 *  - `grant`: `kernel.admit(request)` (the PR2 admission decision) mints the
 *    one-shot OperationGrant.
 *  - `read`: the gated lane, bound to the grant's canonical
 *    `parametersFingerprint` (law 2), exec-time-rechecks through the port and
 *    only then reads the bytes through its guarded open.
 */
export async function runBoundBindGrantRead({ cf, tg, ta }, world, callTag) {
  const ref = fileRef(tg, world.ctrl, 'public/a.txt', ['read'])
  const requestedEffects = effects(tg, [{ kind: 'read', resource: ref }])
  const parametersFingerprint = canonicalParamsFingerprint({ op: 'readText', locator: ref.canonicalLocator, window: 'full', tag: callTag })
  const { kernel, ledger } = makeLiveHarness(ta, { policy: () => allowPolicy(tg, requestedEffects) })
  const kernelEvents = []
  const request = {
    binding: binding(tg),
    member: MEM_A,
    callId: `a5live-${callTag}`,
    realmId: REALM,
    parametersFingerprint,
    requestedEffects,
  }
  // grant (PR2 admission decision)
  const decision = await kernel.admit(request)
  if (!decision.ok) return { stage: 'admit-errored', error: decision.error }
  if (decision.value.kind !== 'admitted') return { stage: 'admit-not-admitted', kind: decision.value.kind, decision: decision.value }
  const grant = decision.value.grant
  // bind (law 2: the lane's recheck presents THIS call's fingerprint)
  const portCalls = []
  const port = {
    recheckCall: async (intent) => {
      portCalls.push(intent)
      const r = kernel.consumeForExecution(grant, {
        currentAuthorityGeneration: 1,
        member: MEM_A,
        callId: request.callId,
        realmId: REALM,
        bindingId: grant.bindingId,
        bindingRevision: grant.bindingRevision,
        parametersFingerprint: intent.parametersFingerprint,
        requestedEffects,
        cancelRequested: false,
      })
      return r.ok ? { ok: true } : { ok: false, reason: `kernel-exec-edge:${r.error.code}` }
    },
  }
  const lane = cf.createAdmissionGatedControlledFs({
    instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: REALM, kind: 'absolute-path' }],
    admission: { admission: port, parametersFingerprint: grant.parametersFingerprint },
  })
  // one controlled read
  const first = await lane.fs.readText(grant, ref, FULL)
  // one-shot proof: a SECOND exec on the SAME grant must refuse at the exec edge
  const second = await lane.fs.readText(grant, ref, FULL)
  return {
    stage: 'flow-complete',
    admittedGrantId: grant.grantId,
    firstOk: first.ok,
    firstTextMatches: first.ok === true && first.value.text === world.content,
    firstTextSha: first.ok === true ? sha256(first.value.text) : null,
    secondOk: second.ok,
    secondRefusal: second.ok ? null : {
      code: second.error.code,
      cfClass: second.error.details?.['cfClass'] ?? null,
      cfReason: second.error.details?.['cfReason'] ?? null,
    },
    portCallCount: portCalls.length,
    portPresentedFingerprint: portCalls[0]?.parametersFingerprint ?? null,
    presentedFingerprintIsBound: portCalls.length > 0 && portCalls[0].parametersFingerprint === grant.parametersFingerprint,
    ledgerConsumedCount: ledger.consumedCount(),
  }
}
