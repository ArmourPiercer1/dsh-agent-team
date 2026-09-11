/**
 * A2 (alpha.2, plan §7) — canonical operation + exact fingerprint.
 *
 * The CORE SECURITY BOUNDARY of alpha.2: turns one concrete tool call
 * (the pre-execute payload — tool name + losslessly-parsed, deep-frozen
 * arguments) into a {@link CanonicalOperation}:
 *
 * - the PRIMARY RESOURCE identity — for the file tools, the opaque
 *   canonical key of the target file from the INJECTED
 *   {@link PathTargetResolver} (the A5 adapter wraps the upstream public
 *   `ctx.fs.resolve(path, { cwd: sessionCwd, signal })` seam, plan §7.2);
 *   for `bash`, the tool itself (`{ kind: 'tool', key: 'bash' }` —
 *   tool-level only, plan §4);
 * - the FINGERPRINT — `'sha256:' + sha256(canonicalJson(securityProjection))`
 *   over the per-tool security projection (plan §7.3/§7.4): deterministic,
 *   covering every security-relevant field, no timestamp, no random id,
 *   NO display string.
 *
 * What this module IS (and deliberately is NOT):
 *
 * - It IS pure: no `node:` imports, no upstream `@deepseek-ai/*` imports,
 *   no `process.cwd()`, no tool-execution internals — the resolver is
 *   injected per call, so the same module serves every backend and every
 *   session cwd, and unit tests use a deterministic fake resolver;
 * - it IS fail-closed (plan §7.5): any canonicalization failure throws a
 *   typed {@link OperationPermissionError} (`OPERATION_CANONICALIZATION_FAILED`
 *   + the closed `details.reason`) — it never resolves to a pass-through;
 * - it is NOT the resolver: it does not match policy rules (A3), does not
 *   scope allows (A4), and does not listen to `tools/pre-execute` (A5);
 * - it is NOT a path parser: it never interprets, normalizes, or
 *   case-folds the raw `file_path` — the resolver seam owns all path
 *   semantics, including every Windows concern (plan §7.6);
 * - it is NOT an argument validator for NON-security fields: unknown
 *   extra argument keys are ignored (the upstream tool schema is the
 *   authority at execution), while security-relevant fields are
 *   canonicalized with the TOOL'S OWN defaults and rejected fail-closed
 *   where the tool itself would reject the value (see the per-tool
 *   projections below).
 *
 * Per-tool security projections (plan §7.3; the fingerprint input —
 * `canonicalJson` = the contracts package' deterministic key-sorted
 * `canonicalJsonStringify`):
 *
 * - `read`          `{ tool, resourceKey, offset, limit }`
 *     EFFECTIVE values (the tool's own defaulting, `parseReadArgs`):
 *     `offset ?? 1` (one-based) and `limit ?? 2000`. The fixed default
 *     2000 is the upstream `tool-fs` `readLimit` config default
 *     (`READ_LIMIT` in `packages/fs/tool-fs/src/read.ts`) — DECISION
 *     (plan §7.3 "document which"): the fingerprint uses the DEFAULT
 *     deployment constant, NOT the live deployment cap, so omitted-limit
 *     calls canonicalize identically across deployments; a deployment
 *     with a non-default `readLimit` may see one documented fingerprint
 *     residual (an omitted-limit read equals an explicit
 *     `limit: 2000` read in its projection — see the module report).
 *     A present-but-invalid offset/limit (not a positive integer — the
 *     tool would reject it) fails closed: there is no effective window.
 * - `read_image`    `{ tool, resourceKey }`
 * - `write`         `{ tool, resourceKey, contentHash }` — the content
 *     is HASHED (`'sha256:' + hex`), never persisted in the projection
 *     (plan §7.3). An empty `content` is legitimate (the tool writes an
 *     empty file) and is a distinct fingerprint from any other content.
 * - `edit`          `{ tool, resourceKey, oldHash, newHash, replaceAll }`
 *     — `old_string`/`new_string` hashed, `replace_all` defaulted to
 *     `false` (the tool's own default, `parseEditArgs`); the tool's own
 *     rejections are mirrored fail-closed (empty `old_string`,
 *     `old_string === new_string` — a guaranteed no-op the tool refuses).
 * - `lsp`           `{ tool, resourceKey, operation, line, character }`
 *     — only the fields that change the LSP operation's meaning
 *     (plan §7.3): the closed `operation` enum (the upstream
 *     `tool-lsp` four) and the RAW one-based model coordinates (the
 *     tool's one-based→zero-based conversion is bijective, so the model
 *     coordinates fully determine the operation). Missing/non-positive-
 *     integer coordinates and unknown operations fail closed (the tool
 *     would reject them).
 * - `bash`          `{ tool, commandHash }` — the RESOURCE stays
 *     tool-level (plan §4/§7.1: `{ kind: 'tool', key: 'bash' }` — the
 *     resolver is never called), but the FINGERPRINT Binds the command
 *     (H2 P1-2 ruling, plan §7.4 "covering every security-relevant
 *     field"): `commandHash` = `'sha256:' + hex(sha256(command))` over
 *     the RAW command string — NO shell parsing, no normalization (the
 *     command is the security-relevant field for bash, so a durable
 *     approval is verifiable as "which shell payload was approved";
 *     before H2 the command was deliberately excluded and EVERY bash
 *     command shared one constant fingerprint — P1-2). A
 *     missing/non-string/whitespace-only command fails closed with the
 *     closed `bash-command-*` reasons (the upstream `tool-bash`
 *     `validateBashArgs` rejects all three before executing).
 *
 * Windows emphasis (plan §7.6): separator normalization, case semantics,
 * relative-vs-absolute, `..` traversal, and symlink/junction identity are
 * ALL owned by the resolver seam (the upstream backend's
 * `resolve()`/realpath behavior is the contract — see the real-backend
 * test). This module defines none of them itself.
 *
 * @module @dsh-agent-team/runtime/operation-permission/canonical-operation
 */
