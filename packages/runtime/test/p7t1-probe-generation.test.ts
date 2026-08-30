/**
 * P7-T1 S-probe-generation — the probe generation contract
 * (Development Plan §20.1, Architecture §14.3 E / §27).
 *
 * Scenarios:
 *
 * - S1: the first probe establishes generation 1 (OPEN, provenance,
 *   ESTABLISHED, the full durable §14.3 E record);
 * - S2: a relevant availability flip changes the environment fingerprint
 *   and bumps the generation (ENVIRONMENT_DRIFT → BLOCKED_WARNING);
 * - S3: irrelevant environment churn (a capability no requirement names)
 *   does NOT change the fingerprint (no drift, still OPEN);
 * - S4: a relevant probe-generation bump with unchanged availability DOES
 *   change the fingerprint (ENVIRONMENT_DRIFT, still OPEN);
 * - S5: each of the five frozen re-probe triggers runs a fresh probe
 *   generation (trigger recorded, generations 1..5, no drift on a stable
 *   environment);
 * - S6: a blueprint requirement domain outside the closed bridge fails
 *   loud (UNBRIDGEABLE_REQUIREMENT) and writes NO durable state.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * every scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t1-probe-generation
 */

import { describe, expect, it } from 'vitest'
import {
  COMPATIBILITY_ERROR_CODES,
  PROBE_TRIGGERS,
  createCompatibilityProber,
} from '../compatibility/index.js'
import type { ProbeTrigger } from '../compatibility/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import {
  P6T1_BLUEPRINT_SOURCE,
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
} from './p6t1-helpers.js'
import {
  assertCompatibilityCode,
  createP7T1World,
  destroyP7T1World,
  factsIrrelevantChurn,
  factsWebDown,
  factsWebGenerationBump,
} from './p7t1-helpers.js'
import { captureError } from './p5t6-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

