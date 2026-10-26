/**
 * u7-census-assembly.mjs — world materialization + offline assembly for
 * the U7-0 (EB2-A) dynamic tool census.
 *
 * TWO HALVES, one module:
 *  1. LIVE side — `createCensusTeamAssembly` composes the governed-Team
 *     World rows (the PRODUCTION Team row + preset declaration + p6t6
 *     observer, the same recipe u6-arc-a/arc-d proved at the Host) for the
 *     factory's `u7Census` patch layer, plus the closed mock `decide` that
 *     drives each lane. Everything mounts through public seams; the census
 *     row itself never touches a private one.
 *  2. OFFLINE side — `buildInventoryFromLedger` turns the census row's
 *     ledger rows into the ObservedRuntimeInventory contract (attaching
 *     the authoritative-source attribution per name), and
 *     `reconcileWorld` runs the three-way diff against the tracked
 *     ExpectedToolObligations pair.
 *
 * Verdict law (kept whole from U6): DISK + LEDGER, never the transcript.
 *
 * @module tests/world-factory/lib/u7-census-assembly
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { toolCall } from './u6-fs-assembly.mjs'
import { withDigests, inventoryViolations } from '../../../packages/testkit/census/inventory.mjs'
import { loadExpectedPair } from '../../../packages/testkit/census/expected-obligations.mjs'
import { reconcile } from '../../../packages/testkit/census/reconcile.mjs'

const sanitize = (v) => String(v).toLowerCase().replace(/[^a-z0-9-]/g, '-')

/** Test-only row tools: the census row's own tool + the canary row's tool.
 *  Both are observed as UNKNOWN/test-row and carry authorized:false — they
 *  are honest observations, never obligations. */
export const CENSUS_TEST_ROW_NAMES = ['u7_census', 'u5_canary']

export const LEADER_MARKER = 'U7C_LEADER_CHAIN_MARKER'
export const WORKER_MARKER = 'U7C_WORKER_CHAIN_MARKER'

const DYNAMIC_PREFIXES = [
  { prefix: 'mcp__', source_class: 'dynamic-source' },
  { prefix: 'cua_driver_native__', source_class: 'dynamic-source' },
]

/**
 * The governed-Team World assembly (boot #2). Rows go into the factory's
 * u7Census patch layer; writePreBootFiles() must run BEFORE startHost.
 * @param {{repoRoot: string, home: string, workspaceDir?: string, runStamp: string, reportDir: string}} opts
 */
export function createCensusTeamAssembly({ repoRoot, home, workspaceDir, runStamp, reportDir }) {
  const rs = sanitize(runStamp)
  const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW_NAME = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const GLUE_URL = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const SEAM_URL = pathToFileURL(join(repoRoot, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const P6T6_ROW_NAME = pathToFileURL(join(repoRoot, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const BASE_PRESET_ID = `u7c-base-${rs}`
  const BP_ANCHOR_ID = 'team.u7c.anchor'
  const ROOT = 'u7c-team-root-1'
  const workspace = workspaceDir ?? join(home, 'workspace')
  const blueprintDir = join(home, 'blueprints')

  function planeRootDir() {
    try { return realpathSync(workspace) } catch { return workspace }
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
      staticModel: { provider: 'deepseek-official', model: 'u7c-census-model' },
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
        realmId: `u7c-realm-${rs}`,
        fsInstance: { fs: 'u7c-plane', rootDir: planeRootDir(), realmId: `u7c-realm-${rs}`, kind: 'absolute-path' },
        // ENFORCING: the census must observe the REAL governed plane — the
        // team-lane scope it records is only meaningful if the plane rows
        // (governed read/bash takeovers, own-layer rows) are actually armed.
        centerAssembly: 'enforcing',
      },
    }
  }

  // Anchor blueprint (boot-resolvable): leader with the team-tool allow
  // list; one member template WITHOUT a capabilities block (the legacy
  // native surface — the u6-arc-d `ctl` precedent) so the created member
  // lane is a real agent scope the census can classify. The IO-permission
  // lane defaults to deny: the census never needs an IO tool; the leader
  // chain is team_create_member → close. The leader's builtinToolDeny
  // carries the two ROW-LAYER tools (canary + census) — this is the
  // MEASURED alpha2 coverage law (u6-fs b2: the gate refuses the leader
  // start over any `unknown-unmanaged` name on the final surface; deny IS
  // coverage, not a call site). The census call itself rides the boot-root
  // session lane (the legacy surface where row tools are native — the
  // proven u6-fs trigger-lane pattern); the leader lane never needs it.
  const BP_ANCHOR_YAML = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the u7c census team. ${LEADER_MARKER} drives your chain: create exactly one census worker, then stop.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_create_member',
    '    builtinToolDeny:', '      - u5_canary', '      - u7_census',
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: worker', '    displayName: "u7c census worker"',
    `    persona: ${JSON.stringify(`You are a worker of the u7c census team. ${WORKER_MARKER}: answer with U7C_WORKER_DONE and use no tools.`)}`,
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'requirements: []', 'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')

  function rows() {
    const basePlugins = [...smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })]
    return [
      { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() },
      { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
      presetDeclarationRow({
        id: BASE_PRESET_ID, displayName: 'u7c base',
        description: `u7c census base preset (${runStamp}) = smoke preset`,
        plugins: basePlugins,
      }),
    ]
  }

  function writePreBootFiles() {
    mkdirSync(blueprintDir, { recursive: true })
    mkdirSync(join(workspace, 'notes'), { recursive: true })
    writeFileSync(join(blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir, runStamp: String(runStamp), rootSessionId: ROOT,
    }, null, 2))
  }

  return { rows, writePreBootFiles, ROOT, markers: { LEADER_MARKER, WORKER_MARKER } }
}

