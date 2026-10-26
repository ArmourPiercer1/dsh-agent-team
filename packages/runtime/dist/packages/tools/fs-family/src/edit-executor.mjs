/**
 * fs-family/src/edit-executor.mjs — the governed `edit` effect body (U7-9a).
 * The same center-assembly law as the write body: the family owns the pure
 * argument law and the effect declaration; EVERY authority force arrives
 * injected; the bytes land ONLY through the controlled-fs provider's
 * POST-CONSUME edit closure (O_RDWR|O_NOFOLLOW bound-fd read-modify-write,
 * native matchOffsets law, verify-before-truncate, honest undetermined
 * states) — composed, never re-implemented (CI-07).
 *
 * The edit effect set is PAIRED by design: `I:tool-invoke('edit') +
 * F(read exact file) + F(write exact file)` (M-02's pre-booked law). The
 * paired READ leg is what makes the provider receipt's `before`/`after`
 * echo lawful — the edit closure reads the old bytes through the SAME
 * verified fd it is about to rewrite (one open, one identity), so the echo
 * never discloses anything the approved effects did not cover, and a
 * write-only grant shape never carries these bytes.
 *
 * @module fs-family/edit-executor
 */
import { realpathSync } from 'node:fs'
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { createPostConsumeEditClosure } from '../../../runtime/controlled-fs/src/index.js'
import { lexicalAnchor, resolveAnchoredPath } from './fs-mechanics.mjs'
import { parseGovernedEditArgs } from './fs-mutation-mechanics.mjs'

/**
 * Build the governed edit executor for one mount (same injected face as the
 * write executor; see `createGovernedWriteExecutor` for the law of each
 * parameter).
 */
