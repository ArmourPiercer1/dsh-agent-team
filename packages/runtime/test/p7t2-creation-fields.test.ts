/**
 * p7t2-creation-fields — TaskDoc §11.8 P7-T2 must-test: the
 * per-MemberInstance creation fields (Architecture §21.2 / §21.6):
 *
 * - registration records `workspace` + `contextPolicy` once, and starts
 *   two provenance ledger entries (origin `static`, kind
 *   `creationField`, effective from the next step);
 * - `contextPolicy` is immutable FROM CREATION — every mutation request
 *   is `IMMUTABLE_CREATION_FIELD` (rule `immutableAfterCreation`),
 *   before or after first RUNNING;
 * - `workspace` is mutable ONLY BEFORE the instance's first RUNNING:
 *   admitted (store updated + ledger entry) before, `IMMUTABLE_CREATION_FIELD`
 *   (rule `immutableAfterFirstRunning`) after;
 * - an unregistered instance is `UNKNOWN_INSTANCE` for both mutation and
 *   `beginStep`;
 * - `beginStep` marks first RUNNING (the workspace lock flips) and the
 *   in-flight capture is releasable (overlapping steps settle to zero);
 * - malformed field/value inputs are `MALFORMED_MUTATION_INPUT`.
 *
 * @module @dsh-agent-team/runtime/test/p7t2-creation-fields
 */

import { describe, expect, it } from 'vitest'
import type { CreationFieldRecord, MutationLedgerEntry } from '../mutation/index.js'
import {
  assertMutationCode,
  captureError,
  createP7T2World,
  fixtureMember,
  P7T2_ALPHA,
  P7T2_GAMMA,
  P7T2_TEAM,
  type P7T2World,
} from './p7t2-helpers.js'

const alpha = () => fixtureMember(P7T2_ALPHA)
const gamma = () => fixtureMember(P7T2_GAMMA)

interface CreationFieldsSnapshot {
  readonly fieldsAfterRegister: CreationFieldRecord
  readonly registerLedger: MutationLedgerEntry[]
  readonly duplicateRegister: { thrown: boolean; code?: string; field?: string; instanceId?: string }
  readonly contextPolicyBeforeRun: { thrown: boolean; code?: string; rule?: string }
  readonly workspaceBeforeRun: { thrown: boolean; code?: string }
  readonly fieldsAfterWorkspaceChange: CreationFieldRecord
  readonly workspaceLedgerEntry: MutationLedgerEntry | undefined
  readonly beginStep1: { ok: boolean; step: number }
  readonly beginStep2: { ok: boolean; step: number }
  readonly fieldsAfterRun: CreationFieldRecord
  readonly workspaceAfterRun: { thrown: boolean; code?: string; rule?: string }
  readonly contextPolicyAfterRun: { thrown: boolean; code?: string; rule?: string }
  readonly inflightWhileOpen: number
  readonly inflightAfterRelease: number
  readonly gammaMutation: { thrown: boolean; code?: string; instanceId?: string }
  readonly gammaBeginStep: { thrown: boolean; code?: string; instanceId?: string }
  readonly malformed: Record<string, { thrown: boolean; code?: string; field?: string }>
}

