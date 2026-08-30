/**
 * p5t1-binder-core — the read-handle adapter, the fail-fast constructor
 * validation, and the facade surface (P5-T1).
 *
 * - {@link createTeamDomainReadHandle} projects exactly the three READ
 *   methods of the P4 storage repositories (verified against the REAL
 *   repositories over the FileStorageSeam world): the binder's injected
 *   handle can read the durable truth and nothing else (the write surface
 *   is not projected — the binder holds no write method by construction);
 * - the `TeamAgentBinder` constructor is fail-fast: a malformed injected
 *   surface / read handle / slot override / admission guard throws a
 *   `TypeError` (a programming error, distinct from the closed bind-time
 *   `TeamAgentBinderError` codes);
 * - the facade (`agent-setup/binder/index.js`) re-exports the complete
 *   P5-T1 module set (this file imports it as a namespace, so every binder
 *   module is transitively imported by the test suite).
 *
 * @module @dsh-agent-team/runtime/test/p5t1-binder-core
 */

import { describe, expect, it } from 'vitest'

import * as binder from '../agent-setup/binder/index.js'
import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
  TEAM_AGENT_BINDER_ERROR_CODES,
  TeamAgentBinder,
  TeamAgentBinderError,
  identityOverlaySlot,
  isTeamAgentBinderError,
  type TeamAgentBinderOptions,
} from '../agent-setup/binder/index.js'
import { destroyDir, FakeAgentSetupSurface, readHandleFor, seedTeamWorld } from './p5t1-helpers.js'

const world = await seedTeamWorld('p5t1-core')

describe('P5-T1 read handle: delegates to the real P4 repositories (read-only projection)', () => {
  const repositories = world.domain.repositories
  const handle = readHandleFor(world.domain)
  const root = world.ids.rootSessionId
  const child = world.ids.childSessionId
  const instance = world.ids.instanceId

  it('getTeamSession delegates to teamSessions.get', () => {
    expect(handle.getTeamSession(root)).toEqual(repositories.teamSessions.get(root))
    expect(handle.getTeamSession(root)?.rootSessionId).toBe(repositories.teamSessions.get(root)?.rootSessionId)
    expect(handle.getTeamSession('session-root-missing-p5t1')).toBe(undefined)
  })

  it('getMemberInstance delegates to memberInstances.get', () => {
    expect(handle.getMemberInstance(root, instance)).toEqual(repositories.memberInstances.get(root, instance))
    expect(handle.getMemberInstance(root, instance)?.childSessionId).toBe(
      repositories.memberInstances.get(root, instance)?.childSessionId,
    )
    expect(handle.getMemberInstance(root, 'inst-missingp5t1')).toBe(undefined)
  })

  it('getSessionBinding delegates to sessionBindings.get', () => {
    expect(handle.getSessionBinding(child)).toEqual(repositories.sessionBindings.get(child))
    expect(handle.getSessionBinding(root)?.kind).toBe('team-root')
    expect(handle.getSessionBinding(child)?.kind).toBe('team-member')
    expect(handle.getSessionBinding('session-missing-p5t1')).toBe(undefined)
  })

  it('projects NO write method (the binder holds only read access, by construction)', () => {
    const handleRecord = handle as unknown as Record<string, unknown>
    expect(typeof handleRecord['getTeamSession']).toBe('function')
    expect(typeof handleRecord['getMemberInstance']).toBe('function')
    expect(typeof handleRecord['getSessionBinding']).toBe('function')
    // No put / delete / update surface of any kind on the handle.
    expect(handleRecord['put']).toBe(undefined)
    expect(handleRecord['delete']).toBe(undefined)
    expect(handleRecord['update']).toBe(undefined)
  })
})

