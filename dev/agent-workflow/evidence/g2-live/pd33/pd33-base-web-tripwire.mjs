/**
 * tests/world-factory/drivers/a5sf-pd33-preview-e2e/pd33-base-web-tripwire.mjs —
 * the DRIVER-ONLY counter for the "base web fallback is zero" clause.
 *
 * WHAT IT DOES: when the profile's `web` service mounts, it wraps the two
 * methods on that service's PROTOTYPE (`fetch`, `search`) so every call appends
 * one JSONL entry to `config.counterPath`. The wrapper forwards the original
 * call unchanged — it decides nothing, refuses nothing, and rewrites no result.
 *
 * WHY A PROTOTYPE WRAP AND NOT A SECOND PROVIDER: `web` is already provided by
 * the composition; providing it again would be a second policy source and would
 * change what the Members see. Wrapping the inherited method is read-only
 * instrumentation of the thing whose call count is the measurement: if any
 * governed surface ever fell back to the unconfined host transport, the count
 * would be non-zero, and the `pd33:no-base-transport` case would go red.
 *
 * This module is TEST FIXTURE. It ships in no product row; the product's
 * composition (`cordis.patch.yml`) is not touched by it.
 *
 * @module tests/world-factory/drivers/a5sf-pd33-preview-e2e/pd33-base-web-tripwire
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'a5sf-pd33-base-web-tripwire'
export const inject = []

const MARK = Symbol.for('a5sf.pd33.hostWebCounter')

/** One recorded observation; a failed write must never change behaviour. */
function recorder(path) {
  return (row) => {
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`)
    } catch { /* the counters are evidence, not a control path */ }
  }
}

export function apply(ctx, config) {
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  if (counterPath === '') throw new TypeError('a5sf-pd33-base-web-tripwire: config.counterPath is required')
  const record = recorder(counterPath)
  ctx.inject(['web'], (webCtx) => {
    const base = webCtx.web
    if (base === undefined || base === null) return
    const ctor = Object.getPrototypeOf(base)?.constructor
    const proto = ctor?.prototype
    if (typeof proto !== 'object' || proto === null) return
    if (proto[MARK] === true) return
    for (const method of ['fetch', 'search']) {
      const original = proto[method]
      if (typeof original !== 'function') continue
      Object.defineProperty(proto, method, {
        configurable: true,
        writable: true,
        value: function countedHostWeb(...args) {
          record({ leg: 'host-web-call', method, note: 'the INHERITED host web service was consulted' })
          return original.apply(this, args)
        },
      })
    }
    Object.defineProperty(proto, MARK, { configurable: true, writable: true, value: true })
    record({ leg: 'host-web-counter-installed', baseCtor: String(ctor?.name ?? '?') })
  })
}

export default apply
