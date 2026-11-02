/**
 * Alpha.5 P1-04 — the Trusted Tool Registry.
 *
 * WHAT THIS MODULE IS: the ONE place where the DEPLOYER records "these exact
 * source/dependency digests, in this scope, at this Definition generation, are
 * the trusted binding for this tool name", and where a call re-checks that
 * tuple. It verifies IDENTITY and LOAD GENERATION ONLY: the digests are
 * supplied by the loader (package source digest + dependency-lock digest) and
 * the registry compares them; it never re-walks or re-hashes a file tree on a
 * call.
 *
 * WHAT IT IS NOT — it is NOT a sandbox. A matching digest is a deployment
 * trust decision and a drift check, NOT a proof that the module is free of
 * malicious code. `service-mediated` execution assumes the deployer trusts the
 * tool's JS; a trusted in-process module that calls `node:fs` / `node:net`
 * directly can bypass its Provider, and nothing here prevents that. Do not
 * claim malicious-JS isolation from a verified binding.
 *
 * LAWS (all machine-checked by `test/a5sf-trust-registry.test.ts`):
 *  - explicit registration only: an unregistered `(scope, toolName)` is
 *    `TRUST_BINDING_UNKNOWN`; there is no trust-by-default;
 *  - package or dependency digest mismatch is refused with its own typed code;
 *  - HMR / Definition replacement is a GENERATION law: if the registry's
 *    current generation for that `(scope, toolName)` is newer than the
 *    caller's `definitionGeneration`, the call is `TRUST_GENERATION_STALE`,
 *    even when the tool name is identical. A tool name ALONE is never
 *    sufficient. A caller generation the registry never registered (including
 *    one newer than the registry) is `TRUST_GENERATION_MISMATCH`;
 *  - `scope` is part of the key: the same tool name registered in two scopes is
 *    two registrations and never shares trust;
 *  - a registration may not be downgraded (`TRUST_GENERATION_STALE`) and a
 *    same-generation redefinition is `TRUST_REGISTRATION_CONFLICT`; an
 *    identical same-generation re-registration is idempotent.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/trust-registry
 */

import type {
  TrustRefusalCode,
  TrustRegistrationResult,
  TrustRegistry,
  TrustVerificationResult,
  TrustedBindingReceipt,
  TrustedBindingRegistration,
  TrustedBindingVerification,
} from './types.js'

function refusal(code: TrustRefusalCode, detail: string, path: string) {
  return Object.freeze({ ok: false as const, code, detail, path })
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0
}

/** Validate a registration/verification tuple; nothing is defaulted. */
function validateRegistration(input: TrustedBindingRegistration): string | null {
  if (!isNonBlank(input.toolName)) return 'toolName must be a non-empty string'
  if (!isNonBlank(input.scope)) return 'scope must be a non-empty string'
  if (!isNonBlank(input.packageDigest)) return 'packageDigest must be the loader-supplied package digest'
  if (!isNonBlank(input.dependencyDigest)) return 'dependencyDigest must be the loader-supplied dependency-lock digest'
  if (!isGeneration(input.definitionGeneration)) {
    return 'definitionGeneration must be a non-negative safe integer supplied by the loader'
  }
  return null
}

/** Scope + tool name is the registration key; neither is shared across scopes. */
function registrationKey(scope: string, toolName: string): string {
  return `${scope}\u0000${toolName}`
}

function freezeReceipt(receipt: TrustedBindingReceipt): TrustedBindingReceipt {
  return Object.freeze({ ...receipt })
}

/**
 * Create an isolated registry. Live assembly owns one registry per deployment;
 * `createTrustRegistry()` is how independent realms (and tests) stay apart.
 */
