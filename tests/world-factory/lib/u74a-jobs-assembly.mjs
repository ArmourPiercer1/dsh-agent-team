/**
 * u74a-jobs-assembly.mjs — world materialization for the `u7-4a` C2 suite
 * (U7 PR4a, live-host lane): the production Team row with the CLOSED
 * `jobsEnabled` + `backgroundJobs` keys ON, the shell-takeover spelling
 * (`planeCfg.names.bash = 'bash'`), the live confined shell provider, the
 * p6t6 observer, the additive read-only control-probe row, one agent preset,
 * blueprints and the mocked leader/member scripts — built ONLY on public
 * seams (the profile-patch layer, the /team-remote HTTP surface, the mock
 * provider), the exact discipline u6-fs (PR2), u6-proc (PR3) and u6-jobs
 * (PR4) established.
 *
 * WHAT THIS WORLD MEASURES (the U7-4a producer law, live):
 *  - an AUTHORIZED governed `bash({command, background:true})` on a member
 *    (default:ask, NO shell rule — the pended ask lane, the u6-proc 'asker'
 *    precedent) rides kernel decide -> PA ask -> the PUBLIC
 *    `team.resolveControl` v4 seam settles the row exactly once -> grant
 *    consumed -> the SAME confined provider spawns -> the producer
 *    (`jobs-background-producer.mjs`) creates the host job through the
 *    host's public `JobRegistry.start` seam and attributes it through
 *    `attributeBackgroundJob` BEFORE the receipt reaches the model;
 *  - the receipt carries the REAL host job id
 *    (`started background job <id> (governed: manage it with the job_list /
 *    job_output / job_kill trio)`) and the trio manages it for real:
 *    `job_output(wait:true)` answers the HOST ring bytes (server-side
 *    oracle — the claim travels in the child's STDOUT, never the
 *    transcript), `job_list` shows the attributed row to the OWNER,
 *    `job_kill` answers the two honest host forms ('requested' / 'already
 *    finished') and nothing else;
 *  - a FOREIGN member's trio attempts answer owner-mismatch / the CI-05
 *    unattributed-job refusal with ZERO host reach;
 *  - the boot-root's NATIVE foreground bash lane is untouched (CI-03);
 *  - PLANT (plant=true): the identical World with `backgroundJobs` ABSENT
 *    — the producer never mounts and the governed row keeps the
 *    byte-identical by-name `background-not-supported` refusal.
 *
 * DISCLOSURES (honest seams, no invented authority):
 *  - the ask lane resolves through the PUBLIC `team.resolveControl` v4
 *    remote seam (what the GUI's human lane calls) — this module only
 *    SCRIPTS the model; the runner performs the resolutions;
 *  - member templates carry NO shell-class allow anywhere (A2C-1 grammar:
 *    allow-lane `any` is member-forbidden); the worker rides default:ask
 *    exactly like the u6-proc 'asker'; the trio rows are approval-free
 *    (the bridge body never calls PA — the PR4 measured law);
 *  - the plant delta is EXACTLY ONE config key: `backgroundJobs` is ABSENT
 *    (the zero-flip spelling; `false` would be equivalent per the plane's
 *    Gate-0c law, absence is the plan's word);
 *  - the effect oracle is the host RING (stdout) read back through
 *    `job_output` — workspace disk writes from a background child are a
 *    sandbox-dependent BONUS at this host pin (u6-jobs boots 2/3 measured
 *    refusals), so no verdict here depends on one;
 *  - the reach-count greps name lines this product ACTUALLY ships to the
 *    host log (`[dsh-agent-team] a5bg: attributed hostJobId=…`,
 *    `a5bg: producer-mounted`); the gateway observations that ride the
 *    row's observations array never reach the boot log and are therefore
 *    NOT claimed here (disclosed, not guessed).
 *
 * Nothing in this module boots or tears down anything — the runner owns the
 * World lifecycle. This module only computes MATERIAL, the decide script and
 * the pure judge (the offline twin of a reconstruct script: import
 * `judgeU74a` and re-apply it to the written evidence digest — no fourth
 * file exists on this lane by budget).
 *
 * @module tests/world-factory/lib/u74a-jobs-assembly
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { personaRow, presetDeclarationRow } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic, extractInstanceId } from './u6-fs-assembly.mjs'
import { nativeConfinementEnvBlock } from './host-sandbox-assets.mjs'

/** The CI-05 planted id (regression pin: never attributed, never exists). */
export const U74A_PLANTED_JOB_ID = 'bash-does-not-exist-u74a'

/** The trio the jobs World must NOT builtinToolDeny (governed rows mount). */
export const U74A_MANAGED_NAMES = Object.freeze(['job_output', 'job_list', 'job_kill'])

/** Case ids the MAIN world's runner selects (judge order is this order). */
export const U74A_MAIN_CASES = Object.freeze([
  'u74a:mounted',
  'u74a:bg-receipt-carries-host-job-id',
  'u74a:attributed-server-side',
  'u74a:ring-bytes-via-job-output-wait',
  'u74a:list-shows-owner',
  'u74a:kill-live-requested',
  'u74a:kill-finished-honest',
  'u74a:foreign-cross-scope-refusal',
  'u74a:list-deny-leg-honest-zero',
  'u74a:planted-unattributed',
  'u74a:native-ctl-unaffected',
  'u74a:exactly-once-approvals',
])

/** Case ids the PLANT world's runner selects. */
export const U74A_PLANT_CASES = Object.freeze([
  'u74a:plant-refused',
  'u74a:plant-no-producer',
  'u74a:plant-no-jobs',
])

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string, plant?: boolean}} opts
 */
