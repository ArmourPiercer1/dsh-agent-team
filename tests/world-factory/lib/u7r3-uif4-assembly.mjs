/**
 * u7r3-uif4-assembly.mjs — world materialization for the u7r3-uif4 C2 lane
 * (the ask_user_question L4 POSITIVE probe, post-LEG-0 `f4-pos` sketch).
 *
 * The World is the PROVEN u7-f-ui shape for the row/plane face — the same
 * production row + p6t6 observer + preset declaration + `uiFamilyEnabled: true`
 * plane that f3 booted (lib/u7-fui-assembly.mjs) — and the PROVEN u7-f-web
 * ASK-LANE blueprint shape for the permission face (lib/u7f-web-assembly.mjs,
 * whose live C2 settled durable ask rows through the public
 * team.resolveControl v4 seam):
 *
 *   - member `uigov`: `permissions.default: ask`, NO rules. The closed rule
 *     grammar (read|read_image|write|edit|lsp|bash|pwsh) names no interaction
 *     effect, so a governed question can ONLY proceed on a durable Control row
 *     (admission-kernel.ts:681 — the no-authority arm IS the Ask).
 *   - `request-control` in teamEnvelope.allow AND in the member envelope
 *     (u7-4a measured law: without it the PA ask row is never created and the
 *     call settles deny with no row).
 *   - the LEADER carries NO control tools (no team_resolve_control, no
 *     team_list_pending_control): every decision in this record provably came
 *     from the Human public seam, driven by the runner.
 *   - ZERO lane-scoped allow anywhere (the R-U6P3-1 law); the leader template
 *     names no ask_user_question capability (the cause-5 UI literal).
 *
 * Two ask arms share the ONE boot:
 *   ARM A (the target) — the GOVERNED member row: ask #1 (allow), ask #2
 *     (identical args → a second row the runner DENIES), then `present` (the
 *     environment-truth arm). Every refusal is the family's own vocabulary.
 *   ARM B (the discriminator) — a PLAIN Host session on the same World runs
 *     the host's NATIVE `ask_user_question` tool, whose own call site passes
 *     `exec.agent` (tool-ask-user/src/index.ts:99-106). If the pinned
 *     answering face can ever reach a Client, this arm reaches it: it isolates
 *     "the public answering face is live" from "the governed row's port reaches
 *     it" without spending a second start.
 *
 * @module tests/world-factory/lib/u7r3-uif4-assembly
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/** The names the UI FAMILY owns — never allowed into builtinToolDeny. */
export const UI_FAMILY_OWNED_NAMES = ['ask_user_question', 'present']

