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
export const S6_COMMAND_EFFECTS = Object.freeze({
  READ: 'control-plane-read',
  CREATION: 'control-plane-creation',
  MANAGEMENT: 'control-plane-management',
  AGENT_EXECUTION: 'agent-execution',
} as const)

/** One effect class. */
export type S6CommandEffect = (typeof S6_COMMAND_EFFECTS)[keyof typeof S6_COMMAND_EFFECTS]

/** Every effect class, in declaration order. */
export const S6_COMMAND_EFFECT_VALUES: readonly S6CommandEffect[] = Object.freeze(
  Object.values(S6_COMMAND_EFFECTS),
)

/**
 * The classification table. Key = the frozen remote endpoint (dotted method name).
 *
 * `agent-execution` is NOT a judgement about importance — it is the exact boundary the owner ruling
 * draws: a command that would dispatch a native tool / execute a shell / produce agent I/O cannot be
 * served from a principal-authorized management surface, because it has no member Binding for UTE to
 * admit and would therefore be a second execution authority. Those commands keep failing closed until
 * they are re-entered through the governed agent path.
 */
export const S6_COMMAND_EFFECT_TABLE: Readonly<Record<string, S6CommandEffect>> = Object.freeze({
  // --- catalog / discovery reads (no execution) -------------------------------------------------
  'catalog.list': S6_COMMAND_EFFECTS.READ,
  'catalog.get': S6_COMMAND_EFFECTS.READ,
  'intent.probe': S6_COMMAND_EFFECTS.READ,

  // --- team creation: the ONE governed creation entrance (TeamDomain + principal + start gates) ---
  'team.create': S6_COMMAND_EFFECTS.CREATION,
  'handoff.create': S6_COMMAND_EFFECTS.CREATION,

  // --- team reads --------------------------------------------------------------------------------
  'team.getProjection': S6_COMMAND_EFFECTS.READ,
  'team.getLedgerPage': S6_COMMAND_EFFECTS.READ,
  'team.listRoots': S6_COMMAND_EFFECTS.READ,
  'team.getReadState': S6_COMMAND_EFFECTS.READ,
  'team.listCorruptControlLegs': S6_COMMAND_EFFECTS.READ,

  // --- team lifecycle / control ------------------------------------------------------------------
  'team.resolveControl': S6_COMMAND_EFFECTS.MANAGEMENT,
  'team.prepareOrdinaryOpen': S6_COMMAND_EFFECTS.MANAGEMENT,
  // A command that delivers work to the ROOT AGENT (a model turn) or starts/ensures a live Agent is
  // agent I/O: it must go through the governed agent path, never through this surface.
  'team.admitInitialWork': S6_COMMAND_EFFECTS.AGENT_EXECUTION,
  'team.ensureRootLive': S6_COMMAND_EFFECTS.AGENT_EXECUTION,

  // --- member management -------------------------------------------------------------------------
  // Member lifecycle touches TeamDomain/Control only (archival/termination is a control-plane act).
  'member.archive': S6_COMMAND_EFFECTS.MANAGEMENT,
  'member.restore': S6_COMMAND_EFFECTS.MANAGEMENT,
  'member.dispose': S6_COMMAND_EFFECTS.MANAGEMENT,
  // These three run the TeamRuntime action facade / deliver live input to a Member Agent: agent I/O.
  'member.create': S6_COMMAND_EFFECTS.AGENT_EXECUTION,
  'member.send': S6_COMMAND_EFFECTS.AGENT_EXECUTION,
  'member.followup': S6_COMMAND_EFFECTS.AGENT_EXECUTION,

  // --- governance / policy / permission ----------------------------------------------------------
  'override.get': S6_COMMAND_EFFECTS.READ,
  'override.set': S6_COMMAND_EFFECTS.MANAGEMENT,
  'override.reset': S6_COMMAND_EFFECTS.MANAGEMENT,
  'override.mutatePermission': S6_COMMAND_EFFECTS.MANAGEMENT,
  'override.getPermission': S6_COMMAND_EFFECTS.READ,
  'override.getPermissionAdministration': S6_COMMAND_EFFECTS.READ,
  'policyState.get': S6_COMMAND_EFFECTS.READ,
  'policyState.set': S6_COMMAND_EFFECTS.MANAGEMENT,

  // --- compatibility (durable environment state; no agent execution) -----------------------------
  'compatibility.get': S6_COMMAND_EFFECTS.READ,
  'compatibility.ack': S6_COMMAND_EFFECTS.MANAGEMENT,
  'compatibility.reprobe': S6_COMMAND_EFFECTS.MANAGEMENT,

  // --- handoff / legacy / intervention -----------------------------------------------------------
  'handoff.prepare': S6_COMMAND_EFFECTS.READ,
  'legacy.inspect': S6_COMMAND_EFFECTS.READ,
  'intervention.list': S6_COMMAND_EFFECTS.READ,
  'intervention.get': S6_COMMAND_EFFECTS.READ,
  'intervention.act': S6_COMMAND_EFFECTS.MANAGEMENT,
})

/** Every classified method, deterministic (sorted) order. */
export const S6_CLASSIFIED_COMMANDS: readonly string[] = Object.freeze(
  Object.keys(S6_COMMAND_EFFECT_TABLE).sort(),
)

/** The commands REFUSED on a governed row (agent execution), deterministic (sorted) order. */
export const S6_AGENT_EXECUTION_COMMANDS: readonly string[] = Object.freeze(
  S6_CLASSIFIED_COMMANDS.filter(
    (method) => S6_COMMAND_EFFECT_TABLE[method] === S6_COMMAND_EFFECTS.AGENT_EXECUTION,
  ),
)

/** The control-plane commands (every non-refused class), deterministic (sorted) order. */
export const S6_CONTROL_PLANE_COMMANDS: readonly string[] = Object.freeze(
  S6_CLASSIFIED_COMMANDS.filter(
    (method) => S6_COMMAND_EFFECT_TABLE[method] !== S6_COMMAND_EFFECTS.AGENT_EXECUTION,
  ),
)

/**
 * The effect class of one command, or `undefined` when the command is NOT in the closed table.
 * `undefined` is the fail-closed answer: an unclassified command is never served by a governed row.
 *
 * @param method - the remote endpoint / method name.
 */
export function s6CommandEffectOf (method: unknown): S6CommandEffect | undefined {
  if (typeof method !== 'string') return undefined
  return Object.prototype.hasOwnProperty.call(S6_COMMAND_EFFECT_TABLE, method)
    ? S6_COMMAND_EFFECT_TABLE[method]
    : undefined
}

/**
 * May a governed (centre-configured) row serve this command?
 *
 * True ONLY for an explicitly classified control-plane command. An unknown/unclassified command is
 * `false` — a new command cannot default to "allowed".
 *
 * @param method - the remote endpoint / method name.
 */
export function isS6ControlPlaneCommand (method: unknown): boolean {
  const effect = s6CommandEffectOf(method)
  return effect !== undefined && effect !== S6_COMMAND_EFFECTS.AGENT_EXECUTION
}

/**
 * Every catalog method that this table does NOT classify, in the caller's order (deduplicated).
 * Used by the pin test to keep the table and the frozen catalog in lockstep.
 *
 * @param methods - the catalog method names.
 */
export function unclassifiedS6Commands (methods: readonly string[]): readonly string[] {
  const missing: string[] = []
  for (const method of methods) {
    if (s6CommandEffectOf(method) === undefined && !missing.includes(method)) missing.push(method)
  }
  return Object.freeze(missing)
}
