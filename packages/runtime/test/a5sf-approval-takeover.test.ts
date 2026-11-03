/**
 * a5sf-approval-takeover — Alpha.5 Sandbox-First, work package R1 (BL-09).
 *
 * THE LAW UNDER TEST. The new execution lane's I/O permission is computed by
 * exactly ONE function (`compileEffectiveIo`, P1-02). An Alpha.4 approval does
 * NOT compute a second permission: it is an INPUT that can only select ONE
 * `ask` locator out of the compiled intersection for ONE call. Therefore:
 *
 *   - approval cannot widen: a resource the compiled `EffectiveIo` denies stays
 *     denied, whatever an approval (or the approval authority) says;
 *   - approval can narrow: an authored `ask` locator becomes `allow` for the
 *     asked call only; every other `ask` locator still asks and every
 *     non-allow locator still denies;
 *   - one-shot is owned by the REAL Alpha.4 control plane: the adapter consumes
 *     the durable allow through `ControlService.guardOperation`; a replay is
 *     refused with a typed code (and the durable consumption row count stays
 *     one);
 *   - a stale generation / stale policy revision is refused with the existing
 *     `MEMBER_POLICY_STALE` / `STALE_POLICY_REVISION` semantics;
 *   - exactly one permission computation: the adapter consumes the compiled
 *     `MemberPolicy` object and the existing `ControlGuardVerdict` /
 *     `ControlOperationScope` types, and its output is exactly the compiler
 *     output plus one `ask → allow` move. Source fences fail if a second
 *     compiler is ever imported into the adapter.
 *
 * The integration leg runs a REAL `ControlService` over the in-process durable
 * P6-T4 world (the same unit world the Alpha.4 control suites use). It is NOT a
 * Host boot and NOT the P2 Control→Binder round-trip; that still needs the real
 * Host pipeline and is deliberately out of scope here.
 *
 * RED-first: this file fails before
 * `packages/runtime/member-io-policy/src/approval-takeover.ts` exists.
 *
 * @module test/a5sf-approval-takeover
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseBlueprintV4, type TeamBlueprintV4, type V4ToolBindingAuthoring } from '../../domain/blueprint/src/index.js'
import {
  compileEffectiveIo,
  compileMemberPolicy,
  projectToolIoRestriction,
} from '../member-io-policy/src/compile.js'
import { matchLocator } from '../member-io-policy/src/path-rules.js'
import {
  APPROVAL_TAKEOVER_REFUSAL_CODES,
  resolveAskClassCall,
  type AskApprovalAuthority,
  type ResolveAskClassCallInput,
} from '../member-io-policy/src/approval-takeover.js'
import { APPROVAL_TAKEOVER_REFUSAL_CODE_VALUES } from '../member-io-policy/src/index.js'
import type {
  InvocationAuthority,
  MemberPolicy,
  ToolIoRestriction,
} from '../member-io-policy/src/types.js'
import { CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KINDS } from '../control/index.js'
import type { ControlGuardVerdict, ControlOperationScope } from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  constantAuthorityRecheck,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'

// --- fixtures ----------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url))
const ADAPTER_SOURCE = join(HERE, '../member-io-policy/src/approval-takeover.ts')

const TEAM = 'team.a5sf.r1'
const MEMBER = 'mi-alpha-r1'
const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

function rw(
  mode: 'all' | 'restricted',
  opts: { allow?: string[]; ask?: string[]; deny?: string[] } = {},
): Record<string, unknown> {
  if (mode === 'all') return { mode: 'all', deny: opts.deny ?? [] }
  return { mode: 'restricted', allow: opts.allow ?? [], ask: opts.ask ?? [], deny: opts.deny ?? [] }
}

function net(mode: 'allow' | 'deny'): Record<string, unknown> {
  return { mode, default: mode === 'deny' ? 'deny' : 'allow' }
}

function binding(owner: string, name: string, io: Record<string, unknown>): Record<string, unknown> {
  return {
    owner,
    name,
    authorization: 'ask',
    io,
    execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
  }
}

const BLUEPRINT = {
  schemaVersion: 4,
  blueprintId: TEAM,
  revision: '1',
  leader: { templateId: 'leader', persona: 'Lead.' },
  members: [{ templateId: 'alpha', persona: 'Alpha member.' }],
  requirements: [],
  memberEnvelopes: [],
  policyStates: [],
  permissionMutationEnvelope: { rules: [] },
  teamHardEnvelope: { rules: [] },
  metadata: {},
  memberIoCeilings: [
    {
      templateId: 'alpha',
      io: {
        read: rw('restricted', {
          allow: ['/work/a'],
          ask: ['/work/a/p1.txt', '/work/a/p2.txt'],
          deny: ['/work/a/secret'],
        }),
        write: rw('restricted', { allow: ['/work/b'] }),
        network: net('deny'),
      },
    },
  ],
  toolBindings: [
    binding('dsh.fs', 'read', { read: rw('all'), write: rw('all'), network: net('deny') }),
  ],
}

function blueprint(): TeamBlueprintV4 {
  return parseBlueprintV4(`---\n${JSON.stringify(BLUEPRINT, null, 2)}\n---\n`)
}

function compiledPolicy(memberInstanceId = MEMBER): MemberPolicy {
  const result = compileMemberPolicy({
    trustedMember: {
      teamId: TEAM,
      memberInstanceId,
      templateId: 'alpha',
      instanceGeneration: 3,
    },
    boundBlueprint: { teamId: TEAM, blueprint: blueprint() },
    effectiveAuthority: {
      revision: 'a4:r1',
      memberInstanceId,
      instanceGeneration: 3,
      admitted: true,
    },
  })
  if (!result.ok) throw new Error(`fixture policy refused: ${result.code} ${result.detail}`)
  return result.value
}

function toolRestriction(): ToolIoRestriction {
  const entry = blueprint().toolBindings?.[0] as V4ToolBindingAuthoring
  const result = projectToolIoRestriction(entry)
  if (!result.ok) throw new Error(`fixture tool refused: ${result.code} ${result.detail}`)
  return result.value
}

function invocationFor(
  member: MemberPolicy,
  tool: ToolIoRestriction,
  overrides: Partial<InvocationAuthority> = {},
): InvocationAuthority {
  return {
    memberIdentity: member.memberIdentity,
    callId: 'call-r1',
    policyRevision: member.revision,
    toolBindingIdentity: tool.bindingIdentity,
    approvedOnce: false,
    ...overrides,
  }
}

function scope(
  memberInstanceId = MEMBER,
  overrides: Partial<ControlOperationScope> = {},
): ControlOperationScope {
  return {
    rootSessionId: 'root-a5sf-r1',
    targetInstanceId: memberInstanceId,
    actionName: 'team.action.execute',
    toolName: 'read',
    correlation: 'corr-a5sf-r1-1',
    ...overrides,
  }
}

/** A fake authority that records its calls and always allows (test double). */
function allowingAuthority(): {
  readonly calls: ControlOperationScope[]
  readonly authority: AskApprovalAuthority
} {
  const calls: ControlOperationScope[] = []
  return {
    calls,
    authority: async (received): Promise<ControlGuardVerdict> => {
      calls.push(received)
      return { allowed: true, requestId: 'req-r1', decisionSequence: 1 }
    },
  }
}

