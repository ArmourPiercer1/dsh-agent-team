/**
 * Alpha.5 P1-08 — PTY / persistent-process lifecycle bound to a trusted Member.
 *
 * A persistent shell is the one execution surface that OUTLIVES a call, so the
 * policy must be bound to the DOMAIN, not to each command:
 *
 *  - identity comes from a trusted TeamDomain MemberInstance + tool binding
 *    reference (`TerminalOwner`), never from a caps file, a session label or
 *    argv. A caller that cannot present a registered owner is refused;
 *  - the domain records the policy revision, the backend and the PTY pid AT
 *    CREATION, and every command re-checks the CURRENT revision before it is
 *    allowed to run in that shell (`assertCurrent`). A tightened or revoked
 *    policy marks the domain stale, refuses new commands and terminates it;
 *  - reusing a domain of the SAME generation is the normal path: the shell is
 *    NOT restarted per command (the native PTY lifecycle is preserved);
 *  - `danger-full-access` does not erase the ceiling: the domain still records
 *    its revision and still obeys revocation — a one-shot approval is never
 *    turned into a permanent PTY grant because approvals are not stored here at
 *    all (Alpha.4 owns them; this registry only compares revisions).
 *
 * The registry is a PURE lifecycle state machine over an injected PTY port. It
 * creates no process by itself; the real PTY backend is the host's terminal
 * service, and its pid/descendants are recorded through `PtyPort`.
 *
 * @module @dsh-agent-team/runtime/team-sandbox/terminal
 */

import type { TrustedMemberIdentity } from '../../member-io-policy/src/types.js'

/** The trusted owner of a PTY domain: a TeamDomain member instance. */
export interface TerminalOwner {
  readonly identity: TrustedMemberIdentity
  /** The tool binding this shell was opened through (audit identity). */
  readonly toolBindingIdentity: string
}

/** What the caller wants: a persistent shell for one member/binding. */
export interface TerminalAcquireSpec {
  readonly owner: TerminalOwner
  /** Opaque session handle minted by the caller; never trusted for identity. */
  readonly sessionHandle: string
  /** The policy revision the caller believes is current. */
  readonly policyRevision: string
  /** Backend type reported by the native configuration (e.g. `pty`, `pipe`). */
  readonly backend: string
  /** Spawn the shell through the injected PTY port (called once per domain). */
  readonly spawn: () => Promise<PtyHandle>
}

/** The injected PTY port: one live shell process. */
export interface PtyHandle {
  readonly pid: number
  readonly backend: string
  /** Live descendant pids (the boundary the Gate observes). */
  descendants(): readonly number[]
  kill(signal?: 'SIGTERM' | 'SIGKILL'): Promise<void>
}

export const TERMINAL_REFUSAL_CODES = [
  'OWNER_UNTRUSTED',
  'OWNER_MISMATCH',
  'DOMAIN_REVOKED',
  'REVISION_STALE',
  'REVISION_UNKNOWN',
  'SPAWN_FAILED',
] as const

export type TerminalRefusalCode = (typeof TERMINAL_REFUSAL_CODES)[number]

/**
 * `revoke`'s identity refusal. A revoke that cannot name a whole trusted
 * generation must FAIL CLOSED: recording a guessed generation (or a
 * `memberInstanceId`-wide tombstone) would either miss the real generation or
 * block a legitimately re-created one. The caller gets a typed throw, never a
 * silent no-op.
 */
export const TERMINAL_REVOKE_REFUSAL_CODE = 'REVOKE_IDENTITY_UNTRUSTED' as const

export class TerminalRevokeRefusalError extends Error {
  readonly code = TERMINAL_REVOKE_REFUSAL_CODE

  constructor(detail: string) {
    super(detail)
    this.name = 'TerminalRevokeRefusalError'
  }
}

export interface TerminalRefusal {
  readonly ok: false
  readonly code: TerminalRefusalCode
  readonly detail: string
}

