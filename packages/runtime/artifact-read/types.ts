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

// --- source provenance (structured, never rendered text) ----------------------

/**
 * A structured spill-store producer: the DSH `SaveTextSpill.source` shape
 * (a tool call, or a session-reference save). Mirrored here — NOT
 * imported from DSH — so the pure core stays seam-free; the spill
 * wrapper maps the real DSH value onto this shape verbatim.
 */
export type SpillStoreSource =
  | {
      /** A spill of one tool call's output. */
      readonly kind: 'tool'
      /** The DSH tool name (e.g. `bash`, `pwsh`, `grep`, `glob`, `read`). */
      readonly toolName: string
      /** The DSH tool call id. */
      readonly callId: string
      /** Human label (display only — never an identity). */
      readonly label: string
    }
  | {
      /** A spill of a referenced session's content. */
      readonly kind: 'session-reference'
      /** The referenced session id. */
      readonly sessionId: string
      /** Human label (display only — never an identity). */
      readonly label: string
    }

/**
 * The structured provenance of one durable grant: WHO produced the
 * artifact and HOW (which seam wrote it). Display-only fields (label,
 * tool name) are stored for audit; NONE of them is an identity or a
 * decision input.
 */
export type ArtifactSource =
  | {
      /** The DSH spill-store path (the replaced provider). */
      readonly kind: 'spill-store'
      /** The structured spill source (tool call or session reference). */
      readonly spillSource: SpillStoreSource
    }
  | {
      /** A foreground shell `tools/result` observation (Phase D). */
      readonly kind: 'shell-foreground'
      /** The shell tool name (`bash` or `pwsh`). */
      readonly toolName: string
      /** The tool call id. */
      readonly callId: string
      /** Which stream spilled. */
      readonly stream: 'stdout' | 'stderr'
    }
  | {
      /** A background shell wrapper observation (Phase F, if delivered). */
      readonly kind: 'shell-background'
      /** The shell tool name (`bash` or `pwsh`). */
      readonly toolName: string
      /** The job id. */
      readonly jobId: string
      /** Which stream spilled. */
      readonly stream: 'stdout' | 'stderr'
    }

// --- the durable grant ---------------------------------------------------------

/**
 * One durable artifact-read grant (D4 fact family
 * `artifact-read-granted`, projected into memory).
 *
 * Identity binding (D5): the grant is valid only while
 * (a) the requested locator equals `locator` EXACTLY (string equality —
 * no parsing, no normalization),
 * (b) the file's FRESH targetKey digest equals `targetKeyDigest`
 * (replaced file → mismatch → inactive), and
 * (c) the file's FRESH version digest equals `versionDigest`
 * (rewritten file → mismatch → inactive).
 */
export interface ArtifactReadGrant {
  /** The TeamSession the producing instance belongs to (invariant 9/18). */
  readonly rootSessionId: string
  /** The producing MemberInstance (composite identity, invariant 18). */
  readonly instanceId: string
  /** The exact model-visible locator the grant was minted for. */
  readonly locator: string
  /** `sha256:<hex>` of the opaque targetKey at issue time (digest.ts). */
  readonly targetKeyDigest: string
  /** `sha256:<hex>` of the opaque FsVersion at issue time (digest.ts). */
  readonly versionDigest: string
  /** Structured provenance (audit; never a decision input). */
  readonly source: ArtifactSource
}

// --- fs seam (the ONLY path to fs identity) -------------------------------------

/**
 * The minimal fs surface the authority needs, exactly the DSH public
 * `FileSystem` seam (`resolve` + `stat`). The implementation (host.ts's
 * lazy `fsBackend` accessor) preserves the receiver; the tests inject
 * fakes.
 */
export interface ArtifactFsPort {
  /**
   * Resolve a path to its durable fs target identity.
   * @param path - the model-visible path (a locator string).
   * @param options - the session basis (`cwd`); omitted = the backend default.
   * @returns the resolved target (opaque `targetKey` + display path).
   */
  resolve(path: string, options?: { cwd?: string }): Promise<ArtifactFsTarget>
  /**
   * Stat a resolved target.
   * @param target - the resolved fs target.
   * @returns the metadata, or `undefined` when the file is absent.
   */
  stat(target: ArtifactFsTarget): Promise<ArtifactFsInfo | undefined>
}

