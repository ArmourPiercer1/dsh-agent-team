// temp probe: what does the built host apply reject with on a degenerate ctx?
import { pathToFileURL } from 'node:url'

const abs = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9/packages/runtime/dist/packages/runtime/src/plugin/host.js'
const mod = await import(pathToFileURL(abs).href)

const listeners = []
const effects = []
const ctx = {
  get: () => undefined,
  on: (event) => {
    listeners.push(event)
    return () => {}
  },
  effect: (d) => {
    effects.push(d)
  },
}

console.log('name:', mod.name)
console.log('inject:', JSON.stringify(mod.inject))
let failure
let outcome = 'returned'
try {
  const r = mod.apply(ctx)
  if (r !== undefined && typeof r.then === 'function') {
    await r
    outcome = 'resolved'
    console.log('resolved value:', r)
  }
} catch (error) {
  failure = error
  outcome = 'rejected/threw'
}
console.log('outcome:', outcome)
console.log('listeners:', JSON.stringify(listeners))
console.log('effects:', effects.length)
if (failure !== undefined) {
  console.log('failure ctor:', failure && failure.constructor && failure.constructor.name)
  console.log('failure name:', failure && failure.name)
  console.log('failure code:', failure && failure.code)
  console.log('failure message:', failure && failure.message)
  console.log('failure detail:', failure && failure.detail && JSON.stringify(failure.detail))
}
