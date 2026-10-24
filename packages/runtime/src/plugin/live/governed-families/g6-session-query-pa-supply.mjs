/**
 * governed-families/g6-session-query-pa-supply.mjs — A5M2-G6 Card B (root
 * 01:1x): the REAL PA ASSEMBLY / SUPPLY FILE BLOCK for the B-SESSION-QUERY
 * family's deployment evidence.
 *
 * WHAT THIS IS. The plane consumes the family supply through
 * `backends.sessionQuery` (team-tool-plane.mjs:1139-1157) and agent-bindings
 * forwards it verbatim from `planeCfg.sessionQuery`, adding ONLY the
 * member-scoped `readNative` capture (agent-bindings.mjs:3208-3260 — the
 * capture side is THAT file's law, not this file's). Until this block, the
 * `planeCfg.sessionQuery` shape itself was assembled only by test fixtures
 * and the boot kit: nothing production-shaped assembled it, and nothing
 * required that the mount it supplies is a mount the PA verifier can already
 * SEE. This file closes exactly that gap and nothing else:
 * `assembleG6SessionQuerySupply` turns presented deployment facts into the
 * frozen supply block — and refuses when the PA mount behind
 * (teamRoot, instanceId) is absent or answers a different instance.
 *
 * REUSE, NEVER RESTATED. The registry face used here is the EXISTING public
 * query shape — `resolvePaMount` (pa-mount-registry.mjs:104), the same call
 * the PA facts reader obeys (readPaCallFactsForCall's mount lookup and its
 * mount-instance-mismatch arm). NO new getter, NO new ledger, NO second
 * index: this block reads the ONE mount table and writes nothing to it.
 * Field minimums mirror the PLANE's own inject gate (:1144-1156) so a supply
 * that assembles here is a supply the plane will accept; the declared-mount
 * EVIDENCE semantics stay owned by the adapter (g6-session-query.mjs decides
 * at placement — this file adds no evidence gate of its own, never widens).
 * The presence-omission law for `maxSearchResults` (key OMITTED when
 * absent — root 19:25, the mint-side law this supply side obeys so an
 * absent cap never reaches the plane as key-with-undefined) is applied here
 * too: absent cap = key GONE.
 *
 * HONEST BOUNDARIES. No Host boot, no network, no :3080/:3180 — there is no
 * Host on this path, so the assembly dimension is 接线未测 (wired-untested);
 * nothing here claims 已测试 at any assembly level, and the family stays
 * 未开发（部分实现）. The supply is DATA: it carries whatever ports/caller/
 * ceiling functions are presented (the plane's hard-visit gate and the
 * adapter's own law decide their fate downstream); this block never invents
 * a fact, never substitutes a stand-in, and never marks a mount deployed.
 */

import { resolvePaMount } from '../pa-mount-registry.mjs'

export const A5_G6_PA_SUPPLY_REVISION = 1
export const A5_G6_PA_SUPPLY_FAMILY = 'B-SESSION-QUERY'

/** Closed refusal codes of THIS block (governance plane, P_G6_* namespace). */
export const A5_G6_PA_SUPPLY_CODES = Object.freeze({
  INPUT_INVALID: 'P_G6_SUPPLY_INPUT_INVALID',
  MOUNT_ABSENT: 'P_G6_SUPPLY_MOUNT_ABSENT',
  MOUNT_IDENTITY_MISMATCH: 'P_G6_SUPPLY_MOUNT_IDENTITY_MISMATCH',
})

const KNOWN_INPUT_KEYS = Object.freeze([
  'teamRoot', 'instanceId', 'providerId', 'queryPorts', 'readCaller', 'teamCeiling', 'declaredMount', 'maxSearchResults',
])

const isRec = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const refuse = (code, detail) => Object.freeze({ ok: false, code, detail })

