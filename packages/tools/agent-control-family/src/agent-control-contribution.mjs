/**
 * agent-control-family/src/agent-control-contribution.mjs — the AGENT-CONTROL
 * family's contribution DESCRIPTOR: ONE candidate carrying the SEVEN governed
 * rows (`subagent`, `subagent_fork`, `send_message`, `interrupt_agent`,
 * `list_agents`, `list_subagent_models`, `workflow`) the family mounts
 * together (U7-F, CA-01: zero center diff).
 *
 * DATA, NOT AUTHORITY (CI-06): admission / grant mint / grant consume are
 * stated as `kernel`, and nothing here decides, admits, or grants.
 *
 * THE EFFECT DECLARATION IS THE ENUMERATION/MUTATION SPLIT (law (a)), stated
 * once and honestly: the kinds the lane can EVER derive are `tool-invoke`
 * (every row, its own name), `meta` (the two enumeration rows' read-only
 * metadata views + the fork row's conversation-context disclosure) and
 * `domain-ref` (the five mutation rows' cross-authority arm: the agent
 * runtime decides spawn/steer AT COMMIT). The enumeration rows never derive
 * the domain-ref arm — C1 pins the SAME constants from the actual per-call
 * PA requested-effect sets, so the declaration cannot outrun the request.
 *
 * @module agent-control-family/agent-control-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import {
  AGENT_CONTROL_NAMES,
  AGENT_ROSTER_VIEW,
  AGENT_RUNTIME_DOMAIN_AUTHORITY,
  CONVERSATION_CONTEXT_VIEW,
  MODEL_ROUTES_VIEW,
} from './agent-control-mechanics.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** LOSSLESS-JSON law (same as the fs lane): every function in the bound
 *  namespaces is pinned as its SOURCE TEXT. */
function sourceLossless(value) {
  if (typeof value === 'function') return value.toString()
  if (Array.isArray(value)) return value.map(sourceLossless)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceLossless(v)]))
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') return `[${typeof value}]`
  return value
}

/**
 * Build the agent-control-family contribution for one mount.
 *
 * @param {object} input
 * @param {object} input.spawnDefinition … input.workflowDefinition - the
 *   SEVEN placed row Definitions (the family mounts them together or not at
 *   all; each must carry its placed transport function).
 * @param {object} input.executors - the seven executor functions keyed by
 *   row name (bound at the trusted assembly; pinned as source text).
 * @param {object} input.mechanics - the mechanics module namespace.
 * @param {object} input.portModule - the port-contract namespace.
 * @param {object} input.executorModule - the executor namespace.
 * @param {string} input.cancelBoundary
 */
export function buildAgentControlContribution({
  spawnDefinition, forkDefinition, steerDefinition, interruptDefinition,
  listAgentsDefinition, listModelsDefinition, workflowDefinition,
  executors, mechanics, portModule, executorModule, cancelBoundary,
}) {
  // ONE ordered list; the family mounts whole or not at all (fail closed).
  const placed = [spawnDefinition, forkDefinition, steerDefinition, interruptDefinition,
    listAgentsDefinition, listModelsDefinition, workflowDefinition]
  const names = placed.map((d) => d?.name)
  if (placed.some((d) => d === null || d === undefined)
    || names.length !== AGENT_CONTROL_NAMES.length
    || AGENT_CONTROL_NAMES.some((n, i) => names[i] !== n)) {
    throw new TypeError(`buildAgentControlContribution: the SEVEN rows ${AGENT_CONTROL_NAMES.join(', ')} must all be present, in order — the family mounts whole or not at all (fail closed)`)
  }
  for (const definition of placed) {
    if (typeof definition.execute !== 'function' || typeof executors?.[definition.name] !== 'function') {
      throw new TypeError('buildAgentControlContribution: every row needs its placed transport AND its executor')
    }
  }
  const rows = placed.map((definition) => ({ definition, executor: executors[definition.name] }))
  const inputContractDigest = sha256Hex(canonicalJsonStringify(placed.map((definition) => ({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))))
  const outputContractDigest = sha256Hex(canonicalJsonStringify(placed.map((definition) => ({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
  }))))
  const sourceDocument = canonicalJsonStringify({
    rows: rows.map((r) => ({
      name: r.definition.name,
      parameters: r.definition.parameters,
      execute: r.definition.execute?.toString?.() ?? null,
      executor: r.executor?.toString?.() ?? null,
    })),
    mechanics: sourceLossless(mechanics),
    port: sourceLossless(portModule),
    executorLaw: sourceLossless(executorModule),
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.agent-control-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/agent-control-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/agent-control-family',
      digest: sha256Hex(canonicalJsonStringify({
        familyId: 'dsh.agent-control-family',
        selector: 'packages/tools/agent-control-family/src',
        rows: [...AGENT_CONTROL_NAMES],
      })),
    },
    requiredCapabilities: ['agent-control'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The takeover spelling law (§ CI-04): FIXED native spellings (the
      // jobs/fs precedent), seven bound definitions, seven claims. The
      // bound-definition form ([<def>.name, …]) is the ARC-A L4 literal
      // law — one explicit claim per placed row, nothing dynamic.
      nativeNames: [
        spawnDefinition.name, forkDefinition.name, steerDefinition.name,
        interruptDefinition.name, listAgentsDefinition.name,
        listModelsDefinition.name, workflowDefinition.name,
      ],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest,
      outputContractDigest,
      normalization: 'pure',
    },
    effects: {
      declared: true,
      // Law (a) as DATA: tool-invoke for every row; meta for the
      // read-only enumeration views and the fork's context disclosure;
      // domain-ref ONLY for the five spawn/steer rows (the agent runtime
      // is the authority that decides at commit). C1 proves the
      // enumeration rows never REQUEST the domain-ref arm.
      kinds: ['tool-invoke', 'meta', 'domain-ref'],
      targets: [AGENT_ROSTER_VIEW, MODEL_ROUTES_VIEW, CONVERSATION_CONTEXT_VIEW, AGENT_RUNTIME_DOMAIN_AUTHORITY],
    },
    execution: {
      declared: true,
      via: 'family-body',
    },
    lifecycle: {
      owner: 'kernel',
      drain: 'kernel-owned',
      cancelBoundary,
    },
    result: {
      envelope: 'host',
      correlation: 'kernel',
    },
    obligations: {
      admission: 'kernel',
      grantMint: 'kernel',
      grantConsume: 'kernel',
    },
  }
}