export function createTrustRegistry(): TrustRegistry {
  const byKey = new Map<string, TrustedBindingReceipt>()

  function register(input: TrustedBindingRegistration): TrustRegistrationResult {
    const invalid = validateRegistration(input)
    if (invalid !== null) {
      return refusal('TRUST_INPUT_INVALID', invalid, 'registerTrustedBinding')
    }

    const key = registrationKey(input.scope, input.toolName)
    const existing = byKey.get(key)
    if (existing !== undefined) {
      if (input.definitionGeneration < existing.definitionGeneration) {
        return refusal(
          'TRUST_GENERATION_STALE',
          `registration for '${input.toolName}' in '${input.scope}' is at generation ${String(existing.definitionGeneration)}; a lower generation (${String(input.definitionGeneration)}) is a downgrade and is refused`,
          'registerTrustedBinding.definitionGeneration',
        )
      }
      if (input.definitionGeneration === existing.definitionGeneration) {
        const sameLoad =
          input.packageDigest === existing.packageDigest &&
          input.dependencyDigest === existing.dependencyDigest
        if (!sameLoad) {
          return refusal(
            'TRUST_REGISTRATION_CONFLICT',
            `generation ${String(input.definitionGeneration)} of '${input.toolName}' in '${input.scope}' is already registered with different digests; one generation cannot name two sources`,
            'registerTrustedBinding.packageDigest',
          )
        }
        // Idempotent re-registration of the SAME load.
        return Object.freeze({ ok: true as const, value: existing })
      }
      // A strictly newer generation is how HMR / Definition replacement is
      // recorded: it replaces the trusted tuple for that key.
    }

    const receipt = freezeReceipt({
      packageDigest: input.packageDigest,
      dependencyDigest: input.dependencyDigest,
      scope: input.scope,
      definitionGeneration: input.definitionGeneration,
      toolName: input.toolName,
    })
    byKey.set(key, receipt)
    return Object.freeze({ ok: true as const, value: receipt })
  }

  function verify(input: TrustedBindingVerification): TrustVerificationResult {
    const invalid = validateRegistration(input)
    if (invalid !== null) {
      return refusal('TRUST_INPUT_INVALID', invalid, 'verifyTrustedBinding')
    }

    const existing = byKey.get(registrationKey(input.scope, input.toolName))
    if (existing === undefined) {
      return refusal(
        'TRUST_BINDING_UNKNOWN',
        `no trusted binding is registered for tool '${input.toolName}' in scope '${input.scope}'; trust is never assumed by default`,
        'verifyTrustedBinding',
      )
    }

    // Generation FIRST: it names the LOAD the caller is talking about. A stale
    // caller (HMR replaced its Definition) is refused as STALE even if it also
    // presents the digests it used to trust; the tool name alone never passes.
    if (input.definitionGeneration < existing.definitionGeneration) {
      return refusal(
        'TRUST_GENERATION_STALE',
        `tool '${input.toolName}' in '${input.scope}' is at generation ${String(existing.definitionGeneration)}; the caller's generation ${String(input.definitionGeneration)} was replaced (HMR / Definition reload)`,
        'verifyTrustedBinding.definitionGeneration',
      )
    }
    if (input.definitionGeneration > existing.definitionGeneration) {
      return refusal(
        'TRUST_GENERATION_MISMATCH',
        `tool '${input.toolName}' in '${input.scope}' is registered at generation ${String(existing.definitionGeneration)}; the caller claims an unregistered generation ${String(input.definitionGeneration)}`,
        'verifyTrustedBinding.definitionGeneration',
      )
    }

    // Identity of that generation: the loader-supplied digests must match.
    if (input.packageDigest !== existing.packageDigest) {
      return refusal(
        'TRUST_PACKAGE_DIGEST_MISMATCH',
        `tool '${input.toolName}' in '${input.scope}' is registered with package digest '${existing.packageDigest}', not '${input.packageDigest}'`,
        'verifyTrustedBinding.packageDigest',
      )
    }
    if (input.dependencyDigest !== existing.dependencyDigest) {
      return refusal(
        'TRUST_DEPENDENCY_DIGEST_MISMATCH',
        `tool '${input.toolName}' in '${input.scope}' is registered with dependency digest '${existing.dependencyDigest}', not '${input.dependencyDigest}'`,
        'verifyTrustedBinding.dependencyDigest',
      )
    }

    return Object.freeze({ ok: true as const, value: existing })
  }

  function inspect(scope: string, toolName: string): TrustedBindingReceipt | null {
    if (!isNonBlank(scope) || !isNonBlank(toolName)) return null
    return byKey.get(registrationKey(scope, toolName)) ?? null
  }

  return Object.freeze({
    register,
    verify,
    inspect,
    size: () => byKey.size,
  })
}

/**
 * The process-wide deployment registry used by the module-level helpers. Live
 * assembly may keep its own `createTrustRegistry()` instance; both obey the
 * same laws. Nothing here is shared with a second grant/approval store.
 */
const DEFAULT_REGISTRY = createTrustRegistry()

/** Explicit load-time registration (closed result vocabulary). */
export function registerTrustedBinding(
  input: TrustedBindingRegistration,
  registry: TrustRegistry = DEFAULT_REGISTRY,
): TrustRegistrationResult {
  return registry.register(input)
}

/** Verify identity + load generation for one call (never hashes a tree). */
export function verifyTrustedBinding(
  input: TrustedBindingVerification,
  registry: TrustRegistry = DEFAULT_REGISTRY,
): TrustVerificationResult {
  return registry.verify(input)
}

/** Read-only inspection, for audit/DIAG. */
export function inspectTrustedBinding(
  scope: string,
  toolName: string,
  registry: TrustRegistry = DEFAULT_REGISTRY,
): TrustedBindingReceipt | null {
  return registry.inspect(scope, toolName)
}
