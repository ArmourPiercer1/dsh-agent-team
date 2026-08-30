/**
 * slots-t6.mjs — the REAL T2/T3/T4 overlay slot bindings for the P5-T6
 * real-instance harness (public DSH surface only; no private APIs).
 *
 * T6-owned fork of the T5 harness module (root-binding/harness/slots.mjs,
 * read-only for this task): identical wiring, rebranded to the P5-T6
 * namespace. The mini-MCP server name matches the P5-T6 blueprint
 * capability facet ('p5t6mini') — the T5 original hard-codes 'p5t5mini',
 * which would surface its tool as mcp__p5t5mini__ping on a T6 member.
 *
 * Builds, per scenario, the three live overlay slots the productized
 * root-binding module drives through the P5-T1 binder:
 *
 * - persona  — `createPersonaOverlaySlot` with
 *     presetSeam   = a closure over the PRE-RESOLVED substrate facts
 *                    (resolvePersonaSubstrate, one disposable probe agent —
 *                    the real `agentPresets` + `systemPrompt.assemble`
 *                    detection P2-T3 pinned: complete persona collapses the
 *                    assembly to the single section);
 *     personaSource = the directive's immutable Blueprint persona payload
 *                    (the real T5 source would read the durable snapshot
 *                    store; the directive IS that payload for the harness);
 *     promptSurface = the public `agentPresets.mount(agent.ctx, presetId)`
 *                    composition effect (registration is the synchronous
 *                    effect; the async mount settles through
 *                    `pendingEffects`, verified by the handler).
 * - model    — `TeamModelOverlaySlot` + `TeamModelSelectionAdapter` over a
 *     ModelSelectionSource backed by the public `installModelSelection`
 *     ref (live current/assembled) plus the durable `model/selection`
 *     session append (the P2-T3 cold-resume seed pattern).
 * - capability — `createCapabilityOverlaySlot` over four REAL facet seams
 *     on the live agent scope: `tools.register` (per item),
 *     `ctx.get('skills').register` (per item), `agentCtx.plugin(mcpClient,
 *     mcpConfig)` (the mini-MCP fiber; activation async), and the
 *     `tools/pre-execute` + `agent/pre-step` waterfall listeners.
 *
 * Imports: the TS slot factories come through NodeNext `.js` specifiers
 * rewritten by ts-loader.mjs (registered by plugin.mjs before this module
 * loads); the DSH bare specifiers resolve through the harness's
 * gitignored node_modules junction farm.
 *
 * Plain .mjs; `node:` builtins allowed (harness plumbing).
 * @module @dsh-agent-team/runtime/member-residency/harness/slots-t6
 */
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'

import { createPersonaOverlaySlot } from '../../agent-setup/persona/index.js'
import { TeamModelOverlaySlot, TeamModelSelectionAdapter } from '../../agent-setup/model/index.js'
import { createCapabilityOverlaySlot } from '../../agent-setup/capability/index.js'

/**
 * One tool definition for a capability-facet item (public tools.register
 * shape; the P2-T4 makeTool form).
 * @param {string} name - the tool name (the facet item).
 * @returns {object} the tool definition.
 */
function makeToolDef(name) {
  return {
    name,
    description: `P5-T6 team capability tool ${name}`,
    parameters: {
      type: 'object',
      properties: { msg: { type: 'string' } },
      required: ['msg'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: { origin: { type: 'string' }, msg: { type: 'string' } },
        required: ['origin', 'msg'],
        additionalProperties: false,
      },
      render(args, value) {
        return [{ type: 'text', text: `${value.origin}:${value.msg}` }]
      },
    },
    execute(args) {
      return { origin: 'p5t6-team', msg: args.msg }
    },
  }
}

/**
 * One mcp-client configuration for the live mini endpoint (public
 * streamable-http transport; the P2-T4 mcpConfig form).
 * @param {number} mcpPort - the live mini-MCP port.
 * @param {string} serverName - the MCP server name.
 * @returns {object} the mcpClient configuration.
 */
function mcpConfig(mcpPort, serverName) {
  return {
    transport: 'streamable-http',
    serverName,
    url: `http://127.0.0.1:${mcpPort}/mcp`,
    headers: {},
    toolCallTimeoutMs: 15_000,
    failOnStartupError: true,
  }
}

