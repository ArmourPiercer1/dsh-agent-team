/**
 * The backing ports of the Remote handler layer (deviation D-2).
 *
 * The handler layer depends on NO runtime types: its entire dependency
 * surface is these 12 structural ports, each of which the host wiring (a
 * later P8 harness task) implements over the P7/P8 runtime APIs
 * (design note §3 table, "Backing API" column). Every port method returns
 * a lossless-JSON-safe record (or `null` where the wire shape allows it):
 * the remote layer never sees a live DSH object.
 *
 * The port methods are synchronous: the vNext runtime services and storage
 * repositories are in-process and synchronous; the seam itself is
 * promise-based and the dispatcher adapts (design note §6).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/ports
 */
export {};
//# sourceMappingURL=ports.js.map