export type TerminalStatus = 'active' | 'stale' | 'terminated'

/** One persistent domain (one shell) and its audit facts. */
export interface TerminalDomain {
  readonly domainId: string
  readonly owner: TerminalOwner
  readonly sessionHandle: string
  /** Policy revision recorded AT CREATION. */
  readonly policyRevision: string
  readonly createdAt: string
  readonly pty: PtyHandle
  readonly backend: string
  readonly pid: number
  status: TerminalStatus
}

export interface TerminalAcquireReceipt {
  readonly domainId: string
  readonly reused: boolean
  readonly policyRevision: string
  readonly backend: string
  readonly pid: number
}

export interface TerminalShutdownReceipt {
  readonly domains: readonly {
    readonly domainId: string
    readonly memberInstanceId: string
    readonly policyRevision: string
    readonly pid: number
    readonly descendants: readonly number[]
    readonly killed: boolean
  }[]
}

export interface TerminalDomainRegistry {
  acquire(spec: TerminalAcquireSpec): Promise<{ ok: true; value: TerminalAcquireReceipt } | TerminalRefusal>
  /** Re-check the CURRENT revision before a command runs in `domainId`. */
  assertCurrent(domainId: string): { ok: true; revision: string } | TerminalRefusal
  /**
   * Revoke ONE GENERATION of one member. The trusted identity supplies the
   * generation, so the key is recorded even when the member owns no live
   * domain (PD-1). The identity is rejected as a whole if it is incomplete.
   */
  revoke(identity: TrustedMemberIdentity, reason?: string): Promise<readonly string[]>
  list(): readonly TerminalDomain[]
  shutdown(): Promise<TerminalShutdownReceipt>
}

export interface TerminalRegistryOptions {
  /** The CURRENT policy revision for a member, from the trusted policy lane. */
  readonly currentRevision: (identity: TrustedMemberIdentity) => string | undefined
  /** Wall-clock injected by the caller (the lane never reads the clock). */
  readonly now: () => string
  /** Trusted-member predicate: the registry refuses anything else. */
  readonly isTrustedMember: (identity: TrustedMemberIdentity) => boolean
}

const keyOf = (owner: TerminalOwner): string => `${owner.identity.teamId}/${owner.identity.memberInstanceId}/${owner.toolBindingIdentity}`

/** Revocation is per GENERATION: a member re-created at a new generation may acquire again. */
const memberKey = (identity: TrustedMemberIdentity): string =>
  `${identity.teamId}/${identity.memberInstanceId}#${String(identity.instanceGeneration)}`

/**
 * Create the domain registry. Every mutation is synchronous inside one
 * microtask boundary except `spawn`, so two concurrent acquires for the same
 * member/binding cannot create two shells: the second finds the domain the
 * first registered (the registry records the in-flight promise).
 */
