/**
 * u7astore-assembly.mjs — world materialization for the `u7-astore` C2 suite:
 * the AGENT-STATE family on the production Team row with its PRODUCTION
 * durable store (no injected port — the family descriptor builds the
 * fs-backed store under the host's own `DSH_HOME`, i.e. THIS World's home,
 * at `<home>/team-state/agent-state/<realmId>/`).
 *
 * The World is the PROVEN u7-agent-control shape (production row, profile-
 * patch layer, /team-remote HTTP, mock provider, runner = Human resolver
 * through the PUBLIC team.resolveControl v4 seam), with ONE plane key:
 * `agentStateEnabled: true`. No fsInstance / confined provider: the family
 * declares no fs-class effect.
 *
 * Lanes (what each one is FOR):
 *  - LEADER (a ROOT agent of its team session; permissions default ASK, no
 *    rule can name an agent-state effect, so every call opens a durable
 *    Control ask the runner settles): on the turn the RUNNER opens with a
 *    real `session/prompt` (MK_GOAL — a `user/message` whose source is
 *    `user`, the host's direct-human fact, tool-goal/src/authority.ts:81-90)
 *    it calls `create_goal` (objective = a per-run claim) and then
 *    `get_goal` (the read-back the model sees); then it creates + delegates
 *    the member.
 *  - MEMBER (`asworker`, default ASK): `todo_write` (claim list), then the
 *    CROSS-SCOPE attempt — `update_goal` naming the LEADER's goal_id +
 *    revision (the call's scope is the member's own calling agent, so the
 *    leader's record is unreachable by construction), then its own
 *    `get_goal` (expected `{goal:null}`).
 *
 * Verdicts come from the runner's OWN reads: the store files ON DISK (raw
 * JSON + a fresh production store instance over the same home), the durable
 * ledgers (`ledger/writes.jsonl`, `ledger/attempts.jsonl`), the governed
 * Control ledger, the mock transcripts and host-log witnesses.
 *
 * @module tests/world-factory/lib/u7astore-assembly
 */
import { mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { personaRow, presetDeclarationRow } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

export const AGENT_STATE_NAMES = Object.freeze(['todo_write', 'create_goal', 'get_goal', 'update_goal', 'exit_plan_mode'])

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string}} opts
 */
