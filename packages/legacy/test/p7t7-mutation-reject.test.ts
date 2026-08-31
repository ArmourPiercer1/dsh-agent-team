/**
 * p7t7-mutation-reject.test.ts — P7-T7 G7 criterion 9 (TaskDoc §11.8 P7-T7;
 * DevPlan §20.7; Architecture invariant 65): a legacy old Team CANNOT be
 * mutated/resumed/restored — there is NO entry to do so, ever.
 *
 * The guarantee is structural AND typed:
 *
 * - the port surface has no write method to call (asserted on a bare port
 *   object: its own keys are exactly `listDir` + `readFile`);
 * - the dispatch surface (`dispatchReaderAction`) accepts exactly one
 *   action token (`inspect`); EVERY other action — a mutate, resume,
 *   restore, delete, fork, or anything else — throws the typed
 *   `LEGACY_READER_MUTATION_REJECTED` error with the offending action in
 *   the details;
 * - a rejected attempt is a NO-OP: the port is never called, the home
 *   tree is byte-identical before/after, and a subsequent `inspect`
 *   returns the identical view;
 * - malformed action tokens (non-string / empty) are rejected as
 *   `LEGACY_READER_INVALID_REQUEST` (they name no action at all).
 *
 * Zero-core: in-memory home tree behind the recording port (no `node:`
 * imports); synchronous `it()` bodies over captured top-level data.
 *
 * @module @dsh-agent-team/legacy/test/p7t7-mutation-reject
 */

import { describe, expect, it } from 'vitest'
import {
  LEGACY_READER_ERROR_CODES,
  dispatchReaderAction,
  inspectLegacyTeam,
} from '../session-reader/index.js'
import {
  P7T7_REQUEST,
  assertLegacyCode,
  buildP7T7LegacyHome,
  captureError,
  createPlainHomePort,
  homeTreeSnapshot,
  RecordingLegacyHomePort,
  viewJson,
} from './p7t7-helpers.js'

// ---------------------------------------------------------------------------
// The inspected home + the read-only view (before any attempted action)
// ---------------------------------------------------------------------------

const tree = buildP7T7LegacyHome()
const port = new RecordingLegacyHomePort(tree)
const beforeView = inspectLegacyTeam(port, P7T7_REQUEST)
const beforeJson = viewJson(beforeView)
const homeBefore = homeTreeSnapshot(tree)
const callsBefore = port.calls.length

// ---------------------------------------------------------------------------
// A: `inspect` is the ONLY accepted action (the success path)
// ---------------------------------------------------------------------------

const inspectViaDispatch = dispatchReaderAction(port, 'inspect', P7T7_REQUEST)
const dispatchInspectJson = viewJson(inspectViaDispatch)
const callsAfterInspect = port.calls.length

// ---------------------------------------------------------------------------
// B: every mutation-style action is rejected with the typed error
// ---------------------------------------------------------------------------

const MUTATION_ACTIONS: readonly string[] = [
  'mutate',
  'resume',
  'restore',
  'fork',
  'create',
  'delete',
  'update',
  'archive',
  'activate',
  'rebind',
  'import',
]

const rejected = MUTATION_ACTIONS.map((action) => {
  const error = captureError(() => dispatchReaderAction(port, action, P7T7_REQUEST))
  const typed = assertLegacyCode(
    error,
    LEGACY_READER_ERROR_CODES.LEGACY_READER_MUTATION_REJECTED,
  )
  return { action, detailsAction: typed.details['action'] }
})

// Case sensitivity is part of the contract (only the exact token works).
const rejectedCase = MUTATION_ACTIONS.map((action) => {
  const variant = action.toUpperCase()
  const error = captureError(() => dispatchReaderAction(port, variant, P7T7_REQUEST))
  return {
    action: variant,
    typed:
      error !== undefined
        ? assertLegacyCode(error, LEGACY_READER_ERROR_CODES.LEGACY_READER_MUTATION_REJECTED)
        : undefined,
  }
})

// ---------------------------------------------------------------------------
// C: malformed action tokens (no action named at all)
// ---------------------------------------------------------------------------

