/**
 * P8-S5 — the explicit S6 installation seams (plan §19.1 caveat; §20
 * scope).
 *
 * The production root assembles every §19.1 subsystem that S5 owns; the
 * three S6 completion surfaces (the projection live residency overlay,
 * the remote handler registration, the server-side principal derivation)
 * are EXPLICIT installation seams: a named, typed, fail-closed slot the
 * S6 wiring installs into. Before installation every use throws a
 * {@link TeamSeamError} with the stable code below — never a silent
 * no-op, never a partial activation.
 *
 * Seam semantics (all of them):
 *
 * - `install(impl)` is idempotent-once: the FIRST install wins; a second
 *   install throws `SEAM_ALREADY_INSTALLED` (the composition owns the
 *   seam lifetime; the S6 row installs exactly once).
 * - `current()` returns the installed implementation, or throws
 *   `SEAM_NOT_INSTALLED` (with the seam name in `details.seam`).
 * - The seam registry is part of the root's side-effect-free assembly:
 *   it is in-process state only (the installed implementations are the
 *   S6 row's, owned by its Fiber).
 *
 * Pure module: no I/O, no `node:` builtins.
 *
 * @module @dsh-agent-team/runtime/plugin/seams
 */

/** The closed seam error-code vocabulary (stable across the S5 -> S6
 *  handoff; the S6 row and the test chain assert on these strings). */
export const TEAM_SEAM_ERROR_CODES = {
  /** The seam was used before its S6 installation. */
  SEAM_NOT_INSTALLED: 'SEAM_NOT_INSTALLED',
  /** A second installation attempt on an already-installed seam. */
  SEAM_ALREADY_INSTALLED: 'SEAM_ALREADY_INSTALLED',
  /** The seam name is unknown to the registry. */
  SEAM_UNKNOWN: 'SEAM_UNKNOWN',
  /** The projection live residency overlay is not installed (S6 §20.1). */
  PROJECTION_LIVE_OVERLAY_NOT_INSTALLED: 'PROJECTION_LIVE_OVERLAY_NOT_INSTALLED',
  /** The remote handler deps are not installed (S6 §20 + plan §19.1
   *  caveat). */
  REMOTE_HANDLERS_NOT_INSTALLED: 'REMOTE_HANDLERS_NOT_INSTALLED',
  /** The server-side principal derivation is not installed (S6 §20.3). */
  PRINCIPAL_DERIVATION_NOT_INSTALLED: 'PRINCIPAL_DERIVATION_NOT_INSTALLED',
  /** The handoff one-shot summarizer capability is not installed (the
   *  composition did not supply the auxiliary summarization). */
  HANDOFF_SUMMARIZER_NOT_INSTALLED: 'HANDOFF_SUMMARIZER_NOT_INSTALLED',
  /** The P7-T2 mutation service plane is not installed (no durable store
   *  supplied; the P7-T2 record family has no home in the frozen
   *  TeamDomain schema v1). */
  MUTATION_POLICY_SERVICE_NOT_INSTALLED: 'MUTATION_POLICY_SERVICE_NOT_INSTALLED',
} as const

export type TeamSeamErrorCode =
  (typeof TEAM_SEAM_ERROR_CODES)[keyof typeof TEAM_SEAM_ERROR_CODES]

/** The seam name vocabulary of the production root registry. */
export const TEAM_SEAM_NAMES = {
  /** The projection live residency overlay port (S6 §20.1: the read-only
   *  live residency diagnostic folded into the projection). */
  projectionOverlay: 'projectionOverlay',
  /** The remote handler deps (the 12 structural ports of the frozen
   *  `@dsh-agent-team/remote` handler layer; S6 §20 + the §19.1 caveat). */
  remoteHandlers: 'remoteHandlers',
  /** The server-side principal derivation (S6 §20.3: the external caller
   *  authority is derived host-side, never accepted client-declared). */
  principal: 'principal',
} as const

export type TeamSeamName = (typeof TEAM_SEAM_NAMES)[keyof typeof TEAM_SEAM_NAMES]

/** The stable error of a seam misuse. */
export class TeamSeamError extends Error {
  readonly code: TeamSeamErrorCode
  readonly details: { readonly seam?: string; [key: string]: unknown }

  constructor(
    code: TeamSeamErrorCode,
    message: string,
    details: { readonly seam?: string; [key: string]: unknown } = {},
  ) {
    super(message)
    this.name = 'TeamSeamError'
    this.code = code
    this.details = details
  }
}

/** Is `value` a {@link TeamSeamError}? */
export function isTeamSeamError(value: unknown): value is TeamSeamError {
  return value instanceof TeamSeamError
}

/**
 * One installation seam.
 *
 * @typeParam T - the installed implementation type.
 */
