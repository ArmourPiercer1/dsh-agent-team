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
import type { WorkspaceAttachPort, WorkspaceRegistryLike } from './types.js';
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
export declare function assertWorkspaceRegistryLike(service: unknown): WorkspaceRegistryLike;
/**
 * Build the narrow workspace attach closure over the validated registry
 * (the production root's `workspaceAttach` — plan §M2 items 2/4/6).
 *
 * @param registry - the validated public registry
 *   (see {@link assertWorkspaceRegistryLike}).
 * @returns the {@link WorkspaceAttachPort} closure.
 */
export declare function createWorkspaceAttach(registry: WorkspaceRegistryLike): WorkspaceAttachPort;
//# sourceMappingURL=workspace-attach.d.ts.map