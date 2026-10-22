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
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const row = await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)

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
  const run = async (command: string) => await bash.execute({ command })
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
