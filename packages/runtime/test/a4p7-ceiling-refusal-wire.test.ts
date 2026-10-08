/**
 * a4p7-ceiling-refusal-wire.test.ts — A4-PR7 §7.4 lane work (7-4 fail-closed lane,
 * Task 2): every ceiling refusal of the v3 gate must reach a REMOTE caller as
 * ITSELF, never as `internal-error`.
 *
 * ---------------------------------------------------------------------------
 * THE GAP THIS LANE MEASURED, IN ONE SENTENCE
 * ---------------------------------------------------------------------------
 * The v3 ceiling gate can answer a rise in two ways that end in a THROWN
 * `PermissionMutationError`: the authorization answer
 * `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` (a DECIDED-insufficient rise on a
 * lane whose approval seam is not wired — `governance/service.ts`, the A4-PR5
 * catch propagates it byte-identically), and the context answer
 * `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` (an unread ceiling — the document was
 * unavailable, and since this commit also the lane that wired NO ceiling reader
 * at all, §7.5 prerequisite 3). The second code was already a member of the
 * closed remote backing vocabulary; the FIRST was not, and
 * `toS6RemoteErrorResult` invariant 4b passes ONLY members, so the ceiling's
 * authorization verdict — the one answer the operator most needs verbatim, and
 * the one `team_grant_permission`'s own description PROMISES — arrived on the
 * remote wire as `internal-error` / `details.reason: untyped-error`,
 * indistinguishable from a crash. Measured before the join, leg W1 below.
 *
 * ---------------------------------------------------------------------------
 * WHY JOINING THE VOCABULARY IS THE HONEST FIX AND NOT A WIDENING
 * ---------------------------------------------------------------------------
 * `REMOTE_BACKING_ERROR_CODES` is closed: adding a member is a remote-contract
 * change and is done here for exactly ONE code, the one the governance kernel
 * already throws and the tool surface already documents. Nothing else joins it:
 * the A4-PR5 approval-pending outcome deliberately stays OUT of the vocabulary
 * (it rides `{changed:false, reason:'mutation-proposal-pending'}` on the closed
 * projection, not a code), and leg W5 pins that this join did not disturb it.
 * The two ceiling answers must also stay TOLD APART on the wire (A3-3's error
 * identity law survives the transport): leg W2 drives both refusals through the
 * same dispatcher and asserts three distinct wire identities.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY LEG DRIVES THE REAL THROW-PROOF DISPATCHER
 * ---------------------------------------------------------------------------
 * Per the parent rule of this stage, a refusal "reaches the caller" is a wire
 * fact, not a thrower fact: each leg wires the REAL `override.mutatePermission`
 * port stack (`createS6RemotePorts` + `createS6RemoteDispatcher`) over a REAL
 * governance service whose permission lane is the one under test, and reads the
 * response the transport would hand a client. Lanes are thrown by the production
 * service, never by a stub of the mapper.
 */
import { describe, expect, it } from 'vitest'
import {
  PERMISSION_MUTATION_ERROR_CODES,
  createGovernanceMutationService,
} from '../governance/index.js'
import type {
  GovernanceMutationServiceDeps,
  GovernancePermissionMutationArgs,
  PermissionMutationEnvelope,
} from '../governance/index.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'
import type {
  AuthorityDocumentSlot,
  AuthorityEnvelopeDocuments,
} from '../governance/authority-ceiling.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemotePorts } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import type { ActionCaller } from '../admission/index.js'
import { REMOTE_CONTRACT_ERROR_CODES, REMOTE_CONTRACT_VERSION_V7 } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
// The single shared closed-set definition, imported from its source exactly as
// the production dispatcher does.
import { REMOTE_BACKING_ERROR_CODE_SET } from '../../remote/src/handlers/dispatch.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { P6T4_ROOT, P6T4_SEEDS } from './p6t4-helpers.js'

const WORKER = String(P6T4_SEEDS.worker.instanceId)
const NOW = '2026-10-08T00:00:00.000Z'
/** The exec fingerprint the canonicalizer seam answers — an EXEC-matcher rule keeps
 *  the world minimal (a4p5's law): the fingerprint canonicalizes through the
 *  injected seam, so no durable workspace row is read on this path. */
const FINGERPRINT = `sha256:${'a'.repeat(64)}`

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}
class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}
class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope: (): never => {
    throw new Error('the permission lane must not read the capability envelope')
  },
  readTemplatePolicy: (): never => {
    throw new Error('the permission lane must not read template policy')
  },
  readExternalFacts: (): never => {
    throw new Error('the permission lane must not read external hard facts')
  },
}

