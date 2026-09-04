#!/usr/bin/env node
// pbf-resolver-fallback-probe.mjs — D4b evidence, S2: run from a BARE
// directory (no package.json, no node_modules of its own) so plain
// resolution of @deepseek-ai/* fails with ERR_MODULE_NOT_FOUND; the
// normal-first hook must then fall back to the discovered checkout
// (references/deepseek-harness-test-use under the PBF worktree / main
// repo) and resolve through it.
//
// Usage (from a bare dir, e.g. references/):
//   node <this file> <PBF-worktree-path>
import { register } from 'node:module'

const PBF = process.argv[2] ?? 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/PBF'
const HOOK = 'file:///' + PBF.replace(/\\/g, '/') + '/packages/runtime/src/plugin/upstream-resolver.mjs'

register(HOOK)

let resolved = null
let pass = true
try {
  const session = await import('@deepseek-ai/dsh-session')
  resolved = true
  if (typeof session.SessionId === 'undefined') {
    console.log('FAIL S2: import succeeded but SessionId export missing')
    pass = false
  }
} catch (error) {
  console.log(`FAIL S2: fallback resolution threw: ${String(error?.message ?? error)} (code=${error?.code})`)
  pass = false
}
if (resolved && pass) {
  // The resolution proof: the hook re-parented into the test-use
  // checkout's apps/cli, whose links answered the specifier. The bare
  // dir has NO node_modules, so this could only succeed via the
  // fallback path.
  console.log('PASS S2: bare-scope @deepseek-ai import resolved via the checkout fallback')
}
console.log(pass ? 'PASS pbf-resolver-fallback-probe' : 'FAIL pbf-resolver-fallback-probe')
process.exit(pass ? 0 : 1)
