/**
 * The DERIVED stable member identity — the spec → identity derivation of
 * the member create/resume residency (P5-T6; DevPlan §18.5; TaskDoc §11.5
 * P5-T6 card).
 *
 * The {@link MemberCreateSpec} is the canonical identity input of ONE
 * member slot of the Team (the coordinator's provisioning request,
 * DevPlan §18.1). The derivation is DETERMINISTIC and PURE: a re-drive of
 * the same spec ALWAYS reconstructs the same
 * `(instanceId, childSessionId)` (Architecture §18.2 stable identity —
 * the I1c replay-convergence property), and a different spec derives a
 * different identity (a different logical creation; the coordinator
 * guarantees spec uniqueness within a team, so no collision is possible
 * inside one TeamSession's member space).
 *
 * Identity layout:
 *
 * - `instanceId` = `'inst-' + token(specString, 12)` — satisfies the
 *   contracts v1 `INSTANCE_ID_PATTERN` (`^inst-[a-z0-9]{1,32}$`);
 * - `childSessionId` = `'session-child-' + token(specString, 16)` — an
 *   opaque session id (<= 255 chars, no control chars / whitespace) that
 *   the fresh path durably binds to the instance (invariant 23) and that
 *   is NEVER re-pointed (invariant 24).
 *
 * where `specString` is the canonical concatenation
 * `[rootSessionId, templateId, label, groupId ?? '', workspace ?? '']`
 * joined by the NUL character (`\u0000`). The join is UNAMBIGUOUS
 * because every field has been validated control-char-free (the label /
 * groupId / workspace rules) or whitespace- + control-char-free (the
 * session-id rules) BEFORE concatenation — no field can contain the
 * separator.
 *
 * The token algorithm (`memberResidencyToken`) is a BYTE-IDENTICAL
 * mirror of `packages/storage/provisioning/identity.ts#deterministicToken`
 * (iterated FNV-1a 32-bit over the input, rendered in base36): pure,
 * dependency-free (no `node:` builtin, no `crypto`), stable across
 * processes and restarts, and collision-safe for the identity space of
 * one TeamSession. The runtime package keeps the P5-T5 discipline of a
 * TYPE-ONLY dependency on the storage package in production code, so
 * this module carries its own copy of the algorithm; the p5t6 unit tests
 * cross-verify the mirror against the storage original (value imports
 * from storage are permitted in test files) so the two can never
 * diverge silently.
 *
 * This module emits NO identity from labels or template ids alone
 * (invariant 19): the spec as a WHOLE is the input, and the derived ids
 * are the only runtime identities.
 *
 * Pure module: no I/O, no host imports, no `node:` builtins.
 *
 * @module @dsh-agent-team/runtime/member-residency/identity
 */
import type { DerivedMemberIdentity, MemberCreateSpec, MemberIdentityInput } from './types.js';
/**
 * A deterministic `[a-z0-9]` token of `s`: the
 * concatenation of several FNV-1a passes (different seeds) rendered in
 * base36, truncated to `length`.
 *
 * BYTE-IDENTICAL MIRROR of
 * `packages/storage/provisioning/identity.ts#deterministicToken` (kept
 * local because production runtime code carries only a type-only
 * dependency on storage; the p5t6 unit tests cross-verify both
 * implementations). Pure and stable; NOT cryptographic (identity
 * disambiguation only, within one TeamSession's member space).
 *
 * @param s - the string to tokenize.
 * @param length - the token length (must be >= 1 and <= 56 for this scheme).
 * @returns the base36 token of exactly `length` characters.
 */
export declare function memberResidencyToken(s: string, length: number): string;
/**
 * Validate a member creation spec fail-closed (NO effect on any failure:
 * every check runs before any durable write or binder step).
 *
 * Rules (mirrors of the contracts v1 boundary rules; the repository
 * re-validates the DTOs at put time — this validation is the EARLY,
 * effect-free gate of the module):
 *
 * - `spec` must be a plain object;
 * - `rootSessionId` — session-id rules (non-empty, <= 255, no control
 *   chars, no whitespace);
 * - `templateId` — the contracts v1 template-id pattern;
 * - `label` — label rules (non-empty, <= 128, no control chars);
 * - `groupId` (optional) — label rules when present;
 * - `workspace` (optional) — workspace rules (non-empty, <= 1024, no
 *   control chars) when present.
 *
 * @param spec - the member creation spec.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`)
 *   with the offending `field` in `details`.
 */
export declare function validateMemberCreateSpec(spec: MemberCreateSpec): void;
/**
 * The canonical spec string — the single input of the identity tokens.
 *
 * `[rootSessionId, templateId, label, groupId ?? '', workspace ?? '']`
 * joined by `\u0000`. Unambiguous: no field contains the separator
 * (control-char-free by validation). Absent optional fields contribute
 * the empty string, so `{...spec, groupId: undefined}` and `{...spec}`
 * derive the SAME identity (absence is not a distinct value).
 *
 * @param spec - the member creation spec (validated first).
 * @returns the canonical spec string.
 */
export declare function canonicalMemberSpecString(spec: MemberCreateSpec): string;
/**
 * Validate a composite member identity (cold resume / evict input)
 * fail-closed (NO effect on any failure):
 *
 * - `input` must be a plain object;
 * - `rootSessionId` — session-id rules (non-empty, <= 255, no control
 *   chars, no whitespace);
 * - `instanceId` — the contracts v1 instance-id pattern.
 *
 * @param input - the composite member identity.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`)
 *   with the offending `field` in `details`.
 */
export declare function validateMemberIdentityInput(input: MemberIdentityInput): void;
/**
 * Derive the stable member identity from its creation spec
 * (see the module docs for the layout and determinism guarantees).
 *
 * @param spec - the member creation spec.
 * @returns the derived `{ instanceId, childSessionId }`.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`)
 *   when the spec is structurally invalid.
 */
export declare function deriveMemberIdentity(spec: MemberCreateSpec): DerivedMemberIdentity;
//# sourceMappingURL=identity.d.ts.map