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
 * [R483-fl, this round] NO SILENT CROSS-TREE GRADING. This suite reads TWO
 * trees: the manifest under test (`repoRoot/package.json` — the tree this
 * test file lives in) and the evaluator host (`test-use`). Walking UP for the
 * FIRST tree is a trap: a git worktree without the gitignored
 * `tests/deepseek-harness-test-use` resolved to the MAIN checkout and graded
 * THAT tree's manifest instead — measured on PR #483's branch: 4 REDs against
 * a foreign 9-peer peer set while the branch itself declared ten. The probe
 * below (`assertTestUseProvisioned`, self-tested in this file) fails closed
 * with `DSH_TEST_USE_NOT_PROVISIONED` unless the resolved root IS this
 * worktree (realpath-compared) AND its test-use checkout is a git repo whose
 * HEAD equals `TEST_USE_BASELINE_SHA`. Main-checkout runs, provisioned
 * worktrees, and the hosted census legs (which provision at the checkout root
 * and assert the pin — see `.github/workflows/census-runtime.yml` /
 * `ci-full.yml`; `pr-gate.yml` refuses its census leg before vitest ever
 * starts) all satisfy that shape, so the probe is a no-op exactly where this
 * suite runs green today; a worktree that has NOT provisioned its own
 * test-use now stops loudly with the provisioning instruction (TEST_METHODS
 * §1) instead of grading a foreign tree.
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
import { afterAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { DSH_BASELINE_VERSION, findTestRepoRoot, TEST_USE_BASELINE_SHA, TEST_USE_REL, testUseTree } from '../../../tests/paths.mjs'

/**
 * Fail-closed test-use provisioning probe (R483-fl). Named error so a red in
 * any transcript is greppable and self-explaining; the message carries the
 * three facts a stranger needs: what was found, what was expected, and the
 * exact provisioning command per docs/TEST_METHODS.md §1.
 */
const TEST_USE_NOT_PROVISIONED = 'DSH_TEST_USE_NOT_PROVISIONED'

/** The §1 fresh-worktree provisioning triple, spelled out for the failure text. */
function provisioningInstruction(expectedSha: string): string {
  return 'provision a worktree-local ' + TEST_USE_REL + ' inside the expected root: '
    + '`git clone --local --no-hardlinks <pristine baseline> ' + TEST_USE_REL + '` '
    + '(shared baseline /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness, or copy from the main checkout), '
    + 'then `git -C ' + TEST_USE_REL + ' checkout --detach ' + expectedSha + '` and require '
    + '`git -C ' + TEST_USE_REL + ' rev-parse HEAD` = the pin with a clean `git status --porcelain` '
    + '(docs/TEST_METHODS.md §1; build per §2 before runtime-consuming suites).'
}

interface ProvisioningProbeInput {
  /** What `findTestRepoRoot` walked up to (null when no ancestor carries the marker). */
  readonly foundRoot: string | null
  /** Top of the worktree/checkout the TEST FILE itself lives in (git toplevel). */
  readonly worktreeTop: string
  /** The baseline the test-use checkout's HEAD must equal (`TEST_USE_BASELINE_SHA`). */
  readonly expectedSha: string
}

/**
 * Returns the validated repo root or throws `DSH_TEST_USE_NOT_PROVISIONED`.
 * Pure in its inputs (filesystem + `git rev-parse HEAD` under the resolved
 * root only), which is what lets the self-test below drive every state from
 * fixture trees instead of from the absence of a real provisioning mistake.
 */
function assertTestUseProvisioned(input: ProvisioningProbeInput): string {
  const fail = (detail: string, foundPath: string | null): Error => {
    const error = new Error(
      `test-use provisioning probe refused the grade: ${detail}\n`
      + `  path found:    ${foundPath ?? `(no ancestor of this test file carries ${TEST_USE_REL})`}\n`
      + `  expected root: ${input.worktreeTop} (this test's own tree; test-use must be pinned at ${input.expectedSha})\n`
      + `  provisioning:  ${provisioningInstruction(input.expectedSha)}`,
    )
    error.name = TEST_USE_NOT_PROVISIONED
    return error
  }
  if (input.foundRoot === null) {
    throw fail('no ancestor of this test file carries the test-use marker, so nothing here can grade the pinned host', null)
  }
  const foundRoot = realpathSync(input.foundRoot)
  const worktreeTop = realpathSync(input.worktreeTop)
  if (foundRoot !== worktreeTop) {
    throw fail(
      'the test-use root walked up OUT of this worktree into a foreign tree; this suite reads the manifest '
      + 'under test from the resolved root, so continuing would grade that foreign checkout (the R483-fl trap)',
      foundRoot,
    )
  }
  const testUse = join(foundRoot, TEST_USE_REL)
  if (!existsSync(join(testUse, '.git'))) {
    throw fail(`${TEST_USE_REL} exists but is not its own git checkout (TEST_METHODS §1: the pristine tree is its own git repo)`, testUse)
  }
  let head: string
  try {
    head = execFileSync('git', ['-C', testUse, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    throw fail(`${TEST_USE_REL} is present but git could not read its HEAD — it is not a usable pinned checkout`, testUse)
  }
  if (head !== input.expectedSha) {
    throw fail(`the test-use checkout is pinned at ${head}, not at the baseline ${input.expectedSha} — grading a different host than the pin claims is not a variation, it is a false grade`, testUse)
  }
  return foundRoot
}

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * The tree UNDER REVIEW: the worktree/checkout this test file itself lives in.
 * Same discipline `rc2-kit-pin-hygiene.test.ts` adopted after the ~954-offender
 * incident — the subject of a guard is enumerated from the tree the guard
 * file lives in, never from wherever the walk-up happened to land.
 */
const WORKTREE_TOP = realpathSync(
  execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: HERE, encoding: 'utf8' }).trim(),
)
// Fails closed (DSH_TEST_USE_NOT_PROVISIONED) BEFORE any case below runs when
// this tree has not provisioned its own pinned test-use — no silent grading
// of a foreign checkout, no vacuous local green.
const resolvedRepoRoot = assertTestUseProvisioned({
  foundRoot: findTestRepoRoot(HERE),
  worktreeTop: WORKTREE_TOP,
  expectedSha: TEST_USE_BASELINE_SHA,
})
// Declared type kept explicit: `repoRoot` is the probe-validated root, and
// every read below (manifest, evaluator path) goes through it.
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
/**
 * [PR #352 packaging round] The audited host-provides peer contract: exactly
 * these ten names, each at the same exact RC. HARD-CODED on purpose — the
 * expectation must never be derived from the manifest under test (that would
 * be a self-proving assertion). The real evaluator iterates EVERY
 * `@deepseek-ai/dsh`/`@deepseek-ai/dsh-*` peer, so this full set is what its
 * `issue.peers` carries in all three negative cases below as well.
 *
 * [U7-R3 home lane, this round] The set widens NINE -> TEN with
 * `@deepseek-ai/dsh-home-paths`, and the audit is the host itself: the pinned
 * test-use host declares it as a real dependency — `packages/boot/app-boot/
 * package.json` carries `"@deepseek-ai/dsh-home-paths": "workspace:*"` (the
 * same publish-shape the fs-search peer rides) — and this plugin consumes its
 * PUBLIC root export (`resolveDshHome`) as the production home answer
 * (USER-RULING-20261031 §2 route R1; lane edge booked in
 * scripts/eb3-family-boundaries.mjs + the agent-state-family README). Adding
 * the peer here is the loud re-audit this pin was built to force, done with
 * the evidence on the record — not a silent derivation from the manifest.
 */
const EXPECTED_HOST_PEERS: Record<string, string> = Object.freeze({
  '@deepseek-ai/dsh': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-agent': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-home-paths': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-llm': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-mcp-client': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-scope': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-session': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-spill-local': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-storage-domain': EXPECTED_PEER_RANGE,
  '@deepseek-ai/dsh-tool-fs-search': EXPECTED_PEER_RANGE,
})
const EXPECTED_HOST_PEER_NAMES: readonly string[] = Object.freeze(Object.keys(EXPECTED_HOST_PEERS))
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

  it('the root manifest declares exactly the audited ten host-provided DSH peers (each exact-RC, no range) and none of them as a regular dependency', () => {
    const peers = manifest.peerDependencies ?? {}
    const dshPeers = Object.entries(peers).filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
    // Exact set: the ten audited names, each at the exact RC — nothing more,
    // nothing less (an extra/missing dsh* peer fails here, loudly).
    expect(Object.keys(peers).sort()).toEqual([...EXPECTED_HOST_PEER_NAMES].sort())
    expect(dshPeers.length).toBe(EXPECTED_HOST_PEER_NAMES.length)
    for (const name of EXPECTED_HOST_PEER_NAMES) {
      expect(peers[name]).toBe(EXPECTED_PEER_RANGE)
    }
    // Exact match, not a range: no comparator / wildcard / hygroscopic form.
    for (const [, requirement] of dshPeers) {
      expect(requirement).not.toMatch(/[\s|^~*><=]/)
    }
    // Host-provided contract: a declared peer must NOT also ship as a
    // regular dependency of this manifest (10/10 stay out of `dependencies`).
    const deps = (manifest as { readonly dependencies?: Record<string, string> }).dependencies ?? {}
    for (const name of EXPECTED_HOST_PEER_NAMES) {
      expect(deps).not.toHaveProperty(name)
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
    expect(issue?.peers).toEqual(EXPECTED_HOST_PEERS)
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
      expect(issue?.peers).toEqual(EXPECTED_HOST_PEERS)
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
    expect(issue?.peers).toEqual(EXPECTED_HOST_PEERS)
    expect(issue?.exempted).toBe(true)
  })
})

