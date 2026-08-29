/**
 * P2-T5 negative fixture — stale/self-targeting ancestor interrupt authority
 * (seam: descendants).
 *
 * The public interrupt authority union is:
 *   { kind: 'user', parentSessionId } | { kind: 'ancestor', agent }
 * An `ancestor` authority is only valid when the presenting agent is a LIVE
 * ANCESTOR of the target. A self-targeting (or otherwise stale — no longer
 * an ancestor) presenting agent must be rejected loudly with SubagentError
 * code 'UNAUTHORIZED'; a silent no-op would let a stale handle cancel turns
 * it has no right to touch.
 *
 * This module is a data document, not code: it is imported by the probe
 * group (which never mounts it) and its `expected` block is cross-checked
 * against the LIVE observation the seed phase recorded by exercising the
 * real API (obs-seed.json -> data.interrupt.selfAncestor).
 */
export const fixture = {
  seam: 'descendants',
  name: 'stale-ancestor-authority',
  kind: 'authority',
  authority: { kind: 'ancestor', agent: '<self or stale agent reference>' },
  expected: { throws: true, code: 'UNAUTHORIZED' },
  liveObservationPath: 'data.interrupt.selfAncestor',
  notes:
    'Exercised live in the seed phase: interrupt(root, {kind:"ancestor", agent: rootAgent}) — the presenting agent is the target itself, the stalest possible case.',
}
