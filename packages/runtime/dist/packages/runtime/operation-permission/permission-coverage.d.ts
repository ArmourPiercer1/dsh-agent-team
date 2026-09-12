/**
 * A2C-2 (alpha.2, plan §7) — the Permission Coverage Gate evaluator:
 * the pure, closed six-class authority-owner classification of the
 * FINAL model-facing tool surface of one agent.
 *
 * The gate does NOT check "is the tool name declared in the Blueprint"
 * (plan §7.1 / invariant §1.1 — that would be a new allow-list policy).
 * It checks: "does EVERY tool on the final model-facing surface have a
 * clear authority owner?" A tool with no owner (known-sensitive or
 * unknown) on the surface of an agent that declares
 * `capabilities.permissions` makes the SETUP fail closed (the typed
 * {@link PermissionCoverageUnmanagedError},
 * `alpha2-permission-coverage-unmanaged-tools` — see `errors.ts`).
 *
 * What this module IS (and deliberately is NOT):
 *
 * - It IS pure + closed: no `node:` imports, no upstream
 *   `@deepseek-ai/*` imports, no I/O, no ambient state. The ownership
 *   facts (managed vocabulary, selected team tools, proven MCP delta)
 *   are INJECTED by the caller — the live glue enumerates the final
 *   surface through the public `tools.schemas(scope)` seam and passes
 *   the deterministic facts in;
 * - the classification is a CLOSED six-way union with a FIXED
 *   precedence (a proven owner beats a name-based suspicion — the
 *   name-prefix guessing the plan forbids for MCP ownership is exactly
 *   what the precedence order rules out):
 *
 *     1. managed vocabulary        → MANAGED_OPERATION_PERMISSION
 *     2. selected+registered team  → OTHER_MANAGED_TEAM_TOOL
 *        tool names
 *     3. proven MCP-mount delta    → OTHER_MANAGED_MCP
 *     4. closed source-reviewed    → SAFE_UNMANAGED
 *        registry
 *     5. closed known-sensitive    → KNOWN_SENSITIVE_UNMANAGED  (FATAL)
 *        registry (names + the job_ family)
 *     6. anything else             → UNKNOWN_UNMANAGED          (FATAL)
 *
 * - managed tools PASS without any explicit Blueprint rule
 *   (invariant §1.3: the gate checks ownership, not per-tool
 *   declaration — the call-time decision is `permissions.default`);
 * - it is NOT the setup wiring (the glue installs it at the verified
 *   insertion point: after the MCP reconcile, before the
 *   parameter-permission listener — plan §7.2) and NOT the runtime
 *   enforcement (A3/A4/A5 are untouched — the gate is a setup-time
 *   integrity check over the surface about to be handed to the model);
 * - it is NOT an acknowledgement escape hatch: UNKNOWN_UNMANAGED is
 *   always fatal (plan §7.3-F: no warning-only).
 *
 * The registries are CLOSED and fail-closed by construction (plan
 * §7.8): any DSH preset update that adds a new tool lands in
 * UNKNOWN_UNMANAGED and blocks under `capabilities.permissions` until a
 * source review explicitly classifies it (a reviewed entry in
 * {@link SAFE_UNMANAGED_TOOL_NAMES}, a KNOWN_SENSITIVE entry, a managed
 * adapter, a Team tool, or a proven MCP surface).
 *
 * @module @dsh-agent-team/runtime/operation-permission/permission-coverage
 */
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js';
import type { PermissionCoverageErrorDetail, PermissionCoverageUnmanagedToolEntry } from './errors.js';
/** The closed authority-owner classification (plan §7.3, values = the
 *  stable kebab-case strings the typed error detail carries). */
