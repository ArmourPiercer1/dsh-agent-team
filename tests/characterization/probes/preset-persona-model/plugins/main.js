/**
 * P2-T3 probe payload (boot 1/2) — preset/persona/model seams, live instance.
 *
 * Runs inside a `dsh web` instance booted by the characterization harness with
 * this plugin mounted through the public `cordis.patch.yml` seam. It
 * characterizes, using the public surface only (no private APIs, no patches):
 *
 *   roster         AgentPreset roster, default resolution, unknown-preset error
 *   persona        standard (complete:false -> additive) vs
 *                  minimal (complete:true -> sole section, contexts suppressed)
 *   negative-      a second complete section in the same scope MUST be
 *   complete       rejected at assembly time (detection)
 *   negative-      a prompt-assembly waterfall middleware CANNOT override the
 *   override       text of a complete section (it is restored after the
 *                  waterfall — blockability; the structural-FATAL basis of the
 *                  frozen 1A decision)
 *   scope          persona visibility: root vs preset standing key vs agent
 *                  scope; a user-authored preset composes; no cross-scope leak
 *   model          ModelSelection future boundary: selection is captured at
 *                  prompt assembly and applied to that step's request; a
 *                  concurrent switch takes effect on a later step
 *   switch         AgentPreset.select: success, turn-start lock, not-found,
 *                  and lock precedence over not-found
 *   resume-seed    seeds the durable session that boot 2/2 (plugins/resume.js)
 *                  cold-resumes in a fresh process
 *
 * Each seam writes one machine-readable JSON observation into
 *   <worktree>/dev/agent-workflow/evidence/P2-T3/run/observations/
 * (exactly the canonical run's --report-dir/observations) and finally writes
 * done-main.json. apply() never throws: every seam is isolated in try/catch
 * and records its failure shape so the harness can attribute it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { agentEvents, installModelSelection } from '@deepseek-ai/dsh-agent'
import { PresetLockedError, UnknownPresetError } from '@deepseek-ai/dsh-agent-presets'
import { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { SessionId } from '@deepseek-ai/dsh-session'

const HERE = dirname(fileURLToPath(import.meta.url))
// plugins/ -> preset-persona-model/ -> probes/ -> characterization/ -> tests/ -> worktree root
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const OBS_DIR = join(WORKTREE_ROOT, 'dev', 'agent-workflow', 'evidence', 'P2-T3', 'run', 'observations')

const USER_PRESET_ID = 'p2t3-scope'
const USER_PERSONA_TEXT = 'P2T3-SCOPE-PROBE persona from user preset p2t3-scope.'

const SELECTION_A = { provider: 'p2t3-provider-a', model: 'p2t3-model-a' }
const SELECTION_B = { provider: 'p2t3-provider-b', model: 'p2t3-model-b' }
const SELECTION_C_EFFORT = { provider: 'p2t3-provider-c', model: 'p2t3-model-c1', reasoningEffort: 'high' }
const SELECTION_C_PLAIN = { provider: 'p2t3-provider-c', model: 'p2t3-model-c2' }
// The seed carries reasoningEffort so "absent selected effort clears the
// inherited effort" and "disposer restores the bare seed" are both observable.
const SEED_CONFIG = { provider: 'p2t3-seed-provider', model: 'p2t3-seed-model', maxTokens: 1234, reasoningEffort: 'medium' }

const STAMP = Date.now().toString(36)

export const name = 'p2t3-preset-persona-model-main'
// Hard service dependencies (public `inject` protocol): the Loader defers this
// row's apply until every listed service exists, so the payload never races
// rows that register late in the boot (the agent-presets row waits on
// `loader`; boot A showed a bare early apply can miss them).
export const inject = ['agentPresets', 'agents', 'systemPrompt', 'sessionProjections']

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

// Durable-publication gate (pattern from P2-T2 lifecycle-host.js; known
// limitations L2-1/L2-2): the on-disk final artifact of a session log is
//   <DSH_HOME>/sessions/<project-hash-dir>/<sessionId>/session.jsonl.zstd
// The write-behind publishes via synced temp + rename; a bare *.tmp is NOT
// visible to cold reads (the cold findLog only sees the final name, so an
// uncommitted staging file reads as "session not found"). An awaited
// `session/flush` is not a publication barrier, so the seed block polls for
// the final name before done-main.
const diskFilesFor = (sessionId) => {
  const home = process.env.DSH_HOME
  if (!home) return { error: 'no DSH_HOME' }
  try {
    const sessionsRoot = join(home, 'sessions')
    for (const pd of readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const dir = join(sessionsRoot, pd.name, sessionId)
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue // not this project dir
      }
      return {
        projectDir: pd.name,
        files: entries.filter((e) => e.isFile()).map((e) => ({
          name: e.name,
          size: statSync(join(dir, e.name)).size,
          final: e.name === 'session.jsonl.zstd',
        })),
      }
    }
    return { found: false, sessionsRoot }
  } catch (error) {
    return { error: String(error?.message ?? error) }
  }
}

async function waitForDurable(sessionId, timeoutMs) {
  const startedAt = Date.now()
  for (;;) {
    const disk = diskFilesFor(sessionId)
    if (disk.error === undefined && disk.files && disk.files.some((f) => f.final)) {
      const pub = disk.files.find((f) => f.final)
      return { waitMs: Date.now() - startedAt, size: pub.size }
    }
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`p2t3-ppm-main: seed session "${String(sessionId)}" not durably published as session.jsonl.zstd within ${timeoutMs}ms; last disk state: ${JSON.stringify(disk)}`)
    }
    await new Promise((r) => { setTimeout(r, 50) })
  }
}

function personaOf(assembly) {
  const section = assembly.sections.find((s) => s.name === PERSONA_SECTION)
  return section === undefined ? null : { name: section.name, text: section.text }
}

function sectionNames(assembly) {
  return assembly.sections.map((s) => s.name)
}

export function apply(ctx) {
  run(ctx).catch((error) => {
    writeObs('done-main.json', { completed: false, reason: failureOf(error).message })
  })
}

async function run(ctx) {
  const result = { stamp: STAMP, services: {}, seams: {} }
  const agentPresets = ctx.get('agentPresets')
  const agents = ctx.get('agents')
  const systemPrompt = ctx.get('systemPrompt')
  const sessionProjections = ctx.get('sessionProjections')
  result.services = {
    agentPresets: agentPresets !== undefined,
    agents: agents !== undefined,
    systemPrompt: systemPrompt !== undefined,
    sessionProjections: sessionProjections !== undefined,
  }
  if (agentPresets === undefined || agents === undefined || systemPrompt === undefined) {
    writeObs('done-main.json', {
      completed: false,
      reason: `missing required service(s): ${JSON.stringify(result.services)}`,
    })
    return
  }

  const handles = []
  const track = (handle) => {
    handles.push(handle)
    return handle
  }
  const createPresetAgent = async (presetId) => {
    const handle = track(await agents.create({
      sessionId: SessionId(`p2t3-${presetId}-${STAMP}-${Math.random().toString(36).slice(2, 8)}`),
      meta: { cwd: process.cwd(), agentPreset: presetId },
      setup: async (agentCtx) => {
        await agentPresets.mount(agentCtx, presetId)
      },
    }))
    return handle
  }
  const disposeAll = async () => {
    for (const handle of handles) {
      try {
        await handle.dispose()
      } catch {
        /* per-seam observations already carry the failure shape */
      }
    }
  }

  // ── roster: shipped + user presets, default, unknown ─────────────────────
  try {
    const roster = (await agentPresets.list()).map((p) => ({ id: p.id, trust: p.trust, broken: p.broken ?? null }))
    let defaultId = null
    let defaultError = null
    try {
      defaultId = (await agentPresets.resolve()).id
    } catch (e) {
      defaultError = failureOf(e)
    }
    let standardId = null
    let standardError = null
    try {
      standardId = (await agentPresets.resolve('standard')).id
    } catch (e) {
      standardError = failureOf(e)
    }
    let unknown = null
    try {
      await agentPresets.resolve('p2t3-nope')
    } catch (e) {
      unknown = {
        isUnknownPresetError: e instanceof UnknownPresetError,
        message: e.message,
        available: e.available ?? null,
      }
    }
    result.seams.roster = { roster, defaultId, defaultError, standardId, standardError, unknown }
  } catch (e) {
    result.seams.roster = { error: failureOf(e) }
  }
  writeObs('roster.json', result.seams.roster)

  // ── shared agents: A=standard, B=minimal ──────────────────────────────────
  let a
  let b
  try {
    a = await createPresetAgent('standard')
    b = await createPresetAgent('minimal')
  } catch (e) {
    result.agentCreation = { error: failureOf(e) }
    await disposeAll()
    writeObs('done-main.json', { completed: false, reason: `agent creation failed: ${failureOf(e).message}` })
    return
  }
  const aKey = scopeOf(a.agent.ctx)
  const bKey = scopeOf(b.agent.ctx)

  // ── persona: additive (standard) vs complete (minimal) ────────────────────
  try {
    const assemblyA = await systemPrompt.assemble({ scope: aKey })
    const assemblyB = await systemPrompt.assemble({ scope: bKey })
    result.seams.persona = {
      standard: { sections: sectionNames(assemblyA), persona: personaOf(assemblyA), contexts: assemblyA.contexts.length },
      minimal: {
        sections: sectionNames(assemblyB),
        persona: personaOf(assemblyB),
        all: assemblyB.sections.map((s) => ({ name: s.name, text: s.text })),
        contexts: assemblyB.contexts.length,
      },
    }
  } catch (e) {
    result.seams.persona = { error: failureOf(e) }
  }
  writeObs('persona.json', result.seams.persona)

  // ── NEGATIVE: a second complete section in the same scope must be rejected ─
  try {
    const disposeExtra = b.agent.ctx.systemPrompt.section({
      name: 'p2t3:probe-complete',
      order: 1,
      text: 'P2T3 probe: a second complete section for the negative control.',
      complete: true,
    })
    let blocked = null
    try {
      await systemPrompt.assemble({ scope: bKey })
      blocked = { rejected: false }
    } catch (e) {
      blocked = { rejected: true, message: e.message }
    }
    disposeExtra()
    result.seams.negativeComplete = blocked
  } catch (e) {
    result.seams.negativeComplete = { error: failureOf(e) }
  }
  writeObs('negative-complete.json', result.seams.negativeComplete)

  // ── NEGATIVE: a waterfall middleware cannot override a complete section ───
  try {
    const mark = ' [P2T3-OVERRIDE-ATTEMPT]'
    const off = b.agent.ctx.on('system-prompt/assemble', (assembly, _context, next) =>
      next().then((value) => ({
        ...value,
        sections: value.sections.map((s) => (s.name === PERSONA_SECTION ? { ...s, text: s.text + mark } : s)),
      })),
    )
    let attempt = null
    try {
      const assembly = await systemPrompt.assemble({ scope: bKey })
      attempt = { resulting: assembly.sections.map((s) => ({ name: s.name, text: s.text })) }
    } finally {
      off()
    }
    result.seams.negativeOverride = { mark, ...attempt }
  } catch (e) {
    result.seams.negativeOverride = { error: failureOf(e) }
  }
  writeObs('negative-override.json', result.seams.negativeOverride)

  // ── scope: persona visibility across root / standing / agent scopes ───────
  try {
    const c = await createPresetAgent(USER_PRESET_ID)
    const cKey = scopeOf(c.agent.ctx)
    const root = await systemPrompt.assemble({})
    const standardAgent = await systemPrompt.assemble({ scope: aKey })
    const minimalAgent = await systemPrompt.assemble({ scope: bKey })
    const userAgent = await systemPrompt.assemble({ scope: cKey })
    const standardStanding = await systemPrompt.assemble({ scope: await agentPresets.standingKeyFor('standard') })
    const userStanding = await systemPrompt.assemble({ scope: await agentPresets.standingKeyFor(USER_PRESET_ID) })
    result.seams.scope = {
      root: { sections: sectionNames(root), persona: personaOf(root) },
      standardAgent: { sections: sectionNames(standardAgent), persona: personaOf(standardAgent) },
      minimalAgent: { sections: sectionNames(minimalAgent), persona: personaOf(minimalAgent) },
      userAgent: { sections: sectionNames(userAgent), persona: personaOf(userAgent) },
      standardStanding: { sections: sectionNames(standardStanding), persona: personaOf(standardStanding) },
      userStanding: { sections: sectionNames(userStanding), persona: personaOf(userStanding) },
      agentKeyIsAgentObject: { a: aKey === a.agent, c: cKey === c.agent },
      userPresetId: USER_PRESET_ID,
      userPersonaText: USER_PERSONA_TEXT,
    }
  } catch (e) {
    result.seams.scope = { error: failureOf(e) }
  }
  writeObs('scope.json', result.seams.scope)

  // ── model: ModelSelection future-boundary semantics on agent A ────────────
  try {
    const ref = { current: { ...SELECTION_A }, assembled: undefined }
    const disposeSelection = installModelSelection(a.agent.ctx, ref)
    const dispatch = agentEvents(ctx, a.agent)
    const assemblySnapshot = async () => {
      const assembly = await systemPrompt.assemble({ scope: aKey })
      return {
        assembled: ref.assembled ?? null,
        variables: { provider: assembly.variables.provider ?? null, model: assembly.variables.model ?? null },
      }
    }
    const requestStep = async (turn, step) => {
      const config = await dispatch.waterfall(
        'agent/request',
        { turn, step, signal: new AbortController().signal },
        async () => ({ ...SEED_CONFIG }),
      )
      return {
        provider: config.provider ?? null,
        model: config.model ?? null,
        maxTokens: config.maxTokens ?? null,
        reasoningEffort: config.reasoningEffort ?? null,
      }
    }
    const baseline = await systemPrompt.assemble({ scope: aKey })
    const record = {
      baselineVariables: { provider: baseline.variables.provider ?? null, model: baseline.variables.model ?? null },
    }
    record.step1 = { assembly: await assemblySnapshot(), request: await requestStep(1, 0) }
    ref.current = { ...SELECTION_B } // concurrent switch while step 1 is in flight
    record.concurrentSwitchSameStep = { request: await requestStep(1, 0) }
    record.step2 = { assembly: await assemblySnapshot(), request: await requestStep(1, 1) }
    ref.current = { ...SELECTION_C_EFFORT }
    record.step3 = { assembly: await assemblySnapshot(), request: await requestStep(2, 0) }
    ref.current = { ...SELECTION_C_PLAIN }
    record.step4 = { assembly: await assemblySnapshot(), request: await requestStep(2, 1) }
    disposeSelection()
    record.afterDispose = { assembly: await assemblySnapshot(), request: await requestStep(3, 0) }
    result.seams.model = {
      selections: { A: SELECTION_A, B: SELECTION_B, C_EFFORT: SELECTION_C_EFFORT, C_PLAIN: SELECTION_C_PLAIN },
      seed: SEED_CONFIG,
      ...record,
    }
  } catch (e) {
    result.seams.model = { error: failureOf(e) }
  }
  writeObs('model.json', result.seams.model)

  // ── switch: AgentPreset.select — success, lock, not-found, precedence ─────
  try {
    const f = await createPresetAgent('standard')
    const record = { sessionId: String(f.agent.id), first: null, stateAfterFirst: null, unknownOnUnlocked: null, locked: null, unknownOnLocked: null }
    record.first = { rejected: false, value: await agentPresets.select(f.agent, 'minimal') }
    record.stateAfterFirst = {
      composedPreset: agentPresets.composedPreset(f.agent.ctx),
      projection: sessionProjections === undefined ? null : sessionProjections.stateOf(f.agent.session, 'agentPreset'),
      selectedEvents: f.agent.session.events
        .filter((ev) => ev.type === 'agent-preset/selected')
        .map((ev) => ({ seq: ev.seq, data: ev.data })),
    }
    try {
      await agentPresets.select(f.agent, 'p2t3-nope')
      record.unknownOnUnlocked = { rejected: false }
    } catch (e) {
      record.unknownOnUnlocked = {
        rejected: true,
        code: e.failure?.code ?? e.code ?? null,
        isPresetLockedError: e instanceof PresetLockedError,
        message: e.message,
        details: e.failure?.details ?? e.details ?? null,
      }
    }
    f.agent.session.append('turn/start', { turn: 1 })
    try {
      record.locked = { rejected: false, value: await agentPresets.select(f.agent, 'standard') }
    } catch (e) {
      record.locked = {
        rejected: true,
        code: e.failure?.code ?? e.code ?? null,
        isPresetLockedError: e instanceof PresetLockedError,
        message: e.message,
        details: e.failure?.details ?? e.details ?? null,
      }
    }
    try {
      await agentPresets.select(f.agent, 'p2t3-nope')
      record.unknownOnLocked = { rejected: false }
    } catch (e) {
      record.unknownOnLocked = {
        rejected: true,
        code: e.failure?.code ?? e.code ?? null,
        isPresetLockedError: e instanceof PresetLockedError,
        message: e.message,
        details: e.failure?.details ?? e.details ?? null,
      }
    }
    result.seams.switch = record
  } catch (e) {
    result.seams.switch = { error: failureOf(e) }
  }
  writeObs('switch.json', result.seams.switch)

  // ── resume seed: persist a model/selection, then detach agent B ───────────
  let seedFailed = false
  try {
    const sessionId = String(b.agent.id)
    const selection = { ...SELECTION_B }
    b.agent.session.append('model/selection', selection)
    // Durable-publication gate before done-main (L2-1/L2-2): the awaited
    // flush is not a barrier; a kill inside the write-behind window leaves
    // only a staging *.tmp, and boot 2's cold resume then reads "session not
    // found" (SessionPersistenceNotFoundError — observed 20260830 in the
    // P2-T6 main-agent rerun, two consecutive relative-path runs).
    const durable = await waitForDurable(sessionId, 30_000)
    result.seams.resumeSeed = {
      sessionId,
      preset: 'minimal',
      events: b.agent.session.events.map((ev) => ({ seq: ev.seq, type: ev.type })),
      modelSelectionEvent: b.agent.session.events
        .filter((ev) => ev.type === 'model/selection')
        .map((ev) => ({ seq: ev.seq, data: ev.data })),
      durableWaitMs: durable.waitMs,
      durableSize: durable.size,
    }
    writeObs('coord.json', {
      resumeSessionId: sessionId,
      expectedPreset: 'minimal',
      expectedModelSelection: selection,
      userPresetId: USER_PRESET_ID,
      userPersonaText: USER_PERSONA_TEXT,
    })
    result.seams.resumeSeed.disposed = true
  } catch (e) {
    seedFailed = true
    result.seams.resumeSeed = { error: failureOf(e) }
  }
  writeObs('resume-seed.json', result.seams.resumeSeed)

  await disposeAll()
  writeObs('done-main.json', { completed: !seedFailed, stamp: STAMP })
}
