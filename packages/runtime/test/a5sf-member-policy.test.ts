/**
 * a5sf-member-policy — Alpha.5 P1-02 (Gate G1.2).
 *
 * The two-axis compiler test: `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`.
 * Every law here is a FAIL-CLOSED law, and every widening attempt is a RED
 * case: A/B crossing, tool `allow all` over a ceiling, write implying read,
 * an undeclared ceiling, a destination-restricted network lane, a stale
 * generation/revision and a one-shot approval trying to become policy.
 *
 * @module test/a5sf-member-policy
 */
import { describe, expect, it } from 'vitest'
import { parseBlueprintV4, type TeamBlueprintV4, type V4ToolBindingAuthoring } from '../../domain/blueprint/src/index.js'
import {
  compileEffectiveIo,
  compileMemberPolicy,
  projectToolIoRestriction,
} from '../member-io-policy/src/compile.js'
import type {
  Alpha4EffectiveAuthority,
  BoundBlueprint,
  InvocationAuthority,
  MemberPolicy,
  ToolIoRestriction,
} from '../member-io-policy/src/types.js'

// --- fixtures ----------------------------------------------------------------

function rw(mode: 'all' | 'restricted', opts: { allow?: string[]; ask?: string[]; deny?: string[] } = {}): Record<string, unknown> {
  if (mode === 'all') return { mode: 'all', deny: opts.deny ?? [] }
  return { mode: 'restricted', allow: opts.allow ?? [], ask: opts.ask ?? [], deny: opts.deny ?? [] }
}

function net(mode: 'allow' | 'restricted' | 'deny'): Record<string, unknown> {
  if (mode === 'allow') return { mode: 'allow' }
  if (mode === 'deny') return { mode: 'deny', default: 'deny' }
  return { mode: 'restricted', allow: ['api.example.test:443'], ask: [], deny: [], default: 'deny' }
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

const TEAM = 'team.a5sf.p102'

function blueprintDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 4,
    blueprintId: TEAM,
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [
      { templateId: 'alpha', persona: 'Alpha member.' },
      { templateId: 'beta', persona: 'Beta member.' },
    ],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      { templateId: 'alpha', io: { read: rw('restricted', { allow: ['/work/a'] }), write: rw('restricted', { allow: ['/work/b'] }), network: net('allow') } },
      { templateId: 'beta', io: { read: rw('restricted', { allow: ['/work/c'] }), write: rw('restricted', { allow: ['/work/d'] }), network: net('deny') } },
      { templateId: 'leader', io: { read: rw('restricted', { allow: ['team/'] }), write: rw('restricted', { allow: ['team/out'] }), network: net('deny') } },
    ],
    toolBindings: [
      binding('dsh.shell', 'bash', { read: rw('all'), write: rw('all'), network: net('allow') }),
      binding('dsh.fs', 'read', { read: rw('restricted', { allow: ['/work/a/docs'] }), write: rw('restricted', { allow: [] }), network: net('deny') }),
      binding('vendor.example', 'unknown-cli', { read: rw('all'), write: rw('all'), network: net('deny') }),
      binding('dsh.web', 'web_fetch', { read: rw('all'), write: rw('all'), network: net('restricted') }),
      binding('vendor.example', 'another-cli', { read: rw('all'), write: rw('all'), network: net('allow') }),
    ],
    ...overrides,
  }
}

function parseDoc(doc: Record<string, unknown> = blueprintDoc()): TeamBlueprintV4 {
  return parseBlueprintV4(`---\n${JSON.stringify(doc, null, 2)}\n---\n`)
}

function bound(blueprint: TeamBlueprintV4 = parseDoc()): BoundBlueprint {
  return { teamId: TEAM, blueprint }
}

function authority(overrides: Partial<Alpha4EffectiveAuthority> = {}): Alpha4EffectiveAuthority {
  return { revision: 'a4:1', memberInstanceId: 'mi-alpha-1', instanceGeneration: 3, admitted: true, ...overrides }
}

