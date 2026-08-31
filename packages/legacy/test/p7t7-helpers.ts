/**
 * p7t7-helpers — shared in-memory legacy-home fixture and the recording
 * read-only port for the P7-T7 (legacy Team Session read-only reader + G7
 * gate) suites (TaskDoc §11.8 P7-T7; DevPlan §20.6/§20.7).
 *
 * The in-process suites cannot touch the real filesystem (zero-core
 * discipline: no `node:` imports in `.ts`), so the reader's injected
 * `LegacyHomePort` is backed by a plain in-memory home tree:
 *
 * - {@link P7T7HomeTree} / {@link createHomeTree} — the home as a
 *   `path -> UTF-8 content` map (files only; directories are implicit);
 * - {@link RecordingLegacyHomePort} — the read-only port over one tree,
 *   recording EVERY call (the G7 read-only-isolation evidence channel);
 * - {@link createPlainHomePort} — a port object whose own keys are exactly
 *   the two surface methods (the port-surface assertion channel);
 * - {@link createThrowingHomePort} — a port that throws on one op (the
 *   `LEGACY_READER_PORT_FAILURE` channel);
 * - log/roster line builders — the frozen legacy on-disk vocabulary
 *   (header line, event line with optional `seq`, roster `.md`); legacy
 *   Team event names come exclusively from the contracts detection
 *   vocabulary (the p4t6 denylist is honored: no event literal anywhere);
 * - {@link buildP7T7LegacyHome} / {@link buildP7T7NativeHome} — the shared
 *   fixture homes (legacy team + native-only);
 * - {@link assertLegacyCode} / {@link captureError} — the closed-vocabulary
 *   error assertion channels;
 * - {@link isDeepFrozen} — the frozen-view proof channel.
 *
 * @module @dsh-agent-team/legacy/test/p7t7-helpers
 */

import { LEGACY_TEAM_SESSION_EVENT_NAMES } from '../../contracts/src/index.js'
import {
  isLegacyReaderError,
  projectKey,
  type LegacyHomeEntry,
  type LegacyHomePort,
  type LegacyReaderErrorCode,
  type LegacyTeamInspection,
  type LegacyTeamInspectRequest,
} from '../session-reader/index.js'

// ---------------------------------------------------------------------------
// Legacy Team event names (detection vocabulary only — derived, never
// literal, per the p4t6 scanner contract)
// ---------------------------------------------------------------------------

/** Resolve one legacy Team event name by its unique suffix (never a literal). */
function eventNameBySuffix(suffix: string): string {
  const hit = LEGACY_TEAM_SESSION_EVENT_NAMES.find((n) => n.endsWith(suffix))
  if (hit === undefined) {
    throw new Error(`p7t7-helpers: no legacy Team event name ends with '${suffix}'`)
  }
  return hit
}

/** The legacy `progress` fact event name. */
export const P7T7_EVENT_PROGRESS: string = eventNameBySuffix('progress')
/** The legacy `control-request` fact event name. */
export const P7T7_EVENT_CONTROL_REQUEST: string = eventNameBySuffix('control-request')
/** The legacy `control-decision` fact event name. */
export const P7T7_EVENT_CONTROL_DECISION: string = eventNameBySuffix('control-decision')
/** The legacy `message` fact event name. */
export const P7T7_EVENT_MESSAGE: string = eventNameBySuffix('message')
/** The legacy `member-bound` (bound-teammate mark) event name. */
export const P7T7_EVENT_MEMBER_BOUND: string = eventNameBySuffix('member-bound')

// ---------------------------------------------------------------------------
// The in-memory home tree
// ---------------------------------------------------------------------------

/** One in-memory legacy DSH home (file path -> UTF-8 content). */
export interface P7T7HomeTree {
  /** The file map (directories are implicit in the path prefixes). */
  readonly files: Map<string, string>
}

/** Build one in-memory home tree. */
export function createHomeTree(files: Record<string, string> = {}): P7T7HomeTree {
  return { files: new Map(Object.entries(files)) }
}