export function createUif4Assembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `uif4-base-${rs}`
  const BP_ANCHOR_ID = 'team.uif4.anchor'
  const BP_MAIN_ID = 'team.uif4.main'
  const ROOT = `session-uif4-root-${rs}`
  const CREATE_ROOT = `session-uif4-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `uif4-realm-${rs}`
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const SHADOW_LEDGER = join(home, 'uif4-shadow-ledger.jsonl')

  const claims = {
    presented: `UIF4_PRESENTED_CLAIM_${rs}`,
    answer: `UIF4_HUMAN_ANSWER_${rs}`,
  }
  const files = {
    presented: { path: join(workspaceDir, 'notes', 'uif4-present-target.txt') },
  }
  const PRESENTED_CONTENT = `${claims.presented}\nthe file the governed present row tried to publish\n`
  const markers = {
    MK_DISC: `UIF4_DISC_${rs}`,
    MK_L1: `UIF4_L1_${rs}`,
    MK_STRICT: `UIF4_STRICT_${rs}`,
    MK_NATIVE: `UIF4_NATIVE_${rs}`,
  }
  const tokens = (n) => `uif4-${n}-${rs}`
  const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

  /** The u7-f-ui PROVEN row config (f3 booted this exact shape): the shadow
   *  center + confined-provider trio are what lets the PA edge open on a read
   *  authority generation at all (u7fsmut1 measured TOOL_BINDING_UNVERIFIED
   *  without them), plus the family's own `uiFamilyEnabled` plane flag. */
  function teamRowConfig() {
    return {
      rootSessionId: ROOT,
      bootPhase: 'create',
      blueprintSource: BP_ANCHOR_YAML,
      blueprintDir,
      rootPresetId: BASE_PRESET_ID,
      memberPresetId: BASE_PRESET_ID,
      seedMembers: [],
      generation: 1,
      staticModel: { provider: 'deepseek-official', model: 'uif4-model' },
      deniedSelection: null,
      mcpServers: [],
      mcpServer: null,
      environmentFacts: [
        { domain: 'tool', subject: 'web', available: true, generation: 1 },
        { domain: 'skill', subject: 'base', available: true, generation: 1 },
        { domain: 'persona', subject: 'standard', available: true, generation: 1 },
      ],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
      glueUrl: GLUE_URL,
      seamUrl: SEAM_URL,
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        fsInstance: { fs: 'team-ctl', rootDir: planeRootDir(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
        centerAssembly: 'shadow',
        centerShadowLedger: SHADOW_LEDGER,
        confinedProvider: {
          trustRoot: `sha256:${launcherSha().slice(0, 16)}#${LAUNCHER}`,
          assembly: { launcherPath: LAUNCHER, launcherSha256: launcherSha(), minAbiVersion: 3 },
        },
        uiFamilyEnabled: true,
      },
    }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the uif4 assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: uigov', '    persona: "You are a worker of the uif4 assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. Structure is the u7-f-web ASK-LANE blueprint proven
   * live in 070-u7-f-web (durable ask rows settled through the public v4
   * seam), with the UI family's own lane law: the member defaults to ASK, no
   * rule can cover an interaction effect, and the leader holds no control
   * tool. The two family-owned names never enter builtinToolDeny.
   */
  function mainBlueprintYaml(denyList) {
    const kept = denyList.filter((n) => !UI_FAMILY_OWNED_NAMES.includes(n))
    const denyLines = kept.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...kept.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the uif4 assembly team. ${markers.MK_L1} drives your chain: create one governed member, then run the delegated script exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      // NO team_resolve_control / team_list_pending_control: the Human public
      // seam is the ONLY resolver in this record (u7-f-web's law).
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control', '  deny: []',
      'members:',
      '  - templateId: uigov', '    displayName: "uif4 governed UI worker"',
      `    persona: ${JSON.stringify('You are a worker of the uif4 assembly team (governed UI lane). Follow the delegated script exactly, one tool call at a time. You never invent an answer to a refused question.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask',
      // NO rules: the closed grammar names no interaction effect, so a
      // governed question is an Ask BY CONSTRUCTION (admission-kernel:681).
      '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      // request-control on the member envelope = the durable ask row can be
      // created at all (u7-4a measured law).
      '  - templateId: uigov', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  function teamRows() {
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run bash commands. State persists across calls.',
    })
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'uif4 base',
        description: `uif4 base preset (${runStamp}) = smoke (UI family governed, uiFamilyEnabled ON)`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    writeFileSync(files.presented.path, PRESENTED_CONTENT)
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return { presentedShaBefore: sha256File(files.presented.path) }
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }
  function readOracleFacts() {
    let sha = null
    try { sha = sha256File(files.presented.path) } catch { sha = null }
    return { presentedShaAfter: sha }
  }

  /** The question ARM A asks TWICE (identical args → the second call opens a
   *  fresh PA row the runner must deny; the family's fingerprint side-band is
   *  what makes "no new grant" a refusal rather than a silent re-run). */
  function askArgs() {
    return {
      questions: [{
        id: 'uif4-q1',
        question: `${markers.MK_STRICT} which option should the governed lane take?`,
        options: [{ label: 'Option A' }, { label: 'Option B' }],
      }],
    }
  }
  /** The question ARM B (native tool, plain session) asks. */
  function nativeAskArgs() {
    return {
      questions: [{
        id: 'uif4-nq1',
        question: `${markers.MK_NATIVE} native host tool: which option does the human pick?`,
        options: [{ label: 'Native A' }, { label: 'Native B' }],
      }],
    }
  }

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID,
    blueprintDir, workspaceDir, files, claims, markers, tokens,
    PRESENTED_CONTENT,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readOracleFacts,
    askArgs, nativeAskArgs,
  }
}

/**
 * The scripted provider. Lanes: title / disc / uigov (ARM A script) / native
 * (ARM B script) / leader (create → delegate → collect → fence).
 */
export function makeUif4Decide({ assembly }) {
  const { tokens, markers, files } = assembly
  const steps = { uigov: 0, native: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'uigov', tok: 'c1', label: 'uif4-uigov' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_STRICT, which: 'uigov', fence: 'UIF4_UI_DONE' },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((t) => t.includes('[team-work-settled requestToken='))
    .map((t) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t); return m2 === null ? null : m2[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
  const userTextOf = (req) => messagesOf(req)
    .filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
  const lastToolNameOf = (req) => {
    const messages = messagesOf(req)
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]
      if (m?.role === 'assistant' && Array.isArray(m?.content)) {
        const uses = m.content.filter((b) => b?.type === 'tool_use')
        if (uses.length > 0) return String(uses[uses.length - 1]?.name ?? '')
      }
    }
    return null
  }
  function laneOf(req) {
    const t = messagesOf(req).map(textOf).join('\n')
    if (t.includes('Generate the session title')) return 'title'
    const lu = lastUserTextOfStatic(req)
    // ARM B is a PLAIN session: its marker is the only thing in its turn.
    if (lu.includes(markers.MK_NATIVE)) return 'native'
    if (lu.includes(markers.MK_DISC)) return 'disc'
    if (lu.includes('UIF4_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'uigov'
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
  const leaderHasMarker = (req, marker) => messagesOf(req).map(textOf).join('\n').includes(marker)
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'uif4 assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'UIF4_NOOP_DONE' }
    // ── ARM B: the host's OWN ask_user_question tool, plain session ────────
    if (lane === 'native') {
      const step = steps.native
      steps.native += 1
      if (step === 0) return toolCall('ask_user_question', assembly.nativeAskArgs())
      return { kind: 'text', content: 'UIF4_NATIVE_DONE' }
    }
    // ── ARM A: the governed member row ─────────────────────────────────────
    if (lane === 'uigov') {
      const step = steps.uigov
      steps.uigov += 1
      // host-LEGAL option shape {label} only (f3's boot-f2 measured law: an
      // `id` on an option is refused ask-unknown-parameter BEFORE the port).
      if (step === 0 || step === 1) return toolCall('ask_user_question', assembly.askArgs())
      if (step === 2) return toolCall('present', { files: [{ path: files.presented.path, description: 'uif4 in-root present attempt' }] })
      return { kind: 'text', content: 'UIF4_UI_DONE' }
    }
    // ── leader lane ─────────────────────────────────────────────────────────
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => {
        const s = (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')
        const m2 = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(s) ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(s) ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(s)
        return m2 === null ? null : (m2[1] ?? m2[0])
      })
      .filter((x) => x !== null))]
    if (seen.length >= 1 && ids.uigov === undefined) ids.uigov = seen[0]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which ?? 'uigov']
        if (inst === undefined) return { kind: 'text', content: `UIF4_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `uif4-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (leaderHasMarker(req, ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 10) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      return { kind: 'text', content: `UIF4_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'UIF4_L1_DONE' }
  }
}

