/**
 * P2-T6 positive fixture — `p2t6-client-probe` (mounted in the B1 boot).
 *
 * Host half of the external client package. The seam under test is the
 * HOST-side discovery: the client module registry scans loader entries,
 * finds this package's `dsh.client` declaration, composes the boot graph
 * entry, and serves the `./client` bundle under the public `/plugins`
 * combo route. The host half itself is inert.
 */
export const name = 'p2t6-client-probe'

export function apply() {
  // Inert host half: the client half (client.js) is browser-only content
  // served through the /plugins route; nothing host-side to contribute.
}
