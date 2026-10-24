#!/usr/bin/env node
/**
 * repro-window — deterministic injection of the a4p7 lint-control window over
 * the p4t6 module-load scan (minimal reproduction, a5-p4t6-race).
 *
 * The census race being fixed: the a4p7 merge-gate lint-scratch leg writes TWO
 * transient `.mts` control files into `packages/testkit/test/` (removed in
 * `finally`), while the p4t6 session-event scanner enumerates every
 * .ts / .mts / .mjs file under `packages` once at module load. When the p4t6
 * load lands in the planting window, the scanner counts the control files:
 * 10 parallel census captures, 1 landed red as `expected 1206 to be 1204`
 * (evidence: g6b-flake README attribution + merge7 logs).
 *
 * This script does not wait for scheduler luck: it plants the two control
 * files exactly as the a4p7 leg does (same path, same name, same content —
 * probe text copied from a4p7-merge-gate.test.ts:1510), runs one p4t6 spec
 * inside the window, and removes them in `finally` (zero residue either way).
 *
 * Usage: node dev/agent-workflow/evidence/a5-p4t6-race/repro-window.mjs <cmd...>
 * where <cmd...> is the p4t6 spec run to execute inside the planted window.
 * Exit: the child's exit code.
 */
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = new URL('../../../..', import.meta.url).pathname.replace(/\/$/, '')
// Verbatim from packages/testkit/test/a4p7-merge-gate.test.ts (probe text) and
// the controls array at line 1530-1531: same location, same names, same bytes.
const probe = 'export const plantedUnusedBinding = 1\nplantedUndefinedCall()\n'
const controlDir = join(repoRoot, 'packages', 'testkit', 'test')
const controls = [
  join(controlDir, 'lint-scratch-control-a.mts'),
  join(controlDir, 'lint-scratch-control-b.mts'),
]

const [, , ...cmd] = process.argv
if (cmd.length === 0) {
  console.error('usage: repro-window.mjs <cmd...>')
  process.exit(2)
}

try {
  for (const c of controls) writeFileSync(c, probe, 'utf8')
  console.log(`[repro-window] planted 2 control files under packages/testkit/test/ (a4p7 leg window simulated)`)
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: repoRoot, stdio: 'inherit' })
  process.exitCode = r.status === null ? 1 : r.status
} finally {
  for (const c of controls) rmSync(c, { force: true })
  console.log(`[repro-window] controls removed (finally)`)
}
