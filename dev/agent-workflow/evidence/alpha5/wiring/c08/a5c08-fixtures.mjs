/**
 * a5c08-fixtures.mjs — C-08 gap-writer LIVE builders (Alpha.5 gap round, branch alpha5-gap-c08).
 *
 * PLAIN-ESM reuse (not a re-creation) of the ACCEPTED W5/W-E2 fixture pattern:
 * the kernel harness, binding/policy/effect builders, the PR2 admit flow and the
 * exec-edge one-shot port are carried over from
 * `../we2/a5e2-fixtures.mjs` (branch alpha5-wire-tools2, reviewed PASS) with two
 * deliberate deltas, both demanded by matrix row M-05 (read_image chain):
 *   1) NO jobs-gateway face — M-05 asserts nothing on the jobs plane (and the
 *      jobs/M-13 surface is frozen this round: W7M rule, no collision).
 *   2) the effect builder speaks the FROZEN resource-effect vocabulary
 *      (`read` over a ResourceRef, effects.ts EFFECT_KINDS closed set), which is
 *      what the PR3 ControlledFs admission-gated lane consumes — W-E2's row only
 *      needed tool-invoke + domain-ref (M-13), M-05 needs the FS half.
 *
 * FIXTURE-GRADE disclosure (identical caliber to W5/W7/W8/W-E2): the kernel's
 * trusted inputs (clock, generations, documents, policy, ledger, assurance
 * probe) are fixture-grade; the parameters fingerprint is the assembly-declared
 * canonical digest. Nothing here claims ENFORCE level.
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/c08/a5c08-fixtures
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Load the dist barrels (tool-governance / tool-admission / tool-dispatch / controlled-fs). */
export async function loadA5C08Lanes({ distPackages }) {
  const distUrl = (p) => new URL(`file://${join(distPackages, p)}`).href
  const [tg, ta, td, cf] = await Promise.all([
    import(distUrl('domain/tool-governance/src/index.js')),
    import(distUrl('runtime/tool-admission/index.js')),
    import(distUrl('runtime/tool-dispatch/install.js')),
    import(distUrl('runtime/controlled-fs/src/index.js')),
  ])
  return { tg, ta, td, cf }
}

export const REALM = 'a5c08-realm'
export const FS_INSTANCE = 'a5c08-fs'
export const FIXED_NOW = 1_737_000_000_000

export const sha256 = (text) => `sha256:${createHash('sha256').update(String(text), 'utf8').digest('hex')}`
export const sha256Buf = (buf) => `sha256:${createHash('sha256').update(buf).digest('hex')}`

/** Assembly-declared canonical parameters digest for one call (fixture grade). */
export function canonicalParamsFingerprint(params) {
  const keys = Object.keys(params).sort()
  const canon = `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`).join(',')}}`
  return sha256(canon)
}

// ── PR2 fixture builders (W5/W-E2 port, extended to the FS resource effect) ──

export function fileRef(tg, kind, canonicalLocator, rights) {
  const parsed = tg.parseResourceRef({ realmId: REALM, kind, canonicalLocator, rights })
  if (!parsed.ok) throw new Error(`a5c08 fixture ref rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/**
 * Requested effect set for one attachment-read call: the tool-invoke arm plus
 * a `read` effect over the resource the policy COVERS (the attachments
 * directory). The thumbnail-bypass leg requests the SAME (already-armed)
 * effect set while targeting a path OUTSIDE it — the deny must then happen at
 * the C-FS lane (effect-outside-grant, before any open), not by an unarmed
 * policy shortcut.
 */
