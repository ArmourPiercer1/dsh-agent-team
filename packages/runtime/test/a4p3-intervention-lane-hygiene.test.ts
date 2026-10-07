/**
 * A4-PR3 — LANE HYGIENE for the intervention lane (plan Task 3, the named
 * `Test create` line; the A1-17 intervention-boundary import-edge pin, on the
 * precedent of `a3p5-permission-notification-lane-hygiene.test.ts`).
 *
 * Four legs, each pinning one structural contract this lane owns:
 *
 * 1. **THE REVERSE EDGE, WALKED**: nothing outside `intervention/**` imports it.
 *    The pin is a DIRECTORY WALK of every non-test source under `packages/**`,
 *    not a hand-written file list (audit F11): the previous list was seven
 *    entries read with `try { … } catch { continue }`, so a renamed file — or a
 *    file a later PR adds, e.g. PR4's
 *    `operation-permission/approval-routing.ts` — dropped out of the pin
 *    silently and the pin went green for the wrong reason. A walk cannot miss a
 *    file that exists; the count floor below is what stops it passing on an
 *    empty walk.
 *
 * 2. **THE LANE'S OWN EDGES**: every file under `intervention/**` (also a walk,
 *    so a new module is inside the pin the moment it exists) reaches NO
 *    `CEILING_LANE`-only name (`grantCeiling`, `AuthorityCeilingScope`,
 *    `authorityRank`, `mayReview`), NO `RuntimeAuthority` (the consumer set is
 *    pinned to four files by `a3p3-governance-lane-hygiene.test.ts`), NO
 *    storage/repository/team-lock/ledger-write symbol, and NO import edge to
 *    `../governance/**` at all — required authority arrives as the
 *    `RequiredAuthorityReader` CALLBACK, which is the design ruling lane B was
 *    given, and a barrel import would evade the reviewed allow-list (ADR X9).
 *
 * 3. **THE CLOSED EXPORT SURFACE**: `intervention/index.ts` exports exactly the
 *    frozen names (values and types checked separately). PR4/PR5 may import only
 *    names in the interface freeze; a name that leaves the barrel silently is
 *    the same hazard in the other direction, so the surface is compared as a
 *    SET, not spot-checked.
 *
 * 4. **THE ZERO-DIST POSTURE**: `intervention` is NOT in
 *    `packages/runtime/tsconfig.build.json`'s include (ADR A4-6; plan Task 3's
 *    dist line), because A4-PR3 ships the lane UNWIRED and PR6 wires it and
 *    co-commits its dist.
 *
 * Offline, host-free. The only I/O is reading this repository's own source.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): the
 * sources are read at module level; `it` bodies are pure synchronous assertions.
 *
 * @module @dsh-agent-team/runtime/test/a4p3-intervention-lane-hygiene
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
/** `packages/` — the scope both walks share. */
const PACKAGES_ROOT = join(HERE, '..', '..')
const RUNTIME_ROOT = join(HERE, '..')
const INTERVENTION_ROOT = join(RUNTIME_ROOT, 'intervention')

/** A source file with the text it carries. */
interface SourceFile {
  readonly path: string
  readonly code: string
}

/**
 * One source file whose comments are stripped, so a prose mention of a banned
 * name (this file's own text explains the bans) can never be mistaken for a
 * code position — the same convention the lane-hygiene precedents use.
 */
function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n')
}

/** Walk `root` for `.ts` sources, skipping build output and test suites. */
function walkSources(root: string, options: { readonly includeTests?: boolean } = {}): SourceFile[] {
  const found: SourceFile[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test') {
          if (!(entry.name === 'test' && options.includeTests === true)) continue
        }
        visit(full)
        continue
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue
      if (!options.includeTests && full.split(sep).includes('test')) continue
      found.push({ path: full, code: stripComments(readFileSync(full, 'utf8')) })
    }
  }
  visit(root)
  return found
}

const LANE_SOURCES = walkSources(INTERVENTION_ROOT)
const PACKAGE_SOURCES = walkSources(PACKAGES_ROOT)

