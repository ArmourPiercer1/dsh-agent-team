/**
 * P2-T3 probe payload (boot 2/2) — cold-resume verification of the session
 * seeded by plugins/main.js in a PREVIOUS process.
 *
 * Replicates the app's cold-resume path with the public surface only:
 *   1. observe the durable session through `sessionQuery.observeSession` and
 *      read the recorded `agentPreset` from its projections (reconstruction
 *      reads the agentPreset Session projection, never the header alone);
 *   2. `agentPresets.resolve` that preset and re-join it on resume via
 *      `agents.resume({ resumeSessionId, setup })`, with setup installing the
 *      model selection first and then mounting the preset (app-faithful
 *      order);
 *   3. assert the resumed composition: composedPreset, projections, the
 *      persisted `model/selection` event surviving the process restart, the
 *      projection's `pending` captured as the live selection at the first
 *      post-resume prompt assembly (the §40.3 assembly boundary), and the
 *      rebuilt prompt sections being byte-identical to the original
 *      composition.
 *
 * Writes resume-verify.json and finally done-resume.json into
 *   <worktree>/dev/agent-workflow/evidence/P2-T3/run/observations/
 * apply() never throws.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { SessionId } from '@deepseek-ai/dsh-session'

const HERE = dirname(fileURLToPath(import.meta.url))
// plugins/ -> preset-persona-model/ -> probes/ -> characterization/ -> tests/ -> worktree root
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const OBS_DIR = join(WORKTREE_ROOT, 'dev', 'agent-workflow', 'evidence', 'P2-T3', 'run', 'observations')
const COORD_PATH = join(OBS_DIR, 'coord.json')

const RECORDED_EVENT_TYPES = new Set(['model/selection', 'agent-preset/selected', 'turn/start', 'turn/end'])

export const name = 'p2t3-preset-persona-model-resume'
// Hard service dependencies (public `inject` protocol): the Loader defers this
// row's apply until every listed service exists. Boot A proved a bare early
// apply races late-registering rows (agent-presets waits on `loader`,
// session-query-sqlite waits on `sessions`), so the payload must declare all
// five services it consumes.
export const inject = ['agentPresets', 'agents', 'systemPrompt', 'sessionProjections', 'sessionQuery']

function writeObs(file, value) {
  mkdirSync(OBS_DIR, { recursive: true })
  writeFileSync(join(OBS_DIR, file), JSON.stringify(value, null, 2))
}

function failureOf(error) {
  return {
    name: error instanceof Error ? error.constructor.name : typeof error,
    message: String(error instanceof Error ? error.message : error),
    code: error?.code ?? error?.failure?.code ?? null,
  }
}

export function apply(ctx) {
  run(ctx).catch((error) => {
    writeObs('done-resume.json', { completed: false, reason: failureOf(error).message })
  })
}

async function run(ctx) {
  const agentPresets = ctx.get('agentPresets')
  const agents = ctx.get('agents')
  const systemPrompt = ctx.get('systemPrompt')
  const sessionProjections = ctx.get('sessionProjections')
  const sessionQuery = ctx.get('sessionQuery')
  const result = {
    services: {
      agentPresets: agentPresets !== undefined,
      agents: agents !== undefined,
      systemPrompt: systemPrompt !== undefined,
      sessionProjections: sessionProjections !== undefined,
      sessionQuery: sessionQuery !== undefined,
    },
  }
  if (agentPresets === undefined || agents === undefined || systemPrompt === undefined) {
    writeObs('resume-verify.json', result)
    writeObs('done-resume.json', { completed: false, reason: 'missing required service(s)' })
    return
  }

  let coord = null
  try {
    coord = JSON.parse(readFileSync(COORD_PATH, 'utf8'))
  } catch (e) {
    result.coord = { error: failureOf(e) }
  }
  if (coord === null || coord.resumeSessionId === undefined) {
    result.error = 'no coord.json written by the main payload (boot 1) — nothing to resume'
    writeObs('resume-verify.json', result)
    writeObs('done-resume.json', { completed: false, reason: result.error })
    return
  }

  try {
    // 1. Recover the preset from the durable projection, app-faithful.
    let presetId = null
    let composePath = sessionQuery === undefined ? 'sessionQuery-unavailable' : null
    if (sessionQuery !== undefined) {
      try {
        const observation = await sessionQuery.observeSession(coord.resumeSessionId)
        presetId = observation?.projections?.values?.agentPreset ?? null
        composePath = 'sessionQuery.observeSession'
        if (observation !== null && typeof observation[Symbol.dispose] === 'function') observation[Symbol.dispose]()
      } catch (e) {
        presetId = null
        composePath = `sessionQuery-failed:${failureOf(e).message}`
      }
    }
    if (presetId === null || presetId === undefined) {
      presetId = coord.expectedPreset
      composePath = `${composePath}+coord-fallback`
    }

    // 2. Resolve and re-join the preset on the resumed agent.
    const resolved = await agentPresets.resolve(presetId)
    const ref = { current: undefined, assembled: undefined }
    const handle = await agents.resume({
      resumeSessionId: SessionId(coord.resumeSessionId),
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, ref)
        await agentPresets.mount(agentCtx, resolved.id)
      },
    })
    const agent = handle.agent
    const agentKey = scopeOf(agent.ctx)

    // The persisted selection becomes the live selection — exactly what the
    // app's selectionFor does with projectionState.pending.
    const projectionModel = sessionProjections === undefined ? null : sessionProjections.stateOf(agent.session, 'modelSelection')
    const pending = projectionModel === null || projectionModel === undefined ? null : projectionModel.pending ?? null
    ref.current = pending === null ? undefined : { provider: pending.provider, model: pending.model, ...(pending.reasoningEffort !== undefined ? { reasoningEffort: pending.reasoningEffort } : {}) }

    // 3. First post-resume prompt assembly: the pending selection must be
    //    captured at the assembly boundary, and the composition must be
    //    rebuilt identically.
    const assembly = await systemPrompt.assemble({ scope: agentKey })
    let headerAgentPreset = null
    try {
      const header = agent.session.requestHeader()
      headerAgentPreset = header?.agentPreset ?? null
    } catch {
      headerAgentPreset = null
    }

    result.verified = {
      resumeSessionId: String(coord.resumeSessionId),
      composePath,
      presetIdUsed: presetId,
      resolvedId: resolved.id,
      composedPreset: agentPresets.composedPreset(agent.ctx),
      projectionAgentPreset: sessionProjections === undefined ? null : sessionProjections.stateOf(agent.session, 'agentPreset'),
      projectionModelSelection: projectionModel,
      refAssembledAfterFirstAssembly: ref.assembled ?? null,
      assembly: {
        sectionNames: assembly.sections.map((s) => s.name),
        sections: assembly.sections.map((s) => ({ name: s.name, text: s.text })),
        contexts: assembly.contexts.length,
        personaName: PERSONA_SECTION,
      },
      events: agent.session.events.map((ev) => ({
        seq: ev.seq,
        type: ev.type,
        ...(RECORDED_EVENT_TYPES.has(ev.type) ? { data: ev.data } : {}),
      })),
      header: { agentPreset: headerAgentPreset },
    }
    await handle.dispose()
    result.verified.disposed = true
  } catch (e) {
    const failure = failureOf(e)
    result.error = failure.message
    result.errorName = failure.name
  }

  writeObs('resume-verify.json', result)
  writeObs('done-resume.json', { completed: result.error === undefined, stamp: Date.now().toString(36) })
}
