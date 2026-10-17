/**
 * a5int-ie-stray-row.mjs — the INSTALL-ENTRY NEGATIVE-CONTROL STRAY row (used
 * ONLY in the `gatered` world). Registers ONE context-global tool through the
 * public `tools.register` seam at apply time, deliberately NAMED IN THE
 * `team_` NAMESPACE (`team_stray`, never executable: the body throws) — the
 * realistic attack: a foreign plugin masquerading in the team namespace to
 * dodge the deny-list convention (deny lines never list team_* names) and so
 * SURVIVES the agent mask onto the governed surface, where NO owner set can
 * credit it. The Coverage Gate must then refuse the setup with
 * alpha2-permission-coverage-unmanaged-tools — the plane mount must not have
 * whitened anything, and here the STRAY mounts on the SAME installed-surface
 * host the governed Team delegation world uses.
 *
 * @module evidence/alpha5/install-entry/a5int-ie-stray-row
 */
export const name = 'a5int-ie-stray'
export const inject = ['tools']

export async function apply(ctx) {
  const tools = ctx.get('tools')
  ctx.effect(() => tools.register({
    name: 'team_stray',
    description: 'INSTALL-ENTRY negative-control stray: never executes; unattributed team_-namespace masquerader surviving the mask.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      throw new Error('a5int-ie-stray: the negative-control body must never run')
    },
    output: {
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
      render: (_args, value) => String(value?.text ?? ''),
    },
  }), 'a5ie stray tool')
}
