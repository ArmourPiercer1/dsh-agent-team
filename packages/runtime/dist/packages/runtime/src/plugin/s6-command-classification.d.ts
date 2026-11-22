/**
 * s6-command-classification.ts — the ONE closed classification of every S6 Remote
 * command by its ACTUAL EFFECT (round 74, owner ruling `docs/reviews/20261122-1536.txt` §3).
 *
 * WHY THIS FILE EXISTS. Round 55 refused the whole S6 command plane on a centre-configured row
 * because the dispatcher is authorized by a server-derived principal, not by a member binding, so the
 * compiled member ceiling could not speak for it. That was the wrong unit of refusal: the S6 plane is
 * the product's MANAGEMENT entrance (the only runtime `team.create` entrance), and the ruling restored
 * it as a governed control plane while keeping the A1 law intact — an S6 command must never become a
 * second agent-tool execution authority. The unit of judgement is therefore the COMMAND, not the
 * surface:
 *
 *   control-plane-read        a read of the durable TeamDomain/Control/catalog state (no execution)
 *   control-plane-creation    Team creation through the ONE create-and-start primitive
 *   control-plane-management  lifecycle / governance / control / compatibility mutations
 *   agent-execution           a command that would dispatch a native tool, execute a shell, deliver
 *                             work to an Agent or otherwise produce agent I/O — REFUSED on a governed
 *                             row, because it has no member binding the centre could admit it on
 *
 * THE AUTHORITY TABLE (do not collapse it):
 *
 *   TeamDomain / ControlService   who may create, manage, approve, terminate Team/Member
 *   Blueprint / Member Policy     identity, tool-execution authorization, resource ceilings
 *   UTE Admission                 ONLY whether THIS agent's THIS tool call may run
 *   Provider / OS Sandbox         whether the effect stays inside the granted bounds
 *   Settlement                    what actually happened, with evidence
 *
 * Team creation is a TeamDomain/principal question (answered by `s6-principal.ts` and the existing
 * `root.ts#createAndStartTeam()` path). It is NOT an admission axis, and this file adds none.
 *
 * CLOSED IN BOTH DIRECTIONS. Every method of the frozen `REMOTE_METHOD_CATALOG` must appear here (the
 * pin test asserts set equality, so a catalog addition cannot be forgotten), and an UNKNOWN method has
 * NO classification — `isS6ControlPlaneCommand()` answers `false` for it, so a new command can never
 * default to allowed. Adding a command is a deliberate act in this one table.
 *
 * @module packages/runtime/src/plugin/s6-command-classification
 */
/** The effect classes, CLOSED. `agent-execution` is the only class refused on a governed row. */
export declare const S6_COMMAND_EFFECTS: Readonly<{
    readonly READ: "control-plane-read";
    readonly CREATION: "control-plane-creation";
    readonly MANAGEMENT: "control-plane-management";
    readonly AGENT_EXECUTION: "agent-execution";
}>;
/** One effect class. */
export type S6CommandEffect = (typeof S6_COMMAND_EFFECTS)[keyof typeof S6_COMMAND_EFFECTS];
/** Every effect class, in declaration order. */
export declare const S6_COMMAND_EFFECT_VALUES: readonly S6CommandEffect[];
/**
 * The classification table. Key = the frozen remote endpoint (dotted method name).
 *
 * `agent-execution` is NOT a judgement about importance — it is the exact boundary the owner ruling
 * draws: a command that would dispatch a native tool / execute a shell / produce agent I/O cannot be
 * served from a principal-authorized management surface, because it has no member Binding for UTE to
 * admit and would therefore be a second execution authority. Those commands keep failing closed until
 * they are re-entered through the governed agent path.
 */
export declare const S6_COMMAND_EFFECT_TABLE: Readonly<Record<string, S6CommandEffect>>;
/** Every classified method, deterministic (sorted) order. */
export declare const S6_CLASSIFIED_COMMANDS: readonly string[];
/** The commands REFUSED on a governed row (agent execution), deterministic (sorted) order. */
export declare const S6_AGENT_EXECUTION_COMMANDS: readonly string[];
/** The control-plane commands (every non-refused class), deterministic (sorted) order. */
export declare const S6_CONTROL_PLANE_COMMANDS: readonly string[];
/**
 * The effect class of one command, or `undefined` when the command is NOT in the closed table.
 * `undefined` is the fail-closed answer: an unclassified command is never served by a governed row.
 *
 * @param method - the remote endpoint / method name.
 */
export declare function s6CommandEffectOf(method: unknown): S6CommandEffect | undefined;
/**
 * May a governed (centre-configured) row serve this command?
 *
 * True ONLY for an explicitly classified control-plane command. An unknown/unclassified command is
 * `false` — a new command cannot default to "allowed".
 *
 * @param method - the remote endpoint / method name.
 */
export declare function isS6ControlPlaneCommand(method: unknown): boolean;
/**
 * Every catalog method that this table does NOT classify, in the caller's order (deduplicated).
 * Used by the pin test to keep the table and the frozen catalog in lockstep.
 *
 * @param methods - the catalog method names.
 */
export declare function unclassifiedS6Commands(methods: readonly string[]): readonly string[];
//# sourceMappingURL=s6-command-classification.d.ts.map