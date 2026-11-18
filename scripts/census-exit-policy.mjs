/**
 * census-exit-policy.mjs — the VERSIONED exit-tolerance seam (TINF trust-closeout, F-04).
 *
 * WHY IT IS A SEPARATE LEAF. The census runner (`scripts/census-execution.mjs`) produces the shard
 * artifact and the aggregator (`scripts/census-aggregate.mjs`) grades it; the aggregator must be able
 * to tell a tolerated nonzero process exit from an unexplained one WITHOUT importing the runner (the
 * runner imports the aggregator — a cycle). So the policy lives here, with no imports of its own.
 *
 * THE DEFAULT IS EMPTY. Today `exitTolerances: []`: a green report beside a non-zero exit is a
 * refusal (CENSUS_EXIT_NONZERO) and a shard that claims COMPLETED with a nonzero exit is
 * INFRA_ERROR. The code path for a tolerance exists, but it fires only for an entry that names the
 * exact code/signal AND carries an owner, a reason and an `expires` date that has not passed. There
 * is no wildcard, no "any code", no default-tolerate.
 *
 * @module scripts/census-exit-policy
 */

import { createHash } from 'node:crypto'

export const EXIT_POLICY_SCHEMA = 'census-exit-policy/1'

export const EXIT_POLICY = Object.freeze({
  schema: EXIT_POLICY_SCHEMA,
  version: 1,
  note:
    'Tolerated non-zero census exits. EMPTY by design: a green report from a non-zero process is RED. ' +
    'An entry must name code/signal, owner, reason and expires (ISO date); an expired or malformed ' +
    'entry is not a tolerance.',
  exitTolerances: Object.freeze([]),
})

/**
 * A stable digest over the policy, written into every shard artifact. The aggregator accepts a
 * nonzero exit only when the shard names THIS policy digest and the policy itself contains the
 * matching, non-expired entry — a shard cannot declare its own tolerance.
 */
export function exitPolicyDigest(policy = EXIT_POLICY) {
  const entries = Array.isArray(policy?.exitTolerances) ? policy.exitTolerances : []
  return `sha256:${createHash('sha256').update(JSON.stringify({ schema: policy?.schema ?? null, version: policy?.version ?? null, exitTolerances: entries })).digest('hex')}`
}

/**
 * Is this exact exit tolerable? Code AND signal must match; the entry must be well-formed and its
 * `expires` date must be today or later.
 *
 * @returns {{tolerated: true, entry: object} | {tolerated: false, entry: null}}
 */
export function exitTolerance({ code, signal = null, policy = EXIT_POLICY, today = new Date() } = {}) {
  const entries = Array.isArray(policy?.exitTolerances) ? policy.exitTolerances : []
  const day = typeof today === 'string' ? today : today.toISOString().slice(0, 10)
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.code !== code) continue
    if ((entry.signal ?? null) !== (signal ?? null)) continue
    if (typeof entry.owner !== 'string' || entry.owner === '') continue
    if (typeof entry.reason !== 'string' || entry.reason === '') continue
    if (typeof entry.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) continue
    if (entry.expires < day) continue
    return { tolerated: true, entry }
  }
  return { tolerated: false, entry: null }
}
