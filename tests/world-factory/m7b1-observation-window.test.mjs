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
 *   A6 FOREIGN WINDOW    the SECOND arm's real envelopes (sealed, windowed,
 *                         closed) judged against the FIRST arm's contract are
 *                         IDENTITY_MISMATCH — another observation cannot answer.
 *   A7 MUTATED IDENTITY  a real contract with ONE id rewritten at the caller
 *                         (world/agent/execution) is refused BY THE MODULE with
 *                         IDENTITY_MISMATCH, and a trace that never carried the
 *                         graded execution id is EXECUTION_ID_NOT_IN_TRACE.
 *   A8 FORGED WINDOW     spread / structuredClone / Object.create copies of the
 *                         sealed window record, copies of the envelopes, a foreign
 *                         instrument closing the window, and a second close are
 *                         all WITNESS_NOT_SEALED: the window seal is LIVE.
 *   A9 UNCLOSED WINDOW   judging the armed-but-unclosed window is never
 *                         SATISFIED, and the phase/closedAt rule is pinned
 *                         directly (WINDOW_NOT_CLOSED).
 *
 * THE BINDING IS ALSO PINNED WITHOUT A HOST (test 1): `checkWindowBinding` is a
 * pure function, so the lifecycle/identity/trace rules are proven by mutation on
 * every run, host or no host, and both halves of the seal are pinned against the
 * testkit directly (including a SECOND module instance, whose record this
 * instance must not accept).
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
import { register } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

