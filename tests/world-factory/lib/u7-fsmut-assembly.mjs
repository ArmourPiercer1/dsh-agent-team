/**
 * u7-fsmut-assembly.mjs — world materialization for the `u7-fs-mut` suite
 * (U7-9a C2): the production Team row whose kernel now owns the FS-family
 * MUTATION members — governed `write`, governed `edit`, governed
 * `read_image` beside the governed `read` — on ONE World, ONE ledger (the
 * CA-01 claim: new family members, ZERO center diff).
 *
 * The kit is the u6-fs shape (profile-patch layer, /team-remote HTTP,
 * mock provider, token-keyed member lanes, leader phase machine) with the
 * plant/swap/toctou machinery REMOVED: this suite's oracle is DISK. The
 * runner process reads the workspace files itself (independent of any
 * transcript) and byte-compares planted targets before/after refusals —
 * the honest zero-effect proof — plus host-log witnesses (the family's
 * own observe lines) as the governed-vs-native discriminator.
 *
 * Legs (one boot):
 *   strict member  — governed write (create), governed edit (over a
 *                    PRE-PLANTED pre-image = the plant leg), governed write
 *                    over a NEVER-NAMED target (default-deny refusal, disk
 *                    byte-identical), governed read_image (honest-answer
 *                    arm: positive attachment OR typed route/store refusal).
 *   ctl trigger    — the UNGOVERNED boot-root session's NATIVE write lands
 *                    untouched (CI-03 native control; its path must never
 *                    appear on a governed RAN line).
 *
 * @module tests/world-factory/lib/u7-fsmut-assembly
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall, messagesOf, textOf, lastUserTextOfStatic } from './u6-fs-assembly.mjs'

export const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
export const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

// A real 1x1 PNG (8-byte signature, IHDR/IDAT/IEND): the governed
// read_image lane sniffs THIS as image/png whether or not the extension
// lies — the planted image fact the honest-answer arm runs on.
const PNG_1PX_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function createFsMutAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7fsmut-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7fsmut.anchor'
  const BP_MAIN_ID = 'team.u7fsmut.main'
  const ROOT = `session-u7fsmut-root-${rs}`
  const CREATE_ROOT = `session-u7fsmut-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `u7fsmut-realm-${rs}`
  // The confined-provider trio + shadow ledger are part of the PROVEN
  // governed-mount row shape (u6-fs boot evidence); the launcher bytes pin
  // the trust root exactly as the fs/proc/jobs worlds do.
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const SHADOW_LEDGER = join(home, 'u7fsmut-shadow-ledger.jsonl')

  // Workspace facts. EVERY claim is unique per run: a claim appearing in a
  // tool result can only come from a body that touched THAT file, and the
  // runner's own disk reads (never a transcript) are the verdict source.
  const claims = {
    w1: `U7FSMUT_W1_CLAIM_${rs}`,
    plantBefore: `U7FSMUT_PLANT_BEFORE_${rs}`,
    plantAfter: `U7FSMUT_PLANT_AFTER_${rs}`,
    denied: `U7FSMUT_DENY_CLAIM_${rs}`,
    ctl: `U7FSMUT_CTL_CLAIM_${rs}`,
  }
  const files = {
    w1: { path: join(workspaceDir, 'notes', 'u7fsmut-w1.txt') },
    plant: { path: join(workspaceDir, 'notes', 'u7fsmut-plant.txt') },
    denied: { path: join(workspaceDir, 'secret', 'u7fsmut-denied.txt') },
    img: { path: join(workspaceDir, 'notes', 'u7fsmut-img.png') },
  }
  const W1_CONTENT = `${claims.w1}\nwritten-by-governed-write\n`
  const PLANT_BEFORE_CONTENT = `${claims.plantBefore} line one\nline two stays\n`
  const PLANT_AFTER_CONTENT = `${claims.plantAfter} line one\nline two stays\n`
  const DENIED_CONTENT = `${claims.denied}\n`
  const CTL_CONTENT = `${claims.ctl}\nnative-control-write\n`
  const DENIED_ATTEMPT = 'OVERWRITE-ATTEMPT-NEVER-LANDS\n'
  // R1 boot-5 fix (u7fsmut4 evidence): the native ctl write addresses its
  // OWN session workspace by RELATIVE name — the host sandbox scopes the
  // native row to the session root, and cross-workspace absolute paths are
  // denied there (measured, verbatim, in the boot-4 transcript). Where it
  // lands is DISCOVERED by the disk oracle, never assumed.
  const CTL_FILE_NAME = 'u7fsmut-ctl-native.txt'
  const markers = {
    MK_DISC: `FSMUT_DISC_${rs}`,
    MK_L1: `FSMUT_L1_${rs}`,
    MK_STRICT: `FSMUT_STRICT_${rs}`,
    MK_CTL: `FSMUT_CTL_${rs}`,
  }
  const tokens = (n) => `u7fsmut-${n}-${rs}`
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
      staticModel: { provider: 'deepseek-official', model: 'u7fsmut-model' },
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
      // THE U7-9a SURFACE: the teamToolPlane config the u6-fs read World
      // proved (measured boot u7fsmut1: WITHOUT centerAssembly the PA edge
      // opens on no read authority generation and every governed call dies
      // TOOL_BINDING_UNVERIFIED — the generation leg is part of the proven
      // mount shape, not an add-on). The kernel assembles write/edit/
      // read_image beside read from this ONE declaration: no new flag, no
      // new row, no NEW KEY (the CA-01 claim — a new family member needs
      // zero center and zero assembly-config growth).
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
  function planeRootDir() {
    try { return realpathSync(workspaceDir) } catch { return workspaceDir }
  }

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the u7fsmut assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:', '  - templateId: strict', '    persona: "You are a worker of the u7fsmut assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. `strict` carries default DENY plus EXACT allow rules
   * that name every class the legs exercise:
   *   write(w1)        — the governed write effect (and tool-invoke(write));
   *   edit(plant)+read(plant) — the paired M-02 effect set: the center
   *                     covers the edit's READ effect only with a read-class
   *                     rule (measured law, pinned offline in C1's E-1);
   *   read_image(img)  — read-class rule: covers tool-invoke(read_image)
   *                     AND its read effect over the exact image path.
   * The DENIED target is NEVER NAMED (the u6-fs measured law: a named deny
   * poisons the class into Ask; default-deny answers with the kernel's own
   * typed word before any byte). The boot-root ctl session is UNGOVERNED —
   * no member template needed for the native control leg.
   */
  function mainBlueprintYaml(denyList) {
    const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
    const allow = (ind, tool, p) => [
      `${ind}- tool: ${tool}`,
      `${ind}  resource:`,
      `${ind}    kind: exact`,
      `${ind}    path: ${JSON.stringify(p)}`,
    ]
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the u7fsmut assembly team. ${markers.MK_L1} drives your chain: create one governed member, then run the delegated script exactly as instructed.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
      'members:',
      '  - templateId: strict', '    displayName: "u7fsmut governed worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7fsmut assembly team (governed lane). Follow the delegated script exactly, one tool call at a time.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...denyLines.map((l) => `  ${l}`),
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: deny',
      '        allow:',
      ...allow('          ', 'write', files.w1.path),
      ...allow('          ', 'edit', files.plant.path),
      ...allow('          ', 'read', files.plant.path),
      ...allow('          ', 'read_image', files.img.path),
      '        ask: []',
      '        deny: []',
      // The CI-03 control lane (the u6-fs/ARC-D precedent): NO `capabilities`
      // block at all. The plane never binds this member's tools, so its
      // NATIVE preset write answers — byte-for-byte untouched by U7-9a.
      // (run-1 measured law: the boot-root session is itself governed — a
      // plane-owned name there refuses fail-closed; the honest native
      // control is the capabilities-less member, not the ungoverned-looking
      // root.)
      '  - templateId: ctl', '    displayName: "u7fsmut legacy control worker"',
      `    persona: ${JSON.stringify('You are a worker of the u7fsmut assembly team (legacy control lane). Follow the delegated script exactly, one tool call at a time.')}`,
      'memberEnvelopes:',
      '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
      '  - templateId: ctl', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
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
        id: BASE_PRESET_ID, displayName: 'u7fsmut base',
        description: `u7fsmut base preset (${runStamp}) = smoke (tool-fs native family)`,
        plugins: basePlugins,
      }),
    ]
  }

  /** Plant facts + anchor blueprint BEFORE the spawn. Returns the pre-run
   *  disk truth the refusal verdict byte-compares against (planted HERE,
   *  before any host process exists — nothing in the run can rewrite it). */
  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    mkdirSync(join(workspaceDir, 'secret'), { recursive: true })
    writeFileSync(files.plant.path, PLANT_BEFORE_CONTENT)
    writeFileSync(files.denied.path, DENIED_CONTENT)
    writeFileSync(files.img.path, Buffer.from(PNG_1PX_B64, 'base64'))
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return {
      deniedShaBefore: sha256File(files.denied.path),
      plantShaBefore: sha256File(files.plant.path),
      w1ExistsBefore: false, // asserted, never assumed: notes/ was just created empty
      ctlExistsBefore: false,
    }
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }

  /** The runner's independent disk oracle: bytes as they ARE, read by the
   *  test process (the host never reports about itself). */
  function readOracleFacts() {
    const bytesOf = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }
    const shaOf = (p) => { try { return sha256File(p) } catch { return null } }
    // ctl: the native row answered into ITS OWN session root — the disk
    // truth is found by walking HOME for the run-unique bytes (EXACT whole
    // file equality; transcripts that merely QUOTE the claim can never
    // equal it). The found path is part of the witness.
    const ctlTruth = (() => {
      // boot-5 (u5x) MEASURED: the native ctl write landed in the member
      // session's own root (the runtime checkout under repoRoot) — the
      // host sandbox scopes NATIVE rows to the session root, which is NOT
      // the world home. Walk both; EXACT equality keeps transcripts out.
      const sessionRoot = join(repoRoot, 'tests', 'deepseek-harness-test-use')
      const stack = [home, sessionRoot]
      let guard = 0
      for (;;) {
        const dir = stack.pop()
        if (dir === undefined || guard++ > 20_000) break
        let entries = []
        try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
        for (const e of entries) {
          const q = join(dir, e.name)
          if (e.isDirectory()) { stack.push(q); continue }
          if (!e.isFile()) continue
          let content = null
          try { content = readFileSync(q, 'utf8') } catch { continue }
          if (content === CTL_CONTENT) return { ctlBytes: content, ctlFoundPath: q }
        }
      }
      return { ctlBytes: null, ctlFoundPath: null }
    })()
    return {
      w1Bytes: bytesOf(files.w1.path),
      plantBytes: bytesOf(files.plant.path),
      deniedBytes: bytesOf(files.denied.path),
      deniedShaAfter: shaOf(files.denied.path),
      ctlBytes: ctlTruth.ctlBytes,
      ctlFoundPath: ctlTruth.ctlFoundPath,
      imgShaStable: shaOf(files.img.path),
    }
  }

  return {
    rs,
    ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID,
    blueprintDir, workspaceDir, files, claims, markers, tokens,
    W1_CONTENT, PLANT_BEFORE_CONTENT, PLANT_AFTER_CONTENT, DENIED_CONTENT, CTL_CONTENT, CTL_FILE_NAME, DENIED_ATTEMPT,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readOracleFacts,
  }
}

