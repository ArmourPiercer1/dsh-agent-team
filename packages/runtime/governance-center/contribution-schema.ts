/**
 * `governance-center/contribution-schema` — the CLOSED-WORLD Family
 * Contribution schema (U6 PR1; center-assembly-architecture §4 "six
 * boundaries" + §10.3 "Contribution schema, version negotiation and failure
 * isolation"; U6-SLICE-PLAN PR1 "Content").
 *
 * WHAT THIS FILE IS. Every Family that later registers with the
 * GovernedFamilyRegistry carries ONE contribution descriptor covering the
 * §4 boundaries: Source & Visibility, Definition & Arguments, Effects &
 * Constraints, Execution, Lifecycle(+cancel), Result — plus the fixed
 * `obligations` block that states, as data, WHICH authorities stay kernel-side
 * (admission, grant mint, grant consume). This validator is the single
 * fail-closed gate every registration passes: §10.3 — "unknown fields,
 * duplicate ID, invalid digest, unknown required capability, type mismatch or
 * an unsupported version all fail closed; unknown fields must not be ignored".
 *
 * CLOSED WORLD, BY CONSTRUCTION: every object this schema accepts is checked
 * key-by-key against a fixed key set, at every nesting level (`readClosed`).
 * An unlisted key is a refusal, never a silent drop — the only way
 * "unknown field" can be answered fail-closed without a second reader that
 * might ignore what this one rejected.
 *
 * SELF-APPROVAL IS UNEXPRESSABLE (§ CI-06): the `obligations` block is data
 * the KERNEL reads to confirm WHERE the authority lives; every value must be
 * the literal `'kernel'`. A Family that declares itself owning admission,
 * grant mint or grant consume — or a lifecycle it owns — is refused with the
 * dedicated `FAMILY_SELF_APPROVAL_FORBIDDEN` code, so an approval-attempt is
 * a visible, typed event in the registration ledger, never a shape that
 * parses. There is deliberately no field that could carry a grant, an
 * approval, or a permission: `readClosed` refuses such keys as UNKNOWN_FIELD.
 *
 * NO EXECUTION, NO CLOCKS, NO I/O: pure validation over plain data. Digest
 * fields are validated by SHAPE (64 lowercase hex — the digest law of the
 * durable lanes); the digest of what a contribution CLAIMS to bind is
 * computed by the registering side, never here.
 *
 * @module governance-center/contribution-schema
 */

/** The schema-generation this validator accepts (§10.3 major-version law). */
export const CONTRIBUTION_SCHEMA_MAJOR = 1

/** A failure code is part of the registration ledger vocabulary: stable. */
export type ContributionFailureCode =
  | 'CONTRIBUTION_NOT_OBJECT'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'BAD_TYPE'
  | 'BAD_VALUE'
  | 'BAD_ID'
  | 'BAD_NAME'
  | 'BAD_DIGEST'
  | 'NAME_ALIAS_COLLISION'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'FAMILY_SELF_APPROVAL_FORBIDDEN'
  | 'EFFECTS_WITHOUT_EXECUTION'
  | 'NAMED_BRIDGE_REQUIRED'
  | 'LIFECYCLE_OWNER_REQUIRED'
  | 'CAPABILITY_UNKNOWN'
  | 'CAPABILITY_UNBACKED'

export type ContributionValidation =
  | { readonly ok: true; readonly contribution: FrozenContribution }
  | { readonly ok: false; readonly code: ContributionFailureCode; readonly path: string; readonly detail: string }

/** One entry of the Kernel's versioned capability manifest (§10.3). */
export type KernelCapability = {
  /**
   * Which execution shape actually backs this capability. A required
   * capability whose backing the contribution does not declare is a refusal
   * (`CAPABILITY_UNBACKED`) — "a capability not backed by a declared real
   * execution path" from the U6-SLICE-PLAN PR1 negative matrix.
   */
  readonly backsExecution?: 'family-body' | 'named-bridge'
}

export type KernelCapabilityManifest = {
  readonly capabilities: Readonly<Record<string, KernelCapability>>
}

