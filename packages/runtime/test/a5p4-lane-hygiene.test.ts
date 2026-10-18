/**
 * a5p4-lane-hygiene — the lane keeps the shared files untouched:
 *
 *  (1) PURITY: `phases/contract-stub/fd-inheritance/network/realm-evidence`
 *      are node-free and import nothing outside the lane; only
 *      `probe-abi/provider` touch `node:*` (spawn + scratch I/O), and they too
 *      import nothing outside the lane (the local contract stub is the
 *      boundary to the frozen PR0 vocabulary, per INTERFACES-v1 "本地 contract
 *      stub" — the structural conformance below is what pins the mirror).
 *  (2) CONFORMANCE: the lane's closed sets are deep-equal to the frozen PR0
 *      sets (imported HERE, in a test file — outside the production consumer
 *      allow-list by the auditor's own walk).
 *  (3) TYPECHECK: the lane typechecks ITSELF, in-process, via
 *      ts.createProgram. (Since the G-d integration wiring round the shared
 *      runtime tsconfig DOES include `sandbox-provider` — the compile-face
 *      entry — but the self-check stays: it pins the lane's own strictness
 *      independent of the shared surface, and it predates the wiring.)
 *  (4) DORMANT: no production file outside the lane references the lane —
 *      the wiring round changed ONLY the compile surface, never the import
 *      surface (factory export is for EXPLICIT calls; no live-registry
 *      wiring); the hard-profile enablement constant stays false and appears
 *      flipped nowhere.
 *
 * @module packages/runtime/test/a5p4-lane-hygiene.test
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { ASSURANCE_DIMENSIONS, ASSURANCE_LEVELS, GOVERNANCE_ERROR_CODES, LEASE_STATUSES } from '../../domain/tool-governance/src/index.js'
import { PROVIDER_ASSURANCE_DIMENSIONS, PROVIDER_ASSURANCE_LEVELS, PROVIDER_ERROR_CODES } from '../sandbox-provider/contract-stub.js'
import { LEASE_STATUS_MIRROR } from '../sandbox-provider/phases.js'
import { HARD_PROFILE_ENABLED } from '../sandbox-provider/realm-evidence.js'

const LANE_DIR = resolve(fileURLToPath(import.meta.url).slice(0, -'/a5p4-lane-hygiene.test.ts'.length), '../sandbox-provider')
const PACKAGES_DIR = resolve(LANE_DIR, '../..')

/** The frozen §5 vocabulary mirrors are the frozen sets themselves. */
describe('a5p4 stub conformance to the frozen PR0 sets', () => {
  it('error codes, assurance levels and dimensions match element-for-element', () => {
    expect([...PROVIDER_ERROR_CODES]).toEqual([...GOVERNANCE_ERROR_CODES])
    expect([...PROVIDER_ASSURANCE_LEVELS]).toEqual([...ASSURANCE_LEVELS])
    expect([...PROVIDER_ASSURANCE_DIMENSIONS]).toEqual([...ASSURANCE_DIMENSIONS])
  })
  it('the lease status mirror matches the frozen lease law', () => {
    expect([...LEASE_STATUS_MIRROR]).toEqual([...LEASE_STATUSES])
  })
})

