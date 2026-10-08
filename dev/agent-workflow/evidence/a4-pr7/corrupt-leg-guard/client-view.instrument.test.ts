/**
 * EVIDENCE INSTRUMENT (not a lane spec) — the CLIENT half of the A4 corrupt-leg
 * finding, measured rather than described.
 *
 * WHY THIS FILE LIVES HERE AND NOT IN `packages/client/test`: the client lane
 * owns its files and its census entries, and this lane was told (coordinator,
 * 2026-10-08) to measure the client surface without touching it. So the
 * instrument sits with the rest of the evidence and is run explicitly:
 *
 *   npx vitest run --config scratch/vitest.evidence.config.ts
 *
 * WHAT IT ESTABLISHES. The guard plane and the client plane apply TWO
 * INDEPENDENT parse policies to the same `control-request-recorded` row:
 *
 *  - `packages/runtime/control/service.ts` `parseRequestPayload` is STRICT: a
 *    row whose `authorityScope` is present and malformed is refused wholesale
 *    (base `606a0be7`: the guard then saw `no-request`, which the tool plane
 *    reads as "proceed" — the indictment in `RED-base-transcript.log`).
 *  - `packages/client/src/model/ledger-adapter.ts` `adaptControlRequestDraft`
 *    drops a row ONLY when `requestId` / `actionName` are broken (its own
 *    comment). `grep authorityScope packages/client/src` = ZERO hits: the client
 *    never reads the authority point at all.
 *
 * So the compound failure is NOT "the operator sees nothing" — it is the
 * inverse: THE OPERATOR SEES A NORMAL, DECIDABLE APPROVAL for a case the
 * enforcement plane cannot read, and any decision they record lands on a row
 * the guard will never match (zero consumption). Two policies, one fact,
 * guaranteed disagreement. That is a SEPARATE finding for the client lane
 * (backlog item 14); nothing in the guard fix changes it, and this instrument
 * will keep reporting it until that lane owns it.
 */

import { describe, expect, it } from 'vitest'
import { adaptTeamLedger } from '../../../../../packages/client/src/model/ledger-adapter.js'

const ROOT = 'session-root-a4cl-instrument'
const NOW = '2026-10-08T00:00:00.000Z'
const CASE_ID = 'case-a4cl-instrument'

function entry(
  sequence: number,
  factType: string,
  payload: Record<string, unknown>,
): Parameters<typeof adaptTeamLedger>[0][number] {
  return {
    schemaVersion: 2,
    sequence,
    rootSessionId: ROOT,
    factType,
    payload,
    createdAt: NOW,
  } as Parameters<typeof adaptTeamLedger>[0][number]
}

/** The row `parseRequestPayload` refuses: an operation case whose authority
 *  point is PRESENT and MALFORMED (`matcher.kind: 'subtree'` is not in
 *  `CONTROL_AUTHORITY_MATCHER_KINDS`, which knows only `exact` and
 *  `fingerprint`). */
const corruptRequestPayload: Record<string, unknown> = {
  requestId: 'req-a4cl-instrument',
  kind: 'leader-approval',
  requester: { kind: 'instance', instanceId: 'inst-worker', role: 'member' },
  subject: { kind: 'instance', instanceId: 'inst-worker' },
  targetInstanceId: 'inst-worker',
  actionName: 'write-file',
  toolName: 'write',
  correlation: 'corr-a4cl-instrument',
  operationFingerprint: 'fp-a4cl-instrument',
  executionCoupling: 'guarded',
  approvalCaseId: CASE_ID,
  legOrdinal: 1,
  reviewAuthority: 'leader',
  beneficiaryAuthority: 'member',
  requestedEffect: 'allow',
  authorityScope: {
    operationClass: 'write',
    matcher: { kind: 'subtree', resource: 'file:///a4cl.txt' },
  },
}

describe('A4 corrupt leg — the client view (evidence instrument, client lane owns the fix)', () => {
  it('renders the row the guard refuses as a normal pending approval the operator can decide', () => {
    const model = adaptTeamLedger([entry(1, 'control-request-recorded', corruptRequestPayload)], true)
    // The client keeps the row. This is the whole asymmetry in one assertion:
    // strict reader → no request; UI reader → a live approval chain.
    expect(model.controls.length).toBe(1)
    const chain = model.controls[0]
    expect(chain?.requestId).toBe('req-a4cl-instrument')
    // It is presented as an actionable chain, not as a corrupt/unknown row.
    expect(chain?.renderMode).toBeDefined()
    expect(chain?.correlation).toBe('corr-a4cl-instrument')
    // MEASURED, and part of the finding: the UI chain carries NO case identity.
    // `grep -rn approvalCaseId packages/client/src` = zero hits, so the operator
    // decides a row while the view never surfaces the approval case the guard
    // plane keys everything on (`CASE_ID` above is simply not representable).
    expect(Object.keys(chain ?? {}).includes('approvalCaseId')).toBe(false)
    // And it is COUNTED as pending work for the instance — the operator is
    // invited to decide it.
    expect(model.pendingControlByInstance['inst-worker']).toBe(1)
  })

  it('still renders it after a decision the enforcement plane will never match', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'control-request-recorded', corruptRequestPayload),
        entry(2, 'control-decision-recorded', {
          requestId: 'req-a4cl-instrument',
          decision: 'allow',
          decider: { kind: 'instance', instanceId: 'inst-leader', role: 'leader' },
          requestSequence: 1,
          scope: {
            rootSessionId: ROOT,
            subject: { kind: 'instance', instanceId: 'inst-worker' },
            targetInstanceId: 'inst-worker',
            actionName: 'write-file',
            toolName: 'write',
            correlation: 'corr-a4cl-instrument',
          },
        }),
      ],
      true,
    )
    const chain = model.controls[0]
    // The chain pairs with its decision and clears the pending count: from the
    // operator's side the approval was granted and is settled. On the guard side
    // (measured in packages/tools/test/a4-corrupt-leg-guard.test.ts) the same
    // ledger yields ZERO consumptions — the allow is unspendable.
    expect(chain?.requestId).toBe('req-a4cl-instrument')
    expect(model.controls.length).toBe(1)
    expect(model.pendingControlByInstance['inst-worker'] ?? 0).toBe(0)
  })
})
