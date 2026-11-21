/**
 * host-surface-refusal.d.mts — the declaration half of `host-surface-refusal.mjs`.
 *
 * The implementation is a plain `.mjs` because the arm and the product composition both import it
 * untyped; the TypeScript consumers (`vnext/root.ts`, `vnext/centre-config.ts`, `vnext/admission.ts`)
 * reach it through this file so `tsc` sees the closed table without a repo-wide `allowJs` change.
 */

/** One capability that has no member I/O axis to be admitted on. */
export interface HostSurfaceRefusal {
  readonly code: string
  /** The subject's EXISTING axis (the table invents none). */
  readonly axis: 'team.control' | 'host.service' | 'process.exec'
  readonly subject: string
  /** The measured missing axis, in words. */
  readonly missing: string
}

export declare const HOST_SURFACE_REFUSALS: Readonly<{
  remote: HostSurfaceRefusal
  alpha6: HostSurfaceRefusal
  ptc: HostSurfaceRefusal
}>

export declare const HOST_SURFACE_CAPABILITIES: readonly string[]

/** The centre's `Admission` vocabulary, structurally. */
export interface HostSurfaceDenial {
  readonly kind: 'deny'
  readonly code: string
  readonly reason: string
}

export declare function hostSurfaceRefusal(capability: string, detail?: string): HostSurfaceDenial

export interface HostSurfaceRefusalInput {
  readonly callId?: string
  readonly subject?: string
  readonly locator?: string
  readonly owner?: string
  readonly detail?: string
}

export interface HostSurfaceRefusalPoint {
  readonly capability: HostSurfaceRefusal
  refuse(input?: HostSurfaceRefusalInput): { readonly callId: string; readonly admission: HostSurfaceDenial }
  clock(): string
}

export declare function createHostSurfaceRefusalPoint(input: {
  readonly capability: string
  readonly ledger?: object
  readonly ledgerPath?: string
  readonly store?: object
  readonly identityOf?: (exec: { readonly name?: string; readonly callId: string }) => {
    readonly executionId: string
    readonly actorId: string
    readonly worldId: string
  }
  readonly onFault?: (error: unknown, context: object) => void
  readonly now?: () => string
}): HostSurfaceRefusalPoint

export declare function refuseHostSurfaceBefore(
  point: HostSurfaceRefusalPoint | undefined | null,
  input?: HostSurfaceRefusalInput,
): boolean