export declare const PERMISSION_COVERAGE_CLASSIFICATIONS: {
    /** A tool of the final managed permission vocabulary
     *  (`PERMISSION_TOOL_NAMES`): the operation-permission layer is the
     *  authority owner; a call with no explicit rule falls to
     *  `permissions.default` (invariant §1.3 — no explicit rule needed
     *  for coverage). */
    readonly MANAGED_OPERATION_PERMISSION: "managed-operation-permission";
    /** A tool actually selected by the current Team tool catalog and
     *  registered by the Team runtime: the `teamTools` capability + the
     *  Team runtime/control plane is the authority owner. */
    readonly OTHER_MANAGED_TEAM_TOOL: "other-managed-team-tool";
    /** A tool PROVEN by the actual mount to be introduced by the currently
     *  permitted MCP surface (the `schemas()` delta across the reconcile —
     *  never a name-prefix guess). */
    readonly OTHER_MANAGED_MCP: "other-managed-mcp";
    /** A tool of the closed source-reviewed exact-name registry
     *  ({@link SAFE_UNMANAGED_TOOL_NAMES}): reviewed to have no
     *  security-relevant side effect; coverage passes with an optional
     *  diagnostic only. */
    readonly SAFE_UNMANAGED: "safe-unmanaged";
    /** A KNOWN tool with a known sensitive effect but no alpha.2 operation
     *  adapter / other authority owner (plan §7.3-E): FATAL on a strict
     *  surface unless the capability layer removed it first. */
    readonly KNOWN_SENSITIVE_UNMANAGED: "known-sensitive-unmanaged";
    /** A tool whose semantics the Team plugin has not reviewed at all
     *  (plan §7.3-F): FATAL — never warning-only. */
    readonly UNKNOWN_UNMANAGED: "unknown-unmanaged";
};
/** One of the closed six authority-owner classes. */
export type PermissionCoverageClassification = (typeof PERMISSION_COVERAGE_CLASSIFICATIONS)[keyof typeof PERMISSION_COVERAGE_CLASSIFICATIONS];
/**
 * The closed SAFE_UNMANAGED exact-name registry (plan §7.3-D).
 *
 * `todo_write` (upstream `@deepseek-ai/dsh-tool-todo`): the executor
 * validates the whole-list replacement and appends ONE `todo/write`
 * event to the CALLING agent's own session (the session's own journal —
 * per-agent UI state, last-write-wins on replay); it performs no
 * filesystem access, no process/shell execution, no network I/O, no
 * tool/MCP dispatch, no subagent orchestration, no job control, and no
 * cross-agent messaging. Source review at the pinned upstream
 * `a66e470204`: `packages/todo/tool-todo/src/index.ts` (imports L8-L15:
 * no node: builtins, no network/process/fs/mcp/subagent/job/messaging
 * modules; `apply` registers exactly `todo_write` + the `todos`
 * projection; `execute` L203-L220: validate → `exec.agent.session
 * .append('todo/write', …)` → counts; a non-agent caller is rejected).
 */
export declare const SAFE_UNMANAGED_TOOL_NAMES: readonly string[];
/** The closed KNOWN_SENSITIVE_UNMANAGED exact-name registry (plan
 *  §7.3-E): fs-search (A2C-6 deferred), subagent orchestration,
 *  network egress, job process control, and the ordinary DSH agent
 *  messaging/control surface. */
export declare const KNOWN_SENSITIVE_TOOL_NAMES: readonly string[];
/**
 * The closed KNOWN_SENSITIVE family prefixes (plan §7.3-E names the
 * `job_*` process-control category as a FAMILY): any final-surface tool
 * carrying one of these prefixes is KNOWN_SENSITIVE_UNMANAGED even when
 * its exact name is not in {@link KNOWN_SENSITIVE_TOOL_NAMES} (a future
 * job control is sensitive, not unknown — both are FATAL; the label
 * stays the sensitive one). Name-prefix inference is used ONLY here,
 * for the sensitivity registry the plan defines by family; it is NEVER
 * used to claim MCP or Team ownership.
 */
export declare const KNOWN_SENSITIVE_TOOL_PREFIXES: readonly string[];
/** The stable remediation of a known-sensitive unmanaged tool. */
export declare const SENSITIVE_REMEDIATION = "remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)";
/** The stable remediation of an unknown unmanaged tool. */
export declare const UNKNOWN_REMEDIATION = "remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)";
/** The stable reason of an unknown unmanaged tool. */
export declare const UNKNOWN_REASON = "no reviewed authority owner is known for this tool (unknown semantics)";
/**
 * The injected ownership facts of one agent's final surface (plan §7.3).
 * The caller (the live glue) derives each from the actual setup:
 * `managedToolNames` from the final managed vocabulary
 * (`PERMISSION_TOOL_NAMES` — never copied literals), `teamToolNames`
 * from the EXACTLY selected+registered Team tools, `mcpToolNames` from
 * the proven mount delta ({@link mcpIntroducedToolNames}).
 */
export interface PermissionCoverageFacts {
    /** The final managed permission vocabulary (the alpha.2 operation-
     *  permission layer's authority names — `PERMISSION_TOOL_NAMES`). */
    readonly managedToolNames: readonly string[];
    /** The Team tool names actually selected by the current catalog and
     *  registered on the agent. */
    readonly teamToolNames: readonly string[];
    /** The tool names proven by the actual MCP mount (the surface delta
     *  across the reconcile). */
    readonly mcpToolNames: readonly string[];
}
/** One classified final-surface tool (name + its closed class). */
export interface ClassifiedTool {
    readonly name: string;
    readonly classification: PermissionCoverageClassification;
}
/** One FATAL unmanaged entry of the verdict / the typed error detail
 *  (the plan §7.4 shape: name + classification + reason + remediation). */
