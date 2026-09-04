/**
 * Member command model (P9-T7, UI §40 / §23, plan S5-B, Gate P9-G5): the
 * §40 action matrix (the commands allowed per lifecycle), the per-lifecycle
 * label tokens (Send work vs Message; Follow-up vs Resume), the frozen
 * Remote param builders (the human caller invariant, the create payload
 * fields, the follow-up prompt channel, the lifecycle pair), the verbatim
 * typed-outcome parser (the remote typed result preserved, never reworded),
 * and the local request-token generator.
 *
 * Legacy spec evidence: NEW module (the legacy fork has no vNext member
 * command object model — vNext has no Team SessionEvents and the commands
 * ride the frozen Remote wire); no legacy test to migrate or drop.
 */
import { describe, expect, it } from 'vitest'
import type { RemoteResponse } from '../../remote/src/index.js'
import {
  buildMemberCreateParams,
  buildMemberFollowupParams,
  buildMemberLifecycleParams,
  buildMemberSendParams,
  createRequestTokenGenerator,
  humanCaller,
  memberActionLabel,
  memberActionsForLifecycle,
  parseMemberCommandOutcome,
} from '../src/model/team-member-commands.js'

function successResponse(): RemoteResponse {
  return {
    ok: true,
    value: {
      data: { instanceId: 'inst-1' },
      provenance: {
        origin: 'team-remote',
        method: 'member.followup',
        endpoint: 'member.followup',
        contractVersion: 1,
        requestToken: 'tok-1',
        projectionGeneration: null,
        effectSequence: 7,
      },
    },
  }
}

function errorResponse(code: string, message: string, requestToken: string | null): RemoteResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      details: {
        method: 'member.followup',
        endpoint: 'member.followup',
        contractVersion: 1,
        requestToken,
      },
    },
  }
}

describe('memberActionsForLifecycle', () => {
  it('implements the UI §40 matrix: the live states take the work/message/lifecycle commands, ARCHIVED only restore/dispose, DISPOSED none', () => {
    expect(memberActionsForLifecycle('CREATED')).toEqual(['send', 'followup', 'archive', 'dispose'])
    expect(memberActionsForLifecycle('RUNNING')).toEqual(['send', 'followup', 'archive', 'dispose'])
    expect(memberActionsForLifecycle('SETTLED')).toEqual(['send', 'followup', 'archive', 'dispose'])
    expect(memberActionsForLifecycle('ARCHIVED')).toEqual(['restore', 'dispose'])
    expect(memberActionsForLifecycle('DISPOSED')).toEqual([])
  })
})

describe('memberActionLabel', () => {
  it('labels the per-lifecycle row actions (Send work / Message; Follow-up / Resume)', () => {
    expect(memberActionLabel('send', 'CREATED')).toBe('sendWork')
    expect(memberActionLabel('send', 'RUNNING')).toBe('message')
    expect(memberActionLabel('send', 'SETTLED')).toBe('message')
    expect(memberActionLabel('followup', 'CREATED')).toBe('followup')
    expect(memberActionLabel('followup', 'RUNNING')).toBe('followup')
    expect(memberActionLabel('followup', 'SETTLED')).toBe('resume')
    expect(memberActionLabel('archive', 'CREATED')).toBe('archive')
    expect(memberActionLabel('restore', 'ARCHIVED')).toBe('restore')
    expect(memberActionLabel('dispose', 'CREATED')).toBe('dispose')
  })
})

describe('humanCaller', () => {
  it('is the human caller with the TeamSession id as humanId (invariant 9: the root DSH session id)', () => {
    expect(humanCaller('team-root')).toEqual({ kind: 'human', humanId: 'team-root' })
  })
})

