/**
 * tcm-m1-remote-v2.test.ts — TCM M1 (plan §15.3/§15.6): the Remote
 * contract v2 / version-routing surface of `@dsh-agent-team/remote`.
 *
 * Must-covers (M1, adapted to the versioned union design):
 *  - V1 byte-compatibility: a v1 `team.create` (incl. `initialWork`)
 *    round-trips to the v1 port unchanged (same wire shape, same v1
 *    provenance) — v1 wire behavior is preserved;
 *  - v1 closed params: v1 `team.create` + a v2-only field (`workspace`,
 *    `createRequestToken`) → `malformed-params` unknown-field (no
 *    cross-version field leakage in either direction);
 *  - v2 `team.create`: the closed v2 set (rootSessionId, blueprintId,
 *    blueprintRevision?, workspace?) is legal, `workspace` is forwarded
 *    to the `teamCreateV2` port, `initialWork` is unknown-field, v2
 *    responses reuse the v1 shape `{ path, durable, bind }`;
 *  - v2-only `team.admitInitialWork`: legal params forward verbatim to
 *    the port (token echo in provenance), malformed negatives (empty
 *    prompt, oversized prompt, whitespace token, bad rootSessionId,
 *    control-char workspace, unknown field), and a v1 request to the
 *    method → `method-version-unsupported` (typed after the envelope
 *    parse);
 *  - backing error allow-list: the seven TCM vNext §15.6 team-create v2
 *    codes pass through with code + message + cause identity; an
 *    out-of-vocabulary `Error.code` (ENOENT) degrades to `internal-error`
 *    with no leak;
 *  - provenance/error `contractVersion` echoes the REQUEST version (1 or
 *    2);
 *  - catalog facts: 24-method versioned union, the frozen v1 baseline
 *    constant still 1, the v2-only closed set, the availability matrix.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  createRemoteDispatcher,
  isRemoteMethodAvailableInVersion,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_METHOD_NAMES,
  REMOTE_TEAM_ADMIT_INITIAL_WORK_FIELDS,
  REMOTE_TEAM_CREATE_FIELDS,
  REMOTE_TEAM_CREATE_FIELDS_V2,
  REMOTE_V2_ONLY_METHODS,
  REMOTE_V3_ONLY_METHODS,
  SUPPORTED_REMOTE_CONTRACT_VERSIONS,
  type RemoteSafeRecord,
} from '../src/index.js'
import {
  expectError,
  expectSuccess,
  makeDispatcher,
  makeFakePorts,
  p8t3Wire,
  p8t3WireV2,
} from './p8t3-helpers.js'

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

const ROOT_ID = 'root-session-tcm-m1'
const BP_ID = 'BP-TCM-M1'
const BP_REVISION = 3
const WORKSPACE = '/w/proj-tcm-m1'
const TOKEN = 'tok-tcm-m1'
const PROMPT = 'kick off the first investigation'
const ATTACHED_CONTEXT = 'context block for the initial work'
/** A lossless-JSON-safe v1 initial-work record (prompt + context). */
const INITIAL_WORK: Record<string, unknown> = {
  prompt: PROMPT,
  attachedContext: ATTACHED_CONTEXT,
}

/** The seven TCM vNext §15.6 team-create v2 backing codes (allow-list). */
const TCM_BACKING_CODES = [
  'TEAM_CREATE_WORKSPACE_NOT_FOUND',
  'TEAM_CREATE_WORKSPACE_MISMATCH',
  'TEAM_CREATE_WORKSPACE_ATTACH_FAILED',
  'TEAM_CREATE_REQUEST_PAYLOAD_MISMATCH',
  'TEAM_CREATE_ROOT_WORK_UNAVAILABLE',
  'TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH',
  'TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED',
] as const

/** One typed backing error (an `Error` carrying its closed `code`). */
function backingError(code: string): Error {
  const error = new Error(`backing: ${code}`)
  ;(error as Error & { code: string }).code = code
  return error
}

// ---------------------------------------------------------------------------
// Module level (top-level await): drive the real dispatchers over the
// fake ports and capture every scenario result.
// ---------------------------------------------------------------------------

