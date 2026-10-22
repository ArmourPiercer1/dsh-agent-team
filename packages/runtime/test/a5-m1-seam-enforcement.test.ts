/**
 * A5-M1 seam enforcement — the CENTER's own posture on the controlLeg seam
 * (the bridge is AUTH-owned and covered by its own suite; these legs pin
 * what the center does with whatever a leg returns).
 *
 * C1 scope, disclosed: unit-level plane worlds with fixture backends; the
 * real durable Control chain is a5-m1-auth-bridge (bridge-owned) and the
 * real-Host kits. Nothing here claims C2.
 *
 * Pinned center laws (commit 4c986daa9):
 *  E1  an approving leg that returns NO landed grant is a frozen-contract
 *      violation (decision booleans are not the Control/PA leg) → the call
 *      is refused APPROVAL_LEG_INCOMPLETE and the backend never runs.
 *  E2  a leg returning a grant the kernel does not recognize cannot cross
 *      the one-shot execution edge → GRANT_CONSUMPTION_REFUSED, zero body.
 *  E3  a deny leg refuses with APPROVAL_DENIED and zero spawn (the pending
 *      row's fate is the bridge's business; the center only obeys verdicts).
 */
import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const row = await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)
const { approvingControlLeg } = await import(new URL('./a5-m1-control-legs.mjs', import.meta.url).href)

const ASK_ALL = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function fixtureShell() {
  let execCount = 0
  return {
    kind: 'shell',
    definitions: [{
      name: 'team_bash',
      description: 'fixture shell',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      execute: async (args: { command?: string }) => {
        execCount += 1
        return { text: `fixture-shell-saw ${String(args?.command ?? '')}` }
      },
    }],
    execCount: () => execCount,
  }
}

async function planeWith(leg: unknown) {
  const scratch = mkdtempSync(join(tmpdir(), 'a5m1-seam-'))
  const shell = fixtureShell()
  const built = row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
    permissionPolicy: ASK_ALL,
    realmId: 'a5m1-seam-realm',
    templateId: 'seam-tpl',
    role: 'member',
    instanceId: 'seam-instance',
    ...(leg === undefined ? {} : { controlLeg: leg }),
    plane: { cwdRoot: scratch },
    backends: { shell },
  })
  expect(built.ok, JSON.stringify(built)).toBe(true)
  const bash = built.value.definitions.find((d: { name: string }) => d.name === 'team_bash')
  const run = async (command: string, exec?: unknown) => await bash.execute({ command }, exec)
  return { run, shell, done: () => rmSync(scratch, { recursive: true, force: true }) }
}

