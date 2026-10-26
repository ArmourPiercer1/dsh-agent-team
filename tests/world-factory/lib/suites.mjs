/**
 * suites.mjs — the C2 suite registry of u5-canary-runner.mjs, collected by
 * ENUMERATION (u7-w0, 2026-10-26).
 *
 * Until u7-w0 every lane that added a C2 suite edited THREE shared sites in
 * u5-canary-runner.mjs (its SUITE_CASES entry, the `totalRequests` ternary and
 * the `suite === …` dispatch chain) plus the runner's import block — 2 of the
 * 7 merged U7 PRs did, and the runner was a recurring conflict site. A lane now
 * ADDS ONE MODULE, `tests/world-factory/suites/<NNN>-<suite>.mjs`, whose default
 * export is
 *
 *   { suite: '<name>', cases: ['<id>', …], totalRequests: <n>, run: (opts, ctx) => Promise }
 *
 * The runner keeps every law it had: `--suite` refuses a name no suite
 * declares; `--only` refuses a case the suite does not list; the RUN record's
 * selected cases are exactly that list. FAIL-CLOSED here: a mis-named file, a
 * descriptor missing a field, an empty or duplicated case list, a suite name
 * declared twice (or clashing with one of the runner's own suites) throws
 * while the runner module loads, so no RUN can start on a registry nobody can
 * account for.
 */
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SUITES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'suites')
const FILE_NAME = /^\d{3}-([a-z0-9][a-z0-9-]*)\.mjs$/

/**
 * @param {{ dir?: string, reserved?: readonly string[] }} [opts]
 *        `reserved` = the runner's own suite names (a collected suite may not shadow them)
 */
export async function loadSuites({ dir = SUITES_DIR, reserved = [] } = {}) {
  // EVERY entry is enumerated (u7-w0 review R1 F-1): a subdirectory, dotfile or
  // other extension refuses by name instead of being silently skipped.
  const entries = readdirSync(dir, { withFileTypes: true })
  const stray = entries.filter((e) => !e.isFile() || !FILE_NAME.test(e.name)).map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`).sort()
  if (stray.length > 0) throw new Error(`suites: stray-entry ${stray.join(', ')} (suites modules are <NNN>-<suite>.mjs)`)
  const files = entries.map((e) => e.name).sort()
  const seen = new Set(reserved)
  const out = []
  for (const file of files) {
    const m = FILE_NAME.exec(file)
    if (m === null) throw new Error(`suites: ${file}: suite modules are <NNN>-<suite>.mjs (the prefix is the order)`)
    const s = (await import(pathToFileURL(join(dir, file)).href)).default
    const where = `suites/${file}`
    if (s === null || typeof s !== 'object') throw new Error(`${where}: default export must be a suite descriptor`)
    if (typeof s.suite !== 'string' || s.suite !== m[1]) throw new Error(`${where}: suite name ${JSON.stringify(s?.suite)} must equal the file's name part ${JSON.stringify(m[1])}`)
    if (seen.has(s.suite)) throw new Error(`${where}: suite ${s.suite} is already declared (by the runner or another module)`)
    seen.add(s.suite)
    if (!Array.isArray(s.cases) || s.cases.length === 0 || s.cases.some((c) => typeof c !== 'string' || c === '')) throw new Error(`${where}: cases must be a non-empty list of case ids`)
    if (new Set(s.cases).size !== s.cases.length) throw new Error(`${where}: a case id is listed twice`)
    if (!Number.isInteger(s.totalRequests) || s.totalRequests < 1) throw new Error(`${where}: totalRequests must be a positive integer (the run-control request budget)`)
    if (typeof s.run !== 'function') throw new Error(`${where}: run must be a function (opts, ctx) => Promise`)
    out.push(Object.freeze({ ...s, cases: Object.freeze([...s.cases]), file }))
  }
  return Object.freeze(out)
}
