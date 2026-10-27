/**
 * ui-family/src/present-executor.mjs — the governed `present` effect body
 * (u7-f): publish an EXISTING file as a deliverable through the INJECTED
 * interaction port, after the Kernel's admission edge consumed the call.
 *
 * THE ANCHORING LAW IS THE FS FAMILY'S, REUSED NOT REINVENTED:
 * `lexicalAnchor` (pure, zero fs access) decides the approved locator BEFORE
 * the PA edge — an out-of-root path is a typed refusal with ZERO port calls
 * and ZERO filesystem touch; `resolveAnchoredPath` runs POST-CONSUME (the
 * symlink-alias / anchor-drift law — an escape visible only at resolution
 * time refuses with ZERO publication). The file is then PROBED, not read:
 * an O_NOFOLLOW open + fstat through the descriptor proves "an existing,
 * readable, regular file at the approved spelling" — the read effect the
 * call declared — while ZERO file bytes ever enter memory, the result, or
 * an observation line (the host row's own law: "the user opens the current
 * files; their contents are not copied").
 *
 * The declared effect set is the whole truth, per call:
 * `tool-invoke(present)` + `domain-ref(ui-presentation)` (the human-facing
 * publication — the interaction effect) + one `read` effect PER FILE (the
 * probe above is what pays for them). Declared == requested, fingerprinted
 * together (the PR #390 lesson, made structural).
 *
 * @module ui-family/present-executor
 */
import { closeSync, fstatSync, openSync, realpathSync } from 'node:fs'
import { constants as fsConstants } from 'node:fs'
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
// The anchor law has ONE home; the boundary law (eb3-family-boundaries)
// forbids reaching into a sibling lane's internals, so the two anchor
// faces arrive through fs-family's PUBLIC face `src/index.mjs` (the same
// exports fs-mechanics carries; the precedent booked for process/search).
import { lexicalAnchor, resolveAnchoredPath } from '../../fs-family/src/index.mjs'
import {
  PRESENT_NATIVE_NAME,
  UI_PRESENTATION_DOMAIN_AUTHORITY,
  parsePresentArgs,
} from './ui-mechanics.mjs'
import { hasUiPortFace } from './ui-interaction-port.mjs'

/** O_RDONLY | O_NOFOLLOW where the platform carries the flag (the fs
 *  family's open law; Windows realpath anchoring above covers the alias
 *  case where the platform flag is a no-op). */
const READ_NO_FOLLOW = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)

/**
 * Build the governed present executor for one mount.
 *
 * @param {object} input
 * @param {string} input.realmId - the mount's realm (effect pairing key).
 * @param {string|null} input.rootDir - the governed root the paths anchor
 *   at (the SAME controlled-fs instance root the fs family lives inside —
 *   no second fs algebra). null = no governed root on this mount: every
 *   call fails closed, nothing rides unanchored.
 * @param {object} input.policy - fresh-template permission policy facts.
 * @param {(x: {effects: unknown[]}) => {kind: string, code?: string}} input.decide
 *   - the plane lane verdict (deny fast path).
 * @param {(paCall: object) => Promise<object>} input.pa - the Kernel's
 *   admission edge (the returned `allow` IS the consumed proof).
 * @param {() => unknown} input.portRef - the INJECTED interaction port
 *   (its `present` face publishes; absent = fail-closed typed refusal).
 * @param {(x: {realmId: string, parent: string, child: string}) => boolean} [input.subtreeContains]
 *   - the containment seam (absent = a subtree read rule proves nothing).
 * @param {(line: string) => void} [input.observe] - witness lines (paths
 *   and codes only — file CONTENT never rides a line).
 */
