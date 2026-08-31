/**
 * p7t7-integrated-override-admission.test.ts — P7-T7 G7 criterion 3
 * (DevPlan §20.7), integrated over the REAL P7-T2 mutation service
 * (TaskDoc §11.8 P7-T7: "override/admission integrated suite"):
 *
 * - the frozen Team layer order (blueprint < policyState < template <
 *   templateOverlay < instanceOverlay < humanOverride) is observed through
 *   admitted mutations for the SAME capability cell: the member's OWN
 *   instance grant (step 1) beats the leader's team grant (step 2) on
 *   alpha — instanceOverlay is ABOVE templateOverlay; the team grant
 *   still applies to beta, who holds no grant of its own; and the
 *   explicit human override (step 3) beats EVERYTHING — humanOverride is
 *   the highest Team layer (invariant 34);
 * - the team-scoped human override applies to EVERY member (beta has no
 *   grants of its own and still resolves the human cell at step 3);
 * - the lower layers stay visible as `overriddenLower` (the override
 *   precedence is transparent, not a wipe);
 * - in BOTH steps the legacy home inspected by the P7-T7 reader is
 *   untouched (read-only isolation): identical inspection view before/
 *   after and a read-only port log.
 *
 * The P7-T2 world is SYNCHRONOUS (fake step clock): the scenario runs at
 * module top level; the `it()` bodies assert only over the captured
 * snapshot.
 *
 * @module @dsh-agent-team/legacy/test/p7t7-integrated-override-admission
 */

import { describe, expect, it } from 'vitest'
import type { CapabilityName, PolicyEntry } from '../../domain/policy/src/index.js'
import {
  P7T2_ALPHA,
  P7T2_BETA,
  P7T2_TEAM,
  allow,
  createP7T2World,
  deny,
  fixtureMember,
} from '../../runtime/test/p7t2-helpers.js'
import type { P7T2World } from '../../runtime/test/p7t2-helpers.js'
import { inspectLegacyTeam } from '../session-reader/index.js'
import {
  P7T7_REQUEST,
  buildP7T7LegacyHome,
  homeTreeSnapshot,
  RecordingLegacyHomePort,
  viewJson,
} from './p7t7-helpers.js'

/** The envelope opens model/tools/permissions (mirrors the P7-T2 fixture). */
const ENVELOPE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b', 'm-human'),
  tools: allow('t-a'),
  permissions: allow('p-a'),
  skills: deny(),
  mcp: deny(),
}

/** Blueprint/template baseline: deny everywhere (no cell granted by baseline). */
function allDeny(): Partial<Record<CapabilityName, PolicyEntry>> {
  return { model: deny(), tools: deny(), permissions: deny(), skills: deny(), mcp: deny() }
}

interface ModelCell {
  readonly layer: string
  readonly origin: string
  readonly recordId: string | null
  readonly effectiveJson: string
  readonly overriddenLower: { layer: string; origin: string; valueJson: string }[]
}

/** One effective `model` cell, projected to plain data (the evidence channel). */
function modelCell(world: P7T2World, member: ReturnType<typeof fixtureMember>, atStep: number): ModelCell {
  const config = world.service.resolveEffective(P7T2_TEAM, member, atStep)
  const cell = config.policy.cells['model']
  return {
    layer: cell.team.layer,
    origin: cell.team.origin,
    recordId: cell.team.recordId,
    effectiveJson: JSON.stringify(cell.effective),
    overriddenLower: cell.team.overriddenLower.map((entry) => ({
      layer: entry.layer,
      origin: entry.origin,
      valueJson: JSON.stringify(entry.value),
    })),
  }
}

// ---------------------------------------------------------------------------
// The scenario: three admitted grants on the SAME cell (human wins)
// ---------------------------------------------------------------------------

