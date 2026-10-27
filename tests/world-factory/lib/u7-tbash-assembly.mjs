/**
 * u7-tbash-assembly.mjs — the World, scripted brain, lane-scoped resolver
 * policy and shared judge for the U7 `team_bash` L4 round (the positive-
 * effect leg U6 PR3 / #375 deferred; diagnosis in
 * dev/agent-workflow/evidence/u7-tbash-l4-20261027/README.md §1).
 *
 * Built ONLY on public seams (profile-patch rows, /team-remote, the mock
 * provider), the u6-proc / u7-inspect-c2 discipline. Nothing here boots or
 * tears down anything; the runner owns the lifecycle.
 *
 * What is DIFFERENT from the u6-proc world (each line answers one measured
 * cause of the r2..r5 FAILs):
 *  - teamEnvelope.allow names `request-control` (cause 1: the bridge could
 *    not open the durable row — envelope.ts team-root ceiling);
 *  - the leader owns NO shell lane (no allow rule, no `bash` exec token, no
 *    team_resolve_control) so arming request-control at the team root
 *    widens nothing that can spawn (cause 5);
 *  - results are joined to their call by tool_use_id, never by position
 *    (`callResultsOf`, cause 3);
 *  - a repeated call is expected to open a NEW row that needs a NEW
 *    decision; the resolver never gives it one (cause 4);
 *  - the lane-scoped grant: `decideResolution` allows exactly ONE row, the
 *    one whose outstanding call carries the pinned command hash, once.
 *
 * @module tests/world-factory/lib/u7-tbash-assembly
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic, extractInstanceId } from './u6-fs-assembly.mjs'

export const TBASH_CASES = Object.freeze([
  'tbash:mounted',
  'tbash:approve-spawn-once',
  'tbash:replay-refused',
  'tbash:other-command-refused',
  'tbash:deny-zero-effect',
  'tbash:leak-check',
])

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')
export const sha256Hex = (text) => createHash('sha256').update(String(text), 'utf8').digest('hex')
/** The kernel's command identity form (canonical-operation.ts commandHash). */
export const commandHashOf = (command) => `sha256:${sha256Hex(command)}`

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string}} opts
 */
