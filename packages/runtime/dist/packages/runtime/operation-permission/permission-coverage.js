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
// ---------------------------------------------------------------------------
// The closed six-class classification (plan §7.3).
// ---------------------------------------------------------------------------
/** The closed authority-owner classification (plan §7.3, values = the
 *  stable kebab-case strings the typed error detail carries). */
export const PERMISSION_COVERAGE_CLASSIFICATIONS = {
    /** A tool of the final managed permission vocabulary
     *  (`PERMISSION_TOOL_NAMES`): the operation-permission layer is the
     *  authority owner; a call with no explicit rule falls to
     *  `permissions.default` (invariant §1.3 — no explicit rule needed
     *  for coverage). */
    MANAGED_OPERATION_PERMISSION: 'managed-operation-permission',
    /** A tool actually selected by the current Team tool catalog and
     *  registered by the Team runtime: the `teamTools` capability + the
     *  Team runtime/control plane is the authority owner. */
    OTHER_MANAGED_TEAM_TOOL: 'other-managed-team-tool',
    /** A tool PROVEN by the actual mount to be introduced by the currently
     *  permitted MCP surface (the `schemas()` delta across the reconcile —
     *  never a name-prefix guess). */
    OTHER_MANAGED_MCP: 'other-managed-mcp',
    /** A tool of the closed source-reviewed exact-name registry
     *  ({@link SAFE_UNMANAGED_TOOL_NAMES}): reviewed to have no
     *  security-relevant side effect; coverage passes with an optional
     *  diagnostic only. */
    SAFE_UNMANAGED: 'safe-unmanaged',
    /** A KNOWN tool with a known sensitive effect but no alpha.2 operation
     *  adapter / other authority owner (plan §7.3-E): FATAL on a strict
     *  surface unless the capability layer removed it first. */
    KNOWN_SENSITIVE_UNMANAGED: 'known-sensitive-unmanaged',
    /** A tool whose semantics the Team plugin has not reviewed at all
     *  (plan §7.3-F): FATAL — never warning-only. */
    UNKNOWN_UNMANAGED: 'unknown-unmanaged',
};
// ---------------------------------------------------------------------------
// The closed SAFE_UNMANAGED registry (plan §7.3-D).
//
// Membership requires a source review of the pinned upstream tool source
// (evidence: dev/agent-workflow/evidence/alpha2-capability-completion/
// a2c2/safe-unmanaged-registry.md) proving the tool has NONE of:
// filesystem content read/write, process/shell/code execution, network
// egress, arbitrary MCP/tool dispatch, generic subagent orchestration,
// job process control, cross-team governance messaging, or other
// material external side effect. A name that merely "looks safe" is NOT
// evidence. The registry starts minimal and grows only by review.
// ---------------------------------------------------------------------------
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
export const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write'];
// ---------------------------------------------------------------------------
// The closed KNOWN_SENSITIVE_UNMANAGED registry (plan §7.3-E + §11.3).
//
// "Known tool, known sensitive effect, no alpha.2 operation adapter or
// other authority owner." Presence on a strict (capabilities.permissions)
// final surface = FATAL unless the capability layer (e.g.
// `builtinToolDeny`) removed it first. `grep`/`glob` stay here until A2C-6
// lands (plan §11.3).
// ---------------------------------------------------------------------------
/** The closed KNOWN_SENSITIVE_UNMANAGED exact-name registry (plan
 *  §7.3-E): fs-search (A2C-6 deferred), subagent orchestration,
 *  network egress, job process control, and the ordinary DSH agent
 *  messaging/control surface. */
export const KNOWN_SENSITIVE_TOOL_NAMES = [
    // filesystem search — A2C-6 deferred (plan §11.3): content disclosure
    // outside the read-permission coverage.
    'grep',
    'glob',
    // generic subagent / workflow orchestration — escapes MemberInstance
    // governance.
    'subagent',
    'subagent_fork',
    'ralph',
    'workflow',
    // network egress.
    'web_fetch',
    'web_search',
    // job process control (the tool-jobs model-facing controls).
    'job_list',
    'job_output',
    'job_kill',
    // ordinary DSH agent messaging/control surface (tool-subagent-control).
    'send_message',
    'interrupt_agent',
    'list_agents',
];
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
export const KNOWN_SENSITIVE_TOOL_PREFIXES = ['job_'];
/** The closed per-category sensitive reasons (deterministic strings the
 *  typed error detail carries). */
const SENSITIVE_CATEGORY_REASONS = {
    /** grep/glob — the A2C-6 deferred fs-search family. */
    fsSearch: 'filesystem search can disclose content outside read-permission coverage (A2C-6 is deferred; no alpha.2 operation adapter)',
    /** subagent/subagent_fork/ralph/workflow — orchestration. */
    orchestration: 'generic subagent/workflow orchestration escapes MemberInstance governance (no alpha.2 operation adapter)',
    /** web_fetch/web_search — egress. */
    network: 'network egress is outside the static permission coverage (no alpha.2 operation adapter)',
    /** the job_* process-control family. */
    jobs: 'background job process control is outside the static permission coverage (no alpha.2 operation adapter)',
    /** the ordinary DSH agent messaging/control surface. */
    agentControl: 'ordinary DSH agent messaging/control surface escapes MemberInstance governance (no alpha.2 operation adapter)',
};
/** The exact-name → category map (closed; the prefix family maps to the
 *  jobs category). */
