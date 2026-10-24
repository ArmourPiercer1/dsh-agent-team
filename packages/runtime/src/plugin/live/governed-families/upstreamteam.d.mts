/**
 * upstreamteam.d.mts — the tsc type surface of `upstreamteam.mjs` (the same
 * `.mjs` + adjacent `.d.mts` pattern as `subagent-adapters` / `team-adapters` /
 * `schedule-adapters`: only the `.mjs` file loads at runtime, and tsc (NodeNext)
 * resolves THESE declarations for typed importers such as
 * `test/a5m2-upstreamteam-adapters.test.ts`).
 *
 * SCOPE HONESTY: the minimal surface consumed by the paired registration writer
 * and the family test. The host's own service values (the Agent identity, the
 * member model returned by `agentTeams.listMembers`) stay structurally opaque
 * here — their bytes are published by the host package's own `.d.ts` and this
 * surface deliberately does NOT restate them. Never `any`.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/upstreamteam (type surface)
 */

/** The nine frozen census names of this family (index order, no aliasing). */
export type BUpstreamTeamToolName =
  | 'interrupt_agent'
  | 'list_agents'
  | 'send_message'
  | 'spawn_teammate'
  | 'wait_agent'
  | 'team_task_create'
  | 'team_task_get'
  | 'team_task_list'
  | 'team_task_update'

/** One B-UPSTREAMTEAM record spec (frozen census recordIndex + operation). */
export interface BUpstreamTeamRecordSpec {
  readonly recordIndex: number
  readonly operation: string
}

/** Why a frozen record is still not rowed (typed gap, never a silent hole). */
export interface BUpstreamTeamNamedGap {
  readonly recordIndex: number
  readonly reason: string
}

/** The one-name-one-placement entry the paired registration writer consumes. */
export interface BUpstreamTeamPlacementEntry {
  readonly familyId: typeof A5_B_UPSTREAMTEAM_FAMILY_ID
  readonly recordIndex: number
  readonly operation: string
  readonly mountCondition: typeof A5_B_UPSTREAMTEAM_MOUNT_CONDITION
  readonly effect: string
}

/**
 * The port law of the rowed names, taken from the captured 639 body of
 * `@deepseek-ai/dsh-experimental-tool-agent-team` rather than invented. The port
 * OBJECT is injected by the paired registration writer (production: the live
 * `ctx.agentTeams`); this module implements none of it. `MemberModel` stands for
 * the host's own member model value and is deliberately opaque.
 */
export interface BUpstreamTeamPort {
  listMembers(callerAgent: string): readonly unknown[] | Promise<readonly unknown[]>
}

/**
 * The plane's OWN PA seat (`paAdmitBody`): the row hands the operation, the
 * census recordIndex and the value-side thunk to it and never decides
 * governance by itself. Both the function form and the `{ admit }` form the
 * plane mounts are accepted.
 */
export interface BUpstreamTeamPaRequest {
  readonly operation: string
  readonly recordIndex: number
  readonly run: () => readonly unknown[] | Promise<readonly unknown[]>
}

export type BUpstreamTeamPa =
  | ((request: BUpstreamTeamPaRequest) => unknown)
  | { admit: (request: BUpstreamTeamPaRequest) => unknown }

/** Input of {@link createUpstreamTeamRow}: injected port, caller, PA seat. */
export interface BUpstreamTeamRowInput {
  readonly port?: BUpstreamTeamPort
  readonly callerAgent?: string
  readonly pa?: BUpstreamTeamPa
}

/** Typed refusal codes of this family. */
export interface BUpstreamTeamCodes {
  readonly rowNotRowed: 'P_UPSTREAMTEAM_ROW_NOT_ROWED'
  readonly callerUnresolved: 'P_UPSTREAMTEAM_CALLER_UNRESOLVED'
  readonly mountNotDeclared: 'P_UPSTREAMTEAM_MOUNT_NOT_DECLARED'
  readonly paSeatMissing: 'P_UPSTREAMTEAM_PA_SEAT_MISSING'
}

/** A row that is ready to run (governance already seated) or a typed refusal. */
export type BUpstreamTeamRow =
  | { readonly ok: true; readonly entry: BUpstreamTeamPlacementEntry; invoke: () => unknown }
  | { readonly ok: false; readonly code: string; readonly name: string }

export declare const A5_B_UPSTREAMTEAM_FAMILY_ID: 'B-UPSTREAMTEAM'
export declare const A5_B_UPSTREAMTEAM_ADAPTER_REVISION: 1
export declare const A5_B_UPSTREAMTEAM_MOUNT_CONDITION: 'declared_mount'
export declare const A5_B_UPSTREAMTEAM_RECORD_SPECS: Readonly<Record<BUpstreamTeamToolName, BUpstreamTeamRecordSpec>>
export declare const A5_B_UPSTREAMTEAM_TOOL_NAMES: readonly BUpstreamTeamToolName[]
export declare const A5_B_UPSTREAMTEAM_SERVICE_METHODS: Readonly<Record<string, Readonly<{ service: string; method: string; arity: number }>>>
export declare const A5_B_UPSTREAMTEAM_EFFECT_LABELS: Readonly<Record<string, Readonly<{ effect: string; label: string }>>>
export declare const A5_B_UPSTREAMTEAM_CODES: BUpstreamTeamCodes
export declare const A5_B_UPSTREAMTEAM_NAMED_GAPS: Readonly<Record<BUpstreamTeamToolName, BUpstreamTeamNamedGap>>

/** Placement entry for a rowed name, or null (gap / unknown name). */
export declare function upstreamTeamPlacementEntry(name: string): BUpstreamTeamPlacementEntry | null

/** Build the row for one name, riding the plane's own PA funnel. */
export declare function createUpstreamTeamRow(name: string, input?: BUpstreamTeamRowInput): BUpstreamTeamRow
