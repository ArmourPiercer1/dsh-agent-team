/**
 * F1 (PR #29 review supplement) — the plugin's DSH runtime peer
 * compatibility gate, verified against the REAL host compatibility evaluator
 * (the upstream `app-boot` built entry of the pinned test-use checkout — the
 * same code the host runs at preflight).
 *
 * The review found the PR's original U8 install proof was vacuous: with no
 * `peerDependencies` on the plugin manifest the upstream gate imposes no
 * constraint ("Missing DSH peers impose no constraint"), so the plugin
 * "passed" without ever participating in the version-compatibility check
 * despite being deliberately migrated to the then-current breaking surfaces.
 *
 * This test locks both halves:
 *   1. the manifest actually declares the exact-RC peer of the PINNED
 *      generation (`@deepseek-ai/dsh: 0.2.0-rc.2` — the review ruling: no
 *      ranges, no `*`, no cross-generation compatibility claim), and
 *   2. the checker's behavior on THAT manifest:
 *      - runtime 0.2.0-rc.2 → compatible, no exemption needed (positive);
 *      - runtime 0.1.7-rc.1 (the generation this plugin left) / 0.2.0-rc.3 /
 *        0.2.0 → the evaluator reports the unmet peer and NO active
 *        exemption (negative — the gate genuinely rejects this plugin on a
 *        runtime it was not pinned to, in both directions);
 *      - the vacuous-pass semantics are documented (a peerless manifest
 *        imposes no constraint — the pre-fix state);
 *      - the exact-version exemption mechanism is recognized by the
 *        evaluator (mechanics only — this repo grants none; the host-side
 *        real-host smoke proves no `compatibility.json` grant exists).
 *
 * Prohibited forms (review §1.3) are all avoided: no string-grep as the
 * only check, no `allow-version` exemption making a mismatched case pass,
 * no field-presence-only assertion without checker behavior.
 *
 * 0.2.0-rc.2 host upgrade round (2026-10-03, task/dsh-020rc2-upgrade-20261003):
 * the version expectations are read from the canonical pin
 * (`tests/paths.mjs` → `DSH_BASELINE_VERSION`) instead of restating the
 * generation, and the RED state of this gate BEFORE the adaptation is
 * recorded in `dev/agent-workflow/evidence/dsh-020rc2-upgrade/logs/`
 * (`compat-RED-real02-evaluator.log`: 6 failed | 1 passed against the real
 * 0.2.0-rc.2 evaluator — proof the assertions bind the running evaluator,
 * not a literal). The upstream evaluator source itself is byte-identical
 * between 0.1.7-rc.1 and 0.2.0-rc.2 (`packages/boot/app-boot/src/
 * plugin-compatibility.ts`), so no assertion had to be weakened — only the
 * pinned generation moved.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { DSH_BASELINE_VERSION, findTestRepoRoot, testUseTree, TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'

const resolvedRepoRoot = findTestRepoRoot(fileURLToPath(import.meta.url))
if (resolvedRepoRoot === null) {
  throw new Error('plugin-dsh-compat: cannot resolve the team-repo root from the test location')
}
// A separate const so the null-guard narrowing is part of the declared type
// (top-level narrowing does not flow into function bodies).
const repoRoot: string = resolvedRepoRoot

/**
 * The pinned test-use generation. Single source = `tests/paths.mjs`; the
 * literal below is asserted once on purpose so an unintended pin move is a
 * loud failure here rather than a silent re-target of every case below.
 */
const EXPECTED_RUNTIME = DSH_BASELINE_VERSION
const PINNED_GENERATION_LITERAL = '0.2.0-rc.2'
/** The review ruling: the exact RC peer, nothing broader. */
const EXPECTED_PEER_RANGE = DSH_BASELINE_VERSION
/** The generation this plugin was pinned to before 2026-10-03 (older side). */
const PREVIOUS_GENERATION = '0.1.7-rc.1'
/** A later prerelease / later stable of the same line (newer side). */
const LATER_PRERELEASE = '0.2.0-rc.3'
const LATER_STABLE = '0.2.0'

interface PluginCompatibilityIssue {
  readonly name: string
  readonly version: string
  readonly runtimeVersion: string
  readonly peers: Record<string, string>
  readonly exempted: boolean
}

/**
 * The real upstream evaluator (the built `app-boot` entry of the pinned
 * test-use checkout — the host's own preflight code, not a re-implementation
 * and not a grep). The `@vite-ignore` hint keeps the dynamic import of the
 * absolute path external to the transform pipeline.
 */
async function loadEvaluator(): Promise<{
  readonly evaluatePluginCompatibility: (
    manifest: object,
    exemptions?: Record<string, readonly string[]>,
    runtimeVersion?: string,
  ) => PluginCompatibilityIssue | undefined
  readonly getDshRuntimeVersion: () => string
  readonly pluginCompatibilityWarning: (issue: PluginCompatibilityIssue) => string
}> {
  const url = pathToFileURL(
    join(testUseTree(repoRoot), 'packages', 'boot', 'app-boot', 'lib', 'index.js'),
  ).href
  const mod = await import(/* @vite-ignore */ url) as Record<string, unknown>
  const evaluate = mod['evaluatePluginCompatibility'] as (
    manifest: object,
    exemptions?: Record<string, readonly string[]>,
    runtimeVersion?: string,
  ) => PluginCompatibilityIssue | undefined
  const runtime = mod['getDshRuntimeVersion'] as () => string
  const warning = mod['pluginCompatibilityWarning'] as (issue: PluginCompatibilityIssue) => string
  if (typeof evaluate !== 'function' || typeof runtime !== 'function' || typeof warning !== 'function') {
    throw new Error(
      'plugin-dsh-compat: the pinned test-use app-boot entry no longer exports the ' +
        'compatibility evaluator (evaluatePluginCompatibility / getDshRuntimeVersion / ' +
        'pluginCompatibilityWarning) — the host compatibility-gate shape changed',
    )
  }
  return { evaluatePluginCompatibility: evaluate, getDshRuntimeVersion: runtime, pluginCompatibilityWarning: warning }
}

