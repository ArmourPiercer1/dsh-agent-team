/**
 * inspect-family/src/inspect-mechanics.mjs — the governed inspect rows' PURE
 * law (provider-directory lookup + input-schema pre-validation).
 *
 * Inspect is READ-ONLY RUNTIME INTROSPECTION, never a business Service:
 * these rows answer ONLY from the host's public `cordisInspect` registry
 * face (the same public seam the native `cordis_inspect_*` tools execute
 * through, tool-cordis/src/index.ts @639ed01539). Unknown provider / method
 * / input is refused HERE, before any dispatch, with the available choices
 * stated — the row never guesses, never falls back, and never dispatches a
 * method the directory does not declare.
 *
 * @module inspect-family/inspect-mechanics
 */

/** The outer bound of ONE governed inspect query (the row's own settle-race
 *  budget, layered above the host registry's own client timeout — a hung
 *  host path can never hold the row past this bound). */
export const INSPECT_QUERY_BUDGET_MS = 30_000

/** The read-only metadata locator namespace both rows declare. */
export const INSPECT_DIRECTORY_LOCATOR = 'cordis-inspect/providers'

const SEGMENT_RX = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isSafeLocatorSegment(value) {
  return typeof value === 'string' && SEGMENT_RX.test(value) && !value.includes('..')
}

export function inspectMethodLocator(platform, providerId, methodName) {
  return `cordis-inspect/${platform}/${providerId}/${methodName}`
}

/** Directory lookup: the provider for (platform, id), or the available ids. */
export function findProvider(listed, platform, providerId) {
  const providers = Array.isArray(listed) ? listed : []
  const onPlatform = providers.filter((p) => p?.platform === platform)
  const hit = onPlatform.find((p) => p?.id === providerId)
  if (hit !== undefined) return { ok: true, provider: hit }
  return {
    ok: false,
    code: 'inspect-provider-unknown',
    detail: `inspect provider "${providerId}" is not registered on platform "${platform}". Available: ${
      onPlatform.map((p) => String(p?.id ?? '?')).join(', ') || '(none)'
    } — call team_cordis_inspect_list and use an exact id; do not guess.`,
  }
}

/** Method lookup inside a provider view, or the available method names. */
export function findMethod(provider, methodName) {
  const methods = Array.isArray(provider?.methods) ? provider.methods : []
  const hit = methods.find((m) => m?.name === methodName)
  if (hit !== undefined) return { ok: true, method: hit }
  return {
    ok: false,
    code: 'inspect-method-unknown',
    detail: `inspect method "${methodName}" is not declared by provider "${String(provider?.id ?? '?')}". Available: ${
      methods.map((m) => String(m?.name ?? '?')).join(', ') || '(none)'
    } — an Inspect method is never guessed and never a business Service call.`,
  }
}

/**
 * Closed-subset JSON-schema validation (fail closed): validates against the
 * same closed keyword subset the host registry itself supports; ANY keyword
 * this row cannot verify makes the whole call a typed refusal BEFORE
 * dispatch — an unverifiable contract is never waved through.
 */
export function validateInputSubset(schema, value, pathLabel = 'input') {
  const problems = []
  const walk = (node, value, path) => {
    if (node === null || node === undefined || typeof node !== 'object') {
      problems.push(`${path}: schema node is not an object — the row refuses an unverifiable contract`)
      return
    }
    if (node.const !== undefined && !deepEqual(node.const, value)) {
      problems.push(`${path}: must equal the declared const`)
      return
    }
    if (Array.isArray(node.enum)) {
      if (!node.enum.some((choice) => deepEqual(choice, value))) {
        problems.push(`${path}: must be one of the declared enum`)
      }
      return
    }
    const type = node.type
    switch (type) {
      case undefined:
        break
      case 'object': {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) { problems.push(`${path}: must be an object`); return }
        for (const required of Array.isArray(node.required) ? node.required : []) {
          if (!Object.prototype.hasOwnProperty.call(value, required)) problems.push(`${path}.${required}: required property missing`)
        }
        const props = node.properties !== null && typeof node.properties === 'object' ? node.properties : {}
        for (const [key, child] of Object.entries(value)) {
          if (props[key] !== undefined) walk(props[key], child, `${path}.${key}`)
          else if (node.additionalProperties === false) problems.push(`${path}.${key}: additional property is not allowed`)
        }
        return
      }
      case 'array': {
        if (!Array.isArray(value)) { problems.push(`${path}: must be an array`); return }
        if (node.items !== undefined) value.forEach((item, i) => walk(node.items, item, `${path}[${String(i)}]`))
        return
      }
      case 'string': if (typeof value !== 'string') problems.push(`${path}: must be a string`); return
      case 'number': if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${path}: must be a number`); return
      case 'integer': if (!Number.isInteger(value)) problems.push(`${path}: must be an integer`); return
      case 'boolean': if (typeof value !== 'boolean') problems.push(`${path}: must be a boolean`); return
      case 'null': if (value !== null) problems.push(`${path}: must be null`); return
      default: problems.push(`${path}: schema type "${String(type)}" is outside the closed subset the row can verify`)
    }
  }
  if (schema !== undefined && schema !== null) walk(schema, value, pathLabel)
  return problems
}

function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
  }
  return false
}