function input(templateId = 'alpha', overrides: { authority?: Partial<Alpha4EffectiveAuthority>; member?: Record<string, unknown>; blueprint?: TeamBlueprintV4 } = {}) {
  const memberInstanceId = templateId === 'alpha' ? 'mi-alpha-1' : 'mi-beta-1'
  return {
    trustedMember: {
      teamId: TEAM,
      memberInstanceId,
      templateId,
      instanceGeneration: 3,
      ...overrides.member,
    },
    boundBlueprint: bound(overrides.blueprint),
    effectiveAuthority: authority({ memberInstanceId, ...overrides.authority }),
  }
}

function compiled(doc: Record<string, unknown> = blueprintDoc(), templateId = 'alpha'): MemberPolicy {
  const parsed = parseDoc(doc)
  const result = compileMemberPolicy(input(templateId, { blueprint: parsed }))
  if (!result.ok) throw new Error(`expected a compiled policy, got ${result.code}: ${result.detail}`)
  return result.value
}

function tool(bindingIndex: number, doc: Record<string, unknown> = blueprintDoc()): ToolIoRestriction {
  const parsed = parseDoc(doc)
  const entry = parsed.toolBindings?.[bindingIndex] as V4ToolBindingAuthoring
  const result = projectToolIoRestriction(entry)
  if (!result.ok) throw new Error(`tool projection refused: ${result.code} ${result.detail}`)
  return result.value
}

function invocationFor(member: MemberPolicy, toolRestriction: ToolIoRestriction, overrides: Partial<InvocationAuthority> = {}): InvocationAuthority {
  return {
    memberIdentity: member.memberIdentity,
    callId: 'call-1',
    policyRevision: member.revision,
    toolBindingIdentity: toolRestriction.bindingIdentity,
    approvedOnce: false,
    ...overrides,
  }
}

function expectRefusal(result: { ok: true } | { ok: false; code: string }, code: string): void {
  if (result.ok) throw new Error(`expected refusal ${code}, got an accepted policy`)
  expect(result.code).toBe(code)
}

// --- P1-02 RED laws ----------------------------------------------------------

