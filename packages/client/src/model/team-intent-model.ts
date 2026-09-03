/**
 * P9-T7 (S5-A) — pure model for the New Team flow (plan P9-S5 S5-A; UI
 * doc §4–§9): parsing the `catalog.list` rows, the `catalog.get`
 * blueprint detail, and the `intent.probe` compatibility result, plus the
 * create gate (button label / enablement) derived from the parsed
 * compatibility status, the warning-acknowledgement checkbox, and the
 * initial-work draft.
 *
 * Authority discipline: the host judges compatibility (the domain engine
 * over `environmentFacts`); this module only maps the frozen closed sets
 * (`OPEN` / `BLOCKED_WARNING` / `BLOCKED_FATAL` /
 * `DEGRADED_ACKNOWLEDGED` and `PASS` / `WARNING` / `FATAL`) onto UI
 * facts. Fail-safe leaf reads: only the fields the panel renders are
 * read; an unrecognized status or outcome fails loud (never a silent
 * "ready").
 *
 * Pure module: no React, no I/O, no transport. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-intent-model
 */

/** One `catalog.list` row: the blueprint id and its known revisions. */
export interface IntentBlueprintRow {
  readonly blueprintId: string
  /** The known revisions (as served). */
  readonly revisions: readonly number[]
  /** The highest known revision (the pre-selected default). */
  readonly latestRevision: number
}

/** The parsed catalog list: rows, or a loud parse failure message. */
export type IntentCatalog =
  | { readonly ok: true; readonly rows: readonly IntentBlueprintRow[] }
  | { readonly ok: false; readonly message: string }

/** One blueprint detail (the `catalog.get` record, fail-safe read). */
export interface IntentBlueprintDetail {
  readonly blueprintId: string
  readonly revision: number
  readonly displayName?: string
  readonly description?: string
  /** The UI §6 "source" grouping, when carried in the blueprint metadata. */
  readonly source?: string
  /** The template count (leader + members). */
  readonly templateCount: number
}

/** The four logical admission states (frozen closed set, wire spelling). */
export type IntentCompatibilityStatus =
  | 'OPEN'
  | 'BLOCKED_WARNING'
  | 'BLOCKED_FATAL'
  | 'DEGRADED_ACKNOWLEDGED'

/** One WARNING/FATAL requirement row (UI §9.3 fields, fail-safe read). */
export interface IntentCompatibilityRequirement {
  /** The requirement owner id (UI §9.3 "requirement owner"). */
  readonly requirementId: string
  /** The capability-route / subject ids that are unavailable. */
  readonly unavailableSubjects: readonly string[]
  /** The observed-state / what-degrades explanation (host-authored). */
  readonly detail: string
  /** True when the requirement carried `complete:true` (never ack-able). */
  readonly complete: boolean
  /** The closed reason code, when carried (drives the §7.4 fatal copy). */
  readonly reasonCode?: string
}

/** The parsed compatibility result, or a loud parse failure. */
export type IntentCompatibility =
  | {
      readonly ok: true
      readonly status: IntentCompatibilityStatus
      /** The WARNING outcomes (ack-able, UI §9.2). */
      readonly warnings: readonly IntentCompatibilityRequirement[]
      /** The FATAL outcomes (never ack-able, UI §9.3 / §7.4). */
      readonly fatals: readonly IntentCompatibilityRequirement[]
    }
  | { readonly ok: false; readonly message: string }

/** The create-button label selection (UI §4.3 / §9). */
export type IntentCreateLabel = 'create' | 'createAndSend' | 'acknowledge'

/**
 * One workspace choice for the pickers (the native workspace feed,
 * T9-wired): the id / title for display, the path for the commands
 * (the activation layer consumes the workspace as a path string).
 */
export interface TeamWorkspaceOption {
  /** The workspace id (the native `WorkspaceView.workspaceId`). */
  readonly id: string
  /** The display title (the native `WorkspaceView.title`). */
  readonly title: string
  /** The workspace path (the value the team commands consume). */
  readonly path: string
}

