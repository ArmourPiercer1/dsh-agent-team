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
 *  (4) NAMED MOUNTS (restated 2026-10-18; it WAS "(4) DORMANT: no production
 *      file outside the lane references the lane"): the lane is no longer
 *      dark — the production assembly rows that need a confined child mount it
 *      through its PUBLIC FACE, by name, one pinned edge each. The restatement
 *      changed the shape of the claim, NOT its teeth: every reference must be
 *      one of the named mounts below, each with exactly ONE import line pinned
 *      character-for-character and pointing at the public face only (a deep
 *      import is a violation), and ANY file that references the lane without
 *      being named here is a red — including a new file, a renamed file, or a
 *      named file that grows a second edge. What is still NOT allowed and is
 *      separately pinned below: live-registry wiring, the hard-profile
 *      enablement constant flipping to true, and a mount reaching past
 *      `sandbox-provider/index.js` into the lane's internals.
 *      Names and provenance (one line each, no blanket exemption):
 *        - `runtime/src/plugin/live/plane-effect-backends.mjs` — the governed
 *          Team tool plane's effect-backends row (glue lane; it mounts the
 *          shell/streaming rows behind the plane's own admission binding).
 *        - `runtime/src/plugin/live/glob-backend.mjs` — the a5glb anchored glob
 *          row (alpha5-glob-backend lane; confined rg walk, evidence
 *          `dev/agent-workflow/evidence/alpha5/glob-backend/`).
 *
 * @module packages/runtime/test/a5p4-lane-hygiene.test
 */

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { ASSURANCE_DIMENSIONS, ASSURANCE_LEVELS, GOVERNANCE_ERROR_CODES, LEASE_STATUSES } from '../../domain/tool-governance/src/index.js'
import { PROVIDER_ASSURANCE_DIMENSIONS, PROVIDER_ASSURANCE_LEVELS, PROVIDER_ERROR_CODES } from '../sandbox-provider/contract-stub.js'
import { LEASE_STATUS_MIRROR } from '../sandbox-provider/phases.js'
import { HARD_PROFILE_ENABLED } from '../sandbox-provider/realm-evidence.js'

/** Print the live named-mount set so a census capture records what was seen. */
function reportNamedMounts(live: string[]): void {
  ;(globalThis as { process?: { stdout?: { write(v: string): void } } }).process?.stdout?.write(
    `a5p4 law(4) live named provider mounts on this tree: ${live.join(' , ')}\n`,
  )
}

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

  /**
   * The named-mount face of law (4). A LIST OF FILES, each with the ONE edge it
   * is allowed to carry, is the whole exemption — there is no wildcard, no
   * directory rule and no "in production" carve-out. `subset` semantics: every
   * offender must appear here, so an unnamed consumer breaks the leg the same
   * way it always did; a named mount that is simply absent from this checkout is
   * reported, not required (each lane books its own row on its own branch).
   */
  const NAMED_PROVIDER_MOUNTS: readonly { file: string; lane: string; edge: string }[] = [
    {
      file: 'runtime/src/plugin/live/plane-effect-backends.mjs',
      lane: 'glue — Team tool plane effect backends',
      edge: "import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'",
    },
    {
      file: 'runtime/src/plugin/live/glob-backend.mjs',
      lane: 'a5glb — anchored confined-rg glob row',
      edge: "import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'",
    },
    {
      // A5-SRGP (PR5 原生等价层, search row): the confined-rg SEARCH backend builds
      // its own provider for the anchored walk — allowPaths are the system dirs the
      // packaged binary needs plus the governed root READ-ONLY (readFile/readDir,
      // never write), and the walk rides the child's cwd at the anchor. Evidence:
      // dev/agent-workflow/evidence/alpha5/srgp/README.md.
      file: 'runtime/src/plugin/live/search-backend.mjs',
      lane: 'a5srgp — anchored confined-rg search row',
      edge: "import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'",
    },
  ]

  it('NAMED MOUNTS ONLY: every production reference to the lane is a booked row with one pinned public-face edge', () => {
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
    const named = new Map(NAMED_PROVIDER_MOUNTS.map((m) => [m.file, m]))
    const unnamed = offenders.filter((o) => !named.has(o)).sort()
    // THE TEETH, unchanged: a reference with no booked name is a red, exactly as
    // when the list was empty.
    expect(unnamed, `unnamed production consumers of the confined provider lane: ${unnamed.join(', ')}`).toEqual([])
    // Each booked name, on the tree that carries it, is pinned to ONE edge at
    // the public face — the shape of the mount is part of the booking.
    for (const mount of NAMED_PROVIDER_MOUNTS) {
      const path = resolve(PACKAGES_DIR, mount.file)
      if (!existsSync(path)) continue // that lane has not mounted on THIS tree (reported below)
      const body = readFileSync(path, 'utf8')
      const edges = body.split('\n').map((l) => l.trim()).filter((l) => /sandbox-provider/.test(l) && /^import\b/.test(l))
      expect(edges, `${mount.file}: a mount carries exactly one pinned import edge (${mount.lane})`).toEqual([mount.edge])
      const deep = body.split('\n').map((l) => l.trim()).filter((l) => /from\s+'[^']*sandbox-provider\/[^']+'/.test(l) && !/sandbox-provider\/index\.js'/.test(l))
      expect(deep, `${mount.file}: only the PUBLIC FACE may be imported — no deep path into the lane`).toEqual([])
      // Call sites, counted on their own: the pinned edge names the symbol
      // without calling it, so the import line never enters this count.
      // A call site is `createConfinedProcessProvider(` — the pinned import line
      // names the symbol without a paren, so it never counts here.
      const calls = body.split('\n').filter((l) => /createConfinedProcessProvider\s*\(/.test(l) && !/^import\b/.test(l.trim())).length
      expect(calls, `${mount.file}: the booked row must actually mount the factory`).toBeGreaterThanOrEqual(1)
    }
    // What the leg SAW, in the open — the identity of the live set is the claim.
    const live = offenders.slice().sort()
    expect(live.length).toBeGreaterThanOrEqual(1)
    reportNamedMounts(live)  })

  it('hard-profile enablement is compiled OFF and no source turns it on', () => {
    expect(HARD_PROFILE_ENABLED).toBe(false)
    for (const file of sources) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/HARD_PROFILE_ENABLED\s*=\s*true/)
    }
  })
})
