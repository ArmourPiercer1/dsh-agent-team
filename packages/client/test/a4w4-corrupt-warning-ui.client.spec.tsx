// @vitest-environment jsdom
/**
 * a4w4-corrupt-warning-ui.client.spec.tsx — A4-PR7 W4: the two P2 render
 * defects found in the merged W1 corrupt-record warning surface, pinned at
 * the RENDER layer (the W1 lane pinned the pure model only; neither defect
 * lives in the model, both live in what TeamView puts on screen).
 *
 * F1 (read failure was invisible): W1 assigned `corruption.error` and never
 * rendered it, so a human could not tell "this Team has no corrupt records"
 * apart from "the integrity check never succeeded". The fix renders ONE
 * NEUTRAL, non-dismissible, non-modal notice in the SAME position as the
 * bar. WARNING-FIRST DISCIPLINE (RULING 5-B) is unchanged: the notice names
 * no blocked action and never touches the ledger surface below it.
 *
 * F2 (a warning could be shown for the wrong Team): the read state carried
 * no `teamSessionId` and a failed read EXPLICITLY kept the previous state
 * (`prev.view === null && prev.error === null ? … : prev`), so team B's
 * failed read left team A's bar on screen. The fix binds the state to the
 * key it belongs to: a key change invalidates the previous round
 * immediately, a settle may only write its own key, and the render reads
 * the state only when `state.key === corruptionTeamKey`.
 *
 * Pinned branches that are NOT part of the fix and must stay as W1 shipped
 * them: a SAME-KEY read failure keeps the last good view (the bar stays,
 * no notice), and the epoch guard (concurrent-interleaving protection)
 * still gates every settle.
 *
 * @module @dsh-agent-team/client/test/a4w4-corrupt-warning-ui
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import type {
  RemoteResponse, RemoteSafeJsonValue, RemoteTeamResolveControlParams,
} from '../../remote/src/index.js'
import { TeamView, type TeamViewControlFace, type TeamViewProps } from '../src/ui/TeamView.js'
import { en, zh } from '../src/ui/locales.js'

afterEach(cleanup)

const TEAM_A = 'team-alpha'
const TEAM_B = 'team-beta'

/** One provenance-bearing success envelope (the wire shape, verbatim). */
function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 9,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

/** One typed refusal (the pre-v9 host answers exactly this). */
function failResponse(code: string, message: string): RemoteResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      details: {
        method: 'team.listCorruptControlLegs', endpoint: 'team.listCorruptControlLegs',
        contractVersion: 9, requestToken: null,
      },
    },
  }
}

/** One corruption payload (the closed v9 wire, server order). */
function corruptionData(teamSessionId: string, corruptCount: number): unknown {
  return {
    corruption: {
      teamSessionId,
      corruptCount,
      truncated: false,
      legs: Array.from({ length: corruptCount }, (_, index) => ({
        sequence: index + 1,
        disclosesMember: false,
      })),
    },
  }
}

/** One minimal projection frame for one Team (the ONE boundary cast). */
function frame(teamSessionId: string): TeamProjectionDto {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
    generation: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: { teamSessionId, createdAt: '2026-08-29T00:00:00.000Z', policyState: 'open' },
    templates: [],
    members: [],
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
  } as unknown as TeamProjectionDto
}

/**
 * The view props for one resolved Team frame (the same fixture shape the
 * existing TeamView spec uses: the projection mirror is the only source of
 * team-ness, every framework seat is a no-op stub).
 */
function viewProps(sessionId: string, control: TeamViewControlFace): TeamViewProps {
  const mirror = { [sessionId]: frame(sessionId) } as unknown as TeamProjectionMirror
  return {
    sessionId: sessionId as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useSessionStatus: (() => undefined) as TeamViewProps['useSessionStatus'],
    useSessionRetainInfo: (() => undefined) as TeamViewProps['useSessionRetainInfo'],
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    usePanelInfo: (sel) => sel({ activePanelId: null }),
    useProjectionMirror: selector => selector(mirror),
    useTeamLedgers: selector => selector({}),
    useProjectionStates: selector => selector({}),
    useSessionReadStates: selector => selector({}),
    ensureProjection: vi.fn(() => Promise.resolve()),
    pullProjection: vi.fn(() => Promise.resolve({ status: 'duplicate', receivedGeneration: 1 } as const)),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    inspectCall: undefined,
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    control,
  }
}

/**
 * One TeamView mounted against a corrupt-leg face. The `control` face is
 * built ONCE (outside the render path) because TeamView's read effect keys
 * on its identity — a per-render face would be a different component
 * contract than the mount's stable one.
 */
