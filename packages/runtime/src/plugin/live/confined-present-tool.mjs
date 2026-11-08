/**
 * confined-present-tool.mjs — the model-visible `present` tool, served by the
 * Member's CONFINED `fs` face.
 *
 * WHY THIS EXISTS (PD-26, 2026-11-14; the row PD-24 opened). PD-24 measured
 * that `present` resolved its targets through the BASE `fs`: the preset row
 * injects `fs` on the registry generation scope, above every agent, so a REAL
 * out-of-lane file was ACCEPTED (`Presented …/secret-out-of-lane.txt`), a
 * missing one was refused `file not found` (a cross-lane existence oracle), all
 * calls produced ZERO `a5sf-guard-consult` facts, and two
 * `deliverables/presented` events landed in the Member's own session. The
 * fail-closed disposition removed the row: a governed Member could no longer
 * declare deliverables. PD-24's evidence named the honest route: "a new
 * route-C product row plus a realm-bound provider face (`confined-present-tool`
 * on the `a5sf-realm-row` attach) with its own allow/deny contract tests".
 *
 * This module is that route-C row, mounted INSIDE the Member's isolated scope
 * AFTER the capability deny lane, so the `fs` it resolves is the confined
 * Provider mounted on that scope. Every `lstat`/`stat` is therefore admitted
 * against the Member's compiled read lane before it runs: an out-of-lane path
 * is a typed `IO_READ_DENIED` (zero bytes, exactly one deny fact), an in-lane
 * file is presented and recorded exactly as before.
 *
 * WHY THE TOOL IS IMPLEMENTED HERE AND NOT BY CALLING THE HOST `apply`: the
 * host package's delivery is a two-step contract — `execute` RESOLVES the files
 * and parks them in a `WeakMap`, and a `ctx.on('tools/result')` listener
 * appends `deliverables/presented` only when the settled result is not an
 * error. The listener is bound to the SCOPE of the `ctx` it registers on; the
 * realm's ctx carries the Member's isolate scope, which does NOT receive an
 * agent-scoped `tools/result` dispatch — measured in this lane's first boot:
 * the in-lane presentation succeeded (two allow facts, `Presented …`) but ZERO
 * `deliverables/presented` events were appended. Delegating `apply` would
 * therefore silently drop the delivery record. So this module keeps the host
 * package's tool DEFINITION verbatim (name, description, parameter/output
 * schema, render, `maxFiles` cap, error texts) and its two-step ordering, but
 * registers the `tools/result` listener on the AGENT's own ctx
 * (`exec.agent.ctx`, the scope that does receive the dispatch), exactly where
 * the host contract says the event belongs — the Member's own Session. The
 * host-free suite pins this module's definition byte-equal to the host
 * package's registered definition so the copy cannot drift silently.
 *
 * The preset keeps the host `@deepseek-ai/dsh-tool-present` row so the NAME is
 * visible before the attach (route C is surface-neutral: it may replace a
 * definition, never add a name); the attach REFUSES the Member setup when it
 * cannot shadow that name (`expectedTools` verification).
 *
 * WHAT THIS DOES NOT DO: it adds no policy source (the lane is the compiled
 * Member policy the realm mounted), changes no schema or delivery semantics,
 * and touches no upstream source (CORE PATCH BUDGET = 0).
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-present-tool
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'a5sf-confined-present'

/** The one model-visible name this module places (the shipped spelling). */
export const A5SF_CONFINED_PRESENT_TOOLS = Object.freeze(['present'])

/** `fs` is the CONFINED face; `sessionProjections` is the host package's own dependency. */
export const inject = ['tools', 'fs', 'sessionProjections']

/** The host package's documented default (`Config.maxFiles`). */
const DEFAULT_MAX_FILES = 8

/** The host package's stable description, verbatim. */
const PRESENT_DESCRIPTION = 'Declare existing files as final deliverables for the user. '
  + 'Use it when the user needs a separate file, especially Office documents, spreadsheets, and slide decks; '
  + 'prefer your final response when that suffices. The user opens the current files; their contents are not copied.'

/** The host package's parameter schema, verbatim. */
const PRESENT_PARAMETERS = {
  files: {
    type: 'array',
    required: true,
    // 4 is the recommended per-call count; `maxFiles` is the enforced ceiling above it.
    description: 'Usually the 1-2 most important deliverables; at most 4 per call.',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', required: true, description: 'Path of an existing regular file. Relative paths use the Session working directory.' },
        description: { type: 'string', description: 'Brief description for the user.' },
      },
    },
  },
}

