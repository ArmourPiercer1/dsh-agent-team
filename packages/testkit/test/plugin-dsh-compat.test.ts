/**
 * F1 (PR #29 review supplement) — the plugin's DSH runtime peer
 * compatibility gate, verified against the REAL 0.1.7-rc.1 compatibility
 * evaluator (the upstream `app-boot` built entry of the pinned test-use
 * checkout — the same code the host runs at preflight).
 *
 * The review found the PR's original U8 install proof was vacuous: with no
 * `peerDependencies` on the plugin manifest the upstream gate imposes no
 * constraint ("Missing DSH peers impose no constraint"), so the plugin
 * "passed" without ever participating in the version-compatibility check
 * despite being deliberately migrated to the 0.1.7 breaking surfaces.
 *
 * This test locks both halves:
 *   1. the manifest actually declares the exact-RC peer
 *      (`@deepseek-ai/dsh: 0.1.7-rc.1` — the review ruling: no ranges, no
 *      `*`, no 0.1.5-rc.2 compatibility claim), and
 *   2. the checker's behavior on THAT manifest:
 *      - runtime 0.1.7-rc.1 → compatible, no exemption needed (positive);
 *      - runtime 0.1.5-rc.2 / 0.1.7-rc.2 → the evaluator reports the
 *        unmet peer and NO active exemption (negative — the gate now
 *        genuinely rejects this plugin on the wrong runtime);
 *      - the vacuous-pass semantics are documented (a peerless manifest
 *        imposes no constraint — the pre-fix state);
 *      - the exact-version exemption mechanism is recognized by the
 *        evaluator (mechanics only — this repo grants none; the host-side
 *        H1 smoke proves no `compatibility.json` grant exists).
 *
 * Prohibited forms (review §1.3) are all avoided: no string-grep as the
 * only check, no `allow-version` exemption making a mismatched case pass,
 * no field-presence-only assertion without checker behavior.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { findTestRepoRoot, testUseTree, TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'

const resolvedRepoRoot = findTestRepoRoot(fileURLToPath(import.meta.url))
if (resolvedRepoRoot === null) {
  throw new Error('plugin-dsh-compat: cannot resolve the team-repo root from the test location')
}
// A separate const so the null-guard narrowing is part of the declared type
// (top-level narrowing does not flow into function bodies).
const repoRoot: string = resolvedRepoRoot

/** The pinned test-use generation (the 0.1.7-rc.1 release point). */
const EXPECTED_RUNTIME = '0.1.7-rc.1'
/** The review ruling: the exact RC peer, nothing broader. */
const EXPECTED_PEER_RANGE = '0.1.7-rc.1'

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
        'pluginCompatibilityWarning) — the 0.1.7 compatibility gate shape changed',
    )
  }
  return { evaluatePluginCompatibility: evaluate, getDshRuntimeVersion: runtime, pluginCompatibilityWarning: warning }
}

const manifest = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf8'),
) as { readonly name: string; readonly version: string; readonly peerDependencies?: Record<string, string> }

describe('F1 plugin DSH peer compatibility (real 0.1.7-rc.1 evaluator, test-use @ ' + TEST_USE_BASELINE_SHA.slice(0, 10) + ')', () => {
  it('the pinned test-use runtime self-reports 0.1.7-rc.1 (the evaluator runs from the pinned generation)', async () => {
    const { getDshRuntimeVersion } = await loadEvaluator()
    expect(getDshRuntimeVersion()).toBe(EXPECTED_RUNTIME)
  })

  it('the root manifest declares the exact-RC DSH peer (and no other dsh* peer, no range)', () => {
    const peers = manifest.peerDependencies ?? {}
    const dshPeers = Object.entries(peers).filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
    expect(dshPeers).toEqual([
      ['@deepseek-ai/dsh', EXPECTED_PEER_RANGE],
    ])
  })

  it('positive: runtime 0.1.7-rc.1 → compatible, the evaluator reports no issue (no exemption needed)', async () => {
    const { evaluatePluginCompatibility } = await loadEvaluator()
    expect(evaluatePluginCompatibility(manifest, {}, EXPECTED_RUNTIME)).toBeUndefined()
  })

  it('negative: runtime 0.1.5-rc.2 → the evaluator reports the unmet peer with NO active exemption (the gate now rejects)', async () => {
    const { evaluatePluginCompatibility, pluginCompatibilityWarning } = await loadEvaluator()
    const issue = evaluatePluginCompatibility(manifest, {}, '0.1.5-rc.2')
    expect(issue).toBeDefined()
    expect(issue?.name).toBe(manifest.name)
    expect(issue?.version).toBe(manifest.version)
    expect(issue?.runtimeVersion).toBe('0.1.5-rc.2')
    expect(issue?.peers).toEqual({ '@deepseek-ai/dsh': EXPECTED_PEER_RANGE })
    expect(issue?.exempted).toBe(false)
    // The host-facing diagnostic names the plugin@version key the
    // exact-version exemption mechanism would key on (mechanics check —
    // this repo grants none).
    expect(pluginCompatibilityWarning(issue!)).toContain(`${manifest.name}@${manifest.version}`)
    expect(pluginCompatibilityWarning(issue!)).toContain('not active')
  })

  it('negative: a later prerelease (0.1.7-rc.2) is also unmet — the exact-RC range does not widen', async () => {
    const { evaluatePluginCompatibility } = await loadEvaluator()
    const issue = evaluatePluginCompatibility(manifest, {}, '0.1.7-rc.2')
    expect(issue?.peers).toEqual({ '@deepseek-ai/dsh': EXPECTED_PEER_RANGE })
    expect(issue?.exempted).toBe(false)
  })

  it('the vacuous-pass semantics are documented: a peerless manifest imposes no constraint (the pre-fix state the review closed)', async () => {
    const { evaluatePluginCompatibility } = await loadEvaluator()
    const peerless = { name: manifest.name, version: manifest.version }
    // No peers → no constraint on ANY runtime (the 0.1.7 upstream semantic
    // the review quoted) — which is exactly why the pre-fix U8 "PASS"
    // proved nothing.
    expect(evaluatePluginCompatibility(peerless, {}, '0.1.7-rc.1')).toBeUndefined()
    expect(evaluatePluginCompatibility(peerless, {}, '0.1.5-rc.2')).toBeUndefined()
  })

  it('mechanics: the evaluator recognizes an exact-version exemption (documented, never granted here)', async () => {
    const { evaluatePluginCompatibility } = await loadEvaluator()
    const key = `${manifest.name}@${manifest.version}`
    const issue = evaluatePluginCompatibility(manifest, { [key]: ['0.1.5-rc.2'] }, '0.1.5-rc.2')
    // The mismatch is still REPORTED (the exemption marks it, it does not
    // erase it) — and this repo never supplies the exemption: the H1
    // real-host smoke asserts no compatibility.json grant exists.
    expect(issue?.peers).toEqual({ '@deepseek-ai/dsh': EXPECTED_PEER_RANGE })
    expect(issue?.exempted).toBe(true)
  })
})
