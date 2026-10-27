/**
 * u7fa-assembly.mjs — world materialization for the `u7-agent-control` suite
 * (U7-F C2): the production Team row whose kernel now owns the SEVEN
 * agent-control natives — `subagent`, `subagent_fork`, `send_message`,
 * `interrupt_agent`, `list_agents`, `list_subagent_models`, `workflow` —
 * mounted as ONE family (dsh.agent-control-family) through the u7-w0b
 * FamilyAssembly seam on the single plane key `agentControlEnabled`, ZERO
 * center diff (CA-01), ZERO new assembly machinery in the plane.
 *
 * What this World PROVES (and only proves — the honest scope):
 *   ac:mounted              — the family mounts on the production row and the
 *                             seven names ride the member tool surface.
 *   ac:enumerate-governed   — an AUTHORIZED enumeration (list_agents) is
 *                             GOVERNED end to end: the plane opens a real
 *                             durable Control ask on the GOVERNED session,
 *                             the runner settles it through the PUBLIC
 *                             team.resolveControl v4 seam, the consumed
 *                             grant carries the call to the production port,
 *                             and the port's answer over the PUBLIC host
 *                             faces (agentTeams.listMembers at the pin) is
 *                             recorded VERBATIM. PASS only on a RAN roster;
 *                             a typed host answer is recorded REFUSED,
 *                             verbatim — never flipped.
 *   ac:spawn-failclosed     — in this production assembly NO trusted
 *                             caller-authority snapshot is wired (that
 *                             injection is the named center round, disclosed),
 *                             so a within-grammar spawn FAILS CLOSED with the
 *                             typed amplification refusal BEFORE the PA edge:
 *                             no Control row, no spawn. Verdict REFUSED is
 *                             the designed answer, recorded verbatim.
 *   ac:interrupt-foreign-zero — a foreign-scope interrupt refuses with the
 *                             typed scope code, opens ZERO Control row (the
 *                             owner fence runs BEFORE the PA edge), and
 *                             reaches ZERO host effect.
 *
 * The verdict sources are all public: the mock transcripts (the rows' own
 * tool_result heads — what the MODEL saw), the governed session ledger over
 * team.getLedgerPage v1 (control rows: recorded / settled / consumed), and
 * host-log witnesses of the plane's own mount/refusal lines.
 *
 * @module tests/world-factory/lib/u7fa-assembly
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { personaRow, presetDeclarationRow } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

/** The seven names this family takes over (the fixed claim set). */
export const AGENT_CONTROL_MANAGED_NAMES = Object.freeze([
  'subagent', 'subagent_fork', 'send_message', 'interrupt_agent',
  'list_agents', 'list_subagent_models', 'workflow',
])
export const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string}} opts
 */
