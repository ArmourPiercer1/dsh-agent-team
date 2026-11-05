#!/usr/bin/env node
/**
 * a5sf-pty-contract mutations — ONE control per contract property (plus the
 * deferred-refusal site, which is the second half of P4).
 *
 * TWO KINDS OF CONTROL, and the distinction is load-bearing:
 *
 *   SOURCE controls edit the REAL PRODUCT source in-process
 *   (`packages/runtime/team-sandbox/src/terminal.ts`,
 *   `packages/runtime/team-services/src/mount.ts`), run the SAME suite, record
 *   which arms red, restore the file in a `finally`, and re-assert its sha256.
 *   CORE PATCH BUDGET = 0 holds: nothing is committed and both files are
 *   byte-identical afterwards (`git diff -- packages/` is empty).
 *
 *   INSTRUMENT controls run the same suite with `A5SF_PTY_CONTRACT_CONTROL`,
 *   which makes the INJECTED PTY PORT (the recorder the real pinned
 *   `TerminalSessionService` is driven with) misreport. No control writes to
 *   `tests/deepseek-harness-test-use` — the pinned tree is never modified or
 *   copied, so an upstream regression cannot be simulated by editing it; the
 *   only legal place to break the port's report is the port. These controls
 *   therefore prove the UPSTREAM-half arms read the port boundary (where a real
 *   backend's exit status / write routing arrives) rather than the fixture's own
 *   summary.
 *
 * EXPECTED-RED DISCIPLINE: every control declares its target arms; escaping the
 * declaration is a FAIL. Declared multi-arm controls (they remove one shared
 * mechanism):
 *
 *   M1  removes the existing-domain lookup used by BOTH the reuse arm and the
 *       replace-on-tighten arm.
 *   M2  removes the "this domain does not exist" refusal, which BOTH the
 *       no-command-after-kill arm and the reap arm read: after revoke the
 *       registry DELETES the domain (it does not merely flag it), so "the
 *       terminal is gone" is the one mechanism behind both assertions.
 *   M5 and M5b are the two SITES of one property: the pre-mount site reds the
 *       declared-shape arm only (the deferred shape is refused later, by M5b's
 *       site), and M5b reds the deferred arm only.
 *   INSTRUMENT-host-close-twice reds the host lifecycle arm AND the host reap
 *       arm: both assert "exactly one close per session".
 *
 * Run: node dev/agent-workflow/evidence/a5sf-pty-face/mutations.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const SUITE = join(REPO, 'tests', 'world-factory', 'a5sf-pty-contract.test.mjs')

const REGISTRY = join(REPO, 'packages', 'runtime', 'team-sandbox', 'src', 'terminal.ts')
const MOUNT = join(REPO, 'packages', 'runtime', 'team-services', 'src', 'mount.ts')

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Arms named by the suite title prefix; a mutation is scored by these only. */
const ARM_LABELS = [
  'P1-ONE-ALLOCATE-PER-SESSION',
  'P1-NO-COMMAND-AFTER-KILL',
  'P1-REVOKE-WITHOUT-DOMAIN-IS-NOT-STICKY',
  'P1-HOST-SESSION-LIFECYCLE',
  'P2-REGISTRY-COLLAPSES-EXIT-OUTCOMES',
  'P2-HOST-DISTINGUISHES-OUTCOMES',
  'P3-REGISTRY-REAP',
  'P3-HOST-REAP',
  'P4-REFUSED-BEFORE-ALLOCATION',
  'P4-DEFERRED-REFUSAL-IS-POST-ALLOCATION',
  'P4-CONTROL-INERT-MODULE-MOUNTS',
  'P5-TWO-BINDINGS-IDENTITY',
  'P5-KILL-ONE-NOT-THE-OTHER',
  'P5-HOST-TWO-SESSIONS-FENCED',
]

const SOURCE_MUTATIONS = [
  {
    id: 'M1-existing-domain-lookup-dropped',
    property: 'P1',
    file: REGISTRY,
    old: '    const existing = domains.get(key)',
    new: '    const existing: TerminalDomain | undefined = undefined',
    expected: ['P1-ONE-ALLOCATE-PER-SESSION', 'P5-KILL-ONE-NOT-THE-OTHER'],
    why: 'the reuse path never finds the live domain: a repeat acquire allocates a second PTY (and the replace-on-tighten arm loses its kill)',
  },
  {
    id: 'M2-killed-domain-accepts-a-command',
    property: 'P1',
    file: REGISTRY,
    old: "      if (domain === undefined) {\n        return Object.freeze({ ok: false, code: 'DOMAIN_REVOKED' as const, detail: `domain '${domainId}' does not exist (terminated or never created)` })\n      }",
    new: '      if (domain === undefined) {\n        return Object.freeze({ ok: true as const, revision: domainId })\n      }',
    expected: ['P1-NO-COMMAND-AFTER-KILL', 'P3-REGISTRY-REAP'],
    why: 'a command addressed to a KILLED terminal is admitted (the removed domain no longer refuses), so "no write after kill" is violated',
  },
  {
    id: 'M3-kill-error-propagated',
    property: 'P2',
    file: REGISTRY,
    old: '    } catch {\n      // A shell that already died is still a closed domain.\n    }',
    new: '    } catch (error) {\n      throw error\n    }',
    expected: ['P2-REGISTRY-COLLAPSES-EXIT-OUTCOMES'],
    why: 'the swallowed kill error surfaces, so the already-dead and dead-group fates reject shutdown instead of collapsing into killed:true',
  },
  {
    id: 'M4-shutdown-keeps-the-dead-domain',
    property: 'P3',
    file: REGISTRY,
    old: "        await killDomain(domain, 'shutdown')\n        domains.delete(keyOf(domain.owner))",
    new: "        await killDomain(domain, 'shutdown')\n        void 0",
    expected: ['P3-REGISTRY-REAP'],
    why: 'shutdown retains the domain, so a second shutdown re-kills the port (two kills for one terminal)',
  },
  {
    id: 'M5-pre-mount-terminal-refusal-dropped',
    property: 'P4',
    file: MOUNT,
    old: '        if (!targetsLegacyPtyRealm(mount)) continue',
    new: '        if (true) continue',
    expected: ['P4-REFUSED-BEFORE-ALLOCATION'],
    why: 'the declared-inject terminals loop is skipped, so the module mounts instead of being refused (the deferred shape is refused by its own later site)',
  },
  {
    id: 'M5b-deferred-terminal-refusal-dropped',
    property: 'P4',
    file: MOUNT,
    old: '          if (deferredTerminal.length > 0) {',
    new: '          if (false) {',
    expected: ['P4-DEFERRED-REFUSAL-IS-POST-ALLOCATION'],
    why: 'the deferred-injection site stops refusing, so the post-allocation window is no longer detected (the declared shape stays refused)',
  },
  {
    id: 'M6-shutdown-receipt-misattributes-the-pid',
    property: 'P5',
    file: REGISTRY,
    old: '          pid: domain.pid,',
    new: '          pid: domains.values().next().value?.pid ?? domain.pid,',
    expected: ['P5-TWO-BINDINGS-IDENTITY'],
    why: "every receipt row carries the FIRST domain's pid — the mis-attribution the concurrency arm must catch",
  },
]

