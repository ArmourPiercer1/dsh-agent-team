// I2-P1 fixture row: registers one tool per entry in `config.tools`.
// Import-free on purpose — the Loader resolves entry modules through Node's
// ESM resolver, which cannot see this workspace's TypeScript sources.
//
// The `file_path` argument schema on the tools named `read`/`write` mirrors
// the real fs tools' parameter surface so the alpha.2 permission pipeline
// (canonicalizeOperation -> resolveTarget) drives them exactly as it drives
// the production read/write (the P4 precedence legs).
export const name = 'i2-contribute'
export const inject = ['tools', 'systemPrompt']

export function apply(ctx, config) {
  for (const spec of config.tools) {
    const { name: toolName, description, parameters, reply } = spec
    ctx.effect(() => ctx.tools.register({
      name: toolName,
      description: description ?? `fixture tool ${toolName}`,
      parameters: parameters ?? { type: 'object', properties: {}, additionalProperties: false },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      execute: (args, _exec) => Promise.resolve(String(reply ?? `${toolName}-ok${args?.file_path ? ':' + args.file_path : ''}`)),
    }))
  }
  ctx.effect(() => ctx.systemPrompt.section({
    name: `preset:i2-${config.tag}`,
    order: 10,
    text: `section for preset ${config.tag}`,
  }))
}
