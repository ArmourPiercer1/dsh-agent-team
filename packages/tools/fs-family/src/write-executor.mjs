/**
 * fs-family/src/write-executor.mjs — the governed `write` effect body (U7-9a).
 * The FIRST per-family delivery through the center-assembly law: the body is
 * the family's; EVERY authority force arrives injected (the lane verdict, the
 * Kernel's admission walk incl. the one-shot consume edge, fresh-template
 * facts, the containment seam). CI-06/CI-07: the body mints no grant,
 * approves nothing, consumes nothing by itself, and never self-attests the
 * FS effect — the bytes land ONLY through the controlled-fs provider's
 * POST-CONSUME closures (`createPostConsumeWriteClosure` /
 * `createPostConsumeCreateClosure`), whose boundary law (approved-root
 * agreement, parent-identity law, O_NOFOLLOW opens, verify-before-truncate,
 * fd-bound exclusive create, honest undetermined states) the family
 * COMPOSES, never re-implements (referenced, not copied — U6-SLICE-PLAN PR2
 * law, now exercised by a mutation effect for the first time).
 *
 * The PA edge answers BEFORE any fs access; nothing below it runs unless the
 * edge allowed. Below the edge the pre-approval pure-lexical law continues
 * to hold its shape: the FULL resolver/anchor-drift law and the closures'
 * stat/open law run ONLY post-consume, and the closure receives ZERO
 * arguments — the approved facts are the whole story (P1: nothing may be
 * substituted post-approval).
 *
 * Existing-target vs create dispatch is ADVISORY (one post-consume lstat
 * picks the closure whose law fits the target's state); the race between the
 * advisory look and the closure's own authoritative look is answered by the
 * closures' honest states, never here: an existing target that races away
 * meets the write closure's zero-creation refusal (no O_CREAT), a new target
 * that races into existence meets the create closure's zero-byte EEXIST
 * refusal. Both land as typed refusals with truthful side-effect states.
 *
 * @module fs-family/write-executor
 */
import { lstatSync, realpathSync } from 'node:fs'
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import {
  createPostConsumeCreateClosure,
  createPostConsumeWriteClosure,
} from '../../../runtime/controlled-fs/src/index.js'
import { lexicalAnchor, resolveAnchoredPath } from './fs-mechanics.mjs'
import { parseGovernedWriteArgs } from './fs-mutation-mechanics.mjs'

/**
 * Build the governed write executor for one mount.
 *
 * @param {object} input
 * @param {string} input.realmId - the mount's realm (effect pairing key).
 * @param {string} input.rootDir - the controlled-fs instance root (the SAME
 *   root the read row is anchored at — no second fs algebra).
 * @param {object} input.policy - fresh-template permission policy facts.
 * @param {(x: {effects: unknown[]}) => {kind: string, code?: string}} input.decide
 *   - the plane lane verdict (deny fast path).
 * @param {(paCall: object) => Promise<object>} input.pa - the Kernel's
 *   admission edge (admit → ask when required → one-shot consume, all
 *   inside; the returned `allow` IS the consumed proof).
 * @param {(x: {realmId: string, parent: string, child: string}) => boolean} [input.subtreeContains]
 *   - the containment seam (absent = a subtree allow rule proves nothing).
 * @param {(line: string) => void} [input.observe] - effect witness lines.
 */
