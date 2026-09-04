// S8 helper — Node loader hook for s8-validate: intercept .css imports of
// the real upstream ui-primitives ESM and serve an identity class-map
// module (CSS-module identity semantics for class-name-only classes).
// Everything else passes through to the default loader.
export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    const source =
      'const map = new Proxy({}, { get: (t, p) => (typeof p === "string" ? p : "") });\n' +
      'export default map;\n'
    return { format: 'module', source, shortCircuit: true }
  }
  return nextLoad(url, context)
}
