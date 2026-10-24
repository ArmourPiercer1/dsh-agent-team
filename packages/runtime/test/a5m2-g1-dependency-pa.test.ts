/**
 * A5M2 G1-WIRE — the B-DEPENDENCY VERTICAL SLICE (center 14575 advance order,
 * M0 1 record `load_workspace_dependencies`).
 *
 * One runnable chain over the REAL surfaces:
 *   classify (real adapter row, record 25)
 *     -> the REAL production target-validation entry
 *        (validatePaFamilyTarget = control/types.ts, the same law the plane's
 *        paAdmit funnel runs before the durable row) with the NOW-LANDED
 *        PA_FAMILY_TARGET_RULES['B-DEPENDENCY'] (target per
 *        M0-B-FAMILY-TARGET-CONTRACTS.md §B-DEPENDENCY: the F-envelope
 *        locators at FULL VALUE + the reviewed-encoding installPathRef leaf +
 *        the trusted TARGETS envelope as flat leaves),
 *     -> delegate running the REAL EXPORTED 639 installPrimaryRuntime over a
 *        REAL payload world (compatibleManifest gate, staging copy,
 *        validatePayloadEntries, rename-commit) — the reused path REPORTS its
 *        residual gaps (REUSE ≠ CONTRACT, 89a9); the row never stages/hashes
 *        of its own.
 * Plus the fail-closed arms: facts absent, arm unmounted (zero fs), facts
 * moved after classify (stale), the mounted path moved after bind (drift).
 *
 * IT IS NOT C2 and no leg claims C2: no Host process, no live plane mount.
 * The row's plane-side paAdmit WALK (record 25 is not a plane-mounted row
 * yet) and the owner-side mount of dependencyFacts/controlledInstall from the
 * plugin config are the NAMED remaining gaps reported to the center.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-dependency-pa
 */
import { describe, it, expect, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { arch as osArch, platform as osPlatform } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'

type Refusal = { ok: false; code: string; detail: string }
type Success = {
  ok: true
  plan: unknown
  name: string
  effects: Array<Record<string, unknown>>
  targetManifest: Record<string, unknown>
  reviewPayload: { familyId: string; adapterRevision: number; providerIdentity: string; targetManifest: Record<string, unknown> }
}
type ClassifyResult = Success | Refusal
type DelegateResult = { ok?: boolean; settled?: string; code?: string; detail?: string; value?: unknown; verifiedBy?: string; residualGap?: string }
type G1Row = {
  name: string
  classify: (args: unknown, callId: string) => ClassifyResult
  delegate: (plan: unknown, ctx?: { exec?: unknown }) => Promise<DelegateResult>
}
type G1Module = {
  A5_G1_ADAPTER_REVISION: number
  A5_G1_DEPENDENCY_ADAPTER_REVISION: number
  A5_G1_DEPENDENCY_INSTALL_PATH_REF: string
  mountG1SurfaceAdapter: (recordName: string, deps?: Record<string, unknown>) => G1Row
}

const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as G1Module

// ── REAL host seams from the pristine baseline (r9 pattern; fail closed) ───
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const WORKDEP_LIB = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'skill', 'tool-workspace-dependencies', 'lib', 'index.js')
if (!existsSync(WORKDEP_LIB)) throw new Error(`pristine workspace-dependencies lib absent (${WORKDEP_LIB}); failing closed`)
const HOST_WORKDEP = (await import(pathToFileURL(WORKDEP_LIB).href)) as unknown as {
  installPrimaryRuntime: (source: string, root: string) => Promise<Record<string, string>>
}

