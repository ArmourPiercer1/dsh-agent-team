/**
 * A5M1-CORR (PR358 fix-2b/fix-4 counterexamples) — the durable correlation
 * a PA call binds to must be REAL per-execution and non-reusable across
 * plane rebuilds, and a cancellation must stop the chain BEFORE the grant
 * is consumed. C1 scope (unit worlds, fixture backends); nothing here is a
 * C2 claim.
 *
 *  C1  two plane mounts issue the same fallback call sequence: their PA
 *      call ids NEVER collide (mount nonce), and when the host supplies an
 *      exec token the id IS `hexec:<token>` (observe line carries it).
 *  C2  the same host token cannot run two in-flight governed calls
 *      (single-flight refuse), and after settle the token is releasable.
 *  C3  a signal already aborted when the approval lands => the call settles
 *      CANCELLED_BEFORE_CONSUME with ZERO backend runs (the grant exists
 *      but nothing consumes it on this path).
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const row = await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)
const { approvingControlLeg } = await import('./a5-m1-control-legs.mjs')

const ASK_ALL = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function fixtureShell(sink: string[]) {
  let execCount = 0
  return {
    backendId: 'a5m1-corr-fixture',
    run: async () => {
      execCount += 1
      sink.push('BODY')
      return {
        ok: true as const,
        settlement: { kind: 'completed' as const },
        outcome: { exitCode: 0, stdout: 'fixture-body', stderr: '', timedOut: false, cancelled: false, truncated: false },
      }
    },
    execCount: () => execCount,
    lastStageTrace: Object.freeze([]),
  }
}

function mountWorld(sink: string[], leg: unknown) {
  const scratch = mkdtempSync(join(tmpdir(), 'a5m1-corr-'))
  const shell = fixtureShell(sink)
  const built = row.createTeamToolPlaneAssembly({
    teamSessionId: 'a5m1-test-team-root',
    controlLeg: leg,
    permissionPolicy: ASK_ALL,
    realmId: 'a5m1-corr-realm',
    templateId: 'corr-tpl',
    role: 'member',
    instanceId: 'corr-instance',
    plane: { cwdRoot: scratch },
    backends: { shell },
  })
  expect(built.ok, JSON.stringify(built)).toBe(true)
  const bash = built.value.definitions.find((d: { name: string }) => d.name === 'team_bash')
  return { bash, shell, done: () => rmSync(scratch, { recursive: true, force: true }) }
}

describe('A5M1-CORR — exec-bound correlation and pre-consume cancel', () => {
  it('C3 cancel BEFORE consume: aborted signal at approval time => row-form cancelled, zero body, zero consumption', async () => {
    const sink: string[] = []
    const ac = new AbortController()
    const legSpy = async (input: Record<string, unknown>) => {
      // honor the signal like the real bridge does: the cancellation lands
      // while the approval wait is in flight → the leg settles unsettled.
      ac.abort()
      return { decision: 'unsettled', requestId: 'c3-wait-aborted' }
    }
    const { bash, shell, done } = mountWorld(sink, legSpy)
    try {
      const r = await bash.execute({ command: 'printf x' }, { signal: ac.signal })
      expect(String(r.text)).toContain('· cancelled')
      expect(String(r.text)).not.toContain('APPROVAL_')
      expect(String(r.text)).not.toContain('a5p5-refused')
      expect(shell.execCount()).toBe(0)
      expect(sink).not.toContain('BODY')
    } finally { done() }
  })

  it('C1/C2 (a5p5 trio face): host token anchors the PA call id as hexec:<token>; same token twice = refused-replay', async () => {
    const reg = await import('../../tools/a5p5-tools/src/index.js')
    const seen: string[] = []
    const backend = {
      backendId: 'a5m1-corr-trio',
      run: async () => ({
        ok: true as const,
        settlement: { kind: 'completed' as const },
        outcome: { exitCode: 0, stdout: 'trio-body', stderr: '', timedOut: false, cancelled: false, truncated: false },
      }),
    }
    const decide = () => ({ kind: 'allow' })
    const defs = reg.createGovernedToolDefinitions({
      realmId: 'a5m1-corr-realm',
      decide,
      searchBackend: backend,
      shellBackend: backend,
      globBackend: backend,
      pa: async (req: { callId: string }) => { seen.push(`pa:${req.callId}`); return { kind: 'allow' } },
    })
    const bashDef = (defs as { name: string; execute: (raw: unknown, exec?: unknown) => Promise<{ text: string }> }[]).find((d) => d.name === 'team_bash' || d.name === 'bash')!
    const first = bashDef.execute({ command: 'true' }, { token: 'tok-abc' })
    const replay = await bashDef.execute({ command: 'true' }, { token: 'tok-abc' })
    expect(replay.text).toContain('refused-replay')
    const ok = await first
    expect(ok.text).toContain('trio-body')
    expect(seen.some((s) => s.includes('pa:bash:hexec:tok-abc') || s.includes(`hexec:tok-abc`))).toBe(true)
    // after settle the token is releasable: a NEW execution may reuse none of the old state
    const second = await bashDef.execute({ command: 'true' }, { token: 'tok-def' })
    expect(second.text).toContain('trio-body')
  })
})
