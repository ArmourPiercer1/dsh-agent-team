/**
 * test-vitest-shim — the minimal vitest API surface consumed by the vNext
 * skeleton's tests, backed by zero dependencies. It exists so the same test
 * files can run under plain Node in spawn-restricted environments where
 * vitest cannot start (vite's Windows safe-realpath resolution execFile()s a
 * child process: EPERM errno -4048 — see evidence/P1-T5/D-05-test-pnpm.log).
 *
 * Implemented surface (exactly what the per-package test/*.test.ts files
 * use, verified by matcher audit): describe, it, expect; matchers toBe,
 * toEqual, toBeGreaterThan, toThrow — each with a `.not` form.
 *
 * The shim is a single module instance: scripts/run-tests.mjs imports it
 * directly, and scripts/run-tests-hooks.mjs resolves the bare specifier
 * 'vitest' to this very file, so every test file's `from 'vitest'` import
 * lands on the same module record the runner reads results from.
 *
 * Equivalence note: the runner executes the identical .test.ts sources that
 * `vitest run` would (node's native TS type-stripping handles the erasable
 * TS syntax); only the assertion engine differs, and only within the
 * audited matcher surface above.
 */

const results = {
  /** One record per executed `it(...)`: { file, suite, name, ok, error }. */
  tests: [],
}

let currentFile = '<unknown>'
let currentSuite = ''

function render(value) {
  if (value === undefined) return 'undefined'
  if (value instanceof Error) return `Error(${value.message})`
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    if (!Object.hasOwn(b, key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }
  return true
}

function describe(name, fn) {
  const parent = currentSuite
  currentSuite = parent === '' ? name : `${parent} › ${name}`
  try {
    fn()
  } finally {
    currentSuite = parent
  }
}

function it(name, fn) {
  const started = results.tests.length
  let bodyError
  try {
    const r = fn()
    if (r !== undefined && typeof r.then === 'function') {
      bodyError = new Error('async it() is not supported by the plain-node shim; the skeleton tests are synchronous')
    }
  } catch (err) {
    bodyError = err
  }
  // Assertions executed inside the body record themselves; fold them into
  // this `it` record: the test passes iff the body threw nothing and every
  // assertion held.
  const assertions = results.tests.slice(started)
  const ok = bodyError === undefined && assertions.every((a) => a.ok)
  const error = bodyError !== undefined
    ? (bodyError instanceof Error ? (bodyError.stack ?? bodyError.message) : String(bodyError))
    : (assertions.find((a) => !a.ok)?.error ?? undefined)
  results.tests.length = started
  results.tests.push({ file: currentFile, suite: currentSuite, name, ok, error })
}

/**
 * expect(actual) — immediate synchronous assertions. Each matcher runs at
 * call time (like vitest's sync matchers) and records + throws on failure.
 */
function expect(actual) {
  const record = (ok, hint) => {
    const errorText = ok ? undefined : `expectation failed: ${hint} — actual: ${render(actual)}`
    results.tests.push({ file: currentFile, suite: currentSuite, name: '<assertion>', ok, error: errorText })
    if (!ok) throw new Error(errorText)
  }
  const threwOf = () => {
    if (typeof actual !== 'function') return { notFunction: true, threw: false }
    let threw = false
    try {
      actual()
    } catch {
      threw = true
    }
    return { notFunction: false, threw }
  }
  const pos = {
    toBe: (e) => record(Object.is(actual, e), `actual toBe ${render(e)}`),
    toEqual: (e) => record(deepEqual(actual, e), `actual toEqual ${render(e)}`),
    toBeGreaterThan: (e) => record(typeof actual === 'number' && actual > e, `actual toBeGreaterThan ${render(e)}`),
    toThrow: () => {
      const { notFunction, threw } = threwOf()
      record(!notFunction && threw, 'function to throw')
    },
  }
  const neg = {
    toBe: (e) => record(!Object.is(actual, e), `actual toBe ${render(e)} (negated)`),
    toEqual: (e) => record(!deepEqual(actual, e), `actual toEqual ${render(e)} (negated)`),
    toBeGreaterThan: (e) => record(!(typeof actual === 'number' && actual > e), `actual toBeGreaterThan ${render(e)} (negated)`),
    toThrow: () => {
      const { notFunction, threw } = threwOf()
      // A non-function cannot throw, so the negation holds vacuously.
      record(notFunction || !threw, 'function not to throw (negated)')
    },
  }
  return { ...pos, not: neg }
}

/** Runner-side hooks (not part of the vitest API surface). */
function __beginFile(file) {
  currentFile = file
}

function __collectAndReset() {
  return results.tests.splice(0, results.tests.length)
}

export { describe, expect, it, __beginFile, __collectAndReset, results }
