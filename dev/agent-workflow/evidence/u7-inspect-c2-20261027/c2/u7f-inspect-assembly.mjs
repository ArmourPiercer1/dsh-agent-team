/**
 * dev/agent-workflow/evidence/u7-inspect-c2-20261027/u7f-inspect-assembly.mjs
 * — world materialization for the inspect C2 completion round (forked from
 * the #404 `u7-f-inspect-20261026/c2/u7f-inspect-assembly.mjs`, which stays
 * byte-untouched; the World, row config and envelopes are IDENTICAL — only
 * the scripted brain changed, see the DRIVE FIXES block on the decide). Original
 * header: world materialization for the U7-F C2 round (NOT a shared lane asset: a
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
      '        - team_list_pending_control',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress',
      // Boot-4 (round 2) measured law, mirrored from u6-proc (u6prc6-8): a
      // member's PA ask reaches the durable Control row only when
      // `request-control` is in the member's EFFECTIVE envelope, and the
      // effective bounds are `teamEnvelope.allow` NARROWED by the template
      // entry (admission/envelope.ts:100-119 — template entries never
      // widen). So BOTH halves must name it; `resolve-control` rides the
      // team root for the leader (a leader without a memberEnvelopes entry
      // carries the full team allow list). Closed ALL_MUTATION_OPS
      // vocabulary; fixture data through the blueprint seam only.
      '    - request-control', '    - resolve-control', '  deny: []',
      'members:',
      '  - templateId: strict', '    displayName: "u7f governed inspect worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7f inspect assembly team (governed lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress',
      // The ASKER half: the governed inspect calls rise as durable PA asks,
      // so the asker must own `request-control` here too (intersection law;
      // see the teamEnvelope comment above for the measured boot-4 law).
      '        - request-control', '      deny: []',
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
 * strict. The strict member runs FOUR calls then closes:
 *   1. team_skill {name}                              → PA ask (allow)
 *   2. team_cordis_inspect_list {}                    → PA ask (allow)
 *   3. team_cordis_inspect_query <unknown provider>   → typed pre-PA refusal
 *   4. team_cordis_inspect_query <host Tool.listTools> → PA ask (allow)
 *
 * DRIVE FIXES over the #404 brain (each root-caused from the boot-5 capture,
 * `u7-f-inspect-20261026/c2/mock-corpus.json`, kept untouched):
 *   F1  SELF-SATISFYING FENCE. #404 held with text `U7F_FENCE_HOLD_<fence>`
 *       and then tested "does the leader transcript contain <fence>" — its
 *       own hold reply satisfied the fence, so the leader advanced to
 *       L1_DONE after its first 12 rounds and answered every later
 *       `[team-control]` notice (incl. the inspect-list ask ctrl-13zy…) with
 *       L1_DONE text. Now the hold text never embeds the fence and the fence
 *       is read from NON-assistant messages only.
 *   F2  The approval is the HUMAN public seam (runner → team.resolveControl
 *       v4, the u7-f-web proven pattern), not the leader model: the leader
 *       keeps ONLY team_list_pending_control (read-only) and its listings are
 *       the pending witness the runner gates every resolve on.
 */
export function makeU7fInspectDecide({ assembly }) {
  const { tokens, markers, DONE } = assembly
  const ids = {}
  const QUERY_UNKNOWN = { platform: 'host', provider: 'u7f-no-such-provider', method: 'nope' }
  const QUERY_POSITIVE = { platform: 'host', provider: 'Tool', method: 'listTools', input: {} }
  const PHASES = [
    { kind: 'create', template: 'strict', tok: 'c1', label: 'u7f-strict' },
    { kind: 'delegate', tok: 'd1', prompt: `${markers.MK_SCRIPT}: call team_skill with {"name":"u7f-demo-skill"}, then team_cordis_inspect_list with {}, then team_cordis_inspect_query with ${JSON.stringify(QUERY_UNKNOWN)}, then team_cordis_inspect_query with ${JSON.stringify(QUERY_POSITIVE)}; then report done.`, which: 'strict', fence: DONE.strict },
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
  // F1: the fence is satisfied only by what the HOST put in front of the
  // leader (settled notices, collect results), never by its own replies.
  const fenceReached = (req, fence) => messagesOf(req)
    .filter((m) => m?.role !== 'assistant')
    .map(textOf).join('\n').includes(fence)
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u7f inspect assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7F_NOOP_DONE' }
    if (lane === 'strict') {
      const step = steps.strict
      steps.strict += 1
      if (step === 0) return toolCall('team_skill', { name: 'u7f-demo-skill' })
      if (step === 1) return toolCall('team_cordis_inspect_list', {})
      if (step === 2) return toolCall('team_cordis_inspect_query', QUERY_UNKNOWN)
      if (step === 3) return toolCall('team_cordis_inspect_query', QUERY_POSITIVE)
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
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (fenceReached(req, ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 8) {
        // Each fence wait alternates one read-only pending listing (the
        // runner's pending witness) with one collect poll.
        if (fenceRounds % 2 === 1) return toolCall('team_list_pending_control', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`lp${String(phase)}-${String(Date.now())}`) })
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(Date.now())}`), requestTokens: [tokens(ph.tok)] })
      }
      fenceRounds = 0
      // F1: the hold text never embeds the fence string.
      return { kind: 'text', content: `U7F_FENCE_HOLD_${ph.tok}` }
    }
    return { kind: 'text', content: DONE.leader }
  }
}

/**
 * The pending witness over the REAL list-output shape (measured from the
 * boot-5 capture, entry 12): a `tool_result` block whose text lives at
 * `block.content[].text` (NOT `block.text` — the #404 regex read the latter
 * and matched 0 of 2 real count:1 listings) and parses to
 *   {"status":"pending-control-listed","rootSessionId":…,"pending":[{"requestId":"ctrl-…",…,"toolName":"team_skill",…}],"count":1,"truncated":false}
 * Returns every {requestId, toolName} a listing showed as pending.
 */
export function pendingListedOf(requests) {
  const out = new Map()
  for (const rec of requests ?? []) {
    for (const m of rec?.body?.messages ?? []) {
      for (const b of Array.isArray(m?.content) ? m.content : []) {
        if (b?.type !== 'tool_result') continue
        const text = (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')
        if (!text.includes('"pending-control-listed"')) continue
        let j = null
        try { j = JSON.parse(text) } catch { continue }
        if (j?.status !== 'pending-control-listed' || !(Number(j.count) > 0) || !Array.isArray(j.pending)) continue
        for (const p of j.pending) {
          if (typeof p?.requestId === 'string' && p.status === 'pending') out.set(p.requestId, { requestId: p.requestId, toolName: String(p.toolName ?? ''), count: Number(j.count) })
        }
      }
    }
  }
  return [...out.values()]
}