/**
 * The closed mock decide for BOTH census boots. Lanes:
 *   title   → session-title text (never the chain);
 *   leader  (system carries LEADER_MARKER): team_create_member(worker) →
 *           U7C_LEADER_DONE (the leader surface DENIES the census row tool
 *           — alpha2 coverage law; it never calls it);
 *   session (request tools carry u7_census, no team lane — the boot-root
 *           legacy surface in EITHER world): u7_census snapshot
 *           tag=censusTag → U7C_SESSION_DONE;
 *   worker / other → done/noop text (a worker that uses no tools).
 * Budget note: the runner caps total requests; this script ends every lane
 * in ≤3 requests by construction.
 */
export function makeCensusDecide({ rootSessionId, censusTag = 'live1' }) {
  const steps = { leader: 0, session: 0 }
  const resultsAfterPrompt = (req) => {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    let lastUser = -1
    let results = 0
    msgs.forEach((m, i) => { if (m?.role === 'user') lastUser = i })
    msgs.forEach((m, i) => {
      if (i <= lastUser) return
      const isResult = m?.role === 'tool' || (Array.isArray(m?.content) && m.content.some((p) => p?.type === 'tool_result'))
      if (isResult) results += 1
    })
    return results
  }
  const hasTool = (req, name) => {
    const tools = req?.tools ?? req?.body?.tools ?? []
    return Array.isArray(tools) && tools.some((t) => String(t?.name ?? t?.function?.name ?? '') === name)
  }
  const systemText = (req) => JSON.stringify(req?.system ?? req?.body?.system ?? '')

  return function decide({ req }) {
    const sys = systemText(req)
    if (sys.includes('Generate the session title') || JSON.stringify(req?.messages ?? []).includes('Generate the session title')) {
      return { kind: 'text', content: 'u7c census session' }
    }
    if (sys.includes(WORKER_MARKER)) return { kind: 'text', content: 'U7C_WORKER_DONE' }
    if (sys.includes(LEADER_MARKER)) {
      if (steps.leader === 0 && resultsAfterPrompt(req) === 0) {
        steps.leader = 1
        return toolCall('team_create_member', { rootSessionId, requestToken: `u7c-rt-create-${steps.leader}`, delegationTemplateId: 'worker', label: 'u7c-worker' })
      }
      return { kind: 'text', content: 'U7C_LEADER_DONE' }
    }
    if (hasTool(req, 'u7_census')) {
      const n = resultsAfterPrompt(req)
      if (n === 0 && steps.session === 0) {
        steps.session = 1
        return toolCall('u7_census', { action: 'snapshot', tag: censusTag })
      }
      return { kind: 'text', content: 'U7C_SESSION_DONE' }
    }
    return { kind: 'text', content: 'U7C_NOOP' }
  }
}

// ── offline side ───────────────────────────────────────────────────────────

export function readLedgerRows(path) {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => { try { return JSON.parse(l) } catch { return { leg: 'UNPARSEABLE' } } })
  } catch {
    return []
  }
}

/** Pick the snapshot row the run stands on. With requiresTeamLane the
 *  preferred-tag snapshot must ALSO carry a team lane (a team-live census
 *  taken before the leader lane existed is not the team-world fact); then
 *  fall back to any lane-carrying snapshot, then the tagged one, then the
 *  LATEST (ledger order is chronological). */
