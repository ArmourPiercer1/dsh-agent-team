/**
 * P2-T6 negative fixture — `p2t6-missing-bundle` (B3 boot).
 *
 * Declares `dsh.client` and an `exports["./client"]` entry, but the bundle
 * file (client.js) is deliberately ABSENT. The client module composition
 * must fail loudly at boot with the MissingClientBundleError, naming the
 * package, and the whole web boot must abort (no boot marker).
 */
export const name = 'p2t6-missing-bundle'

export function apply() {
  // Never reached: the client-modules fiber fails before any row's apply.
}
