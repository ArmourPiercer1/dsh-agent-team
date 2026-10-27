/**
 * u7f-web-assembly.mjs — world materialization for the `u7-f-web` C2 suite
 * (U7-f C2: the governed WEB family on the REAL pinned Host, ONE World,
 * ZERO center diff). Adapted from the proven u7-fsmut assembly (same
 * lifecycle, same public seams); the differences are the point:
 *
 *  - teamToolPlane carries the closed opt-in booleans `webEnabled: true`
 *    (a network family is OFF by default everywhere else — this world is
 *    the deliberate enable) and `webAllowHttpLoopback: true` (the trusted
 *    mount-time opt that lets the REAL node:http transport reach the
 *    runner's MOCK-band stub; production never sets it).
 *  - the governed member template is the ASK lane (`default: ask`): the
 *    rule grammar names no network tool, so a governed connect effect can
 *    ONLY ever reach a live Control approval — the suite proves exactly
 *    that chain on the real host (member ask → durable Control → LEADER
 *    team_resolve_control allow, and a second ask the leader DENIES).
 *  - web_fetch/web_search are EXCLUDED from the computed builtinToolDeny
 *    (they are kernel/plane-OWNED names on a governed member, in the same
 *    sense the seven managed tools are — a deny entry is a call-site
 *    removal and must not strip the governed row the family placed).
 *
 * DECISION-3 limit restated (verbatim, family law): the host sandbox
 * claims FILE effects only — bwrap runs without `--unshare-net`, Landlock
 * coverage is partial (DECISION-3-ANSWER.md) — network confinement is NOT
 * claimable at the sandbox axis; confinement here is the admission plane
 * (provider-enforced upstream + Team-enforced admission + family law).
 *
 * Nothing here boots or tears down anything — the runner owns the World
 * lifecycle; this module computes MATERIAL and the decide script.
 *
 * @module tests/world-factory/lib/u7f-web-assembly
 */
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

export const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
export const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
/** Plane-OWNED (family-governed) names — never builtinToolDeny targets here. */
export const FAMILY_OWNED_NAMES = ['web_fetch', 'web_search']

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string,
 *          stubOrigin: string}} opts  stubOrigin = `http://127.0.0.1:<port>`
 *   of the suite's MOCK-band stub (the ONLY approved destination).
 */
