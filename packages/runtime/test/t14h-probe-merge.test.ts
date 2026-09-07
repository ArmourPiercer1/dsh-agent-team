/**
 * T14-H (repair-r1, T1.4-B) — the host-completed pre-creation probe
 * (`intent.probe` fact merge; U5/T1-B strict, CF2 entry 2, INV-9.4).
 *
 * The T1.4 finding: the UI pre-create probe saw ONLY the client persona
 * facts while the post-creation admission gate saw the row-config facts —
 * the same blueprint, different worlds: a blueprint with a required
 * non-persona requirement (the mock `dtest-bp`: `persona/standard` +
 * `mcp/dtest-mini`) could pass the gate after creation yet was
 * structurally BLOCKED in the create panel (FATAL before the team ever
 * existed).
 *
 * The fix (packages/runtime, host-side only, wire shape UNCHANGED):
 * `intent.probe` evaluates the SAME world the gate consumes — the
 * authoritative host row-config facts (the same injected source `root.ts`
 * passes to the prober / authority / runtime) merged with the caller's
 * wire facts under the strict U5 rule: the caller contributes ONLY the
 * `persona` domain (the selected preset is the explicit user intent; the
 * row's persona fact is the deployment default and yields to the
 * selection — diverging against a required persona makes the probe
 * STRICTER than the gate, the documented safe direction); every other
 * domain is host-only (caller capability claims are DISCARDED — the
 * fact-forgery hole closed; CR-4: a claim is input, never authority).
 *
 * The persistent scenarios (all ⊕ of the T14-H package §8.10):
 *
 * - T1  required MCP PRESENT in the row facts ⇒ pre-create PASS
 *   (the T1.4 repro: pre-fix FATAL — the red check pins it);
 * - T2  required MCP ABSENT from the row facts ⇒ FATAL (fail-closed
 *   preserved, NO downgrade to WARNING, no Continue-anyway);
 * - T3  optional requirement absent ⇒ WARNING + the explicit ack path
 *   unchanged (the §27.3 binding: an ack bound to this exact
 *   mismatch/environment pair satisfies it — DEGRADED_ACKNOWLEDGED);
 * - T4  persona mismatch UNCHANGED (the selected preset still drives the
 *   persona fact; the §7.4 complete:true preset-conflict FATAL is
 *   untouched; no selection ⇒ empty persona world ⇒ fail-closed);
 * - T5  fact-source precedence / NO client spoofing (the caller's
 *   capability claims are discarded in BOTH directions: claiming an
 *   unavailable host capability does not pass; denying an available one
 *   does not block; the client persona still wins its own domain);
 * - T6  probe/gate parity (the predictor property, Architecture §7.4):
 *   for the same blueprint, every capability-domain verdict of the real
 *   S6 probe equals the verdict of the REAL admission gate
 *   (`enforceCompatibilityGate` over a real durable P6-T1 world) on the
 *   same row facts — OPEN↔admit, FATAL↔block(same requirement),
 *   WARNING↔block(same requirement);
 * - T7  wire validation preserved: a malformed caller fact still fails
 *   loud MALFORMED_DTO (exactly as pre-T1.4 — the frozen engine parser).
 *
 * The fixture blueprint mirrors the mock repro row (`dtest-bp`:
 * `persona/standard` + `mcp/dtest-mini` both required) with one added
 * OPTIONAL `tool/web` requirement (the WARNING/ack lane); the host facts
 * mirror the mock row-config `environmentFacts` (the four facts at
 * generation 1).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/t14h-probe-merge
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions, S6RemotePorts } from '../src/plugin/s6-remote.js'
import {
  createBlueprintCatalog,
  parseBlueprint,
} from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
  evaluateCompatibility,
} from '../../domain/compatibility/src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
  RequirementResult,
} from '../../domain/compatibility/src/index.js'
import { isTeamContractError } from '../../contracts/src/index.js'
import type { RemoteSafeRecord } from '../../remote/src/contracts/remote-safe.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  TeamRuntimeError,
} from '../admission/index.js'
import { enforceCompatibilityGate } from '../admission/index.js'
import { compatibilityRequirementsOf } from '../compatibility/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
} from './p6t1-helpers.js'

// --- the fixture world (the mock `dtest-bp` repro shape + one optional) ---

/**
 * The fixture blueprint source: the mock repro requirements
 * (`persona/standard` + `mcp/dtest-mini`, both REQUIRED — the T1.4 shape)
 * plus one OPTIONAL `tool/web` requirement (the WARNING / ack lane).
 */
