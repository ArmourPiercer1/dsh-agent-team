/**
 * binding.mjs — the prototype's Native Binding: route C over PUBLIC seams.
 *
 * The binding does exactly what the legacy governed route does structurally —
 * isolate the `fs` service for the scope, provide a confined implementation,
 * and mount the host's own native `tool-fs` module onto that scope — but it
 * does so with the NEXT host's published entries only:
 *
 *   1. `ctx.isolate('fs')`            — the public Cordis scope primitive
 *   2. `iso.plugin(ConfinedProvider)` — provides `fs` inside the isolated scope
 *   3. `iso.plugin(nativeToolFs)`     — the REAL host module registers
 *                                       `read` / `write` / `edit`
 *
 * No ToolPlane, no Family Body, no Team runtime code: the definitions, schemas,
 * rendering, read windows and mutation mechanics are the host's. The ONLY added
 * decision is the confined provider's declared lane (prototype-provider.mjs).
 *
 * @module tests/ute-g1-fs/lib/binding
 */
import { makeConfinedFileSystemClass } from './prototype-provider.mjs'

/**
 * Mount the prototype's confined FS binding on a context.
 *
 * @param {object} input
 * @param {import('@deepseek-ai/cordis').Context} input.ctx - root test context
 *   that already carries the host's prerequisite services.
 * @param {{read: readonly string[], write: readonly string[]}} input.lane -
 *   declared lane (absolute canonical roots).
 * @param {object} input.host - the loaded host surface (`loadHostSurface`).
 * @param {string} input.cwd - provider base for relative paths (the world dir).
 * @param {(fact: object) => void} [input.record] - lane decision recorder.
 * @returns {Promise<{iso: object, provider: object, fibers: object[], providerClass: Function}>}
 */
export async function installNativeFsBinding({ ctx, lane, host, cwd, record }) {
  if (ctx === undefined || typeof ctx.isolate !== 'function') {
    throw new TypeError('installNativeFsBinding: a host Context with isolate() is required')
  }
  const Confined = makeConfinedFileSystemClass(host.LocalFileSystem, {
    lane,
    FsError: host.FsError,
    record,
  })

  // The isolated scope: everything below it resolves `fs` to the confined
  // provider, and the parent context keeps the preset provider untouched.
  const iso = ctx.isolate('fs')
  const providerFiber = await iso.plugin(Confined, { cwd })
  // The REAL native module, on the confined scope. `applyPatch` stays false:
  // the default surface of the FS family is read/write/edit and the prototype
  // must not widen the model-facing surface it is being compared on.
  const toolFiber = await iso.plugin(host.toolFs, { applyPatch: false })

  return Object.freeze({
    iso,
    provider: iso.get('fs'),
    providerClass: Confined,
    fibers: Object.freeze([providerFiber, toolFiber]),
  })
}