/**
 * Pre-resolve the AgentPreset substrate facts with the REAL public
 * surface: one disposable probe agent created with
 * `meta: {agentPreset: presetId}` (the P2-T3 creation path), assembled
 * through `systemPrompt.assemble`, then disposed.
 *
 * Detection (P2-T3 pinned semantics): no persona section -> `absent`;
 * persona present and the assembly collapsed to exactly that section
 * (complete:true) -> `complete`; persona present among the first-party
 * sections -> `standard`.
 *
 * @param {object} deps
 * @param {object} deps.agents - the DSH agents service.
 * @param {object} deps.agentPresets - the DSH agentPresets service.
 * @param {object} deps.systemPrompt - the DSH systemPrompt service.
 * @param {string} deps.presetId - the team persona preset id.
 * @param {string} deps.stamp - a run-unique stamp for the probe session id.
 * @returns {Promise<{presetId: string, personaKind: 'absent'|'standard'|'complete', probeSections: string[], probePersonaText: string|null, probeSessionId: string}>}
 */
export async function resolvePersonaSubstrate({ agents, agentPresets, systemPrompt, presetId, stamp }) {
  const probeSessionId = `p5t6-substrate-probe-${stamp}`
  const handle = await agents.create({
    sessionId: SessionId(probeSessionId),
    meta: { cwd: process.env.DSH_HOME ?? process.cwd(), agentPreset: presetId },
  })
  try {
    const assembly = await systemPrompt.assemble({ scope: scopeOf(handle.agent.ctx) })
    const persona = assembly.sections.find((s) => s.name === PERSONA_SECTION)
    const personaKind = persona === undefined ? 'absent' : (assembly.sections.length === 1 ? 'complete' : 'standard')
    return {
      presetId,
      personaKind,
      probeSections: assembly.sections.map((s) => s.name),
      probePersonaText: persona === undefined ? null : persona.text,
      probeSessionId,
    }
  } finally {
    await handle.dispose()
  }
}

/**
 * Build the three REAL overlay slots plus their observation record for one
 * scenario agent.
 *
 * @param {object} deps
 * @param {object} deps.agents - the DSH agents service.
 * @param {object} deps.agentPresets - the DSH agentPresets service.
 * @param {object} deps.systemPrompt - the DSH systemPrompt service.
 * @param {object} deps.directive - the parsed p5t6-directive.json payload.
 * @param {object} deps.handle - the live agent handle (created by the caller).
 * @param {string} deps.presetId - the team persona preset id.
 * @param {number} deps.mcpPort - the live mini-MCP port.
 * @param {string} deps.stamp - a run-unique stamp.
 * @returns {{
 *   slots: {persona: object, model: object, capability: object},
 *   substrate: object,
 *   modelRef: object,
 *   modelSource: object,
 *   pendingEffects: Promise[],
 *   mcpFiber: object|null,
 *   disposers: Function[],
 *   obs: object,
 * }} the slots and every observation handle the scenario handler reads.
 */
