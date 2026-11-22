/**
 * admission.ts — the one place a bound call can be refused before its body runs.
 *
 * WHY THIS EXISTS AT ALL. The host's dispatch already decides *whether a tool exists*; it does not
 * decide whether THIS agent may perform THIS operation on THIS locator. That decision is the
 * centre's, and it must be made in one place, before the body, for every tool — otherwise the
 * answer depends on which lane happened to be reached first, which is the defect the old route
 * shipped: a name-only check that passed while the body executed on the base provider.
 *
 * WHAT IT DOES NOT DO. It does not decide path containment, approval precedence, or grant
 * consumption. `member-io-policy` owns those (`matchLocator`'s precedence is deny → ask → allow,
 * and an uncovered locator is deny). This module supplies the two things that package cannot know:
 * **which axis a tool name belongs to**, and **that a call with no binding is refused rather than
 * admitted**. That is the whole delta, deliberately.
 *
 * PROCESS EXECUTION IS NOT AN I/O AXIS (owner ruling, review 20261122-1536 §1). The two questions
 * are different and are answered by different declarations:
 *
 *  - MAY this Member start this class of process/executor? That is an EXECUTION authorization. It
 *    comes from the already-existing v4 declarations compiled into the binding: the tool-level
 *    `toolBindings[].authorization` (allow / ask / deny), the declared
 *    `execution.executionBoundary` (`trusted-host | confined-subprocess | delegated-remote`), its
 *    `implementationOrigin`, and the composition's trusted `shellClass`/executor configuration.
 *  - WHAT may that process actually read, write and reach? That is bounded by the existing
 *    read/write/network ceilings and by the OS sandbox the executor applies. A shell's working
 *    directory does NOT bound what it can open, so it must never stand in for a path lane and this
 *    module never derives a process permission from one.
 *
 * There is deliberately NO `io.process` lane and no `Binding.process` rule set: process execution
 * authority is not path authority.
 *
 * `grep` is NOT a process tool. Its internal ripgrep child is an IMPLEMENTATION detail of the
 * native search tool, so a search call is admitted on the `fs.read` lane and never requires bash
 * execution authority.
 *
 * PTC (`run_code`) stays refused. Allowing `run_code` would be safe only if its worker, nested tool
 * calls, escalation and Stop all passed the same governance; that proof does not exist this round,
 * so the call is refused before the body with its own code rather than admitted on faith.
 *
 * THE UNWIRED RULE, AS CODE. `admit` refuses when the binding is absent, when the tool has no
 * declared axis, or when the arguments carry no locator the axis can be judged on. A controlled
 * call that the centre has not been wired for is refused — never forwarded to the composition
 * provider, and never admitted on the grounds that "nothing objected".
 *
 * @module packages/runtime/src/plugin/vnext/admission
 */
import { matchLocator } from '../../../member-io-policy/src/path-rules.js';
// The ONE closed vocabulary for the capabilities with no member I/O axis (round 55, C stage). The
// PTC entry is the same string the host-surface refusal point records, so a `run_code` call and a
// refused escalation can never carry two different names for the same missing authority.
import { HOST_SURFACE_REFUSALS } from './host-surface-refusal.mjs';
/** The axes a tool name can be admitted on. A name outside this table is not admitted at all. */
export const TOOL_AXES = Object.freeze({
    read: 'fs.read',
    read_image: 'fs.read',
    grep: 'fs.read',
    glob: 'fs.read',
    write: 'fs.write',
    edit: 'fs.write',
    web_fetch: 'net.fetch',
    bash: 'process.exec',
    pwsh: 'process.exec',
    run_code: 'process.exec',
});
/**
 * THE CENTRE'S OWN TOOLS. These are not I/O operations: they ask the centre to act (delegate, list,
 * resolve a control request) and their authority is enforced INSIDE the centre (Leader-only checks,
 * ControlService, work delivery), not by a file lane. They still require a binding, because an agent
 * the centre has not bound cannot be allowed to speak for a team - but they have no locator and no
 * fs/net/process axis, so judging them by one would be a category error.
 *
 * The list is CLOSED. A tool that is neither in it nor in `TOOL_AXES` is refused by name, so a new
 * family cannot become admitted by being forgotten here.
 */