const T14H_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: t14h-bp',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the T14H team.',
  'members:',
  '  - templateId: worker',
  '    displayName: T14H Worker',
  '    persona: You do the T14H work.',
  'requirements:',
  '  - domain: persona',
  '    name: standard',
  '  - domain: mcp',
  '    name: dtest-mini',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  'teamEnvelope:',
  '  allow:',
  '    - send-message',
  '    - report-progress',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The T14H default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The parsed fixture blueprint (the real domain parse + content hash). */
const T14H_BLUEPRINT: TeamBlueprint = parseBlueprint(T14H_BLUEPRINT_SOURCE)

/** A REAL blueprint catalog holding the fixture blueprint. */
const T14H_CATALOG = createBlueprintCatalog([T14H_BLUEPRINT])

/** The bound root id of the probe test worlds. */
const T14H_ROOT = 'session-t14h-probe'

/**
 * The mock row-config environment facts (the `dtest-mini` repro row,
 * generation 1): every probeable fixture requirement available — plus
 * the row's deployment-default persona fact (the selected preset in the
 * mock world).
 */
const HOST_FACTS_FULL: readonly EnvironmentFact[] = [
  { domain: 'tool', subject: 'web', available: true, generation: 1 },
  { domain: 'skill', subject: 'base', available: true, generation: 1 },
  { domain: 'persona', subject: 'standard', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'dtest-mini', available: true, generation: 1 },
]

/** The row facts with the required MCP server ABSENT (the fail-closed lane). */
const HOST_FACTS_NO_MCP: readonly EnvironmentFact[] = HOST_FACTS_FULL.filter(
  (fact) => !(fact.domain === 'mcpServer' && fact.subject === 'dtest-mini'),
)

/** The row facts with the optional tool ABSENT (the WARNING lane). */
const HOST_FACTS_NO_TOOL: readonly EnvironmentFact[] = HOST_FACTS_FULL.filter(
  (fact) => !(fact.domain === 'tool' && fact.subject === 'web'),
)

/** The row facts with the required MCP server UNAVAILABLE (the spoof lane). */
const HOST_FACTS_MCP_DOWN: readonly EnvironmentFact[] = HOST_FACTS_FULL.map((fact) =>
  fact.domain === 'mcpServer' && fact.subject === 'dtest-mini'
    ? { ...fact, available: false }
    : fact,
)

/** The UI panel's wire facts for the selected preset `standard` (generation 0 — the client attests no probe epoch). */
const CALLER_STANDARD: readonly RemoteSafeRecord[] = [
  { domain: 'persona', subject: 'standard', available: true, generation: 0 },
]

/** The UI panel's wire facts for a DIVERGENT selection (`other`). */
const CALLER_OTHER: readonly RemoteSafeRecord[] = [
  { domain: 'persona', subject: 'other', available: true, generation: 0 },
]

/** The spoofing payload: the caller CLAIMS the required MCP is available. */
const CALLER_SPOOF_MCP_UP: readonly RemoteSafeRecord[] = [
  { domain: 'persona', subject: 'standard', available: true, generation: 0 },
  { domain: 'mcpServer', subject: 'dtest-mini', available: true, generation: 0 },
]

