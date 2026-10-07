// @vitest-environment jsdom
/**
 * A4-PR6 §6.D — the Permission Administration read view (frozen path
 * `src/model/permission-administration.ts` for the helper; this spec owns
 * the DISPLAY laws the plan pins:
 *  - the effective set renders AS RULES: one flat row per rule with the
 *    matcher shown by KIND + RESOURCE TEXT — a `subtree` rule is NEVER
 *    expanded into a directory/filesystem tree;
 *  - identity + overlay provenance are the six closed wire cells (the
 *    STRIP ran at the host port edge; the view displays, adds nothing);
 *  - `generation: null` is the frozen blueprint-default state, displayed
 *    as such (never a fake generation 0);
 *  - diagnostics render as their own structured lines;
 *  - a typed read failure renders VERBATIM (the panel's discipline).
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  REMOTE_CONTRACT_VERSION_V8,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
  type RemoteSafeRecord,
} from '../../remote/src/index.js'
import { en } from '../src/ui/locales.js'
import { TeamInterventions, type TeamInterventionsFace } from '../src/ui/TeamInterventions.js'
import { parsePermissionAdministration } from '../src/model/permission-administration.js'

const LEADER = 'team-lead'

const ok8 = (data: Record<string, unknown>, method: string): RemoteResponse =>
  buildRemoteSuccess(data as RemoteSafeRecord, {
    method,
    endpoint: method,
    contractVersion: REMOTE_CONTRACT_VERSION_V8,
    requestToken: null,
  } as never)

const err8 = (code: string, message: string): RemoteResponse =>
  buildRemoteError(code, message, {
    method: 'override.getPermissionAdministration',
    endpoint: 'override.getPermissionAdministration',
    contractVersion: REMOTE_CONTRACT_VERSION_V8,
    requestToken: null,
  } as never)

const OVERLAY_ADMIN = {
  teamSessionId: LEADER,
  memberInstanceId: 'mate',
  generation: 3,
  source: 'overlay',
  effective: {
    rules: [
      { lane: 'permissions', matcher: { kind: 'subtree', resource: '/repo/src' }, effect: 'allow' },
      { lane: 'shell', matcher: { kind: 'exact', resource: 'rm' }, effect: 'deny' },
    ],
  },
  diagnostics: [{ code: 'envelope-consistency', verdict: 'consistent' }],
}

function renderWithAdministration(response: RemoteResponse) {
  const face: TeamInterventionsFace = {
    interventionList: vi.fn(async () => ok8({ items: [] }, 'intervention.list')),
    interventionAct: vi.fn(async () => ok8({ outcome: 'decided' }, 'intervention.act')),
    permissionAdministrationGet: vi.fn(async () => response),
  }
  return render(<TeamInterventions teamSessionId={LEADER} face={face} t={makeTranslate(en)} />)
}

afterEach(cleanup)

describe('A4-PR6 §6.D the administration view renders the effective set AS RULES', () => {
  it('rules are FLAT rows; a subtree matcher is TEXT, never an expanded tree', async () => {
    const view = renderWithAdministration(ok8({ administration: OVERLAY_ADMIN }, 'override.getPermissionAdministration'))
    await waitFor(() => expect(view.container.querySelectorAll('[data-permission-rule]').length).toBe(2))
    const rules = [...view.container.querySelectorAll<HTMLElement>('[data-permission-rule]')]
    expect(rules[0]?.dataset['ruleLane']).toBe('permissions')
    expect(rules[0]?.dataset['ruleMatcherKind']).toBe('subtree')
    expect(rules[0]?.dataset['ruleResource']).toBe('/repo/src')
    expect(rules[0]?.dataset['ruleEffect']).toBe('allow')
    expect(rules[1]?.dataset['ruleMatcherKind']).toBe('exact')
    const list = view.container.querySelector('[data-administration-rules]')
    // The §6.D law: no nested list anywhere under the rules container —
    // a subtree rule is ONE row with its resource as text.
    expect(list?.querySelectorAll('ul').length).toBe(0)
    expect(list?.querySelectorAll('li').length).toBe(2)
    // diagnostics ride as their own structured line (code · verdict):
    expect(view.container.querySelector('[data-administration-diagnostic]')?.textContent).toContain('envelope-consistency')
  })

  it('generation:null displays the frozen blueprint-default state, never generation 0', async () => {
    const view = renderWithAdministration(ok8({
      administration: {
        teamSessionId: LEADER,
        memberInstanceId: 'mate',
        generation: null,
        source: 'blueprint-default',
        effective: { rules: [] },
        diagnostics: [],
      },
    }, 'override.getPermissionAdministration'))
    await waitFor(() => expect(view.container.querySelector('[data-administration-identity]')).not.toBeNull())
    const identity = view.container.querySelector('[data-administration-identity]')?.textContent ?? ''
    expect(identity).toContain('blueprint default')
    expect(identity).not.toContain('generation 0')
    expect(view.container.querySelector('[data-administration-no-rules]')).not.toBeNull()
  })

  it('a typed administration refusal renders VERBATIM, not an empty default view', async () => {
    const view = renderWithAdministration(err8('permission-denied', 'the administration read requires the Leader plane'))
    await waitFor(() => expect(view.container.querySelector('[data-administration-error]')).not.toBeNull())
    const note = view.container.querySelector('[data-administration-error]')?.textContent ?? ''
    expect(note).toContain('permission-denied')
    expect(note).toContain('the administration read requires the Leader plane')
    expect(view.container.querySelector('[data-administration]')).toBeNull()
  })

  it('the model is fail-safe: a malformed administration value yields NO view (never a half-authority display)', () => {
    expect(parsePermissionAdministration({ administration: null })).toBe(undefined)
    expect(parsePermissionAdministration({ administration: { source: 'overlay' } })).toBe(undefined)
    const partial = parsePermissionAdministration({
      administration: {
        teamSessionId: LEADER,
        source: 'overlay',
        generation: 2,
        effective: { rules: [{ lane: 'shell' }, { lane: 'shell', matcher: { kind: 'exact', resource: 'ls' }, effect: 'allow' }] },
      },
    })
    expect(partial?.rules).toHaveLength(1)
    expect(partial?.generation).toBe(2)
  })
})