describe('P5-T1 constructor validation (fail-fast TypeError)', () => {
  const surface = new FakeAgentSetupSurface()
  const readHandle = readHandleFor(world.domain)

  it('rejects non-object options', () => {
    expect(() => new TeamAgentBinder(null as unknown as TeamAgentBinderOptions)).toThrow()
    expect(expectThrownError(() => new TeamAgentBinder(null as unknown as TeamAgentBinderOptions)) instanceof TypeError).toBe(true)
  })

  it('rejects a surface missing any of the four members', () => {
    const missingOne = {
      getInstalledSlots: () => [],
      installOverlay: () => {},
      restoreScope: () => {},
      // recordSessionEvent missing
    }
    expectThrownError(() =>
      new TeamAgentBinder({ surface: missingOne, teamDomain: readHandle } as unknown as TeamAgentBinderOptions),
    ) instanceof TypeError
    const notAFunction = {
      getInstalledSlots: 'nope',
      installOverlay: () => {},
      restoreScope: () => {},
      recordSessionEvent: () => {},
    }
    expectThrownError(() =>
      new TeamAgentBinder({ surface: notAFunction, teamDomain: readHandle } as unknown as TeamAgentBinderOptions),
    ) instanceof TypeError
  })

  it('rejects a read handle missing any of the three members', () => {
    const missingOne = {
      getTeamSession: () => undefined,
      getMemberInstance: () => undefined,
      // getSessionBinding missing
    }
    expectThrownError(() =>
      new TeamAgentBinder({ surface, teamDomain: missingOne } as unknown as TeamAgentBinderOptions),
    ) instanceof TypeError
  })

  it('rejects a slot override whose name does not match its key', () => {
    const options = {
      surface,
      teamDomain: readHandle,
      slots: { persona: identityOverlaySlot('model') },
    }
    expectThrownError(() => new TeamAgentBinder(options as unknown as TeamAgentBinderOptions)) instanceof TypeError
  })

  it('rejects an unknown slot key', () => {
    const options = {
      surface,
      teamDomain: readHandle,
      slots: {
        persona: identityOverlaySlot('persona'),
        prompt: identityOverlaySlot('persona'),
      },
    }
    expectThrownError(() => new TeamAgentBinder(options as unknown as TeamAgentBinderOptions)) instanceof TypeError
  })

  it('rejects a slot without an apply function', () => {
    const options = {
      surface,
      teamDomain: readHandle,
      slots: { persona: { name: 'persona' } },
    }
    expectThrownError(() => new TeamAgentBinder(options as unknown as TeamAgentBinderOptions)) instanceof TypeError
  })

  it('rejects an admission guard without a decide function', () => {
    expectThrownError(() =>
      new TeamAgentBinder(
        { surface, teamDomain: readHandle, admissionGuard: {} } as unknown as TeamAgentBinderOptions,
      ),
    ) instanceof TypeError
  })

  it('accepts a well-formed options object', () => {
    expect(
      () =>
        new TeamAgentBinder({
          surface,
          teamDomain: readHandle,
          slots: { persona: identityOverlaySlot('persona') },
        }),
    ).not.toThrow()
  })
})

describe('P5-T1 error channel + facade surface', () => {
  it('TeamAgentBinderError carries the closed code, lossless-JSON details, and cause', () => {
    const cause = new Error('origin')
    const error = new TeamAgentBinderError(
      TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED,
      'message',
      { origin: 'persona', path: 'fresh-root', sessionId: 's', causeMessage: 'origin' },
      cause,
    )
    expect(error.name).toBe('TeamAgentBinderError')
    expect(error.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(error.details).toEqual({ origin: 'persona', path: 'fresh-root', sessionId: 's', causeMessage: 'origin' })
    expect(error.cause).toBe(cause)
    expect(isTeamAgentBinderError(error)).toBe(true)
    expect(isTeamAgentBinderError(new Error('plain'))).toBe(false)
    expect(isTeamAgentBinderError('nope')).toBe(false)
  })

  it('the closed error-code vocabulary has exactly the five P5-T1 codes', () => {
    expect(Object.keys(TEAM_AGENT_BINDER_ERROR_CODES).length).toBe(5)
    expect(binder.TEAM_AGENT_BINDER_ERROR_CODE_VALUES).toEqual([
      'BINDER_TARGET_KIND_MISMATCH',
      'BINDER_TARGET_NOT_FOUND',
      'BINDER_RECORD_CONFLICT',
      'BINDER_MEMBER_DISPOSED',
      'BINDER_OVERLAY_FAILED',
    ])
  })

  it('the facade re-exports the complete P5-T1 module set', () => {
    expect(OVERLAY_SLOT_ORDER).toEqual(['persona', 'model', 'capability'])
    expect(binder.OVERLAY_SLOT_ORDER).toBe(OVERLAY_SLOT_ORDER)
    expect(AGENT_SETUP_EVENT_NAMES).toEqual({
      overlayInstalled: 'agent-setup/overlay-installed',
      scopeRestored: 'agent-setup/scope-restored',
      admissionDecided: 'agent-setup/admission-decided',
    })
    expect(ADMISSION_OPEN_CODE).toBe('ADMISSION_OPEN')
    expect(typeof binder.TEAM_AGENT_BINDER_ERROR_CODES).toBe('object')
    expect(typeof binder.TeamAgentBinderError).toBe('function')
    expect(typeof binder.isTeamAgentBinderError).toBe('function')
    expect(typeof binder.identityOverlaySlot).toBe('function')
    expect(typeof binder.defaultOverlaySlots).toBe('function')
    expect(typeof binder.defaultAdmissionGuard).toBe('object')
    expect(typeof binder.createTeamDomainReadHandle).toBe('function')
    expect(typeof binder.TeamAgentBinder).toBe('function')
  })
})

/**
 * The thrown-error helper (the shim's `toThrow` takes no argument):
 * returns the thrown value, or `undefined` when nothing was thrown.
 */
function expectThrownError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

destroyDir(world.scratchDir)
