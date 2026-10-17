/**
 * a5e2-domain-mock-row.mjs — W-E2 LIVE assembly (Alpha.5 wiring phase).
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam the W5
 * round used (IF-1). It carries the TEST-SIDE LIVE assembly of the
 * Domain-mock tool family (matrix M-13's planned-to-build mock: CAS +
 * simulated device interlock) INTO a real session Agent, on top of the PR7
 * jobs-gateway public barrel (identity face) and the PR2 admission kernel
 * (the TeamPermit face):
 *
 *   gated mode   register `a5e2_domain_act` → install the PR1 Guard →
 *                `bindOwnTools` + `publish` → register `a5e2_unbound_probe`
 *                AFTER publish (call-edge negative control) → every call
 *                runs: parse → Domain-reference resolution (fail-closed,
 *                BEFORE any grant is minted) → PR2 admit (TeamPermit half,
 *                tool-invoke + domain-ref effects through the frozen
 *                parsers) → DomainPermit half (row-local MOCK: lease
 *                interlock + CAS) → exec-edge one-shot consume → the ONE
 *                side-effect surface (device state file + action ledger) →
 *                presented. TeamPermit and DomainPermit each carry their own
 *                veto; the row's whole job is to MEASURE that neither side
 *                can override the other, with 0 side effects on every veto.
 *
 *   ungated mode  the same tool defs WITHOUT the guard install and WITHOUT
 *                 the PR2 kernel (static allow) — the RED control: the
 *                 TeamPermit half must go RED (policy-outside acts execute;
 *                 the unbound body runs; the veto-zero ledger breaks), while
 *                 the DomainPermit half (mock interlock) keeps refusing on
 *                 its own. The Team-side refusals are carried by the gate,
 *                 not by the prose.
 *
 * EDITOR / READ_IMAGE MEASUREMENT FACE (task ①): the row also captures the
 * real Agent's NATIVE tool face (names + parameter schemas through the
 * public `tools.schemas()` view) and the guard observation-stream census
 * around model-driven calls to the HOST-native `edit` / `read_image`
 * builtins. It ASSEMBLES NO EDITOR AND NO IMAGE TOOL — none exists in any
 * Team package (gap facts, not inventions; see README §editor/read_image).
 *
 * Every judgement comes from the committed `packages/runtime/dist` barrels
 * and the kit-local jobs-gateway barrel (`a5e2-fixtures.mjs`); this row
 * re-implements no law. Reads of other objects are labelled, never assumed;
 * the mock device store is labelled MOCK on every face it answers.
 *
 * Kit-provided environment:
 *   A5E2_DIST      <worktree>/packages/runtime/dist/packages
 *   A5E2_JOBS      the kit-local jobs-gateway build root
 *   A5E2_LEDGER    JSONL assembly-ledger path (append-only)
 *   A5E2_WORLD     absolute world root (domain/ + repo/ under it)
 *   A5E2_MODE      gated | ungated
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/we2/a5e2-domain-mock-row
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5e2-domain-mock'
export const inject = ['webServer', 'agents']

const LEDGER = process.env['A5E2_LEDGER'] ?? ''
const DIST = process.env['A5E2_DIST'] ?? ''
const JOBS = process.env['A5E2_JOBS'] ?? ''
const WORLD_ROOT = process.env['A5E2_WORLD'] ?? ''
const MODE = process.env['A5E2_MODE'] ?? 'gated'

const ACT = 'a5e2_domain_act'
const PROBE = 'a5e2_unbound_probe'
const DEV_MAIN = 'a5e2.device/main'
const DEV_AUX = 'a5e2.device/aux'
const DEV_BELT = 'a5e2.device/belt'
const DEV_GHOST = 'a5e2.device/ghost' // deliberately NOT in the mock registry

const JOURNAL = []
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try { mkdirSync(dirname(LEDGER), { recursive: true }); appendFileSync(LEDGER, line + '\n') } catch { /* journal is the in-process copy */ }
  }
  JOURNAL.push({ at: new Date().toISOString(), ...row })
}

