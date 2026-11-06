/**
 * a5sf-pd14-sandbox-root.test.mjs — PD-14 (SANDBOX-ROOT): a Member session's
 * sandbox root resolved to the pinned host checkout instead of the World
 * workspace, so a Member's `bash` child was `--bind`-read-write on a shared
 * tree that is never deleted.
 *
 * WHAT THIS SUITE PINS (host-free; in-process Cordis roots + the PINNED
 * sandbox backend, no boot, no DSH_HOME, no `:3080`, no port lease):
 *
 *   P0  THE DEFECT PIN (env-gated). A World whose Team row declares no
 *       workspace, launched from the pinned host tree, resolves the Member's
 *       session cwd — and therefore the pinned sandbox policy's per-call
 *       `workspaceRoot` — to the HOST CHECKOUT. GREEN before the fix, RED
 *       after it; the gate skips it unless `A5SF_PD14_PIN=1` (the before/after
 *       logs live in `dev/agent-workflow/evidence/a5sf-pd14-fix/`).
 *   D1  THE FIX, by the provider's own answer: the fixture's binding law puts
 *       the Team's effective workspace (and the resolved sandbox root) at the
 *       World workspace, and NOT at the host checkout.
 *   D2  THE CHILD IS BOUND TO THE WORLD WORKSPACE, by observation: a real
 *       child spawned through the pinned backend under that policy reports
 *       `pwd` = the World workspace, carries a READ-WRITE mount at the World
 *       workspace in its own `/proc/self/mountinfo`, carries NO mount at (or
 *       under) the pinned host checkout, and the argv the backend built names
 *       `--bind <world workspace> <world workspace>`. Nothing here writes to
 *       the pinned tree.
 *   D3  THE WRITE BOUNDARY IS THE WORLD WORKSPACE, by observation: inside the
 *       same child a write under the World workspace SUCCEEDS and a write to a
 *       sibling directory outside it is refused by the OS (`Read-only file
 *       system`), leaving the sibling clean. The decoy is a World-owned temp
 *       dir, never the pinned tree.
 *   F1  DISCLOSURE — the host checkout is still READABLE from the child (the
 *       profile is `--ro-bind / /`): the boundary this row moves is the WRITE
 *       boundary, not a read restriction. Pinned so the claim cannot be
 *       overstated.
 *   C1  NEGATIVE CONTROL (product side): a `sandbox-policy` row that DOES
 *       configure a workspace root still wins where it should — for a call
 *       without a session cwd — and a session cwd still outranks it, exactly
 *       as the pinned resolver documents. The fix hard-codes no path.
 *   C2  NEGATIVE CONTROL (fixture side): a World that DECLARES its own Team
 *       workspace keeps it (the law is a default, not an override), and the
 *       resolved root follows the declaration.
 *   C3  CONTROL — a World that declares the pinned host checkout as its Team
 *       workspace is REFUSED at fixture construction
 *       (`TEAM_WORKSPACE_ON_HOST_TREE`): the defect cannot be re-created by a
 *       World that means well.
 *   C4  CONTROL — a declared workspace outside the World's owned home is
 *       REFUSED (`TEAM_WORKSPACE_OUTSIDE_WORLD`): nothing outside the home is
 *       deleted at teardown, so it cannot be a Member's writable root.
 *   S1  SURFACE NEUTRAL: non-Team rows pass through untouched, the input rows
 *       are not mutated, and the emitted patch layer keeps every other row.
 *
 * Run: node --test tests/world-factory/a5sf-pd14-sandbox-root.test.mjs
 * Pin:  A5SF_PD14_PIN=1 node --test tests/world-factory/a5sf-pd14-sandbox-root.test.mjs
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { testUseTree } from '../paths.mjs'
import { emitPatchLayer } from './lib/world-factory.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const HOST_TREE = testUseTree(REPO_ROOT)
/** The pinned runtime tree is gitignored and per-checkout: a worktree that
 *  never received its clone still resolves the PATH (which is what the arms
 *  assert on), but the two arms that need to READ it skip with a reason. */
