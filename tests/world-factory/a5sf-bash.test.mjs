/**
 * a5sf-bash.test.mjs — BL-17 (P2-04) BACKEND arms: the shell-class admission on
 * the confined `subprocess` face, the write-only lane, the `chmod`/create
 * negatives, the network capability probe and the governed-realm PTY refusal.
 *
 * WHAT THIS PROVES (host-free): a `bash -c` invocation is admitted ONLY through
 * an explicit realm declaration + a declared invocation, every DECLARED root is
 * consulted against the compiled lane BEFORE any provider call, a write-only
 * lane cannot read, an out-of-lane `chmod`/create is refused with the same
 * typed axis denial, `network: deny` is refused because this host's provider
 * set does NOT enforce the network dimension, and a `terminals`-consuming
 * module is refused on a governed realm instead of inheriting the
 * legacy-generation PTY.
 *
 * WHAT THIS DOES NOT PROVE (needs a Host boot, not authorised this round): a
 * real persistent shell, PTY session semantics, a real outbound attempt, the
 * native `bash` tool reaching this face, and cross-generation PTY drain/kill.
 * See `dev/agent-workflow/evidence/a5sf-bash/README.md` for the one-shot
 * acceptance checklist of that half.
 *
 * Run: node --test tests/world-factory/a5sf-bash.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

import {
  BASH_IDENTITY,
  effectiveOf,
  fakeProvider,
  lane,
  loadBashSeams,
  makeBashWorld,
  makeFace,
  mountGovernedRealm,
  profileAccess,
  profileWouldRead,
  profileWouldWrite,
  refusalCode,
  runSpawn,
  shellSpec,
  snapshotFile,
  terminalsConsumerModule,
} from './lib/a5sf-bash-arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const seams = await loadBashSeams(REPO)
const network = await import(pathToFileURL(join(REPO, 'packages/runtime/sandbox-provider/network.ts')).href)

const world = makeBashWorld('arms')
after(() => world.cleanup())

const SHELL = Object.freeze({ programs: Object.freeze(['bash']) })
const inLaneRead = () => lane([world.inside])
const inLaneWrite = () => lane([world.inside])
const writeOnlyLane = () => lane([world.inside, world.writeOnly])

/** One face over an effective lane (facts collected on the same transport). */
function faceFor({ read = inLaneRead(), write = inLaneWrite(), network: networkAccess = 'allow', shellClass, provider = fakeProvider(), cwd = world.inside } = {}) {
  // `shellClass: undefined` = the DEFAULT declaration (SHELL); pass `null` to
  // build the no-declaration realm (a JS default parameter would swallow an
  // explicit `undefined`, which is exactly the control this arm needs).
  const admission = shellClass === undefined ? SHELL : shellClass
  const effective = effectiveOf(seams, { read, write, network: networkAccess })
  const made = makeFace(seams, { effective, shellClass: admission === null ? undefined : admission, provider })
  const profile = seams.compileExecutionProfile(effective)
  assert.equal(profile.ok, true, `the arm's lane must compile: ${JSON.stringify(profile)}`)
  return { ...made, profile: profile.value, provider, effective, cwd }
}

function declared({ reads, writes, chmod, program = 'bash' } = {}) {
  return {
    program,
    ...(reads === undefined ? {} : { reads }),
    ...(writes === undefined ? {} : { writes }),
    ...(chmod === undefined ? {} : { chmod }),
  }
}

// ---------------------------------------------------------------------------
// 1. The shell-class ADMISSION (explicit, not "not rg therefore pass")
// ---------------------------------------------------------------------------

