/**
 * Shared assertion helpers for the P3-T2 blueprint tests.
 *
 * The repo test shim (scripts/test-vitest-shim.mjs) exposes only
 * `toBe` / `toEqual` / `toBeGreaterThan` / `toThrow` (and `.not`), and the
 * shim's `toThrow()` takes no argument. Blueprint tests must verify the
 * exact frozen `TeamContractError.code` (and selected `details` fields) of
 * a thrown error, so these helpers capture the thrown value and check it.
 * Plain ES2022 + contracts only — no node: builtins, no @types/node.
 *
 * @module @dsh-agent-team/domain/test/t2-helpers
 */

import { isTeamContractError } from '../../contracts/src/index.js'
import type { TeamContractError } from '../../contracts/src/index.js'

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
 * @returns the thrown error (for further details assertions).
 */
export function expectCode(fn: () => unknown, code: string): TeamContractError {
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
  return threw
}

/** Structural equality over plain values (mirrors the shim's deepEqual). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    if (!Object.hasOwn(b, key)) return false
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false
    }
  }
  return true
}

/**
 * Assert that `fn` throws a `TeamContractError` with exactly `code` and that
 * its `details` record contains every `key: value` pair of `expectedDetails`
 * (extra detail fields are allowed).
 * @returns the thrown error.
 */
export function expectErrorDetails(
  fn: () => unknown,
  code: string,
  expectedDetails: Record<string, unknown>,
): TeamContractError {
  const threw = expectCode(fn, code)
  const actual = threw.details
  if (actual === undefined) {
    throw new Error(`expected details ${JSON.stringify(expectedDetails)} but details is undefined`)
  }
  for (const key of Object.keys(expectedDetails)) {
    const expected = expectedDetails[key]
    const value = actual[key]
    if (!deepEqual(value, expected)) {
      throw new Error(
        `expected details.${key} = ${JSON.stringify(expected)} for ${code} but got ${JSON.stringify(value)}`,
      )
    }
  }
  return threw
}

/**
 * Whether `value` (and, recursively, every object reachable from it) is
 * frozen. The cycle guard makes the walk safe on any graph.
 */
export function isDeepFrozen(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null || typeof value !== 'object') return true
  if (seen.has(value as object)) return true
  seen.add(value as object)
  if (!Object.isFrozen(value as object)) return false
  for (const key of Object.keys(value as object)) {
    if (!isDeepFrozen((value as Record<string, unknown>)[key], seen)) return false
  }
  return true
}
