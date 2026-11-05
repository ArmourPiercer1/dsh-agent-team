#!/usr/bin/env node
/**
 * a5sf-sub-contract mutations — ONE mutation control per contract property,
 * plus one for the real native module boundary.
 *
 * Each control makes a literal single-occurrence edit in the REAL product
 * source (`packages/runtime/team-services/src/subprocess.ts`), runs the SAME
 * suite, records exactly which arms red, restores the file in a `finally`, and
 * re-asserts the sha256 of the restored file. No control is a second
 * implementation and nothing is committed.
 *
 * EXPECTED-RED DISCIPLINE: every control declares its target arms. A control
 * that escapes its declaration is a FAIL. Two controls inevitably red MORE
 * than one arm because the mechanism they remove is shared by two arms of the
 * same property — those are declared here, as the FS lane declared M12:
 *
 *   M4 removes the WRITE axis from the write guard: it reds the write arm AND
 *      the chmod arm (both consult that one guard).
 *   M6 removes the absolute-program check: it reds the precedence arm AND the
 *      shipped-module arm (both rely on the bare `bash` refusal).
 *
 * Run: node dev/agent-workflow/evidence/a5sf-subprocess-face/mutations.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const TARGET = join(REPO, 'packages', 'runtime', 'team-services', 'src', 'subprocess.ts')
const SUITE = join(REPO, 'tests', 'world-factory', 'a5sf-sub-contract.test.mjs')

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Arms named by the suite title prefix; a mutation is scored by these only. */
const ARM_LABELS = [
  'P1-ARGV-ACCEPTED-BOUNDARY',
  'P1-ARGV-SHAPE-REJECTED',
  'P1-PRECEDENCE',
  'P2-CLASS-UNDECLARED',
  'P2-CLASS-DECLARED',
  'P2-SHELL-PROGRAM-NOT-IN-CLASS',
  'P2-NON-SHELL-PROGRAM-UNAFFECTED',
  'P3-PROBE-SHAPE',
  'P3-DENY-REFUSES-BEFORE-SPAWN',
  'P4-WRITE-AXIS-ATTRIBUTION',
  'P4-WRITE-CONTROL',
  'P4-CHMOD-WRITE-AXIS',
  'P5-ENV-SCRUB',
  'P5-PROXY-DIVERGENCE',
  'GEN-NATIVE-MODULE-BOUNDARY',
]

const MUTATIONS = [
  {
    id: 'M1-argv-shape-refusal-dropped',
    property: 'P1',
    old: "  if (spec.argv.length !== 3 || spec.argv[1] !== '-c' || typeof spec.argv[2] !== 'string' || spec.argv[2].trim() === '') {",
    new: '  if (false) {',
    expected: ['P1-ARGV-SHAPE-REJECTED'],
    why: 'the closed <program> -c <body> shape no longer refuses anything',
  },
  {
    id: 'M2-undeclared-class-treated-as-declared',
    property: 'P2',
    old: '  if (admission === undefined || admission.programs.length === 0) {',
    new: '  if (admission !== undefined && admission.programs.length === 0) {',
    expected: ['P2-CLASS-UNDECLARED'],
    why: 'the no-class branch is skipped, so the admission dereferences an absent class instead of returning SHELL_NOT_DECLARED',
  },
  {
    id: 'M3-network-refusal-dropped',
    property: 'P3',
    old: '          if (capability.level !== \'enforced\') {',
    new: '          if (false) {',
    expected: ['P3-DENY-REFUSES-BEFORE-SPAWN'],
    why: 'an unproven deny claim no longer refuses; the spawn request is built and the provider refuses it instead',
  },
  {
    id: 'M4-write-guard-reads-the-read-lane',
    property: 'P4',
    old: '    const lane: PathRuleSet = policy.write',
    new: '    const lane: PathRuleSet = policy.read',
    expected: ['P4-WRITE-AXIS-ATTRIBUTION', 'P4-CHMOD-WRITE-AXIS'],
    why: 'the write consult uses the READ lane, so a write the read axis allows is admitted (the mis-attribution bug class)',
  },
  {
    id: 'M5-proxy-overlay-added-to-the-confined-scrub',
    property: 'P5',
    old: '  return env\n}',
    new: "  return process.env.HTTP_PROXY === undefined ? env : { ...env, NODE_USE_ENV_PROXY: '1' }\n}",
    expected: ['P5-PROXY-DIVERGENCE'],
    why: "the confined scrub gains upstream's proxy flag whenever a proxy is published (the overlay effect)",
  },
  {
    id: 'M6-absolute-program-check-dropped',
    property: 'GEN/P1',
    old: '  if (!isAbsolute(program)) {',
    new: '  if (false) {',
    expected: ['P1-PRECEDENCE', 'GEN-NATIVE-MODULE-BOUNDARY'],
    why: 'a bare `bash` is no longer refused at argv[0], which is the shipped executor’s own shape',
  },
]

function runSuite() {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, A5SF_REQUIRE_PINNED_HOST: '1' },
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

const original = readFileSync(TARGET, 'utf8')
const originalSha = sha256(original)
let failures = 0

try {
  const baseline = runSuite()
  if (baseline.status !== 0 || baseline.red.length !== 0) {
    failures += 1
    console.log(`FAIL baseline: status=${baseline.status} red=${JSON.stringify(baseline.red)} expected=[]`)
  } else {
    console.log('PASS baseline: red=[] expected=[]')
  }

  for (const mutation of MUTATIONS) {
    const occurrences = original.split(mutation.old).length - 1
    if (occurrences !== 1) {
      failures += 1
      console.log(`FAIL ${mutation.id}: mutant anchor occurs ${occurrences} times (expected exactly 1)`)
      continue
    }
    writeFileSync(TARGET, original.replace(mutation.old, mutation.new), 'utf8')
    let measured
    try {
      measured = runSuite()
    } finally {
      writeFileSync(TARGET, original, 'utf8')
      assert.equal(sha256(readFileSync(TARGET, 'utf8')), originalSha, `${mutation.id}: the source was not restored byte-for-byte`)
    }
    const expected = [...mutation.expected].sort()
    const same = measured.red.length === expected.length && measured.red.every((label, index) => label === expected[index])
    if (same) {
      console.log(`PASS ${mutation.id}: red=${JSON.stringify(measured.red)} expected=${JSON.stringify(expected)}`)
    } else {
      failures += 1
      console.log(`FAIL ${mutation.id}: red=${JSON.stringify(measured.red)} expected=${JSON.stringify(expected)}`)
      const firstError = measured.output.split('\n').find((line) => /AssertionError|Error:|expected|actual/.test(line))
      if (firstError !== undefined) console.log(`       first: ${firstError.trim()}`)
    }
    console.log(`       ${mutation.why}`)
  }
} finally {
  writeFileSync(TARGET, original, 'utf8')
  assert.equal(sha256(readFileSync(TARGET, 'utf8')), originalSha, 'the source must be restored byte-for-byte')
}

console.log(failures === 0 ? 'MUTATION-CONTROLS-PASS' : `MUTATION-CONTROLS-FAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