function mountTeamView(control: TeamViewControlFace, sessionId: string = TEAM_A) {
  const view = render(<TeamView {...viewProps(sessionId, control)} />)
  return {
    view,
    /** Switch the resolved Team (the same frame-resolution seam a session
     *  switch drives: a different resolved `teamSessionId`). */
    switchTeam(next: string): void {
      act(() => {
        view.rerender(<TeamView {...viewProps(next, control)} />)
      })
    },
  }
}

/**
 * A read whose answer is held by the test (to observe the state DURING the
 * in-flight window, i.e. after a Team switch and before the settle).
 */
function deferredResponse(): {
  readonly promise: Promise<RemoteResponse>
  readonly resolve: (response: RemoteResponse) => void
} {
  const holder: { resolve: ((response: RemoteResponse) => void) | null } = { resolve: null }
  const promise = new Promise<RemoteResponse>(res => { holder.resolve = res })
  return {
    promise,
    resolve: (response: RemoteResponse): void => {
      const settle = holder.resolve
      if (settle === null) throw new Error('the deferred promise never reached its executor')
      settle(response)
    },
  }
}

/** A face whose corrupt-leg read answers per requested Team. */
function corruptionFace(
  responder: (teamSessionId: string) => Promise<RemoteResponse>,
): TeamViewControlFace {
  return {
    resolveControl: (params: RemoteTeamResolveControlParams) =>
      Promise.resolve(okResponse({ control: { requestId: params.requestId } }, 'team.resolveControl')),
    listCorruptControlLegs: params => responder(params.teamSessionId),
  }
}

const BAR = '[data-team-control-corruption]'
const NOTICE = '[data-team-control-corruption-check-unavailable]'

describe('A4-PR7 W4 F1 — an unavailable integrity check is visible', () => {
  it('a typed read failure shows ONE neutral notice and never a corrupt-record bar', async () => {
    const control = corruptionFace(async () =>
      failResponse('method-version-unsupported', 'the host does not serve team.listCorruptControlLegs at v9'))
    const { view } = mountTeamView(control)

    await vi.waitFor(() => {
      expect(view.container.querySelector(NOTICE)).not.toBeNull()
    })
    // The bar is NOT the fallback: a failed check must not read as "clean"
    // (that is the defect) NOR as "corrupt" (that would invent a fact).
    expect(view.container.querySelector(BAR)).toBeNull()
    const notice = view.container.querySelector<HTMLElement>(NOTICE)
    expect(notice?.textContent).toContain('审批记录完整性检查暂不可用')
    // NEUTRAL: the notice names no blocked action and carries no command —
    // it is not a modal, not dismissible, and never blocks the sections.
    expect(notice?.querySelector('button')).toBeNull()
    expect(notice?.getAttribute('role')).toBe('status')
    expect(view.container.querySelector('[data-team-section="timeline"]')).not.toBeNull()
    expect(view.container.querySelector('[data-team-section="members"]')).not.toBeNull()
    // The failing read carried the typed code through for diagnostics.
    expect(notice?.textContent).toContain('method-version-unsupported')
  })

  it('a malformed payload and a transport loss take the same notice lane (every failure branch)', async () => {
    const control = corruptionFace(async () => okResponse({ notCorruption: true }, 'team.listCorruptControlLegs'))
    const { view } = mountTeamView(control)
    await vi.waitFor(() => {
      expect(view.container.querySelector(NOTICE)).not.toBeNull()
    })
    expect(view.container.querySelector(BAR)).toBeNull()
    expect(view.container.querySelector<HTMLElement>(NOTICE)?.textContent).toContain('malformed-response')
  })

  it('a transport rejection takes the same notice lane', async () => {
    const control = corruptionFace(async () => {
      throw new Error('native bridge unavailable')
    })
    const { view } = mountTeamView(control)
    await vi.waitFor(() => {
      expect(view.container.querySelector(NOTICE)).not.toBeNull()
    })
    expect(view.container.querySelector(BAR)).toBeNull()
    expect(view.container.querySelector<HTMLElement>(NOTICE)?.textContent).toContain('native-error')
  })

  it('the notice is visually and textually distinct from a clean report (no bar, no notice)', async () => {
    const clean = corruptionFace(async team => Promise.resolve(okResponse(corruptionData(team, 0), 'team.listCorruptControlLegs')))
    const cleanView = mountTeamView(clean)
    await vi.waitFor(() => {
      expect(cleanView.view.container.querySelector('[data-team-refresh]')).not.toBeNull()
    })
    await vi.waitFor(() => {
      // a settled clean read: neither the bar nor the notice
      expect(cleanView.view.container.querySelector(NOTICE)).toBeNull()
    })
    expect(cleanView.view.container.querySelector(BAR)).toBeNull()
    cleanView.view.unmount()

    const corrupt = corruptionFace(async team => Promise.resolve(okResponse(corruptionData(team, 2), 'team.listCorruptControlLegs')))
    const corruptView = mountTeamView(corrupt)
    await vi.waitFor(() => {
      expect(corruptView.view.container.querySelector(BAR)).not.toBeNull()
    })
    // A real disclosure renders the bar WITHOUT the notice, and the two
    // surfaces never co-exist for one Team.
    expect(corruptView.view.container.querySelector(NOTICE)).toBeNull()
    expect(corruptView.view.container.querySelector<HTMLElement>('[data-team-control-corruption-summary]')?.textContent)
      .toContain('2')
  })

  it('the English locale carries the same key with the same neutrality (no blocked-action claim)', () => {
    const translate = makeTranslate(en)
    const text = translate('view.corruption.checkUnavailable', {})
    expect(text).toContain('integrity check')
    expect(text.toLowerCase()).not.toContain('blocked')
    expect(text.toLowerCase()).not.toContain('denied')
    expect(text).not.toBe('view.corruption.checkUnavailable')
    const zhText = makeTranslate(zh)('view.corruption.checkUnavailable', {})
    expect(zhText).not.toBe('view.corruption.checkUnavailable')
    expect(zhText).not.toBe(text)
  })
})

