#!/usr/bin/env node
/**
 * mutation-controls.mjs — each half of the BL-17 (P2-04) backend is pinned
 * INDEPENDENTLY load-bearing.
 *
 * A green arm set alone cannot prove which mechanism made it green (several
 * arms would pass if the admission, the probe or the PTY refusal were dead
 * code). This control removes exactly ONE mechanism at a time from the REAL
 * source and requires the arm(s) that mechanism protects to go RED while every
 * other arm stays GREEN:
 *
 *   M1 (shell admission removed): `shellClassAdmissionRefusal` always returns
 *      "no refusal". ADMIT still passes (its declaration is not needed to
 *      spawn once admission is gone — that is the point), while NOT-DECLARED /
 *      PROGRAM-NOT-ADMITTED / INVOCATION-UNDECLARED / ARGV-SHAPE must FAIL. The
 *      lane consults, the write-only arms, the network arms and the PTY arms
 *      must stay GREEN: the admission is not what any of them measures.
 *
 *   M2 (network probe forced to claim enforcement): `probeNetworkDenial`
 *      returns `enforced` regardless of the measured rows. Only
 *      NETWORK-DENY-UNENFORCED must FAIL (it would now spawn under a deny
 *      claim this host cannot keep); NETWORK-DENY-ENFORCED still passes.
 *
 *   M3 (both PTY refusal branches dropped): the pre-mount `terminals` refusal
 *      and the deferred-injection refusal both become unreachable. Both PTY
 *      arms must FAIL; every admission/network/lane arm must stay GREEN.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of EVERY touched file is compared
 * before and after. A control that fails to produce the expected RED pattern
 * exits non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-bash/mutation-controls.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const SUBPROCESS = 'packages/runtime/team-services/src/subprocess.ts'
const MOUNT = 'packages/runtime/team-services/src/mount.ts'
const ARMS = 'tests/world-factory/a5sf-bash.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = [
  'ADMIT',
  'NOT-DECLARED',
  'PROGRAM-NOT-ADMITTED',
  'INVOCATION-UNDECLARED',
  'ARGV-SHAPE',
  'RG-UNCHANGED',
  'WRITABLE-PROGRAM',
  'WRITE-ONLY-READ',
  'WRITE-ONLY-WRITE',
  'WRITE-ONLY-WRITE-OUTSIDE',
  'CREATE-OUTSIDE',
  'CHMOD-OUTSIDE',
  'CREATE/CHMOD-INSIDE',
  'NETWORK-DENY-UNENFORCED',
  'NETWORK-DENY-ENFORCED',
  'NETWORK-ALLOW',
  'CAPABILITY-PROBE',
  'PTY-LEGACY-MOUNT',
  'PTY-LEGACY-DEFERRED',
  'PTY-FACE',
  'COMPOSITION',
]
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'M1-shell-admission-removed',
    description: 'the shell-class admission always answers "no refusal" (a shell is admitted on its argv alone)',
    edits: [
      { file: SUBPROCESS, old: '  if (!isShellClassSpawn(spec)) return undefined\n', new: '  if (!isShellClassSpawn(spec)) return undefined\n  if (isShellClassSpawn(spec)) return undefined // MUTANT M1: no shell-class admission\n' },
    ],
    expect: { failed: ['NOT-DECLARED', 'PROGRAM-NOT-ADMITTED', 'INVOCATION-UNDECLARED', 'ARGV-SHAPE'] },
  },
  {
    id: 'M2-network-probe-assumes-enforcement',
    description: 'the capability probe claims `network-destination: enforced` regardless of what the backend measured',
    edits: [
      {
        file: SUBPROCESS,
        old: '  const rows = probed.value\n',
        new: '  const rows = probed.value\n  return Object.freeze({ dimension: \'network-destination\' as const, level: \'enforced\' as const, note: \'MUTANT M2: enforcement assumed, not measured\', rows: Object.freeze([...rows]) })\n',
      },
    ],
    expect: { failed: ['NETWORK-DENY-UNENFORCED'] },
  },
  {
    id: 'M3-pty-refusal-dropped',
    description: 'both 旧代 PTY refusal branches are made unreachable (pre-mount + deferred)',
    edits: [
      { file: MOUNT, old: "        declaredInjectionsOf(mount.module).includes('terminals')\n", new: "        false && declaredInjectionsOf(mount.module).includes('terminals')\n" },
      { file: MOUNT, old: "          const deferredTerminal = descendants.filter((created) => 'terminals' in created.inject)\n", new: "          const deferredTerminal = descendants.filter((created) => false && 'terminals' in created.inject)\n" },
    ],
    expect: { failed: ['PTY-LEGACY-MOUNT', 'PTY-LEGACY-DEFERRED'] },
  },
]

/**
 * TAP parse: `ok N - TITLE` / `not ok N - TITLE`. The arm id is the LONGEST
 * known id the title starts with (the titles are `ID: sentence`, and one id
 * itself contains a colon-adjacent suffix, so a prefix match is the stable
 * reading).
 */
