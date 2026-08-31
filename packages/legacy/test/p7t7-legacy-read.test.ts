/**
 * p7t7-legacy-read.test.ts — P7-T7 mandatory test 1 (TaskDoc §11.8 P7-T7;
 * DevPlan §20.6): the legacy Team Session reader best-effort inspects old
 * Team metadata through the injected read-only port:
 *
 * - the full legacy-team view (roster overlay semantics, leader selection
 *   over unbound Team-fact sessions, bound-member detection, per-session
 *   evidence rows);
 * - the own-suffix (seed boundary) counting rule;
 * - the REQUIRED degradation to the native Chat/Trajectory view when the
 *   home carries no roster members and no Team events;
 * - invalid requests and port faults (closed error vocabulary);
 * - the lenient roster warning vocabulary;
 * - the format primitives (frozen `encodeSegment`/`projectKey` vectors,
 *   line classification);
 * - the frozen, read-only result view (and project-dir scoping, incl. the
 *   roster-only legacy mode).
 *
 * Zero-core: the reader and this suite are pure TS; the "filesystem" is the
 * in-memory home tree behind the recording port (no `node:` imports).
 *
 * @module @dsh-agent-team/legacy/test/p7t7-legacy-read
 */

import { describe, expect, it } from 'vitest'
import {
  LEGACY_READER_ERROR_CODES,
  classifyLegacyLogLine,
  decodeSegment,
  encodeSegment,
  inspectLegacyTeam,
  parseLegacyRosterFile,
  projectKey,
  ROSTER_WARNING_REASONS,
} from '../session-reader/index.js'
import type { LegacySessionEvidence } from '../session-reader/index.js'
import {
  P7T7_DSH_HOME,
  P7T7_EVENT_CONTROL_DECISION,
  P7T7_EVENT_CONTROL_REQUEST,
  P7T7_EVENT_MESSAGE,
  P7T7_EVENT_MEMBER_BOUND,
  P7T7_EVENT_PROGRESS,
  P7T7_NATIVE_PROJECT_DIR,
  P7T7_REQUEST,
  P7T7_TEAM_PROJECT_DIR,
  P7T7_WORKSPACE_CWD,
  assertLegacyCode,
  buildP7T7LegacyHome,
  buildP7T7NativeHome,
  captureError,
  createThrowingHomePort,
  isDeepFrozen,
  otherEventLine,
  RecordingLegacyHomePort,
  rosterMd,
  sessionHeaderLine,
  teamEventLine,
} from './p7t7-helpers.js'

// ---------------------------------------------------------------------------
// S1 — the full legacy-team view
// ---------------------------------------------------------------------------

const tree = buildP7T7LegacyHome()
const port = new RecordingLegacyHomePort(tree)
const view = inspectLegacyTeam(port, P7T7_REQUEST)

function sessionByDirId(dirId: string): LegacySessionEvidence {
  const row = view.team.sessions.find((s) => s.directoryId === dirId)
  if (row === undefined) throw new Error(`p7t7-legacy-read: no session '${dirId}' in the view`)
  return row
}

// ---------------------------------------------------------------------------
// S2 — the native fallback (degradation is required behavior)
// ---------------------------------------------------------------------------

const nativePort = new RecordingLegacyHomePort(buildP7T7NativeHome())
const nativeView = inspectLegacyTeam(nativePort, { dshHome: P7T7_DSH_HOME })

// ---------------------------------------------------------------------------
// S3 — invalid requests (closed vocabulary)
// ---------------------------------------------------------------------------

const invalidNull = assertLegacyCode(
  captureError(() => inspectLegacyTeam(port, null)),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST,
)
const invalidEmptyHome = assertLegacyCode(
  captureError(() => inspectLegacyTeam(port, { dshHome: '' })),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST,
)
const invalidNumberHome = assertLegacyCode(
  captureError(() => inspectLegacyTeam(port, { dshHome: 42 })),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST,
)
const invalidEmptyCwd = assertLegacyCode(
  captureError(() => inspectLegacyTeam(port, { dshHome: P7T7_DSH_HOME, workspaceCwd: '' })),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST,
)
const invalidEmptyProject = assertLegacyCode(
  captureError(() => inspectLegacyTeam(port, { dshHome: P7T7_DSH_HOME, projectDir: '' })),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST,
)

// ---------------------------------------------------------------------------
// S4 — port faults (re-typed, never swallowed)
// ---------------------------------------------------------------------------

