import { pathToFileURL } from 'node:url'
const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC'
const anchors = [
  root + '/packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
  root + '/packages/runtime/root-binding/harness/seam.mjs',
]
const specifiers = ['@deepseek-ai/dsh-agent','@deepseek-ai/dsh-llm','@deepseek-ai/dsh-mcp-client','@deepseek-ai/dsh-session','@deepseek-ai/dsh-storage-domain','zod']
let bad = 0
for (const a of anchors) {
  const mod = await import(pathToFileURL(a).href)
  console.log('IMPORT-OK ' + a.split('/').slice(-3).join('/') + ' (top-level keys: ' + Object.keys(mod).length + ')')
  for (const s of specifiers) {
    let resolved
    try { resolved = await import.meta.resolve(s, pathToFileURL(a).href) }
    catch (e) { resolved = 'RESOLVE-FAIL: ' + e.message.split('\n')[0] }
    const inside = String(resolved).startsWith('file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC/')
    if (!inside) bad++
    console.log(`${inside ? 'INSIDE' : 'LEAKED'}  ${s}  ->  ${String(resolved).slice(0, 130)}`)
  }
}
console.log(bad === 0 ? 'AUDIT-PASS: all specifiers resolve within P9-MC (hermetic)' : `AUDIT-FAIL: ${bad} leaked`)
process.exit(bad === 0 ? 0 : 1)