const HOST_TREE_EXISTS = existsSync(join(HOST_TREE, 'package.json'))
const PIN = process.env.A5SF_PD14_PIN === '1'

/**
 * THE PIN'S PRE/POST SWITCH. On the PRE-FIX tree this module does not exist,
 * so the fixture law cannot be applied and the pre-fix shape stands; on the
 * fixed tree it exists and is applied exactly as `TestWorld.startHost` applies
 * it. That is the whole mechanism by which P0 is green before and red after —
 * the arm asserts the *resolution*, never an import.
 */
const fixtureLaw = await (async () => {
  try {
    return await import('./lib/team-workspace.mjs')
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return null
    throw error
  }
})()

/** The shipped host entry's own default-workspace derivation (dist face). */
const hostEntry = await import(
  pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href
)
const { withDefaultWorkspace } = hostEntry

// --- the PINNED product, exactly as the Host composes it --------------------

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const sandboxPolicyModule = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-sandbox-policy')).href)
const sandboxLocalModule = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-sandbox-local')).href)
const SandboxPolicyService = sandboxPolicyModule.SandboxPolicyService ?? sandboxPolicyModule.default

/**
 * The one service `SandboxPolicyService` injects. Only `register` and
 * `stateOf` are reachable from `resolve()` (no `sandbox/mode` event is ever
 * applied here), so a two-method stand-in is a faithful minimum — the thing
 * under test is the resolver's precedence, not the projection store.
 */
class SessionProjectionsStandIn extends Service {
  constructor(ctx) {
    super(ctx, 'sessionProjections')
  }

  register() {}

  stateOf() {
    return undefined
  }
}

/** Compose the pinned policy service with an optional explicit root. */
async function makeSandboxPolicy(config) {
  const root = new Context()
  await root.plugin(SessionProjectionsStandIn, {})
  await root.plugin(SandboxPolicyService, config)
  return root.get('sandboxPolicy')
}

/** Compose the pinned local sandbox backend (bwrap → Landlock → …). */
async function makeSandbox() {
  const root = new Context()
  await root.plugin(sandboxLocalModule.default ?? sandboxLocalModule, {})
  return root.get('sandbox')
}

const POLICY = await makeSandboxPolicy({ mode: 'workspace-write' })
const SANDBOX = await makeSandbox()

// --- World fixtures ---------------------------------------------------------

/** Homes are created under `tests/homes/` (gitignored, the documented home
 *  protocol) so the workspace sits on the same filesystem a real World uses —
 *  the pinned backend's `--bind` line is then the real one, not a tmpfs. */
const HOMES = join(REPO_ROOT, 'tests', 'homes')
mkdirSync(HOMES, { recursive: true })
const scratch = []
function tracked(dir) {
  scratch.push(dir)
  return dir
}
function makeWorld(label) {
  const home = tracked(mkdtempSync(join(HOMES, `a5sf-pd14-${label}-`)))
  const workspaceDir = join(home, 'workspace')
  mkdirSync(workspaceDir, { recursive: true })
  return { home, workspaceDir, hostTree: HOST_TREE }
}
after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

/** The Team row a World assembly composes (the shape `isTeamRow` accepts). */
function teamRow(overrides = {}) {
  return {
    id: 'dsh-agent-team',
    name: 'dsh-agent-team/host',
    config: {
      rootSessionId: 'team-root',
      bootPhase: 'create',
      blueprintSource: 'schemaVersion: 3\nblueprintId: a5sf-pd14\n',
      seedMembers: [],
      ...overrides,
    },
  }
}

/**
 * The pre-fix shape: a World's rows, with the fixture law applied only when
 * the tree has it. This mirrors `TestWorld.startHost`'s one call site so the
 * arms measure the same chain a boot would.
 */
function worldRows(rows, world) {
  return fixtureLaw === null ? rows : fixtureLaw.bindTeamDefaultWorkspace(rows, world).rows
}

