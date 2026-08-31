/**
 * P7-T7 — legacy Team Session read-only reader: the closed type surface.
 *
 * Authority (frozen docs, in precedence order):
 * - Development Plan §20.6 (Legacy): existing old Team Sessions are
 *   READ-ONLY; when the public data permits, show a best-effort legacy
 *   view; otherwise native Chat/Trajectory only (degradation is required
 *   behavior, not a blocker).
 * - Development Plan §9.8 (`legacy` package): "legacy Team
 *   detection/read-only metadata where public data permits"; no live
 *   runtime.
 * - Architecture invariant 65: existing legacy Team Sessions stay
 *   read-only and are never auto-migrated.
 * - TaskDoc §11.8 P7-T7: best-effort inspect old Team metadata; any
 *   mutate/resume/restore entry is rejected.
 *
 * Legacy on-disk evidence (frozen fork `references/deepseek-harness`,
 * read-only): the old Team has NO separate team entity — `teamId` is
 * always the leader session id (`team-projection/src/types.ts`); the
 * roster lives in `$DSH_HOME/teammates/*.md` and the workspace
 * `.dsh/teammates/*.md` (`team-local/src/discovery.ts`); team
 * coordination facts appear as the five legacy Team SessionEvents in
 * the native session logs (`team/src/events.ts`); native session logs
 * are JSONL under the persistence root (`session-persistence-jsonl`).
 * This module recognizes that public data through an injected
 * read-only filesystem port and nothing else.
 *
 * Read-only by construction: the ONLY operational entry is
 * {@link inspectLegacyTeam} (see `./inspect.js`). The module exports no
 * mutate/resume/restore/delete/update/create entry at all; routing a
 * mutation-style action through {@link dispatchReaderAction} throws the
 * typed {@link LegacyReaderError} `LEGACY_READER_MUTATION_REJECTED`.
 *
 * Pure module: no I/O, no DSH imports, no ambient state. All
 * filesystem access flows through the injected {@link LegacyHomePort};
 * the port itself is read-only by its own type surface (no write, no
 * create, no delete method exists to call).
 *
 * @module @dsh-agent-team/legacy/session-reader/types
 */

/** One directory entry as reported by the read-only home port. */
export interface LegacyHomeEntry {
  /** The entry name (never a path separator). */
  readonly name: string
  /** Whether the entry is a file or a directory. */
  readonly kind: 'file' | 'dir'
}

/**
 * The read-only legacy-home filesystem port. The reader is the ONLY
 * consumer and the port has no write surface: read-only is a type-level
 * guarantee, not a convention.
 *
 * Both methods are best-effort by contract: a missing path returns
 * `undefined` (never throws); a malformed entry is reported as-is and
 * the reader degrades around it.
 */
export interface LegacyHomePort {
  /**
   * List one directory.
   * @param path - the directory path.
   * @returns the entries, or `undefined` when the path is absent or is
   *   not a readable directory.
   */
  listDir(path: string): readonly LegacyHomeEntry[] | undefined
  /**
   * Read one UTF-8 text file.
   * @param path - the file path.
   * @returns the file content, or `undefined` when the path is absent or
   *   is not a readable file.
   */
  readFile(path: string): string | undefined
}

/** Roster discovery sources, in legacy precedence order (last wins). */
export const ROSTER_SOURCES = ['home', 'workspace'] as const

/** One roster source. */
export type RosterSource = (typeof ROSTER_SOURCES)[number]

/** The inspect request (the only input the reader accepts). */
export interface LegacyTeamInspectRequest {
  /** The DSH home root of the inspected (legacy) instance. */
  readonly dshHome: string
  /**
   * The legacy workspace cwd. When present, the workspace roster
   * directory `.dsh/teammates` is scanned in addition to the home
   * roster (legacy discovery semantics: workspace wins per member id).
   */
  readonly workspaceCwd?: string
  /**
   * Optional scope narrowing: restrict the session-log scan to ONE
   * project directory name under `<dshHome>/sessions/` (the
   * persistence backend's per-cwd directory key). Absent: every
   * project directory is scanned.
   */
  readonly projectDir?: string
}

/**
 * One best-effort legacy roster member line (the import unit of the old
 * `.dsh/teammates` roster). Best-effort: absent or malformed fields are
 * omitted rather than failing the inspection (a roster line that cannot
 * be read at all lands in `rosterWarnings` instead).
 */
export interface LegacyRosterMember {
  /** Which roster directory the winning line came from. */
  readonly source: RosterSource
  /** The roster file name (diagnostic attribution). */
  readonly fileName: string
  /** The member id (frontmatter `id`), when present and a non-empty string. */
  readonly id?: string
  /** The member role, when the frontmatter carried a known token. */
  readonly role?: 'leader' | 'teammate'
  /** The member name, when present. */
  readonly name?: string
  /** The member description, when present. */
  readonly description?: string
}

/** One best-effort roster warning (a line that could not be read; never aborts). */
export interface LegacyRosterWarning {
  /** Which roster directory the broken line came from. */
  readonly source: RosterSource
  /** The roster file name (diagnostic attribution). */
  readonly fileName: string
  /** The closed reason vocabulary (see `./format.js`). */
  readonly reason: string
  /** The human-readable diagnostic. */
  readonly message: string
}