const RT = await (async () => {
  // (a) The base dispatcher: the default fake ports (v2 ports log their
  // calls + echo their arguments into the returned records).
  const base = makeDispatcher()

  // (b) A dispatcher with a RECORDING 4-arg v1 create port (the frozen
  // `TeamCreatePortWithInitialWork` extension) to prove v1 byte-compat:
  // the optional fourth argument carries `initialWork` verbatim.
  const v1Calls: (string | number | undefined | Record<string, unknown>)[][] = []
  const v1RecordingDispatcher = createRemoteDispatcher(
    makeFakePorts({
      teamCreate: {
        create(
          rootSessionId: string,
          blueprintId: string,
          blueprintRevision: number | undefined,
          initialWork?: Record<string, unknown>,
        ): RemoteSafeRecord {
          v1Calls.push([rootSessionId, blueprintId, blueprintRevision, initialWork])
          return {
            path: 'fresh-root',
            durable: { rootSessionId },
            bind: { rootSessionId, blueprintId },
          }
        },
      },
    }),
  )

  // --- V1 byte-compatibility ------------------------------------------------

  const v1CreateWithWork = await v1RecordingDispatcher(
    'team.create',
    p8t3Wire({
      rootSessionId: ROOT_ID,
      blueprintId: BP_ID,
      initialWork: INITIAL_WORK,
    }),
  )
  const v1CreateData = v1CreateWithWork.ok ? (v1CreateWithWork.value.data as Record<string, unknown>) : undefined
  const v1CreateProvenance = v1CreateWithWork.ok ? v1CreateWithWork.value.provenance : undefined

  // --- v1 closed params (no v2 field leakage) --------------------------------

  const v1CreateWithWorkspace = await base.dispatch(
    'team.create',
    p8t3Wire({ rootSessionId: ROOT_ID, blueprintId: BP_ID, workspace: WORKSPACE }),
  )
  const v1CreateWithCreateRequestToken = await base.dispatch(
    'team.create',
    p8t3Wire({ rootSessionId: ROOT_ID, blueprintId: BP_ID, createRequestToken: TOKEN }),
  )

  // --- v2 team.create --------------------------------------------------------

  const v2CreateMinimal = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID }),
  )
  const v2CreateMinimalData = v2CreateMinimal.ok
    ? (v2CreateMinimal.value.data as Record<string, unknown>)
    : undefined
  const v2CreateMinimalProvenance = v2CreateMinimal.ok ? v2CreateMinimal.value.provenance : undefined

  const v2CreateWithWorkspace = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, workspace: WORKSPACE }),
  )
  const v2CreateWorkspaceData = v2CreateWithWorkspace.ok
    ? ((v2CreateWithWorkspace.value.data as Record<string, unknown>)['bind'] as Record<string, unknown>)
    : undefined

  const v2CreateWithRevision = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, blueprintRevision: BP_REVISION }),
  )
  const v2CreateRevisionData = v2CreateWithRevision.ok
    ? ((v2CreateWithRevision.value.data as Record<string, unknown>)['bind'] as Record<string, unknown>)
    : undefined

  const v2CreateWithInitialWork = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, initialWork: INITIAL_WORK }),
  )
  const v2CreateUnknownField = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, bogus: 1 }),
  )
  const v2CreateControlCharWorkspace = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, workspace: 'a\u0001b' }),
  )
  const v2CreateOversizedWorkspace = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, workspace: 'x'.repeat(4097) }),
  )
  const v2CreateBadRoot = await base.dispatch(
    'team.create',
    p8t3WireV2({ rootSessionId: 'not a root session id', blueprintId: BP_ID }),
  )

  // --- v2 team.admitInitialWork ----------------------------------------------

  const v2AdmitLegal = await base.dispatch(
    'team.admitInitialWork',
    p8t3WireV2({
      rootSessionId: ROOT_ID,
      requestToken: TOKEN,
      prompt: PROMPT,
      attachedContext: ATTACHED_CONTEXT,
    }),
  )
  const v2AdmitLegalData = v2AdmitLegal.ok
    ? (v2AdmitLegal.value.data as Record<string, unknown>)
    : undefined
  const v2AdmitLegalProvenance = v2AdmitLegal.ok ? v2AdmitLegal.value.provenance : undefined

  const v2AdmitEmptyPrompt = await base.dispatch(
    'team.admitInitialWork',
    p8t3WireV2({ rootSessionId: ROOT_ID, requestToken: TOKEN, prompt: '' }),
  )
  const v2AdmitOversizedPrompt = await base.dispatch(
    'team.admitInitialWork',
    p8t3WireV2({
      rootSessionId: ROOT_ID,
      requestToken: TOKEN,
      prompt: 'x'.repeat(200001),
    }),
  )
  const v2AdmitWhitespaceToken = await base.dispatch(
    'team.admitInitialWork',
    p8t3WireV2({ rootSessionId: ROOT_ID, requestToken: 'tok x', prompt: PROMPT }),
  )
  const v2AdmitBadRoot = await base.dispatch(
    'team.admitInitialWork',
    p8t3WireV2({ rootSessionId: 'not a root session id', requestToken: TOKEN, prompt: PROMPT }),
  )
  const v2AdmitUnknownField = await base.dispatch(
    'team.admitInitialWork',
    p8t3WireV2({
      rootSessionId: ROOT_ID,
      requestToken: TOKEN,
      prompt: PROMPT,
      bogus: 1,
    }),
  )

  // --- version gating ---------------------------------------------------------

  const v1ToV2OnlyMethod = await base.dispatch(
    'team.admitInitialWork',
    p8t3Wire({ rootSessionId: ROOT_ID, requestToken: TOKEN, prompt: PROMPT }),
  )

  // --- backing error allow-list ------------------------------------------------

  const backingResults: Record<string, Awaited<ReturnType<typeof base.dispatch>>> = {}
  for (const code of TCM_BACKING_CODES) {
    const throwing = createRemoteDispatcher(
      makeFakePorts({
        teamAdmitInitialWork: {
          admit(): RemoteSafeRecord {
            throw backingError(code)
          },
        },
      }),
    )
    backingResults[code] = await throwing(
      'team.admitInitialWork',
      p8t3WireV2({ rootSessionId: ROOT_ID, requestToken: TOKEN, prompt: PROMPT }),
    )
  }

  // Out-of-vocabulary backing error: a Node-style filesystem failure.
  const outOfVocabulary = createRemoteDispatcher(
    makeFakePorts({
      teamCreateV2: {
        create(): RemoteSafeRecord {
          const error = new Error("ENOENT: no such file or directory, open 'C:\\secret\\workspace'")
          ;(error as Error & { code: string }).code = 'ENOENT'
          throw error
        },
      },
    }),
  )
  const outOfVocabularyResult = await outOfVocabulary(
    'team.create',
    p8t3WireV2({ rootSessionId: ROOT_ID, blueprintId: BP_ID, workspace: WORKSPACE }),
  )

  return {
    baseCalls: base.ports.calls,
    v1Calls,
    v2CreateMinimal,
    v1CreateData,
    v1CreateProvenance,
    v1CreateWithWork,
    v1CreateWithWorkspace,
    v1CreateWithCreateRequestToken,
    v2CreateMinimalData,
    v2CreateMinimalProvenance,
    v2CreateWithWorkspace,
    v2CreateWorkspaceData,
    v2CreateWithRevision,
    v2CreateRevisionData,
    v2CreateWithInitialWork,
    v2CreateUnknownField,
    v2CreateControlCharWorkspace,
    v2CreateOversizedWorkspace,
    v2CreateBadRoot,
    v2AdmitLegalData,
    v2AdmitLegalProvenance,
    v2AdmitEmptyPrompt,
    v2AdmitOversizedPrompt,
    v2AdmitWhitespaceToken,
    v2AdmitBadRoot,
    v2AdmitUnknownField,
    v1ToV2OnlyMethod,
    backingResults,
    outOfVocabularyResult,
  }
})()

