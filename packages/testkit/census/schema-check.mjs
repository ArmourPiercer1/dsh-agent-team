/**
 * census/schema-check — the closed-world schema validator for the U7-0
 * census artifacts (ExpectedToolObligations / AuthoritativeToolSources /
 * ObservedRuntimeInventory).
 *
 * NOT a JSON-Schema engine. The schema files in this line are written in an
 * explicitly CLOSED DESCRIPTOR SUBSET:
 *
 *   type: "object" | "array" | "string" | "number" | "integer" | "boolean"
 *   properties / required / additionalProperties: false (closed objects)
 *   patternProperties: { <regex>: schema }   (closed maps)
 *   items: schema                            (arrays)
 *   enum / const / pattern / minLength / minItems / uniqueItems
 *   nullable: true (the field may be null; absence is still governed by
 *   `required`)
 *   $ref: "#/definitions/<Name>" (one document, JSON-pointer-lite, resolved
 *   against the root schema)
 *   Top-level structural keys, exempt from the keyword check: `definitions`
 *   (the $ref target map) and `$comment` (documentation).
 *
 * Anything OUTSIDE this subset is a REFUSAL — of the schema itself, at
 * first use, not of the data later: an unknown keyword never passes
 * silently and never "validates anything" (center-assembly-architecture
 * §10.3 fail-closed: closed-world validation, unknown fields refused).
 *
 * Every violation is reported as { path, code, detail } with a JSON-pointer
 * style path, so generators and tests can assert on exact rejections.
 *
 * @module census/schema-check
 */

/** Keywords this validator implements. Any other keyword in a schema is a
 *  schema-level refusal (never a silent ignore). */
const SUPPORTED_KEYWORDS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'patternProperties',
  'items', 'enum', 'const', 'pattern', 'minLength', 'minItems', 'uniqueItems', 'nullable', '$ref',
])

/**
 * Pre-validate the schema itself against the supported subset (recursively).
 * @param {object} schema
 * @param {object} root
 * @param {string} at
 * @param {string[]} errors
 */
function checkSchema(schema, root, at, errors) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    errors.push(`${at}: schema node must be an object`)
    return
  }
  for (const key of Object.keys(schema)) {
    if (key === 'definitions' || key === '$comment') continue
    if (!SUPPORTED_KEYWORDS.has(key)) errors.push(`${at}: unsupported schema keyword "${key}"`)
  }
  if (schema.$ref !== undefined) {
    const m = /^#\/definitions\/([A-Za-z0-9_-]+)$/.exec(String(schema.$ref))
    if (m === null) errors.push(`${at}: unsupported $ref form ${JSON.stringify(schema.$ref)}`)
    else if (root.definitions?.[m[1]] === undefined) errors.push(`${at}: $ref target missing: ${schema.$ref}`)
    else checkSchema(root.definitions[m[1]], root, `${at}->$ref`, errors)
  }
  if (schema.properties !== undefined) {
    for (const [k, sub] of Object.entries(schema.properties)) checkSchema(sub, root, `${at}.properties.${k}`, errors)
  }
  if (schema.patternProperties !== undefined) {
    for (const [k, sub] of Object.entries(schema.patternProperties)) {
      try {
        new RegExp(k)
      } catch {
        errors.push(`${at}.patternProperties: invalid regex ${JSON.stringify(k)}`)
      }
      checkSchema(sub, root, `${at}.patternProperties.${k}`, errors)
    }
  }
  if (schema.items !== undefined) checkSchema(schema.items, root, `${at}.items`, errors)
  if (schema.definitions !== undefined) {
    for (const [k, sub] of Object.entries(schema.definitions)) checkSchema(sub, root, `${at}.definitions.${k}`, errors)
  }
}

const schemaCache = new Map()

