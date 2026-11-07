/**
 * a5sf-governed-realm.d.mts — the declaration half of
 * `a5sf-governed-realm.mjs` (an untyped `.mjs` SOURCE module), so typed
 * consumers (the Host wiring) reach the seam without `any` (the
 * `pa-mount-registry.d.mts` precedent). Described from the implementation; see
 * the module header for what the provider reads and what it deliberately does
 * NOT deliver.
 */

/** The realm identity the governed preset pins into its capability rows. */
export declare const GOVERNED_REALM_ID: 'a5sf-governed-member'
/** The tool binding the confined shell executes under. */
export declare const GOVERNED_SHELL_BINDING: 'dsh.subprocess/exec'
/** The composition's declared shell face (absolute program + shell class). */
export declare const GOVERNED_FACE: Readonly<{
  program: string
  shellClass: Readonly<{ programs: readonly string[] }>
  maxOutputBytes: number
  graceMs: number
}>

/** The lifecycles that ARE a durable admission (CREATED / RUNNING / SETTLED). */
export declare const GOVERNED_ADMITTED_LIFECYCLES: readonly string[]

/** The Alpha.4 authority reference derived from the two durable facts. */
export declare function governedAuthorityReference(input: {
  readonly generation: number
  readonly lifecycle: unknown
  /** The live glue's fresh-child-creation window (activation ordering). */
  readonly freshCreate?: boolean
}): GovernedRealmAuthority

/** The durable Alpha.4 authority read the Host supplies per Member attach. */
export interface GovernedRealmAuthorityRead {
  readonly teamSessionId: string
  readonly memberInstanceId: string
  readonly templateId: string
  /** True only inside the live glue's fresh-child-creation window. */
  readonly freshCreate?: boolean
}

export interface GovernedRealmAuthority {
  readonly revision: string
  readonly admitted: boolean
  readonly instanceGeneration: number
}

export interface CreateGovernedRealmProviderOptions {
  /** The realm identity pinned into the confined faces. */
  readonly realmId: string
  /** A writable scratch root for the confined launcher. */
  readonly scratchRoot: string
  /**
   * The Host's BP-F bound-blueprint resolver — the ONE authority-bearing read.
   * REQUIRED: without it the provider refuses `MEMBER_POLICY_WITHOUT_BLUEPRINT`.
   */
  readonly resolveBoundBlueprint: (teamRootSessionId: string) => unknown
  /**
   * The durable Alpha.4 authority read (generation + admission). REQUIRED: the
   * reference is READ, never supplied as a literal.
   */
  readonly readAuthority: (input: GovernedRealmAuthorityRead) => unknown
  readonly trustRoot?: string | null
  readonly program?: string
  readonly shellClass?: Readonly<{ programs: readonly string[] }>
  readonly maxOutputBytes?: number
  readonly graceMs?: number
  readonly launcherPath?: string
  readonly pythonPath?: string
  /** Tests only: an already-built confined process provider (a double must be labelled by its caller). */
  readonly processProvider?: object
}

/** The provider the product row consumes (same shape as `teamA5sfRealm`). */
export interface GovernedRealmProvider {
  compiledFor(member: unknown): Promise<object | undefined>
}

export declare function createGovernedRealmProvider(
  options?: CreateGovernedRealmProviderOptions,
): GovernedRealmProvider
