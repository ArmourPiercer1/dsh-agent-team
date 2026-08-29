/**
 * P2-T6 negative fixture — `p2t6-malformed-decl` (B4 boot).
 *
 * The `dsh.client` declaration is a non-string `platform` (42). A valid
 * bundle file ships alongside so the ONLY composition failure is the
 * malformed declaration: the scan must reject it with
 * `dsh.client.platform must be a string` and the web boot must abort.
 */
export const name = 'p2t6-malformed-decl'

export function apply() {
  // Never reached: the client-modules fiber fails before any row's apply.
}
