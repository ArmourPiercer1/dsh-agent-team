/**
 * A4-PR6 — GovernanceWarning: vocabulary freeze, the start gate, and the
 * ack plane (plan §6.A/§6.0).
 *
 * The three-vocabulary law (coordination ruling, vocabulary-drift class):
 * the REVIEWER plane (`INTERVENTION_ACTIONS`), the DECISION plane
 * (`CONTROL_DECISION_VALUES`) and the WARNING plane
 * (`GOVERNANCE_WARNING_ACTIONS`) are DISTINCT closed sets. `acknowledge`
 * lives ONLY on the warning plane. Every pin below is proven load-bearing by
 * the mutation flips recorded in `dev/agent-workflow/evidence/a4-pr6/`.
 */

import { describe, expect, it } from 'vitest'

import {
  INTERVENTION_ACTIONS,
  INTERVENTION_ACTION_VALUES,
} from '../intervention/types.js'
import { CONTROL_DECISION_VALUES, CONTROL_DECISION_VALUE_VALUES } from '../control/types.js'
import {
  GOVERNANCE_WARNING_ACTIONS,
  GOVERNANCE_WARNING_ACTION_VALUES,
  GOVERNANCE_WARNING_FACT_TYPES,
  GOVERNANCE_WARNING_FACT_TYPE_VALUES,
  GOVERNANCE_WARNING_KINDS,
  GOVERNANCE_WARNING_VERDICTS,
  GOVERNANCE_WARNING_MINTING_VERDICTS,
  GOVERNANCE_START_STATUSES,
  GOVERNANCE_START_CORRUPT_REASONS,
} from '../governance-warning/index.js'

describe('A4-PR6 vocabulary freeze: three distinct action planes', () => {
  it('the reviewer plane is exactly allow|deny|escalate and NEVER contains acknowledge', () => {
    expect([...INTERVENTION_ACTION_VALUES].sort()).toEqual(['allow', 'deny', 'escalate'])
    expect(INTERVENTION_ACTIONS).toEqual({ ALLOW: 'allow', DENY: 'deny', ESCALATE: 'escalate' })
    // The load-bearing half of the ruling (mutation flip A: adding
    // `acknowledge` to INTERVENTION_ACTIONS turns THIS red):
    expect(INTERVENTION_ACTION_VALUES).not.toContain(GOVERNANCE_WARNING_ACTIONS.ACKNOWLEDGE)
  })

  it('the decision plane values are the closed durable set and NEVER contain acknowledge', () => {
    // A warning ack must never be expressible as a Control decision — that is
    // the durable face of "a warning is not an approval case" (spec §15.0).
    expect([...CONTROL_DECISION_VALUE_VALUES].sort()).toEqual(['allow', 'deny', 'stale-denied'])
    expect(CONTROL_DECISION_VALUE_VALUES).not.toContain(GOVERNANCE_WARNING_ACTIONS.ACKNOWLEDGE)
    expect(CONTROL_DECISION_VALUES).not.toHaveProperty('ACKNOWLEDGE')
  })

  it('the warning plane is exactly {acknowledge} and is disjoint from the reviewer plane', () => {
    expect([...GOVERNANCE_WARNING_ACTION_VALUES]).toEqual(['acknowledge'])
    expect(GOVERNANCE_WARNING_ACTIONS).toEqual({ ACKNOWLEDGE: 'acknowledge' })
    for (const value of GOVERNANCE_WARNING_ACTION_VALUES) {
      expect(INTERVENTION_ACTION_VALUES).not.toContain(value)
      expect(CONTROL_DECISION_VALUES).not.toContain(value)
    }
  })

  it('the warning fact types are the frozen pair with the exact values (category pinned in 6.C)', () => {
    // The VALUES are pinned because a renamed fact type passes every key-set
    // comparison and silently splits the ledger history.
    expect(GOVERNANCE_WARNING_FACT_TYPES).toEqual({
      OBSERVED: 'governance-warning-observed',
      ACKNOWLEDGED: 'governance-warning-acknowledged',
    })
    expect([...GOVERNANCE_WARNING_FACT_TYPE_VALUES].sort()).toEqual([
      'governance-warning-acknowledged',
      'governance-warning-observed',
    ])
  })

  it('the verdict/kind/start vocabularies are the frozen closed sets', () => {
    expect(GOVERNANCE_WARNING_VERDICTS).toEqual({
      CONSISTENT: 'consistent',
      MISMATCH: 'mismatch',
      UNDETERMINED: 'undetermined',
    })
    expect([...GOVERNANCE_WARNING_MINTING_VERDICTS].sort()).toEqual(['mismatch', 'undetermined'])
    expect(GOVERNANCE_WARNING_KINDS).toEqual({ ENVELOPE_CONSISTENCY: 'envelope-consistency' })
    expect(GOVERNANCE_START_STATUSES).toEqual({
      OPEN: 'open',
      WARNING_REQUIRED: 'warning-required',
      CORRUPT: 'corrupt',
      MIGRATION_REQUIRED: 'migration-required',
    })
    expect(Object.values(GOVERNANCE_START_CORRUPT_REASONS).sort()).toEqual([
      'authority-document-corrupt',
      'authority-document-unreadable',
    ])
  })
})