const listFault = assertLegacyCode(
  captureError(() =>
    inspectLegacyTeam(createThrowingHomePort(tree, 'listDir'), P7T7_REQUEST),
  ),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_PORT_FAILURE,
)
const readFault = assertLegacyCode(
  captureError(() =>
    inspectLegacyTeam(createThrowingHomePort(tree, 'readFile'), P7T7_REQUEST),
  ),
  LEGACY_READER_ERROR_CODES.LEGACY_READER_PORT_FAILURE,
)

// ---------------------------------------------------------------------------
// S5 — the lenient roster warning vocabulary
// ---------------------------------------------------------------------------

const rosterValid = parseLegacyRosterFile(
  rosterMd({ id: 'r1', role: 'leader', name: 'R1', description: 'd', schemaVersion: 1 }),
)
const rosterNoFrontmatter = parseLegacyRosterFile('# just markdown\nno block\n')
const rosterUnterminated = parseLegacyRosterFile('---\nid: u1\nrole: leader\n')
const rosterBadSchema = parseLegacyRosterFile(
  rosterMd({ id: 'r2', role: 'teammate', name: 'R2', description: 'd', schemaVersion: 2 }),
)
const rosterNoId = parseLegacyRosterFile(rosterMd({ role: 'teammate', name: 'R3', description: 'd' }))
const rosterBadRole = parseLegacyRosterFile(
  rosterMd({ id: 'r4', role: 'boss', name: 'R4', description: 'd' }),
)
const rosterNoName = parseLegacyRosterFile(
  rosterMd({ id: 'r5', role: 'teammate', name: '', description: 'd' }),
)
const rosterNoDescription = parseLegacyRosterFile(
  rosterMd({ id: 'r6', role: 'teammate', name: 'R6', description: '' }),
)

// ---------------------------------------------------------------------------
// S6 — format primitives (frozen vectors + line classification)
// ---------------------------------------------------------------------------

const roundTripSamples = ['sess-1', '.', '..', 'a~b', 'a b', 'café', 'x_-.y']
const roundTrips = roundTripSamples.map((s) => ({
  input: s,
  decoded: decodeSegment(encodeSegment(s)),
}))
const classifyVectors = [
  { line: sessionHeaderLine({ id: 'h1' }), expectKind: 'header' },
  { line: teamEventLine(P7T7_EVENT_PROGRESS, { a: 1 }), expectKind: 'legacy-team-event' },
  { line: otherEventLine('assistant-message', { a: 1 }), expectKind: 'other' },
  { line: 'not-json{{{', expectKind: 'unreadable' },
].map((v) => {
  const c = classifyLegacyLogLine(v.line)
  return { line: v.line, expectKind: v.expectKind, kind: c.kind, eventName: c.eventName }
})

// ---------------------------------------------------------------------------
// S7 — frozen view + project-dir scoping (incl. roster-only legacy mode)
// ---------------------------------------------------------------------------

const teamScoped = inspectLegacyTeam(port, {
  dshHome: P7T7_DSH_HOME,
  workspaceCwd: P7T7_WORKSPACE_CWD,
  projectDir: P7T7_TEAM_PROJECT_DIR,
})
const nativeScoped = inspectLegacyTeam(port, {
  dshHome: P7T7_DSH_HOME,
  workspaceCwd: P7T7_WORKSPACE_CWD,
  projectDir: P7T7_NATIVE_PROJECT_DIR,
})

// ===========================================================================
// Assertions (the shim `it()` bodies are synchronous; they assert only over
// the captured top-level data above)
// ===========================================================================