describe('A4-PR7 W4 F2 — a warning never outlives its Team', () => {
  it('a Team switch invalidates the previous Team bar BEFORE the new read answers', async () => {
    const deferred = deferredResponse()
    const control = corruptionFace(team => {
      if (team === TEAM_A) return Promise.resolve(okResponse(corruptionData(TEAM_A, 3), 'team.listCorruptControlLegs'))
      // B's read is still in flight at the switch moment.
      return deferred.promise
    })
    const { view, switchTeam } = mountTeamView(control)
    await vi.waitFor(() => {
      expect(view.container.querySelector(BAR)).not.toBeNull()
    })
    expect(view.container.querySelectorAll('[data-team-control-corruption-leg]').length).toBe(3)

    switchTeam(TEAM_B)
    // NO waiting: the previous Team's bar is gone the moment the key
    // changes — the state carries the key it belongs to.
    expect(view.container.querySelector(BAR)).toBeNull()
    expect(view.container.textContent).not.toContain('控制账本存在无法解析的损坏记录')

    // And when B's own read fails, the notice describes B; the A bar never
    // comes back on a late settle.
    deferred.resolve(failResponse('transport-loss', 'the bridge is unavailable'))
    await vi.waitFor(() => {
      expect(view.container.querySelector(NOTICE)).not.toBeNull()
    })
    expect(view.container.querySelector(BAR)).toBeNull()
    expect(view.container.querySelectorAll('[data-team-control-corruption-leg]').length).toBe(0)
  })

  it('switching to a clean Team clears the previous Team bar (no stale attribution)', async () => {
    const control = corruptionFace(async team =>
      Promise.resolve(okResponse(corruptionData(team, team === TEAM_A ? 1 : 0), 'team.listCorruptControlLegs')))
    const { view, switchTeam } = mountTeamView(control)
    await vi.waitFor(() => {
      expect(view.container.querySelector(BAR)).not.toBeNull()
    })
    switchTeam(TEAM_B)
    await vi.waitFor(() => {
      expect(view.container.querySelector(BAR)).toBeNull()
    })
    expect(view.container.querySelector(NOTICE)).toBeNull()
  })

  it('a same-Team refresh failure KEEPS the last good bar (the W1 branch this fix does not touch)', async () => {
    let attempt = 0
    const control = corruptionFace(async team => {
      attempt += 1
      if (attempt === 1) return okResponse(corruptionData(team, 2), 'team.listCorruptControlLegs')
      return failResponse('transport-loss', 'the bridge is unavailable')
    })
    const { view } = mountTeamView(control)
    await vi.waitFor(() => {
      expect(view.container.querySelector(BAR)).not.toBeNull()
    })
    const refresh = view.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    if (refresh === null) throw new Error('the manual refresh entry did not render')
    act(() => { refresh.click() })
    await vi.waitFor(() => {
      expect(view.container.querySelector(NOTICE)).toBeNull()
    })
    // Same key: the disclosure stands (the bar is a durable ledger fact for
    // THIS Team); the failure only replaces the notice lane when there is
    // no bar to show.
    expect(view.container.querySelector(BAR)).not.toBeNull()
  })
})
