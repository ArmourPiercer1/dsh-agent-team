/**
 * a5p1-closed-world-guard.test.ts — Alpha.5 PR1 (plan §4, design §4.1): the
 * CLOSED-WORLD MONOTONIC GUARD's decision law.
 *
 * RED-FIRST, and the RED was specific: on the PoC host the Setup Coverage Gate
 * passed and an undeclared tool registered AFTER setup still RAN
 * (`hc-dyn-observation.dynRan = true`, evidence
 * `dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/h6-result.json`).
 * Every "abstain" arm the alpha.2 end-cap guard had for an unmanaged name is
 * the hole; this file pins that the PR1 Guard has NO abstain arm for a name
 * the Team assembly never bound.
 *
 * The lane under test is pure, so this file needs no host: it is the algebra.
 * The same laws are re-proved end-to-end on the pinned real Host by
 * `tests/kits/a5-pr1-guard-dispatch/` (NEG-1 / NEG-2 / dynRan / late MCP).
 *
 * @module test/a5p1-closed-world-guard
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  GOVERNANCE_ERROR_CODES,
  parseToolBinding,
  type ToolBinding,
} from '../../domain/tool-governance/src/index.js'
import {
  ASSURANCE_REALM_TRUSTED_ASSEMBLY,
  GOVERNED_UNVERIFIED_REASONS,
  GUARD_DENIAL_REASONS,
  GUARD_ERROR_CODES,
  createGovernedSurface,
  guardDecision,
  guardDenialMessage,
  untestedAssurance,
  type GuardExecView,
} from '../tool-dispatch/index.js'

const SCOPE = { agentScopeKey: 'session-m1', trustedIdentities: ['session-m1', 'agent-m1'] }

/** A governed Binding for one name, built through the PR0 parser's shape. */
function bindingFor(name: string, over: Partial<ToolBinding> = {}): ToolBinding {
  const raw = {
    bindingId: `team-own:session-m1:${name}`,
    agentScopeKey: 'session-m1',
    toolName: name,
    definitionIdentity: `team-own:${name}`,
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  }
  const parsed = parseToolBinding({ ...raw, ...over })
  if (!parsed.ok) throw new Error(`fixture binding is not a valid ToolBinding: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

function surfaceWith(...names: string[]) {
  const surface = createGovernedSurface({ agentScopeKey: 'session-m1' })
  for (const name of names) {
    const outcome = surface.bind({ name, origin: 'team-own', binding: bindingFor(name), verified: true })
    if (!outcome.ok) throw new Error(`fixture bind failed: ${outcome.error.message}`)
  }
  return surface
}

/**
 * The verdict for one call. `definition` is what the public
 * `tools.get(name, scope)` seam resolves AT THE MOMENT OF THE CALL: the Guard
 * must compare it with what the Binding pinned, and a read that fails is a
 * refusal — never "no change, carry on". The default below says "the definition
 * still matches the one the Binding pinned", which is what the pre-R2 tests
 * assumed implicitly; R2 makes it an input the Guard actually checks.
 */
function decide(
  exec: GuardExecView,
  opts: {
    surface?: ReturnType<typeof surfaceWith>
    active?: boolean
    policyGeneration?: number
    authorityGeneration?: number
    definition?: { ok: true; fingerprint: string } | { ok: false; detail: string }
  } = {},
) {
  return guardDecision({
    exec,
    scope: SCOPE,
    surface: opts.surface ?? createGovernedSurface({ agentScopeKey: 'session-m1' }),
    active: opts.active ?? true,
    policyGeneration: opts.policyGeneration ?? 0,
    authorityGeneration: opts.authorityGeneration ?? 0,
    definition: opts.definition ?? { ok: true, fingerprint: `team-own:${exec.name}` },
  })
}

describe('the closed world: an unbound name has no abstain arm', () => {
  it('G1 denies an exec.name that was never bound (TEAM_TOOL_UNGOVERNED)', () => {
    const verdict = decide({ name: 'h6_dyn_probe', agentIdentity: 'session-m1' })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TEAM_TOOL_UNGOVERNED')
    expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.UNGOVERNED)
    // The message is model-visible: it says what is missing, not just "no".
    expect(verdict.error.message).toContain('h6_dyn_probe')
    expect(verdict.error.message).toContain('no Team Tool Binding')
  })

  it('G2 abstains for a bound, verified, in-generation name called by this Agent', () => {
    const surface = surfaceWith('read')
    const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface })
    expect(verdict).toEqual({ kind: 'abstain', reason: 'governed-and-verified' })
  })

  it('G3 (the dynRan flip) a name that appears AFTER setup is still un-governed', () => {
    // The exact PoC shape: setup assembled cleanly, then an own-layer
    // registration added a name. `tools.restrict` cannot mask a scope's own
    // registrations, and nothing bound this one — so the Guard, not the
    // setup-time snapshot, decides.
    const surface = surfaceWith('read', 'team_delegate')
    const verdict = decide({ name: 'a5p1_dyn_probe', agentIdentity: 'agent-m1' }, { surface })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TEAM_TOOL_UNGOVERNED')
  })

  it('G4 an unverified Binding is governed but never allowed (no native fallback)', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1' })
    surface.bind({ name: 'read', origin: 'inherited-native', binding: bindingFor('read'), verified: false })
    const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.BINDING_UNVERIFIED)
  })

  it('G5 a foreign Agent identity on a governed name is refused, not inherited', () => {
    const surface = surfaceWith('read')
    const verdict = decide({ name: 'read', agentIdentity: 'session-somebody-else' }, { surface })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.IDENTITY_FOREIGN)
  })

  it('G6 (NEG-2) a Team-scope exec with NO Agent identity is refused, never laundered global', () => {
    const surface = surfaceWith('read')
    for (const identity of [undefined, '', null]) {
      const verdict = decide({ name: 'read', ...(identity === undefined ? {} : { agentIdentity: identity as string }) }, { surface })
      expect(verdict.kind).toBe('deny')
      if (verdict.kind !== 'deny') continue
      expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
      expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.IDENTITY_ABSENT)
    }
  })

  it('G7 every non-ACTIVE state refuses before the name lookup', () => {
    // Even a fully governed name: assembly-in-progress, draining, tombstoned
    // and released are all "no new calls" (design §4.1).
    const surface = surfaceWith('read')
    for (const active of [false]) {
      const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface, active })
      expect(verdict.kind).toBe('deny')
      if (verdict.kind !== 'deny') continue
      expect(verdict.error.code).toBe('ADAPTER_DRAINING')
      expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.NOT_ACTIVE)
    }
  })

  it('G8 a stale-generation Binding is a typed refusal, not a stale allow', () => {
    const surface = surfaceWith('read')
    const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface, policyGeneration: 7 })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.REVISION_DRIFT)
  })

  it('G9 the verdict vocabulary is exactly three frozen §5 codes', () => {
    // Derived from the frozen §5 table, so the ORDER is the frozen table's;
    // what is pinned here is the exact three-element SET.
    expect([...GUARD_ERROR_CODES].sort()).toEqual(['ADAPTER_DRAINING', 'TEAM_TOOL_UNGOVERNED', 'TOOL_BINDING_UNVERIFIED'])
    for (const code of GUARD_ERROR_CODES) {
      expect(GOVERNANCE_ERROR_CODES.includes(code), `${code} is not a frozen §5 code`).toBe(true)
    }
  })

  it('G10 the Guard has no allow result to be traded for', () => {
    const surface = surfaceWith('read')
    const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface })
    // Structurally: the positive outcome is `abstain`, and abstain carries no
    // permission — a `tools/pre-execute` listener or a `tools/change` event
    // still has to earn the call somewhere else.
    expect(verdict.kind === 'abstain' && !('allow' in verdict)).toBe(true)
    expect(Object.keys(verdict).sort()).toEqual(['kind', 'reason'])
  })

  it('G11 every reason maps to a stable, named message (no stack-trace prose)', () => {
    const seen = new Set<string>()
    for (const reason of Object.values(GUARD_DENIAL_REASONS)) {
      const message = guardDenialMessage('read', reason)
      expect(message, reason).toContain('team tool guard')
      expect(message, reason).toContain('read')
      expect(seen.has(message), `duplicate message for ${reason}`).toBe(false)
      seen.add(message)
    }
  })
})

describe('the governed surface only grows through the trusted assembly', () => {
  it('S1 a name keeps ONE stable Definition identity (no unload-then-fall-back)', () => {
    const surface = surfaceWith('read')
    const swapped = surface.bind({
      name: 'read',
      origin: 'team-own',
      binding: { ...bindingFor('read'), bindingId: 'something-else:read' },
      verified: true,
    })
    expect(swapped.ok).toBe(false)
    if (swapped.ok) return
    expect(swapped.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(swapped.error.message).toContain('stable Definition identity')
  })

  it('S2 a change is a strictly higher immutable revision', () => {
    const surface = surfaceWith('read')
    const same = surface.bind({ name: 'read', origin: 'team-own', binding: bindingFor('read'), verified: true })
    expect(same.ok).toBe(false)
    const advanced = surface.bind({
      name: 'read',
      origin: 'team-own',
      binding: bindingFor('read', { revision: 2, policyGeneration: 1 }),
      verified: true,
    })
    expect(advanced.ok).toBe(true)
    const entry = surface.entryOf('read')
    expect(entry?.revision).toBe(2)
    // The old revision is a frozen record, not a mutated one.
    expect(advanced.ok && advanced.value.binding.revision).toBe(2)
    expect(surface.entryOf('read')?.binding.policyGeneration).toBe(1)
  })

  it('S3 the setup surface is bound as one closed world, idempotently', () => {
    // The trusted native list plus the definitions pinned at the public seam:
    // the two facts an inherited name needs before it counts as native.
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['bash', 'read', 'write', 'grep'] })
    const pin = (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, `def:${n}`]))
    // The second map is the TRUSTED (global) view, the third fact R-a adds. This
    // fixture's agent scope and global view agree, so both pins are equal — and
    // the assertion below keeps meaning what it meant before the rule tightened.
    expect(surface.bindInheritedSurface(['bash', 'read', 'write', 'read'], pin(['bash', 'read', 'write']), pin(['bash', 'read', 'write'])).verifiedBound).toBe(3)
    expect(surface.names()).toEqual(['bash', 'read', 'write'])
    // A second pass never re-binds over an existing (possibly richer) entry.
    expect(surface.bindInheritedSurface(['bash', 'grep'], pin(['bash', 'grep']), pin(['bash', 'grep'])).verifiedBound).toBe(1)
    expect(surface.names()).toEqual(['bash', 'grep', 'read', 'write'])
    expect(surface.entryOf('bash')?.origin).toBe('inherited-native')
  })

  it('S4 markUnverified needs the bindingId in force (no identity confusion)', () => {
    const surface = surfaceWith('read')
    expect(surface.markUnverified('read', 'other').ok).toBe(false)
    expect(surface.markUnverified('nope', 'team-own:session-m1:nope').ok).toBe(false)
    const marked = surface.markUnverified('read', 'team-own:session-m1:read')
    expect(marked.ok).toBe(true)
    expect(surface.entryOf('read')?.verified).toBe(false)
    const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface })
    expect(verdict.kind).toBe('deny')
  })

  it('S5 the inherited assurance record is honestly untested, never empty', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['read'] })
    // Both public reads agree here, which is exactly what a native Binding now
    // requires (residual R-a): the second map is what THIS Agent resolves, the
    // third what the trusted global view resolves.
    surface.bindInheritedSurface(['read'], { read: 'def:read' }, { read: 'def:read' })
    const assurance = surface.entryOf('read')?.binding.assurance
    expect(assurance?.implementationOrigin).toBe('dsh-native')
    const dimensions = Object.values(assurance?.assurance ?? {})
    expect(dimensions.map((d) => d.level)).toEqual(['untested', 'untested', 'untested', 'untested', 'untested', 'untested'])
    // PR0 review M-2: `untested` is still a FULL §2.1 record — mechanism,
    // realm, trust root and evidence are STATED (as explicit nulls), because a
    // bare level is the overclaim §1.4 refuses and an omitted field is what
    // lets a claim drift silent.
    for (const dimension of dimensions) {
      expect(dimension).toEqual({ level: 'untested', mechanism: null, realmId: ASSURANCE_REALM_TRUSTED_ASSEMBLY, trustRoot: null, evidence: null })
    }
  })
  // A PR1 Binding is handed to the frozen PR0 parser as-is. If this lane ever
  // invented a field, renamed one, or shrank a record, PR0 would refuse it —
  // and the assembly that trusted it would be governing something no contract
  // describes. This is the seam between the two PRs, pinned.
  it('S6 every PR1 Binding is parseable by the frozen PR0 contract parser', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1' })
    // A native-shaped Binding (both reads agree) and a Team-owned one, both fed
    // to the frozen parser below.
    surface.bindInheritedSurface(['read'], { read: 'def:read' }, { read: 'def:read' })
    surface.bind({
      name: 'team_delegate',
      origin: 'team-own',
      binding: {
        bindingId: 'team-own:session-m1:team_delegate',
        agentScopeKey: 'session-m1',
        toolName: 'team_delegate',
        definitionIdentity: 'team-own:team_delegate',
        providerId: 'dsh-agent-team',
        implementationOrigin: 'team-trusted-extension',
        executionBoundary: 'trusted-host',
        assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
        policyGeneration: 0,
        authorityGeneration: 0,
        revision: 1,
        status: 'ACTIVE',
      },
      verified: true,
    })
    for (const entry of surface.snapshot()) {
      const parsed = parseToolBinding(entry.binding)
      if (!parsed.ok) throw new Error(`PR0 refuses the PR1 Binding for "${entry.name}": ${JSON.stringify(parsed.problems)}`)
      expect(parsed.ok).toBe(true)
    }
  })
  // PR1 reads NO clock: no deadline, no expiry, no TTL, no rate window. The
  // finite-clock law (NaN / ±Infinity are typed fail-closed, body=0) is the
  // ADMISSION layer's job in PR2; a clock path appearing HERE would mean this
  // lane started making time claims of its own, so the absence is pinned.
  it('S7 the lane reads no clock (the finite-clock law belongs to Admission, PR2)', () => {
    const here = join(dirname(fileURLToPath(import.meta.url)), '..', 'tool-dispatch')
    const banned = ['Date.now', 'new Date', 'setTimeout', 'setInterval', 'performance.now', 'process.hrtime']
    for (const file of ['closed-world-guard.ts', 'scoped-dispatcher.ts', 'install.ts', 'index.ts']) {
      const source = readFileSync(join(here, file), 'utf8')
      const body = source.split('\n').filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//')).join('\n')
      const hits = banned.filter((token) => body.includes(token))
      expect(hits, `${file} reads a clock: ${hits.join(', ')}`).toEqual([])
    }
  })
})


describe('PR1 Gate R1 / R2 — inherited bindings and the definition a call actually resolves to', () => {
  it('R1 an observed name becomes a native Binding only if it is on the trusted native list', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['read'] })
    const result = surface.bindInheritedSurface(['read', 'evil_own_tool'], { read: 'def:read' }, { read: 'def:read' })
    expect(result.verifiedBound).toBe(1)
    expect(result.unverified).toEqual(['evil_own_tool'])
    const evil = surface.entryOf('evil_own_tool')
    expect(evil?.verified).toBe(false)
    expect(evil?.binding.bindingId).not.toBe('native:evil_own_tool')
    expect(evil?.binding.implementationOrigin).not.toBe('dsh-native')
    expect(evil?.binding.definitionIdentity).not.toBe('native:evil_own_tool')
    const verdict = decide({ name: 'evil_own_tool', agentIdentity: 'session-m1' }, {
      surface,
      definition: { ok: true, fingerprint: String(evil?.binding.definitionIdentity) },
    })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
  })

  it('R1b an allowlisted name whose definition cannot be pinned is bound UNVERIFIED', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['read'] })
    const result = surface.bindInheritedSurface(['read'], {}, {})
    expect(result.verifiedBound).toBe(0)
    expect(result.unverified).toEqual(['read'])
    expect(surface.entryOf('read')?.verified).toBe(false)
    // The recorded reason is the plainest true one: nothing was readable.
    expect(surface.entryOf('read')?.unverifiedReason).toBe('definition-unreadable')
  })

  it('R1R (residual R-a) a name the two public reads disagree on is NEVER an inherited native', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['read'] })
    const result = surface.bindInheritedSurface(['read'], { read: 'def:somebody-else' }, { read: 'def:native-body' })
    expect(result.verifiedBound).toBe(0)
    expect(result.shadowed).toEqual([{ name: 'read', trusted: 'def:native-body', resolved: 'def:somebody-else' }])
    const entry = surface.entryOf('read')
    expect(entry?.verified).toBe(false)
    expect(entry?.unverifiedReason).toBe('native-shadowed')
    expect(entry?.binding.bindingId).not.toBe('native:read')
    expect(entry?.binding.implementationOrigin).not.toBe('dsh-native')
    const verdict = decide({ name: 'read', agentIdentity: 'session-m1' }, {
      surface,
      definition: { ok: true, fingerprint: 'def:somebody-else' },
    })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(verdict.error.message).toContain('shadows')
  })

  it('R1R-b a native name whose TRUSTED read is unavailable is refused, never credited (unreadable is not a pass)', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['read'] })
    const result = surface.bindInheritedSurface(['read'], { read: 'def:read' }, {})
    expect(result.verifiedBound).toBe(0)
    expect(result.nativeUnreadable).toEqual(['read'])
    expect(surface.entryOf('read')?.unverifiedReason).toBe('native-unreadable')
  })

  it('R1R-c the reason a name is unverified is stated, not flattened (three facts, three sentences)', () => {
    const sentences = new Set<string>()
    for (const reason of ['native-shadowed', 'native-unreadable', 'definition-drift', 'definition-unreadable'] as const) {
      const message = guardDenialMessage('read', reason === 'native-shadowed' ? GUARD_DENIAL_REASONS.NATIVE_SHADOWED
        : reason === 'native-unreadable' ? GUARD_DENIAL_REASONS.NATIVE_UNREADABLE
        : reason === 'definition-drift' ? GUARD_DENIAL_REASONS.DEFINITION_DRIFT
        : GUARD_DENIAL_REASONS.DEFINITION_UNREADABLE)
      expect(message).toContain('team tool guard')
      sentences.add(message)
    }
    expect(sentences.size).toBe(4)
    expect(GOVERNED_UNVERIFIED_REASONS).toEqual([
      'unattributed', 'native-shadowed', 'native-unreadable', 'definition-drift', 'definition-unreadable',
    ])
  })

  it('R2 a same-scope name resolving to a DIFFERENT definition never runs on the old verification', () => {
    const surface = surfaceWith('read')
    const verdict = decide(
      { name: 'read', agentIdentity: 'session-m1' },
      { surface, definition: { ok: true, fingerprint: 'def:read:attacker-body' } },
    )
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(verdict.reason).toContain('definition')
    expect(guardDenialMessage('read', verdict.reason)).toContain('definition')
  })

  it('R2b an unreadable current definition is a refusal, never an assumption of no change', () => {
    const surface = surfaceWith('read')
    const verdict = decide(
      { name: 'read', agentIdentity: 'session-m1' },
      { surface, definition: { ok: false, detail: 'tools.get threw' } },
    )
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(verdict.reason).toContain('unreadable')
  })

  it('R2c the state and identity gates still answer before the definition check', () => {
    const surface = surfaceWith('read')
    const notActive = decide({ name: 'read', agentIdentity: 'session-m1' }, { surface, active: false })
    expect(notActive.kind).toBe('deny')
    if (notActive.kind !== 'deny') return
    expect(notActive.reason).toBe(GUARD_DENIAL_REASONS.NOT_ACTIVE)
    const foreign = decide(
      { name: 'read', agentIdentity: 'agent-somebody-else' },
      { surface, definition: { ok: false, detail: 'irrelevant' } },
    )
    if (foreign.kind !== 'deny') throw new Error('expected a refusal')
    expect(foreign.reason).toBe(GUARD_DENIAL_REASONS.IDENTITY_FOREIGN)
  })

  it('R2d an unbound name is refused before the definition seam is ever consulted', () => {
    // The refusal order is stable and every arm denies: a name nothing bound
    // never reaches the definition check, so an unreadable seam cannot make it
    // look more permissible, and the code it gets is the earlier fact.
    const verdict = decide({ name: 'never_bound', agentIdentity: 'session-m1' }, { definition: { ok: false, detail: 'no seam' } })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.UNGOVERNED)
    expect(verdict.error.code).toBe('TEAM_TOOL_UNGOVERNED')
  })
})
