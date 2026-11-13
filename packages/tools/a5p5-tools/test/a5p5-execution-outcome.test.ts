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
 * value for "admitted, end never observed" — and a completed run with exit
 * code 0 reports `succeeded`. PD-42 (owner ruling 2026-11-13) supersedes the
 * earlier "a non-zero exit is still a completion, the code is data" clause: a
 * completed shell body that reported a NON-ZERO exit is `failed`, because the
 * durable fact must not claim a refused/failed command succeeded.
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

  it('a completed run with exit code 0 is `succeeded`; a NON-ZERO exit is `failed` (PD-42)', () => {
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ exitCode: 0, stdout: 'ok' }),
      settlement: { kind: 'completed' as const },
    })).toBe('succeeded')
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ exitCode: 3, stderr: 'boom' }),
      settlement: { kind: 'completed' as const },
    })).toBe('failed')
  })

  it('a completed SEARCH run (no exit code) is still `succeeded`', () => {
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: { outputMode: 'content' as const, matches: [], counts: [], files: [], totalMatches: 0, truncated: false },
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

/**
 * PD41-ABORT-CLASS — the audit's narrower arm. `shellCancelled()` mints the
 * rendered `cancelled` bit ONLY for the `user`/`parent` arms of the host's
 * closed cancel-cause union, so an abort with any other reason (a forwarded
 * inherited signal, a host deadline's DOMException, a plain AbortError, a
 * `hook`/`disposed` cause) answered the pipeline as
 * `cancelled:false, timedOut:false, exitCode:null, settlement:{kind:'cancelled'}`
 * and was durably recorded `succeeded` before this classification. The
 * settlement is the backend's own terminal fact; it decides now.
 */
describe('PD41-ABORT-CLASS — a non-user/non-parent abort is never `succeeded`', () => {
  const shell = (over: Partial<ShellOutcome> = {}): ShellOutcome => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
    cancelled: false,
    truncated: false,
    ...over,
  })
  const cancelledSettlement = {
    kind: 'cancelled' as const,
    event: 'dispatcher-call-terminated-after-body-start' as const,
  }
  /** The exact shape the confined shell answers for ANY abort it terminated:
   *  the settlement says `cancelled`; the rendered bit is minted only for
   *  user/parent, so these three differ only in what the reason WOULD be. */
  const abortedButNotMarked = (): { ok: true; outcome: ShellOutcome; settlement: typeof cancelledSettlement } => ({
    ok: true as const,
    outcome: shell({ cancelled: false, timedOut: false, exitCode: null }),
    settlement: cancelledSettlement,
  })

  it('a forwarded inherited-signal abort (cancelled=false, settlement=cancelled) is `unknown`', () => {
    expect(executionOutcomeOfAnsweredCall(abortedButNotMarked())).toBe('unknown')
  })

  it('a host-deadline abort (a DOMException reason, cancelled=false) is `unknown`', () => {
    // The rendered bits are identical to the inherited-signal arm; the
    // distinction lives in the reason, which the row never minted a flag for.
    const result = abortedButNotMarked()
    expect(new DOMException('deadline', 'TimeoutError').name).toBe('TimeoutError')
    expect(executionOutcomeOfAnsweredCall(result)).toBe('unknown')
  })

  it('a plain AbortError abort (cancelled=false, settlement=cancelled) is `unknown`', () => {
    expect(executionOutcomeOfAnsweredCall(abortedButNotMarked())).toBe('unknown')
  })

  it('a settlement that is not `completed` wins over a mislabelled outcome (defence in depth)', () => {
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ cancelled: false, timedOut: false, exitCode: 0 }),
      settlement: cancelledSettlement,
    })).toBe('unknown')
  })

  it('a completed settlement with a NON-ZERO exit is `failed` (PD-42)', () => {
    expect(executionOutcomeOfAnsweredCall({
      ok: true,
      outcome: shell({ exitCode: 7, stderr: 'boom' }),
      settlement: { kind: 'completed' as const },
    })).toBe('failed')
  })

  it('an ABORT-SHAPED THROW is `unknown`; any other throw stays `failed` (the existing arm)', async () => {
    const observed: string[] = []
    const throwBackend = (thrown: Error): Parameters<typeof runToolCall>[0] => ({
      request: { realmId: 'realm-pd41', callId: 'pd41-abort-throw', parsedArgs: { tool: 'bash', command: 'echo hi', cwd, background: false, timeoutMs: 1000 } },
      decide: () => ({ kind: 'allow' }),
      backend: {
        backendId: 'pd41-abort-throw-backend',
        execCount: () => 0,
        lastStageTrace: [],
        run: async () => { throw thrown },
      },
      onExecutionResult: (input) => observed.push(input.outcome),
    })
    await expect(runToolCall(throwBackend(new DOMException('deadline', 'AbortError')))).rejects.toThrow('deadline')
    expect(observed).toEqual(['unknown'])
    observed.length = 0
    const abortErr = Object.assign(new Error('aborted by signal'), { code: 'ABORT_ERR' })
    await expect(runToolCall(throwBackend(abortErr))).rejects.toThrow('aborted by signal')
    expect(observed).toEqual(['unknown'])
    observed.length = 0
    await expect(runToolCall(throwBackend(new Error('PD41_BACKEND_THROW')))).rejects.toThrow('PD41_BACKEND_THROW')
    expect(observed).toEqual(['failed'])
  })

  it('the non-user abort reaches the pipeline as `unknown` (one row, one observation)', async () => {
    const observed: string[] = []
    const result = await runToolCall({
      request: { realmId: 'realm-pd41', callId: 'pd41-inherited', parsedArgs: { tool: 'bash', command: 'sleep 5', cwd, background: false, timeoutMs: 1000 } },
      decide: () => ({ kind: 'allow' }),
      backend: {
        backendId: 'pd41-inherited-backend',
        execCount: () => 0,
        lastStageTrace: [],
        run: async () => abortedButNotMarked(),
      },
      onExecutionResult: (input) => observed.push(input.outcome),
    })
    expect(result.kind).toBe('presented')
    expect(observed).toEqual(['unknown'])
  })
})
