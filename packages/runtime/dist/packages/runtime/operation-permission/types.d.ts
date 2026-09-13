/**
 * A2 (alpha.2, plan §7) — the operation-permission vocabulary: the closed
 * permission-tool names, the canonical operation output, and the injected
 * path-resolution seam.
 *
 * This module is the CORE SECURITY BOUNDARY of alpha.2 (plan §7): it turns
 * one concrete tool call (name + parsed arguments) into a
 * {@link CanonicalOperation} — a stable resource identity (`resource.key`,
 * opaque, from the injected resolver) plus an exact operation-impact
 * identity (`fingerprint`). The static resolver (A3) matches policy rules
 * against `resource.key`; the durable control plane (A4) scopes exact
 * allows to the `fingerprint`; the pre-execute adapter (A5) fails closed
 * on canonicalization errors.
 *
 * @module @dsh-agent-team/runtime/operation-permission/types
 */
/**
 * The closed tool vocabulary of the alpha.2 operation permission
 * (plan §4/§6.2: the five file tools with a clear primary file resource,
 * plus the shell class — A2C-1 — at tool level only).
 *
 * LOCAL ALIAS of the A1 contract type: A1 (parallel task, different
 * branch) adds the identical `PermissionTool` union to
 * `packages/domain/blueprint`. A2 must not depend on the A1 branch, so
 * the identical closed union is defined here instead. IMPORT SWAP for
 * the A3/A5 integration: once A1's module is merged, A3/A5 should import
 * `PermissionTool` from the A1 blueprint module and retire (or
 * re-export) this alias — the two definitions must never diverge (same
 * seven names, same closed semantics, plan §6.2 + A2C-1).
 */
export type PermissionTool = 'read' | 'read_image' | 'write' | 'edit' | 'lsp' | 'bash' | 'pwsh';
/** Every {@link PermissionTool} value, for membership checks. */
export declare const PERMISSION_TOOL_VALUES: readonly PermissionTool[];
/**
 * The file tools: their primary resource is the target file
 * (plan §4/§7.3 — parameter-level authority).
 */
export type FilePermissionTool = 'read' | 'read_image' | 'write' | 'edit' | 'lsp';
/** Every {@link FilePermissionTool} value, for membership checks. */
export declare const FILE_PERMISSION_TOOL_VALUES: readonly FilePermissionTool[];
/**
 * The tool-level permission tools (plan §4: the shell class allows
 * tool-level ask/deny only — a single command string cannot reliably
 * express the real resource/effect, so there is NO parameter-level
 * positive allow). A2C-1: the pinned-upstream standard preset exposes
 * `bash` on POSIX and `pwsh` on Windows, and the two upstream tools
 * (`tool-bash` / `tool-pwsh`) carry isomorphic execution arguments
 * (`command, description, timeoutMs?, workdir?, run_in_background?,
 * sandbox_permissions?, justification?`), so they form ONE shell class
 * with IDENTICAL rule and fingerprint semantics (plan §5.3/§5.4) — but
 * DISTINCT authority identities: `bash authority != pwsh authority`
 * (a rule for one never gates the other, and an approval for a bash
 * operation never authorizes a pwsh operation, and vice versa — the
 * fingerprint projection carries the exact tool name).
 */
export type ToolLevelPermissionTool = 'bash' | 'pwsh';
/**
 * Every {@link ToolLevelPermissionTool} value (the closed shell class —
 * A2C-1). The single source of the shell-class membership checks:
 * classification, the inert-exact-rule skip, and the end-cap supported-
 * tool set all derive from this list, so the class cannot drift.
 */
export declare const SHELL_PERMISSION_TOOL_VALUES: readonly ToolLevelPermissionTool[];
/**
 * The resource identity of one canonical operation (plan §7.1).
 *
 * `key` is the AUTHORITY identity: the opaque canonical key produced by
 * the injected path resolver (for `kind: 'file'`) or the fixed tool name
 * (for `kind: 'tool'`, `bash`). Consumers MUST NOT parse, normalize-case,
 * or otherwise transform it (plan §7.2) — for the upstream local backend
 * it is a realpath-like string, but a different backend may produce a
 * workspace URI or file id, and the authority semantics must hold for
 * all of them.
 *
 * `display` is UI/debug text only; it is NEVER part of the fingerprint
 * and a change of display must never change the authority (plan §7.4).
 */
