/**
 * Alpha.5 P1-07 — execution profile compilation (policy → OS rules).
 *
 * The OS runner never receives the Member policy loosely: it receives a
 * COMPILED PROFILE derived from the effective two-axis policy, and it refuses
 * to run when the profile cannot make an honest promise.
 *
 * EXPRESSIBLE (and enforced by the Landlock launcher):
 *  - read allow locators → READ_FILE | READ_DIR on exactly those subtrees;
 *  - write allow locators → WRITE_FILE | MAKE_REG | TRUNCATE | REMOVE_FILE;
 *  - a write locator that is NOT also readable → the write-only entry, with the
 *    read bits absent (the kernel default-denies reads of it);
 *  - network `deny` → the child is refused when the backend cannot enforce the
 *    network dimension (no `--unshare-net`-less fallback).
 *
 * NOT EXPRESSIBLE, therefore REFUSED rather than approximated:
 *  - `mode: all` on either axis (a "no allowlist" policy cannot be turned into
 *    a default-deny ruleset without changing its meaning);
 *  - `ask` dispositions (an ask is not an allow: the profile never upgrades it);
 *  - `chmod` (Landlock cannot restrict it for a same-uid owner; disclosed in the
 *    evidence, never silently claimed).
 *
 * @module @dsh-agent-team/runtime/team-sandbox/profile
 */

import type { AllowPathEntry } from '../../sandbox-provider/provider.js'
import type { EffectiveIoPolicy, MemberPolicy, PathRuleSet } from '../../member-io-policy/src/types.js'

/** The policy shapes this compiler accepts (member ceiling or effective policy). */
export type ProfilePolicy = MemberPolicy | EffectiveIoPolicy

export const PROFILE_REFUSAL_CODES = [
  'PATH_LANE_UNRESTRICTED',
  'PATH_LANE_UNSUPPORTED',
  'NETWORK_DENY_UNEXPRESSIBLE',
  'NO_NAMED_SUBTREE',
] as const

export type ProfileRefusalCode = (typeof PROFILE_REFUSAL_CODES)[number]

export interface ProfileRefusal {
  readonly ok: false
  readonly code: ProfileRefusalCode
  readonly detail: string
}

export interface ExecutionProfile {
  /** The kernel rules, one entry per named subtree. */
  readonly allowPaths: readonly AllowPathEntry[]
  /** `deny` must be enforced by the backend or the spawn is refused. */
  readonly networkProfile: 'deny' | undefined
  readonly readPaths: readonly string[]
  readonly writeOnlyPaths: readonly string[]
  /** Read+write subtrees (the intersection, listed once). */
  readonly readWritePaths: readonly string[]
}

export type ProfileResult = { readonly ok: true; readonly value: ExecutionProfile } | ProfileRefusal

function refuse(code: ProfileRefusalCode, detail: string): ProfileRefusal {
  return Object.freeze({ ok: false, code, detail })
}

const READ_BITS = Object.freeze({ readFile: true, readDir: true })
const WRITE_BITS = Object.freeze({ writeFile: true, makeReg: true, truncate: true, removeFile: true })

/**
 * Compile one execution profile. `read` and `write` are compiled independently:
 * a write-only subtree is a real, first-class outcome (it is exactly what a
 * Member with `write: allow` and no matching `read: allow` gets), not a bug.
 */
export function compileExecutionProfile(policy: ProfilePolicy): ProfileResult {
  const lanes: readonly [string, PathRuleSet][] = [
    ['read', policy.read],
    ['write', policy.write],
  ]
  for (const [axis, lane] of lanes) {
    if (lane.mode === 'all') {
      return refuse('PATH_LANE_UNRESTRICTED', `${axis} axis is 'all' (no allowlist); a default-deny OS ruleset cannot express it without changing the policy`)
    }
    if (lane.ask.length > 0) {
      return refuse('PATH_LANE_UNSUPPORTED', `${axis} axis carries 'ask' destinations; an ask is not an OS grant and the profile never upgrades it`)
    }
    // deny entries need no rule: the ruleset is default-deny. `deny` wins over a
    // matching `allow` by construction, because we drop denied allows below.
  }

  const readAllow = policy.read.allow.filter((locator) => !laneDenies(policy.read, locator))
  const writeAllow = policy.write.allow.filter((locator) => !laneDenies(policy.write, locator))
  if (readAllow.length === 0 && writeAllow.length === 0) {
    return refuse('NO_NAMED_SUBTREE', 'neither axis names a permitted subtree; an empty ruleset would deny everything (refused instead of spawning a useless child)')
  }

  const readWrite = readAllow.filter((locator) => writeAllow.includes(locator))
  const readOnly = readAllow.filter((locator) => !writeAllow.includes(locator))
  const writeOnly = writeAllow.filter((locator) => !readAllow.includes(locator))

  const allowPaths: AllowPathEntry[] = [
    ...readWrite.map((path) => ({ path, accessBits: Object.freeze({ ...READ_BITS, ...WRITE_BITS }) })),
    ...readOnly.map((path) => ({ path, accessBits: READ_BITS })),
    ...writeOnly.map((path) => ({ path, accessBits: WRITE_BITS })),
  ]

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      allowPaths: Object.freeze(allowPaths),
      networkProfile: policy.network.access === 'deny' ? 'deny' : undefined,
      readPaths: Object.freeze([...readWrite, ...readOnly]),
      writeOnlyPaths: Object.freeze(writeOnly),
      readWritePaths: Object.freeze(readWrite),
    }),
  })
}

/** A locator denied by its own lane (deny wins over allow, segment-aware). */
function laneDenies(lane: PathRuleSet, locator: string): boolean {
  const normalized = locator.replace(/\\/g, '/').replace(/\/+$/, '')
  return lane.deny.some((denied) => {
    const rule = denied.replace(/\\/g, '/').replace(/\/+$/, '')
    return normalized === rule || normalized.startsWith(`${rule}/`) || rule === ''
  })
}
