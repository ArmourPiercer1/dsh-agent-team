/**
 * a5sf-env-capability.mjs — the ONE capability probe the `ute-vnext-a1` leg asks before it may claim
 * an OS-enforced guarantee.
 *
 * WHAT IT REUSES. The product already owns this probe and this file adds none of its own:
 * `packages/runtime/sandbox-provider/probe-abi.ts` exports `runAbiProbe`, `createLauncherDeps`,
 * `runAvailabilityPreflight`, `runEnforcementLeg` and `runNetworkLeg`, and the provider's
 * `probe()` is exactly those calls composed. The network question is answered by the PRODUCT'S
 * `runNetworkLeg` — the launcher's real `--net-leg` observation (a control child that must reach a
 * loopback listener, and a deny child that must land in a DISTINCT network namespace and fail tcp/udp
 * with a kernel errno while the listener counters do not move). Nothing here infers a network
 * capability from an ABI number: ABI bits are not a destination guarantee (PoC-4b).
 *
 * WHY THE LEG NEEDS IT. Five arms in the `ute-vnext-a1` leg ride the confined process lane with a
 * compiled `network: deny` axis:
 *
 *   OS-2 / OS-3   the confined payload controls, whose request carries `networkProfile: 'deny'`
 *   ADM-66        the in-lane `grep` positive (its confined subprocess face requests `deny`)
 *   SLICE-28      the same, in the FS slice
 *   ADM-70        the ladder ORDER arm, which counts the grep rung
 *
 * That axis is admitted ONLY when the provider's own probe reports `network-destination: enforced`.
 * A runner whose kernel/container refuses `unshare(CLONE_NEWUSER|CLONE_NEWNET)` (or cannot write the
 * uid/gid maps) answers `network-destination: unsupported`; the product then REFUSES every
 * `network: deny` spawn BEFORE any process exists (`IO_POLICY_UNSUPPORTED` /
 * `NETWORK_UNCONFINED_REALM`). On such a runner:
 *
 *   - the guarantee the arm names (the search actually ran / the kernel denied the read) is NOT
 *     proven, so the arm is ENV-LIMITED and does not count as a pass;
 *   - the product's FAIL-CLOSED behaviour IS provable, and each arm asserts it before it reports
 *     the limitation — an environment absence must never be silently skipped, and it must never be
 *     turned into a PASS either.
 *
 * HOSTED vs LOCAL. On a host that offers the capability (this worktree) the probe says
 * `NET-DENY-CONFIRMED` and the arms run their real controls. On the GitHub-hosted `ci-census`
 * runner the probe says `NO-ENFORCEMENT`/`MIXED-FAILED`, and the same arms report the limitation.
 *
 * FORCED ABSENCE — A DOCUMENTED PROBE OVERRIDE, NOT A FAKE ENVIRONMENT:
 *
 *   A5SF_FORCE_NETWORK_DENY_ABSENT=1
 *
 * forces the PROBE ANSWER to what an incapable runner answers. It does not remove the capability
 * from the kernel, does not stub the launcher and does not fabricate a provider: the wrapper injects
 * `deps.probeFacts` at the provider's own declared seam (the seam every existing provider test
 * already uses) and replaces ONLY the `net` verdict with a `NO-ENFORCEMENT` one, described as an
 * override in its own `raw`/`reason` fields. The ABI and the three enforcement legs stay REAL. It
 * exists so the capability-absent path can be exercised on a capable machine; its use is printed in
 * the probe line and in the evidence file.
 *
 * MACHINE-READABLE OUTPUT (stdout, stable prefixes, one record per arm):
 *
 *   A5SF-CAPABILITY network-deny=present|absent level=… code=… ripgrep=present|absent …
 *   UTE-VNEXT-A1-ENV-LIMITED arm=OS-2 disposition=FAIL-CLOSED-CONTROL code=… probe=…
 *   UTE-VNEXT-A1-ENV-BLOCK arm=ADM-66 code=… reason=…
 *   UTE-VNEXT-A1-ENV-LIMITED-SUMMARY count=N proven=0 blockers=… fail_closed=… arms=…
 *
 * @module tests/world-factory/lib/a5sf-env-capability
 */

import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SANDBOX_ENTRY = join(REPO_ROOT, 'packages/runtime/sandbox-provider/index.ts')
const LAUNCHER_PATH = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')

/** The documented probe override (see the module header). */
export const FORCE_ABSENT_ENV = 'A5SF_FORCE_NETWORK_DENY_ABSENT'
/** The stable code an absent network-deny capability carries everywhere it is reported. */
export const NETWORK_DENY_UNPROVEN = 'NETWORK_DENY_UNPROVEN'
/** The stable code for an absent packaged ripgrep provider (the other physical half of grep). */
export const RIPGREP_PROVIDER_UNAVAILABLE = 'RIPGREP_PROVIDER_UNAVAILABLE'

let sandboxModule
async function sandbox () {
  sandboxModule ??= await import(pathToFileURL(SANDBOX_ENTRY).href)
  return sandboxModule
}

