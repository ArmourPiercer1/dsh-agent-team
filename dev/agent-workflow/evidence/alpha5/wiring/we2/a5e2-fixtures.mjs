/**
 * a5e2-fixtures.mjs — W-E2 wiring LIVE builders (Alpha.5 wiring phase, W-E2:
 * editor / read_image faces + the Domain-mock tool family).
 *
 * Plain-ESM port of the ACCEPTED W5 fixture pattern
 * (`../w5/a5w5-fixtures.mjs`): every grant, ref, effect set and binding is
 * built through the frozen PR0/PR2 parsers from the COMMITTED
 * `packages/runtime/dist` barrels, and the jobs identity rides the PR7
 * jobs-gateway PUBLIC BARREL (kit-local compile, the accepted W7 shape).
 * This row re-implements NO law — it composes faces (IF-1).
 *
 * What is NEW here relative to W5 is only the DATA SOURCE that matrix M-13
 * registers as 待建 (planned-to-build): the Domain mock — a row-local device
 * registry with CAS versions and a lease interlock. It is a MOCK by plan
 * (acceptance-matrix M-13 evidence_types: "real-host-receipt（待建：Domain
 * mock CAS/模拟设备联锁）"), not production code, and it is labelled as such
 * on every response face it produces.
 *
 * FIXTURE-GRADE disclosure (identical caliber to W5/W7/W8): the kernel's
 * trusted inputs (clock, generations, documents, policy, ledger, assurance
 * probe) are fixture-grade; the parameters fingerprint is the assembly-
 * declared canonical digest; the gateway member identities use REAL host
 * session ids plus row-local instanceIds (disclosed on the state face).
 * Nothing here claims ENFORCE level.
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/we2/a5e2-fixtures
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

/** Load the dist barrels + the kit-local jobs-gateway build from absolute dirs. */
export async function loadA5E2Lanes({ distPackages, jobsBuild }) {
  const distUrl = (p) => new URL(`file://${join(distPackages, p)}`).href
  const [tg, ta, td, gw, cf] = await Promise.all([
    import(distUrl('domain/tool-governance/src/index.js')),
    import(distUrl('runtime/tool-admission/index.js')),
    import(distUrl('runtime/tool-dispatch/install.js')),
    import(new URL(`file://${join(jobsBuild, 'index.js')}`).href),
    import(distUrl('runtime/controlled-fs/src/index.js')),
  ])
  return { tg, ta, td, gw, cf }
}

export const REALM = 'a5e2-realm'
export const FIXED_NOW = 1_737_000_000_000

export const sha256 = (text) => `sha256:${createHash('sha256').update(String(text), 'utf8').digest('hex')}`

/** Assembly-declared canonical parameters digest for one call (fixture grade). */
export function canonicalParamsFingerprint(params) {
  const keys = Object.keys(params).sort()
  const canon = `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`).join(',')}}`
  return sha256(canon)
}

// ── PR2 fixture builders (W5 port, extended to the domain-ref effect) ──────

export function effectsFor(tg, { toolName, domainAuthorityId }) {
  const raw = [{ kind: 'tool-invoke', toolName, resource: null }]
  if (typeof domainAuthorityId === 'string' && domainAuthorityId !== '') {
    raw.push({ kind: 'domain-ref', domainAuthorityId, resource: null })
  }
  // the raw-array arm of the frozen parser canonicalizes (sorts + digests);
  // a claimed {effects, fingerprint} record would have to re-verify.
  const parsed = tg.parseRequestedEffectSet(raw)
  if (!parsed.ok) throw new Error(`a5e2 fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/**
 * Policy scope keys (port of a5p2-fixtures:145 + the kernel's own
 * domain-ref key law, admission-kernel/approval-case.ts:83:
 * `<realm>|domain:<domainAuthorityId>`).
 */
function scopeKey(effect, arm) {
  if (arm.kind === 'tool-invoke') return `${REALM}|tool:${arm.toolName}`
  if (arm.kind === 'domain-ref') return `${REALM}|domain:${arm.domainAuthorityId}`
  return `${REALM}|${arm.locator}`
}

