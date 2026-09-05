/**
 * P7-T7 — legacy Team Session read-only reader: the operational core.
 *
 * One entry point ({@link inspectLegacyTeam}) plus the dispatch surface
 * ({@link dispatchReaderAction}) that makes the read-only mandate a typed
 * guarantee: every non-`inspect` action routed through the surface throws
 * `LEGACY_READER_MUTATION_REJECTED`. The module performs NO mutation of the
 * inspected home — the injected port has no write surface, and the reader
 * itself never calls beyond `listDir`/`readFile`.
 *
 * Detection rule (DevPlan §20.6, best-effort): the home degrades to the
 * native Chat/Trajectory view iff it carries NO roster members AND no
 * session log with legacy Team events in its own suffix. Everything else
 * surfaces as a legacy view with per-field degradation.
 *
 * Leader selection (frozen-fork projection semantics, best-effort): the
 * legacy bound-teammate mark (the member-bound event in a session's own
 * suffix) identifies member sessions; a leader is an UNBOUND session that
 * still carries Team facts. Among candidates: most Team events first (the
 * leader's log accumulates the team's coordination traffic), then earliest
 * `createdAt` (missing last), then id — deterministic.
 *
 * @module @dsh-agent-team/legacy/session-reader/inspect
 */
import { LEGACY_TEAM_SESSION_EVENT_NAMES } from '../../contracts/src/index.js';
import { LEGACY_READER_ERROR_CODES, LegacyReaderError } from './errors.js';
import { classifyLegacyLogLine, decodeSegment, parseLegacyRosterFile, ROSTER_WARNING_REASONS, } from './format.js';
import { ROSTER_SOURCES } from './types.js';
/**
 * The legacy bound-teammate mark, derived from the contracts detection
 * vocabulary (this module deliberately carries no legacy event literal).
 */
const BOUND_EVENT_NAME = LEGACY_TEAM_SESSION_EVENT_NAMES.find((name) => name.endsWith('member-bound'));
/** The human text of one closed roster-warning reason. */
const ROSTER_WARNING_MESSAGES = {
    [ROSTER_WARNING_REASONS.FRONTMATTER_MISSING]: 'no complete YAML frontmatter block; the file contributes no fields',
    [ROSTER_WARNING_REASONS.SCHEMA_VERSION_MISMATCH]: 'frontmatter schemaVersion is not 1; the file is parsed anyway (best-effort)',
    [ROSTER_WARNING_REASONS.ID_MISSING]: 'frontmatter has no non-empty string id; the member cannot be matched by id',
    [ROSTER_WARNING_REASONS.ROLE_INVALID]: "frontmatter role is absent or not 'leader'/'teammate'; the role is left absent",
    [ROSTER_WARNING_REASONS.NAME_MISSING]: 'frontmatter has no non-empty string name',
    [ROSTER_WARNING_REASONS.DESCRIPTION_MISSING]: 'frontmatter has no non-empty string description',
    [ROSTER_WARNING_REASONS.FILE_UNREADABLE]: 'the roster file is listed but could not be read through the port',
};
/** Join one path segment under a base (pure; forward-slash separated). */
function joinPath(base, segment) {
    const b = base === '' ? '' : base.replace(/[/\\]+$/, '');
    return b === '' ? segment : `${b}/${segment}`;
}
/** Sort a shallow copy of an array of `{ name }` entries by name (code units). */
function byName(entries) {
    return [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
/** One-shot error message extraction for port-fault re-typing. */
function errorMessage(value) {
    return value instanceof Error ? value.message : String(value);
}
/**
 * Validate and normalize the inspect request.
 * @param request - the raw request object.
 * @returns the validated request.
 * @throws `LegacyReaderError` `LEGACY_READER_INVALID_REQUEST` on any defect.
 */
function validateRequest(request) {
    if (typeof request !== 'object' || request === null) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST, 'the inspect request must be an object with a non-empty string dshHome', { got: typeof request });
    }
    const raw = request;
    if (typeof raw.dshHome !== 'string' || raw.dshHome.length === 0) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST, 'the inspect request dshHome must be a non-empty string', { field: 'dshHome' });
    }
    if (raw.workspaceCwd !== undefined && (typeof raw.workspaceCwd !== 'string' || raw.workspaceCwd.length === 0)) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST, 'the inspect request workspaceCwd must be a non-empty string or absent', { field: 'workspaceCwd' });
    }
    if (raw.projectDir !== undefined && (typeof raw.projectDir !== 'string' || raw.projectDir.length === 0)) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST, 'the inspect request projectDir must be a non-empty string or absent', { field: 'projectDir' });
    }
    const result = { dshHome: raw.dshHome };
    if (typeof raw.workspaceCwd === 'string')
        result.workspaceCwd = raw.workspaceCwd;
    if (typeof raw.projectDir === 'string')
        result.projectDir = raw.projectDir;
    return result;
}
/** A best-effort port listing: contract violations re-typed, not swallowed. */
function safeListDir(port, path) {
    try {
        return port.listDir(path);
    }
    catch (error) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_PORT_FAILURE, `the read-only port listDir(${path}) threw; the port contract is best-effort and must return undefined on absence`, { path, message: errorMessage(error) });
    }
}
/** A best-effort port read: contract violations re-typed, not swallowed. */
function safeReadFile(port, path) {
    try {
        return port.readFile(path);
    }
    catch (error) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_PORT_FAILURE, `the read-only port readFile(${path}) threw; the port contract is best-effort and must return undefined on absence`, { path, message: errorMessage(error) });
    }
}
/**
 * Scan both roster directories (home first, then the workspace overlay).
 * Legacy discovery semantics: per member id the later source wins (workspace
 * beats home); within one source the last file in name order wins. Members
 * without a parseable id cannot collide and are appended after the id'd
 * ones, in scan order.
 * @param port - the read-only port.
 * @param request - the validated request.
 * @returns the deduplicated roster plus every roster warning.
 */
