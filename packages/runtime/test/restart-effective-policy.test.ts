/**
 * pre-alpha3 PR-B — RESTART EFFECTIVE-POLICY (plan §B.3, key assertion 5):
 * after a process restart (a NEW storage seam + a NEW TeamDomain over the
 * SAME durable dir), a fresh canonical read over the RE-READ durable facts
 * (the durable governance overrides + the durable PolicyState ledger rows,
 * re-read through the production read source) derives the SAME effective
 * policy — there is NO process-local policy truth. The durable facts (the
 * committed governance override + the committed PolicyState transition)
 * are the only source, and a fresh process re-derives the identical
 * backend truth from them:
 *
 * - the committed human override (model value) survives the restart and
 *   still wins the model cell at the highest precedence;
 * - the committed PolicyState transition (mcp value cell) survives the
 *   restart and still pins the mcp cell at the policyState layer;
 * - the restarted read's model + mcp cells are BYTE-IDENTICAL to the
 *   pre-restart read's (no process-local state leaked in).
 *
 * The static-facts authority (the synthetic {@link PolicyReader}) is the
 * same fixed bound-snapshot reader in both processes; the point is that the
 * DURABLE facts are re-read (never carried over in-process) and re-derive
 * the same policy. The runner executes this file under plain Node: all
 * async work runs in the top-level block (one scratch world, destroyed
 * before the first assertion); the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/restart-effective-policy
 */

import { describe, expect, it } from 'vitest'
import {
  createTeamDomain,
  openTeamDomain,
} from '../../storage/repositories/index.js'
import { teamSessionInput } from '../../storage/test/p4-helpers.js'
import { FileStorageSeam, destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import {
  listDurablePolicyStateTransitions,
  writePolicyStateTransitionRow,
} from '../src/plugin/durable-mutation-store.js'
import { readEffectivePolicy } from '../effective-policy/index.js'
import type { PolicyReader, PolicyStateTransitionRecord } from '../mutation/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-ep-restart'
const INSTANCE = 'inst-epr'
const NOW = '2026-09-29T00:00:00.000Z'
const now = () => NOW

const BASELINE_MODEL = 'prov/model-bp'
const BASELINE_MCP = 'srv/bp'
const OVERRIDE_MODEL = 'prov/model-ovr'
const STATE_MCP = 'srv/state'

/**
 * The static-facts authority (the same fixed bound-snapshot reader in both
 * processes): the blueprint grants the model/mcp baseline (the LOWEST value
 * layer); the template grants ONLY `tools` (it does not speak to model/mcp,
 * so it never shadows the committed policyState mcp value cell — the frozen
 * layer order is `blueprint < policyState < template`). The committed human
 * override (the highest precedence layer) decides the model; the committed
 * PolicyState mcp value cell beats the blueprint mcp baseline.
 */
function makeReader(): PolicyReader {
  return {
    readBlueprintEnvelope: () => ({
      values: {
        model: { kind: 'allow', items: [BASELINE_MODEL] },
        mcp: { kind: 'allow', items: [BASELINE_MCP] },
      },
    }),
    readTemplatePolicy: () => ({
      values: { tools: { kind: 'allow', items: ['tool-x'] } },
    }),
    readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
  }
}

// The committed governance intent: a team-scope human override pinning the
// model (the highest precedence layer) — durable, written before the read.
const overrideRecord = {
  schemaVersion: 2,
  recordId: 'ovr-model-team-g1',
  rootSessionId: ROOT,
  scope: 'team',
  kind: 'human-override',
  generation: 1,
  values: { model: { kind: 'allow', items: [OVERRIDE_MODEL] } },
  updatedAt: NOW,
}
// The committed PolicyState transition: an mcp value cell (no model cell,
// so the override — not the state — decides the model).
const transition: PolicyStateTransitionRecord = {
  entryId: 'ps-strict-0',
  origin: 'human',
  state: {
    stateId: 'strict',
    cells: { mcp: { value: { kind: 'allow', items: [STATE_MCP] } as PolicyEntry } },
  },
  requestedAtStep: 0,
  effectiveFromStep: 1,
}

// --- PROCESS 1: create the durable facts + the pre-restart read -------------
const dir = scratchDir('ep-restart')
destroyDir(dir) // self-cleaning: a crashed prior run may leave a domain behind
const seam1 = new FileStorageSeam(dir)
const domain1 = await createTeamDomain(seam1)
// The durable ledger put advances the TeamSession generation stamp — the
// team row must exist (facts belong to an existing team).
await domain1.repositories.teamSessions.put(teamSessionInput(ROOT as Parameters<typeof teamSessionInput>[0]))
await domain1.repositories.overrides.put(overrideRecord)
await writePolicyStateTransitionRow(domain1.repositories.ledger, ROOT, transition, now)
const readPreRestart = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: makeReader(),
  transitions: listDurablePolicyStateTransitions(domain1.repositories, ROOT),
  overrides: domain1.repositories.overrides.list(ROOT),
})