const s1: CreationFieldsSnapshot = (() => {
  const world: P7T2World = createP7T2World({})
  const { service, store } = world

  // --- registration (step 0) -------------------------------------------------
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })
  const fieldsAfterRegister = store.getCreationFields(P7T2_TEAM, P7T2_ALPHA)
  if (fieldsAfterRegister === undefined) throw new Error('p7t2 fixture: registration missing')
  // Copy: the ledger is append-only and grows with later admissions.
  const registerLedger = [...store.listLedger(P7T2_TEAM)]

  // Duplicate registration.
  const dupErr = captureError(() =>
    service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-again', contextPolicy: 'ctx-again' }),
  )
  const duplicateRegister = dupErr.thrown
    ? (() => {
        const checked = assertMutationCode(dupErr.error, 'MALFORMED_MUTATION_INPUT')
        return {
          thrown: true,
          code: checked.code,
          field: (checked.details?.field as string | undefined) ?? undefined,
          instanceId: (checked.details?.instanceId as string | undefined) ?? undefined,
        }
      })()
    : { thrown: false }

  // --- the immutable contextPolicy (rule: immutableAfterCreation) ------------
  const ctxBeforeErr = captureError(() =>
    service.requestCreationFieldMutation({
      teamSessionId: P7T2_TEAM,
      member: alpha(),
      field: 'contextPolicy',
      value: 'ctx-changed',
    }),
  )
  const contextPolicyBeforeRun = ctxBeforeErr.thrown
    ? (() => {
        const checked = assertMutationCode(ctxBeforeErr.error, 'IMMUTABLE_CREATION_FIELD')
        return { thrown: true, code: checked.code, rule: (checked.details?.rule as string | undefined) ?? undefined }
      })()
    : { thrown: false }

  // --- the mutable workspace (before first RUNNING) --------------------------
  const wsBeforeErr = captureError(() =>
    service.requestCreationFieldMutation({
      teamSessionId: P7T2_TEAM,
      member: alpha(),
      field: 'workspace',
      value: 'ws-alpha-2',
    }),
  )
  const workspaceBeforeRun = wsBeforeErr.thrown
    ? (() => {
        const checked = assertMutationCode(wsBeforeErr.error, 'MALFORMED_MUTATION_INPUT')
        return { thrown: true, code: checked.code }
      })()
    : { thrown: false }
  const fieldsAfterWorkspaceChange = store.getCreationFields(P7T2_TEAM, P7T2_ALPHA)
  if (fieldsAfterWorkspaceChange === undefined) throw new Error('p7t2 fixture: fields missing')
  const workspaceLedgerEntry = [...store.listLedger(P7T2_TEAM)]
    .reverse()
    .find((entry) => entry.recordKind === 'creationField' && entry.field === 'workspace' && entry.fieldValue === 'ws-alpha-2')

  // --- first RUNNING (beginStep locks the workspace) --------------------------
  const begin1 = service.beginStep(alpha())
  const beginStep1 = { ok: true, step: begin1.step }
  // An overlapping step (same member, still in flight).
  const begin2 = service.beginStep(alpha())
  const beginStep2 = { ok: true, step: begin2.step }
  const inflightWhileOpen = service.inflightCount()
  const fieldsAfterRun = store.getCreationFields(P7T2_TEAM, P7T2_ALPHA)
  if (fieldsAfterRun === undefined) throw new Error('p7t2 fixture: fields missing')

  // --- after first RUNNING -----------------------------------------------------
  const wsAfterErr = captureError(() =>
    service.requestCreationFieldMutation({
      teamSessionId: P7T2_TEAM,
      member: alpha(),
      field: 'workspace',
      value: 'ws-alpha-3',
    }),
  )
  const workspaceAfterRun = wsAfterErr.thrown
    ? (() => {
        const checked = assertMutationCode(wsAfterErr.error, 'IMMUTABLE_CREATION_FIELD')
        return { thrown: true, code: checked.code, rule: (checked.details?.rule as string | undefined) ?? undefined }
      })()
    : { thrown: false }
  const ctxAfterErr = captureError(() =>
    service.requestCreationFieldMutation({
      teamSessionId: P7T2_TEAM,
      member: alpha(),
      field: 'contextPolicy',
      value: 'ctx-changed',
    }),
  )
  const contextPolicyAfterRun = ctxAfterErr.thrown
    ? (() => {
        const checked = assertMutationCode(ctxAfterErr.error, 'IMMUTABLE_CREATION_FIELD')
        return { thrown: true, code: checked.code, rule: (checked.details?.rule as string | undefined) ?? undefined }
      })()
    : { thrown: false }

  begin1.release()
  begin2.release()
  const inflightAfterRelease = service.inflightCount()

  // --- the unregistered instance (gamma) --------------------------------------
  const gammaMutErr = captureError(() =>
    service.requestCreationFieldMutation({
      teamSessionId: P7T2_TEAM,
      member: gamma(),
      field: 'workspace',
      value: 'ws-gamma',
    }),
  )
  const gammaMutation = gammaMutErr.thrown
    ? (() => {
        const checked = assertMutationCode(gammaMutErr.error, 'UNKNOWN_INSTANCE')
        return { thrown: true, code: checked.code, instanceId: (checked.details?.instanceId as string | undefined) ?? undefined }
      })()
    : { thrown: false }
  const gammaBeginErr = captureError(() => service.beginStep(gamma()))
  const gammaBeginStep = gammaBeginErr.thrown
    ? (() => {
        const checked = assertMutationCode(gammaBeginErr.error, 'UNKNOWN_INSTANCE')
        return { thrown: true, code: checked.code, instanceId: (checked.details?.instanceId as string | undefined) ?? undefined }
      })()
    : { thrown: false }

  // --- malformed field / value -------------------------------------------------
  const malformed: Record<string, { thrown: boolean; code?: string; field?: string }> = {}
  const runCase = (name: string, field: unknown, value: string, expectField: string) => {
    const err = captureError(() =>
      service.requestCreationFieldMutation({ teamSessionId: P7T2_TEAM, member: alpha(), field: field as never, value }),
    )
    if (err.thrown) {
      const checked = assertMutationCode(err.error, 'MALFORMED_MUTATION_INPUT')
      malformed[name] = {
        thrown: true,
        code: checked.code,
        field: (checked.details?.field as string | undefined) ?? undefined,
      }
      expect((checked.details?.field as string | undefined) ?? undefined).toBe(expectField)
    } else {
      malformed[name] = { thrown: false }
    }
  }
  runCase('unknownField', 'model', 'ws-x', 'field')
  runCase('emptyValue', 'workspace', '', 'value')
  runCase('tooLongValue', 'workspace', 'x'.repeat(256), 'value')
  runCase('controlCharValue', 'workspace', 'ws\u0001bad', 'value')

  return {
    fieldsAfterRegister,
    registerLedger,
    duplicateRegister,
    contextPolicyBeforeRun,
    workspaceBeforeRun,
    fieldsAfterWorkspaceChange,
    workspaceLedgerEntry,
    beginStep1,
    beginStep2,
    fieldsAfterRun,
    workspaceAfterRun,
    contextPolicyAfterRun,
    inflightWhileOpen,
    inflightAfterRelease,
    gammaMutation,
    gammaBeginStep,
    malformed,
  }
})()

