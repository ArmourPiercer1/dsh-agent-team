/**
 * u7-w0b S5 — the FamilyAssembly seam: negatives + the plane fitness law.
 *
 *  N1 a descriptor whose contribution claims an UNDECLARED name is refused
 *     (seam check and through a real plane mount — typed refusalCode);
 *  N2 a family has no handle to approval/grant APIs: the capability object
 *     refuses authority-shaped keys, and the capabilities a REAL mount hands
 *     a descriptor reach no kernel/registry/consume function (by walk);
 *  N3 an unreviewed module never mounts: digest drift, an index entry not in
 *     the manifest, and a malformed descriptor all refuse the WHOLE set, and
 *     a real mount over such a set fails closed (PLANE_FAMILY_MANIFEST_REFUSED);
 *  N4 two families claiming the same name are refused (NAME_COLLISION through
 *     the real registry, the second family's typed code); a duplicate
 *     familyId is refused by the reviewed-set verifier;
 *  N5 a disabled family places no rows and its declared names still refuse
 *     before the body exactly as before (fs off: `read` owned, table null);
 *  F1 `team-tool-plane.mjs` (code, comments stripped) carries no
 *     family-specific literal — no familyId string, no family module path,
 *     no per-family flag or per-family approval copy — beyond the ONE named
 *     jobs-bridge import; a planted counterexample of each kind goes RED;
 *  F2 the generated family index is the one derived from the reviewed
 *     manifest and every listed digest matches (gen-family-index --check).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url) as Parameters<typeof fileURLToPath>[0])
const PLANE_SRC = join(REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')
const FAMILIES_DIR = join(REPO, 'packages/tools/families')
const REALM = 'u7w0b-seam-realm'
const fsInstance = { fs: 'u7w0b-seam-ctl', rootDir: '/u7w0b-seam-root', realmId: REALM, kind: 'absolute-path' }

type Seam = typeof import('../src/plugin/live/family-assembly.mjs')
const seam = async (): Promise<Seam> => (await import('../src/plugin/live/family-assembly.mjs')) as Seam
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

type Row = { name: string }
type PlaneValue = {
  definitions: readonly Row[]
  kernelGuard: { owns(n: string): boolean; identityFor(n: string): string | null }
  centerKernel: { familyIds: readonly string[]; registry: { view(): { candidates: readonly { familyId: string; origin: string }[] } } }
}
type Built = { ok: boolean; code?: string; message?: string; value: PlaneValue }
type Cap = Readonly<Record<string, unknown>> & { names?: Record<string, string>; presentationFace?: unknown }
async function mountWith(extra: Array<{ module: string; familyAssembly: object }> | null, plane: Record<string, unknown> = {}, opts: { tamper?: (dir: string) => void } = {}): Promise<Built> {
  vi.doUnmock('../../tools/families/index.mjs')
  vi.resetModules()
  if (extra !== null || opts.tamper !== undefined) {
    const real = await vi.importActual<typeof import('../../tools/families/index.mjs')>('../../tools/families/index.mjs')
    const dir = mkdtempSync(join(tmpdir(), 'u7w0b-families-'))
    for (const f of readdirSync(FAMILIES_DIR)) copyFileSync(join(FAMILIES_DIR, f), join(dir, f))
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    for (const e of extra ?? []) {
      writeFileSync(join(dir, e.module), `// probe descriptor ${e.module}\n`)
      manifest.families.push({ module: e.module, sha256: sha(join(dir, e.module)) })
    }
    writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    opts.tamper?.(dir)
    vi.doMock('../../tools/families/index.mjs', () => ({
      FAMILY_MANIFEST_PATH: join(dir, 'manifest.json'),
      FAMILY_INDEX: Object.freeze([...real.FAMILY_INDEX, ...(extra ?? [])]),
    }))
  }
  const mod = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as { createTeamToolPlaneAssembly(i: unknown): Built }
  return mod.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7w0b-seam-root',
    controlLeg: approvingControlLeg(),
    permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [] },
    realmId: REALM, templateId: 'u7w0b-tpl', role: 'member', instanceId: 'u7w0b-inst', onObserve: () => {},
    plane: { fsInstance, ...plane },
  })
}
afterEach(() => {
  vi.doUnmock('../../tools/families/index.mjs')
  vi.resetModules()
})

/** A minimal VALID probe family over the real contribution schema. */
function probeDescriptor(over: Record<string, unknown> = {}, claimNames: (cap: Cap) => string[] = () => ['u7w0b_probe'], contribNames?: (cap: Cap) => string[]) {
  return {
    schema: 'u7-family-assembly/1',
    familyId: 'dsh.u7w0b-probe-family',
    order: 90,
    placement: 90,
    config: {},
    enabled: () => true,
    claims: claimNames,
    disabledOwned: () => [],
    build: (cap: Cap) => {
      const names = (contribNames ?? claimNames)(cap)
      const digest = 'e'.repeat(64)
      return {
        definitions: claimNames(cap).map((name) => ({ name, description: 'probe', parameters: { type: 'object', properties: {}, additionalProperties: false }, execute: async () => ({ text: 'probe' }), output: cap.presentationFace })),
        contribution: {
          schemaVersion: { major: 1, minor: 0, patch: 0 },
          familyId: 'dsh.u7w0b-probe-family',
          familyVersion: '0.0.1',
          source: { kind: 'family-owned', selector: 'test:u7w0b-probe', digest },
          provider: { id: 'provider.u7w0b-probe', digest },
          requiredCapabilities: [],
          optionalCapabilities: [],
          visibility: { owner: 'family', nativeNames: names, aliases: [], profileRequirements: [] },
          definition: { owner: 'family', inputContractDigest: digest, outputContractDigest: digest, normalization: 'pure' },
          effects: { declared: false, kinds: [], targets: [] },
          execution: { declared: false, via: 'family-body' },
          lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary: 'host-signal' },
          result: { envelope: 'host', correlation: 'kernel' },
          obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
        },
      }
    },
    refusalCode: 'PLANE_SEAM_PROBE_REGISTRATION_REFUSED',
    ...over,
  }
}

