#!/usr/bin/env node
/**
 * tests/world-factory/a5sf-pd30-mutation-controls.mjs — the mutation controls
 * for PD-30. A suite that cannot go red is not evidence.
 *
 *   CLEAN  the suite as shipped: 11/11 green.
 *   M1     the destination (SSRF) leg REMOVED from the shipped face. The arm
 *          that must go red is `PD30-SSRF` — and it must go red because the
 *          transport was ENTERED (the arm's provider-entry counter), not
 *          because a string changed. `PD30-NO-BASE-FALLBACK` goes red too (its
 *          SSRF leg is the same admission), which is expected; the ALLOW arms
 *          stay green, because removing the SSRF leg does not remove the
 *          fixture's admission.
 *   M2     the SHIPPED TRANSPORT swapped for the inherited BASE web service
 *          (`globalThis.__PD30_BASE_WEB__`). `PD30-NO-BASE-FALLBACK` MUST go
 *          red on its own counter ("consulted ZERO times"), which is what makes
 *          the zero a measurement rather than a claim.
 *   M3     the search CREDENTIAL dropped, so the host provider reports itself
 *          unavailable. `PD30-E2E-SEARCH` must go red with the typed
 *          `WEB_PROVIDER_UNAVAILABLE` gap (the "surface without backend" shape
 *          PD-27 shipped), and `PD30-NO-PROVIDER` must stay green (the gap is
 *          already an arm there).
 *
 * Each arm is a real `node --test` child whose verdict is its exit code PLUS the
 * NAMES of the failing tests, so a green CLEAN cannot hide a red M2. The mutated
 * artefacts are written under the lane's evidence archive; every substitution is
 * ASSERTED (a control whose source drifted refuses instead of mutating nothing).
 *
 * CORE PATCH BUDGET = 0. No boot, no port, no DSH_HOME, no git write.
 *
 * Run: node tests/world-factory/a5sf-pd30-mutation-controls.mjs
 *
 * @module tests/world-factory/a5sf-pd30-mutation-controls
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd30-web-preview.test.mjs')
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd30-web-preview')
const LOG = join(EVIDENCE, 'mutation-controls.log')
const ARCHIVE = join(EVIDENCE, 'archive', 'mutations')
const DIST_TEAM = join(REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src')
const FACE = join(DIST_TEAM, 'web.js')
const TRANSPORT = join(REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-web-transport.mjs')

mkdirSync(ARCHIVE, { recursive: true })

/** Rewrite a dist file's RELATIVE imports to absolute URLs so a copy runs from anywhere. */
function absolutise(source, fromDir) {
  return source.replace(/(from\s+')(\.{1,2}\/[^']+)(')/gu, (_all, head, spec, tail) => `${head}${pathToFileURL(join(fromDir, spec)).href}${tail}`)
}

/** One asserted substitution, archived next to the suite that reads it. */
function mutate({ name, sourcePath, substitutions }) {
  const original = readFileSync(sourcePath, 'utf8')
  let text = original
  for (const [from, to, label] of substitutions) {
    if (!text.includes(from)) {
      throw new Error(`PD-30 mutation control ${name}: substitution ${label} not found in ${sourcePath}; refusing to run a control that mutates nothing`)
    }
    text = text.replace(from, to)
  }
  if (text === original) throw new Error(`PD-30 mutation control ${name}: nothing changed; refusing`)
  const target = join(ARCHIVE, name)
  writeFileSync(target, absolutise(text, dirname(sourcePath)))
  return target
}

const lines = []
function note(line) {
  lines.push(line)
  process.stdout.write(`${line}\n`)
}

/** Run the suite once; return `{ ok, failing }` from its TAP output. */
function runSuite(env) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 600_000,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const failing = new Set()
  for (const raw of output.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('✖ ')) continue
    const name = line.slice(2).split(':')[0].trim()
    if (name.startsWith('PD30-')) failing.add(line.slice(2).trim())
  }
  // The trailing "failing tests:" section repeats them; a set keeps it unique.
  return { ok: result.status === 0, failing: [...failing], output }
}