describe('buildMemberCreateParams', () => {
  it('carries the template delegation, the token, and the host-consumed payload (label always; group/workspace when given)', () => {
    expect(buildMemberCreateParams({
      teamSessionId: 'team-root',
      templateId: 'tpl-a',
      requestToken: 'create-1',
      label: 'Alpha 2',
      groupId: 'grp-1',
      workspace: 'D:/work/side',
    })).toEqual({
      teamSessionId: 'team-root',
      caller: { kind: 'human', humanId: 'team-root' },
      requestToken: 'create-1',
      delegationTemplateId: 'tpl-a',
      payload: { label: 'Alpha 2', groupId: 'grp-1', workspace: 'D:/work/side' },
    })
  })

  it('omits the optional payload fields when the dialog leaves them blank', () => {
    expect(buildMemberCreateParams({
      teamSessionId: 'team-root',
      templateId: 'tpl-a',
      requestToken: 'create-2',
      label: 'Beta',
    }).payload).toEqual({ label: 'Beta' })
  })
})

describe('buildMemberFollowupParams', () => {
  it('rides the prompt on payload.prompt (the host-admission channel) with the target instance and token', () => {
    expect(buildMemberFollowupParams({
      teamSessionId: 'team-root',
      targetInstanceId: 'inst-9',
      requestToken: 'followup-1',
      prompt: 'continue with the review',
    })).toEqual({
      teamSessionId: 'team-root',
      caller: { kind: 'human', humanId: 'team-root' },
      targetInstanceId: 'inst-9',
      requestToken: 'followup-1',
      payload: { prompt: 'continue with the review' },
    })
  })
})

describe('buildMemberSendParams', () => {
  it('carries the body to the member Chat and includes the subject only when given', () => {
    const withoutSubject = buildMemberSendParams({
      teamSessionId: 'team-root',
      recipientInstanceId: 'inst-9',
      requestToken: 'send-1',
      body: 'status check',
    })
    expect(withoutSubject).toEqual({
      teamSessionId: 'team-root',
      caller: { kind: 'human', humanId: 'team-root' },
      recipientInstanceId: 'inst-9',
      body: 'status check',
      requestToken: 'send-1',
    })
    expect('subject' in withoutSubject).toBe(false)
    expect(buildMemberSendParams({
      teamSessionId: 'team-root',
      recipientInstanceId: 'inst-9',
      requestToken: 'send-2',
      body: 'status check',
      subject: 'sync',
    }).subject).toBe('sync')
  })
})

describe('buildMemberLifecycleParams', () => {
  it('is the frozen lifecycle pair (no token, no payload)', () => {
    expect(buildMemberLifecycleParams('team-root', 'inst-9')).toEqual({
      teamSessionId: 'team-root',
      instanceId: 'inst-9',
    })
  })
})

describe('parseMemberCommandOutcome', () => {
  it('maps a success to the plain ok outcome (no optimistic state — the projection pull follows)', () => {
    expect(parseMemberCommandOutcome(successResponse())).toEqual({ ok: true })
  })

  it('preserves the remote typed error verbatim, including the host-stamped token echo', () => {
    expect(parseMemberCommandOutcome(errorResponse('MEMBER_ADMISSION_REJECTED', 'the template is full', 'send-7'))).toEqual({
      ok: false,
      code: 'MEMBER_ADMISSION_REJECTED',
      message: 'the template is full',
      requestToken: 'send-7',
    })
    const noToken = parseMemberCommandOutcome(errorResponse('MEMBER_NOT_FOUND', 'no such instance', null))
    if (noToken.ok) throw new Error('expected the typed error outcome')
    expect(noToken.requestToken).toEqual(null)
  })
})

describe('createRequestTokenGenerator', () => {
  it('yields fresh `prefix-n` tokens per call, independent per generator', () => {
    const next = createRequestTokenGenerator('send')
    expect(next()).toBe('send-1')
    expect(next()).toBe('send-2')
    const other = createRequestTokenGenerator('archive')
    expect(other()).toBe('archive-1')
    expect(next()).toBe('send-3')
  })
})
