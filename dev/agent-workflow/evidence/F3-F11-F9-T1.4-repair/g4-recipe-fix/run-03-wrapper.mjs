// run-03-wrapper.mjs — spawn f9-check.mjs with an EXACT argv array.
//
// Why a wrapper: PowerShell's legacy native-argument passing strips embedded
// double quotes from string arguments (the --json payload would arrive as
// {toolName:write,...}). Spawning node with an argv array sidesteps command
// line quoting entirely. stdio: 'inherit' (no piped stdio) is the sandbox-safe
// pattern (TEST_METHODS.md §5); the driver captures inherited output.
//
// Runs the REAL phasePending against the same persistent residual world with
// the LEGACY G4 filter {kind, target, action} — the pre-fix selection path.
// Expectation: 3 matches (seq 5/6/14), chosen = first by sequence (seq 5,
// v2-l2 — still toolName-less, the same failure class as r2). Exit 0; the
// vars file lands in the local scratch dir, not the shared state dir.
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..')
const MAIN = resolve(WORKTREE, '..', '..')
const F9 = join(WORKTREE, 'tests', 'mock', 'scripts', 'f9-check.mjs')
const WORLD = join(MAIN, 'tests', 'mock', '.dsh-home-repair-r1')
const OUT = join(HERE, 'scratch', 'f9-pending-prestate-legacy.json')

const argv = [F9, 'pending', '--json', JSON.stringify({
  kind: 'leader-approval',
  target: 'inst-0fi1an617bjs',
  action: 'write',
  root: 'session-dtestmts69xkr6b54',
  out: OUT,
})]

console.error(`[wrapper] node ${argv.join(' ')}`)
console.error(`[wrapper] MOCK_DSH_HOME=${WORLD}`)
const child = spawn(process.execPath, argv, {
  stdio: 'inherit',
  env: { ...process.env, MOCK_DSH_HOME: WORLD },
})
child.on('error', (e) => { console.error(`[wrapper] spawn failed: ${e.message}`); process.exit(3) })
child.on('exit', (code) => process.exit(code ?? 1))
