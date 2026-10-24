/**
 * A5M2 G1 PROFILE CARD (root 14:1x, the one finite producer fix).
 *
 * THE FACT (source-pinned below to the shipped bytes): the activation flow
 * creates the child Agent+Session BEFORE committing the MemberInstance row
 * (DevPlan 19.2 journal order; child factory at agent-bindings :10010 —
 * "the child artifact is durable before the member record"). A FRESH-member
 * mount therefore legitimately sees no roster row, and the old arm — which
 * read ONLY the durable roster — refused every governed member activation
 * (proved live in the f923 window: create-member returned the lossless
 * `status:rejected` whose message ends "...profileId has no real producer").
 *
 * THE CARD: reuse ONLY the setup's ALREADY-VERIFIED `boundTemplate` (from
 * resolveConsumptionViews → locateTemplate: the fresh-member hint bridges
 * ONLY when the row is absent AND the id re-resolves inside the CURRENT
 * owning-root bound blueprint — a miss throws there) and ONLY for the
 * fresh-member window with the row truly absent. The durable row keeps
 * precedence; a present row answering no templateId, or conflicting with
 * the bound template, REFUSES; a cold mount missing its row still REFUSES
 * (P0-1 §3.4). No raw `?? templateIdHint` anywhere, no fake profile, no
 * early durable row, no parallel identity account, no Core change.
 *
 * HONEST TIERS (disclosed): the branch BEHAVIOUR runs in a declared mirror
 * of the patched arm block (driving the real agentSetup end-to-end would
 * need the whole runtime — explicitly out of this card's scope); the
 * source-pair legs bind every mirror claim to the SHIPPED bytes.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(resolve(here, '../src/plugin/live/agent-bindings.mjs'), 'utf8')

/** Mirror of the patched arm block — verbatim shape, closure state injected. */
interface RosterRow { instanceId?: string, templateId?: string }
interface ArmProfileInput {
  rosterRows: readonly RosterRow[]
  instanceId: string
  bindPath: string
  boundTemplate: { templateId?: string } | null | undefined
}
function armProfile({ rosterRows, instanceId, bindPath, boundTemplate }: ArmProfileInput): string {
  const g1RosterRow = rosterRows.find((row: RosterRow) => String(row?.instanceId ?? '') === String(instanceId))
  const g1RowProfileId = typeof g1RosterRow?.templateId === 'string' && g1RosterRow.templateId.length > 0
    ? String(g1RosterRow.templateId)
    : null
  const g1BoundProfileId = typeof boundTemplate?.templateId === 'string' && boundTemplate.templateId.length > 0
    ? String(boundTemplate.templateId)
    : null
  let g1ProfileId = null
  if (g1RosterRow !== undefined) {
    if (g1RowProfileId !== null && (g1BoundProfileId === null || g1BoundProfileId === g1RowProfileId)) {
      g1ProfileId = g1RowProfileId
    } else {
      throw Object.assign(new Error('row answers no templateId or conflicts with the bound blueprint template'), { code: 'alpha5-g1-arm-mount-refused' })
    }
  } else if (bindPath === 'fresh-member' && g1BoundProfileId !== null) {
    g1ProfileId = g1BoundProfileId
  }
  if (g1ProfileId === null) {
    throw Object.assign(new Error('the trusted TARGETS profileId has no real producer'), { code: 'alpha5-g1-arm-mount-refused' })
  }
  return g1ProfileId
}

