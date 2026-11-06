/**
 * a5sf-pty-contract.test.mjs — the Shell-PTY capability face's LAYER B
 * acceptance: the NATIVE-TOOL CONTRACT of the persistent-shell surface, not the
 * permission lane.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`, NO real PTY.
 * Every arm is an in-process Cordis root over `mkdtemp` fixtures (when it needs
 * one) and drives a REAL module:
 *
 *   product registry   `packages/runtime/team-sandbox/src/terminal.ts` — the
 *                      P1-08 policy-bound lifecycle state machine, imported
 *                      through the repo's TS loader. Its `PtyHandle` port is the
 *                      seam the module itself injects; the arms pass a RECORDER.
 *   pinned host PTY    `@deepseek-ai/dsh-terminal`'s `TerminalSessionService`
 *                      (pinned baseline, `lib/`), over its OWN injected port
 *                      (`registerBackend`). The service is real; the backend is
 *                      the recorder, because a real PTY is NOT_REACHED here.
 *   product refusal    `mountA5sfRealm(...).mountNativeToolModules` with the
 *                      real pinned `tool-bash-persistent` module and a REAL
 *                      `TerminalSessionService` whose backend counts allocations.
 *
 * THE FIVE CONTRACT PROPERTIES (each arm asserts ORDER or IDENTITY, not mere
 * presence):
 *
 *   P1  allocation lifecycle — one allocate per session, one kill per terminal,
 *       no command accepted after kill; double-kill is idempotent, a command
 *       after kill is a TYPED refusal (the two are different answers, pinned).
 *       The per-command operation is a COMMAND GATE (`assertCurrent`: a command
 *       request is admitted or refused against the CURRENT policy revision),
 *       and the only descendant observation is the recorded handle's
 *       DESCENDANT AUDIT (`descendants()`). `PtyHandle` has no write or read
 *       channel, so no arm here measures bytes through the product registry;
 *       the `P1-HOST-*`/`P5-HOST-*` arms measure the pinned service's channel.
 *   P2  exit-status propagation — a non-zero exit, a signal death and a
 *       transport error must be distinguishable downstream. The pinned host
 *       service DOES distinguish them; the product registry collapses every
 *       process outcome into `killed: true` (a FINDING, reported not fixed).
 *   P3  orphan / reap — after kill no port handle is left open and no child is
 *       left unreaped: kill invoked once, the port's post-kill `descendants()`
 *       empty, the registry's map emptied. No fd/handle-count observable is
 *       reachable host-free (stated in the evidence README).
 *   P4  refusal path — `TERMINALS_LEGACY_PTY_REFUSED` and WHEN it fires
 *       relative to allocation. The DECLARED shape is refused before any port
 *       allocation (measured at a real backend counter). The DEFERRED shape is
 *       refused AFTER the module's own `apply` allocated a live legacy PTY — a
 *       FINDING with its own arm.
 *   P5  concurrency — two terminals under the same member must not cross command
 *       requests (nor, on the pinned host service, writes), killing one must not
 *       kill the other, and every fact must carry the right terminal identity.
 *       The fixtures make mis-attribution DETECTABLE (different pids, different
 *       backends, per-session sent text and scrollback).
 *
 * NOT DUPLICATING LAYER A: `a5sf-bash.test.mjs` already covers the admission's
 * existence, the lane, and the BL-17 tripwire ("the inherited service must not
 * be consulted"). No arm here concludes "the lane refused" and no arm re-pins
 * the tripwire: the ordering is measured against a REAL service that really
 * could allocate, and the `PtyHandle`/`TerminalBackend` ports are the seams the
 * shipped code injects.
 *
 * NOT PROVEN HERE: a real OS PTY, session leadership / process-group isolation,
 * PTY sandboxing, a live Host preset. A real PTY is `NOT_REACHED`; the evidence
 * README prints the one-shot command a boot would run.
 *
 * HOST-REQUIRED, three states: absent => `A5SF-PTY-CONTRACT-HOST-REFUSED` and
 * every case registered as SKIPPED (not-run, `pass 0`); present-but-partial =>
 * hard failure; present and complete => run.
 *
 * Run: node --test tests/world-factory/a5sf-pty-contract.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test, { after } from 'node:test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../paths.mjs'
import {
  LEGACY_PTY_REFUSAL,
  PTY_CONTRACT_IDENTITY,
  inertModule,
  makeHostTerminalWorld,
  makeRefusalWorld,
  makeRegistryHarness,
  persistentBashModule,
  ptyContractHostLayout,
  terminalsConsumerModule,
} from './lib/a5sf-pty-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(dirname(HERE))

const MEMBER = PTY_CONTRACT_IDENTITY.memberInstanceId

/** The exact downstream fields the registry's shutdown receipt exposes. */
const SHUTDOWN_ROW_KEYS = Object.freeze(['descendants', 'domainId', 'killed', 'memberInstanceId', 'pid', 'policyRevision'])