test('ADMIT: a declared `bash -c` runs through the confined provider with one allow fact per declared root', async () => {
  const { face, facts, provider, profile } = faceFor()
  const result = await runSpawn(face, shellSpec({
    body: 'cat in-lane.txt',
    cwd: world.inside,
    shell: declared({ reads: [world.inside], writes: [world.inside] }),
  }))
  assert.equal(result.error, null, `an admitted shell must reach the provider: ${String(result.error)}`)
  assert.equal(provider.spawnCalls, 1)
  assert.deepEqual(provider.requests[0].argv, ['/bin/bash', '-c', 'cat in-lane.txt'])
  assert.equal(provider.requests[0].cwd, world.inside)
  // The compiled kernel profile is the lane (read+write bits on the same root).
  assert.equal(profileWouldRead(profile, join(world.inside, 'in-lane.txt')), true)
  assert.equal(profileWouldWrite(profile, join(world.inside, 'new.txt')), true)
  // One fact per declared root, on the axis it was declared for.
  assert.deepEqual(facts.map((fact) => [fact.method, fact.locator, fact.decision, fact.decidedBy]), [
    ['spawn', world.inside, 'allow', 'ALLOW'],
    ['spawn:write', world.inside, 'allow', 'ALLOW'],
  ])
})

test('NOT-DECLARED: a realm with no declared shell class refuses `bash` with a typed code, one deny fact and NO process', async () => {
  const { face, facts, provider } = faceFor({ shellClass: null })
  const result = await runSpawn(face, shellSpec({ cwd: world.inside, shell: declared({ reads: [world.inside] }) }))
  assert.equal(refusalCode(result.error), 'SUBPROCESS_SHELL_NOT_DECLARED')
  assert.match(String(result.error.message), /declares no shell class/)
  assert.equal(provider.spawnCalls, 0)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
  assert.equal(facts[0].locator, '/bin/bash')
})

test('PROGRAM-NOT-ADMITTED: a shell program outside the declared class is refused', async () => {
  const { face, provider } = faceFor({ shellClass: Object.freeze({ programs: Object.freeze(['bash']) }) })
  const result = await runSpawn(face, shellSpec({
    program: '/bin/dash',
    cwd: world.inside,
    shell: declared({ program: 'dash', reads: [world.inside] }),
  }))
  assert.equal(refusalCode(result.error), 'SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED')
  assert.match(String(result.error.message), /declared shell class \(bash\)/)
  assert.equal(provider.spawnCalls, 0)
})

test('INVOCATION-UNDECLARED: an admitted program with no declared invocation is refused (no unattributable root set)', async () => {
  const { face, provider } = faceFor()
  const result = await runSpawn(face, shellSpec({ cwd: world.inside }))
  assert.equal(refusalCode(result.error), 'SUBPROCESS_SHELL_INVOCATION_UNDECLARED')
  assert.match(String(result.error.message), /no declared invocation/)
  assert.equal(provider.spawnCalls, 0)
})

test('ARGV-SHAPE: only `<program> -c <body>` is admitted (`-lc` and extra operands are refused)', async () => {
  const { face, provider } = faceFor()
  const result = await runSpawn(face, {
    ...shellSpec({ cwd: world.inside, shell: declared({ reads: [world.inside] }) }),
    argv: ['/bin/bash', '-lc', 'true'],
  })
  assert.equal(refusalCode(result.error), 'SUBPROCESS_SHELL_ARGV_UNSUPPORTED')
  assert.equal(provider.spawnCalls, 0)
})

test('RG-UNCHANGED: declaring a shell class does not weaken rg\'s admission (no --no-config is still refused; unknown programs too)', async () => {
  const rg = faceFor()
  const rgResult = await runSpawn(rg.face, {
    ...shellSpec({ cwd: world.inside }),
    argv: ['/rg', '--json', '--', world.inside],
  })
  assert.equal(refusalCode(rgResult.error), 'IO_READ_DENIED')
  assert.equal(rg.provider.spawnCalls, 0)
  assert.equal(rg.facts.length, 1)

  const unknown = faceFor()
  const unknownResult = await runSpawn(unknown.face, {
    ...shellSpec({ cwd: world.inside }),
    argv: ['/bin/cat', join(world.inside, 'in-lane.txt')],
  })
  assert.equal(refusalCode(unknownResult.error), 'IO_READ_DENIED')
  assert.equal(unknown.provider.spawnCalls, 0)
})