/** The spoofing payload (reverse direction): the caller CLAIMS the required MCP is unavailable. */
const CALLER_SPOOF_MCP_DOWN: readonly RemoteSafeRecord[] = [
  { domain: 'persona', subject: 'standard', available: true, generation: 0 },
  { domain: 'mcpServer', subject: 'dtest-mini', available: false, generation: 0 },
]

/** The spoofing payload (optional domain): the caller CLAIMS the optional tool is available. */
const CALLER_SPOOF_TOOL_UP: readonly RemoteSafeRecord[] = [
  { domain: 'persona', subject: 'standard', available: true, generation: 0 },
  { domain: 'tool', subject: 'web', available: true, generation: 0 },
]

/** A MALFORMED caller fact (the `available` field missing — the wire validation lane). */
const CALLER_MALFORMED: readonly RemoteSafeRecord[] = [
  { domain: 'mcpServer', subject: 'dtest-mini' },
]

// --- helpers -----------------------------------------------------------------

/** Build the real production S6 ports over the fixture world (the probe under test). */
function makeProbePorts(hostFacts: readonly EnvironmentFact[]): S6RemotePorts {
  const opts = {
    rootSessionId: T14H_ROOT,
    catalog: T14H_CATALOG,
    blueprint: T14H_BLUEPRINT,
    environmentFacts: () => Promise.resolve(hostFacts),
  } as unknown as S6RemoteOptions
  return createS6RemotePorts(opts)
}

/** Run one probe over the fixture world (the wire-level call the panel makes). */
async function runProbe(
  hostFacts: readonly EnvironmentFact[],
  callerFacts: readonly RemoteSafeRecord[],
): Promise<CompatibilityResult> {
  const ports = makeProbePorts(hostFacts)
  return (await ports.intent.probe('t14h-bp', 1, callerFacts)) as unknown as CompatibilityResult
}

/** One captured gate verdict (the real admission gate over a real durable world). */
interface GateVerdict {
  readonly admitted: boolean
  readonly code: string
  readonly details: Record<string, unknown>
}

/** Find one requirement row of a result (guards the fixture shape). */
function rowOf(result: CompatibilityResult, requirementId: string): RequirementResult {
  const row = result.requirements.find((candidate) => candidate.requirementId === requirementId)
  if (row === undefined) throw new Error(`T14H guard: requirement row '${requirementId}' missing`)
  return row
}

// --- module-level scenario capture (top-level await) -------------------------