describe('A5M2 G1 profile card — fresh-member window rides the VERIFIED boundTemplate, never a raw hint', () => {
  it('fresh-member with NO row: the verified boundTemplate.templateId is the profileId', () => {
    expect(armProfile({ rosterRows: [], instanceId: 'inst-m1', bindPath: 'fresh-member', boundTemplate: { templateId: 'ctl-worker' } }))
      .toBe('ctl-worker')
  })

  it('cold-member with NO row still REFUSES (P0-1 §3.4 — the hint is not an authorization fallback)', () => {
    expect(() => armProfile({ rosterRows: [], instanceId: 'inst-m1', bindPath: 'cold-member', boundTemplate: { templateId: 'ctl-worker' } }))
      .toThrow(/has no real producer/)
  })

  it('the durable row keeps PRECEDENCE (equal bound template: row value wins untouched)', () => {
    expect(armProfile({
      rosterRows: [{ instanceId: 'inst-m1', templateId: 'ctl-worker' }],
      instanceId: 'inst-m1',
      bindPath: 'fresh-member',
      boundTemplate: { templateId: 'ctl-worker' },
    })).toBe('ctl-worker')
  })

  it('a PRESENT row answering NO templateId REFUSES (even fresh-member — no substitution)', () => {
    expect(() => armProfile({
      rosterRows: [{ instanceId: 'inst-m1' }],
      instanceId: 'inst-m1',
      bindPath: 'fresh-member',
      boundTemplate: { templateId: 'ctl-worker' },
    })).toThrow(/no templateId or conflicts/)
  })

  it('a row CONFLICTING with the bound blueprint template REFUSES (tripwire — never picks a side)', () => {
    expect(() => armProfile({
      rosterRows: [{ instanceId: 'inst-m1', templateId: 'ctl-worker' }],
      instanceId: 'inst-m1',
      bindPath: 'fresh-member',
      boundTemplate: { templateId: 'other-template' },
    })).toThrow(/no templateId or conflicts/)
  })

  it('SOURCE-PAIR: the shipped arm block carries exactly the card shape', () => {
    const at = SRC.indexOf('const g1RosterRow = domain.repositories.memberInstances.list')
    expect(at).toBeGreaterThan(-1)
    const block = SRC.slice(at, SRC.indexOf('const g1Trusted = Object.freeze', at))
    // row branch FIRST; boundTemplate reuse ONLY under fresh-member + row absent
    expect(block.indexOf('if (g1RosterRow !== undefined)')).toBeLessThan(block.indexOf("bindPath === 'fresh-member' && g1BoundProfileId !== null"))
    // the ONLY reused fact is the setup's already-verified boundTemplate —
    // the raw hint must NOT be read inside the arm at all
    expect(block).toContain('boundTemplate?.templateId')
    expect(block).not.toContain('templateIdHint')
    // refusal law intact: absent/cold keeps the ORIGINAL message (window
    // oracles match `has no real producer`); row-conflict is a distinct,
    // explicit refusal; the code is unchanged
    expect(block).toContain('has no real producer')
    expect(block).toContain("answers no templateId or conflicts with the bound blueprint template")
    expect((block.match(/alpha5-g1-arm-mount-refused/g) ?? []).length).toBe(2)
  })

  it('SOURCE-PAIR: the reused channel is the locateTemplate-verified boundTemplate (hint bridges only after a row miss AND re-resolves in the bound blueprint)', () => {
    // setup destructures boundTemplate BEFORE the mount block (one resolve,
    // shared with the persona/consumption consumers — not a second read)
    const destructure = SRC.indexOf('instanceId, teamRoot, boundTemplate } = resolveConsumptionViews(')
    expect(destructure).toBeGreaterThan(-1)
    expect(destructure).toBeLessThan(SRC.indexOf('const g1RosterRow = domain.repositories.memberInstances.list'))
    // locateTemplate law intact: row by childSessionId first; the hint ONLY
    // for fresh-member; the id must re-resolve in the bound blueprint
    // (blueprint.members.find → miss THROWS) — the arm never re-implements
    // any of this, it consumes the already-resolved template.
    expect(SRC).toContain("} else if (bindPath === 'fresh-member' && templateIdHint !== undefined && templateIdHint !== '')")
    expect(SRC).toContain('const template = blueprint.members.find((entry) => String(entry.templateId) === templateId)')
  })
})
