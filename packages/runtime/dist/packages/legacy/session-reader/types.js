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
/** Roster discovery sources, in legacy precedence order (last wins). */
export const ROSTER_SOURCES = ['home', 'workspace'];
//# sourceMappingURL=types.js.map