describe('P7-T7 S1: the full legacy-team view (best-effort inspect)', () => {
  it('is a legacy-team view selected by Team events', () => {
    expect(view.status).toBe('legacy-team')
    if (view.status !== 'legacy-team') throw new Error('unreachable')
    expect(view.team.leaderSelection).toBe('team-events')
    expect(view.team.teamId).toBe('sess-leader')
    expect(view.team.leaderSessionId).toBe('sess-leader')
  })
  it('roster: workspace overlay wins per id; broken lines keep their readable fields', () => {
    if (view.status !== 'legacy-team') throw new Error('unreachable')
    expect(view.team.roster).toEqual([
      {
        source: 'home',
        fileName: '01-leader.md',
        id: 'p7t7-leader',
        role: 'leader',
        name: 'P7 Leader',
        description: 'leads the legacy team',
      },
      {
        source: 'workspace',
        fileName: '02-alpha.md',
        id: 'p7t7-alpha',
        role: 'teammate',
        name: 'Alpha WS',
        description: 'workspace overlay line',
      },
      {
        source: 'home',
        fileName: '03-broken.md',
        id: 'p7t7-broken',
        name: 'Broken Line',
      },
      {
        source: 'workspace',
        fileName: '04-no-id.md',
        role: 'teammate',
        name: 'No Id Line',
        description: 'missing id line',
      },
    ])
  })
  it('roster warnings: the closed-vocabulary reasons, in scan order', () => {
    if (view.status !== 'legacy-team') throw new Error('unreachable')
    const warnings = view.team.rosterWarnings
    expect(warnings.length).toBe(3)
    expect(warnings[0]?.source).toBe('home')
    expect(warnings[0]?.fileName).toBe('03-broken.md')
    expect(warnings[0]?.reason).toBe(ROSTER_WARNING_REASONS.ROLE_INVALID)
    expect(typeof warnings[0]?.message).toBe('string')
    expect(warnings[1]?.source).toBe('home')
    expect(warnings[1]?.fileName).toBe('03-broken.md')
    expect(warnings[1]?.reason).toBe(ROSTER_WARNING_REASONS.DESCRIPTION_MISSING)
    expect(warnings[2]?.source).toBe('workspace')
    expect(warnings[2]?.fileName).toBe('04-no-id.md')
    expect(warnings[2]?.reason).toBe(ROSTER_WARNING_REASONS.ID_MISSING)
  })
  it('sessions: every scanned log, sorted by (project dir, id)', () => {
    if (view.status !== 'legacy-team') throw new Error('unreachable')
    expect(view.team.sessions.map((s) => s.directoryId)).toEqual([
      'sess-alpha',
      'sess-beta',
      'sess-leader',
      'sess-seeded',
      'sess-native',
      'sess-zstd',
    ])
  })
  it('leader evidence: 3 Team facts, unbound', () => {
    const leader = sessionByDirId('sess-leader')
    expect(leader.sessionId).toBe('sess-leader')
    expect(leader.projectDir).toBe(P7T7_TEAM_PROJECT_DIR)
    expect(leader.headerPresent).toBe(true)
    expect(leader.createdAt).toBe(1700000001000)
    expect(leader.cwd).toBe('C:\\p7t7\\legacy-team')
    expect(leader.eventCount).toBe(3)
    expect(leader.unreadableLineCount).toBe(0)
    expect(leader.teamEventTotal).toBe(3)
    expect(leader.teamEventCounts).toEqual({
      [P7T7_EVENT_PROGRESS]: 1,
      [P7T7_EVENT_CONTROL_REQUEST]: 1,
      [P7T7_EVENT_MESSAGE]: 1,
    })
    expect(leader.logDecodable).toBe(true)
    expect(leader.logArtifact).toBe('session.jsonl')
  })
  it('bound member sess-alpha: the member-bound mark in its own suffix', () => {
    const alpha = sessionByDirId('sess-alpha')
    expect(alpha.origin).toBe('subagent')
    expect(alpha.parentSession).toBe('sess-leader')
    expect(alpha.delegationDepth).toBe(1)
    expect(alpha.teamEventCounts).toEqual({ [P7T7_EVENT_MEMBER_BOUND]: 1 })
    expect(alpha.teamEventTotal).toBe(1)
  })
  it('bound member sess-beta: the corrupt line is tolerated and counted', () => {
    const beta = sessionByDirId('sess-beta')
    expect(beta.eventCount).toBe(3)
    expect(beta.unreadableLineCount).toBe(1)
    expect(beta.teamEventTotal).toBe(2)
    expect(beta.teamEventCounts).toEqual({
      [P7T7_EVENT_MEMBER_BOUND]: 1,
      [P7T7_EVENT_MESSAGE]: 1,
    })
  })
  it('member children: the bound sessions of the leader, sorted', () => {
    if (view.status !== 'legacy-team') throw new Error('unreachable')
    expect(view.team.memberChildSessionIds).toEqual(['sess-alpha', 'sess-beta'])
  })
  it('native session: no Team facts, still surfaced as evidence', () => {
    const native = sessionByDirId('sess-native')
    expect(native.projectDir).toBe(P7T7_NATIVE_PROJECT_DIR)
    expect(native.eventCount).toBe(2)
    expect(native.teamEventTotal).toBe(0)
    expect(native.teamEventCounts).toEqual({})
  })
  it('compressed-only session: undecodable artifact, zero counts', () => {
    const zstd = sessionByDirId('sess-zstd')
    expect(zstd.sessionId).toBe(undefined)
    expect(zstd.headerPresent).toBe(false)
    expect(zstd.logDecodable).toBe(false)
    expect(zstd.logArtifact).toBe('session.jsonl.zstd')
    expect(zstd.eventCount).toBe(0)
    expect(zstd.teamEventTotal).toBe(0)
  })
  it('the reader called only read ops on the port (read-only isolation)', () => {
    port.assertOnlyReadOps()
    expect(port.calls.length).toBeGreaterThan(0)
    expect(port.readFilePaths().some((p) => p.endsWith('session.jsonl'))).toBe(true)
    expect(port.listDirPaths().some((p) => p.endsWith('teammates'))).toBe(true)
  })
})

