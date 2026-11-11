/**
 * a5p5-execution-outcome.test.ts — PD-41 (owner ruling 2026-11-11): an ANSWERED
 * backend call is not automatically a COMPLETED one.
 *
 * The A6 execution-result observation is derived from what the body OBSERVED,
 * not from the backend's "I answered" bit. The measured pre-fix shape
 * (`dev/agent-workflow/evidence/wp3-fence-timing/run-residual-s373/`): the
 * confined shell logged `cancelled=true exit=not-observed` and no effect file
 * landed, while the durable `control-execution-result` said `succeeded`. A
 * cancelled or timed-out body now reports `unknown` — the ledger's existing
 * value for "admitted, end never observed" — and a completed run still reports
 * `succeeded` (including a non-zero exit: the run completed, the code is data).
 *
 * This law belongs to the lane that owns the observation; the typed dispatch
 * refusal it pairs with is pinned in `runtime/test/pd41-allow-semantics.test.ts`.
 *
 * @module test/a5p5-execution-outcome
 */
import { describe, expect, it } from 'vitest'
import type { BackendFailure } from '../src/backend-contract.js'
import { executionOutcomeOfAnsweredCall, runToolCall } from '../src/pipeline.js'
import type { RenderedPresentation, SearchOutcome, ShellOutcome } from '../src/types.js'

/** A legal `workspace` target (the parser's own materialized default shape). */
const cwd = { placement: 'workspace' as const, locator: '.' }

describe('PD-41 A — an answered call is not automatically a completed one', () => {
  const shell = (over: Partial<ShellOutcome> = {}): ShellOutcome => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
    cancelled: false,
    truncated: false,
    ...over,
  })

  it('a cancelled body (exit not observed) is `unknown`, never `succeeded`', () => {
    const result = {
      ok: true as const,
      // the exact shape the confined shell returns on the abort arm:
      // `cancelled: true`, `exitCode: null`, settlement `{kind:'cancelled'}`
      outcome: shell({ cancelled: true, exitCode: null }),
      settlement: { kind: 'cancelled' as const, event: 'dispatcher-call-terminated-after-body-start' as const },
    }
    expect(executionOutcomeOfAnsweredCall(result)).toBe('unknown')
  })

  it('a timed-out body is `unknown` (the race never saw an end)', () => {
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ timedOut: true, exitCode: null }),
      settlement: { kind: 'cancelled' as const, event: 'dispatcher-call-terminated-after-body-start' as const },
    })).toBe('unknown')
  })

  it('a completed run is `succeeded`, including a NON-ZERO exit (the code is data, not a verdict)', () => {
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ exitCode: 0, stdout: 'ok' }),
      settlement: { kind: 'completed' as const },
    })).toBe('succeeded')
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ exitCode: 3, stderr: 'boom' }),
      settlement: { kind: 'completed' as const },
    })).toBe('succeeded')
  })

  it('a cancelled SHELL row reports `unknown` through the ONE pipeline (and still renders cancelled)', async () => {
    const observed: Array<{ callId: string; outcome: string }> = []
    const rendered: RenderedPresentation[] = []
    const result = await runToolCall({
      request: { realmId: 'realm-pd41', callId: 'pd41-cancelled', parsedArgs: { tool: 'bash', command: 'echo hi', cwd, background: false, timeoutMs: 1000 } },
      decide: () => ({ kind: 'allow' }),
      backend: {
        backendId: 'pd41-cancelled-backend',
        execCount: () => 0,
        lastStageTrace: [],
        run: async () => ({
          ok: true as const,
          outcome: shell({ cancelled: true, exitCode: null }),
          settlement: { kind: 'cancelled' as const, event: 'dispatcher-call-terminated-after-body-start' as const },
        }),
      },
      onExecutionResult: (input) => observed.push({ callId: input.callId, outcome: input.outcome }),
    })
    if (result.kind !== 'presented') throw new Error(`expected a presented row, got ${result.kind}`)
    rendered.push(result.rendered)
    expect(observed).toEqual([{ callId: 'pd41-cancelled', outcome: 'unknown' }])
    // the presentation and the fact now agree: the row SAYS cancelled, and the
    // fact does not claim a completion the row contradicts.
    expect(rendered[0]?.text).toContain('bash · cancelled')
    expect(rendered[0]?.presentationMeta).toMatchObject({ kind: 'shell', cancelled: true, exitCode: null })
  })

  it('an ANSWERED FAILURE stays `failed` and a THROW stays `failed` (unchanged)', async () => {
    const observed: string[] = []
    const failed = await runToolCall({
      request: { realmId: 'realm-pd41', callId: 'pd41-failed', parsedArgs: { tool: 'bash', command: 'echo hi', cwd, background: false, timeoutMs: 1000 } },
      decide: () => ({ kind: 'allow' }),
      backend: {
        backendId: 'pd41-failed-backend',
        execCount: () => 0,
        lastStageTrace: [],
        run: async () => ({
          ok: false as const,
          failure: { class: 'denied', code: 'PD41_REFUSED', detail: 'scripted' } satisfies BackendFailure,
          settlement: { kind: 'completed' as const },
        }),
      },
      onExecutionResult: (input) => observed.push(input.outcome),
    })
    expect(failed.kind).toBe('backend-failed')
    expect(observed).toEqual(['failed'])
    observed.length = 0
    await expect(runToolCall({
      request: { realmId: 'realm-pd41', callId: 'pd41-throw', parsedArgs: { tool: 'bash', command: 'echo hi', cwd, background: false, timeoutMs: 1000 } },
      decide: () => ({ kind: 'allow' }),
      backend: {
        backendId: 'pd41-throw-backend',
        execCount: () => 0,
        lastStageTrace: [],
        run: async () => { throw new Error('PD41_BACKEND_THROW') },
      },
      onExecutionResult: (input) => observed.push(input.outcome),
    })).rejects.toThrow('PD41_BACKEND_THROW')
    expect(observed).toEqual(['failed'])
  })

  it('a SEARCH row (no cancel bit) keeps `succeeded` — the law never changes another arm', async () => {
    const observed: string[] = []
    const search: SearchOutcome = {
      outputMode: 'content',
      matches: [{ path: 'a.txt', line: 1, text: 'x' }],
      counts: [],
      files: [],
      totalMatches: 1,
      truncated: false,
    }
    await runToolCall({
      request: { realmId: 'realm-pd41', callId: 'pd41-search', parsedArgs: {
          tool: 'grep',
          pattern: 'x',
          target: cwd,
          outputMode: 'content',
          fixedString: false,
          ignoreCase: false,
          multiline: false,
          contextLines: 0,
          maxResults: 10,
        } },
      decide: () => ({ kind: 'allow' }),
      backend: {
        backendId: 'pd41-search-backend',
        execCount: () => 0,
        lastStageTrace: [],
        run: async () => ({ ok: true as const, outcome: search, settlement: { kind: 'completed' as const } }),
      },
      onExecutionResult: (input) => observed.push(input.outcome),
    })
    expect(observed).toEqual(['succeeded'])
  })
})
