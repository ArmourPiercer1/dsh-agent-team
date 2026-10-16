import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const F = pathToFileURL(resolve('dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-fixture.mjs')).href
const { makeFixture, countingTool } = await import(F)
const tick = () => new Promise((r) => setTimeout(r, 5))
const f = await makeFixture()
const A = await f.mintScope('A')
const gate = { promise: null, release: null }
gate.promise = new Promise((r) => { gate.release = r })
A.scope.ctx.tools.register(countingTool(f.obs, 'grep', 'V1', { gate: gate.promise }))
const caller = new AbortController()
const p = f.run('grep', A.key, { signal: caller.signal })
const t = Date.now(); while (f.counters('V1') < 1 && Date.now() - t < 5000) await tick()
console.log('body started, aborting caller')
caller.abort()
await tick(); await tick()
console.log('signal.aborted now =', caller.signal.aborted)
gate.release()
const res = await p
console.log('RESULT', JSON.stringify({ text: res.text, code: res.code, isError: res.isError }))
process.exit(0)
