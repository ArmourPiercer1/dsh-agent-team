/**
 * Alpha.5 P1-09 — the ApprovedAskReceipt (R3 of owner ruling 20261124-0151 §2).
 *
 * WHAT IT IS: the ONE object a confined Provider may read to satisfy a compiled
 * `ask` disposition. It is minted by the CENTRE at the exact moment the host
 * Tool Guard consumes the one-shot Grant, bound to the execution that was
 * approved, and available ONLY inside that execution's own tool body.
 *
 * WHAT IT IS NOT: it is not a second approval authority, not a second grant,
 * not a global callId map, and not a reusable token. It mints nothing on its
 * own: the durable Control decision and the one-shot grant consumption are the
 * authority, and the receipt is their non-model-forgeable projection for the
 * Provider plane.
 *
 * LAWS (machine-checked by the R3 arms in `vnext-admission.test.mjs`):
 *  - EXECUTION-SCOPED: `mintApprovedAskReceipt` is registered against the HOST
 *    EXECUTION OBJECT (a module-private WeakMap key), never against a callId
 *    string. A different execution with the same callId finds nothing.
 *  - DELIVERED ONCE, INSIDE THE BODY: the receipt is only readable through the
 *    `AsyncLocalStorage` scope opened by the centre's `tools/execute` listener
 *    for that exact execution and closed when the body returns. A closed
 *    receipt is `RECEIPT_CLOSED` even if its object was captured.
 *  - CANONICAL OPERATION: the receipt names the Provider-resolved path and a
 *    content digest. The Provider re-resolves the real access path and refuses
 *    if the receipt does not cover THAT operation; a symlink retarget between
 *    approval and the effect is therefore a mismatch, not an alias.
 *  - BOUNDS: the receipt carries the lane snapshot it was approved under. The
 *    Provider checks the operation against BOTH the live lane and that
 *    snapshot; `deny` always wins and is checked before any receipt.
 *  - REVOCATION: the receipt carries the invocation binder's `binderEpoch` and
 *    `memberEpoch` at consumption. A later `bumpEpoch()`/`revoke(member)` makes
 *    it dead without a second revocation ledger.
 *  - NOT MODEL-FORGEABLE: the object is branded in a module-private WeakSet,
 *    frozen, and never returned to the model, the tool arguments or the durable
 *    log; a structural copy is refused (`RECEIPT_UNKNOWN`). The only writer of
 *    the scope is the centre's own port.
 *
 * THIS ROUND COVERS EXACTLY ONE OPERATION: the native `write` tool's
 * `writeText` effect. Every other method/tool keeps the R4 fail-closed
 * `IO_ASK_REQUIRES_APPROVAL` refusal; generalising is a later ruling.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/approved-ask-receipt
 */

import { createHash } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { matchLocator } from './path-rules.js'
import {
  NODE_PATH_IDENTITY_RESOLVER,
  resolveTargetIdentity,
  type PathIdentityResolver,
} from './provider-capabilities.js'
import type { PathRuleSet } from './types.js'

/** The one record schema. A reader that does not know it must fail loud. */
export const APPROVED_ASK_RECEIPT_SCHEMA = 'a5sf-approved-ask-receipt/1' as const

/**
 * Closed refusal vocabulary. NONE of these starts with `ADMISSION_`: a
 * Provider refusal happens AFTER the body started, and the execution-fact
 * classifier must settle it as the real phase (FAILED / body-started), never
 * as a pre-execution `REFUSED / not-started`.
 */
export const APPROVED_ASK_RECEIPT_REFUSAL_CODES = [
  'RECEIPT_NOT_IN_SCOPE',
  'RECEIPT_UNKNOWN',
  'RECEIPT_CLOSED',
  'RECEIPT_REUSED',
  'RECEIPT_MEMBER_MISMATCH',
  'RECEIPT_TOOL_MISMATCH',
  'RECEIPT_POLICY_GENERATION_MISMATCH',
  'RECEIPT_AUTHORITY_UNAVAILABLE',
  'RECEIPT_REVOKED',
  'RECEIPT_OPERATION_MISMATCH',
  'RECEIPT_CONTENT_MISMATCH',
  'RECEIPT_CONTENT_UNAVAILABLE',
  'RECEIPT_PATH_UNRESOLVED',
  'RECEIPT_DENIED',
  'RECEIPT_BOUNDS_VIOLATION',
  'RECEIPT_INPUT_INVALID',
] as const

