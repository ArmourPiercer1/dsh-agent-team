/**
 * P6-T6 — the model-facing team tools: the closed tool set and the factory
 * that wires it over the sanctioned runtime satellite set (SD-DEPS).
 *
 * EVERY tool delegates to the Runtime (the task-card rule — the tool layer
 * holds no team state and performs no durable write of its own):
 *
 * | tool                  | delegate to                                  |
 * | --------------------- | -------------------------------------------- |
 * | team_list_members     | facade `list-members`                        |
 * | team_list_templates   | facade `list-templates`                      |
 * | team_inspect_config   | facade `inspect-config` (instance-targeted)  |
 * | team_create_member    | facade `create-member` (SD-CREATE: unguarded)|
 * | team_delegate         | facade `delegate` (guarded on the target     |
 * |                       | instance for the continue form, SD-GUARD)    |
 * | team_follow_up        | facade `follow-up` (guarded, SD-GUARD)       |
 * | team_send_message     | messaging coordinator `sendTeamMessage`      |
 * |                       | (guarded on the recipient, SD-GUARD)         |
 * | team_report_progress  | activity ledger `recordProgress`             |
 * |                       | (guarded on the instance, SD-GUARD)          |
 * | team_request_control  | control service `requestControl` (the        |
 * |                       | approval-flow entry point: unguarded,        |
 * |                       | idempotent over the scope identity)          |
 * | team_resolve_control  | control service `resolveControl` (unguarded: |
 * |                       | the service's resolver role closure is the   |
 * |                       | authority; a member is never a resolver)     |
 *
 * The guarded work operations consult the last-mile guard IMMEDIATELY
 * before execution (see guard.ts, SD-GUARD); a blocked verdict returns the
 * closed reason with zero side effects and the runtime is never called.
 * The guard's scope key is the instance-identity namespace (guardOperation
 * parses targetInstanceId): well-formed instance ids ALWAYS consult the
 * guard and its verdict is final (SD-GUARD-NS). Tokens outside that
 * namespace (labels, template ids) are the runtime's addressing domain —
 * the tool passes them through untouched and the runtime's
 * instance-addressed resolution live-rejects them
 * (TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED, G6 E2), which never executes.
 *
 * Results are lossless JSON ({@link TeamToolsResult}): typed business
 * rejections and guard blocks settle as results (the model sees them as
 * normal control flow); only unexpected errors throw (the host pipeline
 * marks them as tool errors).
 *
 * @module @dsh-agent-team/tools/tools
 */
import type { TeamToolDefinition, TeamToolsOptions } from './types.js';
/** The registered team tool set. */
export interface TeamToolSet {
    /** The ten closed tool definitions (registration order). */
    readonly tools: readonly TeamToolDefinition[];
}
/**
 * Build the model-facing team tool set over one runtime satellite wiring.
 *
 * @param options - the sanctioned runtime ports (facade, control service,
 *   messaging coordinator, activity ledger, caller resolver — SD-DEPS).
 * @returns the ten tool definitions, ready for the host's public tool
 *   registration (each returns a disposer on register; the caller owns
 *   the effect lifetime).
 */
export declare function createTeamTools(options: TeamToolsOptions): TeamToolSet;
//# sourceMappingURL=tools.d.ts.map