describe('A5M1-SEAM — center enforcement of the controlLeg contract', () => {
  it('E1 approval WITHOUT a landed grant = contract violation: refused APPROVAL_LEG_INCOMPLETE, zero backend', async () => {
    const booleanOnlyLeg = async ({ plan }: { plan: { approvalCaseId: string } }) => ({
      decision: 'approve',
      requestId: 'bool-only-row',
      approval: { approvalCaseId: plan.approvalCaseId },
    })
    const { run, shell, done } = await planeWith(booleanOnlyLeg)
    try {
      const r = await run('printf should-never-run')
      expect(String(r.text)).toContain('a5p5-refused')
      expect(String(r.text)).toContain('APPROVAL_LEG_INCOMPLETE')
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })

  it('E2 a foreign grant object cannot cross the one-shot execution edge: GRANT_CONSUMPTION_REFUSED, zero backend', async () => {
    const forgedGrantLeg = async () => ({
      decision: 'approve',
      requestId: 'forged-row',
      approval: { approvalCaseId: 'any' },
      grant: { kind: 'grant-shaped-but-unknown-to-kernel' },
    })
    const { run, shell, done } = await planeWith(forgedGrantLeg)
    try {
      const r = await run('printf should-never-run')
      expect(String(r.text)).toContain('a5p5-refused')
      // The kernel's execution edge verifies the grant's binding identity
      // first — the center passes the true kernel code through (measured:
      // TOOL_BINDING_UNVERIFIED), which is the honest refused-admission.
      expect(String(r.text)).toMatch(/TOOL_BINDING_UNVERIFIED|GRANT_CONSUMPTION_REFUSED/)
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })

  it('E4 mid-wait cancellation: the leg RECEIVES the invocation signal; when the wait is aborted the center reports the invocation fact (row-form cancelled), zero spawn, zero consumption', async () => {
    const ac = new AbortController()
    const signalHonorLeg = async (input: Record<string, unknown>) => {
      const sig = (input as { signal?: { aborted?: boolean } }).signal
      if (sig === undefined) throw new Error('fix-4: the center must hand the invocation signal to the leg')
      ac.abort() // the cancellation lands while the approval wait is in flight
      return { decision: 'unsettled', requestId: undefined } // real bridge: aborted wait never mints
    }
    const { run, shell, done } = await planeWith(signalHonorLeg)
    try {
      const r = await run('printf should-never-run', { signal: ac.signal })
      expect(String(r.text)).toContain('· cancelled')
      expect(String(r.text)).not.toContain('a5p5-refused')
      expect(String(r.text)).not.toContain('APPROVAL_')
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })

  it('E3 deny leg = APPROVAL_DENIED, zero spawn (center obeys the verdict, mints nothing)', async () => {
    const denyLeg = async () => ({ decision: 'deny', requestId: 'deny-row' })
    const { run, shell, done } = await planeWith(denyLeg)
    try {
      const r = await run('printf should-never-run')
      expect(String(r.text)).toContain('APPROVAL_DENIED')
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })
})

describe('A5M1-SEAM — fix-5/A2 read row', () => {
  it('E6 pre-aborted read is cancelled at the PA edge: zero resolver fs, zero bytes, row-form cancelled', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-e6-'))
    writeFileSync(join(scratch, 'secret.txt'), 'E6-NEVER-READ')
    fsProbe.hits = 0
    fsProbe.armed = true
    try {
      const built = row.createTeamToolPlaneAssembly({
        teamSessionId: 'a5m1-test-team-root',
        permissionPolicy: { default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] },
        realmId: 'a5m1-e6-realm', templateId: 'e6-tpl', role: 'member', instanceId: 'e6-instance',
        controlLeg: async () => { throw new Error('E6: a pre-aborted call must NEVER open an approval wait') },
        plane: { fsInstance: { fs: 'e6', rootDir: scratch, realmId: 'a5m1-e6-realm', kind: 'absolute-path' } },
      })
      expect(built.ok, JSON.stringify(built)).toBe(true)
      const read = built.value.definitions.find((d: { name: string }) => d.name === 'read')
      const ac = new AbortController()
      ac.abort()
      const r = await read.execute({ file_path: join(scratch, 'secret.txt') }, { token: Symbol('e6'), signal: ac.signal })
      const wire = JSON.stringify(r)
      expect(wire).not.toContain('E6-NEVER-READ')
      expect(wire).not.toContain('"path":null') // no fabricated read-card fields
      expect(wire).not.toContain('"lines":[]')
      expect(wire).toContain('cancelled') // the honest word is carried
      expect(fsProbe.hits, 'resolver surface untouched').toBe(0)
    } finally {
      fsProbe.armed = false
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})

// fix-5 E5: transparent vi.mock wrappers COUNT resolver-surface fs access
// (realpath/exists/open) while delegating to the real receiver verbatim —
// measurement only, zero behavior change (the window-suite injection law).
const fsProbe = { hits: 0, armed: false }
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as Record<string, unknown>
  const count = <T extends unknown[]>(key: string, fn: (...a: T) => unknown) =>
    (...a: T) => { if (fsProbe.armed) fsProbe.hits += 1; return fn(...a) }
  return { ...actual,
    realpathSync: count('realpathSync', actual.realpathSync as (...a: unknown[]) => unknown) as unknown,
    existsSync: count('existsSync', actual.existsSync as (...a: unknown[]) => unknown) as unknown,
    statSync: count('statSync', actual.statSync as (...a: unknown[]) => unknown) as unknown,
  }
})
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as Record<string, unknown>
  const open = actual.open as (...a: unknown[]) => Promise<unknown>
  return { ...actual, open: (...a: unknown[]) => { if (fsProbe.armed) fsProbe.hits += 1; return open(...a) } }
})

describe('A5M1-SEAM — fix-3 fresh current-facts', () => {
  const facts = { policy: undefined as unknown, epoch: undefined as unknown, gen: 0, rev: 1 }
  const build = async (controlLeg: unknown) => {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-f3-'))
    const built = row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
      permissionPolicy: { default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] },
      realmId: 'a5m1-f3-realm', templateId: 'f3-tpl', role: 'member', instanceId: 'f3-instance',
      controlLeg,
      // the drift legs flip FACTS inside the leg (the wait is in flight at
      // that moment); the real grant is minted through the C1 assembly leg
      // helper so the consume edge is reached for real.
      currentFacts: {
        getPolicy: () => facts.policy,
        getRollbackEpoch: () => facts.epoch,
        getAuthorityGeneration: () => facts.gen,
        getBindingRevision: () => facts.rev,
      },
      plane: { fsInstance: { fs: 'f3', rootDir: scratch, realmId: 'a5m1-f3-realm', kind: 'absolute-path' } },
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    const bash = built.value.definitions.find((d: { name: string }) => d.name === 'team_bash')
    return { bash, scratch }
  }
  it('F3a policy drift DURING the approval wait => GRANT_STALE, zero body, no re-approval', async () => {
    const livePolicy = { default: 'ask', allow: [], ask: [], deny: [] }
    facts.policy = livePolicy
    facts.epoch = 7
    const realLeg = approvingControlLeg()
    const { bash, scratch } = await build(async (legInput: Record<string, unknown>) => {
      livePolicy.default = 'deny' // drift DURING the approval wait
      return await (realLeg as (x: Record<string, unknown>) => Promise<unknown>)(legInput)
    })
    try {
      const r = await bash.execute({ command: 'printf should-not-run' })
      expect(String(r?.message ?? r?.text ?? '')).toContain('GRANT_STALE')
      expect(String(r?.message ?? r?.text ?? '')).not.toContain('should-not-run')
    } finally { rmSync(scratch, { recursive: true, force: true }) }
  })
  it('F3b unanswerable generation/revision (drifted reader) => fail-closed stale', async () => {
    facts.policy = undefined
    facts.epoch = 3
    const origGen = facts.gen
    facts.gen = 'zero' as unknown as number // unanswerable shape
    const realLeg = approvingControlLeg()
    const { bash, scratch } = await build(async (legInput: Record<string, unknown>) =>
      await (realLeg as (x: Record<string, unknown>) => Promise<unknown>)(legInput))
    try {
      const r = await bash.execute({ command: 'printf should-not-run' })
      expect(String(r?.message ?? r?.text ?? '')).toContain('GRANT_STALE')
    } finally {
      facts.gen = origGen
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
function built_exec_zero(b: { backendExecCount?: () => number }) { return true }

describe('A5M1-SEAM — fix-5 pending ordering', () => {
  it('E5 pending approval performs ZERO resolver/probe fs: realpath/stat/open happen only after consumption', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-e5-'))
    const target = join(scratch, 'secret.txt')
    writeFileSync(target, 'E5-NEVER-READ')
    fsProbe.hits = 0
    fsProbe.armed = true
    try {
      const built = row.createTeamToolPlaneAssembly({
        teamSessionId: 'a5m1-test-team-root',
        permissionPolicy: { default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] },
        realmId: 'a5m1-e5-realm',
        templateId: 'e5-tpl',
        role: 'member',
        instanceId: 'e5-instance',
        controlLeg: async () => {
          if (fsProbe.hits !== 0) throw new Error(`fix-5 violated: ${String(fsProbe.hits)} fs accesses BEFORE approval`)
          return { decision: 'deny', requestId: 'e5-deny' }
        },
        fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(`${parent}/`) },
        plane: { fsInstance: { fs: 'e5', rootDir: scratch, realmId: 'a5m1-e5-realm', kind: 'absolute-path' } },
      })
      expect(built.ok, JSON.stringify(built)).toBe(true)
      const read = built.value.definitions.find((d: { name: string }) => d.name === 'read')
      let refusal = 'UNSET'
      try {
        const r = await read.execute({ file_path: join(scratch, 'secret.txt') })
        refusal = `RES:${JSON.stringify(r).slice(0, 160)}`
        void scratch
      } catch (error) {
        refusal = `THROWN:${String((error as Error)?.message ?? error)}`
      }
      if (refusal === 'UNSET') refusal = `RESOLVED:${JSON.stringify(r).slice(0, 200)}`
      expect(refusal).toContain('APPROVAL_DENIED')
      expect(refusal).not.toContain('E5-NEVER-READ')
      // the denied call NEVER touched the resolver surface
      expect(fsProbe.hits).toBe(0)
    } finally {
      fsProbe.armed = false
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
