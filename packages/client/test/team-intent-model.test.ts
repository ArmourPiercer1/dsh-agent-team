/**
 * New Team intent model (P9-T7, UI §4.3–§9, plan S5-A): the frozen
 * `catalog.list` / `catalog.get` / `intent.probe` data parsers (loud
 * failures on unknown closed-set values — never a silent "ready"), the
 * create gate (label + enablement from the probe verdict, the warning ack,
 * and the initial-work text), the §7.4 complete-persona FATAL detector,
 * the runtime-preset default preselect, the page-run intent draft, the
 * persona environment-fact bridge (the only frozen channel by which the
 * selected preset reaches the pre-creation probe), and the native
 * workspace option mapping.
 *
 * Legacy spec evidence: NEW module (the legacy fork has no vNext intent
 * object model — the frozen Architecture replaces the legacy
 * "create team from config" flow); no legacy test to migrate or drop.
 */
import { describe, expect, it } from 'vitest'
import {
  emptyTeamIntentDraft,
  intentCreateGate,
  intentEnvironmentFacts,
  isPersonaPresetFatal,
  parseBlueprintDetail,
  parseCatalogList,
  parseCompatibilityResult,
  selectDefaultPresetId,
  teamWorkspaceOptions,
  type IntentCompatibility,
  type TeamPresetRow,
} from '../src/model/team-intent-model.js'

function compat(status: string, requirements: unknown[]): IntentCompatibility {
  const parsed = parseCompatibilityResult({ compatibility: { status, requirements } })
  if (!parsed.ok) throw new Error(`fixture probe failed to parse: ${parsed.message}`)
  return parsed
}

describe('parseCatalogList', () => {
  it('parses the blueprint rows with the latest revision and drops malformed rows', () => {
    const parsed = parseCatalogList({
      blueprints: [
        { blueprintId: 'bp-a', revisions: [1, 3, 2] },
        { blueprintId: 'bp-b', revisions: [2] },
        { revisions: [1] },
        { blueprintId: 'bp-c', revisions: [] },
        { blueprintId: 'bp-d', revisions: ['x'] },
        'not-a-record',
      ],
    })
    expect(parsed).toEqual({
      ok: true,
      rows: [
        { blueprintId: 'bp-a', revisions: [1, 3, 2], latestRevision: 3 },
        { blueprintId: 'bp-b', revisions: [2], latestRevision: 2 },
      ],
    })
  })

  it('fails loud on a malformed envelope (the panel shows its catalog error state)', () => {
    for (const data of [null, {}, { blueprints: 'no' }]) {
      const parsed = parseCatalogList(data)
      expect(parsed.ok).toBe(false)
    }
    // A well-formed envelope whose rows are all malformed parses to zero rows.
    expect(parseCatalogList({ blueprints: [42] })).toEqual({ ok: true, rows: [] })
  })
})

describe('parseBlueprintDetail', () => {
  it('parses the display name, description, source, and template count', () => {
    const detail = parseBlueprintDetail({
      blueprint: {
        blueprintId: 'bp-a',
        revision: 3,
        displayName: 'Atlas Team',
        description: 'The atlas blueprint.',
        metadata: { source: 'builtin' },
        members: [{ templateId: 't1' }, { templateId: 't2' }],
      },
    })
    expect(detail).toEqual({
      blueprintId: 'bp-a',
      revision: 3,
      displayName: 'Atlas Team',
      description: 'The atlas blueprint.',
      source: 'builtin',
      templateCount: 2,
    })
  })

  it('returns undefined for a malformed envelope (the panel falls back to the id label)', () => {
    expect(parseBlueprintDetail(null)).toEqual(undefined)
    expect(parseBlueprintDetail({})).toEqual(undefined)
    expect(parseBlueprintDetail({ blueprint: { revision: 1 } })).toEqual(undefined)
  })
})

describe('parseCompatibilityResult', () => {
  it('parses an OPEN verdict with PASS rows only as ready (no warning/fatal rows)', () => {
    const parsed = compat('OPEN', [
      { outcome: 'PASS', requirementId: 'req-persona-team' },
    ])
    expect(parsed).toEqual({
      ok: true,
      status: 'OPEN',
      warnings: [],
      fatals: [],
    })
  })

  it('separates the WARNING and FATAL rows with their owner, subjects, and remedy data', () => {
    const parsed = compat('BLOCKED_FATAL', [
      {
        outcome: 'WARNING',
        requirementId: 'req-tool-bash',
        unavailableSubjects: ['bash'],
        detail: 'tool unavailable in the probed environment',
      },
      {
        outcome: 'FATAL',
        requirementId: 'req-persona-team',
        unavailableSubjects: ['team'],
        detail: 'the complete persona requirement is unmet',
        complete: true,
        reasonCode: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
      },
    ])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.status).toBe('BLOCKED_FATAL')
    expect(parsed.warnings).toEqual([{
      requirementId: 'req-tool-bash',
      unavailableSubjects: ['bash'],
      detail: 'tool unavailable in the probed environment',
      complete: false,
    }])
    expect(parsed.fatals).toEqual([{
      requirementId: 'req-persona-team',
      unavailableSubjects: ['team'],
      detail: 'the complete persona requirement is unmet',
      complete: true,
      reasonCode: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
    }])
  })

  it('fails loud on an unknown status or an unknown requirement outcome (never a silent "ready")', () => {
    expect(parseCompatibilityResult({ compatibility: { status: 'MAYBE' } })).toEqual({
      ok: false,
      message: 'intent.probe: unknown compatibility status MAYBE',
    })
    expect(parseCompatibilityResult({
      compatibility: { status: 'OPEN', requirements: [{ outcome: 'BLOCKED' }] },
    })).toEqual({
      ok: false,
      message: 'intent.probe: unknown requirement outcome BLOCKED',
    })
    expect(parseCompatibilityResult({}).ok).toBe(false)
  })
})