export const CENTRE_TOOL_NAMES = Object.freeze([
    'team_list_members',
    'team_list_templates',
    'team_inspect_config',
    'team_create_member',
    'team_delegate',
    'team_follow_up',
    'team_collect',
    'team_send_message',
    'team_report_progress',
    'team_request_control',
    'team_resolve_control',
    'team_list_pending_control',
    'team_archive_member',
    'team_grant_permission',
    'team_revoke_permission',
]);
const CENTRE_TOOLS = new Set(CENTRE_TOOL_NAMES);
/**
 * MCP TOOLS. A mounted MCP server contributes `mcp__<server>__<tool>`. The centre cannot know what a
 * server tool does, so it judges the ONE thing the product declaration actually says about MCP: the
 * member's NETWORK axis, with the SERVER name as the locator. The mount-level per-member server gate
 * (`filterMcpServers` / the template's mcp grant) decides WHICH servers exist; the centre decides
 * whether this agent may reach them at all.
 *
 * A name that starts with the prefix but names no server is malformed, not a wildcard: it is refused
 * by name rather than admitted on a prefix match.
 */
export const MCP_TOOL_PREFIX = 'mcp__';
/** The server segment of a mounted MCP tool name, or `undefined` when the name is malformed. */
export function mcpServerOf(toolName) {
    if (!toolName.startsWith(MCP_TOOL_PREFIX))
        return undefined;
    const rest = toolName.slice(MCP_TOOL_PREFIX.length);
    const separator = rest.indexOf('__');
    if (separator <= 0)
        return undefined;
    const server = rest.slice(0, separator);
    return server === '' ? undefined : server;
}
/**
 * PRESERVED HOST CAPABILITIES. Goal/Todo, Team Skill and Subagent (spawn/control) are host tools
 * whose I/O is the HOST's own service (the goal store, `$DSH_HOME/skills`, the subagent registry),
 * not the member's workspace. They are preserved by the 06 contract, so refusing them would be the
 * feature loss this round exists to prevent - and judging them by the member's fs lane would be
 * wrong, because they do not touch it.
 *
 * THE JUDGEMENT IS RECORDED, NOT HIDDEN: their internal reads are OUTSIDE the member's fs ceiling
 * (a skill file is read by the host skill service). The centre binds the CALL and records the fact;
 * it does not claim the host service's own I/O is confined. Stated in the D report as a limit.
 *
 * MCP tools (`mcp__<server>__<tool>`) are deliberately NOT here: their transport and their effects
 * are unknowable to the centre, so they stay refused (explicit unavailability) until an MCP family
 * binding exists.
 */
export const HOST_CAPABILITY_TOOL_NAMES = Object.freeze([
    'skill',
    'todo_write',
    'get_goal',
    'create_goal',
    'update_goal',
    'subagent',
    'send_message',
    'interrupt_agent',
]);
const HOST_CAPABILITY_TOOLS = new Set(HOST_CAPABILITY_TOOL_NAMES);
/** The v4 execution boundaries, carried through the compiler unchanged. */
export const EXECUTION_BOUNDARIES = Object.freeze(['trusted-host', 'confined-subprocess', 'delegated-remote']);
/** Argument keys that carry the locator, in the order they are tried. */
const LOCATOR_KEYS = Object.freeze({
    read: ['file_path', 'path'],
    read_image: ['file_path', 'path'],
    grep: ['path'],
    glob: ['path'],
    write: ['file_path', 'path'],
    edit: ['file_path', 'path'],
    web_fetch: ['url'],
});
/**
 * Tools whose locator may be OMITTED, with the locator that omission actually means. `grep`/`glob`
 * search their working directory when the model gives no path, so "no locator" is not "unjudgeable":
 * it is the member's workspace root, and the lane judges that like any other locator. Leaving them
 * in the no-locator refusal would have refused the ordinary case - and taught the model to pass a
 * path just to get through, which is a worse surface than the one we started with.
 */
