/**
 * dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/u7f-inspect-assembly.mjs
 * — world materialization for the U7-F C2 round (NOT a shared lane asset: a
 * one-round evidence script beside its verdicts, riding the SAME public
 * world-factory machinery the merged suites use, through no new world-kind
 * registration — the caller fabricates the mount descriptor from the
 * library's own public startHost contract).
 *
 * The World: production Team row (dsh-agent-team) whose plane config turns
 * the INSPECT family ON (`inspectFamilyEnabled: true`) over ONE sanctioned
 * skill root, plus the p6t6 observer and the base preset — one public
 * profile-patch layer, exactly the u7-9a shape. The mock provider scripts
 * the member chain: governed `team_skill` load (APPROVED through the live
 * PA ask by the leader's team_resolve_control leg), governed
 * `team_cordis_inspect_list`, and a mutation-shaped / unknown-provider
 * refused call whose zero effect the runner proves from the host log and
 * the disk, never from prose.
 *
 * @module evidence/u7-f-inspect-20261026/c2/u7f-inspect-assembly
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

export function createU7fInspectAssembly({ repoRoot, home, runStamp, reportDir, sessionRoot }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7f-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7f.anchor'
  const BP_MAIN_ID = 'team.u7f.main'
  const ROOT = `session-u7f-root-${rs}`
  const CREATE_ROOT = `session-u7f-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7f-realm-${rs}`
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  // THE sanctioned skill root: a directory the MOUNT config names (trusted
  // host composition config — the family reads nowhere else). The secret
  // file sits OUTSIDE the root: if its claim ever reaches a transcript, the
  // anchor law leaked.
  const SKILL_ROOT = join(home, 'skills')
  const SECRET_FILE = join(home, 'outside-secret.txt')

  const files = {
    demo: { path: join(SKILL_ROOT, 'u7f-demo-skill', 'SKILL.md'), claim: `U7F_DEMO_CLAIM_${rs}` },
    quiet: { path: join(SKILL_ROOT, 'u7f-quiet-skill', 'SKILL.md'), claim: `U7F_QUIET_CLAIM_${rs}` },
    secret: { path: SECRET_FILE, claim: `U7F_SECRET_CLAIM_${rs}` },
  }
  const markers = {
    MK_DISC: `U7F_DISC_${rs}`,
    MK_L1: `U7F_L1_${rs}`,
    MK_SCRIPT: `U7F_SCRIPT_${rs}`,
  }
  const tokens = (n) => `u7f-${n}-${rs}`
  const DONE = { strict: `U7F_STRICT_DONE_${rs}`, leader: `U7F_L1_DONE_${rs}` }

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
      staticModel: { provider: 'deepseek-official', model: 'u7f-model' },
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
        confinedProvider: {
          trustRoot: `sha256:${launcherSha().slice(0, 16)}#${LAUNCHER}`,
          assembly: { launcherPath: LAUNCHER, launcherSha256: launcherSha(), minAbiVersion: 3 },
        },
        // THE gate under test (C2): trusted config turns the family on and
        // sanctions exactly ONE skill root.
        inspectFamilyEnabled: true,
        skillRoots: [SKILL_ROOT],
      },
    }
  }
  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7f inspect assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: strict', '    persona: "You are a worker of the u7f inspect assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `strict` carries default ASK with NO rules: every
   * governed call of the inspect family (whose effect classes the template
   * vocabulary cannot name) must therefore rise as a live PA ask and run
   * only after the leader's durable resolve — the C2 point is the WHOLE
   * governed leg, not a rule-bypassed fast path. The leader additionally
   * carries team_list_pending_control + team_resolve_control so the mock
   * can script the approval leg exactly as a human would resolve it.
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7f inspect assembly team. ${markers.MK_L1} drives your chain: create one governed member, delegate the inspect script, resolve its pending approvals, collect, and close.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      '        - team_list_pending_control', '        - team_resolve_control',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
      'members:',
      '  - templateId: strict', '    displayName: "u7f governed inspect worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7f inspect assembly team (governed lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  function teamRows() {
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u7f base',
        description: `u7f base preset (${runStamp}) = smoke (tool-fs native family)`,
        plugins: basePlugins,
      }),
    ]
  }

  /** Plant the skill corpus + the outside secret BEFORE any host exists. */
  function writePreBootFiles() {
    mkdirSync(join(SKILL_ROOT, 'u7f-demo-skill'), { recursive: true })
    mkdirSync(join(SKILL_ROOT, 'u7f-quiet-skill'), { recursive: true })
    mkdirSync(blueprintDir, { recursive: true })
    writeFileSync(files.demo.path, `---\nname: u7f-demo-skill\ndescription: the governed demo skill\n---\n\nTHE DEMO SKILL BODY ${rs}: multiply everything by two.\n`)
    writeFileSync(files.quiet.path, `---\nname: u7f-quiet-skill\ndescription: hidden from model invocation\n\ndisable-model-invocation: true\n---\n\nQUIET BODY ${files.quiet.claim}\n`)
    writeFileSync(files.secret.path, `OUTSIDE THE SANCTIONED ROOT ${files.secret.claim}\n`)
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return { secretBefore: readFileSync(files.secret.path, 'utf8') }
  }

  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }

  return {
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    SKILL_ROOT, SECRET_FILE, markers, tokens, DONE, files, rs,
    teamRows, writePreBootFiles, writeMainBlueprint,
  }
}