/**
 * The scripted provider for one `u7fsmut` World (u6-fs lane law: lanes are
 * keyed on the delegation request token; the LAST user text discriminates
 * triggers/discovery/wakes; a tool-result turn continues its issuer).
 * Member script (strict, token d1): WRITE w1 → EDIT plant → WRITE denied
 * (never-named → typed refusal) → READ_IMAGE img → DONE. The ctl trigger
 * runs the NATIVE write on the boot-root (ungoverned) session.
 */
export function makeFsMutDecide({ assembly }) {
  const { tokens, markers, files } = assembly
  const steps = { strict: 0, ctl: 0 }
  const ids = {}
  const PHASES = [
    { kind: 'create', template: 'strict', tok: 'c1', label: 'fsmut-strict' },
    { kind: 'create', template: 'ctl', tok: 'c2', label: 'fsmut-ctl' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_STRICT, which: 'strict', fence: 'FSMUT_STRICT_DONE' },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_CTL, which: 'ctl', fence: 'FSMUT_CTL_DONE' },
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
    if (lu.includes('FSMUT_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'strict'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'ctl'
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
    if (lane === 'title') return { kind: 'text', content: 'u7fsmut assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'FSMUT_NOOP_DONE' }
    if (lane === 'ctl') {
      // the CI-03 NATIVE control: this member carries NO capabilities block,
      // the plane binds nothing for it — its preset write row answers
      // natively (the family never touches what it does not own).
      if (steps.ctl++ === 0) return toolCall('write', { file_path: assembly.CTL_FILE_NAME, content: assembly.CTL_CONTENT })
      return { kind: 'text', content: 'FSMUT_CTL_DONE' }
    }
    if (lane === 'strict') {
      const step = steps.strict
      steps.strict += 1
      if (step === 0) return toolCall('write', { file_path: files.w1.path, content: assembly.W1_CONTENT })
      if (step === 1) return toolCall('edit', { file_path: files.plant.path, old_string: assembly.claims.plantBefore, new_string: assembly.claims.plantAfter })
      if (step === 2) return toolCall('write', { file_path: files.denied.path, content: assembly.DENIED_ATTEMPT })
      if (step === 3) return toolCall('read_image', { file_path: files.img.path })
      return { kind: 'text', content: 'FSMUT_STRICT_DONE' }
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
    if (seen.length >= 2 && ids.ctl === undefined) ids.ctl = seen[1]
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        phase += 1
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which ?? 'strict']
        if (inst === undefined) return { kind: 'text', content: `FSMUT_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `fsmut-${ph.tok}`, prompt: ph.prompt, async: true })
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
      return { kind: 'text', content: `FSMUT_FENCE_HOLD_${ph.fence}` }
    }
    return { kind: 'text', content: 'FSMUT_L1_DONE' }
  }
}

/**
 * Pure verdicts over COLLECTED facts (no I/O — the runner supplies oracle
 * bytes, host-log hit lines, lane completion, hostAlive). Every PASS names
 * its witnesses; refusals are proven by BYTE COMPARISON, never by prose.
 */
export function judgeU7FsMut({ before, oracle, log, journal = [], laneDone, hostAlive, healthOk, stateOk, surface }) {
  const out = []
  const logLines = (pat) => log.filter((l) => l.includes(pat))
  const governedWriteRan = logLines('governed-write RAN')
  const governedEditRan = logLines('governed-edit RAN')
  const governedReadImage = logLines('governed-image')
  const denyRefusals = logLines('governed-write').filter((l) => l.includes('refusal') && !l.includes('RAN'))
  const placement = logLines('placement-feed rows=')
  const mountOk = healthOk && stateOk && placement.length > 0
    && surface.includes('write') && surface.includes('edit') && surface.includes('read_image')
    && hostAlive
  out.push(['fsm:mounted', mountOk ? 'PASS' : 'FAIL', {
    healthOk, stateOk,
    placementFeed: placement.length > 0 ? placement[placement.length - 1].slice(0, 240) : null,
    surfaceHas: ['write', 'edit', 'read_image', 'read'].map((n) => `${n}=${surface.includes(n)}`).join(','),
    hostAlive,
  }])
  out.push(['fsm:write-positive', oracle.w1Bytes === before.W1_CONTENT
    && governedWriteRan.some((l) => l.includes('u7fsmut-w1.txt'))
    && laneDone.strict === true && hostAlive ? 'PASS' : 'FAIL', {
    oracleBytesEqual: oracle.w1Bytes === before.W1_CONTENT,
    oracleBytesHead: String(oracle.w1Bytes ?? '').slice(0, 120),
    ranLine: governedWriteRan.find((l) => l.includes('u7fsmut-w1.txt'))?.slice(0, 220) ?? null,
    laneStrictDone: laneDone.strict === true, hostAlive,
  }])
  out.push(['fsm:edit-positive', oracle.plantBytes === before.PLANT_AFTER_CONTENT
    && !String(oracle.plantBytes ?? '').includes(before.PLANT_BEFORE)
    && governedEditRan.some((l) => l.includes('u7fsmut-plant.txt'))
    && hostAlive ? 'PASS' : 'FAIL', {
    oracleBytesEqual: oracle.plantBytes === before.PLANT_AFTER_CONTENT,
    beforeTokenGone: !String(oracle.plantBytes ?? '').includes(before.PLANT_BEFORE),
    oracleBytesHead: String(oracle.plantBytes ?? '').slice(0, 120),
    ranLine: governedEditRan.find((l) => l.includes('u7fsmut-plant.txt'))?.slice(0, 220) ?? null,
    hostAlive,
  }])
  const deniedUntouched = oracle.deniedShaAfter !== null && oracle.deniedShaAfter === before.deniedShaBefore
  const deniedOnRanLine = governedWriteRan.some((l) => l.includes('u7fsmut-denied.txt'))
  // boot-5 (u5x seq 19) MEASURED: the denied-target write can be refused
  // HIGHER than the plane row — the host's own TEMPLATE permission layer
  // answers `Error: permission denied: write[...]: effective deny` and the
  // governed row is never dispatched. That is the governance stack refusing
  // with zero effect, proven by sha identity + the tool_result witness; the
  // journal is that witness class (the head the host itself returned).
  const journalText = (e) => JSON.stringify(e?.resultHead ?? '')
  const templateDenials = journal.filter((e) => e?.lastCall === 'write' && /permission denied/i.test(journalText(e)) && journalText(e).includes('u7fsmut-denied.txt'))
  const refusalArm = denyRefusals.length > 0 ? 'plane-row-refused'
    : templateDenials.length > 0 ? 'template-layer-denied' : 'silent'
  out.push(['fsm:refusal-zero-effect', deniedUntouched && refusalArm !== 'silent' && !deniedOnRanLine && hostAlive ? 'PASS' : 'FAIL', {
    arm: refusalArm,
    shaBefore: before.deniedShaBefore, shaAfter: oracle.deniedShaAfter, shaIdentical: deniedUntouched,
    refusalLines: denyRefusals.length, refusalSample: denyRefusals[0]?.slice(0, 220) ?? templateDenials[0] ? journalText(templateDenials[0]).slice(0, 220) : null,
    deniedPathOnRanLine: deniedOnRanLine, hostAlive,
    disclosure: refusalArm === 'template-layer-denied'
      ? 'refusal executed at the host TEMPLATE permission layer (deny held before the plane row — the plane never dispatched; zero effect proven by sha identity and the tool_result witness)'
      : null,
  }])
  // The honest-answer law for the image lane: EITHER the governed row RAN
  // and answered, OR it refused with a typed IMAGE_*/store word and zero
  // RAN line. Silence or an unexplained success fails. A refusal on the
  // mock-route capability gate is a DISCLOSED ENV arm, never a fake pass.
  const imageRan = governedReadImage.filter((l) => l.includes('RAN'))
  const imageRefused = governedReadImage.filter((l) => /IMAGE_[A-Z_]+|image-[a-z-]+|attachment|pa-refused|lane-denied/i.test(l))
  const rowSentences = journal.filter((e) => e?.lastCall === 'read_image' && /refused-/.test(journalText(e)) && journalText(e).includes('u7fsmut-img.png'))
  const imageArm = imageRan.length > 0 ? 'positive'
    : imageRefused.length > 0 ? 'typed-refusal'
      : rowSentences.length > 0 ? 'typed-refusal' : 'silent'
  out.push(['fsm:image-lane-honest', (imageArm === 'positive' || imageArm === 'typed-refusal') && hostAlive ? 'PASS' : 'FAIL', {
    arm: imageArm,
    ran: imageRan[0]?.slice(0, 200) ?? null,
    refusal: imageRefused[0]?.slice(0, 220) ?? (rowSentences[0] ? journalText(rowSentences[0]).slice(0, 260) : null),
    witness: imageRefused.length > 0 ? 'host-log' : rowSentences.length > 0 ? 'row-sentence-in-tool-result' : null,
    imgShaStable: oracle.imgShaStable,
    disclosure: imageArm === 'typed-refusal'
      ? 'R1 law: the attachment commit rides the fingerprinted effect set as domain-ref(attachment-store); the closed admission grammar has NO grantable rung for it (admission-kernel RESOURCE_EFFECT_KINDS, protected center), so the Kernel MUST refuse the set and the row commits NOTHING — a row-level typed refusal is the honest arm, pinned in C1 I-12/I-13; the commit mechanics are pinned admitted-state in C1 I-2/I-3'
      : null,
    hostAlive,
  }])
  const ctlNativeRanOnGoverned = governedWriteRan.some((l) => l.includes('ctl-native'))
  out.push(['fsm:ctl-native-write', oracle.ctlBytes === before.CTL_CONTENT
    && !ctlNativeRanOnGoverned && laneDone.ctl === true && hostAlive ? 'PASS' : 'FAIL', {
    oracleBytesEqual: oracle.ctlBytes === before.CTL_CONTENT,
    oracleBytesHead: String(oracle.ctlBytes ?? '').slice(0, 120),
    ctlFoundPath: oracle.ctlFoundPath ?? null,
    governedRanSawCtlPath: ctlNativeRanOnGoverned,
    laneCtlDone: laneDone.ctl === true, hostAlive,
  }])
  return out
}