describe('a5p4 lane purity and dormancy', () => {
  function laneSources(dir: string, into: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry !== 'launcher') laneSources(full, into)
        continue
      }
      if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) into.push(full)
    }
    return into
  }
  const sources = laneSources(LANE_DIR)
  /** Comment stripper with the auditor's over-stripping direction (a prose
   *  quote can stop counting as an edge; an edge can never be erased). */
  const codeOnly = (src: string): string => src.replace(/^\s*\/\/.*$/gm, ' ').replace(/^\s*\/\*[\s\S]*?\*\//gm, ' ')
  const PURE = ['phases.ts', 'contract-stub.ts', 'fd-inheritance.ts', 'network.ts', 'realm-evidence.ts']
  const IMPURE_OK = ['probe-abi.ts', 'provider.ts']

  it('the lane has the expected production files', () => {
    const names = sources.map((s) => s.split('/').pop() as string).sort()
    for (const n of [...PURE, ...IMPURE_OK, 'index.ts']) expect(names, n).toContain(n)
  })

  it('pure files import nothing outside the lane and carry no node: specifier', () => {
    for (const file of sources.filter((f) => PURE.includes(f.split('/').pop() as string))) {
      const src = codeOnly(readFileSync(file, 'utf8'))
      expect(src, relative(PACKAGES_DIR, file)).not.toMatch(/from\s+['"]node:/)
      expect(src, relative(PACKAGES_DIR, file)).not.toMatch(/from\s+['"]\.\.(?:\/|\\)/)
      expect(src, relative(PACKAGES_DIR, file)).not.toMatch(/from\s+['"]@/)
    }
  })

  it('the I/O files import ONLY within the lane (no frozen-lane import, no bare specifiers)', () => {
    for (const file of sources) {
      const src = codeOnly(readFileSync(file, 'utf8'))
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1] ?? ''
        const ok = spec.startsWith('./') || spec.startsWith('node:')
        expect(ok, `${relative(PACKAGES_DIR, file)} -> ${spec}`).toBe(true)
      }
    }
  })

  it('self-typechecks with strict settings (in-process; the shared tsconfig stays untouched)', () => {
    const program = ts.createProgram(sources, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      skipLibCheck: true,
      noEmit: true,
      types: ['node'],
      typeRoots: [resolve(PACKAGES_DIR, 'runtime/node_modules/@types'), resolve(PACKAGES_DIR, '../node_modules/@types')],
    })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    const text = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n')
    expect(text).toBe('')
  })

  it('WIRED (GLUE-7): exactly ONE production consumer imports the lane — the assembly row (no accretion)', () => {
    // PR0 froze this lane DORMANT; GLUE-7 (alpha5-glue7-backend) is the
    // instruction-backed end of that state: the production Team tool plane
    // now ASSEMBLES the confined provider behind the shell row. The ledger
    // law survives in the same form — the consumer set is a NAMED SET: a
    // second production importer is a design change that must appear here,
    // and a vanished one is a broken wire. Booking evidence:
    // dev/agent-workflow/evidence/alpha5/glue7/ (inventory table, row 1).
    const offenders: string[] = []
    const walk = (dir: string): void => {
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return // a tree another suite owns vanished under us — not an offender
      }
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('dist.') || entry.startsWith('.tmp-')) continue
        const full = join(dir, entry)
        let isDir = false
        try {
          isDir = statSync(full).isDirectory()
        } catch {
          continue // transient (fault-injection scratch dirs from sibling suites)
        }
        if (isDir) {
          if (relative(PACKAGES_DIR, full) !== 'runtime/sandbox-provider') walk(full)
          continue
        }
        if (!/\.(ts|mjs)$/.test(entry) || entry.endsWith('.d.ts') || /\.test\.ts$/.test(entry) || entry.endsWith('.test.mjs')) continue
        if (relative(PACKAGES_DIR, full).startsWith('runtime/test/')) continue
        let body = ''
        try {
          body = readFileSync(full, 'utf8')
        } catch {
          continue // vanished between stat and read — transient again
        }
        if (/(sandbox-provider|createConfinedProcessProvider)/.test(body)) offenders.push(relative(PACKAGES_DIR, full))
      }
    }
    walk(PACKAGES_DIR)
    expect(offenders).toEqual(['runtime/src/plugin/live/plane-effect-backends.mjs'])
  })

  it('hard-profile enablement is compiled OFF and no source turns it on', () => {
    expect(HARD_PROFILE_ENABLED).toBe(false)
    for (const file of sources) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/HARD_PROFILE_ENABLED\s*=\s*true/)
    }
  })
})
