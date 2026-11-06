#!/usr/bin/env node
/**
 * pin.mjs — BL-42's three propositions, measured against a GIVEN launcher.
 *
 * The defect pin is a measurement, not a memory: the SAME driver is run against
 * (a) the launcher as it stood before BL-42 (`git show origin/master:...py`) and
 * (b) the launcher as it now ships. `pin-before.log` must show `unsupported` /
 * `IO_POLICY_UNSUPPORTED` / `prepared=no`, and `pin-after.log` must show
 * `NET-DENY-CONFIRMED` / `enforced` / the deny profile on the plan.
 *
 * The three propositions:
 *   1. MECHANISM   — does the launcher's own network leg confirm a deny?
 *                    (a `211` verdict; the pre-fix launcher has no such mode at
 *                    all, which is the point: there was nothing to report).
 *   2. PROBE       — what does the REAL provider's capability probe answer for
 *                    `network-destination`, and does an `enforced` answer carry
 *                    a mechanism + a realm-bound evidence row?
 *   3. ADMISSION   — does `evaluateNetworkRequirement('deny', realm, proof)`
 *                    admit the lane, and (if admitted) does `prepare()` put the
 *                    deny policy on the plan? `files` records the plan's policy
 *                    file and whether it says `network: deny`.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-bl42-netdeny/pin.mjs [--launcher PATH] [--json]
 * Exit:  0 on a complete measurement (whatever it says); 2 on an internal error.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const DIST = join(ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'sandbox-provider')
const SHIPPED_LAUNCHER = join(ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const PYTHON = existsSync('/usr/bin/python3') ? '/usr/bin/python3' : 'python3'

const argv = process.argv.slice(2)
const flag = (name) => {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}
const launcher = resolve(flag('--launcher') ?? SHIPPED_LAUNCHER)
const asJson = argv.includes('--json')

const out = {
  schema: 'a5sf-bl42-pin/1',
  at: new Date().toISOString(),
  launcher,
  launcherSha256: createHash('sha256').update(readFileSync(launcher)).digest('hex'),
  propositions: {},
}

const scratch = mkdtempSync(join(tmpdir(), 'a5sf-bl42-pin-'))
try {
  // ── 1. MECHANISM ─────────────────────────────────────────────────────────
  const leg = spawnSync(PYTHON, [launcher, '--net-leg', '--scratch', join(scratch, 'leg')], { encoding: 'utf8', timeout: 60_000 })
  const legLines = (leg.stdout ?? '').trim().split('\n').filter(Boolean)
  let legVerdict = null
  try {
    legVerdict = JSON.parse(legLines[legLines.length - 1] ?? 'null')
  } catch {
    legVerdict = null
  }
  out.propositions.mechanism = {
    rc: leg.status,
    modeSupported: legVerdict !== null && typeof legVerdict === 'object',
    verdict: legVerdict?.verdict ?? null,
    mechanism: legVerdict?.mechanism ?? null,
    netNsInode: legVerdict?.deny?.net?.net_ns_inode ?? null,
    hostNetNsInode: legVerdict?.deny?.net?.host_net_ns_inode ?? null,
    controlAccepted: legVerdict?.control?.accepted ?? null,
    controlNonceMatched: legVerdict?.control?.nonce_matched ?? null,
    denyAccepted: legVerdict?.deny?.accepted ?? null,
    denyTcpErrno: legVerdict?.deny?.tcp?.errno ?? null,
    denyUdpErrno: legVerdict?.deny?.udp?.errno ?? null,
    stderrTail: (leg.stderr ?? '').trim().split('\n').slice(-2).join(' | '),
  }

  // ── 2. PROBE ─────────────────────────────────────────────────────────────
  const providerModule = await import(pathToFileURL(join(DIST, 'provider.js')).href)
  const networkModule = await import(pathToFileURL(join(DIST, 'network.js')).href)
  const realmId = 'realm-bl42-pin'
  const provider = providerModule.createConfinedProcessProvider({
    realmId,
    trustRoot: `sha256:${out.launcherSha256.slice(0, 16)}#${launcher}`,
    scratchRoot: join(scratch, 'provider'),
    assembly: { launcherPath: launcher, launcherSha256: out.launcherSha256, minAbiVersion: 3 },
  })
  const probed = await provider.probe()
  const rows = probed.ok ? probed.value : []
  const row = rows.find((candidate) => candidate.dimension === 'network-destination') ?? null
  out.propositions.probe = {
    probeOk: probed.ok,
    probeError: probed.ok ? null : (probed.error?.code ?? 'unknown'),
    row: row === null ? null : {
      level: row.level,
      mechanism: row.mechanism ?? null,
      evidence: row.evidence ?? null,
      realmId: row.realmId ?? null,
      trustRoot: row.trustRoot ?? null,
      note: row.note ?? null,
    },
    // The proof is the SAME derivation the provider uses internally.
    proof: row !== null
      && row.level === 'enforced'
      && typeof row.mechanism === 'string' && row.mechanism.trim() !== ''
      && typeof row.evidence === 'string' && row.evidence.trim() !== ''
      && typeof out.propositions.mechanism.netNsInode === 'number'
      && typeof out.propositions.mechanism.hostNetNsInode === 'number'
      && out.propositions.mechanism.netNsInode !== out.propositions.mechanism.hostNetNsInode
      ? { mechanism: row.mechanism, evidence: row.evidence, netNsInode: out.propositions.mechanism.netNsInode, hostNetNsInode: out.propositions.mechanism.hostNetNsInode }
      : null,
  }

  // ── 3. ADMISSION + PLAN ──────────────────────────────────────────────────
  const gate = networkModule.evaluateNetworkRequirement('deny', realmId, out.propositions.probe.proof ?? undefined)
  const cwd = join(scratch, 'cwd')
  const inside = join(cwd, 'in-lane.txt')
  spawnSync('mkdir', ['-p', cwd])
  writeFileSync(inside, 'BL42-PIN\n', 'utf8')
  const request = {
    grantFingerprint: 'sha256:' + '0'.repeat(64),
    realmId,
    bindingId: 'bl42-pin',
    memberScope: 'bl42-pin-scope',
    argv: ['/bin/bash', '-c', 'printf BL42-PIN'],
    cwd,
    env: [],
    networkProfile: 'deny',
    allowPaths: [
      { path: cwd, accessBits: { readFile: true, readDir: true, writeFile: true, createFile: true } },
      { path: '/usr', accessBits: { execute: true, readFile: true, readDir: true } },
      { path: '/bin', accessBits: { execute: true, readFile: true, readDir: true } },
      { path: '/lib', accessBits: { execute: true, readFile: true, readDir: true } },
      { path: '/lib64', accessBits: { execute: true, readFile: true, readDir: true } },
    ],
  }
  const admission = {
    admitted: gate.ok,
    refusalCode: gate.ok ? null : (gate.error?.code ?? 'unknown'),
    refusalMessage: gate.ok ? null : (gate.error?.message ?? ''),
  }
  let plan = null
  if (gate.ok) {
    const prepared = await provider.prepare(request)
    if (prepared.ok) {
      const policyFile = prepared.value.policyPath ?? prepared.value.policyFile ?? null
      let policy = null
      if (typeof policyFile === 'string' && existsSync(policyFile)) {
        try {
          policy = JSON.parse(readFileSync(policyFile, 'utf8'))
        } catch {
          policy = null
        }
      }
      plan = {
        prepared: true,
        planId: prepared.value.planId ?? null,
        policyFile,
        policyNetwork: policy?.network ?? null,
        policyKeys: policy === null ? null : Object.keys(policy).sort(),
      }
      await provider.discard?.(prepared.value) ?? null
    } else {
      plan = { prepared: false, refusalCode: prepared.error?.code ?? 'unknown' }
    }
  } else {
    plan = { prepared: false, refusedBeforePrepare: true, processesStarted: 0 }
  }
  out.propositions.admission = { ...admission, plan }
} catch (error) {
  out.error = { message: String(error?.message ?? error), stack: String(error?.stack ?? '') }
  process.exitCode = 2
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

const text = JSON.stringify(out, null, 2)
if (asJson) {
  process.stdout.write(`${text}\n`)
} else {
  const m = out.propositions.mechanism ?? {}
  const p = out.propositions.probe ?? {}
  const a = out.propositions.admission ?? {}
  process.stdout.write([
    `A5SF-BL42-PIN schema=a5sf-bl42-pin/1`,
    `launcher=${out.launcher}`,
    `launcherSha256=${out.launcherSha256}`,
    `MECHANISM mode-supported=${String(m.modeSupported)} verdict=${String(m.verdict)} mechanism=${String(m.mechanism)}`,
    `MECHANISM control-accepted=${String(m.controlAccepted)} nonce-matched=${String(m.controlNonceMatched)} deny-accepted=${String(m.denyAccepted)} tcp=${String(m.denyTcpErrno)} udp=${String(m.denyUdpErrno)}`,
    `MECHANISM netns=${String(m.netNsInode)} host=${String(m.hostNetNsInode)}`,
    `PROBE level=${String(p.row?.level ?? null)} mechanism=${String(p.row?.mechanism ?? null)} evidence=${String(p.row?.evidence ?? null)} proof=${p.proof === null ? 'null' : 'present'}`,
    `PROBE realm=${String(p.row?.realmId ?? null)} trustRoot=${String(p.row?.trustRoot ?? null)}`,
    `ADMISSION admitted=${String(a.admitted)} refusal=${String(a.refusalCode ?? null)}`,
    `PLAN prepared=${String(a.plan?.prepared ?? false)} policy-network=${String(a.plan?.policyNetwork ?? null)} processes-started=${String(a.plan?.processesStarted ?? 0)}`,
    `verdict=${out.error === undefined ? 'MEASURED' : 'ERROR'}`,
  ].join('\n') + '\n')
}
if (out.error !== undefined) process.stderr.write(`${text}\n`)
