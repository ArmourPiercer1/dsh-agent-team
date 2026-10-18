/**
 * dev-only diagnostic row: measure the confined provider's probe INSIDE the
 * booted DSH host (the same ambient the production plane runs in), and log the
 * raw launcher answer + PATH + provider verdict. Not evidence; a debugging
 * instrument for the a5ie-r2b round's A6/A7 legs.
 *
 * @module dev-runs/abi-probe-row
 */
import { spawnSync } from 'node:child_process'

export const name = 'a5ie-abi-probe'
export const inject = []

const LAUNCHER = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b/.scratch-repro-abi/landlock-prelauncher.py'
const DIST = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b/packages/runtime/dist/packages/runtime/sandbox-provider/index.js'

const log = (label, value) => { console.log(`[a5ie-abi-probe] ${label} ${typeof value === 'string' ? value : JSON.stringify(value)}`) }

export async function apply () {
  log('ambient', { pid: process.pid, execPath: process.execPath, PATH: process.env.PATH ?? '(unset)', A5P4_PYTHON: process.env.A5P4_PYTHON ?? '(unset)', cwd: process.cwd(), threading: 'n/a' })
  const r = spawnSync('python3', [LAUNCHER, '--abi-probe'], { encoding: 'utf8', timeout: 20_000 })
  log('raw python3 spawn', { status: r.status, error: r.error === undefined ? null : String(r.error.message ?? r.error).slice(0, 200), stdout: String(r.stdout ?? '').trim().slice(0, 200), stderr: String(r.stderr ?? '').slice(0, 200) })
  const r2 = spawnSync('/usr/bin/python3', [LAUNCHER, '--abi-probe'], { encoding: 'utf8', timeout: 20_000 })
  log('raw /usr/bin/python3 spawn', { status: r2.status, error: r2.error === undefined ? null : String(r2.error.message ?? r2.error).slice(0, 200), stdout: String(r2.stdout ?? '').trim().slice(0, 200) })
  try {
    const m = await import(DIST)
    const { createHash } = await import('node:crypto')
    const { readFileSync } = await import('node:fs')
    const sha = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
    const provider = m.createConfinedProcessProvider({
      realmId: 'a5ie-abi-probe-realm',
      trustRoot: `sha256:${sha.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b/.scratch-repro-abi',
      assembly: { launcherPath: LAUNCHER, launcherSha256: sha, minAbiVersion: 3 },
    })
    const probed = await provider.probe()
    if (probed.ok === true) {
      log('provider.probe', { ok: true, rows: probed.value.map((x) => `${x.dimension}=${x.level}`).join(','), mech: (probed.value.find((x) => x.mechanism) ?? {}).mechanism ?? null })
    } else {
      log('provider.probe', { ok: false, error: probed.error })
    }
  } catch (error) {
    log('provider.probe threw', String(error?.stack ?? error).split('\n').slice(0, 3).join(' | '))
  }
}
