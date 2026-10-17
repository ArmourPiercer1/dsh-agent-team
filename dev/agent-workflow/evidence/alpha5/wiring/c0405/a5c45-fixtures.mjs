/**
 * a5c45-fixtures.mjs — C-04/05 gap-round LIVE builders (Alpha.5 wiring phase).
 *
 * A plain-ESM port of the ACCEPTED assembly pattern of three rounds already
 * on master — the W5 fixture port (`../w5/a5w5-fixtures.mjs`), the live
 * round's PR2→gated-ControlledFs flow (`../../live/a5live-fixtures.mjs`)
 * and the W-E2 kernel port (`../we2/a5e2-fixtures.mjs`). Every grant, ref,
 * effect set and binding is built through the frozen PR0/PR2 parsers from
 * the COMMITTED `packages/runtime/dist` barrels; the spill face rides the
 * DORMANT a5p5-tools lane compiled by the ACCEPTED W5 driver
 * (`../w5/build-lane-esm.mjs`, zero source edits). This row re-implements
 * NO law — it composes faces (IF-1).
 *
 * What is NEW here is only what matrix M-04/M-05 register as missing
 * assembly rows: the editor subcommand I/O map + undo-history I/O leg
 * (M-04) and the read_image attachment→decode chain + thumbnail-bypass /
 * admission-unbound negative controls (M-05). They are TEST-SIDE assembly
 * over the governed faces (row-local tool defs riding the public seam),
 * NOT production sources — the Team packages stay exactly as merged.
 *
 * FIXTURE-GRADE disclosure (identical caliber to W5/W7/W-E2/live): the
 * kernel's trusted inputs (clock, generations, documents, policy, ledger,
 * assurance probe) are fixture-grade; the parameters fingerprint is the
 * assembly-declared canonical digest. Nothing here claims ENFORCE level.
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/c0405/a5c45-fixtures
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'

/** Load the dist barrels + the kit-local a5p5 lane build (spill face). */
export async function loadA5C45Lanes({ distPackages, laneBuild }) {
  const distUrl = (p) => new URL(`file://${distPackages}/${p}`).href
  const laneUrl = (p) => new URL(`file://${laneBuild}/packages/tools/a5p5-tools/src/${p}`).href
  const [tg, ta, td, cf, spill] = await Promise.all([
    import(distUrl('domain/tool-governance/src/index.js')),
    import(distUrl('runtime/tool-admission/index.js')),
    import(distUrl('runtime/tool-dispatch/install.js')),
    import(distUrl('runtime/controlled-fs/src/index.js')),
    import(laneUrl('spill.js')),
  ])
  return { tg, ta, td, cf, spill }
}

export const REALM = 'a5c45-realm'
export const MEM_A = Object.freeze({ teamSessionId: 'a5c45-ts', instanceId: 'a5c45-member-a' })
export const FIXED_NOW = 1_737_000_000_000
export const FULL_WINDOW = Object.freeze({ offset: 0, limit: null })

export const sha256 = (text) => `sha256:${createHash('sha256').update(String(text), 'utf8').digest('hex')}`

/** Assembly-declared canonical parameters digest for one call (fixture grade). */
export function canonicalParamsFingerprint(params) {
  const keys = Object.keys(params).sort()
  const canon = `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`).join(',')}}`
  return sha256(canon)
}

// ── PR0 ref/effect/policy builders (ports of a5live-fixtures + a5e2) ────────

export function fileRef(tg, ctrlRoot, rel, rights = ['read', 'write', 'meta']) {
  const parsed = tg.parseResourceRef({
    realmId: REALM,
    kind: 'absolute-path',
    canonicalLocator: join(ctrlRoot, rel),
    rights,
  })
  if (!parsed.ok) throw new Error(`a5c45 fixture ref rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/**
 * The effect set of ONE editor/image op: the guard-plane tool-invoke arm
 * plus the fs-plane read/write arms on REAL refs (same mixed set the frozen
 * parser admits — we2 used tool-invoke+domain-ref the identical way).
 */
export function effectsFor(tg, { toolName, fsEffects = [] }) {
  const raw = [{ kind: 'tool-invoke', toolName, resource: null }]
  for (const e of fsEffects) raw.push({ kind: e.kind, resource: e.ref })
  const parsed = tg.parseRequestedEffectSet(raw)
  if (!parsed.ok) throw new Error(`a5c45 fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** The kernel's own scope-key law per arm (tool:<name> / realm|locator). */
function scopeKey(arm) {
  if (arm.kind === 'tool-invoke') return `${REALM}|tool:${arm.toolName}`
  return `${arm.ref.realmId}|${arm.ref.canonicalLocator}`
}

/** allow-list document over EXPLICIT arms (the round's grant facts, row-built). */
export function allowPolicy(tg, arms) {
  const parsed = tg.parseToolPolicyDocument({
    rules: arms.map((arm) => ({
      realmId: REALM,
      effectKind: arm.kind,
      matcher: { kind: 'exact', resource: scopeKey(arm) },
      maximumEffect: 'allow',
    })),
  })
  if (!parsed.ok) throw new Error(`a5c45 fixture policy rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function emptyHardDocs() {
  return { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } }
}

function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'node-lane-fallback' : null, realmId: REALM, trustRoot: real ? 'fixture:a5c45' : null, evidence: real ? 'dev/agent-workflow/evidence/alpha5/wiring/c0405' : null }
}