/** The four modules this lane created. A walk that stops seeing them means the
 *  lane moved, and the pins below would then be walking a different directory. */
const LANE_MODULE_NAMES = [
  'derivation.ts',
  'index.ts',
  'projection.ts',
  'types.ts',
]

const LANE_NAMES = [
  'grantCeiling',
  'AuthorityCeilingScope',
  'authorityRank',
  'mayReview',
]

const FROZEN_VALUE_EXPORTS = [
  'CONTROL_ROW_SHAPES',
  'INTERVENTION_ACTIONS',
  'INTERVENTION_ACTION_VALUES',
  'INTERVENTION_DERIVATION_REASONS',
  'INTERVENTION_KINDS',
  'INTERVENTION_KIND_VALUES',
  'INTERVENTION_RESPONSE_BEHAVIORS',
  'INTERVENTION_SOURCE_KINDS',
  'INTERVENTION_STATUSES',
  'INTERVENTION_STATUS_VALUES',
  'TERMINAL_AUTHORITY_STATES',
  'TERMINAL_AUTHORIZATIONS',
  'TERMINAL_EXECUTIONS',
  'TERMINAL_MUTATION_EFFECTS',
  'TERMINAL_MUTATION_OUTCOMES',
  'TERMINAL_MUTATION_OUTCOME_VALUES',
  'TERMINAL_OPERATION_OUTCOMES',
  'TERMINAL_OPERATION_OUTCOME_VALUES',
  'controlRowShapeOf',
  'currentLegOf',
  'deriveInterventionItem',
  'deriveInterventionItems',
  'deriveLegalActions',
  'deriveTerminalMutationOutcome',
  'deriveTerminalOperationOutcome',
  'deriveZeroLegAuthorityUnavailableItem',
  'freezeItem',
  'projectInterventions',
  'projectZeroLegTermination',
  'strictRowProblem',
]

const FROZEN_TYPE_EXPORTS = [
  'ControlRowShape',
  'InterventionAction',
  'InterventionBlockScope',
  'InterventionControlSource',
  'InterventionDerivationReason',
  'InterventionItem',
  'InterventionKind',
  'InterventionResponseBehavior',
  'InterventionSource',
  'InterventionSourceAdapter',
  'InterventionSourceKind',
  'InterventionStatus',
  'LegalActionDerivation',
  'ProjectInterventionsInput',
  'RequiredAuthorityFacts',
  'RequiredAuthorityReader',
  'RequiredAuthorityReaderInput',
  'TerminalAuthorityState',
  'TerminalAuthorization',
  'TerminalExecution',
  'TerminalMutationEffect',
  'TerminalMutationInput',
  'TerminalMutationOutcome',
  'TerminalOperationInput',
  'TerminalOperationOutcome',
]

/** The barrel's export names, split by kind the way TypeScript does. */
function barrelExports(): { readonly values: string[]; readonly types: string[] } {
  const source = readFileSync(join(INTERVENTION_ROOT, 'index.ts'), 'utf8')
  const values: string[] = []
  const types: string[] = []
  const pattern = /export\s+(type\s+)?\{([^}]*)\}\s*from/g
  for (const match of source.matchAll(pattern)) {
    const target = match[1] === undefined ? values : types
    for (const name of (match[2] ?? '').split(',')) {
      const trimmed = name.trim()
      if (trimmed.length > 0) target.push(trimmed)
    }
  }
  return { values, types }
}

describe('the intervention lane imports nothing backwards (A1-17, audit F11)', () => {
  it('the walk covers the whole package tree, not a hand-kept list', () => {
    // The floor is the point: without it, an empty or narrowed walk would make
    // every edge pin below vacuously green.
    expect(PACKAGE_SOURCES.length > 200).toBe(true)
    const relative = PACKAGE_SOURCES.map((file) => file.path)
    // Files whose edges MATTER today, asserted present so a silent narrowing of
    // the walk (a new skip, a moved directory) is red rather than a green hole.
    for (const anchor of ['control/service.ts', 'operation-permission/pre-execute-adapter.ts']) {
      expect(relative.some((path) => path.endsWith(anchor))).toBe(true)
    }
    // And the directory a later lane writes into is inside the walk by
    // construction, which no file list can promise.
    expect(
      PACKAGE_SOURCES.some((file) => file.path.includes(join('runtime', 'operation-permission'))),
    ).toBe(true)
  })

  it('no source outside intervention/** imports the intervention lane', () => {
    for (const file of PACKAGE_SOURCES) {
      if (file.path.startsWith(INTERVENTION_ROOT)) continue
      expect(`${file.path}: ${file.code}`).not.toMatch(/from\s+'[^']*intervention\//)
    }
  })
})

