/**
 * u6-arc-d-assembly.mjs — world materialization for the `u6-arc-d` suite
 * (U6 PR6 C2 / ARC-D at the Host): the ADVERSARIAL laws proven offline at
 * the production seams (u6-pr6-arc-d-adversarial + u6-pr6-arc-d-matrix) get
 * their LIVE legs on a real Host — the same probe family PR5 shipped (zero
 * new family code is the claim: NOTHING about the family needed to change
 * to be attacked), driven by a probe row that carries the plants the FAMILY
 * side cannot itself carry (swap identity claim, scope spoof, replay of a
 * settled grant, teardown order).
 *
 * Verdict law (unchanged since PR2 review-r1 F5): DISK + LEDGER + HOST LOG,
 * never the model transcript. The judge below consumes ONLY data the runner
 * read from those channels; the offline leg of this suite (u6-arc-d.test
 * .mjs) mutates judge inputs and demands the verdicts move (§10.5-6).
 *
 * There is deliberately NO shadow-mode twin leg: the kernel computes refuse
 * verdicts in EVERY mode and the family's walk enforces its own kernel
 * regardless of mode, so a "blinded" second mount would refuse the same
 * walk and only masquerade as a passing sensitivity plant. The unguarded
 * twins live at the offline C1 seams (f_plant / plain-world legs).
 *
 * The native-parity leg (CI-03, E1) rides a MAIN-team member with NO
 * capabilities block — the legacy native surface — and is judged from a
 * DISK EFFECT the lane itself writes and the ORACLE reads back directly
 * (independent of any tool return); the native grep's wire claim survives
 * only as a recorded parity note, never as the verdict basis.
 *
 * @module tests/world-factory/lib/u6-arc-d-assembly
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
// The toolCall helper + message probes come from the fs-proven assembly —
// the mock's ONLY legal tool dialect is { kind: 'tool-call', toolCalls:
// [{id, name, arguments}] } (u6-arc-a-assembly header; the measured
// STREAM_CLOSED failure of run u6arca4 punished any other shape).
import { messagesOf, textOf, lastUserTextOfStatic, extractInstanceId, toolCall } from './u6-fs-assembly.mjs'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

export function createArcDAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u6arcd-base-${rs}`
  const BP_ANCHOR_ID = 'team.u6arcd.anchor'
  const BP_MAIN_ID = 'team.u6arcd.main'
  const ROOT = `session-u6arcd-root-${rs}`
  const CREATE_ROOT = `session-u6arcd-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  let blueprintFacade = null
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u6arcd-realm-${rs}`

  // One fixture file, one unique claim: the CI-03 native leg is judged from
  // a DISK EFFECT the native lane PRODUCES (files.nativeEffect, E1) and
  // that the ORACLE reads back itself — never from what a tool return
  // carries. files.native is the fixture the native grep reads: its
  // wire-claim scan survives only as the nativeGrepParity NOTE beside the
  // verdict, never as the verdict's basis.
  const files = {
    native: { path: join(workspaceDir, 'notes', 'u6arcd-native.txt'), claim: `U6ARCD_NATIVE_CLAIM_${rs}` },
    // The fixture may pre-exist ONLY as a placeholder: the effect is the
    // marker CONTENT, which only the lane's own edit can produce. (boot-4
    // measured law: this pin's surface has no builtin write tool, and the
    // confined bash has zero writable grants — the legacy edit surface is
    // the spelling the oracle compares.)
    nativeEffect: { path: join(workspaceDir, 'u6arcd-native-effect.txt'), marker: `U6ARCD_NATIVE_EFFECT_${rs}`, placeholder: 'PENDING_U6ARCD_EFFECT' },
    // R-U6P6-1 (the live d_restrict_veto / d_lift_control pair): the same
    // effect shape the pair leg writes with bash BEFORE, under, and after a
    // live tools.restrict mask (the builtinToolDeny lane) on the ROOT lane.
    // pairDeny must stay ABSENT (the mask vetoed the write — zero effect);
    // pairLift must EXIST after the mask is disposed (g1fa's exact law,
    // judged on DISK + the durable govern rows, never the transcript).
    pairDeny: { path: join(workspaceDir, 'u6arcd-pair-denied.txt'), marker: `U6ARCD_PAIR_DENY_${rs}` },
    pairLift: { path: join(workspaceDir, 'u6arcd-pair-lift.txt'), marker: `U6ARCD_PAIR_LIFT_${rs}` },
  }
  const markers = {
    MK_DISC: `U6ARCD_DISC_${rs}`,
    MK_L1: `U6ARCD_L1_${rs}`,
    MK_NATIVE: `U6ARCD_NATIVE_${rs}`,
    T_POS: `U6ARCD_TRIGGER_POS_${rs}`,
    T_SPOOF: `U6ARCD_TRIGGER_SPOOF_${rs}`,
    T_SWAP: `U6ARCD_TRIGGER_SWAP_${rs}`,
    T_UNBOUND: `U6ARCD_TRIGGER_UNBOUND_${rs}`,
    T_REPLAY: `U6ARCD_TRIGGER_REPLAY_${rs}`,
    T_TD: `U6ARCD_TRIGGER_TD_${rs}`,
    T_POSTTD: `U6ARCD_TRIGGER_POSTTD_${rs}`,
    T_RESTRICT: `U6ARCD_TRIGGER_RESTRICT_${rs}`,
    T_LIFT: `U6ARCD_TRIGGER_LIFT_${rs}`,
  }
  const tokens = (n) => `u6arcd-${n}-${rs}`
  // The probe walk identities are FIXED words so the ledger and the marker
  // dir can be read back by exact name (the family writes <callId>-marker.txt).
  const probe = {
    posCall: 'pos-1', posGrant: 'grant-pos', posNonce: `NONCE_POS_${rs}`,
    replayCall: 'replay-1', replayGrant: 'grant-pos', // SAME grant id = the replay
    spoofCall: 'spoof-1', spoofNonce: `NONCE_SPOOF_${rs}`,
    swapCall: 'swap-1', swapNonce: `NONCE_SWAP_${rs}`, movedIdentity: 'def#moved-under-swap',
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
      staticModel: { provider: 'deepseek-official', model: 'u6arcd-model' },
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
        // ENFORCING (not shadow): ARC-D measures the kernel REAL — the
        // probe family runs its own enforcing kernel; the plane must be the
        // same generation of truth beside it (arc-a law).
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
    `  persona: "You are the leader of the u6arcd assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: native', '    persona: "You are a worker of the u6arcd assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u6arcd assembly team. ${markers.MK_L1} drives your chain: create one native control member and run the delegated script exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
      'members:',
      // THE CI-03 lane: NO capabilities block at all — the legacy native
      // surface. Its native calls behaving EXACTLY as they did before any
      // plane exists is the parity law; the probe tool must never appear
      // to it, and no governed refusal may ever be its answer.
      '  - templateId: native', '    displayName: "u6arcd native control member"',
      `    persona: ${JSON.stringify('You are a worker of the u6arcd assembly team (native control lane). Follow the delegated script exactly, one tool call at a time.')}`,
      'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
      'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
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
        id: BASE_PRESET_ID, displayName: 'u6arcd base',
        description: `u6arcd base preset (${runStamp}) = smoke + tool-fs-search`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    for (const key of Object.keys(files)) {
      // E1: the EFFECT file is NEVER pre-written — its existence is the
      // verdict's basis, so the only hand that may create it is the native
      // lane's own native write during the run.
      if (files[key].claim !== undefined) { writeFileSync(files[key].path, `${files[key].claim}\n`); continue }
      // E1: the EFFECT file pre-exists ONLY as a placeholder — ABSENCE is
      // not the oracle (the confined lane cannot create files); the marker
      // CONTENT is, and only the lane's own native edit can produce it.
      if (files[key].placeholder !== undefined) writeFileSync(files[key].path, `${files[key].placeholder}\n`)
    }
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
  }

  // HOST-IDENTICAL ingest gate (arc-a law, run7 forensics): parse with the
  // SAME closed-grammar validator the host catalog runs (the domain facade
  // parseBlueprint at its COMPILED dist face — the file the host-loaded
  // plugin imports), BEFORE any document lands, so a document the host
  // would reject can never poison a home and surface only as MALFORMED_DTO
  // at team.create, after the boot was spent.
  function requireBlueprintFacade() {
    if (blueprintFacade === null) {
      const req = createRequire(join(repoRoot, 'noop.cjs'))
      blueprintFacade = req(join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
    }
    return blueprintFacade
  }
  function assertBlueprintText(text, wantId, wantMembers, label) {
    let bp
    try {
      bp = requireBlueprintFacade().parseBlueprint(text)
    } catch (e) {
      throw new Error(`U6ARCD_INGEST: ${label} rejected by the host validator — ${String(e?.message ?? e)}`)
    }
    const doc = bp.blueprint ?? bp
    if (doc.blueprintId !== wantId) throw new Error(`U6ARCD_INGEST: ${label} resolves as ${String(doc.blueprintId)}, the catalog would not find ${wantId}`)
    if (!Array.isArray(doc.members) || doc.members.length !== wantMembers) throw new Error(`U6ARCD_INGEST: ${label} members=${String(doc.members?.length)} want ${String(wantMembers)} under the host validator`)
  }

  function writeMainBlueprint(denyList) {
    const text = mainBlueprintYaml(denyList)
    assertBlueprintText(text, BP_MAIN_ID, 1, 'main.yaml')
    writeFileSync(join(blueprintDir, 'main.yaml'), text)
  }

  function assertBlueprintIngestible() {
    const out = {}
    // Pre-boot (only the anchor exists) the main face is validated from the
    // SAME emitter the write path uses with an empty deny list.
    for (const [file, wantId, wantMembers] of [['main.yaml', BP_MAIN_ID, 1], ['anchor.yaml', BP_ANCHOR_ID, 1]]) {
      const text = file === 'main.yaml' && !existsSync(join(blueprintDir, 'main.yaml'))
        ? mainBlueprintYaml([])
        : readFileSync(join(blueprintDir, file), 'utf8')
      assertBlueprintText(text, wantId, wantMembers, file)
      out[file] = 'PASS'
    }
    return out
  }

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID,
    blueprintDir, workspaceDir, files, markers, tokens, probe,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, assertBlueprintIngestible,
  }
}

/** The LAST tool_result block's text (the close-turn carrier on a trigger
 *  lane): serialized whole, so the action echo is matched as written. */