function expect({ label, result, red, green }) {
  note(`--- ${label}: exit=${result.ok ? 'green' : 'red'} failing=[${result.failing.join(' | ')}]`)
  if (!red.every((name) => result.failing.some((line) => line.startsWith(name)))) {
    throw new Error(`${label}: expected ${red.join(', ')} to go RED, got [${result.failing.join(' | ')}]`)
  }
  for (const name of green) {
    if (result.failing.some((line) => line.startsWith(name))) {
      throw new Error(`${label}: ${name} must stay GREEN (the mutation is not supposed to reach it)`)
    }
  }
  if (red.length > 0 && result.ok) throw new Error(`${label}: the mutated run must NOT be green`)
}

// ── CLEAN ───────────────────────────────────────────────────────────────────
const clean = runSuite({})
expect({ label: 'CLEAN', result: clean, red: [], green: ['PD30-SSRF', 'PD30-E2E-SEARCH', 'PD30-NO-BASE-FALLBACK'] })
if (!clean.ok) throw new Error(`CLEAN: the shipped suite must be green, failing=[${clean.failing.join(' | ')}]`)

// ── M1: the SSRF leg removed ────────────────────────────────────────────────
const m1 = mutate({
  name: 'web.ssrf-leg-removed.js',
  sourcePath: FACE,
  substitutions: [[
    '  if (isForbiddenIpv4(hostname) || isForbiddenIpv6(hostname)) {',
    '  if (false && (isForbiddenIpv4(hostname) || isForbiddenIpv6(hostname))) {',
    'the IPv4/IPv6 destination check',
  ]],
})
const m1Run = runSuite({ A5SF_PD30_WEB_FACE_MODULE: m1 })
expect({ label: 'M1 ssrf-leg-removed', result: m1Run, red: ['PD30-SSRF'], green: ['PD30-E2E-ALLOW', 'PD30-E2E-SEARCH'] })
// The red must be the ENTRY counter, not a message: the arm says the transport
// was reached. Assert the phrase so a future edit cannot soften it into prose.
if (!/was ADMITTED \(transport entries: [1-9]/u.test(m1Run.output)) {
  throw new Error('M1: the SSRF arm went red without reaching the provider-entry assertion; the control is not measuring egress')
}

// ── M2: the transport swapped for the inherited BASE web service ────────────
const m2 = mutate({
  name: 'a5sf-web-transport.base-fallback.mjs',
  sourcePath: TRANSPORT,
  substitutions: [[
    `      async fetch(request, signal) {
        return fetchProvider.fetch(request, signal)
      },`,
    `      async fetch(request, signal) {
        // MUTATION (PD-30 control only): the PD-18 regression — the inherited
        // base web service answers instead of the governed transport.
        const base = globalThis.__PD30_BASE_WEB__
        if (base !== undefined && base !== null) return base.fetch(request, signal)
        return fetchProvider.fetch(request, signal)
      },`,
    'the fetch delegation',
  ]],
})
const m2Run = runSuite({ A5SF_PD30_TRANSPORT_MODULE: m2 })
expect({ label: 'M2 transport->BASE', result: m2Run, red: ['PD30-NO-BASE-FALLBACK'], green: ['PD30-DENY', 'PD30-E2E-SEARCH', 'PD30-SHIPPED-SERVICE'] })
if (!/consulted ZERO times/iu.test(m2Run.output)) {
  throw new Error('M2: the base-fallback arm went red without its counter assertion; the control is not measuring the fallback')
}

// ── M3: the search provider loaded but not attached (PD-27's shape) ─────────
const m3 = mutate({
  name: 'a5sf-web-transport.search-key-dropped.mjs',
  sourcePath: TRANSPORT,
  substitutions: [[
    "        apiKey: nonBlank(search.apiKey) ?? '',",
    "        apiKey: '', // MUTATION (PD-30 control only): the credential is dropped",
    'the search credential',
  ]],
})
const m3Run = runSuite({ A5SF_PD30_TRANSPORT_MODULE: m3 })
expect({ label: 'M3 search-credential-dropped', result: m3Run, red: ['PD30-E2E-SEARCH'], green: ['PD30-NO-PROVIDER', 'PD30-E2E-ALLOW'] })
if (!/WEB_PROVIDER_UNAVAILABLE/iu.test(m3Run.output)) {
  throw new Error('M3: the search arm went red without the typed provider gap; the control is not measuring the backend')
}

note('')
note('PD-30 mutation controls: CLEAN green, M1/M2/M3 red on the arm that names the property, and the')
note('neighbouring arms stayed green. The suite can fail.')

writeFileSync(LOG, `${lines.join('\n')}\n`)
