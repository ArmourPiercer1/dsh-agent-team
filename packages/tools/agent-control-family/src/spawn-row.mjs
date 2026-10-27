/**
 * agent-control-family/src/spawn-row.mjs — the governed `subagent` ROW
 * Definition (U7-F). The Family owns the Definition; `execute` is a thin
 * transport over the INJECTED executor (the effect body with the
 * Kernel-injected PA edge inside). Native spelling, fixed (the jobs/fs
 * takeover precedent): dispatch resolves THIS placement; a row under a
 * different name is not the governed subagent.
 *
 * @module agent-control-family/spawn-row
 */

export function buildSpawnRowDefinition({ name, spawnExecutor }) {
  return Object.freeze({
    name,
    description: 'Delegate a self-contained task to a governed subagent. The spawn is admission-gated before any agent is created, stays bounded by the CALLER\'s own authority (no privilege amplification), and every child is recorded on the mount\'s own scope.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'A short (3-5 word) description of the delegated task.' },
        prompt: { type: 'string', description: 'The complete, self-contained task for the subagent.' },
        provider: { type: 'string', description: 'LLM provider route for the child; must sit inside the caller\'s own authority.' },
        model: { type: 'string', description: 'Model id for the child; must sit inside the caller\'s own authority.' },
        reasoning_effort: { type: 'string', description: 'Adapter-owned reasoning effort for the child route.' },
        run_in_background: { type: 'boolean', description: 'Whether the child runs in the background.' },
      },
      required: ['description', 'prompt'],
      additionalProperties: false,
    },
    execute: async (raw, exec) => {
      const corr = {
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        // The DISPATCH-provided caller identity (native callingAgent law):
        // trusted transport data — the model cannot express or restate it.
        ...(exec?.agent === null || exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await spawnExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') return outcome.value ?? { delegated: true }
      if (outcome.kind === 'cancelled') return { cancelled: true, content: [{ type: 'text', text: 'subagent · cancelled' }], meta: { cancelled: true } }
      throw new Error(outcome.text ?? 'refused-agent-control — the governed subagent executor produced no outcome')
    },
  })
}
