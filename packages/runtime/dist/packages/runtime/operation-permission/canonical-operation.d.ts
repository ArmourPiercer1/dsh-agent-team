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
 * - `bash`          `{ tool, commandHash, workdir, runInBackground,
 *     timeoutMs, sandboxPermissions }` — the RESOURCE stays tool-level
 *     (plan §4/§7.1: `{ kind: 'tool', key: 'bash' }`), but the
 *     FINGERPRINT binds the command AND the execution effect (H2 P1-2 +
 *     H5 P1-B rulings, plan §7.4 "covering every security-relevant
 *     field"):
 *     - `commandHash` = `'sha256:' + hex(sha256(command))` over the RAW
 *       command string — NO shell parsing, no normalization (the command
 *       is the security-relevant field for bash, so a durable approval
 *       is verifiable as "which shell payload was approved"; before H2
 *       the command was deliberately excluded and EVERY bash command
 *       shared one constant fingerprint — P1-2);
 *     - `workdir` = the CANONICAL KEY of `args.workdir ?? '.'` from the
 *       injected resolver (H5 — the resolver is consulted EXACTLY ONCE
 *       — for the workdir authority key; the resource stays tool-level,
 *       plan §3.2). The input is normalized with the tool's own
 *       defaulting: omitted ⇒ `'.'` (the session cwd), an
 *       empty/whitespace-only string ⇒ `'.'` (upstream
 *       `resolvePath(cwd, '')` = cwd — an empty-string workdir is
 *       EFFECTIVELY the session cwd), a non-string ⇒ fail closed
 *       (`bash-workdir-not-a-string`). The seam's cwd basis IS the
 *       session cwd (lazily read per call), so omitted ≡ explicit
 *       session-cwd and symlinked workdirs bind their REAL identity
 *       (the backend's realpath — the ideal property: same effective
 *       workdir ⇒ same key ⇒ same fingerprint);
 *     - `runInBackground` = `args.run_in_background ?? false` (detached
 *       `jobs.start` job vs foreground `ctx.shell.run` — a different
 *       execution effect; present-but-non-boolean fails closed:
 *       `bash-run-in-background-not-boolean`);
 *     - `timeoutMs` = `args.timeoutMs ?? null` — the EXPLICIT value
 *       only (NEVER a deployment default or the executor cap, plan
 *       §4.4); present-but-not-(finite number > 0) fails closed
 *       (`bash-timeout-ms-invalid` — mirrors the upstream
 *       `validateBashArgs` check);
 *     - `sandboxPermissions` = `args.sandbox_permissions ?? null` — the
 *       requested mode string only (present-but-non-string fails closed:
 *       `bash-sandbox-permissions-not-a-string`); mode LEGALITY is the
 *       upstream authority at execution — the Team layer does not mint
 *       authority for a value upstream would reject (such a call never
 *       executes), and the `justification` pairing stays upstream's.
 *     `description`/`justification` are EXCLUDED from the projection
 *     (display/explanation metadata — the upstream's validation domain,
 *     plan §4.2/§4.5). A missing/non-string/whitespace-only command
 *     fails closed with the closed `bash-command-*` reasons (the
 *     upstream `tool-bash` `validateBashArgs` rejects all three before
 *     executing). WHY the effect-field validation is required (not
 *     defense-in-depth): the upstream materialization is lossless-JSON-
 *     only and the `tools/pre-execute` waterfall runs BEFORE any
 *     parameter-schema validation (`validateBashArgs` runs INSIDE
 *     `execute`) — malformed effect-field types DO reach this module.
 *
 * Windows emphasis (plan §7.6): separator normalization, case semantics,
 * relative-vs-absolute, `..` traversal, and symlink/junction identity are
 * ALL owned by the resolver seam (the upstream backend's
 * `resolve()`/realpath behavior is the contract — see the real-backend
 * test). This module defines none of them itself.
 *
 * @module @dsh-agent-team/runtime/operation-permission/canonical-operation
 */
import type { CanonicalOperation, PermissionToolClass, PathTargetResolver } from './types.js';
/**
 * The EFFECTIVE `read` window defaults (the tool's own defaulting —
 * `parseReadArgs`): `offset` one-based, default 1; `limit` default 2000
 * = the upstream `tool-fs` `readLimit` config default (`READ_LIMIT`),
 * used as a FIXED constant (documented decision, module header — the
 * fingerprint must not depend on the live deployment cap).
 */
export declare const READ_OFFSET_DEFAULT = 1;
export declare const READ_LIMIT_DEFAULT = 2000;
/**
 * The closed `lsp` operation enum — the upstream `tool-lsp` tool's four
 * operations (mirrored verbatim; the tool's schema enum is the
 * authority).
 */
export declare const LSP_OPERATION_VALUES: readonly string[];
/** The fixed `bash` tool-level resource key/display (plan §4/§7.1). */
export declare const BASH_TOOL_RESOURCE_KEY = "bash";
/** One canonicalization input: the pre-execute tool call + the injected seam. */
export interface CanonicalizeOperationInput {
    /** The tool name from the pre-execute payload (`exec.name`). */
    readonly name: string;
    /**
     * The losslessly-parsed, deep-frozen arguments exactly as the tool
     * schema defines them (`exec.arguments` — e.g. `{ file_path, offset,
     * limit }` for `read`; the `command` string for `bash`).
     */
    readonly arguments: unknown;
    /**
     * The injected path-resolution seam (plan §7.2) — the A5 adapter's
     * wrapper over `ctx.fs.resolve(path, { cwd: sessionCwd, signal })`.
     * Consulted for the file tools' primary resource, and — H5 — for the
     * `bash` workdir authority key (EXACTLY ONCE per bash operation, over
     * `args.workdir ?? '.'`; the resource stays tool-level, plan §3.2).
     * Never consulted for an unsupported tool.
     */
    readonly resolveTarget: PathTargetResolver;
}
/**
 * Classify one tool name against the closed permission vocabulary
 * (plan §7.5). Pure and synchronous — the A5 adapter calls this FIRST
 * so an unsupported tool reaches `next()` WITHOUT entering the
 * parameter resolver.
 *
 * @param name - the tool name from the pre-execute payload.
 * @returns the closed three-way class (file / tool-level / unsupported).
 */
export declare function classifyPermissionTool(name: string): PermissionToolClass;
/**
 * Whether the tool name is inside the closed permission vocabulary
 * (either class). Convenience predicate over {@link classifyPermissionTool}.
 * @param name - the tool name.
 * @returns true for the six closed permission tools, false otherwise.
 */
export declare function isPermissionToolName(name: string): boolean;
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
export declare function canonicalizeOperation(input: CanonicalizeOperationInput): Promise<CanonicalOperation>;
//# sourceMappingURL=canonical-operation.d.ts.map