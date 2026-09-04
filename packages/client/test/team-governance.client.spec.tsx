// @vitest-environment jsdom
/**
 * The S5-C config/policy/compatibility governance section (P9-T8; UI doc
 * §10/§18/§19/§21, Gate P9-G5): the Projection-driven compatibility badge
 * (the §10.2 four admission states → pass/warning/fatal mark, unknown
 * future status rendered verbatim — never silent), the human "Recheck"
 * (the closed `CAPABILITY_GENERATION_CHANGE` trigger), the §21 policy-state
 * row (review the cell view, commit a PARTIAL cell map on the projection
 * state id — never invented), the per-member §18 effective-config lanes
 * (the distinct §18.3 state words, the §19 hard-policy display for a
 * denied lane, the §19 override editor scoped to the instance), and the
 * G5 discipline: every command settles through the injected frozen Remote
 * face — a typed failure is rendered VERBATIM (code + message + the
 * request-token echo), a transport loss records the local `transport-loss`
 * note, a success pulls the projection EXACTLY ONCE and applies NO
 * optimistic authority patch (the badge/counts stay projection-driven).
 * The READS (`compatibility.get` / `policyState.get` / `override.get`) are
 * not command flows: they never pull the projection (the T7 catalog
 * precedent) and their typed failures render verbatim as local notes. The
 * wire-gap ack control is rendered disabled with the explicit reason.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteCompatibilityGetParams, RemoteCompatibilityReprobeParams,
  RemoteOverrideGetParams, RemoteOverrideResetParams, RemoteOverrideSetParams,
  RemotePolicyStateGetParams, RemotePolicyStateSetParams, RemoteResponse, RemoteSafeJsonValue,
} from '../../remote/src/index.js'
import type { EffectiveConfigDto } from '../../contracts/src/index.js'
import type {
  TeamUiDisplayStatus, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import { TeamGovernance, type TeamGovernanceFace } from '../src/ui/TeamGovernance.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'leader-s'
const SA = 'sa'

const iso = (ms: number): string => new Date(ms).toISOString()

const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

/** The §7.2 display → raw lifecycle pairing for fixture rows. */
const LIFECYCLE: Record<TeamUiDisplayStatus, TeamUiMemberInstance['lifecycle']> = {
  created: 'CREATED',
  running: 'RUNNING',
  settled: 'SETTLED',
  archived: 'ARCHIVED',
  disposed: 'DISPOSED',
}

function instance(
  overrides: Partial<TeamUiMemberInstance> & Pick<TeamUiMemberInstance, 'instanceId' | 'templateId' | 'label'>,
): TeamUiMemberInstance {
  return {
    childSessionId: null,
    lifecycle: 'CREATED',
    displayStatus: 'created',
    liveActivity: null,
    pendingControlCount: null,
    fromHistory: false,
    createdAt: iso(1_700_000_000_000),
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

function snapshot(
  members: readonly TeamUiMemberInstance[],
  overrides: Partial<TeamUiSnapshot> = {},
): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-a', displayName: 'Alpha', contextPolicy: 'persistent' },
    ],
    members,
    compatibility: {
      status: 'OPEN', probeGeneration: 1, requirementFingerprint: 'rf-1', environmentFingerprint: 'ef-1',
      warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
    },
    policyState: 'open',
    ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    activity: [],
    disposedHistory: [],
    ...overrides,
  } as unknown as TeamUiSnapshot
}

/**
 * One effective-config entry (v2-shaped: the additive provenance fields
 * `deniedBy` / `effectiveFrom` are exercised for the §19 hard-policy
 * display and the effect-boundary flag). V1 entries are a structural
 * subset, so the snapshot boundary cast keeps both shapes legal.
 */
function configEntry(value: string | null, source: string, state: string, extra: Record<string, unknown> = {}) {
  return { value, source, state, ...extra }
}