/** allow-list document over EXPLICIT arms (kind + realm + locator|tool|domain). */
export function allowPolicy(tg, arms) {
  const parsed = tg.parseToolPolicyDocument({
    rules: arms.map((arm) => ({
      realmId: REALM,
      effectKind: arm.kind,
      matcher: { kind: 'exact', resource: scopeKey(null, arm) },
      maximumEffect: 'allow',
    })),
  })
  if (!parsed.ok) throw new Error(`a5e2 fixture policy rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function emptyHardDocs() {
  return { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } }
}

function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'node-lane-fallback' : null, realmId: REALM, trustRoot: real ? 'fixture:a5e2' : null, evidence: real ? 'dev/agent-workflow/evidence/alpha5/wiring/we2' : null }
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
    bindingId: `bind-a5e2-${toolName}`,
    agentScopeKey: 'a5e2-session',
    toolName,
    definitionIdentity: `def:a5e2-${toolName}`,
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
  if (!parsed.ok) throw new Error(`a5e2 fixture binding rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Kernel harness (same port as W5/PR3). */
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
    member: { teamSessionId: 'a5e2-ts', instanceId: 'a5e2-member' },
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
    member: { teamSessionId: 'a5e2-ts', instanceId: 'a5e2-member' },
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

// ── the Domain mock (planned-to-build data source, matrix M-13) ────────────
/**
 * Row-local MOCK: a device registry keyed by domainAuthorityId, each device
 * carrying a CAS version, a lease owner (attribution string), and a log;
 * every side effect lands on disk under <world>/domain/ (the device state
 * files + the append-only action ledger), so "0 side effects" is a BYTE-
 * level fact readable back from disk, not an in-process promise.
 *
 * The mock decides the DOMAIN half of the veto; the PR2 kernel above decides
 * the TEAM half. Neither path can override the other — that is the property
 * the assembly observes, not a property this file asserts.
 */
export function createDomainMock({ worldRoot, devices }) {
  const root = join(worldRoot, 'domain')
  const devicesRoot = join(root, 'devices')
  const ledgerPath = join(root, 'device-actions.jsonl')
  mkdirSync(devicesRoot, { recursive: true })
  const known = new Map()
  for (const d of devices) {
    const state = { domainAuthorityId: d.id, version: d.version ?? 0, lease_owner: d.leaseOwner ?? null, log: [] }
    writeFileSync(join(devicesRoot, `${d.slug}.json`), JSON.stringify(state, null, 2) + '\n')
    known.set(d.id, d.slug)
  }
  const statePath = (id) => join(devicesRoot, `${known.get(id)}.json`)
  const readState = (id) => JSON.parse(readFileSync(statePath(id), 'utf8'))
  const actionCount = () => {
    try { return readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim() !== '').length } catch { return 0 }
  }
  return {
    root, devicesRoot, ledgerPath,
    resolves: (id) => known.has(id),
    knownIds: () => [...known.keys()],
    readState,
    actionCount,
    /** The DomainPermit decision ONLY (read-only: a refusal touches nothing). */
    decide({ domainAuthorityId, memberKey, expectedVersion }) {
      if (!known.has(domainAuthorityId)) {
        return { ok: false, code: 'DOMAIN_DENIED', detail: 'unresolved-domain-reference', side_effects: 0 }
      }
      const st = readState(domainAuthorityId)
      if (st.lease_owner !== null && st.lease_owner !== memberKey) {
        return { ok: false, code: 'DOMAIN_DENIED', detail: `device-lease-owner=${String(st.lease_owner)} (actor is not the lease holder)`, observed_version: st.version, side_effects: 0 }
      }
      if (expectedVersion !== st.version) {
        return { ok: false, code: 'DOMAIN_DENIED', detail: `cas-version-stale expected=${String(expectedVersion)} actual=${String(st.version)}`, observed_version: st.version, side_effects: 0 }
      }
      return { ok: true, observed_version: st.version, side_effects: 0 }
    },
    /** The ONE side-effect surface (CAS advance + log line + ledger line). */
    act({ domainAuthorityId, memberKey, expectedVersion, op, leg }) {
      const st = readState(domainAuthorityId)
      const next = { ...st, version: st.version + 1, log: [...st.log, { seq: st.version + 1, op, at: new Date().toISOString(), actor: memberKey }] }
      if (st.lease_owner === null) next.lease_owner = memberKey
      writeFileSync(statePath(domainAuthorityId), JSON.stringify(next, null, 2) + '\n')
      appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), leg, op, domainAuthorityId, memberKey, version_before: st.version, version_after: next.version }) + '\n')
      return { ok: true, version_before: st.version, version_after: next.version, lease_owner: next.lease_owner, side_effects: 1 }
    },
    /** decide-then-act, for the row-driven (non-model) probe legs. */
    tryAct(args) {
      const d = this.decide(args)
      return d.ok ? this.act(args) : d
    },
    /** Snapshot of every device state AS ON DISK (byte-level side-effect face). */
    snapshot() {
      const out = {}
      for (const [id, slug] of known) {
        out[id] = existsSync(join(devicesRoot, `${slug}.json`)) ? readState(id) : null
      }
      return out
    },
  }
}
