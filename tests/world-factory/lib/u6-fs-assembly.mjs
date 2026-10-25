/**
 * u6-fs-assembly.mjs — world materialization for the `u6-fs` suite
 * (U6 PR2 C2): the production Team row + p6t6 observer + one agent preset +
 * blueprints + the mocked leader/member scripts, built ONLY on public seams
 * (the profile-patch layer, the /team-remote HTTP surface, the mock provider).
 *
 * The shapes here are copies/adaptations of the proven a5p1 kit
 * (`tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs` @ this host generation):
 * teamRowConfig keys, the anchor/main blueprint YAML, the
 * `[team-work requestToken=…]` lane discrimination, the leader chain's
 * create→delegate rhythm reading the NEWEST tool result, and the
 * collect-fence that keeps member lanes from interleaving into the plant
 * lanes. Deviations are commented where they carry meaning.
 *
 * Nothing in this module boots or tears down anything — the runner owns the
 * World lifecycle (record.logHostStart before spawn, rc.bindChild before
 * await, teardown in finally). This module only computes MATERIAL and the
 * decide script.
 *
 * @module tests/world-factory/lib/u6-fs-assembly
 */
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'

/** Names the closed world always lets a governed member keep (a5p1 lists). */
export const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
export const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
/** The probe's own tool must NEVER enter builtinToolDeny — it is a leg actor. */
export const PROBE_TOOL_NAME = 'u6fs_probe'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string}} opts
 *   home/reportDir come from a CREATED World (the patch layer is composed at
 *   startHost, so `world.u6Fs.rows` may be filled after createWorld).
 */
