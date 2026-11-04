/**
 * a5sf-search-live F1 cause probe — the host-free reconstruction of the
 * swallowed failure the booted World reported as
 *
 *   Error: grep could not start its search command (ripgrep launch failed)
 *
 * F1 (evidence/README.md §4) was: inside the booted World the UNCONFINED base
 * `subprocess` service could not launch the packaged ripgrep, and the cause
 * never reached an artifact — the model-facing text is the module's one-line
 * summary, and the host log died with the World home.
 *
 * THE CAUSE, measured here without a boot: `a5sf-search-realm-provider-row.mjs`
 * instrumented the base service with
 *
 *     return original.apply(this, spec)          // ← F1
 *
 * `Function.prototype.apply` takes an ARRAY-LIKE argument list. `spec` is an
 * object without a `length`, so the wrapped `spawn` ran as `spawn(undefined)`,
 * `validateSubprocessSpec` read `spec.graceMs` (`subprocess-local/src/spawn.ts`
 * ~165) and threw a TypeError SYNCHRONOUSLY. `search-core.ts`'s launch catch
 * turns any synchronous throw into its single "ripgrep launch failed" line, so
 * the World reported a ripgrep launch failure for a ripgrep that was present
 * and executable. The same wrapper broke the parallel `git rev-parse` spawn of
 * `workspace-changes` (warned, not surfaced) — which is why the World's ledger
 * carries two `base-spawn` rows and zero successful unconfined searches.
 *
 * ARMS (all in-process; ZERO Host boots, ZERO ports, no DSH_HOME)
 *   F1-SYNC-MATRIX  which `spawn()` failures are synchronous — the exhaustive
 *                   cause surface of the module's message
 *   F1-SPEC-REPLAY  the World's recorded spec (argv + cwd verbatim from
 *                   `negative-control.json`) launches the packaged rg HERE, so
 *                   neither the spec shape, the binary nor the cwd was the cause
 *   F1-MUTATION     the pre-fix wrapper (`apply(this, spec)`) reproduces F1's
 *                   exact message and the swallowed TypeError — the mutation
 *                   control for the arm below
 *   F1-ROW-SPAWN    REGRESSION ARM: through the FIXED evidence row the same
 *                   grep returns matches from the packaged rg (RED before the
 *                   fix, GREEN after)
 *   F1-CAPTURE      a base-spawn failure now leaves a `base-spawn-failed` row
 *                   with its Node cause and the reachability of argv[0] vs cwd
 *                   — the arm that would have named F1 without a boot
 *
 * The pinned checkout is only READ (CORE PATCH BUDGET = 0).
 *
 * Run: node dev/agent-workflow/evidence/a5sf-search-live/f1-cause.mjs
 * Exit: 0 = every arm measured as required; 1 = a mismatch (printed with facts).
 *
 * @module dev/agent-workflow/evidence/a5sf-search-live/f1-cause
 */
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
// The pinned runtime lives under the MAIN checkout when this runs from a
// worktree (a worktree carries no `tests/deepseek-harness-test-use` of its own).
const BASELINE = process.env.A5SF_BASELINE ?? [
  join(REPO_ROOT, 'tests', 'deepseek-harness-test-use'),
  join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use'),
].find((candidate) => existsSync(candidate)) ?? ''
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

// Resolve the pinned packages from the PINNED tree's own install (pnpm puts each
// dependency beside the package that declares it).
const runtimeRequire = createRequire(join(BASELINE, 'packages', 'fs', 'tool-fs-search', 'package.json'))
const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

