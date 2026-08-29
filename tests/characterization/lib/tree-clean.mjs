/**
 * Characterization harness — test-use tree byte-clean verification.
 *
 * Runs the exact TEST_METHODS §2/§3 commands (`git status --porcelain`,
 * `git diff`, `git rev-parse HEAD`) inside the pinned upstream tree. Git is
 * spawned the sandbox-legal way (file-fd stdio — spawn probe P4 proved a git
 * child with fd stdio works in-sandbox), so the whole byte-clean check runs
 * under the single `node run.mjs` command; no pwsh layer is required.
 *
 * `gitHeadInProcess` is a best-effort fallback that reads `.git/HEAD` and the
 * resolved ref without spawning (packed or loose refs); it is used only when
 * the git spawn is unavailable (e.g. a future sandbox that denies even fd
 * spawns), and its result is then labeled as such.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnToLog } from './util.mjs'

/**
 * Capture the three git snapshots of the tree in one pass.
 * @returns {Promise<{head: string|undefined, headSource: 'git'|'in-process'|'unknown', status: string, statusEmpty: boolean, diff: string, diffEmpty: boolean, errors: string[]}>}
 */
export async function captureGitState(hostTree, logDir) {
  const errors = []
  const headResult = await spawnToLog('git', ['rev-parse', 'HEAD'], {
    cwd: hostTree,
    logPath: join(logDir, 'git-head.log'),
    timeoutMs: 30_000,
  })
  let head
  let headSource = 'git'
  if (headResult.ok) {
    head = headResult.text.trim().split('\n').pop()?.trim()
  } else {
    headSource = 'in-process'
    head = gitHeadInProcess(hostTree)
    if (head === undefined) {
      headSource = 'unknown'
      errors.push(`git rev-parse unavailable (${headResult.error}) and in-process fallback failed`)
    }
  }

  const statusResult = await spawnToLog('git', ['status', '--porcelain'], {
    cwd: hostTree,
    logPath: join(logDir, 'git-status.log'),
    timeoutMs: 60_000,
  })
  if (!statusResult.ok) errors.push(`git status unavailable: ${statusResult.error}`)

  const diffResult = await spawnToLog('git', ['diff'], {
    cwd: hostTree,
    logPath: join(logDir, 'git-diff.log'),
    timeoutMs: 120_000,
  })
  if (!diffResult.ok) errors.push(`git diff unavailable: ${diffResult.error}`)

  const status = statusResult.ok ? statusResult.text : ''
  const diff = diffResult.ok ? diffResult.text : ''
  return {
    head,
    headSource,
    status,
    statusEmpty: statusResult.ok && status.trim() === '',
    diff,
    diffEmpty: diffResult.ok && diff.trim() === '',
    errors,
  }
}

/** In-process HEAD resolution: .git/HEAD -> ref -> loose ref or packed-refs. */
export function gitHeadInProcess(hostTree) {
  try {
    const headRef = readFileSync(join(hostTree, '.git', 'HEAD'), 'utf8').trim()
    if (/^[0-9a-f]{40}$/i.test(headRef)) return headRef.toLowerCase()
    if (!headRef.startsWith('ref: ')) return undefined
    const refName = headRef.slice('ref: '.length).trim()
    const loose = readFileSync(join(hostTree, '.git', refName), 'utf8').trim()
    if (/^[0-9a-f]{40}$/i.test(loose)) return loose.toLowerCase()
    const packed = readFileSync(join(hostTree, '.git', 'packed-refs'), 'utf8')
    for (const line of packed.split('\n')) {
      if (line.startsWith('#') || line.includes('^')) continue
      const [sha, name] = line.split(/\s+/)
      if (name === refName && /^[0-9a-f]{40}$/i.test(sha)) return sha.toLowerCase()
    }
    return undefined
  } catch {
    return undefined
  }
}