function teamRowOf(rows) {
  const row = rows.find((candidate) =>
    fixtureLaw === null
      ? candidate?.config !== undefined && candidate.config.rootSessionId === 'team-root'
      : fixtureLaw.isTeamRow(candidate))
  assert.ok(row !== undefined, 'the fixture produced no Team row')
  return row
}

/**
 * The chain a Member session's sandbox root travels, each link the shipped
 * product's own code:
 *   row config → `withDefaultWorkspace` (host.ts, launch dir fallback) →
 *   `meta.cwd` (agent-bindings §T12-M1: `request.workspace ?? defaultWorkspace`)
 *   → `session.header.cwd` → `sandboxPolicy.resolve()` (pinned resolver).
 */
function resolveMemberRoot(world, rows) {
  const config = teamRowOf(worldRows(rows, world)).config
  const teamConfig = withDefaultWorkspace(config, world.hostTree)
  const memberCwd = teamConfig.defaultWorkspace
  const session = { id: 'session-a5sf-pd14-member', header: { cwd: memberCwd } }
  return { teamConfig, memberCwd, session, policy: POLICY.resolve({ session }) }
}

/** Spawn a real child through the pinned backend under `policy`. */
async function runChild(policy, { cwd, script }) {
  const confined = await SANDBOX.confine(['/bin/bash', '-c', script], policy)
  const child = spawn(confined.argv[0], confined.argv.slice(1), {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' },
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.on('error', rejectExit)
    child.on('close', resolveExit)
  })
  return { exitCode, stdout, stderr, argv: confined.argv }
}

/** The mountinfo field layout: id parent major:minor root mountpoint options … */
function mountsOf(stdout) {
  return stdout.split('\n')
    .map((line) => line.trim().split(' '))
    .filter((fields) => fields.length >= 6 && /^\d+$/.test(fields[0]))
    .map((fields) => ({
      root: fields[3],
      mountPoint: fields[4],
      options: (fields[5] ?? '').split(','),
      raw: fields.join(' '),
    }))
}