const DEFAULTED_LOCATORS = Object.freeze({
    grep: 'workspaceRoot',
    glob: 'workspaceRoot',
});
const refuse = (code, reason) => ({ kind: 'deny', code, reason });
/** Read the locator an axis needs. Absent means the call cannot be judged, so it is refused. */
function locatorOf(toolName, args) {
    if (args === null || typeof args !== 'object')
        return undefined;
    for (const key of LOCATOR_KEYS[toolName] ?? []) {
        const value = args[key];
        if (typeof value === 'string' && value.trim() !== '')
            return value;
    }
    return undefined;
}
/**
 * The locator this call is actually judged on. ONE definition, used by the decision AND by the
 * record, because a record that names a different locator than the one the lane judged is worse than
 * no record: it makes a refusal unreviewable.
 *
 * A process-class call is judged on EXECUTION authority, not on a locator; the value returned here is
 * recorded as CONTEXT (the working directory the call named, or the member's workspace root) and is
 * never an authorization input.
 */
function judgedLocator(toolName, args, binding) {
    // Recorded context for a process call, NOT a permission (see the doc above).
    if (TOOL_AXES[toolName] === 'process.exec')
        return locatorOf(toolName, args) ?? binding?.workspaceRoot;
    const defaulted = DEFAULTED_LOCATORS[toolName];
    return locatorOf(toolName, args) ?? (defaulted === 'workspaceRoot' ? binding?.workspaceRoot : undefined);
}
/**
 * Decide one call. Pure: no I/O, no clock, no binding mutation. A caller that needs the decision
 * to depend on state must pass that state in.
 */
