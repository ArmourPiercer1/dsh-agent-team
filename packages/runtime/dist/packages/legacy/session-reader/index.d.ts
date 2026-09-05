/**
 * P7-T7 — legacy Team Session read-only reader: the public face.
 *
 * Re-exports the closed surface of the reader (types, errors, format
 * primitives, the single inspect entry, and the dispatch surface). The
 * reader is READ-ONLY by construction: no export here can mutate, resume,
 * or restore a legacy Team Session — the only operational entry is
 * {@link inspectLegacyTeam}, and {@link dispatchReaderAction} rejects every
 * non-`inspect` action with a typed error.
 *
 * Authority: Development Plan §20.6 (legacy Team Sessions are read-only;
 * best-effort legacy view when the public data permits, else native
 * Chat/Trajectory), TaskDoc §11.8 P7-T7, Architecture invariant 65.
 *
 * @module @dsh-agent-team/legacy/session-reader
 */
export { LEGACY_READER_ERROR_CODES, LegacyReaderError, isLegacyReaderError, } from './errors.js';
export type { LegacyReaderErrorCode } from './errors.js';
export { ROSTER_WARNING_REASONS, classifyLegacyLogLine, decodeSegment, encodeSegment, parseLegacyHeaderFields, parseLegacyRosterFile, projectKey, } from './format.js';
export type { LegacyLogLineClassification, LegacyLogLineKind, LegacyRosterFileParse, LegacySessionHeaderFields, RosterWarningReason, } from './format.js';
export { dispatchReaderAction, inspectLegacyTeam } from './inspect.js';
export { ROSTER_SOURCES } from './types.js';
export type { LegacyFallbackView, LegacyHomeEntry, LegacyHomePort, LegacyRosterMember, LegacyRosterWarning, LegacySessionEvidence, LegacyTeamInspection, LegacyTeamInspectRequest, LegacyTeamMetadata, LegacyTeamView, RosterSource, } from './types.js';
//# sourceMappingURL=index.d.ts.map