function armIdOf(title) {
  const text = String(title)
  const matches = ALL_ARMS.filter((arm) => text.startsWith(arm))
  if (matches.length === 0) return null
  return matches.sort((left, right) => right.length - left.length)[0]
}

function runArms() {
  const proc = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', ARMS],
    { cwd: ROOT, encoding: 'utf8', timeout: 600_000 },
  )
  const results = []
  for (const line of `${proc.stdout ?? ''}`.split('\n')) {
    const match = /^(not ok|ok)\s+\d+\s+-\s+(.+?)\s*$/u.exec(line)
    if (match === null) continue
    const id = armIdOf(match[2])
    if (id === null) throw new Error(`TAP line names no known arm: ${JSON.stringify(line)}`)
    results.push({ id, status: match[1] === 'ok' ? 'passed' : 'failed', title: match[2] })
  }
  if (results.length === 0) {
    throw new Error(`TAP produced no arm results (rc=${String(proc.status)}):\n${proc.stdout}\n${proc.stderr}`)
  }
  return { results, rc: proc.status }
}

const files = [...new Set(MUTANTS.flatMap((mutant) => mutant.edits.map((edit) => edit.file)))]
const originals = new Map()
for (const file of files) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  originals.set(file, { text, sha: sha(text) })
}
const outcomes = []
let controlFailed = false

try {
  for (const mutant of MUTANTS) {
    const touched = new Set()
    for (const edit of mutant.edits) {
      const current = readFileSync(join(ROOT, edit.file), 'utf8')
      if (current.split(edit.old).length - 1 !== 1) {
        throw new Error(`${mutant.id}: the anchor is not unique in ${edit.file}: ${JSON.stringify(edit.old)}`)
      }
      writeFileSync(join(ROOT, edit.file), current.replace(edit.old, edit.new), 'utf8')
      touched.add(edit.file)
    }
    const mutatedShas = Object.fromEntries([...touched].map((file) => [file, sha(readFileSync(join(ROOT, file), 'utf8'))]))
    let run
    try {
      run = runArms()
    } finally {
      for (const file of touched) writeFileSync(join(ROOT, file), originals.get(file).text, 'utf8')
    }
    const restoredShas = Object.fromEntries([...touched].map((file) => [file, sha(readFileSync(join(ROOT, file), 'utf8'))]))
    for (const file of touched) {
      if (restoredShas[file] !== originals.get(file).sha) throw new Error(`${mutant.id}: restore FAILED for ${file}`)
    }

    const observed = Object.fromEntries(run.results.map((result) => [result.id, result.status]))
    for (const arm of ALL_ARMS) {
      if (observed[arm] === undefined) throw new Error(`${mutant.id}: arm ${arm} produced no result`)
    }
    const expectPassed = others(mutant.expect.failed)
    const wronglyGreen = mutant.expect.failed.filter((arm) => observed[arm] !== 'failed')
    const wronglyRed = expectPassed.filter((arm) => observed[arm] !== 'passed')
    const ok = wronglyGreen.length === 0 && wronglyRed.length === 0
    if (!ok) controlFailed = true
    outcomes.push({
      mutant: mutant.id,
      description: mutant.description,
      mutatedFileSha256: mutatedShas,
      restoredFileSha256: restoredShas,
      armsExitCode: run.rc,
      observed,
      expected: { failed: mutant.expect.failed, passed: expectPassed },
      verdict: ok ? 'RED-AS-REQUIRED' : 'CONTROL-FAILED',
    })
    console.log(`\n${mutant.id}: ${ok ? 'RED-AS-REQUIRED' : 'CONTROL-FAILED'}`)
    console.log(`  obtained failures: ${JSON.stringify(run.results.filter((result) => result.status === 'failed').map((result) => result.id))}`)
    if (!ok) {
      console.log(`  wrongly green: ${JSON.stringify(wronglyGreen)}`)
      console.log(`  wrongly red:   ${JSON.stringify(wronglyRed)}`)
      if (wronglyRed.length > 0) {
        const details = run.results.filter((result) => wronglyRed.includes(result.id))
        for (const detail of details) console.log(`    ${detail.id}: ${detail.title}`)
      }
    }
  }
} finally {
  for (const [file, base] of originals) {
    writeFileSync(join(ROOT, file), base.text, 'utf8')
    const finalSha = sha(readFileSync(join(ROOT, file), 'utf8'))
    if (finalSha !== base.sha) {
      console.error(`FATAL: ${file} not restored (${finalSha} != ${base.sha})`)
      process.exitCode = 1
    }
  }
  writeFileSync(REPORT, `${JSON.stringify({
    schema: 'a5sf-bash/mutation-controls/1',
    generatedAt: new Date().toISOString(),
    armsFile: ARMS,
    sources: [...originals.keys()],
    originalSourceSha256: Object.fromEntries([...originals].map(([file, base]) => [file, base.sha])),
    control: controlFailed ? 'FAILED' : 'PASS',
    outcomes,
  }, null, 2)}\n`)
  console.log(`\nreport: ${REPORT}`)
  console.log(`control: ${controlFailed ? 'FAILED' : 'PASS'}`)
  if (controlFailed) process.exitCode = 1
}