function refusal(
  result: { ok: true } | { ok: false; code: string },
  code: string,
): void {
  if (result.ok) throw new Error(`expected refusal ${code}, got an accepted policy`)
  expect(result.code).toBe(code)
}

const ROOT = 'root-a5sf-r1'

/** Every leg names the TeamSession root unless the leg is testing its absence. */
function resolve(
  input: Omit<ResolveAskClassCallInput, 'expectedRootSessionId'> & {
    readonly expectedRootSessionId?: string | undefined
  },
): ReturnType<typeof resolveAskClassCall> {
  return resolveAskClassCall({ expectedRootSessionId: ROOT, ...input })
}

// --- R1 RED laws: approval can only narrow -----------------------------------

describe('R1 · approval can only narrow the compiled intersection', () => {
  it('approval cannot widen: an explicit deny stays denied even when the authority allows', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/secret' },
      scope: scope(),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_CANNOT_WIDEN)
    // The denial is decided by the compiled ceiling, not by the approval: the
    // existing authority is never even consulted.
    expect(calls).toHaveLength(0)
  })

  it('approval cannot widen: a locator outside every allow subtree stays denied', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/outside/file.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_CANNOT_WIDEN)
    expect(calls).toHaveLength(0)
  })

  it('approval narrows EXACTLY the asked ask-locator to allow for one call', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const invocation = invocationFor(member, tool, { callId: 'call-r1-narrow' })
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation,
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const read = result.value.read
    expect(read.allow).toEqual(['/work/a', '/work/a/p1.txt'])
    expect(read.ask).toEqual(['/work/a/p2.txt'])
    expect(read.deny).toEqual(['/work/a/secret'])
    expect(matchLocator(read, '/work/a/p1.txt')).toBe('allow')
    // The compiler's provenance survives the one-call narrowing verbatim.
    expect(result.value.policyRevision).toBe(member.revision)
    expect(result.value.invocationId).toBe('call-r1-narrow')
    expect(result.value.memberIdentity).toBe(member.memberIdentity)
    expect(result.value.toolBindingIdentity).toBe(tool.bindingIdentity)
    expect(calls).toHaveLength(1)
  })

  it('a different ask locator in the same compiled policy still asks, and other locators still deny', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // A second approval is needed for p2; an approval for p1 never covers it.
    expect(matchLocator(result.value.read, '/work/a/p2.txt')).toBe('ask')
    expect(matchLocator(result.value.read, '/work/a/secret')).toBe('deny')
    expect(matchLocator(result.value.read, '/work/outside/never-declared')).toBe('deny')
    // The write axis is untouched by a read-axis approval.
    expect(result.value.write).toEqual({
      mode: 'restricted',
      allow: ['/work/b'],
      ask: [],
      deny: [],
    })
  })

  it('a locator the compiler already allows is refused as NOT_ASKED (no approval path)', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    // `/work/a/plain.txt` is covered by the authored allow `/work/a` and is not
    // an ask locator: the approval path must not touch it.
    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/plain.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_NOT_ASKED)
    expect(calls).toHaveLength(0)
  })

  it('an axis outside read/write is refused before any lane is consulted', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'network' as unknown as 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND)
    expect(calls).toHaveLength(0)
  })

  it('a non-authored resource under an ask subtree is refused instead of widening the subtree', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    // `matchLocator` reports `ask` for a child of the authored ask file, but the
    // approval may only name the authored locator itself. Turning the whole ask
    // subtree into allow would be a widening, so the adapter refuses. This is a
    // named limit, disclosed in the R1 evidence README.
    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt/child' },
      scope: scope(),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND)
    expect(calls).toHaveLength(0)
  })
})