export function effectsForRead(tg, { toolName, readLocator }) {
  const raw = [
    { kind: 'tool-invoke', toolName, resource: null },
    { kind: 'read', resource: { realmId: REALM, kind: 'directory', canonicalLocator: readLocator, rights: ['read'] } },
  ]
  const parsed = tg.parseRequestedEffectSet(raw)
  if (!parsed.ok) throw new Error(`a5c08 fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Policy scope key (a5p2/a5w5 law): tool-invoke keys `<realm>|tool:<name>`, a resource effect keys `<realm>|<locator>`. */
function scopeKey(effect) {
  const realm = effect.resource === null ? REALM : effect.resource.realmId
  if (effect.kind === 'tool-invoke') return `${realm}|tool:${effect.toolName}`
  return `${realm}|${effect.resource.canonicalLocator}`
}

/** allow-list document over EXPLICIT arms (kind + realm + locator|tool name). */
export function allowPolicy(tg, arms) {
  const parsed = tg.parseToolPolicyDocument({
    rules: arms.map((arm) => ({
      realmId: REALM,
      effectKind: arm.kind,
      matcher: { kind: 'exact', resource: arm.kind === 'tool-invoke' ? `${REALM}|tool:${arm.toolName}` : `${REALM}|${arm.locator}` },
      maximumEffect: 'allow',
    })),
  })
  if (!parsed.ok) throw new Error(`a5c08 fixture policy rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function emptyHardDocs() {
  return { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } }
}

function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'node-lane-fallback' : null, realmId: REALM, trustRoot: real ? 'fixture:a5c08' : null, evidence: real ? 'dev/agent-workflow/evidence/alpha5/wiring/c08' : null }
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
    bindingId: `bind-a5c08-${toolName}`,
    agentScopeKey: 'a5c08-session',
    toolName,
    definitionIdentity: `def:a5c08-${toolName}`,
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
  if (!parsed.ok) throw new Error(`a5c08 fixture binding rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Kernel harness (same port as W5/W-E2/PR3). */
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

/** THE FULL PR2 FLOW for one live tool call: bind → grant (verbatim arms). */
export async function admitCall({ tg, ta }, { registeredName, callId, requestedEffects, parametersFingerprint, policyArms }) {
  const kernelEvents = []
  const { kernel, ledger } = makeLiveHarness(ta, { policy: () => allowPolicy(tg, policyArms), onObserve: (row) => kernelEvents.push(row) })
  const request = {
    binding: binding(tg, registeredName),
    member: { teamSessionId: 'a5c08-ts', instanceId: 'a5c08-member' },
    callId,
    realmId: REALM,
    parametersFingerprint,
    requestedEffects,
  }
  const decision = await kernel.admit(request)
  if (!decision.ok) return { stage: 'admit-errored', error: decision.error, kernel, ledger, request, kernelEvents }
  const value = decision.value
  return {
    stage: value.kind,
    decision: value,
    grant: value.kind === 'admitted' ? value.grant : null,
    kernel,
    ledger,
    request,
    kernelEvents,
  }
}

/** Exec-edge consume through the PR2 kernel (one-shot law). */
export function execEdgeConsume(flow, { replay = false } = {}) {
  const { kernel, grant, request } = flow
  const r = kernel.consumeForExecution(grant, {
    currentAuthorityGeneration: 1,
    member: { teamSessionId: 'a5c08-ts', instanceId: 'a5c08-member' },
    callId: request.callId,
    realmId: REALM,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: request.parametersFingerprint,
    requestedEffects: request.requestedEffects,
    cancelRequested: false,
  })
  return r.ok ? { ok: true, replay } : { ok: false, replay, code: r.error.code, message: String(r.error.message) }
}

// ── the attachment world (byte-level faces, labelled fixture data) ──────────
/**
 * The attachment fixture: a REAL 1×1 PNG (70 bytes, decodable) plus its
 * base64 attachment form (how image attachments are actually transported),
 * plus a THUMBNAIL-form attachment deliberately placed OUTSIDE the read arm
 * (`thumb/`) so the bypass leg has a real object to try to reach.
 * Every decision below is computed from these files as they exist on disk.
 */
export const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function buildC08World(repoRoot) {
  const attach = join(repoRoot, 'attach')
  const thumb = join(repoRoot, 'thumb')
  mkdirSync(attach, { recursive: true })
  mkdirSync(thumb, { recursive: true })
  const pngBuf = Buffer.from(PNG_B64, 'base64')
  writeFileSync(join(attach, 'shot.png'), pngBuf)
  writeFileSync(join(attach, 'shot.png.b64'), pngBuf.toString('base64'))
  // the "thumbnail": same bytes, DIFFERENT location the read arm does NOT cover
  writeFileSync(join(thumb, 'shot.png.b64'), pngBuf.toString('base64'))
  return {
    attachDir: attach,
    thumbDir: thumb,
    png: { locator: join(attach, 'shot.png'), sha: sha256Buf(pngBuf), bytes: pngBuf.length },
    pngB64: { locator: join(attach, 'shot.png.b64') },
    thumbB64: { locator: join(thumb, 'shot.png.b64'), sha: sha256Buf(pngBuf) },
  }
}

/** Minimal PNG header decode (magic + IHDR width/height) — the DECODE stage of
 *  the chain, computed over bytes the chain actually carried. */
export function decodePng(buf) {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buf.length < 24 || !buf.subarray(0, 8).equals(magic)) return { ok: false, reason: 'png-magic-mismatch' }
  if (buf.subarray(12, 16).toString('latin1') !== 'IHDR') return { ok: false, reason: 'ihdr-chunk-missing' }
  return { ok: true, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/**
 * The PR2-admission-GATED lane instance for ONE call (admission-binding law:
 * bound per call). `admission` = { recheckCall(intent)→{ok|reason},
 * parametersFingerprint } carried over into the frozen AdmissionBoundFsCall
 * seam; `admission` ABSENT ⇒ the lane is the UNBOUND face — every operation
 * typed-refused with the reason named by the lane's own law 1
 * (`UNBOUND_ADMISSION_RECHECK` ⇒ `admission-unbound`), never NO_RECHECK-passed.
 */
export function makeGatedFs(cf, { repoRoot, admission, consumedGrantIds }) {
  const instances = [{ fs: FS_INSTANCE, rootDir: repoRoot, realmId: REALM, kind: 'absolute-path' }]
  const lane = cf.createAdmissionGatedControlledFs({
    instances,
    now: () => FIXED_NOW,
    currentAuthorityGeneration: 1,
    ...(consumedGrantIds === undefined ? {} : { consumed: (grantId) => consumedGrantIds.has(grantId) }),
    ...(admission === undefined ? {} : { admission }),
  })
  return lane
}

/** Read one file (locator-internal helper for the ungated RED face only). */
export function hostDirectRead(absPath) {
  return readFileSync(absPath)
}