function scanRoster(port, request) {
    const warnings = [];
    const raw = [];
    const sources = [
        { source: ROSTER_SOURCES[0], dir: joinPath(request.dshHome, 'teammates') },
        ...(request.workspaceCwd === undefined
            ? []
            : [{ source: ROSTER_SOURCES[1], dir: joinPath(request.workspaceCwd, '.dsh/teammates') }]),
    ];
    for (const entry of sources) {
        const dirEntries = safeListDir(port, entry.dir);
        if (dirEntries === undefined)
            continue;
        for (const file of byName(dirEntries.filter((e) => e.kind === 'file'))) {
            if (!file.name.endsWith('.md'))
                continue;
            const content = safeReadFile(port, joinPath(entry.dir, file.name));
            if (content === undefined) {
                warnings.push({
                    source: entry.source,
                    fileName: file.name,
                    reason: ROSTER_WARNING_REASONS.FILE_UNREADABLE,
                    message: ROSTER_WARNING_MESSAGES[ROSTER_WARNING_REASONS.FILE_UNREADABLE],
                });
                continue;
            }
            const parsed = parseLegacyRosterFile(content);
            for (const reason of parsed.warnings) {
                warnings.push({
                    source: entry.source,
                    fileName: file.name,
                    reason,
                    message: ROSTER_WARNING_MESSAGES[reason],
                });
            }
            const member = { source: entry.source, fileName: file.name };
            if (parsed.id !== undefined)
                member.id = parsed.id;
            if (parsed.role !== undefined)
                member.role = parsed.role;
            if (parsed.name !== undefined)
                member.name = parsed.name;
            if (parsed.description !== undefined)
                member.description = parsed.description;
            raw.push(member);
        }
    }
    const byId = new Map();
    const noId = [];
    for (const member of raw) {
        if (member.id !== undefined)
            byId.set(member.id, member);
        else
            noId.push(member);
    }
    return { members: [...byId.values(), ...noId], warnings };
}
/**
 * Read one session directory's log into its evidence row (best-effort,
 * never throws on artifact defects).
 * @param port - the read-only port.
 * @param projectDirName - the project directory name the log lives under.
 * @param dirPath - the session directory path.
 * @param dirName - the session directory name (the encoded session id).
 * @returns the evidence row.
 */
