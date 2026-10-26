/**
 * u6-proc-assembly.mjs — world materialization for the `u6-proc` suite
 * (U6 PR3 C2): the production Team row WITH a live confined shell provider,
 * the p6t6 observer, one agent preset, blueprints and the mocked
 * leader/member scripts — built ONLY on public seams (the profile-patch
 * layer, the /team-remote HTTP surface, the mock provider), the exact
 * discipline u6-fs-assembly.mjs (PR2) established for the read lane.
 *
 * The shapes are copies/adaptations of the proven u6-fs assembly + the
 * c1-leader-approval-smoke notification lane (ask →
 * `[team-control requestId=…]` → team_list_pending_control →
 * team_resolve_control). Deviations are commented where they carry meaning.
 *
 * Lane truth this suite measures (ARC-B at the Host): the governed
 * `team_bash` row runs through the SAME kernel instance as the governed
 * read row (ONE ledger); the shell ask lane is PA-owned, the durable
 * Control request resolves to a grant the kernel CONSUMES EXACTLY ONCE, and
 * a shell effect the policy denies (or a plant the guard holds) has ZERO
 * spawned processes — read off DISK, never off the transcript.
 *
 * Nothing in this module boots or tears down anything — the runner owns the
 * World lifecycle. This module only computes MATERIAL and the decide script.
 *
 * @module tests/world-factory/lib/u6-proc-assembly
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'

/** The probe's own tool must NEVER enter builtinToolDeny — it is a leg actor. */
export const PROC_PROBE_TOOL_NAME = 'u6proc_probe'
/** The guard-off positive-channel tool the probe row registers ON COMMAND. */
export const PROC_CHANNEL_TOOL_NAME = 'u6proc_channel'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/**
 * @param {{repoRoot: string, home: string, runStamp: string, reportDir: string}} opts
 */
