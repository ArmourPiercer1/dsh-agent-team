/**
 * Alpha.5 P1-07 — execution profile compilation (policy → OS rules).
 *
 * The OS runner never receives the Member policy loosely: it receives a
 * COMPILED PROFILE derived from the effective two-axis policy, and it refuses
 * to run when the profile cannot make an honest promise.
 *
 * EXPRESSIBLE (and enforced by the Landlock launcher):
 *  - read allow locators → READ_FILE | READ_DIR on exactly those subtrees;
 *  - write allow locators → WRITE_FILE | MAKE_REG | TRUNCATE | REMOVE_FILE;
 *  - a write locator that is NOT also readable → the write-only entry, with the
 *    read bits absent (the kernel default-denies reads of it);
 *  - network `deny` → the child is refused when the backend cannot enforce the
 *    network dimension (no `--unshare-net`-less fallback).
 *
 * NOT EXPRESSIBLE, therefore REFUSED rather than approximated:
 *  - `mode: all` on either axis (a "no allowlist" policy cannot be turned into
 *    a default-deny ruleset without changing its meaning);
 *  - `ask` dispositions (an ask is not an allow: the profile never upgrades it);
 *  - a DENY that is a strict descendant of an allow on the same axis (Landlock
 *    has no negative rules; granting the parent would grant the denial);
 *  - for a write locator nested under a readable parent the kernel read bit on
 *    the parent also covers it: the module reports it as readable, not as
 *    write-only (no silent write-only claim for a nested path);
 *  - `chmod` (Landlock cannot restrict it for a same-uid owner; disclosed in the
 *    evidence, never silently claimed).
 *
 * @module @dsh-agent-team/runtime/team-sandbox/profile
 */
import type { AllowPathEntry } from '../../sandbox-provider/index.js';
import type { EffectiveIoPolicy, MemberPolicy } from '../../member-io-policy/src/types.js';
/** The policy shapes this compiler accepts (member ceiling or effective policy). */
export type ProfilePolicy = MemberPolicy | EffectiveIoPolicy;
export declare const PROFILE_REFUSAL_CODES: readonly ["PATH_LANE_UNRESTRICTED", "PATH_LANE_UNSUPPORTED", "PATH_NESTED_DENY_UNEXPRESSIBLE", "NETWORK_DENY_UNEXPRESSIBLE", "NO_NAMED_SUBTREE"];
export type ProfileRefusalCode = (typeof PROFILE_REFUSAL_CODES)[number];
export interface ProfileRefusal {
    readonly ok: false;
    readonly code: ProfileRefusalCode;
    readonly detail: string;
}
export interface ExecutionProfile {
    /** The kernel rules, one entry per named subtree. */
    readonly allowPaths: readonly AllowPathEntry[];
    /** `deny` must be enforced by the backend or the spawn is refused. */
    readonly networkProfile: 'deny' | undefined;
    readonly readPaths: readonly string[];
    readonly writeOnlyPaths: readonly string[];
    /** Read+write subtrees (the intersection, listed once). */
    readonly readWritePaths: readonly string[];
}
export type ProfileResult = {
    readonly ok: true;
    readonly value: ExecutionProfile;
} | ProfileRefusal;
/**
 * Compile one execution profile. `read` and `write` are compiled independently:
 * a write-only subtree is a real, first-class outcome (it is exactly what a
 * Member with `write: allow` and no matching `read: allow` gets), not a bug.
 */
export declare function compileExecutionProfile(policy: ProfilePolicy): ProfileResult;
//# sourceMappingURL=profile.d.ts.map