export function createU7AStoreAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7as-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7as.anchor'
  const BP_MAIN_ID = 'team.u7as.main'
  const ROOT = `session-u7as-root-${rs}`
  const CREATE_ROOT = `session-u7as-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7as-realm-${rs}`
  // The store root the PRODUCTION descriptor derives — the runner never
  // writes here; it only reads (the independent oracle).
  const STORE_ROOT = join(home, 'team-state', 'agent-state', PLANE_REALM_ID)

  const markers = {
    MK_DISC: `U7AS_DISC_${rs}`,
    MK_L1: `U7AS_L1_${rs}`,
    MK_GOAL: `U7AS_GOAL_${rs}`,
    MK_SCRIPT: `U7AS_SCRIPT_${rs}`,
  }
  const claims = {
    goal: `U7AS_GOAL_CLAIM_${rs}`,
    goalEdited: `U7AS_GOAL_EDITED_${rs}`,
    todo: `U7AS_TODO_CLAIM_${rs}`,
    plan: `U7AS_PLAN_${rs}`,
  }
  const tokens = (n) => `u7as-${n}-${rs}`

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
      staticModel: { provider: 'deepseek-official', model: 'u7as-model' },
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
      // THE ONE KEY. No injected store: production wiring passes `backends`
      // for the jobs bridge only, so the family's descriptor builds its
      // PRODUCTION store from the host process's DSH_HOME (this World's home).
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        agentStateEnabled: true,
      },
    }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7as assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: asworker', '    persona: "You are a worker of the u7as assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. BOTH governed templates run `default: ask` with NO
   * rule: the closed rule grammar cannot name an agent-state effect, so every
   * governed call opens a durable Control ask (request-control is named on
   * both envelopes — the u74a both-sides law) and proceeds ONLY when the
   * runner (Human resolver) settles it through team.resolveControl v4.
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7as assembly team. ${markers.MK_L1} starts your chain; when the user sends ${markers.MK_GOAL}, create the goal, read it back, then create the one asworker member and delegate its script exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control',
      '  deny: []',
      'members:',
      '  - templateId: asworker', '    displayName: "u7as agent-state worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7as assembly team (agent-state lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: asworker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  function teamRows() {
    const basePlugins = [
      personaRow({
        text: 'You are a coding agent powered by the {{model}} model.',
        suffix: 'Your working directory is {{cwd}}.',
      }),
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    ]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u7as base',
        description: `u7as base preset (${runStamp}) = persona + tool-fs + tool-fs-search`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(workspaceDir, { recursive: true })
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }

  /**
   * DISCLOSED PLANT: the family exposes no tool that ENTERS plan mode (the
   * host's plan-mode service does, and it is not wired to this store), so
   * the runner seeds `planMode.active=true` for the LEADER scope BEFORE boot
   * through the production store's own atomic seed path. The exit_plan_mode
   * positive then proves the governed row's durable commit on the real
   * host — not that a live session entered plan mode.
   */
  async function plantLeaderPlanMode(storeModule, homeReal) {
    const store = storeModule.createFsStateStore({ rootDir: STORE_ROOT, anchorDir: homeReal, realmId: PLANE_REALM_ID })
    await store.seedPlanMode(`agent:${CREATE_ROOT}`, true)
    return `agent:${CREATE_ROOT}`
  }

  /**
   * The runner's OWN raw read of the store ON DISK (no family code): every
   * scope record (JSON, bounded) + both durable ledgers. `base` is the store
   * root redacted RELATIVE to DSH_HOME (the evidence shows where state lived
   * without leaking an absolute machine path).
   */
  function readStoreOnDisk() {
    const out = { base: relative(home, STORE_ROOT).split(sep).join('/'), rootExists: false, realUnderHome: null, records: [], writes: [], attempts: [], errors: [] }
    try {
      const realRoot = realpathSync(STORE_ROOT)
      const realHome = realpathSync(home)
      out.rootExists = true
      out.realUnderHome = realRoot.startsWith(`${realHome}${sep}`)
    } catch (error) {
      out.errors.push(`store root: ${String(error?.code ?? error)}`)
      return out
    }
    const scopes = join(STORE_ROOT, 'scopes')
    try {
      for (const f of readdirSync(scopes).filter((n) => n.endsWith('.json')).sort()) {
        const p = join(scopes, f)
        const st = statSync(p)
        if (st.size > 256 * 1024) { out.errors.push(`${f}: oversized`); continue }
        try {
          const rec = JSON.parse(readFileSync(p, 'utf8'))
          out.records.push({ file: f, nlink: st.nlink, key: rec.key, goal: rec.goal ?? null, todos: rec.todos ?? null, planMode: rec.planMode ?? null })
        } catch (error) { out.errors.push(`${f}: ${String(error?.message ?? error).slice(0, 80)}`) }
      }
    } catch (error) { out.errors.push(`scopes: ${String(error?.code ?? error)}`) }
    const lines = (name) => {
      try { return readFileSync(join(STORE_ROOT, 'ledger', name), 'utf8').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l)) } catch { return [] }
    }
    out.writes = lines('writes.jsonl')
    out.attempts = lines('attempts.jsonl')
    return out
  }

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID, STORE_ROOT,
    blueprintDir, workspaceDir, markers, claims, tokens,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readStoreOnDisk, plantLeaderPlanMode,
  }
}