describe('P7-T7 S1b: the own-suffix (seed boundary) counting rule', () => {
  it('seeded facts below seedLength are excluded; seq-less lines would be tolerated', () => {
    const seeded = sessionByDirId('sess-seeded')
    expect(seeded.seedLength).toBe(2)
    expect(seeded.eventCount).toBe(3)
    expect(seeded.teamEventTotal).toBe(1)
    expect(seeded.teamEventCounts).toEqual({ [P7T7_EVENT_MESSAGE]: 1 })
    expect(seeded.teamEventCounts[P7T7_EVENT_PROGRESS]).toBe(undefined)
    expect(seeded.teamEventCounts[P7T7_EVENT_CONTROL_DECISION]).toBe(undefined)
  })
})

describe('P7-T7 S2: metadata absent => native Chat/Trajectory fallback (required)', () => {
  it('degrades to the native view with the closed reason/target', () => {
    expect(nativeView.status).toBe('native-fallback')
    if (nativeView.status !== 'native-fallback') throw new Error('unreachable')
    expect(nativeView.reason).toBe('no-legacy-metadata')
    expect(nativeView.degradedTo).toBe('native-chat-trajectory')
  })
  it('the native evidence list still carries every scanned log', () => {
    if (nativeView.status !== 'native-fallback') throw new Error('unreachable')
    expect(nativeView.native.map((s) => s.directoryId)).toEqual(['sess-native', 'sess-zstd'])
    expect(nativeView.native[0]?.sessionId).toBe('sess-native')
  })
})

describe('P7-T7 S3: invalid requests (closed vocabulary)', () => {
  it('non-object / missing / empty / wrong-kind dshHome are INVALID_REQUEST', () => {
    expect(invalidNull.code).toBe('LEGACY_READER_INVALID_REQUEST')
    expect(invalidEmptyHome.code).toBe('LEGACY_READER_INVALID_REQUEST')
    expect(invalidNumberHome.code).toBe('LEGACY_READER_INVALID_REQUEST')
    expect(invalidEmptyCwd.code).toBe('LEGACY_READER_INVALID_REQUEST')
    expect(invalidEmptyProject.code).toBe('LEGACY_READER_INVALID_REQUEST')
  })
})

describe('P7-T7 S4: port faults are re-typed, never swallowed', () => {
  it('a throwing listDir / readFile surfaces LEGACY_READER_PORT_FAILURE', () => {
    expect(listFault.code).toBe('LEGACY_READER_PORT_FAILURE')
    expect(readFault.code).toBe('LEGACY_READER_PORT_FAILURE')
  })
})