export type ApprovedAskReceiptRefusalCode = (typeof APPROVED_ASK_RECEIPT_REFUSAL_CODES)[number]

/** The trusted member identity a receipt is bound to (the grant's own tuple). */
export interface ApprovedAskMemberIdentity {
  readonly teamId: string
  readonly memberInstanceId: string
  readonly templateId: string
  readonly instanceGeneration: number
}

/** The ONE operation this round can authorize: a native `write` of known bytes. */
export interface ApprovedAskOperation {
  readonly toolName: 'write'
  /** The authored locator the approval named. */
  readonly locator: string
  /** The Provider-resolved canonical path the approval covers. */
  readonly canonicalPath: string
  /** Digest of the approved bytes; the Provider re-hashes what it is about to write. */
  readonly contentSha256: string
  /** Deterministic digest of the three fields above, carried for auditability. */
  readonly fingerprint: string
}

/** The frozen projection of `(Member, Tool, operation, approval, grant)`. */
export interface ApprovedAskReceipt {
  readonly schema: typeof APPROVED_ASK_RECEIPT_SCHEMA
  readonly receiptId: string
  readonly executionId: string
  readonly callId: string
  readonly member: ApprovedAskMemberIdentity
  readonly toolName: string
  /** The compiled ToolBinding identity when the declaration carried one, else ''. */
  readonly toolBindingIdentity: string
  readonly operation: ApprovedAskOperation
  /** The policy generation the REVIEWER's decision named (== binding.policyGeneration). */
  readonly policyGeneration: string
  readonly approval: {
    readonly requestId: string
    readonly decisionId: string
    readonly caseId: string | null
    readonly legOrdinal: number | null
  }
  /**
   * The one-shot grant's consumption facts. `consumed: true` is literal: a
   * receipt is only minted after `binder.consume` returned ok.
   */
  readonly grant: {
    readonly consumed: true
    readonly memberEpoch: number
    readonly binderEpoch: number
  }
  /** The lane snapshot the receipt was approved under (the original hard bounds). */
  readonly bounds: {
    readonly read: PathRuleSet
    readonly write: PathRuleSet
  }
}

/** What the centre's approval port hands the minter (already trusted values). */
export interface MintApprovedAskReceiptInput {
  readonly executionId: string
  readonly callId: string
  readonly member: ApprovedAskMemberIdentity
  readonly toolName: string
  readonly toolBindingIdentity: string
  readonly operation: ApprovedAskOperation
  readonly policyGeneration: string
  readonly approval: ApprovedAskReceipt['approval']
  readonly grant: ApprovedAskReceipt['grant']
  readonly bounds: ApprovedAskReceipt['bounds']
}

export type MintApprovedAskReceiptResult =
  | { readonly ok: true; readonly value: ApprovedAskReceipt }
  | { readonly ok: false; readonly code: ApprovedAskReceiptRefusalCode; readonly detail: string }

/** One Provider-side authorization request, over the LIVE lane. */
export interface AuthorizeAskWithReceiptInput {
  readonly memberIdentity: string
  /** The policy revision the Provider is enforcing (`member.revision` / `policy.policyRevision`). */
  readonly policyRevision: string
  /** The compiled binding identity of the realm, when it has one (`toolBindingIdentity`). */
  readonly toolBindingIdentity?: string
  readonly lane: PathRuleSet
  readonly method: string
  readonly locator: string
  readonly access: 'read' | 'write'
  readonly content?: string
  readonly resolver?: PathIdentityResolver
  /**
   * The invocation binder's read-only epoch surface. REQUIRED: without it a
   * receipt could not be proven live, so the ask is refused (fail-closed).
   */
  readonly authority?: {
    readonly binder?: {
      currentEpoch(): number
      currentMemberEpoch(memberIdentity: string): number
    }
  }
}

