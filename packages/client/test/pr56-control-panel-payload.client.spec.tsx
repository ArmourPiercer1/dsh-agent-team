// @vitest-environment jsdom
/**
 * PR #56 (client-only fix) — the pending control-request DETAIL panel
 * renders the durable SUBJECT, the VISIBLE requestId, the FULL wire
 * reviewPayloadDigest (labeled as wire-sourced), and the FULL
 * reviewPayload as SAFE TEXT; the recovery-dispatch/v1 payload-integrity
 * gate disables Allow (never a silent omit-then-approve).
 *
 * Real pipeline (no hand-built chains): the wire `RemoteLedgerEntryValue`
 * rows go through the pure `adaptTeamLedger` into the model, then the
 * `TeamLedger` Events section renders them — the exact production chain
 * where today's `ledger-adapter.ts` L203-206 silently drops every
 * non-instance subject (the S9 `template:worker` case) and the panel
 * never materializes.
 *
 * Payload rendering invariants (coordinator law):
 *  - React TEXT NODE inside <pre> — no HTML interpretation: an
 *    HTML-string payload value must never create an element;
 *  - FULL content, never truncated (the block parses back to the exact
 *    reviewed value);
 *  - `requestToken` is a governance correlation token — displayed
 *    normally, no name-based masking;
 *  - the digest is displayed verbatim, labeled "ledger wire:
 *    reviewPayloadDigest" (the client does not recompute it).
 */
import { cleanup, render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { RemoteLedgerEntryValue, RemoteResponse } from '../../remote/src/index.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { TeamUiLedgerModel, TeamUiSnapshot } from '../src/model/team-ui-snapshot.js'
import { adaptTeamLedger } from '../src/model/ledger-adapter.js'
import { TeamLedger, type TeamLedgerProps } from '../src/ui/TeamLedger.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'team-leader'
const T = 1_700_000_000_000

afterEach(cleanup)
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
})
afterEach(() => {
  delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture
})

