/**
 * a5x-fork-capped-v2.mjs — B2-R delta PoC wrapper (PoC banner, disposable).
 *
 * Provenance / FORK-DECISION shape (ADR D6):
 *   upstream   : @deepseek-ai/dsh-terminal-bash @ 639ed015397290b3745d163aafe02ffee4aa3f84
 *   mechanism  : ZERO-COPY WRAP of the public exports {name, inject, Config, apply};
 *                apply delegates to native apply against a ctx whose
 *                sandboxPolicy.resolve is member-capped. No upstream bytes touched.
 *   v2 deltas vs v1 (per DELTA-POC-AFTER-B2R D-BIND-01):
 *     - identity key = EXACT host-issued session id (no name substring matching)
 *     - NO fallback: an unmapped session is REFUSED (fail-closed), never base
 *     - caps carry a policy generation (gen); every resolve is logged
 *       (consulted trace) with base.mode so escalations are visible
 *   NOT production: caps table is a deployer-provided file (PoC stand-in for
 *   the TeamDomain binding); no referential integrity, no ledger.
 */
import { apply as nativeApply, inject, name, Config } from '../../../tests/deepseek-harness-test-use/packages/terminal/terminal-bash/lib/index.js'
import { readFileSync } from 'node:fs'

const caps = () => JSON.parse(readFileSync(process.env.A5X_B2R2_CAPS ?? '{}', 'utf8'))
const sidOf = (raw) => (typeof raw === 'string' ? raw : String(raw?.id ?? ''))

function capPolicy(real) {
  return {
    ...real,
    defaultMode: 'workspace-write',
    resolve(request) {
      const base = real.resolve(request)
      const session = sidOf(request?.session)
      const entry = caps()[session]
      console.error(`[b2r2] resolve sid=${session} base.mode=${base.mode} base.root=${base.workspaceRoot} mapped=${entry ? `gen${entry.gen}` : 'NONE'}`)
      if (entry === undefined) {
        // D-BIND-01: missing/mismatched mapping => fail-closed, never base.
        throw new Error(`b2r2: no member ceiling registered for session ${session} — refusing to spawn (fail-closed)`)
      }
      // Member ceiling: force mode + workspaceRoot regardless of base (incl.
      // any session 'sandbox/mode' override or approved request.mode).
      console.error(`[b2r2] CAP applied sid=${session} gen=${entry.gen} mode=${entry.mode} root=${entry.workspaceRoot}`)
      return { ...base, mode: entry.mode, workspaceRoot: entry.workspaceRoot }
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
  console.error('[b2r2] capped terminal-bash v2 apply() engaged (exact-id keys, fail-closed)')
  return nativeApply(wrapCtx(ctx), config)
}