// ---------------------------------------------------------------------------
// 6.A — the gate at the plugin wire: the THREE control points, the typed
// arms, and the wrong-path guard (plan §6.A / R7.6: a gate wired on
// `activation/checks.ts` or `admission/requirement-gate.ts` gates NOTHING).
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createS6RemotePorts, createS6RemoteDispatcher } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { REMOTE_CONTRACT_VERSION_V3 } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const S6_SOURCE = readFileSync(join(HERE, '..', 'src', 'plugin', 's6-remote.ts'), 'utf8')

const GATE_ROOT = 'root-session-a4p6-gate'

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('A4-PR6 gate guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

function gateService(outcome: {
  status: 'open' | 'warning-required' | 'corrupt' | 'migration-required'
  interventionId?: string
  reason?: string
}) {
  const calls: string[] = []
  const outcomeValue = ((): ReturnType<Gateway['checkStart']> extends Promise<infer T> ? T : never => {
    if (outcome.status === 'warning-required') {
      return { status: 'warning-required', interventionId: outcome.interventionId ?? 'int-warn-x', warningId: 'warn-x' } as never
    }
    if (outcome.status === 'corrupt') {
      return { status: 'corrupt', reason: outcome.reason ?? 'authority-document-corrupt' } as never
    }
    return { status: outcome.status } as never
  })()
  type Gateway = { checkStart(s: string): Promise<unknown> }
  const service = {
    checkStart: async () => {
      calls.push('start')
      return outcomeValue
    },
    checkEnsureRootLive: async () => {
      calls.push('live')
      return outcomeValue
    },
    observeRuntime: async () => {
      calls.push('observe')
    },
    acknowledge: async () => ({ kind: 'not-found' }) as never,
    listWarnings: async () => [] as never,
  }
  // `calls` rides the service object itself (the harness reads it back).
  return { service: Object.assign(service, { calls }), calls }
}

async function dispatchEnsure(
  service: ReturnType<typeof gateService>['service'] | undefined,
  ensure: (sid: string) => Promise<void>,
  calls: string[],
): Promise<{ response: RemoteResponse; ensured: string[]; gateCalls: string[] }> {
  void calls
  const ensured: string[] = []
  const noPrincipal: ServerPrincipalDerivation = () => {
    throw new Error('A4-PR6 gate guard: principal derivation must not run here')
  }
  const opts = {
    rootSessionId: GATE_ROOT,
    repositories: {
      teamSessions: { get: () => undefined },
    } as never,
    ensureRootLive: async (sid: string) => {
      ensured.push(sid)
      await ensure(sid)
    },
    ...(service === undefined ? {} : { governanceWarning: service }),
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  const response = await createS6RemoteDispatcher(ports, noPrincipal)('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: GATE_ROOT },
  })
  return { response, ensured, gateCalls: service === undefined ? [] : (service as { calls: string[] }).calls }
}

const GATE = await (async () => {
  const warning = gateService({ status: 'warning-required', interventionId: 'int-warn-abc' })
  const blocked = await dispatchEnsure(warning.service, async () => undefined, warning.calls)
  const openSvc = gateService({ status: 'open' })
  const open = await dispatchEnsure(openSvc.service, async () => undefined, openSvc.calls)
  const corruptSvc = gateService({ status: 'corrupt', reason: 'authority-document-unreadable' })
  const corrupt = await dispatchEnsure(corruptSvc.service, async () => undefined, corruptSvc.calls)
  const migrationSvc = gateService({ status: 'migration-required' })
  const migration = await dispatchEnsure(migrationSvc.service, async () => undefined, migrationSvc.calls)
  const absent = await dispatchEnsure(undefined, async () => undefined, [])
  return { blocked, open, corrupt, migration, absent }
})()

describe('6.A the gate on the wire (team.ensureRootLive re-entry path)', () => {
  it('warning-required: typed block, the live ensure is NEVER reached (root stays not-live)', () => {
    expect(GATE.blocked.response.ok).toBe(false)
    const error = errorOf(GATE.blocked.response)
    expect(error.code).toBe('TEAM_REMOTE_TEAM_START_GOVERNANCE_WARNING')
    expect(JSON.stringify(error)).toContain('int-warn-abc') // the pointer rides
    expect(GATE.blocked.ensured).toEqual([]) // zero agent effect
    expect(GATE.blocked.gateCalls).toEqual(['live']) // the SAME gate, via ensureRootLive
  })

  it('open: the gate runs FIRST, then the live ensure proceeds unchanged', async () => {
    expect(GATE.open.response.ok).toBe(true)
    expect(GATE.open.ensured).toEqual([GATE_ROOT])
    expect(GATE.open.gateCalls).toEqual(['live'])
  })

  it('corrupt: typed fail-closed, never acknowledgeable, live ensure never reached', () => {
    expect(GATE.corrupt.response.ok).toBe(false)
    expect(errorOf(GATE.corrupt.response).code).toBe('TEAM_REMOTE_TEAM_START_GOVERNANCE_CORRUPT')
    expect(GATE.corrupt.ensured).toEqual([])
  })

  it('migration-required: typed refusal (the PR7 arm exists and is closed)', () => {
    expect(GATE.migration.response.ok).toBe(false)
    expect(errorOf(GATE.migration.response).code).toBe('TEAM_REMOTE_TEAM_START_MIGRATION_REQUIRED')
    expect(GATE.migration.ensured).toEqual([])
  })

  it('a root without the governance port keeps today’s behavior (start ungated; disclosed)', () => {
    expect(GATE.absent.response.ok).toBe(true)
    expect(GATE.absent.ensured).toEqual([GATE_ROOT])
  })
})

describe('6.A the gate sits at the three WIRE control points (source law)', () => {
  it('BOTH team.create sites call the gate after the durable bind and BEFORE startRootAgent', () => {
    // A4-PR6 review round 1: the OCCURRENCE COUNT of `governanceStartGate(`
    // is retired — a count cannot see an entrance moving OUT of this file
    // (that is exactly how the handoff/boot starts slipped past it). The
    // whole-entrance law is now BEHAVIOURAL:
    // `a4p6-start-gate-entrances.test.ts` starts a Team through each real
    // entrance (wire create/ensure plus handoff/boot) and asserts the
    // typed refusal and zero start. What remains here is the ORDER leg
    // (the gate runs after the durable bind and before the start port).
    const starts = S6_SOURCE.split('await startRootAgent(requestedRootSessionId)')
    expect(starts.length - 1).toBe(2) // exactly the two create sites
    for (const [index, part] of starts.slice(0, -1).entries()) {
      expect(part, `create site ${index + 1}`).toContain(
        "governanceStartGate('team.create', requestedRootSessionId, 'create')",
      )
    }
  })

  it('the WRONG paths are guard-free: activation/checks and admission/requirement-gate reference neither the gate nor the warning lane', () => {
    // R7.6: a gate wired there looks right and gates nothing — this leg is
    // the reason the pin lives in THE TEST, not only in the plan.
    for (const relative of [
      join('activation', 'checks.ts'),
      join('admission', 'requirement-gate.ts'),
    ]) {
      const source = readFileSync(join(HERE, '..', relative), 'utf8')
      expect(source, `${relative}: must not reference the gate`).not.toContain('governanceStartGate')
      expect(source, `${relative}: must not import the warning lane`).not.toContain('governance-warning')
    }
  })

  it('the ensureRootLive gate runs AFTER the bound-root preflight (a foreign root is refused before governance is consulted)', async () => {
    const svc = gateService({ status: 'open' })
    const noPrincipal: ServerPrincipalDerivation = () => {
      throw new Error('guard')
    }
    const opts = {
      rootSessionId: GATE_ROOT,
      repositories: { teamSessions: { get: () => undefined } } as never,
      ensureRootLive: async () => undefined,
      governanceWarning: svc.service,
    } as unknown as S6RemoteOptions
    const ports = createS6RemotePorts(opts)
    const response = await createS6RemoteDispatcher(ports, noPrincipal)('team.ensureRootLive', {
      version: REMOTE_CONTRACT_VERSION_V3,
      params: { teamSessionId: 'root-session-elsewhere' },
    })
    expect(response.ok).toBe(false)
    expect(svc.calls).toEqual([]) // preflight first: governance never consulted
  })
})

// ---------------------------------------------------------------------------
// 6.C-first-half — the fact-hygiene TRIAD: the two warning fact types are the
// frozen VALUES, registered in the SAME commit at all THREE owners, with the
// `policy` CATEGORY pinned by value (a category string is part of the wire
// contract of the ledger; a silent re-home would move rows between client
// sections without a single type error).
// ---------------------------------------------------------------------------

const REPO_ROOT = join(HERE, '..', '..', '..')
const HOST_MAP = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'projection-source.ts'), 'utf8')
const CLIENT_MAP = readFileSync(join(REPO_ROOT, 'packages', 'client', 'src', 'model', 'ledger-adapter.ts'), 'utf8')
const INTERNAL_SET = readFileSync(join(REPO_ROOT, 'packages', 'client', 'src', 'model', 'team-ledger-model.ts'), 'utf8')

