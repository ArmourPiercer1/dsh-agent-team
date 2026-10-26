/**
 * u6-arc-a-assembly.mjs — world materialization for the `u6-arc-a` suite
 * (U6 PR5 C2 / ARC-A at the Host): the PROBE family lane mounted on a real
 * Host through nothing but public seams (a profile-patch row + the lane's
 * own dist-resolved assembly), beside the PRODUCTION plane whose search
 * rows (the PR5 family move) must answer live governed `team_grep` /
 * `team_glob` calls with real confined-rg effects.
 *
 * Verdict law (PR2 review-r1 F5, kept whole): DISK + LEDGER + HOST LOG,
 * never the model transcript. The probe family's oracle is its marker dir;
 * the search lane's oracle is the runner-authored fixture + the ground
 * truth the runner computes from disk itself.
 *
 * The blueprints carry NO grep/glob permission rules — by law, not by
 * oversight: `PERMISSION_TOOL_NAMES` (domain/blueprint schema, a PROTECTED
 * center file) is the closed enum ['read','read_image','write','edit',
 * 'lsp','bash','pwsh'] and the search class is NOT in it. The governed
 * search rows are PLANE-adjudicated (the kernel approval entry the plane
 * binds at placement — PR5 law L2 is exactly WHY no center file may grow a
 * grep branch to make this suite easier). The refusal leg therefore rides
 * the anchored containment law: a search path OUTSIDE the managed root is
 * refused typed, before any spawn.
 *
 * @module tests/world-factory/lib/u6-arc-a-assembly
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
// The toolCall helper + message probes come from the fs-proven assembly —
// the mock's ONLY legal tool dialect is { kind: 'tool-call', toolCalls:
// [{id, name, arguments}] } (packages/tools/harness/mock-deepseek.mjs
// :132-134; an unknown kind ends the stream before message_stop — the
// measured STREAM_CLOSED failure of run u6arca4).
import { messagesOf, textOf, lastUserTextOfStatic, extractInstanceId, toolCall } from './u6-fs-assembly.mjs'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

export function createArcAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u6arca-base-${rs}`
  const BP_ANCHOR_ID = 'team.u6arca.anchor'
  const BP_MAIN_ID = 'team.u6arca.main'
  const ROOT = `session-u6arca-root-${rs}`
  const CREATE_ROOT = `session-u6arca-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u6arca-realm-${rs}`

  // Fixture facts: each file carries a UNIQUE claim; ground truth for the
  // grep/glob cases is computed by the RUNNER from these same facts. The
  // .git decoy proves the VCS-exclusion half of the native contract.
  const files = {
    g1: { path: join(workspaceDir, 'notes', 'u6arca-g1.txt'), claim: `U6ARCA_G1_CLAIM_${rs}` },
    g2: { path: join(workspaceDir, 'notes', 'u6arca-g2.txt'), claim: `U6ARCA_G2_CLAIM_${rs}` },
    g3: { path: join(workspaceDir, 'notes', 'u6arca-uni-\u00fcnicode-\u65e5\u672c.txt'), claim: `U6ARCA_G3_CLAIM_${rs}` },
    g4: { path: join(workspaceDir, 'deep', 'nested', 'dir', 'u6arca-g4.txt'), claim: `U6ARCA_G4_CLAIM_${rs}` },
    git: { path: join(workspaceDir, '.git', 'notes', 'u6arca-git.txt'), claim: `U6ARCA_GIT_CLAIM_${rs}` },
  }
  const markers = {
    MK_DISC: `U6ARCA_DISC_${rs}`,
    MK_L1: `U6ARCA_L1_${rs}`,
    MK_GREP: `U6ARCA_GREP_${rs}`,
    MK_CTL: `U6ARCA_CTL_${rs}`,
    T_PROBE: `U6ARCA_TRIGGER_PROBE_${rs}`,
    T_UNBOUND: `U6ARCA_TRIGGER_UNBOUND_${rs}`,
    T_REPLAY: `U6ARCA_TRIGGER_REPLAY_${rs}`,
    T_TEARDOWN: `U6ARCA_TRIGGER_TEARDOWN_${rs}`,
    T_POSTTEARDOWN: `U6ARCA_TRIGGER_POSTTEARDOWN_${rs}`,
  }
  const tokens = (n) => `u6arca-${n}-${rs}`
  // The probe walk identities are FIXED words so the ledger and the marker
  // dir can be read back by exact name.
  const probe = {
    posCall: 'pos-1', posGrant: 'grant-pos', posNonce: `NONCE_POS_${rs}`,
    replayCall: 'replay-1', replayGrant: 'grant-pos', // SAME grant id = the replay
    afterCall: 'after-1', afterGrant: 'grant-after', afterNonce: `NONCE_AFTER_${rs}`,
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
      staticModel: { provider: 'deepseek-official', model: 'u6arca-model' },
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
        // ENFORCING (not shadow): ARC-A measures the kernel REAL — the
        // probe family runs its own enforcing kernel; the plane must be the
        // same generation of truth for the search lanes.
        centerAssembly: 'enforcing',
      },
    }
  }
  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u6arca assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: greper', '    persona: "You are a worker of the u6arca assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u6arca assembly team. ${markers.MK_L1} drives your chain: create one governed search member and one legacy control member, then run the delegated scripts exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
      'members:',
      '  - templateId: greper', '    displayName: "u6arca governed search worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6arca assembly team (governed search lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      // MEASURED LAW (run6, team-tool-plane.mjs:459): the plane's admission
      // gate classes the PLACED search rows (team_grep/team_glob by mount
      // spelling) into the FILE class for the default-deny check — while the
      // closed blueprint permission enum carries no search token, so a
      // member template grants search coverage ONLY through a `tool: read`
      // rule (disclosed finding). The rule is `kind: any` ON PURPOSE: this
      // suite's refusal leg must be adjudicated by the anchored containment
      // law (OUTSIDE_ROOT), not by admission; a narrower rule would test
      // admission instead.
      '      permissions:', '        default: deny', '        allow:',
      '          - tool: read', '            resource:', '              kind: any',
      '        ask: []', '        deny: [],',
      // The control lane: NO capabilities block at all — the legacy native
      // surface whose grep must behave exactly as before PR5 (§10.5-5).
      '  - templateId: ctl', '    displayName: "u6arca legacy control worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6arca assembly team (legacy control lane). Follow the delegated script exactly, one tool call at a time.')}`,
      'memberEnvelopes:',
      '  - templateId: greper', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: ctl', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

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
        id: BASE_PRESET_ID, displayName: 'u6arca base',
        description: `u6arca base preset (${runStamp}) = smoke + tool-fs-search`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    mkdirSync(join(workspaceDir, 'deep', 'nested', 'dir'), { recursive: true })
    mkdirSync(join(workspaceDir, '.git', 'notes'), { recursive: true })
    for (const key of Object.keys(files)) writeFileSync(files[key].path, `${files[key].claim}\n`)
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
    blueprintDir, workspaceDir, files, markers, tokens, probe,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint,
  }
}

/** The mock script. Lanes are identified by the delegation tokens the
 *  members carry in every turn (the PR2/PR3-proven airtight law); the
 *  probe legs ride boot-root triggers, one tool call per trigger. */
