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
 * THE 0.2.2-rc.5 ADDITIONS (`patchText`, `deleteFile`, `moveFile`) are confined
 * the same way and are the B5 closure of the rc.5 review: before them,
 * `apply_patch`, delete and move reached the base Provider with the Member's
 * lane never consulted. `patchText` is judged like `editText`, `deleteFile`
 * like a write of the file it removes, and `moveFile` judges BOTH paths (the
 * source being removed and the destination being published) before either
 * effect. Because this repo compiles against rc.2's provider type, the three
 * are declared as extra methods reached through one local, commented cast, and
 * a base that implements none of them is a TYPED `IO_POLICY_UNSUPPORTED`
 * refusal rather than an untyped crash or a fallthrough (see
 * {@link FsNewMethodSurface} and `team-services/src/fs.ts` in the factory).
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

import type { Context } from '@deepseek-ai/cordis'
import { locatorWithinRuleSet } from '../../member-io-policy/src/path-rules.js'
import {
  NODE_PATH_IDENTITY_RESOLVER,
  evaluateLocatorAccess,
  type PathIdentityResolver,
} from '../../member-io-policy/src/provider-capabilities.js'
import type { EffectiveIoPolicy, MemberPolicy, PathRuleSet } from '../../member-io-policy/src/types.js'
import { LifecycleAdmissionClosedError, memberAdmissionCloseOf } from '../../lifecycle/admission-state.js'
import { TeamIoDenial } from './types.js'

/**
 * The structural Provider surface the confined subclass relies on. The LIVE
 * class supplies the implementations; this interface exists so the subclass can
 * override and forward without importing the provider package.
 */