// ── REAL payload world the REAL controlled path installs from ─────────────
const WORLD_ROOT = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), 'g1-dep-pa-world-'))
const DEP_SOURCE = join(WORLD_ROOT, 'payload')
const DEP_ROOT = join(WORLD_ROOT, 'runtimes', 'primary')
mkdirSync(join(DEP_SOURCE, 'dependencies', 'python', 'bin'), { recursive: true })
mkdirSync(join(DEP_SOURCE, 'dependencies', 'python', 'lib', 'python3.12', 'site-packages'), { recursive: true })
const MANIFEST = { desktopVersion: '0.2.0-rc.2', platform: osPlatform(), arch: osArch(), python: '3.12.1', pythonPackages: {} }
writeFileSync(join(DEP_SOURCE, 'runtime.json'), JSON.stringify(MANIFEST), 'utf8')
writeFileSync(join(DEP_SOURCE, 'dependencies', 'python', 'bin', 'python3'), '#!/bin/sh\n', 'utf8')
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

const TRUSTED = {
  memberAgentId: 'agent-member-1',
  sessionHeaderId: 'session-header-77',
  realmId: 'realm-alpha',
  owner: 'owner-root-1',
  profileId: 'profile-live-1',
}
const BINDINGS = () => ({ bindingId: 'binding-3', bindingRevision: 7, policyGeneration: 3, authorityGeneration: 2 })

const NATIVE_DESCRIPTION = 'Get absolute paths to bundled Python and library directories, plus bundled Python distribution versions.'
let nativeCalls = 0
const NATIVE = {
  name: 'load_workspace_dependencies',
  description: NATIVE_DESCRIPTION,
  parameters: {},
  execute: async () => { nativeCalls += 1; return {} },
}

function mountRow(input: {
  facts?: () => { sourceLocator: string; rootLocator: string } | undefined
  controlledInstall?: { installPrimaryRuntime: (source: string, root: string) => Promise<Record<string, string>> } | null
} = {}): { row: G1Row } {
  const facts = input.facts ?? (() => ({ sourceLocator: DEP_SOURCE, rootLocator: DEP_ROOT }))
  const deps: Record<string, unknown> = {
    native: NATIVE,
    definitionIdentity: 'plugin@639ed01539#load_workspace_dependencies',
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports: { dependencyFacts: { current: () => facts() } },
  }
  if (input.controlledInstall !== null) {
    deps.controlledInstall = input.controlledInstall ?? { installPrimaryRuntime: HOST_WORKDEP.installPrimaryRuntime }
  }
  return { row: G1.mountG1SurfaceAdapter('load_workspace_dependencies', deps) }
}