const CASES = [
  {
    title: 'P1-ONE-ALLOCATE-PER-SESSION: a repeated acquire reuses the live domain (1 port allocation), a second binding allocates its own',
    label: 'p1-allocate',
    kind: 'registry',
    run: armOneAllocatePerSession,
  },
  {
    title: 'P1-COMMAND-REQUEST-GATE-REFUSES-AFTER-KILL: assertCurrent after revoke is DOMAIN_REVOKED, the second revoke is an idempotent no-op, re-acquire allocates nothing',
    label: 'p1-after-kill',
    kind: 'registry',
    run: armCommandGateAfterKill,
  },
  {
    title: 'P1-REVOKE-WITHOUT-DOMAIN-IS-STICKY: revoking a member that owns no live shell records the generation, so a later acquire is refused (PD-1 FIXED)',
    label: 'p1-revoke-empty',
    kind: 'registry',
    run: armRevokeWithoutDomain,
  },
  {
    title: 'P1-HOST-SESSION-LIFECYCLE: spawn→send→read→kill→NO_SESSION, one backend spawn and one close, overlapping double-kill closes once',
    label: 'p1-host',
    kind: 'host',
    scenarios: ['running', 'running'],
    run: armHostSessionLifecycle,
  },
  {
    title: 'P2-REGISTRY-COLLAPSES-EXIT-OUTCOMES: a non-zero exit, a kill and a dead process group produce the SAME receipt (killed:true, no exit/signal field)',
    label: 'p2-collapse',
    kind: 'registry',
    run: armRegistryCollapsesExitOutcomes,
  },
  {
    title: 'P2-HOST-DISTINGUISHES-OUTCOMES: the pinned service reports exitCode 7 vs signal SIGTERM vs a thrown transport error — three different downstreams',
    label: 'p2-host',
    kind: 'host',
    scenarios: ['exit-7', 'killed', 'transport-error'],
    run: armHostDistinguishesOutcomes,
  },
  {
    title: 'P3-REGISTRY-REAP: every killed port is signalled once, reports no descendants after kill, and the registry retains no domain',
    label: 'p3-registry',
    kind: 'registry',
    run: armRegistryReap,
  },
  {
    title: 'P3-HOST-REAP: killing one session closes exactly that backend once; service disposal closes the rest once and then refuses new spawns',
    label: 'p3-host',
    kind: 'host',
    scenarios: ['running', 'running', 'running'],
    run: armHostReap,
  },
  {
    title: 'P4-REFUSED-BEFORE-ALLOCATION: the DECLARED terminals consumer is refused with zero backend allocations and its apply never runs',
    label: 'p4-declared',
    kind: 'refusal',
    run: armRefusedBeforeAllocation,
  },
  {
    title: 'P4-DEFERRED-REFUSAL-IS-POST-ALLOCATION: a module that DEFERS the injection allocates a live legacy PTY before the same refusal fires (FINDING)',
    label: 'p4-deferred',
    kind: 'refusal',
    run: armDeferredRefusalIsPostAllocation,
  },
  {
    title: 'P4-CONTROL-INERT-MODULE-MOUNTS: a module that consumes no PTY service mounts normally with zero allocations (the refusal is targeted)',
    label: 'p4-inert',
    kind: 'refusal',
    run: armInertModuleMounts,
  },
  {
    title: 'P5-TWO-BINDINGS-IDENTITY: two bindings of one member pair domainId↔binding↔pid↔backend correctly in list() and in the shutdown receipt',
    label: 'p5-identity',
    kind: 'registry',
    run: armTwoBindingsIdentity,
  },
  {
    title: 'P5-KILL-ONE-NOT-THE-OTHER: tightening the revision replaces ONE binding, the sibling PTY survives with commands refused; there is no per-domain kill',
    label: 'p5-kill-one',
    kind: 'registry',
    run: armKillOneNotTheOther,
  },
  {
    title: 'P5-STALE-DOMAIN-REPORTS-STALE: after the revision moves, list() reports the same refusal the command gate gives (stale), and the PTY stays live',
    label: 'p5-stale-report',
    kind: 'registry',
    run: armStaleDomainReportsStale,
  },
  {
    title: 'P5-HOST-TWO-SESSIONS-FENCED: writes land on the addressed session only, kill of one leaves the other operable, identity errors are typed',
    label: 'p5-host',
    kind: 'host',
    scenarios: ['running', 'running'],
    run: armHostTwoSessionsFenced,
  },
]

const HOST = ptyContractHostLayout(REPO_ROOT)
const HOST_PRESENT = existsSync(HOST.root)
const MISSING_ENTRIES = Object.entries(HOST.entries).filter(([, path]) => !existsSync(path))
const REQUIRE_HOST = process.env.A5SF_REQUIRE_PINNED_HOST === '1'
const REFUSAL_TOKEN = 'A5SF-PTY-CONTRACT-HOST-REFUSED'

const REFUSAL = [
  REFUSAL_TOKEN,
  'schema=a5sf-host-refusal/1',
  'refused=1',
  `skipped=${CASES.length}`,
  `cases=${CASES.length}`,
  'verdict=NOT_RUN',
  `pinned=${TEST_USE_BASELINE_SHA}`,
  `baseline=${DSH_BASELINE_VERSION}`,
  `path=${HOST.root}`,
  'reason=pinned-host-not-provisioned',
].join(' ')