const T14H = await (async () => {
  // (T1) THE REPRO: required MCP PRESENT in the row facts, the panel
  // selects the row's preset ⇒ pre-create PASS (pre-fix: FATAL — the
  // probe saw the client persona facts only and the required MCP fact
  // was "missing" before the team even existed).
  const t1 = await runProbe(HOST_FACTS_FULL, CALLER_STANDARD)

  // (T2) required MCP ABSENT from the row facts ⇒ FATAL (fail-closed,
  // no downgrade — identical to the admission gate on the same row).
  const t2 = await runProbe(HOST_FACTS_NO_MCP, CALLER_STANDARD)

  // (T3) optional requirement absent ⇒ WARNING + the explicit ack path:
  // the probe reports the ack-able WARNING (never default-acknowledged);
  // the engine-level re-evaluation with an ack bound to THIS exact
  // mismatch/environment pair satisfies it (§27.3, unchanged).
  const t3 = await runProbe(HOST_FACTS_NO_TOOL, CALLER_STANDARD)
  const t3World: readonly EnvironmentFact[] = [
    // the merged world the probe evaluated (U5 rule, pinned independently
    // of the port: persona = the caller's selection; the rest = the host
    // row facts exclusively).
    ...(CALLER_STANDARD as unknown as EnvironmentFact[]).filter((fact) => fact.domain === 'persona'),
    ...HOST_FACTS_NO_TOOL.filter((fact) => fact.domain !== 'persona'),
  ]
  const t3WarningRow = rowOf(t3, 'req-tool-web')
  const t3Acked =
    t3WarningRow.outcome === 'WARNING' && t3WarningRow.mismatchFingerprint !== null
      ? evaluateCompatibility({
          requirements: compatibilityRequirementsOf(T14H_BLUEPRINT),
          environmentFacts: t3World,
          acknowledgements: [
            {
              requirementId: 'req-tool-web',
              mismatchFingerprint: t3WarningRow.mismatchFingerprint,
              environmentFingerprint: t3.environmentFingerprint,
              acknowledgedBy: 't14h-test',
              acknowledgedAt: '2026-09-07T00:00:00.000Z',
            },
          ],
        })
      : null

  // (T4) persona mismatch UNCHANGED: the row's deployment-default persona
  // fact does NOT rescue a divergent selection (the persona domain is
  // driven by the selected preset — the §7.4 complete:true conflict is
  // untouched; the probe is stricter than the gate: the safe direction).
  const t4a = await runProbe(HOST_FACTS_FULL, CALLER_OTHER)
  // (T4b) no preset selected (the panel sends no facts) ⇒ EMPTY persona
  // world ⇒ fail-closed (identical to the pre-fix pure-caller evaluation).
  const t4b = await runProbe(HOST_FACTS_FULL, [])

  // (T5) fact-source precedence / NO client spoofing:
  const t5a = await runProbe(HOST_FACTS_MCP_DOWN, CALLER_SPOOF_MCP_UP) // claims UP against a DOWN row
  const t5b = await runProbe(HOST_FACTS_FULL, CALLER_SPOOF_MCP_DOWN) // claims DOWN against an UP row
  const t5c = await runProbe(HOST_FACTS_NO_TOOL, CALLER_SPOOF_TOOL_UP) // claims an ABSENT optional

  // (T7) wire validation preserved: a malformed caller fact still fails
  // loud MALFORMED_DTO (the frozen engine parser, exactly as pre-T1.4).
  let t7Error: unknown = undefined
  try {
    await runProbe(HOST_FACTS_FULL, CALLER_MALFORMED)
  } catch (error) {
    t7Error = error
  }

  // (T6) probe/gate parity — the predictor property (Architecture §7.4):
  // the real S6 probe and the REAL admission gate over a real durable
  // P6-T1 world (real repositories, `enforceCompatibilityGate`) on the
  // SAME row facts. P6-T1-BP requirements: `tool/web` OPTIONAL +
  // `skill/base` REQUIRED (capability domains only — no persona lane).
  const parityVariant = async (name: string, facts: readonly EnvironmentFact[]): Promise<{
    readonly probe: CompatibilityResult
    readonly gate: GateVerdict
  }> => {
    const world = await createP6T1World(`t14h-parity-${name}`)
    try {
      const probePorts = createS6RemotePorts({
        rootSessionId: String(P6T1_FIXTURE.rootSessionId),
        catalog: world.catalog,
        blueprint: world.blueprint,
        environmentFacts: () => Promise.resolve(facts),
      } as unknown as S6RemoteOptions)
      const probe = (await probePorts.intent.probe('P6T1-BP', 1, [])) as unknown as CompatibilityResult
      let gate: GateVerdict
      try {
        await enforceCompatibilityGate(
          world.domain.repositories,
          world.blueprint,
          String(P6T1_FIXTURE.rootSessionId),
          facts,
        )
        gate = { admitted: true, code: '', details: {} }
      } catch (error) {
        if (!(error instanceof TeamRuntimeError)) {
          throw new Error(`T14H guard: expected TeamRuntimeError from the gate, got ${String(error)}`)
        }
        gate = { admitted: false, code: error.code, details: (error.details ?? {}) as Record<string, unknown> }
      }
      return { probe, gate }
    } finally {
      await destroyP6T1World(world)
    }
  }

  const t6open = await parityVariant('open', makeEnvironmentFacts())
  const t6fatal = await parityVariant(
    'fatal',
    makeEnvironmentFacts([{ domain: 'skill', subject: 'base', available: false, generation: 1 }]),
  )
  const t6warning = await parityVariant(
    'warning',
    makeEnvironmentFacts([{ domain: 'tool', subject: 'web', available: false, generation: 1 }]),
  )

  return {
    t1,
    t2,
    t3,
    t3WarningRow,
    t3Acked,
    t4a,
    t4b,
    t5a,
    t5b,
    t5c,
    t7Error,
    t6open,
    t6fatal,
    t6warning,
  }
})()

