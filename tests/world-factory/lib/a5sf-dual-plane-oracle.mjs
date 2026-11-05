/**
 * a5sf-dual-plane-oracle.mjs — BL-33 / P4-05A: the INDEPENDENT third opinion.
 *
 * WHAT THIS FILE IS, AND WHY IT IS A SEPARATE FILE. The other two planes are
 * the shipped implementations under test:
 *
 *   1. `packages/runtime/operation-permission/permission-resolver.ts`
 *      (`resolveOperationPermission` + `canonicalizeOperation`) — the
 *      pre-Alpha.5 (alpha.2/Alpha.4) tool-call permission plane;
 *   2. `packages/runtime/team-services/src/fs.ts` (`createMemberFsGuard`) reached
 *      through the REAL product mount (`mountMemberA5sfRealm` →
 *      `installToolIoProviders` / `installToolBindingRealm`), whose
 *      consultation is observed by `guard-observability.ts` as an
 *      `a5sf-guard-consult/1` fact.
 *
 * This file derives the SAME call's disposition a THIRD time, from the
 * DECLARED ceilings / restrictions only, without importing, calling or copying
 * either plane. It is deliberately a separate module so the independence is a
 * property of the import graph, not a promise: the C1 suite fences this file's
 * source and fails if it ever references a plane symbol or a non-`node:` module.
 * A reviewer can therefore read this file as the whole derivation and check it
 * against the declared lanes without re-reading either implementation.
 *
 * WHAT IT DELIBERATELY MODELS (each step is named in `basis[]`, so a reader can
 * see WHICH step produced a decision):
 *
 *   S1 governing lane. `realm: 'binding'` ⇒ `ceiling[axis] ∩ restriction[axis]`
 *      (the per-tool realm enforces the narrower intersection). `realm: 'member'`
 *      ⇒ `ceiling[axis]` (the Member realm enforces the ceiling only; no tool
 *      restriction is mounted there). The intersection is re-derived here from
 *      the DECLARED lanes — it is not read back from the compiler.
 *   S2 authored disposition. deny > ask > allow > implicit deny, on the authored
 *      locator (never folded: `..` stays a literal segment). This is the
 *      declared-lane precedence, implemented from the lane data.
 *   S3 path identity. The authored locator is resolved with `node:fs`
 *      (`realpath`); a resolved path that leaves the lane is denied. Symlinked
 *      PARENTS are caught by the same resolution; a hardlink's in-lane NAME is
 *      allowed and its out-of-lane name denied, because the decision is taken on
 *      the path (no inode identity — disclosed by
 *      `member-io-policy/src/provider-capabilities.ts`, ADR D5).
 *   S4 write read-prerequisite. An EXISTING write target must also be readable
 *      under the SAME realm's read lane. This is the admission contract the
 *      confined Provider documents in `team-services/src/fs.ts` (the native
 *      write/edit read-before-write law, kept by the 2026-11-04 ruling); it is
 *      NOT one of the declared lanes, so it is named as its own step and the
 *      C1 suite pins a mutation that deletes it.
 *
 * WHAT IT DOES NOT MODEL: approvals. The oracle answers the STATIC disposition
 * (allow/ask/deny) of one call against declared lanes; it does not know whether
 * an `ask` was approved, and the comparison never treats approval as a lane.
 *
 * @module tests/world-factory/lib/a5sf-dual-plane-oracle
 */

import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** Closed vocabulary this oracle answers in (the same three words both planes use). */
export const ORACLE_DECISIONS = Object.freeze(['allow', 'ask', 'deny'])

const ABSOLUTE = /^(\/|\\|[A-Za-z]:[\\/])/

/** Split a locator into comparison segments WITHOUT folding `..` (authored law). */
function authoredSegments(locator) {
  return locator
    .split(/[/\\]+/)
    .filter((segment) => segment !== '' && segment !== '.')
}

function authoredKey(locator) {
  return { absolute: ABSOLUTE.test(locator), segments: authoredSegments(locator) }
}

function keyCovers(parent, child) {
  if (parent.absolute !== child.absolute) return false
  if (parent.segments.length === 0) return true
  if (parent.segments.length > child.segments.length) return false
  return parent.segments.every((segment, index) => child.segments[index] === segment)
}

