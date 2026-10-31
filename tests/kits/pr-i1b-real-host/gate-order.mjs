/**
 * Alpha.6 PR-I1b (Lane 2) — the resolve-path GATE-ORDER measurement, ONE implementation for two readers.
 *
 * `tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs` runs this on every kit run; the merge-gate spec
 * `packages/runtime/test/a6-pr-i1b-admission.test.ts` re-runs the SAME function against the lane tree at
 * READ time (round 3 of #522, F-I1b3-3: the order was MEASURED at kit time but only ASSERTED from the
 * capture at read time, so a source reorder that skipped a kit re-run shipped green). Sharing one function
 * is the point — if the spec carried its own copy, agreement between two texts that can drift would prove
 * nothing; identical code reading identical bytes is what makes the read-time leg a measurement.
 *
 * THE ORDER IT MEASURES (round 2 of #522, F-I1b2-2 — the lane may no longer state it either way from
 * prose). Inside `resolveControl`, in the source that was built into the row the kit boots:
 *   - `const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind]` + the CONTROL_RESOLVER_NOT_AUTHORIZED
 *     throw  →  the role closure (host's own comment: "Role closure (BEFORE the envelope — invariant 37 …)");
 *   - `enforceEnvelope(RESOLVE_CONTROL_SPEC, …)`  →  the envelope gate (its refusal is the
 *     `TeamRuntime: operation 'resolve-control' … outside the caller's mutation envelope` message from
 *     admission/envelope.ts).
 * This function reads the text, scopes to the `resolveControl` body, and MEASURES: exactly one closure
 * marker, exactly one envelope call, the envelope call after the closure check, nothing envelope-shaped
 * before it. When this holds, a cell whose visible refusal is the envelope gate's proves the closure RAN
 * FIRST and AGREED. When it does not hold, envelope cells classify as `unclassified` and the run says so —
 * fail-closed.
 */

/**
 * @param {string} src the full text of `packages/runtime/control/service.ts` as the caller reads it now.
 * @returns {{ ok: boolean, closureLine: number | null, envelopeLine: number | null, measured: string }}
 */
export function measureResolvePathGateOrder(src) {
  const fnStart = src.indexOf('async function resolveControl(')
  const fnEnd = src.indexOf('async function commitAbandonmentFact(', fnStart + 1)
  const body = fnStart >= 0 && fnEnd > fnStart ? src.slice(fnStart, fnEnd) : ''
  const closureMarker = 'const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind]'
  const closureCount = body.split(closureMarker).length - 1
  const envCalls = [...body.matchAll(/enforceEnvelope\(\s*RESOLVE_CONTROL_SPEC/g)].length
  const anyEnforce = body.split('enforceEnvelope(').length - 1
  const closureAt = body.indexOf(closureMarker)
  const envAt = body.search(/enforceEnvelope\(\s*RESOLVE_CONTROL_SPEC/)
  const ok = closureCount === 1 && envCalls === 1 && anyEnforce === 1
    && closureAt >= 0 && envAt > closureAt
    && !body.slice(0, closureAt).includes('enforceEnvelope(')
  const lineOf = (idx) => src.slice(0, fnStart + idx).split('\n').length
  return {
    ok,
    closureLine: closureAt >= 0 ? lineOf(closureAt) : null,
    envelopeLine: envAt >= 0 ? lineOf(envAt) : null,
    measured: `resolveControl in packages/runtime/control/service.ts: closure check :${closureAt >= 0 ? lineOf(closureAt) : '?'} `
      + `precedes enforceEnvelope(RESOLVE_CONTROL_SPEC) :${envAt >= 0 ? lineOf(envAt) : '?'}, `
      + `exactly one envelope call in the function and none before the closure check `
      + `(closure markers=${closureCount}, envelope calls=${anyEnforce})`,
  }
}
