/**
 * a5c45-editor-image-row.mjs — C-04/05 gap-round LIVE assembly (Alpha.5).
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam the W5 /
 * live / W-E2 rounds used (IF-1). It carries the TEST-SIDE assembly the
 * matrix rows M-04 (str_replace_editor) and M-05 (read_image) register as
 * missing: the Team Definition publish/bind path for an EDITOR (per
 * subcommand I/O mapping) and an IMAGE READ, materialized at the public
 * seam, then guard-bound, admitted and executed for real in a live session:
 *
 *   gated mode   register `a5c45_editor` + `a5c45_read_image` +
 *                `a5c45_cf_probe` (the Team Definitions, public seam) →
 *                install the PR1 Guard → `bindOwnTools` + `publish` →
 *                register `a5c45_unbound_probe` AFTER publish (call-edge
 *                negative control) → every model-driven call runs:
 *                parse subcommand → I/O effect map (unmappable ⇒ typed
 *                `IO_POLICY_UNSUPPORTED` BEFORE any admit, zero side
 *                effects — the M-04 law) → PR2 admit per physical lane op
 *                (one-shot grant) → the gated ControlledFs face
 *                (`createAdmissionGatedControlledFs`, exec-time recheck =
 *                the kernel execution edge) → real bytes (real edit
 *                round-trip, real undo restore, real PNG bytes decoded
 *                from the gated read) → exec-edge REPLAY refusal recorded
 *                → presented.
 *
 *   ungated mode  the same tool defs WITHOUT the guard and WITHOUT the PR2
 *                 kernel — the RED control: the Team-gated half MUST go red
 *                 (unmappable subcommands execute; the thumbnail bypass
 *                 leaks bytes; no grants, no ledger, no events, no spill
 *                 pointer), while the C-FS lane law half (`admission-
 *                 unbound`) keeps refusing on its own. Gate-carried, not
 *                 prose-carried.
 *
 * Scope honesty (the W-E2 measured gap stays exactly as booked): this row
 * materializes the Team-owned Definition for the editor/image families at
 * the public seam — it does NOT pin the HOST-native `edit`/`read_image`
 * builtins into the bind (that face stays the W-E2 gap fact, README +
 * gap-checklist refs). No production source is invented: Team packages are
 * byte-untouched (IF-5); every judgement rides committed dist barrels +
 * the accepted W5 lane build; the row re-implements no law.
 *
 * Kit-provided environment:
 *   A5C45_DIST    <worktree>/packages/runtime/dist/packages
 *   A5C45_LANE    the kit-local a5p5-tools lane build root (spill face)
 *   A5C45_LEDGER  JSONL assembly-ledger path (append-only)
 *   A5C45_WORLD   absolute world root (ctrl/ + spill/ under it)
 *   A5C45_MODE    gated | ungated
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/c0405/a5c45-editor-image-row
 */
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5c45-editor-image'
export const inject = ['webServer', 'agents']

const LEDGER = process.env['A5C45_LEDGER'] ?? ''
const DIST = process.env['A5C45_DIST'] ?? ''
const LANE = process.env['A5C45_LANE'] ?? ''
const WORLD_ROOT = process.env['A5C45_WORLD'] ?? ''
const MODE = process.env['A5C45_MODE'] ?? 'gated'

const EDITOR = 'a5c45_editor'
const IMG = 'a5c45_read_image'
const CFP = 'a5c45_cf_probe'
const PROBE = 'a5c45_unbound_probe'

/**
 * The M-04 subcommand I/O map (design §3.1 A-class rows: view = read/list/
 * stat by subcommand; create/insert/str_replace = write(+read old); undo =
 * history read + restore write). `delete`/`undo_all` have NO precise I/O
 * mapping through the governed lane (no unlink primitive; multi-step
 * restore with undefined target state) ⇒ they land in the TYPED DEFAULT
 * DENY class of the M-04 law, refused before any admit, zero side effects.
 * Unknown subcommands share the same class.
 */
const SUBCOMMAND_MAP = Object.freeze({
  view: Object.freeze({ ops: ['read:target'], unmappable: false }),
  create: Object.freeze({ ops: ['write:target'], unmappable: false }),
  insert: Object.freeze({ ops: ['read:target', 'write:target'], unmappable: false }),
  str_replace: Object.freeze({ ops: ['read:target', 'write:target'], unmappable: false }),
  undo: Object.freeze({ ops: ['read:history', 'write:target', 'write:history'], unmappable: false }),
  delete: Object.freeze({ ops: [], unmappable: true, why: 'no unlink primitive on the governed lane — real-source/target side effects would escape the mapped effect set' }),
  undo_all: Object.freeze({ ops: [], unmappable: true, why: 'multi-step restore with undefined target state — no precise I/O effect set exists' }),
})

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

function safeJson(v) {
  try { return JSON.parse(JSON.stringify(v ?? null)) } catch { return String(v).slice(0, 300) }
}
const sha256Hex = (text) => `sha256:${createHash('sha256').update(String(text), 'utf8').digest('hex')}`

const refusalText = (kind, code, detail) => `A5C45-REFUSED kind=${kind} code=${String(code)} payloadBytes=0 detail=${String(detail).slice(0, 240)}`