if (!HOST_PRESENT) {
  if (REQUIRE_HOST) {
    throw new Error(
      `A5SF-PTY-CONTRACT-HOST-INCOMPLETE: A5SF_REQUIRE_PINNED_HOST=1 but the pinned host is absent at ${HOST.root} — ` +
      `provision tests/deepseek-harness-test-use at ${TEST_USE_BASELINE_SHA} (${DSH_BASELINE_VERSION}) and build it, ` +
      'or unset A5SF_REQUIRE_PINNED_HOST to accept the declared refusal',
    )
  }
  process.stdout.write(`${REFUSAL}\n`)
  for (const testCase of CASES) {
    test(`${testCase.title} — REFUSED (pinned host not provisioned)`, (t) => {
      t.skip(`A5SF host requirement: ${testCase.label} needs the pinned baseline's built lib/ entries. ${REFUSAL}`)
    })
  }
} else if (MISSING_ENTRIES.length > 0) {
  throw new Error(
    'A5SF-PTY-CONTRACT-HOST-INCOMPLETE: the pinned host tree exists at ' +
    `${HOST.root} but is missing ${MISSING_ENTRIES.map(([name, path]) => `${name}=${path}`).join(', ')} — ` +
    `a partial or older host is a pin violation (expected ${TEST_USE_BASELINE_SHA} / ${DSH_BASELINE_VERSION}, built)`,
  )
} else {
  const worlds = []
  after(async () => {
    for (const world of worlds) {
      try { await world.dispose() } catch { /* the arm's own teardown assertion owns failures */ }
    }
  })

  async function withRegistry(body) {
    const harness = await makeRegistryHarness({ repoRoot: REPO_ROOT })
    worlds.push(harness)
    try {
      await body(harness)
    } finally {
      worlds.splice(worlds.indexOf(harness), 1)
      await harness.dispose()
    }
  }

  async function withHost(scenarios, body) {
    const world = await makeHostTerminalWorld({ repoRoot: REPO_ROOT, label: 'host', scenarios })
    worlds.push(world)
    try {
      await body(world)
    } finally {
      worlds.splice(worlds.indexOf(world), 1)
      await world.dispose()
    }
  }

  async function withRefusal(body) {
    const world = await makeRefusalWorld({ repoRoot: REPO_ROOT, label: 'refusal' })
    worlds.push(world)
    try {
      await body(world)
    } finally {
      worlds.splice(worlds.indexOf(world), 1)
      await world.dispose()
    }
  }

  for (const testCase of CASES) {
    const run = testCase.kind === 'registry'
      ? () => withRegistry(testCase.run)
      : testCase.kind === 'host'
        ? () => withHost(testCase.scenarios ?? [], testCase.run)
        : () => withRefusal(testCase.run)
    test(testCase.title, run)
  }
}

// ---------------------------------------------------------------------------
// P1 — allocation lifecycle
// ---------------------------------------------------------------------------

async function armOneAllocatePerSession(harness) {
  const first = await harness.acquire('bind-a', { backend: 'pty' })
  assert.equal(first.result.ok, true, `the first acquire must succeed: ${JSON.stringify(first.result)}`)
  assert.equal(first.result.value.reused, false)
  assert.equal(first.result.value.domainId, 'terminal-1')

  const second = await harness.acquire('bind-a', { backend: 'pty' })
  assert.equal(second.result.ok, true)
  assert.equal(second.result.value.reused, true, 'a repeat acquire for the same member/binding must REUSE the live shell')
  assert.equal(second.result.value.domainId, first.result.value.domainId)
  assert.equal(second.result.value.pid, first.result.value.pid)
  assert.equal(second.result.value.backend, 'pty')
  assert.equal(harness.allocations(), 1, 'a reused domain must not allocate a second PTY')
  assert.equal(first.record.kills.length, 0, 'reuse must not kill the shell')

  const third = await harness.acquire('bind-b', { backend: 'pipe' })
  assert.equal(third.result.ok, true)
  assert.equal(third.result.value.reused, false)
  assert.notEqual(third.result.value.domainId, first.result.value.domainId, 'a different binding is a different terminal identity')
  assert.equal(third.result.value.backend, 'pipe')
  assert.equal(harness.allocations(), 2, 'exactly one allocate per session')
  assert.deepEqual(harness.log.filter((entry) => entry[0] === 'allocate').map((entry) => entry[1]), ['bind-a', 'bind-b'])
}

async function armCommandGateAfterKill(harness) {
  const acquired = await harness.acquire('bind-a')
  assert.equal(acquired.result.ok, true)
  const { domainId } = acquired.result.value

  assert.equal(harness.registry.assertCurrent(domainId).ok, true, 'a live domain accepts a command')

  const killed = await harness.registry.revoke(PTY_CONTRACT_IDENTITY)
  assert.deepEqual(killed, [domainId], 'the revoke reports the domain it terminated')
  assert.deepEqual(acquired.record.kills, ['SIGKILL'], 'one kill per terminal, with the hard signal')

  const afterKill = harness.registry.assertCurrent(domainId)
  assert.equal(afterKill.ok, false)
  assert.equal(afterKill.code, 'DOMAIN_REVOKED', 'a command after kill is a TYPED refusal, not an idempotent success')
  assert.equal(harness.allocations(), 1, 'a refused command must not allocate anything')

  const secondKill = await harness.registry.revoke(PTY_CONTRACT_IDENTITY)
  assert.deepEqual(secondKill, [], 'a second revoke finds no domain: double-kill is an idempotent no-op')
  assert.deepEqual(acquired.record.kills, ['SIGKILL'], 'the second revoke must not signal the port again')
  assert.equal(harness.registry.list().length, 0)

  const reacquire = await harness.acquire('bind-a')
  assert.equal(reacquire.result.ok, false, 'a revoked member must not get a fresh shell from a new acquire')
  assert.equal(reacquire.result.code, 'DOMAIN_REVOKED')
  assert.equal(harness.allocations(), 1, 'the refused re-acquire never reached the port')

  const receipt = await harness.registry.shutdown()
  assert.deepEqual(receipt.domains, [], 'nothing is retained after the revoke, so shutdown has nothing to kill')
  assert.deepEqual(acquired.record.kills, ['SIGKILL'])
}