/** A resolved fs target (opaque identity + display). Mirrors DSH `FsTarget`. */
export interface ArtifactFsTarget {
  /** The opaque backend target key (NEVER parsed — hashed or compared only). */
  readonly targetKey: string
  /** The display path (NEVER an identity). */
  readonly displayPath: string
}

/** Stat metadata for a resolved target. Mirrors DSH `FsInfo`. */
export interface ArtifactFsInfo {
  /** The opaque backend version token (NEVER parsed — hashed or compared only). */
  readonly version: string
  /** The fs entry type. */
  readonly type: 'file' | 'directory' | 'other'
  /** The size in bytes, when the backend reports one. */
  readonly size?: number
}

// --- session identity (durable bindings, no live agents) -------------------------

/**
 * The durable lifecycle of an instance for grant-eligibility purposes
 * (D6): members are eligible in `CREATED` / `RUNNING` / `SETTLED`,
 * dormant in `ARCHIVED`, terminal in `DISPOSED`; the leader (no
 * lifecycle, invariant 13) is always eligible. `undefined` = the
 * identity is not a known instance of this domain (unknown rows are
 * inert, not errors).
 */
export type ArtifactInstanceLifecycle = 'leader' | 'CREATED' | 'RUNNING' | 'SETTLED' | 'ARCHIVED' | 'DISPOSED'

/** The session-identity port: durable session → producing instance. */
export interface ArtifactIdentityPort {
  /**
   * The producing MemberIdentity of a DSH session, or `undefined` when
   * the session is not managed by a Team (ordinary sessions, unbound
   * sessions — those spill without grants, upstream-equivalent).
   * @param sessionId - the DSH session id that produced the artifact.
   */
  instanceForSession(sessionId: string): { rootSessionId: string; instanceId: string } | undefined
  /**
   * The durable lifecycle of an instance for eligibility (D6), or
   * `undefined` for unknown identities.
   * @param rootSessionId - the TeamSession.
   * @param instanceId - the instance within it.
   */
  lifecycleOf(rootSessionId: string, instanceId: string): ArtifactInstanceLifecycle | undefined
}

// --- ledger port (the durable fact family) ---------------------------------------

/** The durable fact port: the `artifact-read-granted` family only. */
export interface ArtifactLedgerPort {
  /**
   * Append one grant fact durably (allocates its own sequence through
   * the shared write chain). MUST complete before the caller installs
   * the grant into the runtime registry.
   * @param rootSessionId - the TeamSession owning the fact.
   * @param payload - the closed fact payload (fact.ts).
   */
  appendGranted(rootSessionId: string, payload: Record<string, unknown>): Promise<void>
  /**
   * Every grant fact in the domain, in sequence order (cold-restart
   * rebuild; the reader filters + validates each entry).
   */
  listGranted(): Promise<ArtifactLedgerEntry[]>
}

/** A durable ledger entry as the authority sees it (read side). */
export interface ArtifactLedgerEntry {
  readonly schemaVersion: number
  readonly sequence: number
  readonly rootSessionId: string
  readonly factType: string
  readonly payload: Record<string, unknown>
  readonly operationId?: string
  readonly createdAt: string
}

// --- decision results -------------------------------------------------------------

/** The outcome of a read-time grant check (architecture §12). */
export type GrantVerdict =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: GrantInvalidateReason }

/**
 * Why a candidate grant did not authorize the read. `no-candidate` = the
 * registry has nothing for this (identity, target) pair → the read
 * proceeds through the unchanged permission pipeline. Every other
 * reason means a grant EXISTED but is currently inactive (stale file,
 * wrong locator, lifecycle) → the read also proceeds through the
 * unchanged pipeline (inactive ≠ denied).
 */
export type GrantInvalidateReason =
  | 'no-candidate'
  | 'locator-mismatch'
  | 'artifact-missing'
  | 'not-regular-file'
  | 'version-mismatch'
  | 'target-identity-unavailable'
  | 'instance-ineligible'
  | 'unknown-identity'
