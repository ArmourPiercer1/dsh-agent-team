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
 * PTC (`run_code`) stays refused, for ONE measured part (round 85): nested calls re-enter this
 * pipeline on the member agent's scope, the escalation goes through ControlService with a durable ask
 * and a one-shot grant, and Stop aborts the run controller and the Node child. The WORKER's OS
 * profile is not the member's compiled one — PTC resolves its `SandboxExecutionPolicy` from the HOST
 * session (only `{mode, workspaceRoot}`), so the member's read/write ruleset cannot be carried, and
 * `danger-full-access` skips confinement. That is a `CORE_SEAM_BLOCKER`, so the call is refused
 * before the body with its own code rather than admitted on faith. See
 * `dev/agent-workflow/evidence/ute-a1/PTC-FOUR-PART-FINDING.md`.
 *
 * THE UNWIRED RULE, AS CODE. `admit` refuses when the binding is absent, when the tool has no
 * declared axis, or when the arguments carry no locator the axis can be judged on. A controlled
 * call that the centre has not been wired for is refused — never forwarded to the composition
 * provider, and never admitted on the grounds that "nothing objected".
 *
 * @module packages/runtime/src/plugin/vnext/admission
 */
import type { PathRuleSet } from '../../../member-io-policy/src/types.js';
/** The axes a tool name can be admitted on. A name outside this table is not admitted at all. */
export declare const TOOL_AXES: Readonly<{
    readonly read: "fs.read";
    readonly read_image: "fs.read";
    readonly grep: "fs.read";
    readonly glob: "fs.read";
    readonly write: "fs.write";
    readonly edit: "fs.write";
    readonly web_fetch: "net.fetch";
    readonly bash: "process.exec";
    readonly pwsh: "process.exec";
    readonly run_code: "process.exec";
}>;
export type ToolAxis = (typeof TOOL_AXES)[keyof typeof TOOL_AXES];
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
export declare const CENTRE_TOOL_NAMES: readonly string[];
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
export declare const MCP_TOOL_PREFIX = "mcp__";
/** The server segment of a mounted MCP tool name, or `undefined` when the name is malformed. */
export declare function mcpServerOf(toolName: string): string | undefined;
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
export declare const HOST_CAPABILITY_TOOL_NAMES: readonly string[];
/**
 * The v4 tool-level authorization, carried through the compiler unchanged. This is the EXECUTION
 * authority for a process-class tool, not an I/O lane.
 */
export type ToolAuthorization = 'allow' | 'ask' | 'deny';
/** The v4 execution boundaries, carried through the compiler unchanged. */
export declare const EXECUTION_BOUNDARIES: readonly ["trusted-host", "confined-subprocess", "delegated-remote"];
export type ExecutionBoundary = (typeof EXECUTION_BOUNDARIES)[number];
/** The v4 `execution` block a process tool was declared with. */
export interface CompiledExecution {
    readonly implementationOrigin: string;
    readonly executionBoundary: ExecutionBoundary;
}
/**
 * The executor states the composition can report for one Member. A boundary with no entry is
 * UNKNOWN, and unknown is never ready.
 */
export type ExecutionReadiness = Readonly<Partial<Record<ExecutionBoundary, 'ready' | 'unavailable'>>>;
export interface Binding {
    /** The runtime Agent this binding is for. The object itself is the key; never a session id. */
    readonly agentId: string;
    /**
     * The MEMBER this binding was compiled for. Separate from `agentId` because they are separate things:
     * the host knows the agent by its session, the Team knows the member by its instance id, and a record
     * that carries one value in both fields cannot answer "which member" after the session is gone.
     */
    readonly instanceId?: string;
    readonly sessionId: string;
    readonly instanceGeneration: number;
    /** The compiled lanes. Never recomputed here; `member-io-policy` produced them. */
    readonly read: PathRuleSet;
    readonly write: PathRuleSet;
    /** The member's workspace root: what an omitted search path means. */
    readonly workspaceRoot?: string;
    /** The compiled network axis. Absent is NOT allow. */
    readonly network?: 'allow' | 'deny';
    /**
     * The per-TOOL effective lanes (`EffectiveIo ⊆ AgentCeiling ∩ ToolRestriction`), keyed by the bare
     * tool name. Absent = no tool restriction was declared for that tool, and the ceiling answers.
     *
     * This is NOT a second policy: every entry is an already-compiled `EffectiveIo`, produced by the
     * ONE compiler. The centre only chooses WHICH compiled answer applies to which call.
     *
     * `authorization` / `execution` are the SAME v4 `toolBindings[]` declarations the compiler
     * projected (not a second source): they are EXECUTION authority, not I/O lanes. A process-class
     * tool is admitted on them; an fs/net tool ignores them here (their path reach stays the lanes).
     */
    readonly perTool?: Readonly<Record<string, {
        readonly read?: PathRuleSet;
        readonly write?: PathRuleSet;
        readonly network?: 'allow' | 'deny' | 'unsupported';
        /** The declared tool-level authorization (`allow` | `ask` | `deny`). Absent is NOT allow. */
        readonly authorization?: ToolAuthorization;
        /** The declared executor this tool runs on. Absent means no execution authority was declared. */
        readonly execution?: CompiledExecution;
    }>>;
    /**
     * Which declared executors this composition reports READY for this Member. Absent entry = unknown,
     * and unknown is never ready: a process the centre cannot place in a ready executor is refused.
     *
     * This is not a policy and grants nothing. It is a FACT the composition knows (does this realm own
     * a confined subprocess face? a remote executor?) that a pure decision function must be handed.
     */
    readonly executors?: ExecutionReadiness;
    /** The declared source of the definitions this binding mounted (a host package specifier). */
    readonly definitionSource: string;
    /** The policy generation the lanes were compiled under. */
    readonly policyGeneration: string;
    readonly blueprintRevision: string;
    readonly owner: string;
}
export type AdmissionRefusalCode = 'ADMISSION_NO_BINDING' | 'ADMISSION_TOOL_UNBOUND' | 'ADMISSION_NO_LOCATOR'
/** The axis is known but has no enforceable lane this round: refusing is the contract, not a TODO. */
 | 'ADMISSION_AXIS_UNSUPPORTED'