export function createGovernedPresentExecutor({ realmId, rootDir, policy, decide, pa, portRef, subtreeContains, observe = () => {} }) {
  let paSeq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  const presentTokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const presentSignalForSettled = (token) => {
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
  const ruleCovers = (rules, locator) => rules.some((rule) => {
    // The present row's file effects answer to the `read` rule class ONLY
    // (presenting publishes a REFERENCE; it never claims write-class room).
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
  /** The post-consume probe: prove readable-regular-file at the approved
   *  spelling through an O_NOFOLLOW descriptor. NEVER reads bytes. */
  const probe = (path) => {
    let fd
    try {
      fd = openSync(path, READ_NO_FOLLOW)
    } catch (error) {
      const code = String(error?.code ?? '')
      if (code === 'ENOENT') return { ok: false, code: 'not-found' }
      if (code === 'ELOOP' || code === 'EMLINK') return { ok: false, code: 'symlink' }
      return { ok: false, code: 'unopenable', detail: code || String(error) }
    }
    try {
      const st = fstatSync(fd)
      if (!st.isFile()) return { ok: false, code: 'not-a-file' }
      return { ok: true, byteLength: st.size }
    } finally {
      try { closeSync(fd) } catch { /* the probe's fact is already decided */ }
    }
  }

  return async (raw, corr) => {
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = presentTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed present')
      }
    }
    let ledgerCorrelation
    let replaySettled = false
    try {
      const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
      const execSignal = corr && corr.signal ? corr.signal : undefined
      // ── PURE front: closed parameters + the pure-lexical anchor. Zero
      // stat/open/port touch BEFORE the PA edge answers. ─────────────────
      const parsed = parsePresentArgs(raw)
      if (parsed.ok !== true) return refused('schema', parsed.code, parsed.detail)
      if (typeof rootDir !== 'string' || rootDir.length === 0) {
        observe('governed-present root-refusal')
        return refused('admission', 'UI_GOVERNED_ROOT_ABSENT', 'this mount carries no governed file root, so no path can be anchored — the governed row fails closed')
      }
      const anchored = []
      for (const file of parsed.value.files) {
        const lex = lexicalAnchor(rootDir, file.path)
        if (!lex.ok) {
          observe(`governed-present anchor-refusal code=${String(lex.code)}`)
          return refused('schema', lex.code, lex.detail)
        }
        anchored.push({ file, path: lex.path })
      }
      // ── The port gate BEFORE any authority force (fail closed; the
      // absence refuses with zero PA consumption, zero port calls). ──────
      const port = typeof portRef === 'function' ? portRef() : null
      if (!hasUiPortFace(port, 'present')) {
        observe('governed-present port-refusal')
        return refused('admission', 'UI_PRESENT_PORT_ABSENT', 'this mount carries no injected presentation face, so nothing can be published — the governed row fails closed and presents nothing')
      }
      const effects = [
        { kind: 'tool-invoke', toolName: PRESENT_NATIVE_NAME, resource: null },
        { kind: 'domain-ref', domainAuthorityId: UI_PRESENTATION_DOMAIN_AUTHORITY, resource: null },
        // One read effect PER FILE — what the probe below actually pays for
        // (the REALM_FILE_ROOT_TARGET fact: these live and die inside the
        // member's admitted root; the contribution declares the target).
        ...anchored.map((entry) => ({
          kind: 'read',
          resource: { realmId, kind: 'absolute-path', canonicalLocator: entry.path, rights: ['read'] },
        })),
      ]
      const verdict = decide({ effects })
      if (verdict.kind === 'deny') {
        observe(`governed-present lane-denied refusal code=${String(verdict.code)}`)
        return refused('admission', verdict.code, 'the template lane denies this presentation effect')
      }
      if (policy?.default === 'deny') {
        // Two honest layers, one outcome: the file-level law first (a read
        // rule must cover EVERY presented file — presenting does not get to
        // browse what the template would not let the member read), and the
        // Kernel's coverage scan refuses the invoke/domain arms at the edge
        // either way (the frozen grammar names no presentation rule).
        const rules = [...(policy?.allow ?? []), ...(policy?.ask ?? [])]
        const uncovered = anchored.find((entry) => !ruleCovers(rules, entry.path))
        if (uncovered !== undefined) {
          observe(`governed-present default-deny refusal path=${uncovered.path}`)
          return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no read rule covers this presented file')
        }
        observe('governed-present default-deny refusal arms')
        return refused('admission', 'template-default-deny', 'the policy defaults to DENY and the closed rule grammar names no presentation rule that could cover the publication arm')
      }
      if (typeof pa !== 'function') {
        return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so nothing may be published')
      }
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      paSeq += 1
      if (tokenKey !== undefined) {
        const prior = presentTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else {
          ledgerCorrelation = `plane-present:${mountNonce}-${String(paSeq)}`
          presentTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const presentSignal = replaySettled && tokenKey !== undefined ? presentSignalForSettled(tokenKey) : execSignal
      const callId = ledgerCorrelation ?? execCorrelation ?? `plane-present-${mountNonce}-${String(paSeq)}`
      const gate = await pa({
        realmId,
        callId,
        ...(presentSignal === undefined ? {} : { signal: presentSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      })
      if (gate.kind === 'deny') {
        observe(`governed-present pa-refused code=${String(gate.code)} detail=${String(gate.detail ?? '').slice(0, 240)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this presentation'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        observe('governed-present cancelled-at-pa-edge')
        return { kind: 'cancelled' }
      }
      // ── POST-CONSUME: the approved anchor law still has to STAND (the
      // write row's ANCHOR-DRIFT law at a read target), then the probe,
      // then the port. All refusals here publish NOTHING. ────────────────
      try {
        realpathSync(rootDir)
      } catch {
        return refused('io', 'root-unavailable', `the governed root does not resolve: ${rootDir}`)
      }
      const verified = []
      for (const entry of anchored) {
        const resolved = resolveAnchoredPath(rootDir, entry.path)
        if (!resolved.ok && resolved.code !== 'target-unresolvable') {
          observe(`governed-present anchor-post-refusal code=${String(resolved.code)} path=${entry.path}`)
          return refused('admission', resolved.code === 'target-outside-governed-root' ? 'ANCHOR-DRIFT' : String(resolved.code),
            resolved.code === 'target-outside-governed-root'
              ? 'the target escapes the governed root at resolution time; nothing is published'
              : String(resolved.detail ?? 'the target does not stand at its approved identity'))
        }
        if (resolved.ok && resolved.path !== entry.path) {
          observe(`governed-present anchor-drift lex=${entry.path} real=${resolved.path}`)
          return refused('admission', 'ANCHOR-DRIFT', 'the resolved target differs from the approved lexical target; this call is stale and publishes nothing')
        }
        const fact = probe(entry.path)
        if (!fact.ok) {
          if (fact.code === 'not-found') {
            return refused('io', 'FILE_NOT_FOUND', `Cannot present ${entry.path}: file not found. Check the path, create the file if needed, and retry.`)
          }
          if (fact.code === 'symlink' || fact.code === 'not-a-file') {
            return refused('schema', 'NOT_A_FILE', `Cannot present ${entry.path}: not a regular file`)
          }
          return refused('io', 'FILE_UNREADABLE', `Cannot present ${entry.path}: the file could not be opened (${String(fact.detail ?? fact.code)})`)
        }
        verified.push({ file: entry.file, path: entry.path, byteLength: fact.byteLength })
        observe(`governed-present PROBED path=${entry.path} bytes=${String(fact.byteLength)}`)
      }
      let receipt
      try {
        receipt = await port.present({
          files: verified.map((entry) => ({
            path: entry.path,
            ...(entry.file.description !== undefined ? { description: entry.file.description } : {}),
          })),
          callId,
          ...(presentSignal === undefined ? {} : { signal: presentSignal }),
        })
      } catch (error) {
        if (presentSignal?.aborted === true) {
          observe('governed-present aborted-in-port')
          return { kind: 'cancelled' }
        }
        const message = String(error?.message ?? error).slice(0, 240)
        observe(`governed-present port-failed detail=${message}`)
        return refused('io', 'UI_PRESENT_PORT_FAILED', `the presentation face refused the publication (${message})`, true)
      }
      const value = {
        files: verified.map((entry) => ({
          path: entry.path,
          ...(entry.file.description !== undefined ? { description: entry.file.description } : {}),
        })),
      }
      if (Number.isSafeInteger(receipt?.turn)) value.turn = receipt.turn
      observe(`governed-present RAN files=${String(value.files.length)}`)
      return { kind: 'ok', value }
    } finally {
      if (tokenKey !== undefined) {
        const prior = presentTokenLedger.get(tokenKey)
        if (prior !== undefined) prior.settled = true
      }
    }
  }
}
