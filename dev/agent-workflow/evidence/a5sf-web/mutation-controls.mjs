#!/usr/bin/env node
/**
 * mutation-controls.mjs — each half of the BL-18 (P2-05) backend is pinned
 * INDEPENDENTLY load-bearing.
 *
 * A green arm set alone cannot prove which mechanism made it green (several
 * arms would pass if the pre-refusal, the delegation or the residual were dead
 * code). This control removes exactly ONE mechanism at a time from the REAL
 * source and requires the arm(s) that mechanism protects to go RED while every
 * other arm stays GREEN:
 *
 *   M1 (pre-refusal removed): the web face's `network: deny` leg stops throwing
 *      after the probe. Only the DENIAL arms must FAIL (DENY-*), while
 *      ADMIT/SHADOW/PROBE-LOAD-BEARING/UNCONFINED-REALM-MOUNT/PROBE-REUSE/
 *      ORDINARY-DSH-FETCH/COMPOSITION stay GREEN — the refusal is not what
 *      any of them measures.
 *
 *   M2 (delegation removed — the mock returns without the provider): the
 *      face's `fetch` answers a canned object instead of entering the provider.
 *      The ALLOW/effect arms must FAIL (ADMIT-ALLOW, SHADOW,
 *      PROBE-LOAD-BEARING, UNCHANGED-SHAPE: `boundary.fetches.length` is 0)
 *      while every DENIAL arm stays GREEN (it never reached the delegate line).
 *
 *   M3 (redirect/proxy residual removed): the ALLOW constituent stops carrying
 *      `WEB_NETWORK_RESIDUALS`. ONLY ADMIT-ALLOW's residual assertion may FAIL
 *      — the deny arms never claim a residual, and the mount/ordinary arms do
 *      not read it. This is the arm that would otherwise hide the unmediated
 *      dimensions behind a green suite.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of EVERY touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-web/mutation-controls.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const WEB = 'packages/runtime/team-services/src/web.ts'
const ARMS = 'tests/world-factory/a5sf-web.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = [
  'ADMIT-ALLOW',
  'SHADOW',
  'DENY-PRE-REFUSAL',
  'DENY-TYPED-CODE',
  'DENY-SEARCH-SECOND-PATH',
  'DENY-PROBE-ABSENT',
  'PROBE-LOAD-BEARING',
  'UNCONFINED-REALM-MOUNT',
  'PROBE-REUSE',
  'ORDINARY-DSH-FETCH',
  'UNCHANGED-SHAPE',
  'COMPOSITION',
]
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'M1-web-pre-refusal-removed',
    description: 'the confined web face stops refusing a `network: deny` lane after probing (the refusal becomes dead code)',
    edits: [
      {
        file: WEB,
        old: '    const capability = await probeNetworkDenial(provider)\n',
        new: '    const capability = await probeNetworkDenial(provider)\n    if (typeof capability === \'object\') return // MUTANT M1: deny lane admitted\n',
      },
    ],
    expect: {
      failed: ['DENY-PRE-REFUSAL', 'DENY-TYPED-CODE', 'DENY-SEARCH-SECOND-PATH', 'DENY-PROBE-ABSENT'],
    },
  },
  {
    id: 'M2-web-delegation-removed',
    description: 'the mock returns WITHOUT the provider being consulted (`fetch` answers a canned object)',
    edits: [
      {
        file: WEB,
        old: '      return provider.fetch(request, signal)\n',
        new: '      return { url: String(declaredUrlOf(request, \'fetch\')), statusCode: 200, body: { kind: \'text\', content: \'MUTANT-NO-PROVIDER\' }, truncated: false } // MUTANT M2\n',
      },
    ],
    expect: {
      // Every arm that asserts the PROVIDER was entered goes red: the canned
      // answer never reaches the fake boundary, so the byte-identity with the
      // ordinary path cannot hold either.
      failed: ['ADMIT-ALLOW', 'SHADOW', 'PROBE-LOAD-BEARING', 'UNCHANGED-SHAPE'],
    },
  },
  {
    id: 'M3-web-residual-removed',
    description: 'the ALLOW constituent stops carrying the redirect/proxy residual annotation',
    edits: [
      {
        file: WEB,
        old: '      await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)\n',
        new: '      await guard(WEB_FETCH_GUARD_METHOD, url) // MUTANT M3: residual dropped\n',
      },
    ],
    expect: {
      failed: ['ADMIT-ALLOW'],
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
    schema: 'a5sf-web/mutation-controls/1',
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