/**
 * C7 (PTC) is EXPLICITLY UNAVAILABLE and must be individually identifiable. `run_code` is the PTC
 * tool, and lumping it in with the generic subprocess refusal (`ADMISSION_AXIS_UNSUPPORTED`) made
 * "a shell could not be judged" and "the escalation authority is not the centre" one code. They are
 * two different absences: the process lane (a contract question) and the escalation row (a second
 * authority). A PTC call is refused with its own code and the same durable shapes.
 */
 | 'ADMISSION_PTC_UNAVAILABLE'
/**
 * A process-class tool the compiled answer does not authorize. The absence can be either half of
 * the execution declaration (`toolBindings[].authorization` or `execution.executionBoundary`):
 * both are required, and neither is inferred from a path, a cwd or the member's fs lanes.
 */
 | 'ADMISSION_EXECUTION_UNAUTHORIZED'
/** The declared tool-level authorization is `deny`. The body never runs. */
 | 'ADMISSION_EXECUTION_DENIED'
/**
 * The tool IS authorized, but the executor its `executionBoundary` names is not ready (for example
 * a `confined-subprocess` declaration on a composition with no OS sandbox). Starting the process
 * anyway would claim an isolation that does not exist, so it is refused typed.
 */
 | 'ADMISSION_EXECUTOR_UNAVAILABLE';
/**
 * Every code a refusal can carry. The two LANE codes are decisions about a JUDGED locator (the lane
 * said no, or the network axis said no); `AdmissionRefusalCode` covers calls that could not be judged
 * at all. Keeping one alias means `refuse()` cannot be called with a code the deny arm does not
 * accept - which is exactly the mismatch that broke the build.
 */
export type AdmissionDenialCode = 'LANE_DENY' | 'NETWORK_DENY' | AdmissionRefusalCode;
export type Admission = {
    readonly kind: 'allow';
} | {
    readonly kind: 'ask';
    readonly reason: string;
} | {
    readonly kind: 'deny';
    readonly code: AdmissionDenialCode;
    readonly reason: string;
};
/**
 * The durable record of *what was asked and under what authority*, written at admission time.
 *
 * It is keyed by `callId` and carries no execution token: the host's token is a per-execution
 * symbol and is not durable (`pipeline.ts:119,715`), so anything keyed on it would be
 * unrecoverable after a restart.
 */
export interface InvocationAuthorityFacts {
    readonly callId: string;
    readonly agentId: string;
    /** The member instance when the binding names one; absent for a binding with no member. */
    readonly instanceId?: string;
    readonly sessionId: string;
    readonly instanceGeneration: number;
    readonly toolName: string;
    readonly axis: ToolAxis | 'team.control' | 'host.service' | 'net.mcp';
    readonly locator: string;
    readonly definitionSource: string;
    readonly policyGeneration: string;
    readonly blueprintRevision: string;
    readonly owner: string;
    readonly decision: Admission['kind'];
    /** Present for a refusal or an ask; absent for a plain allow. */
    readonly refusalCode?: string;
    readonly reason?: string;
    /**
     * The durable overlay's own answer, when it was consulted (the lane allowed the call).
     * `deny` = a stored rule removed authority; `no-opinion` = the overlay imposed nothing (either no
     * rule matched or the call's face is outside the overlay's closed vocabulary — shape B, CCR
     * search-face); `fault` = canonicalization/overlay failure, which is a refusal. Absent when the
     * lane refused first and the overlay was never asked.
     */
    readonly overlayOutcome?: 'deny' | 'no-opinion' | 'fault';
}
/**
 * Decide one call. Pure: no I/O, no clock, no binding mutation. A caller that needs the decision
 * to depend on state must pass that state in.
 */
export declare function admit(input: {
    readonly binding: Binding | undefined;
    readonly toolName: string;
    readonly arguments: unknown;
}): Admission;
/** Project the decision into the durable record. One call produces exactly one record. */
export declare function invocationFactsOf(input: {
    readonly binding: Binding | undefined;
    readonly toolName: string;
    readonly callId: string;
    readonly arguments: unknown;
    readonly admission: Admission;
    /** The lane's own answer when the centre ENFORCED something else (an ask it could not adjudicate). */
    readonly laneDecision?: 'allow' | 'ask' | 'deny';
    /** The durable overlay's own answer when it was consulted; absent when the lane refused first. */
    readonly overlayOutcome?: 'deny' | 'no-opinion' | 'fault';
}): InvocationAuthorityFacts;
//# sourceMappingURL=admission.d.ts.map