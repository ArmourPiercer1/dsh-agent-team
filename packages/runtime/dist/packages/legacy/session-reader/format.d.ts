/**
 * P7-T7 — legacy Team Session read-only reader: format primitives.
 *
 * Pure functions over the on-disk artifact vocabulary of the frozen legacy
 * DSH (evidence: `references/deepseek-harness`, read-only):
 *
 * - path encodings: the session-persistence backend's `encodeSegment` /
 *   `projectKey` (byte-frozen semantics, re-implemented here so the reader
 *   stays a pure module — no `node:` imports) plus the injective decoder the
 *   reader needs to turn a session directory name back into an id;
 * - log lines: a tolerant classifier for one native session-log line
 *   (header / legacy Team event / other / unreadable). Legacy Team event
 *   recognition goes through the contracts detection vocabulary
 *   (`isLegacyTeamSessionEventName`) — this module never names a legacy
 *   event literal itself;
 * - roster files: a lenient per-file parser for the legacy `.md` teammate
 *   definitions (YAML frontmatter). The legacy parser was all-or-nothing
 *   (one bad field dropped the file); the reader is best-effort by mandate
 *   (DevPlan §20.6: show what the public data permits), so each broken
 *   field degrades to a closed-vocabulary warning instead of a rejection.
 *
 * @module @dsh-agent-team/legacy/session-reader/format
 */
/**
 * Encode an arbitrary string as one safe path segment, injectively over all
 * JS (UTF-16) strings. Ported verbatim from the frozen legacy
 * session-persistence format: safe code units stay literal; every other
 * unit, including `~`, becomes `~XXXX` (uppercase hex); `.` and `..` are
 * special-cased against traversal.
 * @param raw - the string to encode; must be non-empty.
 * @returns the escaped single path segment, decodable back to `raw`.
 * @throws when `raw` is the empty string.
 */
export declare function encodeSegment(raw: string): string;
/**
 * Decode one segment produced by {@link encodeSegment} back to its raw
 * string. The encoding is injective, so the decode is unique: every `~` in
 * an encoded segment opens an escape group of exactly four uppercase hex
 * digits. A `~` that does not open a complete group (truncated or foreign
 * segment) is kept as literal text so decoding a best-effort directory name
 * never throws.
 * @param segment - an encoded path segment.
 * @returns the decoded raw string.
 */
export declare function decodeSegment(segment: string): string;
/**
 * Build the readable project directory key for a cwd. Ported verbatim from
 * the frozen legacy session-persistence format: filesystem and drive
 * separators collapse to single `-` runs (lossy, human-navigable), other
 * unsafe code units use the `~XXXX` escape, the result is bounded to 251
 * code units between `--` markers.
 * @param cwd - the session's project directory.
 * @returns a single filesystem-safe project directory name.
 * @throws when `cwd` is the empty string.
 */
export declare function projectKey(cwd: string): string;
/** The tolerant native session-header fields the reader best-effort reads. */
export interface LegacySessionHeaderFields {
    /** The header `id`, when a non-empty string. */
    readonly id?: string;
    /** The header `createdAt`, when a finite number. */
    readonly createdAt?: number;
    /** The header `cwd`, when a string. */
    readonly cwd?: string;
    /** The header `origin`, when it is the subagent marker. */
    readonly origin?: 'subagent';
    /** The header `delegationDepth`, when a non-negative integer. */
    readonly delegationDepth?: number;
    /** The header `parentSession`, when a string. */
    readonly parentSession?: string;
    /** The header `seedLength`, when a non-negative safe integer. */
    readonly seedLength?: number;
}
/**
 * Tolerantly read the header fields out of a parsed first log line.
 * Lenient by design (best-effort inspect): the line is a header iff it is an
 * object with `type === 'session'`; each individual field is read only when
 * it carries the expected kind, otherwise it is simply absent — the frozen
 * backend's fail-closed header check is deliberately NOT reused, because a
 * header with one broken field still identifies its session for a
 * read-only view.
 * @param value - the JSON-parsed first line (any value).
 * @returns the header fields, or `undefined` when the line is not a header.
 */
