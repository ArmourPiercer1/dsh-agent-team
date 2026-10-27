/**
 * process-family/src/pwsh-executor — the governed PWSH row's family BODY
 * (U7-F). The fs-family mutation-executor precedent (a family body over the
 * INJECTED authority forces, CI-06: the lane decides nothing, admits
 * nothing, mints nothing, consumes nothing by itself) composed with the
 * bash row's pipeline law (the a5p5 trio order: closed parse → derived
 * effect set → the lane verdict's deny fast path → the PA edge → backend —
 * deny BEFORE backend, every refusal a typed zero-effect fact).
 *
 * Fingerprint law (H2 P1-2, the reason this row does NOT ride the effect-set
 * fingerprint the fs rows carry): the shell-class effect set is the single
 * opaque `tool-invoke:pwsh` arm (the command text is not parsed, ever), so
 * an effect-set fingerprint would make EVERY pwsh command
 * fingerprint-identical — exactly the bug H2 closed for the shell class.
 * `parametersFingerprint` therefore binds the PARSED parameter record
 * (`canonicalJsonFingerprint(parsed)`), the same fact the bash row's
 * assembly transport binds; the durable shell rule and the approval case
 * meet the call at the SAME command.
 *
 * Coverage belt (disclosed lane law): the plane's `createLaneDecide` fast
 * paths speak the bash alias namespace (its shell belt is keyed to the
 * mounted bash row; `pwsh` is a distinct rule tool by A2C-1 — bash
 * authority != pwsh authority), so this body carries its OWN pwsh-class
 * belt BEFORE the PA edge: a deny-lane `pwsh` rule and a default-deny
 * template with no `pwsh` allow/ask rule both refuse here. The PA edge
 * remains the authority — the belt only tightens, never widens.
 *
 * @module process-family/pwsh-executor
 */
