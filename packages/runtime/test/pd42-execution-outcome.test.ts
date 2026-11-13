/**
 * pd42-execution-outcome.test.ts — PD-42 (owner ruling 2026-11-13; relay fix
 * 2026-11-17): the durable `control-execution-result` must record what the
 * execution DID, not merely that the tool answered.
 *
 * The measured defect (`dev/agent-workflow/evidence/v016-min-closing-20261113/`,
 * proposition 1, reproduced twice): an APPROVED governed `bash` write outside
 * the Member filesystem ceiling was refused by the OS (`Read-only file system`,
 * target `ENOENT`), the tool text carried `[Command finished with exit code 1]`,
 * and the ledger still wrote `outcome=succeeded` because the classifier only
 * read `isError === false`.
 *
 * The second defect (C2-B A-2 on `cand-v0.1.6-5`, fixed on this branch): the
 * pinned tool appends its own reset sentence **after** the status trailer on
 * the timeout and session-exit paths, so a "marker is the last line" read
 * missed those real texts and classified them `succeeded`. Earlier revisions of
 * this file pinned a SYNTHETIC marker-last string the tool never emits, which
 * is why the defect passed the suite.
 *
 * EVERY text below is VERBATIM tool output, captured from the pinned
 * `@deepseek-ai/dsh-tool-bash-persistent` 0.2.0-rc.2 definition itself by
 * `dev/agent-workflow/evidence/pd42-relfix-20261117/capture-pinned-texts.mjs`
 * (see `captured-tool-texts.json` next to it). None of the trailers or reset
 * sentences is invented here.
 *
 * The pinned tool returns its output as a **string** (its output schema is
 * `{type:'string'}`); the durable execution-result schema has no exit-code
 * field, so the classifier reads that text. Last-line anchoring keeps a
 * look-alike marker printed by the command from deciding the fact.
 *
 * @module test/pd42-execution-outcome
 */
import { describe, expect, it } from 'vitest'
import {
  outcomeOfTerminalResult,
  shellTerminalStatusOfResult,
} from '../operation-permission/pre-execute-adapter.js'

/** The `ToolResult` shape the terminal funnel receives. */
function toolResult(text: string, isError = false): {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
} {
  return { content: [{ type: 'text', text }], isError }
}

/**
 * The exact sentence the pinned tool appends after its trailer on the timeout
 * and session-exit returns (captured, not invented).
 */
const SHELL_RESET = 'The persistent bash shell was reset; the next bash call starts from the workspace with a fresh current directory and environment.'

/** Verbatim captures — `captured-tool-texts.json`, one key each. */
const CAPTURED = {
  success: 'A1_INSIDE_WROTE\n[Command finished with exit code 0]',
  nonZero: 'bash: /home/member/mc-pd42-outside.txt: Read-only file system\n[Command finished with exit code 1]',
  timeout: `Your command timed out after 1 seconds or experienced an OOM error. Below is partial output:\npartial output\n[Command timed out or OOM]\n${SHELL_RESET}`,
  sessionExit: `maybe some output\n[shell exited: code 0]\n${SHELL_RESET}`,
  sigkill: `maybe some output\n[shell killed by signal: SIGKILL]\n${SHELL_RESET}`,
  fakeSuccessLine: '[Command finished with exit code 0]\nRead-only file system\n[Command finished with exit code 1]',
} as const