describe('P7-T7 S5: the lenient roster warning vocabulary', () => {
  it('a valid roster file produces no warnings and all fields', () => {
    expect(rosterValid.warnings).toEqual([])
    expect(rosterValid.id).toBe('r1')
    expect(rosterValid.role).toBe('leader')
    expect(rosterValid.name).toBe('R1')
    expect(rosterValid.description).toBe('d')
  })
  it('no frontmatter: FRONTMATTER_MISSING, no fields', () => {
    expect(rosterNoFrontmatter.warnings).toEqual([ROSTER_WARNING_REASONS.FRONTMATTER_MISSING])
    expect(rosterNoFrontmatter.id).toBe(undefined)
    expect(rosterNoFrontmatter.role).toBe(undefined)
    expect(rosterNoFrontmatter.name).toBe(undefined)
    expect(rosterNoFrontmatter.description).toBe(undefined)
  })
  it('an unterminated block still parses the readable fields', () => {
    expect(rosterUnterminated.warnings).toEqual([
      ROSTER_WARNING_REASONS.FRONTMATTER_MISSING,
      ROSTER_WARNING_REASONS.NAME_MISSING,
      ROSTER_WARNING_REASONS.DESCRIPTION_MISSING,
    ])
    expect(rosterUnterminated.id).toBe('u1')
    expect(rosterUnterminated.role).toBe('leader')
  })
  it('schemaVersion != 1 warns but keeps the fields', () => {
    expect(rosterBadSchema.warnings).toEqual([ROSTER_WARNING_REASONS.SCHEMA_VERSION_MISMATCH])
    expect(rosterBadSchema.id).toBe('r2')
  })
  it('each individual bad field degrades to its own reason', () => {
    expect(rosterNoId.warnings).toEqual([ROSTER_WARNING_REASONS.ID_MISSING])
    expect(rosterNoId.name).toBe('R3')
    expect(rosterBadRole.warnings).toEqual([ROSTER_WARNING_REASONS.ROLE_INVALID])
    expect(rosterBadRole.id).toBe('r4')
    expect(rosterNoName.warnings).toEqual([ROSTER_WARNING_REASONS.NAME_MISSING])
    expect(rosterNoDescription.warnings).toEqual([ROSTER_WARNING_REASONS.DESCRIPTION_MISSING])
  })
})

describe('P7-T7 S6: format primitives (frozen vectors)', () => {
  it('encodeSegment: the frozen escaping vectors', () => {
    expect(encodeSegment('plain')).toBe('plain')
    expect(encodeSegment('.')).toBe('~002E')
    expect(encodeSegment('..')).toBe('~002E~002E')
    expect(encodeSegment('a~b')).toBe('a~007Eb')
  })
  it('decodeSegment inverts encodeSegment over the sample set', () => {
    for (const r of roundTrips) {
      expect(r.decoded).toBe(r.input)
    }
  })
  it('projectKey: the frozen separators/dashes vectors', () => {
    expect(projectKey('C:\\p7t7\\legacy-team')).toBe('--C-p7t7-legacy-team--')
    expect(projectKey('a/b')).toBe('--a-b--')
    expect(P7T7_TEAM_PROJECT_DIR).toBe(projectKey('C:\\p7t7\\legacy-team'))
    expect(P7T7_NATIVE_PROJECT_DIR).toBe(projectKey('C:\\p7t7\\native'))
  })
  it('classifyLegacyLogLine: header / legacy-team-event / other / unreadable', () => {
    for (const v of classifyVectors) {
      expect(v.kind).toBe(v.expectKind)
    }
    const team = classifyVectors[1]
    if (team !== undefined && team.kind === 'legacy-team-event') {
      expect(team.eventName).toBe(P7T7_EVENT_PROGRESS)
    }
  })
})

describe('P7-T7 S7: frozen view + project-dir scoping', () => {
  it('the inspection view is deep-frozen (read-only by construction)', () => {
    expect(isDeepFrozen(view)).toBe(true)
    expect(isDeepFrozen(nativeView)).toBe(true)
  })
  it('projectDir scoping: only the scoped project dir is scanned', () => {
    if (teamScoped.status !== 'legacy-team') throw new Error('unreachable')
    expect(teamScoped.team.sessions.map((s) => s.directoryId)).toEqual([
      'sess-alpha',
      'sess-beta',
      'sess-leader',
      'sess-seeded',
    ])
    expect(teamScoped.team.leaderSessionId).toBe('sess-leader')
  })
  it('a roster-only legacy home (no Team events in scope): leader absent, roster kept', () => {
    if (nativeScoped.status !== 'legacy-team') throw new Error('unreachable')
    expect(nativeScoped.team.leaderSelection).toBe('roster-only')
    expect(nativeScoped.team.teamId).toBe(undefined)
    expect(nativeScoped.team.leaderSessionId).toBe(undefined)
    expect(nativeScoped.team.memberChildSessionIds).toEqual([])
    expect(nativeScoped.team.sessions.map((s) => s.directoryId)).toEqual([
      'sess-native',
      'sess-zstd',
    ])
    expect(nativeScoped.team.roster.length).toBe(4)
  })
})
