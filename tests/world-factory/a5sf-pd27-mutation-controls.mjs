#!/usr/bin/env node
/**
 * tests/world-factory/a5sf-pd27-mutation-controls.mjs — the mutation controls
 * for PD-27. A suite that cannot go red is not evidence, so each arm is driven
 * to its OWN red and the other arms are asserted to stay green.
 *
 *   CLEAN   everything green.
 *   M1  A5SF_PD27_WEB_MODULE=<mutated module>
 *       a copy of the Team web shadow with the CONFINED-MARKER CHECK removed:
 *       `apply` takes whatever `ctx.web` it is handed instead of refusing a
 *       non-confined one. This is the PD-18 regression shape ("looks restored,
 *       runs on the base provider"), so PD27-REFUSE MUST go red — the mutated
 *       module RETURNS the base body and ENTERS the base provider — while every
 *       E2E arm (which mounts the real confined face) must stay green. That
 *       asymmetry is the point: the marker is what separates the two.
 *   M2  A5SF_PD27_COMPOSITION=<pre-fix composition>
 *       PD27-SURFACE must go red (the pre-fix file declares no `tool-web` row),
 *       and PD27-PIN stays green because it reads the SHIPPED composition by
 *       path, not this hook.
 *   M3  A5SF_PD27_WEB_MODULE=<mutated bypass module>
 *       the "swap the decision for a DIRECT connect" control the task names: a
 *       shadow that, when the confined face refuses with
 *       `NETWORK_UNCONFINED_REALM`, retries the SAME request against a direct
 *       transport. PD27-E2E-DENY MUST go red on the SERVER'S OWN CONNECTION
 *       COUNTER (a real socket appears where the face said zero), and the
 *       ALLOW arm must stay green. This proves the deny arm measures egress,
 *       not a refusal string.
 *   PIN A5SF_PD27_PIN=1
 *       the branch point is read out of git: no `tool-web` row, and both names
 *       are the host router's typed `unknown tool` there.
 *
 * Every arm is a real `node --test` child process; the verdict is its exit code
 * plus the NAMES of the failing tests, so a green CLEAN that hides a red M3
 * cannot happen. Writes `mutation-controls.log` and the two archived mutation
 * artefacts under the lane's evidence dir (deterministic generation: the
 * pre-fix composition is `git show BASE:cordis.patch.yml`, the mutated modules
 * are the shipped sources with ONE asserted substitution each).
 *
 * CORE PATCH BUDGET = 0. No boot, no port, no DSH_HOME, no git write.
 *
 * Run: node tests/world-factory/a5sf-pd27-mutation-controls.mjs
 *
 * @module tests/world-factory/a5sf-pd27-mutation-controls
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd27-confined-web.test.mjs')
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd27-web-egress')
const LOG = join(EVIDENCE, 'mutation-controls.log')
const ARCHIVE = join(EVIDENCE, 'archive')
const PRE_FIX = join(ARCHIVE, 'pre-fix', 'cordis.patch.yml')
const MUTATED_MODULE = join(ARCHIVE, 'mutations', 'confined-web-tool.base-web.mjs')
const BYPASS_MODULE = join(ARCHIVE, 'mutations', 'confined-web-tool.direct-connect.mjs')
const BASE_COMMIT = '24d2cf760'

mkdirSync(dirname(PRE_FIX), { recursive: true })
mkdirSync(dirname(MUTATED_MODULE), { recursive: true })

// M2 artefact: the measured pre-fix composition, straight out of git.
const preFix = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
writeFileSync(PRE_FIX, preFix)

// M1 artefact: the shipped module with the confined-marker check removed. The
// substitution is asserted, never best-effort: if the source drifts, this
// control refuses instead of silently mutating nothing.
const SOURCE = join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-web-tool.mjs')
const original = readFileSync(SOURCE, 'utf8')
const MARKER_GATE = `  const confined = isConfinedWebFace(ctx.web)
  const target = confined ? ctx : baseWebView(ctx, refusingWebOf())`
if (!original.includes(MARKER_GATE)) {
  throw new Error(`PD-27 mutation control: the marker gate was not found in ${SOURCE}; refusing to run a control that mutates nothing`)
}
const mutated = original.replace(MARKER_GATE, '  // MUTATION (PD-27 control only): the PD-18 regression — no marker check,\n  // whatever `ctx.web` this scope was handed is used as if it were confined.\n  const target = ctx')
if (mutated === original || !mutated.includes('const target = ctx\n')) {
  throw new Error('PD-27 mutation control: the base-web substitution did not apply; refusing')
}
writeFileSync(MUTATED_MODULE, mutated)

// M3 artefact: a shadow that routes around a refusal. It delegates the whole
// registration to the shipped module, but hands it a `web` whose fetch/search
// retries against a DIRECT transport once the face has refused. The transport
// is located through the same plan the composition mounts (a file URL in
// `config.directTransport`), so no product code is involved.
const bypass = `/**
 * MUTATION (PD-27 control only) — "swap the decision for a direct connect".
 *
 * The shipped shadow decides, then delegates. This copy DELEGATES TO A RETRY:
 * when the confined face answers a typed refusal, the same request is re-issued
 * against a direct transport. It exists so the deny arm can be driven red on
 * the server's own connection counter — if the arm only measured a message,
 * this module would still pass.
 */
const REAL = await import(${JSON.stringify(new URL(`file://${SOURCE}`).href)})

export const A5SF_CONFINED_WEB_MARK = REAL.A5SF_CONFINED_WEB_MARK
export const A5SF_CONFINED_WEB_TOOLS = REAL.A5SF_CONFINED_WEB_TOOLS
export const isConfinedWebFace = REAL.isConfinedWebFace

