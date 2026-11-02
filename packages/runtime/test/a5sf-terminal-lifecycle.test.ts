/**
 * a5sf-terminal-lifecycle.test.ts — P1-08 (Gate G1.8): a persistent PTY domain
 * is bound to a trusted Member + policy revision, reused within a generation,
 * killed when the revision tightens or the member is revoked, and its
 * pid/descendants are observable at shutdown.
 *
 * The PTY port is a test double: this file proves the LIFECYCLE LAW (identity,
 * revision comparison, reuse-without-restart, revocation, kill/settle receipts).
 * The real terminal backend is the host terminal service; the P1-08 evidence
 * records that.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-terminal-lifecycle
 */
import { describe, expect, it } from 'vitest'
import type { TrustedMemberIdentity } from '../member-io-policy/src/types.js'
import {
  createTerminalDomainRegistry,
  type PtyHandle,
  type TerminalAcquireSpec,
  type TerminalDomainRegistry,
} from '../team-sandbox/src/terminal.js'

const IDENTITY: TrustedMemberIdentity = Object.freeze({
  teamId: 'team-pty',
  memberInstanceId: 'member-pty',
  templateId: 'worker',
  instanceGeneration: 1,
})

interface FakePty extends PtyHandle {
  readonly kills: string[]
}

function makePty(pid: number, backend = 'pty'): FakePty {
  const kills: string[] = []
  let alive = true
  return {
    pid,
    backend,
    kills,
    descendants: () => (alive ? [pid + 1, pid + 2] : []),
    async kill(signal = 'SIGTERM') {
      kills.push(signal)
      alive = false
    },
  }
}

function spec(factory: () => PtyHandle, over: Partial<TerminalAcquireSpec> = {}): TerminalAcquireSpec {
  return {
    owner: { identity: IDENTITY, toolBindingIdentity: 'binding-pty' },
    sessionHandle: 'sess-1',
    policyRevision: 'rev-1',
    backend: 'pty',
    spawn: async () => factory(),
    ...over,
  }
}

describe('P1-08 terminal domain lifecycle', () => {
  it('creates one domain per member/binding and REUSES it within a generation', async () => {
    const ptys: FakePty[] = []
    const registry = createTerminalDomainRegistry({
      currentRevision: () => 'rev-1',
      now: () => 't0',
      isTrustedMember: () => true,
    })
    const factory = (): PtyHandle => {
      const pty = makePty(100 + ptys.length)
      ptys.push(pty)
      return pty
    }
    const first = await registry.acquire(spec(factory))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.reused).toBe(false)
    const second = await registry.acquire(spec(factory))
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.reused).toBe(true)
    expect(second.value.domainId).toBe(first.value.domainId)
    // No restart per command: exactly one PTY process exists.
    expect(ptys).toHaveLength(1)
    // The domain records creation-time revision + backend + pid.
    const domain = registry.list()[0]!
    expect(domain.policyRevision).toBe('rev-1')
    expect(domain.backend).toBe('pty')
    expect(domain.pid).toBe(first.value.pid)
    expect(registry.assertCurrent(domain.domainId)).toMatchObject({ ok: true, revision: 'rev-1' })
  })

  it('kills and rebuilds when the revision tightens; the stale domain refuses commands', async () => {
    let revision = 'rev-1'
    const ptys: FakePty[] = []
    const registry = createTerminalDomainRegistry({
      currentRevision: () => revision,
      now: () => 't0',
      isTrustedMember: () => true,
    })
    const factory = (): PtyHandle => {
      const pty = makePty(200 + ptys.length)
      ptys.push(pty)
      return pty
    }
    const first = await registry.acquire(spec(factory))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    revision = 'rev-2'
    const stale = registry.assertCurrent(first.value.domainId)
    expect(stale).toMatchObject({ ok: false, code: 'REVISION_STALE' })
    const rebuilt = await registry.acquire(spec(factory, { policyRevision: 'rev-2' }))
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.value.reused).toBe(false)
    expect(rebuilt.value.domainId).not.toBe(first.value.domainId)
    expect(ptys[0]?.kills).toContain('SIGKILL')
    expect(registry.list()).toHaveLength(1)
  })

  it('refuses a stale caller revision and a forged/untrusted owner', async () => {
    const registry = createTerminalDomainRegistry({ currentRevision: () => 'rev-1', now: () => 't0', isTrustedMember: () => false })
    const refused = await registry.acquire(spec(() => makePty(1)))
    expect(refused).toMatchObject({ ok: false, code: 'OWNER_UNTRUSTED' })

    const trusted = createTerminalDomainRegistry({ currentRevision: () => 'rev-1', now: () => 't0', isTrustedMember: () => true })
    const stale = await trusted.acquire(spec(() => makePty(1), { policyRevision: 'rev-0' }))
    expect(stale).toMatchObject({ ok: false, code: 'REVISION_STALE' })
    const bogus = await trusted.acquire(spec(() => makePty(1), { owner: { identity: { ...IDENTITY, memberInstanceId: '' }, toolBindingIdentity: 'x' } }))
    expect(bogus).toMatchObject({ ok: false, code: 'OWNER_UNTRUSTED' })
  })

  it('revocation kills the domain and refuses new shells for that member', async () => {
    const ptys: FakePty[] = []
    const registry = createTerminalDomainRegistry({ currentRevision: () => 'rev-1', now: () => 't0', isTrustedMember: () => true })
    const factory = (): PtyHandle => {
      const pty = makePty(300 + ptys.length)
      ptys.push(pty)
      return pty
    }
    const created = await registry.acquire(spec(factory))
    expect(created.ok).toBe(true)
    const killed = await registry.revoke(IDENTITY.memberInstanceId, 'member archived')
    expect(killed).toHaveLength(1)
    expect(ptys[0]?.kills).toContain('SIGKILL')
    expect(await registry.acquire(spec(factory))).toMatchObject({ ok: false, code: 'DOMAIN_REVOKED' })
  })

  it('shutdown reports pid, descendants and the settled revision (independent receipt)', async () => {
    const ptys: FakePty[] = []
    const registry = createTerminalDomainRegistry({ currentRevision: () => 'rev-9', now: () => 't0', isTrustedMember: () => true })
    const factory = (): PtyHandle => {
      const pty = makePty(400 + ptys.length)
      ptys.push(pty)
      return pty
    }
    await registry.acquire(spec(factory, { policyRevision: 'rev-9' }))
    const receipt = await registry.shutdown()
    expect(receipt.domains).toHaveLength(1)
    expect(receipt.domains[0]).toMatchObject({
      memberInstanceId: IDENTITY.memberInstanceId,
      policyRevision: 'rev-9',
      pid: 400,
      descendants: [401, 402],
      killed: true,
    })
    expect(ptys[0]?.kills).toContain('SIGKILL')
  })

  it('does not read the clock and stores no approval (single approval cannot become a PTY grant)', async () => {
    const registry = createTerminalDomainRegistry({ currentRevision: () => 'rev-1', now: () => 'fixed', isTrustedMember: () => true })
    const created = await registry.acquire(spec(() => makePty(500), { policyRevision: 'rev-1' }))
    expect(created.ok).toBe(true)
    const domain = registry.list()[0]!
    expect(domain.createdAt).toBe('fixed')
    expect(JSON.stringify(domain)).not.toMatch(/approvedOnce|approval|grant/i)
  })
})
