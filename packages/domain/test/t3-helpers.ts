/**
 * Shared helpers for P3-T3 tests (lifecycle + member domain modules).
 *
 * The repo test shim (scripts/test-vitest-shim.mjs) exposes only
 * `toBe` / `toEqual` / `toBeGreaterThan` / `toThrow` (and `.not`), and the
 * shim's `toThrow()` takes no argument — so error-type assertions are done
 * with capture + explicit checks (same pattern as
 * packages/contracts/test/helpers.ts). Zero dependencies, plain ES2022, no
 * node: builtins (the workspace has no @types/node).
 */

import {
  MEMBER_LIFECYCLE_STATES,
  createBlueprintSnapshotRef,
  createMemberInstanceRecord,
  createTeamSessionRecord,
  isTeamContractError,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type {
  ChildSessionId,
  InstanceId,
  MemberInstanceRecordDto,
  MemberLifecycleState,
  RootSessionId,
  TeamSessionRecordDto,
  TemplateId,
} from '../../contracts/src/index.js'
import { isMemberDomainError } from '../member/src/index.js'

// --- error capture -----------------------------------------------------------

/** Run `fn` and return the thrown value, or `undefined` when nothing threw. */
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
 * Assert `fn` throws and the thrown value satisfies `predicate`; returns the
 * thrown value for further field checks.
 */
export function expectThrows(
  fn: () => unknown,
  predicate: (err: unknown) => boolean,
  label: string,
): unknown {
  const threw = capture(fn)
  if (threw === undefined) {
    throw new Error(`expected ${label} but nothing was thrown`)
  }
  if (!predicate(threw)) {
    throw new Error(`expected ${label} but got: ${describeError(threw)}`)
  }
  return threw
}

/** Assert `fn` does not throw. */
export function expectNoThrow(fn: () => unknown, label: string): void {
  const threw = capture(fn)
  if (threw !== undefined) {
    throw new Error(`expected no throw (${label}) but got: ${describeError(threw)}`)
  }
}

/** Assert `fn` throws a `TeamContractError` with exactly `code`; returns the error. */
export function expectContractCode(fn: () => unknown, code: string) {
  const threw = expectThrows(fn, (e) => isTeamContractError(e), `TeamContractError ${code}`)
  const err = threw as { code: string }
  if (err.code !== code) {
    throw new Error(`expected contract code ${code} but got ${err.code}`)
  }
  return threw
}

/** Assert `fn` throws a `MemberDomainError` with exactly `code`; returns the error. */
export function expectMemberCode(
  fn: () => unknown,
  code: string,
): { code: string; details: Readonly<Record<string, string | number | readonly string[]>> } {
  const threw = expectThrows(fn, (e) => isMemberDomainError(e), `MemberDomainError ${code}`)
  const err = threw as { code: string; details: Readonly<Record<string, string | number | readonly string[]>> }
  if (err.code !== code) {
    throw new Error(`expected member-domain code ${code} but got ${err.code}`)
  }
  return err
}

// --- id / fixture factories ---------------------------------------------------

export function rootSessionId(s: string): RootSessionId {
  return parseRootSessionId(s)
}

export function childSessionId(s: string): ChildSessionId {
  return parseChildSessionId(s)
}

export function instanceId(s: string): InstanceId {
  return parseInstanceId(s)
}

export function templateId(s: string): TemplateId {
  return parseTemplateId(s)
}

export interface MemberRecordOverrides {
  templateId?: string
  label?: string
  groupId?: string
  childSessionId?: string
  workspace?: string
  lifecycle?: MemberLifecycleState
  activityVersion?: number
}

/** Build a valid frozen MemberInstanceRecordDto fixture. */
export function makeMemberRecord(
  root: RootSessionId,
  inst: InstanceId,
  overrides: MemberRecordOverrides = {},
): MemberInstanceRecordDto {
  return createMemberInstanceRecord({
    rootSessionId: root,
    instanceId: inst,
    templateId: templateId(overrides.templateId ?? 'researcher'),
    label: overrides.label ?? 'Fourier',
    ...(overrides.groupId !== undefined ? { groupId: overrides.groupId } : {}),
    childSessionId: childSessionId(overrides.childSessionId ?? `session-100-${inst.slice(5)}`),
    ...(overrides.workspace !== undefined ? { workspace: overrides.workspace } : {}),
    lifecycle: overrides.lifecycle ?? MEMBER_LIFECYCLE_STATES.CREATED,
    createdAt: '2026-08-29T12:00:00Z',
    activityVersion: overrides.activityVersion ?? 1,
  })
}

export interface TeamSessionRecordOverrides {
  defaultWorkspace?: string
}

/** Build a valid frozen TeamSessionRecordDto fixture. */
export function makeTeamSessionRecord(
  root: RootSessionId,
  overrides: TeamSessionRecordOverrides = {},
): TeamSessionRecordDto {
  return createTeamSessionRecord({
    rootSessionId: root,
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId('bp-p3t3'),
      revision: parseBlueprintRevision('1'),
      contentHash: parseBlueprintContentHash('deadbeef'),
    }),
    ...(overrides.defaultWorkspace !== undefined
      ? { defaultWorkspace: overrides.defaultWorkspace }
      : {}),
    createdAt: '2026-08-29T11:00:00Z',
    generation: 1,
  })
}

// --- deterministic PRNG (hand-rolled; no third-party deps) ---------------------

/**
 * mulberry32 — a small deterministic 32-bit PRNG (plain ES2022).
 * Same seed ⇒ identical sequence, which is what makes the property tests
 * reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