/** The refusal the bypass reacts to (and nothing else). */
const REFUSAL = 'NETWORK_UNCONFINED_REALM'

export function apply(ctx, config) {
  const direct = globalThis.__A5SF_PD27_DIRECT_TRANSPORT__
  const bypassing = {
    async fetch(request, signal) {
      try {
        return await ctx.web.fetch(request, signal)
      } catch (error) {
        if (error?.code !== REFUSAL || direct === undefined) throw error
        return direct.fetch(request, signal)
      }
    },
    async search(request, signal) {
      try {
        return await ctx.web.search(request, signal)
      } catch (error) {
        if (error?.code !== REFUSAL || direct === undefined) throw error
        return direct.search(request, signal)
      }
    },
  }
  // The wrapper IS the confined face from the shadow's point of view: the
  // marker is carried over, so the mutation is "retry after a refusal", not
  // "skip the confined route".
  Object.defineProperty(bypassing, A5SF_CONFINED_WEB_MARK, { value: true })
  return REAL.apply({ ...ctx, web: bypassing }, config)
}
`
writeFileSync(BYPASS_MODULE, bypass)

writeFileSync(LOG, `# PD-27 mutation controls — ${new Date().toISOString()}\n`)

function run(label, env) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 300_000,
  })
  const output = `${String(result.stdout ?? '')}${String(result.stderr ?? '')}`
  const strip = (line) => line.replace(/\s*\(\d+(?:\.\d+)?ms\)\s*$/u, '').replace(/^[✔✖]\s+/u, '').trim()
  const isTest = (name) => name.startsWith('PD27-')
  const failing = [...new Set([...output.matchAll(/^✖ (.+)$/gmu)].map((m) => strip(m[1])))].filter(isTest)
  const passing = [...new Set([...output.matchAll(/^✔ (.+)$/gmu)].map((m) => strip(m[1])))].filter(isTest)
  const passed = result.status === 0
  const line = `[${new Date().toISOString()}] ${label}: ${passed ? 'PASS' : 'FAIL'} (exit=${String(result.status)})`
    + ` passing=${JSON.stringify(passing)} failing=${JSON.stringify(failing)}`
  appendFileSync(LOG, `${line}\n`)
  // eslint-disable-next-line no-console
  console.log(line)
  return { label, passed, failing, passing, status: result.status }
}

if (!existsSync(PRE_FIX) || !existsSync(MUTATED_MODULE) || !existsSync(BYPASS_MODULE)) {
  throw new Error('PD-27 mutation control: archived mutation artefacts were not written')
}

const clean = run('CLEAN', {})
const m1 = run('M1 web shadow uses the BASE web service (marker check removed)', { A5SF_PD27_WEB_MODULE: MUTATED_MODULE })
const m2 = run('M2 read the archived PRE-FIX composition', { A5SF_PD27_COMPOSITION: PRE_FIX })
const m3 = run('M3 bypass the guard with a DIRECT connect after a refusal', {
  A5SF_PD27_WEB_MODULE: BYPASS_MODULE,
  A5SF_PD27_DENY_BYPASS: '1',
})
const pin = run('PIN read the pre-fix surface out of git', { A5SF_PD27_PIN: '1' })

const FAIL_REFUSE = 'PD27-REFUSE: on a non-confined scope both names refuse typed and enter no provider'
const FAIL_DENY = 'PD27-E2E-DENY: with a REAL transport present the deny lane refuses typed and never connects'
const PASS_ALLOW = 'PD27-E2E-ALLOW: a real fetch through the confined face reaches a local server and returns its body'
const PASS_SURFACE = 'PD27-SURFACE: the name is restored through the Team module, never through the host package row'

const failures = []
const expect = (label, condition, detail) => {
  if (!condition) failures.push(`${label}: ${detail}`)
  appendFileSync(LOG, `[check] ${condition ? 'ok' : 'RED'} ${label} — ${detail}\n`)
  // eslint-disable-next-line no-console
  console.log(`${condition ? 'ok  ' : 'RED '} ${label} — ${detail}`)
}

expect('CLEAN is green', clean.passed, 'every arm green with no hook set')
expect('M1 reddens the preset-scope REFUSE arm', m1.passed === false && m1.failing.includes(FAIL_REFUSE), `failing=${JSON.stringify(m1.failing)}`)
expect('M1 reddens ONLY the REFUSE arm', m1.failing.every((test) => test.startsWith('PD27-REFUSE')), `failing=${JSON.stringify(m1.failing)}`)
expect('M1 leaves the real-egress arms green', m1.passing.includes(PASS_ALLOW), `passing=${JSON.stringify(m1.passing)}`)
expect('M2 reddens the SURFACE arm only', m2.passed === false && m2.failing.length === 1 && m2.failing[0].startsWith('PD27-SURFACE'), `failing=${JSON.stringify(m2.failing)}`)
expect('M2 leaves the PIN arm green', pin.passed && pin.passing.some((test) => test.startsWith('PD27-PIN')), `passing=${JSON.stringify(pin.passing)}`)
expect('M3 reddens the DENY arm on the server connection counter', m3.passed === false && m3.failing.includes(FAIL_DENY), `failing=${JSON.stringify(m3.failing)}`)
expect('M3 leaves the ALLOW arm green', m3.passing.includes(PASS_ALLOW), `passing=${JSON.stringify(m3.passing)}`)

const checks = 8
const verdict = failures.length === 0 ? 'PASS' : 'FAIL'
appendFileSync(LOG, `\nVERDICT ${verdict} (${String(checks - failures.length)}/${String(checks)} checks)\n`)
// eslint-disable-next-line no-console
console.log(`\nVERDICT ${verdict}${failures.length === 0 ? '' : `\n${failures.join('\n')}`}`)
if (failures.length !== 0) process.exitCode = 1