import { canonicalJsonStringify, toRemoteSafeDetail } from '../../contracts/src/index.js';
import { sha256Hex } from '../../domain/blueprint/src/index.js';
import { canonicalizationFailed } from './errors.js';
import { FILE_PERMISSION_TOOL_VALUES, PERMISSION_TOOL_VALUES, } from './types.js';
/**
 * The EFFECTIVE `read` window defaults (the tool's own defaulting —
 * `parseReadArgs`): `offset` one-based, default 1; `limit` default 2000
 * = the upstream `tool-fs` `readLimit` config default (`READ_LIMIT`),
 * used as a FIXED constant (documented decision, module header — the
 * fingerprint must not depend on the live deployment cap).
 */
export const READ_OFFSET_DEFAULT = 1;
export const READ_LIMIT_DEFAULT = 2000;
/**
 * The closed `lsp` operation enum — the upstream `tool-lsp` tool's four
 * operations (mirrored verbatim; the tool's schema enum is the
 * authority).
 */
export const LSP_OPERATION_VALUES = [
    'goToDefinition',
    'findReferences',
    'goToImplementation',
    'hover',
];
/** The fixed `bash` tool-level resource key/display (plan §4/§7.1). */
export const BASH_TOOL_RESOURCE_KEY = 'bash';
// ---------------------------------------------------------------------------
// Classification (plan §7.5: before any parameter resolution)
// ---------------------------------------------------------------------------
/**
 * Classify one tool name against the closed permission vocabulary
 * (plan §7.5). Pure and synchronous — the A5 adapter calls this FIRST
 * so an unsupported tool reaches `next()` WITHOUT entering the
 * parameter resolver.
 *
 * @param name - the tool name from the pre-execute payload.
 * @returns the closed three-way class (file / tool-level / unsupported).
 */
export function classifyPermissionTool(name) {
    if (FILE_PERMISSION_TOOL_VALUES.includes(name)) {
        return { kind: 'file', tool: name };
    }
    if (name === 'bash') {
        return { kind: 'tool-level', tool: 'bash' };
    }
    return { kind: 'unsupported' };
}
/**
 * Whether the tool name is inside the closed permission vocabulary
 * (either class). Convenience predicate over {@link classifyPermissionTool}.
 * @param name - the tool name.
 * @returns true for the six closed permission tools, false otherwise.
 */