/** Tool_use names already in a transcript (stateless lane progress). */
function usedToolNames(req) {
  const out = []
  for (const m of messagesOf(req)) {
    if (m?.role !== 'assistant' || !Array.isArray(m?.content)) continue
    for (const b of m.content) if (b?.type === 'tool_use') out.push(String(b?.name ?? ''))
  }
  return out
}
/** Every tool_result text in a transcript, in order. */
function toolResultTexts(req) {
  const out = []
  for (const m of messagesOf(req)) {
    for (const b of Array.isArray(m?.content) ? m.content : []) {
      if (b?.type === 'tool_result') out.push((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('') || String(b.content ?? ''))
    }
  }
  return out
}

/**
 * The mock model. Leader: on MK_GOAL (the runner's human prompt) →
 * create_goal(claim) → get_goal → team lifecycle (create asworker,
 * delegate, collect on the fence). Member: todo_write(claim) →
 * update_goal(the LEADER's goal ref, complete) → get_goal → DONE.
 */
export function makeU7AStoreDecide({ assembly }) {
  const { tokens, markers, claims } = assembly
  const steps = { worker: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'asworker', tok: 'c1', label: 'u7as-worker' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_SCRIPT, fence: 'U7AS_WORKER_DONE' },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((t) => t.includes('[team-work-settled requestToken='))
    .map((t) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t); return m2 === null ? null : m2[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
  function laneOf(req) {
    const t = messagesOf(req).map(textOf).join('\n')
    if (t.includes('Generate the session title')) return 'title'
    const lu = lastUserTextOfStatic(req)
    if (lu.includes(markers.MK_DISC)) return 'disc'
    const ut = messagesOf(req)
      .filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
      .join('\n')
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'worker'
    if (t.includes(markers.MK_L1) || t.includes(markers.MK_GOAL) || lu.includes('U7AS_PHASE_') || t.includes('[team-work-settled') || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
  const leaderHasMarker = (req, marker) => messagesOf(req).map(textOf).join('\n').includes(marker)
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u7as assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7AS_NOOP_DONE' }
    if (lane === 'worker') {
      const step = steps.worker
      steps.worker += 1
      if (step === 0) return toolCall('todo_write', { todos: [{ content: claims.todo, status: 'in_progress' }, { content: `${claims.todo} second`, status: 'pending' }] })
      if (step === 1) return toolCall('update_goal', { goal_id: ids.goalId ?? 'u7as-no-goal-seen', revision: 1, action: 'complete' })
      if (step === 2) return toolCall('get_goal', {})
      return { kind: 'text', content: 'U7AS_WORKER_DONE' }
    }
    // ── leader lane ─────────────────────────────────────────────────────────
    const used = usedToolNames(req)
    for (const txt of toolResultTexts(req)) {
      const m = /"goal_id"\s*:\s*"([^"]+)"/.exec(txt)
      if (m !== null && ids.goalId === undefined) ids.goalId = m[1]
      const inst = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(txt) ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(txt) ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(txt)
      if (inst !== null && ids.worker === undefined && !txt.includes('"goal"')) ids.worker = inst[1] ?? inst[0]
    }
    // The goal leg runs ONLY on a turn whose transcript carries the human
    // MK_GOAL prompt (the direct-human fact the host authority reads).
    if (!leaderHasMarker(req, markers.MK_GOAL)) return { kind: 'text', content: 'U7AS_L1_WAITING_FOR_HUMAN' }
    if (!used.includes('create_goal')) return toolCall('create_goal', { objective: claims.goal, max_goal_rounds: 3 })
    if (!used.includes('get_goal')) return toolCall('get_goal', {})
    if (!used.includes('update_goal')) return toolCall('update_goal', { goal_id: ids.goalId ?? 'u7as-no-goal-seen', revision: 1, action: 'edit', objective: claims.goalEdited })
    if (!used.includes('exit_plan_mode')) return toolCall('exit_plan_mode', { plan: `# ${claims.plan}\n\n- the u7as live plan` })
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        if (ids.worker === undefined) return { kind: 'text', content: `U7AS_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: ids.worker, label: `u7as-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (leaderHasMarker(req, ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 8) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      return { kind: 'text', content: `U7AS_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U7AS_L1_DONE' }
  }
}

/**
 * Pure verdicts over COLLECTED facts. Every PASS names its witnesses; a
 * typed host-authority refusal of a positive is REFUSED (verbatim), never
 * flipped; silence FAILS.
 */
export function judgeU7AStore(f) {
  const V = []
  const { disk, exchanges, placement, storeLine, controlRows, resolutions, homeUnderTests, reread } = f
  const resultOf = (lane, name, nth = 0) => exchanges.filter((e) => e.lane === lane && e.name === name)[nth]?.head ?? null
  const isRefusal = (h) => typeof h === 'string' && /^(refused|Error)/.test(h.trim())
  const fiveOnFeed = placement.length > 0 && AGENT_STATE_NAMES.every((n) => placement.some((l) => l.includes(n)))
  V.push(['ast:mounted', fiveOnFeed && storeLine.length > 0 ? 'PASS' : 'FAIL', {
    placementFeed: placement.map((l) => l.slice(0, 260)),
    storeWitness: storeLine.map((l) => l.slice(0, 200)),
    law: 'agentStateEnabled=true + NO injected port: the descriptor built the PRODUCTION fs store from the host DSH_HOME; the five rows sit on the placement feed',
  }])
  V.push(['ast:store-under-world-home', homeUnderTests === true && disk.rootExists === true && disk.realUnderHome === true ? 'PASS' : 'FAIL', {
    homeUnderTestsHomes: homeUnderTests, storeBase: disk.base, rootExists: disk.rootExists, realpathUnderHome: disk.realUnderHome, errors: disk.errors,
  }])
  // create_goal positive: the DISK fact is the verdict source.
  const goalRecs = disk.records.filter((r) => r.goal?.objective === f.claims.goal || r.goal?.objective === f.claims.goalEdited)
  const goalRec = goalRecs[0] ?? null
  const createHead = resultOf('leader', 'create_goal')
  const goalWrites = goalRec === null ? [] : disk.writes.filter((w) => w.op === 'goal/apply' && w.scope === goalRec.key)
  const goalWrite = goalWrites.slice(0, 1)
  const createRow = controlRows.filter((r) => /create_goal/.test(`${r.toolName} ${r.summary}`))
  const createAttempt = goalRec === null ? null : disk.attempts.find((a) => a.op === 'goal/apply' && a.scope === goalRec.key && a.outcome === 'applied') ?? null
  const rereadOk = reread !== null && reread?.goal !== undefined && JSON.stringify(reread.goal) === JSON.stringify(goalRec?.goal ?? null)
  if (goalRecs.length === 1 && rereadOk && goalRec.goal.phase === 'active' && goalWrites.length >= 1 && createAttempt !== null && String(goalRec.key).startsWith('agent:') && goalRec.nlink === 1 && !isRefusal(createHead) && String(createHead).includes(f.claims.goal)) {
    V.push(['ast:create-goal-positive', 'PASS', {
      diskRecord: { key: goalRec.key, goal: goalRec.goal, nlink: goalRec.nlink, file: goalRec.file },
      writesAudit: goalWrite,
      freshStoreReread: reread?.goal ?? null,
      controlRows: createRow,
      modelSaw: String(createHead ?? '').slice(0, 300),
      law: 'durable PA ask settled ONCE by the human seam → grant consumed → the production store committed the goal (temp+fsync+rename); read back from disk by the runner AND through a fresh store instance',
    }])
  } else if (isRefusal(createHead)) {
    V.push(['ast:create-goal-positive', 'REFUSED', { toolResultHead: String(createHead).slice(0, 400), diskRecords: disk.records.length, controlRows: createRow, resolutions: resolutions.filter((r) => /create_goal/.test(String(r.toolName))) }])
  } else {
    V.push(['ast:create-goal-positive', 'FAIL', { createHead, goalRecs: goalRecs.length, rereadOk, reread, writes: disk.writes, controlRows: createRow }])
  }
  // get_goal runs BEFORE the edit, so the model must have seen the ORIGINAL
  // claim, revision 1 — the durable fact create_goal committed — through a
  // settled Control ask (the read rides the same PA chain as the mutators).
  const getHead = resultOf('leader', 'get_goal')
  const getRow = controlRows.filter((r) => /get_goal/.test(`${r.toolName} ${r.summary}`))
  const getSettled = getRow.some((r) => r.status === 'settled')
  let getParsed = null
  try { getParsed = JSON.parse(String(getHead ?? '')) } catch { getParsed = null }
  const readBack = getParsed?.goal?.objective === f.claims.goal && getParsed?.goal?.revision === 1 && getParsed?.goal?.goal_id === goalRec?.goal?.goalId
  V.push(['ast:get-goal-readback', readBack && getSettled && !isRefusal(getHead) ? 'PASS' : (isRefusal(getHead) ? 'REFUSED' : 'FAIL'), {
    toolResultHead: String(getHead ?? '').slice(0, 400),
    controlRows: getRow,
    readBackMatchesDiskGoalId: readBack,
    law: 'the governed READ row (tool-invoke + meta arms, no mutation kind) walked a durable Control ask settled once by the human seam and returned the durable goal the store committed (goal_id equal to the disk record, revision 1, the create claim)',
  }])
  const todoRecs = disk.records.filter((r) => Array.isArray(r.todos) && r.todos.some((t) => t.content === f.claims.todo))
  const todoHead = resultOf('worker', 'todo_write')
  const todoWrite = todoRecs.length === 0 ? [] : disk.writes.filter((w) => w.op === 'todos/apply' && w.scope === todoRecs[0].key)
  if (todoRecs.length === 1 && todoWrite.length === 1 && todoRecs[0].key !== goalRec?.key) {
    V.push(['ast:todo-write-positive', 'PASS', {
      diskRecord: { key: todoRecs[0].key, todos: todoRecs[0].todos, nlink: todoRecs[0].nlink },
      writesAudit: todoWrite,
      modelSaw: String(todoHead ?? '').slice(0, 300),
      law: 'member ask settled by the human seam → the production store committed the whole-list replacement in the MEMBER scope (distinct from the leader scope)',
    }])
  } else if (isRefusal(todoHead)) {
    V.push(['ast:todo-write-positive', 'REFUSED', { toolResultHead: String(todoHead).slice(0, 400) }])
  } else {
    V.push(['ast:todo-write-positive', 'FAIL', { todoHead, todoRecs: todoRecs.length, writes: disk.writes }])
  }
  // update_goal(edit) positive on the leader: revision folds to EXACTLY 2,
  // objective replaced, a second goal/apply write in the SAME scope.
  const editHead = resultOf('leader', 'update_goal')
  if (goalRec !== null && goalRec.goal.objective === f.claims.goalEdited && goalRec.goal.revision === 2 && goalWrites.length === 2 && !isRefusal(editHead)) {
    V.push(['ast:update-goal-positive', 'PASS', {
      diskRecord: { key: goalRec.key, goal: goalRec.goal },
      writesAudit: goalWrites,
      modelSaw: String(editHead ?? '').slice(0, 300),
      law: 'direct-human edit at the exact revision → the store CAS applied → revision 1→2 durably (fold law), read from disk',
    }])
  } else if (isRefusal(editHead)) {
    V.push(['ast:update-goal-positive', 'REFUSED', { toolResultHead: String(editHead).slice(0, 400), goal: goalRec?.goal ?? null }])
  } else {
    V.push(['ast:update-goal-positive', 'FAIL', { editHead, goal: goalRec?.goal ?? null, goalWrites }])
  }
  const exitHead = resultOf('leader', 'exit_plan_mode')
  const planRec = disk.records.find((r) => r.key === f.plantedPlanScope) ?? null
  const planWrites = disk.writes.filter((w) => w.op === 'plan-mode/apply' && w.scope === f.plantedPlanScope)
  if (planRec !== null && planRec.planMode?.active === false && JSON.stringify(planRec.planMode?.pendingIntents ?? []).includes(f.claims.plan) && planWrites.length === 1 && !isRefusal(exitHead)) {
    V.push(['ast:exit-plan-mode-positive', 'PASS', {
      diskRecord: { key: planRec.key, planMode: planRec.planMode },
      writesAudit: planWrites,
      modelSaw: String(exitHead ?? '').slice(0, 300),
      plantDisclosed: 'planMode.active=true was PLANTED on disk pre-boot by the runner through the store seed path (the family has no plan-mode ENTRY tool); this case proves the governed exit row commits durably on the real host, not that a live session entered plan mode',
    }])
  } else if (isRefusal(exitHead)) {
    V.push(['ast:exit-plan-mode-positive', 'REFUSED', { toolResultHead: String(exitHead).slice(0, 400), planMode: planRec?.planMode ?? null }])
  } else {
    V.push(['ast:exit-plan-mode-positive', 'FAIL', { exitHead, planRec, planWrites }])
  }
  // cross-scope: the member's update_goal named the LEADER's goal ref.
  const crossHead = resultOf('worker', 'update_goal')
  const memberGet = resultOf('worker', 'get_goal')
  const memberKey = todoRecs[0]?.key ?? null
  // the member runs AFTER the leader's edit: the leader's record must still be
  // exactly what the LEADER left (active, not completed by the member).
  const leaderUntouched = goalRec !== null && goalRec.goal.phase === 'active' && goalWrites.every((w) => w.scope === goalRec.key) && disk.writes.filter((w) => w.op === 'goal/apply').length === goalWrites.length
  const noMemberGoalWrite = memberKey === null ? true : disk.writes.filter((w) => w.op === 'goal/apply' && w.scope === memberKey).length === 0
  const crossNamedLeader = f.workerUpdateArgs?.goal_id !== undefined && goalRec !== null && f.workerUpdateArgs.goal_id === goalRec.goal.goalId
  const crossTyped = typeof crossHead === 'string' && /^refused: GOAL_(NOT_FOUND|STALE_REVISION)/.test(crossHead.trim())
  if (crossTyped && leaderUntouched && noMemberGoalWrite && crossNamedLeader) {
    V.push(['ast:cross-scope-zero-effect', 'PASS', {
      toolResultHead: String(crossHead).slice(0, 400),
      namedForeignRef: f.workerUpdateArgs,
      leaderRecordAfter: goalRec.goal,
      memberGoalWrites: 0,
      memberOwnGetGoal: String(memberGet ?? '').slice(0, 200),
      law: 'the call named the leader goal_id+revision; the scope is the CALLING agent, so it met the member scope and answered typed — the leader record is still active rev 1 on disk and the write audit holds no goal entry for the member',
    }])
  } else {
    V.push(['ast:cross-scope-zero-effect', 'FAIL', { crossHead, crossTyped, leaderUntouched, noMemberGoalWrite, crossNamedLeader, workerUpdateArgs: f.workerUpdateArgs }])
  }
  V.push(['ast:leak-check', f.leakOk ? 'PASS' : 'FAIL', f.leakDetail ?? {}])
  return V
}