function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`))
}

// --- P0: the defect pin -----------------------------------------------------

test('P0 PD-14 defect pin (PRE-FIX): a World with no Team workspace roots a Member at the pinned host checkout', { skip: PIN ? false : 'defect pin (set A5SF_PD14_PIN=1)' }, () => {
  const world = makeWorld('pin')
  const { memberCwd, policy } = resolveMemberRoot(world, [teamRow()])
  assert.equal(
    memberCwd,
    HOST_TREE,
    'PRE-FIX: the Team row declares no workspace, so the product falls back to the Host launch directory (the pinned checkout)',
  )
  assert.equal(
    policy.workspaceRoot,
    HOST_TREE,
    'PRE-FIX: the pinned sandbox policy takes the session cwd, so the Member\'s `bash` root IS the pinned checkout the World never deletes',
  )
  assert.notEqual(policy.workspaceRoot, world.workspaceDir, 'PRE-FIX: the World workspace is NOT where the child is confined')
})

// --- D1: the fixed resolution ----------------------------------------------

test('D1 fix: the Team\'s effective workspace and the resolved sandbox root are the World workspace, not the host checkout', () => {
  assert.notEqual(fixtureLaw, null, 'the fixture binding law must exist on the fixed tree')
  const world = makeWorld('fixed')
  const { teamConfig, memberCwd, policy } = resolveMemberRoot(world, [teamRow()])
  assert.equal(teamConfig.defaultWorkspace, world.workspaceDir, 'the World binds its own workspace into the Team row')
  assert.equal(memberCwd, world.workspaceDir, 'the Member session cwd is the World workspace')
  assert.equal(policy.workspaceRoot, world.workspaceDir, 'the pinned policy resolves the World workspace as the per-call root')
  assert.notEqual(policy.workspaceRoot, HOST_TREE, 'the pinned checkout is no longer a Member session\'s sandbox root')
  assert.equal(policy.mode, 'workspace-write', 'the mode is untouched by this fix')
  assert.equal(policy.sessionId, 'session-a5sf-pd14-member', 'the policy still names the calling session')
})

// --- D2/D3/F1: what the real child sees -------------------------------------

test('D2 observation: the Member\'s child is READ-WRITE bound at the World workspace and at no point of the host checkout', async () => {
  const world = makeWorld('child')
  const { policy } = resolveMemberRoot(world, [teamRow()])
  const run = await runChild(policy, {
    cwd: policy.workspaceRoot,
    script: 'pwd; cat /proc/self/mountinfo',
  })
  assert.equal(run.exitCode, 0, `the confined child must run (stderr: ${run.stderr.slice(0, 400)})`)
  const bindIndex = run.argv.indexOf('--bind')
  assert.ok(bindIndex >= 0, `the workspace-write profile must carry a \`--bind\` (argv: ${run.argv.join(' ')})`)
  assert.equal(run.argv[bindIndex + 1], world.workspaceDir, 'the bind SOURCE is the World workspace')
  assert.equal(run.argv[bindIndex + 2], world.workspaceDir, 'the bind DESTINATION is the World workspace')
  assert.ok(
    !run.argv.some((arg) => arg === HOST_TREE),
    `the pinned host checkout must not appear in the confinement argv (argv: ${run.argv.join(' ')})`,
  )

  const [pwdLine] = run.stdout.split('\n')
  assert.equal(pwdLine, world.workspaceDir, 'the child\'s own `pwd` is the World workspace')

  const mounts = mountsOf(run.stdout)
  assert.ok(mounts.length > 0, 'the child reported its mount table')
  const workspaceMounts = mounts.filter((mount) => mount.mountPoint === world.workspaceDir)
  assert.equal(workspaceMounts.length, 1, `exactly one mount at the World workspace (got ${JSON.stringify(workspaceMounts)})`)
  assert.ok(workspaceMounts[0].options.includes('rw'), `the World workspace mount is read-write (${workspaceMounts[0].raw})`)
  const hostMounts = mounts.filter((mount) => isInside(HOST_TREE, mount.mountPoint))
  assert.deepEqual(hostMounts, [], `no mount at or under the pinned host checkout (got ${JSON.stringify(hostMounts)})`)
})

test('D3 observation: inside the same child a write in the World workspace succeeds and a write outside it is refused by the OS', async () => {
  const world = makeWorld('write')
  const outside = tracked(mkdtempSync(join(HOMES, 'a5sf-pd14-outside-')))
  const { policy } = resolveMemberRoot(world, [teamRow()])
  const inRoot = join(world.workspaceDir, 'pd14-inside.txt')
  const outsideTarget = join(outside, 'pd14-outside.txt')
  const run = await runChild(policy, {
    cwd: policy.workspaceRoot,
    script: [
      `printf 'in-root' > ${JSON.stringify(inRoot)} && echo IN-ROOT-WRITTEN`,
      `printf 'outside' > ${JSON.stringify(outsideTarget)} 2>/dev/null && echo OUTSIDE-WRITTEN || echo OUTSIDE-REFUSED`,
      `test -e ${JSON.stringify(outsideTarget)} && echo OUTSIDE-DIRTY || echo OUTSIDE-CLEAN`,
    ].join('; '),
  })
  assert.equal(run.exitCode, 0, `the confined child must run (stderr: ${run.stderr.slice(0, 400)})`)
  assert.match(run.stdout, /IN-ROOT-WRITTEN/, 'the World workspace is genuinely writable')
  assert.match(run.stdout, /OUTSIDE-REFUSED/, 'a sibling outside the root is refused')
  assert.match(run.stdout, /OUTSIDE-CLEAN/, 'the refused write left no file behind')
  assert.equal(readFileSync(inRoot, 'utf8'), 'in-root', 'the in-root write is the child\'s own bytes')
  assert.ok(!readFileSync(join(REPO_ROOT, 'package.json'), 'utf8').includes('in-root'), 'sanity: the repo manifest was not involved')
})

