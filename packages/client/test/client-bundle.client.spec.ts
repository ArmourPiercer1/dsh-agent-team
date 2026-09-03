/**
 * P9-T10 (P9-S7) — the client package/artifact shape (frozen 14-row
 * migrate table: `client-bundle.client.spec.ts` = ADAPT "package/export/
 * browser bundle").
 *
 * The legacy spec loaded the legacy fork's tsdown handoff artifact
 * (`packages/client/ui-team/lib/client.js` through
 * `window.__ModuleLoader__.load`) and drove a real SlotRegistry ring
 * through it. The vNext package has no such artifact: it is a plain
 * `tsc -p tsconfig.build.json` ESM build (main / types / a single
 * `.` export subpath), no bundler, no module-loader handoff — and the
 * P9-S7 DROP list removed the `conversation.chat.node` marker the
 * legacy artifact registered. This adapted spec pins the vNext surface:
 *
 *   1. the package.json export surface (name / type / main / types /
 *      exports — EXACTLY the `.` subpath, the D-T9-11 no-`./client`
 *      fact / files / the build script);
 *   2. the static plugin contract (PACKAGE_ID from `src/index.ts`, the
 *      frozen name / inject / apply shape from `src/plugin/client.ts`);
 *   3. a recursive source-plane text audit: no client-runtime import,
 *      no marker slot registration, no querySelector navigation;
 *   4. when `dist/` is built, the SAME audit over the emitted `.js`
 *      artifacts plus the plugin-entry presence — skipped when `dist/`
 *      is absent (the build is a gate step, not a test precondition).
 *
 * Node-environment spec (no DOM: the legacy `__ModuleLoader__` /
 * querySelector surface is gone with the marker).
 * NOTE (P9-S7 binding): the forbidden runtime-import token below is
 * assembled from parts ON PURPOSE — this file must not carry the token
 * verbatim, or the package-wide absence grep (the S7 end-state check)
 * would flag this very spec.
 *
 * Runs under the S8 browser-half harness (`.client.spec.*`); type-checked
 * by the client tsconfig (the exclude list that quarantined the legacy
 * copies is gone — P9-T10).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PACKAGE_ID } from '../src/index.js'
import { apply, inject, name } from '../src/plugin/client.js'

const PKG_PATH = fileURLToPath(new URL('../package.json', import.meta.url))
const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url))
const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

interface PlaneFile {
  readonly path: string
  readonly text: string
}

/** Recursively list the file paths under one directory. */
function listFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`
    if (statSync(full).isDirectory()) {
      for (const nested of listFiles(full)) out.push(nested)
    } else {
      out.push(full)
    }
  }
  return out
}

/** Read one directory plane (relative slash paths + utf8 text). */
function readPlane(root: string, extensions: readonly string[]): PlaneFile[] {
  return listFiles(root)
    .filter((path) => extensions.some((ext) => path.endsWith(ext)))
    .map((path) => ({
      path: path.slice(root.length + 1).replace(/\\/g, '/'),
      text: readFileSync(path, 'utf8'),
    }))
}

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8')) as {
  name: string
  version: string
  private: boolean
  type: string
  main: string
  types: string
  exports: Record<string, unknown>
  files: string[]
  scripts: Record<string, string>
}

/** The source plane: every `.ts` / `.tsx` file under `src`. */
const srcFiles = readPlane(SRC_ROOT, ['.ts', '.tsx'])
/** The emitted plane: every `.js` file under `dist` (when built). */
const distFiles = statSync(DIST_ROOT, { throwIfNoEntry: false }) === null
  ? []
  : readPlane(DIST_ROOT, ['.js'])
const distBuilt = distFiles.length > 0

/**
 * The forbidden tokens, per plane. The client-runtime import token is
 * assembled from parts (the binding note in the module doc).
 */
const RUNTIME_TOKEN = ['@deepseek-ai/dsh-client-', 'runtime'].join('')
const FORBIDDEN: readonly (readonly [token: string, why: string])[] = [
  [RUNTIME_TOKEN, 'the client-runtime import is host-plane only (P9-S7 binding drop)'],
  ['conversation.chat.node', 'the team-marker slot registration is DROPPED (P9-S7)'],
  ['document.querySelector', 'tab activation rides the frozen seam face, never a DOM query (P9-S6)'],
]

function assertPlaneClean(
  planeName: string,
  files: PlaneFile[],
  expectNonEmpty: boolean,
): void {
  if (expectNonEmpty) {
    expect(files.length, `${planeName} plane must not be empty`).toBeGreaterThan(0)
  }
  for (const file of files) {
    for (const [token, why] of FORBIDDEN) {
      expect(file.text.includes(token), `${planeName}/${file.path} must not contain ${token} (${why})`).toBe(false)
    }
  }
}

describe('P9-T10 (P9-S7) client package surface (legacy spec ADAPT)', () => {
  it('the package.json export surface is the frozen ESM shape', () => {
    expect(pkg.name).toBe('@dsh-agent-team/client')
    expect(pkg.private).toBe(true)
    expect(pkg.type).toBe('module')
    expect(pkg.main).toBe('./dist/index.js')
    expect(pkg.types).toBe('./dist/index.d.ts')
    // D-T9-11: EXACTLY the '.' subpath — no './client' (the composition
    // wiring is S8/main-agent territory).
    expect(pkg.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    })
    expect(pkg.files).toEqual(['dist'])
    expect(pkg.scripts.build).toBe('tsc -p tsconfig.build.json')
  })

  it('the static plugin contract is the frozen shape (PACKAGE_ID + name/inject/apply)', () => {
    expect(PACKAGE_ID).toBe('client')
    expect(name).toBe('dsh-agent-team-client')
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'connection', 'remote'])
    expect(typeof apply).toBe('function')
  })

  it('the source plane carries no runtime import, no marker slot, no querySelector', () => {
    assertPlaneClean('src', srcFiles, true)
  })

  it.skipIf(!distBuilt)('the emitted dist plane carries the same absence (and the plugin entry)', () => {
    assertPlaneClean('dist', distFiles, true)
    const paths = distFiles.map((f) => f.path)
    expect(paths, 'dist must contain the package entry').toContain('index.js')
    // The D-T9-13 core/glue split is visible in the emit: `plugin/client.js`
    // (the glue, re-exports `inject`/`name` from core) and
    // `plugin/team-mount-core.js` (the core, declares the frozen name).
    expect(paths, 'dist must contain the plugin glue').toContain('plugin/client.js')
    expect(paths, 'dist must contain the plugin core').toContain('plugin/team-mount-core.js')
    const index = distFiles.find((f) => f.path === 'index.js')
    const glue = distFiles.find((f) => f.path === 'plugin/client.js')
    const core = distFiles.find((f) => f.path === 'plugin/team-mount-core.js')
    if (index === undefined) throw new Error('missing: dist/index.js')
    if (glue === undefined) throw new Error('missing: dist/plugin/client.js')
    if (core === undefined) throw new Error('missing: dist/plugin/team-mount-core.js')
    expect(index.text).toContain('PACKAGE_ID')
    expect(index.text).toContain("'client'")
    expect(glue.text, 'the glue must wire applyTeamMount').toContain('applyTeamMount')
    expect(core.text, 'the core must declare the frozen plugin name').toContain("'dsh-agent-team-client'")
  })
})