export function createFsAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u6fs-base-${rs}`
  const BP_ANCHOR_ID = 'team.u6fs.anchor'
  const BP_MAIN_ID = 'team.u6fs.main'
  const ROOT = `session-u6fs-root-${rs}`
  const CREATE_ROOT = `session-u6fs-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')

  // Workspace facts. Each file carries a UNIQUE claim string: a claim
  // appearing in a tool result can only come from a Body that read THAT file.
  const files = {
    s1: { path: join(workspaceDir, 'notes', 'u6fs-s1.txt'), claim: `U6FS_S1_CLAIM_${rs}` },
    c1: { path: join(workspaceDir, 'notes', 'u6fs-c1.txt'), claim: `U6FS_C1_CLAIM_${rs}` },
    s2: { path: join(workspaceDir, 'notes', 'u6fs-s2.txt'), claim: `U6FS_S2_CLAIM_${rs}` },
    s3: { path: join(workspaceDir, 'notes', 'u6fs-s3.txt'), claim: `U6FS_S3_CLAIM_${rs}` },
    s4: { path: join(workspaceDir, 'notes', 'u6fs-s4.txt'), claim: `U6FS_S4_CLAIM_${rs}` },
    s5: { path: join(workspaceDir, 'notes', 'u6fs-s5.txt'), claim: `U6FS_S5_CLAIM_${rs}` },
    denied: { path: join(workspaceDir, 'secret', 'u6fs-denied.txt'), claim: `U6FS_DENY_CLAIM_${rs}` },
  }
  const markers = {
    MK_DISC: `U6FS_DISC_${rs}`,
    MK_L1: `U6FS_L1_${rs}`,
    MK_STRICT: `U6FS_STRICT_${rs}`,
    MK_CTL: `U6FS_CTL_${rs}`,
    MK_SENS1: `U6FS_SENS1_${rs}`,
    MK_SWAPPED: `U6FS_SWAPPED_${rs}`,
    MK_SENS2: `U6FS_SENS2_${rs}`,
    MK_TOCTOU: `U6FS_TOCTOU_${rs}`,
    T_SWAP: `U6FS_TRIGGER_SWAP_${rs}`,
    T_RESTORE: `U6FS_TRIGGER_RESTORE_${rs}`,
    T_TOCTOU: `U6FS_TRIGGER_TOCTOU_${rs}`,
  }
  const tokens = (n) => `u6fs-${n}-${rs}`

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
      staticModel: { provider: 'deepseek-official', model: 'u6fs-model' },
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
      // The canonical plane mount (docs/INSTALL.md §3.5 a5-read-only-row;
      // live twin a5-read-slice-window.test.ts P1). WITHOUT this block the
      // agent-bindings gate (config?.teamToolPlane !== undefined) never
      // builds the plane — measured b3: every governed read answered
      // `the Tool Binding for "read" cannot be verified at dispatch time`
      // (pre-feed fail-closed path), while the plane-less world otherwise
      // booted green. realmId pairs the Guard feed and must equal the
      // fsInstance.realmId (mismatch = CFS_PROVIDER_REFUSED).
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        fsInstance: { fs: 'team-ctl', rootDir: planeRootDir(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
      },
    }
  }
  function planeRootDir() {
    // the managed root must be the CANONICAL spelling (provider validates
    // containment against the realpath); the workspace exists by the time
    // rows are assembled (writePreBootFiles runs first — runner order).
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

  const PLANE_REALM_ID = `u6fs-realm-${rs}`
  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u6fs assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: strict', '    persona: "You are a worker of the u6fs assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `strict` carries `permissions` with DEFAULT DENY and
   * exact-path allow rules; the denied file is deliberately NEVER NAMED (the
   * refusal leg exercises the kernel's default-deny typed refusal — an
   * explicit deny rule would drag the whole `read` class into the Ask lane,
   * measured). `ctl` carries NO capabilities block at all — the CI-03 legacy
   * lane. The probe tool is never a permission-rule target (`tool:` is a
   * closed managed enum), and must never be
   * in builtinToolDeny.
   */
  function mainBlueprintYaml(denyList) {
    // EVERY unmanaged name on the final model-facing surface — the probe tool
    // included — must appear in builtinToolDeny: the A2C-2 coverage gate
    // refuses member start otherwise (measured b2:
    // `permission coverage gate failed ... unmanaged tool(s) on the final
    // model-facing surface`). Deny is coverage here, not a call site: no
    // governed lane ever calls the probe (the permission `tool:` field is a
    // closed managed enum, and the triggers ride the boot-root session).
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    const allowRead = (ind, f) => [
      `${ind}- tool: read`,
      `${ind}  resource:`,
      `${ind}    kind: exact`,
      `${ind}    path: ${JSON.stringify(f.path)}`,
    ]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u6fs assembly team. ${markers.MK_L1} drives your chain: create one governed member and one legacy member, then run the delegated scripts exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
      'members:',
      '  - templateId: strict', '    displayName: "u6fs governed worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6fs assembly team (governed lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: deny',
      '        allow:',
      ...allowRead('          ', files.s1), ...allowRead('          ', files.s2),
      ...allowRead('          ', files.s3), ...allowRead('          ', files.s4),
      ...allowRead('          ', files.s5),
      '        ask: []',
      // NO explicit read-deny rule — MEASURED LAW (offline repro on the
      // current dist, u6fs-admission-repro.mjs): a named deny rule on `read`
      // also poisons the tool-INVOKE arm of the class, and the expansion
      // plane then routes EVERY read (even exact-allowed ones) into the Ask
      // lane (requires-approval @ human-admin rung). With default deny only:
      // exact-allowed reads ADMIT directly (grant minted, no approval leg,
      // no ControlService needed), and the never-named denied file lands a
      // CLEAN typed refusal (`IO_POLICY_UNSUPPORTED / template-default-deny:
      // an effect the policy never names is not an effect the policy allows`)
      // BEFORE any byte is read — the refusal leg is proven by the kernel's
      // own word, zero effect.
      '        deny: []',
      // The control lane: NO `capabilities` block at all (the CI-03 population
      // whose native `read` must be byte-for-byte untouched by PR2).
      '  - templateId: ctl', '    displayName: "u6fs legacy control worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6fs assembly team (legacy control lane). Follow the delegated script exactly, one tool call at a time.')}`,
      'memberEnvelopes:',
      '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: ctl', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
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
        id: BASE_PRESET_ID, displayName: 'u6fs base',
        description: `u6fs base preset (${runStamp}) = smoke + tool-fs-search`,
        plugins: basePlugins,
      }),
    ]
  }

  /** Files that must exist BEFORE the spawn (blueprint anchor, workspace
   *  facts, p6t6 directive). The main blueprint comes later (post-discovery). */
  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    mkdirSync(join(workspaceDir, 'secret'), { recursive: true })
    for (const key of ['s1', 'c1', 's2', 's3', 's4', 's5']) writeFileSync(files[key].path, `${files[key].claim}\n`)
    writeFileSync(files.denied.path, `${files.denied.claim}\n`)
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    // The p6t6 observer refuses to boot without its directive (measured,
    // a5p1-kit header): {boot, phase, reportDir, runStamp, rootSessionId}.
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }

  return {
    rs,
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID,
    blueprintDir, workspaceDir, files, markers, tokens,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint,
  }
}

// ── mock-shape helpers (a5p1-proven) ────────────────────────────────────────
export const toolCall = (name, argsObj) => ({
  kind: 'tool-call',
  toolCalls: [{ id: `call-u6fs-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argsObj }],
})
export function bodyOf(rec) { return rec === null || typeof rec !== 'object' ? null : ('body' in rec ? (rec.body ?? null) : rec) }
export function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
export function textOf(m) { return typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? '') }
export function lastUserTextOfStatic(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m?.role === 'user') return typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
  }
  return ''
}
export function hasMarker(req, marker) { return messagesOf(req).some((m) => textOf(m).includes(marker)) }
export function surfaceNamesOf(req) { return (bodyOf(req)?.tools ?? []).map((t) => String(t?.name ?? t?.function?.name ?? '')).filter((n) => n !== '') }
export function toolMsgsOf(req) {
  const out = []
  for (const m of messagesOf(req)) {
    for (const b of Array.isArray(m?.content) ? m.content : []) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), isError: b.is_error === true })
    }
  }
  return out
}
export function lastToolResultText(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const blocks = Array.isArray(messages[i]?.content) ? messages[i].content : []
    const results = blocks.filter((b) => b?.type === 'tool_result')
    if (results.length > 0) return results.map((b) => (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')).join('\n')
  }
  return ''
}
export function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : (m[1] ?? m[0])
}

