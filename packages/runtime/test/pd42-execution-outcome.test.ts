/**
 * pd42-execution-outcome.test.ts — PD-42 (owner ruling 2026-11-13): the
 * durable `control-execution-result` must record what the execution DID, not
 * merely that the tool answered.
 *
 * The measured defect (`dev/agent-workflow/evidence/v016-min-closing-20261113/`,
 * proposition 1, reproduced twice): an APPROVED governed `bash` write outside
 * the Member filesystem ceiling was refused by the OS (`Read-only file system`,
 * target `ENOENT`), the tool text carried `[Command finished with exit code 1]`,
 * and the ledger still wrote `outcome=succeeded` because the classifier only
 * read `isError === false`.
 *
 * This is the host-free regression for the derivation. The pinned native
 * `@deepseek-ai/dsh-tool-bash-persistent` exposes its exit code ONLY as the
 * final text trailer (`ToolResult` has no exit-code field, and the durable
 * execution-result schema has no field for one either — disclosed, not
 * silently extended); the classifier therefore reads that trailer, anchored to
 * the END of the model-facing text so a look-alike marker printed by the
 * command itself cannot decide the fact.
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

describe('PD-42 — the durable outcome follows the execution, not the tool answer', () => {
  it('exit 0 is `succeeded` (the genuinely successful inside write)', () => {
    expect(outcomeOfTerminalResult(toolResult('MC_PD42_INSIDE_OK\n[Command finished with exit code 0]'))).toBe('succeeded')
  })

  it('a NON-ZERO shell exit with the OS refusal is `failed` (the measured defect)', () => {
    const refusal = 'bash: /home/x/mc-pd42-outside.txt: Read-only file system\n[Command finished with exit code 1]'
    expect(shellTerminalStatusOfResult(toolResult(refusal))).toEqual({ kind: 'exit', code: 1 })
    expect(outcomeOfTerminalResult(toolResult(refusal))).toBe('failed')
  })

  it('the trailing marker is the tool\'s own: a look-alike marker inside the output does not win', () => {
    // A command that PRINTS a fake success marker, then the real refusal.
    const text = '[Command finished with exit code 0]\nRead-only file system\n[Command finished with exit code 1]'
    expect(outcomeOfTerminalResult(toolResult(text))).toBe('failed')
  })

  it('a tool error is `failed` even when a success marker is present', () => {
    expect(outcomeOfTerminalResult(toolResult('[Command finished with exit code 0]', true))).toBe('failed')
  })

  it('a shell timeout/OOM is `unknown` (the command end was never observed)', () => {
    expect(shellTerminalStatusOfResult(toolResult('partial output\n[Command timed out or OOM]'))).toEqual({ kind: 'timed-out' })
    expect(outcomeOfTerminalResult(toolResult('partial output\n[Command timed out or OOM]'))).toBe('unknown')
  })

  it('a killed shell is `failed`; an unexpected session exit is `unknown`', () => {
    expect(outcomeOfTerminalResult(toolResult('[shell killed by signal: SIGKILL]'))).toBe('failed')
    expect(outcomeOfTerminalResult(toolResult('maybe some output\n[shell exited: code 0]'))).toBe('unknown')
    expect(outcomeOfTerminalResult(toolResult('[shell exited]'))).toBe('unknown')
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
    expect(outcomeOfTerminalResult('a bare string is not a ToolResult')).toBe('unknown')
    expect(outcomeOfTerminalResult({ content: [] })).toBe('unknown')
  })
})
