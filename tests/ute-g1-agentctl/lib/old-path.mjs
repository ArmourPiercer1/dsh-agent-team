/**
 * old-path.mjs — the AGENT-CONTROL family's old-path identity and capture
 * facade.
 *
 * "OLD PATH" here = the governed family body (the code UTE-4 would retire),
 * mounted through the legacy governed plane + FamilyAssembly seam at C1. This
 * is NOT the product route-C composition: the Stage-0 probe measured route-C
 * serves none of the seven names (no agent-control shadow; every dispatch is an
 * `unknown tool` refusal). The native host rows are the SECOND implementation
 * and are not what this fixture records.
 *
 * The capture is deterministic by construction: the world is host-free, the
 * injected port has no clock/random, and the record keeps only the four declared
 * witnesses (payload, refusal code, read-back state, call/control counts).
 *
 * @module tests/ute-g1-agentctl/lib/old-path
 */
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../../paths.mjs'
import { CORPUS } from './corpus.mjs'
import { checkDesignClaim } from './compare.mjs'
import { runVector } from './scenario.mjs'

/** The identity the fixture is bound to (also written into old-path.meta.txt). */
export function oldPathIdentity() {
  return Object.freeze({
    host: 'none — host-free C1 (no boot, no DSH_HOME, no port)',
    hostPin: `${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA} (the pin the family's row definitions name; no host code is executed by this fixture)`,
    composition: 'legacy governed plane (createTeamToolPlaneAssembly) + FamilyAssembly seam + the dsh.agent-control-family descriptor',
    config: 'plane.agentControlEnabled = true (the family’s ONE closed boolean; ABSENT mounts nothing)',
    dispatch: 'the row’s own execute(raw, {signal, tokenKey, agent}) — the dispatch-provided fields the host runner supplies',
    effectBoundary: 'injected agent-runtime port with REAL state (roster/inbox/children/workflow) and a full call record',
  })
}

/**
 * Capture every corpus vector. Throws on a design-claim violation: a vector
 * whose claim the measured path does not satisfy must never enter a golden.
 *
 * @returns {Promise<ReadonlyArray<object>>}
 */
/** The plane's admission/observe backend writes one diagnostic line per mount
 *  to stdout. A capture is not a log transcript: suppress ONLY those lines, and
 *  restore the writer afterwards (a bare `console.log` elsewhere still prints). */
async function withQuietBackend(body) {
  const original = console.log
  console.log = (...args) => {
    const first = String(args[0] ?? '')
    if (!first.startsWith('[dsh-agent-team] ')) original(...args)
  }
  try {
    return await body()
  } finally {
    console.log = original
  }
}

export async function captureCorpus() {
  const records = []
  const claimFailures = []
  await withQuietBackend(async () => {
    for (const vector of CORPUS) {
      const record = await runVector(vector)
      claimFailures.push(...checkDesignClaim(vector, record))
      records.push(record)
    }
  })
  if (claimFailures.length > 0) {
    const detail = claimFailures.map((failure) => `${failure.id} ${failure.claim}: expected ${failure.expected}, observed ${failure.observed}`).join('\n  ')
    throw new Error(`the old path violates its own corpus design claims (a CORPUS BUG, never a green):\n  ${detail}`)
  }
  return Object.freeze(records)
}

/** Capture ONE vector (negative controls and diagnostics). */
export async function captureVector(vector, override = {}) {
  return runVector(vector, override)
}