/** Insert or replace one file in the tree (the test-side mutation channel). */
export function homeTreeSet(tree: P7T7HomeTree, path: string, content: string): void {
  tree.files.set(path, content)
}

/** Remove one file from the tree (the test-side mutation channel). */
export function homeTreeRemove(tree: P7T7HomeTree, path: string): void {
  tree.files.delete(path)
}

/**
 * Plain-JSON snapshot of the home tree (path-sorted) — the no-mutation
 * evidence: compare before/after a scenario to prove the inspected home is
 * untouched.
 */
export function homeTreeSnapshot(tree: P7T7HomeTree): Record<string, string> {
  const out: Record<string, string> = {}
  const entries = [...tree.files.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  )
  for (const [path, content] of entries) out[path] = content
  return out
}

/**
 * List the entries of one directory path in the tree (pure; the port
 * contract: `undefined` when the path is absent or is a file).
 */
function listTreeDir(tree: P7T7HomeTree, path: string): readonly LegacyHomeEntry[] | undefined {
  if (tree.files.has(path)) return undefined
  const prefix = path === '' ? '' : path.replace(/[/\\]+$/, '') + '/'
  const names = new Map<string, 'file' | 'dir'>()
  for (const p of tree.files.keys()) {
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    if (rest.length === 0) continue
    const idx = rest.indexOf('/')
    const name = idx === -1 ? rest : rest.slice(0, idx)
    if (name.length === 0) continue
    const kind: 'file' | 'dir' = idx === -1 ? 'file' : 'dir'
    const prev = names.get(name)
    if (prev === undefined || prev === 'dir') names.set(name, kind)
  }
  const out: LegacyHomeEntry[] = []
  for (const [name, kind] of names) out.push({ name, kind })
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return out
}

/** Read one file from the tree (`undefined` when absent). */
function readTreeFile(tree: P7T7HomeTree, path: string): string | undefined {
  return tree.files.get(path)
}

// ---------------------------------------------------------------------------
// The read-only ports
// ---------------------------------------------------------------------------

/** One recorded read-only port call (the read-only isolation channel). */
export interface P7T7PortCall {
  /** The op (structurally only the two read ops can exist). */
  readonly op: 'listDir' | 'readFile'
  /** The path the op was asked for. */
  readonly path: string
}

/**
 * The in-memory read-only port over one home tree, recording every call.
 * The surface is structurally read-only (`LegacyHomePort` has no write
 * method); the call log additionally proves the reader asked for nothing
 * beyond `listDir`/`readFile`.
 */
export class RecordingLegacyHomePort implements LegacyHomePort {
  /** Every port call, in order (the G7 evidence channel). */
  readonly calls: P7T7PortCall[] = []
  /** The backing tree. */
  private readonly tree: P7T7HomeTree

  /**
   * @param tree - the in-memory home tree to serve.
   */
  constructor(tree: P7T7HomeTree) {
    this.tree = tree
  }

  /** List one directory (recorded). */
  listDir(path: string): readonly LegacyHomeEntry[] | undefined {
    this.calls.push({ op: 'listDir', path })
    return listTreeDir(this.tree, path)
  }

  /** Read one file (recorded). */
  readFile(path: string): string | undefined {
    this.calls.push({ op: 'readFile', path })
    return readTreeFile(this.tree, path)
  }

  /** Every path that was listed. */
  listDirPaths(): readonly string[] {
    return this.calls.filter((c) => c.op === 'listDir').map((c) => c.path)
  }

  /** Every path that was read. */
  readFilePaths(): readonly string[] {
    return this.calls.filter((c) => c.op === 'readFile').map((c) => c.path)
  }

  /**
   * Assert the call log is exclusively read operations (always true by the
   * type surface; kept as an explicit, assertable evidence step).
   */
  assertOnlyReadOps(): void {
    for (const call of this.calls) {
      if (call.op !== 'listDir' && call.op !== 'readFile') {
        throw new Error(`p7t7-helpers: unexpected port op '${call.op}'`)
      }
    }
  }
}