export function admit(input) {
    const { binding, toolName, arguments: args } = input;
    if (binding === undefined) {
        // THE UNWIRED RULE. Not "no policy says no": there is no binding, so there is no governing
        // authority for this call, and admitting it would mean the composition provider decides.
        return refuse('ADMISSION_NO_BINDING', `no binding for tool ${JSON.stringify(toolName)} on this agent; a call the centre has not been wired for is refused, not forwarded`);
    }
    if (CENTRE_TOOLS.has(toolName)) {
        // Bound, then the centre's own authority decides. No lane is consulted because no lane applies.
        return { kind: 'allow' };
    }
    if (HOST_CAPABILITY_TOOLS.has(toolName)) {
        // A preserved host capability: NO lane applies (its I/O is the host's own service). The action
        // is admitted for a bound agent and recorded; the service's internal I/O is a stated limit.
        return { kind: 'allow' };
    }
    if (toolName.startsWith(MCP_TOOL_PREFIX)) {
        const server = mcpServerOf(toolName);
        if (server === undefined) {
            return refuse('ADMISSION_TOOL_UNBOUND', `tool ${JSON.stringify(toolName)} looks like an MCP tool but names no server; a prefix is not a permission`);
        }
        const perToolMcp = binding.perTool?.[toolName]?.network;
        const network = perToolMcp ?? binding.network;
        if (network !== 'allow') {
            return refuse('NETWORK_DENY', `MCP server ${JSON.stringify(server)} is refused: the network axis for this tool is ${network === 'deny' ? 'deny' : network === 'unsupported' ? 'unsupported by this binding' : 'unset'}, and an unset axis is not a permission`);
        }
        return { kind: 'allow' };
    }
    const axis = TOOL_AXES[toolName];
    if (axis === undefined) {
        return refuse('ADMISSION_TOOL_UNBOUND', `tool ${JSON.stringify(toolName)} has no declared I/O axis; an unclassified tool is never admitted by default`);
    }
    // C7 (PTC escalation) — EXPLICITLY UNAVAILABLE, and named as itself. `run_code` executes on the
    // process axis; the escalation that would widen it is the surviving host row
    // (`createPtcEscalationRouter`), whose one-shot grants are minted outside the centre. Refusing the
    // TOOL before the body is what makes the escalation path unreachable: an escalation is only ever
    // asked for a call that reached execution, and this call never does.
    //
    // WHY STILL REFUSED AFTER PROCESS-AUTHORITY ROUND 75: proving `run_code` safe requires showing its
    // WORKER process, every NESTED tool call it makes, its escalation path and its Stop all pass this
    // same governance. None of those four is demonstrated this round, so allowing the tool because
    // `run_code` carries an `authorization: allow` would be admitting a second, unproven execution
    // authority. It keeps its own code so the missing proof stays individually identifiable.
    if (toolName === 'run_code') {
        return refuse(HOST_SURFACE_REFUSALS.ptc.code, `tool ${JSON.stringify(toolName)} is the PTC entry: ${HOST_SURFACE_REFUSALS.ptc.missing}`);
    }
    if (axis === 'process.exec') {
        // PROCESS EXECUTION AUTHORITY, NOT A PATH LANE (owner ruling, review 20261122-1536 §1).
        //
        // AdmitProcess = ToolAuthorized ∧ MemberValid ∧ SandboxReady ∧ BindingValid. The three inputs
        // are all COMPILED facts that already existed in v4; none is derived here:
        //  - `perTool[tool].authorization` is `toolBindings[].authorization` (allow/ask/deny);
        //  - `perTool[tool].execution` is `toolBindings[].execution` (boundary + implementation origin);
        //  - `binding.executors[boundary]` is the composition's readiness fact for that boundary.
        // MemberValid/BindingValid are the `binding !== undefined` check above and the trusted binding
        // the caller handed in.
        //
        // The tool's working directory is deliberately NOT consulted: a shell's cwd does not bound what
        // it can open, so it is not a permission. What the process may read/write/reach is bounded by
        // the existing three lanes plus the OS sandbox the declared executor applies - never here.
        const tool = binding.perTool?.[toolName];
        const authorization = tool?.authorization;
        const execution = tool?.execution;
        if (authorization === undefined || execution === undefined) {
            // ABSENCE IS NOT PERMISSION. No compiled tool-level authorization means the declaration
            // genuinely cannot authorize this process; admitting it would claim an authority nobody wrote.
            return refuse('ADMISSION_EXECUTION_UNAUTHORIZED', `tool ${JSON.stringify(toolName)} has no compiled tool-level execution authorization (toolBindings[].authorization + execution.executionBoundary); a process the declaration does not authorize is refused`);
        }
        if (authorization === 'deny') {
            // deny wins before any ask or any executor check: a reviewer must never be asked to approve a
            // call the declaration forbids.
            return refuse('ADMISSION_EXECUTION_DENIED', `tool ${JSON.stringify(toolName)} is denied by its compiled tool-level authorization (policy generation ${binding.policyGeneration}); the body never runs`);
        }
        const boundary = execution.executionBoundary;
        if (!EXECUTION_BOUNDARIES.includes(boundary)) {
            return refuse('ADMISSION_EXECUTION_UNAUTHORIZED', `tool ${JSON.stringify(toolName)} declares an execution boundary outside the closed v4 vocabulary (${JSON.stringify(String(boundary))}); an unreadable executor is not an authorization`);
        }
        const executor = binding.executors?.[boundary];
        if (executor !== 'ready') {
            // The declaration is authorized but this composition cannot place it in the executor it named.
            // Starting it anyway would run a process under an isolation nobody verified.
            return refuse('ADMISSION_EXECUTOR_UNAVAILABLE', `tool ${JSON.stringify(toolName)} declares executionBoundary=${JSON.stringify(boundary)}, but this composition reports the executor ${executor === 'unavailable' ? 'UNAVAILABLE' : 'UNKNOWN'}; a process with no ready executor is refused`);
        }
        if (authorization === 'ask') {
            return { kind: 'ask', reason: `process.exec on ${JSON.stringify(toolName)} requires approval under policy generation ${binding.policyGeneration} (executionBoundary=${JSON.stringify(boundary)})` };
        }
        return { kind: 'allow' };
    }
    const locator = judgedLocator(toolName, args, binding);
    const perTool = binding.perTool?.[toolName];
    if (axis === 'net.fetch') {
        // The tool-level answer is the INTERSECTION the compiler already produced; where it declares the
        // network unsupported, the call is refused even if the ceiling allows the network at all.
        const network = perTool?.network ?? binding.network;
        if (network !== 'allow') {
            return refuse('NETWORK_DENY', `${JSON.stringify(locator ?? '')} is refused: the network axis for this tool is ${network === 'deny' ? 'deny' : network === 'unsupported' ? 'unsupported by this binding' : 'unset'}, and an unset axis is not a permission`);
        }
        return { kind: 'allow' };
    }
    if (locator === undefined) {
        return refuse('ADMISSION_NO_LOCATOR', `tool ${JSON.stringify(toolName)} was called without a locator the ${axis} lane can be judged on`);
    }
    // The TOOL's compiled lane when the compiler made one, the CEILING otherwise - and "otherwise" now
    // means NO COMPILED ENTRY, not a missing field on one. A tool that HAS a compiled answer and left this
    // axis out is not a tool the ceiling may answer for: the compiler had something to say about the tool
    // and said nothing here, which is the absence of a permission, not an inheritance of the widest one.
    // (The earlier `perTool?.read ?? binding.read` read a partial answer as "no restriction".)
    if (perTool !== undefined) {
        const compiled = axis === 'fs.read' ? perTool.read : perTool.write;
        if (compiled === undefined || compiled === null) {
            return refuse('ADMISSION_AXIS_UNSUPPORTED', `${axis} is not compiled for ${JSON.stringify(toolName)}: the tool has a compiled answer that does not cover this axis, and the ceiling does not fill a gap the compiler left`);
        }
        switch (matchLocator(compiled, locator)) {
            case 'allow':
                return { kind: 'allow' };
            case 'ask':
                return { kind: 'ask', reason: `${axis} ${JSON.stringify(locator)} requires approval under policy generation ${binding.policyGeneration}` };
            case 'deny':
                return { kind: 'deny', code: 'LANE_DENY', reason: `${axis} ${JSON.stringify(locator)} is outside the tool's compiled ${axis} lane (policy generation ${binding.policyGeneration})` };
        }
    }
    const lane = axis === 'fs.read' ? binding.read : binding.write;
    switch (matchLocator(lane, locator)) {
        case 'allow':
            return { kind: 'allow' };
        case 'ask':
            return { kind: 'ask', reason: `${axis} ${JSON.stringify(locator)} requires approval under policy generation ${binding.policyGeneration}` };
        case 'deny':
            return { kind: 'deny', code: 'LANE_DENY', reason: `${axis} ${JSON.stringify(locator)} is outside the binding's ${axis} lane (policy generation ${binding.policyGeneration})` };
    }
}
/** Project the decision into the durable record. One call produces exactly one record. */
export function invocationFactsOf(input) {
    const { binding, toolName, callId, arguments: args, admission, laneDecision, overlayOutcome } = input;
    const axis = (CENTRE_TOOLS.has(toolName)
        ? 'team.control'
        : HOST_CAPABILITY_TOOLS.has(toolName)
            ? 'host.service'
            : toolName.startsWith(MCP_TOOL_PREFIX)
                ? 'net.mcp'
                : (TOOL_AXES[toolName] ?? 'fs.read'));
    // An MCP call's locator is the SERVER, not a path: recording a path nobody judged would be worse
    // than recording no locator at all.
    const locator = toolName.startsWith(MCP_TOOL_PREFIX)
        ? (mcpServerOf(toolName) ?? '')
        : (judgedLocator(toolName, args, binding) ?? '');
    // A refused call still records what was ASKED — that is the point of the record: after an
    // incident, "which locator did the model try, under which generation" must not be reconstructible
    // only from a refusal message.
    return Object.freeze({
        callId,
        agentId: binding?.agentId ?? '',
        ...(binding?.instanceId === undefined ? {} : { instanceId: binding.instanceId }),
        sessionId: binding?.sessionId ?? '',
        instanceGeneration: binding?.instanceGeneration ?? 0,
        toolName,
        axis,
        locator,
        definitionSource: binding?.definitionSource ?? '',
        policyGeneration: binding?.policyGeneration ?? '',
        blueprintRevision: binding?.blueprintRevision ?? '',
        owner: binding?.owner ?? '',
        decision: admission.kind,
        // The enforced decision is `decision`; when the centre overruled the lane (an ask nobody could
        // adjudicate), `laneDecision` keeps what the lane answered. Losing it would make "who refused"
        // unanswerable from the record.
        ...(laneDecision === undefined || laneDecision === admission.kind ? {} : { laneDecision }),
        // WHY the overlay did (not) restrict: a reader can tell an abstention outside the overlay's
        // vocabulary from a canonicalization fault without parsing the refusal prose.
        ...(overlayOutcome === undefined ? {} : { overlayOutcome }),
        ...(admission.kind === 'deny' ? { refusalCode: admission.code, reason: admission.reason } : {}),
        ...(admission.kind === 'ask' ? { reason: admission.reason } : {}),
    });
}
//# sourceMappingURL=admission.js.map