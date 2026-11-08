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

interface RegisteredSpec {
  readonly name: string
  readonly parameters: { readonly properties?: Record<string, unknown>, readonly additionalProperties?: boolean }
  execute: (args: Record<string, unknown>, exec: unknown) => Promise<unknown>
}

const argsModule: ClosedArgsModule = await import(
  new URL('../src/plugin/live/closed-tool-arguments.mjs', import.meta.url).href
) as ClosedArgsModule

/** Load one route-C shadow module and capture what it registers. */
async function loadShadow(relative: string): Promise<{ spec: RegisteredSpec, spawnCalls: number }> {
  const mod = await import(new URL(relative, import.meta.url).href) as {
    apply: (ctx: unknown, config?: Record<string, unknown>) => void
  }
  let captured: RegisteredSpec | undefined
  const counter = { spawnCalls: 0 }
  const ctx = {
    tools: {
      register(spec: RegisteredSpec) {
        captured = spec
      },
    },
    terminals: {
      async spawn() {
        counter.spawnCalls += 1
        throw new Error('a refused call must never reach the confined terminal face')
      },
    },
    subprocess: {
      spawn() {
        counter.spawnCalls += 1
        throw new Error('a refused call must never reach the confined subprocess face')
      },
    },
  }
  mod.apply(ctx, { cwd: process.cwd(), workspace: process.cwd() })
  if (captured === undefined) throw new Error(`${relative} registered no tool`)
  return { spec: captured, spawnCalls: counter.spawnCalls }
}

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

  it('the registered terminal `bash` stays closed and refuses run_in_background with ZERO spawns', async () => {
    const { spec } = await loadShadow('../src/plugin/live/confined-terminal-tool.mjs')
    expect(spec.name).toBe('bash')
    expect(spec.parameters.additionalProperties).toBe(false)
    expect(Object.keys(spec.parameters.properties ?? {}).sort()).toEqual(['command', 'description', 'workdir'])
    expect(spec.parameters.properties).not.toHaveProperty('run_in_background')

    const failure = await spec.execute(
      { command: 'sleep 30; echo hi', description: 'background probe', run_in_background: true },
      { agent: { session: { header: { cwd: process.cwd() } } } },
    ).then(() => null, (error: unknown) => error as { code?: string, message?: string })
    expect(failure).not.toBeNull()
    expect(failure?.code).toBe(argsModule.BACKGROUND_NOT_SUPPORTED)
    expect(failure?.message).toContain('BACKGROUND_NOT_SUPPORTED')
  })

  it('the registered PD-12 subprocess `bash` refuses it too, with zero spawns', async () => {
    const { spec } = await loadShadow('../src/plugin/live/confined-bash-tool.mjs')
    expect(spec.parameters.additionalProperties).toBe(false)
    const failure = await spec.execute(
      { command: 'sleep 30', description: 'background probe', run_in_background: true },
      { agent: { session: { header: { cwd: process.cwd() } } } },
    ).then(() => null, (error: unknown) => error as { code?: string })
    expect(failure?.code).toBe(argsModule.BACKGROUND_NOT_SUPPORTED)
  })
})