/**
 * The barest read-only port: a plain object whose own keys are EXACTLY the
 * two surface methods (no recording, no extra state) — for the
 * port-surface assertion that no write surface exists to call.
 */
export function createPlainHomePort(tree: P7T7HomeTree): LegacyHomePort {
  const port: LegacyHomePort = {
    listDir(path: string): readonly LegacyHomeEntry[] | undefined {
      return listTreeDir(tree, path)
    },
    readFile(path: string): string | undefined {
      return readTreeFile(tree, path)
    },
  }
  return port
}

/**
 * A port that throws on EVERY call of one op (the injected-fault channel
 * for `LEGACY_READER_PORT_FAILURE`).
 */
export function createThrowingHomePort(
  tree: P7T7HomeTree,
  op: 'listDir' | 'readFile',
): LegacyHomePort {
  const port: LegacyHomePort = {
    listDir(path: string): readonly LegacyHomeEntry[] | undefined {
      if (op === 'listDir') throw new Error('injected listDir fault (p7t7)')
      return listTreeDir(tree, path)
    },
    readFile(path: string): string | undefined {
      if (op === 'readFile') throw new Error('injected readFile fault (p7t7)')
      return readTreeFile(tree, path)
    },
  }
  return port
}

// ---------------------------------------------------------------------------
// Log / roster line builders (the frozen legacy on-disk vocabulary)
// ---------------------------------------------------------------------------

/**
 * One native session-log header line (the FIRST line of a session log).
 * The fields are the tolerant header vocabulary the reader understands.
 */
export function sessionHeaderLine(fields: Record<string, unknown>): string {
  return JSON.stringify({ type: 'session', version: 1, ...fields })
}

/**
 * One legacy Team event line. `eventName` must come from the contracts
 * detection vocabulary (the builders never emit a literal name); `seq` is
 * included only when provided (the own-suffix boundary input).
 */
export function teamEventLine(
  eventName: string,
  data: Record<string, unknown>,
  seq?: number,
): string {
  const line: Record<string, unknown> = { type: eventName, data }
  if (seq !== undefined) line.seq = seq
  return JSON.stringify(line)
}

/** One ordinary (non-Team) event line. */
export function otherEventLine(eventName: string, data: Record<string, unknown>): string {
  return JSON.stringify({ type: eventName, data })
}

/** The optional fields of one roster `.md` fixture. */
export interface P7T7RosterFields {
  readonly id?: string
  readonly role?: string
  readonly name?: string
  readonly description?: string
  readonly schemaVersion?: string | number
}

