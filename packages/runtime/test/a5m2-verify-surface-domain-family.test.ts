/**
 * A5M2-RSJ SURFACE lane — record `surface:domain_family` (B-DOMAIN,
 * M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX recordIndex 91). Ownerless row assigned
 * by the root's M0 no-master assignment (CENTER relay 2026-10-23): this spec
 * is the REAL-CHAIN NEGATIVE-VERIFY vertical slice scoped as
 * "TeamDomain 持久面族性事实的读验证" — the durable persistence face is REAL
 * (testkit FileStorageSeam + the committed repositories over it), the row is
 * the committed B-DOMAIN adapter, and every refusal is the module's OWN typed
 * code. NOT C2 and it claims no C2: no Host process, no network, no PA edge.
 *
 * What each leg proves (and where the honest edge is):
 *  U1 effect-family identity: the closed kind set the domain surface rides
 *     (`domain-ref` acts on its own arm — effects.ts:43 family anchor read
 *     from disk, E2→E1 for this lane), and the real parser's law over a
 *     domain-ref arm. A model-supplied domainAuthorityId is a CLAIM here —
 *     the trusted comparison is U5, never the parse.
 *  U2 persistence-face family facts: the TEN stores are the family; created
 *     through the real repositories they exist as real files on a real
 *     medium, and ONE real ledger append (factType `control-request-recorded`)
 *     lands in them. Without this, any "zero writes" claim below is vacuous —
 *     this leg is the LIVENESS CONTRAST for U3/U4.
 *  U3 Team-allow + Domain-deny (bidirectional non-override direction (a)):
 *     the row classifies (effects carry the domain-ref), the mounted port
 *     answers DENY, and the row NEVER translates the verdict into success;
 *     the whole leg leaves the real medium byte-identical (zero durable
 *     delta — scoped to the row, the commit-gate consumer is the PA edge,
 *     see the named gap).
 *  U4 Domain-allow mints NO tool permission (direction (b)): the allow
 *     verdict is one call's decision, not a credential — second delegate of
 *     the same plan refuses ALREADY_DELEGATED; classify mints nothing; the
 *     medium stays untouched.
 *  U5 claim/absent/drift: the three domain refusals with ZERO port entry
 *     (typed codes verbatim).
 *  U6 no-native-fallback: the row is DECLARED (in the frozen 14) but NOT
 *     placeable this round (outside the CLOSED PURE-QUERY placement set), a
 *     mount without its captured port refuses, and an invented registration
 *     name is dead at the registrar — nothing reaches a native body.
 *
 * NAMED GAPS (reported, never faked — verbatim into the receipt):
 *  G1 the boundary-decision obligation (`effect-boundary-ledger
 *     record-boundary-decision`, spec-table row 91) has NO durable face
 *     today: the ledger factType family carries no domain-decision member
 *     and no module appends one — U3's zero-write posture is the CURRENT
 *     truth, not the target obligation's satisfaction.
 *  G2 the C2 real domain gate is honest-absence at this tree exactly as the
 *     record idx spells ("C2=仅当已挂载真实 gate(核无→honest-absence)"): no
 *     public domain-authority registry is mounted anywhere in the product
 *     surface this lane can observe.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-verify-surface-domain-family
 */
