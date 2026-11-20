/**
 * probe-confined-continuation.mjs — a TEST-ONLY Cordis module used by
 * `product-route-image.test.mjs` to interrogate the service a routed module's
 * DEFERRED child actually resolves.
 *
 * It is not a tool and registers nothing: it declares the same dependency set a
 * filesystem tool module declares (`tools`, `fs`) and, in a deferred
 * `ctx.inject(['attachments'], …)` continuation, records
 *
 *   - whether `child.fs` resolves at all (the continuation the repair added);
 *   - what that `fs` DOES: it resolves and `stat`s an IN-LANE target (the
 *     confined provider serves it) and then the SAME operations on an
 *     OUT-OF-LANE target (the confined provider's lane refuses it). A base
 *     provider, by contrast, serves both — the `unconfined-fs` mutation arm in
 *     the suite measures exactly that on the same path.
 *
 * It deliberately does NOT compare object/class identity: Cordis hands out a
 * fresh context-bound proxy per service access (measured:
 * `member.ctx.get('fs') !== member.fs`, and the proxy's `.constructor` is a
 * proxy artifact, not either provider class), so identity comparison would be a
 * false claim. Confinement is established by BEHAVIOUR here, plus the guard
 * facts' realm/member identity recorded by the suite.
 *
 * @module tests/ute-g1-fs/lib/probe-confined-continuation
 */

export const name = 'ute3-probe-confined-continuation'

/** The same service set `@deepseek-ai/dsh-tool-fs` declares. */
export const inject = ['tools', 'fs']

/**
 * @param {object} ctx
 * @param {{observation: object, insidePath: string, outsidePath: string}} config
 */
export function apply(ctx, config) {
  const observation = config?.observation ?? {}
  ctx.inject(['attachments'], async (child) => {
    try {
      const face = child.fs
      observation.resolved = true
      const inside = await face.resolve(config.insidePath)
      const insideInfo = await face.stat(inside)
      observation.insideStat = insideInfo === undefined ? 'absent' : (insideInfo.type ?? 'present')
      const outside = await face.resolve(config.outsidePath)
      try {
        await face.stat(outside)
        observation.outsideStat = 'allowed'
      } catch (error) {
        observation.outsideStat = 'refused'
        observation.outsideRefusal = String(error?.message ?? error)
      }
    } catch (error) {
      observation.resolved = false
      observation.error = String(error?.message ?? error)
    }
  })
}