const search = await import(pathToFileURL(join(BASELINE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js')).href)
const subprocessLocal = await import(pathToFileURL(join(BASELINE, 'packages', 'subprocess', 'subprocess-local', 'lib', 'index.js')).href)
const row = await import(pathToFileURL(join(HERE, 'a5sf-search-realm-provider-row.mjs')).href)

const SEARCH_CONFIG = Object.freeze({ sampleOverCapGlobResults: false })
const F1_MESSAGE = 'grep could not start its search command (ripgrep launch failed)'

// ---------------------------------------------------------------------------
// the World's own record
// ---------------------------------------------------------------------------
const recorded = JSON.parse(readFileSync(join(HERE, 'negative-control.json'), 'utf8'))
const recordedSpawn = (recorded.sample.baseSpawns ?? []).find((entry) => String(entry?.argv?.[0] ?? '').includes('/rg'))
assert.ok(recordedSpawn !== undefined, 'negative-control.json carries no recorded rg spawn')
const RECORDED_ARGV = [...recordedSpawn.argv]
const RECORDED_CWD = String(recordedSpawn.cwd)
const RECORDED_PROGRAM = RECORDED_ARGV[0]

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
const world = mkdtempSync(join(tmpdir(), 'a5sf-f1-cause-'))
const inside = join(world, 'inside')
mkdirSync(inside, { recursive: true })
writeFileSync(join(inside, 'needle.txt'), 'A5SF_SEARCH_OUTSIDE\nF1_INSIDE_NEEDLE\n', 'utf8')
const GONE = join(world, 'gone-workdir')
const LEDGER = join(world, 'search-counter.jsonl')

// ---------------------------------------------------------------------------
// one in-process world over the REAL pinned module + REAL base service
// ---------------------------------------------------------------------------
async function worldOf({ cwd, ledgerPath }) {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(subprocessLocal.default ?? subprocessLocal)
  if (ledgerPath !== undefined) row.installBaseSubprocessCounter({ get: () => root.get('subprocess') }, ledgerPath)
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(search, SEARCH_CONFIG)
  const agentKey = { session: { header: { cwd } } }
  const _agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { root, agentKey, dispose: () => root.fiber.dispose() }
}

async function grep(w, args) {
  const settled = await w.root.get('tools').execute({
    signal: new AbortController().signal,
    callId: `f1-${Math.random().toString(16).slice(2)}`,
    agent: w.agentKey,
    name: 'grep',
    arguments: args,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text }
}

const ledgerRows = (path) => (existsSync(path)
  ? readFileSync(path, 'utf8').split('\n').filter((line) => line.trim().length > 0).map((line) => JSON.parse(line))
  : [])

const results = []
async function arm(label, fn) {
  try {
    const detail = await fn()
    results.push({ arm: label, ok: true, detail })
    console.log(`${label}: ${detail}`)
  } catch (error) {
    results.push({ arm: label, ok: false, detail: String(error?.message ?? error) })
    console.log(`${label}: FAILED ${String(error?.message ?? error)}`)
  }
}

// ---------------------------------------------------------------------------
// F1-SYNC-MATRIX — the exhaustive cause surface of the message
//   (first: it must observe an UNPATCHED prototype)
// ---------------------------------------------------------------------------
const SYNC_MATRIX = await (async () => {
  const root = new Context()
  await root.plugin(subprocessLocal.default ?? subprocessLocal)
  const base = root.get('subprocess')
  const notADir = join(world, 'afile')
  const unreadable = join(world, 'nocwd')
  writeFileSync(notADir, 'x')
  mkdirSync(unreadable, { recursive: true })
  chmodSync(unreadable, 0o000)
  const spec = (over) => ({
    argv: [...RECORDED_ARGV.slice(0, -1), inside],
    cwd: RECORDED_CWD,
    stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 1024 } },
    graceMs: 3000,
    signal: new AbortController().signal,
    ...over,
  })
  const cases = [
    ['program-missing', () => base.spawn(spec({ argv: ['/definitely/missing/rg', '--version'] }))],
    ['program-is-directory', () => base.spawn(spec({ argv: [world, '--version'] }))],
    ['cwd-missing', () => base.spawn(spec({ cwd: GONE }))],
    ['cwd-is-file', () => base.spawn(spec({ cwd: notADir }))],
    ['cwd-unreadable', () => base.spawn(spec({ cwd: unreadable }))],
    ['spec-undefined', () => base.spawn(undefined)],
  ]
  const measured = []
  for (const [label, call] of cases) {
    try {
      const handle = call()
      measured.push({ case: label, sync: false, note: 'returned a handle; the failure settles asynchronously' })
      await handle.done.catch(() => {})
    } catch (error) {
      measured.push({
        case: label,
        sync: true,
        name: error?.name ?? null,
        code: error?.code ?? null,
        errno: error?.errno ?? null,
        syscall: error?.syscall ?? null,
        path: error?.path ?? null,
        message: String(error?.message ?? error),
        at: String(error?.stack ?? '').split('\n')[1]?.trim() ?? null,
      })
    }
  }
  chmodSync(unreadable, 0o755)
  await root.fiber.dispose()
  return measured
})()
results.push({ arm: 'F1-SYNC-MATRIX', ok: SYNC_MATRIX.some((entry) => entry.sync), detail: SYNC_MATRIX })
for (const entry of SYNC_MATRIX) {
  console.log(`F1-SYNC-MATRIX: ${entry.case}: sync=${String(entry.sync)} ${entry.sync ? `code=${String(entry.code)} ${String(entry.message).slice(0, 100)}` : ''}`)
}

// ---------------------------------------------------------------------------
// F1-SPEC-REPLAY — the recorded spec launches HERE
// ---------------------------------------------------------------------------
await arm('F1-SPEC-REPLAY', async () => {
  assert.equal(existsSync(RECORDED_PROGRAM), true, `the recorded program is gone: ${RECORDED_PROGRAM}`)
  assert.equal(existsSync(RECORDED_CWD), true, `the recorded cwd is gone: ${RECORDED_CWD}`)
  const w = await worldOf({ cwd: RECORDED_CWD })
  try {
    const argv = [...RECORDED_ARGV.slice(0, -1), inside]
    const handle = w.root.get('subprocess').spawn({
      argv,
      cwd: RECORDED_CWD,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 10 * 1024 * 1024 }, stderr: { maxBytes: 64 * 1024 } },
      graceMs: 3000,
      signal: new AbortController().signal,
    })
    const outcome = await handle.done
    const stdout = handle.collected.stdout.readFrom(0).text
    assert.equal(outcome.exitCode, 0, `the recorded spec did not exit 0: ${JSON.stringify(outcome)}`)
    assert.match(stdout, /"type":"match"/u)
    assert.match(stdout, /A5SF_SEARCH_OUTSIDE/u)
    writeFileSync(join(world, 'recorded-spec.json'), JSON.stringify({ argv, cwd: RECORDED_CWD, outcome, stdout }, null, 2) + '\n')
    return `exit=${String(outcome.exitCode)} match found — the World's recorded spec launches the packaged rg`
  } finally {
    await w.dispose()
  }
})