export function assuranceContract() {
  const dims = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel']
  const assurance = {}
  for (const d of dims) assurance[d] = dimensionRecord('untested')
  return { implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', assurance }
}

export function binding(tg, toolName, over = {}) {
  const assurance = assuranceContract()
  const parsed = tg.parseToolBinding({
    bindingId: `bind-a5c45-${toolName}`,
    agentScopeKey: 'a5c45-session',
    toolName,
    definitionIdentity: `def:a5c45-${toolName}`,
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
  if (!parsed.ok) throw new Error(`a5c45 fixture binding rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** The UNBOUND-leg grant builder (fixture mint, no kernel): the leg that
 *  never reaches an admission fact — the refusal must be the LANE's (law 1). */
let seq = 0
export function makeGrant(tg, fx) {
  const effectsParsed = effectsFor(tg, { toolName: fx.toolName ?? 'a5c45_cf_probe', fsEffects: fx.fsEffects ?? [] })
  const n = ++seq
  const parsed = tg.parseOperationGrant({
    grantId: fx.grantId ?? `a5c45-grant-${n}`,
    member: MEM_A,
    callId: fx.callId ?? `a5c45-call-${n}`,
    realmId: REALM,
    bindingId: 'binding-c45-probe',
    bindingRevision: 1,
    authorityGeneration: fx.authorityGeneration ?? 1,
    parametersFingerprint: sha256(`a5c45-params-${n}`),
    effects: effectsParsed,
    singleUse: true,
    issuedAt: 0,
    expiresAt: null,
  })
  if (!parsed.ok) throw new Error(`a5c45 fixture grant rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

// ── the shared PR2 admission stack for ONE assembly (kernel + ledger) ───────

/**
 * One assembly owns ONE kernel + ONE grant ledger (the ledger is where the
 * one-shot consumption adds up across the whole chain — the runner reads
 * `consumedCount()` back as the round's ledger face).
 */
export function makeAdmissionStack(ta, tg, { policyArms, onObserve }) {
  const ledger = ta.createGrantLedger()
  const innerProbe = ta.createStubAssuranceProbe({})
  const kernelEvents = []
  const kernel = ta.createAdmissionKernel({
    clock: () => FIXED_NOW,
    authorityGeneration: () => 1,
    documents: emptyHardDocs,
    policyDocument: () => allowPolicy(tg, policyArms),
    beneficiaryAuthority: 'member',
    assuranceProbe: innerProbe,
    requiredAssurance: () => ({}),
    ledger,
    onObserve: (row) => { kernelEvents.push(row); if (onObserve !== undefined) onObserve(row) },
  })
  return { kernel, ledger, kernelEvents }
}

/** PR2 admit for ONE physical lane op (bind → grant). */
export async function admitOp({ tg, ta }, stack, { registeredName, callId, requestedEffects, parametersFingerprint }) {
  const request = {
    binding: binding(tg, registeredName),
    member: MEM_A,
    callId,
    realmId: REALM,
    parametersFingerprint,
    requestedEffects,
  }
  const decision = await stack.kernel.admit(request)
  if (!decision.ok) return { stage: 'admit-errored', error: decision.error, request }
  const value = decision.value
  if (value.kind !== 'admitted') return { stage: value.kind, decision: value, request }
  return { stage: 'admitted', grant: value.grant, decision: value, request }
}

/**
 * The FsAdmissionPort for one granted op (live-round shape): the lane's
 * exec-time recheck consumes the ONE-SHOT grant at the kernel's execution
 * edge. A second exec on the same grant is the one-shot refusal (recorded).
 */
export function fsPortFor(stack, admissionFlow) {
  const { kernel, ledger } = stack
  const { grant, request, requestedEffects } = admissionFlow
  const calls = []
  const port = {
    recheckCall: async (intent) => {
      calls.push(intent)
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
  const replay = () => kernel.consumeForExecution(grant, {
    currentAuthorityGeneration: 1,
    member: MEM_A,
    callId: request.callId,
    realmId: REALM,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: request.parametersFingerprint,
    requestedEffects,
    cancelRequested: false,
  })
  return { port, calls, replay, ledger }
}

// ── the image decode helper (pure — the BYTES ride the gated lane only) ─────

/** Parse a PNG signature + IHDR from real bytes; no external dependency. */
export function decodePng(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24) return { ok: false, error: 'short-buffer' }
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return { ok: false, error: 'bad-signature' }
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return { ok: false, error: 'missing-IHDR' }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const bitDepth = bytes[23]
  return { ok: true, format: 'image/png', width, height, bitDepth, bytes: bytes.length }
}
