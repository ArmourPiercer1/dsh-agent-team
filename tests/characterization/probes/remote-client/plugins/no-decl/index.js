/**
 * P2-T6 negative control — `p2t6-no-decl` (mounted in the B1 positive boot).
 *
 * A plain host-side function plugin whose package.json carries NO `dsh.client`
 * declaration. It must load like any other patch row (plugin discovery works)
 * while contributing NO entry to the composed web boot graph (the client
 * module scanner only adopts packages that declare `dsh.client`).
 */
export const name = 'p2t6-no-decl'

export function apply() {
  // Inert host half: nothing to do. Presence in the composition dump and
  // absence from the boot graph are both asserted by the probe group.
}