describe('P1-02 · Member ceiling compiles from trusted identity only', () => {
  it('compiles A from its own row: A’s policy never carries B’s locators', () => {
    const alpha = compiled()
    expect(alpha.read.allow).toEqual(['/work/a'])
    expect(alpha.write.allow).toEqual(['/work/b'])
    expect(alpha.network).toEqual({ access: 'allow' })
    const beta = compiled(blueprintDoc(), 'beta')
    expect(beta.read.allow).toEqual(['/work/c'])
    expect(beta.write.allow).toEqual(['/work/d'])
    expect(beta.network).toEqual({ access: 'deny' })
    expect(JSON.stringify(alpha)).not.toContain('/work/c')
    expect(JSON.stringify(beta)).not.toContain('/work/a')
  })

  it('refuses an undeclared ceiling instead of synthesizing allow-all', () => {
    const doc = blueprintDoc({
      members: [{ templateId: 'gamma', persona: 'Gamma.' }],
      memberIoCeilings: [],
    })
    expectRefusal(compileMemberPolicy(input('gamma', { blueprint: parseDoc(doc) })), 'MEMBER_CEILING_UNDECLARED')
  })

  it('refuses a destination-restricted network ceiling (never coerced to boolean)', () => {
    const doc = blueprintDoc({
      memberIoCeilings: [{ templateId: 'alpha', io: { read: rw('all'), write: rw('all'), network: net('restricted') } }],
    })
    expectRefusal(compileMemberPolicy(input('alpha', { blueprint: parseDoc(doc) })), 'IO_POLICY_UNSUPPORTED')
  })

  it('refuses untrusted / mismatched identities and stale generations', () => {
    expectRefusal(compileMemberPolicy(input('alpha', { member: { memberInstanceId: '' } })), 'MEMBER_IDENTITY_UNTRUSTED')
    expectRefusal(compileMemberPolicy(input('alpha', { member: { teamId: 'team.other' } })), 'TEAM_MISMATCH')
    expectRefusal(compileMemberPolicy(input('alpha', { member: { templateId: 'ghost' } })), 'MEMBER_TEMPLATE_UNKNOWN')
    expectRefusal(compileMemberPolicy(input('alpha', { member: { instanceGeneration: 2 } })), 'MEMBER_GENERATION_STALE')
    expectRefusal(compileMemberPolicy(input('alpha', { authority: { admitted: false } })), 'AUTHORITY_REFUSED')
    expectRefusal(compileMemberPolicy(input('alpha', { authority: { memberInstanceId: 'mi-beta-1' } })), 'MEMBER_IDENTITY_UNTRUSTED')
  })

  it('write-only never implies read (the axes are independent)', () => {
    const doc = blueprintDoc({
      memberIoCeilings: [{ templateId: 'alpha', io: { read: rw('restricted', { allow: [] }), write: rw('restricted', { allow: ['/work/b'] }), network: net('deny') } }],
    })
    const policy = compiled(doc)
    expect(policy.read.allow).toEqual([])
    expect(policy.write.allow).toEqual(['/work/b'])
  })

  it('keeps locators verbatim (directory vs single file, no normalization, order kept)', () => {
    const doc = blueprintDoc({
      memberIoCeilings: [{
        templateId: 'alpha',
        io: {
          read: rw('restricted', { allow: ['/work/a', '/work/a/f.txt'], deny: ['/work/a/secret'] }),
          write: rw('restricted', { allow: ['/work/a/out/'] }),
          network: net('deny'),
        },
      }],
    })
    const policy = compiled(doc)
    expect(policy.read.allow).toEqual(['/work/a', '/work/a/f.txt'])
    expect(policy.read.deny).toEqual(['/work/a/secret'])
    expect(policy.write.allow).toEqual(['/work/a/out/'])
  })

  it('derives a stable, content-addressed revision (same inputs ⇒ same revision)', () => {
    const a = compiled()
    const b = compiled()
    expect(a.revision).toBe(b.revision)
    expect(a).toEqual(b)
    const widened = blueprintDoc({
      memberIoCeilings: [{ templateId: 'alpha', io: { read: rw('restricted', { allow: ['/work/a', '/work/z'] }), write: rw('restricted', { allow: ['/work/b'] }), network: net('allow') } }],
    })
    expect(compiled(widened).revision).not.toBe(a.revision)
    // a different Alpha.4 revision is a different policy generation
    const otherAuthority = compileMemberPolicy(input('alpha', { authority: { revision: 'a4:2' } }))
    expect(otherAuthority.ok && otherAuthority.value.revision).not.toBe(a.revision)
  })

  it('returns frozen policies (a consumer cannot widen a compiled ceiling)', () => {
    const policy = compiled()
    expect(Object.isFrozen(policy)).toBe(true)
    expect(Object.isFrozen(policy.read)).toBe(true)
    expect(Object.isFrozen(policy.read.allow)).toBe(true)
    expect(Object.isFrozen(policy.network)).toBe(true)
  })
})

