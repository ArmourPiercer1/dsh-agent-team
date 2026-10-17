/**
 * a5g5-stray-row.mjs — the GLUE-5 NEGATIVE-CONTROL STRAY row (used ONLY in
 * the `gatered` world). It registers ONE context-global tool through the
 * public `tools.register` seam at apply time, deliberately NAMED IN THE
 * `team_` NAMESPACE (`team_stray`, never executable: the body throws) — the
 * realistic attack: a foreign plugin masquerading in the team namespace to
 * dodge the deny-list convention (deny lines never list team_* names) and so
 * SURVIVES the agent mask onto the governed surface, where NO owner set can
 * credit it. The Coverage Gate must then refuse the setup with
 * alpha2-permission-coverage-unmanaged-tools — GLUE-5's plane mount must not
 * have whitened anything. (World-measured first, then fixed here: a plainly
 * named stray is simply MASKED OUT — mask+credits close that path, which the
 * kit also asserts as a positive fact; only the masquerading name reaches
 * the gate.) The web bundle's trusted global face is otherwise EMPTY
 * (glue4 G4), so this is the ONLY unattributed name in the process.
 *
 * @module evidence/alpha5/glue5/a5g5-stray-row
 */
export const name = 'a5g5-stray'
export const inject = ['tools']

export async function apply(ctx) {
  const tools = ctx.get('tools')
  ctx.effect(() => tools.register({
    name: 'team_stray',
    description: 'GLUE-5 negative-control stray: never executes; unattributed team_-namespace masquerader surviving the mask.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      throw new Error('a5g5-stray: the negative-control body must never run')
    },
    // WELL-FORMED presentation face (host registration law: register()
    // requires output { schema, render }). An earlier note here blamed a
    // scalar face for the wire stalls — WITHDRAWN: the true culprit was the
    // version-less sentinel package.json (plugin-package-inventory REQUEST
    // EXTENSION); see README §5.12. This face stays closed-{ text } because
    // the negative control must fail on ATTRIBUTION (the Coverage Gate) only.
    output: {
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
      render: (_args, value) => String(value?.text ?? ''),
    },
  }), 'a5g5 stray tool')
}