/** True when the documented probe override is active. */
export function forcedNetworkDenyAbsent (env = process.env) {
  return env[FORCE_ABSENT_ENV] === '1'
}

// --------------------------------------------------------------- ripgrep provider

/**
 * The packaged ripgrep binary the confined subprocess face executes (`@vscode/ripgrep`), looked up
 * under the pnpm virtual store the face grants as its ONE additive executable exception. Returns
 * `{ present, path, note }`; a missing binary is reported, never assumed.
 */
export function probeRipgrepProvider () {
  const roots = [
    join(REPO_ROOT, 'tests/deepseek-harness-test-use/node_modules/.pnpm'),
    join(REPO_ROOT, 'node_modules/.pnpm'),
  ]
  for (const pnpmDir of roots) {
    if (!existsSync(pnpmDir)) continue
    let entries = []
    try {
      entries = readdirSync(pnpmDir)
    } catch {
      continue
    }
    for (const entry of entries.sort()) {
      if (!entry.startsWith('@vscode+ripgrep-')) continue
      const platform = entry.slice('@vscode+'.length).split('@')[0]
      // The platform package ships the binary at `bin/rg` today; older layouts put it at `rg`.
      for (const candidate of [
        join(pnpmDir, entry, 'node_modules', '@vscode', platform, 'bin', 'rg'),
        join(pnpmDir, entry, 'node_modules', '@vscode', platform, 'rg'),
      ]) {
        if (existsSync(candidate)) return Object.freeze({ present: true, path: candidate, note: `packaged ripgrep present at ${candidate}` })
      }
    }
  }
  return Object.freeze({
    present: false,
    path: null,
    note: 'the packaged ripgrep binary (@vscode/ripgrep-<platform>) is absent from both pnpm stores the confined face can reach; a confined grep cannot execute without it',
  })
}

// -------------------------------------------------------- the forced probe override

/** A `NO-ENFORCEMENT` net verdict that says, in its own words, that it is a probe override. */
function forcedAbsentVerdict (real) {
  const reason = `probe override ${FORCE_ABSENT_ENV}=1: the network-deny PROBE ANSWER is forced to absent so the capability-absent path can be exercised; no kernel capability was removed (real verdict would have been ${real?.verdict ?? 'not-observed'})`
  return Object.freeze({
    verdict: 'NO-ENFORCEMENT',
    mechanism: null,
    checks: Object.freeze([{ name: 'PROBE OVERRIDE', expect: 'NET-DENY-CONFIRMED', got: 'capability-absent (forced)', match: false }]),
    hostNetNsInode: null,
    denyNetNsInode: null,
    listener: Object.freeze({ portTcp: null, portUdp: null, acceptedTotal: null, datagramsTotal: null }),
    control: Object.freeze({ tcpOk: null, udpOk: null, accepted: null, datagrams: null, nonceMatched: null }),
    deny: Object.freeze({ tcpErrno: null, udpErrno: null, accepted: null, datagrams: null, reason }),
    raw: Object.freeze([reason]),
  })
}

/**
 * Build one provider EXACTLY as the product does, except that the documented override replaces the
 * `net` verdict at the provider's own `deps.probeFacts` seam. Without the override this is a thin
 * pass-through to `createConfinedProcessProvider` (no deps injected, production defaults untouched).
 */
export async function createConfinedProvider (options) {
  const api = await sandbox()
  if (!forcedNetworkDenyAbsent() || options?.deps !== undefined) return api.createConfinedProcessProvider(options)
  const pythonPath = options?.assembly?.pythonPath ?? process.env['A5P4_PYTHON'] ?? 'python3'
  const launcherPath = options?.assembly?.launcherPath ?? LAUNCHER_PATH
  const launcher = api.createLauncherDeps({ pythonPath, launcherPath })
  const deps = {
    availability: () => ({ rows: api.runAvailabilityPreflight({ pythonPath, launcherPath, runnerCommand: options?.runnerCommand ?? null }) }),
    run: launcher.run,
    probeFacts: () => {
      const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const abi = api.runAbiProbe(launcher)
      const legs = {}
      for (const leg of api.ENFORCEMENT_LEGS) legs[leg] = api.runEnforcementLeg(launcher, leg, join(options.scratchRoot, `probe-${stamp}`, leg))
      const real = api.runNetworkLeg(launcher, join(options.scratchRoot, `probe-${stamp}`, 'net'))
      return { abiVersion: abi.abiVersion, legs, net: forcedAbsentVerdict(real) }
    },
  }
  return api.createConfinedProcessProvider({ ...options, deps })
}

// ------------------------------------------------------------------ the capability

/**
 * Probe THIS host ONCE per process. The answer is the product's own:
 *   network-deny  `runNetworkLeg` verdict + the checks that failed (exact, not summarised away)
 *   ripgrep       the packaged binary the confined face is allowed to execute
 *
 * @returns {Promise<Readonly<{networkDeny: object, ripgrep: object, forced: boolean}>>}
 */