export function pickSnapshot(rows, preferTag, { requiresTeamLane = false } = {}) {
  const snaps = rows.filter((r) => r?.leg === 'census-snapshot' && Array.isArray(r.scopes))
  const hasLane = (r) => r.scopes.some((s) => s.team_lane === true)
  const preferred = snaps.filter((r) => r.tag === preferTag && (!requiresTeamLane || hasLane(r)))
  if (preferred.length > 0) return preferred[preferred.length - 1]
  if (requiresTeamLane) {
    const lanes = snaps.filter(hasLane)
    if (lanes.length > 0) return lanes[lanes.length - 1]
  }
  if (requiresTeamLane) {
    // Review-R1 M4: a team-world snapshot WITHOUT a team lane is NOT the
    // team-world fact — throw, never silently fall back to a lane-less row.
    throw new Error(`no census-snapshot row carries a team lane (prefer ${preferTag}) — the governed-team leg has no observation to stand on`)
  }
  const tagged = snaps.filter((r) => r.tag === preferTag)
  const chosen = tagged.length > 0 ? tagged : snaps
  return chosen.length > 0 ? chosen[chosen.length - 1] : null
}

/**
 * Ledger row → ObservedRuntimeInventory, with the authoritative-source
 * attribution attached per row (the third column of the three-way diff).
 * @param {{ledgerPath: string, kind: 'non-team'|'governed-team', hostSha: string, worldId: string, bootId: string, preferTag: string, repoRoot: string}} opts
 */
export function buildInventoryFromLedger({ ledgerPath, kind, hostSha, worldId, bootId, preferTag, requiresTeamLane = false, repoRoot }) {
  const snap = pickSnapshot(readLedgerRows(ledgerPath), preferTag, { requiresTeamLane })
  if (snap === null) throw new Error(`no census-snapshot ledger row in ${ledgerPath} (prefer ${preferTag})`)
  const { sources } = loadExpectedPair(repoRoot)
  const hostNames = new Set(sources.static_sources.host.map((t) => t.name))
  const teamNames = new Set(sources.static_sources.team.map((t) => t.name))
  const testRows = new Set(CENSUS_TEST_ROW_NAMES)
  const attribution = (name) => {
    if (DYNAMIC_PREFIXES.some((p) => name.startsWith(p.prefix))) return 'dynamic-source'
    if (testRows.has(name)) return 'test-row'
    if (hostNames.has(name)) return 'host-static'
    if (teamNames.has(name)) return 'team-native'
    return 'unattributed'
  }
  const seenScope = new Set()
  const inventory = {
    schema: 'u7-0/observed-runtime-inventory/v1',
    world: {
      kind,
      host_sha: hostSha,
      boot_id: bootId ?? snap.boot ?? 'boot-1',
      world_id: worldId,
      captured_utc: String(snap.at ?? ''),
      source_ledger: ledgerPath.split('/').pop(),
    },
    scopes: snap.scopes.map((s, i) => {
      let scopeId = String(s.scope_id ?? `scope-${String(i)}`)
      while (seenScope.has(scopeId)) scopeId = `${scopeId}-x`
      seenScope.add(scopeId)
      return {
        scope_id: scopeId,
        kind: s.kind === 'agent' ? 'agent' : 'global',
        team_lane: s.team_lane === true,
        team_lane_signal: typeof s.team_lane_signal === 'string' ? s.team_lane_signal : 'none',
        agent_label: typeof s.agent_label === 'string' ? s.agent_label.slice(0, 80) : null,
        tools: [...(s.tools ?? [])]
          .sort((a, b) => (String(a?.name) < String(b?.name) ? -1 : 1))
          .map((t) => ({
            name: String(t.name),
            definition_identity: typeof t.definition_identity === 'string' ? t.definition_identity : null,
            schema_digest: String(t.schema_digest),
            identity_vs_global: ['same', 'differs', 'n/a'].includes(t.identity_vs_global) ? t.identity_vs_global : 'n/a',
            change_seq: Number.isInteger(t.change_seq) ? t.change_seq : null,
            source_class: attribution(String(t.name)),
            // EB2-A provider column (explicit, never silently omitted): the
            // public seam exposes no registrant — NOT_OBSERVABLE; provider
            // truth is the AuthoritativeToolSources side.
            provider_identity: typeof t.provider_identity === 'string' ? t.provider_identity : 'NOT_OBSERVABLE',
          })),
      }
    }),
  }
  const bad = inventoryViolations(inventory)
  if (bad.length > 0) throw new Error(`assembled inventory invalid: ${bad.slice(0, 5).join('; ')}`)
  return withDigests(inventory)
}

/**
 * The three-way diff for one live inventory (plus optional cross-boot
 * baseline). Returns the reconcile result or THROWS (fail-closed: the
 * runner records, it does not paper over).
 */
export function reconcileWorld({ repoRoot, observed, baseline = null }) {
  const { expected, sources } = loadExpectedPair(repoRoot)
  const out = reconcile({ expected, sources, observed, baseline, testRowNames: CENSUS_TEST_ROW_NAMES })
  if (!out.ok) throw new Error(`reconcile refused: ${JSON.stringify(out.violations.slice(0, 6))}`)
  return out.result
}