export interface FsProviderSurface {
  /** Resolution-only: unguarded, but required (a provider without it is unusable). */
  resolve(path: string, opts?: unknown): Promise<unknown>
  processPath(target: unknown): string
  contains(parent: unknown, child: unknown): boolean
  readText(target: unknown, signal?: AbortSignal): Promise<string>
  streamText(target: unknown, signal?: AbortSignal): Promise<AsyncIterable<string>>
  readBytes(target: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>
  readByteRange(target: unknown, range: unknown, signal?: AbortSignal): Promise<Uint8Array>
  listDir(target: unknown, signal?: AbortSignal): Promise<unknown[]>
  stat(target: unknown, signal?: AbortSignal): Promise<unknown>
  lstat(path: string, opts?: unknown, signal?: AbortSignal): Promise<unknown>
  watch(target: unknown, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>>
  writeText(target: unknown, content: string, expected?: unknown, signal?: AbortSignal, policy?: unknown): Promise<unknown>
  editText(target: unknown, edit: unknown, expected?: unknown, signal?: AbortSignal, policy?: unknown): Promise<unknown>
}

/**
 * The THREE `FileSystem` methods 0.2.2-rc.5 added — `patchText`, `deleteFile`,
 * `moveFile` (`@deepseek-ai/dsh-fs`'s abstract class).
 *
 * WHY THEY ARE NOT ON {@link FsProviderSurface}: this repo compiles against
 * 0.2.0-rc.2's provider type, which has none of them. Declaring them on the
 * surface the subclass `extends` would make the repo's tsc demand them from
 * every rc.2 provider AND would turn the subclass's own declarations into
 * `noImplicitOverride` violations. A separate, minimal surface keeps the
 * version reality explicit: on rc.2 these are EXTRA methods the subclass
 * declares; on rc.5 they override the base's. The ONE cast that reaches the
 * base implementation is local to the factory below (see `baseNew`), and a
 * base that does not implement a method is a TYPED refusal, never a fallthrough.
 */
export interface FsNewMethodSurface {
  patchText(target: unknown, hunks: unknown, expected?: unknown, signal?: AbortSignal, sandboxPolicy?: unknown): Promise<unknown>
  deleteFile(target: unknown, expected?: unknown, signal?: AbortSignal, sandboxPolicy?: unknown): Promise<unknown>
  moveFile(source: unknown, destination: unknown, options: unknown, signal?: AbortSignal, sandboxPolicy?: unknown): Promise<unknown>
}

/** A Provider constructor that Cordis can mount as the `fs` service. */
export type FsProviderConstructor = new (ctx: Context, config?: Record<string, unknown>) => FsProviderSurface

/** Host sandbox modes, strictest first — the ladder `hostPolicyOf` narrows on. */
const STRICTNESS: readonly string[] = Object.freeze(['read-only', 'workspace-write', 'danger-full-access'])

/**
 * The write half of the managed surface (everything else is read).
 *
 * rc.5's three additions are WRITE-axis entry points and are judged exactly
 * like the two they extend: `patchText` like `editText` (same path, same lane),
 * `deleteFile` like a write of the file it removes, and `moveFile` on BOTH
 * paths — the source is removed (a write on an existing file) and the
 * destination is published (a write, plus a read when it already exists).
 */
const WRITE_METHODS: ReadonlySet<string> = new Set(['writeText', 'editText', 'patchText', 'deleteFile', 'moveFile'])

/**
 * The policy lanes the guard reads. A Member ceiling and an effective policy
 * share exactly this shape, so the SAME guard enforces either one (the tool
 * factor of the invariant is not allowed to be decorative).
 */
export type PolicyLanes = Pick<MemberPolicy | EffectiveIoPolicy, 'memberIdentity' | 'read' | 'write'>

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
export type FsGuard = (method: string, hostPath: string, annotations?: readonly string[]) => Promise<void>

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
export function createMemberFsGuard(
  policy: PolicyLanes,
  resolver: PathIdentityResolver = NODE_PATH_IDENTITY_RESOLVER,
): FsGuard {
  return async function guard(method: string, hostPath: string): Promise<void> {
    // The lifecycle admission close comes FIRST: the lane decision is not even
    // taken for a Member whose archive/dispose has been requested, so there is
    // no allow fact to misread as "this Member was still operable".
    const closed = memberAdmissionCloseOf(policy.memberIdentity)
    if (closed !== undefined) throw new LifecycleAdmissionClosedError(closed, method, hostPath)

    const write = WRITE_METHODS.has(method)
    const lane: PathRuleSet = write ? policy.write : policy.read

    const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: write ? 'write' : 'read', resolver })
    if (decision.decision !== 'allow') {
      throw new TeamIoDenial(
        decision.decision === 'deny'
          ? (write ? 'IO_WRITE_DENIED' : 'IO_READ_DENIED')
          // A5-DUAL-PLANE-01: `ask` is a decision, and this plane cannot consume
          // one (no approval seam is wired); it refuses with its OWN code rather
          // than borrowing the "unsupported" one. Reaching the base Provider here
          // would read bytes / change a file with no approval ever requested.
          : decision.decision === 'ask' ? 'IO_ASK_REQUIRES_APPROVAL' : 'IO_POLICY_UNSUPPORTED',
        decision.detail,
        { memberIdentity: policy.memberIdentity, method, target: hostPath },
      )
    }

    if (!write) return

    // write ⇒ read, but only for an EXISTING target: creating a brand-new file
    // has nothing to read, and the upstream read-before-write policy is
    // likewise conditioned on the file existing.
    const resolved = decision.resolved
    let exists = true
    try {
      await resolver.lstat(resolved)
    } catch (error) {
      // Only "no such file" means "nothing to read". Any other failure (EACCES,
      // ELOOP, a resolver fault) is NOT evidence of absence: refuse instead of
      // silently skipping the read-before-write requirement.
      if ((error as { readonly code?: unknown }).code !== 'ENOENT') {
        throw new TeamIoDenial(
          'IO_POLICY_UNSUPPORTED',
          `could not determine whether '${hostPath}' exists (${error instanceof Error ? error.message : String(error)}); write admission cannot be proven`,
          { memberIdentity: policy.memberIdentity, method, target: hostPath },
        )
      }
      exists = false
    }
    if (!exists) return
    if (!locatorWithinRuleSet(policy.read, hostPath)) {
      throw new TeamIoDenial(
        'IO_WRITE_REQUIRES_READ',
        `native ${method} must read '${hostPath}' before rewriting it, but the Member read axis does not cover it; write does not imply read`,
        { memberIdentity: policy.memberIdentity, method, target: hostPath },
      )
    }
    const readDecision = await evaluateLocatorAccess({ lane: policy.read, locator: hostPath, access: 'read', resolver })
    if (readDecision.decision !== 'allow') {
      throw new TeamIoDenial(
        'IO_WRITE_REQUIRES_READ',
        `native ${method} must read '${hostPath}' before rewriting it, and the read axis refused it (${readDecision.decision})`,
        { memberIdentity: policy.memberIdentity, method, target: hostPath },
      )
    }
  }
}

/**
 * Create the confined Provider class for one Member: the live Provider class is
 * the base, every target-bearing method guards first and delegates second.
 * The returned constructor is mountable through Cordis (`ctx.plugin`) and
 * registers the same `fs` service name in the context it is mounted under.
 *
 * @param Base - the live provider class (rc.2 or rc.5).
 * @param guard - the Member's admission function.
 * @param memberIdentity - the Member whose refusals are recorded; carried only
 *   by the "base does not implement this rc.5 method" refusal. `install.ts`
 *   always supplies it; the default exists for derivation-only callers (the
 *   SLICE-35/36 fixtures) that mount the class without a Member.
 */
