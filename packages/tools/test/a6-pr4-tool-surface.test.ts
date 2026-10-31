/**
 * Alpha.6 PR4′ (Lane 2) — the model-facing half of the defer plane: what the sixteenth tool is, when it
 * exists, and what it promises the model.
 *
 * Three groups, in the order the mistakes would be made:
 *
 *  - **Registration.** The tool exists exactly when its injected port does. The factory is the gate, not the
 *    mount filter: a selective-mode capability list can hide a tool from an agent, but a legacy-mode team
 *    mounts the whole catalog, so a spec that was merely *added* to the list would arrive on every existing
 *    Team with no governance decision behind it.
 *  - **The common contract.** The new definition satisfies the same invariants every other team tool is held
 *    to (`SD-TOKEN`), because a new entry that skips them is a hole in a rule the whole surface relies on.
 *  - **The description as an interface.** The constraints a model cannot learn from a result — that a quiet
 *    holds the notification and not the decision, that the request stays pending, that a restart clears the
 *    quiet — belong in the definition; the pairing of parameters belongs on the parameters; and the whole
 *    thing costs tokens on every turn, so its size is pinned rather than hoped about.
 */

import { describe, expect, it } from 'vitest'

import { createTeamTools } from '../src/tools.js'
import type { TeamToolsOptions, TeamReviewDeferPort, TeamReviewDeferOutcome, TeamReviewDeferEntry } from '../src/types.js'

/** The scan-only harness the tool census uses: no runtime, no control service, no caller resolution. */
function toolSet(withPort: boolean): ReturnType<typeof createTeamTools>['tools'] {
  const port: TeamReviewDeferPort = {
    set: (): TeamReviewDeferOutcome => ({ ok: false, refusal: 'REVIEW_DEFER_TEST_STUB', detail: 'stub' }),
    cancel: (): TeamReviewDeferOutcome => ({ ok: false, refusal: 'REVIEW_DEFER_TEST_STUB', detail: 'stub' }),
    list: (): readonly TeamReviewDeferEntry[] => [],
  }
  const options = {
    teamRuntime: undefined,
    controlService: undefined,
    messaging: undefined,
    activity: undefined,
    resolveCaller: undefined,
    ...(withPort ? { reviewDefer: port } : {}),
  } as unknown as TeamToolsOptions
  return createTeamTools(options).tools
}

/** The sanctioned namespace, as pinned by `packages/tools/test/p6t6-bypass-scan.test.ts`. */
const SANCTIONED_FIFTEEN = [
  'team_archive_member',
  'team_collect',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_grant_permission',
  'team_inspect_config',
  'team_list_members',
  'team_list_pending_control',
  'team_list_templates',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_revoke_permission',
  'team_send_message',
]

describe('A6-PR4/T — the sixteenth tool exists exactly when the plane does', () => {
  it('is absent from the default surface, which is what every team without the flag sees', () => {
    const names = toolSet(false).map((tool) => tool.name).sort()
    expect(names).toEqual([...SANCTIONED_FIFTEEN].sort())
    expect(names).not.toContain('team_review_defer')
  })

  it('appears, alone, when the port is injected', () => {
    const off = toolSet(false).map((tool) => tool.name)
    const on = toolSet(true).map((tool) => tool.name)
    expect(on).toHaveLength(off.length + 1)
    expect(on.filter((name) => !off.includes(name))).toEqual(['team_review_defer'])
  })
})

describe('A6-PR4/T — the new definition satisfies the rules the whole surface is held to', () => {
  const tool = toolSet(true).find((candidate) => candidate.name === 'team_review_defer')

  it('carries the SD-TOKEN shape every other team tool carries', () => {
    expect(tool).toBeDefined()
    if (tool === undefined) return
    const properties = tool.parameters.properties as Record<string, unknown>
    expect(tool.parameters.type).toBe('object')
    expect(tool.parameters.additionalProperties).toBe(false)
    expect(tool.parameters.required.includes('rootSessionId')).toBe(true)
    expect(tool.parameters.required.includes('requestToken')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(properties, 'rootSessionId')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(properties, 'requestToken')).toBe(true)
    expect(typeof tool.execute).toBe('function')
    expect(typeof tool.output.render).toBe('function')
    expect(tool.output.schema.type).toBe('object')
  })

  it('closes the two vocabularies a model could otherwise improvise on', () => {
    if (tool === undefined) return
    const properties = tool.parameters.properties as Record<string, { enum?: string[]; type?: string }>
    expect(properties.action?.enum).toEqual(['set', 'lift', 'list'])
    expect(properties.reason?.enum).toEqual([
      'PLAN_NOT_IN_FORCE',
      'OFFICER_UNAVAILABLE',
      'AWAITING_EVIDENCE',
      'LEADER_REQUESTED',
    ])
    // The leg ordinal is a positive integer, and the schema says so rather than leaving it to the lane: a
    // model that gets `0` back has learned nothing it could not have been told.
    expect(properties.legOrdinal?.type).toBe('integer')
  })
})

describe('A6-PR4/T — the description is an interface, and it costs tokens on every turn', () => {
  const tool = toolSet(true).find((candidate) => candidate.name === 'team_review_defer')

  it('says the facts a model cannot learn from a result, once each', () => {
    if (tool === undefined) return
    // The three non-obvious facts: a quiet holds the notification and never the decision; the request stays
    // where it can still be answered; and the quiet does not outlive the process.
    expect(tool.description).toContain('never the decision')
    expect(tool.description).toContain('stays pending')
    expect(tool.description).toContain('does not survive a restart')
    // Each fact once: a repetition is not emphasis, it is two sentences that will disagree after an edit.
    expect(tool.description.split('stays pending')).toHaveLength(2)
    // Parameter pairing lives on the parameters, so the description does not carry a second copy that can
    // drift away from the schema.
    expect(tool.description).not.toMatch(/needs approvalCaseId/)
    const properties = tool.parameters.properties as Record<string, { description?: string }>
    expect(properties.approvalCaseId?.description).toContain('"set" and "lift"')
    expect(properties.notBeforeIso?.description).toContain('"set" only')
    expect(properties.reason?.description).toContain('"set" only')
  })

  it('states the one bound the model can hit, on the parameter that hits it', () => {
    if (tool === undefined) return
    const properties = tool.parameters.properties as Record<string, { description?: string }>
    expect(properties.notBeforeIso?.description).toContain('1 hour')
    expect(properties.notBeforeIso?.description).toContain('strictly in the future')
  })

  it('costs a bounded number of characters on every first-turn prompt', () => {
    if (tool === undefined) return
    // The measurement the tool-definition rules ask for, pinned as a leg so growth is a decision: the whole
    // serialized definition is what lands in a model's first-turn prompt. 2,800 characters is this
    // definition plus room to amend one sentence; a later bloat past it must be argued, not absorbed.
    const serialized = JSON.stringify({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })
    expect(serialized.length).toBeLessThan(2800)
    expect(serialized.length).toBeGreaterThan(1200)
  })
})