const freezeSupply = (value) => {
  // Only THIS block's own record and its supply envelope are frozen. The
  // presented queryPorts / declaredMount / readCaller / teamCeiling ride BY
  // REFERENCE: they are the owner's live objects (the engine facet may
  // legitimately mutate itself; the evidence record belongs to the Team
  // plane owner). Freezing somebody else's object is not this block's
  // authority — the plane's hard-visit gate and the adapter law decide
  // their fate downstream, exactly as with a hand-assembled supply.
  Object.freeze(value)
  return Object.freeze({ ok: true, value })
}

/**
 * Assemble the frozen `planeCfg.sessionQuery` supply block for one mount.
 * Returns { ok: true, value } or a { ok: false, code, detail } refusal —
 * never a throw for a config defect, never a partially assembled supply.
 */
export function assembleG6SessionQuerySupply(input = {}) {
  if (!isRec(input)) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'the supply assembly takes exactly one plain record')
  }
  for (const key of Object.keys(input)) {
    if (!KNOWN_INPUT_KEYS.includes(key)) {
      return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, `unknown supply input '${key}' — the block takes exactly {teamRoot, instanceId, providerId, queryPorts, readCaller, teamCeiling, declaredMount, maxSearchResults?}`)
    }
  }
  const { teamRoot, instanceId, providerId, queryPorts, readCaller, teamCeiling, declaredMount, maxSearchResults } = input
  if (typeof teamRoot !== 'string' || teamRoot.length === 0) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'teamRoot must be a non-empty string — the PA mount lookup key is lexical, never inferred')
  }
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'instanceId must be a non-empty string — the PA mount lookup key is lexical, never inferred')
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'providerId must be a non-empty string (plane gate team-tool-plane.mjs:1144)')
  }
  if (!isRec(queryPorts)) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'queryPorts must be a record (plane gate team-tool-plane.mjs:1148); which facets are PRESENT and which functions they answer is the plane hard-visit gate and the adapter law, not this block')
  }
  if (typeof readCaller !== 'function' || typeof teamCeiling !== 'function') {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'readCaller and teamCeiling must be functions (plane gates team-tool-plane.mjs:1150-1152) — no stand-in is ever supplied here')
  }
  if (!isRec(declaredMount) || !isRec(declaredMount.searchBackend)) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'declaredMount must be a record carrying a searchBackend record (plane gate team-tool-plane.mjs:1154); the EVIDENCE semantics inside are owned by the adapter at placement')
  }
  if (maxSearchResults !== undefined && !(typeof maxSearchResults === 'number' && Number.isSafeInteger(maxSearchResults) && maxSearchResults > 0)) {
    return refuse(A5_G6_PA_SUPPLY_CODES.INPUT_INVALID, 'maxSearchResults, when present, must be a positive safe integer — an absent cap OMITS the key (presence-omission law, root 19:25), it never travels as undefined')
  }

  // THE MOUNT MUST ALREADY BE PA-VISIBLE: the ONE public query, the ONE
  // table. An absent mount means the family would deploy evidence into a
  // world the PA verifier cannot resolve — refused, and no getter or second
  // index is invented to make it resolvable.
  const mount = resolvePaMount(teamRoot, instanceId)
  if (mount === undefined) {
    return refuse(A5_G6_PA_SUPPLY_CODES.MOUNT_ABSENT, `no PA mount is published for (teamRoot='${teamRoot}', instanceId='${instanceId}') — session-query deployment evidence cannot exist for a mount the PA verifier cannot resolve; publish the mount first (publishPaMount), never a stand-in`)
  }
  if (String(mount.instanceId) !== String(instanceId)) {
    return refuse(A5_G6_PA_SUPPLY_CODES.MOUNT_IDENTITY_MISMATCH, `the resolved PA mount answers instanceId '${String(mount.instanceId)}', not the presented '${instanceId}' — the same mismatch law the PA facts reader obeys (readPaCallFactsForCall mount-instance-mismatch)`)
  }

  return freezeSupply({
    providerId,
    queryPorts,
    readCaller,
    teamCeiling,
    declaredMount,
    ...(maxSearchResults === undefined ? {} : { maxSearchResults }),
  })
}
