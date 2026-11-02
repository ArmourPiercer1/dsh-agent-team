/**
 * Alpha.5 P1-05 — Service-realm vocabulary for per-Member I/O Providers.
 *
 * A Member's I/O policy is only real if the PROVIDER that serves its tools is
 * that Member's provider. This module names the closed vocabulary of the
 * install/denial receipts shared by `fs.ts` and `install.ts`; it holds no I/O.
 *
 * Two separate concerns, deliberately not merged:
 *  - `TEAM_IO_DENIAL_CODES` — the per-call refusal an installed Provider raises
 *    when the compiled policy does not cover the target. Raised INSIDE the
 *    provider method, so the native tool sees a typed failure and never a
 *    silent success.
 *  - `TEAM_SERVICE_INSTALL_CODES` — the install-time refusal: the whole Member
 *    service realm is not installed (and the Team refuses) rather than a
 *    partially-installed scope that would run tools against the host provider.
 *
 * @module @dsh-agent-team/runtime/team-services/types
 */

import type { Context } from '@deepseek-ai/cordis'
import type { TrustedMemberIdentity } from '../../member-io-policy/src/types.js'
import type { FsProviderSurface } from './fs.js'

/** Closed per-call denial vocabulary of an installed Provider. */
export const TEAM_IO_DENIAL_CODES = [
  'IO_READ_DENIED',
  'IO_WRITE_DENIED',
  'IO_WRITE_REQUIRES_READ',
  'IO_POLICY_UNSUPPORTED',
] as const

export type TeamIoDenialCode = (typeof TEAM_IO_DENIAL_CODES)[number]

/** Closed install-time refusal vocabulary. */
export const TEAM_SERVICE_INSTALL_CODES = [
  'MEMBER_POLICY_UNAVAILABLE',
  'MEMBER_POLICY_STALE',
  'MEMBER_IDENTITY_INVALID',
  'MEMBER_DUPLICATE',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_INCOMPATIBLE',
  'SERVICE_ALREADY_INSTALLED',
  'SERVICE_MOUNT_FAILED',
] as const

export type TeamServiceInstallCode = (typeof TEAM_SERVICE_INSTALL_CODES)[number]

/**
 * The per-call denial raised by an installed Provider method. Carries the
 * closed code, the member identity and the method so the tool layer and the
 * audit trail never depend on message text.
 */
export class TeamIoDenial extends Error {
  readonly code: TeamIoDenialCode
  readonly memberIdentity: string
  readonly method: string
  readonly target: string

  constructor(code: TeamIoDenialCode, message: string, fields: {
    readonly memberIdentity: string
    readonly method: string
    readonly target: string
  }) {
    super(message)
    this.name = 'TeamIoDenial'
    this.code = code
    this.memberIdentity = fields.memberIdentity
    this.method = fields.method
    this.target = fields.target
  }
}

/** The install-time refusal. `reveal` is a JSON-ish path for diagnostics. */
export class TeamServiceInstallError extends Error {
  readonly code: TeamServiceInstallCode
  readonly reveal: string
  readonly detail: string

  constructor(code: TeamServiceInstallCode, detail: string, reveal = 'members') {
    super(`${code}: ${detail}`)
    this.name = 'TeamServiceInstallError'
    this.code = code
    this.reveal = reveal
    this.detail = detail
  }
}

/**
 * One Member's installed realm: the isolated Context that carries the
 * confined Provider, the Provider itself, and the audit receipt of WHICH
 * policy revision the Provider serves. `dispose` removes the Provider from the
 * isolated scope and is idempotent.
 */
export interface MemberServiceInstallation {
  readonly identity: TrustedMemberIdentity
  readonly serviceIdentity: Readonly<{
    /** Team the realm belongs to. */
    readonly teamId: string
    readonly memberInstanceId: string
    /** The compiled policy revision this Provider enforces. */
    readonly policyRevision: string
    /** Monotonic instance generation the policy was compiled for. */
    readonly instanceGeneration: number
  }>
  readonly ctx: Context
  readonly fs: FsProviderSurface
  readonly dispose: () => Promise<void>
}

export interface MemberIoInstallation {
  readonly members: readonly MemberServiceInstallation[]
  /** Removes EVERY installed Member realm, in reverse install order. */
  readonly dispose: () => Promise<void>
}
