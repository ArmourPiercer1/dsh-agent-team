/**
 * P2-T3 probe group — preset/persona/model seams (TaskDoc §11.3).
 *
 * Two boots against the pinned DSH, public surface only (no upstream
 * modification, no private APIs, no patches):
 *
 *   boot 1 (plugins/main.js)   — AgentPreset roster/default/unknown,
 *                                persona additive (standard) vs complete
 *                                (minimal), complete:true DETECTION
 *                                (second complete section rejected at
 *                                assembly) and BLOCKING (waterfall override
 *                                of the complete section is restored),
 *                                persona scope boundaries (root / standing /
 *                                agent, user preset, no cross-scope leak),
 *                                ModelSelection future boundary
 *                                (captured at assembly, applied to the step,
 *                                concurrent switch affects the next step),
 *                                AgentPreset.select success/lock/not-found/
 *                                precedence, and the cold-resume seed;
 *   boot 2 (plugins/resume.js) — cold process resume of the seeded session:
 *                                the durable agentPreset projection drives
 *                                the preset rejoin, the persisted
 *                                model/selection survives as the projection's
 *                                pending and is captured at the first
 *                                post-resume assembly boundary, and the
 *                                composition is rebuilt identically.
 *
 * The payloads write machine-readable JSON observations under
 *   <worktree>/dev/agent-workflow/evidence/P2-T3/run/observations/
 * which, under the canonical invocation, is exactly the run's
 * `--report-dir`/observations. This group polls for each boot's completion
 * marker, stops the instance (port must free), resets the patch layer, and
 * turns every observation into PASS/FAIL check lines.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractSpecifiers } from '../../lib/private-import.mjs'
import { checkSpecifier, matchPackageName } from '../../lib/public-surface.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// preset-persona-model/ -> probes/ -> characterization/ -> tests/ -> worktree root
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..')
const OBS_DIR = join(WORKTREE_ROOT, 'dev', 'agent-workflow', 'evidence', 'P2-T3', 'run', 'observations')

const MAIN_ROW = { id: 'p2t3-ppm-main', rel: 'probes/preset-persona-model/plugins/main.js' }
const RESUME_ROW = { id: 'p2t3-ppm-resume', rel: 'probes/preset-persona-model/plugins/resume.js' }

const USER_PRESET_ID = 'p2t3-scope'
const USER_PERSONA_TEXT = 'P2T3-SCOPE-PROBE persona from user preset p2t3-scope.'
const USER_PRESET_YML = [
  '# P2-T3 probe fixture — a user-authored preset with a unique persona text.',
  '# Single persona row, complete:false, additive: proves user presets compose',
  '# into a session and that persona sections stay scoped to their own preset.',
  '- id: persona',
  "  name: '@deepseek-ai/dsh-persona'",
  '  config:',
  `    text: ${USER_PERSONA_TEXT}`,
  '',
].join('\n')

const OBS_FILES = [
  'roster.json',
  'persona.json',
  'negative-complete.json',
  'negative-override.json',
  'scope.json',
  'model.json',
  'switch.json',
  'resume-seed.json',
  'coord.json',
  'resume-verify.json',
  'done-main.json',
  'done-resume.json',
]

const DONE_POLL_TIMEOUT_MS = 240_000
const DONE_POLL_INTERVAL_MS = 300

function firstLine(text) {
  const line = String(text).split('\n').find((l) => l.trim() !== '')
  return line ?? String(text)
}

/** Key-order-insensitive deep equality for the JSON-leaf observations. */
function canon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`
}
function deepEq(a, b) {
  return canon(a) === canon(b)
}

async function waitForFile(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (existsSync(file)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, DONE_POLL_INTERVAL_MS))
  }
}

function readObs(name) {
  try {
    return JSON.parse(readFileSync(join(OBS_DIR, name), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Extract a preset's persona text from the pinned preset yml. Handles the two
 * shapes present in the pinned tree: a plain scalar and a `>-` folded block.
 */
function extractPersonaText(ymlText) {
  const lines = ymlText.split('\n')
  const start = lines.findIndex((l) => l.includes('id: persona'))
  if (start === -1) return null
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^\s*text:\s*(.*)$/)
    if (m === null) continue
    const rest = m[1].trim()
    if (rest === '>-' || rest === '>' || rest === '|' || rest === '|-') {
      const buf = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j].trim() === '') continue
        if (/^\S/.test(lines[j])) break
        buf.push(lines[j].trim())
      }
      return buf.join(' ')
    }
    return rest.replace(/^(['"])(.*)\1$/, '$2')
  }
  return null
}

const SELECTION_B = { provider: 'p2t3-provider-b', model: 'p2t3-model-b' }

export default {
  name: 'preset-persona-model',
  description:
    'P2-T3: AgentPreset composition + persona scope + complete:true detection/blocking + ModelSelection future boundary + preset switch lock + cold resume (2 boots, public surface only)',

  /**
   * @param {object} ctx - harness context (see lib/harness-core.mjs)
   */
  async run(ctx) {
    const { check, instance } = ctx

    // ── static: both payload sources must stay inside the public surface ────
    for (const row of [MAIN_ROW, RESUME_ROW]) {
      const specs = extractSpecifiers(readFileSync(join(ctx.harnessRoot, row.rel), 'utf8'))
      const upstream = specs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
      check(upstream.length >= 1, `${row.id} carries >=1 upstream import (${upstream.map((s) => s.spec).join(', ')})`)
      check(
        upstream.every((s) => checkSpecifier(s.spec, ctx.surface).admitted),
        `${row.id} upstream imports all admitted by the live public surface`,
      )
    }

    // ── fixture: user-authored preset under the dedicated DSH_HOME ──────────
    const presetDir = join(ctx.config.dshHome, '.agent-presets', USER_PRESET_ID)
    mkdirSync(presetDir, { recursive: true })
    writeFileSync(join(presetDir, 'agent.cordis.yml'), USER_PRESET_YML)
    check(true, `user preset fixture written: ${presetDir} (trust 'user', unique persona text)`)

    // ── clean stale observations from earlier runs ──────────────────────────
    mkdirSync(OBS_DIR, { recursive: true })
    for (const f of OBS_FILES) rmSync(join(OBS_DIR, f), { force: true })

    // ── pinned preset persona texts (live source of truth for equality) ─────
    const standardPersona = extractPersonaText(
      readFileSync(join(ctx.config.hostTree, 'packages/preset/agent-presets/presets/standard/agent.cordis.yml'), 'utf8'),
    )
    const minimalPersona = extractPersonaText(
      readFileSync(join(ctx.config.hostTree, 'packages/preset/agent-presets/presets/minimal/agent.cordis.yml'), 'utf8'),
    )
    check(standardPersona !== null, 'pinned standard preset persona text extracted')
    check(minimalPersona !== null, 'pinned minimal preset persona text extracted')
    check(
      minimalPersona !== null && standardPersona !== null && minimalPersona !== USER_PERSONA_TEXT && standardPersona !== USER_PERSONA_TEXT,
      'probe persona texts (standard/minimal/user) are mutually distinct',
    )

    // ── boot 1: main payload ────────────────────────────────────────────────
    instance.mountRows([{ id: MAIN_ROW.id, name: ctx.pluginUrl(MAIN_ROW.rel) }], ['P2-T3 preset-persona-model probe: main payload (boot 1/2)'])
    let boot1Ok = false
    try {
      const boot1 = await instance.start()
      boot1Ok = true
      check(true, `boot 1 (main) marker: ${firstLine(boot1.url)}`)
    } catch (error) {
      check(false, `boot 1 (main) failed: ${firstLine(error.message)}`)
    }
    const doneMain = boot1Ok && (await waitForFile(join(OBS_DIR, 'done-main.json'), DONE_POLL_TIMEOUT_MS))
    if (boot1Ok) check(doneMain, 'main payload completed (done-main.json within poll window)')
    const stop1 = await instance.stop()
    check(stop1.portFree, `port ${ctx.config.port} free after boot 1 stop`)

    // ── boot 2: resume payload (only when boot 1 seeded a resumable session) ─
    const coord = readObs('coord.json')
    let booted2 = false
    if (doneMain && coord !== null && coord.resumeSessionId !== undefined) {
      instance.mountRows([{ id: RESUME_ROW.id, name: ctx.pluginUrl(RESUME_ROW.rel) }], ['P2-T3 preset-persona-model probe: resume payload (boot 2/2)'])
      try {
        const boot2 = await instance.start()
        booted2 = true
        check(true, `boot 2 (resume) marker: ${firstLine(boot2.url)}`)
      } catch (error) {
        check(false, `boot 2 (resume) failed: ${firstLine(error.message)}`)
      }
      const doneResume = booted2 && (await waitForFile(join(OBS_DIR, 'done-resume.json'), DONE_POLL_TIMEOUT_MS))
      check(doneResume, 'resume payload completed (done-resume.json within poll window)')
    } else {
      check(false, 'boot 2 skipped: main payload did not produce coord.json (see run log + observations)')
    }
    if (booted2) {
      const stop2 = await instance.stop()
      check(stop2.portFree, `port ${ctx.config.port} free after boot 2 stop`)
    }
    // NOTE: P2-T1's instance.resetPatchLayer(header) has a latent defect — its
    // body (lib/instance.mjs:193) passes the mapped line array straight to
    // writeFileSync, which throws `The "data" argument must be of type string`.
    // That file is P2-T1-owned and must not be modified here, so we perform the
    // identical baseline revert through the public `patchFile` getter instead
    // (see compliance-report.md).
    writeFileSync(
      instance.patchFile,
      ['# P2-T3 preset-persona-model probe finished; patch layer reset', '[]', ''].join('\n'),
    )

    // ── completion markers ──────────────────────────────────────────────────
    const doneMainObs = readObs('done-main.json')
    check(doneMainObs?.completed === true, `main payload reports completed:true (got ${JSON.stringify(doneMainObs ?? null)})`)
    const doneResumeObs = readObs('done-resume.json')
    check(doneResumeObs?.completed === true, `resume payload reports completed:true (got ${JSON.stringify(doneResumeObs ?? null)})`)

    // ── roster ──────────────────────────────────────────────────────────────
    const roster = readObs('roster.json')
    check(roster !== null && roster.error === undefined, 'roster observation present without payload error')
    if (roster !== null && roster.roster !== undefined) {
      const byId = new Map(roster.roster.map((p) => [p.id, p]))
      for (const id of ['cordis', 'minimal', 'ptc', 'standard']) {
        check(byId.get(id)?.trust === 'system', `roster: shipped preset "${id}" listed with trust 'system'`)
      }
      check(byId.get(USER_PRESET_ID)?.trust === 'user', `roster: user preset "${USER_PRESET_ID}" listed with trust 'user'`)
      check(roster.defaultId === 'standard', `default resolve() -> 'standard' (got ${roster.defaultId ?? 'null'})`)
      check(roster.standardId === 'standard', "resolve('standard') -> 'standard'")
      check(roster.unknown?.isUnknownPresetError === true, "resolve('p2t3-nope') rejects with UnknownPresetError (class identity)")
      check(
        typeof roster.unknown?.message === 'string' && roster.unknown.message.includes('not found (available:'),
        `unknown-preset message lists availability: ${firstLine(roster.unknown?.message ?? '(none)')}`,
      )
      check(
        Array.isArray(roster.unknown?.available) && roster.unknown.available.includes('standard') && roster.unknown.available.includes(USER_PRESET_ID),
        'unknown-preset error details list shipped + user presets',
      )
    }

    // ── persona: additive vs complete ───────────────────────────────────────
    const persona = readObs('persona.json')
    check(persona !== null && persona.error === undefined, 'persona observation present without payload error')
    if (persona !== null && persona.standard !== undefined && standardPersona !== null && minimalPersona !== null) {
      check(persona.standard?.persona?.text === standardPersona, 'standard agent assembly: persona section carries the preset persona template (exact text)')
      check(
        persona.standard?.sections?.includes('deployment:persona') && persona.standard?.sections?.includes('harness:identity') && persona.standard?.sections?.length >= 2,
        'standard agent assembly is additive (deployment:persona + harness:identity + others)',
      )
      check(
        persona.standard?.persona?.text?.includes('{{model}}') === true && persona.standard?.persona?.text?.includes('{{cwd}}') === true,
        'standard persona template resolves model/cwd from the agent route ({{model}}/{{cwd}})',
      )
      check(
        persona.minimal?.sections?.length === 1 && persona.minimal?.sections?.[0] === 'deployment:persona',
        'minimal agent assembly: exactly one section (the complete persona)',
      )
      check(persona.minimal?.persona?.text === minimalPersona, 'minimal agent assembly: persona text is the exact registered text (complete restoration)')
      check(persona.minimal?.contexts === 0, 'minimal agent assembly: runtime contexts suppressed (includeRuntimeContext:false)')
    }

    // ── NEGATIVE: second complete section must be rejected ──────────────────
    const negComplete = readObs('negative-complete.json')
    check(negComplete?.rejected === true, 'NEGATIVE: a second complete section in the same scope -> assembly REJECTED (detection)')
    check(
      typeof negComplete?.message === 'string' && /multiple complete prompt sections are active/.test(negComplete.message),
      'NEGATIVE: rejection names the multiple-complete condition',
    )
    check(
      typeof negComplete?.message === 'string' && negComplete.message.includes('p2t3:probe-complete') && negComplete.message.includes('deployment:persona'),
      'NEGATIVE: rejection names both complete sections',
    )

    // ── NEGATIVE: complete section text cannot be overridden ────────────────
    const negOverride = readObs('negative-override.json')
    if (negOverride !== null && negOverride.error === undefined && minimalPersona !== null) {
      const overriddenPersona = negOverride.resulting?.find((s) => s.name === 'deployment:persona')
      check(overriddenPersona?.text === minimalPersona, 'NEGATIVE: waterfall middleware cannot override the complete section text (restored post-waterfall)')
      check(negOverride.resulting?.every((s) => !String(s.text).includes(negOverride.mark)) === true, 'NEGATIVE: override marker absent from every assembled section')
    } else {
      check(false, 'negative-override observation present without payload error')
    }

    // ── scope boundaries ────────────────────────────────────────────────────
    const scope = readObs('scope.json')
    check(scope !== null && scope.error === undefined, 'scope observation present without payload error')
    if (scope !== null && scope.root !== undefined && standardPersona !== null && minimalPersona !== null) {
      check(scope.root?.persona?.text === standardPersona, 'root (deployment) persona text equals the standard preset persona text (recorded identity fact)')
      check(scope.standardAgent?.persona?.text === standardPersona, 'standard agent scope: preset persona shadows the deployment persona')
      check(scope.minimalAgent?.persona?.text === minimalPersona, 'minimal agent scope: complete preset persona')
      check(scope.userAgent?.persona?.text === USER_PERSONA_TEXT, 'user preset agent scope: user-authored persona composes (trust user)')
      check(scope.standardStanding?.persona?.text === standardPersona, 'standard standing scope: preset persona registered at the preset standing key')
      check(scope.userStanding?.persona?.text === USER_PERSONA_TEXT, 'user standing scope: user preset persona registered at the preset standing key')
      check(scope.root?.persona?.text !== minimalPersona && scope.userAgent?.persona?.text !== minimalPersona, 'minimal persona text does not leak into root/user scopes')
      check(
        scope.root?.persona?.text !== USER_PERSONA_TEXT && scope.standardAgent?.persona?.text !== USER_PERSONA_TEXT && scope.minimalAgent?.persona?.text !== USER_PERSONA_TEXT,
        'user persona text does not leak into root/standard/minimal scopes',
      )
      check(scope.agentKeyIsAgentObject?.a === true && scope.agentKeyIsAgentObject?.c === true, 'scopeOf(agent.ctx) is the Agent object itself (agent IS its scope key)')
    }

    // ── model: future boundary ──────────────────────────────────────────────
    const model = readObs('model.json')
    check(model !== null && model.error === undefined, 'model observation present without payload error')
    if (model !== null && model.step1 !== undefined) {
      const selA = model.selections.A
      const selB = model.selections.B
      const selCeffort = model.selections.C_EFFORT
      const selCplain = model.selections.C_PLAIN
      check(deepEq(model.step1?.assembly?.assembled, selA), 'model: step1 assembly captures current selection A into ref.assembled')
      check(
        model.step1?.assembly?.variables?.provider === selA.provider && model.step1?.assembly?.variables?.model === selA.model,
        'model: assembly variables patched with selection A (provider/model)',
      )
      check(
        model.step1?.request?.provider === selA.provider &&
          model.step1?.request?.model === selA.model &&
          model.step1?.request?.maxTokens === 1234 &&
          model.step1?.request?.reasoningEffort === null,
        'model: step1 request applies A, preserves seed maxTokens, clears the seed effort',
      )
      check(
        model.concurrentSwitchSameStep?.request?.provider === selA.provider && model.concurrentSwitchSameStep?.request?.model === selA.model,
        'model FUTURE-BOUNDARY: concurrent switch to B does NOT affect the in-flight step (still A)',
      )
      check(
        deepEq(model.step2?.assembly?.assembled, selB) && model.step2?.request?.provider === selB.provider && model.step2?.request?.model === selB.model,
        'model: the next assembly captures B and the next request applies B',
      )
      check(
        model.step3?.request?.provider === selCeffort.provider && model.step3?.request?.model === selCeffort.model && model.step3?.request?.reasoningEffort === 'high',
        'model: a selected reasoningEffort (high) is applied on the request',
      )
      check(
        model.step4?.request?.provider === selCplain.provider && model.step4?.request?.model === selCplain.model && model.step4?.request?.reasoningEffort === null,
        'model: an absent selected effort clears the inherited effort',
      )
      check(deepEq(model.afterDispose?.request, model.seed), 'model: disposer removes both steps (request back to the bare seed)')
      check(
        model.afterDispose?.assembly?.variables?.provider === null && model.afterDispose?.assembly?.variables?.model === null,
        'model: post-dispose assembly no longer patches variables (patch step removed; the selected provider/model are gone)',
      )
    }

    // ── switch: select / lock / not-found / precedence ──────────────────────
    const sw = readObs('switch.json')
    check(sw !== null && sw.error === undefined, 'switch observation present without payload error')
    if (sw !== null && sw.first !== undefined) {
      check(sw.first?.rejected === false && sw.first?.value === 'minimal', 'switch: select(agent, minimal) on a fresh session succeeds')
      check(sw.stateAfterFirst?.composedPreset === 'minimal', 'switch: composedPreset() reflects the new preset live')
      check(sw.stateAfterFirst?.projection === 'minimal', 'switch: agentPreset session projection advanced to minimal')
      check(
        sw.stateAfterFirst?.selectedEvents?.length === 1 && sw.stateAfterFirst?.selectedEvents?.[0]?.data?.agentPreset === 'minimal',
        'switch: agent-preset/selected session event appended',
      )
      check(
        sw.unknownOnUnlocked?.rejected === true && sw.unknownOnUnlocked?.code === 'agent-preset-not-found',
        'switch NEGATIVE: unknown preset on an unlocked session -> agent-preset-not-found',
      )
      check(
        sw.unknownOnUnlocked?.details !== null &&
          Array.isArray(sw.unknownOnUnlocked?.details?.available) &&
          sw.unknownOnUnlocked.details.available.includes('standard'),
        'switch NEGATIVE: not-found details list the available presets',
      )
      check(sw.locked?.rejected === true && sw.locked?.code === 'agent-preset-locked', 'switch NEGATIVE: after turn/start, select -> agent-preset-locked')
      check(
        typeof sw.locked?.message === 'string' && /has already started; its agent preset is fixed/.test(sw.locked.message),
        'switch NEGATIVE: lock message names the fixed-preset rule',
      )
      check(sw.locked?.details?.sessionId === sw.sessionId, 'switch NEGATIVE: lock details carry the session id')
      check(
        sw.unknownOnLocked?.rejected === true && sw.unknownOnLocked?.code === 'agent-preset-locked',
        'switch NEGATIVE: lock precedence — unknown preset on a locked session -> agent-preset-locked',
      )
    }

    // ── cold resume: seed ───────────────────────────────────────────────────
    const seed = readObs('resume-seed.json')
    check(seed?.disposed === true, 'resume seed: agent handle disposed (live registry detached, durable log persists)')
    check(
      seed?.modelSelectionEvent?.length === 1 && deepEq(seed.modelSelectionEvent[0].data, SELECTION_B),
      'resume seed: model/selection event persisted on the session before detach',
    )

    // ── cold resume: verification in the fresh process ──────────────────────
    const resume = readObs('resume-verify.json')
    check(resume !== null && resume.error === undefined, 'resume verification present without payload error')
    if (resume !== null && resume.verified !== undefined && minimalPersona !== null) {
      const v = resume.verified
      check(
        String(v.composePath).startsWith('sessionQuery.observeSession') && !String(v.composePath).includes('coord-fallback'),
        `resume: preset id recovered from the durable agentPreset projection (composePath=${v.composePath})`,
      )
      check(v.presetIdUsed === 'minimal' && v.resolvedId === 'minimal', 'resume: resolved preset is minimal')
      check(v.composedPreset === 'minimal', 'resume: composedPreset() is minimal on the resumed agent')
      check(v.projectionAgentPreset === 'minimal', 'resume: agentPreset projection is minimal on the resumed session')
      check(
        v.events?.some((e) => e.type === 'model/selection' && deepEq(e.data, SELECTION_B)) === true,
        'resume: the persisted model/selection event survived the process restart',
      )
      check(
        v.projectionModelSelection !== null &&
          v.projectionModelSelection?.pending !== null &&
          deepEq(v.projectionModelSelection.pending, SELECTION_B) &&
          v.projectionModelSelection?.lastUsed === null,
        'resume: modelSelection projection carries the persisted selection as pending (lastUsed null)',
      )
      check(deepEq(v.refAssembledAfterFirstAssembly, SELECTION_B), 'resume: first post-resume assembly captures the pending selection at the assembly boundary (§40.3)')
      check(
        deepEq(v.assembly?.sectionNames, ['deployment:persona']) && v.assembly?.sections?.[0]?.text === minimalPersona && v.assembly?.contexts === 0,
        'resume: composition rebuilt identically (exactly the minimal complete persona, contexts suppressed)',
      )
    }
  },
}