export function isPermissionToolName(name) {
    return PERMISSION_TOOL_VALUES.includes(name);
}
// ---------------------------------------------------------------------------
// Argument extraction (fail-closed on the security-relevant fields)
// ---------------------------------------------------------------------------
/** The arguments must be a plain object (the tool's JSON parameter record). */
function asArgumentRecord(tool, arguments_, reasonMissing) {
    if (typeof arguments_ !== 'object' || arguments_ === null || Array.isArray(arguments_)) {
        throw canonicalizationFailed(tool, reasonMissing, {
            valueType: toRemoteSafeDetail(typeof arguments_),
        });
    }
    return arguments_;
}
/**
 * Extract + validate the primary `file_path` of a file tool. Mirrors the
 * upstream tools' own checks (a missing/non-string/blank path is
 * rejected by every file tool before execution) — fail-closed here, so
 * a path the tool would never resolve is never authorized.
 */
function extractFilePath(tool, args) {
    const value = args['file_path'];
    if (value === undefined) {
        throw canonicalizationFailed(tool, 'file-path-missing');
    }
    if (typeof value !== 'string') {
        throw canonicalizationFailed(tool, 'file-path-not-a-string', {
            valueType: toRemoteSafeDetail(typeof value),
        });
    }
    if (value.trim().length === 0) {
        throw canonicalizationFailed(tool, 'file-path-empty');
    }
    return value;
}
/** Positive-integer check (the upstream tools' `oneBased`/`parsePositiveInteger`). */
function isPositiveInteger(value) {
    return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}
/**
 * The `read` effective window (module header: the tool's own defaulting;
 * a present-but-invalid value fails closed — the tool would reject it,
 * so there is no effective window to authorize).
 */
function effectiveReadWindow(tool, args) {
    const offset = args['offset'];
    const limit = args['limit'];
    if (offset !== undefined && !isPositiveInteger(offset)) {
        throw canonicalizationFailed(tool, 'read-offset-invalid', {
            value: toRemoteSafeDetail(offset),
        });
    }
    if (limit !== undefined && !isPositiveInteger(limit)) {
        throw canonicalizationFailed(tool, 'read-limit-invalid', {
            value: toRemoteSafeDetail(limit),
        });
    }
    return {
        offset: offset ?? READ_OFFSET_DEFAULT,
        limit: limit ?? READ_LIMIT_DEFAULT,
    };
}
/** The `write` content (required string; an EMPTY string is legitimate). */
function extractWriteContent(tool, args) {
    const value = args['content'];
    if (value === undefined) {
        throw canonicalizationFailed(tool, 'write-content-missing');
    }
    if (typeof value !== 'string') {
        throw canonicalizationFailed(tool, 'write-content-not-a-string', {
            valueType: toRemoteSafeDetail(typeof value),
        });
    }
    return value;
}
/** The `edit` strings + replaceAll (the tool's own validation, mirrored). */
function extractEditFields(tool, args) {
    const oldString = args['old_string'];
    const newString = args['new_string'];
    if (oldString === undefined) {
        throw canonicalizationFailed(tool, 'edit-old-string-missing');
    }
    if (newString === undefined) {
        throw canonicalizationFailed(tool, 'edit-new-string-missing');
    }
    if (typeof oldString !== 'string' || typeof newString !== 'string') {
        throw canonicalizationFailed(tool, 'edit-string-not-a-string', {
            oldType: toRemoteSafeDetail(typeof oldString),
            newType: toRemoteSafeDetail(typeof newString),
        });
    }
    if (oldString.length === 0) {
        throw canonicalizationFailed(tool, 'edit-old-string-empty');
    }
    if (oldString === newString) {
        throw canonicalizationFailed(tool, 'edit-old-equals-new');
    }
    const replaceAll = args['replace_all'];
    if (replaceAll !== undefined && typeof replaceAll !== 'boolean') {
        throw canonicalizationFailed(tool, 'edit-replace-all-not-boolean', {
            value: toRemoteSafeDetail(replaceAll),
        });
    }
    return { oldString, newString, replaceAll: replaceAll ?? false };
}
/**
 * The `bash` command (H2 P1-2: the command IS the security-relevant field
 * for bash). Mirrors the upstream `tool-bash` `validateBashArgs` BEFORE
 * executing: a missing, non-string, or whitespace-only command is
 * rejected by the tool itself, so such a call has no well-formed
 * projection and fails closed. The returned value is the RAW command
 * string — NO shell parsing, no normalization (the fingerprint hashes it
 * verbatim; the adapter's display preview is separate and never
 * authoritative).
 */