export function createU7FaAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7fa-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7fa.anchor'
  const BP_MAIN_ID = 'team.u7fa.main'
  const ROOT = `session-u7fa-root-${rs}`
  const CREATE_ROOT = `session-u7fa-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7fa-realm-${rs}`

  const markers = {
    MK_DISC: `U7FA_DISC_${rs}`,
    MK_L1: `U7FA_L1_${rs}`,
    MK_SCRIPT: `U7FA_AC_SCRIPT_${rs}`,
  }
  // The foreign-scope target is STRUCTURAL: `<other-scope>:<id>` where the
  // scope part is neither this mount's realm nor its composite scopeKey —
  // the fence refuses without ever probing (zero reach by construction).
  const FOREIGN_TARGET = `u7fa-foreign-scope-${rs}.elsewhere:ghost-9`
  const tokens = (n) => `u7fa-${n}-${rs}`

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
      staticModel: { provider: 'deepseek-official', model: 'u7fa-model' },
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
      // THE U7-F KEY: one boolean flips the whole family on (the jobs gate
      // law). Absent/false the seven natives ride untouched; the plane
      // refuses a non-boolean value fail-closed. No fsInstance/confined
      // Provider: this family declares NO fs-class effect, so the World
      // carries NO fs-class backend (the plane's own Gate-2 posture).
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        agentControlEnabled: true,
      },
    }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7fa assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: acpilot', '    persona: "You are a worker of the u7fa assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. The leader owns member lifecycle only. The ACPILOT
   * template runs permission `default: ask` with NO center rule naming any
   * agent-control tool (the closed PermissionTool grammar cannot name them —
   * the family's rows live BEYOND center, governed by plane decide + PA + the
   * family fences; the u6-arc-a probe precedent proved family-owned natives
   * run on a default-deny template, and boot-3 proved the same plane policy
   * channel reaches the family: a deny-default template makes the family
   * itself answer typed template-default-deny). Under `ask` an admitted-
   * lane effect opens a durable Control row — the C2 AUTHORIZED enumeration:
   * the runner settles it ONCE via team.resolveControl, the grant is
   * CONSUMED, the port leg runs. request-control is named in the pilot's
   * memberEnvelope because the ASK lane creates that durable Control row (a
   * request-control mutation; the u74a both-sides law).
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7fa assembly team. ${markers.MK_L1} drives your chain: create the one acpilot member, delegate the script exactly as instructed, collect it, then stop. Never run a tool of your own beyond the team lifecycle tools.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control',
      '  deny: []',
      'members:',
      '  - templateId: acpilot', '    displayName: "u7fa agent-control pilot"',
      `    persona: ${JSON.stringify('You are a worker of the u7fa assembly team (agent-control lane). Follow the delegated script exactly, one tool call at a time. Report the tool results back verbatim in your final text.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: leader', '    envelope:', '      allow:', '        - create-member', '        - assign-task', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: acpilot', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  /** The rows the factory composes into the patch layer (besides canary). */
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
        id: BASE_PRESET_ID, displayName: 'u7fa base',
        description: `u7fa base preset (${runStamp}) = persona + tool-fs + tool-fs-search`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(workspaceDir, { recursive: true })
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    // The p6t6 observer's boot directive (the kit's shared shape, u74a@332):
    // the observer anchors its report at THIS boot root + phase.
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return { blueprintDir, workspaceDir }
  }

  function writeMainBlueprint(denyList) {
    mkdirSync(blueprintDir, { recursive: true })
    const file = join(blueprintDir, 'main.yaml')
    writeFileSync(file, mainBlueprintYaml(denyList))
    return file
  }

  return {
    BASE_PRESET_ID, BP_ANCHOR_ID, BP_MAIN_ID, ROOT, CREATE_ROOT, PLANE_REALM_ID,
    blueprintDir, workspaceDir, markers, tokens, FOREIGN_TARGET,
    BP_ANCHOR_YAML, mainBlueprintYaml, teamRowConfig, teamRows,
    writePreBootFiles, writeMainBlueprint,
  }
}

/**
 * The mock model: title/disc one-liners, the leader lifecycle state machine
 * (create → delegate → collect-on-fence), and the pilot's THREE-leg script —
 * (0) list_agents (authorized enumeration → real durable Control ask),
 * (1) interrupt_agent at the FOREIGN target (typed fence refusal, zero row),
 * (2) subagent within grammar (fail-closed: no caller-authority snapshot is
 * wired on the production assembly). Then the fence text.
 */
export function makeU7FaDecide({ assembly }) {
  const { tokens, markers } = assembly
  const steps = { pilot: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'acpilot', tok: 'c1', label: 'u7fa-pilot' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_SCRIPT, which: 'pilot', fence: 'U7FA_PILOT_DONE' },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((t) => t.includes('[team-work-settled requestToken='))
    .map((t) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t); return m2 === null ? null : m2[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
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
    if (lu.includes(markers.MK_DISC)) return 'disc'
    if (lu.includes('U7FA_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    // Member follow-up turns arrive with the LAST user message = a
    // tool_result block (no envelope): the envelope lives in the transcript's
    // user messages, so match it across ALL user text — the u74a envelope law
    // (the boot-3 fix round: matching only the last message parked the pilot
    // after its first refusal).
    const ut = messagesOf(req)
      .filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
      .join('\n')
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'pilot'
    const tool = lastToolNameOf(req)
    if (tool !== null && tool.startsWith('team_')) return 'leader'
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
  const leaderHasMarker = (req, marker) => messagesOf(req).map(textOf).join('\n').includes(marker)
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u7fa assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7FA_NOOP_DONE' }
    if (lane === 'pilot') {
      const step = steps.pilot
      steps.pilot += 1
      if (step === 0) return toolCall('list_agents', {})
      if (step === 1) return toolCall('interrupt_agent', { agent_id: assembly.FOREIGN_TARGET })
      if (step === 2) return toolCall('subagent', { description: 'u7fa spawn probe', prompt: 'u7fa-c2-spawn-attempt' })
      return { kind: 'text', content: 'U7FA_PILOT_DONE' }
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
        const inst = ids[ph.which ?? 'pilot']
        if (inst === undefined) return { kind: 'text', content: `U7FA_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `u7fa-${ph.tok}`, prompt: ph.prompt, async: true })
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
      return { kind: 'text', content: `U7FA_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U7FA_L1_DONE' }
  }
}

/**
 * Pure verdicts over COLLECTED facts (no I/O). Every PASS names its
 * witnesses; the two DISCLOSED arms (fail-closed spawn, fork/runWorkflow
 * legs) answer REFUSED with their verbatim tool_result heads — a designed
 * refusal is recorded as the refusal it is, never promoted to PASS.
 *
 * @param facts {{
 *   healthOk: boolean, stateOk: boolean, surface: string[], hostAlive: boolean,
 *   laneDone: Record<string, boolean>,
 *   pilotExchanges: Array<{ name: string, resultHead: string }>,
 *   controlRows: Array<{ requestId: string, toolName: string|null, status: string }>,
 *   resolutions: Array<{ requestId: string, ok: boolean }>,
 *   log: string[],
 * }}
 */
export function judgeU7Fa(facts) {
  const { healthOk, stateOk, surface, hostAlive, laneDone, pilotExchanges, controlRows, resolutions, log } = facts
  const out = []
  const logLines = (pat) => log.filter((l) => l.includes(pat))
  const placement = logLines('placement-feed rows=')
  const planeRefusals = logLines('a5-plane: mount-REFUSED').concat(logLines('a5-plane: placement-REFUSED'))
  // Mount law (boot-3 corrected): the plane is mounted on the GOVERNED
  // sessions, so the witness is the host's OWN placement-feed line — it
  // enumerates every governed row; all SEVEN agent-control names must appear
  // there. The boot-root discovery surface is UNGOVERNED native control
  // (CI-03): the seven names legitimately ride OUTSIDE it at this pin (their
  // native provider plugin is not in the world preset) — recorded as
  // informational, never required. The pilot RANS on the governed session
  // complete the witness: a family row that answers is a mounted row.
  const placementHas = (n) => placement.some((l) => l.includes(`rows=[`) && l.split('rows=[')[1].split(']')[0].split(',').includes(n))
  const placementOk = AGENT_CONTROL_MANAGED_NAMES.every(placementHas)
  const pilotCarried = pilotExchanges.some((e) => AGENT_CONTROL_MANAGED_NAMES.includes(e.name))
  const mountOk = healthOk && stateOk && placementOk && pilotCarried && hostAlive && planeRefusals.length === 0
  out.push(['ac:mounted', mountOk ? 'PASS' : 'FAIL', {
    healthOk, stateOk, hostAlive,
    placementFeed: placement.length > 0 ? placement[placement.length - 1].slice(0, 240) : null,
    planeRefusals: planeRefusals.slice(0, 3).map((l) => l.slice(0, 200)),
    placementHas7: AGENT_CONTROL_MANAGED_NAMES.map((n) => `${n}=${placementHas(n)}`).join(','),
    pilotCarriedFamilyRow: pilotCarried,
    bootRootSurface: surface.join(','),
  }])

  const exByName = (n) => pilotExchanges.filter((e) => e.name === n)
  const listEx = exByName('list_agents')[0] ?? null
  const enumRows = controlRows.filter((r) => String(r.toolName ?? '').includes('list_agents'))
  const enumSettledByRunner = resolutions.some((x) => x.ok === true)
  const enumRan = listEx !== null && !listEx.resultHead.includes('refused-agent-control') && !listEx.resultHead.includes('refused-')
  // Verdict law: PASS only on a RAN roster THAT PASSED THE LEDGER (a real
  // Control row settled by the runner); a RAN roster WITHOUT admission is
  // an unadmitted execution — FAIL, the law break; only a TYPED refusal
  // head is the honest REFUSED (recorded verbatim, never flipped).
  const enumVerdict = (enumRan && laneDone.pilot === true && enumRows.length > 0 && enumSettledByRunner && hostAlive)
    ? 'PASS'
    : (listEx === null || enumRan) ? 'FAIL' : 'REFUSED'
  out.push(['ac:enumerate-governed', enumVerdict, {
      witness: 'governed Control ask on the GOVERNED session (team.getLedgerPage) settled ONCE via team.resolveControl v4; port answer verbatim below',
      listAgentsRows: enumRows,
      settledByRunner: enumSettledByRunner,
      toolResultHead: listEx === null ? null : listEx.resultHead.slice(0, 400),
      pilotLaneDone: laneDone.pilot === true,
      note: enumRan ? 'enumeration RAN through the production port over the public faces pinned at the host baseline'
        : 'the governed walk completed but the port answered typed — recorded VERBATIM as REFUSED, never flipped to PASS',
    }])

  const spawnEx = exByName('subagent')[0] ?? null
  const spawnHead = spawnEx?.resultHead ?? ''
  const spawnFailClosed = spawnHead.includes('refused-agent-control') && spawnHead.includes('agent-control-amplification-refused')
  const spawnRows = controlRows.filter((r) => String(r.toolName ?? '').includes('subagent'))
  out.push(['ac:spawn-failclosed',
    spawnEx === null ? 'FAIL' : spawnFailClosed && spawnRows.length === 0 ? 'REFUSED' : 'FAIL', {
      // REFUSED here is the DESIGNED answer: no trusted caller-authority
      // snapshot is wired into the production assembly (named center round,
      // PR-disclosed), so the no-amplification fence FAILS CLOSED before PA.
      witness: 'fence before the PA edge: zero Control rows for the spawn, zero spawn',
      toolResultHead: spawnHead.slice(0, 400),
      controlRowsForSubagent: spawnRows.length,
    }])

  const intEx = exByName('interrupt_agent')[0] ?? null
  const intHead = intEx?.resultHead ?? ''
  const intRefused = intHead.includes('refused-agent-control') && intHead.includes('agent-control-scope-foreign')
  const intRows = controlRows.filter((r) => String(r.toolName ?? '').includes('interrupt'))
  const intRanWitness = logLines('agent-control-interrupt_agent RAN')
  out.push(['ac:interrupt-foreign-zero',
    (intEx !== null && intRefused && intRows.length === 0 && intRanWitness.length === 0) ? 'PASS' : 'FAIL', {
      witness: 'typed structural refusal; ZERO Control rows opened for the interrupt (fence BEFORE PA); ZERO RAN witnesses',
      toolResultHead: intHead.slice(0, 400),
      controlRowsForInterrupt: intRows.length,
      ranWitnesses: intRanWitness.length,
    }])
  return out
}
