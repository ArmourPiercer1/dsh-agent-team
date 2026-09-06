import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_SOURCES,
  activationOperationIdentity,
  allocateActivationInstanceId,
} from '../activation/index.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import { createTeamTools } from '../../tools/src/index.js'
import type { TeamToolsOptions } from '../../tools/src/index.js'

const ROOT = 'session-d5-root'

function toolOptions(): TeamToolsOptions {
  return {
    teamRuntime: undefined,
    controlService: undefined,
    messaging: undefined,
    activity: undefined,
    resolveCaller: undefined,
  } as unknown as TeamToolsOptions
}

describe('D5 activation instance contract', () => {
  it('replays the same request token to the same instance identity', () => {
    const first = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-replay')
    const second = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-replay')
    expect(second).toEqual(first)
  })

  it('allocates distinct instances for distinct request tokens', () => {
    const first = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-a')
    const second = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-b')
    expect(first).not.toBe(second)
  })

  it('keeps same-template parallel operations collision-free', () => {
    const ids = ['d5-p1', 'd5-p2', 'd5-p3'].map((token) =>
      allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.HUMAN_UI, token),
    )
    expect(new Set(ids).size).toBe(3)
  })

  it('reserves inst-leader for the team leader', () => {
    const allocated = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.HUMAN_UI, 'd5-leader-guard')
    expect(allocated).not.toBe(LEADER_INSTANCE_ID)
    expect(LEADER_INSTANCE_ID).toBe('inst-leader')
  })

  it('rejects caller-controlled instanceId as an unknown create-member field', () => {
    const createMember = createTeamTools(toolOptions()).tools.find((tool) => tool.name === 'team_create_member')
    if (createMember === undefined) throw new Error('team_create_member tool missing')
    expect(Object.prototype.hasOwnProperty.call(createMember.parameters.properties, 'instanceId')).toBe(false)
    expect(createMember.parameters.additionalProperties).toBe(false)
  })
})
