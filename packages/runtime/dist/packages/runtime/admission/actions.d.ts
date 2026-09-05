/**
 * P6-T2 — the closed TeamRuntime action vocabulary.
 *
 * The registry maps every runtime/control action to (a) its category, (b)
 * the mutation operation(s) of the caller's mutation envelope it requires
 * (reads carry no op — they are not mutations and are open to every LIVE
 * caller; documented ruling), and (c) its durable effect.
 *
 * Action vocabulary basis: Development Plan §19.6 first-round tool contract
 * ("authority must go through the Runtime uniformly"): list_team_members /
 * list_team_templates, create/delegate instance, follow_up_instance,
 * send_team_message, report_progress, request_control, resolve_control,
 * archive/restore/dispose where authorized, inspect effective config.
 *
 * The MUTATION OPERATION vocabulary (the envelope op names) is closed for
 * P6-T2: `assign-task`, `create-member`, `send-message`, `report-progress`,
 * `request-control`, `resolve-control`, `archive-member`, `restore-member`,
 * `dispose-member`. Blueprint envelopes allow/deny EXACTLY these op names.
 *
 * Addressing: instance-first everywhere (invariant 18/19). The two
 * delegation fields of the request are the ActivationProvider's own
 * addressing protocol (DevPlan §24.1 M1-M5) for the creation actions —
 * not a second action-addressing vocabulary.
 *
 * Durable fact families (kebab-case, no slashes — p4t6 scanner safe):
 * - `team-work-admitted`        (follow-up / delegate-continue)
 * - `member-lifecycle-changed`  (archive / restore / dispose)
 * - `team-coordination-recorded`(send-message / report-progress /
 *                               request-control / resolve-control)
 * Provider-routed creations carry their OWN provider ledger facts.
 */