function readSessionEvidence(port, projectDirName, dirPath, dirName) {
    const directoryId = decodeSegment(dirName);
    const dirEntries = safeListDir(port, dirPath);
    let logArtifact;
    if (dirEntries !== undefined) {
        const plain = dirEntries.some((e) => e.kind === 'file' && e.name === 'session.jsonl');
        const zstd = dirEntries.some((e) => e.kind === 'file' && e.name === 'session.jsonl.zstd');
        logArtifact = plain ? 'session.jsonl' : zstd ? 'session.jsonl.zstd' : undefined;
    }
    if (logArtifact !== 'session.jsonl') {
        return {
            sessionId: undefined,
            directoryId,
            projectDir: projectDirName,
            headerPresent: false,
            eventCount: 0,
            unreadableLineCount: 0,
            teamEventCounts: {},
            teamEventTotal: 0,
            logDecodable: false,
            logArtifact,
        };
    }
    const content = safeReadFile(port, joinPath(dirPath, 'session.jsonl'));
    if (content === undefined) {
        return {
            sessionId: undefined,
            directoryId,
            projectDir: projectDirName,
            headerPresent: false,
            eventCount: 0,
            unreadableLineCount: 0,
            teamEventCounts: {},
            teamEventTotal: 0,
            logDecodable: true,
            logArtifact: 'session.jsonl',
        };
    }
    const nonEmpty = [];
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length > 0)
            nonEmpty.push(trimmed);
    }
    let headerPresent = false;
    let fields;
    if (nonEmpty.length > 0) {
        const first = classifyLegacyLogLine(nonEmpty[0]);
        if (first.kind === 'header' && first.header !== undefined) {
            headerPresent = true;
            fields = first.header;
        }
    }
    const countedStart = headerPresent ? 1 : 0;
    const seedLength = fields?.seedLength;
    const teamEventCounts = {};
    let teamEventTotal = 0;
    let unreadableLineCount = 0;
    for (let i = countedStart; i < nonEmpty.length; i++) {
        const classified = classifyLegacyLogLine(nonEmpty[i]);
        if (classified.kind === 'unreadable') {
            unreadableLineCount++;
            continue;
        }
        if (classified.kind !== 'legacy-team-event')
            continue;
        if (seedLength !== undefined) {
            // Own-suffix rule (legacy projection): a forked-ancestor fact (seq
            // below the seed boundary) is not a fact of this session. Lines
            // without a readable seq are tolerated (counted) — best-effort never
            // asserts the absence of Team facts.
            const parsed = classified.parsed;
            const seq = typeof parsed === 'object' && parsed !== null
                ? parsed.seq
                : undefined;
            if (typeof seq === 'number' && seq < seedLength)
                continue;
        }
        const name = classified.eventName;
        if (name === undefined)
            continue;
        teamEventCounts[name] = (teamEventCounts[name] ?? 0) + 1;
        teamEventTotal++;
    }
    const evidence = {
        sessionId: fields?.id,
        directoryId,
        projectDir: projectDirName,
        headerPresent,
        eventCount: nonEmpty.length - countedStart,
        unreadableLineCount,
        teamEventCounts,
        teamEventTotal,
        logDecodable: true,
        logArtifact: 'session.jsonl',
    };
    if (fields?.createdAt !== undefined)
        evidence.createdAt = fields.createdAt;
    if (fields?.cwd !== undefined)
        evidence.cwd = fields.cwd;
    if (fields?.origin !== undefined)
        evidence.origin = fields.origin;
    if (fields?.delegationDepth !== undefined)
        evidence.delegationDepth = fields.delegationDepth;
    if (fields?.parentSession !== undefined)
        evidence.parentSession = fields.parentSession;
    if (fields?.seedLength !== undefined)
        evidence.seedLength = fields.seedLength;
    return evidence;
}
/**
 * Scan the session logs under `<dshHome>/sessions/` (optionally narrowed to
 * one project directory).
 * @param port - the read-only port.
 * @param request - the validated request.
 * @returns every scanned session log, sorted by (project directory, id).
 */
function scanSessions(port, request) {
    const root = joinPath(request.dshHome, 'sessions');
    const projectEntries = safeListDir(port, root);
    if (projectEntries === undefined)
        return [];
    let projects = byName(projectEntries.filter((e) => e.kind === 'dir'));
    if (request.projectDir !== undefined) {
        projects = projects.filter((e) => e.name === request.projectDir);
    }
    const out = [];
    for (const project of projects) {
        const projectPath = joinPath(root, project.name);
        const sessionEntries = safeListDir(port, projectPath);
        if (sessionEntries === undefined)
            continue;
        for (const sessionDir of byName(sessionEntries.filter((e) => e.kind === 'dir'))) {
            out.push(readSessionEvidence(port, project.name, joinPath(projectPath, sessionDir.name), sessionDir.name));
        }
    }
    return out.sort((a, b) => {
        if (a.projectDir !== b.projectDir)
            return a.projectDir < b.projectDir ? -1 : 1;
        if (a.directoryId !== b.directoryId)
            return a.directoryId < b.directoryId ? -1 : 1;
        return 0;
    });
}
/** Whether one session is the legacy bound-teammate mark. */
function isBoundSession(evidence) {
    if (BOUND_EVENT_NAME === undefined)
        return false;
    return (evidence.teamEventCounts[BOUND_EVENT_NAME] ?? 0) > 0;
}
/** The effective session id for ordering and identity (header id, else dir id). */
function effectiveId(evidence) {
    return evidence.sessionId ?? evidence.directoryId;
}
/** Deep-freeze a plain-JSON value (the returned views are read-only by construction). */
function deepFreeze(value) {
    if (typeof value !== 'object' || value === null)
        return value;
    if (Array.isArray(value)) {
        for (const item of value)
            deepFreeze(item);
    }
    else {
        for (const key of Object.keys(value)) {
            deepFreeze(value[key]);
        }
    }
    return Object.freeze(value);
}
/**
 * Inspect one legacy DSH home for Team Session metadata (READ-ONLY).
 *
 * This is the ONLY operational entry of the reader. It never writes,
 * mutates, resumes, or restores anything in the inspected home: the port
 * surface has no write method, and the result is a frozen plain-JSON view.
 *
 * Degradation (required behavior, DevPlan §20.6): a home with no roster
 * members and no session log carrying legacy Team events in its own suffix
 * yields the native Chat/Trajectory fallback view — the legacy metadata
 * simply is not there, and that is not an error.
 *
 * @param port - the injected read-only home port.
 * @param request - the inspect request (`{ dshHome, workspaceCwd?, projectDir? }`).
 * @returns the frozen inspection view (legacy-team or native-fallback).
 * @throws `LegacyReaderError` with `LEGACY_READER_INVALID_REQUEST` for a
 *   malformed request, or `LEGACY_READER_PORT_FAILURE` when the port
 *   violates its best-effort contract.
 */
