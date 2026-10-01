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

  // ACCEPTED LIMITATION — USER OPTION A (locked): payload+digest-absent
  // rows are not protocol-identifiable; the row keeps its plain SUBJECT
  // mode (here: defined template) with NO integrity gate, disclosed.
  // Option B (protocol marker + pre-execution integrity check) is
  // DEFERRED to Alpha3 — nothing B-shaped ships here. This is the GREEN
  // PIN of that accepted behavior (was a skipped PENDING test).
  it('ACCEPTED LIMITATION — USER OPTION A (pinned): MISSING reviewPayload (recovery correlation) → standard mode, NO banner, payload omitted, Allow ENABLED', () => {
    const model = pipeline([s9Request({ reviewPayload: undefined, reviewPayloadDigest: undefined })])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('standard')
    expect(panel.querySelector('[data-control-detail-cannot-review]')).toBeNull()
    // the payload block is OMITTED (never a 'null'/'undefined' invention).
    expect(detailField(panel, 'payload')).toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
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

// ---------------------------------------------------------------------------
// FROZEN BATCH item 1 (render): legal null/scalar/array reviewPayload
// values must survive the WHOLE adapter→DOM pipeline as inert safe text
// (the stock classifier crashed the entire TeamView on `null` — the
// `typeof null === 'object'` trap; see the model-level batch group).
// ---------------------------------------------------------------------------

describe('PR56 batch#1 render — null/scalar/array payloads are SAFE TEXT end-to-end, Allow unaffected', () => {
  it('reviewPayload NULL renders the inert text "null" — panel survives, standard-family mode, no banner, Allow ENABLED', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-null-p',
      kind: 'user-approval',
      targetInstanceId: 'mate',
      actionName: 'write_file',
      correlation: 'c-null-p',
      reviewPayload: null,
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-null-p')
    if (panel === null) throw new Error('the control panel did not materialize')
    const pre = detailField(panel, 'payload')?.querySelector('pre') ?? null
    expect(pre?.textContent).toBe('null')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('legacy-compatible')
    expect(panel.querySelector('[data-control-detail-cannot-review]')).toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
  })

  for (const [label, value, safeText] of [
    ['number', 42, '42'],
    ['boolean', true, 'true'],
    ['string', 'plain text', '"plain text"'],
  ] as const) {
    it(`reviewPayload ${label} renders as inert JSON text (${safeText}), never classified v1, Allow ENABLED`, () => {
      const model = pipeline([wireEntry(1, 'control-request-recorded', {
        requestId: `r-sc-${label}`,
        kind: 'user-approval',
        targetInstanceId: 'mate',
        actionName: 'write_file',
        correlation: `c-sc-${label}`,
        reviewPayload: value,
      })])
      const view = renderLedger(model)
      const panel = panelOf(view, `r-sc-${label}`)
      if (panel === null) throw new Error('the control panel did not materialize')
      expect(detailField(panel, 'payload')?.querySelector('pre')?.textContent).toBe(safeText)
      expect(detailField(panel, 'render-mode')?.textContent).toContain('legacy-compatible')
      const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
      expect(allow?.disabled).toBe(false)
    })
  }

  it('reviewPayload ARRAY renders losslessly as JSON text (round-trips through JSON.parse)', () => {
    const value = ['alpha', 1, null]
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-sc-array',
      kind: 'user-approval',
      targetInstanceId: 'mate',
      actionName: 'write_file',
      correlation: 'c-sc-array',
      reviewPayload: value,
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-sc-array')
    if (panel === null) throw new Error('the control panel did not materialize')
    const pre = detailField(panel, 'payload')?.querySelector('pre') ?? null
    if (pre === null) throw new Error('the payload block did not materialize')
    expect(JSON.parse(pre.textContent ?? '')).toEqual(value)
  })
})

// ---------------------------------------------------------------------------
// FROZEN BATCH item 2 (render): contradictory subject shapes are
// non-decidable END-TO-END (explicit malformed subject → unsupported
// presentation, Allow disabled; the server rejects these at write time —
// display-side fail-closed, no protocol change).
// ---------------------------------------------------------------------------

describe('PR56 batch#2 render — contradictory subjects are non-decidable end-to-end', () => {
  it('template subject + EXTRA instanceId leaf → unsupported-subject panel + Allow DISABLED + Deny enabled', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-b2a-p',
      kind: 'user-approval',
      actionName: 'delegate',
      correlation: 'c-b2a-p',
      subject: { kind: 'template', templateId: 'worker', instanceId: 'ghost' },
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-b2a-p')
    if (panel === null) throw new Error('the contradictory panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('unsupported-subject')
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
    expect(deny?.disabled).toBe(false)
    // the row STAYS visible (never a silent drop).
    expect(view.container.querySelector('[data-ledger-row]')).not.toBeNull()
  })

  it('team subject + legacy targetInstanceId leaf → unsupported-subject panel + Allow DISABLED', () => {
    const model = pipeline([wireEntry(1, 'control-request-recorded', {
      requestId: 'r-b2c-p',
      kind: 'user-approval',
      actionName: 'team.close',
      correlation: 'c-b2c-p',
      subject: { kind: 'team', rootSessionId: LEADER },
      targetInstanceId: 'mate',
    })])
    const view = renderLedger(model)
    const panel = panelOf(view, 'r-b2c-p')
    if (panel === null) throw new Error('the team+target panel did not materialize')
    expect(detailField(panel, 'render-mode')?.textContent).toContain('unsupported-subject')
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// FROZEN BATCH item 3 (CSS specificity): `.controlField dd` (0,1,1) with
// the ellipsis trio (overflow:hidden / text-overflow:ellipsis /
// white-space:nowrap) OUT-SPECIFIES a lone `.controlDigestValue` (0,1,0)
// — in a narrow panel the FULL wire digest would render TRUNCATED,
// breaking the never-truncated promise. The override must be
// `.controlField dd.controlDigestValue` (0,1,2). HONEST ASSERTION SCOPE:
// jsdom does not apply the CSS-module cascade to the document, so the
// test asserts (a) the class lands on the digest dd through the REAL
// pipeline and (b) the stylesheet carries the (0,1,2) override with the
// beating declarations — a STATIC specificity assertion, not a rendered
// layout check (the narrow-panel wrap check lands in real-UI acceptance).
// ---------------------------------------------------------------------------

describe('PR56 batch#3 — the full digest beats the ellipsis: (0,1,2) stylesheet override + class application', () => {
  it('the digest dd carries controlDigestValue through the real pipeline', () => {
    const model = pipeline([s9Request()])
    const view = renderLedger(model)
    const panel = panelOf(view, S9_REQUEST_ID)
    if (panel === null) throw new Error('the control panel did not materialize')
    const dd = panel.querySelector('[data-control-detail-digest] dd')
    if (dd === null) throw new Error('the digest field did not materialize')
    expect(dd.getAttribute('class') ?? '').toContain('controlDigestValue')
    expect(dd.textContent).toContain(S9_WIRE_DIGEST)
  })

  it('the stylesheet defines .controlField dd.controlDigestValue (0,1,2) beating the .controlField dd ellipsis (0,1,1) — STATIC specificity assertion (jsdom does not apply the CSS-module cascade)', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    // Env-agnostic path resolution (jsdom rewrites import.meta.url and
    // vitest's css:false stubs `?raw` for CSS): walk up from the cwd to
    // the client package root and read the stylesheet as TEXT.
    const { join } = await import('node:path')
    let cssPath: string | undefined
    let dir = process.cwd()
    for (let i = 0; i < 7; i += 1) {
      for (const candidate of [
        join(dir, 'src', 'ui', 'TeamLedger.module.css'),
        join(dir, 'packages', 'client', 'src', 'ui', 'TeamLedger.module.css'),
      ]) {
        if (existsSync(candidate)) { cssPath = candidate; break }
      }
      if (cssPath !== undefined) break
      const parent = join(dir, '..')
      if (parent === dir) break
      dir = parent
    }
    if (cssPath === undefined) throw new Error('TeamLedger.module.css not found from the test cwd')
    const css = readFileSync(cssPath, 'utf8')
    /** The specificity of a plain selector (a,b,c) as a comparable tuple sum-free key. */
    const specificity = (selector: string): string => {
      const classes = (selector.match(/\.[\w-]+/g) ?? []).length
      const elements = (selector.replace(/[#.][\w-]+/g, '').match(/[a-z][\w-]*/gi) ?? []).length
      return `${classes},${elements}`
    }
    const ellipsisRule = css.match(/\.controlField dd\s*\{[^}]*\}/)
    const overrideRule = css.match(/\.controlField dd\.controlDigestValue\s*\{[^}]*\}/)
    if (ellipsisRule === null || overrideRule === null) {
      throw new Error('the ellipsis rule or the (0,1,2) digest override rule is missing from the stylesheet')
    }
    expect(specificity('.controlField dd')).toBe('1,1')
    expect(specificity('.controlField dd.controlDigestValue')).toBe('2,1')
    // the override re-declares the ellipsis trio's beating pair.
    expect(overrideRule[0]).toMatch(/overflow:\s*visible/)
    expect(overrideRule[0]).toMatch(/white-space:\s*normal/)
    expect(overrideRule[0]).toMatch(/word-break:\s*break-all/)
    // and the ellipsis trio stays where it belongs (the base rule).
    expect(ellipsisRule[0]).toMatch(/text-overflow:\s*ellipsis/)
    expect(ellipsisRule[0]).toMatch(/white-space:\s*nowrap/)
  })
})

// ---------------------------------------------------------------------------
// FORMAL GO (parent ruling) — run5 380px geometry FAIL, minimal CSS width
// budget fix. ROOT CAUSE (read-only diagnosis, evidence in the PR #56
// SUMMARY addendum): `.resolveBar` is ONE non-wrapping flex line, so the
// `flex:none` command buttons + gaps (~128px) squeeze `.controlDetail`
// (`flex: 1 1 auto; min-width: 0`) to ~60px; inside it the non-shrinking
// `.controlField dt` labels (~160px max-content) leave ≤0 for the
// `min-width: 0` values, and the digest's deliberate `break-all` makes
// the value's min-content ONE CHARACTER (980px one-char column at 380).
// THE RULES ASSERTED HERE (arithmetic, not declaration count — at the
// 380 panel the bar content box is ~181px):
//   ① `.resolveBar{ flex-wrap: wrap }` — the bar may break to two lines;
//   ② `.controlDetail{ flex: 1 1 min(100%, 20rem) }` — basis floor: at a
//     181px bar the dl basis resolves through min() to 181 → it takes
//     line 1 ALONE (grow fills it), the ~112px button pair moves to line
//     2 (181+8+112 > 181 wraps); at a wide bar (≥ ~452px) the 20rem
//     basis + grow keeps buttons right beside it — the 1440/675 layout
//     is preserved by the SAME min() (basis = min(container, 320) ≤
//     container, so line 1 fits);
//   ③ `.controlField{ flex-wrap: wrap }` — a line break is forced
//     exactly when dt + gap + dd flex-BASES exceed the field box, so the
//     value lands on its own line at the FULL dl width (the parent
//     warning — dt 160 + dd sharing the line with a collapsed basis —
//     cannot occur: same-line presence REQUIRES both bases to fit);
//   ④ `.row{ flex-wrap: wrap }` — a chip/badge too wide for the row
//     drops to its own line instead of clipping under `.rows` overflow.
// STATIC stylesheet assertions (jsdom performs no layout — same honesty
// discipline as the batch #3 specificity pin).
// ---------------------------------------------------------------------------

async function readLedgerStylesheet(): Promise<string> {
  const { readFileSync, existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  let dir = process.cwd()
  for (let i = 0; i < 7; i += 1) {
    for (const candidate of [
      join(dir, 'src', 'ui', 'TeamLedger.module.css'),
      join(dir, 'packages', 'client', 'src', 'ui', 'TeamLedger.module.css'),
    ]) {
      if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
    }
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('TeamLedger.module.css not found from the test cwd')
}

describe('PR56 run5 geometry fix — STATIC width-budget rules (wrap + flex-basis floor; jsdom performs no layout)', () => {
  it('① .resolveBar wraps (the flex:none command buttons may take their own line)', async () => {
    const css = await readLedgerStylesheet()
    const rule = css.match(/\.resolveBar\s*\{[^}]*\}/)
    if (rule === null) throw new Error('the .resolveBar rule is missing')
    expect(rule[0]).toMatch(/flex-wrap:\s*wrap/)
  })

  it('② .controlDetail carries the min(100%, 20rem) flex-basis floor (full bar width at 380, right-beside buttons at 1440)', async () => {
    const css = await readLedgerStylesheet()
    const rule = css.match(/\.controlDetail\s*\{[^}]*\}/)
    if (rule === null) throw new Error('the .controlDetail rule is missing')
    expect(rule[0]).toMatch(/flex:\s*1 1 min\(100%,\s*20rem\)/)
  })

  it('③ .controlField wraps (dt + dd share a line ONLY while both bases fit; the value then gets the full dl width on its own line)', async () => {
    const css = await readLedgerStylesheet()
    const rule = css.match(/\.controlField\s*\{[^}]*\}/)
    if (rule === null) throw new Error('the .controlField rule is missing')
    expect(rule[0]).toMatch(/flex-wrap:\s*wrap/)
  })

  it('④ .row wraps (fixed flex:none siblings drop to their own line instead of clipping under .rows)', async () => {
    const css = await readLedgerStylesheet()
    const rule = css.match(/\.row\s*\{[^}]*\}/)
    if (rule === null) throw new Error('the .row rule is missing')
    expect(rule[0]).toMatch(/flex-wrap:\s*wrap/)
  })
})