export type UnmanagedToolEntry = PermissionCoverageUnmanagedToolEntry;
/**
 * The verdict of one final-surface evaluation (plan §7.3).
 * `ok === false` ⇔ `unmanagedTools` is non-empty ⇔ the setup must fail
 * closed with the typed error.
 */
export interface PermissionCoverageVerdict {
    /** true ⇔ every final-surface tool has an authority owner (the
     *  unmanaged classes are absent). */
    readonly ok: boolean;
    /** EVERY final-surface tool with its class (deduped, sorted by name —
     *  the complete ownership audit of the surface). */
    readonly tools: readonly ClassifiedTool[];
    /** The SAFE_UNMANAGED names on the surface (sorted) — the optional
     *  PASS diagnostic (the gate never fails on them). */
    readonly safeUnmanaged: readonly string[];
    /** The FATAL entries (known-sensitive + unknown, sorted by name) —
     *  exactly the content of the typed error detail's
     *  `unmanagedTools`. */
    readonly unmanagedTools: readonly UnmanagedToolEntry[];
}
/**
 * Classify ONE final-surface tool name (plan §7.3, the fixed
 * precedence). Pure: the result depends only on `name` + `facts`.
 * @param name - a final model-facing tool name.
 * @param facts - the injected ownership facts.
 * @returns the closed class for the name.
 */
export declare function classifyPermissionCoverageTool(name: string, facts: PermissionCoverageFacts): ClassifiedTool;
/**
 * Evaluate the WHOLE final model-facing surface (plan §7.3 / §7.4).
 *
 * Pure + deterministic: the input names are deduped and sorted; the
 * output `tools` / `safeUnmanaged` / `unmanagedTools` are sorted by
 * name; equal inputs give byte-identical verdicts (the typed error
 * detail built from the verdict is therefore deterministic).
 *
 * @param toolNames - the final surface tool names (any order; the
 *   glue passes the sorted `tools.schemas(scope)` projection).
 * @param facts - the injected ownership facts.
 * @returns the closed verdict.
 */
export declare function evaluatePermissionCoverage(toolNames: readonly string[], facts: PermissionCoverageFacts): PermissionCoverageVerdict;
/**
 * The tool names a permitted MCP mount INTRODUCED: the set difference
 * `finalSurface − preMcpSurface` over the ACTUAL `schemas()` projections
 * taken before and after the reconcile (plan §7.3-C: ownership is
 * proven by the real mount — NEVER by name-prefix guessing).
 *
 * @param preMcpNames - the surface names before the MCP reconcile.
 * @param finalNames - the final surface names after the reconcile.
 * @returns the introduced names (deduped, sorted).
 */
export declare function mcpIntroducedToolNames(preMcpNames: readonly string[], finalNames: readonly string[]): string[];
/**
 * Whether the Permission Coverage Gate is ENABLED for one bound
 * template: STRICT mode ⇔ the Template declares
 * `capabilities.permissions`. An absent policy means the gate is
 * ABSENT (not disabled-quietly): no gate code runs, no surface
 * enumeration happens, and the alpha.1 / legacy behavior is
 * byte-for-byte unchanged (invariant §1.2).
 *
 * @param permissions - the bound template's `capabilities.permissions`
 *   (the A1-normalized TemplatePermissionPolicy), or `undefined` when
 *   the template declares none.
 * @returns true ⇔ the gate runs at setup.
 */
export declare function permissionCoverageGateEnabled(permissions: TemplatePermissionPolicy | undefined): boolean;
/**
 * Build the deterministic typed-error detail of one failing verdict
 * (plan §7.4: `instanceId` + `presetId` + `unmanagedTools[{name,
 * classification, reason, remediation}]`, tool names sorted — the
 * verdict's `unmanagedTools` are already sorted; the detail carries
 * them verbatim, so equal verdicts + context give equal details).
 *
 * @param verdict - the failing verdict (`ok === false`).
 * @param context - `instanceId` (the bound instance) and `presetId`
 *   (the composed preset identity, or `null` when the surface's preset
 *   cannot be determined).
 * @returns the lossless-JSON detail object.
 */
export declare function buildPermissionCoverageErrorDetail(verdict: PermissionCoverageVerdict, context: {
    readonly instanceId: string;
    readonly presetId: string | null | undefined;
}): PermissionCoverageErrorDetail;
//# sourceMappingURL=permission-coverage.d.ts.map