test('WRITABLE-PROGRAM: an admitted shell program the Member can WRITE is refused (name is not identity)', async () => {
  const writable = join(world.inside, 'bash')
  writeFileSync(writable, '#!/bin/sh\necho BL17-WRITABLE-SHELL-RAN\n', 'utf8')
  chmodSync(writable, 0o755)
  const { face, provider } = faceFor()
  const result = await runSpawn(face, shellSpec({
    program: writable,
    cwd: world.inside,
    shell: declared({ reads: [world.inside] }),
  }))
  assert.equal(refusalCode(result.error), 'IO_READ_DENIED')
  assert.match(String(result.error.message), /WRITE lane/)
  assert.equal(provider.spawnCalls, 0)
})

// ---------------------------------------------------------------------------
// 2. 只写不读 — a write-only lane cannot read, and the control would catch one
// ---------------------------------------------------------------------------

test('WRITE-ONLY-READ: a declared read of a write-only root is DENIED (fact + zero spawns + bytes unchanged)', async () => {
  const target = join(world.writeOnly, 'write-only.txt')
  const before = snapshotFile(target)
  const { face, facts, provider, profile } = faceFor({ write: writeOnlyLane() })
  const result = await runSpawn(face, shellSpec({
    body: 'cat write-only.txt',
    cwd: world.inside,
    shell: declared({ reads: [target] }),
  }))
  assert.equal(refusalCode(result.error), 'IO_READ_DENIED')
  assert.equal(provider.spawnCalls, 0)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
  assert.equal(facts[0].locator, target)
  // THE EFFECT: the kernel profile does not grant a read of that root either.
  assert.equal(profileWouldRead(profile, target), false)
  assert.deepEqual(snapshotFile(target), before)
})

test('WRITE-ONLY-WRITE: the SAME root is writable while unreadable — and the read witness is not vacuous', async () => {
  const { face, facts, provider, profile } = faceFor({ write: writeOnlyLane() })
  const target = join(world.writeOnly, 'created.txt')
  const result = await runSpawn(face, shellSpec({
    body: 'printf x > created.txt',
    cwd: world.inside,
    shell: declared({ writes: [target] }),
  }))
  assert.equal(result.error, null)
  assert.equal(provider.spawnCalls, 1)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].method, 'spawn:write')
  assert.equal(facts[0].decision, 'allow')
  const access = profileAccess(profile, target)
  assert.equal(access.readFile, false, 'a write-only lane must not carry the kernel read bit')
  assert.equal(access.writeFile, true)
  assert.equal(profileWouldRead(profile, target), false)
  assert.equal(profileWouldWrite(profile, target), true)

  // NEGATIVE CONTROL (sensitivity): the SAME witness, over a lane that DOES
  // grant read, reports a read. So "false" above is the lane, not a broken
  // checker that could never catch a read.
  const readable = faceFor({ read: lane([world.inside, world.writeOnly]), write: writeOnlyLane() })
  assert.equal(profileWouldRead(readable.profile, target), true)
})

test('WRITE-ONLY-WRITE-OUTSIDE: a declared write outside the write lane is IO_WRITE_DENIED (0 spawns)', async () => {
  const { face, facts, provider } = faceFor({ write: writeOnlyLane() })
  const result = await runSpawn(face, shellSpec({
    body: 'printf x > created.txt',
    cwd: world.outside,
    shell: declared({ writes: [join(world.outside, 'created.txt')] }),
  }))
  assert.equal(refusalCode(result.error), 'IO_WRITE_DENIED')
  assert.equal(provider.spawnCalls, 0)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].method, 'spawn:write')
  assert.equal(facts[0].decision, 'deny')
})

// ---------------------------------------------------------------------------
// 3. chmod / new-file negatives — same typed refusal, bytes and mode unchanged
// ---------------------------------------------------------------------------

test('CREATE-OUTSIDE: a shell declaring a create outside the write lane is refused and the file never appears', async () => {
  const target = join(world.outside, 'bl17-created.txt')
  const { face, facts, provider } = faceFor()
  const result = await runSpawn(face, shellSpec({
    body: 'printf x > bl17-created.txt',
    cwd: world.outside,
    shell: declared({ writes: [target] }),
  }))
  assert.equal(refusalCode(result.error), 'IO_WRITE_DENIED')
  assert.equal(provider.spawnCalls, 0)
  assert.equal(facts[0].decidedBy, 'IO_WRITE_DENIED')
  assert.equal(existsSync(target), false, 'a refused create must not reach the filesystem')
})