const assemblies = new Map()
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
function safeLabel(read) {
  try { return String(read() ?? '(unknown-agent)') } catch (error) { return `(unreadable: ${String(error?.message ?? error).slice(0, 60)})` }
}
const agentLabel = (agent) => slug(safeLabel(() => agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey))

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** The policy the round GRANTS: invoke + domain refs on main/belt (aux is
 *  deliberately UNARMED — that is the TeamPermit-deny leg). */
function policyArms(fx) {
  return [
    { kind: 'tool-invoke', toolName: ACT },
    { kind: 'domain-ref', domainAuthorityId: DEV_MAIN },
    { kind: 'domain-ref', domainAuthorityId: DEV_BELT },
  ]
}

export async function apply(ctx) {
  const webServer = ctx.webServer
  record({ leg: 'plugin-apply', pid: process.pid, mode: MODE, hasWebServer: webServer !== undefined && typeof webServer.register === 'function', dist: DIST, jobs: JOBS })

  let lanes = null
  let fx = null
  try {
    fx = await import(new URL(`file://${join(import.meta.dirname, 'a5e2-fixtures.mjs')}`).href)
    lanes = await fx.loadA5E2Lanes({ distPackages: DIST, jobsBuild: JOBS })
    record({ leg: 'lanes-imported', ok: true, gw_exports: typeof lanes.gw.createJobsGateway, cf_arb_tree: lanes.cf.ARBITRARY_TREE_PROFILE_PUBLISHED })
  } catch (error) {
    record({ leg: 'lanes-imported', ok: false, error: String(error?.message ?? error) })
  }

  // ── routes: the test face reading the LIVE process ────────────────────────
  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5e2/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, mode: MODE, applied: true, assemblies: [...assemblies.keys()] }),
    }, 'a5e2 health')
    webServer.register({
      kind: 'exact', path: '/__a5e2/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5e2 journal')
    webServer.register({
      kind: 'exact', path: '/__a5e2/state',
      handler: (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) out[label] = stateView(asm)
        sendJson(res, 200, { mode: MODE, assemblies: out })
      },
    }, 'a5e2 state')
    webServer.register({
      kind: 'exact', path: '/__a5e2/agents',
      handler: async (_req, res) => {
        let rows
        try {
          const list = ctx.agents.list?.() ?? []
          rows = [...list].map((a) => ({ id: safeLabel(() => a?.id), session: safeLabel(() => a?.session?.header?.id), hasCtx: a?.ctx !== undefined }))
        } catch (error) { rows = [{ error: String(error?.message ?? error) }] }
        sendJson(res, 200, { agents: rows })
      },
    }, 'a5e2 agents')
    webServer.register({
      kind: 'exact', path: '/__a5e2/veto-table',
      handler: (_req, res) => {
        const asm = [...assemblies.values()][0]
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        sendJson(res, 200, { veto_matrix: asm.vetoMatrix, veto_side_effects: vetoSideEffects(asm), negative_controls: asm.negativeControls, device_states_on_disk: asm.mock.snapshot(), action_ledger_lines: asm.mock.actionCount() })
      },
    }, 'a5e2 veto-table')
    webServer.register({
      kind: 'exact', path: '/__a5e2/native-face',
      handler: (_req, res) => {
        const asm = [...assemblies.values()][0]
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        sendJson(res, 200, { native_face: asm.nativeFace, governance_census_deltas: asm.nativeCensusDeltas })
      },
    }, 'a5e2 native-face')
    webServer.register({
      kind: 'exact', path: '/__a5e2/native-leg',
      handler: async (req, res) => {
        // the runner brackets each host-native model-driven call with these
        // marks so the governance-observation delta around it is measured.
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const asm = [...assemblies.values()][0]
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        if (parsed.action === 'begin') {
          asm.nativeMark = { leg: String(parsed.leg ?? '?'), censusAt: Object.keys(asm.observations).length, at: Date.now() }
          sendJson(res, 200, { ok: true, marked: asm.nativeMark })
        } else if (parsed.action === 'end') {
          const n = Object.keys(asm.observations).length - (asm.nativeMark?.censusAt ?? 0)
          const delta = { leg: asm.nativeMark?.leg ?? '?', new_observations: n }
          asm.nativeCensusDeltas.push(delta)
          record({ leg: 'native-leg-delta', ...delta })
          sendJson(res, 200, { ok: true, delta })
        }
      },
    }, 'a5e2 native-leg')
    webServer.register({
      kind: 'exact', path: '/__a5e2/interlock-probe',
      handler: (_req, res) => {
        const asm = [...assemblies.values()][0]
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        sendJson(res, 200, interlockProbe(asm))
      },
    }, 'a5e2 interlock-probe')
    webServer.register({
      kind: 'exact', path: '/__a5e2/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const sessionId = String(parsed?.sessionId ?? '')
        const memberBRoot = String(parsed?.memberBRootSessionId ?? '')
        const agent = getAgent(sessionId)
        if (agent === null || agent === undefined) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = agentLabel(agent)
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        void assemble(label, agent, memberBRoot).catch((error) => {
          record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 800) })
        })
        sendJson(res, 200, { ok: true, started: true, label })
      },
    }, 'a5e2 assemble')
  }

  function getAgent(sessionId) {
    try { return ctx.agents.inject?.(['agents'], () => ctx.agents.get?.(sessionId)) ?? ctx.agents.get?.(sessionId) ?? null } catch { return null }
  }

  function vetoSideEffects(asm) {
    return asm.toolCalls
      .filter((c) => c.stage !== 'admitted-acted' && c.stage !== 'ungated-acted')
      .reduce((s, c) => s + (c.deviceDelta ?? 0), 0)
  }

  function stateView(asm) {
    const byName = {}
    for (const o of asm.observations) byName[String(o?.event)] = (byName[String(o?.event)] ?? 0) + 1
    return {
      mode: MODE,
      guard: {
        installOk: asm.installOk, installError: asm.installError ?? null,
        bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk,
        channel: asm.handle?.changeChannelStatus?.() ?? null,
        channelAtPublish: asm.channelAtPublish ?? null,
        probeRegisteredAfterPublish: asm.probeRegisteredAfterPublish ?? null,
      },
      eventCensus: byName,
      observationsCount: asm.observations.length,
      registryNames: (() => { try { return (asm.inner?.tools?.schemas?.(asm.agent) ?? []).map((r) => String(r?.name)).filter((n) => n.startsWith('a5e2_')) } catch { return null } })(),
      toolCalls: asm.toolCalls,
      vetoMatrix: asm.vetoMatrix,
      vetoSideEffects: vetoSideEffects(asm),
      negativeControls: asm.negativeControls,
      probeBodyCount: asm.probeBodyCount,
      grantMintedCount: asm.grantMintedCount,
      mockSnapshot: asm.mock.snapshot(),
      mockActionLines: asm.mock.actionCount(),
      gateway: {
        leaseState: asm.gw.lease.state(),
        jobs: asm.gw.job('*').map((r) => ({ jobId: r.jobId, ownerKey: r.ownerKey, state: r.state, pinnedIdentity: r.pinnedIdentity })),
        ownerA: asm.ownerA, ownerB: asm.ownerB,
        identity_disclosure: 'rootSessionIds are HOST facts (sessions the host created); instanceIds are row-local fixture labels (no durable MemberInstance rows in this world — the durable-members leg is on record in the W7 kit).',
      },
      rosterNames: asm.rosterNames,
      rosterHasJobStart: asm.rosterNames.some((n) => /job[_-]?start/i.test(n)),
      nativeFace: asm.nativeFace,
      nativeCensusDeltas: asm.nativeCensusDeltas,
    }
  }

  function interlockProbe(asm) {
    // The device must be ACTABLE by its lease holder (B) — otherwise the
    // earlier refusals could be explained by a dead device, not by the veto.
    const before = asm.mock.actionCount()
    const bAct = asm.mock.tryAct({ domainAuthorityId: DEV_BELT, memberKey: asm.ownerB.key, expectedVersion: asm.mock.readState(DEV_BELT).version, op: 'owner-spin', leg: 'interlock-owner-b' })
    const aOnBelt = asm.mock.tryAct({ domainAuthorityId: DEV_BELT, memberKey: asm.ownerA.key, expectedVersion: asm.mock.readState(DEV_BELT).version, op: 'foreign-spin', leg: 'interlock-foreign-a' })
    return {
      owner_b_act: bAct,
      foreign_a_act: aOnBelt,
      device_states_after: asm.mock.snapshot(),
      action_lines_delta: asm.mock.actionCount() - before,
      gateway_lease_state: asm.gw.lease.state(),
    }
  }

  // ── the live assembly for one Agent ───────────────────────────────────────
  async function assemble(label, agent, memberBRoot) {
    const asm = {
      observations: [], toolCalls: [], vetoMatrix: [], negativeControls: [],
      nativeCensusDeltas: [], nativeMark: null,
      probeBodyCount: 0, grantMintedCount: 0,
      installOk: false, installError: null, bindOwnOk: false, publishedOk: false,
      handle: null, inner: null, agent,
    }
    assemblies.set(label, asm)
    const agentCtx = agent?.ctx
    if (agentCtx === undefined || typeof agentCtx.on !== 'function' || typeof agentCtx.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', label, hasOn: typeof agentCtx?.on, hasRegister: typeof agentCtx?.tools?.register })
      return
    }
    asm.inner = agentCtx

    // the Domain MOCK (labelled data source: CAS + lease interlock, on disk)
    asm.mock = fx.createDomainMock({
      worldRoot: WORLD_ROOT,
      devices: [
        { id: DEV_MAIN, slug: 'main', version: 0, leaseOwner: null },
        { id: DEV_AUX, slug: 'aux', version: 0, leaseOwner: null },
        { id: DEV_BELT, slug: 'belt', version: 0, leaseOwner: 'B' }, // pre-leased to member B → A's act is a DomainPermit refusal
      ],
    })

    // the jobs-gateway identity face (public barrel, W7-accepted compile)
    const defStore = new Map([[`a5e2\u0000${ACT}`, 'def-v1']])
    asm.gw = lanes.gw.createJobsGateway({
      resolveDefinition: (scopeKeyArg, nameArg) => {
        const v = defStore.get(`${String(scopeKeyArg)}\u0000${String(nameArg)}`)
        return v === undefined ? { ok: false, identity: 'never-registered' } : { ok: true, identity: v }
      },
      onObserve: (o) => record({ leg: 'gateway-observation', ...o }),
    })
    const rootA = safeLabel(() => agent?.session?.header?.id ?? agent?.id)
    const admitA = asm.gw.admitJob({ jobId: 'e2-job-a', owner: { rootSessionId: rootA, instanceId: 'a5e2-inst-a' }, scopeKey: 'a5e2', toolName: ACT, pinnedIdentity: 'def-v1' })
    asm.ownerA = { rootSessionId: rootA, instanceId: 'a5e2-inst-a', admitted: admitA.ok === true, key: admitA.ok ? admitA.job.ownerKey : null }
    const rootB = memberBRoot !== '' ? memberBRoot : 'a5e2-member-b-root(unprovided)'
    const admitB = asm.gw.admitJob({ jobId: 'e2-job-b', owner: { rootSessionId: rootB, instanceId: 'a5e2-inst-b' }, scopeKey: 'a5e2', toolName: ACT, pinnedIdentity: 'def-v1' })
    asm.ownerB = { rootSessionId: rootB, instanceId: 'a5e2-inst-b', admitted: admitB.ok === true, key: admitB.ok ? admitB.job.ownerKey : null }
    // re-lease belt to B's CANONICAL gateway owner key (real identity face)
    const beltPath = join(asm.mock.devicesRoot, 'belt.json')
    const belt = JSON.parse(readFileSync(beltPath, 'utf8'))
    belt.lease_owner = asm.ownerB.key ?? 'B'
    writeFileSync(beltPath, JSON.stringify(belt, null, 2) + '\n')
    record({ leg: 'gateway-identity', ownerA: asm.ownerA, ownerB: asm.ownerB })

    // native face capture (public tools.schemas() view; NO new tools invented)
    asm.rosterNames = (() => { try { return (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => String(r?.name)) } catch { return [] } })()
    asm.nativeFace = (() => {
      try {
        const rows = (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => ({ name: String(r?.name), params: r?.parameters ?? r?.schema ?? null }))
        return {
          total: rows.length,
          names: rows.map((r) => r.name),
          has_edit: rows.some((r) => r.name === 'edit'),
          has_read_image: rows.some((r) => r.name === 'read_image'),
          has_write: rows.some((r) => r.name === 'write'),
          has_str_replace_editor: rows.some((r) => /str_replace_editor/.test(r.name)),
          schemas: rows.filter((r) => ['edit', 'read_image', 'write', 'read'].includes(r.name)),
        }
      } catch (error) { return { error: String(error?.message ?? error) } }
    })()

    const outDef = {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
    }
    let callSeq = 0
    const refusalText = (kind, code, detail) => `A5E2-REFUSED kind=${kind} code=${String(code)} payloadBytes=0 detail=${String(detail).slice(0, 240)}`

    async function actBody(raw) {
      const callId = `e2-act-${++callSeq}`
      const entry = { callId, tool: 'domain-act', stage: null, grantId: null, fingerprint: null, device: null, team_permit: null, domain_permit: null, outcome: null, code: null, detail: null, deviceDelta: 0, actionsBefore: asm.mock.actionCount(), actionsAfter: null, execEdgeFirst: null, execEdgeReplay: null, ledgerConsumed: null, presented: null, decisionVerbatim: null }
      asm.toolCalls.push(entry)
      const device = typeof raw?.device === 'string' ? raw.device : ''
      const op = typeof raw?.op === 'string' ? raw.op : 'spin'
      const expectedVersion = Number.isInteger(raw?.expected_version) ? raw.expected_version : -1
      entry.device = device
      const actorKey = asm.ownerA.key ?? 'A'

      // 1) Domain-reference resolution FIRST: an unresolvable reference is
      //    refused BEFORE any grant is minted (fail-closed, no binding guess).
      if (!asm.mock.resolves(device)) {
        entry.stage = 'domain-reference-unresolved'
        entry.team_permit = null
        entry.domain_permit = 'not-asked'
        entry.outcome = 'denied'
        entry.code = 'DOMAIN_DENIED'
        entry.detail = `unresolved-domain-reference ${device}`
        entry.actionsAfter = asm.mock.actionCount()
        entry.deviceDelta = entry.actionsAfter - entry.actionsBefore
        asm.negativeControls.push({ attempt: 'unresolved-domain-reference', outcome: 'typed-deny', code: 'DOMAIN_DENIED', device, grants_minted_delta: asm.grantMintedCount })
        record({ leg: 'domain-ref-fail-closed', callId, device, grants: asm.grantMintedCount })
        return { text: refusalText('domain-reference', 'DOMAIN_DENIED', `unresolved-domain-reference ${device} (no grant minted, no binding guessed)`) }
      }

      const fingerprint = fx.canonicalParamsFingerprint({ tool: ACT, device, op, expected_version: expectedVersion, callId })
      entry.fingerprint = fingerprint
      const effects = fx.effectsFor(lanes.tg, { toolName: ACT, domainAuthorityId: device })

      if (MODE === 'gated') {
        // 2) TeamPermit half: the REAL PR2 kernel (bind → grant).
        const flow = await fx.admitCall(lanes, { registeredName: ACT, callId, requestedEffects: effects, parametersFingerprint: fingerprint, policyArms: policyArms(fx) })
        if (flow.grant === null || flow.grant === undefined) {
          entry.stage = flow.stage
          entry.team_permit = false
          entry.domain_permit = 'not-asked'
          entry.outcome = 'denied'
          entry.code = flow.decision?.error?.code ?? flow.decision?.kind ?? flow.stage
          entry.decisionVerbatim = safeJson(flow.decision ?? { error: flow.error })
          entry.detail = String(flow.decision?.error?.message ?? `admission returned ${String(flow.stage)}`).slice(0, 240)
          entry.actionsAfter = asm.mock.actionCount()
          entry.deviceDelta = entry.actionsAfter - entry.actionsBefore
          asm.vetoMatrix.push({ team_permit: false, domain_permit: true, outcome: 'denied', leg: `kernel-${String(flow.stage)}`, device, kernel_decision: safeJson(flow.decision ?? { error: String(flow.error) }), side_effects: entry.deviceDelta })
          record({ leg: 'team-denied', callId, device, stage: flow.stage })
          return { text: refusalText('team-denied', entry.code, entry.detail) }
        }
        entry.grantId = flow.grant.grantId
        asm.grantMintedCount += 1
        entry.team_permit = true
        entry.stage = 'team-admitted'
        // 3) DomainPermit half: the MOCK interlock + CAS decides.
        const permit = asm.mock.decide({ domainAuthorityId: device, memberKey: actorKey, expectedVersion })
        if (!permit.ok) {
          entry.domain_permit = false
          entry.outcome = 'denied'
          entry.code = permit.code
          entry.detail = permit.detail
          entry.actionsAfter = asm.mock.actionCount()
          entry.deviceDelta = entry.actionsAfter - entry.actionsBefore
          asm.vetoMatrix.push({ team_permit: true, domain_permit: false, outcome: 'denied', error: permit.code, leg: `mock-${String(permit.detail).split(' ')[0]}`, device, side_effects: entry.deviceDelta })
          record({ leg: 'domain-denied', callId, device, code: permit.code })
          return { text: refusalText('domain-denied', permit.code, permit.detail) }
        }
        // 4) exec edge ONE-SHOT immediately before the single side effect.
        const edge = fx.execEdgeConsume(flow, { replay: false })
        entry.execEdgeFirst = edge
        if (!edge.ok) return { text: refusalText('exec-edge', edge.code, edge.message) }
        const act = asm.mock.act({ domainAuthorityId: device, memberKey: actorKey, expectedVersion, op, leg: callId })
        entry.execEdgeReplay = fx.execEdgeConsume(flow, { replay: true })
        entry.ledgerConsumed = flow.ledger.consumedCount()
        entry.actionsAfter = asm.mock.actionCount()
        entry.deviceDelta = entry.actionsAfter - entry.actionsBefore
        entry.domain_permit = true
        entry.outcome = 'acted'
        entry.stage = 'admitted-acted'
        entry.presented = `A5E2-ACTED device=${device} op=${op} version=${act.version_before}->${act.version_after} lease=${String(act.lease_owner)}`
        asm.vetoMatrix.push({ team_permit: true, domain_permit: true, outcome: 'acted', leg: callId, device, version_after: act.version_after })
        record({ leg: 'acted', callId, device, grant: entry.grantId, version: act.version_after })
        return { text: entry.presented }
      }

      // ungated RED control: NO kernel — a standing allow, TeamPermit never asked.
      entry.team_permit = 'never-asked'
      const permit = asm.mock.decide({ domainAuthorityId: device, memberKey: actorKey, expectedVersion })
      entry.actionsAfter = asm.mock.actionCount()
      if (!permit.ok) {
        entry.domain_permit = false
        entry.outcome = 'denied'
        entry.code = permit.code
        entry.detail = permit.detail
        entry.deviceDelta = asm.mock.actionCount() - entry.actionsBefore
        return { text: refusalText('domain-denied', permit.code, permit.detail) }
      }
      const act = asm.mock.act({ domainAuthorityId: device, memberKey: actorKey, expectedVersion, op, leg: callId })
      entry.deviceDelta = asm.mock.actionCount() - entry.actionsBefore
      entry.domain_permit = true
      entry.outcome = 'acted'
      entry.stage = 'ungated-acted'
      entry.presented = `A5E2-ACTED-UNGATED device=${device} version=${act.version_before}->${act.version_after}`
      record({ leg: 'ungated-acted', callId, device })
      return { text: entry.presented }
    }

    const actDef = {
      name: ACT,
      description: 'Alpha.5 W-E2 governed Domain-mock device act (MOCK CAS/interlock data source). args: {device, op, expected_version}.',
      parameters: { type: 'object', properties: { device: { type: 'string' }, op: { type: 'string' }, expected_version: { type: 'number' } }, required: ['device'] },
      output: outDef,
      execute: async (raw) => actBody(raw),
    }
    const probeDef = {
      name: PROBE,
      description: 'Alpha.5 W-E2 unbound-control probe. args: {}.',
      parameters: { type: 'object', properties: {} },
      output: outDef,
      execute: async () => { asm.probeBodyCount += 1; record({ leg: 'probe-body-ran', label }); return { text: 'A5E2-PROBE-BODY-RAN' } },
    }

    // ── assembly order (the W5-accepted shape): defs → guard install → bind → publish → post-publish probe ──
    try {
      asm.inner.tools.register(actDef)
      record({ leg: 'register', label, names: [ACT], ok: true })
    } catch (error) {
      record({ leg: 'register', label, ok: false, error: String(error?.message ?? error) })
      return
    }

    if (MODE === 'gated') {
      const nativeNames = asm.rosterNames.filter((n) => n.length > 0)
      const trusted = [...new Set([safeLabel(() => agent?.id), safeLabel(() => agent?.session?.header?.id)].filter((s) => !s.startsWith('(unreadable') && s !== '(unknown-agent)'))]
      const outcome = lanes.td.installScopedToolGuard({
        agentCtx: { tools: asm.inner.tools, on: asm.inner.on?.bind(asm.inner) },
        runtimeAgent: agent,
        trustedIdentities: trusted,
        nativeNames,
        assemblyOwnedNames: [ACT],
        onObserve: (row) => { asm.observations.push(row) },
      })
      asm.installOk = outcome.ok === true
      if (!outcome.ok) {
        asm.installError = { code: outcome.error?.code, message: String(outcome.error?.message).slice(0, 300) }
        record({ leg: 'guard-install-refused', label, code: outcome.error?.code })
        return
      }
      asm.handle = outcome.value
      const bound = asm.handle.bindOwnTools([ACT])
      asm.bindOwnOk = bound.ok === true
      const published = asm.handle.publish()
      asm.publishedOk = published.ok === true
      asm.channelAtPublish = asm.handle.changeChannelStatus()
      record({ leg: 'guard-assembled', label, installOk: true, bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk, channelAtPublish: asm.channelAtPublish })
    }

    try {
      asm.inner.tools.register(probeDef)
      asm.probeRegisteredAfterPublish = true
      record({ leg: 'register', label, name: PROBE, afterAssembly: MODE === 'gated', ok: true })
    } catch (error) {
      asm.probeRegisteredAfterPublish = false
      record({ leg: 'register', label, name: PROBE, ok: false, error: String(error?.message ?? error) })
    }

    // refresh the native face AFTER the assembly (names the row added excluded
    // by the caller-side filter in stateView; here keep the raw post-view too)
    asm.nativeFacePost = (() => {
      try { return (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => String(r?.name)) } catch { return null }
    })()
    record({ leg: 'assembly-complete', label, native_edit: asm.nativeFace?.has_edit === true, native_read_image: asm.nativeFace?.has_read_image === true })
  }
}

function safeJson(v) {
  try { return JSON.parse(JSON.stringify(v ?? null)) } catch { return String(v).slice(0, 300) }
}
