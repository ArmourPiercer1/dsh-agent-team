/**
 * P8-T1 projection contract: serialization discipline.
 *
 * The card's must-test "serialization": canonical, deterministic, lossless
 * JSON round-trip; unknown-field and legacy-field rejection at every level;
 * plain-record input discipline; deep-freeze of parsed values; and the
 * `create*` factory validating through the SAME pipeline as `parse*`.
 */
import { describe, expect, it } from 'vitest'
import {
  createTeamProjection,
  deserializeTeamProjection,
  parseTeamProjection,
  serializeTeamProjection,
} from '../src/index.js'
import { rawProjection } from './p8t1-projection-fixtures.js'
import { expectCode } from './helpers.js'

/** Re-insert every own key of `record` in reverse order (same values). */
function reverseKeyOrder(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(record).reverse()) out[key] = record[key]
  return out
}

describe('p8t1 projection serialization', () => {
  it('parse -> serialize -> parse round-trips losslessly', () => {
    const once = parseTeamProjection(rawProjection())
    const json = serializeTeamProjection(once)
    const twice = parseTeamProjection(JSON.parse(json))
    expect(twice).toEqual(once)
  })

  it('deserialize(serialize(dto)) returns an equal DTO', () => {
    const dto = parseTeamProjection(rawProjection())
    expect(deserializeTeamProjection(serializeTeamProjection(dto))).toEqual(dto)
  })

  it('serialization is canonical: key insertion order never changes the bytes', () => {
    const straight = serializeTeamProjection(parseTeamProjection(rawProjection()))
    const shuffled = serializeTeamProjection(parseTeamProjection(reverseKeyOrder(rawProjection())))
    expect(shuffled).toBe(straight)
  })

  it('serialization is deterministic across independent parses', () => {
    const a = serializeTeamProjection(parseTeamProjection(rawProjection()))
    const b = serializeTeamProjection(parseTeamProjection(rawProjection()))
    expect(a).toBe(b)
  })

  it('an unknown top-level field is rejected as malformed', () => {
    expectCode(() => parseTeamProjection(rawProjection({ unexpected: 1 })), 'MALFORMED_DTO')
  })

  it('a legacy memberId field is rejected with the P5-T2 reason code', () => {
    expectCode(() => parseTeamProjection(rawProjection({ memberId: 'x' })), 'LEGACY_MEMBER_ID_REJECTED')
  })

  it('non-plain containers (array, null, class instance) are rejected', () => {
    expectCode(() => parseTeamProjection([]), 'MALFORMED_DTO')
    expectCode(() => parseTeamProjection(null), 'MALFORMED_DTO')
    class NotPlainRecord {}
    expectCode(() => parseTeamProjection(new NotPlainRecord() as unknown as Record<string, unknown>), 'MALFORMED_DTO')
  })

  it('invalid JSON text is rejected with MALFORMED_DTO', () => {
    expectCode(() => deserializeTeamProjection('{"schemaVersion":'), 'MALFORMED_DTO')
  })

  it('a parsed projection is deeply frozen', () => {
    const dto = parseTeamProjection(rawProjection())
    expect(Object.isFrozen(dto)).toBe(true)
    expect(Object.isFrozen(dto.members[0]!)).toBe(true)
    expect(Object.isFrozen(dto.members[0]!.effectiveConfig.permissions)).toBe(true)
    expect(Object.isFrozen(dto.ledger.byCategory)).toBe(true)
  })

  it('the create factory validates through the same pipeline and serializes identically', () => {
    const parsed = parseTeamProjection(rawProjection())
    const input = {
      schemaVersion: parsed.schemaVersion,
      teamSessionId: parsed.teamSessionId,
      blueprint: parsed.blueprint,
      generation: parsed.generation,
      generatedAt: parsed.generatedAt,
      root: {
        teamSessionId: parsed.root.teamSessionId,
        defaultWorkspace: parsed.root.defaultWorkspace,
        createdAt: parsed.root.createdAt,
        policyState: parsed.root.policyState,
        admission: parsed.root.admission,
        compatibility: parsed.root.compatibility,
        creationBudgetConsumed: parsed.root.creationBudgetConsumed,
      },
      templates: parsed.templates.map((template) => ({
        kind: template.kind,
        templateId: template.templateId,
        displayName: template.displayName,
        contextPolicy: template.contextPolicy,
        ...(template.description !== undefined ? { description: template.description } : {}),
        ...(template.instanceQuota !== undefined ? { instanceQuota: template.instanceQuota } : {}),
      })),
      members: parsed.members.map((member) => ({
        instanceId: member.instanceId,
        templateId: member.templateId,
        label: member.label,
        workspace: member.workspace,
        createdAt: member.createdAt,
        lifecycle: member.lifecycle,
        contextPolicy: member.contextPolicy,
        effectiveConfig: member.effectiveConfig,
        liveActivity: member.liveActivity,
        ...(member.groupId !== undefined ? { groupId: member.groupId } : {}),
        ...(member.childSessionId !== undefined ? { childSessionId: member.childSessionId } : {}),
        ...(member.activity !== undefined ? { activity: member.activity } : {}),
      })),
      ledger: {
        latestSequence: parsed.ledger.latestSequence,
        totalEntries: parsed.ledger.totalEntries,
        byCategory: parsed.ledger.byCategory,
        pendingControlCount: parsed.ledger.pendingControlCount,
      },
    }
    const created = createTeamProjection(input)
    expect(serializeTeamProjection(created)).toBe(serializeTeamProjection(parsed))
  })

  it('the create factory still rejects a corrupt input (shared pipeline)', () => {
    const parsed = parseTeamProjection(rawProjection())
    const input = {
      schemaVersion: parsed.schemaVersion,
      teamSessionId: parsed.teamSessionId,
      blueprint: parsed.blueprint,
      generation: parsed.generation,
      generatedAt: parsed.generatedAt,
      root: {
        teamSessionId: parsed.root.teamSessionId,
        createdAt: parsed.root.createdAt,
        policyState: parsed.root.policyState,
        admission: parsed.root.admission,
        compatibility: parsed.root.compatibility,
        creationBudgetConsumed: parsed.root.creationBudgetConsumed,
      },
      templates: [],
      members: [],
      ledger: parsed.ledger,
    }
    expectCode(() => createTeamProjection(input), 'MALFORMED_DTO')
  })
})