describe('p7t2 creation fields: registration and provenance', () => {
  it('registration records both fields and starts two ledger entries', () => {
    expect(s1.fieldsAfterRegister.instanceId).toBe(P7T2_ALPHA)
    expect(s1.fieldsAfterRegister.workspace).toBe('ws-alpha')
    expect(s1.fieldsAfterRegister.contextPolicy).toBe('ctx-alpha')
    expect(s1.fieldsAfterRegister.running).toBe(false)
    const entries = s1.registerLedger
    expect(entries.length).toBe(2)
    const workspace = entries.find((entry) => entry.field === 'workspace')
    const context = entries.find((entry) => entry.field === 'contextPolicy')
    if (workspace === undefined || context === undefined) throw new Error('p7t2 fixture: ledger entries missing')
    for (const entry of [workspace, context]) {
      expect(entry.recordKind).toBe('creationField')
      expect(entry.origin).toBe('static')
      expect(entry.instanceId).toBe(P7T2_ALPHA)
      expect(entry.requestedAtStep).toBe(0)
      expect(entry.effectiveFromStep).toBe(1)
    }
    expect(workspace.fieldValue).toBe('ws-alpha')
    expect(context.fieldValue).toBe('ctx-alpha')
  })

  it('duplicate registration is MALFORMED_MUTATION_INPUT (field instance)', () => {
    expect(s1.duplicateRegister.thrown).toBe(true)
    expect(s1.duplicateRegister.code).toBe('MALFORMED_MUTATION_INPUT')
    expect(s1.duplicateRegister.field).toBe('instance')
    expect(s1.duplicateRegister.instanceId).toBe(P7T2_ALPHA)
  })
})

