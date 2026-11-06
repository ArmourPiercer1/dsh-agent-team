/**
 * a5sf-bl42-netdeny.test.mjs — BL-42, the confined network backend and the
 * probe that is now allowed to answer `enforced`.
 *
 * WHAT THIS FILE IS. It is the host-free (C1) half of BL-42: it drives the REAL
 * product seam (`mountA5sfRealm` → the confined `subprocess` face → the real
 * `ConfinedProcessProvider` → the real Landlock/netns launcher) and measures a
 * network attempt with the OS, not with our admission code.
 *
 * THE PIN AND THE FLIP. Before BL-42, the provider's capability probe reported
 * `network-destination: unsupported` (`mechanism: null`, `evidence: null`) and
 * a `network: deny` lane was refused at ADMISSION with zero processes — a
 * statement about our own code, made before the kernel was asked. The pin of
 * that behaviour is not deleted: it is arm `P0`, and it is re-measured here
 * against a launcher that does NOT apply the mechanism (a mutant copy of the
 * shipped launcher with `enter_netns` short-circuited). That arm must stay
 * exactly as it was — `unsupported` + `NETWORK_UNCONFINED_REALM` + zero provider
 * calls — which is what makes "the probe is load-bearing" a measurement rather
 * than a claim.
 *
 * THE FIVE §7 ITEMS THIS FILE CAN ANSWER (see the evidence README for the
 * item-by-item ledger):
 *   1  a non-empty mechanism + an evidence row bound to the realm → `A2`
 *   2  a real child whose attempt is refused by the kernel/transport → `A3`, `A5`
 *   3  a positive control that really reaches the listener → `A3`, `A5`
 *   4  out-of-band transport observation on both sides (listener counters +
 *      namespace inodes) → `A1`, `A3`, `A5`
 *   5  a second consumer path → `A5` (the confined terminal face, PD-13's
 *      `createConfinedTerminalFace`, on the same process face). The LIVE Host
 *      preset half of item 5 is NOT claimed here.
 *
 * WHAT THIS FILE DOES NOT DO. No Host boot, no `tests/homes/**`, no port in the
 * 3180 family: every listener is `127.0.0.1:0` (an ephemeral loopback port),
 * there is no external egress, and no World is created. Nothing here is
 * `DEV-LIVE` or `CANDIDATE-C2` evidence.
 *
 * Run: node --test tests/world-factory/a5sf-bl42-netdeny.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { makeSubContractWorld } from './lib/a5sf-sub-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(dirname(HERE))
const LAUNCHER = join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const PYTHON = '/usr/bin/python3'
const NS_NET = '/proc/self/ns/net'

/** The host's network-namespace inode (identity of THIS process's netns). */
function hostNetNsInode() {
  try {
    return statSync(NS_NET).ino
  } catch {
    return null
  }
}

/**
 * A loopback listener with its OWN counters. The counters are the out-of-band
 * transport observation §7 item 4 asks for: they live in the TEST process (the
 * listener side), not in the confined child and not in the provider.
 */
async function loopbackListener() {
  const accepted = []
  const server = net.createServer((socket) => {
    accepted.push('connection')
    // A denied child never reaches this socket; an allowed child may close
    // before reading the reply, which resets the stream. The COUNTER is the
    // observation, so a reset is noise, not a failure.
    socket.on('error', () => {})
    socket.on('data', () => {})
    socket.end('ok')
  })
  server.on('error', () => {})
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    port: server.address().port,
    counts: () => accepted.length,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

/** The child program: report the namespace it is IN, then attempt the connect. */
function childScriptPath(dir, port) {
  const path = join(dir, 'bl42-connect.py')
  writeFileSync(path, [
    'import os, socket, sys',
    "print('NS', os.stat('/proc/self/ns/net').st_ino)",
    's = socket.socket(socket.AF_INET, socket.SOCK_STREAM)',
    's.settimeout(3.0)',
    `try:`,
    `    s.connect(('127.0.0.1', ${port}))`,
    `    s.sendall(b'BL42-NONCE')`,
    `    print('CONNECTED')`,
    'except OSError as e:',
    "    print('ERR', e.errno, e.strerror)",
    '',
  ].join('\n'), 'utf8')
  return path
}

/** The confined shell invocation: an admitted `bash -c` whose body is opaque. */
function connectSpec(world, script, cwd) {
  return {
    argv: ['/bin/bash', '-c', `${PYTHON} ${script}`],
    cwd,
    stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 16 }, stderr: { maxBytes: 1 << 16 } },
    graceMs: 10_000,
    shell: { program: 'bash', reads: [cwd], writes: [cwd] },
  }
}