// --- R1 RED laws: one-shot, stale generation, exact scope --------------------

describe('R1 · one-shot approval and stale generations', () => {
  it('a one-shot approval is refused on the second consumption with a typed code', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    let consumed = false
    const calls: ControlOperationScope[] = []
    const oneShot: AskApprovalAuthority = async (received): Promise<ControlGuardVerdict> => {
      calls.push(received)
      if (consumed) {
        return {
          allowed: false,
          reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED,
          requestId: 'req-r1',
          decisionSequence: 1,
        }
      }
      consumed = true
      return { allowed: true, requestId: 'req-r1', decisionSequence: 1 }
    }
    const input = {
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read' as const, locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: oneShot,
    }

    expect((await resolve(input)).ok).toBe(true)
    refusal(await resolve(input), APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_ALREADY_CONSUMED)
    expect(calls).toHaveLength(2)
  })

  it('a stale member generation is refused with the existing MEMBER_POLICY_STALE semantics', async () => {
    const member = compiledPolicy() // compiled for generation 3
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 4, // the instance has moved on
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.MEMBER_POLICY_STALE)
    expect(calls).toHaveLength(0)
  })

  it('a grant minted under an older policy revision is refused by the single compiler', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool, { policyRevision: 'a5sf1:stale-revision' }),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    // STALE_POLICY_REVISION comes from `compileEffectiveIo` — the adapter has
    // no revision logic of its own.
    refusal(result, 'STALE_POLICY_REVISION')
    expect(calls).toHaveLength(0)
  })

  it('the approval scope must name the same member and the same tool', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    refusal(
      await resolve({
        memberPolicy: member,
        tool,
        invocation: invocationFor(member, tool),
        currentInstanceGeneration: 3,
        ask: { axis: 'read', locator: '/work/a/p1.txt' },
        scope: scope('mi-other-r1'),
        approvalAuthority: authority,
      }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_MISMATCH,
    )
    refusal(
      await resolve({
        memberPolicy: member,
        tool,
        invocation: invocationFor(member, tool),
        currentInstanceGeneration: 3,
        ask: { axis: 'read', locator: '/work/a/p1.txt' },
        scope: scope(MEMBER, { toolName: 'bash' }),
        approvalAuthority: authority,
      }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_MISMATCH,
    )
    expect(calls).toHaveLength(0)
  })

  it('an exact-scope approval is bound to the asked resource fingerprint', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()
    const exactScope = scope(MEMBER, { operationFingerprint: 'sha256:p1-binding' })

    // A fingerprint-less ask cannot be bound to an exact-scope approval.
    refusal(
      await resolve({
        memberPolicy: member,
        tool,
        invocation: invocationFor(member, tool),
        currentInstanceGeneration: 3,
        ask: { axis: 'read', locator: '/work/a/p1.txt' },
        scope: exactScope,
        approvalAuthority: authority,
      }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND,
    )
    // A different resource fingerprint is a different approval.
    refusal(
      await resolve({
        memberPolicy: member,
        tool,
        invocation: invocationFor(member, tool),
        currentInstanceGeneration: 3,
        ask: { axis: 'read', locator: '/work/a/p1.txt', operationFingerprint: 'sha256:p2-binding' },
        scope: exactScope,
        approvalAuthority: authority,
      }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_MISMATCH,
    )
    expect(calls).toHaveLength(0)

    const matched = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt', operationFingerprint: 'sha256:p1-binding' },
      scope: exactScope,
      approvalAuthority: authority,
    })
    expect(matched.ok).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('binds the durable allow to the compiled policy TeamSession root, not just the instance id', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()
    const base = {
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read' as const, locator: '/work/a/p1.txt' },
      approvalAuthority: authority,
    }

    // Same TeamSession root: accepted.
    const accepted = await resolve({ ...base, scope: scope(MEMBER, { rootSessionId: ROOT }) })
    expect(accepted.ok).toBe(true)

    // A durable allow minted for another team with the SAME instance id is not
    // transferable: instance ids are unique only within a team.
    refusal(
      await resolve({ ...base, scope: scope(MEMBER, { rootSessionId: 'root-team-b' }) }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND,
    )
    // A missing expected root cannot bind the approval at all.
    refusal(
      await resolve({ ...base, scope: scope(), expectedRootSessionId: undefined }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND,
    )
    // A blank scope root is never a wildcard.
    refusal(
      await resolve({ ...base, scope: scope(MEMBER, { rootSessionId: '   ' }) }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND,
    )
    expect(calls).toHaveLength(1)
  })

  it('requires a non-empty tool name on the approval scope', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(MEMBER, { toolName: undefined }),
      approvalAuthority: authority,
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND)
    expect(calls).toHaveLength(0)
  })

  it('requires a non-blank correlation and action name on the approval scope', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()
    const base = {
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read' as const, locator: '/work/a/p1.txt' },
      approvalAuthority: authority,
    }

    refusal(
      await resolve({ ...base, scope: scope(MEMBER, { correlation: '' }) }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND,
    )
    refusal(
      await resolve({ ...base, scope: scope(MEMBER, { actionName: '  ' }) }),
      APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_SCOPE_UNBOUND,
    )
    expect(calls).toHaveLength(0)
  })

  it('a malformed verdict shape fails closed as AUTHORITY_FAILED', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const base = {
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read' as const, locator: '/work/a/p1.txt' },
      scope: scope(),
    }

    for (const malformed of [null, { allowed: 'yes' }, {}]) {
      const result = await resolve({
        ...base,
        approvalAuthority: async () => malformed as unknown as ControlGuardVerdict,
      })
      refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_AUTHORITY_FAILED)
    }
  })

  it('a denied / pending / absent durable verdict is refused, never treated as an allowance', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const verdicts: ControlGuardVerdict[] = [
      { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY, requestId: 'req-r1', decisionSequence: 1 },
      { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING, requestId: 'req-r1' },
      // `no-request` is the leader-autonomy polarity in the tool guard, but an
      // ASK is never autonomous: no durable request means no approval.
      { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST },
    ]
    for (const verdict of verdicts) {
      const result = await resolve({
        memberPolicy: member,
        tool,
        invocation: invocationFor(member, tool),
        currentInstanceGeneration: 3,
        ask: { axis: 'read', locator: '/work/a/p1.txt' },
        scope: scope(),
        approvalAuthority: async () => verdict,
      })
      refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_DENIED)
    }
  })

  it('a throwing approval authority fails closed with a typed refusal', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: async () => {
        throw new Error('control plane unavailable')
      },
    })

    refusal(result, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_AUTHORITY_FAILED)
  })

  it('forwards the EXACT existing scope object to the existing guard (no re-derivation)', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const { calls, authority } = allowingAuthority()
    const exactScope = scope()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation: invocationFor(member, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: exactScope,
      approvalAuthority: authority,
    })

    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(exactScope)
  })
})