export function createGovernedEditExecutor({ realmId, rootDir, policy, decide, pa, subtreeContains, observe = () => {} }) {
  let paSeq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  const editTokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const editSignalForSettled = (token) => {
    const cached = settledTokenSignals.get(token)
    if (cached !== undefined) return cached
    const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    settledTokenSignals.set(token, settled)
    return settled
  }
  const refused = (refusalClass, code, detail, sideEffectPossible) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
    ...(sideEffectPossible === true ? { sideEffectPossible: true } : {}),
  })
  // IN-PROCESS PER-PATH SERIALIZATION (disclosed stricter-than-native law;
  // identical to the write row): same-path governed edits run one at a
  // time, so the file resolves to ONE call's complete result, never an
  // interleaved hybrid of two in-place rewrite fds racing.
  const pathTails = new Map()
  const runSerialized = async (key, body) => {
    let release
    const tail = new Promise((resolve) => { release = resolve })
    const prior = pathTails.get(key)
    pathTails.set(key, tail)
    if (prior !== undefined) {
      try { await prior } catch { /* a prior call's outcome never gates the next */ }
    }
    try {
      return await body()
    } finally {
      release()
      if (pathTails.get(key) === tail) pathTails.delete(key)
    }
  }
  const covers = (rules, locator, classes) => rules.some((rule) => {
    if (!classes.includes(rule?.tool)) return false
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

  return async (raw, corr) => {
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = editTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed edit')
      }
    }
    try {
      const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
      const execSignal = corr && corr.signal ? corr.signal : undefined
      // ── PURE front (zero FS before the PA edge). ──────────────────────
      const parsed = parseGovernedEditArgs(raw)
      if (parsed.ok !== true) return parsed.refusal
      const lex = lexicalAnchor(rootDir, parsed.filePath)
      if (!lex.ok) return refused('schema', lex.code, lex.detail)
      return runSerialized(lex.path, async () => {
      const effects = [
        { kind: 'tool-invoke', toolName: 'edit', resource: null },
        // PAIRED legs on the ONE exact target (M-02): the closure's read of
        // the pre-image and its rewrite are the SAME approved effect pair.
        { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: ['read'] } },
        { kind: 'write', resource: { realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: ['write'] } },
      ]
      const verdict = decide({ effects })
      if (verdict.kind === 'deny') {
        observe(`governed-edit lane-denied refusal code=${String(verdict.code)} path=${lex.path}`)
        return refused('admission', verdict.code, 'the template lane denies this edit effect')
      }
      // The paired set needs BOTH legs covered (an edit is a read AND a
      // write; a lane covering only one half does not answer the whole
      // question). THE LANE'S OWN CLASS LAW (createLaneDecide): a write
      // effect answers to ['write','edit'] rules, a read effect to
      // ['read','read_image'] — the pre-check mirrors it exactly, so the
      // center's admission never answers a question this gate skipped.
      const rules = [...(policy?.allow ?? []), ...(policy?.ask ?? [])]
      if (policy?.default === 'deny'
        && !(covers(rules, lex.path, ['edit', 'write']) && covers(rules, lex.path, ['read', 'read_image']))) {
        observe(`governed-edit default-deny refusal path=${lex.path}`)
        return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no rule pair (read+write) covers this edit effect')
      }
      if (typeof pa !== 'function') {
        return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no edit may run')
      }
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      paSeq += 1
      let ledgerCorrelation
      let replaySettled = false
      if (tokenKey !== undefined) {
        const prior = editTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else {
          ledgerCorrelation = `plane-edit:${mountNonce}-${String(paSeq)}`
          editTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const editSignal = replaySettled && tokenKey !== undefined ? editSignalForSettled(tokenKey) : execSignal
      const paCall = {
        realmId,
        callId: ledgerCorrelation ?? execCorrelation ?? `plane-edit-${mountNonce}-${String(paSeq)}`,
        ...(editSignal === undefined ? {} : { signal: editSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      }
      const gate = await pa(paCall)
      if (gate.kind === 'deny') {
        observe(`governed-edit pa-refused code=${String(gate.code)} detail=${String(gate.detail ?? '').slice(0, 240)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this edit'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        observe('governed-edit cancelled-at-pa-edge')
        return { kind: 'cancelled' }
      }
      // ── POST-CONSUME: full resolve + ANCHOR-DRIFT, then the closure. ──
      let rootReal
      try {
        rootReal = realpathSync(rootDir)
      } catch {
        return refused('io', 'root-unavailable', `the governed root does not resolve: ${rootDir}`)
      }
      const resolved = resolveAnchoredPath(rootDir, lex.path)
      if (!resolved.ok) {
        // An absent target is the closure's own `not-a-file` law class; the
        // resolver refuses here with its transport class kept honest (`io`)
        // — the edit NEVER creates (identical outcome, zero bytes either
        // way).
        observe(`governed-edit resolver-refused code=${String(resolved.code)}`)
        return refused('io', String(resolved.code), String(resolved.detail))
      }
      if (resolved.path !== lex.path) {
        observe(`governed-edit anchor-drift lex=${lex.path} real=${resolved.path}`)
        return refused('admission', 'ANCHOR-DRIFT', 'the resolved target differs from the approved lexical target; this call is stale and edits nothing')
      }
      const plan = Object.freeze({
        approvedRootLexical: rootDir,
        approvedRootReal: rootReal,
        approvedLocator: lex.path,
        oldString: parsed.oldString,
        newString: parsed.newString,
        replaceAll: parsed.replaceAll,
        planFingerprint: set.value.fingerprint,
      })
      const context = Object.freeze({
        parametersFingerprint: set.value.fingerprint,
        ...(editSignal === undefined ? {} : { signal: editSignal }),
      })
      const config = Object.freeze({ instanceRootDir: rootDir })
      let closure
      try {
        closure = createPostConsumeEditClosure(plan, context, config)
      } catch (error) {
        return refused('admission', 'PLAN-INVARIANT-VIOLATED', `the approved plan cannot open a provider closure (${String(error?.message ?? error).slice(0, 180)}) — zero bytes`)
      }
      const result = await closure.write()
      if (result.ok === true) {
        observe(`governed-edit RAN replace_all=${String(parsed.replaceAll)} path=${lex.path}`)
        return {
          kind: 'ok',
          path: result.value.canonicalLocator,
          before: result.value.before,
          after: result.value.after,
          replaceAll: parsed.replaceAll,
        }
      }
      const cfClass = String(result.error?.details?.cfClass ?? 'denied')
      const code = String(result.error?.code ?? 'EDIT_REFUSED')
      const message = String(result.error?.message ?? 'the provider refused the edit')
      if (cfClass === 'undetermined') {
        observe(`governed-edit UNDETERMINED code=${code} path=${lex.path}`)
        return refused('io', code, message, true)
      }
      observe(`governed-edit provider-refused code=${code} path=${lex.path}`)
      return refused('io', code, message)
      })
    } finally {
      if (tokenKey !== undefined) {
        const prior = editTokenLedger.get(tokenKey)
        if (prior !== undefined && !prior.settled) editTokenLedger.set(tokenKey, { correlation: prior.correlation, settled: true })
      }
    }
  }
}