describe('PD-42 — the durable outcome follows the execution, not the tool answer', () => {
  it('captured success text: exit 0 is `succeeded`', () => {
    expect(shellTerminalStatusOfResult(toolResult(CAPTURED.success))).toEqual({ kind: 'exit', code: 0 })
    expect(outcomeOfTerminalResult(toolResult(CAPTURED.success))).toBe('succeeded')
  })

  it('captured non-zero text (OS refusal) is `failed`', () => {
    expect(shellTerminalStatusOfResult(toolResult(CAPTURED.nonZero))).toEqual({ kind: 'exit', code: 1 })
    expect(outcomeOfTerminalResult(toolResult(CAPTURED.nonZero))).toBe('failed')
  })

  it('captured timeout text (trailer followed by the reset sentence) is `unknown`', () => {
    // The string ends with the reset sentence; the trailer is one line above.
    expect(shellTerminalStatusOfResult(toolResult(CAPTURED.timeout))).toEqual({ kind: 'timed-out' })
    expect(outcomeOfTerminalResult(toolResult(CAPTURED.timeout))).toBe('unknown')
  })

  it('captured session-exit text (trailer followed by the reset sentence) is `unknown`', () => {
    expect(shellTerminalStatusOfResult(toolResult(CAPTURED.sessionExit))).toEqual({ kind: 'session-exit', code: 0 })
    expect(outcomeOfTerminalResult(toolResult(CAPTURED.sessionExit))).toBe('unknown')
  })

  it('captured SIGKILL text (trailer followed by the reset sentence) is `failed`', () => {
    expect(shellTerminalStatusOfResult(toolResult(CAPTURED.sigkill))).toEqual({ kind: 'signal', signal: 'SIGKILL' })
    expect(outcomeOfTerminalResult(toolResult(CAPTURED.sigkill))).toBe('failed')
  })

  it('a command that PRINTS a fake `[Command finished with exit code 0]` line does not win', () => {
    // Captured from `printf '[Command finished with exit code 0]\n'; false`.
    expect(outcomeOfTerminalResult(toolResult(CAPTURED.fakeSuccessLine))).toBe('failed')
  })

  it('a printed look-alike signal line inside a successful output does not win', () => {
    expect(outcomeOfTerminalResult(toolResult('[shell killed by signal: SIGKILL]\n[Command finished with exit code 0]'))).toBe('succeeded')
  })

  it('a printed reset sentence is not a trailer: with the real trailer last it stays `succeeded`', () => {
    const text = `${SHELL_RESET}\n[Command finished with exit code 0]`
    expect(shellTerminalStatusOfResult(toolResult(text))).toEqual({ kind: 'exit', code: 0 })
    expect(outcomeOfTerminalResult(toolResult(text))).toBe('succeeded')
  })

  it('a reset sentence with no trailer behind it decides nothing', () => {
    // `[Command finished with exit code 0]` here is command output, not a
    // trailer appended by the tool; the trailing reset sentence has nothing the
    // tool itself emitted behind it.
    expect(shellTerminalStatusOfResult(toolResult(`[Command finished with exit code 0]\n${SHELL_RESET}`))).toBeUndefined()
  })

  it('a tool error is `failed` even when a success marker is present', () => {
    expect(outcomeOfTerminalResult(toolResult('[Command finished with exit code 0]', true))).toBe('failed')
  })

  it('a non-shell `isError:false` result keeps the historical `succeeded` (no trailer to read)', () => {
    expect(outcomeOfTerminalResult(toolResult('written 14 bytes'))).toBe('succeeded')
  })

  it('the PD-41 abort class stays `unknown`, never a claimed completion', () => {
    expect(outcomeOfTerminalResult({
      content: [{ type: 'text', text: 'aborted' }],
      isError: true,
      error: { name: 'AbortError' },
    })).toBe('unknown')
    expect(outcomeOfTerminalResult({
      content: [{ type: 'text', text: 'aborted' }],
      isError: true,
      error: { info: { code: 'TOOL_ABORTED' } },
    })).toBe('unknown')
  })

  it('an unreadable shape is `unknown`, never `succeeded`', () => {
    expect(outcomeOfTerminalResult(null)).toBe('unknown')
    expect(outcomeOfTerminalResult('a bare string with no trailer is not a completion')).toBe('unknown')
    expect(outcomeOfTerminalResult({ content: [] })).toBe('unknown')
  })
})

/**
 * D-A (2026-11-17): the native `bash` definition returns a raw STRING, and the
 * PA leg used to feed that string to the classifier, get `unknown` (non-object),
 * and drop the durable fact entirely. The same captured texts must classify the
 * same way when the value is the string the pinned tool actually returns.
 */
describe('D-A — the PA leg classifies the raw string the pinned tool returns', () => {
  it('success string is `succeeded`', () => {
    expect(outcomeOfTerminalResult(CAPTURED.success)).toBe('succeeded')
  })

  it('non-zero string is `failed`', () => {
    expect(outcomeOfTerminalResult(CAPTURED.nonZero)).toBe('failed')
  })

  it('timeout / session-exit strings are `unknown`, SIGKILL is `failed`', () => {
    expect(outcomeOfTerminalResult(CAPTURED.timeout)).toBe('unknown')
    expect(outcomeOfTerminalResult(CAPTURED.sessionExit)).toBe('unknown')
    expect(outcomeOfTerminalResult(CAPTURED.sigkill)).toBe('failed')
  })

  it('a look-alike marker printed by the command does not win on the string path either', () => {
    expect(outcomeOfTerminalResult(CAPTURED.fakeSuccessLine)).toBe('failed')
  })

  it('an empty string (the pinned abort return) is `unknown`', () => {
    expect(outcomeOfTerminalResult('')).toBe('unknown')
  })
})