// --- the assertions (synchronous `it` bodies) --------------------------------

describe('T14-H: intent.probe merges the host row facts with the caller persona facts (U5 strict, INV-9.4)', () => {
  it('T1 (the T1.4 repro): required MCP PRESENT in the row facts ⇒ pre-create PASS with every requirement SATISFIED', () => {
    const result = T14H.t1
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(rowOf(result, 'req-persona-standard').outcome).toBe('PASS')
    expect(rowOf(result, 'req-mcp-dtest-mini').outcome).toBe('PASS')
    expect(rowOf(result, 'req-tool-web').outcome).toBe('PASS')
    expect(result.counts).toEqual({
      pass: 3,
      warning: 0,
      fatal: 0,
      unackedWarning: 0,
      staleAcknowledgement: 0,
    })
  })

  it('T2: required MCP ABSENT from the row facts ⇒ FATAL (fail-closed preserved; NO downgrade to WARNING)', () => {
    const result = T14H.t2
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const row = rowOf(result, 'req-mcp-dtest-mini')
    expect(row.outcome).toBe('FATAL')
    expect(row.complete).toBe(true)
    expect(row.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    expect(row.unavailableSubjects).toEqual(['dtest-mini'])
    expect(result.counts.fatal).toBe(1)
  })

  it('T3: optional requirement absent ⇒ WARNING (never default-acknowledged) + the §27.3 ack path unchanged (a bound ack ⇒ DEGRADED_ACKNOWLEDGED / VALID)', () => {
    const result = T14H.t3
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    const row = rowOf(result, 'req-tool-web')
    expect(row.outcome).toBe('WARNING')
    expect(row.complete).toBe(false)
    expect(row.reasonCode).toBe(COMPATIBILITY_REASON_CODES.CAPABILITY_UNAVAILABLE)
    expect(row.unavailableSubjects).toEqual(['web'])
    // The WARNING is ack-able but NEVER default-acknowledged: no ack
    // targets it yet (the explicit-ack discipline of UI §7.4 / §27.3).
    expect(row.acknowledgement === null ? null : row.acknowledgement.status).toBe('MISSING')
    expect(row.mismatchFingerprint === null).toBe(false)
    // The rest of the world is intact (the required lane passes).
    expect(rowOf(result, 'req-mcp-dtest-mini').outcome).toBe('PASS')
    expect(rowOf(result, 'req-persona-standard').outcome).toBe('PASS')
    // The explicit ack path (post-creation durable compatibility.ack
    // binds to exactly these fingerprints): an ack bound to THIS
    // mismatch + environment pair satisfies the warning.
    expect(T14H.t3Acked === null).toBe(false)
    if (T14H.t3Acked !== null) {
      expect(T14H.t3Acked.status).toBe(COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED)
      const ackedRow = rowOf(T14H.t3Acked, 'req-tool-web')
      expect(ackedRow.outcome).toBe('WARNING')
      expect(ackedRow.acknowledgement === null ? null : ackedRow.acknowledgement.status).toBe('VALID')
    }
  })

  it('T4a: persona mismatch UNCHANGED — a divergent selection is FATAL (the row default does not rescue it; the probe is stricter than the gate, the safe direction)', () => {
    const result = T14H.t4a
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const row = rowOf(result, 'req-persona-standard')
    expect(row.outcome).toBe('FATAL')
    expect(row.complete).toBe(true)
    expect(row.reasonCode).toBe(COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(row.unavailableSubjects).toEqual(['standard'])
    // The capability lane is still host-driven and passes.
    expect(rowOf(result, 'req-mcp-dtest-mini').outcome).toBe('PASS')
  })

  it('T4b: no preset selected (empty caller facts) ⇒ EMPTY persona world ⇒ fail-closed FATAL (identical to the pre-fix pure-caller evaluation)', () => {
    const result = T14H.t4b
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const row = rowOf(result, 'req-persona-standard')
    expect(row.outcome).toBe('FATAL')
    expect(row.reasonCode).toBe(COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(row.unavailableSubjects).toEqual(['standard'])
  })

  it('T5a: NO client spoofing — claiming the unavailable required MCP available ⇒ still FATAL (the host fact wins)', () => {
    const result = T14H.t5a
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const row = rowOf(result, 'req-mcp-dtest-mini')
    expect(row.outcome).toBe('FATAL')
    expect(row.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    expect(row.unavailableSubjects).toEqual(['dtest-mini'])
  })

  it('T5b: NO client spoofing (reverse) — claiming the available required MCP unavailable ⇒ still PASS (the host fact wins both ways)', () => {
    const result = T14H.t5b
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(rowOf(result, 'req-mcp-dtest-mini').outcome).toBe('PASS')
  })

  it('T5c: NO client spoofing (optional domain) — claiming an absent optional tool available ⇒ still WARNING (the claim cannot fabricate a host capability)', () => {
    const result = T14H.t5c
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    const row = rowOf(result, 'req-tool-web')
    expect(row.outcome).toBe('WARNING')
    expect(row.unavailableSubjects).toEqual(['web'])
    // The claim did not leak into the persona domain either: the
    // selected preset still drives it.
    expect(rowOf(result, 'req-persona-standard').outcome).toBe('PASS')
  })

  it('T6 (probe/gate parity, Architecture §7.4): the probe and the REAL admission gate render the same capability-domain verdicts on the same row facts', () => {
    // OPEN world: probe OPEN ⇔ the gate admits.
    expect(T14H.t6open.probe.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(T14H.t6open.gate.admitted).toBe(true)
    expect(rowOf(T14H.t6open.probe, 'req-tool-web').outcome).toBe('PASS')
    expect(rowOf(T14H.t6open.probe, 'req-skill-base').outcome).toBe('PASS')

    // FATAL world (required skill unavailable): probe FATAL on the SAME
    // requirement ⇔ the gate blocks with that SAME requirement.
    expect(T14H.t6fatal.probe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(rowOf(T14H.t6fatal.probe, 'req-skill-base').outcome).toBe('FATAL')
    expect(T14H.t6fatal.gate.admitted).toBe(false)
    expect(T14H.t6fatal.gate.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(T14H.t6fatal.gate.details['status']).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(T14H.t6fatal.gate.details['blockingRequirementIds']).toEqual(['req-skill-base'])

    // WARNING world (optional tool unavailable): probe WARNING on the
    // SAME requirement (unacked ⇒ blocks) ⇔ the gate blocks with that
    // SAME requirement.
    expect(T14H.t6warning.probe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    expect(rowOf(T14H.t6warning.probe, 'req-tool-web').outcome).toBe('WARNING')
    expect(T14H.t6warning.gate.admitted).toBe(false)
    expect(T14H.t6warning.gate.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(T14H.t6warning.gate.details['status']).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    expect(T14H.t6warning.gate.details['blockingRequirementIds']).toEqual(['req-tool-web'])
  })

  it('T7 (wire validation preserved): a malformed caller fact still fails loud MALFORMED_DTO (the frozen engine parser, exactly as pre-T1.4)', () => {
    expect(T14H.t7Error === undefined).toBe(false)
    if (T14H.t7Error !== undefined) {
      expect(isTeamContractError(T14H.t7Error)).toBe(true)
      if (isTeamContractError(T14H.t7Error)) {
        expect(T14H.t7Error.code).toBe('MALFORMED_DTO')
      }
    }
  })
})
