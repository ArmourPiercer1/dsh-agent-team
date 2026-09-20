/**
 * Strict-read + Core-spill — the artifact-read-grant vocabulary.
 *
 * An {@link ArtifactReadGrant} is the positive read capability (D1) that
 * lets a Team agent read back a DSH spill artifact it produced itself,
 * from OUTSIDE the session workspace, under a strict-read (out-of-
 * workspace deny) policy. It is a durable fact (family
 * `artifact-read-granted`, D4) whose runtime projection is an in-memory
 * candidate registry (D5 identity binding: locator + targetKey digest +
 * version digest, re-verified with a FRESH resolve + stat at use).
 *
 * Hard invariants (architecture §17, ADR-strict-read-core-spill D1–D6):
 *
 * - A locator string alone NEVER mints authority: the grant binds the
 *   file's opaque fs identity (targetKey digest) and freshness (version
 *   digest) captured at issue time, re-resolved at read time.
 * - Only the `read` tool consumes grants. No other tool, and no lane
 *   above the grant (explicit deny, external hard) is ever overridden by
 *   one.
 * - The principal is the PRODUCING MemberInstance only (D3): no Team-
 *   wide grants, no transfer. The durable identity is the composite
 *   `(rootSessionId, instanceId)` (invariant 18) — a bare instanceId is
 *   never an identity on its own.
 * - No fs parsing anywhere: fs identity flows only through the DSH fs
 *   seams (resolve/stat) behind the {@link ArtifactFsPort} port.
 *
 * Pure module: no I/O, no DSH imports, no plugin globals. The authority
 * receives everything through ports (implementation guide §2.5).
 * @module @dsh-agent-team/runtime/artifact-read/types
 */
export {};
//# sourceMappingURL=types.js.map