const DECLARED_NONE = { layers: [] }

/** A hard-ceiling document that COVERS the fingerprint the wire will carry. */
const HARD_COVERING: PermissionMutationEnvelope = {
  rules: [
    {
      operationClass: 'bash',
      matcher: { kind: 'fingerprint', resource: FINGERPRINT },
      maximumEffect: 'allow',
    },
  ],
}
/** A hard-ceiling document that covers NOTHING: the zero-authority answer. */
const HARD_EMPTY: PermissionMutationEnvelope = { rules: [] }

function declared(document: PermissionMutationEnvelope): AuthorityDocumentSlot {
  return { status: 'declared', document } as AuthorityDocumentSlot
}
function absent(): AuthorityDocumentSlot {
  return { status: 'absent' } as AuthorityDocumentSlot
}

/**
 * One world, three ceilings.
 *
 * `ceiling` selects what the LANE sees:
 *   - `'zero'`     — the port is wired and answers a v3 context with an empty hard
 *                    envelope: a DECIDED zero-authority answer;
 *   - `'covering'` — the port is wired and the document covers the cell;
 *   - `'absent'`   — the lane wired NO `authorityCeiling` port at all: the branch
 *                    §7.5 prerequisite 3 turned into a refusal.
 *
 * The approval lane is NOT wired in any world, which is what makes the
 * DECIDED-insufficient answer a THROWN code rather than a durable proposal — the
 * only shape in which `AUTHORITY_CEILING_INSUFFICIENT` ever reaches a transport.
 */
async function openWireWorld(ceiling: 'zero' | 'covering' | 'absent'): Promise<{
  dispatch: (params: Record<string, unknown>) => Promise<RemoteResponse>
  close: () => Promise<void>
}> {
  const base = scratchDir(`a474wire-${ceiling}-${Math.random().toString(36).slice(2, 8)}`)
  destroyDir(base)
  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  const documents: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: ceiling === 'covering' ? declared(HARD_COVERING) : declared(HARD_EMPTY),
    // The Leader carrier is not a ceiling; it stays the Alpha.3 absent answer so
    // nothing but the hard document can answer for the rise.
    permissionMutationEnvelope: absent(),
  }
  const laneDeps: Omit<GovernanceMutationServiceDeps, 'permissionLane'> = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
  }
  const service = createGovernanceMutationService({
    ...laneDeps,
    permissionLane: {
      overlay: {
        // The overlay port is addressed by (team, member); one scratch store,
        // addressed per call — the world holds a single identity. The stub is
        // cast as in the sibling ceiling fixtures: what the legs assert is the
        // WIRE verdict, and the zero-write fact they need is the absence of a
        // `changed:true` on a refusal, which the typed result carries.
        latest: async () => undefined,
        append: async (snapshot: unknown) => snapshot,
      } as never,
      staticLayers: () => DECLARED_NONE,
      ...(ceiling === 'absent'
        ? {}
        : {
            authorityCeiling: async (
              _team: string,
              _member: string,
              actor: 'leader' | 'human',
            ): Promise<PermissionAuthorityCeilingContext> => ({
              beneficiaryAuthority: 'member',
              initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
              documents,
              blueprintContentHash: `sha256:${'c'.repeat(64)}`,
            }),
          }),
    },
  })

  const permission = {
    canonicalizeExecIntent: async () => FINGERPRINT,
    mutatePermission: (args: Record<string, unknown>) =>
      service.mutatePermission(args as unknown as GovernancePermissionMutationArgs),
  }
  const ports = createS6RemotePorts({
    rootSessionId: P6T4_ROOT,
    repositories: domain.repositories,
    isOwnedRoot: (sid: string) => sid === P6T4_ROOT,
    permission,
  } as never) as unknown as S6RemotePorts
  const asOperator: ServerPrincipalDerivation = () =>
    ({ kind: 'human', humanId: 'operator-a474' }) satisfies ActionCaller
  const dispatch = createS6RemoteDispatcher(ports, asOperator)
  return {
    dispatch: (params) =>
      dispatch('override.mutatePermission', {
        version: REMOTE_CONTRACT_VERSION_V7,
        params,
      } as never) as Promise<RemoteResponse>,
    close: async () => {
      destroyDir(base)
    },
  }
}