function extractBashCommand(tool, args) {
    const value = args['command'];
    if (value === undefined) {
        throw canonicalizationFailed(tool, 'bash-command-missing');
    }
    if (typeof value !== 'string') {
        throw canonicalizationFailed(tool, 'bash-command-not-a-string', {
            valueType: toRemoteSafeDetail(typeof value),
        });
    }
    if (value.trim().length === 0) {
        throw canonicalizationFailed(tool, 'bash-command-empty');
    }
    return value;
}
/** The `lsp` operation + raw one-based coordinates (the tool's validation, mirrored). */
function extractLspFields(tool, args) {
    const operation = args['operation'];
    if (operation === undefined) {
        throw canonicalizationFailed(tool, 'lsp-operation-missing');
    }
    if (typeof operation !== 'string' || !LSP_OPERATION_VALUES.includes(operation)) {
        throw canonicalizationFailed(tool, 'lsp-operation-unknown', {
            value: toRemoteSafeDetail(operation),
        });
    }
    const line = args['line'];
    const character = args['character'];
    if (!isPositiveInteger(line)) {
        throw canonicalizationFailed(tool, 'lsp-line-invalid', {
            value: toRemoteSafeDetail(line),
        });
    }
    if (!isPositiveInteger(character)) {
        throw canonicalizationFailed(tool, 'lsp-character-invalid', {
            value: toRemoteSafeDetail(character),
        });
    }
    return { operation, line, character };
}
// ---------------------------------------------------------------------------
// Fingerprint (plan §7.4)
// ---------------------------------------------------------------------------
/** One security-relevant string, hashed into the projection (never the raw value). */
function hashString(value) {
    return `sha256:${sha256Hex(value)}`;
}
/**
 * The fingerprint: `'sha256:' + sha256(canonicalJson(securityProjection))`
 * (plan §7.4). The projection is a deterministic, key-sorted,
 * lossless-JSON object built by the per-tool projectors (module header)
 * — no timestamp, no random id, no display string.
 */
function buildFingerprint(projection) {
    return `sha256:${sha256Hex(canonicalJsonStringify(projection))}`;
}
// ---------------------------------------------------------------------------
// The canonicalization entrypoint
// ---------------------------------------------------------------------------
/**
 * Canonicalize one tool call into its {@link CanonicalOperation}
 * (plan §7.1/§7.3/§7.4/§7.5).
 *
 * @param input - the tool name, the parsed (deep-frozen) arguments, and
 *   the injected path-resolution seam (plan §7.2).
 * @returns the canonical operation (opaque resource key + display +
 *   exact fingerprint).
 * @throws {@link OperationPermissionError} —
 *   `OPERATION_CANONICALIZATION_FAILED` with the closed `details.reason`
 *   — on ANY canonicalization failure (unsupported tool, malformed
 *   security-relevant argument, unresolvable resource, malformed
 *   resolver result). The A5 adapter maps it to a `deny` — it must
 *   NEVER become a pass-through (plan §7.5).
 */
