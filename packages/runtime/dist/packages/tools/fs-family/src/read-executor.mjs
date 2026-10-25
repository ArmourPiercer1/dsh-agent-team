/**
 * fs-family/src/read-executor.mjs — the governed `read` effect body (U6 PR2;
 * U6-SLICE-PLAN PR2: "the effect body moves (`plane-effect-backends.mjs`
 * :1074-1578) into the contribution"). Moved VERBATIM from the center file at
 * master 2db321f63 — the law this body carries (token→correlation ledger,
 * PA hand-off, exec-time identity re-check, bounded ring, zero-byte refusal
 * grammar) is pinned by the shipped read suites and the C2 lanes; only its
 * HOME moved.
 *
 * OWNER ROLE (family lane, center-assembly-architecture §4 Execution
 * boundary; § CI-06/CI-07): this is the Family's EFFECT BODY. Every
 * authority force arrives INJECTED — `decide` (the lane verdict), `pa`
 * (the Kernel's admission walk incl. the one-shot consume edge), `policy`
 * (fresh-template facts), `subtreeContains` (the containment seam) — and the
 * body NEVER calls them as an afterthought around the effect: the PA edge
 * answers BEFORE any fs access and nothing below it runs unless the edge
 * allowed. The body mints no grant, approves nothing, and consumes nothing
 * by itself — it composes the injected one-shot edge exactly as the Kernel
 * wired it (the same `consumeForExecution` face, now also visible to the
 * center kernel's consume point — U6 PR2 port binding).
 *
 * The post-consume primitives (controlled-fs `verifyOpenedHandle`) are
 * REFERENCED, never copied (U6-SLICE-PLAN PR2: "controlled-fs post-consume
 * closures referenced, not copied").
 *
 * @module fs-family/read-executor
 */
import { Buffer } from 'node:buffer'
import { statSync, constants as fsConstants } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { verifyOpenedHandle } from '../../../runtime/controlled-fs/src/index.js'
import {
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  buildGovernedReadWindow,
  lexicalAnchor,
  parseGovernedReadWindow,
  resolveAnchoredPath,
} from './fs-mechanics.mjs'

/**
 * THE fs-class row: the governed `read` body + its lane gate, anchored at
 * the SAME controlled-fs instance root. `decide` is the plane lane (deny
 * fast path); the default-deny gate re-checks ALLOW coverage at the effect's
 * own granularity — under `deny` an effect the policy never names never
 * touches the fs (no lane-widening anywhere in this file).
/**
 * THE fs-class row: the governed `read` body + its lane gate, anchored at
 * the SAME controlled-fs instance root. `decide` is the plane lane (deny
 * fast path); the default-deny gate re-checks ALLOW coverage at the effect's
 * own granularity — under `deny` an effect the policy never names never
 * touches the fs (no lane-widening anywhere in this file).
 */
