/**
 * a5x-ctx-dependent-tool.mjs — the WHOLE_TOOL_UNSUPPORTED trigger: an otherwise
 * normal tool that REQUIRES a DSH ctx.fs service (transparent load must fail in
 * a bare tool host; per POC-PLAN C we report it, not re-implement it).
 */
export const name = 'a5x_ctx_tool'
export const parameters = { type: 'object', properties: {} }
export const output = { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, render: (_a, v) => [{ type: 'text', text: String(v?.text ?? '') }] }

export async function execute(_args, ctx) {
  const fs = ctx?.fs
  if (fs === undefined) throw new Error('ctx.fs service required — cannot run outside a service realm')
  return { text: 'would read via ctx.fs' }
}
export default { name, parameters, output, execute }