async function armRevokeWithoutDomain(harness) {
  // PD-1 FIXED (2026-11-09): `revoke` takes the trusted member identity
  // (generation included) and records the generation unconditionally, so a
  // member that owns NO live domain at revoke time is still bound. The port is
  // never reached by the later acquire.
  const member = { ...PTY_CONTRACT_IDENTITY, memberInstanceId: 'member-with-no-shell' }
  const killed = await harness.registry.revoke(member)
  assert.deepEqual(killed, [], 'there is no domain to kill')

  const acquired = await harness.acquire('bind-late', { identity: member })
  assert.equal(acquired.result.ok, false, 'PD-1: the revoked generation must NOT acquire a shell')
  assert.equal(acquired.result.code, 'DOMAIN_REVOKED')
  assert.equal(harness.allocations(), 0, '...and the port was never asked to allocate')
  assert.equal(harness.registry.list().length, 0)
}

async function armHostSessionLifecycle(world) {
  const created = await world.terminals.spawn(world.owner, { type: 'pty-recording', name: 'main' })
  assert.equal(created.sessionId, 'pty-1')
  assert.ok(Number.isInteger(created.pid), 'a published session carries its backend pid')
  assert.equal(world.backend.spawned(), 1, 'one backend spawn per session')

  const operation = world.terminals.startSend(world.owner, created.sessionId, { text: 'echo A5SF', submit: true })
  assert.deepEqual(world.backend.sendsFor(created.sessionId), ['echo A5SF'], 'the write reaches THIS session with the exact text')
  assert.equal(operation.readOutput().delta, 'delta:echo A5SF')
  assert.equal(world.terminals.read(world.owner, created.sessionId, { offset: 0, count: 5 }).text, 'scrollback:pty-1')

  const killed = await world.terminals.kill(world.owner, created.sessionId)
  assert.equal(killed, true)
  assert.equal(world.backend.closesFor(created.sessionId), 1, 'one close per terminal')

  const secondKill = await world.terminals.kill(world.owner, created.sessionId).then(() => 'resolved', (error) => error.code)
  assert.equal(secondKill, 'NO_SESSION', 'a sequential double-kill is a TYPED refusal once the session is gone')
  assert.equal(world.backend.closesFor(created.sessionId), 1, 'the refused double-kill did not close the port twice')

  const sendAfterKill = await Promise.resolve()
    .then(() => world.terminals.startSend(world.owner, created.sessionId, { text: 'after', submit: true }))
    .then(() => 'accepted', (error) => error.code)
  assert.equal(sendAfterKill, 'NO_SESSION', 'no write is accepted after kill')
  const readAfterKill = await Promise.resolve()
    .then(() => world.terminals.read(world.owner, created.sessionId))
    .then(() => 'accepted', (error) => error.code)
  assert.equal(readAfterKill, 'NO_SESSION', 'no read is accepted after kill')

  // Overlapping double-kill: the second caller observes the in-flight close and
  // returns false (idempotent), and the port is closed exactly once.
  const second = await world.terminals.spawn(world.owner, { type: 'pty-recording' })
  const outcomes = await Promise.all([world.terminals.kill(world.owner, second.sessionId), world.terminals.kill(world.owner, second.sessionId)])
  assert.deepEqual([...outcomes].sort(), [false, true], 'an overlapping double-kill is idempotent: one true, one false')
  assert.equal(world.backend.closesFor(second.sessionId), 1)
}

// ---------------------------------------------------------------------------
// P2 — exit-status propagation
// ---------------------------------------------------------------------------

