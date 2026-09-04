// T12 §13 diagnostic: composition-smoke logic re-run at the ACTUAL post-P8-S5A
// build layout (runtime build uses rootDir "../..", so the host entry lands at
// dist/packages/runtime/src/plugin/host.js, not dist/plugin/host.js as the
// stale P1-T4 smoke script expects). This proves the smoke failure is a
// stale-path issue, not a broken production entry. NOT part of the repo test
// suite; evidence-only scratch.
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const repoRoot = process.argv[2]

const targets = [
  {
    label: 'host plugin (packages/runtime) @ actual post-P8-S5A path',
    abs: join(repoRoot, 'packages/runtime/dist/packages/runtime/src/plugin/host.js'),
    expectedName: 'dsh-agent-team',
  },
  {
    label: 'client plugin (packages/client) @ actual path',
    abs: join(repoRoot, 'packages/client/dist/plugin/client.js'),
    expectedName: 'dsh-agent-team-client',
  },
]

function minimalContext() {
  const listeners = []
  const effects = []
  const ctx = {
    get: () => undefined,
    on: (event) => { listeners.push(event); return () => {} },
    effect: (disposer) => { effects.push(disposer) },
    service: undefined,
  }
  return { ctx, listeners, effects }
}

let failed = 0
for (const t of targets) {
  try {
    const mod = await import(pathToFileURL(t.abs).href)
    const shapeOk = typeof mod.name === 'string' && mod.name.length > 0 &&
      (typeof mod.apply === 'function' || (typeof mod === 'function' && typeof mod === 'function'))
    const applyFn = typeof mod.apply === 'function' ? mod.apply : (typeof mod === 'function' ? mod : undefined)
    if (typeof mod.name !== 'string' || mod.name !== t.expectedName || typeof applyFn !== 'function') {
      console.log(`FAIL ${t.label}: name=${JSON.stringify(mod.name)} apply=${typeof applyFn}`)
      failed = 1
      continue
    }
    const { ctx, listeners, effects } = minimalContext()
    let threw = null
    try { applyFn(ctx) } catch (e) { threw = e }
    if (threw) {
      console.log(`FAIL ${t.label}: apply(minimalContext) threw: ${threw.message}`)
      failed = 1
      continue
    }
    const sideEffects = listeners.length > 0 || effects.length > 0
    console.log(`${sideEffects ? 'FAIL' : 'PASS'} ${t.label}: name="${mod.name}", apply callable${sideEffects ? ` BUT registered ${listeners.length} listeners / ${effects.length} effects` : ', side-effect-free'}`)
    if (sideEffects) failed = 1
  } catch (e) {
    console.log(`FAIL ${t.label}: cannot import: ${e.message}`)
    failed = 1
  }
}
console.log(failed === 0 ? 'DIAG PASS (actual-path composition shape OK)' : 'DIAG FAIL')
process.exit(failed)
