import { describe, it, expect } from 'vitest'
import { computeAc1BuiltinToolDeny } from '../../../dev/agent-workflow/evidence/u7-ac1-subagents-port-20261027/c2/ac1-assembly.mjs'

describe('AC-1 C1 fixture permission coverage', () => {
  it('denies unmanaged host tools including the reserved run_code PTC transport', () => {
    const surface = ['read', 'team_create_member', 'subagent', 'subagent_fork', 'todo_write', 'run_code', 'cordis_inspect_list']
    expect(computeAc1BuiltinToolDeny(surface)).toEqual(['run_code', 'cordis_inspect_list'])
  })

  it('keeps Team tools, agent-control family tools, and safe todo_write out of builtinToolDeny', () => {
    const surface = ['team_create_member', 'subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow', 'todo_write']
    expect(computeAc1BuiltinToolDeny(surface)).toEqual([])
  })
})