test('CHMOD-OUTSIDE: a shell declaring a mode change outside the write lane is refused; mode and bytes unchanged', async () => {
  const target = join(world.outside, 'secret.txt')
  const before = snapshotFile(target)
  const { face, facts, provider } = faceFor()
  const result = await runSpawn(face, shellSpec({
    body: 'chmod 600 secret.txt',
    cwd: world.outside,
    shell: declared({ chmod: [target] }),
  }))
  assert.equal(refusalCode(result.error), 'IO_WRITE_DENIED')
  assert.equal(provider.spawnCalls, 0)
  assert.equal(facts[0].method, 'spawn:write')
  assert.equal(facts[0].decidedBy, 'IO_WRITE_DENIED')
  assert.deepEqual(snapshotFile(target), before)
})

test('CREATE/CHMOD-INSIDE (control): the same declarations inside the write lane are admitted — the refusal is the lane, not the command', async () => {
  const create = await runSpawn(faceFor().face, shellSpec({
    body: 'printf x > new.txt',
    cwd: world.inside,
    shell: declared({ writes: [join(world.inside, 'new.txt')] }),
  }))
  assert.equal(create.error, null)

  const chmod = faceFor()
  const outcome = await runSpawn(chmod.face, shellSpec({
    body: 'chmod 600 in-lane.txt',
    cwd: world.inside,
    shell: declared({ chmod: [join(world.inside, 'in-lane.txt')] }),
  }))
  assert.equal(outcome.error, null)
  assert.equal(chmod.provider.spawnCalls, 1)
  assert.equal(chmod.facts[0].method, 'spawn:write')
})

// ---------------------------------------------------------------------------
// 4. 禁网 — the capability probe decides, never the claim
// ---------------------------------------------------------------------------

test('NETWORK-DENY-UNENFORCED: `network: deny` is refused with NETWORK_UNCONFINED_REALM and the probe recorded in the detail', async () => {
  const { face, provider } = faceFor({ network: 'deny' })
  const result = await runSpawn(face, shellSpec({ cwd: world.inside, shell: declared({ reads: [world.inside] }) }))
  assert.equal(refusalCode(result.error), 'NETWORK_UNCONFINED_REALM')
  const detail = String(result.error.message)
  assert.match(detail, /network-destination='unsupported'/)
  assert.match(detail, /network=deny/)
  assert.match(detail, /fake provider probe/)
  assert.equal(provider.spawnCalls, 0, 'a network-denied command must not reach the provider')
})

test('NETWORK-DENY-ENFORCED (hypothetical backend): only a PROVEN `enforced` row admits the spawn and the request carries the deny profile', async () => {
  const provider = fakeProvider({ network: 'enforced' })
  const { face } = faceFor({ network: 'deny', provider })
  const result = await runSpawn(face, shellSpec({ cwd: world.inside, shell: declared({ reads: [world.inside] }) }))
  assert.equal(result.error, null)
  assert.equal(provider.spawnCalls, 1)
  assert.equal(provider.requests[0].networkProfile, 'deny')
})

test('NETWORK-ALLOW: with the network axis allowed the request carries NO network profile (the face claims nothing it did not probe)', async () => {
  const { face, provider } = faceFor()
  const result = await runSpawn(face, shellSpec({ cwd: world.inside, shell: declared({ reads: [world.inside] }) }))
  assert.equal(result.error, null)
  assert.equal(provider.spawnCalls, 1)
  assert.equal('networkProfile' in provider.requests[0], false)
})