describe('intentCreateGate', () => {
  it('enables "Create" for a ready (OPEN) verdict without initial work, and "Create & Send" with it', () => {
    const open = compat('OPEN', [])
    expect(intentCreateGate(open, false, false, '')).toEqual({ label: 'create', enabled: true })
    expect(intentCreateGate(open, false, false, '   ')).toEqual({ label: 'create', enabled: true })
    expect(intentCreateGate(open, false, false, 'ship it')).toEqual({ label: 'createAndSend', enabled: true })
  })

  it('gates BLOCKED_WARNING behind the explicit acknowledgement and admits DEGRADED_ACKNOWLEDGED', () => {
    const warning = compat('BLOCKED_WARNING', [])
    expect(intentCreateGate(warning, false, false, '')).toEqual({ label: 'acknowledge', enabled: false })
    expect(intentCreateGate(warning, false, true, '')).toEqual({ label: 'acknowledge', enabled: true })
    expect(intentCreateGate(compat('DEGRADED_ACKNOWLEDGED', []), false, false, '')).toEqual({
      label: 'create',
      enabled: true,
    })
  })

  it('keeps Create disabled while checking, on an unknown verdict, and on FATAL', () => {
    expect(intentCreateGate(undefined, true, false, '')).toEqual({ label: 'create', enabled: false })
    expect(intentCreateGate(undefined, false, false, '')).toEqual({ label: 'create', enabled: false })
    expect(intentCreateGate(compat('BLOCKED_FATAL', []), false, true, '')).toEqual({
      label: 'create',
      enabled: false,
    })
    expect(intentCreateGate({ ok: false, message: 'boom' }, false, false, '')).toEqual({
      label: 'create',
      enabled: false,
    })
  })
})

describe('isPersonaPresetFatal', () => {
  it('is true only for the BLOCKED_FATAL verdict carrying the frozen conflict reason code', () => {
    const fatal = compat('BLOCKED_FATAL', [
      { outcome: 'FATAL', requirementId: 'req-persona-team', reasonCode: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT' },
    ])
    expect(isPersonaPresetFatal(fatal)).toBe(true)
    expect(isPersonaPresetFatal(compat('BLOCKED_FATAL', [
      { outcome: 'FATAL', requirementId: 'req-persona-team', reasonCode: 'PERSONA_INCOMPATIBLE' },
    ]))).toBe(false)
    expect(isPersonaPresetFatal(compat('BLOCKED_WARNING', [
      { outcome: 'FATAL', requirementId: 'req-persona-team', reasonCode: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT' },
    ]))).toBe(false)
    expect(isPersonaPresetFatal(undefined)).toBe(false)
    expect(isPersonaPresetFatal({ ok: false, message: 'boom' })).toBe(false)
  })
})

describe('selectDefaultPresetId', () => {
  it('prefers the `team` row, then the flagged default, then no preselect', () => {
    const rows: readonly TeamPresetRow[] = [
      { id: 'general', isDefault: true },
      { id: 'team', name: 'Team', isDefault: false },
    ]
    expect(selectDefaultPresetId(rows)).toBe('team')
    expect(selectDefaultPresetId([{ id: 'general', isDefault: true }, { id: 'coder', isDefault: false }]))
      .toBe('general')
    expect(selectDefaultPresetId([{ id: 'coder', isDefault: false }])).toEqual(null)
    expect(selectDefaultPresetId([])).toEqual(null)
  })
})

describe('emptyTeamIntentDraft', () => {
  it('is the fully blank page-run draft (no preselects, no acknowledgement)', () => {
    expect(emptyTeamIntentDraft).toEqual({
      blueprintId: null,
      revision: null,
      presetId: null,
      workspaceId: null,
      initialWork: '',
      ack: false,
    })
  })
})

describe('intentEnvironmentFacts', () => {
  it('carries the selected preset as the single persona fact when a seam row attests it', () => {
    const presets: readonly TeamPresetRow[] = [
      { id: 'team', name: 'Team', isDefault: true },
      { id: 'coder', isDefault: false },
    ]
    expect(intentEnvironmentFacts({ presetId: 'coder' }, presets)).toEqual([{
      domain: 'persona',
      subject: 'coder',
      available: true,
      generation: 0,
    }])
  })

  it('carries no facts for a blank selection or a selection the seam does not attest', () => {
    const presets: readonly TeamPresetRow[] = [{ id: 'team', isDefault: true }]
    expect(intentEnvironmentFacts({ presetId: null }, presets)).toEqual([])
    expect(intentEnvironmentFacts({ presetId: 'ghost' }, presets)).toEqual([])
  })
})

describe('teamWorkspaceOptions', () => {
  it('maps the native workspace views onto the picker options (id/title/path)', () => {
    const views: readonly { readonly workspaceId: string; readonly title: string; readonly path: string }[] = [
      { workspaceId: 'ws-1', title: 'Default', path: 'D:/work/default' },
      { workspaceId: 'ws-2', title: 'Side', path: 'D:/work/side' },
    ]
    expect(teamWorkspaceOptions(views)).toEqual([
      { id: 'ws-1', title: 'Default', path: 'D:/work/default' },
      { id: 'ws-2', title: 'Side', path: 'D:/work/side' },
    ])
  })

  it('yields no options while the workspace feed has not landed (undefined)', () => {
    expect(teamWorkspaceOptions(undefined)).toEqual([])
    expect(teamWorkspaceOptions([])).toEqual([])
  })
})