/** Is `child` at or under `root`? Boundary-aware: `/w/a` does not cover `/w/ab`. */
function covers(root, child) {
  return keyCovers(authoredKey(root), authoredKey(child))
}

/** Own deny test: any deny locator covers the target. */
function deniedBy(lane, locator) {
  return lane.deny.some((entry) => covers(entry, locator))
}

/** Own allow test: mode `all`, or a covering allow locator, and not denied. */
function allowedBy(lane, locator) {
  if (deniedBy(lane, locator)) return false
  if (lane.mode === 'all') return true
  return lane.allow.some((entry) => covers(entry, locator))
}

/**
 * S2's disposition over ONE declared lane. Frozen precedence identical to the
 * declared vocabulary: explicit deny, then ask (never promoted), then `all` or a
 * covering allow, else deny.
 */
function authoredDisposition(lane, locator) {
  if (deniedBy(lane, locator)) return 'deny'
  if (lane.ask.some((entry) => covers(entry, locator))) return 'ask'
  if (lane.mode === 'all') return 'allow'
  return lane.allow.some((entry) => covers(entry, locator)) ? 'allow' : 'deny'
}

/** The narrower of each related allow pair; unrelated pairs are dropped. */
function intersectAllow(left, right) {
  const out = []
  for (const leftLocator of left) {
    const leftKey = authoredKey(leftLocator)
    for (const rightLocator of right) {
      const rightKey = authoredKey(rightLocator)
      if (keyCovers(leftKey, rightKey)) {
        if (!out.includes(rightLocator)) out.push(rightLocator)
      } else if (keyCovers(rightKey, leftKey)) {
        if (!out.includes(leftLocator)) out.push(leftLocator)
      }
    }
  }
  return out
}

function union(left, right) {
  const out = []
  for (const item of [...left, ...right]) if (!out.includes(item)) out.push(item)
  return out
}

/**
 * S1's intersection of two DECLARED lanes (`ceiling ∩ restriction`):
 * `all` is the identity, allow keeps the narrower related subtree, deny is the
 * union, and an ask survives only where the permission side still allows it.
 */
export function intersectDeclaredLanes(ceiling, restriction) {
  const bothAll = ceiling.mode === 'all' && restriction.mode === 'all'
  const allow = bothAll
    ? []
    : ceiling.mode === 'all'
      ? [...restriction.allow]
      : restriction.mode === 'all'
        ? [...ceiling.allow]
        : intersectAllow(ceiling.allow, restriction.allow)
  const mode = bothAll ? 'all' : 'restricted'
  const deny = union(ceiling.deny, restriction.deny)
  const permissionOnly = { mode, allow, ask: [], deny }
  const ask = []
  for (const locator of union(ceiling.ask, restriction.ask)) {
    if (ask.includes(locator)) continue
    if (!allowedBy(permissionOnly, locator)) continue
    ask.push(locator)
  }
  return { mode, allow, ask, deny }
}

/**
 * S3's identity resolution. Returns the canonical path the decision is taken on,
 * or a typed reason the path cannot be proven admissible.
 */
function resolveIdentity(target, forWrite) {
  let linkIdentity = null
  try {
    linkIdentity = lstatSync(target)
  } catch (error) {
    if (error?.code !== 'ENOENT') return { ok: false, reason: 'resolution-failed' }
  }
  if (linkIdentity !== null && linkIdentity.isSymbolicLink()) {
    try {
      return { ok: true, resolved: realpathSync(target), symlink: true }
    } catch {
      // S3: a dangling symlink is never allowed to stand in for a create-leaf.
      return { ok: false, reason: 'dangling-symlink' }
    }
  }
  if (linkIdentity !== null) {
    try {
      return { ok: true, resolved: realpathSync(target), symlink: false }
    } catch {
      return { ok: false, reason: 'resolution-failed' }
    }
  }
  if (!forWrite) return { ok: false, reason: 'not-found' }
  try {
    return { ok: true, resolved: join(realpathSync(dirname(target)), basename(target)), symlink: false }
  } catch {
    return { ok: false, reason: 'parent-unresolved' }
  }
}

