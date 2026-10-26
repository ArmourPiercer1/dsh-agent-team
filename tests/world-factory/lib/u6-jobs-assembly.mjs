/**
 * u6-jobs-assembly.mjs — world materialization for the `u6-jobs` suite
 * (U6 PR4 C2, ARC-C at the Host): the production Team row WITH the closed
 * `jobsEnabled` key on, the p6t6 observer, one agent preset, blueprints and
 * the mocked leader/member scripts — built ONLY on public seams (the
 * profile-patch layer, the /team-remote HTTP surface, the mock provider),
 * the exact discipline u6-fs (PR2) and u6-proc (PR3) established.
 *
 * Lane truth this suite measures (ARC-C):
 *  - the `job_output`/`job_list`/`job_kill` trio mounts as the kernel's
 *    first NAMED BRIDGE (the Host log's placement feed lists them; no
 *    registration refusal appears);
 *  - a REAL background job (born on the member's un-governed native `bash`
 *    lane — the ONLY lane that bears a background arm at this pin; the
 *    governed confined row REFUSES `run_in_background` by name) produces
 *    its effect marker on DISK — the independent Oracle, read by the
 *    runner through the file system, never through a tool return;
 *  - the trio rows then manage that job through the bridge: list sees the
 *    real row, output returns the real ring bytes, kill answers the
 *    REQUEST form and the HOST settles the rest (the final marker never
 *    lands — measured absence);
 *  - a FOREIGN member's management attempt is refused, and the job keeps
 *    running to the end the owner dictates (measured zero settlement);
 *  - the boot-root's NATIVE trio rides native with zero kernel lines;
 *  - no trio call ever opens an approval row (the no-second-ledger law,
 *    measured over the durable Control lane).
 *
 * Nothing in this module boots or tears down anything — the runner owns the
 * World lifecycle. This module only computes MATERIAL and the decide script.
 *
 * @module tests/world-factory/lib/u6-jobs-assembly
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { personaRow, presetDeclarationRow } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic, extractInstanceId } from './u6-fs-assembly.mjs'

/** The trio the bridge owns — this list is what the jobs World must NOT
 *  builtinToolDeny (they ARE managed there — the governed rows mount them). */
export const JOBS_WORLD_MANAGED_NAMES = Object.freeze(['job_output', 'job_list', 'job_kill'])

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string}} opts
 */