async function armRegistryCollapsesExitOutcomes(harness) {
  const exited = await harness.acquire('bind-exited', { killBehaviour: 'exited', label: 'exit-7' })
  const killed = await harness.acquire('bind-killed', { killBehaviour: 'resolve', label: 'killed' })
  const groupGone = await harness.acquire('bind-group-gone', { killBehaviour: 'group-gone', label: 'group-gone' })
  for (const acquired of [exited, killed, groupGone]) {
    assert.equal(acquired.result.ok, true, `acquire failed: ${JSON.stringify(acquired.result)}`)
  }
  const receipt = await harness.registry.shutdown()
  assert.equal(receipt.domains.length, 3)

  // The fixture really does present three DIFFERENT process fates at the port:
  // two of the three kills REJECTED, and the registry swallowed both.
  assert.deepEqual(exited.record.killErrors, ['TERMINAL_EXITED'])
  assert.deepEqual(killed.record.killErrors, [])
  assert.deepEqual(groupGone.record.killErrors, ['ESRCH'])
  for (const row of receipt.domains) {
    assert.deepEqual(Object.keys(row).sort(), [...SHUTDOWN_ROW_KEYS].sort(), 'the receipt exposes exactly these fields — no process outcome')
    assert.equal(row.killed, true, 'a process that had ALREADY exited still reports killed:true')
    assert.equal(row.memberInstanceId, MEMBER)
    assert.equal(Array.isArray(row.descendants) && row.descendants.length, 2, 'the PRE-kill descendant snapshot is all the receipt carries')
  }
  // Every port was signalled exactly once, including the two that rejected the
  // signal: the registry cannot tell "we killed it" from "it was already dead".
  for (const record of harness.records) {
    assert.deepEqual(record.kills, ['SIGKILL'], `${record.label} must be signalled once`)
  }
  const collapsed = receipt.domains.map((row) => ({ killed: row.killed, memberInstanceId: row.memberInstanceId, policyRevision: row.policyRevision }))
  assert.deepEqual(collapsed[0], collapsed[1])
  assert.deepEqual(collapsed[1], collapsed[2], 'the three fates are INDISTINGUISHABLE in the only downstream record the registry produces')
}

async function armHostDistinguishesOutcomes(world) {
  const exited = await world.terminals.spawn(world.owner, { type: 'pty-recording' })
  const signalled = await world.terminals.spawn(world.owner, { type: 'pty-recording' })
  const transport = await world.terminals.spawn(world.owner, { type: 'pty-recording' })

  const snapshots = world.terminals.list(world.owner)
  assert.equal(snapshots.length, 3)
  assert.deepEqual(snapshots.find((row) => row.sessionId === exited.sessionId).status, { kind: 'exited', exitCode: 7, signal: null }, 'a non-zero exit carries its CODE')
  assert.deepEqual(snapshots.find((row) => row.sessionId === signalled.sessionId).status, { kind: 'exited', exitCode: null, signal: 'SIGTERM' }, 'a signal death carries the SIGNAL')
  assert.deepEqual(snapshots.find((row) => row.sessionId === transport.sessionId).status, { kind: 'running' }, 'a transport failure leaves the process status untouched')

  const exitOperation = world.terminals.startSend(world.owner, exited.sessionId, { text: 'x', submit: false })
  const exitResult = await exitOperation.done
  assert.equal(exitResult.sessionStatus.exitCode, 7)
  assert.equal(exitResult.sessionStatus.signal, null)
  assert.equal(exitResult.waitReason, 'session_exit')

  const signalOperation = world.terminals.startSend(world.owner, signalled.sessionId, { text: 'x', submit: false })
  const signalResult = await signalOperation.done
  assert.equal(signalResult.sessionStatus.exitCode, null)
  assert.equal(signalResult.sessionStatus.signal, 'SIGTERM')

  const transportOperation = world.terminals.startSend(world.owner, transport.sessionId, { text: 'x', submit: false })
  const transportError = await transportOperation.done.then(() => null, (error) => error)
  assert.ok(transportError !== null, 'a transport failure must reject, not resolve as a benign status')
  assert.equal(transportError.code, 'EIO')

  // The kill path itself does NOT distinguish "already dead" from "we killed
  // it": status() before the kill is the observation point the registry lacks.
  assert.equal(await world.terminals.kill(world.owner, exited.sessionId), true)
  assert.equal(world.backend.spawned(), 3)
}

// ---------------------------------------------------------------------------
// P3 — orphan / reap
// ---------------------------------------------------------------------------

async function armRegistryReap(harness) {
  const first = await harness.acquire('bind-a', { label: 'a' })
  const second = await harness.acquire('bind-b', { label: 'b' })
  assert.equal(harness.allocations(), 2)
  assert.deepEqual(first.handle.descendants(), first.record.descendantsBefore, 'before the kill the port still reports its descendants')

  const receipt = await harness.registry.shutdown()
  assert.equal(receipt.domains.length, 2, 'each live domain appears in the shutdown receipt')

  for (const [acquired, record] of [[first, first.record], [second, second.record]]) {
    assert.deepEqual(record.kills, ['SIGKILL'], `${record.label} is signalled exactly once (once per terminal)`)
    assert.equal(record.alive, false, `${record.label} must be dead after the kill`)
    assert.deepEqual(acquired.handle.descendants(), [], `${record.label} must report NO live descendants after the kill`)
    const refused = harness.registry.assertCurrent(acquired.result.value.domainId)
    assert.equal(refused.ok, false)
    assert.equal(refused.code, 'DOMAIN_REVOKED', 'the domain is gone from the registry, not merely flagged')
    assert.equal('fd' in acquired.handle, false, 'the injected port exposes no fd; a real descriptor count is NOT reachable host-free')
  }
  assert.equal(harness.registry.list().length, 0, 'no domain is retained after shutdown')

  const secondShutdown = await harness.registry.shutdown()
  assert.deepEqual(secondShutdown.domains, [], 'a second shutdown has nothing to reap and re-kills nothing')
  assert.deepEqual(first.record.kills, ['SIGKILL'])
  assert.deepEqual(second.record.kills, ['SIGKILL'])
}

