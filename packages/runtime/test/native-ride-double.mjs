/**
 * native-ride-double.mjs — the smallest host double that can answer ONE question: does a tool call
 * reach its BODY, or does something stop it before the body runs?
 *
 * WHY THIS EXISTS. The two 非-Team native POSITIVE controls
 * (`u6-pr3-bl01-ask-door` "non-Team native bash rides on, unchanged";
 * `u6-pr2-review-r1` "non-Team native read rides on, unchanged") used to sit inside suites built on
 * the retired execution route — `installScopedToolGuard` over the pinned scoped-registry double and
 * the Governance Center kernel. The A1 cut retired that route, so those suites were unloadable while
 * `scripts/eb3-ci-negative-controls.mjs` (P1) still demands the two assertions BY TEXT. The control
 * itself is a law about the CURRENT product — "an ordinary (non-Team) install is never narrowed" —
 * so it is re-expressed here against the seam the cut left us with: the host's own
 * `tools/pre-execute` waterfall plus `tools.guard`, with the centre either absent (the positive) or
 * installed (the negative half that proves the harness can OBSERVE a refusal, so the positive is not
 * vacuous).
 *
 * This is a test double, not a host: it registers one listener chain, calls the guard, and either
 * pushes the executed call onto `bodies` or returns the verdict. No boot, no DSH_HOME, no network —
 * it is legal in the host-free ci-security layer by construction.
 *
 * `runPre` walks the chain in order and hands each listener the real `next`, so a listener that
 * delegates (as the centre's does: `await next()` first) sees the downstream verdict exactly as the
 * host would give it.
 *
 * @param {{ names?: readonly string[] }} [options] the model-visible tool names the double claims.
 * @returns {{ctx: object, runCall: Function, bodies: readonly object[]}}
 */

export function nativeRideDouble ({ names = [] } = {}) {
  const listeners = new Map()
  const bodies = []
  let guardFn

  const tools = {
    // The host's guard seam: ONE function, ONE disposer.
    guard (fn) {
      guardFn = fn
      return () => { guardFn = undefined }
    },
    // The double registers nothing itself, so identity reads answer "no definition" — a suite that
    // needs identities supplies its own service instead of reaching through this one.
    get () { return undefined },
    schemas () { return names.map((name) => ({ name })) },
  }

  const ctx = {
    get: (service) => (service === 'tools' ? tools : undefined),
    on (event, fn) {
      const chain = listeners.get(event) ?? []
      chain.push(fn)
      listeners.set(event, chain)
      return () => {
        const rest = (listeners.get(event) ?? []).filter((entry) => entry !== fn)
        listeners.set(event, rest)
      }
    },
  }

  const runPre = async (exec, index) => {
    const chain = listeners.get('tools/pre-execute') ?? []
    const fn = chain[index]
    const next = async () => (index + 1 < chain.length ? runPre(exec, index + 1) : { kind: 'allow' })
    if (fn === undefined) return next()
    return await fn(exec, next)
  }

  /**
   * One call: the waterfall, then the guard, then the body.
   *
   * @returns {Promise<{bodies: readonly object[], verdict: object, refusal?: string}>} `bodies` holds
   *   every call that actually reached a body (0 or 1 per invocation), `verdict` is the waterfall's
   *   answer and `refusal` is the guard's reason when it stopped the call.
   */
  const runCall = async ({ callId, name, args = {} }) => {
    const exec = { name, callId, arguments: args }
    const verdict = await runPre(exec, 0)
    if (verdict === null || typeof verdict !== 'object' || verdict.kind !== 'allow') {
      return { bodies: [], verdict, refusal: undefined }
    }
    const refusal = guardFn === undefined ? undefined : guardFn(exec)
    if (refusal !== undefined && refusal !== null) return { bodies: [], verdict, refusal: String(refusal) }
    bodies.push(exec)
    return { bodies: [...bodies], verdict }
  }

  return { ctx, runCall, bodies }
}
