/**
 * a5sf-pty-session-observer.mjs — the LOCUS witness for the Shell/PTY face
 * (`a5sf-pty-devlive`, instrumentation; decides nothing).
 *
 * WHY IT EXISTS. Run 01 attributed Q1 by PROFILE + EXCLUSION: the composed patch
 * names `@deepseek-ai/dsh-terminal` + `@deepseek-ai/dsh-terminal-bash` +
 * `@deepseek-ai/dsh-tool-bash-persistent`, the governed realm reports no
 * terminal face, and the confined provider recorded no spawn — so the shell must
 * have come from the pinned PTY service. "Must have come from" is an inference,
 * and this lane's own law is that a correct outcome with a wrong LOCUS is a
 * false pass. This module asks the SERVICE ITSELF, on the same owner handle the
 * `bash` tool uses, and returns what it says:
 *
 *   - `listBackends()` — the PTY backend types registered on THIS service
 *     instance (the `shell` type `@deepseek-ai/dsh-terminal-bash` registers);
 *   - `list(owner)` — the owner-scoped session snapshots (sessionId/name/type/
 *     pid/status) for the Member's own agent handle.
 *
 * WHERE IT MUST BE MOUNTED. Inside the SAME preset group as the `bash` tool.
 * `persistentShellGroup()` isolates the `terminals` service for that group
 * (`isolate: {terminals: true}`), so a plugin mounted OUTSIDE the group would
 * observe a DIFFERENT (and empty) registry and prove nothing. Inside the group
 * it injects the exact instance the `bash` tool called.
 *
 * WHAT IT DOES NOT DO. It reads; it never spawns, kills, reports or decides. It
 * is not a confinement claim: `pid` here is the PTY child as the host process
 * sees it, which (on this World) is a PID-namespace-local pid while the shell's
 * own `$$` is its in-namespace view of the same process — that difference is
 * itself recorded by the driver, not papered over.
 *
 * @module dev/agent-workflow/evidence/a5sf-pty-devlive/a5sf-pty-session-observer
 */

/** @type {string} */
export const name = 'a5sf-pty-session-observer'

/** The same seam `@deepseek-ai/dsh-tool-bash-persistent` declares. */
export const inject = ['tools', 'terminals']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register({
    name: 'pty_observe',
    description: 'Report what THIS scope\'s PTY service (the one the `bash` tool uses) knows about the calling agent\'s terminal sessions: registered backend types and owner-scoped session snapshots. Read-only instrumentation for the a5sf Shell/PTY evidence lane.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(_args, exec) {
      const owner = exec?.agent ?? null
      const out = {
        schema: 'a5sf-pty-observe/1',
        at: new Date().toISOString(),
        service: '@deepseek-ai/dsh-terminal (TerminalSessionService)',
        owner: null,
        backends: null,
        sessions: null,
        errors: [],
      }
      try {
        out.owner = owner === null ? null : {
          id: typeof owner.id === 'string' ? owner.id : null,
          sessionId: typeof owner.session?.id === 'string'
            ? owner.session.id
            : (typeof owner.sessionId === 'string' ? owner.sessionId : null),
          cwd: typeof owner.session?.header?.cwd === 'string' ? owner.session.header.cwd : null,
        }
      } catch (error) {
        out.errors.push(`owner: ${String(error?.message ?? error)}`)
      }
      try {
        out.backends = typeof ctx.terminals?.listBackends === 'function' ? ctx.terminals.listBackends() : null
        if (out.backends === null) out.errors.push('terminals.listBackends is not a function on this instance')
      } catch (error) {
        out.errors.push(`listBackends: ${String(error?.message ?? error)}`)
      }
      try {
        if (owner === null) out.errors.push('no exec.agent handle was supplied to execute()')
        else if (typeof ctx.terminals?.list !== 'function') out.errors.push('terminals.list is not a function on this instance')
        else out.sessions = ctx.terminals.list(owner)
      } catch (error) {
        out.errors.push(`list: ${String(error?.message ?? error)}`)
      }
      return JSON.stringify(out)
    },
  })
}