test('CAPABILITY-PROBE (real shipped gate): this host\'s provider set reports network-destination `unsupported` and refuses `deny` before any process', () => {
  const refused = network.evaluateNetworkRequirement('deny', 'realm-bl17-bash')
  assert.equal(refused.ok, false)
  assert.equal(refused.error.code, 'IO_POLICY_UNSUPPORTED')
  assert.match(String(refused.error.message), /no provider in this lane demonstrates full network deny/)
  const row = network.networkProbeRow(4, 'realm-bl17-bash')
  assert.equal(row.dimension, 'network-destination')
  assert.equal(row.level, 'unsupported')
  assert.match(String(row.note), /not a general no-network guarantee/)
})

// ---------------------------------------------------------------------------
// 5. 旧代 PTY 拒用 — the governed realm refuses the legacy PTY path
// ---------------------------------------------------------------------------

test('PTY-LEGACY-MOUNT: a `terminals`-consuming module is refused on a governed realm (typed, before any fiber, legacy PTY never consulted)', async () => {
  const mounted = await mountGovernedRealm(seams, { world, label: 'pty' })
  try {
    const before = mounted.BaseTerminals.calls
    let error = null
    try {
      await mounted.realm.mountNativeToolModules([{ module: terminalsConsumerModule() }], { scope: mounted.agentKey })
    } catch (caught) {
      error = caught
    }
    assert.notEqual(error, null, 'the legacy PTY mount must be refused')
    assert.equal(error.code, 'TERMINALS_LEGACY_PTY_REFUSED')
    const detail = String(error.detail ?? error.message)
    assert.match(detail, /legacy-generation/)
    assert.match(detail, /terminals/)
    assert.match(detail, /旧代 PTY/)
    // NEGATIVE CONTROLS: the inherited legacy PTY was never consulted, no
    // provider process was created, and the refused attach recorded nothing.
    assert.equal(mounted.BaseTerminals.calls, before)
    assert.equal(mounted.provider.spawnCalls, 0)
    assert.equal(mounted.realm.nativeAttachRecord, null)
    const tools = mounted.root.get('tools')
    assert.equal(tools.get('bash', mounted.agentKey), undefined)
  } finally {
    await mounted.realm.dispose()
  }
})

test('PTY-LEGACY-DEFERRED: a module that DEFERS `ctx.inject([\'terminals\'])` is refused by the same law', async () => {
  const mounted = await mountGovernedRealm(seams, { world, label: 'pty-deferred' })
  try {
    let error = null
    try {
      await mounted.realm.mountNativeToolModules([{ module: terminalsConsumerModule({ defer: true }) }], { scope: mounted.agentKey })
    } catch (caught) {
      error = caught
    }
    assert.notEqual(error, null, 'the deferred legacy PTY mount must be refused')
    assert.equal(error.code, 'TERMINALS_LEGACY_PTY_REFUSED')
    assert.match(String(error.detail ?? error.message), /deferred a `terminals` injection/)
    assert.equal(mounted.BaseTerminals.calls, 0)
    assert.equal(mounted.provider.spawnCalls, 0)
  } finally {
    await mounted.realm.dispose()
  }
})

test('PTY-FACE: the confined subprocess face itself owns no terminal (spawnTerminal is a typed refusal)', async () => {
  const { face } = faceFor()
  assert.equal(typeof face.spawnTerminal, 'function')
  let error = null
  try {
    await face.spawnTerminal({ argv: ['/bin/bash'], cwd: world.inside })
  } catch (caught) {
    error = caught
  }
  assert.equal(refusalCode(error), 'SUBPROCESS_TERMINAL_UNSUPPORTED')
  assert.match(String(error.message), /no terminal/i)
})

// ---------------------------------------------------------------------------
// 6. The composition point: where the admission is declared (and where not)
// ---------------------------------------------------------------------------

test('COMPOSITION: `shellClass` is supplied by the install spec (the composition), never by the Member policy', () => {
  // The declaration is a composition input: the effective lane has no field a
  // Member could use to widen it, and the install spec is where a composition
  // states it (the same place that pins the launcher and the provider).
  assert.equal('shellClass' in seams.services, false)
  const effective = effectiveOf(seams, { read: inLaneRead(), write: inLaneWrite() })
  assert.equal('shellClass' in effective, false)
  assert.equal(effective.memberIdentity, BASH_IDENTITY.memberInstanceId)
})
