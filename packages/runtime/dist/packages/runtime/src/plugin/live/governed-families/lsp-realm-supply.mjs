/**
 * A5M2 G3 B-LSP — REALM SUPPLY + REALM-SCOPED DOCUMENT RESOLVER
 * (center LSP CONTINUATION 1, root 限施工裁决 same task; the consumer-side
 * integrator adapter the COMMITTED fsproc adapter names as the MISSING
 * capability at 639ed01539: g3-fsproc-adapters.mjs :2548-2551 forces
 * serviceFacts.documentRealm/documentScope as INTERFACE OBLIGATIONS, and the
 * adapter bytes stay ZERO-EDITED — this file supplies them.)
 *
 * THE ASSEMBLY IS NOT REIMPLEMENTED (root 限施工裁决 2026-10-24): the REAL
 * `createLspRealmAssembly` (R-2 realm destroy/rebuild over the R-1 public
 * `spawnStreaming`, 77ffb1874, sandbox-provider/lsp-assembly.ts) exists at
 * this base ON INT AND MASTER (measured: git ls-tree origin/feat/a5-m2-
 * integration + origin/master both carry the file; its tsc emit
 * dist/.../sandbox-provider/lsp-assembly.js node-imports clean — measured
 * DIRECT_IMPORT_OK), and the a5lsp2-assembly spec already consumes the TS
 * face through vitest's `.js`->`.ts` resolution. So the supply takes an
 * EXISTING assembly through its published shape (ensure / policyChange /
 * dispose / disposeAll / current / size — lsp-assembly.ts:94-107) and never
 * forks its semantics. The mount round builds the assembly itself (fake
 * transport through options.deps on the author side, production deps at the
 * Host round) and hands it here — one module, one law, no vendored copy.
 *
 * WHAT THIS FILE ADDS (the consumer-side facts, no new Core, no private
 * pools, no reflection, no global LSP replacement):
 *  · server  — LIVE existence only: the member's CURRENT assembled instance
 *    answers { binaryIdentity, generation }; binary identity is a POLICY
 *    fact (the integrator's serverIdentityOf reader over the (member x
 *    generation) policy map — the same map the assembly's policyFor owns)
 *    and is NEVER inferred from a handle. No live realm answers NOTHING —
 *    the arm refuses P_LSP_TARGET_UNRESOLVED, a bare-process reach never
 *    substitutes.
 *  · document — the realm-scoped canonical locator + revision law the
 *    77ffb187 host face left unnamed: a workspace-relative path lands
 *    kind 'workspace' with a POSIX-styled canonical locator under the
 *    call's workspace root; an absolute path lands kind 'absolute-path'
 *    resolved verbatim; a path that escapes its workspace by `..` is
 *    UNRESOLVABLE (null — the arm refuses, never navigates); the revision
 *    is the REAL file stat fact (`stat:v1:<size>:<mtimeMs>` — an edit
 *    moves it, which is exactly what the arm's approval-window recheck
 *    re-reads at the entry; a missing/unreadable file is null, never a
 *    guessed revision).
 *  · documentRealm — the locator->realm MAPPING: the member's live
 *    instance's OWN realmId (the assembly's `lsp:<memberId>:<generation>`
 *    spelling, lsp-assembly.ts:113-115 — never recomputed here except in
 *    the exported realmIdOf helper the mount round uses to NAME the arm's
 *    realmId at mount time; when the policy generation moves the realm
 *    spelling MOVES with it, and a mount still naming the old realm reads
 *    a mismatch -> the arm's P_LSP_REALM_SCOPE_ESCAPED before any body:
 *    a destroyed realm never answers navigation, by construction).
 *  · documentScope — the workspace CONTAINMENT law: 'inside' iff the
 *    resolved locator equals or sits under the resolved workspace root,
 *    'outside' otherwise (only 'inside' authorizes navigation; symlink
 *    escape remains the REALM's own confine law at the launcher — this is
 *    the control-plane scope answer the §5.2 obligation asks for, and it
 *    answers, it does not enforce).
 *
 * FOUR-TIER: author-side supply; the realm transport in the spec is CANNED
 * (options.deps.spawnStream per the a5lsp2-streaming precedent); nothing
 * here claims a Host round. 接线未测 until production supply + mount + a
 * real Host walk.
 */