const snapshot = {
  teamSessionId: LEADER,
  generation: 1,
  templates: [
    { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
    { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
  ],
  members: [
    { instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: null },
    { instanceId: 'mate', templateId: 'tpl-mate', label: 'Mate', childSessionId: 'team-member' },
  ],
} as unknown as TeamUiSnapshot

/** The published store state over the adapter's rows (known complete). */
function stateFor(model: TeamUiLedgerModel): TeamLedgerState {
  const entriesBySequence = new Map(model.entries.map(row => [row.sequence, row]))
  const last = model.entries[model.entries.length - 1]
  return {
    teamSessionId: LEADER,
    entriesBySequence: entriesBySequence as unknown as ReadonlyMap<number, RemoteLedgerEntryValue>,
    orderedSequences: model.entries.map(row => row.sequence),
    total: model.entries.length,
    completeThrough: last?.sequence ?? 0,
    loading: false,
  } as unknown as TeamLedgerState
}

/** The REAL pipeline: wire entries → the pure adapter → the model. */
function pipeline(entries: readonly RemoteLedgerEntryValue[]): TeamUiLedgerModel {
  return adaptTeamLedger(entries, true)
}

function wireEntry(sequence: number, factType: string, payload: Record<string, unknown>): RemoteLedgerEntryValue {
  return {
    schemaVersion: 2,
    sequence,
    rootSessionId: LEADER,
    factType,
    payload,
    operationId: null,
    createdAt: new Date(T).toISOString(),
  } as unknown as RemoteLedgerEntryValue
}

function renderLedger(model: TeamUiLedgerModel, overrides: Partial<TeamLedgerProps> = {}): RenderResult {
  const props: TeamLedgerProps = {
    snapshot,
    ledger: model,
    ledgerState: stateFor(model),
    onRetry: vi.fn(() => Promise.resolve()),
    onSelectSession: vi.fn(),
    onResolveControl: vi.fn(
      () => Promise.resolve({ ok: true, value: { data: {}, provenance: {} } } as unknown as RemoteResponse),
    ),
    controlSurfaceMode: 'enabled',
    t: makeTranslate(zh),
    ...overrides,
  }
  return render(<TeamLedger {...props} />)
}

const panelOf = (view: RenderResult, requestId: string): HTMLElement | null =>
  view.container.querySelector(`[data-ledger-resolve-bar][data-request-id="${requestId}"]`)

const detailField = (panel: HTMLElement | null, name: string): HTMLElement | null =>
  panel?.querySelector(`[data-control-detail-${name}]`) ?? null

// ---------------------------------------------------------------------------
// The golden S9 shape (hand-modeled from the historical record @1385f1ee;
// the evidence file itself stays unstaged)
// ---------------------------------------------------------------------------

const S9_REVIEW_PAYLOAD: Record<string, unknown> = {
  action: 'delegate',
  blockedScopes: ['template:worker'],
  caller: { instanceId: 'lead', kind: 'instance' },
  downedCapabilitySubjects: ['mcp_web'],
  effect:
    'allow: exactly ONE reviewed recovery attempt of this operation on the reduced original authority; ' +
    'deny/abandon: zero durable effect (the operation remains blocked)',
  reducedAuthority: {
    externalHardCeiling: 'absolute (never bypassed)',
    otherwise: 'unchanged (the original permissions apply)',
    policy: 'reduced original authority (plan §E.9)',
    unavailableSubjects: ['mcp_web'],
  },
  requestedOperation: "one recovery attempt of 'delegate' on template 'worker'",
  rootSessionId: LEADER,
  schema: 'dsh-agent-team/recovery-dispatch/v1',
  templateId: 'worker',
}

const S9_WIRE_DIGEST = 'sha256:6b3a9145e46f1b2a2cfa7b195256536eccc9514b38fbfec21b6f567d02d32d41'
const S9_REQUEST_ID = 'ctrl-1keen2j0xnkvtq019xw7d0d0'

const s9Request = (extra: Record<string, unknown> = {}): RemoteLedgerEntryValue =>
  wireEntry(23, 'control-request-recorded', {
    actionName: 'delegate',
    correlation: 'recovery:rt-b3a-prereq-2026-09-30T03-07-57:1',
    executionCoupling: 'inline',
    kind: 'user-approval',
    requestId: S9_REQUEST_ID,
    requester: { instanceId: 'lead', kind: 'instance', role: 'leader' },
    reviewPayload: S9_REVIEW_PAYLOAD,
    reviewPayloadDigest: S9_WIRE_DIGEST,
    subject: { kind: 'template', templateId: 'worker' },
    summary:
      "recovery dispatch: one reviewed attempt of 'delegate' on the blocked scope(s) " +
      '[template:worker] on the reduced original authority',
    ...extra,
  })

// ---------------------------------------------------------------------------

describe('PR56 render — the S9 template-subject panel materializes (today: no panel at all)', () => {
  it('the pending template request renders the detail panel with subject + VISIBLE requestId', () => {
    const model = pipeline([s9Request()])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize for the template subject')
    // subject: kind + id verbatim.
    const subject = detailField(panel, 'subject')
    expect(subject?.textContent).toContain('template')
    expect(subject?.textContent).toContain('worker')
    // requestId: a VISIBLE field (attribute-only is insufficient).
    const requestId = detailField(panel, 'request-id')
    expect(requestId?.textContent).toContain(S9_REQUEST_ID)
    // the §26.2 existing fields stay (action / reason / time / status).
    expect(detailField(panel, 'action')?.textContent).toContain('delegate')
    expect(detailField(panel, 'status')?.textContent).toContain('等待裁决')
  })

  it('renders the FULL wire digest verbatim, labeled wire-sourced', () => {
    const view = renderLedger(pipeline([s9Request()]))
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    const digest = detailField(panel, 'digest')
    expect(digest?.textContent).toContain(S9_WIRE_DIGEST)
    expect(digest?.getAttribute('data-digest-source')).toBe('ledger-wire')
    expect(digest?.textContent).toContain('ledger wire: reviewPayloadDigest')
  })

  it('renders the FULL reviewPayload as inert text that parses back to the exact reviewed value', () => {
    const view = renderLedger(pipeline([s9Request()]))
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    const payload = detailField(panel, 'payload')
    if (payload === null) throw new Error('the payload block did not render')
    const pre = payload.querySelector('pre')
    if (pre === null) throw new Error('the payload block is not a <pre> text block')
    // FULL content: the rendered text parses back to the exact payload.
    expect(JSON.parse(pre.textContent ?? '')).toEqual(S9_REVIEW_PAYLOAD)
    // a deep leaf is present verbatim (never sampled / truncated).
    expect(pre.textContent).toContain('reduced original authority (plan §E.9)')
  })

  it('shows the recovery-dispatch/v1 rendering mode and keeps BOTH commands live for a reviewable request', () => {
    const view = renderLedger(pipeline([s9Request()]))
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('recovery-dispatch/v1')
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
    expect(deny?.disabled).toBe(false)
    expect(panel.querySelector('[data-control-detail-cannot-review]')).toBeNull()
  })

  it('displays the requestToken VERBATIM (governance correlation token — no name-based masking)', () => {
    const withToken = {
      schema: 'dsh-agent-team/recovery-dispatch/v1',
      toolName: 'delegate',
      rootSessionId: LEADER,
      requestToken: 'rt-b3a-prereq-2026-09-30T03-07-57',
      subject: { kind: 'template', templateId: 'worker' },
      arguments: { taskSummary: 'retry the downed delegation' },
    }
    const model = pipeline([s9Request({
      reviewPayload: withToken,
      reviewPayloadDigest: `sha256:${'0'.repeat(64)}`,
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    const payload = detailField(panel, 'payload')
    expect(payload?.textContent).toContain('rt-b3a-prereq-2026-09-30T03-07-57')
    expect(payload?.textContent).toContain('requestToken')
  })

  it('renders HTML-shaped payload content as INERT TEXT (no element injection)', () => {
    const evil = {
      schema: 'dsh-agent-team/recovery-dispatch/v1',
      arguments: { note: '<img src=x onerror="alert(1)"><script>alert(2)</script>' },
    }
    const model = pipeline([s9Request({
      reviewPayload: evil,
      reviewPayloadDigest: `sha256:${'1'.repeat(64)}`,
    })])
    const view = renderLedger(model)
    // NO element injection anywhere in the panel/DOM.
    expect(view.container.querySelector('img')).toBeNull()
    expect(view.container.querySelector('script')).toBeNull()
    const panel = panelOf(view, S9_REQUEST_ID)
    const payload = detailField(panel, 'payload')
    // the markup survives verbatim as TEXT (lossless display; the JSON
    // serializer escapes the inner quotes — still inert text).
    expect(payload?.textContent).toContain('<img src=x onerror=\\"alert(1)\\"')
    expect(payload?.textContent).toContain('<script>alert(2)</script>')
  })
})

describe('PR56 render — recovery-dispatch/v1 integrity gate (Allow disabled, deny stays safe)', () => {
  it('v1 with NO digest → explicit cannot-fully-review banner + Allow disabled, Deny enabled', () => {
    const model = pipeline([s9Request({ reviewPayloadDigest: undefined })])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    expect(panel.querySelector('[data-control-detail-cannot-review]')).not.toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
    expect(deny?.disabled).toBe(false)
  })

  // DECLARED UNKNOWN #1 — decision pending (options A/B before the user) on
  // the PAYLOAD-ABSENT recovery-request classifier (positive-ID-only
  // shipped; see the PENDING block in ledger-adapter.ts).
  it.skip('PENDING USER DECISION (options A/B) — v1 with a MISSING reviewPayload (recovery correlation) → banner + Allow disabled (not shipped)', () => {
    const model = pipeline([s9Request({ reviewPayload: undefined, reviewPayloadDigest: undefined })])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    expect(panel.querySelector('[data-control-detail-cannot-review]')).not.toBeNull()
    expect(detailField(panel, 'payload')).toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
  })

  it('v1 with a CORRUPTED (non-lossless) reviewPayload → omitted + banner + Allow disabled', () => {
    const model = pipeline([s9Request({
      reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1', bad: Number.NaN },
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    expect(detailField(panel, 'payload')).toBeNull()
    expect(panel.querySelector('[data-control-detail-cannot-review]')).not.toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
  })

  it('the cannot-fully-review banner text renders (en dictionary)', () => {
    const model = pipeline([s9Request({ reviewPayloadDigest: undefined })])
    const view = renderLedger(model, { t: makeTranslate(en) })
    const panel = panelOf(view, S9_REQUEST_ID)
    const banner = panel?.querySelector('[data-control-detail-cannot-review]') ?? null
    expect(banner?.textContent).toContain('Cannot fully review')
  })

  it('DEFENSE-IN-DEPTH: digest present + payload absent (non-v1 legacy line) → banner + Allow disabled (classification stays neutral, no v1 claim)', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-dwp',
      kind: 'user-approval',
      targetInstanceId: 'mate',
      actionName: 'write_file',
      correlation: 'c-dwp',
      reviewPayloadDigest: `sha256:${'2'.repeat(64)}`,
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-dwp')
    if (panel === null) throw new Error('the control panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('legacy-compatible')
    expect(detailField(panel, 'payload')).toBeNull()
    expect(panel.querySelector('[data-control-detail-cannot-review]')).not.toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
    expect(deny?.disabled).toBe(false)
  })
})

describe('PR56 render — compat modes', () => {
  it('a LEGACY no-payload instance fact keeps the legacy panel + the labeled compat mode', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-legacy',
      kind: 'user-approval',
      targetInstanceId: 'mate',
      actionName: 'write_file',
      toolName: 'file',
      correlation: 'c-legacy',
      requester: { kind: 'instance', instanceId: 'mate' },
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-legacy')
    if (panel === null) throw new Error('the legacy control panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('legacy-compatible')
    // the §26.2 fields stay byte-identical in meaning.
    expect(detailField(panel, 'requester')?.textContent).toBe('请求方Mate')
    expect(detailField(panel, 'authority')?.textContent).toBe('请求权限human')
    // no payload / digest fields invented.
    expect(detailField(panel, 'payload')).toBeNull()
    expect(detailField(panel, 'digest')).toBeNull()
    // the commands stay live (no integrity gate for legacy facts).
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
  })

  it('a DEFINED template subject without any payload requirement renders the standard mode', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-tpl-plain',
      kind: 'user-approval',
      actionName: 'template.archive',
      correlation: 'c-tpl',
      subject: { kind: 'template', templateId: 'worker' },
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-tpl-plain')
    if (panel === null) throw new Error('the template control panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('standard')
    expect(detailField(panel, 'subject')?.textContent).toContain('template')
    expect(panel.querySelector('[data-control-detail-cannot-review]')).toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
  })

  it('an UNKNOWN subject stays visible in the unsupported mode with Allow disabled (Deny stays)', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-unknown',
      kind: 'user-approval',
      actionName: 'a',
      correlation: 'c1',
      subject: { kind: 'quantum', qId: 'x' },
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-unknown')
    if (panel === null) throw new Error('the unknown-subject panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('unsupported-subject')
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
    expect(deny).not.toBeNull()
    expect(deny?.disabled).toBe(false)
  })

  it('a decided non-instance fact leaves no resolve bar (no orphaned pending)', () => {
    const model = pipeline([
      s9Request(),
      wireEntry(30, 'control-decision-recorded', {
        requestId: S9_REQUEST_ID,
        decision: 'allow_once',
        scope: {
          rootSessionId: LEADER,
          subject: { kind: 'template', templateId: 'worker' },
          actionName: 'delegate',
        },
        requestSequence: 23,
      }),
    ])
    const view = renderLedger(model)
    expect(panelOf(view, S9_REQUEST_ID)).toBeNull()
  })

  it('RULED UNIFORM: a terminal abandon fact leaves no resolve bar and no Allow for ANY subject (instance case, the stock-master defect)', () => {
    const model = pipeline([
      wireEntry(1, 'control-request-recorded', {
        requestId: 'r-inst-ab',
        kind: 'user-approval',
        targetInstanceId: 'mate',
        actionName: 'write_file',
        correlation: 'c1',
      }),
      wireEntry(2, 'control-request-abandoned', {
        requestId: 'r-inst-ab',
        rootSessionId: LEADER,
        abandonedAt: new Date(T + 1000).toISOString(),
        reason: 'inline-abort',
      }),
    ])
    const view = renderLedger(model)
    // the row stays VISIBLE (append-only facts, never hidden)…
    expect(view.container.querySelector('[data-ledger-row]')).not.toBeNull()
    // …but the request is closed: no resolve bar, hence no Allow.
    expect(panelOf(view, 'r-inst-ab')).toBeNull()
  })

  it('RULED UNIFORM: a terminal abandon fact closes the S9 template chain too (no resolve bar)', () => {
    const model = pipeline([
      s9Request(),
      wireEntry(40, 'control-request-abandoned', {
        requestId: S9_REQUEST_ID,
        rootSessionId: LEADER,
        abandonedAt: new Date(T + 1000).toISOString(),
      }),
    ])
    const view = renderLedger(model)
    expect(panelOf(view, S9_REQUEST_ID)).toBeNull()
  })

  it('CRITICAL NEGATIVE (render): NO durable abandon entry → panel stays rendered with Allow ENABLED (a narrated wait-cancel with no durable fact flips nothing)', () => {
    const model = pipeline([
      wireEntry(1, 'control-request-recorded', {
        requestId: 'r-live',
        kind: 'user-approval',
        targetInstanceId: 'mate',
        actionName: 'write_file',
        correlation: 'c1',
      }),
    ])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-live')
    if (panel === null) throw new Error('the control panel did not materialize')
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
    expect(panel.querySelector('[data-control-detail-cannot-review]')).toBeNull()
  })
})