import { describe, expect, it, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { EFFECT_KINDS } from '../../domain/tool-governance/src/effects.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { TEAM_DOMAIN_STORES, TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'

type Refusal = { ok: false; code: string; detail: string }
type ClassifySuccess = {
  ok: true
  plan: unknown
  effects: Array<Record<string, unknown>>
  targetManifest: Record<string, unknown>
}
type G1Row = {
  name: string
  familyId: string
  recordIndex: number
  classify: (args: unknown, callId: string) => ClassifySuccess | Refusal
  delegate: (plan: unknown, ctx?: { exec?: unknown }) => Promise<Record<string, unknown> & { ok?: boolean; settled?: string; value?: unknown; code?: string }>
}
type G1Module = {
  A5_G1_RECORD_SPECS: Record<string, { recordIndex: number; family: string; nativeFaceRef: string }>
  g1SurfaceAdapterNames: () => string[]
  mountG1SurfaceAdapter: (recordName: string, deps?: Record<string, unknown>) => G1Row
}
type SeamWriteFace = { writeCount: number }

const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as G1Module
type PlaneModule = { A5_G1_PURE_QUERY_MOUNT_NAMES: readonly string[] }
const PLANE = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneModule

// The 639 read-only base is a hard precondition (precedent: a5m2-g1 lane):
// this spec runs ON the pinned pristine host tree and fails closed without it.
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_TESTUSE = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
if (!existsSync(HOST_TESTUSE)) throw new Error(`pinned test-use base absent (${HOST_TESTUSE}); failing closed`)

const DOMAIN_NAME = 'surface:domain_family'
const TRUSTED = {
  memberAgentId: 'agent-member-df',
  sessionHeaderId: 'session-header-df',
  realmId: 'realm-df',
  owner: 'owner-df',
  profileId: 'profile-df',
}
const BINDINGS = () => ({ bindingId: 'binding-df', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 })
const GOOD_ARGS = { toolName: 'write', domainAuthorityId: 'domain-acme', targetDigest: 'sha256:deadbeef' }

function makeRow(options: {
  registry?: { domainAuthorityId: string; portRevision: number } | undefined
  decide?: (args: unknown, exec: unknown) => Promise<unknown>
} = {}): { row: G1Row; calls: Array<{ args: unknown }> } {
  const calls: Array<{ args: unknown }> = []
  const decide = options.decide ?? (async () => ({ decision: 'allow' }))
  const native = {
    name: DOMAIN_NAME,
    description: 'mounted Domain port consulted at the effect-commit boundary',
    decide: async (args: unknown, exec: unknown): Promise<unknown> => {
      calls.push({ args })
      return await decide(args, exec)
    },
  }
  const row = G1.mountG1SurfaceAdapter(DOMAIN_NAME, {
    native,
    providerId: 'rsj-surface',
    definitionIdentity: 'def-df-1',
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports: options.registry === undefined ? {} : { domainPortRegistry: { current: () => options.registry } },
  })
  return { row, calls }
}

// ── the real durable medium (liveness contrast for every zero-write claim) ──
const SCRATCH = mkdtempSync(join(tmpdir(), 'a5m2-df-'))
mkdirSync(join(SCRATCH, 'seam'), { recursive: true })
const seam = new FileStorageSeam(join(SCRATCH, 'seam')) as unknown as SeamWriteFace & { closeAll(): Promise<void> }
const domain = await createTeamDomain(seam as never)

function treeDigest(_root: string): string {
  const hash = createHash('sha256')
  // The seam persists ONE JSON file per KvTable under <scratch>/<domain>/;
  // hash the known family files directly — the store list IS the family.
  for (const store of TEAM_DOMAIN_STORES) {
    const f = join(SCRATCH, 'seam', 'team_domain', `${store}.json`)
    hash.update(store).update(':').update(existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex') : '<absent>')
  }
  return hash.digest('hex')
}

afterAll(async () => {
  try { await domain.close() } catch { /* closed */ }
  try { await seam.closeAll() } catch { /* closed */ }
  try { rmSync(SCRATCH, { recursive: true, force: true }) } catch { /* scratch */ }
})

describe('a5m2 surface:domain_family (B-DOMAIN) — persistence-face family facts + bidirectional non-override (author-side, NOT C2)', () => {
  it('U1 effect-family identity: the closed kind set carries domain-ref acting on its own arm (real parser + disk anchor)', () => {
    expect(Object.freeze([...EFFECT_KINDS])).toContain('domain-ref')
    expect(EFFECT_KINDS.join(',')).toBe('tool-invoke,read,write,list,meta,connect,domain-ref')
    // v3c family anchor (effects.ts:43) re-read from disk — E2→E1 for this lane.
    const effectsSrc = readFileSync(join(REPO_ROOT ?? '', 'packages', 'domain', 'tool-governance', 'src', 'effects.ts'), 'utf8').split('\n')
    expect(effectsSrc[42]).toContain("EFFECT_KINDS = ['tool-invoke'")
    // The real parser: the raw-array arm canonicalizes; a domain-ref rides
    // its OWN identity (no ResourceRef, closed record keys — a smuggled
    // targetDigest is a typed refusal), a missing authority id likewise.
    const parsed = parseRequestedEffectSet([
      { kind: 'domain-ref', domainAuthorityId: 'domain-acme', resource: null },
    ])
    expect(parsed.ok).toBe(true)
    const bare = parseRequestedEffectSet([{ kind: 'domain-ref', domainAuthorityId: 'domain-acme' }])
    expect(bare.ok).toBe(false)
    const bad = parseRequestedEffectSet([{ kind: 'domain-ref' }])
    expect(bad.ok).toBe(false)
    const smuggled = parseRequestedEffectSet([
      { kind: 'domain-ref', domainAuthorityId: 'domain-acme', resource: null, targetDigest: 'sha256:deadbeef' },
    ])
    expect(smuggled.ok).toBe(false)
  })

  it('U2 persistence-face family facts: TEN stores are the family, real files on a real medium, ONE real ledger append lands (liveness contrast)', async () => {
    expect(TEAM_DOMAIN_STORES).toHaveLength(10)
    expect(TEAM_DOMAIN_STORES.join(',')).toBe(
      'schema_meta,team_sessions,member_instances,session_bindings,overrides,compatibility,operations,ledger,blueprint_registry,permission_overlays',
    )
    expect(Object.keys(domain.repositories).sort()).toEqual([
      'blueprintRegistry', 'compatibility', 'ledger', 'memberInstances', 'operations',
      'overrides', 'permissionOverlays', 'schemaMeta', 'sessionBindings', 'teamSessions',
    ])
    const ledger = (domain.repositories as { ledger: { putPreTeam(e: unknown): Promise<unknown>; allocateSequence(): Promise<number>; list(): unknown[] } }).ledger
    expect(ledger.list()).toHaveLength(0)
    // PRE-TEAM append (the documented pre-mint fact arm — no TeamSession stamp
    // row exists in this scratch, the stamped `put` would loudly refuse).
    const seq = await ledger.allocateSequence()
    await ledger.putPreTeam({
      schemaVersion: 2,
      sequence: seq,
      rootSessionId: 'session-df-scratch',
      factType: 'control-request-recorded',
      payload: { requestId: 'df-1', toolName: 'read' },
      createdAt: new Date().toISOString(),
    })
    expect(ledger.list()).toHaveLength(1)
    // Durable NOWHERE near fake: the seam actually wrote — the family files exist.
    const digest = treeDigest(SCRATCH)
    expect(digest).toHaveLength(64)
    for (const store of TEAM_DOMAIN_STORES) {
      expect(existsSync(join(SCRATCH, 'seam', 'team_domain', `${store}.json`))).toBe(true)
    }
    const ledgerBytes = readFileSync(join(SCRATCH, 'seam', 'team_domain', 'ledger.json'), 'utf8')
    expect(ledgerBytes).toContain('control-request-recorded')
    expect(TEAM_DOMAIN_SCHEMA_VERSION).toBe(2)
  })

  it('U3 Team-allow + domain-deny: the row never translates DENY into success; whole leg zero durable delta on the real medium (zero native FALLBACK, verdict verbatim)', async () => {
    const before = seam.writeCount
    const digestBefore = treeDigest(SCRATCH)
    let denyCount = 0
    const { row, calls } = makeRow({
      registry: { domainAuthorityId: 'domain-acme', portRevision: 4 },
      decide: async () => { denyCount += 1; return { decision: 'deny', reason: 'rsjc2-domain-vertical-deny' } },
    })
    const classified = row.classify(GOOD_ARGS, 'call-df-deny-1')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    expect(classified.effects[0]).toEqual({ kind: 'domain-ref', domainAuthorityId: 'domain-acme', resource: null })
    const settled = await row.delegate(classified.plan)
    // the domain verdict passes through VERBATIM — the row holds no authority
    // to re-judge it into a success (Team allow never overrides domain deny;
    // the deny is the last word the commit boundary sees from this row).
    expect(calls).toHaveLength(1)
    expect(denyCount).toBe(1)
    expect(JSON.stringify(settled)).toContain('rsjc2-domain-vertical-deny')
    // Zero improper effects AT THE ROW, on the real medium: the deny leg wrote
    // nothing — no boundary-decision store exists to write (G1).
    expect(seam.writeCount).toBe(before)
    expect(treeDigest(SCRATCH)).toBe(digestBefore)
  })

  it('U4 domain-allow mints no tool permission: same plan cannot run twice; classify mints nothing; medium untouched', async () => {
    const before = seam.writeCount
    const digestBefore = treeDigest(SCRATCH)
    const { row, calls } = makeRow({
      registry: { domainAuthorityId: 'domain-acme', portRevision: 4 },
      decide: async () => ({ decision: 'allow' }),
    })
    const first = row.classify(GOOD_ARGS, 'call-df-allow-1')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // classify alone is a PLAN, never a permission: no grant artifact rides it.
    expect(JSON.stringify(first)).not.toContain('consumed')
    const ran1 = await row.delegate(first.plan)
    expect(ran1).toBeDefined()
    // one plan, one run — the allow verdict is not a credential to replay.
    const replay = await row.delegate(first.plan)
    expect(replay.code ?? '').toContain('ALREADY_DELEGATED')
    expect(calls).toHaveLength(1)
    expect(seam.writeCount).toBe(before)
    expect(treeDigest(SCRATCH)).toBe(digestBefore)
  })

  it('U5 claim/absent/drift: the three typed domain refusals, zero port entry', async () => {
    const bare = makeRow()
    const absent = bare.row.classify(GOOD_ARGS, 'call-df-absent')
    expect(absent.ok).toBe(false)
    if (absent.ok) return
    expect(absent.code).toBe('P_G1_DOMAIN_REGISTRY_ABSENT')

    const mounted = makeRow({ registry: { domainAuthorityId: 'domain-acme', portRevision: 4 } })
    const mismatch = mounted.row.classify({ ...GOOD_ARGS, domainAuthorityId: 'domain-evil' }, 'call-df-claim')
    expect(mismatch.ok).toBe(false)
    if (mismatch.ok) return
    expect(mismatch.code).toBe('P_G1_DOMAIN_CLAIM_MISMATCH')
    expect(mounted.calls).toHaveLength(0)

    let registry = { domainAuthorityId: 'domain-acme', portRevision: 4 }
    // build with a live registry, then MOVE it — the edge re-verifies.
    const driftRow = G1.mountG1SurfaceAdapter(DOMAIN_NAME, {
      native: {
        name: DOMAIN_NAME,
        description: 'drift face',
        decide: async () => ({ decision: 'allow' }),
      },
      providerId: 'rsj-surface',
      definitionIdentity: 'def-df-drift',
      trusted: TRUSTED,
      bindingFacts: BINDINGS,
      ports: { domainPortRegistry: { current: () => registry } },
    }) as G1Row
    const plan = driftRow.classify(GOOD_ARGS, 'call-df-drift')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    registry = { domainAuthorityId: 'domain-acme', portRevision: 5 }
    const stale = await driftRow.delegate(plan.plan)
    expect(stale.code ?? '').toContain('TRUSTED_FACTS_STALE')
  })

  it('U6 no-native-fallback: declared, NOT placeable, capture-less mount refuses, invented registration is dead at the registrar', () => {
    expect(G1.g1SurfaceAdapterNames()).toContain(DOMAIN_NAME) // the frozen 14
    expect(PLANE.A5_G1_PURE_QUERY_MOUNT_NAMES).not.toContain(DOMAIN_NAME) // placement law
    expect(G1.A5_G1_RECORD_SPECS[DOMAIN_NAME]?.nativeFaceRef).toBe('ledger:surface:domain_family')
    // A capture-less mount of a surface row has nothing to govern → refuses
    // at mount (a declared row can never be placed to mask a native name).
    expect(() => G1.mountG1SurfaceAdapter(DOMAIN_NAME, {
      providerId: 'rsj-surface',
      definitionIdentity: 'def-df-bare',
      trusted: TRUSTED,
      bindingFacts: BINDINGS,
      ports: {},
    } as never)).toThrow(/no mounted port|SAME native face/)
    // Dynamic invented registration: frozen name set, no guessed names.
    expect(() => G1.mountG1SurfaceAdapter('domain_authority_foo', {})).toThrow(TypeError)
  })
})