export function inspectLegacyTeam(port, request) {
    const req = validateRequest(request);
    const roster = scanRoster(port, req);
    const sessions = scanSessions(port, req);
    const teamSessions = sessions.filter((s) => s.teamEventTotal > 0);
    if (roster.members.length === 0 && teamSessions.length === 0) {
        return deepFreeze({
            status: 'native-fallback',
            reason: 'no-legacy-metadata',
            native: sessions,
            degradedTo: 'native-chat-trajectory',
        });
    }
    // Leader: an unbound session that carries Team facts.
    const candidates = teamSessions.filter((s) => !isBoundSession(s));
    let leader;
    for (const candidate of candidates) {
        if (leader === undefined) {
            leader = candidate;
            continue;
        }
        const a = candidate;
        const b = leader;
        if (a.teamEventTotal !== b.teamEventTotal) {
            if (a.teamEventTotal > b.teamEventTotal)
                leader = a;
            continue;
        }
        const aTime = a.createdAt ?? Number.POSITIVE_INFINITY;
        const bTime = b.createdAt ?? Number.POSITIVE_INFINITY;
        if (aTime !== bTime) {
            if (aTime < bTime)
                leader = a;
            continue;
        }
        const aId = effectiveId(a);
        const bId = effectiveId(b);
        if (aId !== bId && aId < bId)
            leader = a;
    }
    const leaderId = leader === undefined ? undefined : effectiveId(leader);
    const memberIds = new Set();
    if (leaderId !== undefined) {
        for (const session of sessions) {
            if (leader !== undefined && session === leader)
                continue;
            const sid = effectiveId(session);
            if (isBoundSession(session) || (session.origin === 'subagent' && session.parentSession === leaderId)) {
                memberIds.add(sid);
            }
        }
    }
    const team = {
        teamId: leaderId,
        leaderSessionId: leaderId,
        leaderSelection: teamSessions.length > 0 ? 'team-events' : 'roster-only',
        roster: roster.members,
        rosterWarnings: roster.warnings,
        sessions,
        memberChildSessionIds: [...memberIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    };
    return deepFreeze({ status: 'legacy-team', team });
}
/**
 * The reader dispatch surface (what the mounted tool / harness rows expose).
 * `inspect` is the only accepted action; EVERY other action — a mutation,
 * resume, restore, delete, or anything else — is rejected with the typed
 * `LEGACY_READER_MUTATION_REJECTED` error. Legacy Team Sessions are
 * read-only (invariant 65); there is no entry to change them, ever.
 *
 * @param port - the injected read-only home port.
 * @param action - the requested action token (only `inspect` is accepted).
 * @param request - the inspect request (validated for `inspect`).
 * @returns the frozen inspection view.
 * @throws `LegacyReaderError` `LEGACY_READER_MUTATION_REJECTED` for any
 *   non-inspect action, `LEGACY_READER_INVALID_REQUEST` for a malformed
 *   action or request.
 */
export function dispatchReaderAction(port, action, request) {
    if (typeof action !== 'string' || action.length === 0) {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST, 'the reader surface accepts one non-empty action token; only inspect is implemented', { got: typeof action });
    }
    if (action !== 'inspect') {
        throw new LegacyReaderError(LEGACY_READER_ERROR_CODES.LEGACY_READER_MUTATION_REJECTED, `the legacy Team Session reader is read-only; action '${action}' has no entry (mutate/resume/restore are permanently unavailable for legacy Team Sessions)`, { action });
    }
    return inspectLegacyTeam(port, request);
}
//# sourceMappingURL=inspect.js.map