/** @param {object} root schema document (validates itself once per identity) */
function ensureSchemaOk(root) {
  const cached = schemaCache.get(root)
  if (cached !== undefined) {
    if (!cached.ok) throw new Error(`schema pre-validation failed: ${cached.errors.join('; ')}`)
    return
  }
  /** @type {string[]} */
  const errors = []
  checkSchema(root, root, '$schema', errors)
  const verdict = { ok: errors.length === 0, errors }
  schemaCache.set(root, verdict)
  if (!verdict.ok) throw new Error(`schema pre-validation failed: ${errors.join('; ')}`)
}

/**
 * Validate `value` against `schema` (rooted at `root`, default `schema`).
 * @param {unknown} value
 * @param {object} schema
 * @param {object} [root]
 * @returns {{ ok: true } | { ok: false, errors: Array<{ path: string, code: string, detail: string }> }}
 */
export function validateAgainstSchema(value, schema, root = schema) {
  ensureSchemaOk(root)
  /** @type {Array<{ path: string, code: string, detail: string }>} */
  const errors = []
  const fail = (path, code, detail) => errors.push({ path, code, detail })

  const walk = (v, s, at) => {
    if (s.$ref !== undefined) {
      walk(v, root.definitions[/^#\/definitions\/([A-Za-z0-9_-]+)$/.exec(String(s.$ref))[1]], at)
      return
    }
    if (s.nullable === true && v === null) return
    if (s.type !== undefined) {
      const okType = s.type === 'object' ? (v !== null && typeof v === 'object' && !Array.isArray(v))
        : s.type === 'array' ? Array.isArray(v)
          : s.type === 'string' ? typeof v === 'string'
            : s.type === 'number' ? typeof v === 'number' && Number.isFinite(v)
              : s.type === 'integer' ? typeof v === 'number' && Number.isInteger(v)
                : s.type === 'boolean' ? typeof v === 'boolean'
                  : false
      if (!okType) {
        fail(at, 'TYPE', `expected ${String(s.type)}, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`)
        return
      }
    }
    if (s.const !== undefined && v !== s.const) fail(at, 'CONST', `expected const ${JSON.stringify(s.const)}`)
    if (s.enum !== undefined && !s.enum.includes(v)) fail(at, 'ENUM', `${JSON.stringify(v)} not in enum [${s.enum.map((e) => JSON.stringify(e)).join(', ')}]`)
    if (typeof v === 'string' && s.pattern !== undefined && !new RegExp(s.pattern).test(v)) fail(at, 'PATTERN', `${JSON.stringify(v)} does not match ${s.pattern}`)
    if (typeof v === 'string' && s.minLength !== undefined && v.length < s.minLength) fail(at, 'MIN_LENGTH', `length ${String(v.length)} < ${String(s.minLength)}`)
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) fail(at, 'MIN_ITEMS', `length ${String(v.length)} < ${String(s.minItems)}`)
      if (s.uniqueItems === true) {
        const seen = new Set()
        for (const item of v) {
          const k = JSON.stringify(item)
          if (seen.has(k)) fail(at, 'UNIQUE_ITEMS', `duplicate item ${k.slice(0, 80)}`)
          seen.add(k)
        }
      }
      if (s.items !== undefined) v.forEach((item, i) => walk(item, s.items, `${at}/${String(i)}`))
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const props = s.properties ?? {}
      const patternProps = s.patternProperties ?? {}
      for (const req of s.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(v, req)) fail(at, 'MISSING_FIELD', `required field absent: ${req}`)
      }
      if (s.additionalProperties === false) {
        for (const k of Object.keys(v)) {
          if (props[k] !== undefined) continue
          if (Object.keys(patternProps).some((re) => new RegExp(re).test(k))) continue
          fail(at, 'UNKNOWN_FIELD', `closed object rejects "${k}"`)
        }
      }
      for (const [k, sub] of Object.entries(props)) {
        if (Object.prototype.hasOwnProperty.call(v, k)) walk(v[k], sub, `${at}/${k}`)
      }
      for (const [re, sub] of Object.entries(patternProps)) {
        for (const k of Object.keys(v)) {
          if (new RegExp(re).test(k) && props[k] === undefined) walk(v[k], sub, `${at}/${k}`)
        }
      }
    }
  }
  walk(value, schema, '')
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
