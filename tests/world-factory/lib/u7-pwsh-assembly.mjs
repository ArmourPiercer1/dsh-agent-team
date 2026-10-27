/**
 * u7-pwsh-assembly.mjs — world materialization for the `u7-pwsh` suite
 * (U7-F C2): the governed PWSH shell-class row of the process family,
 * mounted by the SAME teamToolPlane declaration the u6-fs / u6-proc /
 * u7-fs-mut worlds proved — CA-01: a new FAMILY MEMBER needs ZERO center
 * diff and ZERO new assembly keys. The row rides the ONE process-family
 * contribution; the plane mounts it at its fixed native spelling `pwsh`.
 *
 * The kit is the u7-fs-mut shape (profile-patch layer, /team-remote HTTP,
 * mock provider, token-keyed member lanes, leader phase machine). Verdict
 * law (review-r1 F5, unchanged): DISK FACTS + host-log witnesses of the
 * row's OWN observe lines + the durable Control lane read through the
 * PRODUCT read plane — never the transcript alone.
 *
 * Legs (ONE boot):
 *   strict member — default-deny template; its `pwsh` call must land a
 *                   typed refusal with ZERO effect (the marker file never
 *                   exists; no confined-pwsh RAN line).
 *   asker member  — default:ask, no pwsh rule; its `pwsh` call mints a
 *                   REAL pending Control row; the runner settles it
 *                   through the PUBLIC team.resolveControl seam (the
 *                   GUI's own human lane); the kernel consumes the grant
 *                   ONCE and the governed body runs — on a host WITHOUT a
 *                   pwsh executable it must answer the typed
 *                   `pwsh-executable-not-found` refusal BEFORE probe and
 *                   before spawn (the honest ENV arm; zero marker bytes,
 *                   zero provider spawns, one consumption row).
 *   seam replay   — the settled requestId resolved a SECOND time through
 *                   the seam is refused (durable exactly-once), zero
 *                   effect.
 *
 * @module tests/world-factory/lib/u7-pwsh-assembly
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

export const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
export const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

export function createPwshAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7pwsh-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7pwsh.anchor'
  const BP_MAIN_ID = 'team.u7pwsh.main'
  const ROOT = `session-u7pwsh-root-${rs}`
  const CREATE_ROOT = `session-u7pwsh-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7pwsh-realm-${rs}`
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const SHADOW_LEDGER = join(home, 'u7pwsh-shadow-ledger.jsonl')

  // Effect oracles. The pwsh body (were it ever to run) would Set-Content
  // these run-unique claims INTO the governed workspace; the ZERO-EFFECT
  // proof is the runner's own disk read finding NOTHING at those paths —
  // an absent file the host never reports about itself.
  const claims = {
    deny: `U7PWSH_DENY_CLAIM_${rs}`,
    appr: `U7PWSH_APPR_CLAIM_${rs}`,
  }
  const files = {
    deny: join(workspaceDir, 'u7pwsh-deny-marker.txt'),
    appr: join(workspaceDir, 'u7pwsh-asker-marker.txt'),
  }
  const markers = {
    MK_DISC: `U7PWSH_DISC_${rs}`,
    MK_L1: `U7PWSH_L1_${rs}`,
    MK_DENY: `U7PWSH_DENY_${rs}`,
    MK_APPR: `U7PWSH_APPR_${rs}`,
  }
  const tokens = (n) => `u7pwsh-${n}-${rs}`
  const wsReal = () => {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }
  // pwsh-form commands (the row would run them verbatim behind the
  // encoding preamble): Set-Content writers whose TARGET PATHS the runner
  // watches as the independent oracle. On a pwsh-less host the row refuses
  // before the launcher exists; either way the files stay absent.
  const cmds = () => {
    const root = wsReal()
    return {
      deny: `Set-Content -Path '${join(root, 'u7pwsh-deny-marker.txt')}' -Value '${claims.deny}'`,
      appr: `Set-Content -Path '${join(root, 'u7pwsh-asker-marker.txt')}' -Value '${claims.appr}'`,
    }
  }
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
      staticModel: { provider: 'deepseek-official', model: 'u7pwsh-model' },
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
      // THE U7-F SURFACE: byte-for-byte the proven governed-mount shape
      // (u6-fs/u6-proc/u7-fs-mut measured). The process family mounts
      // BOTH shell rows from this ONE declaration — no new flag, no new
      // row, no NEW KEY (the CA-01 claim).
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        fsInstance: { fs: 'team-ctl', rootDir: planeRootDir(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
        centerAssembly: 'shadow',
        centerShadowLedger: SHADOW_LEDGER,
        confinedProvider: {
          trustRoot: `sha256:${launcherSha().slice(0, 16)}#${LAUNCHER}`,
          assembly: { launcherPath: LAUNCHER, launcherSha256: launcherSha(), minAbiVersion: 3 },
        },
      },
    }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7pwsh assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: strict', '    persona: "You are a worker of the u7pwsh assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `strict`: default deny, names NOTHING — the
   * refusal leg exercises the typed default-deny word BEFORE any effect.
   * `asker`: default ASK with no pwsh rule (the u6-proc measured
   * ask-approve fixture shape): its shell-class call resolves to a real
   * PENDING Control row the runner settles through the public seam.
   * The leader carries NO exec rule and NO exec token (the dual gate is
   * closed by BOTH halves: the leader never executes a shell class here).
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7pwsh assembly team. ${markers.MK_L1} drives your chain: create one strict member and one asker member, run the delegated scripts as instructed, then close.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - resolve-control', '  deny: []',
      'members:',
      '  - templateId: strict', '    displayName: "u7pwsh default-deny worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7pwsh assembly team (default-deny lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: deny', '        allow: []', '        ask: []', '        deny: []',
      '  - templateId: asker', '    displayName: "u7pwsh ask-approve worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7pwsh assembly team (ask-approve lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: asker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  /** The rows the factory composes into the patch layer (besides canary+probe). */
  function teamRows() {
    const basePlugins = [...smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    }), { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } }]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u7pwsh base',
        description: `u7pwsh base preset (${runStamp}) = smoke + tool-fs-search`,
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
    return { markersPlantedAt: new Date().toISOString() }
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }

  /** The runner's independent disk oracle: an ABSENT marker is the proof. */
  function readOracleFacts() {
    const bytesOf = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }
    return { denyBytes: bytesOf(files.deny), apprBytes: bytesOf(files.appr) }
  }

  return {
    rs,
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    LAUNCHER, launcherSha,
    blueprintDir, workspaceDir, files, claims, markers, tokens, cmds,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readOracleFacts,
  }
}

