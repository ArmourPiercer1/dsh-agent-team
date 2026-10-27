/**
 * ac1-assembly.mjs — the AC-1 C2 World (evidence-local; forked from the #406
 * `tests/world-factory/lib/u7fa-assembly.mjs`, which stays byte-untouched).
 *
 * The production Team row with `teamToolPlane.agentControlEnabled: true`
 * (the family mounts through the FamilyAssembly seam; ZERO center diff).
 * NO `agentRuntime`, NO `callerAuthority` is injected: the family resolves
 * the PUBLIC host `subagents` / `llm` services through `cap.hostService` and
 * runs under the build-time TIER A ceiling (AC-1).
 *
 * Two presets:
 *   - MEMBER preset (native presentation): persona + tool-fs + tool-fs-search.
 *     The acpilot member runs `default: ask`, so every in-lane agent-control
 *     call opens a durable Control ask the runner settles over the human
 *     public seam (team.getLedgerPage + team.resolveControl v4).
 *   - ROOT/leader preset: the same rows + `@deepseek-ai/dsh-agent-tool-presentation`
 *     `mode: both` — the leader's public tool view carries the reserved
 *     `run_code` transport (PTC presentation) while direct calls still work,
 *     which is exactly the caller the Tier A PTC fence must refuse.
 *
 * The mock model drives: leader lifecycle (create → delegate d1 → collect →
 * delegate d2 → collect → PTC probe), the pilot's two scripted turns, and the
 * two CHILD lanes (spawn child: attempts `read` on the outside secret, then
 * answers; fork child: answers whether the completed-turn token is in its
 * seeded transcript).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { personaRow, presetDeclarationRow } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf } from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'

export const AGENT_CONTROL_MANAGED_NAMES = Object.freeze([
  'subagent', 'subagent_fork', 'send_message', 'interrupt_agent',
  'list_agents', 'list_subagent_models', 'workflow',
])
export const AC1_TOOLS = Object.freeze(['list_subagent_models', 'list_agents', 'subagent', 'subagent_fork'])

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/** User-authored text only (string content + text blocks; never tool_result). */
export function userTexts(req) {
  const out = []
  for (const m of messagesOf(req)) {
    if (m?.role !== 'user') continue
    if (typeof m.content === 'string') { out.push(m.content); continue }
    for (const b of Array.isArray(m.content) ? m.content : []) {
      if (b?.type === 'text' && typeof b.text === 'string') out.push(b.text)
    }
  }
  return out
}
/** Number of assistant tool_use blocks AFTER the last user text containing `anchor`. */
export function stepsAfter(req, anchor) {
  const messages = messagesOf(req)
  let start = -1
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i]
    if (m?.role !== 'user') continue
    const texts = typeof m.content === 'string' ? [m.content] : (Array.isArray(m.content) ? m.content : []).filter((b) => b?.type === 'text').map((b) => String(b.text ?? ''))
    if (texts.some((t) => t.includes(anchor))) start = i
  }
  if (start < 0) return -1
  let n = 0
  for (const m of messages.slice(start + 1)) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
    n += m.content.filter((b) => b?.type === 'tool_use').length
  }
  return n
}