let capabilityPromise
export async function probeEnvCapabilities () {
  // ONE probe per process: `--test` runs each file in its own process, and a file may ask from a
  // `before` hook and from two arms. The answer cannot change inside one process (the kernel
  // capability and the packaged binary are process-lifetime facts).
  capabilityPromise ??= probeEnvCapabilitiesOnce()
  return capabilityPromise
}

async function probeEnvCapabilitiesOnce () {
  const forced = forcedNetworkDenyAbsent()
  const api = await sandbox()
  let net
  if (forced) {
    net = forcedAbsentVerdict(null)
  } else {
    const scratch = mkdtempSync(join(tmpdir(), 'a5sf-env-capability-'))
    const launcher = api.createLauncherDeps({ pythonPath: process.env['A5P4_PYTHON'] ?? 'python3', launcherPath: LAUNCHER_PATH })
    net = api.runNetworkLeg(launcher, join(scratch, 'net'))
  }
  const failed = (net.checks ?? []).filter((check) => check.match !== true)
  const networkDeny = Object.freeze({
    present: net.verdict === 'NET-DENY-CONFIRMED',
    verdict: net.verdict,
    level: net.verdict === 'NET-DENY-CONFIRMED' ? 'enforced' : 'unsupported',
    code: net.verdict === 'NET-DENY-CONFIRMED' ? 'NET_DENY_ENFORCED' : NETWORK_DENY_UNPROVEN,
    failed: Object.freeze(failed),
    detail: net.verdict === 'NET-DENY-CONFIRMED'
      ? `runNetworkLeg verdict=${net.verdict} mechanism=${String(net.mechanism)} netns=${String(net.denyNetNsInode)}/(host ${String(net.hostNetNsInode)})`
      : `runNetworkLeg verdict=${net.verdict}; ${failed.map((check) => `${check.name}: expected ${check.expect}, got ${check.got}`).join(' | ') || 'no checks recorded'}${net.deny?.reason === null || net.deny?.reason === undefined ? '' : `; deny reason: ${net.deny.reason}`}`,
    raw: net.raw ?? [],
  })
  const ripgrep = probeRipgrepProvider()
  return Object.freeze({ networkDeny, ripgrep, forced })
}

/** One stable line stating the probe's own answer. Printed once per test file. */
export function capabilityProbeLine (capability) {
  return [
    'A5SF-CAPABILITY',
    `network-deny=${capability.networkDeny.present ? 'present' : 'absent'}`,
    `level=${capability.networkDeny.level}`,
    `code=${capability.networkDeny.code}`,
    `ripgrep=${capability.ripgrep.present ? 'present' : 'absent'}`,
    ...(capability.ripgrep.path === null ? [] : [`ripgrep-path=${capability.ripgrep.path}`]),
    `forced=${capability.forced ? 'true' : 'false'}`,
    `detail=${JSON.stringify(capability.networkDeny.detail)}`,
  ].join(' ')
}

// ------------------------------------------------------ the ENV-LIMITED registry

const records = []
let summarised = false

function summarise () {
  if (summarised || records.length === 0) return
  summarised = true
  const blockers = records.filter((record) => record.disposition === 'ENV-BLOCK')
  const controls = records.filter((record) => record.disposition === 'FAIL-CLOSED-CONTROL')
  process.stdout.write(
    `UTE-VNEXT-A1-ENV-LIMITED-SUMMARY count=${String(records.length)} proven=0 ` +
      `blockers=${String(blockers.length)} fail_closed=${String(controls.length)} ` +
      `arms=${records.map((record) => `${record.arm}:${record.disposition}`).join(',')}\n`,
  )
}
process.once('exit', summarise)

/**
 * Record ONE environment-limited arm. Call AFTER the truthful fail-closed control (when there is
 * one) has been asserted, and call `t.skip` afterwards in the arm so the arm is never counted as a
 * pass: an environment absence is not a PASS.
 *
 * @param {object} input
 * @param {string} input.arm - the arm id (OS-2, ADM-66, SLICE-28, …).
 * @param {'ENV-BLOCK'|'FAIL-CLOSED-CONTROL'} input.disposition - which truthful branch this arm took.
 * @param {string} input.code - stable limitation code.
 * @param {string} input.probe - one-line exact probe result.
 * @param {string} [input.reason] - why the named guarantee is unproven on this host.
 */
export function envLimited ({ arm, disposition, code, probe, reason }) {
  if (records.some((record) => record.arm === arm)) return
  records.push(Object.freeze({ arm, disposition, code, probe, reason: reason ?? '' }))
  process.stdout.write(`UTE-VNEXT-A1-ENV-LIMITED arm=${arm} disposition=${disposition} code=${code} probe=${JSON.stringify(probe)}\n`)
  if (disposition === 'ENV-BLOCK') {
    process.stdout.write(`UTE-VNEXT-A1-ENV-BLOCK arm=${arm} code=${code} reason=${JSON.stringify(reason ?? probe)}\n`)
  }
}

/** The arms this process reported as environment-limited, in record order (for assertions/tests). */
export function envLimitedRecords () {
  return records.slice()
}