export function createGovernedWriteExecutor({ realmId, rootDir, policy, decide, pa, subtreeContains, observe = () => {} }) {
  let paSeq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  // ONE correlation per host execution token for the token's whole life
  // (the read entry owns its own token→correlation ledger — same law, the
  // write entry owns this one): a SETTLED token re-used answers under an
  // already-aborted signal (the PA edge settles `cancelled`, zero backend,
  // zero consumption); an IN-FLIGHT replay is refused outright; a stringy
  // token is not an identity (mount-unique fallback, never String(token)).
  const writeTokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const writeSignalForSettled = (token) => {
    const cached = settledTokenSignals.get(token)
    if (cached !== undefined) return cached
    const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    settledTokenSignals.set(token, settled)
    return settled
  }
  // IN-PROCESS PER-PATH SERIALIZATION (disclosed stricter-than-native law):
  // same-path governed writes run their approved body ONE AT A TIME, so a
  // same-path race resolves as a SEQUENCE — the final file is always ONE
  // call's COMPLETE payload (the last), every receipt claims exactly its
  // OWN bytes — never the interleaved hybrid two in-place fds could
  // produce. This is per-mount honest: cross-process racing is the same
  // last-writer territory the native row lives in; nothing claims more.
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
  const refused = (refusalClass, code, detail, sideEffectPossible) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
    ...(sideEffectPossible === true ? { sideEffectPossible: true } : {}),
  })
  const ruleCovers = (rules, locator) => rules.some((rule) => {
    // The governed write answers to the `write` rule class ONLY (native
    // permission-class law: `edit` rules never widen into whole-file
    // replacement, and a read rule never admits one either).
    if (rule?.tool !== 'write') return false
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
      const prior = writeTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed write')
      }
    }
    try {
      const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
      const execSignal = corr && corr.signal ? corr.signal : undefined
      // ── PURE front: closed parameters + pure-lexical anchor. Zero
      // realpath/exists/stat/fs access BEFORE the PA edge answers. ────────
      const parsed = parseGovernedWriteArgs(raw)
      if (parsed.ok !== true) return parsed.refusal
      const lex = lexicalAnchor(rootDir, parsed.filePath)
      if (!lex.ok) return refused('schema', lex.code, lex.detail)
      return runSerialized(lex.path, async () => {
      const effects = [
        { kind: 'tool-invoke', toolName: 'write', resource: null },
        // The write effect over the EXACT lexical target (the frozen
        // resource vocabulary: an anchored absolute governed root).
        { kind: 'write', resource: { realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: ['write'] } },
      ]
      const verdict = decide({ effects })
      if (verdict.kind === 'deny') {
        observe(`governed-write lane-denied refusal code=${String(verdict.code)} path=${lex.path}`)
        return refused('admission', verdict.code, 'the template lane denies this write effect')
      }
      if (policy?.default === 'deny' && !ruleCovers([...(policy?.allow ?? []), ...(policy?.ask ?? [])], lex.path)) {
        observe(`governed-write default-deny refusal path=${lex.path}`)
        return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this write effect')
      }
      if (typeof pa !== 'function') {
        return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no write may run')
      }
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      paSeq += 1
      let ledgerCorrelation
      let replaySettled = false
      if (tokenKey !== undefined) {
        const prior = writeTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else {
          ledgerCorrelation = `plane-write:${mountNonce}-${String(paSeq)}`
          writeTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const writeSignal = replaySettled && tokenKey !== undefined ? writeSignalForSettled(tokenKey) : execSignal
      const paCall = {
        realmId,
        callId: ledgerCorrelation ?? execCorrelation ?? `plane-write-${mountNonce}-${String(paSeq)}`,
        ...(writeSignal === undefined ? {} : { signal: writeSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      }
      const gate = await pa(paCall)
      if (gate.kind === 'deny') {
        observe(`governed-write pa-refused code=${String(gate.code)} detail=${String(gate.detail ?? '').slice(0, 240)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this write'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        observe('governed-write cancelled-at-pa-edge')
        return { kind: 'cancelled' }
      }
      // ── POST-CONSUME: the frozen approved facts run the provider's
      // boundary law. The approved lexical target must still stand at its
      // approved identity (ANCHOR-DRIFT, the read entry's law at the write
      // target: the approved fact is never rewritten here, a moved target is
      // a STALE refusal with zero bytes). ─────────────────────────────────
      let rootReal
      try {
        rootReal = realpathSync(rootDir)
      } catch {
        return refused('io', 'root-unavailable', `the governed root does not resolve: ${rootDir}`)
      }
      const resolved = resolveAnchoredPath(rootDir, lex.path)
      if (resolved.ok) {
        if (resolved.path !== lex.path) {
          observe(`governed-write anchor-drift lex=${lex.path} real=${resolved.path}`)
          return refused('admission', 'ANCHOR-DRIFT', 'the resolved target differs from the approved lexical target; this call is stale and writes nothing')
        }
        if (!resolved.isFile) {
          // A non-file standing at the approved spelling is the closures'
          // own refusal class — dispatched to the existing-file closure
          // below, which answers dir/alias truthfully.
        }
      } else if (resolved.code !== 'target-unresolvable' && resolved.code !== 'target-outside-governed-root') {
        return refused('io', String(resolved.code), String(resolved.detail))
      } else if (resolved.code === 'target-outside-governed-root') {
        return refused('admission', 'ANCHOR-DRIFT', 'the target escapes the governed root at resolution time; nothing is written')
      }
      // ADVISORY dispatch (post-consume, honest-raced by the closures' law):
      // the target's current STATE decides which closure's law fits it.
      let targetExists = false
      try {
        targetExists = lstatSync(lex.path) !== null
      } catch (error) {
        if (String(error?.code ?? '') !== 'ENOENT') {
          return refused('io', 'target-unstatable', `the write target could not be examined (${String(error?.code ?? error)}) — nothing was written`)
        }
      }
      const plan = Object.freeze({
        approvedRootLexical: rootDir,
        approvedRootReal: rootReal,
        approvedLocator: lex.path,
        content: parsed.content,
        planFingerprint: set.value.fingerprint,
      })
      const context = Object.freeze({
        parametersFingerprint: set.value.fingerprint,
        ...(writeSignal === undefined ? {} : { signal: writeSignal }),
      })
      const config = Object.freeze({ instanceRootDir: rootDir })
      let closure
      try {
        closure = targetExists
          ? createPostConsumeWriteClosure(plan, context, config)
          : createPostConsumeCreateClosure(plan, context, config)
      } catch (error) {
        // A violated constructor invariant is a broken fact, never a run:
        // the closure is not built, zero FS, zero side effect.
        return refused('admission', 'PLAN-INVARIANT-VIOLATED', `the approved plan cannot open a provider closure (${String(error?.message ?? error).slice(0, 180)}) — zero bytes`)
      }
      const result = await closure.write()
      if (result.ok === true) {
        // The effect witness law: the observe line is the RAN fact.
        observe(`governed-write RAN bytes=${String(parsed.byteLength)} created=${String(!targetExists)} path=${lex.path}`)
        return {
          kind: 'ok',
          path: result.value.canonicalLocator,
          operation: targetExists ? 'update' : 'create',
          byteLength: parsed.byteLength,
          writtenFingerprint: result.value.writtenFingerprint,
        }
      }
      const cfClass = String(result.error?.details?.cfClass ?? 'denied')
      const code = String(result.error?.code ?? 'WRITE_REFUSED')
      const message = String(result.error?.message ?? 'the provider refused the write')
      if (cfClass === 'undetermined') {
        // Honest undetermined: bytes MAY have landed — the refusal says so
        // and carries the flag; 'zero side effect' is never claimed here.
        observe(`governed-write UNDETERMINED code=${code} path=${lex.path}`)
        return refused('io', code, message, true)
      }
      observe(`governed-write provider-refused code=${code} path=${lex.path}`)
      return refused('io', code, message)
      })
    } finally {
      if (tokenKey !== undefined) {
        const prior = writeTokenLedger.get(tokenKey)
        if (prior !== undefined && !prior.settled) writeTokenLedger.set(tokenKey, { correlation: prior.correlation, settled: true })
      }
    }
  }
}