export type AuthorizeAskWithReceiptResult =
  | { readonly ok: true; readonly resolved: string; readonly receipt: ApprovedAskReceipt }
  | { readonly ok: false; readonly code: ApprovedAskReceiptRefusalCode; readonly detail: string }

// ---------------------------------------------------------------------------
// Module-private state: brand, per-receipt liveness, execution-scoped delivery
// ---------------------------------------------------------------------------

interface ReceiptState {
  /** True only while the receipt's own `tools/execute` body is running. */
  available: boolean
  /** True once the body returned (or the port closed): the receipt never reopens. */
  closed: boolean
  /** True once a Provider call was authorized: the one consumed grant authorizes ONE effect. */
  used: boolean
}

const RECEIPT_BRAND = new WeakSet<object>()
const RECEIPT_STATE = new WeakMap<object, ReceiptState>()
const SCOPE_BRAND = new WeakSet<object>()

/**
 * execution object -> minted receipt. Keyed by the HOST EXECUTION OBJECT, not
 * by `callId`: a second execution carrying the same callId cannot find it, so
 * "look up an allow by callId" is structurally impossible here.
 */
const PENDING_BY_EXECUTION = new WeakMap<object, ApprovedAskReceipt>()

/** The per-execution authorization scope the Provider can read from a body. */
export interface ApprovedAskExecutionScope {
  readonly schema: typeof APPROVED_ASK_RECEIPT_SCHEMA
  readonly executionId: string
  readonly callId: string
  readonly memberIdentity: string
  readonly toolName: string
  readonly receipt: ApprovedAskReceipt
}

/**
 * A NEW carrier for AUTHORIZATION (not the guard-observability attribution
 * store, whose contract is attribution-only). It is populated only by
 * `runWithApprovedAskExecutionScope`, one `run()` per host execution.
 */
const EXECUTION_SCOPE = new AsyncLocalStorage<ApprovedAskExecutionScope>()

let receiptSequence = 0