/**
 * The scripted brain. Lanes (the fsmut pattern): title / disc / leader /
 * strict. The strict member runs exactly three governed calls then closes;
 * every call rises as a PA ask (member template default = ask, no rule can
 * name these classes) and only runs after the LEADER lane's scripted
 * team_list_pending_control → team_resolve_control leg approves it — the
 * LIVE governed approval chain over the inspect family end to end.
 */
export function makeU7fInspectDecide({ assembly }) {
  const { tokens, markers, DONE } = assembly
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'strict', tok: 'c1', label: 'u7f-strict' },
    { kind: 'delegate', tok: 'd1', prompt: `${markers.MK_SCRIPT}: call team_skill with {"name":"u7f-demo-skill"}, then team_cordis_inspect_list with {}, then team_cordis_inspect_query with {"platform":"host","provider":"u7f-no-such-provider","method":"nope"}; then report done.`, which: 'strict', fence: DONE.strict },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const steps = { strict: 0 }
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((t) => t.includes('[team-work-settled requestToken='))
    .map((t) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t); return m2 === null ? null : m2[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
  const userTextOf = (req) => messagesOf(req)
    .filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
  function laneOf(req) {
    const t = messagesOf(req).map(textOf).join('\n')
    if (t.includes('Generate the session title')) return 'title'
    const lu = lastUserTextOfStatic(req)
    if (lu.includes(markers.MK_DISC)) return 'disc'
    if (lu.includes('U7F_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'strict'
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool !== null && tool.startsWith('team_') && !['team_skill', 'team_cordis_inspect_list', 'team_cordis_inspect_query'].includes(tool)) return 'leader'
      return 'other'
    }
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
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
  /** The newest tool_result payload text (for requestId extraction). */
  const lastToolResultText = (req) => {
    const messages = messagesOf(req)
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]
      const parts = Array.isArray(m?.content) ? m.content : []
      for (let j = parts.length - 1; j >= 0; j -= 1) {
        const b = parts[j]
        if (b?.type === 'tool_result') {
          const s = (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')
          if (s.length > 0) return s
        }
      }
      if (typeof m?.content === 'string' && m.role === 'tool') return m.content
    }
    return ''
  }
  let pendingResolveRound = 0
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u7f inspect assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7F_NOOP_DONE' }
    if (lane === 'strict') {
      const step = steps.strict
      steps.strict += 1
      if (step === 0) return toolCall('team_skill', { name: 'u7f-demo-skill' })
      if (step === 1) return toolCall('team_cordis_inspect_list', {})
      if (step === 2) return toolCall('team_cordis_inspect_query', { platform: 'host', provider: 'u7f-no-such-provider', method: 'nope' })
      return { kind: 'text', content: DONE.strict }
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
    if (seen.length >= 1 && ids.strict === undefined) ids.strict = seen[0]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which ?? 'strict']
        if (inst === undefined) return { kind: 'text', content: `U7F_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `u7f-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      // The LIVE approval leg: list pending controls, resolve the newest
      // with the EXACT requestId the host itself published.
      const resultText = lastToolResultText(req)
      if (/team_list_pending_control/.test(lastAssistantToolName(req)) || /"pending"|pendingControls|"cases"/.test(resultText)) {
        const rid = extractRequestId(resultText)
        if (rid !== null && pendingResolveRound < 6) {
          pendingResolveRound += 1
          return toolCall('team_resolve_control', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`r${String(pendingResolveRound)}`), requestId: rid, decision: 'allow' })
        }
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      const leaderHasMarker = messagesOf(req).map(textOf).join('\n').includes(ph.fence)
      if (leaderHasMarker) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 12) {
        // wake cadence from INSIDE the leader lane: each fence wait first
        // takes one approval sweep (list), then a collect poll.
        if (fenceRounds % 2 === 1) return toolCall('team_list_pending_control', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`lp${String(fenceRounds)}`) })
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      }
      fenceRounds = 0
      return { kind: 'text', content: `U7F_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: DONE.leader }
  }
}

const lastAssistantToolName = (req) => messagesOf(req).slice().reverse()
  .flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
  .filter((b) => b?.type === 'tool_use')
  .map((b) => String(b?.name ?? ''))[0] ?? ''

export function extractRequestId(text) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(text ?? '')
  return m === null ? null : m[1]
}