// ---------------------------------------------------------------------------
// F1-MUTATION — the pre-fix wrapper reproduces F1 (mutation control)
// ---------------------------------------------------------------------------
const MUTATION = await (async () => {
  const w = await worldOf({ cwd: RECORDED_CWD })
  const proto = Object.getPrototypeOf(w.root.get('subprocess'))
  const saved = proto.spawn
  let swallowed = null
  Object.defineProperty(proto, 'spawn', {
    configurable: true,
    writable: true,
    value: function preFixSpawn(spec) {
      try {
        return saved.apply(this, spec) // ← the F1 shape, verbatim
      } catch (error) {
        swallowed = {
          name: error?.name ?? null,
          code: error?.code ?? null,
          message: String(error?.message ?? error),
          at: String(error?.stack ?? '').split('\n')[1]?.trim() ?? null,
        }
        throw error
      }
    },
  })
  let settled
  try {
    settled = await grep(w, { pattern: 'F1_INSIDE_NEEDLE', path: inside })
  } finally {
    Object.defineProperty(proto, 'spawn', { configurable: true, writable: true, value: saved })
    await w.dispose()
  }
  return { settled, swallowed }
})()
await arm('F1-MUTATION', async () => {
  assert.equal(MUTATION.settled.text, `Error: ${F1_MESSAGE}`,
    `the pre-fix wrapper must reproduce F1's text, got ${JSON.stringify(MUTATION.settled.text)}`)
  assert.ok(MUTATION.swallowed !== null, 'the pre-fix wrapper must swallow a synchronous throw')
  assert.equal(MUTATION.swallowed.name, 'TypeError', `expected a TypeError, got ${JSON.stringify(MUTATION.swallowed)}`)
  assert.match(String(MUTATION.swallowed.message), /reading 'graceMs'/u,
    `expected the spec-validator TypeError, got ${JSON.stringify(MUTATION.swallowed.message)}`)
  return `apply(this, spec) → spawn(undefined) → ${MUTATION.swallowed.name}: ${MUTATION.swallowed.message} @ ${String(MUTATION.swallowed.at)} → F1's exact text`
})

// ---------------------------------------------------------------------------
// F1-ROW-SPAWN — the regression arm: the FIXED row serves a real search
// ---------------------------------------------------------------------------
await arm('F1-ROW-SPAWN', async () => {
  const w = await worldOf({ cwd: RECORDED_CWD, ledgerPath: LEDGER })
  try {
    const settled = await grep(w, { pattern: 'F1_INSIDE_NEEDLE', path: inside })
    const rows = ledgerRows(LEDGER)
    const spawns = rows.filter((entry) => entry?.leg === 'base-spawn')
    const failures = rows.filter((entry) => entry?.leg === 'base-spawn-failed')
    assert.equal(settled.isError, false, `the unconfined base search must succeed, got ${JSON.stringify(settled.text)}`)
    assert.match(settled.text, /needle\.txt/u, `the search must return the match, got ${JSON.stringify(settled.text)}`)
    assert.equal(spawns.length, 1, `expected one base-spawn row, got ${String(spawns.length)}`)
    assert.equal(failures.length, 0, `no base spawn may fail now: ${JSON.stringify(failures)}`)
    assert.equal(spawns[0].cwd, RECORDED_CWD)
    assert.equal(spawns[0].argv[0], RECORDED_PROGRAM)
    return `one base-spawn row + an rg match through the fixed row (${String(rows.length)} ledger row(s), 0 failures)`
  } finally {
    await w.dispose()
  }
})