// ---------------------------------------------------------------------------
// V1 byte-compatibility
// ---------------------------------------------------------------------------

describe('TCM M1: v1 wire behavior is preserved (byte-compatible)', () => {
  it('v1 team.create + initialWork → the v1 port receives the fourth argument verbatim', () => {
    expectSuccess(RT.v1CreateWithWork)
    expect(RT.v1Calls.length).toBe(1)
    expect(RT.v1Calls[0]).toEqual([ROOT_ID, BP_ID, undefined, INITIAL_WORK])
  })

  it('v1 team.create keeps the frozen wire shape { path, durable, bind } with v1 provenance', () => {
    const data = RT.v1CreateData
    expect(data !== undefined).toBe(true)
    if (data === undefined) throw new Error('expected the v1 success data')
    expect(Object.keys(data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(data['path']).toBe('fresh-root')
    const provenance = RT.v1CreateProvenance
    if (provenance === undefined) throw new Error('expected the v1 success provenance')
    expect(provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION)
    expect(provenance.method).toBe('team.create')
  })

  it('v1 team.create + workspace → malformed-params unknown-field (v2 field rejected on v1)', () => {
    const error = expectError(RT.v1CreateWithWorkspace)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('workspace')
    expect(details['reason']).toBe('unknown-field')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
  })

  it('v1 team.create + createRequestToken → malformed-params unknown-field', () => {
    const error = expectError(RT.v1CreateWithCreateRequestToken)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('createRequestToken')
    expect(details['reason']).toBe('unknown-field')
  })
})

// ---------------------------------------------------------------------------
// v2 team.create
// ---------------------------------------------------------------------------

describe('TCM M1: v2 team.create (the workspace-aware variant)', () => {
  it('v2 create → success, served by the teamCreateV2 port (never the v1 port)', () => {
    expectSuccess(RT.v2CreateMinimal)
    // The v2 port label is present; the v1 port label is ABSENT (the v1
    // create port was never invoked by any v2 request).
    expect(RT.baseCalls.includes('team.create.v2')).toBe(true)
    expect(RT.baseCalls.includes('team.create')).toBe(false)
  })

  it('v2 create response reuses the v1 shape { path, durable, bind } and echoes version 2', () => {
    const data = RT.v2CreateMinimalData
    expect(data !== undefined).toBe(true)
    if (data === undefined) throw new Error('expected the v2 success data')
    expect(Object.keys(data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(data['path']).toBe('fresh-root')
    const provenance = RT.v2CreateMinimalProvenance
    if (provenance === undefined) throw new Error('expected the v2 success provenance')
    expect(provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    expect(provenance.method).toBe('team.create')
  })

  it('v2 workspace is forwarded to the port verbatim (echoed in bind)', () => {
    expectSuccess(RT.v2CreateWithWorkspace)
    const bind = RT.v2CreateWorkspaceData
    if (bind === undefined) throw new Error('expected the v2 workspace bind')
    expect(bind['workspace']).toBe(WORKSPACE)
  })

  it('v2 blueprintRevision is forwarded to the port', () => {
    expectSuccess(RT.v2CreateWithRevision)
    const bind = RT.v2CreateRevisionData
    if (bind === undefined) throw new Error('expected the v2 revision bind')
    expect(bind['blueprintRevision']).toBe(BP_REVISION)
  })

  it('v2 + initialWork → malformed-params unknown-field (create-only v2)', () => {
    const error = expectError(RT.v2CreateWithInitialWork)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('initialWork')
    expect(details['reason']).toBe('unknown-field')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })

  it('v2 unknown field → malformed-params unknown-field', () => {
    const error = expectError(RT.v2CreateUnknownField)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('bogus')
    expect(details['reason']).toBe('unknown-field')
  })

  it('v2 control-char workspace → malformed-params (invalid-value)', () => {
    const error = expectError(RT.v2CreateControlCharWorkspace)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('workspace')
    expect(details['reason']).toBe('invalid-value')
  })

  it('v2 oversized workspace (> 4096) → malformed-params (invalid-value)', () => {
    const error = expectError(RT.v2CreateOversizedWorkspace)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('workspace')
    expect(details['reason']).toBe('invalid-value')
  })

  it('v2 malformed rootSessionId → the mirrored frozen P3 code INVALID_ROOT_SESSION_ID', () => {
    const error = expectError(RT.v2CreateBadRoot)
    expect(error.error.code).toBe('INVALID_ROOT_SESSION_ID')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })
})

// ---------------------------------------------------------------------------
// v2 team.admitInitialWork (v2-only)
// ---------------------------------------------------------------------------

describe('TCM M1: v2 team.admitInitialWork (v2-only command)', () => {
  it('legal v2 admit → port args forwarded verbatim, data echoed, token in provenance, version 2', () => {
    const data = RT.v2AdmitLegalData
    expect(data !== undefined).toBe(true)
    if (data === undefined) throw new Error('expected the admit success data')
    expect(data['admitted']).toBe(true)
    expect(data['rootSessionId']).toBe(ROOT_ID)
    expect(data['requestToken']).toBe(TOKEN)
    expect(data['prompt']).toBe(PROMPT)
    expect(data['attachedContext']).toBe(ATTACHED_CONTEXT)
    const provenance = RT.v2AdmitLegalProvenance
    if (provenance === undefined) throw new Error('expected the admit success provenance')
    expect(provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    expect(provenance.method).toBe('team.admitInitialWork')
    expect(provenance.requestToken).toBe(TOKEN)
  })

  it('empty prompt → malformed-params (invalid-value, field prompt)', () => {
    const error = expectError(RT.v2AdmitEmptyPrompt)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('prompt')
    expect(details['reason']).toBe('invalid-value')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })

  it('oversized prompt (> 200000) → malformed-params (invalid-value, field prompt)', () => {
    const error = expectError(RT.v2AdmitOversizedPrompt)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('prompt')
    expect(details['reason']).toBe('invalid-value')
  })

  it('whitespace requestToken → malformed-params (invalid-value, field requestToken)', () => {
    const error = expectError(RT.v2AdmitWhitespaceToken)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('requestToken')
    expect(details['reason']).toBe('invalid-value')
  })

  it('malformed rootSessionId → INVALID_ROOT_SESSION_ID (mirrored frozen P3 code)', () => {
    const error = expectError(RT.v2AdmitBadRoot)
    expect(error.error.code).toBe('INVALID_ROOT_SESSION_ID')
  })

  it('unknown field → malformed-params unknown-field', () => {
    const error = expectError(RT.v2AdmitUnknownField)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('bogus')
    expect(details['reason']).toBe('unknown-field')
  })

  it('a v1 request to the v2-only method → method-version-unsupported (typed after envelope parse)', () => {
    const error = expectError(RT.v1ToV2OnlyMethod)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    expect(error.error.code).toBe('method-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.admitInitialWork')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['field']).toBe('method')
    expect(details['reason']).toBe('method-not-available-in-version')
  })
})

// ---------------------------------------------------------------------------
// Backing error allow-list (invariant 4b, TCM vNext §4.2 codes)
// ---------------------------------------------------------------------------

describe('TCM M1: backing error allow-list (the seven team-create v2 codes)', () => {
  it('every TCM v2 code passes through with code + message + cause identity (v2 provenance echo)', () => {
    for (const code of TCM_BACKING_CODES) {
      const result = RT.backingResults[code]
      expect(result !== undefined).toBe(true)
      if (result === undefined) throw new Error(`missing scenario for ${code}`)
      const error = expectError(result)
      expect(error.error.code).toBe(code)
      expect(error.error.message).toBe(`backing: ${code}`)
      const details = error.error.details as unknown as Record<string, unknown>
      expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
      expect(details['reason']).toBe('domain-error')
      const cause = details['cause'] as Record<string, unknown> | undefined
      expect(cause !== undefined).toBe(true)
      if (cause === undefined) throw new Error(`missing cause for ${code}`)
      expect(cause['code']).toBe(code)
      expect(cause['message']).toBe(`backing: ${code}`)
    }
  })

  it('an out-of-vocabulary backing code (ENOENT) → internal-error, no leak', () => {
    const error = expectError(RT.outOfVocabularyResult)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(error.error.message).toBe('internal error in remote handler')
    const wire = JSON.stringify(error.error)
    expect(wire.includes('ENOENT')).toBe(false)
    expect(wire.includes('secret')).toBe(false)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
    expect(details['reason']).toBe('untyped-error')
  })
})

// ---------------------------------------------------------------------------
// Catalog facts (the versioned union)
// ---------------------------------------------------------------------------

describe('TCM M1: catalog facts (versioned union, closed)', () => {
  it('the frozen v1 baseline constant stays 1, v2 is a distinct stamp, and the D1 v3 bump extends the supported set', () => {
    expect(REMOTE_CONTRACT_VERSION).toBe(1)
    expect(REMOTE_CONTRACT_VERSION_V2).toBe(2)
    expect(REMOTE_CONTRACT_VERSION_V3).toBe(3)
    expect(SUPPORTED_REMOTE_CONTRACT_VERSIONS).toEqual([1, 2, 3])
  })

  it('the closed catalog is the versioned union: 26 methods (23 v1 + 1 v2-only + 2 v3-only)', () => {
    expect(REMOTE_METHOD_NAMES.length).toBe(26)
    expect(REMOTE_V2_ONLY_METHODS).toEqual(['team.admitInitialWork'])
    // the D1 (Team D1-D6 repair v2) v3-only closed set
    expect([...REMOTE_V3_ONLY_METHODS].sort()).toEqual(['team.ensureRootLive', 'team.listRoots'])
  })

  it('the closed field sets are frozen per version', () => {
    expect([...REMOTE_TEAM_CREATE_FIELDS].sort()).toEqual([
      'blueprintId',
      'blueprintRevision',
      'initialWork',
      'rootSessionId',
    ])
    expect([...REMOTE_TEAM_CREATE_FIELDS_V2].sort()).toEqual([
      'blueprintId',
      'blueprintRevision',
      'rootSessionId',
      'workspace',
    ])
    expect([...REMOTE_TEAM_ADMIT_INITIAL_WORK_FIELDS].sort()).toEqual([
      'attachedContext',
      'prompt',
      'requestToken',
      'rootSessionId',
    ])
  })

  it('the availability matrix: v2-only set is closed; everything else is v1-legal', () => {
    expect(isRemoteMethodAvailableInVersion('team.admitInitialWork', 1)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.admitInitialWork', 2)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.create', 1)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.create', 2)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('catalog.list', 2)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('nope.notInCatalog', 2)).toBe(false)
  })
})
