/**
 * Bounded READ pilot — closed typed error surface.
 *
 * Law (B-READ-PILOT-DESIGN.md §6 root constraint ②): any mismatch of
 * policy / binding revision / generation / identity / revocation is a TYPED
 * reject; error payloads NEVER carry file content fragments. Field refusals
 * name the rejected field verbatim (no silent stripping).
 *
 * @module evidence-governed-fs/errors
 */

/** Closed code set — extend only with a design ruling, never ad hoc. */
export type GovernedFsErrorCode =
  | 'GOV_NOT_FOUND'
  | 'GOV_NOT_REGULAR'
  | 'GOV_ELOOP'
  | 'GOV_HARDLINK'
  | 'GOV_TOO_LARGE'
  | 'GOV_OUTSIDE_ROOT'
  | 'GOV_FOREIGN_ROOT'
  | 'GOV_NO_PROC'
  | 'GOV_REOPEN_FORBIDDEN'
  | 'GOV_ADMISSION_MISSING'
  | 'GOV_ADMISSION_DIVERGENT'
  | 'GOV_ABANDONED_REVOKED'
  | 'GOV_PROFILE_UNSUPPORTED'
  | 'GOV_FIELD_UNSUPPORTED'
  | 'GOV_ABORTED'
  | 'GOV_BAD_ARGS'
  | 'GOV_IO'

export class GovernedFsError extends Error {
  readonly code: GovernedFsErrorCode

  constructor (code: GovernedFsErrorCode, message: string) {
    super(message)
    this.name = 'GovernedFsError'
    this.code = code
  }
}