// --- R1 RED laws: exactly one permission computation -------------------------

describe('R1 · exactly one permission computation', () => {
  it('the narrowed policy is the compiler output plus one ask→allow move (nothing else)', async () => {
    const member = compiledPolicy()
    const tool = toolRestriction()
    const invocation = invocationFor(member, tool)
    const compiled = compileEffectiveIo(member, tool, invocation)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const { authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: member,
      tool,
      invocation,
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/work/a/p1.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const expectedRead = {
      mode: compiled.value.read.mode,
      allow: [...compiled.value.read.allow, '/work/a/p1.txt'],
      ask: compiled.value.read.ask.filter((locator) => locator !== '/work/a/p1.txt'),
      deny: [...compiled.value.read.deny],
    }
    expect(result.value.read).toEqual(expectedRead)
    expect(result.value.write).toEqual(compiled.value.write)
    expect(result.value.network).toEqual(compiled.value.network)
    expect(result.value.policyRevision).toBe(compiled.value.policyRevision)
    expect(result.value.invocationId).toBe(compiled.value.invocationId)
  })

  it('honours the compiled policy object verbatim (a fabricated ask lane still resolves)', async () => {
    const base = compiledPolicy()
    // A literal ask locator that exists ONLY in the policy object, not in the
    // blueprint. A second compiler re-reading the blueprint could never produce
    // this lane; the adapter must consume the object it is given.
    const fabricated: MemberPolicy = Object.freeze({
      ...base,
      read: Object.freeze({
        ...base.read,
        ask: Object.freeze(['/poison/only-in-policy.txt']),
      }),
    })
    const tool = toolRestriction()
    const { authority } = allowingAuthority()

    const result = await resolve({
      memberPolicy: fabricated,
      tool,
      invocation: invocationFor(fabricated, tool),
      currentInstanceGeneration: 3,
      ask: { axis: 'read', locator: '/poison/only-in-policy.txt' },
      scope: scope(),
      approvalAuthority: authority,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.read.allow).toContain('/poison/only-in-policy.txt')
    expect(result.value.policyRevision).toBe(fabricated.revision)
  })

  it('the adapter source imports the ONE compiler and the EXISTING control decision types', () => {
    const source = readFileSync(ADAPTER_SOURCE, 'utf8')
    // The one permission computation.
    expect(source).toContain('compileEffectiveIo')
    // A second compiler would need one of these; none may enter the adapter.
    expect(source).not.toContain('compileMemberPolicy')
    expect(source).not.toContain('projectV4MemberIoCeiling')
    expect(source).not.toContain('declareV4AuthoringMaps')
    expect(source).not.toContain('findMemberIoCeiling')
    // The approval decision is the EXISTING public control-plane shape.
    expect(source).toContain("from '../../control/index.js'")
    expect(source).not.toContain("from '../../control/types.js'")
    expect(source).toContain('ControlGuardVerdict')
    expect(source).toContain('ControlOperationScope')
    // The barrel exports the complete closed refusal vocabulary.
    expect(APPROVAL_TAKEOVER_REFUSAL_CODE_VALUES).toEqual(
      Object.values(APPROVAL_TAKEOVER_REFUSAL_CODES),
    )
    // And it must not own a second approval store: no ledger/grant table here.
    expect(source).not.toContain('GrantLedger')
    expect(source).not.toContain('new Map')
  })
})

// --- R1 integration: the REAL Alpha.4 control plane owns the one-shot --------

describe('R1 · the real ControlService owns the one-shot approval', () => {
  it('consumes the durable allow once; the adapter replay is refused and one consumption row exists', async () => {
    const world = await createP6T4World('a5sf-r1-approval-oneshot', ['leader', 'worker'])
    try {
      const service = createP6T4Service(world, {
        authorityRevalidation: constantAuthorityRecheck().port,
      })
      const exactScope = makeScope({
        targetInstanceId: WORKER_ID,
        actionName: 'team.action.execute',
        toolName: 'read',
        correlation: 'corr-a5sf-r1-oneshot',
        operationFingerprint: 'sha256:r1-oneshot-p1',
      })
      const request = await service.requestControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        targetInstanceId: WORKER_ID,
        actionName: exactScope.actionName,
        toolName: exactScope.toolName,
        correlation: exactScope.correlation,
        operationFingerprint: exactScope.operationFingerprint,
      })
      await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: request.requestId,
        decision: 'allow',
      })

      const member = compiledPolicy(WORKER_ID)
      const tool = toolRestriction()
      const input = {
        memberPolicy: member,
        tool,
        invocation: invocationFor(member, tool, { callId: 'call-r1-real-oneshot' }),
        currentInstanceGeneration: 3,
        expectedRootSessionId: P6T4_ROOT,
        ask: {
          axis: 'read' as const,
          locator: '/work/a/p1.txt',
          operationFingerprint: 'sha256:r1-oneshot-p1',
        },
        scope: exactScope,
        // The adapter consumes the EXISTING public last-mile guard, which owns
        // the durable allow and its check-and-reserve consumption.
        approvalAuthority: (received: ControlOperationScope) => service.guardOperation(received),
      }

      const first = await resolve(input)
      expect(first.ok).toBe(true)
      if (first.ok) expect(matchLocator(first.value.read, '/work/a/p1.txt')).toBe('allow')

      const replay = await resolve(input)
      refusal(replay, APPROVAL_TAKEOVER_REFUSAL_CODES.APPROVAL_ALREADY_CONSUMED)

      const state = await service.listControlState(P6T4_ROOT)
      expect(state.consumptions).toHaveLength(1)
      expect(state.decisions.filter((row) => row.decision === 'allow')).toHaveLength(1)
    } finally {
      await destroyP6T1World(world)
    }
  })
})