const SENSITIVE_CATEGORY_BY_NAME = new Map([
    ['grep', 'fsSearch'],
    ['glob', 'fsSearch'],
    ['subagent', 'orchestration'],
    ['subagent_fork', 'orchestration'],
    ['ralph', 'orchestration'],
    ['workflow', 'orchestration'],
    ['web_fetch', 'network'],
    ['web_search', 'network'],
    ['job_list', 'jobs'],
    ['job_output', 'jobs'],
    ['job_kill', 'jobs'],
    ['send_message', 'agentControl'],
    ['interrupt_agent', 'agentControl'],
    ['list_agents', 'agentControl'],
]);
/** The stable remediation of a known-sensitive unmanaged tool. */
export const SENSITIVE_REMEDIATION = 'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)';
/** The stable remediation of an unknown unmanaged tool. */
export const UNKNOWN_REMEDIATION = 'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)';
/** The stable reason of an unknown unmanaged tool. */
export const UNKNOWN_REASON = 'no reviewed authority owner is known for this tool (unknown semantics)';
/**
 * Classify ONE final-surface tool name (plan §7.3, the fixed
 * precedence). Pure: the result depends only on `name` + `facts`.
 * @param name - a final model-facing tool name.
 * @param facts - the injected ownership facts.
 * @returns the closed class for the name.
 */
export function classifyPermissionCoverageTool(name, facts) {
    if (facts.managedToolNames.includes(name)) {
        return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.MANAGED_OPERATION_PERMISSION };
    }
    if (facts.teamToolNames.includes(name)) {
        return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.OTHER_MANAGED_TEAM_TOOL };
    }
    if (facts.mcpToolNames.includes(name)) {
        return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.OTHER_MANAGED_MCP };
    }
    if (SAFE_UNMANAGED_TOOL_NAMES.includes(name)) {
        return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.SAFE_UNMANAGED };
    }
    const category = SENSITIVE_CATEGORY_BY_NAME.get(name);
    if (category !== undefined) {
        return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.KNOWN_SENSITIVE_UNMANAGED };
    }
    if (KNOWN_SENSITIVE_TOOL_PREFIXES.some((prefix) => name.startsWith(prefix))) {
        return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.KNOWN_SENSITIVE_UNMANAGED };
    }
    return { name, classification: PERMISSION_COVERAGE_CLASSIFICATIONS.UNKNOWN_UNMANAGED };
}
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
export function evaluatePermissionCoverage(toolNames, facts) {
    const unique = [...new Set(toolNames.map(String))].sort();
    const tools = [];
    const safeUnmanaged = [];
    const unmanagedTools = [];
    for (const name of unique) {
        const classified = classifyPermissionCoverageTool(name, facts);
        tools.push(classified);
        if (classified.classification === PERMISSION_COVERAGE_CLASSIFICATIONS.SAFE_UNMANAGED) {
            safeUnmanaged.push(name);
        }
        else if (classified.classification === PERMISSION_COVERAGE_CLASSIFICATIONS.KNOWN_SENSITIVE_UNMANAGED) {
            const category = SENSITIVE_CATEGORY_BY_NAME.get(name);
            unmanagedTools.push({
                name,
                classification: 'known-sensitive-unmanaged',
                reason: category !== undefined
                    ? SENSITIVE_CATEGORY_REASONS[category]
                    : SENSITIVE_CATEGORY_REASONS.jobs, // the job_ prefix family
                remediation: SENSITIVE_REMEDIATION,
            });
        }
        else if (classified.classification === PERMISSION_COVERAGE_CLASSIFICATIONS.UNKNOWN_UNMANAGED) {
            unmanagedTools.push({
                name,
                classification: 'unknown-unmanaged',
                reason: UNKNOWN_REASON,
                remediation: UNKNOWN_REMEDIATION,
            });
        }
    }
    return {
        ok: unmanagedTools.length === 0,
        tools,
        safeUnmanaged,
        unmanagedTools,
    };
}
// ---------------------------------------------------------------------------
// The MCP ownership delta (plan §7.3-C).
// ---------------------------------------------------------------------------
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
export function mcpIntroducedToolNames(preMcpNames, finalNames) {
    const before = new Set(preMcpNames.map(String));
    return [...new Set(finalNames.map(String))].filter((name) => !before.has(name)).sort();
}
// ---------------------------------------------------------------------------
// The strict-mode condition (invariant §1.2 / plan §7.1).
// ---------------------------------------------------------------------------
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
export function permissionCoverageGateEnabled(permissions) {
    return permissions !== undefined;
}
// ---------------------------------------------------------------------------
// The typed error detail (plan §7.4).
// ---------------------------------------------------------------------------
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
export function buildPermissionCoverageErrorDetail(verdict, context) {
    return {
        instanceId: String(context.instanceId),
        presetId: context.presetId === undefined || context.presetId === null ? null : String(context.presetId),
        unmanagedTools: verdict.unmanagedTools.map((entry) => ({
            name: entry.name,
            classification: entry.classification,
            reason: entry.reason,
            remediation: entry.remediation,
        })),
    };
}
//# sourceMappingURL=permission-coverage.js.map