export async function apply(ctx) {
  const webServer = ctx.webServer
  record({ leg: 'plugin-apply', pid: process.pid, mode: MODE, hasWebServer: webServer !== undefined && typeof webServer.register === 'function', dist: DIST, lane: LANE })

  let lanes = null
  let fx = null
  try {
    fx = await import(new URL(`file://${join(import.meta.dirname, 'a5c45-fixtures.mjs')}`).href)
    lanes = await fx.loadA5C45Lanes({ distPackages: DIST, laneBuild: LANE })
    record({ leg: 'lanes-imported', ok: true, spill_exports: typeof lanes.spill.openSpillStore, cf_arb_tree: lanes.cf.ARBITRARY_TREE_PROFILE_PUBLISHED })
  } catch (error) {
    record({ leg: 'lanes-imported', ok: false, error: String(error?.message ?? error) })
  }

  // ── routes: the test face reading the LIVE process ────────────────────────
  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5c45/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, mode: MODE, applied: true, assemblies: [...assemblies.keys()] }),
    }, 'a5c45 health')
    webServer.register({
      kind: 'exact', path: '/__a5c45/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5c45 journal')
    webServer.register({
      kind: 'exact', path: '/__a5c45/state',
      handler: (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) out[label] = stateView(asm)
        sendJson(res, 200, { mode: MODE, assemblies: out })
      },
    }, 'a5c45 state')
    webServer.register({
      kind: 'exact', path: '/__a5c45/agents',
      handler: async (_req, res) => {
        let rows
        try {
          const list = ctx.agents.list?.() ?? []
          rows = [...list].map((a) => ({ id: safeLabel(() => a?.id), session: safeLabel(() => a?.session?.header?.id), hasCtx: a?.ctx !== undefined }))
        } catch (error) { rows = [{ error: String(error?.message ?? error) }] }
        sendJson(res, 200, { agents: rows })
      },
    }, 'a5c45 agents')
    webServer.register({
      kind: 'exact', path: '/__a5c45/assemble',
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
    }, 'a5c45 assemble')
  }

  function getAgent(sessionId) {
    try { return ctx.agents.inject?.(['agents'], () => ctx.agents.get?.(sessionId)) ?? ctx.agents.get?.(sessionId) ?? null } catch { return null }
  }

  function stateView(asm) {
    const byName = {}
    for (const o of asm.observations) byName[String(o?.event)] = (byName[String(o?.event)] ?? 0) + 1
    const kernelByName = {}
    for (const o of asm.stack?.kernelEvents ?? []) kernelByName[String(o?.event ?? o?.kind ?? 'kernel')] = (kernelByName[String(o?.event ?? o?.kind ?? 'kernel')] ?? 0) + 1
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
      kernelEventCensus: kernelByName,
      observationsCount: asm.observations.length,
      ledgerConsumed: asm.stack?.ledger?.consumedCount?.() ?? null,
      registryNames: (() => { try { return (asm.inner?.tools?.schemas?.(asm.agent) ?? []).map((r) => String(r?.name)).filter((n) => n.startsWith('a5c45_')) } catch { return null } })(),
      toolCalls: asm.toolCalls,
      negativeControls: asm.negativeControls,
      subcommandMap: SUBCOMMAND_MAP,
      counters: {
        grantMintedCount: asm.grantMintedCount,
        probeBodyCount: asm.probeBodyCount,
        rawReadsInGatedChain: asm.rawReadsInGatedChain,
        ioUnsupportedCount: asm.ioUnsupportedCount,
        undoOps: asm.undoOps,
      },
      imageChainFaces: asm.imageChainFaces,
      unboundProbeLeg: asm.unboundProbeLeg,
      spill: asm.spill,
      arbTreePublished: lanes?.cf?.ARBITRARY_TREE_PROFILE_PUBLISHED ?? null,
      rosterNames: asm.rosterNames,
      nativeFace: asm.nativeFace,
      scope_disclosure: 'Team Definitions (editor/image/probe) are row-owned defs materialized at the PUBLIC seam and bound through the live guard; the host-native edit/read_image builtins are NOT pinned into the bind — that face stays the W-E2 measured gap. Kernel trust inputs are fixture-grade (W5/W7/W-E2 caliber); no ENFORCE claim.',
    }
  }

  // ── the live assembly for one Agent ───────────────────────────────────────
  async function assemble(label, agent) {
    const asm = {
      observations: [], toolCalls: [], negativeControls: [], imageChainFaces: [],
      grantMintedCount: 0, probeBodyCount: 0, rawReadsInGatedChain: 0,
      ioUnsupportedCount: 0, undoOps: 0,
      spill: null, unboundProbeLeg: null,
      installOk: false, installError: null, bindOwnOk: false, publishedOk: false,
      handle: null, inner: null, agent, stack: null,
    }
    assemblies.set(label, asm)
    const agentCtx = agent?.ctx
    if (agentCtx === undefined || typeof agentCtx.on !== 'function' || typeof agentCtx.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', label, hasOn: typeof agentCtx?.on, hasRegister: typeof agentCtx?.tools?.register })
      return
    }
    asm.inner = agentCtx

    const CTRL = join(WORLD_ROOT, 'ctrl')
    const HISTORY = 'history/edits.jsonl'
    const refs = {
      doc: fx.fileRef(lanes.tg, CTRL, 'doc.txt'),
      memo: fx.fileRef(lanes.tg, CTRL, 'memo.txt'),
      big: fx.fileRef(lanes.tg, CTRL, 'big.txt'),
      attach: fx.fileRef(lanes.tg, CTRL, 'shot.png.b64'),
      thumb: fx.fileRef(lanes.tg, CTRL, 'shot.png.thumb'),
      history: fx.fileRef(lanes.tg, CTRL, HISTORY),
    }
    // the round's GRANT facts (row-built authorization arms): editor/image
    // invoke + read/write on the governed files. NO arm for the thumb file
    // (the bypass leg must be refused BY the grant) and none for anything
    // outside CTRL.
    const policyArms = [
      { kind: 'tool-invoke', toolName: EDITOR },
      { kind: 'tool-invoke', toolName: IMG },
      { kind: 'tool-invoke', toolName: CFP },
      { kind: 'read', ref: refs.doc }, { kind: 'write', ref: refs.doc },
      { kind: 'read', ref: refs.memo }, { kind: 'write', ref: refs.memo },
      { kind: 'read', ref: refs.big },
      { kind: 'read', ref: refs.attach },
      { kind: 'read', ref: refs.history }, { kind: 'write', ref: refs.history },
    ]
    if (MODE === 'gated') {
      asm.stack = fx.makeAdmissionStack(lanes.ta, lanes.tg, { policyArms, onObserve: () => {} })
    }
    const gatedLane = (flow, port) => lanes.cf.createAdmissionGatedControlledFs({
      instances: [{ fs: 'c45', rootDir: CTRL, realmId: fx.REALM, kind: 'absolute-path' }],
      admission: { admission: port, parametersFingerprint: flow.grant.parametersFingerprint },
    })

    // native face capture (public tools.schemas() view; NO new host surface)
    asm.rosterNames = (() => { try { return (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => String(r?.name)) } catch { return [] } })()
    asm.nativeFace = (() => {
      try {
        const rows = (asm.inner.tools.schemas(asm.agent) ?? []).map((r) => String(r?.name))
        return { total: rows.length, has_edit: rows.includes('edit'), has_read_image: rows.includes('read_image'), has_str_replace_editor: rows.some((n) => /str_replace_editor/.test(n)) }
      } catch (error) { return { error: String(error?.message ?? error) } }
    })()

    const outDef = {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
    }

    // ── the governed op runner: admit → gated lane op → (replay recorded) ──
    async function runGatedOp(entry, { opKind, ref, content, tag }) {
      const callId = `${entry.callId}-${tag}`
      const effects = fx.effectsFor(lanes.tg, { toolName: EDITOR, fsEffects: [{ kind: opKind, ref }] })
      const fp = fx.canonicalParamsFingerprint({ tool: EDITOR, callId, kind: opKind, locator: ref.canonicalLocator, contentSha: content === undefined ? null : sha256Hex(content) })
      const flow = await fx.admitOp({ tg: lanes.tg, ta: lanes.ta }, asm.stack, { registeredName: EDITOR, callId, requestedEffects: effects, parametersFingerprint: fp })
      if (flow.grant === undefined) {
        entry.grantDenials.push({ tag, stage: flow.stage, decision: safeJson(flow.decision ?? { error: String(flow.error) }) })
        return { ok: false, stage: flow.stage }
      }
      asm.grantMintedCount += 1
      entry.grantIds.push(flow.grant.grantId)
      const { port, replay } = fx.fsPortFor(asm.stack, { ...flow, requestedEffects: effects })
      const lane = gatedLane(flow, port)
      const res = opKind === 'read'
        ? await lane.fs.readText(flow.grant, ref, fx.FULL_WINDOW)
        : await lane.fs.writeText(flow.grant, ref, content)
      return { ok: res.ok === true, res, flow, replay }
    }

    // ── the editor body ──────────────────────────────────────────────────────
    let edSeq = 0
    async function editorBody(raw) {
      const callSeq = ++edSeq
      const callId = `c45-ed-${callSeq}`
      const sub = String(raw?.subcommand ?? '')
      const fileKey = raw?.file === 'memo.txt' ? 'memo' : raw?.file === 'big.txt' ? 'big' : raw?.file === 'doc.txt' ? 'doc' : ''
      const entry = {
        callId, tool: 'editor', sub, file: String(raw?.file ?? ''), stage: null,
        grantIds: [], grantDenials: [], ops: [], execEdgeReplay: null, ledgerConsumed: null,
        censusAtStart: asm.observations.length, censusAtEnd: null,
        fileShaBefore: null, fileShaAfter: null, historyLinesBefore: null, historyLinesAfter: null,
        presented: null, refusal: null, mode: MODE,
      }
      asm.toolCalls.push(entry)
      const targetRef = refs[fileKey]
      const targetPath = targetRef !== undefined ? targetRef.canonicalLocator : null
      const histPath = join(CTRL, HISTORY)
      const rawFileSha = (p) => { try { return sha256Hex(readFileSync(p, 'utf8')) } catch { return null } }
      entry.fileShaBefore = targetPath === null ? null : rawFileSha(targetPath)
      entry.historyLinesBefore = (() => { try { return readFileSync(histPath, 'utf8').split('\n').filter((l) => l !== '').length } catch { return 0 } })()

      const mapEntry = SUBCOMMAND_MAP[sub]
      if (mapEntry === undefined || mapEntry === null || mapEntry.unmapped === true || mapEntry.unmappable === true || targetRef === undefined) {
        // THE M-04 LAW: no precise I/O effect mapping ⇒ typed default deny
        // BEFORE any admit, before any effect. Zero side effects is measured
        // (file sha + history line count + grant counters are re-read below).
        asm.ioUnsupportedCount += 1
        const why = mapEntry?.why ?? 'unknown subcommand or unmapped target'
        entry.stage = 'io-policy-unsupported'
        entry.refusal = { code: 'IO_POLICY_UNSUPPORTED', detail: `subcommand "${sub}" has no precise I/O effect mapping (${why}) — refused before admit, zero effects (IF-6 registered name)` }
        asm.negativeControls.push({
          attempt: `subcommand-${sub || '(empty)'}`, error: 'IO_POLICY_UNSUPPORTED', side_effects: 0,
          grants_minted_delta: 0, file_unchanged: rawFileSha(targetPath) === entry.fileShaBefore, detail: why,
        })
        record({ leg: 'io-unsupported', callId, sub })
        return finishEntry(entry, targetPath, histPath, refusalText('subcommand-io', 'IO_POLICY_UNSUPPORTED', entry.refusal.detail))
      }

      if (MODE === 'ungated') return editorBodyUngated(entry, mapEntry, targetRef, targetPath, histPath, raw)

      // ── gated: walk the op list, one admitted one-shot op at a time ──────
      let curContent = null
      for (let i = 0; i < mapEntry.ops.length; i++) {
        const [opKind, which] = mapEntry.ops[i].split(':')
        const ref = which === 'history' ? refs.history : targetRef
        let content
        if (opKind === 'read') {
          const r = await runGatedOp(entry, { opKind, ref, tag: `o${i}` })
          entry.ops.push({ op: mapEntry.ops[i], ok: r.ok })
          if (!r.ok) return finishEntry(entry, targetPath, histPath, refusalText('lane-refusal', r.res?.error?.code ?? r.stage ?? 'refused', r.res?.error?.message ?? 'lane refused'))
          curContent = r.res.value.text
          continue
        }
        // write ops compute their content from the READ results (same
        // mutable scope: the content the SAME call just read back)
        if (sub === 'create') content = String(raw?.content ?? '')
        else if (sub === 'insert') content = `${curContent}${String(raw?.line ?? '')}\n`
        else if (sub === 'str_replace') {
          const oldS = String(raw?.old_string ?? '')
          const newS = String(raw?.new_string ?? '')
          if (!curContent.includes(oldS)) {
            entry.stage = 'old-string-not-found'
            return finishEntry(entry, targetPath, histPath, refusalText('str-replace', 'old-string-not-found', 'the old_string is not in the just-read content (no partial write)'))
          }
          content = curContent.split(oldS).join(newS)
        } else if (sub === 'undo' && which === 'target') {
          // restore from the history JUST READ by op #0 of THIS call
          const histLines = String(curContent ?? '').split('\n').filter((l) => l !== '')
          let lastForFile = null
          for (const l of histLines) { try { const r = JSON.parse(l); if (r.file === raw?.file) lastForFile = r } catch { /* skip */ } }
          if (lastForFile === null) {
            entry.stage = 'undo-history-empty'
            return finishEntry(entry, targetPath, histPath, refusalText('undo', 'undo-history-empty', 'no history entry for this file (nothing restored, zero writes)'))
          }
          entry.undoFrom = { op: lastForFile.op, before_sha: lastForFile.before_sha }
          content = String(lastForFile.before ?? '')
          entry.undoRestoredSha = sha256Hex(content)
        } else if (sub === 'undo' && which === 'history') {
          // the undo marker line rides the SAME gated face (history I/O is
          // inside the governance leg, not a side channel)
          content = `${curContent}{"op":"undo","file":${JSON.stringify(String(raw?.file ?? ''))},"restored_sha":${JSON.stringify(entry.undoRestoredSha ?? null)}}\n`
        }
        // pre-write history capture (read + append through the SAME face) —
        // insert/str_replace record the before-bytes (undo-history-io).
        if ((sub === 'insert' || sub === 'str_replace') && which === 'target') {
          const histBefore = await runGatedOp(entry, { opKind: 'read', ref: refs.history, tag: `h${i}` })
          entry.ops.push({ op: `read:history(pre-${sub})`, ok: histBefore.ok })
          if (!histBefore.ok) return finishEntry(entry, targetPath, histPath, refusalText('lane-refusal', 'history-read-refused', 'undo-history ledger read refused'))
          const histText = histBefore.res.value.text
          const line = JSON.stringify({ seq: Date.now(), op: sub, file: String(raw?.file ?? ''), before: curContent, before_sha: sha256Hex(curContent) }) + '\n'
          const histApp = await runGatedOp(entry, { opKind: 'write', ref: refs.history, content: histText + line, tag: `h${i}w` })
          entry.ops.push({ op: `write:history(pre-${sub})`, ok: histApp.ok })
          if (!histApp.ok) return finishEntry(entry, targetPath, histPath, refusalText('lane-refusal', 'history-write-refused', 'undo-history ledger write refused'))
        }
        const r = await runGatedOp(entry, { opKind: 'write', ref, content, tag: `o${i}` })
        entry.ops.push({ op: mapEntry.ops[i], ok: r.ok })
        if (!r.ok) return finishEntry(entry, targetPath, histPath, refusalText('lane-refusal', r.res?.error?.code ?? 'refused', r.res?.error?.message ?? 'lane refused'))
        entry.lastWriteFingerprint = r.res.value?.writtenFingerprint ?? null
        if (r.replay !== undefined) entry.execEdgeReplay = safeJson(r.replay()) // ONE-SHOT: a second exec on the LAST op's grant must be refused
        entry.ledgerConsumed = asm.stack.ledger.consumedCount()
      }
      if (sub === 'undo') asm.undoOps += 1

      // spill face on the big view (M-04 governance increment: large read
      // output rides the controlled spill lifecycle, pointer presented)
      let presented
      if (sub === 'view' && fileKey === 'big') {
        presented = await spillBigView(asm, curContent)
      } else if (sub === 'view') {
        presented = `A5C45-ED view file=${raw.file} bytes=${Buffer.byteLength(String(curContent ?? ''))} sha=${sha256Hex(String(curContent ?? ''))} head=${JSON.stringify(String(curContent ?? '').slice(0, 48))}`
      } else {
        presented = `A5C45-ED ${sub} file=${raw.file} applied ops=${entry.ops.length} grants=${entry.grantIds.length} sha_after=${rawFileSha(targetPath)}`
      }
      return finishEntry(entry, targetPath, histPath, presented)
    }

    function finishEntry(entry, targetPath, histPath, text) {
      if (entry.stage === null) entry.stage = 'ok'
      entry.censusAtEnd = asm.observations.length
      entry.fileShaAfter = targetPath === null ? null : (() => { try { return sha256Hex(readFileSync(targetPath, 'utf8')) } catch { return '(absent)' } })()
      entry.historyLinesAfter = (() => { try { return readFileSync(histPath, 'utf8').split('\n').filter((l) => l !== '').length } catch { return 0 } })()
      entry.presented = text
      record({ leg: 'tool-call', callId: entry.callId, sub: entry.sub, stage: entry.stage, grants: entry.grantIds.length })
      return { text }
    }

    // ungated editor: RAW fs (the RED control — real bytes move, ZERO
    // governance: no grants, no lane, no events, no spill).
    async function editorBodyUngated(entry, mapEntry, targetRef, targetPath, histPath, raw) {
      const readFile = (p) => { asm.rawReadsInGatedChain += 0; return readFileSync(p, 'utf8') }
      try {
        if (entry.sub === 'view') {
          const c = readFile(targetPath)
          entry.stage = 'ungated-raw'
          return finishEntry(entry, targetPath, histPath, `A5C45-ED-UNGATED view file=${raw.file} bytes=${Buffer.byteLength(c)} sha=${sha256Hex(c)} head=${JSON.stringify(c.slice(0, 48))}`)
        }
        if (entry.sub === 'create') writeFileSync(targetPath, String(raw?.content ?? ''))
        else if (entry.sub === 'insert') {
          const c = readFile(targetPath)
          const hist0 = (() => { try { return readFileSync(histPath, 'utf8') } catch { return '' } })()
          writeFileSync(histPath, hist0 + JSON.stringify({ seq: Date.now(), op: 'insert', file: String(raw?.file ?? ''), before: c, before_sha: sha256Hex(c) }) + '\n')
          writeFileSync(targetPath, `${c}${String(raw?.line ?? '')}\n`)
        }
        else if (entry.sub === 'str_replace') {
          const c = readFile(targetPath)
          const hist = (() => { try { return readFileSync(histPath, 'utf8') } catch { return '' } })()
          writeFileSync(histPath, hist + JSON.stringify({ seq: Date.now(), op: 'str_replace', file: String(raw?.file ?? ''), before: c, before_sha: sha256Hex(c) }) + '\n')
          writeFileSync(targetPath, c.split(String(raw?.old_string ?? '')).join(String(raw?.new_string ?? '')))
        } else if (entry.sub === 'undo') {
          const lines = readFileSync(histPath, 'utf8').split('\n').filter((l) => l !== '')
          let last = null
          for (const l of lines) { try { const r = JSON.parse(l); if (r.file === raw?.file) last = r } catch { /* skip */ } }
          if (last !== null) writeFileSync(targetPath, last.before)
        }
        entry.stage = 'ungated-raw'
        return finishEntry(entry, targetPath, histPath, `A5C45-ED-UNGATED ${entry.sub} applied raw (governance observations = 0)`)
      } catch (error) {
        entry.stage = 'ungated-error'
        return finishEntry(entry, targetPath, histPath, refusalText('ungated-error', 'raw-error', String(error?.message ?? error)))
      }
    }

    // ── the read_image body (M-05 chain + bypass negative controls) ────────
    let imgSeq = 0
    async function imageBody(raw) {
      const callId = `c45-img-${++imgSeq}`
      const entry = { callId, tool: 'read_image', stage: null, grantIds: [], bypass: String(raw?.thumbnail ?? ''), censusAtStart: asm.observations.length, censusAtEnd: null, presented: null, mode: MODE }
      asm.toolCalls.push(entry)
      const attachPath = refs.attach.canonicalLocator
      const b64FileSha = () => { try { return sha256Hex(readFileSync(attachPath, 'utf8')) } catch { return null } }

      if (MODE === 'ungated') {
        const buf = readFileSync(attachPath)
        const img = fx.decodePng(Buffer.from(buf.toString('utf8'), 'base64'))
        entry.stage = 'ungated-raw'
        let text = `A5C45-IMG-UNGATED mode=${JSON.stringify(raw?.thumbnail ?? false)} ${JSON.stringify(img)} (raw fs, governance delta 0)`
        if (raw?.thumbnail === true || raw?.thumbnail === 'grant') {
          const t = readFileSync(refs.thumb.canonicalLocator) // RED: the bypass leaks REAL bytes ungated
          text += ` THUMB-LEAK bytes=${t.length} head=${JSON.stringify(t.toString('utf8').slice(0, 40))}`
        }
        entry.presented = text
        entry.censusAtEnd = asm.observations.length
        record({ leg: 'image-ungated', callId })
        return { text }
      }

      // thumbnail bypass attempt #1 — request the thumb READ effect openly:
      // the kernel refuses (no arm) BEFORE any open. 0 bytes returned.
      if (raw?.thumbnail === true) {
        const effects = fx.effectsFor(lanes.tg, { toolName: IMG, fsEffects: [{ kind: 'read', ref: refs.attach }, { kind: 'read', ref: refs.thumb }] })
        const fp = fx.canonicalParamsFingerprint({ tool: IMG, callId, locator: attachPath, bypass: 'effect' })
        const flow = await fx.admitOp({ tg: lanes.tg, ta: lanes.ta }, asm.stack, { registeredName: IMG, callId, requestedEffects: effects, parametersFingerprint: fp })
        const denied = flow.grant === undefined
        asm.negativeControls.push({
          attempt: 'thumbnail-read-bypass', outcome: denied ? 'typed-deny' : 'LEAKED',
          layer: 'kernel-admission', stage: flow.stage, bytes_returned: 0,
          detail: 'the bypass requests a second read effect on the thumbnail file; no policy arm exists for it — the real PR2 kernel refuses with its own vocabulary before any open',
        })
        entry.stage = denied ? `bypass-denied-${String(flow.stage)}` : 'bypass-LEAKED'
        const text = refusalText('thumbnail-bypass', flow.stage, 'read authorization refused the thumbnail effect; no bytes returned')
        entry.presented = text
        entry.censusAtEnd = asm.observations.length
        record({ leg: 'thumbnail-bypass-kernel', callId, denied })
        return { text }
      }

      // thumbnail bypass attempt #2 — take the ADMITTED attachment grant and
      // try to read the thumb through the lane: the lane's scope law refuses
      // (effect-outside-grant), zero bytes.
      if (raw?.thumbnail === 'grant') {
        const effects = fx.effectsFor(lanes.tg, { toolName: IMG, fsEffects: [{ kind: 'read', ref: refs.attach }] })
        const fp = fx.canonicalParamsFingerprint({ tool: IMG, callId, locator: attachPath, bypass: 'grant' })
        const flow = await fx.admitOp({ tg: lanes.tg, ta: lanes.ta }, asm.stack, { registeredName: IMG, callId, requestedEffects: effects, parametersFingerprint: fp })
        if (flow.grant === undefined) { entry.stage = flow.stage; return { text: refusalText('admit', flow.stage, 'attachment read itself refused') } }
        asm.grantMintedCount += 1
        entry.grantIds.push(flow.grant.grantId)
        const { port } = fx.fsPortFor(asm.stack, { ...flow, requestedEffects: effects })
        const lane = lanes.cf.createAdmissionGatedControlledFs({
          instances: [{ fs: 'c45', rootDir: CTRL, realmId: fx.REALM, kind: 'absolute-path' }],
          admission: { admission: port, parametersFingerprint: flow.grant.parametersFingerprint },
        })
        const res = await lane.fs.readText(flow.grant, refs.thumb, fx.FULL_WINDOW)
        const cfReason = res.ok === false ? (res.error.details?.['cfReason'] ?? res.error.code) : 'LEAKED'
        asm.negativeControls.push({
          attempt: 'thumbnail-bypass-via-attachment-grant', outcome: res.ok === false ? 'typed-deny' : 'LEAKED',
          layer: 'controlled-fs-lane', cf_reason: cfReason, bytes_returned: 0,
          detail: 'the admitted attachment grant must not read the thumbnail file through the gated lane',
        })
        entry.stage = res.ok === false ? 'bypass-denied-lane' : 'bypass-LEAKED'
        const text = refusalText('thumbnail-bypass-grant', cfReason, 'gated lane refused the off-grant locator; 0 bytes')
        entry.presented = text
        entry.censusAtEnd = asm.observations.length
        record({ leg: 'thumbnail-bypass-lane', callId, cfReason })
        return { text }
      }

      // THE CHAIN: attachment reference → admitted one-shot read through the
      // gated lane → base64 decode → PNG header decode → render. Every byte
      // of the image path comes from the gated ControlledFs face.
      const effects = fx.effectsFor(lanes.tg, { toolName: IMG, fsEffects: [{ kind: 'read', ref: refs.attach }] })
      const fp = fx.canonicalParamsFingerprint({ tool: IMG, callId, locator: attachPath })
      const flow = await fx.admitOp({ tg: lanes.tg, ta: lanes.ta }, asm.stack, { registeredName: IMG, callId, requestedEffects: effects, parametersFingerprint: fp })
      if (flow.grant === undefined) {
        entry.stage = flow.stage
        return finishImage(entry, refusalText('admit', flow.stage, 'attachment read refused before any open'))
      }
      asm.grantMintedCount += 1
      entry.grantIds.push(flow.grant.grantId)
      const { port, replay } = fx.fsPortFor(asm.stack, { ...flow, requestedEffects: effects })
      const lane = lanes.cf.createAdmissionGatedControlledFs({
        instances: [{ fs: 'c45', rootDir: CTRL, realmId: fx.REALM, kind: 'absolute-path' }],
        admission: { admission: port, parametersFingerprint: flow.grant.parametersFingerprint },
      })
      const res = await lane.fs.readText(flow.grant, refs.attach, fx.FULL_WINDOW)
      if (!res.ok) {
        entry.stage = 'lane-refused'
        return finishImage(entry, refusalText('lane-refusal', res.error?.code ?? 'refused', res.error?.message ?? ''))
      }
      entry.execEdgeReplay = safeJson(replay()) // ONE-SHOT recorded on the image leg too
      const img = fx.decodePng(Buffer.from(res.value.text, 'base64'))
      entry.stage = 'chain-ok'
      entry.ledgerConsumed = asm.stack.ledger.consumedCount()
      const face = { chain: 'admission-gated-controlled-fs', grant: flow.grant.grantId, attach_sha256_b64file: b64FileSha(), decode: img }
      asm.imageChainFaces.push(face)
      return finishImage(entry, `A5C45-IMG ${JSON.stringify(img)} chain=admission-gated-controlled-fs grant=${String(flow.grant.grantId).slice(0, 18)}…`)
    }
    function finishImage(entry, text) {
      entry.presented = text
      entry.censusAtEnd = asm.observations.length
      record({ leg: 'image-call', callId: entry.callId, stage: entry.stage })
      return { text }
    }

    // ── the C-FS admission-layer probe leg (lane law, refuses in BOTH modes) ─
    async function cfpBody(raw) {
      const callId = `c45-cfp-${String(raw?.mode ?? 'unbound')}`
      const entry = { callId, tool: 'cf_probe', stage: null, mode: MODE, presented: null, censusAtStart: asm.observations.length, censusAtEnd: null }
      asm.toolCalls.push(entry)
      const grant = fx.makeGrant(lanes.tg, { toolName: CFP, fsEffects: [{ kind: 'read', ref: refs.attach }] })
      const lane = lanes.cf.createAdmissionGatedControlledFs({
        instances: [{ fs: 'c45', rootDir: CTRL, realmId: fx.REALM, kind: 'absolute-path' }],
      }) // law 1: NO admission binding — every op must be a typed refusal
      const res = await lane.fs.readText(grant, refs.attach, fx.FULL_WINDOW)
      // the frozen §5 face carries a CLOSED cfReason code; the raw recheck
      // reason (admission-unbound) rides the refusal MESSAGE verbatim (the
      // accepted live-round face). Extract the named reason honestly.
      const cfReason = res.ok === false ? String(res.error.details?.['cfReason'] ?? res.error.code) : 'LEAKED'
      const rawMessage = res.ok === false ? String(res.error.message) : ''
      const unboundReason = /admission-unbound/.test(rawMessage) ? 'admission-unbound' : cfReason
      const presented = res.ok === false
        ? `A5C45-CFPROBE reason=${unboundReason} bytes_leaked=0 code=${String(res.error.code)} cfClass=${String(res.error.details?.['cfClass'] ?? '-')} cf_reason_code=${cfReason} raw_readable=${String(lanes !== null && (() => { try { return readFileSync(refs.attach.canonicalLocator).length > 0 } catch { return false } })())}`
        : 'A5C45-CFPROBE LEAKED'
      entry.stage = res.ok === false ? 'typed-refusal' : 'LEAKED'
      const leg = {
        error: unboundReason, bytes_leaked: res.ok === false ? 0 : Buffer.byteLength(res.value?.text ?? ''),
        refusal_verbatim: res.ok === false ? { code: res.error.code, cfClass: res.error.details?.['cfClass'] ?? null, cf_reason_code: cfReason, message: rawMessage.slice(0, 200) } : null,
        lane_ledger_stage: lane.ledger[lane.ledger.length - 1]?.stage ?? null,
      }
      asm.unboundProbeLeg = leg
      if (res.ok === false) asm.negativeControls.push({ attempt: 'controlled-fs-without-admission-binding', error: unboundReason, bytes_leaked: 0, cf_reason_code: cfReason, detail: 'a gated ControlledFs face with NO admission binding refuses every op by lane law (admission-binding.ts law 1) — observed live on the assembly process; the raw reason admission-unbound rides the refusal message verbatim (frozen §5 closed cfReason code face)' })
      entry.presented = presented
      entry.censusAtEnd = asm.observations.length
      record({ leg: 'cf-probe', callId, stage: entry.stage, cfReason })
      return { text: presented }
    }

    // ── spill face for the big view (gated only; W5 shape, trimmed) ────────
    async function spillBigView(asm2, text) {
      const mod = await import('node:fs')
      const port = {
        ensureDir: (p) => mod.mkdirSync(p, { recursive: true }),
        writeFile: (p, t) => mod.writeFileSync(p, t),
        appendFile: (p, t) => mod.writeFileSync(p, t, { flag: 'a' }),
        readText: (p) => mod.readFileSync(p, 'utf8'),
        sizeBytes: (p) => mod.readFileSync(p).length,
        list: (d) => { try { return mod.readdirSync(d) } catch { return [] } },
        remove: (p) => mod.rmSync(p, { force: true }),
        exists: (p) => mod.existsSync(p),
      }
      const spillRoot = join(WORLD_ROOT, 'spill')
      const opened = lanes.spill.openSpillStore({ worldRoot: WORLD_ROOT, rootDir: spillRoot, fs: port })
      if (!opened.ok) { asm2.spill = { storeOk: false, refusal: opened.refusal }; return `A5C45-SPILL-REFUSED ${JSON.stringify(opened.refusal)}` }
      const store = opened.store
      const id = `c45-view-${asm2.toolCalls.length}`
      const lease = lanes.spill.createSpillLease()
      const sinkOpen = store.openSink({ spillId: id, lease, attribution: { realmId: fx.REALM, tool: EDITOR, callId: `spill-${id}` } })
      if (!sinkOpen.ok) { asm2.spill = { storeOk: true, sinkOk: false, refusal: sinkOpen.refusal }; return `A5C45-SPILL-REFUSED ${JSON.stringify(sinkOpen.refusal)}` }
      const sink = sinkOpen.sink
      sink.write(text)
      const settled = lease.settle({ kind: 'completed' })
      const finalized = settled.ok ? sink.finalize({ kind: 'completed' }) : settled
      const closed = lease.close()
      const readBack = store.readSpill(id, () => ({ allow: true }))
      let diskBytes = null
      let diskSha = null
      try { const b = mod.readFileSync(join(spillRoot, `${id}.spill`)); diskBytes = b.length; diskSha = sha256Hex(b) } catch { /* recorded as null */ }
      asm2.spill = {
        storeOk: true, sinkOk: true, spillId: id, bytes: sink.bytes(),
        settleOk: settled.ok === true, finalizeOk: finalized.ok === true, closeOk: closed.ok === true,
        readBackMatches: readBack.ok === true && readBack.text === text,
        readBackAttribution: readBack.ok === true ? readBack.attribution : null,
        diskBytes, diskSha, spillRootFiles: port.list(spillRoot),
      }
      return `A5C45-SPILL id=${id} bytes=${sink.bytes()} sha=${sha256Hex(text)} disk=${String(diskBytes)}B settle=${String(settled.ok)} pointer=team-governed`
    }

    const editorDef = {
      name: EDITOR,
      description: 'Alpha.5 C-04/05 governed str_replace_editor family (Team Definition at the public seam). args: {subcommand: view|create|insert|str_replace|undo|delete|undo_all, file, content?, line?, old_string?, new_string?}.',
      parameters: { type: 'object', properties: { subcommand: { type: 'string' }, file: { type: 'string' }, content: { type: 'string' }, line: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['subcommand', 'file'] },
      output: outDef,
      execute: async (raw) => editorBody(raw),
    }
    const imageDef = {
      name: IMG,
      description: 'Alpha.5 C-05 governed read_image (Team Definition at the public seam). args: {file, thumbnail?: true|"grant"} — thumbnail is the BYPASS negative control.',
      parameters: { type: 'object', properties: { file: { type: 'string' }, thumbnail: {} }, required: ['file'] },
      output: outDef,
      execute: async (raw) => imageBody(raw),
    }
    const cfpDef = {
      name: CFP,
      description: 'Alpha.5 C-05 ControlledFs admission-layer probe. args: {mode: "unbound"}.',
      parameters: { type: 'object', properties: { mode: { type: 'string' } }, required: ['mode'] },
      output: outDef,
      execute: async (raw) => cfpBody(raw),
    }
    const probeDef = {
      name: PROBE,
      description: 'Alpha.5 C-04/05 unbound-control probe. args: {}.',
      parameters: { type: 'object', properties: {} },
      output: outDef,
      execute: async () => { asm.probeBodyCount += 1; record({ leg: 'probe-body-ran', label }); return { text: 'A5C45-PROBE-BODY-RAN' } },
    }

    // ── assembly order (the W5/W-E2-accepted shape): defs → guard install →
    //    bind → publish → post-publish probe ─────────────────────────────────
    try {
      asm.inner.tools.register(editorDef)
      asm.inner.tools.register(imageDef)
      asm.inner.tools.register(cfpDef)
      record({ leg: 'register', label, names: [EDITOR, IMG, CFP], ok: true })
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
        assemblyOwnedNames: [EDITOR, IMG, CFP],
        onObserve: (row) => { asm.observations.push(row) },
      })
      asm.installOk = outcome.ok === true
      if (!outcome.ok) {
        asm.installError = { code: outcome.error?.code, message: String(outcome.error?.message).slice(0, 300) }
        record({ leg: 'guard-install-refused', label, code: outcome.error?.code })
        return
      }
      asm.handle = outcome.value
      const bound = asm.handle.bindOwnTools([EDITOR, IMG, CFP])
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

    record({ leg: 'assembly-complete', label, bound: [EDITOR, IMG, CFP], native_edit: asm.nativeFace?.has_edit === true })
  }
}
