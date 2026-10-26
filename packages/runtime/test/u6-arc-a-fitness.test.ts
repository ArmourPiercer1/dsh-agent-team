/**
 * U6 PR5 — the ARCHITECTURE FITNESS GATE (slice scope C1). Four laws, each
 * with a planted-counterexample leg (slice plan §10.5-6: a law nobody can
 * falsify polices nothing): every leg that must pass GREEN against the real
 * tree is paired with an in-memory MUTATION that the same scanner must
 * catch. The mutations are always to the scanner's INPUT MAP — never to
 * the disk.
 *
 *  L1 protected-center digest lock  (ledger: arc-a-protected-center.json)
 *  L2 no-tool-name-branch law       (governance-center source scan)
 *  L3 family census                 (ledger: arc-a-family-census.json)
 *  L4 contribution closedness       (scanner over contribution sources)
 *
 * The scanners live in `packages/testkit/test/arc-a-fitness/scan.mjs`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PROTECTED_CENTER_SET,
  isProtectedPath,
  readTreeMap,
  scanCensus,
  scanClosedness,
  scanContributions,
  scanNameLiterals,
  scanProtectedLedger,
  sha256Text,
  trackedContributionPaths,
  trackedProtectedFiles,
} from '../../testkit/test/arc-a-fitness/scan.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')

const loadLedger = (name: string) =>
  JSON.parse(readFileSync(join(repoRoot, 'dev/agent-workflow/ledgers', name), 'utf8')) as {
    schema: string
    bookedFrom?: string
    files: Array<{ path: string; sha256: string }>
    overrides: Array<{ path: string; sha256: string; pr: string; reason: string }>
    families?: Array<{ familyId: string; lane: string; mount: string; contributionPaths: string[] }>
  }

describe('ARC-A fitness L1 — the protected center is digest-locked', () => {
  const ledger = loadLedger('arc-a-protected-center.json')
  const tracked = trackedProtectedFiles(repoRoot)
  const current = readTreeMap(repoRoot, tracked)

  it('the protected set is real and the booking is non-vacuous', () => {
    expect(PROTECTED_CENTER_SET.length).toBeGreaterThanOrEqual(11)
    expect(tracked.length).toBeGreaterThanOrEqual(30)
    expect(ledger.files.length).toBe(tracked.length)
    // The booking covers every tracked file in the set — and nothing else.
    expect(ledger.files.map((f) => f.path).sort()).toEqual(tracked)
  })

  it('the BOOKED digests are the BASE blobs themselves (the ledger cannot book an already-drifted byte)', () => {
    const base = ledger.bookedFrom as string
    for (const f of ledger.files) {
      const blob = execFileSync('git', ['show', `${base}:${f.path}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      expect(sha256Text(blob), `booked digest must equal the ${base.slice(0, 9)} blob: ${f.path}`).toBe(f.sha256)
    }
  })

  it('the working tree answers the ledger with ZERO drift (the PR5 zero-center-diff law)', () => {
    const { violations } = scanProtectedLedger({ current, ledger, tracked })
    expect(violations, JSON.stringify(violations, null, 1)).toEqual([])
  })

  it('sensitivity: a drifted byte, a smuggled new file, and a vanished file ALL light up; only a NAMED override silences drift', () => {
    const somePath = ledger.files[0]!.path
    // (a) one byte of drift → digest-drift
    const tampered = new Map(current)
    tampered.set(somePath, `${current.get(somePath)}\n// smuggled\n`)
    const drift = scanProtectedLedger({ current: tampered, ledger, tracked })
    expect(drift.violations.some((v) => v.path === somePath && v.kind === 'digest-drift')).toBe(true)
    // (b) an UNBOOKED new protected file → ledger-missing
    const smuggled = [...tracked, 'packages/runtime/tool-dispatch/smuggled.ts']
    const smuggledMap = new Map(current).set('packages/runtime/tool-dispatch/smuggled.ts', 'export const x = 1\n')
    const missing = scanProtectedLedger({ current: smuggledMap, ledger, tracked: smuggled })
    expect(missing.violations.some((v) => v.kind === 'ledger-missing' && v.path.endsWith('smuggled.ts'))).toBe(true)
    // (c) a booked path vanishes → ledger-stale
    const minusOne = tracked.filter((p) => p !== somePath)
    const stale = scanProtectedLedger({ current, ledger, tracked: minusOne })
    expect(stale.violations.some((v) => v.kind === 'ledger-stale' && v.path === somePath)).toBe(true)
    // (d) a named override citing the EXACT digest silences; a stale or
    //     mismatched override citation does NOT (the override must name the
    //     new truth — center-interface PRs sign their own bytes).
    const driftedNow = sha256Text(tampered.get(somePath)!)
    // APPEND, not replace: a real merge may carry named overrides (e.g. the
    // PR #377 re-anchor on agent-bindings.mjs); replacing them here would
    // surface their baseline drift as false positives of this self-test.
    const withOverride = { ...ledger, overrides: [...(ledger.overrides ?? []), { path: somePath, sha256: driftedNow, pr: 'PR #000 (center-interface)', reason: 'fitness self-test' }] }
    expect(scanProtectedLedger({ current: tampered, ledger: withOverride, tracked }).violations).toEqual([])
    const wrongOverride = { ...ledger, overrides: [...(ledger.overrides ?? []), { path: somePath, sha256: '0'.repeat(64), pr: 'PR #000', reason: 'fitness self-test' }] }
    expect(scanProtectedLedger({ current: tampered, ledger: wrongOverride, tracked }).violations.length).toBe(1)
  })
})

describe('ARC-A fitness L2 — the Governance Center knows NO tool names', () => {
  const centerFiles = [
    'packages/runtime/governance-center/kernel.ts',
    'packages/runtime/governance-center/registry.ts',
    'packages/runtime/governance-center/host-adapter.ts',
    'packages/runtime/governance-center/contribution-schema.ts',
    'packages/runtime/governance-center/index.ts',
  ]

  it('the center source carries ZERO tool-name string literals', () => {
    const files = readTreeMap(repoRoot, centerFiles)
    const { hits } = scanNameLiterals({ files })
    expect(hits, JSON.stringify(hits)).toEqual([])
  })

  it('sensitivity: a planted equality-branch on a tool name in a kernel copy is caught', () => {
    const files = readTreeMap(repoRoot, centerFiles)
    const planted = new Map(files)
    const kernelPath = 'packages/runtime/governance-center/kernel.ts'
    planted.set(kernelPath, `${files.get(kernelPath)}\nfunction smuggledBranch(name: string) { return name === 'grep' }\n`)
    const { hits } = scanNameLiterals({ files: planted })
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits.some((h) => h.path === kernelPath && h.literal === 'grep')).toBe(true)
  })
})

describe('ARC-A fitness L3 — the family census is complete', () => {
  const ledger = loadLedger('arc-a-family-census.json')!
  const censusLedger = ledger as unknown as { families: Array<{ familyId: string; lane: string; mount: string; contributionPaths: string[] }> }
  const paths = trackedContributionPaths(repoRoot)
  const files = readTreeMap(repoRoot, paths)
  const scan = scanContributions({ paths, files })

  it('every family contribution on the tree is booked; every booking is on the tree', () => {
    expect(scan.contributions.length).toBeGreaterThanOrEqual(4)
    const { violations } = scanCensus({ contributions: scan.contributions, ledger: censusLedger })
    expect(violations, JSON.stringify(violations, null, 1)).toEqual([])
  })

  it('the probe lane stays test-only: a PRODUCT file may never import it', () => {
    const probeLane = 'tests/u6-arc-a-probe-family/src/probe-assembly.mjs'
    const offenders = execFileSync('git', ['ls-files', 'packages'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .filter((p) => p.endsWith('.mjs') || p.endsWith('.ts'))
      // PRODUCTION files only: /test/ suites and the dist mirror of them
      // are exactly where importing the probe lane is THE point of the law.
      .filter((p) => !p.includes('/test/') && !p.includes('.test.') && !p.includes('/dist/'))
      .filter((p) => {
        try {
          return readFileSync(join(repoRoot, p), 'utf8').includes(probeLane)
        } catch {
          return false
        }
      })
    expect(offenders, 'product files importing the test-only probe lane').toEqual([])
  })

  it('sensitivity: an unbooked new family, a vanished family, and a familyId drift all light up', () => {
    const planted = {
      paths: [...paths, 'packages/tools/smuggled-family/src/smuggled-contribution.mjs'],
      files: new Map(files).set('packages/tools/smuggled-family/src/smuggled-contribution.mjs', "export const c = { familyId: 'dsh.smuggled-family', visibility: { nativeNames: ['sneak'] } }\n"),
    }
    const plantedScan = scanContributions({ paths: planted.paths, files: planted.files })
    const missing = scanCensus({ contributions: plantedScan.contributions, ledger: censusLedger })
    expect(missing.violations.some((v) => v.kind === 'census-missing' && v.path.includes('smuggled'))).toBe(true)
    // vanished: drop the search-family contribution from the scan input.
    const dropped = scan.contributions.filter((c) => !c.path.includes('search-family'))
    const stale = scanCensus({ contributions: dropped, ledger: censusLedger })
    expect(stale.violations.some((v) => v.kind === 'census-stale' && v.path.includes('search-contribution'))).toBe(true)
    // drift: booked familyId no longer matches the source.
    const drifted = scan.contributions.map((c) => (c.path.includes('fs-read') ? { ...c, familyIds: ['dsh.renamed-family'] } : c))
    const drift = scanCensus({ contributions: drifted, ledger: censusLedger })
    expect(drift.violations.some((v) => v.kind === 'census-familyId-drift')).toBe(true)
  })
})

describe('ARC-A fitness L4 — contributions are closed', () => {
  const paths = trackedContributionPaths(repoRoot)
  const files = readTreeMap(repoRoot, paths)
  const scan = scanContributions({ paths, files })

  it('every real contribution: reviewed source, one literal familyId, readable names', () => {
    const { violations } = scanClosedness({ contributions: scan.contributions })
    expect(violations, JSON.stringify(violations, null, 1)).toEqual([])
    for (const c of scan.contributions) {
      expect(c.nativeNames, c.path).not.toBeNull()
      for (const n of c.nativeNames!) {
        expect(['literal', 'bound-definition'], `${c.path} :: ${n.entry}`).toContain(n.kind)
      }
    }
  })

  it('sensitivity: a dynamic nativeName reports not-verified and an unreviewed path reports unreviewed-source', () => {
    const plantedDynamic = scanContributions({
      paths: ['packages/tools/dyn-family/src/dyn-contribution.mjs'],
      files: new Map([['packages/tools/dyn-family/src/dyn-contribution.mjs',
        "export const c = { familyId: 'dsh.dyn-family', visibility: { nativeNames: [resolveName(session)] } }\n"]]),
    })
    const dyn = scanClosedness({ contributions: plantedDynamic.contributions })
    expect(dyn.violations.some((v) => v.kind === 'not-verified' && v.detail.includes('NON-literal'))).toBe(true)
    const plantedUnreviewed = scanContributions({
      paths: ['packages/runtime/src/plugin/live/secret-contribution.mjs'],
      files: new Map([['packages/runtime/src/plugin/live/secret-contribution.mjs',
        "export const c = { familyId: 'dsh.secret-family', visibility: { nativeNames: ['ok'] } }\n"]]),
    })
    const unrev = scanClosedness({ contributions: plantedUnreviewed.contributions })
    expect(unrev.violations.some((v) => v.kind === 'unreviewed-source')).toBe(true)
    // A two-familyId source is 'not-verified' too (one source, one family).
    const two = scanContributions({
      paths: ['packages/tools/two-family/src/two-contribution.mjs'],
      files: new Map([['packages/tools/two-family/src/two-contribution.mjs',
        "export const a = { familyId: 'dsh.a-family', visibility: { nativeNames: ['a'] } }; export const b = { familyId: 'dsh.b-family', visibility: { nativeNames: ['b'] } }\n"]]),
    })
    expect(scanClosedness({ contributions: two.contributions }).violations.some((v) => v.kind === 'not-verified')).toBe(true)
  })

  it('the scanner itself respects the protected-set shape (isProtectedPath sanity)', () => {
    expect(isProtectedPath('packages/runtime/tool-dispatch/install.ts')).toBe(true)
    expect(isProtectedPath('packages/runtime/governance-center/kernel.ts')).toBe(true)
    expect(isProtectedPath('packages/runtime/src/plugin/live/team-tool-plane.mjs')).toBe(false)
    expect(isProtectedPath('packages/tools/search-family/src/index.mjs')).toBe(false)
  })
})