export function createGovernedReadExecutor({ realmId, rootDir, policy, decide, pa, subtreeContains, observe = () => {} }) {
  let executed = 0
  let paSeq = 0
  const ruleCovers = (rules, locator) => rules.some((rule) => {
    if (rule?.tool !== 'read') return false
    const kind = rule?.resource?.kind
    if (kind === 'any') return true
    if (kind === 'exact') return typeof rule.resource.path === 'string' && rule.resource.path === locator
    if (kind === 'subtree') {
      if (typeof rule?.resource?.path !== 'string') return false
      if (typeof subtreeContains === 'function') {
        return subtreeContains({ realmId, parent: rule.resource.path, child: locator }) === true
      }
      return false // without the containment seam, a subtree rule proves nothing: refuse
    }
    return false
  })
  const refused = (refusalClass, code, detail) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
  })
  // PR358 fix-2b: the optional second argument carries the REAL host exec
  // correlation (the registry-assigned per-execution token). With it the PA
  // call id is `hexec:<token>` — unique per execution, never recycled when
  // the plane remounts; without it a mount-unique nonce keeps the fallback
  // non-reusable across rebuilds too. fix-4: the host cancel signal rides
  // the PA edge (leg wait + pre-consume check).
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  // 9e-1: the REAL per-execution token (object | symbol) is consumed HERE —
  // the read entry owns its own token→correlation ledger, exactly the trio
  // face's law: ONE allocation per token for the token's whole life; a
  // SETTLED token re-used answers the ORIGINAL correlation under an
  // already-aborted signal (the PA edge settles `cancelled`, zero backend,
  // zero consumption); an IN-FLIGHT replay is refused outright; a stringy
  // token is not an identity (mount-unique fallback, never String(token)).
  const readTokenLedger = new Map() // token(object|symbol) -> { correlation, settled }
  // A5-M2 PA-READ HAND-OFF: a PRE-DISPATCH PA walk that settled on this token
  // and waits for its body. Keyed by the host execution token (a symbol or a
  // frozen object — never an execution reference, never a String() of it), so
  // it pins no execution. An entry leaves through the body's single take,
  // through the `tools/result` terminal close, or through mount teardown.
  // This is NOT a second identity ledger: the token→correlation law stays
  // ONLY in `readTokenLedger` above (and nothing here stores a callId/name
  // as authority).
  const paHandoffs = new Map()
  // A5-M2 ④: an OPEN leg that is still awaiting its walk is owned by THAT leg
  // (a placeholder, so `close`/teardown can void a pending A too), and the row
  // knows whether its mount is still alive — a grant that lands after the
  // mount is gone is dropped, never registered.
  let rowMounted = true
  let paOpenSeq = 0
  const readSignalForSettled = (token) => (typeof token === 'symbol'
    ? { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    : (() => {
      const cached = settledTokenSignals.get(token)
      if (cached !== undefined) return cached
      const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
      settledTokenSignals.set(token, settled)
      return settled
    })())
  const settledTokenSignals = new WeakMap()
  const rowMain = async (raw, corr, mode) => {
    // A5-M2: 'run' is the row's own invocation (byte-identical to the pre
    // hand-off path); 'open' is the pre-execute Part-A leg, which returns at
    // the PA edge and must NOT terminalise the token (its body redeems it).
    let holdOpen = false
    // A5-M2 close-out (root ①): a leg may only terminalise the token it OWNS.
    // A duplicate entry point looks at ANOTHER leg's in-flight state, so it is
    // a side-effect-free refusal: it settles nothing, re-mints nothing, and
    // reuses no answer. Without this the leg's `finally` used to settle the
    // FIRST owner's token underneath a leg that was still walking.
    let ownsTokenTerminal = true
    // A5-M2 close-out (root ②): the plan-fact close handle is held from the
    // first moment this leg can have created one — the pending placeholder for
    // an open leg, the synchronous take for a redemption — so EVERY later
    // return or throw closes, and the terminal state never depends on the
    // flight still being present in the map.
    let ownedCallId
    const closeOwnedPlan = () => {
      if (ownedCallId === undefined) return
      const closeFn = typeof pa === 'function' ? pa.closePlan : undefined
      if (typeof closeFn === 'function') closeFn(ownedCallId)
    }
    try {
    // resolve THIS execution's identity: real token → ledger correlation
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    let handoffClaim
    if (tokenKey !== undefined) {
      const prior = readTokenLedger.get(tokenKey)
      if (mode === 'open' && prior !== undefined && prior.settled) {
        // A TERMINAL token is never re-armed: no new correlation, no new walk,
        // no revival of a hand-off this execution already ended.
        ownsTokenTerminal = false
        return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_TERMINAL', detail: 'this execution token is already terminal, so no PA hand-off may be opened on it again' }
      }
      if (mode === 'open' && prior !== undefined && prior.handedOff === true) {
        // ① A second open is refused UNCONDITIONALLY and without side effects,
        // whether the first leg is still walking or has been answered: an
        // authorization is not transferable, so nothing is reused, and the
        // first leg's state is not touched. Reusing the answered flight here
        // used to mark a second call authorized while it owned no flight, and
        // this leg's finally then settled the token the FIRST leg still needed.
        ownsTokenTerminal = false
        return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_IN_FLIGHT', detail: 'a PA hand-off is already open for this execution token; a second open is refused without touching the in-flight state and no answer is reused' }
      }
      if (prior !== undefined && !prior.settled && prior.handedOff !== true) {
        ownsTokenTerminal = false
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed read')
      }
      // A5-M2: for a handed-off token the ONE in-flight flight IS this body's
      // redemption, so it is not a replay. The take is synchronous and single:
      // a re-entrant second redemption finds no flight and fails closed.
      if (prior !== undefined && !prior.settled && prior.handedOff === true && mode !== 'open') {
        const flight = paHandoffs.get(tokenKey)
        paHandoffs.delete(tokenKey)
        if (flight === undefined) {
          // Someone else already ended this hand-off (a close, or a teardown),
          // so this leg owns nothing to settle.
          ownsTokenTerminal = false
          return refused('admission', 'PA_HANDOFF_LOST', 'the pre-dispatch PA hand-off of this execution is gone (closed or already spent); Part A is never re-run and no fallback lane serves this read')
        }
        handoffClaim = flight
        // ② the handle is held AT THE TAKE, not at the redemption site: the map
        // entry is already gone, and between here and the edge sit schema,
        // lane and effect-set refusals that used to leave the plan fact with
        // nobody left to close it.
        ownedCallId = flight.callId
      }
    }
    const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
    const execSignal = corr && corr.signal ? corr.signal : undefined
    const record = (raw !== null && typeof raw === 'object') ? raw : {}
    // file_path = the canonical spelling the frozen operation-permission
    // layer resolves for `read`; `path` stays accepted for placement-direct
    // callers (unit legs).
    const rawPath = record.file_path ?? record.path
    // E2 [rev2 前置]: the window law runs FIRST — pure parameter arithmetic,
    // ZERO fs access (resolveAnchoredPath below already does realpathSync/
    // existsSync metadata I/O). The projection has carried offset/limit since
    // canonical-operation.ts:674-675; the executor now truly CONSUMES them.
    const window = parseGovernedReadWindow(record.offset, record.limit)
    if (!window.ok) {
      observe(`governed-read window-refused code=${window.refusal.code}`)
      return window.refusal
    }
    // PR358 fix-5 (pending ⇒ resolver=0): BEFORE approval the executor does
    // PURE LEXICAL projection only — zero realpath/exists/stat/fs access.
    // The resolver's full law (realpath/alias class, the frozen
    // target-unresolvable family) runs only AFTER the PA edge consumed, and
    // its result must still match the approved lexical target — if realpath
    // moved the target in between, the call is stale-refused (zero body, no
    // re-approval here). The A3 single-point law holds: the effect locator,
    // the approved fingerprint, and the consumed target are ONE value.
    const lex = lexicalAnchor(rootDir, rawPath)
    if (!lex.ok) {
      return refused('schema', lex.code, lex.detail)
    }
    // fix-5: pre-gate shape carries the LEXICAL path only; the resolver's
    // `rootReal`/real identity fields attach after the PA consumption.
    let parsed = { ok: true, path: lex.path }
    const effects = [
      { kind: 'tool-invoke', toolName: 'read', resource: null },
      // The frozen resource vocabulary (parseRequestedEffectSet closed set):
      // the anchored root is an ABSOLUTE governed root → 'absolute-path'.
      { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: parsed.path, rights: ['read'] } },
    ]
    const verdict = decide({ effects })
    if (verdict.kind === 'deny') return refused('admission', verdict.code, 'the template lane denies this read effect')
    if (policy?.default === 'deny' && !ruleCovers([...(policy?.allow ?? []), ...(policy?.ask ?? [])], parsed.path)) {
      observe(`governed-read default-deny refusal call path=${parsed.path}`)
      return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this read effect')
    }
    // M1 CENTER PA WIRING (frozen A): the ASYNC production edge. The lane
    // verdict above is a fast deny path, NEVER the ask stand-in: the parsed
    // effect set now walks admitCall → (real Control ask when required →
    // presenter → issueApprovedGrant) → one-shot consume INSIDE `pa`, and
    // NOTHING below this line runs until that edge says allow. Pending is a
    // denial with its own code — never a synchronous allow.
    if (typeof pa === 'function') {
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      paSeq += 1
      // 9e-1: ONE correlation per token for its whole life (single-flight);
      // a terminal replay re-uses the ORIGINAL id and runs pre-aborted so
      // the PA edge answers `cancelled` with zero consumption.
      let ledgerCorrelation
      let replaySettled = false
      if (tokenKey !== undefined) {
        const prior = readTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else if (prior !== undefined && prior.handedOff === true && mode !== 'open') {
          // ONE correlation per token for its whole life: the redemption runs
          // under the ORIGINAL id Part A asked with, never a fresh one.
          ledgerCorrelation = prior.correlation
        } else {
          paSeq += 1
          ledgerCorrelation = `plane-read:${mountNonce}-${String(paSeq)}`
          readTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const readSignal = replaySettled && tokenKey !== undefined ? readSignalForSettled(tokenKey) : execSignal
      const paCall = {
        realmId,
        callId: ledgerCorrelation ?? execCorrelation ?? `plane-read-${mountNonce}-${String(paSeq)}`,
        ...(readSignal === undefined ? {} : { signal: readSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      }
      let gate
      if (mode === 'open') {
        if (typeof pa.open !== 'function') {
          return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_UNAVAILABLE', detail: 'this plane mounts no PA admission-open entry, so no pre-dispatch hand-off can be opened' }
        }
        paOpenSeq += 1
        const mySeq = paOpenSeq
        // ② the handle is taken BEFORE the walk starts, and the placeholder
        // rides the call's own correlation: a close or teardown landing while
        // PA is being asked must still be able to drop THIS call's plan fact.
        // (A placeholder without it made `paHandoffClose` return undefined and
        // the fact stayed in `livePaPlan` for the life of the mount.)
        ownedCallId = paCall.callId
        if (tokenKey !== undefined) paHandoffs.set(tokenKey, Object.freeze({ pending: true, seq: mySeq, callId: paCall.callId }))
        try {
          gate = await pa.open(paCall)
        } catch (error) {
          // ② a Part A that THREW handed nothing off and would otherwise have
          // left its plan fact behind (there was no finally at all here). The
          // placeholder is released only if it is still this leg's, then the
          // plan fact closes and the call refuses in place.
          if (tokenKey !== undefined && paHandoffs.get(tokenKey)?.seq === mySeq) paHandoffs.delete(tokenKey)
          closeOwnedPlan()
          ownsTokenTerminal = false
          return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_FAULT', detail: `Part A threw and is never treated as an authorization: ${String(error?.message ?? error).slice(0, 180)}` }
        }
        // ④ AFTER the await the world is re-checked, not assumed: the mount
        // must still be this row's mount, and this leg must still own the
        // placeholder (a close/teardown in between voided the leg — its grant,
        // if one landed, is dropped and NOTHING is registered).
        if (tokenKey !== undefined) {
          const held = paHandoffs.get(tokenKey)
          if (!rowMounted) {
            // The mount is gone, so a teardown already drained what it knew
            // about; this late answer must not leave a plan fact behind.
            closeOwnedPlan()
            ownsTokenTerminal = false
            readTokenLedger.set(tokenKey, { correlation: ownedCallId ?? 'unknown', settled: true })
            observe('governed-read pa-handoff dropped — mount torn down during the walk')
            return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_MOUNT_GONE', detail: 'the mount was torn down while PA was being asked; the answer is dropped and nothing is authorized' }
          }
          if (held === undefined || held.seq !== mySeq) {
            closeOwnedPlan()
            ownsTokenTerminal = false
            readTokenLedger.set(tokenKey, { correlation: ownedCallId ?? 'unknown', settled: true })
            observe('governed-read pa-handoff dropped — the leg was closed while PA was being asked')
            return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_CLOSED', detail: 'this hand-off leg was closed while PA was being asked; the answer is dropped and nothing is authorized' }
          }
        }
      } else if (handoffClaim !== undefined) {
        // ② the close handle was already taken AT THE TAKE above, not here.
        if (typeof pa.edge !== 'function') {
          return refused('admission', 'PA_HANDOFF_UNAVAILABLE', 'this plane mounts no PA execution-edge entry, so a handed-off grant is never spent through the admission call')
        }
        if (handoffClaim.parametersFingerprint !== set.value.fingerprint || handoffClaim.callId !== paCall.callId) {
          // exact-match law: the redemption answers the SAME question Part A
          // asked. Member/binding/effects are re-verified FRESH inside the
          // edge; this compares the identity of the call itself.
          return refused('admission', 'PA_HANDOFF_MISMATCH', 'the redemption does not ask the question the pre-dispatch PA walk was approved for; nothing runs')
        }
        gate = await pa.edge({
          ...paCall,
          grant: handoffClaim.grant,
          paDurableMint: handoffClaim.paDurableMint,
          request: handoffClaim.request,
          placementName: handoffClaim.placementName,
          paConstructionBinding: handoffClaim.paConstructionBinding,
        })
      } else {
        gate = await pa(paCall)
      }
      if (mode === 'open') {
        // Part A ends here: no lexical resolve, no anchor, no open, no byte,
        // and the token stays IN-FLIGHT (never terminal) for its redemption.
        if (gate.kind === 'approved') {
          if (tokenKey === undefined || ledgerCorrelation === undefined) {
            return { kind: 'refused', code: 'PA_HANDOFF_UNBOUND', detail: 'the approved PA walk carries no execution token to redeem it, so the approval is dropped and nothing is authorized' }
          }
          paHandoffs.set(tokenKey, Object.freeze({
            callId: ledgerCorrelation,
            parametersFingerprint: String(set.value.fingerprint),
            grant: gate.grant,
            paDurableMint: gate.paDurableMint,
            request: gate.request,
            // Part A's private construction state, carried EXPLICITLY to the
            // edge (no free identifiers across the split, no relaxed facts
            // check: the edge re-reads fresh and DRIFTS against this tuple).
            placementName: gate.placementName,
            paConstructionBinding: gate.paConstructionBinding,
          }))
          readTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false, handedOff: true })
          holdOpen = true
          observe(`governed-read pa-handoff OPEN call=${ledgerCorrelation}`)
          return { kind: 'authorized', correlation: ledgerCorrelation }
        }
        if (gate.kind === 'allow' && gate.cancelled === true) return { kind: 'cancelled' }
        observe(`governed-read pa-handoff refused code=${String(gate.code ?? 'unknown')}`)
        return { kind: 'refused', ownsHandoff: true, code: String(gate.code ?? 'PA_HANDOFF_REFUSED'), detail: String(gate.detail ?? 'the pre-dispatch PA walk refused this read') }
      }
      if (gate.kind === 'deny') {
        observe(`governed-read pa-refused code=${String(gate.code)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this read'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        // PR358-A2: the read row honors the cancelled invocation fact — zero
        // resolver, zero open, zero byte, zero PA consumption.
        observe('governed-read cancelled-at-pa-edge')
        return { kind: 'cancelled' }
      }
    }
    // fix-5 (post-consume): now, and only now, the FULL resolver runs —
    // realpath/alias/exists law. Drift between the approved lexical target
    // and the resolved real target is a STALE refusal: zero body, zero
    // re-approval (the approved fact is not rewritten here).
    const resolved = resolveAnchoredPath(rootDir, rawPath)
    if (!resolved.ok) {
      observe(`governed-read resolver-refused code=${String(resolved.code)}`)
      // Post-consume resolver refusals keep the resolver's transport class
      // (`io`) — pre-gate only the PURE-LEXICAL refusals are `schema`.
      return refused('io', String(resolved.code), String(resolved.detail))
    }
    if (resolved.path !== parsed.path) {
      observe(`governed-read anchor-drift lex=${parsed.path} real=${resolved.path}`)
      return refused('admission', 'ANCHOR-DRIFT', 'the resolved target differs from the approved lexical target; this call is stale and runs nothing')
    }
    parsed = resolved
    // TOCTOU fix (independent security review ①(c) leg C1: an external
    // rename->symlink swap in the realpath->read window leaked at iteration
    // 23/20000). The check-time path string no longer carries the open: the
    // lane's OWN safe-open law runs (O_NOFOLLOW) and the ACTUAL fd is
    // re-read at exec time by `verifyOpenedHandle` (open-at-exec.ts:
    // /proc/self/fd containment + fstat-vs-snapshot drift). A swap that
    // landed after resolveAnchored returned is caught here as
    // exec-time-escape / drift — BEFORE any byte is read, zero disclosed.
    // Bytes come from the verified handle, never from the path string.
    let stat
    try {
      stat = statSync(parsed.path)
    } catch {
      return refused('io', 'target-unreadable', 'the anchored target could not be stat-ed')
    }
    if (!stat.isFile()) return refused('io', 'not-a-file', 'the governed read is a file effect, never a directory walk')
    let handle
    try {
      handle = await fsOpen(parsed.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    } catch (error) {
      const code = String(error?.code ?? '')
      if (code === 'ELOOP') return refused('io', 'symlink-alias', 'the OS refused the open (ELOOP): symlink alias')
      if (code === 'ENOENT') return refused('io', 'target-unreadable', 'the object does not exist at open time')
      if (code === 'EISDIR') return refused('io', 'not-a-file', 'the governed read is a file effect, never a directory walk')
      return refused('io', 'open-failed', code.slice(0, 80))
    }
    // ONE close owner from here on: every post-open path (exec-time refusal,
    // size gate, ring, window refusal) exits through the SAME finally, so
    // the real handle closes exactly once on every outcome.
    try {
      const snapshot = { dev: Number(stat.dev), ino: Number(stat.ino), size: stat.size, mtimeMs: stat.mtimeMs }
      const recheck = await verifyOpenedHandle(handle, parsed.rootReal, snapshot)
      if (recheck.verdict !== 'confirmed') {
        const detail = recheck.verdict === 'escape'
          ? `exec-time re-read: the fd resolved to ${recheck.resolvedPath} — OUTSIDE the governed anchor`
          : recheck.verdict === 'drift'
            ? `snapshot ${String(recheck.snapshot.dev)}:${String(recheck.snapshot.ino)} != opened ${String(recheck.actual.dev)}:${String(recheck.actual.ino)}`
            : recheck.detail
        observe(`governed-read exec-refused:${recheck.verdict} path=${parsed.path}`)
        return refused('io', `exec-time-${recheck.verdict}`, `${String(detail).slice(0, 200)}; zero bytes disclosed`)
      }
      // Verified-size PRE-GATE (kept VERBATIM, plan E4 [rev3]): a static
      // over-cap file is refused here, before a single byte is fetched.
      if (recheck.identity.size > MAX_READ_BYTES) {
        return refused('io', 'read-too-large', `${String(recheck.identity.size)} bytes exceeds the ${String(MAX_READ_BYTES)} governed read bound (refused, never truncated)`)
      }
      executed += 1
      // E4 [rev3]: bounded ring on the SAME verified FD (guards post-verify
      // GROWTH the pre-gate cannot see). Refusal judgement = cumulative
      // ACTUAL bytesRead (plan E4 [rev4] metering law); each request is
      // bounded by cap+1 minus what was ACTUALLY read, so the buffer stays
      // ≤ cap+1 bytes. Legitimate short reads / EOF probes may push the
      // cumulative REQUESTED past cap+1 — probes, not overshoot, never a
      // refusal trigger. No partial window, no reopen, no Grant handoff.
      let lines
      let totalLines
      try {
        const chunk = Buffer.alloc(READ_ROW_CHUNK_BYTES)
        const parts = []
        let total = 0
        while (total < MAX_READ_BYTES + 1) {
          const want = Math.min(READ_ROW_CHUNK_BYTES, MAX_READ_BYTES + 1 - total)
          const { bytesRead } = await handle.read(chunk, 0, want, total)
          if (bytesRead === 0) break
          parts.push(Buffer.from(chunk.subarray(0, bytesRead)))
          total += bytesRead
        }
        if (total > MAX_READ_BYTES) {
          // Reachable ONLY via post-verify growth (the pre-gate proved the
          // verified size ≤ cap): refuse the WHOLE call, zero content.
          return refused('io', 'read-too-large', `${String(total)} bytes exceeds the ${String(MAX_READ_BYTES)} governed read bound (refused, never truncated)`)
        }
        const decoded = Buffer.concat(parts, total).toString('utf8')
        const win = buildGovernedReadWindow(decoded, parsed.path, window.offset, window.limit)
        if (!win.ok) return win.refusal
        lines = win.lines
        totalLines = win.totalLines
      } catch (error) {
        return refused('io', 'read-failed', String(error?.message ?? error).slice(0, 200))
      }
      observe(`governed-read RAN bytes=${String(recheck.identity.size)} path=${parsed.path}`)
      return { kind: 'ok', path: parsed.path, offset: window.offset, lines, totalLines }
    } finally {
      await handle.close().catch(() => undefined)
    }
    } finally {
      // 9e-1: the token's correlation goes TERMINAL when the execution
      // settles (terminal is never re-armed; a later re-use of the token
      // answers the ORIGINAL correlation as `cancelled`).
      // A5-M2: an OPEN leg holds the token IN-FLIGHT for its redemption — it
      // is not an execution and must not terminalise the token. (Guarded
      // rather than `return`ed: a `return` in a finally would swallow the
      // leg's own answer.)
      // ② whatever this leg returned or threw, if it could have created a plan
      // fact it closes it here — from the HANDLE it holds, never from a map
      // entry that may already be gone. An OPEN leg that was HELD (`holdOpen`)
      // is deliberately excluded: its plan fact is what the execution edge
      // re-reads, and the redemption leg closes it from its own handle.
      if (!holdOpen) closeOwnedPlan()
      if (ownsTokenTerminal && !holdOpen && (typeof corr?.token === 'object' && corr.token !== null || typeof corr?.token === 'symbol')) {
        const prior = readTokenLedger.get(corr.token)
        if (prior !== undefined && !prior.settled) readTokenLedger.set(corr.token, { correlation: prior.correlation, settled: true })
      }
    }
  }
  const executor = (raw, corr) => rowMain(raw, corr, 'run')
  executor.execCount = () => executed
  /** A5-M2 pre-dispatch leg: run Part A only, on this token, and hold the
   *  answer for the body. Returns `authorized` / `refused` / `cancelled`. */
  executor.paHandoffOpen = (raw, corr) => rowMain(raw, corr, 'open')
  /** The `tools/result` terminal close: idempotent, synchronous, and it
   *  leaves a state a same-token call cannot revive (the record goes TERMINAL
   *  and terminal is never re-armed). Returns the correlation so the caller
   *  can drop the mount's plan fact for the same call. */
  executor.paHandoffClose = (token) => {
    if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) return undefined
    const flight = paHandoffs.get(token)
    paHandoffs.delete(token)
    const prior = readTokenLedger.get(token)
    if (prior !== undefined && !prior.settled) readTokenLedger.set(token, { correlation: prior.correlation, settled: true })
    // Only an UNSPENT flight owes the mount a plan-fact drop: a spent one
    // was cleared by the walk's own finally.
    return flight?.callId
  }
  /** Mount teardown: no hand-off survives its mount, claimed or not. */
  executor.paHandoffCloseAll = () => {
    rowMounted = false
    const open = []
    for (const token of paHandoffs.keys()) open.push(token)
    for (const token of open) {
      const callId = executor.paHandoffClose(token)
      // Teardown drops the plan fact ITSELF: `paHandoffClose` only returns the
      // correlation, and once the mount is going away no later leg is left to
      // consume it — a pending A whose placeholder carried no callId used to
      // leak its plan fact exactly here.
      const closeFn = typeof pa === 'function' ? pa.closePlan : undefined
      if (typeof callId === 'string' && typeof closeFn === 'function') closeFn(callId)
    }
  }
  return executor
}
