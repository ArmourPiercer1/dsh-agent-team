/**
 * m7b1-observation-window.test.mjs — M7-B1: the World Factory owns the
 * filesystem observation window, and three real FS controls prove the window
 * BITES.
 *
 * WHAT IS DIFFERENT FROM M7-A. M7-A's suite decided, inside itself, what the
 * witness watched and which paths were authorized — the observation made its own
 * rules. Here the contract (identity + scope + authorized/forbidden paths +
 * claim) is DECLARED through `tests/world-factory/lib/m7b1-observation-contract.mjs`
 * and validated there; the window is opened and closed by that module; the
 * verdict is only reachable through the closed window, with `witnessProvenance:
 * 'witnessed'` and the window id pinned. Every precondition (host absent, tree
 * unpinned, assets unproven, scope unresolvable/symlinked, witness unsealed) is a
 * NAMED `INSTRUMENT_ERROR`, never a `SATISFIED`.
 *
 * THE REAL-HOST ARMS (one boot, one session per arm, cells = one real tool call):
 *
 *   A1 INSIDE-AUTHORIZED  a `write` into the World workspace is REPORTED and
 *                         excluded — the verdict is SATISFIED on a contract that
 *                         authorizes it, so the window is not "everything is a
 *                         violation".
 *   A2 OUTSIDE-AUTHORIZED a `write` into the graded, non-authorized directory is
 *                         VIOLATED, and the judgement names THE EXACT PATH.
 *   A3 SAME-DIRECTORY     the harness writes ITS OWN file into the graded
 *                         directory DURING the window, and the tool writes a
 *                         sibling in the SAME directory. A directory-shaped watch
 *                         would report "D changed" (or, worse, ignore D because
 *                         the harness uses it). The verdict must be VIOLATED on
 *                         the sibling path alone, with the harness's own file
 *                         classified AUTHORIZED — per-entry, not per-directory.
 *   A4 DENIAL-VERBATIM    a `write` outside the workspace is refused by the
 *                         Host's own fs sandbox; the suite captures the VERBATIM
 *                         `FS_SANDBOX_DENIED` line the Host emitted (from its
 *                         durable trace) and prints it. Nothing here fabricates a
 *                         denial.
 *   A5 FORGED-WITNESS     a hand-built row carrying the CORRECT window id is
 *                         INSTRUMENT_ERROR: the seal is identity, not a field.
 *   A6 WINDOW-MISMATCH    a real sealed row from ANOTHER window is refused
 *                         because its window_id is not this contract's.
 *
 * HOST STATES. Host absent -> the suite still grades the fail-closed half
 * (A5/A6 and the module's refusals are host-state independent) and asserts that
 * opening a window over the absent tree answers `INSTRUMENT_ERROR reason=
 * HOST_ABSENT`; the boot arms are then a DECLARED refusal, and
 * `M7B1_REQUIRE_PINNED_HOST=1` turns that into a hard failure. There is no path
 * on which an absent host produces a green window.
 *
 * Run:  node --test --test-reporter=spec tests/world-factory/m7b1-observation-window.test.mjs
 * CI:   .github/workflows/census-runtime.yml (the one job that provisions the pinned host)
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { apiSessionCreate, authenticate, stableInstanceProbe, TestWorldFactory } from './lib/world-factory.mjs'
import { runTurn, startRealRun } from './lib/m7a-real-run.mjs'
import {
  ObservationContractRefusal,
  closeObservationWindow,
  declareObservationContract,
  formatWindowIdentity,
  judgeObservationWindow,
  openObservationWindow,
} from './lib/m7b1-observation-contract.mjs'
import { TEST_USE_BASELINE_SHA, testUseTree } from '../paths.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
// `M7B1_HOST_TREE` exists so the refusal path itself can be graded (and so a
// provisioned host elsewhere can be pointed at); the default is the pinned tree.
const HOST_TREE = process.env.M7B1_HOST_TREE ?? testUseTree(REPO_ROOT)
const HOST_PRESENT = existsSync(join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js'))
const REQUIRE_HOST = process.env.M7B1_REQUIRE_PINNED_HOST === '1'
const BOOT_TIMEOUT_MS = Number(process.env.M7B1_BOOT_TIMEOUT_MS ?? 180_000)
const TMP_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'm7b1-observation-window')
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

if (!HOST_PRESENT) {
  console.log(
    `M7B1-HOST-REFUSED host=${HOST_TREE} reason=apps/cli/lib/bin.js is absent (built runtime checkout missing) ` +
      'action=provision per docs/TEST_METHODS.md §1/§2 or set M7B1_REQUIRE_PINNED_HOST=1 to fail instead',
  )
}

/** A throwaway directory under the workspace (never /tmp: it is per-command here). */
function scratch(name) {
  mkdirSync(TMP_ROOT, { recursive: true })
  return mkdtempSync(join(TMP_ROOT, `${name}-`))
}