export type ContributionVersion = {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

export type FamilyContributionInput = {
  readonly schemaVersion: ContributionVersion
  readonly familyId: string
  readonly familyVersion: string
  readonly source: {
    readonly kind: 'family-owned' | 'provider-backed'
    readonly selector: string
    readonly digest: string
  }
  readonly provider: { readonly id: string; readonly digest: string }
  readonly requiredCapabilities: readonly string[]
  readonly optionalCapabilities: readonly string[]
  readonly visibility: {
    readonly owner: 'family'
    readonly nativeNames: readonly string[]
    readonly aliases: readonly string[]
    readonly profileRequirements: readonly string[]
  }
  readonly definition: {
    readonly owner: 'family'
    readonly inputContractDigest: string
    readonly outputContractDigest: string
    readonly normalization: 'pure'
  }
  readonly effects: {
    readonly declared: boolean
    readonly kinds: readonly string[]
    readonly targets: readonly string[]
  }
  readonly execution: {
    readonly declared: boolean
    readonly via: 'family-body' | 'named-bridge'
    readonly bridgeId?: string
  }
  readonly lifecycle: {
    readonly owner: 'kernel'
    readonly drain: 'kernel-owned'
    readonly cancelBoundary: string
  }
  readonly result: {
    readonly envelope: 'host'
    readonly correlation: 'kernel'
  }
  readonly obligations: {
    readonly admission: 'kernel'
    readonly grantMint: 'kernel'
    readonly grantConsume: 'kernel'
  }
}

export type FrozenContribution = FamilyContributionInput

const DIGEST_RE = /^[0-9a-f]{64}$/
const FAMILY_ID_RE = /^[a-z][a-z0-9._-]{0,63}$/
const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/

/** Closed key sets per nesting level — the ONE source of the closed world. */
const TOP_KEYS = [
  'schemaVersion', 'familyId', 'familyVersion', 'source', 'provider',
  'requiredCapabilities', 'optionalCapabilities',
  'visibility', 'definition', 'effects', 'execution', 'lifecycle', 'result', 'obligations',
] as const
const VERSION_KEYS = ['major', 'minor', 'patch'] as const
const SOURCE_KEYS = ['kind', 'selector', 'digest'] as const
const PROVIDER_KEYS = ['id', 'digest'] as const
const VISIBILITY_KEYS = ['owner', 'nativeNames', 'aliases', 'profileRequirements'] as const
const DEFINITION_KEYS = ['owner', 'inputContractDigest', 'outputContractDigest', 'normalization'] as const
const EFFECTS_KEYS = ['declared', 'kinds', 'targets'] as const
const EXECUTION_KEYS = ['declared', 'via', 'bridgeId'] as const
const LIFECYCLE_KEYS = ['owner', 'drain', 'cancelBoundary'] as const
const RESULT_KEYS = ['envelope', 'correlation'] as const
const OBLIGATIONS_KEYS = ['admission', 'grantMint', 'grantConsume'] as const

/**
 * The reader protocol is a discriminated union on purpose: a refusal is
 * `{ ok: false, code, path, detail }` and nothing else can carry `code`, so
 * every `if (x.ok === false) return x.failure` below narrows for TypeScript
 * as tightly as it narrows for the reader. (An earlier shape wrapped the
 * failure in a `{ ok: false, failure }` box; the box satisfied neither
 * narrowing nor the return type, and was retired.)
 */
type Refusal = { readonly ok: false; readonly code: ContributionFailureCode; readonly path: string; readonly detail: string }
type Of<T> = { readonly ok: true; readonly value: T } | Refusal
type Reader = {
  /** Read one closed object: exact key-set membership, then the fields. */
  readonly closed: (path: string, value: unknown, keys: readonly string[]) => Of<Record<string, unknown>>
  readonly str: (path: string, value: unknown) => Of<string>
  readonly id: (path: string, value: unknown, re: RegExp, shape: string) => Of<string>
  readonly digest: (path: string, value: unknown) => Of<string>
  readonly bool: (path: string, value: unknown) => Of<boolean>
  readonly lit: (path: string, value: unknown, allowed: readonly string[]) => Of<string>
  readonly strList: (path: string, value: unknown, opts?: { readonly allowEmpty?: boolean }) => Of<readonly string[]>
  readonly int: (path: string, value: unknown) => Of<number>
}

const r = (code: ContributionFailureCode, path: string, detail: string): Refusal => ({
  ok: false,
  code,
  path,
  detail,
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const reader: Reader = {
  closed(path, value, keys) {
    if (!isPlainObject(value)) return r('MISSING_FIELD', path, 'expected a closed object')
    const known = new Set<string>(keys)
    for (const key of Object.keys(value)) {
      if (!known.has(key)) {
        // §10.3: an unknown field is a refusal, not something to ignore.
        return r('UNKNOWN_FIELD', `${path}.${key}`, `not part of the closed ${path} shape`)
      }
    }
    return { ok: true, value }
  },
  str(path, value) {
    if (typeof value !== 'string') return r('BAD_TYPE', path, `expected a string, got ${typeof value}`)
    if (value.length === 0) return r('BAD_VALUE', path, 'must be non-empty')
    return { ok: true, value }
  },
  id(path, value, re, shape) {
    const s = reader.str(path, value)
    if (s.ok === false) return s
    if (!re.test(s.value)) return r('BAD_ID', path, `must match ${shape}`)
    return s
  },
  digest(path, value) {
    const s = reader.str(path, value)
    if (s.ok === false) return s
    if (!DIGEST_RE.test(s.value)) return r('BAD_DIGEST', path, 'must be 64 lowercase hex characters (sha256)')
    return s
  },
  bool(path, value) {
    if (typeof value !== 'boolean') return r('BAD_TYPE', path, `expected a boolean, got ${typeof value}`)
    return { ok: true, value }
  },
  lit(path, value, allowed) {
    const s = reader.str(path, value)
    if (s.ok === false) return s
    if (!allowed.includes(s.value)) return r('BAD_VALUE', path, `must be one of ${allowed.join('|')}`)
    return s
  },
  strList(path, value, opts) {
    if (!Array.isArray(value)) return r('BAD_TYPE', path, 'expected an array of strings')
    const out: string[] = []
    for (const [i, item] of value.entries()) {
      const s = reader.str(`${path}[${String(i)}]`, item)
      if (s.ok === false) return s
      if (out.includes(s.value)) return r('BAD_VALUE', `${path}[${String(i)}]`, 'duplicate entry')
      out.push(s.value)
    }
    if (out.length === 0 && opts?.allowEmpty === false) return r('BAD_VALUE', path, 'must not be empty')
    return { ok: true, value: out }
  },
  int(path, value) {
    if (typeof value !== 'number' || !Number.isInteger(value)) return r('BAD_TYPE', path, 'expected an integer')
    return { ok: true, value }
  },
}

/**
 * Validate one contribution descriptor (§4 boundaries, §10.3 failure law).
 * `manifest` is the Kernel's PUBLISHED capability list — a required or
 * optional capability that the Kernel never published is a refusal, so the
 * capability negotiation is always against the center's real face, never
 * against a Family-authored list.
 */
export function validateFamilyContribution(
  input: unknown,
  manifest: KernelCapabilityManifest,
): ContributionValidation {
  const topR = reader.closed('$', input, TOP_KEYS)
  if (topR.ok === false) return topR
  const top = topR.value

  // ── version (§10.3: unsupported version fails closed) ────────────────────
  const versionR = reader.closed('$.schemaVersion', top['schemaVersion'], VERSION_KEYS)
  if (versionR.ok === false) return versionR
  const version = versionR.value
  const majorR = reader.int('$.schemaVersion.major', version['major'])
  if (majorR.ok === false) return majorR
  const minorR = reader.int('$.schemaVersion.minor', version['minor'])
  if (minorR.ok === false) return minorR
  const patchR = reader.int('$.schemaVersion.patch', version['patch'])
  if (patchR.ok === false) return patchR
  const major = majorR.value
  const minor = minorR.value
  const patch = patchR.value
  if (major < 0 || minor < 0 || patch < 0) return r('BAD_VALUE', '$.schemaVersion', 'components must be >= 0')
  if (major !== CONTRIBUTION_SCHEMA_MAJOR) {
    return r('UNSUPPORTED_SCHEMA_VERSION', '$.schemaVersion.major', `only major ${String(CONTRIBUTION_SCHEMA_MAJOR)} is accepted by this center; explicit migration is required`)
  }

  const familyIdR = reader.id('$.familyId', top['familyId'], FAMILY_ID_RE, '^[a-z][a-z0-9._-]{0,63}$')
  if (familyIdR.ok === false) return familyIdR
  const familyVersionR = reader.str('$.familyVersion', top['familyVersion'])
  if (familyVersionR.ok === false) return familyVersionR

  // ── source + provider identity (§10.4 shape; digests are shape-checked) ──
  const sourceR = reader.closed('$.source', top['source'], SOURCE_KEYS)
  if (sourceR.ok === false) return sourceR
  const source = sourceR.value
  const sourceKindR = reader.lit('$.source.kind', source['kind'], ['family-owned', 'provider-backed'])
  if (sourceKindR.ok === false) return sourceKindR
  const sourceSelectorR = reader.str('$.source.selector', source['selector'])
  if (sourceSelectorR.ok === false) return sourceSelectorR
  const sourceDigestR = reader.digest('$.source.digest', source['digest'])
  if (sourceDigestR.ok === false) return sourceDigestR
  const providerR = reader.closed('$.provider', top['provider'], PROVIDER_KEYS)
  if (providerR.ok === false) return providerR
  const provider = providerR.value
  const providerIdR = reader.str('$.provider.id', provider['id'])
  if (providerIdR.ok === false) return providerIdR
  const providerDigestR = reader.digest('$.provider.digest', provider['digest'])
  if (providerDigestR.ok === false) return providerDigestR

  // ── capability negotiation (§10.3) ────────────────────────────────────────
  const requiredR = reader.strList('$.requiredCapabilities', top['requiredCapabilities'])
  if (requiredR.ok === false) return requiredR
  const requiredCapabilities = requiredR.value
  const optionalR = reader.strList('$.optionalCapabilities', top['optionalCapabilities'])
  if (optionalR.ok === false) return optionalR
  const optionalCapabilities = optionalR.value
  for (const [i, cap] of requiredCapabilities.entries()) {
    if (!(cap in manifest.capabilities)) {
      return r('CAPABILITY_UNKNOWN', `$.requiredCapabilities[${String(i)}]`, `'${cap}' is not in the Kernel's published capability manifest`)
    }
  }
  for (const [i, cap] of optionalCapabilities.entries()) {
    if (!(cap in manifest.capabilities)) {
      return r('CAPABILITY_UNKNOWN', `$.optionalCapabilities[${String(i)}]`, `'${cap}' is not in the Kernel's published capability manifest`)
    }
    if (requiredCapabilities.includes(cap)) {
      return r('BAD_VALUE', `$.optionalCapabilities[${String(i)}]`, `'${cap}' is declared both required and optional`)
    }
  }

  // ── boundary 1: Source & Visibility ───────────────────────────────────────
  const visibilityR = reader.closed('$.visibility', top['visibility'], VISIBILITY_KEYS)
  if (visibilityR.ok === false) return visibilityR
  const visibility = visibilityR.value
  const visibilityOwnerR = reader.lit('$.visibility.owner', visibility['owner'], ['family'])
  if (visibilityOwnerR.ok === false) return visibilityOwnerR
  const nativeNamesR = reader.strList('$.visibility.nativeNames', visibility['nativeNames'], { allowEmpty: false })
  if (nativeNamesR.ok === false) return nativeNamesR
  const nativeNames = nativeNamesR.value
  for (const [i, name] of nativeNames.entries()) {
    if (!NAME_RE.test(name)) return r('BAD_NAME', `$.visibility.nativeNames[${String(i)}]`, 'name shape violation')
  }
  const aliasesR = reader.strList('$.visibility.aliases', visibility['aliases'])
  if (aliasesR.ok === false) return aliasesR
  const aliases = aliasesR.value
  for (const [i, alias] of aliases.entries()) {
    if (!NAME_RE.test(alias)) return r('BAD_NAME', `$.visibility.aliases[${String(i)}]`, 'alias shape violation')
    if (nativeNames.includes(alias)) {
      return r('NAME_ALIAS_COLLISION', `$.visibility.aliases[${String(i)}]`, `'${alias}' is also a native name of this family`)
    }
  }
  const profileRequirementsR = reader.strList('$.visibility.profileRequirements', visibility['profileRequirements'])
  if (profileRequirementsR.ok === false) return profileRequirementsR
  const profileRequirements = profileRequirementsR.value

  // ── boundary 2: Definition & Arguments ────────────────────────────────────
  const definitionR = reader.closed('$.definition', top['definition'], DEFINITION_KEYS)
  if (definitionR.ok === false) return definitionR
  const definition = definitionR.value
  const definitionOwnerR = reader.lit('$.definition.owner', definition['owner'], ['family'])
  if (definitionOwnerR.ok === false) return definitionOwnerR
  const inputContractDigestR = reader.digest('$.definition.inputContractDigest', definition['inputContractDigest'])
  if (inputContractDigestR.ok === false) return inputContractDigestR
  const outputContractDigestR = reader.digest('$.definition.outputContractDigest', definition['outputContractDigest'])
  if (outputContractDigestR.ok === false) return outputContractDigestR
  const normalizationR = reader.lit('$.definition.normalization', definition['normalization'], ['pure'])
  if (normalizationR.ok === false) return normalizationR

  // ── boundary 3: Effects & Constraints ─────────────────────────────────────
  const effectsR = reader.closed('$.effects', top['effects'], EFFECTS_KEYS)
  if (effectsR.ok === false) return effectsR
  const effects = effectsR.value
  const effectsDeclaredR = reader.bool('$.effects.declared', effects['declared'])
  if (effectsDeclaredR.ok === false) return effectsDeclaredR
  const effectsDeclared = effectsDeclaredR.value
  const effectKindsR = reader.strList('$.effects.kinds', effects['kinds'])
  if (effectKindsR.ok === false) return effectKindsR
  const effectKinds = effectKindsR.value
  const effectTargetsR = reader.strList('$.effects.targets', effects['targets'])
  if (effectTargetsR.ok === false) return effectTargetsR
  const effectTargets = effectTargetsR.value
  if (effectsDeclared && effectKinds.length === 0) {
    return r('BAD_VALUE', '$.effects.kinds', 'effects.declared=true requires at least one effect kind')
  }

  // ── boundary 4: Execution ────────────────────────────────────────────────
  const executionR = reader.closed('$.execution', top['execution'], EXECUTION_KEYS)
  if (executionR.ok === false) return executionR
  const execution = executionR.value
  const executionDeclaredR = reader.bool('$.execution.declared', execution['declared'])
  if (executionDeclaredR.ok === false) return executionDeclaredR
  const executionDeclared = executionDeclaredR.value
  const executionViaR = reader.lit('$.execution.via', execution['via'], ['family-body', 'named-bridge'])
  if (executionViaR.ok === false) return executionViaR
  const executionVia = executionViaR.value
  let bridgeId: string | undefined
  if (execution['bridgeId'] !== undefined) {
    const bridgeR = reader.str('$.execution.bridgeId', execution['bridgeId'])
    if (bridgeR.ok === false) return bridgeR
    bridgeId = bridgeR.value
  }
  if (executionVia === 'named-bridge' && bridgeId === undefined) {
    return r('BAD_VALUE', '$.execution.bridgeId', 'via=named-bridge requires a named bridgeId')
  }
  if (executionVia === 'family-body' && bridgeId !== undefined) {
    return r('BAD_VALUE', '$.execution.bridgeId', 'bridgeId is only meaningful with via=named-bridge')
  }
  // PR1 negative matrix: a family that DECLARES effects but no execution path
  // is describing effects no decision will ever gate — fail closed.
  if (effectsDeclared && !executionDeclared) {
    return r('EFFECTS_WITHOUT_EXECUTION', '$.execution.declared', 'effects.declared=true requires execution.declared=true')
  }
  // PR1 negative matrix: a provider-backed family executes THROUGH a named
  // Bridge, never by self-attestation (CI-07: the provider is named+reviewed).
  if (sourceKindR.value === 'provider-backed' && (executionVia !== 'named-bridge' || bridgeId === undefined)) {
    return r('NAMED_BRIDGE_REQUIRED', '$.execution.via', 'a provider-backed family must declare execution via a named bridge')
  }

  // ── capability backing (against the REAL execution declaration) ──────────
  for (const [i, cap] of requiredCapabilities.entries()) {
    const backing = manifest.capabilities[cap]?.backsExecution
    if (backing === undefined) continue
    if (backing === 'named-bridge' && executionVia !== 'named-bridge') {
      return r('CAPABILITY_UNBACKED', `$.requiredCapabilities[${String(i)}]`, `'${cap}' is backed only by a named bridge; this contribution declares ${executionVia}`)
    }
    if (backing === 'family-body' && (!executionDeclared || executionVia !== 'family-body')) {
      return r('CAPABILITY_UNBACKED', `$.requiredCapabilities[${String(i)}]`, `'${cap}' is backed only by a declared family-body execution path`)
    }
  }

  // ── boundary 5: Lifecycle (+ cancel boundary) ────────────────────────────
  const lifecycleR = reader.closed('$.lifecycle', top['lifecycle'], LIFECYCLE_KEYS)
  if (lifecycleR.ok === false) {
    // The slice plan names this leg on its own: lifecycle without an owner.
    if (lifecycleR.code === 'MISSING_FIELD' || lifecycleR.code === 'UNKNOWN_FIELD') {
      return r('LIFECYCLE_OWNER_REQUIRED', '$.lifecycle', 'the lifecycle boundary is mandatory and closed')
    }
    return lifecycleR
  }
  const lifecycle = lifecycleR.value
  if (lifecycle['owner'] === undefined) {
    return r('LIFECYCLE_OWNER_REQUIRED', '$.lifecycle.owner', 'the lifecycle boundary must declare its owner')
  }
  const lifecycleOwnerR = reader.lit('$.lifecycle.owner', lifecycle['owner'], ['kernel'])
  if (lifecycleOwnerR.ok === false) {
    if (lifecycleOwnerR.code === 'BAD_VALUE') {
      return r('FAMILY_SELF_APPROVAL_FORBIDDEN', '$.lifecycle.owner', 'lifecycle publish→drain→dispose ordering is kernel-owned (§4; CI-08); a family cannot own it')
    }
    return lifecycleOwnerR
  }
  const drainR = reader.lit('$.lifecycle.drain', lifecycle['drain'], ['kernel-owned'])
  if (drainR.ok === false) return drainR
  const cancelBoundaryR = reader.str('$.lifecycle.cancelBoundary', lifecycle['cancelBoundary'])
  if (cancelBoundaryR.ok === false) return cancelBoundaryR

  // ── boundary 6: Result ───────────────────────────────────────────────────
  const resultR = reader.closed('$.result', top['result'], RESULT_KEYS)
  if (resultR.ok === false) return resultR
  const result = resultR.value
  const envelopeR = reader.lit('$.result.envelope', result['envelope'], ['host'])
  if (envelopeR.ok === false) return envelopeR
  const correlationR = reader.lit('$.result.correlation', result['correlation'], ['kernel'])
  if (correlationR.ok === false) return correlationR

  // ── obligations: the self-approval gate (CI-06) ──────────────────────────
  const obligationsR = reader.closed('$.obligations', top['obligations'], OBLIGATIONS_KEYS)
  if (obligationsR.ok === false) return obligationsR
  const obligations = obligationsR.value
  for (const key of OBLIGATIONS_KEYS) {
    if (obligations[key] !== 'kernel') {
      return r('FAMILY_SELF_APPROVAL_FORBIDDEN', `$.obligations.${String(key)}`, `${String(key)} authority belongs to the Kernel; a Family cannot declare it anywhere else (CI-06)`)
    }
  }

  const contribution: FamilyContributionInput = {
    schemaVersion: { major, minor, patch },
    familyId: familyIdR.value,
    familyVersion: familyVersionR.value,
    source: { kind: sourceKindR.value as 'family-owned' | 'provider-backed', selector: sourceSelectorR.value, digest: sourceDigestR.value },
    provider: { id: providerIdR.value, digest: providerDigestR.value },
    requiredCapabilities,
    optionalCapabilities,
    visibility: {
      owner: 'family',
      nativeNames,
      aliases,
      profileRequirements,
    },
    definition: {
      owner: 'family',
      inputContractDigest: inputContractDigestR.value,
      outputContractDigest: outputContractDigestR.value,
      normalization: 'pure',
    },
    effects: { declared: effectsDeclared, kinds: effectKinds, targets: effectTargets },
    execution: executionVia === 'named-bridge'
      ? { declared: executionDeclared, via: 'named-bridge', bridgeId }
      : { declared: executionDeclared, via: 'family-body' },
    lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary: cancelBoundaryR.value },
    result: { envelope: 'host', correlation: 'kernel' },
    obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
  }
  return { ok: true, contribution: deepFreeze(contribution) }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}