function lastToolResultOf(req) {
  const blocks = messagesOf(req)
    .flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
    .filter((b) => b?.type === 'tool_result')
  const last = blocks[blocks.length - 1]
  return last === undefined ? '' : JSON.stringify(last)
}

/** The mock script. Trigger lanes ride boot-root prompts, ONE tool call
 *  each (the arc-a-proven law); the native control lane runs its script
 *  from the delegated token; the leader lane walks the arc-a PHASES idiom
 *  with ONE member (create -> harvest the REAL instance id from the
 *  tool_result -> async delegate -> settled -> collect -> fence). */
export function makeArcDDecide({ assembly }) {
  const { markers, tokens, probe } = assembly
  const ids = {}
  const steps = { native: 0 }
  const trigState = {}
  // The live restrict/lift pair (R-U6P6-1): a two-leg, three-step lane each.
  const pair = { leg: null, step: 0 }
  const PHASES = [
    { kind: 'create', template: 'native', tok: 'c1', label: 'arcd-native' },
    { kind: 'delegate', tok: 'd1', prompt: `${markers.MK_NATIVE} run the native script exactly: one grep for the claim, then say U6ARCD_NATIVE_DONE.`, which: 'native', fence: 'U6ARCD_NATIVE_DONE' },
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
    for (const key of ['T_POS', 'T_SPOOF', 'T_SWAP', 'T_UNBOUND', 'T_REPLAY', 'T_TD', 'T_POSTTD', 'T_RESTRICT', 'T_LIFT']) {
      if (lu.includes(markers[key])) return `trigger-${key}`
    }
    if (lu.includes(markers.MK_DISC)) return 'disc'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'native'
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool === 'u6arcd_probe') return 'trigger-close'
      if (tool === 'u6arcd_govern') return 'pair-step2'
      if ((tool === 'u6arcd_pair_effect' || tool === 'bash') && pair.step === 2) return 'pair-close'
      if (tool === 'grep' || tool === 'edit' || (tool === 'write' && steps.native === 3) || (tool === 'bash' && steps.native === 2)) return 'native'
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes('U6ARCD_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }

  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'u6arcd adversarial session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U6ARCD_NOOP_DONE' }
    if (lane === 'trigger-close') {
      // Distinct close texts per trigger leg: the runner's cadence proves
      // EACH leg landed by its own fence (one shared close text would let
      // one leg masquerade as another). Wire shape: the tool_result text
      // arrives embedded in a JSON string, so every inner quote reaches us
      // escaped — un-escape before the action-echo match (arc-a's quoted
      // fences never fired live for this reason; only the bare-word
      // GRANT_REPLAY/KERNEL_NOT_ACTIVE fences did — measured u6arca8
      // laneDone. The ARC-D fences must actually fire).
      const t = lastToolResultOf(req).replace(/\s+/g, '').replace(/\\"/g, '"')
      if (t.includes('GRANT_REPLAY')) return { kind: 'text', content: 'U6ARCD_REPLAY_DONE' }
      if (t.includes('KERNEL_NOT_ACTIVE')) return { kind: 'text', content: 'U6ARCD_POSTTD_DONE' }
      if (t.includes('"action":"teardown"')) return { kind: 'text', content: 'U6ARCD_TD_DONE' }
      if (t.includes('"action":"unbound"')) return { kind: 'text', content: 'U6ARCD_UNBOUND_DONE' }
      if (t.includes('"action":"spoof"')) return { kind: 'text', content: 'U6ARCD_SPOOF_DONE' }
      if (t.includes('"action":"swap"')) return { kind: 'text', content: 'U6ARCD_SWAP_DONE' }
      if (t.includes('"action":"walk"')) return { kind: 'text', content: 'U6ARCD_WALK_DONE' }
      return { kind: 'text', content: 'U6ARCD_TRIGGER_DONE' }
    }
    if (lane === 'pair-step2') {
      // R-U6P6-1 step 1: the govern row settled; now the SAME lane attempts
      // its bash effect — under the mask (T_RESTRICT: the write must be
      // vetoed, zero disk effect) and after the dispose (T_LIFT: the write
      // must land). The judge reads DISK; the fence only proves closure.
      if (pair.leg !== null && pair.step === 1) {
        pair.step = 2
        const target = pair.leg === 'T_RESTRICT' ? assembly.files.pairDeny : assembly.files.pairLift
        // arc-d-u7arc2 measured law: the confined provider refuses EVERY
        // bash workspace write on this pin (flat included — Permission
        // denied, settle captured), so a bash-redirect pair could never
        // distinguish mask from sandbox. The effect now rides the ONE
        // writer measured able to land a world file: the plugin's own fs
        // tool u6arcd_pair_effect. The restrict seam masks its NAME on the
        // caller (plus 'bash', the builtinToolDeny shape): masked -> typed
        // refusal and zero disk effect; unmasked -> it lands and the
        // oracle reads it back. Same tool, same path, same marker shape
        // both legs — the mask is the only difference.
        return toolCall('u6arcd_pair_effect', { path: target.path, marker: target.marker })
      }
      return { kind: 'text', content: 'U6ARCD_TRIGGER_DONE' }
    }
    if (lane === 'pair-close') {
      // R-U6P6-1 step 2: the attempt settled (refused or not — the DISK and
      // the durable govern rows decide, never this transcript); close the
      // leg by its own fence.
      const fence = pair.leg === 'T_RESTRICT' ? 'U6ARCD_RESTRICT_VETOED' : 'U6ARCD_LIFT_RAN'
      pair.leg = null
      pair.step = 0
      return { kind: 'text', content: fence }
    }
    if (lane === 'native') {
      // CI-03 script: the legacy native surface does its own work with the
      // plane mounted SOMEWHERE ELSE on the same Host. ABSOLUTE path (the
      // run-u6arca5 law: relative spellings resolve at the HTU tree).
      // E1: step 1 is the native READ (kept — its wire claim is recorded as
      // the nativeGrepParity note); step 2 is the native WRITE that LEAVES A
      // DISK EFFECT the oracle reads independently of any tool return — the
      // verdict's real basis.
      if (steps.native === 0) { steps.native = 1; return toolCall('grep', { pattern: assembly.files.native.claim, path: join(assembly.workspaceDir, 'notes') }) }
      // boot-3 measured: the confined provider refuses bash workspace writes
      // (Permission denied in the settle). The native lane now tries BOTH
      // native write spellings — the bash redirect AND the builtin write
      // tool — because the ORACLE decides on disk, and every spelling the
      // legacy surface actually has is part of what CI-03 compares. Whichever
      // (if any) lands is the honest effect; the settle texts ride the
      // digest's effectNotes as diagnosis.
      if (steps.native === 1) { steps.native = 2; return toolCall('bash', { command: `printf '%s\\n' '${assembly.files.nativeEffect.marker}' > '${assembly.files.nativeEffect.path}' 2>&1; cat '${assembly.files.nativeEffect.path}' 2>&1`, description: 'u6arcd CI-03 native effect attempt 1: bash redirect (flat workspace root)' }) }
      if (steps.native === 2) { steps.native = 3; return toolCall('edit', { file_path: assembly.files.nativeEffect.path, old_string: assembly.files.nativeEffect.placeholder, new_string: assembly.files.nativeEffect.marker }) }
      return { kind: 'text', content: 'U6ARCD_NATIVE_DONE' }
    }
    if (lane.startsWith('trigger-')) {
      const key = lane.slice('trigger-'.length)
      const st = trigState[key] ?? 'fresh'
      trigState[key] = 'issued'
      if (st !== 'fresh') return { kind: 'text', content: 'U6ARCD_TRIGGER_DONE' }
      if (key === 'T_RESTRICT' || key === 'T_LIFT') {
        // R-U6P6-1 step 0 of the pair leg: the GOVERN call (the plugin's
        // live tools.restrict mask on THIS agent — the builtinToolDeny
        // lane). Steps 1-2 continue on the tool_result lanes.
        pair.leg = key
        pair.step = 1
        return toolCall('u6arcd_govern', { action: key === 'T_RESTRICT' ? 'restrict-on' : 'restrict-off' })
      }
      if (key === 'T_POS') return toolCall('u6arcd_probe', { action: 'walk', callId: probe.posCall, grantId: probe.posGrant, nonce: probe.posNonce })
      if (key === 'T_SPOOF') return toolCall('u6arcd_probe', { action: 'spoof', callId: probe.spoofCall, nonce: probe.spoofNonce })
      if (key === 'T_SWAP') return toolCall('u6arcd_probe', { action: 'swap', callId: probe.swapCall, nonce: probe.swapNonce, identity: probe.movedIdentity })
      if (key === 'T_UNBOUND') return toolCall('u6arcd_probe', { action: 'unbound', callId: 'unbound-1' })
      if (key === 'T_REPLAY') return toolCall('u6arcd_probe', { action: 'walk', callId: probe.replayCall, grantId: probe.replayGrant, nonce: 'NONCE_REPLAY' })
      if (key === 'T_TD') return toolCall('u6arcd_probe', { action: 'teardown' })
      if (key === 'T_POSTTD') return toolCall('u6arcd_probe', { action: 'walk', callId: 'post-1', grantId: 'grant-post', nonce: 'NONCE_POST' })
      return { kind: 'text', content: 'U6ARCD_TRIGGER_DONE' }
    }
    // ── leader lane: the arc-a-proven PHASES machine (create -> the REAL
    // instance id harvested from the tool_results -> async delegate ->
    // settled notice -> team_collect -> fence in the collected text).
    const seen = [...new Set(messagesOf(req).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .filter((b) => b?.type === 'tool_result')
      .map((b) => extractInstanceId((Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')))
      .filter((x) => x !== null))]
    if (ids.native === undefined && seen.length >= 1) ids.native = seen[0]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which]
        if (inst === undefined) return { kind: 'text', content: `U6ARCD_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `arcd-${ph.tok}`, prompt: ph.prompt, async: true })
      }
      const pending = messagesOf(req)
        .map((m) => textOf(m))
        .filter((t2) => t2.includes('[team-work-settled requestToken='))
        .map((t2) => { const m2 = /\[team-work-settled requestToken=([^\]\s]+)/.exec(t2); return m2 === null ? null : m2[1] })
        .filter((tk) => tk !== null && !collected.has(tk))
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collected.size)}`, requestTokens: pending })
      }
      if (messagesOf(req).map(textOf).join('\n').includes(ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 8) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      return { kind: 'text', content: `U6ARCD_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U6ARCD_L1_DONE' }
  }
  return decide
}

/**
 * THE JUDGE. Pure: its ENTIRE input is data the runner read from the
 * ledger / marker dir / direct DISK reads (the native effect file) / host
 * log. It returns one
 * [caseId, PASS|FAIL|ENV_BLOCK, detail] row per suite case, in SUITE_CASES
 * order. A verdict is derived, never transcribed: every FAIL row says which
 * fact was missing. ENV_BLOCK is emitted by NOBODY else (the runner's early
 * bail-outs are FAIL).
 */
export function judgeU6ArcD({ probeRows, markerFiles, markerNonces, nativeEvidence, nativeGrepParity = null, pairEvidence = {}, hostAlive, bootOk = true }) {
  const legRow = (leg, extra = {}) => probeRows.find((r) => r.leg === leg && Object.entries(extra).every(([k, v]) => r[k] === v)) ?? null
  const has = (f) => markerFiles.includes(f)
  const nonceAt = (f) => markerNonces[f] ?? null
  const alive = hostAlive === true
  const envBlocked = (why) => (bootOk && alive ? null : why)
  const V = []
  const add = (id, verdict, detail) => { V.push([id, verdict, detail]) }

  // mounted — family kernel ACTIVE, register row, host alive.
  {
    const mount = legRow('family-mount', { ok: true })
    const reg = legRow('register', { kind: 'probe-tool', ok: true })
    const eb = envBlocked('host not alive before the verdict')
    if (eb !== null) add('arcd:mounted', 'ENV_BLOCK', { reason: eb })
    else add('arcd:mounted', mount !== null && reg !== null ? 'PASS' : 'FAIL', { mount: mount ?? { missing: true }, register: reg ?? { missing: true } })
  }
  // positive — the walk settled AND its marker EXISTS with its nonce (disk
  // oracle: the family writes <callId>-marker.txt containing the nonce).
  {
    const eb = envBlocked('host not alive before the positive walk')
    if (eb !== null) add('arcd:positive', 'ENV_BLOCK', { reason: eb })
    else {
      const r = legRow('walk', { action: 'walk', callId: 'pos-1', ok: true })
      const marker = 'pos-1-marker.txt'
      add('arcd:positive', r !== null && has(marker) ? 'PASS' : 'FAIL', { row: r ?? { missing: true }, markerPresent: has(marker), nonce: nonceAt(marker) })
    }
  }
  // spoof — the self-reported-foreign-scope walk REFUSED, zero marker
  // (sensitivity: the pos marker proves the same family CAN write).
  {
    const r = legRow('walk', { action: 'spoof' })
    const refused = r !== null && r.ok === false
    add('arcd:spoof-zero-authority', refused && !has('spoof-1-marker.txt') ? 'PASS' : 'FAIL', { row: r ?? { missing: true }, markerPresent: has('spoof-1-marker.txt') })
  }
  // swap — the moved-identity walk REFUSED, zero marker. The sensitivity
  // pair is the POSITIVE walk (same mount, same body, same marker
  // machinery — only the identity differs); no shadow twin exists (the
  // kernel computes refuse verdicts in every mode; the unguarded twins
  // live at the offline C1 seams).
  {
    const r = legRow('walk', { action: 'swap' })
    add('arcd:swap-refused', r !== null && r.ok === false && !has('swap-1-marker.txt') ? 'PASS' : 'FAIL', { row: r ?? { missing: true }, markerPresent: has('swap-1-marker.txt') })
  }
  // unbound name — the kernel decides on a never-bound name: never 'allow'.
  {
    const r = legRow('walk', { action: 'unbound' })
    add('arcd:unbound-refused', r !== null && r.outcome !== 'allow' ? 'PASS' : 'FAIL', { row: r ?? { missing: true } })
  }
  // replay — the settled grant re-presented is refused (GRANT_REPLAY), and
  // the replay call left NO marker of its own.
  {
    const r = legRow('walk', { action: 'walk', callId: 'replay-1' })
    add('arcd:replay-refused', r !== null && r.ok === false && !has('replay-1-marker.txt') ? 'PASS' : 'FAIL', { row: r ?? { missing: true }, markerPresent: has('replay-1-marker.txt') })
  }
  // CI-03 native parity (E1 — the DIRECT disk oracle): the native lane's
  // effect file must EXIST ON DISK with the run's unique effect marker, as
  // read BY THE ORACLE (readFileSync in the runner process) — an
  // observation no tool return can forge or hide. The native grep's wire
  // claim survives only as the recorded nativeGrepParity NOTE: claim bytes
  // inside a tool_result are what the lane ECHOED, not proof the native
  // surface touched the world.
  {
    const ne = nativeEvidence ?? {}
    add('arcd:ci03-native-parity', ne.present === true && ne.contentMatches === true ? 'PASS' : 'FAIL', {
      diskEffect: { present: ne.present === true, contentMatches: ne.contentMatches === true, readFromDisk: ne.readFromDisk === true, path: ne.pathTail ?? null },
      nativeGrepParity: nativeGrepParity ?? null,
    })
  }
  // restrict-veto (R-U6P6-1, the live d_restrict_veto twin): the DURABLE
  // govern row says the tools.restrict mask went ON (the builtinToolDeny
  // lane, measured by the plugin itself), and the DENIED effect file is
  // ABSENT on disk — zero effect under the mask, the g1fa law. The lift
  // row below is the in-run positive control: the same lane CAN land bytes
  // once unmasked, so absence here is the mask, not a dead lane.
  {
    const on = legRow('govern', { action: 'restrict-on', ok: true })
    const deny = (pairEvidence ?? {}).pairDeny ?? {}
    const denyMarker = String(deny?.marker ?? '\u0000')
    const denyEffectRan = (probeRows ?? []).some((r) => r?.leg === 'pair-effect' && String(r?.marker ?? '') === denyMarker)
    add('arcd:restrict-veto', on !== null && deny.present !== true && denyEffectRan !== true ? 'PASS' : 'FAIL', { restrictRow: on ?? { missing: true }, pairDeny: deny, denyEffectRan })
  }
  // lift-control (R-U6P6-1, the live d_lift_control twin): the mask was
  // DISPOSED (durable row) and the lane's next write LANDED — DISK positive
  // with the run-unique marker, read by the oracle. A mask that could only
  // hide forever fails HERE, not there.
  {
    const off = legRow('govern', { action: 'restrict-off', ok: true })
    const lift = (pairEvidence ?? {}).pairLift ?? {}
    const liftMarker = String(lift?.marker ?? '\u0000')
    const liftEffectRan = (probeRows ?? []).some((r) => r?.leg === 'pair-effect' && r?.ok === true && String(r?.marker ?? '') === liftMarker)
    add('arcd:lift-control', off !== null && liftEffectRan === true && lift.present === true && lift.contentMatches === true ? 'PASS' : 'FAIL', { liftRow: off ?? { missing: true }, pairLift: lift, liftEffectRan })
  }
  // marker ledger — global arithmetic over the probe ledger: exactly one
  // ok-walk per positive call; zero ok-rows for any refusal call.
  {
    const okWalks = probeRows.filter((r) => r.leg === 'walk' && r.ok === true).map((r) => String(r.callId)).sort()
    const expectedOk = ['pos-1']
    const refusalLeaks = probeRows.filter((r) => r.leg === 'walk' && r.ok === true && ['spoof-1', 'swap-1', 'replay-1', 'post-1'].includes(String(r.callId)))
    const markersExact = okWalks.join() === expectedOk.join()
    add('arcd:marker-ledger', markersExact && refusalLeaks.length === 0 ? 'PASS' : 'FAIL', { okWalks, refusalLeaks: refusalLeaks.length })
  }
  // teardown order — teardown settled honestly, post-teardown walk refused.
  {
    const td = legRow('teardown', { ok: true })
    const post = legRow('walk', { callId: 'post-1' })
    add('arcd:teardown-honest', td !== null && post !== null && post.ok === false ? 'PASS' : 'FAIL', { teardown: td ?? { missing: true }, post: post ?? { missing: true } })
  }
  return V
}
