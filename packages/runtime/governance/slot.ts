/**
 * pre-alpha3 PR-A — the PURE slot kernel of the production governance
 * mutation authority (no ports, no I/O; every failure is a typed
 * {@link MutationError}).
 *
 * The kernel owns the rules the service applies BEFORE and AROUND the
 * durable commit:
 *
 * - **slot closure by authority** (ADR-04 precedence, Architecture
 *   §19.4/§19.5): leader -> team-scope `autonomy-overlay` (origin
 *   leader), member -> own instance-scope `autonomy-overlay` (origin
 *   member), operator -> `human-override` (team or instance scope, never
 *   an origin). The slot is CLOSED by the authority — a leader cannot
 *   issue an instance-scope overlay (the P7-T2 frozen scope rule; the
 *   forked remote path that admitted leader-instance-scope overlays is
 *   typed-rejected by this kernel), a member cannot issue team scope or
 *   overlay another instance (the reset hole the PR closes), and no
 *   agent authority can issue a human override (traceability,
 *   Architecture §14.3 D).
 * - **closed cell vocabulary + PolicyEntry shapes** (the frozen domain
 *   structural rules, one error surface).
 * - **write-time envelope** (agent origins; invariants 36/37) — the
 *   FROZEN P7-T2 envelope kernels reused verbatim: a member is checked
 *   against its OWN cell envelope, a leader against the intersection of
 *   every registered member's cell envelope (skipped when no member is
 *   registered — the documented P7-T2 ruling). `deny` entries always
 *   pass (tightening never escalates).
 * - **write-time external hard facts** (EVERY origin, human included —
 *   the ADR-04 absolute ceiling; the forked remote path checked NOTHING
 *   here, so this PR is the tightening that closes the hole): a grant of
 *   an absent capability, a hard-denied capability, or items beyond the
 *   hard allow-list is rejected before any durable write.
 * - **desired-state no-op**: a set whose merged slot values equal the
 *   current slot winner's values commits NOTHING (no record, no
 *   generation bump).
 * - **reset as tombstone**: a higher-generation full-slot record with an
 *   EMPTY `values` set (never a storage delete — the audit trail keeps
 *   the revocation as a fact, and the frozen slot selection then
 *   contributes nothing for the slot, which is exactly "no override").
 *
 * @module @dsh-agent-team/runtime/governance/slot
 */

import { canonicalJsonStringify } from '../../contracts/src/index.js'
import {
  CAPABILITY_NAME_VALUES,
  type CapabilityName,
  type MemberIdentity,
  type PolicyEntry,
} from '../../domain/policy/src/index.js'
import type {
  BlueprintPolicyEnvelope,
  ExternalPolicyFacts,
  TemplatePolicy,
} from '../../domain/policy/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js'
import { MUTATION_ERROR_CODES, MutationError } from '../mutation/errors.js'
import {
  checkAgainstEnvelope,
  memberEnvelopeItems,
  teamEnvelopeItems,
} from '../mutation/envelope.js'
import { checkExternalHardFacts, normalizePolicyEntry } from '../mutation/service.js'
import {
  selectSlotWinner,
  type MutationAuthority,
  type OverrideRecordView,
} from '../mutation/override-admission.js'

// ---------------------------------------------------------------------------
// Slot closure
// ---------------------------------------------------------------------------

/** One closed policy slot (the kind/scope/instance the authority can act on). */
export interface GovernanceSlot {
  /** autonomy-overlay vs human-override (closed by the authority kind). */
  readonly kind: 'autonomy-overlay' | 'human-override'
  /** Present exactly when kind is 'autonomy-overlay' (traceability). */
  readonly origin?: 'leader' | 'member'
  /** team-scope vs instance-scope (closed by the authority rules). */
  readonly scope: 'team' | 'instance'
  /** Present exactly when scope is 'instance' (the addressed member). */
  readonly instanceId?: string
}

/** Malformed-input helper (one closed error surface). */
function malformed(field: string, problem: string, extra?: Record<string, unknown>): MutationError {
  return new MutationError(
    MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
    `Malformed governance mutation: ${problem}`,
    { field, problem, ...extra },
  )
}

/** Assert a clean id: non-empty, <= 128 chars, no whitespace. */
function assertCleanId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || /\s/.test(value)) {
    throw malformed(
      field,
      `must be a non-empty whitespace-free string of at most 128 characters`,
    )
  }
  return value
}

/**
 * Close the policy slot by the acting authority (the ADR-04 / §20.3
 * authority->record mapping, with the scope rules the forked paths
 * disagreed on resolved to the FROZEN P7-T2 semantics):
 *
 * - `operator` -> `human-override`, the requested scope (team or
 *   instance; instance requires a clean target instance id);
 * - `leader`   -> `autonomy-overlay` origin leader, TEAM scope only
 *   (an instance-scope request is `UNAUTHORIZED_MUTATION` — per-instance
 *   tightening is the human override channel's, which outranks leader
 *   overlays by ADR-04 precedence anyway);
 * - `member`   -> `autonomy-overlay` origin member, INSTANCE scope
 *   targeting the member's OWN instance only (a team-scope request or a
 *   foreign instance is `UNAUTHORIZED_MUTATION` — the reset hole this
 *   PR closes).
 *
 * @throws {@link MutationError} `UNAUTHORIZED_MUTATION` (scope closed
 *   against the authority), `MALFORMED_MUTATION_INPUT` (bad id shapes).
 */