export function createU74aAssembly({ repoRoot, home, runStamp, reportDir, plant = false }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  // The additive control-probe row mounts by FILE URL through the SAME patch
  // row face the production row uses (name = pathToFileURL href) — no
  // factory edit, no profileDir copy: the u6-arc-d assembly mounts its canary
  // beside the production rows in the one insert layer; this lane has no
  // factory slot, so the row rides its teamRows() list instead.
  const PROBE_ROW_URL = pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'canary', 'u74a-ctl-probe-host.mjs')).href
  // The Landlock pre-launcher the confined provider re-hashes at every spawn
  // (double-gate: config sha pin + byte-hash at Gate 0c). HASH AT CONFIG TIME:
  // the offline smoke may build an assembly for a notional repo; the real
  // hash happens when teamRowConfig() runs for the booted World's tree.
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const BASE_PRESET_ID = `u74a-base-${rs}`
  const BP_ANCHOR_ID = 'team.u74a.anchor'
  const BP_MAIN_ID = 'team.u74a.main'
  const ROOT = `session-u74a-root-${rs}`
  const CREATE_ROOT = `session-u74a-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')

  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }
  const PLANE_REALM_ID = `u74a-realm-${rs}`

  // The claims ride the background child's STDOUT (the host ring buffers
  // them; `job_output` answers those exact bytes server-side). A claim
  // appearing in a trio answer can only come from the REAL process bytes —
  // no transcript echo imitates the ring + the `[status: …]` line.
  const claims = {
    bg: `U74A_BG_CLAIM_${rs}`,
    list: `U74A_LIST_CLAIM_${rs}`,
    liveWarm: `U74A_LIVE_WARM_${rs}`,
    liveFinal: `U74A_LIVE_FINAL_${rs}`,
    done: `U74A_DONE_CLAIM_${rs}`,
    ctl: `U74A_CTL_CLAIM_${rs}`,
    // pilot C2 re-home (2026-10-29 float): the FOREIGN lane's own deny-leg
    // birth claim — a denied call must NEVER let these bytes exist anywhere.
    fdeny: `U74A_FDENY_CLAIM_${rs}`,
  }
  const markers = {
    MK_DISC: `U74A_DISC_${rs}`,
    MK_L1: `U74A_L1_${rs}`,
    MK_BG: `U74A_MK_BG_${rs}`,
    MK_OUT: `U74A_MK_OUT_${rs}`,
    MK_LIST: `U74A_MK_LIST_${rs}`,
    MK_KLLIVE: `U74A_MK_KLLIVE_${rs}`,
    MK_KLDONE: `U74A_MK_KLDONE_${rs}`,
    MK_FOUT: `U74A_MK_FOUT_${rs}`,
    MK_FPLANT: `U74A_MK_FPLANT_${rs}`,
    MK_FDENY: `U74A_MK_FDENY_${rs}`,
    T_KLFOLLOW: `U74A_KLFOLLOW_${rs}`,
    T_CTL: `U74A_TRIGGER_CTL_${rs}`,
  }
  const tokens = (n) => `u74a-${n}-${rs}`
  const md = (p) => `'${p}'`

  function cmds() {
    // stdout-only effects: the RING is the oracle (see header disclosure).
    // The `printf` shape mirrors u6-jobs' proven birth commands.
    return {
      bg: `printf '%s\\n' ${md(claims.bg)}`,
      list: `printf '%s\\n' ${md(claims.list)} && sleep 25`,
      killLive: `printf '%s\\n' ${md(claims.liveWarm)} && sleep 30 && printf '%s\\n' ${md(claims.liveFinal)}`,
      killDone: `printf '%s\\n' ${md(claims.done)}`,
      fdeny: `printf '%s\\n' ${md(claims.fdeny)} && sleep 30`,
      ctl: `printf '%s\\n' ${md(claims.ctl)}`,
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
      staticModel: { provider: 'deepseek-official', model: 'u74a-model' },
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
      // THE U7-4a KEYS. `jobsEnabled` mounts the trio rows (PR4); the
      // SHELL-TAKEOVER spelling `names.bash='bash'` + the closed
      // `backgroundJobs` key arm the SAME confined row with the governed
      // background producer (U7-4a). The plane refuses the combination
      // fail-closed (Gate-0c): backgroundJobs needs jobsEnabled, the
      // confinedProvider and the native-name takeover — this World is built
      // to satisfy all three (main) or to omit the arm (plant).
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        jobsEnabled: true,
        ...(plant ? {} : { backgroundJobs: true }),
        names: { bash: 'bash' },
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
    `  persona: "You are the leader of the u74a assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the u74a assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. The leader chain owns member lifecycle only (no
   * leader exec lane). The WORKER template (5 instances, one lane each) and
   * the FOREIGN template (2 instances) are BOTH default:ask with NO shell
   * rule anywhere (A2C-1: member templates cannot carry a shell allow; the
   * u6-proc 'asker' posture): the governed `bash` takeover row therefore
   * pends a real durable Control ask per background call, which the runner
   * settles through the PUBLIC team.resolveControl v4 seam. The trio rows
   * answer through the kernel + bridge without touching the PA lane, so the
   * foreign member's trio attempts reach the plane with a NARROWER envelope.
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u74a assembly team. ${markers.MK_L1} drives your chain: create the five worker members and the two foreign members, then delegate the scripts one at a time exactly as instructed and collect each before the next delegation. Never run a tool of your own beyond the team lifecycle tools.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      // request-control is named in teamEnvelope.allow because the member
      // effective envelope is THIS list narrowed by the template entry —
      // template entries never widen it (admission/envelope.ts law; u6prc8
      // measured the filtered words). The worker's governed bash ask is a
      // durable-row creation = a request-control mutation, so the ASK lane
      // needs it on BOTH sides.
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control',
      '  deny: []',
      'members:',
      '  - templateId: worker', '    displayName: "u74a governed-jobs worker"',
      `    persona: ${JSON.stringify('You are a worker of the u74a assembly team (governed jobs lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      '  - templateId: foreign', '    displayName: "u74a foreign viewer"',
      `    persona: ${JSON.stringify('You are a worker of the u74a assembly team (foreign viewer). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      // worker names request-control (its bash ask lane); foreign stays
      // NARROWER (its only calls are the plane trio, which never ask). The
      // leader entry pins its OLD bounds exactly (PR3 discipline: widened
      // teamEnvelope + entry-less leader would widen — keep lanes
      // byte-identical).
      'memberEnvelopes:',
      '  - templateId: leader', '    envelope:', '      allow:', '        - create-member', '        - assign-task', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      // pilot C2 re-home (2026-10-29): the deny-leg lane is a FOREIGN member
      // whose OWN background birth must open its durable ask row so the
      // runner can answer DENY on the Control lane (ask-lane creation is a
      // request-control mutation - the u6prc8 law; the entry stays otherwise
      // NARROWER than the worker's).
      '  - templateId: foreign', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  /** The rows the factory composes into the patch layer (besides canary). */
  function teamRows() {
    // boot-5 law (u6-jobs): the boot host composes its OWN bundle layers —
    // base+web-app already carry the PROVIDERS on the host plane; the preset
    // carries the CONSUMER row `tool-bash`, which resolves the host-plane
    // 'shell', 'shellEnv' and 'jobs' through ctx.get/ctx.inject. The jobs
    // REGISTRY stays a host-plane row (patch layer below): one host
    // JobRegistry, no second registry; the native trio mounts on
    // un-governed sessions (the CI-03 arm) and the plane's kernel rows TAKE
    // OVER the names on governed mounts.
    const basePlugins = [
      personaRow({
        text: 'You are a coding agent powered by the {{model}} model.',
        suffix: 'Your working directory is {{cwd}}.',
      }),
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
      { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
    ]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      // The host's OWN jobs stack (the substrate must be PRESENT and
      // UNTOUCHED — the honest CI-03 posture, u6-jobs run-1 measured the
      // alternative).
      { id: 'jobs', name: '@deepseek-ai/dsh-jobs-local' },
      { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u74a base',
        description: `u74a base preset (${runStamp}) = persona + tool-fs + tool-fs-search + tool-bash`,
        plugins: basePlugins,
      }),
      // The additive READ-ONLY control-probe row (webServer+teamRoot): the
      // governed CREATE_ROOT/ROOT control lane readable directly, beside
      // the p6t6 observer. Zero mutation, zero tokens — see its header.
      { id: 'u74a-ctl-probe', name: PROBE_ROW_URL },
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

  /** Fresh disk read of one workspace file (bonus channel only — never a gate). */
  function readEffect(path) {
    try { return existsSync(path) ? readFileSync(path, 'utf8') : null } catch { return null }
  }

  return {
    rs, plant,
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    LAUNCHER, launcherSha, PROBE_ROW_URL,
    blueprintDir, workspaceDir, claims, markers, tokens, cmds,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readEffect,
  }
}

// ── decide script ───────────────────────────────────────────────────────────
// The mock is a scripted MODEL reading its own transcript (the u6-jobs
// law): the job ids come out of the transcript's own tool_result text with
// the REAL host-id regexes — the governed receipt `started background job
// <id> (governed: …)` matches u6-jobs' extractJobIds shape, and the trio
// list row `<id> [kind] <status> — <label>` is the byte-identical bridge
// body. Member step machines are STATELESS (the transcript's own
// tool_exchange count), so wake pings can never advance a lane spuriously.
// Each lane rides its OWN member instance (one delegation per instance —
// the proven u6-jobs carrier shape), and the job id a later lane needs is
// embedded in its delegation PROMPT by the leader (same as a real teammate
// forwarding an id).

/** @param {{assembly: object, plant?: boolean}} opts */
export function makeU74aDecide({ assembly, plant = assembly.plant === true }) {
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
  const firstJobId = (text, skip = []) => {
    for (const m of String(text).matchAll(/started background job ([A-Za-z0-9][A-Za-z0-9_.-]{2,})/g)) {
      if (!skip.includes(m[1])) return m[1]
    }
    return null
  }
  const jobIdFromPrompt = (ut, fallback = 'job-unknown') => {
    const m = /job_id=([A-Za-z0-9_.-]+)/.exec(ut)
    return m === null ? fallback : m[1]
  }

  // Lanes and their member instances (one delegation each). MAIN order is
  // also the leader's creation order — the leader machine indexes the
  // instance ids by it.
  const LANES = plant
    ? [{ tok: 'd-bg', which: 'bg', template: 'worker', label: 'u74a-bg', marker: markers.MK_BG, fence: 'U74A_BG_DONE' }]
    : [
        { tok: 'd-bg', which: 'bg', template: 'worker', label: 'u74a-bg', marker: markers.MK_BG, fence: 'U74A_BG_DONE' },
        { tok: 'd-out', which: 'out', template: 'worker', label: 'u74a-out', marker: markers.MK_OUT, fence: 'U74A_OUT_DONE' },
        { tok: 'd-list', which: 'list', template: 'worker', label: 'u74a-list', marker: markers.MK_LIST, fence: 'U74A_LIST_DONE' },
        { tok: 'd-kl', which: 'killlive', template: 'worker', label: 'u74a-killlive', marker: markers.MK_KLLIVE, fence: 'U74A_KILLLIVE_DONE' },
        { tok: 'd-kd', which: 'killdone', template: 'worker', label: 'u74a-killdone', marker: markers.MK_KLDONE, fence: 'U74A_KILLDONE_DONE' },
        // pilot C2 re-home: the deny-leg lane (J4 live shape) runs after the
        // killdone lane (every worker birth ask has settled by then) and
        // before the trio-foreign lanes; the runner's DENIER window opens
        // with KILLDONE_DONE, so this lane's OWN bash ask is DENIED on the
        // durable Control lane (see the suite approver).
        { tok: 'd-fdeny', which: 'fdeny', template: 'foreign', label: 'u74a-fdeny', marker: markers.MK_FDENY, fence: 'U74A_FDENY_DONE' },
        { tok: 'd-fout', which: 'fout', template: 'foreign', label: 'u74a-fout', marker: markers.MK_FOUT, fence: 'U74A_FOUT_DONE', needsId: true },
        { tok: 'd-fplant', which: 'fplant', template: 'foreign', label: 'u74a-fplant', marker: markers.MK_FPLANT, fence: 'U74A_FPLANT_DONE' },
      ]

  function laneOf(req) {
    const t = transcriptText(req)
    if (t.includes('Generate the session title')) return 'title'
    const lu = lastUserTextOfStatic(req)
    if (lu.includes(markers.T_CTL)) return 'trigger-ctl'
    if (lu.includes(markers.MK_DISC)) return 'disc'
    const ut = userTextOf(req)
    // member lanes FIRST: a member carries its delegation token text in
    // EVERY turn of its transcript (the delegation prompt is the session's
    // first user message), and each instance owns exactly one token.
    for (const lane of LANES) {
      if (ut.includes(`[team-work requestToken=${tokens(lane.tok)}`)) return `lane:${lane.which}`
    }
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool === 'bash') return 'ctl-close'
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes('U74A_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }

  /** The per-lane step machine: one tool call at a time, state read off
   *  the transcript's OWN exchange count. */
  function laneStep(which, req, exchanges) {
    const t = transcriptText(req)
    const ut = userTextOf(req)
    switch (which) {
      case 'bg': {
        if (exchanges.length === 0) return toolCall('bash', { command: cmds.bg, background: true })
        const jid = firstJobId(t)
        // plant world: no host id exists (the by-name refusal) — the DONE
        // line says so honestly; the judge reads the REFUSAL bytes off the
        // exchange's tool_result, never off this line.
        return { kind: 'text', content: jid === null ? 'U74A_BG_DONE id=none' : `U74A_BG_DONE id=${jid}` }
      }
      case 'out': {
        // The (a) ring-bytes proof reads an OWNED job: attribution is
        // MOUNT-SCOPED at this pin (measured boot 2: a cross-member read of
        // an attributed id answers the typed unattributed refusal), so the
        // owner lane births its own job (same claim text) and reads its own
        // ring with wait:true (the settle oracle).
        const jid = firstJobId(t)
        if (exchanges.length === 0) return toolCall('bash', { command: cmds.bg, background: true })
        if (exchanges.length === 1) return toolCall('job_output', { job_id: jid ?? 'job-unknown', wait: true, timeout_ms: 15000 })
        return { kind: 'text', content: jid === null ? 'U74A_OUT_DONE id=none' : `U74A_OUT_DONE id=${jid}` }
      }
      case 'list': {
        if (exchanges.length === 0) return toolCall('bash', { command: cmds.list, background: true })
        if (exchanges.length === 1) return toolCall('job_list', {})
        const jid = firstJobId(t)
        return { kind: 'text', content: jid === null ? 'U74A_LIST_DONE id=none' : `U74A_LIST_DONE id=${jid}` }
      }
      case 'killlive': {
        const jid = firstJobId(t)
        if (exchanges.length === 0) return toolCall('bash', { command: cmds.killLive, background: true })
        if (exchanges.length === 1) return toolCall('job_kill', { job_id: jid ?? 'job-unknown', reason: 'u74a-kill-live' })
        // Early read (right after the REQUEST): the ring must merely answer
        // (the job is HOST-known; the sleep-30 FINAL cannot have landed).
        if (exchanges.length === 2) return toolCall('job_output', { job_id: jid ?? 'job-unknown' })
        // DECISIVE late read: the LEADER re-delegates this same instance with
        // T_KLFOLLOW only after its own >t+30 s fence wait (a late read
        // earlier than the FINAL window would measure nothing). A leaked
        // (never-cancelled) job WOULD print FINAL by then; the absence this
        // read measures is a real measurement, not an early exit.
        if (exchanges.length === 3 && ut.includes(markers.T_KLFOLLOW)) return toolCall('job_output', { job_id: jid ?? 'job-unknown' })
        return { kind: 'text', content: jid === null ? 'U74A_KILLLIVE_DONE id=none' : `U74A_KILLLIVE_DONE id=${jid}` }
      }
      case 'killdone': {
        const jid = firstJobId(t)
        if (exchanges.length === 0) return toolCall('bash', { command: cmds.killDone, background: true })
        if (exchanges.length === 1) return toolCall('job_output', { job_id: jid ?? 'job-unknown', wait: true, timeout_ms: 15000 })
        if (exchanges.length === 2) return toolCall('job_kill', { job_id: jid ?? 'job-unknown', reason: 'u74a-kill-finished' })
        return { kind: 'text', content: jid === null ? 'U74A_KILLDONE_DONE id=none' : `U74A_KILLDONE_DONE id=${jid}` }
      }
      case 'fdeny': {
        // The DENY-leg machine: own background birth (the runner DENIES its
        // ask) -> the honest-zero list -> DONE. A spawned birth would answer
        // `started background job …` and the judge FAILs on the witnesses;
        // the machine never retries and never interprets the refusal.
        if (exchanges.length === 0) return toolCall('bash', { command: cmds.fdeny, background: true })
        if (exchanges.length === 1) return toolCall('job_list', {})
        return { kind: 'text', content: 'U74A_FDENY_DONE' }
      }
      case 'fout': {
        const jobId = jobIdFromPrompt(ut)
        if (exchanges.length === 0) return toolCall('job_output', { job_id: jobId })
        return { kind: 'text', content: 'U74A_FOUT_DONE' }
      }
      case 'fplant': {
        if (exchanges.length === 0) return toolCall('job_output', { job_id: U74A_PLANTED_JOB_ID })
        return { kind: 'text', content: 'U74A_FPLANT_DONE' }
      }
      default:
        return { kind: 'text', content: 'U74A_NOOP_DONE' }
    }
  }

  // ── leader phase machine (the proven u6-jobs rhythm) ─────────────────────
  const PHASES = [
    ...LANES.map((lane) => ({ kind: 'create', lane })),
    ...LANES.map((lane) => ({ kind: lane.needsId === true ? 'delegate-ids' : lane.which === 'killlive' ? 'delegate-follow' : 'delegate', lane })),
  ]
  let phase = 0
  let fenceRounds = 0
  const collected = new Set()
  const settledPending = (r) => messagesOf(r)
    .map((m) => textOf(m))
    .filter((x) => x.includes('[team-work-settled requestToken='))
    .map((x) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(x); return m2 === null ? null : m2[1] })
    .filter((tk) => tk !== null && !collected.has(tk))
  const leaderHasMarker = (req, marker) => transcriptText(req).includes(marker)

  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u74a assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U74A_NOOP_DONE' }
    const exchanges = typeof req === 'object' && req !== null ? laneToolExchanges(req) : []
    if (lane === 'trigger-ctl' || lane === 'ctl-close') {
      // CI-03 control on the UNGOVERNED boot-root: the NATIVE foreground
      // bash lane (no background flag, no governed row, no kernel words).
      if (exchanges.length === 0) return toolCall('bash', { command: cmds.ctl, description: 'u74a native foreground control' })
      return { kind: 'text', content: 'U74A_CTL_RAN' }
    }
    if (lane.startsWith('lane:')) return laneStep(lane.slice(5), req, exchanges)
    // ── leader: create every lane member (creation ORDER indexes the ids),
    // then one delegate/collect per lane, then DONE.
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')))
      .filter((x) => x !== null))]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', {
          rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`c-${ph.lane.which}`),
          delegationTemplateId: ph.lane.template, label: ph.lane.label,
        })
      }
      const laneIndex = LANES.findIndex((l) => l.tok === ph.lane.tok)
      const inst = seen[laneIndex]
      if (inst === undefined) return { kind: 'text', content: `U74A_ID_FAIL_${ph.lane.tok}` }
      if (ph.kind === 'delegate-follow') {
        // kill-live lane: delegate → (early-read DONE settles) → wait past
        // the subject's sleep-30 FINAL window (wake-cadence idle rounds on
        // the mock's own clock) → FOLLOW-UP delegate (T_KLFOLLOW) → the same
        // instance answers ONE more job_output → collect → advance. A leaked
        // job would print FINAL in that window; the late read measures the
        // absence for real. The first delegation has settled (DONE) before
        // the follow-up is issued, so no busy-overlap is ever attempted.
        if (!ph.issued) {
          ph.issued = true
          ph.t0 = Date.now()
          ph.stage = 'wait'
          return toolCall('team_delegate', {
            rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.lane.tok),
            delegationInstanceId: inst, label: ph.lane.label, prompt: ph.lane.marker, async: true,
          })
        }
        const pendingF = settledPending(req)
        if (pendingF.length > 0) {
          for (const tk of pendingF) collected.add(tk)
          if (pendingF.includes(tokens(`${ph.lane.tok}-f1`))) ph.stage = 'done'
          return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pendingF })
        }
        if (ph.stage === 'wait') {
          if (Date.now() - ph.t0 < 35_000) return { kind: 'text', content: 'U74A_KL_WAIT' }
          ph.stage = 'follow'
          return toolCall('team_delegate', {
            rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`${ph.lane.tok}-f1`),
            delegationInstanceId: inst, label: `${String(ph.lane.label)}-follow`,
            prompt: `${String(ph.lane.marker)} ${markers.T_KLFOLLOW}`, async: true,
          })
        }
        if (ph.stage === 'follow') return { kind: 'text', content: 'U74A_KL_WAIT_FOLLOW' }
        ph.issued = false; ph.stage = undefined; phase += 1; fenceRounds = 0
        continue
      }
      if (ph.kind === 'delegate' || ph.kind === 'delegate-ids') {
        if (!ph.issued) {
          ph.issued = true
          let prompt = ph.lane.marker
          if (ph.kind === 'delegate-ids') {
            const m = /U74A_BG_DONE id=([A-Za-z0-9_.-]+)/.exec(transcriptText(req))
            // 'none' honestly forwards the bg lane's failure: the trio then
            // answers a typed refusal and the judge reads THAT (no fake id).
            prompt = `${ph.lane.marker} job_id=${m === null ? 'none' : m[1]}`
          }
          return toolCall('team_delegate', {
            rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.lane.tok),
            delegationInstanceId: inst, label: `u74a-${ph.lane.tok}`, prompt, async: true,
          })
        }
        const pending = settledPending(req)
        if (pending.length > 0) {
          for (const tk of pending) collected.add(tk)
          return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
        }
        if (leaderHasMarker(req, ph.lane.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
        fenceRounds += 1
        if (fenceRounds <= 10) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.lane.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.lane.tok)] })
        fenceRounds = 0
        return { kind: 'text', content: `U74A_FENCE_HOLD_${ph.lane.fence}` }
      }
      phase += 1
    }
    return { kind: 'text', content: 'U74A_L1_DONE' }
  }
  decide.__state = () => ({ phase, lanes: LANES.map((l) => l.tok) })
  return decide
}