export function createAc1Assembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const MEMBER_PRESET_ID = `u7ac1-member-${rs}`
  const ROOT_PRESET_ID = `u7ac1-root-${rs}`
  const BP_ANCHOR_ID = 'team.u7ac1.anchor'
  const BP_MAIN_ID = 'team.u7ac1.main'
  const ROOT = `session-u7ac1-root-${rs}`
  const CREATE_ROOT = `session-u7ac1-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7ac1-realm-${rs}`
  // The secret lives OUTSIDE the workspace; the spawn child tries to read it.
  const SECRET_FILE = join(home, 'outside-secret.txt')
  const SECRET_CLAIM = `U7AC1_SECRET_CLAIM_${rs}_never_disclosed`

  const markers = {
    MK_DISC: `U7AC1_DISC_${rs}`,
    MK_L1: `U7AC1_L1_${rs}`,
    MK_SCRIPT1: `U7AC1_SCRIPT1_${rs}`,
    MK_SCRIPT2: `U7AC1_SCRIPT2_${rs}`,
    TOKEN: `K7Q${rs.replace(/-/g, '').slice(-10)}`,
    CHILD_SPAWN: `U7AC1_CHILD_SPAWN_${rs}`,
    CHILD_FORK: `U7AC1_CHILD_FORK_${rs}`,
  }
  const DONE = {
    pilot1: 'U7AC1_PILOT1_DONE',
    pilot2: 'U7AC1_PILOT2_DONE',
    leader: 'U7AC1_L1_DONE',
    childPong: 'U7AC1_CHILD_PONG',
    forkSaw: 'U7AC1_FORK_SAW_TOKEN',
    forkMissed: 'U7AC1_FORK_NO_TOKEN',
  }
  const tokens = (n) => `u7ac1-${n}-${rs}`

  function teamRowConfig() {
    return {
      rootSessionId: ROOT,
      bootPhase: 'create',
      blueprintSource: BP_ANCHOR_YAML,
      blueprintDir,
      rootPresetId: ROOT_PRESET_ID,
      memberPresetId: MEMBER_PRESET_ID,
      seedMembers: [],
      generation: 1,
      staticModel: { provider: 'deepseek-official', model: 'u7ac1-model' },
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
      // ONE boolean flips the family on. Nothing else: no injected port, no
      // injected caller authority — production faces + Tier A ceiling.
      teamToolPlane: { realmId: PLANE_REALM_ID, agentControlEnabled: true },
    }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7ac1 team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: acpilot', '    persona: "You are a worker of the u7ac1 team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /** Leader `default: ask` so the family walk reaches its fences (the PTC
   *  probe must not be pre-empted by the template-default-deny refusal). */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7ac1 team. ${markers.MK_L1} drives your chain.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control',
      '  deny: []',
      'members:',
      '  - templateId: acpilot', '    displayName: "u7ac1 agent-control pilot"',
      `    persona: ${JSON.stringify('You are a worker of the u7ac1 team. Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: leader', '    envelope:', '      allow:', '        - create-member', '        - assign-task', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      '  - templateId: acpilot', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  function teamRows() {
    const basePlugins = () => [
      personaRow({ text: 'You are a coding agent powered by the {{model}} model.', suffix: 'Your working directory is {{cwd}}.' }),
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    ]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: MEMBER_PRESET_ID, displayName: 'u7ac1 member',
        description: `u7ac1 member preset (${runStamp}) = persona + tool-fs + tool-fs-search (native presentation)`,
        plugins: basePlugins(),
      }),
      presetDeclarationRow({
        id: ROOT_PRESET_ID, displayName: 'u7ac1 root',
        description: `u7ac1 root preset (${runStamp}) = member rows + PTC presentation mode both`,
        plugins: [...basePlugins(), { id: 'tool-presentation', name: '@deepseek-ai/dsh-agent-tool-presentation', config: { mode: 'both' } }],
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(workspaceDir, { recursive: true })
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(SECRET_FILE, `${SECRET_CLAIM}\n`)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return { blueprintDir, workspaceDir, secretBefore: `${SECRET_CLAIM}\n` }
  }

  function writeMainBlueprint(denyList) {
    mkdirSync(blueprintDir, { recursive: true })
    const file = join(blueprintDir, 'main.yaml')
    writeFileSync(file, mainBlueprintYaml(denyList))
    return file
  }

  return {
    MEMBER_PRESET_ID, ROOT_PRESET_ID, BP_ANCHOR_ID, BP_MAIN_ID, ROOT, CREATE_ROOT, PLANE_REALM_ID,
    blueprintDir, workspaceDir, markers, DONE, tokens, SECRET_FILE, SECRET_CLAIM,
    teamRowConfig, teamRows, writePreBootFiles, writeMainBlueprint,
  }
}

/**
 * The mock model. Lane order matters: CHILD markers first (a fork child's
 * seeded transcript carries the pilot's own envelopes), then pilot turns
 * (d2 before d1 — turn 2's transcript carries both), then leader.
 */
export function makeAc1Decide({ assembly }) {
  const { tokens, markers, DONE } = assembly
  const ENV1 = `[team-work requestToken=${tokens('d1')}`
  const ENV2 = `[team-work requestToken=${tokens('d2')}`
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'acpilot', tok: 'c1', label: 'u7ac1-pilot' },
    { kind: 'delegate', tok: 'd1', prompt: `${markers.MK_SCRIPT1} Remember this token for later: ${markers.TOKEN}.`, fence: DONE.pilot1 },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_SCRIPT2, fence: DONE.pilot2 },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const allText = (req) => messagesOf(req).map(textOf).join('\n')
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((t) => t.includes('[team-work-settled requestToken='))
    .map((t) => { const m = /\[team-work-settled requestToken=([^\]\s\\"]+)/.exec(t); return m === null ? null : m[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
  const assistantToolNames = (req) => messagesOf(req)
    .filter((m) => m?.role === 'assistant' && Array.isArray(m.content))
    .flatMap((m) => m.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.name)))

  function laneOf(req) {
    const ut = userTexts(req)
    const t = allText(req)
    if (t.includes('Generate the session title')) return 'title'
    if (ut.some((x) => x.includes(markers.CHILD_SPAWN))) return 'child-spawn'
    if (ut.some((x) => x.includes(markers.CHILD_FORK))) return 'child-fork'
    if (ut.some((x) => x.includes(ENV2))) return 'pilot2'
    if (ut.some((x) => x.includes(ENV1))) return 'pilot1'
    const last = ut.at(-1) ?? ''
    if (last.includes(markers.MK_DISC)) return 'disc'
    if (ut.some((x) => x.includes('U7AC1_PHASE_') || x.includes(markers.MK_L1)) || t.includes('[team-work-settled') || t.includes('[team-root-work')) return 'leader'
    if (assistantToolNames(req).some((n) => n.startsWith('team_'))) return 'leader'
    return 'other'
  }

  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u7ac1 session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7AC1_NOOP_DONE' }
    if (lane === 'child-spawn') {
      // The child ATTEMPTS a tool it was never given (Tier A: zero tools):
      // the host answers an unknown/unavailable tool, then the child answers.
      const step = stepsAfter(req, markers.CHILD_SPAWN)
      if (step === 0) return toolCall('read', { path: assembly.SECRET_FILE })
      return { kind: 'text', content: DONE.childPong }
    }
    if (lane === 'child-fork') {
      // The fork provider seeds the child with the parent's COMPLETED-turn
      // prefix: the token planted in turn 1 must be in THIS request.
      return { kind: 'text', content: allText(req).includes(markers.TOKEN) ? DONE.forkSaw : DONE.forkMissed }
    }
    if (lane === 'pilot1') {
      const step = stepsAfter(req, ENV1)
      switch (step) {
        case 0: return toolCall('list_subagent_models', {})
        case 1: return toolCall('subagent', { description: 'ac1 spawn probe', prompt: `${markers.CHILD_SPAWN} reply with the pong word` })
        case 2: return toolCall('list_agents', {})
        case 3: return toolCall('subagent', { description: 'ac1 route override', prompt: 'never runs', provider: 'deepseek-official' })
        case 4: return toolCall('subagent', { description: 'ac1 tool request', prompt: 'never runs', tools: ['read'] })
        case 5: return toolCall('subagent_fork', { description: 'ac1 fork background', prompt: 'never runs', run_in_background: true })
        default: return { kind: 'text', content: DONE.pilot1 }
      }
    }
    if (lane === 'pilot2') {
      const step = stepsAfter(req, ENV2)
      if (step === 0) return toolCall('subagent_fork', { description: 'ac1 fork probe', prompt: `${markers.CHILD_FORK} which token did we see earlier?` })
      return { kind: 'text', content: DONE.pilot2 }
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
    if (seen.length >= 1 && ids.pilot === undefined) ids.pilot = seen[0]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        if (ids.pilot === undefined) return { kind: 'text', content: `U7AC1_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: ids.pilot, label: `u7ac1-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (allText(req).includes(ph.fence)) { phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 8) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      return { kind: 'text', content: `U7AC1_FENCE_HOLD_${ph.fence}` }
    }
    // PTC probe: the leader (PTC presentation `both`) asks for a Tier A spawn.
    if (!assistantToolNames(req).includes('subagent')) {
      return toolCall('subagent', { description: 'ac1 ptc probe', prompt: 'never runs' })
    }
    return { kind: 'text', content: DONE.leader }
  }
}