// --- PROCESS 2 (RESTART): a NEW seam + a NEW domain over the SAME dir -------
// A fresh process carries NO process-local policy state — it re-reads the
// durable facts through the production read source and re-derives the policy.
const seam2 = new FileStorageSeam(dir)
const domain2 = await openTeamDomain(seam2)
const readPostRestart = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: makeReader(),
  transitions: listDurablePolicyStateTransitions(domain2.repositories, ROOT),
  overrides: domain2.repositories.overrides.list(ROOT),
})

destroyDir(dir)

describe('PR-B restart effective-policy — no process-local policy truth', () => {
  it('the pre-restart read resolves the committed override (model) + transition (mcp)', () => {
    expect(readPreRestart.policyState.stateId).toBe('strict')
    // The committed human override wins the model cell (highest precedence).
    expect(readPreRestart.policy.cells['model'].effective).toEqual({
      kind: 'allow',
      items: [OVERRIDE_MODEL],
    })
    expect(readPreRestart.policy.cells['model'].team.layer).toBe('humanOverride')
    // The committed PolicyState transition pins the mcp cell.
    expect(readPreRestart.policy.cells['mcp'].effective).toEqual({ kind: 'allow', items: [STATE_MCP] })
    expect(readPreRestart.policy.cells['mcp'].team.layer).toBe('policyState')
  })

  it('the restarted read re-derives the SAME effective policy from the re-read durable facts (byte-identical cells)', () => {
    // The committed state is restored through the durable ledger re-read.
    expect(readPostRestart.policyState.stateId).toBe(readPreRestart.policyState.stateId)
    // The model + mcp cells are byte-identical across the restart — the
    // durable facts are the only source, no process-local truth leaked in.
    expect(readPostRestart.policy.cells['model'].effective).toEqual(
      readPreRestart.policy.cells['model'].effective,
    )
    expect(readPostRestart.policy.cells['model'].team.layer).toBe(readPreRestart.policy.cells['model'].team.layer)
    expect(readPostRestart.policy.cells['mcp'].effective).toEqual(
      readPreRestart.policy.cells['mcp'].effective,
    )
    expect(readPostRestart.policy.cells['mcp'].team.layer).toBe(readPreRestart.policy.cells['mcp'].team.layer)
    // The committed override is re-read identically (the durable record is
    // the source of truth — the same recordId / generation / values).
    const preOverride = readPreRestart.humanOverride
    const postOverride = readPostRestart.humanOverride
    expect(preOverride).not.toBeUndefined()
    expect(postOverride).not.toBeUndefined()
    if (preOverride === undefined || postOverride === undefined) throw new Error('no human override')
    expect(postOverride.overrideId).toBe(preOverride.overrideId)
    expect(postOverride.values).toEqual(preOverride.values)
  })
})