export function createTbashAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const BASE_PRESET_ID = `u7tb-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7tb.anchor'
  const BP_MAIN_ID = 'team.u7tb.main'
  const ROOT = `session-u7tb-root-${rs}`
  const CREATE_ROOT = `session-u7tb-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  // THE team root: the plane's fsInstance root = the confined cwd anchor.
  const workspaceDir = join(home, 'workspace')
  // OUTSIDE the team root: its claim must never surface anywhere.
  const SECRET_FILE = join(home, 'outside-secret.txt')
  const PLANE_REALM_ID = `u7tb-realm-${rs}`

  const files = {
    appr: join(workspaceDir, 'u7tb-appr.txt'),
    other: join(workspaceDir, 'u7tb-other.txt'),
    deny: join(workspaceDir, 'u7tb-deny.txt'),
  }
  const claims = {
    appr: `U7TB_APPR_${rs}`,
    other: `U7TB_OTHER_${rs}`,
    deny: `U7TB_DENY_${rs}`,
    secret: `U7TB_SECRET_${rs}`,
  }
  const ranEcho = { appr: 'U7TB_APPR_RAN', other: 'U7TB_OTHER_RAN', deny: 'U7TB_DENY_RAN' }
  const markers = { MK_DISC: `U7TB_DISC_${rs}`, MK_L1: `U7TB_L1_${rs}`, MK_SCRIPT: `U7TB_SCRIPT_${rs}` }
  const tokens = (n) => `u7tb-${n}-${rs}`
  const DONE = { asker: `U7TB_ASKER_DONE_${rs}`, leader: `U7TB_L1_DONE_${rs}` }

  const wsReal = () => {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }
  // Harmless, deterministic, append-mode: ONE printf into the team root,
  // then a fixed echo the tool result carries. Paths use the realpath the
  // confined provider validates containment against.
  const cmds = () => {
    const root = wsReal()
    const at = (k) => files[k].replace(workspaceDir, root)
    return {
      appr: `printf '${claims.appr}\\n' >> '${at('appr')}' && echo ${ranEcho.appr}`,
      other: `printf '${claims.other}\\n' >> '${at('other')}' && echo ${ranEcho.other}`,
      deny: `printf '${claims.deny}\\n' >> '${at('deny')}' && echo ${ranEcho.deny}`,
    }
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
      staticModel: { provider: 'deepseek-official', model: 'u7tb-model' },
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
      // The canonical plane WITH the live confined shell backend (the
      // u6-proc mount, unchanged): pair-verified launcher pin.
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        fsInstance: { fs: 'team-ctl', rootDir: wsReal(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
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
    `  persona: "You are the leader of the u7tb assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the u7tb assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. Leader: orchestration tools only, permissions
   * default deny with NO rule, teamEnvelope WITHOUT the `bash` exec token —
   * the leader has no shell lane to arm. Member `asker`: default ASK, no
   * shell rule (the a5-m1-bash-c1 / BL01 world law: every team_bash call
   * rides the PA ask), envelope = send-message, report-progress,
   * request-control (narrowing the team root, which names request-control —
   * the measured r2..r4 cause).
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7tb assembly team. ${markers.MK_L1} drives your chain: create one ask-lane member, delegate its script, collect, and close.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress',
      '    - request-control', '  deny: []',
      'members:',
      '  - templateId: asker', '    displayName: "u7tb ask-lane worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7tb assembly team (ask lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: asker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  let blueprintFacade = null
  function parseWithHostValidator(text) {
    if (blueprintFacade === null) {
      const req = createRequire(join(repoRoot, 'noop.cjs'))
      blueprintFacade = req(join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
    }
    const bp = blueprintFacade.parseBlueprint(text)
    return bp.blueprint ?? bp
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
        id: BASE_PRESET_ID, displayName: 'u7tb base',
        description: `u7tb base preset (${runStamp}) = smoke`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(workspaceDir, { recursive: true })
    writeFileSync(SECRET_FILE, `OUTSIDE THE TEAM ROOT ${claims.secret}\n`)
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return { secretBefore: readFileSync(SECRET_FILE, 'utf8') }
  }
  function writeMainBlueprint(denyList) {
    const text = mainBlueprintYaml(denyList)
    const doc = parseWithHostValidator(text)
    if (doc.blueprintId !== BP_MAIN_ID) throw new Error(`U7TB_INGEST: main.yaml resolves as ${String(doc.blueprintId)}`)
    writeFileSync(join(blueprintDir, 'main.yaml'), text)
  }
  function readEffect(which) {
    try { return existsSync(files[which]) ? readFileSync(files[which], 'utf8') : null } catch { return null }
  }

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    LAUNCHER, launcherSha, blueprintDir, workspaceDir, SECRET_FILE,
    files, claims, ranEcho, markers, tokens, DONE, cmds,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, parseWithHostValidator,
    teamRows, writePreBootFiles, writeMainBlueprint, readEffect,
  }
}

/**
 * The asker's fixed script, in order. Step k is issued only after step
 * k-1's tool_result is back (the member is strictly sequential).
 */
export function askerScript(assembly) {
  const c = assembly.cmds()
  return [
    { step: 0, tag: 'appr', command: c.appr },
    { step: 1, tag: 'replay', command: c.appr },
    { step: 2, tag: 'other', command: c.other },
    { step: 3, tag: 'deny', command: c.deny },
  ]
}

/**
 * The scripted brain. Lanes: title / disc / asker / leader.
 * The asker's step is DERIVED from its own transcript (count of its
 * tool_use blocks), never from a mutable counter a retried request could
 * skew. The leader fence is read from NON-assistant messages only (the
 * u7-inspect-c2 F1 fix), and the hold text never embeds the fence.
 */
export function makeTbashDecide({ assembly }) {
  const { tokens, markers, DONE } = assembly
  const script = askerScript(assembly)
  const issued = []
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'asker', tok: 'c1', label: 'u7tb-asker' },
    { kind: 'delegate', tok: 'd1', prompt: `${markers.MK_SCRIPT}: run your four team_bash commands one at a time, then report done.`, fence: DONE.asker },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const userTextOf = (req) => messagesOf(req)
    .filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
  const assistantToolUses = (req) => messagesOf(req)
    .filter((m) => m?.role === 'assistant' && Array.isArray(m?.content))
    .flatMap((m) => m.content.filter((b) => b?.type === 'tool_use'))
  const settledPending = (req) => messagesOf(req)
    .filter((m) => m?.role !== 'assistant')
    .map((m) => textOf(m))
    .flatMap((t) => [...t.matchAll(/\[team-work-settled requestToken=([^\]\s"\\]+)/g)].map((x) => x[1]))
    .filter((tk) => !collected.has(tk))
  const fenceReached = (req, fence) => messagesOf(req)
    .filter((m) => m?.role !== 'assistant')
    .map(textOf).join('\n').includes(fence)

  function laneOf(req) {
    const t = messagesOf(req).map(textOf).join('\n')
    if (t.includes('Generate the session title')) return 'title'
    const lu = lastUserTextOfStatic(req)
    if (lu.includes(markers.MK_DISC)) return 'disc'
    if (userTextOf(req).includes(`[team-work requestToken=${tokens('d1')}`)) return 'asker'
    if (lu.includes('U7TB_PHASE_') || lu.includes(markers.MK_L1) || t.includes('[team-root-work') || t.includes('[team-work-settled') || t.includes('[team-control')) return 'leader'
    if (lu.includes('"type":"tool_result"')) {
      const uses = assistantToolUses(req)
      const last = uses[uses.length - 1]
      if (last !== undefined && String(last.name).startsWith('team_') && last.name !== 'team_bash') return 'leader'
    }
    return 'other'
  }

  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u7tb assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7TB_NOOP' }
    if (lane === 'asker') {
      const step = assistantToolUses(req).filter((u) => u.name === 'team_bash').length
      const next = script[step]
      if (next === undefined) return { kind: 'text', content: DONE.asker }
      if (!issued.some((x) => x.step === next.step)) issued.push({ step: next.step, tag: next.tag, command: next.command, at: Date.now() })
      return toolCall('team_bash', { command: next.command })
    }
    // ── leader ──
    if (ids.asker === undefined) {
      for (const b of messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))) {
        if (b?.type !== 'tool_result') continue
        const id = extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''))
        if (id !== null) { ids.asker = id; break }
      }
    }
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        if (ids.asker === undefined) return { kind: 'text', content: `U7TB_ID_WAIT_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: ids.asker, label: `u7tb-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `u7tb-coll-${String(collected.size)}-${assembly.rs}`, requestTokens: pending })
      }
      if (fenceReached(req, ph.fence)) { phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 6) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${ph.tok}-${String(Date.now())}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      return { kind: 'text', content: `U7TB_FENCE_HOLD_${ph.tok}` }
    }
    return { kind: 'text', content: DONE.leader }
  }
  decide.__state = () => ({ phase, ids: { ...ids }, issued: issued.map((x) => ({ ...x })) })
  return decide
}

/**
 * The PA row's tool spelling for the governed shell lane. MEASURED at boot 1
 * (`c2/c2-verdicts-boot1.json`, ledger `control-request-recorded.toolName`):
 * the durable row for a model-facing `team_bash` call carries the NATIVE
 * spelling `bash`, the name the row is governed under; the managed alias is
 * only the model-facing spelling. Both name one authority (A2C-1: the
 * COMMAND is the authority key), so the command hash below stays the only
 * thing that can widen or narrow the grant.
 */
export const SHELL_ROW_TOOL_NAMES = Object.freeze(['team_bash', 'bash'])

/**
 * THE lane-scoped grant (pure). Called by the runner for each NEW pending
 * shell row on the governed session.
 *
 * @param {object} input
 * @param {{requestId: string, toolName: string|null}} input.row
 * @param {{step: number, command: string}|null} input.outstanding - the
 *   asker call that is blocked on this row (the latest issued step that has
 *   not been tied to an earlier row).
 * @param {string} input.pinnedCommandHash - commandHashOf(command A), pinned before boot.
 * @param {number} input.allowsGiven - allows already issued in this run.
 * @returns {{decision: 'allow'|'deny', reason: string}}
 */
export function decideResolution({ row, outstanding, pinnedCommandHash, allowsGiven }) {
  if (row === null || row === undefined || !SHELL_ROW_TOOL_NAMES.includes(String(row.toolName))) {
    return { decision: 'deny', reason: 'not a shell row — outside this lane' }
  }
  if (outstanding === null || outstanding === undefined || typeof outstanding.command !== 'string') {
    return { decision: 'deny', reason: 'no attributable outstanding call — never allow an unattributed row' }
  }
  if (commandHashOf(outstanding.command) !== pinnedCommandHash) {
    return { decision: 'deny', reason: 'command hash differs from the one pinned grant' }
  }
  if (allowsGiven !== 0) {
    return { decision: 'deny', reason: 'the one approval is already spent — a repeat needs a new grant this lane never gives' }
  }
  if (outstanding.step !== 0) {
    return { decision: 'deny', reason: 'only the first issue of the pinned command is granted' }
  }
  return { decision: 'allow', reason: 'the pinned command, first issue, no prior allow' }
}

/**
 * Every tool_result joined to the tool_use that produced it, by id, over
 * every captured request (the inspect-c2 structural read-back). Returns
 * [{id, name, command, isError, text}] in first-seen order.
 */
export function callResultsOf(requests) {
  const uses = new Map()
  const out = new Map()
  for (const rec of requests ?? []) {
    for (const m of messagesOf(rec)) {
      for (const b of Array.isArray(m?.content) ? m.content : []) {
        if (b?.type === 'tool_use') uses.set(b.id, { name: String(b.name ?? ''), input: b.input ?? {} })
        if (b?.type === 'tool_result' && uses.has(b.tool_use_id) && !out.has(b.tool_use_id)) {
          const u = uses.get(b.tool_use_id)
          const text = typeof b.content === 'string' ? b.content : (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')
          out.set(b.tool_use_id, { id: b.tool_use_id, name: u.name, command: typeof u.input?.command === 'string' ? u.input.command : null, isError: b.is_error === true, text })
        }
      }
    }
  }
  return [...out.values()]
}

const REFUSAL = /refused|denied|APPROVAL_|CONTROL_|not usable|consumed/i
const lines = (raw) => (raw === null || raw === undefined ? 0 : String(raw).split('\n').filter((l) => l.trim() !== '').length)

/**
 * THE shared judge (live run + offline reconstruct; the digest is its whole
 * input). Returns [id, verdict, detail] for every case but tbash:mounted.
 *
 * Digest shape:
 *   pinned:      {commandHash, claims, ranEcho}
 *   calls:       [{step, tag, command, result: {isError, text}|null}]  (script order)
 *   resolutions: [{requestId, step, decision, ok, reason}]           (runner's human seam acts)
 *   ledger:      {requests:[{requestId,toolName,status}], decisions:[{requestId,decision}], consumptions:[{requestId}]}
 *   seamReAllow: {requestId, ok}       (re-allow of the spent row A at the seam)
 *   effects:     {appr, other, deny}   (raw disk text or null)
 *   leak:        {inCorpus, inHostLog, bytesUnchanged}
 */
export function judgeTbash(d, hostAlive) {
  const out = []
  const callOf = (step) => (d.calls ?? []).find((c) => c.step === step) ?? null
  const resOf = (step) => (d.resolutions ?? []).filter((r) => r.step === step)
  const decisionsFor = (rid) => (d.ledger?.decisions ?? []).filter((x) => x.requestId === rid).map((x) => x.decision)
  const consumptionsFor = (rid) => (d.ledger?.consumptions ?? []).filter((x) => x.requestId === rid).length
  const allows = (d.resolutions ?? []).filter((r) => r.decision === 'allow')
  const totalConsumptions = (d.ledger?.consumptions ?? []).length
  const ran = d.pinned?.ranEcho ?? {}
  const claims = d.pinned?.claims ?? {}
  const refused = (c) => c !== null && c.result !== null && c.result !== undefined
    && REFUSAL.test(String(c.result.text ?? '')) && !Object.values(ran).some((e) => String(c.result.text ?? '').includes(e))

  // ── approve-spawn-once ───────────────────────────────────────────────
  const a = callOf(0)
  const ra = resOf(0)
  const ridA = ra.length === 1 ? ra[0].requestId : null
  const apprText = d.effects?.appr ?? null
  const approveOk = a !== null && a.result !== null && a.result !== undefined
    && String(a.result.text ?? '').includes(ran.appr ?? '\u0000')
    && ra.length === 1 && ra[0].decision === 'allow' && ra[0].ok === true
    && allows.length === 1
    && ridA !== null && JSON.stringify(decisionsFor(ridA)) === JSON.stringify(['allow'])
    && consumptionsFor(ridA) === 1 && totalConsumptions === 1
    && lines(apprText) === 1 && String(apprText).trim() === claims.appr
    && hostAlive === true
  out.push(['tbash:approve-spawn-once', approveOk ? 'PASS' : 'FAIL', {
    requestId: ridA,
    resolutions: ra,
    decisions: ridA === null ? [] : decisionsFor(ridA),
    consumptions: ridA === null ? 0 : consumptionsFor(ridA),
    totalAllowsIssued: allows.length,
    totalConsumptions,
    effectOnDisk: apprText,
    effectLines: lines(apprText),
    toolResult: a?.result === null || a?.result === undefined ? null : String(a.result.text ?? '').slice(0, 200),
  }])

  // ── replay-refused ───────────────────────────────────────────────────
  const r = callOf(1)
  const rr = resOf(1)
  const replayRowNew = rr.length === 0 || rr.every((x) => x.requestId !== ridA)
  const replayNotAllowed = rr.every((x) => x.decision !== 'allow')
  const replayOk = a !== null && r !== null && r.command === a.command
    && refused(r) && replayRowNew && replayNotAllowed
    && rr.every((x) => consumptionsFor(x.requestId) === 0)
    && lines(apprText) === 1 && totalConsumptions === 1
    && d.seamReAllow !== null && d.seamReAllow !== undefined && d.seamReAllow.requestId === ridA && d.seamReAllow.ok === false
    && hostAlive === true
  out.push(['tbash:replay-refused', replayOk ? 'PASS' : 'FAIL', {
    sameCommandAsApproved: r !== null && a !== null && r.command === a.command,
    mode: rr.length === 0 ? 'synchronous-refusal' : 'new-row-denied',
    replayRows: rr.map((x) => ({ requestId: x.requestId, decision: x.decision, consumptions: consumptionsFor(x.requestId) })),
    distinctFromApprovedRow: replayRowNew,
    seamReAllowOfSpentRow: d.seamReAllow ?? null,
    effectLinesAfterReplay: lines(apprText),
    toolResult: r?.result === null || r?.result === undefined ? null : String(r.result.text ?? '').slice(0, 200),
  }])

  // ── other-command-refused ────────────────────────────────────────────
  const o = callOf(2)
  const ro = resOf(2)
  const otherOk = o !== null && a !== null && o.command !== a.command
    && commandHashOf(o.command) !== d.pinned?.commandHash
    && refused(o) && ro.every((x) => x.decision !== 'allow' && x.requestId !== ridA && consumptionsFor(x.requestId) === 0)
    && (d.effects?.other ?? null) === null && totalConsumptions === 1
    && hostAlive === true
  out.push(['tbash:other-command-refused', otherOk ? 'PASS' : 'FAIL', {
    commandHash: o === null ? null : commandHashOf(o.command),
    pinnedCommandHash: d.pinned?.commandHash ?? null,
    mode: ro.length === 0 ? 'synchronous-refusal' : 'new-row-denied',
    rows: ro.map((x) => ({ requestId: x.requestId, decision: x.decision, reason: x.reason, consumptions: consumptionsFor(x.requestId) })),
    effectOnDisk: d.effects?.other ?? null,
    toolResult: o?.result === null || o?.result === undefined ? null : String(o.result.text ?? '').slice(0, 200),
  }])

  // ── deny-zero-effect (a REAL human deny is required) ──────────────────
  const n = callOf(3)
  const rn = resOf(3)
  const ridD = rn.length === 1 ? rn[0].requestId : null
  const denyOk = n !== null && rn.length === 1 && rn[0].decision === 'deny' && rn[0].ok === true
    && ridD !== null && JSON.stringify(decisionsFor(ridD)) === JSON.stringify(['deny'])
    && consumptionsFor(ridD) === 0
    && refused(n) && (d.effects?.deny ?? null) === null
    && hostAlive === true
  out.push(['tbash:deny-zero-effect', denyOk ? 'PASS' : 'FAIL', {
    requestId: ridD,
    resolutions: rn,
    decisions: ridD === null ? [] : decisionsFor(ridD),
    consumptions: ridD === null ? 0 : consumptionsFor(ridD),
    effectOnDisk: d.effects?.deny ?? null,
    toolResult: n?.result === null || n?.result === undefined ? null : String(n.result.text ?? '').slice(0, 200),
  }])

  // ── leak-check ───────────────────────────────────────────────────────
  const lk = d.leak ?? {}
  out.push(['tbash:leak-check', lk.inCorpus === false && lk.inHostLog === false && lk.bytesUnchanged === true && allows.length <= 1 ? 'PASS' : 'FAIL', {
    ...lk,
    allowsIssued: allows.length,
  }])
  return out
}
