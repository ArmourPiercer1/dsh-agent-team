/**
 * S8 shim Node half: an inert Cordis function plugin (no host-side
 * contributions). The P9 team client half is browser-only; the client
 * module system serves its `./client` export (client-bundle.js) from this
 * package.json manifest. Must import cleanly under plain Node.
 */
export function apply(ctx) {
  void ctx
}
