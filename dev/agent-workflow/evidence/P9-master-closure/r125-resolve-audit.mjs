/**
 * r125-resolve-audit.mjs — hermetic resolution audit for the row-owned dynamic
 * modules (agent-bindings glue + harness seam), version-robust form.
 *
 * v2 note (R125 round-2, reviewer-5): the first version used
 * `import.meta.resolve(spec, parentURL)` (two-arg) from an EXTERNAL script, which
 * does not anchor resolution to the module under test on Node v24 (measured false
 * "LEAKED" results). This version anchors with `createRequire(anchorFile)` — the
 * require-style resolution from exactly the file's location — which is stable
 * across Node v22/v24/v26 and is what an in-tree consumer resolves at load time.
 *
 * Checks:
 *   1. dynamic import of both row-owned modules (no missing specifier at load)
 *   2. for each anchor, createRequire(anchor).resolve() of the 6 row-owned
 *      bare specifiers; assert every resolved path lies inside the repo root
 *      (a resolution that walks up out of the tree = leak = fail)
 *
 * Usage:  node r125-resolve-audit.mjs [repoRoot]
 *         (default repoRoot = the P9-MC worktree; override for other trees)
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { existsSync } from 'node:fs'

const root = (process.argv[2] ?? 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC').replace(/\\/g, '/').replace(/\/$/, '')
const anchors = [
  root + '/packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
  root + '/packages/runtime/root-binding/harness/seam.mjs',
]
const specifiers = ['@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-mcp-client', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-storage-domain', 'zod']
let bad = 0
for (const a of anchors) {
  if (!existsSync(a)) {
    console.log('ANCHOR-MISSING ' + a)
    bad++
    continue
  }
  const mod = await import(pathToFileURL(a).href)
  console.log('IMPORT-OK ' + path.basename(a) + ' (top-level exports: ' + Object.keys(mod).length + ')')
  const req = createRequire(a)
  for (const s of specifiers) {
    let resolved
    try {
      resolved = req.resolve(s)
    } catch (e) {
      console.log('RESOLVE-FAIL  ' + s + '  ->  ' + e.message.split('\n')[0])
      bad++
      continue
    }
    const inside = resolved.replace(/\\/g, '/').startsWith(root + '/')
    if (!inside) bad++
    console.log((inside ? 'INSIDE' : 'LEAKED') + '  [' + path.basename(a) + ']  ' + s + '  ->  ' + path.relative(root, resolved))
  }
}
console.log(bad === 0 ? 'AUDIT-PASS: all 12 resolutions inside the tree; both modules import clean (hermetic)' : `AUDIT-FAIL: ${bad} problem(s)`)
process.exit(bad === 0 ? 0 : 1)
