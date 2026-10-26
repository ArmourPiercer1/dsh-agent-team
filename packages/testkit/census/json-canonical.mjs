/**
 * census/json-canonical — deterministic JSON canonicalization + digests for
 * the U7-0 dynamic tool census (EB2-A).
 *
 * WHY THIS EXISTS: the census's whole authority chain is digests — the
 * ExpectedToolObligations artifact must be byte-reproducible from tracked
 * sources, the ObservedRuntimeInventory snapshot must hash the SAME over the
 * same facts regardless of key insertion order, and the reconcile verdict
 * needs a stable digest to pin. `JSON.stringify` alone is insertion-order
 * dependent; this file is the ONE canonicalization the whole line shares.
 *
 * Law:
 *  - keys sorted (UTF-16 code-unit order on the key string, `localeCompare`
 *    is locale-dependent and therefore BANNED here);
 *  - numbers must be finite (NaN/Infinity are refusals, never silent nulls);
 *  - no undefined: a caller that wants a field absent must delete it first
 *    (canonicalize throws — an implicit drop is how a census silently loses
 *    a column);
 *  - LF newlines are not produced: canonical form is single-line;
 *  - the digest is `sha256:<hex>` over the canonical UTF-8 bytes, prefixed
 *    so a digest can never be confused with a bare hash of other bytes.
 *
 * Pure module: no node: builtins except node:crypto (the same allowance the
 * fault-injection scanner precedent established for `.mjs` helpers).
 *
 * @module census/json-canonical
 */
import { createHash } from 'node:crypto'

/** @param {unknown} value */
function canonicalizeValue(value, path) {
  if (value === null) return 'null'
  if (value === undefined) throw new Error(`canonicalize: undefined at ${path} (delete the field instead)`)
  const t = typeof value
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new Error(`canonicalize: non-finite number at ${path}`)
    return JSON.stringify(value)
  }
  if (t === 'string' || t === 'boolean') return JSON.stringify(value)
  if (t === 'bigint') throw new Error(`canonicalize: bigint at ${path} (encode as string)`)
  if (t === 'function' || t === 'symbol') throw new Error(`canonicalize: ${t} at ${path} (functions are not facts)`)
  if (Array.isArray(value)) {
    return `[${value.map((item, i) => canonicalizeValue(item, `${path}[${String(i)}]`)).join(',')}]`
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort()
    const parts = []
    for (const key of keys) {
      const encoded = canonicalizeValue(value[key], `${path}.${key}`)
      parts.push(`${JSON.stringify(key)}:${encoded}`)
    }
    return `{${parts.join(',')}}`
  }
  throw new Error(`canonicalize: unsupported type ${t} at ${path}`)
}

/**
 * The canonical single-line JSON text of `value` (see module header law).
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return canonicalizeValue(value, '$')
}

/**
 * `sha256:<hex>` over the canonical UTF-8 bytes of `value`.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

/**
 * `sha256:<hex>` over raw bytes (UTF-8 string or Buffer) — for file-level
 * pins where the file bytes themselves are the fact (no canonicalization).
 * @param {string | Uint8Array} bytes
 * @returns {string}
 */
export function bytesDigest(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/**
 * Stable digest of the schema-visible face of one ToolDefinition shape.
 * The census law (§10.4, CI-04): a Definition's identity is its in-process
 * placement identity (WeakMap algebra), which is per-boot and NEVER
 * comparable across boots; what IS comparable across boots is the
 * MODEL-FACING CONTRACT (name/description/parameters/output schema). The
 * shape digest is what DRIFT 'definition-shape' compares.
 * @param {{ name?: unknown, description?: unknown, parameters?: unknown, outputSchema?: unknown, timeoutMsPresent?: unknown }} face
 * @returns {string}
 */
export function definitionShapeDigest(face) {
  return canonicalDigest({
    kind: 'u7-0/definition-shape/v1',
    name: face.name ?? null,
    description: face.description ?? null,
    parameters: face.parameters ?? null,
    outputSchema: face.outputSchema ?? null,
    timeoutMsPresent: face.timeoutMsPresent === true,
  })
}
