/**
 * Resolve hook for composition-smoke (registered via `module.register`).
 *
 * Maps static asset imports (CSS, images, fonts) in the built client entry's
 * module graph to an inert default-exporting module, so the graph loads
 * under plain node. Browsers and bundlers give these files meaning; node
 * has none of that machinery, and the smoke only needs the graph to LOAD
 * (component render functions never execute during import).
 */
const ASSET = /\.(?:css|svg|png|jpe?g|gif|webp|ico|woff2?|ttf)$/i
const INERT = 'data:text/javascript,export default {}'

export async function resolve(specifier, context, next) {
  if (ASSET.test(specifier)) {
    return { url: INERT, shortCircuit: true }
  }
  return next(specifier, context)
}
