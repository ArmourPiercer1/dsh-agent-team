/**
 * tests/world-factory/suites/140-u7r3-bootwave.mjs — the `u7r3-bootwave` C2
 * boot-wave suite: ONE World, ONE boot, TWO capability members in ONE team
 * session.
 *
 *   LEG R  the governed `read_image` row on the ASK lane, closed end to end
 *          against the REAL host attachment store and the REAL durable Control
 *          bridge (the C1 probe at evidence/u7r3-readimage-20261030 proved the
 *          interface offline with stand-in ports; this is its boot version):
 *            R1  ask row #1 answered ALLOW  → typed grant minted →
 *                `governed-image RAN` → EXACTLY ONE new object under
 *                <DSH_HOME>/attachments/v1/objects, whose file name is the
 *                sha256 of its own bytes and equals the attachmentId the model
 *                received; the tool output the model saw is TWO blocks (the
 *                `<path>/<type>image/<content>` envelope + the image block);
 *                the model surface carries exactly ONE `read_image` row and it
 *                is the GOVERNED text, not the native one.
 *            R2  ask row #2 (a second image call in the same world) answered
 *                DENY → typed `APPROVAL_DENIED`, and the store census never
 *                moves: zero new objects, zero new workspace files.
 *            R3  a third image call on an over-pixel-law PNG → the store's own
 *                typed law word (`IMAGE_TOO_MANY_PIXELS` family) and again
 *                ZERO commit. Only ever ONE `governed-image RAN` line exists.
 *   LEG U  the ask_user_question L4 positive re-run (the f4 cells in the
 *          answer-fixture form): a governed member with `default: ask` and NO
 *          rule → durable ask row → runner allow over team.resolveControl v4 →
 *          the $events waterfall answered over POST /api/$events/result →
 *          `governed-ask RAN` with the human's answer back in the tool_result;
 *          plus the honest `ui:live-root-law` recording (NOT_REACHED-safe).
 *
 * The runner plays the Human resolver exactly as u7-f-web / u7r3-uif4 proved
 * it: the p6t6 ledger face READS (`team.getLedgerPage`), the public
 * `team.resolveControl` v4 SETTTLES, and the LEADER carries no control tool —
 * no decision in this record can have come from the model lane. The decision
 * law is pinned and recorded per row (read_image: allow, deny, allow;
 * ask_user_question: allow); anything unmatched is denied and disclosed.
 *
 * INVOCATION LAW (the uif4 lesson): run through `u5-canary-runner.mjs` WITH
 * `--run-record <path>` so the durable RUN record exists, and with a
 * per-start budget ledger (`--budget-ledger`), one spawn per recorded start.
 *
 * `--dry` (this module, invoked directly) is the pre-spawn half ONLY: the same
 * host-base assert, the same branded sandbox pre-flight in check mode, the
 * port/host probes, a real World materialization (home + patch layer), the
 * exact assembly, and BOTH blueprints run through the host's own strong
 * blueprint validator (the pinned dist face). It never calls startMock or
 * startHost, so nothing is spawned and no boot happens; the World it created
 * is torn down before it exits. Zero host starts, zero budget.
 *
 * Honesty law: a verdict is earned by a named witness (a host-log observe
 * line, the ledger face, the mock transcript's tool_result head, or the
 * runner's own disk reads). Silence is FAIL; a step the drive never arrived at
 * is NOT_REACHED; ENV_BLOCK never counts as PASS. A failing cell always
 * carries its attributable RCA summary (class + evidence paths), which is the
 * material the same-class stop-line law consumes.
 *
 * @module tests/world-factory/suites/140-u7r3-bootwave
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { apiPrompt, authenticate, emitPatchLayer, fetchJson, stableInstanceProbe, TestWorldFactory } from '../lib/world-factory.mjs'
import { hasMarker, lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf, toolCall } from '../lib/u6-fs-assembly.mjs'
import { classifyUnwitnessedArm, envSignal } from '../lib/arm-verdict.mjs'
import { createEventsAnswerer, EVENTS_ENDPOINT, EVENTS_RESULT_ENDPOINT, REMOTE_MUX_PATH } from '../lib/u7r3-uif4-answer.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { findTestRepoRoot, HOST_PORT_BANDS, MOCK_PORT_BANDS, TEST_USE_BASELINE_SHA, testUseTree } from '../../paths.mjs'

export const SUITE_NAME = 'u7r3-bootwave'

export const CASES = Object.freeze([
  'ri:placement-one-row',
  'ri:ask-approved-ran',
  'ri:attachment-commit-one',
  'ri:tool-output-two-blocks',
  'ri:answered-deny-zero-effect',
  'ri:store-law-zero-commit',
  'ui:ask-approved-ran',
  'ui:live-root-law',
  'bw:leak-check',
])

/** The observe vocabulary this lane listens for — every word is a line the
 *  pinned production rows print (fs-family/src/image-executor.mjs,
 *  fs-family/src/image-row.mjs, the a5p2prod audit arm, the a5-plane feed). */
