/**
 * Era lifecycle shapes extracted so the launcher's failure semantics are
 * importable and testable WITHOUT running the real launcher:
 *   - raceBoot: fail FAST on boot timeout / async spawn error / early exit,
 *     by THROWING into the caller's finally (process.exit is banned inside
 *     the owned-resource scope: it skips finally and orphans the child and
 *     its listener).
 *   - runEraLoop: an era that THROWS, or whose stop was not positively
 *     confirmed, never opens a next era (fail-closed; lifecycle facts of
 *     the failed era are preserved on the result entry).
 *   - consumeOnceSecret: a one-time secret handed to a use-function is
 *     nulled in a finally - even when the use throws (a failed
 *     authenticate must not leave the boot token sitting on the object).
 * @module dev-runs/kit-lifecycle
 */

/** @param message - rejection reason. @returns rejected promise factory */
export function raceBoot({ bootSeen, errorSeen, exitSeen, budgetMs, label }) {
  return Promise.race([
    bootSeen,
    errorSeen.then((err) => { throw new Error(`${label}: async spawn error: ${String(err?.message ?? err).slice(0, 200)}`) }),
    exitSeen.then((code) => { throw new Error(`${label}: child exited (code=${String(code)}) before printing the boot marker`) }),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label}: boot marker never appeared within ${budgetMs}ms (throwing into the era finally - no exit bypass)`)), budgetMs)),
  ])
}

/**
 * @param eras - ordered era ids.
 * @param runFn - async era runner; MUST keep its own finally (stop+drain) and attach
 *   `entry.stop = { ok, ... }` onto the object handed to `lifecycle` when it finishes.
 * @param onEraError - record an era-level throw.
 * @param onHalt - record why the loop halted on an unproven stop.
 * @returns results map (throws propagate NO further than the halt decision).
 */
export async function runEraLoop({ eras, runFn, onEraError, onHalt }) {
  const results = {}
  for (const era of eras) {
    const lifecycle = {}
    try {
      results[era] = await runFn(era, lifecycle)
    } catch (eraError) {
      const entry = results[era] ?? lifecycle
      entry.era = era
      entry.ok = false
      entry.eraError = String(eraError?.message ?? eraError).slice(0, 900)
      if (results[era] === undefined) results[era] = entry
      onEraError(era, entry)
      onHalt(era, 'era threw (lifecycle facts preserved); halting fail-closed - no next era without a positively confirmed stop')
      break
    }
    if (results[era]?.stop?.ok !== true) {
      onHalt(era, results[era]?.stop
        ? `stop not proven (${results[era].stop.reasons ? results[era].stop.reasons.join('; ') : 'ok!=true'}); halting - no next era on an unproven stop`
        : 'no positive confirmed stop recorded; halting fail-closed')
      break
    }
  }
  return results
}

/** Hand obj[key] to fn exactly once; null it out in a finally even if fn throws. */
export async function consumeOnceSecret(obj, key, fn) {
  try {
    return await fn(obj[key])
  } finally {
    obj[key] = null
  }
}