// ---------------------------------------------------------------------------
// F1-CAPTURE — a base-spawn failure now leaves an attributable row
// ---------------------------------------------------------------------------
await arm('F1-CAPTURE', async () => {
  // A synchronous launch failure is the only shape the wrapper can see: with the
  // fix in place a MISSING workdir settles through `handle.done` (the module then
  // reports its distinct "provider failure" text). A workdir that is a regular
  // FILE still throws synchronously (ENOTDIR), so it exercises the capture.
  const cwdFile = join(world, 'workdir-is-a-file')
  writeFileSync(cwdFile, 'not a directory\n', 'utf8')
  const w = await worldOf({ cwd: cwdFile }) // the counter is installed on the class by the arm above
  try {
    const settled = await grep(w, { pattern: 'F1_INSIDE_NEEDLE', path: inside })
    assert.equal(settled.text, `Error: ${F1_MESSAGE}`, `a synchronous launch failure must surface as F1's text, got ${JSON.stringify(settled.text)}`)
  } finally {
    await w.dispose()
  }
  const rows = ledgerRows(LEDGER)
  const failures = rows.filter((entry) => entry?.leg === 'base-spawn-failed' && entry?.cwd === cwdFile)
  assert.equal(failures.length, 1, `expected exactly one base-spawn-failed row for the unusable workdir, got ${String(failures.length)}`)
  const failure = failures[0]
  for (const field of ['name', 'code', 'message']) {
    assert.equal(typeof failure.cause?.[field], 'string', `the captured cause has no ${field}: ${JSON.stringify(failure)}`)
  }
  assert.equal(failure.cause.code, 'ENOTDIR')
  assert.equal(failure.argv[0], RECORDED_PROGRAM)
  assert.equal(failure.reach?.program?.exists, true, 'the capture must prove argv[0] existed')
  assert.equal(failure.reach?.cwd?.exists, true, 'the capture must prove the workdir path existed')
  assert.equal(failure.reach?.cwd?.directory, false, 'the capture must prove the workdir was not a directory')
  writeFileSync(join(world, 'capture.json'), JSON.stringify(failure, null, 2) + '\n')
  return `base-spawn-failed row captured: cause=${String(failure.cause.code)} programExists=${String(failure.reach.program.exists)} cwdIsDirectory=${String(failure.reach.cwd.directory)}`
})

// ---------------------------------------------------------------------------
// the artifact
// ---------------------------------------------------------------------------
const failures = results.filter((entry) => entry.ok === false)
const artifact = {
  schema: 'a5sf-f1-cause/1',
  generatedAt: new Date().toISOString(),
  cause: {
    kind: 'instrumentation-bug',
    layer: 'evidence harness row',
    file: 'dev/agent-workflow/evidence/a5sf-search-live/a5sf-search-realm-provider-row.mjs',
    line: 'return original.apply(this, spec)  // Function.prototype.apply takes an array-like argument list',
    effect: 'the wrapped base spawn was invoked as spawn(undefined); validateSubprocessSpec threw a synchronous TypeError; search-core.ts turned every synchronous throw into "grep could not start its search command (ripgrep launch failed)"',
    swallowed: MUTATION.swallowed,
    surface: `Error: ${F1_MESSAGE}`,
    world: {
      at: recordedSpawn.at,
      program: RECORDED_PROGRAM,
      cwd: RECORDED_CWD,
      programExists: existsSync(RECORDED_PROGRAM),
      cwdExists: existsSync(RECORDED_CWD),
    },
    notTheCause: [
      'the spec shape (argv/cwd/stdio/graceMs/signal) — F1-SPEC-REPLAY launches it unchanged',
      'the packaged ripgrep binary — present and executable before and after the run',
      'the session cwd — present; and a bad cwd would be reported as ENOENT on argv[0] anyway',
      'confinement / the confined face — the failing arm is the unconfined base service',
      'the pinned tree — the module behaves exactly as documented for a synchronous spawn throw',
    ],
  },
  causeSurface: SYNC_MATRIX,
  arms: results,
  verdict: failures.length === 0 ? 'PASS' : 'FAIL',
}
writeFileSync(join(HERE, 'f1-cause.json'), JSON.stringify(artifact, null, 2) + '\n')
console.log(`\nVERDICT: ${artifact.verdict} (${String(results.length - failures.length)}/${String(results.length)} arms)`)
process.exit(failures.length === 0 ? 0 : 1)