export async function buildRealSlots({ agents, agentPresets, systemPrompt, directive, handle, presetId, mcpPort, stamp }) {
  const agent = handle.agent
  const obs = {
    toolsRegistered: [],
    skillsRegistered: [],
    mcpMount: null,
    mcpActivationError: null,
    listeners: [],
    preExecuteCalls: [],
    preStepCalls: [],
    mountErrors: [],
  }
  const disposers = []
  const pendingEffects = []

  // ── persona ────────────────────────────────────────────────────────────
  const substrate = await resolvePersonaSubstrate({ agents, agentPresets, systemPrompt, presetId, stamp })

  const personaSource = {
    getLeaderPersona: (rootSessionId) => {
      const text = directive.blueprint.leaderPersona
      if (typeof text !== 'string' || text.length === 0) {
        throw new Error(`p5t6: directive blueprint has no leader persona text for root '${rootSessionId}'`)
      }
      return text
    },
    getMemberPersona: (rootSessionId, templateId) => {
      const text = directive.blueprint.memberPersonas?.[templateId]
      if (typeof text !== 'string' || text.length === 0) {
        throw new Error(`p5t6: directive blueprint has no member persona for template '${templateId}' of root '${rootSessionId}'`)
      }
      return text
    },
  }

  const promptSurface = {
    installScopedPersona(sessionId, identity) {
      const mount = agentPresets.mount(agent.ctx, identity.presetId)
      pendingEffects.push(
        mount.catch((error) => {
          obs.mountErrors.push({ sessionId, presetId: identity.presetId, message: String(error?.message ?? error) })
          throw error
        }),
      )
    },
  }

  const personaSlot = createPersonaOverlaySlot({
    presetSeam: { getSubstrate: (rootSessionId) => substrate },
    personaSource,
    promptSurface,
    // evaluateCompatibility intentionally absent: the REAL P3-T5 pure engine
    // is the default (the T2 contract).
  })

  // ── model ──────────────────────────────────────────────────────────────
  const modelRef = { current: undefined, assembled: undefined }
  disposers.push(installModelSelection(agent.ctx, modelRef))
  const modelSource = {
    current: () => modelRef.current,
    select(next) {
      modelRef.current = {
        provider: next.provider,
        model: next.model,
        ...(next.reasoningEffort === undefined ? {} : { reasoningEffort: next.reasoningEffort }),
      }
      // Durable seed (the P2-T3 cold-resume pattern): the persisted
      // model/selection event survives the restart and is captured at the
      // first post-resume assembly boundary.
      handle.agent.session.append('model/selection', modelRef.current)
    },
  }
  const modelSlot = new TeamModelOverlaySlot(new TeamModelSelectionAdapter(modelSource))

  // ── capability ─────────────────────────────────────────────────────────
  const cap = directive.capability
  let mcpFiber = null
  const facetSeams = {
    'tools-permissions': {
      available: true,
      install(items) {
        for (const name of items) {
          disposers.push(agent.ctx.tools.register(makeToolDef(name)))
          obs.toolsRegistered.push(name)
        }
      },
    },
    skills: {
      available: true,
      install(items) {
        const skills = agent.ctx.get('skills')
        for (const name of items) {
          disposers.push(skills.register({
            name,
            description: `P5-T6 team skill ${name}`,
            content: `# P5-T6 team skill ${name}\n\nInstalled through the public agent-scoped skills seam by the P5-T6 capability facet.`,
            provider: 'p5t6-team',
          }))
          obs.skillsRegistered.push(name)
        }
      },
    },
    mcp: {
      available: true,
      install(items) {
        for (const name of items) {
          mcpFiber = agent.ctx.plugin(mcpClient, mcpConfig(mcpPort, 'p5t6mini'))
          obs.mcpMount = { ok: true, serverName: 'p5t6mini', port: mcpPort, item: name }
          // Activation is async (connection + tool discovery); the scenario
          // handler polls the agent tool view. A rejection must not become
          // an unhandled rejection of the plugin process.
          Promise.resolve(mcpFiber).catch((error) => {
            obs.mcpActivationError = String(error?.message ?? error)
          })
        }
      },
    },
    'pre-step-pre-execute': {
      available: true,
      install(items) {
        if (items.includes('tools/pre-execute')) {
          disposers.push(agent.ctx.on('tools/pre-execute', (exec, next) => {
            obs.preExecuteCalls.push({ name: exec.name })
            return next()
          }))
          obs.listeners.push('tools/pre-execute')
        }
        if (items.includes('agent/pre-step')) {
          disposers.push(agent.ctx.on('agent/pre-step', (payload, next) => {
            obs.preStepCalls.push({ turn: payload.turn, step: payload.step })
            return next()
          }))
          obs.listeners.push('agent/pre-step')
        }
      },
    },
  }
  const capabilitySlot = createCapabilityOverlaySlot({
    config: {
      facets: {
        'tools-permissions': { seam: facetSeams['tools-permissions'], sources: cap.toolsPermissions },
        skills: { seam: facetSeams.skills, sources: cap.skills },
        mcp: { seam: facetSeams.mcp, sources: cap.mcp },
        'pre-step-pre-execute': { seam: facetSeams['pre-step-pre-execute'], sources: cap.preStepPreExecute },
      },
    },
  })

  return {
    slots: { persona: personaSlot, model: modelSlot, capability: capabilitySlot },
    substrate,
    modelRef,
    modelSource,
    pendingEffects,
    mcpFiber: () => mcpFiber,
    disposers,
    obs,
  }
}

/**
 * Dispose every effect the slot build registered (scenario teardown).
 * @param {Function[]} disposers - disposer functions.
 * @returns {Promise<void>}
 */
export async function disposeSlotEffects(disposers) {
  for (const dispose of disposers) {
    try {
      dispose()
    } catch {
      /* per-disposer best effort; the scenario report already carries the state */
    }
  }
}