export const LOG_RE = /governed-image|governed-ask|admission-requires-approval|admission-grant-minted|admission-approved-grant-issued|admission-denied|placement-feed rows=|a5-plane: placed \[|a5-plane: (mount|placement)-REFUSED|PLANE_UI_REGISTRATION_REFUSED|PLANE_PLACEMENT_CONFLICT|TOOL_BINDING_UNVERIFIED|NO_PROVIDER/

/** The governed row's own description (fs-family/src/image-row.mjs). The
 *  native host row says "Read a PNG/JPEG/WebP/GIF file and return the image
 *  itself." — the two texts discriminate the shadowing question. */
export const GOVERNED_IMAGE_DESCRIPTION_MARKER = 'governed image file'

/** The catalog model that declares image input on the pinned host generation
 *  (H:packages/llm/llm-deepseek/src/models.ts DEFAULT_MODELS: deepseek-flash
 *  inputModalities ['text','image']); an uncatalogued id resolves ['text']
 *  and the route gate then refuses with IMAGE_MODEL_NOT_CAPABLE — which is why
 *  the WORLD's staticModel carries this exact id (the wire still goes to the
 *  leased mock; no vision model is needed, only the declared modality). */
export const IMAGE_CAPABLE_MODEL = 'deepseek-flash'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

// ─────────────────────────────────────────────────────────────────────────────
// PNG fixtures, built here with zero image library: signature + IHDR + one
// zlib IDAT + IEND. All-black pixels, filter byte 0 — a raster sharp decodes
// exactly like any other. The sizes are chosen against the store's OWN pinned
// limits (H:packages/attachment/attachment-local/src/index.ts):
//   maxImageBytes 20 MiB · maxImagePixels 64_000_000 · maxImageDimension 8192
// so the small pair passes and the big one crosses the decoded-pixel law by
// ~37k pixels while every side stays inside the per-side law — the refusal is
// attributable to the PIXEL law, not to a dimension or byte accident.
// ─────────────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
/** @param {{width:number,height:number,colorType?:number}} input */
export function buildPng({ width, height, colorType = 0 }) {
  const channels = colorType === 0 ? 1 : 3
  const stride = 1 + width * channels
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = colorType
  const idat = deflateSync(Buffer.alloc(stride * height, 0), { level: 6 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// The World assembly. The ROW face is the proven u7-f-ui shape (f3/f4 booted
// it): the production Team row + p6t6 observer + preset declaration row on the
// shadow center with the confined-provider trio, `uiFamilyEnabled: true`. The
// fs family (read/write/edit/read_image) mounts from the SAME row's
// `fsInstance` — one declaration, no new row, no new key (the CA-01 law the
// u7-fs-mut world proves live). The PERMISSION face is the two-lane ask shape:
// `imgov` names read_image on the ASK lane over the governed root (the C1
// A-3 shape), `uigov` carries default ask with NO rule (the closed grammar
// names no interaction effect, so a governed question is an Ask by
// construction). `request-control` rides both the team envelope and each
// member envelope (the u7-4a measured law: without it no ask row is created).
// ─────────────────────────────────────────────────────────────────────────────
export function createBootwaveAssembly({ repoRoot, home, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `bootwave-base-${rs}`
  const BP_ANCHOR_ID = 'team.bootwave.anchor'
  const BP_MAIN_ID = 'team.bootwave.main'
  const ROOT = `session-bootwave-root-${rs}`
  const CREATE_ROOT = `session-bootwave-team-${rs}`
  const blueprintDir = join(home, 'blueprints')
  const workspaceDir = join(home, 'workspace')
  const PLANE_REALM_ID = `bootwave-realm-${rs}`
  const LAUNCHER = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha = () => createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  const SHADOW_LEDGER = join(home, 'bootwave-shadow-ledger.jsonl')

  const markers = {
    MK_DISC: `BOOTWAVE_DISC_${rs}`,
    MK_L1: `BOOTWAVE_L1_${rs}`,
    MK_IMG: `BOOTWAVE_IMG_${rs}`,
    MK_UI: `BOOTWAVE_UI_${rs}`,
  }
  const claims = {
    answer: `BOOTWAVE_HUMAN_ANSWER_${rs}`,
  }
  const tokens = (n) => `bootwave-${n}-${rs}`
  const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

  const files = {
    good: join(workspaceDir, 'notes', 'bootwave-good.png'),
    deny: join(workspaceDir, 'notes', 'bootwave-denied.png'),
    huge: join(workspaceDir, 'notes', 'bootwave-huge.png'),
  }
  const ANSWER_LABEL = 'Option A'

  /** The attachment store the pinned host owns: <DSH_HOME>/attachments/v1
   *  with objects at objects/<sha[0:2]>/<sha> (H:attachment-local/src/store.ts
   *  normalizedImagePath) — the runner reads this directory itself. */
  const storeRoot = join(home, 'attachments', 'v1')

  function planeRootDir() {
    try { return realpathOr(workspaceDir) } catch { return workspaceDir }
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
      staticModel: { provider: 'deepseek-official', model: IMAGE_CAPABLE_MODEL },
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

  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the bootwave assembly team. ${markers.MK_DISC} is the discovery marker."`,
    'members:',
    '  - templateId: imgov', '    persona: "You are an image worker of the bootwave assembly team."',
    '  - templateId: uigov', '    persona: "You are a UI worker of the bootwave assembly team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  /**
   * The main blueprint. Names that the governed families own never enter
   * builtinToolDeny (the fs family + the UI family own their own names); the
   * list arrives from the live discovery surface, exactly as f4 computed it.
   */
  function mainBlueprintYaml(denyList) {
    const FAMILY_OWNED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'ask_user_question', 'present']
    const kept = (denyList ?? []).filter((n) => !FAMILY_OWNED.includes(n))
    const denyLines = kept.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...kept.map((n) => `      - ${n}`)]
    const memberDeny = denyLines.map((l) => `  ${l}`)
    return [
      '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
      'leader:', '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the bootwave assembly team. ${markers.MK_L1} drives your chain: create the two governed members, then run each delegated script exactly as instructed and collect the results.`)}`,
      '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
      '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
      // NO team_resolve_control / team_list_pending_control: the Human public
      // seam is the ONLY resolver in this record (u7-f-web's law).
      ...denyLines,
      '    skills:', '      kind: allow', '      items: []',
      '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
      'teamEnvelope:', '  allow:',
      '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - request-control',
      '  deny: []',
      'members:',
      // ── LEG R member: read_image lives on the ASK lane over the root. ─────
      '  - templateId: imgov', '    displayName: "bootwave governed image worker"',
      `    persona: ${JSON.stringify('You are an image worker of the bootwave assembly team (governed read_image lane). Follow the delegated script exactly, one tool call at a time, and never invent image content.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...memberDeny,
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []',
      '        ask:', '          - tool: read_image', '            resource:', '              kind: subtree',
      `              path: ${JSON.stringify(planeRootDir())}`,
      '        deny: []',
      // ── LEG U member: default ask, NO rule (interaction Ask by construction).
      '  - templateId: uigov', '    displayName: "bootwave governed UI worker"',
      `    persona: ${JSON.stringify('You are a UI worker of the bootwave assembly team (governed ask_user_question lane). Follow the delegated script exactly, one tool call at a time. You never invent an answer to a refused question.')}`,
      '    capabilities:', '      teamTools:', '        kind: deny',
      ...memberDeny,
      '      skills:', '        kind: allow', '        items: []',
      '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes:',
      '  - templateId: imgov', '    envelope:', '      allow:',
      '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      '  - templateId: uigov', '    envelope:', '      allow:',
      '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
      'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
  }

  function teamRows() {
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run bash commands. State persists across calls.',
    })
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'bootwave base',
        description: `bootwave base preset (${runStamp}) = fs family + UI family governed, uiFamilyEnabled ON`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspaceDir, 'notes'), { recursive: true })
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(files.good, buildPng({ width: 4, height: 4, colorType: 2 }))
    writeFileSync(files.deny, buildPng({ width: 8, height: 8, colorType: 0 }))
    // 8192x7817 = 64,036,864 decoded pixels: over the store's 64,000,000
    // decoded-pixel law, every side inside the 8192 per-side law, and ~60 KB
    // on disk — the refusal can only come from the pixel law.
    writeFileSync(files.huge, buildPng({ width: 8192, height: 7817, colorType: 0 }))
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
    return {
      pngShas: Object.fromEntries(Object.entries(files).map(([k, p]) => [k, sha256File(p)])),
      pngSizes: Object.fromEntries(Object.entries(files).map(([k, p]) => [k, readFileSync(p).length])),
      workspaceCensusBefore: censusFiles(workspaceDir),
      storeCensusBefore: censusFiles(storeRoot),
      blueprints: { anchorBytes: Buffer.byteLength(BP_ANCHOR_YAML) },
    }
  }
  function writeMainBlueprint(denyList) {
    writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))
  }
  function readOracleFacts() {
    return {
      pngShas: Object.fromEntries(Object.entries(files).map(([k, p]) => [k, existsSync(p) ? sha256File(p) : null])),
      workspaceCensusAfter: censusFiles(workspaceDir),
      storeCensusAfter: censusObjects(storeRoot),
    }
  }

  function imgArgs(which) {
    return { file_path: files[which] }
  }
  function askArgs() {
    return {
      questions: [{
        id: 'bootwave-q1',
        question: `${markers.MK_UI} which option should the governed lane take?`,
        options: [{ label: ANSWER_LABEL }, { label: 'Option B' }],
      }],
    }
  }

  return {
    rs, ROOT, CREATE_ROOT, BP_ANCHOR_ID, BP_MAIN_ID, BASE_PRESET_ID, PLANE_REALM_ID,
    blueprintDir, workspaceDir, storeRoot, files, claims, markers, tokens, ANSWER_LABEL,
    PRODUCTION_ROW_NAME, GLUE_URL, SEAM_URL, P6T6_ROW_NAME, LAUNCHER,
    teamRowConfig, BP_ANCHOR_YAML, mainBlueprintYaml, teamRows,
    writePreBootFiles, writeMainBlueprint, readOracleFacts, imgArgs, askArgs,
  }
}

/** The governed root must be the REALPATH the host resolves (the u7-fs-mut
 *  law: a symlinked home makes the subtree rule never match). */
function realpathOr(p) {
  try { return realpathSync(p) } catch { return p }
}

/** Recursive file census: relative paths, sorted. A missing directory is an
 *  empty census (the store root does not exist until the first commit). */
export function censusFiles(root) {
  const out = []
  const stack = [root]
  let guard = 0
  for (;;) {
    const dir = stack.pop()
    if (dir === undefined || guard++ > 20_000) break
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const q = join(dir, e.name)
      if (e.isDirectory()) { stack.push(q); continue }
      out.push(q.startsWith(root) ? q.slice(root.length + 1) : q)
    }
  }
  return out.sort()
}

/** The store-object census with the identity check the cell needs: the file
 *  name must be the sha256 of its own bytes (the store's own law). */
export function censusObjects(root) {
  return censusFiles(root).map((rel) => {
    const full = join(root, rel)
    let bytes = 0
    let sha = null
    try {
      const data = readFileSync(full)
      bytes = data.length
      sha = createHash('sha256').update(data).digest('hex')
    } catch { /* unreadable object: reported as-is, never guessed */ }
    const name = rel.split('/').pop() ?? ''
    return { rel, bytes, sha, nameIsSelfSha: sha !== null && name === sha }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * The scripted provider. Lanes: title / disc / imgov (LEG R script) / uigov
 * (LEG U script) / leader (create ×2 → delegate → collect → fence → delegate
 * → collect → fence). The lane detection, the tool-call envelope and the
 * instance-id harvest are the u7r3-uif4 shapes verbatim — this is the same
 * host generation, and every one of these details was measured there.
 */
export function makeBootwaveDecide({ assembly }) {
  const { tokens, markers } = assembly
  const steps = { imgov: 0, uigov: 0 }
  const ids = {}
  const createIssued = { c1: false, c2: false }
  let collectSeq = 0
  const PHASES = [
    { kind: 'create', template: 'imgov', tok: 'c1', label: 'bootwave-imgov', which: 'imgov' },
    { kind: 'create', template: 'uigov', tok: 'c2', label: 'bootwave-uigov', which: 'uigov' },
    { kind: 'delegate', tok: 'd1', prompt: markers.MK_IMG, which: 'imgov', fence: 'BOOTWAVE_IMG_DONE' },
    { kind: 'delegate', tok: 'd2', prompt: markers.MK_UI, which: 'uigov', fence: 'BOOTWAVE_UI_DONE' },
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
    if (lu.includes('BOOTWAVE_PHASE_')) return 'leader'
    if (t.includes('[team-work-settled')) return 'leader'
    const ut = userTextOf(req)
    if (ut.includes(`[team-work requestToken=${tokens('d1')}`)) return 'imgov'
    if (ut.includes(`[team-work requestToken=${tokens('d2')}`)) return 'uigov'
    if (lu.includes('"type":"tool_result"')) {
      const tool = lastToolNameOf(req)
      if (tool !== null && tool.startsWith('team_')) return 'leader'
      return 'other'
    }
    if (lu.includes(markers.MK_L1) || t.includes('[team-root-work')) return 'leader'
    return 'other'
  }
  const leaderHasMarker = (req, marker) => messagesOf(req).map(textOf).join('\n').includes(marker)
  const decide = function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'bootwave assembly session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'BOOTWAVE_NOOP_DONE' }
    // ── LEG R member script: three governed read_image calls, then the fence.
    if (lane === 'imgov') {
      const step = steps.imgov
      steps.imgov += 1
      if (step === 0) return toolCall('read_image', assembly.imgArgs('good'))
      if (step === 1) return toolCall('read_image', assembly.imgArgs('deny'))
      if (step === 2) return toolCall('read_image', assembly.imgArgs('huge'))
      return { kind: 'text', content: 'BOOTWAVE_IMG_DONE' }
    }
    // ── LEG U member script: one governed question, then the fence. The
    // host-LEGAL option shape is {label} ONLY (f4's measured law: an `id` on
    // an option is refused ask-unknown-parameter BEFORE the port).
    if (lane === 'uigov') {
      const step = steps.uigov
      steps.uigov += 1
      if (step === 0) return toolCall('ask_user_question', assembly.askArgs())
      return { kind: 'text', content: 'BOOTWAVE_UI_DONE' }
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
    if (ids.imgov === undefined && seen.length >= 1) ids.imgov = seen[0]
    if (createIssued.c2 && ids.uigov === undefined) {
      const other = seen.find((x) => x !== ids.imgov)
      if (other !== undefined) ids.uigov = other
    }
    while (phase < PHASES.length) {
      const ph = PHASES[phase]
      if (ph.kind === 'create') {
        if (phase > 0 && ids[PHASES[phase - 1].which] === undefined) {
          return { kind: 'text', content: `BOOTWAVE_ID_FAIL_${PHASES[phase - 1].tok}` }
        }
        phase += 1
        createIssued[ph.tok] = true
        return toolCall('team_create_member', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationTemplateId: ph.template, label: ph.label })
      }
      if (!ph.issued) {
        const inst = ids[ph.which]
        if (inst === undefined) return { kind: 'text', content: `BOOTWAVE_ID_FAIL_${ph.tok}` }
        ph.issued = true
        return toolCall('team_delegate', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(ph.tok), delegationInstanceId: inst, label: `bootwave-${String(ph.tok)}`, prompt: ph.prompt, async: true })
      }
      const pending = settledPending(req)
      if (pending.length > 0) {
        for (const tk of pending) collected.add(tk)
        collectSeq += 1
        return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: `coll-${String(phase)}-${String(collectSeq)}`, requestTokens: pending })
      }
      if (leaderHasMarker(req, ph.fence)) { ph.issued = false; phase += 1; fenceRounds = 0; continue }
      fenceRounds += 1
      if (fenceRounds <= 12) return toolCall('team_collect', { rootSessionId: assembly.CREATE_ROOT, requestToken: tokens(`f${String(ph.tok)}-${String(fenceRounds)}`), requestTokens: [tokens(ph.tok)] })
      fenceRounds = 0
      // RCA-3 bug-2: the hold text must NOT embed the fence string. The leader
      // transcript keeps its own past replies, so a text containing
      // BOOTWAVE_IMG_DONE self-satisfied the fence on the next wake round.
      // The vocabulary here is the drive script's own, not a judged law.
      return { kind: 'text', content: `BOOTWAVE_HOLD_${ph.tok.toUpperCase()}_ROUNDS12` }
    }
    return { kind: 'text', content: 'BOOTWAVE_L1_DONE' }
  }
  // Evidence handles: the RUN record carries which instance each lane ran in
  // and how many steps each scripted lane took, so a lane/attribution question
  // is answerable without a second boot.
  decide.ids = ids
  decide.steps = steps
  // RCA-2 instrumentation (bw3): the classify trace answers the ONLY question
  // the steps counter could not — which lane EVERY provider request actually
  // classified as, with the last-user tail that drove the decision and the
  // reply the script chose. Pure observation: no verdict semantics move.
  const trace = []
  const traced = ({ req }) => {
    const res = decide({ req })
    if (trace.length < 160) {
      const luFull = lastUserTextOfStatic(req)
      trace.push({
        lane: laneOf(req),
        lu: luFull.slice(-1600),
        luHead: /ACTIVATION_|_FAILED/.test(luFull) ? luFull.slice(0, 1600) : undefined,
        reply: res.kind === 'tool-call' ? `tool:${String(res.toolCalls?.[0]?.name ?? '?')}` : `text:${String(res.content ?? '').slice(0, 40)}`,
        phase, fenceRounds,
        ids: { imgov: ids.imgov ?? null, uigov: ids.uigov ?? null },
      })
    }
    return res
  }
  traced.ids = ids
  traced.steps = steps
  traced.trace = trace
  return traced
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdicts. Pure over COLLECTED facts: every PASS names its witness, silence
// is FAIL, an unreached step is NOT_REACHED, and every failure carries an RCA
// summary (class + the evidence a human must read) — the same-class stop-line
// law consumes exactly that shape.
// ─────────────────────────────────────────────────────────────────────────────
const rca = (klass, summary, evidence) => ({ rcaClass: klass, rcaSummary: summary, rcaEvidence: evidence })

export function judgeBootwave({ facts, log, journal, laneDone, hostAlive, healthOk, stateOk }) {
  const out = []
  const imageLines = log.filter((l) => l.includes('governed-image'))
  const ranLines = imageLines.filter((l) => l.includes(' RAN '))
  const paDenied = imageLines.filter((l) => l.includes('pa-refused') && /code=APPROVAL_DENIED/.test(l))
  const lawRefused = imageLines.filter((l) => /store-law-refused code=IMAGE_/.test(l))
  const preGate = imageLines.filter((l) => l.includes('pre-gate-refused'))
  const askLines = log.filter((l) => l.includes('governed-ask'))
  const askRan = askLines.filter((l) => l.includes('RAN'))
  const grantAudit = log.filter((l) => /admission-grant-minted|admission-approved-grant-issued/.test(l))
  const placement = log.filter((l) => l.includes('placement-feed rows=') || l.includes('a5-plane: placed ['))
  const chain = facts.approval ?? { requestRows: [], decisions: [], consumed: [], resolutions: [] }
  const resOf = (toolName) => (chain.resolutions ?? []).filter((r) => r.toolName === toolName)
  const imgRows = (chain.requestRows ?? []).filter((r) => r.toolName === 'read_image')
  const askRows = (chain.requestRows ?? []).filter((r) => r.toolName === 'ask_user_question')
  const objects = facts.store?.objects ?? []
  const maxObjects = facts.store?.maxObjectsSeen ?? 0

  // R1a — the model surface carries exactly ONE read_image and it is the
  // governed row (the shadowing question, answered from the LIVE request).
  const surface = facts.surface ?? {}
  out.push(['ri:placement-one-row',
    surface.readImageCount === 1 && surface.readImageIsGoverned === true && surface.placementHasReadImage === true
      ? 'PASS' : 'FAIL', {
    readImageCount: surface.readImageCount ?? null,
    readImageIsGoverned: surface.readImageIsGoverned ?? false,
    readImageDescriptions: surface.readImageDescriptions ?? [],
    placementLines: surface.placementLines ?? [],
    placementHasReadImage: surface.placementHasReadImage ?? false,
    surfaceRequestFound: surface.surfaceRequestFound ?? false,
    surfaceNames: surface.names ?? [],
    law: 'PASS needs the imgov lane model request to carry exactly one tool named read_image, its description to be the governed row text (fs-family/src/image-row.mjs: "Read one governed image file inside this member\'s admitted file root…", never the native "Read a PNG/JPEG/WebP/GIF file…"), AND a mount-time placement line naming read_image. A second row or the native description is a FAIL naming the live shape.',
    ...rca('plane-placement',
      'no exactly-one governed read_image row on the live model surface: read the imgov lane request (body.tools[]) against the mount lines in the host log (grep placement-feed / "a5-plane: placed"); a native-shape row means the governed mount never took the name, two rows means a placement conflict that did not fail closed, and no line at all means the fs family never mounted in this session.',
      ['host log (boot.logPath) grep placement-feed|a5-plane', 'evidence json digest.surface',
        'packages/tools/fs-family/src/image-row.mjs']),
  }])

  // R1b — the positive arm: allow → typed grant → RAN.
  const imgAllow = resOf('read_image').find((r) => r.decision === 'allow') ?? null
  out.push(['ri:ask-approved-ran',
    imgAllow?.ok === true && ranLines.length === 1 && grantAudit.length > 0 && imgRows.length >= 1
      ? 'PASS' : 'FAIL', {
    durableRows: imgRows.length,
    allowResolution: imgAllow,
    grantAuditLines: grantAudit.map((l) => l.slice(0, 200)),
    ranLine: ranLines[0]?.slice(0, 220) ?? null,
    ranCount: ranLines.length,
    preGateRefusals: preGate.map((l) => l.slice(0, 200)),
    decisions: chain.decisions ?? [],
    consumed: chain.consumed ?? [],
    law: 'PASS needs ALL of, for the SAME call: a durable control-request-recorded row (toolName=read_image) answered allow through team.resolveControl v4, the kernel audit naming a minted/approved grant, and exactly ONE `governed-image RAN` line. Zero witnesses is FAIL, never a softening; a pre-gate refusal (IMAGE_MODEL_NOT_CAPABLE / attachment-service-unmounted) is disclosed verbatim here.',
    ...rca('control-bridge',
      'the allow→grant→RAN chain never closed: read the ledger face (control-request-recorded / control-decision-recorded / control-allow-consumed) and the host log governed-image lines; a pre-gate code names the exact gate that stopped it.',
      ['evidence json asks (resolutions/decisions/consumed)', 'host log grep governed-image|admission-',
        'packages/tools/fs-family/src/image-executor.mjs']),
  }])

  // R1c — EXACTLY ONE new store object, and it is the object the model got.
  const identityOk = objects.length === 1 && objects[0]?.nameIsSelfSha === true
    && facts.attachment?.identityMatch === true
  out.push(['ri:attachment-commit-one',
    identityOk && ranLines.length === 1 ? 'PASS' : 'FAIL', {
    storeRoot: facts.store?.storeRoot ?? null,
    objects,
    maxObjectsSeen: maxObjects,
    attachmentIdSeen: facts.attachment?.attachmentIds ?? [],
    modelImageParts: facts.attachment?.modelImageParts ?? [],
    identityMatch: facts.attachment?.identityMatch ?? false,
    law: 'PASS needs: exactly one object under <DSH_HOME>/attachments/v1/objects whose file name IS the sha256 of its own bytes (the store law), and that same sha present in what the model received (attachmentId sha256:<hex> or the inline image part the harness resolved). Zero or two objects is a FAIL naming the census.',
    ...rca('attachment-store',
      'the store census or the sha identity failed: re-list <DSH_HOME>/attachments/v1/objects, sha256sum the object, and compare with the attachmentId/image part in the mock transcript; two objects means a double commit, zero means the commit never happened despite RAN.',
      ['evidence json store + attachment', 'tests/homes/<world>/attachments/v1/objects (before teardown)']),
  }])

  // R1d — the two-block tool output the model saw.
  out.push(['ri:tool-output-two-blocks',
    facts.attachment?.twoBlocks === true ? 'PASS' : 'FAIL', {
    twoBlocks: facts.attachment?.twoBlocks ?? false,
    envelopeHead: facts.attachment?.envelopeHead ?? null,
    imageBlockShape: facts.attachment?.imageBlockShape ?? null,
    law: 'PASS needs the tool_result the model received for the RAN call to carry BOTH the envelope text block (`<path>…</path>`, `<type>image</type>`, `<content>`) and an image block (the family renders {type:image, attachment}; the harness may project it to an image content part — either shape is recorded, the absence of either is FAIL).',
    ...rca('presentation',
      'the two-block render never reached the model: read the mock request whose tool_result names read_image; a text-only result means the attachment block was dropped, an envelope-less result means the row render changed.',
      ['mock transcript (evidence json journal)', 'packages/tools/fs-family/src/image-row.mjs render']),
  }])

  // R2 — the answered-deny arm: typed refusal, zero side effect.
  const imgDeny = resOf('read_image').find((r) => r.decision === 'deny') ?? null
  out.push(['ri:answered-deny-zero-effect',
    imgDeny?.ok === true && (paDenied.length >= 1 || facts.denialTranscript?.kernelDeniedSeen === true) && maxObjects <= 1 && facts.store?.zeroNewObjectsAfterDeny === true
      ? 'PASS' : 'FAIL', {
    denyResolution: imgDeny,
    paDeniedLines: paDenied.map((l) => l.slice(0, 220)),
    denialArm: paDenied.length >= 1 ? 'executor-pa-refused'
      : (facts.denialTranscript?.kernelDeniedSeen === true ? 'kernel-admission' : 'none'),
    denialTranscript: facts.denialTranscript ?? { kernelDeniedSeen: false },
    maxObjectsSeen: maxObjects,
    zeroNewObjectsAfterDeny: facts.store?.zeroNewObjectsAfterDeny ?? false,
    workspaceNewFiles: facts.store?.workspaceNewFiles ?? [],
    ranCount: ranLines.length,
    law: 'PASS needs: the second durable read_image row answered deny over the public seam, a typed refusal visible on a live arm — the family executor naming code=APPROVAL_DENIED OR the member transcript carrying the durable approval refusal text (kernel admission refuses before the executor runs: RCA-7 erratum, bw8 record denialArm=kernel-admission; dated correction — the arm fact for bw8 rests on RCA-8 section 2 via trace entry 74, the denialArm field itself was introduced with the bw9/bw10 records) — and a store census that never exceeds the ONE object R1 committed: zero new objects, zero new files in the governed workspace.',
    ...rca('control-bridge',
      'the deny arm produced a side effect or no typed refusal: compare the store/workspace census before/after the second call with the governed-image pa-refused line; a store object appearing after a deny is a product blocker.',
      ['evidence json store.samples', 'host log grep pa-refused', 'tests/homes/<world>/workspace']),
  }])

  // R3 — the store law leg: typed word, zero commit.
  out.push(['ri:store-law-zero-commit',
    lawRefused.length >= 1 && ranLines.length === 1 && maxObjects <= 1 ? 'PASS' : 'FAIL', {
    storeLawLines: lawRefused.map((l) => l.slice(0, 220)),
    ranCount: ranLines.length,
    maxObjectsSeen: maxObjects,
    pngSizes: facts.plant?.pngSizes ?? null,
    law: 'PASS needs the store\'s OWN law word on the third call (observe line `governed-image store-law-refused code=IMAGE_TOO_MANY_PIXELS|IMAGE_DIMENSION_TOO_LARGE|IMAGE_TOO_LARGE`) with the RAN count still 1 and the object census still 1 — a deterministic law refusal must commit nothing. A pre-gate byte cap instead of the store law is disclosed here, not accepted silently.',
    ...rca('store-law',
      'the over-pixel PNG either committed (product blocker), never reached the store law (check the pre-gate codes and the byte cap), or the call never ran (lane script). The planted PNG is 8192x7817 = 64,036,864 px against the pinned 64,000,000 limit.',
      ['host log grep store-law-refused', 'evidence json plant.pngSizes',
        'tests/deepseek-harness-test-use/packages/attachment/attachment-local/src/{image.ts,index.ts}']),
  }])

  // U1 — the f4 positive cell, re-run in the answer-fixture form.
  const askAllow = resOf('ask_user_question').find((r) => r.decision === 'allow') ?? null
  const answerBack = (journal ?? []).some((e) => e?.lastCall === 'ask_user_question'
    && JSON.stringify(e?.resultHead ?? '').includes(String(facts.answeredLabel ?? 'BOOTWAVE_NO_ANSWER')))
  out.push(['ui:ask-approved-ran',
    askAllow?.ok === true && askRan.length >= 1 && answerBack === true && (facts.answered?.length ?? 0) > 0
      ? 'PASS' : 'FAIL', {
    askRows: askRows.length,
    allowResolution: askAllow,
    ranLine: askRan[0]?.slice(0, 220) ?? null,
    answeredCount: facts.answered?.length ?? 0,
    waterfallFrames: facts.waterfallFrames?.length ?? 0,
    wire: facts.wire ?? null,
    answerBackInToolResult: answerBack,
    law: 'PASS needs ALL of: the durable ask row allowed over team.resolveControl v4, the $events waterfall settled over POST /api/$events/result, `governed-ask RAN`, and the human answer label present in the tool_result the model saw.',
    ...rca('ui-answer-wire',
      'the public answering face never closed the loop: read the answerer wire facts (ready frame, waterfall frames, POST result status) and the governed-ask lines; a port-failure code names the family gate that stopped it.',
      ['evidence json wire + answered', 'host log grep governed-ask',
        'tests/world-factory/lib/u7-uileg0-answer.mjs (pinned shapes)']),
  }])

  // U2 — the honest recording cell (L2, NOT_REACHED-safe by lane order).
  const laneRefusal = (facts.answered ?? []).some((a) => /lane-refusal|DELEGATED_CALLER|CALLER_NOT_LIVE/.test(JSON.stringify(a)))
    || askLines.some((l) => /DELEGATED_CALLER|CALLER_NOT_LIVE/.test(l))
  out.push(['ui:live-root-law',
    laneRefusal || facts.assertLiveRootObserved === true ? 'PASS' : 'NOT_REACHED', {
    laneRefusal,
    assertLiveRootObserved: facts.assertLiveRootObserved === true,
    memberArmReached: askRows.length > 0 || askLines.length > 0,
    askRefusalLines: askLines.filter((l) => !l.includes('RAN')).map((l) => l.slice(0, 200)),
    law: 'L2 as-is: assertLiveRoot only runs when the request carries an Agent; the family port binding passes none, so the open ask never reaches the live-root law. Recorded, never retried, NOT_REACHED-safe by lane order.',
  }])

  facts.mount = { healthOk, stateOk, hostAlive, lanes: laneDone, placementLines: placement.slice(0, 6).map((l) => l.slice(0, 240)) }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// THE BINDING LAW (RULING-B registration discipline, u7r3-b49 precedent): the
// coordinator pins the exact product-tree sha at spawn by exporting
// BOOTWAVE_PRE_REG_SHA. This suite boots ONLY on that sha — a mismatch, a short
// sha, or no pin at all refuses BEFORE any spawn, so an evidence-bound branch
// can never be booted after an accidental rebase. Pure, so the refusal is
// testable without a World.
// ─────────────────────────────────────────────────────────────────────────────
export function preRegistrationVerdict({ pin, headSha }) {
  const trimmed = typeof pin === 'string' ? pin.trim() : ''
  if (trimmed === '') {
    return { ok: false, reason: 'BOOTWAVE_PRE_REG_SHA is not set: this lane boots only on the sha the coordinator pinned at spawn (pre-registration law; never boot an unregistered head)' }
  }
  if (!/^[0-9a-f]{40}$/.test(trimmed)) {
    return { ok: false, reason: `BOOTWAVE_PRE_REG_SHA="${trimmed.slice(0, 16)}…" is not a full 40-hex commit sha` }
  }
  if (trimmed !== headSha) {
    return { ok: false, reason: `pinned ${trimmed} != boot head ${headSha} — evidence-bound branches are forward-merge only (ROUTER_RULES §8.5.7): re-register at the new head instead of booting this one` }
  }
  return { ok: true, reason: `boot head equals the registered sha ${headSha}` }
}

// ─────────────────────────────────────────────────────────────────────────────
// The drive.
// ─────────────────────────────────────────────────────────────────────────────
async function runBootwave({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, findFirstKey, evaluateLeak, git, REPO_ROOT, RUN_LIFETIME_MS }) {
  void findFirstKey
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 260)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASES) if (!done.has(id)) add(id, 'FAIL', {
      reason: why, ...extra,
      ...rca('drive-abort', `the drive aborted before this cell's step: ${why}`, ['RUN record', 'evidence json', 'host log']),
    })
  }

  let world = null
  let answerer = null
  let cleanedUp = false
  const HARD_STOP_MS = 8.5 * 60_000
  const hardStopAt = Date.now() + HARD_STOP_MS
  const overBudget = () => Date.now() > hardStopAt
  const cleanup = async () => {
    if (cleanedUp) return
    cleanedUp = true
    try { answerer?.stop() } catch { /* already gone */ }
    try { await rc.stopChild() } catch { /* idempotent */ }
    let leak = { ok: false, detail: { reason: 'teardown not reached' } }
    try {
      if (world === null) leak = { ok: true, detail: { reason: 'no World was ever created — nothing of this lane is left behind' } }
      else leak = await evaluateLeak({ world, receipts: await world.teardown({ keepHome }), factory })
    } catch (error) {
      leak = { ok: false, detail: { reason: `teardown threw: ${String(error?.message ?? error).slice(0, 160)}` } }
    }
    if (!done.has('bw:leak-check')) add('bw:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  }

  try {
    const waitA = async (predicate, timeoutMs) => {
      const started = Date.now()
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return { hit: true, waitedMs: Date.now() - started }
        if (Date.now() - started >= timeoutMs || overBudget()) return { hit: false, waitedMs: Date.now() - started }
        await sleep(400)
      }
    }

    // ── THE BINDING LAW, enforced before anything exists ───────────────────
    const headSha = git(['rev-parse', 'HEAD'], REPO_ROOT)
    const pin = process.env.BOOTWAVE_PRE_REG_SHA ?? null
    const binding = preRegistrationVerdict({ pin, headSha })
    record.record.bootwavePreRegistration = { pin, headSha, envName: 'BOOTWAVE_PRE_REG_SHA', ...binding }
    if (!binding.ok) {
      for (const id of CASES) {
        if (id === 'bw:leak-check') continue
        add(id, 'FAIL', {
          reason: binding.reason, headSha, pin,
          ...rca('SOURCE_SHA_MISMATCH',
            'the boot refused itself at the binding law: the exported BOOTWAVE_PRE_REG_SHA does not name this checkout\'s HEAD, so the run would have produced evidence bound to an unregistered head. The coordinator either passes BOOTWAVE_PRE_REG_SHA=$(git rev-parse HEAD) of the registered commit or re-registers at the new head.',
            ['RUN record bootwavePreRegistration', 'dev/agent-workflow/evidence/a5w-bootwave-20261030/PRE-REGISTRATION-DRAFT.md', 'git rev-parse HEAD of the boot checkout']),
        })
      }
      log(`binding law refused the boot (zero spawns): ${binding.reason}`)
      return
    }
    log(`binding law satisfied: ${binding.reason}`)

    // ── materialize + boot: ONE host start of the registered budget ─────────
    world = await factory.createWorld({ line, u7FsUi: { rows: [] } })
    worlds.push(world)
    record.record.bindings.worldIds.push(world.id)
    const assembly = createBootwaveAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
    const planted = assembly.writePreBootFiles()
    world.u7FsUi.rows.push(...assembly.teamRows())
    const decide = makeBootwaveDecide({ assembly })
    await world.startMock({ decide })
    record.logHostStart({ world: world.id, phase: 'bootwave-boot1' })
    rc.arm()
    const startPromise = world.startHost()
    const child = world.instance?.child ?? null
    if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
    let boot
    try {
      boot = await startPromise
    } catch (error) {
      failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
      return
    }
    const origin = `http://127.0.0.1:${boot.port}`
    const hostPorcelain = git(['status', '--porcelain'], factory.hostTree)
    // The transcript header the sketch asks for, on the record AND on stdout.
    const header = {
      suite: SUITE_NAME, runId, productHead: git(['rev-parse', 'HEAD'], REPO_ROOT),
      productPorcelain: git(['status', '--porcelain', '--untracked-files=no'], REPO_ROOT),
      hostTree: factory.hostTree, hostHead: git(['rev-parse', 'HEAD'], factory.hostTree),
      hostPorcelainLines: hostPorcelain === '' ? 0 : hostPorcelain.split('\n').length,
      dshHome: world.home, dateUtc: new Date().toISOString(),
      ports: { host: boot.port, mock: world.mock?.port ?? null, leasedFrom: 'HOST_PORT_BANDS 3181-3199→13000-13049 / MOCK_PORT_BANDS 3491-3500→13050-13099 (lib/port-lease.mjs)' },
      logPath: boot.logPath,
    }
    record.record.bootwaveRun = header
    log(`transcript-header ${JSON.stringify(header)}`)

    let health = null
    const healthW = await waitA(async () => {
      const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      health = st
      return st.status === 200 && st.body?.ok === true
    }, 60_000)
    let stateBody = null
    const stateW = await waitA(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      stateBody = st.body
      return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
    }, 45_000)
    if (!healthW.hit || health?.body?.ok !== true || !stateW.hit) {
      failRest(`mount readiness failed: health=${String(health?.status)} stateHit=${String(stateW.hit)}`, { header })
      return
    }
    const cookie = await authenticate(origin, world.token)

    // ── the answering arm is OPEN before any question can exist ─────────────
    answerer = createEventsAnswerer({ port: boot.port, cookie, log })
    const facts = {
      wire: { muxPath: REMOTE_MUX_PATH, endpoint: EVENTS_ENDPOINT, resultEndpoint: EVENTS_RESULT_ENDPOINT, readySeen: false, waterfallSeen: false, resultAccepted: false },
      approval: { requestRows: [], decisions: [], consumed: [], resolutions: [] },
      answered: [], waterfallFrames: [], answeredLabel: assembly.ANSWER_LABEL,
      assertLiveRootObserved: false,
      plant: planted,
      store: { storeRoot: assembly.storeRoot, objects: [], maxObjectsSeen: planted.storeCensusBefore.length, samples: [], zeroNewObjectsAfterDeny: false, workspaceNewFiles: [] },
      attachment: {},
      surface: {},
    }
    await answerer.start()
    const ready = await answerer.waitReady(12_000)
    facts.wire.openError = answerer.facts.openError
    facts.wire.readySeen = ready
    facts.wire.readyFrame = answerer.facts.readyFrame
    const pumpAnswers = async () => {
      const fresh = await answerer.answerPending(fetchJson)
      for (const entry of fresh) {
        facts.answered.push(entry)
        if (entry.httpStatus === 200 && /"ok"\s*:\s*true/.test(entry.responseHead)) facts.wire.resultAccepted = true
        if (/DELEGATED_CALLER|CALLER_NOT_LIVE|lane-refusal/.test(entry.responseHead)) facts.assertLiveRootObserved = true
      }
      if (answerer.facts.waterfallFrames.length > 0) {
        facts.waterfallFrames = answerer.facts.waterfallFrames
        facts.wire.waterfallSeen = true
      }
    }

    // ── discovery → main blueprint → team.create ────────────────────────────
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'bootwave')
    if (discPrompt.status !== 200) {
      failRest(`discovery prompt rejected: ${String(discPrompt.status)}`, { header })
      return
    }
    const discW = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), 60_000)
    if (!discW.hit) {
      failRest('discovery model request absent (deny list cannot be computed)', { header })
      return
    }
    const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
    const surfaceNames = [...new Set(disc)].sort()
    const denyList = surfaceNames.filter((n) => !n.startsWith('team_') && n !== 'todo_write')
    assembly.writeMainBlueprint(denyList)
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create',
      { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } }, 'bootwave-create', 1)
    if (!(created.status === 200 && created.body?.result?.ok === true)) {
      failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`, { header })
      return
    }

    // ── the runner IS the Human resolver ────────────────────────────────────
    const unwrap = (x) => {
      const v = x?.body?.result?.value
      return v && typeof v === 'object' && 'data' in v ? v.data : v
    }
    const ledgerFacts = async () => {
      const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
      let afterSequence = 0
      for (let pageNo = 0; pageNo < 4; pageNo += 1) {
        if (approverStop || overBudget()) break
        const page = await Promise.race([
          remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
            { teamSessionId: assembly.CREATE_ROOT, afterSequence, limit: 500 }, 'bootwave-ledger', 1),
          sleep(8_000).then(() => null),
        ])
        if (page === null) { approverErrors.push('getLedgerPage raced out (8s)'); break }
        const r = page?.body?.result
        if (page?.status !== 200 || r?.ok === false) throw new Error(`team.getLedgerPage failed: status=${String(page?.status)} ${JSON.stringify(r ?? null).slice(0, 160)}`)
        const data = unwrap(page)
        const entries = Array.isArray(data?.entries) ? data.entries : []
        for (const e of entries) {
          if (byType[e?.factType] === undefined) continue
          let payload = e.payload
          if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
          byType[e.factType].push({ payload: payload ?? {} })
        }
        const next = data?.nextAfterSequence
        if (next === null || next === undefined || entries.length === 0) break
        afterSequence = Number(next)
      }
      return byType
    }
    const rowsFrom = (byType) => {
      const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']].map((f) => String(f.payload?.requestId ?? '')))
      const rows = []
      for (const f of byType['control-request-recorded']) {
        const p = f.payload ?? {}
        if (p.requestId === undefined) continue
        rows.push({ requestId: String(p.requestId), toolName: p.toolName ?? null, summary: String(p.summary ?? '').slice(0, 200), status: settled.has(String(p.requestId)) ? 'settled' : 'pending' })
      }
      return rows
    }
    // THE DECISION LAW (pinned before the first row exists, recorded per row).
    // RCA-5 (bw6): ONE read_image call records TWO control rows — the
    // call-fingerprint row (summary `read_image <absolute path>`) and a
    // `PA ask case=<tadm case id>` row. The old per-REQUEST ordinal let the
    // next script value poison the SAME call's second leg. The law is now
    // keyed by the CALL: read_image calls in creation order = ALLOW, DENY,
    // ALLOW (R1 good, R2 denied, R3 huge); every row that belongs to a call
    // carries that call's decision; ask_user_question = ALLOW; anything
    // unmatched = DENY and disclosed. The cell laws (RAN line required etc.)
    // are untouched — only the driver's answering map is corrected.
    const planFor = (r, ordinal) => {
      if (r.toolName === 'read_image') return ordinal === 1 ? 'allow' : (ordinal === 2 ? 'deny' : 'allow')
      if (r.toolName === 'ask_user_question') return 'allow'
      return 'deny'
    }
    const callOfSummary = (summary) => {
      const m = /read_image\s+(\S+\.png)/.exec(summary ?? '')
      return m ? m[1] : null
    }
    const caseOfSummary = (summary) => {
      const m = /case=(\S+)/.exec(summary ?? '')
      return m ? m[1] : null
    }
    const callOrdinal = new Map()
    const callDecision = new Map()
    let lastCallDecision = null
    const decisionFor = (r) => {
      const call = callOfSummary(r.summary)
      if (call !== null) {
        if (!callDecision.has(call)) {
          const ordinal = callDecision.size + 1
          callDecision.set(call, { ordinal, decision: planFor({ ...r, summary: '' }, ordinal) })
        }
        const d = callDecision.get(call)
        lastCallDecision = d
        return { decision: d.decision, ordinal: d.ordinal, via: 'call' }
      }
      // A `PA ask case=…` row carries a tadm case id (instance + content hash),
      // not the path: its decision follows the most recent call-fingerprint
      // row it belongs to (the product records the call row before the case
      // leg for that same blocked call; every leg of one call must answer the
      // SAME way — RCA-5).
      if (r.toolName === 'read_image' && caseOfSummary(r.summary) !== null && lastCallDecision !== null) {
        return { decision: lastCallDecision.decision, ordinal: lastCallDecision.ordinal, via: 'case-after-call' }
      }
      const n = (seenToolOrdinal.get(r.toolName) ?? 0) + 1
      seenToolOrdinal.set(r.toolName, n)
      return { decision: planFor(r, n), ordinal: n, via: 'tool-ordinal' }
    }
    let approverStop = false
    const approverErrors = []
    const resolved = new Map()
    const seenToolOrdinal = new Map()
    const approver = (async () => {
      for (;;) {
        if (approverStop) return
        try {
          const byType = await ledgerFacts()
          const rows = rowsFrom(byType)
          facts.approval.requestRows = rows.map((r) => ({ requestId: String(r.requestId).slice(0, 16), toolName: r.toolName, status: r.status, summary: r.summary.slice(0, 120) }))
          facts.approval.decisions = (byType['control-decision-recorded'] ?? []).map((f) => ({ requestId: String(f.payload?.requestId ?? '').slice(0, 16), decision: f.payload?.decision ?? f.payload?.outcome ?? null }))
          facts.approval.consumed = (byType['control-allow-consumed'] ?? []).map((f) => ({ requestId: String(f.payload?.requestId ?? '').slice(0, 16) }))
          for (const r of rows) {
            if (approverStop || overBudget()) break
            const rid = String(r?.requestId ?? '')
            if (rid === '' || resolved.has(rid) || r?.status !== 'pending') continue
            const plan = decisionFor(r)
            const n = plan.ordinal
            const decision = plan.decision
            const res = await Promise.race([
              remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
                { teamSessionId: assembly.CREATE_ROOT, requestId: rid, decision, note: `bootwave-${String(r.toolName)}-${String(n)}-${decision}` }, 'bootwave-approval', 4),
              sleep(15_000).then(() => null),
            ])
            const ok = res?.status === 200 && (res?.body?.result?.ok === true || res?.body?.result?.value !== undefined)
            resolved.set(rid, { decision, ok })
            facts.approval.resolutions.push({ requestId: rid, ordinal: n, decision, ok, via: plan.via, toolName: r.toolName, resolveStatus: res?.status ?? null, bodyHead: JSON.stringify(res?.body ?? null).slice(0, 200) })
            log(`approval ${decision} #${String(n)} via=${String(plan.via)} tool=${String(r.toolName)} requestId=${rid.slice(0, 12)}… ok=${String(ok)}`)
          }
        } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
        await sleep(350)
      }
    })()

    // ── the store/watch sampler: the census is a TIME SERIES, so "zero new
    // objects after the deny" is a measured claim, not a before/after guess.
    const samples = []
    let denySampledAt = -1
    const sampleStore = () => {
      const objects = censusObjects(assembly.storeRoot)
      samples.push({ at: Date.now(), objects: objects.length, names: objects.map((o) => o.rel) })
      facts.store.objects = objects
      facts.store.maxObjectsSeen = Math.max(facts.store.maxObjectsSeen, objects.length)
      facts.store.samples = samples.slice(-60)
      if (denySampledAt === -1 && (facts.approval.resolutions ?? []).some((r) => r.toolName === 'read_image' && r.decision === 'deny' && r.ok === true)) {
        denySampledAt = samples.length - 1
      }
      if (denySampledAt >= 0) {
        const after = samples.slice(denySampledAt)
        facts.store.zeroNewObjectsAfterDeny = after.every((s) => s.objects <= 1 && s.names.length <= 1)
      }
    }

    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
    const wake = async (tag) => {
      const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `BOOTWAVE_PHASE_${tag}`, 'bootwave-wake')
      if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
    }
    const wakeCadence = async (content, deadlineMs, tag) => {
      const t0 = Date.now()
      let lastWake = 0
      let wakes = 0
      for (;;) {
        try { await pumpAnswers() } catch { /* the pump never breaks a drive */ }
        try { sampleStore() } catch { /* same */ }
        if (replySeen(content)) return true
        if (Date.now() - t0 > deadlineMs || overBudget()) return replySeen(content)
        if (Date.now() - lastWake > 3000 && wakes < 20) { wakes += 1; lastWake = Date.now(); await wake(tag) }
        await sleep(350)
      }
    }

    const laneDone = { imgov: false, uigov: false, leader: false }
    laneDone.imgov = await wakeCadence('BOOTWAVE_IMG_DONE', 170_000, 'r')
    sampleStore()
    facts.store.workspaceCensusAfter = censusFiles(assembly.workspaceDir)
    // New files in the governed workspace = after minus before. An empty
    // before-census is NOT a reason to skip the diff — the three planted PNGs
    // are in it, so a non-empty diff here is a real write by the host.
    const workspaceBefore = new Set(planted.workspaceCensusBefore ?? [])
    facts.store.workspaceNewFiles = facts.store.workspaceCensusAfter.filter((p) => !workspaceBefore.has(p))
    laneDone.uigov = await wakeCadence('BOOTWAVE_UI_DONE', 120_000, 'u')
    laneDone.leader = await wakeCadence('BOOTWAVE_L1_DONE', 45_000, 'z')
    record.record.bootwaveLanes = laneDone
    // Which instance each scripted lane actually ran in, and how many
    // provider turns each took — the attribution witness for any lane question.
    record.record.bootwaveDecideFacts = { ids: decide.ids, steps: decide.steps, trace: decide.trace ?? [] }

    answerer.stop()
    approverStop = true
    try { await approver } catch { /* exits on the flag */ }
    sampleStore()
    record.record.bootwaveAsks = { ...facts.approval, errors: approverErrors }
    record.record.bootwaveWire = { ...facts.wire, answered: facts.answered, frames: answerer.facts.frames.length, waterfallFrames: facts.waterfallFrames }

    // ── witnesses: host log + mock transcript + the runner's own disk reads ──
    let logLines = []
    try {
      logLines = readFileSync(boot.logPath, 'utf8').split('\n').filter((l) => LOG_RE.test(l))
    } catch { /* unreadable log → the transcript carries the verdict */ }
    const requests = world.mock?.requests ?? []
    const journal = requests.slice(-100).map((rec) => {
      const msgs = rec.body?.messages ?? []
      const toolUses = msgs.flatMap((m) => m?.role === 'assistant' && Array.isArray(m.content)
        ? m.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.name)) : [])
      const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
      const blocks = Array.isArray(lastUser?.content) ? lastUser.content : null
      const resultHead = typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 500)
        : Array.isArray(lastUser?.content)
          ? (lastUser.content.find((b) => b?.type === 'tool_result')?.content?.slice?.(0, 500) ?? JSON.stringify(lastUser.content[0] ?? '').slice(0, 500))
          : null
      return { seq: rec.seq, lastCall: toolUses.length > 0 ? toolUses[toolUses.length - 1] : null, resultHead, blockTypes: blocks?.map((b) => b?.type ?? '?') ?? null }
    })

    // The LIVE model surface of the imgov lane: exactly one read_image? Which
    // description? The discovery request alone would not answer the shadowing
    // question for the governed member, so the member's own request is read.
    const imgovReqs = requests.filter((r) => JSON.stringify(r.body?.messages ?? []).includes(assembly.tokens('d1')))
    const imgovSurfaceReq = imgovReqs.find((r) => Array.isArray(r.body?.tools) && r.body.tools.length > 0) ?? null
    const tools = (imgovSurfaceReq?.body?.tools ?? []).map((t) => ({ name: String(t?.name ?? t?.function?.name ?? ''), description: String(t?.description ?? t?.function?.description ?? '') }))
    const imageRows = tools.filter((t) => t.name === 'read_image')
    // The mount-time placement feed: `a5g7: placement-feed rows=[…]`
    // (agent-bindings.mjs:2842) and `a5-plane: placed […]`
    // (team-tool-plane.mjs:2067) — whichever wording this generation prints,
    // the witness is that the plane itself names read_image.
    const placementLines = logLines.filter((l) => l.includes('placement-feed rows=') || l.includes('a5-plane: placed ['))
    facts.surface = {
      names: imgovSurfaceReq === null ? surfaceNames : [...new Set(tools.map((t) => t.name))].sort(),
      readImageCount: imageRows.length,
      readImageIsGoverned: imageRows.length >= 1 && imageRows[0].description.includes(GOVERNED_IMAGE_DESCRIPTION_MARKER),
      readImageDescriptions: imageRows.map((t) => t.description.slice(0, 200)),
      placementLines: placementLines.slice(0, 6).map((l) => l.slice(0, 240)),
      placementHasReadImage: placementLines.some((l) => l.includes('read_image')),
      surfaceRequestFound: imgovSurfaceReq !== null,
    }

    // The commit the model saw: the tool_result of the RAN read_image call.
    const imageResultReq = [...requests].reverse().find((r) => JSON.stringify(r.body?.messages ?? [])
      .includes('<type>image</type>'))
    // The blocks the model actually saw for that turn. A tool_result block
    // carries its payload INSIDE it (string or block array), so the inner
    // blocks are flattened — the two-block law is about what the model
    // receives, not about which wrapper the harness chose.
    // RCA-8: flatten the WHOLE request, not one message — bw7/bw8 showed the
    // harness may place the projected image part in a message of its own, and
    // picking only the last tool_result message made both blocks invisible
    // while the same request still carried them. The law is about what the
    // model received in the request that follows the RAN call: envelope text
    // block AND an image part, wherever the wrapper placed them.
    const blocksOf = (r) => {
      const msgs = r?.body?.messages ?? []
      const out = []
      for (const m of msgs) {
        for (const b of Array.isArray(m?.content) ? m.content : []) {
          if (b?.type === 'tool_result') {
            if (typeof b.content === 'string') out.push({ type: 'text', text: b.content })
            else if (Array.isArray(b.content)) out.push(...b.content)
          } else {
            out.push(b)
          }
        }
      }
      return out
    }
    const blocks = blocksOf(imageResultReq ?? null)
    const envelope = [...blocks].reverse().find((b) => b?.type === 'text' && String(b?.text ?? '').includes('<type>image</type>')) ?? null
    const imageBlock = [...blocks].reverse().find((b) => b?.type === 'image' || b?.type === 'image_url' || b?.type === 'input_image') ?? null
    const blob = JSON.stringify(imageResultReq?.body?.messages ?? [])
    const attachmentIds = [...new Set([...blob.matchAll(/sha256:([0-9a-f]{64})/g)].map((m) => m[1]))]
    // Every inline image payload shape the projection may take (a `data:` URL
    // or an explicit base64 field) — the sha of each is what gets compared
    // with the store object name.
    const b64 = [...blob.matchAll(/base64,([A-Za-z0-9+/=]{32,})/g), ...blob.matchAll(/"(?:data|base64)"\s*:\s*"([A-Za-z0-9+/=]{32,})"/g)].map((m) => m[1])
    const b64Shas = b64.map((s) => { try { return createHash('sha256').update(Buffer.from(s, 'base64')).digest('hex') } catch { return null } }).filter((s) => s !== null)
    const objectShas = facts.store.objects.map((o) => o.sha).filter((s) => typeof s === 'string')
    facts.attachment = {
      twoBlocks: envelope !== null && imageBlock !== null,
      envelopeHead: envelope === null ? null : String(envelope.text).slice(0, 300),
      blockTypes: blocks.map((b) => String(b?.type ?? '?')),
      imageBlockShape: imageBlock === null ? null : Object.keys(imageBlock).sort().join(','),
      attachmentIds,
      modelImageParts: b64.map((s) => ({ base64Length: s.length })).slice(0, 4),
      modelImageSha256: b64Shas,
      identityMatch: objectShas.length === 1 && (attachmentIds.includes(objectShas[0]) || b64Shas.includes(objectShas[0])),
      imageRequestFound: imageResultReq !== null,
    }

    // RCA-8 — the kernel-side denial arm. When the call-fingerprint row (kernel
    // admission) is answered deny, the call never reaches the family executor,
    // so an executor `pa-refused` observe line CANNOT exist. The typed refusal
    // is still live and recorded where the model sees it: the member's mock
    // transcript carries the tool_result refusal text. Both arms are legal
    // "live typed refusal" evidence under the ledger law; which one carried
    // the fact is recorded, and every zero-effect census stays required.
    const denialTurn = [...requests].reverse().find((r) => JSON.stringify(r.body?.messages ?? [])
      .includes('approval was denied'))
    facts.denialTranscript = {
      kernelDeniedSeen: denialTurn !== undefined,
      sample: denialTurn === undefined ? null
        : (JSON.stringify(denialTurn.body?.messages ?? '').match(/Error: the approval was denied[^"]*/) ?? ['present'])[0].slice(0, 120),
    }

    const oracle = assembly.readOracleFacts()
    facts.plant = { ...planted, ...oracle, pngSizes: planted.pngSizes }
    record.record.bootwaveDigest = {
      header, surface: facts.surface, store: { ...facts.store, samples: facts.store.samples?.slice(-40) },
      attachment: facts.attachment, oracle,
      logHits: {
        imageLines: imageLinesWitness(logLines),
        askLines: logLines.filter((l) => l.includes('governed-ask')).map((l) => l.slice(0, 220)),
        audit: logLines.filter((l) => /admission-/.test(l)).map((l) => l.slice(0, 220)),
        planeRefusals: logLines.filter((l) => /REFUSED|TOOL_BINDING_UNVERIFIED|PLANE_PLACEMENT_CONFLICT/.test(l)).map((l) => l.slice(0, 220)),
        noProvider: logLines.filter((l) => /NO_PROVIDER/.test(l)).map((l) => l.slice(0, 200)),
      },
      journal: journal.slice(-40),
    }
    try {
      writeFileSync(join(evidence, `${runId}.bootwave-evidence.json`), JSON.stringify({
        run: record.record.bootwaveRun, asks: record.record.bootwaveAsks, wire: record.record.bootwaveWire,
        lanes: record.record.bootwaveLanes, digest: record.record.bootwaveDigest,
      }, null, 2) + '\n')
    } catch { /* evidence is best-effort */ }

    const hostAlive = world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const verdicts = judgeBootwave({ facts, log: logLines, journal, laneDone, hostAlive, healthOk: health?.body?.ok === true, stateOk: stateW.hit })

    // R-ENVBLOCK-1: an arm that never arrived is NOT_REACHED, and an
    // environment claim needs a quotable host line. Nothing here softens.
    const envWall = envSignal({
      channel: 'host-log',
      text: logLines.find((l) => /a5-plane: (?:mount|placement)-REFUSED|EADDRINUSE|EACCES|EPERM/.test(l)) ?? null,
      observed: logLines,
    })
    const reachedKeyFor = (id) => (id.startsWith('ri:placement') ? 'placement'
      : (id.startsWith('ri:ask') || id.startsWith('ri:answered')) ? 'imageRow'
        : (id.startsWith('ri:attachment') || id.startsWith('ri:tool-output')) ? 'imageRan'
          : id.startsWith('ri:') ? 'imageRow' : 'askRow')
    const reached = {
      placement: facts.surface.readImageCount !== null,
      imageRow: facts.approval.requestRows.length > 0 || logLines.some((l) => l.includes('governed-image')),
      imageRan: logLines.some((l) => l.includes('governed-image RAN')),
      askRow: facts.approval.requestRows.some((r) => r.toolName === 'ask_user_question') || logLines.some((l) => l.includes('governed-ask')),
    }
    const failures = []
    for (const [id, verdict, detail] of verdicts) {
      if (done.has(id)) continue
      let v = verdict
      let d = detail
      if (verdict === 'FAIL' && !reached[reachedKeyFor(id)]) {
        const classified = classifyUnwitnessedArm({ step: id, reachedStep: false, signal: envWall, extra: detail })
        v = classified.verdict
        d = classified.detail
      }
      if (v !== 'PASS') failures.push({ cell: id, verdict: v, rcaClass: d?.rcaClass ?? 'unreached-or-env', rcaSummary: d?.rcaSummary ?? d?.reason ?? 'step not reached; see the RUN record', rcaEvidence: d?.rcaEvidence ?? [] })
      add(id, v, d)
    }
    record.record.bootwaveRca = {
      failingCells: failures,
      laneDone,
      sameClassFailureStopLineInput: failures.map((f) => f.rcaClass),
      evidencePaths: [join(evidence, `${runId}.bootwave-evidence.json`), boot.logPath],
    }
    log(`bootwave run ${runId}: lanes=${JSON.stringify(laneDone)} imageRows=${String(facts.approval.requestRows.filter((r) => r.toolName === 'read_image').length)} askRows=${String(facts.approval.requestRows.filter((r) => r.toolName === 'ask_user_question').length)} objects=${String(facts.store.objects.length)} failures=${String(failures.length)}`)
  } finally {
    await cleanup()
  }
}

function imageLinesWitness(logLines) {
  return logLines.filter((l) => l.includes('governed-image')).map((l) => l.slice(0, 220))
}

// ─────────────────────────────────────────────────────────────────────────────
// --dry: the pre-spawn half only. Same host assert, same branded pre-flight in
// CHECK mode (no copy, no write), same World materialization and assembly, and
// both blueprints through the host's own strong validator. startMock/startHost
// are never called, so nothing spawns and no host starts: the budget is
// untouched. Exit 0 only when every pre-flight passed.
// ─────────────────────────────────────────────────────────────────────────────
/** A port is FREE when nothing listens and the OS will bind it. */
export function portIsFree(port, timeoutMs = 1200) {
  return new Promise((res) => {
    const srv = createServer()
    let settled = false
    const finish = (v) => { if (!settled) { settled = true; res(v) } }
    srv.once('error', () => finish(false))
    srv.listen({ host: '127.0.0.1', port }, () => {
      srv.close(() => finish(true))
    })
    setTimeout(() => finish(false), timeoutMs).unref?.()
  })
}

export async function dryRun({ repoRoot, line = 'bootwavedry', keepHome = false } = {}) {
  const REPO = resolve(repoRoot)
  const out = []
  const say = (s) => { out.push(s); console.log(s) }
  const failures = []
  const check = async (name, fn) => {
    try {
      const detail = await fn()
      say(`ok   ${name}${detail === undefined || detail === null ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
      return { ok: true, detail }
    } catch (error) {
      const msg = String(error?.message ?? error).slice(0, 300)
      failures.push({ check: name, message: msg })
      say(`FAIL ${name}: ${msg}`)
      return { ok: false, message: msg }
    }
  }
  const gitAt = (args, cwd) => {
    const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (exit ${String(r.status)}): ${String(r.stderr ?? '').trim().slice(0, 160)}`)
    return String(r.stdout ?? '').trim()
  }
  const head = (cwd) => safe(() => gitAt(['rev-parse', 'HEAD'], cwd))
  const porcelain = (cwd, args = ['status', '--porcelain']) => safe(() => {
    const v = gitAt(args, cwd)
    return v === '' ? 'empty' : `DIRTY(${String(v.split('\n').length)} lines)`
  })

  const dateUtc = spawnSync('date', ['-u'], { encoding: 'utf8' }).stdout.trim()
  say('# ── u7r3-bootwave DRY RUN — assembly up to the step before spawn ─────────────')
  say(`# date -u             : ${dateUtc}`)
  say(`# product tree        : ${REPO}`)
  say(`#   HEAD              : ${head(REPO)}  porcelain(no -u): ${porcelain(REPO, ['status', '--porcelain', '--untracked-files=no'])}`)
  const hostRepoRoot = findTestRepoRoot(REPO) ?? REPO
  const hostTree = testUseTree(hostRepoRoot)
  say(`# host tree (runtime) : ${hostTree}`)
  say(`#   HEAD              : ${head(hostTree)}  porcelain: ${porcelain(hostTree)}`)
  say(`#   pinned baseline   : ${TEST_USE_BASELINE_SHA} (tests/paths.mjs TEST_USE_BASELINE_SHA)`)
  say(`# DSH_HOME root       : ${join(REPO, 'tests', 'homes')} (workspace-internal, gitignored)`)
  say(`# port bands          : host ${JSON.stringify(HOST_PORT_BANDS)} · mock ${JSON.stringify(MOCK_PORT_BANDS)} · stable :3080 untouched`)
  say('# ZERO BOOT: no mock server, no host child, no spawn. Host-start budget spend of this run: 0.')

  await check('host base: pristine @ pinned baseline, porcelain empty', () => {
    const h = gitAt(['rev-parse', 'HEAD'], hostTree)
    if (h !== TEST_USE_BASELINE_SHA) throw new Error(`HEAD ${h} != TEST_USE_BASELINE_SHA ${TEST_USE_BASELINE_SHA}`)
    const p = gitAt(['status', '--porcelain'], hostTree)
    if (p !== '') throw new Error(`porcelain not empty:\n${p.split('\n').slice(0, 8).join('\n')}`)
    return { hostTree, head: h }
  })

  // Raw dry-run scratch lives under the gitignored .artifacts/ store (the
  // repo's local temporary evidence location, .gitignore:118), never in a
  // tracked directory: a dry run must not be able to dirty the tree.
  const evidence = join(REPO, '.artifacts', 'world-factory-evidence', `bootwave-dry-${utcStampFile()}`)
  const factory = new TestWorldFactory({ repoRoot: REPO, evidenceRoot: evidence, hostTree })
  await check('factory.assertHostBase("dry-preflight")', () => { factory.assertHostBase('dry-preflight'); return 'exit 0' })
  await check('native sandbox pre-flight (provision:false = probe only, never copies)', async () => {
    const p = await factory.preflightHostSandbox({ provision: false })
    const detail = {
      probed: p?.probed ?? null,
      backend: p?.backend ?? null,
      usable: p?.usable ?? null,
      provisioned: p?.provisioned ?? null,
      launcherSha256: p?.launcherSha256 ?? p?.launcher ?? null,
    }
    if (detail.backend === 'unusable') throw new Error(`sandbox backend unusable: ${JSON.stringify(detail)}`)
    return detail
  })
  const stable = await safeAsync(async () => await stableInstanceProbe(3000))
  say(`ok   stable :3080 probe (read-only, must stay untouched): ${JSON.stringify(stable)}`)
  const freeHost3193 = await portIsFree(3193)
  const freeHost3194 = await portIsFree(3194)
  const freeMock3491 = await portIsFree(3491)
  say(`ok   port preflight: candidate 3193 free=${String(freeHost3193)} · 3194 free=${String(freeHost3194)} · mock 3491 free=${String(freeMock3491)}  (the boot binds a first-free LEASE inside HOST_PORT_BANDS with preferred:[] — lib/port-lease.mjs — so the actual port is chosen by the factory, not pinned here)`)
  if (!freeHost3193 && !freeHost3194) {
    failures.push({ check: 'port preflight', message: 'neither 3193 nor 3194 is free; the lease will take another free port inside the host band (recorded, not fatal)' })
    say('     note: both sketch-named candidate ports are busy — the lease model picks another free port in the band (disclosed coordinate mismatch).')
  }

  let world = null
  let assembly = null
  try {
    await check('world materialization (home + blueprint dir + PNG plants + row assembly; NO spawn)', async () => {
      world = await factory.createWorld({ line, u7FsUi: { rows: [] } })
      assembly = createBootwaveAssembly({ repoRoot: REPO, home: world.home, runStamp: world.id, reportDir: world.logDir })
      const planted = assembly.writePreBootFiles()
      const rows = assembly.teamRows()
      world.u7FsUi.rows.push(...rows)
      if (world.mock !== null) throw new Error('a mock exists before spawn')
      return {
        worldId: world.id,
        home: world.home,
        rows: rows.map((r) => r.id),
        plants: planted.pngSizes,
        storeCensusBefore: planted.storeCensusBefore,
        launcherSha256: createHash('sha256').update(readFileSync(assembly.LAUNCHER)).digest('hex').slice(0, 16),
      }
    })
    if (assembly !== null) {
      await check('profile-patch emission (emitPatchLayer over the EXACT rows — the last artifact before the spawn)', () => {
        const patch = emitPatchLayer(['dry: bootwave profile layer (emitted for validation only;'],
          [{ id: 'dry-canary', name: './u5-canary-plugin.mjs' }, ...assembly.teamRows()])
        const file = join(world.home, 'dry-profile-patch.yaml')
        writeFileSync(file, patch + '\n')
        for (const needle of ['dsh-agent-team', 'p6t6-team-tools', 'dsh-agent-preset', 'uiFamilyEnabled', 'centerShadowLedger', assembly.PLANE_REALM_ID]) {
          if (!patch.includes(needle)) throw new Error(`emitted patch layer is missing ${JSON.stringify(needle)}`)
        }
        const cfg = assembly.teamRowConfig()
        if (cfg.teamToolPlane.fsInstance.rootDir !== realpathOr(assembly.workspaceDir)) throw new Error('the governed root is not the realpath of the world workspace')
        if (cfg.staticModel.model !== IMAGE_CAPABLE_MODEL) throw new Error(`staticModel.model must be the image-capable catalog id ${IMAGE_CAPABLE_MODEL}`)
        return { file, bytes: patch.length, model: cfg.staticModel, governedRoot: cfg.teamToolPlane.fsInstance.rootDir }
      })
      await check('confinedProvider trio passes the mount\'s OWN pairing law (dist team-tool-plane face, pb-CONTRACT §1.3)', async () => {
        const mod = await import(pathToFileURL(join(REPO, 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
        if (typeof mod.verifyConfinedProviderPairing !== 'function') throw new Error('verifyConfinedProviderPairing is not a function on the pinned dist face')
        const cfg = assembly.teamRowConfig()
        const verdict = mod.verifyConfinedProviderPairing(cfg.teamToolPlane.confinedProvider)
        if (verdict?.ok !== true) throw new Error(`the mount would refuse the row: ${JSON.stringify(verdict).slice(0, 240)}`)
        const missing = ['trustRoot', 'assembly'].filter((k) => cfg.teamToolPlane.confinedProvider?.[k] === undefined)
        if (missing.length > 0) throw new Error(`confinedProvider missing ${JSON.stringify(missing)}`)
        return {
          trustRoot: cfg.teamToolPlane.confinedProvider.trustRoot,
          launcherPath: cfg.teamToolPlane.confinedProvider.assembly.launcherPath,
          minAbiVersion: cfg.teamToolPlane.confinedProvider.assembly.minAbiVersion,
        }
      })
      await check('blueprint validation — the host\'s OWN strong validator (dist domain face) over anchor + main', async () => {
        const mod = await import(pathToFileURL(join(REPO, 'packages/runtime/dist/packages/domain/blueprint/src/index.js')).href)
        if (typeof mod.parseBlueprint !== 'function') throw new Error('parseBlueprint is not a function on the pinned dist face')
        const anchor = mod.parseBlueprint(assembly.BP_ANCHOR_YAML)
        // The dry run computes the deny list with the SAME filter the drive
        // applies to the live discovery surface; the assembly itself strips the
        // family-owned names (fs + UI) out of builtinToolDeny.
        const discoveryLike = ['bash', 'edit', 'grep', 'glob', 'read', 'read_image', 'write', 'ask_user_question', 'present', 'todo_write', 'web_search', 'team_delegate']
        const denyList = discoveryLike.filter((n) => !n.startsWith('team_') && n !== 'todo_write')
        assembly.writeMainBlueprint(denyList)
        const main = mod.parseBlueprint(readFileSync(join(assembly.blueprintDir, 'main.yaml'), 'utf8'))
        const templates = [main.leader?.templateId, ...(main.members ?? []).map((m) => m.templateId)].filter((t) => typeof t === 'string')
        if (templates.length !== 3 || !templates.includes('imgov') || !templates.includes('uigov')) throw new Error(`unexpected template set: ${JSON.stringify(templates)}`)
        const json = JSON.stringify(main)
        if (!json.includes('"read_image"')) throw new Error('the parsed blueprint lost the read_image ask rule')
        const leaderTools = JSON.stringify(main.leader?.capabilities?.teamTools ?? {})
        if (leaderTools.includes('resolve_control')) throw new Error('the leader must not carry a control-resolving tool')
        return {
          anchor: { blueprintId: anchor.blueprintId, revision: anchor.revision, contentHash: String(anchor.contentHash ?? '').slice(0, 16) },
          main: { blueprintId: main.blueprintId, revision: main.revision, contentHash: String(main.contentHash ?? '').slice(0, 16), templates },
          denyListAfterFamilyFilter: denyList.filter((n) => !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'ask_user_question', 'present'].includes(n)),
        }
      })
      await check('assembly law: family-owned names never enter builtinToolDeny; both ask lanes present', () => {
        const yamlText = assembly.mainBlueprintYaml(['web_search', 'grep', 'todo_write', 'ask_user_question', 'present', 'read_image', 'bash', 'write', 'edit', 'read'])
        if (/^\s+- ask_user_question$/m.test(yamlText)) throw new Error('ask_user_question leaked into builtinToolDeny')
        if (/^\s+- read_image$/m.test(yamlText)) throw new Error('read_image leaked into builtinToolDeny')
        if (!yamlText.includes('tool: read_image')) throw new Error('the imgov ask rule for read_image is missing')
        if (!yamlText.includes('- templateId: imgov') || !yamlText.includes('- templateId: uigov')) throw new Error('a capability member template is missing')
        if (!yamlText.includes('- request-control')) throw new Error('request-control is missing from the envelopes (no ask row would ever be created)')
        if (/team_resolve_control/.test(yamlText)) throw new Error('the leader must not carry team_resolve_control')
        return { templates: ['leader (no control tool)', 'imgov (ask lane: read_image subtree over the governed root)', 'uigov (default ask, no rule)'] }
      })
      await check('fixture law: the over-pixel PNG crosses ONLY the pixel rule (H:attachment-local limits)', () => {
        const MAX_PIXELS = 64_000_000
        const MAX_DIMENSION = 8192
        const MAX_BYTES = 20 * 1024 * 1024
        const huge = { w: 8192, h: 7817 }
        const pixels = huge.w * huge.h
        if (!(pixels > MAX_PIXELS)) throw new Error(`the fixture does not cross the pixel law: ${String(pixels)}`)
        if (huge.w > MAX_DIMENSION || huge.h > MAX_DIMENSION) throw new Error('the fixture crosses the per-side dimension law too — the refusal would not be attributable to the pixel law')
        const bytes = readFileSync(assembly.files.huge).length
        if (bytes > MAX_BYTES) throw new Error(`the fixture crosses the byte cap (${String(bytes)} > ${String(MAX_BYTES)}) — the input-size rule would refuse first`)
        return {
          hugePixels: pixels,
          limitPixels: MAX_PIXELS,
          hugeDimensions: `${String(huge.w)}x${String(huge.h)}`,
          limitDimension: MAX_DIMENSION,
          hugeFileBytes: bytes,
          limitBytes: MAX_BYTES,
          goodFileBytes: readFileSync(assembly.files.good).length,
        }
      })
      await check('no spawn happened (mock null, no DshInstance, no host lease)', () => {
        if (world.mock !== null) throw new Error('a mock was started in dry mode')
        if (world.instance !== null) throw new Error('a DshInstance exists in dry mode')
        if (world.hostLease !== null) throw new Error('a host port lease was taken in dry mode')
        return { mock: null, instance: null, hostLease: null, hostStartsRecorded: 0 }
      })
    }
  } finally {
    if (world !== null) {
      try {
        const receipts = await world.teardown({ keepHome })
        say(`ok   dry world torn down: homeDeleted=${String(receipts.homeDeleted !== null)} releasedPorts=${JSON.stringify(receipts.releasedPorts)} notes=${JSON.stringify(receipts.notes)}`)
      } catch (error) {
        failures.push({ check: 'dry teardown', message: String(error?.message ?? error).slice(0, 200) })
        say(`FAIL dry teardown: ${String(error?.message ?? error).slice(0, 200)}`)
      }
    }
  }

  say(failures.length === 0
    ? 'DRY RESULT: PASS — assembly, patch emission, blueprint validation and every pre-flight are green; ZERO host starts, zero spawns.'
    : `DRY RESULT: FAIL — ${JSON.stringify(failures)}`)
  say(`# evidence dir (dry): ${evidence}`)
  return { ok: failures.length === 0, failures, lines: out, evidence }
}

async function safeAsync(fn) {
  try { return await fn() } catch (error) { return { error: String(error?.message ?? error).slice(0, 160) } }
}

function safe(fn) {
  try { return fn() } catch { return 'unknown' }
}
function utcStampFile() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

// ── module surface + CLI ─────────────────────────────────────────────────────
export default {
  suite: SUITE_NAME,
  cases: CASES,
  totalRequests: 160,
  run: (opts, ctx) => runBootwave(opts, ctx),
}

const HERE = dirname(fileURLToPath(import.meta.url))
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const args = process.argv.slice(2)
  if (!args.includes('--dry')) {
    console.error('usage: node tests/world-factory/suites/140-u7r3-bootwave.mjs --dry\n'
      + 'The real drive runs ONLY through u5-canary-runner.mjs --suite u7r3-bootwave --run-record <path>\n'
      + '(INVOCATION LAW: one recorded host start per budget line; --dry spawns nothing).')
    process.exit(2)
  }
  dryRun({ repoRoot: resolve(HERE, '..', '..', '..'), line: args[args.indexOf('--line') + 1] !== undefined && args[args.indexOf('--line') + 1]?.startsWith('--') === false ? args[args.indexOf('--line') + 1] : 'bootwavedry' })
    .then((r) => { process.exit(r.ok ? 0 : 1) })
    .catch((error) => {
      console.error(`dry run threw: ${String(error?.stack ?? error).slice(0, 800)}`)
      process.exit(1)
    })
}
