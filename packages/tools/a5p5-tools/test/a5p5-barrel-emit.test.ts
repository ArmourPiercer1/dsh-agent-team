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
import type { ScenarioFixture, ScenarioTable, ToolEffectBackend } from '../src/backend-contract.js'
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
      // THE FIXTURE ANSWERS THE CALL-ID THE EMITTED FACE ACTUALLY MINTS.
      // The correlation is composed INSIDE the register face — `src/register
      // .ts:218-222` builds `${prefix}-${kind}:${hexec|mount}:${mountNonce}-
      // ${seq}`, with a per-mount nonce since fix-2b and the host-token
      // `hexec` branch since PR358-A1 — so no literal key written in this file
      // can name it, and a literal key that DID happen to match would only
      // prove that a random UUID collided with it. The emitted direct backend
      // looks the scenario up as `table[call.callId]` (`src/backend-direct
      // .ts:26`), so the table here is a live lookup: it answers whatever
      // callId the request carries with the one scenario, and RECORDS the id
      // it was asked with. The pin's intent is untouched and now bites twice:
      // the emitted graph still has to route the call to the fixture and
      // render its stdout (the assertion below is unchanged), AND the id it
      // routed on must be this assembly's own closed grammar carrying the
      // configured `callIdPrefix` — asserted once the run is back. Nothing in
      // the product was edited to make an id unique, and no expectation here
      // was relaxed.
      const fixture: ScenarioFixture = {
        outcome: { exitCode: 0, stdout: 'FROM-EMITTED-DIST\n', stderr: '', timedOut: false, cancelled: false, truncated: false },
        chunks: ['FROM-EMITTED-DIST\n'],
      }
      const askedCallIds: string[] = []
      const table: ScenarioTable = new Proxy({} as Record<string, ScenarioFixture>, {
        get: (target, key) => {
          if (typeof key !== 'string') return undefined
          askedCallIds.push(key)
          return target[key] ?? fixture
        },
      })
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
      // …and the id it was served on is the EMITTED face's own fact: the
      // configured prefix, the lane's tool spelling, the tokenless `mount`
      // branch (this call carries no host execution token), a per-mount
      // nonce, and the per-assembly sequence. A grammar drift in the emitted
      // artifact — a lost prefix, a renumbered sequence, a `String()`-ed
      // token — fails HERE, which is the half a literal fixture key could
      // never check.
      expect(askedCallIds).toHaveLength(1)
      expect(askedCallIds[0]).toMatch(/^emit-check-bash:mount:[^:]+-1$/)
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