/** A member effective-config DTO: model/workspace/permissions/autonomy lanes. */
function effectiveConfig(overrides: Record<string, unknown> = {}): EffectiveConfigDto {
  return {
    model: configEntry('deepseek-v4', 'blueprint', 'inherited'),
    workspace: configEntry('D:\\work', 'instance-creation', 'locked'),
    permissions: {
      bash: configEntry(null, 'policy-state', 'denied', { deniedBy: 'org policy: no shell' }),
      web: configEntry('allow', 'explicit-human-override', 'overridden'),
    },
    autonomy: configEntry('full', 'autonomy-overlay', 'inherited', { effectiveFrom: 7 }),
    ...overrides,
  } as unknown as EffectiveConfigDto
}

function defaultTeam(): TeamUiSnapshot {
  return snapshot([
    instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
    instance({
      instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
      lifecycle: LIFECYCLE.running, displayStatus: 'running',
      effectiveConfig: effectiveConfig(),
    }),
  ])
}

/** One provenance-bearing success envelope (the wire shape, verbatim). */
function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 1,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

/** One typed failure envelope (the closed code + wire message kept verbatim). */
function errorResponse(code: string, message: string, method: string, requestToken: string | null): RemoteResponse {
  return {
    ok: false,
    error: {
      code, message,
      details: { method, endpoint: method, contractVersion: 1, requestToken },
    },
  }
}

/** The S5-C governance face (every member a spy; the defaults are the happy path). */
function makeFace(overrides: Partial<TeamGovernanceFace> = {}): TeamGovernanceFace {
  return {
    compatibilityGet: vi.fn(() => Promise.resolve(okResponse(null, 'compatibility.get'))),
    compatibilityAck: vi.fn(() => Promise.resolve(okResponse(null, 'compatibility.ack'))),
    compatibilityReprobe: vi.fn(() => Promise.resolve(okResponse(null, 'compatibility.reprobe'))),
    policyStateGet: vi.fn(() => Promise.resolve(okResponse(null, 'policyState.get'))),
    policyStateSet: vi.fn(() => Promise.resolve(okResponse(null, 'policyState.set'))),
    overrideGet: vi.fn(() => Promise.resolve(okResponse(null, 'override.get'))),
    overrideSet: vi.fn(() => Promise.resolve(okResponse(null, 'override.set'))),
    overrideReset: vi.fn(() => Promise.resolve(okResponse(null, 'override.reset'))),
    pullProjection: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  }
}

function makeProps(
  team: TeamUiSnapshot = defaultTeam(),
  governance?: TeamGovernanceFace,
  dict: Record<string, string> = en,
): Parameters<typeof TeamGovernance>[0] {
  return { snapshot: team, governance: governance ?? makeFace(), t: makeTranslate(dict) }
}

function compatBadge(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-governance-compat-badge]')
}

function button(container: HTMLElement, selector: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(selector)
  if (el === null) throw new Error(`the ${selector} button did not render`)
  return el
}

afterEach(cleanup)