/** One spawn through the MOUNTED confined face, with BOTH captured streams. */
async function runFace(world, spec) {
  const before = world.counted.spawns.count
  let handle
  try {
    handle = world.face.spawn(spec)
  } catch (error) {
    return { before, after: world.counted.spawns.count, error, code: error?.code ?? null, stdout: '', stderr: '' }
  }
  const error = await handle.done.then(() => undefined, (caught) => caught)
  const read = (stream) => {
    try {
      return stream?.readFrom(0)?.text ?? ''
    } catch {
      return ''
    }
  }
  return {
    before,
    after: world.counted.spawns.count,
    error,
    code: error?.code ?? null,
    stdout: read(handle.collected?.stdout),
    stderr: read(handle.collected?.stderr),
  }
}

/** A mutant launcher: the shipped bytes with the mechanism application removed. */
function mutantLauncherWithoutMechanism() {
  const dir = mkdtempSync(join(tmpdir(), 'a5sf-bl42-mutant-'))
  const path = join(dir, 'landlock-prelauncher.py')
  const source = readFileSync(LAUNCHER, 'utf8')
  const marker = '    host_ino = net_ns_inode_of()\n'
  assert.ok(source.includes(marker), 'the launcher still has the enter_netns entry the mutant removes')
  const mutated = source.replace(
    marker,
    '    # MUTANT (BL-42 negative control): the mechanism is NOT applied.\n'
      + '    return {"applied": False, "reason": "MUTANT: enter_netns is short-circuited"}\n'
      + marker,
  )
  writeFileSync(path, mutated, 'utf8')
  return { path, dir }
}

// ---------------------------------------------------------------------------
// A1 — the mechanism leg, measured directly
// ---------------------------------------------------------------------------

