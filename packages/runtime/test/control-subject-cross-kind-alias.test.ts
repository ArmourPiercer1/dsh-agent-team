/**
 * control-subject-cross-kind-alias.test.ts — pre-alpha3 PR-D review B1:
 * the request idempotency scope key must be DISJOINT across subject kinds.
 *
 * The scope key's second element is the KIND-PREFIXED subject identity
 * (`instance:<id>` / `template:<id>` / `team:<rootSessionId>`). Without
 * the kind prefix, a template id and an instance id that are EQUAL
 * STRINGS — a value like `inst-abc` is BOTH a legal instance id
 * (`inst-<1..32 lowercase alphanumerics>`) AND a legal template slug
 * (a lowercase slug) — would ALIAS: with otherwise identical scope
 * fields, a template request would recompute the SAME key as an instance
 * request and return the EXISTING instance row instead of creating its
 * own (created: false, same requestId).
 *
 * Under test (the reviewer's exact case): with instanceId === templateId
 * === 'inst-abc' and the SAME actionName/toolName/correlation, the
 * instance and template requests create DISTINCT request rows (both
 * created — two durable rows, distinct requestIds) and each remains
 * idempotent under its OWN retries (same-kind idempotency is preserved —
 * the behavioral backward-compatibility guarantee of the kind prefix).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  LEADER_INSTANCE_ID,
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import {
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import {
  createP6T1World,
  destroyP6T1World,
} from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  controlFacts,
  createP6T4Service,
  leaderCaller,
} from './p6t4-helpers.js'

// The one id that is BOTH a legal instance id AND a legal template slug:
// 'inst-abc' matches INSTANCE_ID_PATTERN (inst-<alphanumerics>) and
// TEMPLATE_ID_PATTERN (a lowercase slug). This is the aliasing case.
const ALIAS_ID = 'inst-abc'

// A minimal blueprint whose ONE member template's templateId is the alias
// id, so a template subject {kind:'template', templateId:'inst-abc'} is a
// KNOWN template (the request-time membership check passes). The team
// envelope carries request-control + resolve-control (the leader caller
// below needs request-control; no envelope ever masks the aliasing).
const ALIAS_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: B1-ALIAS-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the alias team.',
  'members:',
  '  - templateId: inst-abc',
  '    displayName: Alias Member',
  '    persona: You are the alias member.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  'teamEnvelope:',
  '  allow:',
  '    - request-control',
  '    - resolve-control',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: inst-abc',
  '    envelope:',
  '      allow:',
  '        - request-control',
  '      deny: []',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

let s1: {
  readonly instanceRequestId: string
  readonly instanceRetryRequestId: string
  readonly templateRequestId: string
  readonly templateRetryRequestId: string
  readonly requestFacts: number
  readonly instanceSubject: unknown
  readonly templateSubject: unknown
}
{
  const world = await createP6T1World('ctl-b1-alias', {
    blueprintSource: ALIAS_BLUEPRINT_SOURCE,
    seedMembers: [
      {
        instanceId: parseInstanceId(String(LEADER_INSTANCE_ID)),
        templateId: parseTemplateId('leader'),
        label: 'leader',
        childSessionId: parseChildSessionId('session-child-b1-leader'),
        lifecycle: 'RUNNING',
      },
      {
        // The alias member: its instanceId equals the alias templateId.
        instanceId: parseInstanceId(ALIAS_ID),
        templateId: parseTemplateId(ALIAS_ID),
        label: 'alias-member',
        childSessionId: parseChildSessionId('session-child-b1-alias'),
        lifecycle: 'RUNNING',
      },
    ],
  })
  try {
    const service = createP6T4Service(world)
    const common = {
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-b1-alias',
    }
    // The instance request (id ALIAS_ID).
    const instanceRequest = await service.requestControl({
      ...common,
      subject: { kind: 'instance' as const, instanceId: ALIAS_ID },
    })
    // An instance RETRY (same subject) is idempotent — same requestId.
    const instanceRetry = await service.requestControl({
      ...common,
      subject: { kind: 'instance' as const, instanceId: ALIAS_ID },
    })
    // The template request (SAME id, SAME action/tool/correlation).
    const templateRequest = await service.requestControl({
      ...common,
      subject: { kind: 'template' as const, templateId: ALIAS_ID },
    })
    // A template RETRY (same subject) is idempotent — same requestId.
    const templateRetry = await service.requestControl({
      ...common,
      subject: { kind: 'template' as const, templateId: ALIAS_ID },
    })
    const state = await service.listControlState(P6T4_ROOT)
    const instanceRecord = state.requests.find(
      (r) => r.requestId === instanceRequest.requestId,
    )
    const templateRecord = state.requests.find(
      (r) => r.requestId === templateRequest.requestId,
    )
    s1 = {
      instanceRequestId: instanceRequest.requestId,
      instanceRetryRequestId: instanceRetry.requestId,
      templateRequestId: templateRequest.requestId,
      templateRetryRequestId: templateRetry.requestId,
      requestFacts: controlFacts(world, 'control-request-recorded').length,
      instanceSubject: instanceRecord?.subject,
      templateSubject: templateRecord?.subject,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('control: cross-kind request-key aliasing (pre-alpha3 PR-D review B1)', () => {
  it('S1 (KEY): an instance request and a template request with the SAME id create DISTINCT request rows (no cross-kind aliasing)', () => {
    // The two kinds must NOT alias: distinct requestIds.
    expect(s1.instanceRequestId).not.toBe(s1.templateRequestId)
    // Two DISTINCT durable request rows were written (both created:true —
    // the template request did not return the existing instance row).
    expect(s1.requestFacts).toBe(2)
    // Each row carries its own closed kind-prefixed subject identity.
    expect(s1.instanceSubject).toEqual({ kind: 'instance', instanceId: ALIAS_ID })
    expect(s1.templateSubject).toEqual({ kind: 'template', templateId: ALIAS_ID })
  })

  it('S2 (backward compat): same-kind retries stay idempotent (instance↔instance, template↔template)', () => {
    // The kind prefix changed the literal key but NOT same-kind
    // idempotency: a retry of the same kind returns its own row.
    expect(s1.instanceRetryRequestId).toBe(s1.instanceRequestId)
    expect(s1.templateRetryRequestId).toBe(s1.templateRequestId)
  })
})
