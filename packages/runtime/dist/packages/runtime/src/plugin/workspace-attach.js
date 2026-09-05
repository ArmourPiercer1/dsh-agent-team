/**
 * M2 — the host-side workspace attach seam (plan §15.5 / §M2).
 *
 * The production host hard-injects the upstream public `workspaceRegistry`
 * service (the web profile's workspace row is the provider — CORE PATCH
 * BUDGET = 0, no upstream import) and builds ONE narrow closure over it:
 * the {@link WorkspaceAttachPort} the production root exposes for the v2
 * create path (resolve a registered workspace by path; attach the
 * materialized root session to it). Every other module sees only that
 * port — never the upstream registry (plan §M2 item 2).
 *
 * Failure posture (fail-closed, stable codes):
 *
 *   - an ABSENT or structurally MALFORMED service rejects the host
 *     bootstrap before any durable effect (TEAM_PLUGIN_SERVICE_MISSING —
 *     the same code the `agents` / `connection` service failures use; the
 *     hard `inject` declaration parks the row in a real composition, and
 *     this re-check keeps every non-Loader world honest);
 *   - a path that resolves to NO registered workspace rejects with
 *     TEAM_PLUGIN_WORKSPACE_NOT_FOUND (a missing directory AND an
 *     existing unowned directory are both NOT_FOUND — the v2 create never
 *     degrades to creating a workspace for an unknown path; that is the
 *     workspace-management surface, not the team);
 *   - an attach rejection (cwd mismatch, unknown session, missing or
 *     invalid header cwd, storage fault) rejects with
 *     TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED, carrying the upstream error's
 *     message in the carrier.
 *
 * Attach idempotency is NOT reimplemented here: it is delegated verbatim
 * to the upstream `Workspace.attachSession` contract (an already
 * accounted id resolves without writing — plan §M2 item 6). The port
 * never caches resolutions or dedupes attaches itself.
 *
 * Pure module: no I/O, no `node:` builtins — path canonicalization and
 * the directory checks live in the upstream registry (its `resolveByPath`
 * normalizes through `fs.realpath`); this module only resolves, looks up,
 * delegates, and wraps.
 * @module @dsh-agent-team/runtime/plugin/workspace-attach
 */
import { TEAM_PLUGIN_ERROR_CODES, TeamPluginError, } from './types.js';
/**
 * Validate the injected `workspaceRegistry` service against the narrow
 * structural projection (fail-closed).
 *
 * @param service - the raw `ctx.get('workspaceRegistry')` value.
 * @returns the validated registry.
 * @throws {TeamPluginError} TEAM_PLUGIN_SERVICE_MISSING when the service
 *   is absent (a composition missing the web-app workspace row) or
 *   structurally unusable (a provider lacking the two public methods the
 *   seam consumes).
 */
export function assertWorkspaceRegistryLike(service) {
    if (service === null || service === undefined) {
        throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING, 'the "workspaceRegistry" public service is absent from the plugin context (the web profile provides it through the workspace row — the team row hard-injects it)');
    }
    if (typeof service !== 'object' ||
        typeof service.resolveByPath !== 'function' ||
        typeof service.list !== 'function') {
        throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING, 'the "workspaceRegistry" public service is malformed: expected resolveByPath and list to be functions');
    }
    return service;
}
/**
 * Build the narrow workspace attach closure over the validated registry
 * (the production root's `workspaceAttach` — plan §M2 items 2/4/6).
 *
 * @param registry - the validated public registry
 *   (see {@link assertWorkspaceRegistryLike}).
 * @returns the {@link WorkspaceAttachPort} closure.
 */
export function createWorkspaceAttach(registry) {
    /**
     * The id→entity lookup the seam owns: `list()` is the registry's
     * synchronous durable-order projection (the narrow projection exposes
     * no `get(id)`, so the listing IS the lookup).
     */
    function findWorkspace(workspaceId) {
        for (const workspace of registry.list()) {
            if (workspace.id === workspaceId)
                return workspace;
        }
        throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND, `no registered workspace has id "${workspaceId}" (it was deleted between resolve and attach)`);
    }
    return {
        async resolvePath(path) {
            if (typeof path !== 'string' || path.length === 0) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND, 'the workspace path must be a non-empty string');
            }
            let workspace;
            try {
                workspace = await registry.resolveByPath(path);
            }
            catch (error) {
                // A missing path rejects during the upstream realpath; every
                // resolution failure is a NOT_FOUND (fail-closed — the message
                // carries the upstream reason).
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND, `no workspace is registered for path "${path}": ${error instanceof Error ? error.message : String(error)}`);
            }
            if (workspace === undefined || workspace === null) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND, `no workspace is registered for path "${path}" (the directory exists but no workspace owns it)`);
            }
            // The canonical path is VERBATIM the registry's: the seam never
            // re-normalizes (the registry's realpath form is the contract).
            return { workspaceId: workspace.id, path: workspace.path };
        },
        async attachSession(workspaceId, sessionId) {
            const workspace = findWorkspace(workspaceId);
            try {
                await workspace.attachSession(sessionId);
            }
            catch (error) {
                // Cwd mismatch, unknown session, missing/invalid header cwd, or a
                // storage fault on the registry write chain — every upstream
                // attach rejection becomes a typed ATTACH_FAILED; the upstream
                // message is preserved in the carrier.
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED, `attaching session "${sessionId}" to workspace "${workspace.path}" failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        },
    };
}
//# sourceMappingURL=workspace-attach.js.map