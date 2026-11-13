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
/** The durable `control-execution-result` outcome vocabulary (unchanged). */
export type ControlExecutionOutcome = 'succeeded' | 'failed' | 'unknown';
/**
 * The terminal status the pinned persistent-shell tool appends to its
 * model-facing text. `undefined` = the result was not a shell observation (or
 * its trailer was absent), and the caller falls back to `isError`.
 */
export type ShellTerminalStatus = {
    readonly kind: 'exit';
    readonly code: number;
} | {
    readonly kind: 'timed-out';
} | {
    readonly kind: 'session-exit';
    readonly code: number | null;
} | {
    readonly kind: 'signal';
    readonly signal: string;
};
/**
 * Read the pinned shell status trailer from the LAST line of the result text.
 * Anchored (`$`) and last-line-only, so a look-alike marker inside the command
 * output cannot decide the fact — the tool's own marker is always appended
 * after that output.
 */
export declare function shellTerminalStatusOfResult(result: unknown): ShellTerminalStatus | undefined;
/**
 * The outcome of one terminal tool result. See the module header for the
 * closed vocabulary and why each branch answers what it answers.
 */
export declare function outcomeOfTerminalResult(result: unknown): ControlExecutionOutcome;
//# sourceMappingURL=execution-outcome.d.ts.map