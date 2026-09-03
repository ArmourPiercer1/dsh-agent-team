/**
 * P9-T8 (S5-D) — pure model for the legacy Team inspection (plan P9-S5
 * S5-D "legacy.inspect banner/zero-state"; UI doc §34; DevPlan §20.6
 * degradation): the `legacy.inspect` wire value narrowing over the
 * closed `LegacyTeamInspection` union (the P7-T7 reader's lossless-JSON
 * mirror) and the banner/zero-state selection.
 *
 * Zero-state rule (plan §10.6 + UI §34):
 * - `legacy-team` → the Team tab zero state is REPLACED by the
 *   persistent read-only banner (UI §34.1 verbatim copy) plus the
 *   decoded legacy summary (roster + scanned sessions) — NO Start-Team
 *   entry (UI §34.3 forbidden executable list: no Resume Team / Restore
 *   Member / Create Member / Change PolicyState / Edit Team override /
 *   Continue legacy Team mutation / Upgrade in place).
 * - `native-fallback` → the ordinary zero state (the inspection degraded
 *   to native Chat/Trajectory data; the session is NOT a legacy team).
 * - inspection failure → the ordinary zero state + ONE verbatim note.
 *
 * The inspection is READ-ONLY by construction (the legacy reader never
 * writes); it is a read, not a command flow — no projection pull (G5(c)
 * applies to command flows; the rendered durable state still comes from
 * the Projection).
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-legacy
 */

import type { RemoteSafeRecord } from '../../../remote/src/index.js'

/** One decoded legacy roster row (best-effort; absent fields → null). */
export interface LegacyRosterRowWire {
  /** The roster source directory tag (`'home'` / `'workspace'`). */
  readonly source: string
  readonly fileName: string
  readonly id: string | null
  readonly role: 'leader' | 'teammate' | null
  readonly name: string | null
  readonly description: string | null
}

/** The decoded `legacy-team` inspection view. */
export interface LegacyTeamViewWire {
  readonly status: 'legacy-team'
  /** The legacy team identity (IS the leader session id; null when roster-only). */
  readonly teamId: string | null
  readonly leaderSessionId: string | null
  readonly leaderSelection: 'team-events' | 'roster-only' | null
  readonly roster: readonly LegacyRosterRowWire[]
  readonly rosterWarningCount: number
  readonly sessionCount: number
  readonly memberChildSessionIds: readonly string[]
}

/** The decoded `native-fallback` inspection view. */
export interface LegacyFallbackViewWire {
  readonly status: 'native-fallback'
  readonly reason: 'no-legacy-metadata'
  readonly degradedTo: 'native-chat-trajectory'
  readonly nativeSessionCount: number
}

/** The fail-safe arm for a future status tag (rendered verbatim, never dropped). */
export type LegacyUnknownViewWire = {
  readonly status: 'unknown'
  readonly raw: RemoteSafeRecord
}

/** The narrowed `legacy.inspect` wire union. */
export type LegacyInspectionWire =
  | LegacyTeamViewWire
  | LegacyFallbackViewWire
  | LegacyUnknownViewWire

function nullableString(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null
}

function parseRosterRow(raw: RemoteSafeRecord): LegacyRosterRowWire {
  const roleRaw = raw['role']
  return {
    source: typeof raw['source'] === 'string' ? raw['source'] : '',
    fileName: typeof raw['fileName'] === 'string' ? raw['fileName'] : '',
    id: nullableString(raw['id']),
    role:
      roleRaw === 'leader' || roleRaw === 'teammate' ? roleRaw : null,
    name: nullableString(raw['name']),
    description: nullableString(raw['description']),
  }
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Parse the `legacy.inspect` success value (`{ inspection }` → the
 * closed union, narrowed defensively by the `status` tag; malformed
 * nested fields degrade to null/empty rather than failing the
 * inspection — the reader is best-effort by contract).
 */
export function parseLegacyInspection(
  value: unknown,
): LegacyInspectionWire {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('LEGACY_MALFORMED: value must be an object')
  }
  const record = value as RemoteSafeRecord
  const rawInspection = record['inspection']
  if (
    typeof rawInspection !== 'object' ||
    rawInspection === null ||
    Array.isArray(rawInspection)
  ) {
    throw new Error('LEGACY_MALFORMED: inspection must be an object')
  }
  const inspection = rawInspection as RemoteSafeRecord
  const status = inspection['status']
  if (status === 'legacy-team') {
    const rawTeam = inspection['team']
    const team =
      typeof rawTeam === 'object' && rawTeam !== null && !Array.isArray(rawTeam)
        ? (rawTeam as RemoteSafeRecord)
        : {}
    const rawRoster = team['roster']
    const roster: LegacyRosterRowWire[] = []
    if (Array.isArray(rawRoster)) {
      for (const row of rawRoster) {
        if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
          roster.push(parseRosterRow(row as RemoteSafeRecord))
        }
      }
    }
    const rawWarnings = team['rosterWarnings']
    const rawSessions = team['sessions']
    const selectionRaw = team['leaderSelection']
    return {
      status,
      teamId: nullableString(team['teamId']),
      leaderSessionId: nullableString(team['leaderSessionId']),
      leaderSelection:
        selectionRaw === 'team-events' || selectionRaw === 'roster-only'
          ? selectionRaw
          : null,
      roster,
      rosterWarningCount: Array.isArray(rawWarnings) ? rawWarnings.length : 0,
      sessionCount: Array.isArray(rawSessions) ? rawSessions.length : 0,
      memberChildSessionIds: parseStringArray(team['memberChildSessionIds']),
    }
  }
  if (status === 'native-fallback') {
    const rawNative = inspection['native']
    return {
      status,
      reason: 'no-legacy-metadata',
      degradedTo: 'native-chat-trajectory',
      nativeSessionCount: Array.isArray(rawNative) ? rawNative.length : 0,
    }
  }
  return { status: 'unknown', raw: inspection }
}

/** The zero-state banner selection (plan §10.6 / UI §34). */
export type LegacyZeroStateKind =
  | 'legacy-team'
  | 'ordinary'
  | 'unknown'

/**
 * Select the Team-tab zero-state kind for an inspection result:
 * `legacy-team` replaces the ordinary zero state with the persistent
 * read-only banner; `native-fallback` keeps the ordinary zero state;
 * `unknown` (future status tag) keeps the ordinary zero state + note.
 */
export function legacyZeroStateKind(
  inspection: LegacyInspectionWire,
): LegacyZeroStateKind {
  switch (inspection.status) {
    case 'legacy-team':
      return 'legacy-team'
    case 'native-fallback':
      return 'ordinary'
    default:
      return 'unknown'
  }
}
