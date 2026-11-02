/**
 * Alpha.5 P1-05 — install the per-Member Service realm.
 *
 * ONE root Context (the Host), N isolated `fs` scopes (one per Member). The
 * isolated scope is `root.isolate('fs', label)`: below it, reads and writes of
 * `ctx.fs` resolve against that Member's confined Provider, while the root's
 * provider and every other Member keep their own. The same tool name registered
 * in two Member scopes therefore resolves its OWN provider at call time — the
 * property that makes per-Member I/O governance real instead of cosmetic.
 *
 * INSTALL IS ALL-OR-NOTHING. Every Member's policy is validated and the live
 * Provider's managed surface is inspected BEFORE the first scope is created; a
 * refusal (uncompiled policy, duplicate identity, missing/incompatible
 * Provider, a mount that throws) disposes anything already mounted and rejects
 * with a typed {@link TeamServiceInstallError}. A partially installed realm
 * would run some tools against the host Provider, which is exactly the failure
 * mode this gate exists to prevent, so the Team refuses as a whole.
 *
 * NOT IN THIS MODULE: policy compilation (P1-02), invocation binding (P1-04),
 * web/subprocess providers (P1-06/P2), and any approval logic.
 *
 * @module @dsh-agent-team/runtime/team-services/install
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CompileResult, MemberPolicy, TrustedMemberIdentity } from '../../member-io-policy/src/types.js'
import {
  createConfinedFileSystemClass,
  providerSurfaceProblems,
  type FsProviderConstructor,
} from './fs.js'
import {
  TeamServiceInstallError,
  type MemberIoInstallation,
  type MemberServiceInstallation,
} from './types.js'

/** One Member to install: identity + its compiled policy (or the refusal). */
export interface MemberServiceSpec {
  readonly identity: TrustedMemberIdentity
  readonly policy: CompileResult<MemberPolicy>
  /** Provider config (e.g. the session workspace cwd). Never policy. */
  readonly config?: Record<string, unknown>
}

export interface InstallMemberIoProvidersInput {
  readonly root: Context
  readonly members: readonly MemberServiceSpec[]
  /**
   * Explicit base Provider class. Omitted = sample the LIVE provider mounted at
   * the root (`Object.getPrototypeOf(root.get('fs')).constructor`), which is
   * how a real Host installs `fs-local` / `fs-sandbox` semantics.
   */
  readonly providerClass?: FsProviderConstructor
}

/** Member id → installed, per root Context. Guards double installation. */
const INSTALLED = new WeakMap<Context, Map<string, MemberServiceInstallation>>()

function assertSpec(spec: MemberServiceSpec): MemberPolicy {
  const { identity, policy } = spec
  if (!identity.teamId || !identity.memberInstanceId || !identity.templateId) {
    throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', 'a Member identity needs teamId, memberInstanceId and templateId')
  }
  if (!Number.isFinite(identity.instanceGeneration) || identity.instanceGeneration < 0) {
    throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', `Member '${identity.memberInstanceId}' has an invalid instance generation`)
  }
  if (!policy.ok) {
    throw new TeamServiceInstallError(
      'MEMBER_POLICY_UNAVAILABLE',
      `Member '${identity.memberInstanceId}' has no compiled policy (${policy.code}: ${policy.detail}); a Member never runs on an uncompiled ceiling`,
      policy.path,
    )
  }
  const compiled = policy.value
  if (compiled.memberIdentity !== identity.memberInstanceId) {
    throw new TeamServiceInstallError(
      'MEMBER_IDENTITY_INVALID',
      `policy was compiled for '${compiled.memberIdentity}', not '${identity.memberInstanceId}'`,
    )
  }
  if (!compiled.revision) {
    throw new TeamServiceInstallError('MEMBER_POLICY_UNAVAILABLE', 'a compiled policy must carry its revision')
  }
  return compiled
}

/** Sample the live Provider class from the root service, if any. */
function sampleProviderClass(root: Context): FsProviderConstructor | undefined {
  const live = root.get('fs') as object | undefined
  if (live === undefined || live === null) return undefined
  const prototype = Object.getPrototypeOf(live) as { constructor?: unknown } | null
  const ctor = prototype?.constructor
  return typeof ctor === 'function' ? (ctor as FsProviderConstructor) : undefined
}