const INSTRUMENT_MUTATIONS = [
  {
    id: 'I1-host-port-closes-twice',
    property: 'P1/P3',
    control: 'host-close-twice',
    expected: ['P1-HOST-SESSION-LIFECYCLE', 'P3-HOST-REAP'],
    why: 'the injected port reports two closes per session, so "one close per terminal" is violated at the boundary the arms measure',
  },
  {
    id: 'I2-host-port-collapses-exit-status',
    property: 'P2',
    control: 'host-collapse-exit',
    expected: ['P2-HOST-DISTINGUISHES-OUTCOMES'],
    why: 'the port reports exitCode 0 for every fate, so the service can no longer propagate an exit code vs a signal',
  },
  {
    id: 'I3-host-port-crosses-writes',
    property: 'P5',
    control: 'host-cross-writes',
    expected: ['P5-HOST-TWO-SESSIONS-FENCED'],
    why: "the port attributes each write/read to the other session — the crossing the concurrency arm must catch",
  },
]

const originals = new Map()
for (const file of new Set(SOURCE_MUTATIONS.map((mutation) => mutation.file))) {
  const text = readFileSync(file, 'utf8')
  originals.set(file, { text, sha: sha256(text) })
}

function restoreAll() {
  for (const [file, original] of originals) {
    writeFileSync(file, original.text, 'utf8')
    assert.equal(sha256(readFileSync(file, 'utf8')), original.sha, `${file} was not restored byte-for-byte`)
  }
}

function runSuite(control) {
  const env = { ...process.env, A5SF_REQUIRE_PINNED_HOST: '1' }
  if (control === undefined) delete env.A5SF_PTY_CONTRACT_CONTROL
  else env.A5SF_PTY_CONTRACT_CONTROL = control
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env,
    timeout: 180_000,
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const red = []
  for (const line of output.split('\n')) {
    if (!line.startsWith('not ok ')) continue
    for (const label of ARM_LABELS) {
      if (line.includes(label) && !red.includes(label)) red.push(label)
    }
  }
  return { status: result.status, output, red: red.sort() }
}

function score(id, measured, expected, why) {
  const sorted = [...expected].sort()
  const same = measured.red.length === sorted.length && measured.red.every((label, index) => label === sorted[index])
  if (same) {
    console.log(`PASS ${id}: red=${JSON.stringify(measured.red)} expected=${JSON.stringify(sorted)}`)
  } else {
    console.log(`FAIL ${id}: red=${JSON.stringify(measured.red)} expected=${JSON.stringify(sorted)}`)
    const firstError = measured.output.split('\n').find((line) => /AssertionError|Error:|expected|actual/.test(line))
    if (firstError !== undefined) console.log(`       first: ${firstError.trim()}`)
  }
  console.log(`       ${why}`)
  return same
}

let failures = 0

try {
  const baseline = runSuite(undefined)
  if (baseline.status !== 0 || baseline.red.length !== 0) {
    failures += 1
    console.log(`FAIL baseline: status=${baseline.status} red=${JSON.stringify(baseline.red)} expected=[]`)
  } else {
    console.log('PASS baseline: red=[] expected=[]')
  }

  for (const mutation of SOURCE_MUTATIONS) {
    const original = originals.get(mutation.file)
    const occurrences = original.text.split(mutation.old).length - 1
    if (occurrences !== 1) {
      failures += 1
      console.log(`FAIL ${mutation.id}: mutant anchor occurs ${occurrences} times (expected exactly 1)`)
      continue
    }
    writeFileSync(mutation.file, original.text.replace(mutation.old, mutation.new), 'utf8')
    let measured
    try {
      measured = runSuite(undefined)
    } finally {
      restoreAll()
    }
    if (!score(mutation.id, measured, mutation.expected, mutation.why)) failures += 1
  }

  for (const mutation of INSTRUMENT_MUTATIONS) {
    const measured = runSuite(mutation.control)
    if (!score(mutation.id, measured, mutation.expected, mutation.why)) failures += 1
  }
} finally {
  restoreAll()
}

console.log(failures === 0 ? 'MUTATION-CONTROLS-PASS' : `MUTATION-CONTROLS-FAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