async function armHostReap(world) {
  const first = await world.terminals.spawn(world.owner, { type: 'pty-recording' })
  const second = await world.terminals.spawn(world.owner, { type: 'pty-recording' })

  assert.equal(await world.terminals.kill(world.owner, first.sessionId), true)
  assert.equal(world.backend.closesFor(first.sessionId), 1, 'the killed session closed its port exactly once')
  assert.equal(world.backend.closesFor(second.sessionId), 0, 'the sibling port is untouched')
  assert.deepEqual(world.terminals.list(world.owner).map((row) => row.sessionId), [second.sessionId])
  assert.equal(world.terminals.hasOwnerActivity(world.owner), true)

  const third = await world.terminals.spawn(world.owner, { type: 'pty-recording' })
  await world.dispose()
  assert.equal(world.backend.spawned(), 3)
  assert.equal(world.backend.closesFor(first.sessionId), 1, 'disposal must not re-close an already closed port')
  assert.equal(world.backend.closesFor(second.sessionId), 1, 'disposal closes the live session exactly once')
  assert.equal(world.backend.closesFor(third.sessionId), 1)
  const refused = await world.terminals.spawn(world.owner, { type: 'pty-recording' }).then(() => null, (error) => error)
  assert.ok(refused !== null)
  assert.equal(refused.code, 'SERVICE_DISPOSING', 'a disposed service refuses new PTY allocations')
}

// ---------------------------------------------------------------------------
// P4 — the refusal path and its ordering
// ---------------------------------------------------------------------------

function refusalCode(error) {
  return error?.code ?? error?.cause?.code ?? null
}

async function armRefusedBeforeAllocation(world) {
  // PRECONDITION: the assembled Member realm answers faces for
  // fs/subprocess/web/terminals and has NO terminal face at all — that absence
  // is why the refusal exists.
  //
  // ANNOTATED 2026-11-11 (PD-13): this arm used to assert the FIELD was absent
  // (`'terminals' in faces === false`, GAP-PTY-CONTRACT-1). `RealmServiceFaces`
  // is a TOTAL answer by design (the same law as `subprocess`/`web`), so PD-13
  // added the field; the absence is now the explicit `null`. The arm's
  // PROPOSITION — "this realm confines no terminal, so the consumer is refused
  // before any allocation" — is unchanged, and its assertions on the refusal,
  // the zero allocations and the never-run `apply` are untouched. The arm was
  // narrowed, not deleted: a non-null face here would still fail it.
  assert.equal(world.member.faces.terminals, null, 'RealmServiceFaces answers NO terminal face (explicit null, PD-13)')
  assert.equal(world.member.faces.subprocess, null)
  const inherited = world.inheritedTerminals
  assert.ok(inherited !== undefined, 'the member scope still RESOLVES an inherited terminals service — the widening the refusal prevents')
  assert.equal(typeof inherited.spawn, 'function')
  assert.equal(world.backend.spawned(), 0)

  const persistent = persistentBashModule(world.seams)
  assert.deepEqual([...persistent.module.inject], ['tools', 'terminals'], 'the shipped persistent-bash module declares the PTY service')

  const error = await world.realm.mountNativeToolModules([{ module: persistent.module }], { scope: world.agentKey })
    .then(() => null, (caught) => caught)
  assert.ok(error !== null, 'mounting the shipped persistent-bash module must be REFUSED')
  assert.equal(refusalCode(error), LEGACY_PTY_REFUSAL)
  assert.match(String(error.detail ?? error.message), /refusing at composition time/)
  assert.deepEqual(persistent.applied, [], 'the module\'s apply never ran: the refusal precedes the fiber')
  assert.equal(world.backend.spawned(), 0, 'zero backend allocations — the refusal precedes any PTY allocation')
  assert.deepEqual(world.terminals.list(world.owner), [], 'no legacy session exists to leak')
}

async function armDeferredRefusalIsPostAllocation(world) {
  const deferred = terminalsConsumerModule({ greedy: true, defer: true, owner: world.owner })
  assert.deepEqual([...deferred.module.inject], ['tools'], 'the deferred shape declares only tools on the fiber')

  const error = await world.realm.mountNativeToolModules([{ module: deferred.module }], { scope: world.agentKey })
    .then(() => null, (caught) => caught)
  assert.ok(error !== null, 'the deferred terminals consumer is still refused')
  assert.equal(refusalCode(error), LEGACY_PTY_REFUSAL)
  assert.match(String(error.detail ?? error.message), /deferred a `terminals` injection/)

  // FINDING, not an ordering claim: by the time the refusal fires the module's
  // own apply has run and a REAL legacy PTY was allocated through the inherited
  // service. This is the one shape where the refusal is NOT before allocation.
  assert.deepEqual(deferred.state.applied, ['apply'], 'the deferred module\'s apply DID run before the refusal')
  assert.equal(world.backend.spawned(), 1, 'one real legacy PTY was allocated BEFORE the refusal')
  const live = world.terminals.list(world.owner)
  assert.equal(live.length, 1, 'the allocated legacy session is still live when the refusal is thrown')
  assert.equal(live[0].sessionId, 'pty-1')
  assert.equal(world.terminals.hasOwnerActivity(world.owner), true)
}

