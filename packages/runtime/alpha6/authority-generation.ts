/**
 * Alpha.6 composition — the authority-generation reader for the trusted
 * assigned-Officer facts port.
 *
 * The durable permission overlay is the ONLY generation authority (A5-M1).
 * This module is deliberately the same law as the Host's single reader:
 *  - no overlay port, or no row for the member => `0` (the legal "never had
 *    an overlay" state, which the facts provider then REFUSES because a
 *    delegated reviewer must stand on a positive generation);
 *  - a row whose `metadata.generation` is not a finite non-negative number
 *    => throw, never fold into 0 and never answer `undefined`-meant-zero;
 *  - otherwise the durable number verbatim.
 *
 * It is a READER, not a cache and not a second authority: every call asks the
 * overlay, and a caller that needs one snapshot must read once and pass the
 * value it read.
 *
 * @module packages/runtime/alpha6/authority-generation
 */

/** The narrow slice of the durable permission overlay this reader needs. */
export interface Alpha6PermissionOverlayPort {
  readonly latest: (input: {
    readonly teamSessionId: string
    readonly memberInstanceId: string
  }) => Promise<{ readonly metadata?: { readonly generation?: unknown } } | null | undefined>
}

export type Alpha6AuthorityGenerationReader = (input: {
  readonly teamSessionId: string
  readonly memberInstanceId: string
}) => Promise<number>

/**
 * Build the reader over the Host's overlay port. ABSENT port = the pre-A5
 * no-row world and answers `0`; every present port follows the strict law.
 */
export function createAlpha6AuthorityGenerationReader(
  overlay: Alpha6PermissionOverlayPort | undefined,
): Alpha6AuthorityGenerationReader {
  return async ({ teamSessionId, memberInstanceId }) => {
    if (overlay === undefined) return 0
    const latest = await overlay.latest({ teamSessionId, memberInstanceId })
    if (latest === undefined || latest === null) return 0
    const raw = latest.metadata?.generation
    const generation = Number(raw)
    if (!Number.isFinite(generation) || generation < 0) {
      throw new Error(
        `alpha6: the durable permission overlay answered a non-generation (${String(raw)}) — never read as generation 0`,
      )
    }
    return generation
  }
}