describe('p7t2 creation fields: the mutation boundaries', () => {
  it('contextPolicy is immutable from creation (before and after first RUNNING)', () => {
    expect(s1.contextPolicyBeforeRun.thrown).toBe(true)
    expect(s1.contextPolicyBeforeRun.code).toBe('IMMUTABLE_CREATION_FIELD')
    expect(s1.contextPolicyBeforeRun.rule).toBe('immutableAfterCreation')
    expect(s1.contextPolicyAfterRun.thrown).toBe(true)
    expect(s1.contextPolicyAfterRun.code).toBe('IMMUTABLE_CREATION_FIELD')
    expect(s1.contextPolicyAfterRun.rule).toBe('immutableAfterCreation')
  })

  it('workspace is admitted before first RUNNING (store updated + ledger entry)', () => {
    expect(s1.workspaceBeforeRun.thrown).toBe(false)
    expect(s1.fieldsAfterWorkspaceChange.workspace).toBe('ws-alpha-2')
    expect(s1.fieldsAfterWorkspaceChange.running).toBe(false)
    const entry = s1.workspaceLedgerEntry
    if (entry === undefined) throw new Error('p7t2 fixture: workspace ledger entry missing')
    expect(entry.recordKind).toBe('creationField')
    expect(entry.origin).toBe('static')
    expect(entry.field).toBe('workspace')
    expect(entry.fieldValue).toBe('ws-alpha-2')
    expect(entry.instanceId).toBe(P7T2_ALPHA)
    expect(entry.requestedAtStep).toBe(0)
    expect(entry.effectiveFromStep).toBe(1)
  })

  it('beginStep marks first RUNNING (the workspace lock flips)', () => {
    expect(s1.beginStep1.ok).toBe(true)
    expect(s1.beginStep2.ok).toBe(true)
    expect(s1.fieldsAfterRun.running).toBe(true)
  })

  it('workspace is immutable after first RUNNING', () => {
    expect(s1.workspaceAfterRun.thrown).toBe(true)
    expect(s1.workspaceAfterRun.code).toBe('IMMUTABLE_CREATION_FIELD')
    expect(s1.workspaceAfterRun.rule).toBe('immutableAfterFirstRunning')
    // The admitted value is unchanged by the rejected request.
    expect(s1.fieldsAfterRun.workspace).toBe('ws-alpha-2')
  })

  it('overlapping in-flight steps settle to zero after release', () => {
    expect(s1.inflightWhileOpen).toBe(2)
    expect(s1.inflightAfterRelease).toBe(0)
  })
})

describe('p7t2 creation fields: unregistered instances and malformed input', () => {
  it('an unregistered instance is UNKNOWN_INSTANCE (mutation and beginStep)', () => {
    expect(s1.gammaMutation.thrown).toBe(true)
    expect(s1.gammaMutation.code).toBe('UNKNOWN_INSTANCE')
    expect(s1.gammaMutation.instanceId).toBe(P7T2_GAMMA)
    expect(s1.gammaBeginStep.thrown).toBe(true)
    expect(s1.gammaBeginStep.code).toBe('UNKNOWN_INSTANCE')
    expect(s1.gammaBeginStep.instanceId).toBe(P7T2_GAMMA)
  })

  it('malformed field/value inputs are MALFORMED_MUTATION_INPUT', () => {
    const cases: Array<[string, string]> = [
      ['unknownField', 'field'],
      ['emptyValue', 'value'],
      ['tooLongValue', 'value'],
      ['controlCharValue', 'value'],
    ]
    for (const [name, field] of cases) {
      const result = s1.malformed[name]
      if (result === undefined) throw new Error(`p7t2 snapshot: missing case '${name}'`)
      expect(result.thrown).toBe(true)
      expect(result.code).toBe('MALFORMED_MUTATION_INPUT')
      expect(result.field).toBe(field)
    }
  })
})