/**
 * R483-fl — the provisioning probe's own tests, driven from fixture trees
 * under `tests/homes/` (gitignored, in-workspace, removed at teardown, per
 * TEST_METHODS §7 — same scratch convention `rc2-kit-fault-injection.test.ts`
 * uses). Every RED state of the probe is reproducible here WITHOUT hiding a
 * real provisioning: the probe is pure in its inputs, so the fixtures plant
 * exactly the tree shape each branch of the guard sees. The GREEN fixture is
 * the shape main-checkout runs, provisioned worktrees, and the hosted census
 * legs all present: resolved root = own tree, test-use = its own git repo at
 * the expected pin.
 */
describe('R483-fl provisioning probe fails closed (DSH_TEST_USE_NOT_PROVISIONED, fixture trees)', () => {
  const SCRATCH = realpathSync(mkdtempSync(join(WORKTREE_TOP, 'tests', 'homes', 'u7r3-r483fl-')))

  afterAll(() => {
    rmSync(SCRATCH, { recursive: true, force: true })
  })

  /** A bare fake tree root (no test-use marker). */
  function makeTree(name: string): string {
    const dir = join(SCRATCH, name)
    mkdirSync(dir, { recursive: true })
    return realpathSync(dir)
  }

  /**
   * A tree with `tests/deepseek-harness-test-use` inside; `mode: 'repo'`
   * makes the marker its own git checkout (one empty commit) and returns its
   * HEAD as the fixture "pin"; `mode: 'plain'` leaves a marker that is not a
   * checkout.
   */
  function makeProvisionedTree(name: string, mode: 'repo' | 'plain'): { root: string; head: string } {
    const root = makeTree(name)
    const testUse = join(root, TEST_USE_REL)
    mkdirSync(testUse, { recursive: true })
    if (mode === 'plain') return { root, head: '' }
    execFileSync('git', ['-C', testUse, 'init', '-q', '.'], { stdio: 'ignore' })
    execFileSync('git', ['-C', testUse, '-c', 'user.email=guard@fixture.invalid', '-c', 'user.name=guard',
      'commit', '-q', '--allow-empty', '-m', 'fixture baseline'], { stdio: 'ignore' })
    const head = execFileSync('git', ['-C', testUse, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    return { root, head }
  }

  /** Run the probe, capture the failure instead of letting it escape the case. */
  function probeFailure(input: ProvisioningProbeInput): { name: string; message: string } | null {
    try {
      assertTestUseProvisioned(input)
      return null
    } catch (error) {
      const err = error as Error
      return { name: err.name, message: err.message }
    }
  }

  const FAKE_PIN = 'f'.repeat(40)

  it('green fixture: own-tree test-use at its pin passes and returns the validated root', () => {
    const fixture = makeProvisionedTree('green', 'repo')
    const validated = assertTestUseProvisioned({
      foundRoot: fixture.root,
      worktreeTop: fixture.root,
      expectedSha: fixture.head,
    })
    expect(validated).toBe(fixture.root)
  })

  it('green fixture through a symlink alias of the worktree top (realpath comparison, not string comparison)', () => {
    const fixture = makeProvisionedTree('symlink', 'repo')
    const alias = join(SCRATCH, 'alias-to-green')
    execFileSync('ln', ['-s', fixture.root, alias])
    const validated = assertTestUseProvisioned({
      foundRoot: alias,
      worktreeTop: fixture.root,
      expectedSha: fixture.head,
    })
    expect(validated).toBe(fixture.root)
  })

  it('RED: a resolved root OUTSIDE this worktree (the main-checkout fallback) fails closed, naming both roots and the command', () => {
    const foreign = makeProvisionedTree('foreign-found', 'repo')
    const own = makeTree('own-worktree')
    const failure = probeFailure({ foundRoot: foreign.root, worktreeTop: own, expectedSha: FAKE_PIN })
    expect(failure, 'the walk-up-to-foreign-tree state must not pass').not.toBeNull()
    expect(failure!.name).toBe(TEST_USE_NOT_PROVISIONED)
    expect(failure!.message).toContain(foreign.root) // path found
    expect(failure!.message).toContain(own) // expected root
    expect(failure!.message).toContain('clone --local --no-hardlinks') // §1 instruction
    expect(failure!.message).toContain(FAKE_PIN)
  })

  it('RED: a null resolution fails closed with the marker path and the instruction', () => {
    const own = makeTree('null-found')
    const failure = probeFailure({ foundRoot: null, worktreeTop: own, expectedSha: FAKE_PIN })
    expect(failure, 'no marker anywhere must not pass').not.toBeNull()
    expect(failure!.name).toBe(TEST_USE_NOT_PROVISIONED)
    expect(failure!.message).toContain(TEST_USE_REL)
    expect(failure!.message).toContain(own)
  })

  it('RED: marker present in the right tree but not a git checkout fails closed', () => {
    const fixture = makeProvisionedTree('not-a-repo', 'plain')
    const failure = probeFailure({ foundRoot: fixture.root, worktreeTop: fixture.root, expectedSha: FAKE_PIN })
    expect(failure, 'a directory masquerading as the pristine host must not pass').not.toBeNull()
    expect(failure!.name).toBe(TEST_USE_NOT_PROVISIONED)
    expect(failure!.message).toContain('not its own git checkout')
  })

  it('RED: an in-tree checkout at the WRONG commit fails closed, naming found HEAD and the pin', () => {
    const fixture = makeProvisionedTree('wrong-pin', 'repo')
    const failure = probeFailure({ foundRoot: fixture.root, worktreeTop: fixture.root, expectedSha: FAKE_PIN })
    expect(failure, 'a baseline drift must not pass').not.toBeNull()
    expect(failure!.name).toBe(TEST_USE_NOT_PROVISIONED)
    expect(failure!.message).toContain(fixture.head) // what it actually is
    expect(failure!.message).toContain(FAKE_PIN) // what it must be
  })
})