describe('P1-02 · EffectiveIo = MemberCeiling ∩ ToolRestriction', () => {
  it('a tool `all` lane cannot exceed the Member ceiling', () => {
    const member = compiled()
    const bash = tool(0) // read/write all, network allow
    expect(bash.read).toBe('no-additional-narrowing')
    const effective = compileEffectiveIo(member, bash, invocationFor(member, bash))
    expect(effective.ok).toBe(true)
    if (!effective.ok) return
    expect(effective.value.read).toEqual(member.read)
    expect(effective.value.write).toEqual(member.write)
    expect(effective.value.network.access).toBe('allow')
  })

  it('the same Member’s read tool narrows further (∩, not replacement)', () => {
    const member = compiled()
    const readTool = tool(1) // read restricted to /work/a/docs
    const effective = compileEffectiveIo(member, readTool, invocationFor(member, readTool))
    expect(effective.ok).toBe(true)
    if (!effective.ok) return
    expect(effective.value.read.allow).toEqual(['/work/a/docs'])
    // write lane of the read tool is restricted to [] ⇒ nothing writable
    expect(effective.value.write.allow).toEqual([])
    expect(effective.value.write.mode).toBe('restricted')
  })

  it('an unknown CLI gets the SAME Member ceiling (no per-tool ceiling bypass)', () => {
    const member = compiled()
    const cli = tool(4) // vendor.example/another-cli, all lanes + network allow
    const effective = compileEffectiveIo(member, cli, invocationFor(member, cli))
    expect(effective.ok).toBe(true)
    if (!effective.ok) return
    expect(effective.value.read.allow).toEqual(['/work/a'])
    expect(effective.value.write.allow).toEqual(['/work/b'])
    expect(effective.value.network.access).toBe('allow')
    // and a tool DENY still wins over a Member allow:
    const deniedCli = tool(2) // vendor.example/unknown-cli, network deny
    const denied = compileEffectiveIo(member, deniedCli, invocationFor(member, deniedCli))
    expect(denied.ok && denied.value.network.access).toBe('deny')
  })

  it('network is deny unless BOTH axes allow (deny always wins)', () => {
    const member = compiled() // alpha: allow
    const web = tool(3) // restricted ⇒ unsupported
    expectRefusal(compileEffectiveIo(member, web, invocationFor(member, web, { toolBindingIdentity: web.bindingIdentity })), 'TOOL_NETWORK_UNSUPPORTED')

    const locked = compiled(blueprintDoc(), 'beta') // beta: deny
    const bash = tool(0)
    const effective = compileEffectiveIo(locked, bash, invocationFor(locked, bash))
    expect(effective.ok).toBe(true)
    if (!effective.ok) return
    expect(effective.value.network.access).toBe('deny')
  })

  it('`ask` survives the intersection and is never promoted to allow', () => {
    const doc = blueprintDoc({
      memberIoCeilings: [{
        templateId: 'alpha',
        io: { read: rw('restricted', { allow: ['/work/a'], ask: ['/work/a/pending'] }), write: rw('restricted', { allow: [] }), network: net('deny') },
      }],
      toolBindings: [binding('dsh.fs', 'read', { read: rw('restricted', { allow: ['/work/a/pending', '/work/a'], ask: [] }), write: rw('restricted', { allow: [] }), network: net('deny') })],
    })
    const member = compiled(doc)
    const readTool = tool(0, doc)
    const effective = compileEffectiveIo(member, readTool, invocationFor(member, readTool))
    expect(effective.ok).toBe(true)
    if (!effective.ok) return
    expect(effective.value.read.ask).toEqual(['/work/a/pending'])
    expect(effective.value.read.ask).not.toEqual([])
  })

  it('a one-shot approval can never widen the ceiling (approvedOnce is not policy)', () => {
    const member = compiled()
    const bash = tool(0)
    const approved = compileEffectiveIo(member, bash, invocationFor(member, bash, { approvedOnce: true }))
    const unapproved = compileEffectiveIo(member, bash, invocationFor(member, bash, { approvedOnce: false }))
    expect(approved.ok && unapproved.ok).toBe(true)
    if (!approved.ok || !unapproved.ok) return
    expect(approved.value.read).toEqual(unapproved.value.read)
    expect(approved.value.write).toEqual(unapproved.value.write)
    expect(approved.value.network).toEqual(unapproved.value.network)
    expect(approved.value.read.allow).toEqual(['/work/a'])
  })

  it('refuses mismatched / stale invocations', () => {
    const member = compiled()
    const bash = tool(0)
    expectRefusal(compileEffectiveIo(member, bash, invocationFor(member, bash, { memberIdentity: 'mi-beta-1' })), 'INVOCATION_MISMATCH')
    expectRefusal(compileEffectiveIo(member, bash, invocationFor(member, bash, { policyRevision: 'a5sf1:stale' })), 'STALE_POLICY_REVISION')
    expectRefusal(compileEffectiveIo(member, bash, invocationFor(member, bash, { toolBindingIdentity: 'other/tool' })), 'INVOCATION_MISMATCH')
  })

  it('carries the invocation identity through (auditability of one call)', () => {
    const member = compiled()
    const bash = tool(0)
    const effective = compileEffectiveIo(member, bash, invocationFor(member, bash, { callId: 'call-42' }))
    expect(effective.ok).toBe(true)
    if (!effective.ok) return
    expect(effective.value.invocationId).toBe('call-42')
    expect(effective.value.memberIdentity).toBe('mi-alpha-1')
    expect(effective.value.toolBindingIdentity).toBe('dsh.shell/bash')
    expect(effective.value.policyRevision).toBe(member.revision)
    expect(Object.isFrozen(effective.value)).toBe(true)
  })
})
