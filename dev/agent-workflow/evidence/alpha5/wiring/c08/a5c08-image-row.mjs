/**
 * a5c08-image-row.mjs — C-08 gap-writer LIVE assembly for matrix row M-05
 * (read_image chain) — branch alpha5-gap-c08, base origin/master @ aece4f21.
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam the W5 /
 * W-E2 rounds used (IF-1). It builds the assembly row that matrix M-05
 * registers as missing: `image_read.chain = admission-gated-controlled-fs`
 * (附件引用→读取→解码→渲染 observed through the PR3 ControlledFs
 * admission-gated lane), plus its two negative controls in the lane's OWN
 * vocabulary:
 *
 *   gated mode    register `a5c08_image_read` / `a5c08_thumb_probe` /
 *                 `a5c08_unbound_read` / `a5c08_binary_probe` → install the
 *                 PR1 Guard → `bindOwnTools` + `publish` → every model-driven
 *                 call runs: PR2 admit (tool-invoke + `read` resource effect
 *                 over the policy-covered attachments dir) → per-call
 *                 `createAdmissionGatedControlledFs` bound to THIS call's
 *                 fingerprint (law 2) → the lane's exec-time recheck re-asks
 *                 the kernel (exec-edge ONE-SHOT consume) → read the attachment
 *                 bytes THROUGH THE LANE → decode (base64 → PNG header) →
 *                 render (verbatim presentation into the real transcript).
 *                 Negative controls run through the SAME faces: the thumbnail
 *                 path is outside the granted effect ⇒ C-FS typed refusal
 *                 BEFORE any open (deny-before-open, 0 bytes); the UNBOUND
 *                 lane face refuses by name (`admission-unbound`, lane law 1);
 *                 a second read inside the SAME bound call hits the one-shot
 *                 ledger (`grant-consumed`). No production image tool is
 *                 invented: these are row-local fixture tools, labelled.
 *
 *   ungated mode  the same tool defs WITHOUT the guard, WITHOUT the PR2 kernel
 *                 and WITHOUT the gated lane (standing allow, host-direct
 *                 reads) — the RED control: every gate-carried refusal must go
 *                 RED (the thumbnail is readable, the unbound read reads, bytes
 *                 flow with a governance-observation delta of 0), proving the
 *                 refusals booked in gated mode are carried by the gates, not
 *                 by the prose.
 *
 * MEASUREMENTS booked as gap facts (not inventions, not assertions): the lane's
 * read face is TEXT (utf8) — a raw binary PNG read back through it is measured
 * for byte fidelity and recorded honestly (the attachment transport form that
 * survives the text face is base64, as real attachments are).
 *
 * Kit-provided environment:
 *   A5C08_DIST     <worktree>/packages/runtime/dist/packages
 *   A5C08_LEDGER   JSONL assembly-ledger path (append-only)
 *   A5C08_WORLD    absolute world root (workspace/repo under it)
 *   A5C08_MODE     gated | ungated
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/c08/a5c08-image-row
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5c08-image-chain'
export const inject = ['webServer', 'agents']

const LEDGER = process.env['A5C08_LEDGER'] ?? ''
const DIST = process.env['A5C08_DIST'] ?? ''
const WORLD_ROOT = process.env['A5C08_WORLD'] ?? ''
const MODE = process.env['A5C08_MODE'] ?? 'gated'

const IMG = 'a5c08_image_read'
const THUMB = 'a5c08_thumb_probe'
const UNBOUND = 'a5c08_unbound_read'
const BINARY = 'a5c08_binary_probe'

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

export async function apply(ctx) {
  const webServer = ctx.webServer
  record({ leg: 'plugin-apply', pid: process.pid, mode: MODE, hasWebServer: webServer !== undefined && typeof webServer.register === 'function', dist: DIST })

  let lanes = null
  let fx = null
  try {
    fx = await import(new URL(`file://${join(import.meta.dirname, 'a5c08-fixtures.mjs')}`).href)
    lanes = await fx.loadA5C08Lanes({ distPackages: DIST })
    record({ leg: 'lanes-imported', ok: true, cf_arb_tree: lanes.cf.ARBITRARY_TREE_PROFILE_PUBLISHED, cf_exports: typeof lanes.cf.createAdmissionGatedControlledFs })
  } catch (error) {
    record({ leg: 'lanes-imported', ok: false, error: String(error?.message ?? error) })
  }

  // ── routes: the test face reading the LIVE process ────────────────────────
  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5c08/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, mode: MODE, applied: true, assemblies: [...assemblies.keys()] }),
    }, 'a5c08 health')
    webServer.register({
      kind: 'exact', path: '/__a5c08/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5c08 journal')
    webServer.register({
      kind: 'exact', path: '/__a5c08/state',
      handler: (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) out[label] = stateView(asm)
        sendJson(res, 200, { mode: MODE, assemblies: out })
      },
    }, 'a5c08 state')
    webServer.register({
      kind: 'exact', path: '/__a5c08/agents',
      handler: async (_req, res) => {
        let rows
        try {
          const list = ctx.agents.list?.() ?? []
          rows = [...list].map((a) => ({ id: safeLabel(() => a?.id), session: safeLabel(() => a?.session?.header?.id), hasCtx: a?.ctx !== undefined }))
        } catch (error) { rows = [{ error: String(error?.message ?? error) }] }
        sendJson(res, 200, { agents: rows })
      },
    }, 'a5c08 agents')
    webServer.register({
      kind: 'exact', path: '/__a5c08/chain-table',
      handler: (_req, res) => {
        const asm = [...assemblies.values()][0]
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        sendJson(res, 200, {
          chain: asm.chainView === undefined ? null : asm.chainView(),
          negative_controls: asm.negativeControls,
          lane_ledgers: asm.laneLedgers,
          observationsCount: asm.observations.length,
        })
      },
    }, 'a5c08 chain-table')
    webServer.register({
      kind: 'exact', path: '/__a5c08/native-face',
      handler: (_req, res) => {
        const asm = [...assemblies.values()][0]
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        sendJson(res, 200, { native_face: asm.nativeFace, governance_census_deltas: asm.nativeCensusDeltas })
      },
    }, 'a5c08 native-face')
    webServer.register({
      kind: 'exact', path: '/__a5c08/native-leg',
      handler: async (req, res) => {
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
    }, 'a5c08 native-leg')
    webServer.register({
      kind: 'exact', path: '/__a5c08/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const sessionId = String(parsed?.sessionId ?? '')
        const agent = getAgent(sessionId)
        if (agent === null || agent === undefined) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = agentLabel(agent)
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        void assemble(label, agent).catch((error) => {
          record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 800) })
        })
        sendJson(res, 200, { ok: true, started: true, label })
      },
    }, 'a5c08 assemble')
  }

  function getAgent(sessionId) {
    try { return ctx.agents.inject?.(['agents'], () => ctx.agents.get?.(sessionId)) ?? ctx.agents.get?.(sessionId) ?? null } catch { return null }
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
      },
      eventCensus: byName,
      observationsCount: asm.observations.length,
      registryNames: (() => { try { return (asm.inner?.tools?.schemas?.(asm.agent) ?? []).map((r) => String(r?.name)).filter((n) => n.startsWith('a5c08_')) } catch { return null } })(),
      toolCalls: asm.toolCalls,
      chain: asm.chainView === undefined ? null : asm.chainView(),
      negativeControls: asm.negativeControls,
      laneLedgers: asm.laneLedgers,
      nativeFace: asm.nativeFace,
      nativeCensusDeltas: asm.nativeCensusDeltas,
    }
  }

  // ── the live assembly for one Agent ───────────────────────────────────────
  async function assemble(label, agent) {
    const asm = {
      observations: [], toolCalls: [], negativeControls: [], laneLedgers: {},
      nativeCensusDeltas: [], nativeMark: null,
      installOk: false, installError: null, bindOwnOk: false, publishedOk: false,
      handle: null, inner: null, agent,
      world: null,
    }
    assemblies.set(label, asm)
    const agentCtx = agent?.ctx
    if (agentCtx === undefined || typeof agentCtx.on !== 'function' || typeof agentCtx.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', label, hasOn: typeof agentCtx?.on, hasRegister: typeof agentCtx?.tools?.register })
      return
    }
    asm.inner = agentCtx

    // the attachment fixture world (real PNG + base64 attachment + outside-thumb)
    const repoRoot = join(WORLD_ROOT, 'workspace', 'repo')
    asm.world = fx.buildC08World(repoRoot)
    asm.chainReadArm = asm.world.attachDir // the ONLY location the read effect covers
    record({ leg: 'world-built', repo: repoRoot, png_sha: asm.world.png.sha, png_bytes: asm.world.png.bytes })

    // the chain view (computed from what the row ACTUALLY ran — never back-filled)
    asm.chainView = () => {
      const acted = asm.toolCalls.find((c) => c.tool === 'image-read' && c.outcome === 'acted')
      return {
        image_read: acted === undefined ? null : {
          chain: MODE === 'gated' ? 'admission-gated-controlled-fs' : 'host-direct-read',
          grant_id: acted.grantId, fingerprint: acted.fingerprint,
          lane_op: acted.laneOp, lane_ok: acted.laneOk, lane_fingerprint: acted.laneFingerprint ?? null,
          exec_edge_first: acted.execEdgeFirst, exec_edge_replay: acted.execEdgeReplay, ledger_consumed: acted.ledgerConsumed,
          bytes: acted.bytes ?? null, decode: acted.decode ?? null, decoded_sha_matches_disk: acted.decodedShaMatchesDisk ?? null,
          presented: acted.presented,
        },
      }
    }

    // native face capture (public tools.schemas() view; NO new native tools)
    asm.rosterNames = (() => { try { return (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => String(r?.name)) } catch { return [] } })()
    asm.nativeFace = (() => {
      try {
        const rows = (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => ({ name: String(r?.name), params: r?.parameters ?? r?.schema ?? null }))
        return {
          total: rows.length,
          names: rows.map((r) => r.name),
          has_read_image: rows.some((r) => r.name === 'read_image'),
          schemas: rows.filter((r) => ['read', 'edit', 'write', 'read_image'].includes(r.name)),
        }
      } catch (error) { return { error: String(error?.message ?? error) } }
    })()

    const outDef = {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
    }
    let callSeq = 0
    const refusalText = (kind, code, detail) => `A5C08-REFUSED kind=${kind} code=${String(code)} payloadBytes=0 detail=${String(detail).slice(0, 240)}`

    /** Resolve a row-relative attachment locator; anything escaping the repo
     *  fixture dir is refused before the lane is even consulted (row law). */
    function resolveAttachment(rawPath) {
      const rel = String(rawPath ?? '')
      const abs = join(repoRoot, rel)
      if (!abs.startsWith(repoRoot + '/')) return { ok: false, reason: 'locator-escapes-repo' }
      return { ok: true, abs, locator: abs }
    }

    // ── the gated attachment-read core: PR2 grant → per-call bound lane read ──
    async function gatedReadCore({ toolName, raw, entry, targetOverride, bound = true }) {
      const callId = entry.callId
      const readLocator = asm.chainReadArm // armed effect = the attachments dir
      const fingerprint = fx.canonicalParamsFingerprint({ tool: toolName, attachment: raw, callId })
      entry.fingerprint = fingerprint
      const effects = fx.effectsForRead(lanes.tg, { toolName, readLocator })

      // TeamPermit half: the REAL PR2 kernel (bind → grant over the armed arm).
      const flow = await fx.admitCall(lanes, { registeredName: toolName, callId, requestedEffects: effects, parametersFingerprint: fingerprint, policyArms: policyArms() })
      if (flow.grant === null || flow.grant === undefined) {
        entry.stage = flow.stage
        entry.outcome = 'denied'
        entry.code = flow.decision?.error?.code ?? flow.decision?.kind ?? flow.stage
        entry.detail = String(flow.decision?.error?.message ?? `admission returned ${String(flow.stage)}`).slice(0, 240)
        return { refused: true, stage: 'team-denied', code: entry.code, detail: entry.detail }
      }
      entry.grantId = flow.grant.grantId
      asm.grantMintedCount = (asm.grantMintedCount ?? 0) + 1
      entry.stage = 'team-admitted'

      // per-call ledger view: the lane must see THIS call's consumption.
      const consumedGrantIds = new Set()

      // the exec-edge port: the lane's exec-time recheck RE-ASKS the kernel.
      const execPort = {
        recheckCall: async (intent) => {
          const v = fx.execEdgeConsume(flow)
          entry.execEdgeFirst = v
          if (!v.ok) return { ok: false, reason: String(v.code) }
          consumedGrantIds.add(flow.grant.grantId)
          entry.ledgerConsumed = flow.ledger.consumedCount()
          return { ok: true }
        },
      }

      const lane = bound
        ? fx.makeGatedFs(lanes.cf, {
            repoRoot,
            // the frozen AdmissionBoundFsCall shape: { admission: port, parametersFingerprint }
            admission: { admission: execPort, parametersFingerprint: fingerprint },
            consumedGrantIds,
          })
        : fx.makeGatedFs(lanes.cf, { repoRoot, consumedGrantIds }) // UNBOUND face (law 1)
      const ref = fx.fileRef(lanes.tg, 'absolute-path', targetOverride ?? entry.targetLocator, ['read'])
      const res = await lane.fs.readText(flow.grant, ref, { offset: 0, limit: null })
      asm.laneLedgers[callId] = lane.ledger.map((e) => ({ ...e }))
      entry.laneOp = 'readText'
      if (!res.ok) {
        const cfReason = res.error?.details?.cfReason ?? null
        const cfDiag = String(res.error?.message ?? '')
        entry.outcome = 'denied'
        entry.code = cfReason ?? 'cf-refused'
        entry.cfDiag = cfDiag.slice(0, 300)
        return { refused: true, stage: 'cf-denied', code: entry.code, diag: entry.cfDiag }
      }
      entry.laneOk = true
      entry.laneFingerprint = res.value.contentFingerprint
      entry.laneLedgerOkLine = (asm.laneLedgers[callId] ?? []).some((e) => e.stage === 'fd-closed')
      return { ok: true, flow, res, lane, laneCallId: callId }
    }

    function policyArms() {
      return [
        { kind: 'tool-invoke', toolName: IMG },
        { kind: 'tool-invoke', toolName: THUMB },
        { kind: 'tool-invoke', toolName: UNBOUND },
        { kind: 'tool-invoke', toolName: BINARY },
        { kind: 'read', locator: asm.chainReadArm },
      ]
    }

    // ── tool bodies ──────────────────────────────────────────────────────────
    async function imageReadBody(rawArgs) {
      const callId = `c08-img-${++callSeq}`
      const entry = { callId, tool: 'image-read', stage: null, outcome: null, code: null, grantId: null, fingerprint: null, targetLocator: null, laneOp: null, laneOk: null, execEdgeFirst: null, execEdgeReplay: null, ledgerConsumed: null, bytes: null, decode: null, decodedShaMatchesDisk: null, presented: null }
      asm.toolCalls.push(entry)
      const r = resolveAttachment(rawArgs?.attachment)
      if (!r.ok) { entry.outcome = 'denied'; entry.code = r.reason; return { text: refusalText('row-law', r.reason, 'attachment locator escapes the fixture repo') } }
      entry.targetLocator = r.locator

      if (MODE === 'gated') {
        const core = await gatedReadCore({ toolName: IMG, raw: String(rawArgs?.attachment ?? ''), entry })
        if (core.refused === true) return { text: refusalText(core.stage, core.code, core.detail ?? core.diag ?? '') }

        // ONE-SHOT discipline on the FS path: a SECOND read inside the SAME
        // bound call, on the SAME lane, must hit the consumed ledger
        // (deny-before-open, typed — never a second open of the object).
        const flow = core.flow
        const secondRef = fx.fileRef(lanes.tg, 'absolute-path', entry.targetLocator, ['read'])
        const replay = await core.lane.fs.readText(flow.grant, secondRef, { offset: 0, limit: null })
        entry.execEdgeReplay = replay.ok ? { ok: true } : { ok: false, code: replay.error?.details?.cfReason ?? 'cf-refused' }
        asm.laneLedgers[core.laneCallId] = core.lane.ledger.map((e) => ({ ...e }))
        if (replay.ok) { entry.outcome = 'VIOLATED'; return { text: refusalText('oneshot-violation', 'grant-consumed-not-enforced', 'second read inside the same call was NOT refused') } }

        // DECODE + RENDER stages over the bytes the chain carried.
        const text = core.res.value.text
        const pngBuf = Buffer.from(text, 'base64')
        const dec = fx.decodePng(pngBuf)
        const decodedSha = fx.sha256Buf(pngBuf)
        entry.bytes = pngBuf.length
        entry.decode = dec
        entry.decodedShaMatchesDisk = dec.ok === true && decodedSha === asm.world.png.sha
        if (!entry.decodedShaMatchesDisk) { entry.outcome = 'decode-mismatch'; return { text: refusalText('decode', 'png-fidelity', 'bytes carried by the chain do not hash to the attachment on disk') } }
        entry.outcome = 'acted'
        entry.stage = 'admitted-acted'
        entry.presented = `A5C08-IMG ok chain=gated-fs attachment=${String(rawArgs?.attachment)} bytes=${String(pngBuf.length)} px=${String(dec.width)}x${String(dec.height)} decoded_sha=${decodedSha.slice(0, 18)}… grant=${String(entry.grantId)} edge_consumed=${String(entry.ledgerConsumed)} second_read=${String(entry.execEdgeReplay?.code ?? '?')}`
        record({ leg: 'image-read-acted', callId, grant: entry.grantId, bytes: pngBuf.length })
        return { text: entry.presented }
      }

      // ungated RED face: host-direct read, no lane, no kernel, no observation.
      const buf = fx.hostDirectRead(r.abs)
      const pngBuf = Buffer.from(buf.toString('utf8'), 'base64') // the .b64 attachment form
      const dec = fx.decodePng(pngBuf)
      entry.outcome = 'acted'
      entry.stage = 'ungated-host-direct'
      entry.chain = 'host-direct-read'
      entry.bytes = pngBuf.length
      entry.decode = dec
      entry.presented = `A5C08-IMG-UNGATED chain=host-direct bytes=${String(pngBuf.length)} px=${String(dec.width)}x${String(dec.height)}`
      record({ leg: 'image-read-ungated', callId })
      return { text: entry.presented }
    }

    async function thumbBody(rawArgs) {
      const callId = `c08-thumb-${++callSeq}`
      const entry = { callId, tool: 'thumb-bypass', stage: null, outcome: null, code: null, cfDiag: null, grantId: null, fingerprint: null, targetLocator: null, laneOp: null, laneOk: null, bytes: null, presented: null }
      asm.toolCalls.push(entry)
      const r = resolveAttachment(rawArgs?.attachment)
      if (!r.ok) { entry.outcome = 'denied'; entry.code = r.reason; return { text: refusalText('row-law', r.reason, 'locator escapes repo') } }
      entry.targetLocator = r.locator

      if (MODE === 'gated') {
        // the bypass attempt asks for the SAME armed effect set (a read over
        // the attachments dir) while targeting thumb/ — if anything lets this
        // through, it is a real bypass; the honest expectation is a C-FS
        // typed refusal before any open.
        const core = await gatedReadCore({ toolName: THUMB, raw: String(rawArgs?.attachment ?? ''), entry, targetOverride: r.locator })
        if (core.refused === true && core.stage === 'cf-denied') {
          entry.outcome = 'denied'
          asm.negativeControls.push({
            attempt: 'thumbnail-read-bypass',
            outcome: 'typed-deny',
            cf_reason: entry.code,
            deny_stage: 'before-open (readViaRef/admit: effectCovers)',
            bytes_leaked: 0,
            diagnostic: entry.cfDiag,
            ledger_refused_line: (asm.laneLedgers[callId] ?? []).some((e) => String(e.stage).startsWith('refused:')),
          })
          record({ leg: 'thumb-bypass-refused', callId, code: entry.code })
          return { text: refusalText('thumbnail-bypass', entry.code, entry.cfDiag ?? '') }
        }
        if (core.refused === true) { // team-denied before even the lane — book that too, honestly
          asm.negativeControls.push({ attempt: 'thumbnail-read-bypass', outcome: 'typed-deny', deny_layer: 'team-kernel', cf_reason: null, bytes_leaked: 0, code: entry.code })
          return { text: refusalText('thumbnail-bypass-team', entry.code, entry.detail ?? '') }
        }
        // the bypass SUCCEEDED — a violation of the criterion; book and say so.
        entry.outcome = 'BYPASSED'
        entry.bytes = core.res.value.text.length
        return { text: refusalText('VIOLATION', 'thumbnail-bypass-succeeded', 'the thumbnail bytes were disclosed through the gated lane') }
      }

      // ungated RED face: the thumbnail is readable with zero governance.
      const buf = fx.hostDirectRead(r.abs)
      entry.outcome = 'ungated-readable'
      entry.bytes = buf.length
      const sha = fx.sha256Buf(buf)
      record({ leg: 'thumb-ungated-read', callId, sha })
      return { text: `A5C08-THUMB-UNGATED bytes=${String(buf.length)} sha=${sha.slice(0, 18)}… (zero governance observation)` }
    }

    async function unboundBody(rawArgs) {
      const callId = `c08-unbound-${++callSeq}`
      const entry = { callId, tool: 'unbound-read', stage: null, outcome: null, code: null, cfDiag: null, grantId: null, targetLocator: null, bytes: null, presented: null }
      asm.toolCalls.push(entry)
      const r = resolveAttachment(rawArgs?.attachment)
      if (!r.ok) { entry.outcome = 'denied'; entry.code = r.reason; return { text: refusalText('row-law', r.reason, 'locator escapes repo') } }
      entry.targetLocator = r.locator

      if (MODE === 'gated') {
        // UNBOUND face: an admitted call exists, but this lane was wired
        // WITHOUT an admission binding ⇒ lane law 1 refuses by name.
        const core = await gatedReadCore({ toolName: UNBOUND, raw: String(rawArgs?.attachment ?? ''), entry, targetOverride: r.locator, bound: false })
        // gatedReadCore with bound=false: the lane refuses EVERY op (recheck
        // reason admission-unbound); it returns { refused:true, stage:'cf-denied' }.
        if (core.refused === true && core.stage === 'cf-denied') {
          entry.outcome = 'denied'
          const recheckReason = /admission-unbound/.test(entry.cfDiag ?? '') ? 'admission-unbound' : null
          asm.negativeControls.push({
            attempt: 'unbound-image-read',
            outcome: 'typed-deny',
            error: recheckReason ?? entry.code,
            recheck_reason: recheckReason,
            cf_reason: entry.code,
            bytes_leaked: 0,
            diagnostic: entry.cfDiag,
            ledger_refused_line: (asm.laneLedgers[callId] ?? []).some((e) => String(e.stage).startsWith('refused:')),
          })
          record({ leg: 'unbound-refused', callId, code: entry.code, recheck_reason: recheckReason })
          return { text: refusalText('unbound', recheckReason ?? entry.code, entry.cfDiag ?? '') }
        }
        entry.outcome = core.refused === true ? 'denied' : 'UNBOUND-READ-SUCCEEDED'
        return { text: core.refused === true ? refusalText('unbound', entry.code, entry.cfDiag ?? '') : 'A5C08-VIOLATION unbound read succeeded' }
      }

      // ungated RED face: the unbound path reads freely (the refusal is the lane's, not prose).
      const buf = fx.hostDirectRead(r.abs)
      entry.outcome = 'ungated-readable'
      entry.bytes = buf.length
      record({ leg: 'unbound-ungated-read', callId, bytes: buf.length })
      return { text: `A5C08-UNBOUND-UNGATED bytes=${String(buf.length)} (no gated lane installed; zero governance observation)` }
    }

    async function binaryBody(rawArgs) {
      const callId = `c08-bin-${++callSeq}`
      const entry = { callId, tool: 'binary-probe', stage: null, outcome: null, code: null, grantId: null, targetLocator: null, utf8_byte_fidelity: null, lane_bytes: null, disk_bytes: null, presented: null }
      asm.toolCalls.push(entry)
      const r = resolveAttachment(rawArgs?.attachment)
      if (!r.ok) { entry.outcome = 'denied'; entry.code = r.reason; return { text: refusalText('row-law', r.reason, 'locator escapes repo') } }
      entry.targetLocator = r.locator
      const diskBuf = fx.hostDirectRead(r.abs) // for the fidelity FACT only (not the chain)

      if (MODE === 'gated') {
        const core = await gatedReadCore({ toolName: BINARY, raw: String(rawArgs?.attachment ?? ''), entry })
        if (core.refused === true) { entry.outcome = 'denied'; return { text: refusalText(core.stage, core.code, core.detail ?? core.diag ?? '') } }
        const carried = Buffer.from(core.res.value.text, 'utf8')
        entry.outcome = 'measured'
        entry.lane_bytes = carried.length
        entry.disk_bytes = diskBuf.length
        entry.utf8_byte_fidelity = carried.equals(diskBuf)
        entry.presented = `A5C08-BINARY-FACT gated readText over raw PNG bytes: utf8-fidelity=${String(entry.utf8_byte_fidelity)} lane_bytes=${String(carried.length)} disk_bytes=${String(diskBuf.length)} — the C-FS read face is TEXT; the byte-exact attachment transport form that survives it is base64`
        record({ leg: 'binary-fact', callId, fidelity: entry.utf8_byte_fidelity })
        return { text: entry.presented }
      }
      entry.outcome = 'measured'
      entry.utf8_byte_fidelity = Buffer.from(diskBuf.toString('utf8'), 'utf8').equals(diskBuf)
      return { text: `A5C08-BINARY-FACT ungated (no lane): disk_bytes=${String(diskBuf.length)}` }
    }

    const defs = [
      { name: IMG, description: 'Alpha.5 C-08 governed attachment read (fixture tool; chain: PR2 grant → admission-gated ControlledFs readText → base64/PNG decode → render). args: {attachment}.', parameters: { type: 'object', properties: { attachment: { type: 'string' } }, required: ['attachment'] }, output: outDef, execute: async (raw) => imageReadBody(raw) },
      { name: THUMB, description: 'Alpha.5 C-08 thumbnail-bypass negative control. args: {attachment}.', parameters: { type: 'object', properties: { attachment: { type: 'string' } }, required: ['attachment'] }, output: outDef, execute: async (raw) => thumbBody(raw) },
      { name: UNBOUND, description: 'Alpha.5 C-08 unbound-lane negative control. args: {attachment}.', parameters: { type: 'object', properties: { attachment: { type: 'string' } }, required: ['attachment'] }, output: outDef, execute: async (raw) => unboundBody(raw) },
      { name: BINARY, description: 'Alpha.5 C-08 binary byte-fidelity measurement. args: {attachment}.', parameters: { type: 'object', properties: { attachment: { type: 'string' } }, required: ['attachment'] }, output: outDef, execute: async (raw) => binaryBody(raw) },
    ]

    try {
      for (const d of defs) asm.inner.tools.register(d)
      record({ leg: 'register', label, names: defs.map((d) => d.name), ok: true })
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
        assemblyOwnedNames: defs.map((d) => d.name),
        onObserve: (row) => { asm.observations.push(row) },
      })
      asm.installOk = outcome.ok === true
      if (!outcome.ok) {
        asm.installError = { code: outcome.error?.code, message: String(outcome.error?.message).slice(0, 300) }
        record({ leg: 'guard-install-refused', label, code: outcome.error?.code })
        return
      }
      asm.handle = outcome.value
      const bound = asm.handle.bindOwnTools(defs.map((d) => d.name))
      asm.bindOwnOk = bound.ok === true
      const published = asm.handle.publish()
      asm.publishedOk = published.ok === true
      asm.channelAtPublish = asm.handle.changeChannelStatus()
      record({ leg: 'guard-assembled', label, installOk: true, bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk, channelAtPublish: asm.channelAtPublish })
    }

    record({ leg: 'assembly-complete', label, native_read_image: asm.nativeFace?.has_read_image === true })
  }
}
