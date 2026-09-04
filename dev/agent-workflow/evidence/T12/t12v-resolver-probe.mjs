// T12-V diagnostic: does the upstream-resolver hook resolve seam.mjs's bare imports
// when given time to activate? cwd mimics the DSH boot (host tree root).
const hook = 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/src/plugin/upstream-resolver.mjs'
const seam = 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/root-binding/harness/seam.mjs'
const { register } = await import('node:module')
register(hook, import.meta.url)
// Give the hook thread time to load the hook module (module.register is async).
await new Promise((r) => setTimeout(r, 500))
try {
  await import(seam)
  console.log('SEAM LOADED (hook active + resolution OK)')
} catch (e) {
  console.log('SEAM LOAD FAILED: ' + e.message)
  process.exit(1)
}