/** The create gate: the button label and whether the click may proceed. */
export interface IntentCreateGate {
  readonly label: IntentCreateLabel
  readonly enabled: boolean
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readStringArray(record: Record<string, unknown>, key: string): readonly string[] | undefined {
  const value = record[key]
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') out.push(item)
  }
  return out
}

/**
 * Parse the `catalog.list` data (`{ blueprints: [...] }`). Rows missing an
 * id or every numeric revision are dropped; a malformed envelope is a loud
 * failure (the panel shows its catalog error state).
 * @param data - the `data` field of a successful `catalog.list` response.
 * @returns the parsed rows, or the loud failure message.
 */
export function parseCatalogList(data: unknown): IntentCatalog {
  const root = asRecord(data)
  const list = root?.['blueprints']
  if (!Array.isArray(list)) {
    return { ok: false, message: 'catalog.list: missing `blueprints` list' }
  }
  const rows: IntentBlueprintRow[] = []
  for (const entry of list) {
    const record = asRecord(entry)
    if (record === undefined) continue
    const blueprintId = readString(record, 'blueprintId')
    const raw = record['revisions']
    if (blueprintId === undefined || !Array.isArray(raw)) continue
    const revisions: number[] = []
    for (const item of raw) {
      if (typeof item === 'number' && Number.isFinite(item)) revisions.push(item)
    }
    if (revisions.length === 0) continue
    let latest = revisions[0]!
    for (const revision of revisions) {
      if (revision > latest) latest = revision
    }
    rows.push({ blueprintId, revisions, latestRevision: latest })
  }
  return { ok: true, rows }
}

/**
 * Parse the `catalog.get` data (`{ blueprint: <record> }`). Returns
 * `undefined` for a malformed envelope (the panel fails loud with its
 * generic detail error).
 * @param data - the `data` field of a successful `catalog.get` response.
 * @returns the parsed detail, or `undefined` when unparseable.
 */
export function parseBlueprintDetail(data: unknown): IntentBlueprintDetail | undefined {
  const root = asRecord(data)
  const record = root === undefined ? undefined : asRecord(root['blueprint'])
  if (record === undefined) return undefined
  const blueprintId = readString(record, 'blueprintId')
  const revision = readNumber(record, 'revision')
  if (blueprintId === undefined || revision === undefined) return undefined
  const members = Array.isArray(record['members']) ? record['members'] : []
  return {
    blueprintId,
    revision,
    displayName: readString(record, 'displayName'),
    description: readString(record, 'description'),
    source: asRecord(record['metadata']) === undefined
      ? undefined
      : readString(asRecord(record['metadata'])!, 'source'),
    templateCount: (record['leader'] !== undefined ? 1 : 0) + members.length,
  }
}

const STATUS_VALUES: ReadonlySet<string> = new Set([
  'OPEN', 'BLOCKED_WARNING', 'BLOCKED_FATAL', 'DEGRADED_ACKNOWLEDGED',
])

const OUTCOME_VALUES: ReadonlySet<string> = new Set(['PASS', 'WARNING', 'FATAL'])

/**
 * Parse the `intent.probe` data (`{ compatibility: <result> }`). The
 * frozen closed sets decide: an unknown `status` or requirement `outcome`
 * is a loud failure — never a silent "ready".
 * @param data - the `data` field of a successful `intent.probe` response.
 * @returns the parsed result, or the loud failure message.
 */