// ---------------------------------------------------------------------------
// S1 — the first probe establishes generation 1 (provenance + §14.3 E)
// ---------------------------------------------------------------------------
interface S1 {
  readonly trigger: string
  readonly generation: number
  readonly status: string
  readonly fingerprint: string
  readonly pass: number
  readonly warning: number
  readonly fatal: number
  readonly unackedWarning: number
  readonly recordedAt: string
  readonly driftKind: string
  readonly previousGeneration: number | undefined
  readonly observations: number
  readonly recordSchemaVersion: number | undefined
  readonly recordRootSessionId: string | undefined
  readonly recordStatus: string | undefined
  readonly recordFingerprint: string | undefined
  readonly recordGeneration: number | undefined
  readonly recordComputedAt: string | undefined
  readonly recordAcks: number
  readonly recordCounts: unknown
  readonly recordRequirements: unknown
}
let s1: S1
{
  const handle = await createP7T1World('p7t1x-s1')
  try {
    const outcome = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const obs = handle.observations[0]
    if (obs === undefined) throw new Error('S1: no probe observation captured')
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S1: no durable state after probe')
    s1 = {
      trigger: outcome.trigger,
      generation: outcome.generation,
      status: outcome.status,
      fingerprint: outcome.environmentFingerprint,
      pass: outcome.pass,
      warning: outcome.warning,
      fatal: outcome.fatal,
      unackedWarning: outcome.unackedWarning,
      recordedAt: outcome.recordedAt,
      driftKind: obs.drift.kind,
      previousGeneration: obs.drift.previousGeneration,
      observations: handle.observations.length,
      recordSchemaVersion: record.schemaVersion,
      recordRootSessionId: record.rootSessionId,
      recordStatus: record.status,
      recordFingerprint: record.fingerprint,
      recordGeneration: record.generation,
      recordComputedAt: record.computedAt,
      recordAcks: record.acknowledgements.length,
      recordCounts: record.outcomes['counts'],
      recordRequirements: record.outcomes['requirements'],
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S1: first probe establishes generation 1', () => {
  it('records the trigger, generation 1, OPEN, and the fp-v1 fingerprint', () => {
    expect(s1.trigger).toBe('NEW_ACTIVATION')
    expect(s1.generation).toBe(1)
    expect(s1.status).toBe('OPEN')
    expect(s1.fingerprint.startsWith('fp-v1:')).toBe(true)
  })
  it('classifies both fixture requirements PASS (no warning, no fatal)', () => {
    expect(s1.pass).toBe(2)
    expect(s1.warning).toBe(0)
    expect(s1.fatal).toBe(0)
    expect(s1.unackedWarning).toBe(0)
  })
  it('classifies the establishment (no previous state to drift from)', () => {
    expect(s1.driftKind).toBe('ESTABLISHED')
    expect(s1.previousGeneration).toBe(undefined)
    expect(s1.observations).toBe(1)
  })
  it('stamps the provenance clock (recordedAt = the injected now)', () => {
    expect(s1.recordedAt).toBe('2026-08-30T09:00:00.000Z')
  })
  it('durably records the §14.3 E record (all fields, one row per team)', () => {
    expect(s1.recordSchemaVersion).toBe(1)
    expect(s1.recordRootSessionId).toBe(ROOT)
    expect(s1.recordStatus).toBe('OPEN')
    expect(s1.recordFingerprint).toBe(s1.fingerprint)
    expect(s1.recordGeneration).toBe(1)
    expect(s1.recordComputedAt).toBe('2026-08-30T09:00:00.000Z')
    expect(s1.recordAcks).toBe(0)
  })
  it('durably records the requirement outcomes (counts + per-requirement facts)', () => {
    expect(s1.recordCounts).toEqual({
      pass: 2,
      warning: 0,
      fatal: 0,
      unackedWarning: 0,
      staleAcknowledgement: 0,
    })
    const requirements = s1.recordRequirements
    expect(Array.isArray(requirements)).toBe(true)
    const rows = (requirements as readonly Record<string, unknown>[]).map((row) => ({
      requirementId: row['requirementId'],
      outcome: row['outcome'],
      mismatchFingerprint: row['mismatchFingerprint'],
    }))
    expect(rows).toEqual([
      { requirementId: 'req-tool-web', outcome: 'PASS', mismatchFingerprint: null },
      { requirementId: 'req-skill-base', outcome: 'PASS', mismatchFingerprint: null },
    ])
  })
})

// ---------------------------------------------------------------------------
// S2 — relevant availability flip => fingerprint change + generation bump
// ---------------------------------------------------------------------------
interface S2 {
  readonly fp1: string
  readonly status1: string
  readonly fp2: string
  readonly status2: string
  readonly gen2: number
  readonly warning2: number
  readonly unacked2: number
  readonly recordedAt2: string
  readonly driftKind: string
  readonly previousFingerprint: string | undefined
  readonly previousStatus: string | undefined
  readonly recordAcks2: number
}
let s2: S2
{
  const handle = await createP7T1World('p7t1x-s2')
  try {
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    handle.facts.current = factsWebDown() // the `web` tool disappears (gen 2)
    handle.advance(500)
    const second = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const obs = handle.observations[1]
    if (obs === undefined) throw new Error('S2: no second probe observation captured')
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S2: no durable state after second probe')
    s2 = {
      fp1: first.environmentFingerprint,
      status1: first.status,
      fp2: second.environmentFingerprint,
      status2: second.status,
      gen2: second.generation,
      warning2: second.warning,
      unacked2: second.unackedWarning,
      recordedAt2: second.recordedAt,
      driftKind: obs.drift.kind,
      previousFingerprint: obs.drift.previousFingerprint,
      previousStatus: obs.drift.previousStatus,
      recordAcks2: record.acknowledgements.length,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S2: relevant availability flip (capability drift)', () => {
  it('changes the environment fingerprint and bumps the generation', () => {
    expect(s2.status1).toBe('OPEN')
    expect(s2.fp2).not.toBe(s2.fp1)
    expect(s2.gen2).toBe(2)
  })
  it('re-classifies the unmet optional requirement as an unacked WARNING', () => {
    expect(s2.status2).toBe('BLOCKED_WARNING')
    expect(s2.warning2).toBe(1)
    expect(s2.unacked2).toBe(1)
  })
  it('classifies the drift against the previous durable state', () => {
    expect(s2.driftKind).toBe('ENVIRONMENT_DRIFT')
    expect(s2.previousFingerprint).toBe(s2.fp1)
    expect(s2.previousStatus).toBe('OPEN')
  })
  it('advances the provenance clock and keeps no acknowledgements', () => {
    expect(s2.recordedAt2).toBe('2026-08-30T09:00:00.500Z')
    expect(s2.recordAcks2).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S3 — irrelevant environment churn does NOT move the fingerprint
// ---------------------------------------------------------------------------
interface S3 {
  readonly fp1: string
  readonly fp2: string
  readonly status2: string
  readonly gen2: number
  readonly pass2: number
  readonly driftKind: string
}
let s3: S3
{
  const handle = await createP7T1World('p7t1x-s3')
  try {
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    handle.facts.current = factsIrrelevantChurn() // an unrelated MCP disappears
    const second = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const obs = handle.observations[1]
    if (obs === undefined) throw new Error('S3: no second probe observation captured')
    s3 = {
      fp1: first.environmentFingerprint,
      fp2: second.environmentFingerprint,
      status2: second.status,
      gen2: second.generation,
      pass2: second.pass,
      driftKind: obs.drift.kind,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S3: irrelevant environment churn (no requirement names it)', () => {
  it('does not change the environment fingerprint (relevance, §27.3)', () => {
    expect(s3.fp2).toBe(s3.fp1)
  })
  it('classifies no drift and keeps the team OPEN (the generation still advances)', () => {
    expect(s3.driftKind).toBe('NONE')
    expect(s3.status2).toBe('OPEN')
    expect(s3.pass2).toBe(2)
    expect(s3.gen2).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// S4 — relevant generation bump (availability unchanged) DOES move the fp
// ---------------------------------------------------------------------------
interface S4 {
  readonly fp1: string
  readonly fp2: string
  readonly status2: string
  readonly gen2: number
  readonly driftKind: string
}
let s4: S4
{
  const handle = await createP7T1World('p7t1x-s4')
  try {
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    handle.facts.current = factsWebGenerationBump() // same availability, gen 2
    const second = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const obs = handle.observations[1]
    if (obs === undefined) throw new Error('S4: no second probe observation captured')
    s4 = {
      fp1: first.environmentFingerprint,
      fp2: second.environmentFingerprint,
      status2: second.status,
      gen2: second.generation,
      driftKind: obs.drift.kind,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S4: relevant probe-generation bump (availability unchanged)', () => {
  it('changes the fingerprint (generation is part of the probe record, §20.1)', () => {
    expect(s4.fp2).not.toBe(s4.fp1)
    expect(s4.status2).toBe('OPEN')
    expect(s4.gen2).toBe(2)
  })
  it('classifies the generation change as drift', () => {
    expect(s4.driftKind).toBe('ENVIRONMENT_DRIFT')
  })
})

// ---------------------------------------------------------------------------
// S5 — every one of the five frozen triggers runs a fresh probe generation
// ---------------------------------------------------------------------------
interface S5Row {
  readonly trigger: string
  readonly generation: number
  readonly fingerprint: string
  readonly status: string
  readonly driftKind: string
}
let s5: S5Row[]
{
  const handle = await createP7T1World('p7t1x-s5')
  try {
    const triggers: readonly ProbeTrigger[] = [
      PROBE_TRIGGERS.ROOT_COLD_RESUME,
      PROBE_TRIGGERS.MEMBER_COLD_RESUME,
      PROBE_TRIGGERS.NEW_ACTIVATION,
      PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE,
      PROBE_TRIGGERS.STALE_GENERATION_BEFORE_NEW_WORK,
    ]
    const rows: S5Row[] = []
    for (const trigger of triggers) {
      const outcome = await handle.prober.probe(trigger)
      const obs = handle.observations[rows.length]
      if (obs === undefined) throw new Error(`S5: no observation for ${trigger}`)
      rows.push({
        trigger: outcome.trigger,
        generation: outcome.generation,
        fingerprint: outcome.environmentFingerprint,
        status: outcome.status,
        driftKind: obs.drift.kind,
      })
    }
    s5 = rows
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S5: the five DevPlan §20.1 re-probe triggers', () => {
  it('runs five fresh probe generations, one per trigger (stable environment)', () => {
    expect(s5.length).toBe(5)
    const generations = s5.map((row) => row.generation)
    expect(generations).toEqual([1, 2, 3, 4, 5])
  })
  it('records the exact trigger of each probe', () => {
    expect(s5[0]?.trigger).toBe('ROOT_COLD_RESUME')
    expect(s5[1]?.trigger).toBe('MEMBER_COLD_RESUME')
    expect(s5[2]?.trigger).toBe('NEW_ACTIVATION')
    expect(s5[3]?.trigger).toBe('CAPABILITY_GENERATION_CHANGE')
    expect(s5[4]?.trigger).toBe('STALE_GENERATION_BEFORE_NEW_WORK')
  })
  it('keeps the fingerprint and OPEN status on a stable environment (no drift)', () => {
    const fingerprints = s5.map((row) => row.fingerprint)
    expect(fingerprints.every((fp) => fp === (fingerprints[0] ?? ''))).toBe(true)
    expect(s5.every((row) => row.status === 'OPEN')).toBe(true)
    expect(s5.every((row) => row.driftKind === (row.generation === 1 ? 'ESTABLISHED' : 'NONE'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// S6 — unbridgeable blueprint requirement domain fails loud (negative)
// ---------------------------------------------------------------------------
interface S6 {
  readonly code: string
  readonly domain: string | undefined
  readonly recordAfter: CompatibilityStateRecord | undefined
}
let s6: S6
{
  const ghostSource = P6T1_BLUEPRINT_SOURCE.replace(
    '  - domain: tool\n    name: web\n    optional: true\n',
    '  - domain: ghost\n    name: probe-ghost\n  - domain: tool\n    name: web\n    optional: true\n',
  )
  if (ghostSource === P6T1_BLUEPRINT_SOURCE) throw new Error('S6: fixture anchor did not match')
  const world = await createP6T1World('p7t1x-s6', { blueprintSource: ghostSource })
  try {
    const prober = createCompatibilityProber({
      repositories: world.domain.repositories,
      rootSessionId: ROOT,
      blueprint: world.blueprint,
      environmentFacts: async () => makeEnvironmentFacts(),
    })
    const error = await captureError(() => prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION))
    const { code, details } = assertCompatibilityCode(
      error,
      COMPATIBILITY_ERROR_CODES.UNBRIDGEABLE_REQUIREMENT,
    )
    s6 = {
      code,
      domain: details !== undefined ? (details['domain'] as string | undefined) : undefined,
      recordAfter: await prober.current(),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P7-T1 S6: unbridgeable requirement domain (fail loud, §27.1)', () => {
  it('throws UNBRIDGEABLE_REQUIREMENT naming the offending domain', () => {
    expect(s6.code).toBe(COMPATIBILITY_ERROR_CODES.UNBRIDGEABLE_REQUIREMENT)
    expect(s6.domain).toBe('ghost')
  })
  it('writes no durable compatibility state (the probe never classifies)', () => {
    expect(s6.recordAfter).toBe(undefined)
  })
})