/** Declare the probe refuses with `code`, and return the refusal for its detail. */
function refuses(code, fn) {
  try {
    const value = fn()
    assert.fail(`expected the contract module to refuse ${code}, got ${JSON.stringify(value)}`)
  } catch (error) {
    if (error instanceof ObservationContractRefusal) {
      assert.equal(error.code, code, `the refusal names ${error.code}, expected ${code} (${error.message})`)
      return error
    }
    throw error
  }
}

const fakeWorld = (root, id = 'm7b1-probe') => ({ id, home: root, workspaceDir: join(root, 'workspace') })

// ─────────────────────────────────────────────────────────────────────────────
// 1. The fail-closed half. No host, no boot: every refusal is a named verdict.
// ─────────────────────────────────────────────────────────────────────────────
test('M7-B1 contract: every unestablished window is a NAMED INSTRUMENT_ERROR, never SATISFIED', async (t) => {
  const root = scratch('refusals')
  const home = join(root, 'home')
  const watched = join(home, 'watched')
  mkdirSync(watched, { recursive: true })
  const world = fakeWorld(home)
  const identity = { agentId: 'agent-probe', executionId: 'exec-probe' }

  await t.test('host absent -> INSTRUMENT_ERROR reason=HOST_ABSENT, and the verdict is not SATISFIED', async () => {
    const absent = join(root, 'no-host-here')
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    const opened = await openObservationWindow({ contract, hostTree: absent })
    assert.equal(opened.ok, false, 'a window over an absent host cannot open')
    assert.equal(opened.verdict, 'INSTRUMENT_ERROR')
    assert.equal(opened.reason, 'HOST_ABSENT')
    assert.match(opened.detail, /apps\/cli\/lib\/bin\.js is absent/u)
    const judgement = await judgeObservationWindow({ contract, opened, closed: null, events: [] })
    assert.equal(judgement.verdict, 'INSTRUMENT_ERROR', 'an unopened window can never be SATISFIED')
    assert.match(judgement.reasons.join('\n'), /HOST_ABSENT/u, 'the verdict names the reason it could not observe')
  })

  await t.test('an unpinned host tree -> HOST_TREE_UNPINNED (the pin is read, never assumed)', async () => {
    const tree = join(root, 'unpinned-host')
    mkdirSync(join(tree, 'apps', 'cli', 'lib'), { recursive: true })
    writeFileSync(join(tree, 'apps', 'cli', 'lib', 'bin.js'), '// a runtime entry that exists\n')
    execFileSync('git', ['-C', tree, 'init', '-q', '.'])
    execFileSync('git', ['-C', tree, '-c', 'user.email=m7b1@example.invalid', '-c', 'user.name=m7b1', 'commit', '-q', '--allow-empty', '-m', 'not the pin'])
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    const opened = await openObservationWindow({ contract, hostTree: tree })
    assert.equal(opened.ok, false)
    assert.equal(opened.reason, 'HOST_TREE_UNPINNED')
    assert.match(opened.detail, new RegExp(TEST_USE_BASELINE_SHA, 'u'), 'the refusal names the pin it compared against')
  })

  await t.test('a tree at the pin with UNPROVEN native assets -> HOST_ASSETS_UNPROVEN', async () => {
    // A tree whose HEAD answers the pin but whose gitignored native assets are
    // absent: the sandbox backend cannot be exercised, so a "denial" would be an
    // environment fact wearing the product's name. Refused by name.
    const tree = join(root, 'pin-only-host')
    mkdirSync(join(tree, 'apps', 'cli', 'lib'), { recursive: true })
    writeFileSync(join(tree, 'apps', 'cli', 'lib', 'bin.js'), '// a runtime entry that exists\n')
    execFileSync('git', ['-C', tree, 'init', '-q', '.'])
    writeFileSync(join(tree, '.git', 'HEAD'), `${TEST_USE_BASELINE_SHA}\n`)
    assert.equal(execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), TEST_USE_BASELINE_SHA)
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    const opened = await openObservationWindow({ contract, hostTree: tree })
    assert.equal(opened.ok, false)
    assert.equal(opened.reason, 'HOST_ASSETS_UNPROVEN')
    assert.match(opened.detail, /glibc\/system\.node is absent|sha256=/u)
  })

  await t.test('the scope algebra refuses everything it cannot bind', async () => {
    const target = join(home, 'elsewhere')
    mkdirSync(target, { recursive: true })
    const link = join(root, 'symlinked-root')
    symlinkSync(target, link)

    refuses('SCOPE_SYMLINK', () => declareObservationContract({ world, ...identity, scope: [link] }))
    refuses('SCOPE_NOT_ABSOLUTE', () => declareObservationContract({ world, ...identity, scope: ['relative/dir'] }))
    refuses('SCOPE_UNRESOLVABLE', () => declareObservationContract({ world, ...identity, scope: [join(root, 'does-not-exist')] }))
    refuses('SCOPE_UNRESOLVABLE', () => declareObservationContract({ world, ...identity, scope: [join(root, 'refusals-home-file')] }))
    refuses('SCOPE_EMPTY', () => declareObservationContract({ world, ...identity, scope: [] }))
    refuses('SCOPE_DOES_NOT_COVER', () => declareObservationContract({ world, ...identity, scope: [watched], authorizedPaths: [join(home, 'somewhere-else')] }))
    refuses('SCOPE_DOES_NOT_COVER', () => declareObservationContract({ world, ...identity, scope: [watched], forbiddenPaths: [join(root, 'far-away')] }))
    refuses('SCOPE_PARTIAL_FOR_DOMAIN', () => declareObservationContract({ world, ...identity, scope: [watched], claim: 'filesystem-domain' }))
    refuses('IDENTITY_INVALID', () => declareObservationContract({ world, agentId: '', executionId: 'e', scope: [watched] }))
    refuses('IDENTITY_INVALID', () => declareObservationContract({ world, agentId: 'a', executionId: '   ', scope: [watched] }))
    refuses('IDENTITY_INVALID', () => declareObservationContract({ world: { id: '', home }, ...identity, scope: [watched] }))
  })

  await t.test('the scope is RE-RESOLVED at open time, and the host preconditions keep their order', async () => {
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    // The declared scope is re-resolved when the window opens: a root that became
    // a symlink (or vanished) after the declaration must not silently become a
    // different scope. With a pinned host present this is observable directly;
    // without one the host precondition answers first, and that ORDER is pinned
    // here so a future edit cannot move the host check after the instrument.
    const linkedContract = { ...contract, scope: [join(root, 'symlinked-root')] }
    const absent = await openObservationWindow({ contract: linkedContract, hostTree: join(root, 'nothing') })
    assert.equal(absent.ok, false)
    assert.equal(absent.reason, 'HOST_ABSENT', 'no instrument is built on a host we do not have')
    if (HOST_PRESENT) {
      const opened = await openObservationWindow({ contract: linkedContract, hostTree: HOST_TREE })
      assert.equal(opened.ok, false, 'a symlinked root cannot be bound at open time')
      assert.equal(opened.reason, 'SCOPE_SYMLINK')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. The boot half: one real pinned Host, the window in front of real effects.
// ─────────────────────────────────────────────────────────────────────────────
test('M7-B1 real-host window: inside/outside/same-directory controls, verbatim denial, forged and foreign witnesses', { timeout: 1_200_000 }, async (t) => {
  if (!HOST_PRESENT) {
    // The fail-closed proof still runs here, and it is the whole point of this
    // branch: an absent host must produce INSTRUMENT_ERROR/HOST_ABSENT.
    const root = scratch('absent-host')
    const home = join(root, 'home')
    const watched = join(home, 'watched')
    mkdirSync(watched, { recursive: true })
    const contract = declareObservationContract({ world: fakeWorld(home), agentId: 'a', executionId: 'e', scope: [watched] })
    const opened = await openObservationWindow({ contract, hostTree: HOST_TREE })
    assert.equal(opened.ok, false)
    assert.equal(opened.reason, 'HOST_ABSENT', `an absent pinned host must be answered by name, got ${JSON.stringify(opened.reason)}`)
    const judgement = await judgeObservationWindow({ contract, opened, closed: null, events: [] })
    assert.equal(judgement.verdict, 'INSTRUMENT_ERROR')
    t.diagnostic(`M7B1-WINDOW verdict=INSTRUMENT_ERROR reason=HOST_ABSENT host=${HOST_TREE}`)
    if (REQUIRE_HOST) assert.fail(`M7B1-HOST-ABSENT: ${join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js')} is absent but M7B1_REQUIRE_PINNED_HOST=1`)
    t.skip('pinned host runtime absent (declared refusal above) — the fail-closed half was graded')
    return
  }

  const evidenceDir = join(TMP_ROOT, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(evidenceDir, { recursive: true })
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidenceDir, hostTree: HOST_TREE })
  const startedAt = Date.now()
  let world = null
  let report = null
  const teardown = async (why) => {
    if (world === null) return
    const at = Date.now()
    try {
      const result = await world.teardown({ keepHome: false })
      console.error(`[M7B1] teardown (${why}) in ${String(Date.now() - at)}ms`)
      return result
    } catch (error) {
      console.error(`[M7B1] teardown (${why}) FAILED:`, error?.stack ?? error)
      throw error
    }
  }
  t.after(async () => {
    try {
      await teardown('t.after')
    } catch {
      /* already printed; the test is failing for its own reason */
    }
  })

  try {
    const stableBefore = await stableInstanceProbe()
    const bootBaseBefore = factory.assertHostBase('before')

    world = await factory.createWorld({ line: 'm7b1' })
    const tmpDir = join(world.home, 'm7b1-tmp')
    const watchedDir = join(tmpDir, 'm7b1-watched')
    const harnessDir = join(tmpDir, 'm7b1-harness')
    mkdirSync(watchedDir, { recursive: true })
    mkdirSync(harnessDir, { recursive: true })
    const harnessOwn = join(harnessDir, 'harness-own.json')

    // The arms. `gradedTurn` is the 1-based turn whose call id the contract binds
    // (the execution under grade); `expect` is the pre-registered verdict.
    const arms = [
      {
        tag: 'inside-authorized',
        expect: 'SATISFIED',
        steps: [
          { prompt: 'M7B1-A1a write outside the workspace', file: '../a1-escape.txt', content: 'A1\n', outcome: 'DENIED' },
          { prompt: 'M7B1-A1b write the workspace', file: '@workspace/inside.txt', content: 'M7B1-A1\n', outcome: 'COMPLETED' },
        ],
        gradedTurn: 2,
        authorized: (w) => [w.workspaceDir, join(w.home, 'sessions'), join(w.home, 'storages'), tmpDir],
        forbidden: () => [],
        scope: (w) => [w.home],
      },
      {
        tag: 'outside-authorized',
        expect: 'VIOLATED',
        steps: [
          { prompt: 'M7B1-A2a write outside the workspace', file: '../a2-escape.txt', content: 'A2\n', outcome: 'DENIED' },
          { prompt: 'M7B1-A2b write the graded directory', file: '@watched/beside.txt', content: 'M7B1-A2\n', outcome: 'COMPLETED' },
        ],
        gradedTurn: 2,
        // Everything the Host itself writes while EXECUTING is authorized (its
        // durable log, its projection cache, its own temp spool); the watched
        // directory inside that temp root is forbidden and DENY BEATS ALLOW, which
        // is the exact shape of a sandbox deny-rule inside a writable tree.
        authorized: (w) => [w.workspaceDir, join(w.home, 'sessions'), join(w.home, 'storages'), tmpDir],
        forbidden: () => [watchedDir],
        scope: (w) => [w.home],
      },
      {
        tag: 'same-directory-as-harness',
        expect: 'VIOLATED',
        steps: [
          { prompt: 'M7B1-A3a write outside the workspace', file: '../a3-escape.txt', content: 'A3\n', outcome: 'DENIED' },
          { prompt: 'M7B1-A3b write beside the harness file', file: '@harness/beside-harness.txt', content: 'M7B1-A3\n', outcome: 'COMPLETED' },
        ],
        gradedTurn: 2,
        // ONE directory, TWO rulings, and the harness's own file is on the
        // authorized side: the World's executing state (the Host's own temp spool)
        // and the harness's own bookkeeping file are authorized PATH BY PATH, and
        // exactly one sibling inside that same directory is FORBIDDEN — deny beats
        // allow, at file granularity. A directory-shaped watch could not produce
        // this pair of answers.
        authorized: (w) => [w.workspaceDir, join(w.home, 'sessions'), join(w.home, 'storages'), tmpDir, harnessOwn],
        forbidden: () => [join(harnessDir, 'beside-harness.txt')],
        scope: (w) => [w.home],
        beforeClose: (w) => {
          // Written INSIDE the window, in the SAME directory the violation lands in.
          writeFileSync(harnessOwn, `${JSON.stringify({ m7b1: 'harness-own', at: new Date().toISOString() })}\n`)
          return harnessOwn
        },
      },
    ]

    // ONE script for the whole boot: the wire driver replays a single turn list, so
    // the arms are concatenated and each arm's call ids are derived from its GLOBAL
    // turn offset (a per-arm script would leave later arms unmatched and they would
    // "run" a text turn instead of a tool call).
    const pathOf = (step) => {
      if (step.file.startsWith('@workspace/')) return join(world.workspaceDir, step.file.slice('@workspace/'.length))
      if (step.file.startsWith('@watched/')) return join(watchedDir, step.file.slice('@watched/'.length))
      if (step.file.startsWith('@harness/')) return join(harnessDir, step.file.slice('@harness/'.length))
      return step.file
    }
    const script = {
      schema: 'agent-script/1',
      world: world.id,
      turns: arms.flatMap((arm) =>
        arm.steps.flatMap((step) => [
          {
            expect_request: { tools_include: [step.tool ?? 'write'], contains_text: step.prompt },
            respond: { kind: 'tool-call', name: step.tool ?? 'write', args: { file_path: pathOf(step), content: step.content } },
          },
          { respond: { kind: 'text', text: `M7B1-${arm.tag}-DONE` } },
        ]),
      ),
    }
    /** The scripted call id for arm `armIndex`, step `stepIndex` (0-based turns). */
    const callIdOf = (armIndex, stepIndex) => {
      const turnsBefore = arms.slice(0, armIndex).reduce((sum, a) => sum + a.steps.length * 2, 0)
      return `m7b1-${turnsBefore + stepIndex * 2}`
    }

    const run = await startRealRun({
      world,
      tmpDir,
      script,
      callIdPrefix: 'm7b1',
      bootTimeoutMs: BOOT_TIMEOUT_MS,
    })
    const bootMs = Date.now() - startedAt
    report = { world: world.id, port: run.port, bootMs, arms: [], hostSha: TEST_USE_BASELINE_SHA, hostTree: HOST_TREE }

    const openSession = async (label) => {
      const cookie = await authenticate(run.origin, run.token)
      const created = await apiSessionCreate(run.origin, cookie, run.workspaceDir, label)
      const sessionId = created.body?.result?.value?.sessionId
      assert.equal(typeof sessionId, 'string', `session/create must return a session id: ${JSON.stringify(created.body)?.slice(0, 300)}`)
      return { ...run, cookie, sessionId }
    }

    let foreignWindowRows = null
    for (const [index, arm] of arms.entries()) {
      const session = index === 0 ? run : await openSession(`m7b1-${arm.tag}`)
      const expectedIds = arm.steps.map((_, i) => callIdOf(index, i))
      const contract = declareObservationContract({
        world,
        agentId: session.sessionId,
        executionId: expectedIds[arm.gradedTurn - 1],
        scope: arm.scope(world),
        authorizedPaths: arm.authorized(world),
        forbiddenPaths: arm.forbidden(world),
      })
      const opened = await openObservationWindow({ contract, hostTree: HOST_TREE })
      assert.equal(opened.ok, true, `A${index + 1} ${arm.tag}: the window opens on the pinned host (got ${JSON.stringify(opened)})`)
      t.diagnostic(formatWindowIdentity(contract, opened.window))

      let events = []
      const steps = []
      for (const [stepIndex, step] of arm.steps.entries()) {
        const turn = await runTurn(session, { prompt: step.prompt, turn: stepIndex + 1 })
        events = events.concat(turn.events)
        const target = pathOf(step)
        const result = turn.events.find((event) => event.event_type === 'tool/result')
        steps.push({
          prompt: step.prompt,
          target,
          outcome: result?.outcome ?? null,
          errorCode: result?.error_code ?? null,
          resultText: result?.result_text ?? null,
          exists: existsSync(target),
          digest: existsSync(target) ? sha256(readFileSync(target)) : null,
        })
      }
      const harnessFile = arm.beforeClose === undefined ? null : arm.beforeClose(world)
      const closed = await closeObservationWindow({ opened })
      assert.equal(closed.ok, true, `${arm.tag}: the window closes with sealed, in-window rows (got ${JSON.stringify(closed.reason ?? '')})`)

      const judgement = await judgeObservationWindow({ contract, opened, closed, events, expectDeny: true })
      const observed = judgement.observedEffectPaths ?? []
      const authorized = judgement.authorizedEffectPaths ?? []
      const unauthorized = judgement.unauthorizedEffectPaths ?? []
      report.arms.push({
        arm: arm.tag,
        contract,
        window: closed.window,
        verdict: judgement.verdict,
        reasons: judgement.reasons,
        limitations: judgement.limitations,
        observed,
        authorized,
        unauthorized,
        steps,
        trace: events,
      })
      t.diagnostic(`M7B1-ARM ${arm.tag} verdict=${judgement.verdict} expected=${arm.expect} unauthorized=${JSON.stringify(unauthorized)}`)
      assert.equal(judgement.verdict, arm.expect, `${arm.tag}: verdict matches the pre-registered expectation (reasons: ${JSON.stringify(judgement.reasons)})`)

      // ── the identity is BOUND, not assumed: the host's durable call id is the
      // one the contract named, for the execution under grade.
      const calls = events.filter((event) => event.event_type === 'tool/call')
      assert.deepEqual(
        calls.map((call) => call.execution_id),
        expectedIds,
        `${arm.tag}: the host issued the scripted calls, and the graded one is ${contract.execution_id}`,
      )
      assert.ok(
        judgement.reasons.length > 0,
        `${arm.tag}: a verdict always carries its reasons`,
      )

      // ── A1: the authorized write is REPORTED and EXCLUDED, never dropped.
      if (arm.tag === 'inside-authorized') {
        const wrote = join(world.workspaceDir, 'inside.txt')
        assert.equal(steps[1].exists, true, 'A1: the workspace write really happened')
        assert.equal(steps[1].digest, sha256('M7B1-A1\n'), 'A1: the bytes are exactly what the tool wrote')
        assert.ok(observed.includes(wrote), `A1: the authorized effect is REPORTED (got ${JSON.stringify(observed)})`)
        assert.ok(authorized.includes(wrote), 'A1: and classified AUTHORIZED')
        assert.deepEqual(unauthorized, [], 'A1: nothing outside the authorized set was touched')
        assert.ok(judgement.limitations.some((line) => line.includes('process') && line.includes('network')), 'A1: the verdict states process/network are blind')
        assert.ok(judgement.limitations.some((line) => line.includes('watched paths')), 'A1: the verdict names what the instrument watched')
      }

      // ── A2: a write OUTSIDE the authorized set is VIOLATED, with the exact path.
      if (arm.tag === 'outside-authorized') {
        const violation = join(watchedDir, 'beside.txt')
        assert.equal(steps[1].exists, true, 'A2: the violating write really happened (independent stat)')
        assert.deepEqual(unauthorized, [violation], `A2: the violation is EXACTLY the written path (got ${JSON.stringify(unauthorized)})`)
        assert.ok(judgement.reasons.some((line) => line.includes(violation)), `A2: the verdict names that path in its reasons (got ${JSON.stringify(judgement.reasons)})`)
      }

      // ── A3: same directory as the harness, per-entry classification.
      if (arm.tag === 'same-directory-as-harness') {
        const sibling = join(harnessDir, 'beside-harness.txt')
        assert.equal(harnessFile, harnessOwn)
        assert.equal(resolve(harnessFile).replace(/\/[^/]+$/u, ''), resolve(sibling).replace(/\/[^/]+$/u, ''), 'A3: the harness file and the violation are in the SAME directory')
        assert.equal(existsSync(harnessFile), true, 'A3: the harness really wrote its own file inside the window')
        assert.deepEqual(unauthorized, [sibling], `A3: exactly the sibling is a violation (got ${JSON.stringify(unauthorized)})`)
        assert.ok(authorized.includes(harnessFile), `A3: the harness's own write is AUTHORIZED, not a violation (got ${JSON.stringify(authorized)})`)
        assert.ok(observed.includes(sibling) && observed.includes(harnessFile), 'A3: both entries in that one directory are reported — the watch is per-entry, not per-directory')
        assert.equal(harnessFile in Object.fromEntries(unauthorized.map((p) => [p, true])), false, 'A3: the harness file is never in the unauthorized set')
      }

      // The first REAL window's rows are kept to prove the foreign-window control
      // below uses a genuinely sealed, genuinely windowed observation.
      if (index === 0) foreignWindowRows = closed.rows
    }

    // ── A4: the verbatim denial the Host itself emitted, from its durable trace.
    const denialArm = report.arms[0]
    const denialStep = denialArm.steps[0]
    const denialLine = `error_code=${String(denialStep.errorCode)} outcome=${String(denialStep.outcome)}`
    assert.equal(denialStep.outcome, 'DENIED', 'A4: the escape write is a real Host refusal')
    assert.equal(denialStep.errorCode, 'FS_SANDBOX_DENIED', `A4: the refusal is the fs sandbox, verbatim (got ${denialLine})`)
    assert.equal(denialStep.exists, false, 'A4: the refusal left no bytes (independent stat)')
    assert.ok(
      String(denialStep.resultText ?? '').length > 0,
      'A4: the Host rendered a message for the refusal (recorded verbatim below)',
    )
    const verbatim = `FS_SANDBOX_DENIED ${denialLine} message=${JSON.stringify(String(denialStep.resultText ?? '').replace(/\s+/gu, ' ').trim())}`
    t.diagnostic(`M7B1-DENIAL ${verbatim}`)
    console.error(`M7B1-DENIAL ${verbatim}`)
    report.denial = verbatim

    // ── A5: a FORGED row carrying the correct window id is not evidence.
    const firstContract = report.arms[0].contract
    const firstWindow = report.arms[0].window
    const forged = {
      domain: 'filesystem',
      observed: false,
      instrumented: true,
      evidence: ['forged by the suite: the right shape and the right window id'],
      watchedPaths: [...firstContract.scope],
      observedPaths: [],
      window_id: firstWindow.window_id,
    }
    const forgedOpened = { ok: true, witness: null, window: firstWindow }
    const forgedClosed = { ok: true, window: firstWindow, rows: [forged] }
    const forgedJudgement = await judgeObservationWindow({
      contract: firstContract,
      opened: forgedOpened,
      closed: forgedClosed,
      events: report.arms[0].trace,
      expectDeny: true,
    })
    assert.equal(forgedJudgement.verdict, 'INSTRUMENT_ERROR', 'A5: a hand-built row cannot corroborate a verdict')
    assert.match(forgedJudgement.reasons.join('\n'), /not produced by a testkit witness instrument/u)
    t.diagnostic('M7B1-FORGED verdict=INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED')

    // ── A6: a REAL sealed row from ANOTHER window is refused by window id.
    // The rows are the FIRST arm's (sealed, genuinely windowed); the window they
    // are judged through is the SECOND arm's. Same host, same World, same module —
    // only the window identity differs, which is exactly the substitution a caller
    // could attempt ("these rows are mine, this window is the one I am grading").
    const secondWindow = report.arms[1].window
    assert.notEqual(secondWindow.window_id, firstWindow.window_id, 'A6: the two windows are genuinely different')
    const foreignJudgement = await judgeObservationWindow({
      contract: firstContract,
      opened: { ok: true, witness: null, window: secondWindow },
      closed: { ok: true, window: secondWindow, rows: foreignWindowRows },
      events: report.arms[0].trace,
      expectDeny: true,
    })
    assert.equal(foreignJudgement.verdict, 'INSTRUMENT_ERROR', 'A6: a sealed row from another window is not this window')
    assert.match(foreignJudgement.reasons.join('\n'), /requiredObservationWindowId is/u, 'A6: the refusal names the window binding')

    // The script must be fully consumed: a turn nobody took is drift, not a pass.
    run.driver.assertComplete()
    assert.equal(run.driver.consumedTurns, script.turns.length, 'every scripted turn was consumed by a real agent request')

    // ── the boot facts, recorded
    report.wallMs = Date.now() - startedAt
    report.stableBefore = stableBefore
    report.stableAfter = await stableInstanceProbe()
    report.bootBaseBefore = bootBaseBefore
    writeFileSync(join(evidenceDir, 'm7b1-window-report.json'), `${JSON.stringify(report, null, 2)}\n`)
    t.diagnostic(`M7B1-EVIDENCE ${join(evidenceDir, 'm7b1-window-report.json')}`)
    t.diagnostic(`M7B1-WALL bootMs=${String(bootMs)} totalMs=${String(report.wallMs)}`)
    console.error(`M7B1-WALL bootMs=${String(bootMs)} totalMs=${String(report.wallMs)}`)
    assert.ok(report.wallMs > 0)
    assert.equal(report.stableAfter.status, stableBefore.status, 'the stable :3080 instance was never affected')
  } finally {
    const torn = await teardown('body-finally')
    if (report !== null) report.teardown = torn
  }
})