import { apiSessionCreate, authenticate, stableInstanceProbe, TestWorld, TestWorldFactory } from './lib/world-factory.mjs'
import { runTurn, startRealRun } from './lib/m7a-real-run.mjs'
import {
  ObservationContractRefusal,
  checkWindowBinding,
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
/** One-line diagnostic clipping: never ends with whitespace (evidence files are diff-checked). */
const clip = (value, limit) => String(value ?? '').slice(0, limit).trimEnd()

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

// F-09 (2026-11-19): the contract refuses a hand-written `{id, home}` now, so the
// fail-closed half uses a REAL World object — the Factory's own class, minted by
// its constructor, never booted and rooted at a scratch home (a declaration only
// needs an identity and an owned root). `probeWorld` is not a literal wearing a
// receipt: `isFactoryWorld` answers true for this object and false for a copy.
const PROBE_FACTORY = new TestWorldFactory({
  repoRoot: REPO_ROOT,
  evidenceRoot: join(TMP_ROOT, 'evidence'),
  hostTree: HOST_TREE,
})
const probeWorld = (root, id = 'm7b1-probe') =>
  new TestWorld(PROBE_FACTORY, { id, name: id, home: root, workspaceDir: join(root, 'workspace'), visible: false })

// ─────────────────────────────────────────────────────────────────────────────
// 1. The fail-closed half. No host, no boot: every refusal is a named verdict.
// ─────────────────────────────────────────────────────────────────────────────
test('M7-B1 contract: every unestablished window is a NAMED INSTRUMENT_ERROR, never SATISFIED', async (t) => {
  const root = scratch('refusals')
  const home = join(root, 'home')
  const watched = join(home, 'watched')
  mkdirSync(watched, { recursive: true })
  const world = probeWorld(home)
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
    // `scope:['/']` used to make a domain claim look total while nothing was
    // enumerated. `/` is not a watchable root, so BOTH the root and the claim are
    // refused by name (M7-B1b) — the `ACCEPTED` shape is gone.
    refuses('SCOPE_PARTIAL_FOR_DOMAIN', () => declareObservationContract({ world, ...identity, scope: ['/'], claim: 'filesystem-domain' }))
    refuses('SCOPE_PARTIAL_FOR_DOMAIN', () => declareObservationContract({ world, ...identity, scope: ['/'], authorizedPaths: ['/etc/passwd'] }))
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

  await t.test('M7-B1b: the binding validator refuses an unclosed window, a mutated identity and an unobserved execution', async () => {
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    const call = { event_seq: 1, event_type: 'tool/call', execution_id: identity.executionId, outcome: 'DISPATCHED' }
    const result = { event_seq: 2, event_type: 'tool/result', execution_id: identity.executionId, outcome: 'COMPLETED' }
    const baseWindow = {
      window_id: 'win-probe',
      world_id: contract.world_id,
      agent_id: contract.agent_id,
      execution_id: contract.execution_id,
      phase: 'post',
      closedAt: '2026-11-18T00:00:00.000Z',
      watchedPaths: [...contract.scope],
      armedAt: '2026-11-18T00:00:00.000Z',
      producedBy: '@dsh-agent-team/testkit/effect-witness@1',
    }
    // The happy path, so the refusals below are not the only thing this proves.
    assert.equal(checkWindowBinding({ contract, window: baseWindow, events: [call, result] }), null, 'a closed, correctly bound window IS gradeable')

    // (1) lifecycle: phase `pre` / null closedAt / blank closedAt are all refused.
    for (const [tag, patch] of [
      ['phase=pre', { phase: 'pre' }],
      ['closedAt=null', { closedAt: null }],
      ['closedAt=""', { closedAt: '' }],
    ]) {
      const verdict = checkWindowBinding({ contract, window: { ...baseWindow, ...patch }, events: [call, result] })
      assert.equal(verdict?.reason, 'WINDOW_NOT_CLOSED', `an unclosed window (${tag}) is WINDOW_NOT_CLOSED`)
      console.log(`M7B1-WINDOW-NOT-CLOSED tag=${tag} reason=${verdict.reason} detail=${clip(verdict.detail, 140)}`)
    }

    // (2) identity: each of the three ids, mutated at the CALLER, is refused.
    for (const field of ['world_id', 'agent_id', 'execution_id']) {
      const mutatedContract = Object.freeze({ ...contract, [field]: `mutated-${field}` })
      const verdict = checkWindowBinding({ contract: mutatedContract, window: baseWindow, events: [call, result] })
      assert.equal(verdict?.reason, 'IDENTITY_MISMATCH', `a caller-mutated ${field} is IDENTITY_MISMATCH, never a pass`)
      assert.match(verdict.detail, new RegExp(`mutated-${field}`, 'u'), 'the refusal names the id it compared')
      console.log(`M7B1-IDENTITY-MISMATCH field=${field} reason=${verdict.reason} detail=${clip(verdict.detail, 160)}`)
    }

    // (3) trace: the id must be an execution the host's durable trace carried.
    const absent = checkWindowBinding({ contract, window: baseWindow, events: [{ event_seq: 1, event_type: 'tool/call', execution_id: 'some-other-call' }] })
    assert.equal(absent?.reason, 'EXECUTION_ID_NOT_IN_TRACE', 'an id no tool event carried is not an observed execution')
    assert.match(absent.detail, /some-other-call/u, 'the refusal names the ids the trace did carry')
    console.log(`M7B1-EXECUTION-ID-NOT-IN-TRACE reason=${absent.reason} detail=${clip(absent.detail, 160)}`)
  })

  await t.test('M7-B1b: both halves of the provenance seal are live (row seal, window seal, and a second module instance)', async () => {
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    const { createFsWitness, observationWindowOf, closeObservationWindow: closeInstrument, isSealedObservationWindow, areSealedWitnessObservations } =
      await import('../../packages/testkit/src/effect-witness.ts')
    const instrument = createFsWitness({
      root: home,
      watch: [watched],
      window: { world_id: contract.world_id, agent_id: contract.agent_id, execution_id: contract.execution_id, phase: 'pre' },
    })
    const pre = observationWindowOf(instrument)
    assert.equal(isSealedObservationWindow(pre), true, 'the armed record is sealed by the module that built it')
    const rows = await instrument.observe()
    const post = closeInstrument(instrument)
    assert.equal(isSealedObservationWindow(post), true, 'the closed record is sealed too')
    assert.equal(isSealedObservationWindow({ ...post }), false, 'a spread copy of the record is NOT sealed')
    assert.equal(isSealedObservationWindow(Object.create(post)), false, 'an Object.create child is NOT sealed')
    assert.equal(isSealedObservationWindow(structuredClone(post)), false, 'a structuredClone is NOT sealed')
    assert.equal(isSealedObservationWindow(JSON.parse(JSON.stringify(post))), false, 'a JSON round-trip is NOT sealed')
    assert.equal(areSealedWitnessObservations([...rows]), true, 'the rows are sealed')
    assert.equal(areSealedWitnessObservations(rows.map((row) => ({ ...row }))), false, 'copied rows are NOT sealed')
    // A SECOND module instance has its own private registries: its record is not
    // this instance's provenance, which is why the seal is identity and not shape.
    const second = await import('../../packages/testkit/src/effect-witness.ts?m7b1-second-instance')
    const secondInstrument = second.createFsWitness({
      root: home,
      watch: [watched],
      window: { world_id: contract.world_id, agent_id: contract.agent_id, execution_id: contract.execution_id, phase: 'pre' },
    })
    const secondWindow = second.observationWindowOf(secondInstrument)
    assert.equal(second.isSealedObservationWindow(secondWindow), true, 'the other instance seals its own record')
    assert.equal(isSealedObservationWindow(secondWindow), false, 'but THIS instance does not accept it')
    // And the row half through the ORACLE, without a host: a hand-built row with
    // the right shape and the right window id is still an INSTRUMENT_ERROR.
    // (The oracle imports `./effect-witness.js`, so the repo's TS resolution hook
    // must be registered before it is loaded outside the module's own path.)
    register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
    const { judgeContract } = await import('../../packages/testkit/src/contract-oracle.ts')
    const forgedRow = {
      domain: 'filesystem',
      observed: false,
      instrumented: true,
      evidence: ['forged: right shape, right window id'],
      watchedPaths: [...contract.scope],
      observedPaths: [],
      window_id: post.window_id,
    }
    const oracleVerdict = judgeContract({
      contractId: contract.contract_id,
      events: [{ event_seq: 1, event_type: 'tool/call', execution_id: contract.execution_id, outcome: 'DISPATCHED' }],
      witness: [forgedRow],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [...contract.scope],
      witnessProvenance: 'witnessed',
      requiredObservationWindowId: post.window_id,
      requiredExecutionId: contract.execution_id,
      expectDeny: false,
    })
    assert.equal(oracleVerdict.verdict, 'INSTRUMENT_ERROR', 'a hand-built row is INSTRUMENT_ERROR')
    assert.match(oracleVerdict.reasons.join('\n'), /not produced by a testkit witness instrument/u, 'the row seal is what refuses it')
    console.log('M7B1-ROW-SEAL verdict=INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED (oracle, witnessed mode)')
  })

  await t.test('M7-B1b: a caller-assembled envelope is refused before any instrument is trusted', async () => {
    const contract = declareObservationContract({ world, ...identity, scope: [watched] })
    const fabricated = { ok: true, witness: null, window: { window_id: 'win-forged', world_id: contract.world_id, agent_id: contract.agent_id, execution_id: contract.execution_id, phase: 'post', closedAt: '2026-11-18T00:00:00.000Z' } }
    const closedAttempt = await closeObservationWindow({ opened: fabricated })
    assert.equal(closedAttempt.ok, false, 'a caller-assembled `opened` is not an armed window')
    assert.equal(closedAttempt.reason, 'WITNESS_NOT_ARMED')
    const judged = await judgeObservationWindow({ contract, opened: fabricated, closed: Object.freeze({ ok: true, window: fabricated.window, rows: [] }), events: [] })
    assert.equal(judged.verdict, 'INSTRUMENT_ERROR', 'a caller-assembled envelope is never SATISFIED')
    assert.equal(judged.reason, 'WITNESS_NOT_SEALED')
    console.log(`M7B1-FORGED-ENVELOPE ok=false reason=${judged.reason}`)
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
    const contract = declareObservationContract({ world: probeWorld(home), agentId: 'a', executionId: 'e', scope: [watched] })
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
    // `expectDeny` is OFF unless an arm explicitly grades a REFUSED call: the
    // graded execution in all three arms is turn 2, which the Host completes.
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
    report = { world: world.id, port: run.port, bootMs, arms: [], mutations: [], hostSha: TEST_USE_BASELINE_SHA, hostTree: HOST_TREE }

    const openSession = async (label) => {
      const cookie = await authenticate(run.origin, run.token)
      const created = await apiSessionCreate(run.origin, cookie, run.workspaceDir, label)
      const sessionId = created.body?.result?.value?.sessionId
      assert.equal(typeof sessionId, 'string', `session/create must return a session id: ${JSON.stringify(created.body)?.slice(0, 300)}`)
      return { ...run, cookie, sessionId }
    }

    let foreignWindowRows = null
    const envelopes = []
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

      // NO BLANKET DENY CONTRACT (F-08, 2026-11-19). `expectDeny: true` used to be
      // hardcoded for every arm, and it was only ever satisfied by STEP 1's denial
      // of a DIFFERENT call (the refused escape) — the graded call here is turn 2
      // and it COMPLETED. That is the F-08 defect exactly: a denial belonging to
      // another call manufacturing a pass for this one. Now that the oracle pins
      // the graded execution, an arm must DECLARE a deny contract, and these three
      // do not have one: they grade the effect boundary (inside / outside /
      // same-directory). The refusal they depend on is asserted where it is
      // observable — the A4 block below pins outcome=DENIED,
      // error_code=FS_SANDBOX_DENIED and "no bytes on disk" verbatim — so nothing
      // about the refusal becomes unverified by dropping a claim that was false.
      const judgement = await judgeObservationWindow({ contract, opened, closed, events, expectDeny: arm.expectDeny === true })
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
      envelopes[index] = { opened, closed }
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
    const firstOpened = envelopes[0].opened
    const firstClosed = envelopes[0].closed
    const forged = {
      domain: 'filesystem',
      observed: false,
      instrumented: true,
      evidence: ['forged by the suite: the right shape and the right window id'],
      watchedPaths: [...firstContract.scope],
      observedPaths: [],
      window_id: firstWindow.window_id,
    }
    // The ENVELOPES here are the REAL ones this module produced; only the row is
    // hand-built. So the seal that must fail is the ROW seal, which is what A5 is.
    const forgedJudgement = await judgeObservationWindow({
      contract: firstContract,
      opened: firstOpened,
      closed: Object.freeze({ ok: true, window: firstWindow, rows: [forged] }),
      events: report.arms[0].trace,
      expectDeny: true,
    })
    assert.equal(forgedJudgement.verdict, 'INSTRUMENT_ERROR', 'A5: a hand-built row cannot corroborate a verdict')
    assert.equal(forgedJudgement.reason, 'WITNESS_NOT_SEALED', 'A5: the seal, not the shape, is what refuses it')
    assert.match(forgedJudgement.reasons.join('\n'), /WITNESS_NOT_SEALED/u)
    // The ROW half of the seal is proven directly (the envelope check fires first
    // here): the oracle refuses a hand-built row in `witnessed` mode, and test 1
    // pins that same predicate without a host.
    assert.ok(forgedJudgement.detail.length > 0, 'A5: the refusal names what could not be sealed')
    t.diagnostic('M7B1-FORGED verdict=INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED')
    report.mutations.push('M7B1-FORGED verdict=INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED')

    // ── A6: REAL envelopes from ANOTHER window are refused. The rows and the
    // window are the SECOND arm's (genuinely sealed, genuinely windowed); the
    // contract is the FIRST arm's. Same host, same World, same module — only the
    // identity/window differs, which is exactly the substitution a caller could
    // attempt ("these rows are mine, this window is the one I am grading").
    const secondEnvelopes = envelopes[1]
    assert.notEqual(secondEnvelopes.closed.window.window_id, firstWindow.window_id, 'A6: the two windows are genuinely different')
    const foreignJudgement = await judgeObservationWindow({
      contract: firstContract,
      opened: secondEnvelopes.opened,
      closed: secondEnvelopes.closed,
      events: report.arms[0].trace,
      expectDeny: true,
    })
    assert.equal(foreignJudgement.verdict, 'INSTRUMENT_ERROR', 'A6: another window cannot answer for this contract')
    assert.match(foreignJudgement.reasons.join('\n'), /IDENTITY_MISMATCH/u, 'A6: the refusal names the identity binding')
    t.diagnostic(`M7B1-FOREIGN-WINDOW verdict=${foreignJudgement.verdict} reason=${foreignJudgement.reason} detail=${clip(foreignJudgement.detail, 160)}`)
    report.mutations.push(`M7B1-FOREIGN-WINDOW verdict=${foreignJudgement.verdict} reason=${foreignJudgement.reason}`)

    // ── A7: a CALLER-MUTATED identity is refused BY THE MODULE, not by the test.
    // These are the reviewer's mutations: a real contract with one field rewritten,
    // judged through the real sealed window. The window's own binding is the thing
    // that catches it, and the trace binding catches an id the host never issued.
    const traceEvents = report.arms[0].trace
    const idCases = [
      ['execution_id', 'exec-mutated-by-the-caller', 'IDENTITY_MISMATCH'],
      ['agent_id', 'agent-mutated-by-the-caller', 'IDENTITY_MISMATCH'],
      ['world_id', 'world-mutated-by-the-caller', 'IDENTITY_MISMATCH'],
    ]
    for (const [field, value, expected] of idCases) {
      const mutated = Object.freeze({ ...firstContract, [field]: value })
      const judgement = await judgeObservationWindow({ contract: mutated, opened: firstOpened, closed: firstClosed, events: traceEvents, expectDeny: true })
      assert.equal(judgement.verdict, 'INSTRUMENT_ERROR', `A7: a mutated ${field} is never SATISFIED`)
      assert.equal(judgement.reason, expected, `A7: a mutated ${field} is refused as ${expected} (got ${String(judgement.reason)})`)
      const line = `M7B1-MUTATED-${field.toUpperCase()} verdict=${judgement.verdict} reason=${judgement.reason} detail=${clip(judgement.detail, 200)}`
      t.diagnostic(line)
      report.mutations.push(line)
    }
    // The trace must CARRY the graded execution id: strip the calls and the
    // verdict becomes a named refusal instead of "no effect observed".
    const strippedEvents = traceEvents.filter((event) => event.event_type !== 'tool/call' && event.event_type !== 'tool/result')
    const noTrace = await judgeObservationWindow({ contract: firstContract, opened: firstOpened, closed: firstClosed, events: strippedEvents, expectDeny: true })
    assert.equal(noTrace.verdict, 'INSTRUMENT_ERROR', 'A7: a trace with no tool event is not evidence')
    assert.equal(noTrace.reason, 'EXECUTION_ID_NOT_IN_TRACE', `A7: the refusal names the trace binding (got ${String(noTrace.reason)})`)
    t.diagnostic(`M7B1-NO-TRACE verdict=${noTrace.verdict} reason=${noTrace.reason} detail=${clip(noTrace.detail, 200)}`)
    report.mutations.push(`M7B1-NO-TRACE verdict=${noTrace.verdict} reason=${noTrace.reason}`)

    // ── A8: the WINDOW half of the seal is live. Every one of these is a SHAPE
    // that used to pass: a spread copy of the record, a copy of the envelope, a
    // JSON round-trip, and a different instrument closing the window.
    const windowCopies = [
      ['spread-window', { ...firstWindow }],
      ['structuredClone-window', structuredClone(firstWindow)],
      ['object-create-window', Object.create(firstWindow)],
    ]
    for (const [tag, windowCopy] of windowCopies) {
      const judgement = await judgeObservationWindow({
        contract: firstContract,
        opened: firstOpened,
        closed: Object.freeze({ ok: true, window: windowCopy, rows: firstClosed.rows }),
        events: traceEvents,
        expectDeny: true,
      })
      assert.equal(judgement.verdict, 'INSTRUMENT_ERROR', `A8 ${tag}: a copied window record is not provenance`)
      assert.equal(judgement.reason, 'WITNESS_NOT_SEALED', `A8 ${tag}: refused as WITNESS_NOT_SEALED (got ${String(judgement.reason)})`)
      const line = `M7B1-${tag.toUpperCase()} verdict=${judgement.verdict} reason=${judgement.reason}`
      t.diagnostic(line)
      report.mutations.push(line)
    }
    // A copied ENVELOPE (all fields present, wrong identity) is refused too.
    const spreadEnvelope = await judgeObservationWindow({
      contract: firstContract,
      opened: Object.freeze({ ...firstOpened }),
      closed: firstClosed,
      events: traceEvents,
      expectDeny: true,
    })
    assert.equal(spreadEnvelope.verdict, 'INSTRUMENT_ERROR', 'A8: a copied opened envelope is not an armed window')
    assert.equal(spreadEnvelope.reason, 'WITNESS_NOT_SEALED')
    t.diagnostic(`M7B1-SPREAD-ENVELOPE verdict=${spreadEnvelope.verdict} reason=${spreadEnvelope.reason}`)
    report.mutations.push(`M7B1-SPREAD-ENVELOPE verdict=${spreadEnvelope.verdict} reason=${spreadEnvelope.reason}`)
    // A foreign instrument cannot close a window this module armed.
    const foreignClose = await closeObservationWindow({ opened: firstOpened, witness: { observe: async () => firstClosed.rows } })
    assert.equal(foreignClose.ok, false, 'A8: a foreign instrument cannot close this window')
    assert.equal(foreignClose.reason, 'WITNESS_NOT_SEALED')
    t.diagnostic(`M7B1-FOREIGN-CLOSE ok=false reason=${foreignClose.reason}`)
    report.mutations.push(`M7B1-FOREIGN-CLOSE ok=false reason=${foreignClose.reason}`)
    // ... and an already-closed window cannot be closed twice into a second verdict.
    const reClose = await closeObservationWindow({ opened: firstOpened })
    assert.equal(reClose.ok, false, 'A8: one instrument, one window: a closed window cannot be closed again')
    assert.equal(reClose.reason, 'WITNESS_NOT_SEALED')
    t.diagnostic(`M7B1-RECLOSE ok=false reason=${reClose.reason}`)
    report.mutations.push(`M7B1-RECLOSE ok=false reason=${reClose.reason}`)

    // ── A9: LIFECYCLE. Judging the armed-but-unclosed window (the `opened`
    // envelope in place of a `closed` one) is never SATISFIED, and the phase/
    // closedAt rule itself is pinned by checkWindowBinding (test 1) so it holds
    // even for a record this module would never produce.
    const unclosed = await judgeObservationWindow({ contract: firstContract, opened: firstOpened, closed: firstOpened, events: traceEvents, expectDeny: true })
    assert.equal(unclosed.verdict, 'INSTRUMENT_ERROR', 'A9: an unclosed window can never be SATISFIED')
    t.diagnostic(`M7B1-UNCLOSED verdict=${unclosed.verdict} reason=${unclosed.reason}`)
    report.mutations.push(`M7B1-UNCLOSED verdict=${unclosed.verdict} reason=${unclosed.reason}`)
    const preRecord = checkWindowBinding({
      contract: firstContract,
      window: { ...firstWindow, phase: 'pre', closedAt: null },
      events: traceEvents,
    })
    assert.equal(preRecord.reason, 'WINDOW_NOT_CLOSED', 'A9: a pre record is refused as WINDOW_NOT_CLOSED')
    t.diagnostic(`M7B1-WINDOW-NOT-CLOSED reason=${preRecord.reason} detail=${clip(preRecord.detail, 160)}`)
    report.mutations.push(`M7B1-WINDOW-NOT-CLOSED reason=${preRecord.reason}`)

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