/**
 * S2 + S3 for one lane: authored disposition first, then the Provider-resolved
 * identity. A non-allow authored answer is returned unchanged (no resolution is
 * performed on a locator the declared lane already refuses).
 */
function admitLane(lane, target, forWrite) {
  const authored = authoredDisposition(lane, target)
  if (authored !== 'allow') {
    return { decision: authored, basis: [`authored-locator=${authored}`] }
  }
  const identity = resolveIdentity(target, forWrite)
  if (!identity.ok) {
    return { decision: 'deny', basis: ['authored-locator=allow', `identity=${identity.reason}`] }
  }
  // The decision is taken on the CANONICAL identity, so the authored precedence
  // is re-applied there: an allow reached through a symlink that lands on an
  // ask-covered (or denied, or out-of-lane) path is NOT an allow.
  const resolvedDisposition = authoredDisposition(lane, identity.resolved)
  if (resolvedDisposition !== 'allow') {
    return {
      decision: resolvedDisposition,
      basis: ['authored-locator=allow', `resolved=${identity.resolved}`, `resolved-disposition=${resolvedDisposition}`],
    }
  }
  return {
    decision: 'allow',
    basis: ['authored-locator=allow', `resolved=${identity.resolved}`, 'identity-in-lane'],
    resolved: identity.resolved,
    existed: existsSync(identity.resolved),
  }
}

/**
 * Derive one call's disposition from the DECLARED ceiling (+ optional declared
 * tool restriction) and the call itself. This is the whole oracle.
 *
 * @param {object} input
 * @param {'read'|'write'} input.axis the I/O axis of the call
 * @param {'member'|'binding'} input.realm which realm serves the call
 * @param {{read: object, write: object}} input.ceiling the declared Member ceiling lanes
 * @param {{read: object, write: object}|undefined} input.restriction the declared tool restriction (binding realm only)
 * @param {string} input.target the authored locator the Provider is asked about
 * @param {{disableWriteReadPrerequisite?: boolean}} [input.mutations] TEST-ONLY
 *   mutation hooks; one control deletes S4 to prove this step is load-bearing.
 *   The product path never sets them.
 * @returns {{decision: 'allow'|'ask'|'deny', basis: string[], governingLane: object}}
 */
export function deriveOracleDecision(input) {
  const { axis, realm, ceiling, restriction, target } = input
  const mutations = input.mutations ?? {}
  if (axis !== 'read' && axis !== 'write') throw new Error(`a5sf oracle: unknown axis ${JSON.stringify(axis)}`)
  if (realm !== 'member' && realm !== 'binding') throw new Error(`a5sf oracle: unknown realm ${JSON.stringify(realm)}`)
  if (realm === 'binding' && restriction === undefined) {
    throw new Error('a5sf oracle: a binding realm needs a declared tool restriction')
  }

  // S1 — the governing lane(s) this realm is declared to enforce.
  const governingLane = realm === 'binding'
    ? intersectDeclaredLanes(ceiling[axis], restriction[axis])
    : ceiling[axis]
  const readLane = realm === 'binding'
    ? intersectDeclaredLanes(ceiling.read, restriction.read)
    : ceiling.read

  const admitted = admitLane(governingLane, target, axis === 'write')
  const basis = [`realm=${realm}`, `governing-lane=${realm === 'binding' ? 'ceiling∩restriction' : 'ceiling'}`, ...admitted.basis]
  if (admitted.decision !== 'allow') {
    return { decision: admitted.decision, basis, governingLane }
  }

  // S4 — the existing-target write must also be readable under this realm's
  // read lane (the admission contract, not a declared lane).
  if (axis === 'write' && admitted.existed === true && mutations.disableWriteReadPrerequisite !== true) {
    const prerequisite = admitLane(readLane, target, false)
    if (prerequisite.decision !== 'allow') {
      return {
        decision: 'deny',
        basis: [...basis, `write-read-prerequisite=deny(${prerequisite.basis.join(',')})`],
        governingLane,
      }
    }
    basis.push('write-read-prerequisite=allow')
  }

  return { decision: 'allow', basis, governingLane, resolved: admitted.resolved }
}
