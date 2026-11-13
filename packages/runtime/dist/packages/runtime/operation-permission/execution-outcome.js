/**
 * execution-outcome.ts — the ONE derivation of a `control-execution-result`
 * outcome from what a tool invocation actually did.
 *
 * PD-42 (owner ruling 2026-11-13) supersedes the PD-41 clause that called a
 * non-zero shell exit "still a completion and therefore `succeeded`". The
 * measured defect (`dev/agent-workflow/evidence/v016-min-closing-20261113/`,
 * proposition 1): an APPROVED governed `bash` write outside the Member's
 * filesystem ceiling was refused by the OS (`Read-only file system`, target
 * `ENOENT`, shell exit 1), while the durable execution fact said `succeeded`.
 * An operator reading the ledger could not tell a real write from a refused
 * one. The ledger must record what the execution did, not that the tool
 * answered.
 *
 * CLOSED VOCABULARY (the durable schema already allows exactly these three;
 * no new state is invented): `succeeded | failed | unknown`.
 *
 * - `succeeded` — the invocation was observed to complete AND did not report a
 *   failure: a tool result with `isError: false`, and — when the model-facing
 *   text carries the pinned shell status trailer — exit code 0;
 * - `failed` — an ANSWERED failure: the body ran and reported a tool error, or
 *   the pinned shell status trailer reports a non-zero exit / a killed shell.
 *   (A dispatch refused after the allow was consumed is also `failed`, written
 *   by the caller's dispatch arm, not by this classifier.);
 * - `unknown` — the invocation was cancelled/aborted or its end was never
 *   observed (the PD-41 abort class: `TOOL_ABORTED`,
 *   `TOOL_ABORTED_BEFORE_DISPATCH`, an `AbortError`), a shell timeout/OOM (the
 *   command's end was never observed), an unexpected shell session exit (the
 *   command was not observed to finish), and any shape this module does not
 *   recognise.
 *
 * A DENIAL (nothing executed, the allow never consumed) writes NO execution
 * result at all — "never executed" is not one of these three words. That
 * distinction lives in the caller, not here.
 *
 * WHY THE SHELL STATUS IS READ FROM THE TEXT. The pinned native
 * `@deepseek-ai/dsh-tool-bash-persistent` definition exposes its exit code ONLY
 * in the model-facing trailer (`[Command finished with exit code N]`,
 * `[Command timed out or OOM]`, `[shell exited: code N]`,
 * `[shell killed by signal: X]`); `ToolResult` carries `content` + `isError`
 * + an optional tool-private `meta`, and this tool declares no `meta`
 * projector. There is therefore no structured exit-code field to consult, and
 * the durable `control-execution-result` payload has no field for one either
 * (`ControlExecutionResultRecord`: requestId/callId/outcome/recordedAt/
 * sequence). Reading the pinned trailer is the available observation; adding a
 * schema field is a compatibility decision, disclosed rather than taken here.
 *
 * The trailer is read from the LAST line of the model-facing text and the
 * match is anchored to the end of that line. That anchoring is what makes it
 * safe against command output that prints a look-alike marker: the pinned tool
 * appends its own status marker AFTER the command's output (even when the
 * output was truncated), so the last marker is the tool's own.
 *
 * NO second classifier may grow beside this one: the two lanes that write the
 * durable fact (the permission lane's terminal observer and the native-bash
 * admission edge) both import this module; the a5p5 lane reads its structured
 * `exitCode`/settlement directly and keeps the SAME vocabulary.
 *
 * @module @dsh-agent-team/runtime/operation-permission/execution-outcome
 */
const EXIT_TRAILER = /^\[Command finished with exit code (-?\d+)\]$/;
const TIMEOUT_TRAILER = '[Command timed out or OOM]';
const SESSION_EXIT_TRAILER = /^\[shell exited(?:: code (-?\d+))?\]$/;
const SIGNAL_TRAILER = /^\[shell killed by signal: ([^\]\n]+)\]$/;
/**
 * The model-facing text of a tool result. Supports the `ToolResult` shape
 * (`content: ContentBlock[]`, text blocks) and a raw string (fixtures and
 * older rows); anything else is `undefined`.
 */
function resultText(result) {
    if (typeof result === 'string')
        return result;
    if (result === null || typeof result !== 'object')
        return undefined;
    const content = result.content;
    if (typeof content === 'string')
        return content;
    if (!Array.isArray(content))
        return undefined;
    let text = '';
    let sawText = false;
    for (const block of content) {
        if (block === null || typeof block !== 'object')
            continue;
        const candidate = block;
        if (candidate.type !== 'text' || typeof candidate.text !== 'string')
            continue;
        text += candidate.text;
        sawText = true;
    }
    return sawText ? text : undefined;
}
/**
 * Read the pinned shell status trailer from the LAST line of the result text.
 * Anchored (`$`) and last-line-only, so a look-alike marker inside the command
 * output cannot decide the fact — the tool's own marker is always appended
 * after that output.
 */
export function shellTerminalStatusOfResult(result) {
    const text = resultText(result);
    if (text === undefined)
        return undefined;
    const trimmed = text.trimEnd();
    if (trimmed.length === 0)
        return undefined;
    const line = trimmed.slice(trimmed.lastIndexOf('\n') + 1);
    if (line === TIMEOUT_TRAILER)
        return { kind: 'timed-out' };
    const exit = EXIT_TRAILER.exec(line);
    if (exit !== null)
        return { kind: 'exit', code: Number(exit[1]) };
    const sessionExit = SESSION_EXIT_TRAILER.exec(line);
    if (sessionExit !== null) {
        return { kind: 'session-exit', code: sessionExit[1] === undefined ? null : Number(sessionExit[1]) };
    }
    const signal = SIGNAL_TRAILER.exec(line);
    if (signal !== null)
        return { kind: 'signal', signal: signal[1] };
    return undefined;
}
/**
 * The outcome of one terminal tool result. See the module header for the
 * closed vocabulary and why each branch answers what it answers.
 */
export function outcomeOfTerminalResult(result) {
    if (result === null || typeof result !== 'object')
        return 'unknown';
    const record = result;
    if (record.isError === true) {
        // An ANSWERED failure is `failed` unless the body was aborted: an abort is
        // not an observed execution failure (PD-41).
        const error = record.error;
        if (error !== null && typeof error === 'object') {
            const info = error.info;
            if (info !== null && typeof info === 'object') {
                const code = info.code;
                if (code === 'TOOL_ABORTED' || code === 'TOOL_ABORTED_BEFORE_DISPATCH')
                    return 'unknown';
            }
            const name = error.name;
            if (name === 'AbortError')
                return 'unknown';
        }
        return 'failed';
    }
    if (record.isError !== false)
        return 'unknown';
    const status = shellTerminalStatusOfResult(result);
    if (status !== undefined) {
        if (status.kind === 'exit')
            return status.code === 0 ? 'succeeded' : 'failed';
        if (status.kind === 'signal')
            return 'failed';
        // A timeout/OOM never observed the command's end; a shell session exit did
        // not observe the command finish either. Both are the honest `unknown`.
        return 'unknown';
    }
    return 'succeeded';
}
//# sourceMappingURL=execution-outcome.js.map