describe('6.C the fact-hygiene triad registers the warning family identically', () => {
  for (const factType of ['governance-warning-observed', 'governance-warning-acknowledged']) {
    it(`'${factType}': host map pins it to 'policy'`, () => {
      const re = new RegExp(`\\[FACT_GOVERNANCE_WARNING_${factType.endsWith('observed') ? 'OBSERVED' : 'ACKNOWLEDGED'},\\s*'policy'\\]`)
      expect(re.test(HOST_MAP), 'host FACT_TYPE_CATEGORY row').toBe(true)
      // and the mirrored constant carries the exact value (lane drift throws
      // the fold's CATEGORY_UNKNOWN, never a silent no-category row).
      expect(HOST_MAP).toContain(`= '${factType}'`)
    })

    it(`'${factType}': client category map mirrors 'policy' and the internal set hides it from generic rows`, () => {
      expect(new RegExp(`'${factType}':\\s*'policy'`).test(CLIENT_MAP), 'client map row').toBe(true)
      expect(INTERNAL_SET).toContain(`'${factType}'`)
    })
  }

  it('the triad is symmetric: every warning type registered client-side is registered host-side', () => {
    const clientTypes = [...CLIENT_MAP.matchAll(/'(governance-warning-[a-z-]+)':\s*'policy'/g)].map((m) => m[1])
    expect(clientTypes.sort()).toEqual([...GOVERNANCE_WARNING_FACT_TYPE_VALUES].sort())
  })
})