/**
 * Install one confined Provider per Member into its own isolated `fs` scope.
 * Resolves only when every Member is installed; rejects (typed) otherwise.
 */
export async function installMemberIoProviders(
  input: InstallMemberIoProvidersInput,
): Promise<MemberIoInstallation> {
  const { root, members } = input
  if (members.length === 0) {
    throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', 'install requires at least one Member')
  }

  // 1. Validate EVERY Member before touching the Context (atomic install).
  const compiled = members.map((spec) => ({ spec, policy: assertSpec(spec) }))
  const seen = new Set<string>()
  for (const { spec } of compiled) {
    if (seen.has(spec.identity.memberInstanceId)) {
      throw new TeamServiceInstallError('MEMBER_DUPLICATE', `Member '${spec.identity.memberInstanceId}' is listed twice`)
    }
    seen.add(spec.identity.memberInstanceId)
    if (INSTALLED.get(root)?.has(spec.identity.memberInstanceId)) {
      throw new TeamServiceInstallError(
        'SERVICE_ALREADY_INSTALLED',
        `Member '${spec.identity.memberInstanceId}' already has an installed service realm in this Context`,
      )
    }
  }

  // 2. Resolve and inspect the base Provider (before any scope exists).
  const Base = input.providerClass ?? sampleProviderClass(root)
  if (Base === undefined) {
    throw new TeamServiceInstallError(
      'PROVIDER_UNAVAILABLE',
      'no live fs Provider at the root and no providerClass supplied; a Member never falls back to the raw host filesystem',
    )
  }
  const problems = providerSurfaceProblems(Base.prototype)
  if (problems.length > 0) {
    throw new TeamServiceInstallError(
      'PROVIDER_INCOMPATIBLE',
      `the base Provider cannot be confined without dropping operations: missing ${problems.join(', ')}`,
    )
  }

  // 3. Mount, tracking every fiber so a later failure can roll back.
  const installed: MemberServiceInstallation[] = []
  const rollback = async (): Promise<void> => {
    for (const member of [...installed].reverse()) {
      try {
        await member.dispose()
      } catch {
        // Best-effort rollback: the original failure is the one reported.
      }
    }
  }

  for (const { spec, policy } of compiled) {
    const label = Symbol(`member:${spec.identity.memberInstanceId}`)
    const scoped = root.isolate('fs', label)
    const guard = (await import('./fs.js')).createMemberFsGuard(policy)
    const Confined = createConfinedFileSystemClass(Base, guard)
    let disposeMount: () => Promise<void>
    try {
      const fiber = await scoped.plugin(Confined, spec.config ?? {})
      disposeMount = async () => {
        await fiber.dispose()
      }
    } catch (error) {
      await rollback()
      throw new TeamServiceInstallError(
        'SERVICE_MOUNT_FAILED',
        `Member '${spec.identity.memberInstanceId}' service mount failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const fs = scoped.get('fs')
    if (fs === undefined) {
      await disposeMount()
      await rollback()
      throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `Member '${spec.identity.memberInstanceId}' mounted no fs service`)
    }

    let disposed = false
    const installation: MemberServiceInstallation = Object.freeze({
      identity: spec.identity,
      serviceIdentity: Object.freeze({
        teamId: spec.identity.teamId,
        memberInstanceId: spec.identity.memberInstanceId,
        policyRevision: policy.revision,
        instanceGeneration: spec.identity.instanceGeneration,
      }),
      ctx: scoped,
      fs,
      dispose: async (): Promise<void> => {
        if (disposed) return
        disposed = true
        INSTALLED.get(root)?.delete(spec.identity.memberInstanceId)
        await disposeMount()
      },
    })
    installed.push(installation)
    const registry = INSTALLED.get(root) ?? new Map<string, MemberServiceInstallation>()
    registry.set(spec.identity.memberInstanceId, installation)
    INSTALLED.set(root, registry)
  }

  let allDisposed = false
  return Object.freeze({
    members: Object.freeze([...installed]),
    dispose: async (): Promise<void> => {
      if (allDisposed) return
      allDisposed = true
      await rollback()
    },
  })
}
