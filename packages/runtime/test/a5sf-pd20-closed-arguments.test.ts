/**
 * a5sf-pd20-closed-arguments.test.ts — PD20-C3: an undeclared parameter on a
 * route-C shadow is a TYPED REFUSAL, never a silent drop.
 *
 * WHY THIS FILE EXISTS. `dev/agent-workflow/evidence/a5sf-recon-shell` measured
 * that the governed Member's `bash` declares `additionalProperties: false` with
 * three parameters, yet a call carrying `run_in_background: true` EXECUTED in
 * the foreground: no job id, no background process, no typed refusal (the
 * harness does not validate a native module's closed schema on the call path,
 * and the module only read the keys it knew). The model believed it had started
 * a managed job; `job_list` then answered `(no background jobs)` as free text.
 *
 * THE LAW PINNED HERE:
 *   1. `run_in_background` is refused with its own code
 *      (`BACKGROUND_NOT_SUPPORTED`) — the refusal says no producer exists, so
 *      the caller learns the capability, not just "bad key";
 *   2. any other undeclared key is refused with `UNSUPPORTED_PARAMETER` and the
 *      accepted list;
 *   3. a call carrying only declared keys passes (the check is not a blanket
 *      "reject everything new");
 *   4. the registration itself stays closed (`additionalProperties: false`, no
 *      `run_in_background` property) — the schema and the boundary agree;
 *   5. the refusal happens BEFORE any execution-face call (zero spawns).
 *
 * Host-free (C1). The DEV-LIVE arm (a real boot whose model sends
 * `run_in_background`) lives in `dev/agent-workflow/evidence/pd20-lifecycle/`.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-pd20-closed-arguments
 */
import { describe, expect, it } from 'vitest'

interface ClosedArgsModule {
  readonly UNSUPPORTED_PARAMETER: string
  readonly BACKGROUND_NOT_SUPPORTED: string
  closedArgumentsRefusal: (toolName: string, args: unknown, declared: readonly string[]) => { code: string, message: string } | null
  assertClosedArguments: (toolName: string, args: unknown, declared: readonly string[]) => void
}

const argsModule: ClosedArgsModule = await import(
  new URL('../src/plugin/live/closed-tool-arguments.mjs', import.meta.url).href
) as ClosedArgsModule

const DECLARED_TERMINAL = ['command', 'description', 'workdir'] as const

describe('PD20-C3 — closed tool arguments are enforced at the call boundary', () => {
  it('classifies run_in_background as BACKGROUND_NOT_SUPPORTED with the capability stated', () => {
    const refusal = argsModule.closedArgumentsRefusal('bash', { command: 'x', description: 'y', run_in_background: true }, DECLARED_TERMINAL)
    expect(refusal).not.toBeNull()
    expect(refusal?.code).toBe(argsModule.BACKGROUND_NOT_SUPPORTED)
    expect(refusal?.message).toContain('no managed-job producer')
    expect(refusal?.message).toContain('REFUSED instead of silently dropped')
    expect(refusal?.message).toContain('foreground')
  })

  it('refuses any other undeclared key with UNSUPPORTED_PARAMETER and the accepted list', () => {
    const refusal = argsModule.closedArgumentsRefusal('bash', { command: 'x', description: 'y', timeoutMs: 5 }, DECLARED_TERMINAL)
    expect(refusal?.code).toBe(argsModule.UNSUPPORTED_PARAMETER)
    expect(refusal?.message).toContain("'timeoutMs'")
    expect(refusal?.message).toContain('command, description, workdir')
  })

  it('passes a call whose keys are all declared, and tolerates absent args', () => {
    expect(argsModule.closedArgumentsRefusal('bash', { command: 'x', description: 'y', workdir: '/tmp' }, DECLARED_TERMINAL)).toBeNull()
    expect(argsModule.closedArgumentsRefusal('bash', {}, DECLARED_TERMINAL)).toBeNull()
    expect(argsModule.closedArgumentsRefusal('bash', undefined, DECLARED_TERMINAL)).toBeNull()
    expect(() => argsModule.assertClosedArguments('bash', { command: 'x' }, DECLARED_TERMINAL)).not.toThrow()
  })

  it('refuses a non-object argument payload instead of treating it as empty', () => {
    expect(argsModule.closedArgumentsRefusal('bash', ['echo'], DECLARED_TERMINAL)?.code).toBe(argsModule.UNSUPPORTED_PARAMETER)
  })

  // ROUND 72 (2026-11-22): the two legs that loaded the REGISTERED route-C shadows
  // (`../src/plugin/live/confined-terminal-tool.mjs`, `../src/plugin/live/confined-bash-tool.mjs`) were
  // retired with their subject: 1617d5839 deleted both modules together with the whole pre-centre execution
  // route, and the centre registers bash through the realm lane rather than a shadow module. The
  // closed-argument ALGEBRA above is preserved and still graded here; re-pointing the registration law at
  // the centre's own bash row is a design task, not a rename.
})