export interface TeamSeam<T> {
  /** The seam name (registry key). */
  readonly name: string
  /** Whether an implementation is installed. */
  readonly isInstalled: boolean
  /**
   * Install the implementation (idempotent-once).
   * @throws `SEAM_ALREADY_INSTALLED` on a second install.
   */
  install(impl: T): void
  /**
   * The installed implementation.
   * @throws `SEAM_NOT_INSTALLED` (with the seam-specific code hint in the
   *  message) before installation.
   */
  current(): T
}

/**
 * Create one installation seam.
 * @param name - the seam name (a {@link TEAM_SEAM_NAMES} value).
 * @param notInstalledCode - the code `current()` throws before install.
 */
export function createTeamSeam<T>(
  name: string,
  notInstalledCode: TeamSeamErrorCode,
): TeamSeam<T> {
  let installed: T | undefined
  let hasInstall = false
  return {
    name,
    get isInstalled() {
      return hasInstall
    },
    install(impl: T): void {
      if (hasInstall) {
        throw new TeamSeamError(
          TEAM_SEAM_ERROR_CODES.SEAM_ALREADY_INSTALLED,
          `seam '${name}' is already installed (the composition owns the seam lifetime)`,
          { seam: name },
        )
      }
      installed = impl
      hasInstall = true
    },
    current(): T {
      if (!hasInstall) {
        throw new TeamSeamError(
          notInstalledCode,
          `seam '${name}' is not installed yet (the S6 installation is pending)`,
          { seam: name },
        )
      }
      return installed as T
    },
  }
}

/**
 * The production root's S6 seam registry (the plan §19.1 caveat
 * "明确 installation seam").
 */
export interface TeamSeamRegistry {
  /** The projection live residency overlay seam (S6 §20.1). */
  readonly projectionOverlay: TeamSeam<unknown>
  /** The remote handler deps seam (S6 §20 + plan §19.1 caveat). */
  readonly remoteHandlers: TeamSeam<unknown>
  /** The server-side principal derivation seam (S6 §20.3). */
  readonly principal: TeamSeam<(input: Record<string, unknown>) => unknown>
  /** Look up a seam by name.
   * @throws `SEAM_UNKNOWN` for an unknown name. */
  get(name: string): TeamSeam<unknown>
}

/** Create the production root's seam registry (all seams uninstalled). */
export function createTeamSeamRegistry(): TeamSeamRegistry {
  const projectionOverlay = createTeamSeam<unknown>(
    TEAM_SEAM_NAMES.projectionOverlay,
    TEAM_SEAM_ERROR_CODES.PROJECTION_LIVE_OVERLAY_NOT_INSTALLED,
  )
  const remoteHandlers = createTeamSeam<unknown>(
    TEAM_SEAM_NAMES.remoteHandlers,
    TEAM_SEAM_ERROR_CODES.REMOTE_HANDLERS_NOT_INSTALLED,
  )
  const principal = createTeamSeam<(input: Record<string, unknown>) => unknown>(
    TEAM_SEAM_NAMES.principal,
    TEAM_SEAM_ERROR_CODES.PRINCIPAL_DERIVATION_NOT_INSTALLED,
  )
  const byName: Record<string, TeamSeam<unknown>> = {
    [TEAM_SEAM_NAMES.projectionOverlay]: projectionOverlay,
    [TEAM_SEAM_NAMES.remoteHandlers]: remoteHandlers,
    [TEAM_SEAM_NAMES.principal]: principal,
  }
  return {
    projectionOverlay,
    remoteHandlers,
    principal,
    get(name: string): TeamSeam<unknown> {
      const seam = byName[name]
      if (seam === undefined) {
        throw new TeamSeamError(
          TEAM_SEAM_ERROR_CODES.SEAM_UNKNOWN,
          `unknown seam '${name}' (known: ${Object.keys(byName).join(', ')})`,
          { seam: name },
        )
      }
      return seam
    },
  }
}

/**
 * The fail-closed placeholder object for the P7-T2 mutation service plane
 * when the substrate supplies no durable store: every method call throws
 * `MUTATION_POLICY_SERVICE_NOT_INSTALLED`. The shape mirrors the
 * `MutationService` public surface the composition would expose, so the
 * root's `mutation.service` type stays stable across install states.
 */
export function createFailClosedMutationService(): {
  [method: string]: (...args: never[]) => never
} {
  const fail =
    (method: string) =>
    (..._args: never[]): never => {
      throw new TeamSeamError(
        TEAM_SEAM_ERROR_CODES.MUTATION_POLICY_SERVICE_NOT_INSTALLED,
        `mutation service method '${method}' was called before the P7-T2 mutation plane was installed (the substrate must supply a durable MutationServiceDeps store)`,
        { seam: 'mutationService', method },
      )
    }
  return {
    requestMutation: fail('requestMutation'),
    switchPolicyState: fail('switchPolicyState'),
    requestCreationFieldMutation: fail('requestCreationFieldMutation'),
    resolveEffective: fail('resolveEffective'),
  }
}
