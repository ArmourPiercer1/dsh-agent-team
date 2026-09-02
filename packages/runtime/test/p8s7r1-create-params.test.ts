/**
 * P8-S7R1 / R1-A (BC-03, plan L1720) — `team.create` optional `initialWork`:
 * closed-contract (wire) acceptance.
 *
 * C-WIRE — the optional `initialWork` field of the closed `team.create`
 * param set (additive only — the closed 9-category / 23-method catalog and
 * every other field set are UNCHANGED):
 *
 * - W1 the parser accepts a lossless-record `initialWork` and carries it
 *   through byte-identically; an ABSENT `initialWork` leaves the field
 *   ABSENT from the parsed value (byte-identical pre-R1-A parsed shape);
 * - W2 a non-record `initialWork` (string / array / null) is rejected with
 *   `malformed-params`, field `initialWork`, reason `invalid-value`;
 * - W3 an unknown field is rejected with `malformed-params`, reason
 *   `unknown-field`, and the closed field set is exactly the pre-R1-A set +
 *   `initialWork` (the additive diff is exactly one field);
 * - W4 the team category handler passes the optional fourth argument: a
 *   4-arg port receives `initialWork` verbatim (or `undefined` when
 *   absent), while a FROZEN 3-arg port keeps byte-identical behavior (the
 *   extra argument is ignored by arity — same three arguments, same
 *   reply): the frozen remote contract is unchanged.
 *
 * The 4-arg fake declares its fourth parameter OPTIONAL so it still
 * satisfies the frozen `RemoteTeamCreatePort` interface — the same arity
 * rule the production handler relies on (`TeamCreatePortWithInitialWork`
 * is satisfied by a plain typed assignment, no cast).
 *
 * Pure wire surface: no world, no durable state, fake ports only.
 *
 * @module @dsh-agent-team/runtime/test/p8s7r1-create-params
 */

import { describe, expect, it } from 'vitest'

import {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_TEAM_CREATE_FIELDS,
  createRemoteTeamHandler,
  parseRemoteTeamCreateParams,
} from '../../remote/src/index.js'
import type {
  RemoteLedgerPort,
  RemoteProjectionPort,
  RemoteSafeRecord,
  RemoteTeamCreatePort,
} from '../../remote/src/index.js'

const METHOD = 'team.create'
const ROOT_ID = 'root-session-p8s7r1'
const BP_ID = 'BP-P8S7R1'
/** A lossless-JSON-safe initial-work record (prompt + optional context). */
const WORK: Record<string, unknown> = {
  prompt: 'kick off the first investigation',
  attachedContext: 'context block for the initial work',
}

// ---------------------------------------------------------------------------
// Parser (W1-W3)
// ---------------------------------------------------------------------------

interface ParseOutcome {
  readonly value: Record<string, unknown> | undefined
  readonly error: { readonly code: string; readonly details: Record<string, unknown> } | undefined
}

function parseCreate(params: Record<string, unknown>): ParseOutcome {
  try {
    const parsed = parseRemoteTeamCreateParams(METHOD, params as RemoteSafeRecord)
    return { value: parsed as unknown as Record<string, unknown>, error: undefined }
  } catch (error) {
    const record = (error ?? {}) as { code?: unknown; details?: unknown }
    return {
      value: undefined,
      error: {
        code: record.code !== undefined ? String(record.code) : '<none>',
        details: record.details !== undefined ? (record.details as Record<string, unknown>) : {},
      },
    }
  }
}