const MALFORMED_ACTIONS: readonly unknown[] = [42, null, undefined, {}, [], '', 'Inspect', 'inspect ']
const malformed = MALFORMED_ACTIONS.map((action) => {
  const error = captureError(() => dispatchReaderAction(port, action, P7T7_REQUEST))
  if (error === undefined) throw new Error(`p7t7-mutation-reject: action ${String(action)} did not throw`)
  return {
    action,
    code: assertLegacyCode(
      error,
      typeof action === 'string' && action.length > 0
        ? LEGACY_READER_ERROR_CODES.LEGACY_READER_MUTATION_REJECTED
        : LEGACY_READER_ERROR_CODES.LEGACY_READER_INVALID_REQUEST,
    ).code,
  }
})

// ---------------------------------------------------------------------------
// D: the NO-OP proof (rejected attempts touch nothing)
// ---------------------------------------------------------------------------

// The rejected attempts must not add a single port call: route the whole
// rejection battery through a FRESH recording port and count its calls.
const rejectionsOnly = (() => {
  const silentPort = new RecordingLegacyHomePort(tree)
  for (const action of MUTATION_ACTIONS) {
    captureError(() => dispatchReaderAction(silentPort, action, P7T7_REQUEST))
  }
  return silentPort.calls.length
})()

// The final view (after every rejected attempt) must be identical.
const afterView = inspectLegacyTeam(port, P7T7_REQUEST)
const afterJson = viewJson(afterView)
const homeAfter = homeTreeSnapshot(tree)

// ---------------------------------------------------------------------------
// E: the port surface has no write method to call
// ---------------------------------------------------------------------------

const plainPort = createPlainHomePort(tree)
const portSurfaceKeys = Object.keys(plainPort).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

// ===========================================================================
// Assertions
// ===========================================================================

describe('P7-T7 M1: `inspect` is the only accepted action (dispatch success path)', () => {
  it('dispatch inspect returns the identical frozen view as the direct entry', () => {
    expect(dispatchInspectJson).toBe(beforeJson)
  })
  it('the inspect action did perform read port calls (the reads are real)', () => {
    expect(callsAfterInspect - callsBefore).toBeGreaterThan(0)
  })
})

describe('P7-T7 M2: every mutation-style action is typed-rejected (criterion 9)', () => {
  it('each of the eleven mutation verbs throws LEGACY_READER_MUTATION_REJECTED', () => {
    expect(rejected.length).toBe(11)
    for (const r of rejected) {
      expect(r.detailsAction).toBe(r.action)
    }
    expect(rejected.map((r) => r.action)).toEqual([
      'mutate',
      'resume',
      'restore',
      'fork',
      'create',
      'delete',
      'update',
      'archive',
      'activate',
      'rebind',
      'import',
    ])
  })
  it('action matching is exact (case-sensitive): variants are rejected too', () => {
    for (const r of rejectedCase) {
      if (r.typed === undefined) throw new Error(`p7t7-mutation-reject: '${r.action}' did not throw`)
      expect(r.typed.details['action']).toBe(r.action)
    }
  })
  it('malformed action tokens: INVALID_REQUEST (or MUTATION_REJECTED for non-empty strings)', () => {
    for (const m of malformed) {
      if (m.action === '' || typeof m.action !== 'string') {
        expect(m.code).toBe('LEGACY_READER_INVALID_REQUEST')
      } else {
        expect(m.code).toBe('LEGACY_READER_MUTATION_REJECTED')
      }
    }
  })
})

describe('P7-T7 M3: a rejected attempt is a NO-OP (nothing touched)', () => {
  it('the rejected attempts made ZERO port calls (fresh-port battery)', () => {
    expect(rejectionsOnly).toBe(0)
  })
  it('the home tree is byte-identical before/after all rejected attempts', () => {
    expect(homeAfter).toEqual(homeBefore)
  })
  it('a subsequent inspect returns the identical view', () => {
    expect(afterJson).toBe(beforeJson)
  })
  it('the port log contains only read ops (the only ops that exist)', () => {
    port.assertOnlyReadOps()
    expect(port.calls.length).toBeGreaterThan(0)
  })
})

describe('P7-T7 M4: the port surface has no write method to call', () => {
  it('a bare port object exposes exactly listDir + readFile', () => {
    expect(portSurfaceKeys).toEqual(['listDir', 'readFile'])
  })
  it('neither surface key is a write-style op', () => {
    expect(portSurfaceKeys.includes('writeFile')).toBe(false)
    expect(portSurfaceKeys.includes('createDir')).toBe(false)
    expect(portSurfaceKeys.includes('remove')).toBe(false)
  })
})
