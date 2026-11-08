#!/usr/bin/env node
/**
 * tests/world-factory/a5sf-pd26-mutation-controls.mjs — the mutation controls
 * for PD-26. A suite that cannot go red is not evidence, so each arm is driven
 * to its OWN red and the other arms are asserted to stay green.
 *
 *   CLEAN                        everything green
 *   M1  A5SF_PD26_SKILL_MODULE=<mutated module>
 *                                a copy of the Team `skill` module whose body
 *                                read is the BASE `fs` (a plain readFileSync)
 *                                instead of the confined Provider. The in-lane
 *                                arm still passes — which is exactly why the
 *                                mutation matters — and CONTRACT-SKILL's
 *                                out-of-lane clause MUST go red: "looks
 *                                restored" without the guard is the regression
 *                                this lane exists to prevent.
 *   M2  A5SF_PD26_COMPOSITION=<archived pre-fix composition>
 *                                SURFACE-RESTORED must go red (the pre-fix file
 *                                declares neither `skill` nor `present`), and
 *                                the PIN arm stays green because it reads the
 *                                SHIPPED composition by path, not this hook.
 *   PIN A5SF_PD26_PIN=1          the pre-fix commit is read out of git and both
 *                                names are the host router's typed
 *                                `unknown tool` there.
 *
 * Every arm is a real `node --test` child process; the verdict is its exit code
 * plus the NAMES of the failing tests, so a green CLEAN that hides a red M1
 * cannot happen. Writes `mutation-controls.log` and the two archived mutation
 * artefacts under the lane's evidence dir (deterministic generation: the
 * pre-fix composition is `git show BASE:cordis.patch.yml`, the mutated module
 * is the shipped source with ONE documented substitution).
 *
 * CORE PATCH BUDGET = 0. No boot, no port, no DSH_HOME, no git write.
 *
 * Run: node tests/world-factory/a5sf-pd26-mutation-controls.mjs
 *
 * @module tests/world-factory/a5sf-pd26-mutation-controls
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd26-confined-skill.test.mjs')
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd26-confined-skill')
const LOG = join(EVIDENCE, 'mutation-controls.log')
const ARCHIVE = join(EVIDENCE, 'archive')
const PRE_FIX = join(ARCHIVE, 'pre-fix', 'cordis.patch.yml')
const MUTATED_MODULE = join(ARCHIVE, 'mutations', 'confined-skill-tool.base-fs.mjs')
const BASE_COMMIT = '06adbf850'

// SUPERSEDED BY PD-29 (`PD29-SERVICE-SEAM`). This control mutates the PD-26
// tool fork; PD-29 deleted that fork, so on this tree the control cannot mean
// anything and must say so instead of mutating nothing. The live controls for
// the same two capabilities are `a5sf-pd29-mutation-controls.mjs` (M1 moves the
// realm's `skills` provider back onto the BASE `fs`; M2 mounts the pinned
// `present` module through the registration router again).
const PD26_FORK = join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-skill-tool.mjs')
if (!existsSync(PD26_FORK)) {
  const line = `SUPERSEDED by PD-29: ${PD26_FORK} no longer exists (the two Team tool forks were deleted); the live controls are tests/world-factory/a5sf-pd29-mutation-controls.mjs`
  // NOT written into PD-26's evidence (that lane's log is its own record).
  console.log(line)
  process.exit(0)
}

mkdirSync(dirname(PRE_FIX), { recursive: true })
mkdirSync(dirname(MUTATED_MODULE), { recursive: true })

// M2 artefact: the measured pre-fix composition, straight out of git.
const preFix = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
writeFileSync(PRE_FIX, preFix)

// M1 artefact: the shipped module with the confined read replaced by a BASE-fs
// read. The substitution is asserted, never best-effort: if the source drifts,
// this control refuses instead of silently mutating nothing.
const SOURCE = join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-skill-tool.mjs')
const original = readFileSync(SOURCE, 'utf8')
const CONFIDED_READ = `        // \`resolve\` is resolution-only and unguarded; \`readText\` is the
        // TARGET-BEARING call, and the confined Provider consults the compiled
        // lane there before any byte of the body is read.
        const target = await ctx.fs.resolve(entry.path, { cwd, signal: exec.signal })
        content = await ctx.fs.readText(target, exec.signal)`
const BASE_READ = `        // MUTATION (PD-26 control only): the BASE fs regression — no lane, no
        // guard consult, the body of ANY declared path is returned.
        content = readFileSync(entry.path, 'utf8')`
if (!original.includes(CONFIDED_READ)) {
  throw new Error(`PD-26 mutation control: the confined read block was not found in ${SOURCE}; refusing to run a control that mutates nothing`)
}
const mutated = original
  .replace("import { dirname } from 'node:path'", "import { readFileSync } from 'node:fs'\nimport { dirname } from 'node:path'")
  .replace(CONFIDED_READ, BASE_READ)
if (mutated === original || !mutated.includes('readFileSync(entry.path')) {
  throw new Error('PD-26 mutation control: the base-fs substitution did not apply; refusing')
}
writeFileSync(MUTATED_MODULE, mutated)

writeFileSync(LOG, `# PD-26 mutation controls — ${new Date().toISOString()}\n`)

function run(label, env) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 300_000,
  })
  const output = `${String(result.stdout ?? '')}${String(result.stderr ?? '')}`
  const strip = (line) => line.replace(/\s*\(\d+(?:\.\d+)?ms\)\s*$/u, '').replace(/^[✔✖]\s+/u, '').trim()
  const isTest = (name) => name.startsWith('PD26-')
  const failing = [...new Set([...output.matchAll(/^✖ (.+)$/gmu)].map((m) => strip(m[0])))].filter(isTest)
  const passing = [...new Set([...output.matchAll(/^✔ (.+)$/gmu)].map((m) => strip(m[0])))].filter(isTest)
  const passed = result.status === 0
  const line = `[${new Date().toISOString()}] ${label}: ${passed ? 'PASS' : 'FAIL'} (exit=${String(result.status)})`
    + ` passing=${JSON.stringify(passing)} failing=${JSON.stringify(failing)}`
  appendFileSync(LOG, `${line}\n`)
  // eslint-disable-next-line no-console
  console.log(line)
  return { label, passed, failing, passing, status: result.status }
}

if (!existsSync(PRE_FIX) || !existsSync(MUTATED_MODULE)) throw new Error('PD-26 mutation control: archived mutation artefacts were not written')

const clean = run('CLEAN', {})
const m1 = run('M1 skill module reads through the BASE fs', { A5SF_PD26_SKILL_MODULE: MUTATED_MODULE })
const m2 = run('M2 boot the archived PRE-FIX composition', { A5SF_PD26_COMPOSITION: PRE_FIX })
const pin = run('PIN read the pre-fix surface out of git', { A5SF_PD26_PIN: '1' })

const failures = []
const expect = (label, condition, detail) => {
  if (!condition) failures.push(`${label}: ${detail}`)
  appendFileSync(LOG, `[check] ${condition ? 'ok' : 'RED'} ${label} — ${detail}\n`)
  // eslint-disable-next-line no-console
  console.log(`${condition ? 'ok  ' : 'RED '} ${label} — ${detail}`)
}

expect('CLEAN is green', clean.passed, 'every arm green with no hook set')
expect(
  'M1 reddens the CONTRACT-SKILL deny clause',
  m1.passed === false && m1.failing.includes('PD26-CONTRACT-SKILL: an in-lane body is returned, an out-of-lane body is a typed denial with 0 bytes and 1 read'),
  `failing=${JSON.stringify(m1.failing)}`,
)
expect(
  'M1 reddens ONLY the confined-read arm',
  m1.failing.every((t) => t.startsWith('PD26-CONTRACT-SKILL')),
  `failing=${JSON.stringify(m1.failing)}`,
)
expect(
  'M1 leaves CONTRACT-PRESENT and SURFACE green',
  m1.passing.some((t) => t.startsWith('PD26-CONTRACT-PRESENT')) && m1.passing.some((t) => t.startsWith('PD26-SURFACE-RESTORED')),
  `passing=${JSON.stringify(m1.passing)}`,
)
expect(
  'M2 reddens the SURFACE arm only',
  m2.passed === false && m2.failing.length === 1 && m2.failing[0].startsWith('PD26-SURFACE-RESTORED'),
  `failing=${JSON.stringify(m2.failing)}`,
)
expect(
  'M2 leaves the PIN arm green',
  pin.passed && pin.passing.some((t) => t.startsWith('PD26-PIN')),
  `passing=${JSON.stringify(pin.passing)}`,
)

const verdict = failures.length === 0 ? 'PASS' : 'FAIL'
appendFileSync(LOG, `\nVERDICT ${verdict} (${String(6 - failures.length)}/6 checks)\n`)
// eslint-disable-next-line no-console
console.log(`\nVERDICT ${verdict}${failures.length === 0 ? '' : `\n${failures.join('\n')}`}`)
if (failures.length !== 0) process.exitCode = 1