test('F1 disclosure: the host checkout stays READABLE from the child — the boundary this row moves is the WRITE boundary', { skip: HOST_TREE_EXISTS ? false : `no pinned runtime tree at ${HOST_TREE} (gitignored per checkout)` }, async () => {
  const world = makeWorld('disclosure')
  const { policy } = resolveMemberRoot(world, [teamRow()])
  const probe = join(HOST_TREE, 'package.json')
  const run = await runChild(policy, {
    cwd: policy.workspaceRoot,
    script: `test -r ${JSON.stringify(probe)} && echo HOST-READABLE || echo HOST-UNREADABLE`,
  })
  assert.equal(run.exitCode, 0, `the confined child must run (stderr: ${run.stderr.slice(0, 400)})`)
  assert.match(
    run.stdout,
    /HOST-READABLE/,
    'the profile is `--ro-bind / /`: the pinned tree remains reachable READ-ONLY, and this row does not claim otherwise',
  )
})

// --- C1/C2: negative controls ----------------------------------------------

test('C1 negative control (product): a sandbox-policy row that DOES configure a root still wins where it should', async () => {
  const explicit = tracked(mkdtempSync(join(HOMES, 'a5sf-pd14-explicit-')))
  const configured = await makeSandboxPolicy({ mode: 'workspace-write', workspaceRoot: explicit })
  assert.equal(configured.resolve().workspaceRoot, explicit, 'an agentless call is confined to the CONFIGURED root — the fix hard-codes no path')
  const sessionRoot = join(explicit, 'session-root')
  mkdirSync(sessionRoot, { recursive: true })
  const withSession = configured.resolve({ session: { id: 's', header: { cwd: sessionRoot } } })
  assert.equal(withSession.workspaceRoot, sessionRoot, 'a session cwd outranks the configured root, exactly as the pinned resolver documents')
  assert.equal(configured.resolve().mode, 'workspace-write', 'the configured row keeps its mode')
  assert.notEqual(configured.resolve().workspaceRoot, sessionRoot, 'the configured root is the no-session answer, not a global override')
})

test('C2 negative control (fixture): a World that DECLARES its own Team workspace keeps it', () => {
  assert.notEqual(fixtureLaw, null, 'the fixture binding law must exist on the fixed tree')
  const world = makeWorld('declared')
  const declared = join(world.home, 'declared-workspace')
  mkdirSync(declared, { recursive: true })
  const { report } = fixtureLaw.bindTeamDefaultWorkspace([teamRow({ defaultWorkspace: declared })], world)
  assert.deepEqual(report.bound, [], 'a declared row is not re-bound')
  assert.deepEqual(report.declared, [{ id: 'dsh-agent-team', defaultWorkspace: declared }], 'the declaration is honoured and recorded')
  const { policy } = resolveMemberRoot(world, [teamRow({ defaultWorkspace: declared })])
  assert.equal(policy.workspaceRoot, declared, 'the resolved root follows the World\'s declaration, not this law')
  assert.notEqual(policy.workspaceRoot, world.workspaceDir, 'the law is a DEFAULT, not a hard-coded path')
})

// --- C3/C4: the law's refusals ---------------------------------------------

test('C3 control: a World declaring the pinned host checkout as its Team workspace is REFUSED', () => {
  assert.notEqual(fixtureLaw, null, 'the fixture binding law must exist on the fixed tree')
  const world = makeWorld('guard-host')
  assert.throws(
    () => fixtureLaw.bindTeamDefaultWorkspace([teamRow({ defaultWorkspace: HOST_TREE })], world),
    (error) => error?.code === fixtureLaw.TEAM_WORKSPACE_ERRORS.ON_HOST_TREE,
    'the defect cannot be re-created by a World that means well',
  )
  assert.throws(
    () => fixtureLaw.bindTeamDefaultWorkspace([teamRow({ defaultWorkspace: join(HOST_TREE, 'tests') })], world),
    (error) => error?.code === fixtureLaw.TEAM_WORKSPACE_ERRORS.ON_HOST_TREE,
    'a subdirectory of the pinned tree is refused too',
  )
})

