/**
 * u7-fui-assembly.mjs — world materialization for the `u7-f-ui` suite
 * (u7-f C2): the production Team row whose kernel now owns the UI family —
 * governed `ask_user_question` and governed `present` — on ONE World, ONE
 * boot (the CA-01 claim: a whole NEW family joins through the reviewed
 * descriptor + manifest only; ZERO center diff, ZERO new assembly keys
 * beyond the family's own declared planeConfig flag).
 *
 * The kit is the u7-fsmut shape (profile-patch layer, /team-remote HTTP,
 * mock provider, token-keyed member lanes, leader phase machine) reduced to
 * the TWO legs this family can honestly run live:
 *   strict member (`uigov`) — governed ask_user_question (ONE question,
 *                    legacy variant), governed present OVER AN IN-ROOT
 *                    PLANTED FILE, governed present OVER AN OUT-OF-ROOT
 *                    FILE (the pure-lexical anchor arm).
 * There is NO native control leg: the native rows of these two names are
 * interaction rows (a live card, not a disk fact), and the takeover is
 * witnessed directly instead — every refusal answers in the FAMILY's own
 * typed vocabulary, which no native row can ever emit.
 *
 * The live law this World must show (pinned offline in C1): NO trusted
 * mount injects a UI port, and the host's public userQuestions service
 * carries no present face — so every call FAILS CLOSED with a typed
 * refusal and ZERO effect. The verdict sources: the family's own host-log
 * observe lines (`u7f-ask:` / `u7f-present:`), the tool_result heads (the
 * ONLY witness refusals executed above the row leave), the runner's OWN
 * disk reads (byte identity for present's zero effect) and the CANARY
 * never-rides-a-line check for the out-of-root arm (zero fs touch).
 *
 * @module tests/world-factory/lib/u7-fui-assembly
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

// The names the FAMILY owns: they must NEVER enter the template deny list
// (the takeover rides the placement guard, not the builtin deny lane).
export const UI_FAMILY_OWNED_NAMES = ['ask_user_question', 'present']

export function createUiAssembly({ repoRoot, home, runStamp, reportDir, sessionRoot }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7fui-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7fui.anchor'
  const BP_MAIN_ID = 'team.u7fui.main'
  const ROOT = `session-u7fui-root-${rs}`
  const CREATE_ROOT = `session-u7fui-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7fui-realm-${rs}`
  // The confined-provider trio + shadow ledger are part of the PROVEN
  // governed-mount row shape (u6-fs / u7-fsmut boot evidence): WITHOUT
  // centerAssembly the PA edge opens on no read authority generation and
  // every governed call dies TOOL_BINDING_UNVERIFIED (measured, u7fsmut1).
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const SHADOW_LEDGER = join(home, 'u7fui-shadow-ledger.jsonl')

  // Workspace facts. EVERY claim is unique per run: a claim appearing in
  // any log line or tool result could only come from a body that READ the
  // file — the CANARY never-rides-a-line check is byte-level zero-touch.
  const claims = {
    presented: `U7FUI_PRESENTED_CLAIM_${rs}`,
    outside: `U7FUI_OUTSIDE_CANARY_NEVER_READ_${rs}`,
  }
  const files = {
    presented: { path: join(workspaceDir, 'notes', 'u7fui-present-target.txt') },
    // OUT-OF-ROOT by construction: the plane root is realpath(workspaceDir);
    // this file lives one level up, in the World home itself.
    outside: { path: join(home, 'u7fui-outside-secret.txt') },
  }
  const PRESENTED_CONTENT = `${claims.presented}\nthe file the governed present row tried to publish\n`
  const OUTSIDE_CONTENT = `${claims.outside}\nbytes no governed present row may ever read, quote, or carry\n`
  const markers = {
    MK_DISC: `U7FUI_DISC_${rs}`,
    MK_L1: `U7FUI_L1_${rs}`,
    MK_STRICT: `U7FUI_STRICT_${rs}`,
  }
  const tokens = (n) => `u7fui-${n}-${rs}`
  const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

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
      staticModel: { provider: 'deepseek-official', model: 'u7fui-model' },
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
      // THE u7-f SURFACE: the u7-fsmut-proven governed teamToolPlane config
      // PLUS the family's OWN declared planeConfig flag (the descriptor
      // declares `uiFamilyEnabled`/`uiTimedQuestions` as 'boolean' values;
      // the plane passes planeConfig through verbatim and the reviewed
      // ui.mjs descriptor enables itself on ===true — absent means OFF,
      // the jobsEnabled zero-flip law). No new center key exists here.
      teamToolPlane: {
        realmId: PLANE_REALM_ID,
        fsInstance: { fs: 'team-ctl', rootDir: planeRootDir(), realmId: PLANE_REALM_ID, kind: 'absolute-path' },
        centerAssembly: 'shadow',
        centerShadowLedger: SHADOW_LEDGER,
        confinedProvider: {
          trustRoot: `sha256:${launcherSha().slice(0, 16)}#${LAUNCHER}`,
          assembly: { launcherPath: LAUNCHER, launcherSha256: launcherSha(), minAbiVersion: 3 },
        },
        uiFamilyEnabled: true,
      },
    }
  }
  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7fui assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: uigov', '    persona: "You are a worker of the u7fui assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `uigov` carries default DENY with NO allow rules:
   * the whole point is the FAIL-CLOSED law — the governed rows must answer
   * with their OWN typed refusals and touch NOTHING (the C1 default-deny
   * law, run on the live host). The two family-owned names NEVER enter the
   * builtinToolDeny list: they are kernel-owned through the placement
   * guard, and the mock lane addresses them directly.
   */
  function mainBlueprintYaml(denyList) {
    const kept = denyList.filter((n) => !UI_FAMILY_OWNED_NAMES.includes(n))
    const denyLines = kept.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...kept.map((n) => `      - ${n}`)]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7fui assembly team. ${markers.MK_L1} drives your chain: create one governed member, then run the delegated script exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
      'members:',
      '  - templateId: uigov', '    displayName: "u7fui governed UI worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7fui assembly team (governed UI lane). Follow the delegated script exactly, one tool call at a time. You never invent an answer to a refused question and never claim a file was presented when the call was refused.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: deny',
      '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: uigov', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
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
        id: BASE_PRESET_ID, displayName: 'u7fui base',
        description: `u7fui base preset (${runStamp}) = smoke (UI family governed, uiFamilyEnabled ON)`,
        plugins: basePlugins,
      }),
    ]
  }

  /** Plant facts BEFORE the spawn. Returns the pre-run disk truth the
   *  zero-effect verdict byte-compares against (planted here, before any
   *  host process exists — nothing in the run can rewrite it). */
  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    writeFileSync(files.presented.path, PRESENTED_CONTENT)
    writeFileSync(files.outside.path, OUTSIDE_CONTENT)
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return {
      presentedShaBefore: sha256File(files.presented.path),
      outsideShaBefore: sha256File(files.outside.path),
    }
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }

  /** The runner's independent disk oracle (the host never reports about
   *  itself): bytes as they ARE + the CANARY zero-read check over the
   *  witness line set the suite supplies. */
  function readOracleFacts() {
    const shaOf = (p) => { try { return sha256File(p) } catch { return null } }
    const bytesOf = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }
    return {
      presentedShaAfter: shaOf(files.presented.path),
      presentedBytesAfter: bytesOf(files.presented.path),
      outsideShaAfter: shaOf(files.outside.path),
    }
  }

  return {
    rs,
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID,
    blueprintDir, workspaceDir, files, claims, markers, tokens,
    PRESENTED_CONTENT, OUTSIDE_CONTENT,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readOracleFacts,
  }
}