test('A1-NETLEG-CONFIRMED: a real control child reaches a loopback listener; a real deny child lands in a distinct netns and its connect/send fail with a KERNEL errno while the listener counters do not move', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'a5sf-bl42-netleg-'))
  try {
    const result = spawnSync(PYTHON, [LAUNCHER, '--net-leg', '--scratch', scratch], { encoding: 'utf8', timeout: 60_000 })
    const text = (result.stdout ?? '').trim().split('\n').filter(Boolean).pop()
    assert.ok(text !== undefined, `the net leg produced no verdict (rc=${String(result.status)}): ${result.stderr}`)
    const verdict = JSON.parse(text)
    assert.equal(verdict.verdict, 'NET-DENY-CONFIRMED', `net leg verdict: ${JSON.stringify(verdict.checks)}`)
    assert.equal(verdict.mechanism, 'netns')
    // The CONTROL is what makes "it failed" mean something: the same call, in
    // the same process tree, reaches the same listener when unconfined.
    assert.equal(verdict.control.tcp.ok, true)
    assert.equal(verdict.control.udp.ok, true)
    assert.equal(verdict.control.accepted, 1)
    assert.equal(verdict.control.datagrams, 1)
    assert.equal(verdict.control.nonce_matched, true)
    // The DENY side: a distinct namespace, a kernel errno, and ZERO transport.
    assert.notEqual(verdict.deny.net.net_ns_inode, verdict.deny.net.host_net_ns_inode)
    assert.notEqual(verdict.deny.net.net_ns_inode, verdict.host_net_ns_inode)
    assert.equal(verdict.deny.net.no_new_privs, true)
    assert.equal(verdict.deny.accepted, 0)
    assert.equal(verdict.deny.datagrams, 0)
    assert.match(String(verdict.deny.tcp.errno), /^(ENETUNREACH|ECONNREFUSED|EHOSTUNREACH|ENETDOWN|EACCES)$/)
    assert.match(String(verdict.deny.udp.errno), /^(ENETUNREACH|ECONNREFUSED|EHOSTUNREACH|ENETDOWN|EACCES)$/)
    // Nothing in this leg may have read as a claim about syscalls we did not make.
    assert.ok(Array.isArray(verdict.raw))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// A2 — probe honesty: `enforced` ONLY with a mechanism and a bound evidence row
// ---------------------------------------------------------------------------

test('A2-PROBE-HONESTY: the REAL provider probe reports network-destination=enforced with a non-empty mechanism and a realm-bound evidence row, and its note carries the leg\'s own numbers', async () => {
  const world = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-probe', shellClass: { programs: ['bash'] } })
  try {
    const { probeNetworkDenial } = world.seams.subprocess
    const probe = await probeNetworkDenial(world.provider)
    assert.equal(probe.dimension, 'network-destination')
    assert.equal(probe.level, 'enforced', `probe note: ${probe.note}`)
    assert.ok(typeof probe.mechanism === 'string' && probe.mechanism.includes('netns'), 'the row must name the mechanism')
    assert.ok(typeof probe.evidence === 'string' && probe.evidence.startsWith('evidence://'), 'the row must carry an evidence reference')
    assert.match(String(probe.evidence), /realm-a5sf-sub-contract-bl42-probe/, 'the evidence row is bound to the REALM, not to nothing')
    const row = probe.rows.find((candidate) => candidate.dimension === 'network-destination')
    assert.ok(row !== undefined)
    assert.equal(row.level, 'enforced')
    assert.notEqual(row.mechanism, null)
    assert.notEqual(row.evidence, null)
    assert.equal(row.realmId, 'realm-a5sf-sub-contract-bl42-probe')
    assert.match(String(row.trustRoot), /^sha256:/)
    // The note is the MEASUREMENT, not a restatement of the intent.
    assert.match(String(row.note), /NET-DENY-CONFIRMED/)
    assert.match(String(row.note), /netns inode/)
    assert.match(String(row.note), /listener counter unchanged/)
    assert.match(String(row.note), /not-covered=af_unix_pathname/)
  } finally {
    await world.dispose()
  }
})

test('A2b-SHARED-PROBE-REFUSES-A-BARE-LEVEL: `enforced` without a mechanism, or with a mechanism but no evidence, is still `unsupported` in the ONE probe both faces share', async () => {
  const world = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-bare-level' })
  try {
    const { probeNetworkDenial } = world.seams.subprocess
    const bareLevel = await probeNetworkDenial({ probe: async () => ({ ok: true, value: [{ dimension: 'network-destination', level: 'enforced', note: 'trust me' }] }) })
    assert.equal(bareLevel.level, 'unsupported')
    assert.match(bareLevel.note, /NO mechanism/)
    const noEvidence = await probeNetworkDenial({ probe: async () => ({ ok: true, value: [{ dimension: 'network-destination', level: 'enforced', mechanism: 'netns', note: 'trust me' }] }) })
    assert.equal(noEvidence.level, 'unsupported')
    assert.match(noEvidence.note, /NO evidence row/)
    const both = await probeNetworkDenial({ probe: async () => ({ ok: true, value: [{ dimension: 'network-destination', level: 'enforced', mechanism: 'netns', evidence: 'evidence://x/1', note: 'measured' }] }) })
    assert.equal(both.level, 'enforced')
    assert.equal(both.mechanism, 'netns')
    assert.equal(both.evidence, 'evidence://x/1')
  } finally {
    await world.dispose()
  }
})

// ---------------------------------------------------------------------------
// A3 — the loopback experiment through the confined process face (both sides)
// ---------------------------------------------------------------------------

test('A3-FACE-KERNEL-REFUSAL: the deny lane\'s child is refused by the kernel with the listener counter unchanged, while the allow lane\'s identical child CONNECTS and is counted', async () => {
  const listener = await loopbackListener()
  const denyWorld = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-deny', shellClass: { programs: ['bash'] }, network: 'deny' })
  const allowWorld = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-allow', shellClass: { programs: ['bash'] }, network: 'allow' })
  try {
    const denyScript = childScriptPath(denyWorld.fixtures.inside, listener.port)
    const allowScript = childScriptPath(allowWorld.fixtures.inside, listener.port)

    // POSITIVE CONTROL FIRST — the listener really is reachable on this host.
    const allowed = await runFace(allowWorld, connectSpec(allowWorld, allowScript, allowWorld.fixtures.inside))
    assert.equal(allowed.error, undefined, `allow lane must run: ${allowed.code ?? ''} ${allowed.stderr}`)
    assert.equal(allowed.after, 1, 'the allow lane must reach the provider exactly once')
    assert.match(allowed.stdout, /CONNECTED/)
    assert.equal(listener.counts(), 1, 'the listener must have counted the allow-lane child')

    // THE DENY LANE. Admitted (the probe proved the mechanism) — and refused by
    // the KERNEL inside the child's own network namespace.
    const denied = await runFace(denyWorld, connectSpec(denyWorld, denyScript, denyWorld.fixtures.inside))
    assert.equal(denied.error, undefined, `the deny lane is ADMITTED now (kernel refuses the connect, not admission): ${denied.code ?? ''}`)
    assert.equal(denied.after, 1, 'exactly one provider spawn: the child exists and is refused by the OS')
    assert.match(denied.stdout, /ERR (101|111|113) /, `the child's own attempt must carry a kernel errno: ${denied.stdout}${denied.stderr}`)
    assert.equal(listener.counts(), 1, 'the deny-lane child must NOT have reached the listener (counter unchanged)')

    // The child reports the namespace it actually ran in: a DIFFERENT one.
    const denyNs = Number(/^NS (\d+)$/m.exec(denied.stdout)?.[1] ?? NaN)
    const allowNs = Number(/^NS (\d+)$/m.exec(allowed.stdout)?.[1] ?? NaN)
    const hostNs = Number(hostNetNsInode())
    assert.ok(Number.isFinite(denyNs), `the deny child must report its netns inode: ${denied.stdout}`)
    assert.ok(Number.isFinite(allowNs), `the allow child must report its netns inode: ${allowed.stdout}`)
    assert.ok(Number.isFinite(hostNs), 'the host netns inode must be readable')
    assert.equal(allowNs, hostNs, 'the allow-lane child stays in the host network namespace')
    assert.notEqual(denyNs, hostNs, 'the deny-lane child ran in a different network namespace')
    assert.notEqual(denyNs, allowNs)
  } finally {
    await denyWorld.dispose()
    await allowWorld.dispose()
    await listener.close()
  }
})

// ---------------------------------------------------------------------------
// P0 — the pin: a backend that does NOT apply the mechanism still refuses
// ---------------------------------------------------------------------------

test('P0-NEGATIVE-CONTROL: with the mechanism removed from the trusted launcher, the probe reports `unsupported` (mechanism null) and the deny lane refuses at ADMISSION with zero provider calls', async () => {
  const mutant = mutantLauncherWithoutMechanism()
  const world = await makeSubContractWorld({
    repoRoot: REPO_ROOT,
    label: 'bl42-mutant',
    shellClass: { programs: ['bash'] },
    network: 'deny',
    launcherOverride: { path: mutant.path },
  })
  try {
    const { probeNetworkDenial } = world.seams.subprocess
    const probe = await probeNetworkDenial(world.provider)
    assert.equal(probe.level, 'unsupported', 'a launcher that cannot apply the mechanism must NOT report enforced')
    const row = probe.rows.find((candidate) => candidate.dimension === 'network-destination')
    assert.equal(row.level, 'unsupported')
    assert.equal(row.mechanism, null)
    assert.equal(row.evidence, null)

    const script = childScriptPath(world.fixtures.inside, 9)
    const attempted = await runFace(world, connectSpec(world, script, world.fixtures.inside))
    assert.equal(attempted.code, 'NETWORK_UNCONFINED_REALM', `the pre-BL-42 refusal is UNCHANGED when the mechanism is absent (got ${attempted.code})`)
    assert.equal(attempted.after, attempted.before, 'no provider call under an unenforced deny')
    assert.equal(attempted.after, 0)
    assert.match(String(attempted.error?.message ?? ''), /network-destination='unsupported'/)
    assert.match(String(attempted.error?.message ?? ''), /network=deny/)
  } finally {
    await world.dispose()
    rmSync(mutant.dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// A5 — the SECOND consumer path: the confined terminal face (PD-13's face)
// ---------------------------------------------------------------------------

test('A5-TERMINAL-SECOND-CONSUMER: the confined terminal face (`terminals.startSend`) rides the same process face — deny lane kernel-refused with the listener counter unchanged, allow lane counted', async () => {
  const listener = await loopbackListener()
  const denyWorld = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-term-deny', shellClass: { programs: ['bash'] }, network: 'deny' })
  const allowWorld = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-term-allow', shellClass: { programs: ['bash'] }, network: 'allow' })
  const disposals = []
  try {
    const drive = async (world, label) => {
      // The terminal face lives in its own module (install.ts mounts it); the
      // repo's TS loader is already registered by the world's seam loader.
      const terminalModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'terminal.ts')).href)
      const face = terminalModule.createConfinedTerminalFace({
        effective: world.effective,
        program: '/bin/bash',
        shellClass: { programs: ['bash'] },
        guard: async () => {},
        subprocess: world.face,
      })
      const fiber = await world.memberCtx.plugin(face, {})
      disposals.push(() => fiber.dispose())
      const terminals = world.memberCtx.get('terminals')
      assert.ok(terminals !== undefined && terminals !== null, `the confined terminal face did not provide \`terminals\` (${label})`)
      const owner = { id: `bl42-${label}` }
      const created = await terminals.spawn(owner, { type: 'confined-shell', cwd: world.fixtures.inside })
      const script = childScriptPath(world.fixtures.inside, listener.port)
      const before = world.counted.spawns.count
      const operation = terminals.startSend(owner, created.sessionId, { text: `${PYTHON} ${script}` })
      const outcome = await operation.done
      return { before, after: world.counted.spawns.count, outcome }
    }

    const allowed = await drive(allowWorld, 'allow')
    assert.equal(allowed.after - allowed.before, 1, 'the allow terminal send must reach the confined process face once')
    assert.match(String(allowed.outcome.stdout ?? ''), /CONNECTED/)
    assert.equal(listener.counts(), 1)

    const denied = await drive(denyWorld, 'deny')
    assert.equal(denied.after - denied.before, 1, 'the deny terminal send must ALSO reach the process face (admitted; the OS refuses)')
    assert.match(String(denied.outcome.stdout ?? ''), /ERR (101|111|113) /, `the terminal body must be refused by the kernel: ${JSON.stringify(denied.outcome)}`)
    assert.equal(listener.counts(), 1, 'the terminal deny child must not reach the listener')
  } finally {
    for (const dispose of disposals) await dispose()
    await denyWorld.dispose()
    await allowWorld.dispose()
    await listener.close()
  }
})

// ---------------------------------------------------------------------------
// A6 — the gate itself: a proof, not a wish
// ---------------------------------------------------------------------------

test('A6-GATE-NEEDS-A-PROOF: `evaluateNetworkRequirement` refuses deny without a measured proof and admits it with one; the historical unsupported row is unchanged', async () => {
  const world = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'bl42-gate' })
  try {
    const { network } = world.seams
    const refused = network.evaluateNetworkRequirement('deny', 'realm-x')
    assert.equal(refused.ok, false)
    assert.equal(refused.error.code, 'IO_POLICY_UNSUPPORTED')
    const emptyProof = network.evaluateNetworkRequirement('deny', 'realm-x', { mechanism: '', evidence: '', netNsInode: 1, hostNetNsInode: 2 })
    assert.equal(emptyProof.ok, false, 'empty strings are not a mechanism')
    const proved = network.evaluateNetworkRequirement('deny', 'realm-x', { mechanism: 'netns', evidence: 'evidence://x/1', netNsInode: 1, hostNetNsInode: 2 })
    assert.equal(proved.ok, true)
    assert.equal(network.evaluateNetworkRequirement(undefined, 'realm-x').ok, true)
    assert.equal(network.evaluateNetworkRequirement('restricted', 'realm-x').ok, false)
    const row = network.networkProbeRow(7, 'realm-x')
    assert.equal(row.level, 'unsupported')
    assert.equal(row.mechanism, null)
    assert.equal(row.evidence, null)
  } finally {
    await world.dispose()
  }
})
