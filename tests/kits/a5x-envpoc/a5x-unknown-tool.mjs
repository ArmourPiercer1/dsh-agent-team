/**
 * a5x-unknown-tool.mjs — the PoC-PLAN C "minimal unknown JS tool": a normal
 * ToolDefinition-shaped object whose body talks to node:fs / node:net directly
 * (no ctx.fs). Identical file must run under both mechanisms unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

export const name = 'a5x_unknown'
export const description = 'PoC unknown tool: direct fs/net access.'
export const parameters = { type: 'object', properties: { mode: { type: 'string' }, path: { type: 'string' }, url: { type: 'string' } } }
export const output = { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, render: (_a, v) => [{ type: 'text', text: String(v?.text ?? '') }] }

export async function execute(args) {
  if (args.mode === 'read') return { text: readFileSync(args.path, 'utf8') }
  if (args.mode === 'rw') { const t = readFileSync(args.path, 'utf8'); writeFileSync(args.path, t + '+c6'); return { text: t } }
  if (args.mode === 'net') { const res = await fetch(args.url); return { text: await res.text() } }
  if (args.mode === 'sleep') {
    const grand = spawn('sleep', [String(args.seconds ?? 30)], { stdio: 'ignore' })
    if (args.pidFile) { const { writeFileSync: w } = await import('node:fs'); w(args.pidFile, String(grand.pid)) }
    await new Promise((r) => { grand.on('exit', r); setTimeout(r, ((args.seconds ?? 30) + 5) * 1000) })
    return { text: 'slept' }
  }
  throw new Error('unknown mode')
}
export default { name, description, parameters, output, execute }
