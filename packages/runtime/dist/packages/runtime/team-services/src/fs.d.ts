/**
 * Alpha.5 P1-05 — the confined per-Member filesystem Provider.
 *
 * WHY A SUBCLASS AND NOT A NEW PROVIDER: the Member data plane must keep the
 * host Provider's exact semantics (atomic writes, version guards, symlink
 * handling, diff basis, watch) and add ONLY an admission decision. Inheriting
 * from the live Provider class — sampled from the running service, never
 * imported by name — gives that for free and keeps this lane free of any
 * upstream dependency (CORE PATCH BUDGET = 0, and no lockfile change).
 *
 * WHAT IT ENFORCES: every target-bearing method asks the compiled
 * {@link MemberPolicy} before delegating. `read*`/`listDir`/`stat`/`lstat`/
 * `watch` consult the read axis; `writeText`/`editText` consult the write axis
 * AND, when the target already exists, also require read coverage (`write ⇒
 * read`, the native read-then-write contract). The path identity check is
 * P1-03's `evaluateLocatorAccess`: authored containment first, then the
 * provider-resolved real path, so a symlink that escapes the authorized subtree
 * is refused even though its authored name is inside.
 *
 * `ask` IS A REFUSAL HERE (A5-DUAL-PLANE-01, 2026-11-05): the compiled lane can
 * carry the disposition `ask`, and this plane owns no approval consumer
 * (`resolveAskClassCall` is the designed seam and has no production caller), so
 * an ask-covered locator — authored or reached through an alias — throws the
 * typed `IO_ASK_REQUIRES_APPROVAL` BEFORE `super.<method>` runs. Refusing is the
 * fail-closed interim state; the alternative would be to treat the allow that
 * also covers the locator as an approval that was never requested or consumed.
 * Wiring real one-shot approval is BL-30's design, deliberately not done here.
 *
 * WHAT IT DOES NOT DO: it does not resolve or read anything itself (every
 * operation is `super.<method>`), does not REQUEST or CONSUME approvals, and
 * does not weaken the host Provider — a refusal is raised BEFORE the operation,
 * a permitted call behaves byte-for-byte like the base Provider, and the
 * per-call HOST policy it forwards is narrowed to at most this deployment's own
 * default mode (PD-17: the session's workspace root must survive, its
 * escalation must not).
 *
 * @module @dsh-agent-team/runtime/team-services/fs
 */
import type { Context } from '@deepseek-ai/cordis';
import { type PathIdentityResolver } from '../../member-io-policy/src/provider-capabilities.js';
import type { EffectiveIoPolicy, MemberPolicy } from '../../member-io-policy/src/types.js';
/**
 * The structural Provider surface the confined subclass relies on. The LIVE
 * class supplies the implementations; this interface exists so the subclass can
 * override and forward without importing the provider package.
 */
export interface FsProviderSurface {
    /** Resolution-only: unguarded, but required (a provider without it is unusable). */
    resolve(path: string, opts?: unknown): Promise<unknown>;
    processPath(target: unknown): string;
    contains(parent: unknown, child: unknown): boolean;
    readText(target: unknown, signal?: AbortSignal): Promise<string>;
    streamText(target: unknown, signal?: AbortSignal): Promise<AsyncIterable<string>>;
    readBytes(target: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>;
    readByteRange(target: unknown, range: unknown, signal?: AbortSignal): Promise<Uint8Array>;
    listDir(target: unknown, signal?: AbortSignal): Promise<unknown[]>;
    stat(target: unknown, signal?: AbortSignal): Promise<unknown>;
    lstat(path: string, opts?: unknown, signal?: AbortSignal): Promise<unknown>;
    watch(target: unknown, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>>;
    writeText(target: unknown, content: string, expected?: unknown, signal?: AbortSignal, policy?: unknown): Promise<unknown>;
    editText(target: unknown, edit: unknown, expected?: unknown, signal?: AbortSignal, policy?: unknown): Promise<unknown>;
}
/** A Provider constructor that Cordis can mount as the `fs` service. */
export type FsProviderConstructor = new (ctx: Context, config?: Record<string, unknown>) => FsProviderSurface;
/**
 * The policy lanes the guard reads. A Member ceiling and an effective policy
 * share exactly this shape, so the SAME guard enforces either one (the tool
 * factor of the invariant is not allowed to be decorative).
 */
export type PolicyLanes = Pick<MemberPolicy | EffectiveIoPolicy, 'memberIdentity' | 'read' | 'write'>;
/**
 * The per-call admission function the subclass calls before delegating.
 *
 * `annotations` is an OPTIONAL, additive transport for a face that did
 * something to the request BESIDES the lane decision (BL-16: the confined
 * subprocess face disables rg's ancestor/VCS ignore discovery when the search
 * root's ancestors are outside the lane). It is not a decision input: the
 * guard still decides on `(method, hostPath)` alone, and the note is recorded
 * on the SAME fact the decision produced, so the fact count never changes.
 */
export type FsGuard = (method: string, hostPath: string, annotations?: readonly string[]) => Promise<void>;
/**
 * Build the admission function for one Member. All checks are fail-closed:
 * a resolver failure, an unsupported destination or an uncovered target, a
 * write without read coverage, and a CLOSED lifecycle admission all throw a
 * typed refusal; there is no path that returns "allow" by omission.
 *
 * LIFECYCLE ADMISSION (PD20-B1, the measured `a5sf-recon-shell` defect): this
 * function is the ONE boundary in front of every Member execution face
 * (confined `fs` / `subprocess` / `terminals` / search / web), and it is the
 * only one a RUNNING Member's own turn passes through on its way to a new
 * child process or a new byte. So it is where "an archive/dispose has been
 * requested in this process" is enforced at the NEXT TOOL BOUNDARY: the close
 * stamp (`lifecycle/admission-state`, written by the live binding of the
 * lifecycle `AdmissionClosePort` step 1) refuses the call before any locator is
 * resolved — no spawn, no byte, no lane fact. Before this check existed, the
 * only consumer of the close was the Team tool-dispatch route, so a Member's own
 * turn kept obtaining new confined terminal sessions until it ended (measured
 * window 8.56 s / 8.72 s, a second `bash` 290/427 ms before the commit).
 */
export declare function createMemberFsGuard(policy: PolicyLanes, resolver?: PathIdentityResolver): FsGuard;
/**
 * Create the confined Provider class for one Member: the live Provider class is
 * the base, every target-bearing method guards first and delegates second.
 * The returned constructor is mountable through Cordis (`ctx.plugin`) and
 * registers the same `fs` service name in the context it is mounted under.
 */
export declare function createConfinedFileSystemClass(Base: FsProviderConstructor, guard: FsGuard): FsProviderConstructor;
//# sourceMappingURL=fs.d.ts.map