export async function canonicalizeOperation(input) {
    const { name, arguments: rawArguments, resolveTarget } = input;
    const class_ = classifyPermissionTool(name);
    if (class_.kind === 'unsupported') {
        throw canonicalizationFailed(name, 'tool-unsupported', {
            knownTools: toRemoteSafeDetail([...PERMISSION_TOOL_VALUES]),
        });
    }
    // Tool-level (bash): the RESOURCE is the tool itself (plan §4/§7.1 —
    // stays tool-level; no file key, the resolver is never called), but
    // the FINGERPRINT BINDS the command (H2 P1-2 ruling): the command IS
    // the security-relevant field for bash, so the projection carries its
    // hash (the write `contentHash` pattern) — a durable approval is
    // verifiable as "which shell payload was approved". NO shell parsing:
    // the raw string, hashed verbatim (the adapter's display preview is
    // separate and never authoritative).
    if (class_.kind === 'tool-level') {
        const args = asArgumentRecord('bash', rawArguments, 'bash-command-missing');
        const command = extractBashCommand('bash', args);
        return {
            tool: 'bash',
            resource: { kind: 'tool', key: BASH_TOOL_RESOURCE_KEY, display: BASH_TOOL_RESOURCE_KEY },
            fingerprint: buildFingerprint({ tool: 'bash', commandHash: hashString(command) }),
        };
    }
    const tool = class_.tool;
    const args = asArgumentRecord(tool, rawArguments, 'file-path-missing');
    const filePath = extractFilePath(tool, args);
    // Validate the tool's security-relevant fields BEFORE the resolver
    // call (the resolver is the only I/O): a malformed value fails
    // closed with zero backend round-trips.
    let projection;
    switch (tool) {
        case 'read': {
            const window = effectiveReadWindow(tool, args);
            projection = {
                tool: 'read',
                resourceKey: '',
                offset: window.offset,
                limit: window.limit,
            };
            break;
        }
        case 'read_image': {
            projection = { tool: 'read_image', resourceKey: '' };
            break;
        }
        case 'write': {
            const content = extractWriteContent(tool, args);
            projection = { tool: 'write', resourceKey: '', contentHash: hashString(content) };
            break;
        }
        case 'edit': {
            const { oldString, newString, replaceAll } = extractEditFields(tool, args);
            projection = {
                tool: 'edit',
                resourceKey: '',
                oldHash: hashString(oldString),
                newHash: hashString(newString),
                replaceAll,
            };
            break;
        }
        case 'lsp': {
            const { operation: lspOperation, line, character } = extractLspFields(tool, args);
            projection = {
                tool: 'lsp',
                resourceKey: '',
                operation: lspOperation,
                line,
                character,
            };
            break;
        }
    }
    const target = await resolveResource(tool, filePath, resolveTarget);
    projection['resourceKey'] = target.key;
    return operation(tool, target, buildFingerprint(projection));
}
/**
 * Resolve the primary file resource through the injected seam, failing
 * closed on every seam violation (plan §7.5): a rejection, a non-plain
 * result, a non-string/empty key, or a non-string display. The key is
 * passed through OPAQUE — never parsed, normalized, or transformed.
 */
async function resolveResource(tool, filePath, resolveTarget) {
    let result;
    try {
        result = await resolveTarget(filePath);
    }
    catch (error) {
        throw canonicalizationFailed(tool, 'resolver-threw', {
            resolverError: error instanceof Error ? error.message : toRemoteSafeDetail(error),
        });
    }
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        throw canonicalizationFailed(tool, 'resolver-result-malformed', {
            valueType: toRemoteSafeDetail(typeof result),
        });
    }
    const { key, display } = result;
    if (typeof key !== 'string' || key.length === 0) {
        throw canonicalizationFailed(tool, 'resolver-key-empty', {
            key: toRemoteSafeDetail(key),
        });
    }
    if (typeof display !== 'string') {
        throw canonicalizationFailed(tool, 'resolver-result-malformed', {
            display: toRemoteSafeDetail(display),
        });
    }
    return { key, display };
}
/** Assemble the canonical operation (file resource class). */
function operation(tool, target, fingerprint) {
    return {
        tool,
        resource: { kind: 'file', key: target.key, display: target.display },
        fingerprint,
    };
}
//# sourceMappingURL=canonical-operation.js.map