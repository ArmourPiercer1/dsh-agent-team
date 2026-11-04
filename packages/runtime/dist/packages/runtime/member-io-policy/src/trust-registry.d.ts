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
import type { TrustRegistrationResult, TrustRegistry, TrustVerificationResult, TrustedBindingReceipt, TrustedBindingRegistration, TrustedBindingVerification } from './types.js';
/**
 * Create an isolated registry. Live assembly owns one registry per deployment;
 * `createTrustRegistry()` is how independent realms (and tests) stay apart.
 */
export declare function createTrustRegistry(): TrustRegistry;
/** Explicit load-time registration (closed result vocabulary). */
export declare function registerTrustedBinding(input: TrustedBindingRegistration, registry?: TrustRegistry): TrustRegistrationResult;
/** Verify identity + load generation for one call (never hashes a tree). */
export declare function verifyTrustedBinding(input: TrustedBindingVerification, registry?: TrustRegistry): TrustVerificationResult;
/** Read-only inspection, for audit/DIAG. */
export declare function inspectTrustedBinding(scope: string, toolName: string, registry?: TrustRegistry): TrustedBindingReceipt | null;
//# sourceMappingURL=trust-registry.d.ts.map