/**
 * Pure verdicts over COLLECTED facts. No verdict here is earned by prose:
 * every PASS names the witness that carries it, and an arm that never got to
 * its step is NOT_REACHED (a drive fact), never a softening of the record.
 */
export function judgeUif4({ facts, log, journal, laneDone, hostAlive, healthOk, stateOk }) {
  const out = []
  const askLines = log.filter((l) => l.includes('governed-ask'))
  const askRan = askLines.filter((l) => l.includes('RAN'))
  const portFailed = askLines.filter((l) => l.includes('port-failed'))
  const paRefused = askLines.filter((l) => l.includes('pa-refused'))
  const presentLines = log.filter((l) => l.includes('governed-present'))
  const presentRefusal = presentLines.filter((l) => l.includes('port-refusal') || l.includes('port-failed'))
  const placement = log.filter((l) => l.includes('placement-feed rows='))
  const uiRefusedMount = log.filter((l) => l.includes('PLANE_UI_REGISTRATION_REFUSED'))

  // ui:ask-approved-ran — the target cell.
  const ranWithAnswers = askRan.length > 0
    && (journal ?? []).some((e) => e?.lastCall === 'ask_user_question'
      && JSON.stringify(e?.resultHead ?? '').includes(String(facts.answeredLabel ?? 'UIF4_NO_ANSWER')))
  out.push(['ui:ask-approved-ran',
    ranWithAnswers && (facts.answered?.length ?? 0) > 0 ? 'PASS' : 'FAIL', {
    ranWitness: askRan[0]?.slice(0, 200) ?? null,
    ranCount: askRan.length,
    answeredCount: facts.answered?.length ?? 0,
    answeredHead: facts.answered?.[0] ?? null,
    portFailedLine: portFailed[0]?.slice(0, 240) ?? null,
    waterfallFrames: facts.waterfallFrames?.length ?? 0,
    law: 'PASS needs ALL of: a durable ask row allowed through team.resolveControl v4, the $events waterfall answered over POST /api/$events/result, and governed-ask RAN with the SAME answer text back in the tool_result.',
  }])

  // ui:ask-approval-chain — durable row + allow + consume, one requestId.
  const chain = facts.approval ?? { requestRows: [], decisions: [], consumed: [] }
  const allowEntry = (chain.resolutions ?? []).find((r) => r.decision === 'allow') ?? null
  const askToolRows = (chain.requestRows ?? []).filter((r) => r.toolName === 'ask_user_question')
  out.push(['ui:ask-approval-chain',
    askToolRows.length >= 2 && allowEntry?.ok === true && (chain.consumed ?? []).length >= 1 ? 'PASS' : 'FAIL', {
    askToolRows: askToolRows.length,
    rowToolNames: (chain.requestRows ?? []).map((r) => r.toolName),
    allowResolution: allowEntry,
    decisions: chain.decisions ?? [],
    consumed: chain.consumed ?? [],
    law: 'L1+L5: control-request-recorded(toolName=ask_user_question) → control-decision-recorded(allow) → control-allow-consumed on the SAME requestId, from the p6t6 ledger face the runner reads independently.',
  }])

  // ui:ask-replay-refused — consume-once: the second resolve on a settled row refuses.
  const second = facts.secondResolve ?? null
  const consumedRefusal = second !== null && second.ok === false
  const zeroSecondRan = askRan.length <= 1
  out.push(['ui:ask-replay-refused',
    consumedRefusal && zeroSecondRan ? 'PASS' : (second === null ? 'FAIL' : 'FAIL'), {
    secondResolveOnSettledRow: second,
    ranCount: askRan.length,
    deniedRowRefusalLine: paRefused[0]?.slice(0, 220) ?? null,
    law: 'the same requestId settled twice must be refused by the seam (row-scoped consume-once, the u7-tbash law LEG-0 §Q3-5 pinned offline); PASS names the seam response, and no second governed-ask RAN may exist.',
  }])

  // ui:answer-wire — did the LIVE frames match the LEG-0-pinned envelopes?
  const wire = facts.wire ?? {}
  out.push(['ui:answer-wire',
    wire.readySeen === true && wire.waterfallSeen === true && wire.resultAccepted === true ? 'PASS' : 'FAIL', {
    muxPath: wire.muxPath ?? null,
    readyFrame: wire.readyFrame ?? null,
    waterfallShapeOk: wire.waterfallShapeOk ?? false,
    waterfallFrames: (facts.waterfallFrames ?? []).map((f) => ({ event: f.event, agentId: String(f.agentId).slice(0, 24), nQuestions: f.questions?.length ?? null })),
    settlement: facts.answered?.[0] ?? null,
    openError: wire.openError ?? null,
    law: 'PASS needs: cookie-carrying upgrade to /api/remote.mux, $events open → ready{clientId}, a waterfall frame satisfying the pinned predicate (event=user-questions/request, eventId, agentId, request.questions[]), and the POST /api/$events/result {clientId,eventId,outcome} accepted. Any drift is a FAIL naming the live shape — the pinned shape came from PR #489 and is allowed to be wrong.',
  }])

  // ui:live-root-law — the honest recording cell (NOT_RUN-safe by order).
  const laneRefusal = (facts.answered ?? []).some((a) => /lane-refusal|DELEGATED_CALLER|CALLER_NOT_LIVE/.test(JSON.stringify(a)))
    || portFailed.some((l) => /DELEGATED_CALLER|CALLER_NOT_LIVE/.test(l))
  const memberArmReached = askToolRows.length > 0 || askLines.length > 0
  out.push(['ui:live-root-law',
    laneRefusal ? 'PASS' : (facts.assertLiveRootObserved === true ? 'PASS' : 'NOT_REACHED'), {
    laneRefusal,
    assertLiveRootObserved: facts.assertLiveRootObserved === true,
    memberArmReached,
    portFailedLines: portFailed.map((l) => l.slice(0, 200)),
    law: 'L2 as-is: assertLiveRoot only runs when the request carries an Agent (user-questions/src/index.ts:295,131-141). The family port binding (families/ui.mjs:82 createUserQuestionsPort(service)) passes none, so the open ask never reaches the live-root law at all — that is recorded here, not retried, and NOT_RUN-safe by lane order.',
  }])

  // ui:present-env-truth — the environment truth rides along, one witness.
  const presentTruth = presentRefusal.length > 0 || journal.some((e) => e?.lastCall === 'present'
    && /UI_PRESENT_PORT_ABSENT|refused-/i.test(JSON.stringify(e?.resultHead ?? '')))
  out.push(['ui:present-env-truth', presentTruth && hostAlive ? 'PASS' : 'FAIL', {
    presentRefusalLine: presentRefusal[0]?.slice(0, 220) ?? null,
    presentRanCount: presentLines.filter((l) => l.includes('RAN') || l.includes('PROBED')).length,
    law: 'PRESENT-PUBLISH-GAP-MEMO O1: no host ctx service carries a presentation face, so UI_PRESENT_PORT_ABSENT is the environment truth (LEG-0 Q2). One witness, no extra boot.',
  }])

  // the mount facts are context for every other row, not a cell of their own.
  facts.mount = {
    healthOk, stateOk, hostAlive,
    placementFeed: placement[0]?.slice(0, 240) ?? null,
    uiMountRefused: uiRefusedMount[0]?.slice(0, 200) ?? null,
    lanes: laneDone,
  }
  return out
}