test('C4 control: a declared workspace outside the World\'s owned home is REFUSED', () => {
  assert.notEqual(fixtureLaw, null, 'the fixture binding law must exist on the fixed tree')
  const world = makeWorld('guard-escape')
  const outside = tracked(mkdtempSync(join(HOMES, 'a5sf-pd14-escape-')))
  assert.throws(
    () => fixtureLaw.bindTeamDefaultWorkspace([teamRow({ defaultWorkspace: outside })], world),
    (error) => error?.code === fixtureLaw.TEAM_WORKSPACE_ERRORS.OUTSIDE_WORLD,
  )
  assert.throws(
    () => fixtureLaw.bindTeamDefaultWorkspace([teamRow({ defaultWorkspace: 'relative/ws' })], world),
    (error) => error?.code === fixtureLaw.TEAM_WORKSPACE_ERRORS.NOT_ABSOLUTE,
    'a relative value cannot be a machine-read workspace',
  )
})

// --- S1: surface neutrality -------------------------------------------------

test('S1 surface neutral: non-Team rows pass through untouched, the input is not mutated, and the patch layer keeps them', () => {
  assert.notEqual(fixtureLaw, null, 'the fixture binding law must exist on the fixed tree')
  const world = makeWorld('neutral')
  const rows = Object.freeze([
    teamRow(),
    Object.freeze({ id: 'u5-canary', name: './u5-canary-plugin.mjs' }),
    Object.freeze({ id: 'p6t6-observer', name: './observer.mjs', config: Object.freeze({ ledger: 'x' }) }),
  ])
  const teamBefore = JSON.stringify(rows[0])
  const { rows: bound, report } = fixtureLaw.bindTeamDefaultWorkspace(rows, world)
  assert.equal(JSON.stringify(rows[0]), teamBefore, 'the assembly\'s own row snapshot is not mutated')
  assert.equal(bound.length, rows.length, 'no row is added or removed')
  assert.deepEqual(bound.map((row) => row.id), rows.map((row) => row.id), 'row identity/order is preserved')
  assert.equal(report.bound.length, 1, 'exactly the Team row is bound')
  assert.equal(report.untouched, 2, 'the canary and the observer are untouched')
  const emitted = emitPatchLayer(['a5sf-pd14'], bound)
  assert.match(emitted, /id: "dsh-agent-team"/, 'the Team row survives emission')
  assert.match(emitted, /u5-canary/, 'the canary row survives emission')
  assert.match(emitted, /p6t6-observer/, 'the observer row survives emission')
  assert.ok(emitted.includes(`defaultWorkspace: "${world.workspaceDir}"`), `the emitted layer carries the World workspace (${emitted})`)
})

// --- S2: the law lives where every World passes -----------------------------

test('S2 locus: the World factory binds the Team workspace at its ONE row-composition point', () => {
  const source = readFileSync(join(HERE, 'lib', 'world-factory.mjs'), 'utf8')
  assert.match(source, /#teamWorkspaceRows\(rows\)/, 'startHost routes its rows through the binding')
  assert.match(source, /bindTeamDefaultWorkspace/, 'the binding is the shared law, not a local copy')
  const callSites = source.match(/#teamWorkspaceRows\(/g) ?? []
  assert.ok(callSites.length >= 3, `the method is defined AND called from both composition branches (saw ${callSites.length})`)
})

// --- sanity: the pinned tree is untouched -----------------------------------

test('Z1 the pinned host checkout is pristine after every arm', { skip: HOST_TREE_EXISTS ? false : `no pinned runtime tree at ${HOST_TREE} (gitignored per checkout)` }, () => {
  // PD-14's own hygiene receipt: every child above ran `printf`/`test` only,
  // and none of them targets the pinned tree — so its own porcelain must be
  // empty. A dirty tree here is a FINDING, not a flake (AGENTS.md red line).
  const result = spawnSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' })
  assert.equal(result.status, 0, `git status must answer (stderr: ${String(result.stderr).slice(0, 300)})`)
  assert.equal(result.stdout.trim(), '', 'the pinned host checkout must stay pristine across this suite')
})
