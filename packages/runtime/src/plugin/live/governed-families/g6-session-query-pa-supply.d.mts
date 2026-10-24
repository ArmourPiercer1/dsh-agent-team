/**
 * g6-session-query-pa-supply.d.mts — STRUCTURAL SUBSET declaration for the
 * A5M2-G6 Card B supply block. Honesty law: this is the block's OWN shape,
 * written from the released bytes — NOT a Host-verified full type proof. The
 * plane consumes the produced value through its untyped inject gate
 * (team-tool-plane.mjs:1139-1157); nothing here claims more than the bytes
 * implement.
 */

/** Closed refusal codes of the supply block (governance plane, P_G6_*). */
export interface G6PaSupplyCodes {
  readonly INPUT_INVALID: 'P_G6_SUPPLY_INPUT_INVALID'
  readonly MOUNT_ABSENT: 'P_G6_SUPPLY_MOUNT_ABSENT'
  readonly MOUNT_IDENTITY_MISMATCH: 'P_G6_SUPPLY_MOUNT_IDENTITY_MISMATCH'
}

export declare const A5_G6_PA_SUPPLY_CODES: G6PaSupplyCodes
export declare const A5_G6_PA_SUPPLY_REVISION: number
export declare const A5_G6_PA_SUPPLY_FAMILY: 'B-SESSION-QUERY'

/** The frozen supply block the plane reads as `planeCfg.sessionQuery` /
 *  `backends.sessionQuery` (readNative is NOT here: the member-scoped
 *  capture is agent-bindings' own law, agent-bindings.mjs:3208-3260).
 *  maxSearchResults obeys the presence-omission law: absent cap = key
 *  ABSENT, never a present-and-undefined member. */
export interface G6SessionQuerySupply {
  readonly providerId: string
  readonly queryPorts: Record<string, unknown>
  readonly readCaller: (...args: never[]) => unknown
  readonly teamCeiling: (...args: never[]) => unknown
  readonly declaredMount: Record<string, unknown>
  readonly maxSearchResults?: number
}

export interface G6PaSupplyOk {
  readonly ok: true
  readonly value: G6SessionQuerySupply
}

export interface G6PaSupplyRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

export declare function assembleG6SessionQuerySupply(
  input?: Record<string, unknown>,
): G6PaSupplyOk | G6PaSupplyRefusal