/** Ordered assistant-tool_use <-> tool_result pairs (the u6-jobs shape,
 *  kept local so this file owns its lane arithmetic; byte-identical logic
 *  to jobs-family-bridge's consumer-side helper). */
function laneToolExchanges(req) {
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
        out.push({ name: pending.get(id) ?? null, args: argsOf.get(id) ?? null, result: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('') })
      }
    }
  }
  return out
}
export { laneToolExchanges as u74aToolExchanges }

// ── judge (the SAME pure function the reconstruct consumer uses) ────────────
/**
 * THE shared C2 verdict function for the u7-4a suite: every case row is a
 * pure function of the recorded digest (the runner measures; this judges).
 *
 * Digest shape (MAIN; every field MEASURED, absent = unknown):
 *   plant:false; claims{bg,list,done,ctl}; jobIds[] (bg lane);
 *   bgReceipt            the bg lane's bash tool_result text
 *   outResult            lane-out job_output(wait:true) answer
 *   listJobId listResult lane-list ids/answer
 *   killLiveJobId killLiveKill killLiveOutEarly killLiveOutLate
 *   killDoneJobId killDoneOutput killDoneKill
 *   foreignOut foreignPlanted
 *   denyRow foreignDenyBash foreignList foreignDenyJobIds (pilot C2 deny-leg)
 *   ctlResult rootKernelMentions
 *   kernelHits {pattern:{count}} (boot-log scans, redacted)
 *   attributedLog []     'a5bg: attributed hostJobId=…' lines (redacted)
 *   askRows [{requestId,targetInstanceId,resolutions}] (public-seam approvals)
 *   askResolutionsTotal  n; trioControlRows []; armingRows []
 *   settle {killLiveLines, plantedLines}; startedJobReceipts n; memberIds []
 *
 * PLANT digest: plant:true + bgReceipt/kernelHits/jobIds/startedJobReceipts.
 *
 * @param {object} d
 * @param {boolean} hostAlive
 * @param {object} [opts]
 * @param {object} [opts.sandboxPreflight] the pre-flight record from
 *        `lib/host-sandbox-assets.mjs` (measured BEFORE the first Host start).
 *        It moves ONE verdict, and only through the conjunction in
 *        `nativeConfinementEnvBlock`: `u74a:native-ctl-unaffected` may be
 *        ENV_BLOCK (never PASS) when the host's own probe said `unusable` AND
 *        this lane observed the host's typed "no sandbox backend is usable"
 *        refusal. Without that conjunction — or with no pre-flight at all —
 *        the leg is judged exactly as before.
 * @returns {Array<[string, 'PASS'|'FAIL'|'ENV_BLOCK', object]>}
 */