import { canonicalJsonFingerprint, parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { parseGovernedPwshArgs, renderPwshResult } from './pwsh-mechanics.mjs'

/**
 * Build the governed pwsh executor for one mount.
 *
 * @param {object} input
 * @param {string} input.realmId - the mount's realm (effect pairing key).
 * @param {string} [input.templateId]
 * @param {string} [input.instanceId]
 * @param {string} input.callIdPrefix - the mount's call-id prefix.
 * @param {(effectSet: object) => {kind: string, code?: string}} input.decide
 *   - the plane lane verdict (deny fast path).
 * @param {(paCall: object) => Promise<object>} input.pa - the Kernel's
 *   admission edge (admit → ask when required → one-shot consume, all
 *   inside; the returned `allow` IS the consumed proof).
 * @param {object} input.policy - fresh-template permission policy facts
 *   (the pwsh-class belt reads its lanes; the authority reads them again).
 * @param {{ run: (call: object, io: object) => Promise<object> }} input.backend
 *   - the pwsh effect backend (the confined backend or the typed shut face;
 *   the executor does not know which — a shut face answers its own refusal
 *   with zero spawn, which is the whole config-disabled law).
 * @param {(line: string) => void} [input.observe]
 * @returns {(raw: unknown, corr: object) => Promise<object>} the row's
 *   execute transport: `{kind:'ok', text}` | `{kind:'cancelled', text}` |
 *   `{kind:'refused', text}` — every answer model-visible text, no stack.
 */
export function createGovernedPwshExecutor({ realmId, templateId, instanceId, callIdPrefix, decide, pa, policy, backend, observe = () => {} }) {
  let seq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  // ONE correlation per host execution token for the token's whole life (the
  // fs-family token-ledger law, owned here for this row): a SETTLED token
  // re-used answers under an already-aborted signal (the PA edge settles
  // `cancelled`, zero backend, zero consumption); an IN-FLIGHT replay is
  // refused outright; a stringy token is not an identity.
  const pwshTokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const signalForSettled = (token) => {
    const cached = settledTokenSignals.get(token)
    if (cached !== undefined) return cached
    const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    settledTokenSignals.set(token, settled)
    return settled
  }
  const refused = (refusalClass, code, detail) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
  })
  // The pwsh-class belt: whole-tool rules only (the shell class carries no
  // resource lanes — A2C-1 keys the resource AT the tool name).
  const ruleNamesPwsh = (rules) => (Array.isArray(rules) ? rules : []).some((rule) => rule?.tool === 'pwsh')
  const laneDeniesPwsh = () => ruleNamesPwsh(policy?.deny)

  return async (raw, corr) => {
    const token = corr?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = pwshTokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed pwsh command')
      }
    }
    try {
      const execCorrelation = corr && typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
      const execSignal = corr && corr.signal ? corr.signal : undefined
      // ── PURE front: closed parameters. Zero FS, zero provider touch. ──
      const parsed = parseGovernedPwshArgs(raw)
      if (parsed.ok !== true) return { kind: 'refused', ...parsed.refusal, ...{ text: parsed.refusal.text } }
      const effects = [{ kind: 'tool-invoke', toolName: 'pwsh', resource: null }]
      const set = parseRequestedEffectSet(effects)
      if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
      const verdict = decide(set.value)
      if (verdict.kind === 'deny') {
        observe(`governed-pwsh lane-denied code=${String(verdict.code)}`)
        return refused('admission', String(verdict.code ?? 'template-deny-lane'), 'the template lane denies this shell-class effect')
      }
      if (laneDeniesPwsh()) {
        observe('governed-pwsh pwsh-lane-denied')
        return refused('admission', 'template-deny-lane', 'the template deny lane carries a pwsh rule; this call runs nothing')
      }
      if (policy?.default === 'deny' && !ruleNamesPwsh(policy?.allow) && !ruleNamesPwsh(policy?.ask)) {
        observe('governed-pwsh default-deny refusal')
        return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no pwsh rule covers this effect')
      }
      if (typeof pa !== 'function') {
        return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no command may run')
      }
      seq += 1
      let ledgerCorrelation
      let replaySettled = false
      if (tokenKey !== undefined) {
        const prior = pwshTokenLedger.get(tokenKey)
        if (prior !== undefined && prior.settled) {
          ledgerCorrelation = prior.correlation
          replaySettled = true
        } else {
          ledgerCorrelation = `${callIdPrefix}-pwsh-${mountNonce}-${String(seq)}`
          pwshTokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
        }
      }
      const callSignal = replaySettled && tokenKey !== undefined ? signalForSettled(tokenKey) : execSignal
      // 9e fix-1 (the bash pipeline's pre-leg): an ALREADY-aborted
      // invocation is settled `cancelled` BEFORE the PA edge — zero PA
      // touch, zero consumption, zero backend.
      if (callSignal?.aborted === true) {
        observe('governed-pwsh cancelled-before-pa-edge')
        return { kind: 'cancelled', ...renderPwshResult({ exitCode: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false }) }
      }
      const callId = ledgerCorrelation ?? execCorrelation ?? `${callIdPrefix}-pwsh-${mountNonce}-${String(seq)}`
      const gate = await pa({
        realmId,
        callId,
        // H2 law: the fingerprint binds the parsed parameter record — the
        // command IS the security-relevant field (see header).
        parametersFingerprint: canonicalJsonFingerprint(parsed.parsed),
        requestedEffects: set.value,
        ...(callSignal === undefined ? {} : { signal: callSignal }),
      })
      if (gate.kind === 'deny') {
        observe(`governed-pwsh pa-refused code=${String(gate.code)} detail=${String(gate.detail ?? '').slice(0, 240)}`)
        return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this command'))
      }
      if (gate.kind === 'allow' && gate.cancelled === true) {
        observe('governed-pwsh cancelled-at-pa-edge')
        return { kind: 'cancelled', ...renderPwshResult({ exitCode: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false }) }
      }
      // ── POST-CONSUME: the approved command runs. The backend owns every
      // execution law (resolve → probe → one-shot spawn → settle → drain). ──
      const result = await backend.run(
        {
          realmId,
          callId,
          ...(templateId === undefined ? {} : { templateId }),
          ...(instanceId === undefined ? {} : { instanceId }),
          parsedArgs: parsed.parsed,
          ...(callSignal === undefined ? {} : { signal: callSignal }),
        },
        { sink: null },
      )
      if (result.ok !== true) {
        const failure = result.failure ?? {}
        observe(`governed-pwsh backend-refused class=${String(failure.class ?? 'executor')} code=${String(failure.code ?? 'backend-failed')}`)
        return refused(String(failure.class ?? 'executor'), String(failure.code ?? 'backend-failed'), String(failure.detail ?? 'the effect backend refused the command'))
      }
      const rendered = renderPwshResult(result.outcome)
      observe(`governed-pwsh RAN exit=${String(result.outcome.exitCode ?? 'not-observed')} cancelled=${String(result.outcome.cancelled === true)} truncated=${String(result.outcome.truncated === true)}`)
      return { kind: 'ok', ...rendered, settlement: result.settlement ?? { kind: 'completed' } }
    } finally {
      if (tokenKey !== undefined) {
        const prior = pwshTokenLedger.get(tokenKey)
        if (prior !== undefined && !prior.settled) pwshTokenLedger.set(tokenKey, { correlation: prior.correlation, settled: true })
      }
    }
  }
}