/**
 * The scripted provider for one `u6fs` World.
 * Lanes are keyed on the delegation REQUEST TOKENS the glue prefixes onto the
 * member notice (`[team-work requestToken=u6fs-d1-<rs>]`) — the a5p1-measured
 * fact that survives Host transcript handling. The leader chain is the a5p1
 * rhythm (create, create, delegate newest, delegate newest) plus a
 * team_collect FENCE: the plant lanes must not interleave with the positive /
 * refusal / CI-03 lanes, so the leader only re-drives the governed member
 * after collect answers settle (bounded loop, then proceeds regardless — the
 * fence is best-effort ordering, and every lane's script is token-keyed so a
 * mis-ordering can never cross-wire two lanes' step counters).
 */
/**
 * The scripted provider for one `u6fs` World. The LEADER chain owns the whole
 * ordering: it creates the two members, then delegates each leg one at a time,
 * FENCING every delegation on a team_collect loop until the member's DONE
 * marker is visible among the leader's tool results — serialization without
 * any remote-delegate seam (the /team-remote surface has none: team.create /
 * admitInitialWork / listRoots / ensureRootLive / prepareOrdinaryOpen /
 * resolveControl / getProjection / getReadState / getLedgerPage — measured on
 * the pinned dist). Between the sensitivity lane and the plant lanes the
 * chain additionally GATES on the probe LEDGER (readProbeLedger is a pure
 * test-process read of the World's probe ledger — no product surface): the
 * swap may only be live before the under-swap read is delegated, the restore
 * before the post-restore read, the toctou arm before the in-window read.
 * A fence that never sees its marker advances after 8 collect rounds — the
 * affected legs then FAIL honestly on their own evidence, never hang.
 * Lanes stay token-keyed: the mocked member replies are one-shot per token.
 * The plant TRIGGERS ride the boot-root session (row-scope probe tool; the
 * blueprint permission `tool:` field is a CLOSED managed enum — measured b1 —
 * so a governed member never calls the probe).
 */