const snapshot = (() => {
  const tree = buildP7T7LegacyHome()
  const port = new RecordingLegacyHomePort(tree)
  const viewBefore = inspectLegacyTeam(port, P7T7_REQUEST)
  const homeBefore = homeTreeSnapshot(tree)

  const world: P7T2World = createP7T2World({
    blueprint: { values: allDeny(), autonomyEnvelope: ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: allDeny(), mutationEnvelope: ENVELOPE },
      [P7T2_BETA]: { values: allDeny(), mutationEnvelope: ENVELOPE },
    },
  })
  const { service, clock } = world
  const alpha = fixtureMember(P7T2_ALPHA)
  const beta = fixtureMember(P7T2_BETA)

  // Step 0 (effective from step 1): the member's OWN grant (instanceOverlay).
  const recMember = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-a'),
    actor: { kind: 'member', member: alpha },
  })
  const step1 = modelCell(world, alpha, 1)

  // Step 1 (effective from step 2): the leader's TEAM grant (templateOverlay).
  clock.advance()
  const recLeader = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'leader' },
  })
  const step2Alpha = modelCell(world, alpha, 2)
  const step2Beta = modelCell(world, beta, 2)

  // Step 2 (effective from step 3): the explicit HUMAN override (invariant 34).
  clock.advance()
  const recHuman = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-human'),
    actor: { kind: 'human' },
  })
  const step3Alpha = modelCell(world, alpha, 3)
  const step3Beta = modelCell(world, beta, 3)

  const viewAfter = inspectLegacyTeam(port, P7T7_REQUEST)
  port.assertOnlyReadOps()
  return {
    recMemberId: recMember.recordId,
    recLeaderId: recLeader.recordId,
    recHumanId: recHuman.recordId,
    step1,
    step2Alpha,
    step2Beta,
    step3Alpha,
    step3Beta,
    viewIdentical: viewJson(viewAfter) === viewJson(viewBefore),
    homeIdentical: JSON.stringify(homeTreeSnapshot(tree)) === JSON.stringify(homeBefore),
    allowA: JSON.stringify(allow('m-a')),
    allowB: JSON.stringify(allow('m-b')),
    allowHuman: JSON.stringify(allow('m-human')),
    denyJson: JSON.stringify(deny()),
  }
})()

// ===========================================================================
// Assertions
// ===========================================================================

describe('P7-T7 G7 criterion 3: human override precedence (integrated, P7-T2 real service)', () => {
  it('step 1: the member grant is the effective cell (instanceOverlay)', () => {
    expect(snapshot.step1.layer).toBe('instanceOverlay')
    expect(snapshot.step1.origin).toBe('member')
    expect(snapshot.step1.effectiveJson).toBe(snapshot.allowA)
    expect(snapshot.step1.recordId).toBe(snapshot.recMemberId)
  })
  it('step 2: on alpha the member grant still wins (instanceOverlay is above templateOverlay)', () => {
    expect(snapshot.step2Alpha.layer).toBe('instanceOverlay')
    expect(snapshot.step2Alpha.origin).toBe('member')
    expect(snapshot.step2Alpha.effectiveJson).toBe(snapshot.allowA)
    expect(snapshot.step2Alpha.recordId).toBe(snapshot.recMemberId)
    // The leader's team grant LOST below — the ascending chain holds the
    // static blueprint/template denies plus the lost templateOverlay.
    expect(snapshot.step2Alpha.overriddenLower).toEqual([
      { layer: 'blueprint', origin: 'static', valueJson: snapshot.denyJson },
      { layer: 'template', origin: 'static', valueJson: snapshot.denyJson },
      { layer: 'templateOverlay', origin: 'leader', valueJson: snapshot.allowB },
    ])
  })
  it('step 2: the team grant also applies to members without their own grant (beta)', () => {
    expect(snapshot.step2Beta.layer).toBe('templateOverlay')
    expect(snapshot.step2Beta.effectiveJson).toBe(snapshot.allowB)
  })
  it('step 3: the human override is the highest Team layer (humanOverride, invariant 34)', () => {
    expect(snapshot.step3Alpha.layer).toBe('humanOverride')
    expect(snapshot.step3Alpha.origin).toBe('human')
    expect(snapshot.step3Alpha.effectiveJson).toBe(snapshot.allowHuman)
    expect(snapshot.step3Alpha.recordId).toBe(snapshot.recHumanId)
  })
  it('step 3: the lower layers remain visible as overriddenLower (transparent precedence)', () => {
    // The override is transparent, not a wipe: the full ascending chain
    // of lower layers is visible (static denies, leader grant, member grant).
    expect(snapshot.step3Alpha.overriddenLower).toEqual([
      { layer: 'blueprint', origin: 'static', valueJson: snapshot.denyJson },
      { layer: 'template', origin: 'static', valueJson: snapshot.denyJson },
      { layer: 'templateOverlay', origin: 'leader', valueJson: snapshot.allowB },
      { layer: 'instanceOverlay', origin: 'member', valueJson: snapshot.allowA },
    ])
  })
  it('step 3: the team-scoped human override applies to every member (beta)', () => {
    expect(snapshot.step3Beta.layer).toBe('humanOverride')
    expect(snapshot.step3Beta.origin).toBe('human')
    expect(snapshot.step3Beta.effectiveJson).toBe(snapshot.allowHuman)
  })
  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(snapshot.viewIdentical).toBe(true)
    expect(snapshot.homeIdentical).toBe(true)
  })
})