async function armInertModuleMounts(world) {
  const inert = inertModule()
  const fibers = await world.realm.mountNativeToolModules([{ module: inert.module }], { scope: world.agentKey })
  assert.ok(fibers.length >= 1, 'a module that consumes no PTY service mounts and yields a fiber')
  assert.deepEqual(inert.applied, ['apply'])
  assert.equal(world.backend.spawned(), 0, 'a non-terminal module allocates no PTY')
  assert.deepEqual(world.terminals.list(world.owner), [])
}

// ---------------------------------------------------------------------------
// P5 — concurrency and identity
// ---------------------------------------------------------------------------

async function armTwoBindingsIdentity(harness) {
  const first = await harness.acquire('bind-a', { backend: 'pty', label: 'a' })
  const second = await harness.acquire('bind-b', { backend: 'pipe', label: 'b' })
  assert.equal(first.result.ok, true)
  assert.equal(second.result.ok, true)
  assert.equal(harness.allocations(), 2)
  assert.notEqual(first.result.value.domainId, second.result.value.domainId)
  assert.notEqual(first.result.value.pid, second.result.value.pid)

  const rows = harness.registry.list()
  assert.equal(rows.length, 2)
  for (const [bound, record] of [[first, first.record], [second, second.record]]) {
    const row = rows.find((candidate) => candidate.domainId === bound.result.value.domainId)
    assert.ok(row !== undefined, `no list() row for ${bound.result.value.domainId}`)
    assert.equal(row.owner.toolBindingIdentity, record.binding, 'the row carries the binding that owns it')
    assert.equal(row.pid, record.pid, 'the row\'s pid belongs to ITS domain')
    assert.equal(row.backend, record.backend, 'the row\'s backend belongs to ITS domain')
    assert.equal(row.policyRevision, 'rev-1')
  }

  const receipt = await harness.registry.shutdown()
  assert.equal(receipt.domains.length, 2)
  const pids = receipt.domains.map((row) => row.pid)
  assert.equal(new Set(pids).size, 2, 'the receipt\'s pids are distinct — a swapped/zip attribution is detectable')
  for (const [bound, record] of [[first, first.record], [second, second.record]]) {
    const row = receipt.domains.find((candidate) => candidate.domainId === bound.result.value.domainId)
    assert.ok(row !== undefined)
    assert.equal(row.pid, record.pid)
    assert.equal(row.memberInstanceId, MEMBER)
    assert.equal(row.policyRevision, 'rev-1')
    assert.deepEqual(row.descendants, record.descendantsBefore, 'the descendant list travels with its own domain')
  }
}

async function armKillOneNotTheOther(harness) {
  const first = await harness.acquire('bind-a', { backend: 'pty', label: 'a-1' })
  const sibling = await harness.acquire('bind-b', { backend: 'pipe', label: 'b' })
  assert.equal(first.result.ok, true)
  assert.equal(sibling.result.ok, true)

  harness.setRevision('rev-2')
  const replacement = await harness.acquire('bind-a', { backend: 'pty', label: 'a-2' })
  assert.equal(replacement.result.ok, true)
  assert.equal(replacement.result.value.reused, false, 'a tightened revision replaces the domain instead of reusing it')
  assert.notEqual(replacement.result.value.domainId, first.result.value.domainId)

  assert.deepEqual(harness.recordFor('a-1').kills, ['SIGKILL'], 'replacing binding A kills A exactly once')
  assert.deepEqual(harness.recordFor('b').kills, [], 'killing A must NOT kill the sibling B')

  const siblingRefusal = harness.registry.assertCurrent(sibling.result.value.domainId)
  assert.equal(siblingRefusal.ok, false)
  assert.equal(siblingRefusal.code, 'REVISION_STALE', 'B\'s commands are refused under the new revision...')
  const siblingRow = harness.registry.list().find((row) => row.domainId === sibling.result.value.domainId)
  assert.ok(siblingRow !== undefined, '...but B is still registered')
  assert.equal(siblingRow.status, 'stale', 'PD-7: a superseded-but-live domain reports the state its command gate enforces')
  assert.deepEqual(harness.recordFor('b').kills, [], '...and its PTY is still open (no owner-side kill until shutdown/revoke)')

  // There is no per-domain kill on the registry: the only single-terminal kill is
  // the replace-on-tighten path above; bulk kill is member-scoped.
  assert.equal(typeof harness.registry.kill, 'undefined', 'the registry exposes no per-domain kill')
  const revoked = await harness.registry.revoke(PTY_CONTRACT_IDENTITY)
  assert.deepEqual([...revoked].sort(), [replacement.result.value.domainId, sibling.result.value.domainId].sort(), 'revoke(member) is member-scoped: it kills BOTH')
  assert.deepEqual(harness.recordFor('b').kills, ['SIGKILL'])
  assert.deepEqual(harness.recordFor('a-2').kills, ['SIGKILL'])
}

/**
 * PD-7 (F4): the REPORTED state must equal the ENFORCED state.
 *
 * Nothing here re-acquires after the revision moves, so the domain kept in the
 * registry is exactly the "stale-but-live" object the register describes: the
 * PTY is open, `assertCurrent` refuses every command with `REVISION_STALE`, and
 * `list()` used to keep saying `active`. The assertion is not "stale sounds
 * nicer" — it is that the two answers about the SAME domain cannot disagree.
 */