export function createConfinedFileSystemClass(
  Base: FsProviderConstructor,
  guard: FsGuard,
  memberIdentity = '',
): FsProviderConstructor {
  /**
   * THE ONE VERSION CAST, and why it is needed. This repo compiles against
   * rc.2's provider type; rc.5's three additions are not on it, so `super`'s
   * type has no such members. The implementation is looked up ONCE on the BASE
   * prototype (property lookup follows the chain, so a subclass that inherits
   * the method is found too) and invoked with `this`. Nothing is re-implemented
   * here: the effect a permitted call produces is the base Provider's own.
   */
  const baseNew = Base.prototype as unknown as Partial<FsNewMethodSurface>
  const basePatchText = baseNew.patchText
  const baseDeleteFile = baseNew.deleteFile
  const baseMoveFile = baseNew.moveFile

  class TeamConfinedFileSystem extends Base {
    /** Guard one target-bearing call, then delegate to the base Provider. */
    private async admitted(method: string, target: unknown): Promise<string> {
      const hostPath = this.processPath(target)
      await guard(method, hostPath)
      return hostPath
    }

    /**
     * The base implementation of an rc.5 method, or a TYPED refusal.
     *
     * The lane decision above has already been taken (an out-of-lane call never
     * reaches this point), so this is not a second authority: it answers the
     * separate question "can this backend perform the operation at all?".
     * Without it, an rc.2 backend would throw a bare `TypeError` on
     * `undefined(...)` — an untyped crash that a caller could mistake for a
     * tool bug instead of "this host generation does not have the method".
     */
    private baseImplementation<M extends keyof FsNewMethodSurface>(
      method: M,
      implementation: FsNewMethodSurface[M] | undefined,
      target: string,
    ): FsNewMethodSurface[M] {
      if (typeof implementation === 'function') return implementation
      throw new TeamIoDenial(
        'IO_POLICY_UNSUPPORTED',
        `this fs provider does not implement ${method}(); the operation was refused rather than falling through to a different path`,
        { memberIdentity, method, target },
      )
    }

    override async readText(target: unknown, signal?: AbortSignal): Promise<string> {
      await this.admitted('readText', target)
      return super.readText(target, signal)
    }

    override async streamText(target: unknown, signal?: AbortSignal): Promise<AsyncIterable<string>> {
      await this.admitted('streamText', target)
      return super.streamText(target, signal)
    }

    override async readBytes(target: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array> {
      await this.admitted('readBytes', target)
      return super.readBytes(target, signal, maxBytes)
    }

    override async readByteRange(target: unknown, range: unknown, signal?: AbortSignal): Promise<Uint8Array> {
      await this.admitted('readByteRange', target)
      return super.readByteRange(target, range, signal)
    }

    override async listDir(target: unknown, signal?: AbortSignal): Promise<unknown[]> {
      await this.admitted('listDir', target)
      return super.listDir(target, signal)
    }

    override async stat(target: unknown, signal?: AbortSignal): Promise<unknown> {
      await this.admitted('stat', target)
      return super.stat(target, signal)
    }

    override async lstat(path: string, opts?: unknown, signal?: AbortSignal): Promise<unknown> {
      await guard('lstat', path)
      return super.lstat(path, opts, signal)
    }

    override async watch(
      target: unknown,
      changed: (error?: Error) => void,
      signal: AbortSignal,
    ): Promise<() => Promise<void>> {
      await this.admitted('watch', target)
      return super.watch(target, changed, signal)
    }

    override async writeText(
      target: unknown,
      content: string,
      expected?: unknown,
      signal?: AbortSignal,
      policy?: unknown,
    ): Promise<unknown> {
      await this.admitted('writeText', target)
      return super.writeText(target, content, expected, signal, this.hostPolicyOf(policy))
    }

    override async editText(
      target: unknown,
      edit: unknown,
      expected?: unknown,
      signal?: AbortSignal,
      policy?: unknown,
    ): Promise<unknown> {
      await this.admitted('editText', target)
      return super.editText(target, edit, expected, signal, this.hostPolicyOf(policy))
    }

    /**
     * rc.5 `patchText` — judged EXACTLY like `editText`: the same target, the
     * write axis, and (when the file exists) the read coverage the native
     * read-before-mutate contract requires. `apply_patch` therefore cannot
     * reach the backend without the Member's lane. No `override` modifier: the
     * rc.2 type this file compiles against has no such member.
     */
    async patchText(
      target: unknown,
      hunks: unknown,
      expected?: unknown,
      signal?: AbortSignal,
      policy?: unknown,
    ): Promise<unknown> {
      const hostPath = await this.admitted('patchText', target)
      const implementation = this.baseImplementation('patchText', basePatchText, hostPath)
      return implementation.call(this, target, hunks, expected, signal, this.hostPolicyOf(policy))
    }

    /**
     * rc.5 `deleteFile` — judged like a WRITE of the file it removes: the write
     * axis decides, and because the target exists by construction the existing
     * `write ⇒ read` rule also applies (a lane that may delete but not read a
     * file is refused, exactly as a lane that may overwrite but not read it).
     */
    async deleteFile(
      target: unknown,
      expected?: unknown,
      signal?: AbortSignal,
      policy?: unknown,
    ): Promise<unknown> {
      const hostPath = await this.admitted('deleteFile', target)
      const implementation = this.baseImplementation('deleteFile', baseDeleteFile, hostPath)
      return implementation.call(this, target, expected, signal, this.hostPolicyOf(policy))
    }

    /**
     * rc.5 `moveFile` — TWO paths, and BOTH are judged before anything happens.
     *
     * The SOURCE is removed: it is an existing file the operation must rewrite,
     * so it gets the same admission `editText` gives (write axis + read
     * coverage). The DESTINATION is published: it gets the write admission
     * `writeText` gives, including the read requirement when the destination
     * already exists. Either refusal happens BEFORE the base Provider runs, so a
     * move whose destination is out of lane changes nothing at all (the source
     * is not removed either).
     *
     * WHY THERE IS NO SEPARATE "cross-root" REFUSAL: the Member lane has no root
     * of its own beyond its `allow` locators (each is a subtree root), and the
     * rule the product already owns is PER PATH. A move between two different
     * allow roots therefore succeeds only when the source passes the source
     * admission AND the destination passes the destination admission — which is
     * exactly the composition rule for "write here, delete there". Adding a
     * distinct cross-root ban would be a policy the owner never authored (a
     * second authority), and the rc.5 provider's own move is a publish-then-
     * remove with no rename, so no cross-filesystem constraint exists to mirror.
     * The arms pin both the admitted cross-root case and the refused one.
     */
    async moveFile(
      source: unknown,
      destination: unknown,
      options: unknown,
      signal?: AbortSignal,
      policy?: unknown,
    ): Promise<unknown> {
      const sourcePath = this.processPath(source)
      await guard('moveFile', sourcePath)
      const destinationPath = this.processPath(destination)
      await guard('moveFile', destinationPath)
      const implementation = this.baseImplementation('moveFile', baseMoveFile, `${sourcePath} -> ${destinationPath}`)
      return implementation.call(this, source, destination, options, signal, this.hostPolicyOf(policy))
    }

    /**
     * The per-call HOST policy, always NARROWED, never substituted (PD-17).
     *
     * WHY IT IS FORWARDED AT ALL: the host `write`/`edit` tools build a policy
     * from the CALLING SESSION (mode + the session workspace root) and hand it
     * to the provider on every mutation. Without it the base `fs-sandbox`
     * falls back to the DEPLOYMENT default root, which is not the session
     * workspace, so a write the Member lane had just admitted inside its own
     * ceiling was refused by the HOST fence (`FS_SANDBOX_DENIED` under
     * `workspace-write`) — measured live: Member A could read `workspace/lane-a`
     * but not write it. The Member ceiling is decided BEFORE this call and is
     * not re-derived here; this only restores the host fence's own root.
     *
     * WHY IT CANNOT WIDEN ANYTHING: the forwarded mode is the STRICTER of the
     * caller's mode and this deployment's default (`read-only` <
     * `workspace-write` < `danger-full-access`). An escalation stamp can
     * therefore never make the host fence weaker than this deployment's own
     * default, and it can never make the MEMBER lane admit a locator it refused
     * — that decision is already final. When the base provider exposes no
     * `sandboxMode` (not a sandboxing backend) the policy is forwarded
     * untouched: there is no deployment mode to narrow against.
     */
    private hostPolicyOf(policy: unknown): unknown {
      if (policy === undefined || policy === null || typeof policy !== 'object') return policy
      const deployment = (this as unknown as { sandboxMode?: unknown }).sandboxMode
      if (typeof deployment !== 'string') return policy
      const caller = (policy as { mode?: unknown }).mode
      if (typeof caller !== 'string') return policy
      const narrowed = STRICTNESS.indexOf(caller) < STRICTNESS.indexOf(deployment) ? caller : deployment
      return Object.freeze({ ...(policy as Record<string, unknown>), mode: narrowed })
    }
  }

  return TeamConfinedFileSystem as unknown as FsProviderConstructor
}