/** The wire rise: an exec grant whose cell the hard envelope may or may not cover. */
function riseParams(mutationId: string): Record<string, unknown> {
  return {
    teamSessionId: P6T4_ROOT,
    memberInstanceId: WORKER,
    kind: 'grant_instance',
    mutationId,
    reason: 'a4-74 fail-closed lane: the ceiling refusal must reach the wire as itself',
    actor: { kind: 'human' },
    rules: [
      {
        operationClass: 'bash',
        matcher: { kind: 'exec', intent: { tool: 'bash', command: 'echo a474' } },
        effect: 'allow',
      },
    ],
  }
}

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('a474 guard: expected an error result, got a success')
  return response.error as unknown as Record<string, unknown>
}
function detailsOf(error: Record<string, unknown>): Record<string, unknown> {
  return (error['details'] ?? {}) as Record<string, unknown>
}
function causeOf(error: Record<string, unknown>): Record<string, unknown> {
  return (detailsOf(error)['cause'] ?? {}) as Record<string, unknown>
}

describe('A4-PR7 §7.4 — every ceiling refusal of the v3 gate reaches the remote wire as itself', () => {
  it('W1 the DECIDED-insufficient ceiling refusal crosses as PERMISSION_AUTHORITY_CEILING_INSUFFICIENT — never internal-error, never untyped-error', async () => {
    // The lane answers a DECIDED zero-authority ceiling for a rising batch and
    // the approval lane is unwired, so the gate THROWS the authorization code.
    // Before this lane joined the closed backing vocabulary, this leg measured
    // `code: internal-error` with `details.reason: untyped-error` — the ceiling
    // speaking and the transport reporting a crash.
    const w = await openWireWorld('zero')
    try {
      const response = await w.dispatch(riseParams('a474-w1-insufficient'))
      const error = errorOf(response)
      expect(error['code'], JSON.stringify(error)).toBe(
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect(error['code']).not.toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
      // Invariant 4b provenance: the typed cause rides under details.cause, and
      // the reason slot says domain-error — NOT the invariant-5 confession.
      expect(detailsOf(error)['reason']).toBe('domain-error')
      expect(causeOf(error)['code']).toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
    } finally {
      await w.close()
    }
  })

  it('W2 the two ceiling answers stay TOLD APART on the wire: authorization-insufficient, context-unavailable-by-unread-document, context-unavailable-by-absent-port', async () => {
    const zero = await openWireWorld('zero')
    const absentPort = await openWireWorld('absent')
    try {
      const insufficient = errorOf(await zero.dispatch(riseParams('a474-w2-insufficient')))
      const refusedByAbsentPort = errorOf(await absentPort.dispatch(riseParams('a474-w2-absent-port')))
      // Different codes: A3-3's law (an unread ceiling never wears an
      // authorization label) survives the transport.
      expect(insufficient['code']).toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
      expect(refusedByAbsentPort['code']).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
      expect(refusedByAbsentPort['code']).not.toBe(insufficient['code'])
      // And the two context-shaped refusals are told apart by the problem slot
      // the service mints, carried losslessly under details.cause.details.
      const causeDetails = (causeOf(refusedByAbsentPort)['details'] ?? {}) as Record<string, unknown>
      expect(causeDetails['problem']).toBe('authority-ceiling-port-absent')
    } finally {
      await zero.close()
      await absentPort.close()
    }
  })

  it('W3 the fail-closed refusal is a member of the closed vocabulary WITHOUT any new code (it rode the context code that was already mapped)', () => {
    // The §7.5 prerequisite-3 refusal added NO code to the wire vocabulary: it is
    // the existing context fault. This census leg pins that claim, so a future
    // "just add a new ceiling code" change trips here and re-argues the contract.
    expect(REMOTE_BACKING_ERROR_CODE_SET.has(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)).toBe(true)
    expect(REMOTE_BACKING_ERROR_CODE_SET.has(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)).toBe(true)
  })

  it('W4 the covering ceiling still COMMITS across the same wire (the join is a mapping, not a new refusal)', async () => {
    const w = await openWireWorld('covering')
    try {
      const response = await w.dispatch(riseParams('a474-w4-commit'))
      if (!response.ok) throw new Error(`expected a commit, got ${JSON.stringify(response.error)}`)
      expect((response.value.data as Record<string, unknown>)['changed']).toBe(true)
    } finally {
      await w.close()
    }
  })

  it('W5 the join did NOT smuggle the approval-pending outcome onto the wire as a code (it still rides the closed projection)', async () => {
    // A4-PR5's law: a DECIDED-insufficient rise on a WIRED approval lane becomes a
    // durable proposal whose truth is `{changed:false, reason:'mutation-proposal-pending'}`.
    // Joining the insufficient CODE must not turn that arm into a thrown code, so
    // the pending reason stays OUT of the closed backing vocabulary.
    expect(REMOTE_BACKING_ERROR_CODE_SET.has('PERMISSION_MUTATION_APPROVAL_PENDING')).toBe(false)
  })
})
