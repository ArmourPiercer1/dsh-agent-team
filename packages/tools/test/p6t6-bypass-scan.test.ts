/**
 * P6-T6 MUST-TEST — the static bypass scan (brief §6b; G6 criterion 7).
 *
 * The task card requires the tool layer to delegate EVERYTHING to the
 * team runtime, and the brief (§6b) requires the bypass scan to STATICALLY
 * prove all three boundaries over `packages/tools/src/**`:
 *
 *   1. the tool layer never writes the durable team domain directly
 *      (no storage-layer import specifier, no `.repositories.` member
 *      access);
 *   2. the tool layer never creates agents of its own (no
 *      `agents.create` call text);
 *   3. the tool layer never uses the legacy Team SessionEvent vocabulary
 *      (the P4-T6 frozen denylist, matched with the same precision as
 *      the whole-tree scanner).
 *
 * On top of the source scan, the model-facing surface is pinned at
 * CONSTRUCTION time: `createTeamTools` must expose exactly the ten
 * sanctioned tools, each requiring `rootSessionId` + `requestToken` and
 * closing `additionalProperties` (SD-TOKEN: the correlation token is
 * model/driver-supplied on every call).
 *
 * Positive AND negative controls are run against the matcher with
 * synthetic samples, so a rule that silently stopped matching could not
 * turn the scan green.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`; only two files are self-excluded there), so no
 * denylist token may appear in this source as an exact quoted literal or
 * a word-bounded symbol. All tokens are IMPORTED from the scanner module
 * (assembled there at runtime from fragments) or built from them, and the
 * negative-control near-misses below are chosen so that none of them
 * carries a contiguous token either.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  BYPASS_RULES,
  LEGACY_PAYLOAD_SYMBOLS,
  LEGACY_TEAM_EVENT_STRINGS,
  SESSION_EVENT_MAP_IDENTIFIER,
  SESSION_TYPES_SPECIFIER,
  matchBypassRulesInText,
  scanToolsBypass,
} from './p6t6-bypass-scan.mjs'
import type { BypassScanResult, BypassScanViolation } from './p6t6-bypass-scan.mjs'
import { createTeamTools } from '../src/index.js'
import type { TeamToolsOptions } from '../src/index.js'

// --- the module-level scan + tool-set construction ----------------------

const SCAN: BypassScanResult = await scanToolsBypass()

// Construction-only options: the tool definitions are built lazily and
// never executed in this suite, so undefined satellites are sufficient.
const scanOnlyOptions = {
  teamRuntime: undefined,
  controlService: undefined,
  messaging: undefined,
  activity: undefined,
  resolveCaller: undefined,
} as unknown as TeamToolsOptions
const TOOL_SET = createTeamTools(scanOnlyOptions).tools

/** Count the violations of one rule inside a hit list. */
function ruleHits(hits: readonly BypassScanViolation[], rule: string): number {
  let n = 0
  for (const hit of hits) {
    if (hit.rule === rule) n += 1
  }
  return n
}

// --- the synthetic control samples ---------------------------------------

// One sample carrying EVERY rule class exactly once: three structural
// violations (the storage import, the repository access, the agent-
// creation call) plus the full legacy denylist (five event strings as
// exact quoted literals, five payload symbols word-bounded, the merging
// identifier, the session-types specifier).
const POSITIVE_SAMPLE = [
  "import { openTeamDomain } from '../../storage/index.js'",
  'const r = domain.repositories.members',
  'const a = agents.create({})',
  ...LEGACY_TEAM_EVENT_STRINGS.map((token, i) => `const e${i} = '${token}'`),
  ...LEGACY_PAYLOAD_SYMBOLS.map((symbol, i) => `const p${i} = ${symbol};`),
  `type M = ${SESSION_EVENT_MAP_IDENTIFIER};`,
  `import '${SESSION_TYPES_SPECIFIER}'`,
].join('\n')
const POSITIVE_HITS = matchBypassRulesInText(POSITIVE_SAMPLE)

// Near-misses: every line LOOKS suspicious but must NOT hit any rule —
// longer/other quoted literals (exact-literal precision), a different
// prefix, a split literal, a longer identifier (word-boundary precision),
// a case variant, a split merging identifier, a different specifier, a
// non-exact storage segment, and a non-`.repositories.`/non-`agents.create`
// accessor pair.
const NEGATIVE_SAMPLE = [
  "const a = 'team/progress2'",
  "const b = 'user/progress'",
  "const c = 'team' + '/' + 'progress'",
  'const d = TeamProgressDataX',
  'const e = teamProgressData',
  "const f = 'SessionEvent' + 'Map'",
  "const g = '@deepseek-ai/dsh-session/other'",
  "import { x } from '../../runtime/storage-check/index.js'",
  'const h = obj.repositories',
  'const i = agent.create({})',
].join('\n')
const NEGATIVE_HITS = matchBypassRulesInText(NEGATIVE_SAMPLE)

// --- the ten sanctioned model-facing tool names (registration order) ----

const EXPECTED_TOOL_NAMES = [
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_inspect_config',
  'team_list_members',
  'team_list_templates',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_send_message',
] // already in sorted order

