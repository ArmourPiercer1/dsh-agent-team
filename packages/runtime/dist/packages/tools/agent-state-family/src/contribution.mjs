/**
 * agent-state-family/src/contribution.mjs — the closed-schema contribution
 * of the agent-state family (one contribution for the whole family, the fs
 * precedent: one source digest binding the lane, one effects declaration,
 * every obligation named for the kernel).
 *
 * READ vs MUTATION is declared per row in `effectArms` below (the same
 * table the per-call PA requests are built from — the C1 test pins
 * declared == requested per tool):
 *  - `get_goal`   : the metadata `meta` arm of the caller's goal view ONLY
 *                   (a read; no mutation-bearing arm exists in its set).
 *  - the four
 *    mutators    : their own `tool-invoke` arm (the honest carrier of a
 *                   session-state mutation — the closed vocabulary gives
 *                   `metadata` only the `meta` right; tool-invoke acts on
 *                   its own arm) + the metadata `meta` arm of the state
 *                   resource the call reads for its precondition/CAS legs.
 *
 * @module tools/agent-state-family/contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../domain/tool-governance/src/index.js'
import { AGENT_STATE_NAMES } from './executors.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The per-tool effect-arm law (declaration; the executors REQUEST exactly
 *  these arms on every call — the C1 equality test pins it). `arm` tokens:
 *  `tool-invoke` = the row's own invocation arm; `meta:<resource>` = the
 *  metadata meta-arm of `agent-state/<scope>/<resource>`. */
export const AGENT_STATE_EFFECT_ARMS = Object.freeze({
  get_goal: Object.freeze(['meta:goal']),
  create_goal: Object.freeze(['tool-invoke', 'meta:goal']),
  update_goal: Object.freeze(['tool-invoke', 'meta:goal']),
  todo_write: Object.freeze(['tool-invoke', 'meta:todos']),
  exit_plan_mode: Object.freeze(['tool-invoke', 'meta:plan-mode']),
})

export function buildAgentStateContribution({ rowDefinitions }) {
  const digest = sha256Hex(canonicalJsonStringify({
    familyId: 'dsh.agent-state-family',
    selector: 'packages/tools/agent-state-family/src',
    rows: AGENT_STATE_NAMES,
  }))
  const inputContractDigest = sha256Hex(canonicalJsonStringify(rowDefinitions.map((def) => ({
    name: def.name,
    parameters: def.parameters,
  }))))
  const contribution = {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.agent-state-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/agent-state-family/src',
      digest,
    },
    provider: {
      // CI-07 (the fs precedent): the NAMED, reviewed provider of these
      // bodies is the family lane itself — the closed schema requires the
      // provider identity even for a family-owned source.
      id: 'dsh-agent-team/agent-state-family',
      digest: sha256Hex(canonicalJsonStringify({
        familyId: 'dsh.agent-state-family',
        selector: 'packages/tools/agent-state-family/src',
        rows: [...AGENT_STATE_NAMES],
        arms: AGENT_STATE_EFFECT_ARMS,
      })),
    },
    requiredCapabilities: ['agent-state'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The ARC-A L4 law reads native names as LITERALS in the contribution
      // source — pinned as the same five the executors implement (the guard
      // at build fails closed if the two lists ever drift).
      nativeNames: ['todo_write', 'create_goal', 'get_goal', 'update_goal', 'exit_plan_mode'],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest,
      outputContractDigest: sha256Hex(canonicalJsonStringify({
        envelope: 'host-text',
        rows: Object.entries(AGENT_STATE_EFFECT_ARMS).map(([name, arms]) => ({ name, arms })),
      })),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      kinds: ['tool-invoke', 'meta'],
      targets: ['agent-state:session-scoped-metadata'],
    },
    execution: { declared: true, via: 'family-body' },
    lifecycle: {
      owner: 'kernel',
      drain: 'kernel-owned',
      cancelBoundary: 'the store legs are bounded pure/async calls settled per invocation; the host abort signal is carried into the PA edge and a cancelled execution never reaches the store (the PA edge itself settles `cancelled`)',
    },
    result: { envelope: 'host', correlation: 'kernel' },
    obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
  }
  // Fail-closed drift guard: the L4-pinned LITERAL names above and the
  // executor list MUST be the same five spellings — one truth, checked at
  // every build (a drift throws; it never mounts a lying candidate).
  if (contribution.visibility.nativeNames.length !== AGENT_STATE_NAMES.length
    || contribution.visibility.nativeNames.some((n) => !AGENT_STATE_NAMES.includes(n))) {
    throw new Error('agent-state contribution: the pinned literal nativeNames and the executor AGENT_STATE_NAMES list have drifted — one list, one truth')
  }
  return contribution
}