/** One legacy teammate roster `.md` (frontmatter block + body). */
export function rosterMd(fields: P7T7RosterFields, body = 'roster body'): string {
  const lines: string[] = ['---']
  if (fields.schemaVersion !== undefined) lines.push(`schemaVersion: ${fields.schemaVersion}`)
  if (fields.id !== undefined) lines.push(`id: ${fields.id}`)
  if (fields.role !== undefined) lines.push(`role: ${fields.role}`)
  if (fields.name !== undefined) lines.push(`name: ${fields.name}`)
  if (fields.description !== undefined) lines.push(`description: ${fields.description}`)
  lines.push('---')
  lines.push(body)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// The shared fixture homes
// ---------------------------------------------------------------------------

/** The P7-T7 fixture DSH home root (the inspected legacy instance). */
export const P7T7_DSH_HOME: string = 'C:/p7t7/home'
/** The P7-T7 fixture workspace cwd (the legacy instance's workspace). */
export const P7T7_WORKSPACE_CWD: string = 'C:/p7t7/ws'
/** The legacy-team project directory key (the frozen `projectKey` of the team cwd). */
export const P7T7_TEAM_PROJECT_DIR: string = projectKey('C:\\p7t7\\legacy-team')
/** The native-only project directory key. */
export const P7T7_NATIVE_PROJECT_DIR: string = projectKey('C:\\p7t7\\native')

/**
 * The shared legacy-team home fixture:
 *
 * - roster: home lines (leader, alpha, one broken line) + workspace overlay
 *   (alpha overwritten, one id-less line) — workspace wins per id;
 * - project `${P7T7_TEAM_PROJECT_DIR}`: four legacy sessions —
 *   `sess-leader` (unbound, 3 Team facts: the leader), `sess-alpha`
 *   (member-bound), `sess-beta` (member-bound + one corrupt line),
 *   `sess-seeded` (seedLength 2: two seeded-suffix facts excluded, one own
 *   fact counted);
 * - project `${P7T7_NATIVE_PROJECT_DIR}`: a native session (no Team facts)
 *   and a compressed-only session (`session.jsonl.zstd`, undecodable).
 */
export function buildP7T7LegacyHome(): P7T7HomeTree {
  const teamDir = `${P7T7_DSH_HOME}/sessions/${P7T7_TEAM_PROJECT_DIR}`
  const nativeDir = `${P7T7_DSH_HOME}/sessions/${P7T7_NATIVE_PROJECT_DIR}`
  const leaderLog = [
    sessionHeaderLine({
      id: 'sess-leader',
      createdAt: 1700000001000,
      cwd: 'C:\\p7t7\\legacy-team',
      delegationDepth: 0,
    }),
    teamEventLine(P7T7_EVENT_PROGRESS, { teamId: 'sess-leader', state: 'running' }),
    teamEventLine(P7T7_EVENT_CONTROL_REQUEST, { teamId: 'sess-leader', kind: 'status' }),
    teamEventLine(P7T7_EVENT_MESSAGE, { teamId: 'sess-leader', from: 'sess-leader', to: 'sess-alpha' }),
  ].join('\n')
  const alphaLog = [
    sessionHeaderLine({
      id: 'sess-alpha',
      createdAt: 1700000002000,
      cwd: 'C:\\p7t7\\legacy-team',
      origin: 'subagent',
      parentSession: 'sess-leader',
      delegationDepth: 1,
    }),
    teamEventLine(P7T7_EVENT_MEMBER_BOUND, {
      leaderSessionId: 'sess-leader',
      memberSessionId: 'sess-alpha',
    }),
  ].join('\n')
  const betaLog = [
    sessionHeaderLine({
      id: 'sess-beta',
      createdAt: 1700000003000,
      cwd: 'C:\\p7t7\\legacy-team',
      origin: 'subagent',
      parentSession: 'sess-leader',
      delegationDepth: 1,
    }),
    teamEventLine(P7T7_EVENT_MEMBER_BOUND, {
      leaderSessionId: 'sess-leader',
      memberSessionId: 'sess-beta',
    }),
    'not-json{{{',
    teamEventLine(P7T7_EVENT_MESSAGE, { teamId: 'sess-leader', from: 'sess-leader', to: 'sess-beta' }),
  ].join('\n')
  const seededLog = [
    sessionHeaderLine({
      id: 'sess-seeded',
      createdAt: 1700000004000,
      cwd: 'C:\\p7t7\\legacy-team',
      delegationDepth: 0,
      seedLength: 2,
    }),
    teamEventLine(P7T7_EVENT_PROGRESS, { teamId: 'sess-seeded', state: 'seeded' }, 0),
    teamEventLine(P7T7_EVENT_CONTROL_DECISION, { teamId: 'sess-seeded' }, 1),
    teamEventLine(P7T7_EVENT_MESSAGE, { teamId: 'sess-seeded', from: 'sess-leader' }, 2),
  ].join('\n')
  const nativeLog = [
    sessionHeaderLine({
      id: 'sess-native',
      createdAt: 1700000005000,
      cwd: 'C:\\p7t7\\native',
      delegationDepth: 0,
    }),
    otherEventLine('assistant-message', { text: 'native chat line one' }),
    otherEventLine('assistant-message', { text: 'native chat line two' }),
  ].join('\n')
  return createHomeTree({
    [`${P7T7_DSH_HOME}/teammates/01-leader.md`]: rosterMd({
      id: 'p7t7-leader',
      role: 'leader',
      name: 'P7 Leader',
      description: 'leads the legacy team',
      schemaVersion: 1,
    }),
    [`${P7T7_DSH_HOME}/teammates/02-alpha.md`]: rosterMd({
      id: 'p7t7-alpha',
      role: 'teammate',
      name: 'Alpha Home',
      description: 'home roster line',
      schemaVersion: 1,
    }),
    [`${P7T7_DSH_HOME}/teammates/03-broken.md`]: rosterMd({
      id: 'p7t7-broken',
      role: 'overlord',
      name: 'Broken Line',
      schemaVersion: 1,
    }),
    [`${P7T7_WORKSPACE_CWD}/.dsh/teammates/02-alpha.md`]: rosterMd({
      id: 'p7t7-alpha',
      role: 'teammate',
      name: 'Alpha WS',
      description: 'workspace overlay line',
      schemaVersion: 1,
    }),
    [`${P7T7_WORKSPACE_CWD}/.dsh/teammates/04-no-id.md`]: rosterMd({
      role: 'teammate',
      name: 'No Id Line',
      description: 'missing id line',
      schemaVersion: 1,
    }),
    [`${teamDir}/sess-leader/session.jsonl`]: leaderLog,
    [`${teamDir}/sess-alpha/session.jsonl`]: alphaLog,
    [`${teamDir}/sess-beta/session.jsonl`]: betaLog,
    [`${teamDir}/sess-seeded/session.jsonl`]: seededLog,
    [`${nativeDir}/sess-native/session.jsonl`]: nativeLog,
    [`${nativeDir}/sess-zstd/session.jsonl.zstd`]: 'zstd-opaque-bytes',
  })
}

/**
 * The native-only home fixture: NO roster at all, one native session and
 * one compressed-only session — the degradation trigger (no roster members
 * and no Team events anywhere).
 */
export function buildP7T7NativeHome(): P7T7HomeTree {
  const nativeDir = `${P7T7_DSH_HOME}/sessions/${P7T7_NATIVE_PROJECT_DIR}`
  const nativeLog = [
    sessionHeaderLine({
      id: 'sess-native',
      createdAt: 1700000005000,
      cwd: 'C:\\p7t7\\native',
      delegationDepth: 0,
    }),
    otherEventLine('assistant-message', { text: 'native chat line one' }),
  ].join('\n')
  return createHomeTree({
    [`${nativeDir}/sess-native/session.jsonl`]: nativeLog,
    [`${nativeDir}/sess-zstd/session.jsonl.zstd`]: 'zstd-opaque-bytes',
  })
}

/** The inspect request over the shared legacy home fixture. */
export const P7T7_REQUEST: LegacyTeamInspectRequest = {
  dshHome: P7T7_DSH_HOME,
  workspaceCwd: P7T7_WORKSPACE_CWD,
}

/** Plain-JSON serialization of one inspection view (identity channel). */
export function viewJson(view: LegacyTeamInspection): string {
  return JSON.stringify(view)
}

// ---------------------------------------------------------------------------
// Error assertion channels
// ---------------------------------------------------------------------------

/** Capture a thrown value (`undefined` when nothing threw). */
export function captureError(fn: () => void): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

/**
 * Assert `error` is a `LegacyReaderError` with exactly `code` and return
 * its closed-vocabulary details (mirrors the P7 `assert*Code` helpers).
 */
export function assertLegacyCode(
  error: unknown,
  code: LegacyReaderErrorCode,
): { code: LegacyReaderErrorCode; details: Readonly<Record<string, unknown>> } {
  if (!isLegacyReaderError(error)) {
    throw new Error(
      `assertLegacyCode: expected a LegacyReaderError but got ${
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertLegacyCode: expected code '${code}' but got '${error.code}' (${error.message})`,
    )
  }
  return { code: error.code, details: error.details }
}

/** True iff every object in the plain-JSON tree is frozen (cycle-safe). */
export function isDeepFrozen(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null || typeof value !== 'object') return true
  if (seen.has(value as object)) return true
  seen.add(value as object)
  if (!Object.isFrozen(value as object)) return false
  for (const key of Object.keys(value as object)) {
    if (!isDeepFrozen((value as Record<string, unknown>)[key], seen)) return false
  }
  return true
}
