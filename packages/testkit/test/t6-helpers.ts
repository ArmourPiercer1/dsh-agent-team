/**
 * P3-T6 — shared assertion helpers for the t6 cross-module test bundle.
 *
 * The audited runner shim (scripts/test-vitest-shim.mjs) exposes only
 * `toBe` / `toEqual` / `toBeGreaterThan` / `toThrow` (each with `.not`), and
 * `it` bodies are synchronous. Everything beyond that surface is a plain
 * ES2022 try/catch helper here, mirroring the t2/t3 helper idioms.
 * @module t6-helpers
 */

import { TeamContractError } from '../../contracts/src/index.js'
import { MemberDomainError } from '../../domain/member/src/index.js'
import { LifecycleTransitionError } from '../../domain/lifecycle/src/index.js'
import { PolicyResolutionError } from '../../domain/policy/src/index.js'

/** The result of a guarded call. */
export interface Captured {
  /** The thrown error, or `undefined` when the call succeeded. */
  readonly error: unknown
  /** The return value, or `undefined` when the call threw. */
  readonly value: unknown
}

/** Run `fn`, capturing its error or value without re-throwing. */
export function capture(fn: () => unknown): Captured {
  try {
    const value = fn()
    return { error: undefined, value }
  } catch (error) {
    return { error, value: undefined }
  }
}

/** A one-line description of an unknown error value. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/**
 * Assert `fn` throws and the error satisfies `predicate`; returns the error.
 * Fails the test (throws) when no error is thrown or the predicate misses.
 */
export function expectThrows(
  fn: () => unknown,
  predicate: (error: unknown) => boolean,
  label: string,
): unknown {
  const { error } = capture(fn)
  if (error === undefined) {
    throw new Error(`expectThrows(${label}): expected an error, but none was thrown`)
  }
  if (!predicate(error)) {
    throw new Error(`expectThrows(${label}): unexpected error ${describeError(error)}`)
  }
  return error
}

/** Assert `fn` does not throw; returns its value. */
export function expectNoThrow(fn: () => unknown, label: string): unknown {
  const { error, value } = capture(fn)
  if (error !== undefined) {
    throw new Error(`expectNoThrow(${label}): unexpected error ${describeError(error)}`)
  }
  return value
}

/** True iff `error` is an Error carrying exactly the given machine code. */
export function hasCode(error: unknown, code: string): boolean {
  if (!(error instanceof Error)) return false
  return (error as { code?: unknown }).code === code
}

/** Assert `fn` throws an Error with machine-readable `code`; returns it. */
export function expectCode(fn: () => unknown, code: string, label: string): unknown {
  return expectThrows(fn, (error) => hasCode(error, code), label)
}

/**
 * The four domain error classes, keyed by family. Class-based on purpose:
 * the shape guard `isTeamContractError` also matches foreign errors that
 * happen to carry a shared v1 code (the policy engine's
 * IDENTITY_SCOPE_MISMATCH reuses a contracts code name), so family
 * disjointness must be judged by class identity.
 */
export const T6_ERROR_CLASSES: Readonly<
  Record<'contracts' | 'member' | 'lifecycle' | 'policy', new (...args: never[]) => Error>
> = Object.freeze({
  contracts: TeamContractError,
  member: MemberDomainError,
  lifecycle: LifecycleTransitionError,
  policy: PolicyResolutionError,
})

/** A domain error family name. */
export type T6ErrorFamily = keyof typeof T6_ERROR_CLASSES

/** The exact set of domain error classes `error` is an instance of. */
export function errorFamilies(error: unknown): readonly T6ErrorFamily[] {
  const families: T6ErrorFamily[] = []
  for (const family of Object.keys(T6_ERROR_CLASSES) as T6ErrorFamily[]) {
    const cls = T6_ERROR_CLASSES[family]
    if (error instanceof cls) families.push(family)
  }
  return families
}

/**
 * Assert `fn` throws and the error is an instance of EXACTLY ONE domain
 * error class — the given `family` (the G3 negative-matrix disjointness
 * property); returns the error.
 */
export function expectSingleFamily(
  fn: () => unknown,
  family: T6ErrorFamily,
  label: string,
): unknown {
  const error = expectThrows(fn, (e) => e instanceof Error, label)
  const families = errorFamilies(error)
  if (families.length !== 1 || families[0] !== family) {
    throw new Error(
      `expectSingleFamily(${label}): expected exactly one family [${family}], got [${families.join(', ')}]`,
    )
  }
  return error
}

/**
 * Recursively check deep freezing (own keys, cycle-safe). Frozen objects are
 * the vNext immutability mechanism (invariant 10, §21.6).
 */
export function isDeepFrozen(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null || typeof value !== 'object') return true
  const object = value as object
  if (seen.has(object)) return true
  seen.add(object)
  if (!Object.isFrozen(object)) return false
  for (const key of Object.keys(object as Record<string, unknown>)) {
    if (!isDeepFrozen((object as Record<string, unknown>)[key], seen)) return false
  }
  return true
}

/**
 * Deterministic PRNG (mulberry32) for property loops. Fixed seeds make the
 * property suites reproducible run-to-run.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
