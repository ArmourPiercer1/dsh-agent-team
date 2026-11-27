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
 *   work-delivery             a command that ENQUEUES work into a Member's OWN session/queue and
 *                             returns a durable delivery acknowledgement — it never runs a tool or
 *                             a model turn itself; the Member's own agent loop runs and every one
 *                             of that turn's tool calls is admitted by the centre under THAT
 *                             Member's Binding (round 83)
 *   agent-execution           a command that would dispatch a native tool, execute a shell, deliver
 *                             work to an Agent or otherwise produce agent I/O — REFUSED on a governed
 *                             row, because it has no member binding the centre could admit it on
 *
 * THE DELIVERY LAW (round 83, the boundary this file encodes). Work delivery is lawful on the
 * management plane because it is a HANDOVER, not an execution: the command writes a durable
 * admission/coordination record, places the input in the target agent's own inbox and returns the
 * acknowledgement. It must never await the target's turn (which would make the request the observer
 * of an execution it did not admit) and must never call a tool or a provider. A command that cannot
 * be expressed that way stays `agent-execution` and stays REFUSED.
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

/**
 * The effect classes, CLOSED. `agent-execution` is the only class refused on a governed row.
 * `work-delivery` (round 83) is the THIRD served class: it is served, but only as a handover into
 * the target agent's own governed path — the plane itself never executes.
 */
export const S6_COMMAND_EFFECTS = Object.freeze({
  READ: 'control-plane-read',
  CREATION: 'control-plane-creation',
  MANAGEMENT: 'control-plane-management',
  WORK_DELIVERY: 'work-delivery',
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
 *
 * `work-delivery` is the answer for the product operations the round-74 refusal kept safe but NOT
 * delivered: they ARE real operations, and the lawful way to serve them is delivery, not execution.
 * The member commands therefore hand over into the Member's own governed path (creation through the
 * ONE activation authority; `member.send` through the messaging coordinator's input acceptance;
 * `member.followup` through the work-action facade's `execution: 'async'` receipt, whose Phase B/C
 * run detached inside the Team runtime, not inside this request).
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
  // ROUND 83 — WHY THESE TWO STAY REFUSED (the delivery law, stated not implied). Neither can be
  // expressed as a delivery acknowledgement:
  //  - `team.admitInitialWork` has exactly ONE seam (`deliverRootWork` -> `deliverRootInput`) and it
  //    AWAITS the root's turn to idle before it returns. Serving it would make the management
  //    request wait on (and observe) an execution it did not admit — the async root-work enqueue
  //    that the delivery law requires does not exist. It is also ROOT-scoped, not a Member delivery.
  //  - `team.ensureRootLive` delivers NO work at all: it starts/ensures a live Agent and returns no
  //    delivery acknowledgement. It is an executor start, not a delivery, and `team.create` already
  //    starts the root through the governed creation path. Serving it from the management plane
  //    would add an executor without a delivery.
  'team.admitInitialWork': S6_COMMAND_EFFECTS.AGENT_EXECUTION,
  'team.ensureRootLive': S6_COMMAND_EFFECTS.AGENT_EXECUTION,

  // --- member management -------------------------------------------------------------------------
  // Member lifecycle touches TeamDomain/Control only (archival/termination is a control-plane act).
  'member.archive': S6_COMMAND_EFFECTS.MANAGEMENT,
  'member.restore': S6_COMMAND_EFFECTS.MANAGEMENT,
  'member.dispose': S6_COMMAND_EFFECTS.MANAGEMENT,
  // ROUND 83 — WORK DELIVERY, not execution (the member commands the round-74 refusal kept safe but
  // not delivered). Each is a handover into the Member's OWN governed path; none of them runs a tool:
  //  - `member.create`: the explicit-creation effect only (ActivationProvider — the ONE activation
  //    authority — with the same caller/envelope/compatibility gates). No work chain, no turn.
  //  - `member.send`: the P6-T3 messaging coordinator's durable intent + input ACCEPTANCE into the
  //    target Member's own session inbox + confirmation fact. The coordinator never awaits the turn
  //    and the delivery is the acknowledgement.
  //  - `member.followup`: the work-action facade with `execution: 'async'` — the durable
  //    `team-work-admitted` receipt is returned once Phase A commits, and Phase B (delivery into the
  //    Member's own child session) + Phase C (settlement) run DETACHED inside the Team runtime.
  'member.create': S6_COMMAND_EFFECTS.WORK_DELIVERY,
  'member.send': S6_COMMAND_EFFECTS.WORK_DELIVERY,
  'member.followup': S6_COMMAND_EFFECTS.WORK_DELIVERY,

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

/** The WORK-DELIVERY commands (handover into a Member's own governed path), sorted. */
export const S6_WORK_DELIVERY_COMMANDS: readonly string[] = Object.freeze(
  S6_CLASSIFIED_COMMANDS.filter(
    (method) => S6_COMMAND_EFFECT_TABLE[method] === S6_COMMAND_EFFECTS.WORK_DELIVERY,
  ),
)

/** The control-plane commands (every served class), deterministic (sorted) order. */
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
 * True ONLY for an explicitly classified command whose effect is NOT agent execution (the control
 * plane and the work-delivery handover). An unknown/unclassified command is `false` — a new command
 * cannot default to "allowed".
 *
 * @param method - the remote endpoint / method name.
 */
export function isS6ControlPlaneCommand (method: unknown): boolean {
  const effect = s6CommandEffectOf(method)
  return effect !== undefined && effect !== S6_COMMAND_EFFECTS.AGENT_EXECUTION
}

/**
 * Is this command a WORK-DELIVERY handover (served, but only through the delivery seam)?
 *
 * The dispatcher uses this to keep the two served classes distinguishable without widening the
 * refusal: a work-delivery command is served, and the handler is the delivery port — the plane never
 * has a tool-execution port to reach.
 *
 * @param method - the remote endpoint / method name.
 */
export function isS6WorkDeliveryCommand (method: unknown): boolean {
  return s6CommandEffectOf(method) === S6_COMMAND_EFFECTS.WORK_DELIVERY
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