import type { CallerRole, TeamRuntimeActionRequest } from './types.js';
/** The closed action names. */
export declare const ACTION_NAMES: {
    /** List the team's member instances (read, team-scoped). */
    readonly LIST_MEMBERS: "list-members";
    /** List the bound blueprint's member templates (read, team-scoped). */
    readonly LIST_TEMPLATES: "list-templates";
    /** Inspect one instance's effective capability policy (read). */
    readonly INSPECT_CONFIG: "inspect-config";
    /** Admit NEW WORK on an existing instance; the SAME child session is
     *  kept (invariant 24); CREATED/SETTLED targets transition to RUNNING
     *  (invariant 55). */
    readonly FOLLOW_UP: "follow-up";
    /** Delegate work (leader only): the provider resolves M1-M5 — continue
     *  an active instance (fresh_per_delegation templates and no-active
     *  instances create a NEW one, invariant 25) or create through the
     *  ActivationProvider (invariant 26). Requires BOTH `assign-task` and
     *  `create-member` envelope ops (a delegation MAY create — fail closed). */
    readonly DELEGATE: "delegate";
    /** Explicit member creation (leader `leader-explicit` or human
     *  `human-ui` source; template-level delegation naming REQUIRED). */
    readonly CREATE_MEMBER: "create-member";
    /** Send a team message to a member instance (coordination fact). */
    readonly SEND_MESSAGE: "send-message";
    /** Report progress on the target instance (coordination fact). */
    readonly REPORT_PROGRESS: "report-progress";
    /** Request a control decision on the target instance (coordination fact). */
    readonly REQUEST_CONTROL: "request-control";
    /** Resolve a control request on the target instance (coordination fact). */
    readonly RESOLVE_CONTROL: "resolve-control";
    /** Archive the target member (lifecycle ARCHIVED; closes admission and
     *  quiesces, invariant 52). */
    readonly ARCHIVE_MEMBER: "archive-member";
    /** Restore the target member ARCHIVED -> SETTLED (invariant 53; no Agent
     *  resume). */
    readonly RESTORE_MEMBER: "restore-member";
    /** Dispose the target member (lifecycle DISPOSED; terminal). */
    readonly DISPOSE_MEMBER: "dispose-member";
};
/** One of the closed action names. */
export type ActionName = (typeof ACTION_NAMES)[keyof typeof ACTION_NAMES];
/** Every action name value, for membership checks. */
export declare const ACTION_NAME_VALUES: readonly string[];
/** The closed action categories. */
export declare const ACTION_CATEGORIES: {
    /** No mutation: open to every live caller (no envelope op). */
    readonly READ: "read";
    /** New work on an existing instance (the compatibility gate applies). */
    readonly WORK: "work";
    /** New instance creation (routed through the ActivationProvider). */
    readonly CREATION: "creation";
    /** Team coordination (message / control / progress facts). */
    readonly COORDINATION: "coordination";
    /** Member lifecycle operations. */
    readonly LIFECYCLE: "lifecycle";
};
/** One of the closed action categories. */
export type ActionCategory = (typeof ACTION_CATEGORIES)[keyof typeof ACTION_CATEGORIES];
/** The closed mutation-operation vocabulary (envelope op names). */
export declare const RUNTIME_OPS: {
    readonly ASSIGN_TASK: "assign-task";
    readonly CREATE_MEMBER: "create-member";
    readonly SEND_MESSAGE: "send-message";
    readonly REPORT_PROGRESS: "report-progress";
    readonly REQUEST_CONTROL: "request-control";
    readonly RESOLVE_CONTROL: "resolve-control";
    readonly ARCHIVE_MEMBER: "archive-member";
    readonly RESTORE_MEMBER: "restore-member";
    readonly DISPOSE_MEMBER: "dispose-member";
};
/** One of the closed runtime mutation operations. */
export type RuntimeOp = (typeof RUNTIME_OPS)[keyof typeof RUNTIME_OPS];
/** The closed coordination payload discriminators. */
export declare const PROGRESS_VALUES: readonly ["in-progress", "completed", "blocked"];
export type ProgressValue = (typeof PROGRESS_VALUES)[number];
export declare const CONTROL_DECISION_VALUES: readonly ["approved", "denied"];
export type ControlDecision = (typeof CONTROL_DECISION_VALUES)[number];
/** One action's admission contract (the closed registry entry). */
export interface ActionSpec {
    /** The action name. */
    readonly name: ActionName;
    /** The action category (gates the compatibility/work state checks). */
    readonly category: ActionCategory;
    /**
     * The mutation operations the caller's envelope must ALL allow
     * (fail closed). ABSENT for reads (open to every live caller).
     */
    readonly ops?: readonly RuntimeOp[];
    /** Instance-targeted: `targetInstanceId` is REQUIRED and must resolve to
     *  an existing member record. */
    readonly instanceTargeted: boolean;
    /**
     * The closed caller roles allowed to act (ABSENT = every live caller role
     * may act, subject to the envelope). A MEMBER caller is never in a
     * creation/delegation role set (invariant 37: no self-escalation).
     */
    readonly roles?: readonly CallerRole[];
    /** Routed through the ActivationProvider (the sole creation path). */
    readonly creates?: boolean;
    /** The durable fact family of the effect (absent for reads and for the
     *  provider-routed creation results — the provider owns those facts). */
    readonly factType?: string;
}
/** The closed action registry (deterministic iteration order). */
export declare const ACTION_SPECS: readonly ActionSpec[];
/** The action spec by name (undefined for names outside the closed set). */
export declare function actionSpecOf(name: string): ActionSpec | undefined;
/**
 * Step 0 — request validation (closed vocabulary + per-action shape).
 *
 * Pure: no repository access. Throws {@link TeamRuntimeError} with
 * REQUEST_MALFORMED or ACTION_UNKNOWN. Zero durable side effects by
 * construction.
 *
 * @param request - the raw action request.
 * @returns the resolved action spec (name guaranteed closed).
 */
export declare function validateActionRequest(request: TeamRuntimeActionRequest): ActionSpec;
//# sourceMappingURL=actions.d.ts.map