describe('a5m2-g1-dependency-pa — B-DEPENDENCY vertical slice (record 25): rule landed, real classify target validates through the REAL production entry, the REAL 639 controlled path runs, fail-closed arms hold', () => {
  it('(A) the rule LANDED in the closed table with the M0 shape: no variant (ONE minted claim shape — no speculative widening), the three F-envelope locators + installPathRef + the five trusted flat leaves, currentFields = the three CONFIG facts only', () => {
    const rule = PA_FAMILY_TARGET_RULES['B-DEPENDENCY']
    expect(rule).toBeDefined()
    expect(Object.keys(rule?.required ?? {}).slice().sort()).toEqual([
      'installPathRef', 'parentLocator', 'rootLocator', 'sourceLocator',
      'trustedMemberAgentId', 'trustedOwner', 'trustedProfileId', 'trustedRealmId', 'trustedSessionHeaderId',
    ].sort())
    expect(rule?.variant).toBeUndefined()
    expect(rule?.currentFields).toEqual(['trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId'])
    // manifest versions / payload digests / install results are resource-derived:
    // NO current field may pretend to restate them from pure data.
    expect(PA_FAMILY_TARGET_RULES['B-DEPENDENCY']?.currentFields.some((field) => /digest|version|result|payload/i.test(field))).toBe(false)
  })

  it('(B) the REAL classify output carries the FLAT-LEAF target at FULL VALUE (no nested installFacts/armLaw, no nested trusted) and validates through the REAL production entry; the row stamps its OWN family revision while the B-INSPECT pair still carries 7', () => {
    const { row } = mountRow()
    const classified = row.classify({}, 'call-pa-1')
    expect(classified.ok, JSON.stringify(classified)).toBe(true)
    if (!classified.ok) return
    const target = classified.targetManifest
    expect(target.sourceLocator).toBe(DEP_SOURCE)
    expect(target.rootLocator).toBe(DEP_ROOT)
    expect(target.parentLocator).toBe(join(WORLD_ROOT, 'runtimes'))
    expect(target.installPathRef).toBe(G1.A5_G1_DEPENDENCY_INSTALL_PATH_REF)
    expect(target.trustedMemberAgentId).toBe(TRUSTED.memberAgentId)
    expect(target.trustedSessionHeaderId).toBe(TRUSTED.sessionHeaderId)
    expect(target.trustedRealmId).toBe(TRUSTED.realmId)
    expect(target.trustedOwner).toBe(TRUSTED.owner)
    expect(target.trustedProfileId).toBe(TRUSTED.profileId)
    // the retired draft shapes are GONE from the durable claim:
    expect('installFacts' in target).toBe(false)
    expect('armLaw' in target).toBe(false)
    expect('trusted' in target).toBe(false)
    // the REAL production validation entry (the same law the plane runs):
    expect(validatePaFamilyTarget('B-DEPENDENCY', target)).toBeUndefined()
    expect(classified.reviewPayload.familyId).toBe('B-DEPENDENCY')
    expect(classified.reviewPayload.adapterRevision).toBe(G1.A5_G1_DEPENDENCY_ADAPTER_REVISION)
    expect(G1.A5_G1_DEPENDENCY_ADAPTER_REVISION).toBe(8)
    // explicit invalidation is family-scoped: the G1 default stamp did NOT move.
    expect(G1.A5_G1_ADAPTER_REVISION).toBe(7)
  })

  it('(C) the F-envelope effect law rides the same claim: list(payload)+read(source/runtime.json)+read(root/runtime.json)+write(parent)+write(root)+write(root .previous) — the per-item copy/rename/delete the M0 line enumerates, zero fs done by the row itself', () => {
    const { row } = mountRow()
    const classified = row.classify({}, 'call-pa-2')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    const shapes = classified.effects.map((effect) => `${String(effect.kind)}:${(effect.resource as Record<string, unknown>)?.canonicalLocator ?? (effect.resource as Record<string, unknown>)?.locator ?? 'null'}`)
    expect(shapes.some((entry) => entry.startsWith('list:'))).toBe(true)
    expect(shapes.filter((entry) => entry.startsWith('write:')).length).toBe(3)
    expect(shapes.some((entry) => entry.includes(`${DEP_ROOT}.previous`))).toBe(true)
    expect(shapes.some((entry) => entry.includes(`${DEP_SOURCE}/runtime.json`))).toBe(true)
  })

  it('(D) adversarial targets deny NAMED fields through the SAME entry: missing leaf, wrong type, extra key (prototype names included), and a blank locator is refused MINT-side at classify', () => {
    const { row } = mountRow()
    const classified = row.classify({}, 'call-pa-3')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    const target = { ...classified.targetManifest } as Record<string, unknown>
    const missing = { ...target }
    delete missing.sourceLocator
    expect(String(validatePaFamilyTarget('B-DEPENDENCY', missing))).toContain('sourceLocator: required by the B-DEPENDENCY typed plan, absent')
    expect(String(validatePaFamilyTarget('B-DEPENDENCY', { ...target, rootLocator: 42 }))).toContain('rootLocator: not a string')
    expect(String(validatePaFamilyTarget('B-DEPENDENCY', { ...target, modelClaim: '/somewhere/else' }))).toContain('modelClaim: not part of the B-DEPENDENCY typed plan')
    // RECORDED OBSERVATION (pre-existing signed law, NOT changed here): for
    // NON-variant families the extra-key membership test is `field in
    // required`, whose prototype-chain reach lets prototype-named keys ride —
    // the OWN-KEY hardening is the variant families' law (the signed comment
    // keeps the non-variant law byte-identical). Mitigating fact: targetManifest
    // is MINT-side (classify builds it; model text never reaches it). Pinned as
    // measured truth, disclosed to the center rather than silently patched:
    expect(validatePaFamilyTarget('B-DEPENDENCY', { ...target, toString: 'x' })).toBeUndefined()
    // MINT-side: a blank locator never even reaches the table (the F-envelope
    // must be enumerable); empty string is not a locator.
    const blank = mountRow({ facts: () => ({ sourceLocator: '', rootLocator: DEP_ROOT }) })
    const refused = blank.row.classify({}, 'call-pa-4')
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.code).toBe('P_G1_DEPENDENCY_FACTS_ABSENT')
  })

  it('(E) the FULL chain runs the REAL exported 639 path: validate-undefined -> delegate installs (rename-commit, runtime.json + python present, staging self-cleaned); a fact that MOVED after classify is STALE (zero fs); a port fn that moved after bind is DEFINITION_DRIFT; every leg leaves the captured native untouched', async () => {
    // full green chain:
    const { row } = mountRow()
    const plan = (row.classify({}, 'call-pa-5') as Success).plan
    expect(validatePaFamilyTarget('B-DEPENDENCY', (plan as unknown as { targetManifest: Record<string, unknown> }).targetManifest)).toBeUndefined()
    const result = await row.delegate(plan, { exec: {} })
    expect(result.settled, JSON.stringify(result)).toBe('CONTROLLED-INSTALL-RESOLVED')
    expect(String(result.verifiedBy)).toContain('validatePayloadEntries')
    expect(String(result.residualGap)).toContain('ControlledFs')
    const paths = result.value as { python: string }
    expect(paths.python).toBe(join(DEP_ROOT, 'dependencies', 'python', 'bin', 'python3'))
    expect(existsSync(join(DEP_ROOT, 'runtime.json'))).toBe(true)
    expect(readdirSync(join(WORLD_ROOT, 'runtimes')).filter((entry) => entry.startsWith('.primary-runtime-'))).toEqual([])
    // stale: the facts moved between classify and the delegate edge —
    const movable = { current: DEP_ROOT }
    const mover = mountRow({ facts: () => ({ sourceLocator: DEP_SOURCE, rootLocator: movable.current }) })
    const stalePlan = (mover.row.classify({}, 'call-pa-6') as Success).plan
    movable.current = join(WORLD_ROOT, 'runtimes', 'moved')
    const staleResult = await mover.row.delegate(stalePlan, { exec: {} })
    expect(staleResult.code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(existsSync(join(WORLD_ROOT, 'runtimes', 'moved'))).toBe(false)
    // drift: the mounted path moved after bind —
    let calls = 0
    const swappable = { installPrimaryRuntime: async () => { calls += 1; return {} } }
    const drifter = mountRow({ controlledInstall: swappable })
    const driftPlan = (drifter.row.classify({}, 'call-pa-7') as Success).plan
    swappable.installPrimaryRuntime = async () => { calls += 1; return {} }
    const driftResult = await drifter.row.delegate(driftPlan, { exec: {} })
    expect(driftResult.code).toBe('P_G1_DEFINITION_DRIFT')
    expect(calls).toBe(0)
    // closed arm (no controlledInstall mounted): fail CLOSED, zero fs:
    const closed = mountRow({ controlledInstall: null })
    const closedPlan = (closed.row.classify({}, 'call-pa-8') as Success).plan
    const closedResult = await closed.row.delegate(closedPlan, { exec: {} })
    expect(closedResult.code).toBe('P_G1_DEPENDENCY_ARM_CLOSED')
    // and through ALL of it the captured native never ran:
    expect(nativeCalls).toBe(0)
  })
})
