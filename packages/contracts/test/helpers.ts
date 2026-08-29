/**
 * Shared assertion helpers for contracts tests.
 *
 * The repo test shim (scripts/test-vitest-shim.mjs) exposes only
 * `toBe` / `toEqual` / `toBeGreaterThan` / `toThrow` (and `.not`), and the
 * shim's `toThrow()` takes no argument. Contract tests must verify the
 * exact frozen error CODE of a thrown error, so this helper captures the
 * thrown value and checks it. The package keeps zero dependencies and no
 * @types/node, so these helpers use plain ES2022 only.
 */

import { isTeamContractError } from '../src/index.js'
import type { TeamContractError } from '../src/index.js'

/**
 * Run `fn` and return the thrown value, or `undefined` when nothing threw.
 */
export function capture(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return undefined
}

function describeError(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  return String(value)
}

/**
 * Assert that `fn` throws a `TeamContractError` with exactly `code`.
 */
export function expectCode(fn: () => unknown, code: string): void {
  const threw = capture(fn)
  if (threw === undefined) {
    throw new Error(`expected ${code} but nothing was thrown`)
  }
  if (!isTeamContractError(threw)) {
    throw new Error(`expected ${code} but got a non-contract error: ${describeError(threw)}`)
  }
  if (threw.code !== code) {
    throw new Error(`expected ${code} but got ${threw.code}`)
  }
}

/**
 * Assert that `fn` throws `code` and the error `details.path` equals `path`.
 */
export function expectErrorPath(fn: () => unknown, code: string, path: string): void {
  expectCode(fn, code)
  const threw = capture(fn) as TeamContractError
  const actual = threw.details === undefined ? undefined : threw.details['path']
  if (actual !== path) {
    throw new Error(
      `expected details.path '${path}' for ${code} but got ${JSON.stringify(actual)}`,
    )
  }
}
