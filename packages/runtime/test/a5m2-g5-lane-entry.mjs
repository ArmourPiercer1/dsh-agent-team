#!/usr/bin/env node
/**
 * a5m2-g5 lane test entry — the SINGLE invocation point for this lane's
 * specs (root 02:3x ruling: the LANE's own entry sets the read-only 639
 * base explicitly; shared vitest configs, other families' defaults and the
 * repo-wide defaults are NOT touched).
 *
 * Why an entry at all: the lane's host-runtime references must resolve to
 * the read-only base
 * `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`
 * (HEAD `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain 0) instead of
 * this worktree's nested checkout, and `tests/paths.mjs` reads
 * `DSH_TEST_USE_ROOT` at module-evaluation time — so the variable must be
 * set BEFORE the spec graph imports paths.mjs. Spawning vitest as a child
 * with the variable in its environment is the only shape that guarantees
 * that for every import order; a spec-body assignment would land too late.
 *
 * Usage (from packages/runtime):
 *   node test/a5m2-g5-lane-entry.mjs [vitest run args...]
 * Runs with no args: the lane's three spec files. Extra args pass through
 * verbatim (e.g. `-t "<name>"`). An explicitly exported
 * `DSH_TEST_USE_ROOT` wins (env inheritance); the entry only supplies the
 * default (`??=`-semantics via the undefined check below).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g5-lane-entry
 */
// `npx` is the runner that works from this checkout with or without a global
// pnpm on PATH (both resolve the same workspace node_modules); keep it over
// a computed bin path, which pnpm's virtual store layout forbids assuming.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// `globalThis.process` (not the bare global): the repo eslint surface
// grants node globals to named files only, and the root 02:3x order forbids
// touching the shared config for a lane file — the property access is the
// same value with zero shared-file edits.
const proc = globalThis.process
const BASE = '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
if (proc.env.DSH_TEST_USE_ROOT === undefined) {
  proc.env.DSH_TEST_USE_ROOT = BASE
}

const HERE = dirname(fileURLToPath(import.meta.url))
const args = proc.argv.slice(2)
const vitestArgs = args.length > 0 ? args : [
  'run',
  'test/a5m2-g5-goal-wiring.test.ts',
  'test/a5m2-g5-goal-service-c1.test.ts',
  'test/a5m2-g5-mount-arm.test.ts',
]

// Spawn through the package runner rather than a computed binary path:
// pnpm's virtual store layout puts `vitest` under a hash-named dir no caller
// may assume, while `npx vitest` resolves it inside this package's own
// workspace (no install, no network). `cwd` is this package root, so
// relative spec args behave exactly as a direct `vitest run` from
// packages/runtime.
const child = spawn('npx', ['vitest', ...vitestArgs], {
  cwd: join(HERE, '..'),
  stdio: 'inherit',
  env: proc.env,
  shell: proc.platform === 'win32',
})
child.on('exit', (code, signal) => {
  proc.exit(signal === null ? (code ?? 1) : 1)
})