const manifest = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf8'),
) as { readonly name: string; readonly version: string; readonly peerDependencies?: Record<string, string> }

describe('F1 plugin DSH peer compatibility (real ' + EXPECTED_RUNTIME + ' evaluator, test-use @ ' + TEST_USE_BASELINE_SHA.slice(0, 10) + ')', () => {
  it('the canonical pin is the 0.2.0-rc.2 generation, and the pinned test-use runtime self-reports exactly that version', async () => {
    // The pin moved on purpose (0.1.7-rc.1 → 0.2.0-rc.2, 2026-10-03 round).
    expect(EXPECTED_RUNTIME).toBe(PINNED_GENERATION_LITERAL)
    const { getDshRuntimeVersion } = await loadEvaluator()
    // The evaluator runs OUT OF the pinned checkout, so its self-report is
    // the host-side truth this plugin is gated against (reads app-boot's own
    // package.json, no env override).
    expect(getDshRuntimeVersion()).toBe(EXPECTED_RUNTIME)
  })

  it('the root manifest declares the exact-RC DSH peer (and no other dsh* peer, no range)', () => {
    const peers = manifest.peerDependencies ?? {}
    const dshPeers = Object.entries(peers).filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
    expect(dshPeers).toEqual([
      ['@deepseek-ai/dsh', EXPECTED_PEER_RANGE],
    ])
    // Exact match, not a range: no comparator / wildcard / hygroscopic form.
    for (const [, requirement] of dshPeers) {
      expect(requirement).not.toMatch(/[\s|^~*><=]/)
    }
  })

  it('positive: runtime ' + EXPECTED_RUNTIME + ' → compatible, the evaluator reports no issue (no exemption needed)', async () => {
    const { evaluatePluginCompatibility, getDshRuntimeVersion } = await loadEvaluator()
    expect(evaluatePluginCompatibility(manifest, {}, EXPECTED_RUNTIME)).toBeUndefined()
    // …and against the evaluator's OWN runtime (the preflight call shape the
    // host actually makes: no explicit runtimeVersion argument).
    expect(evaluatePluginCompatibility(manifest, {})).toBeUndefined()
    expect(getDshRuntimeVersion()).toBe(EXPECTED_PEER_RANGE)
  })

  it('negative: runtime ' + PREVIOUS_GENERATION + ' (the generation this plugin left) → the evaluator reports the unmet peer with NO active exemption (the gate now rejects)', async () => {
    const { evaluatePluginCompatibility, pluginCompatibilityWarning } = await loadEvaluator()
    const issue = evaluatePluginCompatibility(manifest, {}, PREVIOUS_GENERATION)
    expect(issue).toBeDefined()
    expect(issue?.peers).toEqual({ '@deepseek-ai/dsh': EXPECTED_PEER_RANGE })
    expect(issue?.runtimeVersion).toBe(PREVIOUS_GENERATION)
    expect(issue?.exempted).toBe(false)
    const warning = pluginCompatibilityWarning(issue!)
    expect(warning).toContain(`${manifest.name}@${manifest.version}`)
    expect(warning).toContain(PREVIOUS_GENERATION)
    expect(warning).toContain('not active')
  })

  it('negative: a later prerelease (' + LATER_PRERELEASE + ') and the later stable (' + LATER_STABLE + ') are also unmet — the exact-RC range does not widen', async () => {
    const { evaluatePluginCompatibility, pluginCompatibilityWarning } = await loadEvaluator()
    for (const runtimeVersion of [LATER_PRERELEASE, LATER_STABLE]) {
      const issue = evaluatePluginCompatibility(manifest, {}, runtimeVersion)
      expect(issue).toBeDefined()
      expect(issue?.peers).toEqual({ '@deepseek-ai/dsh': EXPECTED_PEER_RANGE })
      expect(issue?.runtimeVersion).toBe(runtimeVersion)
      expect(issue?.exempted).toBe(false)
      expect(pluginCompatibilityWarning(issue!)).toContain('not active')
    }
  })

  it('the vacuous-pass semantics are documented: a peerless manifest imposes no constraint (the pre-fix state the review closed)', async () => {
    const { evaluatePluginCompatibility } = await loadEvaluator()
    const peerless = { name: 'peerless-example', version: '1.0.0' }
    // No peerDependencies key at all → the gate imposes nothing (0.2 upstream
    // semantic, unchanged from 0.1.7) — which is exactly why the pre-fix
    // "PASS" proved nothing.
    expect(evaluatePluginCompatibility(peerless, {}, EXPECTED_RUNTIME)).toBeUndefined()
    expect(evaluatePluginCompatibility(peerless, {}, PREVIOUS_GENERATION)).toBeUndefined()
  })

  it('mechanics: the evaluator recognizes an exact-version exemption (documented, never granted here)', async () => {
    const { evaluatePluginCompatibility } = await loadEvaluator()
    const key = `${manifest.name}@${manifest.version}`
    const issue = evaluatePluginCompatibility(manifest, { [key]: [PREVIOUS_GENERATION] }, PREVIOUS_GENERATION)
    // The mismatch is still REPORTED (the exemption marks it, it does not
    // erase it) — and this repo never supplies the exemption: the real-host
    // smoke asserts no compatibility.json grant exists.
    expect(issue?.peers).toEqual({ '@deepseek-ai/dsh': EXPECTED_PEER_RANGE })
    expect(issue?.exempted).toBe(true)
  })
})