/** The host package's output schema, verbatim. */
const PRESENT_OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      turn: { type: 'integer', required: true },
      files: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string', required: true },
            description: { type: 'string' },
          },
        },
      },
    },
  },
  render: (_args, value) => [{ type: 'text', text: value.files.map((file) => `Presented ${file.path}`).join('\n') }],
}

/**
 * Re-raise a confined-face refusal with its CODE in the model-visible message.
 * The guard fact already carries the typed code; prefixing it here keeps the
 * tool result from being misread as "file not found".
 */
function typedReadFailure(error, filePath) {
  const code = typeof error?.code === 'string' ? error.code : undefined
  if (code !== undefined && code.startsWith('IO_')) {
    const rethrown = new Error(`${code}: ${error instanceof Error ? error.message : String(error)}`)
    rethrown.cause = error
    rethrown.code = code
    return rethrown
  }
  // An in-lane path that does not exist is still the host package's own
  // `FS_NOT_FOUND` refusal (the code, not a new one).
  if (error?.code === 'FS_NOT_FOUND') return error
  void filePath
  return error
}

/**
 * Register the confined `present` tool.
 * @param {object} ctx - the Member realm's routed context (confined `fs`).
 * @param {{ maxFiles?: number }} [config]
 */
export function apply(ctx, config = {}) {
  const maxFiles = config?.maxFiles ?? DEFAULT_MAX_FILES
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) {
    throw new Error('present requires a positive integer maxFiles')
  }
  /** Files resolved by a call, waiting for its settled `tools/result`. */
  const pending = new WeakMap()
  /** Agents whose ctx already carries the delivery listener (one per agent). */
  const listening = new WeakSet()

  ctx.tools.register(defineTool({
    name: 'present',
    description: PRESENT_DESCRIPTION,
    parameters: PRESENT_PARAMETERS,
    output: PRESENT_OUTPUT,
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('present requires an agent Session')
      const boundary = ctx.sessionProjections.stateOf(exec.agent.session, 'turnBoundary')
      if (boundary === undefined || boundary.openTurnStartSeq === null) throw new Error('present requires an open turn')
      if (args.files.length === 0 || args.files.length > maxFiles) throw new Error(`present accepts 1 to ${String(maxFiles)} files`)
      const cwd = exec.agent.session.header.cwd
      if (cwd === undefined) throw new Error('present requires a workspace')
      const options = { cwd, signal: exec.signal }
      const files = []
      for (const file of args.files) {
        if (file.path.trim().length === 0) throw new Error('present requires a non-empty file path')
        let entry
        let target
        let info
        try {
          // The FIRST target-bearing call: the confined Provider consults the
          // compiled lane here, before any stat or existence answer happens.
          entry = await ctx.fs.lstat(file.path, { cwd }, exec.signal)
          if (entry !== undefined && entry.type !== 'file') throw new Error(`Cannot present ${file.path}: not a regular file`)
          target = await ctx.fs.resolve(file.path, options)
          info = await ctx.fs.stat(target, exec.signal)
        } catch (error) {
          throw typedReadFailure(error, file.path)
        }
        if (info === undefined) {
          // The host package's own `FS_NOT_FOUND` refusal (this path IS inside
          // the lane; the lane did not deny it).
          const notFound = new Error(`Cannot present ${file.path}: file not found. Check the path, create the file if needed, and retry.`)
          notFound.code = 'FS_NOT_FOUND'
          throw notFound
        }
        if (info.type !== 'file') throw new Error(`Cannot present ${file.path}: not a regular file`)
        files.push({ ...file })
      }
      exec.signal.throwIfAborted()
      pending.set(exec, { session: exec.agent.session, turn: boundary.lastTurn, files })
      // The delivery listener belongs to the AGENT's ctx: that is the scope the
      // agent-scoped `tools/result` dispatch reaches (see the module header —
      // the realm ctx does not). Registered once per agent, like the host row.
      if (!listening.has(exec.agent)) {
        listening.add(exec.agent)
        exec.agent.ctx.on('tools/result', (settledExec, result) => {
          const delivery = pending.get(settledExec)
          pending.delete(settledExec)
          if (delivery === undefined || result.isError) return
          delivery.session.append('deliverables/presented', {
            turn: delivery.turn, callId: settledExec.callId, files: delivery.files,
          })
        })
      }
      return { turn: boundary.lastTurn, files }
    },
  }))
}