describe('P6-T6 tool set — the static bypass scan (brief §6b, G6 criterion 7)', () => {
  it('the scan walks exactly the tool-layer source boundary (five .ts files)', () => {
    expect(SCAN.files.length).toBe(5)
    expect(SCAN.files).toEqual([
      'packages/tools/src/guard.ts',
      'packages/tools/src/index.ts',
      'packages/tools/src/tokens.ts',
      'packages/tools/src/tools.ts',
      'packages/tools/src/types.ts',
    ])
    for (const file of SCAN.files) {
      expect(file.startsWith('packages/tools/src/')).toBe(true)
      expect(file.endsWith('.ts')).toBe(true)
    }
  })

  it('§6b-1: no storage-layer import — the tool layer never writes the durable domain directly', () => {
    // The scanner actually SAW import specifiers (the check is not
    // vacuously green on an empty corpus).
    expect(SCAN.totalImportSpecifiers).toBeGreaterThan(0)
    let storageHits = 0
    for (const violation of SCAN.violations) {
      if (violation.rule === BYPASS_RULES.STORAGE_IMPORT) storageHits += 1
    }
    expect(storageHits).toBe(0)
  })

  it('§6b-1: no repository-level member access anywhere in the tool layer', () => {
    expect(ruleHits(SCAN.violations, BYPASS_RULES.REPOSITORIES_ACCESS)).toBe(0)
  })

  it('§6b-2: no agent creation — no agents.create call text in the tool layer', () => {
    expect(ruleHits(SCAN.violations, BYPASS_RULES.AGENTS_CREATE)).toBe(0)
  })

  it('§6b-3: no legacy Team SessionEvent vocabulary (event strings, payload symbols, merging identifier, session-types specifier)', () => {
    expect(ruleHits(SCAN.violations, BYPASS_RULES.LEGACY_EVENT_STRING)).toBe(0)
    expect(ruleHits(SCAN.violations, BYPASS_RULES.LEGACY_PAYLOAD_SYMBOL)).toBe(0)
    expect(ruleHits(SCAN.violations, BYPASS_RULES.LEGACY_SESSION_EVENT_MAP)).toBe(0)
    expect(ruleHits(SCAN.violations, BYPASS_RULES.LEGACY_SESSION_TYPES_SPECIFIER)).toBe(0)
  })

  it('the scan totals reconcile (no silent partial walk)', () => {
    expect(SCAN.violations.length).toBe(SCAN.totalViolations)
    expect(SCAN.fileResults.length).toBe(SCAN.files.length)
    let summed = 0
    let specifiers = 0
    for (const summary of SCAN.fileResults) {
      summed += summary.violationCount
      specifiers += summary.importSpecifierCount
    }
    expect(summed).toBe(SCAN.totalViolations)
    expect(specifiers).toBe(SCAN.totalImportSpecifiers)
    for (let i = 0; i < SCAN.fileResults.length; i += 1) {
      const summary = SCAN.fileResults[i]
      const file = SCAN.files[i]
      if (summary !== undefined && file !== undefined) {
        expect(summary.file).toBe(file)
      }
    }
  })

  it('positive controls: every rule class is detected exactly once in the synthetic sample', () => {
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.STORAGE_IMPORT)).toBe(1)
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.REPOSITORIES_ACCESS)).toBe(1)
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.AGENTS_CREATE)).toBe(1)
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.LEGACY_EVENT_STRING)).toBe(5)
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.LEGACY_PAYLOAD_SYMBOL)).toBe(5)
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.LEGACY_SESSION_EVENT_MAP)).toBe(1)
    expect(ruleHits(POSITIVE_HITS, BYPASS_RULES.LEGACY_SESSION_TYPES_SPECIFIER)).toBe(1)
    expect(POSITIVE_HITS.length).toBe(15)
  })

  it('negative controls: near-misses (exact-literal and word-boundary precision) never hit', () => {
    expect(NEGATIVE_HITS.length).toBe(0)
  })

  it('the model-facing surface is EXACTLY the ten sanctioned tools (SD-CREATE/SD-GUARD scope)', () => {
    expect(TOOL_SET.length).toBe(10)
    const names = TOOL_SET.map((tool) => tool.name).slice()
    names.sort()
    expect(names).toEqual(EXPECTED_TOOL_NAMES)
  })

  it('every tool requires rootSessionId + requestToken and closes additionalProperties (SD-TOKEN)', () => {
    for (const tool of TOOL_SET) {
      const properties = tool.parameters.properties as Record<string, unknown>
      expect(tool.name.length).toBeGreaterThan(0)
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.parameters.type).toBe('object')
      expect(tool.parameters.additionalProperties).toBe(false)
      expect(tool.parameters.required.includes('rootSessionId')).toBe(true)
      expect(tool.parameters.required.includes('requestToken')).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(properties, 'rootSessionId')).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(properties, 'requestToken')).toBe(true)
      expect(typeof tool.execute).toBe('function')
      expect(typeof tool.output.render).toBe('function')
      expect(tool.output.schema.type).toBe('object')
    }
  })
})
