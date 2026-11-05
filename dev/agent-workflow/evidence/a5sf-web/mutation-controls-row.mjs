#!/usr/bin/env node
/**
 * mutation-controls-row.mjs — each HALF of the BL-18 live-half unblock (the
 * realm row's confined `web` face) is pinned INDEPENDENTLY load-bearing.
 *
 * A green arm set alone cannot prove which mechanism made it green. This control
 * removes exactly ONE mechanism at a time from the REAL source and requires the
 * arm(s) that mechanism protects to go RED while every other arm stays GREEN:
 *
 *   M1 (composition-time presence check removed): `assertConfinedWebFace`
 *      returns its input unchecked. A DECLARED web face without a provider is
 *      then forwarded as-is; the backend's own constructor throws a plain
 *      `TypeError` instead of the typed `NETWORK_UNCONFINED_REALM`. The ABSENCE
 *      arms must FAIL (ROW-ABSENCE-TYPED, ROW-CONFIG-ABSENCE) while every arm
 *      that mounts a complete face, the DENY/ALLOW lanes and the default path
 *      stay GREEN — the check is not what any of them measures.
 *
 *   M2 (web face guard bypassed): `createWebNetworkGuard` returns before it
 *      reads `effective.network.access`. ONLY the lane-mounted DENY arms must
 *      FAIL (ROW-DENY, ROW-CONFIG-FACE — both refuse through that ONE guard)
 *      while the ALLOW/PRODUCT-DECLARATION arms, the absence arms and the
 *      faceless default path stay GREEN. This is the mutation that would
 *      otherwise let a mounted face be an admission decoration.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of EVERY touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-web/mutation-controls-row.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const ROW = 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs'
const WEB = 'packages/runtime/team-services/src/web.ts'
const ARMS = 'tests/world-factory/a5sf-web-row.test.mjs'
const REPORT = join(HERE, 'mutation-controls-row.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = [
  'ROW-FACE-FORWARDED',
  'ROW-DENY',
  'ROW-ALLOW',
  'ROW-ABSENCE-TYPED',
  'ROW-CONFIG-FACE',
  'ROW-CONFIG-ABSENCE',
  'ROW-AMBIGUOUS',
  'ROW-NO-FACE',
  'ROW-PRODUCT-DECLARATION',
  'ROW-NO-SECOND-COMPILER',
]
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'M1-row-web-presence-check-removed',
    description: 'the composition-time presence check accepts a declared web face with no provider (the fail-closed check becomes dead code)',
    edits: [
      {
        file: ROW,
        old: 'function assertConfinedWebFace(web, where) {\n',
        new: 'function assertConfinedWebFace(web, where) {\n  return web // MUTANT M1: presence check removed\n',
      },
    ],
    expect: {
      failed: ['ROW-ABSENCE-TYPED', 'ROW-CONFIG-ABSENCE'],
    },
  },
  {
    id: 'M2-web-guard-bypassed',
    description: 'the confined web face stops consulting the compiled network lane (the guard becomes an unconditional admission)',
    edits: [
      {
        file: WEB,
        old: "    if (effective.network.access !== 'deny') return\n",
        new: '    return // MUTANT M2: web network guard bypassed\n',
      },
    ],
    expect: {
      failed: ['ROW-DENY', 'ROW-CONFIG-FACE'],
    },
  },
]

/**
 * TAP parse: `ok N - TITLE` / `not ok N - TITLE`. The arm id is the LONGEST
 * known id the title starts with (the titles are `ID: sentence`).
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
    schema: 'a5sf-web/mutation-controls-row/1',
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