export function judgeU74a(d, hostAlive, opts = {}) {
  const out = []
  const add = (id, ok, detail) => out.push([id, ok ? 'PASS' : 'FAIL', detail])
  const k = d.kernelHits ?? {}
  const count = (p) => k[p]?.count ?? 0
  if (d.plant === true) {
    // (g) PLANT: backgroundJobs ABSENT — the byte-identical by-name refusal
    // and no producer, so the trio has nothing to manage.
    const bg = String(d.bgReceipt ?? '')
    add('u74a:plant-refused', bg.includes('code=background-not-supported')
      && bg.includes('refused by name, never reinterpreted')
      && !bg.includes('started background job')
      && d.laneDone?.bg === true, {
      bgHead: bg.slice(0, 200),
      startedJobReceipts: d.startedJobReceipts ?? null,
      note: 'MEASURED: the identical worker background call on the plant World answers the UNCONFIGURED row shape byte-for-byte (a5p5-refused kind=backend-failed code=background-not-supported, refused by name, never reinterpreted as a foreground run); the DONE marker arrived so the lane ran',
    })
    add('u74a:plant-no-producer', count('a5bg:') === 0 && count('a5bg: producer-mounted') === 0, {
      kernelHits: Object.fromEntries(Object.keys(k).map((p) => [p, k[p].count])),
      note: 'no a5bg line of ANY shape exists in the host log: with backgroundJobs absent the producer never mounts (zero flip by absence)',
    })
    add('u74a:plant-no-jobs', (d.jobIds ?? []).length === 0
      && (d.startedJobReceipts ?? -1) === 0
      && (d.attributedLog ?? []).length === 0, {
      jobIds: d.jobIds ?? null,
      startedJobReceipts: d.startedJobReceipts ?? null,
      note: 'no host job id exists anywhere (no receipt, no attribution): the trio on this World can manage nothing because NOTHING was born',
    })
    return out
  }
  // ── MAIN ─────────────────────────────────────────────────────────────────
  // 1) mounted: the trio + the governed bash takeover + the background arm
  //    all mounted on the LIVE host, with zero registration refusals.
  add('u74a:mounted', hostAlive === true
    && count('a5g7: placement-feed rows=') > 0
    && count('job_output') > 0
    && count('a5bg: producer-mounted') > 0
    && count('a5-plane: mount-REFUSED') === 0
    && count('a5-plane: placement-REFUSED') === 0
    && count('PLANE_KERNEL_UNAVAILABLE') === 0
    && count('PLANE_JOBS_REGISTRATION_REFUSED') === 0
    && count('PLANE_PROCESS_REGISTRATION_REFUSED') === 0, {
    kernelHits: Object.fromEntries(Object.keys(k).map((p) => [p, k[p].count])),
    note: 'ONE kernel: read + the governed bash takeover row + the trio (first named bridge) + the background producer armed on the shell row; every refusal names itself in the log',
  })
  // 2) receipt carries the REAL host job id (server-side attribution log
  //    names the SAME id — a transcript echo cannot fabricate the a5bg line).
  const jobId = d.jobIds?.[0] ?? null
  const attributedFor = (id) => (d.attributedLog ?? []).filter((l) => String(l).includes(String(id))).length
  add('u74a:bg-receipt-carries-host-job-id', jobId !== null
    && String(d.bgReceipt ?? '').includes(`started background job ${jobId}`)
    && !String(d.bgReceipt ?? '').includes('refused:'), {
    jobId,
    bgHead: String(d.bgReceipt ?? '').slice(0, 200),
    note: 'the governed receipt carries the host job id in the producer wording (started background job <id> (governed: …))',
  })
  add('u74a:attributed-server-side', jobId !== null && attributedFor(jobId) >= 1, {
    attributionsForJob: attributedFor(jobId),
    attributedLines: (d.attributedLog ?? []).slice(0, 4),
    note: 'the host log line a5bg: attributed hostJobId=<id> (the producer\'s own echo) proves the gateway admit ran for THIS job — measured server-side, not from the transcript',
  })
  // 3) (a) RING BYTES via job_output(wait:true): the claim the REAL confined
  //    child wrote to stdout, answered by the host registry + its status.
  const out1 = String(d.outResult ?? '')
  add('u74a:ring-bytes-via-job-output-wait', out1.includes(d.claims?.bg ?? '\u0000')
    && out1.includes('[status')
    && !out1.includes('refused:'), {
    outHead: out1.slice(0, 200),
    jobId,
    note: 'the trio read the RING bytes the real confined process wrote (host-buffered: no transcript echo imitates them) plus the host status line; zero refusal',
  })
  // 4) (b) job_list shows the attributed row to the OWNER.
  const list1 = String(d.listResult ?? '')
  add('u74a:list-shows-owner', d.listJobId != null
    && list1.includes(String(d.listJobId))
    && list1.includes('[bash]')
    && !list1.includes('refused:'), {
    listJobId: d.listJobId ?? null,
    listRow: list1.split('\n').find((l) => String(l).includes(String(d.listJobId ?? '\u0000'))) ?? null,
    note: 'the owner\'s governed job_list surfaces its attributed row (id [bash] status — label, the byte-identical bridge body)',
  })
  // 5) (d1) kill of a LIVE job = the REQUEST form, never a settlement word.
  const kl = String(d.killLiveKill ?? '')
  const klEarly = String(d.killLiveOutEarly ?? '')
  const klLate = d.killLiveOutLate == null ? null : String(d.killLiveOutLate)
  add('u74a:kill-live-requested', kl.includes('requested cancellation of job')
    && !kl.includes('already finished')
    && !kl.includes('refused:')
    && d.killLiveJobId != null
    // early read (right after the REQUEST): the ring answers, warm present,
    // FINAL not yet possible either way.
    && klEarly.includes(d.claims?.liveWarm ?? '\u0000')
    && !klEarly.includes(d.claims?.liveFinal ?? '\u0000')
    // DECISIVE late read (the leader's follow-up past the FINAL window).
    // job_output reads are DELTA reads (output since the previous read):
    // the early read consumed the warm bytes, so the late read answers
    // '(no new output)' — an EMPTY delta past the window in which a leaked
    // job WOULD have printed FINAL, plus the host's own terminal status
    // word, is the proof the cancellation really settled the process.
    && klLate !== null
    && !klLate.includes(d.claims?.liveFinal ?? '\u0000')
    && (klLate.includes('(no new output)') || /status:\s*(killed|cancelled|terminated)/.test(klLate))
    && !klLate.includes('refused:'), {
    killLive: kl.slice(0, 160),
    killLiveJobId: d.killLiveJobId ?? null,
    killLiveEarlyOut: klEarly.slice(0, 140),
    killLiveLateOut: klLate === null ? null : klLate.slice(0, 140),
    lateReadHappened: klLate !== null,
    killLiveHostEvents: d.settle?.killLiveLines ?? null,
    note: 'host kill answered requested — a REQUEST on the gateway (noteKillRequested), cancel-requested != terminated (PR1 Gate R4 honesty); the decisive late DELTA read past the FINAL window is empty (no new output = the final bytes NEVER printed; a leaked job would print them) and the host status carries the terminal word; settle lines are detail only',
  })
  // 6) (d2) kill of a FINISHED job = the honest other form; the wait-read
  //    before it proves the job really settled (its claim bytes + status).
  const kd = String(d.killDoneKill ?? '')
  const kdOut = String(d.killDoneOutput ?? '')
  add('u74a:kill-finished-honest', kd.includes('already finished')
    && !kd.includes('requested cancellation')
    && kdOut.includes(d.claims?.done ?? '\u0000')
    && !kd.includes('refused:'), {
    killDone: kd.slice(0, 160),
    killDoneOutHead: kdOut.slice(0, 200),
    killDoneJobId: d.killDoneJobId ?? null,
    note: 'the two kill forms never collapse: the finished job answers already-finished (settles nothing new) after its ring bytes + status proved the settle',
  })
  // 7) (c) foreign owner fence: typed owner-mismatch, ZERO reach (no ring
  //    bytes, no host status word, no kill vocabulary — the host was never
  //    consulted).
  const fo = String(d.foreignOut ?? '')
  add('u74a:foreign-cross-scope-refusal', fo.includes('refused:')
    && (fo.includes('unattributed-job') || fo.includes('owner-mismatch'))
    && !fo.includes(d.claims?.bg ?? '\u0000')
    && !fo.includes('[status')
    && !fo.includes('requested cancellation'), {
    foreignOut: fo.slice(0, 200),
    note: 'MEASURED LAW at this pin: the attribution ledger is MOUNT-SCOPED (boot 2: a foreign member reading the owner\'s REAL attributed id meets the typed unattributed-job refusal before any host reach — the owner-mismatch word does not exist in this bridge build); the zero-reach law holds: zero ring bytes, zero host status words, zero kill vocabulary',
  })
  // 7b) DENY-LANE honest zero (pilot C2 re-home, the J4 live shape): the
  //     foreign lane's OWN background birth arms its durable ask row, the
  //     RUNNER answers DENY through the public seam (window = lane ordering:
  //     it opens at KILLDONE_DONE and this lane is the only lane birthing
  //     after it; the witnesses below bind the answer to THIS leg). The
  //     call must answer the typed APPROVAL_DENIED (run8 landing
  //     discrimination: a shut-face code like IO_POLICY_UNSUPPORTED is never
  //     refusal evidence), spawn NOTHING (no receipt wording, no id minted
  //     anywhere in the lane), keep the foreign job_list an honest zero,
  //     never leak the owner's attributed row cross-scope, and never echo
  //     the birth claim.
  const fd = String(d.foreignDenyBash ?? '')
  const fl = String(d.foreignList ?? '')
  add('u74a:list-deny-leg-honest-zero', d.denyRow?.seen === true
    && d.denyRow?.denied === true
    && fd.includes('APPROVAL_DENIED')
    && !fd.includes('started background job')
    && !fd.includes(d.claims?.fdeny ?? '\u0000')
    && !fl.includes(d.claims?.fdeny ?? '\u0000')
    && fl.includes('(no background jobs)')
    && !fl.includes('started background job')
    && (d.jobIds ?? []).every((id) => !fl.includes(String(id)))
    && (d.foreignDenyJobIds ?? []).length === 0, {
    denyRow: d.denyRow ?? { seen: false },
    foreignDenyBash: fd.slice(0, 220),
    foreignList: fl.slice(0, 200),
    foreignDenyJobIds: (d.foreignDenyJobIds ?? []).slice(0, 4),
    note: 'the DENIER answered the foreign lane\'s OWN birth ask on the durable Control lane; typed APPROVAL_DENIED, zero spawn vocabulary, honest-zero list, no cross-scope leak, no id minted, claim bytes unechoed',
  })
  // 8) (e) CI-05 regression: the planted id is the typed unattributed-job
  //    refusal with ZERO host reach (no ring, no status word, no settle
  //    event naming it).
  const fp = String(d.foreignPlanted ?? '')
  add('u74a:planted-unattributed', fp.includes('refused: unattributed-job')
    && !fp.includes('[status')
    && !fp.includes('requested cancellation')
    && (d.settle?.plantedLines ?? -1) === 0, {
    foreignPlanted: fp.slice(0, 200),
    plantedSettleLines: d.settle?.plantedLines ?? null,
    note: 'the Team lane never carries an un-attributed id to the Host: typed, static-detail refusal before any host reach (CI-05); zero settle/cancel lines name the planted id',
  })
  // 9) (f) the un-governed NATIVE lane is untouched: boot-root foreground
  //    bash answers its claim natively, kernel words absent from its
  //    transcript (CI-03, the u6-proc ctl-leg shape).
  //    VERDICT FIDELITY (u7-sbx): when this leg fails, the FIRST question is
  //    whether the native lane could run at all. It is ENV_BLOCK exactly when
  //    the pre-flight probe of THIS host answered `unusable` and the lane
  //    observed the host's typed `SANDBOX_UNAVAILABLE` refusal — the recorded
  //    shape of a missing native asset (docs/TEST_METHODS.md §9), not a
  //    product regression. Every other failure stays FAIL, and ENV_BLOCK is
  //    never a PASS.
  const ctl = String(d.ctlResult ?? '')
  const ctlOk = ctl.includes(d.claims?.ctl ?? '\u0000')
    && (d.rootKernelMentions ?? -1) === 0
    && d.laneDone?.ctl === true
  const nativeEnvBlock = ctlOk ? null : nativeConfinementEnvBlock({ observedText: ctl, preflight: opts.sandboxPreflight ?? null })
  out.push(['u74a:native-ctl-unaffected', ctlOk ? 'PASS' : (nativeEnvBlock === null ? 'FAIL' : 'ENV_BLOCK'), {
    ctlHead: ctl.slice(0, 200),
    rootKernelMentions: d.rootKernelMentions ?? null,
    ...(nativeEnvBlock ?? {}),
    note: ctlOk
      ? 'the boot-root session is not a Team mount: foreground native bash keeps its byte-identical posture, the kernel never spoke about those calls'
      : (nativeEnvBlock === null
        ? 'the boot-root native lane did not answer its claim (functional failure of the native control leg)'
        : 'ENV_BLOCK: ' + nativeEnvBlock.note),
  }])
  // 10) approvals: every durable ask row was a bash ask, each settled EXACTLY
  //     ONCE through the public seam; the trio opened ZERO rows (the
  //     no-second-ledger law) and no foreign arming row was invented.
  const askRows = d.askRows ?? []
  const settledOk = askRows.filter((r) => (r.resolutions ?? 0) === 1 && r.ok === true).length
  add('u74a:exactly-once-approvals', askRows.length >= 1
    && settledOk === askRows.length
    && askRows.every((r) => (r.resolutions ?? 0) === 1)
    && (d.trioControlRows ?? []).length === 0
    && askRows.every((r) => r.targetInstanceId == null || (d.memberIds ?? []).includes(String(r.targetInstanceId))), {
    askRows: askRows.slice(0, 8),
    askResolutionsTotal: d.askResolutionsTotal ?? null,
    trioControlRows: (d.trioControlRows ?? []).slice(0, 5),
    armingRows: (d.armingRows ?? []).slice(0, 5),
    note: 'the governed bash lane ran on approved asks only, each durable row settled exactly once via the PUBLIC team.resolveControl v4 seam; the trio touched no ledger (zero job_* control rows)',
  })
  return out
}