describe('u7-w0b seam — positive control', () => {
  it('P0 a valid probe family mounts through the seam with ZERO plane change (the CA-01 shape)', async () => {
    const built = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: probeDescriptor() }])
    expect(built.ok, `${built.code} ${built.message}`).toBe(true)
    const v = built.value
    expect(v.definitions.map((d: Row) => d.name)).toContain('u7w0b_probe')
    expect(v.centerKernel.familyIds).toContain('dsh.u7w0b-probe-family')
    expect(v.kernelGuard.owns('u7w0b_probe')).toBe(true)
    const c = v.centerKernel.registry.view().candidates.find((x) => x.familyId === 'dsh.u7w0b-probe-family')
    expect(c?.origin).toBe('reviewed-manifest') // set by the plane, never by the family
  })
})

describe('u7-w0b seam — negatives', () => {
  it('N1 a contribution claiming an UNDECLARED name is refused (seam + real mount)', async () => {
    const { checkBuiltFamily } = await seam()
    const d = probeDescriptor({}, () => ['u7w0b_probe'], () => ['u7w0b_probe', 'u7w0b_smuggled'])
    const built = d.build({ presentationFace: {} }) as ReturnType<ReturnType<typeof probeDescriptor>['build']>
    expect(checkBuiltFamily(d as never, ['u7w0b_probe'], built as never).ok).toBe(false)
    const mounted = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: d }])
    expect(mounted.ok).toBe(false)
    expect(mounted.code).toBe('PLANE_SEAM_PROBE_REGISTRATION_REFUSED')
    expect(mounted.message).toContain('undeclared or missing name')
    // a placed row the descriptor did not declare is refused too
    const placedExtra = { ...built, definitions: [...built.definitions, { name: 'u7w0b_smuggled' }], contribution: { ...built.contribution, visibility: { ...built.contribution.visibility, nativeNames: ['u7w0b_probe'] } } }
    expect(checkBuiltFamily(d as never, ['u7w0b_probe'], placedExtra as never).ok).toBe(false)
  })

  it('N2 the capability object can carry no approval/grant handle (by construction)', async () => {
    const { makeFamilyCapabilities, CAPABILITY_KEYS, FORBIDDEN_CAPABILITY_KEYS } = await seam()
    for (const k of FORBIDDEN_CAPABILITY_KEYS) {
      expect(CAPABILITY_KEYS).not.toContain(k)
      expect(() => makeFamilyCapabilities({ [k]: {} })).toThrow(/FAMILY_CAPABILITY_UNKNOWN/)
    }
    expect(() => makeFamilyCapabilities({ smuggled: 1 })).toThrow(/FAMILY_CAPABILITY_UNKNOWN/)
    // what a REAL mount hands a descriptor: walk it; nothing reachable is a
    // kernel/registry/consume face.
    const seen: Cap[] = []
    const spy = probeDescriptor({ build: (cap: Cap) => { seen.push(cap); return probeDescriptor().build(cap) } })
    const built = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: spy }])
    expect(built.ok).toBe(true)
    expect(seen.length).toBe(1)
    const cap = seen[0] as Cap
    expect(Object.isFrozen(cap)).toBe(true)
    expect(Object.keys(cap).every((k) => (CAPABILITY_KEYS as readonly string[]).includes(k))).toBe(true)
    const AUTH = ['approvalFor', 'addApprovalEntry', 'replaceApprovalEntry', 'dropApprovalsForFamily', 'consumeOnce', 'consumeForExecution', 'register', 'revoke', 'publish', 'decide' + 'Grant']
    const visit = (v: unknown, depth: number, path: string) => {
      if (v === null || (typeof v !== 'object' && typeof v !== 'function') || depth > 3) return
      for (const k of Object.keys(v as object)) {
        expect(AUTH, `authority face reachable at ${path}.${k}`).not.toContain(k)
        visit((v as Record<string, unknown>)[k], depth + 1, `${path}.${k}`)
      }
    }
    visit(cap, 0, 'cap')
  })

  it('N3 an unreviewed / drifted module never mounts (whole set refused, mount fails closed)', async () => {
    const { verifyReviewedFamilies } = await seam()
    const real = await import('../../tools/families/index.mjs')
    expect(verifyReviewedFamilies({ manifestPath: real.FAMILY_MANIFEST_PATH, entries: real.FAMILY_INDEX }).ok).toBe(true)
    // (a) an index entry the manifest does not list
    const extra = verifyReviewedFamilies({ manifestPath: real.FAMILY_MANIFEST_PATH, entries: [...real.FAMILY_INDEX, { module: 'rogue.mjs', familyAssembly: probeDescriptor() }] })
    expect(extra.ok).toBe(false)
    // (b) a listed module whose bytes drifted from the reviewed digest — real mount
    const drifted = await mountWith(null, {}, { tamper: (dir) => writeFileSync(join(dir, 'search.mjs'), `${readFileSync(join(dir, 'search.mjs'), 'utf8')}// drift\n`) })
    expect(drifted.ok).toBe(false)
    expect(drifted.code).toBe('PLANE_FAMILY_MANIFEST_REFUSED')
    expect(drifted.message).toContain('does not match its reviewed digest')
    // (c) a malformed descriptor (unknown key) in a reviewed slot
    const malformed = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: { ...probeDescriptor(), selfEnable: true } }])
    expect(malformed.ok).toBe(false)
    expect(malformed.code).toBe('PLANE_FAMILY_MANIFEST_REFUSED')
    expect(malformed.message).toContain("unknown descriptor key 'selfEnable'")
  })

  it('N4 two families claiming the same name are refused; a duplicate familyId is refused', async () => {
    const thief = probeDescriptor({}, (cap: Cap) => [String(cap.names?.grep)])
    const built = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: thief }])
    expect(built.ok).toBe(false)
    expect(built.code).toBe('PLANE_SEAM_PROBE_REGISTRATION_REFUSED')
    expect(built.message).toContain('NAME_COLLISION')
    const twin = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: probeDescriptor({ familyId: 'dsh.search-family' }) }])
    expect(twin.ok).toBe(false)
    expect(twin.code).toBe('PLANE_FAMILY_MANIFEST_REFUSED')
    expect(twin.message).toContain("familyId 'dsh.search-family' appears twice")
  })

  it('N5 a disabled family places no rows; its declared names still refuse before the body', async () => {
    const off = await mountWith(null, { fsInstance: null })
    expect(off.ok).toBe(true)
    const v = off.value
    for (const n of ['read', 'write', 'edit', 'read_image']) expect(v.definitions.find((d: Row) => d.name === n)).toBeUndefined()
    expect(v.centerKernel.familyIds).not.toContain('dsh.fs-family')
    expect(v.kernelGuard.owns('read')).toBe(true) // REVIEW-R1 B2: owned, table NULL ⇒ refused before body
    expect(v.kernelGuard.identityFor('read')).toBeNull()
    expect(v.kernelGuard.owns('write')).toBe(false) // exactly as at base: write never owned without the row
    // a disabled probe family with declared disabledOwned names
    const disabled = await mountWith([{ module: 'u7w0b-probe.mjs', familyAssembly: probeDescriptor({ enabled: () => false, disabledOwned: () => ['u7w0b_probe'] }) }])
    expect(disabled.ok).toBe(true)
    expect(disabled.value.definitions.find((d: Row) => d.name === 'u7w0b_probe')).toBeUndefined()
    expect(disabled.value.kernelGuard.owns('u7w0b_probe')).toBe(true)
    expect(disabled.value.kernelGuard.identityFor('u7w0b_probe')).toBeNull()
    expect(disabled.value.centerKernel.familyIds).not.toContain('dsh.u7w0b-probe-family')
  })
})