import { isAbsolute, normalize, resolve, sep, extname } from 'node:path'
import { statSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
// The repo's governed-families idiom: NO bare web-timer globals — the
// node:timers exports are imported explicitly (the eslint no-undef law).
import { setTimeout as setTimer, clearTimeout as clearTimer } from 'node:timers'
// THE ONE framing codec (root LSP-review ruling 2026-10-25): the query
// backend and the assembly's readiness ride the SAME Content-Length
// implementation — exported from the assembly module for exactly this
// consumer; no second dialect exists in this package.
import { encodeLspMessage, createLspFrameDecoder } from '../../../../sandbox-provider/index.js'

export const A5_LSP_REALM_SUPPLY_REVISION = 2

export const A5_LSP_SUPPLY_CODES = Object.freeze({
  INPUT_INVALID: 'P_LSP_SUPPLY_INPUT_INVALID',
  CANCELLED_BEFORE_EFFECT: 'P_LSP_SUPPLY_CANCELLED_BEFORE_EFFECT',
  CANCELLED: 'P_LSP_SUPPLY_CANCELLED',
  DRAINED: 'P_LSP_SUPPLY_DRAINED',
  REQUEST_TIMEOUT: 'P_LSP_SUPPLY_REQUEST_TIMEOUT',
  TARGET_UNRESOLVED: 'P_LSP_TARGET_UNRESOLVED',
  TARGET_DRIFT: 'P_LSP_TARGET_DRIFT',
})

/** THE closed operation->method law (@639 grammar: the four operations, no
 *  protocol escape hatch — everything else is refused before the wire). */
const A5_LSP_QUERY_METHODS = Object.freeze({
  goToDefinition: 'textDocument/definition',
  findReferences: 'textDocument/references',
  goToImplementation: 'textDocument/implementation',
  hover: 'textDocument/hover',
})

const A5_LSP_REQUEST_TIMEOUT_MS = 15_000

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const refuseInput = (detail) => deepFreeze({ ok: false, code: A5_LSP_SUPPLY_CODES.INPUT_INVALID, detail })

/** THE realm spelling — the assembly's OWN law (lsp-assembly.ts:113-115),
 *  restated here ONLY for the mount round to name the arm's realmId; the
 *  facts below always read the instance's realmId, never this helper, so a
 *  spelling drift between the two is spec-pinned, never silently lived. */
export function a5LspRealmId (memberId, generation) {
  return `lsp:${String(memberId)}:${String(generation)}`
}

/**
 * Build the B-LSP realm supply for ONE member over an EXISTING assembly.
 * @param input - CLOSED key set:
 *   assembly          the published LspRealmAssembly face (REQUIRED — the
 *                     REAL createLspRealmAssembly product, whoever built it);
 *   memberId          the member whose realms these facts describe;
 *   serverIdentityOf  (memberId, generation) => string | null — the
 *                     integrator's POLICY reader for the server binary
 *                     identity (e.g. policy.argv[0]); null refuses.
 * Returns { ok: true, supply } or { ok: false, code, detail }. supply:
 *   facts / realmIdOf / ensure / policyChange / syncGeneration / drainAll.
 */
export function createA5LspRealmSupply (input = {}) {
  const known = new Set(['assembly', 'memberId', 'serverIdentityOf', 'generation', 'extensionToLanguage'])
  for (const key of Object.keys(input)) {
    if (!known.has(key)) return refuseInput(`unknown input key '${key}' — the supply surface is closed`)
  }
  const { assembly, memberId, serverIdentityOf, generation, extensionToLanguage } = input
  if (!isRecord(assembly) || typeof assembly.current !== 'function' || typeof assembly.ensure !== 'function'
    || typeof assembly.policyChange !== 'function' || typeof assembly.disposeAll !== 'function') {
    return refuseInput('assembly must be the published LspRealmAssembly face {ensure, policyChange, dispose?, disposeAll, current, size} (the REAL lsp-assembly product; the supply never forks its semantics)')
  }
  if (typeof memberId !== 'string' || memberId.length === 0) return refuseInput('memberId is REQUIRED (the supply is the member-scoped face of the realm assembly)')
  if (typeof generation !== 'string' || generation.length === 0) return refuseInput('generation is REQUIRED (root LSP-review ruling 2026-10-25: the supply is the EXECUTION face of the APPROVED (member x generation) tuple — the query backend ensures exactly this generation; a supply that could not name its generation could not sync one)')
  if (typeof serverIdentityOf !== 'function') return refuseInput('serverIdentityOf (memberId, generation) => string | null is REQUIRED — the server binary identity is a POLICY fact (the realm policy map); it is never inferred from a live handle')
  if (extensionToLanguage !== undefined && (!isRecord(extensionToLanguage) || Object.values(extensionToLanguage).some((v) => typeof v !== 'string' || v.length === 0))) {
    return refuseInput('extensionToLanguage, when supplied, must be a record of non-empty strings (the didOpen languageId map; absent, documents open as \'plaintext\' — the LSP law\'s honest fallback, never a guessed language)')
  }
  const LANGUAGE_OF = extensionToLanguage ?? {}

  // ---- the canonical locator law (document/documentRealm/documentScope share it)
  const canonicalOf = (filePath, workspaceRoot) => {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) return null
    if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) return null
    if (isAbsolute(filePath)) {
      const abs = resolve(filePath)
      return { kind: 'absolute-path', locator: abs, abs }
    }
    const norm = normalize(filePath)
    if (isAbsolute(norm) || norm === '..' || norm.startsWith(`..${sep}`)) return null // escapes the workspace before it resolves: unresolvable, never navigated
    const abs = resolve(workspaceRoot, norm)
    return { kind: 'workspace', locator: norm.split(sep).join('/'), abs }
  }
  const insideRoot = (abs, workspaceRoot) => {
    const ws = resolve(workspaceRoot)
    return abs === ws || abs.startsWith(ws.endsWith(sep) ? ws : `${ws}${sep}`)
  }
  const revisionOf = (abs) => {
    try {
      const st = statSync(abs)
      if (!st.isFile()) return null
      return `stat:v1:${String(st.size)}:${String(Math.trunc(st.mtimeMs))}`
    } catch {
      return null
    }
  }

  // ── THE REAL QUERY BACKEND (root LSP-review ruling 2026-10-25, P1-a) ────
  // The execution face, not just the facts face: one LSP round-trip per
  // governed call, over the APPROVED (member x generation) realm's OWN
  // confined pipes (the assembly instance's StreamingSpawnHandle), speaking
  // the standard protocol on the ONE shared framing codec — didOpen the
  // transient document, send the operation request, normalize the response
  // into the 639 public `LspQueryResult` closed union ({kind:'locations'} |
  // {kind:'hover'}), didClose. Pending requests are REGISTERED per channel
  // so the port's cancelCleanup and the supply's drainAll RECLAIM the real
  // backend (typed reject + $/cancelRequest on the wire) — never a silent
  // drop. Lifecycle is REAL here: every call passes through the generation
  // sync (hot-reuse / first assembly / R-2 destroy-rebuild when the live
  // generation moved), which is the production trigger the review found
  // missing (P1-b): the arm enters the port, the port drives the assembly.
  const channels = new Map()
  let drained = false

  class LspSupplyError extends Error {
    constructor (code, detail) {
      super(`${code}: ${detail}`)
      this.code = code
    }
  }

  const rejectChannel = (ch, error) => {
    for (const [, p] of [...ch.pending.entries()]) {
      ch.pending.delete(p.seq)
      try { p.timers.forEach((t) => clearTimer(t)) } catch { /* settled */ }
      p.reject(error)
    }
    ch.dead = true
  }

  const channelOf = (instance) => {
    const existing = channels.get(instance.pid)
    if (existing !== undefined) return existing
    const ch = {
      instance,
      decoder: createLspFrameDecoder(),
      seq: 0,
      pending: new Map(),
      openVersions: new Map(),
      initialized: false,
      dead: false,
    }
    instance.handle.stdout.on('data', (chunk) => {
      let messages
      try {
        messages = ch.decoder.push(chunk)
      } catch (error) {
        rejectChannel(ch, new LspSupplyError(A5_LSP_SUPPLY_CODES.REQUEST_TIMEOUT, `the realm stream broke the LSP framing law: ${String(error?.message ?? error).slice(0, 160)}`))
        return
      }
      for (const msg of messages) {
        const m = msg
        if (m === null || typeof m !== 'object' || m.id === undefined || m.method !== undefined) continue
        const p = ch.pending.get(m.id)
        if (p === undefined) continue
        ch.pending.delete(m.id)
        p.timers.forEach((t) => clearTimer(t))
        if (m.error !== null && m.error !== undefined) p.reject(new LspSupplyError('P_LSP_SERVER_ERROR', `the realm server answered an error response: ${JSON.stringify(m.error).slice(0, 200)}`))
        else p.resolve(m.result)
      }
    })
    void instance.handle.exited.then(() => {
      rejectChannel(ch, new LspSupplyError(A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, 'the realm process exited: in-flight queries are REFUSED, a dead realm never answers navigation'))
    })
    channels.set(instance.pid, ch)
    return ch
  }

  const notify = (ch, method, params) => {
    ch.instance.handle.stdin.write(encodeLspMessage({ jsonrpc: '2.0', method, params }))
  }

  const callServer = (ch, method, params, correlation = null) => new Promise((resolve2, reject) => {
    // NOTHING enters a realm pipe after the drain word — a continuation
    // that raced past the sync gate dies HERE with the honest DRAINED code,
    // never a request into a settling process.
    if (drained) { reject(new LspSupplyError(A5_LSP_SUPPLY_CODES.DRAINED, 'the mount drained: no NEW realm request is issued')); return }
    if (ch.dead === true) { reject(new LspSupplyError(A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, 'the realm channel is dead')); return }
    const id = ++ch.seq
    const timers = [setTimer(() => {
      ch.pending.delete(id)
      reject(new LspSupplyError(A5_LSP_SUPPLY_CODES.REQUEST_TIMEOUT, `the realm server did not answer ${method} within the request bound`))
    }, A5_LSP_REQUEST_TIMEOUT_MS)]
    ch.pending.set(id, {
      seq: id,
      correlation,
      timers,
      resolve: (v) => { resolve2(v) },
      reject,
    })
    try {
      ch.instance.handle.stdin.write(encodeLspMessage({ jsonrpc: '2.0', id, method, params }))
    } catch (error) {
      ch.pending.delete(id)
      timers.forEach((t) => clearTimer(t))
      reject(new LspSupplyError(A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, `the realm pipe refused the write: ${String(error?.message ?? error).slice(0, 120)}`))
    }
  })

  const ensureInitialized = async (ch) => {
    if (ch.initialized) return
    const result = await callServer(ch, 'initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      clientInfo: { name: 'a5m2-lsp-realm-supply', version: '2' },
    })
    if (result === null || typeof result !== 'object' || result.capabilities === null || typeof result.capabilities !== 'object') {
      throw new LspSupplyError('P_LSP_SERVER_ERROR', 'the realm initialize answer carries no capabilities — the transport is not a standard LSP server')
    }
    notify(ch, 'initialized', {})
    ch.initialized = true
  }

  /** THE generation sync the production path rides (P1-b): hot-reuse the
   *  approved generation; first-assemble when nothing is live; the R-2
   *  destroy/rebuild when the LIVE generation moved. Refusals come back as
   *  {ok:false, code, detail} — never a half-state. */
  const syncRealm = async () => {
    if (drained) return { ok: false, code: A5_LSP_SUPPLY_CODES.DRAINED, detail: 'the supply is drained: no NEW realm work is accepted (net-zero already settled)' }
    let current
    try {
      current = assembly.current(memberId)
    } catch {
      current = undefined
    }
    if (isRecord(current) && current.generation === generation) return { ok: true, instance: current }
    if (isRecord(current)) {
      const changed = await assembly.policyChange(memberId, generation)
      if (changed.ok !== true) return { ok: false, code: A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, detail: `the R-2 policyChange to the approved generation refused: ${String(changed?.error?.message ?? changed?.code ?? 'refused').slice(0, 180)}` }
      return { ok: true, instance: changed.value }
    }
    const created = await assembly.ensure(memberId, generation)
    if (created.ok !== true) return { ok: false, code: A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, detail: `the first assembly of the approved generation refused: ${String(created?.error?.message ?? created?.code ?? 'refused').slice(0, 180)}` }
    return { ok: true, instance: created.value }
  }

  const normalizeLocations = (result, resolvedWorkspaceUri) => {
    const items = Array.isArray(result) ? result : result === null || result === undefined ? [] : [result]
    const locations = items
      .map((item) => {
        if (!isRecord(item)) return null
        // LocationLink answers (targetUri/targetRange) normalize onto Location.
        const uri = typeof item.uri === 'string' ? item.uri : typeof item.targetUri === 'string' ? item.targetUri : null
        const range = item.range ?? item.targetRange ?? item.targetSelectionRange
        if (uri === null || !isRecord(range) || !isRecord(range.start) || !isRecord(range.end)) return null
        return Object.freeze({ uri, range: Object.freeze({
          start: Object.freeze({ line: Number(range.start.line), character: Number(range.start.character) }),
          end: Object.freeze({ line: Number(range.end.line), character: Number(range.end.character) }),
        }) })
      })
      .filter((l) => l !== null)
    return Object.freeze({ kind: 'locations', locations: Object.freeze(locations), resolvedWorkspaceUri })
  }

  const hoverContents = (contents) => {
    const one = (c) => typeof c === 'string' ? c : isRecord(c) && typeof c.value === 'string' ? c.value : ''
    if (Array.isArray(contents)) return contents.map(one).filter((s) => s.length > 0).join('\n')
    return one(contents)
  }

  /** ONE governed LSP round-trip over the approved realm. Resolves the 639
   *  closed-union result; refuses by THROWING an LspSupplyError (the arm's
   *  edge law commits typed refusals; a value-shaped refusal would narrate
   *  success). */
  const queryRealm = async (req) => {
    const method = A5_LSP_QUERY_METHODS[req.operation]
    if (method === undefined) throw new LspSupplyError(A5_LSP_SUPPLY_CODES.INPUT_INVALID, `operation '${String(req.operation)}' is not one of the four governed operations`)
    const c = canonicalOf(req.file_path, req.workspaceRoot)
    if (c === null) throw new LspSupplyError(A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, 'the document target is unresolvable (never navigated)')
    if (!insideRoot(c.abs, req.workspaceRoot)) throw new LspSupplyError(A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, 'the document sits outside the workspace root: navigation is an in-scope operation')
    const synced = await syncRealm()
    if (synced.ok !== true) throw new LspSupplyError(synced.code, synced.detail)
    const instance = synced.instance
    const ch = channelOf(instance)
    await ensureInitialized(ch)
    const uri = pathToFileURL(c.abs).toString()
    const ext = extname(c.abs).toLowerCase()
    const version = (ch.openVersions.get(uri) ?? 0) + 1
    ch.openVersions.set(uri, version)
    let text
    try {
      text = readFileSync(c.abs, 'utf8')
    } catch (error) {
      throw new LspSupplyError(A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, `the document is unreadable for the transient open: ${String(error?.message ?? error).slice(0, 120)}`)
    }
    notify(ch, 'textDocument/didOpen', {
      textDocument: { uri, languageId: LANGUAGE_OF[ext] ?? 'plaintext', version, text },
    })
    try {
      const params = {
        textDocument: { uri },
        position: { line: req.line - 1, character: req.character - 1 }, // the ONE-BASED UTF-16 grammar -> zero-based protocol
      }
      if (req.operation === 'findReferences') params.context = { includeDeclaration: true } // 639 law: references always include declarations
      const result = await callServer(ch, method, params, req.correlation ?? req.callId ?? null)
      if (req.operation === 'hover') {
        if (result === null || result === undefined) return Object.freeze({ kind: 'hover', hover: null })
        return Object.freeze({
          kind: 'hover',
          hover: Object.freeze({
            contents: hoverContents(result.contents),
            ...(isRecord(result.range) ? { range: Object.freeze({
              start: Object.freeze({ line: Number(result.range?.start?.line), character: Number(result.range?.start?.character) }),
              end: Object.freeze({ line: Number(result.range?.end?.line), character: Number(result.range?.end?.character) }),
            }) } : {}),
          }),
        })
      }
      return normalizeLocations(result, pathToFileURL(resolve(req.workspaceRoot)).toString())
    } finally {
      try {
        notify(ch, 'textDocument/didClose', { textDocument: { uri } })
      } catch { /* the transient document dies with the realm; never masks the answer */ }
    }
  }

  // ── THE delegate-port face (the adapter's OWN law, createHostTerminal-
  // ControlPort as the shape precedent): prepare is the effect entry and the
  // REAL lifecycle trigger; the handle invokes the approved realm; drift/
  // handleStatus/cancelCleanup/liveHandles are the live seams the arm
  // re-reads after every await. ──
  const controlPort = Object.freeze({
    async prepare (spec) {
      const canonical = isRecord(spec?.canonical) ? spec.canonical : {}
      const workspaceRoot = spec?.exec?.agent?.session?.header?.cwd
      const shapeBad = A5_LSP_QUERY_METHODS[canonical.operation] === undefined
        || typeof canonical.file_path !== 'string'
        || !Number.isInteger(canonical.line) || canonical.line < 1
        || !Number.isInteger(canonical.character) || canonical.character < 1
        || typeof workspaceRoot !== 'string' || workspaceRoot.length === 0
      if (shapeBad) {
        return { ok: false, zeroEffects: true, code: A5_LSP_SUPPLY_CODES.TARGET_UNRESOLVED, detail: 'the governed canonical (operation/file_path/one-based line+character/workspace cwd) is unreadable: zero invoke, zero wire' }
      }
      if (spec.isCancelled?.() === true) {
        return { zeroEffects: true, code: A5_LSP_SUPPLY_CODES.CANCELLED_BEFORE_EFFECT, detail: 'the cancel intent moved before the realm was entered: zero effects started' }
      }
      const synced = await syncRealm()
      if (synced.ok !== true) {
        // A refused assembly left NOTHING behind (the assembly's own
        // net-zero law): the honest zero-effect word rides the entry edge.
        return { ok: false, zeroEffects: true, code: synced.code, detail: synced.detail }
      }
      if (spec.isCancelled?.() === true) {
        return { ok: false, answer: { refused: true, effectsStarted: true, code: A5_LSP_SUPPLY_CODES.CANCELLED, detail: 'the cancel intent moved while the realm was assembled: the realm STANDS (shared per member x generation), net-zero rides the mount drain', cleanup: 'realm kept; the mount drainAll owns the settle' } }
      }
      // THE arm's own recheck CONTRACT (g3-fsproc-adapters law): a CLEAN
      // recheck answers null/undefined OR {ok:true}; only {ok:false,...} is
      // a drift. Reading any non-null as drift would turn the clean word
      // into a permanent refusal.
      const moved = typeof spec.recheckFacts === 'function' ? spec.recheckFacts() : null
      if (moved !== null && moved !== undefined && moved.ok !== true) {
        return { ok: false, answer: { refused: true, effectsStarted: true, code: A5_LSP_SUPPLY_CODES.TARGET_DRIFT, detail: 'the target facts moved between approval and the realm entry: the approved scope is not the live scope', cleanup: 'realm kept; the mount drainAll owns the settle' } }
      }
      const instance = synced.instance
      spec.recordStarted?.(Object.freeze({ __kind: 'lsp-realm-instance', memberId, generation: instance.generation, pid: instance.pid, realmId: instance.realmId }))
      const identity = Object.freeze({ processIdentity: `${String(instance.realmId)}#${String(instance.pid)}`, pid: instance.pid, generation: instance.generation, realmId: instance.realmId, memberId: instance.memberId })
      const handle = Object.freeze({
        identity,
        invoke: async () => queryRealm({
          operation: canonical.operation,
          file_path: canonical.file_path,
          workspaceRoot,
          line: canonical.line,
          character: canonical.character,
          correlation: spec.correlation ?? null, // the call's OWN intent rides the pending record (CARD 3: independent intents clean independently)
        }),
      })
      return { ok: true, handle }
    },
    drift (canonical) {
      return (handle) => {
        void canonical
        let current
        try {
          current = assembly.current(memberId)
        } catch {
          current = undefined
        }
        const identity = handle?.identity
        if (!isRecord(identity)) return null
        if (!isRecord(current) || current.pid !== identity.pid || current.generation !== identity.generation) {
          return { ok: false, code: A5_LSP_SUPPLY_CODES.TARGET_DRIFT, detail: 'the approved realm handle moved between prepare and invoke: the live instance is a different process/generation — zero invoke' }
        }
        return null
      }
    },
    handleStatus (handle) {
      let current
      try {
        current = assembly.current(memberId)
      } catch {
        current = undefined
      }
      const identity = handle?.identity
      return Object.freeze({
        live: isRecord(current) && isRecord(identity) && current.pid === identity.pid && current.generation === identity.generation,
        pid: isRecord(identity) ? identity.pid : null,
        generation: isRecord(identity) ? identity.generation : null,
        realmId: isRecord(identity) ? identity.realmId : null,
      })
    },
    async cancelCleanup (live, context) {
      const pid = isRecord(live) ? live.pid : null
      if (typeof pid !== 'number') return { cleaned: true, detail: 'no realm resource was answered for this call: nothing to clean' }
      const ch = channels.get(pid)
      if (ch === undefined) return { cleaned: true, detail: `the realm channel ${String(pid)} is already gone (the assembly settle owns it)` }
      // CARD 3 (independent intents, independent identity): the cancel of
      // ONE call RECLAIMS THAT CALL's in-flight wire request ($/cancel-
      // Request + typed reject); a sibling call on the same realm is NOT
      // collateral. Without a correlation to match, the cleanup is honest
      // about being coarse and reclaims every pending on that channel.
      const correlation = context?.correlation ?? null
      const targets = [...ch.pending.entries()].filter(([, p]) => correlation === null || p.correlation === correlation || p.correlation === null)
      for (const [id, p] of targets) {
        try { notify(ch, '$/cancelRequest', { id }) } catch { /* a dead pipe never blocks the cleanup word */ }
        ch.pending.delete(id)
        p.timers.forEach((t) => clearTimer(t))
        p.reject(new LspSupplyError(A5_LSP_SUPPLY_CODES.CANCELLED, 'the call was cancelled: the in-flight realm request is RECLAIMED (the realm itself is shared per member x generation; the mount drain owns its settle)'))
      }
      return { cleaned: true, detail: `${String(targets.length)} in-flight realm request(s) reclaimed on realm ${String(pid)}` }
    },
    liveHandles (member) {
      if (member !== memberId) return Object.freeze([])
      let current
      try {
        current = assembly.current(memberId)
      } catch {
        current = undefined
      }
      if (!isRecord(current)) return Object.freeze([])
      return Object.freeze([Object.freeze({ pid: current.pid, generation: current.generation, realmId: current.realmId })])
    },
  })

  const facts = Object.freeze({


    server: () => {
      let instance
      try {
        instance = assembly.current(memberId)
      } catch {
        return null
      }
      if (!isRecord(instance) || typeof instance.generation !== 'string') return null
      let identity
      try {
        identity = serverIdentityOf(memberId, instance.generation)
      } catch {
        return null
      }
      if (typeof identity !== 'string' || identity.length === 0) return null
      return Object.freeze({ binaryIdentity: identity, generation: instance.generation })
    },
    document: (filePath, workspaceRoot) => {
      const c = canonicalOf(filePath, workspaceRoot)
      if (c === null) return null
      const revision = revisionOf(c.abs)
      if (revision === null) return null
      return Object.freeze({ kind: c.kind, canonicalLocator: c.locator, revision })
    },
    documentRealm: (canonicalLocator, workspaceRoot) => {
      // the mapping RIDES the live realm: a member with no assembled realm
      // answers NOTHING (the arm refuses unresolved), an out-of-scope
      // document answers nothing either (the scope obligation owns that
      // refusal; a realm never vouches for a document outside its root).
      const c = canonicalOf(canonicalLocator, workspaceRoot)
      if (c === null) return null
      if (!insideRoot(c.abs, workspaceRoot)) return null
      let instance
      try {
        instance = assembly.current(memberId)
      } catch {
        return null
      }
      if (!isRecord(instance) || typeof instance.realmId !== 'string') return null
      return instance.realmId
    },
    documentScope: (canonicalLocator, workspaceRoot) => {
      const c = canonicalOf(canonicalLocator, workspaceRoot)
      if (c === null) return 'outside'
      return insideRoot(c.abs, workspaceRoot) ? 'inside' : 'outside'
    },
  })

  const supply = Object.freeze({
    ok: true,
    revision: A5_LSP_REALM_SUPPLY_REVISION,
    memberId,
    generation,
    facts,
    /** THE delegate-port face for the mount round: the plane passes it as
     *  the wiring's `controlPort`, so the governed rows EXECUTE on the
     *  approved realm instead of falling back to the native body's
     *  ctx.lsp.query extension route (root ruling P1-a). */
    controlPort,
    /** The public execution face (the same round the port invokes): closed
     *  request, 639 closed-union answer, typed LspSupplyError on refusal. */
    query: async (req = {}) => {
      const want = ['callId', 'character', 'file_path', 'line', 'operation', 'workspaceRoot']
      for (const key of Object.keys(req)) {
        if (!want.includes(key)) throw new LspSupplyError(A5_LSP_SUPPLY_CODES.INPUT_INVALID, `unknown query key '${key}' — the query surface is closed`)
      }
      if (typeof req.operation !== 'string' || typeof req.file_path !== 'string'
        || typeof req.workspaceRoot !== 'string'
        || !Number.isInteger(req.line) || req.line < 1
        || !Number.isInteger(req.character) || req.character < 1) {
        throw new LspSupplyError(A5_LSP_SUPPLY_CODES.INPUT_INVALID, 'query needs {operation, file_path, workspaceRoot, line>=1, character>=1} (the ONE-BASED UTF-16 grammar)')
      }
      return await queryRealm(req)
    },
    realmIdOf: (gen) => a5LspRealmId(memberId, gen),
    /** THE ensure-on-call hook (root ruling P1-b, the plane's realmEnsure):
     *  the assembly's OWN discipline at the entry of every governed call —
     *  hot reuse / first assembly / the R-2 rebuild when the live generation
     *  moved. Answers {ok,...}; a refusal is the assembly's truth, never a
     *     half-state. */
    ensureLive: async () => await syncRealm(),
    /** R-2 discipline passthroughs — the mount round drives these from the
     *  CURRENT dispatcher generation; the supply adds NO law of its own. */
    ensure: (gen) => assembly.ensure(memberId, gen),
    policyChange: (gen) => assembly.policyChange(memberId, gen),
    /** One call: HOT reuse when the live generation already answers; the
     *  R-2 destroy/rebuild when the generation MOVED; first assembly when
     *  nothing is live. A refusal rides the assembly's own ProviderResult. */
    syncGeneration: async (gen) => {
      const current = assembly.current(memberId)
      if (isRecord(current) && current.generation === gen) return Object.freeze({ ok: true, status: 'hot-reuse', instance: current })
      if (isRecord(current)) {
        const changed = await assembly.policyChange(memberId, gen)
        return Object.freeze({ ok: changed.ok === true, status: changed.ok === true ? 'policy-changed' : 'policy-change-REFUSED', result: changed })
      }
      const created = await assembly.ensure(memberId, gen)
      return Object.freeze({ ok: created.ok === true, status: created.ok === true ? 'assembled' : 'assemble-REFUSED', result: created })
    },
    /** Teardown word for the mount leg: FIRST every in-flight realm request
     *  is RECLAIMED (typed reject + $/cancelRequest on the wire — the real
     *  query backend is part of the net-zero, root ruling), THEN net-zero
     *  through the assembly's own disposeAll (terminate + settle, never a
     *  silent drop). After the word, no NEW work is accepted. */
    drainAll: async () => {
      drained = true
      const inFlight = [...channels.values()]
      channels.clear()
      for (const ch of inFlight) {
        for (const id of [...ch.pending.keys()]) {
          try { notify(ch, '$/cancelRequest', { id }) } catch { /* a dead pipe never blocks the settle */ }
        }
        rejectChannel(ch, new LspSupplyError(A5_LSP_SUPPLY_CODES.DRAINED, 'the mount drained: the in-flight realm request is RECLAIMED, never silently dropped'))
      }
      return await assembly.disposeAll()
    },
  })
  return supply
}