export function createProcAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  // The Landlock pre-launcher the confined provider re-hashes at every spawn
  // (double-gate: config sha pin + byte-hash at Gate 0c). Same file the C1
  // suites pin (a5-m1-bash-c1.test.ts): the REPO path, hashed at materialize
  // time so a tampered byte shows as CFS_PROVIDER_REFUSED, never as a spawn.
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  // HASH AT CONFIG TIME, NOT CONSTRUCTION TIME: the offline shape tests may
  // build an assembly for a notional repo; the real hash happens when
  // teamRowConfig() runs on the booted World's tree.
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const BASE_PRESET_ID = `u6proc-base-${rs}`
  const BP_ANCHOR_ID = 'team.u6proc.anchor'
  const BP_MAIN_ID = 'team.u6proc.main'
  const ROOT = `session-u6proc-root-${rs}`
  const CREATE_ROOT = `session-u6proc-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')

  // Effect oracles. Every one is a DISK FACT — the verdict never trusts the
  // transcript alone for an effect claim (review-r1 F5 lesson from PR2).
  const wsReal = () => {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }
  const files = {
    mask: join(workspaceDir, 'u6proc-mask.txt'),
    pos: join(workspaceDir, 'u6proc-pos.txt'),
    deny: join(workspaceDir, 'u6proc-deny.txt'),
    swap: join(workspaceDir, 'u6proc-swap.txt'),
    late: join(workspaceDir, 'u6proc-late.txt'),
    ctl: join(workspaceDir, 'u6proc-ctl.txt'),
    // Review-r1 positive arm: the ONE governed bash call the World
    // AUTHORISES (ask lane -> real pending Control row -> real resolve
    // through the public seam -> kernel consumeOnce -> real Landlock
    // spawn). Its disk marker is the INDEPENDENT oracle for the effect:
    // spawn-once is decided by what the FILE says, never by a tool return.
    appr: join(workspaceDir, 'u6proc-appr.txt'),
  }
  const claims = {
    mask: `U6PROC_MASK_${rs}`,
    pos: `U6PROC_POS_${rs}`,
    deny: `U6PROC_DENY_${rs}`,
    swap: `U6PROC_SWAP_${rs}`,
    late: 'U6PROC_LATE_EMITTED',
    ctl: `U6PROC_CTL_${rs}`,
    appr: `U6PROC_APPR_${rs}`,
  }
  const markers = {
    MK_DISC: `U6PROC_DISC_${rs}`,
    MK_L1: `U6PROC_L1_${rs}`,
    MK_MASK: `U6PROC_MK_MASK_${rs}`,
    MK_DENY: `U6PROC_MK_DENY_${rs}`,
    MK_APPR: `U6PROC_MK_APPR_${rs}`,
    T_SWAP: `U6PROC_TRIGGER_SWAP_${rs}`,
    T_RESTORE: `U6PROC_TRIGGER_RESTORE_${rs}`,
    T_CHANNEL: `U6PROC_TRIGGER_CHANNEL_${rs}`,
    T_CHANNELCALL: `U6PROC_TRIGGER_CHANNELCALL_${rs}`,
    T_CTL: `U6PROC_TRIGGER_CTL_${rs}`,
  }
  const tokens = (n) => `u6proc-${n}-${rs}`
  // Commands: append-mode writers under the canonical plane root (the
  // confined provider validates containment against the REALPATH, so the
  // command paths use the resolved root like the provider does).
  const cmds = () => {
    const root = wsReal()
    return {
      mask: `printf '${claims.mask}\\n' >> '${files.mask.replace(workspaceDir, root)}' && echo mask-lane-ran`,
      pos: `printf '${claims.pos}\\n' >> '${files.pos.replace(workspaceDir, root)}' && cat '${files.pos.replace(workspaceDir, root)}'`,
      deny: `printf '${claims.deny}\\n' >> '${files.deny.replace(workspaceDir, root)}' && echo deny-lane-ran`,
      swap: `printf '${claims.swap}\\n' >> '${files.swap.replace(workspaceDir, root)}' && cat '${files.swap.replace(workspaceDir, root)}'`,
      late: `sleep 6; printf '${claims.late}\\n' >> '${files.late.replace(workspaceDir, root)}' && echo late-done`,
      ctl: `printf '${claims.ctl}\\n' >> '${files.ctl.replace(workspaceDir, root)}' && cat '${files.ctl.replace(workspaceDir, root)}'`,
      appr: `printf '${claims.appr}\\n' >> '${files.appr.replace(workspaceDir, root)}' && echo appr-lane-ran`,
    }
  }

  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }
  const PLANE_REALM_ID = `u6proc-realm-${rs}`

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
      staticModel: { provider: 'deepseek-official', model: 'u6proc-model' },
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
      // The canonical plane mount WITH the live confined shell backend (the
      // C1 twin is a5-m1-bash-c1.test.ts / glue7). `confinedProvider` absent
      // would land the shell row on the typed shut face ("the closed world
      // invents nothing"); present, it is pair-verified (trustRoot/
      // launcherSha256/launcherPath trio) at BOTH config time and spawn
      // time. cwdRoot = fsInstance.rootDir = the canonical workspace root.
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
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
    `  persona: "You are the leader of the u6proc assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the u6proc assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `shell` carries default deny + an explicit ASK-lane
   * shell rule ({tool: bash, resource: {kind: any}} — the only shell form
   * legal on a member: allow-lane `any` is member-forbidden, exact/subtree
   * are shell-forbidden). `strict` carries default deny and names NOTHING:
   * the refusal leg then exercises the kernel's typed default-deny word
   * BEFORE any spawn (u6fs-measured law). NO member ever gets a shell allow.
   * The leader carries the closed approval-loop surface
   * (team_list_pending_control + team_resolve_control) and its envelope
   * carries `resolve-control` — exposure without the token is a tool the
   * runtime rejects; the token without exposure an authority the model
   * cannot reach (blueprint-authoring §5.3: BOTH are required).
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u6proc assembly team. ${markers.MK_L1} drives your chain: create one ask-lane member, one strict member, and one ask-approve member, run the delegated scripts as instructed, then run your OWN three exec commands exactly as instructed, one at a time.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      '        - team_list_pending_control', '        - team_resolve_control',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny',
      // LEADER exec autonomy, DUAL-GATED (exec-autonomy-contract, user
      // ruling 2026-09-18; the schema permits an allow-lane shell rule on
      // LEADER templates ONLY, and the runtime additionally requires the
      // teamEnvelope exec token below — both halves are present here).
      // Measured at run 4: a leader-class shell ASK is ALSO born-terminal
      // (the fingerprint resource pins requiredAuthority = human-admin for
      // the approval walk — pinned grammar, a4p7-v3-cutover-acceptance
      // :1797) and Alpha.4 has no Admin resolver (ADR A1-12). So the
      // governed spawn lane that EXISTS at this baseline is the leader
      // allow-lane through the kernel; the ask door is the suite's
      // fail-closed proof (member AND leader ask arms), and the
      // approve/consume mechanics are proven at the C1 production seam
      // with the PA port (BL01-2).
      '      allow:',
      '        - tool: bash', '          resource:', '            kind: any',
      '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - resolve-control',
      // exec-autonomy dual gate HALF 2 (admission/envelope.ts:182
      // ENVELOPE_EXEC_OPS): the envelope 'bash' token; no leader-template
      // memberEnvelopes entry exists, so entry tightening is skipped
      // (leaderExecEnvelopeOps: absent entry = no extra bound) — token +
      // leader allow-lane rule = the full legal dual gate.
      '    - bash', '  deny: []',
      'members:',
      '  - templateId: shell', '    displayName: "u6proc ask-lane worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6proc assembly team (ask-lane shell). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: deny', '        allow: []',
      '        ask:',
      '          - tool: bash', '            resource:', '              kind: any',
      '        deny: []',
      '  - templateId: strict', '    displayName: "u6proc default-deny worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6proc assembly team (default-deny lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: deny', '        allow: []', '        ask: []',
      '        deny: []',
      // Review-r1 FIXTURE template — test-profile blueprint DATA only, no
      // product code involved. Policy shape is the one BL01 pins at the C1
      // production seam (a5-m1-bash-c1 world law): default ASK, no shell
      // rule anywhere. A shell call from this member is an ASK decision
      // (not a policy deny): the tool-admission plan mints with NO R-1a
      // owner floor (no deny owner), over the plane's empty narrowing
      // documents the fingerprint rung resolves to the rung ABOVE the
      // member beneficiary — a real PENDING Control row, resolvable
      // through the real Control/ask path (public team.resolveControl v4,
      // the GUI's own human lane). Approval -> kernel consumeOnce (one
      // port call) -> real confined spawn; the disk marker under the
      // world workspace is the independent-oracle effect fact.
      '  - templateId: asker', '    displayName: "u6proc ask-approve worker"',
      `    persona: ${JSON.stringify('You are a worker of the u6proc assembly team (ask-approve lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []',
      '        deny: []',
      'memberEnvelopes:',
      '  - templateId: shell', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      // The asker envelope NAMES `request-control` (closed ALL_MUTATION_OPS
      // vocabulary). Full boundary law (admission/envelope.ts:100-119,
      // measured live u6prc6-8): the member's effective envelope is
      // `blueprint.teamEnvelope.allow` NARROWED by this entry — template
      // entries NEVER widen the team-root allow list, so this line alone
      // is necessary but NOT sufficient: the canary teamEnvelope.allow
      // must name `request-control` too (u6prc8 measured the
      // template-only addition filtered at the team root: 'operation
      // request-control is outside the caller's mutation envelope').
      // When the team-root line lands, ALSO add a leader memberEnvelopes
      // entry pinning the leader's OLD bounds exactly (incl. the `bash`
      // exec token — the leader has no entry today, tightening skipped
      // by design) so the leader lanes stay byte-identical. Fixture DATA
      // through the blueprint seam only; test profile; names nothing
      // beyond the closed vocabulary the roles already own.
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
        id: BASE_PRESET_ID, displayName: 'u6proc base',
        description: `u6proc base preset (${runStamp}) = smoke + tool-fs-search`,
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

  /** Fresh disk read of one effect oracle; null = never spawned. */
  function readEffect(which) {
    try { return existsSync(files[which]) ? readFileSync(files[which], 'utf8') : null } catch { return null }
  }
  function effectLines(which) {
    const raw = readEffect(which)
    return raw === null ? 0 : raw.split('\n').filter((l) => l.trim() !== '').length
  }

  return {
    rs,
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    LAUNCHER, launcherSha,
    blueprintDir, workspaceDir, files, claims, markers, tokens, cmds,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readEffect, effectLines,
  }
}

// ── decide script (lane discrimination + leader phase machine) ─────────────
// LANE TRUTH (measured, run 3 — disclosed in the PR body): at this baseline
// a MEMBER shell-class ASK is required by the rung that owns the exec
// envelope = HUMAN ADMIN, and no Human Admin resolver exists (ADR A1-12):
// the control case closes SYNCHRONOUSLY with a born-terminal deny
// (`APPROVAL_DENIED`, zero processes). That is a fail-closed product LAW,
// so the suite PROVES it (case proc:member-ask-born-terminal) instead of
// pretending otherwise. The spawnable approval lane this baseline does have
// is the LEADER exec autonomy rule: a leader-class ask rides user-approval —
// the HUMAN USER rung — and the suite takes that role through the public
// `team.resolveControl` remote seam (what the GUI calls), which is exactly
// the product's human lane. The grant the approval mints is then consumed
// EXACTLY ONCE by the kernel (the durable `consumptions` ledger is read back
// through the p6t6 observer), and the SAME requestId resolved a SECOND time
// through the seam is refused (durable exactly-once) — the replay leg.
import {
  toolCall, messagesOf, textOf, lastUserTextOfStatic, extractInstanceId,
} from './u6-fs-assembly.mjs'

/**
 * @param {{assembly: object, readProbeLedger: () => Array<object>}} opts
 */
export function makeProcDecide({ assembly, readProbeLedger = () => [] }) {
  const { tokens, markers, claims } = assembly
  const cmds = assembly.cmds()
  const ids = {}
  const steps = { mask: 0, deny: 0, appr: 0 }
  const trigState = {}
  const PHASES = [
    { kind: 'create', template: 'shell', tok: 'c1', label: 'proc-shell' },
    { kind: 'create', template: 'strict', tok: 'c2', label: 'proc-strict' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_MASK, which: 'shell', fence: 'U6PROC_MASK_DONE' },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_DENY, which: 'strict', fence: 'U6PROC_DENY_DONE' },
    // Review-r1 positive arm: ask-lane member (default:ask, no shell rule).
    // Its team_bash mints a REAL pending Control row; the runner settles it
    // through the public team.resolveControl seam while the call blocks;
    // the row then executes ONCE through the kernel-consumed grant, and the
    // member IMMEDIATELY re-issues the identical command (same approval-case
    // identity) — the in-world replay attempt.
    { kind: 'create', template: 'asker', tok: 'c3', label: 'proc-asker' },
    { kind: 'delegate', tok: 'd3', prompt: markers.MK_APPR, which: 'asker', fence: 'U6PROC_APPR_DONE' },
    // leader exec lane: three OWN team_bash calls; every call blocks on its
    // user-approval request until the runner (Human-User seam) settles it.
    { kind: 'leader-bash', cmd: cmds.pos, claim: claims.pos, done: 'U6PROC_POS_DONE' },
    // gate: the runner's swap plant must be PROVEN in the probe ledger
    // before the governed post-plant exec runs (b5 lesson: gates open on the
    // probe's REAL ledger only).
    { kind: 'gate', probe: (rows) => rows.some((r) => r.leg === 'spoof-attempt' && r.trigger === 'probe-body') },
    { kind: 'leader-bash', cmd: cmds.swap, claim: claims.swap, done: 'U6PROC_SWAP_DONE' },
    { kind: 'leader-bash', cmd: cmds.late, claim: claims.late, done: 'U6PROC_LATE_DONE', timeout: 1500 },
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
    if (lu.includes(markers.T_SWAP)) return 'trigger-swap'
    if (lu.includes(markers.T_RESTORE)) return 'trigger-restore'
    if (lu.includes(markers.T_CHANNEL)) return 'trigger-channel'
    if (lu.includes(markers.T_CHANNELCALL)) return 'trigger-channelcall'
    if (lu.includes(markers.T_CTL)) return 'trigger-ctl'
    if (lu.includes(markers.MK_DISC)) return 'disc'
    const ut = userTextOf(req)
    // member lanes FIRST: a member carries its delegation token text in
    // EVERY turn of its transcript (the delegation prompt is the session's
    // first user message), so the token test is airtight for members.
    if (ut.includes(`[team-work requestToken=${tokens('d3')}`)) return 'appr'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'deny'
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'mask'
    // tool-close routing BEFORE the settled/leader heuristics: once any
    // delegation has settled, EVERY later leader turn carries the settled
    // notice — routing on it first would starve the leader-bash closes.
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool === 'u6proc_probe' || tool === 'u6proc_channel') return 'trigger-close'
      if (tool === 'bash') return 'ctl-close'
      // a team_bash tool_result without a member token can only be the
      // LEADER exec lane closing (member turns were routed above).
      if (tool === 'team_bash') return 'leader-bash-close'
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes('U6PROC_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
  const leaderHasMarker = (req, marker) => messagesOf(req).map(textOf).join('\n').includes(marker)

  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u6proc assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U6PROC_NOOP_DONE' }
    if (lane === 'trigger-close') return { kind: 'text', content: 'U6PROC_TRIGGER_DONE' }
    if (lane === 'ctl-close') return { kind: 'text', content: 'U6PROC_CTL_RAN' }
    // ── boot-root trigger lanes (ungoverned session; the plant + control arms)
    if (lane === 'trigger-swap' || lane === 'trigger-restore' || lane === 'trigger-channel') {
      const st = trigState[lane] ?? 'fresh'
      trigState[lane] = 'issued'
      if (st === 'fresh') {
        const action = lane === 'trigger-swap' ? 'swap' : lane === 'trigger-restore' ? 'restore' : 'channel'
        return toolCall('u6proc_probe', { action, tag: lane })
      }
      return { kind: 'text', content: 'U6PROC_TRIGGER_DONE' }
    }
    if (lane === 'trigger-channelcall') {
      const st = trigState[lane] ?? 'fresh'
      trigState[lane] = 'issued'
      if (st === 'fresh') return toolCall('u6proc_channel', {})
      return { kind: 'text', content: 'U6PROC_CHANNELCALL_DONE' }
    }
    if (lane === 'trigger-ctl') {
      const st = trigState[lane] ?? 'fresh'
      trigState[lane] = 'issued'
      if (st === 'fresh') return toolCall('bash', { command: cmds.ctl })
      return { kind: 'text', content: 'U6PROC_CTL_RAN' }
    }
    // ── member lanes (refusal lanes at this baseline): one team_bash call,
    // then DONE (the refusal text is what the fence carries back).
    if (lane === 'mask') {
      const step = steps.mask
      steps.mask += 1
      if (step === 0) return toolCall('team_bash', { command: cmds.mask })
      return { kind: 'text', content: 'U6PROC_MASK_DONE' }
    }
    if (lane === 'deny') {
      const step = steps.deny
      steps.deny += 1
      if (step === 0) return toolCall('team_bash', { command: cmds.deny })
      return { kind: 'text', content: 'U6PROC_DENY_DONE' }
    }
    // Review-r1 positive lane: call #1 blocks on the real pending ask (the
    // runner settles it via the public seam); call #2 is the in-world
    // REPLAY of the same approval-case identity, expected refused. DONE
    // carries the fence only after BOTH results are back.
    if (lane === 'appr') {
      const step = steps.appr
      steps.appr += 1
      if (step === 0 || step === 1) return toolCall('team_bash', { command: cmds.appr })
      return { kind: 'text', content: 'U6PROC_APPR_DONE' }
    }
    // ── leader exec-lane close: the team_bash tool result for the
    // currently-open leader-bash phase closes it with its DONE text.
    if (lane === 'leader-bash-close') {
      const ph = PHASES[phase]
      if (ph !== undefined && ph.kind === 'leader-bash' && ph.issued) {
        ph.issued = false
        phase += 1
        fenceRounds = 0
        return { kind: 'text', content: ph.done }
      }
      return { kind: 'text', content: 'U6PROC_LANE_DONE' }
    }
    // ── leader lane: the PHASES script
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')))
      .filter((x) => x !== null))]
    if (ids.shell === undefined && seen.length >= 2) { ids.shell = seen[0]; ids.strict = seen[1] }
    if (ids.asker === undefined && seen.length >= 3) { ids.asker = seen[2] }
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (ph.kind === 'gate') {
        if (ph.probe(readProbeLedger())) { phase += 1; fenceRounds = 0; continue }
        return { kind: 'text', content: `U6PROC_GATE_HOLD_${String(phase)}` }
      }
      if (ph.kind === 'leader-bash') {
        if (!ph.issued) {
          ph.issued = true
          const args = { command: ph.cmd }
          if (ph.timeout !== undefined) args.timeout = ph.timeout
          return toolCall('team_bash', args)
        }
        return { kind: 'text', content: `U6PROC_EXEC_HOLD_${String(phase)}` }
      }
      if (!ph.issued) {
        const inst = ids[ph.which]
        if (inst === undefined) return { kind: 'text', content: `U6PROC_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `proc-${ph.tok}`, prompt: ph.prompt, async: true })
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
      return { kind: 'text', content: `U6PROC_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U6PROC_L1_DONE' }
  }
  decide.__state = () => ({ phase, ids, steps, lanes: trigState })
  return decide
}

/**
 * THE shared C2 verdict function for the u6-proc suite (single source for
 * the live run AND offline reconstruction from the written evidence — the
 * evidence JSON is its whole input; `hostAlive` is the one live fact, and
 * reconstruct passes it from the source record's clean finalization).
 *
 * Verdict law (measured, runs u6prc1-7 + the review-r1 positive arm):
 * every fail-closed arm measures its typed refusal BEFORE any process and
 * zero effect on disk. Attribution honesty (u6prc7 forensics — the bridge
 * observations ride the digest): the LIVE refusal cause on the pre-fix
 * lanes was the runtime boundary refusing the durable ask-row creation
 * (`request-control` outside the declared mutation envelope of those
 * templates — a declared allow list replaces the member base bounds), not
 * the shell-rung walk; the human-admin/ADR A1-12 born-terminal law and
 * the dual-gate downgrade are C1/offline claims, stated as such. The
 * review-r1 positive arm (asker template: default:ask, no shell rule,
 * envelope naming `request-control`) mints a REAL pending leader-approval
 * row; the World AUTHORISES that one call through the real Control/ask
 * path (public team.resolveControl v4) and the suite measures approve ->
 * consumeOnce once -> real spawn (independent disk oracle) -> replay
 * refused with zero second spawn (proc:approve-*). Nothing here claims a
 * law it does not measure.
 *
 * @param {object} d - the u6proc evidence digest.
 * @param {boolean} hostAlive - host liveness at judgment time.
 * @returns {Array<[string, string, object]>} `[id, verdict, detail]` rows
 *   for the ten post-mount cases (proc:mounted is boot-time-only and is
 *   added by the live run / carried by reconstruct).
 */
export function judgeU6Proc(d, hostAlive) {
  const out = []
  const refusal = /APPROVAL_DENIED|IO_POLICY_UNSUPPORTED|refused|denied|cannot be verified|CONTROL_/i
  const rows = (d.bashExecutes ?? []).map((e, i) => ({ ...e, result: (d.bashResults ?? [])[i] ?? null }))
  const rowsOf = (kind) => rows.filter((r) => String(r.command ?? '').includes(`U6PROC_${kind}_`))
  const typed = (r) => r.result !== null && refusal.test(String(r.result.head ?? ''))
  const absent = (k) => d.effects?.[k] === null || d.effects?.[k] === undefined
  // exec-door-fail-closed: every governed spawn attempt (the three leader
  // exec calls) was ANSWERED with a typed refusal BEFORE any process, and
  // no effect file exists. The dual gate failing closed is the gate
  // WORKING (fail-closed); the token-side inputs are blueprint-verified
  // offline (evidence dualgate probe: EXEC OPS ["bash"] + leader allow rule).
  const spawnRows = [...rowsOf('POS'), ...rowsOf('SWAP'), ...rowsOf('LATE')]
  const execOk = spawnRows.length >= 2
    && spawnRows.every((r) => typed(r) && String(r.result.head).includes('APPROVAL_DENIED'))
    && absent('pos') && absent('swap') && absent('late')
    && (d.effectLines?.pos ?? 0) === 0 && (d.effectLines?.swap ?? 0) === 0
  out.push(['proc:exec-door-fail-closed', execOk && hostAlive ? 'PASS' : 'FAIL', {
    spawnAttempts: spawnRows.map((r) => ({ command: String(r.command ?? '').slice(0, 40), head: String(r.result?.head ?? '').slice(0, 90) })),
    effectFilesAbsent: absent('pos') && absent('swap') && absent('late'),
    note: 'all three leader exec attempts answered typed APPROVAL_DENIED before any process, zero spawn effects on disk: the exec door is fail-closed on this world. The u6prc7 bridge forensics name the live refusal cause verbatim: the durable ask row was never opened (request-control outside the mutation envelope of this plane caller; the leader default also carries no exec token, so the allow lane downgrades to that same ask). Spawn mechanics are pinned at the C1 production seam (BL01-2).',
  }])
  // member-ask-born-terminal: ADR A1-12 fail-closed law measured live.
  // Since the review-r1 positive arm legitimately NOTIFIES the leader of a
  // real pending ask, the born-terminal evidence is per-ask-identity: the
  // MASK request's own requestId must never appear in a leader
  // notification turn (`notifTurnsMask`); digests predating the positive
  // arm fall back to the global counter (byte-equal law there — that world
  // had no pending ask at all).
  const maskRows = rowsOf('MASK')
  const maskAskId = ((d.controlDigest ?? {}).requests ?? [])
    .find((r) => String(r.summary ?? '').includes('U6PROC_MASK_'))?.requestId ?? null
  // R-U6P3-1 — the POSITIVE-READ PRECONDITION: a zero-row claim on the
  // control channel is evidence ONLY if that SAME channel has proven it
  // can see rows at all, i.e. it showed a row THIS run CREATED (the asker
  // lane's pending row). Digests without the controlRead block predate the
  // governed-session read and keep their legacy semantics byte-equal; on a
  // NEW digest, an unproven channel may never support a zero-row PASS —
  // "we saw nothing" on an instrument that never showed anything is not a
  // measurement.
  const positiveRead = (d.controlRead ?? null) === null ? null : d.controlRead?.positiveReadProven === true
  const neverNotified = typeof d.notifTurnsMask === 'number'
    ? d.notifTurnsMask === 0
    : (d.notifTurns ?? 1) === 0
  out.push(['proc:member-ask-born-terminal',
    maskRows.some((r) => /APPROVAL_DENIED/i.test(String(r.result?.head ?? '')))
    && absent('mask') && (d.claims?.mask ?? 1) === 0 && neverNotified
    && positiveRead !== false
    && hostAlive ? 'PASS' : 'FAIL', {
    maskResults: maskRows.map((r) => String(r.result?.head ?? '').slice(0, 140)),
    maskRequestId: maskAskId,
    controlChannelPositiveRead: positiveRead === null ? 'digest-predates-governed-read' : positiveRead,
    notifTurns: d.notifTurns ?? null,
    notifTurnsForMaskAsk: typeof d.notifTurnsMask === 'number' ? d.notifTurnsMask : 'digest-predates-per-ask-count',
    note: 'the shell-lane member ask settled as a synchronous terminal deny with zero spawn and no leader notification ever carrying this ask id. Measured live cause (u6prc7 forensics): the durable ask row was never opened — request-control is outside the declared envelope of this template (the declared allow list replaces the member base bounds). The shell fingerprint rung law remains a C1/offline claim, not what this live leg reached.',
  }])
  // deny-zero-spawn: typed default-deny refusal before any spawn.
  const denyRows = rowsOf('DENY')
  out.push(['proc:deny-zero-spawn',
    denyRows.length > 0 && denyRows.every((r) => /IO_POLICY_UNSUPPORTED/i.test(String(r.result?.head ?? '')))
    && absent('deny') && (d.claims?.deny ?? 1) === 0 && hostAlive ? 'PASS' : 'FAIL', {
    denyResults: denyRows.map((r) => String(r.result?.head ?? '').slice(0, 140)),
    denyClaimOccurrences: d.claims?.deny ?? null,
  }])
  // replay-settled-refusal: the durable Human-User seam refused the resolve
  // attempt with a typed error, and the durable control lane holds NOTHING
  // open at teardown (born-terminal closes never pend; nothing resolvable
  // twice because nothing ever settled resolvable). The grant-level
  // replay law (GRANT_REPLAY) is pinned in C1 kernel-flow C-legs.
  const ask = (d.resolvedAsks ?? []).find((a) => a.tag === 'replay') ?? null
  const openAtEnd = ((d.controlDigest ?? {}).requests ?? []).filter((r) => r.status === 'pending').length
  const replayOk = ask !== null && /"ok":false|"error"|CONTROL_/i.test(String(ask.firstBody ?? ''))
    && openAtEnd === 0 && positiveRead !== false && hostAlive
  out.push(['proc:replay-settled-refusal', replayOk ? 'PASS' : 'FAIL', {
    replayArm: { requestId: String(ask?.requestId ?? '').slice(0, 24), body: String(ask?.firstBody ?? '').slice(0, 160) },
    openRequestsAtTeardown: openAtEnd,
    decisions: ((d.controlDigest ?? {}).decisions ?? []).length,
    consumptions: ((d.controlDigest ?? {}).consumptions ?? []).length,
    note: 'the team.resolveControl seam refused with a typed error and no control case was ever left open (a born-terminal world keeps nothing pendable); the grant-level exactly-once twin is C1 kernel-flow C-legs',
  }])
  // spoof-refusal: the planted spoof NEVER ran (zero body markers) while the
  // attempt is ledger-proven; the post-plant governed call answered typed;
  // zero swap effect. (The channel case proves the plant channel is alive,
  // so this is refusal, not a dead lane.)
  const swapRows = rowsOf('SWAP')
  out.push(['proc:spoof-refusal',
    (d.spoofBodyMarkers ?? []).length === 0 && (d.swapAttempts ?? []).length > 0
    && swapRows.every((r) => typed(r)) && absent('swap') && hostAlive ? 'PASS' : 'FAIL', {
    spoofBodyMarkers: d.spoofBodyMarkers ?? [],
    swapAttempts: (d.swapAttempts ?? []).length,
    swapResults: swapRows.map((r) => String(r.result?.head ?? '').slice(0, 120)),
    note: 'either host law (registry scope or kernel identity) keeps the spoof body unrun; channel control proves the plant rides when ungoverned',
  }])
  out.push(['proc:guard-off-channel',
    (d.channelMarkers ?? []).length > 0
    && (Array.isArray(d.channelRows) ? d.channelRows.length > 0 : (d.channelRows ?? 0) > 0)
    ? 'PASS' : 'FAIL', {
    channelMarkers: d.channelMarkers ?? [],
    channelRows: Array.isArray(d.channelRows) ? d.channelRows.length : d.channelRows ?? 0,
  }])
  // late-call-refused: the timeout-lane call answered typed BEFORE any
  // process; the late file never exists. The timeout/terminate mechanics
  // (raceShellSettle tie law, kill-on-timeout, cancel honesty) are pinned
  // offline (glue7 + a5b3) — NOT claimed here.
  const lateRows = rowsOf('LATE')
  out.push(['proc:late-call-refused',
    lateRows.length > 0 && lateRows.every((r) => typed(r)) && absent('late') && hostAlive ? 'PASS' : 'FAIL', {
    lateResults: lateRows.map((r) => String(r.result?.head ?? '').slice(0, 120)),
    lateFileAbsent: absent('late'),
    note: 'the row-timeout command never reached a process (refused at admission); terminate mechanics carry their own offline pins (glue7 raceShellSettle, a5b3 cancel legs)',
  }])
  // ctl-native-untouched (CI-03): the boot-root native bash lane rode with
  // ZERO kernel mediation: no team_bash row ever carried the ctl claim, no
  // team effect exists; the HOST-native posture answered it (execution or
  // refusal are HOST-owned and equally fine for this claim).
  const ctlRows = rowsOf('CTL').filter((r) => r.tool === 'team_bash')
  out.push(['proc:ctl-native-untouched',
    (d.laneDone?.ctl ?? false) === true && ctlRows.length === 0 && absent('ctl') ? 'PASS' : 'FAIL', {
    ctlRequestedOnNativeLane: d.laneDone?.ctl ?? false,
    ctlTeamLaneRows: ctlRows.length,
    ctlEffect: !absent('ctl'),
    note: 'the model-facing close carried the NATIVE tool name; PR3 added zero mediation to the non-team lane (host-native permission posture is host-owned and disclosed)',
  }])
  // ── review-r1 POSITIVE arm (named fixture, tests/world-factory only): ──
  // ask-lane member -> REAL pending Control row -> resolve through the
  // public team.resolveControl v4 seam (the GUI's human lane) -> kernel
  // consumeOnce EXACTLY ONCE -> real confined spawn whose disk marker is
  // read by the INDEPENDENT oracle (this judge reads the evidence file,
  // the runner reads the DISK — never the tool return) -> host-native
  // SUCCESS settlement; then the in-world REPLAY (identical command, same
  // approval-case identity) must be refused with no second spawn, no
  // second decision, no second consumption.
  const ap = d.approveEvidence ?? null
  const apprRows = rowsOf('APPR')
  const apprCalls = apprRows.length
  const firstResult = String(apprRows[0]?.result?.head ?? '')
  const replayResult = String(apprRows[1]?.result?.head ?? '')
  const markerLines = d.effectLines?.appr ?? 0
  const resolveBodyOk = ap !== null && /"ok"\s*:\s*true/.test(String(ap.resolveBody ?? ''))
  out.push(['proc:approve-spawn-once',
    ap !== null && ap.pendingSeen === true && resolveBodyOk
    && apprCalls >= 2
    && /appr-lane-ran/.test(firstResult)
    && (ap.decisions ?? 0) === 1 && (ap.consumptions ?? 0) === 1
    && markerLines === 1 && typeof d.effects?.appr === 'string' && (d.effects?.appr ?? '').length > 0
    && hostAlive ? 'PASS' : 'FAIL', {
    pendingSeen: ap?.pendingSeen ?? false,
    pendingRequestId: String(ap?.requestId ?? '').slice(0, 40),
    pendingKind: ap?.kind ?? null,
    resolveBody: String(ap?.resolveBody ?? '').slice(0, 160),
    firstCallResult: firstResult.slice(0, 140),
    decisions: ap?.decisions ?? null,
    consumptions: ap?.consumptions ?? null,
    markerLinesFromDisk: markerLines,
    effectOnDisk: d.effects?.appr ?? null,
    note: ap === null
      ? 'digest predates the review-r1 positive arm'
      : 'the ask lane opened a REAL pending row; the public seam approved it; consumeOnce fired once (consumption rows); the confined spawn left exactly ONE marker line on disk — read independently of the tool return; the tool result carried the body (host-native SUCCESS settlement)',
  }])
  out.push(['proc:approve-replay-refused',
    ap !== null && apprCalls >= 2
    && /refused|denied|GRANT_|CONTROL_|APPROVAL_|not usable|already|consumed|settled/i.test(replayResult)
    && !/appr-lane-ran/.test(replayResult)
    && markerLines === 1
    && (ap.decisions ?? 0) === 1 && (ap.consumptions ?? 0) === 1
    && hostAlive ? 'PASS' : 'FAIL', {
    replayCallResult: replayResult.slice(0, 160),
    markerLinesAfterReplayFromDisk: markerLines,
    decisions: ap?.decisions ?? null,
    consumptions: ap?.consumptions ?? null,
    note: ap === null
      ? 'digest predates the review-r1 positive arm'
      : 'the identical second call re-presents the SAME approval-case identity (one-shot already consumed): typed refusal, ZERO second spawn (disk still holds one line), one decision row, one consumption row — the exactly-once law measured live; the kernel-level GRANT_REPLAY twin sits at the C1 seam',
  }])
  return out
}