export declare function parseLegacyHeaderFields(value: unknown): LegacySessionHeaderFields | undefined;
/** The closed classification of one native session-log line. */
export type LegacyLogLineKind = 'header' | 'legacy-team-event' | 'other' | 'unreadable';
/** One classified log line (non-empty lines only). */
export interface LegacyLogLineClassification {
    /** The classification kind. */
    readonly kind: LegacyLogLineKind;
    /** The header fields, present exactly for `kind === 'header'`. */
    readonly header?: LegacySessionHeaderFields;
    /**
     * The legacy Team event name, present exactly for
     * `kind === 'legacy-team-event'` (detection vocabulary).
     */
    readonly eventName?: string;
    /** The parsed line value, present when the line was JSON. */
    readonly parsed?: unknown;
}
/**
 * Classify one non-empty native session-log line. Recognition of legacy
 * Team events goes through the contracts detection vocabulary: a line whose
 * `type` is one of the legacy Team SessionEvent names is a legacy team
 * event line, everything else is `other`. JSON lines that are neither
 * headers nor team events (including packed storage rows and vNext events)
 * stay `other` — the reader counts them, never interprets their payloads.
 * @param line - one log line (the classifier does not require it to be
 *   non-empty; empty/whitespace lines classify as `unreadable` and callers
 *   should skip them before classifying).
 * @returns the classification (pure, no throw).
 */
export declare function classifyLegacyLogLine(line: string): LegacyLogLineClassification;
/**
 * The closed roster-warning reason vocabulary. Every warning a roster file
 * can produce names exactly one of these; consumers may branch on `reason`
 * without parsing message text.
 */
export declare const ROSTER_WARNING_REASONS: {
    /** The file carries no (or an unterminated) `---` frontmatter block. */
    readonly FRONTMATTER_MISSING: "FRONTMATTER_MISSING";
    /** The frontmatter `schemaVersion` is present but is not 1. */
    readonly SCHEMA_VERSION_MISMATCH: "SCHEMA_VERSION_MISMATCH";
    /** The frontmatter has no non-empty string `id`. */
    readonly ID_MISSING: "ID_MISSING";
    /** The frontmatter `role` is absent or not a known role token. */
    readonly ROLE_INVALID: "ROLE_INVALID";
    /** The frontmatter has no non-empty string `name`. */
    readonly NAME_MISSING: "NAME_MISSING";
    /** The frontmatter has no non-empty string `description`. */
    readonly DESCRIPTION_MISSING: "DESCRIPTION_MISSING";
    /** The roster file was listed but could not be read through the port. */
    readonly FILE_UNREADABLE: "FILE_UNREADABLE";
};
/** One roster-warning reason. */
export type RosterWarningReason = (typeof ROSTER_WARNING_REASONS)[keyof typeof ROSTER_WARNING_REASONS];
/** The lenient parse of one roster file (best-effort member fields). */
export interface LegacyRosterFileParse {
    /** The member id, when a non-empty string. */
    readonly id?: string;
    /** The member role, when a known role token. */
    readonly role?: 'leader' | 'teammate';
    /** The member name, when a non-empty string. */
    readonly name?: string;
    /** The member description, when a non-empty string. */
    readonly description?: string;
    /** The warnings produced while parsing (closed vocabulary). */
    readonly warnings: readonly RosterWarningReason[];
}
/**
 * Leniently parse one legacy roster `.md` file.
 *
 * Deviation from the frozen legacy parser (documented): the legacy parser
 * was all-or-nothing — a missing `id`, a bad `role`, or an unsupported
 * `schemaVersion` dropped the whole file. The reader's mandate is
 * best-effort inspection (DevPlan §20.6), so every such defect degrades to
 * a closed-vocabulary warning while the remaining fields are still kept.
 * Only the frontmatter block itself is structural: without it there is
 * nothing to parse and the member surfaces with no fields.
 *
 * @param content - the raw UTF-8 file content.
 * @returns the best-effort member fields plus the warnings.
 */
export declare function parseLegacyRosterFile(content: string): LegacyRosterFileParse;
//# sourceMappingURL=format.d.ts.map