export function parseCompatibilityResult(data: unknown): IntentCompatibility {
  const root = asRecord(data)
  const record = root === undefined ? undefined : asRecord(root['compatibility'])
  if (record === undefined) {
    return { ok: false, message: 'intent.probe: missing `compatibility` result' }
  }
  const statusRaw = readString(record, 'status')
  if (statusRaw === undefined || !STATUS_VALUES.has(statusRaw)) {
    return {
      ok: false,
      message: `intent.probe: unknown compatibility status ${statusRaw ?? '(absent)'}`,
    }
  }
  const requirements = Array.isArray(record['requirements']) ? record['requirements'] : []
  const warnings: IntentCompatibilityRequirement[] = []
  const fatals: IntentCompatibilityRequirement[] = []
  for (const entry of requirements) {
    const row = asRecord(entry)
    if (row === undefined) continue
    const outcome = readString(row, 'outcome')
    if (outcome === undefined || !OUTCOME_VALUES.has(outcome)) {
      return {
        ok: false,
        message: `intent.probe: unknown requirement outcome ${outcome ?? '(absent)'}`,
      }
    }
    if (outcome !== 'WARNING' && outcome !== 'FATAL') continue
    const requirementId = readString(row, 'requirementId') ?? '(unknown)'
    const unavailableSubjects = readStringArray(row, 'unavailableSubjects') ?? []
    const detail = readString(row, 'detail') ?? ''
    const complete = row['complete'] === true
    const reasonCode = readString(row, 'reasonCode')
    const requirement: IntentCompatibilityRequirement = reasonCode === undefined
      ? { requirementId, unavailableSubjects, detail, complete }
      : { requirementId, unavailableSubjects, detail, complete, reasonCode }
    if (outcome === 'WARNING') warnings.push(requirement)
    else fatals.push(requirement)
  }
  return { ok: true, status: statusRaw as IntentCompatibilityStatus, warnings, fatals }
}

/**
 * The create gate (UI §4.3 / §5 / §9) for the current draft. `checking`
 * is the in-flight probe; `acknowledged` is the explicit
 * "Acknowledge warnings and create" checkbox (never default-checked).
 * Initial work (non-blank) switches the ready label from "Create Team"
 * to "Create & Send" (UI §4.3); it still rides along under the
 * acknowledgement label.
 * @param compat - the parsed probe result, if one has landed.
 * @param checking - true while a probe is in flight.
 * @param acknowledged - the warning-ack checkbox state.
 * @param initialWork - the initial-work draft text.
 * @returns the button label selection and enablement.
 */
export function intentCreateGate(
  compat: IntentCompatibility | undefined,
  checking: boolean,
  acknowledged: boolean,
  initialWork: string,
): IntentCreateGate {
  if (checking) return { label: 'create', enabled: false }
  if (compat === undefined || !compat.ok) return { label: 'create', enabled: false }
  switch (compat.status) {
    case 'OPEN':
    case 'DEGRADED_ACKNOWLEDGED':
      return {
        label: initialWork.trim() !== '' ? 'createAndSend' : 'create',
        enabled: true,
      }
    case 'BLOCKED_WARNING':
      return { label: 'acknowledge', enabled: acknowledged }
    case 'BLOCKED_FATAL':
      return { label: 'create', enabled: false }
  }
}

/**
 * Whether the FATAL verdict is the §7.4 complete-persona preset conflict
 * (the panel then offers "change runtime preset" as the remedy and keeps
 * Create disabled with no Continue-anyway path).
 * @param compat - the parsed probe result, if one has landed.
 * @returns true when a FATAL row carries the frozen conflict reason code.
 */