/**
 * The scripted provider for one `u7fui` World (u6-fs lane law: lanes are
 * keyed on the delegation request token; a tool-result turn continues its
 * issuer). Member script (uigov, token d1): ASK one question → PRESENT an
 * in-root planted file → PRESENT an out-of-root file → DONE. Every leg is
 * EXPECTED to answer with a typed refusal (the fail-closed law); the lane
 * continues regardless because the refusal is the demonstration.
 */
export function makeUiDecide({ assembly }) {
  const { tokens, markers, files } = assembly
  const steps = { uigov: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'uigov', tok: 'c1', label: 'u7fui-uigov' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_STRICT, which: 'uigov', fence: 'U7FUI_UI_DONE' },
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
    if (lu.includes('U7FUI_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'uigov'
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
    if (lane === 'title') return { kind: 'text', content: 'u7fui assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'U7FUI_NOOP_DONE' }
    if (lane === 'uigov') {
      const step = steps.uigov
      steps.uigov += 1
      if (step === 0) {
        // boot-f2 MEASURED law: the host option shape is {label, description}
        // — an `id` on an option is an unknown parameter and the governed
        // row refuses it typed (ask-unknown-parameter), which is itself a
        // live witness of the row's closed-world contract. This script now
        // sends host-LEGAL options so the call travels to the PORT gate —
        // the fail-closed law this World must show.
        return toolCall('ask_user_question', {
          questions: [{
            id: 'u7fui-q1',
            question: `${markers.MK_STRICT} which option should the governed lane take?`,
            options: [{ label: 'Option A' }, { label: 'Option B' }],
          }],
        })
      }
      if (step === 1) {
        return toolCall('present', { files: [{ path: files.presented.path, description: 'u7fui in-root present attempt' }] })
      }
      if (step === 2) {
        return toolCall('present', { files: [{ path: files.outside.path, description: 'u7fui out-of-root present attempt' }] })
      }
      return { kind: 'text', content: 'U7FUI_UI_DONE' }
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
    if (seen.length >= 1 && ids.uigov === undefined) ids.uigov = seen[0]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which ?? 'uigov']
        if (inst === undefined) return { kind: 'text', content: `U7FUI_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `u7fui-${ph.tok}`, prompt: ph.prompt, async: true })
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
      return { kind: 'text', content: `U7FUI_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'U7FUI_L1_DONE' }
  }
}

/**
 * Pure verdicts over COLLECTED facts (no I/O — the runner supplies oracle
 * bytes, host-log hit lines, lane completion, hostAlive). Every PASS names
 * its witnesses; refusals are proven by BYTE COMPARISON and the
 * CANARY-never-rides-a-line law, never by prose.
 *
 * The DISCLOSURE law (plan U5 bullet 5 via u7-f): the live POSITIVE arms
 * cannot run on this World — no trusted mount injects a UI interaction/
 * presentation port, and the host's public userQuestions service carries no
 * present face (pinned offline in C1 A-2/P-6). The suite therefore grades
 * the HONEST FAIL-CLOSED arms: typed refusal + ZERO effect, with the
 * positive arms DISCLOSED verbatim. Silence, or an answer that arrived
 * without the row's own RAN witness, is a FAIL.
 */
export function judgeU7Ui({ before, oracle, log, journal = [], laneDone, hostAlive, healthOk, stateOk, surface }) {
  const out = []
  const logLines = (pat) => log.filter((l) => l.includes(pat))
  const askLines = logLines('governed-ask')
  const presentLines = logLines('governed-present')
  const askRan = askLines.filter((l) => l.includes('RAN'))
  const presentRan = presentLines.filter((l) => l.includes('RAN'))
  const presentProbed = presentLines.filter((l) => l.includes('PROBED'))
  const anchorRefusals = presentLines.filter((l) => l.includes('anchor-refusal'))
  const portRefusals = [...askLines, ...presentLines].filter((l) => /port-refusal|port-failed/.test(l))
  const denyRefusals = [...askLines, ...presentLines].filter((l) => /default-deny refusal|lane-denied/.test(l))
  const placement = logLines('placement-feed rows=')
  const uiRefusedMount = logLines('PLANE_UI_REGISTRATION_REFUSED')
  const mountOk = healthOk && stateOk && placement.length > 0 && uiRefusedMount.length === 0 && hostAlive
  out.push(['ui:mounted', mountOk ? 'PASS' : 'FAIL', {
    healthOk, stateOk,
    placementFeed: placement.length > 0 ? placement[placement.length - 1].slice(0, 240) : null,
    uiMountRefused: uiRefusedMount[0]?.slice(0, 200) ?? null,
    hostAlive,
  }])
  const journalText = (e) => JSON.stringify(e?.resultHead ?? '')
  const askResults = journal.filter((e) => e?.lastCall === 'ask_user_question')
  const askRefusalHeads = askResults.filter((e) => /refused-|UI_INTERACTION|template-default-deny|permission denied/i.test(journalText(e)))
  const askFabricatedAnswer = askResults.some((e) => /"answers"\s*:\s*\[/.test(journalText(e)) && !/refused-/.test(journalText(e)))
  const askArm = askRan.length > 0 ? 'positive-landed'
    : (askLines.some((l) => /refusal|port-refusal|default-deny|port-failed/.test(l)) ? 'plane-row-refused'
      : askRefusalHeads.length > 0 ? 'refused-above-row' : 'silent')
  out.push(['ui:ask-live-refused', (askArm === 'plane-row-refused' || askArm === 'refused-above-row' || askArm === 'positive-landed')
    && !askFabricatedAnswer && askRan.length === 0 && laneDone.uigov === true && hostAlive ? 'PASS' : 'FAIL', {
    arm: askArm,
    refusalLines: askLines.filter((l) => !l.includes('RAN')).length,
    refusalSample: askLines.find((l) => !l.includes('RAN'))?.slice(0, 220) ?? (askRefusalHeads[0] ? journalText(askRefusalHeads[0]).slice(0, 220) : null),
    ranWitness: askRan[0]?.slice(0, 200) ?? null,
    fabricatedAnswerInToolResult: askFabricatedAnswer,
    disclosure: 'the live refused arm is the LAW on this World: no trusted mount injects a UI interaction port and the host userQuestions service refuses a non-live caller — a refusal with ZERO port calls and zero consumption is the correct honest outcome (C1 A-2/A-9 pin the arms; the timed/pending law is pinned offline in C1 T-4)',
    laneDone: laneDone.uigov === true, hostAlive,
  }])
  const presentedUntouched = oracle.presentedShaAfter !== null && oracle.presentedShaAfter === before.presentedShaBefore
  const presentInRoot = journal.filter((e) => e?.lastCall === 'present' && journalText(e).includes('u7fui-present-target.txt'))
  const presentInRootRefusal = presentInRoot.filter((e) => /refused-|UI_PRESENT|template-default-deny|permission denied/i.test(journalText(e)))
  const presentArm = presentRan.length > 0 || presentProbed.length > 0 ? 'positive-landed'
    : (presentLines.some((l) => l.includes('port-refusal')) ? 'plane-row-refused'
      : presentInRootRefusal.length > 0 ? 'refused-above-row' : 'silent')
  out.push(['ui:present-inroot-zero-effect', presentedUntouched
    && presentArm !== 'silent' && presentRan.length === 0 && presentProbed.length === 0
    && hostAlive ? 'PASS' : 'FAIL', {
    arm: presentArm,
    shaBefore: before.presentedShaBefore, shaAfter: oracle.presentedShaAfter, shaIdentical: presentedUntouched,
    presentRefusalLine: presentLines.find((l) => l.includes('port-refusal'))?.slice(0, 220)
      ?? (presentInRootRefusal[0] ? journalText(presentInRootRefusal[0]).slice(0, 220) : null),
    ranWitness: presentRan[0]?.slice(0, 200) ?? null, probedWitness: presentProbed[0]?.slice(0, 200) ?? null,
    disclosure: 'UI_PRESENT_PORT_ABSENT is the live law: NO host ctx service carries a presentation face (the adapter deliberately exposes ask/askTimed only), so the governed present row fails closed with zero PA consumption, zero probe, zero publication',
    hostAlive,
  }])
  const outsideUntouched = oracle.outsideShaAfter !== null && oracle.outsideShaAfter === before.outsideShaBefore
  const outsideCanaryCarried = [...log, ...journal.map((e) => ({ resultHead: e?.resultHead }))].some((l) => String(typeof l === 'string' ? l : journalText(l)).includes('U7FUI_OUTSIDE_CANARY_NEVER_READ'))
  const outsideRefused = anchorRefusals.length > 0
    || journal.some((e) => e?.lastCall === 'present' && /locator-rejected|anchor|escapes the governed root|refused-/i.test(journalText(e)) && journalText(e).includes('u7fui-outside-secret.txt'))
  out.push(['ui:present-outside-refused', outsideUntouched && outsideRefused && !outsideCanaryCarried && hostAlive ? 'PASS' : 'FAIL', {
    shaBefore: before.outsideShaBefore, shaAfter: oracle.outsideShaAfter, shaIdentical: outsideUntouched,
    anchorRefusalLine: anchorRefusals[0]?.slice(0, 220) ?? null,
    canaryNeverRodeALine: !outsideCanaryCarried,
    disclosure: 'the out-of-root arm refuses PURE-LEXICALLY before the port check and before the PA edge: zero fs touch — proven by the OUTSIDE CANARY appearing in NO host-log line and NO tool result, plus byte identity of the file itself',
    hostAlive,
  }])
  // The honesty arm for the positive legs: EITHER a positive landed (a RAN
  // witness — would mean a trusted mount DID inject a port), OR every call
  // refused with zero effect (above arms PASSed). Silence or an answer
  // without its RAN witness is the dishonest shape and FAILS.
  const anyRan = askRan.length + presentRan.length
  const honestArms = (out[1][1] === 'PASS' && out[2][1] === 'PASS' && out[3][1] === 'PASS')
  out.push(['ui:positive-arms-honest', anyRan > 0 || honestArms ? 'PASS' : 'FAIL', {
    arm: anyRan > 0 ? 'positive-landed' : honestArms ? 'refused-zero-effect-disclosed' : 'silent-or-fabricated',
    ranCount: anyRan,
    disclosure: anyRan > 0
      ? 'a positive arm LANDED — some mount injected a UI port after all; the witness line names it'
      : 'LIVE POSITIVE ARMS DISCLOSED (never faked): ask_user_question positive requires an answerer attached to the member agent-scoped Cordis waterfall (the C2 world drives members over one agent carrier; no HTTP surface answers a governed member); the present publication face exists on NO host ctx service. Production mounts inject only {jobs?, backgroundJobs?} backends — no trusted mount injects a UI port. The positive arms are PROVEN offline in C1 over the injected fake port (A-1 effect observed, P-1 PROBED + port turn receipt); the timed expiry/pending law is pinned in C1 T-4/T-5.',
    portRefusalLines: portRefusals.length, denyRefusalLines: denyRefusals.length,
    hostAlive,
  }])
  void surface
  return out
}