export function createTerminalDomainRegistry(options: TerminalRegistryOptions): TerminalDomainRegistry {
  const domains = new Map<string, TerminalDomain>()
  const pending = new Map<string, Promise<{ ok: true; value: TerminalAcquireReceipt } | TerminalRefusal>>()
  const dead = new Map<string, string>() // domainId -> termination reason (audit)
  const revokedMembers = new Set<string>()
  let sequence = 0

  async function killDomain(domain: TerminalDomain, reason: string): Promise<void> {
    domain.status = 'stale'
    try {
      await domain.pty.kill('SIGKILL')
    } catch {
      // A shell that already died is still a closed domain.
    }
    domain.status = 'terminated'
    dead.set(domain.domainId, reason)
  }

  async function acquire(spec: TerminalAcquireSpec): Promise<{ ok: true; value: TerminalAcquireReceipt } | TerminalRefusal> {
    const { identity } = spec.owner
    if (!identity.teamId || !identity.memberInstanceId || !Number.isFinite(identity.instanceGeneration)) {
      return Object.freeze({ ok: false, code: 'OWNER_UNTRUSTED' as const, detail: 'a PTY domain needs a complete trusted member identity' })
    }
    if (!options.isTrustedMember(identity)) {
      return Object.freeze({ ok: false, code: 'OWNER_UNTRUSTED' as const, detail: `'${identity.memberInstanceId}' is not a trusted TeamDomain member` })
    }
    if (revokedMembers.has(memberKey(identity))) {
      return Object.freeze({ ok: false, code: 'DOMAIN_REVOKED' as const, detail: `'${identity.memberInstanceId}' is revoked; a new shell requires a new generation` })
    }
    const current = options.currentRevision(identity)
    if (current === undefined) {
      return Object.freeze({ ok: false, code: 'REVISION_UNKNOWN' as const, detail: `no current policy revision for '${identity.memberInstanceId}'` })
    }
    if (current !== spec.policyRevision) {
      return Object.freeze({ ok: false, code: 'REVISION_STALE' as const, detail: `caller revision '${spec.policyRevision}' is not current ('${current}')` })
    }

    const key = keyOf(spec.owner)
    const existing = domains.get(key)
    if (existing !== undefined) {
      if (existing.status === 'active' && existing.policyRevision === current) {
        // Same generation, same revision: reuse the live shell (no restart).
        return Object.freeze({
          ok: true,
          value: Object.freeze({ domainId: existing.domainId, reused: true, policyRevision: existing.policyRevision, backend: existing.backend, pid: existing.pid }),
        })
      }
      // Tightened/older domain: kill it, then open a fresh one below.
      await killDomain(existing, `superseded by revision '${current}'`)
      domains.delete(key)
    }
    const inFlight = pending.get(key)
    if (inFlight !== undefined) return inFlight

    const task = (async (): Promise<{ ok: true; value: TerminalAcquireReceipt } | TerminalRefusal> => {
      try {
        const pty = await spec.spawn()
        sequence += 1
        const domain: TerminalDomain = {
          domainId: `terminal-${sequence}`,
          owner: spec.owner,
          sessionHandle: spec.sessionHandle,
          policyRevision: current,
          createdAt: options.now(),
          pty,
          backend: pty.backend,
          pid: pty.pid,
          status: 'active',
        }
        // PD-1 RACE WINDOW — `revoke` can land while `spawn()` is awaited. The
        // gate at the top of `acquire` ran BEFORE the await, and the domain is
        // not in `domains` yet, so `revoke` cannot see it in its kill loop.
        // Re-check the generation's revocation key BEFORE publishing; a late
        // creation that lost the race must be reaped and refused, never made
        // eligible for execution.
        if (revokedMembers.has(memberKey(identity))) {
          await killDomain(domain, 'revocation landed while the shell was being created')
          return Object.freeze({
            ok: false,
            code: 'DOMAIN_REVOKED' as const,
            detail: `'${identity.memberInstanceId}' was revoked while its shell was being created; the spawned shell was reaped`,
          })
        }
        domains.set(key, domain)
        return Object.freeze({
          ok: true,
          value: Object.freeze({ domainId: domain.domainId, reused: false, policyRevision: domain.policyRevision, backend: domain.backend, pid: domain.pid }),
        })
      } catch (error) {
        return Object.freeze({
          ok: false,
          code: 'SPAWN_FAILED' as const,
          detail: `PTY spawn failed: ${error instanceof Error ? error.message : String(error)}`,
        })
      } finally {
        pending.delete(key)
      }
    })()
    pending.set(key, task)
    return task
  }

  /**
   * The ONE currency predicate: the command gate and `list()` both answer from
   * this function, so the reported state cannot drift from the enforced one.
   * PD-7 was that drift: `list()` said `active` while this function refused
   * the same domain with `REVISION_STALE`.
   */
  function assertCurrent(domainId: string): { ok: true; revision: string } | TerminalRefusal {
    const domain = [...domains.values()].find((candidate) => candidate.domainId === domainId)
    if (domain === undefined) return Object.freeze({ ok: false, code: 'DOMAIN_REVOKED' as const, detail: `domain '${domainId}' does not exist (terminated or never created)` })
    if (domain.status !== 'active') return Object.freeze({ ok: false, code: 'DOMAIN_REVOKED' as const, detail: `domain '${domainId}' is ${domain.status}: ${dead.get(domainId) ?? 'no reason recorded'}` })
    const current = options.currentRevision(domain.owner.identity)
    if (current === undefined) return Object.freeze({ ok: false, code: 'REVISION_UNKNOWN' as const, detail: `no current revision for '${domain.owner.identity.memberInstanceId}'` })
    if (current !== domain.policyRevision) return Object.freeze({ ok: false, code: 'REVISION_STALE' as const, detail: `domain '${domainId}' was created under '${domain.policyRevision}', current is '${current}'; the shell is stale` })
    return Object.freeze({ ok: true, revision: domain.policyRevision })
  }

  return Object.freeze({
    acquire,
    assertCurrent,
    async revoke(identity: TrustedMemberIdentity, reason = 'revoked'): Promise<readonly string[]> {
      // FAIL CLOSED: a call that cannot supply the generation must not guess
      // one (a guessed key misses the real generation) and must not fall back
      // to a member-wide tombstone (that would block a re-created generation).
      if (!identity || !identity.teamId || !identity.memberInstanceId || !Number.isFinite(identity.instanceGeneration)) {
        throw new TerminalRevokeRefusalError(
          'revoke needs a complete trusted member identity (teamId, memberInstanceId, instanceGeneration); an incomplete identity is refused rather than guessed',
        )
      }
      const revokedKey = memberKey(identity)
      // PD-1 FIX — record the generation UNCONDITIONALLY, before the first
      // await, including when the member owns no live domain. This is the key
      // `acquire` consults at the gate above (and again after `spawn`).
      revokedMembers.add(revokedKey)
      const killed: string[] = []
      for (const domain of [...domains.values()]) {
        if (memberKey(domain.owner.identity) !== revokedKey) continue
        // Defence in depth: keep the historical live-domain record too, so a
        // visible domain's generation is revoked even if the unconditional
        // record above were ever skipped.
        revokedMembers.add(memberKey(domain.owner.identity))
        await killDomain(domain, reason)
        domains.delete(keyOf(domain.owner))
        killed.push(domain.domainId)
      }
      return Object.freeze(killed)
    },
    list(): readonly TerminalDomain[] {
      return Object.freeze([...domains.values()].map((domain) => (assertCurrent(domain.domainId).ok ? domain : reportedDomain(domain))))
    },
    async shutdown(): Promise<TerminalShutdownReceipt> {
      const rows: TerminalShutdownReceipt['domains'][number][] = []
      for (const domain of [...domains.values()]) {
        const descendants = domain.pty.descendants()
        await killDomain(domain, 'shutdown')
        domains.delete(keyOf(domain.owner))
        rows.push(Object.freeze({
          domainId: domain.domainId,
          memberInstanceId: domain.owner.identity.memberInstanceId,
          policyRevision: domain.policyRevision,
          pid: domain.pid,
          descendants: Object.freeze([...descendants]),
          killed: domain.status === 'terminated',
        }))
      }
      return Object.freeze({ domains: Object.freeze(rows) })
    },
  })
}

/**
 * The status `list()` reports: the command gate's answer translated into the
 * status vocabulary (`REVISION_STALE`/`REVISION_UNKNOWN` -> `stale`). A domain
 * that is already stale/terminated keeps its own status.
 */
function reportedDomain(domain: TerminalDomain): TerminalDomain {
  return domain.status === 'active' ? Object.freeze({ ...domain, status: 'stale' as const }) : domain
}