export function createU7WebAssembly({ repoRoot, home, runStamp, reportDir, stubOrigin }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  // The additive READ-ONLY control-lane probe (u7-4a proven pattern): the
  // runner plays the Human resolver — it READS the pending ask rows through
  // this public face and settles them through the PUBLIC team.resolveControl
  // v4 seam, exactly one write per row. Zero authority in the row itself.
  const PROBE_ROW_URL = pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'canary', 'u7fweb-ctl-probe-host.mjs')).href
  const BASE_PRESET_ID = `u7fweb-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7fweb.anchor'
  const BP_MAIN_ID = 'team.u7fweb.main'
  const ROOT = `session-u7fweb-root-${rs}`
  const CREATE_ROOT = `session-u7fweb-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7fweb-realm-${rs}`

  const markers = {
    MK_DISC: `U7FWEB_DISC_${rs}`,
    MK_L1: `U7FWEB_L1_${rs}`,
    MK_ASK: `U7FWEB_ASK_${rs}`,
    MK_STRICT: `U7FWEB_STRICT_${rs}`,
  }
  const CLAIM_BODY = `U7FWEB_CLAIM_${rs}_BODY`
  const VICTIM_PATH = '/victim-never-wired'
  const tokens = (n) => `u7fweb-${n}-${rs}`

  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

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
      staticModel: { provider: 'deepseek-official', model: 'u7fweb-model' },
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
      // The canonical plane mount. `webEnabled` is the closed opt-in the
      // family descriptor gates on (default FALSE everywhere else);
      // `webAllowHttpLoopback` is the trusted mount-time opt letting the
      // family's DEFAULT real transport (plain node:http — NO injection,
      // this is the production transport path) reach the loopback stub.
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        fsInstance: { fs: 'team-ctl', rootDir: planeRootDir(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
        webEnabled: true,
        webAllowHttpLoopback: true,
      },
    }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7fweb assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: asker', '    persona: "You are a worker of the u7fweb assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `asker` carries `permissions.default: ask` with NO
   * rules — the rule grammar names no network tool, so EVERY governed web
   * effect of this member is an Ask and can only proceed on a durable
   * Control approval the LEADER resolves (allow) or refuses (deny). That
   * is the exact chain this C2 run proves on the real host.
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7fweb assembly team. ${markers.MK_L1} drives your chain: create ONE governed member, delegate the web script exactly, resolve its two Control approvals (allow first, deny second), then collect.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      // NO team_list_pending_control / team_resolve_control HERE on purpose:
      // this World's approvals settle ONLY through the Human resolver (the
      // public team.resolveControl v4 seam, runner-driven), so every
      // decision provably did NOT come from the leader's model lane.
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control', '  deny: []',
      'members:',
      '  - templateId: asker', '    displayName: "u7fweb governed asker"',
      `    persona: ${JSON.stringify('You are a worker of the u7fweb assembly team (governed Ask lane). Follow the delegated web script exactly, one tool call at a time, and never call anything it does not name.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask',
      '        allow: []',
      // NO rules: no rule can name a network effect (closed 7-tool grammar),
      // so the governed web effects land in the Ask lane BY CONSTRUCTION.
      '        ask: []',
      '        deny: []',
      'memberEnvelopes:',
      // `request-control` on the member envelope: the durable ask-row
      // creation IS a request-control mutation (u7-4a measured law —
      // without it the PA ask row is never created and the leg settles
      // deny, proven in c2-run1: pa-refused APPROVAL_DENIED with no row).
      '  - templateId: asker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  function teamRows() {
    const basePlugins = [...smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      { id: 'u7fweb-ctl-probe', name: PROBE_ROW_URL },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u7fweb base',
        description: `u7fweb base preset (${runStamp}) = smoke`,
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

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID,
    blueprintDir, workspaceDir, markers, tokens, CLAIM_BODY, VICTIM_PATH, stubOrigin, PROBE_ROW_URL,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint,
  }
}

/**
 * The decide script. Lanes (chain routing over last-user + trailing tools,
 * the rc2 pattern): title / disc / leader (create → delegate → collect
 * fence) / asker (the governed web script: fetch → fetch(victim) →
 * search(no provider) → DONE). The leader's Control-notification turns
 * route to the leader collect loop WITHOUT resolving: in this World the
 * approvals settle through the PUBLIC `team.resolveControl` v4 seam driven
 * by the RUNNER (the Human-User resolver — the u7-4a proven pattern), so
 * the resolve provably did NOT come from the leader's model lane.
 */
export function makeU7WebDecide({ assembly }) {
  const { markers, tokens, stubOrigin, VICTIM_PATH } = assembly
  const steps = { asker: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'asker', tok: 'c1', label: 'u7fweb-asker' },
    { kind: 'delegate', tok: 'd1', prompt: `${markers.MK_STRICT} Fetch exactly ${stubOrigin}/claim with web_fetch; then web_fetch ${stubOrigin}${VICTIM_PATH}; then web_search with queries ["u7-f web family live probe"]; then report the results.`, which: 'asker', fence: 'U7FWEB_STRICT_DONE' },
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
    if (lu.includes(markers.MK_DISC)) return 'disc'
    if (lu.includes('U7FWEB_PHASE_') || t.includes('[team-work-settled') || t.includes('[team-control requestId=')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'asker'
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
    if (lane === 'title') return { kind: 'text', content: 'u7fweb assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7FWEB_NOOP_DONE' }
    if (lane === 'asker') {
      const step = steps.asker
      steps.asker += 1
      if (step === 0) return toolCall('web_fetch', { url: `${stubOrigin}/claim` })
      if (step === 1) return toolCall('web_fetch', { url: `${stubOrigin}${VICTIM_PATH}` })
      if (step === 2) return toolCall('web_search', { queries: ['u7-f web family live probe'] })
      return { kind: 'text', content: 'U7FWEB_STRICT_DONE' }
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
    if (seen.length >= 1 && ids.asker === undefined) ids.asker = seen[0]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids.asker
        if (inst === undefined) return { kind: 'text', content: `U7FWEB_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `u7fweb-${ph.tok}`, prompt: ph.prompt, async: true })
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
      return { kind: 'text', content: `U7FWEB_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U7FWEB_L1_DONE' }
  }
}