/* ── F1 the plane fitness law ──────────────────────────────────────── */

/** Strip // and block comments, leaving string/template contents intact. */
function codeOnly(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    const n = src[i + 1]
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue }
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      out += c
      i += 1
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i += 1 } out += src[i] ?? ''; i += 1 }
      out += src[i] ?? ''
      i += 1
      continue
    }
    out += c
    i += 1
  }
  return out
}
/** The ONE allowed family-specific edge: the named jobs bridge (S4). */
const NAMED_BRIDGE_IMPORT = "from './jobs-family-bridge.mjs'"
function familyLiterals(src: string) {
  const code = codeOnly(src).replace(NAMED_BRIDGE_IMPORT, '')
  const hits: Array<{ kind: string; text: string }> = []
  for (const m of code.matchAll(/['"`]dsh\.[a-z0-9-]+-family['"`]/g)) hits.push({ kind: 'familyId', text: m[0] })
  for (const m of code.matchAll(/[a-z0-9-]+-family(\/src)?\/[A-Za-z0-9_./-]*\.m?js|tools\/families\/(?!index\.mjs)[a-z0-9-]+\.mjs|-family-bridge\.mjs/g)) hits.push({ kind: 'module-path', text: m[0] })
  for (const m of code.matchAll(/\bkernelFamilies\b|\.families\.(read|fsMutation|shell|search|jobs)\b|\bensure[A-Z][A-Za-z]*ApprovalEntry\b|\b[a-z]+EntryAttempted\b/g)) hits.push({ kind: 'per-family-flag', text: m[0] })
  return hits
}

describe('u7-w0b fitness F1 — the plane names no family', () => {
  const src = readFileSync(PLANE_SRC, 'utf8')
  it('team-tool-plane.mjs carries no familyId, family module path, or per-family flag/copy (only the named jobs bridge import)', () => {
    expect(familyLiterals(src)).toEqual([])
    expect(src.split(NAMED_BRIDGE_IMPORT).length - 1, 'exactly one named-bridge import').toBe(1)
  })
  it('sensitivity: each kind of planted counterexample goes RED', () => {
    const plants = [
      ["\nconst x = registry.revoke('dsh.search-family', 'r')\n", 'familyId'],
      ["\nimport { y } from '../../../../tools/search-family/src/index.mjs'\n", 'module-path'],
      ["\nimport { z } from '../../../../tools/families/search.mjs'\n", 'module-path'],
      ["\nimport { w } from './other-family-bridge.mjs'\n", 'module-path'],
      ['\nconst kernelFamilies = { search: false }\n', 'per-family-flag'],
      ['\nif (centerKernel.families.search === true) {}\n', 'per-family-flag'],
      ['\nconst ensureSearchApprovalEntry = () => null\n', 'per-family-flag'],
      ['\nlet readEntryAttempted = false\n', 'per-family-flag'],
    ] as const
    for (const [plant, kind] of plants) {
      const hits = familyLiterals(src + plant)
      expect(hits.some((h) => h.kind === kind), `plant not caught: ${plant.trim()}`).toBe(true)
    }
    // comments are not code: a family name in a comment stays green
    expect(familyLiterals(`${src}\n// see packages/tools/search-family/src/index.mjs and 'dsh.fs-family'\n`)).toEqual([])
  })
})

describe('u7-w0b fitness F2 — the family index is the reviewed manifest', () => {
  it('gen-family-index --check is green (index derived, digests match, no unlisted module)', () => {
    const out = execFileSync('node', [join(REPO, 'scripts/gen-family-index.mjs'), '--check'], { cwd: REPO, encoding: 'utf8' })
    // The COUNT is the reviewed manifest's fact; the fitness law is "index
    // == manifest". u7-f added the fourth family (dsh.ui-family), so the
    // derived count is 4 — a family joining legitimately moves it.
    expect(out).toContain('OK (4 reviewed famil(ies))')
  })
})