describe('P8-S7R1 R1-A W1-W3: parseRemoteTeamCreateParams initialWork (closed, additive)', () => {
  it('W1a: accepts a lossless-record initialWork and carries it through byte-identically', () => {
    const outcome = parseCreate({ rootSessionId: ROOT_ID, blueprintId: BP_ID, initialWork: WORK })
    expect(outcome.error).toBe(undefined)
    const value = outcome.value as Record<string, unknown>
    expect(value['rootSessionId']).toBe(ROOT_ID)
    expect(value['blueprintId']).toBe(BP_ID)
    expect(value['blueprintRevision']).toBe(undefined)
    const carried = value['initialWork'] as Record<string, unknown>
    expect(carried).toEqual(WORK)
    // byte-identical: same keys in the same order, same leaf values
    expect(Object.keys(carried)).toEqual(['prompt', 'attachedContext'])
    expect(carried['prompt']).toBe(WORK['prompt'])
    expect(carried['attachedContext']).toBe(WORK['attachedContext'])
  })

  it('W1b: absent initialWork leaves the field ABSENT from the parsed value (byte-identical pre-R1-A shape)', () => {
    const outcome = parseCreate({ rootSessionId: ROOT_ID, blueprintId: BP_ID })
    expect(outcome.error).toBe(undefined)
    const value = outcome.value as Record<string, unknown>
    expect('initialWork' in value).toBe(false)
    expect(Object.keys(value).sort()).toEqual(['blueprintId', 'rootSessionId'])
  })

  it('W2: rejects non-record initialWork (string / array / null) with malformed-params invalid-value on field initialWork', () => {
    for (const bad of ['just a string', [WORK], null]) {
      const outcome = parseCreate({ rootSessionId: ROOT_ID, blueprintId: BP_ID, initialWork: bad })
      expect(outcome.value).toBe(undefined)
      const error = outcome.error as { readonly code: string; readonly details: Record<string, unknown> }
      expect(error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
      expect(error.details['field']).toBe('initialWork')
      expect(error.details['reason']).toBe('invalid-value')
    }
  })

  it('W3a: rejects an unknown field with malformed-params unknown-field (the closed set holds)', () => {
    const outcome = parseCreate({ rootSessionId: ROOT_ID, blueprintId: BP_ID, extra: 1 })
    expect(outcome.value).toBe(undefined)
    const error = outcome.error as { readonly code: string; readonly details: Record<string, unknown> }
    expect(error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.details['field']).toBe('extra')
    expect(error.details['reason']).toBe('unknown-field')
  })

  it('W3b: the closed team.create field set is exactly the pre-R1-A set + initialWork (additive diff = 1 field)', () => {
    expect([...REMOTE_TEAM_CREATE_FIELDS].sort()).toEqual([
      'blueprintId',
      'blueprintRevision',
      'initialWork',
      'rootSessionId',
    ])
  })
})

// ---------------------------------------------------------------------------
// Handler port wiring (W4)
// ---------------------------------------------------------------------------

/** The frozen value shape the team.create handler validates. */
function replyShape(): RemoteSafeRecord {
  return {
    path: 'fresh-root',
    durable: {
      rootSessionId: ROOT_ID,
      blueprint: { blueprintId: BP_ID, revision: '1', contentHash: 'sha256:test' },
    },
    bind: { bound: true },
  }
}

/**
 * One recording `team.create` port (the 4-arg form declares its fourth
 * parameter optional, so it STILL satisfies the frozen
 * `RemoteTeamCreatePort`). Records the EXACT argument tuple it was called
 * with (a frozen 3-arg function, by JS semantics, never sees the fourth).
 */
function recordingCreatePort(arity: 3 | 4): {
  readonly port: RemoteTeamCreatePort
  readonly calls: unknown[][]
} {
  const calls: unknown[][] = []
  const port: RemoteTeamCreatePort =
    arity === 3
      ? {
          create(rootSessionId: string, blueprintId: string, blueprintRevision: number | undefined) {
            calls.push([rootSessionId, blueprintId, blueprintRevision])
            return replyShape()
          },
        }
      : {
          create(
            rootSessionId: string,
            blueprintId: string,
            blueprintRevision: number | undefined,
            initialWork?: RemoteSafeRecord,
          ) {
            calls.push([rootSessionId, blueprintId, blueprintRevision, initialWork])
            return replyShape()
          },
        }
  return { port, calls }
}

/** The team handler over one recording create port (the other two ports unused). */
function handlerWith(create: RemoteTeamCreatePort) {
  function unused(): never {
    throw new Error('this test only routes team.create')
  }
  return createRemoteTeamHandler({
    teamCreate: create,
    projection: { project: unused } as unknown as RemoteProjectionPort,
    ledger: { listEntries: unused, countEntries: unused } as unknown as RemoteLedgerPort,
  })
}

interface CreateReply {
  readonly data: { readonly path: string; readonly durable: unknown; readonly bind: Record<string, unknown> }
}

describe('P8-S7R1 R1-A W4: team handler passes the optional fourth argument', () => {
  it('W4a: a 4-arg port receives initialWork verbatim; the reply shape is unchanged', () => {
    const { port, calls } = recordingCreatePort(4)
    const handler = handlerWith(port)
    const params = parseRemoteTeamCreateParams(METHOD, {
      rootSessionId: ROOT_ID,
      blueprintId: BP_ID,
      initialWork: WORK,
    } as RemoteSafeRecord)
    const outcome = handler('team.create', params) as CreateReply
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual([ROOT_ID, BP_ID, undefined, WORK])
    // the reply is the frozen { path, durable, bind } — no work field
    expect(Object.keys(outcome.data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(outcome.data['path']).toBe('fresh-root')
  })

  it('W4b: a 4-arg port receives undefined (not the field) when initialWork is absent', () => {
    const { port, calls } = recordingCreatePort(4)
    const handler = handlerWith(port)
    const params = parseRemoteTeamCreateParams(METHOD, {
      rootSessionId: ROOT_ID,
      blueprintId: BP_ID,
    } as RemoteSafeRecord)
    handler('team.create', params)
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual([ROOT_ID, BP_ID, undefined, undefined])
  })

  it('W4c: a FROZEN 3-arg port keeps byte-identical behavior (extra argument ignored by arity)', () => {
    const { port, calls } = recordingCreatePort(3)
    const handler = handlerWith(port)
    const params = parseRemoteTeamCreateParams(METHOD, {
      rootSessionId: ROOT_ID,
      blueprintId: BP_ID,
      blueprintRevision: 2,
      initialWork: WORK,
    } as RemoteSafeRecord)
    const outcome = handler('team.create', params) as CreateReply
    // the frozen port sees exactly the three frozen arguments — initialWork
    // is never delivered to a 3-arg implementation (byte-identical behavior)
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual([ROOT_ID, BP_ID, 2])
    expect(Object.keys(outcome.data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(outcome.data['path']).toBe('fresh-root')
  })
})
