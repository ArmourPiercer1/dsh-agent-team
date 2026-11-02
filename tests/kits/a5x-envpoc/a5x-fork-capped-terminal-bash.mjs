/**
 * a5x-fork-capped-terminal-bash.mjs — B2-R spike (PoC banner, disposable).
 *
 * Provenance / FORK-DECISION shape (ADR D6):
 *   upstream   : @deepseek-ai/dsh-terminal-bash @ 639ed015397290b3745d163aafe02ffee4aa3f84
 *   mechanism  : ZERO-COPY WRAP. Re-exports the native plugin's PUBLIC exports
 *                { name, inject, Config, apply } and delegates apply() to the
 *                native apply against a ctx whose sandboxPolicy is member-capped.
 *                No upstream bytes are copied or modified (D6-preferred
 *                "先继承/公开装配"; not even a fork in the copy sense).
 *   member cap : mode/workspaceRoot downgraded per session from A5X_B2R_CAPS JSON
 *                (keyed by session-id substring). Requested mode escalations
 *                (danger-full-access) are clamped: resolve() ignores request.mode.
 *   NOT production: no generation checks, no ledger, substring session keys.
 */
import { apply as nativeApply, inject, name, Config } from '../../../tests/deepseek-harness-test-use/packages/terminal/terminal-bash/lib/index.js'
import { readFileSync } from 'node:fs'

const caps = () => JSON.parse(readFileSync(process.env.A5X_B2R_CAPS ?? '{}', 'utf8'))

function capPolicy(real) {
  return {
    ...real,
    defaultMode: 'workspace-write',
    resolve(request) {
      const base = real.resolve(request)
      const table = caps()
      const raw = request?.session
      const session = typeof raw === 'string'
        ? raw
        : String(raw?.id ?? raw?.sessionId ?? raw?.label ?? (raw !== null && typeof raw === 'object' ? '' : raw))
      if (session === '') console.error(`[a5x-b2r] session ref shape: ${JSON.stringify(Object.keys(raw ?? {}))}`)
      const key = Object.keys(table).find((k) => session.includes(k))
      console.error(`[a5x-b2r] resolve session=${session || '<obj>'} key=${key ?? 'NONE'} base.mode=${base.mode} base.root=${base.workspaceRoot}`)
      if (key === undefined) return base
      const cap = table[key]
      console.error(`[a5x-b2r] CAP applied -> mode=${cap.mode} root=${cap.workspaceRoot}`)
      // Member ceiling: force mode + workspaceRoot regardless of requested mode.
      return { ...base, mode: cap.mode, workspaceRoot: cap.workspaceRoot }
    },
  }
}

function wrapCtx(ctx) {
  const capped = capPolicy(ctx.sandboxPolicy)
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'sandboxPolicy') return capped
      const value = Reflect.get(target, prop)
      if (prop === 'get' && typeof value === 'function') {
        return (serviceName) => (serviceName === 'sandboxPolicy' ? capped : value.call(target, serviceName))
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export { Config, inject, name }

export function apply(ctx, config) {
  console.error('[a5x-b2r] capped terminal-bash apply() engaged (member ceiling from A5X_B2R_CAPS)')
  return nativeApply(wrapCtx(ctx), config)
}