// ---------------------------------------------------------------------------
// 6.C second half — the TRIAD for the two remaining PR6 fact types. Their
// owner-3 registration is NOT the INTERNAL skip (the warning family above):
// `governance-proposal-recorded` and `control-escalation-recorded` are
// user-visible policy/control history, so their third owner is the
// STRUCTURED row family in the client ledger model (a `FACT_ROW_KIND` row +
// the closed row-kind union + a locale label). An unregistered type would
// fall to the `unknown` family and JSON-dump the payload — the renderer
// spec (`a4p6-interventions.client.spec.tsx`) proves the families render
// structured; this pin proves the registration itself, per OWNER, per file.
// ---------------------------------------------------------------------------

describe('6.C the triad registers proposal + escalation with structured owners', () => {
  const UI_MAP = readFileSync(
    join(REPO_ROOT, 'packages', 'client', 'src', 'ui', 'TeamLedger.tsx'),
    'utf8',
  )
  const LOCALES = readFileSync(
    join(REPO_ROOT, 'packages', 'client', 'src', 'ui', 'locales.ts'),
    'utf8',
  )
  const cases = [
    { factType: 'governance-proposal-recorded', constant: 'FACT_GOVERNANCE_PROPOSAL_RECORDED', category: 'policy', kind: 'governance-proposal', key: 'view.ledger.fact.governance_proposal' },
    { factType: 'control-escalation-recorded', constant: 'FACT_CONTROL_ESCALATION_RECORDED', category: 'control', kind: 'control-escalation', key: 'view.ledger.fact.control_escalation' },
  ] as const
  for (const { factType, constant, category, kind, key } of cases) {
    it(`'${factType}': host constant + host category row '${category}'`, () => {
      expect(HOST_MAP).toContain(`const ${constant} = '${factType}'`)
      expect(new RegExp(`\\[${constant},\\s*'${category}'\\]`).test(HOST_MAP), 'host map row').toBe(true)
    })
    it(`'${factType}': client category map mirrors '${category}'`, () => {
      expect(new RegExp(`'${factType}':\\s*'${category}'`).test(CLIENT_MAP), 'client map row').toBe(true)
    })
    it(`'${factType}': owner 3 — the STRUCTURED family, union, kind label (never the unknown serializer)`, () => {
      expect(new RegExp(`'${factType}':\\s*'${kind}'`).test(INTERNAL_SET), 'FACT_ROW_KIND row').toBe(true)
      expect(INTERNAL_SET).toContain(`| '${kind}'`)
      expect(UI_MAP).toContain(`'${kind}': '${key}'`)
      expect(LOCALES).toContain(`'${key}'`)
    })
  }

  it('the proposal completeness mirror equals the host strict reader RECORD_FIELDS (root-side drift pin)', () => {
    const store = readFileSync(
      join(REPO_ROOT, 'packages', 'runtime', 'governance', 'proposal-store.ts'),
      'utf8',
    )
    const recordBlock = /const RECORD_FIELDS = \[[\s\S]*?\]/.exec(store)?.[0] ?? ''
    const hostFields = [...recordBlock.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
    expect(hostFields.length).toBeGreaterThan(0)
    const modelSrc = INTERNAL_SET
    const mirrorBlock = /const GOVERNANCE_PROPOSAL_RECORD_FIELDS: readonly string\[\] = \[[\s\S]*?\]/.exec(modelSrc)?.[0] ?? ''
    const mirror = [...mirrorBlock.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
    expect([...mirror].sort()).toEqual([...hostFields].sort())
  })
})