export function isPersonaPresetFatal(compat: IntentCompatibility | undefined): boolean {
  if (compat === undefined || !compat.ok) return false
  if (compat.status !== 'BLOCKED_FATAL') return false
  return compat.fatals.some(row => row.reasonCode === 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT')
}

// ---------------------------------------------------------------------------
// The New Team draft + runtime-preset rows (UI §5, §7)
// ---------------------------------------------------------------------------

/**
 * One runtime AgentPreset row (UI §7.1 "Runtime preset"). The S0 seam-6
 * mapping (T9 wiring) filters the `broken` rows before they reach the UI;
 * the panel renders only what the seam attests.
 */
export interface TeamPresetRow {
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly isDefault: boolean
}

/**
 * The default runtime-preset preselect (UI §7.2: `team` is the recommended
 * default, not a Team Mode switch). The `team` row wins when present;
 * otherwise the row flagged `isDefault`; otherwise no preselect (the user
 * picks explicitly).
 * @param presets - the seam rows (broken rows already filtered).
 * @returns the preset id to preselect, or `null`.
 */
export function selectDefaultPresetId(presets: readonly TeamPresetRow[]): string | null {
  const team = presets.find(row => row.id === 'team')
  if (team !== undefined) return team.id
  const flagged = presets.find(row => row.isDefault)
  return flagged !== undefined ? flagged.id : null
}

/**
 * The New Team draft (UI §5.3: it must persist within the page run — the
 * owning TeamView holds it, so closing and reopening the panel keeps the
 * selections; it is NOT authority for any created TeamSession, §7.3).
 */
export interface TeamIntentDraft {
  readonly blueprintId: string | null
  /** The selected revision (the row's latest by default). */
  readonly revision: number | null
  /** The selected runtime preset id (`null` = not selected yet, UI §7). */
  readonly presetId: string | null
  /** The selected workspace id (`null` = the Default workspace, UI §8). */
  readonly workspaceId: string | null
  /** The initial-work draft text (UI §4.3; blank = no initial work). */
  readonly initialWork: string
  /**
   * The local warning-acknowledgement gate (UI §9.2: explicit, never
   * default-checked). Deliberate per-attempt state: it does not travel on
   * the frozen pre-creation probe (no ack param there); the durable ack
   * (`compatibility.ack`) applies post-creation.
   */
  readonly ack: boolean
}

/** The blank draft (the panel's initial value). */
export const emptyTeamIntentDraft: TeamIntentDraft = {
  blueprintId: null,
  revision: null,
  presetId: null,
  workspaceId: null,
  initialWork: '',
  ack: false,
}

/**
 * The pre-creation probe environment fact for the selected runtime preset
 * (the frozen `intent.probe` carries `environmentFacts` as the only
 * environment input channel; the engine treats a missing fact as
 * `available: false`). This is how UI §7.4 reaches the frozen FATAL: the
 * blueprint's `persona` requirement names preset ids as subjects, and a
 * `complete:true` requirement unmet by the selected preset's fact is the
 * structural `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`.
 *
 * `generation: 0` — the client has no host generation to echo; it only
 * attests the seam row exists (available), never a probe epoch.
 *
 * A `type` alias, not an `interface`: the frozen `RemoteSafeRecord` is an
 * index-signature type, and only object-literal aliases (never interfaces)
 * are assignable to it.
 */
export type IntentEnvironmentFact = {
  readonly domain: 'persona'
  readonly subject: string
  readonly available: true
  readonly generation: 0
}

/**
 * Build the probe environment facts for one draft: the single persona fact
 * for the selected preset when a seam row attests it, else no facts.
 * @param draft - the draft (only its `presetId` is read).
 * @param presets - the seam rows (broken rows already filtered).
 * @returns the facts array (possibly empty) for `RemoteIntentProbeParams`.
 */
export function intentEnvironmentFacts(
  draft: Pick<TeamIntentDraft, 'presetId'>,
  presets: readonly TeamPresetRow[],
): readonly IntentEnvironmentFact[] {
  if (draft.presetId === null) return []
  const row = presets.find(candidate => candidate.id === draft.presetId)
  if (row === undefined) return []
  return [{ domain: 'persona', subject: row.id, available: true, generation: 0 }]
}

/**
 * One native workspace row, leaf fields only (the upstream `WorkspaceView`
 * projects structurally onto this: the branded `workspaceId` narrows to
 * `string`).
 */
export interface IntentWorkspaceView {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
}

/**
 * Map the native workspace feed rows to the picker options (UI §8: the
 * select shows titles, the value is the workspace id, and the team
 * commands consume the path string downstream).
 * @param views - the feed rows (`undefined` = feed not landed yet).
 * @returns the picker options (empty when the feed is absent).
 */
export function teamWorkspaceOptions(
  views: readonly IntentWorkspaceView[] | undefined,
): readonly TeamWorkspaceOption[] {
  if (views === undefined) return []
  return views.map(view => ({ id: view.workspaceId, title: view.title, path: view.path }))
}
