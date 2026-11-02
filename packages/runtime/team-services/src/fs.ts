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
 * WHAT IT DOES NOT DO: it does not resolve or read anything itself (every
 * operation is `super.<method>`), does not know about tools or approvals, and
 * does not weaken the host Provider — a refusal is raised BEFORE the operation,
 * a permitted call behaves byte-for-byte like the base Provider.
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
import type { MemberPolicy, PathRuleSet } from '../../member-io-policy/src/types.js'
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

/** A Provider constructor that Cordis can mount as the `fs` service. */
export type FsProviderConstructor = new (ctx: Context, config?: Record<string, unknown>) => FsProviderSurface

/**
 * Methods the confined subclass must find on the live Provider to enforce the
 * ceiling. `resolve`/`contains` are deliberately NOT required here: they are
 * resolution-only and stay unguarded, and a provider without them fails at the
 * tool layer, not at the ceiling.
 */
export const REQUIRED_PROVIDER_METHODS = [
  'resolve',
  'processPath',
  'readText',
  'streamText',
  'readBytes',
  'readByteRange',
  'listDir',
  'stat',
  'lstat',
  'watch',
  'writeText',
  'editText',
] as const

/** The write half of the managed surface (everything else is read). */
const WRITE_METHODS: ReadonlySet<string> = new Set(['writeText', 'editText'])

/**
 * Enumerate the missing pieces of a Provider surface. Empty means the Provider
 * can be confined without silently dropping an operation (a missing method must
 * never mean "unrestricted": that would let `streamText` bypass the read axis).
 */
export function providerSurfaceProblems(provider: unknown): readonly string[] {
  const surface = provider as Record<string, unknown> | null | undefined
  if (surface === null || typeof surface !== 'object') return [...REQUIRED_PROVIDER_METHODS]
  return REQUIRED_PROVIDER_METHODS.filter((method) => typeof surface[method] !== 'function')
}

/** The per-call admission function the subclass calls before delegating. */
export type FsGuard = (method: string, hostPath: string) => Promise<void>

/**
 * Build the admission function for one Member. All checks are fail-closed:
 * a resolver failure, an unsupported destination, an uncovered target or a
 * write without read coverage all throw a typed {@link TeamIoDenial}; there is
 * no path that returns "allow" by omission.
 */
export function createMemberFsGuard(
  policy: MemberPolicy,
  resolver: PathIdentityResolver = NODE_PATH_IDENTITY_RESOLVER,
): FsGuard {
  return async function guard(method: string, hostPath: string): Promise<void> {
    const write = WRITE_METHODS.has(method)
    const lane: PathRuleSet = write ? policy.write : policy.read

    const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: write ? 'write' : 'read', resolver })
    if (decision.decision !== 'allow') {
      throw new TeamIoDenial(
        decision.decision === 'deny' ? (write ? 'IO_WRITE_DENIED' : 'IO_READ_DENIED') : 'IO_POLICY_UNSUPPORTED',
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
    } catch {
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
 */
export function createConfinedFileSystemClass(
  Base: FsProviderConstructor,
  guard: FsGuard,
): FsProviderConstructor {
  class TeamConfinedFileSystem extends Base {
    /** Guard one target-bearing call, then delegate to the base Provider. */
    private async admitted(method: string, target: unknown): Promise<string> {
      const hostPath = this.processPath(target)
      await guard(method, hostPath)
      return hostPath
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
      return super.writeText(target, content, expected, signal, policy)
    }

    override async editText(
      target: unknown,
      edit: unknown,
      expected?: unknown,
      signal?: AbortSignal,
      policy?: unknown,
    ): Promise<unknown> {
      await this.admitted('editText', target)
      return super.editText(target, edit, expected, signal, policy)
    }
  }

  return TeamConfinedFileSystem as unknown as FsProviderConstructor
}