export function slotOf(
  authority: MutationAuthority,
  scope: 'team' | 'instance',
  instanceId: unknown,
): GovernanceSlot {
  if (scope !== 'team' && scope !== 'instance') {
    throw malformed('scope', `must be 'team' or 'instance'`, { scope: String(scope) })
  }
  if (authority.kind === 'operator') {
    if (scope === 'instance') {
      return {
        kind: 'human-override',
        scope: 'instance',
        instanceId: assertCleanId(instanceId, 'instanceId'),
      }
    }
    if (instanceId !== undefined) {
      throw malformed('instanceId', "team scope must not carry an instanceId")
    }
    return { kind: 'human-override', scope: 'team' }
  }
  if (authority.kind === 'leader') {
    if (scope === 'instance') {
      throw new MutationError(
        MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION,
        'leader authority issues team-scoped autonomy overlays only (per-instance tightening is the human override channel)',
        { actor: 'leader', scope },
      )
    }
    if (instanceId !== undefined) {
      throw malformed('instanceId', "team scope must not carry an instanceId")
    }
    return { kind: 'autonomy-overlay', origin: 'leader', scope: 'team' }
  }
  // member
  if (scope === 'team') {
    throw new MutationError(
      MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION,
      'member authority may only issue instance-scoped autonomy overlays',
      { actor: 'member', scope },
    )
  }
  const target = assertCleanId(instanceId, 'instanceId')
  if (target !== authority.instanceId) {
    throw new MutationError(
      MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION,
      'member authority may only target its own instance',
      { actor: 'member', instanceId: authority.instanceId, requestedInstance: target },
    )
  }
  return {
    kind: 'autonomy-overlay',
    origin: 'member',
    scope: 'instance',
    instanceId: target,
  }
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

/**
 * Validate the closed cell vocabulary + the PolicyEntry shapes (the
 * frozen domain structural rules, one error surface).
 * @param cells - the requested cell changes (non-empty).
 * @returns the validated cells (capability -> normalized entry).
 */
export function assertCells(
  cells: Record<string, unknown>,
): Record<CapabilityName, PolicyEntry> {
  if (typeof cells !== 'object' || cells === null || Array.isArray(cells)) {
    throw malformed('cells', 'cells must be a non-empty record of capability entries')
  }
  if (Object.keys(cells).length === 0) {
    throw malformed('cells', 'cells must be a non-empty record of capability entries')
  }
  const validated = {} as Record<CapabilityName, PolicyEntry>
  for (const [capability, entry] of Object.entries(cells)) {
    if (!(CAPABILITY_NAME_VALUES as readonly string[]).includes(capability)) {
      throw malformed(
        'cells',
        `unknown capability (closed vocabulary: ${CAPABILITY_NAME_VALUES.join(', ')})`,
        { capability },
      )
    }
    validated[capability as CapabilityName] = normalizePolicyEntry(entry, capability)
  }
  return validated
}

/**
 * The write-time ENVELOPE check of the agent-origin cells (invariants
 * 36/37). Reuses the FROZEN P7-T2 envelope kernels verbatim — a member is
 * checked against its own cell envelope; a leader against the
 * intersection of every registered member's cell envelope (skipped when
 * no member is registered — the documented P7-T2 ruling). `deny` cells
 * always pass (tightening never escalates).
 *
 * @throws {@link MutationError} `MEMBER_SELF_ESCALATION` /
 *   `LEADER_OUT_OF_ENVELOPE`.
 */
export function checkCellsAgainstEnvelope(
  cells: Readonly<Record<CapabilityName, PolicyEntry>>,
  teamSessionId: string,
  origin: 'leader' | 'member',
  member: MemberIdentity | undefined,
  registeredMembers: readonly MemberIdentity[],
  blueprint: BlueprintPolicyEnvelope,
  templateFor: (teamSessionId: string, member: MemberIdentity) => TemplatePolicy,
): void {
  const cellEntries = Object.entries(cells) as [CapabilityName, PolicyEntry][]
  if (origin === 'member') {
    if (member === undefined) {
      throw malformed('actor', 'member origin requires a validated member identity')
    }
    const template = templateFor(teamSessionId, member)
    const envelope = memberEnvelopeItems(teamSessionId, member, blueprint, template)
    for (const [capability, entry] of cellEntries) {
      checkAgainstEnvelope(capability, entry, envelope, 'member')
    }
    return
  }
  // leader: the team envelope (intersection of every registered member)
  const envelope = teamEnvelopeItems(teamSessionId, registeredMembers, blueprint, templateFor)
  for (const [capability, entry] of cellEntries) {
    checkAgainstEnvelope(capability, entry, envelope, 'leader')
  }
}

/**
 * The write-time EXTERNAL HARD FACTS check (EVERY origin, human
 * included — invariant 35; the absolute ceiling no Team layer can
 * bypass). Reuses the exported P7-T2 kernel cell by cell.
 *
 * @throws {@link MutationError} `EXTERNAL_HARD_REJECTED`.
 */
export function checkCellsExternalHard(
  cells: Readonly<Record<CapabilityName, PolicyEntry>>,
  teamSessionId: string,
  external: ExternalPolicyFacts,
): void {
  for (const [capability, entry] of Object.entries(cells) as [CapabilityName, PolicyEntry][]) {
    checkExternalHardFacts(teamSessionId, capability, entry, external)
  }
}

// ---------------------------------------------------------------------------
// Slot state + re-issue
// ---------------------------------------------------------------------------

/** The slot identity (merge / winner domain). */
export interface SlotIdentity {
  readonly kind: GovernanceSlot['kind']
  readonly scope: 'team' | 'instance'
  readonly rootSessionId: string
  readonly instanceId?: string
}

/** The slot identity of a closed slot + team. */
export function slotIdentityOf(slot: GovernanceSlot, rootSessionId: string): SlotIdentity {
  const root = assertCleanId(rootSessionId, 'rootSessionId')
  return {
    kind: slot.kind,
    scope: slot.scope,
    rootSessionId: root,
    ...(slot.instanceId !== undefined ? { instanceId: slot.instanceId } : {}),
  }
}

/**
 * The frozen slot winner (reused verbatim from the admission kernel):
 * highest `generation`, ties -> lexicographically smallest `recordId`.
 */
export { selectSlotWinner }

/**
 * Whether the requested cells are a NO-OP against the current slot
 * winner: the merged full-slot values (winner + cells) equal the
 * winner's values byte for byte (canonical JSON comparison — the
 * PolicyEntry shapes are closed, so canonical equality IS semantic
 * equality). No winner can never be a no-op (a set with cells always
 * changes an empty slot).
 */
export function isNoChange(
  winner: OverrideRecordView | null,
  cells: Readonly<Record<CapabilityName, PolicyEntry>>,
): boolean {
  if (winner === null) return false
  const merged: Record<string, PolicyEntry> = {
    ...(winner.values as Record<string, PolicyEntry>),
    ...cells,
  }
  return canonicalJsonStringify(merged) === canonicalJsonStringify(winner.values)
}

/**
 * Merge the winner's values with the requested cells (the full slot
 * re-issue, v1 one-record-per-slot ruling).
 */
export function mergedSlotValues(
  winner: OverrideRecordView | null,
  cells: Readonly<Record<CapabilityName, PolicyEntry>>,
): Record<string, PolicyEntry> {
  return {
    ...(winner === null ? {} : (winner.values as Record<string, PolicyEntry>)),
    ...cells,
  }
}

/**
 * The deterministic record id of one slot re-issue (the server-side
 * minting the remote contract never carries from clients): the
 * capability set (sorted, `+`-joined — a single capability keeps the
 * legacy `ovr-<cap>-...` shape), the scope target, and the CURRENT
 * winner generation (the new record lands at `generation + 1`).
 */
export function mintRecordId(
  capabilities: readonly string[],
  scope: 'team' | 'instance',
  instanceId: string | undefined,
  winnerGeneration: number,
): string {
  const caps = [...capabilities].sort().join('+')
  const target = scope === 'instance' ? instanceId : 'team'
  return `ovr-${caps}-${target}-g${winnerGeneration}`
}

/**
 * Build the storage record of one full-slot RE-ISSUE (the storage layer
 * re-validates the shape on put; identical bytes are idempotent,
 * different bytes at the same identity raise `RECORD_DUPLICATE`).
 */
export function buildReissueRecord(args: {
  readonly slot: GovernanceSlot
  readonly rootSessionId: string
  readonly recordId: string
  readonly values: Record<string, PolicyEntry>
  readonly winnerGeneration: number
  readonly updatedAt: string
}): Record<string, unknown> {
  const record: Record<string, unknown> = {
    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    kind: args.slot.kind,
    recordId: args.recordId,
    scope: args.slot.scope,
    rootSessionId: args.rootSessionId,
    values: args.values,
    generation: args.winnerGeneration + 1,
    updatedAt: args.updatedAt,
  }
  if (args.slot.instanceId !== undefined) record['instanceId'] = args.slot.instanceId
  if (args.slot.origin !== undefined) record['origin'] = args.slot.origin
  return record
}

/**
 * Build the storage record of a RESET TOMBSTONE: the same slot
 * identity (kind/origin preserved — a member tombstone stays a member
 * tombstone, an operator's stays an operator's), the EMPTY values set,
 * the winner generation + 1. The tombstone wins the slot by generation;
 * the frozen read-side selection then contributes nothing for the slot.
 */
export function buildTombstoneRecord(args: {
  readonly slot: GovernanceSlot
  readonly rootSessionId: string
  readonly recordId: string
  readonly winnerGeneration: number
  readonly updatedAt: string
}): Record<string, unknown> {
  return buildReissueRecord({
    ...args,
    values: {},
  })
}