function invalid(detail: string): MintApprovedAskReceiptResult {
  return { ok: false, code: 'RECEIPT_INPUT_INVALID', detail }
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function freezeRuleSet(rules: PathRuleSet): PathRuleSet {
  return Object.freeze({
    mode: rules.mode,
    allow: Object.freeze([...rules.allow]),
    ask: Object.freeze([...rules.ask]),
    deny: Object.freeze([...rules.deny]),
  })
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** The operation fingerprint: one deterministic digest of the approved effect. */
export function approvedAskOperationFingerprint(operation: Pick<ApprovedAskOperation, 'toolName' | 'canonicalPath' | 'contentSha256'>): string {
  return `sha256:${sha256Hex(canonicalJson({
    schema: APPROVED_ASK_RECEIPT_SCHEMA,
    toolName: operation.toolName,
    canonicalPath: operation.canonicalPath,
    contentSha256: operation.contentSha256,
  }))}`
}

/**
 * Prepare the operation a native `write` approval would cover — the ONE
 * canonicalization the receipt binds. Async because the Provider resolution is
 * async; the caller (the centre) does this BEFORE the wait so the receipt can
 * be minted synchronously at grant consumption.
 */
export async function prepareApprovedWriteOperation(input: {
  readonly locator: string
  readonly content: string
  readonly resolver?: PathIdentityResolver
}): Promise<{ readonly ok: true; readonly value: ApprovedAskOperation } | { readonly ok: false; readonly code: string; readonly detail: string }> {
  if (!isNonBlank(input.locator)) return { ok: false, code: 'IO_ASK_RECEIPT_UNPREPARABLE', detail: 'the write names no locator' }
  if (typeof input.content !== 'string') return { ok: false, code: 'IO_ASK_RECEIPT_UNPREPARABLE', detail: 'the write carries no content string' }
  const resolution = await resolveTargetIdentity({
    locator: input.locator,
    access: 'write',
    resolver: input.resolver ?? NODE_PATH_IDENTITY_RESOLVER,
  })
  if (!resolution.ok) {
    return { ok: false, code: 'IO_ASK_RECEIPT_UNPREPARABLE', detail: `${resolution.code}: ${resolution.detail}` }
  }
  const contentSha256 = `sha256:${sha256Hex(input.content)}`
  const operation: ApprovedAskOperation = Object.freeze({
    toolName: 'write' as const,
    locator: input.locator,
    canonicalPath: resolution.value.resolved,
    contentSha256,
    fingerprint: approvedAskOperationFingerprint({ toolName: 'write', canonicalPath: resolution.value.resolved, contentSha256 }),
  })
  return { ok: true, value: operation }
}

/**
 * Mint the receipt. Called by the centre AFTER `binder.consume` returned ok —
 * there is no code path that mints a receipt for an unconsumed grant.
 */
export function mintApprovedAskReceipt(input: MintApprovedAskReceiptInput): MintApprovedAskReceiptResult {
  if (!isNonBlank(input.executionId)) return invalid('a receipt needs the execution identity it belongs to')
  if (!isNonBlank(input.callId)) return invalid('a receipt needs the call identity it belongs to')
  const member = input.member
  if (member === undefined || member === null ||
      !isNonBlank(member.teamId) || !isNonBlank(member.memberInstanceId) || !isNonBlank(member.templateId) ||
      !Number.isSafeInteger(member.instanceGeneration) || member.instanceGeneration < 0) {
    return invalid('a receipt binds a complete trusted Member identity (teamId / memberInstanceId / templateId / instanceGeneration)')
  }
  if (!isNonBlank(input.toolName)) return invalid('a receipt needs the tool it authorizes')
  if (input.operation === undefined || input.operation === null || input.operation.toolName !== 'write') {
    return invalid('this round mints receipts for the native write operation only')
  }
  if (!isNonBlank(input.operation.canonicalPath) || !isNonBlank(input.operation.contentSha256)) {
    return invalid('the approved operation must carry its canonical path and content digest')
  }
  if (!isNonBlank(input.policyGeneration)) return invalid('a receipt is bound to the policy generation the reviewer approved')
  if (input.approval === undefined || input.approval === null || !isNonBlank(input.approval.requestId)) {
    return invalid('a receipt names the durable approval request that authorized it')
  }
  if (input.grant === undefined || input.grant === null || input.grant.consumed !== true) {
    return invalid('a receipt is minted only after the one-shot grant was consumed')
  }
  if (!Number.isSafeInteger(input.grant.memberEpoch) || !Number.isSafeInteger(input.grant.binderEpoch)) {
    return invalid('the grant consumption must carry the binder/member epochs it was spent under')
  }

  const receiptId = `a5sf-receipt:${++receiptSequence}`
  const receipt: ApprovedAskReceipt = Object.freeze({
    schema: APPROVED_ASK_RECEIPT_SCHEMA,
    receiptId,
    executionId: input.executionId,
    callId: input.callId,
    member: Object.freeze({
      teamId: member.teamId,
      memberInstanceId: member.memberInstanceId,
      templateId: member.templateId,
      instanceGeneration: member.instanceGeneration,
    }),
    toolName: input.toolName,
    toolBindingIdentity: input.toolBindingIdentity,
    operation: Object.freeze({ ...input.operation }),
    policyGeneration: input.policyGeneration,
    approval: Object.freeze({
      requestId: input.approval.requestId,
      decisionId: input.approval.decisionId,
      caseId: input.approval.caseId,
      legOrdinal: input.approval.legOrdinal,
    }),
    grant: Object.freeze({
      consumed: true as const,
      memberEpoch: input.grant.memberEpoch,
      binderEpoch: input.grant.binderEpoch,
    }),
    bounds: Object.freeze({
      read: freezeRuleSet(input.bounds.read),
      write: freezeRuleSet(input.bounds.write),
    }),
  })
  RECEIPT_BRAND.add(receipt)
  RECEIPT_STATE.set(receipt, { available: false, closed: false, used: false })
  return { ok: true, value: receipt }
}

/**
 * Register a minted receipt against the HOST EXECUTION OBJECT that spent the
 * grant. The `tools/execute` listener takes it back by object identity.
 */
export function registerPendingApprovedAskReceipt(execution: object, receipt: ApprovedAskReceipt): void {
  if (typeof execution !== 'object' || execution === null) throw new TypeError('approved-ask-receipt: the pending receipt is keyed by the host execution object')
  if (!RECEIPT_BRAND.has(receipt)) throw new TypeError('approved-ask-receipt: only a minted receipt can be registered')
  PENDING_BY_EXECUTION.set(execution, receipt)
}

/** Take (and forget) the receipt registered for exactly this execution object. */
export function takePendingApprovedAskReceipt(execution: object): ApprovedAskReceipt | undefined {
  if (typeof execution !== 'object' || execution === null) return undefined
  const receipt = PENDING_BY_EXECUTION.get(execution)
  if (receipt !== undefined) PENDING_BY_EXECUTION.delete(execution)
  return receipt
}

/** The receipt is no longer available to any execution, ever. Idempotent. */
export function closeApprovedAskReceipt(receipt: ApprovedAskReceipt): void {
  const state = RECEIPT_STATE.get(receipt)
  if (state === undefined) return
  state.available = false
  state.closed = true
}

/**
 * Run ONE tool body inside the receipt's authorization scope. The scope is
 * opened only here, only for the receipt's own execution object, and closed in
 * `finally` — so completion, Stop or a throw all end availability.
 */
export async function runWithApprovedAskExecutionScope<T>(receipt: ApprovedAskReceipt, run: () => Promise<T>): Promise<T> {
  const state = RECEIPT_STATE.get(receipt)
  if (state === undefined || state.closed) throw new TypeError('approved-ask-receipt: a closed or unknown receipt cannot open an execution scope')
  const scope: ApprovedAskExecutionScope = Object.freeze({
    schema: APPROVED_ASK_RECEIPT_SCHEMA,
    executionId: receipt.executionId,
    callId: receipt.callId,
    memberIdentity: receipt.member.memberInstanceId,
    toolName: receipt.toolName,
    receipt,
  })
  SCOPE_BRAND.add(scope)
  state.available = true
  try {
    return await EXECUTION_SCOPE.run(scope, run)
  } finally {
    state.available = false
    state.closed = true
  }
}

/** The receipt scope of the body this async context is inside, if any. */
export function currentApprovedAskExecutionScope(): ApprovedAskExecutionScope | undefined {
  return EXECUTION_SCOPE.getStore()
}

function refuse(code: ApprovedAskReceiptRefusalCode, detail: string): AuthorizeAskWithReceiptResult {
  return { ok: false, code, detail }
}

/**
 * The Provider-side check. It NEVER decides `allow` beyond what the receipt
 * covers: `deny` is checked first by the caller, the receipt must still be
 * live, the current lane must still ask for the target, the canonical path and
 * the content digest must match, and the operation must lie inside the lane
 * snapshot approved. A receipt that fails any clause is a refusal.
 */
export async function authorizeAskWithReceipt(input: AuthorizeAskWithReceiptInput): Promise<AuthorizeAskWithReceiptResult> {
  const scope = EXECUTION_SCOPE.getStore()
  if (scope === undefined) return refuse('RECEIPT_NOT_IN_SCOPE', 'no approved-ask execution scope is active for this Provider call; an ask is refused rather than approved by ambient state')
  if (!SCOPE_BRAND.has(scope) || !RECEIPT_BRAND.has(scope.receipt)) {
    return refuse('RECEIPT_UNKNOWN', 'the execution scope or its receipt was not minted by this module')
  }
  const receipt = scope.receipt
  const state = RECEIPT_STATE.get(receipt)
  if (state === undefined || !state.available || state.closed) {
    return refuse('RECEIPT_CLOSED', `receipt ${receipt.receiptId} is no longer available: it was closed with its execution and never reopens`)
  }
  if (state.used) {
    return refuse('RECEIPT_REUSED', `receipt ${receipt.receiptId} already authorized one Provider effect; the consumed grant authorizes exactly one`)
  }
  if (scope.executionId !== receipt.executionId || scope.callId !== receipt.callId) {
    return refuse('RECEIPT_UNKNOWN', 'the active scope does not name the execution/receipt pair it carries')
  }
  if (scope.memberIdentity !== receipt.member.memberInstanceId) {
    return refuse('RECEIPT_UNKNOWN', 'the active scope names a different Member than its receipt')
  }
  if (receipt.member.memberInstanceId !== input.memberIdentity) {
    return refuse('RECEIPT_MEMBER_MISMATCH', `receipt ${receipt.receiptId} was minted for '${receipt.member.memberInstanceId}', not '${input.memberIdentity}'`)
  }
  if (receipt.toolName !== 'write' || input.method !== 'writeText') {
    return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers the native write operation, not method '${input.method}'`)
  }
  if (input.toolBindingIdentity !== undefined && input.toolBindingIdentity !== '' &&
      receipt.toolBindingIdentity !== '' && input.toolBindingIdentity !== receipt.toolBindingIdentity) {
    return refuse('RECEIPT_TOOL_MISMATCH', `receipt ${receipt.receiptId} was minted for binding '${receipt.toolBindingIdentity}', not '${input.toolBindingIdentity}'`)
  }
  if (receipt.policyGeneration !== input.policyRevision) {
    return refuse('RECEIPT_POLICY_GENERATION_MISMATCH', `receipt ${receipt.receiptId} was approved under policy generation '${receipt.policyGeneration}', but the Provider is enforcing '${input.policyRevision}'`)
  }
  const binder = input.authority?.binder
  if (binder === undefined) {
    return refuse('RECEIPT_AUTHORITY_UNAVAILABLE', 'the Provider was not given the invocation binder, so receipt liveness (cold start / member revocation) cannot be proven')
  }
  if (binder.currentEpoch() !== receipt.grant.binderEpoch) {
    return refuse('RECEIPT_REVOKED', `receipt ${receipt.receiptId} was spent under binder epoch ${String(receipt.grant.binderEpoch)}, but the binder is at ${String(binder.currentEpoch())} (cold start)`)
  }
  if (binder.currentMemberEpoch(receipt.member.memberInstanceId) !== receipt.grant.memberEpoch) {
    return refuse('RECEIPT_REVOKED', `receipt ${receipt.receiptId} was spent under member epoch ${String(receipt.grant.memberEpoch)}, but '${receipt.member.memberInstanceId}' is at ${String(binder.currentMemberEpoch(receipt.member.memberInstanceId))} (revoked)`)
  }
  if (typeof input.content !== 'string') {
    return refuse('RECEIPT_CONTENT_UNAVAILABLE', 'the Provider call carries no content string, so the approved bytes cannot be checked')
  }
  const contentSha256 = `sha256:${sha256Hex(input.content)}`
  if (contentSha256 !== receipt.operation.contentSha256) {
    return refuse('RECEIPT_CONTENT_MISMATCH', `receipt ${receipt.receiptId} approved different bytes (${receipt.operation.contentSha256}) than the Provider is about to write (${contentSha256})`)
  }

  // DENY WINS, on the authored name and on the canonical resolution.
  if (matchLocator(input.lane, input.locator) === 'deny') {
    return refuse('RECEIPT_DENIED', `'${input.locator}' is explicitly denied by the live lane; deny wins over any receipt`)
  }
  const resolution = await resolveTargetIdentity({
    locator: input.locator,
    access: input.access,
    resolver: input.resolver ?? NODE_PATH_IDENTITY_RESOLVER,
  })
  if (!resolution.ok) {
    return refuse('RECEIPT_PATH_UNRESOLVED', `${resolution.code}: ${resolution.detail}`)
  }
  const resolved = resolution.value.resolved
  if (matchLocator(input.lane, resolved) === 'deny') {
    return refuse('RECEIPT_DENIED', `'${input.locator}' resolves to '${resolved}', which the live lane explicitly denies`)
  }
  // THE ORIGINAL HARD BOUNDS. The approval cannot be replayed onto a locator
  // the lane snapshot did not cover, even if the live lane happens to.
  if (matchLocator(receipt.bounds.write, input.locator) === 'deny' || matchLocator(receipt.bounds.write, resolved) === 'deny') {
    return refuse('RECEIPT_BOUNDS_VIOLATION', `'${resolved}' is outside the lane snapshot the approval was granted under`)
  }
  if (receipt.operation.canonicalPath !== resolved) {
    return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers '${receipt.operation.canonicalPath}', but this call resolves '${input.locator}' to '${resolved}'`)
  }
  state.used = true
  return { ok: true, resolved, receipt }
}