export interface CanonicalResource {
    /** `'file'` = a resolved file resource; `'tool'` = the tool itself (a shell class member: bash / pwsh). */
    readonly kind: 'file' | 'tool';
    /** The opaque authority identity (never parsed, never compared for case). */
    readonly key: string;
    /** UI/debug display only (the resolver's `displayPath`, or the tool name). */
    readonly display: string;
}
/**
 * One canonical operation (plan §7.1) — the exact identity the static
 * resolver (A3) and the durable control plane (A4) consume:
 *
 * - `tool` — the closed permission tool name;
 * - `resource` — the primary resource identity (plan §7.3: one primary
 *   resource per supported tool);
 * - `fingerprint` — the exact operation-impact identity:
 *   `'sha256:' + hex(sha256(canonicalJson(securityProjection)))`
 *   (plan §7.4 — deterministic, covering every security-relevant field,
 *   no timestamp, no random id, no display string).
 */
export interface CanonicalOperation {
    readonly tool: PermissionTool;
    readonly resource: CanonicalResource;
    readonly fingerprint: string;
    /**
     * H5 (A2C-1: the shell class) — the resolved workdir target's
     * `display` string (the approval summary's `cwd=` token), for the
     * shell tools (`bash` / `pwsh`). Presentation-only — NEVER part of
     * the fingerprint/scope/authority: the fingerprint carries the opaque
     * workdir KEY, and the display exists solely for the summary.
     * Undefined for the file tools (and for any shell operation whose
     * workdir could not be resolved — those fail closed and never produce
     * an operation).
     */
    readonly workdirDisplay?: string;
}
/**
 * The injected path-resolution seam (plan §7.2): the module never reads
 * `process.cwd()` or tool-execution internals, and never imports upstream
 * `@deepseek-ai/*` packages — the A5 adapter injects a closure over the
 * upstream PUBLIC canonicalization seam
 * `ctx.fs.resolve(path, { cwd: sessionCwd, signal })`, binding the
 * calling agent's session workspace cwd (the upstream file tools'
 * resolution convention, `exec.agent.session.header.cwd`) and the
 * per-call signal, and unbranding the `FsTarget.targetKey` (branded
 * upstream, opaque here).
 *
 * Seam contract (violations are typed canonicalization failures — the
 * caller fails closed, plan §7.5):
 * - DETERMINISTIC: resolving the same file twice (any path spellings the
 *   backend treats as the same file) yields the same `key`; the backend
 *   owns the path semantics (separator normalization, case, `..`
 *   traversal, symlink/junction — plan §7.6: this module never defines
 *   its own);
 * - `key` is a non-empty opaque string; `display` is a string
 *   (UI/model-facing; never authority);
 * - a REJECTION (any thrown error, including the backend's typed
 *   filesystem errors) means the resource cannot be resolved.
 *
 * A2C-7 (plan §9): the result MAY additionally carry `handle` — the
 * OPAQUE resolved-target object (the upstream `FsTarget`) of the SAME
 * live provider that produced the key. It is a RUNTIME-ONLY seam field:
 * the A2 canonicalizer ignores it (it destructures only `key`/`display`),
 * and the A5 adapter uses it exclusively as the argument to the pinned
 * `FileSystem.contains(parent, child)` containment seam (both handles
 * from the same provider — the only legal containment authority; the
 * module never inspects, parses, or string-compares a handle). An
 * implementation that does not expose a handle (the pre-A2C-7 seam
 * shape) simply omits the field; a `subtree` rule's containment is then
 * undeterminable (deny lane: fail-closed; allow/ask: non-match — the
 * P1-3 lane asymmetry).
 *
 * @param path - the tool's raw `file_path` argument (unmodified — the
 *   backend owns all path interpretation, including relative resolution
 *   against the bound cwd).
 * @returns the opaque key + the display path of the resolved target
 *   (+ the optional opaque handle, A2C-7).
 */
export type PathTargetResolver = (path: string) => Promise<{
    readonly key: string;
    readonly display: string;
    readonly handle?: unknown;
}>;
/**
 * The closed classification of a tool NAME against the permission
 * vocabulary (plan §7.5: the A5 adapter must distinguish the three
 * classes BEFORE touching the parameter resolver):
 *
 * - `file` — a supported file tool: canonicalize the primary file
 *   resource (parameter-level authority);
 * - `tool-level` — the shell class (A2C-1: `bash` / `pwsh`): the whole
 *   tool is the resource (a `resource: any` rule puts the entire tool
 *   in ask/deny; no parameter-level allow exists);
 * - `unsupported` — not a permission tool at all (e.g. `web_fetch`,
 *   `team_delegate`): the adapter calls `next()` WITHOUT entering the
 *   parameter resolver.
 */
export type PermissionToolClass = {
    readonly kind: 'file';
    readonly tool: FilePermissionTool;
} | {
    readonly kind: 'tool-level';
    readonly tool: ToolLevelPermissionTool;
} | {
    readonly kind: 'unsupported';
};
//# sourceMappingURL=types.d.ts.map