describe('TeamGovernance', () => {
  it('renders the Projection-driven compatibility badge (the §10.2 four admission states)', () => {
    const statuses = ['OPEN', 'BLOCKED_WARNING', 'DEGRADED_ACKNOWLEDGED', 'BLOCKED_FATAL'] as const
    const expected: Record<'OPEN' | 'BLOCKED_WARNING' | 'DEGRADED_ACKNOWLEDGED' | 'BLOCKED_FATAL', { mark: string; text: string }> = {
      OPEN: { mark: 'pass', text: '✓ Compatible' },
      BLOCKED_WARNING: { mark: 'warning', text: '⚠ Action required' },
      DEGRADED_ACKNOWLEDGED: { mark: 'warning', text: '⚠ Degraded' },
      BLOCKED_FATAL: { mark: 'fatal', text: '✕ Structural error' },
    }
    for (const status of statuses) {
      const face = makeFace()
      const view = render(<TeamGovernance {...makeProps(
        snapshot([
          instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA }),
        ], {
          compatibility: {
            status: status as never, probeGeneration: 3, requirementFingerprint: 'rf-1',
            environmentFingerprint: 'ef-1', warningCount: 1, fatalCount: status === 'BLOCKED_FATAL' ? 1 : 0,
            acknowledgedWarningCount: 0,
          },
        }),
        face,
      )} />)
      const badge = compatBadge(view.container)
      if (badge === null) throw new Error('the compatibility badge did not render')
      expect(badge.dataset.governanceCompatMark).toBe(expected[status].mark)
      expect(badge.textContent).toBe(expected[status].text)
      // Rendering is read-only: no projection pull on mount.
      expect(face.pullProjection).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it('renders an unknown future compatibility status verbatim (loud, never silent)', () => {
    const view = render(<TeamGovernance {...makeProps(
      snapshot(
        [instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA })],
        {
          compatibility: {
            status: 'QUANTUM_UNSTABLE' as never, probeGeneration: 1, requirementFingerprint: 'rf-1',
            environmentFingerprint: 'ef-1', warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
          },
        },
      ),
    )} />)
    const badge = compatBadge(view.container)
    if (badge === null) throw new Error('the compatibility badge did not render')
    expect(badge.textContent).toBe('QUANTUM_UNSTABLE')
    expect(badge.dataset.governanceCompatMark).toBeUndefined()
  })

  it('renders the aggregate counts and generation from the Projection', () => {
    const view = render(<TeamGovernance {...makeProps(
      snapshot(
        [instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA })],
        {
          compatibility: {
            status: 'BLOCKED_WARNING', probeGeneration: 4, requirementFingerprint: 'rf-1',
            environmentFingerprint: 'ef-1', warningCount: 2, fatalCount: 1, acknowledgedWarningCount: 1,
            lastProbedAt: iso(1_700_000_010_000),
          },
        },
      ),
    )} />)
    const counts = view.container.querySelector('[data-governance-compat-counts]')
    if (counts === null) throw new Error('the counts block did not render')
    expect(counts.textContent).toContain('2 warning(s)')
    expect(counts.textContent).toContain('1 fatal')
    expect(counts.textContent).toContain('1 acknowledged')
    const gen = view.container.querySelector('[data-governance-compat-generation]')
    if (gen === null) throw new Error('the generation meta did not render')
    expect(gen.textContent).toBe('Generation 4')
  })

  it('keeps the ack control disabled with the explicit wire-gap reason (UI §38)', () => {
    const view = render(<TeamGovernance {...makeProps()} />)
    const ack = button(view.container, '[data-governance-ack]')
    expect(ack.disabled).toBe(true)
    expect(ack.title).toBe('The compatibility summary exposes aggregate counts only; per-requirement acknowledgement is not exposed on the wire.')
    expect(screen.getByText('Acknowledge warning')).toBeTruthy()
  })

  it('a compat review is a read: it never pulls the projection', async () => {
    const face = makeFace()
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-compat-review]'))
    await act(async () => {})
    expect(face.compatibilityGet).toHaveBeenCalledTimes(1)
    expect(face.compatibilityGet).toHaveBeenCalledWith({ teamSessionId: LEADER } satisfies RemoteCompatibilityGetParams)
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('renders a compat review typed failure verbatim as a local note (no projection pull)', async () => {
    const face = makeFace({
      compatibilityGet: vi.fn(() => Promise.resolve(
        errorResponse('COMPAT_STORE_DOWN', 'compatibility store down', 'compatibility.get', null),
      )),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-compat-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-compat-read-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-governance-compat-read-error]')?.textContent)
      .toBe('Error: COMPAT_STORE_DOWN: compatibility store down')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('renders the compat review fresh-read detail on success (labeled, not authority)', async () => {
    const face = makeFace({
      compatibilityGet: vi.fn(() => Promise.resolve(okResponse({
        status: 'OPEN', generation: 5, environmentFingerprint: 'ef-new', recordedAt: '2026-08-29T00:00:00.000Z',
        counts: { pass: 9, warning: 1, fatal: 0, unackedWarning: 1, staleAcknowledgement: 0 },
      }, 'compatibility.get'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-compat-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-compat-read]')).toBeTruthy()
    })
    const read = view.container.querySelector('[data-governance-compat-read]')
    if (read === null) throw new Error('the fresh-read block did not render')
    expect(read.textContent).toContain('ef-new')
    expect(read.textContent).toContain('Generation 5')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('the human Recheck re-probes with the closed CAPABILITY_GENERATION_CHANGE trigger and pulls once on success', async () => {
    const face = makeFace()
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-recheck]'))
    expect(face.compatibilityReprobe).toHaveBeenCalledTimes(1)
    expect(face.compatibilityReprobe).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      trigger: 'CAPABILITY_GENERATION_CHANGE',
    } satisfies RemoteCompatibilityReprobeParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
      expect(view.container.querySelector('[data-governance-recheck-error]')).toBeNull()
    })
    expect(face.pullProjection).toHaveBeenCalledWith(LEADER)
  })

  it('a Recheck typed failure renders verbatim (code + message + token echo) and never pulls', async () => {
    const face = makeFace({
      compatibilityReprobe: vi.fn(() => Promise.resolve(
        errorResponse('PROBE_REJECTED', 'probe budget exhausted', 'compatibility.reprobe', 'governance-1'),
      )),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-recheck]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-recheck-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-governance-recheck-error]')?.textContent)
      .toBe('Error: PROBE_REJECTED: probe budget exhausted [governance-1]')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('a Recheck transport loss (the only rejection kind) records the local transport-loss note', async () => {
    const face = makeFace({
      compatibilityReprobe: vi.fn(() => Promise.reject(new Error('channel lost'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-recheck]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-recheck-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-governance-recheck-error]')?.textContent)
      .toBe('Error: transport-loss: channel lost [governance-1]')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('a policy review loads the cell view (a read: no projection pull)', async () => {
    const face = makeFace({
      policyStateGet: vi.fn(() => Promise.resolve(okResponse({
        stateId: 'open',
        cells: {
          model: { locked: false, value: { kind: 'allow', items: ['deepseek-v4'] } },
          // The frozen wire encodes "no value" as the ABSENT `value` key
          // (`RemotePolicyStateCellValue.value?: RemotePolicyEntry` — never
          // null); `value: null` is malformed and the parser rejects it.
          tools: { locked: true },
        },
      }, 'policyState.get'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-policy-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-cells]')).toBeTruthy()
    })
    expect(face.policyStateGet).toHaveBeenCalledTimes(1)
    expect(face.policyStateGet).toHaveBeenCalledWith({ teamSessionId: LEADER } satisfies RemotePolicyStateGetParams)
    const cells = view.container.querySelector('[data-governance-policy-cells]')
    if (cells === null) throw new Error('the policy cells block did not render')
    expect(cells.querySelector('[data-governance-policy-cell="model"]')).toBeTruthy()
    expect(cells.querySelector('[data-governance-policy-cell="tools"]')).toBeTruthy()
    // The locked cell renders the marker and NO editor.
    const toolsCell = cells.querySelector('[data-governance-policy-cell="tools"]')
    if (toolsCell === null) throw new Error('the tools cell did not render')
    expect(toolsCell.querySelector('[data-governance-policy-cell-kind]')).toBeNull()
    expect(toolsCell.textContent).toContain('locked')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('a policy commit sends a PARTIAL cell map on the projection state id (never invented) and pulls once', async () => {
    const face = makeFace({
      policyStateGet: vi.fn(() => Promise.resolve(okResponse({
        stateId: 'open',
        cells: {
          model: { locked: false, value: { kind: 'allow', items: ['deepseek-v4'] } },
          tools: { locked: false },
        },
      }, 'policyState.get'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-policy-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-cells]')).toBeTruthy()
    })
    // Edit ONLY the `tools` cell: allow with two items. `model` is left as
    // read, yet the commit map carries every non-`none` draft — the wire
    // value read back on review plus the user's edit (re-sending an
    // unchanged cell is idempotent, safe under both host partial-map
    // readings).
    const toolsKind = view.container.querySelector<HTMLSelectElement>('[data-governance-policy-cell="tools"] [data-governance-policy-cell-kind]')
    if (toolsKind === null) throw new Error('the tools kind select did not render')
    fireEvent.change(toolsKind, { target: { value: 'allow' } })
    const toolsItems = view.container.querySelector<HTMLInputElement>('[data-governance-policy-cell="tools"] [data-governance-policy-cell-items]')
    if (toolsItems === null) throw new Error('the tools items input did not render')
    fireEvent.change(toolsItems, { target: { value: 'bash, web' } })
    // The commit preview names every committed capability, in catalog order:
    // the wire value read back on review plus the user's edit.
    expect(view.container.querySelector('[data-governance-policy-preview]')?.textContent)
      .toBe('Will commit: model → allow [deepseek-v4] · tools → allow [bash, web]')
    fireEvent.click(button(view.container, '[data-governance-policy-commit]'))
    expect(face.policyStateSet).toHaveBeenCalledTimes(1)
    expect(face.policyStateSet).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      target: {
        stateId: 'open',
        cells: {
          model: { value: { kind: 'allow', items: ['deepseek-v4'] } },
          tools: { value: { kind: 'allow', items: ['bash', 'web'] } },
        },
      },
      actor: { kind: 'human' },
      // The frozen TS mirror over-constrains `target.cells` to the full
      // five-capability record, but the host parser accepts the PARTIAL map
      // the editor actually sends (only non-`none` drafts). The double cast
      // carries the wire truth (mirrors the model's builder cast); the
      // asserted object IS the runtime value, verbatim.
    } as unknown as RemotePolicyStateSetParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
      expect(view.container.querySelector('[data-governance-policy-error]')).toBeNull()
    })
    expect(face.pullProjection).toHaveBeenCalledWith(LEADER)
  })

  it('keeps the policy commit inert (no command, no preview) when the only draft is an allow with no items', async () => {
    const face = makeFace({
      policyStateGet: vi.fn(() => Promise.resolve(okResponse({
        stateId: 'open',
        cells: { model: { locked: false } },
      }, 'policyState.get'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-policy-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-cells]')).toBeTruthy()
    })
    // Select allow but leave the items empty → the allow cell commits nothing.
    const modelKind = view.container.querySelector<HTMLSelectElement>('[data-governance-policy-cell="model"] [data-governance-policy-cell-kind]')
    if (modelKind === null) throw new Error('the model kind select did not render')
    fireEvent.change(modelKind, { target: { value: 'allow' } })
    const commit = button(view.container, '[data-governance-policy-commit]')
    expect(commit.disabled).toBe(true)
    expect(view.container.querySelector('[data-governance-policy-preview]')).toBeNull()
    expect(face.policyStateSet).not.toHaveBeenCalled()
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('a policy commit typed failure renders verbatim and never pulls', async () => {
    const face = makeFace({
      policyStateGet: vi.fn(() => Promise.resolve(okResponse({
        stateId: 'open',
        cells: { tools: { locked: false } },
      }, 'policyState.get'))),
      policyStateSet: vi.fn(() => Promise.resolve(
        errorResponse('POLICY_INVALID', 'unknown capability', 'policyState.set', 'governance-1'),
      )),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    fireEvent.click(button(view.container, '[data-governance-policy-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-cells]')).toBeTruthy()
    })
    const toolsKind = view.container.querySelector<HTMLSelectElement>('[data-governance-policy-cell="tools"] [data-governance-policy-cell-kind]')
    if (toolsKind === null) throw new Error('the tools kind select did not render')
    fireEvent.change(toolsKind, { target: { value: 'deny' } })
    fireEvent.click(button(view.container, '[data-governance-policy-commit]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-governance-policy-error]')?.textContent)
      .toBe('Error: POLICY_INVALID: unknown capability [governance-1]')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('an override set targets the member instance (scope instance) and pulls once on success', async () => {
    const face = makeFace()
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    const memberBlock = view.container.querySelector('[data-governance-member="a"]')
    if (memberBlock === null) throw new Error('the member block did not render')
    // The default draft is capability=model, kind=allow, items=''.
    const items = memberBlock.querySelector<HTMLInputElement>('[data-governance-override-items]')
    if (items === null) throw new Error('the override items input did not render')
    fireEvent.change(items, { target: { value: 'deepseek-v4' } })
    const set = memberBlock.querySelector<HTMLButtonElement>('[data-governance-override-set]')
    if (set === null) throw new Error('the override set button did not render')
    fireEvent.click(set)
    expect(face.overrideSet).toHaveBeenCalledTimes(1)
    expect(face.overrideSet).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      capability: 'model',
      value: { kind: 'allow', items: ['deepseek-v4'] },
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: 'a',
    } satisfies RemoteOverrideSetParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
      expect(memberBlock.querySelector('[data-governance-override-set-error]')).toBeNull()
    })
    expect(face.pullProjection).toHaveBeenCalledWith(LEADER)
  })

  it('keeps the override set inert until an allow cell has items (no empty allow commit)', () => {
    const view = render(<TeamGovernance {...makeProps()} />)
    const memberBlock = view.container.querySelector('[data-governance-member="a"]')
    if (memberBlock === null) throw new Error('the member block did not render')
    const set = memberBlock.querySelector<HTMLButtonElement>('[data-governance-override-set]')
    if (set === null) throw new Error('the override set button did not render')
    expect(set.disabled).toBe(true)
  })

  it('an override reset targets the member instance (scope instance) and pulls once on success', async () => {
    const face = makeFace()
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    const memberBlock = view.container.querySelector('[data-governance-member="a"]')
    if (memberBlock === null) throw new Error('the member block did not render')
    const reset = memberBlock.querySelector<HTMLButtonElement>('[data-governance-override-reset]')
    if (reset === null) throw new Error('the override reset button did not render')
    fireEvent.click(reset)
    expect(face.overrideReset).toHaveBeenCalledTimes(1)
    expect(face.overrideReset).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      capability: 'model',
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: 'a',
    } satisfies RemoteOverrideResetParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
      expect(memberBlock.querySelector('[data-governance-override-reset-error]')).toBeNull()
    })
  })

  it('an override set typed failure renders verbatim and never pulls', async () => {
    const face = makeFace({
      overrideSet: vi.fn(() => Promise.resolve(
        errorResponse('OVERRIDE_LOCKED', 'cell locked by hard policy', 'override.set', 'governance-1'),
      )),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    const memberBlock = view.container.querySelector('[data-governance-member="a"]')
    if (memberBlock === null) throw new Error('the member block did not render')
    const items = memberBlock.querySelector<HTMLInputElement>('[data-governance-override-items]')
    if (items === null) throw new Error('the override items input did not render')
    fireEvent.change(items, { target: { value: 'deepseek-v4' } })
    const set = memberBlock.querySelector<HTMLButtonElement>('[data-governance-override-set]')
    if (set === null) throw new Error('the override set button did not render')
    fireEvent.click(set)
    await vi.waitFor(() => {
      expect(memberBlock.querySelector('[data-governance-override-set-error]')).toBeTruthy()
    })
    expect(memberBlock.querySelector('[data-governance-override-set-error]')?.textContent)
      .toBe('Error: OVERRIDE_LOCKED: cell locked by hard policy [governance-1]')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('an override show is a read (no projection pull) and renders the recorded override verbatim', async () => {
    const face = makeFace({
      overrideGet: vi.fn(() => Promise.resolve(okResponse({
        override: { kind: 'allow', items: ['deepseek-v4'] },
      }, 'override.get'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    const memberBlock = view.container.querySelector('[data-governance-member="a"]')
    if (memberBlock === null) throw new Error('the member block did not render')
    const show = memberBlock.querySelector<HTMLButtonElement>('[data-governance-override-show]')
    if (show === null) throw new Error('the override show button did not render')
    fireEvent.click(show)
    expect(face.overrideGet).toHaveBeenCalledTimes(1)
    expect(face.overrideGet).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      capability: 'model',
      scope: 'instance',
      targetInstanceId: 'a',
    } satisfies RemoteOverrideGetParams)
    await vi.waitFor(() => {
      expect(memberBlock.querySelector('[data-governance-override-read]')).toBeTruthy()
    })
    expect(memberBlock.querySelector('[data-governance-override-read]')?.textContent)
      .toBe('allow [deepseek-v4]')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('an override show renders the no-override note when the record is null (a read)', async () => {
    const face = makeFace({
      overrideGet: vi.fn(() => Promise.resolve(okResponse({ override: null }, 'override.get'))),
    })
    const view = render(<TeamGovernance {...makeProps(defaultTeam(), face)} />)
    const memberBlock = view.container.querySelector('[data-governance-member="a"]')
    if (memberBlock === null) throw new Error('the member block did not render')
    const show = memberBlock.querySelector<HTMLButtonElement>('[data-governance-override-show]')
    if (show === null) throw new Error('the override show button did not render')
    fireEvent.click(show)
    await vi.waitFor(() => {
      expect(memberBlock.querySelector('[data-governance-override-read]')).toBeTruthy()
    })
    expect(memberBlock.querySelector('[data-governance-override-read]')?.textContent)
      .toBe('No explicit human override')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('renders the effective-config lanes (model/workspace/permissions-sorted/autonomy) with the §18.3 state words', () => {
    const view = render(<TeamGovernance {...makeProps()} />)
    const lanes = view.container.querySelector('[data-governance-member="a"] [data-governance-lanes]')
    if (lanes === null) throw new Error('the lanes block did not render')
    const laneNames = [...lanes.querySelectorAll('[data-governance-lane]')].map(el => el.getAttribute('data-governance-lane'))
    expect(laneNames).toEqual(['model', 'workspace', 'permissions:bash', 'permissions:web', 'autonomy'])
    // The distinct state words (never unified "Disabled").
    expect(lanes.querySelector('[data-governance-lane-state="inherited"]')?.textContent).toBe('Inherited')
    expect(lanes.querySelector('[data-governance-lane-state="locked"]')?.textContent).toBe('Locked')
    expect(lanes.querySelector('[data-governance-lane-state="overridden"]')?.textContent).toBe('Overridden')
    // The effect-boundary flag from the v2 additive field.
    expect(lanes.textContent).toContain('effective from 7')
  })

  it('renders the §19 hard-policy display for a denied lane (never pretend an override wins)', () => {
    const view = render(<TeamGovernance {...makeProps()} />)
    const hard = view.container.querySelector('[data-governance-member="a"] [data-governance-hard-policy]')
    if (hard === null) throw new Error('the hard-policy span did not render')
    expect(hard.textContent).toBe('Requested: (no value) / Effective: Denied / Reason: org policy: no shell')
    // Only the denied lane carries the span.
    expect(view.container.querySelectorAll('[data-governance-member="a"] [data-governance-hard-policy]')).toHaveLength(1)
  })

  it('shows the effective-config empty note when no member carries a config DTO', () => {
    const view = render(<TeamGovernance {...makeProps(
      snapshot([
        instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA }),
        instance({ instanceId: 'b', templateId: 'tpl-a', label: 'Beta' }),
      ]),
    )} />)
    expect(view.container.querySelector('[data-governance-member]')).toBeNull()
    expect(screen.getByText('No effective config data for this member yet')).toBeTruthy()
  })

  it('pairs the zh and en dictionaries for the governance surface', () => {
    const zhView = render(<TeamGovernance {...makeProps(defaultTeam(), makeFace(), zh)} />)
    const badge = compatBadge(zhView.container)
    if (badge === null) throw new Error('the compatibility badge did not render')
    expect(badge.textContent).toBe('✓ 兼容')
    expect(zhView.container.querySelector<HTMLElement>('[data-governance-ack]')?.title)
      .toBe('兼容汇总只暴露聚合计数，未暴露逐项确认标识；无法逐项确认。')
    zhView.unmount()
    const enView = render(<TeamGovernance {...makeProps(defaultTeam(), makeFace(), en)} />)
    const enBadge = compatBadge(enView.container)
    if (enBadge === null) throw new Error('the compatibility badge did not render')
    expect(enBadge.textContent).toBe('✓ Compatible')
  })
})
