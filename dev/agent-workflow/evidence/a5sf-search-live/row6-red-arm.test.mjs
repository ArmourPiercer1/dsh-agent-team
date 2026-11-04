/**
 * row6-red-arm.test.mjs — the RED-before-GREEN arm for Search row 6.
 *
 * THE CONTRACT THIS ARM PINS (and that the failed live run refutes):
 * after `team_archive_member` commits ARCHIVED, the Member's DURABLE session
 * must not be cold-resumed into a callable Agent without an explicit restore.
 * The archive quiesce drops the resident handle (`quiesce.ts` step 5 ->
 * `residency.dropResidency` -> `liveAgents.delete`); today the next
 * `ensureLiveAgent(childSessionId)` simply RESUMES the durable session, which
 * is exactly the "callable shadow" the live row measured: a post-archive
 * `glob` dispatch returned 200 `{ ok: true }` (see row6-diagnosis.md).
 *
 * RED TODAY: the ARCHIVED leg resolves a handle instead of refusing, and the
 * boot resume phase re-binds the archived member on a restart. GREEN AFTER the
 * proposed fix (row6-diagnosis.md §7): a typed refusal naming the archived
 * lifecycle is thrown BEFORE any resume at BOTH seams (the existing product
 * vocabulary is `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED` /
 * `PERMISSION_LIFECYCLE_EXECUTION_TERMINAL` — `permission-lifecycle/types.ts`).
 * The measured GREEN sketch (4/4) is in `row6-red-arm.green-sketch.log`; the
 * sketch was reverted and is NOT committed.
 *
 * The control leg is the required negative: SETTLED must still resume (the
 * gate is not "refuse every member"). Run:
 *   pnpm exec vitest run --config dev/agent-workflow/evidence/a5sf-search-live/row6-vitest.config.mjs
 */
import { describe, expect, it } from 'vitest'

import { createLiveWorld } from '../../../../packages/runtime/test/t12a-live-bridge.mjs'

const ROOT = 'session-team-row6-red'
const CHILD = 'session-child-row6-red'

async function worldWithLifecycle(lifecycle) {
  return createLiveWorld({
    rootSessionId: ROOT,
    members: [{ instanceId: 'inst-row6red', childSessionId: CHILD, templateId: 'tpl-t12a', lifecycle }],
    // the durable session EXISTS in every leg: the only difference is the
    // durable MemberInstance lifecycle the resume seam must honour
    persistence: { exists: () => true },
  })
}

async function capture(fn) {
  try {
    return { value: await fn() }
  } catch (error) {
    return { error }
  }
}

describe('row 6 RED arm — an ARCHIVED Member must not be cold-resumed into a callable Agent', () => {
  it('ARCHIVED: ensureLiveAgent(childSessionId) refuses typed and resumes NOTHING', async () => {
    const world = await worldWithLifecycle('ARCHIVED')
    try {
      const outcome = await capture(() => world.binding.ensureLiveAgent(CHILD))
      // The RED assertion: today this resolves and world.agents.resumes is non-empty.
      expect(outcome.error, `the archived Member was cold-resumed instead of refused; resumes=${JSON.stringify(world.agents.resumes)}`).toBeInstanceOf(Error)
      expect(outcome.error?.code).toBe('PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED')
      expect(world.agents.resumes, 'no resume may be attempted for an archived Member').toEqual([])
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('DISPOSED: same seam, terminal code', async () => {
    const world = await worldWithLifecycle('DISPOSED')
    try {
      const outcome = await capture(() => world.binding.ensureLiveAgent(CHILD))
      expect(outcome.error, `the disposed Member was cold-resumed instead of refused; resumes=${JSON.stringify(world.agents.resumes)}`).toBeInstanceOf(Error)
      expect(outcome.error?.code).toBe('PERMISSION_LIFECYCLE_EXECUTION_TERMINAL')
      expect(world.agents.resumes).toEqual([])
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('SETTLED control: the same member DOES resume (the gate is lifecycle-specific)', async () => {
    const world = await worldWithLifecycle('SETTLED')
    try {
      const outcome = await capture(() => world.binding.ensureLiveAgent(CHILD))
      expect(outcome.error, `a SETTLED member must remain resumable: ${outcome.error?.message ?? ''}`).toBeUndefined()
      expect(world.agents.resumes.map((r) => r.sessionId)).toEqual([CHILD])
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('RESTART: the boot resume phase must not re-bind an ARCHIVED member', async () => {
    const world = await createLiveWorld({
      rootSessionId: 'session-team-row6boot',
      members: [{ instanceId: 'inst-row6boot', childSessionId: 'session-child-row6boot', templateId: 'tpl-t12a', lifecycle: 'ARCHIVED' }],
      persistence: { exists: () => true },
      configOverrides: { bootPhase: 'resume' },
    })
    try {
      await world.binding.boot()
      expect(
        world.agents.resumes.map((r) => r.sessionId),
        'the restart resume phase re-bound the archived Member (no lifecycle read at the boot resume loop)',
      ).not.toContain('session-child-row6boot')
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })
})