describe('the intervention lane reaches no authority plane of its own (A1-17, A1-16)', () => {
  it('the lane directory is walked, and the four modules are inside it', () => {
    expect(LANE_SOURCES.length >= 4).toBe(true)
    for (const name of LANE_MODULE_NAMES) {
      expect(LANE_SOURCES.some((file) => file.path.endsWith(name))).toBe(true)
    }
  })

  it('no ceiling-lane name and no RuntimeAuthority anywhere in the lane', () => {
    for (const file of LANE_SOURCES) {
      for (const name of LANE_NAMES) {
        expect(`${file.path}: ${file.code}`).not.toMatch(new RegExp(`\\b${name}\\b`))
      }
      expect(`${file.path}: ${file.code}`).not.toMatch(/\bRuntimeAuthority\b/)
    }
  })

  it('no repository, team lock, or ledger write anywhere in the lane', () => {
    for (const file of LANE_SOURCES) {
      expect(`${file.path}: ${file.code}`).not.toMatch(/\brepositories\b/)
      expect(`${file.path}: ${file.code}`).not.toMatch(/\bwithTeamLock\b/)
      expect(`${file.path}: ${file.code}`).not.toMatch(/ledger\.(put|append)/)
      expect(`${file.path}: ${file.code}`).not.toMatch(/from\s+'[^']*storage\/repositories/)
    }
  })

  it("the lane's only governance edge is the TYPE-ONLY ladder vocabulary (authority arrives as a callback)", () => {
    // Lane B's ruling, in code shape: required authority is a
    // `RequiredAuthorityReader` the CALLER injects, never a value the lane
    // computes. The one admitted edge is the type-only import of
    // `ProposalAuthorityPosition` from `../governance/proposal-store.js`, which
    // is the sanctioned route: `a3p3-governance-lane-hygiene.test.ts` pins
    // `RuntimeAuthority` to four consumer files, so the ladder vocabulary has no
    // other legal home for control and intervention code. Anything else — a
    // VALUE import, the `governance/index.ts` barrel (which evades the reviewed
    // per-name allow-list, the X9-class hole), or a ceiling module — is red.
    const admitted = '../governance/proposal-store.js'
    for (const file of LANE_SOURCES) {
      const edges = file.code
        .split('\n')
        .filter((line) => /from\s+'\.\.\/governance\//.test(line))
      for (const edge of edges) {
        // The path is prefixed for a readable failure, so the anchored check
        // anchors on the label's colon rather than on the string's start.
        expect(`${file.path}: ${edge}`).toContain(`'${admitted}'`)
        expect(`${file.path}: ${edge}`).toMatch(/:\s*import type\b/)
      }
    }
  })
})

describe('the intervention barrel exports exactly the frozen surface (plan Task 3, Interfaces)', () => {
  it('the value exports are the frozen set', () => {
    expect(barrelExports().values.sort()).toEqual([...FROZEN_VALUE_EXPORTS].sort())
  })

  it('the type exports are the frozen set', () => {
    expect(barrelExports().types.sort()).toEqual([...FROZEN_TYPE_EXPORTS].sort())
  })
})

describe('the intervention lane keeps the zero-dist posture (ADR A4-6)', () => {
  it('intervention is absent from the runtime build include', () => {
    const buildConfig = readFileSync(join(RUNTIME_ROOT, 'tsconfig.build.json'), 'utf8')
    expect(buildConfig).not.toMatch(/"intervention/)
  })
})