/**
 * One native session log as the reader best-effort read it (the
 * per-session evidence row, shared by the legacy view and the native
 * fallback view).
 */
export interface LegacySessionEvidence {
  /** The session id from the header line, when the header was readable. */
  readonly sessionId: string | undefined
  /** The session id reconstructed from the directory name (always present). */
  readonly directoryId: string
  /** The project directory (per-cwd key) the log lives under. */
  readonly projectDir: string
  /** Whether the first line parsed as a native session header. */
  readonly headerPresent: boolean
  /** The header `createdAt`, when present. */
  readonly createdAt?: number
  /** The header `cwd`, when present. */
  readonly cwd?: string
  /** The header `origin`, when present (legacy team children are subagents). */
  readonly origin?: 'subagent'
  /** The header `delegationDepth`, when present. */
  readonly delegationDepth?: number
  /** The header `parentSession`, when present (seed/fork lineage). */
  readonly parentSession?: string
  /**
   * The header `seedLength`, when present: the number of re-recorded
   * ancestor events below the fork's own-suffix boundary (legacy fork
   * semantics).
   */
  readonly seedLength?: number
  /** Total event lines after the header (readable or not). */
  readonly eventCount: number
  /** Event lines that could not be parsed as JSON (tolerated, counted). */
  readonly unreadableLineCount: number
  /**
   * Per-name counts of the five legacy Team SessionEvents (DETECTION
   * vocabulary, `@dsh-agent-team/contracts` legacy quarantine), counted in
   * the session's OWN suffix only: with a `seedLength` boundary, an event
   * line carrying a `seq` below it is excluded (forked-ancestor facts are
   * not facts of this session — the legacy projection's own-suffix rule).
   * Empty object when the log carries none.
   */
  readonly teamEventCounts: Readonly<Record<string, number>>
  /**
   * Sum of `teamEventCounts` (the legacy-team signal of this log's own
   * suffix).
   */
  readonly teamEventTotal: number
  /**
   * Whether the log content was decodable by this reader. `false` when
   * only a compressed artifact exists (or no artifact at all): the
   * session still counts as native Chat/Trajectory evidence, its fields
   * are simply absent.
   */
  readonly logDecodable: boolean
  /** The physical log artifact name that was found (or `undefined`). */
  readonly logArtifact: 'session.jsonl' | 'session.jsonl.zstd' | undefined
}

/**
 * The best-effort legacy Team view (frozen, plain lossless-JSON data).
 * Every field is best-effort: absent legacy metadata degrades the
 * individual fields, never the inspection.
 */
export interface LegacyTeamMetadata {
  /**
   * The legacy team identity. Legacy semantics (frozen evidence): there
   * is no separate team entity — the teamId IS the leader session id.
   * `undefined` when no leader session log was detected (roster-only
   * legacy home).
   */
  readonly teamId: string | undefined
  /** The leader session id (equals `teamId`; split out for clarity). */
  readonly leaderSessionId: string | undefined
  /**
   * How the leader was selected (diagnostic): `'team-events'` when a
   * session log carried legacy team events, `'roster-only'` when only
   * roster metadata exists.
   */
  readonly leaderSelection: 'team-events' | 'roster-only'
  /** The best-effort roster (workspace wins over home per member id). */
  readonly roster: readonly LegacyRosterMember[]
  /** Best-effort roster warnings (broken lines; never abort). */
  readonly rosterWarnings: readonly LegacyRosterWarning[]
  /** Every scanned session log (legacy and native alike), sorted. */
  readonly sessions: readonly LegacySessionEvidence[]
  /**
   * The member child session ids: subagent-origin sessions whose
   * lineage points at the leader, or logs carrying the legacy
   * bound-teammate mark (the `member-bound` event of the frozen legacy
   * vocabulary). Empty when there is no leader.
   */
  readonly memberChildSessionIds: readonly string[]
}

/** The successful legacy inspection result. */
export interface LegacyTeamView {
  /** The closed status tag. */
  readonly status: 'legacy-team'
  /** The best-effort legacy metadata. */
  readonly team: LegacyTeamMetadata
}

/**
 * The required degradation result (DevPlan §20.6): no legacy Team
 * metadata was found in scope, so the inspection degrades to the native
 * Chat/Trajectory data. NOT a blocker — the reader succeeds with this
 * view.
 */
export interface LegacyFallbackView {
  /** The closed status tag. */
  readonly status: 'native-fallback'
  /** The closed reason (only one: the metadata was absent, not broken). */
  readonly reason: 'no-legacy-metadata'
  /**
   * The native Chat/Trajectory data: every scanned session log summary
   * (sorted), empty when the home has no readable sessions at all.
   */
  readonly native: readonly LegacySessionEvidence[]
  /** The degradation target label (frozen vocabulary). */
  readonly degradedTo: 'native-chat-trajectory'
}

/** The closed inspect result vocabulary. */
export type LegacyTeamInspection = LegacyTeamView | LegacyFallbackView
