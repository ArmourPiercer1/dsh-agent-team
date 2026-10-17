/**
 * a5p5-barrel-emit — the PR4/5 INSTALL-ROUND self-check (pb-CONTRACT.md §2/§3):
 * the lane owns an EMIT face (`tsconfig.build.json`, emit into the lane's OWN
 * `dist/`, which stays gitignored — merging into the committed install surface
 * is GLUE-5's queue move, the file list is recorded in the contract), and the
 * EMITTED barrel is the install face:
 *
 *  1. structural: every `src/*.ts` file is re-exported by `src/index.ts`
 *     (no orphan module can hide off the barrel), and the build config emits
 *     exactly `src` with the repo-root layout;
 *  2. real emit: invoke the repo's own `typescript/lib/tsc.js` with `-p
 *     tsconfig.build.json` (the SAME config the assembler builds) into the
 *     lane's `dist/`, then IMPORT the emitted `index.js` and assert the full
 *     runtime export surface — including driving `createGovernedToolDefinitions`
 *     over the emitted graph (definitions + one presented run + one denied
 *     run), so "the lane's install face loads and behaves from its own dist"
 *     is a measured fact, not a compile proxy.
 *
 * The emit runs into `dist/` (gitignored; `check:artifacts` census untouched
 * — the committed install surface is GLUE-5's). No test besides this one may
 * assume `dist/` exists: this spec owns the emit and asserts it.
 *
 * @module test/a5p5-barrel-emit
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { findTestRepoRoot } from '../../../../tests/paths.mjs'
import type { ScenarioTable, ToolEffectBackend } from '../src/backend-contract.js'
import type { A5P5Assembly, GovernedToolDefinition } from '../src/register.js'

const here = dirname(fileURLToPath(import.meta.url))
const laneRoot = join(here, '..') // packages/tools/a5p5-tools
const repoRoot = findTestRepoRoot(fileURLToPath(import.meta.url))
if (typeof repoRoot !== 'string') throw new Error('a5p5-barrel-emit: tests/paths.mjs could not resolve the repo root')

const srcFiles = readdirSync(join(laneRoot, 'src'))
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  .map((f) => f.replace(/\.ts$/, ''))

const indexSource = readFileSync(join(laneRoot, 'src', 'index.ts'), 'utf8')

describe('a5p5 barrel structure (no orphan module off the export face)', () => {
  it('the lane has the install-round module set (barrel + register face)', () => {
    expect(srcFiles.length).toBeGreaterThanOrEqual(9)
    expect(srcFiles).toContain('register')
  })
  it("src/index.ts re-exports EVERY src module by its './<name>.js' specifier", () => {
    for (const name of srcFiles) {
      expect(indexSource, `barrel must name './${name}.js'`).toContain(`from './${name}.js'`)
    }
  })
  it('tsconfig.build.json exists, emits `src` with the repo-root layout into the lane dist', () => {
    const cfg = JSON.parse(readFileSync(join(laneRoot, 'tsconfig.build.json'), 'utf8')) as Record<string, Record<string, unknown>>
    expect(cfg['extends']).toBe('../../../tsconfig.base.json')
    expect(cfg['include']).toEqual(['src'])
    expect(cfg['compilerOptions']?.['rootDir']).toBe('../../..')
    expect(cfg['compilerOptions']?.['outDir']).toBe('dist')
    expect(cfg['compilerOptions']?.['noEmit']).toBeUndefined()
  })
})

describe('a5p5 emit self-check (the lane tsconfig emits to its own dist; the emitted barrel IS the install face)', () => {
  const TSC = join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js')
  const distRoot = join(laneRoot, 'dist')
  const emittedIndex = join(distRoot, 'packages', 'tools', 'a5p5-tools', 'src', 'index.js')

  it(
    'tsc -p tsconfig.build.json emits, the emitted index.js imports, and the full barrel surface behaves from dist',
    async () => {
      expect(existsSync(TSC), `repo typescript compiler missing at ${TSC}`).toBe(true)
      rmSync(distRoot, { recursive: true, force: true })
      execFileSync(process.execPath, [TSC, '-p', join(laneRoot, 'tsconfig.build.json')], { cwd: repoRoot, timeout: 180_000 })
      expect(existsSync(emittedIndex), `emitted barrel missing at ${relative(repoRoot, emittedIndex)}`).toBe(true)

      const mod = (await import(pathToFileURL(emittedIndex).href)) as Record<string, unknown>
      // the FULL runtime export surface of the barrel, measured on the emitted artifact
      for (const name of [
        'parseBashArgs', 'parseGlobArgs', 'parseGrepArgs', 'deriveToolEffectSet', 'targetLocatorOf',
        'renderSearchResult', 'renderShellResult', 'createSpillLease', 'openSpillStore',
        'createDirectBackend', 'createContractStubBackend', 'runToolCall',
        'createGovernedToolDefinitions',
      ]) {
        expect(typeof mod[name], `emitted export '${name}' must be a function`).toBe('function')
      }
      expect(mod['A5P5_TOOL_NAMES']).toEqual(['grep', 'glob', 'bash'])
      expect(mod['META_PREFIX']).toBe('a5p5-meta ')
      expect(mod['REFUSAL_PREFIX']).toBe('a5p5-refused ')
      for (const constName of ['DEFAULT_MAX_SEARCH_RESULTS', 'MAX_CONTEXT_LINES', 'MAX_SEARCH_RESULTS', 'MAX_TIMEOUT_MS', 'GREP_OUTPUT_MODES', 'TARGET_PLACEMENTS', 'BACKEND_STAGES', 'SPILL_ERROR_CLASSES', 'SPILL_LEASE_STATES', 'SPILL_REFUSAL_CODES', 'SETTLEMENT_EVENTS']) {
        expect(mod[constName], `emitted const '${constName}' must exist`).toBeDefined()
      }

      // behavior from the EMITTED graph: definitions over a direct backend,
      // one allowed + one denied call (the emitted graph is cast to the
      // LANE's own types — a structural conformance assertion as well)
      const createDirectBackend = mod['createDirectBackend'] as unknown as (table: ScenarioTable) => ToolEffectBackend
      const buildDefs = mod['createGovernedToolDefinitions'] as unknown as (assembly: A5P5Assembly) => readonly GovernedToolDefinition[]
      const table: ScenarioTable = {
        'emit-check-bash-1': {
          outcome: { exitCode: 0, stdout: 'FROM-EMITTED-DIST\n', stderr: '', timedOut: false, cancelled: false, truncated: false },
          chunks: ['FROM-EMITTED-DIST\n'],
        },
      }
      const backend = createDirectBackend(table)
      const defs = buildDefs({
        realmId: 'realm-emit-selfcheck',
        callIdPrefix: 'emit-check',
        decide: () => ({ kind: 'allow' }),
        searchBackend: backend,
        shellBackend: backend,
      })
      expect(defs.map((d) => d.name)).toEqual(['grep', 'glob', 'bash'])
      for (const d of defs) {
        expect(d.parameters['additionalProperties']).toBe(false)
        expect(d.parameters['type']).toBe('object')
      }
      const bash = defs[2]
      if (bash === undefined) throw new Error('emitted barrel must yield the bash definition')
      const okRun = await bash.execute({ command: 'echo hi', cwd: '.' })
      expect(okRun.text).toContain('FROM-EMITTED-DIST')
      const deniedDefs = buildDefs({
        realmId: 'realm-emit-selfcheck',
        decide: () => ({ kind: 'deny', code: 'ADMISSION-DENY' }),
        searchBackend: createDirectBackend({}),
        shellBackend: createDirectBackend({}),
      })
      const deniedDef = deniedDefs[2]
      if (deniedDef === undefined) throw new Error('emitted barrel must yield the bash definition')
      const denied = await deniedDef.execute({ command: 'echo hi' })
      expect(denied.text).toContain('a5p5-refused kind=refused-admission code=ADMISSION-DENY')
      const badArgs = await bash.execute({ command: '' })
      expect(badArgs.text).toContain('a5p5-refused kind=refused-schema')
    },
    180_000,
  )
})
