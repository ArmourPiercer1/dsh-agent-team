#!/usr/bin/env node
/**
 * verify-window.mjs — post-fix isolation check (a5-p4t6-race).
 *
 * Plants the two lint-scratch control probes at the leg's CURRENT placement
 * (the repo root, read from the same join expression as
 * a4p7-merge-gate.test.ts uses post-fix) and runs the p4t6 spec inside that
 * window. Expect: green — the root is outside every package-walking scanner,
 * so the census count cannot move. Passes the child command through; exits
 * with the child's code. Controls are removed in `finally`.
 *
 * Usage: node dev/agent-workflow/evidence/a5-p4t6-race/verify-window.mjs <cmd...>
 */
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = new URL('../../../..', import.meta.url).pathname.replace(/\/$/, '')
const probe = 'export const plantedUnusedBinding = 1\nplantedUndefinedCall()\n'
const controls = [
  join(repoRoot, 'lint-scratch-control-a.mts'),
  join(repoRoot, 'lint-scratch-control-b.mts'),
]

const [, , ...cmd] = process.argv
if (cmd.length === 0) {
  console.error('usage: verify-window.mjs <cmd...>')
  process.exit(2)
}

try {
  for (const c of controls) writeFileSync(c, probe, 'utf8')
  console.log('[verify-window] planted 2 control files at the repo root (post-fix placement window simulated)')
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: repoRoot, stdio: 'inherit' })
  process.exitCode = r.status === null ? 1 : r.status
} finally {
  for (const c of controls) rmSync(c, { force: true })
  console.log('[verify-window] controls removed (finally)')
}