/** The LAST tool_result block's text (the close-turn carrier on a trigger
 *  lane): serialized whole, so the action echo is matched as written. */
function lastToolResultOf(req) {
  const blocks = messagesOf(req)
    .flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
    .filter((b) => b?.type === 'tool_result')
  const last = blocks[blocks.length - 1]
  return last === undefined ? '' : JSON.stringify(last)
}

export function makeArcDecide({ assembly }) {
  const { markers, tokens, probe } = assembly
  const ids = {}
  const steps = { greper: 0, ctl: 0 }
  const trigState = {}
  const PHASES = [
    { kind: 'create', template: 'greper', tok: 'c1', label: 'arca-greper' },
    { kind: 'create', template: 'ctl', tok: 'c2', label: 'arca-ctl' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_GREP, which: 'greper', fence: 'U6ARCA_GREP_DONE' },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_CTL, which: 'ctl', fence: 'U6ARCA_CTL_DONE' },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
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
    for (const key of ['T_PROBE', 'T_UNBOUND', 'T_REPLAY', 'T_TEARDOWN', 'T_POSTTEARDOWN']) {
      if (lu.includes(markers[key])) return `trigger-${key}`
    }
    if (lu.includes(markers.MK_DISC)) return 'disc'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'greper'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'ctl'
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool === 'u6arc_probe') return 'trigger-close'
      if (tool === 'team_grep' || tool === 'team_glob') return 'greper'
      if (tool === 'grep') return 'ctl'
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes('U6ARCA_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }

  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u6arca assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U6ARCA_NOOP_DONE' }
    if (lane === 'trigger-close') {
      // Distinct close texts per trigger leg: the runner's wake cadence
      // proves EACH leg landed by its own fence (one shared close text
      // would let one leg masquerade as another).
      const t = lastToolResultOf(req).replace(/\s+/g, '')
      if (t.includes('GRANT_REPLAY')) return { kind: 'text', content: 'U6ARCA_REPLAY_DONE' }
      if (t.includes('KERNEL_NOT_ACTIVE')) return { kind: 'text', content: 'U6ARCA_POSTTD_DONE' }
      if (t.includes('"action":"teardown"')) return { kind: 'text', content: 'U6ARCA_TD_DONE' }
      if (t.includes('"action":"unbound"')) return { kind: 'text', content: 'U6ARCA_UNBOUND_DONE' }
      if (t.includes('"action":"walk"')) return { kind: 'text', content: 'U6ARCA_WALK_DONE' }
      return { kind: 'text', content: 'U6ARCA_TRIGGER_DONE' }
    }
    if (lane === 'ctl') {
      // legacy native control lane: ONE native grep — the §10.5-5 law is
      // that PR5 changed nothing for it (its RESULT is judged from disk +
      // the transcript-carried tool_result by the runner's ground truth).
      // ABSOLUTE paths everywhere the fs-proven convention: the host's
      // native tools resolve relative spellings against the SESSION CWD
      // (the HTU tree), and the plane anchors are absolute-rooted
      // (fs: files.c1.path precedent, run u6arca5 forensics).
      if (steps.ctl === 0) { steps.ctl = 1; return toolCall('grep', { pattern: assembly.files.g2.claim, path: join(assembly.workspaceDir, 'notes') }) }
      return { kind: 'text', content: 'U6ARCA_CTL_DONE' }
    }
    if (lane.startsWith('trigger-')) {
      const key = lane.slice('trigger-'.length)
      const st = trigState[key] ?? 'fresh'
      trigState[key] = 'issued'
      if (st !== 'fresh') return { kind: 'text', content: 'U6ARCA_TRIGGER_DONE' }
      if (key === 'T_PROBE') return toolCall('u6arc_probe', { action: 'walk', callId: probe.posCall, grantId: probe.posGrant, nonce: probe.posNonce })
      if (key === 'T_UNBOUND') return toolCall('u6arc_probe', { action: 'unbound', callId: 'unbound-1' })
      if (key === 'T_REPLAY') return toolCall('u6arc_probe', { action: 'walk', callId: probe.replayCall, grantId: probe.replayGrant, nonce: 'NONCE_REPLAY' })
      if (key === 'T_TEARDOWN') return toolCall('u6arc_probe', { action: 'teardown' })
      if (key === 'T_POSTTEARDOWN') return toolCall('u6arc_probe', { action: 'walk', callId: probe.afterCall, grantId: probe.afterGrant, nonce: probe.afterNonce })
      return { kind: 'text', content: 'U6ARCA_TRIGGER_DONE' }
    }
    if (lane === 'greper') {
      if (steps.greper === 0) { steps.greper = 1; return toolCall('team_grep', { pattern: assembly.files.g1.claim, path: assembly.workspaceDir, 'output_mode': 'content' }) }
      if (steps.greper === 1) { steps.greper = 2; return toolCall('team_glob', { pattern: '**/*.txt', path: assembly.workspaceDir }) }
      if (steps.greper === 2) { steps.greper = 3; return toolCall('team_grep', { pattern: assembly.files.g4.claim, path: '/etc', 'output_mode': 'content' }) }
      return { kind: 'text', content: 'U6ARCA_GREP_DONE' }
    }
    // ── leader lane: the PHASES script, EXACTLY the proc-proven form
    // (create -> ids harvested from tool_results -> async delegate ->
    // settled notice -> team_collect -> fence in the collected text).
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')))
      .filter((x) => x !== null))]
    if (ids.greper === undefined && seen.length >= 1) ids.greper = seen[0]
    if (ids.ctl === undefined && seen.length >= 2) ids.ctl = seen[1]
    const settledPending = (r) => messagesOf(r)
      .map((m) => textOf(m))
      .filter((t2) => t2.includes('[team-work-settled requestToken='))
      .map((t2) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t2); return m2 === null ? null : m2[1] })
      .filter((tk) => tk !== null && !collected.has(tk))
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which]
        if (inst === undefined) return { kind: 'text', content: `U6ARCA_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `arca-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (messagesOf(req).map(textOf).join('\n').includes(ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 8) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      return { kind: 'text', content: `U6ARCA_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U6ARCA_L1_DONE' }
    return { kind: 'text', content: 'U6ARCA_NOOP_DONE' }
  }
  return decide
}

/** The judge: every verdict from disk/ledger/host-log facts the runner
 *  passes in — never from the transcript. */
export function judgeU6ArcA({ ledgerRows, markerFiles, grepResults, globResults, ctlResult, refusalResult, hostKernelHits, hostAlive }) {
  const walkRows = ledgerRows.filter((r) => r.leg === 'walk')
  const v = {}
  v['arca:mounted'] = ledgerRows.some((r) => r.leg === 'family-mount' && r.ok === true)
    && ledgerRows.some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)
  const posWalk = walkRows.find((r) => r.action === 'walk' && r.callId === 'pos-1')
  v['arca:probe-positive'] = posWalk?.ok === true && markerFiles.includes('pos-1-marker.txt')
  const unbound = walkRows.find((r) => r.action === 'unbound')
  v['arca:probe-unbound-refused-zero-effect'] = unbound !== undefined && unbound.outcome !== 'allow'
    && !markerFiles.some((m) => m.startsWith('unbound-1-'))
  const replay = walkRows.find((r) => r.action === 'walk' && r.callId === 'replay-1')
  v['arca:probe-replay-refused-zero-effect'] = replay?.ok === false && String(replay.code) === 'GRANT_REPLAY'
    && markerFiles.filter((m) => m.endsWith('-marker.txt')).length === 1
  const teardown = ledgerRows.find((r) => r.leg === 'teardown')
  const after = walkRows.find((r) => r.action === 'walk' && r.callId === 'after-1')
  v['arca:probe-unload-settles'] = teardown?.ok === true && after?.ok === false && String(after.code) === 'KERNEL_NOT_ACTIVE'
    && markerFiles.filter((m) => m.endsWith('-marker.txt')).length === 1
  v['arca:search-grep-live'] = grepResults.some((r) => r.ok === true && r.claimsFound.includes('g1'))
  v['arca:search-glob-live'] = globResults.some((r) => r.ok === true && r.enumHasG3 === true && r.gitDecoyExcluded === true)
  v['arca:search-refusal-zero-effect'] = refusalResult?.refused === true && refusalResult?.outsideRootCodeSeen === true
    && refusalResult?.censusUnchanged === true
  v['arca:native-grep-control'] = ctlResult?.ok === true && ctlResult?.claimFound === true
    && hostKernelHits['a5-plane: mount-REFUSED']?.count === 0 && hostAlive === true
  return v
}

/** Ground truth computed by the runner from disk (never from rg). */
export function groundTruth(assembly) {
  const claimOf = (key) => assembly.files[key].claim
  return {
    grepG1Files: ['notes/u6arca-g1.txt'],
    globTxtFiles: (list) => list,
    claimOf,
  }
}