/**
 * The scripted provider for one `u7pwsh` World. Member scripts:
 *   strict (token d1): ONE pwsh call (deny leg) → PW fence.
 *   asker  (token d2): ONE pwsh call (ask→Control→approve leg) → PW fence.
 * Leader phase machine: create strict, create asker, delegate both,
 * collect on the settle notices, close on both fences.
 */
export function makePwshDecide({ assembly }) {
  const { tokens, markers } = assembly
  const cmds = assembly.cmds()
  const steps = { strict: 0, asker: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'strict', tok: 'c1', label: 'u7pwsh-strict' },
    { kind: 'create', template: 'asker', tok: 'c2', label: 'u7pwsh-asker' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_DENY, which: 'strict', fence: 'U7PWSH_DENY_DONE' },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_APPR, which: 'asker', fence: 'U7PWSH_APPR_DONE' },
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
    if (lu.includes('U7PWSH_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'strict'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'asker'
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
    if (lane === 'title') return { kind: 'text', content: 'u7pwsh assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7PWSH_NOOP_DONE' }
    if (lane === 'strict') {
      const step = steps.strict
      steps.strict += 1
      if (step === 0) return toolCall('pwsh', { command: cmds.deny, description: 'deny-leg marker write' })
      return { kind: 'text', content: 'U7PWSH_DENY_DONE' }
    }
    if (lane === 'asker') {
      const step = steps.asker
      steps.asker += 1
      if (step === 0) return toolCall('pwsh', { command: cmds.appr, description: 'ask-approve leg marker write' })
      return { kind: 'text', content: 'U7PWSH_APPR_DONE' }
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
    if (seen.length >= 2 && ids.asker === undefined) ids.asker = seen[1]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which]
        if (inst === undefined) return { kind: 'text', content: `U7PWSH_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `u7pwsh-${ph.tok}`, prompt: ph.prompt, async: true })
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
      return { kind: 'text', content: `U7PWSH_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U7PWSH_L1_DONE' }
  }
}

/**
 * Pure verdicts over COLLECTED facts (no I/O). Zero-effect legs are proven
 * by ABSENT marker bytes + the row's own typed words in the host log / the
 * tool_result witness — never by prose.
 */
export function judgeU7Pwsh({ oracle, log, journal = [], laneDone, apprArm, replayArm, hostAlive, healthOk, stateOk, surface, consumptionCount }) {
  const out = []
  const logLines = (pat) => log.filter((l) => l.includes(pat))
  const placement = logLines('placement-feed rows=')
  const mountOk = healthOk && stateOk && placement.length > 0
    && surface.includes('pwsh') && surface.includes('team_bash') && hostAlive
  out.push(['pwsh:mounted', mountOk ? 'PASS' : 'FAIL', {
    healthOk, stateOk,
    placementFeed: placement.length > 0 ? placement[placement.length - 1].slice(0, 240) : null,
    surfaceHas: ['pwsh', 'team_bash', 'bash'].map((n) => `${n}=${surface.includes(n)}`).join(','),
    hostAlive,
  }])

  // ── deny leg: typed refusal, ZERO effect (marker ABSENT, no RAN line) ───
  const journalText = (e) => JSON.stringify(e?.resultHead ?? '')
  const pwRefusals = logLines('confined-pwsh').filter((l) => !l.includes('capability OK'))
  const ranLines = logLines('confined-pwsh ran')
  const planeDenyLines = [...logLines('template-default-deny'), ...logLines('template-deny-lane')]
  const templateDenials = journal.filter((e) => e?.lastCall === 'pwsh' && /refused|denied|permission/i.test(journalText(e)) && journalText(e).includes('deny-leg'))
  const denyArm = planeDenyLines.length > 0 ? 'plane-row-typed-refusal'
    : templateDenials.length > 0 ? 'template-or-row-denial-in-tool-result' : 'silent'
  out.push(['pwsh:deny-zero-effect', denyArm !== 'silent' && oracle.denyBytes === null && !ranLines.some((l) => l.includes('deny')) && laneDone.strict === true && hostAlive ? 'PASS' : 'FAIL', {
    arm: denyArm,
    denyMarkerAbsent: oracle.denyBytes === null,
    planeRefusalLines: planeDenyLines.length,
    refusalSample: (planeDenyLines[0] ?? pwRefusals[0])?.slice(0, 220) ?? (templateDenials[0] ? journalText(templateDenials[0]).slice(0, 220) : null),
    laneStrictDone: laneDone.strict === true, hostAlive,
  }])

  // ── approve leg: REAL Control row → seam approval → consumed ONCE →
  //    governed body runs → the HONEST ENV arm (pwsh absent) refuses typed
  //    before probe and before spawn; zero marker bytes. ─────────────────────
  const notFound = logLines('confined-pwsh executable NOT-FOUND')
  const rowSentences = journal.filter((e) => e?.lastCall === 'pwsh' && /pwsh-executable-not-found/.test(journalText(e)))
  const envArm = notFound.length > 0 || rowSentences.length > 0
  out.push(['pwsh:approve-honest-env', apprArm.pendingSeen === true && apprArm.resolvedOk === true
    && consumptionCount === 1 && envArm && oracle.apprBytes === null
    && ranLines.length === 0 && laneDone.asker === true && hostAlive ? 'PASS' : 'FAIL', {
    arm: envArm ? (notFound.length > 0 ? 'typed-refusal-host-log' : 'typed-refusal-row-sentence') : 'silent',
    pendingRowSeen: apprArm.pendingSeen === true,
    attribution: apprArm.attribution ?? null,
    resolveOk: apprArm.resolvedOk === true,
    consumptionRows: consumptionCount,
    notFoundWitness: notFound[0]?.slice(0, 240) ?? (rowSentences[0] ? journalText(rowSentences[0]).slice(0, 240) : null),
    apprMarkerAbsent: oracle.apprBytes === null,
    ranLines: ranLines.length,
    laneAskerDone: laneDone.asker === true, hostAlive,
    disclosure: 'the POSITIVE spawn arm is NOT deliverable on this Linux host (no pwsh executable exists on any lawful path — measured, verbatim above); the governed positive mechanics (ask door, Control row, seam approval, kernel one-shot consume, body execution to its lawful refusal) ARE live here, and the faithful-form positive is pinned offline at C1 over the REAL provider pipeline with the launcher faked. The ENV arm is DISCLOSED, never recoloured.',
  }])

  // ── seam replay: the settled requestId refused a second time ─────────────
  out.push(['pwsh:seam-replay-refused', replayArm.attempted === true && replayArm.refused === true && oracle.apprBytes === null && hostAlive ? 'PASS' : 'FAIL', {
    requestIdNamed: String(replayArm.requestId ?? '').slice(0, 60),
    refused: replayArm.refused === true,
    body: String(replayArm.body ?? '').slice(0, 220),
    hostAlive,
  }])
  return out
}
