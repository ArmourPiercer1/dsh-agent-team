/**
 * P8-S5A — the frozen legacy-session-reader public surface (type snapshot).
 *
 * The production root (A29, `legacy`) consumes the frozen P7-T7 reader
 * (`packages/legacy/session-reader`) WITHOUT importing its sources: the
 * reader's pre-existing type errors (TS2540 readonly assignment, TS2345
 * strict-null) must never surface inside the runtime build program, and a
 * plain-JS production entry cannot load `.ts` at all. The reader is
 * compiled separately (packages/legacy/tsconfig.build.json, `noCheck`,
 * mirror-emitted INTO the runtime dist) and the production entry loads the
 * emitted `.js` by computed URL at boot.
 *
 * This file is the runtime-side TYPE contract for that frozen surface — a
 * verbatim structural snapshot of `packages/legacy/session-reader/types.ts`
 * (the read-only home port + the closed inspection result vocabulary). The
 * legacy package is FROZEN (legacy inventory; the reader is P7-T7-final),
 * so the snapshot cannot drift; if it ever must, update both together and
 * record the deviation.
 * @module @dsh-agent-team/runtime/plugin/legacy-surface
 */
/** One directory entry as reported by the read-only home port. */
export interface LegacyHomeEntry {
    /** The entry name (never a path separator). */
    readonly name: string;
    /** Whether the entry is a file or a directory. */
    readonly kind: 'file' | 'dir';
}
/**
 * The read-only legacy-home filesystem port (frozen P7-T7 surface).
 * Both methods are best-effort: a missing path returns `undefined`
 * (never throws).
 */
export interface LegacyHomePort {
    /** List one directory, or `undefined` when absent/unreadable. */
    listDir(path: string): readonly LegacyHomeEntry[] | undefined;
    /** Read one UTF-8 text file, or `undefined` when absent/unreadable. */
    readFile(path: string): string | undefined;
}
/** Roster discovery sources, in legacy precedence order (last wins). */
export type RosterSource = 'home' | 'workspace';
/** One best-effort roster member row (frozen P7-T7 surface). */
export interface LegacyRosterMember {
    /** Which roster directory the winning line came from. */
    readonly source: RosterSource;
    /** The roster file name (diagnostic attribution). */
    readonly fileName: string;
    /** The member id (frontmatter `id`), when present and a non-empty string. */
    readonly id?: string;
    /** The member role, when the frontmatter carried a known token. */
    readonly role?: 'leader' | 'teammate';
    /** The member name, when present. */
    readonly name?: string;
    /** The member description, when present. */
    readonly description?: string;
}
/** One best-effort roster warning (a line that could not be read). */
export interface LegacyRosterWarning {
    /** Which roster directory the broken line came from. */
    readonly source: RosterSource;
    /** The roster file name (diagnostic attribution). */
    readonly fileName: string;
    /** The closed reason vocabulary. */
    readonly reason: string;
    /** The human-readable diagnostic. */
    readonly message: string;
}
/**
 * One native session log as the reader best-effort read it (the
 * per-session evidence row, shared by the legacy view and the native
 * fallback view).
 */
export interface LegacySessionEvidence {
    /** The session id from the header line, when the header was readable. */
    readonly sessionId: string | undefined;
    /** The session id reconstructed from the directory name (always present). */
    readonly directoryId: string;
    /** The project directory (per-cwd key) the log lives under. */
    readonly projectDir: string;
    /** Whether the first line parsed as a native session header. */
    readonly headerPresent: boolean;
    /** The header `createdAt`, when present. */
    readonly createdAt?: number;
    /** The header `cwd`, when present. */
    readonly cwd?: string;
    /** The header `origin`, when present (legacy team children are subagents). */
    readonly origin?: 'subagent';
    /** The header `delegationDepth`, when present. */
    readonly delegationDepth?: number;
    /** The header `parentSession`, when present (seed/fork lineage). */
    readonly parentSession?: string;
    /** The header `seedLength`, when present (legacy fork semantics). */
    readonly seedLength?: number;
    /** Total event lines after the header (readable or not). */
    readonly eventCount: number;
    /** Event lines that could not be parsed as JSON (tolerated, counted). */
    readonly unreadableLineCount: number;
    /**
     * Per-name counts of the five legacy Team SessionEvents (DETECTION
     * vocabulary, `@dsh-agent-team/contracts` legacy quarantine), counted in
     * the session's OWN suffix only.
     */
    readonly teamEventCounts: Readonly<Record<string, number>>;
    /** Sum of `teamEventCounts` (the legacy-team signal of this log). */
    readonly teamEventTotal: number;
    /**
     * Whether the log content was decodable by the reader (`false` when
     * only a compressed artifact exists, or no artifact at all).
     */
    readonly logDecodable: boolean;
    /** The physical log artifact name that was found (or `undefined`). */
    readonly logArtifact: 'session.jsonl' | 'session.jsonl.zstd' | undefined;
}
/** The best-effort legacy Team metadata (frozen P7-T7 surface). */
export interface LegacyTeamMetadata {
    /**
     * The legacy team identity (the teamId IS the leader session id),
     * `undefined` when no leader session log was detected.
     */
    readonly teamId: string | undefined;
    /** The leader session id (equals `teamId`; split out for clarity). */
    readonly leaderSessionId: string | undefined;
    /** How the leader was selected (diagnostic). */
    readonly leaderSelection: 'team-events' | 'roster-only';
    /** The best-effort roster (workspace wins over home per member id). */
    readonly roster: readonly LegacyRosterMember[];
    /** Best-effort roster warnings (broken lines; never abort). */
    readonly rosterWarnings: readonly LegacyRosterWarning[];
    /** Every scanned session log (legacy and native alike), sorted. */
    readonly sessions: readonly LegacySessionEvidence[];
    /** The member child session ids (empty when there is no leader). */
    readonly memberChildSessionIds: readonly string[];
}
/** The successful legacy inspection result. */
export interface LegacyTeamView {
    /** The closed status tag. */
    readonly status: 'legacy-team';
    /** The best-effort legacy metadata. */
    readonly team: LegacyTeamMetadata;
}
/**
 * The required degradation result (DevPlan §20.6): no legacy Team metadata
 * in scope — the inspection degrades to the native Chat/Trajectory data.
 */
export interface LegacyFallbackView {
    /** The closed status tag. */
    readonly status: 'native-fallback';
    /** The closed reason (only one: the metadata was absent, not broken). */
    readonly reason: 'no-legacy-metadata';
    /** The native Chat/Trajectory data (sorted; empty when nothing readable). */
    readonly native: readonly LegacySessionEvidence[];
    /** The degradation target label (frozen vocabulary). */
    readonly degradedTo: 'native-chat-trajectory';
}
/** The closed inspect result vocabulary. */
export type LegacyTeamInspection = LegacyTeamView | LegacyFallbackView;
/**
 * The signature of the frozen reader's single operational entry
 * (`inspectLegacyTeam(port, request)` — synchronous, read-only).
 */
export type LegacyInspectFn = (port: LegacyHomePort, request: unknown) => LegacyTeamInspection;
//# sourceMappingURL=legacy-surface.d.ts.map