export function createJobsAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  // The confined shell provider is mounted EXACTLY like the u6-proc world
  // (the kernel is mount-wide; the jobs bridge joins the SAME kernel that
  // the read/shell families ride — a world without them would not be the
  // production posture this slice ships into).
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const BASE_PRESET_ID = `u6jobs-base-${rs}`
  const BP_ANCHOR_ID = 'team.u6jobs.anchor'
  const BP_MAIN_ID = 'team.u6jobs.main'
  const ROOT = `session-u6jobs-root-${rs}`
  const CREATE_ROOT = `session-u6jobs-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')

  const markers = {
    MK_DISC: `U6JOBS_DISC_${rs}`,
    MK_L1: `U6JOBS_L1_${rs}`,
    MK_WORK: `U6JOBS_WORK_${rs}`,
    MK_FENCE: `U6JOBS_FENCE_${rs}`,
    T_CTL: `U6JOBS_CTL_${rs}`,
  }
  const claims = {
    claim1: `U6JOBS_CLAIM_${rs}`,
    killWarm: `U6JOBS_KILLWARM_${rs}`,
    killFinal: `U6JOBS_KILLFINAL_${rs}`,
    ctl: `U6JOBS_CTLCLAIM_${rs}`,
  }
  // FLAT children of the workspace root — the proven oracle shape (PR3's
  // u6-proc world wrote its disk facts exactly this way). Run 2 measured
  // the alternative: `tee` into a NEW sub-directory is refused inside the
  // bash sandbox (`Permission denied`), and an effect that cannot reach
  // the disk is no oracle at all.
  const files = {
    claim1: join(workspaceDir, 'u6jobs-claim.txt'),
  }
  const tokens = (tok) => `[U6JOBS-TOK-${tok}-${rs}]`
  const md = (p) => `"${p}"`
  function cmds() {
    // append-mode writers under the RESOLVED workspace root (the confined
    // provider validates containment against the realpath, like
    // planeRootDir() does); the `cat`/`echo` read-back keeps the effect
    // flowing into the job's RING, so the management answer the trio
    // returns is SERVER-side bytes, not a transcript echo.
    const root = planeRootDir()
    const f = (k) => files[k].replace(workspaceDir, root)
    return {
      // Birth 1: the CLAIM goes to the RING first (the background child's
      // stdout is buffered by the HOST registry — job_output returns those
      // bytes, a server-side fact no transcript echo imitates); the disk
      // write is a BONUS, `|| true`-guarded, because boots 2/3 measured
      // the sandbox refusing workspace writes (`Permission denied`) — an
      // effect gate may never depend on what the lane's sandbox law
      // allows (the PR3 ctl arm judged the same honest way).
      birth1: `{ printf '%s\\n' ${md(claims.claim1)} >> ${md(f('claim1'))} || true; printf '%s\\n' ${md(claims.claim1)}; } && sleep 90`,
      // Birth 2 (the cancel subject): warm to the ring NOW, FINAL only if
      // the host settles NO cancellation — a killed job never prints it.
      birth2: `printf '%s\\n' ${md(claims.killWarm)} && sleep 35 && printf '%s\\n' ${md(claims.killFinal)}`,
      ctl: `printf '%s\\n' ${md(claims.ctl)} && sleep 45`,
    }
  }

  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }
  const PLANE_REALM_ID = `u6jobs-realm-${rs}`

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
      staticModel: { provider: 'deepseek-official', model: 'u6jobs-model' },
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
      // THE PR4 KEY: the closed `jobsEnabled` boolean rides the SAME
      // teamToolPlane config the PR2/PR3 worlds proved (fsInstance + the
      // pair-verified confinedProvider trio). ABSENT would be the zero flip
      // (no trio rows at all) — this World exists to turn it on.
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        jobsEnabled: true,
        fsInstance: { fs: 'team-ctl', rootDir: planeRootDir(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
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
    `  persona: "You are the leader of the u6jobs assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the u6jobs assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. The leader chain owns member lifecycle only (no
   * leader exec lane — this suite never spawns through the leader). The
   * WORKER template is the birth + management lane; the FOREIGN template is
   * the owner-fence subject. Both are default:ask (the PR3-asker shape):
   * the un-governed NATIVE `bash` background birth runs on the member's own
   * un-replaced native lane (CI-03 keeps it), and the `job_*` trio rows
   * answer through the kernel + bridge WITHOUT touching the policy lane
   * (their bodies never call PA — the disclosed B-ACT-1-PR posture the PR4
   * diff preserves byte-identically). No member gets a shell allow rule.
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u6jobs assembly team. ${markers.MK_L1} drives your chain: create the worker and the foreign member, delegate the two scripts exactly as instructed, collect each, and when the worker has reported its job ids, delegate the fence script to the foreign member WITH those ids, collect it, then finish.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      // request-control is named in teamEnvelope.allow because the member
      // effective envelope is THIS list narrowed by the template entry —
      // template entries never widen it (admission/envelope.ts:100-119;
      // u6prc8 measured a template-only addition filtered at the team root
      // with exactly boot-4's words: 'operation request-control ... outside
      // the caller's mutation envelope'). The worker's bash ask (blueprint
      // default: ask) is a durable-row creation = a request-control
      // mutation, so the ASK lane needs it on both sides.
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control',
      '  deny: []',
      'members:',
      '  - templateId: worker', '    displayName: "u6jobs birth+management worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6jobs assembly team (jobs lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      '  - templateId: foreign', '    displayName: "u6jobs foreign viewer"',
      `    persona: ${JSON.stringify('You are a worker of the u6jobs assembly team (foreign viewer). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
            // worker: names request-control (the ask lane above). foreign stays
      // NARROWER (its only calls are the plane trio, which never ask). The
      // leader entry pins its OLD bounds exactly — teamEnvelope widened,
      // so an entry-less leader would widen with it (PR3 discipline:
      // leader lanes stay byte-identical).
      'memberEnvelopes:',
      '  - templateId: leader', '    envelope:', '      allow:', '        - create-member', '        - assign-task', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      '  - templateId: foreign', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  /** The rows the factory composes into the patch layer (besides canary). */
  function teamRows() {
    // Boot-4 law (its receipt names the cause): the kit smoke preset's
    // persistent PTY bash has NO background spawn AT ALL — run_in_background
    // is not in its schema and is silently ignored (the receipt captured the
    // persistent renderer's `[Command finished with exit code 0]` trailer on
    // a background-flagged call). The background-capable producer is the
    // plain '@deepseek-ai/dsh-tool-bash' row, composed here EXACTLY as the
    // host base bundle composes it (bash-sandbox provider + shell-env +
    // tool-bash, packages/bundle/base/cordis.patch.yml:235/265/268), in the
    // web-app shape the bundle's own comment demands: the jobs REGISTRY
    // stays a host-plane row (patch layer, teamRows below), the preset rows
    // resolve it with ctx.get/ctx.inject — 'a Service a row outside its
    // realm READS belongs to the plane both can see'. persistent-shell is
    // OUT of this World on purpose: exactly one bash per session, the
    // background-capable one.
    const basePlugins = [
      personaRow({
        text: 'You are a coding agent powered by the {{model}} model.',
        suffix: 'Your working directory is {{cwd}}.',
      }),
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
      // boot-5 law (binder fail-closed, named in the host log): the boot
      // host composes its OWN bundle layers — base+web-app already carry
      // the PROVIDERS on the host plane (`bash-sandbox` -> service
      // 'shell', `shell-env`), and re-adding them to the preset is a
      // DUPLICATE registration. The web-app shape is exactly: the preset
      // carries the CONSUMER row `tool-bash`, which resolves the host-
      // plane 'shell', 'shellEnv' and 'jobs' through ctx.get/ctx.inject
      // ('a Service a row outside its realm READS belongs to the plane
      // both can see'). Providers: host plane. Consumers: preset.
      { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
    ]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      // The host's OWN jobs stack, verbatim rows of the host base bundle
      // (packages/bundle/base/cordis.patch.yml: jobs -> @deepseek-ai/dsh-
      // jobs-local, tool-jobs -> @deepseek-ai/dsh-tool-jobs): present, the
      // native bash row composes run_in_background and the NATIVE trio
      // mounts on un-governed sessions (the boot-root CI-03 arm); on a
      // governed member session the plane's kernel rows TAKE OVER these
      // names and the native defs below remain what the bridge's jobs
      // service reads (one host JobRegistry, no second registry). WITHOUT
      // these rows a World has NO jobs substrate at all — run 1 measured
      // exactly that (the birth lane answers 'unknown tool', the confined
      // governed row refuses background by name, and nothing is born):
      // the honest CI-03 posture needs the substrate to be PRESENT and
      // UNTOUCHED, not absent.
      { id: 'jobs', name: '@deepseek-ai/dsh-jobs-local' },
      { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u6jobs base',
        description: `u6jobs base preset (${runStamp}) = smoke + tool-fs-search`,
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

  /** Fresh disk read of one effect oracle; null = never written. */
  function readEffect(which) {
    try { return existsSync(files[which]) ? readFileSync(files[which], 'utf8') : null } catch { return null }
  }

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    LAUNCHER, launcherSha,
    blueprintDir, workspaceDir, files, claims, markers, tokens,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readEffect, cmds,
  }
}

// ── decide script ───────────────────────────────────────────────────────────
// The mock is a scripted MODEL: it reads its transcript like a real model
// does and issues ONE tool call at a time. The job ids are the REAL host
// job ids read out of the transcript's own tool_result text — the measured
// shapes at this host pin are `started background job <id>` (bash tool,
// packages/shell/tool-bash/src/index.ts:474) and the trio's own list row
// `<id> [kind] <status> — <label>` (the byte-identical bridge body). The
// member step machines are derived from the transcript's own tool_exchange
// count (STATELESS): follow-up pings can never advance a lane spuriously.
// The leader machine is the proven u6-proc phase machine.

/** Every id mention in a transcript, first-seen order (real host ids). */
export function extractJobIds(text) {
  const ids = []
  const note = (m) => { if (m !== null && !ids.includes(m)) ids.push(m) }
  for (const m of String(text).matchAll(/started background job ([A-Za-z0-9][A-Za-z0-9_.-]{2,})/g)) note(m[1])
  for (const m of String(text).matchAll(/^\s*([A-Za-z0-9][A-Za-z0-9_.-]{3,}) \[(?:stream|final-output)\] /gm)) note(m[1])
  return ids
}

/** Ordered assistant-tool_use ↔ tool_result pairs of one transcript. */
export function toolExchanges(req) {
  const pending = new Map()
  const argsOf = new Map()
  const out = []
  for (const m of messagesOf(req)) {
    if (m?.role === 'assistant' && Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type === 'tool_use') {
          const key = String(b.id ?? `${String(b.name)}-${out.length + pending.size}`)
          pending.set(key, String(b.name ?? ''))
          argsOf.set(key, b.input ?? null)
        }
      }
    }
    if (m?.role === 'user' && Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type !== 'tool_result') continue
        const id = String(b.tool_use_id ?? b.toolUseId ?? '')
        const name = pending.get(id) ?? null
        out.push({ name, args: argsOf.get(id) ?? null, result: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('') })
      }
    }
  }
  return out
}

/** The LAST mock request whose transcript belongs to the lane (needle in
 *  any message text = the lane's delegation/trigger marker rides it). */
export function laneTranscript(requests, needle) {
  let hit = null
  for (const r of requests ?? []) {
    if (messagesOf(r).some((m) => textOf(m).includes(needle))) hit = r
  }
  return hit
}

const TRIO = ['job_output', 'job_list', 'job_kill']

/**
 * @param {{assembly: object}} opts
 */
export function makeJobsDecide({ assembly }) {
  const { tokens, markers } = assembly
  const cmds = assembly.cmds()

  const userTextOf = (req) => messagesOf(req)
    .filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
  const transcriptText = (req) => messagesOf(req).map(textOf).join('\n')
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

  const ids = {} // leader-side member instance ids (extractInstanceId law)
  const PHASES = [
    { kind: 'create', template: 'worker', tok: 'c1', label: 'u6jobs-worker' },
    { kind: 'create', template: 'foreign', tok: 'c2', label: 'u6jobs-foreign' },
    { kind: 'delegate', tok: 'd1', which: 'worker', prompt: markers.MK_WORK, fence: 'U6JOBS_WORK_DONE' },
    // d2's prompt EMBEDS the real job id the worker reported (the foreign
    // member has no other way to learn it — same as a real teammate).
    { kind: 'delegate-ids', tok: 'd2', which: 'foreign', fence: 'U6JOBS_FENCE_DONE' },
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((t) => t.includes('[team-work-settled requestToken='))
    .map((t) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t); return m2 === null ? null : m2[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
  const leaderHasMarker = (req, marker) => transcriptText(req).includes(marker)

  function laneOf(req) {
    const t = transcriptText(req)
    if (t.includes('Generate the session title')) return 'title'
    const lu = lastUserTextOfStatic(req)
    if (lu.includes(markers.T_CTL)) return 'trigger-ctl'
    if (lu.includes(markers.MK_DISC)) return 'disc'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'work'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'fence'
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool === 'bash' || TRIO.includes(String(tool))) return 'ctl-close'
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes('U6JOBS_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }

  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u6jobs assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U6JOBS_NOOP_DONE' }
    const exchanges = toolExchanges(req)
    const t = transcriptText(req)
    const jids = extractJobIds(t)
    // ── boot-root CI-03 native control: native bash birth + NATIVE trio
    // read, zero governed rows involved (the root session is not a team
    // member mount).
    if (lane === 'trigger-ctl' || lane === 'ctl-close') {
      if (exchanges.length === 0) return toolCall('bash', { command: cmds.ctl, description: 'u6jobs native control birth', run_in_background: true })
      if (exchanges.length === 1) return toolCall('job_output', { job_id: jids[0] ?? 'job-unknown' })
      return { kind: 'text', content: 'U6JOBS_CTL_RAN' }
    }
    // ── worker: birth → list → output → birth2 → kill2 → settle spacer
    // lists → report. step = the transcript's OWN exchange count.
    if (lane === 'work') {
      const first = jids[0] ?? 'job-unknown'
      const second = jids.filter((x) => x !== first).pop() ?? first
      if (exchanges.length === 0) return toolCall('bash', { command: cmds.birth1, description: 'u6jobs owner birth', run_in_background: true })
      if (exchanges.length === 1) return toolCall('job_list', {})
      if (exchanges.length === 2) return toolCall('job_output', { job_id: first })
      if (exchanges.length === 3) return toolCall('bash', { command: cmds.birth2, description: 'u6jobs cancel-subject birth', run_in_background: true })
      if (exchanges.length === 4) return toolCall('job_output', { job_id: second })
      if (exchanges.length === 5) return toolCall('job_kill', { job_id: second, reason: 'u6jobs-cancel-honest' })
      // the settle spacer is FOREGROUND (40 s > the 35 s FINAL deadline):
      // the next ring read lands AFTER the window in which an un-killed
      // job would have printed FINAL — absence there is a measurement.
      if (exchanges.length === 6) return toolCall('bash', { command: 'sleep 40', description: 'u6jobs settle spacer' })
      if (exchanges.length === 7) return toolCall('job_output', { job_id: second })
      if (exchanges.length === 8) return toolCall('job_list', {})
      return { kind: 'text', content: `U6JOBS_WORK_DONE ids=${first},${second}` }
    }
    // ── foreign viewer: manage the OWNER's real job id (from the
    // delegation prompt), then attempt the kill; both must be refused.
    if (lane === 'fence') {
      const m = /job_id=([A-Za-z0-9_.-]+)/.exec(userTextOf(req))
      const jobId = m === null ? 'job-unknown' : m[1]
      if (exchanges.length === 0) return toolCall('job_output', { job_id: jobId })
      if (exchanges.length === 1) return toolCall('job_kill', { job_id: jobId, reason: 'u6jobs-foreign-attempt' })
      return { kind: 'text', content: 'U6JOBS_FENCE_DONE' }
    }
    // ── leader: the proven phase machine (create, create, delegate,
    // collect-until-fence, delegate-with-ids, collect, DONE).
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')))
      .filter((x) => x !== null))]
    if (ids.worker === undefined && seen.length >= 2) { ids.worker = seen[0]; ids.foreign = seen[1] }
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (ph.kind === 'delegate') {
        if (!ph.issued) {
          const inst = ids[ph.which]
          if (inst === undefined) return { kind: 'text', content: `U6JOBS_ID_FAIL_${ph.tok}` }
          ph.issued = true
          return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `jobs-${ph.tok}`, prompt: ph.prompt, async: true })
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
        return { kind: 'text', content: `U6JOBS_FENCE_HOLD_${ph.fence}` }
      }
      if (ph.kind === 'delegate-ids') {
        if (!ph.issued) {
          const m = /ids=([A-Za-z0-9_.-]+),([A-Za-z0-9_.-]+)/.exec(transcriptText(req))
          if (m === null) return { kind: 'text', content: 'U6JOBS_PHASE_wait_ids' }
          const inst = ids.foreign
          if (inst === undefined) return { kind: 'text', content: `U6JOBS_ID_FAIL_${ph.tok}` }
          ph.issued = true
          return toolCall('team_delegate', {
            rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst,
            label: `jobs-${ph.tok}`, prompt: `${markers.MK_FENCE} job_id=${m[1]}`, async: true,
          })
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
        return { kind: 'text', content: `U6JOBS_FENCE_HOLD_${ph.fence}` }
      }
      phase += 1
    }
    return { kind: 'text', content: 'U6JOBS_L1_DONE' }
  }
  decide.__state = () => ({ phase, ids, lanes: { phases: PHASES.map((p) => ({ kind: p.kind, issued: p.issued === true })) } })
  return decide
}

// ── judge (the SAME function the offline reconstruct consumes) ─────────────
/**
 * THE shared C2 verdict function for the u6-jobs suite (single source for
 * the live run AND the offline reconstruction from the written evidence —
 * the digest below is its whole input; `hostAlive` is the one live fact).
 *
 * Digest shape (every field MEASURED by the runner; absent = unknown):
 *   kernelHits      {pattern: {count}}                — host-log scans
 *   claims          {claim1, killFinal, ctl}          — unique per-run strings
 *   claim1Text      string|null   — DISK oracle: birth-1 claim file (child-written)
 *   killText        string|null   — DISK oracle: kill-job file (warm line always;
 *                                   the FINAL line only if the host settled NO cancel)
 *   ctlText         string|null   — DISK oracle: boot-root native job's file
 *   jobIds          [id1, id2]    — REAL host job ids from the transcripts
 *   list1 output1 kill2 list2      — worker lane's trio ANSWERS (last per name)
 *   foreignOutput foreignKill      — foreign lane's answers
 *   ctlOutput                      — boot-root NATIVE job_output answer
 *   trioUses        n             — trio tool_use count across the whole corpus
 *   controlRows     [{toolName,summary,status}] — durable Control lane (polls ∪ final)
 *   birthRow        {seen,resolved}                  — the member birth ask, if any
 *   settle          {killLines, foreignKillLines}    — host-log lifecycle counts
 *   rootKernelMentions n                             — kernel words in the root transcript
 *
 * @param {object} d
 * @param {boolean} hostAlive
 * @returns {Array<[string, 'PASS'|'FAIL', object]>}
 */
export function judgeU6Jobs(d, hostAlive) {
  const out = []
  const add = (id, ok, detail) => out.push([id, ok ? 'PASS' : 'FAIL', detail])
  const k = d.kernelHits ?? {}
  const count = (p) => k[p]?.count ?? 0
  const trioRowRe = /\bjob_(output|list|kill)\b/
  const trioControlRows = (d.controlRows ?? []).filter((r) => trioRowRe.test(`${String(r.toolName ?? '')} ${String(r.summary ?? '')}`))
  const lineFor = (text, id) => String(text ?? '').split('\n').find((l) => l.includes(String(id))) ?? null

  // 1) MOUNTED: the Host-log placement feed lists the trio (the kernel
  //    speaks their names on the governed mounts) and NOTHING refused.
  add('jobs:mounted', hostAlive === true
    && count('a5g7: placement-feed rows=') > 0
    && count('job_output') > 0
    && count('PLANE_JOBS_REGISTRATION_REFUSED') === 0
    && count('PLANE_KERNEL_UNAVAILABLE') === 0
    && count('a5-plane: mount-REFUSED') === 0
    && count('a5-plane: placement-REFUSED') === 0, {
    kernelHits: Object.fromEntries(Object.keys(k).map((p) => [p, k[p].count])),
    note: 'ONE kernel, three families (read, team_bash, and the trio as the FIRST named bridge); any registration refusal names itself in the log',
  })
  // 2) BIRTH: the HOST spawned a real background job — the id comes from
  //    the host's own 'started background job' / row vocabulary (never a
  //    claim string), the ask posture stayed clean, and the ring carries
  //    the effect (arm 3). A sandboxed lane's DISK write is a BONUS the
  //    receipt reports, never a gate: boots 2/3 measured the sandbox
  //    law refusing workspace writes, and a verdict may not depend on
  //    what the lane's sandbox happens to allow.
  add('jobs:birth-positive', (d.jobIds?.length ?? 0) >= 1
    && (d.birthRow?.seen !== true || d.birthRow?.resolved === true), {
    claim1OnDisk: d.claim1Text !== null && d.claim1Text !== undefined
      && String(d.claim1Text).includes(d.claims?.claim1 ?? '\u0000'),
    jobIds: (d.jobIds ?? []).slice(0, 4),
    birthRow: d.birthRow ?? { seen: false },
    note: 'the birth lane is the member NATIVE bash (the governed confined row refuses background by name — the CI-03 disclosed law); if the host gated the birth, the runner settled the ask through the PUBLIC team.resolveControl seam',
  })
  // 3) GOVERNED MANAGEMENT through the bridge: list saw the REAL id;
  //    output returned the ring bytes (the child's stdout = server-side
  //    effect) with the host status line; the trio ran >=4 times.
  add('jobs:governed-management', lineFor(d.list1, d.jobIds?.[0]) !== undefined && lineFor(d.list1, d.jobIds?.[0]) !== null
    && String(d.output1 ?? '').includes(d.claims?.claim1 ?? '\u0000')
    && String(d.output1 ?? '').includes('[status:')
    && (d.trioUses ?? 0) >= 4, {
    jobId: d.jobIds?.[0] ?? null,
    list1Row: lineFor(d.list1, d.jobIds?.[0]),
    outputHead: String(d.output1 ?? '').slice(0, 160),
    trioUses: d.trioUses ?? null,
    note: 'the ring bytes ARE the server-side effect (the host registry buffered the child stdout); the [status: …] line is the HOST status relaying honestly',
  })
  // 4) OWNER FENCE: the foreign viewer is REFUSED on read AND kill, and
  //    nothing settled: no host cancel/abort event for the owner's job,
  //    the claim marker intact, the owner's later list still shows it.
  add('jobs:owner-fence', String(d.foreignOutput ?? '').length > 0
    && !String(d.foreignOutput ?? '').includes(d.claims?.claim1 ?? '\u0000')
    && /refused|not visible|unknown job|owner-mismatch/i.test(String(d.foreignOutput ?? ''))
    && !String(d.foreignKill ?? '').includes('requested cancellation of job')
    && /refused|not visible|unknown job|owner-mismatch/i.test(String(d.foreignKill ?? ''))
    && (d.settle?.foreignKillLines ?? -1) === 0
    && (lineFor(d.list2, d.jobIds?.[0]) ?? '').includes('running'), {
    foreignOutput: String(d.foreignOutput ?? '').slice(0, 160),
    foreignKill: String(d.foreignKill ?? '').slice(0, 160),
    ownerRowAfterForeign: lineFor(d.list2, d.jobIds?.[0]),
    foreignKillHostEvents: d.settle?.foreignKillLines ?? null,
    note: 'DISCLOSED live-world law: the native-born job is UN-ATTRIBUTED (no production creation-lane producer rides the member native lane), so the answer is the HOST caller fence reached through the bridge corded:false pass-through — the Team layer invented nothing; the measured ZERO is the settlement: no cancel/abort event, job keeps running',
  })
  // 5) CANCEL HONESTY: the kill answered REQUEST vocabulary (never a
  //    settlement), the job really ran (warm marker), and the host settled
  //    the fate: the FINAL marker never landed while the owner's list
  //    shows the settled status (or the host log carries the settle).
  const kill2 = String(d.kill2 ?? '')
  const id2 = d.jobIds?.[1] ?? null
  const list2Row = lineFor(d.list2, id2)
  const settledInList = list2Row === null || /\b(aborted|cancelled|completed|failed|exited|finished)\b/i.test(list2Row)
  add('jobs:cancel-honest', kill2.includes('requested cancellation of job')
    && !/has been (cancelled|killed|terminated)|job .* (cancelled|terminated)/i.test(kill2)
    && String(d.output2 ?? '').includes(d.claims?.killWarm ?? '\u0000')
    && String(d.output2Post ?? '').includes(d.claims?.killWarm ?? '\u0000')
    && !String(d.output2Post ?? '').includes(d.claims?.killFinal ?? '\u0000')
    && (settledInList || (d.settle?.killLines ?? 0) > 0), {
    kill2: kill2.slice(0, 160),
    list2RowForKillJob: list2Row,
    killWarmSeen: String(d.output2 ?? '').includes(d.claims?.killWarm ?? '\u0000'),
    killFinalSeen: String(d.output2Post ?? '').includes(d.claims?.killFinal ?? '\u0000'),
    killHostEvents: d.settle?.killLines ?? null,
    note: 'the bridge only ever says REQUESTED; the FINAL text never reached the RING even AFTER the 40 s settle spacer passed the 35 s print deadline (measured absence at the HOST registry, past the window where an un-killed job would have printed it) — the child really stopped; the settled status word comes from the HOST list, never from the bridge',
  })
  // 6) CI-03 NATIVE CONTROL: the boot-root's NATIVE trio ran its own job
  //    with ZERO kernel involvement: the native job_output returns the
  //    RING bytes of the root's own background child (host-buffered — no
  //    transcript echo imitates them) plus the host status line, and the
  //    kernel never spoke about those calls.
  add('jobs:ctl-native-untouched', String(d.ctlOutput ?? '').includes(d.claims?.ctl ?? '\u0000')
    && String(d.ctlOutput ?? '').includes('[status')
    && (d.rootKernelMentions ?? -1) === 0, {
    ctlAnswerHead: String(d.ctlOutput ?? '').slice(0, 160),
    rootKernelMentions: d.rootKernelMentions ?? null,
    note: 'the boot-root session is not a Team mount: its native job_* ride native (CI-03), the kernel never spoke about those calls',
  })
  // 7) NO SECOND LEDGER, measured live: the trio executed >=4 governed
  //    calls while the durable Control lane opened ZERO rows naming any
  //    job_* name (the polls + the final snapshot are the observation).
  add('jobs:no-second-ledger', trioControlRows.length === 0 && (d.trioUses ?? 0) >= 4, {
    trioControlRows: trioControlRows.slice(0, 5),
    controlRowsTotal: (d.controlRows ?? []).length,
    trioUses: d.trioUses ?? null,
    note: 'the kernel is the ONLY ledger the trio touches; the birth ask rows (tool:bash), if any, are the PA lane — a different lane, different tool name',
  })
  return out
}