export function makeFsDecide({ assembly, readProbeLedger = () => [] }) {
  const { tokens, markers, files } = assembly
  const steps = { strict: 0, ctl: 0, sens1: 0, swapped: 0, sens2: 0, toctou: 0 }
  const trigState = {}
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'strict', tok: 'c1', label: 'fs-strict' },
    { kind: 'create', template: 'ctl', tok: 'c2', label: 'fs-ctl' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_STRICT, which: 'strict', fence: 'U6FS_STRICT_DONE' },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_CTL, which: 'ctl', fence: 'U6FS_CTL_DONE' },
    { kind: 'delegate', tok: 'd3', prompt: markers.MK_SENS1, which: 'strict', fence: 'U6FS_SENS1_DONE' },
    { kind: 'gate', probe: (rows) => rows.some((r) => r.leg === 'spoof-attempt' && r.trigger === 'probe-body') },
    { kind: 'delegate', tok: 'd4', prompt: markers.MK_SWAPPED, which: 'strict', fence: 'U6FS_SWAPPED_DONE' },
    { kind: 'gate', probe: (rows) => rows.some((r) => r.leg === 'spoof-restore') },
    { kind: 'delegate', tok: 'd5', prompt: markers.MK_SENS2, which: 'strict', fence: 'U6FS_SENS2_DONE' },
    { kind: 'gate', probe: (rows) => rows.some((r) => r.leg === 'probe-body-ran' && r.action === 'toctou') },
    { kind: 'delegate', tok: 'd6', prompt: markers.MK_TOCTOU, which: 'strict', fence: 'U6FS_TOCTOU_DONE' },
  ]
  let phase = 0
  let fenceRounds = 0
  // WAKE PROTOCOL (b6 forensics, kit-verified shape): async delegation
  // completion arrives at the leader (the TEAM-root session) as a fresh
  // model request whose user text carries `[team-work-settled requestToken=
  // <token>]`; the member's DURABLE answer is delivered by `team_collect`
  // addressed with the ORIGINAL delegation token in `requestTokens`. A
  // collect on any other token never observes the answer — b5/b6 proved
  // fences then starve to overrun and the whole plant ordering collapses.
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
    // Triggers and discovery are discriminated on the LAST user message: the
    // boot-root session permanently accumulates every earlier marker (the
    // discovery text, earlier trigger prompts, the leader's initial work), so
    // whole-transcript matching for THOSE would pin every later root turn to
    // the first lane that ever spoke on it. (b2-adjacent bug, static review.)
    const lu = lastUserTextOfStatic(req)
    if (lu.includes(markers.T_SWAP)) return 'trigger-swap'
    if (lu.includes(markers.T_RESTORE)) return 'trigger-restore'
    if (lu.includes(markers.T_TOCTOU)) return 'trigger-toctou'
    if (lu.includes(markers.MK_DISC)) return 'disc'
    // RUNNER NUDGE (b5 lesson): the fence ENDS the leader turn with an echo,
    // so the chain parks instead of racing its ledger gates to overrun. The
    // runner's `U6FS_PHASE_<k>` prompt is the only thing that re-enters the
    // phase machine — every plant trigger therefore lands while the chain is
    // parked, and a gate's first evaluation already sees the ledger row.
    if (lu.includes('U6FS_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d6')}`)) return 'toctou'
    if (ut.includes(`[team-work requestToken=${tokens('d5')}`)) return 'sens2'
    if (ut.includes(`[team-work requestToken=${tokens('d4')}`)) return 'swapped'
    if (ut.includes(`[team-work requestToken=${tokens('d3')}`)) return 'sens1'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'ctl'
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'strict'
    // a request whose last user content is a tool RESULT continues whoever
    // issued that tool: probe closes the trigger turn; team_* continues the
    // leader phase machine; read continues the member lane (already caught
    // by the token checks above).
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool === PROBE_TOOL_NAME) return 'trigger-close'
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
  // the member's DONE text reaches the leader either through a team_collect
  // tool_result OR a [team-work-settled notice (user text) — scan both.
  const leaderHasMarker = (req, marker) => messagesOf(req).map(textOf).join('\n').includes(marker)
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u6fs assembly session' }
    if (lane === 'disc' || lane === 'other' || lane === 'trigger-close') return { kind: 'text', content: lane === 'trigger-close' ? 'U6FS_TRIGGER_DONE' : 'U6FS_NOOP_DONE' }
    if (lane === 'trigger-swap' || lane === 'trigger-restore' || lane === 'trigger-toctou') {
      const st = trigState[lane] ?? 'fresh'
      trigState[lane] = 'issued'
      if (st === 'fresh') {
        const action = lane === 'trigger-swap' ? 'swap' : lane === 'trigger-restore' ? 'restore' : 'toctou'
        return toolCall(PROBE_TOOL_NAME, { action, tag: lane })
      }
      return { kind: 'text', content: 'U6FS_TRIGGER_DONE' }
    }
    if (lane === 'strict') {
      const step = steps.strict
      steps.strict += 1
      if (step === 0) return toolCall('read', { file_path: files.s1.path })
      if (step === 1) return toolCall('read', { file_path: files.denied.path })
      return { kind: 'text', content: 'U6FS_STRICT_DONE' }
    }
    if (lane === 'ctl') {
      if (steps.ctl++ === 0) return toolCall('read', { file_path: files.c1.path })
      return { kind: 'text', content: 'U6FS_CTL_DONE' }
    }
    if (lane === 'sens1') return steps.sens1++ === 0 ? toolCall('read', { file_path: files.s2.path }) : { kind: 'text', content: 'U6FS_SENS1_DONE' }
    if (lane === 'swapped') return steps.swapped++ === 0 ? toolCall('read', { file_path: files.s3.path }) : { kind: 'text', content: 'U6FS_SWAPPED_DONE' }
    if (lane === 'sens2') return steps.sens2++ === 0 ? toolCall('read', { file_path: files.s4.path }) : { kind: 'text', content: 'U6FS_SENS2_DONE' }
    if (lane === 'toctou') return steps.toctou++ === 0 ? toolCall('read', { file_path: files.s5.path }) : { kind: 'text', content: 'U6FS_TOCTOU_DONE' }
    // ── leader lane: the PHASES script ──────────────────────────────────────
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')))
      .filter((x) => x !== null))]
    if (seen.length >= 2 && ids.strict === undefined) { ids.strict = seen[0]; ids.ctl = seen[1] }
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (ph.kind === 'gate') {
        // HOLD, never overrun: false keeps the gate closed; the turn ends
        // CHEAP and the runner's wake (a prompt ON THE TEAM ROOT — the
        // leader's own session, where team tools are addressed legally)
        // re-enters and re-probes. The gate can only open on the probe.
        if (ph.probe(readProbeLedger())) { phase += 1; fenceRounds = 0; continue }
        return { kind: 'text', content: `U6FS_GATE_HOLD_${String(phase)}` }
      }
      // delegate phase: first issue it, then fence on the DONE marker
      if (!ph.issued) {
        const inst = ph.which === 'ctl' ? ids.ctl : ids.strict
        if (inst === undefined) return { kind: 'text', content: `U6FS_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `fs-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      // wake-first: any settled notice not yet collected becomes ONE
      // team_collect over the ORIGINAL delegation tokens (the kit's proven
      // recovery call — the durable member answer rides its result).
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (leaderHasMarker(req, ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 8) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      // HOLD (no overrun — advancing here without the marker is what made
      // b5/b6 orderings hollow). The runner's wake re-enters this fence.
      fenceRounds = 0
      return { kind: 'text', content: `U6FS_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U6FS_L1_DONE' }
  }
}

/** team-remote JSON-RPC over the token-gated origin (a5p1 shape). */
export async function remoteCall(fetchJson, origin, cookie, method, params, tag = 'u6fs') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}