async function armStaleDomainReportsStale(harness) {
  const first = await harness.acquire('bind-a', { backend: 'pty', label: 'a-1' })
  const sibling = await harness.acquire('bind-b', { backend: 'pipe', label: 'b' })
  assert.equal(first.result.ok, true)
  assert.equal(sibling.result.ok, true)

  // CONTROL: while the revision is current, list() says active and the gate
  // accepts. A fix that merely reports everything stale would fail here.
  for (const acquired of [first, sibling]) {
    const row = harness.registry.list().find((candidate) => candidate.domainId === acquired.result.value.domainId)
    assert.ok(row !== undefined)
    assert.equal(row.status, 'active', 'a domain created under the current revision is reported active')
    assert.equal(harness.registry.assertCurrent(acquired.result.value.domainId).ok, true)
  }

  // Tighten the policy WITHOUT re-acquiring: both domains are now superseded
  // and still live (nothing was killed), which is the PD-7 shape.
  harness.setRevision('rev-2')

  for (const acquired of [first, sibling]) {
    const { domainId } = acquired.result.value
    const gate = harness.registry.assertCurrent(domainId)
    const row = harness.registry.list().find((candidate) => candidate.domainId === domainId)
    assert.ok(row !== undefined, `${domainId} is still registered (the registry has no per-domain kill)`)

    // The enforced answer: the command gate refuses the shell outright.
    assert.equal(gate.ok, false, 'the command gate refuses a domain created under a superseded revision')
    assert.equal(gate.code, 'REVISION_STALE', 'the refusal code is the state machine\'s own word for a superseded revision')

    // The reported answer must be the same answer in the status vocabulary:
    // REVISION_STALE -> 'stale'. BEFORE the fix this is 'active' (the defect).
    assert.notEqual(row.status, 'active', 'PD-7: list() must not report a refused domain as active')
    assert.equal(row.status, 'stale', 'list() reports the state the command gate enforces')
    assert.equal(gate.ok, row.status === 'active', 'the reported state and the enforced state agree for the same domain')
  }

  // The stale domains are LIVE, not terminated: the report changed, not the process.
  assert.deepEqual(harness.recordFor('a-1').kills, [], 'the superseded shell was not killed by a bare revision move')
  assert.deepEqual(harness.recordFor('b').kills, [], 'the sibling shell is still open')
  assert.equal(harness.registry.list().length, 2, 'both stale domains remain registered until revoke/shutdown')
}

async function armHostTwoSessionsFenced(world) {
  const first = await world.terminals.spawn(world.owner, { type: 'pty-recording', name: 'a' })
  const second = await world.terminals.spawn(world.owner, { type: 'pty-recording', name: 'b' })
  assert.notEqual(first.sessionId, second.sessionId)
  assert.notEqual(first.pid, second.pid)

  await world.terminals.startSend(world.owner, first.sessionId, { text: 'A-CMD', submit: true }).done
  await world.terminals.startSend(world.owner, second.sessionId, { text: 'B-CMD', submit: true }).done
  assert.deepEqual(world.backend.sendsFor(first.sessionId), ['A-CMD'], 'session A received exactly A\'s write')
  assert.deepEqual(world.backend.sendsFor(second.sessionId), ['B-CMD'], 'session B received exactly B\'s write — no crossing')
  assert.equal(world.terminals.read(world.owner, first.sessionId).text, 'scrollback:pty-1')
  assert.equal(world.terminals.read(world.owner, second.sessionId).text, 'scrollback:pty-2')

  assert.equal(await world.terminals.kill(world.owner, first.sessionId), true)
  assert.equal(world.backend.closesFor(second.sessionId), 0, 'killing one terminal must not kill the other')
  assert.deepEqual(world.terminals.list(world.owner).map((row) => row.sessionId), [second.sessionId])
  assert.deepEqual(world.terminals.list(world.owner)[0].name, 'b', 'the surviving row carries ITS OWN identity')
  assert.equal(world.terminals.list(world.owner)[0].pid, second.pid)

  const survivorOperation = world.terminals.startSend(world.owner, second.sessionId, { text: 'B-AFTER', submit: false })
  await survivorOperation.done
  assert.deepEqual(world.backend.sendsFor(second.sessionId), ['B-CMD', 'B-AFTER'])

  for (const [operation, expected] of [
    [() => world.terminals.read(world.owner, first.sessionId), 'NO_SESSION'],
    [() => world.terminals.startSend(world.owner, first.sessionId, { text: 'x', submit: false }), 'NO_SESSION'],
    [() => world.terminals.read(world.foreign, second.sessionId), 'FOREIGN_SESSION'],
    [() => world.terminals.signal(world.foreign, second.sessionId, 'SIGINT'), 'FOREIGN_SESSION'],
  ]) {
    const observed = await Promise.resolve().then(operation).then(() => null, (error) => error?.code ?? null)
    assert.equal(observed, expected, `expected ${expected}, got ${observed}`)
  }
  assert.equal(world.backend.closesFor(second.sessionId), 0)
}
